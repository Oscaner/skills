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
  "| P1 | DocType 抽象 + schema 工厂 | scope a | [P1-design](docs/kairos/specs/x-p1-design.md) | [P1 plan](docs/kairos/plans/x-p1.md) | criteria a |  |",
  "| P2 | 判定面 + 协调器 | scope b | P2-design | [P2 plan](docs/kairos/plans/x-p2.md) | criteria b |  |",
  "",
  "## Dependency graph",
  "P1 -> P2",
  "- `->` = hard block（依赖前置 phase 发布后方可启动）",
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

describe("the canonical repo forms (no false positives on real conventions)", () => {
  it("presence: the token-in-heading task id is satisfied by the parsed task blocks (not a line scan)", () => {
    const content = [
      "# Test Plan",
      "**Spec:** [x-design.md](docs/kairos/specs/x-design.md)",
      "- **Parent program**: [x-overall.md v1.21](docs/kairos/specs/x-overall.md)",
      "",
      ...planTask(1),
    ].join("\n");
    const findings = judge("plan", content, EMPTY_FS);
    expect(withKind(findings, "presence", "Task id token")).toBe(false);
  });

  it("presence: the graph legend tolerates the canonical backticked form — and its absence is reported", () => {
    const removed = GOOD_OVERALL.replace(
      "- `->` = hard block（依赖前置 phase 发布后方可启动）",
      "P1 -> P1b",
    );
    expect(withKind(judge("overall", removed, GOOD_OVERALL_FS), "presence", "Graph legend")).toBe(
      true,
    );
  });

  it("presence: a task block missing a registry-declared task field is reported (derived field set)", () => {
    const content = [
      "# Test Plan",
      "**Spec:** [x-design.md](docs/kairos/specs/x-design.md)",
      "- **Parent program**: [x-overall.md v1.21](docs/kairos/specs/x-overall.md)",
      "",
      "### Task 1: task",
      "- **Objective**: objective",
      "- **Files**: file",
      "- **Consumes**: consumes",
      "- **Produces**: produces",
      "- **Steps**:",
      "  - step one",
      "- **DependsOn**: none",
    ].join("\n");
    const findings = judge("plan", content, EMPTY_FS);
    expect(withKind(findings, "presence", "**Acceptance**")).toBe(true);
  });

  it("domain: a backticked citation of an anchor literal is not judged as a value", () => {
    const content = [
      "# Test Plan",
      "**Spec:** [x-design.md](docs/kairos/specs/x-design.md)",
      "- **Parent program**: [x-overall.md v1.21](docs/kairos/specs/x-overall.md)",
      "- **Consumes**: T1 骨架 · doc.ts（plan DocType.parse：`### Task N:` 块归口 doc.ts）",
      "",
      ...planTask(1),
    ].join("\n");
    const findings = judge("plan", content, EMPTY_FS);
    expect(withKind(findings, "domain", "### Task N:")).toBe(false);
  });

  it("domain: a table-cell citation of a section anchor is not judged as a value", () => {
    const content = GOOD_OVERALL.replace(
      "| v1.20 | 2026-10-06 | prior change |",
      "| v1.20 | 2026-10-06 | `## Program charter` 重构 |",
    );
    const findings = judge("overall", content, GOOD_OVERALL_FS);
    expect(withKind(findings, "domain", "## Program charter")).toBe(false);
  });

  it("presence+domain: the TITLED task heading is a valid `### Task N:` (the tree-wide form)", () => {
    // find #8: the registry's bare-heading pattern rejected the titled form — the
    // wave's own plan (25/25 plans use `### Task N: <title>`) was reported missing
    const content = [
      "# Test Plan",
      "**Spec:** [x-design.md](docs/kairos/specs/x-design.md)",
      "- **Parent program**: [x-overall.md v1.21](docs/kairos/specs/x-overall.md)",
      "",
      "### Task 1: task title",
      "- **Objective**: objective",
      "- **Files**: file",
      "- **Consumes**: consumes",
      "- **Produces**: produces",
      "- **Steps**:",
      "  - step one",
      "- **Acceptance**: acceptance",
      "- **DependsOn**: none",
    ].join("\n");
    const findings = judge("plan", content, EMPTY_FS);
    expect(withKind(findings, "presence", "### Task N:")).toBe(false);
    expect(withKind(findings, "domain", "### Task N:")).toBe(false);
    // the bare heading is the same pattern's canonical form — both conform
    const bare = content.replace("### Task 1: task title", "### Task 1:");
    expect(withKind(judge("plan", bare, EMPTY_FS), "presence", "### Task N:")).toBe(false);
    // a non-numeric heading is still outside the domain
    expect(
      withKind(
        judge("plan", content.replace("### Task 1:", "### Task X:"), EMPTY_FS),
        "presence",
        "### Task N:",
      ),
    ).toBe(true);
  });

  it("domain: a nested backtick citation (`outer quote … inner `anchor`) is not judged as a value", () => {
    // find #8: the old span-by-span strip consumed the outer quote's opener and left
    // the nested `…` citation naked — the p4.1 spec's command-quoted prose was judged
    // as `## Constraints` / `**Version**` values
    const content = [
      "# Test Plan",
      "**Spec:** [x-design.md](docs/kairos/specs/x-design.md)",
      "- **Parent program**: [x-overall.md v1.21](docs/kairos/specs/x-overall.md)",
      "- **Depends on**: P1",
      "- **Consumes**: T1（`read the plan's `## Constraints` (at INPUT_PLAN)`）·「`the `**Version**` header`」零残留",
      "",
      ...planTask(1),
    ].join("\n");
    const findings = judge("plan", content, EMPTY_FS);
    expect(withKind(findings, "domain", "## Constraints")).toBe(false);
    expect(withKind(findings, "domain", "**Version**")).toBe(false);
  });

  it("two adjacent backtick spans read as ONE quoted region — the mid-span prose is not judged (the pinned first-last strip)", () => {
    // The find-#8 first-last strip consumes the whole first→last backtick region as
    // quoted. On a line carrying TWO separate spans, the prose BETWEEN them is part
    // of that region — an anchor quoted only there is invisible to the domain rule.
    // Pinned tradeoff (the comment on #withoutCodeSpans): the enforced docs' quoted
    // shapes are the simple `span` and the nested citation, neither of which hides a
    // real structural anchor between two adjacent spans; a span-by-span strip would
    // judge this middle prose and reopen the nested-citation gap the pin closes.
    const content = [
      "# Test Spec",
      "- **Version**: v1.1 · 2026-10-09",
      "- **Status**: Draft",
      "- **Author**: x",
      "- **Parent program**: [x-overall.md v1.0](docs/kairos/specs/x-overall.md)",
      "- **Depends on**: P1",
      "",
      "## Design",
      "",
      "intro — the double-layer skeleton semantics.",
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
      "## Change history",
      "",
      "| Version | date | summary | author |",
      "|---|---|---|---|",
      "| v1.0 | 2026-10-08 | prior | [human] |",
      "| v1.1 | 2026-10-09 | merged | [human] |",
    ]
      .join("\n")
      .replace("- **Status**: Draft", "- `p1` then **Status**: Deleted then `p2`");
    const findings = judge("phaseSpec", content, EMPTY_FS);
    expect(withKind(findings, "domain", "**Status**")).toBe(false);
  });

  it("order: the change-history rows must be version-ascending (canonical oldest-first)", () => {
    const content = GOOD_OVERALL.replace(
      ["| v1.20 | 2026-10-06 | prior change |", "| v1.21 | 2026-10-07 | merged change |"].join(
        "\n",
      ),
      ["| v1.21 | 2026-10-07 | merged change |", "| v1.20 | 2026-10-06 | prior change |"].join(
        "\n",
      ),
    );
    const findings = judge("overall", content, GOOD_OVERALL_FS);
    expect(withKind(findings, "order", "Change history")).toBe(true);
  });

  it("residue: a legitimate design-body table does not count as Deviations residue", () => {
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
      "#### 1.1 技能集合",
      "| skill | 角色 | 说明 |",
      "| --- | --- | --- |",
      "| cdd-design | 编排 | brainstorm 路由 |",
      "| cdd-analysis | spec-writer | 参数化模板 |",
      "",
      "### Acceptance criteria",
      "",
      "- `c`",
      "",
      "## Constraints",
      "",
      "- delta",
      "",
      "## Review record",
      "- review note",
    ].join("\n");
    const findings = judge("phaseSpec", content, EMPTY_FS);
    expect(withKind(findings, "residue")).toBe(false);
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

// ---------------------------------------------------------------------------
// P4.1 T2 — the three-type homogeneity: `**Version**` required + strict (number · date) ·
// `## Change history` required ×3 · selfBounded ×3 (header = the newest in-row)
// ---------------------------------------------------------------------------

/** A minimal phase-spec carrying the canonical version lineage (strict Version
 *  header + a Change-history table) — the T2 judgment surface. */
function specLineage(headerVersion: string, rows: readonly string[]): string {
  return [
    "# Test Spec",
    `- **Version**: ${headerVersion}`,
    "- **Status**: Draft",
    "- **Author**: x",
    "- **Parent program**: [x-overall.md v1.0](docs/kairos/specs/x-overall.md)",
    "- **Depends on**: P1",
    "",
    "## Design",
    "",
    "intro — the double-layer skeleton semantics.",
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
    "## Change history",
    "",
    "| Version | date | summary | author |",
    "|---|---|---|---|",
    ...rows,
  ].join("\n");
}

/** A minimal plan carrying the canonical version lineage. */
function planLineage(headerVersion: string, rows: readonly string[]): string {
  return [
    "# Test Plan",
    "**Spec:** [x-design.md](docs/kairos/specs/x-design.md)",
    "- **Parent program**: [x-overall.md v1.0](docs/kairos/specs/x-overall.md)",
    `- **Version**: ${headerVersion}`,
    "",
    "## Constraints",
    "",
    "- delta",
    "",
    ...planTask(1),
    "",
    "## Change history",
    "",
    "| Version | date | summary | author |",
    "|---|---|---|---|",
    ...rows,
  ].join("\n");
}

const ROW_100 = "| v1.0 | 2026-10-08 | prior | [human] |";
const ROW_101 = "| v1.1 | 2026-10-09 | merged | [human] |";

describe("P4.1 T2 — **Version** presence required ×3 (plan optional → required)", () => {
  it("a plan without a **Version** header is reported", () => {
    const content = planLineage("v1.0 · 2026-10-09", [ROW_100]).replace(
      "- **Version**: v1.0 · 2026-10-09",
      "",
    );
    const findings = judge("plan", content);
    expect(withKind(findings, "presence", "**Version**")).toBe(true);
  });

  it("a phase-spec without a **Version** header is reported", () => {
    const content = specLineage("v1.0 · 2026-10-09", [ROW_100]).replace(
      "- **Version**: v1.0 · 2026-10-09",
      "",
    );
    const findings = judge("phaseSpec", content);
    expect(withKind(findings, "presence", "**Version**")).toBe(true);
  });

  it("an overall without a **Version** header is reported (the requiredness holds)", () => {
    const content = GOOD_OVERALL.replace("- **Version**: v1.21 · 2026-10-07", "");
    const findings = judge("overall", content, GOOD_OVERALL_FS);
    expect(withKind(findings, "presence", "**Version**")).toBe(true);
  });
});

describe("P4.1 T2 — the **Version** strict form (number + date · zero supplement/link/bold)", () => {
  it("a trailing parenthetical supplement is refused (plan and spec)", () => {
    for (const [docKey, doc] of [
      ["plan", planLineage("v1.0 （v1.0 补充）", [ROW_100])],
      ["phaseSpec", specLineage("v1.0 （v1.0 补充）", [ROW_100])],
    ] as const) {
      expect(withKind(judge(docKey, doc), "domain", "**Version**")).toBe(true);
    }
  });

  it("a trailing prose supplement after the date is refused (plan and spec)", () => {
    for (const [docKey, doc] of [
      ["plan", planLineage("v1.0 · 2026-10-09 说明应在 Change history", [ROW_100])],
      ["phaseSpec", specLineage("v1.0 · 2026-10-09 说明应在 Change history", [ROW_100])],
    ] as const) {
      expect(withKind(judge(docKey, doc), "domain", "**Version**")).toBe(true);
    }
  });

  it("a bold **vX.Y** form is refused (plan and spec)", () => {
    for (const [docKey, doc] of [
      ["plan", planLineage("**v1.0** · 2026-10-09", [ROW_100])],
      ["phaseSpec", specLineage("**v1.0** · 2026-10-09", [ROW_100])],
    ] as const) {
      expect(withKind(judge(docKey, doc), "domain", "**Version**")).toBe(true);
    }
  });

  it("the canonical `vX.Y · date` form carries no **Version** domain finding (plan and spec)", () => {
    for (const docKey of ["plan", "phaseSpec"] as const) {
      const doc =
        docKey === "plan"
          ? planLineage("v1.0 · 2026-10-09", [ROW_100])
          : specLineage("v1.0 · 2026-10-09", [ROW_100]);
      expect(withKind(judge(docKey, doc), "domain", "**Version**")).toBe(false);
    }
  });
});

describe("P4.1 T2 — `## Change history` presence required ×3", () => {
  it("a plan without the Change-history section is reported", () => {
    const content = planLineage("v1.0 · 2026-10-09", [ROW_100]).replace(
      [
        "## Change history",
        "",
        "| Version | date | summary | author |",
        "|---|---|---|---|",
        ROW_100,
      ].join("\n"),
      "",
    );
    const findings = judge("plan", content);
    expect(withKind(findings, "presence", "## Change history")).toBe(true);
  });

  it("a phase-spec without the Change-history section is reported", () => {
    const content = specLineage("v1.0 · 2026-10-09", [ROW_100]).replace(
      [
        "## Change history",
        "",
        "| Version | date | summary | author |",
        "|---|---|---|---|",
        ROW_100,
      ].join("\n"),
      "",
    );
    const findings = judge("phaseSpec", content);
    expect(withKind(findings, "presence", "## Change history")).toBe(true);
  });

  it("an overall without the Change-history section is reported (the requiredness holds)", () => {
    const content = GOOD_OVERALL.replace(
      [
        "## Change history",
        "| Version | Date | Summary |",
        "| --- | --- | --- |",
        "| v1.20 | 2026-10-06 | prior change |",
        "| v1.21 | 2026-10-07 | merged change |",
      ].join("\n"),
      "",
    );
    const findings = judge("overall", content, GOOD_OVERALL_FS);
    expect(withKind(findings, "presence", "## Change history")).toBe(true);
  });
});

describe("P4.1 T2 — selfBounded applies to spec/plan (header = the newest in-row)", () => {
  it("a phase-spec whose header is NOT the change-history's newest row is reported", () => {
    const findings = judge("phaseSpec", specLineage("v1.0 · 2026-10-09", [ROW_100, ROW_101]));
    expect(withKind(findings, "selfBounded", "**Version**")).toBe(true);
  });

  it("a plan whose header is OUTSIDE the lineage is reported", () => {
    const findings = judge("plan", planLineage("v1.2 · 2026-10-09", [ROW_100, ROW_101]));
    expect(withKind(findings, "selfBounded", "**Version**")).toBe(true);
  });

  it("a spec/plan whose header IS the newest in-row version carries no selfBounded finding", () => {
    for (const docKey of ["plan", "phaseSpec"] as const) {
      const doc =
        docKey === "plan"
          ? planLineage("v1.1 · 2026-10-09", [ROW_100, ROW_101])
          : specLineage("v1.1 · 2026-10-09", [ROW_100, ROW_101]);
      expect(withKind(judge(docKey, doc), "selfBounded", "**Version**")).toBe(false);
    }
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
