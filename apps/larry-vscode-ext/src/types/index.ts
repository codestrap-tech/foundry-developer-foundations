import type * as vscode from 'vscode';
import type { SSEProxy } from '../sse/sse-proxy';

// ============================================================================
// Configuration Types
// ============================================================================

export interface LarryConfig {
  name: string;
  agents: Record<string, string>;
  workspaceSetupCommand: string[];
  larryEnvPath: string;
}

// ============================================================================
// Larry State (Shared between extension and webviews)
// ============================================================================

/**
 * LarryState - Cached state from sidebar webview
 *
 * This mirrors the LarryState type in webview/src/store/larry-state.ts
 * Extension caches this to provide to artifact editors.
 *
 * See webview/src/store/docs.md for communication architecture.
 */
export interface LarryState {
  currentThreadId: string | undefined;
  apiUrl: string;
  machineData: unknown; // MachineResponse from webview types
  isInWorktree: boolean;
  worktreePort: number;
  mainPort: number;
  agents: Record<string, string>;
  selectedAgent: string;
}

// ============================================================================
// Extension State
// ============================================================================

/**
 * Shared state across the extension - passed to functions instead of using `this`
 */
export interface ExtensionState {
  config: LarryConfig | undefined;
  configLoaded: Promise<void>;

  // Docker state
  runningContainers: Map<string, string>; // worktreeName -> containerId
  mainDockerContainer: string | undefined;

  // SSE state
  sseWorktree: SSEProxy | undefined;
  sseLarryStreams: Map<string, SSEProxy>;

  // Webview
  view: vscode.WebviewView | undefined;

  // Ports
  mainPort: number;
  worktreePort: number;

  // Shared Larry state (cached from sidebar webview)
  larryState: LarryState | undefined;

  // Dehydrated React Query cache (JSON string, from sidebar)
  queryCache: string | undefined;

  // Active artifact editor panels (for broadcasting state updates)
  artifactEditorPanels: Set<vscode.WebviewPanel>;
}

// ============================================================================
// Docker Types
// ============================================================================

export interface DockerContainerInfo {
  id: string;
  name: string;
  isRunning: boolean;
  port: number;
}

// ============================================================================
// Worktree Types
// ============================================================================

export interface WorktreeInfo {
  worktreeName: string;
  branch: string;
  path: string;
}

export interface WorktreeDetectionResult {
  isInWorktree: boolean;
  worktreeId: string;
  currentThreadId?: string;
}

// ============================================================================
// SSE Types
// ============================================================================

export interface SSEEvent {
  event?: string;
  data: string;
}

// ============================================================================
// Webview Message Types
// ============================================================================

export type WebviewMessageType =
  | 'reload_extension'
  | 'open_worktree'
  | 'getCurrentWorktree'
  | 'openFile'
  | 'saveThreadId'
  | 'readThreadIds'
  | 'getConfig'
  | 'start_larry_stream'
  | 'stop_larry_stream'
  | 'readFile'
  | 'list_local_worktrees'
  | 'get_docker_status'
  | 'start_docker_container'
  | 'stop_docker_container'
  | 'delete_worktree'
  // State sync messages (sidebar → extension → artifact editor)
  | 'larry_state_sync'
  | 'query_cache_sync'
  | 'proceed_complete';

export interface WebviewMessage {
  type: WebviewMessageType;
  [key: string]: unknown;
}

// ============================================================================
// Constants
// ============================================================================

export const DEFAULT_MAIN_PORT = 4210;
export const DEFAULT_WORKTREE_PORT = 4220;
export const PORT_RANGE = 100;
