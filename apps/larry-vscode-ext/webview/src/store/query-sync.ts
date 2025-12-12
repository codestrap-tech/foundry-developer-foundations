import {
  dehydrate,
  hydrate,
  type DehydratedState,
} from '@tanstack/react-query';
import { queryClient } from '../lib/query';

/**
 * Query Cache Synchronization Utilities
 *
 * These utilities enable sharing React Query cache between webviews
 * via the extension (Node.js) as a message relay.
 *
 * Flow:
 * 1. Sidebar dehydrates cache → sends to extension
 * 2. Extension caches the dehydrated state
 * 3. Artifact editor receives → hydrates its cache
 *
 * See docs.md for detailed architecture.
 */

/**
 * Dehydrate the query cache for syncing to extension
 * Returns a JSON string that can be sent via postMessage
 */
export function dehydrateQueryCache(): string {
  const dehydratedState = dehydrate(queryClient, {
    // Only dehydrate successful queries
    shouldDehydrateQuery: (query) => query.state.status === 'success',
  });
  return JSON.stringify(dehydratedState);
}

/**
 * Hydrate the query cache from extension's cached state
 * Call this when artifact editor receives cached state
 */
export function hydrateQueryCache(serializedState: string): void {
  try {
    const dehydratedState: DehydratedState = JSON.parse(serializedState);
    hydrate(queryClient, dehydratedState);
  } catch (error) {
    console.error('Failed to hydrate query cache:', error);
  }
}

/**
 * Get specific query data from cache (e.g., machine data)
 */
export function getMachineQueryData(apiUrl: string, machineId: string) {
  return queryClient.getQueryData(['machine', { baseUrl: apiUrl, machineId }]);
}

/**
 * Invalidate machine query to force refetch
 */
export function invalidateMachineQuery(apiUrl: string, machineId: string) {
  return queryClient.invalidateQueries({
    queryKey: ['machine', { baseUrl: apiUrl, machineId }],
  });
}
