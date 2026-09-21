// packages/cdd-engine/src/dispatch/phases.ts — dispatch lifecycle phase table (Task 6;
// spec §2.12 第一部分) + the branch-level stage table (Task 9; spec E2①). Data-ized declarations
// of the three lifecycle phases in execution order, each carrying its responsibility, the commit
// gate anchored to it (enter on pre-flight, exit on post-flight — hook points in hooks.ts), and
// the engine step mount points (spec §2.12 step numbering). Task 7 (dispatch/base.ts) consumes
// this table to drive the template method; order changes here are order changes in the lifecycle.
// BRANCH_PHASES below is the branch-level review→fix loop's stage table: its Convergence ref is a
// COMMIT RANGE (BASE..HEAD) embedded in the handoff file name — the fix commits the range's
// changes → HEAD moves → a re-review of the NEW ref is a new branch review (resolveNextRound
// keyed by the concrete ref-moved name), same law as the plan/spec doc_hash double-signature
// ref-move.
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
      { id: "7", title: "prompt rendering (template + schema verbatim + brief/return block)" },
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
      { id: "11", title: "return block parse (status / commits / artifacts / blocker)" },
      { id: "12 / 13", title: "exit normalization (agent_rc / dry-run)" },
      { id: "13.5", title: "review range check (template-contract)" },
    ],
  },
];

/** By-id index of PHASES — today consumed only as the type-level PhaseId anchor: dispatch/base.ts
 * imports the type (compile-time literal anchoring of #phase calls), not this index; kept for
 * future PhaseId → phase lookups (Task 8+). */
export const PHASES_BY_ID = Object.fromEntries(
  PHASES.map((phase) => [phase.id, phase]),
) as Readonly<Record<PhaseId, (typeof PHASES)[number]>>;

// ---- branch-level stage table (Task 9; spec E2①) ----
// The branch review→fix loop is a data-ized pair of stages (mirror of PHASES's declaration
// shape), test-pinned by dispatch.phases.test.ts — consumed when the branch face
// (cli/branch-review.ts / cli/branch-fix.ts) integrates the stage table. Each
// stage declares:
//   id        — the loop-stage identity (same letters as the cli-driven-development digraph:
//               K[branch-review] → J[branch-fix]);
//   phase     — the handoff's schema phase value (the fix handoff's schema phase is "fix" —
//               the schema enum is implement/review/fix/branch-review — NOT "branch-fix", which
//               is the loop-stage id);
//   role      — the stage's responsibility in the loop;
//   family    — the canonical handoff family (engine-config.json#handoffNamespace);
//   convergence — the stage's Review Convergence ref semantics: branch ref = BASE..HEAD commit
//               range (ref embedded in the file name) — the fix's own commit moves HEAD → a
//               re-review of the NEW ref is a NEW branch review, legal exactly like the
//               plan/spec doc_hash double-signature ref-move (content evolution → new ref →
//               never falsely stopped by the old ref's clean round).

export const BRANCH_PHASE_IDS = ["branch-review", "branch-fix"] as const;
export type BranchPhaseId = (typeof BRANCH_PHASE_IDS)[number];

export interface BranchPhase {
  id: BranchPhaseId;
  /** handoff schema phase value (not the stage id — see file comment) */
  phase: string;
  /** one-line responsibility in the loop */
  role: string;
  /** canonical handoff family key (op.type) */
  family: string;
  /** Review Convergence semantics for this stage */
  convergence: string;
}

export const BRANCH_PHASES: readonly BranchPhase[] = [
  {
    id: "branch-review",
    phase: "branch-review",
    role: "review family stage — reviews the BASE..HEAD range (commits attached via the ref embedded in the file name)",
    family: "review.branch",
    convergence: "branch ref = BASE..HEAD commit range (ref embedded in branch-review-{base7}..{head7}-r{R}.json); a BLOCKED/OPEN round re-reviews the same ref; an APPROVED blocker=0 round stops the same ref — a new ref (content evolution) is always a new review",
  },
  {
    id: "branch-fix",
    phase: "fix",
    role: "work type stage — cdd fix --type branch closes the loop: fixes the source review's findings into real commits (engine channel, zero inline orchestration)",
    family: "fix.branch",
    convergence: "the fix commits the reviewed range's changes → HEAD moves → re-review of the new ref is a new branch review (legality: fixed ref = new ref); a no-op fix (no diff) keeps the ref → the same-ref review stays stopped",
  },
];
