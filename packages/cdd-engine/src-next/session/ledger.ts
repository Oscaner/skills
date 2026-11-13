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
import { readdirSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import { DocBodyProjection } from "../contract/doc-body.ts";
import { CarrierSeal } from "../infra/carrier-seal.ts";
import type { ConfigLoader } from "../infra/config.ts";
import type { RepoPath, RepoRoot } from "../infra/root.ts";
import type { HandoffFamily } from "../infra/runtime.ts";
import type { Workspace } from "../infra/workspace.ts";
import { BriefRenderer } from "../render/brief.ts";
import { CarrierIntegrity } from "./carrier-integrity.ts";
import { type RouteTarget, type TargetType, targetFaces } from "./faces.ts";
import { type Carrier, type CarrierPlane, HandoffSchema } from "./handoff-schema.ts";
import { LineIdentity } from "./line-identity.ts";
import type { DocClassVerdict, NextHop, Route } from "./next.ts";
import { NextStepRouter } from "./next.ts";
import { type RoundArtifact, RoundNaming } from "./round-naming.ts";
import { EMPTY_RUN_STATE } from "./run.ts";

// ---------------------------------------------------------------------------
// the round carrier — what NextStepRouter.next (T7) judges
// ---------------------------------------------------------------------------

/** The work plane's writable init — the schema-declared optional fields a work carrier
 *  starts from. The round conclusion (status) rides the CALLER's set — never a
 *  build-time value: the skeleton holds only the schema's declared writable plane. */
type WorkInit = {
  artifacts?: Record<string, string>;
};

/** The judge plane's writable init — `findings` is the schema-REQUIRED field of the
 *  judge plane (the compile-time twin of the read-back required gate — a judge
 *  init omitting it is a type error), artifacts optional. */
type JudgeInit = {
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

/** The terminal verdict of one dispatched round — the two facts the completion
 *  readers and the board judge. `targetAction` is the completion verdict (the round
 *  did what its verb promised); `treeClean` is the dispatch-after observation of the
 *  working tree (not a gate). */
export interface RoundVerdict {
  readonly treeClean: boolean;
  readonly targetAction: boolean;
}

/** One graded violation of a round — `hard` fails the round, `soft` is bookkeeping
 *  only (never a gate). */
export type RoundViolation = {
  readonly grade: "hard" | "soft";
  readonly cause: string;
  readonly message: string;
};

/** The graded-violation literals' ONE construction point — the cause vocabulary is
 *  a declared convergence point, so its shape is held here rather than copied per
 *  call site. `cause` defaults to `contract-violation`, the ledger's existing row
 *  for a self-authored entry; a death fact passes its own cause. */
export const RoundViolation = {
  hard: (message: string, cause = "contract-violation"): RoundViolation => ({
    grade: "hard",
    cause,
    message,
  }),
  soft: (message: string, cause = "contract-violation"): RoundViolation => ({
    grade: "soft",
    cause,
    message,
  }),
};

/** One dispatched round's record — its identity (`op` + `cycle` + `attempt`), the
 *  dispatch baseline HEAD, the terminal verdict, its graded violations and the
 *  carrier path (null when the round wrote none). A dispatched round is recorded
 *  unconditionally; "completed" is a read of `verdict.targetAction`, never a
 *  membership test. */
export interface RoundRecord {
  readonly op: OpType;
  readonly cycle: number;
  readonly attempt: number;
  readonly dispatchBase: string | null;
  readonly verdict: RoundVerdict;
  readonly violations: readonly RoundViolation[];
  readonly carrierPath: string | null;
  /** The content digest the engine recorded for the carrier it wrote (P31 §2.2) —
   *  the payload rule's `CarrierIntegrity.digestOf` value, taken from the write seam's
   *  own bytes at persist time. Absent on every record written before the column
   *  existed (zero migration) and null on a round that persisted no carrier; either
   *  way the read is a present-facts read with zero comparison. */
  readonly carrierDigest?: string | null;
  /** The child's DRAFT carrier the round wrote its final beside (P31 §2.3) — the
   *  family-path draft the finalized carrier no longer overwrites. Absent on every
   *  record written before the column existed (zero migration): a legacy round's one
   *  path IS its carrier, and the read keeps the resolved family name. */
  readonly draftPath?: string | null;
  /** The supersede stamp (P30 §2.3) — the cycle that REPLACED this review's judgment
   *  (the `--recover` reopen dispatched `cycle` next, so this round's pending fix is no
   *  longer owed). Absent on every ordinary round and on every record written before
   *  the column existed (zero migration). The record keeps its own verdict: the stamp
   *  records that a newer judgment supersedes it, never that it failed. */
  readonly supersededBy?: { readonly cycle: number; readonly cause: "recover" };
}

/** One dispatched round's identity — the verdict-free projection a completion
 *  judgment reads. A completion verdict must never be an input to the judgment that
 *  produces it, so the criteria see this shape, not a record whose `verdict` cell
 *  the judgment itself would fill. */
export type RoundIdentity = Pick<
  RoundRecord,
  "op" | "cycle" | "attempt" | "dispatchBase" | "carrierPath"
>;

/** The writable shape of one round record — the stored record with the identity
 *  facts defaultable (the seeding form still allocates the cycle from the row's
 *  latest in-register cycle). Production dispatch passes the whole identity. */
export interface RoundRecordInit {
  readonly op: OpType;
  readonly cycle?: number;
  readonly attempt?: number;
  readonly dispatchBase?: string | null;
  readonly verdict?: RoundVerdict;
  readonly violations?: readonly RoundViolation[];
  readonly carrierPath?: string | null;
  readonly carrierDigest?: string | null;
  readonly draftPath?: string | null;
}

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

/** The fixed counter key set — the failure-category counters the engine still WRITES,
 *  verbatim. */
export const PROGRESS_COUNTER_ZERO = {
  timeoutCount: 0,
  engineSelfWrittenCount: 0,
  engineRecoveryCount: 0,
  harnessAbortCount: 0,
} as const;

/** The retired counter keys — still READABLE through `counterOf` (its callers name
 *  them), never written: their value derives from the round records
 *  (`Ledger#softViolations`), and a legacy scalar left on disk is ignored — zero
 *  migration, zero rewrite of history. */
export const PROGRESS_COUNTER_RETIRED = {
  contractViolationCount: 0,
} as const;

/** The counter member keys — the derived literal union (never re-typed). */
export type ProgressCounterKey =
  | keyof typeof PROGRESS_COUNTER_ZERO
  | keyof typeof PROGRESS_COUNTER_RETIRED;

/** One progress row — keyed by the wave key string (T26 · the wave-unitary model:
 *  every dispatch is a wave — `--tasks 1` is the single-task wave `"1"`, `--tasks
 *  1,2` the wave `"1,2"` — one row form, never a task/wave split). */
export type ProgressRow = {
  /** The wave key string — the dispatch group identity (`"1"` · `"1,2"`). */
  wave: string;
  /** The dispatched rounds of this row — the per-round records (identity + verdict +
   *  violations + carrier). The read-time normalizer (`RoundRecords.of`) folds the
   *  legacy two forms (a per-mode cycle array / a numeric cycle count) into completed
   *  records; the write face appends the new form only. */
  rounds?: RoundRecord[] | Record<string, number[] | number>;
  /** The line's reviewed identity — the doc-revision a spec/plan line bound (T7) OR
   *  the brief-revision a wave line bound (D30). Written at review completion; the
   *  identity-aware gate reopens the closed line on drift from it. The two kinds are
   *  mutually exclusive per row (a line is a doc line or a wave line, never both). */
  reviewedRevision?: ReviewedRevisionRef;
  /** The plan's task set at the instant this wave closed, recorded ONCE at the
   *  closure point and never updated (a historical fact: the plan may later gain
   *  tasks, and the earlier snapshot must not be regenerable from it). Absent on a
   *  still-open wave and on every row written before this fact existed — the
   *  append-vs-stall judgment reads the absence conservatively. */
  planTasks?: readonly number[];
};

/** The progress.json data plane — the fixed top-level key set + the per-wave rows. */
export interface ProgressData {
  /** The `--plan` path recorded at first create. */
  plan?: string;
  timeoutCount: number;
  /** Retired by P22 (design spec §3.3): the soft-violation count derives from the
   *  round records. A scalar persisted by an older engine is read and IGNORED — the
   *  file keeps its bytes, the read face never republishes it. */
  contractViolationCount?: number;
  engineSelfWrittenCount: number;
  engineRecoveryCount: number;
  harnessAbortCount: number;
  waves: ProgressRow[];
}

/**
 * RoundRecords — the ONE read-time normalizer of a progress row's `rounds` plane.
 * The stored form is a record array; the two legacy forms (a per-mode cycle-number
 * array / a bare numeric cycle count) fold into completed records (the old write
 * recorded only `!blocked` rounds, so every legacy cycle IS a completed round).
 * Every reader (the ledger, the board, the dry-run preview, the pre-flight gate)
 * normalizes here — zero second read seam, zero migration write-back.
 */
// biome-ignore lint/complexity/noStaticOnlyClass: the normalization single point — the zero-bare-function discipline admits no standalone predicate functions.
export class RoundRecords {
  /** The row's round records, legacy forms folded — [] when the row carries none. */
  static of(row: ProgressRow | undefined): readonly RoundRecord[] {
    const raw = row?.rounds;
    if (raw === undefined) return [];
    if (Array.isArray(raw)) {
      return raw.filter(
        (entry): entry is RoundRecord =>
          typeof entry === "object" &&
          entry !== null &&
          typeof (entry as RoundRecord).op === "string",
      );
    }
    const records: RoundRecord[] = [];
    for (const [mode, value] of Object.entries(raw)) {
      const op = RoundRecords.opOf(mode);
      if (op === null) continue;
      const cycles = Array.isArray(value) ? value : RoundRecords.#contiguous(value);
      for (const cycle of cycles) records.push(RoundRecords.completed(op, cycle));
    }
    return records.sort((left, right) => left.cycle - right.cycle);
  }

  /** One completed record of an op/cycle — the legacy fold and the test/seed form. */
  static completed(op: OpType, cycle: number): RoundRecord {
    return {
      op,
      cycle,
      attempt: 1,
      dispatchBase: null,
      verdict: { treeClean: true, targetAction: true },
      violations: [],
      carrierPath: null,
    };
  }

  /** The op a recorded mode key belongs to — branch-review rides the review family;
   *  an unknown mode key reads null (a hand-written row is not a round record). */
  static opOf(mode: string): OpType | null {
    if (mode === "branch-review") return "review";
    return mode === "implement" || mode === "review" || mode === "fix" ? mode : null;
  }

  /** `n` as the contiguous identity list `1..n` (the retired numeric-count form). */
  static #contiguous(count: number): readonly number[] {
    return Array.from({ length: count }, (_unused, index) => index + 1);
  }
}

/** The ledger lookup key — a scalar task id or the group key string. */
export type LedgerKey = number | string;

/** One handoff file's parsed round identity — the four coordinates the naming face
 *  renders and the orphan face reads back, so the two compare identity with identity.
 *  `type` is the line the file name declares (`wave`, a document word, `plan`,
 *  `branch`, or the retired `spec` twin), so the claim's legacy tier can render the
 *  owning record's own carrier path from the same coordinates the scan read. */
interface HandoffOwner {
  readonly type: string;
  readonly key: string;
  readonly op: string;
  readonly round: number;
  readonly attempt: number;
}

/** The retired phase-spec row key — the spelling the round records carried before the
 *  target vocabulary unified on `phase-spec` (P22 D73). Rows already on disk keep it
 *  byte-frozen; the row read normalizes it (see `Ledger.rowFor`). */
const RETIRED_SPEC_KEY = "spec";

/** The identity-DOCUMENT line words a retired `spec` row may belong to — the words a
 *  workspace's document line keys under after the vocabulary unification. A workspace
 *  holds at most ONE identity document, so a retired `spec` row is exactly that
 *  document's line: `phase-spec` (the pre-rename default), a charter's `overall`, or a
 *  standalone `single-spec`. The plan line carried `plan` before the rename too and
 *  never lived under `spec`, so it stays out. */
const RETIRED_SPEC_LINE_KEYS: ReadonlySet<string> = new Set([
  "phase-spec",
  "overall",
  "single-spec",
]);

/** The dispatch-termination vocabulary — why a round was cut short (single source:
 *  the terminator derives the cause from the child's own result face, the crash
 *  record carries it as a postmortem fact, zero behavior fork — resume never routes
 *  on it). `stalled` = the engine's stall judgment killed the child; `over-budget` =
 *  the wall-clock ceiling was reached; `signal` = an external signal killed the
 *  child (any signal, one semantic — never the SIGTERM literal). */
export type TerminationCause = "stalled" | "over-budget" | "signal";

/** The stall judge's verdict per sample tick: `progress` (a leg advanced), `unknown`
 *  (no leg was readable anywhere in the stall window — the fail-open state, never a
 *  kill), `idled` (no progress yet, the idle window is open) and `stalled` (no progress
 *  and the window is spent — the kill). */
export type StallVerdict = "progress" | "unknown" | "idled" | "stalled";

/** One sample tick's two legs — the round log's size in bytes and the process group's
 *  cumulative CPU (ms). `null` = that leg is unreadable (the fail-open face: an
 *  unreadable leg neither advances, nor conjures `unknown`, nor blocks a stall). The
 *  field names are the recorded sample's own (`SampleRecord` extends this). The tick's
 *  instant is the one fact two record shapes name differently — `SampleRecord.at` on
 *  the recorded sample, `InFlightRecord.sampledAt` on the in-flight record — so neither
 *  shape renames the other's cells; the two names are one instant, never two facts. */
export interface Sample {
  logSize: number | null;
  cpuMs: number | null;
}

/** The recorded sample — a `Sample` extended with the tick's instant and the judge's
 *  verdict (the sampling trail's field set; the crash record embeds it). */
export interface SampleRecord extends Sample {
  at: number;
  verdict: StallVerdict;
}

/** How a round ended when it did not end by itself — the derived cause plus the
 *  last observed sample (the postmortem pair the crash record carries; the sample
 *  rides the outcome in memory, never re-read from the in-flight record). `unknown`
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
 *  child's own non-zero exit; `contract-violation` is the read-back rejection face
 *  when a draft is present but unqualified (malformed JSON / schema); `interrupted`
 *  is the abort fold's cause — a dispatch killed OUTSIDE the engine, booked when the
 *  stale in-flight record is taken over (spec §2.2), so the ledger carries the killed
 *  round's fact instead of only the lost lock; and `unknown` is the unattributable
 *  termination fallback. A MISSING draft is not a crash cause: the completion
 *  criterion owns it (§3.3), so the read-back rejection never fires there and this
 *  vocabulary names a present-but-unqualified draft alone. The crash record is a
 *  postmortem artifact only — the violation family, not this vocabulary, is what the
 *  round's counters derive from. */
export type CrashCause =
  | TerminationCause
  | "child-exit"
  | "contract-violation"
  | "interrupted"
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
  /** The round's log file (repoRoot-relative), null when the round had no log channel
   *  (a create failure, or a dispatch that never reached its spawn). The postmortem
   *  opens one file instead of reading `ps` from outside. */
  logPath: string | null;
  /** The same-command resume string — emitted verbatim as `next: <resumeCommand>`. */
  next: string;
  /** The unified termination cause — postmortem, zero behavior fork. */
  cause: CrashCause;
  /** The terminated round's last observed sample (the stall face's postmortem pair) —
   *  null when the round was not cut short or no sample was ever taken. The sample
   *  rides the termination fact in memory (zero re-read of the in-flight record the
   *  engine itself wrote); the standing record stays on disk for a human's postmortem. */
  lastSample: SampleRecord | null;
  /** Whether the terminated round's draft was promoted to a conclusion (false on every
   *  non-terminated record). */
  promoted: boolean;
  /** The judge's idle reading (ms) at the termination instant — null when the round
   *  was not cut short. */
  idleMs: number | null;
  /** The HEAD the dispatch started from — the postmortem basis of `commitsSince`.
   *  null when the round never reached a spawn or the repo carries no HEAD (a
   *  non-git tree). */
  dispatchBase: string | null;
  /** The commits added after `dispatchBase`, oldest first, each as `{sha} {subject}`
   *  — the work a crashed child left behind before it died (empty when nothing was
   *  committed, or when git could not be read). */
  commitsSince: readonly string[];
}

// ---------------------------------------------------------------------------
// handoff — the family naming params
// ---------------------------------------------------------------------------

/** Per-round handoff params — the naming identity's cells the renderer reads
 *  (`round` = the cycle, `tasks` = the wave line's task group, `attempt` = the
 *  dispatch's re-attempt). The branch line holds no commit identity — its cycle is its
 *  own round. */
export interface HandoffParams {
  /** The dispatch group's key string (comma-joined task ids). */
  tasks?: string;
  /** The round number (the identity's cycle — every family carries one now). */
  round?: number | string;
  /** The dispatch's attempt number (1 = the first attempt; the naming face renders
   *  `-a{n}` for every later one). Absent reads as the first attempt. */
  attempt?: number;
}

// ---------------------------------------------------------------------------
// review references — the refKind face (T25 · P5)
// ---------------------------------------------------------------------------

/** The review-reference kind — each line-type binds its OWN reviewed identity (D30:
 *  honest identity, one concept one name — a `doc_hash` layer must never point at a
 *  non-document). `doc-revision` = the spec/plan line (the document PATH + its BODY's
 *  content hash — the front matter and `## Change history` are projected away first,
 *  P26 T1); `brief-revision` = the wave line (the plan it renders FROM + its
 *  TASK-ONLY projection's content hash — the wave's true judgment input, never the
 *  whole plan and never the `## Constraints` dispatch input, P29 §2.2).
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
  /** The document revision — the sha1 hash of the reviewed BODY (the front matter
   *  and `## Change history` projected away, P26 T1). */
  doc_hash: string;
}

/** The brief-revision ref (D30) — the wave line's two-layer ref: the plan path the
 *  brief renders FROM (the re-render pointer judgment time needs) AND the wave's
 *  TASK-ONLY projection hash (P29 §2.2). The wave's judgment input is the brief's
 *  task sections (§5); the plan's `## Constraints` is dispatch input for the child,
 *  never part of the reopen fingerprint — so a Constraints reword leaves this ref
 *  identical and the reviewed wave is not reopened. */
export interface BriefRevisionRef {
  kind: "brief-revision";
  /** The plan path the brief renders from — the first layer (the re-render pointer). */
  plan: string;
  /** The TASK-ONLY projection's revision — the sha1 content hash of the wave's task
   *  sections, the second layer (`BriefRenderer#taskBody`). */
  brief_hash: string;
}

/** The reviewed-identity ref a progress row binds — the doc-revision (a spec/plan
 *  line) OR the brief-revision (a wave line); the two are mutually exclusive per row. */
export type ReviewedRevisionRef = DocRevisionRef | BriefRevisionRef;

/** One drifted identity's diagnosis (§2.5) — the layer's line key plus the two hash
 *  ends the refusal must print: what the review bound, and what the disk holds now.
 *  The full sha1 hex is the value; the caller renders a stable prefix. */
export interface DriftHashPair {
  /** The line key of the moved identity — the wave batch key, or the document path. */
  readonly line: string;
  /** The hash the review bound (the recorded revision's second layer). */
  readonly recorded: string;
  /** The hash the identity holds now. */
  readonly current: string;
}

/**
 * ReviewRefs — the review-reference face (T25): the two-layer bindings (`docRevision`
 * — the doc hash from its content · `briefRevision` — the wave's task-only projection
 * hash from the plan it renders from) and the same-ref predicate (the SAME identity already
 * bound is refused, never silently re-reviewed). The face is the ledger's review-ref
 * derivation point — typed data, zero prose.
 */
export class ReviewRefs {
  /** The doc-revision two-layer binding — the doc path + the BODY's content-hash
   *  revision (sha1 of the reviewed body — the second layer of the doc ref). The
   *  bookkeeping faces (front matter, `## Change history`) are projected away by the
   *  `contract/` projection first (P26 T1): a closed-out registration write never
   *  reopens a reviewed line, while a substantive body edit still drifts. */
  docRevision(doc: string, content: string | Buffer): DocRevisionRef {
    const body = typeof content === "string" ? content : content.toString("utf8");
    const projected = new DocBodyProjection().project(body);
    return { kind: "doc-revision", doc, doc_hash: this.#hash(projected) };
  }

  /** The brief-revision two-layer binding (D30, narrowed by P29 §2.2) — the plan path
   *  the brief renders from + the hash of the brief's TASK-ONLY projection (the wave
   *  line's reviewed identity; `## Constraints` is dispatch input, not a fingerprint
   *  byte). */
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
    // the whole input, not a truncated prefix.
    return createHash("sha1").update(content).digest("hex");
  }
}

// ---------------------------------------------------------------------------
// the review gate — the T8 drift-aware verdict (spec §3.5)
// ---------------------------------------------------------------------------

/** The review-gate verdict (T8 · §3.5 · v0.12 ruled) — the doc line's review
 *  request judgment: a doc moved past the reviewed revision reports `open`, and the
 *  reopen's SCOPE is the ONE `Ledger#docReopens` judgment its callers read (an
 *  exit-side line reopens onto the review lead; a still-pending fix keeps its round,
 *  §5.5 ②); an unchanged doc stays
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
  /** The handoff-family key set, keyed by `op.type` — the loud unknown-family check's
   *  input (the file names are the naming face's one mint, never a table here). */
  readonly #families: readonly HandoffFamily[];
  /** The C5 next router — the closure-side judge of the round carriers (stateless;
   *  the `closedWaves()` read face and the wave gate share the same router). */
  readonly #router = new NextStepRouter();
  /** The handoff-schema face — the conclusion single source (`conclusionOf`), one
   *  instance per ledger (the round verdict derives from the op's carrier plane at
   *  judgment time · D27). */
  readonly #handoffSchema = new HandoffSchema();
  /** The review-reference face (T25) — the refKind classification + the same-ref
   *  reject, one instance per ledger (the run's bound refs). */
  readonly #refs = new ReviewRefs();
  /** The three-line drift judgment (P21 §4.1) — the ONE identity face the doc line
   *  and the wave line both read (the branch line binds its plan's doc-revision
   *  through the same face). Injected with this ledger's own ref face, so the
   *  same-ref predicate keeps one definition. */
  readonly #identity = new LineIdentity(this.#refs);
  /** The task-brief renderer (D30 · P29 §2.2) — the wave line's judgment-input
   *  derivation: the wave's reviewed basis is the TASK-ONLY projection
   *  (`BriefRenderer#taskBody`), never the whole plan and never the `## Constraints`
   *  dispatch input (a backfill touching other tasks, or a Constraints reword, must
   *  not void a reviewed wave). */
  readonly #brief = new BriefRenderer();
  /** The round-naming single source over this ledger's workspace — the crash
   *  artifact names derive here (zero second derivation). */
  readonly #naming: RoundNaming;

  constructor(workspace: Workspace, config: ConfigLoader) {
    this.#workspace = workspace;
    this.#families = config.handoffNamespace().families;
    this.#naming = new RoundNaming(workspace);
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

  /** Persist a JSON artifact — the ledger's single write point (engine sole author).
   *  Returns the digest of the written bytes (the carrier record's `carrierDigest`). */
  #persist(name: string, data: unknown): string {
    return this.#workspace.writeJsonHashed(name, data);
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
   *  `"1"`) resolves the `{ task }` row; a multi-task wave key (`"1,2"`) the `{ wave }` row.
   *  A DOCUMENT-line lookup falls back to a row still carrying the retired `spec` key —
   *  the read-time alias keeps an in-flight line's recorded reviews/fixes on its board
   *  (the normalization is never written back: the stored key stays byte-frozen). The
   *  alias keys on the workspace's DECLARED line word (`identity` — the caller's
   *  declaration), never on the requested word alone: the retired row IS the line whose
   *  declaration names it (`phase-spec` / `overall` / `single-spec`). A caller holding no
   *  declaration keeps the pre-rename default (the `phase-spec` line). A row read is a
   *  pure function of the progress data, so every face — this class and the board's
   *  read-only line face — enters through this ONE lookup (no second key spelling). */
  static rowFor(
    data: ProgressData,
    key: LedgerKey,
    identity: TargetType | null = null,
  ): ProgressRow | undefined {
    const literal = data.waves.find((row) => row.wave === String(key));
    if (literal !== undefined || !Ledger.#retiredSpecApplies(key, identity)) return literal;
    return data.waves.find((row) => row.wave === RETIRED_SPEC_KEY);
  }

  /** Whether a retired `spec` row IS the requested line — the requested word must be a
   *  document-line word and, when the declaration is known, BE that declaration. */
  static #retiredSpecApplies(key: LedgerKey, identity: TargetType | null): boolean {
    const word = String(key);
    if (!RETIRED_SPEC_LINE_KEYS.has(word)) return false;
    return identity === null ? word === "phase-spec" : word === identity;
  }

  /** The fresh row for an absent key — always the wave form (a single trivial
   *  wave `"1"` is still the `{ wave: "1" }` row — one row form, T26). */
  entryFor(key: LedgerKey): ProgressRow {
    return { wave: String(key) };
  }

  /** One op's recorded cycle numbers on a row — every DISPATCHED cycle (legacy forms
   *  normalized through `RoundRecords`). A cycle re-dispatched several times is one
   *  cycle: the attempt count never widens the identity set. Absent/empty → `[]`. */
  #cyclesOf(row: ProgressRow | undefined, mode: string): readonly number[] {
    const op = RoundRecords.opOf(mode);
    if (op === null) return [];
    return [
      ...new Set(
        RoundRecords.of(row)
          .filter((record) => record.op === op)
          .map((record) => record.cycle),
      ),
    ];
  }

  /** The row's round records — the ONE read face the ledger's consumers share. A
   *  caller holding the line's DECLARED word passes it, so the retired `spec` row
   *  resolves as that line (the same basis as `rowFor`'s). */
  recordsOf(key: LedgerKey, identity: TargetType | null = null): readonly RoundRecord[] {
    const data = this.readProgress();
    if (data === null) return [];
    return RoundRecords.of(Ledger.rowFor(data, key, identity));
  }

  /** One op's COMPLETED cycles on a key — only `verdict.targetAction === true` records.
   *  The completion questions read this face; the dispatch-number allocation reads
   *  `roundCount` (every in-register cycle). The caller holding the line's DECLARED
   *  word passes it, so a migrated row is judged as that line (one basis with
   *  `rowFor`'s). */
  completedCycles(
    key: LedgerKey,
    op: OpType,
    identity: TargetType | null = null,
  ): readonly number[] {
    const data = this.readProgress();
    if (data === null) return [];
    return RoundRecords.of(Ledger.rowFor(data, key, identity))
      .filter((record) => record.op === op && record.verdict.targetAction)
      .map((record) => record.cycle);
  }

  /** The number of DISTINCT cycles on a dispatch key + mode — 0 when none on record
   *  (the round COUNT: the length of the recorded cycle identity set — for a
   *  contiguous review line this equals the latest cycle, but the identity is the
   *  cycle list, never the count, and a re-attempt at an existing cycle adds none). */
  roundCount(key: LedgerKey, mode: string, identity: TargetType | null = null): number {
    const data = this.readProgress();
    if (data === null) return 0;
    return this.#cyclesOf(Ledger.rowFor(data, key, identity), mode).length;
  }

  /** Whether a dispatch key + mode has a round REGISTERED for a given CYCLE — the
   *  identity test for the register (a fix cycle that skipped a number is present at
   *  its own number, not at its ordinal — D28). This is the test/seeding face: it
   *  answers register membership, NOT completion (a hard-failed round is registered),
   *  so no production completion question reads it — those read `completedCycles`. */
  roundRecorded(
    key: LedgerKey,
    mode: string,
    cycle: number,
    identity: TargetType | null = null,
  ): boolean {
    const data = this.readProgress();
    if (data === null) return false;
    return this.#cyclesOf(Ledger.rowFor(data, key, identity), mode).includes(cycle);
  }

  /** Record a dispatched round — the on-disk round record (the ledger edge of the
   *  ExecutionState carrier: TaskGraph in memory, the ledger on disk). Every dispatched
   *  round lands, failed rounds included; "completed" is the record's
   *  `verdict.targetAction`, never the write. The round's CYCLE is its identity
   *  (fix-K ⟷ review-K · D28), so a skipped cycle records its own number, never a
   *  flattened ordinal. The production caller passes the frame's whole identity
   *  (`Run`); the seeding form allocates the next cycle after the latest in-register
   *  one. The write is idempotent per (op, cycle, attempt): a re-record of the same
   *  identity does not double it. A caller holding the line's DECLARED word passes it
   *  too, so a migrated row is APPENDED TO rather than forked into a second identity
   *  row (the same one basis `rowFor` reads by). */
  recordRound(
    key: LedgerKey,
    init: RoundRecordInit,
    identity: TargetType | null = null,
  ): RoundRecord {
    const data = this.readProgress() ?? this.emptyProgress();
    let row = Ledger.rowFor(data, key, identity);
    if (row === undefined) {
      row = this.entryFor(key);
      data.waves.push(row);
    }
    const records = [...RoundRecords.of(row)];
    const cycle = init.cycle ?? this.#nextCycle(records, init.op);
    const record: RoundRecord = {
      op: init.op,
      cycle,
      attempt: init.attempt ?? 1,
      dispatchBase: init.dispatchBase ?? null,
      verdict: init.verdict ?? { treeClean: true, targetAction: true },
      violations: init.violations ?? [],
      carrierPath: init.carrierPath ?? null,
      // The digest column exists only on rounds that recorded one (a legacy record
      // keeps no key at all — the read then compares nothing, zero migration).
      ...(init.carrierDigest === undefined ? {} : { carrierDigest: init.carrierDigest }),
      // …and the same for the draft path column (P31 §2.3).
      ...(init.draftPath === undefined ? {} : { draftPath: init.draftPath }),
    };
    const existing = records.findIndex(
      (candidate) =>
        candidate.op === record.op &&
        candidate.cycle === record.cycle &&
        candidate.attempt === record.attempt,
    );
    if (existing === -1) records.push(record);
    else records[existing] = record;
    records.sort((left, right) =>
      left.cycle === right.cycle ? left.attempt - right.attempt : left.cycle - right.cycle,
    );
    row.rounds = records;
    this.writeProgress(data);
    return record;
  }

  /** The next un-registered cycle of an op — latest in-register + 1 (1 when none). */
  #nextCycle(records: readonly RoundRecord[], op: OpType): number {
    const cycles = records.filter((record) => record.op === op).map((record) => record.cycle);
    return cycles.length > 0 ? Math.max(...cycles) + 1 : 1;
  }

  /** Record a line's reviewed identity — the identity-aware gate's basis (written
   *  when a review or a fix round completes: the line reopens on drift from this
   *  recorded revision, and BLOCKs revision-aware when unchanged). The kind IS part
   *  of the identity: a doc line binds a doc-revision (T7), a wave line a
   *  brief-revision (D30) — one row, one reviewed identity. */
  recordReviewedRevision(
    key: LedgerKey,
    revision: ReviewedRevisionRef,
    identity: TargetType | null = null,
  ): void {
    const data = this.readProgress() ?? this.emptyProgress();
    let row = Ledger.rowFor(data, key, identity);
    if (row === undefined) {
      row = this.entryFor(key);
      data.waves.push(row);
    }
    row.reviewedRevision = revision;
    this.writeProgress(data);
  }

  /** Record a wave line's reviewed BRIEF revision (D30) — the hash of the wave's
   *  TASK-ONLY projection (P29 §2.2: the task sections, `## Constraints` excluded).
   *  A backfill touching OTHER tasks leaves this projection byte-identical, and so
   *  does a Constraints reword, so the reviewed wave is not spuriously reopened. An
   *  underivable brief records nothing (present facts only — the legacy face holds). */
  recordReviewedBrief(waveKey: string, planPath: string): void {
    const revision = this.#briefRevision(waveKey, planPath);
    if (revision !== null) this.recordReviewedRevision(waveKey, revision);
  }

  /** The wave line's reviewed-basis revision (D30) — the hash of the wave's TASK-ONLY
   *  projection (`BriefRenderer#taskBody`: the task sections, `## Constraints`
   *  excluded — P29 §2.2). The `plan` layer is the plan the brief renders from, the
   *  `brief_hash` layer the projection's own digest. Null when the plan is unreadable
   *  or a requested task is absent (present facts only). */
  #briefRevision(waveKey: string, planPath: string): BriefRevisionRef | null {
    try {
      const tasks = waveKey.split(",").map((part) => Number(part));
      // The plan layer is stored repoRoot-relative (P9 T4 §2.7) — one basis with
      // every persisted path field; the read erases to absolute at the syscall edge.
      const brief = this.#brief.taskBody(readFileSync(this.#abs(planPath), "utf8"), tasks);
      return this.#refs.briefRevision(this.#rel(planPath), brief);
    } catch {
      return null;
    }
  }

  /** A line's recorded reviewed identity — null when none on record (a line with no
   *  reviewed identity keeps the legacy closed face). Callers narrow by `kind`: a doc
   *  line binds a doc-revision, a wave line a brief-revision (the kinds never mix). */
  reviewedRevisionOf(
    key: LedgerKey,
    identity: TargetType | null = null,
  ): ReviewedRevisionRef | null {
    const data = this.readProgress();
    if (data === null) return null;
    return Ledger.rowFor(data, key, identity)?.reviewedRevision ?? null;
  }

  /** Record a wave row's plan-task snapshot — the task set the plan carried at the
   *  instant the wave CLOSED. The write is IDEMPOTENT: an existing snapshot is never
   *  overwritten, because the fact it records is historical (the plan may gain tasks
   *  afterwards; re-deriving would erase the append-vs-stall evidence). */
  recordPlanTasks(waveKey: LedgerKey, planTasks: readonly number[]): void {
    const data = this.readProgress() ?? this.emptyProgress();
    let row = Ledger.rowFor(data, waveKey);
    if (row === undefined) {
      row = this.entryFor(waveKey);
      data.waves.push(row);
    }
    if (row.planTasks !== undefined) return;
    row.planTasks = [...planTasks];
    this.writeProgress(data);
  }

  /** A wave row's plan-task snapshot — null on a historical row (recorded before the
   *  snapshot existed) and on a wave that never closed (no snapshot taken yet). The
   *  callers treat null conservatively: an absent snapshot never authorizes the
   *  append reading. */
  planTasksOf(waveKey: LedgerKey): readonly number[] | null {
    const data = this.readProgress();
    if (data === null) return null;
    return Ledger.rowFor(data, waveKey)?.planTasks ?? null;
  }

  /** The doc line's recorded reviewed doc revision — the doc-revision narrowing of
   *  `reviewedRevisionOf` (null when none on record, or when a non-doc kind sits on
   *  the row — a doc line is never a wave line). */
  reviewedDocRevisionOf(key: LedgerKey, identity: TargetType | null = null): DocRevisionRef | null {
    const reviewed = this.reviewedRevisionOf(key, identity);
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
  docLineVerdict(
    key: LedgerKey,
    doc: string,
    identity: TargetType | null = null,
  ): "drift" | "same" | null {
    const pair = this.#docRevisionPair(key, doc, identity);
    if (pair === null) return null;
    return this.#identity.verdict(pair.reviewed, { ref: pair.current }) === "same"
      ? "same"
      : "drift";
  }

  /** The doc line's two revision sides — the recorded reviewed revision and the one
   *  the document holds NOW (null when no reviewed revision is on record or the doc is
   *  unreadable). ONE read for TWO consumers: the drift verdict (`docLineVerdict`) and
   *  the refusal's mandatory diagnosis (`docDriftHashes`), so the two can never
   *  compare different bytes. */
  #docRevisionPair(
    key: LedgerKey,
    doc: string,
    identity: TargetType | null,
  ): { reviewed: DocRevisionRef; current: DocRevisionRef } | null {
    const reviewed = this.reviewedDocRevisionOf(key, identity);
    if (reviewed === null) return null;
    try {
      // Both sides on ONE basis (P9 T4 §2.7): the recorded ref is repoRoot-relative;
      // the incoming target (an absolute argv-erasure) is relativized here so the
      // false-drift comparison never reads one document as two.
      const rel = this.#rel(doc);
      const current = this.#refs.docRevision(rel, readFileSync(this.#abs(doc), "utf8"));
      return { reviewed, current };
    } catch {
      return null;
    }
  }

  /** The doc line's drift diagnosis (§2.5) — the layer's line key (the document path
   *  the review bound, on the ONE persisted basis) and both hash ends. Null when there
   *  is no recorded revision or the document is unreadable: a diagnosis never invents
   *  a fact. */
  docDriftHashes(
    key: LedgerKey,
    doc: string,
    identity: TargetType | null = null,
  ): DriftHashPair | null {
    const pair = this.#docRevisionPair(key, doc, identity);
    if (pair === null) return null;
    return {
      line: pair.reviewed.doc,
      recorded: pair.reviewed.doc_hash,
      current: pair.current.doc_hash,
    };
  }

  /** The wave line's drift diagnosis (§2.5) — the line key is the wave batch key, the
   *  hashes are the recorded vs current TASK-ONLY brief projections. Null when the row
   *  holds no brief identity or the plan's task section is underivable. */
  briefDriftHashes(waveKey: string): DriftHashPair | null {
    const pair = this.#briefRevisionPair(waveKey);
    if (pair === null) return null;
    return { line: waveKey, recorded: pair.reviewed.brief_hash, current: pair.current.brief_hash };
  }

  /** The review-gate method (T8 · §3.5) — the doc line's review request judgment +
   *  the phase advance: the shared docLineVerdict comparison reports the drift, and
   *  the REOPEN's scope is the callers' ONE judgment (`Ledger#docReopens` — an
   *  exit-side route is replaced by the review lead, while an already-pending fix
   *  keeps its round, §5.5 ②).
   *  An unchanged doc yields the `same` verdict (review Convergence anti-spin:
   *  the callers' reject/reopen decision — the derived pending fix opens the fix
   *  face only, while the no-pending face falls back to the legacy rounds/routes
   *  judgment: a completed-fix line's C5-1 route reopens the review lead). The OPEN
   *  side performs no disk advance: the round + the revision snapshot land with the
   *  round's completion (Ledger#recordRound + the T7 write-back), so a BLOCKED
   *  re-review resumes the same round (nothing pre-binds). `unbound` (no identity on
   *  record / an unreadable doc) keeps the legacy round/route judgment. */
  reviewGate(key: LedgerKey, doc: string, type: TargetType): ReviewGateVerdict {
    const verdict = this.docLineVerdict(key, doc, type);
    if (verdict === "drift") return { kind: "open" };
    if (verdict === "same") {
      const reviewed = this.reviewedDocRevisionOf(key, type);
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
   *  completed wave review bound the BRIEF's task-only projection to the row (run.ts
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
    const implemented = this.completedCycles(waveKey, "implement");
    if (implemented.length === 0) return { kind: "next-wave", tasks: waveKey };
    const data = this.readProgress();
    const row = data === null ? undefined : Ledger.rowFor(data, waveKey);
    const latestReview = row === undefined ? 0 : this.#latestCompletedCycleOfRow(row, "review");
    if (latestReview === 0) return { kind: "review" };
    // The latest recorded round is a fix iff a fix is recorded at the latest review's
    // CYCLE (D28 identity — fix-K ⟷ review-K); otherwise it is the latest review itself
    // (its route carries the awaited `fix`). The prior "no fix at the latest review cycle
    // ⇒ pending fix" short-circuit read a re-review-closed line (`review=[1,2] · fix=[1]`)
    // as forever at `fix`, missing the closing review-2 — the router read below is the
    // single judge (the `waveLineRoute` twin of `#rowClosed`).
    const fixRecorded =
      row !== undefined && this.#completedCyclesOfRow(row, "fix").includes(latestReview);
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
      if (this.briefDrifted(waveKey)) return { kind: "review" };
      // The `--reviews` identity is the ROUTE's own (P31 §2.3): the round read resolves
      // the FINAL carrier the record names, so a draft beside it never becomes the input
      // — the board's `next:` and the dispatch's read the same file by construction.
      return {
        kind: "fix",
        reviews:
          route.reviews ??
          this.resolveHandoffPath("review", "wave", { tasks: waveKey, round: latestReview }),
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

  /** The wave line's brief-drift verdict (D30) — the wave's CURRENT task-only
   *  projection (P29 §2.2) vs the recorded reviewed projection. `true` when the
   *  wave's judgment input moved past the reviewed basis (the wave reopens at
   *  review). A plan edit outside the wave's task sections — a `## Constraints`
   *  reword included, since Constraints is dispatch input rather than a fingerprint
   *  byte — leaves the task-only projection byte-identical → `false` (the
   *  append-only backfill case the whole-plan hash wrongly flagged). An underivable
   *  brief (unreadable plan / absent task) is not a drift (present facts only). A
   *  row bound to a non-brief kind (a doc kind, only via a corrupt hand-write) is
   *  not a wave brief — no drift. The ONE public read of the fact: `waveLineRoute`'s
   *  D30 leg and the next-hop assembly's reason-only `briefDrift` cell both come
   *  through here. */
  briefDrifted(waveKey: string): boolean {
    const pair = this.#briefRevisionPair(waveKey);
    if (pair === null) return false;
    return this.#identity.verdict(pair.reviewed, { ref: pair.current }) === "drift";
  }

  /** The wave line's two brief-projection sides — the recorded task-only revision and
   *  the one the plan renders NOW (null when the row holds no brief identity or the
   *  plan is unreadable / a requested task is absent). ONE read for TWO consumers: the
   *  drift predicate (`briefDrifted`) and the refusal's diagnosis
   *  (`briefDriftHashes`), so neither can hash a different projection. */
  #briefRevisionPair(
    waveKey: string,
  ): { reviewed: BriefRevisionRef; current: BriefRevisionRef } | null {
    const reviewed = this.reviewedRevisionOf(waveKey);
    if (reviewed === null || reviewed.kind !== "brief-revision") return null;
    const current = this.#briefRevision(waveKey, reviewed.plan);
    if (current === null) return null;
    return { reviewed, current };
  }

  /** The pending-fix derivation — the "doc same + not APPROVED" face (T8): the
   *  latest review round has an outstanding fix AND its conclusion was not an
   *  approval. The identity test is the operable leg (D28): the latest review cycle
   *  is ABSENT from the fix COMPLETION set (`#completedCyclesOfRow(row, "fix")`) — a
   *  membership test, never a `reviews > fixes` count comparison, which would read a
   *  phantom pending fix when a cycle was skipped (a drift-voided review-1 → the first
   *  fix is cycle 2, present at its own number, not ordinal 1). The completion set —
   *  not bare register membership (`roundRecorded`, the test/seeding face) — is the
   *  judging face: every dispatched round is registered, so a hard-failed `fix-K` IS
   *  in register while NOT completed, and a register test would read that failure as
   *  a done fix and strand the line forever. The status read keeps the derivation's
   *  second leg explicit, degrading to the conservative pending on a missing carrier
   *  (a recorded round is a present fact — the same-doc re-review stays refused until
   *  its fix lands). A completed fix (the latest review cycle IS in the fix
   *  completion set) is NOT the pending face — the completed-fix line's re-review
   *  reopens through the fix round's C5 route (the legacy judgment).
   *
   *  A SUPERSEDED review (P30 §2.3) is not a candidate: the reopen replaced its
   *  judgment, so the fix it awaited is no longer owed. */
  #pendingFix(key: LedgerKey, type: TargetType): boolean {
    const data = this.readProgress();
    if (data === null) return false;
    const row = Ledger.rowFor(data, key, type);
    if (row === undefined) return false;
    const reviews = this.#latestLiveCycleOfRow(row, "review");
    if (reviews === 0) return false;
    if (this.#completedCyclesOfRow(row, "fix").includes(reviews)) return false;
    const carried = this.round("review", type, { round: reviews }, reviews);
    // `carried.status` is the review round's DERIVED conclusion — `round()` sets it
    // through the `HandoffSchema.conclusionOf` single source (the findings carrier
    // stores no status field · D27), never a second read of the carrier here.
    return carried === null || carried.status === undefined || carried.status !== "APPROVED";
  }

  /** The line's derived pending-fix fact — the PUBLIC read face of `#pendingFix`
   *  (the `--recover` reopen's condition ②, P30 §2.3). One derivation, two readers;
   *  never a second walk from the face. */
  pendingFix(key: LedgerKey, type: TargetType): boolean {
    return this.#pendingFix(key, type);
  }

  /** Read one counter — a failure-category count on record (0 when the file is
   *  missing). The RETIRED key derives from the round records: the soft entries of
   *  every row plus the one each dirty-tree observation derives (design spec §3.3) —
   *  one read exit, `counterOf`, never a second stored scalar. */
  counterOf(key: ProgressCounterKey): number {
    if (key === "contractViolationCount") return this.softViolations();
    return this.readProgress()?.[key] ?? 0;
  }

  /** One key's SOFT violation count — the row's soft entries across its records plus
   *  the single row the `treeClean === false` observation derives (at most one per
   *  round: the verdict field IS that fact, never a second copy of it). Hard entries
   *  are the round's failure verdict (exit + `targetAction: false`), never a count. */
  softViolationsOf(key: LedgerKey): number {
    const data = this.readProgress();
    if (data === null) return 0;
    return this.#softOf(Ledger.rowFor(data, key));
  }

  /** The session's SOFT violation count — the derived `contractViolationCount` read
   *  face (`counterOf`'s retired key). A legacy scalar on disk is ignored. */
  softViolations(): number {
    const data = this.readProgress();
    if (data === null) return 0;
    return data.waves.reduce((total, row) => total + this.#softOf(row), 0);
  }

  /** One row's soft count — one derivation, both read faces above. */
  #softOf(row: ProgressRow | undefined): number {
    return RoundRecords.of(row).reduce(
      (total, record) =>
        total +
        record.violations.filter((violation) => violation.grade === "soft").length +
        (record.verdict.treeClean ? 0 : 1),
      0,
    );
  }

  /** Increment the timeout counter — the terminated-round write point (one TIMEOUT
   *  round lands, the count goes up by one). The counter's only writer. */
  incrementTimeoutCount(): number {
    const data = this.readProgress() ?? this.emptyProgress();
    data.timeoutCount += 1;
    this.writeProgress(data);
    return data.timeoutCount;
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
   *  records under (the target-type word — `"phase-spec"` / `"overall"` / `"plan"` /
   *  `"single-spec"` / `"branch"`); a row with no review round yet
   *  (implement-only or absent) holds the line open. One judge, one source: the
   *  board never re-derives closure in the face (zero second judge). */
  lineClosed(key: LedgerKey, type: TargetType): boolean {
    const data = this.readProgress();
    if (data === null) return false;
    const row = Ledger.rowFor(data, key, type);
    if (row === undefined) return false;
    return this.#rowClosed(type, type === "wave" ? { tasks: String(key) } : {}, row);
  }

  /** One line's closure state AS OF its identity document — the drift-aware judge
   *  both board read faces consume (the branch row's mark and the pipeline facts'
   *  branch `closed` cell), so the mark and the `next:` line can never print two
   *  different facts about one state. `closed` — the recorded rounds/routes lie on
   *  the closure side AND the identity document still matches the revision the line
   *  bound, or no identity document is on hand (`doc === null`): with no document
   *  there is no drift evidence, so the conservative answer is closed — a false
   *  reopen costs a whole branch review, while a false closure is what the `next:`
   *  face reports separately; `reopened` — the rounds/routes say closed but the
   *  document moved past them, which IS the gate's reopen (`reviewGate` → `open`, the
   *  ruling the CLI dispatch consults), so the line is the face awaiting review;
   *  `open` — the rounds/routes themselves hold the line open. */
  lineStateAt(
    key: LedgerKey,
    type: TargetType,
    doc: string | null,
  ): "closed" | "reopened" | "open" {
    if (!this.lineClosed(key, type)) return "open";
    return doc !== null && this.reviewGate(key, doc, type).kind === "open" ? "reopened" : "closed";
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
   *  reviewGate first and scope the reopen through `Ledger#docReopens`. `linePhase`
   *  maps this route to its phase word (one walk), and the board's `next:` derivation
   *  reads the route itself (D40 — the active hop, never a bare face handoff). */
  lineRoute(key: LedgerKey, type: TargetType): Route | null {
    const data = this.readProgress();
    if (data === null) return { kind: "review" };
    const row = Ledger.rowFor(data, key, type);
    if (row === undefined) return { kind: "review" };
    const reviewLead = targetFaces[type].product.reviewLead;
    const reviews = this.#latestLiveCycleOfRow(row, reviewLead);
    if (reviews === 0) return { kind: "review" };
    if (!this.#completedCyclesOfRow(row, "fix").includes(reviews)) {
      const route = this.#lineRoundRoute("review", type, reviews);
      return route?.kind === "fix" ? route : null;
    }
    const route = this.#lineRoundRoute("fix", type, reviews);
    return route?.kind === "review" ? route : null;
  }

  /** The single-target line's open phase — the rounds/routes walk the lifecycle's
   *  frame frontier (run.ts #nextLinePhase) and the authority's line-phase read both
   *  consume (one judge, one source — the retired twin copies), mapped from
   *  `lineRoute`'s active C5 hop: the review-lead hop reads the face's own review-lead
   *  mode word (branch→branch-review, the others→review), the fix hop `"fix"`, a closed
   *  line null. */
  linePhase(key: LedgerKey, type: TargetType): RoundPhase | null {
    const route = this.lineRoute(key, type);
    if (route === null) return null;
    return route.kind === "review" ? targetFaces[type].product.reviewLead : "fix";
  }

  /** One line's next hop (§5.2) — the derivation's INPUT face gathered from the
   *  line's OWN facts and handed to the router's ONE derivation: the drift-aware gate
   *  verdict, the ONE doc-class verdict (the declared station the face axis is read
   *  out of), the caller's route (the count table's row for a single line, the
   *  pipeline walk's route for the board) and the judged document. TWO assemblies
   *  call this derivation (the line frontier's and the pipeline frontier's
   *  `PipelineFrontier#hopOf`) and neither keeps a private copy of the inputs — the
   *  line frontier serves `peekNext` and the CLI rejection, the pipeline assembly
   *  serves the capsule and the board — and no judgment is re-made here (the route is
   *  the count table's). TWO drift values leave this assembly, kept apart on purpose:
   *    · the ROUTE SUBSTITUTION driver reads the gate verdict alone (a doc line's
   *      `reviewGate`); the injected `briefDrift` cell never moves a route — a wave's
   *      exit-side station (`handoff`) is never rewritten into a review;
   *    · the REASON cell adds the caller-injected wave brief-drift fact to that
   *      verdict, so a drifted wave names `brief-drift` without a second judgment —
   *      the document's own movement keeps `doc-drift` (§2.3: two facts, two tokens).
   *  The ONE exception to the route being the caller's is the drift-reopened doc
   *  line: the gate's `docDrift` verdict IS its reopen, and the closure-side route the
   *  count table recorded predates the document movement — so the assembly hands the
   *  derivation the reopened review hop in that case. A presentation-level
   *  substitution: the count table's judgment (`NextStepRouter#next`) stays the only
   *  judge, and a still-open hop (review / fix) is never overridden by the drift fact. */
  nextHopOf(input: {
    readonly type: TargetType;
    readonly key: LedgerKey;
    readonly route: Route | null;
    readonly target: RouteTarget | null;
    /** The line's judged document (spec/plan path, or the branch line's plan) — its
     *  drift verdict is the gate cell; absent off the doc lines. */
    readonly doc?: string | null;
    readonly nextLineOpen?: boolean;
    /** The wave line's injected brief-drift fact (D30) — the reason cell's second
     *  source, never a route driver (see above). Absent off the wave line. */
    readonly briefDrift?: boolean;
    readonly docClassOf: (target: RouteTarget) => DocClassVerdict;
  }): NextHop {
    const drift =
      input.doc != null && input.type !== "wave"
        ? this.reviewGate(input.key, input.doc, input.type).kind === "open"
        : false;
    // The drift-reopened line — its active hop IS the review lead (the gate's own
    // ruling): the EXIT-side route the table recorded (the line's closure or a
    // face-to-face handoff, or no route at all) predates the document movement, so
    // the derivation receives the review hop instead. An already-open hop (review /
    // fix) and the soft-cap adjudication row keep their own route — the pending-fix
    // face outranks drift (§5.1 · §5.5 ②). The exit side is the ONE predicate
    // (`Ledger.onExitSide`) every drift-reopen reader shares, so this assembly, the
    // dispatch gate and the lifecycle frontier can never disagree on the scope.
    const route =
      drift && Ledger.onExitSide(input.route) ? ({ kind: "review" } as const) : input.route;
    // The face axis is the ONE verdict this assembly reads (spec §5.2's doc-class
    // discrimination): no target carries no judgeable class (the bare terminal).
    const verdict: DocClassVerdict =
      input.target === null ? "terminal" : input.docClassOf(input.target);
    // The REASON cell's drift values — the doc verdict plus the caller-injected wave
    // brief-drift fact, each landing on ITS own boolean (§2.3). The two are kept
    // apart: only `docDrift` drives the route substitution, so a wave's exit-side
    // station keeps its bytes while its `reason:` row still names the movement — and
    // names it with the brief's own token, never the document's.
    return this.#router.nextHop({
      target: input.target,
      gate: { docDrift: drift, briefDrift: input.briefDrift ?? false },
      verdict,
      route,
      nextLineOpen: input.nextLineOpen,
    });
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

  /** Whether a C5 route sits on the line's EXIT side — a closure, the face-to-face
   *  `handoff` station a pipeline consumer hands over (an exit station, not a closure
   *  — the closure predicate deliberately excludes it), or no route at all. This is
   *  the drift reopen's ONE override scope (§5.1 · §5.5 ②): only an exit-side route
   *  predates the document movement, so only it is replaced by the review lead; a
   *  still-pending fix keeps its hop, and every drift-reopen reader asks HERE. */
  static onExitSide(route: Route | null): boolean {
    return route === null || route.kind === "handoff" || Ledger.routeClosed(route);
  }

  /** Whether the document's drift reopens the line onto its review lead — the ONE
   *  drift-reopen judgment the dispatch gate and the lifecycle frontier BOTH consume
   *  (the gate verdict is handed in: the comparison is read once). Drift never
   *  outranks a pending fix (§5.5 ②): a live review/fix hop on the non-exit side
   *  keeps its round, so no face names a round another face refuses. */
  docReopens(key: LedgerKey, type: TargetType, gate: ReviewGateVerdict): boolean {
    if (gate.kind !== "open") return false;
    return Ledger.onExitSide(this.lineRoute(key, type));
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
    const latestReview = this.#latestCompletedCycleOfRow(row, targetFaces[type].product.reviewLead);
    if (latestReview === 0) return false;
    const fixRecorded = this.#completedCyclesOfRow(row, "fix").includes(latestReview);
    return Ledger.routeClosed(
      this.#roundRoute(fixRecorded ? "fix" : "review", type, params, latestReview),
    );
  }

  /** The latest COMPLETED cycle of a row + mode — 0 when none. A failed round consumed
   *  its cycle but is not a carrier, so every active-hop read starts here. */
  #latestCompletedCycleOfRow(row: ProgressRow, mode: string): number {
    const cycles = this.#completedCyclesOfRow(row, mode);
    return cycles.length > 0 ? Math.max(...cycles) : 0;
  }

  /** The latest completed cycle of a row + mode that no later round SUPERSEDED — the
   *  active-hop read of a reopenable line (P30 §2.3: `--recover` replaced the old
   *  review's judgment, so it may no longer lead this line's hop). Deliberately a
   *  SEPARATE reader from `#latestCompletedCycleOfRow`: closure is a ledger-wide-order
   *  fact, and a supersede must never make a closed line look open (`#rowClosed` and the
   *  wave-line closure judgment keep the unfiltered read). 0 when none. */
  #latestLiveCycleOfRow(row: ProgressRow, mode: string): number {
    const op = RoundRecords.opOf(mode);
    if (op === null) return 0;
    const cycles = RoundRecords.of(row)
      .filter(
        (record) =>
          record.op === op && record.verdict.targetAction && record.supersededBy === undefined,
      )
      .map((record) => record.cycle);
    return cycles.length > 0 ? Math.max(...cycles) : 0;
  }

  /** Stamp a completed review round as SUPERSEDED (P30 §2.3) — the `--recover` reopen'
   *  s ONE write. It writes no fake completed fix: the old review keeps its own verdict
   *  and gains `supersededBy: { cycle, cause: "recover" }`, and the fix identity stays
   *  with its requesting review's cycle (D28 unchanged). Idempotent: a second stamp of
   *  the same record is a no-op rewrite. Returns whether a completed review of that
   *  cycle was stamped. */
  supersedeReview(key: LedgerKey, type: TargetType, cycle: number, byCycle: number): boolean {
    const data = this.readProgress();
    if (data === null) return false;
    const row = Ledger.rowFor(data, key, type);
    if (row === undefined) return false;
    const records = [...RoundRecords.of(row)];
    const index = records.findIndex(
      (record) => record.op === "review" && record.cycle === cycle && record.verdict.targetAction,
    );
    const target = records[index];
    if (target === undefined) return false;
    records[index] = { ...target, supersededBy: { cycle: byCycle, cause: "recover" } };
    row.rounds = records;
    this.writeProgress(data);
    return true;
  }

  /** One mode's completed cycles on a row — the row-level twin of `completedCycles`. */
  #completedCyclesOfRow(row: ProgressRow, mode: string): readonly number[] {
    const op = RoundRecords.opOf(mode);
    if (op === null) return [];
    return RoundRecords.of(row)
      .filter((record) => record.op === op && record.verdict.targetAction)
      .map((record) => record.cycle);
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

  /** The family key check of an op/type pair — the engine-config handoff namespace data
   *  (loud on an unknown family: the key set is the resolution truth, never a second list;
   *  the NAME is the naming face's one mint). */
  #family(op: string, type: string): void {
    if (!this.#families.includes(`${op}.${type}` as HandoffFamily)) {
      throw new Error(`unknown handoff family: ${op}.${type}`);
    }
  }

  /** The carrier PLANE of an op — the ONE op-derived derivation (`HandoffSchema.planeOf`).
   *  The plane-aware read/write/bookkeep spine: a judge-plane round (review) rides the
   *  findings writable subset, a work-plane round (implement / fix) rides the
   *  status-bearing work subset — never the caller's guess, never a per-family declaration. */
  planeOf(op: OpType): CarrierPlane {
    return HandoffSchema.planeOf(op);
  }

  /** The canonical handoff file name — the round identity's DRAFT, rendered by the
   *  ONE naming rule (`RoundNaming#renderName`). The family key set still guards the
   *  op/type pairs (a loud unknown-family throw), but it spells no name: the renderer
   *  does, so the draft, its final, the report, the log and the crash record cannot
   *  drift apart. */
  handoffName(op: string, type: string, params: HandoffParams = {}): string {
    this.#family(op, type);
    return RoundNaming.renderName(Ledger.#artifactOf(op, type, params), "draft");
  }

  /** The identity of one (op, type, params) triple — the ONE adapter from the
   *  params-carrying surface onto the naming renderer. */
  static #artifactOf(op: string, type: string, params: HandoffParams): RoundArtifact {
    const artifactOp = (RoundRecords.opOf(op) ?? op) as RoundArtifact["op"];
    return RoundNaming.artifactOf(artifactOp, type, params);
  }

  /** The canonical on-disk handoff path. */
  handoffPath(op: string, type: string, params: HandoffParams = {}): string {
    return this.#workspace.resolve(this.handoffName(op, type, params));
  }

  /** The handoff carrier skeleton — the schema-declared writable fields the agent
   *  round fills, SHAPED PER PLANE: the work overload builds a `findings`-free carrier
   *  (the work writable subset declares no findings field — the type gate: a
   *  `buildHandoff("work", { findings })` call is a compile-time refusal, Q1→c), the
   *  judge overload REQUIRES the findings payload (the schema's required field).
   *  The engine-seated identity (phase · tasks) rides the CANONICAL FILE NAME
   *  (`tasks-{wave}-*.json` / the range / doc family), never inline: phase/tasks are
   *  NOT declared and never written (v1.30 — the inline identity seeded a mimicking
   *  precedence: a fix draft copied the materialized `phase` the engine had written and
   *  tripped the reserved-field gate it could never pass; single declaration, single
   *  author — the carrier holds only the schema's declared plane, and status STILL
   *  rides the caller's set — the round conclusion is the engine's, not the skeleton's). */
  buildHandoff(plane: "work", init?: WorkInit): Carrier;
  buildHandoff(plane: "judge", init: JudgeInit): Carrier;
  buildHandoff(plane: CarrierPlane, init: WorkInit & { findings?: unknown[] } = {}): Carrier {
    const carrier: Record<string, unknown> = { artifacts: init.artifacts ?? {} };
    if (plane === "judge" || init.findings !== undefined) carrier.findings = init.findings;
    return carrier as Carrier;
  }

  /** Persist a handoff payload as the round's FINAL carrier — the engine's single-author
   *  write, at a name the child's DRAFT never occupies (P31 §2.3). Returns the final
   *  path (what the round is judged by), the draft path it landed beside, and the
   *  payload's digest, so the round record can remember all three.
   *
   *  The digest covers the PAYLOAD, never the file bytes that hold it: `H = sha256(JSON
   *  containing H)` is unsatisfiable, so the value is taken BEFORE the `contentSha256`
   *  key joins the payload — the key is appended LAST and the payload is written once
   *  (the read recomputes by the same rule: drop the key, re-serialize, sha256). The
   *  draft is neither written nor deleted here: it is the child's artifact, and the
   *  final is the engine's answer to it.
   *
   *  P31 §2.4 — the write CLOSES the carrier: the final and the draft name beside it
   *  land at `0o444` in the same step, so a carrier is read-only from the instant the
   *  engine authored it. A name that never landed (a round whose child wrote no draft,
   *  a round-less family whose draft IS the final) is not an error — the seal is
   *  idempotent and absence is the round's own fact. */
  persistHandoff(
    op: string,
    type: string,
    params: HandoffParams,
    data: Record<string, unknown>,
  ): { readonly path: string; readonly draftPath: string; readonly digest: string } {
    const artifact = Ledger.#artifactOf(op, type, params);
    const draftName = RoundNaming.renderName(artifact, "draft");
    const payload: Record<string, unknown> = { ...data };
    // The engine owns this key — a caller-supplied value never seeds a self-covering digest.
    delete payload.contentSha256;
    const digest = CarrierIntegrity.digestOf(payload);
    payload.contentSha256 = digest;
    const finalName = RoundNaming.renderName(artifact, "final");
    this.#persist(finalName, payload);
    // The carrier is read-only the moment it exists; the draft beside it closes with it.
    CarrierSeal.seal(this.#workspace.resolve(finalName));
    CarrierSeal.seal(this.#workspace.resolve(draftName));
    return {
      path: this.#workspace.resolve(finalName),
      draftPath: this.#workspace.resolve(draftName),
      digest,
    };
  }

  /** The handoff file NAME a read actually resolves — the canonical family name, or a
   *  DOCUMENT line's retired `spec` twin when the canonical file is absent (the
   *  one-release read alias, P22 D73). The alias reports the name it RESOLVED, not the
   *  one it was asked for: a hop that points a later round at this carrier
   *  (`--reviews`, `INPUT_REVIEWS`, the criterion's input set) must name the file that
   *  exists — a read alias that renamed only the row would leave a never-minted path
   *  behind. The alias keys on the line's declared word and never covers the node
   *  shapes; it is READ-ONLY (every write goes through `persistHandoff`'s canonical
   *  spelling). */
  resolveHandoffName(op: string, type: string, params: HandoffParams = {}): string {
    // The attempt the read resolves is the round's LATEST recorded one unless the
    // caller names it: a re-dispatched review lands at `-a{n}`, and its fix leg only
    // knows the cycle. Without this the read would address attempt 1's name (or its
    // final) while the digest gate compares the latest attempt's — a false mismatch.
    const resolved = this.#attemptAware(op, type, params);
    const canonical = this.handoffName(op, type, resolved);
    // P31 §2.3 — the FINAL carrier wins the read whenever the round has one: it is the
    // round's finalized answer, and the draft beside it is the child's raw input (an
    // un-materialized payload whose findings carry no engine id).
    const final = RoundNaming.renderName(Ledger.#artifactOf(op, type, resolved), "final");
    if (final !== canonical && this.#read<unknown>(final) !== null) return final;
    if (!RETIRED_SPEC_LINE_KEYS.has(type) || this.#read<unknown>(canonical) !== null) {
      return canonical;
    }
    const retired = Ledger.#retiredCarrierName(op, params);
    return this.#read<unknown>(retired) === null ? canonical : retired;
  }

  /** The params one READ resolves under — the caller's attempt when it names one, else
   *  the round's latest recorded attempt (a fix leg knows the cycle, not the review's
   *  attempt). Absent records leave the params untouched (the present-facts face). */
  #attemptAware(op: string, type: string, params: HandoffParams): HandoffParams {
    if (params.attempt !== undefined) return params;
    const latest = this.#latestRecordOf(op, type, params)?.attempt;
    return latest === undefined ? params : { ...params, attempt: latest };
  }

  /** The resolved handoff path — `resolveHandoffName`'s on-disk form (the read face's
   *  single path exit; the writers keep `handoffPath`). */
  resolveHandoffPath(op: string, type: string, params: HandoffParams = {}): string {
    return this.#workspace.resolve(this.resolveHandoffName(op, type, params));
  }

  /** Read a handoff carrier; null when missing/corrupt. A DOCUMENT-line read falls
   *  back to the retired `spec` file name (the one-release read alias, P22 D73): the
   *  rounds a line recorded before the vocabulary unification stay judgeable — the
   *  closure walk still reads their C5 route, so a closed line does not re-open. The
   *  alias keys on the line's declared word (`phase-spec` / `overall` / `single-spec`,
   *  the same basis as `rowFor`'s) and never covers the node shapes. Every WRITE goes
   *  through `persistHandoff`'s current spelling — the alias is read-only, and the name
   *  it resolves is `resolveHandoffName`'s ONE answer.
   *
   *  P31 §2.2 — the read is CHECKED: the (op, type, round) round's latest recorded
   *  attempt supplies the digest the engine wrote, and `CarrierIntegrity.read` compares
   *  the bytes against it before they are parsed (a mismatch throws
   *  `CarrierMismatchError`, never a silently-judged tampered carrier). A legacy record
   *  with no digest — or no record at all — reads as present facts, zero comparison. */
  readHandoff(op: string, type: string, params: HandoffParams): Record<string, unknown> | null {
    const name = this.resolveHandoffName(op, type, params);
    const bytes = CarrierIntegrity.read(
      this.#workspace.resolve(name),
      this.#carrierDigestOf(op, type, params),
    );
    if (bytes === null) return null;
    try {
      return JSON.parse(bytes) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  /** The digest the round recorded for the carrier this read resolves — its LATEST
   *  attempt of the (op, type, round) identity (a re-dispatch supersedes its
   *  predecessor, the same rule the round-read gate applies). Null when no record
   *  carries one: the present-facts face (legacy rows, and reads of a round that never
   *  booked its own carrier). */
  #carrierDigestOf(op: string, type: string, params: HandoffParams): string | null {
    return this.#latestRecordOf(op, type, params)?.carrierDigest ?? null;
  }

  /** The latest recorded attempt of an (op, type, round) identity — null when the line
   *  carries no record for it (a legacy row, or a round never dispatched). ONE basis for
   *  every "what did that round record" question (the digest the read compares against,
   *  the carrier path `--reviews` names). */
  #latestRecordOf(op: string, type: string, params: HandoffParams): RoundRecord | null {
    const mode = RoundRecords.opOf(op) ?? op;
    const round = params.round === undefined ? null : Number(params.round);
    return this.recordsOf(this.#roundKey(type as TargetType, params), type as TargetType)
      .filter((record) => record.op === mode)
      .filter((record) => round === null || record.cycle === round)
      .reduce<RoundRecord | null>(
        (newest, record) => (newest === null || record.attempt >= newest.attempt ? record : newest),
        null,
      );
  }

  /** The review carrier a round's fix leg reads as `--reviews` — the round's OWN
   *  recorded carrier path (the FINAL carrier, P31 §2.3) when the record names one, and
   *  the resolved family name (the draft spelling — legacy rows, and a round that
   *  persisted no carrier) otherwise. Record-present means final-wins: a draft sitting
   *  beside a final never becomes the judged input. */
  #reviewsPathOf(type: TargetType, params: HandoffParams, round: number): string {
    const record = this.#latestRecordOf("review", type, { ...params, round });
    // The record's carrier identity has ONE read face — `carrierPathOf` (step ① the
    // recorded path, step ②③ the read ladder a pre-P34 row needs). A bare
    // `record?.carrierPath` here would skip the ladder and, for a record whose row
    // names no path, silently fall past the final carrier it did write.
    const key = String(this.#roundKey(type, params));
    const recorded = record === null ? "" : this.carrierPathOf(type, key, record);
    if (recorded !== "") return recorded;
    return this.resolveHandoffPath("review", type, { ...params, round });
  }

  /** One record's carrier PATH — the ONE read face of a record's carrier identity
   *  (spec §2.12), so no consumer spells `record.carrierPath` itself. Step ① returns the
   *  path the record already remembers (the historical fact — a pre-P34 row keeps its
   *  own spelling, zero migration). Step ② otherwise resolves the read ladder
   *  `resolveHandoffName` owns, seeded with the record's FULL identity (line · op ·
   *  cycle · attempt) — a bare `renderPath("final")` would miss a pre-P31 row that never
   *  minted the `.c{cycle}` spelling. Step ③ probes the ladder's answer: a ladder that
   *  reports a never-minted name reads as "no carrier" (empty), never as a path. */
  carrierPathOf(type: string, key: string, record: RoundRecord): string {
    const recorded = record.carrierPath;
    if (typeof recorded === "string" && recorded !== "") return recorded;
    const name = this.#resolvedCarrierName(type, key, record);
    return this.#read<unknown>(name) === null ? "" : this.#workspace.resolve(name);
  }

  /** Step ② of `carrierPathOf` — the NAME the record's identity resolves to: the
   *  retired `spec-{op}-{round}.json` spelling for a migrated row (its `spec` family is
   *  not in the live config table, so the ladder would throw), the read ladder's answer
   *  for every live line. */
  #resolvedCarrierName(type: string, key: string, record: RoundRecord): string {
    if (key === RETIRED_SPEC_KEY) {
      return Ledger.#retiredCarrierName(record.op, { round: record.cycle });
    }
    const params: HandoffParams = {
      tasks: type === "wave" ? key : undefined,
      round: record.cycle,
      attempt: record.attempt,
    };
    return this.resolveHandoffName(record.op, type, params);
  }

  /** The retired document-line carrier name of one round — `spec-review-{round}.json` /
   *  `spec-fix-{round}.json`. It lives here, never in the family table: it is a read
   *  fallback for already-recorded rounds, not a name the engine can mint. */
  static #retiredCarrierName(op: string, params: HandoffParams): string {
    return `${RETIRED_SPEC_KEY}-${op}-${params.round ?? ""}.json`;
  }

  /** The workspace's ORPHAN handoff files — the carrier files (draft or final) whose
   *  (line key, op, cycle, attempt) never landed in `progress.json`. The board and the
   *  `--dry-run` preview render them; this is a PURE READ — the engine never writes,
   *  moves or deletes a carrier. The family names are the ledger's own single naming
   *  truth (no second pattern), and the owning row is read through the ONE basis
   *  `rowFor` establishes — the file's own line word IS its declaration — so a
   *  migrated workspace's carrier resolves its live row instead of reading as an
   *  orphan.
   *
   *  OWNERSHIP IS THE RECORD, NEVER ITS VERDICT (spec §2.12): a round that acted and
   *  then failed still owns the file it wrote — completion is the judgment face, and
   *  reading it here would relabel an honest failure's carrier as an orphan and hand it
   *  to a recovery pass that deletes child work.
   *
   *  The identity is the fast tier; the LEGACY tier compares the record's own carrier
   *  path by basename (a pre-P34 row remembers an absolute path while the scan yields a
   *  bare name), read once through `carrierPathOf` — the only accessor of the record's
   *  carrier identity. */
  orphanHandoffs(): readonly string[] {
    const progress = this.readProgress() ?? this.emptyProgress();
    const orphans: string[] = [];
    for (const name of this.#workspaceFiles()) {
      const owner = Ledger.#handoffOwner(name);
      if (owner === null) continue;
      const records = RoundRecords.of(Ledger.#ownerRow(progress, owner.key));
      const identity = `${owner.op}:${owner.round}:${owner.attempt}`;
      const claimed = records.some(
        (record) =>
          `${record.op}:${record.cycle}:${record.attempt}` === identity ||
          basename(this.carrierPathOf(owner.type, owner.key, record)) === name,
      );
      if (!claimed) orphans.push(name);
    }
    return orphans.sort();
  }

  /** The row one carrier file's line word resolves to. The retired `spec` twin is a FILE
   *  NAME a live row already outlived: the workspace holds ONE identity document, so the
   *  word resolves onto whichever document word that row now declares (`phase-spec` /
   *  `overall` / `single-spec`), never onto a row name the migration retired. Every other
   *  word — a wave's tasks, `plan`, `branch` — reads through `rowFor`'s ONE basis. */
  static #ownerRow(progress: ProgressData, key: string): ProgressRow | undefined {
    if (key !== RETIRED_SPEC_KEY) return Ledger.rowFor(progress, key, Ledger.#lineWord(key));
    const literal = Ledger.rowFor(progress, key, null);
    if (literal !== undefined) return literal;
    return progress.waves.find((row) => RETIRED_SPEC_LINE_KEYS.has(row.wave));
  }

  /** A handoff file's key as a declared line word — the three document words declare
   *  themselves; every other key (a wave's tasks, `plan`, `branch`) declares nothing
   *  and reads literally. */
  static #lineWord(key: string): TargetType | null {
    return RETIRED_SPEC_LINE_KEYS.has(key) ? (key as TargetType) : null;
  }

  /** The workspace directory's file names (an absent/unreadable directory is an
   *  empty fact — the orphan face degrades, never throws). */
  #workspaceFiles(): readonly string[] {
    try {
      return readdirSync(this.#workspace.path, { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name);
    } catch {
      return [];
    }
  }

  /** Which recorded round one handoff file belongs to — the ONE renderer read
   *  backwards: `<line>-<op>[-<cycle>][-a<attempt>][.c<cycle>].json`, the retired
   *  document-line `spec` twin included (a still-unbooked draft can carry it). The
   *  parse yields the same four coordinates the naming face renders, so the orphan
   *  test compares an identity with an identity — never a spelling with a spelling.
   *  Null for a non-carrier file. */
  static #handoffOwner(name: string): HandoffOwner | null {
    // A FINAL carrier (`<stem>.c{round}.json`, P31 §2.3) is the same artifact as its
    // draft — the cycle is the name's own suffix, never a second family.
    const draft = name.replace(/\.c\d+\.json$/, ".json");
    const wave = Ledger.#WAVE_CARRIER.exec(draft);
    if (wave !== null) {
      const [, line = "", op = "", cycle, attempt] = wave;
      // The wave row keys the task GROUP alone — the `tasks-` spine is the name's, not
      // the key's. The legacy cycle-less implement spelling is the fixed family's round 1.
      return {
        type: "wave",
        key: line.replace(/^tasks-/, ""),
        op,
        round: cycle === undefined ? 1 : Number(cycle),
        attempt: Ledger.#attemptOf(attempt),
      };
    }
    const line = Ledger.#LINE_CARRIER.exec(draft);
    if (line !== null) {
      const [, key = "", op = "", cycle = "", attempt] = line;
      return {
        type: key,
        key,
        op,
        round: Number(cycle),
        attempt: Ledger.#attemptOf(attempt),
      };
    }
    return null;
  }

  /** The wave line's carrier spelling, read backwards — the task key is a lazy span,
   *  the op one of the three words, the cycle and the attempt optional (the legacy
   *  cycle-less implement name harvests no cycle). */
  static readonly #WAVE_CARRIER =
    /^(tasks-.+?)-(implement|review|fix)(?:-(\d+))?(?:-a(\d+))?\.json$/;

  /** The single-target lines' carrier spelling — `branch` and the doc words (the
   *  words of the ONE target-face table, the retired `spec` twin included), every one
   *  of which carries its cycle. */
  static readonly #LINE_CARRIER = new RegExp(
    `^(${[...Object.keys(targetFaces).filter((word) => word !== "wave"), RETIRED_SPEC_KEY].join("|")})-(review|fix)-(\\d+)(?:-a(\\d+))?\\.json$`,
  );

  /** An absent attempt segment is the first attempt — the naming face never renders
   *  `-a1`, so the parse and the render agree on the identity of attempt 1. */
  static #attemptOf(captured: string | undefined): number {
    return captured === undefined ? 1 : Number(captured);
  }

  // -------------------------------------------------------------------------
  // crash — the lane crash → recovery record
  // -------------------------------------------------------------------------

  /** Write a crash recovery record at the name `RoundNaming` derived (the ONE
   *  naming source — this face derives no name of its own). Returns the record. */
  writeCrash(name: string, record: CrashRecord): CrashRecord {
    this.#persist(name, record);
    return record;
  }

  /** Read a crash record by its `RoundNaming` name; null when absent/unreadable (a
   *  recordless failure round keeps the no-next failure face). */
  readCrash(name: string): CrashRecord | null {
    return this.#read<CrashRecord>(name);
  }

  /** The round-naming single source over this ledger's workspace — the crash read /
   *  write faces take the name this face derives, so the capsule's failure handoff
   *  cell and the lifecycle's write point name the same file by the same rule. */
  naming(): RoundNaming {
    return this.#naming;
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
   *  `"branch"` / `"phase-spec"` / `"overall"` / `"plan"` / `"single-spec"`). */
  #roundKey(type: TargetType, params: HandoffParams): LedgerKey {
    return type === "wave" ? (params.tasks ?? "") : type;
  }

  /** Read a round's concluding record as the Round the dispatch next-router judges.
   *  A round is present ONLY when its recorded verdict says the round COMPLETED
   *  (`targetAction === true`): a dispatched-but-failed round returns null whatever
   *  draft sits on disk — a rejected child's leftover draft is never read back as a
   *  completed round (the §2.8 gate; without it a BLOCKED round with a stale draft
   *  rendered a contradictory `status: BLOCKED · next: done`). A fix round carries the
   *  SOURCE review's findings (C5-1: the `--reviews` input content, never its own
   *  carrier); the consecutive-S1 run is walked from the review history.
   *  Missing/corrupt evaluated handoff → null too — a fix round whose source review
   *  is unreadable is never a zero-findings fabrication: a round whose blocker set
   *  was never read must not be judged clean.
   *
   *  A cycle may carry several ATTEMPTS (a failed dispatch re-dispatched at the same
   *  cycle); the gate reads the cycle's LATEST attempt, then judges ITS verdict.
   *  Reading the first in-register record would let a failed attempt 1 shadow the
   *  successful attempt 2 forever — a retry that succeeded would read as no round. */
  round(op: OpType, type: TargetType, params: HandoffParams, round: number): Round | null {
    // §2.8 — the round-read gate: only a COMPLETED round is a round. The test is the
    // round's IDENTITY (its cycle number), not a count: a fix that skipped a cycle
    // (a drift-voided review → the first fix is cycle 2, not ordinal 1) is present at
    // cycle 2 (D28). A count comparison would flatten that to 1 and refuse the read.
    // Completion is the recorded VERDICT, never membership — every dispatched round
    // is recorded now, so a failed round's cycle is in register but reads no carrier.
    const recorded = this.recordsOf(this.#roundKey(type, params), type)
      .filter((record) => record.op === op && record.cycle === round)
      .reduce<RoundRecord | undefined>(
        (latest, record) =>
          latest === undefined || record.attempt >= latest.attempt ? record : latest,
        undefined,
      );
    if (recorded === undefined || !recorded.verdict.targetAction) return null;
    if (op === "implement") {
      // An implement round is judged by its COMMITS, never by its draft (design spec
      // §3.3): the recorded verdict above is its completion face, so an absent carrier
      // is the round's soft bookkeeping observation and never a reason to refuse the
      // read. The implement round carries no carrier content — the next hop is the
      // group's review regardless — so the gate is the verdict alone.
      return {
        phase: "implement",
        findings: [],
        consecutiveS1: 0,
      };
    }
    // The review side is addressed by the CYCLE alone: an attempt belongs to the op it
    // was allocated for, so a fix at attempt 2 must never address the review's `-a2`
    // (the read's own attempt fallback resolves the review's latest recorded one).
    const reviewParams: HandoffParams = { tasks: params.tasks, round };
    if (op === "review") {
      const carrier = this.readHandoff("review", type, reviewParams);
      if (carrier === null) return null;
      return {
        phase: "review",
        // The conclusion is DERIVED from the review carrier's own findings at judgment
        // time (D27 · the judge-plane carrier holds no status field) — the single
        // source shared with the fix leg below (`HandoffSchema.conclusionOf`).
        status: this.#handoffSchema.conclusionOf("judge", carrier),
        findings: this.#findingsOf(carrier),
        reviewsPath: this.#reviewsPathOf(type, reviewParams, round),
        consecutiveS1: this.#consecutiveS1Run(type, reviewParams, round),
      };
    }
    // op === "fix" — the C5-1 fingerprint: the fix round judges the source review's input
    // findings. Missing/corrupt source review OR fix carrier → null (no round on record),
    // matching the review branch's contract: a fix whose blocker set was never read must
    // not be judged a clean zero-findings round — the next-hop derivation cannot close a
    // line it could not read.
    const reviewCarrier = this.readHandoff("review", type, reviewParams);
    const fixCarrier = this.readHandoff("fix", type, { ...params, round });
    if (reviewCarrier === null || fixCarrier === null) return null;
    return {
      phase: "fix",
      // The fix round's conclusion derives from ITS OWN carrier's declared plane (the
      // work plane reads its status) — the same `conclusionOf` single source (D27).
      status: this.#handoffSchema.conclusionOf(this.planeOf("fix"), fixCarrier),
      findings: this.#findingsOf(reviewCarrier),
      reviewsPath: this.#reviewsPathOf(type, params, round),
      consecutiveS1: this.#consecutiveS1Run(type, params, round),
    };
  }
}
