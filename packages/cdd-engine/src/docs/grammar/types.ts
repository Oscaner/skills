// packages/cdd-engine/src/docs/grammar/types.ts
// The grammar's shared vocabulary: the immutable value types the index, the tree, the
// body projection and the task-block parse exchange. Types only — no behaviour, so a
// reader of one module never pulls another module's implementation in through the
// vocabulary.

/** The mdast source span of one node, narrowed to the members this grammar reads. */
export interface MdSpan {
  readonly start?: { readonly line?: number; readonly column?: number; readonly offset?: number };
  readonly end?: { readonly line?: number; readonly column?: number; readonly offset?: number };
}

/** One mdast node, structurally narrowed to the members this grammar reads — the
 *  library's own node types stay out of the public surface. */
export interface MdNode {
  readonly type?: string;
  readonly depth?: number;
  readonly value?: string;
  readonly children?: readonly MdNode[];
  readonly position?: MdSpan;
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

/** One heading's line span — a child read's scope. */
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

/** One `## Heading` section — the heading line plus the body lines under it. */
export interface SectionNode {
  /** The section heading line, verbatim. */
  readonly text: string;
  /** The section's body lines (up to the next rank-2 heading). */
  readonly lines: readonly string[];
  /** The 1-based heading line. */
  readonly line: number;
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

/** One table row — its cells, its 1-based line and the span it covers. */
export interface TableRow {
  /** The row's cells, left to right (inline markdown preserved). */
  readonly cells: readonly string[];
  /** The 1-based line the row starts at. */
  readonly line: number;
  /** The span start line. */
  readonly from: number;
  /** The span end line. */
  readonly to: number;
}

/** One parsed table — its header row (absent for a headerless record) and body rows. */
export interface TableRecord {
  /** The header row, or null. */
  readonly header: TableRow | null;
  /** The body rows, in document order. */
  readonly body: readonly TableRow[];
  /** The span start line. */
  readonly from: number;
  /** The span end line. */
  readonly to: number;
}

/** One value line of a task section — its trimmed text and its document line. */
export interface TaskValueEntry {
  /** The trimmed line text. */
  readonly text: string;
  /** The 1-based document line. */
  readonly line: number;
}

/** One `#### Key` section of a task block. */
export interface TaskSection {
  /** The section key (the heading text after the `####`). */
  readonly key: string;
  /** The 1-based line the section heading sits on. */
  readonly start: number;
  /** The 1-based line the section ends on (inclusive). */
  readonly end: number;
  /** The section's value lines, trimmed, blanks dropped. */
  readonly lines: readonly string[];
  /** The same value lines with their document line numbers. */
  readonly entries: readonly TaskValueEntry[];
}

/** One parsed `### Task N:` block. */
export interface TaskBlock {
  /** The task number N. */
  readonly id: number;
  /** The `### Task N: …` heading line, verbatim. */
  readonly heading: string;
  /** The block's sections in document order (the reserved keys plus any extension). */
  readonly sections: readonly TaskSection[];
  /** The block's line range, both ends inclusive. */
  readonly range: { readonly start: number; readonly end: number };
  /** The block's shape: `#### Key` heading sections or the legacy bullet markers. */
  readonly shape: "heading" | "legacy";
}
