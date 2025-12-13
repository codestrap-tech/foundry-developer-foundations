import { useRef, useCallback, useState, useEffect } from 'react';
import { postMessage } from '../lib/vscode';

export type LarryNotification = {
  type: 'info' | 'error';
  message: string;
  metadata: Record<string, any>;
};

export type LarryUpdateEvent = {
  type: 'larry.update';
  streamId: string;
  payload: LarryNotification;
};

type UseLarryStreamOptions = {
  onUpdate?: (event: LarryUpdateEvent) => void;
  onError?: (error: string) => void;
};

export function useLarryStream(
  baseUrl: string,
  streamId?: string,
  options?: UseLarryStreamOptions,
) {
  const [isConnected, setIsConnected] = useState(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (!streamId) return;
    const handler = (event: MessageEvent) => {
      const msg = event.data;

      if (msg?.type === 'larry_stream_event' && msg.streamId === streamId) {
        setIsConnected(true);
        if (msg.event === 'larry.update') {
          try {
            const data = JSON.parse(msg.data);
            optionsRef.current?.onUpdate?.(data);
          } catch (e) {
            console.error('Failed to parse larry stream event:', e);
          }
        }
      }

      if (msg?.type === 'larry_stream_error' && msg.streamId === streamId) {
        setIsConnected(false);
        optionsRef.current?.onError?.(msg.message);
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [streamId]);

  const start = useCallback(() => {
    postMessage({
      type: 'start_larry_stream',
      streamId,
      baseUrl,
    });
  }, [baseUrl, streamId]);

  const stop = useCallback(() => {
    postMessage({
      type: 'stop_larry_stream',
      streamId,
    });
    setIsConnected(false);
  }, [streamId]);

  return {
    start,
    stop,
    isConnected,
  };
}
