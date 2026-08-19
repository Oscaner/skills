#!/usr/bin/env node
// gate/adapters/qoder.mjs — Qoder PreToolUse hook adapter（P4b T4）。
// stdin hook JSON → gateDecide → stdout hookSpecificOutput（Claude 同名事件；Qoder docs
// 要求 hookSpecificOutput 含 hookEventName，否则整段输出被拒 → 用 Claude 形状）。
// 异常 → fail-open allow（stderr 记录）。
import { gateDecide } from "../cdd-gate-core.mjs";
import { readStdin, sessionKeyFromJson, denyMessageFor } from "./lib.mjs";

try {
  const input = JSON.parse(await readStdin());
  const r = gateDecide({
    harness: "qoder",
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
      permissionDecisionReason: deny ? denyMessageFor(r, "qoder") : "",
    },
  }));
} catch (e) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "allow" },
  }));
  console.error(`[cdd-gate qoder] ${e.message}`, e.stderr ?? "");
}
