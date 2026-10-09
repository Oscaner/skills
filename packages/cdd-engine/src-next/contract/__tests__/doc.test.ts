// packages/cdd-engine/src-next/contract/__tests__/doc.test.ts
// T4 parse-layer suite (contract/doc.ts) — the brief's positive checkables:
//   · the four tables of the overall parse as header + data rows;
//   · the plan's `### Task N:` blocks parse into fields + steps;
//   · the phase-spec's `## Design` double-layer skeleton parses into groups + items;
//   · the cross-doc chain root parses the Class-A/B anchors verbatim (unresolved);
//   · the DocType class face carries zero judgment methods (spec §2.2 — the machine
//     assertion surface: extract-only classes).
// The parse records and known-good document literals are the independent sources of
// truth — every assertion compares against the fixture doc the parser must extract.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { docTypeParsers, OverallDocType, PhaseSpecDocType, PlanDocType } from "../doc.ts";

/** A conforming overall — the four tables, the dependency graph and the header tuple. */
const OVERALL = [
  "# 文档架构方法论 v2 — 测试 Overall",
  "- **Version**: v1.1 · 2026-10-07",
  "- **Status**: Approved",
  "- **Author**: [human]",
  "- **Constraints**: 全部约定自动生效",
  "",
  "## Document scope",
  "scope prose",
  "",
  "## File paths",
  "| Artifact | Path |",
  "| --- | --- |",
  "| overall | docs/kairos/specs/test-overall.md |",
  "",
  "## Program charter",
  "### Goal",
  "- goal text",
  "",
  "### Non-goals",
  "- non-goal text",
  "",
  "### Cross-cutting",
  "- cross text",
  "",
  "## Issue inventory",
  "| Phase | Issue (ref) | Title summary |",
  "| --- | --- | --- |",
  "| P1 | #123 | issue one |",
  "| P2 | none | issue two |",
  "",
  "## Phase inventory",
  "| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |",
  "| --- | --- | --- | --- | --- | --- | --- |",
  "| P1 | DocType 抽象 + schema 工厂 | scope a | [P1-design](docs/kairos/specs/x-p1-design.md) | [P1 plan](docs/kairos/plans/x-p1.md) | criteria a |  |",
  "| P2 | 判定面 + 协调器 | scope b | P2-design | [P2 plan](docs/kairos/plans/x-p2.md) | criteria b |  |",
  "",
  "## Dependency graph (ASCII)",
  "P1 -> P2",
  "-> = hard block",
  "",
  "## Boundary rules",
  "- boundary rule",
  "",
  "## Maintenance",
  "- maintenance note",
  "",
  "## Change history",
  "| Version | Date | Summary |",
  "| --- | --- | --- |",
  "| v1.20 | 2026-10-06 | prior change |",
  "| v1.21 | 2026-10-07 | merged change |",
];

/** A conforming plan — the header chain anchors + the `### Task N:` blocks. */
const PLAN = [
  "# 文档架构方法论 v2 — 测试 Plan",
  "**Spec:** [x-design.md](docs/kairos/specs/x-design.md)",
  "- **Parent program**: [x-overall.md v1.21](docs/kairos/specs/x-overall.md)",
  "- **Version**: v1.1 · 2026-10-07",
  "- **Depends on**: P1 design v1.1",
  "- **Base**: develop",
  "",
  "## Constraints",
  "",
  "- delta constraint",
  "",
  "### Task 1: skeleton",
  "- **Objective**: establish the skeleton",
  "- **Files**: src-next/ | tsconfig.json",
  "- **Consumes**: none",
  "- **Produces**: skeleton",
  "- **Steps**:",
  "  - step one",
  "  - step two — checkable: second step check",
  "- **Acceptance**: skeleton green",
  "- **DependsOn**: none",
  "",
  "### Task 2: registry",
  "- **Objective**: declare the registries",
  "- **Files**: src-next/contract/declare.ts",
  "- **Consumes**: T1 skeleton",
  "- **Produces**: registry data",
  "- **Steps**:",
  "  - write the registry — checkable: types compile",
  "- **Acceptance**: registry green",
  "- **DependsOn**: 1",
];

/** A conforming phase-spec — the header five-tuple + the double-layer design skeleton. */
const PHASE_SPEC = [
  "# 文档架构方法论 v2 — 测试 Design Spec",
  "- **Version**: v1.2 · 2026-10-07",
  "- **Status**: Draft",
  "- **Author**: [human]",
  "- **Parent program**: [x-overall.md v1.21](docs/kairos/specs/x-overall.md)",
  "- **Depends on**: P1（Done）",
  "",
  "## Design",
  "",
  "### 1. 判定面",
  "#### 1.1 策略类族",
  "- 判定多态",
  "",
  "### 2. 编排面",
  "#### 2.1 波次",
  "- 波次计算",
  "",
  "### Acceptance criteria",
  "",
  "- `acceptance entry`",
  "",
  "## Constraints",
  "",
  "- delta constraint",
  "",
  "## Review record",
  "- review note",
];

describe("OverallDocType.parse — the four tables + the chain root", () => {
  const parsed = new OverallDocType("overall").parse(OVERALL);

  it("parses the header lines and the section skeleton", () => {
    expect(parsed.docType).toBe("overall");
    expect(parsed.title).toBe("# 文档架构方法论 v2 — 测试 Overall");
    expect(parsed.headerLines.some((line) => line.includes("**Version**"))).toBe(true);
    expect(parsed.sections.map((section) => section.heading)).toEqual([
      "## Document scope",
      "## File paths",
      "## Program charter",
      "## Issue inventory",
      "## Phase inventory",
      "## Dependency graph (ASCII)",
      "## Boundary rules",
      "## Maintenance",
      "## Change history",
    ]);
  });

  it("parses the File-paths table into a header row + data rows", () => {
    const table = parsed.tables["File paths"];
    expect(table.headerRow).toEqual(["Artifact", "Path"]);
    expect(table.rows).toEqual([["overall", "docs/kairos/specs/test-overall.md"]]);
  });

  it("parses the Issue-inventory table rows", () => {
    const table = parsed.tables["Issue inventory"];
    expect(table.headerRow).toEqual(["Phase", "Issue (ref)", "Title summary"]);
    expect(table.rows).toEqual([
      ["P1", "#123", "issue one"],
      ["P2", "none", "issue two"],
    ]);
  });

  it("parses the Phase-inventory table (id from the canonical first-column cell -> chain phases)", () => {
    const table = parsed.tables["Phase inventory"];
    expect(table.rows).toHaveLength(2);
    expect(parsed.chain.phases.map((phase) => phase.id)).toEqual(["P1", "P2"]);
    expect(parsed.chain.phases[0].designCell).toBe("[P1-design](docs/kairos/specs/x-p1-design.md)");
    expect(parsed.chain.phases[0].planCell).toBe("[P1 plan](docs/kairos/plans/x-p1.md)");
    // a tokenized (non-linked) design cell is carried verbatim, never judged here.
    expect(parsed.chain.phases[1].designCell).toBe("P2-design");
  });

  it("parses the Change-history rows with their version tokens", () => {
    const table = parsed.tables["Change history"];
    expect(table.rows.map((row) => row[0])).toEqual(["v1.20", "v1.21"]);
  });

  it("parses the dependency-graph edge lines into from/to tokens", () => {
    expect(parsed.graphEdges).toEqual([{ text: "P1 -> P2", from: "P1", to: "P2" }]);
  });

  it("parses the chain root — the overall is the root (no parent/spec links)", () => {
    expect(parsed.chain.docType).toBe("overall");
    expect(parsed.chain.parentLink).toBeNull();
    expect(parsed.chain.specLink).toBeNull();
    expect(parsed.chain.parentTokens).toEqual([]);
  });
});

describe("PlanDocType.parse — the task blocks + the Class-A/B chain root", () => {
  const parsed = new PlanDocType("plan").parse(PLAN);

  it("parses the header lines including the chain anchors", () => {
    expect(parsed.docType).toBe("plan");
    expect(parsed.headerLines.some((line) => line.includes("**Spec:**"))).toBe(true);
    expect(parsed.sections.map((section) => section.heading)).toEqual(["## Constraints"]);
  });

  it("parses every `### Task N:` block into fields + steps", () => {
    expect(parsed.taskBlocks.map((block) => block.id)).toEqual([1, 2]);
    const first = parsed.taskBlocks[0];
    expect(first.heading).toBe("### Task 1: skeleton");
    expect(first.fields.map((field) => field.key)).toEqual([
      "Objective",
      "Files",
      "Consumes",
      "Produces",
      "Steps",
      "Acceptance",
      "DependsOn",
    ]);
    expect(first.steps.map((step) => step.action)).toEqual(["step one", "step two"]);
    expect(first.steps[1].checkable).toBe("second step check");
    const dependsOn = first.fields.find((field) => field.key === "DependsOn");
    expect(dependsOn?.lines[0]).toBe("none");
  });

  it("parses the Class-A `**Spec:**` + Class-B `**Parent program**` chain root verbatim", () => {
    expect(parsed.chain.specLink).toEqual({
      label: "x-design.md",
      target: "docs/kairos/specs/x-design.md",
    });
    expect(parsed.chain.parentLink).toEqual({
      label: "x-overall.md v1.21",
      target: "docs/kairos/specs/x-overall.md",
    });
    expect(parsed.chain.parentTokens).toEqual(["v1.21"]);
    expect(parsed.chain.dependsOn).toBe("P1 design v1.1");
  });
});

describe("PhaseSpecDocType.parse — the design skeleton + the Class-B chain root", () => {
  const parsed = new PhaseSpecDocType("phaseSpec").parse(PHASE_SPEC);

  it("parses the header five-tuple surface", () => {
    expect(parsed.docType).toBe("phase-spec");
    expect(parsed.headerLines.some((line) => line.includes("**Parent program**"))).toBe(true);
    expect(parsed.sections.map((section) => section.heading)).toEqual([
      "## Design",
      "## Constraints",
      "## Review record",
    ]);
  });

  it("parses the double-layer design skeleton into groups + items", () => {
    expect(parsed.design.map((group) => group.number)).toEqual(["1", "2"]);
    expect(parsed.design.map((group) => group.heading)).toEqual(["判定面", "编排面"]);
    expect(parsed.design[0].items.map((item) => item.number)).toEqual(["1.1"]);
    expect(parsed.design[0].items[0].heading).toBe("策略类族");
    expect(parsed.design[1].items.map((item) => item.number)).toEqual(["2.1"]);
    // the `### Acceptance criteria` leaf is a design-body anchor, not a numbered group.
    expect(parsed.design.some((group) => group.heading.startsWith("Acceptance"))).toBe(false);
  });

  it("parses the Class-B chain root — parent link + version tokens", () => {
    expect(parsed.chain.parentLink).toEqual({
      label: "x-overall.md v1.21",
      target: "docs/kairos/specs/x-overall.md",
    });
    expect(parsed.chain.parentTokens).toEqual(["v1.21"]);
    expect(parsed.chain.specLink).toBeNull();
  });
});

describe("the doc-type composition root", () => {
  it("exposes one parser per doc key", () => {
    expect(docTypeParsers.overall).toBeInstanceOf(OverallDocType);
    expect(docTypeParsers.plan).toBeInstanceOf(PlanDocType);
    expect(docTypeParsers.phaseSpec).toBeInstanceOf(PhaseSpecDocType);
  });
});

describe("the DocType class face (spec §2.2)", () => {
  it("carries zero judgment methods — no validate/audit/detect/judge symbols on the class face", () => {
    const source = readFileSync(new URL("../doc.ts", import.meta.url), "utf8");
    const judgementSymbols = source.match(/\b(validate|audit|detect|judge|assert)\s*\(/g) ?? [];
    expect(judgementSymbols, "doc.ts must be judge-free (extract-only)").toEqual([]);
  });

  it("has no exported behavior-carrying bare function", () => {
    const source = readFileSync(new URL("../doc.ts", import.meta.url), "utf8");
    const functionExports = source.match(/export\s+(?:async\s+)?function\s+\w+/g) ?? [];
    expect(functionExports).toEqual([]);
    const arrowExports = source.match(/export\s+const\s+\w+\s*=\s*(?:\([^)]*\)|[\w]+)\s*=>/g) ?? [];
    expect(arrowExports).toEqual([]);
  });
});
