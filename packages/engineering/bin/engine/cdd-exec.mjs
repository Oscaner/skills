#!/usr/bin/env node
// cdd-exec.mjs — run one prompt via a chosen harness CLI, print normalized output.
// Node port of cdd-exec.sh; thin shell reusing registry.mjs ship gate + runner.mjs
// invokeCli（registry output 模式归一化：text passthrough / stream-json last finalText）。
//
//   usage: cdd-exec.mjs --harness <name> --prompt <text>
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadRegistry, checkHarness, CddBlockedError } from "./lib/registry.mjs";
import { invokeCli } from "./lib/runner.mjs";

const NAME = path.basename(fileURLToPath(import.meta.url));
const REG_PATH = fileURLToPath(new URL("./harness-registry.json", import.meta.url));

function usage() {
  process.stderr.write(`usage: ${NAME} --harness <name> --prompt <text>\n`);
  process.exit(2);
}

const args = process.argv.slice(2);
let harness = "";
let prompt = "";

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case "--harness":
      if (i + 1 >= args.length) usage();
      harness = args[++i];
      break;
    case "--prompt":
      if (i + 1 >= args.length) usage();
      prompt = args[++i];
      break;
    case "-h":
    case "--help":
      usage();
      break;
    default:
      process.stderr.write(`unknown argument: ${args[i]}\n`);
      usage();
  }
}

if (!harness || !prompt) usage();

// dryRun（CDD_DRY_RUN=1）跳过 CLI PATH preflight + CLI 调用 —— 对齐 cdd-run/runner 的
// dry-run 语义（参数解析/编排冒烟测试不依赖真实 CLI 二进制）。
const dryRun = process.env.CDD_DRY_RUN === "1";

// Registry ship gate first（D6-A1）：unknown / not-supported → BLOCKED exit 1；
// full harness 缺 CLI → CDD_CLI_MISSING exit 2（对齐 cdd_check_harness）。
let entry;
try {
  entry = checkHarness(loadRegistry(REG_PATH), harness, { dryRun });
} catch (e) {
  if (e instanceof CddBlockedError) {
    const prefix = e.kind === "cli-missing" ? "CDD_CLI_MISSING" : "CDD_BLOCKED";
    process.stderr.write(`${prefix}: ${e.message}\n`);
    process.exit(e.exitCode);
  }
  throw e;
}

if (dryRun) {
  // 不 invoke CLI —— 冒烟测试只验证参数分派 + registry ship gate。
  process.exit(0);
}

// 一次性 prompt-runner（不跑任务链）：CDD_MODE=review 触发 review-prefix 合成（透传）。
const mode = process.env.CDD_MODE ?? "";
const res = await invokeCli(entry, prompt, mode, process.env, process.cwd());
if (!res.ok) {
  // stream-json no-completion → bash 显式 CDD_BLOCKED 路径；其余按 CLI 退出码静默退出
  // （对齐 _cdd_invoke_cli 的 2>/dev/null：CLI stderr 不进输出）。
  if (res.code === 1 && res.stderr.startsWith("stream-json produced no completion finalText")) {
    process.stderr.write(`CDD_BLOCKED: ${res.stderr}\n`);
  }
  process.exit(res.code);
}
// 归一化输出：bash `$(...)` 剥尾部换行 + `printf '%s\n'` —— 恒单尾换行。
process.stdout.write(`${res.stdout.replace(/\n+$/, "")}\n`);
process.exit(0);
