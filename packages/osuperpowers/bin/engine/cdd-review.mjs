#!/usr/bin/env node
// cdd-review.mjs — run one prompt via a chosen harness CLI, print normalized output.
// Node port of the legacy bash script; thin shell reusing registry.mjs ship gate + runner.mjs
// invokeCli（registry output 模式归一化：text passthrough / stream-json last finalText）。
//
//   usage: cdd-review.mjs --harness <name> --template <name> [--param KEY=VALUE...] [--handoff PATH]
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadRegistry, checkHarness, CddBlockedError } from "./lib/registry.mjs";
import { invokeCli } from "./lib/runner.mjs";
import { resolveTimeoutMs } from "./lib/cli-shared.mjs";
import { renderTemplate } from "./lib/templates.mjs";
import { exitOk, exitBlocked, exitCliMissing, exitWithCode } from "../utils/exit.mjs";
import { writeHandoff } from "./lib/contract.mjs";

const NAME = path.basename(fileURLToPath(import.meta.url));
const REG_PATH = fileURLToPath(new URL("./harness-registry.json", import.meta.url));

const USAGE = `usage: ${NAME} --harness <name> --template <name> [--param KEY=VALUE...] [--handoff PATH]\n`;

function usage() {
  process.stderr.write(USAGE);
  exitCliMissing();
}

function help() {
  process.stdout.write(USAGE);
  exitOk();
}

const args = process.argv.slice(2);
let harness = "";
let templateName = "";
let handoffPath = "";
/** @type {Record<string, string>} */
const params = {};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case "--harness":
      if (i + 1 >= args.length) usage();
      harness = args[++i];
      break;
    case "--template":
      if (i + 1 >= args.length) usage();
      templateName = args[++i];
      break;
    case "--handoff":
      if (i + 1 >= args.length) usage();
      handoffPath = args[++i];
      break;
    case "--param": {
      if (i + 1 >= args.length) usage();
      const raw = args[++i];
      const eq = raw.indexOf("=");
      if (eq < 0) {
        process.stderr.write(`${NAME}: --param must be KEY=VALUE (got: ${raw})\n`);
        exitCliMissing();
      }
      params[raw.slice(0, eq)] = raw.slice(eq + 1);
      break;
    }
    case "-h":
    case "--help":
      help();
      break;
    default:
      process.stderr.write(`unknown argument: ${args[i]}\n`);
      usage();
  }
}

if (!harness) usage();
if (!templateName) {
  process.stderr.write(`${NAME}: --template is required\n`);
  usage();
}

const prompt = renderTemplate(templateName, params, NAME);

// dryRun（CDD_DRY_RUN=1）仅跳过 CLI PATH preflight（对齐 cdd_check_cli 的 dry-run 分支）；
// 不跳过 CLI 调用（dry-run 下同样做 CLI preflight + invoke）。
const dryRun = process.env.CDD_DRY_RUN === "1";

// Registry ship gate first（D6-A1）：unknown / not-supported → BLOCKED exit 1；
// full harness 缺 CLI → CDD_CLI_MISSING exit 2（对齐 cdd_check_harness；dry-run 跳过 PATH 校验）。
let entry;
try {
  entry = checkHarness(loadRegistry(REG_PATH), harness, { dryRun });
} catch (e) {
  if (e instanceof CddBlockedError) {
    // 对齐 runner.mjs finish 语义：cli-missing → exitCliMissing（exit 2）；否则 → exitBlocked（exit 1）。
    if (e.kind === "cli-missing") exitCliMissing(e.message);
    exitBlocked(e.message);
  }
  throw e;
}

// 一次性 prompt-runner（不跑任务链）：CDD_MODE=task-review 触发 task_review_prefix 合成（透传）。
const mode = process.env.CDD_MODE ?? "";
const timeoutMs = resolveTimeoutMs(process.env, "review");
const res = await invokeCli(entry, prompt, mode, process.env, process.cwd(), timeoutMs);

// Timeout path: 如果有 --handoff → 写 TIMEOUT partial handoff；无 --handoff → silent no-op。
if (res.timedOut) {
  if (handoffPath) {
    writeHandoff(handoffPath, {
      status: "TIMEOUT",
      blocker: `timeout after ${timeoutMs}ms`,
    });
  }
  exitWithCode(1);
}

if (handoffPath) {
  writeHandoff(handoffPath, res.ok
    ? { status: "APPROVED" }
    : { status: "BLOCKED", blocker: (res.stderr.split("\n")[0] || "").trim() || `cli exited ${res.code}` });
}
if (!res.ok) {
  // stream-json no-completion → bash 显式 CDD_BLOCKED 路径；其余按 CLI 退出码静默退出
  // （对齐 _cdd_invoke_cli 的 2>/dev/null：CLI stderr 不进输出）。
  if (res.code === 1 && res.stderr.startsWith("stream-json produced no completion finalText")) {
    process.stderr.write(`CDD_BLOCKED: ${res.stderr}\n`);
  }
  exitWithCode(res.code);
}
// 归一化输出：bash `$(...)` 剥尾部换行 + `printf '%s\n'` —— 恒单尾换行。
process.stdout.write(`${res.stdout.replace(/\n+$/, "")}\n`);
exitOk();
