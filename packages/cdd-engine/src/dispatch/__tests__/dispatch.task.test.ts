// packages/cdd-engine/src/dispatch/__tests__/dispatch.task.test.ts
// (dispatch/task.ts) inherits BOTH commit gates from the base and runs the migrated 13.5-step
// flow as hook overrides. Covered here (single-owner discipline): gate inheritance on the task
// face (entry dirty → BLOCKED pre-dispatch, never entering the agent dispatch), validateMode
// rejection order on the template walk, the runTask wrapper's entry-gate noExit seam, and the
// injected-ctx surface. The full step-1…13.5 behavior matrix stays owned by tests/runner.test.mjs
// (it drives runTask through every branch); docs-face gate wiring is owned by
// dispatch.docs.test.ts.
// E2②（P6 T10）: 入口门 dry-run 降级语义落于基类默认门（dispatch/base.ts）+ rules/commit.ts 单点
// ——任务面继承，本文件仅钉 runner 面（runTask dryRun 透传 → 降级；真实 dispatch BLOCKED 不变；
// 零 liveness）与「CLI 黑盒各型」sweep 在 cdd.test.ts。
import { it, expect, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { TaskLifecycle, runTask, returnFromHandoff } from "../task.ts";
import { DispatchBlocked } from "../base.ts";
import { invokeCliWithRetry, resolveTerminationConfig } from "../../infra/invoke.ts";
import { REG_PATH } from "../../infra/registry.ts";
import { captureStderr } from "../../infra/__tests__/helpers.ts";
import { DRY_RUN_DIRTY_WARN } from "../../rules/commit.ts";

// E2②/T14 接口消歧（P6 T10）+ T26: dry-run 走 run() pre-flight 早退路径，不经过 spawnManaged——
// 断言 invokeCliWithRetry（唯一 spawn 通道）与 resolveTerminationConfig（统一终止配置解析）在
// dry-run 下零调用。本文件全部用例 dryRun:true → 永不触 invoke；mock 为文件级安全加固。
// ⚠️ 文件级 mock 覆盖全文件：新增「真实 dispatch（dryRun=false）且依赖 invokeCliWithRetry /
// resolveTerminationConfig 的 spawn-TIMEOUT 行为」用例必须移出本文件（真实 spawn/TIMEOUT 语义由
// tests/runner.test.mjs 拥有）——否则本 mock 会静默清空其 spawn 通道。
vi.mock("../../infra/invoke.ts", async () => {
  const actual = await vi.importActual<typeof import("../../infra/invoke.ts")>("../../infra/invoke.ts");
  return {
    ...actual,
    invokeCliWithRetry: vi.fn(),
    resolveTerminationConfig: vi.fn(),
  };
});

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

it("入口门降级（继承基类 + E2②）: review 起点 dirty + dryRun → 不 BLOCK；CDD_WARN 后 run() 走通（exit 0、dispatch 进入、全模板）", async () => {
  const repo = setupRepo();
  mkdirSync(path.join(repo, "docs"), { recursive: true });
  writeFileSync(path.join(repo, "docs", "plan.md"), "# P\n\n### Task 1: t\n");
  git(repo, "add", "-A");
  git(repo, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "plan");
  appendFileSync(path.join(repo, ".gitignore"), "dirty\n"); // 弄脏 tracked 文件（porcelain ` M`）
  const cap = captureStderr();
  try {
    const lc = new TaskLifecycle({
      harness: "ghost",
      tasks: [1],
      opts: { mode: "review", planFile: "docs/plan.md", dryRun: true, noExit: true, root: repo, registryPath: ghostRegistry() },
      ctx: { mode: "review", repoRoot: repo, handoffPath: "", dryRun: true },
    });
    await expect(lc.run()).resolves.toBeUndefined();
    expect(lc.result.exitCode).toBe(0); // 降级非跳过：模拟 exit 0 走完
    expect(lc.result.returnBlock[0]).toBe("status: APPROVED");
    // 模板全走（dispatch 进入——唯一 agent 语义步骤被执行；尾步 commitPostCheck 在 dryRun 下跳过退出校验）
    expect(lc.timeline).toEqual([
      "pre-flight", "commitPreCheck", "resolveContext", "validateMode", "docContractValidate",
      "dispatch", "post-flight", "schemaValidate", "normalizeResult",
      "settleResidue", "writeBoundary", "commitPostCheck", "statusValidate",
    ]);
  } finally {
    cap.restore();
  }
  expect(cap.text).toContain(`CDD_WARN: ${DRY_RUN_DIRTY_WARN}`); // mount 前缀 + 单点常量
});

it("真实 dispatch（dryRun=false）起点 dirty → 入口门仍 BLOCKED（E2② 只在 dry-run 降级；门判语义不变）", async () => {
  const repo = setupRepo();
  appendFileSync(path.join(repo, ".gitignore"), "dirty\n");
  const lc = new TaskLifecycle({
    harness: "ghost",
    tasks: [1],
    opts: { mode: "review", planFile: "x.md", noExit: true, root: repo, registryPath: ghostRegistry() },
    ctx: { mode: "review", repoRoot: repo, handoffPath: "" },
  });
  await expect(lc.run()).rejects.toBeInstanceOf(DispatchBlocked);
  // 中止于 pre-flight —— 唯一 agent 语义步骤未开始（真实 dispatch 不得被干树放过）
  expect(lc.timeline).toEqual(["pre-flight", "commitPreCheck"]);
});

it("runTask wrapper: 入口门 BLOCKED（noExit=true 进程内缝）→ { exitCode: 1, returnBlock: [] }（非 throw）", async () => {
  const repo = setupRepo();
  appendFileSync(path.join(repo, ".gitignore"), "untracked\n");
  const res = await runTask("ghost", 1, { mode: "review", planFile: "x.md", root: repo, noExit: true, registryPath: ghostRegistry() });
  expect(res.exitCode).toBe(1);
  expect(res.returnBlock).toEqual([]);
});

it("runTask dry-run 降级: dirty + dryRun + noExit → exit 0 + return block APPROVED + CDD_WARN stderr", async () => {
  const repo = setupRepo();
  mkdirSync(path.join(repo, "docs"), { recursive: true });
  writeFileSync(path.join(repo, "docs", "plan.md"), "# P\n\n### Task 1: t\n");
  git(repo, "add", "-A");
  git(repo, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "plan");
  appendFileSync(path.join(repo, ".gitignore"), "dirty\n");
  const cap = captureStderr();
  try {
    const res = await runTask("ghost", 1, { mode: "review", dryRun: true, planFile: "docs/plan.md", root: repo, noExit: true, registryPath: ghostRegistry() });
    expect(res.exitCode).toBe(0);
    expect(res.returnBlock[0]).toBe("status: APPROVED");
    expect(res.returnBlock).toHaveLength(5);
  } finally {
    cap.restore();
  }
  expect(cap.text).toContain(`CDD_WARN: ${DRY_RUN_DIRTY_WARN}`); // mount 前缀 + 单点常量
});

// ---- returnFromHandoff ④（Task 23 fake killer）: blocker 行只允许真实来源，BLOCKED 无真实原因 → "" ----

it("returnFromHandoff ④: BLOCKED 无真实 reason → blocker 行空（不伪造 commit-contract 文案）", () => {
  const ws = mkdtempSync(path.join(tmpdir(), "cdd-rfh-"));
  const hp = path.join(ws, "task-1-review-1.json");
  writeFileSync(hp, JSON.stringify({ task: 1, phase: "review", status: "BLOCKED", findings: [], artifacts: {} }));
  const lines = returnFromHandoff(hp, ws);
  expect(lines[0]).toBe("status: BLOCKED");
  expect(lines.find((l) => l.startsWith("blocker:"))).toBe("blocker: ");
  expect(lines.join("\n")).not.toContain("uncommitted changes at return"); // 伪造文案零残留
});

it("returnFromHandoff ④: 真实 blocker 原样透传；APPROVED 无 blocker → blocker: none", () => {
  const ws = mkdtempSync(path.join(tmpdir(), "cdd-rfh2-"));
  const hp = path.join(ws, "task-1-review-1.json");
  writeFileSync(hp, JSON.stringify({ task: 1, phase: "review", status: "APPROVED", blocker: "真实原因", findings: [], artifacts: {} }));
  const lines = returnFromHandoff(hp, ws);
  expect(lines.find((l) => l.startsWith("blocker:"))).toBe("blocker: 真实原因");
  writeFileSync(hp, JSON.stringify({ task: 1, phase: "review", status: "APPROVED", findings: [], artifacts: {} }));
  const lines2 = returnFromHandoff(hp, ws);
  expect(lines2.find((l) => l.startsWith("blocker:"))).toBe("blocker: none");
});

it("returnFromHandoff ④: commit-gate 文案仅当来源 commit-gate（handoff blocker 字段）时输出", () => {
  const ws = mkdtempSync(path.join(tmpdir(), "cdd-rfh3-"));
  const hp = path.join(ws, "task-1-review-1.json");
  writeFileSync(hp, JSON.stringify({ task: 1, phase: "review", status: "BLOCKED", blocker: "uncommitted changes at return", findings: [], artifacts: {} }));
  const lines = returnFromHandoff(hp, ws);
  expect(lines.find((l) => l.startsWith("blocker:"))).toBe("blocker: uncommitted changes at return");
});

// E2②/T14 接口消歧 + T26: dry-run 路径零终止介入——不 spawn（invokeCliWithRetry 零调用）、不解析
// 终止配置（resolveTerminationConfig 零调用）、无 TIMEOUT handoff 写出、timeout 计数不递增。
// TIMEOUT 扩张仅真实 dispatch——相反面由 runner.test.ts 的「real dispatch + fake sleep → TIMEOUT
// handoff + timeoutCount++」钉住（425/448），dry-run 若进该路径即静默地破坏消歧契约。
it("dry-run 零 liveness 介入（T14 接口消歧）: 不 spawn / 不解析终止配置 / 无 TIMEOUT handoff / timeout=0", async () => {
  vi.mocked(invokeCliWithRetry).mockClear();
  vi.mocked(resolveTerminationConfig).mockClear();
  const repo = setupRepo();
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
  expect(res.returnBlock[0]).toBe("status: APPROVED");
  expect(vi.mocked(invokeCliWithRetry)).not.toHaveBeenCalled(); // dry-run ≈ run() pre-flight 早退，无 spawnManaged
  expect(vi.mocked(resolveTerminationConfig)).not.toHaveBeenCalled();    // dry-run 无终止配置解析
  expect(res.returnBlock[4]).toMatch(/^counters: timeout=0 contract-violation=\d+/); // 无 TIMEOUT 计数递增
  // implement dry-run 不写 handoff（T6 实体化仅真实 dispatch）——也无 TIMEOUT 部分 handoff 可言
  const ws = path.join(repo, ".osuperpowers", "cdd", "plan");
  expect(existsSync(path.join(ws, "tasks-1-implement.json"))).toBe(false);
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
    tasks: [1],
    opts: { mode: "bogus", dryRun: true, noExit: true, root: repo, planFile: "docs/plan.md", registryPath: ghostRegistry() },
    ctx: { mode: "bogus", repoRoot: repo, handoffPath: "" },
  });
  await lc.run();
  expect(lc.result.exitCode).toBe(1);
  expect(lc.result.returnBlock).toEqual([]);
  expect(lc.diagnostic?.msg).toMatch(/mode must be implement\|review\|fix/);
  // validateMode rejects in pre-flight: the mode error wins (dispatch body skipped via
  // #finished), while the template walk still records every step (the walk is unconditional —
  // only hook bodies skip on a finished round).
  expect(lc.timeline).toEqual([
    "pre-flight", "commitPreCheck", "resolveContext", "validateMode", "docContractValidate",
    "dispatch", "post-flight", "schemaValidate", "normalizeResult", "settleResidue", "writeBoundary", "commitPostCheck", "statusValidate",
  ]);
});

it("dry-run implement 走全模板（双门卷入）→ 出口 0 + 5 行 return block（counters 行追加）", async () => {
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
  expect(res.returnBlock[0]).toBe("status: APPROVED");
  expect(res.returnBlock).toHaveLength(5); // status/commits/artifacts/blocker + counters
  expect(res.returnBlock[4]).toMatch(/^counters: /);
});

it("ctx 注入面: 构造即挂基类双门（子类零注册面接触；ctx 原样可读）", async () => {
  const repo = setupRepo();
  const lc = new TaskLifecycle({
    harness: "ghost",
    tasks: [1],
    opts: { mode: "implement", dryRun: true, noExit: true, root: repo, registryPath: "/nowhere/reg.json" },
    ctx: { mode: "implement", repoRoot: repo, handoffPath: "" },
  });
  expect(lc.ctx.mode).toBe("implement");
  expect(lc.ctx.repoRoot).toBe(repo);
  expect(lc.ctx.handoffPath).toBe("");
  expect(typeof lc.run).toBe("function");
});

