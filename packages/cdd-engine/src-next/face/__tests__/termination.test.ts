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
// The liveness face's own pins live here too (spec §4.2/§4.3): the sampler's two
// child-produced legs (the round log's bytes and a real process group's CPU — the
// four-state truth table itself lives in contract/__tests__/liveness-signal.test.ts),
// and the retired workspace-mtime leg's replacement behaviour: a write elsewhere in
// the tree can no longer certify progress. The sampling loop's pins close the face
// (§3.4): every dispatch's sampling trail — sampled at once, overwritten per tick,
// removed at a normal end, kept when the round was terminated.

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LivenessJudge, type LivenessSignalEntry } from "../../contract/liveness-signal.ts";
import { ProcessFacts } from "../../infra/proc.ts";
import { RoundLog } from "../../infra/round-log.ts";
import { WorkspaceRoot } from "../../infra/workspace.ts";
import { InFlight, type InFlightRecord } from "../../session/inflight.ts";
import type { SampleRecord } from "../../session/ledger.ts";
import {
  type ChildOutcome,
  type ChildRun,
  Sampler,
  SamplingLoop,
  TerminationPolicy,
  Terminator,
} from "../termination.ts";

/** The scratch dispatch's in-flight handle — the production wiring's shape: the
 *  record sits at the workspace-root level. */
const inflightOf = (root: string): InFlight =>
  new InFlight(new WorkspaceRoot(root, ".kairos/cdd"), "probe");

/** A record planted BEFORE the spawn — the production order (the dispatch acquires
 *  its intent first, then the sampling loop overwrites only the sampling cells). */
const recordOf = (): InFlightRecord => ({
  pid: process.pid,
  command: "cdd implement --tasks 1",
  slug: "probe",
  startedAt: Date.now(),
  wave: "1",
  phase: "implement",
  cycle: 1,
  attempt: 1,
  briefHash: null,
  plan: null,
  dispatchBase: null,
  sampledAt: null,
  verdict: null,
});

/** One production-shaped child run over a scratch root — the child's cwd is that root,
 *  and the in-flight record (already planted) lands inside it (the production wiring:
 *  the two paths share one tree). */
const childRun = (
  root: string,
  command: string,
  args: readonly string[],
  policy: TerminationPolicy = TerminationPolicy.of("implement"),
  env: Readonly<Record<string, string>> = {},
): ChildRun => {
  const inflight = inflightOf(root);
  inflight.ensureMarker();
  writeFileSync(inflight.path(), `${JSON.stringify(recordOf(), null, 2)}\n`, "utf8");
  return { command, args, cwd: root, inflight, policy, env };
};

/** The in-flight record's path of a scratch dispatch (`childRun`'s own derivation). */
const recordPathOf = (root: string): string => inflightOf(root).path();

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

  it("pipes the child's bytes into the round log — the engine's own stdout stays silent", async () => {
    // The production pipe, end to end: a real child, a real Terminator, a real log
    // file. A stub runner writes the log itself, so only this face pins the wiring.
    const root = scratch();
    const target = path.join(root, ".kairos/cdd/probe/logs/tasks-1-implement.log");
    const log = await RoundLog.create(target);
    const echoed: string[] = [];
    const spy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation((chunk: string | Uint8Array) => {
        echoed.push(String(chunk));
        return true;
      });
    try {
      const result = await runner.run({
        ...childRun(root, "sh", ["-c", "printf 'round-log-out\\n'; printf 'round-log-err\\n' >&2"]),
        log,
      });
      expect(result.code).toBe(0);
    } finally {
      spy.mockRestore();
      await log.close();
    }
    // both child faces land in the file, verbatim and unprefixed
    const logged = readFileSync(target, "utf8");
    expect(logged).toContain("round-log-out\n");
    expect(logged).toContain("round-log-err\n");
    expect(RoundLog.sizeOf(target)).toBeGreaterThan(0);
    // zero echo — the child's bytes never reach the engine's own stdout face
    expect(echoed.join("")).not.toContain("round-log-out");
    expect(echoed.join("")).not.toContain("round-log-err");
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
    plant(root, "work.md");
    const result = await runner.run(
      childRun(root, "sh", ["-c", "sleep 30"], new TerminationPolicy(60_000, 300, 60)),
    );
    expect(result.termination).not.toBeNull();
    expect(result.termination?.cause).toBe("stalled");
    expect(result.code).toBeNull();
    // The last sample rode the termination in memory — the postmortem pair.
    expect(result.termination?.lastSample).not.toBeNull();
    expect(result.termination?.lastSample?.verdict).toBe("stalled");
    // The in-flight record stays on disk for a human's postmortem.
    expect(existsSync(recordPathOf(root))).toBe(true);
  });

  it("ignores a foreign write elsewhere in the repo — a third party's bytes are not the child's progress", async () => {
    // The retired workspace-mtime leg certified `progress` from ANY content mtime in
    // the tree, so an unrelated writer (a sibling session, an editor save) could keep
    // a dead-silent child alive until the wall-clock ceiling. Both legs now come from
    // the child alone: its log (readable at zero bytes) and its group's CPU (flat).
    const root = scratch();
    const log = await RoundLog.create(
      path.join(root, ".kairos/cdd/probe/logs/tasks-1-implement.log"),
    );
    const foreign = setInterval(() => {
      writeFileSync(path.join(root, `foreign-${Date.now()}.md`), "elsewhere\n");
    }, 40);
    foreign.unref();
    try {
      const result = await runner.run({
        ...childRun(root, "sh", ["-c", "sleep 30"]),
        log,
        policy: new TerminationPolicy(60_000, 300, 60),
      });
      expect(result.termination?.cause).toBe("stalled");
      expect(result.code).toBeNull();
      expect(result.termination?.lastSample?.verdict).toBe("stalled");
    } finally {
      clearInterval(foreign);
      await log.close();
    }
  });

  it("never kills a busy child — sustained CPU growth rules `progress`, the round ends by itself", async () => {
    // The discriminating-power positive: a child whose process group keeps burning
    // CPU is `progress` on every tick — the judge never rules `stalled`, no kill
    // fires, and the round ends by itself (exit 0, no termination).
    //
    // Two host-independence pins ride here. The burn is bounded by WALL time, not by
    // a loop count (a fixed iteration count spends a machine-dependent amount of
    // CPU); and the injected stall window stays above the coarsest `ps` resolution —
    // a `time=` reading is whole seconds where `ps` is the Linux face, so a window
    // shorter than a second sees two ticks between CPU-time crossings and rules a
    // busy child stalled. The window is far above one second; the child burns three.
    const burnMs = 3000;
    const result = await runner.run(
      childRun(
        scratch(),
        process.execPath,
        [
          "-e",
          `const end = Date.now() + ${burnMs}; while (Date.now() < end) {} console.log("busy-done");`,
        ],
        new TerminationPolicy(60_000, 5000, 100),
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
    plant(root, "work.md");
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
    at: 1234,
    logSize: 987,
    cpuMs: 42,
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
// the liveness legs — the sampler's two child-produced readings (§4.2/§4.3)
// ---------------------------------------------------------------------------

const scratchRoots: string[] = [];

/** A scratch directory (removed after each case). */
const scratch = (): string => {
  const dir = mkdtempSync(path.join(tmpdir(), "stall-"));
  scratchRoots.push(dir);
  return dir;
};

/** Plant a content file at `rel` under `root` — pure fixture: the scratch root stands
 *  in for a workspace tree, and no leg reads it. Both legs are the child's own
 *  evidence, so the tree's bytes and mtimes are unobservable to the judge. */
const plant = (root: string, rel: string): string => {
  const target = path.join(root, rel);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, `${rel}\n`);
  return target;
};

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

describe("Sampler — the two child-produced legs (spec §4.2/§4.3)", () => {
  it("reads the round log's byte count and advances its previous-reading basis", () => {
    const target = path.join(scratch(), "logs", "tasks-1-implement.log");
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, "", "utf8");
    const sampler = new Sampler({ logPath: target, pgid: 2147483646 });
    const first = sampler.probe();
    // Zero bytes but READABLE — a silent child is observable, not unknown, and the
    // first tick has no basis to advance from.
    expect(first.logSize).toBe(0);
    expect(first.previous).toEqual([null, null]);
    writeFileSync(target, "progress bytes\n", { encoding: "utf8", flag: "a" });
    const second = sampler.probe();
    expect(second.logSize).toBe(15);
    expect(second.previous[0]).toBe(0);
  });

  it("fails open on unreadable legs — `null` readings, never a throw nor a fabricated zero", () => {
    // No such file and no such process group: both legs are unreadable. The judge
    // rules `unknown` from such a tick, never a kill (the contract suite pins that).
    const sampler = new Sampler({
      logPath: path.join(scratch(), "gone", "round.log"),
      pgid: 2147483646,
    });
    const readings = sampler.probe();
    expect(readings.logSize).toBeNull();
    expect(readings.cpuMs).toBeNull();
  });

  it("reads the process group's own CPU through the ONE OS face — the additional leg", async () => {
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
      const sampler = new Sampler({ logPath: path.join(scratch(), "round.log"), pgid: pid });
      expect(sampler.probe().cpuMs).not.toBeNull();
    } finally {
      reap(pid);
    }
  });
});

// ---------------------------------------------------------------------------
// the sampling loop — the dispatch's in-flight sampling trail (§3.4)
// ---------------------------------------------------------------------------

/** The on-disk in-flight record as a reader sees it — a reader racing an overwrite can
 *  catch a partial file, so an unparsable read is "no observation", never a crash. */
const readRecord = (target: string): InFlightRecord | null => {
  try {
    return JSON.parse(readFileSync(target, "utf8")) as InFlightRecord;
  } catch {
    return null;
  }
};

/** Watch a dispatch's record while it runs — every distinct tick it saw (keyed by the
 *  tick's own `sampledAt`, so a repeated read of one tick collapses). The record is not
 *  removed at the end (that is `InFlight.release`'s job), so the post-run file is read
 *  separately where a case needs it. */
const watchTrail = async (
  dispatch: Promise<ChildOutcome>,
  target: string,
): Promise<{ result: ChildOutcome; records: InFlightRecord[] }> => {
  const seen = new Map<number, InFlightRecord>();
  let settled = false;
  const poll = (async () => {
    while (!settled) {
      const record = readRecord(target);
      if (record !== null && record.sampledAt !== null) seen.set(record.sampledAt, record);
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

describe("SamplingLoop — the dispatch's in-flight sampling trail (spec §3.4)", () => {
  const runner = new Terminator();

  it("takes a sample the moment the child is spawned — not only from the first interval on", async () => {
    const root = scratch();
    plant(root, "work.md");
    // The cadence (60 s) outlives this child many times over: any tick at all can
    // only be the immediate first sample.
    const { result, records } = await watchTrail(
      runner.run(
        childRun(root, "sh", ["-c", "sleep 0.4"], new TerminationPolicy(60_000, 60_000, 60_000)),
      ),
      recordPathOf(root),
    );
    expect(result.termination).toBeNull();
    expect(records.length).toBe(1);
  });

  it("overwrites the record's sampling cells once per tick — the identity fields survive", async () => {
    const root = scratch();
    plant(root, "work.md");
    const { result, records } = await watchTrail(
      runner.run(
        childRun(root, "sh", ["-c", "sleep 0.8"], new TerminationPolicy(60_000, 60_000, 60)),
      ),
      recordPathOf(root),
    );
    expect(result.termination).toBeNull();
    // Several ticks of the declared 60 ms cadence fall inside the child's 800 ms.
    expect(records.length).toBeGreaterThanOrEqual(3);
    // Every observed tick is at least one interval after the previous one: the cadence
    // IS the policy's `sampleIntervalMs`.
    for (let index = 1; index < records.length; index += 1) {
      expect(records[index].sampledAt! - records[index - 1].sampledAt!).toBeGreaterThanOrEqual(50);
    }
    for (const record of records) {
      expect(["progress", "unknown", "idled", "stalled"]).toContain(record.verdict);
      // The identity fields the fixture planted are untouched by the trail write.
      expect(record.pid).toBe(process.pid);
      expect(record.command).toBe("cdd implement --tasks 1");
      expect(record.slug).toBe("probe");
      expect(record.wave).toBe("1");
    }
    // The engine's OWN record write is on no leg at all: both legs are the child's own
    // evidence (its log's bytes, its group's CPU), so a flat, sleeping child reads
    // `progress` on no tick whatever the engine writes beside it — a structural fact,
    // never a declared exclusion.
    expect(records.at(-1)?.verdict).not.toBe("progress");
  });

  it("keeps the record after a self-ending round — release, not the loop, removes it", async () => {
    const root = scratch();
    plant(root, "work.md");
    const inflight = inflightOf(root);
    // The production order: acquire (record + lock) first, then the child runs.
    await inflight.acquire(recordOf());
    const result = await runner.run({
      command: "sh",
      args: ["-c", "sleep 0.3"],
      cwd: root,
      inflight,
      policy: new TerminationPolicy(60_000, 60_000, 60),
      env: {},
    });
    expect(result.termination).toBeNull();
    // The loop never removed it — the record is still the truthful in-flight fact…
    expect(existsSync(inflight.path())).toBe(true);
    expect(existsSync(inflight.lockPath())).toBe(true);
    // …and the ONE release point clears the record and the lock together.
    await inflight.release();
    expect(existsSync(inflight.path())).toBe(false);
    expect(existsSync(inflight.lockPath())).toBe(false);
  });

  it("keeps the record (and its last sampling cells) when the round was terminated", async () => {
    const root = scratch();
    plant(root, "work.md");
    const recordPath = recordPathOf(root);
    const { result } = await watchTrail(
      runner.run(childRun(root, "sh", ["-c", "sleep 30"], new TerminationPolicy(300, 60_000, 60))),
      recordPath,
    );
    expect(result.termination?.cause).toBe("over-budget");
    expect(result.code).toBeNull();
    // The record stays for a human to read…
    expect(existsSync(recordPath)).toBe(true);
    const onDisk = readRecord(recordPath);
    expect(onDisk?.verdict).toBe(result.termination?.lastSample?.verdict);
    expect(onDisk?.sampledAt).toBe(result.termination?.lastSample?.at);
    // …and the round's full last sample (both legs) rode the termination in memory —
    // never a re-read of the file the engine itself wrote.
    const last = result.termination?.lastSample;
    expect(last?.logSize).not.toBeUndefined();
    expect(last?.cpuMs).not.toBeUndefined();
  });

  it("writes no sampling cells when the child never spawned — nothing to sample", async () => {
    const root = scratch();
    plant(root, "work.md");
    const result = await runner.run(childRun(root, "cdd-no-such-binary-xyz", []));
    expect(result.termination).toBeNull();
    // The planted intent survives untouched and carries no fabricated tick.
    const onDisk = readRecord(recordPathOf(root));
    expect(onDisk?.sampledAt).toBeNull();
    expect(onDisk?.verdict).toBeNull();
  });

  it("ends the trail on the first stall — a later unreadable tick never rewrites the postmortem", () => {
    // The deterministic pin: a scripted leg + a fake clock drive the loop's ticks at
    // explicit instants, so the stall attribution depends on neither real CPU
    // resolution (an `ps` read under a loaded run) nor how long a dying process takes
    // to leave the table. The trail's last cell must BE the stall that authorized the
    // kill — a later tick can only observe the corpse and would print `unknown`.
    const root = scratch();
    const inflight = inflightOf(root);
    inflight.ensureMarker();
    writeFileSync(inflight.path(), `${JSON.stringify(recordOf(), null, 2)}\n`, "utf8");
    let now = 1000;
    let stalls = 0;
    let tick = 0;
    const values: (number | null)[] = [10, 10, null];
    const leg: LivenessSignalEntry = {
      leg: "log",
      create: () => ({
        sample: () => {
          const value = values[Math.min(tick, values.length - 1)] ?? null;
          const reading = { value, readableAt: value === null ? null : now };
          tick += 1;
          return reading;
        },
      }),
    };
    const loop = new SamplingLoop({
      sampler: new Sampler({ logPath: "", pgid: 1 }, [leg]),
      judge: new LivenessJudge(),
      inflight,
      intervalMs: 60,
      idleWindowMs: 300,
      spawnedAt: now,
      clock: () => now,
      onStall: () => {
        stalls += 1;
      },
    });

    loop.tick();
    expect(loop.lastSample()?.verdict).toBe("idled");

    now = 1300;
    loop.tick();
    expect(loop.lastSample()).toEqual({ at: 1300, logSize: 10, cpuMs: null, verdict: "stalled" });
    expect(stalls).toBe(1);
    expect(loop.idleMs()).toBe(300);

    // The post-kill tick — the real world's race: the legs are unreadable now. The
    // loop has ended, so the postmortem keeps the stall, and the kill never re-fires.
    now = 1400;
    loop.tick();
    expect(loop.lastSample()?.verdict).toBe("stalled");
    expect(stalls).toBe(1);
    const onDisk = readRecord(inflight.path());
    expect(onDisk?.verdict).toBe("stalled");
    expect(onDisk?.sampledAt).toBe(1300);
  });
});
