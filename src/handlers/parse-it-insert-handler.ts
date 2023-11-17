import { DeepClient } from "@deep-foundation/deeplinks/imports/client.js";
import { Link } from "@deep-foundation/deeplinks/imports/minilinks.js";
import { DeepClientInstance } from "@deep-foundation/deeplinks/imports/client.js";
import { BoolExpLink } from "@deep-foundation/deeplinks/imports/client_types.js";

(options: {
  deep: SyncDeepClient;
  data: {
    newLink: Link<number>;
  };
}) => {
  const {
    deep,
    data: { newLink: parseItLink },
  } = options;
  try {
    const result = main();
    return JSON.stringify(
      {
        result: result,
      },
      getJsonStringifyCircularReplacer(),
    );
  } catch (error) {
    throw new Error(
      JSON.stringify(
        {
          ...(error instanceof Error
            ? { errorMessage: error.message, errorStack: error.stack }
            : {}),
        },
        getJsonStringifyCircularReplacer(),
      ),
    );
  }

  function main() {
    const { data: rootLinkSelectData } = deep.select({
      id: parseItLink.from_id,
    });
    const rootLink = rootLinkSelectData[0] as Link<number>;
    if (!rootLink) {
      throw new Error(`parseIt.from does not exist: ##${parseItLink.from_id}`);
    }

    let obj;
    if (typeof rootLink.value?.value === "object") {
      obj = rootLink.value?.value;
    } else if (typeof rootLink.value?.value === "string") {
      try {
        obj = JSON.parse(rootLink.value?.value);
      } catch (error) {
        throw new Error(
          `##${rootLink.id} must be valid JSON if it is a string`,
        );
      }
    } else {
      throw new Error(`##${rootLink.id} must have value`);
    }
    if (!obj) {
      throw new Error(`##${rootLink.id} must have value`);
    }

    const result = processObject({
      deep: deep,
      obj: obj,
      rootLinkId: rootLink.id,
      resultLinkId: parseItLink.to_id,
    });

    return result;
  }
};

function processObject(options: {
  deep: SyncDeepClient;
  rootLinkId?: number;
  obj: AllowedObject;
  customMethods?: Record<string, Function>;
  resultLinkId?: number;
}) {
  const { deep, rootLinkId, obj, customMethods, resultLinkId } = options;
  const logs: Array<any> = [];

  class ObjectToLinksConverter {
    rootLink: Link<number>;
    obj: AllowedObject;
    resultLink: Link<number>;
    deep = deep;
    static requiredPackageNames = {
      core: "@deep-foundation/core",
      boolean: "@deep-foundation/boolean",
    };

    constructor(options: ObjectToLinksConverterOptions) {
      this.rootLink = options.rootLink;
      this.obj = options.obj;
      this.resultLink = options.resultLink;
    }

    static getLogger(namespace: string) {
      const logger = (value: any) => {
        logs.push({ namespace, value });
      };
      logger.namespace = namespace;
      logger.extend = function (namespace: string) {
        return ObjectToLinksConverter.getLogger(
          `${logger.namespace}${namespace}`,
        );
      };
      return logger;
    }

    static getContainTreeLinksDownToParent(
      options: GetContainTreeLinksDownToLinkOptions,
    ) {
      const log = ObjectToLinksConverter.getLogger(
        ObjectToLinksConverter.getContainTreeLinksDownToParent.name,
      );
      const { linkExp } = options;
      const query: BoolExpLink = {
        up: {
          tree_id: deep.id("@deep-foundation/core", "containTree"),
          parent: linkExp,
        },
      };
      log({ query });
      const result = deep.select(query);
      log({ result });
      return result;
    }

    /**
     * Undefined is returned of root object is empty
     */
    static init(
      options: ObjectToLinksConverterInitOptions,
    ): ObjectToLinksConverter {
      const log = ObjectToLinksConverter.getLogger(
        ObjectToLinksConverter.init.name,
      );
      log({ options });
      const { obj } = options;
      const rootLink: Link<number> = options.rootLinkId
        ? (deep.select(options.rootLinkId).data[0] as Link<number>)
        : (deep.insert(
            {
              type_id: deep.id(deep.linkId!, "Root"),
            },
            {
              returning: deep.linksSelectReturning,
            },
          ).data[0] as Link<number>);
      log({ rootLink });
      const resultLink = options.resultLinkId
        ? (deep.select(options.resultLinkId).data[0] as Link<number>)
        : rootLink;
      if (options.resultLinkId && !resultLink) {
        throw new Error(
          `Result link with id ${options.resultLinkId} not found`,
        );
      }
      const converter = new this({
        rootLink,
        obj,
        resultLink,
      });
      log({ converter });
      return converter;
    }

    convert() {
      const log = ObjectToLinksConverter.getLogger("convert");

      console.time(`${ObjectToLinksConverter.name} updateObjectValue before`);
      this.updateObjectValue({
        link: this.resultLink,
        value: this.obj,
      });
      console.time(`${ObjectToLinksConverter.name} updateObjectValue before`);

      // const hasResultTypeLinkId = deep.id(deep.linkId!, "HasResult");
      // const {
      //   data: [hasResultLink],
      // } = deep.select({
      //   type_id: hasResultTypeLinkId,
      //   from_id: this.rootLink.id,
      // });
      // if (hasResultLink) {
      //   deep.update(
      //     {
      //       type_id: hasResultTypeLinkId,
      //       from_id: this.rootLink.id,
      //     },
      //     {
      //       to_id: this.resultLink.id,
      //     },
      //     {
      //       table: "links",
      //     },
      //   );
      // } else {
      //   deep.insert(
      //     {
      //       type_id: hasResultTypeLinkId,
      //       from_id: this.rootLink.id,
      //       to_id: this.resultLink.id,
      //     },
      //     {
      //       table: "links",
      //     },
      //   );
      // }

      return {
        rootLinkId: this.rootLink.id,
        resultLinkId: this.resultLink.id,
      };
    }

    updateBooleanValue(options: UpdateBooleanValueOptions) {
      const log = ObjectToLinksConverter.getLogger(
        this.updateBooleanValue.name,
      );
      log({ options });
      const { link, value } = options;
      deep.update(
        {
          id: link.id,
        },
        {
          to_id: deep.id(
            ObjectToLinksConverter.requiredPackageNames.boolean,
            value.toString(),
          ),
        },
        {
          table: "links",
        },
      );
    }

    updateStringValue(options: UpdateStringValueOptions) {
      const log = ObjectToLinksConverter.getLogger(this.updateStringValue.name);
      log({ options });
      const { link, value } = options;
      deep.update(
        {
          link_id: link.id,
        },
        {
          value: value,
        },
        {
          table: "strings",
        },
      );
    }

    updateNumberValue(options: UpdateNumberValueOptions) {
      const log = ObjectToLinksConverter.getLogger(this.updateNumberValue.name);
      log({ options });
      const { link, value } = options;
      deep.update(
        {
          link_id: link.id,
        },
        {
          value: value,
        },
        {
          table: "numbers",
        },
      );
    }

    updateArrayValue<TValue extends AllowedArray>(
      options: UpdateAnyValueOptions<TValue>,
    ) {
      const log = ObjectToLinksConverter.getLogger(this.updateAnyValue.name);
      const { link, value } = options;

      deep.delete({
        up: {
          tree_id: deep.id("@deep-foundation/core", "ContainTree"),
          parent_id: link.id,
        },
      });

      for (let i = 0; i < value.length; i++) {
        const element = value[i];
        this.insertAnyValue({
          value: element,
          name: i.toString(0),
          parentLinkId: link.id,
        });
      }
    }

    updateAnyValue<TValue extends AllowedValue>(
      options: UpdateAnyValueOptions<TValue>,
    ) {
      const log = ObjectToLinksConverter.getLogger(this.updateAnyValue.name);
      const { link, value } = options;
      if (typeof value === "boolean") {
        this.updateBooleanValue({
          ...options,
          value,
        });
      } else if (typeof value === "string") {
        this.updateStringValue({
          ...options,
          value,
        });
      } else if (typeof value === "number") {
        this.updateNumberValue({
          ...options,
          value,
        });
      } else if (Array.isArray(value)) {
        this.updateArrayValue({
          ...options,
          value,
        });
      } else if (typeof value === "object") {
        this.updateObjectValue({
          ...options,
          value,
        });
      } else {
        throw new Error(`Type of value ${typeof value} is not supported`);
      }
    }

    updateObjectValue(options: UpdateObjectValueOptions) {
      const log = ObjectToLinksConverter.getLogger(this.updateObjectValue.name);
      const { link, value } = options;
      log({ options });

      for (const [propertyKey, propertyValue] of Object.entries(value)) {
        log({ propertyKey, propertyValue });
        const {
          data: [propertyLink],
        } = deep.select({
          id: {
            _id: [link.id, propertyKey],
          },
        });
        log({ propertyLink });
        if (propertyLink) {
          this.updateAnyValue({
            link: propertyLink as Link<number>,
            value: propertyValue,
          });
        } else {
          if (
            typeof propertyValue !== "string" &&
            typeof propertyValue !== "number" &&
            typeof propertyValue !== "boolean" &&
            !Array.isArray(propertyValue) &&
            typeof propertyValue !== "object"
          ) {
            log(
              `Skipping property ${propertyKey} because its type ${typeof value} is not supported`,
            );
            continue;
          }

          this.insertAnyValue({
            parentLinkId: link.id,
            value: propertyValue,
            name: propertyKey,
          });
        }
      }
    }

    insertBooleanValue(options: InsertBooleanOptions) {
      const log = ObjectToLinksConverter.getLogger(
        this.insertBooleanValue.name,
      );
      log({ options });
      const { value, parentLinkId, name } = options;

      const {
        data: [{ id: linkId }],
      } = deep.insert({
        type_id: deep.id(deep.linkId!, toPascalCase(typeof value)),
        from_id: parentLinkId,
        to_id: deep.id(
          ObjectToLinksConverter.requiredPackageNames.boolean,
          value.toString(),
        ),
      });
      log({ linkId });

      const {
        data: [{ id: containLinkId }],
      } = deep.insert({
        type_id: deep.id("@deep-foundation/core", "Contain"),
        from_id: parentLinkId,
        to_id: linkId,
        string: {
          data: {
            value: name,
          },
        },
      });
      log({ containLinkId });
    }
    insertStringValue(options: InsertStringValueOptions) {
      const log = ObjectToLinksConverter.getLogger(this.insertStringValue.name);
      log({ options });
      const { value, parentLinkId, name } = options;

      const {
        data: [{ id: linkId }],
      } = deep.insert({
        from_id: parentLinkId,
        to_id: parentLinkId,
        type_id: deep.id(deep.linkId!, toPascalCase(typeof value)),
        string: {
          data: {
            value: value,
          },
        },
      });
      log({ linkId });

      const {
        data: [{ id: containLinkId }],
      } = deep.insert({
        type_id: deep.id("@deep-foundation/core", "Contain"),
        from_id: parentLinkId,
        to_id: linkId,
        string: {
          data: {
            value: name,
          },
        },
      });
      log({ containLinkId });
    }

    insertNumberValue(options: InsertNumberValueOptions) {
      const log = ObjectToLinksConverter.getLogger(this.insertNumberValue.name);
      log({ options });
      const { value, parentLinkId, name } = options;

      const {
        data: [{ id: linkId }],
      } = deep.insert({
        from_id: parentLinkId,
        to_id: parentLinkId,
        type_id: deep.id(deep.linkId!, toPascalCase(typeof value)),
        number: {
          data: {
            value: value,
          },
        },
      });
      log({ linkId });

      const {
        data: [{ id: containLinkId }],
      } = deep.insert({
        type_id: deep.id("@deep-foundation/core", "Contain"),
        from_id: parentLinkId,
        to_id: linkId,
        string: {
          data: {
            value: name,
          },
        },
      });

      log({ containLinkId });
    }

    insertArrayValue(options: InsertArrayValueOptions) {
      const log = ObjectToLinksConverter.getLogger(this.insertArrayValue.name);
      log({ options });
      const { value, name, parentLinkId } = options;

      const {
        data: [{ id: linkId }],
      } = deep.insert({
        type_id: deep.id(deep.linkId!, toPascalCase(typeof value)),
        from_id: parentLinkId,
        to_id: parentLinkId,
      });
      log({ linkId });

      const {
        data: [{ id: contaiLinkId }],
      } = deep.insert({
        type_id: deep.id("@deep-foundation/core", "Contain"),
        from_id: parentLinkId,
        to_id: linkId,
        string: {
          data: {
            value: name,
          },
        },
      });
      log({ contaiLinkId });

      for (let i = 0; i < value.length; i++) {
        const element = value[i];
        this.insertAnyValue({
          value: element,
          parentLinkId: linkId,
          name: i.toString(),
        });
      }
    }

    insertPrimitiveValue(options: InsertPrimitiveValueOptions) {
      const { value } = options;
      if (typeof value === "string") {
        this.insertStringValue({
          ...options,
          value,
        });
      } else if (typeof value === "number") {
        this.insertNumberValue({
          ...options,
          value,
        });
      } else if (typeof value === "boolean") {
        this.insertBooleanValue({
          ...options,
          value,
        });
      }
    }

    insertObjectValue(options: InstakObjectValueOptions) {
      const log = ObjectToLinksConverter.getLogger(this.insertObjectValue.name);
      log({ options });
      const { value, name, parentLinkId } = options;

      const {
        data: [{ id: linkId }],
      } = deep.insert({
        type_id: deep.id(deep.linkId!, toPascalCase(typeof value)),
        from_id: parentLinkId,
        to_id: parentLinkId,
      });
      log({ linkId });

      const {
        data: [{ id: containLinkId }],
      } = deep.insert({
        type_id: deep.id("@deep-foundation/core", "Contain"),
        from_id: parentLinkId,
        to_id: linkId,
        string: {
          data: {
            value: name,
          },
        },
      });
      log({ containLinkId });

      for (const [propertyKey, propertyValue] of Object.entries(value)) {
        if (
          typeof propertyValue !== "string" &&
          typeof propertyValue !== "number" &&
          typeof propertyValue !== "boolean" &&
          !Array.isArray(propertyValue) &&
          typeof propertyValue !== "object"
        ) {
          log(
            `Skipping property ${propertyKey} because its type ${typeof value} is not supported`,
          );
          continue;
        }
        this.insertAnyValue({
          parentLinkId: linkId,
          value: propertyValue,
          name: propertyKey,
        });
      }
    }

    insertAnyValue(options: InsertAnyValueOptions) {
      const { value } = options;
      const log = ObjectToLinksConverter.getLogger(this.insertAnyValue.name);

      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        this.insertPrimitiveValue({
          ...options,
          value,
        });
      } else if (Array.isArray(value)) {
        this.insertArrayValue({
          ...options,
          value,
        });
      } else if (typeof value === "object") {
        this.insertObjectValue({
          ...options,
          value,
        });
      } else {
        throw new Error(`Type of value ${typeof value} is not supported`);
      }
    }
  }

  const packageLog = ObjectToLinksConverter.getLogger(
    "@deep-foundation/object-to-links-converter",
  );
  packageLog({ options });

  function getObjectToLinksConverterProxy(options: {
    target: ObjectToLinksConverter;
    customMethods?: Record<string, Function>;
  }): ObjectToLinksConverter {
    const { target, customMethods } = options;

    return new Proxy(target, {
      get: function (obj: ObjectToLinksConverter, prop: string | symbol) {
        if (customMethods && prop in customMethods) {
          // If the property is in the customMethods object, return that.
          return customMethods[prop as string];
        }

        // Otherwise, return the property from the original object.
        return obj[prop as keyof ObjectToLinksConverter];
      },
    }) as ObjectToLinksConverter;
  }

  try {
    const result = main();
    return JSON.stringify(
      {
        result,
        logs: logs,
      },
      jsonStringifyCircularReplacer,
    );
  } catch (error) {
    throw JSON.stringify(
      {
        error: error,
        logs: logs,
      },
      jsonStringifyCircularReplacer,
    );
  }

  function main() {
    const log = ObjectToLinksConverter.getLogger(main.name);

    if (Object.keys(obj).length === 0) {
      return;
    }

    const objectToLinksConverter = ObjectToLinksConverter.init({
      obj,
      rootLinkId,
      resultLinkId,
    });
    log({ objectToLinksConverter });

    const proxiedObjectToLinksConverter = getObjectToLinksConverterProxy({
      target: objectToLinksConverter,
      customMethods,
    });
    log({ proxiedObjectToLinksConverter });

    const convertResult = proxiedObjectToLinksConverter.convert();
    log({ convertResult });

    return convertResult;
  }

  function jsonStringifyCircularReplacer() {
    let seen = new WeakSet();
    let placeholder = {};
    return (key: any, value: any) => {
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) {
          return placeholder;
        }
        seen.add(value);
      }
      return value;
    };
  }

  function toPascalCase(input: string): string {
    const words = input.split(/[^a-zA-Z0-9]+/);

    const pascalCased = words
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join("");

    return pascalCased;
  }

  interface GetContainTreeLinksDownToLinkOptions {
    linkExp: BoolExpLink;
  }

  type CustomMethods = {
    convert: typeof ObjectToLinksConverter.prototype.convert;
    insertAnyValue: typeof ObjectToLinksConverter.prototype.insertAnyValue;
    updateAnyValue: typeof ObjectToLinksConverter.prototype.updateAnyValue;
    insertPrimitiveValue: typeof ObjectToLinksConverter.prototype.insertPrimitiveValue;
    insertArrayValue: typeof ObjectToLinksConverter.prototype.insertArrayValue;
    insertObjectValue: typeof ObjectToLinksConverter.prototype.insertObjectValue;
    insertStringValue: typeof ObjectToLinksConverter.prototype.insertStringValue;
    insertNumberValue: typeof ObjectToLinksConverter.prototype.insertNumberValue;
    insertBooleanValue: typeof ObjectToLinksConverter.prototype.insertBooleanValue;
    updateBooleanValue: typeof ObjectToLinksConverter.prototype.updateBooleanValue;
    updateStringValue: typeof ObjectToLinksConverter.prototype.updateStringValue;
    updateArrayValue: typeof ObjectToLinksConverter.prototype.updateArrayValue;
    updateObjectValue: typeof ObjectToLinksConverter.prototype.updateObjectValue;
    getContainTreeLinksDownToParent: typeof ObjectToLinksConverter.getContainTreeLinksDownToParent;
    init: typeof ObjectToLinksConverter.init;
  };

  interface ObjectToLinksConverterOptions {
    rootLink: Link<number>;
    obj: AllowedObject;
    customMethods?: CustomMethods;
    resultLink: Link<number>;
  }

  interface ObjectToLinksConverterInitOptions {
    obj: AllowedObject;
    rootLinkId?: number;
    customMethods?: CustomMethods;
    resultLinkId?: number;
  }

  type InsertStringValueOptions = InsertValueOptions<string>;

  type InsertNumberValueOptions = InsertValueOptions<number>;

  type InsertBooleanOptions = InsertValueOptions<boolean>;

  type InstakObjectValueOptions = InsertValueOptions<AllowedObject>;

  type InsertArrayValueOptions = InsertValueOptions<AllowedArray>;

  type InsertPrimitiveValueOptions = InsertValueOptions<AllowedPrimitive>;

  type InsertAnyValueOptions = Omit<
    InsertValueOptions<AllowedValue>,
    "typeLinkId"
  >;

  type InsertValueOptions<TValue extends AllowedValue> = {
    parentLinkId: number;
    value: TValue;
    name: string;
  };

  interface UpdateValueOptions<TValue extends AllowedValue> {
    link: Link<number>;
    value: TValue;
  }

  type UpdateAnyValueOptions<TValue extends AllowedValue> =
    UpdateValueOptions<TValue>;

  type UpdateObjectValueOptions = UpdateValueOptions<AllowedObject>;

  type UpdateStringValueOptions = UpdateValueOptions<string>;

  type UpdateArrayValueOptions = UpdateValueOptions<AllowedArray>;

  type UpdateBooleanValueOptions = UpdateValueOptions<boolean>;

  type UpdateNumberValueOptions = UpdateValueOptions<number>;
}

function getJsonStringifyCircularReplacer() {
  let seen = new WeakSet();
  let placeholder = {};
  return (key: any, value: any) => {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) {
        return placeholder;
      }
      seen.add(value);
    }
    return value;
  };
}

type SyncDeepClient = RemovePromiseFromMethodsReturnType<DeepClient>;

export type RemovePromiseFromMethodsReturnType<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => Promise<infer U>
    ? (...args: any[]) => U
    : T[K];
};

type AllowedPrimitive = string | number | boolean;

interface AllowedObject {
  [key: string]: AllowedValue;
}

type AllowedArray = Array<AllowedValue>;

type AllowedValue = AllowedPrimitive | AllowedObject | AllowedArray;
