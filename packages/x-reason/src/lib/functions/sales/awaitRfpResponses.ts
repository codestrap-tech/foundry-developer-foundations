import type {
  Context,
  MachineEvent,
  RfpResponsesResult,
} from '@codestrap/developer-foundations-types';

export async function awaitRfpResponses(
  context: Context,
  event?: MachineEvent,
  task?: string,
): Promise<RfpResponsesResult> {
  /*
    find all request rfp nodes.
    If all are marked as received allResponsesReceived = true
    */
  const allResponses = Object.keys(context)
    .filter((key) => key.indexOf('requestRfp') >= 0)
    .map((key) => context[key]);

  // all received if there had been a response and the status is 200
  const allResponsesReceived = allResponses.every(
    (item) => item.received && item.status === 200,
  );
  const vendors = allResponses.map((item) => item.vendorId);

  return {
    allResponsesReceived,
    vendors,
  };
}
