// packages/cdd-engine/src/documents/doctypes/body/task.ts — the plan task data model (P2 T1; plan
// §T1 · Criterion ② — class + constructor injection). The task-shape single source the T3 PlanBody
// brief renderer reads (the handoff materializes objective + steps{action,checkable} + acceptance
// through the PlanBody-side renderBrief surface) and the T3 schema-validation face bolts onto: a
// step's `checkable` is a construction-time type-level constraint (a step omitting it fails to
// compile — never a runtime guard). `dependsOn` / `atomicWith` are the P3 edge-model extension bits
// (the plan's `## Task Groups` two-edge model): declared field surface ONLY — zero read / zero write
// / zero consumption at P2.

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

/** Constructor options for a plan task — the full field family + the optional P3 extension bits. */
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
  /** The task ids this task depends on (P3 edge-model extension bit — declared surface, zero read/write at P2). */
  dependsOn?: number[];
  /** The task ids this task is atomic with (P3 edge-model extension bit — declared surface, zero read/write at P2). */
  atomicWith?: number[];
}

/**
 * A plan task (P2 T1; plan §T1 · design C1 — Criterion ②). Every field is constructor-injected on
 * a read-only face; the P3 edge-model extension bits (dependsOn? / atomicWith?) ship as declared
 * surface only. The checkable requirement is enforced at the type level — the T3 schema-validation
 * machinery and the brief render surface consume the same TaskStep shape.
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
  /** The task ids this task depends on (P3 edge-model extension bit). */
  readonly dependsOn?: number[];
  /** The task ids this task is atomic with (P3 edge-model extension bit). */
  readonly atomicWith?: number[];

  constructor(opts: TaskOpts) {
    this.objective = opts.objective;
    this.files = opts.files;
    this.interface = opts.interface;
    this.steps = opts.steps;
    this.acceptance = opts.acceptance;
    this.dependsOn = opts.dependsOn;
    this.atomicWith = opts.atomicWith;
  }
}
