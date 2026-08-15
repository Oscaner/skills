// gate/adapters/lib.mjs — 共享 adapter 工具（T3-T5 复用）。
// 对齐 bin/lib/cdd-orchestrator-gate.sh 的 cdd_session_key_from_json 语义：
// conversation_id → session_id → sessionKeyHash(prompt) 前 16 位。
import { createHash } from "node:crypto";
import { denyMessage } from "../cdd-gate-core.mjs";

export async function readStdin() {
  let s = "";
  for await (const chunk of process.stdin) s += chunk;
  return s;
}

// session-key hash —— 返回 sha256 前 16 hex（不是完整 digest），用作无显式会话 id
// 时的兜底 session key。名字带「sessionKey」避免被误当作完整 sha256 digest。
export function sessionKeyHash(s) {
  return createHash("sha256").update(String(s ?? "")).digest("hex").slice(0, 16);
}

export function sessionKeyFromJson(d) {
  if (d.conversation_id) return d.conversation_id;
  if (d.session_id) return d.session_id;
  return sessionKeyHash(d.prompt ?? "");
}

// deny 文案 —— 用 gateDecide 返回的 r.context（taskNum/planBase）按当前 harness 渲染
// （对齐 brief「用 r.context 渲染，回退 r.reason」：context 缺失时回退 r.reason）。
// 结果与 r.reason 一致（denyResult 本就由同一 context 渲染），但保证文案永远匹配
// 调用方 harness（如 cursor-agent），不受 pending 评估时传入 harness 的影响。
export function denyMessageFor(r, harness) {
  const ctx = r?.context ?? {};
  if (ctx.taskNum) return denyMessage(harness, ctx.taskNum, ctx.planBase ?? "unknown-plan");
  return r?.reason ?? "";
}

// 工具名规范化 —— TS harness（opencode/pi）用小写工具名（bash/write/edit/apply_patch），
// gate 核心以 Claude Code 规范名（Bash/Write/Edit/MultiEdit）判定 write/shell 工具。
// 已知小写名映射回规范名；规范名 / 未知名原样透传（未知名 → 非 write/shell → allow，
// fail-open）。校准自 opencode tools / pi extensions 文档。
const TOOL_NAME_ALIASES = new Map([
  ["bash", "Bash"],
  ["shell", "Shell"],
  ["write", "Write"],
  ["edit", "Edit"],
  ["apply_patch", "MultiEdit"],
]);

export function canonicalToolName(name) {
  if (typeof name !== "string") return name;
  return TOOL_NAME_ALIASES.get(name) ?? name;
}
