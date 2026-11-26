// packages/cdd-engine/src/docs/identity/types.ts
// The identity vocabulary: what a document IS, and where one of its elements sits.
//
//   · `DocType` — the four document shapes the engine validates, and its runtime
//     companion `DOC_TYPE_VALUES`. The tuple is the single source: the record keys, the
//     `doc-type:` value pattern, the projection loop and the parser table all derive
//     from it, so a fifth type cannot enter through one of them alone.
//   · `TargetType` — the target vocabulary of the parameterized lifecycle: the four
//     document shapes plus the two node shapes (`wave` · `branch`). A dispatch target
//     and a document type are different questions ("what is being audited" vs "what is
//     this document"), which is why the two tuples are declared separately even though
//     one contains the other.
//   · `RegistryElement` / `ElementRegistry` — one declared element and one document
//     type's whole registry. An element carries its anchor (its identity), presence, the
//     value shape, the referential kind it takes part in, the surface it lives on and its
//     LOCATION (`ElementLocation`: where it sits in a conforming document, never what it
//     means).
//
// Types and the two declared vocabularies only — no behaviour, so a consumer of the
// vocabulary never pulls an implementation in through it.

/** The presence category of an element: carried unconditionally, optionally, or only
 *  while its declared condition holds. */
export type Presence = "required" | "optional" | "conditional";

/** The four document types the engine validates. */
export type DocType = "overall" | "plan" | "phase-spec" | "single-spec";

/** The runtime companion of `DocType`, in canonical order — the single source of the
 *  type set (a record keyed by a doc type, a value pattern or a projection loop reads
 *  this tuple, never a second list). */
export const DOC_TYPE_VALUES = [
  "overall",
  "plan",
  "phase-spec",
  "single-spec",
] as const satisfies readonly DocType[];

/** The target types the parameterized lifecycle serves — the CLI `--type` vocabulary:
 *  the four document shapes plus the two node shapes. `wave` names the task-graph face
 *  whose dispatch unit is the derived wave (the type name is the unit, not the graph's
 *  node granularity); `branch` is the whole-branch review. */
export type TargetType = "phase-spec" | "overall" | "plan" | "single-spec" | "wave" | "branch";

/** The runtime companion of `TargetType`, in canonical order. */
export const TARGET_TYPE_VALUES = [
  "phase-spec",
  "overall",
  "plan",
  "single-spec",
  "wave",
  "branch",
] as const satisfies readonly TargetType[];

/** The referential kind an element takes part in — what its value points at. */
export type RefKind =
  | "none"
  | "version-lineage"
  | "markdown-link"
  | "phase-id"
  | "issue-ref"
  | "slug-ref"
  | "task-id";

/** The document surface an element belongs to — where its anchor lives. */
export type Home =
  | "frontmatter"
  | "section"
  | "facet"
  | "table"
  | "graph"
  | "task-block"
  | "task-field"
  | "task-step"
  | "design-body"
  | "conditional";

/** The structural walks a location is built from. */
export type Walk =
  | "frontmatter"
  | "heading"
  | "table"
  | "row"
  | "cell"
  | "list"
  | "taskField"
  | "taskStep"
  | "graphEdge";

/** The positional guards a walk may carry. */
export type When = "first" | "last" | "tableBody" | "inTaskBlock";

/** Where a location's walk starts: the document root, or a parent location. */
export type LocationScope = "root" | ElementLocation;

/** One element's location in a conforming document — a composable query, not a meaning.
 *  A composed query (a cell inside a row inside a table) reads as one expression at the
 *  declaration row, which is why the shape nests rather than flattening into fields. */
export interface ElementLocation {
  /** The scope the walk starts from. */
  readonly from: LocationScope;
  /** The structural walk. */
  readonly walk: Walk;
  /** The literal, pattern or class the walk matches on, when it matches one. */
  readonly match?: string | RegExp;
  /** The positional guard (first · last · a table's body · inside a task block). */
  readonly when?: When;
  /** The 1-based column ordinal of a cell walk — the guard that keeps an element from
   *  judging a sibling column whose value shares its shape. */
  readonly column?: number;
}

/** One declared element: a structural fact of one document type's skeleton. */
export interface RegistryElement {
  /** The machine anchor token the engine keys on — a heading literal, a front-matter key
   *  or a row / field key. It is the element's IDENTITY (the schema property name, the
   *  required-set key, the skeleton truth-table key, the finding's `field:`). */
  anchor: string;
  /** Whether a conforming document must carry it, may carry it, or carries it only while
   *  its declared condition holds. */
  presence: Presence;
  /** The value shape the element carries, when it carries one. */
  valuePattern?: string;
  /** The referential kind the element takes part in (absent = presence only). */
  refKind?: RefKind;
  /** The document surface the element belongs to. */
  home: Home;
  /** Where the element sits — the location query, never a meaning. */
  selector: ElementLocation;
}

/** One document type's full element registry. */
export interface ElementRegistry {
  /** The document type the registry declares. */
  docType: DocType;
  /** The declared elements, in registry order (the order every projection keeps). */
  elements: readonly RegistryElement[];
}

/** The four declared registries, keyed by document type. */
export interface DeclaredRegistries {
  overall: ElementRegistry;
  plan: ElementRegistry;
  "phase-spec": ElementRegistry;
  "single-spec": ElementRegistry;
}

/** The role a heading-anchored element plays in a judgment: a condition that must hold
 *  (`decision`), a record of what happened (`record`), or an identity / position
 *  registration (`registration`). The three roles are a gate's scope — a shape rule
 *  judges `decision` sections only — which is why the role is declared data. */
export type DocFace = "decision" | "record" | "registration";

/** One declared face row: the element's `anchor` (the row's key, never the title literal
 *  a judgment matches on) and its role. */
export interface DocFaceEntry {
  /** The registry element's anchor. */
  readonly anchor: string;
  /** The role the heading plays. */
  readonly face: DocFace;
}
