import {
  type GeminiParameters,
} from '@codestrap/developer-foundations-types';
import { foundryClientFactory } from "./factory/foundryClientFactory";
import { getClientType } from "./utils/getClientType";

export async function geminiService(
  user: string,
  system: string,
  params?: GeminiParameters
): Promise<string> {
  const { getToken, url, ontologyRid } = foundryClientFactory(getClientType(), undefined);

  const apiKey = await getToken();

  const fullUrl = `${url}/api/v2/ontologies/${ontologyRid}/queries/gemniFlash20Proxy/execute`;

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  const body = JSON.stringify({
    parameters: {
      user,
      system,
      params,
    },
  });

  const apiResult = await fetch(fullUrl, {
    method: 'POST',
    headers: headers,
    body: body,
  });

  const result = (await apiResult.json()) as any;

  return result.value as string;
}
