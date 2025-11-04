import { useCallback, useEffect, useState } from 'preact/hooks';
import { onMessage, postMessage } from '../lib/vscode';

export function useSaveThreadId() {
  const saveThreadId = useCallback(
    ({
      worktreeName,
      threadId,
    }: {
      worktreeName: string;
      threadId: string;
    }) => {
      postMessage({
        type: 'saveThreadId',
        worktreeName,
        threadId,
      });
    },
    []
  );

  return { fetch: saveThreadId };
}
