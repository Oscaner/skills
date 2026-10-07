// packages/cdd-engine/src/documents/doctypes/body/doc-body.ts — the DocBody abstract contract
// (P2 T1; plan §T1 · design C1, Criterion ②). The doc-body plane is the projected-shape source for
// the parse/brief shape split the concrete bodies materialize: every concrete body
// (PhaseSpecBody at T2, PlanBody at T3) re-derives the DocType.shape domain and the parse-slice
// regexes from its own two projection members, so the output-schema content and the parse surface
// can never drift apart (the retired shape-domain constants are gone — dead-shell discipline). This
// module establishes the abstract base + the contract types + the SHARED body-plane atoms (the
// escape helper + the canonical `## Constraints` heading its derived regex builds from) — the
// shared surface both concrete bodies read off one module, never re-typed per leaf. The plan-only
// task-brief render surface (renderBrief(task)) is deliberately OFF the abstract contract: the base
// declaring it would force every concrete body — including PhaseSpecBody, which has no task brief —
// to implement a surface it can never use; the PlanBody-side member lands with its class at T3.
//
// TIMELINE — T1 established the base with zero wiring (the docTypeRegistry / SchemaFactory / tokens
// tree untouched, the shape constants in place). T2 lands PhaseSpecBody and the phase-spec
// derivation switch: the registry's spec doc type carries the injected body singleton, tokens.ts
// loads the body leaf, and the shape-domain constant retires. T3 lands PlanBody with the plan-side
// switch. T5 review hardens the shared plane: the `## Constraints` parse heading + the escape atom
// single-source here (the plan and phase-spec bodies projected the same heading regex by hand, and
// the leaf load-order law keeps them off tokens.ts — the atomics live at the body root instead,
// re-exported by tokens.ts for its token-plane consumers). The base's forward contract stays stable
// across both switches. P3.1 T1 (doc-architecture-v2 P3.1) widens the abstract contract with the
// structure-rule DATA seam: the rule-data plane (StructureRule / StructurePlane /
// StructureInvariant / StructureFinding — the ten typed invariants) lands at the body root — the
// rule-data home, zero interpreter reverse-imports (the unified-engine-boundary constraint) — with
// the concrete per-type rule sets landing at the P3.1 rule-migration tasks.

import type { SchemaShape } from "../../doctype.ts";

/** The doc-body kind identity — the concrete body family's discriminant ("phase-spec" | "plan" |
 *  "overall"; the overall joins at P3.1 T2 — the chain root's shape + rules home on its body). */
export type DocBodyKind = "phase-spec" | "plan" | "overall";

/** The parse slice-pattern projection contract — the concrete body's single-source parse regexes,
 *  keyed by slice (an index-shaped mapping: the abstract surface presets NO concrete slice keys —
 *  each concrete body declares its own, e.g. the plan side's taskHeadingRe or the phase-spec side's
 *  `## Design` / `### Acceptance criteria` / `## Constraints` heading keys). */
export interface SlicePatternSet {
  [sliceKey: string]: RegExp;
}

// ---- shared body-plane atoms (T5 review hardening — the single-sourcing of the parse head plane) ----

/** Escape a literal string for a regex context — the shared body-plane escaping atom. The concrete
 *  bodies build their parse-slice regexes from literal consts (the drift-proof single source), and
 *  the load-order law keeps the body leaves off tokens.ts — so the atom lives at the body root,
 *  where every body leaf already imports from, and tokens.ts re-exports it for its token-plane
 *  consumers (the engine's one escape implementation, one definition home). */
export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The shared `## Constraints` heading literal — the single byte-source of the canonical
 *  constraint-section heading across the body plane. Both concrete bodies project a
 *  `constraintsHeading` parse slice (the plan side's Form-A extraction + the phase-spec side's
 *  skeleton assertion); both derive it from this const, so the merge-machine canonical read and the
 *  spec-skeleton heading can never drift apart. */
export const BODY_CONSTRAINTS_HEADING = "## Constraints";

/** The shared Form-A constraint-heading line regex — derived from the literal const above (the
 *  escape keeps surrounding regex context from ever misparsing the literal; the heading const stays
 *  the drift-proof source). Both body leaves spread this same slice into their
 *  `projectSlicePatterns()` sets. */
export const BODY_CONSTRAINTS_HEADING_RE = new RegExp(
  `^${escapeRegExp(BODY_CONSTRAINTS_HEADING)}\\s*$`,
  "m",
);

// ---- the structure-rule data contract (P3.1 F6 — the body-plane rules-data type family) ----

// The rule-data plane's type contract lives HERE at the body root, never in the interpreter: the
// doc bodies are the rule-data home (each concrete body declares `structureRules()`), and the
// load-order law keeps them off `rules/structure.ts` (zero interpreter reverse-imports — the
// engine's one rule-type definition, one rule-data home). `rules/structure.ts` type-imports this
// contract and re-exports it as the produced surface, so the rule DATA authors (the bodies) and
// the interpreter consumer read ONE type definition, never a re-home.

/** The three anchor kinds of the structure-rule plane (design §2.1 — the leaf-plane classes):
 *  `headingLeads` (line-leading heading anchors — `### Task N:` · `#### N.M` design items · charter
 *  facets), `tableRows` (table-header anchors + row extraction — the four-table rows), `records`
 *  (task-record field markers — the task-block fields). */
export type StructurePlaneKind = "headingLeads" | "tableRows" | "records";

/** A rule's judgment plane — which structural surface the invariants scan, and the anchor regex
 *  source selecting it. The anchor is the single extraction spec: its capture group 1 — when
 *  present — is the per-item value the value-judging invariants (domain / crosslink / order /
 *  continuity) decide against; an anchor without a capture yields an empty value (presence /
 *  uniqueness / residue judge the item count alone). */
export interface StructurePlane {
  /** The plane kind — the surface class the anchor selects on. */
  kind: StructurePlaneKind;
  /** The anchor regex source (`m`-compiled by the interpreter — the rule author writes the
   *  `^`-anchored line form; headingLeads/records match anchored lines, tableRows matches the
   *  header row and its data rows). */
  anchor: string;
  /** Records-kind section scoping (P3.1 T2 — the section-scoped plane): when present, record items
   *  count only INSIDE a run opened by a line matching this anchor and closed by the interpreter's
   *  structural-boundary family (a heading line / a `- **Field**:` marker line / a `---` rule — the
   *  closer itself is never an item). The rule author uses it when an anchored line is only a
   *  judgment target within its owning section — e.g. a numbered step entry is a valid checkable
   *  target only under a `- **Steps**:` field, never a numbered line in Constraints prose or a code
   *  fence. Absent → the whole-content line scan (the T1 semantics — optional, backward
   *  compatible). */
  within?: string;
  /** The within-run declared-reference anchor (P3.1 T6 — the reference-lint correlation face): when
   *  present on a within-scoped records plane, every line inside a run matching this anchor
   *  contributes its captured value (comma-split positive integers) to the run's declared reference
   *  set, stamped onto each item of the run. The reference-lint invariant reads it to exempt the
   *  references the run's own declaration lines already claim (the plan's `- **DependsOn**:`
   *  values). Absent → no stamping (the other within-scoped records rules unchanged). */
  declaredReferences?: string;
}

/** The invariant vocabulary of the structure-rule plane (design §2.1 — ten declared invariants,
 *  no wildcard DSL). Each member's payload is the ONLY machine-readable judgment parameter the
 *  interpreter reads: presence / uniqueness / residue judge the anchored item count, the rest judge
 *  the items' captured values against the declared pattern / sequence / target surface. */
export type StructureInvariant =
  /** presence — the anchored plane must carry at least one item (`## Design` · `## Constraints` ·
   *  charter facets). With `perRun` (a within-scoped records plane) the demand becomes EVERY run
   *  must carry at least one item — the empty-task-block face (a `### Task N:` block whose run has
   *  zero data-shaped fields fails; a plan with no runs judges nothing, vacuous true). */
  | { type: "presence"; perRun?: boolean }
  /** uniqueness — the anchored plane must carry exactly one item (`### Acceptance criteria` · a
   *  phase id present once). */
  | { type: "uniqueness" }
  /** domain — every item's captured value must full-match the value pattern (edge values
   *  `none`/empty/positive integers · version `v<digits>.<digits>`). The pattern is wrapped by the
   *  interpreter into an anchored full-match. */
  | { type: "domain"; valuePattern: string }
  /** crosslink — every item's captured ref must resolve to a target under the target anchor (graph
   *  token → Phase inventory · issue ref → Issue inventory); an unresolved ref is a dangling
   *  anchor. `targetWithin` scopes the target scan to the section run under a heading anchor (the
   *  section-scoped target plane — the graph token resolves against the Phase-inventory rows only,
   *  never a same-form `| P… |` row elsewhere in the document, e.g. an Issue-inventory row). */
  | { type: "crosslink"; targetAnchor: string; targetWithin?: string }
  /** order — the item sequence's captured values must ascend, strictly (change-history version
   *  lineage, mono ascending); `compare` selects the ascent comparator (numeric default — the
   *  segment-aware version compare for the change-history face). */
  | { type: "order"; compare?: "numeric" | "version" }
  /** continuity — the item sequence's captured numbers must be the exact 1..N set, in order (task
   *  1..N — no gaps, no duplicates, no offset). */
  | { type: "continuity" }
  /** residue — the anchored plane must carry ZERO items (pseudo-headings · legacy faces such as
   *  `## Task Groups` / Form-B). */
  | { type: "residue" }
  /** selfBounded — every captured reference value must be strictly below the enclosing run's OWN
   *  identifier (P3.1 T3 — the plan anti-dependency gate: a `- **DependsOn**:` reference may only
   *  point at a lower-numbered task; numbering order is the topological-linearization anchor). Set
   *  on a within-scoped records rule whose run opener captures the run's number — each anchored
   *  item's comma-split integer refs are compared against the run bound; a ref ≥ the bound fails
   *  (a self reference included). Non-integer ref tokens (`none`/empty/`abc`) carry no bound and
   *  are skipped (the NaN/integer-gate rejection is the graph plane's). A run without a numeric
   *  bound judges nothing (vacuous — the rule only becomes active under a numbered run opener).
   *  A ref value BEYOND the enclosing id range (> the extraction's maxBound — the plan's task
   *  count) is exempt: the past-the-edge reference is the graph plane's missing-id class, never
   *  the anti-dependency contradiction (the plan constraints' out-of-range exemption, P3.1 T3 fix). */
  | { type: "selfBounded" }
  /** hollow — every anchored heading line must own a body: before the next heading / `---` rule /
   *  EOF it must reach either a NON-EMPTY, non-heading content line or — when `children` is set — a
   *  child-item line matching the children pattern (the P3.1 T4 empty-body / hollow-leaf face: a
   *  `#### N.M` design item with zero body content is an empty shell; a `### N.` group satisfied by
   *  its child `#### N.M` items; a `## Design` body satisfied by its groups/items). A blank-only run
   *  between the heading and the next heading is hollow — BLOCK. An empty plane judges nothing
   *  (vacuous). */
  | { type: "hollow"; children?: string }
  /** referenceLint — the WARN observation face (P3.1 T6 — the plan reference lint: a loose
   *  observation surface, never a gate): every reference token in the run's reference-surface prose
   *  (`Objective`/`Acceptance` marker lines + acceptance bullets — the field-defined scan) is a
   *  missing-edge SUSPECT when it is in-range, backward (below the run's own number — a forward or
   *  self reference is structurally undeclareable) and absent from the run's declared reference set
   *  (its `declaredReferences`-anchor values). The interpreter emits ONE finding PER OFFENDING RUN
   *  (a block's suspects dedupe — at most one WARN per task block), each carrying the rule's fixed
   *  message copy. The rule's plane carries the scan surface (anchor + within + declaredReferences);
   *  a run without a numeric bound judges nothing (vacuous). */
  | { type: "referenceLint" };

/** A doc-structure rule — one judgment plane + its invariant bundle + the rule's scope severity
 *  and its fixed message copy (the reusable wording findings carry VERBATIM — the interpreter
 *  never assembles messages at runtime, zero external concatenation). */
export interface StructureRule {
  /** The rule id — the registry-style identity (e.g. "plan.edges" · "spec.designItems" ·
   *  "overall.charterFacets"). */
  id: string;
  /** The judgment plane — the surface + anchor the invariants scan. */
  plane: StructurePlane;
  /** The invariant bundle — the declared structural demands (the ten typed invariant
   *  vocabulary). */
  invariants: readonly StructureInvariant[];
  /** The rule's scope severity — the finding's severity for any failing invariant. */
  severity: "BLOCK" | "WARN";
  /** The fixed message copy — the finding's message, byte-identical to this declaration. */
  message: string;
}

/** One structure finding — the rule identity + severity + the rule's fixed message copy (no
 *  per-run assembly: the interpreter emits the declared rule message verbatim). */
export interface StructureFinding {
  /** The failing rule's id. */
  id: string;
  /** The failing rule's severity. */
  severity: "BLOCK" | "WARN";
  /** The failing rule's fixed message copy. */
  message: string;
}

/** Constructor options for a doc body — the identity kind + the template-prose description. */
export interface DocBodyOpts {
  /** The body's kind identity — the concrete family this body belongs to. */
  kind: DocBodyKind;
  /** The template prose (sample prose single source — a consumer reading the DocBody reads the
   *  authoring way; the concrete bodies inject their own per-type template prose). */
  description: string;
}

/**
 * The abstract doc-body base (P2 T1; plan §T1 · design C1 — Criterion ② class + constructor
 * injection). Each concrete body carries its kind identity + template prose and projects its two
 * derived surfaces: `projectSchemaShape()` re-derives the DocType.shape domain (the T2/T3 shape
 * derivation switch — tokens/SchemaFactory keep reading DocType.shape, which the concrete body
 * now derives from the projection) and `projectSlicePatterns()` the parse slice regexes (the
 * per-type parse single source). Unimplemented projections are a compile-time failure — the
 * abstract contract's existence is itself a test subject (see the colocated doc-body.test.ts).
 */
export abstract class DocBody {
  /** The body's kind identity — the concrete family this body belongs to. */
  readonly kind: DocBodyKind;

  /** The template prose single source — a consumer reading the DocBody reads the authoring way. */
  readonly description: string;

  constructor(opts: DocBodyOpts) {
    this.kind = opts.kind;
    this.description = opts.description;
  }

  /** The shape-domain derivation source — re-derives the DocType.shape content this body serves
   *  (the concrete bodies at T2/T3; the tokens/SchemaFactory DocType.shape reading face is
   *  unchanged). */
  abstract projectSchemaShape(): SchemaShape;

  /** The parse slice-pattern single source — every parse regex this body's document shape
   *  recognizes, keyed per concrete body (no preset keys on the abstract face). */
  abstract projectSlicePatterns(): SlicePatternSet;

  /** The body's structure-rule data seam (P3.1 F6 — the rule-data plane): the concrete bodies
   *  declare their structural demands as rule DATA (the `StructureRule[]` the single interpreter
   *  `runStructureRules` consumes — the rule-data home here at the body root, zero interpreter
   *  reverse-imports). The abstract face defaults to `[]` — a body with no rules contributes zero
   *  structure findings (the T2 rule migrations land the concrete sets on the three bodies). */
  structureRules(): readonly StructureRule[] {
    return [];
  }
}
