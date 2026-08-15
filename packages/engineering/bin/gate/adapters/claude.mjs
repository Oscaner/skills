#!/usr/bin/env node
// gate/adapters/claude.mjs — Claude Code PreToolUse hook adapter（P4b T3）。
// stdin hook JSON → gateDecide → stdout hookSpecificOutput。异常 → fail-open allow
// （stderr 记录）。响应形状：{ hookEventName, permissionDecision, permissionDecisionReason }。
import { gateDecide } from "../cdd-gate-core.mjs";
import { readStdin, sessionKeyFromJson, denyMessageFor } from "./lib.mjs";

try {
  const input = JSON.parse(await readStdin());
  const r = gateDecide({
    harness: "claude",
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
      permissionDecisionReason: deny ? denyMessageFor(r, "claude") : "",
    },
  }));
} catch (e) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "allow" },
  }));
  console.error(`[cdd-gate claude] ${e.message}`, e.stderr ?? "");
}
