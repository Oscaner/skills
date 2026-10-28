// packages/cdd-engine/src-next/contract/selector-spec.ts
// P21 §7.5 — the selector constructors. A registry element declares its LOCATION
// as a `Selector` (markdown-tree.ts): where the element lives in a conforming
// document, never what it means. This module is the one place those queries are
// built, so a composed query (a cell inside a row inside a table) reads as one
// expression at the declaration row instead of a nested object literal.
//
// The constructors are data factories: they return plain `Selector` values and
// hold no state, so a declaration row stays flat declared data (the registry is
// still the single knowledge source). The module imports the selector TYPES only
// — the tree's runtime never depends on the declaration face.

import type { Selector, Walk, When } from "./markdown-tree.ts";

/** The scope a walk starts from — the document root or a parent selector. */
type SelectorScope = "root" | Selector;

/**
 * SelectorSpec — the selector factory face. One static per walk; every factory
 * takes the walk's scope (a parent selector or the document root) plus its match
 * and guard, and returns the composed `Selector`.
 */
// biome-ignore lint/complexity/noStaticOnlyClass: the plan-mandated static factory face — the zero-bare-function discipline admits no standalone builder functions.
export class SelectorSpec {
  /** The document root scope — a walk that starts at the whole document. */
  static readonly ROOT: "root" = "root";

  /** A front-matter key locator: the declared key name, located in the head block. */
  static frontmatter(key: string): Selector {
    return { from: SelectorSpec.ROOT, walk: "frontmatter", match: key };
  }

  /** A heading locator — a literal heading line (or a heading-prefix RegExp),
   *  optionally scoped under a parent selector. */
  static heading(match: string | RegExp, from: SelectorScope = SelectorSpec.ROOT): Selector {
    return { from, walk: "heading", match };
  }

  /** The body rows of the table under a section heading scope. */
  static table(from: SelectorScope = SelectorSpec.ROOT, match?: string | RegExp): Selector {
    return match === undefined ? { from, walk: "table" } : { from, walk: "table", match };
  }

  /** The rows of a table selection — `tableBody` drops the column-header row. */
  static row(from: SelectorScope, match?: string | RegExp, when: When = "tableBody"): Selector {
    const selector: Selector = { from, walk: "row", when };
    return match === undefined ? selector : { ...selector, match };
  }

  /** The cells of a row selection (a cell-level value token). */
  static cell(from: SelectorScope, match: string | RegExp): Selector {
    return { from, walk: "cell", match };
  }

  /** The list items of a scope (the bullet surfaces: constraint deltas, legends). */
  static list(
    from: SelectorScope = SelectorSpec.ROOT,
    match?: string | RegExp,
    when?: When,
  ): Selector {
    const selector: Selector =
      when === undefined ? { from, walk: "list" } : { from, walk: "list", when };
    return match === undefined ? selector : { ...selector, match };
  }

  /** One task block's reserved field (the `#### Key` section) — the field heading
   *  line and its value lines. */
  static taskField(
    match: string | RegExp,
    from: SelectorScope = SelectorSpec.ROOT,
    when?: When,
  ): Selector {
    const selector: Selector =
      when === undefined ? { from, walk: "taskField" } : { from, walk: "taskField", when };
    return { ...selector, match };
  }

  /** One task block's step leaf. */
  static taskStep(match?: string | RegExp, when?: When): Selector {
    const selector: Selector =
      when === undefined
        ? { from: SelectorSpec.ROOT, walk: "taskStep" }
        : { from: SelectorSpec.ROOT, walk: "taskStep", when };
    return match === undefined ? selector : { ...selector, match };
  }

  /** One dependency-graph edge — a `hard` / `soft` class literal or a line RegExp. */
  static graphEdge(match?: "hard" | "soft" | RegExp): Selector {
    return match === undefined
      ? { from: SelectorSpec.ROOT, walk: "graphEdge" }
      : { from: SelectorSpec.ROOT, walk: "graphEdge", match };
  }

  /** The walk of a selector (the declaration face's introspection read). */
  static walkOf(selector: Selector): Walk {
    return selector.walk;
  }
}
