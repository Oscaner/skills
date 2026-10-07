// packages/cdd-engine/src-next/session/graph.ts
// T6 — the TaskGraph (design spec §3.1): the execution-order single home. The
// graph consumes the SAME doc.ts plan parse instance the dispatch and the lint
// read — the `### Task N:` blocks and their `- **DependsOn**:` fields (the parse
// single home in doc.ts) — and never re-parses the document text. It owns the
// six edge-validation classes (missing-edge / duplicate / missing-id / self-loop /
// contradiction / cycle), the anti-dependency gate (only lower-numbered tasks are
// referenceable — numbering order is the topological-linearization anchor), the
// `batches()` wave decomposition and the `frontier(done)` dynamic face (state.ts's
// Frontier contract). The ExecutionState query surface (doneTasks() / readyBatch()
// as methods — never a standalone state class) is carried here as the run-state
// home (markDone) until the round ledger attests it.
//
// Edge judgment is single-homed here: the six classes are the ONLY edge
// judgments of the new tree — nothing else decides whether an edge is missing,
// duplicated, dangling, looping, forward or cyclic (the lint reads a block's
// declared values only to know what NOT to suspect, and judges nothing).
//
// Module-level exports are types / the class — zero behavior-carrying bare
// functions (the plan's zero-bare-function discipline).

import type { PlanParsed, TaskBlock } from "../contract/doc.ts";
import type { ExecutionState, Frontier } from "./state.ts";

/** The six edge-validation classes — the TaskGraph's judgment vocabulary. */
export type GraphIssueClass =
  /** a task block declares no `- **DependsOn**:` field (`none`/empty = the explicit no-dependency declaration) */
  | "missing-edge"
  /** the same dependency id is declared twice in one block's edge */
  | "duplicate"
  /** an edge references a task id absent from the plan */
  | "missing-id"
  /** a task depends on itself */
  | "self-loop"
  /** a task depends on a higher-numbered task — the anti-dependency gate violation */
  | "contradiction"
  /** a directed dependency cycle among the declared edges */
  | "cycle";

/** One edge validation issue — a single failure class bound to an offending task. */
export interface GraphIssue {
  /** The failure class. */
  kind: GraphIssueClass;
  /** The offending task id (for a cycle — the lowest task inside the cycle). */
  task: number;
  /** The one-line issue message. */
  message: string;
  /** The actionable fix. */
  fix: string;
}

/** One task's declared edge record — whether the `**DependsOn**` field exists and the dependency ids it carries. */
interface EdgeRecord {
  /** Whether the block declares a `- **DependsOn**:` field (absent = the missing-edge class). */
  declared: boolean;
  /** The declared dependency ids (parse order, sorted ascending — duplicates retained for the duplicate class). */
  deps: readonly number[];
}

/**
 * The task graph — nodes are the plan's task ids, one declared edge per block.
 * The task-base consumption, the six-class validate, the batch waves and the
 * execution query surface all read the same shared parse instance.
 */
export class TaskGraph implements Frontier, ExecutionState {
  /** The registered task ids, ascending. */
  readonly #nodes: readonly number[];
  /** Each task's declared edge record, keyed by task id. */
  readonly #edges: ReadonlyMap<number, EdgeRecord>;
  /** The run's completed task ids — the ExecutionState carrier (markDone). */
  readonly #done: Set<number> = new Set();

  /** Build from a shared plan parse — the same instance the dispatch and the lint read. */
  constructor(parsed: PlanParsed) {
    this.#nodes = parsed.taskBlocks.map((block) => block.id).sort((a, b) => a - b);
    const edges = new Map<number, EdgeRecord>();
    for (const block of parsed.taskBlocks) {
      edges.set(block.id, this.#edgeOf(block));
    }
    this.#edges = edges;
  }

  // -------------------------------------------------------------------------
  // the six-class validate
  // -------------------------------------------------------------------------

  /** validate — every failure class of every task, in block order, with the cycle
   *  class last (the graph-level judgment). */
  validate(): GraphIssue[] {
    const issues: GraphIssue[] = [];
    const registered = new Set(this.#nodes);
    for (const blockId of this.#nodes) {
      issues.push(
        ...this.#blockIssues(
          this.#edges.get(blockId) ?? { declared: false, deps: [] },
          blockId,
          registered,
        ),
      );
    }
    const cycleTask = this.#cycleMember();
    if (cycleTask !== null) {
      issues.push({
        kind: "cycle",
        task: cycleTask,
        message: `a directed dependency cycle closes over task ${cycleTask}: task dependencies must form a DAG`,
        fix: "break the cycle — no task may depend on a task that reaches back to it",
      });
    }
    return issues;
  }

  /** The per-block failure classes, in a stable order (missing-edge, duplicate,
   *  missing-id, self-loop, contradiction). */
  #blockIssues(edge: EdgeRecord, blockId: number, registered: ReadonlySet<number>): GraphIssue[] {
    if (!edge.declared) {
      return [
        this.#issue(
          "missing-edge",
          blockId,
          `task ${blockId} declares no **DependsOn** edge`,
          "add a - **DependsOn**: line (`none` = the explicit no-dependency declaration)",
        ),
      ];
    }
    const issues: GraphIssue[] = [];
    const duplicates = TaskGraph.#unique(
      edge.deps.filter((id, index) => edge.deps.indexOf(id) !== index),
    );
    if (duplicates.length > 0) {
      issues.push(
        this.#issue(
          "duplicate",
          blockId,
          `task ${blockId} declares the dependency${TaskGraph.#plural(duplicates)} ${TaskGraph.#toList(duplicates)} twice`,
          `declare each dependency id once in the block's **DependsOn** (${TaskGraph.#toList(duplicates)})`,
        ),
      );
    }
    const missing = TaskGraph.#unique(edge.deps.filter((id) => !registered.has(id)));
    if (missing.length > 0) {
      issues.push(
        this.#issue(
          "missing-id",
          blockId,
          `task ${blockId} depends on unregistered task ${TaskGraph.#toList(missing)}`,
          `set **DependsOn** to a task id present in the plan (${TaskGraph.#toList(missing)} is not)`,
        ),
      );
    }
    if (edge.deps.includes(blockId)) {
      issues.push(
        this.#issue(
          "self-loop",
          blockId,
          `task ${blockId} depends on itself`,
          `a task may never depend on its own number — drop ${blockId} from the block's **DependsOn**`,
        ),
      );
    }
    const forwards = TaskGraph.#unique(edge.deps.filter((id) => id > blockId));
    if (forwards.length > 0) {
      issues.push(
        this.#issue(
          "contradiction",
          blockId,
          `task ${blockId} depends on the higher-numbered task ${TaskGraph.#toList(forwards)} — the anti-dependency gate violation`,
          `only lower-numbered tasks are referenceable (numbering order is the linearization anchor) — fix **DependsOn** for task ${TaskGraph.#toList(forwards)}`,
        ),
      );
    }
    return issues;
  }

  /** The cycle class — the lowest task closing a directed cycle (self-loops
   *  excluded: they own the self-loop class); null when the edge graph is a DAG. */
  #cycleMember(): number | null {
    const indegree = new Map<number, number>();
    const dependents = new Map<number, Set<number>>();
    for (const id of this.#nodes) {
      indegree.set(id, 0);
      dependents.set(id, new Set());
    }
    for (const id of this.#nodes) {
      const edge = this.#edges.get(id);
      if (edge === undefined) continue;
      for (const dep of TaskGraph.#unique(edge.deps.filter((value) => value !== id))) {
        if (!indegree.has(dep)) continue; // a phantom can never join a real cycle
        indegree.set(id, indegree.get(id)! + 1); // id carries one more dependency
        dependents.get(dep)!.add(id); // when dep resolves, id's indegree drops
      }
    }
    const remaining = new Set(this.#nodes);
    const queue = this.#nodes.filter((id) => indegree.get(id) === 0);
    while (queue.length > 0) {
      const id = queue.shift()!;
      remaining.delete(id);
      for (const dependent of dependents.get(id)!) {
        const next = indegree.get(dependent)! - 1;
        indegree.set(dependent, next);
        if (next === 0) queue.push(dependent);
      }
    }
    return remaining.size === 0 ? null : Math.min(...remaining);
  }

  /**
   * batches() — the topological wave decomposition: wave 0 is every no-dependency
   * task, each later wave the tasks whose dependencies all sit in earlier waves.
   * A dependency that can never be satisfied (a phantom target, or a cycle among
   * real tasks) keeps its task unwaved — the derivation is halt-safe and never
   * recurses.
   */
  batches(): number[][] {
    const waves: number[][] = [];
    const done = new Set<number>();
    let pending = [...this.#nodes];
    while (pending.length > 0) {
      const wave = pending.filter((id) => this.#depsOf(id).every((dep) => done.has(dep)));
      if (wave.length === 0) break;
      waves.push(wave);
      for (const id of wave) done.add(id);
      pending = pending.filter((id) => !done.has(id));
    }
    return waves;
  }

  // -------------------------------------------------------------------------
  // the frontier dynamic face (state.ts Frontier)
  // -------------------------------------------------------------------------

  /** frontier(done) — the not-yet-done tasks whose dependencies are all done, ascending. */
  frontier(done: ReadonlySet<number>): readonly number[] {
    return this.#nodes.filter(
      (id) => !done.has(id) && this.#depsOf(id).every((dep) => done.has(dep)),
    );
  }

  // -------------------------------------------------------------------------
  // the ExecutionState query surface (state.ts ExecutionState) + the run carrier
  // -------------------------------------------------------------------------

  /** The completed task ids — a snapshot copy, never a live handle into the run. */
  doneTasks(): Set<number> {
    return new Set(this.#done);
  }

  /** The current ready batch — the frontier over the run's done set, ascending. */
  readyBatch(): number[] {
    return [...this.frontier(this.#done)];
  }

  /** Record a completed task — idempotent; an unknown id is a no-op. */
  markDone(id: number): void {
    if (this.#nodes.includes(id)) this.#done.add(id);
  }

  // -------------------------------------------------------------------------
  // edge reading
  // -------------------------------------------------------------------------

  /** The dependency ids of one task (destination-first ordering for batches/frontier). */
  #depsOf(task: number): readonly number[] {
    return this.#edges.get(task)?.deps ?? [];
  }

  /** One block's declared edge record — the `**DependsOn**` field's numeric values
   *  (the `[1-9]\d*` task-id domain: `none`/empty carries zero edges; the field's
   *  absence is recorded separately for the missing-edge class). */
  #edgeOf(block: TaskBlock): EdgeRecord {
    const field = block.fields.find((entry) => entry.key === "DependsOn");
    if (field === undefined) return { declared: false, deps: [] };
    const deps: number[] = [];
    for (const line of field.lines) {
      for (const match of line.matchAll(/[1-9]\d*/g)) deps.push(Number(match[0]));
    }
    return { declared: true, deps: deps.sort((a, b) => a - b) };
  }

  /** One constructed issue (the single message/fix assembly point of the graph). */
  #issue(kind: GraphIssueClass, task: number, message: string, fix: string): GraphIssue {
    return { kind, task, message, fix };
  }

  // -------------------------------------------------------------------------
  // shared render helpers — pure list/text shaping (class members, never module
  // bare functions)
  // -------------------------------------------------------------------------

  /** The unique values of a candidate list, in first-occurrence order. */
  static #unique(values: readonly number[]): readonly number[] {
    return [...new Set(values)];
  }

  /** A small plural suffix for the aggregate messages. */
  static #plural(values: readonly number[]): string {
    return values.length === 1 ? "" : "s";
  }

  /** The `1, 2`-style list renderer for the aggregate messages. */
  static #toList(values: readonly number[]): string {
    return values.join(", ");
  }
}
