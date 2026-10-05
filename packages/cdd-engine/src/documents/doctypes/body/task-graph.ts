// packages/cdd-engine/src/documents/doctypes/body/task-graph.ts — TaskGraph: the
// plan-wide single grouping derivation. Groups are the connected components of the atomic
// closure (atomicWith = undirected symmetric edges → transitive closure), ordered by a
// topological order of the component DAG (dependsOn edges between components; ties ordered by the
// group's smallest task number ascending). `validate()` carries the five-failure-class BLOCK face:
// any failure → a GraphVerdict (null = valid), and `groups()` validates first — a non-null verdict
// throws GraphViolationError instead of silently emitting an order. The class is constructor-
// injected read-only over the plan's Task[] (the `### Task N:` ascending array — index i+1 = task
// id i+1) and is deliberately wiring-free — a pure grouping derivation over the task array.

import { TaskGroup } from "../../../domain/task-group.ts";
import type { Task } from "./task.ts";

/** The two edge-model declaration fields — the plan's directed `dependsOn` + undirected `atomicWith`. */
export const EDGE_FIELDS = ["dependsOn", "atomicWith"] as const;

/** The edge-model field identity — the GraphFailure.field discriminator. */
export type EdgeField = (typeof EDGE_FIELDS)[number];

/** The five failure classes of the edge-model validate BLOCK face. */
export type GraphFailureClass =
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
  /** The declaring field — which edge-model line carried the defective declaration. */
  readonly field: EdgeField;
  /** The offending task id (the referenced / duplicated id, or the smallest id trapped in a cycle). */
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

/** The groups() guard — groups() throws this instead of emitting an order for a broken graph. */
export class GraphViolationError extends Error {
  /** The verdict that blocked the grouping. */
  readonly verdict: GraphVerdict;

  constructor(verdict: GraphVerdict) {
    super(`TaskGraph is invalid — ${verdict.failures.length} edge violation(s) block the grouping`);
    this.name = "GraphViolationError";
    this.verdict = verdict;
  }
}

/**
 * TaskGraph — the plan's atomic-closure grouping derivation (constructor injection over the
 * `### Task N:` ascending Task[] — index i+1 is the task id). Group identity = TaskGroup
 * (numbers sorted ascending); group order = a topological order of the component DAG with ties
 * ordered by each group's smallest task number. Before grouping, `validate()` runs the five-class
 * BLOCK face (missing-id / self-loop / contradiction / cycle / duplicate) — a non-null verdict
 * makes `groups()` throw instead of silently emitting a broken order.
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
   *  Detection order is deterministic: per-declaration checks (duplicate → missing-id → self-loop →
   *  reverse-rank contradiction) over every task in ascending id order, then the component passes
   *  (intra-closure contradiction, then the contracted-DAG cycle). */
  validate(): GraphVerdict | null {
    const N = this.#tasks.length;
    const failures: GraphFailure[] = [];
    const broken = new Set<string>(); // "n:v" — dependsOn edges already reported (never double-report)
    const key = (n: number, v: number): string => `${n}:${v}`;

    // Per-declaration checks, in priority order — a single declaration produces ONE failure:
    // duplicate (a value repeated within one field list) → missing-id (a reference outside 1..N) →
    // self-loop (target == the declaring task) → reverse-rank contradiction (a bounded, non-self
    // dependsOn edge pointing at a HIGHER task id — rank(dependent) < rank(reference); never
    // evaluated for an edge an atomic pair already covers, which contradicts more specifically as
    // an intra-closure edge in the component pass below).
    for (let n = 1; n <= N; n++) {
      for (const field of EDGE_FIELDS) {
        const seen = new Set<number>();
        for (const v of this.#edgeValues(n, field)) {
          if (seen.has(v)) {
            failures.push(
              new GraphFailure({
                class: "duplicate",
                field,
                id: v,
                description: `task ${n} declares task ${v} more than once in its ${field} list`,
              }),
            );
            continue;
          }
          seen.add(v);
          if (v < 1 || v > N) {
            failures.push(
              new GraphFailure({
                class: "missing-id",
                field,
                id: v,
                description: `task ${n} declares task ${v}, outside the plan's 1..${N} task range`,
              }),
            );
            if (field === "dependsOn") broken.add(key(n, v));
            continue;
          }
          if (v === n) {
            failures.push(
              new GraphFailure({
                class: "self-loop",
                field,
                id: v,
                description: `task ${n} declares itself in its ${field} list (a task cannot ${
                  field === "dependsOn" ? "depend on" : "be atomic with"
                } itself)`,
              }),
            );
            if (field === "dependsOn") broken.add(key(n, v));
            continue;
          }
          if (field === "dependsOn" && v > n && !this.#atomicPairHas(n, v)) {
            failures.push(
              new GraphFailure({
                class: "contradiction",
                field,
                id: v,
                description: `reverse-rank dependency: task ${n} depends on the higher-numbered task ${v} — a dependsOn edge must declare a lower task id`,
              }),
            );
            broken.add(key(n, v));
          }
        }
      }
    }

    // Component passes over the atomic closure (valid atomicWith pairs only — a broken atomic edge
    // was already reported and is excluded from the closure).
    const { groups, find } = this.#atomicPartition();

    for (let n = 1; n <= N; n++) {
      for (const v of this.#edgeValues(n, "dependsOn")) {
        if (v < 1 || v > N || v === n) continue; // already broken above
        if (broken.has(key(n, v))) continue;
        if (find(n) === find(v)) {
          failures.push(
            new GraphFailure({
              class: "contradiction",
              field: "dependsOn",
              id: v,
              description: `task ${n} depends on task ${v}, but the two share one atomic component — atomic tasks cannot also depend on one another`,
            }),
          );
          broken.add(key(n, v));
        }
      }
    }

    // The remaining (inter-component, non-broken) dependsOn edges form the component DAG — cycle
    // check by topological counting: any component the shared Kahn sweep never consumes is trapped
    // in a cycle.
    const { consumed } = this.#componentPass(N, groups, find, (n, v) => broken.has(key(n, v)));
    const leftover = groups.filter((_, i) => !consumed[i]);
    if (leftover.length > 0) {
      const members = leftover.flat().sort((a, b) => a - b);
      failures.push(
        new GraphFailure({
          class: "cycle",
          field: "dependsOn",
          id: members[0]!,
          description: `the group dependency graph contains a cycle involving tasks ${members.join(
            ", ",
          )} — atomic groupings + dependsOn edges must form a DAG`,
        }),
      );
    }

    return failures.length === 0 ? null : new GraphVerdict(failures);
  }

  /** The derived groups — the atomic-closure components in topological order (ties by smallest
   *  task number). Validates first: a non-null verdict throws GraphViolationError (never a silent
   *  order for a broken graph). */
  groups(): TaskGroup[] {
    const verdict = this.validate();
    if (verdict !== null) throw new GraphViolationError(verdict);
    const { groups, find } = this.#atomicPartition();

    // The component DAG (all edges are clean post-validation) — the shared Kahn sweep emits the
    // topological order.
    const { order, consumed } = this.#componentPass(
      this.#tasks.length,
      groups,
      find,
      (n, v) => find(n) === find(v),
    );
    if (!consumed.every(Boolean)) {
      throw new Error("TaskGraph.groups(): post-validation component DAG still contains a cycle");
    }
    return order.map((i) => TaskGroup.fromNumbers(groups[i]!));
  }

  /** The component-DAG construction + Kahn sweep — ONE shared pass both grouping consumers run
   *  (validate() reads `consumed` to block the leftover cycle subgraph; groups() emits `order`).
   *  The DAG is built over the atomic components from the dependsOn edges that survive
   *  `isExcluded` (validate() skips the already-broken and intra-component edges; groups()
   *  post-validation skips only the intra-component ones). Ready ties leave in smallest-task-number
   *  order — every emitted component is pushed to `order` and marked in `consumed`. */
  #componentPass(
    taskCount: number,
    groups: number[][],
    find: (n: number) => number,
    isExcluded: (n: number, v: number) => boolean,
  ): { order: number[]; consumed: boolean[] } {
    const indeg = new Array<number>(groups.length).fill(0);
    const adj: Array<Set<number>> = groups.map(() => new Set<number>());
    for (let n = 1; n <= taskCount; n++) {
      for (const v of this.#edgeValues(n, "dependsOn")) {
        if (v < 1 || v > taskCount || v === n) continue;
        if (isExcluded(n, v)) continue;
        const from = this.#compIndexOf(groups, find, v);
        const to = this.#compIndexOf(groups, find, n);
        if (adj[from]!.has(to)) continue;
        adj[from]!.add(to);
        indeg[to]!++;
      }
    }
    const consumed = new Array<boolean>(groups.length).fill(false);
    const order: number[] = [];
    const ready = groups.map((_, i) => i).filter((i) => indeg[i] === 0);
    while (ready.length > 0) {
      ready.sort((a, b) => groups[a]![0]! - groups[b]![0]!); // ties: smallest task number first
      const c = ready.shift()!;
      consumed[c] = true;
      order.push(c);
      for (const t of adj[c]!) {
        indeg[t]!--;
        if (indeg[t] === 0) ready.push(t);
      }
    }
    return { order, consumed };
  }

  /** One task's declared edge values for a field (empty when the field is absent). */
  #edgeValues(n: number, field: EdgeField): readonly number[] {
    const task = this.#tasks[n - 1];
    if (!task) return [];
    return field === "dependsOn" ? (task.dependsOn ?? []) : (task.atomicWith ?? []);
  }

  /** Direct-pair atomic test — either task declares the other in an atomicWith list (the symmetry
   *  of the undirected atomic edge). */
  #atomicPairHas(a: number, b: number): boolean {
    return (
      this.#edgeValues(a, "atomicWith").includes(b) || this.#edgeValues(b, "atomicWith").includes(a)
    );
  }

  /** The atomic closure partition — the connected components of the undirected atomicWith graph
   *  over the VALID pairs (out-of-bounds / self-loop atomic declarations are already broken and
   *  excluded). Groups sorted ascending members + sorted by smallest member; `find` is the live
   *  union-find root function every component pass reads. */
  #atomicPartition(): { groups: number[][]; find: (n: number) => number } {
    const parent = Array.from({ length: this.#tasks.length + 1 }, (_, i) => i);
    const find = (x: number): number => {
      let root = x;
      while (parent[root] !== root) {
        parent[root] = parent[parent[root]!]!; // path halving
        root = parent[root]!;
      }
      return root;
    };
    const union = (a: number, b: number): void => {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent[ra] = rb;
    };
    for (let n = 1; n <= this.#tasks.length; n++) {
      for (const v of this.#edgeValues(n, "atomicWith")) {
        if (v >= 1 && v <= this.#tasks.length && v !== n) union(Math.min(n, v), Math.max(n, v));
      }
    }
    const buckets = new Map<number, number[]>();
    for (let n = 1; n <= this.#tasks.length; n++) {
      const r = find(n);
      if (!buckets.has(r)) buckets.set(r, []);
      buckets.get(r)!.push(n);
    }
    const groups = [...buckets.values()]
      .map((members) => members.sort((a, b) => a - b))
      .sort((a, b) => a[0]! - b[0]!);
    return { groups, find };
  }

  /** The component index of a task id — the group list is indexed by its smallest-member order. */
  #compIndexOf(groups: number[][], find: (n: number) => number, n: number): number {
    const members = groups.find((g) => g.includes(find(n)));
    if (!members) throw new Error("TaskGraph: task component not found");
    return groups.indexOf(members);
  }
}
