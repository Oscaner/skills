// packages/cdd-engine/src-next/face/graph-view.ts
// T24 (v1.15 — the plan-graph read) — the plan-graph terminal display. `beautiful-
// mermaid`'s renderMermaidASCII renders a `flowchart LR` into box-drawing ASCII with
// the ELK layout (§3.8's third-party render). The engine EMITS the flowchart from the
// TaskGraph report (progress markers on the nodes — ✔ done · ▶ current-wave member)
// and appends the WAVE CHAIN as a clean one-line legend below the graph — the
// derived wave order stays explicit without tangling the DAG with subgraph bands.
// Two consumers share the report: the `cdd schema get plan-graph` read and the
// dispatch/review pre-flight.
//
// Module-level exports are the class — zero behavior-carrying bare functions.

import { renderMermaidASCII } from "beautiful-mermaid";
import type { TaskGraphReport } from "../session/graph.ts";

/** The plain-text legend — the progress marker vocabulary (appended under the graph). */
const LEGEND = "progress: ✔ done · ▶ current wave";

/** GraphView — the terminal box-drawing DAG display. One render from the shared
 *  TaskGraph report; the node markers + the wave-chain line are a data projection. */
export class GraphView {
  /** render(report, title) → the box-drawing DAG + the wave-chain line + the legend
   *  (the plan read and the pre-flight display call the same face). */
  render(report: TaskGraphReport, title: string): string {
    const done = new Set(report.done);
    const currentIndex = report.waves.findIndex((wave) => wave.some((id) => !done.has(id)));
    const current = new Set(report.waves[currentIndex] ?? []);
    const waveOf = new Map<number, number>();
    report.waves.forEach((wave, index) => {
      for (const id of wave) waveOf.set(id, index);
    });
    const lines: string[] = ["flowchart TB"];
    for (const [task, deps] of Object.entries(report.edges)) {
      const id = Number(task);
      const marker = current.has(id) ? " ▶" : done.has(id) ? " ✔" : "";
      // every node's box carries its WAVE index — the renderer's placement is its
      // own; the wave membership rides the node, never the row it lands in (the
      // label avoids brackets — they trip the mermaid node-bracket parser).
      lines.push(`  T${id}["T${id}${marker} · W${waveOf.get(id) ?? ""}"]`);
      for (const dep of deps) lines.push(`  T${dep} --> T${id}`);
    }
    const mermaid = lines.join("\n");
    // Clean Unicode box-drawing, TB (top-bottom) laid out — the plan DAG fans out
    // heavily (T2/T4/T6 multi-cast), and TB reads the long chains naturally while
    // the ASCII ladder routing stays legible; LR merges the fan-out glyphs at this
    // density.
    let ascii = renderMermaidASCII(mermaid, {
      useAscii: false,
      paddingX: 6,
      paddingY: 2,
      boxBorderPadding: 0,
      colorMode: "none",
    });
    if (ascii.length === 0) ascii = this.#fallback(report);
    return `${title}\n\n${ascii}\n\nwave chain:\n${this.#waveChain(report, currentIndex)}\n\n${LEGEND}\ncurrent: {${(currentIndex >= 0 ? report.waves[currentIndex] : []).join(", ")}} · pending: {${report.pending.join(", ")}}`;
  }

  /** The wave-chain line — the derived wave order with the done/current markers
   *  (`W0{1} ✔ → … → ▶ W11{16,22,24} → W12{25} → W13{17}`). */
  #waveChain(report: TaskGraphReport, currentIndex: number): string {
    return report.waves
      .map((wave, index) => {
        const done = wave.every((id) => report.done.includes(id));
        const marker = index === currentIndex ? " ▶" : done ? " ✔" : "";
        return `W${index}{${wave.join(",")}}${marker}`;
      })
      .join(" → ");
  }

  /** A failure of the renderer never blanks the read — a plain fallback line (only
   *  present facts land, the projection survives the display). */
  #fallback(report: TaskGraphReport): string {
    return report.waves.map((wave) => `{${wave.join(",")}}`).join(" → ");
  }
}
