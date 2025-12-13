// ===== Serializable State Machine Types =====
export type Transition = {
  on: string; // "CONTINUE" | "ERROR"
  target: string; // state id
  parallel?: boolean; // only true for BU batch fan-outs
};

export type SMState =
  | {
      id: string;
      task: string;
      includesLogic: boolean;
      transitions: Transition[];
    }
  | { id: string; type: 'final' };

// ===== Inputs from prior steps =====
export type NodeID = string;

export interface NodeSpec {
  id: NodeID;
  task: string; // original planner task
  agentVersion: string;
  sideEffect: 'pure' | 'idempotent' | 'effectful';
  ttlMs: number;
  deps: NodeID[];
  inputKey: string;
}

export interface Graph {
  edges: Record<NodeID, NodeID[]>;
  rev: Record<NodeID, NodeID[]>;
  nodes: Record<NodeID, NodeSpec>;
  sinks: NodeID[];
}

export interface BURegion {
  id: string; // e.g., "bu_1"
  batches: NodeID[][]; // ready inputs; each inner array is parallelizable
  joins: NodeID[]; // informational
}

export interface TDChain {
  id: string; // e.g., "td_1"
  path: NodeID[]; // ordered serial path
}

export interface PartitionResult {
  buRegions: BURegion[];
  tdChains: TDChain[];
}

// ===== Builder with NO scheduler and correct parallel flags =====
export function buildStateMachineWithTasks_NoScheduler(
  graph: Graph,
  partition: PartitionResult,
): SMState[] {
  const states: SMState[] = [];
  const successId = 'success';
  const failureId = 'failure';

  const execId = (nid: string) => `exec_${nid}`;
  const buBatchStartId = (rid: string, idx: number) =>
    `bu_${rid}_batch_${idx}_start`;
  const buBatchJoinId = (rid: string, idx: number) =>
    `bu_${rid}_batch_${idx}_join`;

  // ---- Top-Down chains (strictly serial; no parallel flags) ----
  for (const chain of partition.tdChains) {
    if (chain.path.length === 0) continue;

    chain.path.forEach((nid, i) => {
      const node = graph.nodes[nid];
      const isLast = i === chain.path.length - 1;

      states.push({
        id: execId(nid),
        includesLogic: true,
        task: node.task, // original planner task
        transitions: [
          {
            on: 'CONTINUE',
            target: isLast ? successId : execId(chain.path[i + 1]),
          },
          { on: 'ERROR', target: failureId },
        ],
      });
    });
  }

  // ---- Bottom-Up regions (batches with parallel fan-out + join) ----
  for (const region of partition.buRegions) {
    region.batches.forEach((batchNodes, idx) => {
      const batchNo = idx + 1;
      const startId = buBatchStartId(region.id, batchNo);
      const joinId = buBatchJoinId(region.id, batchNo);
      const isLastBatch = batchNo === region.batches.length;

      // Start state: ONLY place where parallel: true is set (inputs are ready by definition of BU)
      states.push({
        id: startId,
        includesLogic: true,
        task: `Bottom-Up ${region.id}: run batch #${batchNo} in parallel (inputs ready).`,
        transitions: [
          ...batchNodes.map((nid) => ({
            on: 'CONTINUE',
            target: execId(nid),
            parallel: true, // ✅ ONLY here
          })),
          ...(batchNodes.length === 0
            ? [{ on: 'CONTINUE', target: joinId }]
            : []),
          { on: 'ERROR', target: failureId },
        ],
      });

      // Each node in the batch runs its original task and flows to the join
      for (const nid of batchNodes) {
        const node = graph.nodes[nid];
        states.push({
          id: execId(nid),
          includesLogic: true,
          task: node.task,
          transitions: [
            { on: 'CONTINUE', target: joinId },
            { on: 'ERROR', target: failureId },
          ],
        });
      }

      // Join for the batch; proceed to next batch or success
      states.push({
        id: joinId,
        includesLogic: true,
        task: `Bottom-Up ${region.id}: join for batch #${batchNo} (wait for all).`,
        transitions: [
          {
            on: 'CONTINUE',
            target: isLastBatch
              ? successId
              : buBatchStartId(region.id, batchNo + 1),
          },
          { on: 'ERROR', target: failureId },
        ],
      });
    });

    // If a region has zero batches, it is already satisfied; nothing to emit.
  }

  // Final states
  states.push({ id: successId, type: 'final' });
  states.push({ id: failureId, type: 'final' });

  return states;
}
