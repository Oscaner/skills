// packages/cdd-engine/src-next/infra/__tests__/proc.test.ts
// The ONE OS read face — `ProcessFacts`. Pins:
//   · group CPU keeps today's `ps -o time= -g <pgid>` reading (the declared
//     exception: no cross-platform package reports process-GROUP cumulative CPU),
//     including the two measured shapes — a leader that exits first (members get
//     reparented, yet stay in the group) and a `setsid` grandchild (its own group,
//     invisible to a PPID walk);
//   · PPID descent collects a wrapper process and its children as one dispatch;
//   · liveness is "in the table AND the recorded start time is compatible",
//     and an unreadable start time is `null` — never "dead".

import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ProcessFacts } from "../proc.ts";

const scratchRoots: string[] = [];

/** A scratch directory (removed after each case). */
const scratch = (): string => {
  const dir = mkdtempSync(path.join(tmpdir(), "proc-"));
  scratchRoots.push(dir);
  return dir;
};

/** Spawn one detached child — its own process group and session. */
const detachedChild = async (command: string, args: readonly string[]): Promise<number> => {
  const child = spawn(command, [...args], { detached: true, stdio: "ignore" });
  child.unref();
  // Let the kernel settle the new group before `ps` reads it.
  await new Promise((resolve) => setTimeout(resolve, 200));
  return child.pid ?? 0;
};

/** SIGKILL a detached child (its whole group) and wait a beat — a leaked spinner
 *  would keep the suite's process alive. */
const reap = async (pid: number): Promise<void> => {
  if (pid === 0) return;
  for (const target of [-pid, pid]) {
    try {
      process.kill(target, "SIGKILL");
    } catch {
      // Already gone.
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 50));
};

const waitFor = async (predicate: () => boolean, deadlineMs = 10_000): Promise<void> => {
  const deadline = Date.now() + deadlineMs;
  while (!predicate() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
};

/** One `ps -o time=` reading as milliseconds — the test's OWN parser (independent of
 *  the implementation under test, so the comparison is a real cross-check). */
const timeToMs = (text: string): number => {
  const match = /^(?:(\d+)-)?(?:(\d+):(\d+):(\d+(?:\.\d+)?)|(\d+):(\d+(?:\.\d+)?))$/.exec(
    text.trim(),
  );
  if (match === null) throw new Error(`unparsable ps time reading: ${text}`);
  const days = Number(match[1] ?? 0);
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3] ?? match[5] ?? 0);
  const seconds = Number(match[4] ?? match[6] ?? 0);
  return ((days * 24 + hours) * 3600 + minutes * 60 + seconds) * 1000;
};

/** The `ps -o time= -g <pgid>` sum, read independently of the implementation. */
const psGroupCpuMs = (pgid: number): number => {
  try {
    const output = execFileSync("ps", ["-o", "time=", "-g", String(pgid)], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return output
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .reduce((total, line) => total + timeToMs(line), 0);
  } catch {
    throw new Error(`ps -g ${pgid} failed`);
  }
};

afterEach(() => {
  for (const dir of scratchRoots.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("ProcessFacts — group CPU keeps the `ps -g` reading", () => {
  it("reads a live group as a non-negative number and an absent group as null", async () => {
    const pid = await detachedChild(process.execPath, ["-e", "while (true) {}"]);
    try {
      const cpuMs = ProcessFacts.groupCpuMs(pid);
      expect(cpuMs).not.toBeNull();
      expect(cpuMs ?? -1).toBeGreaterThanOrEqual(0);
    } finally {
      await reap(pid);
    }
    expect(ProcessFacts.groupCpuMs(2_147_483_646)).toBeNull();
  });

  it("keeps reading the group after its leader exits (members are reparented, still grouped)", async () => {
    const script = [
      "const { spawn } = require('node:child_process');",
      "spawn(process.execPath, ['-e', 'while (true) {}'], { stdio: 'ignore' });",
      "setTimeout(() => process.exit(0), 300);",
    ].join("\n");
    const leader = await detachedChild(process.execPath, ["-e", script]);
    try {
      // Wait for the leader to exit; its member keeps the group alive.
      await waitFor(() => {
        try {
          return ProcessFacts.groupCpuMs(leader) !== null;
        } catch {
          return false;
        }
      });
      let reading = psGroupCpuMs(leader);
      const deadline = Date.now() + 10_000;
      while (reading === 0 && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        reading = psGroupCpuMs(leader);
      }
      expect(reading).toBeGreaterThan(0);
      // CPU only grows: the later group read is never below the earlier cross-check.
      expect(ProcessFacts.groupCpuMs(leader) ?? -1).toBeGreaterThanOrEqual(reading);
    } finally {
      await reap(leader);
    }
  });

  it("counts a `setsid` grandchild in its OWN group — the shape a PPID walk cannot see", async () => {
    const pidFile = path.join(scratch(), "grandchild.pid");
    const script = [
      "const { spawn } = require('node:child_process');",
      "const fs = require('node:fs');",
      "const child = spawn(process.execPath, ['-e', 'while (true) {}'], { detached: true, stdio: 'ignore' });",
      "child.unref();",
      "fs.writeFileSync(process.argv[1], String(child.pid));",
      "setTimeout(() => process.exit(0), 300);",
    ].join("\n");
    const leader = await detachedChild(process.execPath, ["-e", script, pidFile]);
    let grandchild = 0;
    try {
      await waitFor(() => {
        try {
          grandchild = Number(readFileSync(pidFile, "utf8").trim());
          return Number.isInteger(grandchild) && grandchild > 0;
        } catch {
          return false;
        }
      });
      // The grandchild runs in its own session/group (setsid at its spawn): the
      // group read must find it there, while a PPID descent from the leader does not.
      let reading = psGroupCpuMs(grandchild);
      const deadline = Date.now() + 10_000;
      while (reading === 0 && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        reading = psGroupCpuMs(grandchild);
      }
      expect(reading).toBeGreaterThan(0);
      expect(ProcessFacts.groupCpuMs(grandchild) ?? -1).toBeGreaterThanOrEqual(reading);
      // Once the leader exits the grandchild is reparented away, so the PPID walk
      // rooted at the leader can no longer reach it — the group read still can.
      const deadline2 = Date.now() + 5000;
      let members = ProcessFacts.groupMembers(leader, await ProcessFacts.snapshot());
      while (members.includes(grandchild) && Date.now() < deadline2) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        members = ProcessFacts.groupMembers(leader, await ProcessFacts.snapshot());
      }
      expect(members).not.toContain(grandchild);
      expect(ProcessFacts.groupCpuMs(grandchild)).not.toBeNull();
    } finally {
      await reap(grandchild);
      await reap(leader);
    }
  });
});

describe("ProcessFacts — the PPID-descended dispatch group", () => {
  it("collects a wrapper process and its spawned children as one dispatch", async () => {
    const script = [
      "const { spawn } = require('node:child_process');",
      "spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)'], { stdio: 'ignore' });",
      "setTimeout(() => {}, 30000);",
    ].join("\n");
    const pid = await detachedChild(process.execPath, ["-e", script]);
    try {
      let rows = await ProcessFacts.snapshot();
      await waitFor(() => ProcessFacts.groupMembers(pid, rows).length >= 2);
      rows = await ProcessFacts.snapshot();
      expect(ProcessFacts.groupMembers(pid, rows)).toContain(pid);
      expect(ProcessFacts.groupMembers(pid, rows).length).toBeGreaterThanOrEqual(2);
    } finally {
      await reap(pid);
    }
  });

  it("returns a single member for a wrapper process with no children", async () => {
    const pid = await detachedChild("sleep", ["30"]);
    try {
      const rows = await ProcessFacts.snapshot();
      expect(ProcessFacts.groupMembers(pid, rows)).toEqual([pid]);
    } finally {
      await reap(pid);
    }
  });
});

describe("ProcessFacts — liveness and pid reuse", () => {
  it("accepts a live pid with a compatible start time and rejects a foreign one", async () => {
    const pid = await detachedChild("sleep", ["30"]);
    try {
      const rows = await ProcessFacts.snapshot();
      const own = rows.find((row) => row.pid === pid);
      expect(own?.startTime ?? null).not.toBeNull();
      expect(await ProcessFacts.live(pid, Date.now())).toBe(true);
      expect(await ProcessFacts.live(pid, Date.now() - 600_000)).toBe(false);
    } finally {
      await reap(pid);
    }
    expect(await ProcessFacts.live(2_147_483_646, Date.now())).toBe(false);
  });

  it("answers null — never `dead` — when the start time is unreadable", async () => {
    const rows = [{ pid: process.pid, ppid: 1, cmd: "node", startTime: null }];
    expect(await ProcessFacts.live(process.pid, Date.now(), rows)).toBeNull();
  });

  it("carries the start time as epoch milliseconds", async () => {
    const rows = await ProcessFacts.snapshot();
    const own = rows.find((row) => row.pid === process.pid);
    expect(own).toBeDefined();
    if (own !== undefined && own.startTime !== null) {
      // Epoch ms of a running process sits near the wall clock, never at a
      // seconds-scale or `Date`-shaped value.
      expect(Math.abs(Date.now() - own.startTime)).toBeLessThan(7 * 24 * 3600 * 1000);
      expect(own.startTime).toBeGreaterThan(1_000_000_000_000);
    }
  });
});
