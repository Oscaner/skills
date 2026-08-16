#!/usr/bin/env node
// cdd-select.mjs — detect installed harness CLIs + recommended default.
// Node port of cdd-select.sh; reads harness-registry.json; prints:
//   available: <csv of ship=full AND command -v found>
//   unsupported_installed: <csv of ship=not-supported AND found>
//   recommended: <name>
// BLOCKED (exit 1) when no full harness is installed.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { cliInPath } from "./lib/registry.mjs";
import { exitBlocked } from "./utils/exit.mjs";

const REG_PATH = fileURLToPath(new URL("./harness-registry.json", import.meta.url));
const reg = JSON.parse(readFileSync(REG_PATH, "utf8"));
const names = Object.keys(reg).sort(); // 对齐 jq keys[]（排序键）

// detect_current_harness：CURSOR_TRACE_ID → cursor-agent；CLAUDE_CODE_SESSION_ID → claude；
// AI_AGENT=claude-code* → claude；否则空。
function detectCurrentHarness(env) {
  if (env.CURSOR_TRACE_ID) return "cursor-agent";
  if (env.CLAUDE_CODE_SESSION_ID) return "claude";
  if ((env.AI_AGENT ?? "").startsWith("claude-code")) return "claude";
  return "";
}

const available = [];
const unsupported = [];
for (const name of names) {
  const entry = reg[name];
  const cli = entry?.cli;
  if (!cli) continue;
  if (!cliInPath(cli)) continue; // command -v 对齐
  if (entry.ship === "full") available.push(name);
  else unsupported.push(name);
}

if (available.length === 0) {
  // 对齐 cdd-select.sh BLOCKED 分支：三行空/unsupported 输出 + stderr BLOCKED（registry 键空格拼接）。
  process.stdout.write("available:\n");
  process.stdout.write(`unsupported_installed:${unsupported.join(",")}\n`);
  process.stdout.write("recommended:\n");
  process.stderr.write(`BLOCKED: no full harness installed (registry: ${names.join(" ")} )\n`);
  exitBlocked();
}

// 推荐优先级: droid > pi > 当前 harness(full) > 字母序第一个可用。
let recommended = "";
if (available.includes("droid")) {
  recommended = "droid";
} else if (available.includes("pi")) {
  recommended = "pi";
} else {
  const current = detectCurrentHarness(process.env);
  if (current && available.includes(current)) recommended = current;
  else recommended = available[0];
}

process.stdout.write(`available:${available.join(",")}\n`);
process.stdout.write(`unsupported_installed:${unsupported.join(",")}\n`);
process.stdout.write(`recommended:${recommended}\n`);
