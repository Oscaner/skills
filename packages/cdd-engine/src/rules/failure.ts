// packages/cdd-engine/src/rules/failure.ts — failure categories canonical read point + quota
// isolation (Task 5 rules-layer rebuild; ex src/rules/failure.mjs + the increment/exhaustion
// machinery of src/dispatch/task.mjs#maybeExhaust). Six category names and their semantics are
// declared once by templates/engine-config.json#failureCategories (Task 5 单文件归并); this
// module is the unique read entry for every "category identity" reference in the engine
// (failure_category assignment / Convergence guard / counter increment). If the canonical is edited
// and a reference site falls out of sync (undefined / red assertions), it must surface loudly —
// load-bearing, not decorative (AC14). Quota isolation: each counter-bearing category increments
// its own progress.json field (channel audit ③ column), and exhaustion is judged per-category
// (threshold >= 2) — one category's terminal state never leaks into another's counter.
import { loadEngineConfig } from "../infra/config.ts";
import { DEFAULT_IDLE_WINDOW_MS, type TerminationCause } from "../infra/proc.ts";

import { readJson, writeHandoff } from "../artifacts/handoff/write.ts";
import { readProgressJSON, writeProgressJSON } from "../artifacts/progress.ts";

export interface FailureCategory {
  id: string;
  countsTowardConvergence?: boolean;
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

// Terminal gate (T6 / AC7): count >= 2 → terminal blocker, the orchestrator's stop-retrying
// signal. The marker comes from the canonical terminal field when the category declares one
// (single read point — the TIMEOUT marker is «BLOCKED: dispatch-timeout-cap», never a hand-written
// literal; F8 terminology), falling back to the generic «BLOCKED: <category>-exhausted» only for
// counter-bearing categories without a terminal. Below threshold → null (counter recorded, still retryable).
export function exhaustedBlocker(category: string, n: number): string | null {
  if (n < 2) return null;
  const marker = terminalFor(category) ?? `BLOCKED: ${category}-exhausted`;
  return `${marker} (${n} consecutive ${category.replace(/_/g, " ").toLowerCase()} failures) — stop and fix the underlying cause, then re-dispatch a fresh task`;
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

// ---- TIMEOUT semantics — unified by the termination cause (T26, spec T7.5; replaces the T14 stalled-boolean variant) ----
// The TIMEOUT category identity never bifurcates (status TIMEOUT + timeoutCount + terminal shape
// are shared), but the blocker wording is produced from ONE point keyed on the unified termination
// cause: over-budget keeps the legacy wording (T6 AC7, backwards-compatible — the "timed out
// after" phrase the tests and the orchestrator match on), while "stalled" (hung tool call) and
// "signal" (external SIGTERM — abrupt agent death, not a budget expiry) both carry the recovery
// contract from the brief. The resume-or-discard wording is scoped to the IMPLEMENT lane — the only
// lane with a resume pre-flight (settleResidue salvage → re-dispatch stash apply); review/fix
// rounds (T25) keep the stash-workflow shape (the settlement step auto-preserves their WIP; the
// operator retrieves it via `git stash list` → apply → review → commit or drop). Each cause is
// distinguishable in the blocker (death can be archived and replayed by cause).
export function timeoutBlocker(opts: {
  cause?: TerminationCause;
  taskNum: number;
  timeoutMs?: number;
  idleWindowMs?: number;
  /** dispatch op (implement/review/fix) — only implement carries the auto-resume contract. */
  op?: string;
  /** the salvage stash ref recorded in the carrier's recovery.residue_ref (null → nothing salvaged / not recorded). */
  residue?: string | null;
}): string {
  if (opts.cause === "stalled" || opts.cause === "signal") {
    const op = opts.op || "implement";
    const basis =
      opts.cause === "signal"
        ? "agent dispatch terminated by an external signal (SIGTERM)"
        : `agent dispatch stalled (no CPU or workspace-file progress for ${opts.idleWindowMs ?? DEFAULT_IDLE_WINDOW_MS}ms — tool call hung)`;
    if (op === "implement") {
      const resume = opts.residue
        ? `resume or discard: cdd implement --task ${opts.taskNum} re-dispatch auto-resumes (recovery.residue_ref=${opts.residue}), or git stash drop to abandon`
        : `resume or discard: cdd implement --task ${opts.taskNum} re-dispatch auto-resumes (recovery.residue_ref), or git stash drop to abandon`;
      return `${basis}; ${resume}`;
    }
    return `${basis}; worktree residue (if any) is preserved as a stash — \`git stash list\` to find the snapshot, \`git stash apply <ref>\` + review to salvage (then commit) or \`git stash drop\` to discard, then re-dispatch cdd ${op} --task ${opts.taskNum}`;
  }
  return `cli timed out after ${opts.timeoutMs ?? "<unknown>"}ms → simplify task ${opts.taskNum} scope or increase timeout, then re-dispatch`;
}
