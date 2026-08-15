// gate/adapters/lib.mjs — 共享 adapter 工具（T3-T5 复用）。
// 对齐 bin/lib/cdd-orchestrator-gate.sh 的 cdd_session_key_from_json 语义：
// conversation_id → session_id → sha256(prompt) 前 16 位。
import { createHash } from "node:crypto";

export async function readStdin() {
  let s = "";
  for await (const chunk of process.stdin) s += chunk;
  return s;
}

export function sha256(s) {
  return createHash("sha256").update(String(s ?? "")).digest("hex").slice(0, 16);
}

export function sessionKeyFromJson(d) {
  if (d.conversation_id) return d.conversation_id;
  if (d.session_id) return d.session_id;
  return sha256(d.prompt ?? "");
}
