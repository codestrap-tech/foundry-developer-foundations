import type {
  TrainingData} from '@codestrap/developer-foundations-types';
import {
  FoundryClient
} from '@codestrap/developer-foundations-types';

export async function readTrainingData(
  id: string,
  token: string,
  ontologyRid: string,
  url: string,
): Promise<TrainingData> {
  console.log(`readTrainingData id: ${id}`);

  const apiKey = token;

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  const fullUrl = `${url}/api/v2/ontologies/${ontologyRid}/objects/XReasonTrainingData/${id}`;
  const fetchResult = await fetch(fullUrl, {
    method: 'GET',
    headers: headers,
  });

  const apiResponse = (await fetchResult.json()) as any;

  if (apiResponse.errorCode) {
    console.log(
      `errorInstanceId: ${apiResponse.errorCode} errorName: ${apiResponse.errorName} errorCode: ${apiResponse.errorCode}`
    );
    throw new Error(
      `An error occurred while calling read Training Data errorInstanceId: ${apiResponse.errorInstanceId} errorCode: ${apiResponse.errorCode}`
    );
  }

  return apiResponse as TrainingData;
}
