// engine/tests/templates.test.mjs — T1: mode 模板渲染 + 行预算模块单测。
// renderModePrompt：读 templates/cdd/<mode>.md + _handoff-write-fragment.md，做
// {{PLACEHOLDER}} env 替换。lineBudget：真实阈值（port cdd-orchestrator-line-budget.test.sh：
// sdd≤160 / ctrl≤110 / tier1≤225 / tier2≤350，非旧 121/165）。
// 另含 prose-grep 治理守卫（T8 补回：port cdd-orchestrator-line-budget.test.sh +
// cdd-severity-contract.test.sh 的 grep-contracts —— 技能/模板/文档正文行数 + 语义锚点）。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { renderModePrompt, lineBudget, LINE_BUDGETS } from "../lib/templates.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = path.resolve(HERE, "../../.."); // packages/osuperpowers

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

test("renderModePrompt: task-review/fix 模板同样渲染 + 片段", () => {
  const env = { WORKSPACE: "/ws", BRIEF: "/ws/task-1-brief.md", HANDOFF: "/ws/task-1-handoff.json", CONSTRAINTS: "/ws/plan-constraints.md", TASK: "1" };
  const review = renderModePrompt("task-review", env);
  assert.match(review, /^# CDD task-review — CLI session/m);
  assert.ok(review.includes("### Segment: task-review"), "task-review 段");
  const fix = renderModePrompt("fix", env);
  assert.match(fix, /^# CDD fix — CLI session/m);
  assert.ok(fix.includes("### Segment: fix"), "fix 段");
});

test("renderModePrompt: 缺失模板 → 抛错", () => {
  assert.throws(() => renderModePrompt("no-such-mode", {}), /missing template/);
});

test("renderModePrompt: spec-review 模板可加载但占位符由 cdd-exec renderTemplate 处理", () => {
  // renderModePrompt 只替换 CDD 标准占位符（WORKSPACE/BRIEF/HANDOFF/CONSTRAINTS/TASK/FINDINGS/FIXED_POINT）；
  // DOC/PASS/SPEC 不在列表中 → renderModePrompt 不做替换。
  // spec-review/plan-review 的 {{DOC}}/{{PASS}}/{{SPEC}} 由 cdd-exec.mjs 的 renderTemplate 函数
  // （全参数替换 + 缺失占位符报错）处理。该行为已在 exec.test.mjs 的 spawn 测试中覆盖。
  const out = renderModePrompt("spec-review", {});
  assert.ok(out.includes("Spec Review"), "spec-review 模板可加载");
  assert.ok(out.includes("{{DOC}}"), "DOC 不在 PLACEHOLDERS 中，保留原样（由 cdd-exec renderTemplate 替换）");
});

test("renderModePrompt: plan-review 模板可加载但占位符由 cdd-exec renderTemplate 处理", () => {
  const out = renderModePrompt("plan-review", {});
  assert.ok(out.includes("Plan Review"), "plan-review 模板可加载");
  assert.ok(out.includes("{{DOC}}"), "DOC 不在 PLACEHOLDERS 中");
  assert.ok(out.includes("{{SPEC}}"), "SPEC 不在 PLACEHOLDERS 中");
  assert.ok(out.includes("{{PASS}}"), "PASS 不在 PLACEHOLDERS 中");
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

// ---- prose-grep 治理守卫（T8 补回 —— 删除的 line-budget/severity-contract shell 测试）----

function readRel(rel) {
  const p = path.join(PLUGIN_ROOT, rel);
  if (!existsSync(p)) throw new Error(`governance target missing: ${rel}`);
  return readFileSync(p, "utf8");
}

function wcLines(rel) {
  const text = readRel(rel);
  return text.trim() ? text.split("\n").length - 1 : 0;
}

test("governance: 真实行预算（sdd/ctrl/tier1/tier2 实测宿主）", () => {
  const sdd = wcLines("skills/executing-plans/SKILL.md");
  const ctrl = wcLines("docs/controller-handoff.md");
  const life = wcLines("docs/subagent-lifecycle.md");
  const rev = wcLines("docs/review-dispatch.md");
  const tier1 = sdd + ctrl;
  const tier2 = tier1 + life + rev;
  assert.ok(sdd <= lineBudget("sdd"), `executing-plans ${sdd} > ${lineBudget("sdd")}`);
  assert.ok(ctrl <= lineBudget("ctrl"), `controller-handoff ${ctrl} > ${lineBudget("ctrl")}`);
  assert.ok(tier1 <= lineBudget("tier1"), `Tier 1 ${tier1} > ${lineBudget("tier1")}`);
  assert.ok(tier2 <= lineBudget("tier2"), `Tier 2 ${tier2} > ${lineBudget("tier2")}`);
});

test("governance: wcLines 空/纯空白文件 → 0（0 分支覆盖）", () => {
  // tests/fixtures/whitespace.txt 为纯空白内容 —— wcLines 的 `text.trim() ? ... : 0` 假分支（返回 0）
  // 唯一覆盖点（其余 governance 目标均为非空文件，走 count 分支）。
  assert.equal(wcLines("tests/fixtures/whitespace.txt"), 0);
});

test("governance: 技能 + 模板行数上限（防 runaway prose）", () => {
  for (const ent of readdirSync(path.join(PLUGIN_ROOT, "skills"), { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const n = wcLines(`skills/${ent.name}/SKILL.md`);
    assert.ok(n <= 200, `skills/${ent.name}/SKILL.md ${n} > 200`);
  }
  for (const f of readdirSync(path.join(PLUGIN_ROOT, "templates", "cdd"))) {
    const n = wcLines(`templates/cdd/${f}`);
    assert.ok(n <= 60, `templates/cdd/${f} ${n} > 60`);
  }
});

test("governance: D3/review/fix 语义锚点 + 禁用措辞", () => {
  const fragment = readRel("templates/cdd/_handoff-write-fragment.md");
  const review = readRel("templates/cdd/task-review.md");
  const fix = readRel("templates/cdd/fix.md");
  const dispatch = readRel("docs/review-dispatch.md");
  const skill = readRel("skills/executing-plans/SKILL.md");

  // review segment：deferred 保留 + blocker-only open-findings + merge
  assert.ok(fragment.includes("deferred: true"), "fragment deferred marking");
  assert.ok(fragment.includes("non-deferred = blocker findings only"), "fragment blocker-only open-findings");
  assert.ok(/Preserve all `deferred: true` findings/.test(fragment), "fix segment preserves deferred");
  assert.ok(/never replace wholesale/.test(fragment), "review segment merge semantics");

  // task-review.md: blocker → CHANGES_REQUESTED（新措辞）替换旧 empty → APPROVED
  assert.ok(/blocker → CHANGES_REQUESTED/.test(review), "review status mapping");
  assert.ok(/warn\/nit → APPROVED/.test(review), "review warn/nit mapping (replaces old 'empty → APPROVED')");
  assert.ok(!review.includes("empty → APPROVED"), "old 'empty → APPROVED' removed");

  // fix.md: deferred + open-findings blocker-only
  assert.ok(fix.includes("deferred"), "fix deferred");
  assert.ok(fix.includes("open-findings 只含 blocker"), "fix open-findings blocker-only");

  // D3 severity behavioral anchors
  assert.ok(dispatch.includes("must fix before merge"), "D3 blocker anchor");
  assert.ok(dispatch.includes("deferrable minor"), "D3 warn anchor");
  assert.ok(dispatch.includes("pure style"), "D3 nit anchor");
  assert.ok(dispatch.includes("deferred: true"), "D3 deferred field");
  assert.ok(/warn\/nit do not enter the fix loop/.test(dispatch), "D3 warn/nit no fix loop");

  // D6 end semantics（executing-plans Rule: D6 Aggregation）
  const d6 = skill.slice(skill.indexOf("### Rule: D6 Aggregation"));
  assert.ok(d6.includes("deferred"), "D6 aggregation deferred");
  assert.ok(d6.includes("bounded final fix wave"), "D6 bounded final fix wave");
  assert.ok(d6.includes("not rewritten"), "D6 no handoff rewrite");
  assert.ok(d6.includes("unconditionally report to the user"), "D6 unconditional user report");
  assert.ok(d6.includes("no cross-task fix loop"), "D6 no cross-task fix loop");
});
