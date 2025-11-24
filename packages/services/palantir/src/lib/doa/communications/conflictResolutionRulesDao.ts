import {
  SupportedFoundryClients,
  type ConflictResolutionRulesDao,
} from '@codestrap/developer-foundations-types';
import { readConflictResolutionRules } from './conflictResolutionRules/read';
import { foundryClientFactory } from '../../factory/foundryClientFactory';

export function makeConflictResolutionRulesDao(): ConflictResolutionRulesDao {
  const { getToken, url } = foundryClientFactory(
    process.env.FOUNDRY_CLIENT_TYPE || SupportedFoundryClients.PRIVATE,
    undefined
  );

  return {
    upsert: async (userEmail: string, rules: string[]) => {
      console.log(
        `stub upsert method called for user: ${userEmail} with ${rules.length} rules. This will be implemented later.`
      );
      return rules;
    },
    delete: async (userEmail: string) =>
      console.log(
        `stub delete method called for user: ${userEmail}. We do not support deleting conflict resolution rules but include the method as it is part of the interface.`
      ),
    read: async (userEmail: string) => {
      const token = await getToken();

      const rules = await readConflictResolutionRules(userEmail, token, url);

      return rules;
    },
  };
}
