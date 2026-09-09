// engine/tests/progress.test.mjs — progress.json module unit tests.
// Tests: read/write/create/migrate/migrateIfNeeded + deriveProgressMD + getRound/incrementRound.
import { it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  readProgressJSON,
  writeProgressJSON,
  createEmptyProgress,
  migrateFromProgressMD,
  migrateIfNeeded,
  getRound,
  incrementRound,
} from "../lib/progress.mjs";

function tmpDir(prefix) {
  return mkdtempSync(path.join(tmpdir(), prefix));
}

// ---- createEmptyProgress ----

it("createEmptyProgress: returns empty structure with defaults", () => {
  const p = createEmptyProgress("");
  expect(p.plan).toBe("");
  expect(p.timeoutCount).toBe(0);
  expect(p.engineRecoveryCount).toBe(0);
  expect(p.tasks).toEqual([]);
});

it("progress schema 不含 lastDispatchHead/degradationLog（T8 死字段清除）", () => {
  // Object.keys 词法排序 —— 期望字面量用词法序，勿用插入序断言。
  expect(Object.keys(createEmptyProgress("/p")).sort()).toEqual(["engineRecoveryCount", "plan", "tasks", "timeoutCount"]);
});

it("createEmptyProgress: plan parameter is used", () => {
  const p = createEmptyProgress("/path/to/plan.md");
  expect(p.plan).toBe("/path/to/plan.md");
});

// ---- readProgressJSON / writeProgressJSON ----

it("readProgressJSON: returns empty progress when no files exist", () => {
  const dir = tmpDir("prog-noexist-");
  const p = readProgressJSON(dir);
  expect(p).toBeTruthy();
  expect(p.timeoutCount).toBe(0);
  expect(p.plan).toBe("");
});

it("readProgressJSON: reads existing progress.json", () => {
  const dir = tmpDir("prog-read-json-");
  const data = createEmptyProgress("/plan.md");
  data.timeoutCount = 5;
  data.tasks = [{ task: 1, status: "complete" }];
  writeProgressJSON(dir, data);
  const p = readProgressJSON(dir);
  expect(p.timeoutCount).toBe(5);
  expect(p.tasks).toEqual([{ task: 1, status: "complete" }]);
});

it("writeProgressJSON: creates progress.json file", () => {
  const dir = tmpDir("prog-write-json-");
  const data = createEmptyProgress("");
  writeProgressJSON(dir, data);
  const jsonPath = path.join(dir, "progress.json");
  expect(existsSync(jsonPath)).toBe(true);
  const written = JSON.parse(readFileSync(jsonPath, "utf8"));
  expect(written.timeoutCount).toBe(0);
});

it("writeProgressJSON: 写前剥除死字段 lastDispatchHead/degradationLog（T8 存量 progress.json 首次回写即回收）", () => {
  const dir = tmpDir("prog-strip-");
  const data = createEmptyProgress("");
  data.lastDispatchHead = "8e95ac735540c264cd4500d4c1ca659971bd2f11";
  data.degradationLog = [{ at: "2026-09-08", reason: "legacy pre-T8" }];
  writeProgressJSON(dir, data);
  const written = JSON.parse(readFileSync(path.join(dir, "progress.json"), "utf8"));
  expect(written).not.toHaveProperty("lastDispatchHead");
  expect(written).not.toHaveProperty("degradationLog");
  expect(written.plan).toBe("");
});

it("readProgressJSON: corrupted progress.json falls through to migration", () => {
  const dir = tmpDir("prog-corrupt-json-");
  // Write invalid JSON
  writeFileSync(path.join(dir, "progress.json"), "not valid json{{{");
  const p = readProgressJSON(dir);
  // Should fall through to migration (no progress.md → empty)
  expect(p).toBeTruthy();
  expect(p.timeoutCount).toBe(0);
});

// ---- migrateFromProgressMD ----

it("migrateFromProgressMD: returns null when no progress.md", () => {
  const dir = tmpDir("prog-md-none-");
  expect(migrateFromProgressMD(dir)).toBe(null);
});

it("migrateFromProgressMD: parses timeoutCount from # timeoutCount: N", () => {
  const dir = tmpDir("prog-md-tc-");
  writeFileSync(path.join(dir, "progress.md"), "# CDD ledger\n# timeoutCount: 3\n");
  const p = migrateFromProgressMD(dir);
  expect(p.timeoutCount).toBe(3);
});

it("migrateFromProgressMD: parses engineRecoveryCount from # engine-recovery-count: N", () => {
  const dir = tmpDir("prog-md-rc-");
  writeFileSync(path.join(dir, "progress.md"), "# CDD ledger\n# engine-recovery-count: 2\n");
  const p = migrateFromProgressMD(dir);
  expect(p.engineRecoveryCount).toBe(2);
});

it("migrateFromProgressMD: parses completed tasks", () => {
  const dir = tmpDir("prog-md-tasks-");
  writeFileSync(
    path.join(dir, "progress.md"),
    "# CDD ledger\nTask 1: complete\nTask 3: complete\n",
  );
  const p = migrateFromProgressMD(dir);
  expect(p.tasks.length).toBe(3); // 1:complete, 2:pending, 3:complete
  expect(p.tasks[0]).toEqual({ task: 1, status: "complete" });
  expect(p.tasks[1]).toEqual({ task: 2, status: "pending" });
  expect(p.tasks[2]).toEqual({ task: 3, status: "complete" });
});

it("migrateFromProgressMD: empty ledger → no tasks", () => {
  const dir = tmpDir("prog-md-empty-");
  writeFileSync(path.join(dir, "progress.md"), "# CDD ledger\n");
  const p = migrateFromProgressMD(dir);
  expect(p.tasks).toEqual([]);
});

it("migrateFromProgressMD: no timeoutCount → defaults to 0", () => {
  const dir = tmpDir("prog-md-notc-");
  writeFileSync(path.join(dir, "progress.md"), "# CDD ledger\n");
  const p = migrateFromProgressMD(dir);
  expect(p.timeoutCount).toBe(0);
});

// ---- migrateIfNeeded ----

it("migrateIfNeeded: progress.json exists → returns it (no migration)", () => {
  const dir = tmpDir("prog-mig-json-");
  const data = createEmptyProgress("");
  data.timeoutCount = 7;
  writeProgressJSON(dir, data);
  const p = migrateIfNeeded(dir);
  expect(p.timeoutCount).toBe(7);
  // progress.md should not be created
  expect(existsSync(path.join(dir, "progress.md"))).toBe(false);
});

it("migrateIfNeeded: no progress.json, progress.md exists → migrates + writes json", () => {
  const dir = tmpDir("prog-mig-md-");
  writeFileSync(
    path.join(dir, "progress.md"),
    "# CDD ledger\n# timeoutCount: 4\nTask 1: complete\n",
  );
  const p = migrateIfNeeded(dir);
  expect(p.timeoutCount).toBe(4);
  expect(p.tasks[0]).toEqual({ task: 1, status: "complete" });
  // progress.json should now exist
  expect(existsSync(path.join(dir, "progress.json"))).toBe(true);
  // Verify the written json matches
  const json = JSON.parse(readFileSync(path.join(dir, "progress.json"), "utf8"));
  expect(json.timeoutCount).toBe(4);
});

it("migrateIfNeeded: neither file exists → returns empty progress + creates json", () => {
  const dir = tmpDir("prog-mig-empty-");
  const p = migrateIfNeeded(dir);
  expect(p.timeoutCount).toBe(0);
  expect(p.plan).toBe("");
  // Should create progress.json
  expect(existsSync(path.join(dir, "progress.json"))).toBe(true);
});

// ---- T4: rounds key 归一（"review"，task-review 剔除）——progress 层已 mode 参数化，直测键语义 ----

it("getRound: incrementRound('review') 后 round=2（rounds['review'] 归一键）", () => {
  const dir = tmpDir("prog-round-review-");
  expect(getRound(readProgressJSON(dir), 1, "review")).toBe(1);
  incrementRound(dir, 1, "review");
  expect(getRound(readProgressJSON(dir), 1, "review")).toBe(2);
  const saved = JSON.parse(readFileSync(path.join(dir, "progress.json"), "utf8"));
  expect(saved.tasks[0].rounds).toEqual({ review: 1 });
  expect(saved.tasks[0].rounds["task-review"]).toBeUndefined();
});
