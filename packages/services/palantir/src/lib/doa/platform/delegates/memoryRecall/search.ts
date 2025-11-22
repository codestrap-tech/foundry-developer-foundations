import type { MemoryRecall } from '@codestrap/developer-foundations-types';
import { FoundryClient } from '@codestrap/developer-foundations-types';

// performs a vector search against the MemoryREcall objects using a proxy
// The OSDK does not support vector types yet.
// See https://www.palantir.com/docs/foundry/ontology-sdk/unsupported-types.
export async function searchMemoryRecall(
  input: string,
  kValue: number,
  token: string,
  ontologyRid: string,
  url: string,
): Promise<MemoryRecall[]> {
  console.log(`searchMemoryRecall input search query: ${input}}`);

  const apiKey = token;

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  const fullUrl = `${url}/api/v2/ontologies/${ontologyRid}/queries/memoryRecalVectorSearch/execute`;

  const body = JSON.stringify({
    parameters: {
      input,
      kValue,
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
      `errorInstanceId: ${apiResponse.errorCode} errorName: ${apiResponse.errorName} errorCode: ${apiResponse.errorCode}`,
    );
    throw new Error(
      `An error occurred while calling memory recall search errorInstanceId: ${apiResponse.errorInstanceId} errorCode: ${apiResponse.errorCode}`,
    );
  }

  return apiResponse.value as MemoryRecall[];
}
