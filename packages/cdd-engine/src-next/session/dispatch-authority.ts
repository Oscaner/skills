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
//     precede the request's face (P27 §2.3). It lands with the upstream wave; until
//     then the chain inserts nothing here, so every dispatch stays exactly as wide
//     as it was.
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
} from "./next.ts";
import { PipelineFrontier, type PipelineFrontierInput } from "./pipeline.ts";
import type { PreFlightVerdict } from "./preflight.ts";
import { WaveGate } from "./wave.ts";

/** The three work verbs a dispatch asks for. */
export type DispatchVerb = "implement" | "review" | "fix";

/** The verdict's partition — the leg that refused, in the priority chain's order
 *  (`structure` → `upstream` → `line`). */
export type DispatchLeg = "structure" | "upstream" | "line";

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
    // The upstream leg (§2.3) inserts HERE — the station's reviewed-identity and
    // closure pair over the faces preceding the request's face. It refuses nothing
    // until that read lands (P27 task 3), so no dispatch narrows in this round.
    return this.#lineLeg(request);
  }

  /** message(verdict, render) — the ONE refusal line (§2.6): `reason · next: ` plus
   *  the command the hop renders, or `reason · <wording>` on the structure leg. */
  message(verdict: DispatchRefusal, render: DispatchRefusalRender): string {
    if (verdict.next === null) {
      return render.detail === undefined || render.detail === ""
        ? verdict.reason
        : `${verdict.reason} · ${render.detail}`;
    }
    const command = render.command === undefined ? "" : render.command(verdict.next);
    return `${verdict.reason} · next: ${command}`;
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

  /** The line leg — this line's phase against the requested one, with the refusal's
   *  `next` read from the pipeline frontier only when the line actually refuses. */
  #lineLeg(request: DispatchRequest): DispatchVerdict {
    const ruling = request.type === "wave" ? this.#waveRuling(request) : this.#docRuling(request);
    if (ruling.kind === "allowed") return { allowed: true };
    const next = this.#hopOf(request.line);
    const reason = ruling.kind === "row" ? ruling.reason : next.reason;
    return { allowed: false, leg: "line", reason, next };
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
    return new PipelineFrontier(facts.ledger).hopOf(facts.pipeline, {
      docClassOf: facts.docClassOf,
    });
  }
}
