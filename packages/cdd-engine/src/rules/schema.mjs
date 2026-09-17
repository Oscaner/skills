// packages/cdd-engine/src/rules/schema.mjs（ex lib/handoff/schema.mjs）
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';

// status 派生复用 finalize.mjs#rollupStatus（既有唯一实现；本文件不再写第二份 severity→status 映射）。
// 依赖方向：本文件 → finalize.mjs（status roll-up）+ finalize.mjs → 本文件（normalizeHandoff，写侧
// 同源）构成**有意的互引**——两者都是函数声明（提升），且互不读取对方的模块级绑定，故两种求值顺序
// 下都安全（顶层只依赖 node: 内建与自身常数）。单点归属由 spec 钉死：normalizeHandoff 与校验器同文件
// （使「归一化 → 重校验」可单测）、status 派生五件在 finalize.mjs（§2.3 符号拆分）。
import { rollupStatus } from '../artifacts/handoff/finalize.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// From src/rules/ → packages/cdd-engine/ (2 levels up — unchanged depth vs former lib/handoff/).
// 复算核对：lib/handoff ↔ src/rules 均 2 级 → `../../templates/` 仍正确，无需调整。
const PKG_ROOT = path.resolve(__dirname, '..', '..');

// Two handoff schemas ship in templates/schema/:
//   task — task handoffs (implement/review/fix/branch-review; task/phase enums, commits objects)
//   docs — doc review handoffs (review.md shared shell spec/plan; fix/docs.md;
//          required doc_path, no task/commits)
// Task 18: 文件名随前缀统一改名（cdd→task）；映射键随改名。
const SCHEMA_PATHS = {
  task: path.join(PKG_ROOT, 'templates', 'schema', 'task-handoff-schema.json'),
  docs: path.join(PKG_ROOT, 'templates', 'schema', 'docs-handoff-schema.json'),
};

// Per-schema lazy caches: { validator, schema }.
const CACHE = new Map();

function getEntry(schemaName = 'task') {
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
export function loadHandoffSchema(schemaName = 'task') {
  return getEntry(schemaName).schema;
}

// Validates a handoff object against the named schema ('task' | 'docs').
// Returns {valid: true} or {valid: false, reason: string, property?: string}.
// T5: 失败形态携带违规键名 —— ajv 的 params.additionalProperty 同时落 `property`（消费方按键取用）
// 与 `reason` 文案（人读）。`valid` / `reason` 键名与既有七处消费方逐字不变（改名会破坏三个 lib
// 消费点 + 四个测试），本任务只新增 `property`。
export function validateHandoffSchema(obj, schemaName = 'task') {
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

// 数组守卫单点：agent 写的 `findings` / `unverifiable` / `plan_conflicts` 常是 `"none"` / `{}` /
// 数字一类非数组值。rollupStatus 的 `findings.some(...)` 对非数组抛 TypeError，而该异常会沿 runner 的
// withLifecycle（仅 try/**finally**，无 catch）逃到 bin 顶层 catch → exit 2、不写 BLOCKED handoff、
// findings 全丢 —— 恢复路径在最该生效的输入类上崩溃。归一化与恢复载荷共用本守卫。
const arr = (v) => (Array.isArray(v) ? v : []);

// 对象守卫单点（恢复载荷专用）：`normalizeHandoff` 对非对象输入**原样透传**（该透传契约有其用例钉住，
// 见 tests/handoff-stub.test.mjs），若透传值被放回 `recoverHandoff().handoff`，三处消费方一律以
// `{ ...rec.handoff, … }` 组装落盘载荷——`{...x}` 对数组/字符串是**索引展开**、不抛错，于是 engine 亲手
// 写出含 `"0"`… 索引键的 BLOCKED 载体，被自家 schema 的 additionalProperties 拒绝（CONTRACT_VIOLATION
// 正是本单点要消灭的形态）。故恢复面在**本文件**收口为对象：手写载体永不依赖调用方的展开语义。
const objOrEmpty = (o) => (o && typeof o === "object" && !Array.isArray(o) ? o : {});

// 归一化单点（T5，与校验器同文件 → 「归一化 → 重校验」是一个可单测单元）：三个 runner
// （run-task / run-docs / branch-review）在 CONTRACT_VIOLATION 恢复路径上同源消费，使 findings
// 得以全额保留（AC7 类目级要求，不区分 dispatch 类型）。规则三条：
//   ① 剥除 schema 未声明键（additionalProperties 违规面）—— 键集唯一权威 = schema.properties；
//   ② `blocker: null` → 省略（schema 声明为 string，null 非法）；
//   ③ review 族缺 `status` → 按 findings roll-up 派生补上（work 型不补：schema 的 else.required
//      强制 agent 声明，归一化不得绕过该约束）。rollup 的三个数组入参先过 `arr` 守卫——agent 值
//      未经校验，直接喂 rollup 会把归一化单点变成崩溃点（本任务引入的回归）。
// 无副作用：不改原对象，返回新对象；非对象输入原样透传（透传契约由调用方判断——恢复面经 `objOrEmpty` 收口）。
export function normalizeHandoff(obj, schemaName = 'task') {
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
    out.status = rollupStatus(arr(out.findings), arr(out.unverifiable), arr(out.plan_conflicts));   // ③
  }
  return out;
}

// CONTRACT_VIOLATION 恢复单点（T5）：归一化 → 重校验（最多一轮，不循环）。三路 runner
// （run-task 8.8 / run-docs schema 无效分支 / branch-review schema 无效分支）同源消费，各自只保留
// **失败载荷差异**（BLOCKED 文案前缀 + 指引句 + 计数器分支）——此前三处各有一份同形拷贝，
// 「违规键名后缀」与「findings 数组守卫」这两条规则在三份拷贝间漂移，且 finding 1 的崩溃
// 在三处各有一份未守卫副本。
// 返回：
//   valid: true  → handoff = 归一化结果（调用方写侧同源落盘并继续）；
//   valid: false → handoff = 归一化结果（违规键已剥除，可直接作 BLOCKED 载荷基底）、
//                  property = 违规键名、reason = 失败明细（**含违规键名后缀的唯一拼装点**，
//                  调用方只补自己的前缀：`handoff` / `docs handoff` / `branch-review handoff`）、
//                  preservedFindings = 数组守卫后的原 findings（AC7「全额保留」，守卫只写一次）。
// 两条返回路径的 `handoff` 都恒为**对象**（`objOrEmpty` 收口）：调用方的 `{ ...rec.handoff, … }`
// 载荷组装不依赖输入的展开语义。非对象顶层输入（agent 写 `[{…findings…}]` / 裸字符串 / 数字）必然
// 归为 invalid（`type: object` 不满足）→ 走 BLOCKED 分支，findings 无非数组字段可留 → `[]`。
export function recoverHandoff(obj, schemaName = "task") {
  const handoff = objOrEmpty(normalizeHandoff(obj, schemaName));
  const sv = validateHandoffSchema(handoff, schemaName);
  if (sv.valid) return { handoff, valid: true };
  // 违规键名取自**原对象**那一轮校验：归一化已剥除顶层未知键，重校验面上 additionalProperties
  // 错误通常已消失——只有原对象的键名才能告诉 agent 到底是哪个键被拒（嵌套 additionalProperties
  // 场景才可能由重校验面给出，故两者取先有者）。
  const property = validateHandoffSchema(obj, schemaName).property ?? sv.property;
  return {
    handoff,
    valid: false,
    property,
    reason: `${property ? ` (unexpected key: ${property})` : ""}: ${sv.reason}`,
    preservedFindings: arr(handoff.findings),
  };
}
