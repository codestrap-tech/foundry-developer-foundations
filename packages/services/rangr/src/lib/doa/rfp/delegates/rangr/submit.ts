import type {
  RangrClient,
  RfpRequestResponse,
} from '@codestrap/developer-foundations-types';
import { uuidv4 } from '@codestrap/developer-foundations-utils';

export async function submitRangrRfp(
  rfp: string,
  machineExecutionId: string,
  client: RangrClient,
): Promise<RfpRequestResponse> {
  console.log(`upsertRfpRequest machineExecutionId: ${machineExecutionId}`);

  const apiKey = await client.getToken();

  const url = `${client.url}/api/v2/ontologies/${client.ontologyRid}/actions/submit-rfp-request/apply`;

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  const body = JSON.stringify({
    parameters: {
      message: rfp,
      machineExecutionId,
    },
    options: {
      returnEdits: 'ALL',
    },
  });

  const apiResult = await fetch(url, {
    method: 'POST',
    headers: headers,
    body: body,
  });

  const result = (await apiResult.json()) as any;

  // TODO implement error handling based on RANG spec
  // if (!result.edits || result.edits.edits.length === 0) {
  // throw new Error('Failed to submit RfpRequest to the ontology.');
  // }

  const message = JSON.stringify(result);

  return {
    // TODO replace with status and message from service
    status: 200,
    message,
    // TODO figure out a better way to manage vendorName and ID
    vendorName: 'RANGR',
    vendorId: 'rangrdata.com',
    received: false,
    // TODO add executionId to context
    machineExecutionId,
    // TODO replace with reciept from service
    receipt: {
      id: uuidv4(),
      timestamp: new Date(),
    },
  };
}
