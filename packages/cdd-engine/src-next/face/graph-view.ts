// packages/cdd-engine/src-next/face/graph-view.ts
// T24 (v1.15) — the plan-graph terminal display. `renderMermaidASCII` from
// `beautiful-mermaid` renders a `flowchart LR` into box-drawing ASCII (the ELK layout
// engine does the real layered placement — §3.8's third-party render decision):
// the engine EMITS the flowchart string from the TaskGraph report (node labels carry
// the progress markers), never hand-rolls a layout. Two consumers share the report:
// the `cdd schema get plan-graph` read and the dispatch/review pre-flight output.
//
// Module-level exports are the class — zero behavior-carrying bare functions.

import { renderMermaidASCII } from "beautiful-mermaid";
import type { TaskGraphReport } from "../session/graph.ts";

/** The plain-text legend — the progress marker vocabulary (appended under the graph). */
const LEGEND = "progress: ✔ done · ▶ current wave";

/** GraphView — the terminal box-drawing DAG display. One render from the shared
 *  TaskGraph report; the mermaid emission is a data projection (node ids carry a
 *  `T` prefix — mermaid node ids must not start with a digit). */
export class GraphView {
  /** render(report, title) → the box-drawing DAG + the legend (the plan read + the
   *  pre-flight display call the same face). */
  render(report: TaskGraphReport, title: string): string {
    const done = new Set(report.done);
    const current = new Set(report.current ?? []);
    const nodes: string[] = [];
    const edges: string[] = [];
    for (const [task, deps] of Object.entries(report.edges)) {
      const id = Number(task);
      const marker = current.has(id) ? " ▶" : done.has(id) ? " ✔" : "";
      nodes.push(`  T${id}["T${id}${marker}"]`);
      for (const dep of deps) edges.push(`  T${dep} --> T${id}`);
    }
    const mermaid = ["flowchart LR", ...nodes, ...edges].join("\n");
    let ascii = renderMermaidASCII(mermaid);
    if (ascii.length === 0) ascii = this.#fallback(report);
    return `${title}\n\n${ascii}\n\n${LEGEND}\ncurrent: {${(report.current ?? []).join(", ")}} · pending: {${report.pending.join(", ")}}`;
  }

  /** A failure of the renderer never blanks the read — a plain fallback line (only
   *  present facts land, the projection survives the display). */
  #fallback(report: TaskGraphReport): string {
    return report.waves.map((wave) => `{${wave.join(",")}}`).join(" → ");
  }
}
