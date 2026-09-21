import { describe, it, expect } from "vitest";
import { readFileSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { renderYml } from "../../../packages/osuperpowers/scripts/render-yaml.mjs";
import { emitIssueTemplates } from "../issue-templates.ts";
import { emitAll } from "../all.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const findingMeta = JSON.parse(readFileSync(path.resolve(
  HERE, "../../../packages/osuperpowers/skills/report-issues/templates/finding-meta.json"
), "utf8"));

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
    expect(Object.keys(findingMeta.formFieldDefs).sort()).toEqual([
      "bug_report",
      "enhancement",
    ]);
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
      emitIssueTemplates(tmp, {}, { generatedPaths });
      expect(generatedPaths).toEqual([
        ".github/ISSUE_TEMPLATE/bug_report.yml",
        ".github/ISSUE_TEMPLATE/enhancement.yml",
      ]);
      for (const name of Object.keys(findingMeta.formFieldDefs)) {
        const rel = `.github/ISSUE_TEMPLATE/${name}.yml`;
        expect(existsSync(path.join(tmp, rel))).toBe(true);
        const emitted = readFileSync(path.join(tmp, rel), "utf8");
        // 内容不变量（非 byte-golden——emit:check 已承担 drift 守卫，此处验关键形态）
        expect(emitted).toContain(
          `name: ${findingMeta.formFieldDefs[name].frontmatter.name}`,
        );
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
      emitAll(tmp, { generatedPaths });
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