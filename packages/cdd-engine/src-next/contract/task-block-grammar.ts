// packages/cdd-engine/src-next/contract/task-block-grammar.ts
// P21 §7 — the task-block grammar: the structural constants and the ONE block parse
// over the document index. The `### Task N:` heading shape and the legacy
// `- **Key**:` bullet shape normalize into the same `TaskBlock` record, so the
// block grammar has exactly one home; `PlanTaskBlocksReader` (task-blocks.ts) is
// the facade every consumer reads through.
//
// The parse is split out of the tree facade (markdown-tree.ts) so the block
// grammar, the document index and the selector engine each own one concern.

import { TASK_ID_VALUE_PATTERN } from "./declare.ts";
import type { MarkdownDocument } from "./markdown-document.ts";
import type { Candidate, MdNode, TaskSection, TaskValueEntry } from "./markdown-tree-types.ts";
import type { TaskBlock, TaskStep } from "./task-blocks.ts";

/**
 * TaskBlockGrammar — the task-block structural constants. They live with the ONE
 * block parse, so the grammar has exactly one home.
 */
// biome-ignore lint/complexity/noStaticOnlyClass: the plan-mandated static data face — the zero-bare-function discipline admits no standalone constant functions.
export class TaskBlockGrammar {
  /** The seven reserved section keys, in the canonical document order. */
  static readonly RESERVED: readonly string[] = [
    "Objective",
    "Files",
    "Consumes",
    "Produces",
    "Steps",
    "Acceptance",
    "DependsOn",
  ];

  /** The task-block heading — `### Task N: <title>` (the title stays optional). */
  static readonly TASK_HEADING = /^Task (\d+):(.*)$/;

  /** The legacy field marker — `- **Key**: <value>`. */
  static readonly LEGACY_FIELD = /^- \*\*(.+?)\*\*:(.*)$/;

  /** The step bullet — a list item's text line. */
  static readonly STEP_LINE = /^[-*]\s+(.*)$/;

  /** The `— checkable:` clause separator. */
  static readonly CHECKABLE = "— checkable:";

  /** A dependency id token — the declared `DependsOn id` value domain (the SAME
   *  source string the registry element carries). */
  static readonly ID_TOKEN = new RegExp(TASK_ID_VALUE_PATTERN);
}

/** The block parse result — the blocks plus the field spans of each block. */
interface TaskBlockParse {
  readonly blocks: readonly TaskBlock[];
  readonly sections: readonly (readonly TaskSection[])[];
}

/**
 * TaskBlocksParser — the ONE `### Task N:` block parse over the document index.
 * The parse is lazy (most documents carry no task block) and cached; the field
 * spans ride beside the blocks so a child walk can scope itself to one field.
 *
 * Rule zero (over the 200-line class limit): the block parse stays one class because
 * the two node shapes normalize into one record and share the section-span
 * machinery — splitting by shape would duplicate the boundary logic.
 */
export class TaskBlocksParser {
  readonly #document: MarkdownDocument;
  #parsed: TaskBlockParse | null = null;

  constructor(document: MarkdownDocument) {
    this.#document = document;
  }

  /** The `### Task N:` blocks of the document, in document order. */
  tasks(): readonly TaskBlock[] {
    return this.#parse().blocks;
  }

  /** The field spans of one block (parallel to the block's `fields`). */
  sectionsOf(index: number): readonly TaskSection[] {
    return this.#parse().sections[index] ?? [];
  }

  /** The task-field candidates — the block's `#### Key` heading line plus its value
   *  lines (the legacy bullet shape normalizes into the same fields, so one
   *  declaration locates both). */
  fieldCandidates(): readonly Candidate[] {
    const out: Candidate[] = [];
    for (const [index, block] of this.tasks().entries()) {
      const spans = this.sectionsOf(index);
      for (const [fieldIndex, field] of block.fields.entries()) {
        const span = spans[fieldIndex];
        const start = span?.start ?? block.range.start;
        const end = span?.end ?? block.range.end;
        const anchor = `#### ${field.key}`;
        out.push({
          text: anchor,
          bare: anchor,
          lines: field.lines,
          line: start,
          from: start,
          to: end,
        });
        field.lines.forEach((line, lineIndex) => {
          out.push({
            text: line,
            bare: this.#document.bareOf(span?.entries[lineIndex]?.line ?? start),
            lines: [line],
            line: span?.entries[lineIndex]?.line ?? start,
            from: start,
            to: end,
          });
        });
      }
    }
    return out;
  }

  /** The task-step candidates — one per raw step line of a block's `Steps` field
   *  (the line the step shapes judge, never a reconstruction). The bare view is the
   *  document's own inline-code span map, the SAME boundary every prose node reads. */
  stepCandidates(): readonly Candidate[] {
    const out: Candidate[] = [];
    for (const [index, block] of this.tasks().entries()) {
      const steps = this.sectionsOf(index).find((span) => span.key === "Steps");
      if (steps === undefined) continue;
      for (const entry of steps.entries) {
        if (!TaskBlockGrammar.STEP_LINE.test(entry.text)) continue;
        out.push({
          text: entry.text,
          bare: this.#document.bareOf(entry.line),
          lines: [entry.text],
          line: entry.line,
          from: block.range.start,
          to: block.range.end,
        });
      }
    }
    return out;
  }

  /** The block parse result (lazy; one parse per document). */
  #parse(): TaskBlockParse {
    if (this.#parsed === null) this.#parsed = this.#parseTasks();
    return this.#parsed;
  }

  /** Parse the `### Task N:` blocks from the mdast top-level headings. */
  #parseTasks(): TaskBlockParse {
    const nodes = this.#document.topNodes();
    const blocks: TaskBlock[] = [];
    const allSections: (readonly TaskSection[])[] = [];
    for (const [index, node] of nodes.entries()) {
      if (node.type !== "heading" || node.depth !== 3) continue;
      const match = TaskBlockGrammar.TASK_HEADING.exec(this.#document.textOf(node).trim());
      if (match === null) continue;
      const start = node.position?.start?.line ?? 0;
      if (start === 0) continue;
      const boundary = this.#blockBoundary(nodes, index);
      const inner = nodes.slice(index + 1, boundary.index);
      const shape = inner.some(
        (child) =>
          child.type === "heading" &&
          child.depth === 4 &&
          TaskBlockGrammar.RESERVED.includes(this.#document.textOf(child).trim()),
      )
        ? "heading"
        : "legacy";
      const end = boundary.line - 1;
      const sections =
        shape === "heading"
          ? this.#headingSections(inner, end)
          : this.#legacySections(inner, start + 1, end);
      const block: TaskBlock = {
        id: Number(match[1]),
        heading: this.#document.line(start),
        fields: sections.map((section) => ({ key: section.key, lines: section.lines })),
        steps: this.#stepsOf(sections),
        range: { start, end },
        shape,
      };
      this.#assertNoDuplicateKeys(block);
      blocks.push(block);
      allSections.push(sections);
    }
    return { blocks, sections: allSections };
  }

  /** The node index/line at which one block ends — the first following top-level
   *  heading of rank 3 or shallower, or the document's last non-blank line. */
  #blockBoundary(
    nodes: readonly MdNode[],
    index: number,
  ): { readonly index: number; readonly line: number } {
    for (let next = index + 1; next < nodes.length; next += 1) {
      const node = nodes[next];
      if (node?.type !== "heading" || (node.depth ?? 0) > 3) continue;
      return { index: next, line: node.position?.start?.line ?? this.#document.lineCount() };
    }
    return { index: nodes.length, line: this.#document.lineCount() + 1 };
  }

  /** The heading sections of a new-shape block — every depth-4 heading partitions
   *  the block; a heading with no body still registers (the author's empty value). */
  #headingSections(inner: readonly MdNode[], blockEnd: number): readonly TaskSection[] {
    const sections: TaskSection[] = [];
    for (const [index, node] of inner.entries()) {
      if (node?.type !== "heading" || node.depth !== 4) continue;
      const line = node.position?.start?.line;
      if (line === undefined) continue;
      let end = blockEnd;
      for (const next of inner.slice(index + 1)) {
        const nextLine = next?.position?.start?.line;
        if (next?.type === "heading" && nextLine !== undefined) {
          end = nextLine - 1;
          break;
        }
      }
      const entries = this.#valueEntries(line + 1, end);
      sections.push({
        key: this.#document.textOf(node).trim(),
        start: line,
        end,
        lines: entries.map((entry) => entry.text),
        entries,
      });
    }
    return sections;
  }

  /** The legacy sections of a compatibility-shape block — the `- **Key**:` markers
   *  and their continuation runs. A `####` extension section inside the block is a
   *  field of its own and never leaks into the preceding bullet's run. */
  #legacySections(inner: readonly MdNode[], from: number, to: number): readonly TaskSection[] {
    const spans = this.#headingSections(inner, to);
    const inSpan = (line: number): boolean =>
      spans.some((span) => line >= span.start && line <= span.end);
    const sections: TaskSection[] = [];
    for (let line = from; line <= to; line += 1) {
      if (inSpan(line)) continue;
      const match = TaskBlockGrammar.LEGACY_FIELD.exec(this.#document.line(line));
      if (match === null) continue;
      let end = to;
      for (let next = line + 1; next <= to; next += 1) {
        if (inSpan(next) || TaskBlockGrammar.LEGACY_FIELD.test(this.#document.line(next))) {
          end = next - 1;
          break;
        }
      }
      const rem = (match[2] ?? "").trim();
      const rest = this.#valueEntries(line + 1, end);
      const entries: readonly TaskValueEntry[] = rem === "" ? rest : [{ text: rem, line }, ...rest];
      sections.push({
        key: (match[1] ?? "").trim(),
        start: line,
        end,
        lines: entries.map((entry) => entry.text),
        entries,
      });
    }
    return [...sections, ...spans];
  }

  /** The trimmed, blank-dropping raw lines of one inclusive 1-based span, each
   *  carrying its document line number. */
  #valueEntries(from: number, to: number): readonly TaskValueEntry[] {
    const out: TaskValueEntry[] = [];
    for (let line = from; line <= to; line += 1) {
      const text = this.#document.line(line).trim();
      if (text !== "") out.push({ text, line });
    }
    return out;
  }

  /** The parsed steps of a block — the `Steps` field's bullet lines. */
  #stepsOf(sections: readonly TaskSection[]): readonly TaskStep[] {
    const steps = sections.find((section) => section.key === "Steps");
    if (steps === undefined) return [];
    const out: TaskStep[] = [];
    for (const line of steps.lines) {
      const match = TaskBlockGrammar.STEP_LINE.exec(line);
      if (match === null) continue;
      const text = (match[1] ?? "").trim();
      const marker = text.indexOf(TaskBlockGrammar.CHECKABLE);
      if (marker === -1) {
        out.push({ action: text, checkable: null });
        continue;
      }
      out.push({
        action: text.slice(0, marker).trim(),
        checkable: text.slice(marker + TaskBlockGrammar.CHECKABLE.length).trim(),
      });
    }
    return out;
  }

  /** Reject a duplicated reserved key inside one block (the section identity is the
   *  parse face's own invariant, loud at parse time). */
  #assertNoDuplicateKeys(block: TaskBlock): void {
    const seen = new Set<string>();
    for (const field of block.fields) {
      if (!TaskBlockGrammar.RESERVED.includes(field.key)) continue;
      if (seen.has(field.key)) {
        throw new Error(
          `task ${block.id} carries the reserved section "#### ${field.key}" more than once`,
        );
      }
      seen.add(field.key);
    }
  }
}
