// scripts/smoke-cdd.ts — the smoke against the NEW-TREE bin: a dry-run
// consumer smoke that boots `node packages/cdd-engine/src-next/bin.ts` over a fixture
// repo and asserts the status-capsule contract (the cdd engine's single stdout face).
// The new-tree dev face runs the source entry directly (Node >=22.18 native type
// stripping) — no build/pack/install materialization (the consumer-sim pack gate is
// the old tree's publish gate; this smoke proves the new tree's CLI boots and
// dispatches dry-run rounds end-to-end).

import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { REPO_ROOT } from "./emit.ts";

/** The smoke assertion surface — one failed assert = the smoke fails loud. */
function assertOk(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`smoke: ${msg}`);
}

/** The fixture plan text — the canonical data-shaped task record (the markers the
 *  plan parser reads; the workspace slug derives `fixture` from the basename). */
function fixturePlan(): string {
  return [
    "# Fixture Plan",
    "",
    "**Spec:** [fixture-design.md](fixture-design.md)",
    "",
    "- **Parent program**: [fixture-overall.md v1.0](fixture-overall.md)",
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
}

/** The fixture design spec — the plan's **Spec:** link target (existence only). */
function fixtureSpec(): string {
  return [
    "# Fixture Design",
    "",
    "- **Version**: v1.0",
    "",
    "## Design",
    "",
    "### Acceptance criteria",
    "",
    "- the smoke chain audits clean",
    "",
  ].join("\n");
}

/** The fixture overall — the plan's **Parent program** link target (existence only). */
function fixtureOverall(): string {
  return [
    "# Fixture Overall",
    "",
    "- **Version**: v1.0",
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
}

/**
 * The smoke runner — boots the new-tree bin over a fresh fixture repo and asserts
 * the capsule contract on every dry-run dispatch. `binPath` is injectable so tests
 * run the smoke against the same entry the engine tests exercise.
 */
export class SmokeCdd {
  /** Run the whole smoke; throws on the first assertion failure. */
  run(opts: { binPath?: string } = {}): { repoRoot: string; stdout: string } {
    const binPath =
      opts.binPath ?? path.join(REPO_ROOT, "packages", "cdd-engine", "src-next", "bin.ts");
    const repoRoot = mkdtempSync(path.join(tmpdir(), "cdd-smoke-"));
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

    // The help face — the verb-scoped USAGE surface (the new-tree CLI resolves the
    // verb before the help pre-screen renders).
    const helpOut = runNode([binPath, "implement", "--help"], repoRoot);
    assertOk(
      helpOut.stdout.includes("usage: cdd implement") &&
        /implement|review|fix/.test(helpOut.stdout),
      `--help missing the USAGE face (code ${helpOut.code}) stdout=${JSON.stringify(helpOut.stdout.slice(0, 120))} stderr=${JSON.stringify(helpOut.stderr.slice(0, 120))}`,
    );

    // The dry-run work chain — implement then review, each asserting the capsule.
    let stdout = "";
    const chain = [
      ["--dry-run", "implement", "--tasks", "1", "--plan", "fixture-plan.md"],
      ["--dry-run", "review", "--type", "wave", "--tasks", "1", "--plan", "fixture-plan.md"],
    ];
    for (const args of chain) {
      const res = runNode([binPath, ...args], repoRoot);
      assertOk(
        res.code === 0,
        `dry-run ${args.slice(1, 3).join(" ")} exited ${res.code}: ${res.stderr}`,
      );
      assertCapsule(res.stdout, args.join(" "));
      stdout += res.stdout;
    }
    return { repoRoot, stdout };
  }
}

/** Run the new-tree bin in a cwd (host env injected — the harness detection sees claude). */
function runNode(args: string[], cwd: string): { code: number; stdout: string; stderr: string } {
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
}

/** The capsule contract — the last stdout block carries the status capsule + the
 *  `next:` suggestion line (the engine's single result surface). The route-face
 *  words (v1.25 dispatch-ready literals: `done` terminal · `implement wave {tasks}`
 *  · `review <type> <id> (base …)` · `fix <type> <id> --findings …` + the readback
 *  suffix · the soft-cap message) — `none` is retired. */
function assertCapsule(stdout: string, command: string): void {
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
}

function git(repo: string, ...args: string[]): void {
  execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", stdio: "ignore" });
}

/** The smoke runner singleton. */
export const smokeCdd = new SmokeCdd();
