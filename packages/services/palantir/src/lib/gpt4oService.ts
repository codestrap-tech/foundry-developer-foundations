import {
  SupportedFoundryClients,
  type Gpt40Parameters,
} from '@codestrap/developer-foundations-types';
import { foundryClientFactory } from './factory/foundryClientFactory';

export async function gpt4oService(
  user: string,
  system: string,
  gptParams?: Gpt40Parameters,
): Promise<string> {
  const { getToken, url, ontologyRid } = foundryClientFactory(
    process.env.FOUNDRY_CLIENT_TYPE || SupportedFoundryClients.PRIVATE,
    undefined,
  );

  const apiKey = await getToken();

  const fullUrl = `${url}/api/v2/ontologies/${ontologyRid}/queries/gpt4oProxy/execute`;

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  const body = JSON.stringify({
    parameters: {
      user,
      system,
      gptParams,
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
