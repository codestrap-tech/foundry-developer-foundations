import type { Tickets } from '@codestrap/developer-foundations-types';
import { FoundryClient } from '@codestrap/developer-foundations-types';

export async function readTicket(
  id: string,
  token: string,
  ontologyRid: string,
  url: string,
): Promise<Tickets> {
  console.log(`readTicket id: ${id}`);

  const apiKey = token;

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  const fullUrl = `${url}/api/v2/ontologies/${ontologyRid}/objects/Tickets/${id}`;
  const machineFetchResults = await fetch(fullUrl, {
    method: 'GET',
    headers: headers,
  });

  const apiResponse = (await machineFetchResults.json()) as any;

  if (apiResponse.errorCode) {
    console.log(
      `errorInstanceId: ${apiResponse.errorCode} errorName: ${apiResponse.errorName} errorCode: ${apiResponse.errorCode}`,
    );
    throw new Error(
      `An error occurred while calling read ticket errorInstanceId: ${apiResponse.errorInstanceId} errorCode: ${apiResponse.errorCode}`,
    );
  }

  return apiResponse as Tickets;
}
