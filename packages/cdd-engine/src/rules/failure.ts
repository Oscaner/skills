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
 * counters() — the single value surface of the H1 `counters` line: counter-bearing categories,
 * in canonical table order, as { field, label }. Task 7's h1CountersLine consumes this so the
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
// (H1/status are re-read via h1FromHandoff, so the orchestrator sees the terminal signal).
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