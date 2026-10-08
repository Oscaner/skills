// packages/cdd-engine/src-next/session/graph.ts
// T6 — the TaskGraph (design spec §3.1): the execution-order single home. The
// graph consumes the SAME doc.ts plan parse instance the dispatch and the lint
// read — the `### Task N:` blocks and their `- **DependsOn**:` fields (the parse
// single home in doc.ts) — and never re-parses the document text. It owns the
// four edge-validation classes (missing-edge / missing-id / self-loop / cycle —
// judged on the NORMALIZED edges: the author's literal is never adjudicated), the
// `batches()` wave decomposition and the `frontier(done)` dynamic face (state.ts's
// Frontier contract). The ExecutionState query surface (doneTasks() / readyBatch()
// as methods — never a standalone state class) is carried here as the run-state
// home (markDone) until the round ledger attests it.
//
// Edge judgment is single-homed here: the four classes are the ONLY edge
// judgments of the new tree — nothing else decides whether an edge is missing,
// dangling, looping or cyclic (the lint reads a block's declared values only to
// know what NOT to suspect, and judges nothing).
//
// Module-level exports are types / the class — zero behavior-carrying bare
// functions (the plan's zero-bare-function discipline).

import { declaredRegistries } from "../contract/declare.ts";
import type { PlanParsed, TaskBlock } from "../contract/doc.ts";
import type { ReferenceEntry } from "../contract/project.ts";
import { Projector } from "../contract/project.ts";
import type { ExecutionState, Frontier } from "./state.ts";

/** The four edge-validation classes — the TaskGraph's judgment vocabulary, all
 *  judged on the NORMALIZED edges (dedupe at the extraction layer + the transitive
 *  reduction — §3.8 the normalization chain; the author's literal declaration is
 *  never adjudicated — a repeated declaration is normalized away, T24). */
export type GraphIssueClass =
  /** a task block declares no `- **DependsOn**:` field (`none`/empty = the explicit no-dependency declaration) */
  | "missing-edge"
  /** an edge references a task id absent from the plan */
  | "missing-id"
  /** a task depends on itself */
  | "self-loop"
  /** a directed dependency cycle among the edges */
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
  /** The dependency ids, DEDUPED at the extraction layer + sorted ascending (the
   *  author's repeated declaration is normalized away — never adjudicated). */
  deps: readonly number[];
}

/** The plan-graph read projection (§3.8) — the task graph + the derived wave chain
 *  + the done/current/pending view, the single projection the `schema get plan-graph`
 *  read and the pre-flight gates display. */
export interface TaskGraphReport {
  /** Each task's dependency ids IN TRANSITIVE-REDUCED form (the direct-only display
   *  surface — the graph-view renders this, never the author's declared superset;
   *  redundant edges are the engine's concern, not the author's). */
  edges: Readonly<Record<number, readonly number[]>>;
  /** The derived wave chain (`batches()`) — the strict-dispatch grouping authority. */
  waves: readonly (readonly number[])[];
  /** The completed task ids, ascending. */
  done: readonly number[];
  /** The first wave holding a not-done task (the in-flight wave); null when all done. */
  current: readonly number[] | null;
  /** The not-done tasks, ascending (the remaining frontier). */
  pending: readonly number[];
}

/**
 * The task graph — nodes are the plan's task ids, one declared edge per block.
 * The task-base consumption, the six-class validate, the batch waves and the
 * execution query surface all read the same shared parse instance.
 */
export class TaskGraph implements Frontier, ExecutionState {
  /** The registered task ids, ascending. */
  readonly #nodes: readonly number[];
  /** Each task's declared edge record, keyed by task id (the AUTHOR's declaration —
   *  validation reads it; the consumption face is the reduction). */
  readonly #edges: ReadonlyMap<number, EdgeRecord>;
  /** The direct-only consumption surface — the transitive reduction of the declared
   *  edges, computed once. EVERY graph consumer (`#depsOf` — batches/frontier/report/
   *  hasPath) reads the REDUCED form; the closure — the wave basis — is preserved by
   *  the reduction, so a redundant declaration is inert, never a wave shift. */
  readonly #reduced: ReadonlyMap<number, readonly number[]>;
  /** The run's completed task ids — the ExecutionState carrier (markDone). */
  readonly #done: Set<number> = new Set();
  /** The derived `DependsOn id` value pattern (whole-token — the declared-edge
   *  values; the SAME derived pattern the reference lint reads, so both edge
   *  consumers share one task-id token domain, never a re-typed literal). */
  readonly #depIdToken: RegExp;

  /** Build from a shared plan parse — the same instance the dispatch and the lint read. */
  constructor(parsed: PlanParsed) {
    this.#depIdToken = new RegExp(
      TaskGraph.#valuePatternOf(
        new Projector(declaredRegistries).reference().plan.entries,
        "DependsOn id",
      ),
    );
    this.#nodes = parsed.taskBlocks.map((block) => block.id).sort((a, b) => a - b);
    const edges = new Map<number, EdgeRecord>();
    for (const block of parsed.taskBlocks) {
      edges.set(block.id, this.#edgeOf(block));
    }
    this.#edges = edges;
    // The direct-only consumption surface — the transitive reduction, computed once
    // from the DECLARED edges: every edge (t → d) whose d is already reachable from
    // another declared dependency of t is dropped. The author declares the full
    // prerequisite set freely; the consumers read the reduced form, and the closure
    // (the wave basis) is preserved by the reduction.
    const reduced = new Map<number, readonly number[]>();
    for (const id of this.#nodes) {
      const raw = edges.get(id)?.deps ?? [];
      reduced.set(
        id,
        raw.filter(
          (dep) => !raw.some((other) => other !== dep && TaskGraph.#reaches(edges, other, dep)),
        ),
      );
    }
    this.#reduced = reduced;
  }

  /** Reachability along a RAW edge map (the reduction's closure test — a DFS). */
  static #reaches(edges: ReadonlyMap<number, EdgeRecord>, from: number, to: number): boolean {
    const seen = new Set<number>();
    const stack = [from];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === to) return true;
      if (seen.has(current)) continue;
      seen.add(current);
      stack.push(...(edges.get(current)?.deps ?? []));
    }
    return false;
  }

  // -------------------------------------------------------------------------
  // the four-class validate (all judged on the normalized edges)
  // -------------------------------------------------------------------------

  /** validate — every failure class of every task, in block order, with the cycle
   *  class last (the graph-level judgment). The per-block classes read the
   *  NORMALIZED edge surface (`#depsOf` — the deduped, transitive-reduced form the
   *  consumers read); the author's literal declaration is never adjudicated. */
  validate(): GraphIssue[] {
    const issues: GraphIssue[] = [];
    const registered = new Set(this.#nodes);
    for (const blockId of this.#nodes) {
      issues.push(...this.#blockIssues(blockId, registered));
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

  /** The per-block failure classes, in a stable order (missing-edge, missing-id,
   *  self-loop) — judged on the block's NORMALIZED edge (`#depsOf`); a missing
   *  **DependsOn** field is the missing-edge class, judged before the edges. */
  #blockIssues(blockId: number, registered: ReadonlySet<number>): GraphIssue[] {
    const edge = this.#edges.get(blockId) ?? { declared: false, deps: [] };
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
    const deps = this.#depsOf(blockId); // the normalized surface (dedupe + reduction)
    const missing = TaskGraph.#unique(deps.filter((id) => !registered.has(id)));
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
    if (deps.includes(blockId)) {
      issues.push(
        this.#issue(
          "self-loop",
          blockId,
          `task ${blockId} depends on itself`,
          `a task may never depend on its own number — drop ${blockId} from the block's **DependsOn**`,
        ),
      );
    }
    return issues;
  }

  /** The cycle class — the lowest task closing a directed cycle (self-loops
   *  excluded: they own the self-loop class); null when the edge graph is a DAG.
   *  Reads the NORMALIZED edge surface (`#depsOf`) — the same face every consumer
   *  reads; the reduction preserves closure, so a cycle can never be normalized
   *  away. */
  #cycleMember(): number | null {
    const indegree = new Map<number, number>();
    const dependents = new Map<number, Set<number>>();
    for (const id of this.#nodes) {
      indegree.set(id, 0);
      dependents.set(id, new Set());
    }
    for (const id of this.#nodes) {
      for (const dep of TaskGraph.#unique(this.#depsOf(id).filter((value) => value !== id))) {
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

  /** The plan-graph read projection — the task graph + the derived wave chain +
   *  the done/current/pending view one method, the schema read and the pre-flight
   *  gates' shared surface (§3.8: one projection, two displays). The edges ride the
   *  TRANSITIVE REDUCTION (the direct-only display); the waves always derive over
   *  the declared closure — a redundant declaration is inert, never a wave shift. */
  report(done: ReadonlySet<number>): TaskGraphReport {
    const edges = this.reduction();
    const waves = this.batches();
    const first = waves.find((wave) => wave.some((id) => !done.has(id))) ?? null;
    return {
      edges,
      waves,
      done: [...done].sort((a, b) => a - b),
      current: first,
      pending: this.#nodes.filter((id) => !done.has(id)),
    };
  }

  /** The transitive reduction — the direct-only dependency surface: every edge
   *  (t → d) whose d is already reachable from ANOTHER declared dependency of t is
   *  removed. The author declares the full prerequisite set freely (redundancy is
   *  harmless — the waves derive over the closure); the engine normalizes the
   *  DISPLAY, never the semantics. */
  reduction(): Readonly<Record<number, readonly number[]>> {
    const out: Record<number, readonly number[]> = {};
    for (const id of this.#nodes) {
      const deps = this.#depsOf(id);
      out[id] = deps.filter(
        (dep) => !deps.some((other) => other !== dep && this.#hasPath(other, dep)),
      );
    }
    return out;
  }

  /** Whether `to` is reachable from `from` along the declared edges (a DFS). */
  #hasPath(from: number, to: number): boolean {
    const seen = new Set<number>();
    const stack = [from];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === to) return true;
      if (seen.has(current)) continue;
      seen.add(current);
      stack.push(...this.#depsOf(current));
    }
    return false;
  }

  // -------------------------------------------------------------------------
  // edge reading
  // -------------------------------------------------------------------------

  /** The dependency ids one task consumes — THE DIRECT-ONLY REDUCTION (§3.8 / direct-only
   *  engine rule): every consumer (batches / frontier / report / reduction / hasPath)
   *  reads the reduced form; the author's redundant declarations are inert. */
  #depsOf(task: number): readonly number[] {
    return this.#reduced.get(task) ?? [];
  }

  /** One block's declared edge record — the `**DependsOn**` field's numeric list,
   *  taken from the field's VALUE PREFIX only (the first `(`/`（` truncates: the
   *  trailing parenthetical rationale is prose — zero participation, §3.8's value
   *  domain contract; a round number in the rationale can never become a phantom
   *  dependency). The extraction layer DEDUPES (a repeated declaration is
   *  normalized away — the author's literal is never adjudicated, §3.8 the
   *  normalization chain). `none`/empty carries zero edges; the field's absence is
   *  recorded separately for the missing-edge class. */
  #edgeOf(block: TaskBlock): EdgeRecord {
    const field = block.fields.find((entry) => entry.key === "DependsOn");
    if (field === undefined) return { declared: false, deps: [] };
    const deps: number[] = [];
    for (const line of field.lines) {
      const prefix = line.split(/[（(]/)[0]!;
      for (const token of prefix.split(/[,\s]+/)) {
        const candidate = token.trim();
        if (this.#depIdToken.test(candidate)) deps.push(Number(candidate));
      }
    }
    return { declared: true, deps: [...new Set(deps)].sort((a, b) => a - b) };
  }

  /** The value pattern of a registered reference entry — a lookup that fails
   *  loudly when the declaration renames an anchor the graph consumes (the same
   *  loud-lookup contract the reference lint's edge scan keeps). */
  static #valuePatternOf(entries: readonly ReferenceEntry[], anchor: string): string {
    const entry = entries.find((row) => row.anchor === anchor);
    if (entry === undefined) {
      throw new Error(`task graph requires the registered reference entry "${anchor}"`);
    }
    return entry.valuePattern ?? "";
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

  /** The `1, 2`-style list renderer for the aggregate messages. */
  static #toList(values: readonly number[]): string {
    return values.join(", ");
  }
}
