// packages/cdd-engine/src-next/contract/home-extractors.ts
// P21 §7.5 — the home-driven extractors, now selector resolution. Each class
// serves one home surface (design-body · section/facet) and answers the same
// question it always did — "which nodes of this document carry my elements?" —
// but it answers it by RESOLVING the registry element's declared `selector`
// against the ONE markdown tree (markdown-tree.ts), never by scanning raw lines
// with a hand-written per-home grammar. WHICH anchors belong to a home, and WHERE
// each one sits, both come from the registry (D26 single source).
//
// The unified entry — extract(registry, tree) — maps each served anchor to the
// texts of its resolved occurrences, in document order.
//
// Module-level exports are types / the classes — zero behavior-carrying bare
// functions (the plan's zero-bare-function discipline).

import type { ElementRegistry, Home, RegistryElement } from "./declare.ts";
import type { MarkdownTree } from "./markdown-tree.ts";

/** The unified extraction record — each served anchor → its occurrence texts. */
export type ExtractionMap = Record<string, readonly string[]>;

/** One decomposed numbered heading — the leading number token and the heading text. */
export interface NumberedHeading {
  /** The leading number token (`1` for `### 1. …`, `1.1` for `#### 1.1 …`). */
  number: string;
  /** The heading text after the number token. */
  heading: string;
}

/** One scanned section — a rank-2 heading line plus its body lines. */
export interface ScannedSection {
  /** The section heading line verbatim. */
  readonly heading: string;
  /** The body lines up to the next rank-2 heading. */
  readonly lines: readonly string[];
}

/**
 * The home-extractor base — the shared selector resolution every home builds on.
 * Stateless by design: `extract` reads the injected registry and tree per call, so
 * one shared instance per home services every consumer.
 */
export abstract class HomeExtractor {
  /** The home surfaces this extractor serves. */
  abstract readonly homes: readonly Home[];

  /** The unified extraction entry — the served anchors → their occurrence texts. */
  abstract extract(registry: ElementRegistry, tree: MarkdownTree): ExtractionMap;

  /** The registered elements of one served home surface. */
  protected elementsOf(registry: ElementRegistry, home: Home): readonly RegistryElement[] {
    return registry.elements.filter((element) => element.home === home);
  }

  /** Resolve every served anchor's declared selector against the tree — the ONE
   *  extraction path (no home re-declares a locating grammar). An anchor with no
   *  occurrence is absent from the map. */
  protected collect(
    registry: ElementRegistry,
    tree: MarkdownTree,
    homes: readonly Home[],
  ): ExtractionMap {
    const out: Record<string, readonly string[]> = {};
    for (const home of homes) {
      for (const element of this.elementsOf(registry, home)) {
        const hits = tree.occurrences(element.selector).map((node) => node.text);
        if (hits.length > 0) out[element.anchor] = hits;
      }
    }
    return out;
  }
}

/**
 * The design-body extractor — the double-layer `### N.` group / `#### N.M` item
 * headings and the `## Design` / `### Acceptance criteria` leaves. The
 * numbered-heading decomposition (the number token before the dot/space and the
 * text after) lives here — the parse face consumes it; the LOCATION of each leaf
 * is the element's declared selector.
 */
export class DesignBodyExtractor extends HomeExtractor {
  readonly homes = ["design-body"] as const;

  extract(registry: ElementRegistry, tree: MarkdownTree): ExtractionMap {
    return this.collect(registry, tree, this.homes);
  }

  /** One `### N.` group heading's number and text (the digit before the dot, the text after). */
  groupOf(heading: string): NumberedHeading {
    return this.#splitHeading(heading, "### ".length, true);
  }

  /** One `#### N.M` item heading's composite number and text (the token before the first space, the text after). */
  itemOf(heading: string): NumberedHeading {
    return this.#splitHeading(heading, "#### ".length, false);
  }

  /** The shared numbered-heading split — the number token ends at the first dot
   *  (group form) or the first space (item form); the text is the trimmed rest. */
  #splitHeading(heading: string, prefixLength: number, dotTerminated: boolean): NumberedHeading {
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
 * The heading scanner — the section/facet home's registered heading anchors. The
 * section surface's fixed structure rule (only `##`-ranked headings are sections)
 * reads the tree's heading nodes; WHICH `##` heading is a declared section comes
 * from the registry's declared selectors.
 */
export class HeadingScanner extends HomeExtractor {
  readonly homes = ["section", "facet"] as const;

  extract(registry: ElementRegistry, tree: MarkdownTree): ExtractionMap {
    return this.collect(registry, tree, this.homes);
  }

  /** The registered rank-2 section headings of a document, in document order —
   *  every rank-2 heading a declared element's selector claims, whichever home owns
   *  it (a section-home heading, the conditional-home headings and the design-body
   *  `## Design` are all section surfaces). A heading whose text is registered in no
   *  home (an undeclared prose section) is not a section. */
  sectionsOf(registry: ElementRegistry, tree: MarkdownTree): readonly ScannedSection[] {
    const out: ScannedSection[] = [];
    for (const section of tree.sections()) {
      if (!this.#declared(registry, tree, section.text)) continue;
      out.push({ heading: section.text, lines: section.lines });
    }
    return out;
  }

  /** Whether a rank-2 heading line is a declared section surface — a registry
   *  element's `heading` selector accepts it. */
  #declared(registry: ElementRegistry, tree: MarkdownTree, heading: string): boolean {
    return registry.elements.some(
      (element) => element.selector.walk === "heading" && tree.matches(element.selector, heading),
    );
  }
}
