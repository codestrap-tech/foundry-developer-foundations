import { useQuery } from "@tanstack/react-query";
import { queryClient } from '../lib/query';
import { fetchThread } from "../lib/http";
import { ThreadResponse } from "../lib/backend-types";

export function useThread(baseUrl: string, threadId?: string) {
  return useQuery<ThreadResponse>({
    enabled: !!threadId,
    queryKey: ['thread', { baseUrl, threadId }],
    queryFn: () => fetchThread(baseUrl, threadId || ''),
  }, queryClient);
}