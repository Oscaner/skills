import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { emitService } from "../all.ts";
import { issueTemplatesEmitter } from "../issue-templates.ts";
import { renderYml } from "../render-yaml.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const findingMeta = JSON.parse(
  readFileSync(
    path.resolve(HERE, "../../../packages/cdd-engine/templates/report/issue-body.json"),
    "utf8",
  ),
);

describe("render-yaml (emit-only module)", () => {
  it("隐私迁移后 2 个 yml 渲染产物无 Branch", () => {
    for (const n of Object.keys(findingMeta.formFieldDefs)) {
      expect(renderYml(findingMeta.formFieldDefs[n], findingMeta)).not.toMatch(/Branch/);
    }
  });

  it("component dropdown 直引顶层 components（消费方签名）", () => {
    const yml = renderYml(findingMeta.formFieldDefs.bug_report, findingMeta);
    for (const component of findingMeta.components) {
      expect(yml).toContain(`        - ${component}`);
    }
    expect(yml).not.toContain("osuperpowers:init");
  });
});

describe("finding-meta canonical（§2.6 终态）", () => {
  it("metaFields 2 字段（skill·step），kinds/sessionTypes 枚举删", () => {
    expect(findingMeta.metaFields).toEqual([
      { key: "skill", label: "Skill" },
      { key: "step", label: "Step" },
    ]);
    expect(findingMeta).not.toHaveProperty("kinds");
    expect(findingMeta).not.toHaveProperty("sessionTypes");
  });

  it("formFieldDefs 2 键（bug_report/enhancement），零 session-type 下拉、component 下拉保留", () => {
    expect(Object.keys(findingMeta.formFieldDefs).sort()).toEqual(["bug_report", "enhancement"]);
    for (const name of ["bug_report", "enhancement"]) {
      const body = findingMeta.formFieldDefs[name].body;
      for (const item of body) {
        expect(item.id, `${name} 不得含 session-type 下拉`).not.toBe("session-type");
      }
      expect(
        body.some((item) => item.type === "dropdown" && item.id === "component"),
        `${name} 应保留 component 下拉`,
      ).toBe(true);
    }
  });

  it("reportDef.labels 单点 = [osuperpowers, cdd-engine]", () => {
    expect(findingMeta.reportDef).toEqual({
      labels: ["osuperpowers", "cdd-engine"],
    });
  });

  it("masterDef 终态两键（§2.6）——Session 段 label + Harness 行模板，title 删", () => {
    expect(findingMeta.masterDef).toEqual({
      sessionTitle: "## Session",
      harnessRow: "- Harness: <harness>",
    });
  });

  it("components 经 Task 11 改名后继验：report-issues 现名在枚举、单数 report-issue 不在", () => {
    expect(findingMeta.components).toContain("osuperpowers:report-issues");
    expect(findingMeta.components).not.toContain("osuperpowers:report-issue");
  });
});

describe("issue-templates emitter", () => {
  it("emitIssueTemplates 写 2 个 yml 到 outRoot/.github/ISSUE_TEMPLATE 并 track generatedPaths", () => {
    const tmp = mkdtempSync(path.join(tmpdir(), "oscaner-issue-templates-"));
    try {
      const generatedPaths = [];
      issueTemplatesEmitter.emit(tmp, {}, { generatedPaths });
      expect(generatedPaths).toEqual([
        ".github/ISSUE_TEMPLATE/bug_report.yml",
        ".github/ISSUE_TEMPLATE/enhancement.yml",
      ]);
      for (const name of Object.keys(findingMeta.formFieldDefs)) {
        const rel = `.github/ISSUE_TEMPLATE/${name}.yml`;
        expect(existsSync(path.join(tmp, rel))).toBe(true);
        const emitted = readFileSync(path.join(tmp, rel), "utf8");
        // 内容不变量（非 byte-golden——emit:check 已承担 drift 守卫，此处验关键形态）
        expect(emitted).toContain(`name: ${findingMeta.formFieldDefs[name].frontmatter.name}`);
        expect(emitted).not.toMatch(/Branch/);
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("emitAll 接线：全量 emit 亦产出 2 个 issue 模板并 track（all.ts 挂入校验）", () => {
    const tmp = mkdtempSync(path.join(tmpdir(), "oscaner-emitall-issues-"));
    try {
      const generatedPaths = [];
      emitService.emitAll(tmp, { generatedPaths });
      for (const name of Object.keys(findingMeta.formFieldDefs)) {
        const rel = `.github/ISSUE_TEMPLATE/${name}.yml`;
        expect(existsSync(path.join(tmp, rel))).toBe(true);
        expect(generatedPaths.includes(rel)).toBe(true);
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

// ---- renderYml 断言面（随 report-templates.test.mjs 退役迁入 scripts/emit/__tests__）----
// 固定小形 formDef —— 两表单 canonical 现态：仅 component dropdown（零 session-type）。expected
// 为独立手写字面（非代码重算），且在 yaml.stringify 字节侧做 round-trip：YAML.parse 回读结构与
// canonical 等价，emit:check 作为输出新鲜度守卫。
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
        description:
          "Dogfood session context: date, harness, which osuperpowers skills were in use",
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

describe("render-yaml migrated golden + single-source (from the retired report-templates test)", () => {
  it("renderYml（emit-only + yaml.stringify）：固定 golden 同字节，EOF 换行", () => {
    expect(renderYml(FORM, ENUMS)).toBe(GOLDEN_YML);
  });

  it("renderYml 仅 component dropdown 注入枚举（无其他 options 注入面）", () => {
    const yml = renderYml(FORM, ENUMS);
    expect((yml.match(/^ {6}options:$/gm) ?? []).length).toBe(1);
    expect((yml.match(/^ {8}- /gm) ?? []).length).toBe(3);
  });

  it("canonical 单源：formFieldDefs 内零 options 数组（枚举只留顶层 components）", () => {
    for (const [name, formDef] of Object.entries(findingMeta.formFieldDefs)) {
      for (const item of formDef.body) {
        expect(item.attributes.options, `${name} 的 ${item.id} 不应内联 options`).toBeUndefined();
      }
    }
  });

  it("canonical 取值同步：init 移除 + 3 个 spec-writer 加入 + report-issues 现名", () => {
    const components = findingMeta.components;
    expect(components).not.toContain("osuperpowers:init");
    for (const spec of [
      "osuperpowers:writing-single-spec",
      "osuperpowers:writing-overall-spec",
      "osuperpowers:writing-phase-spec",
    ]) {
      expect(components).toContain(spec);
    }
    expect(components).toContain("osuperpowers:report-issues");
    expect(components).not.toContain("osuperpowers:report-issue");
  });
});
