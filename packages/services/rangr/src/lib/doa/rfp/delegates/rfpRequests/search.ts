import type {
  RangrClient,
  RfpRequests,
} from '@codestrap/developer-foundations-types';

export async function searchRfpRequest(
  machineExecutionId: string,
  vendorId: string,
  client: RangrClient
): Promise<RfpRequests[]> {
  console.log(
    `searchRfpRequest machineExecutionId: ${machineExecutionId} vendorId: ${vendorId}`
  );

  const apiKey = await client.getToken();

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  const url = `${client.url}/api/v2/ontologies/${client.ontologyRid}/objects/RfpRequests/search`;

  const body = JSON.stringify({
    where: {
      type: 'and',
      value: [
        {
          type: 'eq',
          field: 'machineExecutionId',
          value: machineExecutionId,
        },
        {
          type: 'eq',
          field: 'vendorId',
          value: vendorId,
        },
      ],
    },
  });

  const apiResult = await fetch(url, {
    method: 'POST',
    headers: headers,
    body: body,
  });

  const apiResponse = (await apiResult.json()) as any;

  if (apiResponse.errorCode) {
    console.log(
      `errorInstanceId: ${apiResponse.errorCode} errorName: ${apiResponse.errorName} errorCode: ${apiResponse.errorCode}`
    );
    throw new Error(
      `An error occurred while calling read RfpRequest errorInstanceId: ${apiResponse.errorInstanceId} errorCode: ${apiResponse.errorCode}`
    );
  }

  return apiResponse.data as RfpRequests[];
}
