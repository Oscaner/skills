// engine/lib/handoff/write.mjs — handoff read/write（engine 载体唯一作者；按
// skills/cli-driven-development/docs/handoff-schema.md 写入）。T7 nit2 统一 JSON read 单点。
// contract.mjs 符号拆分（spec §2.3）：write 三件（readJson / writeHandoff / writeOwnHandoff）归本文件。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

// ---- handoff read/write ----

// 统一 JSON read —— lib/ 各处同形私有 readJson/safeParse 的历史收敛点。
export function readJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}
// safeParse 别名保留（writeHandoff 历史使用；与 readJson 同实现）。
function safeParse(filePath) {
  return readJson(filePath);
}

// 按 skills/cli-driven-development/docs/handoff-schema.md 写 handoff。已有文件 → 浅合并（H6 链 update 语义：
// review/validator 改 status/blocker 时保留 task/commits/findings 等字段）。
// 父目录不存在自动创建；返回合并后的完整对象。
export function writeHandoff(handoffPath, data) {
  const existing = existsSync(handoffPath) ? safeParse(handoffPath) : null;
  const merged = { ...(existing ?? {}), ...data };
  mkdirSync(path.dirname(handoffPath), { recursive: true });
  writeFileSync(handoffPath, `${JSON.stringify(merged, null, 2)}\n`);
  return merged;
}

// 全量覆盖写盘（T7：engine 是载体唯一作者，定稿写盘专用）。非浅合并：实现前不读盘，
// existing 字段一律不保留 —— agent 写残留进不了载体（私有写入槽位的自然语义）。
// 父目录不存在自动创建；返回写入的完整对象。
export function writeOwnHandoff(handoffPath, data) {
  mkdirSync(path.dirname(handoffPath), { recursive: true });
  writeFileSync(handoffPath, `${JSON.stringify(data, null, 2)}\n`);
  return data;
}