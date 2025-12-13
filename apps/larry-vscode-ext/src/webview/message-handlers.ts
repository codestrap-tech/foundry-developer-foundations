import * as vscode from 'vscode';
import type { ExtensionState, LarryState } from '../types';
import {
  openFile,
  readFileContent,
  writeCurrentThreadId,
  readCurrentThreadId,
  getWorktreePath,
} from '../workspace/files';
import { listLocalWorktrees, removeWorktree } from '../workspace/git';
import {
  handleOpenWorktree,
  notifyWorktreeChange,
} from '../workspace/worktree';
import {
  getWorktreeContainerStatus,
  startWorktreeDockerContainer,
  stopWorktreeDockerContainer,
  removeWorktreeDockerContainer,
} from '../docker/server-management';
import {
  startLarryStream,
  stopLarryStream,
  startWorktreeSSE,
  stopWorktreeSSE,
} from '../sse/sse-streams';

// ============================================================================
// Message Handler Type
// ============================================================================

type MessageHandler = (
  state: ExtensionState,
  msg: Record<string, unknown>,
  view: vscode.WebviewView,
) => Promise<void>;

// ============================================================================
// Individual Message Handlers
// ============================================================================

const handleReloadExtension: MessageHandler = async () => {
  console.log('🔄 Reloading extension...');
  await vscode.commands.executeCommand('workbench.action.reloadWindow');
};

const handleOpenWorktreeMsg: MessageHandler = async (state, msg) => {
  await handleOpenWorktree(
    state,
    (msg.worktreeName as string) || '',
    (msg.threadId as string) || undefined,
    msg.label as string,
    (msg.agentKey as string) || undefined,
  );
};

const handleGetCurrentWorktree: MessageHandler = async (state) => {
  await notifyWorktreeChange(state);
};

const handleOpenFile: MessageHandler = async (_state, msg) => {
  await openFile(msg.file as string);
};

const handleSaveThreadId: MessageHandler = async (state, msg, view) => {
  const worktreeName = msg.worktreeName as string;
  const threadId = msg.threadId as string;

  await writeCurrentThreadId(worktreeName, threadId);
  const threadIds = await readCurrentThreadId(worktreeName);

  view.webview.postMessage({
    type: 'threadIds',
    worktreeName,
    threadIds,
  });
  view.webview.postMessage({
    type: 'threadIdSaved',
    worktreeName,
    threadId,
  });
};

const handleReadThreadIds: MessageHandler = async (_state, msg, view) => {
  const worktreeName = msg.worktreeName as string;
  const threadIds = await readCurrentThreadId(worktreeName);

  view.webview.postMessage({
    type: 'threadIds',
    worktreeName,
    threadIds,
  });
};

const handleGetConfig: MessageHandler = async (state, _msg, view) => {
  view.webview.postMessage({
    type: 'config_loaded',
    config: state.config,
    worktreePort: state.worktreePort,
    mainPort: state.mainPort,
  });
};

const handleStartLarryStream: MessageHandler = async (state, msg) => {
  startLarryStream(state, msg.streamId as string, msg.baseUrl as string);
};

const handleStopLarryStream: MessageHandler = async (state, msg) => {
  stopLarryStream(state, msg.streamId as string);
};

const handleReadFile: MessageHandler = async (_state, msg, view) => {
  const filePath = msg.filePath as string;
  const content = await readFileContent(filePath);

  view.webview.postMessage({
    type: 'fileContent',
    filePath,
    content,
  });
};

const handleListLocalWorktrees: MessageHandler = async (_state, _msg, view) => {
  try {
    const worktrees = await listLocalWorktrees();

    view.webview.postMessage({
      type: 'local_worktrees_response',
      worktrees,
    });
  } catch (error) {
    console.error('Error listing local worktrees:', error);
    view.webview.postMessage({
      type: 'local_worktrees_response',
      worktrees: [],
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

const handleGetDockerStatus: MessageHandler = async (state, msg, view) => {
  const worktreeName = msg.worktreeName as string;

  try {
    const status = await getWorktreeContainerStatus(
      state.config?.name,
      worktreeName,
    );

    view.webview.postMessage({
      type: 'docker_status_response',
      worktreeName,
      isRunning: status.isRunning,
      containerId: status.containerId,
    });
  } catch (error) {
    view.webview.postMessage({
      type: 'docker_status_response',
      worktreeName,
      isRunning: false,
      containerId: undefined,
    });
  }
};

const handleStartDockerContainer: MessageHandler = async (state, msg, view) => {
  const worktreeName = msg.worktreeName as string;

  try {
    const worktreePath = getWorktreePath(worktreeName);
    if (!worktreePath) {
      throw new Error('Worktree path not found');
    }

    await startWorktreeDockerContainer(
      state,
      worktreeName,
      worktreePath,
      undefined,
    );

    view.webview.postMessage({
      type: 'docker_action_complete',
      action: 'start',
      worktreeName,
      success: true,
    });

    // Start SSE connection - SSEProxy has built-in retry logic (10 retries, 2s delay)
    // so it will keep trying until the container is ready
    if (state.config) {
      console.log(
        '🔌 Starting SSE connection (will retry until container is ready)...',
      );
      startWorktreeSSE(state, state.config);
    }
  } catch (error) {
    console.error('Error starting docker container:', error);
    view.webview.postMessage({
      type: 'docker_action_complete',
      action: 'start',
      worktreeName,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

const handleStopDockerContainer: MessageHandler = async (state, msg, view) => {
  const worktreeName = msg.worktreeName as string;

  try {
    // Stop SSE connection first
    console.log('🔌 Stopping SSE connection before stopping container...');
    stopWorktreeSSE(state);

    await stopWorktreeDockerContainer(state, worktreeName);

    view.webview.postMessage({
      type: 'docker_action_complete',
      action: 'stop',
      worktreeName,
      success: true,
    });
  } catch (error) {
    console.error('Error stopping docker container:', error);
    view.webview.postMessage({
      type: 'docker_action_complete',
      action: 'stop',
      worktreeName,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

const handleDeleteWorktree: MessageHandler = async (state, msg, view) => {
  const worktreeName = msg.worktreeName as string;

  try {
    // Stop SSE connection first
    console.log('🔌 Stopping SSE connection before deleting worktree...');
    stopWorktreeSSE(state);

    // Remove Docker container
    await removeWorktreeDockerContainer(state.config?.name, worktreeName);

    // Remove git worktree
    await removeWorktree(worktreeName);

    view.webview.postMessage({
      type: 'worktree_deleted',
      worktreeName,
      success: true,
    });
  } catch (error) {
    console.error('Error deleting worktree:', error);
    view.webview.postMessage({
      type: 'worktree_deleted',
      worktreeName,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

// ============================================================================
// State Sync Handlers (Sidebar → Extension → Artifact Editors)
// ============================================================================

/**
 * Handle LarryState sync from sidebar
 * Caches state and broadcasts to all artifact editors
 */
const handleLarryStateSync: MessageHandler = async (state, msg) => {
  const larryState = msg.larryState as LarryState;

  // Cache the state
  state.larryState = larryState;

  // Broadcast to all artifact editors
  state.artifactEditorPanels?.forEach((panel) => {
    panel.webview.postMessage({
      type: 'larry_state_update',
      larryState,
    });
  });
};

/**
 * Handle query cache sync from sidebar
 * Caches dehydrated state and broadcasts to all artifact editors
 */
const handleQueryCacheSync: MessageHandler = async (state, msg) => {
  const queryCache = msg.queryCache as string;

  // Cache the dehydrated query state
  state.queryCache = queryCache;

  // Broadcast to all artifact editors
  state.artifactEditorPanels?.forEach((panel) => {
    panel.webview.postMessage({
      type: 'query_cache_hydrate',
      queryCache,
    });
  });
};

/**
 * Handle proceed complete from artifact editor
 * Notifies sidebar to refetch machine data
 */
const handleProceedComplete: MessageHandler = async (state) => {
  // Notify sidebar to refetch machine data
  state.view?.webview.postMessage({
    type: 'refetch_machine',
  });
};

// ============================================================================
// Message Handler Registry
// ============================================================================

const messageHandlers: Record<string, MessageHandler> = {
  reload_extension: handleReloadExtension,
  open_worktree: handleOpenWorktreeMsg,
  getCurrentWorktree: handleGetCurrentWorktree,
  openFile: handleOpenFile,
  saveThreadId: handleSaveThreadId,
  readThreadIds: handleReadThreadIds,
  getConfig: handleGetConfig,
  start_larry_stream: handleStartLarryStream,
  stop_larry_stream: handleStopLarryStream,
  readFile: handleReadFile,
  list_local_worktrees: handleListLocalWorktrees,
  get_docker_status: handleGetDockerStatus,
  start_docker_container: handleStartDockerContainer,
  stop_docker_container: handleStopDockerContainer,
  delete_worktree: handleDeleteWorktree,
  // State sync handlers (sidebar ↔ artifact editors)
  larry_state_sync: handleLarryStateSync,
  query_cache_sync: handleQueryCacheSync,
  proceed_complete: handleProceedComplete,
};

// ============================================================================
// Main Message Router
// ============================================================================

/**
 * Routes incoming webview messages to appropriate handlers
 */
export async function handleWebviewMessage(
  state: ExtensionState,
  msg: Record<string, unknown>,
  view: vscode.WebviewView,
): Promise<void> {
  const messageType = msg?.type as string;

  if (!messageType) {
    console.warn('Received message without type:', msg);
    return;
  }

  const handler = messageHandlers[messageType];

  if (handler) {
    try {
      await handler(state, msg, view);
    } catch (error) {
      console.error(`Error handling message type "${messageType}":`, error);
    }
  } else {
    console.warn(`Unknown message type: ${messageType}`);
  }
}
