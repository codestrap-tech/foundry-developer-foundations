import { useEffect } from 'preact/hooks';
import { onMessage, postMessage } from '../lib/vscode';
import { useExtensionDispatch, useExtensionStore } from '../store/store';
import { handleForwardedSSE } from '../lib/extension-sse-bridge';
import { useSaveThreadId } from '../hooks/useSaveThreadId';

export function BootChannel() {
  const dispatch = useExtensionDispatch();
  const { clientRequestId } = useExtensionStore();
  const { fetch: saveThreadId } = useSaveThreadId();
  useEffect(() => {
    const handleMessage = (msg: any) => {
      if (!msg || typeof msg !== 'object') return;
      
      if (msg.type === 'worktree_detection') {
        dispatch({
          type: 'SET_WORKTREE_DETECTION',
          payload: {
            isInWorktree: !!msg.isInWorktree,
            currentThreadId: msg.currentThreadId || undefined,
            worktreeName: msg.worktreeName,
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

      console.log('📨 Webview received message:', msg);
      // NEW: forwarded SSE
      if (msg.type === 'sse_event' && msg.baseUrl && msg.event && typeof msg.data === 'string') {
        console.log('📨 Webview received SSE event:', msg);
        handleForwardedSSE(
          { baseUrl: msg.baseUrl, event: msg.event, data: msg.data },
          { clientRequestId, dispatch, saveThreadId }
        );
      }

    };

    // Set up message listener
    const cleanupListener = onMessage(handleMessage);

    // Request initial worktree status from extension
    postMessage({ type: 'getCurrentWorktree' });

    // Cleanup function
    return () => {
      if (typeof cleanupListener === 'function') {
        cleanupListener();
      }
    };
  }, []);

  return null;
}
