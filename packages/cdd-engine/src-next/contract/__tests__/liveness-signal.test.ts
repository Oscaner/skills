// packages/cdd-engine/src-next/contract/__tests__/liveness-signal.test.ts
// P22 T5 — the liveness pins (design spec §4.2/§4.3): the four-state truth table as
// eight rows, plus the retired workspace-mtime leg's replacement behaviour. Pure logic
// + two small signal classes over scratch files — no process is needed for the truth
// table, and the CPU leg is exercised through the ONE OS read face's own reading.

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  CpuAdvance,
  LIVENESS_SIGNALS,
  type LivenessContext,
  LivenessJudge,
  LogGrowth,
} from "../liveness-signal.ts";

/** The production stall window — the constant the truth table's thresholds ride. */
const WINDOW = 30 * 60 * 1000;

const judge = new LivenessJudge();

const scratchRoots: string[] = [];

afterEach(() => {
  for (const dir of scratchRoots.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const scratch = (): string => {
  const dir = mkdtempSync(path.join(tmpdir(), "liveness-"));
  scratchRoots.push(dir);
  return dir;
};

describe("LivenessJudge — the four-state truth table (spec §4.2)", () => {
  it("(a) the log grows while the CPU is silent → progress", () => {
    expect(
      judge.verdict({
        readings: [
          { value: 2048, readableAt: 600 },
          { value: 100, readableAt: 600 },
        ],
        previous: [1024, 100],
        idleMs: 0,
        windowMs: WINDOW,
        now: 1000,
      }),
    ).toBe("progress");
  });

  it("(b) the CPU advances while the log is silent → progress", () => {
    expect(
      judge.verdict({
        readings: [
          { value: 2048, readableAt: 600 },
          { value: 120, readableAt: 600 },
        ],
        previous: [2048, 100],
        idleMs: 0,
        windowMs: WINDOW,
        now: 1000,
      }),
    ).toBe("progress");
  });

  it("(c) both legs silent and readable, the window still open → idled", () => {
    expect(
      judge.verdict({
        readings: [
          { value: 2048, readableAt: 600 },
          { value: 100, readableAt: 600 },
        ],
        previous: [2048, 100],
        idleMs: WINDOW - 1,
        windowMs: WINDOW,
        now: 1000,
      }),
    ).toBe("idled");
  });

  it("(d) both legs silent and readable, the window spent → stalled (inclusive bound)", () => {
    expect(
      judge.verdict({
        readings: [
          { value: 2048, readableAt: 600 },
          { value: 100, readableAt: 600 },
        ],
        previous: [2048, 100],
        idleMs: WINDOW,
        windowMs: WINDOW,
        now: 1000,
      }),
    ).toBe("stalled");
  });

  it("(e) an unreadable CPU leg does not block the stall — silent log + spent window → stalled", () => {
    // The retired behaviour ruled `unknown` here; a null CPU leg is neutral now.
    expect(
      judge.verdict({
        readings: [
          { value: 2048, readableAt: 600 },
          { value: null, readableAt: null },
        ],
        previous: [2048, null],
        idleMs: WINDOW,
        windowMs: WINDOW,
        now: 1000,
      }),
    ).toBe("stalled");
  });

  it("(f) no leg readable anywhere in the window → unknown, never a kill", () => {
    expect(
      judge.verdict({
        readings: [
          { value: null, readableAt: null },
          { value: null, readableAt: null },
        ],
        previous: [null, null],
        idleMs: WINDOW * 2,
        windowMs: WINDOW,
        now: 1000,
      }),
    ).toBe("unknown");
  });

  it("(g) readable earlier in the window then unreadable + silent past the window → stalled, not unknown", () => {
    // The log was readable, then the file vanished (the CPU leg never read at all):
    // the RETAINED `readableAt` proves the leg was observable inside the window.
    const now = WINDOW * 2;
    expect(
      judge.verdict({
        readings: [
          { value: null, readableAt: now - WINDOW + 1 },
          { value: null, readableAt: null },
        ],
        previous: [2048, null],
        idleMs: WINDOW,
        windowMs: WINDOW,
        now,
      }),
    ).toBe("stalled");
  });

  it("the first readable tick is never progress — there is no observation to advance from", () => {
    expect(
      judge.verdict({
        readings: [
          { value: 2048, readableAt: 600 },
          { value: 100, readableAt: 600 },
        ],
        previous: [null, null],
        idleMs: 0,
        windowMs: WINDOW,
        now: 1000,
      }),
    ).toBe("idled");
  });
});

describe("LIVENESS_SIGNALS — the per-round factory (spec §4.2)", () => {
  const context = (logPath: string): LivenessContext => ({ logPath, pgid: 2147483646 });

  /** The log leg one factory call builds — the round's own log leg. */
  const logLegOf = (logPath: string): LogGrowth => {
    const signal = LIVENESS_SIGNALS[0]!(context(logPath));
    expect(signal).toBeInstanceOf(LogGrowth);
    return signal as LogGrowth;
  };

  it("registers both child-produced legs — the log leg first, the additional CPU leg second", () => {
    const target = path.join(scratch(), "round.log");
    writeFileSync(target, "bytes\n", "utf8");
    expect(LIVENESS_SIGNALS[0]!(context(target))).toBeInstanceOf(LogGrowth);
    expect(LIVENESS_SIGNALS[1]!(context(target))).toBeInstanceOf(CpuAdvance);
    expect(logLegOf(target).sample().value).toBe(6);
  });

  it("(h) builds this round's signals — a previous round's readableAt never testifies for the next one", () => {
    const dir = scratch();
    const firstLog = path.join(dir, "tasks-1-fix-1.log");
    writeFileSync(firstLog, "attempt 1 bytes\n", "utf8");

    // Round 1's leg: readable, so it holds a readableAt.
    const firstReading = logLegOf(firstLog).sample();
    expect(firstReading.value).toBe(16);
    expect(typeof firstReading.readableAt).toBe("number");
    // Round 2 (a re-dispatch, `-a2`) gets a FRESH leg from its own context: the file
    // does not exist yet, so the leg is unreadable from its first tick — the previous
    // round's readableAt is not read out of it (the state never crosses rounds).
    const secondReading = logLegOf(path.join(dir, "tasks-1-fix-1-a2.log")).sample();
    expect(secondReading).toEqual({ value: null, readableAt: null });
  });
});

describe("LogGrowth — the log leg (spec §4.2/§4.3)", () => {
  it("reads the file's byte count and advances as bytes arrive", () => {
    const target = path.join(scratch(), "round.log");
    writeFileSync(target, "", "utf8");
    const signal = new LogGrowth(target);
    // Zero bytes but READABLE — a silent child is observable, not unknown.
    expect(signal.sample().value).toBe(0);
    writeFileSync(target, "progress\n", { encoding: "utf8", flag: "a" });
    expect(signal.sample().value).toBe(9);
  });

  it("keeps the last readable tick when the file disappears — the retained readableAt", () => {
    const target = path.join(scratch(), "round.log");
    writeFileSync(target, "bytes\n", "utf8");
    let now = 7000;
    const signal = new LogGrowth(target, () => now);
    expect(signal.sample()).toEqual({ value: 6, readableAt: 7000 });
    rmSync(target);
    now = 9000;
    expect(signal.sample()).toEqual({ value: null, readableAt: 7000 });
  });

  it("is fail-open on a path that never existed — a null reading, never a throw", () => {
    const signal = new LogGrowth(path.join(scratch(), "never-written.log"));
    expect(signal.sample()).toEqual({ value: null, readableAt: null });
  });
});

describe("CpuAdvance — the additional leg (spec §4.2/§4.3)", () => {
  it("reads the process group's CPU through the ONE OS face, and fails open on an unknown group", () => {
    // No such group → `ps` cannot read it → an unreadable leg (null), never a zero.
    const signal = new CpuAdvance(2147483646);
    expect(signal.sample()).toEqual({ value: null, readableAt: null });
  });
});
