// cdd-engine/bin/lib/handoff-naming.mjs — handoff 工件契约派生层，唯一消费
// templates/handoff-namespace.json（canonical：family name / round 语义 / status / phase / prev 表）。
// name 是唯一真相；roundPattern 由 name 派生（scan/concrete 两形态）；prev 表驱动 Stopping + runner 固定点读取。
// workspaceSlug / resolveWorkspace 实现 workspaceRoot + slugRule（.superpowers/cdd/<slug>/）。
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { gitToplevel } from "./contract.mjs";

const NAMESPACE = JSON.parse(
  readFileSync(new URL("../../templates/handoff-namespace.json", import.meta.url), "utf8"));
const { families } = NAMESPACE;

// familyKey(op, type) → canonical family key（`${op}.${type}`）。内部 helper，非公共 API。
function familyKey(op, type) { return `${op}.${type}`; }

function family(op, type) {
  const f = families[familyKey(op, type)];
  if (!f) throw new Error(`unknown handoff family: ${op}.${type}`);
  return f;
}

// familyConfig(op, type) → canonical 族配置（readonly 对象）。reviews.json 裁 artifact 轴后，
// schema/return/fixTemplate 等 artifact 字段的唯一读取点（templates.mjs reviewArtifactConfig /
// cdd.mjs runFix 消费；命名不重复字面量）。
export function familyConfig(op, type) {
  return family(op, type);
}

// 占位符具体替换（regexp escape 由 roundPattern 负责，此处不转义）。
function fillName(name, params) {
  return name
    .replaceAll("{task}", String(params?.task ?? ""))
    .replaceAll("{base7}", params?.base7 ?? "")
    .replaceAll("{head7}", params?.head7 ?? "")
    .replaceAll("{round}", String(params?.round ?? ""));
}

// roundPattern(op, type, params) → ^...$ RegExp，两形态：
//   scan 形态（params.task 缺席——workspace 轮次扫描）：{round}→(\d+)、{task}→\d+、
//     {base7}/{head7}→[0-9a-f]{7}，宽匹配（同族任意 task/ref 都命中 round 捕获组）；
//   concrete 形态（params 提供 {task}/{base7}/{head7} 字面量——Stopping prev / round 校验）：
//     占位符→字面量，精确 ref 匹配。
// 形态判别 = params.task 是否提供（task 族），无 probe 标志位。
// 注：line 41 的单点 `.` 转义已同时覆盖 `..`（branch 的 base7..head7 段逐字符转义为 `\.\.`），无需单独处理。
export function roundPattern(op, type, params = {}) {
  const f = family(op, type);
  const taskPinned = ["task"].includes(type) && params?.task != null;
  let pattern = f.name
    .replaceAll("{round}", "(\\d+)")
    .replaceAll("{task}", taskPinned ? String(params.task) : "\\d+")
    .replaceAll("{base7}", params?.base7 ? params.base7 : "[0-9a-f]{7}")
    .replaceAll("{head7}", params?.head7 ? params.head7 : "[0-9a-f]{7}")
    .replaceAll(".", "\\.");
  return new RegExp(`^${pattern}$`);
}

// handoffName(op, type, params) → 具体文件名（handoff artifact 命名唯一真相 = canonical name + 参数填充）。
export function handoffName(op, type, params) {
  return fillName(family(op, type).name, params);
}

// resolveNextRound(workspace, op, type, opts) → maxR+1（round:"increment" 家族用；
// review-loop 旧 spec-(N).json 扫描语义由 T3 切换消费方时对齐）。
// scan 形态 = 不传 task pin（roundPattern 以 params.task 缺席判别宽匹配）。
export function resolveNextRound(workspace, op, type, opts = {}) {
  // scan 形态：task 族不 pin（跨 task 扫 rounds）；branch/spec/plan 天然无 task 字段。
  const re = roundPattern(op, type, { ...opts, task: undefined });
  let max = 0;
  try {
    for (const f of readdirSync(workspace)) {
      const m = f.match(re);
      if (m) max = Math.max(max, Number(m[1]));
    }
  } catch (err) {
    // 仅 workspace 缺失（ENOENT）归默认 round 1；其余真实错误（EACCES…）上抛，不吞。
    if (err?.code !== "ENOENT") throw err;
  }
  return max + 1;
}

// prevHandoffPath(workspace, op, type, round, opts) → 上一轮 handoff 路径 | null。
// 两机制划界（canonical prev 表）：跨族 prev 表（review.task + 全部 fix 族，runner 固定点读取）优先；
// 其余 review 族 → 同族 round-1 算术（Stopping prev）。无 prev 的 work 型（implement）→ null。
export function prevHandoffPath(workspace, op, type, round, opts = {}) {
  const f = family(op, type);
  // 跨族依赖表优先（prev 表仅存在于 review.task 与 fix 族）。
  const prevExpr = f.prev?.[round === 1 ? "round1" : "roundR"];
  if (prevExpr) {
    const [prevFamily, roundRef] = prevExpr.split(":");
    const [prevOp, prevType] = prevFamily.split(".");
    let prevRound = round;
    if (roundRef === "R-1") prevRound = round - 1; // :R / :R-1 相对轮换算
    const prevParams = { ...opts, round: prevRound };
    if (families[prevFamily].round === "fixed") delete prevParams.round; // implement 无 round
    return path.join(workspace, handoffName(prevOp, prevType, prevParams));
  }
  // 同族 round-1 算术（Stopping prev）：仅无 prev 表的 review 族（spec/plan/branch）。
  if (op === "review" && round > 1) {
    return path.join(workspace, handoffName(op, type, { ...opts, round: round - 1 }));
  }
  return null;
}

// ---- workspace 派生（第五/六派生函数）----
// slugRule：被审文档文件名 去 `.md` → 再去尾 `-design`。spec/plan 收敛同值；只依赖文件名不依赖文件存在。
export function workspaceSlug(doc) {
  const base = path.basename(doc).replace(/\.md$/, "");
  return base.endsWith("-design") ? base.slice(0, -"-design".length) : base;
}

// resolveWorkspace(doc) → <gitRoot>/<workspaceRoot>/<slug>。
// gitToplevel(dirname(doc)) 优先（真实 doc 路径必然在 repo 内）；无 git（测试/dry-run fake 路径）回落
// canonical 布局标记 `docs/superpowers/` 推导 root。两者均失败 → throw。
export function resolveWorkspace(doc) {
  const root = gitToplevel(path.dirname(path.resolve(doc))) ?? rootFromDocPath(doc);
  if (!root) throw new Error("resolveWorkspace: not in a git repo");
  return path.join(root, NAMESPACE.workspaceRoot, workspaceSlug(doc));
}

// canonical 布局推导：<root>/docs/superpowers/{specs,plans}/… 中 `docs`+`superpowers` 段之前的路径即 gitRoot。
function rootFromDocPath(doc) {
  const segments = path.resolve(doc).split(path.sep);
  for (let i = 0; i < segments.length - 1; i++) {
    if (segments[i] === "docs" && segments[i + 1] === "superpowers") {
      return segments.slice(0, i).join(path.sep) || path.sep;
    }
  }
  return null;
}
