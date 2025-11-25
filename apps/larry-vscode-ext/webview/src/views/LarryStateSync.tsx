/* JSX */
/* @jsxImportSource preact */
import { useEffect, useRef } from 'preact/hooks';
import { useExtensionStore, extractLarryStateFromStore } from '../store/store';
import { useMachineQuery } from '../hooks/useMachineQuery';
import { dehydrateQueryCache } from '../store/query-sync';
import { postMessage } from '../lib/vscode';
import type { LarryState } from '../store/larry-state';

/**
 * LarryStateSync - Syncs sidebar state to extension for artifact editors
 *
 * This component:
 * 1. Watches for store changes (threadId, apiUrl, etc.)
 * 2. Watches for machine query updates (SSE-driven)
 * 3. Dehydrates query cache when it changes
 * 4. Posts sync messages to extension
 *
 * The extension caches this state and broadcasts to artifact editors.
 * See store/docs.md for architecture details.
 */
export function LarryStateSync() {
  const store = useExtensionStore();
  const { data: machineData } = useMachineQuery(
    store.apiUrl,
    store.currentThreadId,
  );

  // Track previous values to detect changes
  const prevLarryStateRef = useRef<string>('');
  const prevQueryCacheRef = useRef<string>('');
  const debounceTimerRef = useRef<number | null>(null);

  // Sync LarryState when store or machine data changes
  useEffect(() => {
    const larryState = extractLarryStateFromStore(store, machineData);
    const serializedState = JSON.stringify(larryState);

    // Only sync if state actually changed
    if (serializedState !== prevLarryStateRef.current) {
      prevLarryStateRef.current = serializedState;

      // Debounce to avoid excessive messages
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = window.setTimeout(() => {
        postMessage({
          type: 'larry_state_sync',
          larryState,
        });
        debounceTimerRef.current = null;
      }, 100);
    }
  }, [
    store.currentThreadId,
    store.apiUrl,
    store.isInWorktree,
    store.worktreePort,
    store.mainPort,
    store.agents,
    store.selectedAgent,
    machineData,
  ]);

  // Sync query cache when machine data changes
  useEffect(() => {
    if (!machineData) return;

    const queryCache = dehydrateQueryCache();

    // Only sync if cache actually changed
    if (queryCache !== prevQueryCacheRef.current) {
      prevQueryCacheRef.current = queryCache;

      postMessage({
        type: 'query_cache_sync',
        queryCache,
      });
    }
  }, [machineData]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // This component doesn't render anything
  return null;
}
