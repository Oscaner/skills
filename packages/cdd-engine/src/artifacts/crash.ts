// packages/cdd-engine/src/artifacts/crash.ts — CrashTeardown (T7 crash recovery / T8 unified
// termination model): the lane-agnostic crash teardown shared by the implement/review/fix/docs run
// wrappers — the engine's crash-recovery primitive, normalized from the deleted stash plane onto the
// commit ledger. The teardown trigger is the T8 dual-model predicate — ANY dispatch that terminates
// before the exit gate with its handoff unwritten (child non-zero exit / child signal / engine
// over-budget / engine timeout — one mechanism, no parallel second set). When that predicate holds,
// the teardown
//   ① captures the child stdout/stderr TAIL (~40 lines — the "harness 403 with no trace" mitigation)
//   ② crash-only snapshot (rules/commit.ts commitSnapshot — the tree normalizes into a commit)
//   ③ writes the crash record to Workspace.crashPath(lane, round) ({exitCode, stderrTail[],
//      stdoutTail[], snapshotSha, attemptedHandoff, next, cause})
//   ④ returns the record so the lane emits the BLOCKED/TIMEOUT status capsule whose `next:` carries
//      the same-command resume.
// The crash record REPLACES the deleted handoff `recovery` carrier as the NextStepRouter recovery
// decision source (status BLOCKED/TIMEOUT + crash record present → next: <same command resume>) — the
// router reads the record's fields (snapshotSha + the resume command), never the carrier's recovery.
// Resume = re-dispatch the same command: the re-run starts from the snapshot commit (clean tree at
// the entry gate) and continues from the committed WIP — no redo, no residue loss.
// T8 (fold A — crash record tri-party): teardown writes / resume reads (the crash record's presence
// is the resume-pending source in rules/status.ts) / reapStale enumerates stale records (artifact
// enumeration, never stash archaeology). `cause` is postmortem-only — resume never forks on it.
import { readFileSync } from "node:fs";
import path from "node:path";
import type { TerminationCause } from "../infra/runtime.ts";
import type { Workspace } from "../infra/workspace.ts";
import { CommitChecker } from "../rules/commit.ts";

/** The capture window — how many trailing stdout/stderr lines the teardown preserves. */
export const CRASH_TAIL_LINES = 40;

/** The five-cause crash vocabulary (T8): postmortem classification of WHY the dispatch terminated
 *  before the exit gate. Behavior zero-fork — the resume path never routes differently on cause. */
export type CrashCause =
  /** the child exited non-zero on its own (e.g. a harness/model 403 retreat). */
  | "child-exit"
  /** the child died from a signal (SIGTERM/SIGINT — the 128+signo shell convention). */
  | "child-signal"
  /** the engine's budget cap (wall-clock) fired — the group was killed at the budget end. */
  | "engine-over-budget"
  /** the engine's liveness/stall monitor fired — the group was killed as hung. */
  | "engine-timeout"
  /** neither the child's exit shape nor a monitor verdict classified the death. */
  | "unknown";

/** The crash record — the crash-recovery artifact's on-disk shape (Workspace.crashPath(lane, round);
 *  written through the shared writeJson point, same family as lifecycle/handoff/base-branch). */
export interface CrashRecord {
  /** the dead child's exit code (1 = run failure, 143 = SIGTERM — the explicit exit-code semantics). */
  exitCode: number;
  /** last CRASH_TAIL_LINES lines of the child's stderr (the "403 / model abort without trace" tail). */
  stderrTail: string[];
  /** last CRASH_TAIL_LINES lines of the child's stdout. */
  stdoutTail: string[];
  /** the crash-only snapshot commit SHA (null when the tree was clean — nothing to snapshot — or a
   *  non-repo/git-error no-op). */
  snapshotSha: string | null;
  /** the handoff path the dead child was expected to write (null when the lane carries none). */
  attemptedHandoff: string | null;
  /** the same-command resume string — the NextStepRouter recovery row's decision source (emitted
   *  verbatim as `next: <resumeCommand>`). */
  next: string;
  /** the unified termination cause (T8) — postmortem classification, zero behavior fork. */
  cause: CrashCause;
}

/** The lane facts the resume command reconstructs (mirror of the CLI dispatch surface: op/type/group/
 *  plan/doc/findings/range — each lane passes what its dispatch carried). */
export interface ResumeCommandArgs {
  op: string;
  type?: string;
  group?: string;
  plan?: string;
  doc?: string;
  findingsPath?: string;
  base?: string;
  head?: string;
}

/** resumeCommandFor — the DISPATCH's own command reconstructed for the re-run (the "same command"
 *  resume semantics): `cdd <op>[ --type <t>][ --tasks <g>][ --plan <p>][ --<type> <doc>]
 *  [ --findings <h>][ --base <b> --head <h>]`. review resumes without --findings (review derives its
 *  findings path internally) — the reconstruction mirrors the original invocation, not the next hop. */
export function resumeCommandFor(a: ResumeCommandArgs): string {
  const op = a.op;
  const type = a.type;
  const plan = a.plan ? ` --plan ${a.plan}` : "";
  const tasks = a.group ? ` --tasks ${a.group}` : "";
  const findings = a.findingsPath ? ` --findings ${a.findingsPath}` : "";
  // implement carries no --type (the task family is its only surface)
  if (op === "implement") return `cdd implement${tasks}${plan}`;
  if (type === "task") {
    return op === "review"
      ? `cdd review --type task${tasks}${plan}`
      : `cdd fix --type task${tasks}${plan}${findings}`;
  }
  if (type === "branch") {
    const range =
      op === "review"
        ? `${a.base ? ` --base ${a.base}` : ""}${a.head ? ` --head ${a.head}` : ""}`
        : findings;
    return `cdd ${op} --type branch${plan}${range}`;
  }
  if (type === "spec" || type === "plan") {
    const target = a.doc ? ` --${type} ${a.doc}` : "";
    return `cdd ${op} --type ${type}${target}${op === "fix" ? findings : ""}`;
  }
  // untyped/unknown fallback — the tasks/plan surface only
  return `cdd implement${tasks}${plan}`;
}

/** Tail capture — the trailing `n` lines of a raw stream (empty stream → []). A trailing newline
 *  (the natural stream suffix) does not produce a phantom empty entry. */
function tailLines(raw: string | undefined, n: number): string[] {
  const text = String(raw ?? "");
  if (!text) return [];
  const lines = text.split("\n");
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  return lines.slice(-n);
}

/** crashCauseFor — the T8 unified termination-cause derivation: maps the dispatch's termination
 *  facts onto the five-cause vocabulary. The engine monitor's verdict wins when it fired (timedOut);
 *  otherwise the child's signal-coded exit shape classifies the death. Zero behavior fork — the
 *  caller's resume path never routes on the returned cause (postmortem classification only). */
export function crashCauseFor(opts: {
  /** the termination monitor fired (over-budget / stall / external signal folded as "signal"). */
  timedOut?: boolean;
  /** the monitor's unified cause (absent when the monitor never fired / undefined). */
  monitorCause?: TerminationCause | undefined;
  /** the child's exit code (0 = clean, 128+n = the signal-coded shell convention). */
  exitCode?: number;
}): CrashCause {
  // Engine-terminated (the monitor killed the group before the exit gate): the monitor cause names
  // the engine side directly. An external SIGTERM folding in as cause "signal" is the CHILD's death
  // shape — child-signal, never an engine cause.
  if (opts.timedOut) {
    if (opts.monitorCause === "over-budget") return "engine-over-budget";
    if (opts.monitorCause === "stalled") return "engine-timeout";
    if (opts.monitorCause === "signal") return "child-signal";
  }
  // Child died on its own: the 128+signo shell convention (SIGTERM=143 / SIGINT=130 / SIGKILL=137)
  // is child-signal; any other non-zero exit is child-exit.
  if (opts.exitCode !== undefined && opts.exitCode !== 0) {
    return opts.exitCode >= 128 && opts.exitCode <= 143 ? "child-signal" : "child-exit";
  }
  return "unknown";
}

/** The carrier categories that mark a still-dead round (the attemptedHandoff's continuation side).
 *  A crash record's round is resolved once its attemptedHandoff holds a carrier OUTSIDE this set. */
const TERMINATION_CARRIER_CATEGORIES = new Set(["TIMEOUT", "HARNESS_ABORT", "EXECUTION_FAILURE"]);

/** isStaleCrashRecord — the T8 stale judgment (reapStale's crash-record sweep; tri-party fold A):
 *  a crash record is stale when its round has since terminated at the NORMAL face — the
 *  attemptedHandoff now holds a carrier that is NOT a termination/dead carrier (the resume
 *  completed the round; the dual-artifact invariant makes the record no longer the round's
 *  terminal). Records without an attemptedHandoff or whose handoff is missing/illegible stay live
 *  (no resolution signal — the conservative keep). */
export function isStaleCrashRecord(record: CrashRecord): boolean {
  if (!record.attemptedHandoff) return false;
  let h: { status?: unknown; failure_category?: unknown };
  try {
    h = JSON.parse(readFileSync(record.attemptedHandoff, "utf8")) as {
      status?: unknown;
      failure_category?: unknown;
    };
  } catch {
    return false;
  }
  if (h.status === "TIMEOUT") return false;
  if (
    typeof h.failure_category === "string" &&
    TERMINATION_CARRIER_CATEGORIES.has(h.failure_category)
  ) {
    return false;
  }
  // The carrier exists and is not a termination carrier → the round resolved at the normal face.
  return true;
}

/** CrashTeardown — the shared orphan-handling wrapper (Criterion ②; constructor injection — the
 *  CommitChecker seam defaulting to a fresh instance). run() performs steps ①–③ and returns the
 *  record; the calling lane emits the BLOCKED/TIMEOUT capsule (step ④) from its own dispatch facts. */
export class CrashTeardown {
  readonly #commit: CommitChecker;

  constructor(commit: CommitChecker = new CommitChecker()) {
    this.#commit = commit;
  }

  /** Run the crash teardown: ① tails ② crash-only snapshot ③ crash record write. Returns the record
   *  (the lane emits the capsule's `next:` from record.next via the NextStepRouter recovery input).
   *  Fail-open end to end: a snapshot failure does not block the record write (the record carries
   *  snapshotSha null), and the record write is machine-side (workspace writeJson) — never a throw
   *  across the caller's exit path. */
  async run(opts: {
    lane: string;
    round: number;
    exitCode: number;
    stdout: string;
    stderr: string;
    attemptedHandoff: string | null;
    next: string;
    /** the unified termination cause (T8); postmortem-only, zero behavior fork. */
    cause: CrashCause;
    workspace: Workspace;
    repoRoot: string | null;
  }): Promise<CrashRecord> {
    const snapshotSha = await this.#commit.commitSnapshot(opts.repoRoot, opts.lane, opts.exitCode);
    const record: CrashRecord = {
      exitCode: opts.exitCode,
      stderrTail: tailLines(opts.stderr, CRASH_TAIL_LINES),
      stdoutTail: tailLines(opts.stdout, CRASH_TAIL_LINES),
      snapshotSha,
      attemptedHandoff: opts.attemptedHandoff,
      next: opts.next,
      cause: opts.cause,
    };
    const crashName = path.basename(opts.workspace.crashPath(opts.lane, opts.round));
    opts.workspace.writeJson(crashName, record);
    return record;
  }
}
