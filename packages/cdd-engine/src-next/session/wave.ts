// packages/cdd-engine/src-next/session/wave.ts
// T24 (v1.21 — the three-verb unified wave gate) — the task-face dispatch
// pre-flight as ONE gate method. The retired split check (the implement-only
// strict-wave check + the phase lock) converges into `WaveGate.vet(requested,
// verb)`: implement / review / fix share the same single wave gate — a
// half-wave review or a half-wave fix is structurally blocked exactly like a
// half-wave implement.
//
// The gate's only read face is `open = frontier(closedWaves())` — the derived
// wave over the ledger's C5 closure set (ledger.ts, the same closure predicate as
// the lifecycle's #markTerminal). The two judgments:
//   1. requested ≠ open      → the split/subset BLOCK (dispatch the full derived wave,
//                              with the wave-board hint);
//   2. the open wave's phase ≠ verb → the wrong-phase BLOCK (run the matching phase).
// (v1.28 — the heterogeneous-phase row RETIRED: the wave-unitary ledger has ONE row
// per wave, so mixed per-task phases are structurally impossible — a per-task phase
// read was the T26 regression {16,22,24} exposed (the row key `16` never matched
// `{wave:"16,22,24"}`), not a mixed-phase anomaly.)
// The verdict wording renders the wave-gate vocabulary rows (face/words.ts — the
// gate's prompt wording rides the word table, never a literal restate). BLOCK
// messages and the verdict shape are data here; the CLI face renders them.
//
// Module-level exports are types / the class — zero behavior-carrying bare
// functions (the plan's zero-bare-function discipline).

import type { Words } from "../face/words.ts";
import type { DispatchPhase } from "./faces.ts";
import type { TaskGraph } from "./graph.ts";
import type { Ledger } from "./ledger.ts";
import { NextStepRouter } from "./next.ts";
import { EMPTY_RUN_STATE } from "./run.ts";

/** The verdict kinds — the named gate rows (the BLOCK reason each carries). */
export type WaveGateReason = "split" | "wrong-phase";

/** One open-wave task's phase row — every member carries the WAVE's single phase
 *  (the wave-unitary read: one ledger row per wave; a per-task read would miss the
 *  wave row — `16` ≠ `16,22,24` — the T26 migration regression). */
export interface WavePhaseRow {
  /** The task id. */
  task: number;
  /** The wave's open phase (null = a closed/held wave — no open round on record). */
  phase: DispatchPhase | null;
}

/** The wave-gate verdict — approved or one of the three named BLOCK rows. */
export interface WaveVerdict {
  /** Whether the gate approves the dispatch (the requested wave = the open wave,
   *  the wave's phase = the requested verb). */
  ok: boolean;
  /** The BLOCK reason kind (present when ok is false). */
  reason?: WaveGateReason;
  /** The rendered BLOCK message (the vocabulary row, verbatim-filled). */
  message?: string;
  /** The derived open wave — frontier(closedWaves), ascending (both the split hint
   *  and the CLI's progress-marking read this). */
  open: readonly number[];
  /** The open wave's member phases — every task carries the WAVE's single phase
   *  (the wave-unitary display: one ledger row per wave, never a per-task read). */
  phases?: readonly WavePhaseRow[];
}

/**
 * WaveGate — the three-verb unified wave gate (implement / review / fix share the
 * single gate). One OOP method: vet(requested, verb) judges the request against
 * the derived open wave + the ledger's per-task phases; the CLI calls it before
 * ANY task-face dispatch, never a variant gate per verb.
 */
export class WaveGate {
  /** The C5 next router — the phase derivation's route judge (stateless, shared). */
  readonly #router = new NextStepRouter();

  /** vet(requested, verb, graph, ledger, words) — the three-verb gate: the verdict
   *  row the CLI renders (ok → dispatch; a reason + message → the BLOCK face). */
  vet(
    requested: ReadonlySet<number>,
    verb: "implement" | "review" | "fix",
    graph: TaskGraph,
    ledger: Ledger,
    words: Words,
  ): WaveVerdict {
    const closed = ledger.closedWaves();
    const open = [...graph.frontier(closed)].sort((a, b) => a - b);
    const asked = [...requested].sort((a, b) => a - b);
    const requestedKey = asked.join(",");
    const openKey = open.join(",");
    const wordsGate = words.waveGateWords();
    const exact = asked.length === open.length && asked.every((id, index) => id === open[index]);

    // 1. The split/subset BLOCK — requested ≠ open: a `--tasks` set that splits or
    //    mismatches the derived wave is refused for ANY verb (a subset never reorders
    //    the wave, never half-approves it). The full-wave hint rides the message.
    if (!exact) {
      return {
        ok: false,
        reason: "split",
        message: this.#fill(wordsGate.split, { requested: requestedKey, open: openKey }),
        open,
        phases: this.#phasesOf(ledger, open),
      };
    }

    // 2. The open wave's phase — the single phase of the wave's own row (wave-unitary:
    //    one ledger row per wave, so every member shares the phase; a per-task read
    //    never matches the wave row — the T26 migration regression).
    const phases = this.#phasesOf(ledger, open);
    const phase = phases[0]?.phase ?? null;
    if (phase !== verb) {
      return {
        ok: false,
        reason: "wrong-phase",
        message: this.#fill(wordsGate.wrongPhase, { phase: phase ?? "held" }),
        open,
        phases,
      };
    }
    return { ok: true, open, phases };
  }

  /** The open wave's per-task phases — every member resolves the WAVE row's single
   *  phase (implement → review → fix → re-review → closure; null = no open round). */
  #phasesOf(ledger: Ledger, open: readonly number[]): readonly WavePhaseRow[] {
    const waveKey = open.join(",");
    const phase = this.#phaseOf(ledger, waveKey);
    return open.map((task) => ({ task, phase }));
  }

  /** The ledger-derived open phase of ONE wave row — the wave-unitary read: the same
   *  C5 round-pair derivation the retired task-face phase gate applied, over the wave's
   *  own row key (the per-task read never matched a `{wave:"16,22,24"}` row — the fix). */
  #phaseOf(ledger: Ledger, waveKey: string): DispatchPhase | null {
    const implemented = ledger.roundCount(waveKey, "implement");
    const reviews = ledger.roundCount(waveKey, "review");
    const fixes = ledger.roundCount(waveKey, "fix");
    if (implemented === 0) return "implement";
    if (reviews === 0) return "review";
    if (fixes < reviews) return "fix";
    const carried = ledger.round("fix", "wave", { tasks: waveKey }, reviews);
    if (carried === null) return null;
    return this.#router.next(EMPTY_RUN_STATE, carried)?.kind === "review" ? "review" : null;
  }

  /** The raw fill of one placeholder template — the noun-slot substitution
   *  ({requested} / {open} / {phase} / {map}); every slot defined, unknown braces kept. */
  #fill(template: string, slots: Record<string, string>): string {
    return template.replace(/\{(\w+)\}/g, (whole, name: string) => slots[name] ?? whole);
  }
}
