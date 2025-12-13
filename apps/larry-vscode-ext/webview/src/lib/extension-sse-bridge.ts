import { queryClient } from './query';
import { postMessage } from './vscode';
import { dehydrateQueryCache } from '../store/query-sync';
import type {
  MachineUpdatedEvent,
  ThreadCreatedEvent,
  ThreadsListResponse,
} from './backend-types';
import type { ExtensionAction } from '../store/store';

// Handle a single forwarded SSE event from the extension
export function handleForwardedSSE(
  msg: {
    baseUrl: string;
    event: string;
    data: string;
  },
  storeValues: {
    clientRequestId: string;
    dispatch: (action: ExtensionAction) => void;
    saveThreadId: ({
      worktreeName,
      threadId,
    }: {
      worktreeName: string;
      threadId: string;
    }) => any;
  },
) {
  const { baseUrl, event, data } = msg;

  try {
    if (event === 'thread.created') {
      const evt: ThreadCreatedEvent = JSON.parse(data);
      // Update threads list cache for THIS baseUrl
      storeValues.saveThreadId({
        worktreeName: evt.worktreeName,
        threadId: evt.threadId,
      });

      queryClient.setQueryData(
        ['threads', { baseUrl }],
        (prev: ThreadsListResponse | undefined) => {
          console.log('📝 Updating threads cache. Previous:', prev);
          if (!prev) return prev;
          const updated = {
            ...prev,
            items: [
              {
                id: evt.threadId,
                label: evt.label,
                worktreeName: evt.worktreeName,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
              ...prev.items,
            ],
          };
          console.log('Updated threads cache:', updated);
          return updated;
        },
      );

      // Sync cache to editor after threads update
      const queryCache = dehydrateQueryCache();
      postMessage({
        type: 'query_cache_sync',
        queryCache,
      });

      // If this event belongs to our submission, adopt the new machine/thread id
      if (
        evt.clientRequestId &&
        evt.clientRequestId === storeValues.clientRequestId
      ) {
        console.log('Setting currentThreadId to:', evt.machineId);
        storeValues.dispatch({
          type: 'SET_CURRENT_THREAD_ID',
          payload: evt.machineId, // machineId == threadId for now
        });
      }
      return;
    }

    if (event === 'machine.updated') {
      const evt: MachineUpdatedEvent = JSON.parse(data);
      const m = evt.machine;
      console.log('🤖 Processing machine.updated:', m);
      queryClient.setQueryData(['machine', { baseUrl, machineId: m.id }], m);
      console.log('📝 Updated machine cache for:', m.id);

      // Sync cache to editor after machine update
      const queryCache = dehydrateQueryCache();
      postMessage({
        type: 'query_cache_sync',
        queryCache,
      });

      return;
    }
  } catch (error) {
    console.error('❌ SSE Bridge error processing event:', error);
  }
}
