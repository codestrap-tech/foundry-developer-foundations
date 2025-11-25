import {
  SupportedFoundryClients,
  type MachineDao,
} from '@codestrap/developer-foundations-types';
import { upsertMachineExecution } from './delegates/machine/upsert';
import { readMachineExecution } from './delegates/machine/read';
import { foundryClientFactory } from '../../factory/foundryClientFactory';

export function makeMachineDao(): MachineDao {
  const { getToken, url, ontologyRid } = foundryClientFactory(
    process.env.FOUNDRY_CLIENT_TYPE || SupportedFoundryClients.PRIVATE,
    undefined,
  );

  return {
    // TODO code out all methods using OSDK API calls
    upsert: async (
      id: string,
      stateMachine: string,
      state: string,
      logs: string,
      lockOwner?: string,
      lockUntil?: number,
    ) => {
      const token = await getToken();

      const machine = await upsertMachineExecution(
        id,
        stateMachine,
        state,
        logs,
        token,
        ontologyRid,
        url,
        lockOwner,
        lockUntil,
      );

      return machine;
    },
    delete: async (machineExecutionId: string) =>
      console.log(
        `stub delete method called for: ${machineExecutionId}. We do not support deleting machines but include the method as it is part of the interface.`,
      ),
    read: async (machineExecutionId: string) => {
      const token = await getToken();

      const machine = await readMachineExecution(
        machineExecutionId,
        token,
        ontologyRid,
        url,
      );

      return machine;
    },
  };
}
