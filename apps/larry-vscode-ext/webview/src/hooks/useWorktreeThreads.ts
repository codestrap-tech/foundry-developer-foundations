import { useEffect, useState } from 'preact/hooks';
import { onMessage, postMessage } from '../lib/vscode';

export function useWorktreeThreads(worktreeName: string | undefined) {
  const [threads, setThreads] = useState<string[] | null>(null);

  useEffect(() => {
    if (!worktreeName) {
      return;
    }
    const cleanup = onMessage((msg: any) => {
      if (msg.type === 'threadIds' && msg.worktreeName === worktreeName) {
        setThreads(msg.threadIds);
      }
    });

    postMessage({
      type: 'readThreadIds',
      worktreeName,
    });

    return cleanup;
  }, [worktreeName]);

  return { threads };
}
