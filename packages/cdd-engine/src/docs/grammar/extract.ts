// packages/cdd-engine/src/docs/grammar/extract.ts
// The home-driven extraction: which anchors of a document carry a value, answered from
// the document's own structure and the registry's HOME assignment.
//
// A home is the registry's grouping of elements by the surface they read (`design-body`,
// `section`, `facet`). The extractor therefore takes its answer from two inputs and no
// third: the tree (where things are) and the elements' declared home (which anchors this
// surface serves). Move an element to another home and the extraction result moves with
// it — the projection holds no copy of the registry.
//
// Extraction is a read: no element is required to exist, and an anchor with no
// occurrence is simply absent from the map.

import type { MarkdownTree } from "./markdown-tree.ts";

/** One home surface a document's elements can read. */
export type Home = "design-body" | "section" | "facet" | "conditional";

/** One registry element as the extraction reads it: an anchor, the home it belongs to
 *  and the rank-2 heading whose section carries its value. */
export interface HomeElement {
  /** The schema property name this element answers to. */
  readonly anchor: string;
  /** The home surface the element belongs to. */
  readonly home: Home;
  /** The rank-2 heading the element's value sits under. */
  readonly heading: string;
}

/** The extraction result — each served anchor → the heading lines it resolved to. */
export type ExtractionMap = Record<string, readonly string[]>;

/**
 * HomeExtractor — the registry-driven extraction over one tree. Invariant: an anchor is
 * extracted only when its element's home is among the served homes AND its heading is
 * present in the document; the result depends on the home assignment, never on a
 * hard-coded anchor list. Stateless after construction.
 */
export class HomeExtractor {
  readonly #elements: readonly HomeElement[];

  constructor(elements: readonly HomeElement[]) {
    this.#elements = elements;
  }

  /** The homes the current registry declares, in declaration order. */
  homes(): readonly Home[] {
    const out: Home[] = [];
    for (const element of this.#elements) if (!out.includes(element.home)) out.push(element.home);
    return out;
  }

  /** Extract the anchors of the served homes — each anchor mapped to the heading lines
   *  its section resolved to, in document order. */
  extract(tree: MarkdownTree, homes: readonly Home[]): ExtractionMap {
    const out: ExtractionMap = {};
    for (const element of this.#elements) {
      if (!homes.includes(element.home)) continue;
      const hits = this.#resolve(tree, element.heading);
      if (hits.length > 0) out[element.anchor] = hits;
    }
    return out;
  }

  /** The rank-2 headings the element's declared heading matches — an exact normalized
   *  match, so a section the document does not carry contributes nothing rather than a
   *  prefix hit. */
  #resolve(tree: MarkdownTree, heading: string): readonly string[] {
    const wanted = heading.trim();
    const hits: string[] = [];
    for (const section of tree.sections()) {
      const text = section.text
        .trim()
        .replace(/^#+\s*/, "")
        .trim();
      if (text !== wanted) continue;
      hits.push(section.text.trim());
    }
    return hits;
  }
}
