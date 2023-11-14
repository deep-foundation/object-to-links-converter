import { packageLog } from "./packageLog.js";
import { DeepClientInstance } from "@deep-foundation/deeplinks/imports/client.js";
import { ObjectToLinksConverterDecorator } from "./create-object-to-links-converter-decorator.js";
import { callClientHandler } from "./call-client-handler.js";
import { Obj } from "./obj.js";

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
  obj: Obj;
}
