#!/usr/bin/env node
// gate/adapters/codex.mjs — Codex PreToolUse hook adapter（P4b T4）。
// stdin hook JSON（tool_name/tool_input/session_id）→ gateDecide → stdout hookSpecificOutput
//（codex 现行 deny 主形状：{"hookSpecificOutput":{"hookEventName":"PreToolUse",
// "permissionDecision":"deny","permissionDecisionReason":...}}；legacy {decision:"block"}
// 亦被接受，但现行文档主形状是 wrapper）。异常 → fail-open allow（stderr 记录）。
import { gateDecide } from "../cdd-gate-core.mjs";
import { readStdin, sessionKeyFromJson, denyMessageFor } from "./lib.mjs";

try {
  const input = JSON.parse(await readStdin());
  const r = gateDecide({
    harness: "codex",
    toolName: input.tool_name,
    toolInput: input.tool_input ?? {},
    sessionKey: sessionKeyFromJson(input),
    repoRoot: process.cwd(),
  });
  const deny = r.decision === "deny";
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: deny ? "deny" : "allow",
      permissionDecisionReason: deny ? denyMessageFor(r, "codex") : "",
    },
  }));
} catch (e) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "allow" },
  }));
  console.error(`[cdd-gate codex] ${e.message}`, e.stderr ?? "");
}
