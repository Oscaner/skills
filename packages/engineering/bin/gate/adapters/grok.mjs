#!/usr/bin/env node
// gate/adapters/grok.mjs — Grok Build PreToolUse hook adapter（P4b T4）。
// stdin hook JSON → gateDecide → stdout 顶层 { decision }。grok 唯一阻塞事件 PreToolUse
// 的 deny 形状为 {"decision":"deny"}，且 timeout/crash/malformed 天然 fail-open
//（对齐 research matrix「fail-open on timeout/crash/malformed」）。异常 → fail-open allow
// （stderr 记录）。
import { gateDecide } from "../cdd-gate-core.mjs";
import { readStdin, sessionKeyFromJson } from "./lib.mjs";

try {
  const input = JSON.parse(await readStdin());
  const r = gateDecide({
    harness: "grok",
    toolName: input.tool_name,
    toolInput: input.tool_input ?? {},
    sessionKey: sessionKeyFromJson(input),
    repoRoot: process.cwd(),
  });
  process.stdout.write(JSON.stringify({ decision: r.decision === "deny" ? "deny" : "allow" }));
} catch (e) {
  process.stdout.write(JSON.stringify({ decision: "allow" })); // grok 天然 fail-open
  console.error(`[cdd-gate grok] ${e.message}`, e.stderr ?? "");
}
