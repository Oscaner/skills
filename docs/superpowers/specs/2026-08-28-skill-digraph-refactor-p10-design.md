# 技能 digraph 重构 P10 — CDD Engine Bug Fixes

- **Version**: v1.0 · 2026-08-28
- **Status**: Approved
- **Author**: [human] · Claude Opus 4.8 (osuperpowers:brainstorming dogfood session)
- **Parent**: [overall spec v1.19b](2026-08-24-skill-digraph-refactor-overall.md) — Phase P10

---

## 1. 背景与目标

P4-P9 完成 5 个技能的节点锚定式重构，但 CDD engine 与 skill 文本仍有 4 个契约级 bug 未闭环：

| Issue | 类型 | 根因 |
|---|---|---|
| #190 | bug | skill 节点写 `cdd-review --harness ...` 当 PATH 命令，marketplace 安装后不在 PATH |
| #187 | bug | fix 模式 re-review 仍写 `status: DONE`（非 APPROVED），P8 只修了 implement 模式 |
| #144 | bug | CDD skill 未定义 engine 失败恢复路径，controller 手写绕过 engine |
| #145 | bug | 全流程零使用 `--mode fix`，所有 deferred fix 由 controller 手写绕过 engine |

**目标**：统一修复这 4 个 bug，让 CDD engine 在分发通道下可正确调用、状态机契约完整、失败有恢复路径、controller 不再绕过 engine。

**范围边界**（来自 overall spec v1.19 P10）：
- 仅修 engine 契约层 + skill 文本层，**不改控制流**（与 P8 引擎豁免同口径：限契约层，不改 control flow）
- #144/#145 的"禁止绕过 engine"作为 skill 层 Invariant / Rule 固化，非引擎行为修改
- 涉及文件：`packages/osuperpowers/package.json`（bin 声明）、`bin/engine/lib/runner.mjs`（validator + 顶层 status 翻转 + timeout 预留）、`bin/engine/lib/ledger.mjs`（status=APPROVED 时 appendLedger 翻转逻辑复用）、`templates/cdd/fix.md`（模板层）、`skills/cli-driven-development/SKILL.md`（决策节点 + Rule）、`skills/{brainstorming,writing-plans,finishing}/SKILL.md`（CLI 路径文本）+ 对应 sub-docs

---

## 2. 设计

### 2.1 #190 — Engine CLI 路径修复

**现状**：
- `bin/engine/` 下 4 个 CLI：`cdd-review.mjs` / `cdd-task.mjs` / `cdd-select.mjs` / `cdd-session-activate.mjs`
- marketplace / `pi install` 通道安装时，`package.json` 的 `bin` 映射不进用户 PATH（`which cdd-review` → not found）
- skill 文本写 `cdd-review --harness ...`（裸 PATH 名），sub-docs 写 `cdd-review.mjs`（相对引用）——两者不一致

**方案 A（已确认）**：
1. `packages/osuperpowers/package.json` 新增 `bin` 字段（**目的：供 harness / 外部脚本 / 调试场景直接调用**，如 `cdd-task --harness claude --task 1 --mode implement`）：
   ```json
   {
     "bin": {
       "cdd-review": "./bin/engine/cdd-review.mjs",
       "cdd-task": "./bin/engine/cdd-task.mjs",
       "cdd-select": "./bin/engine/cdd-select.mjs",
       "cdd-session-activate": "./bin/engine/cdd-session-activate.mjs"
     }
   }
   ```
   > **bin 与 node 路径的关系**：bin 声明供 marketplace install 后**开发调试 / harness 原生调用**场景；但 skill 文本内的 CLI 调用**一律用 `node {pluginRoot}/bin/engine/cdd-*.mjs` 兜底**——因为 marketplace / `pi install` 通道下 bin 不进用户 PATH（`which cdd-review` → not found），skill 节点不能依赖 bin。两者并存：bin 是"nice-to-have 外部入口"，node 路径是"in-skill 可靠调用"。
   > 注：`{pluginRoot}` 是 skill 标准约定（brainstorming Read Upstream 已在用），消费者环境通过 marketplace install 后 AI 据 SKILL.md 位置推导 pluginRoot。

2. 所有 skill 节点 CLI 调用改为完整 `node` 命令：
   ```
   node {pluginRoot}/bin/engine/cdd-review.mjs --harness claude --template spec-review ...
   node {pluginRoot}/bin/engine/cdd-task.mjs --harness claude --task N --mode implement
   ```
   统一 `node` + `.mjs` 后缀，消除 `cdd-review`（裸 PATH）与 `cdd-review.mjs`（相对引用）的不一致。

3. sub-docs（`docs-review.md` / `cdd-reference.md` 等）同步更新调用约定到 `node {pluginRoot}/bin/engine/cdd-*.mjs`。

**影响范围**：
- `skills/brainstorming/SKILL.md` — spec-review 节点
- `skills/writing-plans/SKILL.md` — plan-review 节点
- `skills/cli-driven-development/SKILL.md` — dispatch-mode / branch-review 节点
- `skills/finishing/SKILL.md` — 经核查 finishing 不引用 engine CLI（仅 merge/PR 操作），**从 #190 范围排除**；若后续发现引用则补
- `skills/brainstorming/docs/docs-review.md` — spec-review 命令
- `skills/cli-driven-development/docs/cdd-reference.md` — H6 CLI 引用
- `.zh-CN.md` 镜像同步

### 2.2 #187 — Fix 模式 status DONE 残留

**现状**：
- P8 修复（a86fa98）：implement 模式 status 统一 APPROVED（DONE 废除），`_handoff-write-fragment.md` + `runner.mjs` 兜底改写
- **P9 dogfood 重现**：fix 模式的 re-review 仍写 `status: DONE`，且顶层 status 不从 CHANGES_REQUESTED 翻转为 APPROVED
- 精确边界：task-review 正确写 APPROVED，fix 模式 re-review 漏翻

**方案（双管齐下，已确认）**：
1. **模板层**：`templates/cdd/fix.md` 的 handoff-write 指令明确要求：
   - fix 成功 + blocker 为 none → `status: APPROVED`
   - fix 失败 / 有 blocker → `status: BLOCKED`
   - 禁止 `DONE` / `COMPLETED` / `OK` 等非标状态
2. **validator 层**：`runner.mjs` 的 handoff status reader 把 `DONE` / `OK` / `COMPLETED` 等同义非标状态**归一化为 `APPROVED`**（容错兼容历史数据）
   - 与 implement 模式统一：P8 已实现 implement 的归一化，fix 模式复用同一逻辑
3. **顶层 status 翻转机制（闭环）**：fix 模式 re-review 写 `status: APPROVED` 后，顶层 status 由 `CHANGES_REQUESTED` 翻转为 `APPROVED`，复用 P8 implement 的翻转逻辑（**实现位置**：`bin/engine/lib/runner.mjs` 的 `handoffStatus()` 归一化 + `validateCommitContract` 旁的状态机判断；ledger 写入在 `bin/engine/lib/ledger.mjs` 的 `appendLedger`，仅当 status=APPROVED 时追加 `Task N: complete`）：
   - `runner.mjs` 在 fix 模式 re-review 成功（status=APPROVED）时，检查是否有未解决 blocker
   - 无未解决 blocker → 顶层 status 翻转 APPROVED（与 implement 模式同路径）
   - 精确边界：fix 模式 re-review 走与 task-review 相同的 status 写入路径，确保 `CHANGES_REQUESTED → APPROVED` 翻转不被漏处理（P9 dogfood 复现的根因是 fix re-review 走了独立的 status 写入分支，未触发翻转）

**测试桩**：
- `contract.test.mjs` 新增：`DONE`/`OK`/`COMPLETED` → `APPROVED` 归一化 case
- `templates.test.mjs` 或 `task.test.mjs` 新增：fix.md 模板渲染后 handoff 指令禁止 DONE 关键词

### 2.3 #144 — Engine 失败恢复路径

**现状**：
- 当前 `handoff-status` 节点：`D -->|BLOCKED| Z3((BLOCKED: engine-error))` —— 终态，无恢复指导
- Failure Modes 表 recovery 列说"Report via report-issue" —— 这是放弃不是恢复
- #144 核心：engine 失败后 controller 手写绕过，因为 skill 没有"修复后重试"路径

**方案（BLOCKED 改决策节点，已确认）**：
1. `handoff-status` 节点的 `BLOCKED` 出口从终态改为 **决策节点 `engine-recovery`**：
   ```
   D -->|BLOCKED| R{engine-recoverable?}
   R -->|yes, fixable & retry<2| C  (重 dispatch dispatch-mode 同 mode)
   R -->|no| Z3((BLOCKED: engine-error))
   ```
   > retry<2 硬上限在决策节点内部维护（与 fix-loop 计数器同模式）；超过则强制 `no` 分支。
2. `engine-recovery` 节点：
   - **Do**：读 handoff `blocker` 字段，判断可修复性
   - **可修复**（如 dirty tree → commit；missing handoff → retry dispatch）：修复后重 dispatch 同 mode
   - **不可修复**（engine bug / `<missing>` handoff / 未知错误）：report-issue + BLOCKED 终态
   - **hard cap ≤ 2 retry**：超过则强制 BLOCKED 终态（防无限循环）
   - **retry 计数器**：`engine-recovery` 节点内部维护（与 fix-loop 计数器同模式）
3. 新增 **Invariant I6（No Controller Bypass）**：engine 可用时，controller 禁止手写实现绕过 engine（除非降级路径显式触发——见 #145 降级）
4. digraph 局部片段（步骤 1 已呈现；此处补充 `engine-recovery` 节点内部逻辑）：
   - 读 blocker 字段 → 判断可修复性
   - 可修复 + retry<2 → 重 dispatch 同 mode（回到 `dispatch-mode`）
   - 不可修复 / retry≥2 → BLOCKED: engine-error 终态
   - **retry 计数器存储**：复用 fix-loop 计数器同一字段——`handoff.json` 的 `retryCount`（位于 handoff 顶层，与 fix-loop 计数器同字段同存储）；跨 re-dispatch 保留计数（engine-recovery 重 dispatch 时 runner.mjs 读取并递增该字段，不新建独立字段）

**影响范围**：
- `skills/cli-driven-development/SKILL.md` — `handoff-status` 节点 + 新增 `engine-recovery` 节点 + Invariants 表 I6
- `.zh-CN.md` 同步

### 2.4 #145 — Deferred fix 必须走 engine

**现状**：
- #145：全流程零使用 `--mode fix`（controller 实际手写所有 deferred fix），但 digraph 的 `deferred-sweep-loop` 节点**设计上已走 `--mode fix`**（fix dual-channel: deferred-sweep）——即设计路径存在，仅被 controller 实际绕过
- 影响：CDD 三模式链第三个模式完全未使用；手写 fix 没有 commit gate / re-review 保护

**方案（已确认）**：
1. **Rule（cli-driven-development）**：deferred findings 的修复**必须通过 `--mode fix` dispatch**（deferred-disposition 决策 fix-now 时走 deferred-sweep 通道），**禁止 controller 手写 fix**
2. **降级路径**（显式触发）：engine 完全不可用（exit 3 / harness 缺失 / **retry 计数达到 #144 的 ≤2 硬上限（retry≥2）**）时允许 controller 直接修复，但**必须在 `progress.md` 记录降级原因**（severity + summary + reason）
3. **Failure Modes 表新增行**：
   | controller bypass engine | **implicit fail-open** (降级) | engine 完全不可用时的手写修复 | 记录降级原因到 progress.md；engine 恢复后补 `--mode fix` re-review |
4. **测试桩**（Task 4 验收）：
   - `cli-driven-development/SKILL.md` 的 Rule 段（或节点 Do 字段）明确禁止 controller 手写 fix，仅在 engine 不可用时允许降级 + progress.md 记录
   - 新增 `runner.test.mjs` 或 `task.test.mjs` case：模拟 deferred fix 场景，验证 `--mode fix` dispatch 路径（非 controller 手写）被触发
   - Failure Modes 降级行就位（grep `controller bypass` 命中即验证）
5. **existing digraph（unchanged）**：
   ```
   H[deferred-disposition] -->|fix-now| I[deferred-sweep-loop]
   H -->|carry-skip| K[branch-review]
   ```
   现有 deferred-sweep-loop **设计上已走 `--mode fix`**（见 P8 验收 ④），本 task 仅需固化 Rule 禁止 controller 绕过，**不改图结构**——澄清："全流程零使用 --mode fix" 指 controller 实际行为，非 digraph 设计

**影响范围**：
- `skills/cli-driven-development/SKILL.md` — 新增 Rule 段（或节点 Do 字段强调）+ Failure Modes 表新增行
- `.zh-CN.md` 同步

---

## 3. Behavior Changes

| 变更 | Before | After |
|---|---|---|
| skill 节点 CLI 调用 | `cdd-review --harness ...`（PATH 命令） | `node {pluginRoot}/bin/engine/cdd-review.mjs --harness ...` |
| fix 模式 handoff status | 可能写 `DONE` | 强制 `APPROVED`（模板禁止 + validator 归一化） |
| `handoff-status` BLOCKED 出口 | 终态 BLOCKED: engine-error | 决策节点 `engine-recovery`（可修复→重 dispatch；不可修复→BLOCKED） |
| controller 绕过 engine | 无约束 | Invariant I6 禁止 + 降级必须记录 progress.md |

---

## 4. Acceptance Criteria

1. 所有 skill 节点 CLI 调用改为 `node {pluginRoot}/bin/engine/cdd-*.mjs --harness ...` 形式（grep `cdd-review \| cdd-task \| cdd-select \| cdd-session-activate ` 裸 PATH 名归零，排除 bin 声明与测试断言；cdd-session-activate 虽在 bin 声明但不被任何 skill 文本裸名引用，验收覆盖以防回归）
2. `packages/osuperpowers/package.json` bin 声明就位（`cdd-review` / `cdd-task` / `cdd-select` / `cdd-session-activate`）
3. `templates/cdd/fix.md` 模板层禁止 `DONE`/`OK`/`COMPLETED` 状态（渲染后 handoff 指令仅 `APPROVED`/`BLOCKED`）
4. `runner.mjs` validator 层 `DONE`/`OK`/`COMPLETED` → `APPROVED` 归一化（contract.test.mjs 新增 case）
5. `handoff-status` BLOCKED → `engine-recovery` 决策节点入图（digraph 可见：可修复→重 dispatch；不可修复→BLOCKED；hard cap ≤ 2）
6. cli-driven-development 新增 Invariant I6（No Controller Bypass）+ #145 Rule（deferred fix 必须走 `--mode fix`）+ Failure Modes 降级行
7. zh-CN 镜像同步（cli-driven-development SKILL.zh-CN.md）
8. `pnpm run emit && pnpm run validate` 绿
9. CDD execution: workspace 存在 + 全 task handoff.json + ledger 全 APPROVED + Final Review 产物

---

## 5. Tasks & Commits

P10 建议 4 task（对应 4 issue）：

| Task | Issue | Scope | Commit 策略 |
|---|---|---|---|
| Task 1 | #190 | package.json bin + skill 节点 CLI 路径 + sub-docs 同步 | 1 atomic commit |
| Task 2 | #187 | fix.md 模板禁止 DONE + runner.mjs validator 归一化 + 测试 | 1 atomic commit |
| Task 3 | #144 | handoff-status 改 engine-recovery 决策节点 + Invariant I6 + digraph | 1 atomic commit |
| Task 4 | #145 | Rule 禁止绕过 engine + Failure Modes 降级行 + 测试桩 | 1 atomic commit |

> 注：每个 task 走完整 CDD 三模式链（implement → task-review → fix if needed → ledger），Final Review（branch-review）在全部 task 完成后运行。

---

## Change history

- v1.0 · 2026-08-28 — 初版（P10 design spec，基于 grilling 决策：#190 方案 A / #187 双管齐下 / #144 决策节点 / #145 Rule）
