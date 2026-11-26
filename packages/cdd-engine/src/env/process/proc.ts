// packages/cdd-engine/src/env/process/proc.ts
// The process facts: two OS reads, deliberately two sources.
//
//   · `ps-list` answers the non-CPU facts — the process table, the PPID chain and the
//     start time that guards pid reuse;
//   · `ps -o time= -g <pgid>` answers the process GROUP's cumulative CPU. No
//     cross-platform package reports group CPU (`pidusage` is per-pid, `ps-list`
//     carries no pgid), and replacing the group read with a PPID walk would miss
//     members: a leader that exits reparents its members, and a `setsid` grandchild is
//     not in that tree at all. The direction of that error would be a false stall —
//     killing a working child — so the group read stays.
//
// The group's definition is pinned here: the members are `ps -g <pgid>`'s members (the
// real process group); the PPID descent only serves the distinct-dispatch face ("is one
// dispatch running, not two"), never the CPU leg.
//
// A group is ONE fact however many processes carry it: `npm exec` wraps the real child,
// so the wrapper and the child it spawned both belong to the same reading. The table
// reader takes an injected table (`snapshot()` in production), which is what lets a pin
// rule on a fabricated process table without waiting for a real process to die.

import { execFileSync } from "node:child_process";
import psList from "ps-list";

/** One process row — the fact set the liveness and dedup faces read. */
export interface ProcRow {
  /** The process id. */
  readonly pid: number;
  /** The parent process id. */
  readonly ppid: number;
  /** The process's command text. */
  readonly cmd: string;
  /** The process start instant (epoch ms), or null when unreadable. */
  readonly startTime: number | null;
}

/** The recorded side of the pid-reuse guard — one process's own start instant. The
 *  production face is `ProcessFacts`; a long-lived session takes it as an injection
 *  seam so its start instant is pinnable without waiting one out. */
export interface ProcessStartReader {
  /** One process's start instant (epoch ms), or null when unreadable. */
  startOf(pid: number): Promise<number | null>;
}

/**
 * ProcessFacts — the process-fact reader. Invariant: every answer is a present fact or
 * a declared unreadable (`false` for "not there", `null` for "cannot tell"), and a
 * group reads as one fact regardless of how many processes carry it.
 */
// biome-ignore lint/complexity/noStaticOnlyClass: the OS read face is stateless by nature — the zero-bare-function discipline admits no standalone predicates, and there is no instance state to hold.
export class ProcessFacts {
  /** A `ps -o time=` reading: `[DD-][HH:]MM:SS[.ff]` (BSD gives centiseconds, Linux
   *  whole seconds — both ride the same pattern). */
  static readonly TIME_PATTERN =
    /^(?:(\d+)-)?(?:(\d+):(\d+):(\d+(?:\.\d+)?)|(\d+):(\d+(?:\.\d+)?))$/;

  /** The start-time tolerance of the liveness judgment (ms): a recorded start time
   *  within this window of the live one is the same process (a pid reused by a later
   *  process lands far outside it). */
  static readonly START_TIME_TOLERANCE_MS = 60_000;

  /** The whole process table (`ps-list`, one read), sorted by pid for a stable dedup. */
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

  /** One process's own start instant (epoch ms) — the RECORDED side of the liveness
   *  judgment, so the record and the guard describe the same instant (the process's
   *  start, never the dispatch's). Null when the pid is absent or unreadable. */
  static async startOf(pid: number, rows?: readonly ProcRow[]): Promise<number | null> {
    const table = await ProcessFacts.#tableOf(rows);
    if (table === null) return null;
    return table.find((entry) => entry.pid === pid)?.startTime ?? null;
  }

  /** The group's cumulative CPU (ms), summed over `ps -o time= -g <pgid>`'s members.
   *  A non-zero `ps` exit (no such group, or no `ps` at all), an empty reading or any
   *  unparseable line makes the leg unreadable — `null`, fail-open. */
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

  /** The group's process ids: the PPID descent rooted at `pgid` (a wrapper process and
   *  the children it spawned are ONE dispatch, so `npm exec` never counts as a second
   *  task). The root itself is a member when the table carries it. */
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
   *   · absent from the table → false (an exited process reads as gone);
   *   · present with an incompatible start time (|live − recorded| > tolerance) →
   *     false (the pid was reused);
   *   · present with an unreadable start time → null (never "dead": an unreadable fact
   *     must not authorize a takeover);
   *   · the table itself unreadable → null (the same conservative reading). */
  static async live(
    pid: number,
    startedAt: number,
    rows?: readonly ProcRow[],
  ): Promise<boolean | null> {
    const table = await ProcessFacts.#tableOf(rows);
    if (table === null) return null;
    const row = table.find((entry) => entry.pid === pid);
    if (row === undefined) return false;
    if (row.startTime === null) return null;
    return Math.abs(row.startTime - startedAt) <= ProcessFacts.START_TIME_TOLERANCE_MS;
  }

  /** The injected table, or one read — null when the read itself failed (the caller
   *  folds "cannot tell" into its own conservative answer). */
  static async #tableOf(rows?: readonly ProcRow[]): Promise<readonly ProcRow[] | null> {
    if (rows !== undefined) return rows;
    try {
      return await ProcessFacts.snapshot();
    } catch {
      return null;
    }
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
