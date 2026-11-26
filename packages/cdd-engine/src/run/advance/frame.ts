// packages/cdd-engine/src/run/advance/frame.ts
// One round's frame — the argv-side input assembled ONCE into the facts a dispatch needs.
//
// INVARIANT — the assembly is a READ: it composes a frame from injected readers (the slug
// index, the plan source, the document read), so this file holds zero `node:fs`, zero
// markdown parse, zero YAML parse and zero slug guess. Every path it names is spelled by the
// path basis it was handed, and a document's identity is the slug the document DECLARES.
//
// Three consequences the shape is built around:
//   · the same argv-side input assembles the same frame twice — one slug judgment, one plan
//     read, one identity-document read;
//   · a failure is a DECLARED value, never a throw and never a sentence: `read-failure`
//     carries the coordinate and `usage` carries one member of the closed union this file
//     owns (`UsageReason`). The bytes a consumer prints for a member belong to the render
//     face, and this file spells none of them;
//   · `--tasks` is the ONE usage member this assembly can reach. Every other flag's value
//     domain is refused at the parse layer (a declared flag with a declared domain), so the
//     parse layer's refusals are not members of this union.
//
// The `UsageReason` members name FACTS with their own fill values (a flag spelling, a
// command word, a coordinate, an ordered miss list) — never a whole sentence; the byte table
// that renders them lives in `surface/render/usage.ts`, which reads this union type-only.
//
// Module-level exports are types and the class — zero behaviour-carrying bare functions.

import { TARGET_TYPE_VALUES } from "../../docs/identity/types.ts";
import { TaskGraph } from "../../docs/judging/task-graph.ts";
import type { RepoPath, RepoRoot } from "../../env/paths/root.ts";
import type { SlugIndex } from "../../env/paths/slug-index.ts";
import type { PlanText } from "../../env/vcs/plan-source.ts";
import type { RoundPhase } from "../dispatch/child.ts";
import { RoundIdentity } from "../ledger/identity.ts";
import type { LineIdentity, LinePhase } from "./line-phase.ts";
import type { PipelineInput } from "./pipeline.ts";
import type { RouteTarget, TargetType } from "./target-faces.ts";

/** The work commands a frame can be assembled for. */
export type WorkVerb = "implement" | "review" | "fix" | "docs-fix";

/** One board miss — a flag spelling and the coordinate it named. */
export interface BoardMiss {
  /** The flag spelling the caller used (`--plan` · `--spec`). */
  readonly flag: string;
  /** The coordinate the flag named. */
  readonly target: string;
}

/**
 * The usage union — one member per fact kind, each carrying its OWN fill values. The members
 * are declared HERE and rendered nowhere in this segment.
 */
export type UsageReason =
  /** A required `--tasks` was not given (the one required-flag member that reaches here). */
  | { readonly kind: "missing-tasks" }
  /** A skeleton command named no target. */
  | { readonly kind: "missing-skeleton-target" }
  /** A json-face command was handed a target it does not take. */
  | { readonly kind: "extra-target"; readonly target: string }
  /** A board command named neither `--plan` nor `--spec`. */
  | { readonly kind: "missing-plan-or-spec" }
  /** `--tasks` named an id the plan does not declare. */
  | { readonly kind: "unknown-task"; readonly command: string; readonly task: number }
  /** A pure command was handed `--dry-run`, which it does not take. */
  | { readonly kind: "dry-run-scope"; readonly command: string }
  /** A document could not be read. */
  | { readonly kind: "read-failure"; readonly target: string }
  /** A document could not be written. */
  | { readonly kind: "write-failure"; readonly target: string }
  /** The base artifact already stands at another base. */
  | { readonly kind: "base-conflict"; readonly existing: string }
  /** A board named targets the tree does not resolve — the ordered miss list. */
  | { readonly kind: "board-unmatched"; readonly misses: readonly BoardMiss[] }
  /** A board could not read the document one flag named. */
  | { readonly kind: "board-unreadable"; readonly flag: string; readonly target: string }
  /** The base artifact is absent or corrupt. */
  | { readonly kind: "base-absent"; readonly target: string }
  /** A work command found no dispatchable frame (the ledger holds no open round). */
  | { readonly kind: "no-frame"; readonly command: string };

/** The assembly's failure values — the usage union, or a plan read that failed at a
 *  coordinate. */
export type Usage = { readonly kind: "usage"; readonly reason: UsageReason };

/** A plan read that did not produce text — the coordinate rides with it, unchanged. */
export interface ReadFailure {
  readonly kind: "read-failure";
  readonly target: string;
}

/** The argv-side input of one work command — the command word, its target type and the
 *  flags as the caller spelled them. */
export interface FrameRequest {
  /** The command word (`implement` · `review` · `fix` · `docs-fix`). */
  readonly command: string;
  /** The target type the command named. */
  readonly type: TargetType;
  /** `--tasks`, verbatim (the wave face's task group). */
  readonly tasks?: string;
  /** `--plan`, verbatim. */
  readonly plan?: string;
  /** `--spec`, verbatim. */
  readonly spec?: string;
  /** The explicit takeover flag. It never crosses a live holder — the gate's own in-flight
   *  row decides that. */
  readonly recover?: boolean;
}

/** One document's declared identity facts — read by the caller's document face, never parsed
 *  here. */
export interface DocFacts {
  /** The slug the document declares; null when it declares none. */
  readonly slug: string | null;
  /** The `doc-type:` the document declares, when it declares one this engine knows. */
  readonly docType: TargetType | null;
  /** The `program:` the document declares (the parent charter's slug). */
  readonly program: string | null;
}

/** The readers the assembly composes from — `env/` and `docs/` behind one narrow seam. */
export interface FrameReads {
  /** The path basis: the ONE relativize/resolve pair. */
  readonly root: RepoRoot;
  /** The scan of the doc roots — a slug answers a unique path or an ambiguous set. It is a
   *  READ FUNCTION because one command scans once: a scan taken at construction would answer
   *  a stale document set. */
  readonly index: () => SlugIndex;
  /** The plan source's argv face. */
  readonly planText: (target: RepoPath) => PlanText;
  /** A document's declared identity facts; null when the document cannot be read. */
  readonly docFacts: (target: RepoPath) => DocFacts | null;
}

/** The line facts the frame's phase cells come from — the ONE ledger walk. */
export interface FrameLines {
  /** The one line walk every phase cell is read off. */
  readonly walk: LinePhase;
  /** The attempt number a dispatch of `(key, op, cycle)` takes — allocated ONCE, from the
   *  record's own attempts. */
  readonly attemptOf: (key: string, op: "implement" | "review" | "fix", cycle: number) => number;
}

/** The construction facts. */
export interface FrameOptions {
  readonly reads: FrameReads;
  readonly lines: FrameLines;
}

/** One assembled round's facts — everything a dispatch needs and nothing it must re-derive. */
export interface FrameFacts {
  /** The success discriminator — the outcome union's own tag. */
  readonly kind: "frame";
  /** The command word the caller typed. */
  readonly command: string;
  /** Whether the explicit takeover flag was given. */
  readonly recover: boolean;
  /** The dispatch phase this frame runs. */
  readonly phase: RoundPhase;
  /** The target type. */
  readonly type: TargetType;
  /** The phase's workspace identity. */
  readonly slug: string;
  /** The ledger key the round records under. */
  readonly key: string;
  /** The judged document / the branch's plan; null off the doc-and-branch faces. */
  readonly doc: string | null;
  /** The plan document's coordinate; null when the frame carries none. */
  readonly planPath: string | null;
  /** The plan's text, as read (null off the plan-sourced faces). */
  readonly planText: string | null;
  /** The plan's graph, when the plan read produced one. */
  readonly graph: TaskGraph | null;
  /** The requested task ids, ascending. */
  readonly tasks: readonly number[];
  /** The render target the `next:` literal reads. */
  readonly target: RouteTarget | null;
  /** The line identity cells. */
  readonly identity: LineIdentity;
  /** The identity document's declared `program:` (the parent charter's slug), when it
   *  declares one. */
  readonly program: string | null;
  /** The parent charter's coordinate, when the `program:` resolved to exactly one
   *  document. */
  readonly overall: string | null;
  /** The pipeline frontier's four declared cells. */
  readonly pipeline: PipelineInput;
  /** The round number this frame dispatches under. */
  readonly round: number;
  /** The attempt on that round. */
  readonly attempt: number;
  /** The phase's workspace directory and id — the dispatch's own coordinates. */
  readonly workspace: { readonly dir: string; readonly id: string };
}

/** What one assembly answered: a frame, or one of the two declared failures. */
export type FrameOutcome = FrameFacts | Usage | ReadFailure;

/** The graph construction's one guarded entry — a plan whose block grammar breaks yields no
 *  graph, and the frame then declares no task set (the plan read's own failure belongs to the
 *  document slice). */
const graphOf = (text: string): TaskGraph | null => {
  try {
    return TaskGraph.parse(text);
  } catch {
    return null;
  }
};

/**
 * Frame — the scene assembly. Invariant: one argv-side input assembles one frame from
 * injected readers, and every failure is a declared value (see the file's header).
 */
export class Frame {
  readonly #reads: FrameReads;
  readonly #lines: FrameLines;

  constructor(opts: FrameOptions) {
    this.#reads = opts.reads;
    this.#lines = opts.lines;
  }

  /** Assemble one round's frame. */
  of(request: FrameRequest): FrameOutcome {
    if (!(TARGET_TYPE_VALUES as readonly string[]).includes(request.type)) {
      throw new Error(`Frame: "${String(request.type)}" is not a declared target type`);
    }
    const taskIds = Frame.#tasksOf(request);
    if (taskIds.failure !== null) return taskIds.failure;
    const planPath = request.plan === undefined ? null : this.#reads.root.relativize(request.plan);
    const plan = planPath === null ? null : this.#reads.planText(planPath);
    if (plan !== null && plan.kind === "read-failure") {
      return { kind: "read-failure", target: plan.target };
    }
    const graph = plan !== null && plan.kind === "text" ? graphOf(plan.value) : null;
    const unknown = Frame.#unknownTaskOf(taskIds.ids, graph);
    if (unknown !== null) {
      return {
        kind: "usage",
        reason: { kind: "unknown-task", command: request.command, task: unknown },
      };
    }
    const index = this.#reads.index();
    const slug = this.#slugOf(request, planPath, plan, index);
    if (slug.kind !== "ok") return slug.failure;
    const identity = this.#identityOf(slug.slug, index);
    const doc = Frame.#judgedDocOf(request, identity.doc, planPath);
    const target = this.#targetOf(request.type, doc, planPath, taskIds.ids);
    const key = this.#keyOf(request.type, taskIds.ids);
    const phase = this.#phaseOf(request.type, key);
    if (phase === null) {
      return { kind: "usage", reason: { kind: "no-frame", command: request.command } };
    }
    const round = this.#roundOf(key, phase);
    return {
      kind: "frame",
      command: request.command,
      recover: request.recover === true,
      phase,
      type: request.type,
      slug: slug.slug,
      key,
      doc,
      planPath: planPath === null ? null : String(planPath),
      planText: plan !== null && plan.kind === "text" ? plan.value : null,
      graph,
      tasks: taskIds.ids,
      target,
      program: identity.program,
      overall: identity.overall,
      identity: this.#lines.walk.identityOf({
        type: request.type,
        doc,
        plan: planPath === null ? null : String(planPath),
      }),
      pipeline: {
        specType: identity.docType,
        specPath: identity.doc,
        planPath: planPath === null ? null : String(planPath),
        graph,
      },
      round,
      attempt: this.#lines.attemptOf(key, Frame.#opOfPhase(phase), round),
      workspace: { dir: slug.slug, id: slug.slug },
    };
  }

  /** The flags among `--plan` / `--spec` whose coordinate resolves no document identity —
   *  the ordered miss list a board reports. A read-only probe: it judges no parse and
   *  fabricates no identity. */
  missesOf(request: FrameRequest): readonly BoardMiss[] {
    const misses: BoardMiss[] = [];
    const named: readonly (readonly [string, string | undefined])[] = [
      ["--plan", request.plan],
      ["--spec", request.spec],
    ];
    for (const [flag, value] of named) {
      if (value === undefined) continue;
      const facts = this.#reads.docFacts(this.#reads.root.relativize(value));
      if (facts === null || facts.slug === null) misses.push({ flag, target: value });
    }
    return misses;
  }

  /** The requested task ids — `--tasks` absent is the ONE usage member this assembly
   *  reaches; a malformed value is the parse layer's refusal, so it reads as no ids. */
  static #tasksOf(request: FrameRequest): { ids: readonly number[]; failure: Usage | null } {
    // The task group is the WAVE face's own required flag; every other face carries no task
    // set, so a missing `--tasks` there is not a miss.
    const raw = request.tasks;
    if (raw === undefined) {
      return request.type === "wave"
        ? { ids: [], failure: { kind: "usage", reason: { kind: "missing-tasks" } } }
        : { ids: [], failure: null };
    }
    const ids = raw
      .split(",")
      .map((part) => part.trim())
      .filter((part) => /^\d+$/.test(part))
      .map((part) => Number(part));
    return { ids: [...new Set(ids)].sort((left, right) => left - right), failure: null };
  }

  /** The first requested id the plan does not declare — the `unknown-task` judgment reads the
   *  PLAN's task set, never a literal list. A frame with no graph declares no task. */
  static #unknownTaskOf(ids: readonly number[], graph: TaskGraph | null): number | null {
    if (graph === null) return ids[0] ?? null;
    const declared = new Set(graph.nodes());
    return ids.find((id) => !declared.has(id)) ?? null;
  }

  /** The phase's slug — the declared `slug:` of the plan (the plan-sourced faces) or of the
   *  named specification. An unreadable or absent declaration is the read failure this
   *  assembly owns, because no slug means no workspace. */
  #slugOf(
    request: FrameRequest,
    planPath: RepoPath | null,
    plan: PlanText | null,
    index: SlugIndex,
  ): { kind: "ok"; slug: string } | { kind: "fail"; failure: ReadFailure | Usage } {
    const source = this.#identityCoordinateOf(request, planPath);
    if (source === null) {
      return { kind: "fail", failure: { kind: "read-failure", target: request.plan ?? "" } };
    }
    const facts = this.#reads.docFacts(source);
    if (facts === null) return { kind: "fail", failure: { kind: "read-failure", target: source } };
    if (facts.slug === null) {
      return { kind: "fail", failure: { kind: "read-failure", target: source } };
    }
    if (plan !== null && plan.kind === "ambiguous") {
      return { kind: "fail", failure: { kind: "read-failure", target: source } };
    }
    if (index.lookup(facts.slug).kind === "absent") {
      return { kind: "fail", failure: { kind: "read-failure", target: source } };
    }
    return { kind: "ok", slug: facts.slug };
  }

  /** The coordinate whose declared slug names the phase — the specification when the command
   *  named one, else the plan. */
  #identityCoordinateOf(request: FrameRequest, planPath: RepoPath | null): RepoPath | null {
    if (request.spec !== undefined) return this.#reads.root.relativize(request.spec);
    if (planPath !== null) return planPath;
    return null;
  }

  /** The same-slug IDENTITY document — the document of that slug which declares a
   *  non-plan type word (the plan is the slug's plan, never the phase's identity), plus the
   *  charter chain its `program:` names. An ambiguous slug is resolved by that DECLARATION,
   *  never by a first pick: the path is the declaring document's own. */
  #identityOf(
    slug: string,
    index: SlugIndex,
  ): {
    doc: string | null;
    docType: TargetType | null;
    program: string | null;
    overall: string | null;
  } {
    const entry = index.lookup(slug);
    const rels = entry.kind === "unique" ? [entry.rel] : entry.kind === "invalid" ? entry.rels : [];
    for (const rel of rels) {
      const facts = this.#reads.docFacts(rel);
      if (facts === null || facts.docType === null || facts.docType === "plan") continue;
      return {
        doc: rel,
        docType: facts.docType,
        program: facts.program,
        overall: this.#charterOf(facts.program, index),
      };
    }
    return { doc: null, docType: null, program: null, overall: null };
  }

  /** The parent charter's coordinate, resolved by the slug the `program:` names — the
   *  index's own set answer, so an ambiguous charter resolves to nothing rather than a
   *  first pick. */
  #charterOf(program: string | null, index: SlugIndex): string | null {
    if (program === null) return null;
    const entry = index.lookup(program);
    return entry.kind === "unique" ? entry.rel : null;
  }

  /** The document this frame JUDGES — the coordinate the caller named, never a derived one: a
   *  `--spec` command judges that document, a `--plan` command judges the plan. Absent a named
   *  coordinate, the resolved identity document is the doc face's own answer. */
  static #judgedDocOf(
    request: FrameRequest,
    identityDoc: string | null,
    planPath: RepoPath | null,
  ): string | null {
    if (request.spec !== undefined) return request.spec;
    if (request.plan !== undefined && planPath !== null) return planPath;
    return identityDoc;
  }

  /** The render target the `next:` literal reads. */
  #targetOf(
    type: TargetType,
    doc: string | null,
    planPath: RepoPath | null,
    tasks: readonly number[],
  ): RouteTarget | null {
    if (type === "wave") {
      return { type, id: tasks.join(","), ...(planPath === null ? {} : { plan: planPath }) };
    }
    if (type === "branch") {
      return { type, id: "branch", ...(planPath === null ? {} : { plan: planPath }) };
    }
    return doc === null ? null : { type, id: doc };
  }

  /** The ledger key this frame records under — the wave's task-group line, else the line's
   *  stable word (never the argv spelling, so a moved path cannot fork one line in two). */
  #keyOf(type: TargetType, tasks: readonly number[]): string {
    return RoundIdentity.lineWordOf(type, tasks.join(","));
  }

  /** The phase this frame runs — read off the ONE line walk. */
  #phaseOf(type: TargetType, key: string): RoundPhase | null {
    if (type === "wave") {
      return this.#lines.walk.wavePhaseOf(RoundIdentity.splitLineWord(key).key);
    }
    return this.#lines.walk.phaseOf(key, type);
  }

  /** The round number one phase dispatches under: an implement round is the fixed family's
   *  first cycle, a fix round sources its review's latest completed cycle, the review-lead
   *  round takes the next increment. */
  #roundOf(key: string, phase: RoundPhase): number {
    const line = this.#lines.walk;
    if (phase === "implement") return 1;
    if (phase === "fix") {
      const completed = line.completedCyclesOf(key, "review");
      return completed.length > 0 ? Math.max(...completed) : 1;
    }
    return line.completedCyclesOf(key, phase).length + 1;
  }

  /** The ledger op a phase word records under — a branch review rides `review`. */
  static #opOfPhase(phase: RoundPhase): "implement" | "review" | "fix" {
    return phase === "branch-review" ? "review" : phase;
  }
}
