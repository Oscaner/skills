// packages/cdd-engine/src/artifacts/__tests__/handoff-finalize.test.ts
// finalizeHandoff 是唯一 定稿入口（engine 载体唯一作者）：review 族 rollup 派生 / implement 族实体化
//（无 agentHandoff 输入槽位）/ fix 族 agent 声明保留。三消费方（runner/docs-runner/cdd.mjs）
// 共享同一实现 —— 非各自接线（导入断言）。
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { finalizeHandoff, statusExitCode, blockedCarrierFor, applyDerivedStatus } from "../handoff/finalize.ts";
import { writeOwnHandoff } from "../handoff/write.ts";
import { FAILURE_CATEGORIES } from "../../rules/failure.ts";
import { gitInit } from "../../infra/__tests__/helpers.ts";

// ---- review 族：rollup 派生（applyDerivedStatus；SP-4 失败轮次豁免）----

it("finalizeHandoff review 族：agent 写 warn-only CHANGES_REQUESTED → 定稿 APPROVED（rollup 派生）", async () => {
  const agentHandoff = { status: "CHANGES_REQUESTED", findings: [{ severity: "warn" }] };
  const r = await finalizeHandoff({ mode: "review", agentHandoff });
  expect(r.handoff.status).toBe("APPROVED");
  expect(r.handoff.findings).toEqual([{ severity: "warn" }]);
  expect(r.handoff).not.toBe(agentHandoff); // 派生返回新对象（不原地修改 agent 内容）
  expect(r.exitCode).toBe(0);
});

it("finalizeHandoff review 族：无变化 → 返回原对象（不写盘；caller 以引用判定 skip）", async () => {
  const agentHandoff = { status: "APPROVED", findings: [] };
  const r = await finalizeHandoff({ mode: "review", agentHandoff });
  expect(r.handoff).toBe(agentHandoff);
  expect(r.exitCode).toBe(0);
});

it("finalizeHandoff review 族 SP-4 豁免：agent status BLOCKED + findings:[] → 保持 BLOCKED（失败轮次不覆写）", async () => {
  const agentHandoff = { status: "BLOCKED", findings: [], blocker: "boom" };
  const r = await finalizeHandoff({ mode: "review", agentHandoff });
  expect(r.handoff.status).toBe("BLOCKED");
});

// ---- implement 族：实体化，输入无 agentHandoff 槽位 ----

it("finalizeHandoff implement 族：输入无 agentHandoff 槽位（通过类型避免残留路径）", async () => {
  // 从 return block + brief TASK_BASE + git HEAD 实体化（T6 逻辑迁入；commits 单一权威）。
  const repo = mkdtempSync(path.join(tmpdir(), "cdd-hf-impl-repo-"));
  gitInit(repo);
  const ws = mkdtempSync(path.join(tmpdir(), "cdd-hf-impl-ws-"));
  const taskBase = "9a4757b23b5f0634a8ef1d08e1d6c9d1c4f59c63";
  const brief = path.join(ws, "task-1-brief.md");
  writeFileSync(brief, `# task 1\nTASK_BASE: ${taskBase}\n`);
  writeFileSync(path.join(ws, "task-1-test-evidence.json"), "{}"); // behavior_change !== true → soft 空
  const actualHead = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim();
  const r = await finalizeHandoff({
    mode: "implement",
    returnBlock: [
      "status: APPROVED",
      "commits: base=agent-wrong-base head=agent-wrong-head",
      "artifacts: report=r.md",
      "blocker: none",
    ],
    brief, repoRoot: repo, workspace: ws, taskNum: 1,
  });
  expect(r.handoff.phase).toBe("implement");
  expect(r.handoff.status).toBe("APPROVED");
  expect(r.handoff.commits.base).toBe(taskBase);       // brief TASK_BASE 权威（agent 行被忽略）
  expect(r.handoff.commits.head).toBe(actualHead);     // git HEAD 权威
  expect(r.handoff.findings).toEqual([]);
  expect(r.handoff.artifacts.report).toBe("r.md");
  expect(r.handoff.blocker).toBeUndefined();           // blocker: none → 省略
  expect(r.exitCode).toBe(0);
});

it("finalizeHandoff implement 族：brief 无 TASK_BASE → 降级 fail-open（不实体化，handoff:null + exit 0）", async () => {
  const ws = mkdtempSync(path.join(tmpdir(), "cdd-hf-impl-fail-"));
  const brief = path.join(ws, "task-1-brief.md");
  writeFileSync(brief, "# task 1\nno TASK_BASE here\n");
  const r = await finalizeHandoff({ mode: "implement", returnBlock: ["status: APPROVED"], brief, workspace: ws, taskNum: 1 });
  expect(r.handoff).toBeNull();
  expect(r.exitCode).toBe(0);
});

// ---- fix 族：work 型 — agent 声明保留，契约在 commit-contract 层否决 ----

it("finalizeHandoff fix 族：agent 声明保留（不派生覆写）", async () => {
  const agentHandoff = { status: "APPROVED", findings: [{ severity: "blocker" }], blocker: "uncommitted" };
  const r = await finalizeHandoff({ mode: "fix", agentHandoff });
  expect(r.handoff).toBe(agentHandoff);
  expect(r.exitCode).toBe(0);
});

it("finalizeHandoff 未知 mode → 抛错（定稿分派契约）", async () => {
  await expect(finalizeHandoff({ mode: "bogus", agentHandoff: {} })).rejects.toThrow(/unknown mode/);
});

// ---- writeOwnHandoff：全量覆盖写盘（engine 载体唯一作者）----

it("writeOwnHandoff 全量覆盖：existing 含垃圾字段 → 新载体不含它", () => {
  const p = path.join(mkdtempSync(path.join(tmpdir(), "cdd-woh-")), "task-1-implement.json");
  writeOwnHandoff(p, { junk: true, task: 1 });
  writeOwnHandoff(p, { task: 1, phase: "implement", status: "APPROVED", findings: [], artifacts: {} });
  const h = JSON.parse(readFileSync(p, "utf8"));
  expect(h).not.toHaveProperty("junk");
  expect(h).toEqual({ task: 1, phase: "implement", status: "APPROVED", findings: [], artifacts: {} });
});

// ---- Task 23 ①④: BLOCKED carrier — unverifiable / plan_conflicts must never fold to a bare
// BLOCKED; the derived round carries failure_category + a real blocker (real sources only). ----

it("statusExitCode ③: APPROVED / CHANGES_REQUESTED → 0；BLOCKED / TIMEOUT / absent → 1", () => {
  expect(statusExitCode("APPROVED")).toBe(0);
  expect(statusExitCode("CHANGES_REQUESTED")).toBe(0);
  expect(statusExitCode("BLOCKED")).toBe(1);
  expect(statusExitCode("TIMEOUT")).toBe(1);
  expect(statusExitCode(undefined)).toBe(1);
});

it("blockedCarrierFor: unverifiable 非空 → UNVERIFIABLE 通道 + 真实 blocker（entry 汇总，never 伪造）", () => {
  const c = blockedCarrierFor("BLOCKED", [{ claim: "git-status 无法复核", why: "dirty tree" }]);
  expect(c.failure_category).toBe(FAILURE_CATEGORIES.UNVERIFIABLE.id);
  expect(c.blocker).toContain("git-status 无法复核");
  expect(c.blocker).toContain("dirty tree");
});

it("blockedCarrierFor: plan_conflicts 非空 → PLAN_CONFLICT 通道 + 真实 blocker", () => {
  const c = blockedCarrierFor("BLOCKED", [], [{ summary: "口径 与 overall v1.48 冲突" }]);
  expect(c.failure_category).toBe(FAILURE_CATEGORIES.PLAN_CONFLICT.id);
  expect(c.blocker).toContain("口径 与 overall v1.48 冲突");
});

it("blockedCarrierFor: real sources win — existing blocker / failure_category → 零伪造 carrier", () => {
  expect(blockedCarrierFor("BLOCKED", [{}], [], { blocker: "agent 声明的真实原因" })).toEqual({});
  expect(blockedCarrierFor("BLOCKED", [{}], [], { failure_category: FAILURE_CATEGORIES.TIMEOUT.id })).toEqual({});
});

it("blockedCarrierFor: 非 BLOCKED / 无车道 → {}（不发明散文）", () => {
  expect(blockedCarrierFor("APPROVED", [{}])).toEqual({});
  expect(blockedCarrierFor("BLOCKED")).toEqual({});
});

it("applyDerivedStatus: unverifiable 裸折消灭 — 派生 BLOCKED 必带 failure_category + blocker", () => {
  const d = applyDerivedStatus({ findings: [], unverifiable: [{ claim: "复现场景", why: "环境缺失" }] });
  expect(d.status).toBe("BLOCKED");
  expect(d.failure_category).toBe(FAILURE_CATEGORIES.UNVERIFIABLE.id);
  expect(d.blocker).toContain("复现场景");
  expect(d.blocker).toContain("环境缺失");
});

it("applyDerivedStatus: 无变化 → null（caller skip 写盘）；带 carrier 的 BLOCKED → 合并返回", () => {
  expect(applyDerivedStatus({ status: "APPROVED", findings: [] })).toBeNull();
  const d = applyDerivedStatus({ status: "BLOCKED", findings: [], unverifiable: [{}] });
  expect(d.status).toBe("BLOCKED");
  expect(d.failure_category).toBe(FAILURE_CATEGORIES.UNVERIFIABLE.id);
});

it("finalizeHandoff review 族 T14 复现场景：unverifiable → BLOCKED + UNVERIFIABLE + 真实 blocker + exit 1（反转 exit 0）", async () => {
  const r = await finalizeHandoff({
    mode: "review",
    agentHandoff: { findings: [], unverifiable: [{ claim: "90min 无拖死实证", why: "现场已恢复" }] },
  });
  expect(r.handoff.status).toBe("BLOCKED");
  expect(r.handoff.failure_category).toBe(FAILURE_CATEGORIES.UNVERIFIABLE.id);
  expect(r.handoff.blocker).toContain("90min 无拖死实证");
  expect(r.exitCode).toBe(1);
});

it("finalizeHandoff review 族：真 blocker 发现 → CHANGES_REQUESTED + exit 0（非 BLOCKED 通道）", async () => {
  const r = await finalizeHandoff({ mode: "review", agentHandoff: { findings: [{ severity: "blocker" }] } });
  expect(r.handoff.status).toBe("CHANGES_REQUESTED");
  expect(r.exitCode).toBe(0);
});

it("finalizeHandoff review 族 dev-measured：notes 记录接受项 + warn-only → APPROVED，零 unverifiable 零 BLOCK", async () => {
  const r = await finalizeHandoff({
    mode: "review",
    agentHandoff: {
      findings: [{ severity: "warn" }],
      notes: "§口径 dev-measured 验收项已经 evidence-contract accepted-noted（notes 记录，不写 unverifiable 不 BLOCK）",
    },
  });
  expect(r.handoff.status).toBe("APPROVED");
  expect(r.handoff.unverifiable).toBeUndefined();
  expect(r.handoff.blocker).toBeUndefined();
  expect(r.exitCode).toBe(0);
});

it("finalizeHandoff fix 族：BLOCKED → exit 1（任何通道 BLOCKED → 1）", async () => {
  const r = await finalizeHandoff({ mode: "fix", agentHandoff: { status: "BLOCKED", blocker: "真实原因" } });
  expect(r.handoff).toBeDefined();
  expect(r.exitCode).toBe(1);
});

it("finalizeHandoff implement 族：非 APPROVED 返回 → BLOCKED + exit 1", async () => {
  const ws = mkdtempSync(path.join(tmpdir(), "cdd-hf-impl-blocked-"));
  const brief = path.join(ws, "task-1-brief.md");
  writeFileSync(brief, "# task 1\nTASK_BASE: 9a4757b23b5f0634a8ef1d08e1d6c9d1c4f59c63\n");
  writeFileSync(path.join(ws, "task-1-test-evidence.json"), "{}");
  const r = await finalizeHandoff({
    mode: "implement",
    returnBlock: ["status: NEEDS_CONTEXT", "commits: base=x", "artifacts: ", "blocker: "],
    brief, workspace: ws, taskNum: 1,
  });
  expect(r.handoff.status).toBe("BLOCKED");
  expect(r.exitCode).toBe(1);
});

// ---- 三消费方共享同一 finalizeHandoff（导入断言，非各自接线）----

it("branch/docs/runner 三消费方共享同一 finalizeHandoff（非各自接线）", async () => {
  // Import assertion: the single finalization implementation = src/artifacts/handoff/finalize.ts
  // (the one .ts canonical after Task 8's full TS migration; post-T24-A the branch surface lives in
  // dispatch/branch.ts#BranchLifecycle — no longer a cli shell). All three consumers import
  // finalizeHandoff from that canonical module and no longer hand-wire their own applyDerivedStatus
  // read-back (the single final-entry point = finalizeHandoff; applyDerivedStatus is consumed only
  // by artifact/handoff/finalize.ts itself).
  const dir = new URL("../../../", import.meta.url); // packages/cdd-engine/（P6 Task 3 迁就近：src/artifacts/__tests__ → 3-up）
  const src = (rel) => readFileSync(new URL(rel, dir), "utf8");
  for (const rel of ["src/dispatch/task.ts", "src/dispatch/docs.ts", "src/dispatch/branch.ts"]) {
    expect(src(rel)).toMatch(/handoff\/finalize\.ts/);
    // 不得再各自手写 applyDerivedStatus 调用接线（注释提及无害；唯一定稿入口 = finalizeHandoff）
    expect(src(rel)).not.toMatch(/applyDerivedStatus\s*\(/);
  }
});
