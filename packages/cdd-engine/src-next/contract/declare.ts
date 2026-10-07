// packages/cdd-engine/src-next/contract/declare.ts
// T2 — the element-registry declaration (the design spec's single-declaration root).
//
// Each doc type (overall / plan / phase-spec) carries one typed element registry:
// flat declared data, one row per element — anchor token · presence · value
// pattern · ref kind · home surface. The registry is simultaneously the
// interpreter's judgment data (judge.ts consumes the anchors/domains) and the
// projection surfaces' derivation source (project.ts derives shape / schema /
// slices / tokens / reference from it) — no hand-written duplicate exists
// anywhere in the new tree.
//
// The element lines are enumerated from the methodology skeleton semantics (the
// machine skeleton of each doc type as pinned by the three repo schema JSONs,
// read as steady contract data) — freshly declared anchors, never cut from the
// old tree's sources. Counts stand at overall 39 / plan 24 / phase-spec 21,
// each within the planned 20–40 band and each element carrying all five fields
// (a completeness contract enforced by the array shape below and by the test
// suite, which pins presence/ref-kind domains and per-registry anchor
// uniqueness).

/** The presence category of an element: carried unconditionally, optionally, or only when its declared condition holds. */
export type Presence = "required" | "optional" | "conditional";

/** The three doc types the engine validates. */
export type DocType = "overall" | "plan" | "phase-spec";

/** The referential kind an element participates in — what its value points at. */
export type RefKind =
  | "none"
  | "version-lineage"
  | "markdown-link"
  | "phase-id"
  | "issue-ref"
  | "spec-ref"
  | "parent-program"
  | "task-id";

/** The document surface an element belongs to — where the anchor lives in a conforming document. */
export type Home =
  | "header"
  | "section"
  | "facet"
  | "table"
  | "graph"
  | "task-block"
  | "task-field"
  | "task-step"
  | "design-body"
  | "conditional";

/** One declared element: a structural fact of a doc type's skeleton. */
export interface RegistryElement {
  /** The machine anchor token the engine keys on — a heading literal, a header marker, or a row/field key. */
  anchor: string;
  /** Whether a conforming document must carry the element, may carry it, or carries it only when its condition holds. */
  presence: Presence;
  /** The value shape the element carries — a match pattern over the anchor's line/cell. Optional: a pure presence marker has no value to shape. */
  valuePattern?: string;
  /** The referential kind the element participates in. Optional: presence-only elements carry no reference. */
  refKind?: RefKind;
  /** The document surface the element belongs to. */
  home: Home;
}

/** One doc type's full element registry. */
export interface ElementRegistry {
  docType: DocType;
  elements: readonly RegistryElement[];
}

/** The declared-registries record surface (the brief's `declaredRegistries` shape). */
export interface DeclaredRegistries {
  overall: ElementRegistry;
  plan: ElementRegistry;
  phaseSpec: ElementRegistry;
}

// The legal value vocabularies — the single declared source the guards check
// against. Each is pinned to its narrow union, so a domain drift fails the
// compile.
const PRESENCE_VALUES = [
  "required",
  "optional",
  "conditional",
] as const satisfies readonly Presence[];
const REF_KIND_VALUES = [
  "none",
  "version-lineage",
  "markdown-link",
  "phase-id",
  "issue-ref",
  "spec-ref",
  "parent-program",
  "task-id",
] as const satisfies readonly RefKind[];
const HOME_VALUES = [
  "header",
  "section",
  "facet",
  "table",
  "graph",
  "task-block",
  "task-field",
  "task-step",
  "design-body",
  "conditional",
] as const satisfies readonly Home[];
const DOC_TYPE_VALUES = ["overall", "plan", "phase-spec"] as const satisfies readonly DocType[];

/**
 * Narrow a candidate to a well-formed registry element: anchor token, presence,
 * value pattern, ref kind and home all inside their legal domains.
 */
export function isRegistryElement(value: unknown): value is RegistryElement {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.anchor !== "string" || candidate.anchor.length === 0) return false;
  if (
    typeof candidate.presence !== "string" ||
    !(PRESENCE_VALUES as readonly string[]).includes(candidate.presence)
  )
    return false;
  if (candidate.valuePattern !== undefined && typeof candidate.valuePattern !== "string")
    return false;
  if (
    candidate.refKind !== undefined &&
    (typeof candidate.refKind !== "string" ||
      !(REF_KIND_VALUES as readonly string[]).includes(candidate.refKind))
  )
    return false;
  if (
    typeof candidate.home !== "string" ||
    !(HOME_VALUES as readonly string[]).includes(candidate.home)
  )
    return false;
  return true;
}

/** Narrow a candidate to a full element registry (doc type + all elements well-formed). */
export function isElementRegistry(value: unknown): value is ElementRegistry {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.docType !== "string" ||
    !(DOC_TYPE_VALUES as readonly string[]).includes(candidate.docType)
  )
    return false;
  if (!Array.isArray(candidate.elements)) return false;
  return (candidate.elements as unknown[]).every((element) => isRegistryElement(element));
}

// ---------------------------------------------------------------------------
// overall — the charter section surface
// ---------------------------------------------------------------------------
const OVERALL_ELEMENTS = [
  // Header block (H1 + bullet metadata).
  {
    anchor: "# Title",
    presence: "required",
    valuePattern: "^# \\S.*$",
    refKind: "none",
    home: "header",
  },
  {
    anchor: "**Version**",
    presence: "required",
    valuePattern: "^- \\*\\*Version\\*\\*: v\\d+\\.\\d+",
    refKind: "version-lineage",
    home: "header",
  },
  {
    anchor: "**Status**",
    presence: "required",
    valuePattern: "^- \\*\\*Status\\*\\*: (Draft|Approved|In progress|Complete)$",
    refKind: "none",
    home: "header",
  },
  {
    anchor: "**Author**",
    presence: "required",
    valuePattern: "^- \\*\\*Author\\*\\*:",
    refKind: "none",
    home: "header",
  },
  {
    anchor: "**Constraints**",
    presence: "required",
    valuePattern: "^- \\*\\*Constraints\\*\\*:",
    refKind: "none",
    home: "header",
  },
  // `##`-ranked sections.
  {
    anchor: "## Document scope",
    presence: "required",
    valuePattern: "^## Document scope$",
    refKind: "none",
    home: "section",
  },
  {
    anchor: "## File paths",
    presence: "required",
    valuePattern: "^## File paths$",
    refKind: "none",
    home: "section",
  },
  {
    anchor: "## Program charter",
    presence: "required",
    valuePattern: "^## Program charter$",
    refKind: "none",
    home: "section",
  },
  {
    anchor: "## Issue inventory",
    presence: "required",
    valuePattern: "^## Issue inventory$",
    refKind: "none",
    home: "section",
  },
  {
    anchor: "## Phase inventory",
    presence: "required",
    valuePattern: "^## Phase inventory$",
    refKind: "none",
    home: "section",
  },
  {
    anchor: "## Dependency graph",
    presence: "required",
    valuePattern: "^## Dependency graph( \\(ASCII\\))?$",
    refKind: "none",
    home: "section",
  },
  {
    anchor: "## Boundary rules",
    presence: "required",
    valuePattern: "^## Boundary rules$",
    refKind: "none",
    home: "section",
  },
  {
    anchor: "## Maintenance",
    presence: "required",
    valuePattern: "^## Maintenance$",
    refKind: "none",
    home: "section",
  },
  {
    anchor: "## Change history",
    presence: "required",
    valuePattern: "^## Change history$",
    refKind: "none",
    home: "section",
  },
  // Charter facets (`###`/`####` leaves under the charter).
  {
    anchor: "### Goal",
    presence: "required",
    valuePattern: "^### (Goal|cdd-engine 服务化主线（2026-09-13 用户升维）)",
    refKind: "none",
    home: "facet",
  },
  {
    anchor: "### Non-goals",
    presence: "required",
    valuePattern: "^### Non-goals",
    refKind: "none",
    home: "facet",
  },
  {
    anchor: "### Cross-cutting",
    presence: "required",
    valuePattern: "^### Cross-cutting",
    refKind: "none",
    home: "facet",
  },
  {
    anchor: "#### [MFRBEN] 组",
    presence: "optional",
    valuePattern: "^#### [MFRBEN] 组",
    refKind: "none",
    home: "facet",
  },
  {
    anchor: "#### 上游先例背书",
    presence: "optional",
    valuePattern: "^#### 上游先例背书$",
    refKind: "none",
    home: "facet",
  },
  // Issue inventory — the anchor-registration domain.
  {
    anchor: "Issue inventory columns",
    presence: "required",
    valuePattern: "^\\| Phase \\| Issue \\(ref\\) \\| Title summary \\|$",
    refKind: "none",
    home: "table",
  },
  {
    anchor: "Issue row",
    presence: "required",
    valuePattern: "^\\|\\s*P\\d+(\\.\\d+)*\\s*\\|",
    refKind: "issue-ref",
    home: "table",
  },
  {
    anchor: "Issue ref cell",
    presence: "required",
    valuePattern: "^(none|#\\d+|\\[#\\d+\\]|#\\d+#issuecomment-\\d+|（[^）]*）|\\([^)]*\\))$",
    refKind: "issue-ref",
    home: "table",
  },
  {
    anchor: "issuecomment anchor",
    presence: "conditional",
    valuePattern: "^#\\d+#issuecomment-\\d+$",
    refKind: "issue-ref",
    home: "table",
  },
  // Phase inventory row ledger.
  {
    anchor: "Phase inventory columns",
    presence: "required",
    valuePattern:
      "^\\| # \\| Phase \\| Scope \\| Design spec \\| Implementation plan \\| Acceptance criteria \\| Dependency \\|$",
    refKind: "none",
    home: "table",
  },
  {
    anchor: "Phase row",
    presence: "required",
    valuePattern: "^\\|\\s*P\\d+(\\.\\d+)*\\s*\\|",
    refKind: "phase-id",
    home: "table",
  },
  {
    anchor: "Phase id token",
    presence: "required",
    valuePattern: "^P\\d+(\\.\\d+)*$",
    refKind: "phase-id",
    home: "table",
  },
  {
    anchor: "Implementation plan cell",
    presence: "required",
    valuePattern:
      "^(Pending|\\[Pending\\]|In-flight|\\[In-flight\\]|Done|\\[[^\\]]+\\]\\([^)]+\\))$",
    refKind: "markdown-link",
    home: "table",
  },
  {
    anchor: "Design spec cell",
    presence: "required",
    valuePattern: "^(\\[[^\\]]+\\]\\([^)]+\\)|P\\d+(\\.\\d+)*-design|Done|\\[Pending\\])$",
    refKind: "spec-ref",
    home: "table",
  },
  {
    anchor: "Dependency cell",
    presence: "required",
    valuePattern: "^P\\d+(\\.\\d+)*\\s*->",
    refKind: "phase-id",
    home: "table",
  },
  // Dependency graph edges + legend.
  {
    anchor: "Hard edge",
    presence: "required",
    valuePattern: "^P\\d+(\\.\\d+)*\\s*->\\s*P\\d+(\\.\\d+)*",
    refKind: "phase-id",
    home: "graph",
  },
  {
    anchor: "Soft edge",
    presence: "optional",
    valuePattern: "^P\\d+(\\.\\d+)*\\s*->\\s*\\(?\\s*soft\\s*\\)?",
    refKind: "phase-id",
    home: "graph",
  },
  {
    anchor: "Graph legend",
    presence: "required",
    valuePattern: "^-> = hard block|^-> \\(soft\\) = suggestion only",
    refKind: "none",
    home: "graph",
  },
  // File paths artifact table.
  {
    anchor: "File path row",
    presence: "required",
    valuePattern: "^\\| [^|]+ \\| `[^`]+` \\|$",
    refKind: "none",
    home: "table",
  },
  // Change history — the version-lineage surface.
  {
    anchor: "Change history row",
    presence: "required",
    valuePattern: "^\\|\\s*v\\d+\\.\\d+\\s*\\|",
    refKind: "version-lineage",
    home: "table",
  },
  {
    anchor: "Version token",
    presence: "required",
    valuePattern: "^v\\d+\\.\\d+$",
    refKind: "version-lineage",
    home: "table",
  },
  {
    anchor: "Change history date",
    presence: "required",
    valuePattern: "^\\d{4}-\\d{2}-\\d{2}$",
    refKind: "none",
    home: "table",
  },
  {
    anchor: "Backfill clause",
    presence: "conditional",
    valuePattern: "(Pending|\\[Pending\\])\\s*(→|->)\\s*\\S+",
    refKind: "version-lineage",
    home: "table",
  },
  {
    anchor: "Design claim token",
    presence: "conditional",
    valuePattern: "^P\\d+(\\.\\d+)*-design$",
    refKind: "spec-ref",
    home: "table",
  },
  {
    anchor: "Phase range ref",
    presence: "optional",
    valuePattern: "^P\\d+(\\.\\d+)*\\s*[-–—]\\s*P\\d+(\\.\\d+)*$",
    refKind: "phase-id",
    home: "table",
  },
] as const satisfies readonly Required<RegistryElement>[];

// ---------------------------------------------------------------------------
// plan — the task-block + header-field surface
// ---------------------------------------------------------------------------
const PLAN_ELEMENTS = [
  // Header block (H1 + header fields).
  {
    anchor: "# Title",
    presence: "required",
    valuePattern: "^# \\S.*$",
    refKind: "none",
    home: "header",
  },
  {
    anchor: "**Spec:**",
    presence: "required",
    valuePattern: "^\\*\\*Spec:\\*\\*\\s+\\[[^\\]]+\\]\\([^)]+\\)$",
    refKind: "spec-ref",
    home: "header",
  },
  {
    anchor: "**Parent program**",
    presence: "required",
    valuePattern: "^- \\*\\*Parent program\\*\\*:? \\[[^\\]]+\\]\\([^)]+\\)",
    refKind: "parent-program",
    home: "header",
  },
  {
    anchor: "**Version**",
    presence: "optional",
    valuePattern: "^- \\*\\*Version\\*\\*: v\\d+\\.\\d+",
    refKind: "version-lineage",
    home: "header",
  },
  {
    anchor: "**Depends on**",
    presence: "optional",
    valuePattern: "^- \\*\\*Depends on\\*\\*:",
    refKind: "phase-id",
    home: "header",
  },
  {
    anchor: "**Base**",
    presence: "optional",
    valuePattern: "^- \\*\\*Base\\*\\*:",
    refKind: "none",
    home: "header",
  },
  // Constraint surface (Form A delta-only).
  {
    anchor: "## Constraints",
    presence: "required",
    valuePattern: "^## Constraints$",
    refKind: "none",
    home: "section",
  },
  {
    anchor: "Constraint delta bullet",
    presence: "required",
    valuePattern: "^- ",
    refKind: "none",
    home: "section",
  },
  {
    anchor: "Constraint delta sub-heading",
    presence: "optional",
    valuePattern: "^### ",
    refKind: "none",
    home: "section",
  },
  // Task blocks — the `### Task N:` heading and its number identity.
  {
    anchor: "### Task N:",
    presence: "required",
    valuePattern: "^### Task \\d+:$",
    refKind: "none",
    home: "task-block",
  },
  {
    anchor: "Task id token",
    presence: "required",
    valuePattern: "^\\d+$",
    refKind: "task-id",
    home: "task-block",
  },
  // Task block fields.
  {
    anchor: "**Objective**",
    presence: "required",
    valuePattern: "^- \\*\\*Objective\\*\\*:",
    refKind: "none",
    home: "task-field",
  },
  {
    anchor: "**Files**",
    presence: "required",
    valuePattern: "^- \\*\\*Files\\*\\*:",
    refKind: "none",
    home: "task-field",
  },
  {
    anchor: "File path token",
    presence: "required",
    valuePattern: "^[\\w./-]+",
    refKind: "none",
    home: "task-field",
  },
  {
    anchor: "**Consumes**",
    presence: "required",
    valuePattern: "^- \\*\\*Consumes\\*\\*:",
    refKind: "none",
    home: "task-field",
  },
  {
    anchor: "**Produces**",
    presence: "required",
    valuePattern: "^- \\*\\*Produces\\*\\*:",
    refKind: "none",
    home: "task-field",
  },
  {
    anchor: "**Steps**",
    presence: "required",
    valuePattern: "^- \\*\\*Steps\\*\\*:",
    refKind: "none",
    home: "task-field",
  },
  // Step leaves — execution steps and their verifiable outcomes.
  {
    anchor: "Step action",
    presence: "required",
    valuePattern: "^- ",
    refKind: "none",
    home: "task-step",
  },
  {
    anchor: "Step checkable",
    presence: "required",
    valuePattern: "—\\s*checkable:\\s*\\S",
    refKind: "none",
    home: "task-step",
  },
  {
    anchor: "**Acceptance**",
    presence: "required",
    valuePattern: "^- \\*\\*Acceptance\\*\\*:",
    refKind: "none",
    home: "task-field",
  },
  // The single directed edge — declares which lower-numbered tasks this one depends on.
  {
    anchor: "**DependsOn**",
    presence: "required",
    valuePattern: "^- \\*\\*DependsOn\\*\\*:",
    refKind: "none",
    home: "task-field",
  },
  {
    anchor: "DependsOn none",
    presence: "optional",
    valuePattern: "^(none|\\s*)$",
    refKind: "none",
    home: "task-field",
  },
  {
    anchor: "DependsOn id",
    presence: "optional",
    valuePattern: "^[1-9]\\d*$",
    refKind: "task-id",
    home: "task-field",
  },
  // Reference-lint token — prose mentions of a task id (a WARN-only observation surface).
  {
    anchor: "Task prose reference",
    presence: "optional",
    valuePattern: "\\b(?:Task|T)\\s*([1-9]\\d*)\\b(?!\\.\\d)",
    refKind: "task-id",
    home: "task-field",
  },
] as const satisfies readonly Required<RegistryElement>[];

// ---------------------------------------------------------------------------
// phase-spec — the skeleton surface
// ---------------------------------------------------------------------------
const PHASE_SPEC_ELEMENTS = [
  // Header five-tuple — `**Version**` strictly required.
  {
    anchor: "# Title",
    presence: "required",
    valuePattern: "^# \\S.*$",
    refKind: "none",
    home: "header",
  },
  {
    anchor: "**Version**",
    presence: "required",
    valuePattern: "^- \\*\\*Version\\*\\*: v\\d+\\.\\d+",
    refKind: "version-lineage",
    home: "header",
  },
  {
    anchor: "**Status**",
    presence: "required",
    valuePattern: "^- \\*\\*Status\\*\\*: (Draft|Approved|Plan pending|Shipped)$",
    refKind: "none",
    home: "header",
  },
  {
    anchor: "**Author**",
    presence: "required",
    valuePattern: "^- \\*\\*Author\\*\\*:",
    refKind: "none",
    home: "header",
  },
  {
    anchor: "**Parent program**",
    presence: "required",
    valuePattern: "^- \\*\\*Parent program\\*\\*:? \\[[^\\]]+\\]\\([^)]+\\)",
    refKind: "parent-program",
    home: "header",
  },
  {
    anchor: "**Depends on**",
    presence: "required",
    valuePattern: "^- \\*\\*Depends on\\*\\*:",
    refKind: "none",
    home: "header",
  },
  {
    anchor: "Depends on ref",
    presence: "conditional",
    valuePattern: "^P\\d+(\\.\\d+)*",
    refKind: "phase-id",
    home: "header",
  },
  // The double-layer design body.
  {
    anchor: "## Design",
    presence: "required",
    valuePattern: "^## Design$",
    refKind: "none",
    home: "design-body",
  },
  {
    anchor: "### N. group heading",
    presence: "required",
    valuePattern: "^### \\d+\\. ",
    refKind: "none",
    home: "design-body",
  },
  {
    anchor: "#### N.M item heading",
    presence: "required",
    valuePattern: "^#### \\d+\\.\\d+ ",
    refKind: "none",
    home: "design-body",
  },
  {
    anchor: "### Acceptance criteria",
    presence: "required",
    valuePattern: "^### Acceptance criteria$",
    refKind: "none",
    home: "design-body",
  },
  {
    anchor: "Acceptance entry",
    presence: "required",
    valuePattern: "^- `",
    refKind: "none",
    home: "design-body",
  },
  // The inheritance-point constraint surface (delta-only).
  {
    anchor: "## Constraints",
    presence: "required",
    valuePattern: "^## Constraints$",
    refKind: "none",
    home: "section",
  },
  {
    anchor: "Constraint delta bullet",
    presence: "required",
    valuePattern: "^- ",
    refKind: "none",
    home: "section",
  },
  // Conditional sections — written only when their condition holds, zero residue otherwise.
  {
    anchor: "## Deviations",
    presence: "conditional",
    valuePattern: "^## Deviations$",
    refKind: "none",
    home: "conditional",
  },
  {
    anchor: "Deviations columns",
    presence: "conditional",
    valuePattern: "^\\| Overall assumption \\| Phase decision \\| Overall updated\\? \\|$",
    refKind: "none",
    home: "conditional",
  },
  {
    anchor: "Deviations row",
    presence: "conditional",
    valuePattern: "^\\| ",
    refKind: "none",
    home: "conditional",
  },
  {
    anchor: "Overall updated answer",
    presence: "conditional",
    valuePattern: "^Yes",
    refKind: "none",
    home: "conditional",
  },
  {
    anchor: "## Incremental warning",
    presence: "conditional",
    valuePattern: "^## Incremental warning$",
    refKind: "none",
    home: "conditional",
  },
  {
    anchor: "## Notes for downstream",
    presence: "conditional",
    valuePattern: "^## Notes for downstream$",
    refKind: "none",
    home: "conditional",
  },
  {
    anchor: "## Review record",
    presence: "conditional",
    valuePattern: "^## Review record$",
    refKind: "none",
    home: "conditional",
  },
] as const satisfies readonly Required<RegistryElement>[];

/** The three declared registries — the judge's judgment data and the projection surfaces' derivation source. */
export const declaredRegistries: DeclaredRegistries = {
  overall: { docType: "overall", elements: OVERALL_ELEMENTS },
  plan: { docType: "plan", elements: PLAN_ELEMENTS },
  phaseSpec: { docType: "phase-spec", elements: PHASE_SPEC_ELEMENTS },
};
