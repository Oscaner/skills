// packages/cdd-engine/src-next/infra/__tests__/atomic.test.ts
// The atomic write seam — the ONE write implementation behind `Workspace.writeJson`.
// Two pins: a successful write leaves the exact bytes and zero temporary residue,
// and a failed write never truncates the value a previous write left behind (a
// killed process must never leave half a JSON document).

import { chmodSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AtomicWriter } from "../atomic.ts";

const roots: string[] = [];

/** A scratch directory (removed after each case). */
const scratch = (): string => {
  const dir = mkdtempSync(path.join(tmpdir(), "atomic-"));
  roots.push(dir);
  return dir;
};

/** Whether the process runs without a permission check (root) — a read-only
 *  directory does not refuse a root writer, so the failure pin cannot hold there. */
const isRoot = (): boolean => typeof process.getuid === "function" && process.getuid() === 0;

afterEach(() => {
  for (const dir of roots.splice(0)) {
    // Restore the writable bit a failure pin removed.
    try {
      chmodSync(dir, 0o755);
    } catch {
      // Already gone.
    }
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("AtomicWriter — the single write seam", () => {
  it("writes the exact text and leaves zero temporary files behind", () => {
    const dir = scratch();
    const target = path.join(dir, "progress.json");
    new AtomicWriter().write(target, '{\n  "ok": true\n}\n');

    expect(readFileSync(target, "utf8")).toBe('{\n  "ok": true\n}\n');
    // The write is temp-file + rename: after it settles the directory holds only
    // the target, never a `.tmp` / suffixed sibling.
    expect(readdirSync(dir)).toEqual(["progress.json"]);
  });

  it.skipIf(isRoot())("never truncates the previous value when the write fails", () => {
    const dir = scratch();
    const target = path.join(dir, "progress.json");
    new AtomicWriter().write(target, "first\n");
    // A read-only directory refuses the temporary file an atomic write needs.
    chmodSync(dir, 0o555);
    expect(() => new AtomicWriter().write(target, "second\n")).toThrow();
    expect(readFileSync(target, "utf8")).toBe("first\n");
  });
});
