// packages/cdd-engine/src-next/render/__tests__/render.test.ts
// T12 render suite — the brief's checkables: template assembly over the
// template-contract data plane (with the hard gates) + the task-brief data
// rendering with the step-checkable gate.
// T19 lands the IssueBodyRenderer suite here — the renderer's home is render/ (the
// P7 translation-system render landing): the body render (en/zh label faces through
// the Translator), the langs projection (the word-table locale key projection —
// never a hardcoded list), the input validation, and the type × segment label-data
// completeness pin over the word table.

import { describe, expect, it } from "vitest";
import { Translator } from "../../contract/translate.ts";
import { Words } from "../../face/words.ts";
import { BriefRenderer } from "../brief.ts";
import { IssueBodyRenderer, type IssueReportInput } from "../issue-body.ts";
import { TemplateAssembler } from "../templates.ts";

/** The full per-dispatch slot values — every declared template token (the v1.8
 *  INPUT_/OUTPUT_/WORKSPACE_/FIX_BASE/ROLE/WAVE vocabulary), optional slots
 *  legitimately empty (an implement dispatch carries no review/fix slots; the
 *  review criteria/lens are NOT values — they fold into the review type's fixed
 *  prefix, §3.7). */
const ALL_VALUES: Record<string, string> = {
  ROLE: "implement",
  WAVE: "4,12",
  INPUT_WAVE_BRIEF: "/ws/tasks-4,12-brief.md",
  INPUT_RULES: "/ws/plan-constraints.md",
  INPUT_FINDINGS: "",
  INPUT_RANGE: "",
  INPUT_PLAN: "",
  INPUT_DOC: "",
  OUTPUT_HANDOFF: "/ws/tasks-4,12-implement.json",
  FIX_BASE: "",
  REVIEW_TYPE: "",
  WORKSPACE_DIR: "/ws",
  WORKSPACE_ID: "2026-10-02-x",
  HANDOFF_SCHEMA: "$$SCHEMA$$",
};

describe("TemplateAssembler — the template assembly + hard gates", () => {
  const assembler = new TemplateAssembler();

  it("declares the four-mode dispatch table and the token registry", () => {
    // v1.8 — the mode dispatch table; v1.9 — RETURN_JSON / DOCS_FIX retired; the
    // review criteria/lens tokens are gone (§3.7).
    expect(assembler.workModes()).toEqual(["implement", "fix", "review", "docs-fix"]);
    expect(assembler.returnFormats()).toEqual(["RETURN_STDOUT_BLOCK"]);
    expect(assembler.declaredTokens()).toContain("ROLE");
    expect(assembler.declaredTokens()).toContain("OUTPUT_HANDOFF");
    expect(assembler.declaredTokens()).toContain("HANDOFF_SCHEMA");
    expect(assembler.declaredTokens()).not.toContain("INPUT_CRITERIA");
    expect(assembler.declaredTokens()).not.toContain("INPUT_LENS");
    expect(assembler.declaredTokens()).not.toContain("HANDOFF_WRITE_GATE");
  });

  it("assembles the implement mode — the fixed prefix + the reduced round context", () => {
    const out = assembler.render(ALL_VALUES);
    expect(out.startsWith("# CDD dispatch — implement round")).toBe(true);
    expect(out).toContain("## Instructions");
    expect(out).toContain("## Handoff schema");
    expect(out).toContain("## Return");
    expect(out).toContain("## Round context");
    expect(out).toContain("- `ROLE`: implement");
    expect(out).toContain("- `WAVE`: 4,12");
    expect(out).toContain("- `INPUT_WAVE_BRIEF`: /ws/tasks-4,12-brief.md");
    expect(out).toContain("$$SCHEMA$$"); // the injected writable-subset fence slot
    expect(out).not.toContain("{{"); // zero unresolved slots
    // the v1.9 prose-zeroing — no HANDOFF_WRITE_GATE / ## Handoff prose anywhere
    expect(out).not.toContain("HANDOFF_WRITE_GATE");
    expect(out).not.toContain("RETURN_JSON");
    expect(out).not.toContain("DOCS_FIX");
    // the per-mode trimming: an implement round's context carries no review/fix keys
    expect(out).not.toContain("INPUT_CRITERIA");
    expect(out).not.toContain("INPUT_FINDINGS");
    expect(out).not.toContain("FIX_BASE");
  });

  it("renders the docs-fix mode through the same table — its own rules + subset", () => {
    const out = assembler.render({
      ...ALL_VALUES,
      ROLE: "docs-fix",
      INPUT_DOC: "docs/x-design.md",
    });
    expect(out.startsWith("# CDD dispatch — docs-fix round")).toBe(true);
    expect(out).toContain("apply `INPUT_FINDINGS` (all severities) directly to `INPUT_DOC`");
    expect(out).toContain("- `INPUT_DOC`: docs/x-design.md");
    // the review-only keys stay out of the docs-fix context
    expect(out).not.toContain("INPUT_CRITERIA");
  });

  it("renders the review mode per type — the criteria/lens fold into the fixed prefix", () => {
    // a spec review: the URC criteria + its lens ride the shell (fixed region), the
    // round context carries only the review's dynamic facts
    const spec = assembler.render({
      ...ALL_VALUES,
      ROLE: "review",
      REVIEW_TYPE: "spec",
      INPUT_RANGE: "docs/kairos/specs/s1-design.md",
      INPUT_PLAN: "/ws/p.md",
      OUTPUT_HANDOFF: "/ws/spec-review-1.json",
    });
    expect(spec.startsWith("# CDD dispatch — review round")).toBe(true);
    expect(spec).toContain("**Criteria — spec:**");
    expect(spec).toContain("Follow URC");
    expect(spec).toContain("completeness | consistency | clarity");
    expect(spec).toContain("- `INPUT_RANGE`: docs/kairos/specs/s1-design.md");
    expect(spec).not.toContain("- `INPUT_WAVE_BRIEF`");
    expect(spec).not.toContain("- `INPUT_FINDINGS`");
    expect(spec).not.toContain("- `FIX_BASE`");
    // a task review selects its own variant — the task axes + lens
    const task = assembler.render({
      ...ALL_VALUES,
      ROLE: "review",
      REVIEW_TYPE: "wave",
      INPUT_RANGE: "aaaaaaa..bbbbbbb",
      OUTPUT_HANDOFF: "/ws/tasks-1-review-1.json",
    });
    expect(task).toContain("**Criteria — wave:**");
    expect(task).toContain("Standards axis");
    expect(task).toContain("standards | spec | buildability");
    expect(task).not.toContain("Follow URC");
  });

  it("hard gates: a missing token value throws (named)", () => {
    const partial = { ...ALL_VALUES };
    delete partial.ROLE;
    expect(() => assembler.render(partial)).toThrow(/ROLE/);
    // an unknown ROLE is refused by the mode table (never a phantom assemble)
    expect(() => assembler.render({ ...ALL_VALUES, ROLE: "bogus" })).toThrow(/work-mode/);
    // a review without its REVIEW_TYPE discriminant is refused by the variants
    expect(() => assembler.render({ ...ALL_VALUES, ROLE: "review", REVIEW_TYPE: "" })).toThrow(
      /review type not declared/,
    );
  });

  it("hard gates: an undeclared value throws (the guard is the declared token list)", () => {
    expect(() => assembler.render({ ...ALL_VALUES, BOGUS: "x" })).toThrow(/undeclared/);
  });
});

/** A two-task plan — task 1 steps all checkable, task 2 carries a bare step. */
const PLAN = [
  "# Test Plan",
  "**Spec:** [x-design.md](docs/kairos/specs/x-design.md)",
  "- **Parent program**: [x-overall.md v1.21](docs/kairos/specs/x-overall.md)",
  "",
  "### Task 1: one",
  "- **Objective**: objective",
  "- **Files**: file",
  "- **Consumes**: consumes",
  "- **Produces**: produces",
  "- **Steps**:",
  "  - step with checkable — checkable: green",
  "  - step two — checkable: also green",
  "- **Acceptance**: acceptance",
  "- **DependsOn**: none",
  "",
  "### Task 2: two",
  "- **Objective**: objective",
  "- **Files**: file",
  "- **Consumes**: consumes",
  "- **Produces**: produces",
  "- **Steps**:",
  "  - bare step",
  "- **Acceptance**: acceptance",
  "- **DependsOn**: none",
].join("\n");

describe("BriefRenderer — the brief data rendering + the checkable gate", () => {
  const brief = new BriefRenderer();

  it("extracts the requested task blocks with fields, steps and checkables", () => {
    const { data, missing } = brief.extract(PLAN, [1, 2]);
    expect(missing).toEqual([]);
    expect(data.map((task) => task.id)).toEqual([1, 2]);
    expect(data[0].steps.map((step) => step.action)).toEqual(["step with checkable", "step two"]);
    expect(data[0].steps[1].checkable).toBe("also green");
    expect(data[1].fields.map((field) => field.key)).toContain("Objective");
  });

  it("checkable gate: a step without — checkable: is reported and blocks the verdict", () => {
    const { data } = brief.extract(PLAN, [1, 2]);
    expect(data[0].checkableComplete).toBe(true);
    expect(data[1].checkableComplete).toBe(false);
    expect(data[1].missingCheckables).toEqual(["bare step"]);
  });

  it("the task-heading pattern rides the parse face (T3 tokens consumption)", () => {
    expect(brief.taskHeadingPattern()?.test("### Task 3:")).toBe(true);
    expect(brief.taskHeadingPattern()?.test("### Task 12:")).toBe(true);
  });

  it("out-of-bounds: a missing task id is listed and the render blocks", () => {
    const { missing } = brief.extract(PLAN, [1, 5]);
    expect(missing).toEqual([5]);
    expect(() => brief.render(PLAN, [1, 5], "a".repeat(40))).toThrow(/task 5/);
  });

  it("renders the brief content — the raw section + the WAVE_BASE line", () => {
    const sha = "abcd1234abcd1234abcd1234abcd1234abcd1234";
    const out = brief.render(PLAN, [1], sha);
    expect(out).toContain("### Task 1: one");
    expect(out).toContain("- **Objective**: objective");
    expect(out.endsWith(`WAVE_BASE: ${sha}\n`)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// the issue-body renderer suite (T19 — the renderer's home is render/, the P7
// translation-system render landing; migrated from the cli.test.ts renderer tests)
// ---------------------------------------------------------------------------

describe("IssueBodyRenderer — the aggregate issue body (the P7 render face)", () => {
  const words = new Words();
  const translator = new Translator(words);
  const renderer = new IssueBodyRenderer(words, translator);

  /** The canonical en-aggregate input — one bug finding + the dedup/related tails. */
  const EN_INPUT: IssueReportInput = {
    harness: "claude",
    findings: [
      {
        type: "bug",
        lang: "en",
        context: "c",
        problem: "p",
        impact: "i",
        suggestedFix: "f",
        meta: { skill: "cdd-dev", step: "implement" },
      },
    ],
    related: {
      open: [{ issue: 1, component: "cdd", reason: "dup" }],
      closed: [{ issue: 9 }],
      program: { issue: 2 },
    },
  };

  it("renders the deterministic body — harness line, the en four-segment labels, attribution, dedup, related", () => {
    const out = renderer.renderBody(EN_INPUT);
    expect(out).toContain("# CDD aggregate issue");
    expect(out).toContain("- Harness: claude");
    expect(out).toContain("## Context\n\nc");
    expect(out).toContain("## Problem\n\np");
    expect(out).toContain("## Impact\n\ni");
    expect(out).toContain("## Suggested fix\n\nf");
    expect(out).toContain("- Skill: cdd-dev\n- Step: implement");
    expect(out).toContain("- Dedup → #1 (open)：cdd · dup");
    expect(out).toContain("- Regression / follow-up of #9 (closed)");
    expect(out).toContain("- Program: #2");
  });

  it("renders the zh labels through the translation layer (the locale-normalized render face)", () => {
    const zh = renderer.renderBody({
      harness: "claude",
      findings: [
        {
          type: "bug",
          lang: "zh",
          context: "c",
          problem: "p",
          impact: "i",
          suggestedFix: "f",
          meta: { skill: "s", step: "t" },
        },
      ],
    });
    expect(zh).toContain("## 场景\n\nc");
    expect(zh).toContain("## 问题\n\np");
    expect(zh).toContain("## 影响\n\ni");
    expect(zh).toContain("## 建议修复\n\nf");
  });

  it("the type × lang label variants — enhancement carries the Gap + Suggested direction wording", () => {
    const out = renderer.renderBody({
      harness: "claude",
      findings: [
        {
          type: "enhancement",
          lang: "en",
          context: "c",
          problem: "p",
          impact: "i",
          suggestedFix: "f",
          meta: { skill: "s", step: "t" },
        },
      ],
    });
    expect(out).toContain("## Gap\n\np");
    expect(out).toContain("## Suggested direction\n\nf");
  });

  it("langs — the projected language vocabulary (the word-table locale key projection, never a hardcoded list)", () => {
    expect(renderer.langs()).toEqual(words.localeKeys());
    // the validation rides the projection — a lang outside the project keys is refused
    // with the data-derived vocabulary message
    const errors = renderer.validateInput({
      harness: "claude",
      findings: [
        {
          type: "bug",
          lang: "fr",
          context: "c",
          problem: "p",
          impact: "i",
          suggestedFix: "f",
          meta: { skill: "s", step: "t" },
        },
      ],
    });
    expect(errors).toContain("findings[0].lang: must be one of en | zh");
  });

  it("validateInput — field-path errors for the type/enum and the segment/meta shapes", () => {
    expect(
      renderer.validateInput({
        harness: "claude",
        findings: [{ type: "bogus", lang: "en", meta: {} }],
      }),
    ).toEqual([
      "findings[0].type: must be one of bug | enhancement | chore",
      "findings[0].context: non-empty string required",
      "findings[0].problem: non-empty string required",
      "findings[0].impact: non-empty string required",
      "findings[0].suggestedFix: non-empty string required",
      "findings[0].meta.skill: non-empty string required",
      "findings[0].meta.step: non-empty string required",
    ]);
    expect(renderer.validateInput("bogus")).toEqual([
      "input: expected an object with harness / findings / related?",
    ]);
  });

  it("the label data is complete — every declared type × segment resolves on the word table", () => {
    const segments = ["context", "problem", "impact", "suggestedFix"];
    for (const type of renderer.types) {
      for (const segment of segments) {
        expect(words.localeRow(`${type}.${segment}`), `${type}.${segment}`).not.toBeNull();
      }
    }
  });
});
