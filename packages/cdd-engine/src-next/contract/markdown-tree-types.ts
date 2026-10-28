// packages/cdd-engine/src-next/contract/markdown-tree-types.ts
// P21 §7.5 — the tree's shared vocabulary: the selector query, the resolved node
// and the structural records the three tree classes exchange (the document index,
// the selector engine and the block grammar). Types only — the runtime lives in
// those three classes, so the vocabulary never pulls an implementation in.

/** The nine structural walks of the selector face — the eight briefed surfaces
 *  plus `frontmatter`, the YAML head block (the 30 front-matter elements the
 *  brief's eight walks cannot locate). */
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

/** The guard a walk may carry — the "which of the walked nodes" refinement. */
export type When = "first" | "last" | "tableBody" | "inTaskBlock";

/** A composable locator: `from` a parent selector (or the document root), `walk`
 *  the structural surface, `match` the node text (a literal prefix or a RegExp),
 *  `when` the guard. Selectors are declared data on the registry elements. */
export interface Selector {
  /** The parent selector — scopes the walk to the parent's line span — or the root. */
  readonly from: "root" | Selector;
  /** The structural surface this selector walks. */
  readonly walk: Walk;
  /** The node-text constraint: a literal (an exact line or a heading prefix) or a
   *  RegExp tested against the node's raw line. */
  readonly match?: string | RegExp;
  /** The walk's guard. */
  readonly when?: When;
}

/** One resolved node — the locating result the judgments read. */
export interface ResolvedNode {
  /** The node's own raw source line (a value shape judges THIS, never a re-scan). */
  readonly text: string;
  /** The same line with its inline-code spans removed (a cited anchor is no value). */
  readonly bare: string;
  /** The node's raw source lines (the field value lines / the row line). */
  readonly lines: readonly string[];
  /** The 1-based line the node starts at (the finding's locator). */
  readonly line: number;
  /** The row's cells — set for row / cell / table walks. */
  readonly cells?: readonly string[];
}

/** One rank-2 section node — the heading line plus the body lines under it. */
export interface SectionNode {
  /** The section heading line, verbatim. */
  readonly text: string;
  /** The section's body lines (up to the next rank-2 heading). */
  readonly lines: readonly string[];
  /** The 1-based heading line. */
  readonly line: number;
}

/** One `## Dependency graph` edge line — the graph surface's leaf record. */
export interface TreeEdge {
  /** The edge's from-phase token (`P<n>`, a `.digits` suffix included). */
  readonly from: string;
  /** The edge's to-phase token. */
  readonly to: string;
  /** Whether the edge blocks (a hard edge) or only suggests (a soft edge). */
  readonly hard: boolean;
}

/** One heading of the document (any rank) — the structure's skeleton record. */
export interface HeadingNode {
  /** The heading line, verbatim (leading `#`s included). */
  readonly text: string;
  /** The heading's rank (1..6). */
  readonly depth: number;
  /** The 1-based heading line. */
  readonly line: number;
  /** The lines between this heading and the next heading of any rank. */
  readonly bodyLines: readonly string[];
}

/** The front-matter key locator — the key name, its scalar text and its line. */
export interface FrontMatterKeyNode {
  /** The declared key name (`slug`, `version`, …). */
  readonly key: string;
  /** The key's raw value text (the YAML line's remainder, quotes kept). */
  readonly value: string;
  /** The 1-based line the key sits on. */
  readonly line: number;
}

/** One heading's line span — the child walks' scope (the heading line plus the
 *  section body). */
export interface HeadingScope {
  /** The heading line, verbatim. */
  readonly text: string;
  /** The 1-based heading line. */
  readonly line: number;
  /** The span start (the heading line). */
  readonly from: number;
  /** The span end (the line before the next heading of rank 2 or shallower). */
  readonly to: number;
}

/** One mdast node, structurally narrowed to the members this tree reads (the
 *  library's own node types stay out of the public surface). */
export interface MdNode {
  readonly type?: string;
  readonly depth?: number;
  readonly value?: string;
  readonly children?: readonly MdNode[];
  readonly position?: MdSpan;
}

/** The mdast source span of one node. */
export interface MdSpan {
  readonly start?: { readonly line?: number; readonly column?: number; readonly offset?: number };
  readonly end?: { readonly line?: number; readonly column?: number; readonly offset?: number };
}

/** One candidate the walks produce before matching — a resolved node plus the
 *  span the child walks scope themselves to. */
export interface Candidate extends ResolvedNode {
  /** The candidate's span start line (the child-walk scope). */
  readonly from: number;
  /** The candidate's span end line (the child-walk scope). */
  readonly to: number;
  /** The table row is a column-header row (the `tableBody` guard excludes it). */
  readonly header?: boolean;
  /** The graph edge class (`hard` / `soft`) — the graphEdge walk's literal match. */
  readonly edgeClass?: "hard" | "soft";
}

/** One value line of a task section — its trimmed text and its document line. */
export interface TaskValueEntry {
  readonly text: string;
  readonly line: number;
}

/** One `#### Key` section of a task block — the key, its line span, its value
 *  lines and the same value lines with their 1-based document line numbers (the
 *  node-span addressing the step walk's bare view reads). */
export interface TaskSection {
  readonly key: string;
  readonly start: number;
  readonly end: number;
  readonly lines: readonly string[];
  readonly entries: readonly TaskValueEntry[];
}

/** One parsed table — its header row and its body rows (each row carrying its
 *  cells), plus the span the child walks scope themselves to. */
export interface TableRecord {
  readonly header: Candidate | null;
  readonly body: readonly Candidate[];
  readonly from: number;
  readonly to: number;
}

/** A line span a child walk may be scoped to. */
export interface LineSpan {
  readonly from: number;
  readonly to: number;
}
