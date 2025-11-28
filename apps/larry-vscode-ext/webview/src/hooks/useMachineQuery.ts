import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { fetchMachine } from '../lib/http';
import { queryClient } from '../lib/query';

export function useMachineQuery(baseUrl: string, machineId?: string, options?: {
  refetchInterval?: number;
}) {
  const query = useQuery(
    {
      enabled: !!machineId,
      queryKey: ['machine', { baseUrl, machineId }],
      queryFn: () => fetchMachine(baseUrl, machineId!),
      refetchInterval: options?.refetchInterval || false,
    },
    queryClient
  );

  return query;
}
