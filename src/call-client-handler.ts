import { DeepClientInstance } from "@deep-foundation/deeplinks/imports/client";
import { Link } from "@deep-foundation/deeplinks/imports/minilinks";
import { RemovePromiseFromMethodsReturnType } from "./RemovePromiseFromMethodsReturnType";
import { packageLog } from "./packageLog";

export async function callClientHandler(
  options: CallClientHandlerOptions,
): Promise<any> {
  const log = packageLog.extend(callClientHandler.name)
  const { linkId, deep, args } = options;
  const { data: selectData } = await deep.select({
    in: {
      id: linkId,
    },
  });

  const link = selectData[0];
  if (!link) throw new Error(`Unable to find SyncTextFile for ##${linkId}`);

  const functionExpressionString = link.value?.value;
  if (!functionExpressionString) throw new Error(`##${link.id} must have value`);
  log({ functionExpressionString })

  const fn: Function = eval(functionExpressionString);

  const result = fn(...args);
  return result;
}

export interface CallClientHandlerOptions {
  deep: DeepClientInstance;
  linkId: number;
  args: Array<any>;
}
