import {
  SupportedFoundryClients,
  type TicketsDao,
} from '@codestrap/developer-foundations-types';
import { upsertTicket } from './delegates/tasks/upsert';
import { readTicket } from './delegates/tasks/read';
import { foundryClientFactory } from '../../factory/foundryClientFactory';

export function makeTicketsDao(): TicketsDao {
  const { getToken, url, ontologyRid } = foundryClientFactory(
    process.env.FOUNDRY_CLIENT_TYPE || SupportedFoundryClients.PRIVATE,
    undefined,
  );

  return {
    // TODO code out all methods using OSDK API calls
    upsert: async (
      id: string,
      alertTitle: string,
      alertType: string,
      description: string,
      severity = 'Low',
      status = 'Open',
      points?: number,
      assignees?: string,
    ) => {
      const token = await getToken();

      const ticket = await upsertTicket(
        token,
        ontologyRid,
        url,
        id,
        alertTitle,
        alertType,
        description,
        severity,
        status,
        points,
        assignees,
      );

      return ticket;
    },
    delete: async (id: string) =>
      console.log(
        `stub delete method called for: ${id}. We do not support deleting tickets but include the method as it is part of the interface.`,
      ),
    read: async (id: string) => {
      const token = await getToken();

      const ticket = await readTicket(id, token, ontologyRid, url);

      return ticket;
    },
  };
}
