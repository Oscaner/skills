// packages/cdd-engine/src-next/face/graph-view.ts
// T24 (v1.18 — the plan-graph read) — the plan-graph wave-board display. The engine
// OWNS the layout: the derived waves (TaskGraph.batches) ARE the display's rows —
// one wave band per row, the band's tasks inline, the incoming source bands noted.
// Deterministic, always in wave order, zero third-party layout (the earlier
// beautiful-mermaid approach left the node placement + some labels to the renderer,
// which neither honored the wave order nor survived the full plan scale — a
// regex-patch papered over it; that surface is retired as tech debt).
//
// Two consumers share the report: the `cdd schema get plan-graph` read and the
// dispatch/review pre-flight.
//
// Module-level exports are the class — zero behavior-carrying bare functions.

import type { TaskGraphReport } from "../session/graph.ts";

/** GraphView — the wave-board display: one deterministic row per derived wave, the
 *  band's tasks inline with progress markers, the incoming source bands noted.
 *  v1.20 — the in-wave marker mix: the done set rides `closedWaves()` (the report's
 *  done projection, never "any ledger row"), and a current-wave task that is already
 *  done shows ✔, never a swallowed whole-row ▶. */
export class GraphView {
  /** render(report, title) → the wave-board + the legend (the plan read and the
   *  pre-flight display call the same face). */
  render(report: TaskGraphReport, title: string): string {
    const done = new Set(report.done);
    const currentIndex = report.waves.findIndex((wave) => wave.some((id) => !done.has(id)));
    const markers = new Map<number, string>();
    for (const [index, wave] of report.waves.entries()) {
      for (const id of wave) {
        // The per-task marker, done first: a completed task shows ✔ even inside the
        // current wave (the mix), a not-done current-wave task shows ▶, the rest ○.
        markers.set(id, done.has(id) ? "✔" : index === currentIndex ? "▶" : "○");
      }
    }
    const rows = report.waves
      .map((wave, index) => {
        const tasks = wave.map((id) => `T${id}${markers.get(id) ?? "○"}`).join(" · ");
        const line = `  W${String(index).padStart(2, "0")}  ${tasks}`;
        return index === currentIndex ? `${line}   ← in-flight` : line;
      })
      .join("\n");
    return `${title}\n\nwave board:\n${rows}\n\n${LEGEND}`;
  }
}

/** The plain-text legend — the progress marker vocabulary (appended under the board). */
const LEGEND = "progress: ✔ done · ▶ current wave · ○ pending";
