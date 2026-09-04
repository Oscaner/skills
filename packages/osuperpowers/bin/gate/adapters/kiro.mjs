#!/usr/bin/env node
// gate/adapters/kiro.mjs — Kiro PreToolUse action command adapter（P4b T4）。
// stdin hook JSON（tool_name/tool_input）→ gateDecide → stdout { decision, reason }。
// kiro v1 阻塞形状：{"decision":"deny","reason":...}；allow → {"decision":"allow"}。
// 异常 → fail-open allow（stderr 记录）。
import { gateDecide } from "../cdd-gate-core.mjs";
import { readStdin, sessionKeyFromJson, denyMessageFor } from "./lib.mjs";

try {
  const input = JSON.parse(await readStdin());
  const r = gateDecide({
    harness: "kiro",
    toolName: input.tool_name,
    toolInput: input.tool_input ?? {},
    sessionKey: sessionKeyFromJson(input),
  });
  if (r.decision === "deny") {
    process.stdout.write(JSON.stringify({ decision: "deny", reason: denyMessageFor(r, "kiro") }));
  } else {
    process.stdout.write(JSON.stringify({ decision: "allow" }));
  }
} catch (e) {
  process.stdout.write(JSON.stringify({ decision: "allow" })); // kiro fail-open
  console.error(`[cdd-gate kiro] ${e.message}`, e.stderr ?? "");
}
