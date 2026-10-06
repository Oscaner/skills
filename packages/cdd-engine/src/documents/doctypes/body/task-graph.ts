// packages/cdd-engine/src/documents/doctypes/body/task-graph.ts — TaskGraph: the plan-wide single
// edge-model derivation (P3.1 T3 — the unilateral rebuild: `- **DependsOn**:` is the plan's only
// directed edge). The static face serves two
// derivations over the plan's Task[] (the `### Task N:` ascending array — index i+1 = task id i+1):
// `validate()` — the six-failure-class BLOCK face (missing-edge · missing-id · self-loop ·
// contradiction (the anti-dependency gate) · cycle · duplicate) — and `batches()` — the wave
// derivation (ready layers by ascending task number; the ties within a wave stay ascending). Any
// non-null verdict makes `batches()` throw GraphViolationError instead of silently emitting an
// order. The class is constructor-injected read-only and deliberately wiring-free — a pure
// derivation over the task array.
//
// The anti-dependency gate (§2.3): a `DependsOn` reference may only point at a LOWER-numbered task
// (target < source) — the numbering order is the topological-linearization anchor (task numbering
// ascends the legal execution order). A bounded forward reference (target > source) is the
// `contradiction` failure class; a self reference is the more specific `self-loop`; both BLOCK.
// Owing to the gate, a parsed edge sequence can never form a cycle (every edge strictly decreases),
// but the cycle check stays as the crisp set's defensive member — a directly-constructed TaskGraph
// can still carry one.

import { TaskGroup } from "../../../domain/task-group.ts";
import type { Task } from "./task.ts";

/** The edge-model field identity — the single directed edge's discriminator (the GraphFailure.field
 *  carrier). */
export type EdgeField = "dependsOn";

/** The six failure classes of the edge-model validate BLOCK face. */
export type GraphFailureClass =
  | "missing-edge"
  | "missing-id"
  | "self-loop"
  | "contradiction"
  | "cycle"
  | "duplicate";

/** One edge-model violation — class + field + the offending task id + an English description
 *  (constructor-injected read-only; the verdict is a failure list, no fail-fast). */
export class GraphFailure {
  /** The violation class — which BLOCK the edge model tripped. */
  readonly class: GraphFailureClass;
  /** The declaring field — the edge line that carried the defective declaration. */
  readonly field: EdgeField;
  /** The offending task id (the referenced / duplicated id, the declaring task of a missing edge,
   *  or the smallest id trapped in a cycle). */
  readonly id: number;
  /** One-sentence human-readable statement of the violation. */
  readonly description: string;

  constructor(opts: {
    class: GraphFailureClass;
    field: EdgeField;
    id: number;
    description: string;
  }) {
    this.class = opts.class;
    this.field = opts.field;
    this.id = opts.id;
    this.description = opts.description;
  }
}

/** The validate BLOCK aggregate — every detected violation (the first failure never short-circuits). */
export class GraphVerdict {
  /** The detected violations, in deterministic detection order. */
  readonly failures: readonly GraphFailure[];

  constructor(failures: readonly GraphFailure[]) {
    this.failures = Object.freeze([...failures]);
  }
}

/** The batches() guard — batches() throws this instead of emitting an order for a broken graph. */
export class GraphViolationError extends Error {
  /** The verdict that blocked the batches. */
  readonly verdict: GraphVerdict;

  constructor(verdict: GraphVerdict) {
    super(`TaskGraph is invalid — ${verdict.failures.length} edge violation(s) block the batches`);
    this.name = "GraphViolationError";
    this.verdict = verdict;
  }
}

/** One derived batch — the wave's task ids in ascending order (the tasks that become ready
 *  together; the whole wave is one dispatch group — one implement dispatch delivers the whole ready
 *  wave). */
export type TaskBatch = readonly number[];

/**
 * TaskGraph — the plan's edge-model derivation (constructor injection over the `### Task N:`
 * ascending Task[] — index i+1 is the task id). `validate()` runs the six-class BLOCK face
 * (missing-edge / missing-id / self-loop / contradiction (the anti-dependency gate) / cycle /
 * duplicate); `batches()` — the wave derivation (each wave = the same-depth ready layer, ascending
 * task numbers) — validates first: a non-null verdict makes it throw instead of silently emitting a
 * broken order.
 */
export class TaskGraph {
  readonly #tasks: readonly Task[];

  constructor(tasks: readonly Task[]) {
    this.#tasks = Object.freeze([...tasks]);
  }

  /** The plan's task count (the 1..N range — task ids are 1..taskCount). */
  get taskCount(): number {
    return this.#tasks.length;
  }

  /** Validate the edge model — null when the graph is valid, else the aggregate GraphVerdict.
   *  Detection order is deterministic: per-task the missing-edge class first (a line-less block
   *  carries no edge values to judge), then the per-value checks in priority order (duplicate →
   *  missing-id → self-loop → the anti-dependency contradiction over every task in ascending id
   *  order), then the remaining task-DAG cycle sweep. */
  validate(): GraphVerdict | null {
    const N = this.#tasks.length;
    const failures: GraphFailure[] = [];
    const broken = new Set<string>(); // "n:v" — edges already reported (never double-report)
    const key = (n: number, v: number): string => `${n}:${v}`;

    for (let n = 1; n <= N; n++) {
      const task = this.#tasks[n - 1];
      if (!task) continue;
      // missing-edge — the sixth failure class: the block declares no `- **DependsOn**:` line (a
      // line-less edge model is a structural error — the plan's forgotten dependency edge, BLOCK).
      if (!task.hasDependsOn) {
        failures.push(
          new GraphFailure({
            class: "missing-edge",
            field: "dependsOn",
            id: n,
            description: `task ${n} declares no \`- **DependsOn**:\` line — every task block must declare its dependency edge (a \`none\`/empty list when the task has no dependency)`,
          }),
        );
        continue; // a line-less block declares no values — nothing else to judge
      }
      // Per-declaration checks, in priority order — a single declaration produces ONE failure:
      // duplicate (a value repeated within the list) → missing-id (a reference outside 1..N) →
      // self-loop (target == the declaring task) → the anti-dependency contradiction (a bounded,
      // non-self dependsOn edge pointing at a HIGHER task id — rank(dependent) < rank(reference)).
      const seen = new Set<number>();
      for (const v of task.dependsOn) {
        if (seen.has(v)) {
          failures.push(
            new GraphFailure({
              class: "duplicate",
              field: "dependsOn",
              id: v,
              description: `task ${n} declares task ${v} more than once in its dependsOn list`,
            }),
          );
          continue;
        }
        seen.add(v);
        if (v < 1 || v > N) {
          failures.push(
            new GraphFailure({
              class: "missing-id",
              field: "dependsOn",
              id: v,
              description: `task ${n} declares task ${v}, outside the plan's 1..${N} task range`,
            }),
          );
          broken.add(key(n, v));
          continue;
        }
        if (v === n) {
          failures.push(
            new GraphFailure({
              class: "self-loop",
              field: "dependsOn",
              id: v,
              description: `task ${n} declares itself in its dependsOn list (a task cannot depend on itself)`,
            }),
          );
          broken.add(key(n, v));
          continue;
        }
        if (v > n) {
          failures.push(
            new GraphFailure({
              class: "contradiction",
              field: "dependsOn",
              id: v,
              description: `forward dependency: task ${n} depends on the higher-numbered task ${v} — a dependsOn edge must declare a lower task id (numbering order is the topological-linearization anchor)`,
            }),
          );
          broken.add(key(n, v));
        }
      }
    }

    // The remaining (non-broken) dependsOn edges form the task DAG — the cycle sweep by
    // topological counting: any task the sweep never consumes is trapped in a cycle. Under the
    // anti-dependency gate every parsed edge strictly decreases, so a parsed plan never reaches
    // this failure — a directly-constructed TaskGraph can.
    const consumed = new Array<boolean>(N + 1).fill(false);
    const indeg = new Array<number>(N + 1).fill(0);
    const adj: Array<Set<number> | undefined> = new Array(N + 1);
    for (let n = 1; n <= N; n++) {
      const seen = new Set<number>(); // the DAG edges dedupe per task (a duplicate declaration is ONE edge)
      for (const v of this.#tasks[n - 1]?.dependsOn ?? []) {
        if (seen.has(v)) continue;
        seen.add(v);
        if (broken.has(key(n, v))) continue;
        if (v < 1 || v > N || v === n) continue;
        if (!adj[v]) adj[v] = new Set<number>();
        adj[v]!.add(n);
        indeg[n]!++;
      }
    }
    const ready = Array.from({ length: N }, (_, i) => i + 1).filter((n) => indeg[n] === 0);
    while (ready.length > 0) {
      ready.sort((a, b) => a - b); // ascending id — deterministic consumption
      const n = ready.shift()!;
      consumed[n] = true;
      for (const t of adj[n] ?? []) {
        indeg[t]!--;
        if (indeg[t] === 0) ready.push(t);
      }
    }
    const leftover = Array.from({ length: N }, (_, i) => i + 1).filter((n) => !consumed[n]);
    if (leftover.length > 0) {
      failures.push(
        new GraphFailure({
          class: "cycle",
          field: "dependsOn",
          id: leftover[0]!,
          description: `the dependency graph contains a cycle involving tasks ${leftover.join(", ")} — dependsOn edges must form a DAG`,
        }),
      );
    }

    return failures.length === 0 ? null : new GraphVerdict(failures);
  }

  /** The derived batches — the wave decomposition in deterministic order (each wave = the ready
   *  layer's tasks at the same depth, ascending task numbers; waves in ascending depth order).
   *  Validates first: a non-null verdict throws GraphViolationError (never a silent order for a
   *  broken graph). */
  batches(): TaskBatch[] {
    const verdict = this.validate();
    if (verdict !== null) throw new GraphViolationError(verdict);
    const N = this.#tasks.length;
    // Depth = the longest-path layer: a task's depth is one past its deepest dependency, so every
    // edge spans strictly decreasing layers (validate() guarantees backward edges) and tasks at
    // the same depth become ready together — the wave (ready layers in ascending task-number order).
    const depth = new Array<number>(N + 1).fill(0);
    for (let n = 1; n <= N; n++) {
      let maxDep = -1;
      for (const v of this.#tasks[n - 1]?.dependsOn ?? []) maxDep = Math.max(maxDep, depth[v]!);
      depth[n] = maxDep + 1;
    }
    const waves = new Map<number, number[]>();
    for (let n = 1; n <= N; n++) {
      const d = depth[n]!;
      if (!waves.has(d)) waves.set(d, []);
      waves.get(d)!.push(n); // the ascending scan keeps each wave ascending
    }
    return [...waves.entries()].sort((a, b) => a[0]! - b[0]!).map(([, nums]) => nums);
  }

  /** TaskGroup view of the wave derivation — each batch becomes one dispatch group (group = wave;
   *  the effectiveGroups single derivation the dispatch schedule consumes). */
  groupBatches(): TaskGroup[] {
    return this.batches().map((batch) => TaskGroup.fromNumbers(batch));
  }
}
