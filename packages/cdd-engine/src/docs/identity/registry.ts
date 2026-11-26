// packages/cdd-engine/src/docs/identity/registry.ts
// The declared registries: one typed element table per document type, plus the
// element → heading-face roles derived over them.
//
// A registry is simultaneously the judgment data (which anchors exist, on which surface,
// with which presence and value shape) and the derivation source of every projection
// face (`project.ts`) — no hand-written duplicate of an anchor exists anywhere. The
// elements are declared flat, one row per element, in the order a conforming document
// carries them: the projections, the parser's section walk and the skeleton's slot order
// all read that one order.
//
// Rule zero (over the 200-line class limit): this module is a DATA table, not a class.
// It exceeds the limit because a registry is methodology contract data — one row per
// declared element — and splitting the four registries into four modules would buy
// navigation cost without removing a single variation.
//
// `Loc` is the location factory (a composed query reads as one expression at its row);
// `DOC_FACES` + `FaceMap` join each heading-anchored element to the role its heading
// plays, and report any heading element that lost its role instead of judging it
// silently.

import type {
  DeclaredRegistries,
  DocFace,
  DocFaceEntry,
  DocType,
  ElementLocation,
  RegistryElement,
  When,
} from "./types.ts";
import { DOC_TYPE_VALUES } from "./types.ts";

/** The legal `slug:` value shape — 1–128 characters, an alphanumeric first character,
 *  then alphanumerics / `.` / `_` / `-`. The pattern rejects the directory-escape values
 *  (`.` · `..`, path separators, whitespace) and the Windows reserved characters at the
 *  value surface, because a slug doubles as a workspace directory name. */
export const SLUG_VALUE_PATTERN = "^(?=.{1,128}$)[A-Za-z0-9][A-Za-z0-9._-]*$";

/** The legal `DependsOn id` value shape — one positive task id. The task-block reader's
 *  id domain compiles this SAME source string, so the graph's edge domain and the shape
 *  rule's token domain cannot drift apart. */
export const TASK_ID_VALUE_PATTERN = "^[1-9]\\d*$";

/** One compiled slug-domain reading — the declared pattern's single compilation. */
const SLUG_VALUE = new RegExp(SLUG_VALUE_PATTERN);

/** Whether a value is a legal slug — the ONE reading of the declared domain (a workspace
 *  directory name and a `program:` reference share it). */
export const isLegalSlug = (value: string): boolean => SLUG_VALUE.test(value);

/**
 * Loc — the location factory. One static per walk; each takes the scope it starts from
 * (a parent location or the document root) plus its match and guard, and returns the
 * composed `ElementLocation`.
 */
// biome-ignore lint/complexity/noStaticOnlyClass: the location factory is a pure data surface — the zero-bare-function discipline admits no standalone builder functions, and it holds no state.
class Loc {
  /** The document-root scope. */
  static readonly ROOT: "root" = "root";

  /** A front-matter key locator — the declared key name, located in the head block. */
  static frontmatter(key: string): ElementLocation {
    return { from: Loc.ROOT, walk: "frontmatter", match: key };
  }

  /** A heading locator — a literal heading line (or a heading-prefix pattern). */
  static heading(
    match: string | RegExp,
    from: "root" | ElementLocation = Loc.ROOT,
  ): ElementLocation {
    return { from, walk: "heading", match };
  }

  /** The table under a section heading scope. */
  static table(
    from: "root" | ElementLocation = Loc.ROOT,
    match?: string | RegExp,
  ): ElementLocation {
    return match === undefined ? { from, walk: "table" } : { from, walk: "table", match };
  }

  /** The rows of a table selection — `tableBody` drops the column-header row. */
  static row(
    from: "root" | ElementLocation,
    match?: string | RegExp,
    when: When = "tableBody",
  ): ElementLocation {
    const location: ElementLocation = { from, walk: "row", when };
    return match === undefined ? location : { ...location, match };
  }

  /** The cells of a row selection; `column` is the 1-based ordinal inside the row. */
  static cell(
    from: "root" | ElementLocation,
    match: string | RegExp,
    column?: number,
  ): ElementLocation {
    const location: ElementLocation = { from, walk: "cell", match };
    return column === undefined ? location : { ...location, column };
  }

  /** The list items of a scope (the bullet surfaces: constraint deltas, legends). */
  static list(
    from: "root" | ElementLocation = Loc.ROOT,
    match?: string | RegExp,
    when?: When,
  ): ElementLocation {
    const location: ElementLocation =
      when === undefined ? { from, walk: "list" } : { from, walk: "list", when };
    return match === undefined ? location : { ...location, match };
  }

  /** One task block's reserved field — the `#### Key` section and its value lines. */
  static taskField(
    match: string | RegExp,
    from: "root" | ElementLocation = Loc.ROOT,
    when?: When,
  ): ElementLocation {
    const location: ElementLocation =
      when === undefined ? { from, walk: "taskField" } : { from, walk: "taskField", when };
    return { ...location, match };
  }

  /** One task block's step leaf. */
  static taskStep(match?: string | RegExp, when?: When): ElementLocation {
    const location: ElementLocation =
      when === undefined
        ? { from: Loc.ROOT, walk: "taskStep" }
        : { from: Loc.ROOT, walk: "taskStep", when };
    return match === undefined ? location : { ...location, match };
  }

  /** One dependency-graph edge — a `hard` / `soft` class literal or a line pattern. */
  static graphEdge(match?: "hard" | "soft" | RegExp): ElementLocation {
    return match === undefined
      ? { from: Loc.ROOT, walk: "graphEdge" }
      : { from: Loc.ROOT, walk: "graphEdge", match };
  }
}
const OVERALL = [
  // overall — the charter: its head block, its charter facets and its four tables.
  // Header block — YAML front-matter keys (a frontmatter-home anchor IS the
  // front-matter key name; the value patterns are scalar shapes, §2.3).
  {
    anchor: "title",
    presence: "required",
    valuePattern: "^.+$",
    refKind: "none",
    home: "frontmatter",
    selector: Loc.frontmatter("title"),
  },
  {
    anchor: "doc-type",
    presence: "required",
    valuePattern: `^(${DOC_TYPE_VALUES.join("|")})$`,
    refKind: "none",
    home: "frontmatter",
    selector: Loc.frontmatter("doc-type"),
  },
  {
    anchor: "version",
    presence: "required",
    valuePattern: "^v\\d+\\.\\d+$",
    refKind: "version-lineage",
    home: "frontmatter",
    selector: Loc.frontmatter("version"),
  },
  {
    anchor: "date",
    presence: "required",
    valuePattern: "^\\d{4}-\\d{2}-\\d{2}$",
    refKind: "none",
    home: "frontmatter",
    selector: Loc.frontmatter("date"),
  },
  {
    anchor: "slug",
    presence: "required",
    valuePattern: SLUG_VALUE_PATTERN,
    refKind: "none",
    home: "frontmatter",
    selector: Loc.frontmatter("slug"),
  },
  {
    anchor: "author",
    presence: "required",
    valuePattern: "^.+$",
    refKind: "none",
    home: "frontmatter",
    selector: Loc.frontmatter("author"),
  },
  // `##`-ranked sections.
  {
    anchor: "## Document scope",
    presence: "required",
    valuePattern: "^## Document scope$",
    refKind: "none",
    home: "section",
    selector: Loc.heading("## Document scope"),
  },
  {
    anchor: "## File paths",
    presence: "optional",
    valuePattern: "^## File paths$",
    refKind: "none",
    home: "section",
    selector: Loc.heading("## File paths"),
  },
  {
    anchor: "## Program charter",
    presence: "required",
    valuePattern: "^## Program charter$",
    refKind: "none",
    home: "section",
    selector: Loc.heading("## Program charter"),
  },
  {
    anchor: "## Issue inventory",
    presence: "required",
    valuePattern: "^## Issue inventory$",
    refKind: "none",
    home: "section",
    selector: Loc.heading("## Issue inventory"),
  },
  {
    anchor: "## Phase inventory",
    presence: "required",
    valuePattern: "^## Phase inventory$",
    refKind: "none",
    home: "section",
    selector: Loc.heading("## Phase inventory"),
  },
  {
    anchor: "## Dependency graph",
    presence: "required",
    valuePattern: "^## Dependency graph( \\(ASCII\\))?$",
    refKind: "none",
    home: "section",
    selector: Loc.heading("## Dependency graph"),
  },
  {
    anchor: "## Boundary rules",
    presence: "required",
    valuePattern: "^## Boundary rules$",
    refKind: "none",
    home: "section",
    selector: Loc.heading("## Boundary rules"),
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
    selector: Loc.heading("## Constraints"),
  },
  {
    anchor: "Constraint delta bullet",
    presence: "required",
    valuePattern: "^- ",
    refKind: "none",
    home: "section",
    selector: Loc.list(Loc.heading("## Constraints"), /^- /),
  },
  {
    anchor: "## Maintenance",
    presence: "required",
    valuePattern: "^## Maintenance$",
    refKind: "none",
    home: "section",
    selector: Loc.heading("## Maintenance"),
  },
  {
    anchor: "## Change history",
    presence: "required",
    valuePattern: "^## Change history$",
    refKind: "none",
    home: "section",
    selector: Loc.heading("## Change history"),
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
    selector: Loc.heading("### Goal"),
  },
  {
    anchor: "### Non-goals",
    presence: "required",
    valuePattern: "^### Non-goals",
    refKind: "none",
    home: "facet",
    selector: Loc.heading("### Non-goals"),
  },
  {
    anchor: "### Cross-cutting",
    presence: "required",
    valuePattern: "^### Cross-cutting",
    refKind: "none",
    home: "facet",
    selector: Loc.heading("### Cross-cutting"),
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
    selector: Loc.heading("### 设计决策留存"),
  },
  {
    anchor: "#### [MFRBEN] group",
    presence: "optional",
    valuePattern: "^#### [MFRBEN] group",
    refKind: "none",
    home: "facet",
    selector: Loc.heading(/^#### [MFRBEN] group/),
  },
  {
    anchor: "#### Upstream Endorsements",
    presence: "optional",
    valuePattern: "^#### Upstream Endorsements$",
    refKind: "none",
    home: "facet",
    selector: Loc.heading("#### Upstream Endorsements"),
  },
  // Issue inventory — the anchor-registration domain.
  {
    anchor: "Issue inventory columns",
    presence: "required",
    valuePattern: "^\\| Phase \\| Issue \\(ref\\) \\| Title summary \\|$",
    refKind: "none",
    home: "table",
    selector: Loc.table(
      Loc.heading("## Issue inventory"),
      /^\| Phase \| Issue \(ref\) \| Title summary \|$/,
    ),
  },
  {
    anchor: "Issue row",
    presence: "required",
    valuePattern: "^\\|\\s*P\\d+(\\.\\d+)*\\s*\\|",
    refKind: "issue-ref",
    home: "table",
    selector: Loc.table(Loc.heading("## Issue inventory"), /^\|\s*P\d+(\.\d+)*\s*\|/),
  },
  {
    anchor: "Issue ref cell",
    presence: "required",
    valuePattern: "^(none|#\\d+|\\[#\\d+\\]|#\\d+#issuecomment-\\d+|（[^）]*）|\\([^)]*\\))$",
    refKind: "issue-ref",
    home: "table",
    selector: Loc.cell(
      Loc.row(Loc.table(Loc.heading("## Issue inventory"), /^\|\s*P\d+(\.\d+)*\s*\|/)),
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
    selector: Loc.cell(
      Loc.row(Loc.table(Loc.heading("## Issue inventory"), /^\|\s*P\d+(\.\d+)*\s*\|/)),
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
    selector: Loc.table(
      Loc.heading("## Phase inventory"),
      /^\| # \| Phase \| Scope \| Design spec \| Implementation plan \| Acceptance criteria \| Dependency \|$/,
    ),
  },
  {
    anchor: "Phase row",
    presence: "required",
    valuePattern: "^\\|\\s*P\\d+(\\.\\d+)*\\s*\\|",
    refKind: "phase-id",
    home: "table",
    selector: Loc.table(Loc.heading("## Phase inventory"), /^\|\s*P\d+(\.\d+)*\s*\|/),
  },
  {
    anchor: "Phase id token",
    presence: "required",
    valuePattern: "^P\\d+(\\.\\d+)*$",
    refKind: "phase-id",
    home: "table",
    selector: Loc.cell(
      Loc.row(Loc.table(Loc.heading("## Phase inventory"), /^\|\s*P\d+(\.\d+)*\s*\|/)),
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
    selector: Loc.cell(
      Loc.row(Loc.table(Loc.heading("## Phase inventory"), /^\|\s*P\d+(\.\d+)*\s*\|/)),
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
    selector: Loc.cell(
      Loc.row(Loc.table(Loc.heading("## Phase inventory"), /^\|\s*P\d+(\.\d+)*\s*\|/)),
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
    selector: Loc.cell(
      Loc.row(Loc.table(Loc.heading("## Phase inventory"), /^\|\s*P\d+(\.\d+)*\s*\|/)),
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
    selector: Loc.graphEdge("hard"),
  },
  {
    anchor: "Soft edge",
    presence: "optional",
    valuePattern: "^P\\d+(\\.\\d+)*\\s*->\\s*P\\d+(\\.\\d+)*\\s*\\(?\\s*soft\\s*\\)?",
    refKind: "phase-id",
    home: "graph",
    selector: Loc.graphEdge("soft"),
  },
  {
    anchor: "Graph legend",
    presence: "required",
    valuePattern:
      "^(?:- )?`?->\\s*(?:\\(soft\\))?\\s*`? = hard block|^(?:- )?`?->\\s*\\(soft\\)\\s*`? = suggestion only",
    refKind: "none",
    home: "graph",
    selector: Loc.graphEdge(/->`?\s*=\s*hard block/),
  },
  // File paths artifact table.
  {
    anchor: "File path row",
    presence: "optional",
    valuePattern: "^\\| [^|]+ \\| `[^`]+` \\|$",
    refKind: "none",
    home: "table",
    selector: Loc.table(Loc.heading("## File paths"), /^\| [^|]+ \| `[^`]+` \|$/),
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
    selector: Loc.table(Loc.heading("## Change history"), /^\|\s*v\d+\.\d+\s*\|/),
  },
  {
    anchor: "Version token",
    presence: "required",
    valuePattern: "^v\\d+\\.\\d+$",
    refKind: "version-lineage",
    home: "table",
    selector: Loc.cell(
      Loc.row(Loc.table(Loc.heading("## Change history"), /^\|\s*v\d+\.\d+\s*\|/)),
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
    selector: Loc.cell(
      Loc.row(Loc.table(Loc.heading("## Change history"), /^\|\s*v\d+\.\d+\s*\|/)),
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
    selector: Loc.cell(
      Loc.row(Loc.table(Loc.heading("## Change history"), /^\|\s*v\d+\.\d+\s*\|/)),
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
    selector: Loc.cell(
      Loc.row(Loc.table(Loc.heading("## Phase inventory"), /^\|\s*P\d+(\.\d+)*\s*\|/)),
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
    selector: Loc.cell(
      Loc.row(Loc.table(Loc.heading("## Phase inventory"), /^\|\s*P\d+(\.\d+)*\s*\|/)),
      /^P\d+(\.\d+)*\s*[-–—]\s*P\d+(\.\d+)*$/,
      3,
    ),
  },
] as const satisfies readonly Required<RegistryElement>[];
const PLAN = [
  // plan — the head block, the reserved task-block fields and the change register.
  // Header block — YAML front-matter keys (the frontmatter-home anchor IS the
  // front-matter key name). Plan deliberately omits `author` — no plan head
  // carries that row (the per-type presence contract of §2.3).
  {
    anchor: "title",
    presence: "required",
    valuePattern: "^.+$",
    refKind: "none",
    home: "frontmatter",
    selector: Loc.frontmatter("title"),
  },
  {
    anchor: "doc-type",
    presence: "required",
    valuePattern: `^(${DOC_TYPE_VALUES.join("|")})$`,
    refKind: "none",
    home: "frontmatter",
    selector: Loc.frontmatter("doc-type"),
  },
  {
    anchor: "version",
    presence: "required",
    valuePattern: "^v\\d+\\.\\d+$",
    refKind: "version-lineage",
    home: "frontmatter",
    selector: Loc.frontmatter("version"),
  },
  {
    anchor: "date",
    presence: "required",
    valuePattern: "^\\d{4}-\\d{2}-\\d{2}$",
    refKind: "none",
    home: "frontmatter",
    selector: Loc.frontmatter("date"),
  },
  {
    anchor: "slug",
    presence: "required",
    valuePattern: SLUG_VALUE_PATTERN,
    refKind: "none",
    home: "frontmatter",
    selector: Loc.frontmatter("slug"),
  },
  {
    anchor: "base",
    presence: "optional",
    valuePattern: "^.+$",
    refKind: "none",
    home: "frontmatter",
    selector: Loc.frontmatter("base"),
  },
  // Constraint surface (Form A delta-only).
  {
    anchor: "## Constraints",
    presence: "required",
    valuePattern: "^## Constraints$",
    refKind: "none",
    home: "section",
    selector: Loc.heading("## Constraints"),
  },
  {
    anchor: "Constraint delta bullet",
    presence: "required",
    valuePattern: "^- ",
    refKind: "none",
    home: "section",
    selector: Loc.list(Loc.heading("## Constraints"), /^- /),
  },
  {
    anchor: "Constraint delta sub-heading",
    presence: "optional",
    valuePattern: "^### ",
    refKind: "none",
    home: "section",
    selector: Loc.heading(/^### /, Loc.heading("## Constraints")),
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
    selector: Loc.heading(/^### Task \d+:/),
  },
  {
    anchor: "Task id token",
    presence: "required",
    valuePattern: "^\\d+$",
    refKind: "task-id",
    home: "task-block",
    selector: Loc.heading(/^### Task ([1-9]\d*):/),
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
    selector: Loc.taskField("#### Objective"),
  },
  {
    anchor: "#### Files",
    presence: "required",
    valuePattern: "^#### Files$",
    refKind: "none",
    home: "task-field",
    selector: Loc.taskField("#### Files"),
  },
  {
    anchor: "File path token",
    presence: "required",
    valuePattern: "^[\\w./-]+",
    refKind: "none",
    home: "task-field",
    selector: Loc.taskField(/^[\w./-]+/, Loc.taskField("#### Files")),
  },
  {
    anchor: "#### Consumes",
    presence: "required",
    valuePattern: "^#### Consumes$",
    refKind: "none",
    home: "task-field",
    selector: Loc.taskField("#### Consumes"),
  },
  {
    anchor: "#### Produces",
    presence: "required",
    valuePattern: "^#### Produces$",
    refKind: "none",
    home: "task-field",
    selector: Loc.taskField("#### Produces"),
  },
  {
    anchor: "#### Steps",
    presence: "required",
    valuePattern: "^#### Steps$",
    refKind: "none",
    home: "task-field",
    selector: Loc.taskField("#### Steps"),
  },
  // Step leaves — execution steps and their verifiable outcomes.
  {
    anchor: "Step action",
    presence: "required",
    valuePattern: "^- ",
    refKind: "none",
    home: "task-step",
    selector: Loc.taskStep(/^- /),
  },
  {
    anchor: "Step checkable",
    presence: "required",
    valuePattern: "—\\s*checkable:\\s*\\S",
    refKind: "none",
    home: "task-step",
    selector: Loc.taskStep(/—+\s*checkable:\s*\S/),
  },
  {
    anchor: "#### Acceptance",
    presence: "required",
    valuePattern: "^#### Acceptance$",
    refKind: "none",
    home: "task-field",
    selector: Loc.taskField("#### Acceptance"),
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
    selector: Loc.taskField("#### DependsOn"),
  },
  {
    anchor: "DependsOn none",
    presence: "optional",
    valuePattern: "^(none|\\s*)$",
    refKind: "none",
    home: "task-field",
    selector: Loc.taskField(/^(none|\s*)$/, Loc.taskField("#### DependsOn")),
  },
  {
    anchor: "DependsOn id",
    presence: "optional",
    valuePattern: TASK_ID_VALUE_PATTERN,
    refKind: "task-id",
    home: "task-field",
    selector: Loc.taskField(/^[1-9]\d*$/, Loc.taskField("#### DependsOn")),
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
    selector: Loc.taskField(/\b(?:Task|T)\s*([1-9]\d*)\b(?!\.\d)/),
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
    selector: Loc.heading("## Change history"),
  },
  {
    anchor: "Change history row",
    presence: "required",
    valuePattern: "^\\|\\s*v\\d+\\.\\d+\\s*\\|",
    refKind: "version-lineage",
    home: "table",
    selector: Loc.table(Loc.heading("## Change history"), /^\|\s*v\d+\.\d+\s*\|/),
  },
  {
    anchor: "Version token",
    presence: "required",
    valuePattern: "^v\\d+\\.\\d+$",
    refKind: "version-lineage",
    home: "table",
    selector: Loc.cell(
      Loc.row(Loc.table(Loc.heading("## Change history"), /^\|\s*v\d+\.\d+\s*\|/)),
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
    selector: Loc.cell(
      Loc.row(Loc.table(Loc.heading("## Change history"), /^\|\s*v\d+\.\d+\s*\|/)),
      /^\d{4}-\d{2}-\d{2}$/,
      2,
    ),
  },
] as const satisfies readonly Required<RegistryElement>[];
const PHASE_SPEC = [
  // phase-spec — the head block, the design double layer and the acceptance/constraint
  // surfaces.
  // Header block — YAML front-matter keys (the frontmatter-home anchor IS the
  // key name). The old line-scan phase-id fallback is retired — its anchor never
  // appeared in any document literal and it had zero consumers.
  {
    anchor: "title",
    presence: "required",
    valuePattern: "^.+$",
    refKind: "none",
    home: "frontmatter",
    selector: Loc.frontmatter("title"),
  },
  {
    anchor: "doc-type",
    presence: "required",
    valuePattern: `^(${DOC_TYPE_VALUES.join("|")})$`,
    refKind: "none",
    home: "frontmatter",
    selector: Loc.frontmatter("doc-type"),
  },
  {
    anchor: "version",
    presence: "required",
    valuePattern: "^v\\d+\\.\\d+$",
    refKind: "version-lineage",
    home: "frontmatter",
    selector: Loc.frontmatter("version"),
  },
  {
    anchor: "date",
    presence: "required",
    valuePattern: "^\\d{4}-\\d{2}-\\d{2}$",
    refKind: "none",
    home: "frontmatter",
    selector: Loc.frontmatter("date"),
  },
  {
    anchor: "slug",
    presence: "required",
    valuePattern: SLUG_VALUE_PATTERN,
    refKind: "none",
    home: "frontmatter",
    selector: Loc.frontmatter("slug"),
  },
  {
    anchor: "program",
    presence: "required",
    valuePattern: SLUG_VALUE_PATTERN,
    refKind: "slug-ref",
    home: "frontmatter",
    selector: Loc.frontmatter("program"),
  },
  {
    anchor: "author",
    presence: "required",
    valuePattern: "^.+$",
    refKind: "none",
    home: "frontmatter",
    selector: Loc.frontmatter("author"),
  },
  {
    anchor: "parent-version",
    presence: "optional",
    valuePattern: "^v\\d+\\.\\d+$",
    refKind: "version-lineage",
    home: "frontmatter",
    selector: Loc.frontmatter("parent-version"),
  },
  // The double-layer design body.
  {
    anchor: "## Design",
    presence: "required",
    valuePattern: "^## Design$",
    refKind: "none",
    home: "design-body",
    selector: Loc.heading("## Design"),
  },
  {
    anchor: "### N. group heading",
    presence: "required",
    valuePattern: "^### \\d+\\. ",
    refKind: "none",
    home: "design-body",
    selector: Loc.heading(/^### \d+\. /, Loc.heading("## Design")),
  },
  {
    anchor: "#### N.M item heading",
    presence: "required",
    valuePattern: "^#### \\d+\\.\\d+ ",
    refKind: "none",
    home: "design-body",
    selector: Loc.heading(/^#### \d+\.\d+ /, Loc.heading("## Design")),
  },
  {
    anchor: "### Acceptance criteria",
    presence: "required",
    valuePattern: "^### Acceptance criteria$",
    refKind: "none",
    home: "design-body",
    selector: Loc.heading("### Acceptance criteria"),
  },
  {
    anchor: "Acceptance entry",
    presence: "required",
    valuePattern: "^- `",
    refKind: "none",
    home: "design-body",
    selector: Loc.list(Loc.heading("### Acceptance criteria"), /^- `/),
  },
  // The inheritance-point constraint surface (delta-only).
  {
    anchor: "## Constraints",
    presence: "required",
    valuePattern: "^## Constraints$",
    refKind: "none",
    home: "section",
    selector: Loc.heading("## Constraints"),
  },
  {
    anchor: "Constraint delta bullet",
    presence: "required",
    valuePattern: "^- ",
    refKind: "none",
    home: "section",
    selector: Loc.list(Loc.heading("## Constraints"), /^- /),
  },
  // Conditional sections — written only when their condition holds, zero residue otherwise.
  {
    anchor: "## Deviations",
    presence: "conditional",
    valuePattern: "^## Deviations$",
    refKind: "none",
    home: "conditional",
    selector: Loc.heading("## Deviations"),
  },
  {
    anchor: "Deviations columns",
    presence: "conditional",
    valuePattern: "^\\| Overall assumption \\| Phase decision \\| Overall updated\\? \\|$",
    refKind: "none",
    home: "conditional",
    selector: Loc.table(
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
    selector: Loc.table("root", /^\|\s*[^|]+\s*\|\s*[^|]+\s*\|\s*(Yes|No)\b/),
  },
  {
    anchor: "Overall updated answer",
    presence: "conditional",
    valuePattern: "^Yes",
    refKind: "none",
    home: "conditional",
    selector: Loc.cell(
      Loc.row(Loc.table("root", /^\|\s*[^|]+\s*\|\s*[^|]+\s*\|\s*(Yes|No)\b/)),
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
    selector: Loc.heading("## Incremental warning"),
  },
  {
    anchor: "## Notes for downstream",
    presence: "conditional",
    valuePattern: "^## Notes for downstream$",
    refKind: "none",
    home: "conditional",
    selector: Loc.heading("## Notes for downstream"),
  },
  {
    anchor: "## Review record",
    presence: "conditional",
    valuePattern: "^## Review record$",
    refKind: "none",
    home: "conditional",
    selector: Loc.heading("## Review record"),
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
    selector: Loc.heading("## Change history"),
  },
  {
    anchor: "Change history row",
    presence: "required",
    valuePattern: "^\\|\\s*v\\d+\\.\\d+\\s*\\|",
    refKind: "version-lineage",
    home: "table",
    selector: Loc.table(Loc.heading("## Change history"), /^\|\s*v\d+\.\d+\s*\|/),
  },
  {
    anchor: "Version token",
    presence: "required",
    valuePattern: "^v\\d+\\.\\d+$",
    refKind: "version-lineage",
    home: "table",
    selector: Loc.cell(
      Loc.row(Loc.table(Loc.heading("## Change history"), /^\|\s*v\d+\.\d+\s*\|/)),
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
    selector: Loc.cell(
      Loc.row(Loc.table(Loc.heading("## Change history"), /^\|\s*v\d+\.\d+\s*\|/)),
      /^\d{4}-\d{2}-\d{2}$/,
      2,
    ),
  },
] as const satisfies readonly Required<RegistryElement>[];
const SINGLE_SPEC = [
  // single-spec — the lightest registry: the head block and four prose sections.
  // Header block — YAML front-matter keys (the frontmatter-home anchor IS the
  // key name). The repaired/ruling carrier keeps the issue pointer as an
  // optional `issues` scalar (single-spec only, §2.3).
  {
    anchor: "title",
    presence: "required",
    valuePattern: "^.+$",
    refKind: "none",
    home: "frontmatter",
    selector: Loc.frontmatter("title"),
  },
  {
    anchor: "doc-type",
    presence: "required",
    valuePattern: `^(${DOC_TYPE_VALUES.join("|")})$`,
    refKind: "none",
    home: "frontmatter",
    selector: Loc.frontmatter("doc-type"),
  },
  {
    anchor: "version",
    presence: "required",
    valuePattern: "^v\\d+\\.\\d+$",
    refKind: "version-lineage",
    home: "frontmatter",
    selector: Loc.frontmatter("version"),
  },
  {
    anchor: "date",
    presence: "required",
    valuePattern: "^\\d{4}-\\d{2}-\\d{2}$",
    refKind: "none",
    home: "frontmatter",
    selector: Loc.frontmatter("date"),
  },
  {
    anchor: "slug",
    presence: "required",
    valuePattern: SLUG_VALUE_PATTERN,
    refKind: "none",
    home: "frontmatter",
    selector: Loc.frontmatter("slug"),
  },
  {
    anchor: "author",
    presence: "required",
    valuePattern: "^.+$",
    refKind: "none",
    home: "frontmatter",
    selector: Loc.frontmatter("author"),
  },
  {
    anchor: "issues",
    presence: "optional",
    valuePattern: "^.+$",
    refKind: "none",
    home: "frontmatter",
    selector: Loc.frontmatter("issues"),
  },
  // The prose body surface — the free-form's four sections in document order.
  {
    anchor: "## Background & root cause",
    presence: "required",
    valuePattern: "^## Background & root cause$",
    refKind: "none",
    home: "section",
    selector: Loc.heading("## Background & root cause"),
  },
  {
    anchor: "## Design decisions",
    presence: "required",
    valuePattern: "^## Design decisions$",
    refKind: "none",
    home: "section",
    selector: Loc.heading("## Design decisions"),
  },
  {
    anchor: "## Acceptance",
    presence: "required",
    valuePattern: "^## Acceptance$",
    refKind: "none",
    home: "section",
    selector: Loc.heading("## Acceptance"),
  },
  {
    anchor: "## Constraints",
    presence: "required",
    valuePattern: "^## Constraints$",
    refKind: "none",
    home: "section",
    selector: Loc.heading("## Constraints"),
  },
  // Change history — the version-lineage surface (same shape as the other types).
  {
    anchor: "## Change history",
    presence: "required",
    valuePattern: "^## Change history$",
    refKind: "none",
    home: "section",
    selector: Loc.heading("## Change history"),
  },
  {
    anchor: "Change history row",
    presence: "required",
    valuePattern: "^\\|\\s*v\\d+\\.\\d+\\s*\\|",
    refKind: "version-lineage",
    home: "table",
    selector: Loc.table(Loc.heading("## Change history"), /^\|\s*v\d+\.\d+\s*\|/),
  },
  {
    anchor: "Version token",
    presence: "required",
    valuePattern: "^v\\d+\\.\\d+$",
    refKind: "version-lineage",
    home: "table",
    selector: Loc.cell(
      Loc.row(Loc.table(Loc.heading("## Change history"), /^\|\s*v\d+\.\d+\s*\|/)),
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
    selector: Loc.cell(
      Loc.row(Loc.table(Loc.heading("## Change history"), /^\|\s*v\d+\.\d+\s*\|/)),
      /^\d{4}-\d{2}-\d{2}$/,
      2,
    ),
  },
] as const satisfies readonly Required<RegistryElement>[];

/** The four declared registries — the judgment data and the projection surfaces' single
 *  derivation source. */
export const declaredRegistries: DeclaredRegistries = {
  overall: { docType: "overall", elements: OVERALL },
  plan: { docType: "plan", elements: PLAN },
  "phase-spec": { docType: "phase-spec", elements: PHASE_SPEC },
  "single-spec": { docType: "single-spec", elements: SINGLE_SPEC },
};

/** The whole face map, per document type. Its domain is the ONE formula §1.1 states:
 *  every registry element whose anchor STARTS with a heading literal (`## ` · `### ` ·
 *  `#### `). List items, token anchors, table rows, front-matter keys and graph edges are
 *  outside it — their role follows the section they sit in, so they owe no row. */
export const DOC_FACES: Readonly<Record<DocType, readonly DocFaceEntry[]>> = {
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
 *  matcher. `anchor` is the row's KEY, never the title comparison surface —
 *  `headingMatch` is, compiled from the element's `valuePattern` (or from its location's
 *  heading judgment), so a suffixed or grouped heading resolves without a second
 *  hand-written list. */
export interface FaceRow {
  /** The registry element's anchor. */
  readonly anchor: string;
  /** The compiled heading judgment. */
  readonly headingMatch: RegExp;
  /** The document type the row belongs to. */
  readonly docType: DocType;
  /** The role the heading plays. */
  readonly face: DocFace;
}

/** The heading-literal domain test of §1.1 — the ONE formula the domain is derived from:
 *  a section, a charter facet, a `### Task N:` block or one of its `####` fields. */
const HEADING_ANCHOR = /^#{2,4} /;

/**
 * FaceMap — the doc-face map as DERIVED data: the declared roles joined with the
 * registry elements' own title matchers. It answers one question — "which face is this
 * heading in?" — and a heading it cannot place inside a document type's domain is a GAP,
 * not a silence: `gaps()` reports every domain element that lost its role, so a missing
 * declaration is red instead of quietly judging nothing.
 */
// biome-ignore lint/complexity/noStaticOnlyClass: the plan-mandated derived-table surface — the zero-bare-function discipline admits no standalone predicate functions.
export class FaceMap {
  /** The derived rows, in declaration order (document type, then declared order). */
  static readonly ROWS: readonly FaceRow[] = FaceMap.#derive();

  /** The role of one heading line in one document type's face map. The INNERMOST
   *  matching element wins (a `####` field over the `### Task N:` block containing it). A
   *  heading no element places INHERITS the role of its nearest registered ancestor —
   *  `ancestors` is that heading stack from the innermost out — and only a heading with
   *  no registered ancestor at all is `"unmapped"`: the gap itself. */
  static roleOf(
    docType: DocType,
    heading: string,
    ancestors: readonly string[] = [],
  ): DocFace | "unmapped" {
    const own = FaceMap.#matchOf(docType, FaceMap.#normalize(heading));
    if (own !== undefined) return own.face;
    for (const ancestor of ancestors) {
      const inherited = FaceMap.#matchOf(docType, FaceMap.#normalize(ancestor));
      if (inherited !== undefined) return inherited.face;
    }
    return "unmapped";
  }

  /** The innermost row of one document type that places a normalized heading line. */
  static #matchOf(docType: DocType, line: string): FaceRow | undefined {
    let winner: FaceRow | undefined;
    for (const row of FaceMap.ROWS) {
      if (row.docType !== docType) continue;
      if (!row.headingMatch.test(line)) continue;
      if (winner === undefined || FaceMap.#levelOf(row.anchor) > FaceMap.#levelOf(winner.anchor)) {
        winner = row;
      }
    }
    return winner;
  }

  /** Every domain element that carries no role — empty means the map covers its domain.
   *  The domain is the derived formula (`HEADING_ANCHOR`), never a second enumeration: a
   *  registry element added without a face row reads here. `declaration` is the same
   *  table by default; a caller hands a doctored copy to ask the SAME derivation what
   *  removing a role would report (the counter-arm the declaration cannot express on
   *  itself). */
  static gaps(
    declaration: Readonly<Record<DocType, readonly DocFaceEntry[]>> = DOC_FACES,
  ): readonly { docType: DocType; anchor: string }[] {
    const gaps: { docType: DocType; anchor: string }[] = [];
    const rows = FaceMap.#derive(declaration);
    for (const docType of DOC_TYPE_VALUES) {
      const placed = new Set(
        rows.filter((row) => row.docType === docType).map((row) => row.anchor),
      );
      for (const element of declaredRegistries[docType].elements) {
        if (!HEADING_ANCHOR.test(element.anchor)) continue;
        if (placed.has(element.anchor)) continue;
        gaps.push({ docType, anchor: element.anchor });
      }
    }
    return gaps;
  }

  /** Join the declared roles with the registry's own elements. An anchor naming no
   *  element is skipped — it then surfaces through `gaps()` on the element the typo left
   *  uncovered, which is the loud face, never a role about nothing. */
  static #derive(
    declaration: Readonly<Record<DocType, readonly DocFaceEntry[]>> = DOC_FACES,
  ): readonly FaceRow[] {
    const rows: FaceRow[] = [];
    for (const docType of DOC_TYPE_VALUES) {
      const elements = declaredRegistries[docType].elements;
      for (const entry of declaration[docType]) {
        const element = elements.find((candidate) => candidate.anchor === entry.anchor);
        if (element === undefined) continue;
        const headingMatch = FaceMap.#headingMatchOf(element);
        if (headingMatch === null) continue;
        rows.push({ anchor: entry.anchor, headingMatch, docType, face: entry.face });
      }
    }
    return rows;
  }

  /** The element's title matcher — its declared `valuePattern` when it has one (the value
   *  shape IS the title shape for a heading element), otherwise its location's own
   *  heading judgment. Never the `anchor` literal: an element declaring neither has no
   *  title matcher (`null`) and falls to `gaps()`. */
  static #headingMatchOf(element: RegistryElement): RegExp | null {
    if (element.valuePattern !== undefined) return new RegExp(element.valuePattern);
    return FaceMap.#selectorHeading(element.selector);
  }

  /** The first heading judgment up a location's `from` chain, compiled — null when the
   *  location places the element by another walk. */
  static #selectorHeading(selector: ElementLocation): RegExp | null {
    let current: "root" | ElementLocation = selector;
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

  /** A heading line folded to its comparison form: whitespace runs collapsed, the ATX
   *  closing sequence dropped. The leading hashes stay — the level is the innermost-match
   *  key. */
  static #normalize(heading: string): string {
    return heading.replace(/\s+/g, " ").replace(/ #+$/, "").trim();
  }

  /** The heading level of one anchor (`## ` is two) — the innermost-match ordering. */
  static #levelOf(line: string): number {
    const hashes = /^#+/.exec(line);
    return hashes === null ? 0 : hashes[0].length;
  }

  /** A literal string escaped for use inside a pattern source. */
  static #escaped(literal: string): string {
    return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
