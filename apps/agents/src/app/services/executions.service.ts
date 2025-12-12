import type {
  Communications,
  MachineExecutions,
} from '@codestrap/developer-foundations-types';

export async function callGetCommunications(id: string, token: string) {
  // fire and forget as there is a timeout we have to deal with
  const res = await fetch(`/api/communications?id=${id}`, {
    method: 'GET',
    headers: {
      'x-foundry-access-token': token,
    },
  });

  if (!res.ok) {
    console.log('Executions API failed');
    console.log(JSON.stringify(res));
    throw new Error(
      `Executions API failed with:\n${JSON.stringify(res, null, 2)}`,
    );
  }

  const result = await res.json();
  console.log('Executions API result:', result);

  return result as Communications;
}

export async function callGetMachines(id: string, token: string) {
  // fire and forget as there is a timeout we have to deal with
  const res = await fetch(`/api/machines?id=${id}`, {
    method: 'GET',
    headers: {
      'x-foundry-access-token': token,
    },
  });

  if (!res.ok) {
    console.log('Executions API failed');
    console.log(JSON.stringify(res));
    throw new Error(
      `Executions API failed with:\n${JSON.stringify(res, null, 2)}`,
    );
  }

  const result = await res.json();
  console.log('Executions API result:', result);

  return result as MachineExecutions;
}
