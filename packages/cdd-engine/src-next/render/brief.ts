// packages/cdd-engine/src-next/render/brief.ts
// T12 — BriefRenderer: the task-brief renderer. The brief materializes the
// dispatch's `### Task N:` sections from a plan: extraction rides the contract
// parse face (doc.ts PlanDocType.parse — the same task-block parse instance the
// graph and the dispatch reuse), the step surface carries the `— checkable:`
// clause (the dispatch contract's evidence gate), and the rendered brief appends
// the plan's `## Constraints` section (the complete plan mirror). The checkable
// gate blocks step surfaces that carry a step
// with no checkable clause; a requested task with no matching heading blocks the
// whole render (the group-level out-of-bounds contract).

import type { TaskStep } from "../contract/doc.ts";
import { PlanDocType } from "../contract/doc.ts";
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
 * the caller/CLI writes the rendered content into the workspace).
 */
export class BriefRenderer {
  readonly #parser: PlanDocType;
  /** The ONE task-block parse face — the block ranges and the `## Constraints`
   *  mirror both read its AST positions (zero `^#` truncation residue). */
  readonly #reader = new PlanTaskBlocksReader();

  constructor(parser = new PlanDocType("plan")) {
    this.#parser = parser;
  }

  /** The task-heading slices of the plan parse face (the render's parse-face consumption). */
  taskHeadingPattern(): RegExp | undefined {
    return this.#parser.slices.slices.find((slice) => slice.anchor === "### Task N:")?.valuePattern;
  }

  /** Extract the requested task blocks from a plan's content — the brief data. */
  extract(planContent: string, tasks: readonly number[]): BriefExtraction {
    const parsed = this.#parser.parse(planContent.split("\n"));
    const byId = new Map(parsed.taskBlocks.map((block) => [block.id, block]));
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

  /** Render the brief content — the requested task sections + the plan's
   *  `## Constraints` section (the complete plan mirror). Any requested task without
   *  a heading blocks the whole render (out-of-bounds). */
  render(planContent: string, tasks: readonly number[]): string {
    const { data, missing } = this.extract(planContent, tasks);
    if (missing.length > 0) {
      throw new Error(
        `task${missing.length > 1 ? "s" : ""} ${missing.join(", ")} not found in the plan`,
      );
    }
    const lines = planContent.split("\n");
    const sections = data.map((task) => this.#slice(lines, task.range));
    const constraints = this.#reader.section(planContent, "Constraints");
    const body =
      constraints === "" ? sections.join("\n\n") : `${sections.join("\n\n")}\n\n${constraints}`;
    return `${body}\n`;
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
