import { describe, it, expect } from "vitest";
import { readFileSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  renderYml,
  renderTitle,
  renderMeta,
  renderComment,
  renderMasterBody,
} from "../../packages/osuperpowers/scripts/report-templates.mjs";
import { emitIssueTemplates } from "./issue-templates.mjs";
import { emitAll } from "./all.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES = path.resolve(HERE, "../../.github/ISSUE_TEMPLATE");
const findingMeta = JSON.parse(readFileSync(path.resolve(
  HERE, "../../packages/osuperpowers/skills/report-issue/templates/finding-meta.json"
), "utf8"));

describe("report-templates", () => {
  it("隐私迁移后 3 个 yml 渲染产物无 Branch", () => {
    for (const n of Object.keys(findingMeta.formFieldDefs)) {
      expect(renderYml(findingMeta.formFieldDefs[n])).not.toMatch(/Branch/);
    }
  });

  it("renderTitle 替换 <subject> 与 <YYYY-MM-DD>", () => {
    expect(
      renderTitle(
        { title: "[Session report] <subject> <YYYY-MM-DD>" },
        { subject: "cdd-engine-overhaul-p4", date: "2026-09-08" }
      )
    ).toBe("[Session report] cdd-engine-overhaul-p4 2026-09-08");
    expect(
      renderTitle(findingMeta.masterDef, { subject: "session workspace misrouting fix", date: "2026-09-08" })
    ).toBe("[Session report] session workspace misrouting fix 2026-09-08");
  });

  it("masterDef 契约：subject 占位、无 summaryTable、无 <slug|standalone>", () => {
    expect(findingMeta.masterDef.title).toBe("[Session report] <subject> <YYYY-MM-DD>");
    expect(findingMeta.masterDef.title).not.toContain("<slug|standalone>");
    expect(findingMeta.masterDef).not.toHaveProperty("summaryTable");
  });

  it("renderMeta 输出 report-meta 六字段 bullet（skill/harness/kind/step/cdd/date）", () => {
    expect(
      renderMeta({
        skill: "report-issue",
        harness: "claude-code",
        kind: "program",
        step: "review",
        cdd: "2026-09-08-cdd-engine-overhaul-p4",
        date: "2026-09-08",
      })
    ).toBe(
      "- Skill: report-issue\n" +
        "- Harness: claude-code\n" +
        "- Kind: program\n" +
        "- Step: review\n" +
        "- CDD: 2026-09-08-cdd-engine-overhaul-p4\n" +
        "- Date: 2026-09-08"
    );
  });

  it("renderMasterBody 结构常驻断言（Session 块 + 指针行 + Report meta · 无 Findings Summary）", () => {
    const meta = {
      session: "cdd-engine-overhaul-p4",
      skill: "report-issue",
      harness: "claude-code",
      kind: "program",
      step: "review",
      cdd: "2026-09-08-cdd-engine-overhaul-p4",
      date: "2026-09-08",
    };
    const body = renderMasterBody({ kind: "program", meta });
    expect(body.startsWith(
      "## Session\n\n- Session: cdd-engine-overhaul-p4\n- Kind: program\n- Date: 2026-09-08"
    )).toBe(true);
    expect(body).toContain("_Findings are appended as comments below");
    expect(body).not.toContain("## Findings Summary");
    expect(body.endsWith(`## Report meta (auto)\n${renderMeta(meta)}`)).toBe(true);
    for (const field of ["Skill", "Harness", "Kind", "Step", "CDD", "Date"]) {
      expect(body).toContain(`- ${field}:`);
    }
  });

  it("renderMasterBody meta.session 缺省回退 standalone", () => {
    const meta = {
      skill: "report-issue",
      harness: "claude-code",
      kind: "standalone",
      step: "nlx",
      cdd: "st-42",
      date: "2026-09-08",
    };
    const body = renderMasterBody({ kind: "standalone", meta });
    expect(body).toContain("- Session: standalone");
  });

  it("renderComment 段落序 oracle = sectionLabels.bug[en]（Context→Problem→Impact→Suggested fix）", () => {
    const labels = findingMeta.sectionLabels.bug.en;
    const finding = {
      type: "bug",
      component: "cdd-engine",
      title: "session state corrupted",
      context: "Ran branch-review on cdd-engine-overhaul-p4",
      problem: "Stopped before emitting findings",
      impact: "Blocked the whole phase",
      suggestedFix: "Skip idempotent reruns",
    };
    const meta = {
      skill: "report-issue",
      harness: "claude-code",
      kind: "program",
      step: "review",
      cdd: "2026-09-08-cdd-engine-overhaul-p4",
      date: "2026-09-08",
    };
    const comment = renderComment({ finding, lang: "en", related: "closes #232", meta });
    const expected = [
      `## Context\n\n${finding.context}`,
      `## Problem\n\n${finding.problem}`,
      `## Impact\n\n${finding.impact}`,
      `## Suggested fix\n\n${finding.suggestedFix}`,
      `## Related\n\ncloses #232`,
      `## Report meta (auto)\n${renderMeta(meta)}`,
    ].join("\n\n");
    expect(comment).toBe(expected);
    // oracle 取自 canonical（不读 Task 4 将删除的 bug-en.md）
    expect(labels.context).toBe("## Context");
    expect(labels.problem).toBe("## Problem");
    expect(labels.impact).toBe("## Impact");
    expect(labels.suggestedFix).toBe("## Suggested fix");
  });
});

describe("issue-templates emitter", () => {
  it("emitIssueTemplates 写 3 个 yml 到 outRoot/.github/ISSUE_TEMPLATE 并 track generatedPaths", () => {
    const tmp = mkdtempSync(path.join(tmpdir(), "oscaner-issue-templates-"));
    try {
      const generatedPaths = [];
      emitIssueTemplates(tmp, {}, { generatedPaths });
      expect(generatedPaths).toEqual([
        ".github/ISSUE_TEMPLATE/bug_report.yml",
        ".github/ISSUE_TEMPLATE/enhancement.yml",
        ".github/ISSUE_TEMPLATE/session_report.yml",
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

  it("emitAll 接线：全量 emit 亦产出 3 个 issue 模板并 track（all.mjs 挂入校验）", () => {
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