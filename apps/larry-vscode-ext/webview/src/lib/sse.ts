export type SSEHandlers = Record<string, (data: any) => void>;

export type SSEController = {
  close: () => void;
};

export function openSSE(
  url: string,
  handlers: SSEHandlers,
  onStatus?: (s: 'open' | 'error' | 'closed') => void,
): SSEController {
  let es: EventSource | null = null;
  let closed = false;
  let backoff = 1000; // start 1s

  const connect = () => {
    if (closed) return;
    es = new EventSource(url);

    es.addEventListener('open', () => {
      backoff = 1000;
      onStatus?.('open');
    });

    es.addEventListener('error', () => {
      onStatus?.('error');
      es?.close();
      if (closed) return;
      setTimeout(connect, backoff);
      backoff = Math.min(backoff * 2, 30000); // cap at 30s
    });

    Object.keys(handlers).forEach((evt) => {
      es!.addEventListener(evt, (e: MessageEvent) => {
        try {
          const data = JSON.parse((e as MessageEvent).data);
          handlers[evt]?.(data);
        } catch {
          // ignore parse errors
        }
      });
    });
  };

  connect();

  return {
    close: () => {
      closed = true;
      es?.close();
      onStatus?.('closed');
    },
  };
}
