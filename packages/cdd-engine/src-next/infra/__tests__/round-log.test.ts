// packages/cdd-engine/src-next/infra/__tests__/round-log.test.ts
// P22 T2 — the per-round log channel: created before the spawn (parent `logs/`
// directory included), append-only, observable by size/mtime, and readable only
// after close. The observers are fail-open: an unreadable path reads null. A fault
// on the channel kills the log leg alone — never the round it observes.

import { execFileSync } from "node:child_process";
import { closeSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { RoundLog } from "../round-log.ts";

/** A bounded wait for the append stream's bytes to reach the file (the stream writes
 *  on its own tick; the loop exits on its own and never spins). */
const sizeBecomes = async (target: string, expected: number): Promise<number | null> => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const size = RoundLog.sizeOf(target);
    if (size === expected) return size;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  return RoundLog.sizeOf(target);
};

/** A bounded wait for the fault notices to arrive (the stream reports on its own tick). */
const faultsBecomes = async (faults: string[], expected: number): Promise<number> => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (faults.length === expected) return faults.length;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  return faults.length;
};

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("RoundLog — the per-round log file", () => {
  it("creates the file (and its logs/ parent) at zero bytes", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "cdd-round-log-"));
    dirs.push(root);
    const target = path.join(root, ".kairos/cdd/p1/logs/tasks-1-review-1.log");
    const log = await RoundLog.create(target);
    expect(RoundLog.sizeOf(target)).toBe(0);
    expect(log.path).toBe(target);
    await log.close();
  });

  it("grows on write and stays complete after close", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "cdd-round-log-"));
    dirs.push(root);
    const target = path.join(root, ".kairos/cdd/p1/logs/tasks-1-fix-1.log");
    const log = await RoundLog.create(target);
    log.write("first chunk\n");
    expect(await sizeBecomes(target, 12)).toBe(12);
    log.write("second chunk\n");
    await log.close();
    expect(RoundLog.sizeOf(target)).toBe(25);
    expect(RoundLog.mtimeOf(target)).not.toBeNull();
  });

  it("reads null for an absent path — the fail-open observation face", () => {
    const root = mkdtempSync(path.join(tmpdir(), "cdd-round-log-"));
    dirs.push(root);
    const absent = path.join(root, "logs", "absent.log");
    expect(RoundLog.sizeOf(absent)).toBeNull();
    expect(RoundLog.mtimeOf(absent)).toBeNull();
  });

  it("writes raw buffers verbatim — a chunk boundary never tears a multi-byte character", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "cdd-round-log-"));
    dirs.push(root);
    const target = path.join(root, "logs", "tasks-1-implement.log");
    const log = await RoundLog.create(target);
    // the terminator hands over the child's raw chunks; a 2-byte split would break
    // a CJK character if the log re-decoded each chunk on its own
    const bytes = Buffer.from("中文\n", "utf8");
    log.write(bytes.subarray(0, 2));
    log.write(bytes.subarray(2));
    await log.close();
    expect(readFileSync(target, "utf8")).toBe("中文\n");
  });

  it("a stream fault kills the log leg alone — one notice, no crash, close resolves", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "cdd-round-log-"));
    dirs.push(root);
    // a FIFO gives the log a REAL fault on every platform: once its only reader
    // closes, the next append fails with EPIPE (the ENOSPC/EIO stand-in).
    const target = path.join(root, "logs", "tasks-1-review-1.log");
    mkdirSync(path.dirname(target), { recursive: true });
    execFileSync("mkfifo", [target]);
    const reader = openSync(target, "r+");
    const faults: string[] = [];
    const log = await RoundLog.create(target, (failed) => faults.push(failed));
    closeSync(reader);
    // the fault must land as a named observation, never an uncaught 'error' that
    // kills a round which is already concluding.
    log.write("late bytes\n");
    expect(await faultsBecomes(faults, 1)).toBe(1);
    expect(faults).toEqual([target]);
    // once dead, every later write is a silent no-op — one notice, never a second
    log.write("later bytes\n");
    expect(faults).toEqual([target]);
    // close never rejects: a dead channel must not change the round's conclusion
    await expect(log.close()).resolves.toBeUndefined();
  });
});
