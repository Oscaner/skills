// packages/cdd-engine/src-next/contract/__tests__/markdown-tree.test.ts
// P21 §7.5 — the markdown tree's pins: the four doc types share one parse face,
// the table boundary forms (escaped pipe · backticked pipe · alignment row ·
// empty cell) read as cells, and the composable selectors chain through the
// surfaces they declare (table → row → cell · taskField → taskStep · graphEdge).

import { describe, expect, it } from "vitest";
import { MarkdownTree } from "../markdown-tree.ts";
import { SelectorSpec } from "../selector-spec.ts";

/** The 1-based line of the first fixture line carrying `needle`. */
const lineOf = (lines: readonly string[], needle: string): number => lines.indexOf(needle) + 1;

const OVERALL_LINES = [
  "---",
  "title: A charter",
  "doc-type: overall",
  "version: v2.3",
  "date: 2026-10-10",
  "slug: a-charter",
  "status: Approved",
  "author: someone",
  "---",
  "",
  "## Document scope",
  "",
  "prose",
  "",
  "## Phase inventory",
  "",
  "| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |",
  "| --- | --- | --- | --- | --- | --- | --- |",
  "| 1 | P1 | scope | [P1-design](p1-design.md) | [plan](p1.md) | criteria | P0 -> P1 |",
  "| 2 | P2 | scope | [P2-design](p2-design.md) | [plan](p2.md) | criteria | P1 -> P2 |",
  "",
  "## Dependency graph",
  "",
  "```",
  "P1 -> P2",
  "P2 -> P3   (soft)",
  "```",
  "",
  "Legend:",
  "",
  "- `->` = hard block",
  "",
  "## Change history",
  "",
  "| Version | date | summary | author |",
  "| --- | --- | --- | --- |",
  "| v2.3 | 2026-10-10 | current | someone |",
  "| v2.2 | 2026-10-09 | previous | someone |",
  "",
];
const OVERALL = OVERALL_LINES.join("\n");

const PLAN_LINES = [
  "---",
  "title: A plan",
  "doc-type: plan",
  "version: v0.2",
  "date: 2026-10-10",
  "slug: a-charter",
  "---",
  "",
  "## Constraints",
  "",
  "- one constraint",
  "",
  "### Task 1: first",
  "",
  "#### Objective",
  "",
  "build the thing",
  "",
  "#### Files",
  "",
  "contract/one.ts",
  "",
  "#### Steps",
  "",
  "- write the test — checkable: it fails",
  "- implement it — checkable: it passes",
  "",
  "#### DependsOn",
  "",
  "none",
  "",
];
const PLAN = PLAN_LINES.join("\n");

describe("MarkdownTree — the shared parse face", () => {
  it("locates the front-matter slug key on a parsed head", () => {
    const tree = MarkdownTree.parse(OVERALL);
    const slug = tree.frontMatterKeys().find((entry) => entry.key === "slug");
    expect(slug?.value).toBe("a-charter");
    expect(tree.resolve(SelectorSpec.frontmatter("slug"))?.line).toBe(
      lineOf(OVERALL_LINES, "slug: a-charter"),
    );
    expect(tree.resolve(SelectorSpec.frontmatter("absent"))).toBeNull();
  });

  it("counts the declared rank-2 heading occurrences", () => {
    const tree = MarkdownTree.parse(OVERALL);
    expect(tree.sections().map((section) => section.text)).toEqual([
      "## Document scope",
      "## Phase inventory",
      "## Dependency graph",
      "## Change history",
    ]);
    expect(tree.occurrences(SelectorSpec.heading(/^## /)).length).toBe(4);
  });

  it("reads the Phase-inventory rows as cell sequences", () => {
    const tree = MarkdownTree.parse(OVERALL);
    const rows = tree.rows(
      SelectorSpec.row(SelectorSpec.table(SelectorSpec.heading("## Phase inventory"))),
    );
    expect(rows.length).toBe(2);
    expect(rows[0]?.[1]).toBe("P1");
    expect(rows[1]?.[1]).toBe("P2");
  });

  it("keeps the table boundary forms apart — escaped pipe, backticked pipe, alignment, empty cell", () => {
    const table = [
      "| Cell | note |",
      "| :--- | ---: |",
      "| a \\| b | `x \\| y` |",
      "|  | filled |",
      "",
    ].join("\n");
    const tree = MarkdownTree.parse(`## Boundary\n\n${table}`);
    const rows = tree.rows(
      SelectorSpec.row(SelectorSpec.table(SelectorSpec.heading("## Boundary"))),
    );
    // The escaped pipe stays inside ONE cell (in its unescaped value form, the
    // inline markdown of the cell kept verbatim).
    expect(rows[0]).toEqual(["a | b", "`x | y`"]);
    // An empty cell is an empty cell, never a collapsed column.
    expect(rows[1]).toEqual(["", "filled"]);
    // The alignment row is table syntax, never a data row.
    expect(rows.length).toBe(2);
  });

  it("reads a table split by an interior blank line as ONE section table", () => {
    // A GFM table ends at a blank line; a continuation run written as bare
    // `| a | b |` rows (no delimiter row) parses as a paragraph. The section span
    // is the table's real boundary: header from the first table, rows in order.
    const content = [
      "## Phase inventory",
      "",
      "| # | Phase |",
      "| --- | --- |",
      "| 1 | P1 |",
      "| 2 | P2 |",
      "",
      "| 3 | P3 |",
      "",
      "| 4 | P4 |",
      "",
    ].join("\n");
    const tree = MarkdownTree.parse(content);
    const table = tree.tableUnder("## Phase inventory");
    expect(table?.header).toEqual(["#", "Phase"]);
    expect(table?.body).toEqual([
      ["1", "P1"],
      ["2", "P2"],
      ["3", "P3"],
      ["4", "P4"],
    ]);
    const rows = tree.rows(
      SelectorSpec.row(SelectorSpec.table(SelectorSpec.heading("## Phase inventory"))),
    );
    expect(rows).toEqual(table?.body);
  });

  it("keeps a backticked pipe split (GFM requires the escape even inside a code span)", () => {
    const table = ["| A | B |", "| --- | --- |", "| `x | y` |", ""].join("\n");
    const tree = MarkdownTree.parse(`## Boundary\n\n${table}`);
    const rows = tree.rows(
      SelectorSpec.row(SelectorSpec.table(SelectorSpec.heading("## Boundary"))),
    );
    expect(rows[0]).toEqual(["`x", "y`"]);
  });

  it("never reads a code-fence row as table data (the fenced corner)", () => {
    // A section that SHOWS the table shape inside a fence is sample prose, not the
    // section's table: the loose continuation-row recovery must skip code spans.
    const content = [
      "## Phase inventory",
      "",
      "| # | Phase |",
      "| --- | --- |",
      "| 1 | P1 |",
      "",
      "```",
      "| 2 | P2 |",
      "```",
      "",
      "| 3 | P3 |",
      "",
    ].join("\n");
    const tree = MarkdownTree.parse(content);
    const table = tree.tableUnder("## Phase inventory");
    expect(table?.header).toEqual(["#", "Phase"]);
    expect(table?.body).toEqual([
      ["1", "P1"],
      ["3", "P3"],
    ]);
  });

  it("keeps a separately-headed table out of the section's one table read", () => {
    const content = [
      "## Two tables",
      "",
      "| A | B |",
      "| --- | --- |",
      "| 1 | 2 |",
      "",
      "prose between them",
      "",
      "| C | D |",
      "| --- | --- |",
      "| 3 | 4 |",
      "",
    ].join("\n");
    const table = MarkdownTree.parse(content).tableUnder("## Two tables");
    expect(table?.header).toEqual(["A", "B"]);
    expect(table?.body).toEqual([["1", "2"]]);
  });
});

describe("MarkdownTree — the composable selector face", () => {
  it("chains table → row(tableBody) → cell(match) onto the Change-history version cell", () => {
    const tree = MarkdownTree.parse(OVERALL);
    const versions = tree.occurrences(
      SelectorSpec.cell(
        SelectorSpec.row(
          SelectorSpec.table(SelectorSpec.heading("## Change history"), /^\|\s*v\d+\.\d+\s*\|/),
        ),
        /^v\d+\.\d+$/,
      ),
    );
    expect(versions.map((node) => node.text)).toEqual(["v2.3", "v2.2"]);
    expect(versions[0]?.line).toBe(
      lineOf(OVERALL_LINES, "| v2.3 | 2026-10-10 | current | someone |"),
    );
  });

  it("chains taskField → taskStep onto the step leaf", () => {
    const tree = MarkdownTree.parse(PLAN);
    const steps = tree.occurrences(SelectorSpec.taskStep(/—\s*checkable:\s*\S/));
    expect(steps.length).toBe(2);
    expect(steps[0]?.text).toBe("- write the test — checkable: it fails");
    const objective = tree.resolve(SelectorSpec.taskField("#### Objective"));
    expect(objective?.text).toBe("#### Objective");
    expect(objective?.lines).toEqual(["build the thing"]);
  });

  it("separates the graph's hard edges from its soft edges", () => {
    const tree = MarkdownTree.parse(OVERALL);
    expect(tree.occurrences(SelectorSpec.graphEdge("hard")).map((node) => node.text)).toEqual([
      "P1 -> P2",
    ]);
    expect(tree.occurrences(SelectorSpec.graphEdge("soft")).map((node) => node.text)).toEqual([
      "P2 -> P3   (soft)",
    ]);
    expect(tree.edges()).toEqual([
      { from: "P1", to: "P2", hard: true },
      { from: "P2", to: "P3", hard: false },
    ]);
  });

  it("treats an inline-code citation as no value carrier (the code-span boundary)", () => {
    const content = ["## Constraints", "", "- a `## Constraints` citation", ""].join("\n");
    const tree = MarkdownTree.parse(content);
    const rows = tree.occurrences(SelectorSpec.list(SelectorSpec.heading("## Constraints"), /^- /));
    expect(rows[0]?.text).toBe("- a `## Constraints` citation");
    expect(rows[0]?.bare).toBe("- a  citation");
  });

  it("scopes a child walk to the parent's section span", () => {
    const tree = MarkdownTree.parse(OVERALL);
    const inGraph = tree.occurrences(
      SelectorSpec.list(SelectorSpec.heading("## Dependency graph")),
    );
    expect(inGraph.map((node) => node.text)).toContain("- `->` = hard block");
    // A heading the document does not carry resolves to nothing.
    expect(tree.resolve(SelectorSpec.heading("## Constraints"))).toBeNull();
  });

  it("reads the section body text of a rank-2 section", () => {
    const tree = MarkdownTree.parse(PLAN);
    expect(tree.sectionText("## Constraints")).toBe("## Constraints\n\n- one constraint");
    expect(tree.sectionText("## Absent")).toBe("");
  });

  it("parses the task blocks through the one block grammar", () => {
    const tree = MarkdownTree.parse(PLAN);
    const blocks = tree.tasks();
    expect(blocks.length).toBe(1);
    expect(blocks[0]?.id).toBe(1);
    expect(blocks[0]?.shape).toBe("heading");
    expect(blocks[0]?.fields.map((field) => field.key)).toEqual([
      "Objective",
      "Files",
      "Steps",
      "DependsOn",
    ]);
  });

  it("keeps the first guard — only the first match of a multi-match walk", () => {
    const tree = MarkdownTree.parse(PLAN);
    const all = tree.occurrences(SelectorSpec.list());
    const first = tree.occurrences(SelectorSpec.list(SelectorSpec.ROOT, /^- /, "first"));
    expect(all.length).toBeGreaterThan(1);
    expect(first.map((node) => node.text)).toEqual([all[0]?.text]);
  });

  it("keeps the last guard — only the last match of a multi-match walk", () => {
    const tree = MarkdownTree.parse(PLAN);
    const all = tree.occurrences(SelectorSpec.list());
    const last = tree.occurrences(SelectorSpec.list(SelectorSpec.ROOT, /^- /, "last"));
    expect(last.map((node) => node.text)).toEqual([all[all.length - 1]?.text]);
  });

  it("keeps the inTaskBlock guard — only the nodes inside a `### Task N:` block", () => {
    const tree = MarkdownTree.parse(PLAN);
    const all = tree.occurrences(SelectorSpec.list(SelectorSpec.ROOT, /^- /));
    const inTask = tree.occurrences(SelectorSpec.list(SelectorSpec.ROOT, /^- /, "inTaskBlock"));
    expect(all.map((node) => node.text)).toContain("- one constraint");
    expect(inTask.map((node) => node.text)).toEqual([
      "- write the test — checkable: it fails",
      "- implement it — checkable: it passes",
    ]);
  });

  it("keeps a cell selector column-precise — an element judges only its own column", () => {
    // Both Phase-inventory value columns carry the same decorated shape
    // (`✔ Done（…）`), so an unguarded cell match resolves the OTHER column too.
    const content = [
      "## Phase inventory",
      "",
      "| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |",
      "| --- | --- | --- | --- | --- | --- | --- |",
      "| P1 | first | scope | ✔ Done（spec.md v1） | ✔ Done（plan.md v1）  delivery evidence | criteria | P0 -> P1 |",
      "",
    ].join("\n");
    const tree = MarkdownTree.parse(content);
    const rows = SelectorSpec.row(
      SelectorSpec.table(SelectorSpec.heading("## Phase inventory")),
      /^\|\s*P\d+\s*\|/,
    );
    const design = tree.occurrences(SelectorSpec.cell(rows, /✔ Done/, 4));
    const plan = tree.occurrences(SelectorSpec.cell(rows, /✔ Done/, 5));
    expect(design.map((node) => node.text)).toEqual(["✔ Done（spec.md v1）"]);
    expect(design.map((node) => node.column)).toEqual([4]);
    expect(plan.map((node) => node.text)).toEqual(["✔ Done（plan.md v1）  delivery evidence"]);
    expect(plan.map((node) => node.column)).toEqual([5]);
    // Without the guard the same match resolves both columns — the overlap the
    // guard removes.
    expect(tree.occurrences(SelectorSpec.cell(rows, /✔ Done/)).length).toBe(2);
  });
});
