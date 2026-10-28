// packages/cdd-engine/src-next/face/termination.ts
// The process seam of one dispatch — spawn → (sample → judge → kill, T2/T3) →
// collect. The seam's interface is `ChildRunner`; `Terminator` is its production
// implementation (execa's asynchronous face, which owns process-group creation,
// group kill, the SIGTERM → SIGKILL escalation, the parent-exit cleanup and the
// wall-clock ceiling — the engine holds no signal logic of its own).
//
// The seam's two ends are value objects, so the whole child lifecycle speaks one
// shape:
//   · `ChildRun` — one dispatch's full context (command/args/cwd + the in-flight
//     record handle the sampler overwrites + the termination policy of the phase +
//     the per-host dispatch env);
//   · `ChildOutcome` — the child's result (its own exit code, verbatim streams)
//     plus the `termination` fact: non-null ⟺ the round was cut short. The
//     terminated round's downstream judgments all read that one fact, never the
//     exit code (a never-spawned child has neither an exit code nor a termination).
//
// Module-level exports are types / the value object / the class — zero
// behavior-carrying bare functions.

import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { execa } from "execa";
import { ProcessFacts } from "../infra/proc.ts";
import type { InFlight } from "../session/inflight.ts";
import type {
  RoundPhase,
  Sample,
  SampleRecord,
  StallVerdict,
  Termination,
} from "../session/ledger.ts";

// ---------------------------------------------------------------------------
// the seam — one dispatch's input, result and runner
// ---------------------------------------------------------------------------

export type { Termination };

/** The facts the termination derivation rules on — the execa result face plus the
 *  engine's own stall-kill flag and the sampling loop's last observation. Named
 *  fields, because the three adjacent booleans/strings would swap silently as
 *  positional parameters. */
export interface TerminationFacts {
  timedOut: boolean;
  killedByStall: boolean;
  signal: string | undefined;
  isTerminated: boolean;
  idleMs: number;
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
 *  reaches back into the session: the spawned command, the in-flight record handle
 *  the sampler overwrites for this dispatch, the phase's termination policy, and the
 *  per-host dispatch env. The caller hands the record handle of its own workspace
 *  root, so the sampling trail lands in the ONE in-flight record (the handle also
 *  supplies the record path the tree leg excludes); the same `cwd` is the spawn
 *  directory AND the scanned tree root (the "scan root ≡ the child's cwd" structural
 *  guarantee). */
export interface ChildRun {
  command: string;
  args: readonly string[];
  cwd: string;
  /** The dispatch's in-flight record — the sampling loop's ONE write target; the
   *  record's own path is the tree leg's exclusion. */
  inflight: InFlight;
  policy: TerminationPolicy;
  /** The per-host dispatch env — layered over the inherited env at spawn (the
   *  engine's values win over the parent's). */
  env: Readonly<Record<string, string>>;
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
  /** The child's per-command Bash ceiling (ms) — a DISCIPLINE constant, never a
   *  phase budget: the child prompt tells the child to put a `timeout` on every
   *  Bash invocation, no longer than this. It is deliberately not a `RoundPhase`
   *  key (no dispatch phase maps to it) and not an engine-side kill: the engine
   *  cannot see commands inside the child. */
  static readonly CHILD_BASH_TIMEOUT_MS = 15 * 60 * 1000;
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

  /** The idle time (ms) at `now` — how long since the last progress (the spawn instant
   *  until the first one). */
  idleMs(now: number): number {
    return Math.max(0, now - this.#idleSince);
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
 *   · The CPU leg is `ProcessFacts.groupCpuMs` (the ONE OS read face — the engine
 *     holds no `ps` parsing of its own); the group's membership is the real process
 *     group (`ps -g`), which survives a leader's exit and sees a `setsid` grandchild.
 *   · The scan root is the child's cwd (the repo root), so the "scan root ≡ child cwd"
 *     correspondence is structural.
 *   · `exclude` is the engine's own writes — `Sampler.excludesFor` is its single
 *     source: the repo's `.git/` and the dispatch's in-flight record together with
 *     that record's atomic temp siblings (`<record>.<n>`, the atomic write seam's
 *     own files). The rest of `.kairos/` is NOT excluded: a child's handoff draft
 *     there is real progress. An entry ending in `.` is a sibling prefix. */
export class Sampler {
  /** The deepest tree level the walk descends to. */
  static readonly MAX_DEPTH = 32;
  /** The VCS internal every scan skips — its mtime is never a round's progress. */
  static readonly VCS_DIR = ".git";

  readonly #pgid: number;
  readonly #scanRoot: string;
  /** The excluded paths themselves. */
  readonly #exclude: ReadonlySet<string>;
  /** The excluded sibling prefixes — an engine artifact's atomic temp files. */
  readonly #excludePrefixes: readonly string[];

  constructor(options: { pgid: number; scanRoot: string; exclude: readonly string[] }) {
    this.#pgid = options.pgid;
    // Absolute, normalized forms on both sides of the comparison below, so an
    // exclusion matches the walked path it names.
    this.#scanRoot = path.resolve(options.scanRoot);
    const entries = options.exclude.map((entry) => path.resolve(entry));
    this.#exclude = new Set(entries.filter((entry) => !Sampler.#isPrefix(entry)));
    this.#excludePrefixes = entries.filter((entry) => Sampler.#isPrefix(entry));
  }

  /** The exclusion single source for one dispatch: the repo's VCS internal, the
   *  in-flight record the engine itself writes, and that record's atomic temp siblings
   *  (`write-file-atomic` writes `<target>.<n>`) — a tick must never self-certify. */
  static excludesFor(scanRoot: string, recordPath: string): readonly string[] {
    return [path.join(scanRoot, Sampler.VCS_DIR), recordPath, `${recordPath}.`];
  }

  /** Whether an exclusion entry names a sibling prefix rather than one exact path. */
  static #isPrefix(entry: string): boolean {
    return entry.endsWith(".");
  }

  /** Whether a walked path is one of the engine's own writes. */
  #isEngineWrite(candidate: string): boolean {
    return (
      this.#exclude.has(candidate) ||
      this.#excludePrefixes.some((prefix) => candidate.startsWith(prefix))
    );
  }

  /** Read both legs of this tick — each independently fail-open: a leg the platform
   *  cannot read is `null`, never a fabricated reading. The CPU leg is the ONE OS
   *  read face's group reading; the tree leg is this class's own walk. */
  probe(): Sample {
    return {
      groupCpuMs: ProcessFacts.groupCpuMs(this.#pgid),
      newestMtimeMs: this.#newestMtimeMs(),
    };
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
      if (entry.isSymbolicLink() || this.#isEngineWrite(child)) continue;
      if (entry.isDirectory()) {
        const nested = this.#newestIn(child, depth + 1);
        if (nested !== null && (newest === null || nested > newest)) newest = nested;
        continue;
      }
      // Content mtimes only: a directory's own mtime moves on entry churn, which the
      // CPU leg already reflects as work — and the record's first creation would
      // otherwise bump its directory and self-certify a progress tick.
      const mtimeMs = statSync(child).mtimeMs;
      if (newest === null || mtimeMs > newest) newest = mtimeMs;
    }
    return newest;
  }
}

// ---------------------------------------------------------------------------
// the sampling loop — the dispatch's in-flight sampling trail (§3.4)
// ---------------------------------------------------------------------------

/** The sampling loop of one dispatch — the cadence that wraps the running child: one
 *  sample the moment the child is spawned, then one per `intervalMs`. Each tick reads
 *  the two legs through the `Sampler`, has the `StallJudge` rule on them, and
 *  overwrites the dispatch's in-flight record sampling cells through `InFlight` — the
 *  ONE record, never a second file beside it. A `stalled` verdict fires the loop's
 *  `onStall` callback once — the Terminator's kill trigger (the engine's own group
 *  kill; the SIGTERM → SIGKILL escalation is execa's).
 *
 *  The interval is unref'd: the engine's own sampling must never be the reason the
 *  parent process stays alive (the dispatch awaits the child, not the cadence). The
 *  trail WRITE is fail-open (`InFlight.heartbeat` swallows a failed write): a
 *  diagnostic never decides a dispatch's fate. The loop
 *  NEVER removes the record — removal belongs to `InFlight.release()` (the normal end)
 *  and `InFlight.steal()` (the explicit takeover) alone, so a self-ending round that
 *  still has to hand its conclusion back cannot erase the very fact the gate reads.
 *
 *  The last observation is held in memory (`lastSample`): a terminated round's crash
 *  record takes it from there, never by re-reading the file the engine itself wrote. */
class SamplingLoop {
  readonly #sampler: Sampler;
  readonly #judge: StallJudge;
  readonly #inflight: InFlight;
  readonly #intervalMs: number;
  /** The stall trigger — called once on the first `stalled` verdict (the kill). */
  readonly #onStall?: () => void;
  /** Whether the stall verdict has already fired — one kill per dispatch. */
  #stallFired = false;
  /** The most recent observation — the postmortem sample of a terminated round. */
  #last: SampleRecord | null = null;
  #timer: ReturnType<typeof setInterval> | null = null;

  constructor(options: {
    sampler: Sampler;
    judge: StallJudge;
    inflight: InFlight;
    intervalMs: number;
    onStall?: () => void;
  }) {
    this.#sampler = options.sampler;
    this.#judge = options.judge;
    this.#inflight = options.inflight;
    this.#intervalMs = options.intervalMs;
    this.#onStall = options.onStall;
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

  /** The judge's idle reading (ms) at this instant — the termination fact's idle time. */
  idleMs(): number {
    return this.#judge.idleMs(Date.now());
  }

  /** End the loop at the dispatch's terminal state — the cadence stops and NOTHING
   *  else: the in-flight record is not this loop's to remove, whatever way the round
   *  ended (removal belongs to `InFlight.release()` / `InFlight.steal()` alone). */
  stop(): void {
    if (this.#timer !== null) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
  }

  /** One tick: read both legs, judge them, and overwrite the in-flight record's
   *  sampling cells. A `stalled` verdict fires the kill trigger once (the first stall
   *  owns the kill; later ticks of a dying child never re-fire). */
  #tick(now: number): void {
    const sample = this.#sampler.probe();
    const verdict = this.#judge.observe(sample, now);
    this.#last = {
      sampledAt: now,
      groupCpuMs: sample.groupCpuMs,
      newestMtimeMs: sample.newestMtimeMs,
      verdict,
    };
    this.#inflight.heartbeat({ sampledAt: now, verdict });
    if (verdict === "stalled" && !this.#stallFired) {
      this.#stallFired = true;
      this.#onStall?.();
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
 *     `policy.sampleIntervalMs` after (the in-flight record is that loop's trail, and
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
    // The engine's own stall kill — set by the sampling loop's trigger when the
    // judge rules `stalled` AND the kill is delivered; the derivation reads it to
    // attribute the kill (the signal execa reports for OUR kill would otherwise
    // read as an external one).
    let killedByStall = false;
    const subprocess = execa(run.command, [...run.args], {
      cwd: run.cwd,
      reject: false,
      stripFinalNewline: false,
      // The dispatch env is layered over the inherited one — the engine's per-host
      // values win, the parent environment supplies the rest (the single merge point;
      // the dispatcher carries zero host branches).
      env: { ...process.env, ...run.env },
      // fd 0 on /dev/null: a child that reads stdin sees EOF at once, never a pipe nobody closes.
      stdin: "ignore",
      killDescendants: true,
      forceKillAfterDelay: Terminator.FORCE_KILL_AFTER_DELAY_MS,
      timeout: run.policy.budgetMs,
    });
    // Reclaim the group the instant the direct child exits: a grandchild holding the stdout
    // / stderr pipes would otherwise keep the `await` open. No execa option does this (its
    // group kill is on-demand only), so execa's own group-aware `kill()` is called once, at
    // the `exit` event, and only on the group the engine created (`killDescendants`). With
    // live members the pgid is still reserved; with none (no grandchild) the kill is a no-op
    // unless the pgid was reused inside a vanishingly small window. Every ordinary child exit in
    // termination.test.ts (no grandchild) passes through this kill.
    subprocess.nodeChildProcess.once("exit", () => {
      subprocess.kill();
    });
    const sampling = this.#startSampling(run, subprocess.pid, spawnedAt, () => {
      // The engine's own group kill — execa kills the process group and escalates
      // SIGTERM → SIGKILL after the grace. No signal logic of the engine's own.
      // The flag records DELIVERY, not intent: `kill()` returns false when the signal
      // could not be sent (the child already exited), so a round that ended by itself
      // in the same tick is not misattributed as `stalled`.
      if (subprocess.kill()) killedByStall = true;
    });
    try {
      const result = await subprocess;
      const termination = Terminator.terminationOf({
        timedOut: result.timedOut,
        killedByStall,
        signal: result.signal,
        isTerminated: result.isTerminated,
        idleMs: sampling?.idleMs() ?? 0,
        lastSample: sampling?.lastSample() ?? null,
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
        termination,
      };
    } finally {
      // The cadence never outlives the dispatch (the record itself is the caller's).
      sampling?.stop();
    }
  }

  /** Start the dispatch's sampling loop, or null when the child never spawned (a
   *  broken command has no pid: nothing to sample and nothing to postmortem). The
   *  group id is the child's OWN pid, never recomputed — `killDescendants` forces the
   *  spawn-layer detachment, so the child IS its process group leader (the same fact
   *  execa's own group kill rides); the scan root is the same `cwd` the child was
   *  spawned in. The stall trigger rides through: the loop's first `stalled` verdict
   *  is the kill's authorization. */
  #startSampling(
    run: ChildRun,
    pid: number | undefined,
    spawnedAt: number,
    onStall?: () => void,
  ): SamplingLoop | null {
    if (pid === undefined) return null;
    const sampling = new SamplingLoop({
      sampler: new Sampler({
        pgid: pid,
        scanRoot: run.cwd,
        exclude: Sampler.excludesFor(run.cwd, run.inflight.path()),
      }),
      judge: new StallJudge(run.policy.idleWindowMs, spawnedAt),
      inflight: run.inflight,
      intervalMs: run.policy.sampleIntervalMs,
      onStall,
    });
    sampling.start();
    return sampling;
  }

  /** Derive the termination fact from the child's own result face — the four-way
   *  derivation (§4.1), in the order the causes claim a kill (package-visible, so the
   *  table-driven pin can rule on every branch without a real child):
   *   · the wall-clock ceiling (execa's `timedOut`) → `over-budget`;
   *   · the engine's own stall kill → `stalled` (ahead of the signal leg: OUR kill
   *     also arrives as a signal, and misreading it as external would falsify the
   *     postmortem);
   *   · any other signal → `signal` (the external-kill semantic, never the SIGTERM
   *     literal — SIGTERM / SIGKILL / SIGINT / SIGHUP read the same);
   *   · none of the three but the child was terminated anyway → `unknown` (the
   *     unattributable fallback);
   *   · nothing of the above → the round ended by itself (successfully or not), no
   *     termination.
   *  The last sample rides whichever cause won: it is the sampling loop's own last
   *  observation, held in memory — never a re-read of the record file the engine
   *  itself wrote.
   *
   *  `killedByStall` records that OUR kill was delivered (execa's `kill()` returns
   *  false when the signal could not be sent — a child that already exited is not
   *  attributed here). Residual boundary: a child that exits within the same tick
   *  while its process group still exists (a zombie not yet reaped) can still be
   *  signalled and read `stalled` — the idle verdict, not the kill landing, is the
   *  criterion. */
  static terminationOf(facts: TerminationFacts): Termination | null {
    const { timedOut, killedByStall, signal, isTerminated, idleMs, lastSample } = facts;
    if (timedOut) return { cause: "over-budget", idleMs, lastSample };
    if (killedByStall) return { cause: "stalled", idleMs, lastSample };
    if (signal !== undefined) return { cause: "signal", idleMs, lastSample };
    if (isTerminated) return { cause: "unknown", idleMs, lastSample };
    return null;
  }
}
