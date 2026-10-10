// packages/cdd-engine/src-next/render/skeleton.ts
// The SkeletonAssembler — the render face of the skeleton projection (spec §3/§4.1,
// the `cdd schema gen` rendering): a DocSkeleton (contract/project.ts — the
// required-only derived face, every element classified into its
// placeholder-anchoring slot kind) is assembled into the markdown skeleton bytes
// the consumer fills. The structure is the same registry-derived surface the
// judge reads — the skeleton is green by construction, never an exemption channel
// (spec §4.1: pure content slots take `:::fill`, link-shaped anchors a placeholder
// link, structure is true value — the doc-contract pin judges the rendered bytes).
//
// The per-anchor forms (header lines · link placeholders · generator truths ·
// table scaffolds) are declared constant data below; the document composition
// walks them in document order. render() is a pure byte renderer — it never
// appends a trailing newline (the CLI appends the single `\n`, so a redirected
// fixture ends with exactly one newline).
//
// Module-level exports are types / the class — zero behavior-carrying bare
// functions (the plan's zero-bare-function discipline).

import type { DocSkeleton, SkeletonSlot } from "../contract/project.ts";

/** The per-anchor header line forms — every registered header anchor of the three
 *  doc types except the link-typed anchors (their placeholder-link lines assemble
 *  from LINK_SLOTS): the title fill, the content marker fills, the generator-truth
 *  status line and the scaffold version row. The `{date}` slot carries the
 *  injected run date (the version-row date truth). */
const HEADER_FORMS: Record<string, string> = {
  "# Title": "# :::fill title",
  "**Version**": "- **Version**: v0.1 · {date}",
  "**Author**": "- **Author**: :::fill author",
  "**Constraints**": "- **Constraints**: :::fill constraints",
  "**Depends on**": "- **Depends on**: :::fill depends-on",
};

/** The placeholder-link literals of the link-typed anchor slots (spec §4.1) — the
 *  `<…>` label/target pairs of the parent-program / spec links. The `<…>`-shaped
 *  target rides the judge's placeholder-exemption chain (file-existence /
 *  sibling-scan); the plan's Class-A `**Spec:**` takes label == target so the
 *  `label == basename` chain check holds. */
const LINK_SLOTS: Record<string, { label: string; target: string }> = {
  "**Parent program**": { label: "<parent overall>", target: "<parent path>" },
  "**Spec:**": { label: "<spec path>", target: "<spec path>" },
};

/** The generator truths of the pattern-typed slots (spec §3.2/§4.1) — the first
 *  legal literal of an enum value row (`**Status**` → Draft; the `none` issue-ref
 *  cell; the `Pending` design/plan cells) and the conforming graph rows (the
 *  `P1 -> P2` hard edge + the legend line). These are derived true values, never
 *  fill positions. */
const TRUTH_LINES: Record<string, string> = {
  "**Status**": "Draft",
  "Issue ref cell": "none",
  "Implementation plan cell": "Pending",
  "Design spec cell": "Pending",
  "Hard edge": "P1 -> P2",
  "Graph legend": "- `->` = hard block",
};

/** The change-history table scaffold — the registered `Change history row` /
 *  `Version token` / `Change history date` cells composed into the shared
 *  header + separator + first-row shape (the version row must equal the header
 *  version — v0.1 — and stay version-ascending, spec §3.2). */
const HISTORY_HEADER = "| Version | date | summary | author |";

/**
 * The skeleton assembler — one DocSkeleton (contract/project.ts, the required-only
 * sixth projection) → the markdown skeleton bytes. Constructed on the projection
 * and the run date (the CLI injects the run day; tests inject a fixed date), the
 * instance is stateless after construction, so sharing one instance composes
 * safely. The composition per doc type mirrors the doc's section sequence; every
 * required element of the type lands in its structural position (the doc-contract
 * pin judges the rendered bytes — a missing required anchor is a finding).
 */
export class SkeletonAssembler {
  /** The doc type of the projected skeleton. */
  readonly #docType: DocSkeleton["docType"];
  /** The injected run date — the version-row date truth (`YYYY-MM-DD`). */
  readonly #date: string;
  /** The projection's slots in shape-group order. */
  readonly #slots: readonly SkeletonSlot[];

  constructor(projection: DocSkeleton, date: string) {
    this.#docType = projection.docType;
    this.#date = date;
    this.#slots = projection.slots;
  }

  /** Render the doc skeleton's markdown bytes — no trailing newline (the CLI owns
   *  the appended `\n`; the EOF-newline rule lands on the redirected fixture). */
  render(): string {
    switch (this.#docType) {
      case "overall":
        return this.#renderOverall();
      case "plan":
        return this.#renderPlan();
      case "phase-spec":
        return this.#renderPhaseSpec();
    }
  }

  // -------------------------------------------------------------------------
  // the per-doc-type compositions — the doc section sequence + its scaffolds
  // -------------------------------------------------------------------------

  /** The overall skeleton — the header tuple, the section sequence (the four table
   *  sections, the charter facets and the dependency graph) and the change-history
   *  table: every required overall element lands in its structural position. */
  #renderOverall(): string {
    const lines: string[] = [];
    this.#pushHeader(lines);
    lines.push(...this.#section("## Document scope", [":::fill document-scope"]));
    lines.push(...this.#section("## File paths", this.#filePathsTable()));
    lines.push(...this.#section("## Program charter", this.#programCharter()));
    lines.push(...this.#section("## Issue inventory", this.#issueTable()));
    lines.push(...this.#section("## Phase inventory", this.#phaseTable()));
    lines.push(...this.#section("## Dependency graph", this.#dependencyGraph()));
    lines.push(...this.#section("## Boundary rules", ["- :::fill boundary-rule"]));
    lines.push(...this.#section("## Maintenance", ["- :::fill maintenance-note"]));
    lines.push(...this.#section("## Change history", this.#historyTable()));
    return this.#join(lines);
  }

  /** The plan skeleton — the header tuple, the constraints section, the first task
   *  block (`### Task 1:` with the seven required task fields) and the
   *  change-history table (§3.2 — one task block, more blocks appended when
   *  filling). */
  #renderPlan(): string {
    const lines: string[] = [];
    this.#pushHeader(lines);
    lines.push(...this.#section("## Constraints", ["- :::fill constraint"]));
    lines.push(...this.#taskBlock());
    lines.push(...this.#section("## Change history", this.#historyTable()));
    return this.#join(lines);
  }

  /** The phase-spec skeleton — the header five-tuple, the Design double layer
   *  (one `### 1.` group + one `#### 1.1` item + the acceptance surface), the
   *  constraints section and the change-history table (§3.2 — more groups/items
   *  appended in numeric order when filling). */
  #renderPhaseSpec(): string {
    const lines: string[] = [];
    this.#pushHeader(lines);
    lines.push(
      ...this.#section("## Design", [
        // The design intro is the Design section's one prose position — a rank-3
        // group heading closes the rank-2 section block, so the intro line (not a
        // blank) is what keeps the section non-hollow.
        ":::fill design-intro",
        "",
        "### 1. :::fill group-title",
        "#### 1.1 :::fill item-title",
        "- :::fill item-body",
        "",
        "### Acceptance criteria",
        "",
        "- `:::fill acceptance-entry`",
      ]),
    );
    lines.push(...this.#section("## Constraints", ["- :::fill constraint"]));
    lines.push(...this.#section("## Change history", this.#historyTable()));
    return this.#join(lines);
  }

  // -------------------------------------------------------------------------
  // the shared scaffolds — header, tables, sections, the join
  // -------------------------------------------------------------------------

  /** The header block — the header-home slots in projection order (the registry
   *  order — the title, then the version/status truths, the content markers, the
   *  link placeholders), followed by the blank separator. */
  #pushHeader(lines: string[]): void {
    for (const slot of this.#slots) {
      if (slot.home !== "header") continue;
      lines.push(this.#headerLine(slot));
    }
    lines.push("");
  }

  /** One header line — the anchor's declared form with the injected date (the
   *  link-typed anchors assemble their placeholder-link line from the LINK_SLOTS
   *  label/target pair; the header anchors are a closed set over the three
   *  registries — an unknown header anchor is a registry drift, loud never
   *  silent). */
  #headerLine(slot: SkeletonSlot): string {
    if (slot.slot === "link") {
      const pair = LINK_SLOTS[slot.anchor];
      if (pair === undefined) {
        throw new Error(`no skeleton link slot for the ${slot.anchor} anchor`);
      }
      const marker = slot.anchor === "**Spec:**" ? "**Spec:**" : `- ${slot.anchor}:`;
      return `${marker} [${pair.label}](${pair.target})`;
    }
    if (slot.anchor === "**Status**") {
      return `- **Status**: ${this.#truth("**Status**")}`;
    }
    const form = HEADER_FORMS[slot.anchor];
    if (form === undefined) {
      throw new Error(`no skeleton header form for the ${slot.anchor} anchor`);
    }
    return form.replace("{date}", this.#date);
  }

  /** The generator truth of one pattern-typed slot — an unknown anchor is a
   *  registry drift, loud never silent. */
  #truth(anchor: string): string {
    const truth = TRUTH_LINES[anchor];
    if (truth === undefined) throw new Error(`no skeleton truth for the ${anchor} anchor`);
    return truth;
  }

  /** One markdown section — the heading, a blank, the body and a trailing blank. */
  #section(heading: string, body: readonly string[]): string[] {
    return [heading, "", ...body, ""];
  }

  /** The File-paths artifact table — the two-column header + the minimal one-row
   *  scaffold (the backticked path cell keeps the `File path row` shape). */
  #filePathsTable(): string[] {
    return ["| Artifact | Path |", "| --- | --- |", "| overall | `:::fill overall-path` |"];
  }

  /** The charter facets — the three required `###` facet headings with their
   *  content bullets (the optional decision-group / endorsements leaves generate
   *  no slot — the optional/conditional zero-gen contract). */
  #programCharter(): string[] {
    return [
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
    ];
  }

  /** The Issue-inventory table — the registered columns + the minimal row (the `P1`
   *  phase cell registers the inventory id, the issue-ref cell the enum's first
   *  legal literal (`none`), the title cell a content fill). */
  #issueTable(): string[] {
    return [
      "| Phase | Issue (ref) | Title summary |",
      "| --- | --- | --- |",
      `| P1 | ${this.#truth("Issue ref cell")} | :::fill issue-title |`,
    ];
  }

  /** The Phase-inventory table — the registered columns + two rows (the `P1 -> P2`
   *  graph edge cross-links both ids, so both phases register; the design/plan
   *  cells carry the `Pending` enum truths, the phase-id cell the structural id). */
  #phaseTable(): string[] {
    const phaseRow = `:::fill phase-name | :::fill scope | ${this.#truth("Design spec cell")} | ${this.#truth("Implementation plan cell")} | :::fill acceptance-criteria | :::fill dependency`;
    return [
      "| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |",
      "| --- | --- | --- | --- | --- | --- | --- |",
      `| P1 | ${phaseRow} |`,
      `| P2 | ${phaseRow} |`,
    ];
  }

  /** The Dependency-graph block — the hard-edge truth row + the legend line. */
  #dependencyGraph(): string[] {
    return [this.#truth("Hard edge"), this.#truth("Graph legend")];
  }

  /** The Change-history table — the header + separator + the first-row scaffold. */
  #historyTable(): string[] {
    return [HISTORY_HEADER, "| --- | --- | --- | --- |", this.#historyRow()];
  }

  /** The change-history first row — the v0.1 version token (the header version),
   *  the injected run date and the summary/author content fills. */
  #historyRow(): string {
    return `| v0.1 | ${this.#date} | :::fill summary | :::fill author |`;
  }

  /** The first task block — the true-numbered `### Task 1:` heading (the title a
   *  content fill) plus the seven required task fields: the content markers with
   *  their values, the Steps field with the checkable step form (§3.2), and the
   *  `none` DependsOn default. */
  #taskBlock(): string[] {
    return [
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
    ];
  }

  /** Join the assembled lines — the trailing blank of the last section dropped
   *  (render() never ends with a blank line or a newline). */
  #join(lines: readonly string[]): string {
    const out = [...lines];
    while (out.length > 0 && out[out.length - 1] === "") out.pop();
    return out.join("\n");
  }
}
