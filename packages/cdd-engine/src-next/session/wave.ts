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
// the lifecycle's #markTerminal). The three judgments:
//   1. requested hits a derived static batch (graph.batches()) that mixes closed
//      and open tasks → the mixed-batch BLOCK (a batch closes as a unit — a plan
//      revision must not strand the rest of a partly-executed batch as its own wave);
//   2. requested ≠ open      → the split/subset BLOCK (dispatch the full derived wave,
//                              with the wave-board hint);
//   3. the open wave's phase ≠ verb → the wrong-phase BLOCK (run the matching phase).
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

/** The verdict kinds — the named gate rows (the BLOCK reason each carries): the
 *  static-batch mix guard · the split/subset refusal · the wrong-phase refusal. */
export type WaveGateReason = "mixed-batch" | "split" | "wrong-phase";

/** One open-wave task's phase row — every member carries the WAVE's single phase
 *  (the wave-unitary read: one ledger row per wave; a per-task read would miss the
 *  wave row — `16` ≠ `16,22,24` — the T26 migration regression). */
export interface WavePhaseRow {
  /** The task id. */
  task: number;
  /** The wave's open phase (null = a closed/held wave — no open round on record). */
  phase: DispatchPhase | null;
}

/** The wave-gate verdict — approved or one of the three named BLOCK rows
 *  (mixed-batch · split · wrong-phase). */
export interface WaveVerdict {
  /** Whether the gate approves the dispatch (requested = the open wave, no mixed
   *  static batch, the wave's phase = the requested verb). */
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
 * the plan's static batches, the derived open wave, and the ledger's per-task
 * phases; the CLI calls it before ANY task-face dispatch, never a variant gate per
 * verb.
 */
export class WaveGate {
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

    // 1. The static-batch mix BLOCK — the requested set hits a derived batch that
    //    mixes closed and open tasks. A batch closes as a unit, so the leftovers must
    //    not ride out as their own wave UNLESS the plan grew them after the closure
    //    (the supported append path, P21 §5.1): the closed batch's snapshot is the
    //    historical task set, and an open member absent from it was added later —
    //    the plan leads the ledger by an append, not by a stranded batch. An absent
    //    snapshot (a historical row) keeps the conservative BLOCK. Judged BEFORE the
    //    exact read (the derived open wave alone cannot see the closed siblings).
    const batch = graph.batches().find((derived) => derived.some((id) => requested.has(id)));
    if (batch?.some((id) => closed.has(id)) && batch.some((id) => !closed.has(id))) {
      const closedMembers = batch.filter((id) => closed.has(id));
      const openMembers = batch.filter((id) => !closed.has(id));
      if (!this.#appendedSinceClosure(ledger, closed, closedMembers, openMembers)) {
        return {
          ok: false,
          reason: "mixed-batch",
          message: this.#fill(wordsGate.mixedBatch, {
            batch: batch.join(","),
            closed: closedMembers.join(","),
            open: openMembers.join(","),
          }),
          open,
          phases: this.#phasesOf(ledger, open),
        };
      }
    }

    // 2. The split/subset BLOCK — requested ≠ open: a `--tasks` set that splits or
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

    // 3. The open wave's phase — the single phase of the wave's own row (wave-unitary:
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

  /** Whether the batch's open members were APPENDED after its closed members closed
   *  — read from the ledger's plan-task snapshot of the most recently closed wave row
   *  touching the batch (the row order in progress.json is the write order, so the
   *  reverse scan lands on the latest closure). True only when a snapshot exists AND
   *  none of the open members is in it: the plan grew the batch afterwards. A missing
   *  snapshot (a historical row, or a wave that closed before the fact existed) is
   *  never an append — the conservative BLOCK stands (zero migration). */
  #appendedSinceClosure(
    ledger: Ledger,
    closed: ReadonlySet<number>,
    closedMembers: readonly number[],
    openMembers: readonly number[],
  ): boolean {
    const data = ledger.readProgress();
    if (data === null) return false;
    for (let index = data.waves.length - 1; index >= 0; index -= 1) {
      const row = data.waves[index];
      const ids = row.wave
        .split(",")
        .map((part) => Number(part))
        .filter((id) => Number.isInteger(id) && id > 0);
      if (ids.length === 0) continue;
      if (!ids.some((id) => closedMembers.includes(id))) continue;
      if (!ids.every((id) => closed.has(id))) continue;
      const snapshot = ledger.planTasksOf(row.wave);
      if (snapshot === null) return false;
      return openMembers.every((id) => !snapshot.includes(id));
    }
    return false;
  }

  /** The open wave's per-task phases — every member resolves the WAVE row's single
   *  phase (implement → review → fix → re-review → closure; null = no open round). */
  #phasesOf(ledger: Ledger, open: readonly number[]): readonly WavePhaseRow[] {
    const waveKey = open.join(",");
    const phase = this.#phaseOf(ledger, waveKey);
    return open.map((task) => ({ task, phase }));
  }

  /** The ledger-derived open phase of ONE wave row — the SINGLE source (D26): the
   *  wave gate and the lifecycle's frame frontier both read this one method
   *  (`Ledger#waveLinePhase`), never a per-consumer copy. The wave-unitary read: the
   *  same C5 round-pair derivation over the wave's own row key (the per-task read
   *  never matched a `{wave:"16,22,24"}` row — the fix). The D16/T11 revision
   *  precheck lives in the ledger method (a drifted BRIEF reopens at review; same +
   *  pending fix stays at fix). */
  #phaseOf(ledger: Ledger, waveKey: string): DispatchPhase | null {
    return ledger.waveLinePhase(waveKey);
  }

  /** The raw fill of one placeholder template — the noun-slot substitution
   *  ({requested} / {open} / {phase} / {map}); every slot defined, unknown braces kept. */
  #fill(template: string, slots: Record<string, string>): string {
    return template.replace(/\{(\w+)\}/g, (whole, name: string) => slots[name] ?? whole);
  }
}
