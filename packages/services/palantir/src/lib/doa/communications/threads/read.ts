import type { Threads } from '@codestrap/developer-foundations-types';
import { FoundryClient } from '@codestrap/developer-foundations-types';

export async function readThread(
  id: string,
  token: string,
  ontologyRid: string,
  url: string,
): Promise<Threads> {
  console.log(`readThread id: ${id}`);

  const apiKey = token;

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  const fullUrl = `${url}/api/v2/ontologies/${ontologyRid}/objects/Threads/${id}`;
  const threadFetchResults = await fetch(fullUrl, {
    method: 'GET',
    headers: headers,
  });

  const apiResponse = (await threadFetchResults.json()) as any;

  if (apiResponse.errorCode) {
    console.log(
      `errorInstanceId: ${apiResponse.errorCode} errorName: ${apiResponse.errorName} errorCode: ${apiResponse.errorCode}`
    );
    throw new Error(
      `An error occurred while calling read thread errorInstanceId: ${apiResponse.errorInstanceId} errorCode: ${apiResponse.errorCode}`
    );
  }

  return apiResponse as Threads;
}
