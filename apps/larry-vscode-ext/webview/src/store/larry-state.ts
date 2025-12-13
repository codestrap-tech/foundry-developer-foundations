import type { MachineResponse } from '../lib/backend-types';

/**
 * LarryState - Shared state between extension and webviews
 *
 * This is the authoritative state for the Larry workflow:
 * - Sidebar webview: PRIMARY - holds and updates this state
 * - Extension (Node.js): CACHE - stores for artifact editors
 * - Artifact editor: CONSUMER - receives via messages
 *
 * See docs.md for communication architecture details.
 */
export interface LarryState {
  // Thread/Machine context
  currentThreadId: string | undefined;
  apiUrl: string;

  // Current machine data (from SSE/API)
  machineData: MachineResponse | undefined;

  // Environment
  isInWorktree: boolean;
  worktreePort: number;
  mainPort: number;

  // Config
  agents: Record<string, string>;
  selectedAgent: string;
}

/**
 * Creates an empty/initial LarryState
 */
export function createInitialLarryState(): LarryState {
  return {
    currentThreadId: undefined,
    apiUrl: '',
    machineData: undefined,
    isInWorktree: false,
    worktreePort: 4220,
    mainPort: 4210,
    agents: {},
    selectedAgent: '',
  };
}

/**
 * Extracts LarryState from the full extension store state
 */
export function extractLarryState(
  storeState: {
    currentThreadId?: string;
    apiUrl: string;
    isInWorktree: boolean;
    worktreePort: number;
    mainPort: number;
    agents: Record<string, string>;
    selectedAgent: string;
  },
  machineData?: MachineResponse,
): LarryState {
  return {
    currentThreadId: storeState.currentThreadId,
    apiUrl: storeState.apiUrl,
    machineData,
    isInWorktree: storeState.isInWorktree,
    worktreePort: storeState.worktreePort,
    mainPort: storeState.mainPort,
    agents: storeState.agents,
    selectedAgent: storeState.selectedAgent,
  };
}
