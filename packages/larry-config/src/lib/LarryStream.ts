import type { LarryStream, StreamCallback, Subscription, StreamEntry, LarryNotification } from '@codestrap/developer-foundations-types';

const streamStore = new Map<string, StreamEntry>();

export function subscribe<T = unknown>(
  id: string,
  callback: StreamCallback<T>
): Subscription<T> {
  if (!streamStore.has(id)) {
    streamStore.set(id, { value: null, subscribers: new Set() });
  }
  const stream = streamStore.get(id)!;
  stream.subscribers.add(callback as StreamCallback<unknown>);

  return {
    unsubscribe: () => {
      stream.subscribers.delete(callback as StreamCallback<unknown>);
    },
    getValue: () => stream.value as T | null,
  };
}

export function publish<T = unknown>(opts: { id: string; payload: LarryNotification }): void {
  const { id, payload } = opts;
  if (!streamStore.has(id)) {
    streamStore.set(id, { value: null, subscribers: new Set() });
  }
  const stream = streamStore.get(id)!;
  stream.value = payload;

  if (payload.type === 'error') {
    console.error(`Error in ${id}: ${payload?.message}`);
    console.error(payload?.metadata['error']);
  }
  stream.subscribers.forEach((callback) => callback(payload));
}

export const makeLarryStream = (): LarryStream => {
  return {
    subscribe,
    publish,
  };
};
