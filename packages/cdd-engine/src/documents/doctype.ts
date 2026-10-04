// packages/cdd-engine/src/documents/doctype.ts — the abstract doc-type contract (P1 T1; plan §T1 ·
// design C1). The unification target of the "three-plane heterogeneous + per-type branch scatter":
// the doc-structure schemas (config/schema/{phase-spec,plan,overall}.json), the engine lexicon
// wing (config/contract-lexicon.json) and the template-contract split surface (config/template-
// contract.json reviews.spec/plan + the DOCS_FORMATS discrimination) collapse into the DocType
// five-domain fields, and the engine's per-type handwritten branches collapse into DocType instance
// methods. This module establishes the abstract base + the interface contracts only — T2 lands the
// three subclasses (PhaseSpecDocType / PlanDocType / OverallDocType), T3/T4/T5 land the concrete
// shape/words/bodyView domain types, and P5 fills the instructions/refKind seams (Q3 — the seam
// slots exist now, downstream expansion never breaks the shell). Export face: the class + its
// contract types (Criterion ② — no bare functions).
//
// DOMAIN MAP (five domains — constructor-injected readonly fields):
//   shape        — the doc-type's full output-schema content (isomorphic to the JSON Schema the
//                  SchemaFactory projects byte-faithfully onto config/schema/<kind>.json; T3 lands
//                  the concrete per-type shape).
//   words        — the shared word-table reference: the engine lexicon content (the `_doc` /
//                  command.{status,capsule,route} / schema.anatomy wings) the derived
//                  config/contract-lexicon.json product renders from (T4 lands the concrete
//                  lexicon content; infra/word-table.ts consuming path unchanged).
//   instructions — the dispatch-packet instruction seam (P5 forward interface — typed but
//                  unpopulated at P1; InstructionUnit content lands in P5).
//   refKind      — the doc-revision identity discriminant seam (P5 forward interface — the
//                  discriminant slot stays typed but unpopulated at P1; the four discriminations
//                  land in P5).
//   bodyView     — the body-form discrimination + template-contract reviews.{spec,plan}
//                  (axesGuide/lensEnum) + DOCS_FORMATS split-surface (T5 lands the concrete
//                  surface; TemplateLoader consumption re-wired at T5).
// The route metadata face is independent of the five domains (S4/S5/S6 convergence carrier): the
// CLI / suggestion-table routing surface (--spec/--plan target flag · --type name · next-step
// target flag).

/** The CDD doc-kind family — the three doc types the registry serves and the doc-chain audits. */
export type DocKind = "overall" | "plan" | "spec";

/**
 * A structural node of the doc-type's output JSON Schema (draft 2020-12 — the closed keyword
 * subset the three schema products actually carry; no index signature, so an untyped keyword stays
 * a compile-time failure and the concrete shape content stays pinned to the keywords the products
 * exercise). `properties`/`$defs` recurse; `items` is the inline object form (the products carry no
 * tuple form).
 */
export interface SchemaNode {
  /** The node's JSON-Schema `type` keyword ("object" / "array" / "string" / "integer"). */
  type?: string;
  /** The node's `description` leaf — every structural node of the products carries one (the
   *  schema.test description-coverage assertion reads this level). */
  description?: string;
  /** The `properties` container — child nodes keyed by property name (preserves the schema's
   *  authored key order, the factory's projection ordering). */
  properties?: Readonly<Record<string, SchemaNode>>;
  /** The `items` leaf — an inline array-item schema (object form). */
  items?: SchemaNode;
  /** A `pattern` leaf (e.g. the `^## Section N:` heading-form patterns). */
  pattern?: string;
  /** A `const` leaf (e.g. the literal `**Version**` / `**Spec:**` marker tokens). */
  const?: string | number | boolean;
  /** An `enum` leaf — the string-vocabulary leaves (status states / column names / prose anchors). */
  enum?: readonly string[];
  /** The `$defs` container (the plan's taskGroups definitional sub-schema). */
  $defs?: Readonly<Record<string, SchemaNode>>;
  /** The `default` leaf (the plan taskGroups empty default). */
  default?: unknown;
  /** The `required` leaf (the plan taskGroups item). */
  required?: readonly string[];
  /** The `minimum` leaf (the plan task-number bound). */
  minimum?: number;
  /** The `minItems` leaf (the plan taskGroups minimum bound). */
  minItems?: number;
  /** The `uniqueItems` leaf (the plan taskGroups uniqueness bound). */
  uniqueItems?: boolean;
}

/**
 * Shape domain — the doc-type's authoritative doc-structure content: the full JSON-Schema face,
 * isomorphic to the output schema (every properties/pattern/const/enum/description leaf at its
 * original value, zero abstraction loss — the shape domain is the schema itself, not a shadow of it).
 * `SchemaFactory` reads this field to project the `config/schema/<kind>.json` product
 * byte-faithfully (key order + formatting = the only degrees of freedom). The concrete shapes land
 * at T3 (the per-type content under doctypes/shapes/); each subclass passes its own shape in the
 * constructor, and the derived config/schema/<kind>.json product is pinned byte-equal to this
 * content by the factory diff-pin tests.
 */
export interface SchemaShape {
  /** The output schema's meta-schema reference (draft 2020-12 — the three products share it). */
  $schema: string;
  /** The output schema's canonical `$id`. */
  $id: string;
  /** The output schema's `title`. */
  title: string;
  /** The output schema's root `description`. */
  description: string;
  /** The root `type` — "object" for the products. */
  type: "object";
  /** The root `properties` container — every structural node of the doc structure. */
  properties: Readonly<Record<string, SchemaNode>>;
}

/**
 * Words domain — the doc-type's shared word-table reference: the engine lexicon content (the
 * `_doc` / `command.{status,capsule,route}` / `schema.anatomy` wings) that renders the derived
 * `config/contract-lexicon.json` product byte-equivalently (words single-source — Q5).
 * P1 establishes the interface contract; T4 lands the concrete lexicon content.
 */
export interface DocWords {
  /** The shared word-table reference identity (the contract-lexicon product this domain renders). */
  reference: string;
}

/**
 * An instruction unit of the dispatch-packet instruction surface — the `instructions` seam
 * (Q3). P5 forward interface: P1 establishes the typed slot; P5 fills the structured content.
 */
export interface InstructionUnit {
  /** The instruction unit's origin descriptor — P5 defines the concrete instruction-unit fields. */
  source: string;
}

/**
 * The doc-revision identity discriminant slot — the `refKind` seam (Q3; design R2 typed-surface
 * placeholder). P5 forward interface: P1 establishes the discriminant slot; P5 fills the four
 * discriminations.
 */
export interface RefKindSpec {
  /** The discrimination label — P5 fills the four ref-kind discriminations. */
  kind: string;
}

/**
 * BodyView domain — the body-form discrimination + the template-contract split surface
 * (`reviews.{spec,plan}` axesGuide/lensEnum + the DOCS_FORMATS discrimination migrate here — Q5).
 * P1 establishes the interface contract; T5 lands the concrete surface and re-wires the
 * TemplateLoader consumption.
 */
export interface BodyViewSpec {
  /** The body-form discrimination label — T5 widens the interface to the review-config surface. */
  format: string;
}

/**
 * Route metadata face — independent of the five domains (S4/S5/S6 convergence carrier): the CLI /
 * suggestion-table routing surface. `reviewType` feeds the review/fix `--type` dispatch,
 * `argKey` is the resolveTargetDoc parameter the CLI fetches the doc target back through, and
 * `targetFlag` is the next-step suggestion's target flag. The overall kind (the chain root, no
 * routed review/fix face) carries nulls across the surface.
 */
export interface DocTypeRoute {
  /** The review/fix `--type` discriminant — "spec" | "plan"; null when the kind has no routed
   *  review/fix face (overall). */
  reviewType: "spec" | "plan" | null;
  /** The resolveTargetDoc parameter key ("spec" | "plan"); null when the kind is not a routed
   *  target. */
  argKey: "spec" | "plan" | null;
  /** The next-step target flag (`--spec` / `--plan`); null when the kind is not a routed target. */
  targetFlag: "--spec" | "--plan" | null;
}

/**
 * The doc-type operation context (the validate / parse / lifecycle surfaces). The P2 wiring (T2/T6)
 * widens the surface with the fields the per-type implementations need: the workspace root the doc
 * chain resolves against, plus the chain-carried audit parameters (the dispatch phase id for
 * four-table face ④, the pinned `vX.Y` tokens for the merged version-lineage).
 */
export interface DocContext {
  /** The git workspace root the doc chain resolves against. */
  root: string;
  /** The dispatch phase id (four-table face ④) — carried by a plan-chain audit; absent for a
   *  docs-lane overall self-audit or a spec review (the registration check is skipped). */
  phaseId?: string | null;
  /** The chain's pinned `vX.Y` version tokens (merged version-lineage) — carried by the Class-B
   *  parent chain; absent for an overall self-audit. */
  pinnedTokens?: readonly string[];
}

/**
 * A doc-contract violation reported by the per-doc-type validate surface. The failure surface is
 * CONVERGED here (P1 T2): the rules plane's `DocValidationFailure` is a type alias of this
 * interface (rules/documents.ts re-exports it under the old name), so the validator's migrated
 * per-type audits and the doc-type validate surface share one failure identity.
 */
export interface DocValidateFailure {
  /** Which contract failed — "plan" | "phase spec" | "overall". */
  artifact: string;
  /** Absolute path of the offending doc. */
  file: string;
  /** The failing field name. */
  field: string;
  /** What is missing / wrong. */
  missing: string;
  /** How to fix — the actionable guidance. */
  fix: string;
}

/** Constructor options for a doc type — the identity kind + the five domain fields + route. */
export interface DocTypeOpts {
  /** The doc kind this type serves — the registry's resolution identity. */
  kind: DocKind;
  /** Shape domain (the output-schema content; SchemaFactory source). */
  shape: SchemaShape;
  /** Words domain (the shared word-table reference; contract-lexicon single source). */
  words: DocWords;
  /** The dispatch-packet instruction seam (P5 content). */
  instructions: InstructionUnit[];
  /** The doc-revision identity discriminant seam (P5 content). */
  refKind: RefKindSpec;
  /** BodyView domain (body-form discrimination + template-contract split surface). */
  bodyView: BodyViewSpec;
  /** Route metadata face (the CLI / suggestion-table routing surface). */
  route: DocTypeRoute;
}

/**
 * The abstract doc-type base — one identity (kind) + the five domains + the route metadata face,
 * constructor-injected as readonly fields (Criterion ② — class + constructor injection). The
 * abstract members are the per-type public skeleton: detect (each subclass' kind heuristics),
 * validate/parse (the per-type contract audits / parsers the DocumentsValidator's handwritten
 * branches collapse into — the wire-in lands in T2, zero wiring at T1), lifecycle (the review/fix
 * `--type` routing's type-specific lifecycle handling — S4 landing point) and parentChain (the
 * S3 parent-doc chain walk — overall resolves to itself, plan/spec chain to the parent overall;
 * concrete chains land with the subclasses). Unimplemented members are a compile-time failure —
 * the abstract contract's existence is itself a test subject (see the colocated doctype.test.ts).
 */
export abstract class DocType {
  /** The doc kind this type serves — the registry identity face (DocTypeRegistry resolution). */
  readonly kind: DocKind;

  /** Shape domain — the output-schema content (T3 lands the concrete per-type shape). */
  readonly shape: SchemaShape;

  /** Words domain — the shared word-table reference (T4 lands the concrete lexicon content). */
  readonly words: DocWords;

  /** The dispatch-packet instruction seam (P5 forward interface — typed, unpopulated at P1). */
  readonly instructions: InstructionUnit[];

  /** The doc-revision identity discriminant seam (P5 forward interface — typed, unpopulated at P1). */
  readonly refKind: RefKindSpec;

  /** BodyView domain — the body-form discrimination + template-contract split surface (T5). */
  readonly bodyView: BodyViewSpec;

  /** Route metadata face — the CLI / suggestion-table routing surface (S4/S5/S6 carrier). */
  readonly route: DocTypeRoute;

  constructor(opts: DocTypeOpts) {
    this.kind = opts.kind;
    this.shape = opts.shape;
    this.words = opts.words;
    this.instructions = opts.instructions;
    this.refKind = opts.refKind;
    this.bodyView = opts.bodyView;
    this.route = opts.route;
  }

  /** The doc-kind detection heuristic — the registry's ordered scan surface (overall → plan →
   *  spec detection order at T6); each subclass' detection characteristics land with it. */
  abstract detect(fileName: string, content: string): boolean;

  /** The per-doc-type document-contract validation (the DocumentsValidator per-type audits
   *  collapse into the subclasses at T2 — zero wiring at T1). Returns the contract failures. */
  abstract validate(entry: string, ctx: DocContext): DocValidateFailure[];

  /** The per-doc-type structure parse (e.g. the `parseOverall` four-table parser folds in — T2
   *  lands the per-type parsers). */
  abstract parse(entry: string, ctx: DocContext): unknown;

  /** The review/fix `--type` routing's type-specific lifecycle handling (S4 landing point; the
   *  route metadata feeds the `--type` name). Task/branch routes keep their existing surfaces. */
  abstract lifecycle(entry: string, ctx: DocContext): unknown;

  /** The S3 parent-doc chain walk — resolves the doc's parent along its lineage (overall →
   *  itself; spec → the parent overall; plan → the spec → the parent overall). The concrete
   *  per-kind chains land with the subclasses (T2); null = chain truncation (no parent reached). */
  abstract parentChain(entry: string, root: string): string | null;
}
