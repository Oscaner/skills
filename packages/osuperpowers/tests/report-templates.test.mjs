// packages/osuperpowers/tests/report-templates.test.mjs — Task 9: 渲染器注入侧 round-trip
// 「同一 canonical 枚举输入 → 同字节」（design §2.6.1 渲染器侧）。
// 落点 = validate 5b 的 node:test 面（packages/osuperpowers/tests/*.test.mjs）；
// emit 侧 issue-templates.test.mjs 只保留消费方签名 round-trip，本面承载渲染器侧断言。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { renderYml } from "../scripts/report-templates.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const META = JSON.parse(
  readFileSync(
    path.resolve(HERE, "../skills/report-issue/templates/finding-meta.json"),
    "utf8",
  ),
);

// 固定小形 formDef 与枚举 —— expected 为独立手写字面（非代码重算），承「同字节」断言。
// 两个 dropdown（component / session-type）不带内联 options：单源化后枚举只经 renderYml
// 第二个实参注入（sectionLabels / masterDef 等字段不在本 seam，consumed by issue-templates）。
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
      type: "dropdown",
      id: "session-type",
      attributes: {
        label: "Session type",
        description: "Was this finding surfaced during a dogfood (CDD session) or a standalone run?",
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
  components: [
    "osuperpowers (general)",
    "cdd-engine",
    "osuperpowers:brainstorming",
    "osuperpowers:writing-plans",
  ],
  sessionTypes: ["dogfood (CDD session)", "standalone"],
};

const GOLDEN_YML = `name: Bug report
description: Report a bug found while using osuperpowers skills (dogfood)
labels: ["bug", "osuperpowers"]
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
        - osuperpowers:brainstorming
        - osuperpowers:writing-plans
    validations:
      required: true
  - type: dropdown
    id: session-type
    attributes:
      label: Session type
      description: Was this finding surfaced during a dogfood (CDD session) or a standalone run?
      options:
        - dogfood (CDD session)
        - standalone
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

test("renderYml 注入枚举：同一枚举输入 → 同字节（固定 golden，EOF 换行）", () => {
  assert.equal(renderYml(FORM, ENUMS), GOLDEN_YML);
});

test("renderYml 除 component / session-type 外不注入枚举（textarea 等零干扰）", () => {
  const yml = renderYml(FORM, ENUMS);
  // 枚举只落 component / session-type 两个 dropdown 的 options；无其他 options 注入面。
  assert.equal((yml.match(/^      options:$/gm) ?? []).length, 2);
  assert.equal((yml.match(/^        - /gm) ?? []).length, 6);
});

// 单源化本质断言：formFieldDefs 内零 options 数组（枚举只留顶层 components / sessionTypes）。
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

// 取值同步（§2.6.1 口径）：P4 删 init、加 3 个新 spec-writer；report-issue 保留旧名（改名归 P5）。
test("canonical 取值同步：init 移除 + 3 个 spec-writer 加入 + report-issue 保留旧名", () => {
  const components = META.components;
  assert.ok(!components.includes("osuperpowers:init"), "枚举不得残留 osuperpowers:init");
  for (const spec of [
    "osuperpowers:writing-single-spec",
    "osuperpowers:writing-overall-spec",
    "osuperpowers:writing-phase-spec",
  ]) {
    assert.ok(components.includes(spec), `枚举应含 ${spec}（取值同步）`);
  }
  assert.ok(components.includes("osuperpowers:report-issue"), "report-issue 保留旧名（改名归 P5）");
});

// 消费方签名集成：renderYml(formFieldDefs[name], meta) —— 与 issue-templates.mjs 同形，
// 顶部 components 全量注入 component dropdown，且不再出现 init。
test("canonical 集成：component dropdown 注入顶层 components（消费方签名）", () => {
  const yml = renderYml(META.formFieldDefs.bug_report, META);
  for (const component of META.components) {
    assert.ok(yml.includes(`        - ${component}`), `component dropdown 应含 ${component}`);
  }
  assert.ok(!yml.includes("osuperpowers:init"), "渲染产物不得含 osuperpowers:init");
});
