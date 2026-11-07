// packages/cdd-engine/src-next/session/dispatch-authority.ts
// P27 §2 — the dispatch authority: ONE verdict over the three legs, in ONE priority
// order (structure → upstream → line, short-circuiting on the first refusal).
//
// Before this object the dispatch question was answered at two call sites by two
// independent authorities: the wave face's phase by `WaveGate.vet` (from
// session/preflight.ts) and the doc/branch face's by `CliGate#lineGate` (from
// face/cli.ts). The order between them was implicit in the two call sites, the two
// refusal vocabularies never met, and the station object (`NextHop`) had no dispatch
// reader at all — so a `next:` could name a round the dispatch face then refused.
//
// The legs:
//   · structure — the pre-flight seam's verdict (tree-clean · in-flight · graph ·
//     plan-ledger · doc-contract), handed in already judged: its inputs (the git
//     tree, the in-flight lock) are the seam's to read, and the seam's report face
//     (the ordered gate rows + the named findings) renders beside the refusal. The
//     leg names no hop — a dirty tree has no `next:` round.
//   · upstream — the station's reviewed-identity + closure pair over the faces that
//     precede the request's face (P27 §2.3): the faces are read off `PIPELINE_FACES`
//     (the ONE order), each judged by ① whether its reviewed identity moved (a doc
//     line's `reviewGate` · a wave line's `briefDrifted`) and ② whether it has closed
//     for the request (a doc line's `lineStateAt` · the wave face's exhaustion over
//     `closedWaves()`). A face the pipeline never entered holds no station — its
//     line carries no round to hold the request — so the request face is the
//     pipeline's own first entry. `waveLineRoute !== null` is never a closure judge:
//     a never-entered face's `active` is null, and a closed-but-drifted wave is ①'s
//     catch, because exhaustion only answers "every task is done".
//   · line — this line's own phase: the wave face's five rows (the `WaveGate` stays
//     the leg's judge) and the doc/branch face's rows (pending-fix · unchanged ·
//     face-closed, plus the drift reopen, which ADMITS the review round).
//
// The verdict's `next` is the pipeline frontier's own hop (`PipelineFrontier#hopOf`)
// — the object the capsule and the board already render, never a second shape and
// never a second derivation. The refusal line is correspondingly ONE line
// (§2.6): `reason · next: <command>` on the line leg, `reason · <wording>` on the
// structure leg (no hop to name). The command renderer itself stays on the face
// plane (the argv channel / host / repo-basis facts are the face's to hold).
//
// Module-level exports are types / the class — zero behavior-carrying bare functions.

import type { Words } from "../face/words.ts";
import {
  type DispatchPhase,
  type RouteTarget,
  TargetFaceTable,
  type TargetType,
  targetFaces,
} from "./faces.ts";
import type { TaskGraph } from "./graph.ts";
import type { DocRevisionRef, Ledger } from "./ledger.ts";
import {
  DISPATCH_REASON,
  type DispatchReason,
  type DocClassVerdict,
  type NextHop,
  type PhaseFaceKey,
  PIPELINE_FACES,
} from "./next.ts";
import { PipelineFrontier, type PipelineFrontierInput } from "./pipeline.ts";
import type { PreFlightVerdict } from "./preflight.ts";
import { WaveGate } from "./wave.ts";

/** The three work verbs a dispatch asks for. */
export type DispatchVerb = "implement" | "review" | "fix";

/** The verdict's partition — the leg that refused, in the priority chain's order
 *  (`structure` → `upstream` → `line`). */
export type DispatchLeg = "structure" | "upstream" | "line";

/** The stable prefix of one hash end in a refusal's diagnosis — long enough to tell the
 *  two ends apart at a glance, short enough for one line (§2.5 leaves the exact
 *  completeness to the implementation; the two ends must stay distinguishable). */
export const DRIFT_HASH_PREFIX = 12;

/** A refusal's drift diagnosis (§2.5) — the MANDATORY detail whenever the reason is
 *  `brief-drift` or `doc-drift`: which layer moved, the line key it moved on, and both
 *  hash ends. One shape for both layers (no second key spelling per layer). */
export interface DispatchDrift {
  /** The moved identity's layer — a wave brief's task-only projection, or a document. */
  readonly layer: "brief" | "doc";
  /** The wave batch key (brief) or the document path (doc). */
  readonly line: string;
  /** The hash the review bound. */
  readonly recorded: string;
  /** The hash the identity holds now. */
  readonly current: string;
}

/** One dispatch's verdict (§2.1) — allowed, or a refusal named by its leg, its
 *  reason token (the ONE table) and the hop the refusal points at. `next` is null
 *  exactly on the structure leg: a structural refusal names no dispatchable round. */
export type DispatchVerdict =
  | { readonly allowed: true }
  | {
      readonly allowed: false;
      readonly leg: DispatchLeg;
      readonly reason: DispatchReason;
      readonly next: NextHop | null;
      /** §2.5 — present exactly when the reason is a drift token. */
      readonly drift?: DispatchDrift;
    };

/** The refusal face — the verdict's `allowed: false` arm. */
export type DispatchRefusal = Extract<DispatchVerdict, { readonly allowed: false }>;

/** This line's phase as ONE read — the identity gate (`reviewGate`), the drift
 *  reopen's scope (`docReopens`, which ADMITS the review lead), the derived pending
 *  fix and the ledger's rounds/routes judge (`linePhase`), composed once. TWO hosts
 *  read this value — the verdict's line leg here and the face gate's `lineGate` — so
 *  the line-phase fact is derived in exactly one place and cannot drift between them. */
export interface LinePhaseFacts {
  readonly phase: DispatchPhase | null;
  readonly verdict: "same" | "pending-fix" | null;
  readonly reviewed: DocRevisionRef | null;
}

/** The line a phase read judges — its stable key, its judged identity document and
 *  the declared target type. Filled by the composition root's scene read. */
export interface LinePhaseInput {
  /** The line's stable ledger key (`plan` / `branch` / the declared doc word). */
  readonly key: string | null;
  /** The line's judged document (a doc line's path, the branch line's plan). */
  readonly doc: string | null;
  readonly type: TargetType;
}

/** This line's dispatch facts — the wave face's gate inputs and the frontier cells
 *  the refusal's `next` is assembled from. Filled by the composition root; nothing
 *  here is a judgment. */
export interface DispatchLineFacts {
  /** The session ledger — the ONE round/closure/drift read face. */
  readonly ledger: Ledger;
  /** The word table the wave gate's own verdict wording rides. */
  readonly words: Words;
  /** The plan's task graph (the wave face's frontier source) — null off that face. */
  readonly graph: TaskGraph | null;
  /** The requested `--tasks` group (the wave face's request) — null off that face. */
  readonly tasks: ReadonlySet<number> | null;
  /** The line's stable key (`plan` / `branch` / the declared doc word) — null when
   *  the face owns no registered line. */
  readonly lineKey: string | null;
  /** The line's judged document (a doc line's own path, the branch line's plan) —
   *  null when the face has no identity document. */
  readonly doc: string | null;
  /** The pipeline frontier's declared cells — the refusal's `next` is the frontier's
   *  own hop, so the dispatch face and the board name one object. */
  readonly pipeline: PipelineFrontierInput;
  /** The pipeline-station discrimination (the face plane's declaration read) — the
   *  session plane never imports a face class. */
  readonly docClassOf: (target: RouteTarget) => DocClassVerdict;
}

/** One dispatch request — the verb + target type the command asked for, the
 *  structure leg's already-judged verdict, and this line's facts. */
export interface DispatchRequest {
  readonly verb: DispatchVerb;
  readonly type: TargetType;
  /** The pre-flight seam's own verdict — the structure leg's judgment. */
  readonly structure: PreFlightVerdict;
  readonly line: DispatchLineFacts;
}

/** The refusal line's render facts — supplied by the face that prints it: the hop's
 *  command literal (the ONE route renderer) and the structure leg's own pre-flight
 *  wording (that leg names no hop). */
export interface DispatchRefusalRender {
  /** The hop → command literal — the line leg's `next:` value. */
  readonly command?: (hop: NextHop) => string;
  /** The structure leg's own wording, printed after the reason verbatim. */
  readonly detail?: string;
}

/** One upstream face's line identity — the ledger key, the judged document and the
 *  declared target type. The identity face's key IS its declared word (`phase-spec` /
 *  `single-spec`), so the slot and the line never diverge. */
interface UpstreamDocLine {
  readonly type: TargetType;
  readonly key: string;
  readonly doc: string;
}

/** An upstream station's sign — ① the reviewed identity moved (`doc-drift` for a doc
 *  face, `brief-drift` for the wave face, carrying the first drifted OPEN batch), ② the
 *  face has not closed for the request (`open`), or nothing to report (`null`: the face
 *  handed off cleanly, or the pipeline never entered it). */
type UpstreamStation =
  | { readonly kind: "doc-drift" }
  | { readonly kind: "brief-drift"; readonly batch: string }
  | { readonly kind: "open" };

/** A leg's ruling before the hop is assembled — the hop is only read when a refusal
 *  actually names one (an allowed dispatch pays no station read). */
type LineRuling =
  | { readonly kind: "allowed" }
  /** The leg's own row named the fact. */
  | { readonly kind: "row"; readonly reason: DispatchReason }
  /** The line sits at another open round — the hop's own named fact rules. */
  | { readonly kind: "hop" };

/**
 * DispatchAuthority — the ONE dispatch verdict (§2.1/§2.2). One `verdict` call walks
 * the three legs in priority order and returns the single verdict the CLI renders,
 * the capsule's `next:` and the board's `next:` all read the same hop through it.
 *
 * Rule zero on the ≤200-line class cap (broke by design, not by accident): the three
 * legs are one short-circuit chain over one `next:` assembly — extracted, the chain's
 * order moves to a caller and a refusal can name a round another leg contradicts. The
 * drift diagnosis (§2.5) rides the same chain: it is read off the hop the refusal
 * already names, and its ONE rendering site is `message`.
 */
export class DispatchAuthority {
  /** The wave face's five rows — this leg's wave judge (the judgment body stays in
   *  `WaveGate`, whose verdict rows are the reason table's `leg: "line"` rows). */
  readonly #waveGate: WaveGate;

  constructor(opts: { waveGate?: WaveGate } = {}) {
    this.#waveGate = opts.waveGate ?? new WaveGate();
  }

  /** verdict(request) — the priority chain: structure, then upstream, then the line.
   *  The first leg that refuses owns the verdict (§2.2: report the most upstream
   *  cause — the actionable one). */
  verdict(request: DispatchRequest): DispatchVerdict {
    const structure = this.structureRefusal(request.structure);
    if (structure !== null) return structure;
    const upstream = this.#upstreamLeg(request);
    if (upstream !== null) return upstream;
    return this.#lineLeg(request);
  }

  /** message(verdict, render) — the ONE refusal line (§2.6): `reason · next: ` plus
   *  the command the hop renders, or `reason · <wording>` on the structure leg. A drift
   *  refusal carries its mandatory diagnosis (§2.5) between the reason and the hop, so
   *  the CLI prints layer · line key · both hash ends without a second wording source. */
  message(verdict: DispatchRefusal, render: DispatchRefusalRender): string {
    const reason = DispatchAuthority.#driftReasonText(verdict);
    if (verdict.next === null) {
      return render.detail === undefined || render.detail === ""
        ? reason
        : `${reason} · ${render.detail}`;
    }
    const command = render.command === undefined ? "" : render.command(verdict.next);
    return `${reason} · next: ${command}`;
  }

  /** The structure leg's verdict — the seam's refusal re-expressed as this chain's
   *  first row. Its token is the refusing gate's own id (the table's structure rows:
   *  `tree-clean` · `in-flight` · `graph` · `plan-ledger` · `doc-contract`), never a
   *  new spelling. Public because the lifecycle re-states a seam refusal (the
   *  structurally unreachable dispatch-entry path) through the same shape. */
  structureRefusal(preflight: PreFlightVerdict): DispatchRefusal | null {
    if (preflight.ok) return null;
    const gate = preflight.gate;
    // A refused pre-flight always names its gate; a gate-less refusal is no
    // structure verdict at all (the seam keeps its own report face).
    if (gate === undefined) return null;
    return { allowed: false, leg: "structure", reason: gate, next: null };
  }

  /** The upstream leg (§2.3) — the faces that PRECEDE the request's face, in the ONE
   *  `PIPELINE_FACES` order: the request face's index cuts the order, and the first
   *  upstream face that reports owns the verdict. Its `next` is the pipeline
   *  frontier's own hop — the object the capsule and the board render — so a refusal
   *  never names a round another face contradicts. */
  #upstreamLeg(request: DispatchRequest): DispatchRefusal | null {
    const index = DispatchAuthority.#faceIndexOf(request.type);
    if (index <= 0) return null;
    for (const face of PIPELINE_FACES.slice(0, index)) {
      const station = this.#stationOf(face, request.line);
      if (station === null) continue;
      return this.#stationRefusal(station, request.line);
    }
    return null;
  }

  /** One upstream station's refusal (§2.3/§2.4) — the reason and the `next:` are read
   *  off the SAME station sign: a moved brief names `brief-drift` and points at that
   *  batch's wave review (never the pipeline frontier's branch hop, which belongs to a
   *  different face's fact), a moved document names `doc-drift` and points at the
   *  frontier's own hop, and an unclosed face keeps the hop's own reason. */
  #stationRefusal(station: UpstreamStation, facts: DispatchLineFacts): DispatchRefusal {
    if (station.kind === "brief-drift") {
      return this.#refusal(
        "upstream",
        DISPATCH_REASON.briefDrift.token,
        this.#waveReviewHop(facts, station.batch),
        facts,
      );
    }
    const next = this.#hopOf(facts);
    const reason = station.kind === "doc-drift" ? DISPATCH_REASON.docDrift.token : next.reason;
    return this.#refusal("upstream", reason, next, facts);
  }

  /** The wave review hop of a drifted batch (P29 §2.4) — the ONE assembly
   *  (`Ledger#nextHopOf`) with the moved-brief cell injected and the wave target of the
   *  FIRST drifted open batch, so the refusal's `next:` is `review --type wave --tasks
   *  <batch> --plan <plan>` and its reason is the brief's own token. */
  #waveReviewHop(facts: DispatchLineFacts, batch: string): NextHop {
    const planPath = facts.pipeline.planPath;
    return facts.ledger.nextHopOf({
      type: "wave",
      key: batch,
      route: { kind: "review" },
      target: { type: "wave", id: batch, plan: planPath ?? undefined },
      briefDrift: true,
      docClassOf: facts.docClassOf,
    });
  }

  /** One upstream face's station sign (§2.1/§2.3) — ① first (a moved reviewed identity
   *  refuses whatever the closure cell says), then ② (the face has not closed for the
   *  request, so the frontier's own hop reason rules). The wave face reports the
   *  BRIEF's movement, the doc faces the document's — two layers, two tokens. */
  #stationOf(face: PhaseFaceKey, facts: DispatchLineFacts): UpstreamStation | null {
    if (face === "wave") return this.#waveStation(facts);
    const line = DispatchAuthority.#docFaceOf(face, facts.pipeline);
    if (line === null) return null;
    const ledger = facts.ledger;
    // A line with no recorded round was never entered: no station, nothing to hold.
    if (!DispatchAuthority.#docEntered(ledger, line)) return null;
    if (ledger.reviewGate(line.key, line.doc, line.type).kind === "open")
      return { kind: "doc-drift" };
    return ledger.lineStateAt(line.key, line.type, line.doc) === "closed" ? null : { kind: "open" };
  }

  /** The wave face's station — read off the SAME two judges the frontier runs, never a
   *  local walk: entered over the three dispatch modes, drifted over the derived
   *  batches' reviewed briefs, exhausted over `closedWaves()`.
   *
   *  P29 §2.1 — the drift read is NOT retroactive: a batch whose tasks all sit in
   *  `closedWaves()` is filtered out before `briefDrifted` runs. A closed wave has no
   *  round left to reopen, so its stale brief is nobody's `next:` (the #438 face: a
   *  finished run's plan edit blocked the branch review). Only an OPEN batch's brief
   *  movement refuses the faces below the wave face. */
  #waveStation(facts: DispatchLineFacts): UpstreamStation | null {
    const graph = facts.pipeline.planGraph;
    if (graph === null) return null;
    const frontier = this.#frontierOf(facts);
    if (!frontier.wavesEntered(graph)) return null;
    const batch = DispatchAuthority.#firstDriftedOpenBatch(graph, facts.ledger);
    if (batch !== null) return { kind: "brief-drift", batch };
    return frontier.wavesExhausted(graph) ? null : { kind: "open" };
  }

  /** The FIRST open batch whose task-only brief moved (`graph.batches()` order — the
   *  ONE order §2.4 makes executable) — null when every batch is either closed or
   *  undrifted. The closure cell is `closedWaves()`, the same read the frontier's
   *  exhaustion uses: a batch is closed when every one of its tasks is. */
  static #firstDriftedOpenBatch(graph: TaskGraph, ledger: Ledger): string | null {
    const closed = ledger.closedWaves();
    for (const batch of graph.batches()) {
      if (batch.every((id) => closed.has(id))) continue;
      const key = batch.join(",");
      if (ledger.briefDrifted(key)) return key;
    }
    return null;
  }

  /** The line leg — this line's phase against the requested one, with the refusal's
   *  `next` read from the pipeline frontier only when the line actually refuses. */
  #lineLeg(request: DispatchRequest): DispatchVerdict {
    const ruling = request.type === "wave" ? this.#waveRuling(request) : this.#docRuling(request);
    if (ruling.kind === "allowed") return { allowed: true };
    const next = this.#hopOf(request.line);
    const reason = ruling.kind === "row" ? ruling.reason : next.reason;
    return this.#refusal("line", reason, next, request.line);
  }

  /** One refusal, with its drift diagnosis attached when the reason is a drift token
   *  (§2.5 — one construction point, so no drift refusal can print without it). The
   *  diagnosis reads the identity the hop itself names (`NextHop.target`), never a
   *  second lookup of which line moved. */
  #refusal(
    leg: DispatchLeg,
    reason: DispatchReason,
    next: NextHop,
    facts: DispatchLineFacts,
  ): DispatchRefusal {
    const drift = DispatchAuthority.#isDriftReason(reason)
      ? DispatchAuthority.#driftOf(next, facts)
      : undefined;
    return drift === undefined
      ? { allowed: false, leg, reason, next }
      : { allowed: false, leg, reason, next, drift };
  }

  /** Whether a token names a moved reviewed identity — the two rows whose refusal line
   *  must carry the diagnosis (§2.5). */
  static #isDriftReason(reason: DispatchReason): boolean {
    return reason === DISPATCH_REASON.briefDrift.token || reason === DISPATCH_REASON.docDrift.token;
  }

  /** The diagnosis of the hop's OWN render target (§2.5) — a wave target is judged on
   *  its brief's task-only projection, every doc shape on its document revision, and the
   *  hop's target is the identity the refusal already names (never a second lookup of
   *  which line moved). Undefined when the target holds no identity on record: a
   *  diagnosis never invents a fact. */
  static #driftOf(next: NextHop, facts: DispatchLineFacts): DispatchDrift | undefined {
    const target = next.target;
    if (target === null) return undefined;
    const brief = target.type === "wave";
    const pair = brief
      ? facts.ledger.briefDriftHashes(String(target.id))
      : DispatchAuthority.#docDriftPair(target, facts);
    return pair === null ? undefined : { layer: brief ? "brief" : "doc", ...pair };
  }

  /** The doc target's diagnosis read — the target's own type is the ledger key of the
   *  line it renders (`plan` / `branch` / the declared spec word), and a branch target
   *  carries its document in `plan`, every other shape in `id`. */
  static #docDriftPair(
    target: RouteTarget,
    facts: DispatchLineFacts,
  ): { line: string; recorded: string; current: string } | null {
    const doc = target.type === "branch" ? (target.plan ?? null) : target.id;
    return doc === null ? null : facts.ledger.docDriftHashes(target.type, doc, target.type);
  }

  /** The refusal line's reason head — the token alone, or the token plus the mandatory
   *  diagnosis (§2.5): `layer=` · `line=` · `recorded=` · `current=` with a stable hash
   *  prefix per end. ONE rendering site, so the CLI cannot print a second wording. */
  static #driftReasonText(verdict: DispatchRefusal): string {
    const drift = verdict.drift;
    if (drift === undefined) return verdict.reason;
    const prefix = (hash: string): string => hash.slice(0, DRIFT_HASH_PREFIX);
    return `${verdict.reason} · layer=${drift.layer} · line=${drift.line} · recorded=${prefix(
      drift.recorded,
    )} · current=${prefix(drift.current)}`;
  }

  /** The wave face's rows — the three-verb gate judged whole (its order IS the
   *  judgment: a shape matching an earlier row keeps that earlier row's cause). */
  #waveRuling(request: DispatchRequest): LineRuling {
    const facts = request.line;
    if (facts.graph === null || facts.tasks === null) return { kind: "allowed" };
    const verdict = this.#waveGate.vet(
      facts.tasks,
      request.verb,
      facts.graph,
      facts.ledger,
      facts.words,
    );
    if (verdict.ok || verdict.reason === undefined) return { kind: "allowed" };
    return { kind: "row", reason: verdict.reason };
  }

  /** linePhaseFacts(ledger, input) — this line's phase, read ONCE (§2.7): the drift
   *  reopen (which ADMITS the review lead), the derived pending fix, then the
   *  rounds/routes judge. The face gate renders this value; this object's line leg
   *  judges it — one derivation, two readers, no second walk to drift from. */
  linePhaseFacts(ledger: Ledger, input: LinePhaseInput): LinePhaseFacts {
    const gate =
      input.key !== null && input.doc !== null
        ? ledger.reviewGate(input.key, input.doc, input.type)
        : null;
    if (input.key !== null && gate !== null && ledger.docReopens(input.key, input.type, gate)) {
      return { phase: targetFaces[input.type].product.reviewLead, verdict: null, reviewed: null };
    }
    if (gate !== null && gate.kind === "same") {
      return gate.pending
        ? { phase: "fix", verdict: "pending-fix", reviewed: gate.reviewed }
        : this.#sameDocFallback(ledger, input, gate.reviewed);
    }
    return { phase: this.#lineRoutePhase(ledger, input), verdict: null, reviewed: null };
  }

  /** An unchanged doc holding no pending fix — the legacy rounds/routes fall-through:
   *  a completed-fix line reopens the review lead through its fix round's route, while
   *  a truly closed line keeps the "same" verdict (the revision-aware BLOCK's face). */
  #sameDocFallback(
    ledger: Ledger,
    input: LinePhaseInput,
    reviewed: DocRevisionRef,
  ): LinePhaseFacts {
    const open = this.#lineRoutePhase(ledger, input);
    return open !== null
      ? { phase: open, verdict: null, reviewed: null }
      : { phase: null, verdict: "same", reviewed };
  }

  /** The rounds/routes phase — the ledger's SINGLE line-phase judge (D40). */
  #lineRoutePhase(ledger: Ledger, input: LinePhaseInput): DispatchPhase | null {
    return input.key === null ? null : ledger.linePhase(input.key, input.type);
  }

  /** The doc/branch face's rows, in order: the line's phase (the drift reopen is a ROW
   *  that admits the review lead), then the named refusals, then the hop's own fact
   *  when the line sits at another open round. */
  #docRuling(request: DispatchRequest): LineRuling {
    const facts = request.line;
    const phase = this.linePhaseFacts(facts.ledger, {
      key: facts.lineKey,
      doc: facts.doc,
      type: request.type,
    });
    if (phase.phase === this.#expectedPhase(request.type, request.verb)) {
      return { kind: "allowed" };
    }
    // A pending fix is the line's own row: the fix it awaits is a present fact, and
    // the refusal names it whatever the requested verb was.
    if (phase.phase === "fix") return { kind: "row", reason: DISPATCH_REASON.pendingFix.token };
    if (phase.phase !== null) return { kind: "hop" };
    // The closed line: the doc shapes name their unchanged reviewed identity (the
    // anti-spin row); every other line keeps the generic closed face.
    const unchanged = TargetFaceTable.isDocShape(request.type) && phase.verdict === "same";
    return {
      kind: "row",
      reason: unchanged ? DISPATCH_REASON.unchanged.token : DISPATCH_REASON.faceClosed.token,
    };
  }

  /** The phase the requested verb dispatches on this face — the review verb asks for
   *  the face's OWN review lead (the branch line's `branch-review`). */
  #expectedPhase(type: TargetType, verb: DispatchVerb): DispatchPhase {
    if (verb === "implement") return "implement";
    if (verb === "fix") return "fix";
    return targetFaces[type].product.reviewLead;
  }

  /** The refusal's `next` — the pipeline frontier's ONE assembly (§2.1), the object
   *  the capsule and the board render. */
  #hopOf(facts: DispatchLineFacts): NextHop {
    return this.#frontierOf(facts).hopOf(facts.pipeline, {
      docClassOf: facts.docClassOf,
    });
  }

  /** The pipeline frontier over this line's ledger — ONE construction per read. */
  #frontierOf(facts: DispatchLineFacts): PipelineFrontier {
    return new PipelineFrontier(facts.ledger);
  }

  /** The pipeline face a target type occupies — the identity slot's declared words
   *  (`phase-spec` / `single-spec`) share face 0, every node face is its own key, and
   *  the charter (`overall`) occupies no pipeline face at all (-1). Read off
   *  `PIPELINE_FACES` (the ONE order declaration), never a second order table. */
  static #faceIndexOf(type: TargetType): number {
    const face = type === "single-spec" ? "phase-spec" : type;
    return DispatchAuthority.#isPipelineFace(face) ? PIPELINE_FACES.indexOf(face) : -1;
  }

  static #isPipelineFace(key: string): key is PhaseFaceKey {
    return (PIPELINE_FACES as readonly string[]).includes(key);
  }

  /** One upstream doc face's line identity — a node face's own key/document, the
   *  identity slot's DECLARED word (`specType`, the `single-spec` / `phase-spec`
   *  spelling the document carries). A face with no document was never entered; the
   *  charter is no pipeline face at all, so it is never an upstream station. */
  static #docFaceOf(face: PhaseFaceKey, pipeline: PipelineFrontierInput): UpstreamDocLine | null {
    if (face === "plan" || face === "branch") {
      return pipeline.planPath === null ? null : { type: face, key: face, doc: pipeline.planPath };
    }
    if (pipeline.specType === "overall") return null;
    const type = pipeline.specType ?? "phase-spec";
    return pipeline.specPath === null ? null : { type, key: type, doc: pipeline.specPath };
  }

  /** Whether an upstream doc face was ever WORKED — its line carries at least one
   *  recorded round (the review lead or a fix). A face the pipeline never entered
   *  holds no station: the request face is the pipeline's own first entry. */
  static #docEntered(ledger: Ledger, line: UpstreamDocLine): boolean {
    const lead = targetFaces[line.type].product.reviewLead;
    return (
      ledger.roundCount(line.key, lead, line.type) > 0 ||
      ledger.roundCount(line.key, "fix", line.type) > 0
    );
  }
}
