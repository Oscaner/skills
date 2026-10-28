// packages/cdd-engine/src-next/contract/selector-engine.ts
// P21 §7.5 — the SELECTOR EVALUATION of the tree: `from` a parent selector (or the
// document root), `walk` one of the nine structural surfaces, apply `match`, then
// the `when` guard. A selector answers WHERE, never WHAT — the engine returns
// resolved nodes and the judgment plane decides what they mean.
//
// The engine reads the document index (markdown-document.ts) and the block parse
// (task-block-grammar.ts); it owns no parse of its own, so a selector can never
// drift from the structure the other two classes read.

import { MarkdownDocument } from "./markdown-document.ts";
import type {
  Candidate,
  LineSpan,
  ResolvedNode,
  Selector,
  TableRecord,
  TreeEdge,
  Walk,
  When,
} from "./markdown-tree-types.ts";
import type { TaskBlocksParser } from "./task-block-grammar.ts";

/**
 * SelectorEngine — the composable locator face: one evaluation per declared
 * selector over the document index. Stateless after construction; every read is
 * pure, so one engine serves the parse face and the judgment face alike.
 *
 * Rule zero (over the 200-line class limit): the nine walks stay one class because
 * they share the candidate / match / guard machinery and each is a pure read of the
 * same index — a per-surface split would only move surface area.
 */
export class SelectorEngine {
  readonly #document: MarkdownDocument;
  readonly #blocks: TaskBlocksParser;

  constructor(document: MarkdownDocument, blocks: TaskBlocksParser) {
    this.#document = document;
    this.#blocks = blocks;
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

  /** The cell rows of the selector's row matches (the parse face's table read). */
  rows(selector: Selector): readonly (readonly string[])[] {
    return this.#candidates(selector).map((candidate) => candidate.cells ?? []);
  }

  /** The table a selector addresses: the column-header row plus the body rows
   *  (null when the selector matches no table). Every table in the selector's span
   *  is read: the header comes from the first, the body rows concatenate in
   *  document order. */
  table(
    selector: Selector,
  ): { header: readonly string[] | null; body: readonly (readonly string[])[] } | null {
    const parents = selector.from === "root" ? null : this.#candidates(selector.from);
    return SelectorEngine.#mergeTables(this.#tablesInScope(parents));
  }

  /** The table of the section under one heading (a heading line or a heading
   *  prefix) — the section-scoped table read the doc parsers and the strategies
   *  use. A GFM table ends at a blank line, but a SECTION's table may be split by
   *  interior blank lines (the repository's own Phase / Issue inventories are): the
   *  section span is the table's boundary, so every table in it is read — header
   *  from the first, body rows concatenated in document order. Null when the
   *  section carries no table. */
  tableUnder(heading: string | RegExp): {
    header: readonly string[] | null;
    body: readonly (readonly string[])[];
  } | null {
    const parents = this.#candidates({ from: "root", walk: "heading", match: heading });
    return SelectorEngine.#mergeTables(this.#tablesInScope(parents));
  }

  /** The list items whose first child is itself a list — the doubled-marker shape
   *  (`- - x`): the outer item carries a nested list and no own prose. A thematic
   *  break (`- - -`) parses as a separator, never as a list item, so it is exempt by
   *  construction. One node per source line (a nested stack on one line is one
   *  doubled-marker fact). */
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

  /** Whether a text conforms to a selector's match face (the section/registry
   *  conformance read — the same match semantics the walks apply). */
  matches(selector: Selector, text: string): boolean {
    return SelectorEngine.#matchesText(selector.walk, selector.match, text, undefined);
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
      SelectorEngine.#matchesText(
        selector.walk,
        selector.match,
        candidate.text,
        candidate.edgeClass,
      ),
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
        return SelectorEngine.#inScope(this.#listCandidates(), parents);
      case "taskField":
        return SelectorEngine.#inScope(this.#blocks.fieldCandidates(), parents);
      case "taskStep":
        return SelectorEngine.#inScope(this.#blocks.stepCandidates(), parents);
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

  /** Whether a candidate sits inside a `### Task N:` block (the `inTaskBlock`
   *  guard's structural fact, read off the block ranges). */
  #isTaskScoped(candidate: Candidate): boolean {
    return this.#blocks
      .tasks()
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

  /** Merge every table of one scope into the section's one table read — the
   *  header of the first table, the body rows of all of them, in document order. */
  static #mergeTables(tables: readonly TableRecord[]): {
    header: readonly string[] | null;
    body: readonly (readonly string[])[];
  } | null {
    const [first, ...rest] = tables;
    if (first === undefined) return null;
    const body: (readonly string[])[] = [];
    for (const table of [first, ...rest]) {
      for (const row of table.body) body.push([...(row.cells ?? [])]);
    }
    return { header: first.header?.cells ?? null, body };
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
    const out: Candidate[] = this.#document.headingScopes().map((heading) => ({
      text: heading.text,
      bare: this.#document.bareOf(heading.line),
      lines: [heading.text],
      line: heading.line,
      from: heading.from,
      to: heading.to,
    }));
    return SelectorEngine.#inScope(out, parents);
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
        out.push(...SelectorEngine.#cellsOf(parent));
      }
      return out;
    }
    for (const table of this.#tablesInScope(null)) {
      for (const row of [table.header, ...table.body]) {
        if (row === null) continue;
        out.push(...SelectorEngine.#cellsOf(row));
      }
    }
    return SelectorEngine.#inScope(out, parents);
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

  /** The graph surface's candidates — one per non-empty body line of a dependency
   *  graph section (the repo's graph rows live in a code fence, so the fence lines
   *  are skipped and the edge/legend lines are the nodes). A `P<n> -> P<m>` line is
   *  classified as a hard or soft edge; a legend/prose line stays unclassified (its
   *  shape is the legend element's own declared pattern). */
  #edgeCandidates(): readonly Candidate[] {
    const out: Candidate[] = [];
    for (const section of this.#document.sections()) {
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

  /** The tables scoped to a parent selection — a parent heading's span, or every
   *  table when no parent was given. */
  #tablesInScope(parents: readonly LineSpan[] | null): readonly TableRecord[] {
    return this.#document.tablesInScope(parents);
  }
}
