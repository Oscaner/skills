// packages/cdd-engine/src/docs/skeleton/assembler.ts
// The skeleton assembler — one document type's registry-derived projection rendered into the
// markdown skeleton a consumer fills.
//
// The structure is the SAME registry-derived surface the judge reads: the skeleton is green
// by construction, never an exemption channel. Pure content slots take `:::fill`,
// link-shaped anchors a placeholder link, and structure is always a true value — so the
// rendered bytes pass the doc contract's own pin.
//
// Two facts this file is the single home of:
//   · the four families. `compose` is an exhaustive switch over `DocType`, and the type set
//     is `DOC_TYPE_VALUES` — a fifth document type is a type error here, not a silent empty
//     skeleton;
//   · the DATE. The front-matter `date:` line and the change-history row come from the
//     constructor's `today`, which has no default: the assembler never reads a clock, so a
//     caller that wants today's date has to say so. That is what makes the parity corpus able
//     to drive two trees under one frozen date and compare the `date:` line byte for byte.
//
// The write face is INJECTED (`textWriter`): this file touches no filesystem, so a pin can
// watch the write and a caller can point it at the repository root. `env/workspace` supplies
// the production writer; the repository-relative target is already the `RepoPath` basis, so
// no path is spelled here.
//
// Rule zero (over the 200-line class limit): the four compositions are ONE rendering rule
// walking one projection — the families share every scaffold (front matter, tables,
// sections, the join), and splitting them would copy the scaffolds four times.

import { Pair, Scalar, stringify as stringifyYaml, YAMLMap } from "yaml";
import type { RepoPath } from "../../env/paths/root.ts";
import type { DocSkeleton, SkeletonProjection, SkeletonSlot } from "../identity/project.ts";
import { DOC_TYPE_VALUES, type DocType } from "../identity/types.ts";

/** A text write's declared outcome — the repository-relative target either took the bytes or
 *  refused them. Structurally identical to `env/workspace`'s `WriteOutcome`, so the
 *  production writer plugs in without a cast and this slice depends on no `env/` class. */
export type TextWriteOutcome =
  | { readonly kind: "written"; readonly target: RepoPath }
  | { readonly kind: "write-failure"; readonly target: RepoPath };

/** The injected text writer — `env/workspace#writeTextAt` in production. */
export type TextWriter = (target: RepoPath, text: string) => TextWriteOutcome;

/** The placeholder scalars of the front-matter slug-reference keys — the phase-spec
 *  `program:` head key renders a `<…>`-shaped value that rides the judge's
 *  placeholder-exemption chain, never a `:::fill` (a fill in a link slot is a guaranteed
 *  finding). Its inner shape is the SLUG of the parent overall document, which is exactly the
 *  form the consumer must fill. */
const FRONT_MATTER_LINKS: Record<string, string> = {
  program: "<overall-slug>",
};

/** The generator truths of the pattern-typed body slots — hand-pinned legal literals
 *  consistent with each declared value domain (the `none` issue-ref default, the two pending
 *  forms, the conforming graph rows) and the shared history header. */
const TRUTH_LINES: Record<string, string> = {
  "Issue ref cell": "none",
  "Implementation plan cell": "Pending",
  "Design spec cell": "[Pending]",
  "Hard edge": "P1 -> P2",
  "Graph legend": "- `->` = hard block",
};

/** The change-history table scaffold — the shared header row. */
const HISTORY_HEADER = "| Version | date | summary | author |";

/** The assembler's construction facts. */
export interface SkeletonAssemblerOptions {
  /** The four projections, one per document type — `Projector#skeleton()`. */
  readonly projection: SkeletonProjection;
  /** The day the skeleton's `date:` lines carry (`YYYY-MM-DD`) — required, no default. */
  readonly today: string;
  /** The one write face — `env/workspace#writeTextAt` in production. */
  readonly textWriter: TextWriter;
}

/**
 * SkeletonAssembler — one skeleton renderer over the four projections. Invariant: the bytes
 * are a pure function of (type, projection, today), and the only side effect this class can
 * have is the injected `textWriter`.
 */
export class SkeletonAssembler {
  readonly #projection: SkeletonProjection;
  readonly #today: string;
  readonly #textWriter: TextWriter;

  constructor(opts: SkeletonAssemblerOptions) {
    if (typeof opts.today !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(opts.today)) {
      throw new Error("SkeletonAssembler: `today` is required and must be a `YYYY-MM-DD` day");
    }
    if (typeof opts.textWriter !== "function") {
      throw new Error("SkeletonAssembler: `textWriter` is required (this slice owns no fs)");
    }
    this.#projection = opts.projection;
    this.#today = opts.today;
    this.#textWriter = opts.textWriter;
  }

  /** The document types this assembler composes, in the declared order — the type set is the
   *  vocabulary's, never a second list. */
  static types(): readonly DocType[] {
    return DOC_TYPE_VALUES;
  }

  /** One document type's skeleton bytes — NO trailing newline (the write face adds the one
   *  `\n`). The composition asserts slot consumption over the body slots, so a
   *  registry/composition drift is a loud throw here, never a silent byte gap. */
  compose(type: DocType): string {
    const skeleton = this.#projection[type];
    const probe = new Set<string>();
    const lines = this.#composeType(skeleton, probe);
    SkeletonAssembler.#assertConsumed(skeleton, probe);
    return SkeletonAssembler.#join(lines);
  }

  /** Render one skeleton and land it: the bytes, exactly one trailing `\n`, and the writer's
   *  own declared outcome. */
  assembleAt(type: DocType, target: RepoPath): TextWriteOutcome {
    return this.#textWriter(target, `${this.compose(type)}\n`);
  }

  /** The exhaustive type dispatch — a fifth document type is a type error, not an empty
   *  skeleton. */
  #composeType(skeleton: DocSkeleton, probe: Set<string>): string[] {
    switch (skeleton.docType) {
      case "overall":
        return this.#renderOverall(skeleton, probe);
      case "plan":
        return this.#renderPlan(skeleton, probe);
      case "phase-spec":
        return this.#renderPhaseSpec(skeleton, probe);
      case "single-spec":
        return this.#renderSingleSpec(skeleton, probe);
    }
  }

  /** The slot-consumption invariant — every required body slot is emitted, and no emitted
   *  probe names an anchor the registry does not require. The domain is the BODY: the
   *  front-matter head is emitted from the projection's independent emission list. */
  static #assertConsumed(skeleton: DocSkeleton, probe: ReadonlySet<string>): void {
    const registered = new Set(
      skeleton.slots.filter((slot) => slot.home !== "frontmatter").map((slot) => slot.anchor),
    );
    const unemitted = skeleton.slots
      .filter((slot) => slot.home !== "frontmatter" && !probe.has(slot.anchor))
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
  // the per-type compositions — the document's section sequence
  // -------------------------------------------------------------------------

  /** The overall skeleton: the head, the three table sections, the charter facets, the graph,
   *  the Form-A constraints surface and the change history. */
  #renderOverall(skeleton: DocSkeleton, probe: Set<string>): string[] {
    const lines: string[] = [];
    this.#pushFrontmatter(skeleton, lines);
    lines.push(...this.#section("## Document scope", [":::fill document-scope"], probe));
    lines.push(...this.#section("## Program charter", this.#programCharter(probe), probe));
    lines.push(...this.#section("## Issue inventory", this.#issueTable(probe), probe));
    lines.push(...this.#section("## Phase inventory", this.#phaseTable(probe), probe));
    lines.push(...this.#section("## Dependency graph", this.#dependencyGraph(probe), probe));
    lines.push(...this.#section("## Boundary rules", ["- :::fill boundary-rule"], probe));
    lines.push(
      ...this.#section(
        "## Constraints",
        ["- :::fill constraint"],
        probe,
        "Constraint delta bullet",
      ),
    );
    lines.push(...this.#section("## Maintenance", ["- :::fill maintenance-note"], probe));
    lines.push(...this.#section("## Change history", this.#historyTable(probe), probe));
    return lines;
  }

  /** The plan skeleton: the head, the constraints section, one task block and the change
   *  history — more blocks are appended when filling. */
  #renderPlan(skeleton: DocSkeleton, probe: Set<string>): string[] {
    const lines: string[] = [];
    this.#pushFrontmatter(skeleton, lines);
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

  /** The phase-spec skeleton: the head, the Design double layer (one group, one item and the
   *  acceptance surface), the constraints section and the change history. */
  #renderPhaseSpec(skeleton: DocSkeleton, probe: Set<string>): string[] {
    const lines: string[] = [];
    this.#pushFrontmatter(skeleton, lines);
    lines.push(
      ...this.#section(
        "## Design",
        [
          // The design intro is the section's one prose position: a rank-3 heading closes the
          // rank-2 block, so the intro line (not a blank) keeps the section non-hollow.
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

  /** The single-spec skeleton: the head, the four prose sections and the change history. No
   *  `### N.` outline and no `program:` key — the single-spec's deliberate deviations. */
  #renderSingleSpec(skeleton: DocSkeleton, probe: Set<string>): string[] {
    const lines: string[] = [];
    this.#pushFrontmatter(skeleton, lines);
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
  // the shared scaffolds
  // -------------------------------------------------------------------------

  /** The front-matter head — the projection's emission list in registry order, emitted by
   *  `yaml.stringify` in ONE call: the link keys a `<…>` scalar, the content keys
   *  `:::fill <key>` (single-quoted, so a filled `[human] · …` never breaks the scalar), the
   *  truth keys their true values. */
  #pushFrontmatter(skeleton: DocSkeleton, lines: string[]): void {
    const fields = new YAMLMap();
    for (const slot of skeleton.frontmatter) {
      const value = new Scalar(this.#frontmatterValue(skeleton, slot));
      value.type = slot.slot === "content" ? Scalar.QUOTE_SINGLE : Scalar.PLAIN;
      fields.items.push(new Pair(new Scalar(slot.anchor), value));
    }
    const block = stringifyYaml(fields).trimEnd().split("\n");
    lines.push("---", ...block, "---", "");
  }

  /** One front-matter value — the three-way placeholder split over the slot kind. */
  #frontmatterValue(skeleton: DocSkeleton, slot: SkeletonSlot): string {
    if (slot.slot === "link") {
      const placeholder = FRONT_MATTER_LINKS[slot.anchor];
      if (placeholder === undefined) {
        throw new Error(`no skeleton front-matter link placeholder for the ${slot.anchor} anchor`);
      }
      return placeholder;
    }
    if (slot.slot === "content") return `:::fill ${slot.anchor}`;
    return this.#frontmatterTruth(skeleton, slot);
  }

  /** The true value of a fixed/patterned front-matter key — the type, the injected day and the
   *  fixed first version. An unknown truth key is a registry drift, loud never silent. */
  #frontmatterTruth(skeleton: DocSkeleton, slot: SkeletonSlot): string {
    switch (slot.anchor) {
      case "doc-type":
        return skeleton.docType;
      case "version":
        return "v0.1";
      case "date":
        return this.#today;
    }
    throw new Error(`no skeleton front-matter truth for the ${slot.anchor} anchor`);
  }

  /** The generator truth of one pattern-typed body slot. */
  static #truth(anchor: string): string {
    const truth = TRUTH_LINES[anchor];
    if (truth === undefined) throw new Error(`no skeleton truth for the ${anchor} anchor`);
    return truth;
  }

  /** One markdown section — the heading (probed), a blank, the body and a trailing blank. */
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

  /** The charter facets — the three required facet headings with their content bullets. */
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

  /** The Issue-inventory table — the registered columns, the minimal row. */
  #issueTable(probe: Set<string>): string[] {
    probe.add("Issue inventory columns");
    probe.add("Issue row");
    probe.add("Issue ref cell");
    return [
      "| Phase | Issue (ref) | Title summary |",
      "| --- | --- | --- |",
      `| P1 | ${SkeletonAssembler.#truth("Issue ref cell")} | :::fill issue-title |`,
    ];
  }

  /** The Phase-inventory table — the registered columns and two rows, so the graph edge
   *  cross-links both ids. */
  #phaseTable(probe: Set<string>): string[] {
    probe.add("Phase inventory columns");
    probe.add("Phase row");
    probe.add("Phase id token");
    probe.add("Implementation plan cell");
    probe.add("Design spec cell");
    probe.add("Dependency cell");
    const row = `:::fill phase-name | :::fill scope | ${SkeletonAssembler.#truth("Design spec cell")} | ${SkeletonAssembler.#truth("Implementation plan cell")} | :::fill acceptance-criteria | :::fill dependency`;
    return [
      "| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |",
      "| --- | --- | --- | --- | --- | --- | --- |",
      `| P1 | ${row} |`,
      `| P2 | ${row} |`,
    ];
  }

  /** The Dependency-graph block — the hard-edge truth row and the legend line. */
  #dependencyGraph(probe: Set<string>): string[] {
    probe.add("Hard edge");
    probe.add("Graph legend");
    return [SkeletonAssembler.#truth("Hard edge"), SkeletonAssembler.#truth("Graph legend")];
  }

  /** The Change-history table — the header, the separator and the first-row scaffold. */
  #historyTable(probe: Set<string>): string[] {
    probe.add("Change history row");
    probe.add("Version token");
    probe.add("Change history date");
    return [HISTORY_HEADER, "| --- | --- | --- | --- |", this.#historyRow()];
  }

  /** The change-history first row — the v0.1 token, the injected day and two content fills. */
  #historyRow(): string {
    return `| v0.1 | ${this.#today} | :::fill summary | :::fill author |`;
  }

  /** The first task block — the true-numbered heading plus the seven reserved sections, with
   *  two step samples and the `none` DependsOn default. */
  #taskBlock(probe: Set<string>): string[] {
    probe.add("### Task N:");
    probe.add("Task id token");
    probe.add("#### Objective");
    probe.add("#### Files");
    probe.add("File path token");
    probe.add("#### Consumes");
    probe.add("#### Produces");
    probe.add("#### Steps");
    probe.add("Step action");
    probe.add("Step checkable");
    probe.add("#### Acceptance");
    probe.add("#### DependsOn");
    return [
      "### Task 1: :::fill task-title",
      "",
      "#### Objective",
      ":::fill objective",
      "",
      "#### Files",
      ":::fill file-paths",
      "",
      "#### Consumes",
      ":::fill consumes",
      "",
      "#### Produces",
      ":::fill produces",
      "",
      "#### Steps",
      "- :::fill step-action — checkable: :::fill step-checkable",
      "- :::fill step-action-2 — checkable: :::fill step-checkable-2",
      "",
      "#### Acceptance",
      ":::fill acceptance",
      "",
      "#### DependsOn",
      "none",
      "",
    ];
  }

  /** Join the assembled lines — the trailing blanks of the last section dropped: `compose` never
   *  ends with a blank line or a newline. */
  static #join(lines: readonly string[]): string {
    const out = [...lines];
    while (out.length > 0 && out[out.length - 1] === "") out.pop();
    return out.join("\n");
  }
}
