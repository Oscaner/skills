// packages/cdd-engine/src-next/contract/__tests__/doc.test.ts
// T4 parse-layer suite (contract/doc.ts) — the brief's positive checkables:
//   · the four tables of the overall parse as header + data rows;
//   · the plan's `### Task N:` blocks parse into fields + steps;
//   · the phase-spec's `## Design` double-layer skeleton parses into groups + items;
//   · the cross-doc chain root parses the `program:` slug reference verbatim (unresolved);
//   · the DocType class face carries zero judgment methods (spec §2.2 — the machine
//     assertion surface: extract-only classes).
// Since T6 the fixtures carry the front-matter head (the §2.2 delivery seam's
// canonical document form) and every parse runs dual-param — the title face is the
// head scalar, never the `---` fence line the split consumed, and the chain root
// reads the head scalars (the `{ target }`-only ChainLink face).
// The parse records and known-good document literals are the independent sources of
// truth — every assertion compares against the fixture doc the parser must extract.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SkeletonAssembler } from "../../render/skeleton.ts";
import { declaredRegistries } from "../declare.ts";
import type { DocType, ParsedDoc } from "../doc.ts";
import { docTypeParsers, OverallDocType, PhaseSpecDocType, PlanDocType } from "../doc.ts";
import { FrontMatterExtractor } from "../frontmatter.ts";
import {
  DesignBodyExtractor,
  GraphExtractor,
  HeadingScanner,
  TableExtractor,
  TaskExtractor,
} from "../home-extractors.ts";
import { Contract } from "../judge.ts";
import type { DocKey } from "../project.ts";
import { Projector } from "../project.ts";

/** A conforming overall — the front-matter head, the four tables and the graph. */
const OVERALL = [
  "---",
  "title: 文档架构方法论 v2 — 测试 Overall",
  "doc-type: overall-spec",
  "version: v1.1",
  "date: 2026-10-07",
  "status: Approved",
  'author: "[human]"',
  "---",
  "",
  "## Document scope",
  "scope prose",
  "",
  "## File paths",
  "| Artifact | Path |",
  "| --- | --- |",
  "| overall-spec | docs/kairos/specs/test-overall.md |",
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

/** A conforming plan — the front-matter head (identity + the `depends-on:` scalar;
 *  a plan carries no chain key) + the `### Task N:` blocks. */
const PLAN = [
  "---",
  "title: 文档架构方法论 v2 — 测试 Plan",
  "doc-type: plan",
  "version: v1.1",
  "date: 2026-10-07",
  "slug: x-p1",
  "depends-on: P1 design v1.1",
  "base: develop",
  "---",
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

/** A conforming phase-spec — the front-matter head (the five-tuple scalars) + the design skeleton. */
const PHASE_SPEC = [
  "---",
  "title: 文档架构方法论 v2 — 测试 Design Spec",
  "doc-type: phase-spec",
  "version: v1.2",
  "date: 2026-10-07",
  "slug: x-p1",
  "program: x-overall",
  "status: Draft",
  'author: "[human]"',
  "parent-version: v1.21",
  "depends-on: P1（Done）",
  "---",
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

/** Parse a known-good literal with its front-matter head — the §2.2 delivery seam
 *  the judge's chain-docs producers use (RAW content → fence split → dual-param parse). */
const parseWithHead = <P extends ParsedDoc>(parser: DocType<P>, doc: readonly string[]): P => {
  const split = FrontMatterExtractor.split(doc.join("\n"));
  return parser.parse(FrontMatterExtractor.lineSplit(split.body), split.head);
};

describe("OverallDocType.parse — the four tables + the chain root", () => {
  const parsed = parseWithHead(new OverallDocType("overall-spec"), OVERALL);

  it("parses the front-matter head and the section skeleton", () => {
    expect(parsed.docType).toBe("overall-spec");
    // the title face is the head scalar — never the `---` fence line
    expect(parsed.title).toBe("文档架构方法论 v2 — 测试 Overall");
    expect(parsed.title).not.toBe("---");
    expect(parsed.head?.docType).toBe("overall-spec");
    expect(parsed.head?.version).toBe("v1.1");
    expect(parsed.head?.status).toBe("Approved");
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
    expect(table.rows).toEqual([["overall-spec", "docs/kairos/specs/test-overall.md"]]);
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

  it("parses the chain root — the overall is the root (no program link)", () => {
    expect(parsed.chain.docType).toBe("overall-spec");
    expect(parsed.chain.programLink).toBeNull();
    expect(parsed.chain.parentTokens).toEqual([]);
  });
});

describe("PlanDocType.parse — the task blocks + the degraded chain root", () => {
  const parsed = parseWithHead(new PlanDocType("plan"), PLAN);

  it("parses the front-matter head and the section skeleton", () => {
    expect(parsed.docType).toBe("plan");
    // the title face is the head scalar — never the `---` fence line
    expect(parsed.title).toBe("文档架构方法论 v2 — 测试 Plan");
    expect(parsed.title).not.toBe("---");
    expect(parsed.head?.slug).toBe("x-p1");
    expect(parsed.head?.dependsOn).toBe("P1 design v1.1");
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

  it("parses the degraded chain root — a plan carries no program link (its chain is the same-slug identity document)", () => {
    expect(parsed.chain.programLink).toBeNull();
    expect(parsed.chain.parentTokens).toEqual([]);
    expect(parsed.chain.dependsOn).toBe("P1 design v1.1");
  });
});

describe("PhaseSpecDocType.parse — the design skeleton + the program chain root", () => {
  const parsed = parseWithHead(new PhaseSpecDocType("phase-spec"), PHASE_SPEC);

  it("parses the front-matter head (the five-tuple scalars) and the section skeleton", () => {
    expect(parsed.docType).toBe("phase-spec");
    // the title face is the head scalar — never the `---` fence line
    expect(parsed.title).toBe("文档架构方法论 v2 — 测试 Design Spec");
    expect(parsed.title).not.toBe("---");
    expect(parsed.head?.status).toBe("Draft");
    expect(parsed.head?.program).toBe("x-overall");
    expect(parsed.head?.parentVersion).toBe("v1.21");
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

  it("parses the program chain root — the `program:` slug reference + the version tokens", () => {
    expect(parsed.chain.programLink).toEqual({ target: "x-overall" });
    expect(parsed.chain.parentTokens).toEqual(["v1.21"]);
    expect(parsed.chain.dependsOn).toBe("P1（Done）");
  });
});

describe("the home-driven extractors (T3 · spec §3.2) — the fixed structure rules over the registry's anchors", () => {
  it("TaskExtractor — block heads + aligned id tokens + the scoped field/step occurrences", () => {
    const extracted = new TaskExtractor().extract(declaredRegistries.plan, PLAN);
    expect(extracted["### Task N:"]).toEqual(["### Task 1: skeleton", "### Task 2: registry"]);
    expect(extracted["Task id token"]).toEqual(["1", "2"]);
    expect(extracted["**Objective**"]).toEqual([
      "- **Objective**: establish the skeleton",
      "- **Objective**: declare the registries",
    ]);
    expect(extracted["**DependsOn**"]).toEqual(["- **DependsOn**: none", "- **DependsOn**: 1"]);
    // the step bullets are scoped to the `**Steps**` field and matched on the
    // trimmed form — the header / constraint bullets never leak in
    expect(extracted["Step action"]).toEqual([
      "  - step one",
      "  - step two — checkable: second step check",
      "  - write the registry — checkable: types compile",
    ]);
    expect(extracted["Step checkable"]).toEqual([
      "  - step two — checkable: second step check",
      "  - write the registry — checkable: types compile",
    ]);
    // the front-matter head scalars never become line occurrences of a body anchor
    expect(extracted.slug).toBeUndefined();
    expect(extracted["depends-on"]).toBeUndefined();
  });

  it("DesignBodyExtractor — the numbered group/item headings and the design leaves", () => {
    const extracted = new DesignBodyExtractor().extract(
      declaredRegistries["phase-spec"],
      PHASE_SPEC,
    );
    expect(extracted["## Design"]).toEqual(["## Design"]);
    expect(extracted["### N. group heading"]).toEqual(["### 1. 判定面", "### 2. 编排面"]);
    expect(extracted["#### N.M item heading"]).toEqual(["#### 1.1 策略类族", "#### 2.1 波次"]);
    expect(extracted["### Acceptance criteria"]).toEqual(["### Acceptance criteria"]);
    expect(new DesignBodyExtractor().groupOf("### 1. 判定面")).toEqual({
      number: "1",
      heading: "判定面",
    });
    expect(new DesignBodyExtractor().itemOf("#### 2.1 波次")).toEqual({
      number: "2.1",
      heading: "波次",
    });
  });

  it("GraphExtractor — the declared graph edge lines on their trimmed form", () => {
    const sections = new OverallDocType("overall-spec").parse(OVERALL).sections;
    const graphSection = sections.find((section) =>
      section.heading.startsWith("## Dependency graph"),
    );
    expect(graphSection).toBeDefined();
    const extracted = new GraphExtractor().extract(declaredRegistries["overall-spec"], [
      ...(graphSection?.lines ?? []),
    ]);
    expect(extracted["Hard edge"]).toEqual(["P1 -> P2"]);
    expect(extracted["Graph legend"]).toEqual(["-> = hard block"]);
    expect(extracted["Soft edge"]).toBeUndefined();
  });

  it("TableExtractor — the declared column-header and data rows", () => {
    const extracted = new TableExtractor().extract(declaredRegistries["overall-spec"], [
      "| Phase | Issue (ref) | Title summary |",
      "| --- | --- | --- |",
      "| P1 | #123 | issue one |",
    ]);
    expect(extracted["Issue inventory columns"]).toEqual([
      "| Phase | Issue (ref) | Title summary |",
    ]);
    expect(extracted["Issue row"]).toEqual(["| P1 | #123 | issue one |"]);
    // the separator row never matches a data anchor
    expect(extracted["Change history row"]).toBeUndefined();
  });

  it("HeadingScanner — the registered section/facet headings by their declared rank", () => {
    const extracted = new HeadingScanner().extract(declaredRegistries["overall-spec"], OVERALL);
    expect(extracted["## Document scope"]).toEqual(["## Document scope"]);
    expect(extracted["### Goal"]).toEqual(["### Goal"]);
    expect(extracted["### Non-goals"]).toEqual(["### Non-goals"]);
  });

  it("HeadingScanner.sectionsOf — the declared rank-2 sections in document order, an undeclared heading excluded", () => {
    const scanner = new HeadingScanner();
    const sections = scanner.sectionsOf(declaredRegistries["overall-spec"], [
      "## Document scope",
      "scope prose",
      "## Review Focus",
      "undeclared prose",
      "## Change history",
      "| v1.1 |",
    ]);
    // the undeclared rank-2 heading is not a section (and does not swallow the
    // declared section that follows it)
    expect(sections.map((section) => section.heading)).toEqual([
      "## Document scope",
      "## Change history",
    ]);
    expect(sections[0].lines).toEqual(["scope prose"]);
    // the phase-spec's conditional `## Review record` is a declared section surface
    const phaseSections = scanner.sectionsOf(declaredRegistries["phase-spec"], [
      "## Design",
      "## Review record",
      "- note",
    ]);
    expect(phaseSections.map((section) => section.heading)).toEqual([
      "## Design",
      "## Review record",
    ]);
  });

  it("TableExtractor.tableLinesOf / headerLineOf — the table rows and the registry-declared header row", () => {
    const extractor = new TableExtractor();
    const lines = [
      "prose line",
      "| Phase | Issue (ref) | Title summary |",
      "| --- | --- | --- |",
      "| P1 | #123 | issue one |",
    ];
    expect(extractor.tableLinesOf(lines)).toEqual([
      "| Phase | Issue (ref) | Title summary |",
      "| P1 | #123 | issue one |",
    ]);
    expect(extractor.headerLineOf(declaredRegistries["overall-spec"], lines)).toBe(
      "| Phase | Issue (ref) | Title summary |",
    );
    // a table whose declared column anchor is absent has no declared header
    expect(extractor.headerLineOf(declaredRegistries["overall-spec"], ["| a | b |"])).toBeNull();
  });
});

describe("the doc-type composition root", () => {
  it("exposes one parser per doc key", () => {
    expect(docTypeParsers["overall-spec"]).toBeInstanceOf(OverallDocType);
    expect(docTypeParsers.plan).toBeInstanceOf(PlanDocType);
    expect(docTypeParsers["phase-spec"]).toBeInstanceOf(PhaseSpecDocType);
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

describe("P2 — the four doc skeletons judge clean (spec §7.2 colocated pin)", () => {
  /** The empty fs seam — every chain link of a skeleton is a `<…>` placeholder
   *  target (the judge's exemption chain), so the file-existence / sibling-scan
   *  surfaces never fire and the skeleton is green by construction. */
  const EMPTY_FS = { exists: () => false, read: () => null, list: () => [] };
  const contract = new Contract();
  const projector = new Projector(declaredRegistries);
  const PATH_OF: Record<DocKey, string> = {
    "overall-spec": "docs/kairos/specs/x-overall.md",
    plan: "docs/kairos/plans/x-p1.md",
    "phase-spec": "docs/kairos/specs/x-p1-design.md",
    "single-spec": "docs/kairos/specs/x-single-spec.md",
  };
  /** The fixed run date — the version-row date truth (never a live clock). */
  const DATE = "2026-10-11";

  /** The fixed-date skeleton bytes of one doc type. */
  const renderOf = (key: DocKey): string =>
    new SkeletonAssembler(projector.skeleton()[key], DATE).render();

  it("judges each type's skeleton clean — zero findings (the §4.1 placeholder-anchored by-construction green)", () => {
    for (const key of ["overall-spec", "plan", "phase-spec", "single-spec"] as const) {
      const findings = contract.validate({
        docKey: key,
        path: PATH_OF[key],
        content: renderOf(key),
        root: ".",
        fs: EMPTY_FS,
      });
      expect(findings, `${key} skeleton findings`).toEqual([]);
    }
  });

  it("keeps every `:::fill` inside the content positions — zero hits on the link anchors / structure rows", () => {
    for (const key of ["overall-spec", "plan", "phase-spec", "single-spec"] as const) {
      for (const line of renderOf(key).split("\n")) {
        if (!line.includes(":::fill")) continue;
        // the placeholder-link anchors (`](<`), the version/status truths, the
        // table column headers and the separator rows never carry a fill
        expect(line, `${key}: ${line}`).not.toMatch(/\]\(</);
        expect(line, `${key}: ${line}`).not.toMatch(/^- \*\*Version\*\*:|^- \*\*Status\*\*:/);
        expect(line, `${key}: ${line}`).not.toMatch(/^\| (Artifact|Phase|#|Version) \|/);
        expect(line, `${key}: ${line}`).not.toMatch(/^\| ?---/);
      }
    }
  });

  it("the numeric headings are true values — the shape `### 1.` / `#### 1.1` / `### Task 1:` land, a literal `N` never", () => {
    const spec = renderOf("phase-spec");
    expect(spec).toContain("### 1. :::fill group-title");
    expect(spec).toContain("#### 1.1 :::fill item-title");
    expect(renderOf("plan")).toContain("### Task 1: :::fill task-title");
    expect(spec).not.toContain("Task N:");
    expect(renderOf("plan")).not.toContain("Task N:");
  });
});
