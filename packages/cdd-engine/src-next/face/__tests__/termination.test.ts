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
import { ProcessFacts } from "../../infra/proc.ts";
import type { Sample, SampleRecord } from "../../session/ledger.ts";
import {
  type ChildOutcome,
  type ChildRun,
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
  env: Readonly<Record<string, string>> = {},
): ChildRun => ({
  command,
  args,
  cwd: root,
  heartbeatPath: heartbeatOf(root),
  policy,
  env,
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

  it("the dispatch env overrides the inherited env on the child process", async () => {
    const saved = process.env.PI_CACHE_RETENTION;
    process.env.PI_CACHE_RETENTION = "long";
    try {
      const out = await new Terminator().run(
        childRun(
          scratch(),
          process.execPath,
          ["-e", "process.stdout.write(process.env.PI_CACHE_RETENTION ?? '')"],
          TerminationPolicy.of("review"),
          { PI_CACHE_RETENTION: "short" },
        ),
      );
      expect(out.stdout).toBe("short");
    } finally {
      if (saved === undefined) delete process.env.PI_CACHE_RETENTION;
      else process.env.PI_CACHE_RETENTION = saved;
    }
  });

  it("the claude dispatch env forces the 5m prompt TTL on the child process", async () => {
    const saved = process.env.FORCE_PROMPT_CACHING_5M;
    delete process.env.FORCE_PROMPT_CACHING_5M;
    try {
      const out = await new Terminator().run(
        childRun(
          scratch(),
          process.execPath,
          ["-e", "process.stdout.write(process.env.FORCE_PROMPT_CACHING_5M ?? '')"],
          TerminationPolicy.of("review"),
          { FORCE_PROMPT_CACHING_5M: "1" },
        ),
      );
      expect(out.stdout).toBe("1");
    } finally {
      if (saved === undefined) delete process.env.FORCE_PROMPT_CACHING_5M;
      else process.env.FORCE_PROMPT_CACHING_5M = saved;
    }
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

  it('kills a silently-hung child on the stall verdict — `cause: "stalled"` (issue #346 shape)', async () => {
    // The end-to-end stall case: a CPU-silent hung child (zero CPU growth, no
    // workspace writes, no output — the issue #346 field shape) with tiny injected
    // timing. The judge rules `stalled`, the terminator kills the group, and the
    // outcome attributes the kill to the engine's own judgment — never as an
    // external signal, despite execa reporting the kill as one.
    const root = scratch();
    plant(root, "work.md", EPOCH + 10);
    const result = await runner.run(
      childRun(root, "sh", ["-c", "sleep 30"], new TerminationPolicy(60_000, 300, 60)),
    );
    expect(result.termination).not.toBeNull();
    expect(result.termination?.cause).toBe("stalled");
    expect(result.code).toBeNull();
    // The last sample rode the termination in memory — the postmortem pair.
    expect(result.termination?.lastSample).not.toBeNull();
    expect(result.termination?.lastSample?.verdict).toBe("stalled");
    // The heartbeat file stays on disk for a human's postmortem.
    expect(existsSync(heartbeatOf(root))).toBe(true);
  });

  it("never kills a busy child — sustained CPU growth rules `progress`, the round ends by itself", async () => {
    // The discriminating-power positive: a child whose process group keeps burning
    // CPU is `progress` on every tick — the judge never rules `stalled`, no kill
    // fires, and the round ends by itself (exit 0, no termination).
    const result = await runner.run(
      childRun(
        scratch(),
        "sh",
        ["-c", "i=0; while [ $i -lt 4000000 ]; do i=$((i + 1)); done; echo busy-done"],
        new TerminationPolicy(60_000, 300, 60),
      ),
    );
    expect(result.termination).toBeNull();
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("busy-done");
  });

  it('attributes an external signal — `cause: "signal"`, the semantic, never the literal', async () => {
    // A healthy child killed by an OUTSIDE actor: the terminator killed nothing
    // (no stall fired, the production budget is hours away) — the external signal
    // is the termination's attributed cause, by semantic, never the SIGTERM literal.
    const root = scratch();
    plant(root, "work.md", EPOCH + 10);
    // The child writes its own pid (it IS its own process group leader under the
    // killDescendants spawn shape) so the test — standing outside the seam — can
    // signal the group the way a real outside actor would.
    const dispatch = runner.run(
      childRun(
        root,
        "sh",
        ["-c", "echo $$ > pid.txt; sleep 30"],
        TerminationPolicy.of("implement"),
      ),
    );
    const pidFile = path.join(root, "pid.txt");
    const deadline = Date.now() + 8000;
    let pid = 0;
    while (Date.now() < deadline) {
      try {
        pid = Number(readFileSync(pidFile, "utf8").trim());
        if (pid > 0) break;
      } catch {
        // Not written yet — poll on.
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    expect(pid).toBeGreaterThan(0);
    process.kill(-pid, "SIGTERM");
    const result = await dispatch;
    expect(result.termination?.cause).toBe("signal");
    expect(result.code).toBeNull();
  });

  // Repro (macOS, observed on the pre-fix code): a child that exits while a grandchild holds the inherited
  // stdout pipe leaves `await` hanging until the grandchild dies; `ps -g <pgid>` lists
  // the grandchild, so the engine-owned group covers descendants.
  it("reads stdin to EOF without hanging", async () => {
    const root = scratch();
    const dispatch = runner.run(
      childRun(root, "sh", ["-c", "cat > /dev/null; echo drained"], new TerminationPolicy(60_000)),
    );
    const result = await Promise.race([dispatch, hangAfter(5000)]);
    expect(result).not.toBe(HUNG);
    expect((result as ChildOutcome).code).toBe(0);
    expect((result as ChildOutcome).stdout).toBe("drained\n");
    expect((result as ChildOutcome).termination).toBeNull();
  });

  it("reclaims the process group after the direct child exits", async () => {
    const root = scratch();
    // An unrelated bystander in its own group — it must survive the reclaim.
    const bystander = spawn("sleep", ["60"], { detached: true, stdio: "ignore" });
    bystander.unref();
    let grandchild = 0;
    try {
      const dispatch = runner.run(
        childRun(
          root,
          "sh",
          ["-c", "sleep 60 & echo $! > gpid.txt; exit 0"],
          new TerminationPolicy(60_000),
        ),
      );
      const result = await Promise.race([dispatch, hangAfter(5000)]);
      grandchild = Number(readFileSync(path.join(root, "gpid.txt"), "utf8").trim());
      expect(result).not.toBe(HUNG);
      // The child ended by itself: no termination fact.
      expect((result as ChildOutcome).code).toBe(0);
      expect((result as ChildOutcome).termination).toBeNull();
      await waitUntilDead(grandchild);
      expect(isAlive(grandchild)).toBe(false);
      expect(isAlive(bystander.pid as number)).toBe(true);
    } finally {
      if (grandchild > 0 && isAlive(grandchild)) process.kill(grandchild, "SIGKILL");
      bystander.kill("SIGKILL");
    }
  });
});

const HUNG = Symbol("hung");

/** Resolves to `HUNG` after `ms` — the bounded stand-in for an `await` that never ends. */
const hangAfter = (ms: number): Promise<symbol> =>
  new Promise((resolve) => {
    setTimeout(() => resolve(HUNG), ms).unref();
  });

const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const waitUntilDead = async (pid: number): Promise<void> => {
  const deadline = Date.now() + 3000;
  while (isAlive(pid) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
};

// ---------------------------------------------------------------------------
// the derivation — the four-way table (§4.1)
// ---------------------------------------------------------------------------

describe("Terminator.terminationOf — the four-way derivation and its priority (spec §4.1)", () => {
  /** The postmortem sample every non-null case must carry verbatim — the cause and
   *  its evidence ride together. */
  const lastSample: SampleRecord = {
    sampledAt: 1234,
    groupCpuMs: 42,
    newestMtimeMs: 987,
    verdict: "stalled",
  };

  /** One execa-result face with every fact independently set. */
  const face = (
    overrides: {
      timedOut?: boolean;
      killedByStall?: boolean;
      signal?: string;
      isTerminated?: boolean;
    } = {},
  ) => ({
    timedOut: false,
    killedByStall: false,
    signal: undefined as string | undefined,
    isTerminated: false,
    idleMs: 1234,
    ...overrides,
  });

  const derive = (facts: ReturnType<typeof face>): unknown =>
    Terminator.terminationOf({ ...facts, lastSample });

  const table: Array<{ label: string; facts: ReturnType<typeof face>; cause: string }> = [
    {
      label: "the wall-clock ceiling alone → `over-budget`",
      facts: face({ timedOut: true, isTerminated: true }),
      cause: "over-budget",
    },
    {
      // The causes claim a kill in order: the ceiling is checked first.
      label: "the wall clock wins over our own kill too → `over-budget`",
      facts: face({ timedOut: true, killedByStall: true, isTerminated: true }),
      cause: "over-budget",
    },
    {
      label: "the engine's own stall kill alone → `stalled`",
      facts: face({ killedByStall: true, isTerminated: true }),
      cause: "stalled",
    },
    {
      // OUR kill also arrives as a signal: misreading it as external would falsify
      // the postmortem, so the stall leg is checked ahead of the signal leg.
      label: "our own kill wins over the signal it reports → `stalled`",
      facts: face({ killedByStall: true, signal: "SIGTERM", isTerminated: true }),
      cause: "stalled",
    },
    {
      label: "any other signal → `signal`, the semantic never the literal",
      facts: face({ signal: "SIGKILL", isTerminated: true }),
      cause: "signal",
    },
    {
      // The unattributable fallback: a terminated child that matches none of the
      // three causes (no real child produces it — the branch is still pinned).
      label: "terminated with no attributable cause → `unknown`",
      facts: face({ isTerminated: true }),
      cause: "unknown",
    },
  ];

  for (const { label, facts, cause } of table) {
    it(label, () => {
      expect(derive(facts)).toEqual({ cause, idleMs: 1234, lastSample });
    });
  }

  it("derives `null` when the round ended by itself — no ceiling, no kill, no signal", () => {
    expect(derive(face())).toBeNull();
  });

  it("carries the last sample as-is — including the honest `null` of no observation", () => {
    const facts = { ...face({ isTerminated: true }), lastSample: null };
    expect(Terminator.terminationOf(facts)).toEqual({
      cause: "unknown",
      idleMs: 1234,
      lastSample: null,
    });
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

  it("reads the process group's own CPU through the ONE OS face — the busy leg the judge rules on", async () => {
    const pid = await detachedChild(process.execPath, ["-e", "while (true) {}"]);
    try {
      // `ps -o time=` truncates to whole seconds off macOS, so a busy group's first
      // nonzero reading can take a moment — poll to the deadline rather than race it.
      const deadline = Date.now() + 8000;
      let cpuMs = ProcessFacts.groupCpuMs(pid);
      while ((cpuMs === null || cpuMs === 0) && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        cpuMs = ProcessFacts.groupCpuMs(pid);
      }
      expect(cpuMs ?? 0).toBeGreaterThan(0);
      // The sampler's CPU leg is that same reading — it holds no `ps` of its own.
      const sampler = new Sampler({ pgid: pid, scanRoot: scratch(), exclude: [] });
      expect(sampler.probe().groupCpuMs).not.toBeNull();
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
