// packages/cdd-engine/src-next/render/brief.ts
// T12 — BriefRenderer: the task-brief renderer. The brief materializes the
// dispatch's `### Task N:` sections from a plan: the task BLOCKS ride the plan
// read value (`PlanParsed#taskBlocks` — the same parse the graph and the dispatch
// reuse), the step surface carries the `— checkable:` clause (the dispatch
// contract's evidence gate), and the rendered brief appends the plan's
// `## Constraints` section (the complete plan mirror), and then the previous review
// round's `## Notes` section when it left any (P42 §2.1). The brief owns no parser: a
// second parse here would be a second fact source beside the plan read seam, so
// the three faces take the document text AND the parsed document from the caller.
// The checkable gate blocks step surfaces that carry a step with no checkable
// clause; a requested task with no matching heading blocks the whole render (the
// group-level out-of-bounds contract). The task sections are also exposed alone
// (`taskBody`) — the wave's reviewed-basis projection (P29 §2.2), so the child's
// bytes and the reopen fingerprint share one assembly.
//
// The raw line slices (a task block's `TaskBlock.range`, the `## Constraints`
// section) still read the TEXT: the brief is hashed (D30 · P29), and rebuilding a
// heading from `fields[].lines` would move the bytes of every already-reviewed
// wave.

import type { PlanParsed, TaskStep } from "../contract/doc.ts";
import { PlanTaskBlocksReader } from "../contract/task-blocks.ts";

/** One parsed task-block field of the brief. */
export interface BriefField {
  key: string;
  lines: readonly string[];
}

/** One parsed task block of the brief — the plan's block + its checkable verdict. */
export interface BriefTask {
  /** The task number. */
  id: number;
  /** The `### Task N: …` heading line verbatim. */
  heading: string;
  /** The block's keyed fields in document order. */
  fields: readonly BriefField[];
  /** The parsed `Steps` bullets. */
  steps: readonly TaskStep[];
  /** Whether every step carries a `— checkable:` clause. */
  checkableComplete: boolean;
  /** The step actions whose `— checkable:` clause is missing. */
  missingCheckables: readonly string[];
  /** The block's line range in the plan (the render's AST slice basis, P21 §7) —
   *  a `####` child heading never truncates the slice. */
  range: { readonly start: number; readonly end: number };
}

/** The extraction outcome — the requested briefs + the out-of-bounds task ids. */
export interface BriefExtraction {
  data: readonly BriefTask[];
  missing: readonly number[];
}

/**
 * The brief single renderer — pure data + content (no direct file system writes;
 * the caller/CLI writes the rendered content into the workspace). It carries no
 * parser collaborator and no constructor: the document text and the parsed document
 * arrive together from the caller's ONE plan read, so the brief can never judge a
 * different parse than the graph the same round dispatched on.
 */
export class BriefRenderer {
  /** The ONE task-block parse face — the `## Constraints` mirror reads its AST
   *  position (zero `^#` truncation residue). */
  readonly #reader = new PlanTaskBlocksReader();

  /** Extract the requested task blocks from a plan — the brief data. The blocks
   *  come from the caller's parsed document; `text` is carried for the three-face
   *  shape (the projections slice it) and is not read here. */
  extract(_text: string, doc: PlanParsed, tasks: readonly number[]): BriefExtraction {
    const byId = new Map(doc.taskBlocks.map((block) => [block.id, block]));
    const missing: number[] = [];
    const data: BriefTask[] = [];
    for (const id of new Set(tasks)) {
      const block = byId.get(id);
      if (block === undefined) {
        missing.push(id);
        continue;
      }
      const steps = block.steps;
      const missingCheckables = steps
        .filter((step) => step.checkable === null)
        .map((step) => step.action);
      data.push({
        id: block.id,
        heading: block.heading,
        fields: block.fields,
        steps,
        checkableComplete: missingCheckables.length === 0,
        missingCheckables,
        range: block.range,
      });
    }
    return { data, missing };
  }

  /** The task-only projection — the wave's reviewed-basis content face: the requested
   *  `### Task N:` sections and nothing else. `render` appends the plan's
   *  `## Constraints` on top of this projection for the child; the reviewed-brief hash
   *  (`Ledger#briefRevision` / `#briefDrifted`) covers this projection alone (P29 §2.2
   *  — a Constraints reword is dispatch input, never a brief drift). One assembly,
   *  two consumers: zero second slicing logic. */
  taskBody(text: string, doc: PlanParsed, tasks: readonly number[]): string {
    const { data, missing } = this.extract(text, doc, tasks);
    if (missing.length > 0) {
      throw new Error(
        `task${missing.length > 1 ? "s" : ""} ${missing.join(", ")} not found in the plan`,
      );
    }
    const lines = text.split("\n");
    return data.map((task) => this.#slice(lines, task.range)).join("\n\n");
  }

  /** Render the brief content — the task-only projection + the plan's `## Constraints`
   *  section (the complete plan mirror the child reads), and then, when this wave's last
   *  review round left notes, the notes section LAST (P42 §2.1): each note verbatim, no
   *  rewrite and no added action demand. `taskBody` never carries them — the
   *  reviewed-brief hash reads that projection alone, so a note can never look like a
   *  plan drift. Any requested task without a heading blocks the whole render
   *  (out-of-bounds). */
  render(
    text: string,
    doc: PlanParsed,
    tasks: readonly number[],
    notes: readonly string[] = [],
  ): string {
    const body = this.taskBody(text, doc, tasks);
    const constraints = this.#reader.section(text, "Constraints");
    const head = constraints === "" ? `${body}\n` : `${body}\n\n${constraints}\n`;
    return notes.length === 0 ? head : `${head}\n${this.#notesSection(notes)}\n`;
  }

  /** The previous round's notes, one line each, verbatim — the engine's `## Notes`
   *  heading is the whole of this renderer's own contribution. The engine's three note
   *  families never arrive here: the read-side projection dropped them before the
   *  renderer was called. */
  #notesSection(notes: readonly string[]): string {
    return ["## Notes", ...notes].join("\n");
  }

  /** The AST-range slice of one task block — the block's own lines verbatim, its
   *  `####` children included (the retired `^#` scan cut a block at its first child
   *  heading). */
  #slice(
    lines: readonly string[],
    range: { readonly start: number; readonly end: number },
  ): string {
    return lines
      .slice(range.start - 1, range.end)
      .join("\n")
      .replace(/\s+$/, "");
  }
}
