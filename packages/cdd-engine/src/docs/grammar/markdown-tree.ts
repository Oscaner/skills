// packages/cdd-engine/src/docs/grammar/markdown-tree.ts
// The markdown tree: the document index read as a HEADING TREE, with the fence
// boundary stated once.
//
// Fence awareness is the property this module exists to keep visible: a `## Heading`
// line inside a fenced block is sample prose, not structure, and a `| a | b |` inside
// one is not a table. The boundary is the mdast parse's own (`code` nodes), never a
// hand-written scan for backticks — so the tree cannot disagree with the index about
// which lines are code.
//
// The tree adds two reads over the index and nothing else: the NESTING of headings by
// rank (the tree proper), and one rank-2 section's text (a brief's `## Constraints`
// mirror, which must not be truncated by a deeper heading inside it).

import { MarkdownDocument } from "./markdown-document.ts";
import { TaskBlockGrammar } from "./task-blocks.ts";
import type { HeadingNode, SectionNode } from "./types.ts";

/** One heading and the headings nested under it. */
export interface HeadingBranch {
  /** The heading record. */
  readonly heading: HeadingNode;
  /** The branch's child headings, in document order. */
  readonly children: readonly HeadingBranch[];
}

/**
 * MarkdownTree — one document read as a heading tree. Immutable after construction;
 * every read is pure, so one instance serves the extractors and the judgments alike.
 */
export class MarkdownTree {
  readonly #document: MarkdownDocument;
  readonly #branches: readonly HeadingBranch[];

  private constructor(document: MarkdownDocument) {
    this.#document = document;
    this.#branches = MarkdownTree.#nest(document.headings());
  }

  /** Parse a document into its tree — the single construction entry. */
  static parse(content: string): MarkdownTree {
    return new MarkdownTree(MarkdownDocument.parse(content));
  }

  /** The index this tree reads — one parse, shared by every walk. */
  get document(): MarkdownDocument {
    return this.#document;
  }

  /** The headings of the document (any rank), in document order. */
  headings(): readonly HeadingNode[] {
    return this.#document.headings();
  }

  /** The headings NESTED by rank — the tree proper. */
  branches(): readonly HeadingBranch[] {
    return this.#branches;
  }

  /** The rank-2 sections of the document, in document order. */
  sections(): readonly SectionNode[] {
    return this.#document.sections();
  }

  /** Whether a line sits inside a fenced or indented code block. */
  isCodeLine(line: number): boolean {
    return this.#document.isCodeLine(line);
  }

  /** The body text of one rank-2 section, heading line included, trailing whitespace
   *  trimmed; "" when the section is absent. A `### Task N:` head ends the section (a
   *  task block never lives inside a rank-2 body) while a deeper plain heading stays
   *  in it — a brief must not truncate its `## Constraints` at its first `####`. */
  sectionText(heading: string): string {
    for (const section of this.sections()) {
      if (!MarkdownTree.#sameHeading(section.text, heading)) continue;
      const body: string[] = [];
      for (const line of section.lines) {
        if (TaskBlockGrammar.HEADING.test(line.trim().replace(/^### /, ""))) break;
        body.push(line);
      }
      return [section.text, ...body].join("\n").replace(/\s+$/, "");
    }
    return "";
  }

  /** Whether a heading line names `name` — the fence markers and surrounding
   *  whitespace dropped (the one heading comparison the tree owns). */
  static #sameHeading(text: string, name: string): boolean {
    const trimmed = text.trim();
    return trimmed === name || trimmed.replace(/^#+\s*/, "").trim() === name;
  }

  /** Nest the flat heading list by rank: a heading is a child of the nearest preceding
   *  heading of a smaller rank, and a top-level entry otherwise. */
  static #nest(headings: readonly HeadingNode[]): readonly HeadingBranch[] {
    const roots: HeadingBranch[] = [];
    const open: { depth: number; branch: MutableBranch }[] = [];
    for (const heading of headings) {
      const branch: MutableBranch = { heading, children: [] };
      while (open.length > 0 && open[open.length - 1]!.depth >= heading.depth) open.pop();
      const parent = open[open.length - 1];
      if (parent === undefined) roots.push(branch);
      else parent.branch.children.push(branch);
      open.push({ depth: heading.depth, branch });
    }
    return roots;
  }
}

/** A branch under construction — the same shape as `HeadingBranch`, with a growable
 *  child list, so the nesting pass never copies a deep tree per heading. */
interface MutableBranch {
  readonly heading: HeadingNode;
  readonly children: HeadingBranch[];
}
