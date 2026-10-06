// packages/cdd-engine/src/dispatch/__tests__/doc-contract-channels.test.ts — Task 3 (P2):
// the base-default docContractValidate hook effective on ALL three dispatch channels. The judgment
// lives once in DispatchLifecycle (rules/documents.ts single audit entry); each lane declares its
// audit target (task = dispatch plan · docs = the reviewed doc · branch = the --plan ref) and
// supplies its BLOCK terminal face (task #done / docs default DispatchBlocked / branch stderr +
// exitWithCode). Coverage:
//   - the four-table audit BLOCKs a real dispatch on every channel (four-table-dangling overall)
//   - docs-lane overall self-audit boundary (the reviewed doc IS an overall → its own faces run)
//   - dry-run lowers to CDD_WARN + exit 0 on every channel
//   - lineage-unresolved chains BLOCK on the spec's own face (the inheritance-point linkage — the
//     three-truth skeleton is the only assertion surface; the four tables are never audited)

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

/** Fresh git repo: the `.kairos/cdd/` workspace is gitignored (engine writes stay out of the
 * tree), the doc chain is committed → the entry gate sees a clean tree. */
function setupRepo(): string {
  const dest = mkdtempSync(path.join(tmpdir(), "cdd-dcc-"));
  writeFileSync(path.join(dest, ".gitignore"), "cdd/\n.kairos/\n*.head\n");
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

const SPEC_DIR = "docs/kairos/specs";
const PLAN_DIR = "docs/kairos/plans";
const SPEC = [
  "- **Version**: v1.0 · 2026-09-21",
  "",
  "- **Parent program**: [plan-overall.md v1.0](./plan-overall.md)",
  "",
  "## Design",
  "",
  "### Acceptance criteria",
  "",
  "- `criterion one`",
  "",
  "## Constraints",
  "",
  "- spec delta one",
  "",
].join("\n");
const PLAN = [
  "# Plan",
  "",
  "**Spec:** [plan-design.md](docs/kairos/specs/plan-design.md)",
  "",
  "## Constraints",
  "",
  "- boundary one",
  "",
  "### Task 1: x",
  "",
  "- **Objective**: task one",
  "- **Steps**:",
  "  1. implement — checkable: done",
  "- **Acceptance**:",
  "  - done",
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
  ctxRepoRoot: string | null = repo,
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
    // ctxRepoRoot null → the engine ctx is root-LESS while resolution runs off opts.root (the task
    // lane's dual-root fallback in the constructor) — the C3-a missing-root lane's only reachable
    // task-face entry (the branch tests seed the same split).
    ctx: { mode: "review", repoRoot: ctxRepoRoot, handoffPath: "", dryRun },
  });
  try {
    await lc.run();
  } finally {
    cap.restore();
  }
  return { exitCode: lc.result.exitCode, diagnostic: lc.diagnostic, stderr: cap.text };
}

describe("task channel — the base-default docContractValidate (four-table audit active)", () => {
  it("four-table-dangling overall (face ③) → BLOCKED exit 1 + structure-plane guidance (the graph-token membership rides the overall rule plane at the gate)", async () => {
    const repo = setupRepo();
    writeChain(repo, DANGLING_OVERALL);
    const r = await runTaskReview(repo);
    expect(r.exitCode).toBe(1);
    expect(r.diagnostic?.prefix).toBe("CDD_BLOCKED");
    expect(r.diagnostic?.msg).toMatch(/doc contract validation failed/);
    expect(r.diagnostic?.msg).toContain("overall.graphTarget");
    expect(r.diagnostic?.msg).toContain("dangling graph token");
  });

  it("clean four tables → the gate passes and the round proceeds (dry-run APPROVED stub)", async () => {
    const repo = setupRepo();
    writeChain(repo);
    const r = await runTaskReview(repo, true);
    expect(r.exitCode).toBe(0);
    expect(r.stderr).not.toContain("doc contract invalid");
  });

  // ---- Missing-root dual lane (T6 C3-a) — task face: real → CDD_BLOCKED + exit 1; dry-run → WARN ----
  // The task channel's docContractBlocked override is a NON-THROWING #done terminal (task.ts), so the
  // base missing-root WARN write must be structurally dry-run-only (base's if/else): a real-mode
  // fall-through would print the "skipped" WARN beside the CDD_BLOCKED diagnostic — the dual-signal
  // defect this pair guards (the branch face throws exitWithCode and never reaches the WARN line).
  it("缺根 + 真实 mode → CDD_BLOCKED diagnostic + exit 1，无缺根 WARN（task face 非抛出 #done 终态）", async () => {
    const repo = setupRepo();
    writeChain(repo); // chain valid — the missing-root lane fires BEFORE the audit resolves it
    const r = await runTaskReview(repo, false, null);
    expect(r.exitCode).toBe(1);
    expect(r.diagnostic?.prefix).toBe("CDD_BLOCKED");
    expect(r.diagnostic?.msg).toMatch(/doc contract validation failed/);
    expect(r.diagnostic?.msg).toContain("no repo root");
    expect(r.stderr).not.toContain("doc contract validation skipped (no repo root)");
  });

  it("缺根 + dry-run → CDD_WARN 保留 + 收口 exit 0（I7: dry-run 永不阻塞）", async () => {
    const repo = setupRepo();
    writeChain(repo);
    const r = await runTaskReview(repo, true, null);
    expect(r.exitCode).toBe(0);
    expect(r.stderr).toContain("CDD_WARN: doc contract validation skipped (no repo root)");
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
      dryRun,
    });
  } catch (e) {
    if (e instanceof ExitRequested) exitCode = e.code;
    else throw e;
  }
  return exitCode ?? 0;
}

describe("docs channel — the base-default docContractValidate (audits the reviewed doc's chain)", () => {
  it("reviewing a spec whose parent overall's four tables are dangling → BLOCKED exit 1 (structure-plane guidance — the graph-token membership rides the overall rule plane)", async () => {
    const dir = setupRepo();
    writeChain(dir, DANGLING_OVERALL);
    const cap = captureStderr();
    try {
      const exitCode = await runDocs(
        dir,
        path.join(dir, SPEC_DIR, "plan-design.md"),
        path.join(dir, ".kairos", "cdd", "plan", "spec-review-1.json"),
      );
      expect(exitCode).toBe(1);
      expect(cap.text).toMatch(/CDD_BLOCKED: doc contract validation failed/);
      expect(cap.text).toContain("- [structure] overall.graphTarget");
      expect(cap.text).toContain("dangling graph token");
    } finally {
      cap.restore();
    }
  });

  it("docs-lane overall self-audit boundary: the reviewed doc IS the overall → its own four tables run (the structure-plane gate fires on the entry)", async () => {
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
        path.join(dir, ".kairos", "cdd", "broken", "spec-review-1.json"),
      );
      expect(exitCode).toBe(1);
      expect(cap.text).toMatch(/CDD_BLOCKED: doc contract validation failed/);
      expect(cap.text).toContain("- [structure] overall.graphTarget");
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
        path.join(dir, ".kairos", "cdd", "plan", "spec-review-1.json"),
        { dryRun: true },
      );
      expect(exitCode).toBe(0);
      expect(cap.text).toMatch(/CDD_WARN: doc structure invalid \(dry-run\)/);
    } finally {
      cap.restore();
    }
  });

  it("fail-open lane differentiates the unknown-doc-kind case (readable but unclassifiable chain)", async () => {
    const dir = setupRepo();
    mkdirSync(path.join(dir, SPEC_DIR), { recursive: true });
    // A readable file no registered doc type detects — the retired spec fallback's zero-hit throw
    // (spec 2.6) flows into the doc-contract gate's fail-open WARN lane with the differentiated
    // label, not the "unreadable doc chain" label reserved for genuinely unreadable chains.
    const plain = path.join(dir, SPEC_DIR, "plain.md");
    writeFileSync(plain, "# no doc-structure features\n");
    git(dir, "add", "-A");
    git(
      dir,
      "-c",
      "user.name=dcc-test",
      "-c",
      "user.email=dcc-test@example.com",
      "commit",
      "-qm",
      "plain",
    );
    const cap = captureStderr();
    try {
      const exitCode = await runDocs(
        dir,
        plain,
        path.join(dir, ".kairos", "cdd", "plain", "spec-review-1.json"),
        { dryRun: true },
      );
      expect(exitCode).toBe(0); // fail-open: the gate never crashes the lifecycle
      expect(cap.text).toContain(
        "CDD_WARN: doc contract validation skipped (no registered doc type detects the doc chain)",
      );
      expect(cap.text).not.toContain("unreadable doc chain");
      expect(cap.text).toContain("unknown doc kind for entry");
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
  it("four-table-dangling parent overall → BLOCKED exit 1 + structure-plane guidance (no handoff written)", async () => {
    const dir = setupRepo();
    writeChain(dir, DANGLING_OVERALL);
    const r = await runBranch(dir, path.join(dir, PLAN_DIR, "plan.md"));
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/CDD_BLOCKED: doc contract validation failed/);
    expect(r.stderr).toContain("overall.graphTarget");
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

  // ---- Missing-root dual lane (T6 C3-a): real → CDD_BLOCKED + exit 1; dry-run → WARN kept ----
  // The base-default docContractValidate refuses to silently skip the audit on a root-less ctx:
  // real mode hard-BLOCKs (no missing-root WARN + exit-0 idle), dry-run keeps the WARN lane (I7). The
  // branch face = stderr CDD_BLOCKED + exitWithCode(1) (docContractBlocked override).
  it("缺根 + 真实 mode → CDD_BLOCKED + exit 1（branch face；缺根 WARN 不空转）", async () => {
    const dir = setupRepo();
    writeChain(dir); // chain valid — the missing-root lane fires BEFORE the audit resolves it
    const cap = captureStderr();
    let exitCode: number | null = null;
    try {
      const lc = new BranchReviewLifecycle({
        harness: "ctr",
        type: "branch",
        plan: path.join(dir, PLAN_DIR, "plan.md"),
        base: "a".repeat(40),
        head: "b".repeat(40),
        root: dir, // resolveContext's own root (workspace/invoke) — the engine ctx stays root-less
        registryPath: registry(),
        dryRun: false,
        ctx: { mode: "branch-review", repoRoot: null, dryRun: false },
      });
      await lc.run();
    } catch (e) {
      if (e instanceof ExitRequested) exitCode = e.code;
      else throw e;
    } finally {
      cap.restore();
    }
    expect(exitCode).toBe(1);
    expect(cap.text).toContain("CDD_BLOCKED");
    expect(cap.text).not.toContain("doc contract validation skipped (no repo root)");
  });

  it("缺根 + dry-run → CDD_WARN 保留 + 收口 exit 0（I7: dry-run 永不阻塞）", async () => {
    const dir = setupRepo();
    writeChain(dir);
    const cap = captureStderr();
    let exitCode: number | null = null;
    try {
      const lc = new BranchReviewLifecycle({
        harness: "ctr",
        type: "branch",
        plan: path.join(dir, PLAN_DIR, "plan.md"),
        base: "a".repeat(40),
        head: "b".repeat(40),
        root: dir,
        registryPath: registry(),
        dryRun: true,
        ctx: { mode: "branch-review", repoRoot: null, dryRun: true },
      });
      await lc.run();
    } catch (e) {
      if (e instanceof ExitRequested) exitCode = e.code;
      else throw e;
    } finally {
      cap.restore();
    }
    expect(exitCode).toBe(0);
    expect(cap.text).toContain("CDD_WARN: doc contract validation skipped (no repo root)");
  });
});

describe("lineage-unresolved — the spec's own face fails (the inheritance-point linkage); four tables never audited", () => {
  it("task: a spec chain with no Parent program fails the gate (dry-run WARN — the legacy truncation no-op is gone)", async () => {
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
    expect(r.exitCode).toBe(0); // dry-run never blocks
    expect(r.stderr).toContain("CDD_WARN: doc contract invalid (dry-run)");
    expect(r.stderr).toContain("`**Parent program**`"); // the spec's own face fails — never the overall
    expect(r.stderr).not.toContain("plan-overall.md"); // the four tables were never audited
  });
});
