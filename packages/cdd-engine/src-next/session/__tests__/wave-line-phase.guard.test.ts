// packages/cdd-engine/src-next/session/__tests__/wave-line-phase.guard.test.ts
// D26 — the wave-line phase single-source guard. The wave line's open phase has ONE
// derivation (`Ledger#waveLinePhase`), read at judgment time by BOTH consumers: the
// wave gate (`WaveGate` via `wave.ts #phaseOf`) and the lifecycle's frame frontier
// (`run.ts #nextWavePhase`). A per-consumer copy of the derivation is a drift seed —
// the gate could accept `review` while the frontier demands `fix`, deadlocking a
// drift-reopened wave. This guard pins the delegation at the source: each consumer
// must reach the phase via `Ledger#waveLinePhase`, never re-derive it locally.
//
// Zero module-level bare functions — the read helper is `const` (the zero-`function`
// declaration discipline).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/** The consumer faces whose phase derivation must delegate to the single source. */
const CONSUMERS = {
  "the wave gate (wave.ts #phaseOf)": fileURLToPath(new URL("../wave.ts", import.meta.url)),
  "the lifecycle frontier (run.ts #nextWavePhase)": fileURLToPath(
    new URL("../run.ts", import.meta.url),
  ),
} as const;

describe("D26 — the wave-line phase single source", () => {
  it("the wave gate and the lifecycle frontier both delegate to Ledger#waveLinePhase (zero per-consumer copy)", () => {
    for (const [label, file] of Object.entries(CONSUMERS)) {
      const source = readFileSync(file, "utf8");
      // the consumer delegates: its phase method calls the ledger's single source
      expect(source, `${label} delegates to Ledger#waveLinePhase`).toMatch(/waveLinePhase\(/);
    }
    // the single source lives in the ledger — the delegation target exists
    const ledger = readFileSync(fileURLToPath(new URL("../ledger.ts", import.meta.url)), "utf8");
    expect(ledger, "Ledger#waveLinePhase is the declared single source").toMatch(
      /waveLinePhase\(waveKey: string\): RoundPhase \| null/,
    );
  });
});
