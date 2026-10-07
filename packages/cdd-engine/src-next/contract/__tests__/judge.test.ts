// packages/cdd-engine/src-next/contract/__tests__/judge.test.ts
// T4 judge suite — the interpreter's acceptance surface:
//   · one negative case per invariant class (base nine + the four context-seam
//     strategies) — each must fire a Finding on a non-conforming document;
//   · a conforming overall under a sane fs resolves to ZERO findings (no false
//     positives — the coordinator's single strongest assertion);
//   · the coordinator mixes multiple strategies on one document (aggregation);
//   · the grep assertions: zero switch-case judgment dispatch + zero exported
//     behavior-carrying bare functions in judge/invariants.
// Fixtures are known-good document literals (independent sources of truth) and an
// injected in-memory fs seam — hermetic, no real filesystem here.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { DocFs, Finding } from "../invariants.ts";
import { Contract } from "../judge.ts";

/** A conforming overall — every registered element present, lineage self-consistent. */
const GOOD_OVERALL = [
  "# 测试 Overall",
  "- **Version**: v1.21 · 2026-10-07",
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
  "| overall | docs/kairos/specs/x-overall.md |",
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
  "| 1 | P1 | scope a | [P1-design](docs/kairos/specs/x-p1-design.md) | [P1 plan](docs/kairos/plans/x-p1.md) | criteria a |  |",
  "| 2 | P2 | scope b | P2-design | [P2 plan](docs/kairos/plans/x-p2.md) | criteria b |  |",
  "",
  "## Dependency graph",
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
  "| v1.21 | 2026-10-07 | merged change |",
  "| v1.20 | 2026-10-06 | prior change |",
].join("\n");

const OVERALL_PATH = "docs/kairos/specs/x-overall.md";
const PLAN_PATH = "docs/kairos/plans/x-p3.md";
const SPEC_PATH = "docs/kairos/specs/x-p3-design.md";

/** The sibling-doc fs the conforming doc resolves into. */
const GOOD_OVERALL_FS: DocFs = {
  exists: () => true,
  read: () => null,
  list: (dir) =>
    dir.endsWith("/specs") || dir.endsWith("specs")
      ? ["x-overall.md", "x-p1-design.md", "x-p2-design.md"]
      : ["x-p1.md", "x-p2.md"],
};

/** One empty fs — chains resolve nowhere (for the file-existence negative). */
const EMPTY_FS: DocFs = {
  exists: () => false,
  read: () => null,
  list: () => [],
};

const judge = (
  docKey: "overall" | "plan" | "phaseSpec",
  content: string,
  fs: DocFs = EMPTY_FS,
  phaseId?: string,
): Finding[] =>
  new Contract().validate({
    docKey,
    path: docKey === "overall" ? OVERALL_PATH : docKey === "plan" ? PLAN_PATH : SPEC_PATH,
    content,
    root: ".",
    fs,
    phaseId,
  });

const withKind = (findings: readonly Finding[], kind: string, field?: string): boolean =>
  findings.some(
    (finding) => finding.kind === kind && (field === undefined || finding.field === field),
  );

describe("the conforming overall — zero findings (no false positives)", () => {
  it("judges a conforming overall clean under a sane fs", () => {
    expect(judge("overall", GOOD_OVERALL, GOOD_OVERALL_FS)).toEqual([]);
  });
});

describe("base nine invariants — one negative case each", () => {
  it("presence: a missing required section is reported", () => {
    const content = GOOD_OVERALL.replace("## Maintenance\n- maintenance note", "");
    const findings = judge("overall", content, GOOD_OVERALL_FS);
    expect(withKind(findings, "presence", "## Maintenance")).toBe(true);
  });

  it("uniqueness: a duplicated section heading is reported", () => {
    const content = GOOD_OVERALL.replace(
      "## Document scope",
      "## Document scope\nscope one\n\n## Document scope\nscope two",
    );
    const findings = judge("overall", content, GOOD_OVERALL_FS);
    expect(withKind(findings, "uniqueness", "## Document scope")).toBe(true);
  });

  it("domain: a header value outside its declared shape is reported", () => {
    const content = GOOD_OVERALL.replace("- **Status**: Approved", "- **Status**: Deleted");
    const findings = judge("overall", content, GOOD_OVERALL_FS);
    expect(withKind(findings, "domain", "**Status**")).toBe(true);
  });

  it("crosslink: an issue row referencing an unregistered phase is reported", () => {
    const content = GOOD_OVERALL.replace("| P2 | none | issue two |", "| P9 | none | issue nine |");
    const findings = judge("overall", content, GOOD_OVERALL_FS);
    expect(withKind(findings, "crosslink", "Issue inventory")).toBe(true);
  });

  it("order: the section sequence must follow the declared registry order", () => {
    // A phase-spec with Constraints BEFORE Design inverts the declared sequence.
    const content = [
      "# Test Spec",
      "- **Version**: v1.0",
      "- **Status**: Draft",
      "- **Author**: x",
      "- **Parent program**: [x-overall.md v1.0](docs/kairos/specs/x-overall.md)",
      "- **Depends on**: P1",
      "",
      "## Constraints",
      "",
      "- delta",
      "",
      "## Design",
      "",
      "### 1. 数据面",
      "#### 1.1 登记表",
      "- text",
      "",
      "### Acceptance criteria",
      "",
      "- `c`",
    ].join("\n");
    const findings = judge("phaseSpec", content, EMPTY_FS);
    expect(withKind(findings, "order")).toBe(true);
  });

  it("continuity: plan task ids must be contiguous from 1", () => {
    const content = [
      "# Test Plan",
      "**Spec:** [x-design.md](docs/kairos/specs/x-design.md)",
      "- **Parent program**: [x-overall.md v1.21](docs/kairos/specs/x-overall.md)",
      "",
      ...planTask(1),
      ...planTask(3),
    ].join("\n");
    const findings = judge("plan", content, EMPTY_FS);
    expect(withKind(findings, "continuity")).toBe(true);
  });

  it("residue: conditional content leaks while its section is absent", () => {
    const content = [
      "# Test Spec",
      "- **Version**: v1.0",
      "- **Status**: Draft",
      "- **Author**: x",
      "- **Parent program**: [x-overall.md v1.0](docs/kairos/specs/x-overall.md)",
      "- **Depends on**: P1",
      "",
      "## Design",
      "",
      "### 1. 数据面",
      "#### 1.1 登记表",
      "- text",
      "",
      "### Acceptance criteria",
      "",
      "- `c`",
      "",
      "## Constraints",
      "",
      "- delta",
      "",
      "| overall decision | 决定 | Yes |",
    ].join("\n");
    const findings = judge("phaseSpec", content, EMPTY_FS);
    expect(withKind(findings, "residue")).toBe(true);
  });

  it("hollow: a present table section with zero data rows is reported", () => {
    const content = GOOD_OVERALL.replace(
      [
        "## File paths",
        "| Artifact | Path |",
        "| --- | --- |",
        "| overall | docs/kairos/specs/x-overall.md |",
      ].join("\n"),
      "## File paths\n",
    );
    const findings = judge("overall", content, GOOD_OVERALL_FS);
    expect(withKind(findings, "hollow", "## File paths")).toBe(true);
  });

  it("selfBounded: the header version must be the change-history's newest row", () => {
    const content = GOOD_OVERALL.replace(
      "| v1.21 | 2026-10-07 | merged change |",
      "| v1.20 | 2026-10-06 | older only |",
    );
    const findings = judge("overall", content, GOOD_OVERALL_FS);
    expect(withKind(findings, "selfBounded", "**Version**")).toBe(true);
  });
});

describe("the four context-seam invariants — one negative case each", () => {
  it("file-existence: a chain link target that does not resolve is reported", () => {
    const content = GOOD_OVERALL.replace(
      "[P1-design](docs/kairos/specs/x-p1-design.md)",
      "[P1-design](docs/kairos/specs/ghost-design.md)",
    );
    const findings = judge("overall", content, EMPTY_FS);
    expect(withKind(findings, "file-existence")).toBe(true);
  });

  it("sibling-scan: a cross-linked doc outside the same-family scan is reported", () => {
    const content = GOOD_OVERALL.replace(
      "[P1-design](docs/kairos/specs/x-p1-design.md)",
      "[P1-design](docs/kairos/specs/ghost-design.md)",
    );
    const findings = judge("overall", content, GOOD_OVERALL_FS);
    expect(withKind(findings, "sibling-scan")).toBe(true);
  });

  it("cross-doc-chain: a **Spec:** label that drifts from the resolved basename is reported", () => {
    const content = [
      "# Test Plan",
      "**Spec:** [wrong-label](docs/kairos/specs/x-design.md)",
      "- **Parent program**: [x-overall.md v1.21](docs/kairos/specs/x-overall.md)",
      "",
      ...planTask(1),
    ].join("\n");
    const findings = judge("plan", content, EMPTY_FS);
    expect(withKind(findings, "cross-doc-chain", "**Spec:**")).toBe(true);
  });

  it("cross-doc-chain: an unregistered dispatch phase is reported (face ④)", () => {
    const findings = judge("overall", GOOD_OVERALL, GOOD_OVERALL_FS, "P9");
    expect(withKind(findings, "cross-doc-chain", "Phase inventory")).toBe(true);
  });

  it("section-scoped-domain: an issue ref outside the declared form is judged only in scope", () => {
    const content = GOOD_OVERALL.replace(
      "| P1 | #123 | issue one |",
      "| P1 | prose ref | issue one |",
    );
    const findings = judge("overall", content, GOOD_OVERALL_FS);
    expect(withKind(findings, "section-scoped-domain", "Issue inventory")).toBe(true);
  });
});

describe("the coordinator", () => {
  it("aggregates findings from multiple strategies on one document", () => {
    const content = GOOD_OVERALL.replace("- **Status**: Approved", "- **Status**: Deleted").replace(
      "| P2 | none | issue two |",
      "| P9 | prose | issue nine |",
    );
    const findings = judge("overall", content, GOOD_OVERALL_FS, "P9");
    expect(withKind(findings, "domain", "**Status**")).toBe(true);
    expect(withKind(findings, "crosslink", "Issue inventory")).toBe(true);
    expect(withKind(findings, "section-scoped-domain", "Issue inventory")).toBe(true);
    expect(withKind(findings, "presence", "Issue inventory")).toBe(false); // sections are present
    expect(findings.length).toBeGreaterThanOrEqual(3);
  });
});

describe("governance greps (the engine-zero criterion)", () => {
  it("dispatches judgment without any switch-case (grep)", () => {
    for (const name of ["judge.ts", "invariants.ts", "doc.ts"]) {
      const source = readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
      expect(source.match(/\bswitch\s*\(/), name).toBeNull();
    }
  });

  it("exports zero behavior-carrying bare functions from judge/invariants (grep)", () => {
    for (const name of ["judge.ts", "invariants.ts"]) {
      const source = readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
      const functionExports = source.match(/export\s+(?:async\s+)?function\s+\w+/g) ?? [];
      expect(functionExports, name).toEqual([]);
      const behaviorConstExports =
        source.match(/export\s+const\s+\w+\s*=\s*(?:\([^)]*\)|[\w]+)\s*=>/g) ?? [];
      expect(behaviorConstExports, name).toEqual([]);
    }
  });
});

/** One rendered `### Task N:` block with all required fields. */
function planTask(id: number): string[] {
  return [
    `### Task ${id}: task`,
    `- **Objective**: objective`,
    `- **Files**: file`,
    `- **Consumes**: consumes`,
    `- **Produces**: produces`,
    `- **Steps**:`,
    `  - step one`,
    `- **Acceptance**: acceptance`,
    `- **DependsOn**: none`,
  ];
}
