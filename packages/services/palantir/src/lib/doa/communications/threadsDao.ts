import {
  SupportedFoundryClients,
  type ThreadsDao,
} from '@codestrap/developer-foundations-types';
import { upsertThread } from './threads/upsert';
import { readThread } from './threads/read';
import { foundryClientFactory } from '../../factory/foundryClientFactory';

export function makeThreadsDao(): ThreadsDao {
  const { getToken, url, ontologyRid } = foundryClientFactory(
    process.env.FOUNDRY_CLIENT_TYPE || SupportedFoundryClients.PRIVATE,
    undefined,
  );

  return {
    // TODO code out all methods using OSDK API calls
    upsert: async (messages: string, appId: string, id?: string) => {
      const token = await getToken();

      const machine = await upsertThread(
        messages,
        appId,
        token,
        ontologyRid,
        url,
        id,
      );

      return machine;
    },
    delete: async (id: string) =>
      console.log(
        `stub delete method called for: ${id}. We do not support deleting threads but include the method as it is part of the interface.`,
      ),
    read: async (id: string) => {
      const token = await getToken();

      const machine = await readThread(id, token, ontologyRid, url);

      return machine;
    },
  };
}
