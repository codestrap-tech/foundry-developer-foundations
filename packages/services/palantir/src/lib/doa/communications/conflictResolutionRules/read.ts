import { SupportedFoundryClients } from '@codestrap/developer-foundations-types';
import { foundryClientFactory } from '../../../factory/foundryClientFactory';

/**
 * Read conflict resolution rules for a user from Foundry.
 * For now this is a thin wrapper around the foundry client. Returns string[].
 */
export async function readConflictResolutionRules(
  userEmail: string,
  clientType: SupportedFoundryClients = SupportedFoundryClients.PRIVATE
): Promise<string[]> {
  const { getToken, url, ontologyRid } = foundryClientFactory(
    process.env.FOUNDRY_CLIENT_TYPE || clientType,
    undefined
  );

  const apiKey = await getToken();
  const fullUrl = `${url}/api/v1/users/${encodeURIComponent(
    userEmail
  )}/conflict-rules`;

  const res = await fetch(fullUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Foundry read failed: ${res.status} ${res.statusText}`);
  }

  const body = (await res.json()) as { rules?: string[] } | string[];
  return Array.isArray(body) ? body : body.rules ?? [];
}
