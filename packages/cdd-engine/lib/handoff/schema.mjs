// packages/cdd-engine/lib/handoff/schema.mjs
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';

// status 派生复用 finalize.mjs#rollupStatus（既有唯一实现；本文件不再写第二份 severity→status 映射）。
// 依赖方向：本文件 → finalize.mjs（status roll-up）+ finalize.mjs → 本文件（normalizeHandoff，写侧
// 同源）构成**有意的互引**——两者都是函数声明（提升），且互不读取对方的模块级绑定，故两种求值顺序
// 下都安全（顶层只依赖 node: 内建与自身常数）。单点归属由 spec 钉死：normalizeHandoff 与校验器同文件
// （使「归一化 → 重校验」可单测）、status 派生五件在 finalize.mjs（§2.3 符号拆分）。
import { rollupStatus } from './finalize.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// From lib/handoff/ → packages/cdd-engine/ (2 levels up — unchanged depth vs former bin/lib/).
// 复算核对：bin/lib ↔ lib/handoff 均 2 级 → `../../templates/` 仍正确，无需调整。
const PKG_ROOT = path.resolve(__dirname, '..', '..');

// Two handoff schemas ship in templates/schema/:
//   cdd  — task handoffs (implement/review/fix; task/phase enums, commits objects)
//   docs — doc review handoffs (review.md shared shell spec/plan; doc-fix;
//          required doc_path, no task/commits)
const SCHEMA_PATHS = {
  cdd:  path.join(PKG_ROOT, 'templates', 'schema', 'cdd-handoff-schema.json'),
  docs: path.join(PKG_ROOT, 'templates', 'schema', 'docs-handoff-schema.json'),
};

// Per-schema lazy caches: { validator, schema }.
const CACHE = new Map();

function getEntry(schemaName = 'cdd') {
  if (CACHE.has(schemaName)) return CACHE.get(schemaName);
  const schemaPath = SCHEMA_PATHS[schemaName];
  if (!schemaPath) throw new Error(`unknown handoff schema: ${schemaName}`);
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
  const ajv = new Ajv({ allErrors: true });
  const entry = { schema, validator: ajv.compile(schema) };
  CACHE.set(schemaName, entry);
  return entry;
}

// Returns the raw JSON Schema object (for renderHandoffStub).
export function loadHandoffSchema(schemaName = 'cdd') {
  return getEntry(schemaName).schema;
}

// Validates a handoff object against the named schema ('cdd' | 'docs').
// Returns {valid: true} or {valid: false, reason: string, property?: string}.
// T5: 失败形态携带违规键名 —— ajv 的 params.additionalProperty 同时落 `property`（消费方按键取用）
// 与 `reason` 文案（人读）。`valid` / `reason` 键名与既有七处消费方逐字不变（改名会破坏三个 lib
// 消费点 + 四个测试），本任务只新增 `property`。
export function validateHandoffSchema(obj, schemaName = 'cdd') {
  const { validator } = getEntry(schemaName);
  const valid = validator(obj);
  if (valid) return { valid: true };
  const errors = validator.errors ?? [];
  const err = errors.find(e => e.keyword === "additionalProperties");
  const reason = errors.map(e =>
    `${e.instancePath || "/"}${e.params?.additionalProperty ? ` (unexpected key: ${e.params.additionalProperty})` : ""} ${e.message}`
  ).join("; ").trim();
  return { valid: false, reason, property: err?.params?.additionalProperty };
}

// 归一化单点（T5，与校验器同文件 → 「归一化 → 重校验」是一个可单测单元）：三个 runner
// （run-task / run-docs / branch-review）在 CONTRACT_VIOLATION 恢复路径上同源消费，使 findings
// 得以全额保留（AC7 类目级要求，不区分 dispatch 类型）。规则三条：
//   ① 剥除 schema 未声明键（additionalProperties 违规面）—— 键集唯一权威 = schema.properties；
//   ② `blocker: null` → 省略（schema 声明为 string，null 非法）；
//   ③ review 族缺 `status` → 按 findings roll-up 派生补上（work 型不补：schema 的 else.required
//      强制 agent 声明，归一化不得绕过该约束）。
// 无副作用：不改原对象，返回新对象；非对象输入原样透传。
export function normalizeHandoff(obj, schemaName = 'cdd') {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj;
  const allowed = new Set(Object.keys(loadHandoffSchema(schemaName).properties ?? {}));
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    if (!allowed.has(key)) continue;                                     // ①
    if (key === "blocker" && value === null) continue;                   // ②
    out[key] = value;
  }
  if (!("status" in out) && (out.phase === "review" || out.phase === "branch-review")) {
    out.status = rollupStatus(out.findings ?? [], out.unverifiable ?? [], out.plan_conflicts ?? []);   // ③
  }
  return out;
}
