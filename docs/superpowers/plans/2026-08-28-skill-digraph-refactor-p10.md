# 技能 digraph 重构 P10 实现计划 — CDD Engine Bug Fixes

- **Version**: v1.0 · 2026-08-28
- **Status**: Approved
- **Author**: [human] · Claude Opus 4.8 (osuperpowers:writing-plans 产出)
- **Parent**: [P10 design spec v1.0](2026-08-28-skill-digraph-refactor-p10-design.md) · [overall v1.19c](2026-08-24-skill-digraph-refactor-overall.md)
- **design-spec**: `docs/superpowers/specs/2026-08-28-skill-digraph-refactor-p10-design.md`

---

## Global Constraints

- **Conventional commits**（`fix:`/`docs:`/`refactor:`），无 attribution/co-author
- **不 commit** 除非 user 明确要求；changeset 仅 P13 统一建（程序级豁免）
- **Strategy A**：SKILL.md/docs 英文主源；zh-CN 镜像同步
- **CDD engine dispatch（强制）**：dev 阶段走 `cdd-task.mjs` 完整链路（harness 选择 → workspace → generateBrief → implement → handoff → task-review → fix → ledger → Final Review），禁止手动执行 plan steps
- **Background execution（强制）**：所有 CLI mode 调用 background 执行
- **timeout 职责边界**：P10 不涉及 spawnCapture timeout（P12 scope）；P10 改动范围仅限 runner.mjs validator（#187 归一化）
- **Orchestrator handoff 检查义务**：`cdd-task.mjs` 返回后必须读 handoff.json 判断状态，不可凭 stdout 判变更
- **per-file 行数**：SKILL.md ≤ 200（节点锚定式天然约束，不硬卡）；templates/cdd/* ≤ 60
- **每个 task 1 atomic commit**（P10 design §5 commit 策略）

---

## §A — #190 Engine CLI 路径修复（Task 1）

### Task 1: package.json bin + skill 节点 CLI 路径 + sub-docs 同步

**Goal**: 所有 skill 节点 CLI 调用改为 `node {pluginRoot}/bin/engine/cdd-*.mjs --harness ...`，`package.json` 新增 bin 声明。

**Steps**:
1. `packages/osuperpowers/package.json` 新增 `bin` 字段（`cdd-review` / `cdd-task` / `cdd-select` / `cdd-session-activate` → `./bin/engine/*.mjs`）
2. `skills/brainstorming/SKILL.md` 的 `spec-review` 节点：CLI 调用改 `node {pluginRoot}/bin/engine/cdd-review.mjs --harness claude --template spec-review ...`
3. `skills/writing-plans/SKILL.md` 的 `plan-review` 节点：同上
4. `skills/cli-driven-development/SKILL.md` 的 `dispatch-mode` / `branch-review` 节点：改 `cdd-task.mjs` / `cdd-review.mjs` 调用
5. `skills/brainstorming/docs/docs-review.md`：spec-review 命令同步
6. `skills/cli-driven-development/docs/cdd-reference.md`：H6 CLI 引用同步
7. `.zh-CN.md` 镜像同步（brainstorming / writing-plans / cli-driven-development / 各自 sub-docs）
8. 验证：`grep -rE "cdd-(review|task|select|session-activate) --harness" skills/` 裸 PATH 名归零（排除 bin 声明 + 测试断言）

**Acceptance**:
- AC#1（grep 裸 PATH 名归零）
- AC#2（package.json bin 声明就位）
- AC#7（zh-CN 同步）

---

## §B — #187 Fix 模式 status DONE 残留（Task 2）

### Task 2: fix.md 模板禁止 DONE + runner.mjs validator 归一化 + 测试

**Goal**: fix 模式 handoff status 强制 APPROVED（模板层禁止 + validator 归一化），顶层 status 翻转闭环。

**Steps**:
1. `templates/cdd/fix.md`：handoff-write 指令明确 `status: APPROVED`（fix 成功 + blocker none）或 `status: BLOCKED`，禁止 `DONE`/`OK`/`COMPLETED`
2. `bin/engine/lib/runner.mjs`：handoff status reader（`handoffStatus()` 函数内）新增归一化 switch：`DONE`/`OK`/`COMPLETED` → `APPROVED`，其余不变（UNKNOWN/MISSING 保持原行为）
3. `bin/engine/lib/runner.mjs` fix 模式 re-review 后顶层 status 翻转：**精确机制**（与 spec §2.2 step 3 对齐）：
   - fix 模式 re-review 返回后，`runner.mjs` 读 handoff.json `status` 字段（已由归一化 Step 2 处理，`DONE`→`APPROVED`）
   - 检查 `blocker` 字段是否为 `"none"` + `status` 是否已归一化为 `APPROVED`
   - 两者满足 → re-review 成功，顶层 status 由 `CHANGES_REQUESTED` 翻转为 `APPROVED`（`isTaskPending()` 在 `contract.mjs` 中判定 status≠APPROVED 为 pending，翻转后 pending=false）
   - 精确边界：翻转发生在外层 orchestrator 读 handoff 时——`dispatch-mode` 返回后 handoff-status 节点读 status，归一化后的 `APPROVED` 路由至 `task-complete?` 节点（即 P8 的 `handoffStatus()` 已处理，归一化是本 step 2 的新增）
4. `skills/cli-driven-development/SKILL.zh-CN.md` 同步（#144 决策节点内容随 Task 3 在 §C 处理）
5. `bin/engine/tests/contract.test.mjs`：新增 `DONE`/`OK`/`COMPLETED` → `APPROVED` 归一化 case（验证 Step 2 归一化逻辑）
6. `bin/engine/tests/templates.test.mjs`：新增 fix.md 渲染后 handoff 指令不含 DONE 关键词 case（验证 Step 1 模板层禁止）
7. 验证：`pnpm run validate`（engine tests 绿）

**Acceptance**:
- AC#3（fix.md 模板禁止 DONE）
- AC#4（runner.mjs validator 归一化 + contract.test.mjs case）
- AC#8（validate 绿）

---

## §C — #144 Engine 失败恢复路径（Task 3）

### Task 3: handoff-status 改 engine-recovery 决策节点 + Invariant I6 + digraph

**Goal**: `handoff-status` BLOCKED 出口改 `engine-recovery` 决策节点（可修复→重 dispatch；不可修复→BLOCKED；retry<2 硬上限），新增 Invariant I6。

**Steps**:
1. `skills/cli-driven-development/SKILL.md` `handoff-status` 节点：BLOCKED 出口改 `engine-recovery` 决策节点（digraph：`D -->|BLOCKED| R{engine-recoverable?}` → `R -->|yes, fixable & retry<2| C[dispatch-mode]` / `R -->|no| Z3((BLOCKED: engine-error))`）
2. 新增 `engine-recovery` 节点定义（Do：读 blocker 字段判可修复性；可修复+retry<2→重 dispatch 同 mode；不可修复/retry≥2→BLOCKED。**retry 计数器 —— plan 偏差声明（deliberate deviation from spec §2.3 step 4）**：spec §2.3 说复用 `handoff.json.retryCount`（engine 层 runner.mjs 管理），plan 改为 `progress.md` 的 `engine-recovery-count`（skill 层 orchestrator 管理）。理由：P10 scope 限定「不改控制流」（design §1 范围边界），runner.mjs 当前无 retry 基础设施，retry 是 skill digraph 的 `engine-recovery` 决策节点逻辑（orchestrator 层），非 engine 循环——由 orchestrator 跨 re-dispatch 保留计数，不改 runner.mjs。此偏差须在 P10 design spec 的 §5 Tasks 表同步更新）
3. 新增 Invariant I6（No Controller Bypass）：engine 可用时禁止 controller 手写绕过 engine
4. `skills/cli-driven-development/SKILL.zh-CN.md` 同步
5. 验证：digraph 含 `engine-recovery` 节点 + retry<2 约束；I6 在 Invariants 表

**Acceptance**:
- AC#5（handoff-status BLOCKED → engine-recovery 决策节点入图）
- AC#6（Invariant I6 就位）
- AC#7（zh-CN 同步）

---

## §D — #145 Deferred fix 必须走 engine（Task 4）

### Task 4: Rule 禁止绕过 engine + Failure Modes 降级行 + 测试桩

**Goal**: deferred findings 修复必须通过 `--mode fix` dispatch，禁止 controller 手写 fix；降级路径（retry≥2 + engine 不可用）允许手写 + progress.md 记录。**Depends on Task 3**（I6 + handoff-status 节点须先就位，Task 4 的 Rule 补充 I6 的具体约束）。

**Steps**:
1. `skills/cli-driven-development/SKILL.md` 新增 Rule（或节点 Do 字段强调）：deferred fix 必须走 `--mode fix`（deferred-disposition fix-now → deferred-sweep-loop），禁止 controller 手写
2. Failure Modes 表新增行：`controller bypass engine | implicit fail-open (降级) | engine 完全不可用时的手写修复 | 记录降级原因到 progress.md；engine 恢复后补 --mode fix re-review`
3. **测试桩**：`--mode fix` dispatch 路径由 `deferred-sweep-loop` 节点设计保证（P8 验收 ④），P10 不新增 engine 单测——spec §2.4 step 4 的 runner.test.mjs case **降级为 grep 校验**（与 spec §2.4 step 4 偏差：engine test 改为 grep `controller bypass` 在 Failure Modes 中命中，理由：skill 层 Rule 仅可通过 SKILL.md grep 校验，engine 单测无法验证 controller 行为）
4. `skills/cli-driven-development/SKILL.zh-CN.md` 同步
5. 验证：grep `controller bypass` 命中（Failure Modes 降级行就位）；engine tests 绿

**Acceptance**:
- AC#6（#145 Rule + Failure Modes 降级行就位）
- AC#7（zh-CN 同步）
- AC#8（validate 绿）

---

## Final Review

全部 4 task 完成后，运行 `cdd-review.mjs --mode branch-review`（Final Review HARD-GATE）：
- BASE 读 `base-branch.json`（P8 artifact）
- 无 blocker → handoff-finishing；有 blocker → branch-fix-loop
- 报告 findings 给用户，不 auto-merge

**Full acceptance gate**: AC#1-#9 全绿（`pnpm run emit && pnpm run validate` + grep 终扫 + CDD execution 产物）

---

## Change history

- v1.0 · 2026-08-28 — 初版（P10 plan，4 task 对应 4 issue；§A-§D 工作块 + ### Task N: 兼容 generateBrief）
