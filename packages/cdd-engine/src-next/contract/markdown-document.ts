// packages/cdd-engine/src-next/contract/markdown-document.ts
// P21 §7.5 — the document INDEX: one mdast parse of one markdown document and the
// structural facts every walk reads (the source lines, the headings and their
// spans, the front-matter keys, the tables, the inline-code column spans).
//
// The index is immutable after construction and answers location questions only —
// it never evaluates a selector and never parses a task block. The selector engine
// (selector-engine.ts) walks it, the block grammar (task-block-grammar.ts) parses
// its task blocks, and `MarkdownTree` (markdown-tree.ts) is the facade over all
// three. Splitting the index out keeps the one parse face free of the query and
// block-grammar concerns (the repo's per-class size standard).

import { fromMarkdown } from "mdast-util-from-markdown";
import { frontmatterFromMarkdown } from "mdast-util-frontmatter";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { frontmatter } from "micromark-extension-frontmatter";
import { gfm } from "micromark-extension-gfm";
import type {
  Candidate,
  FrontMatterKeyNode,
  HeadingNode,
  HeadingScope,
  LineSpan,
  MdNode,
  SectionNode,
  TableRecord,
} from "./markdown-tree-types.ts";

/**
 * MarkdownDocument — the parsed document index: its lines, headings, front-matter
 * keys, tables and inline-code spans. Instances are immutable; every read is pure.
 *
 * Rule zero (over the 200-line class limit): the index stays one class because every
 * member is a pure read of the SAME immutable mdast parse — splitting the heading,
 * table and front-matter readers would share that one parse through a second seam
 * without removing a single variation.
 */
export class MarkdownDocument {
  /** A pipe-delimited row line (`| a | b |`) — the loose continuation-row shape. */
  static readonly LOOSE_ROW = /^\|.*\|$/;

  /** The GFM delimiter row (`| --- | --- |`) — table syntax, never a data row. */
  static readonly DELIMITER_ROW = /^\|?[\s:|-]*-[\s:|-]*\|?$/;

  /** The document's raw lines (1-based line n is index n-1). */
  readonly #lines: readonly string[];
  /** The mdast root. */
  readonly #root: MdNode;
  /** Every heading of the document, in document order. */
  readonly #headings: readonly HeadingNode[];
  /** The front-matter keys of the document (empty without a head). */
  readonly #frontMatter: readonly FrontMatterKeyNode[];
  /** Every table of the document, in document order. */
  readonly #tables: readonly TableRecord[];
  /** Inline-code column spans, keyed by 1-based line (the citation boundary). */
  readonly #codeSpans: ReadonlyMap<number, readonly (readonly [number, number])[]>;
  /** The lines covered by a fenced / indented code block — the code surface the
   *  loose continuation-row recovery must never read as table data. */
  readonly #codeLines: ReadonlySet<number>;

  private constructor(content: string) {
    this.#lines = content.split(/\r?\n/);
    this.#root = MarkdownDocument.#parseRoot(content);
    this.#codeSpans = MarkdownDocument.#codeSpansOf(this.#root);
    this.#codeLines = MarkdownDocument.#codeLinesOf(this.#root);
    this.#headings = this.#headingsOf();
    this.#frontMatter = this.#frontMatterOf();
    const tables = this.#tablesOf();
    this.#tables = [...tables, ...this.#looseTablesOf(tables)].sort(
      (left, right) => left.from - right.from,
    );
  }

  /** Parse a document — the single `from-markdown` entry of the tree. The input
   *  text is expected already normalized (the canonicalize view at the row
   *  source); the document index never rewrites it. */
  static parse(content: string): MarkdownDocument {
    return new MarkdownDocument(content);
  }

  /** The index's own markup entry — gfm tables + YAML front matter. */
  static #parseRoot(content: string): MdNode {
    return fromMarkdown(content, {
      extensions: [gfm(), frontmatter()],
      mdastExtensions: [gfmFromMarkdown(), frontmatterFromMarkdown()],
    }) as unknown as MdNode;
  }

  /** One raw source line (1-based; "" past the end). */
  line(line: number): string {
    return this.#lines[line - 1] ?? "";
  }

  /** The document's line count (a trailing newline's empty tail included, exactly as
   *  the source splits). */
  lineCount(): number {
    return this.#lines.length;
  }

  /** The line with its inline-code spans removed (the citation boundary read from
   *  the document's own `inlineCode` node spans). */
  bareOf(line: number): string {
    return MarkdownDocument.#stripSpans(this.line(line), this.#codeSpans.get(line) ?? []);
  }

  /** The headings of the document (any rank), in document order. */
  headings(): readonly HeadingNode[] {
    return this.#headings;
  }

  /** The heading spans of the document (any rank), in document order — the child
   *  walks' scope (a heading's span runs to the next rank-2-or-shallower heading,
   *  the SAME section boundary every walk scopes to). */
  headingScopes(): readonly HeadingScope[] {
    return this.#headings.map((heading, index) => ({
      text: heading.text,
      line: heading.line,
      from: heading.line,
      to: this.#sectionEnd(index),
    }));
  }

  /** The rank-2 sections of the document, in document order (the section surface
   *  every doc type's `##`-heading read rides). */
  sections(): readonly SectionNode[] {
    const out: SectionNode[] = [];
    for (const [index, heading] of this.#headings.entries()) {
      if (heading.depth !== 2) continue;
      const end = this.#sectionEnd(index);
      out.push({
        text: heading.text,
        lines: this.#lines.slice(heading.line, end),
        line: heading.line,
      });
    }
    return out;
  }

  /** The front-matter keys of the document, in document order. */
  frontMatterKeys(): readonly FrontMatterKeyNode[] {
    return this.#frontMatter;
  }

  /** Every table of the document, in document order. */
  tables(): readonly TableRecord[] {
    return this.#tables;
  }

  /** The tables scoped to a parent selection — the parents' line spans, or every
   *  table when no parent was given. */
  tablesInScope(parents: readonly LineSpan[] | null): readonly TableRecord[] {
    if (parents === null) return this.#tables;
    return this.#tables.filter((table) =>
      parents.some((parent) => table.from >= parent.from && table.to <= parent.to),
    );
  }

  /** The document's top-level mdast nodes, in document order (the block grammar's
   *  task-heading scan reads this). */
  topNodes(): readonly MdNode[] {
    return this.#root.children ?? [];
  }

  /** Every mdast node of one type, in document order (a bounded recursive walk). */
  collect(type: string): readonly MdNode[] {
    const out: MdNode[] = [];
    const stack: MdNode[] = [this.#root];
    while (stack.length > 0) {
      const node = stack.shift();
      if (node === undefined) continue;
      if (node.type === type) out.push(node);
      stack.push(...(node.children ?? []));
    }
    return out;
  }

  /** The plain text of one mdast node (the heading text / key surface). */
  textOf(node: MdNode | undefined): string {
    if (node === undefined) return "";
    if (typeof node.value === "string") return node.value;
    return (node.children ?? []).map((child) => this.textOf(child)).join("");
  }

  /** The 1-based line span of one node. */
  static spanOf(node: MdNode): { readonly start: number; readonly end: number } | null {
    const start = node.position?.start?.line;
    const end = node.position?.end?.line;
    if (start === undefined || end === undefined) return null;
    return { start, end };
  }

  /** The document headings with their bodies, in document order. */
  #headingsOf(): readonly HeadingNode[] {
    const nodes = (this.#root.children ?? []).filter((node) => node.type === "heading");
    const out: HeadingNode[] = [];
    for (const [index, node] of nodes.entries()) {
      const span = MarkdownDocument.spanOf(node);
      if (span === null) continue;
      const next = nodes[index + 1];
      const nextSpan = next === undefined ? null : MarkdownDocument.spanOf(next);
      const end = nextSpan === null ? this.#lines.length : nextSpan.start - 1;
      out.push({
        text: this.line(span.start).trim(),
        depth: node.depth ?? 1,
        line: span.start,
        bodyLines: this.#lines.slice(span.end, Math.max(end, span.end)),
      });
    }
    return out;
  }

  /** The front-matter key locators — the YAML block's `key: value` lines. The
   *  block's TYPED values stay the front-matter extractor's job; the index only
   *  locates the key's line (identity versus location). */
  #frontMatterOf(): readonly FrontMatterKeyNode[] {
    const out: FrontMatterKeyNode[] = [];
    for (const node of this.#root.children ?? []) {
      if (node.type !== "yaml") continue;
      const span = MarkdownDocument.spanOf(node);
      if (span === null) continue;
      for (let line = span.start + 1; line < span.end; line += 1) {
        const match = /^([A-Za-z0-9_-]+):(.*)$/.exec(this.line(line).trim());
        if (match === null) continue;
        out.push({ key: match[1] ?? "", value: (match[2] ?? "").trim(), line });
      }
      return out;
    }
    return out;
  }

  /** The tables of the document in document order — the mdast GFM tables plus the
   *  headerless continuation runs a blank line detaches from their table (see
   *  `#looseTablesOf`). */
  #tablesOf(): readonly TableRecord[] {
    const out: TableRecord[] = [];
    for (const node of this.collect("table")) {
      const span = MarkdownDocument.spanOf(node);
      if (span === null) continue;
      const rows = (node.children ?? [])
        .map((row) => this.#rowOf(row))
        .filter((row) => row !== null);
      const [header, ...body] = rows;
      out.push({
        header: header === undefined ? null : { ...header, header: true },
        body: body.map((row) => ({ ...row, header: false })),
        from: span.start,
        to: span.end,
      });
    }
    return out;
  }

  /** The headerless table rows a blank line detaches from their GFM table: a GFM
   *  table ends at a blank line, and a continuation run carries bare `| a | b |`
   *  rows with no delimiter row, so mdast reads them as paragraphs. A SECTION span
   *  is the table's real boundary (the repository's own Phase / Issue inventories
   *  are written this way), so the run is read back as a headerless table record;
   *  the merge then keeps the first table's header and concatenates the rows in
   *  document order. Lines already covered by an mdast table OR by an mdast code
   *  block are skipped: a fenced block that shows the table shape is sample prose,
   *  never table data (no row is ever read twice). */
  #looseTablesOf(tables: readonly TableRecord[]): readonly TableRecord[] {
    const out: TableRecord[] = [];
    const inTableSpan = (line: number): boolean =>
      tables.some((table) => line >= table.from && line <= table.to);
    for (const [index, heading] of this.#headings.entries()) {
      if (heading.depth !== 2) continue;
      const end = this.#sectionEnd(index);
      let run: Candidate[] = [];
      const flush = (): void => {
        const [first] = run;
        if (first === undefined) return;
        out.push({ header: null, body: run, from: first.from, to: first.to });
        run = [];
      };
      for (let line = heading.line + 1; line <= end; line += 1) {
        const text = this.line(line).trim();
        if (
          inTableSpan(line) ||
          this.#codeLines.has(line) ||
          !MarkdownDocument.LOOSE_ROW.test(text)
        ) {
          flush();
          continue;
        }
        if (MarkdownDocument.DELIMITER_ROW.test(text)) continue;
        run.push({
          text,
          bare: this.bareOf(line),
          lines: [text],
          line,
          cells: MarkdownDocument.cellsOfLooseRow(text),
          from: line,
          to: line,
        });
      }
      flush();
    }
    return out;
  }

  /** The cells of one headerless table row — split on the unescaped `|`
   *  delimiters (a `\|` stays inside its cell), the outer pipes stripped. */
  static cellsOfLooseRow(text: string): readonly string[] {
    const inner = text.replace(/^\|/, "").replace(/\|$/, "");
    const cells: string[] = [];
    let current = "";
    let escaped = false;
    for (const character of inner) {
      if (escaped) {
        current += character;
        escaped = false;
        continue;
      }
      if (character === "\\") {
        escaped = true;
        current += character;
        continue;
      }
      if (character !== "|") {
        current += character;
        continue;
      }
      cells.push(current);
      current = "";
    }
    cells.push(current);
    return cells.map((cell) => cell.replace(/\\\|/g, "|").trim());
  }

  /** One table cell's value — the raw source slice of the cell's span with its
   *  delimiters stripped and the GFM `\|` escape resolved, so a cell keeps its
   *  inline markdown (a link target, a code span). The mdast cell span includes the
   *  leading pipe (its start column sits on the delimiter), hence the strip. */
  static #cellText(cell: MdNode, lines: readonly string[]): string {
    const start = cell.position?.start;
    const end = cell.position?.end;
    if (start?.line !== undefined && start.column !== undefined && end?.column !== undefined) {
      if (start.line === end.line) {
        const raw = (lines[start.line - 1] ?? "").slice(start.column - 1, end.column - 1);
        return raw.replace(/^\|/, "").replace(/\|$/, "").replace(/\\\|/g, "|").trim();
      }
    }
    return "";
  }

  /** One mdast table row → its cells (each cell the raw source slice of the cell's
   *  own span; an escaped `\|` and a backticked pipe stay inside their cell). */
  #rowOf(node: MdNode): Candidate | null {
    const span = MarkdownDocument.spanOf(node);
    if (span === null) return null;
    const cells = (node.children ?? [])
      .filter((cell) => cell.type === "tableCell")
      .map((cell) => MarkdownDocument.#cellText(cell, this.#lines));
    const text = this.line(span.start).trim();
    return {
      text,
      bare: text,
      lines: [text],
      line: span.start,
      cells,
      from: span.start,
      to: span.end,
    };
  }

  /** The section end line of the heading at `index` — the line before the next
   *  rank-2-or-shallower heading, or the document's last line. */
  #sectionEnd(index: number): number {
    const heading = this.#headings[index];
    if (heading === undefined) return this.#lines.length;
    for (let next = index + 1; next < this.#headings.length; next += 1) {
      const candidate = this.#headings[next];
      if (candidate === undefined) continue;
      if (candidate.depth <= 2) return candidate.line - 1;
    }
    return this.#lines.length;
  }

  /** The text with every inline-code span removed (a line's citation boundary). */
  static #stripSpans(text: string, spans: readonly (readonly [number, number])[]): string {
    if (spans.length === 0) return text;
    let out = "";
    let cursor = 0;
    for (const [start, end] of [...spans].sort((left, right) => left[0] - right[0])) {
      if (start < cursor) continue;
      out += text.slice(cursor, start);
      cursor = end;
    }
    return out + text.slice(cursor);
  }

  /** The inline-code column spans of the document, keyed by line (1-based columns). */
  static #codeSpansOf(root: MdNode): ReadonlyMap<number, readonly (readonly [number, number])[]> {
    const map = new Map<number, (readonly [number, number])[]>();
    const stack: MdNode[] = [root];
    while (stack.length > 0) {
      const node = stack.shift();
      if (node === undefined) continue;
      if (node.type === "inlineCode") {
        const start = node.position?.start;
        const end = node.position?.end;
        if (start?.line !== undefined && start.column !== undefined && end?.column !== undefined) {
          const bucket = map.get(start.line) ?? [];
          bucket.push([start.column - 1, end.column - 1]);
          map.set(start.line, bucket);
        }
      }
      stack.push(...(node.children ?? []));
    }
    return map;
  }

  /** The lines occupied by a fenced / indented code block (the code surface a
   *  loose-row read must never treat as table data). */
  static #codeLinesOf(root: MdNode): ReadonlySet<number> {
    const lines = new Set<number>();
    const stack: MdNode[] = [root];
    while (stack.length > 0) {
      const node = stack.shift();
      if (node === undefined) continue;
      if (node.type === "code") {
        const span = MarkdownDocument.spanOf(node);
        if (span !== null) {
          for (let line = span.start; line <= span.end; line += 1) lines.add(line);
        }
      }
      stack.push(...(node.children ?? []));
    }
    return lines;
  }
}
