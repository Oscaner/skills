// packages/cdd-engine/src-next/render/__tests__/skeleton.test.ts
// The SkeletonAssembler suite (P2 — the `cdd schema get <type> --output skeleton`
// render face, spec §3/§4.1):
//   · the four doc skeletons render the complete structural scaffolds — byte-
//     pinned from the P2 first version (the assembler's date is the injectable
//     run-day truth, fixed here — never a live clock);
//   · the placeholder-anchoring probes (spec §4.1): pure content slots take
//     `:::fill <slot>`, the link-shaped anchors the placeholder links, the
//     pattern-typed rows the generator truths, and `:::fill` never lands on a
//     structure/truth/link/table-header position;
//   · the EOF rule — render() never ends with a newline or a blank line; the
//     CLI's single appended `\n` leaves a redirected fixture with exactly one
//     final newline.

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { declaredRegistries } from "../../contract/declare.ts";
import type { DocKey, DocSkeleton } from "../../contract/project.ts";
import { Projector } from "../../contract/project.ts";
import { BoardView } from "../../face/board-view.ts";
import type { RepoPath } from "../../infra/root.ts";
import { SkeletonAssembler } from "../skeleton.ts";

/** The fixed run date — the injectable run-day truth (no live clock in the pins). */
const DATE = "2026-10-11";
const PROJECTOR = new Projector(declaredRegistries);
const SKELETONS = PROJECTOR.skeleton();

/** The fixed-date rendered skeleton bytes of one doc type. */
const renderOf = (key: DocKey): string => new SkeletonAssembler(SKELETONS[key], DATE).render();

/** The registered required anchors of one doc type (the live registry). */
const requiredAnchorsOf = (key: DocKey): readonly string[] =>
  declaredRegistries[key].elements
    .filter((element) => element.presence === "required")
    .map((element) => element.anchor);

/** The per-anchor skeleton probe of the semantic anchors — the anchors whose
 *  skeleton form is NOT their literal token (the numeric headings, the table row /
 *  cell values, the graph rows and the parse-face names). The literal-marker
 *  anchors (`### Goal`, `- **Objective**:` …) fall back to their generic forms. */
const SEMANTIC_PROBES: Record<string, string> = {
  "### N. group heading": "### 1. :::fill group-title",
  "#### N.M item heading": "#### 1.1 :::fill item-title",
  "### Task N:": "### Task 1: :::fill task-title",
  "Task id token": "### Task 1:",
  "File path token": "- **Files**: :::fill file-paths",
  "Step action": ":::fill step-action",
  "Step checkable": "— checkable: :::fill step-checkable",
  "Acceptance entry": "- `:::fill acceptance-entry`",
  "Constraint delta bullet": "- :::fill constraint",
  "Issue inventory columns": "| Phase | Issue (ref) | Title summary |",
  "Issue row": "| P1 | none | :::fill issue-title |",
  "Issue ref cell": "| P1 | none |",
  "Phase inventory columns":
    "| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |",
  "Phase row": "| P1 | :::fill phase-name |",
  "Phase id token": "| P1 |",
  "Implementation plan cell": "| Pending |",
  "Design spec cell": "| [Pending] |",
  "Dependency cell": ":::fill dependency",
  "File path row": "| overall-spec | `:::fill overall-path` |",
  "Change history row": "| v0.1 |",
  "Version token": "| v0.1 |",
  "Change history date": DATE,
  "Hard edge": "P1 -> P2",
  "Graph legend": "- `->` = hard block",
};

/** The skeleton-probe token of one registered anchor — the semantic map first,
 *  the literal-marker anchors by their generic skeleton forms (the title fill,
 *  the heading literal, the `- **Key**:` field markers — the plan's `**Spec:**`
 *  rides the bare marker, never a `- ` prefix). */
const probeOf = (anchor: string): string => {
  const semantic = SEMANTIC_PROBES[anchor];
  if (semantic !== undefined) return semantic;
  if (anchor.startsWith("# ")) return "# :::fill title";
  if (anchor.startsWith("#")) return anchor;
  if (anchor.startsWith("**")) return anchor === "**Spec:**" ? "**Spec:**" : `- ${anchor}:`;
  return anchor;
};

describe("SkeletonAssembler — the four doc skeletons (byte pins)", () => {
  it("renders the phase-spec skeleton — the header five-tuple + the Design double layer + the lineage", () => {
    expect(renderOf("phase-spec")).toBe(
      [
        "# :::fill title",
        "- **Version**: v0.1 · 2026-10-11",
        "- **Doc type**: phase-spec",
        "- **Status**: Draft",
        "- **Author**: :::fill author",
        "- **Parent program**: [<parent overall>](<parent path>)",
        "- **Depends on**: :::fill depends-on",
        "",
        "## Design",
        "",
        ":::fill design-intro",
        "",
        "### 1. :::fill group-title",
        "#### 1.1 :::fill item-title",
        "- :::fill item-body",
        "",
        "### Acceptance criteria",
        "",
        "- `:::fill acceptance-entry`",
        "",
        "## Constraints",
        "",
        "- :::fill constraint",
        "",
        "## Change history",
        "",
        "| Version | date | summary | author |",
        "| --- | --- | --- | --- |",
        "| v0.1 | 2026-10-11 | :::fill summary | :::fill author |",
      ].join("\n"),
    );
  });

  it("renders the plan skeleton — the Class-A/B header + the first task block + the lineage", () => {
    expect(renderOf("plan")).toBe(
      [
        "# :::fill title",
        "**Spec:** [<spec path>](<spec path>)",
        "- **Parent program**: [<parent overall>](<parent path>)",
        "- **Version**: v0.1 · 2026-10-11",
        "- **Doc type**: plan",
        "",
        "## Constraints",
        "",
        "- :::fill constraint",
        "",
        "### Task 1: :::fill task-title",
        "- **Objective**: :::fill objective",
        "- **Files**: :::fill file-paths",
        "- **Consumes**: :::fill consumes",
        "- **Produces**: :::fill produces",
        "- **Steps**:",
        "  - :::fill step-action — checkable: :::fill step-checkable",
        "- **Acceptance**: :::fill acceptance",
        "- **DependsOn**: none",
        "",
        "## Change history",
        "",
        "| Version | date | summary | author |",
        "| --- | --- | --- | --- |",
        "| v0.1 | 2026-10-11 | :::fill summary | :::fill author |",
      ].join("\n"),
    );
  });

  it("renders the overall skeleton — the header tuple + the table sections + the dependency graph", () => {
    expect(renderOf("overall-spec")).toBe(
      [
        "# :::fill title",
        "- **Version**: v0.1 · 2026-10-11",
        "- **Doc type**: overall-spec",
        "- **Status**: Draft",
        "- **Author**: :::fill author",
        "- **Constraints**: :::fill constraints",
        "",
        "## Document scope",
        "",
        ":::fill document-scope",
        "",
        "## File paths",
        "",
        "| Artifact | Path |",
        "| --- | --- |",
        "| overall-spec | `:::fill overall-path` |",
        "",
        "## Program charter",
        "",
        "### Goal",
        "",
        "- :::fill goal-description",
        "",
        "### Non-goals",
        "",
        "- :::fill non-goal-description",
        "",
        "### Cross-cutting",
        "",
        "- :::fill cross-cutting-description",
        "",
        "## Issue inventory",
        "",
        "| Phase | Issue (ref) | Title summary |",
        "| --- | --- | --- |",
        "| P1 | none | :::fill issue-title |",
        "",
        "## Phase inventory",
        "",
        "| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |",
        "| --- | --- | --- | --- | --- | --- | --- |",
        "| P1 | :::fill phase-name | :::fill scope | [Pending] | Pending | :::fill acceptance-criteria | :::fill dependency |",
        "| P2 | :::fill phase-name | :::fill scope | [Pending] | Pending | :::fill acceptance-criteria | :::fill dependency |",
        "",
        "## Dependency graph",
        "",
        "P1 -> P2",
        "- `->` = hard block",
        "",
        "## Boundary rules",
        "",
        "- :::fill boundary-rule",
        "",
        "## Maintenance",
        "",
        "- :::fill maintenance-note",
        "",
        "## Change history",
        "",
        "| Version | date | summary | author |",
        "| --- | --- | --- | --- |",
        "| v0.1 | 2026-10-11 | :::fill summary | :::fill author |",
      ].join("\n"),
    );
  });

  it("renders the single-spec skeleton — the header five-tuple + the prose sections + the lineage", () => {
    expect(renderOf("single-spec")).toBe(
      [
        "# :::fill title",
        "- **Version**: v0.1 · 2026-10-11",
        "- **Doc type**: single-spec",
        "- **Status**: Draft",
        "- **Author**: :::fill author",
        "- **Depends on**: :::fill depends-on",
        "",
        "## Background & root cause",
        "",
        ":::fill background-root-cause",
        "",
        "## Design decisions",
        "",
        ":::fill design-ruling",
        "",
        "## Acceptance",
        "",
        ":::fill acceptance",
        "",
        "## Constraints",
        "",
        ":::fill constraints",
        "",
        "## Change history",
        "",
        "| Version | date | summary | author |",
        "| --- | --- | --- | --- |",
        "| v0.1 | 2026-10-11 | :::fill summary | :::fill author |",
      ].join("\n"),
    );
  });
});

describe("SkeletonAssembler — the required-anchor coverage probes (§3.2)", () => {
  it("carries every required anchor of the four doc types (the live registry set)", () => {
    for (const key of ["overall-spec", "plan", "phase-spec", "single-spec"] as const) {
      const rendered = renderOf(key);
      for (const anchor of requiredAnchorsOf(key)) {
        // The grep probe per anchor — the skeleton line form of the anchor lands
        // in the rendered bytes (headings and markers by their literal, the
        // semantic anchors by their rendered value forms).
        expect(rendered, `${key}: ${anchor}`).toContain(probeOf(anchor));
      }
    }
  });

  it("renders the numeric headings as true numbers — zero literal `N`", () => {
    const spec = renderOf("phase-spec");
    expect(spec).toContain("### 1. :::fill group-title");
    expect(spec).toContain("#### 1.1 :::fill item-title");
    const plan = renderOf("plan");
    expect(plan).toContain("### Task 1: :::fill task-title");
    // the declared digit-headed anchors never render a literal `N` placeholder
    expect(rendersNoLiteralN("phase-spec")).toBe(true);
    expect(rendersNoLiteralN("plan")).toBe(true);
  });

  it("renders the version row and the change-history first row with the injected date truth", () => {
    for (const key of ["overall-spec", "plan", "phase-spec", "single-spec"] as const) {
      const rendered = renderOf(key);
      // the version row — v0.1 · the injected run date (real shape hit, never a
      // `<date>` notation marker)
      expect(rendered).toContain(`- **Version**: v0.1 · ${DATE}`);
      // the change-history first row — the header version (v0.1) + the date cell
      // + the summary/author content fills
      expect(rendered).toContain(`| v0.1 | ${DATE} | :::fill summary | :::fill author |`);
      // the header version equals the change-history row version (self-consistent
      // lineage, ascending oldest-first with a single row)
      const headerVersion = rendered.match(/- \*\*Version\*\*: (v\d+\.\d+) ·/)?.[1];
      expect(rendered).toContain(`| ${headerVersion} |`);
    }
  });

  it("renders the generator truths — the enum Status line and the graph rows", () => {
    for (const key of ["overall-spec", "phase-spec"] as const) {
      expect(renderOf(key)).toContain("- **Status**: Draft");
    }
    expect(renderOf("overall-spec")).toContain("P1 -> P2");
    expect(renderOf("overall-spec")).toContain("- `->` = hard block");
  });

  it("renders every content position as a `:::fill <slot>` slot", () => {
    for (const key of ["overall-spec", "plan", "phase-spec", "single-spec"] as const) {
      const rendered = renderOf(key);
      expect(rendered).toMatch(/:::fill \S+/g);
      // the fill values are the declared slot names — never a residual `<…>`
      // notation or a bare empty value
      expect(rendered).not.toContain(":::fill <");
    }
  });

  it("renders the link-typed anchors as placeholder links (label + target `<…>` literals)", () => {
    const spec = renderOf("phase-spec");
    expect(spec).toContain("- **Parent program**: [<parent overall>](<parent path>)");
    const plan = renderOf("plan");
    expect(plan).toContain("**Spec:** [<spec path>](<spec path>)");
    expect(plan).toContain("- **Parent program**: [<parent overall>](<parent path>)");
  });
});

describe("SkeletonAssembler — the placeholder-anchoring probes (§4.1)", () => {
  /** The structure/truth/header rows that must never carry a `:::fill` — the
   *  fixed heading lines, the version row, the Status truth, the link anchors,
   *  the graph rows and the table headers/separators. */
  const STRUCTURE_LINES: Record<string, readonly string[]> = {
    "overall-spec": [
      "- **Version**: v0.1 · 2026-10-11",
      "- **Status**: Draft",
      "## Document scope",
      "## File paths",
      "| Artifact | Path |",
      "| --- | --- |",
      "## Program charter",
      "### Goal",
      "### Non-goals",
      "### Cross-cutting",
      "## Issue inventory",
      "| Phase | Issue (ref) | Title summary |",
      "| --- | --- | --- |",
      "## Phase inventory",
      "| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |",
      "| --- | --- | --- | --- | --- | --- | --- |",
      "## Dependency graph",
      "P1 -> P2",
      "- `->` = hard block",
      "## Boundary rules",
      "## Maintenance",
      "## Change history",
      "| Version | date | summary | author |",
      "| --- | --- | --- | --- |",
    ],
    plan: [
      "- **Version**: v0.1 · 2026-10-11",
      "**Spec:** [<spec path>](<spec path>)",
      "- **Parent program**: [<parent overall>](<parent path>)",
      "## Constraints",
      "## Change history",
      "| Version | date | summary | author |",
      "| --- | --- | --- | --- |",
    ],
    "phase-spec": [
      "- **Version**: v0.1 · 2026-10-11",
      "- **Status**: Draft",
      "- **Parent program**: [<parent overall>](<parent path>)",
      "## Design",
      "### Acceptance criteria",
      "## Constraints",
      "## Change history",
      "| Version | date | summary | author |",
      "| --- | --- | --- | --- |",
    ],
    "single-spec": [
      "- **Version**: v0.1 · 2026-10-11",
      "- **Status**: Draft",
      "## Background & root cause",
      "## Design decisions",
      "## Acceptance",
      "## Constraints",
      "## Change history",
      "| Version | date | summary | author |",
      "| --- | --- | --- | --- |",
    ],
  };

  it("lands every `:::fill` on a content position — zero on the structure/truth/link/header rows", () => {
    for (const key of ["overall-spec", "plan", "phase-spec", "single-spec"] as const) {
      const lines = renderOf(key).split("\n");
      for (const line of lines) {
        if (!line.includes(":::fill")) continue;
        expect(STRUCTURE_LINES[key], `${key}: ${line}`).not.toContain(line);
      }
      expect(renderOf(key)).not.toMatch(/\| --- \|.*:::fill/);
    }
  });

  it("keeps structure true — the fixed headings and table headers carry no fill", () => {
    for (const key of ["overall-spec", "plan", "phase-spec", "single-spec"] as const) {
      const rendered = renderOf(key);
      for (const line of STRUCTURE_LINES[key]) {
        expect(rendered, `${key}: ${line}`).toContain(line);
        if (!line.includes(":::")) expect(line).not.toContain(":::fill");
      }
    }
  });
});

describe("SkeletonAssembler — the slot-consumption invariant (composition vs registry)", () => {
  it("consumes every required slot of the four live projections — render() never trips the assertion", () => {
    for (const key of ["overall-spec", "plan", "phase-spec", "single-spec"] as const) {
      expect(() => renderOf(key)).not.toThrow();
    }
  });

  it("loud-throws on an unemitted required slot — a registered anchor the composition does not place", () => {
    const plan = SKELETONS.plan;
    const tampered: DocSkeleton = {
      docType: plan.docType,
      slots: [
        ...plan.slots,
        {
          anchor: "**Guest anchor**",
          presence: "required",
          home: "section",
          slot: "content",
          refKind: "none",
        },
      ],
    };
    expect(() => new SkeletonAssembler(tampered, DATE).render()).toThrow(
      /omits the registered required slot\(s\): \*\*Guest anchor\*\*/,
    );
  });

  it("loud-throws on an emitted anchor the registry no longer requires — a composed anchor with no registered slot", () => {
    const plan = SKELETONS.plan;
    const tampered: DocSkeleton = {
      docType: plan.docType,
      slots: plan.slots.filter((slot) => slot.anchor !== "## Constraints"),
    };
    expect(() => new SkeletonAssembler(tampered, DATE).render()).toThrow(
      /emits the unregistered anchor: ## Constraints/,
    );
  });
});

describe("SkeletonAssembler — the Doc type declaration line (spec §3.1 ⑩)", () => {
  it("every doc skeleton carries `- **Doc type**: <key>` right after the Version line", () => {
    for (const key of ["overall-spec", "plan", "phase-spec", "single-spec"] as const) {
      const lines = renderOf(key).split("\n");
      const docTypeIndex = lines.indexOf(`- **Doc type**: ${key}`);
      expect(docTypeIndex, `${key}: missing Doc type line`).toBeGreaterThan(-1);
      // the declaration immediately follows its Version line (the header tuple order)
      expect(lines[docTypeIndex - 1], `${key}: Doc type not after Version`).toMatch(
        /^- \*\*Version\*\*: /,
      );
    }
  });

  it("the engine-produced skeleton passes its OWN doc-type reader — BoardView.readDocType (self-preflight regression)", () => {
    // The ⑩ defect: the engine's skeleton omitted the Doc type line, so a skeleton
    // it produced failed its own preflight (BoardView.readDocType → null → BLOCK).
    // This pin writes each skeleton to disk and asserts the doc-type reader returns
    // the matching key — the writer/reader pair now agrees (§3.1 ⑩ regression).
    const dir = mkdtempSync(path.join(tmpdir(), "skeleton-doctype-"));
    try {
      for (const key of ["overall-spec", "plan", "phase-spec", "single-spec"] as const) {
        const file = path.join(dir, `${key}.md`);
        writeFileSync(file, `${renderOf(key)}\n`, "utf8");
        expect(
          BoardView.readDocType(file as RepoPath),
          `${key}: skeleton fails its own doc-type read`,
        ).toBe(key);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("SkeletonAssembler — the EOF rule", () => {
  it("render() never ends with a newline or a blank line — the redirected fixture ends with exactly one `\\n`", () => {
    for (const key of ["overall-spec", "plan", "phase-spec", "single-spec"] as const) {
      const rendered = renderOf(key);
      expect(rendered.endsWith("\n"), `${key}: no trailing newline from render`).toBe(false);
      expect(rendered.endsWith("\n\n") || rendered.endsWith(" \n"), `${key}: no blank tail`).toBe(
        false,
      );
      const withCliNewline = `${rendered}\n`;
      expect(withCliNewline.endsWith("\n")).toBe(true);
      expect(withCliNewline.endsWith("\n\n"), `${key}: exactly one final newline`).toBe(false);
      // the last line of the rendered bytes is real content, never a blank
      const lastLine = rendered.split("\n").at(-1);
      expect(lastLine?.trim().length, `${key}: last line non-blank`).toBeGreaterThan(0);
    }
  });
});

/** Whether any rendered skeleton line carries a literal `N` heading placeholder —
 *  the declared digit headings (`### N.` / `#### N.M` / `### Task N:`) always
 *  render true numbers, never the letter. */
const rendersNoLiteralN = (key: DocKey): boolean => {
  const rendered = renderOf(key);
  return !/(?:^|\n)#{2,4} (?:Task )?N[.:]/m.test(rendered) && !rendered.includes("Task N:");
};
