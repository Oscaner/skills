// packages/cdd-engine/src-next/contract/markdown-tree.ts
// P21 §7.5 — the ONE parse face of the contract plane: the markdown tree.
//
// The four doc types (overall / plan / phase-spec / single-spec) share one
// document model. `MarkdownTree.parse(content)` is the single `from-markdown`
// entry of the tree (gfm + YAML front matter extensions): every consumer — the
// doc parsers, the home extractors, the invariant strategies, the skeleton
// round-trip pin — locates structure through it, never through a hand-written
// line scan.
//
// The face is three classes behind one facade, split along their responsibilities:
//   · `MarkdownDocument` (markdown-document.ts) — the document index: one mdast
//     parse, the headings, the front-matter keys, the tables, the code spans.
//   · `SelectorEngine` (selector-engine.ts) — selector evaluation: `from` a parent
//     selector or the root, `walk` one of the nine structural surfaces, `match`,
//     `when`.
//   · `TaskBlocksParser` (task-block-grammar.ts) — the ONE task-block grammar.
// This class is the thin composition facade; it adds the cross-cutting section-text
// read and re-exports the vocabulary, so no consumer pays for the split.
//
// The two axes the tree keeps apart (the P21 identity/locator split):
//   · IDENTITY — a registry element's `anchor` (the schema property name, the
//     `required[]` key, the skeleton truth-table key, the lint lookup key, the
//     `field:` of a finding). The tree never touches it.
//   · LOCATION — an element's `selector`: a composable query (`from` a parent
//     selector or the document root, `walk` one of the nine structural walks,
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

import { MarkdownDocument } from "./markdown-document.ts";
import type {
  FrontMatterKeyNode,
  HeadingNode,
  ResolvedNode,
  SectionNode,
  Selector,
  TreeEdge,
} from "./markdown-tree-types.ts";
import { SelectorEngine } from "./selector-engine.ts";
import { TaskBlockGrammar, TaskBlocksParser } from "./task-block-grammar.ts";
import type { TaskBlock } from "./task-blocks.ts";

export type {
  FrontMatterKeyNode,
  HeadingNode,
  ResolvedNode,
  SectionNode,
  Selector,
  TreeEdge,
  Walk,
  When,
} from "./markdown-tree-types.ts";
export { TaskBlockGrammar } from "./task-block-grammar.ts";

/**
 * MarkdownTree — the ONE parse face: one document, one selector evaluation, one
 * block parse, composed behind a stable read surface. Instances are immutable after
 * construction; the walks are pure reads, so one tree serves the parse face, the
 * extractors and the judgment face alike.
 */
export class MarkdownTree {
  /** The document index — the one parse every walk reads. */
  readonly #document: MarkdownDocument;
  /** The composable locator face over the index. */
  readonly #selectors: SelectorEngine;
  /** The ONE `### Task N:` block parse over the index. */
  readonly #blocks: TaskBlocksParser;

  private constructor(document: MarkdownDocument) {
    this.#document = document;
    this.#blocks = new TaskBlocksParser(document);
    this.#selectors = new SelectorEngine(document, this.#blocks);
  }

  /** Parse a document — the single `from-markdown` entry of the tree. The input
   *  text is expected already normalized (the canonicalize view at the row
   *  source); the tree never rewrites it. */
  static parse(content: string): MarkdownTree {
    return new MarkdownTree(MarkdownDocument.parse(content));
  }

  /** The first node matching the selector — null when nothing matches (the
   *  presence read). */
  resolve(selector: Selector): ResolvedNode | null {
    return this.#selectors.resolve(selector);
  }

  /** Every node matching the selector, in document order. */
  occurrences(selector: Selector): readonly ResolvedNode[] {
    return this.#selectors.occurrences(selector);
  }

  /** The rank-2 sections of the document, in document order (the section surface
   *  every doc type's `##`-heading read rides). */
  sections(): readonly SectionNode[] {
    return this.#document.sections();
  }

  /** The headings of the document (any rank), in document order. */
  headings(): readonly HeadingNode[] {
    return this.#document.headings();
  }

  /** The front-matter keys of the document, in document order. */
  frontMatterKeys(): readonly FrontMatterKeyNode[] {
    return this.#document.frontMatterKeys();
  }

  /** The cell rows of the selector's row matches (the parse face's table read). */
  rows(selector: Selector): readonly (readonly string[])[] {
    return this.#selectors.rows(selector);
  }

  /** The table of the section under one heading — the section's first table plus
   *  its headerless continuation runs, header from the first (see SelectorEngine). */
  tableUnder(heading: string | RegExp): {
    header: readonly string[] | null;
    body: readonly (readonly string[])[];
  } | null {
    return this.#selectors.tableUnder(heading);
  }

  /** The list items whose first child is itself a list — the doubled-marker shape
   *  (`- - x`); a thematic break is exempt by construction. */
  doubledMarkerItems(): readonly ResolvedNode[] {
    return this.#selectors.doubledMarkerItems();
  }

  /** The `## Dependency graph` edges of the document, in document order. */
  edges(): readonly TreeEdge[] {
    return this.#selectors.edges();
  }

  /** The `### Task N:` blocks of the document, in document order — the ONE block
   *  structure parse (the heading shape and the legacy bullet shape normalize into
   *  the same record). */
  tasks(): readonly TaskBlock[] {
    return this.#blocks.tasks();
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
    return this.#selectors.matches(selector, text);
  }
}
