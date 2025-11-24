import { readConflictResolutionRules } from './conflictResolutionRules/read';
import { foundryClientFactory } from '../../factory/foundryClientFactory';
import { SupportedFoundryClients } from '@codestrap/developer-foundations-types';

/**
 * Read conflict resolution rules for a user from Foundry.
 */
export async function readConflictResolutionRulesForUser(
  userEmail: string
): Promise<string[]> {
  const { getToken, url } = foundryClientFactory(process.env.FOUNDRY_CLIENT_TYPE || SupportedFoundryClients.PRIVATE, undefined);

  const token = await getToken();

  const rules = await readConflictResolutionRules(userEmail, token, url);

  return rules;
}

