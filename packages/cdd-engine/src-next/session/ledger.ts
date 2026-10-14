// packages/cdd-engine/src-next/session/ledger.ts
// T9 — the session ledger (design spec §6.1): ONE class owns the four on-disk
// session artifacts — progress (the fixed key set), handoff (build/name/persist),
// crash (the lane-crash recovery record) and round (the round carrier). The write
// authority is the engine alone: every artifact write routes through the ledger's
// single persist point, so the engine owns the on-disk record of every round.
//
//   · progress — `progress.json`, the fixed top-level key set (plan + the five
//     failure-category counters, verbatim from engine-config) + the per-key rows
//     (scalar task or the group key string, each carrying its rounds {}).
//   · handoff — the canonical family naming (engine-config handoff namespace), the
//     carrier skeleton (the schema-required identity keys), the single-author write.
//   · crash — `crash-<lane>-<round>.json`, the recovery record (the same-command
//     resume decision source — the resume command + the dead child's tails, never the
//     handoff carrier's union).
//   · round — the round carrier: the handoff presented as the Round the dispatch
//     next-router judges. A fix round carries the SOURCE review's findings (the
//     `--findings` input content, C5-1), never its own; the consecutive-S1 run is
//     walked from the round history (the review-cycle soft-cap basis).
//
// Module-level exports are types / constant data / the class — zero behavior-
// carrying bare functions (the plan's zero-bare-function discipline).

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { ConfigLoader } from "../infra/config.ts";
import type { HandoffFamily } from "../infra/runtime.ts";
import type { Workspace } from "../infra/workspace.ts";
import { type TargetType, targetFaces } from "./faces.ts";
import type { FindingsCarrier, HandoffSchemaFace, WorkCarrier } from "./handoff-schema.ts";
import type { Route } from "./next.ts";
import { NextStepRouter } from "./next.ts";
import { EMPTY_RUN_STATE } from "./run.ts";

// ---------------------------------------------------------------------------
// the round carrier — what NextStepRouter.next (T7) judges
// ---------------------------------------------------------------------------

/** The work face's writable init — the schema-declared optional fields a work carrier
 *  starts from. The round conclusion (status) rides the CALLER's set — never a
 *  build-time value: the skeleton holds only the schema's declared writable plane. */
type WorkInit = {
  artifacts?: Record<string, string>;
};

/** The findings face's writable init — `findings` is the schema-REQUIRED field of the
 *  findings face (the compile-time twin of the read-back required gate — a findings
 *  init omitting it is a type error), artifacts optional. */
type FindingsInit = {
  findings: unknown[];
  artifacts?: Record<string, string>;
};

/** The review-finding severity vocabulary — the handoff findings severity enum, single-typed. */
export type FindingSeverity = "blocker" | "warn" | "nit";

/** One review finding the round carrier judges — severity + the summary prose. */
export interface RoundFinding {
  /** The severity the next-hop derivation keys on. */
  severity: FindingSeverity;
  /** The one-line finding summary (message attribution; the router reads only severity). */
  summary?: string;
}

/** The dispatch phases the round carrier distinguishes (the handoff phase vocabulary). */
export type OpType = "implement" | "review" | "fix";
export type RoundPhase = OpType | "branch-review";

/** The round-concluding statuses the router's failure face reads. */
export type RoundStatus = "APPROVED" | "BLOCKED" | "TIMEOUT" | "CHANGES_REQUESTED" | "REVIEW_FIX";

/**
 * The round carrier — one session round's readable record: the canonical handoff
 * presented as the facts the next-router judges. A work round carries the field
 * values its dispatch concluded (status); a fix round's findings ARE the
 * source review's input findings (C5-1), never the fix's own carrier.
 */
export interface Round {
  /** The round's dispatch phase. */
  phase: RoundPhase;
  /** The concluding status (review-family rounds may omit it — derived from findings). */
  status?: RoundStatus;
  /** The findings the next-hop derivation judges. */
  findings: readonly RoundFinding[];
  /** The findings handoff path (fix: the `--findings` input; review: its own handoff). */
  findingsPath?: string;
  /** The consecutive-S1 run (the leading blocker-lead reviews, newest first) — the
   *  review-cycle soft-cap basis. */
  consecutiveS1: number;
}

// ---------------------------------------------------------------------------
// progress — the fixed key set
// ---------------------------------------------------------------------------

/** The fixed counter key set — the five engine-config failure-category counters, verbatim. */
export const PROGRESS_COUNTER_ZERO = {
  timeoutCount: 0,
  contractViolationCount: 0,
  engineSelfWrittenCount: 0,
  engineRecoveryCount: 0,
  harnessAbortCount: 0,
} as const;

/** The counter member keys — the derived literal union (never re-typed). */
export type ProgressCounterKey = keyof typeof PROGRESS_COUNTER_ZERO;

/** One progress row — keyed by the wave key string (T26 · the wave-unitary model:
 *  every dispatch is a wave — `--tasks 1` is the single-task wave `"1"`, `--tasks
 *  1,2` the wave `"1,2"` — one row form, never a task/wave split). */
export type ProgressRow = {
  /** The wave key string — the dispatch group identity (`"1"` · `"1,2"`). */
  wave: string;
  /** The completed rounds per mode (implement/review/fix) — the done record on disk. */
  rounds?: Record<string, number>;
  /** The doc line's reviewed doc revision (T7) — the doc-revision identity the
   *  line's last review round bound (written at doc-review completion; the
   *  identity-aware line gate reopens the closed line on drift from it). */
  reviewedDocRevision?: DocRevisionRef;
};

/** The progress.json data plane — the fixed top-level key set + the per-wave rows. */
export interface ProgressData {
  /** The `--plan` path recorded at first create. */
  plan?: string;
  timeoutCount: number;
  contractViolationCount: number;
  engineSelfWrittenCount: number;
  engineRecoveryCount: number;
  harnessAbortCount: number;
  waves: ProgressRow[];
}

/** The ledger lookup key — a scalar task id or the group key string. */
export type LedgerKey = number | string;

/** The lane-crash cause vocabulary — postmortem classification of why a dispatch
 *  terminated before the exit gate (zero behavior fork: resume never routes on it).
 *  `contract-violation` is the read-back face: the child exited 0 but produced no
 *  draft or a schema-violating one (the engine BLOCKs + preserves the draft + stores
 *  the same-command resume — the read-back rejection's crash record). */
export type CrashCause =
  | "child-exit"
  | "child-signal"
  | "engine-over-budget"
  | "engine-timeout"
  | "contract-violation"
  | "unknown";

/** The crash record — the lane crash's recovery record (`crash-<lane>-<round>.json`):
 *  the same-command resume's decision source (the resume command + the dead child's
 *  tails), never the handoff carrier. */
export interface CrashRecord {
  /** The dead child's exit code (1 = run failure, 143 = SIGTERM — the shell convention). */
  exitCode: number;
  /** The last CRASH_TAIL_LINES stderr lines (the "403 / abort without trace" tail). */
  stderrTail: readonly string[];
  /** The last CRASH_TAIL_LINES stdout lines. */
  stdoutTail: readonly string[];
  /** The handoff path the dead child was expected to write (null when the lane carries none). */
  attemptedHandoff: string | null;
  /** The same-command resume string — emitted verbatim as `next: <resumeCommand>`. */
  next: string;
  /** The unified termination cause — postmortem, zero behavior fork. */
  cause: CrashCause;
}

// ---------------------------------------------------------------------------
// handoff — the family naming params
// ---------------------------------------------------------------------------

/** Per-family handoff params — the canonical name placeholders of the handoff
 *  namespace families ({tasks}/{round}; the branch family keys by `branch-{op}-{round}`,
 *  no range token — the branch line holds no commit identity). */
export interface HandoffParams {
  /** The dispatch group's key string (comma-joined task ids). */
  tasks?: string;
  /** The round number (increment/source families). */
  round?: number | string;
}

// ---------------------------------------------------------------------------
// review references — the refKind face (T25 · P5)
// ---------------------------------------------------------------------------

/** The review-reference kind — the doc-revision ref (a spec/plan review's two-layer
 *  document ref: the doc path + its content-hash revision, the `doc_hash` binding).
 *  The commit-bearing kinds (commit-set-ledger · commit-range) retired with the
 *  commit-sha surface (P7): a review judges the live tree, so no committed range
 *  is ever a ref. Node-level review is structurally absent (R5 · the wave-atomic
 *  model audits whole waves, never a single task node). */
export type RefKind = "doc-revision";

/** The doc-revision ref — the spec/plan review's two-layer ref: the document path
 *  AND its revision (the content-hash `doc_hash` binding — the same document
 *  revision reviewed twice is the same ref, rejected by the same-ref ruling). */
export interface DocRevisionRef {
  kind: "doc-revision";
  /** The document path — the first layer of the two-layer ref. */
  doc: string;
  /** The document revision — the sha1 content hash of the reviewed file. */
  doc_hash: string;
}

/**
 * ReviewRefs — the review-reference face (T25): the doc-revision two-layer binding
 * (`docRevision` — the doc hash from its content) and the same-ref predicate
 * (the SAME identity already bound is refused, never silently re-reviewed). The
 * face is the ledger's review-ref derivation point — typed data, zero prose.
 */
export class ReviewRefs {
  /** The doc-revision two-layer binding — the doc path + the content-hash revision
   *  (sha1 of the reviewed file content — the second layer of the doc ref). */
  docRevision(doc: string, content: string | Buffer): DocRevisionRef {
    return { kind: "doc-revision", doc, doc_hash: this.#hash(content) };
  }

  /** The ref-identity predicate — two doc refs are the SAME ref when their
   *  two-layer identity matches (the doc + its hash). */
  sameRef(a: DocRevisionRef, b: DocRevisionRef): boolean {
    return a.doc === b.doc && a.doc_hash === b.doc_hash;
  }

  /** The content-hash revision — sha1 hex of the reviewed file content. */
  #hash(content: string | Buffer): string {
    // The doc-revision hash is a content digest (a fingerprint of the reviewed
    // doc's bytes), never a commit ref — the full sha1 hex stays unsliced so the
    // bind basis covers the whole content, not a truncated prefix.
    return createHash("sha1").update(content).digest("hex");
  }
}

// ---------------------------------------------------------------------------
// the review gate — the T8 doc-revision-first verdict (spec §3.5)
// ---------------------------------------------------------------------------

/** The review-gate verdict (T8 · §3.5 · v0.12 ruled) — the doc line's review
 *  request judgment, doc-revision FIRST: a doc moved past the reviewed revision
 *  OPENS the review lead whatever the round/route state says (fix after · backfill
 *  after · user-decision after are the SAME case — the stuck "next round is fix
 *  after an aborted fix" path never freezes a revised doc); an unchanged doc stays
 *  REJECTED (Review Convergence anti-spin), with the pending fix DERIVED from the
 *  latest review's non-APPROVED conclusion — zero independent state field (the
 *  progress.json key set carries no pending-fix key). `unbound` = no reviewed
 *  identity on record or an unreadable doc — the legacy round/route judgment
 *  keeps the generic closed face (only present facts land). */
export type ReviewGateVerdict =
  /** drift — the review lead opens (the lifecycle + the face gate dispatch review). */
  | { kind: "open" }
  /** same — the line stays rejected; `pending` is the derived fix-awaited face
   *  (the review's own fix is outstanding), `reviewed` the bound identity the
   *  rejection messages name (the already-reviewed block / the pending-fix note). */
  | { kind: "same"; pending: boolean; reviewed: DocRevisionRef }
  /** unbound — no identity on record / the doc unreadable: the legacy judgment. */
  | { kind: "unbound" };

// ---------------------------------------------------------------------------
// the ledger
// ---------------------------------------------------------------------------

/**
 * Ledger — the session's on-disk single author. One instance per workspace;
 * every artifact write (progress / handoff / crash) routes through the same
 * private persist point, so the engine owns the record of every round.
 */
export class Ledger {
  /** The one dispatch workspace this ledger records. */
  readonly #workspace: Workspace;
  /** The handoff-family records, keyed by `op.type` — the naming truth the ledger fills. */
  readonly #families: Readonly<Record<string, HandoffFamily>>;
  /** The C5 next router — the closure-side judge of the round carriers (stateless;
   *  the `closedWaves()` read face and the wave gate share the same router). */
  readonly #router = new NextStepRouter();
  /** The review-reference face (T25) — the refKind classification + the same-ref
   *  reject, one instance per ledger (the run's bound refs). */
  readonly #refs = new ReviewRefs();

  constructor(workspace: Workspace, config: ConfigLoader) {
    this.#workspace = workspace;
    this.#families = config.handoffNamespace().families;
  }

  /** The review-reference face — the refKind three-type derivation + binding (T25). */
  refs(): ReviewRefs {
    return this.#refs;
  }

  // ---- the single author's write/read primitives ----

  /** Persist a JSON artifact — the ledger's single write point (engine sole author). */
  #persist(name: string, data: unknown): void {
    this.#workspace.writeJson(name, data);
  }

  /** Read a JSON artifact; null when missing/corrupt. */
  #read<T>(name: string): T | null {
    return this.#workspace.readJson<T>(name);
  }

  // -------------------------------------------------------------------------
  // progress — the fixed key set
  // -------------------------------------------------------------------------

  /** The base progress object — the fixed key set at zero, for a fresh session. */
  emptyProgress(): ProgressData {
    return { ...PROGRESS_COUNTER_ZERO, waves: [] };
  }

  /** Read progress.json; null when missing/corrupt (the ledger never invents state). */
  readProgress(): ProgressData | null {
    return this.#read<ProgressData>("progress.json");
  }

  /** Write progress.json — the progress single-author write. */
  writeProgress(data: ProgressData): void {
    this.#persist("progress.json", data);
  }

  /** The ledger-row lookup single point — a scalar key (or the single-task wave key
   *  `"1"`) resolves the `{ task }` row; a multi-task wave key (`"1,2"`) the `{ wave }` row. */
  rowFor(data: ProgressData, key: LedgerKey): ProgressRow | undefined {
    return data.waves.find((row) => row.wave === String(key));
  }

  /** The fresh row for an absent key — always the wave form (a single trivial
   *  wave `"1"` is still the `{ wave: "1" }` row — one row form, T26). */
  entryFor(key: LedgerKey): ProgressRow {
    return { wave: String(key) };
  }

  /** The last completed round of a dispatch key + mode — 0 when none on record. */
  roundCount(key: LedgerKey, mode: string): number {
    const data = this.readProgress();
    if (data === null) return 0;
    return this.rowFor(data, key)?.rounds?.[mode] ?? 0;
  }

  /** Record a completed round — the on-disk done record (the ledger edge of the
   *  ExecutionState carrier: TaskGraph in memory, the ledger on disk). Creates the
   *  row on demand; returns the round count after the write. */
  recordRound(key: LedgerKey, mode: string): number {
    const data = this.readProgress() ?? this.emptyProgress();
    let row = this.rowFor(data, key);
    if (row === undefined) {
      row = this.entryFor(key);
      data.waves.push(row);
    }
    row.rounds = { ...row.rounds, [mode]: (row.rounds?.[mode] ?? 0) + 1 };
    this.writeProgress(data);
    return row.rounds[mode] as number;
  }

  /** Record a doc line's reviewed doc revision — the T7 identity-aware gate's
   *  basis (written when the doc's review round completes: the line reopens on
   *  drift from this recorded identity, and BLOCKs revision-aware when unchanged). */
  recordReviewedDocRevision(key: LedgerKey, revision: DocRevisionRef): void {
    const data = this.readProgress() ?? this.emptyProgress();
    let row = this.rowFor(data, key);
    if (row === undefined) {
      row = this.entryFor(key);
      data.waves.push(row);
    }
    row.reviewedDocRevision = revision;
    this.writeProgress(data);
  }

  /** The doc line's recorded reviewed doc revision — null when none on record
   *  (a doc line with no reviewed identity keeps the legacy closed face). */
  reviewedDocRevisionOf(key: LedgerKey): DocRevisionRef | null {
    const data = this.readProgress();
    if (data === null) return null;
    return this.rowFor(data, key)?.reviewedDocRevision ?? null;
  }

  /** The doc line's identity verdict (T7) — the current doc revision vs the line's
   *  recorded reviewed revision: the ONE shared comparison across the session
   *  plane's reopen decision and the face plane's drift gate (both planes
   *  out-source the read + the same-ref ruling here — a single error policy).
   *  `drift` → the target moved past the reviewed identity (the line reopens);
   *  `same` → unchanged (the revision-aware BLOCK). Null when no reviewed revision
   *  is on record or the doc is unreadable (the legacy closed face keeps its
   *  generic message — only present facts land). */
  docLineVerdict(key: LedgerKey, doc: string): "drift" | "same" | null {
    const reviewed = this.reviewedDocRevisionOf(key);
    if (reviewed === null) return null;
    try {
      const current = this.#refs.docRevision(doc, readFileSync(doc, "utf8"));
      return this.#refs.sameRef(reviewed, current) ? "same" : "drift";
    } catch {
      return null;
    }
  }

  /** The review-gate method (T8 · §3.5) — the doc line's review request judgment +
   *  the phase advance, doc-revision FIRST: the shared docLineVerdict comparison is
   *  the PRIMARY criterion — a drifted doc OPENS the review lead regardless of the
   *  round/route state (fix / backfill / user-decision are one case: the stuck
   *  "next round is fix after an aborted fix" gate never freezes a revised doc);
   *  an unchanged doc yields the `same` verdict (review Convergence anti-spin:
   *  the callers' reject/reopen decision — the derived pending fix opens the fix
   *  face only, while the no-pending face falls back to the legacy rounds/routes
   *  judgment: a completed-fix line's C5-1 route reopens the review lead). The OPEN
   *  side performs no disk advance: the round + the revision snapshot land with the
   *  round's completion (Ledger#recordRound + the T7 write-back), so a BLOCKED
   *  re-review resumes the same round (nothing pre-binds). `unbound` (no identity on
   *  record / an unreadable doc) keeps the legacy round/route judgment. The
   *  judgment order change is the whole gate: the old rounds/routes-first read made
   *  the round/route state shadow the doc movement (the pre-T8 stuck path). */
  reviewGate(key: LedgerKey, doc: string, type: TargetType): ReviewGateVerdict {
    const verdict = this.docLineVerdict(key, doc);
    if (verdict === "drift") return { kind: "open" };
    if (verdict === "same") {
      const reviewed = this.reviewedDocRevisionOf(key);
      if (reviewed === null) return { kind: "unbound" };
      return { kind: "same", pending: this.#pendingFix(key, type), reviewed };
    }
    return { kind: "unbound" };
  }

  /** The wave line's open phase — the SINGLE derivation the wave gate AND the
   *  lifecycle's frame frontier both read (D26: one fact, one place, read at judgment
   *  time). The D16/T11 plan-revision precheck belongs HERE, not in a per-consumer
   *  copy: a completed wave review bound the PLAN it judged to the row (run.ts
   *  bookkeep — the doc face's same revision-hash gate), and a drifted plan reopens
   *  the wave at review regardless of the fix-awaited round state (the stale-revision
   *  findings are voided — new revision, new review). Same revision + a pending fix
   *  stays at fix (Review Convergence anti-spin); a null record (legacy wave row)
   *  keeps the pure round-count derivation. The final leg reads the latest fix round's
   *  C5 route under EMPTY_RUN_STATE — the close-side is inert for the review/closure
   *  query (only the fix round's own blockers can yield review; #close never does). */
  waveLinePhase(waveKey: string): RoundPhase | null {
    const implemented = this.roundCount(waveKey, "implement");
    const reviews = this.roundCount(waveKey, "review");
    const fixes = this.roundCount(waveKey, "fix");
    if (implemented === 0) return "implement";
    if (reviews === 0) return "review";
    if (fixes < reviews) {
      const reviewed = this.reviewedDocRevisionOf(waveKey);
      if (reviewed !== null && this.docLineVerdict(waveKey, reviewed.doc) === "drift")
        return "review";
      return "fix";
    }
    const carried = this.round("fix", "wave", { tasks: waveKey }, reviews);
    if (carried === null) return null;
    return this.#router.next(EMPTY_RUN_STATE, carried)?.kind === "review" ? "review" : null;
  }

  /** The pending-fix derivation — the "doc same + not APPROVED" face (T8): the
   *  latest review round has an outstanding fix AND its conclusion was not an
   *  approval. The count comparison is the operable leg (a review with a pending
   *  fix — reviews > fixes — cannot have closed: an APPROVED review never awaits
   *  a fix); the status read keeps the derivation's second leg explicit, degrading
   *  to the conservative pending on a missing carrier (a counted round is a present
   *  fact — the same-doc re-review stays refused until its fix lands). A completed
   *  fix (fixes >= reviews) is NOT the pending face — the completed-fix line's
   *  re-review reopens through the fix round's C5 route (the legacy judgment). */
  #pendingFix(key: LedgerKey, type: TargetType): boolean {
    const reviews = this.roundCount(key, "review");
    const fixes = this.roundCount(key, "fix");
    if (reviews === 0 || fixes >= reviews) return false;
    const carried = this.round("review", type, { round: reviews }, reviews);
    return carried === null || carried.status === undefined || carried.status !== "APPROVED";
  }

  /** Read one counter — a failure-category count on record (0 when the file is missing). */
  counterOf(key: ProgressCounterKey): number {
    return this.readProgress()?.[key] ?? 0;
  }

  // -------------------------------------------------------------------------
  // closedWaves — the closure single read face (v1.20)
  // -------------------------------------------------------------------------

  /**
   * The session's closed task ids — the C5 closure single read face (v1.20): a task
   * is closed exactly when the C5 route of its LATEST recorded round lies on the
   * closure side ({done, next-wave} — the SAME terminal predicate the lifecycle's
   * #markTerminal applies). The retired "any ledger row is done" row-read is gone:
   * an implement-only row NEVER closes (a recorded implement round is not a closure
   * verdict — the structural root of the phantom-closure fix), and a historical
   * merged-wave row naturalizes through its own review/fix pair (the wave row's C5
   * route, never a per-member read). The frontier consumers (the wave gate · the
   * plan-graph board) read this face — one closed set, one source.
   */
  closedWaves(): Set<number> {
    const closed = new Set<number>();
    const data = this.readProgress();
    if (data === null) return closed;
    for (const row of data.waves) {
      if (this.#rowClosed({ tasks: row.wave }, row)) {
        for (const id of row.wave.split(",").map((part) => Number(part))) closed.add(id);
      }
    }
    return closed;
  }

  /** Whether one progress row's line is closed — the LATEST recorded round's C5 route
   *  lies on the closure side ({done, next-wave}). The latest round is the last
   *  recorded fix round when one exists; the last review round otherwise; a row with
   *  no review round yet (implement-only or scheduled) holds the line open. */
  #rowClosed(params: HandoffParams, row: ProgressRow): boolean {
    const reviews = row.rounds?.review ?? 0;
    const fixes = row.rounds?.fix ?? 0;
    if (fixes > 0) {
      const route = this.#roundRoute("fix", params, Math.min(fixes, reviews));
      return Ledger.#closedBy(route);
    }
    if (reviews > 0) return Ledger.#closedBy(this.#roundRoute("review", params, reviews));
    return false;
  }

  /** The C5 route of one recorded round — null when the round is unreadable (a
   *  line whose round was never read cannot be judged closed: only present facts). */
  #roundRoute(op: "review" | "fix", params: HandoffParams, round: number): Route | null {
    const carried = this.round(op, "wave", params, round);
    if (carried === null) return null;
    return this.#router.next(EMPTY_RUN_STATE, carried);
  }

  /** The closure-side predicate — route.kind ∈ {done, next-wave} (the v1.20 terminal
   *  side, byte-identical to the lifecycle's #markTerminal gate). */
  static #closedBy(route: Route | null): boolean {
    return route !== null && (route.kind === "done" || route.kind === "next-wave");
  }

  // -------------------------------------------------------------------------
  // handoff — naming / carrier / single-author persist
  // -------------------------------------------------------------------------

  /** The family record of an op/type pair — the engine-config handoff namespace data
   *  (loud on an unknown family: the naming table is the single truth, never a second list). */
  #family(op: string, type: string): HandoffFamily {
    const family = this.#families[`${op}.${type}`];
    if (family === undefined) throw new Error(`unknown handoff family: ${op}.${type}`);
    return family;
  }

  /** The handoff FACE of an op/type pair — the family's `schema` selector (work when
   *  the family declares none). The face-aware read/write/bookkeep spine (T2): a
   *  findings-face round rides the findings writable subset, a work-face round rides
   *  the findings-free work subset — never the caller's guess. */
  handoffFaceOf(op: OpType, type: TargetType): HandoffSchemaFace {
    return this.#family(op, type).schema ?? "work";
  }

  /** The canonical handoff file name — the family's `{placeholder}` pattern, filled. */
  handoffName(op: string, type: string, params: HandoffParams = {}): string {
    return this.#family(op, type)
      .name.replaceAll("{tasks}", params.tasks ?? "")
      .replaceAll("{round}", String(params.round ?? ""));
  }

  /** The canonical on-disk handoff path. */
  handoffPath(op: string, type: string, params: HandoffParams = {}): string {
    return this.#workspace.resolve(this.handoffName(op, type, params));
  }

  /** The handoff carrier skeleton — the schema-declared writable fields the agent
   *  round fills, SHAPED PER FACE: the work overload builds a `findings`-free carrier
   *  (the work writable subset declares no findings field — the type gate: a
   *  `buildHandoff("work", { findings })` call is a compile-time refusal, Q1→c), the
   *  findings overload REQUIRES the findings payload (the schema's required field).
   *  The engine-seated identity (phase · tasks) rides the CANONICAL FILE NAME
   *  (`tasks-{wave}-*.json` / the range / doc family), never inline: phase/tasks are
   *  NOT declared and never written (v1.30 — the inline identity seeded a mimicking
   *  precedence: a fix draft copied the materialized `phase` the engine had written and
   *  tripped the reserved-field gate it could never pass; single declaration, single
   *  author — the carrier holds only the schema's declared plane, and status STILL
   *  rides the caller's set — the round conclusion is the engine's, not the skeleton's). */
  buildHandoff(face: "work", init?: WorkInit): WorkCarrier;
  buildHandoff(face: "findings", init: FindingsInit): FindingsCarrier;
  buildHandoff(
    face: HandoffSchemaFace,
    init: WorkInit & { findings?: unknown[] } = {},
  ): WorkCarrier | FindingsCarrier {
    const carrier: Record<string, unknown> = { artifacts: init.artifacts ?? {} };
    if (face === "findings" || init.findings !== undefined) carrier.findings = init.findings;
    return carrier as WorkCarrier | FindingsCarrier;
  }

  /** Persist a handoff payload at the canonical name — the single-author full-replace
   *  write (never a merge: the engine owns the file). Returns the written path. */
  persistHandoff(
    op: string,
    type: string,
    params: HandoffParams,
    data: Record<string, unknown>,
  ): string {
    this.#persist(this.handoffName(op, type, params), data);
    return this.handoffPath(op, type, params);
  }

  /** Read a handoff carrier; null when missing/corrupt. */
  readHandoff(op: string, type: string, params: HandoffParams): Record<string, unknown> | null {
    return this.#read<Record<string, unknown>>(this.handoffName(op, type, params));
  }

  // -------------------------------------------------------------------------
  // crash — the lane crash → recovery record
  // -------------------------------------------------------------------------

  /** The crash record file name — `crash-<lane>-<round>.json`. */
  crashName(lane: string, round: number): string {
    return `crash-${lane}-${round}.json`;
  }

  /** The crash record path. */
  crashPath(lane: string, round: number): string {
    return this.#workspace.resolve(this.crashName(lane, round));
  }

  /** Write a lane-crash recovery record — the resume decision source (the resume
   *  command + the dead child's tails), never the handoff carrier. Returns the record. */
  writeCrash(lane: string, round: number, record: CrashRecord): CrashRecord {
    this.#persist(this.crashName(lane, round), record);
    return record;
  }

  /** Read a crash record; null when absent/unreadable (a recordless failure round keeps
   *  the no-next failure face). */
  readCrash(lane: string, round: number): CrashRecord | null {
    return this.#read<CrashRecord>(this.crashName(lane, round));
  }

  // -------------------------------------------------------------------------
  // round — the round carrier
  // -------------------------------------------------------------------------

  /** The handoff findings presented as round findings — entries with an unknown severity
   *  are dropped (never invented into the judgment domain). */
  #findingsOf(carrier: Readonly<Record<string, unknown>>): readonly RoundFinding[] {
    if (!Array.isArray(carrier.findings)) return [];
    const findings: RoundFinding[] = [];
    for (const entry of carrier.findings) {
      const severity = (entry as { severity?: unknown } | null)?.severity;
      if (severity !== "blocker" && severity !== "warn" && severity !== "nit") continue;
      const summary = (entry as { summary?: unknown } | null)?.summary;
      findings.push({ severity, summary: typeof summary === "string" ? summary : undefined });
    }
    return findings;
  }

  /** The blocker count of a handoff carrier's findings — the C5-1 severity count. */
  #blockerCountOf(carrier: Readonly<Record<string, unknown>>): number {
    if (!Array.isArray(carrier.findings)) return 0;
    return carrier.findings.filter(
      (entry) => (entry as { severity?: unknown } | null)?.severity === "blocker",
    ).length;
  }

  /** The consecutive-S1 run — how many review rounds ending at `round` (newest first) each
   *  carried >=1 blocker finding. The run stops at the first clean review or an unreadable
   *  round history (missing/corrupt handoff degrades the count to the conservative baseline,
   *  never a throw). */
  #consecutiveS1Run(type: string, params: HandoffParams, round: number): number {
    let run = 0;
    for (let index = round; index >= 1; index--) {
      const carrier = this.readHandoff("review", type, { ...params, round: index });
      if (carrier === null) break;
      if (this.#blockerCountOf(carrier) === 0) break;
      run += 1;
    }
    return run;
  }

  /** The progress key a round's dispatch records under — the same line-identity key
   *  the lifecycle records with (run.ts #lineKey): the wave task key (the only
   *  params-bearing face — every other line keys by its line-type constant:
   *  `"branch"` / `"spec"` / `"plan"`). */
  #roundKey(type: TargetType, params: HandoffParams): LedgerKey {
    return type === "wave" ? (params.tasks ?? "") : type;
  }

  /** The recorded mode one op's round counts under — the review leg reads the
   *  face table's review-lead mode (the single source: branch→branch-review, the
   *  others→review), matching `recordRound(frame.key, frame.phase)`; the
   *  implement/fix legs their own name. */
  #recordedMode(op: OpType, type: TargetType): string {
    return op === "review" ? targetFaces[type].product.reviewLead : op;
  }

  /** Read a round's concluding record as the Round the dispatch next-router judges.
   *  A round is present ONLY when `recordRound` recorded it (the round verdict's
   *  single source): an unrecorded round returns null whatever draft sits on disk —
   *  a rejected child's leftover draft is never read back as a completed round
   *  (the §2.8 gate; without it a BLOCKED round with a stale draft rendered a
   *  contradictory `status: BLOCKED · next: done`). A fix round carries the SOURCE
   *  review's findings (C5-1: the `--findings` input content, never its own
   *  carrier); the consecutive-S1 run is walked from the review history.
   *  Missing/corrupt evaluated handoff → null too — a fix round whose source review
   *  is unreadable is never a zero-findings fabrication: a round whose blocker set
   *  was never read must not be judged clean. */
  round(op: OpType, type: TargetType, params: HandoffParams, round: number): Round | null {
    // §2.8 — the round-read gate: only a recorded round is a round.
    if (this.roundCount(this.#roundKey(type, params), this.#recordedMode(op, type)) < round) {
      return null;
    }
    if (op === "implement") {
      const carrier = this.readHandoff("implement", type, params);
      if (carrier === null) return null;
      return {
        phase: "implement",
        findings: [],
        consecutiveS1: 0,
      };
    }
    if (op === "review") {
      const reviewParams = { ...params, round };
      const carrier = this.readHandoff("review", type, reviewParams);
      if (carrier === null) return null;
      return {
        phase: "review",
        status: carrier.status as RoundStatus | undefined,
        findings: this.#findingsOf(carrier),
        findingsPath: this.handoffPath("review", type, reviewParams),
        consecutiveS1: this.#consecutiveS1Run(type, params, round),
      };
    }
    // op === "fix" — the C5-1 fingerprint: the fix round judges the source review's input
    // findings. Missing/corrupt source review OR fix carrier → null (no round on record),
    // matching the review branch's contract: a fix whose blocker set was never read must
    // not be judged a clean zero-findings round — the next-hop derivation cannot close a
    // line it could not read.
    const reviewParams = { ...params, round };
    const reviewCarrier = this.readHandoff("review", type, reviewParams);
    const fixCarrier = this.readHandoff("fix", type, reviewParams);
    if (reviewCarrier === null || fixCarrier === null) return null;
    return {
      phase: "fix",
      status: fixCarrier.status as RoundStatus | undefined,
      findings: this.#findingsOf(reviewCarrier),
      findingsPath: this.handoffPath("review", type, reviewParams),
      consecutiveS1: this.#consecutiveS1Run(type, params, round),
    };
  }
}
