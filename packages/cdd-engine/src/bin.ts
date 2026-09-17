#!/usr/bin/env node
// src/bin.ts — CDD engine CLI entry（spec §2.3；ex bin/cdd.mjs，P5 Task 3 真实现替换 Task 1 占位转发）。
// 薄入口语义不变：所有命令定义在 src/cli/parse.mjs（review/fix actions + shared harness/Stopping
// guards in src/cli/*）。Zero command definitions here — this file only boots the registered program
// and normalizes Commander errors.
//   cdd implement --task <n> [--plan <path>]
//   cdd review --type <task|branch|spec|plan> [...]
//   cdd fix --type <task|spec|plan> [...]
//
// 无条件 boot（无 isMain 守卫）：本产物只作为 CLI 入口被 node 直接执行（package.json 的
// bin/main/exports 均指向 dist/cli.mjs，无库消费者 import 面）；`unbuild --stub` 的 dist/cli.mjs
// 经 jiti 即时加载本文件，argv[1] 指向 dist/ 而 import.meta.url 指 src/，import.meta.url 判主恒为
// false —— 无条件 boot 是唯一可靠的方式（Task 1 §4.2 占位转发的同判）。首行 #! 使产物
//（build/stub 两态）可被无 node 前缀直跑（unbuild 原生透传，Task 1 §4.6）。
import process from "node:process";
import path from "node:path";

import { initProcLifecycle, reapStale, teardownAll } from "./infra/proc.mjs";
import { program, usageError } from "./cli/parse.mjs";
import { setDryRun } from "./cli/shared.mjs";
import { initRoot } from "./infra/root.mjs";
import { ExitRequested } from "./infra/exit.mjs";

// root 首次被需要时初始化：--help 由 commander 在 preAction 之前处理并 exit 0
//（§2.4.2 退出码表：0 = OK 含 --help，**不含 --version**——`parse.mjs` 无 `.version()` 声明，
//  `cdd --version` 是 unknown option → exit 2）——initRoot() 不得无条件前置于 parseAsync。
// 进程生命周期：启动跨 run 兜底（回收上一次引擎被杀 SIGKILL/crash 残留的孤儿组）+ 信号安全出口
//（spec §2.2 A / §2.6）。lifecycle 路径纯派生：单一 root 权威（src/infra/root.mjs）下的固定相对路径，
// 无环境变量覆写缝、无启动 cwd 读取（P4 §2.4.1）。
program.hook("preAction", async () => {
  // program 级 `--dry-run` 的唯一解析点：声明在 src/cli/parse.mjs，读取在此（零命令定义）。
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

program.parseAsync(process.argv).catch((raw: unknown) => {
  // raw: unknown（Promise.catch 形参经严格模式带类型）。ExitRequested 经 instanceof 判定（不依赖
  // 字段访问）；其后访问 code/message 前给最小形状断言，分支语义与原 JS 逐条一致（未改逻辑）。
  const e = raw as { code?: unknown; message?: unknown };
  // 正常 run* 退出路径：exit helpers throw ExitRequested（先展开 run 边界 try/finally →
  // teardownAll 连根回收），此处拦截 → process.exit(code)。直接 process.exit 是边界语义：
  // 已无 finally 需要展开。不回收则 spec §2.2 B「run 边界连根回收」在 CLI 主线成死代码
  //（进程 exit 不展开我们自己的 finally）。
  if (raw instanceof ExitRequested) process.exit(raw.code);
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