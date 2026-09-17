// engine/src/artifacts/progress.mjs（ex lib/state/progress.mjs）— CDD progress.json read/write/migrate + derivation.
// Replaces progress.md-based timeoutCount with structured JSON.
// Transparent migration: readProgressJSON auto-migrates progress.md → progress.json.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { counters } from "../rules/failure.mjs";

// T8: progress schema 删除 lastDispatchHead/degradationLog（死字段；check-head/engine-recovery 退化，
//  deriveReviewStatus/engineRecoveryCount 取代），degradationLogItem 随 degradationLog 一并废弃。
// T6: 死常量 PROGRESS_SCHEMA 整块删除 —— 全仓零消费方（grep 仅命中定义行），改它没有任何可观察
//  差异。progress.json 的键集落库形此后由 createEmptyProgress（初值形）+ migrateIfNeeded 补齐分支
// （存量迁移形）二者共同承载，机械保障 = tests/progress.test.mjs 的六键词法序断言 + 补齐断言。

// readProgressJSON(progressDir, plan): read progress.json from progressDir.
// Transparent migration: if progress.json missing but progress.md exists, migrate first.
// If neither exists, return empty progress.
// plan（T7 可选第二参）：首次创建/迁移时经 createEmptyProgress(plan) 入档 —— plan 是 `--plan` 入参的
// 绝对路径。既有单参消费方（incrementRound / incrementRecovery 内部调用）语义不变：其调用时点
// progress.json 已存在，plan 不参与派生。
export function readProgressJSON(progressDir, plan) {
  const jsonPath = path.join(progressDir, "progress.json");
  if (existsSync(jsonPath)) {
    try {
      return JSON.parse(readFileSync(jsonPath, "utf8"));
    } catch {
      // Corrupted file — fall through to migration
    }
  }
  // Transparent migration
  const migrated = migrateIfNeeded(progressDir, plan);
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
// T6: 增 contractViolationCount / engineSelfWrittenCount 两计数器字段（初值 0）——六键与 canonical
//  计数器列（templates/failure-categories.json）逐字一致（tests/progress.test.mjs 六键断言承载）。
export function createEmptyProgress(plan) {
  return {
    plan: plan || "",
    timeoutCount: 0,
    contractViolationCount: 0,
    engineSelfWrittenCount: 0,
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

// incrementRecovery: engineRecoveryCount 自增（D14 — progress.json 全字段由 engine 单选）。
// runner.mjs 在每次 engine 写 BLOCKED handoff（BLOCKED/engine-error 判定路径）时调用；
// orchestrator 层 skill（cli-driven-development §engine-recovery）只读该值判 retry
//（count < 2 → re-dispatch；count ≥ 2 → terminal engine-error），不再自行递增。
export function incrementRecovery(progressDir) {
  const data = readProgressJSON(progressDir);
  data.engineRecoveryCount = (data.engineRecoveryCount ?? 0) + 1;
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

// migrateIfNeeded(progressDir, plan): transparent migration.
// 1. progress.json exists → return it（T6：按需补齐两键并回写 —— 存量四键旧形读出的对象必须已带
//    contractViolationCount / engineSelfWrittenCount，stdout counters 行的取值来源才完整）
// 2. progress.md exists → migrate to progress.json, return migrated data
// 3. neither → create empty progress（T7：plan 经 createEmptyProgress 派生入档 —— 初始化点的读经
//    本分支记录 `--plan` 绝对路径；既有无 plan 语义由 createEmptyProgress(plan || "") 兜底为空串）
export function migrateIfNeeded(progressDir, plan) {
  const jsonPath = path.join(progressDir, "progress.json");
  if (existsSync(jsonPath)) {
    try {
      const data = JSON.parse(readFileSync(jsonPath, "utf8"));
      // T6: 补齐两键（初值 0），仅在确有补齐时回写 —— 无变化不产生 no-op 覆盖（与 persistFinalized 同口径）。
      // 补齐判定按「缺失 / 非数字」而非恒写：存量合法数值（如已有 5）不得被清零。
      let changed = false;
      if (typeof data.contractViolationCount !== "number") { data.contractViolationCount = 0; changed = true; }
      if (typeof data.engineSelfWrittenCount !== "number") { data.engineSelfWrittenCount = 0; changed = true; }
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

// h1CountersLine(workspace) — H1 `counters` 行的**唯一构造点**（T7）：三个 H1 生产者
//（run-task.mjs h1FourLines / h1FromHandoff · branch-review.mjs DRY_RUN 块）一律经本函数追加，
// 否则 task 族 5 行、branch 族 4 行分叉无守卫可抓。
// 读 <workspace>/progress.json 四计数器字段：文件缺失 / 损坏 / 键缺失一律按 `0` 兜底、**不抛**
//（dry-run 首轮 workspace 可能尚未落 progress.json —— 兜底即首轮形态）。**只读、无写副作用**：
// 不清「缺文件」的零值兜底语义，也不在 H1 输出路径上产生 progress.json 覆盖。
// 字段名与 H1 标签一律经 src/rules/failure.mjs#counters() 取自 failure-categories.json（T6 canonical），
// 本函数零手写计数器名 / 零手写标签。
export function h1CountersLine(workspace) {
  const jsonPath = path.join(workspace, "progress.json");
  let data = {};
  if (existsSync(jsonPath)) {
    try {
      data = JSON.parse(readFileSync(jsonPath, "utf8"));
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
