#!/usr/bin/env node
// gate/adapters/cursor.mjs — Cursor preToolUse hook adapter（P4b T3）。
// stdin hook JSON → gateDecide → stdout **顶层** { permission }（对齐现行
// override-cursor-cdd-gate.sh 响应形状：{ permission: "allow" } /
// { permission: "deny", agent_message }，勿用 hookSpecificOutput 包装）。
// 异常 → fail-open allow（stderr 记录）。
import { gateDecide } from "../cdd-gate-core.mjs";
import { readStdin, sessionKeyFromJson, denyMessageFor } from "./lib.mjs";

try {
  const input = JSON.parse(await readStdin());
  const r = gateDecide({
    harness: "cursor",
    toolName: input.tool_name,
    toolInput: input.tool_input ?? {},
    sessionKey: sessionKeyFromJson(input),
    repoRoot: process.cwd(),
  });
  if (r.decision === "deny") {
    process.stdout.write(JSON.stringify({ permission: "deny", agent_message: denyMessageFor(r, "cursor") }));
  } else {
    process.stdout.write(JSON.stringify({ permission: "allow" }));
  }
} catch (e) {
  process.stdout.write(JSON.stringify({ permission: "allow" }));
  console.error(`[cdd-gate cursor] ${e.message}`, e.stderr ?? "");
}
