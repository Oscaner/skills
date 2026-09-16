#!/usr/bin/env node
// bin/cdd.mjs — thin entry (spec §2.3): all command definitions live in lib/cli/parse.mjs
// (review/fix actions + shared harness/Stopping guards in lib/cli/*). Zero command
// definitions here — this file only boots the registered program and normalizes Commander errors.
//   cdd implement --task <n> [--plan <path>]
//   cdd review --type <task|branch|spec|plan> [...]
//   cdd fix --type <task|spec|plan> [...]
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { realpathSync } from "node:fs";
import path from "node:path";

import { initProcLifecycle, reapStale, teardownAll } from "../lib/lifecycle/proc.mjs";
import { program, usageError } from "../lib/cli/parse.mjs";
import { setDryRun } from "../lib/cli/shared.mjs";
import { initRoot } from "../lib/root.mjs";
import { ExitRequested } from "../lib/exit.mjs";

// Only parse argv when executed as the main entry (imports from tests must be inert).
const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
if (isMain) {
  // root 首次被需要时初始化：--help 由 commander 在 preAction 之前处理并 exit 0
  //（§2.4.2 退出码表：0 = OK 含 --help，**不含 --version**——`parse.mjs` 无 `.version()` 声明，
  //  `cdd --version` 是 unknown option → exit 2）——initRoot() 不得无条件前置于 parseAsync。
  // 进程生命周期：启动跨 run 兜底（回收上一次引擎被杀 SIGKILL/crash 残留的孤儿组）+ 信号安全出口
  //（spec §2.2 A / §2.6）。lifecycle 路径纯派生：单一 root 权威（lib/root.mjs）下的固定相对路径，
  // 无环境变量覆写缝、无启动 cwd 读取（P4 §2.4.1）。
  program.hook("preAction", async () => {
    // program 级 `--dry-run` 的唯一解析点：声明在 lib/cli/parse.mjs，读取在此（零命令定义）。
    setDryRun(program.opts().dryRun === true);
    const repoRoot = initRoot();
    initProcLifecycle({ diskPath: path.join(repoRoot, ".osuperpowers", "cdd", "lifecycle.json") });
    await reapStale({ graceMs: 2000 });   // 启动兜底：跨 run 孤儿组连根回收（仍在任何 action / dispatch 之前）
  });

  // 信号安全出口：SIGINT/SIGTERM/SIGHUP → teardownAll → 按信号映射的退出码退出。
  // 退出码 = 128 + signo，对齐 shell 约定（SIGINT=2→130、SIGTERM=15→143、SIGHUP=1→129）——
  // 一律 130 仅对 SIGINT 成立，SIGTERM/SIGHUP 须各按 128+signo 定，不得复用常量 130。
  const SIGNAL_EXIT = { SIGINT: 130, SIGTERM: 143, SIGHUP: 129 };
  for (const [sig, code] of Object.entries(SIGNAL_EXIT)) {
    process.on(sig, async () => {
      process.stderr.write(`CDD: caught ${sig} — teardownAll + exit ${code}\n`);
      try { await teardownAll({ graceMs: 2000 }); } finally { process.exit(code); }
    });
  }

  program.parseAsync(process.argv).catch((e) => {
    // 正常 run* 退出路径：exit helpers throw ExitRequested（先展开 run 边界 try/finally →
    // teardownAll 连根回收），此处拦截 → process.exit(code)。直接 process.exit 是边界语义：
    // 已无 finally 需要展开。不回收则 spec §2.2 B「run 边界连根回收」在 CLI 主线成死代码
    //（进程 exit 不展开我们自己的 finally）。
    if (e instanceof ExitRequested) process.exit(e.code);
    // Commander parse/usage errors (missing required option, unknown option, unknown command, ...) → usage + exit 2。
    if (e.code === "commander.helpDisplayed") process.exit(0);
    if (typeof e.code === "string" && e.code.startsWith("commander.")) {
      usageError(process.argv[2]);
    } else {
      // 非 ExitRequested 的 action/参数错误（如 intTask 抛的原始 Error）—— 既有语义统一 exit 2。
      process.stderr.write(`${e.message}\n`);
    }
    process.exit(2);
  });
}
