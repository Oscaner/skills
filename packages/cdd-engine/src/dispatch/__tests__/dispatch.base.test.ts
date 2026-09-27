// packages/cdd-engine/src/dispatch/__tests__/dispatch.base.test.ts
// (template method skeleton; spec §2.12「抽象基类继承覆写」, P5 落点 3). Tests the template-method
// contract: the abstract base cannot be instantiated (TS compile-time constraint), the constructor
// injects hooks/ctx, run() walks pre-flight → dispatch → post-flight with the commit double gates
// (entry 入口门 commitPreCheck + exit 出口门 commitPostCheck) mounted at the fixed hook points and
// executing by default, and a minimal stub subclass (only the abstract dispatch overridden) drives
// the full skeleton.
//
// NOT covered here (owned elsewhere — single-owner discipline): gate judgment semantics
// (rules/commit.ts, Task 5 — rules.commit.test.ts), the hookable fixed-point firing order
// (dispatch/hooks.ts + tests/dispatch.sequence.test.ts, Task 6), docs.ts entry/exit-gate wiring
// (P5 落点 5 — its own task / Task 10), real task dispatch (dispatch/task.ts).
//
// Test-fixture convention (accepted): git() / setupRepo() mirror tests/rules.commit.test.ts — two
// consumers today, so the mirror is tolerated; extract a shared tests/ git-fixture helper
// (mkdtemp + init + fixture commit) when a third consumer appears.

import { execFileSync } from "node:child_process";
import { appendFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { captureStderr } from "../../infra/__tests__/helpers.ts";
import { DRY_RUN_DIRTY_WARN } from "../../rules/commit.ts";
import { DispatchBlocked, type DispatchHookContext, DispatchLifecycle } from "../base.ts";
import { createDispatchHooks } from "../hooks.ts";
import { PHASE_IDS } from "../phases.ts";

function git(repo: string, ...args: string[]) {
  return execFileSync("git", ["-C", repo, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

// Fresh git repo with one fixture commit (mirrors tests/rules.commit.test.ts setupRepo).
function setupRepo(): string {
  const dest = mkdtempSync(path.join(tmpdir(), "cdd-base-ts-"));
  writeFileSync(path.join(dest, ".gitignore"), "cdd/\n");
  git(dest, "init", "-q");
  git(dest, "add", "-A");
  git(
    dest,
    "-c",
    "user.name=cdd-base-test",
    "-c",
    "user.email=cdd-base-test@example.com",
    "commit",
    "--allow-empty",
    "-qm",
    "fixture",
  );
  return dest;
}

// Minimal stub — only the abstract dispatch hook overridden (acceptance: 子类只需覆写关注 hook 即可运行).
class StubLifecycle extends DispatchLifecycle {
  public dispatchCalled = false;
  protected async dispatch(_hookCtx: DispatchHookContext): Promise<void> {
    this.dispatchCalled = true;
  }
}

// Type-level probe — directly constructing the abstract class is a compile error. TS erases
// `abstract` at runtime, so the constraint is compile-time (spec: TS 虚方法编译期约束); this
// function is never invoked — tsc on this test file proves the @ts-expect-error still catches an
// error (if the class ever becomes concrete, tsc reverses into "Unused @ts-expect-error").
function abstractInstantiationProbe(): void {
  // @ts-expect-error — DispatchLifecycle is abstract; `new` is a compile-time error
  new DispatchLifecycle({ ctx: { mode: "review", repoRoot: null } });
}

const EXPECTED_TIMELINE = [
  "pre-flight",
  "commitPreCheck",
  "resolveContext",
  "validateMode",
  "docContractValidate",
  "dispatch",
  "post-flight",
  "schemaValidate",
  "normalizeResult",
  "settleResidue",
  "writeBoundary",
  "commitPostCheck",
  "statusValidate",
] as const;

it("abstract: 基类无法实例化（TS 编译期约束；直接 new 为编译错误，经 tsc 对 tests 验证）", () => {
  // 运行期抽象成员被擦除，编译期拒绝才是约束的证明面 —— probe 不执行构造、仅承载类型断言。
  expect(typeof abstractInstantiationProbe).toBe("function");
});

it("minimal stub（仅覆写 dispatch）跑通 run() 全流程 — clean tree + review mode", async () => {
  const repo = setupRepo();
  const lc = new StubLifecycle({ ctx: { mode: "review", repoRoot: repo } });
  await expect(lc.run()).resolves.toBeUndefined();
  expect(lc.dispatchCalled).toBe(true);
});

it("模板方法序断言: pre-flight → dispatch → post-flight，commit 双门卷入（timeline）", async () => {
  const repo = setupRepo();
  const lc = new StubLifecycle({ ctx: { mode: "review", repoRoot: repo } });
  await lc.run();
  expect(lc.timeline).toEqual([...EXPECTED_TIMELINE]);
  // phase 边界标签来自 phases.ts 阶段表（PhaseId 消费点）——顺序即表的一环。
  for (const boundary of ["pre-flight", "dispatch", "post-flight"]) {
    expect(PHASE_IDS).toContain(boundary as (typeof PHASE_IDS)[number]);
    expect(lc.timeline).toContain(boundary);
  }
});

it("入口门用例（单一 owner — 基类实现级）: review 起点 dirty → BLOCKED，dispatch 不进入", async () => {
  const repo = setupRepo();
  appendFileSync(path.join(repo, ".gitignore"), "dirty\n");
  const lc = new StubLifecycle({ ctx: { mode: "review", repoRoot: repo } });
  let error: unknown;
  try {
    await lc.run();
  } catch (e) {
    error = e;
  }
  expect(error).toBeInstanceOf(DispatchBlocked);
  expect((error as DispatchBlocked).gate).toBe("entry");
  expect((error as DispatchBlocked).message).toMatch(/uncommitted changes at entry/);
  expect(lc.dispatchCalled).toBe(false); // 中止于 pre-flight —— 唯一 agent 语义步骤未开始
  expect(lc.timeline).toEqual(["pre-flight", "commitPreCheck"]);
});

it("入口门中止后 dispatch:after 仍在 finally 触发（模板方法终止路径完整）", async () => {
  const repo = setupRepo();
  appendFileSync(path.join(repo, ".gitignore"), "dirty\n");
  const hooks = createDispatchHooks();
  const fired: string[] = [];
  hooks.hook("dispatch:after", () => {
    fired.push("after");
  });
  const lc = new StubLifecycle({ hooks, ctx: { mode: "review", repoRoot: repo } });
  await expect(lc.run()).rejects.toBeInstanceOf(DispatchBlocked);
  expect(fired).toEqual(["after"]);
});

// E2②/G4①（P6 T10）: dry-run 入口门降级——脏树 + ctx.dryRun → 不 DispatchBlocked，stderr CDD_WARN
// 打印后 run() 走通全模板（dispatch 进入、timeline 完整、exit 0）。基类默认门是 task/docs 两面的
// 共同单点：此用例为两面的共享继承断言。
it("dryRun 入口门降级: dirty + ctx.dryRun → run() 走通 + CDD_WARN stderr + dispatch 进入", async () => {
  const repo = setupRepo();
  appendFileSync(path.join(repo, ".gitignore"), "dirty\n");
  const cap = captureStderr();
  try {
    const lc = new StubLifecycle({ ctx: { mode: "review", repoRoot: repo, dryRun: true } });
    await expect(lc.run()).resolves.toBeUndefined();
    expect(lc.dispatchCalled).toBe(true); // 降级非跳过：模拟照常走完 dispatch
    expect(lc.timeline).toEqual([...EXPECTED_TIMELINE]); // 全模板
  } finally {
    cap.restore();
  }
  expect(cap.text).toContain(`CDD_WARN: ${DRY_RUN_DIRTY_WARN}`); // mount 前缀 + 单点常量
});

it("干净树 + ctx.dryRun → 无 CDD_WARN（干净树无降级可言）", async () => {
  const repo = setupRepo();
  const cap = captureStderr();
  try {
    const lc = new StubLifecycle({ ctx: { mode: "review", repoRoot: repo, dryRun: true } });
    await expect(lc.run()).resolves.toBeUndefined();
  } finally {
    cap.restore();
  }
  expect(cap.text).not.toContain(DRY_RUN_DIRTY_WARN);
});

it("dry-run 出口门跳过（基类默认；E2②）: dispatch 期间弄脏树 + dryRun → run() 照常走完（无 exit BLOCK）", async () => {
  const repo = setupRepo();
  class DirtyingDryRunStub extends DispatchLifecycle {
    protected async dispatch(_hookCtx: DispatchHookContext): Promise<void> {
      appendFileSync(path.join(repo, ".gitignore"), "dirty\n"); // 出口时树脏
    }
  }
  const cap = captureStderr();
  try {
    const lc = new DirtyingDryRunStub({ ctx: { mode: "review", repoRoot: repo, dryRun: true } });
    await expect(lc.run()).resolves.toBeUndefined(); // exit gate 对 dry-run 不判（纯模拟无 commit contract）
    expect(lc.timeline).toEqual([...EXPECTED_TIMELINE]);
  } finally {
    cap.restore();
  }
  expect(cap.text).not.toContain("CDD_WARN: "); // 唯一 WARN 在 entry；此例 entry 干净
});

it("出口门卷入（双门挂载）: dispatch 期间引入 dirty → BLOCKED（gate=exit）", async () => {
  const repo = setupRepo();
  class DirtyingStub extends DispatchLifecycle {
    protected async dispatch(_hookCtx: DispatchHookContext): Promise<void> {
      appendFileSync(path.join(repo, ".gitignore"), "dirty\n");
    }
  }
  const lc = new DirtyingStub({ ctx: { mode: "review", repoRoot: repo } });
  let error: unknown;
  try {
    await lc.run();
  } catch (e) {
    error = e;
  }
  expect(error).toBeInstanceOf(DispatchBlocked);
  expect((error as DispatchBlocked).gate).toBe("exit");
  expect((error as DispatchBlocked).message).toMatch(/uncommitted changes at return/);
  // The walk is unconditional but aborts where the exit gate throws: statusValidate (the post-exit
  // report step) never records on a blocked exit — it only runs on a gate that passed.
  expect(lc.timeline).toEqual(EXPECTED_TIMELINE.slice(0, -1));
});

it("继承覆写（spec §2.12 落点）: 覆写门 hook 替换默认判定（双门各自可替换；dirty 下仍 run 通过）", async () => {
  const repo = setupRepo();
  appendFileSync(path.join(repo, ".gitignore"), "dirty\n"); // 默认双门都会 BLOCK —— 覆写后放行
  class PermissiveStub extends DispatchLifecycle {
    public gates: string[] = [];
    protected override async commitPreCheck(): Promise<void> {
      this.gates.push("commitPreCheck"); // 自定义入口策略：接受 dirty（不 invoke 默认门判定）
    }
    protected override async commitPostCheck(): Promise<void> {
      this.gates.push("commitPostCheck"); // 自定义出口策略同样接受 dirty
    }
    protected async dispatch(_hookCtx: DispatchHookContext): Promise<void> {}
  }
  const lc = new PermissiveStub({ ctx: { mode: "review", repoRoot: repo } });
  await expect(lc.run()).resolves.toBeUndefined();
  expect(lc.gates).toEqual(["commitPreCheck", "commitPostCheck"]);
});

it("构造注 hooks/ctx: 注入实例被使用（ctx 同实例；dispatch:before/after 在 run 边界触发）", async () => {
  const repo = setupRepo();
  const hooks = createDispatchHooks();
  const order: string[] = [];
  hooks.hook("dispatch:before", () => {
    order.push("before");
  });
  hooks.hook("dispatch:after", () => {
    order.push("after");
  });
  const ctx = { mode: "review", repoRoot: repo };
  const lc = new StubLifecycle({ hooks, ctx });
  expect(lc.ctx).toBe(ctx);
  await lc.run();
  expect(order).toEqual(["before", "after"]);
});
