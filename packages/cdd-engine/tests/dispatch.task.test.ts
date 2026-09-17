// tests/dispatch.task.test.ts — Task 8 TaskLifecycle seam: the task-function lifecycle
// (dispatch/task.ts) inherits BOTH commit gates from the base and runs the migrated 13.5-step
// flow as hook overrides. Covered here (single-owner discipline): gate inheritance on the task
// face (entry dirty → BLOCKED pre-dispatch, never entering the agent dispatch), validateMode
// rejection order on the template walk, the runTask wrapper's entry-gate noExit seam, and the
// injected-ctx surface. The full step-1…13.5 behavior matrix stays owned by tests/runner.test.mjs
// (it drives runTask through every branch); docs-face gate wiring is owned by
// dispatch.docs.test.ts.
import { it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { TaskLifecycle, runTask } from "../src/dispatch/task.ts";
import { DispatchBlocked } from "../src/dispatch/base.ts";
import { REG_PATH } from "../src/infra/registry.ts";

function git(repo: string, ...args: string[]) {
  return execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

// Fresh git repo with one fixture commit (mirrors tests/dispatch.base.test.ts setupRepo).
function setupRepo(): string {
  const dest = mkdtempSync(path.join(tmpdir(), "cdd-task-ts-"));
  writeFileSync(path.join(dest, ".gitignore"), "cdd/\n");
  git(dest, "init", "-q");
  git(dest, "add", "-A");
  git(dest, "-c", "user.name=cdd-task-test", "-c", "user.email=cdd-task-test@example.com", "commit", "--allow-empty", "-qm", "fixture");
  return dest;
}

// Ghost harness registry entry (mirrors runner.test.mjs ghostRegistry): dry-run dispatches pass
// checkHarness without a real CLI on PATH (dryRun skips the cli-in-path probe). Written into an
// isolated tmp dir — inside the repo the untracked registry.json would dirty the tree and trip
// the entry gate.
function ghostRegistry(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "cdd-ghost-reg-"));
  const regPath = path.join(dir, "registry.json");
  const reg = JSON.parse(readFileSync(REG_PATH, "utf8")) as Record<string, unknown>;
  (reg as Record<string, unknown>).ghost = { cli: "fake-cli", invoke: "-p", output: "text", ship: "full" };
  writeFileSync(regPath, JSON.stringify(reg));
  return regPath;
}

it("入口门中止（继承基类）: review 起点 dirty → DispatchBlocked(gate=entry)，dispatch 不进入", async () => {
  const repo = setupRepo();
  appendFileSync(path.join(repo, ".gitignore"), "dirty\n");
  const lc = new TaskLifecycle({
    harness: "ghost",
    taskNum: 1,
    opts: { mode: "review", planFile: "x.md", dryRun: true, noExit: true, root: repo },
    ctx: { mode: "review", repoRoot: repo, handoffPath: "" },
  });
  await expect(lc.run()).rejects.toBeInstanceOf(DispatchBlocked);
  // The base abort path: pre-flight → commitPreCheck; dispatch (the only agent-semantics step)
  // never entered.
  expect(lc.timeline).toEqual(["pre-flight", "commitPreCheck"]);
});

it("runTask wrapper: 入口门 BLOCKED（noExit=true 进程内缝）→ { exitCode: 1, h1: [] }（非 throw）", async () => {
  const repo = setupRepo();
  appendFileSync(path.join(repo, ".gitignore"), "untracked\n");
  const res = await runTask("ghost", 1, { mode: "review", dryRun: true, planFile: "x.md", root: repo, noExit: true });
  expect(res.exitCode).toBe(1);
  expect(res.h1).toEqual([]);
});

it("干净树 + 非法 mode → validateMode 拒绝（模板停在 dispatch 前；diagnostic 面红线）", async () => {
  const repo = setupRepo();
  const dir = path.join(repo, "docs");
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "plan.md"), "# P\n\n### Task 1: t\n");
  git(repo, "add", "-A");
  git(repo, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "plan");
  const lc = new TaskLifecycle({
    harness: "ghost",
    taskNum: 1,
    opts: { mode: "bogus", dryRun: true, noExit: true, root: repo, planFile: "docs/plan.md", registryPath: ghostRegistry() },
    ctx: { mode: "bogus", repoRoot: repo, handoffPath: "" },
  });
  await lc.run();
  expect(lc.result.exitCode).toBe(1);
  expect(lc.result.h1).toEqual([]);
  expect(lc.diagnostic?.msg).toMatch(/mode must be implement\|review\|fix/);
  // validateMode rejects in pre-flight: the mode error wins (dispatch body skipped via
  // #finished), while the template walk still records every step (the walk is unconditional —
  // only hook bodies skip on a finished round).
  expect(lc.timeline).toEqual([
    "pre-flight", "commitPreCheck", "resolveContext", "validateMode",
    "dispatch", "post-flight", "schemaValidate", "normalizeResult", "commitPostCheck",
  ]);
});

it("dry-run implement 走全模板（双门卷入）→ 出口 0 + 5 行 H1（counters 行追加）", async () => {
  const repo = setupRepo();
  const { mkdirSync } = await import("node:fs");
  mkdirSync(path.join(repo, "docs"), { recursive: true });
  writeFileSync(path.join(repo, "docs", "plan.md"), "# P\n\n### Task 1: t\n");
  git(repo, "add", "-A");
  git(repo, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "plan");
  const regPath = ghostRegistry();
  const res = await runTask("ghost", 1, {
    mode: "implement", dryRun: true, planFile: "docs/plan.md", root: repo,
    registryPath: regPath, noExit: true,
  });
  expect(res.exitCode).toBe(0);
  expect(res.h1[0]).toBe("status: APPROVED");
  expect(res.h1).toHaveLength(5); // status/commits/artifacts/blocker + counters
  expect(res.h1[4]).toMatch(/^counters: /);
});

it("ctx 注入面: 构造即挂基类双门（子类零注册面接触；ctx 原样可读）", async () => {
  const repo = setupRepo();
  const lc = new TaskLifecycle({
    harness: "ghost",
    taskNum: 1,
    opts: { mode: "implement", dryRun: true, noExit: true, root: repo, registryPath: "/nowhere/reg.json" },
    ctx: { mode: "implement", repoRoot: repo, handoffPath: "" },
  });
  expect(lc.ctx.mode).toBe("implement");
  expect(lc.ctx.repoRoot).toBe(repo);
  expect(lc.ctx.handoffPath).toBe("");
  expect(typeof lc.run).toBe("function");
});

