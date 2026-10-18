// packages/cdd-engine/src-next/__tests__/smoke.integration.test.ts
// The engine smoke integration test — the consumer release gate migrated from
// scripts/smoke-cdd.ts (P5 T7): boots the source bin (`node src-next/bin.ts`) over a
// fresh fixture git repo and asserts the status-capsule contract on the dry-run
// chain (`--dry-run implement` + `--dry-run review`) plus the `--help` commander
// face. The engine carries no version assertion — `--expect-version` was withdrawn as
// a no-op (user adjudication 2026-10-12); the `smoke` script (`pnpm -C
// packages/cdd-engine run smoke`) is the release.yml gate's shared anchor.
//
// Zero module-level bare functions — the helpers are `const` (the P5
// zero-`function`-declaration discipline).

import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/** The source bin under test — the engine's own entry (spawned, never imported). */
const BIN = fileURLToPath(new URL("../bin.ts", import.meta.url));

/** The fixture plan text — the canonical data-shaped task record (the front-matter
 *  head the plan parser reads; the workspace slug derives `fixture` from the
 *  basename). */
const fixturePlan = (): string =>
  [
    "---",
    "title: Fixture Plan",
    "doc-type: plan",
    "version: v1.0",
    "date: 2026-10-09",
    "spec: fixture-design.md",
    "parent-program: fixture-overall.md",
    "parent-version: v1.0",
    "---",
    "",
    "## Constraints",
    "",
    "- Smoke fixture constraints materialized into the temp repo.",
    "",
    "### Task 1: fixture task",
    "",
    "- **Objective**: exercise the installed cdd engine under dry-run",
    "- **Files**: fixture-plan.md",
    "- **Steps**:",
    "  1. run the new-tree engine under dry-run — checkable: the dry-run chain completes",
    "- **Acceptance**:",
    "  - the dry-run chain prints the status capsule",
    "- **DependsOn**: none",
    "",
  ].join("\n");

/** The fixture design spec — the plan's `spec:` link target (existence only). */
const fixtureSpec = (): string =>
  [
    "---",
    "title: Fixture Design",
    "doc-type: phase-spec",
    "version: v1.0",
    "date: 2026-10-09",
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

/** The fixture overall — the plan's `parent-program:` link target (existence only). */
const fixtureOverall = (): string =>
  [
    "---",
    "title: Fixture Overall",
    "doc-type: overall-spec",
    "version: v1.0",
    "date: 2026-10-09",
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

/** The capsule contract — the last stdout block carries the status capsule + the
 *  `next:` suggestion line (the engine's single result surface). The route-face
 *  words (v1.25 dispatch-ready literals: `done` terminal · `implement wave {tasks}`
 *  · `review <type> <id> (base …)` · `fix <type> <id> --findings …` + the readback
 *  suffix · the soft-cap message) — `none` is retired. */
const assertCapsule = (stdout: string, command: string): void => {
  const lines = stdout.trim().split("\n");
  const capsule = lines.find((l) => l.startsWith("status:") && l.includes("blocker:"));
  assertOk(
    capsule !== undefined,
    `status capsule missing from ${command} stdout: ${JSON.stringify(stdout)}`,
  );
  assertOk(
    /^status: (APPROVED|BLOCKED|REVIEW_FIX|CHANGES_REQUESTED) · blocker: \d+ · handoff: /.test(
      capsule!,
    ),
    `status capsule malformed for ${command}: ${JSON.stringify(capsule)}`,
  );
  const next = lines.find((l) => l.startsWith("next:"));
  assertOk(
    next !== undefined && /^next: (done$|implement wave|review |fix($| )|BLOCKED:)/.test(next!),
    `next: line missing or malformed for ${command}: ${JSON.stringify(next)}`,
  );
  // Zero old-shape stdout key lines (the 4-line block is retired).
  assertOk(
    lines.every((l) => !/^(commits|artifacts|counters):/.test(l)),
    `old-shape stdout key line present for ${command}`,
  );
};

/** Run git in the fixture repo (the temp repo's commit identity is injected inline). */
const git = (repo: string, ...args: string[]): void => {
  execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", stdio: "ignore" });
};

describe("the engine smoke — the source bin dry-run chain over a fixture repo", () => {
  it("boots the bin, asserts the `--help` face + the capsule contract on the dry-run chain", () => {
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

      // The dry-run work chain — implement then review, each asserting the capsule.
      let stdout = "";
      const chain = [
        ["--dry-run", "implement", "--tasks", "1", "--plan", "fixture-plan.md"],
        ["--dry-run", "review", "--type", "wave", "--tasks", "1", "--plan", "fixture-plan.md"],
      ];
      for (const args of chain) {
        const res = runNode([BIN, ...args], repoRoot);
        assertOk(
          res.code === 0,
          `dry-run ${args.slice(1, 3).join(" ")} exited ${res.code}: ${res.stderr}`,
        );
        assertCapsule(res.stdout, args.join(" "));
        stdout += res.stdout;
      }

      // The fixture repo's workspace slug + the status capsule (the smoke.test.ts
      // assertions, migrated in place).
      expect(stdout).toContain("status:");
      expect(stdout).toContain(".kairos/cdd/fixture/");
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});
