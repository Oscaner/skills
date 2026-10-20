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
//     `--reviews` input content, C5-1), never its own; the consecutive-S1 run is
//     walked from the round history (the review-cycle soft-cap basis).
//
// Module-level exports are types / constant data / the class — zero behavior-
// carrying bare functions (the plan's zero-bare-function discipline).

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { ConfigLoader } from "../infra/config.ts";
import type { RepoPath, RepoRoot } from "../infra/root.ts";
import type { HandoffFamily } from "../infra/runtime.ts";
import type { Workspace } from "../infra/workspace.ts";
import { BriefRenderer } from "../render/brief.ts";
import { type TargetType, targetFaces } from "./faces.ts";
import {
  type DeliveryCarrier,
  type FindingsCarrier,
  HandoffSchema,
  type HandoffSchemaFace,
} from "./handoff-schema.ts";
import type { Route } from "./next.ts";
import { NextStepRouter } from "./next.ts";
import { EMPTY_RUN_STATE } from "./run.ts";

// ---------------------------------------------------------------------------
// the round carrier — what NextStepRouter.next (T7) judges
// ---------------------------------------------------------------------------

/** The delivery face's writable init — the schema-declared optional fields a delivery carrier
 *  starts from. The round conclusion (status) rides the CALLER's set — never a
 *  build-time value: the skeleton holds only the schema's declared writable plane. */
type DeliveryInit = {
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
  /** The review handoff path (fix: the `--reviews` input; review: its own handoff). */
  reviewsPath?: string;
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
  /** The completed rounds per mode (implement/review/fix), each as its CYCLE NUMBER —
   *  the round's IDENTITY, not a count (D28 · one fact one place). A fix cycle equals
   *  the review cycle it addressed (fix-K ⟷ review-K), so a fix that skips a cycle
   *  (a drift-voided review) records its identity — `[2]` — where a count would have
   *  flattened it to `1` and diverged from the carrier name `fix-2`. Review cycles are
   *  contiguous (1..N); `implement` is `[1]`. */
  rounds?: Record<string, number[]>;
  /** The line's reviewed identity — the doc-revision a spec/plan line bound (T7) OR
   *  the brief-revision a wave line bound (D30). Written at review completion; the
   *  identity-aware gate reopens the closed line on drift from it. The two kinds are
   *  mutually exclusive per row (a line is a doc line or a wave line, never both). */
  reviewedRevision?: ReviewedRevisionRef;
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

/** The dispatch-termination vocabulary — why a round was cut short (single source:
 *  the terminator derives the cause from the child's own result face, the crash
 *  record carries it as a postmortem fact, zero behavior fork — resume never routes
 *  on it). `stalled` = the engine's stall judgment killed the child; `over-budget` =
 *  the wall-clock ceiling was reached; `signal` = an external signal killed the
 *  child (any signal, one semantic — never the SIGTERM literal). */
export type TerminationCause = "stalled" | "over-budget" | "signal";

/** The stall judge's verdict per sample tick: `progress` (a leg advanced), `unknown`
 *  (a leg is unreadable — the fail-open state, never a kill), `idled` (no progress
 *  yet, the idle window is open) and `stalled` (no progress and the window is spent
 *  — the kill). */
export type StallVerdict = "progress" | "unknown" | "idled" | "stalled";

/** One sample tick's two legs — the process group's cumulative CPU (ms) and the
 *  newest mtime (ms) of the scanned tree. `null` = that leg is unreadable (the
 *  fail-open face: an unreadable leg never authorizes a kill). The field names are
 *  the heartbeat record's names (one naming, two references). */
export interface Sample {
  groupCpuMs: number | null;
  newestMtimeMs: number | null;
}

/** The recorded sample — a `Sample` extended with its tick's timestamp and the
 *  judge's verdict (the heartbeat file's field set; the crash record embeds it). */
export interface SampleRecord extends Sample {
  sampledAt: number;
  verdict: StallVerdict;
}

/** How a round ended when it did not end by itself — the derived cause plus the
 *  last observed sample (the postmortem pair the crash record carries; the sample
 *  rides the outcome in memory, never re-read from the heartbeat file). `unknown`
 *  is the unattributable fallback of the derivation. */
export interface Termination {
  cause: TerminationCause | "unknown";
  /** The judge's idle reading (ms) at the termination instant. */
  idleMs: number;
  lastSample: SampleRecord | null;
}

/** The lane-crash cause vocabulary — postmortem classification of why a dispatch
 *  terminated before the exit gate (zero behavior fork: resume never routes on it).
 *  The termination causes cover the round that was cut short; `child-exit` is the
 *  child's own non-zero exit; `handoff-absent` is the read-back face when the child
 *  exited 0 but wrote no draft at all; `contract-violation` is the read-back face
 *  when a draft is present but unqualified (malformed JSON / schema); and `unknown`
 *  is the unattributable termination fallback. Both read-back causes increment
 *  `contractViolationCount` — never folded under one cause word. */
export type CrashCause =
  | TerminationCause
  | "child-exit"
  | "handoff-absent"
  | "contract-violation"
  | "unknown";

/** The crash record — the lane crash's recovery record (`crash-<lane>-<round>.json`):
 *  the same-command resume's decision source (the resume command + the dead child's
 *  tails), never the handoff carrier. */
export interface CrashRecord {
  /** The dead child's exit code — null when the child never spawned (a broken
   *  command) or was terminated by a signal (a signalled child has no exit code;
   *  the signal semantics ride the `cause`). */
  exitCode: number | null;
  /** The dead child's stderr tail (the "403 / abort without trace" tail — the
   *  caller's captured lines, no fixed tail-length constant). */
  stderrTail: readonly string[];
  /** The dead child's stdout tail. */
  stdoutTail: readonly string[];
  /** The handoff path the dead child was expected to write (null when the lane carries none). */
  attemptedHandoff: string | null;
  /** The same-command resume string — emitted verbatim as `next: <resumeCommand>`. */
  next: string;
  /** The unified termination cause — postmortem, zero behavior fork. */
  cause: CrashCause;
  /** The terminated round's last observed sample (the stall face's postmortem pair) —
   *  null when the round was not cut short or no sample was ever taken. The sample
   *  rides the termination fact in memory (zero re-read of the heartbeat file the
   *  engine itself wrote); the on-disk heartbeat stays for a human's postmortem. */
  lastSample: SampleRecord | null;
  /** Whether the terminated round's draft was promoted to a conclusion (false on every
   *  non-terminated record). */
  promoted: boolean;
  /** The judge's idle reading (ms) at the termination instant — null when the round
   *  was not cut short. */
  idleMs: number | null;
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

/** The review-reference kind — each line-type binds its OWN reviewed identity (D30:
 *  honest identity, one concept one name — a `doc_hash` layer must never point at a
 *  non-document). `doc-revision` = the spec/plan line (the whole document file + its
 *  content hash); `brief-revision` = the wave line (the plan it renders FROM + the
 *  RENDERED brief's content hash — the wave's true judgment input, never the plan).
 *  The commit-bearing kinds (commit-set-ledger · commit-range) retired with the
 *  commit-sha surface (P7): a review judges the live tree, so no committed range
 *  is ever a ref. Node-level review is structurally absent (R5 · the wave-atomic
 *  model audits whole waves, never a single task node). */
export type RefKind = "doc-revision" | "brief-revision";

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

/** The brief-revision ref (D30) — the wave line's two-layer ref: the plan path the
 *  brief renders FROM (the re-render pointer judgment time needs) AND the RENDERED
 *  brief's content hash. The wave's judgment input is the brief (§5: its task
 *  sections + `## Constraints`), never the whole plan — so a plan edit outside the
 *  wave's tasks leaves this ref identical and the reviewed wave is not reopened. */
export interface BriefRevisionRef {
  kind: "brief-revision";
  /** The plan path the brief renders from — the first layer (the re-render pointer). */
  plan: string;
  /** The RENDERED brief's revision — the sha1 content hash of the brief, the second layer. */
  brief_hash: string;
}

/** The reviewed-identity ref a progress row binds — the doc-revision (a spec/plan
 *  line) OR the brief-revision (a wave line); the two are mutually exclusive per row. */
export type ReviewedRevisionRef = DocRevisionRef | BriefRevisionRef;

/**
 * ReviewRefs — the review-reference face (T25): the two-layer bindings (`docRevision`
 * — the doc hash from its content · `briefRevision` — the rendered brief's hash from
 * the plan it renders from) and the same-ref predicate (the SAME identity already
 * bound is refused, never silently re-reviewed). The face is the ledger's review-ref
 * derivation point — typed data, zero prose.
 */
export class ReviewRefs {
  /** The doc-revision two-layer binding — the doc path + the content-hash revision
   *  (sha1 of the reviewed file content — the second layer of the doc ref). */
  docRevision(doc: string, content: string | Buffer): DocRevisionRef {
    return { kind: "doc-revision", doc, doc_hash: this.#hash(content) };
  }

  /** The brief-revision two-layer binding (D30) — the plan path the brief renders
   *  from + the RENDERED brief content's hash (the wave line's reviewed identity). */
  briefRevision(plan: string, briefContent: string | Buffer): BriefRevisionRef {
    return { kind: "brief-revision", plan, brief_hash: this.#hash(briefContent) };
  }

  /** The ref-identity predicate — two refs are the SAME ref when same-kind AND their
   *  two-layer identity matches (the layer-1 path + the layer-2 hash). Two refs of
   *  different kinds are never the same ref (a doc-revision never equals a
   *  brief-revision — the kind IS part of the identity). */
  sameRef(a: ReviewedRevisionRef, b: ReviewedRevisionRef): boolean {
    if (a.kind === "doc-revision" && b.kind === "doc-revision")
      return a.doc === b.doc && a.doc_hash === b.doc_hash;
    if (a.kind === "brief-revision" && b.kind === "brief-revision")
      return a.plan === b.plan && a.brief_hash === b.brief_hash;
    return false;
  }

  /** The content-hash revision — sha1 hex of the reviewed content. */
  #hash(content: string | Buffer): string {
    // The revision hash is a content digest (a fingerprint of the reviewed bytes),
    // never a commit ref — the full sha1 hex stays unsliced so the bind basis covers
    // the whole content, not a truncated prefix.
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
  /** The handoff-schema face — the conclusion single source (`conclusionOf`), one
   *  instance per ledger (the round verdict derives from the face's own plane at
   *  judgment time · D27). */
  readonly #handoffSchema = new HandoffSchema();
  /** The review-reference face (T25) — the refKind classification + the same-ref
   *  reject, one instance per ledger (the run's bound refs). */
  readonly #refs = new ReviewRefs();
  /** The task-brief renderer (D30) — the wave line's judgment-input derivation:
   *  the wave's reviewed basis is the RENDERED brief's content, never the whole
   *  plan (a backfill touching other tasks must not void a reviewed wave). */
  readonly #brief = new BriefRenderer();

  constructor(workspace: Workspace, config: ConfigLoader) {
    this.#workspace = workspace;
    this.#families = config.handoffNamespace().families;
  }

  /** The review-reference face — the refKind three-type derivation + binding (T25). */
  refs(): ReviewRefs {
    return this.#refs;
  }

  /** The ledger's repo-basis value object — the ONE conversion exit every persisted
   *  path field normalizes through (T1 `RepoRoot` · P9 T4 §2.7). The basis is the
   *  workspace root's OWN value object (built once at the root's boundary) — never
   *  re-wrapped here (branch-review-1 F2: one basis, one form). */
  #basis(): RepoRoot {
    return this.#workspace.root.basis;
  }

  /** Normalize a path value to the canonical repoRoot-relative `RepoPath` — the
   *  comparison/write side of the shapes fix (a persisted relative value and an
   *  incoming absolute argv value compare on ONE basis). */
  #rel(value: string): RepoPath {
    return this.#basis().relativize(value);
  }

  /** Erase a (possibly relative) path value to the absolute syscall string for a
   *  read (a legacy relative persisted value resolves against the basis, never
   *  `process.cwd()`). */
  #abs(value: string): string {
    return this.#basis().resolve(this.#basis().relativize(value));
  }

  // ---- the single author's write/read primitives ----

  /** Persist a JSON artifact — the ledger's single write point (engine sole author). */
  #persist(name: string, data: unknown): void {
    this.#workspace.writeJson(name, data);
  }

  /** Read a JSON artifact; null when missing/corrupt (the ledger's read face keeps the
   *  collapsed contract — the tri-state discrimination lives at the read-back
   *  reconstruct, which reports a malformed draft's true cause). */
  #read<T>(name: string): T | null {
    const read = this.#workspace.readJson<T>(name);
    return read.kind === "ok" ? read.value : null;
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

  /** One mode's recorded cycle numbers on a row — the raw identity list, normalizing a
   *  legacy numeric count (`fix: 1`) to its assumed contiguous identity (`[1]`, the old
   *  1:1 assumption). Absent/empty → `[]`. */
  #cyclesOf(row: ProgressRow | undefined, mode: string): readonly number[] {
    const raw = row?.rounds?.[mode];
    if (raw === undefined) return [];
    return Array.isArray(raw) ? raw : Array.from({ length: raw }, (_unused, index) => index + 1);
  }

  /** The last completed round of a dispatch key + mode — 0 when none on record (the
   *  round COUNT: the length of the recorded cycle set — for a contiguous review line
   *  this equals the latest cycle, but the identity is the cycle list, never the count). */
  roundCount(key: LedgerKey, mode: string): number {
    const data = this.readProgress();
    if (data === null) return 0;
    return this.#cyclesOf(this.rowFor(data, key), mode).length;
  }

  /** Whether a dispatch key + mode has a round recorded for a given CYCLE — the
   *  identity test the round-read gate uses (a fix cycle that skipped a number is
   *  present at its own number, not at its ordinal — D28). */
  roundRecorded(key: LedgerKey, mode: string, cycle: number): boolean {
    const data = this.readProgress();
    if (data === null) return false;
    return this.#cyclesOf(this.rowFor(data, key), mode).includes(cycle);
  }

  /** Record a completed round — the on-disk done record (the ledger edge of the
   *  ExecutionState carrier: TaskGraph in memory, the ledger on disk). The round's
   *  CYCLE is its identity (fix-K ⟷ review-K · D28), so a skipped cycle records its
   *  own number, never a flattened ordinal. The production caller passes the frame's
   *  own `round`; the default (the next cycle after the latest) records a sequential
   *  round. Creates the row on demand; the write is idempotent per cycle (a re-record
   *  of the same cycle does not double it). */
  recordRound(key: LedgerKey, mode: string, cycle?: number): number {
    const data = this.readProgress() ?? this.emptyProgress();
    let row = this.rowFor(data, key);
    if (row === undefined) {
      row = this.entryFor(key);
      data.waves.push(row);
    }
    const cycles = [...this.#cyclesOf(row, mode)];
    const recorded = cycle ?? (cycles.length > 0 ? Math.max(...cycles) + 1 : 1);
    if (!cycles.includes(recorded)) cycles.push(recorded);
    cycles.sort((a, b) => a - b);
    row.rounds = { ...row.rounds, [mode]: cycles };
    this.writeProgress(data);
    return cycles.length;
  }

  /** Record a line's reviewed identity — the identity-aware gate's basis (written
   *  when the review round completes: the line reopens on drift from this recorded
   *  revision, and BLOCKs revision-aware when unchanged). The kind IS part of the
   *  identity: a doc line binds a doc-revision (T7), a wave line a brief-revision
   *  (D30) — one row, one reviewed identity. */
  recordReviewedRevision(key: LedgerKey, revision: ReviewedRevisionRef): void {
    const data = this.readProgress() ?? this.emptyProgress();
    let row = this.rowFor(data, key);
    if (row === undefined) {
      row = this.entryFor(key);
      data.waves.push(row);
    }
    row.reviewedRevision = revision;
    this.writeProgress(data);
  }

  /** Record a wave line's reviewed BRIEF revision (D30) — the RENDERED brief's
   *  content hash for the wave's tasks: the wave's true judgment input is the brief
   *  (§5: the wave's task sections + the plan's `## Constraints`), never the whole
   *  plan. A backfill touching OTHER tasks leaves this brief byte-identical, so the
   *  reviewed wave is not spuriously reopened (the backfill's whole point). An
   *  underivable brief records nothing (present facts only — the legacy face holds). */
  recordReviewedBrief(waveKey: string, planPath: string): void {
    const revision = this.#briefRevision(waveKey, planPath);
    if (revision !== null) this.recordReviewedRevision(waveKey, revision);
  }

  /** The wave line's reviewed-basis revision (D30) — the RENDERED brief's content
   *  hash for the wave's tasks (the `plan` layer is the plan the brief renders from,
   *  the `brief_hash` layer the brief's own digest). Null when the plan is unreadable
   *  or a requested task is absent (present facts only). */
  #briefRevision(waveKey: string, planPath: string): BriefRevisionRef | null {
    try {
      const tasks = waveKey.split(",").map((part) => Number(part));
      // The plan layer is stored repoRoot-relative (P9 T4 §2.7) — one basis with
      // every persisted path field; the read erases to absolute at the syscall edge.
      const brief = this.#brief.render(readFileSync(this.#abs(planPath), "utf8"), tasks);
      return this.#refs.briefRevision(this.#rel(planPath), brief);
    } catch {
      return null;
    }
  }

  /** A line's recorded reviewed identity — null when none on record (a line with no
   *  reviewed identity keeps the legacy closed face). Callers narrow by `kind`: a doc
   *  line binds a doc-revision, a wave line a brief-revision (the kinds never mix). */
  reviewedRevisionOf(key: LedgerKey): ReviewedRevisionRef | null {
    const data = this.readProgress();
    if (data === null) return null;
    return this.rowFor(data, key)?.reviewedRevision ?? null;
  }

  /** The doc line's recorded reviewed doc revision — the doc-revision narrowing of
   *  `reviewedRevisionOf` (null when none on record, or when a non-doc kind sits on
   *  the row — a doc line is never a wave line). */
  reviewedDocRevisionOf(key: LedgerKey): DocRevisionRef | null {
    const reviewed = this.reviewedRevisionOf(key);
    return reviewed !== null && reviewed.kind === "doc-revision" ? reviewed : null;
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
      // Both sides on ONE basis (P9 T4 §2.7): the recorded ref is repoRoot-relative;
      // the incoming target (an absolute argv-erasure) is relativized here so the
      // false-drift comparison never reads one document as two.
      const rel = this.#rel(doc);
      const current = this.#refs.docRevision(rel, readFileSync(this.#abs(doc), "utf8"));
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

  /** The wave line's active C5 Route — the next C5 hop the dispatch engine would run
   *  on this wave. A wave with no implement round yet is dispatched whole (`next-wave`
   *  carrying the wave key — the engine's `implement`-phase action, rendered as the
   *  implement literal); a recorded implement holding no review yet, or a re-review
   *  after a blocker-carrying fix, is the review hop; a review awaiting a fix (its own
   *  blockers outstanding) is the one-way fix hop carrying the source review's handoff
   *  path. Null when the wave line holds no open hop (drained / deferred by the soft
   *  cap). The D16/T11 revision precheck belongs HERE, not in a per-consumer copy: a
   *  completed wave review bound the RENDERED BRIEF it judged to the row (run.ts
   *  bookkeep `#recordReviewedWaveBrief` → `#briefRevision`), and a drifted BRIEF
   *  reopens the wave at review regardless of the fix-awaited round state (the
   *  stale-revision findings are voided — new revision, new review). Same revision + a
   *  pending fix stays at fix (Review Convergence anti-spin); a null record (legacy wave
   *  row) keeps the pure round-count derivation. The final leg reads the latest fix
   *  round's C5 route under EMPTY_RUN_STATE — the close-side is inert for the
   *  review/closure query (only the fix round's own blockers can yield review). The
   *  `waveLinePhase` judge below derives its phase word from this route (one walk), and
   *  the board's `next:` derivation reads the route itself (D40 — the active hop, never
   *  a bare face handoff). */
  waveLineRoute(waveKey: string): Route | null {
    const implemented = this.roundCount(waveKey, "implement");
    if (implemented === 0) return { kind: "next-wave", tasks: waveKey };
    const data = this.readProgress();
    const row = data === null ? undefined : this.rowFor(data, waveKey);
    const latestReview = row === undefined ? 0 : this.#latestCycleOfRow(row, "review");
    if (latestReview === 0) return { kind: "review" };
    // The latest recorded round is a fix iff a fix is recorded at the latest review's
    // CYCLE (D28 identity — fix-K ⟷ review-K); otherwise it is the latest review itself
    // (its route carries the awaited `fix`). The prior "no fix at the latest review cycle
    // ⇒ pending fix" short-circuit read a re-review-closed line (`review=[1,2] · fix=[1]`)
    // as forever at `fix`, missing the closing review-2 — the router read below is the
    // single judge (the `waveLineRoute` twin of `#rowClosed`).
    const fixRecorded = row !== undefined && this.#cyclesOf(row, "fix").includes(latestReview);
    const carried = this.round(
      fixRecorded ? "fix" : "review",
      "wave",
      { tasks: waveKey },
      latestReview,
    );
    if (carried === null) return null;
    const route = this.#router.next(EMPTY_RUN_STATE, carried);
    if (route?.kind === "review") return { kind: "review" };
    if (route?.kind === "fix") {
      // The fix-awaited face — a drifted wave BRIEF reopens at review (D30/D16), else fix.
      const reviewed = this.reviewedRevisionOf(waveKey);
      if (reviewed !== null && this.#briefDrift(waveKey, reviewed)) return { kind: "review" };
      return {
        kind: "fix",
        reviews: this.handoffPath("review", "wave", { tasks: waveKey, round: latestReview }),
      };
    }
    return null;
  }

  /** The wave line's open phase — the SINGLE derivation the wave gate AND the
   *  lifecycle's frame frontier both read (D26: one fact, one place, read at judgment
   *  time), mapped from `waveLineRoute`'s active C5 hop: the not-yet-implemented wave
   *  reads `implement`, the review hop `review`, the one-way fix hop `fix`, a drained /
   *  soft-capped line null. */
  waveLinePhase(waveKey: string): RoundPhase | null {
    const route = this.waveLineRoute(waveKey);
    if (route === null) return null;
    if (route.kind === "next-wave") return "implement";
    if (route.kind === "review") return "review";
    if (route.kind === "fix") return "fix";
    return null;
  }

  /** The wave line's brief-drift verdict (D30) — the wave's CURRENT rendered brief
   *  vs the recorded reviewed brief. `true` when the wave's judgment input moved past
   *  the reviewed basis (the wave reopens at review). A plan edit OUTSIDE the wave's
   *  task sections + `## Constraints` leaves the brief byte-identical → `false`
   *  (the append-only backfill case the whole-plan hash wrongly flagged). An
   *  underivable brief (unreadable plan / absent task) is not a drift (present
   *  facts only). A row bound to a non-brief kind (a doc kind, only via a corrupt
   *  hand-write) is not a wave brief — no drift. */
  #briefDrift(waveKey: string, reviewed: ReviewedRevisionRef): boolean {
    if (reviewed.kind !== "brief-revision") return false;
    const current = this.#briefRevision(waveKey, reviewed.plan);
    if (current === null) return false;
    return !this.#refs.sameRef(reviewed, current);
  }

  /** The pending-fix derivation — the "doc same + not APPROVED" face (T8): the
   *  latest review round has an outstanding fix AND its conclusion was not an
   *  approval. The identity test is the operable leg (D28): the latest review cycle
   *  is ABSENT from the fix cycle set (`roundRecorded(key, "fix", reviews)`) — a
   *  membership test, never a `reviews > fixes` count comparison, which would read a
   *  phantom pending fix when a cycle was skipped (a drift-voided review-1 → the first
   *  fix is cycle 2, present at its own number, not ordinal 1). The status read keeps
   *  the derivation's second leg explicit, degrading to the conservative pending on a
   *  missing carrier (a recorded round is a present fact — the same-doc re-review
   *  stays refused until its fix lands). A completed fix (the latest review cycle IS
   *  in the fix set) is NOT the pending face — the completed-fix line's re-review
   *  reopens through the fix round's C5 route (the legacy judgment). */
  #pendingFix(key: LedgerKey, type: TargetType): boolean {
    const reviews = this.roundCount(key, "review");
    if (reviews === 0 || this.roundRecorded(key, "fix", reviews)) return false;
    const carried = this.round("review", type, { round: reviews }, reviews);
    // `carried.status` is the review round's DERIVED conclusion — `round()` sets it
    // through the `HandoffSchema.conclusionOf` single source (the findings carrier
    // stores no status field · D27), never a second read of the carrier here.
    return carried === null || carried.status === undefined || carried.status !== "APPROVED";
  }

  /** Read one counter — a failure-category count on record (0 when the file is missing). */
  counterOf(key: ProgressCounterKey): number {
    return this.readProgress()?.[key] ?? 0;
  }

  /** Increment the timeout counter — the terminated-round write point (one TIMEOUT
   *  round lands, the count goes up by one). The counter's only writer. */
  incrementTimeoutCount(): number {
    const data = this.readProgress() ?? this.emptyProgress();
    data.timeoutCount += 1;
    this.writeProgress(data);
    return data.timeoutCount;
  }

  /** Increment the contract-violation counter — the read-back write point (one
   *  `handoff-absent` or `contract-violation` crash lands, the count goes up by
   *  one). The counter's only writer. */
  incrementContractViolationCount(): number {
    const data = this.readProgress() ?? this.emptyProgress();
    data.contractViolationCount += 1;
    this.writeProgress(data);
    return data.contractViolationCount;
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
   * board face) read this face — one closed set, one source.
   */
  closedWaves(): Set<number> {
    const closed = new Set<number>();
    const data = this.readProgress();
    if (data === null) return closed;
    for (const row of data.waves) {
      if (this.#rowClosed("wave", { tasks: row.wave }, row)) {
        for (const id of row.wave.split(",").map((part) => Number(part))) closed.add(id);
      }
    }
    return closed;
  }

  /** Whether one LINE is closed — the line-level closure judge the board's `next:`
   *  derivation and its branch row consume (and `closedWaves()` reads through the
   *  same core). The C5 route of the line's LATEST recorded round must lie on the
   *  closure side ({done, next-wave}). The key is the line-type constant the round
   *  records under ("spec" / "plan" / "branch"); a row with no review round yet
   *  (implement-only or absent) holds the line open. One judge, one source: the
   *  board never re-derives closure in the face (zero second judge). */
  lineClosed(key: LedgerKey, type: TargetType): boolean {
    const data = this.readProgress();
    if (data === null) return false;
    const row = this.rowFor(data, key);
    if (row === undefined) return false;
    return this.#rowClosed(type, type === "wave" ? { tasks: String(key) } : {}, row);
  }

  /** The single-target line's active C5 Route — the next C5 hop the dispatch engine
   *  would run on this line (the doc/branch faces: the review-lead round judges the
   *  live tree; a fix-awaited review, a re-review after a blocker-carrying fix). A line
   *  with no review-lead round yet is the review-lead hop (`{kind:"review"}` — the
   *  renderer keys the literal off the target type); a review round with findings is
   *  the one-way fix hop (carrying the review's handoff); a fix round that still carries
   *  blockers is the re-review hop. Null when the line holds no open hop (a clean review
   *  / a blocker-free fix closed it — the closure-side routes are not an "active hop").
   *  The pending-fix test is the latest review's IDENTITY membership in the fix cycle
   *  set (D28) — a count comparison would flatten a skipped cycle into a phantom pending
   *  fix. The doc-revision gate is NOT part of this walk — the callers run their own
   *  reviewGate first (doc-drift-first ordering). `linePhase` maps this route to its
   *  phase word (one walk), and the board's `next:` derivation reads the route itself
   *  (D40 — the active hop, never a bare face handoff). */
  lineRoute(key: LedgerKey, type: TargetType): Route | null {
    const reviewLead = targetFaces[type].product.reviewLead;
    const reviews = this.roundCount(key, reviewLead);
    if (reviews === 0) return { kind: "review" };
    if (!this.roundRecorded(key, "fix", reviews)) {
      const route = this.#lineRoundRoute("review", type, reviews);
      return route?.kind === "fix" ? route : null;
    }
    const route = this.#lineRoundRoute("fix", type, reviews);
    return route?.kind === "review" ? route : null;
  }

  /** The single-target line's open phase — the rounds/routes walk the lifecycle's
   *  frame frontier (run.ts #nextLinePhase) and the CLI gate (gate.ts #linePhase)
   *  BOTH consume (one judge, one source — the retired twin copies), mapped from
   *  `lineRoute`'s active C5 hop: the review-lead hop reads the face's own review-lead
   *  mode word (branch→branch-review, the others→review), the fix hop `"fix"`, a closed
   *  line null. */
  linePhase(key: LedgerKey, type: TargetType): RoundPhase | null {
    const route = this.lineRoute(key, type);
    if (route === null) return null;
    return route.kind === "review" ? targetFaces[type].product.reviewLead : "fix";
  }

  /** One single-target line round's C5 route — the review-lead / fix round read back
   *  through the ledger and judged by the router (null when unreadable). Single-target
   *  lines key their handoff params `{ round }` (the run.ts / gate.ts shaping) — the
   *  same #roundRoute the closure judge reads, one walk. */
  #lineRoundRoute(op: "review" | "fix", type: TargetType, round: number): Route | null {
    return this.#roundRoute(op, type, { round }, round);
  }

  /** Whether a C5 route lies on the closure side — the `{done, next-wave}` terminal
   *  predicate SINGLE SOURCE (D40): the lifecycle's #markTerminal, `#rowClosed` and
   *  every closure consumer read it here, never a re-typed literal. */
  static routeClosed(route: Route | null): boolean {
    return route !== null && (route.kind === "done" || route.kind === "next-wave");
  }

  /** Whether one progress row's line is closed — the LATEST recorded round's C5 route
   *  lies on the closure side ({done, next-wave}). The latest recorded round is a fix
   *  iff a fix is recorded at the latest review's CYCLE (D28 identity — fix-K ⟷
   *  review-K); otherwise it is the latest review itself. The prior `Math.min(latestFix,
   *  latestReview)` form was WRONG on a re-review-closed line: with `review=[1,2] ·
   *  fix=[1]` (review-1 → fix-1 → review-2) it read the STALE fix-1 (whose route is
   *  `review`) and missed the closing review-2 (whose route is `done`) — reading the
   *  line forever open at fix. The latest recorded round is `review@2` here. A row with
   *  no review round yet (implement-only or scheduled) holds the line open. The row's
   *  review-lead mode rides the faces table (branch→branch-review, the others→review),
   *  so the wave/spec/plan/branch lines share ONE judge. */
  #rowClosed(type: TargetType, params: HandoffParams, row: ProgressRow): boolean {
    const latestReview = this.#latestCycleOfRow(row, targetFaces[type].product.reviewLead);
    if (latestReview === 0) return false;
    const fixRecorded = this.#cyclesOf(row, "fix").includes(latestReview);
    return Ledger.routeClosed(
      this.#roundRoute(fixRecorded ? "fix" : "review", type, params, latestReview),
    );
  }

  /** The latest recorded cycle of a row + mode — 0 when none (the identity read; a
   *  skipped cycle reports its own number, never the count). */
  #latestCycleOfRow(row: ProgressRow, mode: string): number {
    const cycles = this.#cyclesOf(row, mode);
    return cycles.length > 0 ? Math.max(...cycles) : 0;
  }

  /** The C5 route of one recorded round — null when the round is unreadable (a
   *  line whose round was never read cannot be judged closed: only present facts). */
  #roundRoute(
    op: "review" | "fix",
    type: TargetType,
    params: HandoffParams,
    round: number,
  ): Route | null {
    const carried = this.round(op, type, params, round);
    if (carried === null) return null;
    return this.#router.next(EMPTY_RUN_STATE, carried);
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
   *  findings-face round rides the findings writable subset, a delivery-face round rides
   *  the findings-free work subset — never the caller's guess. */
  handoffFaceOf(op: OpType, type: TargetType): HandoffSchemaFace {
    return this.#family(op, type).schema ?? "delivery";
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
   *  round fills, SHAPED PER FACE: the delivery overload builds a `findings`-free carrier
   *  (the work writable subset declares no findings field — the type gate: a
   *  `buildHandoff("delivery", { findings })` call is a compile-time refusal, Q1→c), the
   *  findings overload REQUIRES the findings payload (the schema's required field).
   *  The engine-seated identity (phase · tasks) rides the CANONICAL FILE NAME
   *  (`tasks-{wave}-*.json` / the range / doc family), never inline: phase/tasks are
   *  NOT declared and never written (v1.30 — the inline identity seeded a mimicking
   *  precedence: a fix draft copied the materialized `phase` the engine had written and
   *  tripped the reserved-field gate it could never pass; single declaration, single
   *  author — the carrier holds only the schema's declared plane, and status STILL
   *  rides the caller's set — the round conclusion is the engine's, not the skeleton's). */
  buildHandoff(face: "delivery", init?: DeliveryInit): DeliveryCarrier;
  buildHandoff(face: "findings", init: FindingsInit): FindingsCarrier;
  buildHandoff(
    face: HandoffSchemaFace,
    init: DeliveryInit & { findings?: unknown[] } = {},
  ): DeliveryCarrier | FindingsCarrier {
    const carrier: Record<string, unknown> = { artifacts: init.artifacts ?? {} };
    if (face === "findings" || init.findings !== undefined) carrier.findings = init.findings;
    return carrier as DeliveryCarrier | FindingsCarrier;
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

  /** The recorded mode one op's round records its cycle under — the review leg reads
   *  the face table's review-lead mode (the single source: branch→branch-review, the
   *  others→review), matching `recordRound(frame.key, frame.phase, frame.round)`; the
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
   *  review's findings (C5-1: the `--reviews` input content, never its own
   *  carrier); the consecutive-S1 run is walked from the review history.
   *  Missing/corrupt evaluated handoff → null too — a fix round whose source review
   *  is unreadable is never a zero-findings fabrication: a round whose blocker set
   *  was never read must not be judged clean. */
  round(op: OpType, type: TargetType, params: HandoffParams, round: number): Round | null {
    // §2.8 — the round-read gate: only a recorded round is a round. The test is the
    // round's IDENTITY (its cycle number), not a count: a fix that skipped a cycle
    // (a drift-voided review → the first fix is cycle 2, not ordinal 1) is present at
    // cycle 2 (D28). A count comparison would flatten that to 1 and refuse the read.
    if (!this.roundRecorded(this.#roundKey(type, params), this.#recordedMode(op, type), round)) {
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
        // The conclusion is DERIVED from the review carrier's own findings at judgment
        // time (D27 · the findings carrier holds no status field) — the single source
        // shared with the fix leg below (`HandoffSchema.conclusionOf`).
        status: this.#handoffSchema.conclusionOf("findings", carrier),
        findings: this.#findingsOf(carrier),
        reviewsPath: this.handoffPath("review", type, reviewParams),
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
      // The fix round's conclusion derives from ITS OWN carrier's declared plane (the
      // delivery face reads its status; a docs-fix findings face rolls its findings up) —
      // the same `conclusionOf` single source (D27).
      status: this.#handoffSchema.conclusionOf(this.handoffFaceOf("fix", type), fixCarrier),
      findings: this.#findingsOf(reviewCarrier),
      reviewsPath: this.handoffPath("review", type, reviewParams),
      consecutiveS1: this.#consecutiveS1Run(type, params, round),
    };
  }
}
