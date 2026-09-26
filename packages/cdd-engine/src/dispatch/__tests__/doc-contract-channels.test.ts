// packages/cdd-engine/src/dispatch/__tests__/doc-contract-channels.test.ts — Task 3 (P2):
// the base-default docContractValidate hook effective on ALL three dispatch channels. The judgment
// lives once in DispatchLifecycle (rules/documents.ts single audit entry); each lane declares its
// audit target (task = dispatch plan · docs = the reviewed doc · branch = the --plan ref) and
// supplies its BLOCK terminal face (task #done / docs default DispatchBlocked / branch stderr +
// exitWithCode). Coverage:
//   - the four-table audit BLOCKs a real dispatch on every channel (four-table-dangling overall)
//   - docs-lane overall self-audit boundary (the reviewed doc IS an overall → its own faces run)
//   - dry-run lowers to CDD_WARN + exit 0 on every channel
//   - lineage-unresolved chains pass (four tables no-op, necessary subset only)

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BranchReviewLifecycle } from "../branch.ts";

/**
 * Inline branch-review dispatch (Task 6: the former cli/branch-review.ts thin shell merged into the composition root —
 * tests construct BranchReviewLifecycle directly, exactly like cli/review.ts).
 */
async function runBranchReviewLc(opts: {
  harness: string;
  type: string;
  plan: string;
  base: string;
  head: string;
  root?: string;
  registryPath?: string;
}): Promise<void> {
  const dryRun = false;
  const lc = new BranchReviewLifecycle({
    ...opts,
    dryRun,
    ctx: { mode: "branch-review", repoRoot: opts.root ?? null, dryRun },
  });
  await lc.run();
}

import { TaskGroup } from "../../domain/task-group.ts";
import { captureStderr } from "../../infra/__tests__/helpers.ts";
import { ExitRequested } from "../../infra/exit.ts";
import { REG_PATH } from "../../infra/registry.ts";
import { DocsLifecycle } from "../docs.ts";
import { TaskLifecycle } from "../task.ts";

function git(repo: string, ...args: string[]) {
  return execFileSync("git", ["-C", repo, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

/** Fresh git repo: the `.osuperpowers/cdd/` workspace is gitignored (engine writes stay out of the
 * tree), the doc chain is committed → the entry gate sees a clean tree. */
function setupRepo(): string {
  const dest = mkdtempSync(path.join(tmpdir(), "cdd-dcc-"));
  writeFileSync(path.join(dest, ".gitignore"), "cdd/\n.osuperpowers/\n*.head\n");
  git(dest, "init", "-q");
  git(dest, "add", "-A");
  git(
    dest,
    "-c",
    "user.name=dcc-test",
    "-c",
    "user.email=dcc-test@example.com",
    "commit",
    "--allow-empty",
    "-qm",
    "fixture",
  );
  return dest;
}

/** Registry copy outside the repo (an untracked registry.json inside would dirty the tree). cli
 * "env" resolves on PATH so a REAL dispatch passes the checkHarness probe (dispatch never runs —
 * the doc-contract gate fires pre-flight). */
function registry(deps: Record<string, unknown> = {}): string {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-dcc-reg-"));
  const regPath = path.join(dir, "registry.json");
  const reg = JSON.parse(readFileSync(REG_PATH, "utf8")) as Record<string, unknown>;
  (reg as Record<string, unknown>).ctr = {
    cli: "env",
    invoke: "-p",
    output: "text",
    ship: "full",
    ...deps,
  };
  writeFileSync(regPath, JSON.stringify(reg));
  return regPath;
}

const SPEC_DIR = "docs/osuperpowers/specs";
const PLAN_DIR = "docs/osuperpowers/plans";
const SPEC = [
  "- **Version**: v1.0 · 2026-09-21",
  "",
  "- **Parent program**: [plan-overall.md v1.0](./plan-overall.md)",
  "",
].join("\n");
const PLAN = [
  "# Plan",
  "",
  "**Spec:** [plan-design.md](docs/osuperpowers/specs/plan-design.md)",
  "",
  "## Constraints",
  "",
  "- boundary one",
  "",
  "### Task 1: x",
  "body",
  "",
].join("\n");

// A four-table-CLEAN overall (all faces pass) plus a DOCTORED overall with a dangling dependency
// graph token (face ③ illegal state) — the per-channel BLOCK fixture.
const CLEAN_OVERALL = [
  "- **Version**: v1.0 · 2026-09-21",
  "",
  "## Phase inventory",
  "",
  "| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |",
  "|---|---|---|---|---|---|---|",
  "| P1 | phase one | [Pending] | Pending | | none |",
  "",
  "## Dependency graph (ASCII)",
  "",
  "```",
  "P1",
  "```",
  "",
  "## Change history",
  "",
  "| Version | date | summary |",
  "|---|---|---|",
  "| v1.0 | 2026-09-21 | Initial |",
  "",
].join("\n");
const DANGLING_OVERALL = CLEAN_OVERALL.replace("\n```\nP1\n```", "\n```\nP1 -> P9\n```");

/** write the committed doc chain; `overallBody` selects the four-table state (clean default). */
function writeChain(repo: string, overallBody: string = CLEAN_OVERALL): void {
  mkdirSync(path.join(repo, SPEC_DIR), { recursive: true });
  mkdirSync(path.join(repo, PLAN_DIR), { recursive: true });
  writeFileSync(path.join(repo, PLAN_DIR, "plan.md"), PLAN);
  writeFileSync(path.join(repo, SPEC_DIR, "plan-design.md"), SPEC);
  writeFileSync(path.join(repo, SPEC_DIR, "plan-overall.md"), overallBody);
  git(repo, "add", "-A");
  git(
    repo,
    "-c",
    "user.name=dcc-test",
    "-c",
    "user.email=dcc-test@example.com",
    "commit",
    "-qm",
    "docs",
  );
}

// ---- task channel ----

async function runTaskReview(
  repo: string,
  dryRun = false,
): Promise<{
  exitCode: number;
  diagnostic: { prefix: string; msg: string } | null;
  stderr: string;
}> {
  const cap = captureStderr();
  const lc = new TaskLifecycle({
    harness: "ctr",
    group: TaskGroup.fromNumbers([1]),
    opts: {
      mode: "review",
      dryRun,
      noExit: true,
      root: repo,
      planFile: path.join(PLAN_DIR, "plan.md"),
      registryPath: registry(),
    },
    ctx: { mode: "review", repoRoot: repo, handoffPath: "", dryRun },
  });
  try {
    await lc.run();
  } finally {
    cap.restore();
  }
  return { exitCode: lc.result.exitCode, diagnostic: lc.diagnostic, stderr: cap.text };
}

describe("task channel — the base-default docContractValidate (four-table audit active)", () => {
  it("four-table-dangling overall (face ③) → BLOCKED exit 1 + guidance", async () => {
    const repo = setupRepo();
    writeChain(repo, DANGLING_OVERALL);
    const r = await runTaskReview(repo);
    expect(r.exitCode).toBe(1);
    expect(r.diagnostic?.prefix).toBe("CDD_BLOCKED");
    expect(r.diagnostic?.msg).toMatch(/doc contract validation failed/);
    expect(r.diagnostic?.msg).toContain("Dependency graph");
    expect(r.diagnostic?.msg).toContain("P9");
  });

  it("clean four tables → the gate passes and the round proceeds (dry-run APPROVED stub)", async () => {
    const repo = setupRepo();
    writeChain(repo);
    const r = await runTaskReview(repo, true);
    expect(r.exitCode).toBe(0);
    expect(r.stderr).not.toContain("doc contract invalid");
  });
});

// ---- docs channel ----

/** Run a docs dispatch in-process; a gate block surfaces as ExitRequested (runDocsTask throws it). */
async function runDocs(
  dir: string,
  doc: string,
  handoffPath: string,
  { dryRun = false } = {},
): Promise<number> {
  let exitCode: number | null = null;
  try {
    await DocsLifecycle.run({
      harness: "ctr",
      mode: "review",
      template: "review",
      type: "spec",
      doc,
      handoffPath,
      repoRoot: dir,
      registryPath: registry(),
      dryRun,
    });
  } catch (e) {
    if (e instanceof ExitRequested) exitCode = e.code;
    else throw e;
  }
  return exitCode ?? 0;
}

describe("docs channel — the base-default docContractValidate (audits the reviewed doc's chain)", () => {
  it("reviewing a spec whose parent overall's four tables are dangling → BLOCKED exit 1", async () => {
    const dir = setupRepo();
    writeChain(dir, DANGLING_OVERALL);
    const cap = captureStderr();
    try {
      const exitCode = await runDocs(
        dir,
        path.join(dir, SPEC_DIR, "plan-design.md"),
        path.join(dir, ".osuperpowers", "cdd", "plan", "spec-review-1.json"),
      );
      expect(exitCode).toBe(1);
      expect(cap.text).toMatch(/CDD_BLOCKED: doc contract validation failed/);
      expect(cap.text).toContain("P9");
    } finally {
      cap.restore();
    }
  });

  it("docs-lane overall self-audit boundary: the reviewed doc IS the overall → its own four tables run", async () => {
    const dir = setupRepo();
    // The chain is clean except the overall self-audit target: a separate broken overall document
    // committed (the entry gate requires a clean tree before the audit runs).
    writeChain(dir);
    const brokenOverall = path.join(dir, SPEC_DIR, "broken-overall.md");
    writeFileSync(brokenOverall, DANGLING_OVERALL);
    git(dir, "add", "-A");
    git(
      dir,
      "-c",
      "user.name=dcc-test",
      "-c",
      "user.email=dcc-test@example.com",
      "commit",
      "-qm",
      "self-audit",
    );
    const cap = captureStderr();
    try {
      const exitCode = await runDocs(
        dir,
        brokenOverall,
        path.join(dir, ".osuperpowers", "cdd", "broken", "spec-review-1.json"),
      );
      expect(exitCode).toBe(1);
      expect(cap.text).toMatch(/CDD_BLOCKED: doc contract validation failed/);
      expect(cap.text).toContain("broken-overall.md");
    } finally {
      cap.restore();
    }
  });

  it("dry-run: four-table-dangling chain → CDD_WARN + exit 0 (E2② precedent)", async () => {
    const dir = setupRepo();
    writeChain(dir, DANGLING_OVERALL);
    const cap = captureStderr();
    try {
      const exitCode = await runDocs(
        dir,
        path.join(dir, SPEC_DIR, "plan-design.md"),
        path.join(dir, ".osuperpowers", "cdd", "plan", "spec-review-1.json"),
        { dryRun: true },
      );
      expect(exitCode).toBe(0);
      expect(cap.text).toMatch(/CDD_WARN: doc contract invalid \(dry-run\)/);
    } finally {
      cap.restore();
    }
  });
});

// ---- branch channel ----

async function runBranch(
  dir: string,
  planPath: string,
): Promise<{ exitCode: number; stderr: string }> {
  const cap = captureStderr();
  let exitCode: number | null = null;
  try {
    await runBranchReviewLc({
      harness: "ctr",
      type: "branch",
      plan: planPath,
      base: "a".repeat(40),
      head: "b".repeat(40),
      root: dir,
      registryPath: registry(),
    });
  } catch (e) {
    if (e instanceof ExitRequested) exitCode = e.code;
    else throw e;
  } finally {
    cap.restore();
  }
  return { exitCode: exitCode ?? 0, stderr: cap.text };
}

describe("branch channel — the base-default docContractValidate (audits its `--plan` ref)", () => {
  it("four-table-dangling parent overall → BLOCKED exit 1 + guidance (no handoff written)", async () => {
    const dir = setupRepo();
    writeChain(dir, DANGLING_OVERALL);
    const r = await runBranch(dir, path.join(dir, PLAN_DIR, "plan.md"));
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/CDD_BLOCKED: doc contract validation failed/);
    expect(r.stderr).toContain("Dependency graph");
  });

  it("clean chain → the doc gate passes (no doc-contract BLOCK; the round fails downstream, never the gate face)", async () => {
    const dir = setupRepo();
    writeChain(dir);
    const cap = captureStderr();
    let exitCode: number | null = null;
    try {
      await runBranchReviewLc({
        harness: "ctr",
        type: "branch",
        plan: path.join(dir, PLAN_DIR, "plan.md"),
        base: "a".repeat(40),
        head: "b".repeat(40),
        root: dir,
        registryPath: registry(),
      });
    } catch (e) {
      if (e instanceof ExitRequested) exitCode = e.code;
      else throw e;
    } finally {
      cap.restore();
    }
    // The gate passed; the round then fails for the AGENT's sake (`env` produced no handoff —
    // exit 1 "handoff not written"), never for the doc contract.
    expect(cap.text).not.toContain("doc contract validation failed");
    expect(exitCode).not.toBeNull();
  });
});

describe("lineage-unresolved — four tables no-op, the necessary subset still gated per-channel", () => {
  it("task: a spec chain with no Parent program passes the gate (no WARN, clean dry-run)", async () => {
    const repo = setupRepo();
    mkdirSync(path.join(repo, SPEC_DIR), { recursive: true });
    mkdirSync(path.join(repo, PLAN_DIR), { recursive: true });
    writeFileSync(path.join(repo, PLAN_DIR, "plan.md"), PLAN);
    writeFileSync(
      path.join(repo, SPEC_DIR, "plan-design.md"),
      "- **Version**: v1.0 · 2026-09-21\n",
    );
    writeFileSync(path.join(repo, SPEC_DIR, "plan-overall.md"), "not a doc at all"); // never read — the lineage truncates
    git(repo, "add", "-A");
    git(
      repo,
      "-c",
      "user.name=dcc-test",
      "-c",
      "user.email=dcc-test@example.com",
      "commit",
      "-qm",
      "truncated",
    );
    const r = await runTaskReview(repo, true);
    expect(r.exitCode).toBe(0);
    expect(r.stderr).not.toContain("doc contract invalid"); // four tables never audited
  });
});
