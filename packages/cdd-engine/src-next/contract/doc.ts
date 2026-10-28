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
import { DesignBodyExtractor, HeadingScanner } from "./home-extractors.ts";
import type { Selector } from "./markdown-tree.ts";
import { MarkdownTree } from "./markdown-tree.ts";
import type { DocKey, DocShape, DocSlices, ElementSlice } from "./project.ts";
import { Projector } from "./project.ts";
import type { TaskBlock } from "./task-blocks.ts";

/** The projection carrier — one Projector instance over the declared registries,
 *  shared by the four parser classes (each binds its own doc-type faces). */
const projector = new Projector(declaredRegistries);

/** The home-driven extractors — the fixed structure rules of the design / section
 *  homes (spec §3.2), shared by the parsers that read those surfaces. */
const designExtractor = new DesignBodyExtractor();
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
  docType: "overall";
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

export type { TaskBlock, TaskField, TaskStep } from "./task-blocks.ts";

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
  /** The parsed change-history table (the shared lineage read face all four doc
   *  types expose — empty when the section is absent). */
  tables: { "Change history": ParsedTable };
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
  /** The parsed change-history table (the shared lineage read face all four doc
   *  types expose — empty when the section is absent). */
  tables: { "Change history": ParsedTable };
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
  /** The parsed change-history table (the shared lineage read face all four doc
   *  types expose — empty when the section is absent). */
  tables: { "Change history": ParsedTable };
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
   *  single-param parse yields the null-head face: title "" and a null chain). The
   *  third parameter is the caller's already-built tree (one parse per document); a
   *  call without it builds the tree from the lines, so a consumer that already owns
   *  the tree never pays a second parse. */
  abstract parse(lines: readonly string[], head?: FrontMatterHead | null, tree?: MarkdownTree): P;

  // -------------------------------------------------------------------------
  // shared extraction primitives (parse-only, never judgment) — every one reads
  // the ONE markdown tree, never a raw line scan
  // -------------------------------------------------------------------------

  /** The document's tree — the caller's instance, or one built from the lines. */
  protected treeOf(lines: readonly string[], tree?: MarkdownTree): MarkdownTree {
    return tree ?? MarkdownTree.parse(lines.join("\n"));
  }

  /** The rank-2 section blocks in document order — the registry's declared section
   *  anchors decide WHICH `##` headings are sections (spec §3.2), read off the
   *  tree's section nodes. An undeclared prose rank-2 heading is not a section, and
   *  a declared conditional `##` heading is one. */
  protected sectionsOf(tree: MarkdownTree): SectionBlock[] {
    return [...headingScanner.sectionsOf(this.registry, tree)];
  }

  /** The `### Task N:` blocks in document order — the ONE block-structure parse
   *  face (the tree's `tasks()`, P21 §7). The parse normalizes the heading shape and
   *  the legacy bullet shape into one `TaskBlock` record, so the graph, the brief
   *  and the judging plane all read the same structure. */
  protected taskBlocksOf(tree: MarkdownTree): TaskBlock[] {
    return [...tree.tasks()];
  }

  /** The parsed table of one declared table section (empty when the section or its
   *  table is absent) — the ONE table-section read all four doc types expose (the
   *  overall's three tables and the shared `## Change history` lineage face ride
   *  it). The column header is the tree's first table row; the cells come from the
   *  mdast cell nodes (never a `|` split), so an escaped pipe stays inside its cell. */
  protected tableSection(tree: MarkdownTree, heading: string): ParsedTable {
    for (const section of this.sectionsOf(tree)) {
      if (!this.sectionConforms(section.heading, heading)) continue;
      const table = tree.tableUnder(section.heading);
      return {
        heading: section.heading,
        headerRow: table?.header ?? null,
        rows: table?.body.map((row) => [...row]) ?? [],
      };
    }
    return { heading: "", headerRow: null, rows: [] };
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
}

// ---------------------------------------------------------------------------
// the four concrete doc types
// ---------------------------------------------------------------------------

/**
 * The overall doc type — parses the header, the four tables and the dependency
 * graph, and exposes the Phase-inventory rows as the chain's anchor set.
 */
export class OverallDocType extends DocType<OverallParsed> {
  readonly docTypeName = "overall" as const;

  parse(
    lines: readonly string[],
    head: FrontMatterHead | null = null,
    tree?: MarkdownTree,
  ): OverallParsed {
    const document = this.treeOf(lines, tree);
    const title = head?.title ?? "";
    const sections = this.sectionsOf(document);

    const tables: OverallParsed["tables"] = {
      "File paths": this.tableSection(document, "## File paths"),
      "Issue inventory": this.tableSection(document, "## Issue inventory"),
      "Phase inventory": this.tableSection(document, "## Phase inventory"),
      "Change history": this.tableSection(document, "## Change history"),
    };
    const graphEdges: GraphEdge[] = document.edges().map((edge) => ({
      text: `${edge.from} -> ${edge.to}`,
      from: edge.from,
      to: edge.to,
    }));
    const phases = this.#phaseRows(tables["Phase inventory"]);
    return {
      docType: "overall",
      head,
      title,
      sections,
      tables,
      graphEdges,
      chain: {
        docType: "overall",
        programLink: null,
        parentTokens: [],
        phases,
      },
    };
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
}

/**
 * The plan doc type — parses the head and the `### Task N:` task blocks. A plan
 * carries no chain key of its own: its ownership chain is implied by the identity
 * document sharing its `slug:` (the same-slug Class-A arm).
 */
export class PlanDocType extends DocType<PlanParsed> {
  readonly docTypeName = "plan" as const;

  parse(
    lines: readonly string[],
    head: FrontMatterHead | null = null,
    tree?: MarkdownTree,
  ): PlanParsed {
    const document = this.treeOf(lines, tree);
    const title = head?.title ?? "";
    const sections = this.sectionsOf(document);
    return {
      docType: "plan",
      head,
      title,
      sections,
      taskBlocks: this.taskBlocksOf(document),
      tables: { "Change history": this.tableSection(document, "## Change history") },
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

  parse(
    lines: readonly string[],
    head: FrontMatterHead | null = null,
    tree?: MarkdownTree,
  ): PhaseSpecParsed {
    const document = this.treeOf(lines, tree);
    const title = head?.title ?? "";
    return {
      docType: "phase-spec",
      head,
      title,
      sections: this.sectionsOf(document),
      design: this.designOf(document),
      tables: { "Change history": this.tableSection(document, "## Change history") },
      chain: this.chainRoot(head),
    };
  }

  /** The design double-layer skeleton — the `### N.` groups + their `#### N.M`
   *  items of the `## Design` section, read off the tree's heading nodes through the
   *  registry's declared design-body selectors (WHICH headings are groups/items is
   *  declared data, never a hand-written grammar). The number/text decomposition
   *  stays the DesignBodyExtractor's (one home). */
  designOf(tree: MarkdownTree): DesignGroup[] {
    const head = this.#selectorOf("## Design");
    const groupSelector = this.#selectorOf("### N. group heading");
    const itemSelector = this.#selectorOf("#### N.M item heading");
    const design = head === undefined ? null : tree.resolve(head);
    if (design === null || groupSelector === undefined || itemSelector === undefined) return [];
    const groups: DesignGroup[] = [];
    let open: DesignGroup | null = null;
    for (const heading of tree.headings()) {
      if (heading.line <= design.line) continue;
      if (heading.depth === 2) break;
      if (tree.matches(groupSelector, heading.text)) {
        const group = designExtractor.groupOf(heading.text);
        open = { number: group.number, heading: group.heading, items: [] };
        groups.push(open);
        continue;
      }
      if (open !== null && tree.matches(itemSelector, heading.text)) {
        (open.items as DesignItem[]).push(designExtractor.itemOf(heading.text));
      }
    }
    return groups;
  }

  /** The declared selector of one registry anchor (undefined when unregistered). */
  #selectorOf(anchor: string): Selector | undefined {
    return this.registry.elements.find((element) => element.anchor === anchor)?.selector;
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

  parse(
    lines: readonly string[],
    head: FrontMatterHead | null = null,
    tree?: MarkdownTree,
  ): SingleSpecParsed {
    const document = this.treeOf(lines, tree);
    const title = head?.title ?? "";
    return {
      docType: "single-spec",
      head,
      title,
      sections: this.sectionsOf(document),
      tables: { "Change history": this.tableSection(document, "## Change history") },
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
  overall: new OverallDocType("overall"),
  plan: new PlanDocType("plan"),
  "phase-spec": new PhaseSpecDocType("phase-spec"),
  "single-spec": new SingleSpecDocType("single-spec"),
};
