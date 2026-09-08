import { describe, it, expect } from "vitest";
import { readFileSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  renderYml,
  renderTitle,
  renderMeta,
  renderSummaryTable,
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
  it("renderYml 复现现任 bug_report.yml （round-trip ①，过渡性断言）", () => {
    const form = findingMeta.formFieldDefs.bug_report;
    expect(renderYml(form)).toBe(
      readFileSync(path.join(TEMPLATES, "bug_report.yml"), "utf8")
    ); // 逐字节相等：EOF 换行亦在断言范围（spec §2.3 round-trip ①）
  });

  it("renderYml 复现现任 enhancement.yml （round-trip ①，过渡性断言）", () => {
    const form = findingMeta.formFieldDefs.enhancement;
    expect(renderYml(form)).toBe(
      readFileSync(path.join(TEMPLATES, "enhancement.yml"), "utf8")
    );
  });

  it("renderYml 复现现任 session_report.yml （round-trip ①，过渡性断言）", () => {
    const form = findingMeta.formFieldDefs.session_report;
    expect(renderYml(form)).toBe(
      readFileSync(path.join(TEMPLATES, "session_report.yml"), "utf8")
    );
  });

  it("renderTitle 替换 <slug|standalone> 与 <YYYY-MM-DD>", () => {
    expect(
      renderTitle(
        { title: "[Session report] <slug|standalone> <YYYY-MM-DD>" },
        { slugOrStandalone: "cdd-engine-overhaul-p4", date: "2026-09-08" }
      )
    ).toBe("[Session report] cdd-engine-overhaul-p4 2026-09-08");
    expect(
      renderTitle(findingMeta.masterDef, { slugOrStandalone: "standalone", date: "2026-09-08" })
    ).toBe("[Session report] standalone 2026-09-08");
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

  it("renderSummaryTable 表头 = #/Type/Component/Title（取 masterDef.summaryTable.cols 渲染序）", () => {
    expect(findingMeta.masterDef.summaryTable.cols).toEqual([
      "#", "Type", "Component", "Title",
    ]);
    const findings = [
      { type: "bug", component: "cdd-engine", title: "session state corrupted" },
      { type: "enhancement", component: "osuperpowers:init", title: "simplify first-run install" },
    ];
    const table = renderSummaryTable(findings);
    const cols = findingMeta.masterDef.summaryTable.cols;
    expect(table.startsWith(`| ${cols.join(" | ")} |`)).toBe(true);
    expect(table).toContain(`| ${cols.map(() => "---").join(" | ")} |`);
    expect(table).toContain("| 1 | bug | cdd-engine | session state corrupted |");
    expect(table).toContain("| 2 | enhancement | osuperpowers:init | simplify first-run install |");
    expect(table.endsWith(findingMeta.masterDef.summaryTable.placeholder)).toBe(true);
  });

  it("renderMasterBody 结构常驻断言（Session 元数据 + Findings Summary 表 + 六字段 Report meta）", () => {
    const findings = [
      { type: "bug", component: "cdd-engine", title: "session state corrupted" },
    ];
    const meta = {
      session: "cdd-engine-overhaul-p4",
      skill: "report-issue",
      harness: "claude-code",
      kind: "program",
      step: "review",
      cdd: "2026-09-08-cdd-engine-overhaul-p4",
      date: "2026-09-08",
    };
    const body = renderMasterBody({ kind: "program", meta, findings });
    expect(body.startsWith(
      "## Session\n\n- Session: cdd-engine-overhaul-p4\n- Kind: program\n- Date: 2026-09-08"
    )).toBe(true);
    expect(body).toContain("## Findings Summary");
    expect(body).toContain("| 1 | bug | cdd-engine | session state corrupted |");
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
    const body = renderMasterBody({ kind: "standalone", meta, findings: [] });
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
      for (const name of ["bug_report", "enhancement", "session_report"]) {
        const rel = `.github/ISSUE_TEMPLATE/${name}.yml`;
        expect(existsSync(path.join(tmp, rel))).toBe(true);
        expect(readFileSync(path.join(tmp, rel), "utf8")).toBe(
          readFileSync(path.join(TEMPLATES, `${name}.yml`), "utf8"),
        ); // 首渲染 = 现状（round-trip ①，过渡性断言；隐私迁移后随 committed yml 同步更新）
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
      for (const name of ["bug_report", "enhancement", "session_report"]) {
        const rel = `.github/ISSUE_TEMPLATE/${name}.yml`;
        expect(existsSync(path.join(tmp, rel))).toBe(true);
        expect(generatedPaths.includes(rel)).toBe(true);
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});