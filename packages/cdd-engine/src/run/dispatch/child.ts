// packages/cdd-engine/src/run/dispatch/child.ts
// The child: one dispatch's budget, one spawn, one outcome.
//
// INVARIANT — the engine authorises and attributes, it never signals. The spawn, the
// process group, the SIGTERM → SIGKILL escalation, the parent-exit cleanup and the
// wall-clock ceiling all belong to the injected `ChildRunner` (`env/process`); the kill
// this segment can cause is the liveness verdict's, delivered through the handle the seam
// hands over. So this file holds no signal logic, no process handle and no sampler of its
// own — it wires the seam's two faces together and derives the cause from what the seam
// reports.
//
// The outcome is three cells and nothing else: the child's own exit code (null when it
// never spawned or was signalled), the round log's repo-relative coordinate, and the
// termination cause — non-null exactly when the round was cut short.
//
// THE THREE CAUSES, in the order they claim a kill:
//   · `over-budget` — the wall-clock ceiling fired;
//   · `stalled` — the engine's own stop was DELIVERED (a child that already exited is
//     answered `false` by the handle, so a round that ended by itself in the same tick is
//     never misattributed);
//   · `signal` — any other signal ended the child (the external-kill semantic, never a
//     SIGTERM literal: SIGKILL / SIGINT / SIGHUP read the same).
// Nothing of the three → the round ended by itself, and the cell is null.
//
// The budget is four declared keys — the per-phase ceiling, the child's per-command Bash
// discipline ceiling, the stall window and the sampling cadence. Code constants only: no
// environment variable, no config plane, and no phase falling through to another phase's
// ceiling.
//
// Module-level exports are types, the budget declaration and the class — zero
// behaviour-carrying bare functions.

import { closeSync, mkdirSync, openSync, writeSync } from "node:fs";
import path from "node:path";
import type { RepoPath } from "../../env/paths/root.ts";
import type {
  ChildFacts,
  ChildHandle,
  ChildLog,
  ChildRunner,
} from "../../env/process/child-runner.ts";
import type { Clock } from "../../env/process/clock.ts";
import { LIVENESS_READS, type LivenessReads, Sampler, Watch } from "./liveness.ts";

/** The dispatch phases the budget is declared for — the budget key set IS this set, so no
 *  phase falls through to another phase's ceiling. */
export const ROUND_PHASES = ["implement", "review", "fix", "branch-review"] as const;

/** One dispatch phase. */
export type RoundPhase = (typeof ROUND_PHASES)[number];

/** The budget declaration — four keys, one home. */
export const BUDGET = {
  /** The per-phase wall-clock ceiling (ms) — the implement round is the long one. */
  perPhase: {
    implement: 6 * 60 * 60 * 1000,
    review: 3 * 60 * 60 * 1000,
    fix: 3 * 60 * 60 * 1000,
    "branch-review": 3 * 60 * 60 * 1000,
  } as const satisfies Readonly<Record<RoundPhase, number>>,
  /** The child's per-command Bash ceiling (ms) — a DISCIPLINE constant the prompt spells
   *  for the child, never an engine-side kill: the engine cannot see commands inside the
   *  child. */
  childBashTimeoutMs: 15 * 60 * 1000,
  /** The stall window (ms) — how long a round may make no progress before the judge rules
   *  it stalled. Not per phase: "no progress" means the same thing on every phase. */
  idleWindowMs: 30 * 60 * 1000,
  /** The sampling cadence (ms) — one tick per interval. */
  sampleIntervalMs: 60 * 1000,
} as const;

/** The three termination causes — the cut-short vocabulary. A round that ended by itself
 *  carries none of them. */
export type TerminationCause = "over-budget" | "stalled" | "signal";

/** The round log's two spellings — the absolute open point and the repo-relative
 *  coordinate the liveness leg reads. Both come from the workspace that owns the layout,
 *  so no caller spells one of them itself. */
export interface DispatchLog {
  /** The absolute file the child's bytes are appended to. */
  readonly file: string;
  /** The same file's repo-relative coordinate. */
  readonly path: RepoPath;
}

/** One dispatch's frame — everything the child needs, and nothing this segment judges. */
export interface DispatchFrame {
  /** The command to spawn. */
  readonly command: string;
  /** Its arguments, verbatim. */
  readonly args: readonly string[];
  /** The spawn directory. */
  readonly cwd: string;
  /** The per-host dispatch env, layered over the inherited one by the seam. */
  readonly env: Readonly<Record<string, string>>;
  /** The phase whose ceiling applies. */
  readonly phase: RoundPhase;
  /** The round's log file. */
  readonly log: DispatchLog;
}

/** One dispatch's outcome — the child's own exit code, the log's coordinate and the
 *  termination cause. */
export interface DispatchOutcome {
  /** The child's own exit code; null when it never spawned or was signalled. */
  readonly code: number | null;
  /** The round log the child's bytes landed in. */
  readonly log: RepoPath;
  /** How the round was cut short, or null when it ended by itself. */
  readonly termination: TerminationCause | null;
}

/** The child's construction facts: the seam, the one clock, and the two leg reads (the
 *  production pair by default) a pin may script. */
export interface ChildOptions {
  readonly runner: ChildRunner;
  readonly clock: Clock;
  readonly reads?: LivenessReads;
}

/**
 * Child — one dispatch's spawn. Invariant: the engine authorises and attributes, it never
 * signals (see the file's header).
 */
export class Child {
  readonly #runner: ChildRunner;
  readonly #clock: Clock;
  readonly #reads: LivenessReads;

  constructor(opts: ChildOptions) {
    this.#runner = opts.runner;
    this.#clock = opts.clock;
    this.#reads = opts.reads ?? LIVENESS_READS;
  }

  /** Spawn the child and answer the outcome. A spawn failure rides the value (the seam
   *  answers `code: null`), never a throw; the log channel is opened first and closed in
   *  the same turn, so a failed spawn leaves no open descriptor behind. */
  async dispatch(frame: DispatchFrame): Promise<DispatchOutcome> {
    const log = Child.#openLog(frame.log);
    // The cadence is the observer's, created the instant the child exists — held in a cell
    // because the seam hands the handle over through a callback, never a return value.
    const running: { watch: Watch | null } = { watch: null };
    try {
      const outcome = await this.#runner.run({
        command: frame.command,
        args: [...frame.args],
        cwd: frame.cwd,
        env: frame.env,
        budgetMs: BUDGET.perPhase[frame.phase],
        ...(log === null ? {} : { log }),
        observe: (handle: ChildHandle): void => {
          running.watch = this.#watch({ frame, handle });
        },
      });
      return {
        code: outcome.code,
        log: frame.log.path,
        termination: Child.causeOf(outcome.facts),
      };
    } finally {
      running.watch?.stop();
      log?.close();
    }
  }

  /** The seam's raw facts as the cause they name — the three-way derivation, in the order
   *  the causes claim a kill (pure, so a pin rules on every branch without a real child). */
  static causeOf(facts: ChildFacts): TerminationCause | null {
    if (facts.overBudget) return "over-budget";
    if (facts.stopped) return "stalled";
    if (facts.signal !== null) return "signal";
    return null;
  }

  /** The round's log channel — created before the spawn (zero bytes) and only ever
   *  appended to, so the log leg is flat and readable from the first tick. A file that
   *  cannot be opened is a missing observation channel, never a lost dispatch: the CPU leg
   *  then judges alone. */
  static #openLog(target: DispatchLog): (ChildLog & { close(): void }) | null {
    let fd: number;
    try {
      mkdirSync(path.dirname(target.file), { recursive: true });
      fd = openSync(target.file, "a");
    } catch {
      return null;
    }
    return {
      path: target.path,
      write: (chunk: Buffer | string): void => {
        try {
          writeSync(fd, typeof chunk === "string" ? Buffer.from(chunk) : chunk);
        } catch {
          // Fail-open: the log is an observation, never the round's content.
        }
      },
      close: (): void => {
        try {
          closeSync(fd);
        } catch {
          // Fail-open — see above.
        }
      },
    };
  }

  /** The liveness cadence of one child, or the spawn-instant watch a first `stalled` tick
   *  ends at once. The kill is the handle's own (the seam's group kill), fired once. */
  #watch(opts: { readonly frame: DispatchFrame; readonly handle: ChildHandle }): Watch {
    const watch = new Watch({
      sampler: new Sampler({
        logPath: opts.frame.log.path,
        pgid: opts.handle.pgid,
        reads: this.#reads,
        clock: this.#clock,
      }),
      intervalMs: BUDGET.sampleIntervalMs,
      windowMs: BUDGET.idleWindowMs,
      spawnedAt: this.#clock.now(),
      clock: this.#clock,
      onStall: (): void => {
        opts.handle.kill();
      },
    });
    // The cadence starts HERE, not at the caller: `start()` takes the first tick (seeding
    // the idle clock from the spawn instant) and arms the interval, and a first tick that
    // already ruled `stalled` ends the cadence on its own. The `finally`'s `stop()` is a
    // belt-and-braces timer clear for the normal paths, never that stall's terminator.
    watch.start();
    return watch;
  }
}
