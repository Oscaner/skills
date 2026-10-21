// packages/cdd-engine/src-next/render/__tests__/skeleton.test.ts
// The SkeletonAssembler suite (P2 — the `cdd schema get <type> --output skeleton`
// render face, spec §3/§4.1/§4.2):
//   · the four doc skeletons render the complete structural scaffolds — byte-
//     pinned from the P2 first version (the assembler's date is the injectable
//     run-day truth, fixed here — never a live clock);
//   · the front-matter head (spec §2.2/§4.2) — a `---`-fenced YAML record whose
//     key set is the projection's front-matter emission list (the head's required
//     keys plus the type's optional head keys); the placeholder three-way split
//     (link keys a `<…>` scalar · content keys `:::fill <key>` · truth keys their
//     true values; `parent-version` never emitted);
//   · the placeholder-anchoring probes (spec §4.1): pure content slots take
//     `:::fill <slot>`, the link-shaped anchors the placeholder links, the
//     pattern-typed rows the generator truths, and `:::fill` never lands on a
//     structure/truth/link/table-header position;
//   · the doc-contract pin — every rendered skeleton passes its own
//     Contract.validate with zero findings (the skeleton is green by
//     construction);
//   · the EOF rule — render() never ends with a newline or a blank line; the
//     CLI's single appended `\n` leaves a redirected fixture with exactly one
//     final newline.

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { declaredRegistries } from "../../contract/declare.ts";
import { Contract } from "../../contract/judge.ts";
import type { DocKey, DocSkeleton, SkeletonSlot } from "../../contract/project.ts";
import { Projector } from "../../contract/project.ts";
import { BoardView } from "../../face/board-view.ts";
import { type RepoPath, RepoRoot } from "../../infra/root.ts";
import { SkeletonAssembler } from "../skeleton.ts";

/** The fixed run date — the injectable run-day truth (no live clock in the pins). */
const DATE = "2026-10-11";
const PROJECTOR = new Projector(declaredRegistries);
const SKELETONS = PROJECTOR.skeleton();
const KEYS = ["overall-spec", "plan", "phase-spec", "single-spec"] as const;

/** The fixed-date rendered skeleton bytes of one doc type. */
const renderOf = (key: DocKey): string => new SkeletonAssembler(SKELETONS[key], DATE).render();

/** The front-matter block of a rendered skeleton — the lines between the two `---`
 *  fences (the §2.2 YAML record; the markdown body starts after the second fence). */
const frontmatterBlockOf = (key: DocKey): string => {
  const lines = renderOf(key).split("\n");
  const first = lines.indexOf("---");
  return lines.slice(first + 1, lines.indexOf("---", first + 1)).join("\n");
};

/** The registered required anchors of one doc type (the live registry). */
const requiredAnchorsOf = (key: DocKey): readonly string[] =>
  declaredRegistries[key].elements
    .filter((element) => element.presence === "required")
    .map((element) => element.anchor);

/** The live front-matter emission list of one doc type (the head key set the
 *  renderer emits — the projection's independent list: required head keys plus
 *  the type's optional head keys, `parent-version` excluded). */
const frontmatterSlotsOf = (key: DocKey): readonly SkeletonSlot[] => SKELETONS[key].frontmatter;

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
  "Change history row": "| v0.1 |",
  "Version token": "| v0.1 |",
  "Change history date": DATE,
  "Hard edge": "P1 -> P2",
  "Graph legend": "- `->` = hard block",
};

/** The skeleton-probe token of one registered anchor — the semantic map first,
 *  the literal-marker anchors by their generic skeleton forms (the heading
 *  literal, the `- **Key**:` field markers), and the front-matter key anchors
 *  (the remaining plain tokens — the head's key set) by their `key: ` declaration
 *  line. */
const probeOf = (anchor: string): string => {
  const semantic = SEMANTIC_PROBES[anchor];
  if (semantic !== undefined) return semantic;
  if (anchor.startsWith("# ")) return "# :::fill title";
  if (anchor.startsWith("#")) return anchor;
  if (anchor.startsWith("**")) return `- ${anchor}:`;
  return `${anchor}: `;
};

describe("SkeletonAssembler — the four doc skeletons (byte pins)", () => {
  it("renders the phase-spec skeleton — the front-matter head + the Design double layer + the lineage", () => {
    expect(renderOf("phase-spec")).toBe(
      [
        "---",
        "title: ':::fill title'",
        "doc-type: phase-spec",
        "version: v0.1",
        "date: 2026-10-11",
        "slug: ':::fill slug'",
        "program: <overall-slug>",
        "status: Draft",
        "author: ':::fill author'",
        "---",
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

  it("renders the plan skeleton — the Class-A/B front-matter head + the first task block + the lineage", () => {
    expect(renderOf("plan")).toBe(
      [
        "---",
        "title: ':::fill title'",
        "doc-type: plan",
        "version: v0.1",
        "date: 2026-10-11",
        "slug: ':::fill slug'",
        "base: ':::fill base'",
        "---",
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

  it("renders the overall skeleton — the front-matter head + the table sections + the dependency graph", () => {
    expect(renderOf("overall-spec")).toBe(
      [
        "---",
        "title: ':::fill title'",
        "doc-type: overall-spec",
        "version: v0.1",
        "date: 2026-10-11",
        "slug: ':::fill slug'",
        "status: Draft",
        "author: ':::fill author'",
        "---",
        "",
        "## Document scope",
        "",
        ":::fill document-scope",
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
        "## Constraints",
        "",
        "- :::fill constraint",
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

  it("renders the single-spec skeleton — the front-matter head + the prose sections + the lineage", () => {
    expect(renderOf("single-spec")).toBe(
      [
        "---",
        "title: ':::fill title'",
        "doc-type: single-spec",
        "version: v0.1",
        "date: 2026-10-11",
        "slug: ':::fill slug'",
        "status: Draft",
        "author: ':::fill author'",
        "issues: ':::fill issues'",
        "---",
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
    for (const key of KEYS) {
      const rendered = renderOf(key);
      for (const anchor of requiredAnchorsOf(key)) {
        // The grep probe per anchor — the skeleton line form of the anchor lands
        // in the rendered bytes (headings and markers by their literal, the
        // semantic anchors by their rendered value forms, the front-matter keys
        // by their `key: ` declaration line).
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

  it("renders the version and date keys and the change-history first row with the injected date truth", () => {
    for (const key of KEYS) {
      const rendered = renderOf(key);
      // the front-matter `version:` / `date:` truth keys — v0.1 · the injected
      // run date (real shape hit, never a `<date>` notation marker)
      expect(rendered).toContain("version: v0.1");
      expect(rendered).toContain(`date: ${DATE}`);
      // the change-history first row — the header version (v0.1) + the date cell
      // + the summary/author content fills
      expect(rendered).toContain(`| v0.1 | ${DATE} | :::fill summary | :::fill author |`);
      // the header version equals the change-history row version (self-consistent
      // lineage, ascending oldest-first with a single row)
      const headerVersion = rendered.match(/^version: (v\d+\.\d+)$/m)?.[1];
      expect(rendered).toContain(`| ${headerVersion} |`);
    }
  });

  it("renders the generator truths — the enum status key and the graph rows", () => {
    for (const key of ["overall-spec", "phase-spec", "single-spec"] as const) {
      expect(renderOf(key)).toContain("status: Draft");
    }
    // the plan head carries no status key (its registry omits it)
    expect(renderOf("plan")).not.toContain("status: ");
    expect(renderOf("overall-spec")).toContain("P1 -> P2");
    expect(renderOf("overall-spec")).toContain("- `->` = hard block");
  });

  it("renders every content position as a `:::fill <slot>` slot — the body and the front-matter content keys", () => {
    for (const key of KEYS) {
      const rendered = renderOf(key);
      expect(rendered).toMatch(/:::fill \S+/g);
      // the fill values are the declared slot names — never a residual `<…>`
      // notation or a bare empty value
      expect(rendered).not.toContain(":::fill <");
      const block = frontmatterBlockOf(key);
      for (const slot of frontmatterSlotsOf(key)) {
        if (slot.slot === "content") {
          expect(block, `${key}: ${slot.anchor} content fill`).toContain(
            `${slot.anchor}: ':::fill ${slot.anchor}'`,
          );
        }
      }
    }
  });

  it("renders the slug-reference anchor as a placeholder scalar (the `<…>` exemption shape)", () => {
    const spec = renderOf("phase-spec");
    expect(spec).toContain("program: <overall-slug>");
    // `slug:` is a content key — a `:::fill` slot, never the `<>` link form.
    for (const key of KEYS) {
      expect(renderOf(key), `${key}: slug fill`).toContain("slug: ':::fill slug'");
      expect(renderOf(key), `${key}: no slug link`).not.toContain("slug: <");
    }
  });
});

describe("SkeletonAssembler — the front-matter head (spec §2.2/§4.2)", () => {
  it("emits the projection's front-matter key set — the head parses back key-identical, zero extras", () => {
    for (const key of KEYS) {
      const block = frontmatterBlockOf(key);
      const parsed = parse(block) as Record<string, unknown>;
      const keys = frontmatterSlotsOf(key).map((slot) => slot.anchor);
      expect(Object.keys(parsed).sort(), `${key}: yaml-key set = registry head set`).toEqual(
        [...keys].sort(),
      );
    }
  });

  it("splits the §4.2 placeholder classes — truth keys never carry a fill, content keys always do, link keys the `<…>` shape", () => {
    for (const key of KEYS) {
      const lines = frontmatterBlockOf(key).split("\n");
      for (const slot of frontmatterSlotsOf(key)) {
        const line = lines.find((candidate) => candidate.startsWith(`${slot.anchor}: `));
        expect(line, `${key}: ${slot.anchor} emitted`).toBeDefined();
        if (slot.slot === "content") {
          expect(line, `${key}: ${slot.anchor} content`).toBe(
            `${slot.anchor}: ':::fill ${slot.anchor}'`,
          );
        } else if (slot.slot === "link") {
          expect(line, `${key}: ${slot.anchor} link`).toMatch(
            new RegExp(`^${slot.anchor}: <[^>]+>$`),
          );
        } else {
          expect(line, `${key}: ${slot.anchor} truth`).not.toContain(":::fill");
        }
      }
    }
  });

  it("emits the truth keys' true values — doc-type · v0.1 · the injected date · Draft", () => {
    for (const key of KEYS) {
      const block = frontmatterBlockOf(key);
      expect(block).toContain(`doc-type: ${key}`);
      expect(block).toContain("version: v0.1");
      expect(block).toContain(`date: ${DATE}`);
      if (key !== "plan") expect(block).toContain("status: Draft");
    }
  });

  it("never emits the optional `parent-version` key — its `v<n>.<m>` domain admits no placeholder form", () => {
    for (const key of ["plan", "phase-spec"] as const) {
      expect(renderOf(key)).not.toContain("parent-version");
    }
  });

  it("emits the type's optional front-matter keys — `base` on the plan head, `issues` on the single-spec head", () => {
    // §4.2's independent emission list = the head's required keys PLUS the
    // type's optional head keys — the optional keys never ride the slot channel
    // (they are not required), so the head would silently drop them without the
    // dedicated list.
    for (const key of KEYS) {
      const block = frontmatterBlockOf(key);
      const optionalAnchors = declaredRegistries[key].elements
        .filter((element) => element.home === "frontmatter" && element.presence === "optional")
        .map((element) => element.anchor)
        .filter((anchor) => anchor !== "parent-version");
      for (const anchor of optionalAnchors) {
        expect(block, `${key}: optional head key ${anchor} emitted`).toContain(
          `${anchor}: ':::fill ${anchor}'`,
        );
      }
    }
    expect(frontmatterBlockOf("plan")).toContain("base: ':::fill base'");
    expect(frontmatterBlockOf("single-spec")).toContain("issues: ':::fill issues'");
  });
});

describe("SkeletonAssembler — the placeholder-anchoring probes (§4.1)", () => {
  /** The structure/truth/header rows that must never carry a `:::fill` — the
   *  front-matter truth/link keys, the doc-type declaration, the fixed heading
   *  lines, the version row, the Status truth, the link anchors, the graph rows
   *  and the table headers/separators. */
  const STRUCTURE_LINES: Record<string, readonly string[]> = {
    "overall-spec": [
      "doc-type: overall-spec",
      "version: v0.1",
      "date: 2026-10-11",
      "status: Draft",
      "## Document scope",
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
      "## Constraints",
      "## Maintenance",
      "## Change history",
      "| Version | date | summary | author |",
      "| --- | --- | --- | --- |",
    ],
    plan: [
      "doc-type: plan",
      "version: v0.1",
      "date: 2026-10-11",
      "## Constraints",
      "## Change history",
      "| Version | date | summary | author |",
      "| --- | --- | --- | --- |",
    ],
    "phase-spec": [
      "doc-type: phase-spec",
      "version: v0.1",
      "date: 2026-10-11",
      "status: Draft",
      "program: <overall-slug>",
      "## Design",
      "### Acceptance criteria",
      "## Constraints",
      "## Change history",
      "| Version | date | summary | author |",
      "| --- | --- | --- | --- |",
    ],
    "single-spec": [
      "doc-type: single-spec",
      "version: v0.1",
      "date: 2026-10-11",
      "status: Draft",
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
    for (const key of KEYS) {
      const lines = renderOf(key).split("\n");
      for (const line of lines) {
        if (!line.includes(":::fill")) continue;
        expect(STRUCTURE_LINES[key], `${key}: ${line}`).not.toContain(line);
      }
      expect(renderOf(key)).not.toMatch(/\| --- \|.*:::fill/);
      // the front-matter truth keys carry no fill inside the head block
      for (const line of frontmatterBlockOf(key).split("\n")) {
        if (line.includes(":::fill")) {
          expect(line, `${key} head fill`).toMatch(/':::fill [a-z-]+'$/);
        }
      }
    }
  });

  it("keeps structure true — the fixed headings and table headers carry no fill", () => {
    for (const key of KEYS) {
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
    // The four not-to-throw pins also tripwire the overall Constraints
    // triple-same-order composition: the declared `## Constraints` section anchor,
    // the composed heading and the composed `Constraint delta bullet` must land in
    // the same step — a heading without its bullet (or a bullet no longer
    // required) omits a registered required slot and throws below.
    for (const key of KEYS) {
      expect(() => renderOf(key)).not.toThrow();
    }
  });

  it("loud-throws on an unemitted required slot — a registered anchor the composition does not place", () => {
    const plan = SKELETONS.plan;
    const tampered: DocSkeleton = {
      docType: plan.docType,
      frontmatter: plan.frontmatter,
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
      frontmatter: plan.frontmatter,
      slots: plan.slots.filter((slot) => slot.anchor !== "## Constraints"),
    };
    expect(() => new SkeletonAssembler(tampered, DATE).render()).toThrow(
      /emits the unregistered anchor: ## Constraints/,
    );
  });
});

describe("SkeletonAssembler — the Doc type declaration (spec §3.1 ⑩ / D34)", () => {
  it("declares the doc type in the front-matter head — `doc-type:` precedes `version:` (the registry key order)", () => {
    for (const key of KEYS) {
      const lines = frontmatterBlockOf(key).split("\n");
      const docTypeIndex = lines.indexOf(`doc-type: ${key}`);
      expect(docTypeIndex, `${key}: doc-type key present`).toBeGreaterThan(-1);
      const versionIndex = lines.indexOf("version: v0.1");
      expect(versionIndex, `${key}: version key present`).toBeGreaterThan(-1);
      // the front-matter key order follows the registry's frontmatter-home slot
      // order — doc-type (the doc-identity key) comes before the version row
      expect(docTypeIndex, `${key}: doc-type before version`).toBeLessThan(versionIndex);
    }
  });

  it("the engine-produced skeleton passes its OWN doc-type reader — BoardView.readDocType (self-preflight regression)", () => {
    // The ⑩ defect: the engine's skeleton omitted the Doc type declaration, so a
    // skeleton it produced failed its own preflight (BoardView.readDocType → null
    // → BLOCK). After the front-matter flip the head's `doc-type:` key IS the
    // canonical machine read — the board face reads the head record (§3.1 ⑩
    // regression). This pin writes each skeleton to disk and asserts the doc-type
    // reader returns the matching key — the writer/reader pair now agrees.
    const dir = mkdtempSync(path.join(tmpdir(), "skeleton-doctype-"));
    try {
      for (const key of KEYS) {
        const file = path.join(dir, `${key}.md`);
        writeFileSync(file, `${renderOf(key)}\n`, "utf8");
        expect(
          BoardView.readDocType(new RepoRoot(dir), path.relative(dir, file) as RepoPath),
          `${key}: skeleton fails its own doc-type read`,
        ).toBe(key);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("SkeletonAssembler — the doc-contract pin (the skeleton green by construction)", () => {
  it("every rendered skeleton passes its own Contract.validate — zero findings on all four types", () => {
    const contract = new Contract();
    const dir = mkdtempSync(path.join(tmpdir(), "skeleton-contract-"));
    try {
      for (const key of KEYS) {
        const file = path.join(dir, `${key}.md`);
        writeFileSync(file, `${renderOf(key)}\n`, "utf8");
        const findings = contract.validate({
          docKey: key,
          path: file,
          content: readFileSync(file, "utf8"),
          root: dir,
        });
        expect(findings, `${key}: skeleton fails its own contract judgment`).toEqual([]);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("SkeletonAssembler — the EOF rule", () => {
  it("render() never ends with a newline or a blank line — the redirected fixture ends with exactly one `\\n`", () => {
    for (const key of KEYS) {
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
