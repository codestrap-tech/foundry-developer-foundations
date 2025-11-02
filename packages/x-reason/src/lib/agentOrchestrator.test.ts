// __tests__/buildStateMachineWithTasks_NoScheduler.test.ts
import {
  buildStateMachineWithTasks_NoScheduler,
  type Graph,
  type PartitionResult,
  type SMState,
} from "./agentOrchestrator"; // adjust path as needed

type ExecState = Extract<SMState, { id: string; task: string; includesLogic: boolean }>;
type FinalState = Extract<SMState, { type: "final" }>;

function byId(states: SMState[], id: string) {
  const s = states.find((x) => "id" in x && x.id === id);
  if (!s) throw new Error(`State ${id} not found`);
  return s as ExecState | FinalState;
}

function getExec(states: SMState[], id: string) {
  const s = byId(states, id);
  if (!("task" in s)) throw new Error(`State ${id} is not an exec state`);
  return s as ExecState;
}

describe("buildStateMachineWithTasks_NoScheduler", () => {
  test("Top-Down chain preserves original planner tasks and serial wiring (no parallel flags)", () => {
    // Synthetic tasks from the user’s planning stage
    const tasks = {
      confirmUserIntent:
        "Ask clarifying questions to the software engineer to get a well defined software specification. Be sure to detail what email system and APIs you are using, the SDK to use, and what type of files are to be attached, and if they are linked in online storage or local or both. If the user has answered all relevant questions AND the software specification is acceptable, proceed to the Search Documentation step. If not renter the Clarify Design with User state.",
      specReview:
        "**Review Design Specification** - Human reviews the generated design specification. If approved, continue, else  if review is required, renter the review design specification state.",
      architectImplementation:
        "Using the output of the previous states architect the final design specification. If the user approves the spec continue, otherwise try again taking into account the feedback from the user.",
      architectureReview:
        "**Review Architecture Specification** - If approved, continue, else if review is required, renter the review architecture specification state.",
      generateEditMachine:
        "Using the output from the Architect Implementation state, generate the edits to apply. If the user approves the edits move on, else renter generate edits.",
      codeReview:
        "Human reviews the generated edits machine. If approved, continue, else renter the review edits state.",
      applyEdits:
        "Using the output from the Generate Edits state, apply the edits.",
    };

    // Linear TD chain: confirmUserIntent → specReview → architectImplementation → architectureReview → generateEditMachine → codeReview → applyEdits
    const nodeOrder = [
      "confirmUserIntent",
      "specReview",
      "architectImplementation",
      "architectureReview",
      "generateEditMachine",
      "codeReview",
      "applyEdits",
    ] as const;

    const nodes = Object.fromEntries(
      nodeOrder.map((id, i) => [
        id,
        {
          id,
          task: (tasks as any)[id],
          agentVersion: "1",
          sideEffect: "pure" as const,
          ttlMs: 3_600_000,
          deps: i === 0 ? [] : [nodeOrder[i - 1]],
          inputKey: `${id}_in`,
        },
      ])
    );

    const edges = Object.fromEntries(
      nodeOrder.map((id, i) => [id, i < nodeOrder.length - 1 ? [nodeOrder[i + 1]] : []])
    );
    const rev = Object.fromEntries(
      nodeOrder.map((id, i) => [id, i === 0 ? [] : [nodeOrder[i - 1]]])
    );

    const graph: Graph = {
      nodes: nodes as any,
      edges: edges as Record<string, string[]>,
      rev: rev as Record<string, string[]>,
      sinks: ["applyEdits"],
    };

    // Partition: one TD chain with the full path; no BU regions
    const partition: PartitionResult = {
      buRegions: [],
      tdChains: [{ id: "td_chain_1", path: [...nodeOrder] as unknown as string[] }],
    };

    const sm = buildStateMachineWithTasks_NoScheduler(graph, partition);

    // Final states exist
    expect(byId(sm, "success")).toBeTruthy();
    expect(byId(sm, "failure")).toBeTruthy();

    // Each node becomes an exec_<id> state with the exact original task text
    nodeOrder.forEach((nid) => {
      const st = getExec(sm, `exec_${nid}`);
      expect(st.task).toBe((tasks as any)[nid]);
      // No parallel flag in TD chain transitions
      st.transitions.forEach((t) => {
        expect(t.on === "CONTINUE" || t.on === "ERROR").toBe(true);
        expect(t.parallel).toBeUndefined();
      });
    });

    // Wiring: each exec state CONTINUE → next exec (last goes to success)
    nodeOrder.forEach((nid, i) => {
      const st = getExec(sm, `exec_${nid}`);
      const cont = st.transitions.find((t) => t.on === "CONTINUE");
      expect(cont).toBeTruthy();
      const expectedTarget =
        i < nodeOrder.length - 1 ? `exec_${nodeOrder[i + 1]}` : "success";
      expect(cont!.target).toBe(expectedTarget);
    });
  });

  test("Bottom-Up region expands to parallel batch fan-out with joins and preserves tasks", () => {
    // BU example: A is already computed (not part of BU), region has two batches:
    // Batch 1: B, C (parallel)    Batch 2: D (after join)
    const graph = {
      nodes: {
        A: {
          id: "A",
          task: "Seed input is ready (not executed here).",
          agentVersion: "1",
          sideEffect: "pure" as const,
          ttlMs: 3_600_000,
          deps: [],
          inputKey: "A_in",
        },
        B: {
          id: "B",
          task: "Do B work.",
          agentVersion: "1",
          sideEffect: "pure" as const,
          ttlMs: 3_600_000,
          deps: ["A"],
          inputKey: "B_in",
        },
        C: {
          id: "C",
          task: "Do C work.",
          agentVersion: "1",
          sideEffect: "pure" as const,
          ttlMs: 3_600_000,
          deps: ["A"],
          inputKey: "C_in",
        },
        D: {
          id: "D",
          task: "Aggregate B & C.",
          agentVersion: "1",
          sideEffect: "idempotent" as const,
          ttlMs: 3_600_000,
          deps: ["B", "C"],
          inputKey: "D_in",
        },
      },
      edges: { A: ["B", "C"], B: ["D"], C: ["D"], D: [] },
      rev: { A: [], B: ["A"], C: ["A"], D: ["B", "C"] },
      sinks: ["D"],
    } satisfies Graph;

    const partition: PartitionResult = {
      buRegions: [
        {
          id: "bu_1",
          batches: [
            ["B", "C"], // ready from A's output
            ["D"], // runs after join of B,C
          ],
          joins: ["D"],
        },
      ],
      tdChains: [],
    };

    const sm = buildStateMachineWithTasks_NoScheduler(graph, partition);

    // Check batch 1 fan-out uses parallel: true
    const batch1Start = getExec(sm, "bu_bu_1_batch_1_start");
    const fanouts = batch1Start.transitions.filter((t) => t.on === "CONTINUE");
    const fanTargets = fanouts.map((t) => ({ target: t.target, parallel: t.parallel }));
    expect(fanTargets).toEqual(
      expect.arrayContaining([
        { target: "exec_B", parallel: true },
        { target: "exec_C", parallel: true },
      ])
    );
    // No extra non-parallel fan-out in BU start
    expect(fanTargets.every((f) => f.parallel === true)).toBe(true);

    // B and C exec states exist, preserve tasks, and go to join
    const execB = getExec(sm, "exec_B");
    const execC = getExec(sm, "exec_C");
    expect(execB.task).toBe("Do B work.");
    expect(execC.task).toBe("Do C work.");
    expect(execB.transitions.find((t) => t.on === "CONTINUE")!.target).toBe(
      "bu_bu_1_batch_1_join"
    );
    expect(execC.transitions.find((t) => t.on === "CONTINUE")!.target).toBe(
      "bu_bu_1_batch_1_join"
    );

    // Join #1 proceeds to batch #2 start
    const join1 = getExec(sm, "bu_bu_1_batch_1_join");
    expect(join1.transitions.find((t) => t.on === "CONTINUE")!.target).toBe(
      "bu_bu_1_batch_2_start"
    );

    // Batch 2 start fans out (only D). Still marked parallel: true because it's a BU batch fan-out.
    const batch2Start = getExec(sm, "bu_bu_1_batch_2_start");
    const b2Fan = batch2Start.transitions.find((t) => t.on === "CONTINUE" && t.target === "exec_D");
    expect(b2Fan).toBeTruthy();
    expect(b2Fan!.parallel).toBe(true);

    // D runs and goes to final join, which then goes to success
    const execD = getExec(sm, "exec_D");
    expect(execD.task).toBe("Aggregate B & C.");
    expect(execD.transitions.find((t) => t.on === "CONTINUE")!.target).toBe(
      "bu_bu_1_batch_2_join"
    );

    const join2 = getExec(sm, "bu_bu_1_batch_2_join");
    expect(join2.transitions.find((t) => t.on === "CONTINUE")!.target).toBe("success");

    // Final states present
    expect(byId(sm, "success")).toBeTruthy();
    expect(byId(sm, "failure")).toBeTruthy();

    // Sanity: ensure no TD exec state has parallel flag on its own transitions (we have no TD here)
    sm.forEach((st) => {
      if ("task" in st) {
        if (!st.id.endsWith("_start")) {
          // exec_B/exec_C/exec_D and joins should not have parallel flags on their own transitions
          st.transitions.forEach((t) => {
            if (st.id.startsWith("exec_") || st.id.includes("_join")) {
              expect(t.parallel).toBeUndefined();
            }
          });
        }
      }
    });
  });
});
