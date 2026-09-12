// packages/cdd-engine/tests/workspace-artifacts.test.mjs
// workspace-artifacts 单一权威层 unit tests（P5 spec §2.2 / task-2 brief）。
// Tests: baseBranchPath / briefPath 路径派生 + validateBaseBranch schema 校验 +
// writeBaseBranch 幂等矩阵（新建 / 同 base 追新 / 异 base 拒绝 / --force 覆盖 / dir bootstrap）。
import { it, expect } from 'vitest';
import { existsSync, readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  BASE_BRANCH_SOURCES,
  baseBranchPath,
  briefPath,
  validateBaseBranch,
  writeBaseBranch,
} from "../lib/state/workspace-artifacts.mjs";

function tmpDir(prefix) {
  return mkdtempSync(path.join(tmpdir(), prefix));
}

function readBaseBranch(workspace) {
  return JSON.parse(readFileSync(baseBranchPath({ workspace }), "utf8"));
}

const VALID = { base: "develop", source: "plan-field", confirmed_at: "2026-09-12T10:00:00.000Z" };

// ---- 路径派生 ----

it("baseBranchPath: returns <workspace>/base-branch.json", () => {
  expect(baseBranchPath({ workspace: "/ws" })).toBe("/ws/base-branch.json");
});

it("briefPath: returns <workspace>/task-<N>-brief.md", () => {
  expect(briefPath({ workspace: "/ws", task: 1 })).toBe("/ws/task-1-brief.md");
  expect(briefPath({ workspace: "/ws", task: 2 })).toBe("/ws/task-2-brief.md");
});

// ---- validateBaseBranch schema 校验（SKILL base-branch schema 4 值为准 — 修正 base-branch.md 3↔4 漂移）----

it("BASE_BRANCH_SOURCES: 4 值 const 与 SKILL schema 一致", () => {
  expect(BASE_BRANCH_SOURCES).toEqual([
    "plan-field",
    "branch-upstream",
    "conversation-context",
    "user-confirmed",
  ]);
});

it("validateBaseBranch: 合法对象 → {ok:true}", () => {
  expect(validateBaseBranch(VALID)).toEqual({ ok: true });
});

it("validateBaseBranch: 非法 source → {ok:false, errors} 含具体 message", () => {
  const res = validateBaseBranch({ ...VALID, source: "conversation" });
  expect(res.ok).toBe(false);
  expect(res.errors.length).toBeGreaterThan(0);
  expect(res.errors.some((m) => m.includes("source"))).toBe(true);
  expect(res.errors.some((m) => m.includes("plan-field"))).toBe(true);
});

it("validateBaseBranch: 缺 base → {ok:false, errors}", () => {
  const { base, ...missingBase } = VALID;
  const res = validateBaseBranch(missingBase);
  expect(res.ok).toBe(false);
  expect(res.errors.some((m) => m.includes("base"))).toBe(true);
});

it("validateBaseBranch: base 空串 → {ok:false, errors}", () => {
  const res = validateBaseBranch({ ...VALID, base: "" });
  expect(res.ok).toBe(false);
  expect(res.errors.some((m) => m.includes("non-empty"))).toBe(true);
});

// ---- writeBaseBranch 幂等矩阵 ----

it("writeBaseBranch: 不存在 → 写 + confirmed_at ISO + workspace dir bootstrap", () => {
  // workspace 目录尚不存在（determine-base 在 implement 前跑，run-task 仅本地惰性建）——
  // 写入前 mkdirSync(dirname, {recursive:true})，否则首秀 set 即 ENOENT。
  const workspace = path.join(tmpDir("ws-art-none-"), "ws-does-not-exist", "nested");
  const wrote = writeBaseBranch({ base: "develop", source: "plan-field", workspace });
  expect(existsSync(wrote)).toBe(true);
  const saved = readBaseBranch(workspace);
  expect(saved.base).toBe("develop");
  expect(saved.source).toBe("plan-field");
  expect(saved.confirmed_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});

it("writeBaseBranch: 同 base → source 追新 / base+confirmed_at 保真（不破坏权威）", () => {
  const workspace = tmpDir("ws-art-same-");
  writeBaseBranch({ base: "develop", source: "plan-field", workspace });
  const first = readBaseBranch(workspace);
  writeBaseBranch({ base: "develop", source: "branch-upstream", workspace });
  const second = readBaseBranch(workspace);
  expect(second.base).toBe("develop");
  expect(second.source).toBe("branch-upstream");
  expect(second.confirmed_at).toBe(first.confirmed_at);
  // 语义权威不被破坏（base 才是 authority，source 仅最新确认来源）
  expect(second).toEqual({ ...first, source: "branch-upstream" });
});

it("writeBaseBranch: 异 base 无 force → reject 且不落盘（不动现有权威）", () => {
  const workspace = tmpDir("ws-art-diff-");
  writeBaseBranch({ base: "develop", source: "plan-field", workspace });
  expect(() => writeBaseBranch({ base: "main", source: "user-confirmed", workspace }))
    .toThrow(/base-branch/);
  // 拒绝后原 artifact 不变
  expect(readBaseBranch(workspace).base).toBe("develop");
});

it("writeBaseBranch: --force → 覆盖（新 base + 新 confirmed_at）", () => {
  const workspace = tmpDir("ws-art-force-");
  writeBaseBranch({ base: "develop", source: "plan-field", workspace });
  writeBaseBranch({ base: "main", source: "user-confirmed", workspace, force: true });
  const saved = readBaseBranch(workspace);
  expect(saved.base).toBe("main");
  expect(saved.source).toBe("user-confirmed");
  expect(saved.confirmed_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});