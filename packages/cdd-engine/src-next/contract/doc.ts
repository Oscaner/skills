// packages/cdd-engine/src-next/contract/doc.ts
// T4 — the contract plane's parse face (design spec §2.2: the DocType classes are
// pared down to parse + projection consumption + the cross-doc chain root; zero
// judgment methods on the class face).
//
// The four DocType classes own exactly three surfaces:
//   · parse          — structural extraction: overall → the four tables (File paths /
//                      Issue inventory / Phase inventory / Change history) + the
//                      dependency-graph edge lines; plan → the `### Task N:` blocks
//                      and their fields; phase-spec → the `## Design` double-layer
//                      skeleton (groups + items). The WHICH — which headings are
//                      sections, which lines are table rows, which lines are the
//                      declared column header — comes from the home extractors over
//                      the registry's declared anchors (home-extractors.ts, spec
//                      §3.2); this face only walks the resulting structure. Nothing
//                      is decided here — parse extracts, the invariant family judges.
//   · projection     — each class consumes the derived projection face (project.ts):
//                      the slices (parse regexes) and the shape (section skeleton) of
//                      its own doc type are the locating data every extraction walks.
//   · chain root     — the chain anchors of the document (the phase-spec head
//                      scalars `program:` / `parent-version:` and the overall's
//                      Phase-inventory rows as the chain's anchor set) are extracted
//                      into a ChainRoot and LEFT as an interface — the resolution
//                      judgment belongs to the cross-doc-chain / slug-ref
//                      invariants, never to a DocType method. A plan carries no
//                      chain key: its ownership chain is implied by the identity
//                      document sharing its `slug:` (zero second declaration).
//
// Module-level exports are types / the class family / one composition root — zero
// behavior-carrying bare functions (the plan's zero-bare-function discipline).

import type { ElementRegistry } from "./declare.ts";
import { declaredRegistries } from "./declare.ts";
import type { FrontMatterHead } from "./frontmatter.ts";
import type { ExtractionMap } from "./home-extractors.ts";
import {
  DesignBodyExtractor,
  GraphExtractor,
  HeadingScanner,
  TableExtractor,
  TaskExtractor,
} from "./home-extractors.ts";
import type { DocKey, DocShape, DocSlices, ElementSlice } from "./project.ts";
import { Projector } from "./project.ts";

/** The projection carrier — one Projector instance over the declared registries,
 *  shared by the four parser classes (each binds its own doc-type faces). */
const projector = new Projector(declaredRegistries);

/** The home-driven extractors — the fixed structure rules of the task / design /
 *  graph / table / section homes (spec §3.2), shared by the parsers that read
 *  those surfaces. */
const taskExtractor = new TaskExtractor();
const designExtractor = new DesignBodyExtractor();
const graphExtractor = new GraphExtractor();
const tableExtractor = new TableExtractor();
const headingScanner = new HeadingScanner();

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
  /** The Design-spec cell text (link tokens, e.g. a spec-root link under the
   *  declared spec doc root — `[P2-design](<spec-root>/x-design.md)`). */
  designCell: string;
  /** The Implementation-plan cell text (link tokens, e.g. a plan-root link under
   *  the declared plan doc root — `[plan](<plan-root>/x.md)`). */
  planCell: string;
  /** The Dependency cell text (e.g. "P1 -> P2"). */
  dependencyCell: string;
}

/** A `[text](target)` link parsed from a line — only the target surfaces: the
 *  link-text face retired with the front-matter flip (the chain root reads the
 *  head scalars, and the drift judgments are gone — zero consumer ever reads the
 *  text part). */
export interface ChainLink {
  /** The link's target path. */
  target: string;
}

/**
 * The cross-doc chain root — the anchors a document carries, read from the
 * front-matter head scalars (the §2.3 key set: `program:` · `parent-version:`),
 * plus the overall's Phase-inventory rows. Extracted and LEFT as
 * an interface — every resolution judgment (slug-target existence, version-token
 * lineage membership) belongs to the cross-doc-chain / slug-ref invariants, never
 * to a DocType method.
 */
export interface ChainRoot {
  /** The doc-type identity of the chain root's document. */
  docType: DocKey;
  /** The `program:` slug reference (phase-spec only) — the parent overall's
   *  `slug:` value, never a path; null for every other doc type. */
  programLink: ChainLink | null;
  /** The version tokens carried on the `parent-version:` key (the lineage of the
   *  program the `program:` reference names). */
  parentTokens: readonly string[];
  /** The overall's phase-inventory rows — the chain's anchor set (overall only). */
  phases: readonly ChainPhase[];
}

/** The overall parse record — the four tables, the graph edges and the chain root. */
export interface OverallParsed {
  docType: "overall-spec";
  /** The document's front-matter head — the typed head record (the §2.3 key set),
   *  or null when parsed without one (every producer that reads the chain face MUST
   *  parse dual-param — a head-less parse reads a null chain root). */
  head: FrontMatterHead | null;
  /** The document title — the front-matter `title:` scalar ("" without a head). */
  title: string;
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
  /** The document's front-matter head, or null when parsed without one. */
  head: FrontMatterHead | null;
  /** The document title — the front-matter `title:` scalar ("" without a head). */
  title: string;
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
  /** The document's front-matter head, or null when parsed without one. */
  head: FrontMatterHead | null;
  /** The document title — the front-matter `title:` scalar ("" without a head). */
  title: string;
  sections: readonly SectionBlock[];
  /** The `## Design` double-layer skeleton (groups + items), when the section is present. */
  design: readonly DesignGroup[];
  chain: ChainRoot;
}

/** The single-spec parse record — the header five-tuple and the prose section surface. */
export interface SingleSpecParsed {
  docType: "single-spec";
  /** The document's front-matter head, or null when parsed without one. */
  head: FrontMatterHead | null;
  /** The document title — the front-matter `title:` scalar ("" without a head). */
  title: string;
  sections: readonly SectionBlock[];
  chain: ChainRoot;
}

/** The parsed-document union — one record per doc type. */
export type ParsedDoc = OverallParsed | PlanParsed | PhaseSpecParsed | SingleSpecParsed;

// ---------------------------------------------------------------------------
// the shared markdown primitives — one home for the link/token/table-row parsers
// ---------------------------------------------------------------------------

/**
 * The shared extraction primitives: `[text](target)` links, `v<n>.<m>` version
 * tokens and `|…|` table-row parsing. Both the parse face (DocType) and the
 * judgment face (the Invariant base in invariants.ts) extend this base — the
 * link/token/table parse logic lives in exactly one place of the new tree. The
 * version-token grammar additionally exposes the public static `versionTokensOf`
 * — the board's header-fact read (face/board-view.ts) reads the SAME grammar
 * through it (one home, zero dual-write).
 */
export abstract class MarkdownPrimitives {
  /** The `[text](target)` pairs parsed from one line — the target only (the
   *  retired link-text face; the remaining consumers — the overall's phase-cell
   *  links — resolve targets, never the text). */
  protected linksOnLine(line: string): readonly ChainLink[] {
    const links: ChainLink[] = [];
    const linkPattern = /\[([^\]]*)\]\(([^)]+)\)/g;
    for (const match of line.matchAll(linkPattern)) {
      links.push({ target: match[2] });
    }
    return links;
  }

  /** The `v<major>.<minor>` tokens on one line — the version-token grammar's ONE
   *  home of the tree: the face plane's doc-line BLOCK token reads this public
   *  static; the subclasses keep the protected accessor below (a thin delegation,
   *  zero second grammar). */
  static versionTokensOf(line: string): readonly string[] {
    const tokens: string[] = [];
    const tokenPattern = /v\d+\.\d+/g;
    for (const match of line.matchAll(tokenPattern)) tokens.push(match[0]);
    return tokens;
  }

  /** The `v<major>.<minor>` tokens on one line — the class-family accessor
   *  (the grammar itself is the static — one home). */
  protected versionTokens(line: string): readonly string[] {
    return MarkdownPrimitives.versionTokensOf(line);
  }

  /** The cells of one `|…|` table line (trimmed, wrapper bars excluded); null for a
   *  non-table line or a separator row. The separator-row rule is the
   *  TableExtractor's (the table home's fixed structure rule — one home). */
  protected tableRowCells(line: string): readonly string[] | null {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return null;
    if (TableExtractor.isSeparatorRow(trimmed)) return null;
    return trimmed
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
  }

  /** The non-separator `|…|` rows of a line run (the first row is the column
   *  header). The table-line / separator recognition is the TableExtractor's
   *  table-home rule; this method only splits the recognized rows into cells. */
  protected tableRows(lines: readonly string[]): readonly string[][] {
    const rows: string[][] = [];
    for (const line of tableExtractor.tableLinesOf(lines)) {
      const cells = this.tableRowCells(line);
      if (cells !== null) rows.push([...cells]);
    }
    return rows;
  }
}

// ---------------------------------------------------------------------------
// the DocType base — parse + projection consumption + chain root
// ---------------------------------------------------------------------------

/**
 * The abstract doc-type base. Each subclass binds its registry-derived projection
 * face (slices + shape) and implements parse — pure structural extraction into a
 * typed record. The base carries the shared extraction primitives (heading blocks,
 * table rows, header lines, `[text](target)` link parsing) as class methods: the
 * class face stays judgment-free (zero validate/audit/detect methods).
 */
export abstract class DocType<P extends ParsedDoc> extends MarkdownPrimitives {
  /** The doc-type record key — the projection-face identity. */
  readonly key: DocKey;
  /** The declared registry of this doc type — the extractors read their anchor
   *  rosters from it (the registry stays the single knowledge source). */
  readonly registry: ElementRegistry;
  /** The derived parse face (per-element anchor slices) of this doc type. */
  readonly slices: DocSlices;
  /** The derived section skeleton (shape projection) of this doc type. */
  readonly shape: DocShape;
  /** The doc-type name as carried by a conforming document's parse record. */
  abstract readonly docTypeName: DocKey;

  /** The per-anchor slice lookup — the parse face's locating patterns. */
  readonly #slicesByAnchor: ReadonlyMap<string, ElementSlice>;

  constructor(key: DocKey) {
    super();
    this.key = key;
    this.registry = declaredRegistries[key];
    this.slices = projector.slices()[key];
    this.shape = projector.shape()[key];
    this.#slicesByAnchor = new Map(this.slices.slices.map((slice) => [slice.anchor, slice]));
  }

  /** The pure structural parse — what the invariants and the graph read. The head
   *  is the typed front-matter head (the §2.2 delivery seam: the chain-docs
   *  producers MUST parse dual-param, so the chain root reads the head scalars — a
   *  single-param parse yields the null-head face: title "" and a null chain). */
  abstract parse(lines: readonly string[], head?: FrontMatterHead | null): P;

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

  /** The rank-2 section blocks in document order — the HeadingScanner's section
   *  walk over the registry's declared section anchors (spec §3.2: WHICH rank-2
   *  headings are sections comes from the registry, never a second hand-written
   *  filter here). An undeclared prose rank-2 heading is not a section, and a
   *  declared conditional `##` heading is one. */
  protected sections(lines: readonly string[]): SectionBlock[] {
    return headingScanner.sectionsOf(this.registry, lines);
  }

  /** The `### Task N:` blocks in document order, with their field + step surfaces.
   *  The block-head / field-marker / step-line grammars live in the TaskExtractor
   *  (the task home's fixed structure rules over the registry's declared anchors):
   *  each block is extracted over its own lines, so the extractor's own scoping
   *  (the fields, and the steps riding inside the `**Steps**` field) yields that
   *  block's occurrence buckets directly — step recognition never re-appears here. */
  protected taskBlocks(blocks: readonly HeadingBlock[]): TaskBlock[] {
    const out: TaskBlock[] = [];
    for (const block of blocks) {
      const lines = [block.heading, ...block.body];
      const extracted = taskExtractor.extract(this.registry, lines);
      const headings = extracted["### Task N:"] ?? [];
      if (headings.length === 0) continue;
      const ids = extracted["Task id token"] ?? [];
      const id = Number(ids[0] ?? "");
      if (Number.isNaN(id)) continue;
      const fields = this.#taskFieldsOf(block.body, this.#taskFieldMarkers(extracted));
      out.push({
        id,
        heading: block.heading,
        fields,
        steps: this.#taskStepsOf(
          extracted["Step action"] ?? [],
          new Set(extracted["Step checkable"] ?? []),
        ),
      });
    }
    return out;
  }

  /** The task-field anchor lookup — each declared field anchor's marker line maps
   *  to its anchor (the retired per-anchor field grammar collapses to one map). */
  #taskFieldMarkers(extracted: ExtractionMap): ReadonlyMap<string, string> {
    const markers = new Map<string, string>();
    for (const [anchor, lines] of Object.entries(extracted)) {
      if (!anchor.startsWith("**")) continue;
      for (const line of lines) markers.set(line, anchor);
    }
    return markers;
  }

  /** Parse a task block's body into keyed fields — the marker membership comes
   *  from the extractor's field-anchor map; the remainder and continuation
   *  handling mirror the retired grammar's behavior exactly. */
  #taskFieldsOf(body: readonly string[], markers: ReadonlyMap<string, string>): TaskField[] {
    const fields: TaskField[] = [];
    let openKey: string | null = null;
    let openLines: string[] = [];
    const close = (): void => {
      if (openKey !== null) fields.push({ key: openKey, lines: openLines });
      openKey = null;
      openLines = [];
    };
    for (const line of body) {
      const anchor = markers.get(line);
      if (anchor !== undefined) {
        close();
        openKey = anchor.slice(2, -2);
        openLines = [line.slice(`- ${anchor}:`.length).trim()];
      } else if (openKey !== null && line.trim().length > 0) {
        openLines.push(line.trim());
      }
    }
    close();
    return fields;
  }

  /** Parse a block's recognized step lines into step records — the lines come
   *  from the extractor's `Step action` bucket (the registry's `^- ` shape, so
   *  no `- `-bullet re-recognition here); the action cell is a value read after
   *  the anchor's bullet prefix (mirroring the `#taskIdOf` slot read), and
   *  membership in the `Step checkable` bucket marks which lines carry a
   *  verbatim `— checkable:` clause that the split then reads off. */
  #taskStepsOf(stepLines: readonly string[], checkableLines: ReadonlySet<string>): TaskStep[] {
    const steps: TaskStep[] = [];
    for (const line of stepLines) {
      const text = line.trim().slice(2).trim();
      const checkableMarker = checkableLines.has(line) ? text.indexOf("— checkable:") : -1;
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

  /** Parse a section's table: the column-header row + the data rows. The header
   *  row is the one the registry's `… columns` anchors claim (the TableExtractor's
   *  declared-home set); a table with no registered column anchor falls back to
   *  the first row, the shape's positional default. The data rows are every
   *  remaining row plus any leading row ahead of the declared header — a
   *  mispositioned header never silently drops a data row. */
  protected parseTable(lines: readonly string[]): ParsedTable {
    const rows = this.tableRows(lines);
    const declaredHeader = tableExtractor.headerLineOf(this.registry, lines);
    if (declaredHeader === null) {
      const headerRow = rows.length > 0 ? rows[0] : null;
      return { heading: "", headerRow, rows: rows.slice(1) };
    }
    const headerCells = this.tableRowCells(declaredHeader);
    const dataRows = rows.filter((row) => row.join("|") !== (headerCells ?? []).join("|"));
    return { heading: "", headerRow: headerCells, rows: dataRows };
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
// the four concrete doc types
// ---------------------------------------------------------------------------

/**
 * The overall doc type — parses the header, the four tables and the dependency
 * graph, and exposes the Phase-inventory rows as the chain's anchor set.
 */
export class OverallDocType extends DocType<OverallParsed> {
  readonly docTypeName = "overall-spec" as const;

  parse(lines: readonly string[], head: FrontMatterHead | null = null): OverallParsed {
    const title = head?.title ?? "";
    const sections = this.sections(lines);

    const tables: OverallParsed["tables"] = {
      "File paths": this.#tableSection(sections, "## File paths"),
      "Issue inventory": this.#tableSection(sections, "## Issue inventory"),
      "Phase inventory": this.#tableSection(sections, "## Phase inventory"),
      "Change history": this.#tableSection(sections, "## Change history"),
    };
    const graphEdges = this.#graphEdges(sections);
    const phases = this.#phaseRows(tables["Phase inventory"]);
    return {
      docType: "overall-spec",
      head,
      title,
      sections,
      tables,
      graphEdges,
      chain: {
        docType: "overall-spec",
        programLink: null,
        parentTokens: [],
        phases,
      },
    };
  }

  /** The `## Dependency graph` edge lines — the graph-home occurrence map (the
   *  declared Hard/Soft edge anchors) identified by the extractor; the from/to
   *  token grammar stays the preserved graph-edge primitive. */
  #graphEdges(sections: readonly SectionBlock[]): GraphEdge[] {
    for (const section of sections) {
      if (!this.sectionConforms(section.heading, "## Dependency graph")) continue;
      const extracted = graphExtractor.extract(this.registry, section.lines);
      const edgeLines = new Set<string>([
        ...(extracted["Hard edge"] ?? []),
        ...(extracted["Soft edge"] ?? []),
      ]);
      const edges: GraphEdge[] = [];
      const edgePattern = /^P(\d+(?:\.\d+)*)\s*->\s*P(\d+(?:\.\d+)*)$/;
      for (const line of section.lines) {
        const trimmed = line.trim();
        if (!edgeLines.has(trimmed)) continue;
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
    const designIdx = columns.get("design spec");
    const planIdx = columns.get("implementation plan");
    const dependencyIdx = columns.get("dependency");
    if (columns.get("phase") === undefined) return [];
    const phases: ChainPhase[] = [];
    for (const row of table.rows) {
      const id = this.#phaseId(row);
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

  /** The phase id of a Phase-inventory data row — the cell carrying a phase-id
   *  token (the token shape judged through the declared `Phase id token` value
   *  pattern — the retired literal grammar now sourced from the registry). */
  #phaseId(row: readonly string[]): string {
    const pattern = this.sliceOf("Phase id token")?.valuePattern;
    const idCell = row.find((cell) => pattern?.test(cell.trim()) === true);
    return idCell === undefined ? "" : idCell.trim();
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
 * The plan doc type — parses the head and the `### Task N:` task blocks. A plan
 * carries no chain key of its own: its ownership chain is implied by the identity
 * document sharing its `slug:` (the same-slug Class-A arm).
 */
export class PlanDocType extends DocType<PlanParsed> {
  readonly docTypeName = "plan" as const;

  parse(lines: readonly string[], head: FrontMatterHead | null = null): PlanParsed {
    const title = head?.title ?? "";
    const blocks = this.headingBlocks(lines);
    return {
      docType: "plan",
      head,
      title,
      sections: this.sections(lines),
      taskBlocks: this.taskBlocks(blocks),
      chain: this.chainRoot(head),
    };
  }

  /** The plan's cross-doc chain root — the degraded face: the plan declares no
   *  parent/spec key (the same-slug identity document is its chain), so it carries
   *  no chain anchor at all. */
  chainRoot(_head: FrontMatterHead | null): ChainRoot {
    return {
      docType: "plan",
      programLink: null,
      parentTokens: [],
      phases: [],
    };
  }
}

/**
 * The phase-spec doc type — parses the header five-tuple surface and the
 * `## Design` double-layer skeleton (groups + items).
 */
export class PhaseSpecDocType extends DocType<PhaseSpecParsed> {
  readonly docTypeName = "phase-spec" as const;

  parse(lines: readonly string[], head: FrontMatterHead | null = null): PhaseSpecParsed {
    const title = head?.title ?? "";
    const blocks = this.headingBlocks(lines);
    return {
      docType: "phase-spec",
      head,
      title,
      sections: this.sections(lines),
      design: this.designFromBlocks(blocks),
      chain: this.chainRoot(head),
    };
  }

  /** The design double-layer skeleton — the `### N.` groups + their `#### N.M`
   *  items between the `## Design` section and the next rank-2 heading. The
   *  numbered-heading grammars (and their number/text decomposition) live in the
   *  DesignBodyExtractor; this method walks the declared groups/items from its
   *  occurrence map. */
  designFromBlocks(blocks: readonly HeadingBlock[]): DesignGroup[] {
    const lines = blocks.flatMap((block) => [block.heading, ...block.body]);
    const extracted = designExtractor.extract(this.registry, lines);
    const designHeadings = new Set(extracted["## Design"] ?? []);
    const groupHeadings = new Set(extracted["### N. group heading"] ?? []);
    const itemHeadings = new Set(extracted["#### N.M item heading"] ?? []);
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
        if (designHeadings.has(block.heading)) inDesign = true;
        continue;
      }
      if (!inDesign || (rank !== 3 && rank !== 4)) continue;
      if (groupHeadings.has(block.heading)) {
        close();
        const group = designExtractor.groupOf(block.heading);
        openNumber = group.number;
        openHeading = group.heading;
        continue;
      }
      if (openNumber !== null && itemHeadings.has(block.heading)) {
        openItems.push(designExtractor.itemOf(block.heading));
      }
    }
    close();
    return groups;
  }

  /** The phase-spec's cross-doc chain root: the `program:` slug reference plus the
   *  `parent-version:` lineage tokens. The reference is a SLUG (the parent
   *  overall's `slug:`), so it never rides the file-path resolution faces. */
  chainRoot(head: FrontMatterHead | null): ChainRoot {
    return {
      docType: "phase-spec",
      programLink: head === null || head.program === null ? null : { target: head.program },
      parentTokens: head === null || head.parentVersion === null ? [] : [head.parentVersion],
      phases: [],
    };
  }
}

/**
 * The single-spec doc type — parses the header five-tuple surface and the prose
 * section surface. A single-spec carries no parent overall and no `### N.`
 * design outline, so the parse degrades the chain root to its null-link face
 * (no chain anchor rides the head).
 */
export class SingleSpecDocType extends DocType<SingleSpecParsed> {
  readonly docTypeName = "single-spec" as const;

  parse(lines: readonly string[], head: FrontMatterHead | null = null): SingleSpecParsed {
    const title = head?.title ?? "";
    return {
      docType: "single-spec",
      head,
      title,
      sections: this.sections(lines),
      chain: this.chainRoot(head),
    };
  }

  /** The single-spec chain root — the degraded face: no program link and no
   *  lineage token (the independent-program shape). */
  chainRoot(_head: FrontMatterHead | null): ChainRoot {
    return {
      docType: "single-spec",
      programLink: null,
      parentTokens: [],
      phases: [],
    };
  }
}

// ---------------------------------------------------------------------------
// composition root — the four parsers by doc-key
// ---------------------------------------------------------------------------

/** The composed doc-type parsers — the judge's ctx-loading parsers (one per doc key). */
export const docTypeParsers: Record<DocKey, DocType<ParsedDoc>> = {
  "overall-spec": new OverallDocType("overall-spec"),
  plan: new PlanDocType("plan"),
  "phase-spec": new PhaseSpecDocType("phase-spec"),
  "single-spec": new SingleSpecDocType("single-spec"),
};
