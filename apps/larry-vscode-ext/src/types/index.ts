import * as vscode from 'vscode';
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
}

/**
 * Creates initial extension state
 */
export function createExtensionState(): ExtensionState {
  return {
    config: undefined,
    configLoaded: Promise.resolve(),
    runningContainers: new Map(),
    mainDockerContainer: undefined,
    sseWorktree: undefined,
    sseLarryStreams: new Map(),
    view: undefined,
    mainPort: 4210,
    worktreePort: 4220,
  };
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
  | 'delete_worktree';

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

