// packages/cdd-engine/src-next/render/skeleton.ts
// The SkeletonAssembler — the render face of the skeleton projection (spec §3/§4.1,
// the `cdd schema get <type> --output skeleton` rendering): a DocSkeleton (contract/project.ts — the
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
// fixture ends with exactly one newline). The composition is the judgment site
// of the projection: after assembly render() asserts slot consumption — every
// registered required slot emits a probe and every probe names a registered
// slot, so a registry/composition drift is a loud throw in the renderer, never a
// silent byte gap (the doc-contract pin judges the rendered bytes; this asserts
// the same coverage in-process, before any bytes are produced).
//
// Module-level exports are types / the class — zero behavior-carrying bare
// functions (the plan's zero-bare-function discipline).

import type { DocSkeleton, SkeletonSlot } from "../contract/project.ts";

/** The per-anchor header line forms — every registered header anchor of the four
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

/** The generator truths of the pattern-typed slots (spec §3.2/§4.1) — hand-pinned
 *  legal literals consistent with each declared value domain (`**Status**` →
 *  Draft, the first legal literal of its enum; the `none` issue-ref default; the
 *  `[Pending]` design cell — the only pending form its valuePattern admits, never
 *  bare `Pending` — and the bare `Pending` plan cell, a legal alternative of its
 *  domain) and the conforming graph rows (the `P1 -> P2` hard edge + the legend
 *  line). These are derived true values, guarded by the doc-contract pins that
 *  judge the rendered bytes — never fill positions. */
const TRUTH_LINES: Record<string, string> = {
  "**Status**": "Draft",
  "Issue ref cell": "none",
  "Implementation plan cell": "Pending",
  "Design spec cell": "[Pending]",
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
   *  the appended `\n`; the EOF-newline rule lands on the redirected fixture).
   *  Every composed anchor registers a probe; the composition completes only when
   *  the probes and the projection's required slots coincide (a drift is a loud
   *  throw below, never silent bytes). */
  render(): string {
    const probe = new Set<string>();
    const lines: string[] = this.#compose(probe);
    this.#assertConsumed(probe);
    return this.#join(lines);
  }

  /** Compose the doc-type lines, registering every emitted registered anchor in
   *  the probe set (each composition helper probes the anchors it emits). */
  #compose(probe: Set<string>): string[] {
    switch (this.#docType) {
      case "overall-spec":
        return this.#renderOverallSpec(probe);
      case "plan":
        return this.#renderPlan(probe);
      case "phase-spec":
        return this.#renderPhaseSpec(probe);
      case "single-spec":
        return this.#renderSingleSpec(probe);
    }
  }

  /** The slot-consumption invariant — the composition-side tripwire of the
   *  registry-derived structure (the finding hardened in: the projection is the
   *  single structure source, the hand-written compositions must not drift from
   *  it): every required slot of the projection is emitted by the composition,
   *  and no composition probe names an anchor the registry does not require — a
   *  registered element with no composition position, or a composed anchor no
   *  longer required, is registry drift, loud never silent. */
  #assertConsumed(probe: ReadonlySet<string>): void {
    const registered = new Set(this.#slots.map((slot) => slot.anchor));
    const unemitted = this.#slots
      .filter((slot) => !probe.has(slot.anchor))
      .map((slot) => slot.anchor);
    if (unemitted.length > 0) {
      throw new Error(
        `skeleton composition omits the registered required slot(s): ${unemitted.join(", ")}`,
      );
    }
    for (const anchor of probe) {
      if (!registered.has(anchor)) {
        throw new Error(`skeleton composition emits the unregistered anchor: ${anchor}`);
      }
    }
  }

  // -------------------------------------------------------------------------
  // the per-doc-type compositions — the doc section sequence + its scaffolds
  // -------------------------------------------------------------------------

  /** The overall-spec skeleton — the header tuple, the section sequence (the four table
   *  sections, the charter facets and the dependency graph) and the change-history
   *  table: every required overall-spec element lands in its structural position. */
  #renderOverallSpec(probe: Set<string>): string[] {
    const lines: string[] = [];
    this.#pushHeader(lines, probe);
    lines.push(...this.#section("## Document scope", [":::fill document-scope"], probe));
    lines.push(...this.#section("## File paths", this.#filePathsTable(probe), probe));
    lines.push(...this.#section("## Program charter", this.#programCharter(probe), probe));
    lines.push(...this.#section("## Issue inventory", this.#issueTable(probe), probe));
    lines.push(...this.#section("## Phase inventory", this.#phaseTable(probe), probe));
    lines.push(...this.#section("## Dependency graph", this.#dependencyGraph(probe), probe));
    lines.push(...this.#section("## Boundary rules", ["- :::fill boundary-rule"], probe));
    lines.push(...this.#section("## Maintenance", ["- :::fill maintenance-note"], probe));
    lines.push(...this.#section("## Change history", this.#historyTable(probe), probe));
    return lines;
  }

  /** The plan skeleton — the header tuple, the constraints section, the first task
   *  block (`### Task 1:` with the seven required task fields) and the
   *  change-history table (§3.2 — one task block, more blocks appended when
   *  filling). */
  #renderPlan(probe: Set<string>): string[] {
    const lines: string[] = [];
    this.#pushHeader(lines, probe);
    lines.push(
      ...this.#section(
        "## Constraints",
        ["- :::fill constraint"],
        probe,
        "Constraint delta bullet",
      ),
    );
    lines.push(...this.#taskBlock(probe));
    lines.push(...this.#section("## Change history", this.#historyTable(probe), probe));
    return lines;
  }

  /** The phase-spec skeleton — the header five-tuple, the Design double layer
   *  (one `### 1.` group + one `#### 1.1` item + the acceptance surface), the
   *  constraints section and the change-history table (§3.2 — more groups/items
   *  appended in numeric order when filling). */
  #renderPhaseSpec(probe: Set<string>): string[] {
    const lines: string[] = [];
    this.#pushHeader(lines, probe);
    lines.push(
      ...this.#section(
        "## Design",
        [
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
        ],
        probe,
        "### N. group heading",
        "#### N.M item heading",
        "### Acceptance criteria",
        "Acceptance entry",
      ),
    );
    lines.push(
      ...this.#section(
        "## Constraints",
        ["- :::fill constraint"],
        probe,
        "Constraint delta bullet",
      ),
    );
    lines.push(...this.#section("## Change history", this.#historyTable(probe), probe));
    return lines;
  }

  /** The single-spec skeleton — the header five-tuple, the four prose sections
   *  (`:::fill` slots) and the change-history table: the lightweight scaffold of
   *  the free-form spec (P6 T2 · spec §2.1). No `### N.` double-layer outline and
   *  no `**Parent program**` — the single-spec's deliberate deviations from the
   *  phase-spec form. */
  #renderSingleSpec(probe: Set<string>): string[] {
    const lines: string[] = [];
    this.#pushHeader(lines, probe);
    lines.push(
      ...this.#section("## Background & root cause", [":::fill background-root-cause"], probe),
    );
    lines.push(...this.#section("## Design decisions", [":::fill design-ruling"], probe));
    lines.push(...this.#section("## Acceptance", [":::fill acceptance"], probe));
    lines.push(...this.#section("## Constraints", [":::fill constraints"], probe));
    lines.push(...this.#section("## Change history", this.#historyTable(probe), probe));
    return lines;
  }

  // -------------------------------------------------------------------------
  // the shared scaffolds — header, tables, sections, the join
  // -------------------------------------------------------------------------

  /** The header block — the header-home slots in projection order (the registry
   *  order — the title, then the version/status truths, the content markers, the
   *  link placeholders), each probed, followed by the blank separator. The
   *  `- **Doc type**: <key>` declaration line is emitted right AFTER the Version
   *  line (the position every real doc carries it): it is the reader the
   *  board/preflight/capsule faces require, and it is deliberately NOT a
   *  registered slot (it is doc-identity metadata, not a projected element), so it
   *  is composed structurally and never probed — the skeleton the engine produces
   *  now passes its OWN preflight (§3.1 ⑩). */
  #pushHeader(lines: string[], probe: Set<string>): void {
    for (const slot of this.#slots) {
      if (slot.home !== "header") continue;
      lines.push(this.#headerLine(slot));
      probe.add(slot.anchor);
      if (slot.anchor === "**Version**") lines.push(`- **Doc type**: ${this.#docType}`);
    }
    lines.push("");
  }

  /** One header line — the anchor's declared form with the injected date (the
   *  link-typed anchors assemble their placeholder-link line from the LINK_SLOTS
   *  label/target pair; the header anchors are a closed set over the four
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

  /** One markdown section — the heading (probed as its registered section-heading
   *  anchor), a blank, the body and a trailing blank. The body anchors are the
   *  registered anchors the body emits beyond the heading (the table rows/cells,
   *  the delta bullets, the design-body headings) — every one must be a required
   *  slot of the doc type. */
  #section(
    heading: string,
    body: readonly string[],
    probe: Set<string>,
    ...bodyAnchors: string[]
  ): string[] {
    probe.add(heading);
    for (const anchor of bodyAnchors) probe.add(anchor);
    return [heading, "", ...body, ""];
  }

  /** The File-paths artifact table — the two-column header + the minimal one-row
   *  scaffold (the backticked path cell keeps the `File path row` shape). */
  #filePathsTable(probe: Set<string>): string[] {
    probe.add("File path row");
    return ["| Artifact | Path |", "| --- | --- |", "| overall-spec | `:::fill overall-path` |"];
  }

  /** The charter facets — the three required `###` facet headings with their
   *  content bullets (the optional decision-group / endorsements leaves generate
   *  no slot — the optional/conditional zero-gen contract). */
  #programCharter(probe: Set<string>): string[] {
    probe.add("### Goal");
    probe.add("### Non-goals");
    probe.add("### Cross-cutting");
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
  #issueTable(probe: Set<string>): string[] {
    probe.add("Issue inventory columns");
    probe.add("Issue row");
    probe.add("Issue ref cell");
    return [
      "| Phase | Issue (ref) | Title summary |",
      "| --- | --- | --- |",
      `| P1 | ${this.#truth("Issue ref cell")} | :::fill issue-title |`,
    ];
  }

  /** The Phase-inventory table — the registered columns + two rows (the `P1 -> P2`
   *  graph edge cross-links both ids, so both phases register; the cells carry the
   *  pending-form truths (`[Pending]` design — the design domain's pending form —
   *  and `Pending` plan, each legal in its declared domain), the phase-id cell the
   *  structural id). */
  #phaseTable(probe: Set<string>): string[] {
    probe.add("Phase inventory columns");
    probe.add("Phase row");
    probe.add("Phase id token");
    probe.add("Implementation plan cell");
    probe.add("Design spec cell");
    probe.add("Dependency cell");
    const phaseRow = `:::fill phase-name | :::fill scope | ${this.#truth("Design spec cell")} | ${this.#truth("Implementation plan cell")} | :::fill acceptance-criteria | :::fill dependency`;
    return [
      "| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |",
      "| --- | --- | --- | --- | --- | --- | --- |",
      `| P1 | ${phaseRow} |`,
      `| P2 | ${phaseRow} |`,
    ];
  }

  /** The Dependency-graph block — the hard-edge truth row + the legend line. */
  #dependencyGraph(probe: Set<string>): string[] {
    probe.add("Hard edge");
    probe.add("Graph legend");
    return [this.#truth("Hard edge"), this.#truth("Graph legend")];
  }

  /** The Change-history table — the header + separator + the first-row scaffold. */
  #historyTable(probe: Set<string>): string[] {
    probe.add("Change history row");
    probe.add("Version token");
    probe.add("Change history date");
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
  #taskBlock(probe: Set<string>): string[] {
    probe.add("### Task N:");
    probe.add("Task id token");
    probe.add("**Objective**");
    probe.add("**Files**");
    probe.add("File path token");
    probe.add("**Consumes**");
    probe.add("**Produces**");
    probe.add("**Steps**");
    probe.add("Step action");
    probe.add("Step checkable");
    probe.add("**Acceptance**");
    probe.add("**DependsOn**");
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
