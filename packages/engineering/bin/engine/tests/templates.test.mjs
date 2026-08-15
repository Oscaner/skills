// engine/tests/templates.test.mjs — T1: mode 模板渲染 + 行预算模块单测。
// renderModePrompt：读 templates/cdd/<mode>.md + _handoff-write-fragment.md，做
// {{PLACEHOLDER}} env 替换。lineBudget：真实阈值（port cdd-orchestrator-line-budget.test.sh：
// sdd≤160 / ctrl≤110 / tier1≤225 / tier2≤350，非旧 121/165）。
import { test } from "node:test";
import assert from "node:assert/strict";

import { renderModePrompt, lineBudget, LINE_BUDGETS } from "../lib/templates.mjs";

test("renderModePrompt: implement 输出含 mode 模板 + env 替换 + handoff-write 片段", () => {
  const env = {
    WORKSPACE: "/ws/render",
    BRIEF: "/ws/render/task-1-brief.md",
    HANDOFF: "/ws/render/task-1-handoff.json",
    CONSTRAINTS: "/ws/render/plan-constraints.md",
    TASK: "1",
  };
  const out = renderModePrompt("implement", env);

  // mode 模板首行 + env 替换
  assert.match(out, /^# CDD implement — CLI session/m);
  assert.ok(out.includes("**Workspace:** /ws/render"), "{{WORKSPACE}} 替换");
  assert.ok(out.includes("**Task brief:** /ws/render/task-1-brief.md"), "{{BRIEF}} 替换");
  assert.ok(out.includes("**Handoff path (write at end of this mode):** /ws/render/task-1-handoff.json"), "{{HANDOFF}} 替换");
  assert.ok(out.includes("**Plan constraints:** /ws/render/plan-constraints.md"), "{{CONSTRAINTS}} 替换");

  // handoff-write 片段（_handoff-write-fragment.md）包含在输出中
  assert.ok(out.includes("## Handoff write"), "handoff-write 片段标题");
  assert.ok(out.includes("### Segment: implement"), "implement 段");
  assert.ok(out.includes("task-{{TASK}}-test-evidence.json") === false, "{{TASK}} 已替换");

  // 无残留占位符
  for (const key of ["WORKSPACE", "BRIEF", "HANDOFF", "CONSTRAINTS", "TASK"]) {
    assert.ok(!out.includes(`{{${key}}}`), `无残留 {{${key}}}`);
  }
});

test("renderModePrompt: review/fix 模板同样渲染 + 片段", () => {
  const env = { WORKSPACE: "/ws", BRIEF: "/ws/task-1-brief.md", HANDOFF: "/ws/task-1-handoff.json", CONSTRAINTS: "/ws/plan-constraints.md", TASK: "1" };
  const review = renderModePrompt("review", env);
  assert.match(review, /^# CDD review — CLI session/m);
  assert.ok(review.includes("### Segment: review"), "review 段");
  const fix = renderModePrompt("fix", env);
  assert.match(fix, /^# CDD fix — CLI session/m);
  assert.ok(fix.includes("### Segment: fix"), "fix 段");
});

test("renderModePrompt: 缺失模板 → 抛错", () => {
  assert.throws(() => renderModePrompt("no-such-mode", {}), /missing template/);
});

test("lineBudget: 真实阈值", () => {
  assert.equal(lineBudget("sdd"), 160);
  assert.equal(lineBudget("ctrl"), 110);
  assert.equal(lineBudget("tier1"), 225);
  assert.equal(lineBudget("tier2"), 350);
  assert.deepEqual(LINE_BUDGETS, { sdd: 160, ctrl: 110, tier1: 225, tier2: 350 });
});

test("lineBudget: 未知 tier → 抛错", () => {
  assert.throws(() => lineBudget("tier9"), /unknown line budget tier/);
});
