// packages/cdd-engine/src/artifacts/progress.ts — CDD progress.json read/write/migrate + derivation
// (Task 8 port of progress.mjs; ex lib/state/progress.mjs). Replaces the progress.md-based
// timeoutCount with structured JSON. Transparent migration: readProgressJSON auto-migrates
// progress.md → progress.json.
// P6 T24 B: the return block's `counters:` line construction moved to
// src/artifacts/return-block.ts#returnCountersLine (its single point) — progress drops the
// counters() import, breaking the failure⇄progress mutual import (counters() stays the
// rules/failure.ts owner; progress only reads/writes).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gitMergeBaseIsAncestor } from "../infra/git.ts";

// The progress schema dropped lastDispatchHead/degradationLog (T8: dead fields; check-head/
// engine-recovery degradation, superseded by deriveReviewStatus/engineRecoveryCount);
// degradationLogItem retired with degradationLog.
// The PROGRESS_SCHEMA constant block was deleted whole (T6) — zero consumers repo-wide. The
// progress.json key set is carried by createEmptyProgress (initial shape) + migrateIfNeeded's
// backfill branch (legacy-migration shape); mechanical guard = tests/progress.test.mjs's
// six-key lexical-order assertion + backfill assertions.

/** progress.json row — keyed by scalar `task` for single-task groups (`--tasks 1` — backward
 * compatible with every per-task consumer) or by the group key string for multi-task groups
 * (`--tasks 1,2` → `{ group: "1-2" }`; the P4.3 group is the dispatch unit — round/handoff/
 * progress/residue land per group). */
export type TaskLedgerRow =
  | { task: number; rounds?: Record<string, number>; scope_base?: string }
  | { group: string; rounds?: Record<string, number>; scope_base?: string };

/** progress.json shape — top-level keys only (plan / counters / tasks). Counters derive from the
 * canonical failure-categories table (createEmptyProgress writes all counter fields at 0). */
export interface ProgressData {
  plan?: string;
  timeoutCount?: number;
  contractViolationCount?: number;
  engineSelfWrittenCount?: number;
  engineRecoveryCount?: number;
  tasks: TaskLedgerRow[];
  [key: string]: unknown;
}

/** Ledger lookup key — a scalar task number (single-task group) or the group key string. */
export type LedgerKey = number | string;

/** rowFor(data, key) — the ledger row lookup single point: a number key or a single-task group key
 * (`"1"`) resolves the `{ task: N }` row (post-migration single groups keep the legacy row shape);
 * a multi-task group key (`"1-2"`) resolves the `{ group }` row. Exported as the shared single/group
 * row lookup — dispatch/task.ts uses it for the APPROVED-review ensure-row writeback (single source,
 * no inline re-implementation of the dichotomy). */
export function rowFor(data: ProgressData, key: LedgerKey): TaskLedgerRow | undefined {
  if (typeof key === "number") return data.tasks.find((t) => "task" in t && t.task === key);
  const single = /^\d+$/.test(key) ? Number(key) : null;
  return single != null
    ? data.tasks.find((t) => "task" in t && t.task === single)
    : data.tasks.find((t) => "group" in t && t.group === key);
}

/** entryFor(key) — constructs a fresh row for a key absent from the ledger (single key → task row;
 * multi group key → group row). Exported alongside rowFor — the single-source pair the dispatch
 * layer shares for the ensure-row writeback. */
export function entryFor(key: LedgerKey): TaskLedgerRow {
  const single = typeof key === "number" || /^\d+$/.test(key);
  return single ? { task: Number(key) } : { group: String(key) };
}

/** readProgressJSON(progressDir, plan): read progress.json from progressDir.
 * Transparent migration: if progress.json is missing but progress.md exists, migrate first.
 * If neither exists, return empty progress.
 * plan (T7 optional 2nd arg): recorded into progress on first create/migrate via
 * createEmptyProgress(plan) — the absolute path of the `--plan` arg. Single-arg consumers
 * (incrementRound / incrementRecovery internals) are unchanged: at their call time progress.json
 * already exists and plan does not participate in derivation. */
export function readProgressJSON(progressDir: string, plan?: string): ProgressData {
  const jsonPath = path.join(progressDir, "progress.json");
  if (existsSync(jsonPath)) {
    try {
      return JSON.parse(readFileSync(jsonPath, "utf8")) as ProgressData;
    } catch {
      // Corrupted file — fall through to migration
    }
  }
  return migrateIfNeeded(progressDir, plan);
}

/** writeProgressJSON: write data to progress.json in progressDir.
 * The dead fields (lastDispatchHead/degradationLog) are stripped on write once more — a legacy
 * progress.json (a live pre-degradation file) carrying the old keys gets a one-time GC on first
 * write-back. Task 30 ②: tasks[N].status is retired from the schema — any legacy row still
 * carrying it converges on the first write-back (deriveTaskState is the single TaskState source;
 * the row keeps only facts). Strips on a serialization copy, never mutates the caller's object. */
const PROGRESS_DEAD_KEYS = ["lastDispatchHead", "degradationLog"];
export function writeProgressJSON(progressDir: string, data: ProgressData): void {
  const jsonPath = path.join(progressDir, "progress.json");
  const clean = { ...data };
  for (const k of PROGRESS_DEAD_KEYS) delete clean[k];
  if (Array.isArray(clean.tasks)) {
    clean.tasks = clean.tasks.map((t) => {
      const row = { ...t } as Record<string, unknown>;
      delete row.status;
      return row as ProgressData["tasks"][number];
    });
  }
  writeFileSync(jsonPath, JSON.stringify(clean, null, 2));
}

/** createEmptyProgress: fresh progress object for a given plan.
 * T8: dead fields deleted — progress.json top level is plan/timeoutCount/engineRecoveryCount/tasks.
 * T6: contractViolationCount / engineSelfWrittenCount added (init 0) — the six keys match the
 * canonical counter column (engine-config.json#failureCategories) verbatim
 * (src/artifacts/__tests__/progress.test.ts six-key assertion). */
export function createEmptyProgress(plan?: string): ProgressData {
  return {
    plan: plan || "",
    timeoutCount: 0,
    contractViolationCount: 0,
    engineSelfWrittenCount: 0,
    engineRecoveryCount: 0,
    tasks: [],
  };
}

/** getRound: the round number to dispatch next (last completed + 1, or 1 if none). Keyed by the
 * dispatch unit — a scalar task number or a group key string (P4.3: the group is the dispatch unit;
 * single groups resolve the per-task row, multi-task groups the `{ group }` row). */
export function getRound(progressData: ProgressData, key: LedgerKey, mode: string): number {
  const taskEntry = rowFor(progressData, key);
  const lastCompleted = taskEntry?.rounds?.[mode] ?? 0;
  return lastCompleted + 1;
}

/** incrementRound: record that a round has been dispatched (call after any handoff is written to
 * disk, including BLOCKED/TIMEOUT). Creates the row (task or group kind) if absent. */
export function incrementRound(progressDir: string, key: LedgerKey, mode: string): void {
  const data = readProgressJSON(progressDir);
  let taskEntry = rowFor(data, key);
  if (!taskEntry) {
    taskEntry = entryFor(key);
    data.tasks.push(taskEntry);
  }
  taskEntry.rounds ??= {}; // migrate pre-rounds task entries that lack the field
  taskEntry.rounds[mode] = (taskEntry.rounds[mode] ?? 0) + 1;
  writeProgressJSON(progressDir, data);
}

/** incrementRecovery: engineRecoveryCount increments (D14 — every progress.json field is engine-written).
 * The runner calls this whenever the engine writes a BLOCKED handoff (BLOCKED/engine-error path);
 * the orchestrator-layer skill (cli-driven-development §engine-recovery) only READS it to decide
 * retry (count < 2 → re-dispatch; count ≥ 2 → terminal engine-error), never increments itself. */
export function incrementRecovery(progressDir: string): void {
  const data = readProgressJSON(progressDir);
  data.engineRecoveryCount = (data.engineRecoveryCount ?? 0) + 1;
  writeProgressJSON(progressDir, data);
}

// ---- tasks[N].scope_base — task-level contribution anchor — the scope ledger (T27 spec T7.6) ----
// `base` one name, two meanings (T26 defect): roundBase is this round's commit seat (correct per-round), scopeBase
// is the task's TRUE contribution start — must survive round death and stay stable across re-dispatches
// (converge in the normal flow, diverge on resume rounds). The ledger is the engine's sole writer;
// it is NOT an agent-authored handoff key. Seed = first-round implement's brief TASK_BASE via
// seedScopeBase at materialization time (earliest-wins); a resume-declared base may only move the
// ledger STRICTLY earlier (via moveTaskScopeBaseEarlier — recovered commits sit below any round's
// brief snapshot). Read fallback: taskScopeBase → null, then dispatch/task.ts falls back to the
// legacy prev.commits.base chain (zero behavior change for tasks without a ledger).
export const SHA40_RE = /^[0-9a-f]{40}$/;

/** taskScopeBase: the ledger's current scope_base for the key, or null when absent/invalid
 *  (a non-40-hex stored value is treated as a missing ledger — dispatch falls back to legacy). */
export function taskScopeBase(progressDir: string, key: LedgerKey): string | null {
  const entry = rowFor(readProgressJSON(progressDir), key);
  const v = entry?.scope_base;
  return typeof v === "string" && SHA40_RE.test(v) ? v : null;
}

/** seedScopeBase: earliest-wins seed of the ledger for the key. Creates the row on demand.
 *  Returns the ledger value AFTER the call: an existing valid anchor wins (the return equals the
 *  current value, the change is a no-op); an invalid stored value is healed by the first valid seed;
 *  a non-40-hex/absent input never writes (returns the current ledger value — null when empty). */
export function seedScopeBase(progressDir: string, key: LedgerKey, base: string): string | null {
  const data = readProgressJSON(progressDir);
  const current = rowFor(data, key)?.scope_base;
  if (typeof current === "string" && SHA40_RE.test(current)) return current; // earliest-wins
  if (!SHA40_RE.test(base)) return current ?? null;
  let taskEntry = rowFor(data, key);
  if (!taskEntry) {
    taskEntry = entryFor(key);
    data.tasks.push(taskEntry);
  }
  taskEntry.scope_base = base;
  writeProgressJSON(progressDir, data);
  return base;
}

/** moveTaskScopeBaseEarlier: the resume-declared-base move lane. Only a candidate that is a strict
 *  HEAD ancestor AND a strict (candidate !== current) ancestor of the current ledger value may pull
 *  the ledger earlier — a descendant/later commit, a ==head value (fraud lane), a non-ancestor
 *  forgery (checked via git merge-base output comparison — see infra/git.ts gitMergeBaseIsAncestor),
 *  and a non-40-hex candidate all leave the ledger intact. Ledger missing → falls back to the seed
 *  lane. Returns the ledger value after the call. */
export async function moveTaskScopeBaseEarlier(
  progressDir: string,
  key: LedgerKey,
  candidate: string,
  cwd: string,
  head: string,
): Promise<string | null> {
  const current = taskScopeBase(progressDir, key);
  if (current === null) return seedScopeBase(progressDir, key, candidate);
  if (!SHA40_RE.test(candidate) || candidate === current || candidate === head) return current;
  const isAncestorOfCurrent = await gitMergeBaseIsAncestor(cwd, candidate, current);
  const isAncestorOfHead = await gitMergeBaseIsAncestor(cwd, candidate, head);
  if (!isAncestorOfCurrent || !isAncestorOfHead) return current;
  const data = readProgressJSON(progressDir);
  const taskEntry = rowFor(data, key);
  if (taskEntry) {
    taskEntry.scope_base = candidate;
    writeProgressJSON(progressDir, data);
    return candidate;
  }
  return current;
}

/** migrateFromProgressMD: parse progress.md and return a structured progress object.
 * Returns null when progress.md does not exist. */
export function migrateFromProgressMD(progressDir: string): ProgressData | null {
  const mdPath = path.join(progressDir, "progress.md");
  if (!existsSync(mdPath)) return null;
  const content = readFileSync(mdPath, "utf8");

  // Parse timeoutCount from `# timeoutCount: N` (single hash, matching runner.mjs's write format)
  const timeoutMatch = content.match(/^# timeoutCount: (\d+)/m);
  const timeoutCount = timeoutMatch ? parseInt(timeoutMatch[1], 10) : 0;

  // Parse engineRecoveryCount from `# engine-recovery-count: N` (single hash)
  const recoveryMatch = content.match(/^# engine-recovery-count: (\d+)/m);
  const engineRecoveryCount = recoveryMatch ? parseInt(recoveryMatch[1], 10) : 0;

  // Parse completed tasks: `Task N: complete` — Task 30 ②: migrated rows are status-free (the
  // legacy complete/pending marker is subsumed by deriveTaskState).
  const tasks: Array<{ task: number }> = [];
  const taskLines = content.match(/Task (\d+): complete/g) || [];
  for (const line of taskLines) {
    const num = parseInt(line.match(/Task (\d+)/)![1], 10);
    tasks.push({ task: num }); // completedAt omitted for pre-migration tasks
  }

  // Fill in missing tasks (up to the max completed task number)
  const maxTask = tasks.length > 0 ? Math.max(...tasks.map((t) => t.task)) : 0;
  for (let i = 1; i <= maxTask; i++) {
    if (!tasks.find((t) => t.task === i)) tasks.push({ task: i });
  }

  return {
    plan: "",
    timeoutCount,
    engineRecoveryCount,
    tasks: tasks.sort((a, b) => a.task - b.task),
  };
}

/** migrateIfNeeded(progressDir, plan): transparent migration.
 * 1. progress.json exists → return it (T6: backfill the two counters when absent and write back —
 *    a legacy four-key object read out must already carry contractViolationCount /
 *    engineSelfWrittenCount for the stdout counters line's value source to be complete)
 * 2. progress.md exists → migrate to progress.json, return migrated data
 * 3. neither → create empty progress (T7: plan recorded via createEmptyProgress at the init point;
 *    legacy no-plan semantics fall back to createEmptyProgress(plan || "")) */
export function migrateIfNeeded(progressDir: string, plan?: string): ProgressData {
  const jsonPath = path.join(progressDir, "progress.json");
  if (existsSync(jsonPath)) {
    try {
      const data = JSON.parse(readFileSync(jsonPath, "utf8")) as ProgressData;
      // Backfill the two counters (init 0), only writing when actually backfilled (T6) — no no-op
      // overwrite without change (same line as persistFinalized). Judgment by missing/non-numeric
      // rather than unconditional write: a legacy valid number (e.g. existing 5) must not be zeroed.
      let changed = false;
      if (typeof (data as Record<string, unknown>).contractViolationCount !== "number") {
        (data as Record<string, unknown>).contractViolationCount = 0;
        changed = true;
      }
      if (typeof (data as Record<string, unknown>).engineSelfWrittenCount !== "number") {
        (data as Record<string, unknown>).engineSelfWrittenCount = 0;
        changed = true;
      }
      if (changed) writeProgressJSON(progressDir, data);
      return data;
    } catch {
      // Corrupted — treat as missing, try migration
    }
  }
  const mdData = migrateFromProgressMD(progressDir);
  if (mdData) {
    writeProgressJSON(progressDir, mdData);
    return mdData;
  }
  const empty = createEmptyProgress(plan);
  writeProgressJSON(progressDir, empty);
  return empty;
}
