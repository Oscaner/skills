// packages/cdd-engine/src-next/__tests__/smoke.integration.test.ts
// The engine smoke integration test — the consumer release gate migrated from
// scripts/smoke-cdd.ts (P5 T7): boots the source bin (`node src-next/bin.ts`) over a
// fresh fixture git repo and asserts the `--help` commander face plus the read-only
// `--dry-run` preview (the five-row next-step forecast at zero repo writes). The engine
// carries no version assertion — `--expect-version` was withdrawn as a no-op (user
// adjudication 2026-10-12); the `smoke` script (`pnpm -C packages/cdd-engine run smoke`)
// is the release.yml gate's shared anchor.
//
// Zero module-level bare functions — the helpers are `const` (the P5
// zero-`function`-declaration discipline).

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "vitest";

/** The source bin under test — the engine's own entry (spawned, never imported). */
const BIN = fileURLToPath(new URL("../bin.ts", import.meta.url));

/** The fixture plan text — the canonical data-shaped task record (the front-matter
 *  head the plan parser reads; the workspace slug is the declared `slug:`). */
const fixturePlan = (): string =>
  [
    "---",
    "title: Fixture Plan",
    "doc-type: plan",
    "version: v1.0",
    "date: 2026-10-09",
    "slug: fixture",
    "---",
    "",
    "## Constraints",
    "",
    "- Smoke fixture constraints materialized into the temp repo.",
    "",
    "### Task 1: fixture task",
    "",
    "- **Objective**: exercise the installed cdd engine under the read-only preview",
    "- **Files**: fixture-plan.md",
    "- **Steps**:",
    "  1. run the new-tree engine under `--dry-run` — checkable: the preview block completes",
    "- **Acceptance**:",
    "  - the preview forecasts the next step with zero repo writes",
    "- **DependsOn**: none",
    "",
  ].join("\n");

/** The fixture design spec — the same-slug identity document paired with the plan. */
const fixtureSpec = (): string =>
  [
    "---",
    "title: Fixture Design",
    "doc-type: phase-spec",
    "version: v1.0",
    "date: 2026-10-09",
    "slug: fixture",
    "program: fixture-overall",
    "status: Draft",
    "---",
    "",
    "## Design",
    "",
    "### Acceptance criteria",
    "",
    "- the smoke chain audits clean",
    "",
  ].join("\n");

/** The fixture overall — the phase-spec's `program:` reference target (identity only). */
const fixtureOverall = (): string =>
  [
    "---",
    "title: Fixture Overall",
    "doc-type: overall-spec",
    "version: v1.0",
    "date: 2026-10-09",
    "slug: fixture-overall",
    "status: Draft",
    "---",
    "",
    "## Phase inventory",
    "",
    "| # | Phase | Status | []",
    "|---|-------|--------|-----|",
    "",
    "",
  ]
    .join("\n")
    .trimEnd();

/** The smoke assertion surface — one failed assert = the smoke fails loud. */
const assertOk = (cond: boolean, msg: string): void => {
  if (!cond) throw new Error(`smoke: ${msg}`);
};

/** Run the source bin in a cwd (host env injected — the harness detection sees claude). */
const runNode = (args: string[], cwd: string): { code: number; stdout: string; stderr: string } => {
  const res = spawnSync(process.execPath, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, CLAUDE_CODE_SESSION_ID: "1" },
    timeout: 120_000,
  });
  return {
    code: res.status ?? 1,
    stdout: (res.stdout ?? "") as string,
    stderr: (res.stderr ?? "") as string,
  };
};

/** Run git in the fixture repo (the temp repo's commit identity is injected inline). */
const git = (repo: string, ...args: string[]): void => {
  execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", stdio: "ignore" });
};

describe("the engine smoke — the source bin over a fixture repo", () => {
  it("boots the bin, asserts the `--help` face + the read-only `--dry-run` preview (zero writes)", () => {
    const repoRoot = mkdtempSync(path.join(tmpdir(), "cdd-smoke-"));
    try {
      writeFileSync(path.join(repoRoot, ".gitignore"), ".kairos\n");
      writeFileSync(path.join(repoRoot, "fixture-plan.md"), fixturePlan(), "utf8");
      writeFileSync(path.join(repoRoot, "fixture-design.md"), fixtureSpec(), "utf8");
      writeFileSync(path.join(repoRoot, "fixture-overall.md"), fixtureOverall(), "utf8");
      git(repoRoot, "init", "-q");
      git(
        repoRoot,
        "-c",
        "user.name=cdd-smoke",
        "-c",
        "user.email=cdd-smoke@oscaner.dev",
        "add",
        "-A",
      );
      git(
        repoRoot,
        "-c",
        "user.name=cdd-smoke",
        "-c",
        "user.email=cdd-smoke@oscaner.dev",
        "commit",
        "-qm",
        "fixture",
      );

      // The help face — the commander-native program face (the T4 stable anchor): the
      // native Usage first line + the command-table rows (the new-tree CLI's --help is
      // the commander program face — `Usage: cdd [options] [command]` + the
      // `implement [options]` / `review [options]` / `fix [options]` rows).
      const helpOut = runNode([BIN, "--help"], repoRoot);
      assertOk(
        helpOut.stdout.includes("Usage: cdd [options] [command]") &&
          ["implement", "review", "fix"].every((name) =>
            helpOut.stdout.includes(`${name} [options]`),
          ),
        `--help missing the commander-native face (code ${helpOut.code}) stdout=${JSON.stringify(helpOut.stdout.slice(0, 120))} stderr=${JSON.stringify(helpOut.stderr.slice(0, 120))}`,
      );

      // The `--dry-run` read-only preview — the release gate's zero-write face: the
      // next dispatch step is forecast in five rows and nothing is written. The
      // retired synthetic bookkeeping (a booked round + a fabricated capsule) is
      // gone: a preview states the step, never a conclusion.
      const preview = runNode(
        [BIN, "--dry-run", "implement", "--tasks", "1", "--plan", "fixture-plan.md"],
        repoRoot,
      );
      assertOk(preview.code === 0, `--dry-run implement exited ${preview.code}: ${preview.stderr}`);
      assertOk(
        preview.stdout.startsWith("cdd implement: preview (no repo changes)\n"),
        `preview header missing: ${JSON.stringify(preview.stdout)}`,
      );
      for (const label of ["step:", "reads:", "would write:", "would record:", "child:"])
        assertOk(preview.stdout.includes(`  ${label} `), `preview row ${label} missing`);
      // a preview fabricates no conclusion and no next hop
      assertOk(!preview.stdout.includes("status:"), "preview must not print a status: line");
      assertOk(!/^next:/m.test(preview.stdout), "preview must not print a next: line");
      // zero repo writes — the engine workspace (and its slug) never appear
      assertOk(!existsSync(path.join(repoRoot, ".kairos")), ".kairos/ must stay absent");
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});
