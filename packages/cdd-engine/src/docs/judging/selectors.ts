// packages/cdd-engine/src/docs/judging/selectors.ts
// The SELECTOR EVALUATION of the tree: `from` a parent location (or the document root),
// `walk` one of the nine structural surfaces, apply `match`, then the `when` guard. A
// selector answers WHERE, never WHAT — the engine returns resolved nodes and the judgment
// plane decides what they mean.
//
// The engine reads the document index (`grammar/markdown-document.ts`) and the block parse
// (`grammar/task-blocks.ts`); it owns no parse of its own, so a selector can never drift
// from the structure those two classes read. It is also the tree's only locator face: the
// grammar exposes location facts (a heading's span, a table's rows) and this class is where
// a declared element's location query is turned into nodes.
//
// Module-level exports are the types and the class — zero behaviour-carrying bare functions.

import { MarkdownDocument } from "../grammar/markdown-document.ts";
import type { MarkdownTree } from "../grammar/markdown-tree.ts";
import { TaskBlocks } from "../grammar/task-blocks.ts";
import type { TableRecord, TableRow, TaskSection } from "../grammar/types.ts";
import type { ElementLocation, Walk, When } from "../identity/types.ts";

/** The step bullet of one `Steps` value line — the shape the step walk reads. The block
 *  grammar normalizes a step into a value line and declares no step constant of its own, so
 *  the leaf's own shape is read here, beside the walk that yields it. */
const STEP_LINE = /^[-*]\s+/;

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
  /** The cell's 1-based column ordinal inside its row — set for cell walks. */
  readonly column?: number;
}

/** One candidate the walks produce before matching — a resolved node plus the span the
 *  child walks scope themselves to. */
export interface Candidate extends ResolvedNode {
  /** The candidate's span start line (the child-walk scope). */
  readonly from: number;
  /** The candidate's span end line (the child-walk scope). */
  readonly to: number;
  /** The table row is a column-header row (the `tableBody` guard excludes it). */
  readonly header?: boolean;
  /** The graph edge class (`hard` / `soft`) — the graphEdge walk's literal match. */
  readonly edgeClass?: "hard" | "soft";
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

/** One line span a child walk may be scoped to. */
interface LineSpan {
  readonly from: number;
  readonly to: number;
}

/**
 * SelectorEngine — the composable locator face: one evaluation per declared location over
 * the document index. Invariant: every walk reads the one document index and the one block
 * parse it was constructed with, so a selector and the parse face can never disagree about
 * the structure.
 *
 * Rule zero (over the 200-line class limit): the nine walks stay one class because they
 * share the candidate / match / guard machinery and each is a pure read of the same index —
 * a per-surface split would only move surface area.
 */
export class SelectorEngine {
  readonly #document: MarkdownDocument;
  readonly #blocks: TaskBlocks;

  /** `blocks` is the caller's own block parse of the same tree, so the `taskField` /
   *  `taskStep` walks and the `inTaskBlock` guard read the structure the rest of the
   *  judgment reads. */
  constructor(tree: MarkdownTree, blocks: TaskBlocks = TaskBlocks.of(tree)) {
    this.#document = tree.document;
    this.#blocks = blocks;
  }

  /** The first node matching the location — null when nothing matches (the presence read). */
  resolve(location: ElementLocation): ResolvedNode | null {
    return this.#candidates(location)[0] ?? null;
  }

  /** Every node matching the location, in document order. */
  occurrences(location: ElementLocation): readonly ResolvedNode[] {
    return this.#candidates(location);
  }

  /** The cell rows of the location's row matches (the parse face's table read). */
  rows(location: ElementLocation): readonly (readonly string[])[] {
    return this.#candidates(location).map((candidate) => candidate.cells ?? []);
  }

  /** The table of the section under one heading (a heading line or a heading prefix) — the
   *  section-scoped table read the doc parsers and the strategies use. A GFM table ends at
   *  a blank line, but a SECTION's table may be split by interior blank lines (the
   *  repository's own Phase / Issue inventories are): the section span is the table's
   *  boundary, so the section's first table and the headerless continuation runs in it read
   *  as ONE record — header from the first table, body rows concatenated in document order.
   *  A separately-headed table is its own table, never blended into this read. Null when the
   *  section carries no table. */
  tableUnder(heading: string | RegExp): {
    header: readonly string[] | null;
    body: readonly (readonly string[])[];
  } | null {
    const parents = this.#candidates({ from: "root", walk: "heading", match: heading });
    return SelectorEngine.#mergeTables(this.#tablesInScope(parents));
  }

  /** The list items whose first child is itself a list — the doubled-marker shape
   *  (`- - x`): the outer item carries a nested list and no own prose. A thematic break
   *  (`- - -`) parses as a separator, never as a list item, so it is exempt by construction.
   *  One node per source line (a nested stack on one line is one doubled-marker fact). */
  doubledMarkerItems(): readonly ResolvedNode[] {
    const out: ResolvedNode[] = [];
    const seen = new Set<number>();
    for (const node of this.#document.collect("listItem")) {
      const [first] = node.children ?? [];
      if (first?.type !== "list") continue;
      const span = MarkdownDocument.spanOf(node);
      if (span === null || seen.has(span.start)) continue;
      seen.add(span.start);
      const text = this.#document.line(span.start).trim();
      out.push({
        text,
        bare: this.#document.bareOf(span.start),
        lines: [text],
        line: span.start,
      });
    }
    return out;
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

  /** Whether a text conforms to a location's match face (the section / registry conformance
   *  read — the same match semantics the walks apply). */
  matches(location: ElementLocation, text: string): boolean {
    return SelectorEngine.#matchesText(location.walk, location.match, text, undefined);
  }

  // -------------------------------------------------------------------------
  // selector evaluation
  // -------------------------------------------------------------------------

  /** The matched candidates of one location — resolve the parent scope, walk it, then apply
   *  the match, the column guard and the `when` guard. */
  #candidates(location: ElementLocation): readonly Candidate[] {
    const parents = location.from === "root" ? null : this.#candidates(location.from);
    if (parents !== null && parents.length === 0) return [];
    const walked = this.#walk(location.walk, parents);
    const matched = walked.filter((candidate) =>
      SelectorEngine.#matchesText(
        location.walk,
        location.match,
        candidate.text,
        candidate.edgeClass,
      ),
    );
    return this.#guard(SelectorEngine.#inColumn(matched, location.column), location.when);
  }

  /** The walk over one structural surface, scoped to the parents' line spans when a parent
   *  location was given. */
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
        return SelectorEngine.#inScope(this.#listCandidates(), parents);
      case "taskField":
        return SelectorEngine.#inScope(this.#fieldCandidates(), parents);
      case "taskStep":
        return SelectorEngine.#inScope(this.#stepCandidates(), parents);
      case "graphEdge":
        return SelectorEngine.#inScope(this.#edgeCandidates(), parents);
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

  /** Whether a candidate sits inside a `### Task N:` block (the `inTaskBlock` guard's
   *  structural fact, read off the block ranges). */
  #isTaskScoped(candidate: Candidate): boolean {
    return this.#blocks
      .blocks()
      .some((block) => candidate.from >= block.range.start && candidate.to <= block.range.end);
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

  /** The column guard: a cell locator judges only the cell at its declared ordinal. */
  static #inColumn(
    candidates: readonly Candidate[],
    column: number | undefined,
  ): readonly Candidate[] {
    if (column === undefined) return candidates;
    return candidates.filter((candidate) => candidate.column === column);
  }

  /** The match face: a literal (exact line, or a heading anchor's line prefix), a RegExp
   *  over the raw line, and — for the graphEdge walk — the edge-class literal
   *  (`hard` / `soft`). */
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
    return text === match || text.startsWith(match);
  }

  /** Merge one section's table with the headerless continuation runs inside it — the base is
   *  the first HEADED table, and only a headerless record (a blank-line detached continuation
   *  run) is folded in. A separately-headed table is its own read and is never blended into
   *  the section's one record. */
  static #mergeTables(tables: readonly TableRecord[]): {
    header: readonly string[] | null;
    body: readonly (readonly string[])[];
  } | null {
    const base = tables.find((table) => table.header !== null) ?? tables[0];
    if (base === undefined) return null;
    const rows = [
      ...base.body,
      ...tables
        .filter((table) => table !== base && table.header === null)
        .flatMap((table) => table.body),
    ].sort((left, right) => left.from - right.from);
    const body = rows.map((row) => [...row.cells]);
    return { header: base.header === null ? null : [...base.header.cells], body };
  }

  // -------------------------------------------------------------------------
  // the walks
  // -------------------------------------------------------------------------

  #walkFrontMatter(): readonly Candidate[] {
    return this.#document.frontMatterKeys().map((entry) => ({
      text: entry.key,
      bare: entry.key,
      lines: [this.#document.line(entry.line)],
      line: entry.line,
      from: entry.line,
      to: entry.line,
    }));
  }

  #walkHeadings(parents: readonly Candidate[] | null): readonly Candidate[] {
    const out: Candidate[] = this.#document.scopes().map((heading) => ({
      text: heading.text,
      bare: this.#document.bareOf(heading.line),
      lines: [heading.text],
      line: heading.line,
      from: heading.from,
      to: heading.to,
    }));
    return SelectorEngine.#inScope(out, parents);
  }

  /** The table rows of the addressed tables — the header row plus the body rows (the `row`
   *  walk drops the header under its `tableBody` guard). */
  #walkTables(parents: readonly Candidate[] | null): readonly Candidate[] {
    const out: Candidate[] = [];
    for (const table of this.#tablesInScope(parents)) {
      // A row candidate carries the TABLE's span, so a child walk scoped to a row still
      // knows which table it belongs to (the row's own line is `line`).
      if (table.header !== null) {
        out.push(this.#rowCandidate(table.header, true, table));
      }
      for (const row of table.body) {
        out.push(this.#rowCandidate(row, false, table));
      }
    }
    return out;
  }

  /** One table row as a candidate — its text is the row's RAW source line (a declared pattern
   *  anchored on the row's leading `|` judges the row as written), and its cells are the
   *  grammar's own cell read. */
  #rowCandidate(
    row: TableRow,
    header: boolean,
    table: { readonly from: number; readonly to: number },
  ): Candidate {
    const text = this.#document.line(row.line).trim();
    return {
      text,
      bare: this.#document.bareOf(row.line),
      lines: [text],
      line: row.line,
      cells: row.cells,
      header,
      from: table.from,
      to: table.to,
    };
  }

  #walkCells(parents: readonly Candidate[] | null): readonly Candidate[] {
    const out: Candidate[] = [];
    if (parents?.every((parent) => parent.cells !== undefined)) {
      for (const parent of parents) {
        out.push(...SelectorEngine.#cellsOf(parent));
      }
      return out;
    }
    for (const table of this.#tablesInScope(null)) {
      for (const row of [table.header, ...table.body]) {
        if (row === null) continue;
        out.push(...SelectorEngine.#cellsOf(this.#rowCandidate(row, row === table.header, table)));
      }
    }
    return SelectorEngine.#inScope(out, parents);
  }

  /** The cells of one row candidate as cell candidates — each carrying its 1-based column
   *  ordinal so a cell locator can be column-precise. */
  static #cellsOf(row: Candidate): readonly Candidate[] {
    return (row.cells ?? []).map((cell, index) => ({
      text: cell,
      bare: cell,
      lines: row.lines,
      line: row.line,
      cells: row.cells,
      column: index + 1,
      from: row.from,
      to: row.to,
    }));
  }

  /** The list-item candidates — one per source line of every list item. */
  #listCandidates(): readonly Candidate[] {
    const out: Candidate[] = [];
    for (const node of this.#document.collect("listItem")) {
      const span = MarkdownDocument.spanOf(node);
      if (span === null) continue;
      for (let line = span.start; line <= span.end; line += 1) {
        const text = this.#document.line(line).trim();
        if (text === "") continue;
        out.push({
          text,
          bare: this.#document.bareOf(line),
          lines: [text],
          line,
          from: span.start,
          to: span.end,
        });
      }
    }
    return out;
  }

  /** The task-field candidates — each block's `#### Key` anchor line plus its value lines.
   *  The legacy bullet shape normalizes into the same sections, so one declaration locates
   *  both block shapes. */
  #fieldCandidates(): readonly Candidate[] {
    const out: Candidate[] = [];
    for (const block of this.#blocks.blocks()) {
      for (const section of block.sections) {
        out.push(...SelectorEngine.#fieldCandidatesOf(section));
      }
    }
    return out;
  }

  /** One task section as field candidates — the anchor line (`#### Key`) first, then one
   *  candidate per value line. Each carries the SECTION's own span, so a child walk scoped to
   *  one field never reads a neighbouring field's value lines. */
  static #fieldCandidatesOf(section: TaskSection): readonly Candidate[] {
    const out: Candidate[] = [];
    const anchor = `#### ${section.key}`;
    out.push({
      text: anchor,
      bare: anchor,
      lines: section.lines,
      line: section.start,
      from: section.start,
      to: section.end,
    });
    for (const entry of section.entries) {
      out.push({
        text: entry.text,
        bare: entry.text,
        lines: [entry.text],
        line: entry.line,
        from: section.start,
        to: section.end,
      });
    }
    return out;
  }

  /** The task-step candidates — one per step bullet line of a block's `Steps` section (the
   *  line the step shapes judge, never a reconstruction). */
  #stepCandidates(): readonly Candidate[] {
    const out: Candidate[] = [];
    for (const block of this.#blocks.blocks()) {
      const steps = block.sections.find((section) => section.key === "Steps");
      if (steps === undefined) continue;
      for (const entry of steps.entries) {
        if (!STEP_LINE.test(entry.text)) continue;
        out.push({
          text: entry.text,
          bare: this.#document.bareOf(entry.line),
          lines: [entry.text],
          line: entry.line,
          from: block.range.start,
          to: block.range.end,
        });
      }
    }
    return out;
  }

  /** The graph surface's candidates — one per non-empty body line of a dependency graph
   *  section (the repository's graph rows live in a code fence, so the fence lines are
   *  skipped and the edge / legend lines are the nodes). A `P<n> -> P<m>` line is classified
   *  as a hard or soft edge; a legend / prose line stays unclassified (its shape is the
   *  legend element's own declared pattern). */
  #edgeCandidates(): readonly Candidate[] {
    const out: Candidate[] = [];
    for (const section of this.#document.sections()) {
      if (!/^## Dependency graph/.test(section.text.trim())) continue;
      for (const [index, text] of section.lines.entries()) {
        const trimmed = text.trim();
        if (trimmed === "" || /^```/.test(trimmed)) continue;
        const line = section.line + index + 1;
        const arrow = /^P\d+(\.\d+)*\s*->\s*P\d+(\.\d+)*/.test(trimmed);
        out.push({
          text: trimmed,
          bare: trimmed,
          lines: [trimmed],
          line,
          from: section.line,
          to: section.line + section.lines.length,
          ...(arrow
            ? { edgeClass: /\bsoft\b/.test(trimmed.slice(trimmed.indexOf("->"))) ? "soft" : "hard" }
            : {}),
        });
      }
    }
    return out;
  }

  /** The tables scoped to a parent selection — a parent heading's span, or every table when
   *  no parent was given. */
  #tablesInScope(parents: readonly LineSpan[] | null): readonly TableRecord[] {
    const tables = this.#document.tables();
    if (parents === null) return tables;
    return tables.filter((table) =>
      parents.some((parent) => table.from >= parent.from && table.to <= parent.to),
    );
  }
}
