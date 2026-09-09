// engine/lib/progress.mjs — CDD progress.json read/write/migrate + derivation.
// Replaces progress.md-based timeoutCount with structured JSON.
// Transparent migration: readProgressJSON auto-migrates progress.md → progress.json.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

// T8: progress schema 删除 lastDispatchHead/degradationLog（死字段；check-head/engine-recovery 退化，
//  deriveReviewStatus/engineRecoveryCount 取代），degradationLogItem 随 degradationLog 一并废弃。
const PROGRESS_SCHEMA = {
  required: ["plan", "timeoutCount", "engineRecoveryCount", "tasks"],
  tasksItem: { required: ["task", "status", "rounds"], statusEnum: ["pending", "complete"] },
};

// readProgressJSON: read progress.json from progressDir.
// Transparent migration: if progress.json missing but progress.md exists, migrate first.
// If neither exists, return empty progress.
export function readProgressJSON(progressDir) {
  const jsonPath = path.join(progressDir, "progress.json");
  if (existsSync(jsonPath)) {
    try {
      return JSON.parse(readFileSync(jsonPath, "utf8"));
    } catch {
      // Corrupted file — fall through to migration
    }
  }
  // Transparent migration
  const migrated = migrateIfNeeded(progressDir);
  return migrated;
}

// writeProgressJSON: write data to progress.json in progressDir.
// 死字段（lastDispatchHead/degradationLog）随 schema 删除后，写前仍剥除一次 —— 存量
// progress.json（check-head/engine-recovery 退化前的 live 文件）若已带旧键，首次回写即完成
// 一次性垃圾回收。仅在序列化副本上删键，不修改调用者内存对象。
const PROGRESS_DEAD_KEYS = ["lastDispatchHead", "degradationLog"];
export function writeProgressJSON(progressDir, data) {
  const jsonPath = path.join(progressDir, "progress.json");
  const clean = { ...data };
  for (const k of PROGRESS_DEAD_KEYS) delete clean[k];
  writeFileSync(jsonPath, JSON.stringify(clean, null, 2));
}

// createEmptyProgress: create a fresh progress object for a given plan.
// T8: 死字段（lastDispatchHead/degradationLog）已删 —— progress.json 顶层仅 plan/timeoutCount/engineRecoveryCount/tasks。
export function createEmptyProgress(plan) {
  return {
    plan: plan || "",
    timeoutCount: 0,
    engineRecoveryCount: 0,
    tasks: [],
  };
}

// getRound: returns the round number to dispatch next (last completed + 1, or 1 if none).
export function getRound(progressData, taskNum, mode) {
  const taskEntry = progressData.tasks.find((t) => t.task === taskNum);
  const lastCompleted = taskEntry?.rounds?.[mode] ?? 0;
  return lastCompleted + 1;
}

// incrementRound: record that a round has been dispatched (call after any handoff is written to disk,
// including BLOCKED/TIMEOUT). Creates task entry if absent.
export function incrementRound(progressDir, taskNum, mode) {
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

// migrateFromProgressMD: parse progress.md and return a structured progress object.
// Returns null if progress.md does not exist.
export function migrateFromProgressMD(progressDir) {
  const mdPath = path.join(progressDir, "progress.md");
  if (!existsSync(mdPath)) return null;
  const content = readFileSync(mdPath, "utf8");

  // Parse timeoutCount from `# timeoutCount: N` (single hash, matching runner.mjs write format)
  const timeoutMatch = content.match(/^# timeoutCount: (\d+)/m);
  const timeoutCount = timeoutMatch ? parseInt(timeoutMatch[1]) : 0;

  // Parse engineRecoveryCount from `# engine-recovery-count: N` (single hash)
  const recoveryMatch = content.match(/^# engine-recovery-count: (\d+)/m);
  const engineRecoveryCount = recoveryMatch ? parseInt(recoveryMatch[1]) : 0;

  // Parse completed tasks: `Task N: complete`
  const tasks = [];
  const taskLines = content.match(/Task (\d+): complete/g) || [];
  for (const line of taskLines) {
    const num = parseInt(line.match(/Task (\d+)/)[1]);
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

// migrateIfNeeded: transparent migration.
// 1. progress.json exists → return it
// 2. progress.md exists → migrate to progress.json, return migrated data
// 3. neither → return empty progress
export function migrateIfNeeded(progressDir) {
  const jsonPath = path.join(progressDir, "progress.json");
  if (existsSync(jsonPath)) {
    try {
      return JSON.parse(readFileSync(jsonPath, "utf8"));
    } catch {
      // Corrupted — treat as missing, try migration
    }
  }
  const mdData = migrateFromProgressMD(progressDir);
  if (mdData) {
    writeProgressJSON(progressDir, mdData);
    return mdData;
  }
  const empty = createEmptyProgress("");
  writeProgressJSON(progressDir, empty);
  return empty;
}
