import type {
  ThreadsListResponse,
  MachineResponse,
  ThreadResponse,
  ThreadMessage,
  ThreadRawResponse,
} from './backend-types';

export async function fetchJSON<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `${res.status} ${res.statusText}: ${text || 'request failed'}`,
    );
  }
  return res.json() as Promise<T>;
}

export function withHeaders(
  base: RequestInit = {},
  extra: Record<string, string> = {},
): RequestInit {
  const headers = new Headers(base.headers || {});
  Object.entries(extra).forEach(([k, v]) => headers.set(k, v));
  return { ...base, headers };
}

export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    return crypto.randomUUID();
  // tiny fallback
  return 'id-' + Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export async function fetchThreads(
  baseUrl: string,
): Promise<ThreadsListResponse> {
  return fetchJSON<ThreadsListResponse>(`${baseUrl}/threads`);
}

export async function fetchThread(
  baseUrl: string,
  threadId: string,
): Promise<ThreadResponse> {
  const thread = await fetchJSON<ThreadRawResponse>(
    `${baseUrl}/threads/${threadId}`,
  );

  if (thread.messages) {
    return {
      ...thread,
      messages: JSON.parse(thread.messages) as ThreadMessage[],
    };
  }

  return {
    ...thread,
    messages: [],
  };
}

export async function fetchMachine(
  baseUrl: string,
  machineId: string,
): Promise<MachineResponse> {
  return fetchJSON<MachineResponse>(
    `${baseUrl}/machines/${encodeURIComponent(machineId)}`,
  );
}

export async function createThread(params: {
  baseUrl: string;
  worktreeName: string;
  userTask: string;
  label?: string;
  clientRequestId: string;
}): Promise<void> {
  try {
    console.log('Creating thread:', params);
    const { baseUrl, worktreeName, userTask, label, clientRequestId } = params;
    const idem = uuid();
    const init = withHeaders(
      {
        method: 'POST',
        body: JSON.stringify({ worktreeName, userTask, label }),
      },
      {
        'Content-Type': 'application/json',
        'Idempotency-Key': idem,
        'Client-Request-Id': clientRequestId,
      },
    );
    // We don't need the 202 body now - SSE will inform us
    await fetchJSON(`${baseUrl}/threads/new`, init);
  } catch (error) {
    console.error('Error creating thread:', error);
    throw error;
  }
}
