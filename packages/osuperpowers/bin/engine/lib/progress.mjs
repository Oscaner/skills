// engine/lib/progress.mjs — CDD progress.json read/write/migrate + derivation.
// Replaces progress.md-based timeoutCount with structured JSON.
// Transparent migration: readProgressJSON auto-migrates progress.md → progress.json.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const PROGRESS_SCHEMA = {
  required: ["plan", "timeoutCount", "engineRecoveryCount", "lastDispatchHead", "tasks", "degradationLog"],
  tasksItem: { required: ["task", "status", "rounds"], statusEnum: ["pending", "complete"] },
  degradationLogItem: {
    required: ["task", "mode", "severity", "summary", "reason", "timestamp"],
    scopeEnum: ["deferred-sweep", "blocker-only"],
    severityEnum: ["head-mismatch", "engine-error", "timeout", "dirty-tree"],
  },
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
export function writeProgressJSON(progressDir, data) {
  const jsonPath = path.join(progressDir, "progress.json");
  writeFileSync(jsonPath, JSON.stringify(data, null, 2));
}

// createEmptyProgress: create a fresh progress object for a given plan.
export function createEmptyProgress(plan) {
  return {
    plan: plan || "",
    timeoutCount: 0,
    engineRecoveryCount: 0,
    lastDispatchHead: "",
    tasks: [],
    degradationLog: [],
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
    lastDispatchHead: "", // empty — in-flight migration out of scope
    tasks: tasks.sort((a, b) => a.task - b.task),
    degradationLog: [], // existing prose degradation logs are not parsed (freeform format)
  };
}

// deriveProgressMD: derive progress.md content from a progress.json object.
// Used only for backward compatibility if needed.
export function deriveProgressMD(data) {
  const lines = [];
  if (data.plan) lines.push(`## Plan\n${data.plan}\n`);
  lines.push(`## Ledger`);
  for (const t of data.tasks) {
    if (t.status === "complete") lines.push(`Task ${t.task}: complete`);
  }
  lines.push(`\n## engine-recovery-count: ${data.engineRecoveryCount}`);
  lines.push(`## timeoutCount: ${data.timeoutCount}`);
  return lines.join("\n") + "\n";
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
