// packages/cdd-engine/src/run/advance/line-phase.ts
// The single-target line's phase facts — closure, active hop, phase word and the identity
// cells a dispatch request assembles from.
//
// INVARIANT — a line's closure, its active hop and its phase are all read off the LEDGER's
// own rounds (one walk, one answer), and this file carries no wording: a refusal sentence
// belongs to the render face, so nothing here spells one. The drift-aware reopen is the ONE
// judgment both the pipeline frontier and the dispatch gate read, and drift never outranks a
// pending fix — a live hop keeps its round, so no face names a round another face refuses.
// A wave line's drift compares the recorded version against TODAY's task-only projection, the
// same bytes the binding hashed, so the landed brief's round-context section never reopens it.
//
// A round's FACTS (its findings and its work status) arrive through an injected carrier
// read: reading a carrier is the dispatch segment's checked read, and a second read here
// would be a second chance to judge tampered bytes. The fix face's findings are the SOURCE
// review's, never the fix carrier's (C5-1: a work carrier declares no findings slot), so the
// same checked read answers the review record of the fix round's own cycle.
//
// Module-level exports are types and the class — zero behaviour-carrying bare functions.

import { docBodyOf } from "../../docs/grammar/doc-body.ts";
import type { FixDisposition } from "../../docs/judging/completion.ts";
import type { RoundPhase } from "../dispatch/child.ts";
import type { RoundFinding } from "../dispatch/handoff.ts";
import { RoundIdentity } from "../ledger/identity.ts";
import type { RoundRecord } from "../ledger/ledger.ts";
import { type Drift, ReviewedIdentity } from "../ledger/reviewed.ts";
import { type FixRequest, NextRoutes, type Route } from "./next.ts";
import { TargetFaces, type TargetType } from "./target-faces.ts";

/** The three states of one line AS OF its identity document. */
export type LineState =
  /** The rounds lie on the closure side and the document still matches the reviewed one. */
  | "closed"
  /** The rounds say closed but the reviewed document moved — the line is the awaiting face. */
  | "reopened"
  /** The rounds themselves hold the line open. */
  | "open";

/** The ledger reads this segment is allowed — a projection of the fact layer, never a
 *  second fact. */
export interface LineReads {
  /** One line's rounds, in `(cycle, attempt)` order. */
  rounds(key: string): readonly RoundRecord[];
  /** The recorded version against the document's CURRENT reviewed BODY. `null` when the line
   *  recorded none (only present facts land), so this read is also the "was it reviewed at
   *  all" cell. The bytes handed in are the projection
   *  (`docs/grammar/doc-body.ts#docBodyOf`) — front matter and `## Change history` already
   *  stripped, exactly as the recorded cell was digested — never the raw file. */
  docDriftOf(key: string, body: string): Drift | null;
  /** The version a line recorded, whatever its kind — the wave line's `brief` identity comes
   *  from here, the document line's `doc_hash` from `docDriftOf`. `null` when none was
   *  recorded. */
  reviewedOf(key: string): ReviewedIdentity | null;
}

/** A document's current bytes, resolved by the caller's own read face; null when it cannot
 *  be read (no drift evidence either way). The provider hands the FILE's bytes: the projection
 *  onto the reviewed body happens at the two reads below, so no provider can hand a slice the
 *  recorded cell was never digested from. */
export type DocumentText = (path: string) => string | null;

/** The two facts a recorded round contributes to a route — the carrier's own cells. */
export interface CarriedFacts {
  /** Whether the round's carrier was READ at all. A round whose carrier cannot be resolved,
   *  read or parsed has no facts to judge, so the closure walk answers no route rather than a
   *  silent `done` — the shipped engine's own rule. ABSENT reads as readable: a caller that
   *  hands facts over without modelling the carrier's presence is saying it read one. */
  readonly readable?: boolean;
  /** The judge carrier's findings; null when the round wrote none. */
  readonly findings: readonly RoundFinding[] | null;
  /** A work round's conclusion; null on a judge round. */
  readonly status: "APPROVED" | "BLOCKED" | null;
  /** The carrier coordinates a `fix` hop hands the next round; absent when the round wrote
   *  no carrier. */
  readonly requesting?: FixRequest;
  /** The fix round's disposition table, as its working carrier declares it; absent when the
   *  carrier is not a work carrier or declares none. The SAME checked read answers it, so a
   *  round's dispositions are never read twice. */
  readonly dispositions?: Readonly<Record<string, FixDisposition>> | null;
}

/** The checked carrier read, injected — the dispatch segment's one read face. The LINE comes
 *  with the record because a carrier's name embeds its line: a record alone cannot resolve the
 *  file it wrote, and a search across lines would answer another line's carrier. */
export type CarriedRead = (line: string, record: RoundRecord) => CarriedFacts;

/** The line identity cells — the ledger key and the document the line is judged at. */
export interface LineIdentity {
  /** The ledger key: the type word, or `branch`. */
  readonly key: string;
  /** The judged document: a doc line's own path, the branch line's plan; null elsewhere. */
  readonly doc: string | null;
}

/** The construction facts. */
export interface LinePhaseOptions {
  readonly facts: LineReads;
  readonly carried: CarriedRead;
  readonly text: DocumentText;
  /** TODAY's task-only projection of a wave line, rendered by the render face — the SAME
   *  projection a review bound (`Lifecycle` binds the landing's `reviewed` bytes, which the
   *  brief renderer produces from the plan's task sections). Injected because rendering it is
   *  the render face's, and because the landed brief itself is never the compared version: its
   *  round-context section changes with every dispatch. Absent → a wave line reads no drift
   *  evidence, never a fabricated one. */
  readonly projection?: (waveKey: string) => string | null;
}

/**
 * LinePhase — one single-target line's phase facts. Invariant: closure, hop and phase are one
 * walk over the ledger's rounds (see the file's header), and the reopen is the ONE drift
 * judgment every reader shares.
 *
 * Rule zero (over the 200-line class limit): the class stays whole because every member is a
 * read of the SAME one line walk — the document line and the wave line are two faces of one
 * ledger projection, and splitting them would let a caller hold two walks of one ledger that
 * can disagree about the same round.
 */
export class LinePhase {
  readonly #facts: LineReads;
  readonly #carried: CarriedRead;
  readonly #text: DocumentText;
  readonly #routes = new NextRoutes();
  readonly #projection: (waveKey: string) => string | null;

  constructor(opts: LinePhaseOptions) {
    this.#facts = opts.facts;
    this.#carried = opts.carried;
    this.#text = opts.text;
    this.#projection = opts.projection ?? LinePhase.#noProjection;
  }

  /** The line's identity cells: the stable ledger key and the judged document. A doc line
   *  keys by its target-type word (never by an argv spelling, so a moved argv string cannot
   *  fork one line into two rows); the branch line keys by its own word and is judged at the
   *  plan. */
  identityOf(facts: {
    readonly type: TargetType;
    readonly doc: string | null;
    readonly plan: string | null;
  }): LineIdentity {
    if (facts.type === "branch") return { key: "branch", doc: facts.plan };
    if (TargetFaces.isDocShape(facts.type)) return { key: facts.type, doc: facts.doc };
    return { key: facts.type, doc: facts.doc };
  }

  /** The line's active hop: a line with no review-lead round yet answers the review hop; a
   *  review whose cycle no completed fix matches answers the one-way fix hop; a
   *  blocker-carrying fix answers the re-review hop; a clean round answers null (the line
   *  holds no open hop). */
  routeOf(key: string, type: TargetType): Route | null {
    const records = this.#facts.rounds(key);
    const reviewLead = TargetFaces.reviewLeadOf(type);
    const lead = LinePhase.#latestCompleted(records, reviewLead);
    if (lead === null) return { kind: "review" };
    if (!LinePhase.#completedCycles(records, "fix").includes(lead.cycle)) {
      const route = this.#roundRoute(key, type, lead.record);
      return route?.kind === "fix" ? route : null;
    }
    const fix = LinePhase.#latestCompleted(records, "fix");
    if (fix === null) return null;
    const route = this.#roundRoute(key, type, fix.record);
    return route?.kind === "review" ? route : null;
  }

  /** The line's open phase — the ONE mapping from its active hop (the review hop reads the
   *  face's own review-lead mode word, the fix hop `fix`, a closed line null). */
  phaseOf(key: string, type: TargetType): RoundPhase | null {
    const route = this.routeOf(key, type);
    if (route === null) return null;
    if (route.kind === "review") return TargetFaces.phaseOfHop(type, "review");
    if (route.kind === "fix") return "fix";
    return null;
  }

  /** Whether the line's rounds lie on the closure side — one judge, read by the pipeline's
   *  four rules and by `stateOf`. */
  closedAt(key: string, type: TargetType): boolean {
    const records = this.#facts.rounds(key);
    const lead = LinePhase.#latestCompleted(records, TargetFaces.reviewLeadOf(type));
    if (lead === null) return false;
    const fix = LinePhase.#completedCycles(records, "fix").includes(lead.cycle)
      ? LinePhase.#latestCompleted(records, "fix")
      : null;
    if (fix === null) return NextRoutes.routeClosed(this.#roundRoute(key, type, lead.record));
    return NextRoutes.routeClosed(this.#roundRoute(key, type, fix.record));
  }

  /** Whether the document's movement reopens the line onto its review lead — the ONE
   *  drift-reopen judgment. Drift never outranks a pending fix: only an EXIT-side route can
   *  be replaced, because only it predates the movement of the bytes the line reviewed. The
   *  recorded version is the doc line's own `doc_hash` cell, which `docDriftOf` answers
   *  `null` for when nothing was recorded — absence needs no second guard here. */
  reopenedAt(key: string, type: TargetType, doc: string | null): boolean {
    if (this.driftPairOf(key, doc) === null) return false;
    return NextRoutes.onExitSide(this.routeOf(key, type));
  }

  /** The two digest ends of one document line's movement — the version its review bound and
   *  today's bytes, both on the recorded basis; `null` when the line recorded no version, the
   *  document cannot be read, or the bytes have not moved. This is the drift FACT alone: the
   *  route-side judgment is `reopenedAt`'s, and the refusal's diagnosis is this read's. */
  driftPairOf(
    key: string,
    doc: string | null,
  ): { readonly recorded: string; readonly current: string } | null {
    if (doc === null) return null;
    const content = this.#text(doc);
    if (content === null) return null;
    // The compared slice is the reviewed BODY: the projection strips the front-matter head and
    // the `## Change history` register — the two closed-out registration faces — and it is what
    // the recorded cell was digested from. Digging the raw file here would reopen a reviewed
    // line on a version bump, and would read every cell the shipped engine wrote as a drift.
    const body = docBodyOf(content);
    if (this.#facts.docDriftOf(key, body) !== "drift") return null;
    const reviewed = this.#facts.reviewedOf(key);
    if (reviewed === null) return null;
    return { recorded: reviewed.hash, current: ReviewedIdentity.hashOf(body, reviewed.basis) };
  }

  /** Whether the line's reviewed version is still the document's — the closed line's
   *  `unchanged` row's ONE cell. It takes a RECORDED version (a line nobody reviewed is not
   *  unchanged, it is unbound) and today's reviewed BODY equal to it; an unreadable document
   *  answers false, because a comparison that did not happen cannot claim equality. */
  unchangedAt(key: string, doc: string | null): boolean {
    if (doc === null) return false;
    const content = this.#text(doc);
    if (content === null) return false;
    return this.#facts.docDriftOf(key, docBodyOf(content)) === "same";
  }

  /** Whether one line was ever WORKED — a recorded round of the face's review lead or a fix.
   *  A face the pipeline never entered holds no station, so its document's movement is the
   *  pipeline's business, not a dispatch refusal's. */
  enteredAt(key: string, type: TargetType): boolean {
    const lead = TargetFaces.phaseOfHop(type, "review");
    return (
      this.completedCyclesOf(key, lead).length > 0 || this.completedCyclesOf(key, "fix").length > 0
    );
  }

  /** The line's closure state AS OF its identity document. A line whose document cannot be
   *  read has no drift evidence, so the conservative answer is `closed` — a false reopen
   *  costs a whole review while a false closure is the `next:` face's separate report. */
  stateOf(key: string, type: TargetType, doc: string | null): LineState {
    if (!this.closedAt(key, type)) return "open";
    return this.reopenedAt(key, type, doc) ? "reopened" : "closed";
  }

  // -------------------------------------------------------------------------
  // the wave line — the same walk over a wave's own row
  // -------------------------------------------------------------------------

  /** A wave line's active hop: a wave with no completed implement yet is dispatched whole
   *  (`next-wave` carrying its key); an implemented wave with no completed review is the
   *  review hop; a review awaiting its fix is the one-way fix hop; a fix that still carries
   *  blockers is the re-review hop; a drifted brief reopens at review whatever the round
   *  state says. Null when the line holds no open hop. */
  waveRouteOf(key: string): Route | null {
    const records = this.#facts.rounds(LinePhase.waveLineWord(key));
    if (LinePhase.#completedCycles(records, "implement").length === 0) {
      return { kind: "next-wave", tasks: key };
    }
    const lead = LinePhase.#latestCompleted(records, "review");
    if (lead === null) return { kind: "review" };
    const fixCycle = LinePhase.#completedCycles(records, "fix").includes(lead.cycle)
      ? LinePhase.#latestCompleted(records, "fix")
      : null;
    const carried = fixCycle ?? lead;
    const route = this.#roundRoute(LinePhase.waveLineWord(key), "wave", carried.record);
    if (route === null) return null;
    if (route.kind === "review") return { kind: "review" };
    if (route.kind !== "fix") return null;
    return this.briefDriftedAt(key) ? { kind: "review" } : route;
  }

  /** Whether a wave line's task-only projection moved past the version its review bound —
   *  the ONE brief-drift read, shared by this line's route and the pipeline's hop. The
   *  compared version is the PROJECTION, never the landed brief: the landed bytes carry the
   *  round-context section, so comparing them would read drift for every wave line after its
   *  next dispatch. No recorded identity or no projection means no drift evidence, so the
   *  answer is "not drifted" — a false reopen costs a whole round. */
  briefDriftedAt(key: string): boolean {
    return this.briefDriftPairOf(key) !== null;
  }

  /** The two digest ends of one WAVE line's movement — the version its review bound and
   *  today's task-only projection, both on the recorded basis; null when the line recorded no
   *  brief identity, the projection cannot be rendered or the bytes have not moved. It is the
   *  drift FACT alone (`briefDriftedAt` is this read's boolean face) and the ONE read a
   *  refusal's brief diagnosis prints, so the reopen and the diagnosis can never hash two
   *  different projections. */
  briefDriftPairOf(key: string): { readonly recorded: string; readonly current: string } | null {
    const recorded = this.#facts.reviewedOf(LinePhase.waveLineWord(key));
    if (recorded === null || recorded.kind !== "brief") return null;
    const projection = this.#projection(key);
    if (projection === null) return null;
    if (recorded.driftFrom(projection) !== "drift") return null;
    return {
      recorded: recorded.hash,
      current: ReviewedIdentity.hashOf(projection, recorded.basis),
    };
  }

  /** A wave line's open phase, read off the same one walk: the not-yet-implemented wave is
   *  `implement`, the review hop its own word, the fix hop `fix`, a drained line null. */
  wavePhaseOf(key: string): RoundPhase | null {
    const route = this.waveRouteOf(key);
    if (route === null) return null;
    if (route.kind === "next-wave") return "implement";
    if (route.kind === "review") return "review";
    if (route.kind === "fix") return "fix";
    return null;
  }

  /** One mode's COMPLETED cycles on a line, ascending in record order — the round-number
   *  allocation's read face (a failed round consumed its cycle but is not a carrier). */
  completedCyclesOf(key: string, phase: RoundPhase): readonly number[] {
    return LinePhase.#completedCycles(this.#facts.rounds(key), phase);
  }

  /** The CONSECUTIVE blocker run a round at `cycle` closes — the soft cap's ONE counter. The
   *  walk starts at `cycle` and goes back over the line's completed review-lead rounds while
   *  each carries a blocker finding, stopping at the first clean round or unreadable carrier.
   *  `key` is the ledger line word, so a wave line passes its own spine. */
  blockerRunOf(key: string, type: TargetType, cycle: number): number {
    const records = this.#facts.rounds(key);
    const lead = LinePhase.#opOf(TargetFaces.reviewLeadOf(type));
    let run = 0;
    for (let at = cycle; at >= 1; at -= 1) {
      const record = records.find(
        (candidate) =>
          candidate.op === lead && candidate.cycle === at && candidate.verdict.targetAction,
      );
      if (record === undefined) break;
      const carried = this.#carried(LinePhase.waveLineWord(key), record);
      if ((carried.findings ?? []).filter(LinePhase.#blocker).length === 0) break;
      run += 1;
    }
    return run;
  }

  /** Whether a wave line ever recorded a round — the face-level ENTRY predicate's cell: a
   *  dispatched but refused round still entered the face, because the ledger books it. */
  waveRecordedAt(key: string): boolean {
    return this.#facts.rounds(LinePhase.waveLineWord(key)).length > 0;
  }

  /** Whether a wave line's rounds lie on the closure side. */
  waveClosedAt(key: string): boolean {
    const records = this.#facts.rounds(LinePhase.waveLineWord(key));
    const lead = LinePhase.#latestCompleted(records, "review");
    if (lead === null) return false;
    const fixCycle = LinePhase.#completedCycles(records, "fix").includes(lead.cycle)
      ? LinePhase.#latestCompleted(records, "fix")
      : null;
    return NextRoutes.routeClosed(
      this.#roundRoute(LinePhase.waveLineWord(key), "wave", (fixCycle ?? lead).record),
    );
  }

  /** The FIRST wave in the board's own order that still holds an open task — the frontier
   *  cell the board's `▶` marks, answered ONCE here so no render site re-judges it. Null when
   *  every wave closed (a drained tree has no frontier) or the tree records no wave. */
  frontierWaveOf(keys: readonly string[]): string | null {
    return keys.find((key) => !this.waveClosedAt(key)) ?? null;
  }

  /** The ledger's line word of a wave task-group key — the wave's own spine, read from the
   *  identity grammar rather than re-spelled. */
  static waveLineWord(key: string): string {
    return RoundIdentity.lineWordOf("wave", key);
  }

  /** The zero drift answer — a line read built without the projection seam reads no wave
   *  line as drifted. */
  static #noProjection(): null {
    return null;
  }

  /** One round's C5 route through the carried facts — null when the round's carrier is
   *  unreadable (a round that cannot be read cannot be judged closed). */
  #roundRoute(key: string, type: TargetType, record: RoundRecord): Route | null {
    const carried = this.#carried(key, record);
    // A carrier that cannot be read cannot be judged: no facts, no route, so the line stays
    // open (`null` is not the closure side). Answering `done` from an absent carrier would
    // close a line on a file nobody read.
    if (carried.readable === false) return null;
    return this.#routes.routeOf({
      phase: record.op,
      status: carried.status,
      findings: record.op === "fix" ? this.#sourceFindingsOf(key, record) : carried.findings,
      consecutiveBlockers: record.op === "fix" ? this.blockerRunOf(key, type, record.cycle) : 0,
      // A line-internal route's closure answer is `done` by declaration: this route judges
      // whether THE LINE's hop is exhausted, and the batch continuation is the booking's own
      // frontier read (`Lifecycle#readyBatchOf`), never a second wave decomposition here.
      readyBatch: [],
      ...(carried.requesting === undefined ? {} : { requesting: carried.requesting }),
    });
  }

  /** The SOURCE review's findings for a fix round — C5-1: a work carrier declares no findings
   *  slot, and the re-review decision is about what the fix was told to fix. The source is the
   *  review of the same cycle on the same line (a fix round's cycle is its review's). */
  #sourceFindingsOf(key: string, record: RoundRecord): readonly RoundFinding[] | null {
    const source = this.#facts
      .rounds(key)
      .find((candidate) => candidate.op === "review" && candidate.cycle === record.cycle);
    return source === undefined ? null : (this.#carried(key, source).findings ?? null);
  }

  /** The latest COMPLETED round of one mode — a failed round consumed its cycle but is not
   *  a carrier, so every active-hop read starts here. */
  static #latestCompleted(
    records: readonly RoundRecord[],
    op: RoundPhase,
  ): { readonly record: RoundRecord; readonly cycle: number } | null {
    const mode = LinePhase.#opOf(op);
    const completed = records.filter((record) => record.op === mode && record.verdict.targetAction);
    if (completed.length === 0) return null;
    const record = completed.reduce((newest, candidate) =>
      candidate.cycle > newest.cycle ? candidate : newest,
    );
    return { record, cycle: record.cycle };
  }

  /** One mode's completed cycles on a line. */
  static #completedCycles(records: readonly RoundRecord[], op: RoundPhase): readonly number[] {
    const mode = LinePhase.#opOf(op);
    return records
      .filter((record) => record.op === mode && record.verdict.targetAction)
      .map((record) => record.cycle);
  }

  /** The ledger op one phase word records under — a branch review rides `review`. */
  static #opOf(phase: RoundPhase): "implement" | "review" | "fix" {
    return phase === "branch-review" ? "review" : phase;
  }

  /** Whether one finding is a blocker. */
  static #blocker(finding: RoundFinding): boolean {
    return finding.severity === "blocker";
  }
}
