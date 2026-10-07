// packages/cdd-engine/src/documents/doctypes/body/task.ts — the plan task data model (P2 T1; plan
// §T1 · Criterion ② — class + constructor injection). The task-shape single source the T3 PlanBody
// brief renderer reads (the handoff materializes objective + steps{action,checkable} + acceptance
// through the PlanBody-side renderBrief surface) and the T3 schema-validation face bolts onto: a
// step's `checkable` is a construction-time type-level constraint (a step omitting it fails to
// compile — never a runtime guard). `dependsOn` is the plan's single directed edge field: the
// task-block parser fills it from the `- **DependsOn**:` comma list (`none`/empty → `[]`;
// line absent → `hasDependsOn` false — the TaskGraph missing-edge BLOCK face) and TaskGraph
// consumes the edges for the wave batches + the edge-validation BLOCK face. The unilateral edge
// model (P3.1 T3): the edge model is unilateral — the plan owns exactly one edge declaration per
// task block.

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

/** Constructor options for a plan task — the full field family + the edge field refers. */
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
  /** The task ids this task depends on (the single directed edge — `- **DependsOn**:` comma list;
   *  absent → the default `[]`). */
  dependsOn?: number[];
  /** Whether the task block declared a `- **DependsOn**:` line (the parse-level missing-edge fact —
   *  a block whose line is absent carries `hasDependsOn: false`, the TaskGraph missing-edge BLOCK
   *  source; a `none`/empty declaration is a PRESENT line with an empty edge list). */
  hasDependsOn?: boolean;
}

/**
 * A plan task (P2 T1; plan §T1 · design C1 — Criterion ②). Every field is constructor-injected on
 * a read-only face; `dependsOn` is the single directed edge field (non-optional — the default `[]`
 * is the constructor's absent-value behavior; the edge model is unilateral) and
 * `hasDependsOn` records the task block's edge-line presence (the missing-edge source). The
 * checkable requirement is enforced at the type level — the T3 schema-validation machinery and the
 * brief render surface consume the same TaskStep shape.
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
  /** The task ids this task depends on — non-optional (default `[]`). */
  readonly dependsOn: number[];
  /** The task block's edge-line presence — false when the block declares no `- **DependsOn**:`
   *  line (the missing-edge BLOCK source). */
  readonly hasDependsOn: boolean;

  constructor(opts: TaskOpts) {
    this.objective = opts.objective;
    this.files = opts.files;
    this.interface = opts.interface;
    this.steps = opts.steps;
    this.acceptance = opts.acceptance;
    this.dependsOn = opts.dependsOn ?? [];
    this.hasDependsOn = opts.hasDependsOn ?? false;
  }
}
