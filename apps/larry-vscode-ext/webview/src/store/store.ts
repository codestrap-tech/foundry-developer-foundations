import { makeStore } from './makeStore';
import type { LarryState } from './larry-state';
import type { MachineResponse } from '../lib/backend-types';

/**
 * ExtensionState - Full sidebar store state
 * 
 * Contains LarryState fields (shared with artifact editor)
 * plus sidebar-specific UI state.
 * 
 * See docs.md for architecture details.
 */
export interface ExtensionState {
  // Thread/Worktree state
  currentThreadState:
    | 'idle'
    | 'creating_worktree'
    | 'creating_container'
    | 'setting_up_environment'
    | 'ready'
    | 'error';
  currentWorktreeName: string | undefined;
  currentThreadId: string | undefined;

  // Environment info
  isInWorktree: boolean;
  apiUrl: string;

  agents: Record<string, string>;
  selectedAgent: string;
  workspaceSetupCommand: string[];
  larryEnvPath: string;

  // Artifacts (future expansion)
  currentThreadArtifacts: {
    architectureProposeChangesFileContent?: string;
  };

  // Loading states
  isLoadingWorktreeInfo: boolean;
  isLoadingApp: boolean;

  worktreePort: number;
  mainPort: number;

  // Global working state (set by artifact editor when proceed is clicked)
  isLarryWorking: boolean;

  // Client request ID for tracking requests
  clientRequestId: string;
}

// Action types
export type ExtensionAction =
  | {
      type: 'SET_WORKTREE_DETECTION';
      payload: {
        isInWorktree: boolean;
        currentThreadId?: string;
        worktreeName?: string;
        worktreePort?: number;
        mainPort?: number;
      };
    }
  | {
      type: 'SET_WORKTREE_READY';
      payload: { currentThreadId?: string; worktreeName?: string };
    }
  | { type: 'SET_WORKTREE_SETUP_ERROR' }
  | { type: 'SET_THREAD_STATE'; payload: ExtensionState['currentThreadState'] }
  | { type: 'SET_CURRENT_THREAD_ID'; payload: string | undefined }
  | { type: 'SET_LOADING_WORKTREE_INFO'; payload: boolean }
  | { type: 'SET_LOADING_APP'; payload: boolean }
  | {
      type: 'SET_ARTIFACTS';
      payload: Partial<ExtensionState['currentThreadArtifacts']>;
    }
  | {
      type: 'SET_CONFIG';
      payload: {
        agents: Record<string, string>;
        workspaceSetupCommand: string[];
        larryEnvPath: string;
        worktreePort?: number;
        mainPort?: number;
      };
    }
  | { type: 'SET_SELECTED_AGENT'; payload: string }
  | { type: 'SET_LARRY_WORKING'; payload: boolean }
  | { type: 'RESET_STATE' };

// Initial state
const initialState: ExtensionState = {
  currentThreadState: 'idle',
  currentWorktreeName: undefined,
  currentThreadId: undefined,
  isInWorktree: false,
  apiUrl: '', // Will be set when config is loaded
  agents: {}, // Will be loaded from config
  selectedAgent: '', // Will be set when config is loaded
  workspaceSetupCommand: [],
  larryEnvPath: '',
  worktreePort: 4220,
  mainPort: 4210,
  currentThreadArtifacts: {},
  isLoadingWorktreeInfo: true,
  isLoadingApp: true,
  isLarryWorking: false,
  clientRequestId:
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : 'client-' + Math.random().toString(16).slice(2),
};

// Reducer
function extensionReducer(
  state: ExtensionState,
  action: ExtensionAction
): ExtensionState {
  switch (action.type) {
    case 'SET_WORKTREE_DETECTION':
      const selectedAgentRoute = state.agents[state.selectedAgent] || Object.values(state.agents)[0];
      return {
        ...state,
        isInWorktree: action.payload.isInWorktree,
        currentThreadId: action.payload.currentThreadId,
        currentWorktreeName: action.payload.worktreeName,
        worktreePort: action.payload.worktreePort || state.worktreePort,
        mainPort: action.payload.mainPort || state.mainPort,
        apiUrl: action.payload.isInWorktree
          ? `http://localhost:${action.payload.worktreePort}${selectedAgentRoute}`
          : `http://localhost:${action.payload.mainPort}${selectedAgentRoute}`,
        isLoadingWorktreeInfo: false,
        isLoadingApp: false, // App is ready when worktree detection is complete
      };

    case 'SET_WORKTREE_READY':
      return {
        ...state,
        currentThreadState: 'ready',
        currentThreadId:
          action.payload.currentThreadId || state.currentThreadId,
        currentWorktreeName:
          action.payload.worktreeName || state.currentWorktreeName,
      };

    case 'SET_WORKTREE_SETUP_ERROR':
      return {
        ...state,
        currentThreadState: 'error',
      };

    case 'SET_THREAD_STATE':
      return {
        ...state,
        currentThreadState: action.payload,
      };

    case 'SET_CURRENT_THREAD_ID':
      return {
        ...state,
        currentThreadId: action.payload,
      };

    case 'SET_LOADING_WORKTREE_INFO':
      return {
        ...state,
        isLoadingWorktreeInfo: action.payload,
      };

    case 'SET_LOADING_APP':
      return {
        ...state,
        isLoadingApp: action.payload,
      };

    case 'SET_ARTIFACTS':
      return {
        ...state,
        currentThreadArtifacts: {
          ...state.currentThreadArtifacts,
          ...action.payload,
        },
      };

    case 'SET_CONFIG':
      const firstAgentKey = Object.keys(action.payload.agents)[0] || 'google';
      const firstAgentRoute = action.payload.agents[firstAgentKey];
      return {
        ...state,
        agents: action.payload.agents,
        selectedAgent: firstAgentKey,
        workspaceSetupCommand: action.payload.workspaceSetupCommand,
        larryEnvPath: action.payload.larryEnvPath,
        apiUrl: state.isInWorktree
          ? `http://localhost:${action.payload.worktreePort}${firstAgentRoute}`
          : `http://localhost:${action.payload.mainPort}${firstAgentRoute}`,
      };

    case 'SET_SELECTED_AGENT':
      const agentRoute = state.agents[action.payload];
      if (!agentRoute) {
        console.warn(`Agent ${action.payload} not found in config`);
        return state;
      }
      return {
        ...state,
        selectedAgent: action.payload,
        apiUrl: state.isInWorktree
          ? `http://localhost:${state.worktreePort}${agentRoute}`
          : `http://localhost:${state.mainPort}${agentRoute}`,
      };

    case 'SET_LARRY_WORKING':
      return {
        ...state,
        isLarryWorking: action.payload,
      };

    case 'RESET_STATE':
      return {
        ...initialState,
        clientRequestId: state.clientRequestId, // Keep the same client request ID
        agents: state.agents,
        selectedAgent: state.selectedAgent,
        workspaceSetupCommand: state.workspaceSetupCommand,
        larryEnvPath: state.larryEnvPath,
      };

    default:
      return state;
  }
}

const [ExtensionStoreProvider, useExtensionDispatch, useExtensionStore] =
  makeStore(initialState, extensionReducer);

export { ExtensionStoreProvider, useExtensionDispatch, useExtensionStore };

/**
 * Extract LarryState from the full ExtensionState
 * Used by LarryStateSync to sync shared state to extension
 */
export function extractLarryStateFromStore(
  state: ExtensionState,
  machineData?: MachineResponse
): LarryState {
  return {
    currentThreadId: state.currentThreadId,
    apiUrl: state.apiUrl,
    machineData,
    isInWorktree: state.isInWorktree,
    worktreePort: state.worktreePort,
    mainPort: state.mainPort,
    agents: state.agents,
    selectedAgent: state.selectedAgent,
  };
}

// Re-export LarryState type for convenience
export type { LarryState } from './larry-state';
