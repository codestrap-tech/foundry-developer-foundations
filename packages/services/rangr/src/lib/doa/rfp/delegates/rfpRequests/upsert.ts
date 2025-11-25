import type {
  RangrClient,
  RfpRequests,
} from '@codestrap/developer-foundations-types';

export async function upsertRfpRequest(
  rfp: string,
  rfpVendorResponse: string,
  vendorId: string,
  machineExecutionId: string,
  client: RangrClient,
  id?: string,
  rfpResponseStatus?: number
): Promise<RfpRequests> {
  console.log(`upsertThread threadId: ${id}`);

  const apiKey = await client.getToken();

  const url = `${client.url}/api/v2/ontologies/${client.ontologyRid}/actions/upsert-rfp-requests/apply`;

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  const body = JSON.stringify({
    parameters: {
      rfp,
      rfpVendorResponse,
      vendorId,
      machineExecutionId,
      id,
      rfpResponseStatus,
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

  if (!result.edits || result.edits.edits.length === 0) {
    throw new Error('Failed to upsert RfpRequest to the ontology.');
  }

  console.log(
    `upsert RfpRequest action returned: ${result?.edits?.edits?.[0]}`
  );

  const rfpId = result.edits.edits[0].primaryKey as string;

  const getUrl = `${client.url}/api/v2/ontologies/${client.ontologyRid}/objects/RfpRequests/${rfpId}`;
  const machineFetchResults = await fetch(getUrl, {
    method: 'GET',
    headers: headers,
  });

  const rfpRequest = (await machineFetchResults.json()) as RfpRequests;
  console.log(
    `the read RfpRequest request returned: ${JSON.stringify(rfpRequest)}`
  );

  return rfpRequest;
}
