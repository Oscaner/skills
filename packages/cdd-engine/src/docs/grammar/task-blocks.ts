// packages/cdd-engine/src/docs/grammar/task-blocks.ts
// The task-block grammar: the `### Task N:` blocks of a plan and their `DependsOn`
// lines.
//
// Two shapes normalize into ONE record, because the repository's plans still carry
// both: the current shape declares its fields as `#### Key` headings inside the block,
// the legacy shape declares them as `- **Key**: …` bullets. A second parse per shape
// would duplicate the boundary logic, and the boundary is the hard part — a block ends
// at the next heading of rank 3 or shallower, never at its first `####` child.
//
// `DependsOn` is read as a single-line value: the ids before any parenthetical prose,
// comma- or space-separated, with `none` and an empty value meaning "no edges". Cycles
// are read out rather than rejected here — whether a cycle blocks a wave is the gate's
// judgment, not the grammar's.

import { MarkdownDocument } from "./markdown-document.ts";
import type { MarkdownTree } from "./markdown-tree.ts";
import type { MdNode, TaskBlock, TaskSection, TaskValueEntry } from "./types.ts";

/** The task-block structural constants — they live with the ONE block parse, so the
 *  grammar has exactly one home. */
// biome-ignore lint/complexity/noStaticOnlyClass: the declared constant surface of the block grammar — a class is the one place a zero-bare-function tree admits them.
export class TaskBlockGrammar {
  /** The reserved section keys, in the canonical document order. */
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
  static readonly HEADING = /^Task (\d+):(.*)$/;

  /** The legacy field marker — `- **Key**: <value>`. */
  static readonly LEGACY_FIELD = /^- \*\*(.+?)\*\*:(.*)$/;

  /** A dependency id token — the declared `DependsOn` value domain. */
  static readonly ID_TOKEN = /^\d+$/;

  /** The no-edge spellings — an empty value and the bare `none`. */
  static readonly NO_EDGE = "none";

  /** The prose tail separator of a `DependsOn` line (either parenthetical form). */
  static readonly PROSE_TAIL = /[（(]/;
}

/**
 * TaskBlocks — the plan's task-block read face. Invariant: one document's blocks are
 * parsed once, in document order, and every read answers the same records.
 */
export class TaskBlocks {
  readonly #blocks: readonly TaskBlock[];

  private constructor(blocks: readonly TaskBlock[]) {
    this.#blocks = blocks;
  }

  /** The reserved section keys — read off the grammar, never re-spelled here. */
  static get RESERVED(): readonly string[] {
    return TaskBlockGrammar.RESERVED;
  }

  /** Parse one tree's task blocks. */
  static of(tree: MarkdownTree): TaskBlocks {
    return new TaskBlocks(TaskBlocks.#parse(tree.document));
  }

  /** Parse one document's text directly — the convenience entry a reader with no tree
   *  yet uses; it builds the index it needs and nothing else. */
  static parse(content: string): TaskBlocks {
    return new TaskBlocks(TaskBlocks.#parse(MarkdownDocument.parse(content)));
  }

  /** The blocks, in document order. */
  blocks(): readonly TaskBlock[] {
    return this.#blocks;
  }

  /** The block carrying one task id, or null. */
  blockOf(id: number): TaskBlock | null {
    return this.#blocks.find((block) => block.id === id) ?? null;
  }

  /** One block's declared dependency ids, sorted and deduplicated. An absent section,
   *  an empty value and the bare `none` all answer the empty set; the parenthetical
   *  tail after `(` / `（` is prose, never a dependency. */
  dependsOnOf(block: TaskBlock): readonly number[] {
    const section = block.sections.find((entry) => entry.key === "DependsOn");
    if (section === undefined) return [];
    const first = section.lines.find((line) => line.trim().length > 0);
    if (first === undefined) return [];
    const prefix = first.split(TaskBlockGrammar.PROSE_TAIL)[0] ?? "";
    const ids: number[] = [];
    for (const token of prefix.split(/[,\s]+/)) {
      if (!TaskBlockGrammar.ID_TOKEN.test(token)) continue;
      ids.push(Number(token));
    }
    return [...new Set(ids)].sort((left, right) => left - right);
  }

  /** One task's declared dependency ids. */
  dependsOn(id: number): readonly number[] {
    const block = this.blockOf(id);
    return block === null ? [] : this.dependsOnOf(block);
  }

  /** Every dependency cycle, each as the ids it runs through, canonicalized so the
   *  smallest id comes first and one cycle is reported once. A dependency on an id the
   *  document does not declare is not part of any cycle read here — it is a dangling
   *  edge, which the graph judgment owns. */
  cycles(): readonly (readonly number[])[] {
    const graph = new Map<number, readonly number[]>();
    for (const block of this.#blocks) {
      graph.set(
        block.id,
        this.dependsOnOf(block).filter((id) => id !== block.id),
      );
    }
    const found = new Map<string, readonly number[]>();
    const state = new Map<number, "open" | "done">();
    const path: number[] = [];
    const visit = (id: number): void => {
      if (state.get(id) === "done") return;
      state.set(id, "open");
      path.push(id);
      for (const dependency of graph.get(id) ?? []) {
        if (!graph.has(dependency)) continue;
        if (state.get(dependency) === "open") {
          const cycle = TaskBlocks.#canonical(path.slice(path.indexOf(dependency)));
          found.set(cycle.join(","), cycle);
          continue;
        }
        visit(dependency);
      }
      path.pop();
      state.set(id, "done");
    };
    for (const id of [...graph.keys()].sort((left, right) => left - right)) {
      if (state.get(id) !== undefined) continue;
      visit(id);
    }
    return [...found.values()];
  }

  /** One cycle rotated so its smallest id leads — one spelling per cycle. */
  static #canonical(cycle: readonly number[]): readonly number[] {
    if (cycle.length === 0) return cycle;
    let pivot = 0;
    for (const [index, id] of cycle.entries()) {
      if (id < cycle[pivot]!) pivot = index;
    }
    return [...cycle.slice(pivot), ...cycle.slice(0, pivot)];
  }

  /** The ONE block parse over one index. */
  static #parse(document: MarkdownDocument): readonly TaskBlock[] {
    const nodes = document.topNodes();
    const blocks: TaskBlock[] = [];
    for (const [index, node] of nodes.entries()) {
      if (node.type !== "heading" || node.depth !== 3) continue;
      const match = TaskBlockGrammar.HEADING.exec(document.textOf(node).trim());
      if (match === null) continue;
      const start = node.position?.start?.line ?? 0;
      if (start === 0) continue;
      const boundary = TaskBlocks.#boundary(nodes, index, document.lineCount());
      const inner = nodes.slice(index + 1, boundary.index);
      const headingShape = inner.some((node) => node.type === "heading" && node.depth === 4);
      const sections = headingShape
        ? TaskBlocks.#headingSections(document, inner, boundary.line - 1)
        : TaskBlocks.#legacySections(document, start + 1, boundary.line - 1);
      blocks.push({
        id: Number(match[1]),
        heading: document.line(start),
        sections,
        range: { start, end: boundary.line - 1 },
        shape: headingShape ? "heading" : "legacy",
      });
    }
    return blocks;
  }

  /** The node index and line at which one block ends — the next top-level heading of
   *  rank 3 or shallower, or one past the document's last line. */
  static #boundary(
    nodes: readonly MdNode[],
    index: number,
    lineCount: number,
  ): { readonly index: number; readonly line: number } {
    for (let next = index + 1; next < nodes.length; next += 1) {
      const node = nodes[next];
      if (node?.type !== "heading" || (node.depth ?? 0) > 3) continue;
      return { index: next, line: node.position?.start?.line ?? lineCount + 1 };
    }
    return { index: nodes.length, line: lineCount + 1 };
  }

  /** The `#### Key` sections of a block — every depth-4 heading partitions it, and a
   *  heading with no body still registers (the author's empty value). */
  static #headingSections(
    document: MarkdownDocument,
    inner: readonly MdNode[],
    blockEnd: number,
  ): readonly TaskSection[] {
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
      const entries = TaskBlocks.#entries(document, line + 1, end);
      sections.push({
        key: document.textOf(node).trim(),
        start: line,
        end,
        lines: entries.map((entry) => entry.text),
        entries,
      });
    }
    return sections;
  }

  /** The legacy `- **Key**: value` sections of a compatibility-shape block. */
  static #legacySections(
    document: MarkdownDocument,
    from: number,
    to: number,
  ): readonly TaskSection[] {
    const sections: TaskSection[] = [];
    for (let line = from; line <= to; line += 1) {
      const match = TaskBlockGrammar.LEGACY_FIELD.exec(document.line(line));
      if (match === null) continue;
      let end = to;
      for (let next = line + 1; next <= to; next += 1) {
        if (TaskBlockGrammar.LEGACY_FIELD.test(document.line(next))) {
          end = next - 1;
          break;
        }
      }
      const rest = TaskBlocks.#entries(document, line + 1, end);
      const inline = (match[2] ?? "").trim();
      const entries: readonly TaskValueEntry[] =
        inline === "" ? rest : [{ text: inline, line }, ...rest];
      sections.push({
        key: (match[1] ?? "").trim(),
        start: line,
        end,
        lines: entries.map((entry) => entry.text),
        entries,
      });
    }
    return sections;
  }

  /** The trimmed, blank-dropping raw lines of one inclusive 1-based span, each carrying
   *  its document line number. */
  static #entries(document: MarkdownDocument, from: number, to: number): readonly TaskValueEntry[] {
    const out: TaskValueEntry[] = [];
    for (let line = from; line <= to; line += 1) {
      const text = document.line(line).trim();
      if (text !== "") out.push({ text, line });
    }
    return out;
  }
}
