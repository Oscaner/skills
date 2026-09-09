// packages/cdd-engine/bin/tests/handoff-finalize.test.mjs — T7: handoff 载体定稿单点单元测试。
// finalizeHandoff 是唯一 定稿入口（engine 载体唯一作者）：review 族 rollup 派生 / implement 族实体化
//（无 agentHandoff 输入槽位）/ fix 族 agent 声明保留。三消费方（runner/docs-runner/cdd.mjs）
// 共享同一实现 —— 非各自接线（导入断言）。
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { finalizeHandoff } from "../lib/handoff-finalize.mjs";
import { writeOwnHandoff } from "../lib/contract.mjs";
import { gitInit } from "./helpers.mjs";

// ---- review 族：rollup 派生（applyDerivedStatus；SP-4 失败轮次豁免）----

it("finalizeHandoff review 族：agent 写 warn-only CHANGES_REQUESTED → 定稿 APPROVED（rollup 派生）", () => {
  const agentHandoff = { status: "CHANGES_REQUESTED", findings: [{ severity: "warn" }] };
  const r = finalizeHandoff({ mode: "review", agentHandoff });
  expect(r.handoff.status).toBe("APPROVED");
  expect(r.handoff.findings).toEqual([{ severity: "warn" }]);
  expect(r.handoff).not.toBe(agentHandoff); // 派生返回新对象（不原地修改 agent 内容）
  expect(r.exitCode).toBe(0);
});

it("finalizeHandoff review 族：无变化 → 返回原对象（不写盘；caller 以引用判定 skip）", () => {
  const agentHandoff = { status: "APPROVED", findings: [] };
  const r = finalizeHandoff({ mode: "review", agentHandoff });
  expect(r.handoff).toBe(agentHandoff);
  expect(r.exitCode).toBe(0);
});

it("finalizeHandoff review 族 SP-4 豁免：agent status BLOCKED + findings:[] → 保持 BLOCKED（失败轮次不覆写）", () => {
  const agentHandoff = { status: "BLOCKED", findings: [], blocker: "boom" };
  const r = finalizeHandoff({ mode: "review", agentHandoff });
  expect(r.handoff.status).toBe("BLOCKED");
});

// ---- implement 族：实体化，输入无 agentHandoff 槽位 ----

it("finalizeHandoff implement 族：输入无 agentHandoff 槽位（通过类型避免残留路径）", () => {
  // 从 H1 + brief TASK_BASE + git HEAD 实体化（T6 逻辑迁入；commits 单一权威）。
  const repo = mkdtempSync(path.join(tmpdir(), "cdd-hf-impl-repo-"));
  gitInit(repo);
  const ws = mkdtempSync(path.join(tmpdir(), "cdd-hf-impl-ws-"));
  const taskBase = "9a4757b23b5f0634a8ef1d08e1d6c9d1c4f59c63";
  const brief = path.join(ws, "task-1-brief.md");
  writeFileSync(brief, `# task 1\nTASK_BASE: ${taskBase}\n`);
  writeFileSync(path.join(ws, "task-1-test-evidence.json"), "{}"); // behavior_change !== true → soft 空
  const actualHead = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim();
  const r = finalizeHandoff({
    mode: "implement",
    h1: [
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

it("finalizeHandoff implement 族：brief 无 TASK_BASE → 降级 fail-open（不实体化，handoff:null + exit 0）", () => {
  const ws = mkdtempSync(path.join(tmpdir(), "cdd-hf-impl-fail-"));
  const brief = path.join(ws, "task-1-brief.md");
  writeFileSync(brief, "# task 1\nno TASK_BASE here\n");
  const r = finalizeHandoff({ mode: "implement", h1: ["status: APPROVED"], brief, workspace: ws, taskNum: 1 });
  expect(r.handoff).toBeNull();
  expect(r.exitCode).toBe(0);
});

// ---- fix 族：work 型 — agent 声明保留，契约在 commit-contract 层否决 ----

it("finalizeHandoff fix 族：agent 声明保留（不派生覆写）", () => {
  const agentHandoff = { status: "APPROVED", findings: [{ severity: "blocker" }], blocker: "uncommitted" };
  const r = finalizeHandoff({ mode: "fix", agentHandoff });
  expect(r.handoff).toBe(agentHandoff);
  expect(r.exitCode).toBe(0);
});

it("finalizeHandoff 未知 mode → 抛错（定稿分派契约）", () => {
  expect(() => finalizeHandoff({ mode: "task-review", agentHandoff: {} })).toThrow(/unknown mode/);
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

// ---- 三消费方共享同一 finalizeHandoff（导入断言，非各自接线）----

it("branch/docs/runner 三消费方共享同一 finalizeHandoff（非各自接线）", async () => {
  // 导入断言：唯一定稿实现 = lib/handoff-finalize.mjs。三消费方（runner/docs-runner/cdd.mjs）
  // 全部从该 canonical 模块导入 finalizeHandoff，且不再各自手写 applyDerivedStatus 读回接线
  //（唯一定稿入口 = finalizeHandoff；applyDerivedStatus 只被 handoff-finalize.mjs 本身消费）。
  const dir = new URL("../", import.meta.url); // bin/
  const src = (rel) => readFileSync(new URL(rel, dir), "utf8");
  for (const rel of ["lib/runner.mjs", "lib/docs-runner.mjs", "cdd.mjs"]) {
    expect(src(rel)).toMatch(/handoff-finalize\.mjs/);
    // 不得再各自手写 applyDerivedStatus 调用接线（注释提及无害；唯一定稿入口 = finalizeHandoff）
    expect(src(rel)).not.toMatch(/applyDerivedStatus\s*\(/);
  }
});