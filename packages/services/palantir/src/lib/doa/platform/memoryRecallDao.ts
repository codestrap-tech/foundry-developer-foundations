import {
  SupportedFoundryClients,
  type MemoryRecallDao,
} from '@codestrap/developer-foundations-types';
import { searchMemoryRecall } from './delegates/memoryRecall/search';
import { readMemoryRecall } from './delegates/memoryRecall/read';
import { foundryClientFactory } from '../../factory/foundryClientFactory';

export function makeMemoryRecallDao(): MemoryRecallDao {
  const { getToken, url, ontologyRid } = foundryClientFactory(process.env.FOUNDRY_CLIENT_TYPE || SupportedFoundryClients.PRIVATE, undefined);

  return {
    // TODO code out all methods using OSDK API calls
    upsert: async (input: string) => {
      console.log(
        `stub upsert method for ${input}. We do not support upsert for this object type.`
      );
      return {
        createdOn: Date.now(),
        id: 'stubId',
        originalText: 'stub text',
        source: 'stubSource',
        userId: 'stubUserId',
      };
    },
    delete: async (id: string) =>
      console.log(
        `stub delete method called for: ${id}. We do not support deleting RfpRequests but include the method as it is part of the interface.`
      ),
    read: async (id: string) => {
      const token = await getToken();

      const memoryRecall = await readMemoryRecall(id, token, ontologyRid, url);

      return memoryRecall;
    },
    search: async (task: string, kValue = 1) => {
      const token = await getToken();

      const results = await searchMemoryRecall(task, kValue, token, ontologyRid, url);
      // there should be only one results based on the params
      return results;
    },
  };
}
