import { packageLog } from "./packageLog.js";
import { DeepClientInstance } from "@deep-foundation/deeplinks/imports/client.js";
import { ObjectToLinksConverterDecorator } from "./create-object-to-links-converter-decorator.js";
import { AllowedObject } from "./allowed-values.js";

export async function convert<TDeepClient extends DeepClientInstance>(
  this: ObjectToLinksConverterDecorator<TDeepClient>,
  options: ConvertOptions,
) {
  const log = packageLog(convert.name);
  const { rootLinkId, obj } = options;
  // TODO:
 throw new Error("Not implemented");
}

export interface ConvertOptions {
  rootLinkId: number;
  obj: AllowedObject;
}
