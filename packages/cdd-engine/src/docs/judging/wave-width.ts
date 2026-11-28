// packages/cdd-engine/src/docs/judging/wave-width.ts
// The wave-width ceiling, and the read that judges a plan against it.
//
// The ceiling is ONE number: three tasks per wave. Three readers share it — the plan-scope
// rule, the dispatch face's two hard rejections and their wording — so changing it here
// changes all of them at once.
//
// The judgment is a READ of the graph's own wave decomposition. `TaskGraph#batches()` is
// the only decomposition in the tree: this file holds no second one, and adding one would
// mean the plan-scope rule and the dispatch could disagree about which tasks form a wave.
//
// Module-level exports are the constant and the class — zero behaviour-carrying bare
// functions.

import type { TaskGraph } from "./task-graph.ts";

/** The wave-width ceiling — the most tasks one wave may carry. */
export const MAX_TASKS_PER_WAVE = 3;

/** One over-wide wave: its 1-based position and the tasks it carries. */
export interface WideWave {
  /** The wave's 1-based position in the graph's own batch order. */
  readonly wave: number;
  /** The tasks in that wave, ascending (the batch's own order). */
  readonly tasks: readonly number[];
}

/**
 * WaveWidth — the ceiling's read face over one graph. Invariant: the answer is derived from
 * the graph's `batches()` and nothing else, so the rule and the dispatch read one
 * decomposition.
 */
export class WaveWidth {
  readonly #graph: TaskGraph;

  constructor(graph: TaskGraph) {
    this.#graph = graph;
  }

  /** Every wave wider than the ceiling, in batch order — empty when the plan fits. */
  violations(): readonly WideWave[] {
    const wide: WideWave[] = [];
    for (const [index, tasks] of this.#graph.batches().entries()) {
      if (tasks.length <= MAX_TASKS_PER_WAVE) continue;
      wide.push({ wave: index + 1, tasks: [...tasks] });
    }
    return wide;
  }

  /** Whether the plan fits the ceiling. */
  fits(): boolean {
    return this.violations().length === 0;
  }

  /** The one-line spelling of an over-wide wave — the plan-scope rule's and the dispatch
   *  refusal's shared wording. */
  static lineOf(wide: WideWave): string {
    return `wave ${wide.wave} carries ${wide.tasks.length} tasks (${wide.tasks.join(", ")}) — the ceiling is ${MAX_TASKS_PER_WAVE}`;
  }
}
