// packages/cdd-engine/src-next/render/__tests__/render.test.ts
// T12 render suite — the brief's checkables: template assembly over the
// template-contract data plane (with the hard gates) + the task-brief data
// rendering with the step-checkable gate.

import { describe, expect, it } from "vitest";
import { BriefRenderer } from "../brief.ts";
import { TemplateAssembler } from "../templates.ts";

/** The full per-dispatch slot values — every declared template token, optional
 *  slots legitimately empty (an implement dispatch carries no review slots). */
const ALL_VALUES: Record<string, string> = {
  MODE: "implement",
  DISPATCH_UNIT: "4,12",
  BRIEF: "/ws/tasks-4,12-brief.md",
  CONSTRAINTS: "/ws/plan-constraints.md",
  FINDINGS: "/ws/tasks-4,12-open-findings.json",
  FIXED_POINT: "",
  WORKSPACE: "/ws",
  WORKSPACE_SLUG: "2026-10-02-x",
  REVIEW_TYPE: "",
  REVIEW_REFERENCE: "",
  REVIEW_LENS_GUIDE: "",
  REVIEW_AXES: "",
  REVIEW_PLAN_LINE: "",
  DOC: "",
  HANDOFF_TARGET: "/ws/tasks-4,12-implement.json",
  HANDOFF_WRITE_GATE: "hard gate",
  RETURN_FORMAT: "RETURN_STDOUT_BLOCK",
  RETURN_STDOUT_BLOCK: "RETURN_STDOUT_BLOCK",
};

describe("TemplateAssembler — the template assembly + hard gates", () => {
  const assembler = new TemplateAssembler();

  it("declares the contract's return formats and token registry", () => {
    expect(assembler.returnFormats()).toEqual(["RETURN_STDOUT_BLOCK", "RETURN_JSON", "DOCS_FIX"]);
    expect(assembler.declaredTokens()).toContain("MODE");
    expect(assembler.declaredTokens()).toContain("HANDOFF_TARGET");
  });

  it("assembles the full dispatch template with every slot resolved", () => {
    const out = assembler.render("RETURN_STDOUT_BLOCK", ALL_VALUES);
    expect(out.startsWith("# CDD dispatch — CLI session")).toBe(true);
    expect(out).toContain("## Instructions");
    expect(out).toContain("## Handoff");
    expect(out).toContain("## Return");
    expect(out).toContain("## Round context");
    expect(out).toContain("- `MODE`: implement");
    expect(out).toContain("- `DISPATCH_UNIT`: 4,12");
    expect(out).toContain("- `BRIEF`: /ws/tasks-4,12-brief.md");
    expect(out).not.toContain("{{"); // zero unresolved slots
  });

  it("assembles a non-standard return format through the same declared order", () => {
    const out = assembler.render("RETURN_JSON", ALL_VALUES);
    expect(out).toContain("## Return");
    expect(out).toContain("RETURN_JSON"); // the return-format-specific wording
  });

  it("hard gates: a missing token value throws (named)", () => {
    const partial = { ...ALL_VALUES };
    delete partial.MODE;
    expect(() => assembler.render("RETURN_STDOUT_BLOCK", partial)).toThrow(/MODE/);
  });

  it("hard gates: an undeclared value and an unknown format throw", () => {
    expect(() => assembler.render("RETURN_STDOUT_BLOCK", { ...ALL_VALUES, BOGUS: "x" })).toThrow(
      /undeclared/,
    );
    expect(() => assembler.render("NOPE", ALL_VALUES)).toThrow(/not declared/);
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

  it("renders the brief content — the raw section + the TASK_BASE line", () => {
    const sha = "abcd1234abcd1234abcd1234abcd1234abcd1234";
    const out = brief.render(PLAN, [1], sha);
    expect(out).toContain("### Task 1: one");
    expect(out).toContain("- **Objective**: objective");
    expect(out.endsWith(`TASK_BASE: ${sha}\n`)).toBe(true);
  });
});
