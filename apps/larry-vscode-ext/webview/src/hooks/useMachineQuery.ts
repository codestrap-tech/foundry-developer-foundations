import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { fetchMachine } from '../lib/http';
import { queryClient } from '../lib/query';

export function useMachineQuery(baseUrl: string, machineId?: string) {
  const query = useQuery(
    {
      enabled: !!machineId,
      queryKey: ['machine', { baseUrl, machineId }],
      queryFn: () => fetchMachine(baseUrl, machineId!),
      retry: (failureCount, error) => {
        if (failureCount >= 10) return false;
        return true;
      },
      retryDelay: (attemptIndex) => {
        return 5000;
      },
      staleTime: 1000,
      refetchInterval: false,
    },
    queryClient
  );

  return query;
}
