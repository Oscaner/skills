// packages/cdd-engine/src-next/contract/liveness-signal.ts
// P22 T5 — the liveness signal contract + the four-state judge (design spec §4.2/§4.3).
// Both legs are evidence the CHILD itself produces, and nothing else can move them:
//   · `LogGrowth` — the round log file's size (bytes arriving; zero parsing);
//   · `CpuAdvance` — the process group's cumulative CPU (the additional leg).
// The retired workspace-mtime leg is GONE: a third party's writes into the tree could
// self-certify progress, which is exactly the false "still working" reading the phase
// removes. Its exclusion plane (`Sampler.excludesFor`, the tree walk) died with it, so
// "the engine's own writes never certify progress" is now structural rather than a
// declared exclusion.
//
// `LIVENESS_SIGNALS` is a PER-ROUND factory, never a module-level instance array: the
// sampler builds this round's signals from this round's context, so the self-held
// `readableAt` state cannot leak across rounds (a previous round's "was readable" must
// never testify for the next one). Each entry NAMES its leg, so the postmortem cells
// (`logSize` / `cpuMs`) address their leg by name, never by array position.
//
// `readableAt` is the tick at which the leg was last READ, retained across unreadable
// ticks — so "readable somewhere inside the window" is a judgeable present fact instead
// of a lost past.
//
// Module-level exports are types / the declared registry / the classes — zero
// behavior-carrying bare functions.

import { ProcessFacts } from "../infra/proc.ts";
import { RoundLog } from "../infra/round-log.ts";
import type { StallVerdict } from "../session/ledger.ts";

/** One leg's reading at one tick. `value` is the leg's number (the log's size in bytes,
 *  the group's cumulative CPU in ms) or null when the leg is unreadable. `readableAt` is
 *  the tick at which this leg was last readable — the previous one is RETAINED while the
 *  leg is unreadable, never cleared. */
export interface SignalReading {
  readonly value: number | null;
  readonly readableAt: number | null;
}

/** One liveness signal — a leg the sampler reads once per tick. */
export interface LivenessSignal {
  sample(): SignalReading;
}

/** The round's own facts a signal is built from — taken by the dispatch side for THIS
 *  round (a re-dispatch carries its own `-a{attempt}` log path and its own pgid). */
export interface LivenessContext {
  readonly logPath: string;
  readonly pgid: number;
}

/**
 * LogGrowth — the round log's size. The file is created before the spawn (zero bytes)
 * and only ever appended to, so it is readable and flat from the first tick: a child
 * that never writes a byte reaches `stalled` instead of sitting in `unknown` until the
 * wall-clock ceiling. A vanished / unreadable file is a null reading, not a throw.
 */
export class LogGrowth implements LivenessSignal {
  readonly #path: string;
  readonly #clock: () => number;
  #readableAt: number | null = null;

  constructor(path: string, clock: () => number = Date.now) {
    this.#path = path;
    this.#clock = clock;
  }

  sample(): SignalReading {
    const now = this.#clock();
    const value = RoundLog.sizeOf(this.#path);
    if (value !== null) this.#readableAt = now;
    return { value, readableAt: this.#readableAt };
  }
}

/**
 * CpuAdvance — the process group's cumulative CPU through the ONE OS read face
 * (`ProcessFacts.groupCpuMs`; `ps` stays inside `infra/proc.ts`). An unreadable `ps`
 * (no such group, no `ps` at all) is a null reading: it contributes neither progress,
 * nor unknown, nor a blocked stall.
 */
export class CpuAdvance implements LivenessSignal {
  readonly #pgid: number;
  readonly #clock: () => number;
  #readableAt: number | null = null;

  constructor(pgid: number, clock: () => number = Date.now) {
    this.#pgid = pgid;
    this.#clock = clock;
  }

  sample(): SignalReading {
    const now = this.#clock();
    const value = ProcessFacts.groupCpuMs(this.#pgid);
    if (value !== null) this.#readableAt = now;
    return { value, readableAt: this.#readableAt };
  }
}

/** The leg names — the postmortem record's two cells are addressed by THESE, never by
 *  an array index: `logSize` is the `log` leg's reading, `cpuMs` the `cpu` leg's. */
export type LivenessLeg = "log" | "cpu";

/** One registry entry — a leg's NAME and its per-round factory. The name is what keeps
 *  the postmortem pair honest: inserting or reordering a leg can never silently swap
 *  `logSize` / `cpuMs` (both `number | null`, so no type would catch the swap). */
export interface LivenessSignalEntry {
  readonly leg: LivenessLeg;
  readonly create: (context: LivenessContext) => LivenessSignal;
}

/** The per-round signal registry — the log leg and the additional CPU leg. Factories,
 *  not instances: one round's self-held state is built for that round alone. */
export const LIVENESS_SIGNALS: readonly LivenessSignalEntry[] = [
  { leg: "log", create: (context) => new LogGrowth(context.logPath) },
  { leg: "cpu", create: (context) => new CpuAdvance(context.pgid) },
];

/** One tick's judgment input — this tick's readings, the comparison basis, the idle
 *  time, the stall window and the ONE tick clock (`now`).
 *  `previous` holds each leg's reading at the PREVIOUS tick (null when there is none). */
export interface LivenessInput {
  readonly readings: readonly SignalReading[];
  readonly previous: readonly (number | null)[];
  readonly idleMs: number;
  readonly windowMs: number;
  readonly now: number;
}

/**
 * LivenessJudge — the four-state truth table of design spec §4.2, pure logic:
 *   · any leg advanced over its previous reading → `progress`;
 *   · otherwise, at least one leg was readable inside `[now - windowMs, now]` →
 *     `idled` while the idle window is open, `stalled` (the group kill) once it is
 *     spent;
 *   · otherwise (no leg readable anywhere in the window) → `unknown`, which never
 *     kills (fail-open).
 * An unreadable leg (`value === null`) is neutral: it neither advances, nor conjures
 * `unknown`, nor blocks a stall. A leg that was readable earlier in the window and has
 * since gone unreadable keeps that `readableAt`, so it still authorizes the stall.
 */
export class LivenessJudge {
  verdict(input: LivenessInput): StallVerdict {
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
