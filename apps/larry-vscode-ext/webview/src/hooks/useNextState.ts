import type { MachineResponse } from '../lib/backend-types';
import { queryClient } from '../lib/query';

type Payload = {
  machineId: string;
  contextUpdate: {
    [key: string]: Record<string, any>;
  };
};

export function useNextMachineState(baseUrl: string) {
  return {
    fetch: async ({ machineId, contextUpdate }: Payload) => {
      queryClient.setQueryData(
        ['machine', { baseUrl: baseUrl, machineId }],
        (prev) => {
          return {
            ...(prev as MachineResponse),
            status: 'running',
          };
        }
      );

      return fetch(`${baseUrl}/machines/${machineId}/next`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': Math.random().toString(36).substring(2, 15),
        },
        body: JSON.stringify({
          contextUpdate,
        }),
      });
    },
  };
}
