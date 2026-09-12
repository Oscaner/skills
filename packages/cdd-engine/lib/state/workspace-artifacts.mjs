// engine/lib/state/workspace-artifacts.mjs — workspace artifact 单一权威层（P5 spec §2.2）。
// base-branch 与 brief 的路径解析 + schema 校验唯一落点：一份实现消灭 base-branch.md
// 3↔4 值漂移（source enum 以 SKILL schema 4 值为准：plan-field / branch-upstream /
// conversation-context / user-confirmed）。orchestrator 零写入 —— 一律经 writeBaseBranch。
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

// BASE_BRANCH_SOURCES：source 字段 4 值 enum 的唯一定义（canonical）。
// 修正 base-branch.md schema 表 3 值缺 conversation-context 之漂移（SKILL schema 为准）。
export const BASE_BRANCH_SOURCES = [
  "plan-field",
  "branch-upstream",
  "conversation-context",
  "user-confirmed",
];

export function baseBranchPath({ workspace }) {
  return path.join(workspace, "base-branch.json");
}

// briefPath：与 run-task.mjs CDD_TASK_BRIEF 默认值同一派生（`<ws>/task-<N>-brief.md`），单一真相。
export function briefPath({ workspace, task }) {
  return path.join(workspace, `task-${task}-brief.md`);
}

// validateBaseBranch(obj) → {ok:true} | {ok:false, errors: []}。
// schema：{ base: 非空 string, source: enum(4 值) }；confirmed_at 由 writeBaseBranch 恒定写 ISO，
// 读取侧语义权威是 base，不额外校验时间戳格式。
export function validateBaseBranch(obj) {
  const errors = [];
  if (!obj || typeof obj.base !== "string" || obj.base === "") {
    errors.push("base is required and must be a non-empty string");
  }
  if (!BASE_BRANCH_SOURCES.includes(obj?.source)) {
    errors.push(`source must be one of: ${BASE_BRANCH_SOURCES.join(", ")}`);
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}

// writeBaseBranch({base, source, workspace, force}) — engine 唯一写入口（幂等矩阵）：
//   不存在            → 写 + confirmed_at=now；
//   存在且 base 同    → 重写文件但 base 权威不变（source 追新、confirmed_at 保真——语义上等价 no-op）；
//   存在且 base 异    → throw 拒绝（不动现有权威），force 才覆盖（新 base → 新 confirmed_at）。
// 写前 mkdirSync(dirname, {recursive:true}) 做 workspace 目录 bootstrap —— determine-base
// 在 implement 前跑，workspace 目录届时尚不存在（naming.resolveWorkspace 不 mkdir），
// 否则首秀 set 即 ENOENT。返回目标路径。
export function writeBaseBranch({ base, source, workspace, force = false }) {
  const target = baseBranchPath({ workspace });
  const existing = existsSync(target) ? JSON.parse(readFileSync(target, "utf8")) : null;
  const sameBase = !!existing && existing.base === base;
  if (existing && !sameBase && !force) {
    throw new Error(
      `existing base-branch "${existing.base}" differs from requested "${base}"; set --force to override`,
    );
  }
  // base 权威不变（同 base）→ 保真原 confirmed_at 与主体；异 base + force → 新确认时间戳。
  const confirmed_at = sameBase ? existing.confirmed_at : new Date().toISOString();
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify({ base, source, confirmed_at }, null, 2));
  return target;
}