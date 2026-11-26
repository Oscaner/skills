// packages/cdd-engine/src/docs/identity/doc-parse.ts
// The four parse faces: one class per document type, each extracting structure into a
// typed record and deciding nothing.
//
//   overall      → the four tables (File paths · Issue inventory · Phase inventory ·
//                  Change history) and the chain root's anchor set;
//   plan         → the `### Task N:` blocks and their reserved fields, plus the shared
//                  change register;
//   phase-spec   → the `## Design` double layer (groups + items) and the head's chain
//                  anchors;
//   single-spec  → the prose section surface and the degraded chain root.
//
// WHICH heading is a section, which line is a table row and which anchor a value belongs
// to all come from the declared registry (its anchors and value shapes) and from the
// projection's slice table — never from a hand-written grammar per document type. The
// classes therefore hold data and text reads only: a parse extracts, it never judges, and
// the judgments live in `docs/judging/**` (which this module does not import).
//
// `DocSyntaxError` is the parse face's own rejection: a structural break of a document's
// OWN grammar carries the anchored field, the message and the fix, so the judgment face
// materializes a finding from it without re-deriving any of the three from a string. The
// class is DECLARED in `grammar/doc-syntax.ts` — the grammar layer is its thrower — and
// re-exported here, so the parse face and the public surface keep one home for it.

import type { FrontMatter } from "../grammar/frontmatter.ts";
import type { MarkdownTree } from "../grammar/markdown-tree.ts";
import { TaskBlocks } from "../grammar/task-blocks.ts";
import type { TaskBlock } from "../grammar/types.ts";
import { type DocSlices, type ElementSlice, Projector } from "./project.ts";
import { declaredRegistries } from "./registry.ts";
import type { DocType, ElementLocation, ElementRegistry } from "./types.ts";

/** The projection carrier — one projector over the declared registries, shared by the
 *  four parsers (each binds its own document type's slice face). */
const projector = new Projector(declaredRegistries);

/** One markdown heading block — a heading line and the lines up to the next heading. */
export interface HeadingBlock {
  /** The heading line verbatim, leading `#`s included. */
  readonly heading: string;
  /** The heading's markdown rank. */
  readonly rank: number;
  /** The block's body lines (excluding the heading line). */
  readonly body: readonly string[];
}

/** One `##`-ranked section of the document. */
export interface SectionBlock {
  /** The section's heading line verbatim. */
  readonly heading: string;
  /** The section's body lines (up to the next `##`-ranked heading). */
  readonly lines: readonly string[];
}

/** A markdown table parsed from a section: the column header plus its data rows. */
export interface ParsedTable {
  /** The table's section heading line. */
  readonly heading: string;
  /** The column-header row, when present. */
  readonly headerRow: readonly string[] | null;
  /** The data rows. */
  readonly rows: readonly (readonly string[])[];
}

/** One parsed phase-inventory row of an overall — the chain's anchor set. */
export interface ChainPhase {
  /** The registered phase id. */
  readonly id: string;
  /** The Design-spec cell text (link tokens). */
  readonly designCell: string;
  /** The Implementation-plan cell text (link tokens). */
  readonly planCell: string;
  /** The Dependency cell text. */
  readonly dependencyCell: string;
}

/** One link parsed from a line — the target only (nothing reads the link text). */
export interface ChainLink {
  /** The link's target. */
  readonly target: string;
}

/** The cross-doc chain root a document carries — extracted and LEFT as an interface.
 *  Every resolution judgment (does the slug exist, is the version in the lineage)
 *  belongs to the judging face, never to a parse. */
export interface ChainRoot {
  /** The document type of the chain root's own document. */
  readonly docType: DocType;
  /** The `program:` slug reference (phase-spec only) — the parent charter's `slug:`
   *  value, never a path. */
  readonly programLink: ChainLink | null;
  /** The version tokens on `parent-version:` (the lineage of the program the reference
   *  names). */
  readonly parentTokens: readonly string[];
  /** The overall's phase-inventory rows — the chain's anchor set (overall only). */
  readonly phases: readonly ChainPhase[];
}

/** The overall parse record — the head, the four tables and the chain root. */
export interface OverallParsed {
  readonly docType: "overall";
  /** The typed head, or null when parsed without one. */
  readonly head: FrontMatter | null;
  /** The title — the head's `title:` scalar ("" without a head). */
  readonly title: string;
  /** The declared `##` sections in document order. */
  readonly sections: readonly SectionBlock[];
  /** The parsed tables (each empty when its section is absent). */
  readonly tables: {
    readonly "File paths": ParsedTable;
    readonly "Issue inventory": ParsedTable;
    readonly "Phase inventory": ParsedTable;
    readonly "Change history": ParsedTable;
  };
  /** The cross-doc chain root (its Phase-inventory rows are the anchor set). */
  readonly chain: ChainRoot;
}

/** The plan parse record — the head, the task blocks and the change register. */
export interface PlanParsed {
  readonly docType: "plan";
  readonly head: FrontMatter | null;
  readonly title: string;
  readonly sections: readonly SectionBlock[];
  /** The `### Task N:` blocks in document order. */
  readonly taskBlocks: readonly TaskBlock[];
  /** The shared change register. */
  readonly tables: { readonly "Change history": ParsedTable };
  readonly chain: ChainRoot;
}

/** One `### N.` design group and its `#### N.M` items. */
export interface DesignGroup {
  /** The group's leading number token (`1` for `### 1. …`). */
  readonly number: string;
  /** The group's heading text (after the number token). */
  readonly heading: string;
  /** The group's items, in document order. */
  readonly items: readonly DesignItem[];
}

/** One `#### N.M` design item. */
export interface DesignItem {
  /** The item's number token (`1.2` for `#### 1.2 …`). */
  readonly number: string;
  /** The item's heading text. */
  readonly heading: string;
}

/** The phase-spec parse record — the head tuple and the design-body skeleton. */
export interface PhaseSpecParsed {
  readonly docType: "phase-spec";
  readonly head: FrontMatter | null;
  readonly title: string;
  readonly sections: readonly SectionBlock[];
  /** The `## Design` double layer, when the section is present. */
  readonly design: readonly DesignGroup[];
  readonly tables: { readonly "Change history": ParsedTable };
  readonly chain: ChainRoot;
}

/** The single-spec parse record — the head and the prose section surface. */
export interface SingleSpecParsed {
  readonly docType: "single-spec";
  readonly head: FrontMatter | null;
  readonly title: string;
  readonly sections: readonly SectionBlock[];
  readonly tables: { readonly "Change history": ParsedTable };
  readonly chain: ChainRoot;
}

/** The parsed-document union — one record per document type. */
export type ParsedDoc = OverallParsed | PlanParsed | PhaseSpecParsed | SingleSpecParsed;

/** The parse face's rejection, re-exported from its one home (`grammar/doc-syntax.ts`). */
export { DocSyntaxError } from "../grammar/doc-syntax.ts";

/**
 * DocParser — the shared parse base. Invariant: every locating decision comes from the
 * injected registry and its projected slices, and the class answers structure only — it
 * has no validate / audit / detect member.
 */
export abstract class DocParser<P extends ParsedDoc> {
  /** The document type the parser binds. */
  readonly key: DocType;
  /** The declared registry of this document type. */
  readonly registry: ElementRegistry;
  /** The derived slice face of this document type — the locating patterns. */
  readonly slices: DocSlices;

  /** The parser's own record discriminant. */
  abstract readonly docTypeName: DocType;

  readonly #slicesByAnchor: ReadonlyMap<string, ElementSlice>;
  readonly #elementsByAnchor: ReadonlyMap<string, ElementLocation>;

  constructor(key: DocType) {
    this.key = key;
    this.registry = declaredRegistries[key];
    this.slices = projector.slices()[key];
    this.#slicesByAnchor = new Map(this.slices.slices.map((slice) => [slice.anchor, slice]));
    this.#elementsByAnchor = new Map(
      this.registry.elements.map((element) => [element.anchor, element.selector]),
    );
  }

  /** The pure structural parse over one already-built tree and its typed head. Nothing
   *  is decided here: the invariants read these records and judge them. */
  abstract parse(tree: MarkdownTree, head?: FrontMatter | null): P;

  /** The registered `##` sections in document order — the registry's declared heading
   *  elements decide WHICH rank-2 heading is a section, so an undeclared prose heading
   *  is not one and a declared conditional heading is. */
  protected sectionsOf(tree: MarkdownTree): SectionBlock[] {
    const out: SectionBlock[] = [];
    for (const section of tree.sections()) {
      if (!this.#declaredSection(section.text)) continue;
      out.push({ heading: section.text, lines: section.lines });
    }
    return out;
  }

  /** The `### Task N:` blocks in document order — the ONE block-structure parse face, so
   *  the graph, the brief and the judgments all read the same records. */
  protected taskBlocksOf(tree: MarkdownTree): readonly TaskBlock[] {
    return TaskBlocks.of(tree).blocks();
  }

  /** The parsed table of one declared table section (empty when the section or its table
   *  is absent) — the ONE table-section read all four document types expose. A section's
   *  table may be split by interior blank lines (the repository's own inventories are):
   *  the grammar's `tables()` already recovers each run a blank line detaches as a
   *  headerless record, so its first headed table and those headerless continuation runs
   *  read as ONE record here, while a separately-headed table stays its own read and is
   *  never blended in. */
  protected tableSection(tree: MarkdownTree, anchor: string): ParsedTable {
    for (const section of tree.sections()) {
      if (!this.#declaredSection(section.text)) continue;
      if (!this.#sectionConforms(section.text, anchor)) continue;
      const end = section.line + section.lines.length;
      const tables = tree.document
        .tables()
        .filter((table) => table.from > section.line && table.from <= end);
      const base = tables.find((table) => table.header !== null) ?? tables[0];
      if (base === undefined) return { heading: section.text, headerRow: null, rows: [] };
      const rows = [
        ...base.body,
        ...tables
          .filter((table) => table !== base && table.header === null)
          .flatMap((table) => table.body),
      ].sort((left, right) => left.from - right.from);
      return {
        heading: section.text,
        headerRow: base.header === null ? null : [...base.header.cells],
        rows: rows.map((row) => [...row.cells]),
      };
    }
    return { heading: "", headerRow: null, rows: [] };
  }

  /** The slice of one registered anchor — the locating pattern's single lookup. */
  protected sliceOf(anchor: string): ElementSlice | undefined {
    return this.#slicesByAnchor.get(anchor);
  }

  /** The declared value shape of one anchor, when it declares one. */
  protected valuePatternOf(anchor: string): RegExp | undefined {
    return this.sliceOf(anchor)?.valuePattern;
  }

  /** Whether a heading line conforms to a declared anchor's value shape. */
  #sectionConforms(heading: string, anchor: string): boolean {
    const pattern = this.valuePatternOf(anchor);
    if (pattern !== undefined) return pattern.test(heading);
    return heading.startsWith(anchor);
  }

  /** Whether a rank-2 heading line is a declared section — a registry element located by
   *  a heading walk accepts it (a literal line, a heading prefix or a pattern). */
  #declaredSection(heading: string): boolean {
    for (const location of this.#elementsByAnchor.values()) {
      if (location.walk !== "heading") continue;
      if (DocParser.headingMatches(location, heading)) return true;
    }
    return false;
  }

  /** The heading match face: a literal accepts itself and its prefixes, a pattern is
   *  tested as-is. */
  protected static headingMatches(location: ElementLocation, heading: string): boolean {
    const match = location.match;
    if (match === undefined) return true;
    if (match instanceof RegExp) return match.test(heading);
    return heading === match || heading.startsWith(match);
  }
}

/**
 * OverallParser — the charter: the four tables and the chain's anchor set.
 */
export class OverallParser extends DocParser<OverallParsed> {
  readonly docTypeName = "overall" as const;

  parse(tree: MarkdownTree, head: FrontMatter | null = null): OverallParsed {
    const tables: OverallParsed["tables"] = {
      "File paths": this.tableSection(tree, "## File paths"),
      "Issue inventory": this.tableSection(tree, "## Issue inventory"),
      "Phase inventory": this.tableSection(tree, "## Phase inventory"),
      "Change history": this.tableSection(tree, "## Change history"),
    };
    return {
      docType: "overall",
      head,
      title: head?.title ?? "",
      sections: this.sectionsOf(tree),
      tables,
      chain: {
        docType: "overall",
        programLink: null,
        parentTokens: [],
        phases: this.#phaseRows(tables["Phase inventory"]),
      },
    };
  }

  /** The Phase-inventory rows as chain phases — header-driven column mapping. */
  #phaseRows(table: ParsedTable): ChainPhase[] {
    if (table.headerRow === null) return [];
    const columns = new Map<string, number>();
    for (const [index, cell] of table.headerRow.entries()) {
      columns.set(cell.toLowerCase(), index);
    }
    if (columns.get("phase") === undefined) return [];
    const design = columns.get("design spec");
    const plan = columns.get("implementation plan");
    const dependency = columns.get("dependency");
    const phases: ChainPhase[] = [];
    for (const row of table.rows) {
      const id = this.#phaseId(row);
      if (id === "") continue;
      phases.push({
        id,
        designCell: design === undefined ? "" : (row[design] ?? ""),
        planCell: plan === undefined ? "" : (row[plan] ?? ""),
        dependencyCell: dependency === undefined ? "" : (row[dependency] ?? ""),
      });
    }
    return phases;
  }

  /** The phase id of one data row — the cell carrying a phase-id token, read through the
   *  declared `Phase id token` value shape (no second literal grammar). */
  #phaseId(row: readonly string[]): string {
    const pattern = this.valuePatternOf("Phase id token");
    const idCell = row.find((cell) => pattern?.test(cell.trim()) === true);
    return idCell === undefined ? "" : idCell.trim();
  }
}

/**
 * PlanParser — the head, the `### Task N:` blocks and the shared change register. A plan
 * carries no chain key of its own: its ownership chain is the identity document sharing
 * its `slug:` (zero second declaration).
 */
export class PlanParser extends DocParser<PlanParsed> {
  readonly docTypeName = "plan" as const;

  parse(tree: MarkdownTree, head: FrontMatter | null = null): PlanParsed {
    return {
      docType: "plan",
      head,
      title: head?.title ?? "",
      sections: this.sectionsOf(tree),
      taskBlocks: this.taskBlocksOf(tree),
      tables: { "Change history": this.tableSection(tree, "## Change history") },
      chain: { docType: "plan", programLink: null, parentTokens: [], phases: [] },
    };
  }
}

/**
 * PhaseSpecParser — the head tuple and the `## Design` double layer.
 */
export class PhaseSpecParser extends DocParser<PhaseSpecParsed> {
  readonly docTypeName = "phase-spec" as const;

  parse(tree: MarkdownTree, head: FrontMatter | null = null): PhaseSpecParsed {
    const program = head?.program ?? null;
    const parent = head?.value("parent-version") ?? null;
    return {
      docType: "phase-spec",
      head,
      title: head?.title ?? "",
      sections: this.sectionsOf(tree),
      design: this.designOf(tree),
      tables: { "Change history": this.tableSection(tree, "## Change history") },
      chain: {
        docType: "phase-spec",
        programLink: program === null ? null : { target: program },
        parentTokens: parent === null ? [] : [parent],
        phases: [],
      },
    };
  }

  /** The design double layer — the `### N.` groups and their `#### N.M` items of the
   *  `## Design` section, located through the registry's declared design-body anchors
   *  (WHICH heading is a group is declared data) and decomposed by the one numbered-line
   *  split below. */
  designOf(tree: MarkdownTree): DesignGroup[] {
    const design = this.#locationOf("## Design");
    const group = this.#locationOf("### N. group heading");
    const item = this.#locationOf("#### N.M item heading");
    if (design === undefined || group === undefined || item === undefined) return [];
    const designLine = tree
      .sections()
      .find((section) => DocParser.headingMatches(design, section.text))?.line;
    if (designLine === undefined) return [];
    const groups: DesignGroup[] = [];
    let open: DesignGroup | null = null;
    for (const heading of tree.headings()) {
      if (heading.line <= designLine) continue;
      if (heading.depth === 2) break;
      if (DocParser.headingMatches(group, heading.text)) {
        const split = PhaseSpecParser.#splitHeading(heading.text, "### ".length, true);
        open = { number: split.number, heading: split.heading, items: [] };
        groups.push(open);
        continue;
      }
      if (open !== null && DocParser.headingMatches(item, heading.text)) {
        (open.items as DesignItem[]).push(
          PhaseSpecParser.#splitHeading(heading.text, "#### ".length, false),
        );
      }
    }
    return groups;
  }

  /** The declared location of one registry anchor (undefined when unregistered). */
  #locationOf(anchor: string): ElementLocation | undefined {
    return this.registry.elements.find((element) => element.anchor === anchor)?.selector;
  }

  /** One numbered heading's number and text — the number runs to the first dot (group
   *  form) or the first space (item form); the text is the trimmed rest. The ONE split
   *  of the design double layer. */
  static #splitHeading(
    heading: string,
    prefixLength: number,
    dotTerminated: boolean,
  ): { number: string; heading: string } {
    const payload = heading.slice(prefixLength);
    let end = 0;
    while (end < payload.length) {
      const char = payload[end];
      if (dotTerminated && char === ".") break;
      if (!dotTerminated && (char === " " || char === "\t")) break;
      end += 1;
    }
    const number = payload.slice(0, end);
    if (end >= payload.length) return { number, heading: "" };
    let text = payload.slice(end);
    if (dotTerminated && text.startsWith(".")) text = text.slice(1);
    return { number, heading: text.trim() };
  }
}

/**
 * SingleSpecParser — the lightest document type: the head and four prose sections. It
 * carries no parent charter and no `### N.` outline, so its chain root is the degraded
 * (linkless) face.
 */
export class SingleSpecParser extends DocParser<SingleSpecParsed> {
  readonly docTypeName = "single-spec" as const;

  parse(tree: MarkdownTree, head: FrontMatter | null = null): SingleSpecParsed {
    return {
      docType: "single-spec",
      head,
      title: head?.title ?? "",
      sections: this.sectionsOf(tree),
      tables: { "Change history": this.tableSection(tree, "## Change history") },
      chain: { docType: "single-spec", programLink: null, parentTokens: [], phases: [] },
    };
  }
}

/** The composed parsers by document type — the ONE dispatch table of the parse face. */
export const docTypeParsers: Record<DocType, DocParser<ParsedDoc>> = {
  overall: new OverallParser("overall"),
  plan: new PlanParser("plan"),
  "phase-spec": new PhaseSpecParser("phase-spec"),
  "single-spec": new SingleSpecParser("single-spec"),
};
