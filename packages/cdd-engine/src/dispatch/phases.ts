// packages/cdd-engine/src/dispatch/phases.ts — dispatch lifecycle phase table (Task 6;
// spec §2.12 第一部分). Data-ized declarations of the three lifecycle phases in execution order,
// each carrying its responsibility, the commit gate anchored to it (enter on pre-flight, exit on
// post-flight — hook points in hooks.ts), and the engine step mount points (spec §2.12 step
// numbering). Task 7 (dispatch/base.ts) consumes this table to drive the template method;
// order changes here are order changes in the lifecycle.
export const PHASE_IDS = ["pre-flight", "dispatch", "post-flight"] as const;
export type PhaseId = (typeof PHASE_IDS)[number];

export interface PhaseStepMount {
  /** spec §2.12 step number — stable mount identifier ("1", "2.5", "10 / 10.5", …) */
  id: string;
  /** one-line responsibility of the engine step */
  title: string;
}

export interface DispatchPhase {
  id: PhaseId;
  /** phase responsibility (spec §2.12 阶段责任 column) */
  responsibility: string;
  /** commit gate anchored to this phase: "enter" (pre-commit entry) | "exit" (post-commit exit) */
  commitGate?: "enter" | "exit";
  /** engine step mount points, in execution order (spec §2.12 step column) */
  steps: readonly PhaseStepMount[];
}

export const PHASES: readonly DispatchPhase[] = [
  {
    id: "pre-flight",
    responsibility: "entry readiness — clean working tree (entry gate) plus engine context loaded; dirty → BLOCKED before any semantic work",
    commitGate: "enter",
    steps: [
      { id: "1", title: "CLI argument parsing + harness registry load" },
      { id: "2", title: "--plan → workspace → ctx (single root authority)" },
      { id: "2.5", title: "template existence check (missing → BLOCKED exit 1)" },
      { id: "4", title: "ctx → progressDir (ledger)" },
      { id: "5", title: "fixed-point derivation (prior handoff for review/fix)" },
      { id: "6", title: "mode validation (implement / review / fix legal trio)" },
    ],
  },
  {
    id: "dispatch",
    responsibility: "agent session execution — the only agent-semantics black box; engine steps end at spawn",
    steps: [
      { id: "7", title: "prompt rendering (template + schema verbatim + brief/H1 block)" },
      { id: "8", title: "spawn agent CLI (execa background + timeout)" },
    ],
  },
  {
    id: "post-flight",
    responsibility: "result normalization + contract validation — mechanical close-out, no agent semantics",
    commitGate: "exit",
    steps: [
      { id: "8.5", title: "timeout path (write partial handoff, timeoutCount++)" },
      { id: "8.8", title: "handoff schema check (CONTRACT_VIOLATION keeps findings)" },
      { id: "10 / 10.5", title: "failure without handoff → BLOCKED (stderr into blocker)" },
      { id: "11", title: "H1 four-line parse (status / commits / artifacts / blocker)" },
      { id: "12 / 13", title: "exit normalization (agent_rc / dry-run)" },
      { id: "13.5", title: "reviews.json range check" },
    ],
  },
];

/** By-id index of PHASES — today consumed only as the type-level PhaseId anchor: dispatch/base.ts
 * imports the type (compile-time literal anchoring of #phase calls), not this index; kept for
 * future PhaseId → phase lookups (Task 8+). */
export const PHASES_BY_ID = Object.fromEntries(
  PHASES.map((phase) => [phase.id, phase]),
) as Readonly<Record<PhaseId, (typeof PHASES)[number]>>;
