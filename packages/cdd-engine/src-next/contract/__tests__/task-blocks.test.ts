// packages/cdd-engine/src-next/contract/__tests__/task-blocks.test.ts
// P21 §7 — the plan task-block parse face: the heading shape, the legacy
// compatibility shape (field-by-field parity), the extension sections and the
// duplicate-key invariant. Fixtures are plan-shaped markdown literals.

import { describe, expect, it } from "vitest";
import { Contract } from "../judge.ts";
import type { TaskBlock } from "../task-blocks.ts";
import { PlanTaskBlocksReader } from "../task-blocks.ts";

const reader = new PlanTaskBlocksReader();

/** The comparable face of a block — everything but `shape` / `range`. */
const comparable = (block: TaskBlock): Omit<TaskBlock, "shape" | "range"> => {
  const { shape: _shape, range: _range, ...rest } = block;
  return rest;
};

const TASK_ONE_TITLE = "### Task 1: first";
const TASK_TWO_TITLE = "### Task 2: second";

/** The heading-shaped fixture — the seven reserved sections + two tasks. */
const HEADING_FORM = [
  "---",
  "doc-type: plan",
  "---",
  "",
  "## Constraints",
  "",
  "- delta",
  "",
  TASK_ONE_TITLE,
  "",
  "#### Objective",
  "do x",
  "",
  "#### Files",
  "a.ts",
  "",
  "#### Consumes",
  "none",
  "",
  "#### Produces",
  "y",
  "",
  "#### Steps",
  "- step one — checkable: green",
  "- step two — checkable: blue",
  "",
  "#### Acceptance",
  "ok",
  "",
  "#### DependsOn",
  "2, 3",
  "",
  TASK_TWO_TITLE,
  "",
  "#### Objective",
  "do y",
  "",
  "#### DependsOn",
  "none",
  "",
].join("\n");

/** The same content in the legacy bullet shape. */
const LEGACY_FORM = [
  "---",
  "doc-type: plan",
  "---",
  "",
  "## Constraints",
  "",
  "- delta",
  "",
  TASK_ONE_TITLE,
  "- **Objective**: do x",
  "- **Files**: a.ts",
  "- **Consumes**: none",
  "- **Produces**: y",
  "- **Steps**:",
  "  - step one — checkable: green",
  "  - step two — checkable: blue",
  "- **Acceptance**: ok",
  "- **DependsOn**: 2, 3",
  "",
  TASK_TWO_TITLE,
  "- **Objective**: do y",
  "- **DependsOn**: none",
  "",
].join("\n");

describe("PlanTaskBlocksReader — the heading shape", () => {
  const blocks = reader.parse(HEADING_FORM);

  it("reads both `### Task N:` blocks in document order", () => {
    expect(blocks.map((block) => block.id)).toEqual([1, 2]);
    expect(blocks.map((block) => block.heading)).toEqual([TASK_ONE_TITLE, TASK_TWO_TITLE]);
    expect(blocks.map((block) => block.shape)).toEqual(["heading", "heading"]);
  });

  it("collects the reserved sections in document order and reads the dependency value", () => {
    const first = blocks[0]!;
    expect(first.fields.map((field) => field.key)).toEqual([...PlanTaskBlocksReader.RESERVED]);
    expect(reader.dependsOn(first)).toEqual([2, 3]);
    expect(reader.dependsOn(blocks[1]!)).toEqual([]);
    expect(first.steps).toEqual([
      { action: "step one", checkable: "green" },
      { action: "step two", checkable: "blue" },
    ]);
  });

  it("ranges each block from its heading to the line before the next `###`", () => {
    const lines = HEADING_FORM.split("\n");
    const first = blocks[0]!;
    expect(first.range.start).toBe(lines.indexOf(TASK_ONE_TITLE) + 1);
    expect(first.range.end).toBe(lines.indexOf(TASK_TWO_TITLE));
    expect(blocks[1]!.range.start).toBe(lines.indexOf(TASK_TWO_TITLE) + 1);
  });
});

describe("PlanTaskBlocksReader — the legacy compatibility shape", () => {
  const blocks = reader.parse(LEGACY_FORM);

  it("normalizes the bullet shape into the same blocks, field by field", () => {
    const heading = reader.parse(HEADING_FORM);
    expect(blocks.map((block) => block.shape)).toEqual(["legacy", "legacy"]);
    expect(blocks.map(comparable)).toEqual(heading.map(comparable));
    expect(reader.dependsOn(blocks[0]!)).toEqual(reader.dependsOn(heading[0]!));
    expect(blocks[0]!.steps).toEqual(heading[0]!.steps);
  });

  it("keeps the `DependsOn` value on the block it belongs to", () => {
    expect(reader.dependsOn(blocks[0]!)).toEqual([2, 3]);
    expect(reader.dependsOn(blocks[1]!)).toEqual([]);
  });
});

describe("PlanTaskBlocksReader — extension sections and duplicates", () => {
  it("collects an arbitrary `####` extension section without touching the reserved keys", () => {
    const content = [
      TASK_ONE_TITLE,
      "",
      "#### Objective",
      "do x",
      "",
      "#### Risks",
      "a risk body",
      "",
      "#### Migration Notes",
      "a migration body",
      "",
      "#### DependsOn",
      "none",
      "",
    ].join("\n");
    const [block] = reader.parse(content);
    expect(block!.fields.map((field) => field.key)).toEqual([
      "Objective",
      "Risks",
      "Migration Notes",
      "DependsOn",
    ]);
    expect(block!.fields.find((field) => field.key === "Risks")?.lines).toEqual(["a risk body"]);
  });

  it("refuses a reserved section appearing twice in one block", () => {
    const content = [TASK_ONE_TITLE, "", "#### Files", "a.ts", "", "#### Files", "b.ts", ""].join(
      "\n",
    );
    expect(() => reader.parse(content)).toThrow(/#### Files/);
  });

  it("reads a `##` section body without truncating at a deeper heading", () => {
    const content = [
      "## Constraints",
      "",
      "- delta",
      "",
      "### Sub-heading",
      "",
      "- nested delta",
      "",
      TASK_ONE_TITLE,
      "",
    ].join("\n");
    expect(reader.section(content, "Constraints")).toBe(
      ["## Constraints", "", "- delta", "", "### Sub-heading", "", "- nested delta"].join("\n"),
    );
  });
});
describe("PlanTaskBlocksReader — the contract's document-face compatibility", () => {
  /** A conforming plan in the given shape — the same semantic content, the one
   *  declaration in `declare.ts` judging both. */
  const conformingPlan = (shape: "heading" | "legacy"): string => {
    const task =
      shape === "heading"
        ? [
            TASK_ONE_TITLE,
            "",
            "#### Objective",
            "objective",
            "",
            "#### Files",
            "file",
            "",
            "#### Consumes",
            "consumes",
            "",
            "#### Produces",
            "produces",
            "",
            "#### Steps",
            "- step one — checkable: green",
            "",
            "#### Acceptance",
            "acceptance",
            "",
            "#### DependsOn",
            "none",
          ]
        : [
            TASK_ONE_TITLE,
            "- **Objective**: objective",
            "- **Files**: file",
            "- **Consumes**: consumes",
            "- **Produces**: produces",
            "- **Steps**:",
            "  - step one — checkable: green",
            "- **Acceptance**: acceptance",
            "- **DependsOn**: none",
          ];
    return [
      "---",
      "title: Test Plan",
      "doc-type: plan",
      "version: v1.0",
      "date: 2026-10-09",
      "slug: x-p3",
      "---",
      "",
      "## Constraints",
      "",
      "- delta",
      "",
      ...task,
      "",
      "## Change history",
      "",
      "| Version | date | summary | author |",
      "| --- | --- | --- | --- |",
      "| v1.0 | 2026-10-09 | init | [human] |",
      "",
    ].join("\n");
  };

  /** The chain fs — the same-slug identity document and the program overall the
   *  plan's cross-doc chain resolves into (this pin judges the task blocks'
   *  structure, so the chain must be clean). */
  const chainFs = {
    exists: () => true,
    read: (target: string) =>
      target.endsWith("/x-p3-design.md")
        ? "---\ntitle: S\ndoc-type: phase-spec\nslug: x-p3\nprogram: x-overall\n---\n"
        : target.endsWith("/x-overall.md")
          ? "---\ntitle: O\ndoc-type: overall\nslug: x-overall\nversion: v1.0\n---\n"
          : "---\ntitle: X\ndoc-type: single-spec\nslug: x-other\n---\n",
    list: () => ["x-overall.md", "x-p3-design.md"],
  };

  /** Validate one plan against the live contract. */
  const findingsOf = (content: string) =>
    new Contract().validate({
      docKey: "plan",
      path: "docs/kairos/plans/x-p3.md",
      content,
      root: ".",
      fs: chainFs,
    });

  it("accepts a heading-shape plan with zero findings", () => {
    expect(findingsOf(conformingPlan("heading"))).toEqual([]);
  });

  it("accepts the legacy bullet shape with zero findings (the compatibility window)", () => {
    expect(findingsOf(conformingPlan("legacy"))).toEqual([]);
  });

  it("accepts arbitrary `####` extension sections with zero findings", () => {
    const content = conformingPlan("heading").replace(
      "#### Acceptance",
      "#### Risks\na risk body\n\n#### Migration Notes\na migration body\n\n#### Acceptance",
    );
    expect(findingsOf(content)).toEqual([]);
  });
});
