import { foundryClientFactory } from "./factory/foundryClientFactory";
import { getClientType } from "./utils/getClientType";

export async function embeddingsService(input: string): Promise<[number[]]> {
  const { getToken, url, ontologyRid } = foundryClientFactory(getClientType(), undefined);

  const apiKey = await getToken();

  const fullUrl = `${url}/api/v2/ontologies/${ontologyRid}/queries/textEmeddingSmall/execute`;

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  const body = JSON.stringify({
    parameters: {
      input,
    },
  });

  const apiResult = await fetch(fullUrl, {
    method: 'POST',
    headers: headers,
    body: body,
  });

  const result = (await apiResult.json()) as any;

  return result.value as [number[]];
}
