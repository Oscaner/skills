// packages/cdd-engine/src/__tests__/smoke.integration.test.ts
// The new tree's black-box smoke: a REAL child process of `src/bin.ts` over a materialized
// repository, read only through its streams.
//
// INVARIANT — the composed process answers the two faces a consumer boots for: the `--help`
// surface (the command tree's own bytes) and the `--dry-run` forecast (its five declared
// rows), and a forecast writes NOTHING. The second half is the reason this case spawns a
// process instead of calling `main`: a write the composed graph forgot to guard shows up as a
// changed tree, not as a passing unit.
//
// This is the target `packages/cdd-engine/package.json#scripts.smoke` points at after the
// cutover; the script row itself is the cutover's, so nothing here reads it.

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { materialize, PLAN_REL, treeFixture } from "../../tests/parity/fixtures/trees.ts";

/** The engine package's `src` root and its entry. */
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENTRY = path.join(SRC, "bin.ts");

/** Every path inside one directory, sorted — how "nothing was written" is read. */
const treeOf = (root: string): readonly string[] => {
  const out: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      out.push(path.relative(root, absolute));
      if (entry.isDirectory()) walk(absolute);
    }
  };
  walk(root);
  return out.sort();
};

/** One invocation of the composed process over a repository. */
interface SmokeReading {
  readonly stdout: string;
  readonly stderr: string;
  readonly code: number | null;
}

/** Run one argv through the real entry, in `repo`. */
const smoke = (repo: string, argv: readonly string[]): SmokeReading => {
  const result = spawnSync(process.execPath, ["--experimental-strip-types", ENTRY, ...argv], {
    cwd: repo,
    encoding: "utf8",
    env: { ...process.env, TMPDIR: process.env.TMPDIR ?? "/tmp" },
  });
  return { stdout: result.stdout ?? "", stderr: result.stderr ?? "", code: result.status };
};

describe("the composed process answers the consumer's two faces", () => {
  it("prints the command tree's own help and exits 0", () => {
    const repo = materialize(treeFixture("wave"));
    try {
      const reading = smoke(repo, ["board", "--help"]);
      expect(reading.code).toBe(0);
      expect(reading.stdout).toContain("Usage: cdd board");
      expect(reading.stdout).toContain("Options:");
      expect(reading.stderr).toBe("");
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  }, 120_000);

  it("forecasts the next dispatch through its five rows and writes nothing", () => {
    const repo = materialize(treeFixture("wave"));
    try {
      const before = treeOf(repo);
      const reading = smoke(repo, ["implement", "--tasks", "1", "--plan", PLAN_REL, "--dry-run"]);
      expect(reading.code).toBe(0);
      for (const label of ["step:", "reads:", "would write:", "would record:", "child:"]) {
        expect(reading.stdout).toContain(label);
      }
      // The forecast is a READ: the composed graph creates no workspace, no ledger and no
      // brief for a dispatch it never runs.
      expect(treeOf(repo)).toEqual(before);
      expect(existsSync(path.join(repo, ".kairos/cdd/p9/tasks-1-brief.md"))).toBe(false);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  }, 120_000);
});
