import { useRef, useEffect } from 'preact/hooks';
import { onMessage, postMessage } from '../lib/vscode';

export function useReadFile() {
  const pendingResolvers = useRef<Map<string, (content: string) => void>>(new Map());
  const pendingRejectors = useRef<Map<string, (error: Error) => void>>(new Map());


  useEffect(() => {
    const cleanup = onMessage((msg: any) => {
      if (msg.type === 'fileContent') {
        const resolver = pendingResolvers.current.get('file');
        if (resolver) {
          resolver(msg.content);
          pendingResolvers.current.delete('file');
          pendingRejectors.current.delete('file');
        }
      }
      if (msg.type === 'fileReadError' && msg.filePath) {
        const rejector = pendingRejectors.current.get('file');
        if (rejector) {
          rejector(new Error(msg.error));
          pendingResolvers.current.delete('file');
          pendingRejectors.current.delete('file');
        }
      }
    });

    return cleanup;
  }, []);


  const fetch = (filePath: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      pendingResolvers.current.set('file', resolve);
      pendingRejectors.current.set('file', reject);
      postMessage({
        type: 'readFile',
        filePath,
      });
    });
  };

  return { fetch };
}

