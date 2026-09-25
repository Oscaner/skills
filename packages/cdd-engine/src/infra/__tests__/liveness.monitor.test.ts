// packages/cdd-engine/src/infra/__tests__/liveness.monitor.test.ts
// T26 unified termination monitor (spec T7.5; the T14 stall detector extended to two causes): the
// dual-signal criterion's two acceptance faces — "stationary over the idle window is killed" and
// "activity is never false-killed" — are pinned twice: pure evaluateStall unit tests (no processes,
// deterministic) and real-process integration tests (spawnManaged + termination: a CPU-quiet sleep
// is reaped with cause "stalled", a CPU spinner and a file-writer both run to completion). The
// two-cause pure judge (terminationCause) pins the first-signal-wins and budget-fallback faces.
// The pass-through invoke.ts → spawnManaged wiring is proven end-to-end via invokeCliWithRetry
// with a real lingering child.

import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { invokeCliWithRetry } from "../invoke.ts";
import {
  evaluateStall,
  initialStallState,
  initProcLifecycle,
  latestFileMtimeMs,
  parsePsCpuTime,
  type StallSample,
  spawnManaged,
  teardownAll,
  terminationCause,
} from "../proc.ts";
import { processGroupReapingSupported } from "./helpers.ts";

const GROUP_SUPPORTED = processGroupReapingSupported();

function tmpDir(prefix: string): string {
  return mkdtempSync(path.join(tmpdir(), `cdd-live-${prefix}-`));
}

// ---- pure stall judge (dual-signal criterion: stationary killed · active never false-killed) ----

describe("proc.ts evaluateStall — dual-signal criterion", () => {
  it("stationary over the window → stalled", () => {
    let state = initialStallState();
    const s = (at: number, cpu: number | null = 10, mtime: number | null = 1000): StallSample => ({
      cpuMs: cpu,
      latestMtimeMs: mtime,
      at,
    });
    const evals = [0, 400, 800, 1200, 1600].map((at) => {
      const r = evaluateStall(state, s(at), 1000);
      state = r.state;
      return r.verdict;
    });
    expect(evals[0]).toBe("progress"); // first sample = baseline
    expect(evals[1]).toBe("idled");
    expect(evals[2]).toBe("idled");
    expect(evals[3]).toBe("stalled"); // at=1200: 1200-0 >= 1000
    expect(evals[4]).toBe("stalled");
  });

  it("CPU growth → progress, never stalled (thinking/file-reads burn CPU)", () => {
    let state = initialStallState();
    let cpu = 0;
    let stalled = false;
    for (let at = 0; at <= 10_000; at += 500) {
      cpu += 250; // monotone growth at every sample
      const r = evaluateStall(state, { cpuMs: cpu, latestMtimeMs: 1000, at }, 3000);
      state = r.state;
      if (r.verdict === "stalled") stalled = true;
    }
    expect(stalled).toBe(false);
  });

  it("workspace mtime advance → progress, never stalled (tree advancing)", () => {
    let state = initialStallState();
    let mtime = 1000;
    let stalled = false;
    for (let at = 0; at <= 10_000; at += 500) {
      mtime += 1000; // files keep being written
      const r = evaluateStall(state, { cpuMs: 0, latestMtimeMs: mtime, at }, 3000);
      state = r.state;
      if (r.verdict === "stalled") stalled = true;
    }
    expect(stalled).toBe(false);
  });

  it("an idle run then a burst of progress resets the window", () => {
    let state = initialStallState();
    // flat for 1000 (at 0,400,800), then a CPU bump at 1200 resets the anchor
    const samples: StallSample[] = [
      { cpuMs: 5, latestMtimeMs: 100, at: 0 },
      { cpuMs: 5, latestMtimeMs: 100, at: 400 },
      { cpuMs: 5, latestMtimeMs: 100, at: 800 },
      { cpuMs: 200, latestMtimeMs: 100, at: 1200 }, // progress
      { cpuMs: 200, latestMtimeMs: 100, at: 1600 },
    ];
    const out = samples.map((s) => {
      const r = evaluateStall(state, s, 1000);
      state = r.state;
      return r.verdict;
    });
    expect(out[3]).toBe("progress");
    expect(out[4]).toBe("idled"); // window restarted at 1200 → 1600 < 1200+1000
  });

  it("CPU sum drops when a member exits, then regrows below the old max → still progress", () => {
    // A long-running descendant tool exits mid-dispatch: `ps -o time= -g` sums only currently
    // listed members, so the group CPU value DROPS. Growth is judged per-sample, not against the
    // all-time max — the moment survivors re-accumulate (even far below the pre-exit reading) the
    // judge must read progress again, or a busy-but-moderate main below a stale max is falsely
    // judged 'idled' until it re-crosses it (false-stall vector on the never-false-killed face).
    let state = initialStallState();
    const r0 = evaluateStall(state, { cpuMs: 5000, latestMtimeMs: 100, at: 0 }, 3000);
    state = r0.state;
    expect(r0.verdict).toBe("progress"); // first sample = baseline
    // the heavy tool exits between samples: sum dips, no growth this tick
    const r1 = evaluateStall(state, { cpuMs: 2000, latestMtimeMs: 100, at: 400 }, 3000);
    state = r1.state;
    expect(r1.verdict).toBe("idled");
    // survivors re-accumulate to 2200 — below the old 5000 max, but growth vs the last sample
    const r2 = evaluateStall(state, { cpuMs: 2200, latestMtimeMs: 100, at: 800 }, 3000);
    state = r2.state;
    expect(r2.verdict).toBe("progress");
    // sustained per-sample growth never stalls, even though every value stays below the old max
    let cpu = 2200;
    let stalled = false;
    for (let at = 1200; at <= 20_000; at += 400) {
      cpu += 100;
      const r = evaluateStall(state, { cpuMs: cpu, latestMtimeMs: 100, at }, 3000);
      state = r.state;
      if (r.verdict === "stalled") stalled = true;
    }
    expect(stalled).toBe(false);
  });

  it("an unavailable signal fails open — unknown never stalls", () => {
    let state = initialStallState();
    let stalled = false;
    const s = (at: number, cpu: number | null = 0, mtime: number | null = 100): StallSample => ({
      cpuMs: cpu,
      latestMtimeMs: mtime,
      at,
    });
    // cpu unreadable the whole time (hung-tool calls usually keep CPU≈0 AND unreadable is
    // possible) — the judge must refuse to kill on unknown + flat alone
    for (const at of [0, 400, 800, 1200, 1600, 2000]) {
      const r = evaluateStall(state, s(at, null), 1000);
      state = r.state;
      if (r.verdict === "stalled") stalled = true;
    }
    expect(stalled).toBe(false);
    // mtime unreadable likewise
    state = initialStallState();
    for (const at of [0, 400, 800, 1200, 1600, 2000]) {
      const r = evaluateStall(state, s(at, 0, null), 1000);
      state = r.state;
      if (r.verdict === "stalled") stalled = true;
    }
    expect(stalled).toBe(false);
  });

  it("window boundary is inclusive (>=), sub-window flat is idled", () => {
    let state = initialStallState();
    const s = (at: number): StallSample => ({ cpuMs: 0, latestMtimeMs: 100, at });
    const base = evaluateStall(state, s(0), 1000); // first sample = window anchor
    state = base.state;
    const at999 = evaluateStall(state, s(999), 1000);
    state = at999.state;
    const at1000 = evaluateStall(state, s(1000), 1000);
    expect(base.verdict).toBe("progress");
    expect(at999.verdict).toBe("idled"); // 999 - 0 < 1000
    expect(at1000.verdict).toBe("stalled"); // 1000 - 0 >= 1000
  });
});

// ---- unified termination judge (T26: stall signal + budget signal, first-cause-wins) ----
// The brief's two-cause judgment face: stalled takes priority over over-budget when the idle window
// ended first; budget is the fallback when the stall signal fails open (CPU/tree unobservable —
// evaluateStall then never yields "stalled", so budget is the sole defense). Tie-break when both
// signals are provable simultaneously: the cause whose condition fired first (idle-end vs budget-end).

describe("proc.ts terminationCause — two-cause unified judgment", () => {
  it("running dispatch (no stall, budget not reached) → null", () => {
    expect(
      terminationCause({
        start: 0,
        at: 100,
        budgetMs: 1000,
        stall: "progress",
        idleSince: null,
        idleWindowMs: 500,
      }),
    ).toBeNull();
  });

  it("stalled before budget → stalled (idle fired first)", () => {
    // idleSince 2000 + window 1000 → idle ends at 3000 < at 600; budget not even reached
    expect(
      terminationCause({
        start: 0,
        at: 600,
        budgetMs: 1000,
        stall: "stalled",
        idleSince: 2000,
        idleWindowMs: 1000,
      }),
    ).toBe("stalled");
  });

  it("both signals ready, idle window ended first → stalled (stall priority)", () => {
    // idleSince 3000 + window 1000 → idle end 4000; budget end 5000 — stall provable before the cap
    expect(
      terminationCause({
        start: 0,
        at: 5000,
        budgetMs: 5000,
        stall: "stalled",
        idleSince: 3000,
        idleWindowMs: 1000,
      }),
    ).toBe("stalled");
  });

  it("budget ended before the idle window completed → over-budget", () => {
    // stall verdict "idled": window (ending 5500) NOT yet complete, but the budget (ending 5000) is
    expect(
      terminationCause({
        start: 0,
        at: 5000,
        budgetMs: 5000,
        stall: "idled",
        idleSince: 4500,
        idleWindowMs: 1000,
      }),
    ).toBe("over-budget");
  });

  it("stall signal fails open, budget reached → over-budget (budget fallback)", () => {
    // verdict "unknown" never becomes "stalled" (fail-open) — the budget is the only defense
    expect(
      terminationCause({
        start: 0,
        at: 1000,
        budgetMs: 1000,
        stall: "unknown",
        idleSince: 500,
        idleWindowMs: 5000,
      }),
    ).toBe("over-budget");
  });

  it("no budget configured → stalled still terminates (liveness-only dispatch)", () => {
    expect(
      terminationCause({
        start: 0,
        at: 600,
        budgetMs: undefined,
        stall: "stalled",
        idleSince: 2000,
        idleWindowMs: 1000,
      }),
    ).toBe("stalled");
    expect(
      terminationCause({
        start: 0,
        at: 600,
        budgetMs: undefined,
        stall: "unknown",
        idleSince: 2000,
        idleWindowMs: 1000,
      }),
    ).toBeNull();
  });
});

// ---- signal parsers / samplers ----

describe("proc.ts parsePsCpuTime — ps time= → ms", () => {
  it("parses MM:SS and [HH:]MM:SS[.cc] forms", () => {
    expect(parsePsCpuTime("0:00")).toBe(0);
    expect(parsePsCpuTime("0:01")).toBe(1000);
    expect(parsePsCpuTime("0:00.51")).toBe(510);
    expect(parsePsCpuTime("1:02:03")).toBe(3_723_000);
  });
  it("sums the whole process group (multi-line)", () => {
    expect(parsePsCpuTime("0:00\n0:01\n1:30\n")).toBe(91_000);
  });
  it("empty / unparseable → null (fail-open signal)", () => {
    expect(parsePsCpuTime("")).toBeNull();
    expect(parsePsCpuTime("   \n")).toBeNull();
    expect(parsePsCpuTime("garbage")).toBeNull(); // single token without : or NN:SS shape → skipped
  });
});

describe("proc.ts latestFileMtimeMs — tree-progress sampler", () => {
  it("returns the newest file mtime, recursively, skipping .git", () => {
    const dir = tmpDir("mtime");
    try {
      mkdirSync(path.join(dir, "sub", ".git"), { recursive: true });
      const t0 = Date.UTC(2020, 0, 1);
      // utimesSync takes epoch SECONDS, not ms — passing ms yields a clamped sentinel on macOS
      writeFileSync(path.join(dir, "old.txt"), "x");
      utimesSync(path.join(dir, "old.txt"), t0 / 1000, t0 / 1000);
      writeFileSync(path.join(dir, "sub", "new.txt"), "y");
      utimesSync(path.join(dir, "sub", "new.txt"), (t0 + 5000) / 1000, (t0 + 5000) / 1000);
      writeFileSync(path.join(dir, "sub", ".git", "big.txt"), "z");
      utimesSync(path.join(dir, "sub", ".git", "big.txt"), (t0 + 9999) / 1000, (t0 + 9999) / 1000);
      const newest = latestFileMtimeMs(dir);
      expect(newest).toBe(t0 + 5000); // .git excluded, nested file wins
      expect(newest).not.toBe(t0 + 9999);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("missing / unreadable dir → null (fail-open signal)", () => {
    expect(latestFileMtimeMs(path.join(tmpDir("gone"), "nope"))).toBeNull();
  });
});

// ---- real-process integration (dual-signal criterion acceptance) ----

describe.skipIf(!GROUP_SUPPORTED)("proc.ts spawnManaged + liveness — integration", () => {
  const watch = tmpDir("watch");
  beforeAll(() => writeFileSync(path.join(watch, "baseline.txt"), "start"));
  beforeEach(async () => {
    await initProcLifecycle({ diskPath: "" });
    await teardownAll();
  });
  afterEach(async () => {
    await teardownAll();
  });

  it("stationary CPU-quiet child is killed past the idle window → cause stalled + timedOut", async () => {
    const r = await spawnManaged(process.execPath, ["-e", "setTimeout(() => {}, 30_000)"], {
      cwd: tmpDir("cwd"),
      env: process.env,
      termination: {
        budgetMs: 30_000,
        progressPath: watch,
        sampleIntervalMs: 200,
        idleWindowMs: 1000,
      },
    });
    expect(r.timedOut).toBe(true);
    expect(r.cause).toBe("stalled");
    expect(r.ok).toBe(false);
  }, 20_000);

  it("file-writing child (CPU≈0, tree advancing) is never killed → completes ok", async () => {
    const outDir = tmpDir("writer");
    const script = `
      const fs = require("fs"); const dir = ${JSON.stringify(outDir)};
      let n = 0; const iv = setInterval(() => { fs.writeFileSync(dir + "/w" + Date.now(), "x"); if (++n >= 15) clearInterval(iv); }, 150);
      setTimeout(() => process.exit(0), 3200);
    `;
    const r = await spawnManaged(process.execPath, ["-e", script], {
      cwd: tmpDir("cwd"),
      env: process.env,
      termination: {
        budgetMs: 30_000,
        progressPath: outDir,
        sampleIntervalMs: 200,
        idleWindowMs: 1200,
      },
    });
    expect(r.ok).toBe(true);
    expect(r.cause).toBeUndefined();
    expect(r.code).toBe(0);
  }, 20_000);

  it("CPU-burning child (thinking/file-reads) is never killed → completes ok", async () => {
    const script = "const t = Date.now(); while (Date.now() - t < 3000) {}";
    const r = await spawnManaged(process.execPath, ["-e", script], {
      cwd: tmpDir("cwd"),
      env: process.env,
      termination: {
        budgetMs: 30_000,
        progressPath: watch,
        sampleIntervalMs: 200,
        idleWindowMs: 2000,
      },
    });
    expect(r.ok).toBe(true);
    expect(r.cause).toBeUndefined();
    expect(r.code).toBe(0);
  }, 20_000);
});

describe.skipIf(!GROUP_SUPPORTED)("invoke.ts → spawnManaged — termination pass-through", () => {
  const watch = tmpDir("passwatch");
  beforeAll(() => writeFileSync(path.join(watch, "baseline.txt"), "start"));
  beforeEach(async () => {
    await initProcLifecycle({ diskPath: "" });
    await teardownAll();
  });
  afterEach(async () => {
    await teardownAll();
  });

  it("invokeCliWithRetry(..., termination) surfaces the stall (idle params reach spawnManaged)", async () => {
    const r = await invokeCliWithRetry(
      { cli: process.execPath, invoke: "-e", output: "text" },
      "setTimeout(() => {}, 30_000)",
      { op: "implement", type: "task" },
      process.env,
      tmpDir("cwd"),
      { progressPath: watch, sampleIntervalMs: 200, idleWindowMs: 1000 }, // no budget — the stall signal must fire first
    );
    expect(r.timedOut).toBe(true);
    expect(r.cause).toBe("stalled");
    expect(r.ok).toBe(false);
  }, 20_000);
});
