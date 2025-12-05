import { useRef, useEffect } from 'preact/hooks';
import { onMessage, postMessage } from '../lib/vscode';

export function useReadFile() {
  const pendingResolvers = useRef<Map<string, (content: string) => void>>(new Map());
  const pendingRejectors = useRef<Map<string, (error: Error) => void>>(new Map());


  useEffect(() => {
    const cleanup = onMessage((msg: any) => {
      if (msg.type === 'fileContent' && msg.filePath) {
        const resolver = pendingResolvers.current.get(msg.filePath);
        if (resolver) {
          resolver(msg.content);
          pendingResolvers.current.delete(msg.filePath);
          pendingRejectors.current.delete(msg.filePath);
        }
      }
      if (msg.type === 'fileReadError' && msg.filePath) {
        const rejector = pendingRejectors.current.get(msg.filePath);
        if (rejector) {
          rejector(new Error(msg.error));
          pendingResolvers.current.delete(msg.filePath);
          pendingRejectors.current.delete(msg.filePath);
        }
      }
    });

    return cleanup;
  }, []);


  const fetch = (filePath: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      pendingResolvers.current.set(filePath, resolve);
      pendingRejectors.current.set(filePath, reject);
      console.log('fetching file', filePath);
      postMessage({
        type: 'readFile',
        filePath,
      });
    });
  };

  return { fetch };
}

