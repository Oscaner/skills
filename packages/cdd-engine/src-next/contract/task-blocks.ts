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

/** The VERB face's vocabulary — what a `Files` row's label says, five values with the
 *  `other` bucket catching every out-of-vocabulary spelling (never a guess at what the
 *  spelling meant). */
export type FileVerb = "create" | "modify" | "test" | "delete" | "other";

/** The CLAIM face's answer — whether a row's path is claimed by the line that names it,
 *  and with which spelling. Deliberately a SECOND fact, wider than "created or modified":
 *  the claim face covers the whole verb vocabulary (spec §3.1 ①), so `Test:` and
 *  `Delete:` claim their path exactly as `Create:` and `Modify:` do, and the `other`
 *  bucket's spellings claim only through the two closed label sets below. */
export type FileClaim = "create" | "modify" | "test" | "delete" | "none";

/** One `Files` row's declaration — the (verb, claim, path) triple one inline segment
 *  names. `verb` and `claim` are inherited by a segment that carries no label of its own
 *  (an inline continuation of the previous segment). */
export interface FileDeclaration {
  /** The path token as written (the shape filter is the judgment's, not the reader's). */
  readonly path: string;
  /** The verb face's reading of the row's label. */
  readonly verb: FileVerb;
  /** The claim face's reading of the same label. */
  readonly claim: FileClaim;
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

  /** The placeholder spellings a `Files` value line may carry INSTEAD of a path — the
   *  wave's "this task changes no file" declaration: a blank value, the bare `none`
   *  and the parenthetical `(none)`. Matched case-insensitively on the trimmed,
   *  bullet- and label-stripped remainder, and token by token for a quoted one. */
  static readonly FILE_PLACEHOLDERS: ReadonlySet<string> = new Set(["", "none", "(none)"]);

  /** The four vocabulary spellings of the verb face — everything else is `other`. */
  static readonly FILE_VERBS: ReadonlySet<string> = new Set(["create", "modify", "test", "delete"]);

  /** The claim face's CREATE label set — the `other` spellings that claim a creation.
   *  A closed set, not a reading of what the word means: a new spelling claims nothing
   *  until it is added here. */
  static readonly CREATE_LABELS: ReadonlySet<string> = new Set(["add", "新建"]);

  /** The claim face's MODIFY label set — the `other` spellings that claim a change. */
  static readonly MODIFY_LABELS: ReadonlySet<string> = new Set(["修改", "modified"]);

  /** The inline segment separators of one `Files` value line — each segment carries its
   *  own label, and a label-less segment inherits the previous one's reading. */
  static readonly FILE_SEPARATORS = /[;；、·]/;

  /** The legacy cross-form's field wrapper — `- **Files**: <value>` — stripped so the
   *  value face sees the same text a `#### Files` heading's line carries. */
  static readonly FILE_FIELD_MARKER = /^\*\*[^*]+\*\*\s*[:：]\s*/;

  /** The optional line label a `Files` segment may carry, COLON form — `Create:` ·
   *  `Modify (diagram evidence):` · `修改：` — colon included, so it is stripped and the
   *  value's own token remains. A label carries no dot and no slash: a path-shaped token
   *  before a colon (`cli.ts:41`) is a coordinate, never a verb. Both colons are admitted
   *  because the corpus spells the modify verb either way. */
  static readonly FILE_ROW_LABEL = /^([^:：`/.]{1,40}?)\s*[:：]\s*/;

  /** The leading label in its BARE-word form (`- Create \`x\`` · `- Modified \`y\`` ·
   *  `· 测试 \`z\``) — the first word, taken whenever it is shaped like a label rather
   *  than like a value: no colon, no quote, no path separator, no dot, and followed by
   *  whitespace. A quoted or path-shaped opening token (`\`a.ts\`（…）` · `a.ts …`) is
   *  the segment's own value and never a label. */
  static readonly FILE_WORD = /^([^:：`/.\s]{1,40})\s+/;

  /** The parenthetical span of a segment — a cited example beside the row's own path,
   *  never a second declaration. Paired with a quoted span in ONE alternation so a
   *  parenthetical is dropped WHOLE (a quoted path inside it included) while a quoted
   *  span outside one survives. */
  static readonly FILE_EXAMPLE = /`([^`]+)`|[（(][^）)]*[）)]/g;

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

  /** One `Files` row's declarations — the (verb, claim, path) triple of every path the
   *  section names, in document and inline order. The line's inline segments (`;` · `；`
   *  · `、` · `·`) are split FIRST, so each segment carries the verb its own label states
   *  and a label-less segment inherits the previous one's reading; a `Test:` segment
   *  therefore never re-labels the paths it follows. */
  fileDeclarationsOf(block: TaskBlock): readonly FileDeclaration[] {
    const field = block.fields.find((entry) => entry.key === "Files");
    if (field === undefined) return [];
    const declarations: FileDeclaration[] = [];
    for (const line of field.lines) {
      for (const declaration of PlanTaskBlocksReader.#declarationsOfLine(line)) {
        declarations.push(declaration);
      }
    }
    return declarations;
  }

  /** The path tokens one block's `Files` declaration names — the read face behind the
   *  implement criterion's verification-wave cell (P30 §2.4) and the `single-create`
   *  judgment's input. An empty result is a REAL claim ("this task changes no file"), so
   *  the read fails SAFE: an absent section, a blank value, a bare bullet and the
   *  `(none)` placeholder declare zero paths, while text this reader does not recognize
   *  stays a token — never "no paths". The separators split the unquoted remainder too,
   *  so `Create: a.ts、b.ts、c.ts` names three paths rather than one synthesized one. */
  filePathsOf(block: TaskBlock): readonly string[] {
    return this.fileDeclarationsOf(block).map((declaration) => declaration.path);
  }

  /** The verb face's reading of one label — the five-value vocabulary over the label's
   *  FIRST word, lowercased, with one trailing ASCII colon peeled (the claim face peels
   *  the full-width one too, which is why `- 修改：` reads `other` here and claims there). */
  static verbOf(label: string): FileVerb {
    const word = PlanTaskBlocksReader.#labelWordOf(label);
    return PlanTaskBlocksReader.FILE_VERBS.has(word) ? (word as FileVerb) : "other";
  }

  /** The claim face's reading of one label — the four vocabulary verbs claim by their own
   *  spelling, and the `other` bucket claims only through the two closed label sets.
   *  Everything else (an exempt label, a check / rename label, a prose label, a
   *  parenthetical span) falls to the same `none` default. */
  static claimOf(label: string): FileClaim {
    const word = PlanTaskBlocksReader.#labelWordOf(label);
    if (PlanTaskBlocksReader.FILE_VERBS.has(word)) return word as FileClaim;
    if (PlanTaskBlocksReader.CREATE_LABELS.has(word)) return "create";
    if (PlanTaskBlocksReader.MODIFY_LABELS.has(word)) return "modify";
    return "none";
  }

  /** The label's comparison word — its first space-separated word, lowercased, with one
   *  trailing colon (`:` or `：`) peeled. */
  static #labelWordOf(label: string): string {
    return (label.trim().split(/\s+/)[0] ?? "").toLowerCase().replace(/[:：]$/, "");
  }

  /** One segment's label in either form — the colon form first (`Create:` · `修改：` ·
   *  `Not in this task:`), then the opening bare word. The bare form is the segment's
   *  first word whenever it is shaped like a label (no colon, no quote, no path
   *  separator and no dot, followed by whitespace): an out-of-vocabulary word is the
   *  segment's label too, read as `other` on the verb face and off both closed sets on
   *  the claim face — so a prose lead-in never inherits the previous segment's verb and
   *  claim. Absent only when the segment opens with its own value (a quoted or
   *  path-shaped token). */
  static #labelOf(segment: string): { readonly label: string; readonly rest: string } | null {
    const colon = PlanTaskBlocksReader.FILE_ROW_LABEL.exec(segment);
    if (colon !== null) return { label: colon[1] ?? "", rest: segment.slice(colon[0].length) };
    const bare = PlanTaskBlocksReader.FILE_WORD.exec(segment);
    if (bare === null) return null;
    return { label: bare[1] ?? "", rest: segment.slice(bare[0].length) };
  }

  /** One `Files` value line's declarations — the bullet and the legacy field wrapper
   *  stripped, the inline separators split, and each segment read on both faces. */
  static #declarationsOfLine(line: string): readonly FileDeclaration[] {
    const body = line
      .replace(/^[-*+](?:\s+|$)/, "")
      .replace(PlanTaskBlocksReader.FILE_FIELD_MARKER, "")
      .trim();
    if (PlanTaskBlocksReader.FILE_PLACEHOLDERS.has(body.toLowerCase())) return [];
    const declarations: FileDeclaration[] = [];
    let verb: FileVerb = "other";
    let claim: FileClaim = "none";
    for (const raw of body.split(PlanTaskBlocksReader.FILE_SEPARATORS)) {
      const segment = raw.trim();
      if (segment.length === 0) continue;
      const label = PlanTaskBlocksReader.#labelOf(segment);
      let value = segment;
      if (label !== null) {
        verb = PlanTaskBlocksReader.verbOf(label.label);
        claim = PlanTaskBlocksReader.claimOf(label.label);
        value = label.rest;
      }
      for (const path of PlanTaskBlocksReader.#fileTokensOf(value)) {
        declarations.push({ path, verb, claim });
      }
    }
    return declarations;
  }

  /** One segment's path tokens — the parenthetical example is dropped whole (a quoted
   *  path inside it included), the quoted spans are the declaration when the segment
   *  quotes its paths, and an unquoted value (already split at the separators) is one
   *  token. A placeholder declares none. */
  static #fileTokensOf(value: string): readonly string[] {
    const remainder = value
      .replace(PlanTaskBlocksReader.FILE_EXAMPLE, (match: string, span: string | undefined) =>
        span === undefined ? " " : match,
      )
      .trim();
    if (PlanTaskBlocksReader.FILE_PLACEHOLDERS.has(remainder.toLowerCase())) return [];
    const spans = [...remainder.matchAll(/`([^`]+)`/g)]
      .map((match) => (match[1] ?? "").trim())
      .filter((token) => token.length > 0);
    // A segment that quotes its paths declares exactly those; a quoted placeholder
    // (`` `(none)` ``) declares none of them.
    if (spans.length === 0) return [remainder];
    return spans.filter(
      (token) => !PlanTaskBlocksReader.FILE_PLACEHOLDERS.has(token.toLowerCase()),
    );
  }
}
