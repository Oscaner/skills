// packages/cdd-engine/src-next/infra/__tests__/round-log.test.ts
// P22 T2 — the per-round log channel: created before the spawn (parent `logs/`
// directory included), append-only, observable by size/mtime, and readable only
// after close. The observers are fail-open: an unreadable path reads null.

import { mkdtempSync, rmSync } from "node:fs";
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
});