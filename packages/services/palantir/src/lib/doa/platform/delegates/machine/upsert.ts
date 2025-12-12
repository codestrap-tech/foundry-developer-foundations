import type { MachineExecutions } from '@codestrap/developer-foundations-types';
import { FoundryClient } from '@codestrap/developer-foundations-types';

// Per-id queue state
type UpsertArgs = {
  id: string;
  stateMachine: string;
  state: string;
  logs: string;
  token: string;
  ontologyRid: string;
  url: string;
  lockOwner?: string;
  lockUntil?: number;
};

type QueueState = {
  inFlight: Promise<MachineExecutions> | null;
  // Keep only the latest queued call's args
  queued: UpsertArgs | null;
  // When callers arrive while work is ongoing, they await this "done" promise
  // which resolves to the result of the final execution in the drain cycle.
  waiters: Array<(value: MachineExecutions) => void>;
  errorWaiters: Array<(err: any) => void>;
};

const queues = new Map<string, QueueState>();

async function doNetworkUpsert(args: UpsertArgs): Promise<MachineExecutions> {
  const {
    id,
    stateMachine,
    state,
    logs,
    token,
    ontologyRid,
    url,
    lockOwner,
    lockUntil,
  } = args;

  console.log(`upsertMachineExecution machineId: ${id}`);

  const fullUrl = `${url}/api/v2/ontologies/${ontologyRid}/actions/upsert-machine/apply`;

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const body = JSON.stringify({
    parameters: { id, stateMachine, state, logs, lockOwner, lockUntil },
    options: { returnEdits: 'ALL' },
  });

  const apiResult = await fetch(fullUrl, { method: 'POST', headers, body });

  if (!apiResult.ok) {
    throw new Error(
      `Upsert failed: ${apiResult.status} ${apiResult.statusText}`,
    );
  }

  // (Optional) Backoff on 409/423 if the store signals "busy/locked".
  // if (apiResult.status === 409 || apiResult.status === 423) { ...retry with jitter... }

  const result = (await apiResult.json()) as any;

  if (!result.edits || result.edits.edits.length === 0) {
    throw new Error(
      `Failed to upsert machine message to the ontology with: ${JSON.stringify(result)}`,
    );
  }

  console.log(`upsert machine action returned: ${result?.edits?.edits?.[0]}`);

  const machineId = result.edits.edits[0].primaryKey as string;

  if (!machineId) {
    throw new Error(`Upsert failed: response missing primaryKey machineId`);
  }

  const getUrl = `${url}/api/v2/ontologies/${ontologyRid}/objects/MachineExecutions/${machineId}`;
  const machineFetchResults = await fetch(getUrl, { method: 'GET', headers });

  if (!machineFetchResults.ok) {
    throw new Error(
      `Fetch machine failed: ${machineFetchResults.status} ${machineFetchResults.statusText}`,
    );
  }

  const machine = (await machineFetchResults.json()) as MachineExecutions;
  return machine;
}

function tryDeleteQueue(id: string) {
  const q = queues.get(id);
  if (
    q &&
    !q.inFlight &&
    !q.queued &&
    q.waiters.length === 0 &&
    q.errorWaiters.length === 0
  ) {
    queues.delete(id); // <-- remove from the Map
  }
}

async function drainQueueForId(id: string): Promise<MachineExecutions> {
  const q = queues.get(id);
  if (!q) {
    throw new Error(`Queue missing for id=${id}`);
  }

  let lastResult: MachineExecutions | undefined;

  try {
    while (true) {
      if (!q.inFlight && q.queued) {
        const runArgs = q.queued;
        q.queued = null; // consume queued args
        q.inFlight = doNetworkUpsert(runArgs) as Promise<MachineExecutions>;
      }

      if (!q.inFlight) break;

      lastResult = await q.inFlight;
      q.inFlight = null;

      if (q.queued) {
        // another call arrived while inFlight; loop again
        continue;
      } else {
        // resolve & clear waiters
        const waiters = q.waiters.splice(0);
        q.errorWaiters.length = 0;
        waiters.forEach((res) => res(lastResult!));
        break;
      }
    }

    if (lastResult === undefined) {
      throw new Error(`Drain completed with no work for id=${id}`);
    }

    return lastResult!;
  } catch (err) {
    // reject & clear waiters
    const errs = q.errorWaiters.splice(0);
    q.waiters.length = 0;
    // use a for loop with try catch in case the reject handler throws
    for (const reject of errs) {
      try {
        reject(err);
      } catch {
        /* swallow */
      }
    }
    throw err;
  } finally {
    // final check in case state changed between above branches
    tryDeleteQueue(id);
  }
}

/**
 * Public API (signature unchanged).
 * Guarantees: per-id serialization, last-write-wins conflation, no parallel requests.
 */
export function upsertMachineExecution(
  id: string,
  stateMachine: string,
  state: string,
  logs: string,
  token: string,
  ontologyRid: string,
  url: string,
  lockOwner?: string,
  lockUntil?: number,
): Promise<MachineExecutions> {
  const args: UpsertArgs = {
    id,
    stateMachine,
    state,
    logs,
    token,
    ontologyRid,
    url,
    lockOwner,
    lockUntil,
  };

  // Get or create queue for this id
  let q = queues.get(id);
  if (!q) {
    q = { inFlight: null, queued: null, waiters: [], errorWaiters: [] };
    queues.set(id, q);
  }

  // If nothing is running and nothing is queued, start immediately.
  if (!q.inFlight && !q.queued) {
    // Schedule a run by setting queued and inFlight, then drain.
    q.queued = args;

    // Every caller returns a promise that resolves with the *final* result of this drain.
    return new Promise<MachineExecutions>((resolve, reject) => {
      q!.waiters.push(resolve);
      q!.errorWaiters.push(reject);
      // Kick off the drain (fire and forget).
      drainQueueForId(id).catch((err) => {
        // drainQueueForId already rejects waiters, but guard anyway
        const errors = q!.errorWaiters.splice(0);
        errors.forEach((rej) => rej(err));
      });
    });
  }

  // If a run is in progress, conflate to "latest" by overwriting queued args.
  q.queued = args;

  // Return a promise that resolves when the current drain finishes.
  return new Promise<MachineExecutions>((resolve, reject) => {
    q!.waiters.push(resolve);
    q!.errorWaiters.push(reject);
    // If nothing is actively draining (possible if only inFlight is set manually), ensure draining
    if (!q!.inFlight) {
      drainQueueForId(id).catch((err) => {
        const errors = q!.errorWaiters.splice(0);
        errors.forEach((rej) => rej(err));
      });
    }
  });
}
