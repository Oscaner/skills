// packages/cdd-engine/src-next/face/__tests__/graph-view.test.ts
// P4.1 T7 — find #6 closeout (user 2026-10-09: "W1 fits the agent mindset better"): the plan-graph
// board's wave labels start at W1 and ascend per derived wave — the label = the wave
// index + 1 with no zero-padding (the display layer only; the wave derivation itself
// is unchanged). The plan's execution-order labels (W1–W4) must match the board's
// derived labels verbatim (one label convention — the plan cites the board's derived labels).

import { describe, expect, it } from "vitest";
import type { TaskGraphReport } from "../../session/graph.ts";
import { GraphView } from "../graph-view.ts";

/** A board fixture — derived waves whose labels the execution order mirrors
 *  (the P4.1 plan's W1 = {T1,T2} → W2 = {T3,T4} → W3 = {T5} → W4 = {T6,T7}). */
function board(waves: readonly (readonly number[])[], done: readonly number[]): string {
  const report: TaskGraphReport = {
    edges: {},
    waves,
    done,
    current: waves.find((wave) => wave.some((id) => !done.includes(id))) ?? null,
    pending: waves.flat().filter((id) => !done.includes(id)),
  };
  return new GraphView().render(report, "plan-graph: docs/kairos/plans/p.md");
}

describe("GraphView — the plan-graph wave-board labels (find #6 · W1-first ordering · no zero-padding)", () => {
  it("labels the waves W1, W2, … — the derived wave index + 1, zero no-padding", () => {
    const out = board([[1, 2], [3], [4, 5]], [1]);
    expect(out).toContain("W1  T1✔ · T2▶   ← in-flight");
    expect(out).toContain("W2  T3○");
    expect(out).toContain("W3  T4○ · T5○");
    // the zero-based display is retired — no W0 anywhere
    expect(out).not.toContain("W0");
  });

  it("renders the plan's execution-order labels verbatim — W1..W4 for the four derived waves", () => {
    const out = board([[1, 2], [3, 4], [5], [6, 7]], [1, 2, 3, 4, 5]);
    for (const label of ["W1  T1✔ · T2✔", "W2  T3✔ · T4✔", "W3  T5✔", "W4  T6▶ · T7▶"]) {
      expect(out).toContain(label);
    }
    expect(out).toContain("wave board:");
    expect(out).toContain("progress: ✔ done · ▶ current wave · ○ pending");
  });

  it("a ten-wave board pads nothing — W10 renders naturally, never W010", () => {
    const waves = Array.from({ length: 10 }, (_, index) => [index + 1]);
    const out = board(waves, waves.flat().slice(0, 9));
    expect(out).toContain("W10  T10▶   ← in-flight");
    expect(out).not.toContain("W010");
  });
});
