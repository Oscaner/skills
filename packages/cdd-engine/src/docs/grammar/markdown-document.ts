// packages/cdd-engine/src/docs/grammar/markdown-document.ts
// The document index: one mdast parse of one markdown document and the structural
// facts every read of it needs — the source lines, the headings and their spans, the
// front-matter key locators, the tables and the inline-code column spans.
//
// The index answers LOCATION only. It never judges a document, never evaluates a
// selector and never parses a task block: the tree walks it, the block grammar parses
// its task blocks, and the judgments above read both. That separation is what keeps a
// grammar question ("where is this heading?") from silently becoming a judgment
// question ("is this document legal?").
//
// Being one mdast parse is also what makes the index FENCE-AWARE for free: a `## x`
// inside a fenced block is a `code` node, so it is not a heading, and a `| a | b |`
// inside one is not a table. A hand-written line scanner would have to re-derive that
// boundary and would get it wrong the first time a document quoted markdown.
//
// Every value the index hands out is immutable and derived from the one parse, so two
// reads of the same text produce the same index.

import { fromMarkdown } from "mdast-util-from-markdown";
import { frontmatterFromMarkdown } from "mdast-util-frontmatter";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { frontmatter } from "micromark-extension-frontmatter";
import { gfm } from "micromark-extension-gfm";
import type {
  FrontMatterKeyNode,
  HeadingNode,
  HeadingScope,
  MdNode,
  SectionNode,
  TableRecord,
  TableRow,
} from "./types.ts";

/**
 * MarkdownDocument — the parsed document index. Immutable after construction; every
 * read is pure.
 *
 * Rule zero (over the 200-line class limit): the index stays one class because every
 * member is a pure read of the SAME immutable mdast parse — splitting the heading,
 * table and front-matter readers would share that one parse through a second seam
 * without removing a single variation.
 */
export class MarkdownDocument {
  /** A line shaped like a table row (`| a | b |`) — a detached run's row face. */
  static readonly DETACHED_ROW = /^\|.*\|$/;

  /** A GFM delimiter row (`|---|---|`) — a row separator, never a data row. */
  static readonly DELIMITER_ROW = /^\|?[\s:|-]*-[\s:|-]*\|?$/;

  /** The document's raw lines (1-based line n is index n-1). */
  readonly #lines: readonly string[];
  /** The mdast root. */
  readonly #root: MdNode;
  /** Every heading, in document order. */
  readonly #headings: readonly HeadingNode[];
  /** The front-matter key locators, in document order. */
  readonly #frontMatterKeys: readonly FrontMatterKeyNode[];
  /** Every GFM table, in document order. */
  readonly #tables: readonly TableRecord[];
  /** Inline-code column spans keyed by 1-based line — the citation boundary. */
  readonly #codeSpans: ReadonlyMap<number, readonly (readonly [number, number])[]>;
  /** The lines a fenced or indented code block covers — the code surface. */
  readonly #codeLines: ReadonlySet<number>;

  private constructor(content: string) {
    this.#lines = content.split(/\r?\n/);
    this.#root = MarkdownDocument.#parseRoot(content);
    this.#codeSpans = MarkdownDocument.#codeSpansOf(this.#root);
    this.#codeLines = MarkdownDocument.#codeLinesOf(this.#root);
    this.#headings = this.#headingsOf();
    this.#frontMatterKeys = MarkdownDocument.#frontMatterKeysOf(this.#root, this.#lines);
    this.#tables = this.#tablesOf();
  }

  /** Parse a document — the single `from-markdown` entry. The input is expected
   *  already normalized; the index never rewrites it. */
  static parse(content: string): MarkdownDocument {
    return new MarkdownDocument(content);
  }

  /** One raw source line (1-based; "" past the end). */
  line(line: number): string {
    return this.#lines[line - 1] ?? "";
  }

  /** The document's line count, exactly as the source splits. */
  lineCount(): number {
    return this.#lines.length;
  }

  /** Whether a line sits inside a fenced or indented code block. */
  isCodeLine(line: number): boolean {
    return this.#codeLines.has(line);
  }

  /** The line with its inline-code spans removed — the citation boundary read from the
   *  document's own `inlineCode` node spans, never from a first-backtick guess. */
  bareOf(line: number): string {
    return MarkdownDocument.#stripSpans(this.line(line), this.#codeSpans.get(line) ?? []);
  }

  /** The headings of the document, in document order. */
  headings(): readonly HeadingNode[] {
    return this.#headings;
  }

  /** One heading's scope — the heading line through the last line before the next
   *  rank-2-or-shallower heading (the one section boundary every walk shares). */
  scopes(): readonly HeadingScope[] {
    return this.#headings.map((heading, index) => ({
      text: heading.text,
      line: heading.line,
      from: heading.line,
      to: MarkdownDocument.#sectionEnd(this.#headings, index, this.#lines.length),
    }));
  }

  /** The rank-2 sections of the document, in document order. */
  sections(): readonly SectionNode[] {
    const out: SectionNode[] = [];
    for (const [index, heading] of this.#headings.entries()) {
      if (heading.depth !== 2) continue;
      const end = MarkdownDocument.#sectionEnd(this.#headings, index, this.#lines.length);
      out.push({
        text: heading.text,
        lines: this.#lines.slice(heading.line, end),
        line: heading.line,
      });
    }
    return out;
  }

  /** The front-matter key locators, in document order. A document with no head has
   *  none; the TYPED values are `frontmatterOf`'s job — the index locates a key's
   *  line and never interprets its value. */
  frontMatterKeys(): readonly FrontMatterKeyNode[] {
    return this.#frontMatterKeys;
  }

  /** Every table of the document, in document order — the mdast GFM tables plus the
   *  headerless records a blank line detaches from them. A table-like shape inside a
   *  fenced block is sample prose and appears in no record. */
  tables(): readonly TableRecord[] {
    return this.#tables;
  }

  /** The plain text of one mdast node (a heading's text surface). */
  textOf(node: MdNode | undefined): string {
    if (node === undefined) return "";
    if (typeof node.value === "string") return node.value;
    return (node.children ?? []).map((child) => this.textOf(child)).join("");
  }

  /** Every mdast node of one type, in document order (a bounded breadth-first walk). */
  collect(type: string): readonly MdNode[] {
    const out: MdNode[] = [];
    const queue: MdNode[] = [this.#root];
    while (queue.length > 0) {
      const node = queue.shift();
      if (node === undefined) continue;
      if (node.type === type) out.push(node);
      queue.push(...(node.children ?? []));
    }
    return out;
  }

  /** The document's top-level mdast nodes, in document order. */
  topNodes(): readonly MdNode[] {
    return this.#root.children ?? [];
  }

  /** The 1-based line span of one node, or null when it carries none. */
  static spanOf(node: MdNode): { readonly start: number; readonly end: number } | null {
    const start = node.position?.start?.line;
    const end = node.position?.end?.line;
    if (start === undefined || end === undefined) return null;
    return { start, end };
  }

  /** The index's own markup entry — GFM tables plus YAML front matter. */
  static #parseRoot(content: string): MdNode {
    return fromMarkdown(content, {
      extensions: [gfm(), frontmatter()],
      mdastExtensions: [gfmFromMarkdown(), frontmatterFromMarkdown()],
    }) as unknown as MdNode;
  }

  /** The headings with their bodies, in document order — mdast's own heading nodes,
   *  so a fenced sample never enters. */
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

  /** The front-matter key locators — the YAML block's `key: value` lines. */
  static #frontMatterKeysOf(root: MdNode, lines: readonly string[]): readonly FrontMatterKeyNode[] {
    const out: FrontMatterKeyNode[] = [];
    for (const node of root.children ?? []) {
      if (node.type !== "yaml") continue;
      const span = MarkdownDocument.spanOf(node);
      if (span === null) return out;
      for (let line = span.start + 1; line < span.end; line += 1) {
        const match = /^([A-Za-z0-9_-]+):(.*)$/.exec((lines[line - 1] ?? "").trim());
        if (match === null) continue;
        out.push({ key: match[1] ?? "", value: (match[2] ?? "").trim(), line });
      }
      return out;
    }
    return out;
  }

  /** The GFM tables PLUS the headerless runs a blank line detaches, in document order —
   *  each row's cells read off the cell's own source span, so an escaped `\|` and a
   *  backticked pipe stay inside their cell. A GFM table ends at a blank line and a
   *  continuation run carries no delimiter row, so mdast reads the run as a paragraph and
   *  the table's tail rows would be lost; a SECTION span is the table's real boundary
   *  (the repository's own Phase / Issue inventories are written this way), so the run is
   *  recovered here — on the face every table consumer reads — and never in one consumer's
   *  own read. */
  #tablesOf(): readonly TableRecord[] {
    const headed: TableRecord[] = [];
    for (const node of this.collect("table")) {
      const span = MarkdownDocument.spanOf(node);
      if (span === null) continue;
      const rows = (node.children ?? [])
        .map((row) => this.#rowOf(row))
        .filter((row): row is NonNullable<typeof row> => row !== null);
      const [header, ...body] = rows;
      headed.push({ header: header ?? null, body, from: span.start, to: span.end });
    }
    return [...headed, ...this.#detachedTablesOf(headed)].sort(
      (left, right) => left.from - right.from,
    );
  }

  /** The headerless records a blank line detaches from a table — one record per run of
   *  bare `| a | b |` rows, bounded by the rank-2 section it sits in. A line an mdast table
   *  spans is skipped (no row is read twice) and a line a fenced block covers is skipped (a
   *  table shape shown as sample prose is never data); a line that is not a row ends the
   *  run. */
  #detachedTablesOf(tables: readonly TableRecord[]): readonly TableRecord[] {
    const out: TableRecord[] = [];
    const inTableSpan = (line: number): boolean =>
      tables.some((table) => line >= table.from && line <= table.to);
    for (const [index, heading] of this.#headings.entries()) {
      if (heading.depth !== 2) continue;
      const end = MarkdownDocument.#sectionEnd(this.#headings, index, this.#lines.length);
      let run: TableRow[] = [];
      const flush = (): void => {
        const first = run[0];
        const last = run[run.length - 1];
        if (first === undefined || last === undefined) return;
        out.push({ header: null, body: run, from: first.from, to: last.to });
        run = [];
      };
      for (let line = heading.line + 1; line <= end; line += 1) {
        const text = this.line(line).trim();
        if (
          inTableSpan(line) ||
          this.#codeLines.has(line) ||
          !MarkdownDocument.DETACHED_ROW.test(text)
        ) {
          flush();
          continue;
        }
        if (MarkdownDocument.DELIMITER_ROW.test(text)) continue;
        run.push({ cells: MarkdownDocument.#cellsOfDetachedRow(text), line, from: line, to: line });
      }
      flush();
    }
    return out;
  }

  /** One detached row's cells — split on the unescaped `|` delimiters (a `\|` stays inside
   *  its cell), the outer pipes stripped. The mdast-span cell read above cannot answer
   *  this: a detached run carries no mdast node to take a span from. */
  static #cellsOfDetachedRow(text: string): readonly string[] {
    const cells: string[] = [];
    let current = "";
    let escaped = false;
    for (const character of text.replace(/^\|/, "").replace(/\|$/, "")) {
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

  /** One table row's cells. */
  #rowOf(node: MdNode): TableRecord["body"][number] | null {
    const span = MarkdownDocument.spanOf(node);
    if (span === null) return null;
    const cells = (node.children ?? [])
      .filter((cell) => cell.type === "tableCell")
      .map((cell) => MarkdownDocument.#cellText(cell, this.#lines));
    return { cells, line: span.start, from: span.start, to: span.end };
  }

  /** One cell's value — the raw source slice of the cell's own span with its
   *  delimiters stripped and the GFM `\|` escape resolved. */
  static #cellText(cell: MdNode, lines: readonly string[]): string {
    const start = cell.position?.start;
    const end = cell.position?.end;
    if (start?.line === undefined || start.column === undefined || end?.column === undefined) {
      return "";
    }
    if (start.line !== end.line) return "";
    const raw = (lines[start.line - 1] ?? "").slice(start.column - 1, end.column - 1);
    return raw.replace(/^\|/, "").replace(/\|$/, "").replace(/\\\|/g, "|").trim();
  }

  /** The section end line of the heading at `index` — the line before the next
   *  rank-2-or-shallower heading, or the document's last line. */
  static #sectionEnd(headings: readonly HeadingNode[], index: number, lineCount: number): number {
    const heading = headings[index];
    if (heading === undefined) return lineCount;
    for (let next = index + 1; next < headings.length; next += 1) {
      const candidate = headings[next];
      if (candidate === undefined) continue;
      if (candidate.depth <= 2) return candidate.line - 1;
    }
    return lineCount;
  }

  /** The text with every inline-code span removed. */
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

  /** The inline-code column spans, keyed by 1-based line. */
  static #codeSpansOf(root: MdNode): ReadonlyMap<number, readonly (readonly [number, number])[]> {
    const map = new Map<number, (readonly [number, number])[]>();
    const queue: MdNode[] = [root];
    while (queue.length > 0) {
      const node = queue.shift();
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
      queue.push(...(node.children ?? []));
    }
    return map;
  }

  /** The lines a fenced or indented code block covers. */
  static #codeLinesOf(root: MdNode): ReadonlySet<number> {
    const lines = new Set<number>();
    const queue: MdNode[] = [root];
    while (queue.length > 0) {
      const node = queue.shift();
      if (node === undefined) continue;
      if (node.type === "code") {
        const span = MarkdownDocument.spanOf(node);
        if (span !== null) {
          for (let line = span.start; line <= span.end; line += 1) lines.add(line);
        }
      }
      queue.push(...(node.children ?? []));
    }
    return lines;
  }
}
