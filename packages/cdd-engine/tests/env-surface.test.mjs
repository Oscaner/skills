// packages/cdd-engine/tests/env-surface.test.mjs — 引擎 env 面闭集守卫（P4 §2.4.4）。
// 三断言：① 取值直读键 ⊆ 七键白名单；② 零 `...process.env` spread 注入；③ 六个已删键名零命中。
// 闭集口径 = spec §2.4.4 ①：host 识别 3 键 + PATH + 3 个 timeout 键 —— 引擎只读这些，
// 其余一切派生值（workspace/handoff/brief/ledger/constraints/findings/plan）走 ctx 参数面。
import { describe, it, expect } from "vitest";
import { execaSync } from "execa";
import { readFileSync } from "node:fs";
import path from "node:path";
import { loadContract } from "../src/infra/context.ts";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");

// spec §2.4.4 ① 的闭集（7 键：3 宿主识别 + PATH + 3 timeouts）—— 由 canonical
// `channels.env` 派生：`templates/context-contract.json` 是白名单的**唯一**声明点，
// 本文件不留第二份字面（改 canonical 即改守卫，T4 同源）。
const ALLOWED = Object.values(loadContract().channels.env).flatMap(v => (v.var ? [v.var] : v.markers));
// AC3 的六键零命中（键名，含注释与 spread 形）
const DELETED = ["CDD_LIFECYCLE_PATH", "CDD_REGISTRY_PATH", "NODE_ENV", "CDD_DRY_RUN", "PLAN_FILE", "CDD_HANDOFF_PATH"];

const sh = (cmd) => execaSync("bash", ["-lc", cmd], { cwd: REPO_ROOT, encoding: "utf8" }).stdout.trim();

describe("engine env 面收口", () => {
  it("取值直读键 ⊆ 白名单（覆盖 process.env.X / process.env[\"X\"] / env.X 三形）", () => {
    const files = sh(`find packages/cdd-engine/src -name '*.mjs'`).split("\n").filter(Boolean);
    const hits = new Set();
    for (const f of files) {
      const src = readFileSync(path.join(REPO_ROOT, f), "utf8");
      // 第三支 `(?:^|[^.\w])env\.X` 覆盖 run-task.mjs 收口前的 env.CDD_* 形；前缀约束排除 process.env.X 与 childEnv.X 误伤
      for (const m of src.matchAll(/process\.env\.([A-Z_][A-Z0-9_]*)|process\.env\[["']([A-Z_][A-Z0-9_]*)["']\]|(?:^|[^.\w])env\.([A-Z_][A-Z0-9_]*)/g)) {
        hits.add(m[1] ?? m[2] ?? m[3]);
      }
    }
    expect([...hits].filter(k => !ALLOWED.includes(k))).toEqual([]);
  });
  it("零 spread 注入（{ ...process.env, … }）", () => {
    expect(sh(`grep -rnE '\\.\\.\\.process\\.env' packages/cdd-engine/src | wc -l`)).toBe("0");
  });
  it("六个已删键名零命中（PLAN_FILE 含在内——故 PLAN_LINE 由显式 planFile 参数派生）", () => {
    expect(sh(`grep -rnE '${DELETED.join("|")}' packages/cdd-engine/src | wc -l`)).toBe("0");
  });
});
