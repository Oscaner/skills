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
//     resume decision source — the snapshot + the resume command, never the handoff
//     carrier's union).
//   · round — the round carrier: the handoff presented as the Round the dispatch
//     next-router judges. A fix round carries the SOURCE review's findings (the
//     `--findings` input content, C5-1), never its own; the consecutive-S1 run is
//     walked from the round history (the review-cycle soft-cap basis).
//
// Module-level exports are types / constant data / the class — zero behavior-
// carrying bare functions (the plan's zero-bare-function discipline).

import { createHash } from "node:crypto";
import type { ConfigLoader } from "../infra/config.ts";
import type { HandoffFamily } from "../infra/runtime.ts";
import type { Workspace } from "../infra/workspace.ts";
import type { TargetType } from "./faces.ts";
import type { Route } from "./next.ts";
import { NextStepRouter } from "./next.ts";
import { EMPTY_RUN_STATE } from "./run.ts";

// ---------------------------------------------------------------------------
// the round carrier — what NextStepRouter.next (T7) judges
// ---------------------------------------------------------------------------

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
 * values its dispatch concluded (status/commits); a fix round's findings ARE the
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
  /** The reviewed/fixed range — the re-review's new base derives from the commits. */
  commits?: { base: string; head?: string };
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
  /** The scope base the wave's rounds reviewed from (the pre-wave commit). */
  scope_base?: string;
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
 *  the same-command resume's decision source (snapshotSha + next), never the handoff carrier. */
export interface CrashRecord {
  /** The dead child's exit code (1 = run failure, 143 = SIGTERM — the shell convention). */
  exitCode: number;
  /** The last CRASH_TAIL_LINES stderr lines (the "403 / abort without trace" tail). */
  stderrTail: readonly string[];
  /** The last CRASH_TAIL_LINES stdout lines. */
  stdoutTail: readonly string[];
  /** The crash-only snapshot commit SHA (null when the tree was clean/no-op). */
  snapshotSha: string | null;
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
 *  namespace families ({tasks}/{round}; the branch range tokens — find #9 —
 *  leave the file names, the carrier's `commits` holds the shas). */
export interface HandoffParams {
  /** The dispatch group's key string (comma-joined task ids). */
  tasks?: string;
  /** The reviewed-range base token (branch family — 8-char short sha). */
  base8?: string;
  /** The reviewed-range head token (branch family — 8-char short sha). */
  head8?: string;
  /** The round number (increment/source families). */
  round?: number | string;
}

// ---------------------------------------------------------------------------
// review references — the refKind face (T25 · P5)
// ---------------------------------------------------------------------------

/** The review-reference kinds — the four typed review-ref families (T25): the
 *  commit-set-ledger ref (a wave's committed set, read from the ledger round
 *  carriers · the wave face) · the commit-range ref (a branch's full-sha range) ·
 *  the doc-revision ref (a spec/plan review's two-layer document ref — the doc
 *  path + its content-hash revision, the `doc_hash` binding) · the graph-node ref
 *  (a plan-graph task-node identity). Every review ref resolves to one of the
 *  four — the typed data the review-ref derivation lands, zero prose. */
export type RefKind = "commit-set-ledger" | "commit-range" | "doc-revision" | "graph-node";

/** The commit-set-ledger ref — a wave's committed set, read from the ledger's
 *  implement round carrier (the reviewed `base..head` range). */
export interface CommitSetLedgerRef {
  kind: "commit-set-ledger";
  /** The wave key the committed set belongs to. */
  wave: string;
  /** The committed range the review audits. */
  commits: { base: string; head?: string };
}

/** The commit-range ref — a branch review's full-sha base..head range. */
export interface CommitRangeRef {
  kind: "commit-range";
  base: string;
  head: string;
}

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

/** The graph-node ref — a plan-graph task-node identity (a review of one node of
 *  the task graph, independent of its commit state). */
export interface GraphNodeRef {
  kind: "graph-node";
  /** The plan task node id. */
  node: number;
}

/** The typed review ref — the four-kind union (T25). */
export type ReviewRef = CommitSetLedgerRef | CommitRangeRef | DocRevisionRef | GraphNodeRef;

/**
 * ReviewRefs — the typed review-reference face (T25): the four-kind classification
 * (`kindOf`), the doc-revision two-layer binding (`docRevision` — the doc hash
 * from its content), the per-kind ref constructors and the same-ref reject
 * (`bind` — the SAME identity already bound returns null: a duplicate review of
 * the same revision is refused, never silently re-reviewed). The face is the
 * ledger's review-ref derivation point — typed data, zero prose.
 */
export class ReviewRefs {
  /** The refs bound in this face — the same-ref reject basis. */
  #bound: ReviewRef[] = [];

  /** The four-way classification — one target type → one ref kind (the single
   *  kindOf mapping; variants ride the row, never a lifecycle edit). */
  kindOf(type: TargetType): RefKind {
    switch (type) {
      case "wave":
        return "commit-set-ledger";
      case "branch":
        return "commit-range";
      case "spec":
      case "plan":
        return "doc-revision";
    }
  }

  /** The commit-set-ledger ref constructor — a wave's committed range. */
  commitSet(wave: string, commits: { base: string; head?: string }): CommitSetLedgerRef {
    return { kind: "commit-set-ledger", wave, commits };
  }

  /** The commit-range ref constructor — a branch's full-sha range. */
  commitRange(base: string, head: string): CommitRangeRef {
    return { kind: "commit-range", base, head };
  }

  /** The doc-revision two-layer binding — the doc path + the content-hash revision
   *  (sha1 of the reviewed file content — the second layer of the doc ref). */
  docRevision(doc: string, content: string | Buffer): DocRevisionRef {
    return { kind: "doc-revision", doc, doc_hash: this.#hash(content) };
  }

  /** The graph-node ref constructor — a plan-graph task node identity. */
  graphNode(node: number): GraphNodeRef {
    return { kind: "graph-node", node };
  }

  /** The same-ref reject — bind a ref; the SAME identity already bound → null (the
   *  duplicate review refused), else the bound ref returns. Every bound ref adds to
   *  the face's set (the reject basis). */
  bind(ref: ReviewRef): ReviewRef | null {
    if (this.#bound.some((existing) => this.sameRef(existing, ref))) return null;
    this.#bound.push(ref);
    return ref;
  }

  /** The ref-identity predicate — two refs are the SAME ref when their identity
   *  layers match (the doc + its hash · the range's both ends · the wave key ·
   *  the node id); a differing kind is never the same ref. */
  sameRef(a: ReviewRef, b: ReviewRef): boolean {
    if (a.kind !== b.kind) return false;
    switch (a.kind) {
      case "commit-set-ledger":
        return a.wave === (b as CommitSetLedgerRef).wave;
      case "commit-range": {
        const other = b as CommitRangeRef;
        return a.base === other.base && a.head === other.head;
      }
      case "doc-revision": {
        const other = b as DocRevisionRef;
        return a.doc === other.doc && a.doc_hash === other.doc_hash;
      }
      case "graph-node":
        return a.node === (b as GraphNodeRef).node;
    }
  }

  /** The bound refs — the face's reject basis, read-only. */
  bound(): readonly ReviewRef[] {
    return [...this.#bound];
  }

  /** The content-hash revision — sha1 hex of the reviewed file content. */
  #hash(content: string | Buffer): string {
    // find #10（spec §6.6）：the doc-revision hash is the engine's 8-char short
    // form too — no long hex anywhere in the engine（full sha1 digest sliced）.
    return createHash("sha1").update(content).digest("hex").slice(0, 8);
  }
}

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

  /** The review-reference face — the refKind four-type derivation + binding (T25). */
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

  /** The canonical handoff file name — the family's `{placeholder}` pattern, filled. */
  handoffName(op: string, type: string, params: HandoffParams = {}): string {
    return this.#family(op, type)
      .name.replaceAll("{tasks}", params.tasks ?? "")
      .replaceAll("{base8}", params.base8 ?? "")
      .replaceAll("{head8}", params.head8 ?? "")
      .replaceAll("{round}", String(params.round ?? ""));
  }

  /** The canonical on-disk handoff path. */
  handoffPath(op: string, type: string, params: HandoffParams = {}): string {
    return this.#workspace.resolve(this.handoffName(op, type, params));
  }

  /** The handoff carrier skeleton — the schema-declared writable fields the agent
   *  round fills. The engine-seated identity (phase · tasks) rides the CANONICAL FILE
   *  NAME (`tasks-{wave}-*.json` / the range / doc family), never inline: phase/tasks
   *  are NOT declared and never written (v1.30 — the inline identity seeded a mimicking
   *  precedence: a fix draft copied the materialized `phase` the engine had written and
   *  tripped the reserved-field gate it could never pass; single declaration, single
   *  author — the carrier holds only the schema's declared plane). */
  buildHandoff(
    init: {
      artifacts?: Record<string, string>;
      findings?: unknown[];
      commits?: { base: string; head?: string };
    } = {},
  ): Record<string, unknown> {
    const carrier: Record<string, unknown> = {
      artifacts: init.artifacts ?? {},
      findings: init.findings ?? [],
    };
    if (init.commits !== undefined) carrier.commits = init.commits;
    return carrier;
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

  /** Write a lane-crash recovery record — the resume decision source (snapshotSha + the
   *  same-command resume), never the handoff carrier. Returns the record. */
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

  /** Read a round's concluding record as the Round the dispatch next-router judges.
   *  A fix round carries the SOURCE review's findings (C5-1: the `--findings` input
   *  content, never its own carrier) + the fix's own commits; the consecutive-S1 run is
   *  walked from the review history. Missing/corrupt evaluated handoff → null (no round
   *  on record) — a fix round whose source review is unreadable is null too, never a
   *  zero-findings fabrication: a round whose blocker set was never read must not be
   *  judged clean. */
  round(op: OpType, type: TargetType, params: HandoffParams, round: number): Round | null {
    if (op === "implement") {
      const carrier = this.readHandoff("implement", type, params);
      if (carrier === null) return null;
      return {
        phase: "implement",
        findings: [],
        commits: carrier.commits as { base: string; head?: string } | undefined,
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
        commits: carrier.commits as { base: string; head?: string } | undefined,
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
      commits: fixCarrier.commits as { base: string; head?: string } | undefined,
      consecutiveS1: this.#consecutiveS1Run(type, params, round),
    };
  }
}
