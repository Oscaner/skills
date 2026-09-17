// packages/cdd-engine/src/artifacts/progress.ts — CDD progress.json read/write/migrate + derivation
// (Task 8 port of progress.mjs; ex lib/state/progress.mjs). Replaces the progress.md-based
// timeoutCount with structured JSON. Transparent migration: readProgressJSON auto-migrates
// progress.md → progress.json.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { counters } from "../rules/failure.ts";

// T8: progress schema dropped lastDispatchHead/degradationLog (dead fields; check-head/
// engine-recovery degradation, superseded by deriveReviewStatus/engineRecoveryCount);
// degradationLogItem retired with degradationLog.
// T6: the PROGRESS_SCHEMA constant block was deleted whole — zero consumers repo-wide. The
// progress.json key set is carried by createEmptyProgress (initial shape) + migrateIfNeeded's
// backfill branch (legacy-migration shape); mechanical guard = tests/progress.test.mjs's
// six-key lexical-order assertion + backfill assertions.

/** progress.json shape — top-level keys only (plan / counters / tasks). Counters derive from the
 * canonical failure-categories table (createEmptyProgress writes all counter fields at 0). */
export interface ProgressData {
  plan?: string;
  timeoutCount?: number;
  contractViolationCount?: number;
  engineSelfWrittenCount?: number;
  engineRecoveryCount?: number;
  tasks: Array<{
    task: number;
    status?: string;
    rounds?: Record<string, number>;
  }>;
  [key: string]: unknown;
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
 * write-back. Strips on a serialization copy, never mutates the caller's object. */
const PROGRESS_DEAD_KEYS = ["lastDispatchHead", "degradationLog"];
export function writeProgressJSON(progressDir: string, data: ProgressData): void {
  const jsonPath = path.join(progressDir, "progress.json");
  const clean = { ...data };
  for (const k of PROGRESS_DEAD_KEYS) delete clean[k];
  writeFileSync(jsonPath, JSON.stringify(clean, null, 2));
}

/** createEmptyProgress: fresh progress object for a given plan.
 * T8: dead fields deleted — progress.json top level is plan/timeoutCount/engineRecoveryCount/tasks.
 * T6: contractViolationCount / engineSelfWrittenCount added (init 0) — the six keys match the
 * canonical counter column (templates/failure-categories.json) verbatim (tests/progress.test.mjs
 * six-key assertion). */
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

/** getRound: the round number to dispatch next (last completed + 1, or 1 if none). */
export function getRound(progressData: ProgressData, taskNum: number, mode: string): number {
  const taskEntry = progressData.tasks.find((t) => t.task === taskNum);
  const lastCompleted = taskEntry?.rounds?.[mode] ?? 0;
  return lastCompleted + 1;
}

/** incrementRound: record that a round has been dispatched (call after any handoff is written to
 * disk, including BLOCKED/TIMEOUT). Creates the task entry if absent. */
export function incrementRound(progressDir: string, taskNum: number, mode: string): void {
  const data = readProgressJSON(progressDir);
  let taskEntry = data.tasks.find((t) => t.task === taskNum);
  if (!taskEntry) {
    taskEntry = { task: taskNum, status: "pending", rounds: {} };
    data.tasks.push(taskEntry);
  }
  taskEntry.rounds ??= {}; // migrate pre-rounds task entries that lack the field
  taskEntry.rounds[mode] = (taskEntry.rounds[mode] ?? 0) + 1;
  writeProgressJSON(progressDir, data);
}

/** incrementRecovery: engineRecoveryCount 自增 (D14 — every progress.json field is engine-written).
 * The runner calls this whenever the engine writes a BLOCKED handoff (BLOCKED/engine-error path);
 * the orchestrator-layer skill (cli-driven-development §engine-recovery) only READS it to decide
 * retry (count < 2 → re-dispatch; count ≥ 2 → terminal engine-error), never increments itself. */
export function incrementRecovery(progressDir: string): void {
  const data = readProgressJSON(progressDir);
  data.engineRecoveryCount = (data.engineRecoveryCount ?? 0) + 1;
  writeProgressJSON(progressDir, data);
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

  // Parse completed tasks: `Task N: complete`
  const tasks: Array<{ task: number; status: string }> = [];
  const taskLines = content.match(/Task (\d+): complete/g) || [];
  for (const line of taskLines) {
    const num = parseInt(line.match(/Task (\d+)/)![1], 10);
    tasks.push({ task: num, status: "complete" }); // completedAt omitted for pre-migration tasks
  }

  // Fill in missing tasks as pending (up to the max completed task number)
  const maxTask = tasks.length > 0 ? Math.max(...tasks.map((t) => t.task)) : 0;
  for (let i = 1; i <= maxTask; i++) {
    if (!tasks.find((t) => t.task === i)) tasks.push({ task: i, status: "pending" });
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
      // T6: backfill the two counters (init 0), only write when actually backfilled — no no-op
      // overwrite without change (same line as persistFinalized). Judgment by missing/非数字
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

/** h1CountersLine(workspace) — the H1 `counters` line's UNIQUE construction point (T7): all three
 * H1 producers (task h1FourLines / h1FromHandoff · branch dry-run block) append through this
 * function, or the task-family 5-line vs branch-family 4-line split has no guard.
 * Reads the four counter fields of <workspace>/progress.json: missing / corrupt file / missing
 * keys each fall back to `0` and never throw (a dry-run first round may not have progress.json
 * yet — the fallback IS the first-round shape). **Read-only, no write side effect**: never
 * paper-over the missing-file zero fallback, never overwrites progress.json on the H1 path.
 * Field names and H1 labels come from src/rules/failure.ts#counters() (T6 canonical) — zero
 * hand-written counter names / labels here. */
export function h1CountersLine(workspace: string): string {
  const jsonPath = path.join(workspace, "progress.json");
  let data: Record<string, unknown> = {};
  if (existsSync(jsonPath)) {
    try {
      data = JSON.parse(readFileSync(jsonPath, "utf8")) as Record<string, unknown>;
    } catch {
      data = {};
    }
  }
  const parts = [];
  for (const { field, label } of counters()) {
    parts.push(`${label}=${typeof data[field] === "number" ? data[field] : 0}`);
  }
  return `counters: ${parts.join(" ")}`;
}