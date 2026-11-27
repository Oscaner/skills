// packages/cdd-engine/src/run/advance/wave.ts
// The wave gate — the task face's dispatch pre-flight, one verdict, five rows.
//
// INVARIANT — the row ORDER is part of the judgment: a request that matches an earlier row
// keeps that row's cause, and the rows are judged in the declared order
//
//   1. `mixed-batch`   — the request hits a static batch that mixes closed and open tasks
//                        (a batch closes as a unit; a plan revision must not strand the
//                        rest of a partly-executed batch as its own wave);
//   2. `wave-too-wide` — the DERIVED wave is wider than the ceiling (judged before the exact
//                        read, so a wide frontier is never misreported as `split`);
//   3. `too-many-tasks`— the REQUEST itself is wider than the ceiling (never truncated,
//                        never silently halved);
//   4. `split`         — the request is not the derived wave;
//   5. `wrong-phase`   — the derived wave's phase is not this verb's.
//
// The five cause tokens are the ONE reason table's line leg (`next.ts#DISPATCH_REASON`,
// read through `WAVE_GATE_REASON`); this file spells no token and no sentence. The verdict
// carries the derived wave and each member's phase as VALUES, so the render face connects
// them.
//
// The wave decomposition is the task graph's own (`TaskGraph#batches` / `#frontier`): a
// second decomposition here would be a second rule.
//
// Module-level exports are types and the class — zero behaviour-carrying bare functions.

import type { TaskGraph } from "../../docs/judging/task-graph.ts";
import { MAX_TASKS_PER_WAVE } from "../../docs/judging/wave-width.ts";
import type { RoundPhase } from "../dispatch/child.ts";
import { RoundIdentity } from "../ledger/identity.ts";
import type { WaveLine } from "../ledger/ledger.ts";
import { WAVE_GATE_REASON, type WaveGateReason } from "./next.ts";

/** The verbs the wave gate admits — the task face's three dispatch modes. */
export type WaveVerb = "implement" | "review" | "fix";

/** One open-wave task's phase row. The wave-unitary read gives every member the wave's
 *  single phase (one ledger row per wave). */
export interface WavePhaseRow {
  /** The task id. */
  readonly task: number;
  /** The wave's open phase; null when the wave holds no open round. */
  readonly phase: RoundPhase | null;
}

/** The wave board a `split` refusal prints: the plan's coordinate, its derived waves and the
 *  ledger's closed set. The shape is declared HERE because this segment assembles it, and the
 *  render face reads it structurally (`surface/render/graph.ts#GraphTree`) — the advance
 *  segment imports no renderer. */
export interface WaveBoard {
  /** The plan document's coordinate. */
  readonly plan: string;
  /** The derived waves, in execution order. */
  readonly waves: readonly (readonly number[])[];
  /** The task ids already closed. */
  readonly done: ReadonlySet<number>;
}

/** The gate's input — every cell is a fact the caller already read. */
export interface WaveInput {
  /** The plan's graph (its own decomposition is the gate's only wave source). */
  readonly graph: TaskGraph;
  /** The ledger's closed task ids. */
  readonly closed: ReadonlySet<number>;
  /** The ledger's wave lines — the static-batch exemption reads their historical
   *  plan-task snapshots. */
  readonly waves: readonly WaveLine[];
  /** The wave line's open phase, read from the ledger by the caller's one walk. */
  readonly phaseOf: (waveKey: string) => RoundPhase | null;
}

/** The gate's verdict: approved, or the named cause plus the two read values. */
export interface WaveVerdict {
  /** Whether the request may be dispatched. */
  readonly ok: boolean;
  /** The refusing row's cause token (absent when approved). */
  readonly reason?: WaveGateReason;
  /** The derived open wave, ascending — both the split hint and the progress face read it. */
  readonly open: readonly number[];
  /** The derived wave's member phases (one row per member; the wave's single phase). */
  readonly phases: readonly WavePhaseRow[];
}

/**
 * WaveGate — the three-verb wave gate. Invariant: one `vet` call judges the request against
 * the plan's static batches, the derived open wave and the ledger's phase, in the declared
 * row order (see the file's header); the same gate serves all three verbs.
 */
export class WaveGate {
  /** The request's derived wave over the ledger's closure set — the ONE wave frontier,
   *  read off the task graph's own decomposition. */
  derivedWave(graph: TaskGraph, closed: ReadonlySet<number>): readonly number[] {
    return [...graph.frontier(closed)].sort(WaveGate.#ascending);
  }

  /** vet(requested, verb, input) — the five rows, in order. */
  vet(requested: ReadonlySet<number>, verb: WaveVerb, input: WaveInput): WaveVerdict {
    const open = this.derivedWave(input.graph, input.closed);
    const asked = [...requested].sort(WaveGate.#ascending);
    const phases = this.#phasesOf(input, open);

    const mixed = this.#mixedBatchOf(requested, input);
    if (mixed !== null) return { ok: false, reason: mixed, open, phases };

    if (open.length > MAX_TASKS_PER_WAVE) {
      return { ok: false, reason: WAVE_GATE_REASON.waveTooWide, open, phases };
    }

    if (asked.length > MAX_TASKS_PER_WAVE) {
      return { ok: false, reason: WAVE_GATE_REASON.tooManyTasks, open, phases };
    }

    if (!WaveGate.#exact(asked, open)) {
      return { ok: false, reason: WAVE_GATE_REASON.split, open, phases };
    }

    const phase = phases[0]?.phase ?? null;
    if (phase !== verb) return { ok: false, reason: WAVE_GATE_REASON.wrongPhase, open, phases };
    return { ok: true, open, phases };
  }

  /** The derived wave's member phases — every member carries the WAVE's single phase. */
  #phasesOf(input: WaveInput, open: readonly number[]): readonly WavePhaseRow[] {
    const phase = open.length === 0 ? null : input.phaseOf(open.join(","));
    return open.map((task) => ({ task, phase }));
  }

  /** Row 1 — the static-batch mix, with the ONE exemption: a batch whose open members were
   *  APPENDED to the plan after its closed members closed is the supported append path, not
   *  a stranded batch. The exemption reads the most recently closed wave row touching the
   *  batch: its historical snapshot must exist and must not contain any open member. An
   *  absent snapshot (a row recorded before the fact existed) is never an append — the
   *  conservative refusal stands. */
  #mixedBatchOf(requested: ReadonlySet<number>, input: WaveInput): WaveGateReason | null {
    const batch = input.graph
      .batches()
      .find((derived) => derived.some((task) => requested.has(task)));
    if (batch === undefined) return null;
    const closedMembers = batch.filter((task) => input.closed.has(task));
    const openMembers = batch.filter((task) => !input.closed.has(task));
    if (closedMembers.length === 0 || openMembers.length === 0) return null;
    if (this.#appendedSinceClosure(input, closedMembers, openMembers)) return null;
    return WAVE_GATE_REASON.mixedBatch;
  }

  /** Whether the batch's open members were appended after its closed members closed. */
  #appendedSinceClosure(
    input: WaveInput,
    closedMembers: readonly number[],
    openMembers: readonly number[],
  ): boolean {
    for (let index = input.waves.length - 1; index >= 0; index -= 1) {
      const row = input.waves[index];
      if (row === undefined) continue;
      const ids = RoundIdentity.taskIdsOfWord(row.line);
      if (ids.length === 0) continue;
      if (!ids.some((id) => closedMembers.includes(id))) continue;
      if (!ids.every((id) => input.closed.has(id))) continue;
      const snapshot = row.planTasks;
      if (snapshot === null) return false;
      return openMembers.every((id) => !snapshot.includes(id));
    }
    return false;
  }

  /** Whether two ascending id lists are the same set. */
  static #exact(asked: readonly number[], open: readonly number[]): boolean {
    return asked.length === open.length && asked.every((id, index) => id === open[index]);
  }

  /** The ascending comparator — one spelling, used by both sorted lists. */
  static #ascending(left: number, right: number): number {
    return left - right;
  }
}
