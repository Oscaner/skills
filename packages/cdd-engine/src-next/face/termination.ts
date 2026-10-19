// packages/cdd-engine/src-next/face/termination.ts
// The process seam of one dispatch — spawn → (sample → judge → kill, T2/T3) →
// collect. The seam's interface is `ChildRunner`; `Terminator` is its production
// implementation (execa's asynchronous face, which owns process-group creation,
// group kill, the SIGTERM → SIGKILL escalation, the parent-exit cleanup and the
// wall-clock ceiling — the engine holds no signal logic of its own).
//
// The seam's two ends are value objects, so the whole child lifecycle speaks one
// shape:
//   · `ChildRun` — one dispatch's full context (command/args/cwd + the heartbeat
//     path the sampler writes + the termination policy of the phase);
//   · `ChildOutcome` — the child's result (its own exit code, verbatim streams)
//     plus the `termination` fact: non-null ⟺ the round was cut short. The
//     terminated round's downstream judgments all read that one fact, never the
//     exit code (a never-spawned child has neither an exit code nor a termination).
//
// Module-level exports are types / the value object / the class — zero
// behavior-carrying bare functions.

import { execa } from "execa";
import type { RoundPhase, TerminationCause } from "../session/ledger.ts";

// ---------------------------------------------------------------------------
// the sampling vocabulary — the two legs, shared with the heartbeat record
// ---------------------------------------------------------------------------

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
 *  judge's verdict (the heartbeat file's field set). */
export interface SampleRecord extends Sample {
  sampledAt: number;
  verdict: StallVerdict;
}

// ---------------------------------------------------------------------------
// the seam — one dispatch's input, result and runner
// ---------------------------------------------------------------------------

/** How a round ended when it did not end by itself — the derived cause plus the
 *  last observed sample (the postmortem pair the crash record carries; the sample
 *  rides the outcome in memory, never re-read from the heartbeat file). `unknown`
 *  is the unattributable fallback of the derivation. */
export interface Termination {
  cause: TerminationCause | "unknown";
  lastSample: SampleRecord | null;
}

/** One dispatch's result over the child-runner seam — the child's own exit code
 *  (null when it never spawned or was signalled) and its verbatim streams, plus the
 *  termination fact. `termination !== null` ⟺ the round was cut short (the wall-clock
 *  ceiling, the engine's own kill, or a signal on the child) — a spawn failure has
 *  neither an exit code nor a termination, so it rides the ordinary child-exit face. */
export interface ChildOutcome {
  code: number | null;
  stdout: string;
  stderr: string;
  termination: Termination | null;
}

/** One dispatch's full context — everything the runner needs, and nothing that
 *  reaches back into the session: the spawned command, the heartbeat path the
 *  sampler writes for this dispatch, and the phase's termination policy. The
 *  caller derives `cwd` and `heartbeatPath` from the one workspace it holds, so
 *  both paths share one source; the same `cwd` is the spawn directory AND the
 *  scanned tree root (the "scan root ≡ the child's cwd" structural guarantee). */
export interface ChildRun {
  command: string;
  args: readonly string[];
  cwd: string;
  heartbeatPath: string;
  policy: TerminationPolicy;
}

/** The child-runner seam — the production terminator and the test stub implement
 *  this one shape; the lifecycle sees only the interface. A failed child rides the
 *  result, never a throw (fail-open). */
export interface ChildRunner {
  run(run: ChildRun): Promise<ChildOutcome>;
}

// ---------------------------------------------------------------------------
// the constant single source — budget and timing, per dispatch phase
// ---------------------------------------------------------------------------

/** TerminationPolicy — the budget/timing constant single source (code constants
 *  only: zero environment variables, zero config plane). The budget key set IS the
 *  dispatch-phase set, so no phase falls through to another phase's ceiling. The
 *  timing pair is injectable (the production values are the constants below; tests
 *  inject tiny ones, so an end-to-end stall case need not wait out the real window). */
export class TerminationPolicy {
  /** The per-phase wall-clock ceiling (ms) — the implement round is the long one. */
  static readonly BUDGET_MS: Readonly<Record<RoundPhase, number>> = {
    implement: 6 * 60 * 60 * 1000,
    review: 3 * 60 * 60 * 1000,
    fix: 3 * 60 * 60 * 1000,
    "branch-review": 3 * 60 * 60 * 1000,
  };
  /** The stall window (ms) — how long a round may make no progress before the
   *  judge rules it stalled (not per phase: "no progress" means the same thing on
   *  every phase). */
  static readonly IDLE_WINDOW_MS = 30 * 60 * 1000;
  /** The sampling cadence (ms) — one sample tick per interval. */
  static readonly SAMPLE_INTERVAL_MS = 60 * 1000;

  /** The round's wall-clock ceiling (ms) — the execa `timeout` value. */
  readonly budgetMs: number;
  /** The stall window the judge rules on (ms). */
  readonly idleWindowMs: number;
  /** The sampler's tick interval (ms). */
  readonly sampleIntervalMs: number;

  constructor(
    budgetMs: number,
    idleWindowMs: number = TerminationPolicy.IDLE_WINDOW_MS,
    sampleIntervalMs: number = TerminationPolicy.SAMPLE_INTERVAL_MS,
  ) {
    this.budgetMs = budgetMs;
    this.idleWindowMs = idleWindowMs;
    this.sampleIntervalMs = sampleIntervalMs;
  }

  /** The production policy of one dispatch phase — its own budget key plus the
   *  shared timing constants. */
  static of(phase: RoundPhase): TerminationPolicy {
    return new TerminationPolicy(TerminationPolicy.BUDGET_MS[phase]);
  }
}

// ---------------------------------------------------------------------------
// the production runner — execa's asynchronous face
// ---------------------------------------------------------------------------

/** Terminator — the production `ChildRunner`: one child, its whole process
 *  lifecycle. Every process capability the seam needs is execa's, never the
 *  engine's:
 *   · `killDescendants: true` — the child is spawned as its own process group and
 *     the group is killed as a unit (execa forces the spawn-layer detachment
 *     internally; the user-facing `detached` option is never set, because it would
 *     short-circuit execa's parent-exit `cleanup`);
 *   · `forceKillAfterDelay` — SIGTERM, then SIGKILL after the grace (execa's own
 *     default written out, so the escalation is pinned at the call site);
 *   · `timeout` — the phase's wall-clock ceiling on the same kill path;
 *   · `reject: false` + `stripFinalNewline: false` — the fail-open result face, the
 *     child's stdout kept byte-verbatim;
 *   · `maxBuffer` is never set or lowered — execa's own 100 MB default is the
 *     unbounded-face successor of the retired fixed 1 MiB cap.
 *  The class holds zero session state: everything a dispatch needs rides the
 *  `ChildRun` argument, so the composition root wires it without a scene. */
export class Terminator implements ChildRunner {
  /** The force-kill grace (ms) — SIGTERM, then SIGKILL after this delay (execa's
   *  default, pinned explicitly). */
  static readonly FORCE_KILL_AFTER_DELAY_MS = 5000;

  async run(run: ChildRun): Promise<ChildOutcome> {
    const result = await execa(run.command, [...run.args], {
      cwd: run.cwd,
      reject: false,
      stripFinalNewline: false,
      killDescendants: true,
      forceKillAfterDelay: Terminator.FORCE_KILL_AFTER_DELAY_MS,
      timeout: run.policy.budgetMs,
    });
    return {
      // The child's OWN exit code, unfolded: null means "never spawned / signalled",
      // never a fabricated 1 (which would misreport both as an ordinary failed run).
      code: result.exitCode ?? null,
      stdout: result.stdout,
      // The child's own stderr when it wrote one, else execa's diagnostic (a spawn
      // failure like ENOENT writes nothing, so its reason rides the `shortMessage` —
      // the fail-open face keeps a reason text, never an empty block).
      stderr: result.stderr || (result.failed ? (result.shortMessage ?? "") : ""),
      termination: Terminator.#terminationOf(result.timedOut, result.signal),
    };
  }

  /** Derive the termination fact from the child's own result face — the wall-clock
   *  ceiling first (execa's `timedOut`), then a signal (any signal: the external-kill
   *  semantic, never the SIGTERM literal). Neither → the round ended by itself
   *  (successfully or not), so there is no termination. The engine's own stall kill
   *  takes its place in this derivation ahead of the signal leg; no sampler drives it
   *  yet, so the two execa-owned legs are the whole derivation today. */
  static #terminationOf(timedOut: boolean, signal: string | undefined): Termination | null {
    if (timedOut) return { cause: "over-budget", lastSample: null };
    if (signal !== undefined) return { cause: "signal", lastSample: null };
    return null;
  }
}
