import type {
  Communications} from '@codestrap/developer-foundations-types';
import {
  FoundryClient
} from '@codestrap/developer-foundations-types';

export async function readCommunications(
  id: string,
  token: string,
  ontologyRid: string,
  url: string,
): Promise<Communications> {
  console.log(`readMachineExecution id: ${id}`);

  const apiKey = token;

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  const fullUrl = `${url}/api/v2/ontologies/${ontologyRid}/objects/Communications/${id}`;
  const fetchResults = await fetch(fullUrl, {
    method: 'GET',
    headers: headers,
  });

  const apiResponse = (await fetchResults.json()) as any;

  // NOT_FOUND errors are expected during polling operations. They are cluttering the console so I turned logging them off
  if (apiResponse.errorCode && apiResponse.errorCode !== 'NOT_FOUND') {
    console.log(
      `errorInstanceId: ${apiResponse.errorCode} errorName: ${apiResponse.errorName} errorCode: ${apiResponse.errorCode}`
    );
    throw new Error(
      `An error occurred while calling read communication errorInstanceId: ${apiResponse.errorInstanceId} errorCode: ${apiResponse.errorCode}`
    );
  }

  return apiResponse as Communications;
}
