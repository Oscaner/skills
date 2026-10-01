// packages/cdd-engine/src/domain/__tests__/issue-renderer.test.ts — IssueReportRenderer (P4.2
// Task 6: the cdd-report aggregate-body renderer migrated from
// packages/kairos/scripts/report-templates.mjs). The determinism corpus is ported verbatim:
// golden-body byte parity (mixed type × N + Dedup/Related tail), N-finding meta adjacency, the
// Session one-line face, the input-structure validation field-path surface (the E-3 / R2 contract:
// exit 1 + offending field path), the enumeration single-source property, and the canonical
// template content (components commitment sync). Same-byte assertions against the independent
// hand-written literals in issue-report-fixtures.ts.

import { describe, expect, it } from "vitest";
import { IssueReportRenderer } from "../issue-renderer.ts";
import { GOLDEN_BODY, INPUT, VALID_FINDING, validInput } from "./issue-report-fixtures.ts";

const renderer = new IssueReportRenderer();
const META = renderer.loadTemplate();

describe("IssueReportRenderer template plane", () => {
  it("loadTemplate: reads the canonical issue-body.json (components / sectionLabels / masterDef / metaFields)", () => {
    expect(META.masterDef.sessionTitle).toBe("## Session");
    expect(META.masterDef.harnessRow).toBe("- Harness: <harness>");
    expect(META.metaFields).toEqual([
      { key: "skill", label: "Skill" },
      { key: "step", label: "Step" },
    ]);
  });

  it("enumeration single-source: finding types/langs derive from canonical sectionLabels", () => {
    expect(renderer.types).toEqual(["bug", "enhancement"]);
    expect(renderer.langs).toEqual(["en", "zh"]);
  });

  it("canonical components commitment: init removed, the 3 spec-writers present, cdd-report current name", () => {
    const components = META.components;
    expect(components).not.toContain("kairos:init");
    for (const spec of ["kairos:cdd-spec", "kairos:cdd-charter", "kairos:cdd-phase"]) {
      expect(components).toContain(spec);
    }
    expect(components).toContain("kairos:cdd-report");
  });
});

describe("renderMeta", () => {
  it("renders the report-meta two-field bullet (skill/step, canonical metaFields driven)", () => {
    expect(renderer.renderMeta({ skill: "cdd-report", step: "review" })).toBe(
      "- Skill: cdd-report\n- Step: review",
    );
  });
});

describe("aggregate body rendering", () => {
  it("mixed type × N golden: byte-identical to the canonical aggregate body (Session one line + typed segments + meta adjacency + tail)", () => {
    expect(renderer.renderBody(INPUT)).toBe(GOLDEN_BODY);
  });

  it("N-finding meta adjacency: each finding block ends with its own Skill/Step pair (position adjacency = ownership, unambiguous across skills)", () => {
    const body = renderer.renderBody(INPUT);
    const boundaries = [0];
    for (const finding of INPUT.findings) {
      const contextLabel = META.sectionLabels[finding.type][finding.lang].context;
      const start = body.indexOf(contextLabel, boundaries[boundaries.length - 1]);
      expect(start).toBeGreaterThanOrEqual(0);
      boundaries.push(start);
    }
    const dedupIdx = body.indexOf("\n## Dedup");
    for (let i = 0; i < INPUT.findings.length; i++) {
      const end =
        i + 1 < INPUT.findings.length ? boundaries[i + 2] : dedupIdx >= 0 ? dedupIdx : body.length;
      const block = body.slice(boundaries[i + 1], end).trimEnd();
      const labels = META.sectionLabels[INPUT.findings[i].type][INPUT.findings[i].lang];
      for (const field of ["context", "problem", "impact", "suggestedFix"]) {
        expect(block).toContain(labels[field]);
      }
      const metaLines = `- Skill: ${INPUT.findings[i].meta.skill}\n- Step: ${INPUT.findings[i].meta.step}`;
      expect(block.endsWith(metaLines)).toBe(true);
      const afterLastHeading = block.slice(
        block.lastIndexOf(labels.suggestedFix) + labels.suggestedFix.length,
      );
      expect(afterLastHeading).not.toMatch(/\n## /);
    }
  });

  it("Session segment = masterDef one line (- Harness: <harness>, canonical harnessRow driven)", () => {
    const body = renderer.renderBody(INPUT);
    expect(body.startsWith("## Session\n- Harness: claude-code\n\n## Context")).toBe(true);
  });

  it("dedup/related stay single tail sections: multi open hits in one Dedup block, one Related block", () => {
    const body = renderer.renderBody({
      harness: "claude-code",
      findings: INPUT.findings,
      related: {
        open: [
          { issue: 231, component: "cdd-engine", reason: "timeout on rerun" },
          { issue: 240, component: "kairos:cdd-plan", reason: "same dedup loop" },
        ],
        closed: [{ issue: 230 }, { issue: 233 }],
        program: { issue: 262 },
      },
    });
    expect(body.match(/^## Dedup$/gm)?.length).toBe(1);
    expect(body.match(/^## Related$/gm)?.length).toBe(1);
    expect(body.match(/^- Dedup → #/gm)?.length).toBe(2);
    expect(body.match(/^- Regression /gm)?.length).toBe(2);
    expect(body).toContain("- Program: #262");
  });

  it("no related → no Dedup/Related tail sections", () => {
    const { related, ...rest } = INPUT;
    const body = renderer.renderBody(rest);
    expect(body).not.toContain("## Dedup");
    expect(body).not.toContain("## Related");
  });
});

describe("input-structure validation (E-3 / R2 handling: field-path error surface)", () => {
  it("empty findings → the findings field path", () => {
    const errors = renderer.validateInput({ ...validInput(), findings: [] });
    expect(errors.some((e) => e.startsWith("findings:"))).toBe(true);
  });

  it("missing findings / empty harness", () => {
    const noFindings = renderer.validateInput({ harness: "claude-code" });
    expect(noFindings.some((e) => e.startsWith("findings:"))).toBe(true);
    const noHarness = renderer.validateInput({ findings: [VALID_FINDING] });
    expect(noHarness.some((e) => e.startsWith("harness:"))).toBe(true);
  });

  it("illegal type → the findings[0].type field path (enumeration)", () => {
    const errors = renderer.validateInput({
      ...validInput(),
      findings: [{ ...VALID_FINDING, type: "critical" }],
    });
    expect(errors.some((e) => e.startsWith("findings[0].type:"))).toBe(true);
  });

  it("illegal lang → the findings[0].lang field path (en/zh)", () => {
    const errors = renderer.validateInput({
      ...validInput(),
      findings: [{ ...VALID_FINDING, lang: "fr" }],
    });
    expect(errors.some((e) => e.startsWith("findings[0].lang:"))).toBe(true);
  });

  it.each(["context", "problem", "impact", "suggestedFix"])(
    "missing %s → the findings[0].%s field path",
    (field) => {
      const errors = renderer.validateInput({
        ...validInput(),
        findings: [{ ...VALID_FINDING, [field]: "" }],
      });
      expect(errors.some((e) => e.startsWith(`findings[0].${field}:`))).toBe(true);
    },
  );

  it("missing meta.skill / meta.step → the findings[0].meta.* field path", () => {
    const noSkill = renderer.validateInput({
      ...validInput(),
      findings: [{ ...VALID_FINDING, meta: { step: "3-2" } }],
    });
    expect(noSkill.some((e) => e.startsWith("findings[0].meta.skill:"))).toBe(true);
    const noStep = renderer.validateInput({
      ...validInput(),
      findings: [{ ...VALID_FINDING, meta: { skill: "cdd-dev" } }],
    });
    expect(noStep.some((e) => e.startsWith("findings[0].meta.step:"))).toBe(true);
  });

  it("related shapes (open/closed/program) each report their field path", () => {
    const badOpen = renderer.validateInput({
      ...validInput(),
      related: { open: [{ issue: "nope" }] },
    });
    expect(badOpen.some((e) => e.startsWith("related.open[0].issue:"))).toBe(true);
    const badClosed = renderer.validateInput({
      ...validInput(),
      related: { closed: [{ issue: "nope" }] },
    });
    expect(badClosed.some((e) => e.startsWith("related.closed[0].issue:"))).toBe(true);
    const badProgram = renderer.validateInput({
      ...validInput(),
      related: { program: { issue: "nope" } },
    });
    expect(badProgram.some((e) => e.startsWith("related.program:"))).toBe(true);
  });

  it("fully valid structure → zero violations", () => {
    expect(renderer.validateInput(INPUT)).toEqual([]);
  });
});
