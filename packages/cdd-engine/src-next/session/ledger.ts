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

import type { ConfigLoader } from "../infra/config.ts";
import type { HandoffFamily } from "../infra/runtime.ts";
import type { Workspace } from "../infra/workspace.ts";

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
export type RoundPhase = "implement" | "review" | "fix" | "branch-review";

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

/** One progress row — keyed by a scalar task id or the group key string (the key
 *  IS the group identity: `--tasks 1` → the task row, `--tasks 1,2` → the group row). */
export type ProgressRow = ({ task: number } | { group: string }) & {
  /** The completed rounds per mode (review/fix) — the done record on disk. */
  rounds?: Record<string, number>;
};

/** The progress.json data plane — the fixed top-level key set + the per-key rows. */
export interface ProgressData {
  /** The `--plan` path recorded at first create. */
  plan?: string;
  timeoutCount: number;
  contractViolationCount: number;
  engineSelfWrittenCount: number;
  engineRecoveryCount: number;
  harnessAbortCount: number;
  tasks: ProgressRow[];
}

/** The ledger lookup key — a scalar task id or the group key string. */
export type LedgerKey = number | string;

/** The lane-crash cause vocabulary — postmortem classification of why a dispatch
 *  terminated before the exit gate (zero behavior fork: resume never routes on it). */
export type CrashCause =
  | "child-exit"
  | "child-signal"
  | "engine-over-budget"
  | "engine-timeout"
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
 *  namespace families ({tasks}/{base7}/{head7}/{round}). */
export interface HandoffParams {
  /** The dispatch group's key string (comma-joined task ids). */
  tasks?: string;
  /** The reviewed-range base token (branch family). */
  base7?: string;
  /** The reviewed-range head token (branch family). */
  head7?: string;
  /** The round number (increment/source families). */
  round?: number | string;
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

  constructor(workspace: Workspace, config: ConfigLoader) {
    this.#workspace = workspace;
    this.#families = config.handoffNamespace().families;
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
    return { ...PROGRESS_COUNTER_ZERO, tasks: [] };
  }

  /** Read progress.json; null when missing/corrupt (the ledger never invents state). */
  readProgress(): ProgressData | null {
    return this.#read<ProgressData>("progress.json");
  }

  /** Write progress.json — the progress single-author write. */
  writeProgress(data: ProgressData): void {
    this.#persist("progress.json", data);
  }

  /** The ledger-row lookup single point — a scalar key (or the single-task group key `"1"`)
   *  resolves the `{ task }` row; a multi-task group key (`"1,2"`) the `{ group }` row. */
  rowFor(data: ProgressData, key: LedgerKey): ProgressRow | undefined {
    if (typeof key === "number" || /^\d+$/.test(key)) {
      const id = Number(key);
      return data.tasks.find((row) => "task" in row && row.task === id);
    }
    return data.tasks.find((row) => "group" in row && row.group === key);
  }

  /** The fresh row for an absent key (scalar → task row; group key → group row). */
  entryFor(key: LedgerKey): ProgressRow {
    if (typeof key === "number" || /^\d+$/.test(key)) return { task: Number(key) };
    return { group: String(key) };
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
      data.tasks.push(row);
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
      .replaceAll("{base7}", params.base7 ?? "")
      .replaceAll("{head7}", params.head7 ?? "")
      .replaceAll("{round}", String(params.round ?? ""));
  }

  /** The canonical on-disk handoff path. */
  handoffPath(op: string, type: string, params: HandoffParams = {}): string {
    return this.#workspace.resolve(this.handoffName(op, type, params));
  }

  /** The handoff carrier skeleton — the engine-seated identity fields (tasks / phase /
   *  artifacts / findings / commits): the schema-required keys the agent round fills. */
  buildHandoff(
    op: string,
    type: string,
    params: HandoffParams,
    init: {
      artifacts?: Record<string, string>;
      findings?: unknown[];
      commits?: { base: string; head?: string };
    } = {},
  ): Record<string, unknown> {
    const carrier: Record<string, unknown> = {
      phase: this.#family(op, type).phase,
      artifacts: init.artifacts ?? {},
      findings: init.findings ?? [],
    };
    const tasks = params.tasks?.trim();
    if (tasks !== undefined && tasks !== "") {
      carrier.tasks = tasks.split(",").map((part) => Number(part.trim()));
    }
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
  round(
    op: "implement" | "review" | "fix",
    type: "task" | "branch" | "spec" | "plan",
    params: HandoffParams,
    round: number,
  ): Round | null {
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
