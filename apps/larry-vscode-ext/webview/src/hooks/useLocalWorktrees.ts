import { useEffect, useState, useCallback } from 'preact/hooks';
import { onMessage, postMessage } from '../lib/vscode';
import type { LocalWorktree } from '../lib/backend-types';

export function useLocalWorktrees() {
  const [worktrees, setWorktrees] = useState<LocalWorktree[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  const refetch = useCallback(() => {
    setRefetchTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    const cleanup = onMessage((msg: any) => {
      if (msg.type === 'local_worktrees_response') {
        setWorktrees(msg.worktrees || []);
        setError(msg.error || null);
        setIsLoading(false);
      }
    });

    postMessage({
      type: 'list_local_worktrees',
    });

    return cleanup;
  }, [refetchTrigger]);

  return { worktrees, isLoading, error, refetch };
}
