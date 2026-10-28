// packages/cdd-engine/src-next/contract/markdown-tree.ts
// P21 §7.5 — the ONE parse face of the contract plane: the markdown tree.
//
// The four doc types (overall / plan / phase-spec / single-spec) share one
// document model. `MarkdownTree.parse(content)` is the single `from-markdown`
// entry of the tree (gfm + YAML front matter extensions): every consumer —
// the doc parsers, the home extractors, the invariant strategies, the skeleton
// round-trip pin — locates structure through it, never through a hand-written
// line scan.
//
// The two axes the tree keeps apart (the P21 identity/locator split):
//   · IDENTITY — a registry element's `anchor` (the schema property name, the
//     `required[]` key, the skeleton truth-table key, the lint lookup key, the
//     `field:` of a finding). The tree never touches it.
//   · LOCATION — an element's `selector`: a composable query (`from` a parent
//     selector or the document root, `walk` one of the eight structural walks,
//     an optional `match` and an optional `when` guard). A selector answers
//     WHERE, never WHAT.
//
// A resolved node is line-faithful: `text` is the node's own raw source line
// (the value-shape judgments run on it, exactly as the declared `valuePattern`
// rows were written) and `bare` is the same line with its inline-code spans
// removed (a cited anchor is not a value carrier — the code-span boundary is
// read from the tree's inline-code node spans, never from a first/last-backtick
// guess). `line` is 1-based, so a finding can point at the row it judges.
//
// Module-level exports are types / the class — zero behavior-carrying bare
// functions (the plan's zero-bare-function discipline).

import { fromMarkdown } from "mdast-util-from-markdown";
import { frontmatterFromMarkdown } from "mdast-util-frontmatter";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { frontmatter } from "micromark-extension-frontmatter";
import { gfm } from "micromark-extension-gfm";
import { TASK_ID_VALUE_PATTERN } from "./declare.ts";
import type { TaskBlock, TaskStep } from "./task-blocks.ts";

/** The eight structural walks of the selector face. */
export type Walk =
  | "frontmatter"
  | "heading"
  | "table"
  | "row"
  | "cell"
  | "list"
  | "taskField"
  | "taskStep"
  | "graphEdge";

/** The guard a walk may carry — the "which of the walked nodes" refinement. */
export type When = "first" | "last" | "tableBody" | "inTaskBlock";

/** A composable locator: `from` a parent selector (or the document root), `walk`
 *  the structural surface, `match` the node text (a literal prefix or a RegExp),
 *  `when` the guard. Selectors are declared data on the registry elements. */
export interface Selector {
  /** The parent selector — scopes the walk to the parent's line span — or the root. */
  readonly from: "root" | Selector;
  /** The structural surface this selector walks. */
  readonly walk: Walk;
  /** The node-text constraint: a literal (an exact line or a heading prefix) or a
   *  RegExp tested against the node's raw line. */
  readonly match?: string | RegExp;
  /** The walk's guard. */
  readonly when?: When;
}

/** One resolved node — the locating result the judgments read. */
export interface ResolvedNode {
  /** The node's own raw source line (a value shape judges THIS, never a re-scan). */
  readonly text: string;
  /** The same line with its inline-code spans removed (a cited anchor is no value). */
  readonly bare: string;
  /** The node's raw source lines (the field value lines / the row line). */
  readonly lines: readonly string[];
  /** The 1-based line the node starts at (the finding's locator). */
  readonly line: number;
  /** The row's cells — set for row / cell / table walks. */
  readonly cells?: readonly string[];
}

/** One rank-2 section node — the heading line plus the body lines under it. */
export interface SectionNode {
  /** The section heading line, verbatim. */
  readonly text: string;
  /** The section's body lines (up to the next rank-2 heading). */
  readonly lines: readonly string[];
  /** The 1-based heading line. */
  readonly line: number;
}

/** One `## Dependency graph` edge line — the graph surface's leaf record. */
export interface TreeEdge {
  /** The edge's from-phase token (`P<n>`, a `.digits` suffix included). */
  readonly from: string;
  /** The edge's to-phase token. */
  readonly to: string;
  /** Whether the edge blocks (a hard edge) or only suggests (a soft edge). */
  readonly hard: boolean;
}

/** One heading of the document (any rank) — the structure's skeleton record. */
export interface HeadingNode {
  /** The heading line, verbatim (leading `#`s included). */
  readonly text: string;
  /** The heading's rank (1..6). */
  readonly depth: number;
  /** The 1-based heading line. */
  readonly line: number;
  /** The lines between this heading and the next heading of any rank. */
  readonly bodyLines: readonly string[];
}

/** The front-matter key locator — the key name, its scalar text and its line. */
export interface FrontMatterKeyNode {
  /** The declared key name (`slug`, `version`, …). */
  readonly key: string;
  /** The key's raw value text (the YAML line's remainder, quotes kept). */
  readonly value: string;
  /** The 1-based line the key sits on. */
  readonly line: number;
}

/** One mdast node, structurally narrowed to the members this tree reads (the
 *  library's own node types stay out of the public surface). */
interface MdNode {
  readonly type?: string;
  readonly depth?: number;
  readonly value?: string;
  readonly children?: readonly MdNode[];
  readonly position?: MdSpan;
}

/** The mdast source span of one node. */
interface MdSpan {
  readonly start?: { readonly line?: number; readonly column?: number; readonly offset?: number };
  readonly end?: { readonly line?: number; readonly column?: number; readonly offset?: number };
}

/** One candidate the walks produce before matching — a resolved node plus the
 *  span the child walks scope themselves to. */
interface Candidate extends ResolvedNode {
  /** The candidate's span start line (the child-walk scope). */
  readonly from: number;
  /** The candidate's span end line. */
  readonly to: number;
  /** The table row is a column-header row (the `tableBody` guard excludes it). */
  readonly header?: boolean;
  /** The graph edge class (`hard` / `soft`) — the graphEdge walk's literal match. */
  readonly edgeClass?: "hard" | "soft";
}

/** One `#### Key` section of a task block — the key, its line span and its value
 *  lines (the block grammar's internal carrier). */
interface TaskSection {
  readonly key: string;
  readonly start: number;
  readonly end: number;
  readonly lines: readonly string[];
}

/** One parsed table — its owning section heading line, its header row and its
 *  body rows (each row carrying its cells). */
interface TableRecord {
  readonly heading: string;
  readonly header: Candidate | null;
  readonly body: readonly Candidate[];
  readonly from: number;
  readonly to: number;
}

/**
 * TaskBlockGrammar — the task-block structural constants. They live with the
 * tree because the tree owns the ONE block parse (the `PlanTaskBlocksReader` is
 * the facade over it), so the block grammar has exactly one home.
 */
// biome-ignore lint/complexity/noStaticOnlyClass: the plan-mandated static data face — the zero-bare-function discipline admits no standalone constant functions.
export class TaskBlockGrammar {
  /** The seven reserved section keys, in the canonical document order. */
  static readonly RESERVED: readonly string[] = [
    "Objective",
    "Files",
    "Consumes",
    "Produces",
    "Steps",
    "Acceptance",
    "DependsOn",
  ];

  /** The task-block heading — `### Task N: <title>` (the title stays optional). */
  static readonly TASK_HEADING = /^Task (\d+):(.*)$/;

  /** The legacy field marker — `- **Key**: <value>`. */
  static readonly LEGACY_FIELD = /^- \*\*(.+?)\*\*:(.*)$/;

  /** The step bullet — a list item's text line. */
  static readonly STEP_LINE = /^[-*]\s+(.*)$/;

  /** The `— checkable:` clause separator. */
  static readonly CHECKABLE = "— checkable:";

  /** A dependency id token — the declared `DependsOn id` value domain (the SAME
   *  source string the registry element carries). */
  static readonly ID_TOKEN = new RegExp(TASK_ID_VALUE_PATTERN);
}

/**
 * MarkdownTree — the markdown document model: one parse, every structural walk.
 * Instances are immutable after construction; the walks are pure reads, so one
 * tree serves the parse face, the extractors and the judgment face alike.
 */
export class MarkdownTree {
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
  /** The parsed `### Task N:` blocks (lazy — most documents carry none). */
  #taskCache: readonly TaskBlock[] | null = null;
  /** The field spans of each parsed block (parallel to `#taskCache.fields`) — the
   *  child walks scope themselves to one FIELD, never to its whole block. */
  #fieldSpanCache: readonly (readonly TaskSection[])[] = [];

  private constructor(content: string) {
    this.#lines = content.split(/\r?\n/);
    this.#root = MarkdownTree.#parseRoot(content);
    this.#codeSpans = MarkdownTree.#codeSpansOf(this.#root);
    this.#headings = this.#headingsOf();
    this.#frontMatter = this.#frontMatterOf();
    this.#tables = this.#tablesOf();
  }

  /** Parse a document — the single `from-markdown` entry of the tree. The input
   *  text is expected already normalized (the canonicalize view at the row
   *  source); the tree never rewrites it. */
  static parse(content: string): MarkdownTree {
    return new MarkdownTree(content);
  }

  /** The tree's own markup entry — gfm tables + YAML front matter. */
  static #parseRoot(content: string): MdNode {
    return fromMarkdown(content, {
      extensions: [gfm(), frontmatter()],
      mdastExtensions: [gfmFromMarkdown(), frontmatterFromMarkdown()],
    }) as unknown as MdNode;
  }

  /** The first node matching the selector — null when nothing matches (the
   *  presence read). */
  resolve(selector: Selector): ResolvedNode | null {
    return this.#candidates(selector)[0] ?? null;
  }

  /** Every node matching the selector, in document order. */
  occurrences(selector: Selector): readonly ResolvedNode[] {
    return this.#candidates(selector);
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

  /** The headings of the document (any rank), in document order. */
  headings(): readonly HeadingNode[] {
    return this.#headings;
  }

  /** The front-matter keys of the document, in document order. */
  frontMatterKeys(): readonly FrontMatterKeyNode[] {
    return this.#frontMatter;
  }

  /** The cell rows of the selector's row matches (the parse face's table read). */
  rows(selector: Selector): readonly (readonly string[])[] {
    return this.#candidates(selector).map((candidate) => candidate.cells ?? []);
  }

  /** The table a selector addresses: the column-header row plus the body rows
   *  (null when the selector matches no table). */
  table(
    selector: Selector,
  ): { header: readonly string[] | null; body: readonly (readonly string[])[] } | null {
    const parents = selector.from === "root" ? null : this.#candidates(selector.from);
    const record = this.#tablesInScope(parents)[0];
    if (record === undefined) return null;
    const header = record.header?.cells ?? null;
    return {
      header,
      body: record.body.map((row) => [...(row.cells ?? [])]),
    };
  }

  /** The list items whose first child is itself a list — the doubled-marker shape
   *  (`- - x`): the outer item carries a nested list and no own prose. A thematic
   *  break (`- - -`) parses as a separator, never as a list item, so it is exempt by
   *  construction. */
  doubledMarkerItems(): readonly ResolvedNode[] {
    const out: ResolvedNode[] = [];
    for (const node of this.#collect("listItem")) {
      const [first] = node.children ?? [];
      if (first?.type !== "list") continue;
      const span = MarkdownTree.#spanOf(node);
      if (span === null) continue;
      const text = this.#line(span.start).trim();
      out.push({
        text,
        bare: this.#bareOf(span.start),
        lines: [text],
        line: span.start,
      });
    }
    return out;
  }

  /** The table of the section under one heading (a heading line or a heading
   *  prefix) — the section-scoped table read the doc parsers and the strategies
   *  use. Null when the section or its table is absent. */
  tableUnder(heading: string | RegExp): {
    header: readonly string[] | null;
    body: readonly (readonly string[])[];
  } | null {
    const parents = this.#candidates({ from: "root", walk: "heading", match: heading });
    const record = this.#tablesInScope(parents)[0];
    if (record === undefined) return null;
    return {
      header: record.header?.cells ?? null,
      body: record.body.map((row) => [...(row.cells ?? [])]),
    };
  }

  /** The `## Dependency graph` edges of the document, in document order. */
  edges(): readonly TreeEdge[] {
    return this.#edgeCandidates()
      .filter((candidate) => candidate.edgeClass !== undefined)
      .map((candidate) => {
        const match = /^P(\d+(?:\.\d+)*)\s*->\s*P(\d+(?:\.\d+)*)/.exec(candidate.text);
        return {
          from: `P${match?.[1]}`,
          to: `P${match?.[2]}`,
          hard: candidate.edgeClass !== "soft",
        };
      });
  }

  /** The `### Task N:` blocks of the document, in document order — the ONE block
   *  structure parse (the heading shape and the legacy bullet shape normalize
   *  into the same record). */
  tasks(): readonly TaskBlock[] {
    if (this.#taskCache === null) {
      const parsed = this.#parseTasks();
      this.#taskCache = parsed.blocks;
      this.#fieldSpanCache = parsed.sections;
    }
    return this.#taskCache;
  }

  /** The body text of one rank-2 section (the brief's `## Constraints` mirror),
   *  heading line included; "" when the section is absent. */
  sectionText(heading: string): string {
    for (const section of this.sections()) {
      const text = section.text.trim();
      if (text !== heading && text.replace(/^#+\s*/, "") !== heading) continue;
      const body: string[] = [];
      for (const line of section.lines) {
        // A `### Task N:` head ends the section — a task block never lives inside a
        // rank-2 section body — while a deeper plain heading stays in the body.
        if (TaskBlockGrammar.TASK_HEADING.test(line.trim().replace(/^### /, ""))) break;
        body.push(line);
      }
      return [section.text, ...body].join("\n").replace(/\s+$/, "");
    }
    return "";
  }

  /** Whether a text conforms to a selector's match face (the section/registry
   *  conformance read — the same match semantics the walks apply). */
  matches(selector: Selector, text: string): boolean {
    return MarkdownTree.#matchesText(selector.walk, selector.match, text, undefined);
  }

  // -------------------------------------------------------------------------
  // selector evaluation
  // -------------------------------------------------------------------------

  /** The matched candidates of one selector — resolve the parent scope, walk it,
   *  then apply the match and the guard. */
  #candidates(selector: Selector): readonly Candidate[] {
    const parents = selector.from === "root" ? null : this.#candidates(selector.from);
    if (parents !== null && parents.length === 0) return [];
    const walked = this.#walk(selector.walk, parents);
    const matched = walked.filter((candidate) =>
      MarkdownTree.#matchesText(selector.walk, selector.match, candidate.text, candidate.edgeClass),
    );
    return this.#guard(matched, selector.when);
  }

  /** The walk over one structural surface, scoped to the parents' line spans when
   *  a parent selector was given. */
  #walk(walk: Walk, parents: readonly Candidate[] | null): readonly Candidate[] {
    switch (walk) {
      case "frontmatter":
        return this.#walkFrontMatter();
      case "heading":
        return this.#walkHeadings(parents);
      case "table":
      case "row":
        return this.#walkTables(parents);
      case "cell":
        return this.#walkCells(parents);
      case "list":
        return MarkdownTree.#inScope(this.#listCandidates(), parents);
      case "taskField":
        return MarkdownTree.#inScope(this.#taskFieldCandidates(), parents);
      case "taskStep":
        return MarkdownTree.#inScope(this.#taskStepCandidates(), parents);
      case "graphEdge":
        return MarkdownTree.#inScope(this.#edgeCandidates(), parents);
    }
  }

  /** The `when` guard — the walk's "which of these" refinement. */
  #guard(candidates: readonly Candidate[], when: When | undefined): readonly Candidate[] {
    switch (when) {
      case undefined:
        return candidates;
      case "first":
        return candidates.slice(0, 1);
      case "last":
        return candidates.slice(-1);
      case "tableBody":
        return candidates.filter((candidate) => candidate.header !== true);
      case "inTaskBlock":
        return candidates.filter((candidate) => this.#isTaskScoped(candidate));
    }
  }

  /** Whether a candidate sits inside a `### Task N:` block (the `inTaskBlock`
   *  guard's structural fact, read off the block ranges). */
  #isTaskScoped(candidate: Candidate): boolean {
    return this.tasks().some(
      (block) => candidate.from >= block.range.start && candidate.to <= block.range.end,
    );
  }

  /** Restrict candidates to the parents' line spans. */
  static #inScope(
    candidates: readonly Candidate[],
    parents: readonly Candidate[] | null,
  ): readonly Candidate[] {
    if (parents === null) return candidates;
    return candidates.filter((candidate) =>
      parents.some((parent) => candidate.from >= parent.from && candidate.to <= parent.to),
    );
  }

  /** The match face: a literal (exact line, or a heading anchor's line prefix), a
   *  RegExp over the raw line, and — for the graphEdge walk — the edge-class
   *  literal (`hard` / `soft`). */
  static #matchesText(
    walk: Walk,
    match: string | RegExp | undefined,
    text: string,
    edgeClass: "hard" | "soft" | undefined,
  ): boolean {
    if (match === undefined) return true;
    if (match instanceof RegExp) return match.test(text);
    if (walk === "graphEdge" && (match === "hard" || match === "soft")) return edgeClass === match;
    if (walk === "frontmatter") return text === match;
    if (walk === "heading") return text === match || text.startsWith(match);
    return text === match || text.startsWith(match);
  }

  // -------------------------------------------------------------------------
  // the walks
  // -------------------------------------------------------------------------

  #walkFrontMatter(): readonly Candidate[] {
    return this.#frontMatter.map((entry) => ({
      text: entry.key,
      bare: entry.key,
      lines: [this.#line(entry.line)],
      line: entry.line,
      from: entry.line,
      to: entry.line,
    }));
  }

  #walkHeadings(parents: readonly Candidate[] | null): readonly Candidate[] {
    const out: Candidate[] = [];
    for (const [index, heading] of this.#headings.entries()) {
      const end = this.#sectionEnd(index);
      out.push({
        text: heading.text,
        bare: this.#bareOf(heading.line),
        lines: [heading.text],
        line: heading.line,
        from: heading.line,
        to: end,
      });
    }
    return MarkdownTree.#inScope(out, parents);
  }

  /** The table rows of the addressed tables — the header row plus the body rows
   *  (the `row` walk drops the header under its `tableBody` guard). */
  #walkTables(parents: readonly Candidate[] | null): readonly Candidate[] {
    const out: Candidate[] = [];
    for (const table of this.#tablesInScope(parents)) {
      // A row candidate carries the TABLE's span, so a child walk scoped to a row
      // still knows which table it belongs to (the row's own line is `line`).
      for (const row of [table.header, ...table.body]) {
        if (row === null) continue;
        out.push({ ...row, from: table.from, to: table.to });
      }
    }
    return out;
  }

  #walkCells(parents: readonly Candidate[] | null): readonly Candidate[] {
    const out: Candidate[] = [];
    if (parents?.every((parent) => parent.cells !== undefined)) {
      for (const parent of parents) {
        out.push(...MarkdownTree.#cellsOf(parent));
      }
      return out;
    }
    for (const table of this.#tablesInScope(null)) {
      for (const row of [table.header, ...table.body]) {
        if (row === null) continue;
        out.push(...MarkdownTree.#cellsOf(row));
      }
    }
    return MarkdownTree.#inScope(out, parents);
  }

  /** The cells of one row candidate as cell candidates (the row's cells are read
   *  from the mdast cell nodes — never a `|` split). */
  static #cellsOf(row: Candidate): readonly Candidate[] {
    return (row.cells ?? []).map((cell) => ({
      text: cell,
      bare: cell,
      lines: row.lines,
      line: row.line,
      cells: row.cells,
      from: row.from,
      to: row.to,
    }));
  }

  /** The list-item candidates — one per source line of every list item. */
  #listCandidates(): readonly Candidate[] {
    const out: Candidate[] = [];
    for (const node of this.#collect("listItem")) {
      const span = MarkdownTree.#spanOf(node);
      if (span === null) continue;
      for (let line = span.start; line <= span.end; line += 1) {
        const text = this.#line(line).trim();
        if (text === "") continue;
        out.push({
          text,
          bare: this.#bareOf(line),
          lines: [text],
          line,
          from: span.start,
          to: span.end,
        });
      }
    }
    return out;
  }

  /** The task-field candidates — the block's `#### Key` heading line plus its value
   *  lines (the reader normalizes the legacy bullet shape into the same fields, so
   *  one declaration locates both). */
  #taskFieldCandidates(): readonly Candidate[] {
    this.tasks();
    const out: Candidate[] = [];
    for (const [index, block] of this.tasks().entries()) {
      const spans = this.#fieldSpanCache[index] ?? [];
      for (const [fieldIndex, field] of block.fields.entries()) {
        const span = spans[fieldIndex];
        const start = span?.start ?? block.range.start;
        const end = span?.end ?? block.range.end;
        const anchor = `#### ${field.key}`;
        out.push({
          text: anchor,
          bare: anchor,
          lines: field.lines,
          line: start,
          from: start,
          to: end,
        });
        for (const line of field.lines) {
          out.push({
            text: line,
            bare: line,
            lines: [line],
            line: start,
            from: start,
            to: end,
          });
        }
      }
    }
    return out;
  }

  /** The task-step candidates — one per raw step line of a block's `Steps` field
   *  (the line the step shapes judge, never a reconstruction). */
  #taskStepCandidates(): readonly Candidate[] {
    const out: Candidate[] = [];
    for (const block of this.tasks()) {
      for (const field of block.fields) {
        if (field.key !== "Steps") continue;
        for (const line of field.lines) {
          if (!TaskBlockGrammar.STEP_LINE.test(line)) continue;
          out.push({
            text: line,
            bare: MarkdownTree.#stripText(line),
            lines: [line],
            line: block.range.start,
            from: block.range.start,
            to: block.range.end,
          });
        }
      }
    }
    return out;
  }

  /** The graph surface's candidates — one per non-empty body line of a dependency
   *  graph section (the repo's graph rows live in a code fence, so the fence lines
   *  are skipped and the edge/legend lines are the nodes). A `P<n> -> P<m>` line is
   *  classified as a hard or soft edge; a legend/prose line stays unclassified (its
   *  shape is the legend element's own declared pattern). */
  #edgeCandidates(): readonly Candidate[] {
    const out: Candidate[] = [];
    for (const section of this.sections()) {
      if (!/^## Dependency graph/.test(section.text.trim())) continue;
      for (let index = 0; index < section.lines.length; index += 1) {
        const text = (section.lines[index] ?? "").trim();
        if (text === "" || /^```/.test(text)) continue;
        const line = section.line + index + 1;
        const arrow = /^P\d+(\.\d+)*\s*->\s*P\d+(\.\d+)*/.test(text);
        out.push({
          text,
          bare: text,
          lines: [text],
          line,
          from: section.line,
          to: section.line + section.lines.length,
          ...(arrow
            ? { edgeClass: /\bsoft\b/.test(text.slice(text.indexOf("->"))) ? "soft" : "hard" }
            : {}),
        });
      }
    }
    return out;
  }

  // -------------------------------------------------------------------------
  // the document index
  // -------------------------------------------------------------------------

  #line(line: number): string {
    return this.#lines[line - 1] ?? "";
  }

  /** The line with its inline-code spans removed (the citation boundary read from
   *  the tree's own `inlineCode` node spans). */
  #bareOf(line: number): string {
    return MarkdownTree.#stripSpans(this.#line(line), this.#codeSpans.get(line) ?? []);
  }

  /** The text with every inline-code span removed (a reconstructed line's bare view). */
  static #stripText(text: string): string {
    return text.replace(/`+[^`]*`+/g, "");
  }

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

  /** The document headings with their bodies, in document order. */
  #headingsOf(): readonly HeadingNode[] {
    const nodes = (this.#root.children ?? []).filter((node) => node.type === "heading");
    const out: HeadingNode[] = [];
    for (const [index, node] of nodes.entries()) {
      const span = MarkdownTree.#spanOf(node);
      if (span === null) continue;
      const next = nodes[index + 1];
      const nextSpan = next === undefined ? null : MarkdownTree.#spanOf(next);
      const end = nextSpan === null ? this.#lines.length : nextSpan.start - 1;
      out.push({
        text: this.#line(span.start).trim(),
        depth: node.depth ?? 1,
        line: span.start,
        bodyLines: this.#lines.slice(span.end, Math.max(end, span.end)),
      });
    }
    return out;
  }

  /** The front-matter key locators — the YAML block's `key: value` lines. The
   *  block's TYPED values stay the front-matter extractor's job; the tree only
   *  locates the key's line (identity versus location). */
  #frontMatterOf(): readonly FrontMatterKeyNode[] {
    const out: FrontMatterKeyNode[] = [];
    for (const node of this.#root.children ?? []) {
      if (node.type !== "yaml") continue;
      const span = MarkdownTree.#spanOf(node);
      if (span === null) continue;
      for (let line = span.start + 1; line < span.end; line += 1) {
        const match = /^([A-Za-z0-9_-]+):(.*)$/.exec(this.#line(line).trim());
        if (match === null) continue;
        out.push({ key: match[1] ?? "", value: (match[2] ?? "").trim(), line });
      }
      return out;
    }
    return out;
  }

  /** Every table of the document, in document order — the owning heading line plus
   *  the header row and the body rows (cells read from the mdast cell nodes). */
  #tablesOf(): readonly TableRecord[] {
    const out: TableRecord[] = [];
    for (const node of this.#collect("table")) {
      const span = MarkdownTree.#spanOf(node);
      if (span === null) continue;
      const rows = (node.children ?? [])
        .map((row) => this.#rowOf(row))
        .filter((row) => row !== null);
      const [header, ...body] = rows;
      out.push({
        heading: this.#owningHeading(span.start),
        header: header === undefined ? null : { ...header, header: true },
        body: body.map((row) => ({ ...row, header: false })),
        from: span.start,
        to: span.end,
      });
    }
    return out;
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

  /** The heading line an element at `line` sits under (the table's owning section). */
  #owningHeading(line: number): string {
    let current = "";
    for (const heading of this.#headings) {
      if (heading.line > line) break;
      current = heading.text;
    }
    return current;
  }

  /** One mdast table row → its cells (each cell the raw source slice of the cell's
   *  own span; an escaped `\|` and a backticked pipe stay inside their cell). */
  #rowOf(node: MdNode): Candidate | null {
    const span = MarkdownTree.#spanOf(node);
    if (span === null) return null;
    const cells = (node.children ?? [])
      .filter((cell) => cell.type === "tableCell")
      .map((cell) => MarkdownTree.#cellText(cell, this.#lines));
    const text = this.#line(span.start).trim();
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

  /** The tables scoped to a parent selection — a parent heading's span, or every
   *  table when no parent was given. */
  #tablesInScope(parents: readonly Candidate[] | null): readonly TableRecord[] {
    if (parents === null) return this.#tables;
    return this.#tables.filter((table) =>
      parents.some((parent) => table.from >= parent.from && table.to <= parent.to),
    );
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

  /** Every mdast node of one type, in document order (a bounded recursive walk). */
  #collect(type: string): readonly MdNode[] {
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

  /** The 1-based line span of one node. */
  static #spanOf(node: MdNode): { readonly start: number; readonly end: number } | null {
    const start = node.position?.start?.line;
    const end = node.position?.end?.line;
    if (start === undefined || end === undefined) return null;
    return { start, end };
  }

  // -------------------------------------------------------------------------
  // the task-block parse (the ONE block grammar — the reader facade delegates here)
  // -------------------------------------------------------------------------

  /** Parse the `### Task N:` blocks from the mdast top-level headings. */
  #parseTasks(): {
    readonly blocks: readonly TaskBlock[];
    readonly sections: readonly (readonly TaskSection[])[];
  } {
    const nodes = this.#root.children ?? [];
    const blocks: TaskBlock[] = [];
    const allSections: (readonly TaskSection[])[] = [];
    for (const [index, node] of nodes.entries()) {
      if (node.type !== "heading" || node.depth !== 3) continue;
      const match = TaskBlockGrammar.TASK_HEADING.exec(this.#nodeText(node).trim());
      if (match === null) continue;
      const start = node.position?.start?.line ?? 0;
      if (start === 0) continue;
      const boundary = this.#blockBoundary(nodes, index);
      const inner = nodes.slice(index + 1, boundary.index);
      const shape = inner.some(
        (child) =>
          child.type === "heading" &&
          child.depth === 4 &&
          TaskBlockGrammar.RESERVED.includes(this.#nodeText(child).trim()),
      )
        ? "heading"
        : "legacy";
      const end = boundary.line - 1;
      const sections =
        shape === "heading"
          ? this.#headingSections(inner, end)
          : this.#legacySections(inner, start + 1, end);
      const block: TaskBlock = {
        id: Number(match[1]),
        heading: this.#line(start),
        fields: sections.map((section) => ({ key: section.key, lines: section.lines })),
        steps: this.#stepsOf(sections),
        range: { start, end },
        shape,
      };
      this.#assertNoDuplicateKeys(block);
      blocks.push(block);
      allSections.push(sections);
    }
    return { blocks, sections: allSections };
  }

  /** The node index/line at which one block ends — the first following top-level
   *  heading of rank 3 or shallower, or the document's last non-blank line. */
  #blockBoundary(
    nodes: readonly MdNode[],
    index: number,
  ): { readonly index: number; readonly line: number } {
    for (let next = index + 1; next < nodes.length; next += 1) {
      const node = nodes[next];
      if (node?.type !== "heading" || (node.depth ?? 0) > 3) continue;
      return { index: next, line: node.position?.start?.line ?? this.#lines.length };
    }
    return { index: nodes.length, line: this.#lines.length + 1 };
  }

  /** The heading sections of a new-shape block — every depth-4 heading partitions
   *  the block; a heading with no body still registers (the author's empty value). */
  #headingSections(inner: readonly MdNode[], blockEnd: number): readonly TaskSection[] {
    const sections: TaskSection[] = [];
    for (const [index, node] of inner.entries()) {
      if (node?.type !== "heading" || node.depth !== 4) continue;
      const line = node.position?.start?.line;
      if (line === undefined) continue;
      let end = blockEnd;
      for (const next of inner.slice(index + 1)) {
        const nextLine = next?.position?.start?.line;
        if (next?.type === "heading" && nextLine !== undefined) {
          end = nextLine - 1;
          break;
        }
      }
      sections.push({
        key: this.#nodeText(node).trim(),
        start: line,
        end,
        lines: this.#valueLines(line + 1, end),
      });
    }
    return sections;
  }

  /** The legacy sections of a compatibility-shape block — the `- **Key**:` markers
   *  and their continuation runs. A `####` extension section inside the block is a
   *  field of its own and never leaks into the preceding bullet's run. */
  #legacySections(inner: readonly MdNode[], from: number, to: number): readonly TaskSection[] {
    const spans = this.#headingSections(inner, to);
    const inSpan = (line: number): boolean =>
      spans.some((span) => line >= span.start && line <= span.end);
    const sections: TaskSection[] = [];
    for (let line = from; line <= to; line += 1) {
      if (inSpan(line)) continue;
      const match = TaskBlockGrammar.LEGACY_FIELD.exec(this.#line(line));
      if (match === null) continue;
      let end = to;
      for (let next = line + 1; next <= to; next += 1) {
        if (inSpan(next) || TaskBlockGrammar.LEGACY_FIELD.test(this.#line(next))) {
          end = next - 1;
          break;
        }
      }
      const rem = (match[2] ?? "").trim();
      const rest = this.#valueLines(line + 1, end);
      sections.push({
        key: (match[1] ?? "").trim(),
        start: line,
        end,
        lines: rem === "" ? rest : [rem, ...rest],
      });
    }
    return [...sections, ...spans];
  }

  /** The trimmed, blank-dropping raw lines of one inclusive 1-based span. */
  #valueLines(from: number, to: number): readonly string[] {
    const out: string[] = [];
    for (let line = from; line <= to; line += 1) {
      const text = this.#line(line).trim();
      if (text !== "") out.push(text);
    }
    return out;
  }

  /** The parsed steps of a block — the `Steps` field's bullet lines. */
  #stepsOf(sections: readonly TaskSection[]): readonly TaskStep[] {
    const steps = sections.find((section) => section.key === "Steps");
    if (steps === undefined) return [];
    const out: TaskStep[] = [];
    for (const line of steps.lines) {
      const match = TaskBlockGrammar.STEP_LINE.exec(line);
      if (match === null) continue;
      const text = (match[1] ?? "").trim();
      const marker = text.indexOf(TaskBlockGrammar.CHECKABLE);
      if (marker === -1) {
        out.push({ action: text, checkable: null });
        continue;
      }
      out.push({
        action: text.slice(0, marker).trim(),
        checkable: text.slice(marker + TaskBlockGrammar.CHECKABLE.length).trim(),
      });
    }
    return out;
  }

  /** Reject a duplicated reserved key inside one block (the section identity is the
   *  parse face's own invariant, loud at parse time). */
  #assertNoDuplicateKeys(block: TaskBlock): void {
    const seen = new Set<string>();
    for (const field of block.fields) {
      if (!TaskBlockGrammar.RESERVED.includes(field.key)) continue;
      if (seen.has(field.key)) {
        throw new Error(
          `task ${block.id} carries the reserved section "#### ${field.key}" more than once`,
        );
      }
      seen.add(field.key);
    }
  }

  /** The plain text of one mdast node (the heading text / key surface). */
  #nodeText(node: MdNode | undefined): string {
    if (node === undefined) return "";
    if (typeof node.value === "string") return node.value;
    return (node.children ?? []).map((child) => this.#nodeText(child)).join("");
  }
}
