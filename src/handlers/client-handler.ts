import {
  DeepClient,
  DeepClientResult,
  Table,
} from "@deep-foundation/deeplinks/imports/client.js";
import { BoolExpLink } from "@deep-foundation/deeplinks/imports/client_types.js";
import { Link } from "@deep-foundation/deeplinks/imports/minilinks";



(options: {
  deep: SyncDeepClient;
  rootLinkId?: number;
  obj: Obj;
  customMethods?: Record<string, Function>;
  resultLinkId?: number;
}) => {
  const { deep, rootLinkId, obj, customMethods, resultLinkId } = options;
  const logs: Array<any> = [];

  class ObjectToLinksConverter {
    rootLink: Link<number>;
    obj: Obj;
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
      const logger = (value: any) =>  {
        logs.push({ namespace, value });
      } 
        logger.namespace = namespace
        logger.extend =  function(namespace: string) {
          return ObjectToLinksConverter.getLogger(`${logger.namespace}${namespace}`);
        }
        return logger
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
      const { obj } = options;
      const rootLink: Link<number> = options.rootLinkId
        ? deep.select(options.rootLinkId).data[0] as Link<number>
        : deep
            .insert(
              {
                  type_id: deep.id(deep.linkId!, "Root"),
              },
              {
                returning: deep.linksSelectReturning,
              },
            ).data[0] as Link<number>
      log({ rootLink });
      const resultLink = options.resultLinkId
        ? deep
            .select(options.resultLinkId).data[0] as Link<number>
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

      console.time(
        `${ObjectToLinksConverter.name} updateObjectValue before`,
      );
      const operations = this.updateObjectValue({
        link: this.resultLink,
        value: this.obj,
      });
      console.time(
        `${ObjectToLinksConverter.name} updateObjectValue before`,
      );
      log({ operations });

      const hasResultTypeLinkId = deep.id(deep.linkId!, "HasResult");
      const {
        data: [hasResultLink],
      } = deep.select({
        type_id: hasResultTypeLinkId,
        from_id: this.rootLink.id,
      });
      if (hasResultLink) {
        operations.push(
          ({
            type: "update",
            table: "links",
            exp: {
              type_id: hasResultTypeLinkId,
              from_id: this.rootLink.id,
            },
            value: {
              to_id: this.resultLink.id,
            },
          }),
        );
      } else {
        operations.push(
          ({
            type: "insert",
            table: "links",
            objects: {
              type_id: hasResultTypeLinkId,
              from_id: this.rootLink.id,
              to_id: this.resultLink.id,
            },
          }),
        );
      }

      console.time(`${ObjectToLinksConverter.name} serial before`);
      const serialResult = deep.serial({
        operations,
      });
      console.time(`${ObjectToLinksConverter.name} serial after`);
      log({ serialResult });

      return {
        serialResult,
        rootLinkId: this.rootLink.id,
        resultLinkId: this.resultLink.id,
      };
    }

    updateBooleanValue(
      options: UpdateBooleanValueOptions,
    ) {
      const log = ObjectToLinksConverter.getLogger(
        this.updateBooleanValue.name,
      );
      log({ options });
      const { link, value } = options;
      deep.update({
        id: link.id,
      }, {
        to_id: deep.id(
          ObjectToLinksConverter.requiredPackageNames.boolean,
          value.toString(),
        ),
      }, {
        table: "links"
      })
    }

    updateStringValue(
      options: UpdateStringValueOptions,
    ) {
      const log = ObjectToLinksConverter.getLogger(
        this.updateStringValue.name,
      );
      log({ options });
      const { link, value } = options;
      deep.update({
        link_id: link.id,
      }, {
        value: value,
      }, {
        table: "strings"
      })
      
    }

    updateNumberValue(
      options: UpdateNumberValueOptions,
    ) {
      const log = ObjectToLinksConverter.getLogger(
        this.updateNumberValue.name,
      );
      log({ options });
      const { link, value } = options;
      deep.update({
        link_id: link.id,
      }, {
        value: value,
      }, {
        table: "numbers"
      })
      
    }

    updateArrayValue<TValue extends AllowedArray>(
      options: UpdateAnyValueOptions<TValue>,
    ) {
      const log = ObjectToLinksConverter.getLogger(
        this.updateAnyValue.name,
      );
      const { link, value } = options;
      const operations: Array<SerialOperation> = [];

      deep.delete({
        up: {
          tree_id: deep.id(
            "@deep-foundation/core",
            "ContainTree",
          ),
          parent_id: link.id,
        },
      });

      for (let i = 0; i < value.length; i++) {
        const element = value[i];
        operations.push(
          ...(this.insertAnyValue({
            value: element,
            name: i.toString(0),
            parentLinkId: link.id,
          })),
        );
      }

      return operations;
    }

    updateAnyValue<TValue extends AllowedValue>(
      options: UpdateAnyValueOptions<TValue>,
    ) {
      const log = ObjectToLinksConverter.getLogger(
        this.updateAnyValue.name,
      );
      const { link, value } = options;
      const operations: Array<SerialOperation> = [];
      if (typeof value === "boolean") {
        operations.push(
          ...(this.updateBooleanValue({
            ...options,
            value,
          })),
        );
      } else if (typeof value === "string") {
        operations.push(
          ...(this.updateStringValue({
            ...options,
            value,
          })),
        );
      } else if (typeof value === "number") {
        operations.push(
          ...(this.updateNumberValue({
            ...options,
            value,
          })),
        );
      } else if (Array.isArray(value)) {
        operations.push(
          ...(this.updateArrayValue({
            ...options,
            value,
          })),
        );
      } else if (typeof value === "object") {
        operations.push(
          ...(this.updateObjectValue({
            ...options,
            value,
          })),
        );
      } else {
        throw new Error(`Type of value ${typeof value} is not supported`);
      }

      return operations;
    }

    updateObjectValue(
      options: UpdateObjectValueOptions,
    ) {
      const log = ObjectToLinksConverter.getLogger(
        this.updateObjectValue.name,
      );
      const { link, value } = options;
      log({ options });
      const operations: Array<SerialOperation> = [];

      for (const [propertyKey, propertyValue] of Object.entries(value)) {
        log({ propertyKey, propertyValue });
        const {data: [propertyLink]} = deep.select({
          id: {
            _id: [link.id, propertyKey],
          },
        });
        log({ propertyLink });
        if (propertyLink) {
          let propertyUpdateOperations: Array<SerialOperation> = [];
          propertyUpdateOperations = this.updateAnyValue(
            {
              link: propertyLink,
              value: propertyValue,
            },
          );
          log({ propertyUpdateOperations });
          operations.push(...propertyUpdateOperations);
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

          const propertyInsertOperations =
            this.insertAnyValue({
              parentLinkId: link.id,
              value: propertyValue,
              name: propertyKey,
            });
          log({ propertyInsertOperations });
          operations.push(...propertyInsertOperations);
        }

        log({ operations });
      }

      return operations;
    }

    insertBooleanValue(
      options: InsertBooleanOptions,
    ) {
      const operations: Array<SerialOperation> = [];
      const { value, parentLinkId, name } = options;
      const log = ObjectToLinksConverter.getLogger(
        this.insertBooleanValue.name,
      );

      const {data: [{id: linkId}]} = deep.insert({
        type_id: deep.id(deep.linkId!, toPascalCase(typeof value)),
        from_id: parentLinkId,
        to_id: deep.id(
          ObjectToLinksConverter.requiredPackageNames.boolean,
          value.toString(),
        ),
      })
      
      log({ linkId });

      const {data: [{id: containLinkId}]} = deep.insert({
        type_id: deep.id("@deep-foundation/core", "Contain"),
        from_id: parentLinkId,
        to_id: linkId,
        string: {
          data: {
            value: name,
          },
        },
      })
      log({ containLinkId });

      log({ operations });
      return operations;
    }
    insertStringValue(
      options: InsertStringValueOptions,
    ) {
      const { value, parentLinkId,  name } = options;
      const log = ObjectToLinksConverter.getLogger(
        "makeInsertOperationsForStringValue",
      );

      const {data: [{id: linkId}]} = deep.insert({
        from_id: parentLinkId,
        to_id: parentLinkId,
        type_id: deep.id(deep.linkId!, toPascalCase(typeof value)),
        string:{
          data: {
            value: value
          }
        }
      })
      log({ linkId });

      const {data: [{id: containLinkId}]} = deep.insert({
        type_id: deep.id("@deep-foundation/core", "Contain"),
        from_id: parentLinkId,
        to_id: linkId,
        string: {
          data: {
            value: name,
          },
        },
      })
      log({ containLinkId });
    }

    insertNumberValue(
      options: InsertNumberValueOptions,
    ) {
      const { value, parentLinkId, name } = options;
      const log = ObjectToLinksConverter.getLogger(
        "makeInsertOperationsForStringValue",
      );

      const {data: [{id: linkId}]} = deep.insert({
        from_id: parentLinkId,
        to_id: parentLinkId,
        type_id: deep.id(deep.linkId!, toPascalCase(typeof value)),
        number: {
          data: {
            value: value
          }
        }
      })
      log({ linkId });

      const {data: [{id: containLinkId}]} = deep.insert({
        type_id: deep.id("@deep-foundation/core", "Contain"),
        from_id: parentLinkId,
        to_id: linkId,
        string: {
          data: {
            value: name,
          },
        },
      })
      
      log({ linkId });
    }

    insertArrayValue(
      options: InsertArrayValueOptions,
    ) {
      const { value, name, parentLinkId } = options;
      const log = ObjectToLinksConverter.getLogger(
        "makeInsertOperationsForStringValue",
      );

      const {data: [{id: linkId}]} = deep.insert({
        type_id: deep.id(deep.linkId!, toPascalCase(typeof value)),
        from_id: parentLinkId,
        to_id: parentLinkId,
      },
    )
    log({linkId})

    const {data: [{id: contaiLinkId}]} = deep.insert({
      type_id: deep.id("@deep-foundation/core", "Contain"),
      from_id: parentLinkId,
      to_id: linkId,
      string: {
        data: {
          value: name,
        },
      },
    })
      log({ contaiLinkId });

      for (let i = 0; i < value.length; i++) {
        const element = value[i];
        operations.push(
          ...(this.insertAnyValue({
            value: element,
            parentLinkId: linkId,
            name: i.toString(),
          })),
        );
      }
    }

    insertPrimitiveValue(
      options: InsertPrimitiveValueOptions,
    ) {
      const operations: Array<SerialOperation> = [];
      const { value } = options;
      if (typeof value === "string") {
        operations.push(
          ...(this.insertStringValue({
            ...options,
            value,
          })),
        );
      } else if (typeof value === "number") {
        operations.push(
          ...(this.insertNumberValue({
            ...options,
            value,
          })),
        );
      } else if (typeof value === "boolean") {
        operations.push(
          ...(this.insertBooleanValue({
            ...options,
            value,
          })),
        );
      }
      return operations;
    }

    insertObjectValue(
      options: InstakObjectValueOptions,
    ) {
      const operations: Array<SerialOperation> = [];
      const { value, name, parentLinkId } = options;
      const log = ObjectToLinksConverter.getLogger(
        this.insertObjectValue.name,
      );

      const {data: [{id: linkId}]} = deep.insert({
        type_id: deep.id(deep.linkId!, toPascalCase(typeof value)),
        from_id: parentLinkId,
        to_id: parentLinkId,
      })
      log({ linkId });

      const {data: [{id: containLinkId}]} = deep.insert({
        type_id: deep.id("@deep-foundation/core", "Contain"),
        from_id: parentLinkId,
        to_id: linkId,
        string: {
          data: {
            value: name,
          },
        },
      })

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
        const propertyInsertOperations =
          this.insertAnyValue({
            parentLinkId: linkId,
            value: propertyValue,
            name: propertyKey,
          });
        operations.push(...propertyInsertOperations);
      }

      return operations;
    }

    insertAnyValue(
      options: InsertAnyValueOptions,
    ) {
      const operations: Array<SerialOperation> = [];
      const { value } = options;
      const log = ObjectToLinksConverter.getLogger(
        this.insertAnyValue.name,
      );

      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        operations.push(
          ...(this.insertPrimitiveValue({
            ...options,
            value,
          })),
        );
      } else if (Array.isArray(value)) {
        operations.push(
          ...(this.insertArrayValue({
            ...options,
            value,
          })),
        );
      } else if (typeof value === "object") {
        operations.push(
          ...(this.insertObjectValue({
            ...options,
            value,
          })),
        );
      } else {
        throw new Error(`Type of value ${typeof value} is not supported`);
      }

      log({ operations });
      return operations;
    }
  }

  const packageLog = ObjectToLinksConverter.getLogger("@deep-foundation/object-to-links-converter");
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
    return JSON.stringify({
      result,
      logs: logs,
    });
  } catch (error) {
    throw JSON.stringify({
      error: error,
      logs: logs,
    });
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

  function toPascalCase(input: string): string {
    const words = input.split(/[^a-zA-Z0-9]+/);
  
    const pascalCased = words
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
  
    return pascalCased;
  }


  interface GetContainTreeLinksDownToLinkOptions {
    linkExp: BoolExpLink;
  }

  type CustomMethods = {
    convert: typeof ObjectToLinksConverter.prototype.convert;
    makeInsertOperationsForAnyValue: typeof ObjectToLinksConverter.prototype.insertAnyValue;
    updateAnyValue: typeof ObjectToLinksConverter.prototype.updateAnyValue;
    makeInsertOperationsForPrimitiveValue: typeof ObjectToLinksConverter.prototype.insertPrimitiveValue;
    makeInsertOperationsForArrayValue: typeof ObjectToLinksConverter.prototype.insertArrayValue;
    makeInsertOperationsForObjectValue: typeof ObjectToLinksConverter.prototype.insertObjectValue;
    makeInsertOperationsForStringValue: typeof ObjectToLinksConverter.prototype.insertStringValue;
    makeInsertOperationsForNumberValue: typeof ObjectToLinksConverter.prototype.insertNumberValue;
    makeInsertOperationsForBooleanValue: typeof ObjectToLinksConverter.prototype.insertBooleanValue;
    updateBooleanValue: typeof ObjectToLinksConverter.prototype.updateBooleanValue;
    updateStringOrNumberValue: typeof ObjectToLinksConverter.prototype.updateStringValue;
    updateArrayValue: typeof ObjectToLinksConverter.prototype.updateArrayValue;
    updateObjectValue: typeof ObjectToLinksConverter.prototype.updateObjectValue;
    getContainTreeLinksDownToParent: typeof ObjectToLinksConverter.getContainTreeLinksDownToParent;
    init: typeof ObjectToLinksConverter.init;
  };

  interface ObjectToLinksConverterOptions {
    rootLink: Link<number>;
    obj: Obj;
    customMethods?: CustomMethods;
    resultLink: Link<number>;
  }

  interface ObjectToLinksConverterInitOptions {
    obj: Obj;
    rootLinkId?: number;
    customMethods?: CustomMethods;
    resultLinkId?: number;
  }

  type AllowedPrimitive = string | number | boolean;

  interface AllowedObject {
    [key: string]: AllowedValue;
  }

  type AllowedArray = Array<AllowedValue>;

  type AllowedValue = AllowedPrimitive | AllowedObject | AllowedArray;

  type InsertStringValueOptions =
    InsertValueOptions<string>;

  type InsertNumberValueOptions =
    InsertValueOptions<number>;

  type InsertBooleanOptions =
    InsertValueOptions<boolean>;

  type InstakObjectValueOptions =
    InsertValueOptions<AllowedObject>;

  type InsertArrayValueOptions =
    InsertValueOptions<AllowedArray>;

  type InsertPrimitiveValueOptions =
    InsertValueOptions<AllowedPrimitive>;

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

  type UpdateObjectValueOptions =
    UpdateValueOptions<AllowedObject>;

  type UpdateStringValueOptions =
    UpdateValueOptions<string>;

  type UpdateArrayValueOptions =
    UpdateValueOptions<AllowedArray>;

  type UpdateBooleanValueOptions =
    UpdateValueOptions<boolean>;

  type UpdateNumberValueOptions =
    UpdateValueOptions<number>;
};

interface Obj {
  [key: string]: string | number | Obj | boolean;
}

type RemovePromiseFromMethodsReturnType<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => Promise<infer U> ? (...args: any[]) => U : T[K];
};

type SyncDeepClient = RemovePromiseFromMethodsReturnType<DeepClient>