import { makeStore } from './makeStore';

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

  // Artifacts (future expansion)
  currentThreadArtifacts: {
    architectureProposeChangesFileContent?: string;
  };

  // Loading states
  isLoadingWorktreeInfo: boolean;
  isLoadingApp: boolean;

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
  | { type: 'RESET_STATE' };

// Initial state
const initialState: ExtensionState = {
  currentThreadState: 'idle',
  currentWorktreeName: undefined,
  currentThreadId: undefined,
  isInWorktree: false,
  apiUrl: 'http://localhost:4210/larry/agents/google/v1', // Default to main repo URL
  currentThreadArtifacts: {},
  isLoadingWorktreeInfo: true,
  isLoadingApp: true,
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
      return {
        ...state,
        isInWorktree: action.payload.isInWorktree,
        currentThreadId: action.payload.currentThreadId,
        currentWorktreeName: action.payload.worktreeName,
        apiUrl: action.payload.isInWorktree
          ? 'http://localhost:4220/larry/agents/google/v1'
          : 'http://localhost:4210/larry/agents/google/v1',
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

    case 'RESET_STATE':
      return {
        ...initialState,
        clientRequestId: state.clientRequestId, // Keep the same client request ID
      };

    default:
      return state;
  }
}

const [ExtensionStoreProvider, useExtensionDispatch, useExtensionStore] =
  makeStore(initialState, extensionReducer);

export { ExtensionStoreProvider, useExtensionDispatch, useExtensionStore };
