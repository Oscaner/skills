#!/usr/bin/env node
// src/bin.ts — CDD engine CLI entry (spec §2.3; citty surface from Task 9, retired commander).
// The full command tree lives in src/cli/parse.mjs as one citty defineCommand (mainCommand with
// the four subcommands implement / review / fix / base-branch [set|get]). This file only boots
// it: `--help` pre-screen → root/proc bootstrap → runCommand → parse/usage error normalization
//（exit code table §2.4.2: 0 = OK incl. --help; 1 = dispatch failure / blocked; 2 = usage or
// parse error; 3 = review stopping —— citty's own parse errors exit 1, so this wrapper is what
// keeps the subroutine's documented table intact）.
//   cdd implement --task <n> [--plan <path>]
//   cdd review --type <task|branch|spec|plan> [...]
//   cdd fix --type <task|spec|plan> [...]
//   cdd base-branch <set|get> --plan <path> [...]
//
// 无条件 boot（无 isMain 守卫）：本产物只作为 CLI 入口被 node 直接执行（package.json 的
// bin/main/exports 均指向 dist/cli.mjs，无库消费者 import 面）；`unbuild --stub` 的 dist/cli.mjs
// 经 jiti 即时加载本文件，argv[1] 指向 dist/ 而 import.meta.url 指 src/，import.meta.url 判主恒为
// false —— 无条件 boot 是唯一可靠的方式（Task 1 §4.2 占位转发的同判）。首行 #! 使产物
//（build/stub 两态）可被无 node 前缀直跑（unbuild 原生透传，Task 1 §4.6）。
import process from "node:process";
import path from "node:path";

import { parseArgs, renderUsage, runCommand } from "citty";
import { initProcLifecycle, reapStale, teardownAll } from "./infra/proc.mjs";
import { mainCommand, MAIN_ARGS, usageError, commandUsageKey, deepestCommand } from "./cli/parse.mjs";
import { setDryRun } from "./cli/shared.mjs";
import { initRoot } from "./infra/root.mjs";
import { ExitRequested } from "./infra/exit.mjs";

// citty renders usage/help with ANSI color — this entry prints plain text (commander-era parity +
// deterministic test surface). Stripping happens at the two print points below, never via env
// mutation (the engine's env surface guard pins zero non-whitelisted reads).
const ANSI_RE = /[][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
function plain(text: unknown): string {
  return String(text).replace(ANSI_RE, "");
}

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

async function main() {
  const rawArgs = process.argv.slice(2);

  // `--help` / `-h` at ANY position is handled BEFORE the root bootstrap: cdd --help must exit 0
  // even outside a git repo (§2.4.2; root.test.mjs). Renders the deepest matched command's usage
  // from the citty declarations (deepestCommand → renderUsage), plain-texted.
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
    const [cmd, parent] = await deepestCommand(rawArgs);
    const rendered = await renderUsage(cmd, parent);
    process.stdout.write(plain(rendered) + "\n");
    process.exit(0);
  }

  // Boot（the former commander preAction hook，action 先决）: program-level `--dry-run` resolves
  // position-independent from the FULL argv (parseArgs over the main args def tolerates the
  // subcommand surface), then the engine root + process lifecycle are initialized once per run.
  // 流程：启动跨 run 兜底（回收上一次引擎被杀 SIGKILL/crash 残留的孤儿组）+ 信号安全出口
  //（spec §2.2 A / §2.6）。lifecycle 路径纯派生：单一 root 权威（src/infra/root.mjs）下的固定相对路径，
  // 无环境变量覆写缝、无启动 cwd 读取（P4 §2.4.1）。
  try {
    // Program-level --dry-run from the FULL argv (parseArgs is tolerant of the subcommand
    // surface; only the program-level key is read here). MAIN_ARGS is the same plain object the
    // tree's argument declaration uses — single source for the boot read (parse.mjs is a .mjs
    // module, so the plain def is handed over via the concrete ArgsDef shape parseArgs expects).
    const bootArgs = parseArgs(rawArgs, MAIN_ARGS as unknown as Parameters<typeof parseArgs>[1]);
    setDryRun(bootArgs["dry-run"] === true);
  } catch (e: unknown) {
    if (e instanceof ExitRequested) process.exit(e.code);
    process.stderr.write(`${(e as { message?: unknown })?.message ?? String(e)}\n`);
    process.exit(2);
  }
  const repoRoot = await initRoot();
  initProcLifecycle({ diskPath: path.join(repoRoot, ".osuperpowers", "cdd", "lifecycle.json") });
  await reapStale({ graceMs: 2000 });   // 启动兜底：跨 run 孤儿组连根回收（仍在任何 action / dispatch 之前）

  try {
    await runCommand(mainCommand, { rawArgs });
  } catch (raw: unknown) {
    // 正常 run* 退出路径：exit helpers throw ExitRequested（先展开 run 边界 try/finally →
    // teardownAll 连根回收），此处拦截 → process.exit(code)。直接 process.exit 是边界语义：
    // 已无 finally 需要展开。不回收则 spec §2.2 B「run 边界连根回收」在 CLI 主线成死代码
    //（进程 exit 不展开我们自己的 finally）。
    if (raw instanceof ExitRequested) process.exit(raw.code);
    const e = raw as { message?: unknown; name?: unknown };
    // citty parse/usage errors（CLIError name——含 guardArgs 的 CLIError 形未知 option 拒绝）:
    // usage 行（deepestCommand 解析出的命令上下文）+ citty/guard 消息 + exit 2。
    if (e && e.name === "CLIError") {
      const [cmd, parent] = await deepestCommand(rawArgs);
      usageError(commandUsageKey(cmd, parent));
      process.stderr.write(`${plain(e.message)}\n`);
    } else {
      // 非 CLIError 的 action/参数错误（如 intTask 抛的原始 Error）—— 既有语义统一 exit 2。
      process.stderr.write(`${e?.message ?? String(e)}\n`);
    }
    process.exit(2);
  }
}

main();