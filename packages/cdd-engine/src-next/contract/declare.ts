// packages/cdd-engine/src-next/contract/declare.ts
// T2 — the element-registry declaration (the design spec's single-declaration root).
//
// Each doc type (overall / plan / phase-spec / single-spec) carries one typed
// element registry:
// flat declared data, one row per element — anchor token · presence · value
// pattern · ref kind · home surface. The registry is simultaneously the
// interpreter's judgment data (judge.ts consumes the anchors/domains) and the
// projection surfaces' derivation source (project.ts derives shape / schema /
// slices / tokens / reference from it) — no hand-written duplicate exists
// anywhere in the new tree.
//
// The element lines are enumerated from the methodology skeleton semantics (the
// machine skeleton of each doc type as pinned by the four repo schema JSONs,
// read as steady contract data) — freshly declared anchors, never cut from the
// old tree's sources. Counts stand at overall 43 / plan 28 / phase-spec 27 /
// single-spec 16, each within the post-frontmatter band (single-spec below 20 —
// the lightweight-scaffold charter) and each element carrying all five fields
// (a completeness contract enforced by the array shape below and by the test
// suite, which pins presence/ref-kind domains and per-registry anchor
// uniqueness).

import type { Selector, Walk } from "./markdown-tree.ts";
import type { DocKey } from "./project.ts";
import { SelectorSpec } from "./selector-spec.ts";

/** The presence category of an element: carried unconditionally, optionally, or only when its declared condition holds. */
export type Presence = "required" | "optional" | "conditional";

/** The four doc types the engine validates. */
export type DocType = "overall" | "plan" | "phase-spec" | "single-spec";

/** The referential kind an element participates in — what its value points at. */
export type RefKind =
  | "none"
  | "version-lineage"
  | "markdown-link"
  | "phase-id"
  | "issue-ref"
  | "slug-ref"
  | "task-id";

/** The document surface an element belongs to — where the anchor lives in a conforming document. */
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

/** One declared element: a structural fact of a doc type's skeleton. */
export interface RegistryElement {
  /** The machine anchor token the engine keys on — a heading literal, a YAML front-matter key, or a row/field key. */
  anchor: string;
  /** Whether a conforming document must carry the element, may carry it, or carries it only when its condition holds. */
  presence: Presence;
  /** The value shape the element carries — a match pattern over the anchor's line/cell. Optional: a pure presence marker has no value to shape. */
  valuePattern?: string;
  /** The referential kind the element participates in. Optional: presence-only elements carry no reference. */
  refKind?: RefKind;
  /** The document surface the element belongs to. */
  home: Home;
  /** The element's LOCATION in a conforming document — a composable tree query
   *  (`markdown-tree.ts`). `anchor` stays the element's IDENTITY (the schema
   *  property name, the `required[]` key, the skeleton truth-table key, the lint
   *  lookup key and the `field:` of a finding); the selector answers only WHERE
   *  the element sits, so the two never have to agree textually. */
  selector: Selector;
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
  "phase-spec": ElementRegistry;
  "single-spec": ElementRegistry;
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
  "slug-ref",
  "task-id",
] as const satisfies readonly RefKind[];
const HOME_VALUES = [
  "frontmatter",
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
const WALK_VALUES = [
  "frontmatter",
  "heading",
  "table",
  "row",
  "cell",
  "list",
  "taskField",
  "taskStep",
  "graphEdge",
] as const satisfies readonly Walk[];
export const DOC_TYPE_VALUES = [
  "overall",
  "plan",
  "phase-spec",
  "single-spec",
] as const satisfies readonly DocType[];

/** The legal `slug:` value shape (spec §2.1) — 1–128 characters, an alphanumeric
 *  first character, then alphanumerics / `.` / `_` / `-`. The pattern rejects the
 *  directory-escape values (`.` / `..`, path separators, whitespace) and the
 *  Windows reserved characters at the value surface, because a slug doubles as a
 *  workspace directory name. One declared constant — the `slug:` identity rows and
 *  the phase-spec `program:` reference share the same value domain, and the
 *  identity index (`SlugIndex.isLegalSlug`) compiles this SAME source string, so
 *  the shape judgment has one grammar (this module is the leaf both planes read). */
export const SLUG_VALUE_PATTERN = "^(?=.{1,128}$)[A-Za-z0-9][A-Za-z0-9._-]*$";

/** The legal `DependsOn id` value shape — one positive task id (whole-token). One
 *  declared constant: the `DependsOn id` element and the task-block reader (whose
 *  `dependsOn` token domain must accept exactly what the registry declares) compile
 *  this SAME source string, so the graph's edge domain and the lint's token domain
 *  can never drift apart. */
export const TASK_ID_VALUE_PATTERN = "^[1-9]\\d*$";

/**
 * The registry guards — the runtime contract that narrows an unknown candidate
 * to a registry element or a full element registry. A static predicate class
 * (zero instance state): every guard reads its legal vocabulary from the
 * declared constants above, so a domain drift fails the guard tests.
 */
// biome-ignore lint/complexity/noStaticOnlyClass: the plan-mandated static guard surface — the zero-bare-function discipline admits no standalone predicate functions.
export class RegistryGuard {
  /** Narrow a candidate to a well-formed registry element: anchor token, presence,
   *  value pattern, ref kind and home all inside their legal domains. */
  static isElement(value: unknown): value is RegistryElement {
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
    return RegistryGuard.isSelector(candidate.selector);
  }

  /** Narrow a candidate to a well-formed selector: a known walk and a `from` chain
   *  that terminates at the document root. */
  static isSelector(value: unknown): value is Selector {
    let current: unknown = value;
    while (current !== "root") {
      if (typeof current !== "object" || current === null) return false;
      const candidate = current as Record<string, unknown>;
      if (
        typeof candidate.walk !== "string" ||
        !(WALK_VALUES as readonly string[]).includes(candidate.walk)
      )
        return false;
      if (candidate.match !== undefined && !(candidate.match instanceof RegExp)) {
        if (typeof candidate.match !== "string") return false;
      }
      if (
        candidate.when !== undefined &&
        !["first", "last", "tableBody", "inTaskBlock"].includes(candidate.when as string)
      )
        return false;
      if (
        candidate.column !== undefined &&
        !(
          typeof candidate.column === "number" &&
          Number.isInteger(candidate.column) &&
          candidate.column > 0
        )
      )
        return false;
      current = candidate.from;
    }
    return true;
  }

  /** Narrow a candidate to a full element registry (doc type + all elements well-formed). */
  static isRegistry(value: unknown): value is ElementRegistry {
    if (typeof value !== "object" || value === null) return false;
    const candidate = value as Record<string, unknown>;
    if (
      typeof candidate.docType !== "string" ||
      !(DOC_TYPE_VALUES as readonly string[]).includes(candidate.docType)
    )
      return false;
    if (!Array.isArray(candidate.elements)) return false;
    return (candidate.elements as unknown[]).every((element) => RegistryGuard.isElement(element));
  }
}

// ---------------------------------------------------------------------------
// overall — the charter section surface
// ---------------------------------------------------------------------------
const OVERALL_ELEMENTS = [
  // Header block — YAML front-matter keys (a frontmatter-home anchor IS the
  // front-matter key name; the value patterns are scalar shapes, §2.3).
  {
    anchor: "title",
    presence: "required",
    valuePattern: "^.+$",
    refKind: "none",
    home: "frontmatter",
    selector: SelectorSpec.frontmatter("title"),
  },
  {
    anchor: "doc-type",
    presence: "required",
    valuePattern: `^(${DOC_TYPE_VALUES.join("|")})$`,
    refKind: "none",
    home: "frontmatter",
    selector: SelectorSpec.frontmatter("doc-type"),
  },
  {
    anchor: "version",
    presence: "required",
    valuePattern: "^v\\d+\\.\\d+$",
    refKind: "version-lineage",
    home: "frontmatter",
    selector: SelectorSpec.frontmatter("version"),
  },
  {
    anchor: "date",
    presence: "required",
    valuePattern: "^\\d{4}-\\d{2}-\\d{2}$",
    refKind: "none",
    home: "frontmatter",
    selector: SelectorSpec.frontmatter("date"),
  },
  {
    anchor: "slug",
    presence: "required",
    valuePattern: SLUG_VALUE_PATTERN,
    refKind: "none",
    home: "frontmatter",
    selector: SelectorSpec.frontmatter("slug"),
  },
  {
    anchor: "author",
    presence: "required",
    valuePattern: "^.+$",
    refKind: "none",
    home: "frontmatter",
    selector: SelectorSpec.frontmatter("author"),
  },
  // `##`-ranked sections.
  {
    anchor: "## Document scope",
    presence: "required",
    valuePattern: "^## Document scope$",
    refKind: "none",
    home: "section",
    selector: SelectorSpec.heading("## Document scope"),
  },
  {
    anchor: "## File paths",
    presence: "optional",
    valuePattern: "^## File paths$",
    refKind: "none",
    home: "section",
    selector: SelectorSpec.heading("## File paths"),
  },
  {
    anchor: "## Program charter",
    presence: "required",
    valuePattern: "^## Program charter$",
    refKind: "none",
    home: "section",
    selector: SelectorSpec.heading("## Program charter"),
  },
  {
    anchor: "## Issue inventory",
    presence: "required",
    valuePattern: "^## Issue inventory$",
    refKind: "none",
    home: "section",
    selector: SelectorSpec.heading("## Issue inventory"),
  },
  {
    anchor: "## Phase inventory",
    presence: "required",
    valuePattern: "^## Phase inventory$",
    refKind: "none",
    home: "section",
    selector: SelectorSpec.heading("## Phase inventory"),
  },
  {
    anchor: "## Dependency graph",
    presence: "required",
    valuePattern: "^## Dependency graph( \\(ASCII\\))?$",
    refKind: "none",
    home: "section",
    selector: SelectorSpec.heading("## Dependency graph"),
  },
  {
    anchor: "## Boundary rules",
    presence: "required",
    valuePattern: "^## Boundary rules$",
    refKind: "none",
    home: "section",
    selector: SelectorSpec.heading("## Boundary rules"),
  },
  // The constraint surface (Form A delta-only) — the retired overall Constraints
  // header bullet normalised to the body section + its delta bullet (the body
  // anchor must be declared before the skeleton composes it, §2.4).
  {
    anchor: "## Constraints",
    presence: "required",
    valuePattern: "^## Constraints$",
    refKind: "none",
    home: "section",
    selector: SelectorSpec.heading("## Constraints"),
  },
  {
    anchor: "Constraint delta bullet",
    presence: "required",
    valuePattern: "^- ",
    refKind: "none",
    home: "section",
    selector: SelectorSpec.list(SelectorSpec.heading("## Constraints"), /^- /),
  },
  {
    anchor: "## Maintenance",
    presence: "required",
    valuePattern: "^## Maintenance$",
    refKind: "none",
    home: "section",
    selector: SelectorSpec.heading("## Maintenance"),
  },
  {
    anchor: "## Change history",
    presence: "required",
    valuePattern: "^## Change history$",
    refKind: "none",
    home: "section",
    selector: SelectorSpec.heading("## Change history"),
  },
  // Charter facets (`###`/`####` leaves under the charter). The legacy Chinese
  // markers (the doc-arch decision-group leaves M/F/R/B/E, the doc-arch
  // upstream-endorsements facet) match through the judge's canonicalize row-source
  // seam (contract/judge.ts) — the value patterns below are English canonicals,
  // never a second hand-written zh pattern.
  {
    anchor: "### Goal",
    presence: "required",
    valuePattern: "^### Goal",
    refKind: "none",
    home: "facet",
    selector: SelectorSpec.heading("### Goal"),
  },
  {
    anchor: "### Non-goals",
    presence: "required",
    valuePattern: "^### Non-goals",
    refKind: "none",
    home: "facet",
    selector: SelectorSpec.heading("### Non-goals"),
  },
  {
    anchor: "### Cross-cutting",
    presence: "required",
    valuePattern: "^### Cross-cutting",
    refKind: "none",
    home: "facet",
    selector: SelectorSpec.heading("### Cross-cutting"),
  },
  // The registration ledger of the charter — declared OPTIONAL on purpose: every
  // overall document that predates this element legitimately lacks it, so a required
  // declaration would refuse the whole corpus. Its `valuePattern` is a PREFIX (the
  // corpus writes a dated suffix after the heading), so a suffixed heading still
  // resolves — the judgment reads the pattern, never the anchor literal.
  {
    anchor: "### 设计决策留存",
    presence: "optional",
    valuePattern: "^### 设计决策留存",
    refKind: "none",
    home: "facet",
    selector: SelectorSpec.heading("### 设计决策留存"),
  },
  {
    anchor: "#### [MFRBEN] group",
    presence: "optional",
    valuePattern: "^#### [MFRBEN] group",
    refKind: "none",
    home: "facet",
    selector: SelectorSpec.heading(/^#### [MFRBEN] group/),
  },
  {
    anchor: "#### Upstream Endorsements",
    presence: "optional",
    valuePattern: "^#### Upstream Endorsements$",
    refKind: "none",
    home: "facet",
    selector: SelectorSpec.heading("#### Upstream Endorsements"),
  },
  // Issue inventory — the anchor-registration domain.
  {
    anchor: "Issue inventory columns",
    presence: "required",
    valuePattern: "^\\| Phase \\| Issue \\(ref\\) \\| Title summary \\|$",
    refKind: "none",
    home: "table",
    selector: SelectorSpec.table(
      SelectorSpec.heading("## Issue inventory"),
      /^\| Phase \| Issue \(ref\) \| Title summary \|$/,
    ),
  },
  {
    anchor: "Issue row",
    presence: "required",
    valuePattern: "^\\|\\s*P\\d+(\\.\\d+)*\\s*\\|",
    refKind: "issue-ref",
    home: "table",
    selector: SelectorSpec.table(
      SelectorSpec.heading("## Issue inventory"),
      /^\|\s*P\d+(\.\d+)*\s*\|/,
    ),
  },
  {
    anchor: "Issue ref cell",
    presence: "required",
    valuePattern: "^(none|#\\d+|\\[#\\d+\\]|#\\d+#issuecomment-\\d+|（[^）]*）|\\([^)]*\\))$",
    refKind: "issue-ref",
    home: "table",
    selector: SelectorSpec.cell(
      SelectorSpec.row(
        SelectorSpec.table(SelectorSpec.heading("## Issue inventory"), /^\|\s*P\d+(\.\d+)*\s*\|/),
      ),
      /^(none|#\d+|\[#\d+\]|#\d+#issuecomment-\d+|（[^）]*）|\([^)]*\))$/,
      2,
    ),
  },
  {
    anchor: "issuecomment anchor",
    presence: "conditional",
    valuePattern: "^#\\d+#issuecomment-\\d+$",
    refKind: "issue-ref",
    home: "table",
    selector: SelectorSpec.cell(
      SelectorSpec.row(
        SelectorSpec.table(SelectorSpec.heading("## Issue inventory"), /^\|\s*P\d+(\.\d+)*\s*\|/),
      ),
      /^#\d+#issuecomment-\d+$/,
      2,
    ),
  },
  // Phase inventory row ledger.
  {
    anchor: "Phase inventory columns",
    presence: "required",
    valuePattern:
      "^\\| # \\| Phase \\| Scope \\| Design spec \\| Implementation plan \\| Acceptance criteria \\| Dependency \\|$",
    refKind: "none",
    home: "table",
    selector: SelectorSpec.table(
      SelectorSpec.heading("## Phase inventory"),
      /^\| # \| Phase \| Scope \| Design spec \| Implementation plan \| Acceptance criteria \| Dependency \|$/,
    ),
  },
  {
    anchor: "Phase row",
    presence: "required",
    valuePattern: "^\\|\\s*P\\d+(\\.\\d+)*\\s*\\|",
    refKind: "phase-id",
    home: "table",
    selector: SelectorSpec.table(
      SelectorSpec.heading("## Phase inventory"),
      /^\|\s*P\d+(\.\d+)*\s*\|/,
    ),
  },
  {
    anchor: "Phase id token",
    presence: "required",
    valuePattern: "^P\\d+(\\.\\d+)*$",
    refKind: "phase-id",
    home: "table",
    selector: SelectorSpec.cell(
      SelectorSpec.row(
        SelectorSpec.table(SelectorSpec.heading("## Phase inventory"), /^\|\s*P\d+(\.\d+)*\s*\|/),
      ),
      /^P\d+(\.\d+)*$/,
      1,
    ),
  },
  {
    anchor: "Implementation plan cell",
    presence: "required",
    valuePattern:
      "^(?:✔\\s*)?(?:Pending|\\[Pending\\]|In-flight|\\[In-flight\\]|Done|\\[[^\\]]+\\]\\([^)]+\\))(?:\\s*[（(][^）)]*[）)])?(?:\\s+[\\s\\S]*)?$",
    refKind: "markdown-link",
    home: "table",
    selector: SelectorSpec.cell(
      SelectorSpec.row(
        SelectorSpec.table(SelectorSpec.heading("## Phase inventory"), /^\|\s*P\d+(\.\d+)*\s*\|/),
      ),
      /^(?:✔\s*)?(?:Pending|\[Pending\]|In-flight|\[In-flight\]|Done|\[[^\]]+\]\([^)]+\))/,
      5,
    ),
  },
  {
    anchor: "Design spec cell",
    presence: "required",
    valuePattern:
      "^(?:✔\\s*)?(?:\\[[^\\]]+\\]\\([^)]+\\)|P\\d+(\\.\\d+)*-design|Done|\\[Pending\\])(?:\\s*[（(][^）)]*[）)])?(?:\\s+[\\s\\S]*)?$",
    refKind: "none",
    home: "table",
    selector: SelectorSpec.cell(
      SelectorSpec.row(
        SelectorSpec.table(SelectorSpec.heading("## Phase inventory"), /^\|\s*P\d+(\.\d+)*\s*\|/),
      ),
      /^(?:✔\s*)?(?:\[[^\]]+\]\([^)]+\)|P\d+(\.\d+)*-design|Done|\[Pending\])/,
      4,
    ),
  },
  {
    anchor: "Dependency cell",
    presence: "required",
    valuePattern: "^P\\d+(\\.\\d+)*\\s*->",
    refKind: "phase-id",
    home: "table",
    selector: SelectorSpec.cell(
      SelectorSpec.row(
        SelectorSpec.table(SelectorSpec.heading("## Phase inventory"), /^\|\s*P\d+(\.\d+)*\s*\|/),
      ),
      /^P\d+(\.\d+)*\s*->/,
      7,
    ),
  },
  // Dependency graph edges + legend.
  {
    anchor: "Hard edge",
    presence: "required",
    valuePattern: "^P\\d+(\\.\\d+)*\\s*->\\s*P\\d+(\\.\\d+)*",
    refKind: "phase-id",
    home: "graph",
    selector: SelectorSpec.graphEdge("hard"),
  },
  {
    anchor: "Soft edge",
    presence: "optional",
    valuePattern: "^P\\d+(\\.\\d+)*\\s*->\\s*P\\d+(\\.\\d+)*\\s*\\(?\\s*soft\\s*\\)?",
    refKind: "phase-id",
    home: "graph",
    selector: SelectorSpec.graphEdge("soft"),
  },
  {
    anchor: "Graph legend",
    presence: "required",
    valuePattern:
      "^(?:- )?`?->\\s*(?:\\(soft\\))?\\s*`? = hard block|^(?:- )?`?->\\s*\\(soft\\)\\s*`? = suggestion only",
    refKind: "none",
    home: "graph",
    selector: SelectorSpec.graphEdge(/->`?\s*=\s*hard block/),
  },
  // File paths artifact table.
  {
    anchor: "File path row",
    presence: "optional",
    valuePattern: "^\\| [^|]+ \\| `[^`]+` \\|$",
    refKind: "none",
    home: "table",
    selector: SelectorSpec.table(SelectorSpec.heading("## File paths"), /^\| [^|]+ \| `[^`]+` \|$/),
  },
  // Change history — the version-lineage surface. Both the row selector and the
  // version-cell read are anchored at the FIRST column: a row's identity is a cell
  // that IS `v<n>.<m>`, never prose carrying a version token. The judgment plane's
  // `lineageRows` / `lineageVersion` reads hold the same anchor (`invariants.ts`).
  {
    anchor: "Change history row",
    presence: "required",
    valuePattern: "^\\|\\s*v\\d+\\.\\d+\\s*\\|",
    refKind: "version-lineage",
    home: "table",
    selector: SelectorSpec.table(SelectorSpec.heading("## Change history"), /^\|\s*v\d+\.\d+\s*\|/),
  },
  {
    anchor: "Version token",
    presence: "required",
    valuePattern: "^v\\d+\\.\\d+$",
    refKind: "version-lineage",
    home: "table",
    selector: SelectorSpec.cell(
      SelectorSpec.row(
        SelectorSpec.table(SelectorSpec.heading("## Change history"), /^\|\s*v\d+\.\d+\s*\|/),
      ),
      /^v\d+\.\d+$/,
      1,
    ),
  },
  {
    anchor: "Change history date",
    presence: "required",
    valuePattern: "^\\d{4}-\\d{2}-\\d{2}$",
    refKind: "none",
    home: "table",
    selector: SelectorSpec.cell(
      SelectorSpec.row(
        SelectorSpec.table(SelectorSpec.heading("## Change history"), /^\|\s*v\d+\.\d+\s*\|/),
      ),
      /^\d{4}-\d{2}-\d{2}$/,
      2,
    ),
  },
  {
    anchor: "Backfill clause",
    presence: "conditional",
    valuePattern: "(Pending|\\[Pending\\])\\s*(→|->)\\s*\\S+",
    refKind: "version-lineage",
    home: "table",
    selector: SelectorSpec.cell(
      SelectorSpec.row(
        SelectorSpec.table(SelectorSpec.heading("## Change history"), /^\|\s*v\d+\.\d+\s*\|/),
      ),
      /(Pending|\[Pending\])\s*(→|->)\s*\S+/,
      3,
    ),
  },
  {
    anchor: "Design claim token",
    presence: "conditional",
    valuePattern: "^P\\d+(\\.\\d+)*-design$",
    refKind: "phase-id",
    home: "table",
    selector: SelectorSpec.cell(
      SelectorSpec.row(
        SelectorSpec.table(SelectorSpec.heading("## Phase inventory"), /^\|\s*P\d+(\.\d+)*\s*\|/),
      ),
      /^P\d+(\.\d+)*-design$/,
      4,
    ),
  },
  {
    anchor: "Phase range ref",
    presence: "optional",
    valuePattern: "^P\\d+(\\.\\d+)*\\s*[-–—]\\s*P\\d+(\\.\\d+)*$",
    refKind: "phase-id",
    home: "table",
    selector: SelectorSpec.cell(
      SelectorSpec.row(
        SelectorSpec.table(SelectorSpec.heading("## Phase inventory"), /^\|\s*P\d+(\.\d+)*\s*\|/),
      ),
      /^P\d+(\.\d+)*\s*[-–—]\s*P\d+(\.\d+)*$/,
      3,
    ),
  },
] as const satisfies readonly Required<RegistryElement>[];

// ---------------------------------------------------------------------------
// plan — the task-block + header-field surface
// ---------------------------------------------------------------------------
const PLAN_ELEMENTS = [
  // Header block — YAML front-matter keys (the frontmatter-home anchor IS the
  // front-matter key name). Plan deliberately omits `author` — no plan head
  // carries that row (the per-type presence contract of §2.3).
  {
    anchor: "title",
    presence: "required",
    valuePattern: "^.+$",
    refKind: "none",
    home: "frontmatter",
    selector: SelectorSpec.frontmatter("title"),
  },
  {
    anchor: "doc-type",
    presence: "required",
    valuePattern: `^(${DOC_TYPE_VALUES.join("|")})$`,
    refKind: "none",
    home: "frontmatter",
    selector: SelectorSpec.frontmatter("doc-type"),
  },
  {
    anchor: "version",
    presence: "required",
    valuePattern: "^v\\d+\\.\\d+$",
    refKind: "version-lineage",
    home: "frontmatter",
    selector: SelectorSpec.frontmatter("version"),
  },
  {
    anchor: "date",
    presence: "required",
    valuePattern: "^\\d{4}-\\d{2}-\\d{2}$",
    refKind: "none",
    home: "frontmatter",
    selector: SelectorSpec.frontmatter("date"),
  },
  {
    anchor: "slug",
    presence: "required",
    valuePattern: SLUG_VALUE_PATTERN,
    refKind: "none",
    home: "frontmatter",
    selector: SelectorSpec.frontmatter("slug"),
  },
  {
    anchor: "base",
    presence: "optional",
    valuePattern: "^.+$",
    refKind: "none",
    home: "frontmatter",
    selector: SelectorSpec.frontmatter("base"),
  },
  // Constraint surface (Form A delta-only).
  {
    anchor: "## Constraints",
    presence: "required",
    valuePattern: "^## Constraints$",
    refKind: "none",
    home: "section",
    selector: SelectorSpec.heading("## Constraints"),
  },
  {
    anchor: "Constraint delta bullet",
    presence: "required",
    valuePattern: "^- ",
    refKind: "none",
    home: "section",
    selector: SelectorSpec.list(SelectorSpec.heading("## Constraints"), /^- /),
  },
  {
    anchor: "Constraint delta sub-heading",
    presence: "optional",
    valuePattern: "^### ",
    refKind: "none",
    home: "section",
    selector: SelectorSpec.heading(/^### /, SelectorSpec.heading("## Constraints")),
  },
  // Task blocks — the `### Task N:` heading and its number identity. The heading
  // shape accepts the TITLED form (`### Task N: <title>` — the tree-wide canonical
  // form; the parse face anchors on `^### Task (\d+):`); the bare heading is one
  // instance of the same pattern, never a second form.
  {
    anchor: "### Task N:",
    presence: "required",
    valuePattern: "^### Task \\d+:( .*)?$",
    refKind: "none",
    home: "task-block",
    selector: SelectorSpec.heading(/^### Task \d+:/),
  },
  {
    anchor: "Task id token",
    presence: "required",
    valuePattern: "^\\d+$",
    refKind: "task-id",
    home: "task-block",
    selector: SelectorSpec.heading(/^### Task ([1-9]\d*):/),
  },
  // Task block sections — the seven reserved `#### Key` headings (P21 §7). The
  // legacy bullet shape (`- **Key**: …`) carries NO declaration of its own: the
  // `PlanTaskBlocksReader` normalizes it into the same block record, so the field
  // key/token surface below judges both shapes by one declaration.
  {
    anchor: "#### Objective",
    presence: "required",
    valuePattern: "^#### Objective$",
    refKind: "none",
    home: "task-field",
    selector: SelectorSpec.taskField("#### Objective"),
  },
  {
    anchor: "#### Files",
    presence: "required",
    valuePattern: "^#### Files$",
    refKind: "none",
    home: "task-field",
    selector: SelectorSpec.taskField("#### Files"),
  },
  {
    anchor: "File path token",
    presence: "required",
    valuePattern: "^[\\w./-]+",
    refKind: "none",
    home: "task-field",
    selector: SelectorSpec.taskField(/^[\w./-]+/, SelectorSpec.taskField("#### Files")),
  },
  {
    anchor: "#### Consumes",
    presence: "required",
    valuePattern: "^#### Consumes$",
    refKind: "none",
    home: "task-field",
    selector: SelectorSpec.taskField("#### Consumes"),
  },
  {
    anchor: "#### Produces",
    presence: "required",
    valuePattern: "^#### Produces$",
    refKind: "none",
    home: "task-field",
    selector: SelectorSpec.taskField("#### Produces"),
  },
  {
    anchor: "#### Steps",
    presence: "required",
    valuePattern: "^#### Steps$",
    refKind: "none",
    home: "task-field",
    selector: SelectorSpec.taskField("#### Steps"),
  },
  // Step leaves — execution steps and their verifiable outcomes.
  {
    anchor: "Step action",
    presence: "required",
    valuePattern: "^- ",
    refKind: "none",
    home: "task-step",
    selector: SelectorSpec.taskStep(/^- /),
  },
  {
    anchor: "Step checkable",
    presence: "required",
    valuePattern: "—\\s*checkable:\\s*\\S",
    refKind: "none",
    home: "task-step",
    selector: SelectorSpec.taskStep(/—+\s*checkable:\s*\S/),
  },
  {
    anchor: "#### Acceptance",
    presence: "required",
    valuePattern: "^#### Acceptance$",
    refKind: "none",
    home: "task-field",
    selector: SelectorSpec.taskField("#### Acceptance"),
  },
  // The single directed edge — declares which other tasks this one depends on
  // (any existing task id; forward references are legal — the anti-dependency gate
  // retired, T24; the value prefix carries the list, §3.8).
  {
    anchor: "#### DependsOn",
    presence: "required",
    valuePattern: "^#### DependsOn$",
    refKind: "none",
    home: "task-field",
    selector: SelectorSpec.taskField("#### DependsOn"),
  },
  {
    anchor: "DependsOn none",
    presence: "optional",
    valuePattern: "^(none|\\s*)$",
    refKind: "none",
    home: "task-field",
    selector: SelectorSpec.taskField(/^(none|\s*)$/, SelectorSpec.taskField("#### DependsOn")),
  },
  {
    anchor: "DependsOn id",
    presence: "optional",
    valuePattern: TASK_ID_VALUE_PATTERN,
    refKind: "task-id",
    home: "task-field",
    selector: SelectorSpec.taskField(/^[1-9]\d*$/, SelectorSpec.taskField("#### DependsOn")),
  },
  // Reference-lint token — prose mentions of a task id (a WARN-only observation
  // surface; the crosslink invariant does NOT consume this element — the
  // reference-lint pass is its only consumer).
  {
    anchor: "Task prose reference",
    presence: "optional",
    valuePattern: "\\b(?:Task|T)\\s*([1-9]\\d*)\\b(?!\\.\\d)",
    refKind: "task-id",
    home: "task-field",
    selector: SelectorSpec.taskField(/\b(?:Task|T)\s*([1-9]\d*)\b(?!\.\d)/),
  },
  // Change history — the version-lineage surface (P4.1 T2 · overall-isomorphic): the
  // section heading + the row/version/date cells. Presence is required on the
  // heading (since P4.1 every plan carries a Change-history table); the row cells are
  // domain-judged on the table rows.
  {
    anchor: "## Change history",
    presence: "required",
    valuePattern: "^## Change history$",
    refKind: "none",
    home: "section",
    selector: SelectorSpec.heading("## Change history"),
  },
  {
    anchor: "Change history row",
    presence: "required",
    valuePattern: "^\\|\\s*v\\d+\\.\\d+\\s*\\|",
    refKind: "version-lineage",
    home: "table",
    selector: SelectorSpec.table(SelectorSpec.heading("## Change history"), /^\|\s*v\d+\.\d+\s*\|/),
  },
  {
    anchor: "Version token",
    presence: "required",
    valuePattern: "^v\\d+\\.\\d+$",
    refKind: "version-lineage",
    home: "table",
    selector: SelectorSpec.cell(
      SelectorSpec.row(
        SelectorSpec.table(SelectorSpec.heading("## Change history"), /^\|\s*v\d+\.\d+\s*\|/),
      ),
      /^v\d+\.\d+$/,
      1,
    ),
  },
  {
    anchor: "Change history date",
    presence: "required",
    valuePattern: "^\\d{4}-\\d{2}-\\d{2}$",
    refKind: "none",
    home: "table",
    selector: SelectorSpec.cell(
      SelectorSpec.row(
        SelectorSpec.table(SelectorSpec.heading("## Change history"), /^\|\s*v\d+\.\d+\s*\|/),
      ),
      /^\d{4}-\d{2}-\d{2}$/,
      2,
    ),
  },
] as const satisfies readonly Required<RegistryElement>[];

// ---------------------------------------------------------------------------
// phase-spec — the skeleton surface
// ---------------------------------------------------------------------------
const PHASE_SPEC_ELEMENTS = [
  // Header block — YAML front-matter keys (the frontmatter-home anchor IS the
  // key name). The old line-scan phase-id fallback is retired — its anchor never
  // appeared in any document literal and it had zero consumers.
  {
    anchor: "title",
    presence: "required",
    valuePattern: "^.+$",
    refKind: "none",
    home: "frontmatter",
    selector: SelectorSpec.frontmatter("title"),
  },
  {
    anchor: "doc-type",
    presence: "required",
    valuePattern: `^(${DOC_TYPE_VALUES.join("|")})$`,
    refKind: "none",
    home: "frontmatter",
    selector: SelectorSpec.frontmatter("doc-type"),
  },
  {
    anchor: "version",
    presence: "required",
    valuePattern: "^v\\d+\\.\\d+$",
    refKind: "version-lineage",
    home: "frontmatter",
    selector: SelectorSpec.frontmatter("version"),
  },
  {
    anchor: "date",
    presence: "required",
    valuePattern: "^\\d{4}-\\d{2}-\\d{2}$",
    refKind: "none",
    home: "frontmatter",
    selector: SelectorSpec.frontmatter("date"),
  },
  {
    anchor: "slug",
    presence: "required",
    valuePattern: SLUG_VALUE_PATTERN,
    refKind: "none",
    home: "frontmatter",
    selector: SelectorSpec.frontmatter("slug"),
  },
  {
    anchor: "program",
    presence: "required",
    valuePattern: SLUG_VALUE_PATTERN,
    refKind: "slug-ref",
    home: "frontmatter",
    selector: SelectorSpec.frontmatter("program"),
  },
  {
    anchor: "author",
    presence: "required",
    valuePattern: "^.+$",
    refKind: "none",
    home: "frontmatter",
    selector: SelectorSpec.frontmatter("author"),
  },
  {
    anchor: "parent-version",
    presence: "optional",
    valuePattern: "^v\\d+\\.\\d+$",
    refKind: "version-lineage",
    home: "frontmatter",
    selector: SelectorSpec.frontmatter("parent-version"),
  },
  // The double-layer design body.
  {
    anchor: "## Design",
    presence: "required",
    valuePattern: "^## Design$",
    refKind: "none",
    home: "design-body",
    selector: SelectorSpec.heading("## Design"),
  },
  {
    anchor: "### N. group heading",
    presence: "required",
    valuePattern: "^### \\d+\\. ",
    refKind: "none",
    home: "design-body",
    selector: SelectorSpec.heading(/^### \d+\. /, SelectorSpec.heading("## Design")),
  },
  {
    anchor: "#### N.M item heading",
    presence: "required",
    valuePattern: "^#### \\d+\\.\\d+ ",
    refKind: "none",
    home: "design-body",
    selector: SelectorSpec.heading(/^#### \d+\.\d+ /, SelectorSpec.heading("## Design")),
  },
  {
    anchor: "### Acceptance criteria",
    presence: "required",
    valuePattern: "^### Acceptance criteria$",
    refKind: "none",
    home: "design-body",
    selector: SelectorSpec.heading("### Acceptance criteria"),
  },
  {
    anchor: "Acceptance entry",
    presence: "required",
    valuePattern: "^- `",
    refKind: "none",
    home: "design-body",
    selector: SelectorSpec.list(SelectorSpec.heading("### Acceptance criteria"), /^- `/),
  },
  // The inheritance-point constraint surface (delta-only).
  {
    anchor: "## Constraints",
    presence: "required",
    valuePattern: "^## Constraints$",
    refKind: "none",
    home: "section",
    selector: SelectorSpec.heading("## Constraints"),
  },
  {
    anchor: "Constraint delta bullet",
    presence: "required",
    valuePattern: "^- ",
    refKind: "none",
    home: "section",
    selector: SelectorSpec.list(SelectorSpec.heading("## Constraints"), /^- /),
  },
  // Conditional sections — written only when their condition holds, zero residue otherwise.
  {
    anchor: "## Deviations",
    presence: "conditional",
    valuePattern: "^## Deviations$",
    refKind: "none",
    home: "conditional",
    selector: SelectorSpec.heading("## Deviations"),
  },
  {
    anchor: "Deviations columns",
    presence: "conditional",
    valuePattern: "^\\| Overall assumption \\| Phase decision \\| Overall updated\\? \\|$",
    refKind: "none",
    home: "conditional",
    selector: SelectorSpec.table(
      "root",
      /^\| Overall assumption \| Phase decision \| Overall updated\? \|$/,
    ),
  },
  {
    anchor: "Deviations row",
    presence: "conditional",
    valuePattern: "^\\|\\s*[^|]+\\s*\\|\\s*[^|]+\\s*\\|\\s*(Yes|No)\\b",
    refKind: "none",
    home: "conditional",
    selector: SelectorSpec.table("root", /^\|\s*[^|]+\s*\|\s*[^|]+\s*\|\s*(Yes|No)\b/),
  },
  {
    anchor: "Overall updated answer",
    presence: "conditional",
    valuePattern: "^Yes",
    refKind: "none",
    home: "conditional",
    selector: SelectorSpec.cell(
      SelectorSpec.row(SelectorSpec.table("root", /^\|\s*[^|]+\s*\|\s*[^|]+\s*\|\s*(Yes|No)\b/)),
      /^Yes/,
      3,
    ),
  },
  {
    anchor: "## Incremental warning",
    presence: "conditional",
    valuePattern: "^## Incremental warning$",
    refKind: "none",
    home: "conditional",
    selector: SelectorSpec.heading("## Incremental warning"),
  },
  {
    anchor: "## Notes for downstream",
    presence: "conditional",
    valuePattern: "^## Notes for downstream$",
    refKind: "none",
    home: "conditional",
    selector: SelectorSpec.heading("## Notes for downstream"),
  },
  {
    anchor: "## Review record",
    presence: "conditional",
    valuePattern: "^## Review record$",
    refKind: "none",
    home: "conditional",
    selector: SelectorSpec.heading("## Review record"),
  },
  // Change history — the version-lineage surface (P4.1 T2 · overall-isomorphic): the
  // section heading + the row/version/date cells. Presence is required on the
  // heading (since P4.1 every phase-spec carries a Change-history table).
  {
    anchor: "## Change history",
    presence: "required",
    valuePattern: "^## Change history$",
    refKind: "none",
    home: "section",
    selector: SelectorSpec.heading("## Change history"),
  },
  {
    anchor: "Change history row",
    presence: "required",
    valuePattern: "^\\|\\s*v\\d+\\.\\d+\\s*\\|",
    refKind: "version-lineage",
    home: "table",
    selector: SelectorSpec.table(SelectorSpec.heading("## Change history"), /^\|\s*v\d+\.\d+\s*\|/),
  },
  {
    anchor: "Version token",
    presence: "required",
    valuePattern: "^v\\d+\\.\\d+$",
    refKind: "version-lineage",
    home: "table",
    selector: SelectorSpec.cell(
      SelectorSpec.row(
        SelectorSpec.table(SelectorSpec.heading("## Change history"), /^\|\s*v\d+\.\d+\s*\|/),
      ),
      /^v\d+\.\d+$/,
      1,
    ),
  },
  {
    anchor: "Change history date",
    presence: "required",
    valuePattern: "^\\d{4}-\\d{2}-\\d{2}$",
    refKind: "none",
    home: "table",
    selector: SelectorSpec.cell(
      SelectorSpec.row(
        SelectorSpec.table(SelectorSpec.heading("## Change history"), /^\|\s*v\d+\.\d+\s*\|/),
      ),
      /^\d{4}-\d{2}-\d{2}$/,
      2,
    ),
  },
] as const satisfies readonly Required<RegistryElement>[];

// ---------------------------------------------------------------------------
// single-spec — the lightweight free-form scaffold (P6 T2 · spec §2.1)
// ---------------------------------------------------------------------------
// The fourth doc type — the repair/ruling-oriented free-form document (the
// 2026-09-28-cdd-review-contract-fix "single-spec" form). Deliberately lighter
// than phase-spec: a front-matter key set (title / doc-type / version / date /
// author / issues), four prose body sections and the
// change-history lineage. No `### N.` double-layer outline (the free-form has no
// numbered design groups), no `program:` key (a single-spec is an independent
// program — it names no parent overall). The fixed section sequence runs in
// document order.
const SINGLE_SPEC_ELEMENTS = [
  // Header block — YAML front-matter keys (the frontmatter-home anchor IS the
  // key name). The repaired/ruling carrier keeps the issue pointer as an
  // optional `issues` scalar (single-spec only, §2.3).
  {
    anchor: "title",
    presence: "required",
    valuePattern: "^.+$",
    refKind: "none",
    home: "frontmatter",
    selector: SelectorSpec.frontmatter("title"),
  },
  {
    anchor: "doc-type",
    presence: "required",
    valuePattern: `^(${DOC_TYPE_VALUES.join("|")})$`,
    refKind: "none",
    home: "frontmatter",
    selector: SelectorSpec.frontmatter("doc-type"),
  },
  {
    anchor: "version",
    presence: "required",
    valuePattern: "^v\\d+\\.\\d+$",
    refKind: "version-lineage",
    home: "frontmatter",
    selector: SelectorSpec.frontmatter("version"),
  },
  {
    anchor: "date",
    presence: "required",
    valuePattern: "^\\d{4}-\\d{2}-\\d{2}$",
    refKind: "none",
    home: "frontmatter",
    selector: SelectorSpec.frontmatter("date"),
  },
  {
    anchor: "slug",
    presence: "required",
    valuePattern: SLUG_VALUE_PATTERN,
    refKind: "none",
    home: "frontmatter",
    selector: SelectorSpec.frontmatter("slug"),
  },
  {
    anchor: "author",
    presence: "required",
    valuePattern: "^.+$",
    refKind: "none",
    home: "frontmatter",
    selector: SelectorSpec.frontmatter("author"),
  },
  {
    anchor: "issues",
    presence: "optional",
    valuePattern: "^.+$",
    refKind: "none",
    home: "frontmatter",
    selector: SelectorSpec.frontmatter("issues"),
  },
  // The prose body surface — the free-form's four sections in document order.
  {
    anchor: "## Background & root cause",
    presence: "required",
    valuePattern: "^## Background & root cause$",
    refKind: "none",
    home: "section",
    selector: SelectorSpec.heading("## Background & root cause"),
  },
  {
    anchor: "## Design decisions",
    presence: "required",
    valuePattern: "^## Design decisions$",
    refKind: "none",
    home: "section",
    selector: SelectorSpec.heading("## Design decisions"),
  },
  {
    anchor: "## Acceptance",
    presence: "required",
    valuePattern: "^## Acceptance$",
    refKind: "none",
    home: "section",
    selector: SelectorSpec.heading("## Acceptance"),
  },
  {
    anchor: "## Constraints",
    presence: "required",
    valuePattern: "^## Constraints$",
    refKind: "none",
    home: "section",
    selector: SelectorSpec.heading("## Constraints"),
  },
  // Change history — the version-lineage surface (same shape as the other types).
  {
    anchor: "## Change history",
    presence: "required",
    valuePattern: "^## Change history$",
    refKind: "none",
    home: "section",
    selector: SelectorSpec.heading("## Change history"),
  },
  {
    anchor: "Change history row",
    presence: "required",
    valuePattern: "^\\|\\s*v\\d+\\.\\d+\\s*\\|",
    refKind: "version-lineage",
    home: "table",
    selector: SelectorSpec.table(SelectorSpec.heading("## Change history"), /^\|\s*v\d+\.\d+\s*\|/),
  },
  {
    anchor: "Version token",
    presence: "required",
    valuePattern: "^v\\d+\\.\\d+$",
    refKind: "version-lineage",
    home: "table",
    selector: SelectorSpec.cell(
      SelectorSpec.row(
        SelectorSpec.table(SelectorSpec.heading("## Change history"), /^\|\s*v\d+\.\d+\s*\|/),
      ),
      /^v\d+\.\d+$/,
      1,
    ),
  },
  {
    anchor: "Change history date",
    presence: "required",
    valuePattern: "^\\d{4}-\\d{2}-\\d{2}$",
    refKind: "none",
    home: "table",
    selector: SelectorSpec.cell(
      SelectorSpec.row(
        SelectorSpec.table(SelectorSpec.heading("## Change history"), /^\|\s*v\d+\.\d+\s*\|/),
      ),
      /^\d{4}-\d{2}-\d{2}$/,
      2,
    ),
  },
] as const satisfies readonly Required<RegistryElement>[];

/** The four declared registries — the judge's judgment data and the projection surfaces' derivation source. */
export const declaredRegistries: DeclaredRegistries = {
  overall: { docType: "overall", elements: OVERALL_ELEMENTS },
  plan: { docType: "plan", elements: PLAN_ELEMENTS },
  "phase-spec": { docType: "phase-spec", elements: PHASE_SPEC_ELEMENTS },
  "single-spec": { docType: "single-spec", elements: SINGLE_SPEC_ELEMENTS },
};

/** The role a heading-anchored element plays in the judgment face: a condition that
 *  must hold (`decision`), a record of what happened (`record`), or an identity /
 *  position registration (`registration`). The three roles are a gate's scope, not a
 *  preference — a shape rule judges `decision` sections only, which is why the role
 *  is declared data rather than prose convention (design spec §1.1). */
export type DocFace = "decision" | "record" | "registration";

/** One declared face row: the registry element's `anchor` (the key of the row, never
 *  the title literal the judgment matches on) and its role. */
export interface DocFaceEntry {
  readonly anchor: string;
  readonly face: DocFace;
}

/** The whole face map, per doc type. The domain of this table is the ONE formula
 *  §1.1 states: every registry element whose anchor STARTS with a heading literal
 *  (`## ` · `### ` · `#### `). List items, token anchors, table rows, front-matter
 *  keys and graph edges are outside it — their role follows the section they sit in,
 *  so they owe no row and the map needs no second list. */
export const DOC_FACES: Readonly<Record<DocKey, readonly DocFaceEntry[]>> = {
  overall: [
    { anchor: "## Document scope", face: "decision" },
    { anchor: "## Program charter", face: "decision" },
    { anchor: "### Goal", face: "decision" },
    { anchor: "### Non-goals", face: "decision" },
    { anchor: "### Cross-cutting", face: "decision" },
    { anchor: "## Boundary rules", face: "decision" },
    { anchor: "## Constraints", face: "decision" },
    { anchor: "## Maintenance", face: "decision" },
    { anchor: "## File paths", face: "registration" },
    { anchor: "## Issue inventory", face: "registration" },
    { anchor: "#### [MFRBEN] group", face: "registration" },
    { anchor: "#### Upstream Endorsements", face: "registration" },
    { anchor: "## Phase inventory", face: "registration" },
    { anchor: "## Dependency graph", face: "registration" },
    { anchor: "### 设计决策留存", face: "registration" },
    { anchor: "## Change history", face: "record" },
  ],
  plan: [
    { anchor: "## Constraints", face: "decision" },
    { anchor: "### Task N:", face: "decision" },
    { anchor: "#### Objective", face: "decision" },
    { anchor: "#### Files", face: "decision" },
    { anchor: "#### Consumes", face: "decision" },
    { anchor: "#### Produces", face: "decision" },
    { anchor: "#### Steps", face: "decision" },
    { anchor: "#### Acceptance", face: "decision" },
    { anchor: "#### DependsOn", face: "decision" },
    { anchor: "## Change history", face: "record" },
  ],
  "phase-spec": [
    { anchor: "## Design", face: "decision" },
    { anchor: "### N. group heading", face: "decision" },
    { anchor: "#### N.M item heading", face: "decision" },
    { anchor: "### Acceptance criteria", face: "decision" },
    { anchor: "## Constraints", face: "decision" },
    { anchor: "## Deviations", face: "record" },
    { anchor: "## Incremental warning", face: "record" },
    { anchor: "## Notes for downstream", face: "record" },
    { anchor: "## Review record", face: "record" },
    { anchor: "## Change history", face: "record" },
  ],
  "single-spec": [
    { anchor: "## Background & root cause", face: "decision" },
    { anchor: "## Design decisions", face: "decision" },
    { anchor: "## Acceptance", face: "decision" },
    { anchor: "## Constraints", face: "decision" },
    { anchor: "## Change history", face: "record" },
  ],
};

/** One derived face row: the declared role joined with the element's own heading
 *  matcher. `anchor` is the row's KEY (the registry element's identity), never the
 *  title comparison surface — `headingMatch` is, and it is compiled from the
 *  element's `valuePattern` (or, when the element declares none, from its selector's
 *  heading judgment), so a suffixed or grouped heading resolves without a second
 *  hand-written list. */
export interface FaceRow {
  readonly anchor: string;
  readonly headingMatch: RegExp;
  readonly docKey: DocKey;
  readonly face: DocFace;
}

/** The heading-literal domain test of §1.1 — the ONE formula the domain is derived
 *  from. `/^#{2,4} /` is that formula: a section, a charter facet, a `### Task N:`
 *  block or one of its `####` fields. */
const HEADING_ANCHOR = /^#{2,4} /;

/**
 * FaceMap — the doc-face map as DERIVED DATA (design spec §1.1): the declared
 * `DOC_FACES` roles joined with the registry elements' own title matchers. The map
 * answers one question — "which face is this heading in?" — and a heading it cannot
 * place inside a doc key's domain is a GAP, not a silence: `gaps()` reports every
 * domain element that lost its role, so a missing declaration is red instead of
 * quietly judging nothing.
 */
// biome-ignore lint/complexity/noStaticOnlyClass: the plan-mandated derived-table surface — the zero-bare-function discipline admits no standalone predicate functions.
export class FaceMap {
  /** The derived rows, in declaration order (doc key, then declared order). */
  static readonly ROWS: readonly FaceRow[] = FaceMap.#derive();

  /** The role of one heading line in one doc key's face map. A heading placed by the
   *  INNERMOST matching element wins (a `####` field over the `### Task N:` block that
   *  contains it); a heading no element places is `"unmapped"` — the gap itself. */
  static roleOf(docKey: DocKey, heading: string): DocFace | "unmapped" {
    const line = FaceMap.#normalize(heading);
    let winner: FaceRow | undefined;
    for (const row of FaceMap.ROWS) {
      if (row.docKey !== docKey) continue;
      if (!row.headingMatch.test(line)) continue;
      if (winner === undefined || FaceMap.#levelOf(row.anchor) > FaceMap.#levelOf(winner.anchor)) {
        winner = row;
      }
    }
    return winner === undefined ? "unmapped" : winner.face;
  }

  /** Every domain element that carries no role — empty means the map covers its
   *  domain. The domain is the derived formula (`HEADING_ANCHOR`), never a second
   *  enumeration: a registry element added without a face row reads here. `declaration`
   *  is the same table by default; a caller hands a doctored copy to ask the SAME
   *  derivation what removing a role would report (the counter-arm the declaration
   *  cannot express on itself). */
  static gaps(
    declaration: Readonly<Record<DocKey, readonly DocFaceEntry[]>> = DOC_FACES,
  ): readonly { docKey: DocKey; anchor: string }[] {
    const gaps: { docKey: DocKey; anchor: string }[] = [];
    const rows = FaceMap.#derive(declaration);
    for (const docKey of Object.keys(declaredRegistries) as DocKey[]) {
      const placed = new Set(rows.filter((row) => row.docKey === docKey).map((row) => row.anchor));
      for (const element of declaredRegistries[docKey].elements) {
        if (!HEADING_ANCHOR.test(element.anchor)) continue;
        if (placed.has(element.anchor)) continue;
        gaps.push({ docKey, anchor: element.anchor });
      }
    }
    return gaps;
  }

  /** Join the declared roles with the registry's own elements. An anchor that names
   *  no element is skipped — it then surfaces through `gaps()` on the element the
   *  typo left uncovered, which is the loud face, never a role about nothing. */
  static #derive(
    declaration: Readonly<Record<DocKey, readonly DocFaceEntry[]>> = DOC_FACES,
  ): readonly FaceRow[] {
    const rows: FaceRow[] = [];
    for (const docKey of Object.keys(declaration) as DocKey[]) {
      const elements = declaredRegistries[docKey].elements;
      for (const entry of declaration[docKey]) {
        const element = elements.find((candidate) => candidate.anchor === entry.anchor);
        if (element === undefined) continue;
        rows.push({
          anchor: entry.anchor,
          headingMatch: FaceMap.#headingMatchOf(element),
          docKey,
          face: entry.face,
        });
      }
    }
    return rows;
  }

  /** The element's title matcher — its declared `valuePattern` when it has one (the
   *  value shape IS the title shape for a heading element), otherwise the selector's
   *  own heading judgment. Never the `anchor` literal. */
  static #headingMatchOf(element: RegistryElement): RegExp {
    if (element.valuePattern !== undefined) return new RegExp(element.valuePattern);
    return (
      FaceMap.#selectorHeading(element.selector) ??
      new RegExp(`^${FaceMap.#escaped(element.anchor)}`)
    );
  }

  /** The first heading judgment up a selector's `from` chain, compiled — null when
   *  the selector places the element by another walk. */
  static #selectorHeading(selector: Selector): RegExp | null {
    let current: "root" | Selector = selector;
    while (current !== "root") {
      if (current.walk === "heading" && current.match !== undefined) {
        return current.match instanceof RegExp
          ? current.match
          : new RegExp(`^${FaceMap.#escaped(current.match)}`);
      }
      current = current.from;
    }
    return null;
  }

  /** A heading line folded to its comparison form: whitespace runs collapsed, the
   *  ATX closing sequence dropped. The leading hashes stay — the level is the face
   *  map's innermost-match key. */
  static #normalize(heading: string): string {
    return heading.replace(/\s+/g, " ").replace(/ #+$/, "").trim();
  }

  /** The heading level of one anchor (`## ` is two) — the innermost-match ordering. */
  static #levelOf(line: string): number {
    const hashes = /^#+/.exec(line);
    return hashes === null ? 0 : hashes[0].length;
  }

  /** A literal string escaped for use inside a RegExp source. */
  static #escaped(literal: string): string {
    return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
