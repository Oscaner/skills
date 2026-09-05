#!/usr/bin/env node
// gate/adapters/vibe.mjs — Mistral Vibe pre_tool hook adapter（P4b T4）。
// stdin hook JSON（tool_name/tool_input）→ gateDecide → stdout { decision, reason }。
// vibe pre_tool 阻塞形状：{"decision":"deny","reason":...}；allow → {"decision":"allow"}
//（decision 默认 allow，显式输出更稳）。异常 → fail-open allow（stderr 记录）。
import { gateDecide } from "../cdd-gate-core.mjs";
import { readStdin, sessionKeyFromJson, denyMessageFor } from "./lib.mjs";

try {
  const input = JSON.parse(await readStdin());
  const r = gateDecide({
    harness: "vibe",
    toolName: input.tool_name,
    toolInput: input.tool_input ?? {},
    sessionKey: sessionKeyFromJson(input),
  });
  if (r.decision === "deny") {
    process.stdout.write(JSON.stringify({ decision: "deny", reason: denyMessageFor(r, "vibe") }));
  } else {
    process.stdout.write(JSON.stringify({ decision: "allow" }));
  }
} catch (e) {
  process.stdout.write(JSON.stringify({ decision: "allow" })); // vibe fail-open
  console.error(`[cdd-gate vibe] ${e.message}`, e.stderr ?? "");
}
