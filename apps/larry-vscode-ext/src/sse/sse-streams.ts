import * as vscode from 'vscode';
import { SSEProxy } from './sse-proxy';
import type { ExtensionState, LarryConfig, SSEEvent } from '../types';

// ============================================================================
// SSE Stream Management Functions
// ============================================================================

/**
 * Starts the main SSE connection (for main list view)
 * Currently not implemented - placeholder for future use
 */
export function startMainSSE(state: ExtensionState): void {
  // topics we need for main list view
  console.log('Main SSE not needed for now...');
}

/**
 * Starts the worktree SSE connection
 * Listens for thread.created and machine.updated events
 *
 * @param state - Extension state
 * @param config - Larry configuration
 * @param agentKey - Optional agent key (defaults to first agent)
 */
export function startWorktreeSSE(
  state: ExtensionState,
  config: LarryConfig,
  agentKey?: string,
): void {
  const agent = agentKey || Object.keys(config.agents)[0];
  const agentRoute = config.agents[agent];

  const url = `http://localhost:${state.worktreePort}${agentRoute}/events?topics=thread.created,machine.updated`;
  console.log('🚀 Starting worktree SSE connection to:', url);

  // Stop existing connection
  state.sseWorktree?.stop();
  state.sseWorktree = new SSEProxy();

  state.sseWorktree.start(
    url,
    (ev) => {
      console.log('📤 Forwarding worktree SSE event to webview:', ev);
      postMessageToWebview(state, {
        type: 'sse_event',
        baseUrl: `http://localhost:${state.worktreePort}${agentRoute}`,
        event: ev.event || 'message',
        data: ev.data,
      });
    },
    (err) => {
      console.log('❌ Worktree SSE connection failed after all retries:', err);
      postMessageToWebview(state, {
        type: 'sse_error',
        source: 'worktree',
        message: `Connection failed after 3 retries: ${String(err?.message || err)}`,
        retryable: true,
      });
    },
  );
}

/**
 * Stops the worktree SSE connection
 */
export function stopWorktreeSSE(state: ExtensionState): void {
  state.sseWorktree?.stop();
  state.sseWorktree = undefined;
}

/**
 * Starts a Larry stream SSE connection for a specific stream ID
 *
 * @param state - Extension state
 * @param streamId - The stream ID to connect to
 * @param baseUrl - The base URL for the Larry server
 */
export function startLarryStream(
  state: ExtensionState,
  streamId: string,
  baseUrl: string,
): void {
  // Stop existing stream if any
  stopLarryStream(state, streamId);

  const url = `${baseUrl}/larry/${streamId}/events`;
  console.log('🚀 Starting Larry stream SSE connection to:', url);

  const proxy = new SSEProxy();
  state.sseLarryStreams.set(streamId, proxy);

  proxy.start(
    url,
    (ev) => {
      postMessageToWebview(state, {
        type: 'larry_stream_event',
        streamId,
        event: ev.event || 'message',
        data: ev.data,
      });
    },
    (err) => {
      postMessageToWebview(state, {
        type: 'larry_stream_error',
        streamId,
        message: `Connection failed: ${String(err?.message || err)}`,
      });
    },
  );
}

/**
 * Stops a Larry stream SSE connection
 */
export function stopLarryStream(state: ExtensionState, streamId: string): void {
  const proxy = state.sseLarryStreams.get(streamId);
  if (proxy) {
    proxy.stop();
    state.sseLarryStreams.delete(streamId);
  }
}

/**
 * Stops all SSE connections
 */
export function stopAllSSEConnections(state: ExtensionState): void {
  // Stop worktree SSE
  stopWorktreeSSE(state);

  // Stop all Larry streams
  for (const [streamId, proxy] of state.sseLarryStreams) {
    proxy.stop();
  }
  state.sseLarryStreams.clear();
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Posts a message to the webview if it exists
 */
function postMessageToWebview(
  state: ExtensionState,
  message: Record<string, unknown>,
): void {
  state.view?.webview.postMessage(message);
}
