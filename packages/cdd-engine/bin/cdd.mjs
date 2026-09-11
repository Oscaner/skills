#!/usr/bin/env node
// bin/cdd.mjs — thin entry (spec §2.3): all command definitions live in lib/cli/parse.mjs
// (review/fix/research actions + shared harness/Stopping guards in lib/cli/*). Zero command
// definitions here — this file only boots the registered program and normalizes Commander errors.
//   cdd implement --task <n> [--plan <path>]
//   cdd review --type <task|branch|spec|plan> [...]
//   cdd fix --type <task|spec|plan> [...]
//   cdd research --brief <path> --output <path>
//   cdd brief --task <n> --plan <path> [--output <path>]
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { realpathSync } from "node:fs";
import path from "node:path";

import { initProcLifecycle, reapStale, teardownAll } from "../lib/lifecycle/proc.mjs";
import { program, usageError } from "../lib/cli/parse.mjs";
import { exitOk, exitCliMissing } from "../lib/exit.mjs";

// Only parse argv when executed as the main entry (imports from tests must be inert).
const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
if (isMain) {
  // 进程生命周期：启动跨 run 兜底（回收上一次引擎被杀 SIGKILL/crash 残留的孤儿组）+ 信号安全出口
  //（spec §2.2 A / §2.6）。CDD_LIFECYCLE_PATH 覆盖（spec 定案：测试/多进程并发注入唯一路径）；
  // 生产默认 <cwd>/.superpowers/cdd/lifecycle.json（相对启动 cwd，跨 run 复用）。
  const cwd = process.cwd();
  const lifecyclePath = process.env.CDD_LIFECYCLE_PATH ?? path.join(cwd, ".superpowers", "cdd", "lifecycle.json");
  initProcLifecycle({ diskPath: lifecyclePath });
  await reapStale({ graceMs: 2000 });   // 启动兜底：跨 run 孤儿组连根回收（幂等，空盘 no-op）

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
    if (e.code === "commander.helpDisplayed") {
      exitOk();
    }
    // Commander parse/usage errors (missing required option, unknown option, unknown command, ...) → usage + exit 2.
    if (typeof e.code === "string" && e.code.startsWith("commander.")) {
      usageError(process.argv[2]);
    } else {
      // Action errors → error message + exit 2.
      process.stderr.write(`${e.message}\n`);
    }
    exitCliMissing();
  });
}