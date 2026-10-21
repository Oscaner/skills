// packages/cdd-engine/src-next/contract/__tests__/judge.test.ts
// T4 judge suite — the interpreter's acceptance surface:
//   · one negative case per invariant class (base nine + the six context-seam
//     strategies) — each must fire a Finding on a non-conforming document;
//   · a conforming overall under a sane fs resolves to ZERO findings (no false
//     positives — the coordinator's single strongest assertion);
//   · the coordinator mixes multiple strategies on one document (aggregation);
//   · the grep assertions: zero switch-case judgment dispatch + zero exported
//     behavior-carrying bare functions in judge/invariants.
// Fixtures are known-good document literals (independent sources of truth) and an
// injected in-memory fs seam — hermetic, no real filesystem here. Since T6 the
// fixtures carry the front-matter head (the §2.2 delivery seam: validate() splits
// the raw content, feeds the typed head into parse + the judged context, and the
// front-matter-home elements judge the head record).

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Words } from "../../face/words.ts";
import { SlugIndex } from "../../infra/slug-index.ts";
import { FrontMatterExtractor } from "../frontmatter.ts";
import type { DocFs, Finding } from "../invariants.ts";
import { Contract } from "../judge.ts";
import { Translator } from "../translate.ts";

/** A conforming overall — every registered element present, lineage self-consistent. */
const GOOD_OVERALL = [
  "---",
  "title: 测试 Overall",
  "doc-type: overall",
  "version: v1.21",
  "date: 2026-10-07",
  "slug: x-overall",
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
  "## Constraints",
  "",
  "- 全部约定自动生效",
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

/** The sibling-doc fs a conforming `x-p3` plan's identity chain resolves into: the
 *  same-slug `x-p3-design.md` is its Class-A identity document, the program overall
 *  is the phase-spec's `program:` target, every other name is an unrelated doc. */
const PLAN_CHAIN_FS: DocFs = {
  exists: () => true,
  read: (p) =>
    p.endsWith("/x-p3-design.md")
      ? "---\ntitle: S\ndoc-type: phase-spec\nslug: x-p3\nprogram: x-overall\n---\n"
      : p.endsWith("/x-overall.md")
        ? "---\ntitle: O\ndoc-type: overall\nslug: x-overall\nversion: v1.0\n---\n"
        : "---\ntitle: X\ndoc-type: single-spec\nslug: x-other\n---\n",
  list: (dir) =>
    dir.endsWith("/specs") || dir.endsWith("specs")
      ? ["x-overall.md", "x-p3-design.md"]
      : ["x-p3.md"],
};

const judge = (
  docKey: "overall" | "plan" | "phase-spec",
  content: string,
  fs: DocFs = EMPTY_FS,
  phaseId?: string,
  root = ".",
): Finding[] =>
  new Contract().validate({
    docKey,
    path: docKey === "overall" ? OVERALL_PATH : docKey === "plan" ? PLAN_PATH : SPEC_PATH,
    content,
    root,
    fs,
    phaseId,
  });

/** The program overall a phase-spec's lineage resolves against — its head
 *  `version:` plus its Change-history rows define the lineage set {v1.0, v1.1}. */
const SPEC_CHAIN_FS: DocFs = {
  exists: () => true,
  read: (p) =>
    p.endsWith("/x-overall.md")
      ? [
          "---",
          "title: O",
          "doc-type: overall",
          "version: v1.1",
          "slug: x-overall",
          "---",
          "",
          "## Change history",
          "",
          "| Version | date | summary | author |",
          "|---|---|---|---|",
          "| v1.1 | 2026-10-09 | merged | [human] |",
          "| v1.0 | 2026-10-08 | prior | [human] |",
        ].join("\n")
      : "---\ntitle: S\ndoc-type: phase-spec\nslug: x-p3\nprogram: x-overall\n---\n",
  list: (dir) =>
    dir.endsWith("/specs") || dir.endsWith("specs")
      ? ["x-overall.md", "x-p3-design.md"]
      : ["x-p3.md"],
};

const withKind = (findings: readonly Finding[], kind: string, field?: string): boolean =>
  findings.some(
    (finding) => finding.kind === kind && (field === undefined || finding.field === field),
  );

describe("the conforming overall — zero findings (no false positives)", () => {
  it("judges a conforming overall clean under a sane fs", () => {
    expect(judge("overall", GOOD_OVERALL, GOOD_OVERALL_FS)).toEqual([]);
  });
});

describe("P7 — the structure-plane canonicalize seam (Contract.validate row-source)", () => {
  /** The GOOD_OVERALL charter carrying the legacy Chinese markers the English
   *  canonical element patterns match THROUGH the canonicalize view: the
   *  doc-arch-overall decision-group / endorsements leaves (`#### M 组` … /
   *  `#### 上游先例背书`). The markers are UNREGISTERED zh prose to the element
   *  table (English canonicals only) — any match is the row-source seam talking.
   *  The Goal facet stays in its English form (the zh Goal face carries no
   *  registered alternate). */
  const ZH_CHARTER_OVERALL = GOOD_OVERALL.replace(
    "### Goal\n- goal text",
    [
      "### Goal",
      "- goal text",
      "",
      "#### M 组（skill-ref 映射，M1–M4 全关）",
      "- m leaf",
      "",
      "#### F 组（文档平面结构，提案）",
      "- f leaf",
      "",
      "#### R 组（ref 统一身份，提案）",
      "- r leaf",
      "",
      "#### B 组（正文内容，提案）",
      "- b leaf",
      "",
      "#### E 组（经验债，驱动本整体）",
      "- e leaf",
      "",
      "#### 上游先例背书",
      "- endorsement text",
    ].join("\n"),
  );

  it("the structure judge matches the legacy Chinese charter markers through the canonicalize view", () => {
    const findings = judge("overall", ZH_CHARTER_OVERALL, GOOD_OVERALL_FS);
    // the zh decision-group leaves (`#### M 组` …) conform to the canonical
    // `#### [MFRBEN] group` facet through the view
    expect(withKind(findings, "presence", "#### [MFRBEN] group")).toBe(false);
    expect(withKind(findings, "domain", "#### [MFRBEN] group")).toBe(false);
    // the zh endorsements leaf conforms to the canonical facet through the view
    expect(withKind(findings, "domain", "#### Upstream Endorsements")).toBe(false);
  });

  it("a zh title outside the registered canonicals stays identity — a 目标 Goal face is still missing", () => {
    const content = GOOD_OVERALL.replace("### Goal\n- goal text", "### 目标\n- goal text");
    const findings = judge("overall", content, GOOD_OVERALL_FS);
    expect(withKind(findings, "presence", "### Goal")).toBe(true);
  });

  it("the view never writes back — the judged source content stays byte-identical", () => {
    const input = {
      docKey: "overall" as const,
      path: OVERALL_PATH,
      content: ZH_CHARTER_OVERALL,
      root: ".",
      fs: GOOD_OVERALL_FS,
    };
    const findings = new Contract().validate(input);
    expect(input.content).toBe(ZH_CHARTER_OVERALL);
    expect(findings).toEqual([]);
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

  it("domain: a front-matter value outside its declared shape is reported", () => {
    const content = GOOD_OVERALL.replace("status: Approved", "status: Deleted");
    const findings = judge("overall", content, GOOD_OVERALL_FS);
    expect(withKind(findings, "domain", "status")).toBe(true);
  });

  it("domain: the placeholder exemption covers only the keys the skeleton fills", () => {
    // The keys the skeleton fills (§4.2: the slug-reference link slot and the
    // content slots) ride the exemption chain.
    const slugFill = GOOD_OVERALL.replace("slug: x-overall", "slug: ':::fill slug'");
    expect(withKind(judge("overall", slugFill, GOOD_OVERALL_FS), "domain", "slug")).toBe(false);

    // A truth key's value is a concrete literal — a hand-written placeholder there
    // stays outside the declared domain.
    const versionFill = GOOD_OVERALL.replace("version: v1.21", "version: <v1.21>");
    expect(withKind(judge("overall", versionFill, GOOD_OVERALL_FS), "domain", "version")).toBe(
      true,
    );
  });

  it("crosslink: an issue row referencing an unregistered phase is reported", () => {
    const content = GOOD_OVERALL.replace("| P2 | none | issue two |", "| P9 | none | issue nine |");
    const findings = judge("overall", content, GOOD_OVERALL_FS);
    expect(withKind(findings, "crosslink", "Issue inventory")).toBe(true);
  });

  it("order: the section sequence must follow the declared registry order", () => {
    // A phase-spec with Constraints BEFORE Design inverts the declared sequence.
    const content = [
      "---",
      "title: Test Spec",
      "doc-type: phase-spec",
      "version: v1.0",
      "date: 2026-10-09",
      "status: Draft",
      "author: x",
      "slug: x-p3",
      "parent-version: v1.0",
      "---",
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
    const findings = judge("phase-spec", content, EMPTY_FS);
    expect(withKind(findings, "order")).toBe(true);
  });

  it("continuity: plan task ids must be contiguous from 1", () => {
    const content = [
      "---",
      "title: Test Plan",
      "doc-type: plan",
      "version: v1.0",
      "date: 2026-10-09",
      "slug: x-p3",
      "---",
      "",
      ...planTask(1),
      ...planTask(3),
    ].join("\n");
    const findings = judge("plan", content, EMPTY_FS);
    expect(withKind(findings, "continuity")).toBe(true);
  });

  it("residue: conditional content leaks while its section is absent", () => {
    const content = [
      "---",
      "title: Test Spec",
      "doc-type: phase-spec",
      "version: v1.0",
      "date: 2026-10-09",
      "status: Draft",
      "author: x",
      "slug: x-p3",
      "parent-version: v1.0",
      "---",
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
    const findings = judge("phase-spec", content, EMPTY_FS);
    expect(withKind(findings, "residue")).toBe(true);
  });

  it("hollow: a present table section with zero data rows is reported", () => {
    const content = GOOD_OVERALL.replace(
      [
        "## Issue inventory",
        "| Phase | Issue (ref) | Title summary |",
        "| --- | --- | --- |",
        "| P1 | #123 | issue one |",
        "| P2 | none | issue two |",
      ].join("\n"),
      "## Issue inventory\n",
    );
    const findings = judge("overall", content, GOOD_OVERALL_FS);
    expect(withKind(findings, "hollow", "## Issue inventory")).toBe(true);
  });

  it("a historical overall's retained File paths table is accepted — the section is optional and hollow-exempt", () => {
    // The GOOD_OVERALL keeps its legacy File paths table; the optional section
    // and row declarations leave the whole conforming doc at zero findings.
    expect(GOOD_OVERALL).toContain("## File paths");
    expect(judge("overall", GOOD_OVERALL, GOOD_OVERALL_FS)).toEqual([]);
    // An EMPTY retained File paths section is no longer a hollow finding — the
    // hollow filter set is Issue inventory / Phase inventory / Change history.
    const emptyTable = GOOD_OVERALL.replace(
      ["| Artifact | Path |", "| --- | --- |", "| overall | docs/kairos/specs/x-overall.md |"].join(
        "\n",
      ),
      "",
    );
    expect(withKind(judge("overall", emptyTable, GOOD_OVERALL_FS), "hollow", "## File paths")).toBe(
      false,
    );
  });

  it("selfBounded: the header version must be the change-history's newest row", () => {
    const content = GOOD_OVERALL.replace(
      "| v1.21 | 2026-10-07 | merged change |",
      "| v1.20 | 2026-10-06 | older only |",
    );
    const findings = judge("overall", content, GOOD_OVERALL_FS);
    expect(withKind(findings, "selfBounded", "version")).toBe(true);
  });
});

describe("T6 — prose task mentions carry zero crosslink findings (the WARN-only observation surface)", () => {
  /** The sibling-doc fs a conforming plan's chain resolves into (exists + the
   *  same-family listings the file-existence/sibling-scan surfaces judge) — the
   *  shared identity-bearing fixture at the top of this file. */
  const GOOD_PLAN_FS = PLAN_CHAIN_FS;

  /** A structurally conforming plan — every registered plan element present
   *  (front-matter head + version lineage + task fields + Change history) carrying
   *  a prose mention of an unregistered historical task id in its Objective. */
  function conformingPlanWithProse(objective: string): string {
    return [
      "---",
      "title: Test Plan",
      "doc-type: plan",
      "version: v1.1",
      "date: 2026-10-09",
      "slug: x-p3",
      "---",
      "",
      "## Constraints",
      "",
      "- delta",
      "",
      "### Task 1: task",
      `- **Objective**: ${objective}`,
      "- **Files**: file",
      "- **Consumes**: consumes",
      "- **Produces**: produces",
      "- **Steps**:",
      "  - step one — checkable: green",
      "- **Acceptance**: acceptance",
      "- **DependsOn**: none",
      "",
      "## Change history",
      "",
      "| Version | date | summary | author |",
      "|---|---|---|---|",
      "| v1.0 | 2026-10-08 | prior | [human] |",
      "| v1.1 | 2026-10-09 | merged | [human] |",
    ].join("\n");
  }

  it("a conforming plan prose-referencing an unregistered historical task id scores ZERO findings", () => {
    const content = conformingPlanWithProse(
      "承接 P3.2 的 T25 段既有约定（历史任务序号 · 非本 plan 任务）",
    );
    const findings = judge("plan", content, GOOD_PLAN_FS);
    // the prose mention is the reference-lint WARN observation's — the crosslink
    // invariant never consumes it, and no other surface reports the mention
    expect(withKind(findings, "crosslink", "Task prose reference")).toBe(false);
    expect(findings).toEqual([]);
  });

  it("the DependsOn out-of-bounds hard gate stays — an unregistered DEPENDENCY is still a crosslink finding", () => {
    const content = conformingPlanWithProse("objective").replace(
      "- **DependsOn**: none",
      "- **DependsOn**: 25",
    );
    const findings = judge("plan", content, GOOD_PLAN_FS);
    expect(withKind(findings, "crosslink", "Task 1")).toBe(true);
  });
});

describe("the canonical repo forms (no false positives on real conventions)", () => {
  it("presence: the token-in-heading task id is satisfied by the parsed task blocks (not a line scan)", () => {
    const content = [
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
      "### Task 1: task",
      "- **Objective**: 引用 `### Task N:` 块归口 doc.ts",
      "- **Files**: file",
      "- **Consumes**: consumes",
      "- **Produces**: produces",
      "- **Steps**:",
      "  - step one",
      "- **Acceptance**: acceptance",
      "- **DependsOn**: none",
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
    // the nested `…` citation naked — quoted prose was judged as `## Constraints`
    // values (the plan's front-matter `version:` is a head scalar: a body citation
    // of `version:` is outside the judged surface entirely)
    const content = [
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
      "### Task 1: task",
      "- **Objective**: T1（`read the plan's `## Constraints` (at INPUT_PLAN)`）·「`the `**Version**` header`」零残留",
      "- **Files**: file",
      "- **Consumes**: consumes",
      "- **Produces**: produces",
      "- **Steps**:",
      "  - step one",
      "- **Acceptance**: acceptance",
      "- **DependsOn**: none",
    ].join("\n");
    const findings = judge("plan", content, EMPTY_FS);
    expect(withKind(findings, "domain", "## Constraints")).toBe(false);
    expect(withKind(findings, "domain", "version")).toBe(false);
  });

  it("two adjacent backtick spans read as ONE quoted region — the mid-span prose is not judged (the pinned first-last strip)", () => {
    // The find-#8 first-last strip consumes the whole first→last backtick region as
    // quoted. On a line carrying TWO separate spans, the prose BETWEEN them is part
    // of that region — an anchor quoted only there is invisible to the domain rule.
    // Pinned tradeoff (the comment on #withoutCodeSpans): the enforced docs' quoted
    // shapes are the simple `span` and the nested citation, neither of which hides a
    // real structural anchor between two adjacent spans; a span-by-span strip would
    // judge this middle prose and reopen the nested-citation gap the pin closes.
    const content = phaseSpec("v1.1").replace(
      "- delta",
      "- `p1` then ## Constraints: Deleted then `p2`",
    );
    const findings = judge("phase-spec", content, EMPTY_FS);
    expect(withKind(findings, "domain", "## Constraints")).toBe(false);
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
    const content = phaseSpec("v1.1").replace(
      "### 1. 数据面\n#### 1.1 登记表\n- text",
      "### 1. 数据面\n#### 1.1 技能集合\n| skill | 角色 | 说明 |\n| --- | --- | --- |\n| cdd-design | 编排 | brainstorm 路由 |\n| cdd-analysis | spec-writer | 参数化模板 |",
    );
    const findings = judge("phase-spec", content, EMPTY_FS);
    expect(withKind(findings, "residue")).toBe(false);
  });
});

describe("the six context-seam invariants — one negative case each", () => {
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

  it("P9 T5 — #scanRoots composes the doc dir + doc roots on ONE basis (ctx.root)", () => {
    // The scan roots resolve through the SAME `ctx.root` basis the rest of the
    // judgment reads (never a bare relative string against process.cwd()): with a
    // non-trivial root, the doc's own dir and BOTH declared doc roots join it.
    const seen: string[] = [];
    const fs: DocFs = {
      exists: () => true,
      read: () => null,
      list: (dir) => {
        seen.push(dir);
        return dir.endsWith("/specs") || dir.endsWith("specs")
          ? ["x-overall.md", "x-p1-design.md", "x-p2-design.md"]
          : ["x-p1.md", "x-p2.md"];
      },
    };
    judge("overall", GOOD_OVERALL, fs, undefined, "/abs/repo");
    // Every scan root carries the root basis (`/abs/repo`) — the doc dir + both
    // doc roots, never a bare relative against process.cwd().
    expect(seen.every((dir) => dir.startsWith("/abs/repo/"))).toBe(true);
    expect(seen.some((dir) => dir.endsWith("/docs/kairos/specs"))).toBe(true);
    expect(seen.some((dir) => dir.endsWith("/docs/kairos/plans"))).toBe(true);
  });

  it("a plan whose same-slug identity document is on disk carries zero cross-doc-chain findings (the Class-A positive half)", () => {
    // The plan declares no chain key at all — its chain is the identity document
    // sharing its `slug:`. The index resolves it, so the Class-A arm stays silent.
    const content = [
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
      ...planTask(1),
    ].join("\n");
    const findings = judge("plan", content, PLAN_CHAIN_FS);
    expect(withKind(findings, "cross-doc-chain", "slug")).toBe(false);
    expect(findings.filter((finding) => finding.kind === "cross-doc-chain")).toEqual([]);
  });

  it("a plan with no same-slug identity document is reported — the Class-A negative half names the `slug` key", () => {
    // The same fixture over an EMPTY fs: nothing on disk carries the plan's slug,
    // so the plan has no design spec to dispatch against.
    const content = [
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
      ...planTask(1),
    ].join("\n");
    const findings = judge("plan", content, EMPTY_FS);
    expect(withKind(findings, "cross-doc-chain", "slug")).toBe(true);
  });

  it("slug-ref: a `program:` naming no on-disk overall is reported exactly once", () => {
    // The value is a SLUG (not a path): the judgment is an identity lookup over the
    // doc roots — a slug naming no overall is the hard gate, reported on the
    // `program` key alone (zero path-resolution cascade).
    const findings = judge("phase-spec", specLineage("v1.0", [ROW_100]), EMPTY_FS);
    const slugRef = findings.filter((finding) => finding.kind === "slug-ref");
    expect(slugRef).toHaveLength(1);
    expect(slugRef[0].field).toBe("program");
    expect(slugRef[0].message).toBe(
      "the program reference names no on-disk overall document: x-overall",
    );
    expect(slugRef[0].fix).toContain("of an existing overall document");
  });

  it("slug-ref: a `program:` naming a registered overall is clean", () => {
    const fs: DocFs = {
      exists: () => true,
      read: (p) =>
        p.endsWith("/x-overall.md")
          ? "---\ntitle: O\ndoc-type: overall\nslug: x-overall\nversion: v1.0\n---\n"
          : "---\ntitle: S\ndoc-type: phase-spec\nslug: x-p3\nprogram: x-overall\n---\n",
      list: (dir) =>
        dir.endsWith("/specs") || dir.endsWith("specs")
          ? ["x-overall.md", "x-p3-design.md"]
          : ["x-p3.md"],
    };
    const findings = judge("phase-spec", specLineage("v1.0", [ROW_100]), fs);
    expect(withKind(findings, "slug-ref")).toBe(false);
  });

  it("slug-ref: the skeleton's placeholder forms are exempt (a freshly rendered doc is never blocked by its own placeholder)", () => {
    for (const placeholder of ["<overall-slug>", ":::fill program", "Pending", ""]) {
      const content = specLineage("v1.0", [ROW_100]).replace(
        "program: x-overall",
        `program: ${placeholder}`,
      );
      const findings = judge("phase-spec", content, EMPTY_FS);
      expect(withKind(findings, "slug-ref"), placeholder).toBe(false);
    }
  });

  it("cross-doc-chain: a `parent-version` token the program's lineage carries is clean", () => {
    const findings = judge("phase-spec", specLineage("v1.0", [ROW_100]), SPEC_CHAIN_FS);
    expect(findings.filter((finding) => finding.kind === "cross-doc-chain")).toEqual([]);
  });

  it("cross-doc-chain: a `parent-version` token outside the program's lineage is reported on the `program` key", () => {
    const content = specLineage("v1.0", [ROW_100]).replace(
      "parent-version: v1.0",
      "parent-version: v9.9",
    );
    const findings = judge("phase-spec", content, SPEC_CHAIN_FS).filter(
      (finding) => finding.kind === "cross-doc-chain",
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.field).toBe("program");
    expect(findings[0]?.message).toContain("x-overall");
  });

  it("cross-doc-chain: an unreadable parent overall judges NO lineage token (never a false per-token finding)", () => {
    // The index resolved the parent already (so the slug-ref face is clean), but
    // the lineage read then fails. An unreadable parent is the resolution face's
    // call — this arm must stay silent instead of reporting every token as foreign.
    const index = SlugIndex.build(".", SPEC_CHAIN_FS);
    const findings = new Contract().validate({
      docKey: "phase-spec",
      path: SPEC_PATH,
      content: specLineage("v1.0", [ROW_100]),
      root: ".",
      slugIndex: index,
      fs: { ...SPEC_CHAIN_FS, read: () => null },
    });
    expect(findings.filter((finding) => finding.kind === "cross-doc-chain")).toEqual([]);
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
    const content = GOOD_OVERALL.replace("status: Approved", "status: Deleted").replace(
      "| P2 | none | issue two |",
      "| P9 | prose | issue nine |",
    );
    const findings = judge("overall", content, GOOD_OVERALL_FS, "P9");
    expect(withKind(findings, "domain", "status")).toBe(true);
    expect(withKind(findings, "crosslink", "Issue inventory")).toBe(true);
    expect(withKind(findings, "section-scoped-domain", "Issue inventory")).toBe(true);
    expect(withKind(findings, "presence", "Issue inventory")).toBe(false); // sections are present
    expect(findings.length).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// P4.1 T2 — the three-type homogeneity: `version:` required + strict (number · date) ·
// `## Change history` required ×3 · selfBounded ×3 (header = the newest in-row)
// ---------------------------------------------------------------------------

/** A minimal phase-spec carrying the canonical version lineage (a strict `version:`
 *  front-matter scalar + a Change-history table) — the T2 judgment surface. */
const specLineage = (headerVersion: string, rows: readonly string[]): string => {
  return [
    "---",
    "title: Test Spec",
    "doc-type: phase-spec",
    `version: ${headerVersion}`,
    "date: 2026-10-09",
    "slug: x-p3",
    "program: x-overall",
    "status: Draft",
    "author: x",
    "parent-version: v1.0",
    "---",
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
};

/** A minimal plan carrying the canonical version lineage. */
const planLineage = (headerVersion: string, rows: readonly string[]): string => {
  return [
    "---",
    "title: Test Plan",
    "doc-type: plan",
    `version: ${headerVersion}`,
    "date: 2026-10-09",
    "slug: x-p3",
    "---",
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
};

const ROW_100 = "| v1.0 | 2026-10-08 | prior | [human] |";
const ROW_101 = "| v1.1 | 2026-10-09 | merged | [human] |";

describe("P4.1 T2 — `version:` presence required ×3 (plan optional → required)", () => {
  it("a plan without the version front-matter key is reported", () => {
    const content = planLineage("v1.0", [ROW_100]).replace("\nversion: v1.0", "");
    const findings = judge("plan", content);
    expect(withKind(findings, "presence", "version")).toBe(true);
  });

  it("a phase-spec without the version front-matter key is reported", () => {
    const content = specLineage("v1.0", [ROW_100]).replace("\nversion: v1.0", "");
    const findings = judge("phase-spec", content);
    expect(withKind(findings, "presence", "version")).toBe(true);
  });

  it("an overall without the version front-matter key is reported (the requiredness holds)", () => {
    const content = GOOD_OVERALL.replace("version: v1.21", "");
    const findings = judge("overall", content, GOOD_OVERALL_FS);
    expect(withKind(findings, "presence", "version")).toBe(true);
  });
});

describe("P4.1 T2 — the `version:` strict form (a bare `vX.Y` scalar · zero supplement/link/bold)", () => {
  it("a trailing parenthetical supplement is refused (plan and spec)", () => {
    for (const [docKey, doc] of [
      ["plan", planLineage("v1.0 （v1.0 补充）", [ROW_100])],
      ["phase-spec", specLineage("v1.0 （v1.0 补充）", [ROW_100])],
    ] as const) {
      expect(withKind(judge(docKey, doc), "domain", "version")).toBe(true);
    }
  });

  it("a trailing prose supplement after the date is refused (plan and spec)", () => {
    for (const [docKey, doc] of [
      ["plan", planLineage("v1.0 · 2026-10-09 说明应在 Change history", [ROW_100])],
      ["phase-spec", specLineage("v1.0 · 2026-10-09 说明应在 Change history", [ROW_100])],
    ] as const) {
      expect(withKind(judge(docKey, doc), "domain", "version")).toBe(true);
    }
  });

  it("a bold **vX.Y** form is refused (plan and spec)", () => {
    for (const [docKey, doc] of [
      ["plan", planLineage('"**v1.0** · 2026-10-09"', [ROW_100])],
      ["phase-spec", specLineage('"**v1.0** · 2026-10-09"', [ROW_100])],
    ] as const) {
      expect(withKind(judge(docKey, doc), "domain", "version")).toBe(true);
    }
  });

  it("the canonical bare `vX.Y` form carries no `version:` domain finding (plan and spec)", () => {
    for (const docKey of ["plan", "phase-spec"] as const) {
      const doc =
        docKey === "plan" ? planLineage("v1.0", [ROW_100]) : specLineage("v1.0", [ROW_100]);
      expect(withKind(judge(docKey, doc), "domain", "version")).toBe(false);
    }
  });
});

describe("P4.1 T2 — `## Change history` presence required ×3", () => {
  it("a plan without the Change-history section is reported", () => {
    const content = planLineage("v1.0", [ROW_100]).replace(
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
    const content = specLineage("v1.0", [ROW_100]).replace(
      [
        "## Change history",
        "",
        "| Version | date | summary | author |",
        "|---|---|---|---|",
        ROW_100,
      ].join("\n"),
      "",
    );
    const findings = judge("phase-spec", content);
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
    const findings = judge("phase-spec", specLineage("v1.0", [ROW_100, ROW_101]));
    expect(withKind(findings, "selfBounded", "version")).toBe(true);
  });

  it("a plan whose header is OUTSIDE the lineage is reported", () => {
    const findings = judge("plan", planLineage("v1.2", [ROW_100, ROW_101]));
    expect(withKind(findings, "selfBounded", "version")).toBe(true);
  });

  it("a spec/plan whose header IS the newest in-row version carries no selfBounded finding", () => {
    for (const docKey of ["plan", "phase-spec"] as const) {
      const doc =
        docKey === "plan"
          ? planLineage("v1.1", [ROW_100, ROW_101])
          : specLineage("v1.1", [ROW_100, ROW_101]);
      expect(withKind(judge(docKey, doc), "selfBounded", "version")).toBe(false);
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

describe("P10 W7 T11 — the migration judgment-regression pins (spec §6 · §5.2)", () => {
  it("version lineage — a head version OUTSIDE the Change-history lineage still fires selfBounded", () => {
    // The T6 read flip made the version a head scalar — a version the Change-history
    // table never carries must STILL be reported (no false-green from a body scan
    // that can no longer see the head).
    const overall = judge(
      "overall",
      GOOD_OVERALL.replace("version: v1.21", "version: v9.9"),
      GOOD_OVERALL_FS,
    );
    expect(withKind(overall, "selfBounded", "version")).toBe(true);
    const plan = judge("plan", planLineage("v9.9", [ROW_100, ROW_101]));
    expect(withKind(plan, "selfBounded", "version")).toBe(true);
  });

  it("presence — a doc missing the status key reports exactly one presence finding (typed head, not a line scan)", () => {
    const presence = judge(
      "phase-spec",
      specLineage("v1.1", [ROW_100, ROW_101]).replace("\nstatus: Draft", ""),
    ).filter((finding) => finding.kind === "presence");
    expect(presence).toHaveLength(1);
    expect(presence[0]!.field).toBe("status");
  });

  it("domain — a status outside the declared enum reports exactly one domain finding", () => {
    const domain = judge(
      "phase-spec",
      specLineage("v1.1", [ROW_100, ROW_101]).replace("status: Draft", "status: Bogus"),
    ).filter((finding) => finding.kind === "domain");
    expect(domain).toHaveLength(1);
    expect(domain[0]!.field).toBe("status");
  });

  it("RAW — the head value extracts verbatim while the body still canonicalizes (both sides of the same doc)", () => {
    const content = GOOD_OVERALL.replace("title: 测试 Overall", "title: 任务组总体").replace(
      "### Goal\n- goal text",
      "### Goal\n- goal text\n\n#### M 组（skill-ref 映射，M1–M4 全关）\n- m leaf",
    );
    // The head channel reads the RAW content — the registered zh alias 组 rides
    // the title verbatim, never the canonicalize view.
    const { head } = FrontMatterExtractor.split(content);
    expect(head.value("title")).toBe("任务组总体");
    // The body channel canonicalizes in the SAME validate call — the zh 组 leaf
    // conforms to the `#### [MFRBEN] group` facet only through the view.
    const findings = judge("overall", content, GOOD_OVERALL_FS);
    expect(withKind(findings, "presence", "#### [MFRBEN] group")).toBe(false);
    expect(withKind(findings, "domain", "#### [MFRBEN] group")).toBe(false);
    // The exact body-line face — the same Translator seam validate applies to
    // every body row (the canonicalize target of the registered 组 alias).
    expect(new Translator(new Words()).canonicalize("TaskGraph 分组派生")).toBe(
      "TaskGraph 分group派生",
    );
  });
});

/** A conforming phase-spec — the front-matter head + the double-layer design
 *  skeleton + the Change-history lineage (the shared phase-spec fixture family). */
const phaseSpec = (version: string): string => {
  return [
    "---",
    "title: Test Spec",
    "doc-type: phase-spec",
    `version: ${version}`,
    "date: 2026-10-09",
    "slug: x-p3",
    "program: x-overall",
    "status: Draft",
    "author: x",
    "parent-version: v1.0",
    "---",
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
    "## Change history",
    "",
    "| Version | date | summary | author |",
    "|---|---|---|---|",
    "| v1.0 | 2026-10-08 | prior | [human] |",
    "| v1.1 | 2026-10-09 | merged | [human] |",
  ].join("\n");
};

/** One rendered `### Task N:` block with all required fields. */
const planTask = (id: number): string[] => {
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
};
