import { useEffect } from 'preact/hooks';
import { onMessage, postMessage } from '../lib/vscode';
import { useExtensionDispatch, useExtensionStore } from '../store/store';
import { handleForwardedSSE } from '../lib/extension-sse-bridge';
import { useSaveThreadId } from '../hooks/useSaveThreadId';
import { invalidateMachineQuery } from '../store/query-sync';

export function BootChannel() {
  const dispatch = useExtensionDispatch();
  const { clientRequestId, apiUrl, currentThreadId } = useExtensionStore();
  const { fetch: saveThreadId } = useSaveThreadId();
  useEffect(() => {
    const handleMessage = (msg: any) => {
      if (!msg || typeof msg !== 'object') return;

      if (msg.type === 'set_larry_working') {
        dispatch({ type: 'SET_LARRY_WORKING', payload: !!msg.isWorking });
        return;
      }

      if (msg.type === 'worktree_detection') {
        dispatch({
          type: 'SET_WORKTREE_DETECTION',
          payload: {
            isInWorktree: !!msg.isInWorktree,
            currentThreadId: msg.currentThreadId || undefined,
            worktreeName: msg.worktreeName,
            worktreePort: Number(msg.worktreePort),
            mainPort: Number(msg.mainPort),
          },
        });
      }

      if (msg.type === 'worktree_ready') {
        dispatch({
          type: 'SET_WORKTREE_READY',
          payload: {
            currentThreadId: msg.threadId,
            worktreeName: msg.worktreeName,
          },
        });
      }

      if (msg.type === 'worktree_setup_error') {
        dispatch({ type: 'SET_WORKTREE_SETUP_ERROR' });
      }

      if (msg.type === 'update_thread_state') {
        dispatch({ type: 'SET_THREAD_STATE', payload: msg.state });
      }

      if (msg.type === 'config_loaded') {
        dispatch({
          type: 'SET_CONFIG',
          payload: {
            agents: msg.config.agents,
            workspaceSetupCommand: msg.config.workspaceSetupCommand,
            larryEnvPath: msg.config.larryEnvPath,
            worktreePort: Number(msg.worktreePort),
            mainPort: Number(msg.mainPort),
          },
        });
      }

      console.log('📨 Webview received message:', msg);
      // NEW: forwarded SSE
      if (
        msg.type === 'sse_event' &&
        msg.baseUrl &&
        msg.event &&
        typeof msg.data === 'string'
      ) {
        console.log('📨 Webview received SSE event:', msg);
        handleForwardedSSE(
          { baseUrl: msg.baseUrl, event: msg.event, data: msg.data },
          { clientRequestId, dispatch, saveThreadId },
        );
      }
    };

    // Set up message listener
    const cleanupListener = onMessage(handleMessage);

    // Request initial worktree status from extension
    postMessage({ type: 'getCurrentWorktree' });

    // Request initial config from extension
    postMessage({ type: 'getConfig' });

    // Cleanup function
    return () => {
      if (typeof cleanupListener === 'function') {
        cleanupListener();
      }
    };
  }, [clientRequestId, apiUrl, dispatch, saveThreadId]);

  return null;
}
