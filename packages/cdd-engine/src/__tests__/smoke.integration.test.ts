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
// The fixture is THIS FILE's own — a temp repository it writes, commits and removes — the way
// the script this case replaced built its own. That is deliberate: nothing outside this file
// supplies it, so no scaffolding elsewhere on the tree can take it away and take the release
// gate (`pnpm -C packages/cdd-engine run smoke`) along.
//
// This is the target `packages/cdd-engine/package.json#scripts.smoke` points at after the
// cutover; the script row itself is the cutover's, so nothing here reads it.

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/** The engine package's `src` root and its entry. */
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENTRY = path.join(SRC, "bin.ts");

/** The fixture's phase slug — the workspace the forecast names. */
const SLUG = "smoke";

/** The fixture plan's repo-relative path — the `--plan` the preview reads. */
const PLAN = `docs/kairos/plans/${SLUG}.md`;

/** The fixture's plan: one task block with every declared field, so the wave face derives one
 *  batch and the preview has a step to forecast. */
const PLAN_TEXT = [
  "---",
  "title: Smoke Plan",
  "doc-type: plan",
  `slug: ${SLUG}`,
  "version: v1.0",
  "date: 2026-01-01",
  "---",
  "",
  "## Constraints",
  "",
  "- smoke fixture constraints",
  "",
  "### Task 1: smoke task",
  "",
  "#### Objective",
  "",
  "exercise the preview",
  "",
  "#### Files",
  "",
  "- Create: `a.ts`",
  "",
  "#### Consumes",
  "",
  "- the fixture",
  "",
  "#### Produces",
  "",
  "- the fixture",
  "",
  "#### Steps",
  "",
  "- write it — checkable: green",
  "",
  "#### Acceptance",
  "",
  "ok",
  "",
  "#### DependsOn",
  "",
  "none",
  "",
].join("\n");

/** The fixture's design spec — the plan's same-slug identity document, doc-contract clean. */
const SPEC_TEXT = [
  "---",
  "title: Smoke Spec",
  "doc-type: phase-spec",
  "version: v1.0",
  "date: 2026-01-01",
  `slug: ${SLUG}`,
  `program: ${SLUG}-overall`,
  "status: Draft",
  "author: '[human]'",
  "parent-version: v1.0",
  "---",
  "",
  "## Design",
  "",
  "### 1. Data plane",
  "",
  "#### 1.1 Registry",
  "",
  "- text",
  "",
  "### Acceptance criteria",
  "",
  "- `c`",
  "",
  "## Constraints",
  "",
  "- delta",
  "",
  "## Change history",
  "",
  "| Version | date | summary | author |",
  "|---|---|---|---|",
  "| v1.0 | 2026-01-01 | initial | [human] |",
  "",
].join("\n");

/** The fixture's program charter — the `program:` target the spec names, with its inventory
 *  linking the spec and the plan it groups. */
const OVERALL_TEXT = [
  "---",
  "title: Smoke Overall",
  "doc-type: overall",
  "version: v1.0",
  "date: 2026-01-01",
  `slug: ${SLUG}-overall`,
  "status: Approved",
  "author: '[human]'",
  "---",
  "",
  "## Document scope",
  "scope prose",
  "",
  "## File paths",
  "",
  "| Artifact | Path |",
  "| --- | --- |",
  `| overall | docs/kairos/specs/${SLUG}-overall.md |`,
  "",
  "## Program charter",
  "",
  "### Goal",
  "",
  "- goal text",
  "",
  "### Non-goals",
  "",
  "- non-goal text",
  "",
  "### Cross-cutting",
  "",
  "- cross text",
  "",
  "## Issue inventory",
  "",
  "| Phase | Issue (ref) | Title summary |",
  "| --- | --- | --- |",
  `| ${SLUG} | #1 | the smoke phase |`,
  "",
  "## Phase inventory",
  "",
  "| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |",
  "| --- | --- | --- | --- | --- | --- | --- |",
  `| ${SLUG} | the phase | scope a | [spec](docs/kairos/specs/${SLUG}-design.md) | [plan](${PLAN}) | criteria a |  |`,
  "",
].join("\n");

/** Every path inside one directory's WORKTREE face, sorted — how "nothing was written" is
 *  read. `.git/**` is excluded because git's own bookkeeping is not the engine's write: the
 *  fixture's `git commit` lets git's auto-maintenance take `objects/maintenance.lock`
 *  between two snapshots, which would make this assertion race git instead of judging the
 *  preview. The tree is also pinned (`-c maintenance.auto=false -c gc.auto=0`), so no
 *  detached process outlives the fixture and neither side of the read is timing-dependent. */
const treeOf = (root: string): readonly string[] => {
  const out: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === ".git") continue;
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

/** Run one argv through the real entry, in `repo`. The host marker is injected because the
 *  preview's `no-host` station would otherwise refuse the forecast it is asked for. */
const smoke = (repo: string, argv: readonly string[]): SmokeReading => {
  const result = spawnSync(process.execPath, ["--experimental-strip-types", ENTRY, ...argv], {
    cwd: repo,
    encoding: "utf8",
    env: { ...process.env, CLAUDE_CODE_SESSION_ID: "smoke" },
  });
  return { stdout: result.stdout ?? "", stderr: result.stderr ?? "", code: result.status };
};

/** The fixture repository: a committed tree of the three documents the graph resolves. */
const materialize = (): string => {
  const repo = mkdtempSync(path.join(tmpdir(), "cdd-smoke-"));
  const write = (rel: string, text: string): void => {
    const absolute = path.join(repo, rel);
    mkdirSync(path.dirname(absolute), { recursive: true });
    writeFileSync(absolute, text, "utf8");
  };
  write(".gitignore", ".kairos\n");
  write(PLAN, PLAN_TEXT);
  write(`docs/kairos/specs/${SLUG}-design.md`, SPEC_TEXT);
  write(`docs/kairos/specs/${SLUG}-overall.md`, OVERALL_TEXT);
  const git = (...args: string[]): void => {
    execFileSync("git", ["-C", repo, "-c", "maintenance.auto=false", "-c", "gc.auto=0", ...args], {
      encoding: "utf8",
      stdio: "ignore",
    });
  };
  git("init", "-q");
  const identity = ["-c", "user.name=cdd-smoke", "-c", "user.email=cdd-smoke@oscaner.dev"];
  git(...identity, "add", "-A");
  git(...identity, "commit", "-qm", "fixture");
  return repo;
};

describe("the composed process answers the consumer's two faces", () => {
  it("prints the command tree's own help and exits 0", () => {
    const repo = materialize();
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
    const repo = materialize();
    try {
      const before = treeOf(repo);
      const reading = smoke(repo, ["implement", "--tasks", "1", "--plan", PLAN, "--dry-run"]);
      expect(reading.code).toBe(0);
      for (const label of ["step:", "reads:", "would write:", "would record:", "child:"]) {
        expect(reading.stdout).toContain(`  ${label}`);
      }
      // The forecast is a READ: the composed graph creates no workspace, no ledger and no
      // brief for a dispatch it never runs.
      expect(treeOf(repo)).toEqual(before);
      expect(existsSync(path.join(repo, `.kairos/cdd/${SLUG}/tasks-1-brief.md`))).toBe(false);
      expect(existsSync(path.join(repo, ".kairos"))).toBe(false);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  }, 120_000);
});

describe("the write read judges the engine's writes, never git's bookkeeping", () => {
  it("keeps a workspace write in the snapshot and drops a `.git` internal", () => {
    // The neighbour arm of the forecast case above: a snapshot that could only go green by
    // ignoring everything would not judge the preview at all. A `.kairos` entry IS an engine
    // write and stays in the read; a `.git` entry is git's own maintenance and does not.
    const dir = mkdtempSync(path.join(tmpdir(), "cdd-snapshot-"));
    try {
      mkdirSync(path.join(dir, ".git", "objects"), { recursive: true });
      mkdirSync(path.join(dir, ".kairos", "cdd"), { recursive: true });
      writeFileSync(path.join(dir, ".git", "objects", "maintenance.lock"), "", "utf8");
      writeFileSync(path.join(dir, ".kairos", "cdd", "progress.json"), "{}", "utf8");
      expect(treeOf(dir)).toEqual([".kairos", ".kairos/cdd", ".kairos/cdd/progress.json"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
