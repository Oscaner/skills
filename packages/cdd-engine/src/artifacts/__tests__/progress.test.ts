// engine/tests/progress.test.mjs — progress.json module unit tests.
// Tests: read/write/create/migrate/migrateIfNeeded + deriveProgressMD + getRound/incrementRound.
import { it, expect, describe } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

import { gitInit, gitCommit } from "../../infra/__tests__/helpers.ts";
import {
  readProgressJSON,
  writeProgressJSON,
  createEmptyProgress,
  migrateFromProgressMD,
  migrateIfNeeded,
  getRound,
  incrementRound,
  taskScopeBase,
  seedScopeBase,
  moveTaskScopeBaseEarlier,
} from "../progress.ts";

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

it("progress schema 不含 lastDispatchHead/degradationLog（T8 死字段清除）——T6 增两键后为六键词法序", () => {
  // Object.keys 词法排序 —— 期望字面量用词法序，勿用插入序断言。
  // T6（AC14「存储层落库形」）：progress.json 键集 = createEmptyProgress 初值形 + migrateIfNeeded
  // 存量补齐形 二者共同承载 —— 六键与 canonical 计数器列逐字一致（contractViolationCount <
  // engineRecoveryCount < engineSelfWrittenCount < plan < tasks < timeoutCount）。
  expect(Object.keys(createEmptyProgress("/p")).sort())
    .toEqual(["contractViolationCount", "engineRecoveryCount", "engineSelfWrittenCount", "plan", "tasks", "timeoutCount"]);
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
  data.tasks = [{ task: 1 }];
  writeProgressJSON(dir, data);
  const p = readProgressJSON(dir);
  expect(p.timeoutCount).toBe(5);
  expect(p.tasks).toEqual([{ task: 1 }]);
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

it("writeProgressJSON: write-back strips tasks[N].status (T30 ② single-source — state pure-derivation, ledger keeps facts only)", () => {
  const dir = tmpDir("prog-strip-status-");
  // A legacy row carrying the retired status field converges to the new schema on any write-back.
  const data = createEmptyProgress("");
  data.tasks = [{ task: 1, status: "complete", rounds: { review: 1 } }];
  writeProgressJSON(dir, data);
  const written = JSON.parse(readFileSync(path.join(dir, "progress.json"), "utf8"));
  expect(written.tasks[0]).toEqual({ task: 1, rounds: { review: 1 } });
  expect(written.tasks[0]).not.toHaveProperty("status");
});

it("readProgressJSON: legacy row with status loads with zero error (migration-compatible — status ignored, never blocks derivation)", () => {
  const dir = tmpDir("prog-legacy-status-");
  // Raw disk write simulating an old-engine product (tasks[N].status present) — the read path
  // neither strips nor fails on it.
  writeFileSync(
    path.join(dir, "progress.json"),
    JSON.stringify({
      plan: "/p.md",
      timeoutCount: 0,
      engineRecoveryCount: 0,
      tasks: [{ task: 1, status: "complete", rounds: { review: 1 } }],
    }, null, 2),
  );
  const p = readProgressJSON(dir);
  expect(p.plan).toBe("/p.md");
  expect(p.tasks[0].task).toBe(1);
  expect(p.tasks[0].rounds).toEqual({ review: 1 });
  // Where the status field ends up is the write path's call (writeProgressJSON GC); the read path
  // only guarantees no error.
  expect(p.tasks[0]).toHaveProperty("status");
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
  expect(p.tasks[0]).toEqual({ task: 1 });
  expect(p.tasks[1]).toEqual({ task: 2 });
  expect(p.tasks[2]).toEqual({ task: 3 });
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
  expect(p.tasks[0]).toEqual({ task: 1 });
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

// The migration "backfill" needs a real landing spot (T6 Step 5-3): the legacy four-key shape must
// gain the two new keys when read. Asserting only the in-memory object (without asserting the
// write-back) would let a "backfilled-but-not-persisted" shape pass (the next read misses the
// keys); asserting only key presence, not value 0, lets "backfilled-with-undefined" pass too —
// both the in-memory and the on-disk shapes must be asserted.
it("migrateIfNeeded: 存量四键旧形 → 补齐两键并回写（内存对象 + 磁盘双断言）", () => {
  const dir = tmpDir("prog-mig-backfill-");
  writeFileSync(path.join(dir, "progress.json"), JSON.stringify({
    plan: "/p.md",
    timeoutCount: 3,
    engineRecoveryCount: 2,
    tasks: [{ task: 1, status: "complete" }],
  }, null, 2));
  const p = migrateIfNeeded(dir);
  // 内存形：两键已补齐且值为 0；存量值不受影响
  expect(p.contractViolationCount).toBe(0);
  expect(p.engineSelfWrittenCount).toBe(0);
  expect(p.timeoutCount).toBe(3);
  expect(p.engineRecoveryCount).toBe(2);
  expect(p.tasks).toEqual([{ task: 1, status: "complete" }]);
  // 磁盘形：已被回写为六键
  const disk = JSON.parse(readFileSync(path.join(dir, "progress.json"), "utf8"));
  expect(Object.keys(disk).sort())
    .toEqual(["contractViolationCount", "engineRecoveryCount", "engineSelfWrittenCount", "plan", "tasks", "timeoutCount"]);
  expect(disk.contractViolationCount).toBe(0);
  expect(disk.engineSelfWrittenCount).toBe(0);
});

// ---- The rounds key is normalized ("review" is the sole task-mode key) — the progress layer is already mode-parameterized, so tests assert the key semantics directly (T4) ----

it("getRound: incrementRound('review') 后 round=2（rounds['review'] 归一键）", () => {
  const dir = tmpDir("prog-round-review-");
  expect(getRound(readProgressJSON(dir), 1, "review")).toBe(1);
  incrementRound(dir, 1, "review");
  expect(getRound(readProgressJSON(dir), 1, "review")).toBe(2);
  const saved = JSON.parse(readFileSync(path.join(dir, "progress.json"), "utf8"));
  expect(saved.tasks[0].rounds).toEqual({ review: 1 });
});

// ---- The scope ledger (spec T7.6): tasks[N].scope_base — the task-level scope anchor; the engine is the ledger's sole writer (T27) ----
// Semantics: the seed is the brief TASK_BASE materialized by the first-round implement
// (earliest-wins — no later-round TASK_BASE snapshot overrides an existing valid value); a
// recovery-declared base may only move the ledger strictly earlier (must remain a HEAD ancestor).
// A missing ledger reads back as null (the dispatch layer then falls back to the legacy
// prev.commits.base chain).
describe("progress.ts scope 账本（T27/spec T7.6）", () => {
  // 3-commit 线性仓库：c0(init) → c1(second) → c2(third=HEAD)。ancestor 关系供裁决用。
  function threeCommitRepo(): { repo: string; c0: string; c1: string; c2: string } {
    const repo = tmpDir("prog-scope-repo-");
    gitInit(repo);
    const c0 = execFileSync("git", ["-C", repo, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    writeFileSync(path.join(repo, "a.txt"), "a\n");
    gitCommit(repo, "second");
    const c1 = execFileSync("git", ["-C", repo, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    writeFileSync(path.join(repo, "b.txt"), "b\n");
    gitCommit(repo, "third");
    const c2 = execFileSync("git", ["-C", repo, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    return { repo, c0, c1, c2 };
  }

  it("taskScopeBase: 账本缺失 → null；task 存在但无 scope_base → null；既有合法值 → 该值", () => {
    const dir = tmpDir("prog-scope-read-");
    expect(taskScopeBase(dir, 7)).toBeNull();
    const data = readProgressJSON(dir);
    data.tasks = [{ task: 7, rounds: {} }];
    writeProgressJSON(dir, data);
    expect(taskScopeBase(dir, 7)).toBeNull();
    data.tasks[0].scope_base = "a".repeat(40);
    writeProgressJSON(dir, data);
    expect(taskScopeBase(dir, 7)).toBe("a".repeat(40));
  });

  it("taskScopeBase: 非法存量值（非 40-hex）→ null（账本视为缺失，回落 legacy 链）", () => {
    const dir = tmpDir("prog-scope-invalid-");
    const data = readProgressJSON(dir);
    data.tasks = [{ task: 3, rounds: {}, scope_base: "junk-not-a-sha" }];
    writeProgressJSON(dir, data);
    expect(taskScopeBase(dir, 3)).toBeNull();
  });

  it("seedScopeBase: 首次 seed 落账本（创建 task 条目+写盘）；earliest-wins——重复 seed 不覆盖", () => {
    const dir = tmpDir("prog-scope-seed-");
    expect(seedScopeBase(dir, 1, "a".repeat(40))).toBe("a".repeat(40));
    // 第二次 seed（不同值）被拒 —— 既有合法值永远赢
    expect(seedScopeBase(dir, 1, "b".repeat(40))).toBe("a".repeat(40));
    expect(taskScopeBase(dir, 1)).toBe("a".repeat(40));
    const saved = JSON.parse(readFileSync(path.join(dir, "progress.json"), "utf8"));
    expect(saved.tasks[0]).toEqual({ task: 1, scope_base: "a".repeat(40) });
    // 非 40-hex 的 seed 输入 → 拒绝（不写）
    expect(seedScopeBase(dir, 1, "not-a-sha")).toBe("a".repeat(40));
  });

  it("seedScopeBase: 非法存量值可被首次合法 seed 覆盖（脏账本自愈），合法值仍 earliest-wins", () => {
    const dir = tmpDir("prog-scope-seed-heal-");
    const data = readProgressJSON(dir);
    data.tasks = [{ task: 4, rounds: {}, scope_base: "junk" }];
    writeProgressJSON(dir, data);
    expect(seedScopeBase(dir, 4, "c".repeat(40))).toBe("c".repeat(40));
    // 自愈后进入 earliest-wins：再 seed 不覆盖
    expect(seedScopeBase(dir, 4, "d".repeat(40))).toBe("c".repeat(40));
    expect(taskScopeBase(dir, 4)).toBe("c".repeat(40));
  });

  it("moveTaskScopeBaseEarlier: 严格更早的祖先（仍是 HEAD 祖先）→ 账本前移", async () => {
    const { repo, c0, c1, c2 } = threeCommitRepo();
    const dir = tmpDir("prog-scope-move-");
    seedScopeBase(dir, 2, c1);
    expect(await moveTaskScopeBaseEarlier(dir, 2, c0, repo, c2)).toBe(c0);
    expect(taskScopeBase(dir, 2)).toBe(c0);
  });

  it("moveTaskScopeBaseEarlier: 后裔/更晚提交被拒（非 current 祖先）；即使它是 HEAD 祖先", async () => {
    const { repo, c0, c1, c2 } = threeCommitRepo();
    const dir = tmpDir("prog-scope-move-desc-");
    seedScopeBase(dir, 2, c0);
    // c1 是 c2(HEAD) 的祖先、但相对账本值 c0 是后裔 → 被拒，账本不动
    expect(await moveTaskScopeBaseEarlier(dir, 2, c1, repo, c2)).toBe(c0);
    expect(taskScopeBase(dir, 2)).toBe(c0);
  });

  it("moveTaskScopeBaseEarlier: ==head 被拒（Reset/cheat 面）", async () => {
    const { repo, c0, c1, c2 } = threeCommitRepo();
    const dir = tmpDir("prog-scope-move-head-");
    seedScopeBase(dir, 2, c0);
    expect(await moveTaskScopeBaseEarlier(dir, 2, c2, repo, c2)).toBe(c0);
    expect(taskScopeBase(dir, 2)).toBe(c0);
    // c1 已是 current 自身 → 相等被拒（无变化）
    seedScopeBase(dir, 5, c1);
    expect(await moveTaskScopeBaseEarlier(dir, 5, c1, repo, c2)).toBe(c1);
  });

  it("moveTaskScopeBaseEarlier: 非祖先伪造（另一个仓库的 commit，与其 init 同形）被拒——祖先校验拒伪造", async () => {
    const { repo, c1, c2 } = threeCommitRepo();
    // 伪造仓的 HEAD 不能与主仓任一 commit 内容同构（同一秒同一身份的空提交 = 同一对象）：
    // 写一个实际文件再 commit，保证是结构上不同于主仓任何 commit 的对象。
    const forge = tmpDir("prog-scope-forge-");
    gitInit(forge);
    writeFileSync(path.join(forge, "forged.txt"), "forged\n");
    gitCommit(forge, "forged work");
    const forgeHead = execFileSync("git", ["-C", forge, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    expect(forgeHead).not.toBe(c1);
    const dir = tmpDir("prog-scope-move-forge-");
    seedScopeBase(dir, 2, c1);
    expect(await moveTaskScopeBaseEarlier(dir, 2, forgeHead, repo, c2)).toBe(c1);
    expect(taskScopeBase(dir, 2)).toBe(c1);
  });

  it("moveTaskScopeBaseEarlier: 账本缺失 → 以候选为种子（回落路径）", async () => {
    const { repo, c0, c2 } = threeCommitRepo();
    const dir = tmpDir("prog-scope-move-missing-");
    expect(await moveTaskScopeBaseEarlier(dir, 2, c0, repo, c2)).toBe(c0);
    expect(taskScopeBase(dir, 2)).toBe(c0);
  });
});
