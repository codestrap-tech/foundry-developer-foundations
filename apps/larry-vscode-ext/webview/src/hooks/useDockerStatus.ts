import { useEffect, useState } from 'preact/hooks';
import { onMessage, postMessage } from '../lib/vscode';
import type { DockerStatus } from '../lib/backend-types';

export function useDockerStatus(worktreeName: string) {
  const [status, setStatus] = useState<DockerStatus>({ isRunning: false });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = () => {
    setIsLoading(true);
    setError(null);
    postMessage({
      type: 'get_docker_status',
      worktreeName,
    });
  };

  useEffect(() => {
    const cleanup = onMessage((msg: any) => {
      if (
        msg.type === 'docker_status_response' &&
        msg.worktreeName === worktreeName
      ) {
        setStatus({
          isRunning: msg.isRunning,
          containerId: msg.containerId,
        });
        setIsLoading(false);
      }
    });

    refetch();

    return cleanup;
  }, [worktreeName]);

  return { ...status, isLoading, error, refetch };
}

