#!/usr/bin/env node
// gate/adapters/gemini.mjs — Gemini CLI BeforeTool hook adapter（P4b T4）。
// stdin hook JSON（tool_name/tool_input）→ gateDecide → stdout { decision, reason }。
// gemini BeforeTool 阻塞形状：{"decision":"block","reason":...}（decision "deny"/"block"
// 等价，brief 定 block；denied 时 reason 必需）；allow → {"decision":"allow"}。
// 异常 → fail-open allow（stderr 记录）。
import { gateDecide } from "../cdd-gate-core.mjs";
import { readStdin, sessionKeyFromJson, denyMessageFor } from "./lib.mjs";

try {
  const input = JSON.parse(await readStdin());
  const r = gateDecide({
    harness: "gemini",
    toolName: input.tool_name,
    toolInput: input.tool_input ?? {},
    sessionKey: sessionKeyFromJson(input),
  });
  if (r.decision === "deny") {
    process.stdout.write(JSON.stringify({ decision: "block", reason: denyMessageFor(r, "gemini") }));
  } else {
    process.stdout.write(JSON.stringify({ decision: "allow" }));
  }
} catch (e) {
  process.stdout.write(JSON.stringify({ decision: "allow" })); // gemini fail-open
  console.error(`[cdd-gate gemini] ${e.message}`, e.stderr ?? "");
}
