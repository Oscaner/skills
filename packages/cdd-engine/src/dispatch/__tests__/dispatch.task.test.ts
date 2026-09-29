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

import { execFileSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it, vi } from "vitest";
import { ReturnBlockParser } from "../../artifacts/return-block.ts";
import { TaskGroup } from "../../domain/task-group.ts";
import { captureStderr } from "../../infra/__tests__/helpers.ts";
import { REG_PATH } from "../../infra/registry.ts";
import { DRY_RUN_DIRTY_WARN } from "../../rules/commit.ts";
import { DispatchBlocked } from "../base.ts";
import { TaskLifecycle } from "../task.ts";

const returnBlockParser = new ReturnBlockParser();

// E2②/T14 接口消歧（P6 T10）+ T26: dry-run 走 run() pre-flight 早退路径，不经过 spawnManaged——
// 断言 invokeCliWithRetry（唯一 spawn 通道）与 resolveTerminationConfig（统一终止配置解析）在
// dry-run 下零调用。本文件全部用例 dryRun:true → 永不触 invoke；mock 为文件级安全加固。
// ⚠️ 文件级 mock 覆盖全文件：新增「真实 dispatch（dryRun=false）且依赖 invokeCliWithRetry /
// resolveTerminationConfig 的 spawn-TIMEOUT 行为」用例必须移出本文件（真实 spawn/TIMEOUT 语义由
// tests/runner.test.mjs 拥有）——否则本 mock 会静默清空其 spawn 通道。
const { invokeSpy, terminationSpy } = vi.hoisted(() => ({
  invokeSpy: vi.fn(),
  terminationSpy: vi.fn(),
}));
vi.mock("../../infra/invoke.ts", async () => {
  const actual =
    await vi.importActual<typeof import("../../infra/invoke.ts")>("../../infra/invoke.ts");
  class MockEngineInvoker extends actual.EngineInvoker {
    invokeCliWithRetry = invokeSpy;
    resolveTerminationConfig = terminationSpy;
  }
  return { ...actual, EngineInvoker: MockEngineInvoker };
});

function git(repo: string, ...args: string[]) {
  return execFileSync("git", ["-C", repo, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

// Fresh git repo with one fixture commit (mirrors tests/dispatch.base.test.ts setupRepo).
function setupRepo(): string {
  const dest = mkdtempSync(path.join(tmpdir(), "cdd-task-ts-"));
  writeFileSync(path.join(dest, ".gitignore"), "cdd/\n");
  git(dest, "init", "-q");
  git(dest, "add", "-A");
  git(
    dest,
    "-c",
    "user.name=cdd-task-test",
    "-c",
    "user.email=cdd-task-test@example.com",
    "commit",
    "--allow-empty",
    "-qm",
    "fixture",
  );
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
  (reg as Record<string, unknown>).ghost = {
    cli: "fake-cli",
    invoke: "-p",
    output: "text",
    ship: "full",
  };
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
      group: TaskGroup.fromNumbers([1]),
      opts: {
        mode: "review",
        planFile: "docs/plan.md",
        dryRun: true,
        noExit: true,
        root: repo,
        registryPath: ghostRegistry(),
      },
      ctx: { mode: "review", repoRoot: repo, handoffPath: "", dryRun: true },
    });
    await expect(lc.run()).resolves.toBeUndefined();
    expect(lc.result.exitCode).toBe(0); // 降级非跳过：模拟 exit 0 走完
    // The engine stdout is the single status capsule (T3 — review judgment axis on the clean dry
    // run → APPROVED, blocker 0, the local handoff path).
    expect(lc.result.returnBlock[0]).toMatch(/^status: APPROVED · blocker: 0 · handoff: /);
    // 模板全走（dispatch 进入——唯一 agent 语义步骤被执行；尾步 commitPostCheck 在 dryRun 下跳过退出校验）
    expect(lc.timeline).toEqual([
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
    group: TaskGroup.fromNumbers([1]),
    opts: {
      mode: "review",
      planFile: "x.md",
      noExit: true,
      root: repo,
      registryPath: ghostRegistry(),
    },
    ctx: { mode: "review", repoRoot: repo, handoffPath: "" },
  });
  await expect(lc.run()).rejects.toBeInstanceOf(DispatchBlocked);
  // 中止于 pre-flight —— 唯一 agent 语义步骤未开始（真实 dispatch 不得被干树放过）
  expect(lc.timeline).toEqual(["pre-flight", "commitPreCheck"]);
});

it("runTask wrapper: 入口门 BLOCKED（noExit=true 进程内缝）→ { exitCode: 1, returnBlock: [] }（非 throw）", async () => {
  const repo = setupRepo();
  appendFileSync(path.join(repo, ".gitignore"), "untracked\n");
  const res = await TaskLifecycle.run("ghost", 1, {
    mode: "review",
    planFile: "x.md",
    root: repo,
    noExit: true,
    registryPath: ghostRegistry(),
  });
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
    const res = await TaskLifecycle.run("ghost", 1, {
      mode: "review",
      dryRun: true,
      planFile: "docs/plan.md",
      root: repo,
      noExit: true,
      registryPath: ghostRegistry(),
    });
    expect(res.exitCode).toBe(0);
    expect(res.returnBlock[0]).toMatch(/^status: APPROVED · blocker: 0 · handoff: /);
    // C5 (T8/T3): engine stdout contract = the status capsule + the derived `next:` line (no
    // 4-line status/commits/artifacts + counters block — those live in the handoff/progress.json).
    expect(res.returnBlock).toHaveLength(2);
    expect(res.returnBlock.at(-1)).toMatch(/^next: /);
  } finally {
    cap.restore();
  }
  expect(cap.text).toContain(`CDD_WARN: ${DRY_RUN_DIRTY_WARN}`); // mount 前缀 + 单点常量
});

// ---- C5 capsule exit surface (T3): the engine stdout is the single status capsule (ResultFace) —
// the former 5-line return-block atoms (returnFromHandoff / assembleReturnBlock — the stdout
// status/commits/artifacts + counters + next block) are RETIRED; commits/artifacts/counters live
// in the handoff / progress.json only. What remains on the parse plane: the AGENT-output contract
// atoms feeding implement materialization (returnFourLines / dryRunBlock) — the agent's stdout
// output contract is unchanged. A BLOCKED round's reason travels the carrier's failure_category +
// the stderr CDD_BLOCKED single channel (never fabricated prose, never silently dropped).

it("return-block parse atoms stay (T3): returnFourLines parses the agent's 3-line output + counters, the stray blocker line ignored; dryRunBlock unchanged", () => {
  const ws = mkdtempSync(path.join(tmpdir(), "cdd-rb-atoms-"));
  const four = returnBlockParser.returnFourLines(
    "status: APPROVED\ncommits: base=x head=y\nartifacts: brief=b\nblocker: leftover",
    ws,
  );
  expect(four).toHaveLength(4);
  expect(four[0]).toBe("status: APPROVED");
  expect(four[1]).toBe("commits: base=x head=y");
  expect(four[2]).toBe("artifacts: brief=b");
  expect(four.every((l) => !l.startsWith("blocker:"))).toBe(true);
  expect(four[3]).toMatch(/^counters: /);
  const dry = returnBlockParser.dryRunBlock({ commits: "base=dry-run", artifacts: "report=r" });
  expect(dry).toBe("status: APPROVED\ncommits: base=dry-run\nartifacts: report=r");
});

it("the removed engine-stdout block atoms are gone (T3): returnFromHandoff / assembleReturnBlock no longer exist — ResultFace is the only stdout face", () => {
  expect(returnBlockParser).not.toHaveProperty("returnFromHandoff");
  expect(returnBlockParser).not.toHaveProperty("assembleReturnBlock");
  // the parse + counters atoms remain (the materialization carrier + the agent contract).
  expect(typeof returnBlockParser.lastKeyLine).toBe("function");
  expect(typeof returnBlockParser.implementStatusFromReturnLine).toBe("function");
  expect(typeof returnBlockParser.returnCountersLine).toBe("function");
});

// E2②/T14 接口消歧 + T26: dry-run 路径零终止介入——不 spawn（invokeCliWithRetry 零调用）、不解析
// 终止配置（resolveTerminationConfig 零调用）、无 TIMEOUT handoff 写出、timeout 计数不递增。
// TIMEOUT 扩张仅真实 dispatch——相反面由 runner.test.ts 的「real dispatch + fake sleep → TIMEOUT
// handoff + timeoutCount++」钉住（425/448），dry-run 若进该路径即静默地破坏消歧契约。
it("dry-run 零 liveness 介入（T14 接口消歧）: 不 spawn / 不解析终止配置 / 无 TIMEOUT handoff / timeout=0", async () => {
  invokeSpy.mockClear();
  terminationSpy.mockClear();
  const repo = setupRepo();
  mkdirSync(path.join(repo, "docs"), { recursive: true });
  writeFileSync(path.join(repo, "docs", "plan.md"), "# P\n\n### Task 1: t\n");
  git(repo, "add", "-A");
  git(repo, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "plan");
  const regPath = ghostRegistry();
  const res = await TaskLifecycle.run("ghost", 1, {
    mode: "implement",
    dryRun: true,
    planFile: "docs/plan.md",
    root: repo,
    registryPath: regPath,
    noExit: true,
  });
  expect(res.exitCode).toBe(0);
  // The implement dry-run capsule — the work axis (COMPLETED) + blocker 0 (no decision source, D2; T3).
  expect(res.returnBlock[0]).toMatch(/^status: COMPLETED · blocker: 0 · handoff: /);
  expect(invokeSpy).not.toHaveBeenCalled(); // dry-run ≈ run() pre-flight early return, no spawnManaged
  expect(terminationSpy).not.toHaveBeenCalled(); // dry-run resolves no termination config
  // C5 (T8/T3): the capsule + the `next:` suggestion line (no counters line on stdout — the
  // timeout counters stay readable via progress.json).
  expect(res.returnBlock).toHaveLength(2);
  expect(res.returnBlock.at(-1)).toMatch(/^next: cdd review --type task --tasks 1/);
  const progress = JSON.parse(
    readFileSync(path.join(repo, ".osuperpowers", "cdd", "plan", "progress.json"), "utf8"),
  );
  expect(progress.timeoutCount).toBe(0); // no TIMEOUT count increment
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
    group: TaskGroup.fromNumbers([1]),
    opts: {
      mode: "bogus",
      dryRun: true,
      noExit: true,
      root: repo,
      planFile: "docs/plan.md",
      registryPath: ghostRegistry(),
    },
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
  ]);
});

it("dry-run implement 走全模板（双门卷入）→ 出口 0 + 5 行 return block（counters 行追加 + next 建议行，零 blocker 列）", async () => {
  const repo = setupRepo();
  const { mkdirSync: mkdirFs } = await import("node:fs");
  mkdirFs(path.join(repo, "docs"), { recursive: true });
  writeFileSync(path.join(repo, "docs", "plan.md"), "# P\n\n### Task 1: t\n");
  git(repo, "add", "-A");
  git(repo, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "plan");
  const regPath = ghostRegistry();
  const res = await TaskLifecycle.run("ghost", 1, {
    mode: "implement",
    dryRun: true,
    planFile: "docs/plan.md",
    root: repo,
    registryPath: regPath,
    noExit: true,
  });
  expect(res.exitCode).toBe(0);
  expect(res.returnBlock[0]).toMatch(/^status: COMPLETED · blocker: 0 · handoff: /);
  expect(res.returnBlock).toHaveLength(2); // the status capsule + the derived `next:` line (T3)
  expect(
    res.returnBlock.every((l) => !l.startsWith("commits:") && !l.startsWith("counters:")),
  ).toBe(true);
  expect(res.returnBlock.at(-1)).toMatch(/^next: cdd review --type task --tasks 1/);
});

// ---- C5 fix next-hop decision (C5-1 single point: the --findings input severity decides
// re-review vs closure). The pure full table lives in rules/__tests__/next-step.test.ts; this
// pins the task-face integration: a dry-run fix return block derives through step-11, reading
// the --findings INPUT content (blocker present → next: review; warn/nit only → next: none).
it("C5 fix dry-run: --findings input with a blocker → next: cdd review (same group, new ref)", async () => {
  const repo = setupRepo();
  mkdirSync(path.join(repo, "docs"), { recursive: true });
  writeFileSync(path.join(repo, "docs", "plan.md"), "# P\n\n### Task 1: t\n");
  git(repo, "add", "-A");
  git(repo, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "plan");
  const ws = path.join(repo, ".osuperpowers", "cdd", "plan");
  mkdirSync(ws, { recursive: true });
  const findingsPath = path.join(ws, "tasks-1-review-1.json");
  writeFileSync(
    findingsPath,
    JSON.stringify({
      status: "CHANGES_REQUESTED",
      findings: [{ severity: "blocker", summary: "b" }],
      artifacts: {},
    }),
  );
  const res = await TaskLifecycle.run("ghost", 1, {
    mode: "fix",
    dryRun: true,
    planFile: "docs/plan.md",
    root: repo,
    registryPath: ghostRegistry(),
    findingsPath,
    noExit: true,
  });
  expect(res.exitCode).toBe(0);
  expect(res.returnBlock.at(-1)).toMatch(/^next: cdd review --type task --tasks 1/);
});

it("C5 fix dry-run: --findings input warn/nit-only → next: none (closure naturalization)", async () => {
  const repo = setupRepo();
  mkdirSync(path.join(repo, "docs"), { recursive: true });
  writeFileSync(path.join(repo, "docs", "plan.md"), "# P\n\n### Task 1: t\n");
  git(repo, "add", "-A");
  git(repo, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "plan");
  const ws = path.join(repo, ".osuperpowers", "cdd", "plan");
  mkdirSync(ws, { recursive: true });
  const findingsPath = path.join(ws, "tasks-1-review-1.json");
  writeFileSync(
    findingsPath,
    JSON.stringify({
      status: "REVIEW_FIX",
      findings: [
        { severity: "warn", summary: "w" },
        { severity: "nit", summary: "n" },
      ],
      artifacts: {},
    }),
  );
  const res = await TaskLifecycle.run("ghost", 1, {
    mode: "fix",
    dryRun: true,
    planFile: "docs/plan.md",
    root: repo,
    registryPath: ghostRegistry(),
    findingsPath,
    noExit: true,
  });
  expect(res.exitCode).toBe(0);
  expect(res.returnBlock.at(-1)).toBe("next: none");
});

// ---- C5-1 soft cap (T8 fix): the fix face's 'ref-sequence round counting' judgment must be
// REACHABLE from a real dispatch — the ref-sequence walk (rules/ref-sequence.ts) reads the
// workspace's review-round history anchored at the --findings source handoff, so a review→fix loop
// that keeps returning blockers eventually surfaces next: BLOCKED: review-cycle-cap instead of the
// unbounded re-review suggestion. The pure threshold table lives in
// rules/__tests__/next-step.test.ts / rules/__tests__/ref-sequence.test.ts; these pin the task-face
// integration end-to-end.

it(
  "C5 fix dry-run: consecutive S1 rounds reach the soft cap (3x blocker history) → review-cycle-cap " +
    "adjudication marker",
  async () => {
    const repo = setupRepo();
    mkdirSync(path.join(repo, "docs"), { recursive: true });
    writeFileSync(path.join(repo, "docs", "plan.md"), "# P\n\n### Task 1: t\n");
    git(repo, "add", "-A");
    git(repo, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "plan");
    const ws = path.join(repo, ".osuperpowers", "cdd", "plan");
    mkdirSync(ws, { recursive: true });
    // Rounds 1-3 are all S1 — the source review round 3 is the third consecutive blocker round.
    for (const r of [1, 2, 3]) {
      writeFileSync(
        path.join(ws, `tasks-1-review-${r}.json`),
        JSON.stringify({
          status: "CHANGES_REQUESTED",
          findings: [{ severity: "blocker", summary: `b${r}` }],
          artifacts: {},
        }),
      );
    }
    const res = await TaskLifecycle.run("ghost", 1, {
      mode: "fix",
      dryRun: true,
      planFile: "docs/plan.md",
      root: repo,
      registryPath: ghostRegistry(),
      findingsPath: path.join(ws, "tasks-1-review-3.json"),
      noExit: true,
    });
    expect(res.exitCode).toBe(0);
    expect(res.returnBlock.at(-1)).toBe("next: BLOCKED: review-cycle-cap — user adjudicates");
  },
);

it(
  "C5 fix dry-run: a short consecutive-S1 history stays BELOW the soft cap → still the re-review " +
    "suggestion (no adjudication marker)",
  async () => {
    const repo = setupRepo();
    mkdirSync(path.join(repo, "docs"), { recursive: true });
    writeFileSync(path.join(repo, "docs", "plan.md"), "# P\n\n### Task 1: t\n");
    git(repo, "add", "-A");
    git(repo, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "plan");
    const ws = path.join(repo, ".osuperpowers", "cdd", "plan");
    mkdirSync(ws, { recursive: true });
    // Only two consecutive S1 rounds (rounds 2-3); round 1 closed clean → the cap is not reached.
    writeFileSync(
      path.join(ws, "tasks-1-review-1.json"),
      JSON.stringify({ status: "REVIEW_FIX", findings: [{ severity: "warn" }], artifacts: {} }),
    );
    for (const r of [2, 3]) {
      writeFileSync(
        path.join(ws, `tasks-1-review-${r}.json`),
        JSON.stringify({
          status: "CHANGES_REQUESTED",
          findings: [{ severity: "blocker", summary: `b${r}` }],
          artifacts: {},
        }),
      );
    }
    const res = await TaskLifecycle.run("ghost", 1, {
      mode: "fix",
      dryRun: true,
      planFile: "docs/plan.md",
      root: repo,
      registryPath: ghostRegistry(),
      findingsPath: path.join(ws, "tasks-1-review-3.json"),
      noExit: true,
    });
    expect(res.exitCode).toBe(0);
    expect(res.returnBlock.at(-1)).toMatch(/^next: cdd review --type task --tasks 1/);
  },
);

it("ctx 注入面: 构造即挂基类双门（子类零注册面接触；ctx 原样可读）", async () => {
  const repo = setupRepo();
  const lc = new TaskLifecycle({
    harness: "ghost",
    group: TaskGroup.fromNumbers([1]),
    opts: {
      mode: "implement",
      dryRun: true,
      noExit: true,
      root: repo,
      registryPath: "/nowhere/reg.json",
    },
    ctx: { mode: "implement", repoRoot: repo, handoffPath: "" },
  });
  expect(lc.ctx.mode).toBe("implement");
  expect(lc.ctx.repoRoot).toBe(repo);
  expect(lc.ctx.handoffPath).toBe("");
  expect(typeof lc.run).toBe("function");
});
