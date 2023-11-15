import { generateApolloClient } from "@deep-foundation/hasura/client.js";
import { ApolloClient, InMemoryCache } from "@apollo/client/index.js";
import assert from "assert";
import {
  DeepClient,
  DeepClientOptions,
  SerialOperation,
} from "@deep-foundation/deeplinks/imports/client.js";
import {
  createObjectToLinksConverterDecorator,
  ObjectToLinksConverterDecorator,
} from "../create-object-to-links-converter-decorator.js";
import { packageLog } from "../packageLog.js";
import { PACKAGE_NAME } from "../package-name.js";
import dotenv from "dotenv";
import {
  AllowedArray,
  AllowedObject,
  AllowedValue,
} from "../allowed-values.js";
import { pascalCase } from "case-anything";
import { Link } from "@deep-foundation/deeplinks/imports/minilinks.js";
import { createSerialOperation } from "@deep-foundation/deeplinks/imports/gql/serial.js";
import { BoolExpLink } from "@deep-foundation/deeplinks/imports/client_types.js";
import { RemovePromiseFromMethodsReturnType } from "../RemovePromiseFromMethodsReturnType.js";
dotenv.config({
  path: "./.env.test.local",
});

const molduleLog = packageLog.extend("test");

export const REQUIRED_PROCESS_ENVS = {
  graphqlPath: "GRAPHQL_PATH",
  ssl: "SSL",
  token: "TOKEN",
};

const graphqlUrl = new URL(process.env[REQUIRED_PROCESS_ENVS.graphqlPath]!);
const graphQlPath =
  graphqlUrl.host + graphqlUrl.pathname + graphqlUrl.search + graphqlUrl.hash;
const ssl = process.env[REQUIRED_PROCESS_ENVS.ssl]! === "true";
const token = process.env[REQUIRED_PROCESS_ENVS.token]!;

let apolloClient: ApolloClient<InMemoryCache>;
let decoratedDeep: ObjectToLinksConverterDecorator<DeepClient>;

const REQUIRED_PACKAGES_IN_MINILINKS = ["@deep-foundation/core", PACKAGE_NAME];

apolloClient = generateApolloClient({
  path: graphQlPath,
  ssl,
  token,
  ws: true,
});
const deep = new DeepClient({ apolloClient });
decoratedDeep = createObjectToLinksConverterDecorator(deep);
await decoratedDeep.applyRequiredPackagesInMinilinks();

const { data: requiredPackageLinks } = await deep.select({
  up: {
    tree_id: {
      _id: ["@deep-foundation/core", "containTree"],
    },
    parent: {
      _or: REQUIRED_PACKAGES_IN_MINILINKS.map((packageName) => ({
        id: {
          _id: [packageName],
        },
      })),
    },
  },
});
decoratedDeep.minilinks.apply(requiredPackageLinks);
// console.log(decoratedDeep.minilinks.links.find(link => link.value?.value === 'clientHandler'))
await test();

async function test() {
  await parseItTests();
}

async function parseItTests() {
  await stringPropertyTest();
  await numberPropertyTest();
  await booleanPropertyTest();
  await arrayPropertyTest();
  await objectPropertyWithStringPropertyTest();
  await objectPropertyWithArrayOfStringsPropertyTest();
  await objectPropertyWithArrayOfArraysOfStringsPropertyTest();
  await objectPropertyWithArrayOfObjectsPropertyTest();
  await objectPropertyWithObjectPropertyTest();
  await objectPropertyWithObjectPropertyWithArrayPropertyTest();
  await treeTest();
  await objectPropertyTest();
  await differentResultLinkResultTest();
}

async function genericTest(options: {
  /**
   * Object value to test
   */
  obj: AllowedObject;
  /**
   * Custom result link id. If not provided, root link will be used as result link
   */
  resultLinkId?: number;
}) {
  const { obj, resultLinkId } = options;
  const {
    data: [rootLink],
  } = await deep.insert(
    {
      type_id: deep.idLocal(
        "@deep-foundation/object-to-links-converter",
        "Root",
      ),
      object: {
        data: {
          value: obj,
        },
      },
    },
    {
      returning: deep.linksSelectReturning,
    },
  );
  const resultLink = resultLinkId
    ? await deep.select(resultLinkId).then((result) => result.data[0])
    : rootLink;
  const {
    data: [parseItLink],
  } = await deep.insert(
    {
      type_id: deep.idLocal(
        "@deep-foundation/object-to-links-converter",
        "ParseIt",
      ),
      from_id: rootLink.id,
      to_id: resultLink.id,
    },
    {
      returning: deep.linksSelectReturning,
    },
  );

  await deep.await(parseItLink.id);

  for (const [propertyKey, propertyValue] of Object.entries(obj)) {
    await checkProperty({
      parentLink: resultLink as Link<number>,
      name: propertyKey,
      value: propertyValue,
    });
  }
}

async function simpleGenericTest(option: {
  /**
   * Type of property to test
   */
  typeOfProperty: "string" | "number" | "boolean" | "object" | "array";
  /**
   * Determines whether to use root link as result link or to create a new link
   */
  createDifferentResultLinkId?: number;
}) {
  const { typeOfProperty } = option;
  const propertyValue =
    typeOfProperty === "string"
      ? "myStringValue"
      : typeOfProperty === "number"
      ? 123
      : typeOfProperty === "boolean"
      ? true
      : typeOfProperty === "object"
      ? { myStringKey: "myStringValue" }
      : ["myStringValue", "myStringValue"];
  const obj = {
    myProperty: propertyValue,
  };
  const resultLinkId = option.createDifferentResultLinkId;
  await genericTest({
    obj,
  });
}

async function stringPropertyTest() {
  await simpleGenericTest({
    typeOfProperty: "string",
  })
}

async function differentResultLinkResultTest() {
  const propertyKey = "myStringKey";
  const propertyValue = "myStringValue";
  const obj = {
    [propertyKey]: propertyValue,
  };
  await genericTest({
    obj,
  });
}

async function objectPropertyTest() {
  await simpleGenericTest({
    typeOfProperty: "object",
  })
}

async function treeTest() {
  const {
    data: [{ id: rootLinkId }],
  } = await deep.insert({
    type_id: await deep.id("@deep-foundation/core", "Type"),
  });
  const propertyKey = "myObjectKey";
  const propertyValue = {
    myObjectKey: {
      myStringKey: "myStringValue",
    },
  };
  const obj = {
    [propertyKey]: propertyValue,
  };
  await genericTest({
    obj: obj,
  });
  const { data: containTreeLinkDownToRoot } = await deep.select({
    up: {
      tree_id: {
        _id: ["@deep-foundation/core", "containTree"],
      },
      parent_id: rootLinkId,
    },
  });
  assert.notStrictEqual(containTreeLinkDownToRoot, undefined);
  assert.equal(
    containTreeLinkDownToRoot.length,
    1 + // root link
      1 + // object link
      1 + // contain for object link
      1 + // object link
      1 + // contain for object link
      1 + // string link
      1, // contain for string link
  );
}


async function numberPropertyTest() {
  await simpleGenericTest({
    typeOfProperty: "number",
  })
}

async function booleanPropertyTest() {
  await simpleGenericTest({
    typeOfProperty: "boolean",
  })
}

async function arrayPropertyTest() {
  await simpleGenericTest({
    typeOfProperty: "array",
  })
}

async function objectPropertyWithStringPropertyTest() {
  const propertyKey = "myObjectKey";
  const propertyValue = {
    myStringKey: "myStringValue",
  };
  const obj = {
    [propertyKey]: propertyValue,
  }
  await genericTest({
    obj
  });
}

async function objectPropertyWithArrayOfStringsPropertyTest() {
  const propertyKey = "myObjectKey";
  const propertyValue = {
    myArrayKey: ["myString1", "myString2"],
  };
  const obj = {
    [propertyKey]: propertyValue,
  }
  await genericTest({
    obj
  });
}

async function objectPropertyWithArrayOfArraysOfStringsPropertyTest() {
  const propertyKey = "myObjectKey";
  const propertyValue = {
    myArrayKey: [
      ["myString1", "myString2"],
      ["myString1", "myString2"],
    ],
  };
  const obj = {
    [propertyKey]: propertyValue,
  }
  await genericTest({
    obj
  });
}

async function objectPropertyWithArrayOfObjectsPropertyTest() {
  const propertyKey = "myObjectKey";
  const propertyValue = {
    myArrayKey: [
      {
        myStringKey: "myStringValue",
      },
      {
        myStringKey: "myStringValue",
      },
    ],
  };
  const obj = {
    [propertyKey]: propertyValue,
  }
  await genericTest({
    obj
  });
}

async function objectPropertyWithObjectPropertyTest() {
  const propertyKey = "myObjectKey";
  const propertyValue = {
    myObjectKey: {
      myStringKey: "myStringValue",
    },
  };
  const obj = {
    [propertyKey]: propertyValue,
  }
  await genericTest({
    obj
  });
}

async function objectPropertyWithObjectPropertyWithArrayPropertyTest() {
  const propertyKey = "myObjectKey";
  const propertyValue = {
    myObjectKey: {
      myStringKey: ["myStringValue", "myStringValue"],
    },
  };
  const obj = {
    [propertyKey]: propertyValue,
  }
  await genericTest({
    obj
  });
}

async function checkStringOrNumberProperty(
  options: CheckStringOrNumberPropertyOptions,
) {
  const { value, parentLink, name } = options;

  const {
    data: [link],
  } = await deep.select({
    id: {
      _id: [parentLink.id, name],
    },
  });
  if (!link) {
    throw new Error(`Failed to find property`);
  }
  assert.equal(link.from_id, parentLink.id);
  assert.equal(link.to_id, parentLink.id);
  assert.equal(link.value?.value, value);
}

async function checkBooleanProperty(options: CheckBooleanPropertyOptions) {
  const { value, parentLink, name } = options;

  const {
    data: [link],
  } = await deep.select({
    id: {
      _id: [parentLink.id, name],
    },
  });
  if (!link) {
    throw new Error(`Failed to find property`);
  }
  assert.equal(link.from_id, parentLink.id);

  assert.equal(
    link.to_id,
    await deep.id("@deep-foundation/boolean", value.toString()),
  );
}

async function checkStringProperty(options: CheckStringPropertyOptions) {
  await checkStringOrNumberProperty(options);
}

async function checkNumberProperty(options: CheckNumberPropertyOptions) {
  await checkStringOrNumberProperty(options);
}

async function checkObjectProperty(options: CheckObjectPropertyOptions) {
  const { value, parentLink, name } = options;

  const {
    data: [objectLink],
  } = await deep.select({
    id: {
      _id: [parentLink.id, name],
    },
  });
  if (!objectLink) {
    throw new Error(`Failed to find property`);
  }

  assert.equal(objectLink.from_id, parentLink.id);
  assert.equal(objectLink.to_id, parentLink.id);

  for (const [propertyKey, propertyValue] of Object.entries(value)) {
    await checkProperty({
      parentLink: objectLink,
      value: propertyValue,
      name: propertyKey,
    });
  }
}

async function checkArrayProperty(options: CheckArrayPropertyOptions) {
  const { value, parentLink, name } = options;

  const {
    data: [arrayLink],
  } = await deep.select({
    id: {
      _id: [parentLink.id, name],
    },
  });
  for (let i = 0; i < value.length; i++) {
    const element = value[i];
    const {
      data: [elementLink],
    } = await deep.select({
      id: {
        _id: [arrayLink.id, i.toString()],
      },
    });
    if (!elementLink) {
      throw new Error(`Failed to find element`);
    }
    await checkProperty({
      parentLink: arrayLink,
      name: i.toString(),
      value: element,
    });
  }
}

async function checkProperty(options: CheckAnyPropertyOptions) {
  const { value } = options;

  if (typeof value === "string" || typeof value === "number") {
    await checkStringOrNumberProperty({
      ...options,
      value,
    });
  } else if (typeof value === "boolean") {
    await checkBooleanProperty({
      ...options,
      value,
    });
  } else if (Array.isArray(value)) {
    await checkArrayProperty({
      ...options,
      value,
    });
  } else if (typeof value === "object") {
    await checkObjectProperty({
      ...options,
      value,
    });
  }
}

type CheckPropetyOptions<TValue extends AllowedValue> = {
  value: TValue;
  parentLink: Link<number>;
  name: string;
};

type CheckAnyPropertyOptions = CheckPropetyOptions<AllowedValue>;
type CheckStringOrNumberPropertyOptions = CheckPropetyOptions<string | number>;
type CheckStringPropertyOptions = CheckPropetyOptions<string>;
type CheckNumberPropertyOptions = CheckPropetyOptions<number>;
type CheckBooleanPropertyOptions = CheckPropetyOptions<boolean>;
type CheckObjectPropertyOptions = CheckPropetyOptions<AllowedObject>;
type CheckArrayPropertyOptions = CheckPropetyOptions<AllowedArray>;

// async function customMethodMakeInsertoperationsForBooleanValue() {
//   const propertyKey = "myStringKey";
//   const propertyValue = true;
//   const {
//     data: [{ id: rootLinkId }],
//   } = await deep.insert({
//     type_id: await deep.id("@deep-foundation/core", "Type"),
//   });
//   await parseItInsertHandlerTests({
//     propertyKey,
//     propertyValue,
//     rootLinkId,
//     customMethods: {
//       makeInsertOperationsForBooleanValue,
//     },
//   });
//   const {
//     data: [propertyLink],
//   } = await deep.select({
//     id: {
//       _id: [rootLinkId, propertyKey],
//     },
//   });
//   assert.equal(propertyLink.value?.value, propertyValue.toString());

//   async function makeInsertOperationsForBooleanValue(
//     this: any,
//     options: {
//       parentLinkId: number;
//       linkId: number;
//       value: boolean;
//       name: string;
//     },
//   ) {
//     const operations: Array<SerialOperation> = [];
//     const { value, parentLinkId, linkId, name } = options;
//     const log = molduleLog.extend(makeInsertOperationsForBooleanValue.name);
//     log({ options });

//     log({ this: this });
//     const linkInsertSerialOperation = createSerialOperation({
//       type: "insert",
//       table: "links",
//       objects: {
//         id: linkId,
//         type_id: await deep.id(this.deep.linkId!, pascalCase(typeof value)),
//         from_id: parentLinkId,
//         to_id: await deep.id("@deep-foundation/boolean", value.toString()),
//       },
//     });
//     operations.push(linkInsertSerialOperation);
//     log({ linkInsertSerialOperation });

//     const stringInsertSerialOperation = createSerialOperation({
//       type: "insert",
//       table: "strings",
//       objects: {
//         link_id: linkId,
//         value: value.toString(),
//       },
//     });
//     operations.push(stringInsertSerialOperation);
//     log({ stringInsertSerialOperation });

//     const containInsertSerialOperation = createSerialOperation({
//       type: "insert",
//       table: "links",
//       objects: {
//         // TODO: Replace id with idLocal when it work properly
//         type_id: await deep.id("@deep-foundation/core", "Contain"),
//         from_id: parentLinkId,
//         to_id: linkId,
//         string: {
//           data: {
//             value: name,
//           },
//         },
//       },
//     });
//     operations.push(containInsertSerialOperation);
//     log({ containInsertSerialOperation });

//     log({ operations });

//     return operations;
//   }
// }

// async function customRootLinkTest() {
//   const propertyKey = "myStringKey";
//   const propertyValue = "myStringValue";
//   const {
//     data: [{ id: rootLinkId }],
//   } = await deep.insert({
//     type_id: await deep.id("@deep-foundation/core", "Type"),
//   });
//   await parseItInsertHandlerTests({
//     propertyKey,
//     propertyValue,
//     rootLinkId,
//   });
// }
