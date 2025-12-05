export type UUID = string;

export type MachineStatus =
  | 'pending'
  | 'running'
  | 'awaiting_human'
  | 'success'
  | 'error'
  | 'canceled';

export interface ThreadListItem {
  id: UUID;
  label: string;
  worktreeName: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export interface ThreadsListResponse {
  items: ThreadListItem[];
  nextCursor: string | null;
  requestId: string;
}

export interface ThreadRawResponse {
  id: UUID;
  appId: string;
  messages: string;
}

export interface ThreadResponse {
  id: UUID;
  appId: string;
  messages: ThreadMessage[];
}

export type ThreadMessage = Record<'user' | 'system', string>;

// Minimal Context representation (opaque bag)
export type Context = Record<string, any> & {
  requestId?: string;
  status?: number;
  machineExecutionId?: string;
  stack?: string[];
  userId?: string;
  solution?: string;
  stateId?: string; // convenient when present
};

export interface MachineResponse {
  id: UUID; // machineId/executionId
  status: MachineStatus;
  currentState: string | undefined;
  // Context scoped to the CURRENT state
  currentStateContext?: Record<string, any>;
  // entire context for the machine
  context?: Context;
}

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  requestId: string;
}

export interface ThreadCreatedEvent {
  type: 'thread.created';
  threadId: UUID;
  machineId: UUID;
  label: string;
  worktreeName: string;
  clientRequestId?: string;
}

export interface MachineUpdatedEvent {
  type: 'machine.updated';
  machine: MachineResponse;
  clientRequestId?: string;
}

export interface LocalWorktree {
  worktreeName: string;
  branch: string;
  path: string;
}

export interface DockerStatus {
  isRunning: boolean;
  containerId?: string;
}

// ============================================================================
// State Component Types
// ============================================================================

export type FetchNextStatePayload = {
  machineId: string;
  contextUpdate: Record<string, any>;
};

export type FetchNextStateFn = (payload: FetchNextStatePayload) => Promise<Response>;

/**
 * Common props passed to all state components in StateVisualization2
 * Each component handles its own approve/reject/feedback logic internally
 */
export interface StateComponentProps<TData = any> {
  /** State-specific data from machine context */
  data: TData;
  /** The state key (e.g., "specReview|abc123") */
  stateKey: string;
  /** Machine execution ID */
  machineId: string;
  /** Function to advance to next state with context update */
  fetchGetNextState: FetchNextStateFn;
  /** Current machine status */
  machineStatus: MachineStatus;
  /** Callback to set working indicator */
  setIsWorking: (working: boolean) => void;
}
