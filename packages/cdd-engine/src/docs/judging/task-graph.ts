// packages/cdd-engine/src/docs/judging/task-graph.ts
// The task graph — the plan's execution order, derived from one thing only: the task
// blocks' `DependsOn` lines.
//
// There is no second edge table. The graph reads `TaskBlocks` (the grammar's own parse of
// `### Task N:` blocks) at construction, so every later read — validation, the wave
// decomposition, the frontier — answers from that one extraction.
//
// Two facts this file is the single home of:
//   · the FOUR edge-failure classes (`missing-edge` · `missing-id` · `self-loop` · `cycle`);
//   · the topological WAVE decomposition (`batches()`). The wave-width criterion judges
//     exactly these batches, so a second decomposition anywhere would be a second rule.
//
// The graph CONSUMES no judgment from above: it says what the plan declares and what order
// that implies. Whether a cycle blocks a dispatch, and what a too-wide wave does, belong to
// the gate that reads this.

import type { MarkdownTree } from "../grammar/markdown-tree.ts";
import { TaskBlocks } from "../grammar/task-blocks.ts";
import type { TaskBlock } from "../grammar/types.ts";

/** The four edge-validation classes — the graph's whole judgment vocabulary, judged on the
 *  normalized (deduped, sorted) edges the grammar extracts, never on the author's literal. */
export type GraphIssueClass =
  /** a task block declares no `DependsOn` section (`none` / empty = the explicit declaration) */
  | "missing-edge"
  /** an edge references a task id absent from the plan */
  | "missing-id"
  /** a task depends on itself */
  | "self-loop"
  /** a directed dependency cycle among the edges */
  | "cycle";

/** The declared classes, in the order a refusal names them. */
export const GRAPH_ISSUE_CLASSES = [
  "missing-edge",
  "missing-id",
  "self-loop",
  "cycle",
] as const satisfies readonly GraphIssueClass[];

/** One edge-validation issue — one failure class bound to an offending task. */
export interface GraphIssue {
  /** The failure class. */
  readonly kind: GraphIssueClass;
  /** The offending task id. For a `cycle` it is the lowest id left in the topological
   *  remainder — which also holds every task that transitively depends on the cycle, so the
   *  answer names a task the cycle closes over, not necessarily a member. */
  readonly task: number;
  /** The one-line issue message. */
  readonly message: string;
  /** The actionable fix. */
  readonly fix: string;
}

/** One task's extracted edge record. */
interface EdgeRecord {
  /** Whether the block declares a `DependsOn` section. */
  readonly declared: boolean;
  /** The dependency ids, deduped and ascending (the grammar's normalization). */
  readonly deps: readonly number[];
}

/**
 * TaskGraph — the plan's task graph. Invariant: the nodes and the edges come from ONE task
 * block extraction, so validation, the wave decomposition and the frontier can never
 * disagree about the plan.
 */
export class TaskGraph {
  /** The registered task ids, ascending. */
  readonly #nodes: readonly number[];

  /** Each task's extracted edge record, keyed by task id. */
  readonly #edges: ReadonlyMap<number, EdgeRecord>;

  /** Build from one task-block extraction — the caller's own parse, so the graph and every
   *  other reader judge the same blocks. */
  constructor(blocks: TaskBlocks) {
    const parsed = blocks.blocks();
    this.#nodes = parsed.map((block) => block.id).sort((left, right) => left - right);
    const edges = new Map<number, EdgeRecord>();
    for (const block of parsed) edges.set(block.id, TaskGraph.#edgeOf(block, blocks));
    this.#edges = edges;
  }

  /** Build from one markdown tree — the convenience entry a caller holding a document uses. */
  static of(tree: MarkdownTree): TaskGraph {
    return new TaskGraph(TaskBlocks.of(tree));
  }

  /** Build from one plan's text directly. */
  static parse(text: string): TaskGraph {
    return new TaskGraph(TaskBlocks.parse(text));
  }

  /** The registered task ids, ascending. */
  nodes(): readonly number[] {
    return [...this.#nodes];
  }

  /** One task's declared dependency ids — the extracted surface, ascending. */
  depsOf(task: number): readonly number[] {
    return [...(this.#edges.get(task)?.deps ?? [])];
  }

  /** Every failure class of every task, in block order, with the cycle class last (the
   *  graph-level judgment). */
  validate(): readonly GraphIssue[] {
    const issues: GraphIssue[] = [];
    const registered = new Set(this.#nodes);
    for (const id of this.#nodes) issues.push(...this.#blockIssues(id, registered));
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

  /** The topological wave decomposition: the first wave is every no-dependency task, each
   *  later wave the tasks whose dependencies all sit in earlier waves. A dependency that can
   *  never be satisfied (a phantom id, or a cycle) keeps its task unwaved — the derivation
   *  halts instead of recursing. */
  batches(): number[][] {
    const waves: number[][] = [];
    const done = new Set<number>();
    let pending = [...this.#nodes];
    while (pending.length > 0) {
      const wave = pending.filter((id) => this.depsOf(id).every((dep) => done.has(dep)));
      if (wave.length === 0) break;
      waves.push(wave);
      for (const id of wave) done.add(id);
      pending = pending.filter((id) => !done.has(id));
    }
    return waves;
  }

  /** The not-yet-done tasks whose dependencies are all done, ascending — the frontier a
   *  dispatch may take. */
  frontier(done: ReadonlySet<number>): readonly number[] {
    return this.#nodes.filter(
      (id) => !done.has(id) && this.depsOf(id).every((dep) => done.has(dep)),
    );
  }

  /** THE one rendered line of a graph issue: `{kind}@T{task}: {message}`. The gate's
   *  `details` row and the contract row both print these bytes, so the template has one
   *  author. */
  static detailLine(issue: GraphIssue): string {
    return `${issue.kind}@T${issue.task}: ${issue.message}`;
  }

  /** The per-block failure classes, in a stable order (missing-edge, missing-id,
   *  self-loop). */
  #blockIssues(id: number, registered: ReadonlySet<number>): readonly GraphIssue[] {
    const edge = this.#edges.get(id) ?? { declared: false, deps: [] };
    if (!edge.declared) {
      return [
        {
          kind: "missing-edge",
          task: id,
          message: `task ${id} declares no **DependsOn** edge`,
          fix: "add a - **DependsOn**: line (`none` = the explicit no-dependency declaration)",
        },
      ];
    }
    const issues: GraphIssue[] = [];
    const deps = this.depsOf(id);
    const missing = deps.filter((dep) => !registered.has(dep));
    if (missing.length > 0) {
      issues.push({
        kind: "missing-id",
        task: id,
        message: `task ${id} depends on unregistered task ${missing.join(", ")}`,
        fix: `set **DependsOn** to a task id present in the plan (${missing.join(", ")} is not)`,
      });
    }
    if (deps.includes(id)) {
      issues.push({
        kind: "self-loop",
        task: id,
        message: `task ${id} depends on itself`,
        fix: `a task may never depend on its own number — drop ${id} from the block's **DependsOn**`,
      });
    }
    return issues;
  }

  /** The cycle class — the LOWEST task id in the topological remainder (self-loops are
   *  excluded: they own their own class), or null when the edges form a DAG. */
  #cycleMember(): number | null {
    const indegree = new Map<number, number>();
    const dependents = new Map<number, Set<number>>();
    for (const id of this.#nodes) {
      indegree.set(id, 0);
      dependents.set(id, new Set());
    }
    for (const id of this.#nodes) {
      for (const dep of this.depsOf(id).filter((value) => value !== id)) {
        if (!indegree.has(dep)) continue; // a phantom can never join a real cycle
        indegree.set(id, (indegree.get(id) ?? 0) + 1);
        dependents.get(dep)?.add(id);
      }
    }
    const remaining = new Set(this.#nodes);
    const queue = this.#nodes.filter((id) => indegree.get(id) === 0);
    while (queue.length > 0) {
      const id = queue.shift() as number;
      remaining.delete(id);
      for (const dependent of dependents.get(id) ?? []) {
        const next = (indegree.get(dependent) ?? 0) - 1;
        indegree.set(dependent, next);
        if (next === 0) queue.push(dependent);
      }
    }
    return remaining.size === 0 ? null : Math.min(...remaining);
  }

  /** One block's extracted edge record — the section's PRESENCE for the missing-edge class
   *  and the grammar's own dependency read for the ids. */
  static #edgeOf(block: TaskBlock, blocks: TaskBlocks): EdgeRecord {
    const declared = block.sections.some((section) => section.key === "DependsOn");
    return declared
      ? { declared: true, deps: [...blocks.dependsOnOf(block)] }
      : { declared: false, deps: [] };
  }
}
