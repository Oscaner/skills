// packages/cdd-engine/src/dispatch/__tests__/closeout-channels.test.ts — P2 Task 4: the closeout
// terminal-debt hard gate + the base-default statusValidate highlight, black-boxed on the dispatch
// channels. The judgment lives once in DispatchLifecycle (base default), consuming the single
// closeout mismatch module (rules/closeout.ts); each lane contributes only its plan-bearing
// declaration (task/branch = the dispatch plan · docs = the default null — the source-absent no-op).
//
// Coverage (v1.12 时序模型):
//   - pre-flight: plan-complete ∧ unbackfilled overall → plan-bearing lanes BLOCKED + the
//     先 backfill-overall guidance (task + branch; branch-review 前置义务 — the v1.11 lane
//     boundary is rescinded, NOT a branch exemption)
//   - pre-flight: the docs channel (the backfill edit path) passes the debt face — the engine
//     terminal-state source is absent there (声明源缺席, non-exemption)
//   - post-flight: plan-complete ∧ debt → stdout CDD_CLOSEOUT highlight, exit unchanged
//   - fresh checkout (no progress.json anywhere) → zero false positives
//   - 已回填 → the gate clears at both channels (happy path; a partial backfill stays a structural
//     failure — the claim/column bidirectional face)
//
// The program fixtures + engine-workspace writers live in rules/__tests__/closeout-fixtures.ts
// (shared with the closeout rule-unit suite — single source, no drift between the two faces).

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveWorkspace } from "../../artifacts/handoff/naming.ts";
import { runBranchReview } from "../../cli/branch-review.ts";
import { captureStderr, captureStdout } from "../../infra/__tests__/helpers.ts";
import { ExitRequested } from "../../infra/exit.ts";
import { REG_PATH } from "../../infra/registry.ts";
import {
  OVERALL_BACKFILLED,
  OVERALL_CLEAN,
  type Program,
  writeCompletePlanWorkspace,
  writeInFlightPlanWorkspace,
  writeProgramDocs,
} from "../../rules/__tests__/closeout-fixtures.ts";
import { type DispatchHookContext, DispatchLifecycle } from "../base.ts";
import { runDocsTask } from "../docs.ts";
import { TaskLifecycle } from "../task.ts";

function git(repo: string, ...args: string[]) {
  return execFileSync("git", ["-C", repo, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

/** Fresh git repo: the `.osuperpowers/cdd/` workspace is gitignored (the engine's progress/handoff
 *  writes stay out of the tree), the doc chain is committed → the entry gate sees a clean tree. */
function setupRepo(): string {
  const dest = mkdtempSync(path.join(tmpdir(), "cdd-closeout-ch-"));
  writeFileSync(path.join(dest, ".gitignore"), "cdd/\n.osuperpowers/\n*.head\n");
  git(dest, "init", "-q");
  git(dest, "add", "-A");
  git(
    dest,
    "-c",
    "user.name=cc-test",
    "-c",
    "user.email=cc-test@example.com",
    "commit",
    "--allow-empty",
    "-qm",
    "fixture",
  );
  return dest;
}

/** Registry copy outside the repo (an untracked registry.json inside would dirty the tree). cli
 * "env" resolves on PATH so a REAL dispatch passes the checkHarness probe (dispatch never runs for
 * the BLOCKED faces — the gate fires pre-flight). */
function registry(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-closeout-reg-"));
  const regPath = path.join(dir, "registry.json");
  const reg = JSON.parse(readFileSync(REG_PATH, "utf8")) as Record<string, unknown>;
  (reg as Record<string, unknown>).ctr = { cli: "env", invoke: "-p", output: "text", ship: "full" };
  writeFileSync(regPath, JSON.stringify(reg));
  return regPath;
}

// ---- program-shaped fixtures (shared with the rule-unit suite — single source) ----

/** write + commit the program chain (fixtures land in git — the entry gate needs a clean tree);
 *  `overallBody` selects the backfill state (clean default). */
function writeProgram(repo: string, overallBody: string = OVERALL_CLEAN): Program {
  const p = writeProgramDocs(repo, overallBody);
  git(repo, "add", "-A");
  git(
    repo,
    "-c",
    "user.name=cc-test",
    "-c",
    "user.email=cc-test@example.com",
    "commit",
    "-qm",
    "docs",
  );
  return p;
}

async function runTaskReview(
  repo: string,
  planFile: string,
  dryRun = false,
): Promise<{
  exitCode: number;
  diagnostic: { prefix: string; msg: string } | null;
  stderr: string;
}> {
  const cap = captureStderr();
  const lc = new TaskLifecycle({
    harness: "ctr",
    tasks: [1],
    opts: { mode: "review", dryRun, noExit: true, root: repo, planFile, registryPath: registry() },
    ctx: { mode: "review", repoRoot: repo, handoffPath: "", dryRun },
  });
  try {
    await lc.run();
  } finally {
    cap.restore();
  }
  return { exitCode: lc.result.exitCode, diagnostic: lc.diagnostic, stderr: cap.text };
}

async function runBranch(
  dir: string,
  planPath: string,
): Promise<{ exitCode: number; stderr: string }> {
  const cap = captureStderr();
  let exitCode: number | null = null;
  try {
    await runBranchReview({
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

async function runDocs(
  dir: string,
  doc: string,
  handoffPath: string,
  { dryRun = false } = {},
): Promise<number> {
  let exitCode: number | null = null;
  try {
    await runDocsTask({
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

describe("pre-flight terminal-debt gate — plan-bearing lanes BLOCK (v1.12: 回填 = branch-review 前置义务)", () => {
  it("task channel: plan complete + overall unbackfilled → BLOCKED exit 1 + 先 backfill-overall guidance", async () => {
    const repo = setupRepo();
    const p = writeProgram(repo);
    writeCompletePlanWorkspace(repo, p.plan1);
    const r = await runTaskReview(repo, p.plan1);
    expect(r.exitCode).toBe(1);
    expect(r.diagnostic?.prefix).toBe("CDD_BLOCKED");
    expect(r.diagnostic?.msg).toMatch(/doc contract validation failed/);
    expect(r.diagnostic?.msg).toContain("backfill-overall");
    expect(r.diagnostic?.msg).toContain("P1");
  });

  it("branch channel: plan complete + overall unbackfilled → BLOCKED exit 1 (no branch exemption — v1.11 lane boundary rescinded)", async () => {
    const repo = setupRepo();
    const p = writeProgram(repo);
    writeCompletePlanWorkspace(repo, p.plan1);
    const r = await runBranch(repo, p.plan1);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/CDD_BLOCKED: doc contract validation failed/);
    expect(r.stderr).toContain("backfill-overall");
    expect(r.stderr).toContain("P1");
  });

  it("cross-phase debt: the dispatch's OWN plan is in-flight but a SIBLING phase (P1) is complete-unbackfilled → the gate still BLOCKS (跨 phase 欠账)", async () => {
    const repo = setupRepo();
    const p = writeProgram(repo);
    writeCompletePlanWorkspace(repo, p.plan1); // a complete unbackfilled phase-one plan
    writeInFlightPlanWorkspace(repo, p.plan2); // the dispatched phase-two plan — in-flight, no self-debt
    const r = await runBranch(repo, p.plan2);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain("backfill-overall");
    expect(r.stderr).toContain("P1"); // the debt belongs to the SIBLING phase
  });

  it("docs channel: the backfill edit path passes the debt face (engine terminal source absent — 非豁免)", async () => {
    const repo = setupRepo();
    const p = writeProgram(repo);
    writeCompletePlanWorkspace(repo, p.plan1);
    const cap = captureStderr();
    try {
      const exitCode = await runDocs(
        repo,
        p.plan1,
        path.join(repo, ".osuperpowers", "cdd", "demo-p1", "plan-review-1.json"),
        { dryRun: true },
      );
      // The docs round is never gated on the debt — a dry-run over a complete-unbackfilled plan
      // passes the debt face (source-absent no-op) and completes with exit 0.
      expect(exitCode).toBe(0);
      expect(cap.text).not.toContain("backfill-overall");
      expect(cap.text).not.toContain("closeout terminal debt");
    } finally {
      cap.restore();
    }
  });

  it("dry-run WARN lane (E2② precedent): debt on a plan-bearing dry-run → CDD_WARN + exit 0", async () => {
    const repo = setupRepo();
    const p = writeProgram(repo);
    writeCompletePlanWorkspace(repo, p.plan1);
    const r = await runTaskReview(repo, p.plan1, true);
    expect(r.exitCode).toBe(0);
    expect(r.stderr).toContain("CDD_WARN: closeout terminal debt (dry-run)");
    expect(r.stderr).toContain("backfill-overall");
  });
});

describe("已回填 → 放行 (the v1.12 happy path)", () => {
  it("backfilled overall + complete plan → the task gate clears (dry-run review exit 0, no debt WARN)", async () => {
    const repo = setupRepo();
    const p = writeProgram(repo, OVERALL_BACKFILLED);
    writeCompletePlanWorkspace(repo, p.plan1);
    const r = await runTaskReview(repo, p.plan1, true);
    expect(r.exitCode).toBe(0);
    expect(r.stderr).not.toContain("terminal debt");
  });

  it("backfilled overall + complete plan → the branch gate clears (fails downstream for the agent, never the debt face)", async () => {
    const repo = setupRepo();
    const p = writeProgram(repo, OVERALL_BACKFILLED);
    writeCompletePlanWorkspace(repo, p.plan1);
    const r = await runBranch(repo, p.plan1);
    expect(r.stderr).not.toContain("backfill-overall");
    expect(r.stderr).not.toContain("terminal debt");
  });
});

describe("fresh checkout — no progress.json anywhere → zero debt (零误伤)", () => {
  it("task dry-run review on a clean program → exit 0 and no debt WARN", async () => {
    const repo = setupRepo();
    const p = writeProgram(repo);
    const r = await runTaskReview(repo, p.plan1, true);
    expect(r.exitCode).toBe(0);
    expect(r.stderr).not.toContain("terminal debt");
  });
});

describe("post-flight statusValidate — base default + the CDD_CLOSEOUT highlight", () => {
  it("plan complete during the round + unbackfilled overall → stdout highlight (exit unchanged) + base-default CDD_INFO", async () => {
    const repo = setupRepo();
    const p = writeProgram(repo);
    // A minimal plan-bearing stub: pre-flight sees the plan in-flight (gate passes); dispatch()
    // lands the final APPROVED review mid-round (the round that made the plan complete); the
    // base-default statusValidate then sees done + debt → the backfill highlight on stdout.
    class CompletingStub extends DispatchLifecycle {
      protected override dispatchPlanPath(): string | null {
        return p.plan1;
      }
      protected async dispatch(_hookCtx: DispatchHookContext): Promise<void> {
        const ws = resolveWorkspace(p.plan1, repo);
        mkdirSync(ws, { recursive: true });
        writeFileSync(
          path.join(ws, "tasks-1-review-1.json"),
          JSON.stringify({
            tasks: [1],
            phase: "review",
            status: "APPROVED",
            findings: [],
            artifacts: {},
          }),
        );
        writeFileSync(
          path.join(ws, "progress.json"),
          JSON.stringify({
            plan: p.plan1,
            tasks: [{ task: 1, rounds: { review: 1 } }],
          }),
        );
      }
    }
    const outCap = captureStdout();
    const cap = captureStderr();
    try {
      const lc = new CompletingStub({ ctx: { mode: "review", repoRoot: repo } });
      await expect(lc.run()).resolves.toBeUndefined(); // exit unchanged — informational
    } finally {
      outCap.restore();
      cap.restore();
    }
    expect(outCap.text).toContain("CDD_CLOSEOUT:");
    expect(outCap.text).toContain("backfill-overall");
    expect(outCap.text).toContain(
      path.join(repo, "docs", "osuperpowers", "specs", "2026-01-01-demo-overall.md"),
    );
    // base-default CDD_INFO six-state + verdict (all lanes share one implementation)
    expect(cap.text).toContain("CDD_INFO: task 1 state: complete");
    expect(cap.text).toContain("CDD_INFO: plan done (1/1 complete)");
  });
});
