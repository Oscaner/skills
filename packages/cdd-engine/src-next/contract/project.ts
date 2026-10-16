// packages/cdd-engine/src-next/contract/project.ts
// T3 — the projection face: the six derived surfaces (shape / schema / slices /
// tokens / reference / skeleton) are projected from the declared registries
// (declare.ts) through one shared derivation chain.
//
// Every surface is pure derivation from the registries injected at construction —
// zero hand-written shape prose, zero duplicated data. The chain: each registry
// row is projected onto a derived identity (anchor · presence · ref-kind · home ·
// value pattern), and the six projection methods each select the face their
// consumers need:
//   · shape       — the section skeleton: registry rows grouped by home surface
//                   in first-occurrence order (the interpreter's structure walk);
//   · schema      — a JSON Schema per doc type (properties keyed by anchor, the
//                   required set from the required-presence elements, property
//                   descriptions carrying presence · home · ref-kind);
//   · slices      — the parse face: every element's anchor-literal slice (escaped
//                   anchor, closed under parsing — each slice parses its anchor)
//                   plus the declared value pattern compiled for line/cell
//                   matching;
//   · tokens      — the flat anchor lexicon, one token per registered element;
//   · reference   — the per-element reference vocabulary (ref-kind + value
//                   pattern), one entry per registered element;
//   · skeleton    — the required-only doc-skeleton face (spec §4.1): every
//                   required element classified into its placeholder-anchoring
//                   slot kind (content / link / numeric-heading / generator-truth
//                   / table-header / table-row / scaffold) in shape-group order —
//                   the skeleton the `cdd schema get <type> --output skeleton`
//                   render face (D19) assembles.
//
// The module's whole behavior surface is the Projector class (the zero-bare-
// function discipline: module-level exports are types / the class — the projection
// helpers and the escape primitive are private members). The schema/shape bytes are
// pinned from the new tree's first version by the test suite (byte snapshots) —
// both serializations are insertion-order deterministic, so the pinned bytes are
// stable across runs.

import type {
  DeclaredRegistries,
  DocType,
  ElementRegistry,
  Home,
  Presence,
  RefKind,
  RegistryElement,
} from "./declare.ts";

/** The projection record keys — mirrors the declared-registries record shape ({ "overall-spec", plan, "phase-spec", "single-spec" }). */
export type DocKey = "overall-spec" | "plan" | "phase-spec" | "single-spec";

// ---------------------------------------------------------------------------
// shared derivation chain
// ---------------------------------------------------------------------------

/** The derived identity of one declared element — the chain root every projection selects from. */
interface DerivedElement {
  /** The machine anchor token the element keys on. */
  anchor: string;
  /** Whether a conforming document must carry the element. */
  presence: Presence;
  /** The referential kind the element participates in — "none" for presence-only elements. */
  refKind: RefKind;
  /** The document surface the anchor lives in. */
  home: Home;
  /** The declared value shape, when the element carries one. */
  valuePattern?: string;
}

// ---------------------------------------------------------------------------
// shape — the section skeleton
// ---------------------------------------------------------------------------

/** One projected shape element — the structural identity of a registered element. */
export interface ShapeElement {
  /** The machine anchor token. */
  anchor: string;
  /** Whether the conforming document must carry the element. */
  presence: Presence;
  /** The referential kind the element participates in. */
  refKind: RefKind;
}

/** One section skeleton group — the registered elements of one home surface, in registry order. */
export interface ShapeGroup {
  /** The document surface the group collects (header, section, facet, table, …). */
  home: Home;
  /** The surface's elements, in registry order. */
  elements: readonly ShapeElement[];
}

/** One doc type's shape projection — its section structure grouped by home surface. */
export interface DocShape {
  /** The doc-type identity the projection derives from. */
  docType: DocType;
  /** The section skeleton: non-empty groups in first home-occurrence order. */
  structure: readonly ShapeGroup[];
}

// ---------------------------------------------------------------------------
// schema — the JSON Schema face
// ---------------------------------------------------------------------------

/** One schema property — a registered element's value shape as a JSON Schema property. */
export interface SchemaProperty {
  /** Every declared element's line/cell is a string. */
  type: "string";
  /** The declared value pattern — matches the element's line/cell in a conforming document. */
  pattern: string;
  /** The property description — the element's identity (presence · home · ref). */
  description: string;
}

/** One doc type's derived JSON Schema — one property per registered element that declares a value pattern; the required set is the required-presence anchors. */
export interface DocSchema {
  /** The doc-type identity the projection derives from. */
  docType: DocType;
  /** The JSON Schema draft the structure targets. */
  $schema: string;
  /** Derived doc-type label. */
  title: string;
  /** Derived summary of the projected structure (element and required counts). */
  description: string;
  /** The manifest is an object over the declared anchor keys. */
  type: "object";
  /** One property per registered element that declares a value pattern, in registry order (required-presence anchors appear in `required` regardless of a declared pattern). */
  properties: Record<string, SchemaProperty>;
  /** The anchors a conforming document must carry, in registry order. */
  required: string[];
}

// ---------------------------------------------------------------------------
// slices — the parse face
// ---------------------------------------------------------------------------

/** One element's parse face — the anchor-literal slice plus the declared value slice. */
export interface ElementSlice {
  /** The machine anchor token the slice parses. */
  anchor: string;
  /** Whether a conforming document must carry the element. */
  presence: Presence;
  /** The document surface the anchor lives in. */
  home: Home;
  /**
   * The anchor-literal slice — the escaped anchor compiled. It parses the
   * anchor itself (each slice parses its own anchor) and locates the literal
   * token inside a document line.
   */
  anchorPattern: RegExp;
  /** The value slice — the declared value pattern compiled; matches the element's line/cell in a document. */
  valuePattern?: RegExp;
}

/** One doc type's parse face — one slice per registered element, in registry order. */
export interface DocSlices {
  /** The doc-type identity the projection derives from. */
  docType: DocType;
  /** The slice rows, in registry order. */
  slices: readonly ElementSlice[];
}

// ---------------------------------------------------------------------------
// tokens — the anchor lexicon
// ---------------------------------------------------------------------------

/** One projected token — an anchor of the doc-type vocabulary. */
export interface DocToken {
  /** The machine anchor token. */
  anchor: string;
  /** Whether a conforming document must carry the element. */
  presence: Presence;
  /** The document surface the anchor lives in. */
  home: Home;
  /** The referential kind the element participates in. */
  refKind: RefKind;
}

/** One doc type's lexicon — one token per registered element, in registry order. */
export interface DocTokens {
  /** The doc-type identity the projection derives from. */
  docType: DocType;
  /** The token rows, in registry order. */
  tokens: readonly DocToken[];
}

// ---------------------------------------------------------------------------
// reference — the reference vocabulary
// ---------------------------------------------------------------------------

/** One reference entry — the referential role a registered element participates in. */
export interface ReferenceEntry {
  /** The machine anchor token. */
  anchor: string;
  /** The referential kind the element participates in ("none" for presence-only elements). */
  refKind: RefKind;
  /** The declared value pattern the reference rides on, when the element carries one. */
  valuePattern?: string;
}

/** One doc type's reference projection — one entry per registered element, in registry order. */
export interface DocReference {
  /** The doc-type identity the projection derives from. */
  docType: DocType;
  /** The reference rows, in registry order. */
  entries: readonly ReferenceEntry[];
}

// ---------------------------------------------------------------------------
// skeleton — the doc-skeleton face (the schema-gen rendering input)
// ---------------------------------------------------------------------------

/** The slot kinds of one skeleton element — how the element's value renders in
 *  the assembled markdown skeleton (spec §4.1, the placeholder-anchoring
 *  strategy: pure content slots take `:::fill`, link-shaped anchors a placeholder
 *  link, structure is always true value). */
export type SlotKind =
  /** A free-text value position — the ONLY `:::fill <slot>` landing class. */
  | "content"
  /** A link-shaped anchor slot — the parent-program / spec-ref links render as a
   *  placeholder link (a `<…>` target on the exemption chain), never `:::fill`. */
  | "link"
  /** A digit-family heading — `N.` / `N.M` / `Task N:` render with true numbers
   *  (a literal `N` would puncture the declared digit-shaped value pattern). */
  | "numeric-heading"
  /** A pattern-typed truth row — an enum domain's first legal literal (`**Status**:
   *  Draft`) or a graph row (hard edge / legend) — a conforming row, not a fill. */
  | "generator-truth"
  /** A table column-header row. */
  | "table-header"
  /** A table data row. */
  | "table-row"
  /** The fixed scaffold lines — the version row, the table version/date tokens and
   *  the fixed structure headings — structural, never fill positions. */
  | "scaffold";

/** One skeleton slot — a required element's contribution to the assembled skeleton. */
export interface SkeletonSlot {
  /** The machine anchor token. */
  anchor: string;
  /** Required elements only — every projected slot is required. */
  presence: Presence;
  /** The document surface the anchor lives in. */
  home: Home;
  /** The skeleton slot kind — the element's placeholder-anchoring class (spec §4.1). */
  slot: SlotKind;
  /** The declared value shape, when the element carries one. */
  valuePattern?: string;
  /** The referential kind the element participates in. */
  refKind: RefKind;
}

/** One doc type's skeleton projection — the required-only slot list in shape
 *  home-group order (optional/conditional elements generate no slot — the zero
 *  conditional-residue contract mirrored at the skeleton surface). */
export interface DocSkeleton {
  /** The doc-type identity the projection derives from. */
  docType: DocType;
  /** The required elements' slots in shape home-group order. */
  slots: readonly SkeletonSlot[];
}

// ---------------------------------------------------------------------------
// the six projection faces
// ---------------------------------------------------------------------------

/** The shape projection record — one DocShape per doc type. */
export type ShapeProjection = Record<DocKey, DocShape>;
/** The schema projection record — one DocSchema per doc type. */
export type SchemaProjection = Record<DocKey, DocSchema>;
/** The slices projection record — one DocSlices per doc type. */
export type SlicesProjection = Record<DocKey, DocSlices>;
/** The tokens projection record — one DocTokens per doc type. */
export type TokensProjection = Record<DocKey, DocTokens>;
/** The reference projection record — one DocReference per doc type. */
export type ReferenceProjection = Record<DocKey, DocReference>;
/** The skeleton projection record — one DocSkeleton per doc type. */
export type SkeletonProjection = Record<DocKey, DocSkeleton>;

/** The composed six-projection surface derived from the declared registries. */
export interface ProjectedRegistries {
  shape: ShapeProjection;
  schema: SchemaProjection;
  slices: SlicesProjection;
  tokens: TokensProjection;
  reference: ReferenceProjection;
  skeleton: SkeletonProjection;
}

/**
 * The projection carrier — the registered registries' single derivation surface.
 * Constructed on the declared registries (the domain's `declaredRegistries`),
 * its seven methods project the six faces (shape / schema / slices / tokens /
 * reference / skeleton) and their composed record. Every surface is pure
 * derivation from the injected registries; construction is cheap and the
 * instance is stateless after construction, so sharing one instance across the
 * consumers (the parsers, the contract, the lint, the graph) composes safely.
 */
export class Projector {
  /** The declared registries every projection derives from — the construction input. */
  readonly #registries: DeclaredRegistries;

  constructor(registries: DeclaredRegistries) {
    this.#registries = registries;
  }

  /** Derive all four doc types' section-skeleton faces. */
  shape(): ShapeProjection {
    return this.#projectAll((registry) => this.#projectDocShape(registry));
  }

  /** Derive all four doc types' JSON Schema faces. */
  schema(): SchemaProjection {
    return this.#projectAll((registry) => this.#projectDocSchema(registry));
  }

  /** Derive all four doc types' parse-regex faces. */
  slices(): SlicesProjection {
    return this.#projectAll((registry) => this.#projectDocSlices(registry));
  }

  /** Derive all four doc types' anchor lexicons. */
  tokens(): TokensProjection {
    return this.#projectAll((registry) => this.#projectDocTokens(registry));
  }

  /** Derive all four doc types' reference vocabularies. */
  reference(): ReferenceProjection {
    return this.#projectAll((registry) => this.#projectDocReference(registry));
  }

  /** Derive all four doc types' required-only doc-skeleton faces. */
  skeleton(): SkeletonProjection {
    return this.#projectAll((registry) => this.#projectDocSkeleton(registry));
  }

  /** The composed projection face — all six derived surfaces over the injected registries. */
  registries(): ProjectedRegistries {
    return {
      shape: this.shape(),
      schema: this.schema(),
      slices: this.slices(),
      tokens: this.tokens(),
      reference: this.reference(),
      skeleton: this.skeleton(),
    };
  }

  /**
   * Escape a literal so it can be embedded verbatim in a RegExp — the
   * anchor-literal → parse-regex derivation the slices face is built on. Every
   * declared anchor escapes to a pattern that matches the anchor itself (the
   * "each slice parses its anchor" checkable).
   */
  static #escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // -------------------------------------------------------------------------
  // shared derivation chain — the chain root every projection selects from
  // -------------------------------------------------------------------------

  /** Project one registry row onto the derived identity (refKind materialized to its "none" default). */
  #deriveElement(element: RegistryElement): DerivedElement {
    return {
      anchor: element.anchor,
      presence: element.presence,
      refKind: element.refKind ?? "none",
      home: element.home,
      valuePattern: element.valuePattern,
    };
  }

  /** Derive the whole registry rows of one doc type. */
  #deriveRegistry(registry: ElementRegistry): DerivedElement[] {
    return registry.elements.map((element) => this.#deriveElement(element));
  }

  /** Map a per-registry projector across the four injected registries, keyed by their record identity. */
  #projectAll<T>(project: (registry: ElementRegistry) => T): Record<DocKey, T> {
    return {
      "overall-spec": project(this.#registries["overall-spec"]),
      plan: project(this.#registries.plan),
      "phase-spec": project(this.#registries["phase-spec"]),
      "single-spec": project(this.#registries["single-spec"]),
    };
  }

  // -------------------------------------------------------------------------
  // the per-face projectors
  // -------------------------------------------------------------------------

  /** Project one registry onto its section-structure face (one shape element per registered element). */
  #projectDocShape(registry: ElementRegistry): DocShape {
    const groups: ShapeGroup[] = [];
    const groupSlotOf = new Map<Home, number>();
    for (const element of this.#deriveRegistry(registry)) {
      let slot = groupSlotOf.get(element.home);
      if (slot === undefined) {
        slot = groups.length;
        groupSlotOf.set(element.home, slot);
        groups.push({ home: element.home, elements: [] });
      }
      (groups[slot].elements as ShapeElement[]).push({
        anchor: element.anchor,
        presence: element.presence,
        refKind: element.refKind,
      });
    }
    return { docType: registry.docType, structure: groups };
  }

  /** Project one registry onto its JSON Schema face. */
  #projectDocSchema(registry: ElementRegistry): DocSchema {
    const elements = this.#deriveRegistry(registry);
    const properties: Record<string, SchemaProperty> = {};
    const required: string[] = [];
    for (const element of elements) {
      if (element.valuePattern !== undefined) {
        properties[element.anchor] = {
          type: "string",
          pattern: element.valuePattern,
          description: `presence: ${element.presence} · home: ${element.home} · ref: ${element.refKind}`,
        };
      }
      if (element.presence === "required") required.push(element.anchor);
    }
    return {
      docType: registry.docType,
      $schema: "https://json-schema.org/draft/2020-12/schema",
      title: `${registry.docType} document structure`,
      description: `Derived JSON Schema — ${elements.length} declared elements · ${required.length} required`,
      type: "object",
      properties,
      required,
    };
  }

  /** Project one registry onto its parse-regex face. */
  #projectDocSlices(registry: ElementRegistry): DocSlices {
    const slices: ElementSlice[] = [];
    for (const element of this.#deriveRegistry(registry)) {
      slices.push({
        anchor: element.anchor,
        presence: element.presence,
        home: element.home,
        anchorPattern: new RegExp(Projector.#escapeRegExp(element.anchor)),
        valuePattern:
          element.valuePattern === undefined ? undefined : new RegExp(element.valuePattern),
      });
    }
    return { docType: registry.docType, slices };
  }

  /** Project one registry onto its anchor-lexicon face. */
  #projectDocTokens(registry: ElementRegistry): DocTokens {
    return {
      docType: registry.docType,
      tokens: this.#deriveRegistry(registry).map((element) => ({
        anchor: element.anchor,
        presence: element.presence,
        home: element.home,
        refKind: element.refKind,
      })),
    };
  }

  /** Project one registry onto its reference-vocabulary face. */
  #projectDocReference(registry: ElementRegistry): DocReference {
    return {
      docType: registry.docType,
      entries: this.#deriveRegistry(registry).map((element) => ({
        anchor: element.anchor,
        refKind: element.refKind,
        valuePattern: element.valuePattern,
      })),
    };
  }

  // -------------------------------------------------------------------------
  // the skeleton face — the required-only doc-skeleton projection (spec §4.1)
  // -------------------------------------------------------------------------

  /** Project one registry onto its doc-skeleton face — the required elements'
   *  slots in the shape's home-group order (the shape walk is the ordering
   *  source: group sequence + within-group registry order, never a second order
   *  declaration). Optional/conditional elements generate no slot — the zero
   *  conditional-residue contract mirrored at the skeleton surface. */
  #projectDocSkeleton(registry: ElementRegistry): DocSkeleton {
    const byAnchor = new Map(
      this.#deriveRegistry(registry).map((element) => [element.anchor, element]),
    );
    const slots: SkeletonSlot[] = [];
    for (const group of this.#projectDocShape(registry).structure) {
      for (const element of group.elements) {
        const derived = byAnchor.get(element.anchor)!;
        if (derived.presence !== "required") continue;
        slots.push(this.#skeletonSlot(derived));
      }
    }
    return { docType: registry.docType, slots };
  }

  /** Project one derived element onto its skeleton slot row. */
  #skeletonSlot(element: DerivedElement): SkeletonSlot {
    return {
      anchor: element.anchor,
      presence: element.presence,
      home: element.home,
      slot: this.#skeletonSlotOf(element),
      valuePattern: element.valuePattern,
      refKind: element.refKind,
    };
  }

  /** Classify one required element's slot kind — the placeholder-anchoring
   *  semantics of the element's value (spec §4.1):
   *   · link            — the parent-program / spec-ref link-shaped anchors render
   *                       as placeholder links (`:::fill` never lands on them — a
   *                       fill in a link slot is a guaranteed finding);
   *   · numeric-heading — the digit-family headings (`N.` / `N.M` / `Task N:`)
   *                       whose numbers are true values in the skeleton, never a
   *                       literal `N` (a literal `N` punctures the declared
   *                       digit-shaped value pattern);
   *   · generator-truth — a pattern-typed value row: a fully-anchored enum domain
   *                       (the first legal literal — `**Status**` → Draft) or a
   *                       graph row (hard edge / legend conforming lines);
   *   · table-header / table-row / scaffold — the table column headers, the data
   *                       rows and the fixed scaffold rows (the version line, the
   *                       table version/date tokens, the fixed structure headings);
   *   · content        — the remaining free-text value positions — the ONLY
   *                       `:::fill` landing class (pure content slots carry zero
   *                       fully-anchored enum / graph elements).
   */
  #skeletonSlotOf(element: DerivedElement): SlotKind {
    // The link-typed anchor slots are the HEADER parent-program / spec-ref links
    // (`**Parent program**` · the plan's `**Spec:**`) — the enum-typed table cells
    // (a Design-spec cell, a markdown-link implementation-plan cell) ride the
    // generator-truth class, never a link slot.
    if (
      element.home === "header" &&
      (element.refKind === "parent-program" || element.refKind === "spec-ref") &&
      element.valuePattern !== undefined &&
      /\\\[/.test(element.valuePattern)
    )
      return "link";
    if (
      (element.anchor.startsWith("#") || element.anchor === "Task id token") &&
      element.valuePattern !== undefined &&
      /\\d/.test(element.valuePattern)
    )
      return "numeric-heading";
    if (element.anchor === "**Version**") return "scaffold";
    if (element.home === "graph" || Projector.#isEnumPattern(element.valuePattern))
      return "generator-truth";
    if (element.home === "table") {
      if (element.anchor.endsWith(" columns")) return "table-header";
      if (element.anchor.endsWith(" row")) return "table-row";
      // The dependency cell is a free-text cell value (`:::fill` — a P->P shape to
      // fill, not a structural token) — every other table token (version / date /
      // phase id) is fixed scaffold.
      if (element.anchor === "Dependency cell") return "content";
      return "scaffold";
    }
    // The doc title is the header's one free-text position (a fill slot) — every
    // other remaining heading anchor is fixed structure.
    if (element.anchor === "# Title") return "content";
    if (element.anchor.startsWith("#")) return "scaffold";
    return "content";
  }

  /** Whether a declared value pattern is a point-enum form — a bare pipe inside an
   *  alternative group (escapes stripped first: the declared patterns escape their
   *  literal metacharacters — `\|` = a table bar, `\[` = a literal bracket — while
   *  the enum alternatives ride BARE pipes inside unescaped group parens; parens
   *  inside the character classes are skipped). The strip leaves the character
   *  classes partially intact — the scan tracks class brackets so a `)` inside
   *  `[^)]` never closes the group. The first legal literal is the generator truth. */
  static #isEnumPattern(valuePattern: string | undefined): boolean {
    if (valuePattern === undefined) return false;
    const unescaped = valuePattern.replace(/\\./g, "");
    let depth = 0;
    let inClass = false;
    for (const char of unescaped) {
      if (inClass) {
        if (char === "]") inClass = false;
        continue;
      }
      if (char === "[") {
        inClass = true;
        continue;
      }
      if (char === "(") depth += 1;
      else if (char === ")") depth -= 1;
      else if (char === "|" && depth > 0) return true;
    }
    return false;
  }
}
