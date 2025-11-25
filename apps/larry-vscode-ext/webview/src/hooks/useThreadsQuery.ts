import { useQuery } from '@tanstack/react-query';
import { fetchThreads } from '../lib/http';
import { queryClient } from '../lib/query';

export function useThreadsQuery(baseUrl: string) {
  return {
    isLoading: false,
    data: {
      items: [
        {
          id: '4c84718c-d1d0-4149-840f-0bdc56112062',
          label: 'JIRA: MPR-788 - Update colors of...',
          worktreeName: 'worktree-larry-mpr-788',
          createdAt: '2025-09-29T10:00:00.000Z',
          updatedAt: '2025-09-29T10:00:00.000Z',
        },
        {
          id: '4c84718c-d1d0-4149-840f-0bdc56112062-1',
          label: 'JIRA: MPR-1021 - Implement DAL for...',
          worktreeName: 'worktree-larry-mpr-1021',
          createdAt: '2025-09-29T10:00:00.000Z',
          updatedAt: '2025-09-29T10:00:00.000Z',
        },
        {
          id: '4c84718c-d1d0-4149-840f-0bdc56112062-2',
          label: 'JIRA: MPR-991 - Support for email att...',
          worktreeName: 'worktree-larry-mpr-991',
          createdAt: '2025-09-29T10:00:00.000Z',
          updatedAt: '2025-09-29T10:00:00.000Z',
        },
      ],
      nextCursor: null,
      requestId: '123',
    },
  };
  return useQuery(
    {
      queryKey: ['threads', { baseUrl }],
      queryFn: () => fetchThreads(baseUrl),
      refetchInterval: 5000,
      staleTime: 4000,
    },
    queryClient,
  );
}
