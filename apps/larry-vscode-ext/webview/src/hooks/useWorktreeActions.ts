import { useCallback, useState, useEffect } from 'preact/hooks';
import { onMessage, postMessage } from '../lib/vscode';

interface ActionResult {
  success: boolean;
  error?: string;
  worktreeName?: string;
}

export function useWorktreeActions() {
  const [processingWorktree, setProcessingWorktree] = useState<string | null>(
    null,
  );
  const [lastResult, setLastResult] = useState<ActionResult | null>(null);

  useEffect(() => {
    const cleanup = onMessage((msg: any) => {
      if (msg.type === 'docker_action_complete') {
        setProcessingWorktree(null);
        setLastResult({
          success: msg.success,
          error: msg.error,
          worktreeName: msg.worktreeName,
        });
      } else if (msg.type === 'worktree_deleted') {
        setProcessingWorktree(null);
        setLastResult({
          success: msg.success,
          error: msg.error,
          worktreeName: msg.worktreeName,
        });
      }
    });

    return cleanup;
  }, []);

  const startContainer = useCallback((worktreeName: string) => {
    setProcessingWorktree(worktreeName);
    postMessage({
      type: 'start_docker_container',
      worktreeName,
    });
  }, []);

  const stopContainer = useCallback((worktreeName: string) => {
    setProcessingWorktree(worktreeName);
    postMessage({
      type: 'stop_docker_container',
      worktreeName,
    });
  }, []);

  const deleteWorktree = useCallback((worktreeName: string) => {
    setProcessingWorktree(worktreeName);
    postMessage({
      type: 'delete_worktree',
      worktreeName,
    });
  }, []);

  return {
    startContainer,
    stopContainer,
    deleteWorktree,
    processingWorktree,
    lastResult,
  };
}
