// engine/tests/progress.test.mjs — progress.json module unit tests.
// Tests: read/write/create/migrate/migrateIfNeeded + deriveProgressMD + getRound/incrementRound.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  readProgressJSON,
  writeProgressJSON,
  createEmptyProgress,
  migrateFromProgressMD,
  deriveProgressMD,
  migrateIfNeeded,
  getRound,
  incrementRound,
} from "../lib/progress.mjs";

function tmpDir(prefix) {
  return mkdtempSync(path.join(tmpdir(), prefix));
}

// ---- createEmptyProgress ----

test("createEmptyProgress: returns empty structure with defaults", () => {
  const p = createEmptyProgress("");
  assert.equal(p.plan, "");
  assert.equal(p.timeoutCount, 0);
  assert.equal(p.engineRecoveryCount, 0);
  assert.equal(p.lastDispatchHead, "");
  assert.deepEqual(p.tasks, []);
  assert.deepEqual(p.degradationLog, []);
});

test("createEmptyProgress: plan parameter is used", () => {
  const p = createEmptyProgress("/path/to/plan.md");
  assert.equal(p.plan, "/path/to/plan.md");
});

// ---- readProgressJSON / writeProgressJSON ----

test("readProgressJSON: returns empty progress when no files exist", () => {
  const dir = tmpDir("prog-noexist-");
  const p = readProgressJSON(dir);
  assert.ok(p, "should return a progress object");
  assert.equal(p.timeoutCount, 0);
  assert.equal(p.plan, "");
});

test("readProgressJSON: reads existing progress.json", () => {
  const dir = tmpDir("prog-read-json-");
  const data = createEmptyProgress("/plan.md");
  data.timeoutCount = 5;
  data.tasks = [{ task: 1, status: "complete" }];
  writeProgressJSON(dir, data);
  const p = readProgressJSON(dir);
  assert.equal(p.timeoutCount, 5);
  assert.deepEqual(p.tasks, [{ task: 1, status: "complete" }]);
});

test("writeProgressJSON: creates progress.json file", () => {
  const dir = tmpDir("prog-write-json-");
  const data = createEmptyProgress("");
  writeProgressJSON(dir, data);
  const jsonPath = path.join(dir, "progress.json");
  assert.ok(existsSync(jsonPath), "progress.json should exist");
  const written = JSON.parse(readFileSync(jsonPath, "utf8"));
  assert.equal(written.timeoutCount, 0);
});

test("readProgressJSON: corrupted progress.json falls through to migration", () => {
  const dir = tmpDir("prog-corrupt-json-");
  // Write invalid JSON
  writeFileSync(path.join(dir, "progress.json"), "not valid json{{{");
  const p = readProgressJSON(dir);
  // Should fall through to migration (no progress.md → empty)
  assert.ok(p);
  assert.equal(p.timeoutCount, 0);
});

// ---- migrateFromProgressMD ----

test("migrateFromProgressMD: returns null when no progress.md", () => {
  const dir = tmpDir("prog-md-none-");
  assert.equal(migrateFromProgressMD(dir), null);
});

test("migrateFromProgressMD: parses timeoutCount from # timeoutCount: N", () => {
  const dir = tmpDir("prog-md-tc-");
  writeFileSync(path.join(dir, "progress.md"), "# CDD ledger\n# timeoutCount: 3\n");
  const p = migrateFromProgressMD(dir);
  assert.equal(p.timeoutCount, 3);
});

test("migrateFromProgressMD: parses engineRecoveryCount from # engine-recovery-count: N", () => {
  const dir = tmpDir("prog-md-rc-");
  writeFileSync(path.join(dir, "progress.md"), "# CDD ledger\n# engine-recovery-count: 2\n");
  const p = migrateFromProgressMD(dir);
  assert.equal(p.engineRecoveryCount, 2);
});

test("migrateFromProgressMD: parses completed tasks", () => {
  const dir = tmpDir("prog-md-tasks-");
  writeFileSync(
    path.join(dir, "progress.md"),
    "# CDD ledger\nTask 1: complete\nTask 3: complete\n",
  );
  const p = migrateFromProgressMD(dir);
  assert.equal(p.tasks.length, 3); // 1:complete, 2:pending, 3:complete
  assert.deepEqual(p.tasks[0], { task: 1, status: "complete" });
  assert.deepEqual(p.tasks[1], { task: 2, status: "pending" });
  assert.deepEqual(p.tasks[2], { task: 3, status: "complete" });
});

test("migrateFromProgressMD: empty ledger → no tasks", () => {
  const dir = tmpDir("prog-md-empty-");
  writeFileSync(path.join(dir, "progress.md"), "# CDD ledger\n");
  const p = migrateFromProgressMD(dir);
  assert.deepEqual(p.tasks, []);
});

test("migrateFromProgressMD: no timeoutCount → defaults to 0", () => {
  const dir = tmpDir("prog-md-notc-");
  writeFileSync(path.join(dir, "progress.md"), "# CDD ledger\n");
  const p = migrateFromProgressMD(dir);
  assert.equal(p.timeoutCount, 0);
});

// ---- migrateIfNeeded ----

test("migrateIfNeeded: progress.json exists → returns it (no migration)", () => {
  const dir = tmpDir("prog-mig-json-");
  const data = createEmptyProgress("");
  data.timeoutCount = 7;
  writeProgressJSON(dir, data);
  const p = migrateIfNeeded(dir);
  assert.equal(p.timeoutCount, 7);
  // progress.md should not be created
  assert.ok(!existsSync(path.join(dir, "progress.md")));
});

test("migrateIfNeeded: no progress.json, progress.md exists → migrates + writes json", () => {
  const dir = tmpDir("prog-mig-md-");
  writeFileSync(
    path.join(dir, "progress.md"),
    "# CDD ledger\n# timeoutCount: 4\nTask 1: complete\n",
  );
  const p = migrateIfNeeded(dir);
  assert.equal(p.timeoutCount, 4);
  assert.deepEqual(p.tasks[0], { task: 1, status: "complete" });
  // progress.json should now exist
  assert.ok(existsSync(path.join(dir, "progress.json")));
  // Verify the written json matches
  const json = JSON.parse(readFileSync(path.join(dir, "progress.json"), "utf8"));
  assert.equal(json.timeoutCount, 4);
});

test("migrateIfNeeded: neither file exists → returns empty progress + creates json", () => {
  const dir = tmpDir("prog-mig-empty-");
  const p = migrateIfNeeded(dir);
  assert.equal(p.timeoutCount, 0);
  assert.equal(p.plan, "");
  // Should create progress.json
  assert.ok(existsSync(path.join(dir, "progress.json")));
});

// ---- deriveProgressMD ----

test("deriveProgressMD: produces markdown with plan and tasks", () => {
  const data = {
    plan: "/plan.md",
    timeoutCount: 2,
    engineRecoveryCount: 1,
    tasks: [
      { task: 1, status: "complete" },
      { task: 2, status: "pending" },
    ],
    degradationLog: [],
  };
  const md = deriveProgressMD(data);
  assert.match(md, /## Plan/);
  assert.match(md, /\/plan\.md/);
  assert.match(md, /Task 1: complete/);
  assert.ok(!md.match(/Task 2: complete/), "pending task should not appear");
  assert.match(md, /## timeoutCount: 2/);
  assert.match(md, /## engine-recovery-count: 1/);
});

// ---- getRound ----

test("getRound: no prior rounds → returns 1", () => {
  const data = { tasks: [] };
  assert.equal(getRound(data, 1, "task-review"), 1);
});

test("getRound: completed round 2 → returns 3", () => {
  const data = { tasks: [{ task: 1, status: "pending", rounds: { "task-review": 2 } }] };
  assert.equal(getRound(data, 1, "task-review"), 3);
});

// ---- incrementRound ----

test("incrementRound: creates task entry + sets round 1", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "prog-"));
  writeFileSync(path.join(dir, "progress.json"), JSON.stringify({
    plan: "/p.md", timeoutCount: 0, engineRecoveryCount: 0,
    lastDispatchHead: "", tasks: [], degradationLog: [],
  }));
  incrementRound(dir, 1, "task-review");
  const data = readProgressJSON(dir);
  assert.equal(data.tasks[0].rounds["task-review"], 1);
});

test("incrementRound: BLOCKED handoff still increments round", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "prog-"));
  writeFileSync(path.join(dir, "progress.json"), JSON.stringify({
    plan: "/p.md", timeoutCount: 0, engineRecoveryCount: 0,
    lastDispatchHead: "", tasks: [{ task: 1, status: "pending", rounds: { "task-review": 1 } }], degradationLog: [],
  }));
  incrementRound(dir, 1, "task-review");
  const data = readProgressJSON(dir);
  assert.equal(data.tasks[0].rounds["task-review"], 2);
});
