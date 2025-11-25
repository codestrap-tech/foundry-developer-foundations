import type {
  MemoryRecall} from '@codestrap/developer-foundations-types';
import {
  FoundryClient
} from '@codestrap/developer-foundations-types';

export async function readMemoryRecall(
  id: string,
  token: string,
  ontologyRid: string,
  url: string,
): Promise<MemoryRecall> {
  console.log(`readMemoryRecall id: ${id}`);

  const apiKey = token;

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  const fullUrl = `${url}/api/v2/ontologies/${ontologyRid}/objects/MemoryRecall/${id}`;
  const memoryRecallFetchResults = await fetch(fullUrl, {
    method: 'GET',
    headers: headers,
  });

  const apiResponse = (await memoryRecallFetchResults.json()) as any;

  if (apiResponse.errorCode) {
    console.log(
      `errorInstanceId: ${apiResponse.errorCode} errorName: ${apiResponse.errorName} errorCode: ${apiResponse.errorCode}`
    );
    throw new Error(
      `An error occurred while calling read machine errorInstanceId: ${apiResponse.errorInstanceId} errorCode: ${apiResponse.errorCode}`
    );
  }

  return apiResponse as MemoryRecall;
}
