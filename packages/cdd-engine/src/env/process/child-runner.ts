// packages/cdd-engine/src/env/process/child-runner.ts
// The child seam: one dispatch's process, from spawn to collection.
//
// The seam owns exactly two things — starting a child and killing it as a GROUP — and
// it owns them completely: `execa` supplies process-group creation (`killDescendants`),
// the SIGTERM → SIGKILL escalation (`forceKillAfterDelay`), the parent-exit cleanup and
// the wall-clock ceiling (`timeout`). The engine holds no signal logic of its own.
//
// What the seam deliberately does NOT own is the judgment of WHEN to kill. Liveness is
// the dispatch face's call: it samples the child's own evidence (round log growth, group
// CPU) and decides a stall. The seam hands that judge a `ChildHandle` the moment the
// child exists, and the handle's `kill()` is the only kill the engine ever authorises.
// So this file contains no sampler, no verdict, no idle clock — a pin can therefore run
// the seam with no observer at all and watch the child finish on its own.
//
// The outcome carries the child's VERBATIM result plus the seam's raw facts
// (`overBudget` / `stopped` / `signal`). The three-way termination cause
// (`over-budget` · `stalled` · `signal`) is derived by the dispatch face from those
// facts — the seam reports what happened, it does not name why.
//
// Module-level exports are types and the class — zero behaviour-carrying bare functions.

import { execa } from "execa";

/** The round log channel — the single injected sink a child's bytes are appended to.
 *  `path` is the repo-relative coordinate the liveness judge reads the same file by; the
 *  open stream itself belongs to the dispatch face (this seam only writes into it). */
export interface ChildLog {
  /** The log's repo-relative coordinate. */
  readonly path: string;
  /** Append one chunk, as it arrives. */
  write(chunk: Buffer | string): void;
}

/** The handle a dispatch's liveness judge holds while the child runs. */
export interface ChildHandle {
  /** The child's process group id — the child IS its group leader (the seam spawns it
   *  detached through execa's group mode), so the group is the unit a stall kill takes. */
  readonly pgid: number;
  /** Kill the process group, SIGTERM then SIGKILL after the grace. Answers whether a
   *  signal was DELIVERED — a child that already exited answers `false`, so a round that
   *  ended by itself in the same tick is never misattributed as killed. Idempotent. */
  kill(): boolean;
}

/** One dispatch's full input — the spawned command, the ceiling and the two faces the
 *  dispatch side injects (the log sink and the observer). */
export interface ChildRun {
  /** The command to spawn. */
  command: string;
  /** Its arguments, verbatim. */
  args: readonly string[];
  /** The spawn directory. */
  cwd: string;
  /** The per-host dispatch env, layered over the inherited one (engine values win). */
  env: Readonly<Record<string, string>>;
  /** The wall-clock ceiling (ms) — execa's `timeout`, on the same kill path. */
  budgetMs: number;
  /** The round's log channel; absent = no log leg (the child still runs). */
  log?: ChildLog;
  /** The dispatch's liveness seam — called once, the instant the child exists. The
   *  callback decides when to call `handle.kill()`; the seam itself never judges. */
  observe?: (child: ChildHandle) => void;
}

/** The seam's own raw facts about how the child ended. */
export interface ChildFacts {
  /** The wall-clock ceiling fired. */
  overBudget: boolean;
  /** The engine's own stop was delivered. */
  stopped: boolean;
  /** The signal that ended the child, when one did. */
  signal: string | null;
}

/** One dispatch's outcome — the child's own exit code (null when it never spawned or
 *  was signalled), its verbatim streams and the seam's facts. A spawn failure rides this
 *  value, never a throw. */
export interface ChildOutcome {
  /** The child's own exit code, verbatim. */
  code: number | null;
  /** The child's stdout, byte-verbatim. */
  stdout: string;
  /** The child's stderr, or execa's diagnostic when it wrote none. */
  stderr: string;
  /** How the child ended, as the seam observed it. */
  facts: ChildFacts;
}

/** The child-runner seam — the production terminator and a test stub implement this one
 *  shape; the dispatch face sees only the interface. */
export interface ChildRunner {
  /** Spawn one child and collect its outcome (fail-open: a failure rides the result). */
  run(run: ChildRun): Promise<ChildOutcome>;
}

/**
 * Terminator — the production `ChildRunner`: one child, its whole process lifecycle,
 * every process capability supplied by execa.
 *
 *  · `killDescendants: true` — the child is spawned as its own process group and the
 *    group is killed as a unit (execa forces the spawn-layer detachment internally; the
 *    user-facing `detached` option is never set, because it would short-circuit execa's
 *    parent-exit cleanup);
 *  · `forceKillAfterDelay` — SIGTERM, then SIGKILL after the grace, pinned explicitly at
 *    the call site rather than left to a library default;
 *  · `timeout` — the phase's wall-clock ceiling on the same kill path;
 *  · `reject: false` + `stripFinalNewline: false` — the fail-open result face with the
 *    child's stdout kept byte-verbatim;
 *  · `maxBuffer` is never set or lowered — execa's own default is the unbounded face.
 */
export class Terminator implements ChildRunner {
  /** The force-kill grace (ms) — SIGTERM, then SIGKILL after this delay. */
  static readonly FORCE_KILL_AFTER_DELAY_MS = 5000;

  async run(run: ChildRun): Promise<ChildOutcome> {
    // The engine's own stop — set when a delivered kill came from the injected
    // observer. The exit reclaim below calls the same execa kill for a different
    // reason, so it must never set this flag.
    let stopped = false;
    const subprocess = execa(run.command, [...run.args], {
      cwd: run.cwd,
      reject: false,
      stripFinalNewline: false,
      // The dispatch env is layered over the inherited one — the engine's per-host
      // values win, the parent environment supplies the rest (the single merge point).
      env: { ...process.env, ...run.env },
      // fd 0 on /dev/null: a child that reads stdin sees EOF at once, never a pipe
      // nobody closes.
      stdin: "ignore",
      killDescendants: true,
      forceKillAfterDelay: Terminator.FORCE_KILL_AFTER_DELAY_MS,
      timeout: run.budgetMs,
    });
    // The round's log channel — the child's bytes are appended as they arrive (zero
    // prefix, zero engine-stdout echo, raw chunks: the log never re-decodes, so a chunk
    // boundary cannot tear a character).
    if (run.log !== undefined) {
      const log = run.log;
      subprocess.stdout?.on("data", (chunk: Buffer | string) => log.write(chunk));
      subprocess.stderr?.on("data", (chunk: Buffer | string) => log.write(chunk));
    }
    // Reclaim the group the instant the direct child exits: a grandchild holding the
    // stdout / stderr pipes would otherwise keep the `await` open. No execa option does
    // this (its group kill is on-demand only), so execa's own group-aware `kill()` is
    // called once, at the `exit` event, and only on the group this seam created.
    subprocess.nodeChildProcess.once("exit", () => {
      subprocess.kill();
    });
    const pid = subprocess.pid;
    if (pid !== undefined && run.observe !== undefined) {
      // The child IS its process group leader (the spawn-layer detachment above), so the
      // group id is the child's own pid — the same fact execa's group kill rides.
      run.observe({
        pgid: pid,
        kill: () => {
          const delivered = subprocess.kill();
          if (delivered) stopped = true;
          return delivered;
        },
      });
    }
    const result = await subprocess;
    return {
      // The child's OWN exit code, unfolded: null means "never spawned / signalled",
      // never a fabricated 1 (which would misreport both as an ordinary failed run).
      code: result.exitCode ?? null,
      stdout: result.stdout,
      // The child's own stderr when it wrote one, else execa's diagnostic (a spawn
      // failure like ENOENT writes nothing, so its reason rides the `shortMessage` —
      // the fail-open face keeps a reason text, never an empty block).
      stderr: result.stderr || (result.failed ? (result.shortMessage ?? "") : ""),
      facts: {
        overBudget: result.timedOut,
        stopped,
        signal: result.signal ?? null,
      },
    };
  }
}
