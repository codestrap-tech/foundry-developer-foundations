import type {
  TrainingData} from '@codestrap/developer-foundations-types';
import {
  FoundryClient
} from '@codestrap/developer-foundations-types';

export async function searchTrainingData(
  xReason: string,
  type: string,
  token: string,
  ontologyRid: string,
  url: string,
): Promise<TrainingData[]> {
  console.log(`searchTrainingData xReason: ${xReason} type: ${type}`);

  const apiKey = token;

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  const fullUrl = `${url}/api/v2/ontologies/${ontologyRid}/objects/XReasonTrainingData/search`;

  const body = JSON.stringify({
    where: {
      type: 'and',
      value: [
        {
          type: 'eq',
          field: 'xReason',
          value: xReason,
        },
        {
          type: 'eq',
          field: 'type',
          value: type,
        },
      ],
    },
  });

  const apiResult = await fetch(fullUrl, {
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
      `An error occurred while calling read Training Data errorInstanceId: ${apiResponse.errorInstanceId} errorCode: ${apiResponse.errorCode}`
    );
  }

  return apiResponse.data as TrainingData[];
}
