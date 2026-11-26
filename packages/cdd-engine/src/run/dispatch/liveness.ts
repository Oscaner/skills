// packages/cdd-engine/src/run/dispatch/liveness.ts
// The liveness reading of one dispatch: two legs of the CHILD's own evidence, and the
// four-state verdict they authorize.
//
//   · `log` — the round log file's size (bytes arriving; zero parsing);
//   · `cpu` — the child's process group's cumulative CPU.
//
// Both legs are produced by the child and by nothing else: a third party writing into the
// work tree can never certify progress, which is what makes "the engine's own writes never
// count as progress" a structural fact rather than a declared exclusion list.
//
// INVARIANT — one instance per round, and an unreadable reading is never a reset: each leg
// keeps the tick at which it was last READ across the ticks where it cannot be read, so
// "readable somewhere inside the window" stays a judgeable present fact instead of a lost
// past. A fresh instance per round is what keeps a previous round's state from testifying
// for the next one.
//
// The verdict is the four-state table (`progress` · `idled` · `stalled` · `unknown`) and
// it is pure logic over one tick's readings: an unreadable leg is neutral (it neither
// advances, nor conjures `unknown`, nor blocks a stall), a leg that advanced is progress,
// a leg readable inside the window authorizes `idled` while the idle window is open and
// `stalled` once it is spent, and no leg readable anywhere in the window is `unknown` —
// which never kills.
//
// The cadence lives in `Watch`: it seeds the idle clock at the spawn instant, restarts it
// on every `progress`, and fires the kill trigger ONCE — after the engine's own kill,
// further ticks observe only a dying process, so the last sample stays the stall that
// authorized the kill. The trail is held in memory: the record is the occupancy, not a
// sampling diary, so nothing here writes to disk.
//
// Module-level exports are types, the declared leg registry, the OS read pair and the
// classes — zero behaviour-carrying bare functions.

import { statSync } from "node:fs";
import type { Clock } from "../../env/process/clock.ts";
import { ProcessFacts } from "../../env/process/proc.ts";

/** One leg's reading at one tick. `value` is the leg's number (the log's size in bytes,
 *  the group's cumulative CPU in ms) or null when the leg is unreadable; `readableAt` is
 *  the tick at which this leg was last readable — retained, never cleared. */
export interface SignalReading {
  readonly value: number | null;
  readonly readableAt: number | null;
}

/** The four-state verdict of one tick. */
export type LivenessVerdict = "progress" | "idled" | "stalled" | "unknown";

/** The leg names — the postmortem cells address their leg by NAME, never by array
 *  position (both cells are `number | null`, so no type would catch a swap). */
export type LivenessLeg = "log" | "cpu";

/** One liveness signal — a leg the sampler reads once per tick. */
export interface LivenessSignal {
  sample(): SignalReading;
}

/** The legs' two OS reads, injected so a pin rules on a fabricated reading. */
export interface LivenessReads {
  /** One file's size in bytes; null when it cannot be read. */
  sizeOf(path: string): number | null;
  /** One process group's cumulative CPU in ms; null when it cannot be read. */
  cpuOf(pgid: number): number | null;
}

/** The production reads — the segment's one filesystem probe (the workspace family
 *  exposes no file-size read of its own) and the process face's group CPU. */
export const LIVENESS_READS: LivenessReads = {
  sizeOf: (path: string): number | null => {
    try {
      return statSync(path).size;
    } catch {
      return null;
    }
  },
  cpuOf: (pgid: number): number | null => ProcessFacts.groupCpuMs(pgid),
};

/** The round's own facts a leg set is built from — taken for THIS round (a re-dispatch
 *  carries its own `-a{attempt}` log path and its own pgid). */
export interface LivenessContext {
  readonly logPath: string;
  readonly pgid: number;
  readonly reads: LivenessReads;
  readonly clock: Clock;
}

/** The round log's size — the file is created before the spawn (zero bytes) and only ever
 *  appended to, so it is readable and flat from the first tick: a child that never writes
 *  a byte reaches `stalled` instead of sitting in `unknown` until the ceiling. */
export class LogGrowth implements LivenessSignal {
  readonly #path: string;
  readonly #reads: LivenessReads;
  readonly #clock: Clock;
  #readableAt: number | null = null;

  constructor(context: LivenessContext) {
    this.#path = context.logPath;
    this.#reads = context.reads;
    this.#clock = context.clock;
  }

  sample(): SignalReading {
    const now = this.#clock.now();
    const value = this.#path === "" ? null : this.#reads.sizeOf(this.#path);
    if (value !== null) this.#readableAt = now;
    return { value, readableAt: this.#readableAt };
  }
}

/** The child group's cumulative CPU — an unreadable read contributes neither progress,
 *  nor unknown, nor a blocked stall. */
export class CpuAdvance implements LivenessSignal {
  readonly #pgid: number;
  readonly #reads: LivenessReads;
  readonly #clock: Clock;
  #readableAt: number | null = null;

  constructor(context: LivenessContext) {
    this.#pgid = context.pgid;
    this.#reads = context.reads;
    this.#clock = context.clock;
  }

  sample(): SignalReading {
    const now = this.#clock.now();
    const value = this.#reads.cpuOf(this.#pgid);
    if (value !== null) this.#readableAt = now;
    return { value, readableAt: this.#readableAt };
  }
}

/** One registry entry — a leg's NAME and its per-round factory. Factories, never
 *  instances: one round's self-held state is built for that round alone. */
export interface LivenessSignalEntry {
  readonly leg: LivenessLeg;
  readonly create: (context: LivenessContext) => LivenessSignal;
}

/** The declared leg set — the log leg and the CPU leg. */
export const LIVENESS_SIGNALS: readonly LivenessSignalEntry[] = [
  { leg: "log", create: (context) => new LogGrowth(context) },
  { leg: "cpu", create: (context) => new CpuAdvance(context) },
];

/** One tick's judgment input — this tick's readings, the previous tick's values (the
 *  comparison basis), the idle time, the stall window and the tick instant. */
export interface LivenessInput {
  readonly readings: readonly SignalReading[];
  readonly previous: readonly (number | null)[];
  readonly idleMs: number;
  readonly windowMs: number;
  readonly now: number;
}

/**
 * LivenessJudge — the four-state truth table (see the file's header). Pure: it holds no
 * state, so two rounds' verdicts can never lean on one another.
 */
// biome-ignore lint/complexity/noStaticOnlyClass: the table is a stateless judgment — the zero-bare-function discipline admits no standalone predicate.
export class LivenessJudge {
  /** The verdict of one tick. */
  static verdict(input: LivenessInput): LivenessVerdict {
    const advanced = input.readings.some((reading, index) => {
      const previous = input.previous[index] ?? null;
      return reading.value !== null && previous !== null && reading.value > previous;
    });
    if (advanced) return "progress";
    const readableInWindow = input.readings.some(
      (reading) =>
        reading.readableAt !== null &&
        reading.readableAt >= input.now - input.windowMs &&
        reading.readableAt <= input.now,
    );
    if (!readableInWindow) return "unknown";
    return input.idleMs < input.windowMs ? "idled" : "stalled";
  }
}

/** One tick's reading set — every leg's reading, the comparison basis the judge needs, and
 *  the two postmortem cells (each read off its NAMED leg). */
export interface TickReadings {
  readonly readings: readonly SignalReading[];
  readonly previous: readonly (number | null)[];
  readonly logSize: number | null;
  readonly cpuMs: number | null;
}

/**
 * Sampler — one round's legs, read once per tick. It builds this round's signals from this
 * round's context and holds the previous tick's values, so the progress comparison basis
 * lives with the cadence, exactly one tick wide.
 */
export class Sampler {
  readonly #signals: readonly { readonly leg: LivenessLeg; readonly signal: LivenessSignal }[];
  readonly #previous: (number | null)[];

  constructor(
    context: LivenessContext,
    entries: readonly LivenessSignalEntry[] = LIVENESS_SIGNALS,
  ) {
    this.#signals = entries.map(({ leg, create }) => ({ leg, signal: create(context) }));
    this.#previous = this.#signals.map(() => null);
  }

  /** Read every leg of this tick — each independently fail-open — and advance the
   *  previous-reading basis. */
  probe(): TickReadings {
    const readings = this.#signals.map((entry) => entry.signal.sample());
    const previous = [...this.#previous];
    readings.forEach((reading, index) => {
      this.#previous[index] = reading.value;
    });
    return {
      readings,
      previous,
      logSize: this.#valueOf(readings, "log"),
      cpuMs: this.#valueOf(readings, "cpu"),
    };
  }

  /** One tick's reading of a NAMED leg — a leg the registry does not declare reads null
   *  (the fail-open face). */
  #valueOf(readings: readonly SignalReading[], leg: LivenessLeg): number | null {
    const index = this.#signals.findIndex((entry) => entry.leg === leg);
    return index < 0 ? null : (readings[index]?.value ?? null);
  }
}

/** One tick's observation — the sample a cut-short round's crash record carries. */
export interface Sample {
  readonly at: number;
  readonly logSize: number | null;
  readonly cpuMs: number | null;
  readonly verdict: LivenessVerdict;
}

/** The cadence's construction facts. */
export interface WatchOptions {
  readonly sampler: Sampler;
  readonly intervalMs: number;
  readonly windowMs: number;
  /** The spawn instant — the idle clock's seed. */
  readonly spawnedAt: number;
  readonly clock: Clock;
  /** The stall trigger — called once, on the first `stalled` verdict. */
  readonly onStall: () => void;
}

/**
 * Watch — one dispatch's sampling cadence. Invariant: at most one stall verdict per
 * dispatch and no tick after it, so the last sample is always the stall that authorized
 * the kill. The interval is unref'd: the engine's own sampling must never be the reason the
 * parent process stays alive.
 */
export class Watch {
  readonly #sampler: Sampler;
  readonly #intervalMs: number;
  readonly #windowMs: number;
  readonly #clock: Clock;
  readonly #onStall: () => void;
  #last: Sample | null = null;
  /** The instant of the last progress — the spawn instant until the first one. */
  #idleSince: number;
  #stalled = false;
  #timer: ReturnType<typeof setInterval> | null = null;

  constructor(opts: WatchOptions) {
    this.#sampler = opts.sampler;
    this.#intervalMs = opts.intervalMs;
    this.#windowMs = opts.windowMs;
    this.#clock = opts.clock;
    this.#onStall = opts.onStall;
    this.#idleSince = opts.spawnedAt;
  }

  /** Sample at once (a round is never observed only from the first interval on) and start
   *  the cadence. A first tick that already rules `stalled` starts no cadence. */
  start(): void {
    this.tick();
    if (this.#stalled) return;
    this.#timer = setInterval(() => this.tick(), this.#intervalMs);
    this.#timer.unref();
  }

  /** Stop the cadence — the dispatch's terminal state. Nothing else: the occupancy is the
   *  caller's. */
  stop(): void {
    if (this.#timer === null) return;
    clearInterval(this.#timer);
    this.#timer = null;
  }

  /** The idle time (ms) at this instant — how long since the last progress. */
  idleMs(): number {
    return Math.max(0, this.#clock.now() - this.#idleSince);
  }

  /** The last observation (null when no tick was taken). */
  lastSample(): Sample | null {
    return this.#last;
  }

  /** One tick at `now` (default: the injected clock): read the legs, judge them, and fire
   *  the stall trigger once. */
  tick(now: number = this.#clock.now()): void {
    if (this.#stalled) return;
    const { readings, previous, logSize, cpuMs } = this.#sampler.probe();
    const verdict = LivenessJudge.verdict({
      readings,
      previous,
      idleMs: Math.max(0, now - this.#idleSince),
      windowMs: this.#windowMs,
      now,
    });
    if (verdict === "progress") this.#idleSince = now;
    this.#last = { at: now, logSize, cpuMs, verdict };
    if (verdict !== "stalled") return;
    this.#stalled = true;
    this.#onStall();
    this.stop();
  }
}
