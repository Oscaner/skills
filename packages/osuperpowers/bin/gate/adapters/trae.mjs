#!/usr/bin/env node
// gate/adapters/trae.mjs — Trae PreToolUse hook adapter（P4b T4）。
// stdin hook JSON（Cursor 形 tool_name/tool_input）→ gateDecide → stdout hookSpecificOutput
//（trae PreToolUse deny 形状：{"hookSpecificOutput":{"permissionDecision":"deny"}}）。
// 异常 → fail-open allow（stderr 记录）。
import { gateDecide } from "../cdd-gate-core.mjs";
import { readStdin, sessionKeyFromJson, denyMessageFor } from "./lib.mjs";

try {
  const input = JSON.parse(await readStdin());
  const r = gateDecide({
    harness: "trae",
    toolName: input.tool_name,
    toolInput: input.tool_input ?? {},
    sessionKey: sessionKeyFromJson(input),
    repoRoot: process.cwd(),
  });
  const deny = r.decision === "deny";
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      permissionDecision: deny ? "deny" : "allow",
      permissionDecisionReason: deny ? denyMessageFor(r, "trae") : "",
    },
  }));
} catch (e) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { permissionDecision: "allow" },
  }));
  console.error(`[cdd-gate trae] ${e.message}`, e.stderr ?? "");
}
