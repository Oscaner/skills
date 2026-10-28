// packages/cdd-engine/src-next/contract/task-blocks.ts
// P21 §7 — the ONE parse face of a plan's task blocks. The block STRUCTURE is read
// through the markdown AST (`mdast-util-from-markdown`, one parse per document)
// instead of the retired line-marker grammar:
//
//   · the new shape carries the seven reserved sections as `#### Key` headings inside
//     a `### Task N:` block; any additional `####` section is an extension section
//     (body text only — it never participates in the required/domain judgment);
//   · the legacy bullet shape (`- **Key**: …`) stays readable as a compatibility
//     input: the normalization of the two node shapes into ONE `TaskBlock` is a
//     method of this reader, never a second declaration in the registry;
//   · the block's `range` (1-based line numbers) is the brief's slice basis — a
//     line-scan that stops at any `#` heading truncates a block at its first `####`
//     child, so a heading-shaped plan would render a brief with missing sections.
//
// Module-level exports are types / the class — zero behavior-carrying bare functions.

import { fromMarkdown } from "mdast-util-from-markdown";

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

/** One mdast node, structurally narrowed to the members this reader reads (the
 *  library's own `mdast` types stay out of the public surface). */
interface MdNode {
  readonly type?: string;
  readonly depth?: number;
  readonly value?: string;
  readonly children?: readonly MdNode[];
  readonly position?: {
    readonly start?: { readonly line?: number };
    readonly end?: { readonly line?: number };
  };
}

/** A section node inside one task block — its key, its raw-line span and the value
 *  lines read off that span. */
interface SectionNode {
  readonly key: string;
  readonly lines: readonly string[];
}

/**
 * PlanTaskBlocksReader — the plan's task-block parse face. One `parse` call reads a
 * whole plan document; the graph's `DependsOn`, the brief's slices and the skeleton
 * consumers all derive from the same `TaskBlock` records.
 */
export class PlanTaskBlocksReader {
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

  /** A dependency id token — the declared `DependsOn id` domain. */
  static readonly ID_TOKEN = /^[1-9]\d*$/;

  /** Parse a whole plan document into its `### Task N:` blocks. A duplicated reserved
   *  key inside one block is a loud error (the section identity is the parse face's
   *  own invariant). */
  parse(content: string): readonly TaskBlock[] {
    const lines = content.split("\n");
    const nodes = (fromMarkdown(content) as unknown as MdNode).children ?? [];
    const blocks: TaskBlock[] = [];
    for (const [index, node] of nodes.entries()) {
      if (node.type !== "heading" || node.depth !== 3) continue;
      const match = PlanTaskBlocksReader.TASK_HEADING.exec(this.#textOf(node).trim());
      if (match === null) continue;
      const start = node.position?.start?.line ?? 0;
      if (start === 0) continue;
      const boundary = this.#boundaryAfter(nodes, index, lines.length);
      const inner = nodes.slice(index + 1, boundary.index);
      const shape = inner.some((child) => child.type === "heading" && child.depth === 4)
        ? "heading"
        : "legacy";
      const end = boundary.line - 1;
      const sections =
        shape === "heading"
          ? this.#headingSections(inner, lines, end)
          : this.#legacySections(lines, start + 1, end);
      const block: TaskBlock = {
        id: Number(match[1]),
        heading: lines[start - 1] ?? "",
        fields: sections.map((section) => ({ key: section.key, lines: section.lines })),
        steps: this.#stepsOf(sections),
        range: { start, end },
        shape,
      };
      this.#assertNoDuplicateKeys(block);
      blocks.push(block);
    }
    return blocks;
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

  /** The body lines of one `## Heading` section (the brief's `## Constraints` mirror)
   *  — the AST range, so a deeper `###`/`####` heading inside the section never
   *  truncates it. The heading line itself is included. "" when absent. */
  section(content: string, heading: string): string {
    const lines = content.split("\n");
    const nodes = (fromMarkdown(content) as unknown as MdNode).children ?? [];
    const start = nodes.findIndex(
      (node) =>
        node.type === "heading" && node.depth === 2 && this.#textOf(node).trim() === heading,
    );
    if (start === -1) return "";
    const first = nodes[start]?.position?.start?.line ?? 1;
    return lines
      .slice(first - 1, this.#sectionBoundary(nodes, start, lines.length) - 1)
      .join("\n")
      .replace(/\s+$/, "");
  }

  /** The line at which a `##` section ends — the next rank-2-or-shallower heading,
   *  or a `### Task N:` block head (a task block never lives inside a section even
   *  though it ranks deeper). A deeper plain heading stays in the section body. */
  #sectionBoundary(nodes: readonly MdNode[], index: number, lineCount: number): number {
    for (let next = index + 1; next < nodes.length; next += 1) {
      const node = nodes[next];
      if (node?.type !== "heading") continue;
      const depth = node.depth ?? 0;
      const isTask =
        depth === 3 && PlanTaskBlocksReader.TASK_HEADING.test(this.#textOf(node).trim());
      if (depth <= 2 || isTask) return node.position?.start?.line ?? lineCount + 1;
    }
    return lineCount + 1;
  }

  /** The node index/line at which one block ends — the first following top-level
   *  heading of the given rank or shallower (default 3), or the document's last
   *  non-blank line. */
  #boundaryAfter(
    nodes: readonly MdNode[],
    index: number,
    lineCount: number,
    level = 3,
  ): { readonly index: number; readonly line: number } {
    for (let next = index + 1; next < nodes.length; next += 1) {
      const node = nodes[next];
      if (node?.type !== "heading" || (node.depth ?? 0) > level) continue;
      return { index: next, line: node.position?.start?.line ?? lineCount };
    }
    return { index: nodes.length, line: lineCount + 1 };
  }

  /** The heading sections of a new-shape block — every depth-4 heading partitions the
   *  block; a heading with no body still registers (the empty value is the author's
   *  fact, judged by the presence rule). */
  #headingSections(
    inner: readonly MdNode[],
    lines: readonly string[],
    blockEnd: number,
  ): readonly SectionNode[] {
    const sections: SectionNode[] = [];
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
      sections.push({
        key: this.#textOf(node).trim(),
        lines: this.#valueLines(lines, line + 1, end),
      });
    }
    return sections;
  }

  /** The legacy sections of a compatibility-shape block — the `- **Key**:` markers
   *  and their continuation runs (the retired grammar's exact reading: the marker
   *  remainder plus every non-empty line until the next marker). */
  #legacySections(lines: readonly string[], from: number, to: number): readonly SectionNode[] {
    const sections: SectionNode[] = [];
    for (let line = from; line <= to; line += 1) {
      const match = PlanTaskBlocksReader.LEGACY_FIELD.exec(lines[line - 1] ?? "");
      if (match === null) continue;
      let end = to;
      for (let next = line + 1; next <= to; next += 1) {
        if (PlanTaskBlocksReader.LEGACY_FIELD.test(lines[next - 1] ?? "")) {
          end = next - 1;
          break;
        }
      }
      const rem = (match[2] ?? "").trim();
      const rest = this.#valueLines(lines, line + 1, end);
      sections.push({ key: (match[1] ?? "").trim(), lines: rem === "" ? rest : [rem, ...rest] });
    }
    return sections;
  }

  /** The trimmed, blank-dropping raw lines of one inclusive 1-based span. */
  #valueLines(lines: readonly string[], from: number, to: number): readonly string[] {
    const out: string[] = [];
    for (let line = from; line <= to; line += 1) {
      const text = (lines[line - 1] ?? "").trim();
      if (text !== "") out.push(text);
    }
    return out;
  }

  /** The parsed steps of a block — the `Steps` field's bullet lines. */
  #stepsOf(sections: readonly SectionNode[]): readonly TaskStep[] {
    const steps = sections.find((section) => section.key === "Steps");
    if (steps === undefined) return [];
    const out: TaskStep[] = [];
    for (const line of steps.lines) {
      const match = PlanTaskBlocksReader.STEP_LINE.exec(line);
      if (match === null) continue;
      const text = (match[1] ?? "").trim();
      const marker = text.indexOf(PlanTaskBlocksReader.CHECKABLE);
      if (marker === -1) {
        out.push({ action: text, checkable: null });
        continue;
      }
      out.push({
        action: text.slice(0, marker).trim(),
        checkable: text.slice(marker + PlanTaskBlocksReader.CHECKABLE.length).trim(),
      });
    }
    return out;
  }

  /** Reject a duplicated reserved key inside one block (the section identity is the
   *  parse face's own invariant, loud at parse time). */
  #assertNoDuplicateKeys(block: TaskBlock): void {
    const seen = new Set<string>();
    for (const field of block.fields) {
      if (!PlanTaskBlocksReader.RESERVED.includes(field.key)) continue;
      if (seen.has(field.key)) {
        throw new Error(
          `task ${block.id} carries the reserved section "#### ${field.key}" more than once`,
        );
      }
      seen.add(field.key);
    }
  }

  /** The plain text of one mdast node (the heading text / key surface). */
  #textOf(node: MdNode | undefined): string {
    if (node === undefined) return "";
    if (typeof node.value === "string") return node.value;
    return (node.children ?? []).map((child) => this.#textOf(child)).join("");
  }
}
