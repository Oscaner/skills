// engine/tests/templates.test.mjs — T1: mode 模板渲染 + 行预算模块单测。
// renderModePrompt：读 skills/cli-driven-development/templates/<mode>.md，做
// {{PLACEHOLDER}} env 替换。renderTemplate：读 skills/_templates/<name>.md 全参数替换
// （migrated from cdd-review.mjs）。行预算 port
// cdd-orchestrator-line-budget.test.sh 的真实阈值）。
// 另含 prose-grep 治理守卫（T8 补回：port cdd-orchestrator-line-budget.test.sh +
// cdd-severity-contract.test.sh 的 grep-contracts —— 技能/模板/文档正文行数 + 语义锚点）。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { renderModePrompt, renderTemplate, lineBudget, LINE_BUDGETS, renderHandoffStub } from "../lib/templates.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = path.resolve(HERE, "../../.."); // packages/osuperpowers

test("renderModePrompt: implement 输出含 mode 模板 + env 替换 + 内联 Handoff Output", () => {
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

  // 内联 Handoff Output（替代 _handoff-write-fragment.md）
  assert.ok(out.includes("## Handoff Output"), "inline Handoff Output section");
  assert.ok(out.includes("### Segment: implement"), "implement segment");
  assert.ok(out.includes("task-{{TASK}}-test-evidence.json") === false, "{{TASK}} 已替换");

  // 无残留占位符
  for (const key of ["WORKSPACE", "BRIEF", "HANDOFF", "CONSTRAINTS", "TASK"]) {
    assert.ok(!out.includes(`{{${key}}}`), `无残留 {{${key}}}`);
  }
});

test("renderModePrompt: task-review/fix 模板同样渲染 + 内联 Handoff Output", () => {
  const env = { WORKSPACE: "/ws", BRIEF: "/ws/task-1-brief.md", HANDOFF: "/ws/task-1-handoff.json", CONSTRAINTS: "/ws/plan-constraints.md", TASK: "1" };
  const review = renderModePrompt("task-review", env);
  assert.match(review, /^# CDD task-review — CLI session/m);
  assert.ok(review.includes("### Segment: task-review"), "task-review segment");
  assert.ok(review.includes("## Handoff Output"), "inline Handoff Output in task-review");
  const fix = renderModePrompt("fix", env);
  assert.match(fix, /^# CDD fix — CLI session/m);
  assert.ok(fix.includes("### Segment: fix"), "fix segment");
  assert.ok(fix.includes("## Handoff Output"), "inline Handoff Output in fix");
});

test("renderModePrompt: 缺失模板 → 抛错", () => {
  assert.throws(() => renderModePrompt("no-such-mode", {}), /missing template/);
});

test("renderModePrompt: spec-review 不在 cli-driven-development/templates/ → 抛错（由 renderTemplate 加载）", () => {
  // spec-review 在 _templates/ 中，由 cdd-review.mjs 的 renderTemplate 函数加载；
  // renderModePrompt 只加载 cli-driven-development/templates/ 下的 mode 模板。
  assert.throws(() => renderModePrompt("spec-review", {}), /missing template/);
});

test("renderModePrompt: plan-review 不在 cli-driven-development/templates/ → 抛错（由 renderTemplate 加载）", () => {
  // plan-review 在 _templates/ 中，由 cdd-review.mjs 的 renderTemplate 函数加载。
  assert.throws(() => renderModePrompt("plan-review", {}), /missing template/);
});

test("renderTemplate: _templates/ 全参数替换 + 缺失占位符报错", () => {
  const out = renderTemplate("spec-review", { DOC: "/doc.md", PASS: "completeness" }, "test");
  assert.ok(out.includes("Spec Review"), "spec-review 模板可加载");
  assert.ok(!out.includes("{{DOC}}"), "DOC 已替换");
  assert.ok(out.includes("/doc.md"), "DOC 值正确");
  assert.ok(!out.includes("{{PASS}}"), "PASS 已替换");
  assert.ok(out.includes("completeness"), "PASS 值正确");
  // {{SPEC}} 未传 → 应报错
  assert.throws(() => renderTemplate("spec-review", { DOC: "/doc.md" }, "test"), /missing param/);
});

test("renderTemplate: 缺失模板 → 抛错", () => {
  assert.throws(() => renderTemplate("no-such-template", {}, "test"), /template not found/);
});

// #168 FINDINGS_SCOPE placeholder rendering
test("renderModePrompt #168: fix mode + FINDINGS_SCOPE=deferred-sweep → rendered", () => {
  const env = {
    WORKSPACE: "/ws", BRIEF: "/ws/b.md", HANDOFF: "/ws/h.json",
    CONSTRAINTS: "/ws/c.md", FINDINGS: "/ws/f.json", TASK: "1",
    FINDINGS_SCOPE: "deferred-sweep",
  };
  const out = renderModePrompt("fix", env);
  assert.ok(out.includes("deferred-sweep"), "FINDINGS_SCOPE should be rendered in fix mode");
  assert.ok(!out.includes("{{FINDINGS_SCOPE}}"), "no residual FINDINGS_SCOPE placeholder");
});

test("renderModePrompt #168: fix mode + default FINDINGS_SCOPE → blocker-only", () => {
  const env = {
    WORKSPACE: "/ws", BRIEF: "/ws/b.md", HANDOFF: "/ws/h.json",
    CONSTRAINTS: "/ws/c.md", FINDINGS: "/ws/f.json", TASK: "1",
    FINDINGS_SCOPE: "blocker-only",
  };
  const out = renderModePrompt("fix", env);
  assert.ok(out.includes("blocker-only"), "default FINDINGS_SCOPE should render");
  assert.ok(!out.includes("{{FINDINGS_SCOPE}}"), "no residual placeholder");
});

test("lineBudget: 真实阈值", () => {
  assert.equal(lineBudget("sdd"), 210);
  assert.equal(lineBudget("ctrl"), 50);
  assert.equal(lineBudget("tier1"), 260);
  assert.equal(lineBudget("tier2"), 331);
  assert.deepEqual(LINE_BUDGETS, { sdd: 210, ctrl: 50, tier1: 260, tier2: 331 });
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
  const sdd = wcLines("skills/cli-driven-development/SKILL.md");
  const ctrl = wcLines("skills/cli-driven-development/docs/controller-handoff.md");
  const rev = wcLines("skills/_docs/docs-review.md");
  const tier1 = sdd + ctrl;
  const tier2 = tier1 + rev;
  assert.ok(sdd <= lineBudget("sdd"), `cli-driven-development ${sdd} > ${lineBudget("sdd")}`);
  assert.ok(ctrl <= lineBudget("ctrl"), `controller-handoff ${ctrl} > ${lineBudget("ctrl")}`);
  assert.ok(tier1 <= lineBudget("tier1"), `Tier 1 ${tier1} > ${lineBudget("tier1")}`);
  assert.ok(tier2 <= lineBudget("tier2"), `Tier 2 ${tier2} > ${lineBudget("tier2")}`);
});

test("governance: wcLines 空/纯空白文件 → 0（0 分支覆盖）", () => {
  // tests/fixtures/whitespace.txt 为纯空白内容 —— wcLines 的 `text.trim() ? ... : 0` 假分支（返回 0）
  // 唯一覆盖点（其余 governance 目标均为非空文件，走 count 分支）。
  assert.equal(wcLines("tests/fixtures/whitespace.txt"), 0);
});

test("governance: D3/review/fix 语义锚点 + 禁用措辞", () => {
  const implement = readRel("skills/cli-driven-development/templates/implement.md");
  const review = readRel("skills/cli-driven-development/templates/task-review.md");
  const fix = readRel("skills/cli-driven-development/templates/fix.md");
  const dispatch = readRel("skills/_docs/docs-review.md");

  // inline Handoff Output segment：deferred 保留 + blocker-only open-findings + merge
  assert.ok(implement.includes("### Segment: implement"), "implement inline segment");
  assert.ok(review.includes("### Segment: task-review"), "task-review inline segment");
  assert.ok(fix.includes("### Segment: fix"), "fix inline segment");
  assert.ok(review.includes("deferred: true"), "review deferred marking");
  assert.ok(review.includes("non-deferred = blocker findings only"), "review blocker-only open-findings");
  assert.ok(/Preserve all `deferred: true` findings/.test(fix), "fix segment preserves deferred");
  assert.ok(/never replace wholesale/.test(review), "review segment merge semantics");

  // task-review.md: blocker → CHANGES_REQUESTED（新措辞）替换旧 empty → APPROVED
  assert.ok(/blocker → CHANGES_REQUESTED/.test(review), "review status mapping");
  assert.ok(/warn\/nit → APPROVED/.test(review), "review warn/nit mapping (replaces old 'empty → APPROVED')");
  assert.ok(!review.includes("empty → APPROVED"), "old 'empty → APPROVED' removed");

  // fix.md: deferred + open-findings blocker-only
  assert.ok(fix.includes("deferred"), "fix deferred");
  assert.ok(fix.includes("blocker-only"), "fix open-findings blocker-only");

  // D3 severity behavioral anchors
  assert.ok(dispatch.includes("must fix before merge"), "D3 blocker anchor");
  assert.ok(dispatch.includes("deferrable minor"), "D3 warn anchor");
  assert.ok(dispatch.includes("pure style"), "D3 nit anchor");
  assert.ok(dispatch.includes("Rule: Review Stopping"), "D3 deferred field (via Rule: Review Stopping)");
  assert.ok(/warn\/nit.*Rule: Review Stopping/.test(dispatch), "D3 warn/nit → Review Stopping");

  // P5 deletion guard (P8 update): legacy "### Rule: Final Review" replaced by node-anchored
  // `branch-review` + `handoff-finishing` nodes. Governance anchors updated to node-anchored format.
  const cdd = readRel("skills/cli-driven-development/SKILL.md");
  assert.ok(cdd.includes("### `branch-review`"), "branch-review node anchor (replaces Rule: Final Review)");
  assert.ok(cdd.includes("osuperpowers:finishing"), "handoff-finishing node references osuperpowers:finishing");
});

test("governance: branch-review 模板基线标注（P5 task 3：BASE=origin/develop 集成点）", () => {
  const lines = readRel("skills/_templates/branch-review.md").split("\n");
  const headingIdx = lines.findIndex((l) => l.trim() === "# Branch Review");
  assert.ok(headingIdx >= 0, "# Branch Review 标题存在");
  // 标题后第一行必须是整分支基线标注注释（spec 原文，防误改回 origin/main 基线）
  assert.equal(
    lines[headingIdx + 1],
    "<!-- Whole-branch review baseline: origin/develop (git merge-base origin/develop HEAD), not origin/main. Aligned with cli-driven-development Rule: Final Review. -->",
    "标题后紧跟基线标注注释",
  );
});

// T2: fix.md 模板禁止 DONE（AC#3）
test("templates #T2: fix.md 渲染后 handoff 指令不含 DONE 关键词", () => {
  const env = {
    WORKSPACE: "/ws", BRIEF: "/ws/b.md", HANDOFF: "/ws/h.json",
    CONSTRAINTS: "/ws/c.md", FINDINGS: "/ws/f.json", TASK: "1",
    FINDINGS_SCOPE: "blocker-only",
  };
  const out = renderModePrompt("fix", env);
  // fix 模板的 H1 Return 行和 handoff 段不应包含 DONE 作为 status 选项
  // （DONE/OK/COMPLETED 已被 runner.mjs 归一化为 APPROVED）
  assert.ok(!/status:.*DONE/.test(out), "fix template must not contain DONE as status option");
  assert.ok(!/status:.*\bOK\b/.test(out), "fix template must not contain OK as status option");
  assert.ok(!/status:.*COMPLETED/.test(out), "fix template must not contain COMPLETED as status option");
  // 应使用 APPROVED 或 BLOCKED
  assert.ok(out.includes("APPROVED") || out.includes("BLOCKED"), "fix template uses APPROVED or BLOCKED");
});

// T2: implement.md H1 使用 APPROVED 而非 DONE
test("templates #T2: implement.md H1 使用 APPROVED 而非 DONE", () => {
  const env = {
    WORKSPACE: "/ws", BRIEF: "/ws/b.md", HANDOFF: "/ws/h.json",
    CONSTRAINTS: "/ws/c.md", TASK: "1",
  };
  const out = renderModePrompt("implement", env);
  // implement 模板的 H1 Return 行应使用 APPROVED 而非 DONE
  assert.ok(!out.match(/status:.*\bDONE\b/), "implement template H1 must not use DONE as status option");
});

// ---- renderHandoffStub ----

import { loadHandoffSchema } from "../lib/schema-utils.mjs";

test("renderHandoffStub: renders JSON code block with all required fields", () => {
  const schema = loadHandoffSchema();
  const out = renderHandoffStub(schema, "implement", 3);
  assert.ok(out.startsWith("```json\n"), "output starts with JSON code fence");
  assert.ok(out.endsWith("\n```"), "output ends with closing fence");
  const inner = JSON.parse(out.replace(/^```json\n/, "").replace(/\n```$/, ""));
  assert.equal(inner.task, 3, "task = taskNum");
  assert.equal(inner.phase, "implement", "phase = mode");
  assert.equal(inner.status, "APPROVED", "status = APPROVED");
  assert.deepEqual(inner.findings, [], "findings = []");
  assert.deepEqual(inner.artifacts, {}, "artifacts = {}");
});

test("renderHandoffStub: mode=task-review sets phase correctly", () => {
  const schema = loadHandoffSchema();
  const out = renderHandoffStub(schema, "task-review", 7);
  const inner = JSON.parse(out.replace(/^```json\n/, "").replace(/\n```$/, ""));
  assert.equal(inner.phase, "task-review");
  assert.equal(inner.task, 7);
});

test("renderHandoffStub: mode=fix sets phase correctly", () => {
  const schema = loadHandoffSchema();
  const out = renderHandoffStub(schema, "fix", 2);
  const inner = JSON.parse(out.replace(/^```json\n/, "").replace(/\n```$/, ""));
  assert.equal(inner.phase, "fix");
  assert.equal(inner.task, 2);
});

test("renderHandoffStub: taskNum undefined → task=0", () => {
  const schema = loadHandoffSchema();
  const out = renderHandoffStub(schema, "implement", undefined);
  const inner = JSON.parse(out.replace(/^```json\n/, "").replace(/\n```$/, ""));
  assert.equal(inner.task, 0);
});

test("renderHandoffStub: taskNum=0 → task=0", () => {
  const schema = loadHandoffSchema();
  const out = renderHandoffStub(schema, "implement", 0);
  const inner = JSON.parse(out.replace(/^```json\n/, "").replace(/\n```$/, ""));
  assert.equal(inner.task, 0);
});

test("renderHandoffStub: docPath provided → doc_path in stub (if schema requires it)", () => {
  // The CDD handoff schema does not require doc_path; this verifies the function handles
  // the doc_path case without erroring (docs schema variant would include it).
  const schema = { required: ["task", "phase", "status", "artifacts", "findings", "doc_path"], properties: {} };
  const out = renderHandoffStub(schema, "implement", 1, { docPath: "/path/to/doc.md" });
  const inner = JSON.parse(out.replace(/^```json\n/, "").replace(/\n```$/, ""));
  assert.equal(inner.doc_path, "/path/to/doc.md", "doc_path from option");
});

test("renderHandoffStub: docPath absent → doc_path empty string", () => {
  const schema = { required: ["doc_path"], properties: {} };
  const out = renderHandoffStub(schema, "implement", 1);
  const inner = JSON.parse(out.replace(/^```json\n/, "").replace(/\n```$/, ""));
  assert.equal(inner.doc_path, "");
});

// ---- {{HANDOFF_STUB}} replacement in renderModePrompt ----

test("renderModePrompt: implement — no residual {{HANDOFF_STUB}} in rendered output", () => {
  const env = { WORKSPACE: "/ws", BRIEF: "/ws/b.md", HANDOFF: "/ws/h.json", CONSTRAINTS: "/ws/c.md", TASK: "5" };
  const out = renderModePrompt("implement", env);
  assert.ok(!out.includes("{{HANDOFF_STUB}}"), "no residual {{HANDOFF_STUB}} in implement output");
  // Stub content should be present: valid JSON block
  assert.ok(out.includes("```json"), "JSON code block injected by HANDOFF_STUB");
  assert.ok(out.includes('"phase": "implement"'), "stub contains phase=implement");
  assert.ok(out.includes('"task": 5'), "stub contains task=5 (integer)");
});

test("renderModePrompt: task-review — no residual {{HANDOFF_STUB}}, stub has phase=task-review", () => {
  const env = { WORKSPACE: "/ws", BRIEF: "/ws/b.md", HANDOFF: "/ws/h.json", CONSTRAINTS: "/ws/c.md", TASK: "3", FIXED_POINT: "abc" };
  const out = renderModePrompt("task-review", env);
  assert.ok(!out.includes("{{HANDOFF_STUB}}"), "no residual {{HANDOFF_STUB}} in task-review output");
  assert.ok(out.includes('"phase": "task-review"'), "stub has phase=task-review");
  assert.ok(out.includes('"task": 3'), "stub has task=3");
});

test("renderModePrompt: fix — no residual {{HANDOFF_STUB}}, stub has phase=fix", () => {
  const env = {
    WORKSPACE: "/ws", BRIEF: "/ws/b.md", HANDOFF: "/ws/h.json",
    CONSTRAINTS: "/ws/c.md", FINDINGS: "/ws/f.json", TASK: "2",
    FINDINGS_SCOPE: "blocker-only", FIXED_POINT: "abc",
  };
  const out = renderModePrompt("fix", env);
  assert.ok(!out.includes("{{HANDOFF_STUB}}"), "no residual {{HANDOFF_STUB}} in fix output");
  assert.ok(out.includes('"phase": "fix"'), "stub has phase=fix");
  assert.ok(out.includes('"task": 2'), "stub has task=2");
});

test("renderModePrompt: TASK env not set → stub.task=0 (parseInt fallback)", () => {
  const env = { WORKSPACE: "/ws", BRIEF: "/ws/b.md", HANDOFF: "/ws/h.json", CONSTRAINTS: "/ws/c.md" };
  const out = renderModePrompt("implement", env);
  assert.ok(out.includes('"task": 0'), "stub.task=0 when TASK env missing");
});
