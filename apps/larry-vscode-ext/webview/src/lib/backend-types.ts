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
