// packages/cdd-engine/src/surface/render/graph.ts
// The wave board — one tree's three sections, laid out exactly once.
//
// INVARIANT — the wave board is a pure projection of one tree value: its waves, the task ids
// it already closed, and the plan's coordinate. It reads no ledger, judges no refusal and
// holds no legend literal (every word it prints is a row of the board family), so the ONE
// caller that needs a wave board — the route face's `split` refusal detail — can render it
// twice and read the same bytes both times.
//
// The three sections are the board's declared titles in their own order: the graph title
// naming the plan, the wave board's one row per derived wave, and the graph scope's progress
// legend — every word read off the board family, none declared here.
//
// A task's marker is read off the tree's own two facts: a closed task is `done`, a task of
// the current wave (the first wave holding an open task) is `current`, everything else is
// `pending`. A closed task inside the current wave keeps `done` — the marker column reports
// the task, not the wave.
//
// Module-level exports are the type and the class — zero bare functions.

import type { Words } from "../words/words.ts";

/** One tree, as the wave board reads it: the plan's coordinate, the derived waves and the
 *  task ids already closed. */
export interface GraphTree {
  /** The plan document's coordinate — the title's one value. */
  readonly plan: string;
  /** The derived waves, in execution order. */
  readonly waves: readonly (readonly number[])[];
  /** The task ids already closed. */
  readonly done: ReadonlySet<number>;
}

/**
 * GraphView — the wave board's ONE renderer. Invariant: one tree renders one block of three
 * sections, and the mark vocabulary comes from the word table, so the graph scope and the
 * board scope differ by the one word the table declares.
 */
export class GraphView {
  readonly #words: Words;

  constructor(words: Words) {
    this.#words = words;
  }

  /** The tree's three sections, joined by the blank column the board keeps between them. */
  render(tree: GraphTree): string {
    const board = this.#words.boardWords();
    const rows = this.#rowsOf(tree);
    return [
      `${board.titles.graph} ${tree.plan}`,
      "",
      board.titles.waveBoard,
      ...rows,
      "",
      this.#words.legendTail("graph"),
    ].join("\n");
  }

  /** One row per derived wave, in order; the current wave is marked as such. Its
   *  annotation is the graph view's OWN row word — the legend's scope word names the two
   *  boards' difference and would silently change this cell if it were reused here. */
  #rowsOf(tree: GraphTree): readonly string[] {
    const current = tree.waves.findIndex((wave) => wave.some((id) => !tree.done.has(id)));
    return tree.waves.map((wave, index) => {
      const tasks = wave
        .map((id) => `T${id}${this.#marker(tree, id, index === current)}`)
        .join(" · ");
      const row = `  W${index + 1}  ${tasks}`;
      return index === current ? `${row}   ← ${this.#words.currentWaveAnnotation()}` : row;
    });
  }

  /** One task's marker — closed first (a done task inside the current wave stays done), then
   *  the current wave, then pending. */
  #marker(tree: GraphTree, task: number, current: boolean): string {
    const markers = this.#words.boardWords().progress.markers;
    if (tree.done.has(task)) return markers.done;
    return current ? markers.current : markers.pending;
  }
}
