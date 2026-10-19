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

import { execFileSync } from "node:child_process";
import { readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
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
// the stall judge — the running judgment over one dispatch, pure logic
// ---------------------------------------------------------------------------

/** StallJudge — is this dispatch still moving? Not a comparison of two samples but a
 *  judgment over the round: the judge holds its own accumulating state and is fed one
 *  tick at a time through `observe`, which returns the tick's verdict. Zero I/O: it
 *  reads the two legs of a `Sample` and nothing else (the OS reads live in `Sampler`),
 *  so its truth table is testable without a process or a tree. Both the idle window
 *  and the spawn instant are injected — the window never comes from a module constant
 *  and the clock never comes from the wall (a stall case must not wait out the real
 *  half hour), and the spawn instant seeds the idle clock.
 *
 *  The rules, in the order they are applied:
 *   · an unreadable leg (`null`) → `unknown`, and unknown never kills (fail-open: no
 *     reading of a leg means no evidence of a stall, and an unreadable tick carries no
 *     observation either way);
 *   · CPU above the PREVIOUS observation, or mtime above the HISTORICAL MAXIMUM →
 *     `progress`, and the idle clock restarts at this tick;
 *   · no progress and the window is still open → `idled`;
 *   · no progress and the window is spent → `stalled` (the kill).
 *  Neither leg authorizes a kill alone (`unknown` covers the unreadable case) and
 *  output activity is deliberately NOT a signal: a thinking child is silent, and using
 *  silence against it would kill a child that is working. */
export class StallJudge {
  readonly #idleWindowMs: number;
  /** The instant of the last progress — the spawn instant until the first one. */
  #idleSince: number;
  /** The previous tick's process-group CPU (ms) — `null` until the first readable one. */
  #lastCpuMs: number | null = null;
  /** The largest mtime (ms) the tree leg has ever reported. */
  #maxMtimeMs: number | null = null;

  constructor(idleWindowMs: number, spawnedAt: number) {
    this.#idleWindowMs = idleWindowMs;
    this.#idleSince = spawnedAt;
  }

  /** Judge one tick: feed the tick's sample and the instant it was taken. */
  observe(sample: Sample, now: number): StallVerdict {
    const cpuMs = sample.groupCpuMs;
    const mtimeMs = sample.newestMtimeMs;
    // Both legs must be readable to judge at all.
    if (cpuMs === null || mtimeMs === null) return "unknown";
    // Progress is an advance over what has already been seen — this CPU over the
    // previous observation, this mtime over the historical maximum. The first readable
    // tick has neither, so it can never be a progress tick: the idle clock has been
    // running since the spawn instant, exactly as if that tick had been flat.
    const advanced =
      (this.#lastCpuMs !== null && cpuMs > this.#lastCpuMs) ||
      (this.#maxMtimeMs !== null && mtimeMs > this.#maxMtimeMs);
    this.#lastCpuMs = cpuMs;
    if (this.#maxMtimeMs === null || mtimeMs > this.#maxMtimeMs) this.#maxMtimeMs = mtimeMs;
    if (advanced) {
      this.#idleSince = now;
      return "progress";
    }
    return now - this.#idleSince < this.#idleWindowMs ? "idled" : "stalled";
  }
}

// ---------------------------------------------------------------------------
// the sampler — the two legs' heavy lifting (the only OS I/O of the stall face)
// ---------------------------------------------------------------------------

/** Sampler — one dispatch's two legs, read once per tick: the process group's
 *  cumulative CPU and the newest content mtime of the scanned tree. The I/O lives
 *  here and the judgment lives in `StallJudge`, so each face is testable on its own
 *  (the truth table without a process, the fail-open `null` without a judge).
 *
 *   · The group id is the child's own pid, never recomputed: `killDescendants` forces
 *     the spawn-layer detachment, so the child IS its process group leader — the same
 *     fact execa's own `process.kill(-pid)` kill rides.
 *   · The scan root is the child's cwd (the repo root), so the "scan root ≡ child cwd"
 *     correspondence is structural.
 *   · `exclude` is the engine's own writes — `Sampler.excludesFor` is its single
 *     source: the repo's `.git/` and the dispatch's heartbeat file. The rest of
 *     `.kairos/` is NOT excluded: a child's handoff draft there is real progress. */
export class Sampler {
  /** The deepest tree level the walk descends to. */
  static readonly MAX_DEPTH = 32;
  /** The VCS internal every scan skips — its mtime is never a round's progress. */
  static readonly VCS_DIR = ".git";
  /** A `ps -o time=` reading: `[DD-][HH:]MM:SS[.ff]` (BSD gives centiseconds, Linux
   *  whole seconds — both ride the same pattern). */
  static readonly TIME_PATTERN =
    /^(?:(\d+)-)?(?:(\d+):(\d+):(\d+(?:\.\d+)?)|(\d+):(\d+(?:\.\d+)?))$/;

  readonly #pgid: number;
  readonly #scanRoot: string;
  readonly #exclude: ReadonlySet<string>;

  constructor(options: { pgid: number; scanRoot: string; exclude: readonly string[] }) {
    this.#pgid = options.pgid;
    // Absolute, normalized forms on both sides of the comparison below, so an
    // exclusion matches the walked path it names.
    this.#scanRoot = path.resolve(options.scanRoot);
    this.#exclude = new Set(options.exclude.map((entry) => path.resolve(entry)));
  }

  /** The exclusion single source for one dispatch: the repo's VCS internal plus the
   *  heartbeat path the engine itself writes (a tick must never self-certify). */
  static excludesFor(scanRoot: string, heartbeatPath: string): readonly string[] {
    return [path.join(scanRoot, Sampler.VCS_DIR), heartbeatPath];
  }

  /** Read both legs of this tick — each independently fail-open: a leg the platform
   *  cannot read is `null`, never a fabricated reading. */
  probe(): Sample {
    return { groupCpuMs: this.#groupCpuMs(), newestMtimeMs: this.#newestMtimeMs() };
  }

  /** The process group's cumulative CPU (ms), summed over the group's processes. A
   *  non-zero `ps` exit (no such group, or no `ps` at all) or any unparseable line
   *  makes the leg unreadable — `null`. An empty reading is unreadable too: a group
   *  with no observable member is not evidence of zero CPU. */
  #groupCpuMs(): number | null {
    let output: string;
    try {
      output = execFileSync("ps", ["-o", "time=", "-g", String(this.#pgid)], {
        encoding: "utf8",
        // stdout only: `ps`'s own complaint about an unknown group is not a reading,
        // and it must never reach the engine's stderr channel.
        stdio: ["ignore", "pipe", "ignore"],
      });
    } catch {
      return null;
    }
    const lines = output
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (lines.length === 0) return null;
    let total = 0;
    for (const line of lines) {
      const ms = Sampler.#parseCpuTime(line);
      if (ms === null) return null;
      total += ms;
    }
    return total;
  }

  /** One `time=` reading as milliseconds — `null` when the text is not that format. */
  static #parseCpuTime(text: string): number | null {
    const match = Sampler.TIME_PATTERN.exec(text);
    if (match === null) return null;
    const days = Number(match[1] ?? 0);
    const hours = Number(match[2] ?? 0);
    const minutes = Number(match[3] ?? match[5] ?? 0);
    const seconds = Number(match[4] ?? match[6] ?? 0);
    return (((days * 24 + hours) * 60 + minutes) * 60 + seconds) * 1000;
  }

  /** The newest content mtime (ms) in the scanned tree — `null` when the walk cannot
   *  complete (an unreadable directory anywhere makes the whole leg unreadable rather
   *  than under-reporting). */
  #newestMtimeMs(): number | null {
    try {
      return this.#newestIn(this.#scanRoot, 0);
    } catch {
      return null;
    }
  }

  /** The recursive descent — symlinks and the engine's own paths skipped, `MAX_DEPTH`
   *  as the floor of the walk. */
  #newestIn(dir: string, depth: number): number | null {
    if (depth > Sampler.MAX_DEPTH) return null;
    let newest: number | null = null;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const child = path.join(dir, entry.name);
      // A symlink is never followed (it can leave the tree outright); an excluded path
      // is the engine's own write.
      if (entry.isSymbolicLink() || this.#exclude.has(child)) continue;
      if (entry.isDirectory()) {
        const nested = this.#newestIn(child, depth + 1);
        if (nested !== null && (newest === null || nested > newest)) newest = nested;
        continue;
      }
      // Content mtimes only: a directory's own mtime moves on entry churn, which the
      // CPU leg already reflects as work — and the heartbeat's first creation would
      // otherwise bump its directory and self-certify a progress tick.
      const mtimeMs = statSync(child).mtimeMs;
      if (newest === null || mtimeMs > newest) newest = mtimeMs;
    }
    return newest;
  }
}

// ---------------------------------------------------------------------------
// the sampling loop — the dispatch's heartbeat trail (§3.4)
// ---------------------------------------------------------------------------

/** The sampling loop of one dispatch — the cadence that wraps the running child: one
 *  sample the moment the child is spawned, then one per `intervalMs`. Each tick reads
 *  the two legs through the `Sampler`, has the `StallJudge` rule on them, and
 *  overwrites the dispatch's heartbeat file with the resulting `SampleRecord` — the
 *  trail a human reads after a round was cut short.
 *
 *  The interval is unref'd: the engine's own sampling must never be the reason the
 *  parent process stays alive (the dispatch awaits the child, not the cadence). The
 *  heartbeat write is a plain overwrite, deliberately NOT a write-then-rename: a
 *  temporary file would sit inside the scanned tree and its own creation would certify
 *  "progress" — the very self-report the exclusion exists to prevent. Both the write
 *  and the removal are fail-open: the trail is a diagnostic, never a dispatch's fate.
 *
 *  The last observation is held in memory (`lastSample`): a terminated round's crash
 *  record takes it from there, never by re-reading the file the engine itself wrote. */
class SamplingLoop {
  readonly #sampler: Sampler;
  readonly #judge: StallJudge;
  readonly #heartbeatPath: string;
  readonly #intervalMs: number;
  /** The most recent observation — the postmortem sample of a terminated round. */
  #last: SampleRecord | null = null;
  #timer: ReturnType<typeof setInterval> | null = null;

  constructor(options: {
    sampler: Sampler;
    judge: StallJudge;
    heartbeatPath: string;
    intervalMs: number;
  }) {
    this.#sampler = options.sampler;
    this.#judge = options.judge;
    this.#heartbeatPath = options.heartbeatPath;
    this.#intervalMs = options.intervalMs;
  }

  /** Sample at once (the spawn instant has just passed — a round is never observed
   *  only from the first interval on) and start the cadence. */
  start(): void {
    this.#tick(Date.now());
    this.#timer = setInterval(() => this.#tick(Date.now()), this.#intervalMs);
    // Never hold the parent process open for the engine's own sampling.
    this.#timer.unref();
  }

  /** The loop's last observation (null when no tick was ever taken) — the sample a
   *  terminated round's crash record carries, from memory. */
  lastSample(): SampleRecord | null {
    return this.#last;
  }

  /** End the loop at the dispatch's terminal state: the cadence stops, and the
   *  heartbeat is removed iff the round ended by itself — a terminated round's file
   *  stays for a human's postmortem. */
  stop(endedByItself: boolean): void {
    if (this.#timer !== null) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
    if (!endedByItself) return;
    try {
      rmSync(this.#heartbeatPath, { force: true });
    } catch {
      // Fail-open (see the class doc).
    }
  }

  /** One tick: read both legs, judge them, and overwrite the heartbeat record. */
  #tick(now: number): void {
    const sample = this.#sampler.probe();
    const record: SampleRecord = {
      sampledAt: now,
      groupCpuMs: sample.groupCpuMs,
      newestMtimeMs: sample.newestMtimeMs,
      verdict: this.#judge.observe(sample, now),
    };
    this.#last = record;
    try {
      writeFileSync(this.#heartbeatPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
    } catch {
      // Fail-open (see the class doc): an unwritable heartbeat slows nothing down.
    }
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
 *     unbounded-face successor of the retired fixed 1 MiB cap;
 *   · the sampling loop — the child is sampled from the spawn instant and every
 *     `policy.sampleIntervalMs` after (the heartbeat file is that loop's trail, and
 *     the judge's verdict rides every record).
 *  The class holds zero session state: everything a dispatch needs rides the
 *  `ChildRun` argument, so the composition root wires it without a scene. */
export class Terminator implements ChildRunner {
  /** The force-kill grace (ms) — SIGTERM, then SIGKILL after this delay (execa's
   *  default, pinned explicitly). */
  static readonly FORCE_KILL_AFTER_DELAY_MS = 5000;

  async run(run: ChildRun): Promise<ChildOutcome> {
    // The spawn instant seeds the judge's idle clock (§3.3).
    const spawnedAt = Date.now();
    const subprocess = execa(run.command, [...run.args], {
      cwd: run.cwd,
      reject: false,
      stripFinalNewline: false,
      killDescendants: true,
      forceKillAfterDelay: Terminator.FORCE_KILL_AFTER_DELAY_MS,
      timeout: run.policy.budgetMs,
    });
    const sampling = this.#startSampling(run, subprocess.pid, spawnedAt);
    // The round's heartbeat fate — terminated by default, so an unexpected throw keeps
    // the trail as well; a round that ends by itself leaves no file behind.
    let endedByItself = false;
    try {
      const result = await subprocess;
      const termination = Terminator.#terminationOf(
        result.timedOut,
        result.signal,
        sampling?.lastSample() ?? null,
      );
      endedByItself = termination === null;
      return {
        // The child's OWN exit code, unfolded: null means "never spawned / signalled",
        // never a fabricated 1 (which would misreport both as an ordinary failed run).
        code: result.exitCode ?? null,
        stdout: result.stdout,
        // The child's own stderr when it wrote one, else execa's diagnostic (a spawn
        // failure like ENOENT writes nothing, so its reason rides the `shortMessage` —
        // the fail-open face keeps a reason text, never an empty block).
        stderr: result.stderr || (result.failed ? (result.shortMessage ?? "") : ""),
        termination,
      };
    } finally {
      // The cadence never outlives the dispatch.
      sampling?.stop(endedByItself);
    }
  }

  /** Start the dispatch's sampling loop, or null when the child never spawned (a
   *  broken command has no pid: nothing to sample and nothing to postmortem). The
   *  group id is the child's OWN pid, never recomputed — `killDescendants` forces the
   *  spawn-layer detachment, so the child IS its process group leader (the same fact
   *  execa's own group kill rides); the scan root is the same `cwd` the child was
   *  spawned in. */
  #startSampling(run: ChildRun, pid: number | undefined, spawnedAt: number): SamplingLoop | null {
    if (pid === undefined) return null;
    const sampling = new SamplingLoop({
      sampler: new Sampler({
        pgid: pid,
        scanRoot: run.cwd,
        exclude: Sampler.excludesFor(run.cwd, run.heartbeatPath),
      }),
      judge: new StallJudge(run.policy.idleWindowMs, spawnedAt),
      heartbeatPath: run.heartbeatPath,
      intervalMs: run.policy.sampleIntervalMs,
    });
    sampling.start();
    return sampling;
  }

  /** Derive the termination fact from the child's own result face — the wall-clock
   *  ceiling first (execa's `timedOut`), then a signal (any signal: the external-kill
   *  semantic, never the SIGTERM literal). Neither → the round ended by itself
   *  (successfully or not), so there is no termination. The engine's own stall kill
   *  takes its place in this derivation ahead of the signal leg. The last sample rides
   *  whichever cause won: it is the sampling loop's own last observation, held in
   *  memory — never a re-read of the heartbeat file the engine itself wrote. */
  static #terminationOf(
    timedOut: boolean,
    signal: string | undefined,
    lastSample: SampleRecord | null,
  ): Termination | null {
    if (timedOut) return { cause: "over-budget", lastSample };
    if (signal !== undefined) return { cause: "signal", lastSample };
    return null;
  }
}
