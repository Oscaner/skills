// packages/cdd-engine/src/documents/doctypes/body/task.ts — the plan task data model (P2 T1; plan
// §T1 · Criterion ② — class + constructor injection). The task-shape single source the T3 PlanBody
// brief renderer reads (the handoff materializes objective + steps{action,checkable} + acceptance
// through the PlanBody-side renderBrief surface) and the T3 schema-validation face bolts onto: a
// step's `checkable` is a construction-time type-level constraint (a step omitting it fails to
// compile — never a runtime guard). `dependsOn` / `atomicWith` are the plan's two edge-model fields
// (directed dependency + undirected atomic pairing), NON-OPTIONAL since P3.1 T3 — every constructed
// task carries both as number[] (absent → `[]`, the no-edge default; the task-block parser fills
// them from the `- **DependsOn**:` / `- **AtomicWith**:` comma lists — `none` / an empty value
// lexes to `[]` — and TaskGraph consumes them for the atomic-closure grouping + the edge-validation
// BLOCK face). `missingEdge` is the parse-level record of the edge-mandatory face: true when the
// task block declares neither one of the two edge lines (the missing-edge failure class — a BLOCK
// at the doc-contract gate, never a silent absence).

/** One plan task step — an executable action + its verifiable outcome. */
export interface TaskStep {
  /** The step's executable action. */
  action: string;
  /** The step's verifiable outcome — the checkable target the provenance brief renders; required by
   *  construction (type-level — the schema-validation face T3 connects). */
  checkable: string;
}

/** The task's interface surface — the consumed and produced file (or artifact) slices. */
export interface TaskInterface {
  /** The task's consumed inputs. */
  consumes: string[];
  /** The task's produced outputs. */
  produces: string[];
}

/** Constructor options for a plan task — the full field family + the constructor-defaulted
 *  dependsOn? / atomicWith? edge fields (absent → the constructed Task's NON-OPTIONAL number[]
 *  fields default to `[]` — the no-edge default) and the optional missingEdge? parse record
 *  (absent → false). */
export interface TaskOpts {
  /** The task's outcome statement. */
  objective: string;
  /** The files the task touches. */
  files: string[];
  /** The task's interface surface (consumed / produced slices). */
  interface: TaskInterface;
  /** The ordered implementation steps — every step carries a checkable (required). */
  steps: TaskStep[];
  /** The task's acceptance criteria. */
  acceptance: string[];
  /** The task ids this task depends on — read/write (the task-block parser fills it from the
   *  `- **DependsOn**:` comma list — `none` / an empty value lexes to `[]`; TaskGraph consumes
   *  the edges). Absent → `[]` (the no-edge default). */
  dependsOn?: number[];
  /** The task ids this task is atomic with — read/write (the task-block parser fills it from the
   *  `- **AtomicWith**:` comma list — `none` / an empty value lexes to `[]`; TaskGraph consumes
   *  the edges). Absent → `[]` (the no-edge default). */
  atomicWith?: number[];
  /** True when the task block declares neither one of the two edge lines (the parse-level
   *  missing-edge record — the doc-contract gate's BLOCK face, see the plan-body rule data).
   *  Absent → false. */
  missingEdge?: boolean;
}

/**
 * A plan task (P2 T1; plan §T1 · design C1 — Criterion ②). Every field is constructor-injected on
 * a read-only face; the dependsOn / atomicWith edge fields are NON-OPTIONAL number[] (absent → `[]`
 * — the no-edge default; absent-at-construction never undefined), read/write (the task-block
 * parser fills them, TaskGraph consumes them). `missingEdge` records the parse-level edge-mandatory
 * face (a block declaring no edge line). The checkable requirement is enforced at the type level —
 * the T3 schema-validation machinery and the brief render surface consume the same TaskStep shape.
 */
export class Task {
  /** The task's outcome statement. */
  readonly objective: string;
  /** The files the task touches. */
  readonly files: string[];
  /** The task's interface surface (consumed / produced slices). */
  readonly interface: TaskInterface;
  /** The ordered implementation steps — every step carries a checkable (type-level required). */
  readonly steps: TaskStep[];
  /** The task's acceptance criteria. */
  readonly acceptance: string[];
  /** The task ids this task depends on — non-optional (absent → `[]`, the no-edge default). */
  readonly dependsOn: number[];
  /** The task ids this task is atomic with — non-optional (absent → `[]`, the no-edge default). */
  readonly atomicWith: number[];
  /** True when the task block declared neither one of the two edge lines (the parse-level
   *  missing-edge record). */
  readonly missingEdge: boolean;

  constructor(opts: TaskOpts) {
    this.objective = opts.objective;
    this.files = opts.files;
    this.interface = opts.interface;
    this.steps = opts.steps;
    this.acceptance = opts.acceptance;
    this.dependsOn = opts.dependsOn ?? [];
    this.atomicWith = opts.atomicWith ?? [];
    this.missingEdge = opts.missingEdge === true;
  }
}
