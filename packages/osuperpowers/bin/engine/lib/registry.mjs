// engine/lib/registry.mjs — CDD harness registry（Node port of cdd_check_harness /
// _cdd_registry_field，行为为准）。ship gate（D6-A1）：
//   unknown / not-supported → CddBlockedError（exitCode 1，kind "blocked"）；
//   CLI 存在校验失败 → CddBlockedError（exitCode 2，kind "cli-missing"）。
// runner.mjs（T2）捕获错误后调用 exit.mjs 的 exitBlocked / exitCliMissing 落地退出码；
// 本模块只抛结构化错误，不直接 process.exit（可单测、可组合）。
import { readFileSync, statSync } from "node:fs";
import path from "node:path";

export class CddBlockedError extends Error {
  constructor(message, { exitCode = 1, kind = "blocked" } = {}) {
    super(message);
    this.name = "CddBlockedError";
    this.exitCode = exitCode;
    this.kind = kind;
  }
}

// 读 harness-registry.json —— 对齐 _cdd_registry（registry 字段查找的上游）。
export function loadRegistry(regPath) {
  return JSON.parse(readFileSync(regPath, "utf8"));
}

// 读 harness 字段 —— 对齐 `jq -r '.[$h][$f] // empty'`：缺失回退空串。
export function registryField(reg, harness, field) {
  const entry = reg?.[harness];
  if (!entry) return "";
  return entry[field] ?? "";
}

// PATH 查找可执行文件 —— 对齐 cdd_check_cli 的 `command -v`。
// 导出供 cdd-select.mjs（T3）复用 —— 检测已装 harness CLI 的单一来源。
export function cliInPath(cli) {
  const pathDirs = (process.env.PATH ?? "").split(path.delimiter);
  for (const dir of pathDirs) {
    if (!dir) continue;
    try {
      const st = statSync(path.join(dir, cli));
      if (st.isFile() && (st.mode & 0o111) !== 0) return true;
    } catch {
      // 该目录无此二进制 —— 继续
    }
  }
  return false;
}

// Registry ship gate + CLI preflight（对齐 cdd_check_harness 顺序：先 ship gate，
// 后 CLI 校验）。返回解析到的 harness 条目（含 cli）。opts.dryRun 跳过 PATH 校验
// （对齐 CDD_DRY_RUN=1 —— 参数解析/编排冒烟测试不得依赖真实 CLI 二进制）。
export function checkHarness(reg, harness, opts = {}) {
  const { dryRun = false } = opts ?? {};
  const entry = reg?.[harness];
  if (!entry) throw new CddBlockedError(`unknown harness: ${harness}`, { exitCode: 1 });
  if (entry.ship !== "full") throw new CddBlockedError(`harness not supported: ${harness}`, { exitCode: 1 });
  const cli = entry.cli;
  if (!cli) throw new CddBlockedError(`unknown harness: ${harness}`, { exitCode: 1 });
  if (!dryRun && !cliInPath(cli)) {
    throw new CddBlockedError(`${cli} not found in PATH`, { exitCode: 2, kind: "cli-missing" });
  }
  return entry;
}
