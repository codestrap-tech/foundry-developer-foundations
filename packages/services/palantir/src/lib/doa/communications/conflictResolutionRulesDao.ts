import { readConflictResolutionRules } from './conflictResolutionRules/read';
import { foundryClientFactory } from '../../factory/foundryClientFactory';
import { getClientType } from '../../utils/getClientType';

function getFoundryClient() {
  return foundryClientFactory(getClientType(), undefined);
}

/**
 * Read conflict resolution rules for a user from Foundry.
 */
export async function readConflictResolutionRulesForUser(
  userEmail: string
): Promise<string[]> {
  const { getToken, url } = getFoundryClient();
  const token = await getToken();

  const rules = await readConflictResolutionRules(userEmail, token, url);

  return rules;
}

