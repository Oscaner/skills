// packages/cdd-engine/src-next/contract/task-blocks.ts
// P21 §7 — the plan task-block contract: the record family plus the reader facade
// over the ONE block parse (markdown-tree.ts). The block STRUCTURE is read through
// the markdown tree instead of the retired line-marker grammar:
//
//   · the new shape carries the seven reserved sections as `#### Key` headings inside
//     a `### Task N:` block; any additional `####` section is an extension section
//     (body text only — it never participates in the required/domain judgment);
//   · the legacy bullet shape (`- **Key**: …`) stays readable as a compatibility
//     input: the normalization of the two node shapes into ONE `TaskBlock` is a
//     method of the tree's block parse, never a second declaration in the registry;
//   · the block's `range` (1-based line numbers) is the brief's slice basis — a
//     line-scan that stops at any `#` heading truncates a block at its first `####`
//     child, so a heading-shaped plan would render a brief with missing sections.
//
// Module-level exports are types / the class — zero behavior-carrying bare functions.

import { TASK_ID_VALUE_PATTERN } from "./declare.ts";
import { MarkdownTree, TaskBlockGrammar } from "./markdown-tree.ts";

/** One parsed field of a task block — the reserved key or an extension section's
 *  heading, plus the section's value lines. */
export interface TaskField {
  /** The field key — the seven reserved keys or an extension section's heading. */
  readonly key: string;
  /** The field's value lines (markers stripped, blank lines dropped). */
  readonly lines: readonly string[];
}

/** One parsed step line of a task block's `Steps` section. */
export interface TaskStep {
  /** The step's action text (after the leading bullet). */
  readonly action: string;
  /** The step's `— checkable:` clause text, when the line carries one. */
  readonly checkable: string | null;
}

/** One parsed `### Task N:` block. */
export interface TaskBlock {
  /** The task number N. */
  readonly id: number;
  /** The `### Task N: …` heading line verbatim. */
  readonly heading: string;
  /** The block's fields in document order (the seven reserved keys + any extension
   *  section — the key IS the section heading). */
  readonly fields: readonly TaskField[];
  /** The parsed `Steps` bullets. */
  readonly steps: readonly TaskStep[];
  /** The block's line range (1-based, both ends inclusive) — the brief's slice basis. */
  readonly range: { readonly start: number; readonly end: number };
  /** The block's shape: the heading sections or the legacy bullet markers. */
  readonly shape: "heading" | "legacy";
}

/**
 * PlanTaskBlocksReader — the plan's task-block read face: a thin facade over the
 * tree's block parse, so the block grammar lives in ONE place (markdown-tree.ts)
 * and every consumer — the graph's `DependsOn`, the brief's slices, the skeleton —
 * reads the same `TaskBlock` records.
 */
export class PlanTaskBlocksReader {
  /** The seven reserved section keys, in the canonical document order. */
  static readonly RESERVED: readonly string[] = TaskBlockGrammar.RESERVED;

  /** The task-block heading — `### Task N: <title>` (the title stays optional). */
  static readonly TASK_HEADING = TaskBlockGrammar.TASK_HEADING;

  /** The legacy field marker — `- **Key**: <value>`. */
  static readonly LEGACY_FIELD = TaskBlockGrammar.LEGACY_FIELD;

  /** The step bullet — a list item's text line. */
  static readonly STEP_LINE = TaskBlockGrammar.STEP_LINE;

  /** The `— checkable:` clause separator. */
  static readonly CHECKABLE = TaskBlockGrammar.CHECKABLE;

  /** A dependency id token — the declared `DependsOn id` value domain (the SAME
   *  source string the registry element carries). */
  static readonly ID_TOKEN = new RegExp(TASK_ID_VALUE_PATTERN);

  /** Parse a whole plan document into its `### Task N:` blocks. */
  parse(content: string): readonly TaskBlock[] {
    return MarkdownTree.parse(content).tasks();
  }

  /** The dependency ids one block declares — the `DependsOn` section's FIRST line
   *  (the declared single-line value; `none` / empty carries zero edges). The
   *  parenthetical tail after `(` / `（` is prose, never a dependency. */
  dependsOn(block: TaskBlock): readonly number[] {
    const field = block.fields.find((entry) => entry.key === "DependsOn");
    const first = field?.lines.find((line) => line.trim().length > 0);
    if (first === undefined) return [];
    const prefix = first.split(/[（(]/)[0] ?? "";
    const ids: number[] = [];
    for (const token of prefix.split(/[,\s]+/)) {
      if (PlanTaskBlocksReader.ID_TOKEN.test(token)) ids.push(Number(token));
    }
    return [...new Set(ids)].sort((left, right) => left - right);
  }

  /** The body text of one `## Heading` section (the brief's `## Constraints` mirror)
   *  — the tree's section read, so a deeper `###`/`####` heading inside the section
   *  never truncates it. "" when absent. */
  section(content: string, heading: string): string {
    return MarkdownTree.parse(content).sectionText(heading);
  }
}
