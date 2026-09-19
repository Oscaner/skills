// packages/cdd-engine/src/rules/failure.ts — failure categories canonical read point + quota
// isolation (Task 5 rules-layer rebuild; ex src/rules/failure.mjs + the increment/exhaustion
// machinery of src/dispatch/task.mjs#maybeExhaust). Six category names and their semantics are
// declared once by templates/engine-config.json#failureCategories (Task 5 单文件归并); this
// module is the unique read entry for every "category identity" reference in the engine
// (failure_category assignment / Stopping guard / counter increment). If the canonical is edited
// and a reference site falls out of sync (undefined / red assertions), it must surface loudly —
// load-bearing, not decorative (AC14). Quota isolation: each counter-bearing category increments
// its own progress.json field (channel audit ③ column), and exhaustion is judged per-category
// (threshold >= 2) — one category's terminal state never leaks into another's counter.
import { loadEngineConfig } from "../infra/config.ts";
import { DEFAULT_IDLE_WINDOW_MS } from "../infra/proc.ts";

import { readJson, writeHandoff } from "../artifacts/handoff/write.ts";
import { readProgressJSON, writeProgressJSON } from "../artifacts/progress.ts";

export interface FailureCategory {
  id: string;
  countsTowardStopping?: boolean;
  counter?: string;
  returnMarker?: string;
  terminal?: string;
  dispatchIncomplete?: boolean;
}

const CAT = loadEngineConfig().failureCategories as { categories: FailureCategory[] };

export const FAILURE_CATEGORIES: Record<string, FailureCategory> = Object.fromEntries(
  CAT.categories.map((c) => [c.id, c]),
);

export const counterFor = (id: string): string | null => FAILURE_CATEGORIES[id]?.counter ?? null;

export const terminalFor = (id: string): string | null => FAILURE_CATEGORIES[id]?.terminal ?? null;

export const isIncompleteDispatch = (id: string | undefined): boolean =>
  FAILURE_CATEGORIES[id ?? ""]?.dispatchIncomplete === true; // 判定源在 canonical（B3）

/**
 * counters() — the single value surface of the return block `counters` line: counter-bearing categories,
 * in canonical table order, as { field, label }. Task 7's returnCountersLine consumes this so the
 * four field names / labels come from the canonical with zero caller-side hand-written literals.
 */
export const counters = (): Array<{ field: string; label: string }> =>
  CAT.categories
    .filter((c) => c.counter)
    .map((c) => ({ field: c.counter as string, label: c.returnMarker as string }));

// ---- quota isolation (exhaustion terminal gate) ----

// Per-category counter: fields come from the canonical (counterFor), never a hand-written
// literal. Categories without a counter record the outcome only (no count) — -1 sentinel.
export function incrementFailureCounter(progressDir: string, category: string): number {
  const field = counterFor(category);
  if (!field) return -1;
  const data = readProgressJSON(progressDir);
  const prev: number = typeof data[field] === "number" ? ((data[field] as number) ?? 0) : 0;
  data[field] = prev + 1;
  writeProgressJSON(progressDir, data);
  return data[field] as number;
}

// Terminal gate (T6 / AC7): count >= 2 → terminal blocker «BLOCKED: <category>-exhausted», the
// orchestrator's stop-retrying signal. Below threshold → null (counter recorded, still retryable).
export function exhaustedBlocker(category: string, n: number): string | null {
  if (n < 2) return null;
  return `BLOCKED: ${category}-exhausted (${n} consecutive ${category.replace(/_/g, " ").toLowerCase()} failures) — stop and fix the underlying cause, then re-dispatch a fresh task`;
}

// Single increment + threshold entry: after incrementing, if the category hit its terminal
// threshold, overwrite the just-written failure handoff's blocker with the terminal shape
// (return block/status are re-read via returnFromHandoff, so the orchestrator sees the terminal signal).
export function maybeExhaust(progressDir: string, category: string, handoffPath: string): number {
  const n = incrementFailureCounter(progressDir, category);
  const ex = exhaustedBlocker(category, n);
  if (ex) {
    const obj = readJson(handoffPath) ?? {};
    obj.blocker = ex;
    writeHandoff(handoffPath, obj);
  }
  return n;
}

// ---- T14 TIMEOUT semantics extension (spec E3) ----
// The TIMEOUT category identity never bifurcates (status TIMEOUT + timeoutCount + terminal shape
// are shared), but the blocker wording is now produced from ONE point: a budget timeout keeps the
// legacy wording (T6 AC7, backwards-compatible — the "timed out after" phrase the tests and the
// orchestrator match on), while a liveness-monitor stall carries the recovery contract from the
// brief — the agent's tool call was hung, and the residue it left must be settled before the
// re-dispatch (the entry gate requires a clean tree, so a stalled dispatch's uncommitted changes
// are the human's to discard or commit).
export function timeoutBlocker(opts: {
  stalled?: boolean;
  taskNum: number;
  timeoutMs?: number;
  idleWindowMs?: number;
}): string {
  if (opts.stalled) {
    return (
      `agent dispatch stalled (no CPU or workspace-file progress for ${opts.idleWindowMs ?? DEFAULT_IDLE_WINDOW_MS}ms — ` +
      `tool call hung); uncommitted changes left at return: discard or commit them, ` +
      `then re-dispatch task ${opts.taskNum} (entry gate requires a clean tree)`
    );
  }
  return `cli timed out after ${opts.timeoutMs ?? "<unknown>"}ms → simplify task ${opts.taskNum} scope or increase timeout, then re-dispatch`;
}
