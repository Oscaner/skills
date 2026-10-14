// packages/cdd-engine/src-next/session/__tests__/wave-line-phase.guard.test.ts
// D26 — the wave-line phase single-source guard. The wave line's open phase has ONE
// derivation (`Ledger#waveLinePhase`), read at judgment time by BOTH consumers: the
// wave gate (`WaveGate` via `wave.ts #phaseOf`) and the lifecycle's frame frontier
// (`run.ts #nextWavePhase`). A per-consumer copy of the derivation is a drift seed —
// the gate could accept `review` while the frontier demands `fix`, deadlocking a
// drift-reopened wave. This guard pins the delegation at the source: each consumer's
// phase method BODY must return the ledger's single source directly, never a
// re-derived local (a file-wide `waveLinePhase(` match would pass on any stray call
// site — the pin anchors to the delegating method).
//
// Zero module-level bare functions — the read helper is `const` (the zero-`function`
// declaration discipline).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/** The consumer faces whose phase derivation must delegate to the single source —
 *  each pinned to its delegating METHOD body (signature … `return <ledger>.waveLinePhase(<arg>)`),
 *  so a re-derived local inside the method fails the pin. */
const CONSUMERS: Readonly<Record<string, { file: string; delegation: RegExp }>> = {
  "the wave gate (wave.ts #phaseOf)": {
    file: fileURLToPath(new URL("../wave.ts", import.meta.url)),
    delegation:
      /#phaseOf\(ledger: Ledger, waveKey: string\): DispatchPhase \| null \{\s*return ledger\.waveLinePhase\(waveKey\);/,
  },
  "the lifecycle frontier (run.ts #nextWavePhase)": {
    file: fileURLToPath(new URL("../run.ts", import.meta.url)),
    delegation:
      /#nextWavePhase\(key: string\): DispatchPhase \| null \{\s*return this\.#ledger\.waveLinePhase\(key\);/,
  },
} as const;

describe("D26 — the wave-line phase single source", () => {
  it("the wave gate and the lifecycle frontier both delegate to Ledger#waveLinePhase (zero per-consumer copy)", () => {
    for (const [label, { file, delegation }] of Object.entries(CONSUMERS)) {
      const source = readFileSync(file, "utf8");
      // the consumer's phase METHOD returns the ledger's single source directly —
      // anchored to the delegating body, not a file-wide call-site match
      expect(source, `${label} delegates to Ledger#waveLinePhase`).toMatch(delegation);
    }
    // the single source lives in the ledger — the delegation target exists
    const ledger = readFileSync(fileURLToPath(new URL("../ledger.ts", import.meta.url)), "utf8");
    expect(ledger, "Ledger#waveLinePhase is the declared single source").toMatch(
      /waveLinePhase\(waveKey: string\): RoundPhase \| null/,
    );
  });
});
