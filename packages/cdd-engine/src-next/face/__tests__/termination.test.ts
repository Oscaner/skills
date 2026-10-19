// packages/cdd-engine/src-next/face/__tests__/termination.test.ts
// The Terminator's colocated pins — the asynchronous child-channel integrity the
// retired sync face carried (spec §14 · D36), re-homed onto the `ChildRunner` seam
// when the sync runner was retired:
//   · >1 MiB output (exactly the retired default-ceiling byte count + 1) arrives
//     whole — the child's stdout is byte-faithful (its consumers are the host log
//     and the crash record's `stdoutTail`; nothing downstream parses it);
//   · the round's closing prose survives the biggest pipe — the W1 failure class
//     (tail truncation losing the child's last words) is dead;
//   · stderr aggregates by the same face;
//   · the fail-open semantics hold — a non-zero child rides its own exit code, a
//     broken command never throws (a spawn failure has NO exit code: it rides
//     `code: null`, never a folded `1`, and its reason text survives on stderr).
// The child is a real hermetic shell process (no network, no repo writes).
//
// The stall face's own pins live here too (spec §3.3): the judge's four-state truth
// table (pure, window injected — the production window would make a case wait out the
// real half hour) and the sampler's two legs (a real process group and a scratch tree).
// The sampling loop's pins close the face (§3.4): every dispatch's heartbeat trail —
// sampled at once, overwritten per tick, removed at a normal end, kept when the round
// was terminated.

import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  type ChildOutcome,
  type ChildRun,
  type Sample,
  type SampleRecord,
  Sampler,
  StallJudge,
  TerminationPolicy,
  Terminator,
} from "../termination.ts";

/** One production-shaped child run over a scratch root — the child's cwd is the tree
 *  leg's scan root, and the heartbeat lands inside it (the production wiring: the two
 *  paths share one source, the dispatch's workspace). */
const childRun = (
  root: string,
  command: string,
  args: readonly string[],
  policy: TerminationPolicy = TerminationPolicy.of("implement"),
): ChildRun => ({
  command,
  args,
  cwd: root,
  heartbeatPath: heartbeatOf(root),
  policy,
});

/** The heartbeat path of a scratch dispatch (`childRun`'s own derivation). */
const heartbeatOf = (root: string): string => path.join(root, "liveness.json");

describe("Terminator — the asynchronous child-channel collection (spec §14 · D36)", () => {
  const runner = new Terminator();

  it("collects >1 MiB stdout whole — exactly the retired default ceiling + 1 byte", async () => {
    // 1 MiB + 1 byte of 'x' — the byte count that trips the retired default
    // output-buffer cap; every byte must arrive.
    const result = await runner.run(
      childRun(scratch(), "sh", ["-c", "head -c 1048577 /dev/zero | tr '\\0' x"]),
    );
    expect(result.code).toBe(0);
    expect(result.stdout.length).toBe(1048577);
    expect(result.termination).toBeNull();
  });

  it("keeps the child's closing prose intact behind a huge narrative — the W1 truncation class is dead", async () => {
    // A big narrative stdout followed by the round's closing prose (the `## Return`
    // contract: plain sentences, no key-value lines) — the exact W1 incident shape
    // (work fine, tail lost). The closing lines MUST reach.
    const result = await runner.run(
      childRun(scratch(), "sh", [
        "-c",
        "head -c 2000000 /dev/zero | tr '\\0' x; printf '\\nThe round succeeded; every check is green.\\nThe handoff draft is the machine-readable result.\\n'",
      ]),
    );
    expect(result.code).toBe(0);
    expect(result.stdout.length).toBeGreaterThan(2000000);
    expect(result.stdout).toMatch(/^The round succeeded; every check is green\.$/m);
    expect(result.stdout).toMatch(/^The handoff draft is the machine-readable result\.$/m);
  });

  it("aggregates stderr by the same streaming face", async () => {
    const result = await runner.run(
      childRun(scratch(), "sh", ["-c", "head -c 1100000 /dev/zero | tr '\\0' e >&2"]),
    );
    expect(result.code).toBe(0);
    expect(result.stderr.length).toBe(1100000);
    expect(result.stderr).toMatch(/^e+$/);
  });

  it("stays fail-open — a non-zero child rides its code, a broken command never throws", async () => {
    const nonZero = await runner.run(childRun(scratch(), "sh", ["-c", "echo partial; exit 7"]));
    expect(nonZero.code).toBe(7);
    expect(nonZero.stdout).toBe("partial\n");
    expect(nonZero.termination).toBeNull();
    // A broken command never spawned: it has no exit code (null, never the retired
    // folded `1`), no signal event — so it is NOT a termination, and it is reported
    // with a reason text (execa's own diagnostic) on stderr.
    const broken = await runner.run(childRun(scratch(), "cdd-no-such-binary-xyz", []));
    expect(broken.code).toBeNull();
    expect(broken.stdout).toBe("");
    expect(broken.stderr.length).toBeGreaterThan(0);
    expect(broken.termination).toBeNull();
  });

  it("carries the phase's wall-clock ceiling as the child's timeout — the budget leg of the seam", async () => {
    // The production option face takes the phase's own budget key (the terminator
    // never invents a second clock): a policy whose budget has already elapsed
    // terminates the sleeping child on execa's own kill path, and the outcome
    // reports the termination fact rather than a fabricated exit code.
    const result = await runner.run(
      childRun(scratch(), "sh", ["-c", "sleep 30"], new TerminationPolicy(200)),
    );
    expect(result.termination).not.toBeNull();
    expect(result.termination?.cause).toBe("over-budget");
    expect(result.code).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// the stall face — the judge's truth table and the sampler's two legs (§3.3)
// ---------------------------------------------------------------------------

/** A fixed epoch for planted mtimes: every file's mtime is an explicit second, so a
 *  leg's reading is exact and never `writeFileSync`'s wall clock. */
const EPOCH = 1_700_000_000;

const scratchRoots: string[] = [];

/** A scratch directory (removed after each case). */
const scratch = (): string => {
  const dir = mkdtempSync(path.join(tmpdir(), "stall-"));
  scratchRoots.push(dir);
  return dir;
};

/** Plant a file at `rel` under `root` with an explicit mtime (seconds since epoch). */
const plant = (root: string, rel: string, seconds: number): string => {
  const target = path.join(root, rel);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, `${rel}\n`);
  utimesSync(target, seconds, seconds);
  return target;
};

/** One sample tick of the two legs. */
const tick = (groupCpuMs: number | null, newestMtimeMs: number | null): Sample => ({
  groupCpuMs,
  newestMtimeMs,
});

/** Spawn one detached child — its own process group (and session), the shape the
 *  production `killDescendants` spawn gives every dispatch child. */
const detachedChild = async (command: string, args: readonly string[]): Promise<number> => {
  const child = spawn(command, [...args], { detached: true, stdio: "ignore" });
  child.unref();
  // The group/session is the child's own (setsid at spawn); give the kernel a beat to
  // settle it before `ps` reads it.
  await new Promise((resolve) => setTimeout(resolve, 200));
  return child.pid ?? 0;
};

/** SIGKILL a detached child and wait for its exit — a leaked spinner would keep the
 *  suite's process alive. */
const reap = (pid: number): void => {
  if (pid === 0) return;
  try {
    process.kill(pid, "SIGKILL");
  } catch {
    // Already gone — nothing to reap.
  }
};

afterEach(() => {
  for (const dir of scratchRoots.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("StallJudge — the four-state truth table (spec §3.3)", () => {
  it("rules `idled` while the injected window is open and `stalled` once it is spent", () => {
    const judge = new StallJudge(1000, 0);
    // The first tick has no previous observation: neither leg can have advanced,
    // and the idle clock runs from the spawn instant.
    expect(judge.observe(tick(100, 500), 500)).toBe("idled");
    expect(judge.observe(tick(100, 500), 999)).toBe("idled");
    // The window is spent — inclusive bound.
    expect(judge.observe(tick(100, 500), 1000)).toBe("stalled");
  });

  it("starts the idle clock at the spawn instant, never at the first sample", () => {
    const judge = new StallJudge(1000, 100);
    // A tree that already carried a fresh mtime at the first tick is not progress.
    expect(judge.observe(tick(100, 900), 500)).toBe("idled");
    expect(judge.observe(tick(100, 900), 1100)).toBe("stalled");
  });

  it("rules `progress` on the CPU leg's advance and restarts the window from that tick", () => {
    const judge = new StallJudge(1000, 0);
    expect(judge.observe(tick(100, 500), 0)).toBe("idled");
    // The process group burned CPU — the flat tree does not matter.
    expect(judge.observe(tick(120, 500), 400)).toBe("progress");
    // The window now runs from 400.
    expect(judge.observe(tick(120, 500), 900)).toBe("idled");
    expect(judge.observe(tick(120, 500), 1400)).toBe("stalled");
  });

  it("rules `progress` on the tree leg's advance alone — a rewrite under a flat CPU group", () => {
    const judge = new StallJudge(1000, 0);
    judge.observe(tick(100, 500), 0);
    expect(judge.observe(tick(100, 700), 200)).toBe("progress");
  });

  it("compares the tree leg against its historical maximum — a tree that only loses files makes no progress", () => {
    const judge = new StallJudge(1000, 0);
    judge.observe(tick(100, 900), 0);
    // The newest file was deleted — the reading went backwards, never an advance.
    expect(judge.observe(tick(100, 600), 500)).toBe("idled");
    // Below the historical maximum — still not an advance.
    expect(judge.observe(tick(100, 800), 900)).toBe("idled");
    // Above it — an advance.
    expect(judge.observe(tick(100, 950), 950)).toBe("progress");
  });

  it("rules `unknown` on an unreadable leg and never kills — however long the window has run", () => {
    const judge = new StallJudge(10, 0);
    expect(judge.observe(tick(null, 500), 10 ** 9)).toBe("unknown");
    expect(judge.observe(tick(100, null), 10 ** 9)).toBe("unknown");
    // An unreadable tick proves neither progress nor idleness: it never restarts the
    // window, so the first readable flat tick rules on the window that has run.
    expect(judge.observe(tick(100, 500), 10 ** 9)).toBe("stalled");
  });
});

describe("Sampler — the two legs (spec §3.3)", () => {
  it("reads the newest content mtime, excluding `.git/` and the heartbeat's exact path but not `.kairos/`", () => {
    const root = scratch();
    plant(root, "progress.md", EPOCH + 10);
    // A child's handoff draft under `.kairos/` IS real progress — the domain is never
    // excluded wholesale.
    const draft = plant(root, ".kairos/cdd/slug/tasks-1-handoff.md", EPOCH + 20);
    // The VCS internal and the engine's own heartbeat are newer, and neither counts.
    plant(root, ".git/COMMIT_EDITMSG", EPOCH + 900);
    const heartbeat = plant(root, ".kairos/cdd/slug/liveness.json", EPOCH + 1000);
    const sampler = new Sampler({
      pgid: 0,
      scanRoot: root,
      exclude: Sampler.excludesFor(root, heartbeat),
    });
    expect(sampler.probe().newestMtimeMs).toBe(statSync(draft).mtimeMs);
  });

  it("never follows a symlink — a linked-in file is not this tree's progress", () => {
    const outside = scratch();
    const target = plant(outside, "elsewhere.md", EPOCH + 5000);
    const root = scratch();
    const own = plant(root, "progress.md", EPOCH + 10);
    symlinkSync(target, path.join(root, "link.md"));
    symlinkSync(outside, path.join(root, "linkdir"));
    const sampler = new Sampler({ pgid: 0, scanRoot: root, exclude: [] });
    expect(sampler.probe().newestMtimeMs).toBe(statSync(own).mtimeMs);
  });

  it("stops descending at the declared depth ceiling", () => {
    const root = scratch();
    const shallow = plant(root, "a/b/deep.md", EPOCH + 10);
    const buried = Array.from({ length: Sampler.MAX_DEPTH + 1 }, (_, i) => `d${i}`).join("/");
    plant(root, `${buried}/too-deep.md`, EPOCH + 900);
    const sampler = new Sampler({ pgid: 0, scanRoot: root, exclude: [] });
    expect(sampler.probe().newestMtimeMs).toBe(statSync(shallow).mtimeMs);
  });

  it("fails open on an unreadable leg — `null` into the judge's `unknown`, never a kill", () => {
    // The window is zero: any judged tick would be `stalled` on the spot.
    const judge = new StallJudge(0, 0);
    const sampler = new Sampler({
      pgid: 2147483646,
      scanRoot: path.join(scratch(), "gone"),
      exclude: [],
    });
    const sample = sampler.probe();
    expect(sample.groupCpuMs).toBeNull();
    expect(sample.newestMtimeMs).toBeNull();
    expect(judge.observe(sample, 10 ** 9)).toBe("unknown");
  });

  it("sums the process group's own CPU — the busy leg the judge rules on", async () => {
    const pid = await detachedChild(process.execPath, ["-e", "while (true) {}"]);
    try {
      const sampler = new Sampler({ pgid: pid, scanRoot: scratch(), exclude: [] });
      // `ps -o time=` truncates to whole seconds off macOS, so a busy group's first
      // nonzero reading can take a moment — poll to the deadline rather than race it.
      const deadline = Date.now() + 8000;
      let cpuMs = sampler.probe().groupCpuMs;
      while ((cpuMs === null || cpuMs === 0) && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        cpuMs = sampler.probe().groupCpuMs;
      }
      expect(cpuMs ?? 0).toBeGreaterThan(0);
    } finally {
      reap(pid);
    }
  });

  it("keeps the engine's own heartbeat out of the mtime leg — a tick never self-certifies progress", async () => {
    const pid = await detachedChild("sleep", ["30"]);
    try {
      const root = scratch();
      const draft = plant(root, ".kairos/cdd/slug/tasks-1-handoff.md", EPOCH + 100);
      const heartbeat = plant(root, ".kairos/cdd/slug/liveness.json", EPOCH + 100);
      const sampler = new Sampler({
        pgid: pid,
        scanRoot: root,
        exclude: Sampler.excludesFor(root, heartbeat),
      });
      const judge = new StallJudge(1000, 0);
      const first = sampler.probe();
      // An idle group is readable at zero CPU — the leg's teeth are `null` vs a number.
      expect(first.groupCpuMs).not.toBeNull();
      expect(first.newestMtimeMs).toBe(statSync(draft).mtimeMs);
      expect(judge.observe(first, 0)).toBe("idled");
      // One heartbeat tick later: the ONLY thing that changed is the engine's own
      // write, so the leg stays flat and the window is allowed to be spent.
      utimesSync(heartbeat, EPOCH + 900, EPOCH + 900);
      const second = sampler.probe();
      expect(second.newestMtimeMs).toBe(first.newestMtimeMs);
      expect(judge.observe(second, 1000)).toBe("stalled");
    } finally {
      reap(pid);
    }
  });
});

// ---------------------------------------------------------------------------
// the sampling loop — the dispatch's heartbeat trail (§3.4)
// ---------------------------------------------------------------------------

/** The heartbeat file as the engine last wrote it — a reader racing an overwrite can
 *  catch a partial file, so an unparsable read is "no observation", never a crash. */
const readHeartbeat = (target: string): SampleRecord | null => {
  try {
    return JSON.parse(readFileSync(target, "utf8")) as SampleRecord;
  } catch {
    return null;
  }
};

/** Watch a dispatch's heartbeat while it runs: the terminal cleanup removes the file
 *  at a normal end, so the mid-dispatch face is the only place a tick is visible.
 *  Polls until the dispatch settles and returns every distinct record it saw (keyed by
 *  the tick's own `sampledAt`, so a repeated read of one tick collapses). */
const watchHeartbeat = async (
  dispatch: Promise<ChildOutcome>,
  target: string,
): Promise<{ result: ChildOutcome; records: SampleRecord[] }> => {
  const seen = new Map<number, SampleRecord>();
  let settled = false;
  const poll = (async () => {
    while (!settled) {
      const record = readHeartbeat(target);
      if (record !== null) seen.set(record.sampledAt, record);
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  })();
  try {
    const result = await dispatch;
    return { result, records: [...seen.values()] };
  } finally {
    settled = true;
    await poll;
  }
};

describe("SamplingLoop — the dispatch's heartbeat trail (spec §3.4)", () => {
  const runner = new Terminator();

  it("takes a sample the moment the child is spawned — not only from the first interval on", async () => {
    const root = scratch();
    plant(root, "work.md", EPOCH + 10);
    // The cadence (60 s) outlives this child many times over: any record at all can
    // only be the immediate first sample.
    const { result, records } = await watchHeartbeat(
      runner.run(
        childRun(root, "sh", ["-c", "sleep 0.4"], new TerminationPolicy(60_000, 60_000, 60_000)),
      ),
      heartbeatOf(root),
    );
    expect(result.termination).toBeNull();
    expect(records.length).toBe(1);
  });

  it("overwrites the heartbeat once per tick — the four-field SampleRecord", async () => {
    const root = scratch();
    const planted = statSync(plant(root, "work.md", EPOCH + 10)).mtimeMs;
    const { result, records } = await watchHeartbeat(
      runner.run(
        childRun(root, "sh", ["-c", "sleep 0.8"], new TerminationPolicy(60_000, 60_000, 60)),
      ),
      heartbeatOf(root),
    );
    expect(result.termination).toBeNull();
    // Several ticks of the declared 60 ms cadence fall inside the child's 800 ms.
    expect(records.length).toBeGreaterThanOrEqual(3);
    // Every observed tick is at least one interval after the previous one: the cadence
    // IS the policy's `sampleIntervalMs`.
    for (let index = 1; index < records.length; index += 1) {
      expect(records[index].sampledAt - records[index - 1].sampledAt).toBeGreaterThanOrEqual(50);
    }
    for (const record of records) {
      expect(Object.keys(record).sort()).toEqual([
        "groupCpuMs",
        "newestMtimeMs",
        "sampledAt",
        "verdict",
      ]);
      expect(["progress", "unknown", "idled", "stalled"]).toContain(record.verdict);
    }
    // The two legs are readable in this fixture (a real detached group, a real tree)…
    expect(records[0].groupCpuMs).not.toBeNull();
    // …and the engine's OWN heartbeat never enters the mtime leg: one tick's overwrite
    // is not progress, however many ticks run (the §3.3 exclusion, wired end to end).
    expect(records.every((record) => record.newestMtimeMs === planted)).toBe(true);
  });

  it("removes the heartbeat when the round ends by itself", async () => {
    const root = scratch();
    plant(root, "work.md", EPOCH + 10);
    const heartbeat = heartbeatOf(root);
    const { result, records } = await watchHeartbeat(
      runner.run(
        childRun(root, "sh", ["-c", "sleep 0.3"], new TerminationPolicy(60_000, 60_000, 60)),
      ),
      heartbeat,
    );
    expect(result.termination).toBeNull();
    // The trail existed while the child ran…
    expect(records.length).toBeGreaterThanOrEqual(1);
    // …and is gone once the round ended by itself.
    expect(existsSync(heartbeat)).toBe(false);
  });

  it("keeps the heartbeat when the round was terminated — the human's postmortem", async () => {
    const root = scratch();
    plant(root, "work.md", EPOCH + 10);
    const heartbeat = heartbeatOf(root);
    const { result } = await watchHeartbeat(
      runner.run(childRun(root, "sh", ["-c", "sleep 30"], new TerminationPolicy(300, 60_000, 60))),
      heartbeat,
    );
    expect(result.termination?.cause).toBe("over-budget");
    expect(result.code).toBeNull();
    // The file stays for a human to read…
    expect(existsSync(heartbeat)).toBe(true);
    const onDisk = readHeartbeat(heartbeat);
    expect(Object.keys(onDisk ?? {}).sort()).toEqual([
      "groupCpuMs",
      "newestMtimeMs",
      "sampledAt",
      "verdict",
    ]);
    // …and the round's last sample rode the termination in memory — the same
    // observation, never a re-read of the file the engine itself wrote.
    expect(result.termination?.lastSample).toEqual(onDisk);
  });

  it("writes no heartbeat when the child never spawned — nothing to sample", async () => {
    const root = scratch();
    plant(root, "work.md", EPOCH + 10);
    const result = await runner.run(childRun(root, "cdd-no-such-binary-xyz", []));
    expect(result.termination).toBeNull();
    expect(existsSync(heartbeatOf(root))).toBe(false);
  });
});
