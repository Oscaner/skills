// packages/osuperpowers/tests/report-templates.test.mjs — Task 14: renderer
// 裸调用单模式重写（spec §2.5 全表 + §2.10 测试面）。
// 落点 = validate 5b 的 node:test 面（packages/osuperpowers/tests/*.test.mjs）。
// 覆盖：renderYml 新址（emit-only 模块 + yaml.stringify 字节 golden）· 入参校验（findings
// 非空 / type·lang 枚举 / meta.skill·step 必填 → exit 1 + 字段路径）· 聚合 body 渲染
// （Session 一行 Harness + findings 分型分段 × N、每 finding 后 2 行 report-meta + 尾收
// Dedup/Related）· 零旧模式残留 · 聚合 body 裸调用入口零 yaml import。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { renderYml } from "../scripts/render-yaml.mjs";
import { renderMeta, renderBody, validateInput } from "../scripts/report-templates.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RENDERER = path.resolve(HERE, "../scripts/report-templates.mjs");
const RENDER_YAML = path.resolve(HERE, "../scripts/render-yaml.mjs");
const META = JSON.parse(
  readFileSync(
    path.resolve(HERE, "../skills/report-issues/templates/finding-meta.json"),
    "utf8",
  ),
);

// 零残留 / 零 yaml import 守卫读取的模块源码。
const RENDERER_SRC = readFileSync(RENDERER, "utf8");
const RENDER_YAML_SRC = readFileSync(RENDER_YAML, "utf8");

// 裸调用 CLI 助手：`node report-templates.mjs < stdin`。
function runCli(json) {
  return spawnSync(process.execPath, [RENDERER], {
    input: JSON.stringify(json),
    encoding: "utf8",
  });
}

// --- renderYml（emit-only 模块：scripts/render-yaml.mjs + yaml.stringify）---
// 固定小形 formDef —— 两表单 canonical 现态：仅 component dropdown（零 session-type）。
// expected 为独立手写字面（非代码重算），且在 yaml.stringify 字节侧做 round-trip：
// YAML.parse 回读结构与 canonical 等价，emit:check 作为输出新鲜度守卫。
const FORM = {
  frontmatter: {
    name: "Bug report",
    description: "Report a bug found while using osuperpowers skills (dogfood)",
    labels: ["bug", "osuperpowers"],
  },
  body: [
    { type: "markdown", attributes: { value: "Use this template.\n" } },
    {
      type: "dropdown",
      id: "component",
      attributes: {
        label: "Component",
        description: "Which component does this finding relate to?",
      },
      validations: { required: true },
    },
    {
      type: "textarea",
      id: "context",
      attributes: {
        label: "Context",
        description: "Dogfood session context: date, harness, which osuperpowers skills were in use",
      },
      validations: { required: true },
    },
  ],
};
const ENUMS = {
  components: ["osuperpowers (general)", "cdd-engine", "osuperpowers:writing-plans"],
};

const GOLDEN_YML = `name: Bug report
description: Report a bug found while using osuperpowers skills (dogfood)
labels:
  - bug
  - osuperpowers
body:
  - type: markdown
    attributes:
      value: |
        Use this template.
  - type: dropdown
    id: component
    attributes:
      label: Component
      description: Which component does this finding relate to?
      options:
        - osuperpowers (general)
        - cdd-engine
        - osuperpowers:writing-plans
    validations:
      required: true
  - type: textarea
    id: context
    attributes:
      label: Context
      description: "Dogfood session context: date, harness, which osuperpowers skills were in use"
    validations:
      required: true
`;

test("renderYml（emit-only + yaml.stringify）：固定 golden 同字节，EOF 换行", () => {
  assert.equal(renderYml(FORM, ENUMS), GOLDEN_YML);
});

test("renderYml 仅 component dropdown 注入枚举（无其他 options 注入面）", () => {
  const yml = renderYml(FORM, ENUMS);
  assert.equal((yml.match(/^      options:$/gm) ?? []).length, 1);
  assert.equal((yml.match(/^        - /gm) ?? []).length, 3);
});

// 单源化本质断言：formFieldDefs 内零 options 数组（枚举只留顶层 components）。
test("canonical 单源：formFieldDefs 内零 options 数组", () => {
  for (const [name, formDef] of Object.entries(META.formFieldDefs)) {
    for (const item of formDef.body) {
      assert.ok(
        !item.attributes.options,
        `formFieldDefs.${name} 的 ${item.id} 不应内联 options（枚举只留顶层）`,
      );
    }
  }
});

// 取值同步（§2.6.1 口径）：P4 删 init、加 3 个新 spec-writer；report-issues 为 P5 改名后的现名。
test("canonical 取值同步：init 移除 + 3 个 spec-writer 加入 + report-issues 现名", () => {
  const components = META.components;
  assert.ok(!components.includes("osuperpowers:init"), "枚举不得残留 osuperpowers:init");
  for (const spec of [
    "osuperpowers:writing-single-spec",
    "osuperpowers:writing-overall-spec",
    "osuperpowers:writing-phase-spec",
  ]) {
    assert.ok(components.includes(spec), `枚举应含 ${spec}（取值同步）`);
  }
  assert.ok(components.includes("osuperpowers:report-issues"), "枚举应含 osuperpowers:report-issues（P5 改名）");
});

// --- renderMeta（canonical metaFields 2 字段驱动）---
test("renderMeta 输出 report-meta 二字段 bullet（skill/step，canonical metaFields 驱动）", () => {
  assert.equal(
    renderMeta({ skill: "report-issues", step: "review" }),
    "- Skill: report-issues\n- Step: review",
  );
});

// --- 聚合 body 渲染（§2.5 布局）---
// 两 finding × mixed type（bug/en + enhancement/zh）——分段序 oracle = canonical
// sectionLabels；related 全形态（open / closed / program）。expected 为独立手写字面
// （布局按 spec §2.5 钉死：Session 一行 → finding 块 × N → 尾收 Dedup/Related 单段）。
const INPUT = {
  harness: "claude-code",
  findings: [
    {
      type: "bug",
      lang: "en",
      context: "Ran branch-review on cdd-engine-overhaul-p4",
      problem: "Stopped before emitting findings",
      impact: "Blocked the whole phase",
      suggestedFix: "Skip idempotent reruns",
      meta: { skill: "cli-driven-development", step: "3-2" },
    },
    {
      type: "enhancement",
      lang: "zh",
      context: "重复 fix 循环无上限",
      problem: "fix 轮次由 reviewer 全量重跑",
      impact: "浪费 token",
      suggestedFix: "引入 review convergence 配额",
      meta: { skill: "writing-plans", step: "5-1" },
    },
  ],
  related: {
    open: [{ issue: 231, component: "cdd-engine", reason: "timeout on rerun" }],
    closed: [{ issue: 230 }],
    program: { issue: 262 },
  },
};

const GOLDEN_BODY = `## Session
- Harness: claude-code

## Context

Ran branch-review on cdd-engine-overhaul-p4

## Problem

Stopped before emitting findings

## Impact

Blocked the whole phase

## Suggested fix

Skip idempotent reruns
- Skill: cli-driven-development
- Step: 3-2

## 背景

重复 fix 循环无上限

## 当前行为

fix 轮次由 reviewer 全量重跑

## 期望行为

浪费 token

## 建议方案

引入 review convergence 配额
- Skill: writing-plans
- Step: 5-1

## Dedup
- Dedup → #231 (open)：cdd-engine · timeout on rerun

## Related
- Regression / follow-up of #230 (closed)
- Program: #262`;

test("聚合渲染：mixed type × N 固定 golden（Session 一行 + 分型分段 + meta 归属 + 尾收）", () => {
  assert.equal(renderBody(INPUT), GOLDEN_BODY);
});

test("N-finding meta 关联：逐 finding 四段后紧跟其 Skill/Step 归属（位置邻接，跨 skill 不歧义）", () => {
  const body = renderBody(INPUT);
  // 按队列序切出每 finding 块：块起点 = 该 finding 的 context 段 heading。
  const boundaries = [0];
  for (const finding of INPUT.findings) {
    const contextLabel = META.sectionLabels[finding.type][finding.lang].context;
    const start = body.indexOf(contextLabel, boundaries[boundaries.length - 1]);
    assert.ok(start >= 0, `finding ${finding.meta.skill} 的 ${contextLabel} 段应存在`);
    boundaries.push(start);
  }
  const dedupIdx = body.indexOf("\n## Dedup");
  for (let i = 0; i < INPUT.findings.length; i++) {
    const end = i + 1 < INPUT.findings.length ? boundaries[i + 2] : (dedupIdx >= 0 ? dedupIdx : body.length);
    const block = body.slice(boundaries[i + 1], end).trimEnd();
    const labels = META.sectionLabels[INPUT.findings[i].type][INPUT.findings[i].lang];
    // 块内含其四段（oracle = canonical sectionLabels 顺序）。
    for (const field of ["context", "problem", "impact", "suggestedFix"]) {
      assert.ok(block.includes(labels[field]), `finding ${i} 块应含 ${labels[field]}`);
    }
    const metaLines = `- Skill: ${INPUT.findings[i].meta.skill}\n- Step: ${INPUT.findings[i].meta.step}`;
    assert.ok(
      block.endsWith(metaLines),
      `finding ${i} 块应以自身 meta 两行收尾（位置邻接 = 归属声明）: ${metaLines}`,
    );
    // 最后一段（suggestedFix 内容）与 meta 之间不得插入其它 heading 段。
    const afterLastHeading = block.slice(block.lastIndexOf(labels.suggestedFix) + labels.suggestedFix.length);
    assert.ok(!afterLastHeading.includes("\n## "), `finding ${i} 块 meta 前不得插入其它 heading`);
  }
});

test("Session 段 = masterDef 一行（- Harness: <harness>，canonical harnessRow 驱动）", () => {
  const body = renderBody(INPUT);
  assert.ok(body.startsWith("## Session\n- Harness: claude-code\n\n## Context"));
  assert.equal(META.masterDef.sessionTitle, "## Session");
  assert.equal(META.masterDef.harnessRow, "- Harness: <harness>");
});

test("dedup/related 恒为单段尾收：多 open 命中汇总一处、单 Related 段", () => {
  const body = renderBody({
    harness: "claude-code",
    findings: INPUT.findings,
    related: {
      open: [
        { issue: 231, component: "cdd-engine", reason: "timeout on rerun" },
        { issue: 240, component: "osuperpowers:writing-plans", reason: "same dedup loop" },
      ],
      closed: [{ issue: 230 }, { issue: 233 }],
      program: { issue: 262 },
    },
  });
  assert.equal((body.match(/^## Dedup$/gm) ?? []).length, 1);
  assert.equal((body.match(/^## Related$/gm) ?? []).length, 1);
  assert.equal((body.match(/^- Dedup → #/gm) ?? []).length, 2);
  assert.equal((body.match(/^- Regression /gm) ?? []).length, 2);
  assert.ok(body.includes("- Program: #262"));
});

test("无 related → 无 Dedup/Related 尾收段", () => {
  const { related, ...rest } = INPUT;
  const body = renderBody(rest);
  assert.ok(!body.includes("## Dedup"));
  assert.ok(!body.includes("## Related"));
});

// --- 入参结构校验（E-3 / R2 处置：exit 1 + 字段路径，手写断言零依赖）---
const VALID_FINDING = {
  type: "bug",
  lang: "en",
  context: "c",
  problem: "p",
  impact: "i",
  suggestedFix: "f",
  meta: { skill: "cli-driven-development", step: "3-2" },
};
const validInput = () => ({ harness: "claude-code", findings: [VALID_FINDING] });

test("入参校验：findings 空 → 字段路径 findings", () => {
  const errors = validateInput({ ...validInput(), findings: [] });
  assert.ok(errors.some((e) => e.startsWith("findings:")));
});

test("入参校验：findings 缺失 / harness 缺失", () => {
  const noFindings = validateInput({ harness: "claude-code" });
  assert.ok(noFindings.some((e) => e.startsWith("findings:")));
  const noHarness = validateInput({ findings: [VALID_FINDING] });
  assert.ok(noHarness.some((e) => e.startsWith("harness:")));
});

test("入参校验：type 非法 → findings[0].type 字段路径（枚举）", () => {
  const errors = validateInput({
    ...validInput(),
    findings: [{ ...VALID_FINDING, type: "critical" }],
  });
  assert.ok(errors.some((e) => e.startsWith("findings[0].type:")));
});

test("入参校验：lang 非法 → findings[0].lang 字段路径（en/zh）", () => {
  const errors = validateInput({
    ...validInput(),
    findings: [{ ...VALID_FINDING, lang: "fr" }],
  });
  assert.ok(errors.some((e) => e.startsWith("findings[0].lang:")));
});

test("入参校验：四段字段缺失 → findings[0].<field> 字段路径", () => {
  for (const field of ["context", "problem", "impact", "suggestedFix"]) {
    const errors = validateInput({
      ...validInput(),
      findings: [{ ...VALID_FINDING, [field]: "" }],
    });
    assert.ok(errors.some((e) => e.startsWith(`findings[0].${field}:`)), `${field} 缺失应报字段路径`);
  }
});

test("入参校验：meta.skill / meta.step 缺失 → findings[0].meta.* 字段路径", () => {
  const noSkill = validateInput({
    ...validInput(),
    findings: [{ ...VALID_FINDING, meta: { step: "3-2" } }],
  });
  assert.ok(noSkill.some((e) => e.startsWith("findings[0].meta.skill:")));
  const noStep = validateInput({
    ...validInput(),
    findings: [{ ...VALID_FINDING, meta: { skill: "cli-driven-development" } }],
  });
  assert.ok(noStep.some((e) => e.startsWith("findings[0].meta.step:")));
});

test("入参校验：related 结构（open/closed/program 形状）", () => {
  const badOpen = validateInput({ ...validInput(), related: { open: [{ issue: "nope" }] } });
  assert.ok(badOpen.some((e) => e.startsWith("related.open[0].issue:")));
  const badClosed = validateInput({ ...validInput(), related: { closed: [{ issue: "nope" }] } });
  assert.ok(badClosed.some((e) => e.startsWith("related.closed[0].issue:")));
  const badProgram = validateInput({ ...validInput(), related: { program: { issue: "nope" } } });
  assert.ok(badProgram.some((e) => e.startsWith("related.program:")));
});

test("入参校验：结构与字段全部合法 → 零违规", () => {
  assert.deepEqual(validateInput(INPUT), []);
});

// --- CLI 裸调用（`node report-templates.mjs < stdin`）---
test("CLI 裸调用：入参非法 → exit 1 + stderr 字段路径", () => {
  const res = runCli({ harness: "claude-code", findings: [] });
  assert.equal(res.status, 1);
  assert.ok(res.stderr.includes("findings:"), `stderr 应含 findings 字段路径: ${res.stderr}`);
});

test("CLI 裸调用：type 非法 → exit 1 + findings[0].type 字段路径", () => {
  const res = runCli({ ...validInput(), findings: [{ ...VALID_FINDING, type: "critical" }] });
  assert.equal(res.status, 1);
  assert.ok(res.stderr.includes("findings[0].type"), `stderr 应含字段路径: ${res.stderr}`);
});

test("CLI 裸调用：malformed JSON → exit 1 + input 路径", () => {
  const res = spawnSync(process.execPath, [RENDERER], {
    input: "{ not json",
    encoding: "utf8",
  });
  assert.equal(res.status, 1);
  assert.ok(res.stderr.includes("input:"), `stderr 应含 input 路径: ${res.stderr}`);
});

test("CLI 裸调用：合法入参 → exit 0 + 聚合 body 直出 stdout（无 --mode）", () => {
  const res = runCli(INPUT);
  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  assert.equal(res.stdout.trimEnd(), GOLDEN_BODY);
});

// --- 零残留 / 零 yaml import（Task 14 验收守卫）---
test("renderer 零残留：--mode / renderComment / renderTitle / resolveDropdownOptions / sessionTypes", () => {
  const STALE = ["--mode", "renderComment", "renderTitle", "resolveDropdownOptions", "sessionTypes"];
  for (const token of STALE) {
    assert.ok(!RENDERER_SRC.includes(token), `report-templates.mjs 不得含 ${token}`);
    assert.ok(!RENDER_YAML_SRC.includes(token), `render-yaml.mjs 不得含 ${token}`);
  }
});

test("聚合 body 裸调用入口零 yaml import（消费者运行时零新增依赖——yaml 只经 emit-only 模块）", () => {
  assert.ok(
    !/^\s*import\b[^;]*\bfrom\s+["']yaml["']/m.test(RENDERER_SRC),
    "report-templates.mjs 不得 import yaml（消费者运行时零新增依赖）",
  );
  assert.ok(
    /^\s*import\b[^;]*\bfrom\s+["']yaml["']/m.test(RENDER_YAML_SRC),
    "render-yaml.mjs 应 import yaml（emit-only 模块，仓库根 devDependencies）",
  );
});
