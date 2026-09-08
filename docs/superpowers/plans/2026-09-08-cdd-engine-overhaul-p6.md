# CDD Engine 重构 — P6 Handoff 契约统一 实施计划

**Spec:** [2026-09-08-cdd-engine-overhaul-p6-design.md](docs/superpowers/specs/2026-09-08-cdd-engine-overhaul-p6-design.md)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 P4 dogfood F1–F6，将 handoff 命名/round/status/workspace 收敛到单一 canonical（`handoff-namespace.json` + 派生五函数），status 归 engine 单一权威，implement handoff 由 runner 实体化，删除 `cdd contract` 子命令，stale-lexicon 守卫并入 residue，reviews.json 裁轴。

**Architecture:** 新建 `handoff-namespace.json` 统治全部 handoff 家族（name/round/status/schema/return/fixFamily/prev + workspaceRoot/slugRule），`handoff-naming.mjs` 从 canonical 派生 `handoffName/roundPattern/resolveNextRound/prevHandoffPath/resolveWorkspace` 五函数；所有 writer/scanner 站点与 workspace 推导点改走派生函数（命名统一 `{type}-{op}[-{round}]`，workspace 统一 `.superpowers/cdd/<slug>/`）。`contract.mjs` 的 rollupStatus 激活（review 型派生覆写、SP-4 失败轮次豁免）与 validateCommitContract 全模式接线（cdd contract 删除）；runner 从 H1 实体化 implement handoff；residue 并入 stale-lexicon 断言。

**Tech Stack:** Node 24 · vitest（cdd-engine engine suite，`packages/cdd-engine/vitest.config.mjs`）· `pnpm run validate`（**保持 13 块**，stale-lexicon 并入 5c 单步内部）· `pnpm run emit/emit:check`（SKILL/`_docs`/templates 变更后必跑）。

## Global Constraints

- **单一真相**：`packages/cdd-engine/templates/handoff-namespace.json` 是 handoff 工件契约唯一 canonical；**含 `workspaceRoot`/`slugRule` 顶层字段**；所有字面量命名站点与 workspace 推导点改走派生函数，禁止第二处命名字面量 / 第二处 workspace 推导。
- **Workspace 单一根**：全部 handoff 收编 `.superpowers/cdd/<slug>/`（slug = 被审文档文件名去 `.md`、再去尾 `-design`，见 `resolveWorkspace` 第五派生函数）；`.superpowers/docs-review/` flat root **删除**（Phase-0 一次性归档后废弃）；engine 代码 `.superpowers/docs-review` 零引用。
- **命名统一**：`{type}-{op}[-{round}]` —— spec-review-{R}/spec-fix-{R}/plan-review-{R}/plan-fix-{R}/task-{N}-implement/task-{N}-review-{R}/task-{N}-fix-{R}/branch-review-{base7}..{head7}-r{R}；`task-review` mode 名归一为 `review`（CDD_MODE/VALID_MODES/progress `rounds["review"]`/handoff `phase:"review"`）；**`cdd-handoff-schema.json` phase enum 同步改 `["implement","review","fix","branch-review"]`（T4 内完成，配「phase:review 通过 schema 校验」绿测试）**；`doc-fix` 退位为纯模板名（reviews.json fixTemplate 指向）。旧命名（`spec-1\.json`/`plan-1\.json`/`doc-fix-`/旧 `task-{N}-task-review-{R}`）在 engine 代码中零残留（T7/tests grep）。
- **status 单一权威**：review 型（task/spec/plan/branch）由 `rollupStatus(findings)` 派生覆写；work 型（implement/fix）agent 声明 + `validateCommitContract` 否决。**SP-4 失败轮次豁免**：engine 自写 BLOCKED/TIMEOUT 与 agent status ∈ {BLOCKED,TIMEOUT} 一律不覆写；仅 `findings.length > 0` 且 status ∈ {APPROVED, CHANGES_REQUESTED} 时触发 rollup。
- **implement 实体化**：implement handoff 由 runner 从 H1 + TASK_BASE(brief) + git HEAD 实体化（commits.base 权威 = brief TASK_BASE；commits.head = git HEAD；H1 改 h1FromHandoff 重发）；implement 的 commit-contract 收敛 dirty-only；head 校验仅 fix。
- **docs 通道不接 dirty 断言**（docs fix 产出未提交 doc 属常态；docs review 派发时外层树普遍 dirty）。
- **reviews.json 纯内容契约**：lensEnum/axesGuide/ref 留；returnMode/handoffType/fixTemplate 迁 canonical（fixTemplate 仅定义在 fix 族，review 派发经 fixFamily 解析）。
- **`cdd contract` 子命令删除**（check-dirty/check-head/clear-findings 全灭）；progress schema 删 `lastDispatchHead`/`degradationLog`；`task.status=complete` 由 runner 在 APPROVED task-review 后回写。
- **stale-lexicon 零豁免**：并入 `scripts/validate/residue.mjs`，只查机制位置（label 语法位 `labels..dogfood`/`"dogfood"`、旧文档名 `docs-review\.md`/`PASS=`/词边界 `D1|D2|D3`、resolver `resolve-hit`/`gh issue reopen`、旧 mode `task-review`/退化名 `spec-1|plan-1|doc-fix-`）；不得误报 canonical 合法语汇（finding-meta.json `dogfood (CDD session)` 下拉）。RESIDUE_TARGETS 扩含 `packages/cdd-engine`（bin+templates）。
- **F6 收口（Workspace 单一化 + flat root 废弃）**：全部 handoff 收编 `.superpowers/cdd/<slug>/`；P6 迁移前 `.superpowers/docs-review/` 全部现有产物（含 P3 同名 `spec-review-1.json`/`plan-review-1.json`）移入 `archive-<date>/`，此后 flat root 废弃不再写；`.superpowers/cdd/<slug>/` 现存 task 族不归档（弃置性本地 state，安全孤儿）；`.superpowers/cdd/` 根杂讯测试目录（`p|plan|smoke-plan|smoke-test|test-plan-br|.tmp-smoke-plan|.test-fixtures`）一次性移入 archive 或删除。
- **清单**：每 task 结束 `pnpm run validate` 绿；SKILL.md/templates/docs 变更后 `pnpm run emit`；commit 每次 task 完成；changeset 于 T9。
- **`**Spec:**` 头**：本文件头部已按 F2 约定产出（T9 将 writing-plans write-plan 节点固化该约定）。

---

## Phase-0: F6 归档 + flat root 废弃（首个新命名 docs 派发前执行 — 设计 §2.8「P6 迁移前整体归档」）

> 必须在**第一个产生新命名 docs handoff 的派发之前**完成（即 Task 1 后续任何 `cdd review --type spec|plan` / 自测前）。当前 `.superpowers/docs-review/` 同时含 P3 期 canonical 同名文件（`spec-review-1.json`/`plan-review-1.json` — 与 T1 新 pattern 同形，resolveNextRound 会误命中）与 P4 退化名产物（`spec-1.json`/`plan-1.json`/`doc-fix-1.json`）——只清退化名不够（canonical 同名旧文件仍会把 round 从 2 起跳、Stopping prev 误读陈年文件），必须整体归档。

```bash
# ① flat docs-review 整体归档（此后废弃，新产物全部落 .superpowers/cdd/<slug>/）
mkdir -p .superpowers/docs-review/archive-2026-09-08
mv .superpowers/docs-review/*.json .superpowers/docs-review/archive-2026-09-08/ 2>/dev/null || true
ls .superpowers/docs-review/   # 预期无 .json（空 workspace，root 废弃）

# ② .superpowers/cdd/ 根杂讯测试目录一次性清理（弃置性 state）
mkdir -p .superpowers/cdd/.archive-2026-09-08
for d in p plan smoke-plan smoke-test test-plan-br .tmp-smoke-plan .test-fixtures; do
  [ -e ".superpowers/cdd/$d" ] && mv ".superpowers/cdd/$d" ".superpowers/cdd/.archive-2026-09-08/" 2>/dev/null || true
done
```

> `.superpowers/cdd/<slug>/` 现存 task 族产物不归档（弃置性本地 state；改名后旧名安全孤儿）。此后 T9 仅收尾复核 + 增量归档（防新旧 pd 混合再发生）。
>
> **progress rounds 迁移悬项**（设计 §2.8 记录，本 phase 不实施）：未来若引入 CDD resume 语义，须补 `rounds["task-review"] → rounds["review"]` 迁移（详见 Global Constraints 对应条目）；本 phase workspace 为弃置性本地 state，无 resume 契约，不迁移。

---

### Task 1: handoff-namespace.json canonical + handoff-naming.mjs 派生层（TDD）

**Files:**
- Create: `packages/cdd-engine/templates/handoff-namespace.json`
- Create: `packages/cdd-engine/bin/lib/handoff-naming.mjs`
- Test: `packages/cdd-engine/bin/tests/handoff-naming.test.mjs`
- （`packages/cdd-engine/bin/lib/review-loop.mjs` **不在本 task 改动** — resolveNextRound 消费切换归 T3；本 task 仅新增、不 touch 现有消费方）

**Interfaces:**
- Consumes: 无（本 task 纯新增）
- Produces:
  - `handoffName(op, type, params)` → string（`handoffName("review","spec",{round:2})` → `"spec-review-2.json"`）
  - `roundPattern(op, type, opts)` → RegExp（scan 形态 / concrete 形态）
  - `resolveNextRound(workspace, op, type, opts)` → number（maxR+1）
  - `prevHandoffPath(workspace, op, type, round, opts)` → string|null（同族 round-1 算术 + 跨族 prev 表）
  - `resolveWorkspace(doc)` → string（`.superpowers/cdd/<slug>/`；slug = 文件名去 `.md`、再去尾 `-design`）
  - `workspaceSlug(doc)` → string（slug 纯值，供 resolveNextRound 等用）

- [ ] **Step 1: 建 canonical 数据文件**

写 `packages/cdd-engine/templates/handoff-namespace.json`（设计 §2.1 示例形状，含 `workspaceRoot`/`slugRule` 顶层字段 + `phase` 列；注释并入 handoff-naming.mjs 头注释）。家族按设计 §2.1：

```json
{
  "schema": 1,
  "workspaceRoot": ".superpowers/cdd",
  "slugRule": "strip .md, then strip trailing -design",
  "families": {
    "implement.task": { "name": "task-{task}-implement.json", "round": "fixed", "status": "contract", "schema": "cdd", "phase": "implement" },
    "review.task":    { "name": "task-{task}-review-{round}.json", "round": "increment", "status": "rollup", "schema": "cdd", "return": "h1", "phase": "review", "fixFamily": "fix.task", "prev": { "round1": "implement.task", "roundR": "fix.task:R-1" } },
    "fix.task":       { "name": "task-{task}-fix-{round}.json", "round": "source", "status": "contract", "schema": "cdd", "fixTemplate": "fix", "phase": "fix", "prev": { "roundR": "review.task:R" } },
    "review.spec":    { "name": "spec-review-{round}.json", "round": "increment", "status": "rollup", "schema": "docs", "return": "json", "phase": "review", "fixFamily": "fix.spec" },
    "fix.spec":       { "name": "spec-fix-{round}.json", "round": "source", "status": "contract", "schema": "docs", "fixTemplate": "doc-fix", "return": "json", "phase": "fix", "prev": { "roundR": "review.spec:R" } },
    "review.plan":    { "name": "plan-review-{round}.json", "round": "increment", "status": "rollup", "schema": "docs", "return": "json", "phase": "review", "fixFamily": "fix.plan" },
    "fix.plan":       { "name": "plan-fix-{round}.json", "round": "source", "status": "contract", "schema": "docs", "fixTemplate": "doc-fix", "return": "json", "phase": "fix", "prev": { "roundR": "review.plan:R" } },
    "review.branch":  { "name": "branch-review-{base7}..{head7}-r{round}.json", "round": "increment", "status": "rollup", "schema": "cdd", "return": "h1", "phase": "branch-review" }
  }
}
```

- [ ] **Step 2: 写失败测试（handoffName/roundPattern/resolveNextRound/prevHandoffPath/resolveWorkspace 五函数）**

`handoff-naming.test.mjs`（vitest）：
```js
import { describe, it, expect } from "vitest";
import { handoffName, roundPattern, resolveNextRound, prevHandoffPath } from "../lib/handoff-naming.mjs";

it("handoffName: spec review → spec-review-2.json", () => {
  expect(handoffName("review", "spec", { round: 2 })).toBe("spec-review-2.json");
});
it("handoffName: task fix → task-3-fix-4.json", () => {
  expect(handoffName("fix", "task", { task: 3, round: 4 })).toBe("task-3-fix-4.json");
});
it("handoffName: branch review embeds base7..head7 + r{round}", () => {
  expect(handoffName("review", "branch", { base7: "abc1234", head7: "def5678", round: 1 }))
    .toBe("branch-review-abc1234..def5678-r1.json");
});
it("roundPattern scan 形态: spec-review-2.json 可被匹配", () => {
  expect("spec-review-2.json").toMatch(roundPattern("review", "spec"));
  expect("spec-1.json").not.toMatch(roundPattern("review", "spec"));
});
it("roundPattern concrete 形态: 指定 base7/head7 才匹配 branch", () => {
  const re = roundPattern("review", "branch", { base7: "abc1234", head7: "def5678" });
  expect("branch-review-abc1234..def5678-r1.json").toMatch(re);
  expect("branch-review-1111111..2222222-r1.json").not.toMatch(re);
});
it("resolveNextRound: 写 spec-review-1.json 后 → 2", () => {
  const ws = mkdtempSync(join(tmpdir(), "hn-"));
  writeFileSync(join(ws, "spec-review-1.json"), "{}");
  expect(resolveNextRound(ws, "review", "spec")).toBe(2);
});
it("prevHandoffPath: 同族 round-1（review.spec R=2 → spec-review-1.json）", () => {
  expect(prevHandoffPath("/ws", "review", "spec", 2)).toBe("/ws/spec-review-1.json");
});
it("prevHandoffPath: 跨族 task review R=1 → implement；R>1 → fix.task:R-1", () => {
  expect(prevHandoffPath("/ws", "review", "task", 1, { task: 5 })).toBe("/ws/task-5-implement.json");
  expect(prevHandoffPath("/ws", "review", "task", 3, { task: 5 })).toBe("/ws/task-5-fix-2.json");
});
it("prevHandoffPath: fix 族 → 源 review 同 round", () => {
  expect(prevHandoffPath("/ws", "fix", "spec", 2)).toBe("/ws/spec-review-2.json");
});
it("resolveWorkspace: spec-design.md 与 plan.md 收敛同 slug workspace", () => {
  const specWs = resolveWorkspace("/repo/docs/superpowers/specs/2026-09-08-foo-design.md");
  const planWs = resolveWorkspace("/repo/docs/superpowers/plans/2026-09-08-foo.md");
  expect(specWs).toBe("/repo/.superpowers/cdd/2026-09-08-foo");
  expect(planWs).toBe(specWs);
});
it("resolveWorkspace: 仅文件名派生，不依赖 plan 文件存在", () => {
  expect(workspaceSlug("2026-09-08-foo-design.md")).toBe("2026-09-08-foo");
  expect(workspaceSlug("2026-09-08-foo.md")).toBe("2026-09-08-foo");
});
```

- [ ] **Step 3: 跑测试确认失败**

Run: `npx vitest run packages/cdd-engine/bin/tests/handoff-naming.test.mjs`
Expected: FAIL（import 失败——文件不存在）。

- [ ] **Step 4: 实现 handoff-naming.mjs**

`packages/cdd-engine/bin/lib/handoff-naming.mjs`：
```js
// handoff 工件契约派生层 —— 唯一消费 handoff-namespace.json。
// name 是唯一真相；roundPattern 由 name 派生（scan/concrete 两形态）。
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const NAMESPACE = JSON.parse(readFileSync(
  new URL("../templates/handoff-namespace.json", import.meta.url), "utf8"));
const { families } = NAMESPACE;

export function familyKey(op, type) { return `${op}.${type}`; }

function family(op, type) {
  const f = families[familyKey(op, type)];
  if (!f) throw new Error(`unknown handoff family: ${op}.${type}`);
  return f;
}

// 占位符具体替换（escape 由 roundPattern 负责，此处不转义）
function fillName(name, params) {
  return name
    .replaceAll("{task}", String(params?.task ?? ""))
    .replaceAll("{base7}", params?.base7 ?? "")
    .replaceAll("{head7}", params?.head7 ?? "")
    .replaceAll("{round}", String(params?.round ?? ""));
}

// scan 形态：占位符 → 宽模式（{round}→(\d+), {task}→\d+, {base7}/{head7}→[0-9a-f]{7}）
// concrete 形态：占位符 → opts 字面量（精确 ref 匹配）
export function roundPattern(op, type, params = {}) {
  const f = family(op, type);
  const hasOpArg = ["task"].includes(type) && params?.task != null;
  let pattern = f.name
    .replaceAll("{round}", "(\d+)")
    .replaceAll("{task}", hasOpArg ? String(params.task) : "\\d+")
    .replaceAll("{base7}", params?.base7 ? params.base7 : "[0-9a-f]{7}")
    .replaceAll("{head7}", params?.head7 ? params.head7 : "[0-9a-f]{7}")
    .replaceAll(".", "\\.")
    .replaceAll("..", "\\.\\.");
  return new RegExp(`^${pattern}$`);
}

export function handoffName(op, type, params) {
  return fillName(family(op, type).name, params);
}

// 扫描 workspace：maxR+1（round:"increment" 家族用）
export function resolveNextRound(workspace, op, type, opts = {}) {
  const re = roundPattern(op, type, { probe: true });
  let max = 0;
  try {
    for (const f of readdirSync(workspace)) {
      const m = f.match(re);
      if (m) max = Math.max(max, Number(m[1]));
    }
  } catch (err) {
    if (err?.code !== "ENOENT") throw err;
  }
  return max + 1;
}

// 两机制划界（设计 §2.1）：同族 round-1 算术（Stopping prev，仅无 prev 表的 review 族）
// vs 跨族 prev 表（fix→review、review.task→implement/fix:R-1，runner 固定点读取）。
// 判定顺序：有 prev 表的族（review.task + 全部 fix 族）→ 先查 prev 表；其余 review 族 → 同族 round-1 算术。
export function prevHandoffPath(workspace, op, type, round, opts = {}) {
  const f = family(op, type);
  // 跨族依赖表优先（prev 表仅存在于 review.task 与 fix 族）
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
  // 同族 round-1 算术（Stopping prev）：仅无 prev 表的 review 族（spec/plan/branch）
  if (op === "review" && round > 1) {
    return path.join(workspace, handoffName(op, type, { ...opts, round: round - 1 }));
  }
  return null;
}

// ---- workspace 派生（第五函数）----
// slugRule：被审文档文件名 去 `.md` → 再去尾 `-design`。spec/plan 收敛同值；只依赖文件名不依赖文件存在。
export function workspaceSlug(doc) {
  const base = path.basename(doc).replace(/\.md$/, "");
  return base.endsWith("-design") ? base.slice(0, -"-design".length) : base;
}

// resolveWorkspace(doc) → gitToplevel / workspaceRoot / slug（gitToplevel 失败 → throw）
export function resolveWorkspace(doc) {
  const root = gitToplevelFromCwd();
  if (!root) throw new Error("resolveWorkspace: not in a git repo");
  return path.join(root, NAMESPACE.workspaceRoot, workspaceSlug(doc));
}
```
> 注：单点 `.` 的转义（`.replaceAll(".", "\\.")`）已同时覆盖 `..`（逐字符转义后 `..`→`\.\.`），无需单独处理 `..` 顺序；参数 `{probe:true}` 用于 scan 形态（round→捕获组）。`gitToplevelFromCwd` 复用 contract.mjs 的 `gitToplevel(process.cwd())`（import 或接参注入）；dry-run / 测试可注入 fake root。若实现细节与测试冲突，以测试为 contract 调整实现（TDD）。

- [ ] **Step 5: 跑测试确认通过**

Run: `npx vitest run packages/cdd-engine/bin/tests/handoff-naming.test.mjs`
Expected: PASS（3+ 用例全绿）。

- [ ] **Step 6: 兼容确认 — review-loop resolveNextRound 保留**

`packages/cdd-engine/bin/lib/review-loop.mjs` 的 `resolveNextRound`/`reviewRoundPattern` 在本 task **不动**（T3 才切换消费方）；确认新 `handoff-naming.resolveNextRound` 对 `spec-review-*` 与旧 `spec-*` 的扫描行为与 review-loop 现有语义一致（测试已覆盖新 pattern）。

- [ ] **Step 7: 全量 validate**

Run: `pnpm run validate`
Expected: ALL PASS（新增测试绿 + 既有 236 引擎测试不回归——handoff-naming 尚未被消费）。

- [ ] **Step 8: Commit**

```bash
git add packages/cdd-engine/templates/handoff-namespace.json packages/cdd-engine/bin/lib/handoff-naming.mjs packages/cdd-engine/bin/tests/handoff-naming.test.mjs
git commit -m "feat(cdd-engine): handoff-namespace.json canonical + handoff-naming 派生层（name/roundPattern/resolveNextRound/prev；round-trip vitest）"
```

---

### Task 2: reviews.json 裁轴 — artifact 字段迁 canonical（TDD）

**Files:**
- Modify: `packages/cdd-engine/templates/review/reviews.json`（删 returnMode/handoffType/fixTemplate）
- Modify: `packages/cdd-engine/bin/lib/templates.mjs`（reviewTypeConfig 消费改读 canonical `return`/`schema`/`fixFamily`；renderModePrompt 的 task-review 分支 HANDOFF_TYPE/RETURN_MODE 读 canonical）
- Modify: `packages/cdd-engine/bin/cdd.mjs`（runReview spec/plan/branch 的参数注入从 canonical 读 schema/return；runFix fixTemplate 从 canonical fix 族读）
- Test: `packages/cdd-engine/bin/tests/templates.test.mjs`, `packages/cdd-engine/bin/tests/templates.content.test.mjs`, `packages/cdd-engine/bin/tests/cdd.test.mjs`, `packages/cdd-engine/bin/tests/docs-runner.test.mjs`

**Interfaces:**
- Consumes: Task 1 的 `handoff-naming`（roundPattern 用于 schema/return 读取的 think 校验）；canonical fix 族
- Produces: reviews.json 仅存 lensEnum/axesGuide/ref（纯内容契约）；`loadReviews()` 消费者不再期望 artifact 字段

- [ ] **Step 1: 写失败测试 — reviews.json 无 artifact 字段**

`templates.test.mjs` 追加：
```js
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const REVIEWS = JSON.parse(readFileSync(new URL("../templates/review/reviews.json", import.meta.url), "utf8"));
it("reviews.json 纯内容契约：无 artifact 字段", () => {
  for (const cfg of Object.values(REVIEWS)) {
    expect(cfg).not.toHaveProperty("returnMode");
    expect(cfg).not.toHaveProperty("handoffType");
    expect(cfg).not.toHaveProperty("fixTemplate");
  }
});
```
Expected: FAIL（现 reviews.json 仍在——先删字段再让测试绿，顺序按 TDD 亦可先删后测；此步验证契约口径）。

- [ ] **Step 2: 删 reviews.json 三 artifact 字段**

`packages/cdd-engine/templates/review/reviews.json` 四个 type 条目各删 `returnMode`/`handoffType`/`fixTemplate`，保留 `lensEnum`/`axesGuide`/`ref`。

- [ ] **Step 3: 改消费方读 canonical**

`templates.mjs`：
- 新增 import `{ roundPattern } from "./handoff-naming.mjs"`（或导出 schema/return 解析辅助）
- `reviewTypeConfig(type)` 保留（读 content 轴）；新增 `reviewArtifactConfig(type)`：读 canonical `review.{type}` 族，返回 `{ schema, return, fixFamily }`
- `renderModePrompt('task-review')` 分支：`HANDOFF_TYPE`→`reviewArtifactConfig('task').schema`、`RETURN_MODE`→`.return`；`review.md` 渲染的同参数从 canonical 注入
- cdd.mjs `runReview`（spec/plan）：`HANDOFF_TYPE`/`RETURN_MODE` 参数源改 canonical（`handoffName` 关联）；`runBranchReview` 同；`runFix`：`const template = handoff-naming 读 fix 族 fixTemplate`（`{familyKey:"fix."+opts.type}.fixTemplate`）

> 精确改点以 Step 1 测试 + `pnpm run validate` 为 contract。

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run packages/cdd-engine/bin/tests/templates.test.mjs`
Expected: PASS。随后 `pnpm run validate` 全绿（cdd.test/docs-runner.test 同步）。

- [ ] **Step 5: Commit**

```bash
git add packages/cdd-engine/templates/review/reviews.json packages/cdd-engine/bin/lib/templates.mjs packages/cdd-engine/bin/cdd.mjs packages/cdd-engine/bin/tests/templates.test.mjs packages/cdd-engine/bin/tests/cdd.test.mjs packages/cdd-engine/bin/tests/docs-runner.test.mjs
git commit -m "refactor(cdd-engine): reviews.json 裁轴 — returnMode/handoffType/fixTemplate 迁 handoff-namespace（纯内容契约；consumers 读 canonical）"
```

---

### Task 3: 命名统一 — docs 侧（cdd.mjs spec/plan/branch + docs-runner）（TDD）

**Files:**
- Modify: `packages/cdd-engine/bin/cdd.mjs`（spec/plan review write+Stopping prev、branch review write+prev、existingRoundHandoff、runFix 的 handoffPath 显式传；**`docsReviewWorkspace()` 删除，workspace 全走 `resolveWorkspace(doc)`**）
- Modify: `packages/cdd-engine/bin/lib/docs-runner.mjs`（删 `${template}-${round}` fallback；handoffPath 必由调用方传；schema fallback 逻辑同步）
- Modify: `packages/cdd-engine/bin/lib/review-loop.mjs`（resolveNextRound/reviewRoundPattern 对接 handoff-naming 或由 cdd.mjs 改调 `handoff-naming.resolveNextRound`）
- Test: `packages/cdd-engine/bin/tests/cdd.test.mjs`, `packages/cdd-engine/bin/tests/docs-runner.test.mjs`, `packages/cdd-engine/bin/tests/branch-review.test.mjs`, `packages/cdd-engine/bin/tests/review-loop.test.mjs`, `packages/cdd-engine/bin/tests/docs-task.test.mjs`

**Interfaces:**
- Consumes: Task 1 的 `handoffName`/`roundPattern`/`resolveNextRound`/`prevHandoffPath`/`resolveWorkspace`；Task 2 的 canonical artifact 读取
- Produces: `cdd review --type spec|plan|branch` 与 `cdd fix --type spec|plan` 产出规范化命名 handoff、落在 `.superpowers/cdd/<slug>/`（resolveWorkspace 推导）；Stopping prev 解析正确

- [ ] **Step 1: 写失败测试 — docs 命名切换 + workspace 归属**

`cdd.test.mjs` 追加：
```js
it("review --type spec 产出 spec-review-1.json 于 .superpowers/cdd/<slug>/（非 .superpowers/docs-review/ 非 spec-1.json）", async () => {
  // dry-run 或 fixture：runReview 传 docs-runner 的 handoffPath = resolveWorkspace(doc)/spec-review-1.json
  // 断言 workspace = /repo/.superpowers/cdd/2026-09-08-foo（doc=…foo-design.md 经 slugRule）
});
it("review --type plan --doc=<plan.md> 与 --type spec --doc=<spec-design.md> 收敛同一 workspace", async () => {
  // resolveWorkspace(plan) === resolveWorkspace(spec)
});
it("fix --findings spec-review-2.json 产出 spec-fix-2.json", () => {
  // roundPattern('review','spec') 从 findings 名解析 round=2 → handoffName('fix','spec',{round:2})
});
it("branch review Stopping prev 读 branch-review-{b7}..{h7}-r1.json（concrete 匹配）", () => { /* prevHandoffPath branch */ });
```
Expected: FAIL（现产出 spec-1.json / doc-fix-1.json）。

- [ ] **Step 2: cdd.mjs docs 侧改走派生层**

- `existingRoundHandoff`（:65）：`path.join(ws, ${type}-${round}.json)` → `handoffName("review", type, {round})`
- `runReview` spec/plan（:139）：`handoffPath: path.join(ws, "${opts.type}-${round}.json")` → `handoffName("review", opts.type, { round })`；round 推导改 `resolveNextRound(ws, "review", opts.type)`（handoff-naming）
- Stopping prev（:129 existingRoundHandoff 调用）+ `--round` backfill 校验逻辑同步
- `runReview` branch（:221-234）：`resolveNextRound(ws,"review","branch",{base7,head7})` + `handoffFile` 用 `handoffName("review","branch",{base7,head7,round})`；prev 读取（:226）改 `prevHandoffPath(...)` 或同族算术
- `runFix` spec/plan（:334-340）：`handoffPath` 显式传 `handoffName("fix", opts.type, {round})`——**round 从 `--findings` 源解析**：`roundPattern("review", type)` 匹配 findings 文件名 → 提取 round；如 findings 解析失败 → 提示 `--findings <type>-review-{R}.json` 并 exit 2
- **workspace 全走 `resolveWorkspace(doc)`**：`docsReviewWorkspace()`（:59-61）删除；runReview spec/plan 与 runFix 的 `ws`/`workspace` 改 `resolveWorkspace(opts.doc)`；branch review 的 `workspace`（:217）改 `resolveWorkspace(opts.plan)`——docs/task/branch 同函数、同 slug 域（clean docs-review flat root，第二 workspace 根退出）

- [ ] **Step 3: docs-runner 删 fallback**

`docs-runner.mjs`（:39）：`const resolvedHandoffPath = handoffPath ?? path.join(...)` → `if (!handoffPath) throw new Error("docs-runner: handoffPath required (canonical naming; no template fallback)")`；`templateName` 对 `-review` 后缀的 legacy 派生分支删除（URC 后无 templates 名带 -review）。`doc-fix` 模板名直传。

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run packages/cdd-engine/bin/tests/cdd.test.mjs packages/cdd-engine/bin/tests/docs-runner.test.mjs packages/cdd-engine/bin/tests/docs-task.test.mjs`
Expected: PASS。`pnpm run validate`（review-loop.test 同步——resolveNextRound 现有 spec-*/plan-* 用例改 spec-review-*）。

- [ ] **Step 5: full validate**

Run: `pnpm run validate`
Expected: ALL PASS。

- **Step 6: 消费侧文档同步（URC review.md）**

`packages/osuperpowers/skills/_docs/review.md` §Handoff Output / handoff schema 示例：`spec-{round}.json`/`plan-{round}.json` → `spec-review-{R}.json`/`plan-review-{R}.json`（命名切换后 orchestrator 按 URC 执行 `cdd fix --findings <ws>/spec-review-{R}.json` 才不 exit 2）。同步 `pnpm run emit`（_docs 变更走 emit 派生）。

- [ ] **Step 6b: Commit**

```bash
git add packages/cdd-engine/bin/cdd.mjs packages/cdd-engine/bin/lib/docs-runner.mjs packages/cdd-engine/bin/lib/review-loop.mjs packages/cdd-engine/bin/tests/cdd.test.mjs packages/cdd-engine/bin/tests/docs-runner.test.mjs packages/cdd-engine/bin/tests/docs-task.test.mjs packages/cdd-engine/bin/tests/branch-review.test.mjs packages/cdd-engine/bin/tests/review-loop.test.mjs packages/osuperpowers/skills/_docs/review.md
git commit -m "refactor(cdd-engine): docs 命名统一 — spec-review-{R}/plan-review-{R}/spec-fix-{R}/plan-fix-{R} 走 handoff-naming；docs-runner fallback 删；fix round=源 review round"
```

---

### Task 4: 命名统一 — task 侧模式名归一（task-review→review）（TDD）

**Files:**
- Modify: `packages/cdd-engine/bin/lib/runner.mjs`（VALID_MODES/CDD_MODE/progress rounds key/buildTaskEnv handoffFile/prevHandoffPath/handoffStatus mode==="task-review" 分支）
- Modify: `packages/cdd-engine/bin/cdd.mjs`（:184/:189 task Stopping prev + mode 传参）
- Modify: `packages/cdd-engine/bin/lib/progress.mjs`（无需改——getRound/incrementRound 已 mode 参数化；rounds key 由调用方 mode="review" 决定）
- Test: `packages/cdd-engine/bin/tests/runner.test.mjs`, `packages/cdd-engine/bin/tests/task.test.mjs`, `packages/cdd-engine/bin/tests/progress.test.mjs`, `packages/cdd-engine/bin/tests/templates.test.mjs`, `packages/cdd-engine/bin/tests/templates.content.test.mjs`

**Interfaces:**
- Consumes: Task 1 派生五函数 + Task 3 的 docs 命名先例（含 resolveWorkspace 单根）
- Produces: `task-{N}-review-{R}.json`/`task-{N}-fix-{R}.json`/`task-{N}-implement.json`；CDD_MODE="review"（task-review 剔除）；progress `rounds["review"]`；handoff `phase:"review"`（T5 schema 联动）

- [ ] **Step 1: 写失败测试 — task 命名 + mode 归一**

`runner.test.mjs` 追加/更新：
```js
it("buildTaskEnv task-review → CDD_HANDOFF_PATH endsWith task-1-review-1.json（非 task-1-task-review-1）", async () => { /* 既有用例更新 file:// 断言 */ });
it("getRound rounds[review]：incrementRound('review') 后 round=2", () => { /* progress.mjs 直测 */ });
it("handoffStatus 读 task-N-review-R.json（rounds[review]）", async () => { /* isTaskPending/handoffStatus 更新 */ });
it("VALID_MODES 无 task-review（CDD_MODE must be implement|review|fix）", () => { /* validateMode 直测 */ });
it("schema: phase review 的 task-review handoff 通过 Ajv 校验（phase enum 已含 review）", () => {
  // schema-utils validateHandoffSchema({task:1,phase:"review",status:"APPROVED",...}) → valid
});
it("cdd task review 连续两轮：round2 派发后 Stopping 读 task-{N}-review-1.json", async () => {
  // cdd.mjs:176 resolveNextRound(taskWs,"review","task",{task}) → 2；Stopping prev 同族算术读到 round1 文件
});
```
Expected: FAIL。

- [ ] **Step 2: runner.mjs 模式归一**

- `VALID_MODES = ["implement", "review", "fix"]`
- `INVOKE_PARAMS`（:39）：`"review": { op: "review", type: "task" }`（键从 task-review 改 review）
- `buildTaskEnv`（:124-127）：`mode === "implement" ? task-${task}-implement.json : task-${task}-review|fix-${round}.json` → 统一 `handoffName(mode字典→op, "task", {task, round})`：implement 用 fixed 族（无 round）、review/fix 用 round 族
- `prevHandoffPath`（:174-184）：逻辑保留但文件名改派生——task-review→review 分支调 `prevHandoffPath("review","task",round,{task})` / `prevHandoffPath("fix","task",...)`（handoff-naming）
- `handoffStatus`（:613-626）：`rounds["task-review"]` → `rounds["review"]`；文件名 `task-${taskNum}-task-review-${R}.json` → `handoffName("review","task",{task,round})`；`isTaskPending` 同步
- `renderModePrompt('task-review')`（templates.mjs:95）→ `'review'`；`renderHandoffStub(schema,'task-review',...)`（:111）→ `'review'`
- cdd.mjs（:184/:189）：Stopping prev 读**同族 round-1 算术**（`handoffName("review","task",{task: opts.task, round: prevR})` → `task-{N}-review-{prevR}.json`），**不得用 prevHandoffPath**（该函数对此族解析跨族依赖 implement/fix:R-1，会读到实体化 implement 的 APPROVED+[] → Stopping 误锁）；**cdd.mjs:176 的下一轮推导改 `resolveNextRound(taskWs, "review", "task", { task: opts.task })`**（新四参签名；显式透传 `{task}` 防 scan 形态 `{task}→\d+` 跨 task 混计 rounds）；`mode: "task-review"` → `mode: "review"`。Runner 侧的固定点/跨族读取（fixed-point 推导）仍走 `prevHandoffPath`——两机制分界见 T1 实现与 README
- **`cdd-handoff-schema.json` phase enum 归一**：`["implement","task-review","fix","branch-review"]` → `["implement","review","fix","branch-review"]`（配合 Step 1 的 schema 绿测试；不归一则真实 task review handoff 必被 runner 8.8 Ajv 判 invalid 覆写 BLOCKED——dry-run smoke 不暴露）

- [ ] **Step 3: 跑测试确认通过**

Run: `npx vitest run packages/cdd-engine/bin/tests/runner.test.mjs packages/cdd-engine/bin/tests/task.test.mjs packages/cdd-engine/bin/tests/progress.test.mjs`
Expected: PASS。`pnpm run validate`（templates.test 里 task-review 引用同步）。

- [ ] **Step 4: full validate + smoke**

Run: `pnpm run validate && node scripts/run.mjs smoke-cdd`
Expected: ALL PASS；smoke H1 链通过（smoke-cdd.mjs 的旧命名断言在 T8 同步，见 Task 8 Step 2b）。

- [ ] **Step 5: Commit**

```bash
git add packages/cdd-engine/bin/lib/runner.mjs packages/cdd-engine/bin/lib/templates.mjs packages/cdd-engine/bin/cdd.mjs packages/cdd-engine/bin/tests/runner.test.mjs packages/cdd-engine/bin/tests/task.test.mjs packages/cdd-engine/bin/tests/progress.test.mjs packages/cdd-engine/bin/tests/templates.test.mjs packages/cdd-engine/bin/tests/templates.content.test.mjs
git commit -m "refactor(cdd-engine): task 命名统一 + mode 归一 — task-{N}-review-{R}/task-{N}-fix-{R}；task-review→review（CDD_MODE/rounds[review]/VALID_MODES）"
```

---

### Task 5: status 单一权威 + SP-4 豁免（TDD）

**Files:**
- Modify: `packages/cdd-engine/bin/lib/contract.mjs`（rollupStatus 新增导出调用封装 `deriveReviewStatus(json)`；保留原函数签名）
- Modify: `packages/cdd-engine/bin/lib/docs-runner.mjs`（读回 handoff 时 status 派生覆写）
- Modify: `packages/cdd-engine/bin/lib/runner.mjs`（task-review 读回时 status 派生覆写）
- Modify: `packages/cdd-engine/bin/cdd.mjs`（branch review 读回时 status 派生覆写）
- Modify: `packages/cdd-engine/templates/schema/cdd-handoff-schema.json` + `docs-handoff-schema.json`（status conditional：review 型可缺省/可覆写；implement/fix required）
- Modify: `packages/cdd-engine/templates/review/review.md`（Self-validate 不强求 agent 写与 findings 一致的 status）
- Test: `packages/cdd-engine/bin/tests/contract.test.mjs`, `packages/cdd-engine/bin/tests/docs-runner.test.mjs`, `packages/cdd-engine/bin/tests/runner.test.mjs`, `packages/cdd-engine/bin/tests/schema-utils.test.mjs`

**Interfaces:**
- Consumes: canonical status 规则（review 族 status:"rollup"）
- Produces: `deriveReviewStatus(handoff)` → status；`applyDerivedStatus(handoff)` 在 engine 读回路径被调用；schema conditional

- [ ] **Step 1: 写失败测试 — rollup 派生 + SP-4 豁免**

`contract.test.mjs` 追加：
```js
it("deriveReviewStatus: warn/nit only → APPROVED（覆写 agent CHANGES_REQUESTED）", () => {
  const h = { status: "CHANGES_REQUESTED", findings: [{ severity: "warn" }, { severity: "nit" }] };
  expect(deriveReviewStatus(h)).toBe("APPROVED");
});
it("deriveReviewStatus: blocker present → CHANGES_REQUESTED", () => {
  const h = { status: "APPROVED", findings: [{ severity: "blocker" }] };
  expect(deriveReviewStatus(h)).toBe("CHANGES_REQUESTED");
});
it("deriveReviewStatus SP-4 豁免：agent status BLOCKED + findings:[] → 保持 BLOCKED", () => {
  const h = { status: "BLOCKED", findings: [] };
  expect(deriveReviewStatus(h)).toBe("BLOCKED");
});
it("deriveReviewStatus SP-4 豁免：engine TIMEOUT + findings:[] → 保持 TIMEOUT", () => {
  const h = { status: "TIMEOUT", findings: [] };
  expect(deriveReviewStatus(h)).toBe("TIMEOUT");
});
it("deriveReviewStatus: findings 空 + status APPROVED → 保持 APPROVED（空载通过不误变）", () => {
  const h = { status: "APPROVED", findings: [] };
  expect(deriveReviewStatus(h)).toBe("APPROVED");
});
```
**读回接线 test-first（docs-runner 与 runner 各一）**——`docs-runner.test.mjs` / `runner.test.mjs`：
```js
it("docs-runner 读回覆写：agent 写 warn-only CHANGES_REQUESTED → 文件 status 覆写为 APPROVED", async () => {
  // stub agent 写 spec-review-1.json = { status:"CHANGES_REQUESTED", findings:[{severity:"warn"},...] } 
  // 断言 runDocsTask 返回/读回后文件 status === "APPROVED"（覆写持久化）
});
it("runner review 读回覆写：task-N-review-1.json agent 写 CHANGES_REQUESTED warn-only → 覆写 APPROVED", async () => {
  // 同上 runner task-review 路径；含 findReturnStub 类清理
});
```
Expected: FAIL（deriveReviewStatus / 覆写逻辑未实现）。

- [ ] **Step 2: 实现 deriveReviewStatus（contract.mjs）**

```js
// review 型 handoff status 派生（唯 engine 权威）。
// SP-4 豁免：失败轮次（engine 自写 BLOCKED/TIMEOUT、agent status ∈ {BLOCKED, TIMEOUT}）不覆写。
export function deriveReviewStatus(handoff = {}) {
  const { status, findings = [], unverifiable = [] } = handoff;
  // schema 字段为 snake_case：plan_conflicts（勿解构 camelCase planConflicts — 永空）
  const planConflicts = handoff.plan_conflicts ?? [];
  if (status === "BLOCKED" || status === "TIMEOUT") return status;
  if (findings.length === 0) return status === "CHANGES_REQUESTED" ? "APPROVED" : status ?? "APPROVED";
  return rollupStatus(findings, unverifiable, planConflicts);
}
```
> 语义：findings>0 才 rollup；findings=0 但 agent 写 CHANGES_REQUESTED（0 blocker）→ APPROVED（URC：无 findings 即无 blocker）；空载 APPROVED 保持。

- [ ] **Step 3: engine 读回路径接入**

- `docs-runner.mjs`（review 模式，:80 读回 handoff 后）：`if (mode === "review") { const d = deriveReviewStatus(handoff); if (d !== handoff.status) writeHandoff(resolvedHandoffPath, { ...handoff, status: d }); }`
- `runner.mjs`（task-review 读回/成功路径）：`h1FromHandoff` 或 finish 前对 review 型 handoff 应用 `deriveReviewStatus`（实现选型：在成功路径读 handoff 重 derive 并持久化覆写，H1 同步用 h1FromHandoff—见 T6 H1 收敛）
- `cdd.mjs`（branch review，handoff 校验后）：同 review 读回覆写逻辑（分支手写，非 shared helper）

- [ ] **Step 4: schema conditional + review.md**

- cdd-handoff-schema.json / docs-handoff-schema.json：`status` 从 required 条件化——`if` phase ∈ review 族（cdd: review/branch-review；docs: review）→ status 可缺省；implement/fix → required。JSON-Schema draft-07 `allOf/if/then` 表达。
- review.md Self-validate：删「Fail → status: BLOCKED」中强制 agent 填 status 的句式，改为「findings 非空；status 由 engine 从 findings 派生」。

- [ ] **Step 5: 跑测试确认通过**

Run: `npx vitest run packages/cdd-engine/bin/tests/contract.test.mjs packages/cdd-engine/bin/tests/docs-runner.test.mjs packages/cdd-engine/bin/tests/schema-utils.test.mjs`
Expected: PASS。`pnpm run validate`。

- [ ] **Step 6: Commit**

```bash
git add packages/cdd-engine/bin/lib/contract.mjs packages/cdd-engine/bin/lib/docs-runner.mjs packages/cdd-engine/bin/lib/runner.mjs packages/cdd-engine/bin/cdd.mjs packages/cdd-engine/templates/schema/cdd-handoff-schema.json packages/cdd-engine/templates/schema/docs-handoff-schema.json packages/cdd-engine/templates/review/review.md packages/cdd-engine/bin/tests/contract.test.mjs packages/cdd-engine/bin/tests/docs-runner.test.mjs packages/cdd-engine/bin/tests/schema-utils.test.mjs
git commit -m "feat(cdd-engine): status 单一权威 — deriveReviewStatus 派生覆写（review 型）+ SP-4 失败轮次豁免 + schema conditional"
```

---

### Task 6: implement handoff 实体化 + HARD GATE + commits 单一权威（TDD）

**Files:**
- Modify: `packages/cdd-engine/bin/lib/runner.mjs`（implement 实体化 post-run；h1FromHandoff 用于 OK 路径；evidence-gate 校验；10.5 implement 分支失效）
- Modify: `packages/cdd-engine/templates/task/implement.md`（删手写 JSON 块；HARD GATE 替代；evidence-gate 指引保留）
- Modify: `packages/cdd-engine/templates/task/fix.md`（HARD GATE 已存在——确认）
- Modify: `packages/cdd-engine/templates/review/review.md`（HARD GATE 按 returnMode 分写：h1 →「BEFORE outputting H1」；json →「BEFORE outputting the JSON return」）
- Test: `packages/cdd-engine/bin/tests/runner.test.mjs`, `packages/cdd-engine/bin/tests/templates.content.test.mjs`

**Interfaces:**
- Consumes: Task 4 的 canonical 命名；Task 5 的 deriveReviewStatus
- Produces: implement 后 `task-{N}-implement.json` 必在（runner 实体化）；commits.base=brief TASK_BASE、commits.head=git HEAD；H1 由 h1FromHandoff 发

- [ ] **Step 1: 写失败测试 — implement 实体化 + commits 权威**

`runner.test.mjs` 追加：
```js
it("implement 成功路径：runner 实体化 task-N-implement.json（H1 stdout → 文件）", async () => {
  // invokeCli stub 产出四行 H1（status: APPROVED / commits: / artifacts: / blocker:）
  // 断言 runTask 后存在 task-1-implement.json，含 commits.base===TASK_BASE、commits.head===git HEAD、findings:[]
});
it("implement 不写 handoff 也不得触发 10.5 BLOCKED（runner 实体化兜底）", async () => {
  // stub 只回 H1 不写文件 → runTask exit 0 且 handoff 存在（实体化）
});
it("implement evidence-gate：Complex/behavior_change:true 缺 test_evidence → BLOCKED", async () => {
  // brief 含复杂档位 + test_evidence.json 缺 command/passed/exit_code → 覆写 BLOCKED
});
it("H1 输出改用 h1FromHandoff（与实体化 handoff commits 无分歧）", async () => {
  // h1 四行 status/commits 来自实体化 handoff 而非 agent 原样 stdout
});
```
Expected: FAIL（现 implement 由 agent 写文件、无实体化）。

- [ ] **Step 2: runner implement 实体化实现**

- OK 路径（:580-593 后）：若 `mode === "implement"` **且 `exit 0` 且 `!dryRun`** → 构造实体化 handoff：
  - `task`、`phase: "implement"`、`status`: 从 H1 status 行提取（APPROVED/BLOCKED）
  - `commits.base` = brief 中 `TASK_BASE:` 行（`/^TASK_BASE: (\S+)/`，readFileSync(env.CDD_TASK_BRIEF)）——**brief 缺失/无 TASK_BASE 行 → 降级不实体化**（不抛崩 runner）：保留原 H1 输出 + stderr WARN（dry-run 与 smoke 链均走此处，绝不允许 ENOENT 崩溃）
  - `commits.head` = `git rev-parse HEAD`（gitToplevel(repoRoot)）
  - `findings: []`、`artifacts` 从 H1 artifacts 行解析、`blocker` 从 H1 blocker 行
  - 写入 `task-{N}-implement.json`（canonical 名）
- **evidence-gate 校验**（仅 !dryRun）：读 `task-{N}-test-evidence.json`（workspace）——**复杂度判据唯一机械可读来源 = test-evidence 的 `behavior_change:true`**（brief.mjs generateBrief 只输出 `### Task N` 段 + `TASK_BASE:` 行，仓库无 Complex/Simple 档位标注、`complexity` schema 字段无机械来源）→ 硬档触发条件收敛为 `behavior_change:true`（require `command`/`passed`/`exit_code`；缺 → 覆写 BLOCKED「test_evidence gate: hard 要求 command/passed/exit_code」）；其余（simple / 无 behavior_change）→ soft WARN 注记；test-evidence 文件缺失 → WARN 注记（soft 语义）。**不引入 brief 复杂度行**（YAGNI；实现前如设计确认需要再补）
- **H1 改写**：OK 路径返回 `h1FromHandoff(env.CDD_HANDOFF_PATH)`（替代 agent stdout 原样四行），确保 status/commits 与实体化 handoff 一致
- 10.5（:567-578）：implement 分支实际不会命中（实体化已写文件），保留兜底逻辑但对 implement 加注释「runner 实体化后本分支不触发」

- [ ] **Step 3: 模板侧 HARD GATE + implement.md 全段手术**

- `implement.md`：**删除整个 `## Handoff Output` 段**（含 Segment: implement 的 steps 3/4「把 status/commits.base/commits.head 写进 handoff」、JSON stub、Self-validate 的 jq 校验、Atomicity「handoff 写失败→H1 BLOCKED」——实体化后 agent 不应写任何文件，残留指令会诱导双写，正是设计 §2.4 根治的 Bug C 类半边手术）；头部「**Handoff path (write at end of this mode)**」行改写为「**本模式不写 handoff**；runner 将从你的 H1 四行 + brief `TASK_BASE` + `git HEAD` 实体化 `task-{N}-implement.json`」；evidence-gate 指引段改为说明 engine 读回校验行为（hard：require command/passed/exit_code；soft：WARN）；保留 Return (H1 — stdout only) 段
- `review.md`：按 returnMode 分写 HARD GATE——h1 分支「⚠️ HARD GATE — Write {{HANDOFF}} BEFORE outputting H1」；json 分支「⚠️ HARD GATE — Write {{HANDOFF}} BEFORE outputting the JSON return」
- `fix.md`：确认 HARD GATE 已在（:30）；无改动

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run packages/cdd-engine/bin/tests/runner.test.mjs packages/cdd-engine/bin/tests/templates.content.test.mjs`
Expected: PASS。`pnpm run validate`。

- [ ] **Step 5: Commit**

```bash
git add packages/cdd-engine/bin/lib/runner.mjs packages/cdd-engine/templates/task/implement.md packages/cdd-engine/templates/task/fix.md packages/cdd-engine/templates/review/review.md packages/cdd-engine/bin/tests/runner.test.mjs packages/cdd-engine/bin/tests/templates.content.test.mjs
git commit -m "feat(cdd-engine): implement handoff runner 实体化 + HARD GATE 归一 + commits 单一权威（base=brief TASK_BASE / head=git；H1 h1FromHandoff）"
```

---

### Task 7: `cdd contract` 删除 + validateCommitContract 全模式接线 + progress 死字段 + status=complete（TDD）

**Files:**
- Modify: `packages/cdd-engine/bin/cdd.mjs`（删 contract subcommand + runContractCli 调用 + --clear-findings/--check-* 全部）
- Modify: `packages/cdd-engine/bin/lib/contract.mjs`（runContractCli 删除或缩为仅 --check-dirty 消费的内置；validateCommitContract 导出不变）
- Modify: `packages/cdd-engine/bin/lib/runner.mjs`（post-run 调 validateCommitContract——task 三 mode；approve 后回写 progress task.status=complete）
- Modify: `packages/cdd-engine/bin/lib/progress.mjs`（schema 删 lastDispatchHead/degradationLog；createEmptyProgress 同步）
- Modify: `packages/osuperpowers/skills/cli-driven-development/SKILL.md`（handoff-status 节点删两步 contract 调用；engine-recovery/文档化 retry 语义）
- Test: `packages/cdd-engine/bin/tests/progress.test.mjs`, `packages/cdd-engine/bin/tests/contract.test.mjs`, `packages/cdd-engine/bin/tests/runner.test.mjs`, `packages/cdd-engine/bin/tests/cdd.test.mjs`

**Interfaces:**
- Consumes: Task 5 的 deriveReviewStatus 与 schema；Task 6 的 handoff 实体化
- Produces: `cdd contract` 不存在；progress.json 无死字段；`task.status=complete` 由 runner 回写；SKILL 无 `cdd contract` 引用

- [ ] **Step 1: 写失败测试**

`progress.test.mjs`：
```js
it("progress schema 不含 lastDispatchHead/degradationLog", () => {
  // Object.keys 词法排序 —— 期望字面量用词法序，勿用插入序断言
  expect(Object.keys(createEmptyProgress("/p")).sort()).toEqual(["engineRecoveryCount","plan","tasks","timeoutCount"]);
});
it("incrementRound(/** review */) 后 rounds[review] 自增", () => { /* 既有 mode 参数化用例更新 */ });
```
`runner.test.mjs`：
```js
it("task-review APPROVED → progress task.status=complete", async () => {
  // stub handoff APPROVED + rounds[review]=1 → progress.json tasks[0].status==="complete"
});
it("post-run validateCommitContract：dirty tree → handoff BLOCKED（task-review 亦校验）", async () => {
  // dirty tree stub → BLOCKED
});
```
`cdd.test.mjs`：
```js
it("cdd contract 子命令不存在", async () => {
  // spawn cdd contract --check-dirty → exit non-zero / unknown command
});
it("branch-review 读回覆写（T5 nit4 补测）：fake harness CLI 写 warn-only CHANGES_REQUESTED branch-review handoff → 引擎覆写为 APPROVED", async () => {
  // 复用 cdd.test 既有 fake-CLI seam（PATH 注入 + registry ghost entry）；
  // 断言 branch-review-<base7>..<head7>-r1.json 文件 status 被 applyDerivedStatus 覆写为 APPROVED
});
```
Expected: FAIL。

- [ ] **Step 2: 删 cdd contract + progress 死字段（含 CLI 表层残留）**

- cdd.mjs：`.command("contract")` 块整体删除；`runContractCli` import 删；**文件头 usage 注释（:10）与 SUBCOMMAND_USAGE.contract（:40）与 `program.description`（:460「...brief/contract」）同步删除**——对未知命令路径 `process.argv[2]="contract"` 不再打出已删除子命令的 usage
- contract.mjs：`runContractCli` 删除（或迁 --check-dirty 逻辑为引擎内部用——validateCommitContract 已在 runner 接线则无外部 CLI 需求）；保留 `validateCommitContract`/`rewriteHandoffBlocked`/`git*` helpers
- progress.mjs：PROGRESS_SCHEMA required 列表删 lastDispatchHead/degradationLog；`createEmptyProgress`/migrate 返回对象同步删

- [ ] **Step 3: runner 全模式契约 + review mode 分支 + status=complete**

- contract.mjs `validateCommitContract`：新增 **review mode 分支**（mode === "review"，即归一后 task-review）：仅 dirty 校验（dirty → rewriteHandoffBlocked），跳过 head 校验（task-review handoff 的 commits 语义为被审 commit，非本 dispatch 产物）；implement/fix 保持 dirty + head 完整校验。补单测（`contract.test.mjs`：review 模式 dirty → BLOCKED；clean + handoff.commits.head 与 HEAD 不同 → 不 BLOCKED）
- runner.mjs post-run（每个 dispatch 收尾、H1 前）：`if (!dryRun) { const cv = validateCommitContract(mode, repoRoot, { handoffPath: env.CDD_HANDOFF_PATH }); if (!cv.ok) { /* rewriteHandoffBlocked 已在函数内 */ return finish(1, h1FromHandoff(...), cv.blocker, noExit); } }`——对 task 三 mode 均执行（implement/fix head 校验 + dirty；review 仅 dirty），**带 `!dryRun` 守卫**（dry-run 不写任何 handoff 不变式：dirty 工作树下 validateCommitContract 会经 rewriteHandoffBlocked 真写 BLOCKED 文件，smoke 链若恰有未提交 emit 产物即触发）
- task-review APPROVED 回写：`if (mode === "review" && normalizeHandoffStatus(handoff.status) === "APPROVED") { progressData.tasks.find(t=>t.task===taskNum).status = "complete"; writeProgressJSON(...) }`（读回握手 deriveReviewStatus 之后——见 Task 5 顺序；回写在 APPROVED 判定后）

- [ ] **Step 4: SKILL handoff-status 清理**

`cli-driven-development/SKILL.md` handoff-status 节点：删「commit-contract validation ① check-dirty ② check-head」两步，改为「engine 已在 post-run 校验 commit-contract（dirty→BLOCKED）；本节点直接读 handoff status 路由」；engine-recovery 节点注：exit-0-no-handoff（review/fix）→ BLOCKED ⇒ retry<2 重发为预期语义。

- [ ] **Step 5: emit + 跑测试确认通过**

**T7 修改了 cli-driven-development SKILL.md（handoff-status / engine-recovery）——必须先 `pnpm run emit` 再 validate**（validate 含 emit-check 块，SKILL 未 emit 即漂移 → T7 自身门槛必失败）。

Run: `pnpm run emit && npx vitest run packages/cdd-engine/bin/tests/progress.test.mjs packages/cdd-engine/bin/tests/contract.test.mjs packages/cdd-engine/bin/tests/runner.test.mjs packages/cdd-engine/bin/tests/cdd.test.mjs && pnpm run validate`
Expected: ALL PASS（emit fresh 派生 `.agents/` 无漂移；engine vitest + scripts 全绿）。

- [ ] **Step 6: Commit**

```bash
git add packages/cdd-engine/bin/cdd.mjs packages/cdd-engine/bin/lib/contract.mjs packages/cdd-engine/bin/lib/runner.mjs packages/cdd-engine/bin/lib/progress.mjs packages/cdd-engine/bin/tests/progress.test.mjs packages/cdd-engine/bin/tests/contract.test.mjs packages/cdd-engine/bin/tests/runner.test.mjs packages/cdd-engine/bin/tests/cdd.test.mjs
git commit -m "feat(cdd-engine): cdd contract 删除 + validateCommitContract 全模式接线 + progress 死字段清除 + task.status=complete 回写"
```

---

### Task 8: stale-lexicon 守卫并入 residue + cli-select 指代修复（TDD）

**Files:**
- Modify: `scripts/validate/residue.mjs`（RESIDUE_TARGETS 扩 cdd-engine；新增 stale-lexicon 断言组）
- Modify: `packages/osuperpowers/skills/cli-select/SKILL.md`（line 49「same labels as above」→ 写明白）
- Modify: `packages/cdd-engine/bin/cdd.mjs`（若 T3/T4 后仍有 `task-review`/退化名引用——作为迁移后零残留清理）
- Test: `scripts/validate/emit-check.test.mjs` 或新增 `scripts/validate/residue.test.mjs`（断言组行为）；`packages/cdd-engine/bin/tests/` 已有 grep 断言

**Interfaces:**
- Consumes: T1–T7 的命名终态（零旧名残留前提）
- Produces: `pnpm run validate` 含 stale-lexicon 断言；`RESIDUE_TARGETS` 含 cdd-engine；`dogfood (CDD session)` canonical 不误报

- [ ] **Step 1: 写失败测试 — residue 断言行为**

`scripts/validate/residue.test.mjs`（或并入 validate suite）：
```js
it("stale-lexicon：dogfood (CDD session) 下拉不误报", () => {
  expect(hasHit(['"dogfood (CDD session)"'])).toBe(false);  // 非裸 "dogfood"
});
it("stale-lexicon：labels bug, dogfood 命中", () => {
  expect(hasHit(['labels bug, dogfood, osuperpowers'])).toBe(true);
});
it("stale-lexicon：旧 mode task-review 命中（cdd-engine）", () => {
  expect(hasHit(['CDD_MODE must be implement|task-review|fix'])).toBe(true);
});
it("stale-lexicon：doc-fix- 退化名命中", () => {
  expect(hasHit(['const h = "doc-fix-1.json"'])).toBe(true);
});
it("canonical 家族名不误报：spec-review-1.json 合法", () => {
  expect(hasHit(['"spec-review-1.json"'])).toBe(false);
});
```
Expected: FAIL（断言逻辑未实现）。

- [ ] **Step 2: residue.mjs 扩展**

- `RESIDUE_TARGETS` = `["packages/osuperpowers/bin", "packages/osuperpowers/skills", "packages/cdd-engine/bin", "packages/cdd-engine/templates"]`（现仅前二者）
- 新增 `STALE_LEXICON_CHECKS` 数组（**D1/D2/D3 用 `\bD[123](?=[:：)）,.。]|[ \t]*(?:—|-|\.))` 限 lens 注释语境**，避免命中 contract.mjs 现存合法注释「spec D1/D4/D5a」与「dirty working tree（D2）」——该两注释本就不属本 phase 改动清单；或 pattern 简化为 `D[123]:` 前缀形式）：
  ```js
  { label: "old docs-review filename", re: /docs-review\.md/, scope: [...skills, ...cddEngine] },
  { label: "PASS= lens param", re: /PASS=</, ... },
  { label: "lens names D1|D2|D3 (lens-context)", re: /\bD[123]:/, ... },
  { label: "resolve-hit", re: /resolve-hit/, ... },
  { label: "gh issue reopen", re: /gh issue reopen/, ... },
  { label: "old mode task-review", re: /task-review/, scope: cddEngineBin },
  { label: "P4 degraded names", re: /(spec|plan)-1\.json|doc-fix-/, scope: cddEngine },
  { label: "flat docs-review root 回退", re: /\.superpowers\/docs-review/, scope: cddEngineBin },
  { label: "dogfood as label", re: /labels [^\n]*dogfood|"dogfood",/, scope: osuperpowerSkills },
  ```
- `checkZeroResidue` 后新增 `checkStaleLexicon()`：逐 check 跑 target glob，命中即 throw（除非命中行属于 canonical 合法语汇白名单——白名单为空，通过「grep 模式本身不匹配 canonical 语汇」实现，见 Step 1 测试）
- **块数不变（13）**：`checkStaleLexicon` **并入既有 5c.run 同一步内部**（先 checkZeroResidue 再 checkStaleLexicon），steps.length 保持 13；该 step 的 `grepTargets` meta 扩展为含 `packages/cdd-engine/bin`+`templates` 供 wiring guard（ci-validate.test.mjs `steps.find(s=>s.name.startsWith("5c."))`）钉死——不新增独立 step，避免步数漂移与同名前缀取错对象

- [ ] **Step 2b: smoke-cdd.mjs 旧命名同步（nit）**

`scripts/validate/smoke-cdd.mjs`：line 43/50 硬编码的 `task-1-task-review-1.json`（含「real run 产出 …」注释）→ `task-1-review-1.json`；同步其 H1 链断言中的旧名引用（与 Task 4 命名统一一致，避免 stale-lexicon 断言漏网 + P6 后注释失真）。

- [ ] **Step 3: cli-select 指代修复**

`cli-select/SKILL.md` line 49 `Invoke osuperpowers:report-issue; same labels as above` → `Invoke osuperpowers:report-issue`（无 manual labels — per-finding comments carry none；仅 session master 带 `session, osuperpowers`）。

- [ ] **Step 4: 迁移后零残留清理**

`grep -rn "task-review\|spec-1\.json\|plan-1\.json\|doc-fix-" packages/cdd-engine/bin packages/cdd-engine/templates` —— 若有命中（T3/T4 漏网），清理至零（含注释与测试夹具）。

- [ ] **Step 5: 跑测试 / validate**

**T8 Step 3 修改了 cli-select SKILL.md — 必须先 `pnpm run emit` 再 validate**（`pnpm run validate` 第 0 块 emit freshness 因 `.agents` 未重派生而漂移失败，与 T7 Step 5 同理）。

Run: `pnpm run emit && npx vitest run scripts/validate/residue.test.mjs && pnpm run validate`
Expected: ALL PASS（含 5c residue 单步内双断言；emit fresh）。

- [ ] **Step 6: Commit**

```bash
git add scripts/validate/residue.mjs packages/osuperpowers/skills/cli-select/SKILL.md packages/osuperpowers/.agents packages/cdd-engine/bin scripts/validate
git commit -m "feat(validate): stale-lexicon 机制位置守卫并入 residue（RESIDUE_TARGETS 扩 cdd-engine；零豁免）+ cli-select 指代修复"
```

---

### Task 9: F2 writing-plans Spec 头 + F6 归档 + emit + changeset + 收官验证（TDD）

**Files:**
- Modify: `packages/osuperpowers/skills/writing-plans/SKILL.md`（write-plan 节点补 `**Spec:**` 头产出约定）
- Modify: `docs/maintainers/skill-authoring.md`（若含 plan 模板约定则同步——可选）
- Modify: `packages/osuperpowers/skills/cli-driven-development/SKILL.md`（T7 未提交部分——SKILL.md 变更归此处 emit）
- 归档操作（非代码）：`.superpowers/docs-review/` 全部现有产物 → `archive-<date>/`
- Test: `packages/osuperpowers/tests/`（若 writing-plans 有直测）；`pnpm run emit:check`（SKILL 变更后 emit）

**Interfaces:**
- Consumes: T1–T8 全部产出的最终状态
- Produces: writing-plans 新 plan 头部含 `**Spec:**` 链接；flat `.superpowers/docs-review/` 已废弃无旧产物；`.superpowers/cdd/<slug>/` 复核通过；emit fresh；changeset

- [ ] **Step 1: writing-plans write-plan 节点补 Spec 头**

`write-plan` 节点 Do 字段追加：
> Plan 头部在第 2 行产出 `**Spec:** [<name>-design.md](…)`（与 plan-review `--spec` 同源；report-issue resolve-destination 程序链首跳依赖）。

- [ ] **Step 2: F6 归档收尾复核**

> 首次归档已于 **Phase-0** 完成（flat `.superpowers/docs-review/` 整体移入 archive 并废弃）。T9 复核：
> ① `ls .superpowers/docs-review/` 应无 `.json`（flat root 已废弃、Phase-0 后无新写）；
> ② `.superpowers/cdd/<slug>/`（本 phase slug）应含规范名 handoff（spec-review-*/plan-review-*/task-*-review-*/branch-review-*；无 `spec-1.json`/`plan-1.json`/`doc-fix-*.json` 型残名——T3 后 doc-fix 退位模板名）；
> ③ `.superpowers/cdd/` 根杂讯目录（`p|plan|smoke-*|test-plan-br|.tmp-*|.test-fixtures`）已移入 `.archive-2026-09-08`。
> 未达标项补移入对应 archive。

- [ ] **Step 3: emit + validate**

Run: `pnpm run emit && pnpm run validate`
Expected: emit 派生 `.agents/` 无漂移（writing-plans SKILL 变更触发）；validate ALL PASS（保持 13 块，5c 单步内 zero-residue + stale-lexicon 双断言）。

- [ ] **Step 4: changeset**

```bash
pnpm run changeset   # type: minor；说明：P6 Handoff 契约统一（handoff-namespace + status 单一权威 + implement 实体化 + cdd contract 删 + residue 守卫）
```
> 或手写 `.changeset/p6-cdd-engine-overhaul.md`（格式对齐既有 changeset）。

- [ ] **Step 5: Commit**

```bash
git add packages/osuperpowers/skills/writing-plans/SKILL.md packages/osuperpowers/.agents packages/cdd-engine .changeset
git commit -m "feat(skills): writing-plans plan **Spec:** 头约定 + F6 workspace 收编复核 + changeset（P6 收官）"
```

---

## Self-review（write-plan 后、plan-review 前）

**1. Spec coverage**：
- F1（progress 回写 + cdd contract）→ T7 status=complete + cdd contract 删除；progress 死字段清除
- F2（Spec 头）→ T9 Step 1
- F3（status rollup）→ T5 deriveReviewStatus + schema conditional
- F4（Bug C implement）→ T6 implement 实体化 + HARD GATE + retry 文档化（T7 SKILL）
- F5（守卫脚本化）→ T8 residue stale-lexicon
- F6（命名/Workspace 收口）→ T1 canonical + T3/T4 命名统一 + T3 workspace 接线 + Phase-0 归档 + T9 复核
- reviews.json 裁轴 → T2
- handoff-namespace/canonical + 派生五函数（含 resolveWorkspace）→ T1
- workspace 单一根（`.superpowers/cdd/<slug>/` + flat docs-review 废弃 + cdd/ 根杂讯清理）→ T3 + Phase-0 + T8（flat root 零引用）+ T9
- status 单一权威 + SP-4 豁免 → T5 + T7 验证契约
- cdd contract 删除 → T7
- validateCommitContract 全模式接线（dirty 仅 runner 三 mode）→ T7
- implement 实体化 + commits 单一权威 + H1 h1FromHandoff → T6
- HARD GATE returnMode 分写 → T6
- stale-lexicon 零豁免 + RESIDUE_TARGETS 扩 cdd-engine + flat root 断言 → T8
- cli-select 指代修复 → T8
- F6 归档范围（整体）→ Phase-0 + T9 Step 2

**2. Placeholder 扫描**：无 TODO/TBD；Step 4 的实现「精确改点以测试 + validate 为 contract」为 TDD 引导语，非待办占位。

**3. Type consistency**：`handoffName(op,type,params)`/`roundPattern(op,type,opts)`/`resolveNextRound(ws,op,type,opts)`/`prevHandoffPath(ws,op,type,round,opts)`/`resolveWorkspace(doc)` 签名跨 T1–T7 一致；`deriveReviewStatus(handoff)` 于 T5 定义、T6/T7 消费；`status="complete"` 于 T7 写入 progress。canonical family key `{op}.{type}`（`review.spec`/`fix.task`）+ 顶层 `workspaceRoot`/`slugRule` 全 plan 一致。

**任务边界检查**：9 个 task 各自独立可测（canonical→消费→命名→status→实体化→契约→守卫→收口），无跨 task 接口依赖缺口（T3 消费 T1 派生层、T5 消费 T1 status 族、T6 消费 T4 命名、T7 消费 T5 derive——均已前置）。

**Spec 头引用**：`**Spec:**` 行指向 p6-design **v1.3**（与 T9 要固化的约定一致）。

**Grilling-as-review 记录（user 引导，plan-4 之后的 workspace 上探）**：
- plan-review engine 两轮（plan-3 CHANGES_REQUESTED 2 blocker → 修 12 项 → plan-4 **blocker=0** 8 warn+5 nit → 修 13 项）已覆盖内容主体（命名/status/实体化/契约/守卫）
- 随后 user 指出两个 workspace 问题（① 产出应收编 `.superpowers/cdd/` ② 即便 docs-review 也应有 per-slug 目录）→ 取证证实 **flat `.superpowers/docs-review/` 跨 phase round 污染真实存在**（P4 plan-1/2.json 把 P6 plan round 顶到 3）→ user 选 A 单根 → user 追问「统一规划抽象」→ 上探为 **workspace 归入 artifact 契约派生层**（canonical 增 workspaceRoot/slugRule + 第五派生函数 resolveWorkspace + `workspaceSlug`；4 处推导点 → 单函数；flat root 废弃）
- overall 同步 **v1.21**、spec 同步 **v1.3**、本 plan 全文同步（Phase-0 含 flat root 归档 + cdd/ 根杂讯清理、T1/T3/T8/T9 相应改点）
- 引擎 Review Stopping：同 ref（`--doc` 路径不变）plan-4 已 blocker=0 → 重审被拒（exit 3，合法 backstop、无 bypass 路径）；grilling 即 workspace delta 的人工 review（user 决策分支逐层审查），与 plan-4 引擎审合为完整覆盖