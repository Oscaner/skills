// packages/cdd-engine/src-next/contract/doc.ts
// T4 — the contract plane's parse face (design spec §2.2: the DocType classes are
// pared down to parse + projection consumption + the cross-doc chain root; zero
// judgment methods on the class face).
//
// The three DocType classes own exactly three surfaces:
//   · parse          — structural extraction: overall → the four tables (File paths /
//                      Issue inventory / Phase inventory / Change history) + the
//                      dependency-graph edge lines; plan → the `### Task N:` blocks
//                      and their fields; phase-spec → the `## Design` double-layer
//                      skeleton (groups + items). Nothing is decided here — parse
//                      extracts, the invariant family judges.
//   · projection     — each class consumes the derived projection face (project.ts):
//                      the slices (parse regexes) and the shape (section skeleton) of
//                      its own doc type are the locating data every extraction walks.
//   · chain root     — the Class-A/B anchors of the document (the plan's `**Spec:**`
//                      link, the `**Parent program**` link + its version tokens, the
//                      overall's Phase-inventory rows as the chain's anchor set) are
//                      extracted into a ChainRoot and LEFT as an interface — the
//                      resolution judgment belongs to the cross-doc-chain invariant,
//                      never to a DocType method.
//
// Module-level exports are types / the class family / one composition root — zero
// behavior-carrying bare functions (the plan's zero-bare-function discipline).

import type { DocKey, DocShape, DocSlices, ElementSlice } from "./project.ts";
import { projectShape, projectSlices } from "./project.ts";

// ---------------------------------------------------------------------------
// shared structural types
// ---------------------------------------------------------------------------

/** The markdown heading rank (the count of leading `#`s). */
type HeadingRank = 1 | 2 | 3 | 4;

/** One heading block of the document — a heading line and the lines up to the next heading. */
export interface HeadingBlock {
  /** The heading line verbatim, leading `#`s included. */
  heading: string;
  /** The heading's markdown rank. */
  rank: HeadingRank;
  /** The block's body lines (excluding the heading line). */
  body: readonly string[];
}

/** One `##`-ranked section of the document. */
export interface SectionBlock {
  /** The section's heading line verbatim (e.g. "## Document scope"). */
  heading: string;
  /** The section's body lines (up to the next `##`-ranked heading). */
  lines: readonly string[];
}

/** A markdown table parsed from a section: the column header plus its data rows. */
export interface ParsedTable {
  /** The table's section heading line (e.g. "## Phase inventory"). */
  heading: string;
  /** The column-header row (the first non-separator table line), when present. */
  headerRow: readonly string[] | null;
  /** The data rows — every non-separator table line after the header row. */
  rows: readonly string[][];
}

// ---------------------------------------------------------------------------
// the root-level parse records
// ---------------------------------------------------------------------------

/** One dependency-graph edge line (`P<n> -> P<m>`) parsed verbatim. */
export interface GraphEdge {
  /** The edge line verbatim. */
  text: string;
  /** The edge's from-phase token (the leading `P<n>` — a `.digits` suffix included). */
  from: string;
  /** The edge's to-phase token. */
  to: string;
}

/** One parsed phase-inventory row of the overall (the chain-root anchor set). */
export interface ChainPhase {
  /** The registered phase id (e.g. "P2.1"). */
  id: string;
  /** The Design-spec cell text (link tokens, e.g. `[P2-design](docs/kairos/specs/x-design.md)`). */
  designCell: string;
  /** The Implementation-plan cell text (link tokens, e.g. `[plan](docs/kairos/plans/x.md)`). */
  planCell: string;
  /** The Dependency cell text (e.g. "P1 -> P2"). */
  dependencyCell: string;
}

/** A `[label](target)` link parsed from a line. */
export interface ChainLink {
  /** The link's label text. */
  label: string;
  /** The link's target path. */
  target: string;
}

/**
 * The cross-doc chain root — the Class-A/B anchors a document carries, extracted
 * verbatim and left unresolved. Every resolution judgment (target existence, label
 * vs. basename drift, version-token lineage membership) belongs to the
 * cross-doc-chain / file-existence / sibling-scan invariants.
 */
export interface ChainRoot {
  /** The doc-type identity of the chain root's document. */
  docType: "overall" | "plan" | "phase-spec";
  /** The `**Parent program**` link (Class-B) — the parent overall reference of a
   *  plan/spec document; null for the overall (the chain root itself). */
  parentLink: ChainLink | null;
  /** The `**Spec:**` link (Class-A) — the plan's design-spec reference; null for the
   *  overall (no spec to reference) and for a spec (the document IS the design spec). */
  specLink: ChainLink | null;
  /** The version tokens carried on the `**Parent program**` line (Class-B lineage). */
  parentTokens: readonly string[];
  /** The overall's phase-inventory rows — the chain's anchor set (overall only). */
  phases: readonly ChainPhase[];
  /** The `**Depends on**` header value (plan/spec), verbatim, when the line is present. */
  dependsOn: string | null;
}

/** The overall parse record — the four tables, the graph edges and the chain root. */
export interface OverallParsed {
  docType: "overall";
  /** The `# Title` line verbatim. */
  title: string;
  /** The header bullet lines (between the title and the first section heading). */
  headerLines: readonly string[];
  /** The `##`-ranked sections in document order. */
  sections: readonly SectionBlock[];
  /** The parsed overall tables (each present only when its section was found). */
  tables: {
    "File paths": ParsedTable;
    "Issue inventory": ParsedTable;
    "Phase inventory": ParsedTable;
    "Change history": ParsedTable;
  };
  /** The dependency-graph edge lines under `## Dependency graph`. */
  graphEdges: readonly GraphEdge[];
  /** The overall's cross-doc chain root (its Phase-inventory rows are the anchor set). */
  chain: ChainRoot;
}

/** One parsed `- **Key**:` field of a task block. */
export interface TaskField {
  /** The field key (Objective / Files / Consumes / Produces / Steps / Acceptance / DependsOn). */
  key: string;
  /** The field's value lines — the marker line's remainder plus its continuation lines. */
  lines: readonly string[];
}

/** One parsed step line of a task block's `**Steps**` field. */
export interface TaskStep {
  /** The step's action text (after the leading `- `). */
  action: string;
  /** The step's `— checkable:` clause text, when the line carries one. */
  checkable: string | null;
}

/** One parsed `### Task N:` block. */
export interface TaskBlock {
  /** The task number N. */
  id: number;
  /** The `### Task N: …` heading line verbatim. */
  heading: string;
  /** The block's keyed fields in document order. */
  fields: readonly TaskField[];
  /** The parsed `**Steps**` bullets. */
  steps: readonly TaskStep[];
}

/** The plan parse record — the header, the constraints section and the task blocks. */
export interface PlanParsed {
  docType: "plan";
  title: string;
  headerLines: readonly string[];
  sections: readonly SectionBlock[];
  /** The `### Task N:` blocks in document order. */
  taskBlocks: readonly TaskBlock[];
  chain: ChainRoot;
}

/** One `### N.` design group and its `#### N.M` items (the phase-spec skeleton). */
export interface DesignGroup {
  /** The group's leading number token (`1` for `### 1. …`). */
  number: string;
  /** The group's heading text (after the number token). */
  heading: string;
  /** The group's items in document order. */
  items: readonly DesignItem[];
}

/** One `#### N.M` design item. */
export interface DesignItem {
  /** The item's number token (`1.2` for `#### 1.2 …`). */
  number: string;
  /** The item's heading text. */
  heading: string;
}

/** The phase-spec parse record — the header tuple and the design-body skeleton. */
export interface PhaseSpecParsed {
  docType: "phase-spec";
  title: string;
  headerLines: readonly string[];
  sections: readonly SectionBlock[];
  /** The `## Design` double-layer skeleton (groups + items), when the section is present. */
  design: readonly DesignGroup[];
  chain: ChainRoot;
}

/** The parsed-document union — one record per doc type. */
export type ParsedDoc = OverallParsed | PlanParsed | PhaseSpecParsed;

// ---------------------------------------------------------------------------
// the DocType base — parse + projection consumption + chain root
// ---------------------------------------------------------------------------

/**
 * The abstract doc-type base. Each subclass binds its registry-derived projection
 * face (slices + shape) and implements parse — pure structural extraction into a
 * typed record. The base carries the shared extraction primitives (heading blocks,
 * table rows, header lines, `[label](target)` link parsing) as class methods: the
 * class face stays judgment-free (zero validate/audit/detect methods).
 */
export abstract class DocType<P extends ParsedDoc> {
  /** The doc-type record key — the projection-face identity. */
  readonly key: DocKey;
  /** The derived parse face (per-element anchor slices) of this doc type. */
  readonly slices: DocSlices;
  /** The derived section skeleton (shape projection) of this doc type. */
  readonly shape: DocShape;
  /** The doc-type name as carried by a conforming document's parse record. */
  abstract readonly docTypeName: "overall" | "plan" | "phase-spec";

  /** The per-anchor slice lookup — the parse face's locating patterns. */
  readonly #slicesByAnchor: ReadonlyMap<string, ElementSlice>;

  constructor(key: DocKey) {
    this.key = key;
    this.slices = projectSlices()[key];
    this.shape = projectShape()[key];
    this.#slicesByAnchor = new Map(this.slices.slices.map((slice) => [slice.anchor, slice]));
  }

  /** The pure structural parse — what the invariants and the graph read. */
  abstract parse(lines: readonly string[]): P;

  // -------------------------------------------------------------------------
  // shared extraction primitives (parse-only, never judgment)
  // -------------------------------------------------------------------------

  /** Split lines into heading blocks — a heading line plus its body up to the next heading. */
  protected headingBlocks(lines: readonly string[]): HeadingBlock[] {
    const blocks: HeadingBlock[] = [];
    let openHeading: string | null = null;
    let openRank: HeadingRank | null = null;
    let openBody: string[] = [];
    const close = (): void => {
      if (openHeading !== null && openRank !== null)
        blocks.push({ heading: openHeading, rank: openRank, body: openBody });
      openHeading = null;
      openRank = null;
      openBody = [];
    };
    for (const line of lines) {
      const rank = this.headingRank(line);
      if (rank !== null) {
        close();
        openHeading = line;
        openRank = rank;
      } else if (openHeading !== null) {
        openBody.push(line);
      }
    }
    close();
    return blocks;
  }

  /** The header lines — the `# Title` block's body (metadata lines before the first
   *  rank-2/rank-3 heading block; heading blocks split at every heading, so the title
   *  block body already ends where the sections/task blocks begin). */
  protected headerLines(blocks: readonly HeadingBlock[]): readonly string[] {
    if (blocks.length === 0) return [];
    return blocks[0].body;
  }

  /** The rank-2 section blocks in document order. */
  protected sections(blocks: readonly HeadingBlock[]): SectionBlock[] {
    const out: SectionBlock[] = [];
    for (const block of blocks) {
      if (this.headingRank(block.heading) === 2)
        out.push({ heading: block.heading, lines: block.body });
    }
    return out;
  }

  /** The `### Task N:` blocks in document order, with their field + step surfaces. */
  protected taskBlocks(blocks: readonly HeadingBlock[]): TaskBlock[] {
    const out: TaskBlock[] = [];
    for (const block of blocks) {
      const match = block.heading.match(/^### Task (\d+):/);
      if (match === null) continue;
      const fields = this.parseTaskFields(block.body);
      const stepsField = fields.find((field) => field.key === "Steps");
      out.push({
        id: Number(match[1]),
        heading: block.heading,
        fields,
        steps: this.parseSteps(stepsField),
      });
    }
    return out;
  }

  /** Parse a task block's body into keyed fields. */
  protected parseTaskFields(body: readonly string[]): TaskField[] {
    const fields: TaskField[] = [];
    let openKey: string | null = null;
    let openLines: string[] = [];
    const close = (): void => {
      if (openKey !== null) fields.push({ key: openKey, lines: openLines });
      openKey = null;
      openLines = [];
    };
    for (const line of body) {
      const fieldMarker = line.match(/^-\s+\*\*([A-Za-z ]+)\*\*:\s*(.*)$/);
      if (fieldMarker !== null) {
        close();
        openKey = fieldMarker[1];
        openLines = [fieldMarker[2].trim()];
      } else if (openKey !== null && line.trim().length > 0) {
        openLines.push(line.trim());
      }
    }
    close();
    return fields;
  }

  /** Parse a `**Steps**` field's value lines into step records. */
  protected parseSteps(field: TaskField | undefined): TaskStep[] {
    if (field === undefined) return [];
    const steps: TaskStep[] = [];
    for (const line of field.lines) {
      const bullet = line.match(/^-\s+(.*)$/);
      if (bullet === null) continue;
      const text = bullet[1];
      const checkableMarker = text.indexOf("— checkable:");
      if (checkableMarker === -1) {
        steps.push({ action: text, checkable: null });
      } else {
        steps.push({
          action: text.slice(0, checkableMarker).trim(),
          checkable: text.slice(checkableMarker + "— checkable:".length).trim(),
        });
      }
    }
    return steps;
  }

  /** Parse a section's table: the column-header row + the data rows. */
  protected parseTable(lines: readonly string[]): ParsedTable {
    const rows: string[][] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) continue;
      if (/^\|[\s:|-]+\|$/.test(trimmed)) continue; // separator row
      rows.push(
        trimmed
          .split("|")
          .slice(1, -1)
          .map((cell) => cell.trim()),
      );
    }
    const headerRow = rows.length > 0 ? rows[0] : null;
    return { heading: "", headerRow, rows: rows.slice(1) };
  }

  /** The data rows of a table section — the non-separator `|…|` lines. */
  protected tableRows(lines: readonly string[]): readonly string[][] {
    return this.parseTable(lines).rows;
  }

  /** The `[label](target)` pairs parsed from one line. */
  protected linksOnLine(line: string): readonly ChainLink[] {
    const links: ChainLink[] = [];
    const linkPattern = /\[([^\]]*)\]\(([^)]+)\)/g;
    for (const match of line.matchAll(linkPattern)) {
      links.push({ label: match[1], target: match[2] });
    }
    return links;
  }

  /** The `v<major>.<minor>` tokens on one line. */
  protected versionTokens(line: string): readonly string[] {
    const tokens: string[] = [];
    const tokenPattern = /v\d+\.\d+/g;
    for (const match of line.matchAll(tokenPattern)) tokens.push(match[0]);
    return tokens;
  }

  /** The first `**Marker**:`-style header line by its literal marker. */
  protected markerLine(lines: readonly string[], marker: string): string | null {
    for (const line of lines) if (line.includes(marker)) return line;
    return null;
  }

  /** The value token of a `- **Key**: <value>` header line (the text after the marker). */
  protected markerValue(line: string, marker: string): string {
    const markerIndex = line.indexOf(marker);
    if (markerIndex === -1) return "";
    const payload = line.slice(markerIndex + marker.length).trim();
    return payload.replace(/^:\s*/, "").trim();
  }

  /** The line number (1-indexed) the anchor first occurs on, or -1. */
  protected indexOfLine(lines: readonly string[], text: string): number {
    const index = lines.findIndex((line) => line.includes(text));
    return index === -1 ? -1 : index + 1;
  }

  /** The slice of one registered anchor (undefined when the anchor is not registered here). */
  protected sliceOf(anchor: string): ElementSlice | undefined {
    return this.#slicesByAnchor.get(anchor);
  }

  /** Whether a heading line conforms to a declared heading anchor's value shape. */
  protected sectionConforms(heading: string, anchor: string): boolean {
    const slice = this.#slicesByAnchor.get(anchor);
    if (slice?.valuePattern !== undefined) return slice.valuePattern.test(heading);
    return heading.startsWith(anchor);
  }

  protected headingRank(line: string): HeadingRank | null {
    const match = line.match(/^(#+)\s/);
    if (match === null) return null;
    const rank = match[1].length as HeadingRank;
    return rank <= 4 ? rank : null;
  }
}

// ---------------------------------------------------------------------------
// the three concrete doc types
// ---------------------------------------------------------------------------

/**
 * The overall doc type — parses the header, the four tables and the dependency
 * graph, and exposes the Phase-inventory rows as the chain's anchor set.
 */
export class OverallDocType extends DocType<OverallParsed> {
  readonly docTypeName = "overall" as const;

  parse(lines: readonly string[]): OverallParsed {
    const title = lines[0] ?? "";
    const blocks = this.headingBlocks(lines);
    const headerLines = this.headerLines(blocks);
    const sections = this.sections(blocks);

    const tables: OverallParsed["tables"] = {
      "File paths": this.#tableSection(sections, "## File paths"),
      "Issue inventory": this.#tableSection(sections, "## Issue inventory"),
      "Phase inventory": this.#tableSection(sections, "## Phase inventory"),
      "Change history": this.#tableSection(sections, "## Change history"),
    };
    const graphEdges = this.#graphEdges(sections);
    const phases = this.#phaseRows(tables["Phase inventory"]);
    return {
      docType: "overall",
      title,
      headerLines,
      sections,
      tables,
      graphEdges,
      chain: {
        docType: "overall",
        parentLink: null,
        specLink: null,
        parentTokens: [],
        phases,
        dependsOn: null,
      },
    };
  }

  /** The `## Dependency graph` edge lines, parsed into from/to tokens. */
  #graphEdges(sections: readonly SectionBlock[]): GraphEdge[] {
    for (const section of sections) {
      if (!this.sectionConforms(section.heading, "## Dependency graph")) continue;
      const edges: GraphEdge[] = [];
      const edgePattern = /^P(\d+(?:\.\d+)*)\s*->\s*P(\d+(?:\.\d+)*)$/;
      for (const line of section.lines) {
        const trimmed = line.trim();
        const match = trimmed.match(edgePattern);
        if (match !== null) edges.push({ text: trimmed, from: `P${match[1]}`, to: `P${match[2]}` });
      }
      return edges;
    }
    return [];
  }

  /** The Phase-inventory rows as chain phases — header-driven column mapping. */
  #phaseRows(table: ParsedTable): ChainPhase[] {
    if (table.headerRow === null) return [];
    const columns = new Map<string, number>();
    for (let index = 0; index < table.headerRow.length; index++) {
      columns.set(table.headerRow[index].toLowerCase(), index);
    }
    const phaseIdx = columns.get("phase");
    const designIdx = columns.get("design spec");
    const planIdx = columns.get("implementation plan");
    const dependencyIdx = columns.get("dependency");
    if (phaseIdx === undefined) return [];
    const phases: ChainPhase[] = [];
    for (const row of table.rows) {
      const id = row[phaseIdx]?.trim() ?? "";
      if (id === "") continue;
      phases.push({
        id,
        designCell: designIdx !== undefined ? (row[designIdx] ?? "") : "",
        planCell: planIdx !== undefined ? (row[planIdx] ?? "") : "",
        dependencyCell: dependencyIdx !== undefined ? (row[dependencyIdx] ?? "") : "",
      });
    }
    return phases;
  }

  /** The parsed table of one overall table section (empty when the section is absent). */
  #tableSection(sections: readonly SectionBlock[], heading: string): ParsedTable {
    for (const section of sections) {
      if (this.sectionConforms(section.heading, heading)) {
        const table = this.parseTable(section.lines);
        return { heading: section.heading, headerRow: table.headerRow, rows: table.rows };
      }
    }
    return { heading: "", headerRow: null, rows: [] };
  }
}

/**
 * The plan doc type — parses the header (Class-A `**Spec:**` + Class-B parent
 * lineage) and the `### Task N:` task blocks.
 */
export class PlanDocType extends DocType<PlanParsed> {
  readonly docTypeName = "plan" as const;

  parse(lines: readonly string[]): PlanParsed {
    const title = lines[0] ?? "";
    const blocks = this.headingBlocks(lines);
    const headerLines = this.headerLines(blocks);
    return {
      docType: "plan",
      title,
      headerLines,
      sections: this.sections(blocks),
      taskBlocks: this.taskBlocks(blocks),
      chain: this.chainRoot(headerLines),
    };
  }

  /** The plan's cross-doc chain root: Class-A `**Spec:**` + Class-B `**Parent program**`. */
  chainRoot(headerLines: readonly string[]): ChainRoot {
    const specLine = this.markerLine(headerLines, "**Spec:**");
    const specLinks = specLine === null ? [] : this.linksOnLine(specLine);
    const parentLine = this.markerLine(headerLines, "**Parent program**");
    const parentLinks = parentLine === null ? [] : this.linksOnLine(parentLine);
    const dependsOnLine = this.markerLine(headerLines, "**Depends on**");
    return {
      docType: "plan",
      parentLink: parentLinks.length > 0 ? parentLinks[0] : null,
      specLink: specLinks.length > 0 ? specLinks[0] : null,
      parentTokens: parentLine === null ? [] : this.versionTokens(parentLine),
      phases: [],
      dependsOn: dependsOnLine === null ? null : this.markerValue(dependsOnLine, "**Depends on**"),
    };
  }
}

/**
 * The phase-spec doc type — parses the header five-tuple surface and the
 * `## Design` double-layer skeleton (groups + items).
 */
export class PhaseSpecDocType extends DocType<PhaseSpecParsed> {
  readonly docTypeName = "phase-spec" as const;

  parse(lines: readonly string[]): PhaseSpecParsed {
    const title = lines[0] ?? "";
    const blocks = this.headingBlocks(lines);
    const headerLines = this.headerLines(blocks);
    return {
      docType: "phase-spec",
      title,
      headerLines,
      sections: this.sections(blocks),
      design: this.designFromBlocks(blocks),
      chain: this.chainRoot(headerLines),
    };
  }

  /** The design double-layer skeleton — the `### N.` groups + their `#### N.M` items
   *  between the `## Design` section and the next rank-2 heading. */
  designFromBlocks(blocks: readonly HeadingBlock[]): DesignGroup[] {
    const groups: DesignGroup[] = [];
    let openNumber: string | null = null;
    let openHeading = "";
    let openItems: DesignItem[] = [];
    let inDesign = false;
    const close = (): void => {
      if (openNumber !== null) {
        groups.push({ number: openNumber, heading: openHeading, items: openItems });
      }
      openNumber = null;
      openHeading = "";
      openItems = [];
    };
    for (const block of blocks) {
      const rank = this.headingRank(block.heading);
      if (rank === 2) {
        if (inDesign) break;
        if (this.sectionConforms(block.heading, "## Design")) inDesign = true;
        continue;
      }
      if (!inDesign || (rank !== 3 && rank !== 4)) continue;
      const groupMatch = block.heading.match(/^### (\d+)\.\s+(.*)$/);
      if (groupMatch !== null) {
        close();
        openNumber = groupMatch[1];
        openHeading = groupMatch[2];
        continue;
      }
      const itemMatch = block.heading.match(/^#### (\d+)\.(\d+)\s+(.*)$/);
      if (itemMatch !== null && openNumber !== null) {
        openItems.push({ number: `${itemMatch[1]}.${itemMatch[2]}`, heading: itemMatch[3] });
      }
    }
    close();
    return groups;
  }

  /** The phase-spec's cross-doc chain root: the Class-B `**Parent program**` lineage. */
  chainRoot(headerLines: readonly string[]): ChainRoot {
    const parentLine = this.markerLine(headerLines, "**Parent program**");
    const parentLinks = parentLine === null ? [] : this.linksOnLine(parentLine);
    const dependsOnLine = this.markerLine(headerLines, "**Depends on**");
    return {
      docType: "phase-spec",
      parentLink: parentLinks.length > 0 ? parentLinks[0] : null,
      specLink: null,
      parentTokens: parentLine === null ? [] : this.versionTokens(parentLine),
      phases: [],
      dependsOn: dependsOnLine === null ? null : this.markerValue(dependsOnLine, "**Depends on**"),
    };
  }
}

// ---------------------------------------------------------------------------
// composition root — the three parsers by doc-key
// ---------------------------------------------------------------------------

/** The composed doc-type parsers — the judge's ctx-loading parsers (one per doc key). */
export const docTypeParsers: Record<DocKey, DocType<ParsedDoc>> = {
  overall: new OverallDocType("overall"),
  plan: new PlanDocType("plan"),
  phaseSpec: new PhaseSpecDocType("phaseSpec"),
};
