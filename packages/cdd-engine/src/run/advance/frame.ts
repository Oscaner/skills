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
//     face, and this file spells none of them. A line that holds NO open round is not a
//     usage either: the assembly answers the frame the REQUEST asks for and marks it closed,
//     so the tree's gates judge it before the line leg answers the closure with its own row
//     — the scene carries no open phase, and the closure is a fact (`FrameFacts#closed`),
//     never a read failure;
//   · `--tasks` is the ONE usage member this assembly can reach. Every other flag's value
//     domain is refused at the parse layer (a declared flag with a declared domain), so the
//     parse layer's refusals are not members of this union.
//
// The `UsageReason` members name FACTS with their own fill values (a flag spelling, a
// command word, a coordinate, an ordered miss list) — never a whole sentence; the byte table
// that renders them lives in `surface/render/usage.ts`, which reads this union type-only.
//
// Module-level exports are types and the class — zero behaviour-carrying bare functions.

import { TaskBlocks } from "../../docs/grammar/task-blocks.ts";
import { TARGET_TYPE_VALUES } from "../../docs/identity/types.ts";
import { FileDeclarations } from "../../docs/judging/invariants.ts";
import { TaskGraph } from "../../docs/judging/task-graph.ts";
import type { RepoPath, RepoRoot } from "../../env/paths/root.ts";
import type { SlugIndex } from "../../env/paths/slug-index.ts";
import type { PlanText } from "../../env/vcs/plan-source.ts";
import type { RoundPhase } from "../dispatch/child.ts";
import { RoundIdentity } from "../ledger/identity.ts";
import type { LineIdentity, LinePhase } from "./line-phase.ts";
import type { PipelineInput } from "./pipeline.ts";
import { type RouteTarget, TargetFaces, type TargetType } from "./target-faces.ts";

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
  | { readonly kind: "base-absent"; readonly target: string };

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
  /** `--reviews`, verbatim (the fix face's requesting carrier). The flag's VALUE alone: which
   *  carrier the round actually reads is the three-branch priority
   *  (`AdvanceReads#reviewsPathOf`), so this assembly decides nothing about it. */
  readonly reviews?: string;
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
  /** The declared `version:`, when the document states one — the board row's `v<n>` cell. */
  readonly version: string | null;
  /** The declared `status:`, when the document states one — the board row's second cell. */
  readonly status: string | null;
  /** The declared `title:`, when the document states one — the program board's annotation. */
  readonly title: string | null;
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
  /** Whether one repo-relative target is present on disk — the board's "no docs match"
   *  attribution distinguishes an ABSENT path from a present-but-unreadable one, and only
   *  the first is a miss. */
  readonly exists: (target: RepoPath) => boolean;
  /** Whether one repo-relative coordinate lies inside a declared document root — the same
   *  attribution's other half: a path outside the roots names no document at all. */
  readonly insideDocs: (target: RepoPath) => boolean;
}

/** The line facts the frame's phase cells come from — the ONE ledger walk. */
export interface FrameLines {
  /** The one line walk every phase cell is read off. */
  readonly walk: LinePhase;
  /** The attempt number a dispatch of `(key, op, cycle)` takes — allocated ONCE, from the
   *  record's own attempts. */
  readonly attemptOf: (key: string, op: "implement" | "review" | "fix", cycle: number) => number;
  /** The wave face's LINE task group — the derived frontier over the ledger's closure set,
   *  read off the pipeline's own decomposition. A wave line records under THIS group, never
   *  under the group the request spelled: the ledger keys a wave by the batch it dispatched,
   *  so a request for another batch names the line's own carriers (its review, its brief)
   *  while the wave gate judges the group that was asked for. `null` when the plan yields no
   *  ready batch — a plan read that is not ready, or a drained plan. */
  readonly readyGroupOf: (graph: TaskGraph | null) => string | null;
}

/** The construction facts. */
export interface FrameOptions {
  readonly reads: FrameReads;
  readonly lines: FrameLines;
  /** Whether a document ABOVE this request moved past the version its review bound — the ONE
   *  drift station's answer, injected so this assembly holds no second drift judgment. A
   *  closed line is not automatically undispatchable: when a face above it moved, the movement
   *  is the refusal's own cause and the request still assembles a frame for the line leg to
   *  refuse on. */
  readonly driftedUpstream: (facts: {
    readonly type: TargetType;
    readonly pipeline: PipelineInput;
  }) => boolean;
}

/** The SCENE's facts — everything the assembly reads, and nothing that depends on which
 *  phase the line is at. The phase cells live on `FrameFacts` alone, so a scene is a value
 *  every reader (the board included) can hold while only a dispatchable round names a
 *  round. */
export interface FrameScene {
  /** The command word the caller typed. */
  readonly command: string;
  /** Whether the explicit takeover flag was given. */
  readonly recover: boolean;
  /** The `--reviews` value the caller named, projected onto the repository basis; null when
   *  the request named none. The fix face's requesting carrier — carried, never interpreted
   *  here. */
  readonly reviews: string | null;
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
  /** The plan tasks whose `Files` declaration names no path — the verification-wave cell a
   *  round's completion judgment reads. The PLAN DOCUMENT is the only source (never the
   *  diff), and a plan that is absent, unreadable or broken declares no row, so a wave never
   *  reads as a verification wave on a plan this assembly could not see. */
  readonly emptyFileTasks: ReadonlySet<number>;
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
  /** The phase's workspace directory and id — the dispatch's own coordinates. */
  readonly workspace: { readonly dir: string; readonly id: string };
}

/** Where one line sits for the request being assembled (see `FrameFacts#state`). */
export type FrameState = "open" | "reopened" | "closed";

/** One assembled round's facts — everything a dispatch needs and nothing it must re-derive. */
export interface FrameFacts extends FrameScene {
  /** The success discriminator — the outcome union's own tag. */
  readonly kind: "frame";
  /** Where the line SITS for this request, and the cell the line leg's document rows read
   *  (`run/advance/line-rows.ts`):
   *    · `open` — a dispatchable round the frame names;
   *    · `reopened` — the line's document moved past the version its review bound, so the round
   *      it owes is that review: the requested verb is refused with the frontier hop's reason;
   *    · `closed` — nothing is owed, so the closure's own token answers.
   *  The frame still names the phase the request ASKS for in the last two states (the
   *  pre-flight judges a request, not a round), and no second caller re-derives this cell. */
  readonly state: FrameState;
  /** The dispatch phase this frame RUNS: the phase the request asks for (the verb's own word,
   *  or the face's review lead). This is the round's identity — its op, its cycle allocation
   *  and every artifact it names — and it is the ONE allocation the shipped engine makes
   *  (`ConsumedRound`): a fix round takes its review's latest COMPLETED cycle, a review the
   *  next one. The line's own open round is a separate cell (`openPhase`), because a request
   *  that does not match it is exactly what the line leg refuses. */
  readonly phase: RoundPhase;
  /** The line's OPEN round for this request — null when its rounds lie on the closure side
   *  (`FrameFacts#state` then says which closure face applies). The line leg reads this cell to
   *  decide whether the request matches the round the line actually owes. */
  readonly openPhase: RoundPhase | null;
  /** The round number this frame dispatches under. */
  readonly round: number;
  /** The attempt on that round. */
  readonly attempt: number;
}

/** What one assembly answered: a frame, or one of the two declared failures. A line holding no
 *  open round is NOT a failure of this read — it assembles the frame its request asks for and
 *  says so (`FrameFacts#closed`), because the closure is the line leg's row and the tree's
 *  gates judge the request before it. */
export type FrameOutcome = FrameFacts | Usage | ReadFailure;

/** The plan's task blocks — the ONE extraction this assembly makes, so the graph and the
 *  empty-`Files` cell read the same blocks. A plan whose block grammar breaks yields no
 *  extraction (the absence is a declared fact downstream, never a throw): the plan read's
 *  failure belongs to the document slice. */
const blocksOf = (text: string): TaskBlocks | null => {
  try {
    return TaskBlocks.parse(text, "plan");
  } catch {
    return null;
  }
};

/** The graph of one extraction — no extraction, no graph, and the frame then declares no task
 *  set. */
const graphOf = (blocks: TaskBlocks | null): TaskGraph | null =>
  blocks === null ? null : new TaskGraph(blocks);

/** The tasks of one extraction whose `Files` declaration names no path. An empty result is a
 *  REAL claim ("this plan changes files"), so the read fails SAFE: an absent section, a blank
 *  value and a placeholder declare zero paths, and an unrecognized value stays a path. */
const emptyFilesOf = (blocks: TaskBlocks | null): ReadonlySet<number> => {
  const empty = new Set<number>();
  if (blocks === null) return empty;
  for (const block of blocks.blocks()) {
    if (FileDeclarations.of(block).length === 0) empty.add(block.id);
  }
  return empty;
};

/**
 * Frame — the scene assembly. Invariant: one argv-side input assembles one frame from
 * injected readers, and every failure is a declared value (see the file's header).
 *
 * Rule zero (over the 200-line class limit): the class stays whole because it is ONE
 * assembly — the slug judgment, the plan read, the identity chain, the target, the pipeline
 * cells and the round's dispatch cells are read in a single pass from a single argv-side
 * input; a split would let a caller assemble half a frame and dispatch it.
 */
export class Frame {
  readonly #reads: FrameReads;
  readonly #lines: FrameLines;
  readonly #driftedUpstream: FrameOptions["driftedUpstream"];

  constructor(opts: FrameOptions) {
    this.#reads = opts.reads;
    this.#lines = opts.lines;
    this.#driftedUpstream = opts.driftedUpstream;
  }

  /** Assemble one round's frame. */
  of(request: FrameRequest): FrameOutcome {
    if (!(TARGET_TYPE_VALUES as readonly string[]).includes(request.type)) {
      throw new Error(`Frame: "${String(request.type)}" is not a declared target type`);
    }
    const taskIds = Frame.#tasksOf(request);
    if (taskIds.failure !== null) return taskIds.failure;
    // The argv path VALUES are the caller's coordinates, projected ONCE here each (`--spec`
    // included) so one input is one out-of-tree report however many readers consume it.
    const namedPlan = request.plan === undefined ? null : this.#reads.root.callerPath(request.plan);
    const namedSpec = request.spec === undefined ? null : this.#reads.root.callerPath(request.spec);
    const namedPlanText = namedPlan === null ? null : this.#reads.planText(namedPlan);
    if (namedPlanText !== null && namedPlanText.kind === "read-failure") {
      return { kind: "read-failure", target: namedPlanText.target };
    }
    const index = this.#reads.index();
    const slug = this.#slugOf(request, namedSpec, namedPlan, namedPlanText, index);
    if (slug.kind !== "ok") return slug.failure;
    // THE PLAN is the plan-sourced face's own document when argv names it, else the slug's
    // plan (a phase's registration is one identity document plus one plan). A derived plan
    // that does not read declares no plan at all — a derived face is never a usage failure.
    const planPath = namedPlan ?? this.#derivedPlanOf(slug.slug, index);
    const plan =
      planPath === null
        ? null
        : planPath === namedPlan
          ? namedPlanText
          : Frame.#derivedRead(this.#reads.planText(planPath));
    const blocks = plan !== null && plan.kind === "text" ? blocksOf(plan.value) : null;
    const graph = graphOf(blocks);
    const unknown = Frame.#unknownTaskOf(taskIds.ids, graph);
    if (unknown !== null) {
      return {
        kind: "usage",
        reason: { kind: "unknown-task", command: request.command, task: unknown },
      };
    }
    const identity = this.#identityOf(slug.slug, index);
    const doc = Frame.#judgedDocOf(request, namedSpec, identity.doc, planPath);
    const target = this.#targetOf(request.type, doc, planPath, taskIds.ids);
    const key = this.#keyOf(request.type, taskIds.ids, graph);
    const scene: FrameScene = {
      command: request.command,
      recover: request.recover === true,
      reviews:
        request.reviews === undefined ? null : String(this.#reads.root.callerPath(request.reviews)),
      type: request.type,
      slug: slug.slug,
      key,
      doc,
      planPath: planPath === null ? null : String(planPath),
      planText: plan !== null && plan.kind === "text" ? plan.value : null,
      graph,
      emptyFileTasks: emptyFilesOf(blocks),
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
      workspace: { dir: slug.slug, id: slug.slug },
    };
    // The phase is a DISPATCH cell: the line's OPEN round, or — when its rounds lie on the
    // closure side — the phase the request ASKS for. The closure does not fail this read: the
    // gates judge the REQUEST (they need its phase, its round and its station values), and the
    // line leg answers the closure with its own row afterwards. Translating it into a usage
    // value here would answer "nothing to dispatch" before any gate spoke.
    const openPhase = this.#roundPhaseOf({
      type: request.type,
      key,
      command: request.command,
      // The line's OWN document — the judged coordinate, not the slug's identity document:
      // a `--plan` request's line is judged at the plan while the slug's identity is the
      // phase specification, and reading the wrong one would report drift against the wrong
      // bytes (a plan line would "move" whenever its specification did).
      doc,
      pipeline: scene.pipeline,
    });
    const phase = Frame.#expectedPhaseOf(request.type, request.command);
    const round = this.#roundOf(key, phase);
    return {
      ...scene,
      kind: "frame",
      state: this.#stateOf({ open: openPhase, type: request.type, key, doc }),
      openPhase,
      phase,
      round,
      attempt: this.#lines.attemptOf(key, Frame.#opOfPhase(phase), round),
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
      const rel = this.#reads.root.callerPath(value);
      // A miss is "no document is here": outside the declared roots, or absent on disk. A
      // present-but-unreadable path is NOT a miss — the read failure is the board's own
      // `cannot read` answer, and folding it into "no docs match" would name the wrong fact.
      if (!this.#reads.insideDocs(rel) || !this.#reads.exists(rel)) {
        misses.push({ flag, target: value });
      }
      // A present coordinate whose bytes do not declare an identity is not "no docs match":
      // the frame's own read names it (`cannot read`), and that is the byte a caller repairs
      // against.
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
    namedSpec: RepoPath | null,
    planPath: RepoPath | null,
    plan: PlanText | null,
    index: SlugIndex,
  ): { kind: "ok"; slug: string } | { kind: "fail"; failure: ReadFailure | Usage } {
    const source = Frame.#identityCoordinateOf(namedSpec, planPath);
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
  static #identityCoordinateOf(
    namedSpec: RepoPath | null,
    planPath: RepoPath | null,
  ): RepoPath | null {
    return namedSpec ?? planPath;
  }

  /** The slug's PLAN coordinate — the one indexed document of that slug declaring the plan
   *  type word, so a `--spec` round reads the plan its line is registered with and never a
   *  filename derivation. Null when the slug registers no plan. */
  #derivedPlanOf(slug: string, index: SlugIndex): RepoPath | null {
    const entry = index.lookup(slug);
    const rels = entry.kind === "unique" ? [entry.rel] : entry.kind === "invalid" ? entry.rels : [];
    for (const rel of rels) {
      if (this.#reads.docFacts(rel)?.docType === "plan") return rel;
    }
    return null;
  }

  /** A derived plan read, folded: a coordinate nobody named answers no plan rather than a
   *  usage failure — the argv face owns the failure of a path the caller spelled. */
  static #derivedRead(read: PlanText | null): PlanText | null {
    if (read === null || read.kind === "read-failure") return null;
    return read;
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
    namedSpec: RepoPath | null,
    identityDoc: string | null,
    planPath: RepoPath | null,
  ): string | null {
    if (namedSpec !== null) return namedSpec;
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
   *  stable word (never the argv spelling, so a moved path cannot fork one line in two). A
   *  WAVE keys by the group its LINE holds, which is the derived frontier, never the group the
   *  request spelled: the batch is the line, and a request for another batch is the split the
   *  wave gate reports against the line it named. A plan that yields no ready batch leaves the
   *  request's own group as the line — there is no other line to name. */
  #keyOf(type: TargetType, tasks: readonly number[], graph: TaskGraph | null): string {
    const group =
      type === "wave" ? (this.#lines.readyGroupOf(graph) ?? tasks.join(",")) : tasks.join(",");
    return RoundIdentity.lineWordOf(type, group);
  }

  /** The line's OPEN round for this request — read off the ONE line walk; null when the line
   *  holds no open round (its rounds lie on the closure side), which the assembly records as
   *  `FrameFacts#state` and answers with the phase the REQUEST asks for. The admission arms
   *  below (a review's re-entry, a moved face above) only ever make a CLOSED line name the
   *  round it owes — they never turn a request into the round it asked for. */
  #roundPhaseOf(cells: {
    readonly type: TargetType;
    readonly key: string;
    readonly command: string;
    readonly doc: string | null;
    readonly pipeline: PipelineInput;
  }): RoundPhase | null {
    const { type, key, command, doc, pipeline } = cells;
    if (type === "wave") {
      const open = this.#lines.walk.wavePhaseOf(RoundIdentity.splitLineWord(key).key);
      if (open !== null) return open;
      // A REVIEW command re-enters the line's review lead even when the recorded rounds all
      // sit on the closure side: a review never depends on a dispatchable round (it judges
      // what is on disk), and the wave gate still judges the batch it asked for. Every other
      // verb holds its own phase — but only while nothing above it moved, because a moved
      // document is that request's refusal and the line leg alone can print it.
      return command === "review" || this.#driftedUpstream({ type, pipeline })
        ? Frame.#expectedPhaseOf(type, command)
        : null;
    }
    const open = this.#lines.walk.phaseOf(key, type);
    if (open !== null) return open;
    // A document line's closure is as OF the version its review bound: a document that moved
    // past it owes that review, and the pipeline hop already names the round. So a REVIEW
    // re-enters the line's review lead on exactly that drift (the one row that ADMITS the
    // review the movement owes), while every other verb keeps asking for its own phase — an
    // entry that refused this request without naming the owed review would leave the board's
    // own `next:` command unrunnable.
    if (command === "review" && this.#lines.walk.reopenedAt(key, type, doc)) {
      return TargetFaces.phaseOfHop(type, "review");
    }
    // The same admission for a CLOSED line under a different verb: a moved face above it owns
    // the refusal, so the request assembles the phase it would run under and the line leg
    // names the drift. Nothing moved → no OPEN round: the assembly records where the line sits
    // (`FrameFacts#state`) and the line leg answers it with its own row.
    return this.#driftedUpstream({ type, pipeline }) ? Frame.#expectedPhaseOf(type, command) : null;
  }

  /** Where the line sits for a request whose open round the walk did not answer. A document
   *  line whose reviewed version its document moved past is REOPENED — it owes the review the
   *  pipeline hop already names — and every other such line is CLOSED. The reopen is asked of
   *  the SAME walk read the frame's phase is (`reopenedAt`), never of a second comparison. */
  #stateOf(cells: {
    readonly open: RoundPhase | null;
    readonly type: TargetType;
    readonly key: string;
    readonly doc: string | null;
  }): FrameState {
    if (cells.open !== null) return "open";
    return this.#lines.walk.reopenedAt(cells.key, cells.type, cells.doc) ? "reopened" : "closed";
  }

  /** The phase a command asks the LINE for — the verb's own word (the branch line's review
   *  lead included) or the face's review lead for every other command word. The ONE table read,
   *  so no caller re-spells either side: a `review` on the branch line asks for
   *  `branch-review`, never for the op word `review`. */
  static #expectedPhaseOf(type: TargetType, command: string): RoundPhase {
    if (command === "implement") return "implement";
    if (command === "fix" || command === "docs-fix") return "fix";
    return TargetFaces.phaseOfHop(type, "review");
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
