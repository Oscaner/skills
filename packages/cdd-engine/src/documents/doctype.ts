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
//   words        — the shared engine-lexicon content: the full contract-lexicon content (the `_doc`
//                  / command.{status,capsule,route} / schema.anatomy wings), ONE shared DocWords
//                  object every doc type references (words single-source, never copied) — the
//                  derived config/contract-lexicon.json product renders from it (infra/word-table.ts
//                  consuming path unchanged).
//   instructions — the dispatch-packet instruction seam (P5 forward interface — typed but
//                  unpopulated at P1; InstructionUnit content lands in P5).
//   refKind      — the doc-revision identity discriminant seam (P5 forward interface — the
//                  discriminant slot stays typed but unpopulated at P1; the four discriminations
//                  land in P5).
//   bodyView     — the body-form discrimination + the per-type review-config face (the docs-family
//                  return-formats discrimination + the reviews.{spec,plan} axesGuide/lensEnum/ref
//                  content; T5 lands the concrete surface and TemplateLoader re-reads it through the
//                  registry — the template-contract reviews.spec/plan blocks + the module-level
//                  DOCS_FORMATS set are gone).
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
  /** The `$defs` container — definitional sub-schemas (the plan's taskGroups section-layout
   *  sub-schema; the dispatch-group runtime read is retired, the leaf feeds the derived tokens). */
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
  /** The `dependentRequired` leaf — the use-dependent structural consequence (P2 T2; design C2:
   *  the phase-spec conditional-section consequence, e.g. the deviations section's `heading`
   *  requiring its `Overall updated?` answer leaf — a decorated section carries its marker). */
  dependentRequired?: Readonly<Record<string, readonly string[]>>;
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
  /** The `if` condition subschema — the conditional structural-consequence anchor's guard (P2 T2;
   *  design C2: the phase-spec three-truth skeleton consequence — `if` a `## Design` section is
   *  present, `then` the acceptance + constraints sections are structurally required). */
  if?: SchemaConsequence;
  /** The `then` consequence subschema — the structural outcome the `if` condition demands. */
  then?: SchemaConsequence;
}

/**
 * A root-level structural-consequence subschema (the `if` / `then` keyword pair the phase-spec
 * shape projection carries — the closed keyword the conditional anchor needs; no index signature).
 */
export interface SchemaConsequence {
  /** The `required` leaf — the property set the consequence demands of the instance. */
  required: readonly string[];
}

/**
 * Words domain — the doc-type's shared engine-lexicon content: the `_doc` explanatory text, the
 * command family (the status values + their dual-axis mapping · the stdout capsule keys + the review
 * read-back wording · the stdout route anchors + the stderr station channels) and the schema family
 * (the skill-anatomy reference) — the full content the derived `config/contract-lexicon.json`
 * product renders from byte-equivalently (words single-source — Q5). ONE shared instance is
 * referenced by every doc type (never copied); the concrete content lives in words.ts and the
 * WordTable consumer path in infra reads the same facts from the derived product file, unchanged.
 */
export interface DocWords {
  /** The doc text of the engine contract word table — the lexicon's `_doc` face. */
  _doc: string;
  /** The command family — the engine command-contract vocabulary. */
  command: {
    /** The handoff-conclusion status values + their dual-axis mapping. */
    status: {
      /** The status vocabulary — the five handoff-conclusion values. */
      vocab: readonly string[];
      /** The judgment/work dual-axis subsets the status values map to. */
      axes: {
        /** The judgment-axis subset (CHANGES_REQUESTED · REVIEW_FIX · APPROVED). */
        judgment: readonly string[];
        /** The work-axis subset (COMPLETED). */
        work: readonly string[];
      };
    };
    /** The stdout capsule keys + the review read-back wording. */
    capsule: {
      /** The capsule keys — the stdout capsule line's tokens (status · blocker · handoff). */
      tokens: readonly string[];
      /** The review read-back annotation the engine emits on its `next:` line. */
      readbackWording: string;
    };
    /** The stdout route anchors + the stderr station channels. */
    route: {
      /** The stdout route anchors (`next:` · findings). */
      routeTokens: readonly string[];
      /** The stderr station channels — the addressed map the engine looks its emitted wording up by. */
      stations: {
        /** The `next:` station channel. */
        next: string;
        /** The `CDD_BLOCKED:` station channel. */
        blocked: string;
        /** The `CDD_WARN:` station channel. */
        warn: string;
        /** The `CDD_CLI_MISSING:` station channel. */
        cliMissing: string;
      };
    };
  };
  /** The schema family — the reference facts the engine services read. */
  schema: {
    /** The skill-anatomy reference (the facts the checkAnatomy surface reads). */
    anatomy: {
      /** The skill-anatomy schema path. */
      schemaPath: string;
      /** The kairos skills root directory. */
      skillsRoot: string;
    };
  };
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
 * BodyView domain — the body-form discrimination + the per-type review-config face. The template-
 * contract split surface collapses here (Q5/S7): the `reviews.{spec,plan}` content (axesGuide /
 * lensEnum / ref) + the DOCS_FORMATS discrimination (the `["RETURN_JSON","DOCS_FIX"]` return-formats
 * set that routes the docs family) migrate into the doc types at T5, and TemplateLoader reads the
 * per-type review config + the shell-family discrimination through the registry (the module-level
 * DOCS_FORMATS set and the template-contract reviews.spec/plan blocks are gone).
 */
export interface BodyViewReviews {
  /** The review-lens vocabulary — the REVIEW_LENS_GUIDE values (lens-tag labels). */
  lensEnum: readonly string[];
  /** The review reference descriptor — task/branch refs are git-range symbols; doc reviews carry
   *  the relational description "doc vs spec" (the concrete doc path lands on REVIEW_REFERENCE via
   *  the caller). */
  ref: string;
  /** The review axes guide — the REVIEW_AXES wording (the judged axes + the scope axis). */
  axesGuide: string;
}

/** The body-form doc-family discrimination — the DOCS_FORMATS criteria migrated from the render
 *  loader (S7): each doc family carries the return formats its body forms discriminate on, and the
 *  shell-family result (familyFor) is the membership judgement — a format found in a type's
 *  docFamily.formats resolves to that family's label. */
export interface BodyViewDocFamily {
  /** The doc-family label — "docs" (the spec/plan review-fix body forms) | "task" (the dispatch
   *  shell — the familyFor fallback). The chain root (overall) contributes no body forms: the
   *  fallback label with zero formats (the docs-family union never reads a member from it). */
  label: "docs" | "task";
  /** The return formats this doc family discriminates on — the migrated DOCS_FORMATS member set
   *  (RETURN_JSON · DOCS_FIX for the docs family; the task family carries none). */
  formats: readonly string[];
}

/**
 * BodyView domain — the body-form discrimination + the per-type review-config face (`reviews.{spec,
 * plan}` axesGuide/lensEnum + the DOCS_FORMATS discrimination migrate here — Q5/S7).
 */
export interface BodyViewSpec {
  /** The body-form doc-family discrimination (the shell-family routing — the DOCS_FORMATS
   *  criteria; familyFor judges membership against the registry's doc families). */
  docFamily: BodyViewDocFamily;
  /** The per-type review config face (the migrated reviews.{spec,plan} content) — null when the
   *  doc type has no routed review face (the overall chain root). */
  reviews: BodyViewReviews | null;
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
  /** The caller-supplied upstream design-spec reference (the docs review's `--spec` — D11: a plan
   *  review carries its design-spec reference in the round context). The plan doc type's lifecycle
   *  renders REVIEW_PLAN_LINE from it (S4/T6); absent for chain audits / spec-entry validation. */
  upstreamSpec?: string;
}

/**
 * The per-doc-type dispatch facts the review/fix lifecycle contributes (S4/T6 — the type-specific
 * lifecycle handling the docs runner renders round-context slots with). The docs review's
 * REVIEW_PLAN_LINE derives here per type: the plan doc type carries its upstream design-spec
 * reference; the phase-spec (the reviewed doc itself) carries none.
 */
export interface DocLifecycleFacts {
  /** The docs review template's REVIEW_PLAN_LINE — the upstream reference line. For the plan doc
   *  type, the `**Spec:**` reference of the dispatch's upstream design spec (the caller-supplied
   *  `--spec` — D11; empty when the dispatch carries none); for the phase-spec type, always empty
   *  (the reviewed spec is the target, not an upstream reference). */
  reviewPlanLine: string;
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

  /** Words domain — the shared engine-lexicon content (one shared DocWords object every doc type
   *  references — the words single-source the derived contract-lexicon product renders from). */
  readonly words: DocWords;

  /** The dispatch-packet instruction seam (P5 forward interface — typed, unpopulated at P1). */
  readonly instructions: InstructionUnit[];

  /** The doc-revision identity discriminant seam (P5 forward interface — typed, unpopulated at P1). */
  readonly refKind: RefKindSpec;

  /** BodyView domain — the body-form discrimination + the per-type review-config face (the
   *  TemplateLoader reads the shell-family routing + the spec/plan review config through this
   *  field — S7). */
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
   *  route metadata feeds the `--type` name — the docs runner dispatches this method per CLI
   *  `--type` inside DocsLifecycle.run and renders its facts into the round-context slots, e.g. a
   *  plan review's REVIEW_PLAN_LINE). Returns the per-type dispatch facts; null = the kind has no
   *  routed review/fix face (the overall chain root). Task/branch routes keep their existing
   *  surfaces (they are dispatch types, never registered doc types). */
  abstract lifecycle(entry: string, ctx: DocContext): DocLifecycleFacts | null;

  /** The S3 parent-doc chain walk — resolves the doc's parent along its lineage (overall →
   *  itself; spec → the parent overall; plan → the spec → the parent overall). The concrete
   *  per-kind chains land with the subclasses (T2); null = chain truncation (no parent reached). */
  abstract parentChain(entry: string, root: string): string | null;
}
