import { DeepClientInstance } from "@deep-foundation/deeplinks/imports/client";
import { Link } from "@deep-foundation/deeplinks/imports/minilinks";
import { RemovePromiseFromMethodsReturnType } from "./RemovePromiseFromMethodsReturnType";

export function callClientHandler(
  options: CallClientHandlerOptions,
): any {
  const { linkId, deep, args } = options;
  const { data: selectData } = deep.select({
    in: {
      id: linkId,
    },
  });

  const link = selectData[0] as Link<number>;
  if (!link) throw new Error(`Unable to find SyncTextFile for ##${linkId}`);

  const functionExpressionString = link.value?.value;
  if (!functionExpressionString) throw new Error(`##${link.id} must have value`);

  const fn: Function = eval(functionExpressionString);

  const result = fn(...args);
  return result;
}

export interface CallClientHandlerOptions {
  deep: RemovePromiseFromMethodsReturnType<DeepClientInstance>;
  linkId: number;
  args: Array<any>;
}
