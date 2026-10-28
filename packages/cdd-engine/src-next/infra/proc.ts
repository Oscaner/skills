// packages/cdd-engine/src-next/infra/proc.ts
// The ONE OS process read face of the engine (P21 §2.3/§6.1). Two capabilities,
// deliberately two sources:
//   · `ps-list` answers the non-CPU facts — the process table, the PPID chain and
//     the start time that guards pid reuse;
//   · `ps -o time= -g <pgid>` keeps today's process-GROUP cumulative CPU reading.
//     This is the declared exception to "prefer a mature third-party package": no
//     cross-platform package reports group CPU (`pidusage` is per-pid; `ps-list`
//     carries no pgid). Replacing the group read with a PPID walk plus `pidusage`
//     would miss members — a leader that exits reparents its members, and a
//     `setsid` grandchild is not in that tree at all — and the direction of the
//     error would be a false stall, i.e. killing a working child.
//
// The group's definition is pinned here: the members are `ps -g <pgid>`'s members
// (the real process group, same source as before); the PPID descent only serves
// the distinct-dispatch face ("is one dispatch running, not two"), never the CPU leg.
//
// Module-level exports are types / the class — zero behavior-carrying bare functions.

import { execFileSync } from "node:child_process";
import psList from "ps-list";

/** One process row — the fact set the engine's liveness / dedup face reads. */
export interface ProcRow {
  readonly pid: number;
  readonly ppid: number;
  readonly cmd: string;
  /** The process start instant (epoch ms = `descriptor.startTime?.getTime() ?? null`
   *  — `ps-list`'s `startTime` is a `Date` (possibly `undefined` on Windows); the
   *  conversion lives ONLY here. Unreadable → null. */
  readonly startTime: number | null;
}

/** The process-fact reader — the single OS read face. */
export class ProcessFacts {
  /** A `ps -o time=` reading: `[DD-][HH:]MM:SS[.ff]` (BSD gives centiseconds, Linux
   *  whole seconds — both ride the same pattern). Migrated verbatim from `Sampler`;
   *  this is its only copy. */
  static readonly TIME_PATTERN =
    /^(?:(\d+)-)?(?:(\d+):(\d+):(\d+(?:\.\d+)?)|(\d+):(\d+(?:\.\d+)?))$/;

  /** The start-time tolerance of the liveness judgment (ms): a recorded start time
   *  within this window of the live one is the same process (a pid reused by a later
   *  process lands far outside it). */
  static readonly START_TIME_TOLERANCE_MS = 60_000;

  /** The whole process table (`ps-list`, one read), sorted by pid for stable dedup. */
  static async snapshot(): Promise<readonly ProcRow[]> {
    const descriptors = await psList();
    return descriptors
      .map((descriptor) => ({
        pid: descriptor.pid,
        ppid: descriptor.ppid,
        cmd: descriptor.cmd ?? descriptor.name,
        startTime: descriptor.startTime?.getTime() ?? null,
      }))
      .sort((left, right) => left.pid - right.pid);
  }

  /** The group's cumulative CPU (ms), summed over `ps -o time= -g <pgid>`'s members.
   *  Keep today's reading exactly: a non-zero `ps` exit (no such group, or no `ps`
   *  at all), an empty reading or any unparseable line makes the leg unreadable —
   *  `null`, fail-open. */
  static groupCpuMs(pgid: number): number | null {
    let output: string;
    try {
      output = execFileSync("ps", ["-o", "time=", "-g", String(pgid)], {
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
    // A group with no observable member is not evidence of zero CPU.
    if (lines.length === 0) return null;
    let total = 0;
    for (const line of lines) {
      const ms = ProcessFacts.#parseCpuTime(line);
      if (ms === null) return null;
      total += ms;
    }
    return total;
  }

  /** The group's process ids: the PPID descent rooted at `pgid` (a wrapper process
   *  and the children it spawned are ONE dispatch, so `npm exec` never counts as a
   *  second task). The root itself is a member when the table carries it. */
  static groupMembers(pgid: number, rows: readonly ProcRow[]): readonly number[] {
    const children = new Map<number, number[]>();
    for (const row of rows) {
      const siblings = children.get(row.ppid);
      if (siblings === undefined) children.set(row.ppid, [row.pid]);
      else siblings.push(row.pid);
    }
    const members: number[] = [];
    const seen = new Set<number>();
    const queue: number[] = [pgid];
    while (queue.length > 0) {
      const pid = queue.pop();
      if (pid === undefined || seen.has(pid)) continue;
      seen.add(pid);
      members.push(pid);
      for (const child of children.get(pid) ?? []) queue.push(child);
    }
    return members.sort((left, right) => left - right);
  }

  /** Whether `pid` is live under the recorded start time:
   *   · absent from the table → false;
   *   · present but the start time is incompatible (|startTime − startedAt| >
   *     tolerance) → false (the pid was reused);
   *   · present with an unreadable start time → null (never "dead": an unreadable
   *     fact must not authorize a takeover);
   *   · the table itself unreadable → null (same conservative reading).
   *  `rows` is the test seam (the same shape `snapshot()` returns). */
  static async live(
    pid: number,
    startedAt: number,
    rows?: readonly ProcRow[],
  ): Promise<boolean | null> {
    let table: readonly ProcRow[];
    try {
      table = rows ?? (await ProcessFacts.snapshot());
    } catch {
      return null;
    }
    const row = table.find((entry) => entry.pid === pid);
    if (row === undefined) return false;
    if (row.startTime === null) return null;
    return Math.abs(row.startTime - startedAt) <= ProcessFacts.START_TIME_TOLERANCE_MS;
  }

  /** One `time=` reading as milliseconds — `null` when the text is not that format. */
  static #parseCpuTime(text: string): number | null {
    const match = ProcessFacts.TIME_PATTERN.exec(text);
    if (match === null) return null;
    const days = Number(match[1] ?? 0);
    const hours = Number(match[2] ?? 0);
    const minutes = Number(match[3] ?? match[5] ?? 0);
    const seconds = Number(match[4] ?? match[6] ?? 0);
    return (((days * 24 + hours) * 60 + minutes) * 60 + seconds) * 1000;
  }
}
