// packages/cdd-engine/src/surface/render/brief.ts
// The task brief — the wave dispatch's read input, and the projection the wave line binds.
//
// INVARIANT — one plan text plus one task list render ONE brief, and the task-only
// projection is the same assembly the landed bytes start from: a brief is byte-stable for
// the same plan and the same task group, so the wave's reviewed version and the child's file
// can never describe two different plans.
//
// Two products, one assembly:
//   · `taskBody` — the requested `### Task N:` sections alone (no `## Constraints`). This is
//     the projection the wave line records as its reviewed brief;
//   · `render` — the projection, then the plan's `## Constraints` section (the complete plan
//     mirror the child reads), then the previous review round's notes when it left any.
// The renderer writes NOTHING: landing the bytes in the workspace belongs to the dispatch
// face, so a preview and a real dispatch name the same file without this class owning a path.
//
// The name rule is one function — `<line word>-brief.md` — and it lives here beside the
// renderer so the preview's `reads:` row and the landing agree by construction.
//
// Module-level exports are the type, the declared constants and the class — zero bare
// functions.

import { MarkdownTree } from "../../docs/grammar/markdown-tree.ts";
import { TaskBlocks } from "../../docs/grammar/task-blocks.ts";
import type { TaskBlock } from "../../docs/grammar/types.ts";
import type { FrameFacts } from "../../run/advance/frame.ts";

/** The plan section the brief mirrors whole — the dispatch's read input, never a judgment. */
const CONSTRAINTS = "Constraints";

/** The notes section's heading — the ONE byte this renderer adds to the plan's own text. */
const NOTES_HEADING = "## Notes";

/** The brief's name suffix — the task group's line word plus this tail. */
const BRIEF_SUFFIX = "-brief.md";

/**
 * BriefRenderer — the brief's ONE renderer. Invariant: one plan text plus one task list
 * answer one projection and one brief (see the file's header).
 */
export class BriefRenderer {
  /** The skeleton-free parse the renderer needs: the caller's own plan text, parsed once by
   *  this class per call (a brief is rendered once per dispatch; a cached parse would let two
   *  dispatches read two plan states through one value). */
  static blocksOf(text: string): TaskBlocks {
    return TaskBlocks.parse(text, "plan");
  }

  /** The workspace-relative brief name of one frame — `<line word>-brief.md`. */
  name(frame: FrameFacts): string {
    return `${frame.key}${BRIEF_SUFFIX}`;
  }

  /** The task-only projection — the requested blocks' own lines, verbatim, `####` children
   *  included, in the caller's order, joined by the blank column the plan keeps between
   *  blocks. A requested task the plan does not declare blocks the whole render: half a
   *  brief is never dispatched. */
  taskBody(text: string, blocks: TaskBlocks, tasks: readonly number[]): string {
    const lines = text.split("\n");
    const selected = this.#selectedOf(blocks, tasks);
    return selected.map((block) => BriefRenderer.#slice(lines, block.range)).join("\n\n");
  }

  /** The brief's bytes: the projection, the plan's `## Constraints` section, then the
   *  previous review round's notes (each verbatim, no rewrite) when it left any. */
  render(
    text: string,
    blocks: TaskBlocks,
    tasks: readonly number[],
    notes: readonly string[] = [],
  ): string {
    const body = this.taskBody(text, blocks, tasks);
    const constraints = MarkdownTree.parse(text).sectionText(CONSTRAINTS);
    const head = constraints === "" ? `${body}\n` : `${body}\n\n${constraints}\n`;
    return notes.length === 0 ? head : `${head}\n${[NOTES_HEADING, ...notes].join("\n")}\n`;
  }

  /** The requested blocks in the CALLER's order, not the document's — a wave that asks for
   *  `[16, 15]` reads 16's section first, so the brief's order is an input, never a display
   *  convention the plan happens to impose. The missing-task refusal happens here, so both
   *  products refuse the same way. */
  #selectedOf(blocks: TaskBlocks, tasks: readonly number[]): readonly TaskBlock[] {
    const wanted = [...new Set(tasks)];
    const byId = new Map(blocks.blocks().map((block) => [block.id, block]));
    const missing = wanted.filter((id) => !byId.has(id)).sort((left, right) => left - right);
    if (missing.length > 0) {
      throw new Error(
        `task${missing.length > 1 ? "s" : ""} ${missing.join(", ")} not found in the plan`,
      );
    }
    const selected: TaskBlock[] = [];
    for (const id of wanted) {
      const block = byId.get(id);
      if (block !== undefined) selected.push(block);
    }
    return selected;
  }

  /** One block's own lines — the AST range slice, its trailing blank run trimmed. */
  static #slice(
    lines: readonly string[],
    range: { readonly start: number; readonly end: number },
  ): string {
    return lines
      .slice(range.start - 1, range.end)
      .join("\n")
      .replace(/\s+$/, "");
  }
}
