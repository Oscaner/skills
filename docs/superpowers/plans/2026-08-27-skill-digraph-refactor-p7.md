# Skill Digraph Refactor — P7: cli-select 重构 Implementation Plan

- **Date**: 2026-08-27
- **Spec**: `docs/superpowers/specs/2026-08-27-skill-digraph-refactor-p7-design.md` (v1.1)
- **Overall**: `docs/superpowers/specs/2026-08-24-skill-digraph-refactor-overall.md` (v1.14)
- **Branch**: `skill-digraph-refactor-p7`
- **Author**: [human] · Claude Opus 4.8 (osuperpowers:writing-plans dogfood session)

## Overview

将 `packages/osuperpowers/skills/cli-select/SKILL.md` 从 Rules 散文 + Red Flags 重写为节点锚定式（digraph 唯一控制流真相源：2 操作节点 detect/ask + BLOCKED engine bug 终态 + APPROVED 隐式终态），同步更新跨 skill anchor（cli-driven-development 的 `#rule-ask` → `#ask`）与 zh-CN 镜像。

## Scope

| 任务 | 文件 | 产出类型 |
|---|---|---|
| Task 1 | `packages/osuperpowers/skills/cli-select/SKILL.md` + `SKILL.zh-CN.md` | 重写（节点锚定式）+ 中文镜像 |
| Task 2 | `packages/osuperpowers/skills/cli-driven-development/SKILL.md` + `SKILL.zh-CN.md` | 跨 skill anchor 更新 |
| Task 3 | `pnpm run emit && validate` + 终扫预演 | 验证 + 回归 |
| Task 4 | `packages/osuperpowers/skills/brainstorming/docs/overall-spec-template.md` + `packages/osuperpowers/skills/brainstorming/SKILL.md` + `SKILL.zh-CN.md` | preventive fix（模板强化 + commit-spec 节点校验） |

## Global Constraints

- 仓库语言政策：SKILL.md / docs 英文主源 + zh-CN 镜像；本 plan 中文（Strategy B）
- 路径解析 harness-agnostic：不写 `$CLAUDE_PLUGIN_ROOT` 等 harness-specific 变量
- vendored 子模块不可改（`vendors/superpowers/` / `vendors/mattpocock-skills/`）
- **不修改 `cdd-select.mjs` 引擎**：P7 仅改 cli-select 技能正文（Non-goals）
- 终扫 pattern 必须全部归零（来自 overall spec P10 终扫定义）：`HARD-GATE`、`## Rules`、`## Red Flags`、`## Checklist`、`Rule: `
- **changeset 策略**：仅 P10 统一建一个 changeset（本 phase 不建）
- CDD execution：通过 `cdd-task.mjs` 派发嵌套 CLI session，不直接执行 plan steps
- **report-issue label 组件分类**（overall spec v1.12 Boundary rule）：BLOCKED recovery 调用 `osuperpowers:report-issue` 时，label 按受影响组件分类（`osuperpowers` 非 `osuperpowers-router`）——P9 #136 fix 提前消费

---


### Task 1: cli-select SKILL.md 重写（节点锚定式）+ zh-CN 同步

**目标**：将 `packages/osuperpowers/skills/cli-select/SKILL.md` 从 Rules 散文 + Red Flags 重写为节点锚定式（2 节点 detect/ask + BLOCKED engine bug 终态 + APPROVED 隐式终态）。

**文件**：
- `packages/osuperpowers/skills/cli-select/SKILL.md`（重写，英文主源）
- `packages/osuperpowers/skills/cli-select/SKILL.zh-CN.md`（重写，中文镜像）

**SKILL.md 结构（§-by-§）**：

1. **Front matter**：
   ```yaml
   ---
   name: cli-select
   description: Independent cli-select orchestrator -- Node-anchored flow with digraph as single control-flow source of truth. Detects installed full harnesses via cdd-select.mjs, asks user via AskUserQuestion, returns selected harness via explicit --harness <name>. Callable standalone; referenced by cli-driven-development via anchor.
   ---
   ```

2. **Title + 引子**：`# Osuperpowers CLI Select` + "Select the harness CLI to execute tasks: detect, list, recommend, ask. Returns selected harness name via explicit `--harness <name>` to the caller."

3. **Flow Digraph**（mermaid）：
   ```mermaid
   flowchart TD
     A[detect] -->|available >= 1| B[ask]
     A -->|available = 0 or engine error| Z((BLOCKED: engine bug))
     B -->|harness selected| C((APPROVED: harness-chosen))
   ```

4. **Node Definitions**（2 个节点，每节点 Do/Read/Exit/Fail 四要素）：
   - `detect`：运行 `cdd-select.mjs` + 解析 3 行输出（`available:<csv>` / `unsupported_installed:<csv>` / `recommended:<name>`）
   - `ask`：呈现 available 选项 + 推荐项 `(Recommended)` 标签 + 用户选择 + 返回所选 harness 名

   **Implementer directive**：每节点的 Do/Read/Exit/Fail 完整内容**必须从 spec §3 Node Definitions 逐字派生**，不可仅依本 plan 的 1 行摘要（plan 摘要不含 channel 字段映射、推荐优先级细节、Fail 字段语义等关键细节）。

5. **Invariants**（1 条）：
   - I1: Explicit Propagation — 所选 harness 仅以 `--harness <name>` 显式 CLI 参数传播给下游（`cdd-task.mjs` / `cdd-review.mjs`）；禁止 skill 层与引擎层任何形式的隐式环境变量传递（`CDD_HARNESS` / `HARNESS_NAME` 等均不允许）；引擎现状确认（`cdd-select.mjs` 仅读取宿主 harness 检测用途的 env var，不读取 harness 选择类 env var）

6. **Failure Modes**（2 条 + recovery 列 + Fail-open vs BLOCKED 约定小节）：
   - `available:` 为空 → BLOCKED（engine bug）→ 调用 `osuperpowers:report-issue` 上报，label `bug, dogfood, osuperpowers`
   - `cdd-select.mjs` 执行失败 → BLOCKED（同上）→ 同上恢复操作
   - Fail-open vs BLOCKED 约定：cli-select 没有 implicit fail-open 场景——所有失败都路由到显式 BLOCKED 节点

**SKILL.zh-CN.md 镜像要求**：
- 节对节、节点对节点完全对齐英文主源
- description / front matter 翻译（参考当前 SKILL.zh-CN.md description：「列出系统已安装的 harness CLI 并询问用哪个执行任务。推荐优先级 droid > pi > 当前 harness。被 cli-driven-development 引用。」）
- mermaid 节点 ID 保持英文（与主源一致）

**验收**：
- 2 个节点 ID 与 digraph 节点一一对应（图正文一致性校验清单——skill-authoring §8 规则 1：节点覆盖）
- 正文每小节标题与某节点 ID 对齐（skill-authoring §8 规则 2：小节对齐）
- 每节点含 Do/Read/Exit/Fail 四要素（skill-authoring §8 规则 3：无独立 Rules 散文堆）
- 无 `## Red Flags` 小节（skill-authoring §8 规则 4：无 Red Flags 小节）
- 1 Invariant 数量 ≤ 5（skill-authoring §4 上限）
- 2 Failure Modes 与 digraph 边对齐 + 含 recovery 列

**原子 commit**：与 Task 2 + Task 3 合并为一个 commit（详见 Execution Strategy：CDD Task 1 = plan Task 1 + Task 2 + Task 3）——cli-select 重写、跨 skill anchor 更新、emit 衍生、终扫零化均为内聚改动，分开 commit 会破坏原子性。


### Task 2: 跨 skill anchor 更新（`#rule-ask` → `#ask`）

**目标**：更新所有引用 cli-select SKILL.md 旧 anchor 的 cross-skill 引用。

### 2.1 跨 skill anchor 引用扫描

**命令**：
```bash
grep -rn 'cli-select/SKILL.md#rule-ask\|cli-select/SKILL.md#rule-' packages/osuperpowers/skills/
```

**预期匹配**：
- `packages/osuperpowers/skills/cli-driven-development/SKILL.md:14`：`[Rule: Ask](../cli-select/SKILL.md#rule-ask)`
- `packages/osuperpowers/skills/cli-driven-development/SKILL.zh-CN.md:14`：`[Rule: Ask](../cli-select/SKILL.md#rule-ask)`（zh-CN 镜像）

**修改动作**：

| 文件 | 行 | 旧 anchor | 新 anchor |
|---|---|---|---|
| `cli-driven-development/SKILL.md` | 14 | `[Rule: Ask](../cli-select/SKILL.md#rule-ask)` | `[ask](../cli-select/SKILL.md#ask)` |
| `cli-driven-development/SKILL.zh-CN.md` | 14 | `[Rule: Ask](../cli-select/SKILL.md#rule-ask)` | `[ask](../cli-select/SKILL.md#ask)` |

**文案调整**（同步上下文 prose）：
- 英文：`Before execution, select a harness via [Rule: Ask](../cli-select/SKILL.md#rule-ask) and pass it as `--harness <name>`.`
  → `Before execution, select a harness via [ask](../cli-select/SKILL.md#ask) and pass it as `--harness <name>`.`
- 中文：`执行前先经 [Rule: Ask](../cli-select/SKILL.md#rule-ask) 选定 harness，以 `--harness <name>` 传入。`
  → `执行前先经 [ask](../cli-select/SKILL.md#ask) 选定 harness，以 `--harness <name>` 传入。`

**若发现额外匹配**（不在预期 2 处）：
- 评估是否指向旧 Rule 名（`Rule: Detect` / `Rule: Empty list` / `Rule: Propagate`）
- 映射到新节点 ID（`#detect` 或 `#invariants`），或改为 prose 描述

### 2.2 验收

- `grep` 命令返回的 2 处预期匹配已更新为新 anchor
- 无 `#rule-ask` / `#rule-detect` / `#rule-empty-list` / `#rule-propagate` 残留

**原子 commit**：与 Task 1 + Task 3 合并（详见 Execution Strategy）。

---

### Task 3: emit + validate + 终扫预演

**目标**：运行 emit + validate 保证衍生文件同步；运行终扫 pattern 验证旧格式关键词归零。

### 3.1 emit + validate

**命令**：
```bash
pnpm run emit && pnpm run validate
```

**预期**：
- emit freshness check 绿（`pnpm run emit:check` 通过）
- plugin.json skills resolve 绿
- skill dir has SKILL.md 绿
- rule-reference integrity 绿（包括新 `#ask` anchor 解析成功）
- engine tests 绿
- version sync 绿

**若失败**：依错误类型分别修复（emit 失败 → 检查 SKILL.md front matter；validate 失败 → 依错误信息定位具体测试）

### 3.2 终扫预演

**命令**（对 `packages/osuperpowers/skills/cli-select/` 目录验证旧格式关键词已清零）：

```bash
grep -r 'HARD-GATE' packages/osuperpowers/skills/cli-select/
grep -r '## Rules' packages/osuperpowers/skills/cli-select/
grep -r '## Red Flags' packages/osuperpowers/skills/cli-select/
grep -r '## Checklist' packages/osuperpowers/skills/cli-select/
grep -r 'Rule: ' packages/osuperpowers/skills/cli-select/
```

**预期**：5 条 grep 全部零匹配。

**若发现匹配**：
- `HARD-GATE` / `## Rules` / `## Red Flags` / `## Checklist` → 节点锚定式重写遗漏，回 Task 1 修复
- `Rule: ` → Rules 散文堆残留，回 Task 1 修复

### 3.3 commit 策略

**原子 commit**：与 Task 1 + Task 2 合并为一个 commit（详见 Execution Strategy：CDD Task 1 = plan Task 1 + Task 2 + Task 3）——cli-select 重写、跨 skill anchor 更新、emit 衍生、终扫零化均为内聚改动，分开 commit 会破坏原子性。

**Commit message**：`refactor: rewrite cli-select to node-anchored format (P7)`

**例外**：若 Task 1 + 2 已 commit 后才发现 emit 衍生问题（如 `.agents/` 未同步），允许追加 `chore: sync .agents/ derived files for cli-select rewrite` commit。

---

### Task 4: preventive fix（overall-spec-template + brainstorming commit-spec 节点）

**目标**：防止同类问题再发生——P7 plan review 期间发现 overall spec Issue inventory 漏更新（v1.12 时漏记 #136 提前消费行），本 task 从模板 + 节点两层加固。

**文件**：
- `packages/osuperpowers/skills/brainstorming/docs/overall-spec-template.md`（修改，强化 Issue inventory 段）
- `packages/osuperpowers/skills/brainstorming/SKILL.md`（修改，commit-spec 节点 Do 字段扩展）
- `packages/osuperpowers/skills/brainstorming/SKILL.zh-CN.md`（修改，commit-spec 节点 Do 字段 zh-CN 同步）

### 4.1 overall-spec-template.md 修改

**位置**：`## Issue inventory` 段末尾新增「更新触发条件」子段

**新增内容**：
```markdown
### 更新触发条件

以下 3 种场景必须同步 Issue inventory + version bump + change history 条目：

1. **phase 执行阶段发现新 issue**（dev 阶段 / dogfood session / plan review）→ 在该 phase 的 design spec / plan 中声明归属（哪个 phase 负责修复）+ 同步 overall Issue inventory 新增行
2. **phase 提前消费其他 phase 的 issue**（如 P7 提前消费 P9 的 #136 fix）→ overall Issue inventory 新增行 + 标注「提前消费」+ 注明实际修复 phase 与生效 timing（如"P9 完成引擎层面修复；P7 仅声明目标 label"）
3. **phase 执行过程中 issue 重新归属**（如某 issue 从 P5 移到 P8）→ overall Issue inventory 行 Phase 列更新 + version bump + change history 说明

**漏更新检测**：每个 phase 的 spec / plan 若提及具体 issue 编号（`#NNN`）但该编号未出现在 overall Issue inventory，视为违规。
```

### 4.2 brainstorming SKILL.md commit-spec 节点修改

**位置**：`### commit-spec` 节点的 Do 字段

**前置校验**（实施前必跑）：
```bash
grep -n 'commit-spec' packages/osuperpowers/skills/brainstorming/SKILL.md
```
预期：命中 `### commit-spec` 节点 heading（P4 重构后节点 ID 沿用 `commit-spec`，已确认存在于 SKILL.md:107）。若未发现匹配或节点 ID 变更，回本 plan Task 4.2 调整节点定位策略。

**修改**：
- **旧 Do 字段**：`Commit spec document to git. Spec approved = commit immediately (I4); do not wait for dev merge`
- **新 Do 字段**（主句 + 子句；超 skill-authoring §3 的 1-3 句预算 → 见下「拆分策略」）：`Commit spec document to git. Spec approved = commit immediately (I4); do not wait for dev merge. **Commit 前校验 overall spec 四表同步**（仅当本 phase 是 overall 程序的子 phase 时；single-spec 项目跳过此校验）：① Issue inventory——本 phase spec 或 plan 中提及的所有 `#NNN` issue 编号均已在 overall Issue inventory 中登记（新增或更新）；② Phase inventory——本 phase 行的 scope / design spec / plan / acceptance criteria / dependency 字段已更新到最新状态；③ Dependency graph——若本 phase 新增或移除依赖关系，ASCII 图已同步；④ Change history——本 phase 的变更已 append 一行（含 version + 日期 + 摘要）。任何一表未同步 → 视为 spec commit 违规，**不得 commit**，必须先同步再提交`

**拆分策略**（预决策，不留给实施阶段）：
- Do 字段主句保持 1 句：`Commit spec document to git. Spec approved = commit immediately (I4); do not wait for dev merge.`
- 四表同步校验步骤以 bullet list 形式挂在 Do 字段下方（skill-authoring §3 允许 Do 字段使用 1-3 句话 + bullet 子句）：
  ```
  **Commit 前校验 overall spec 四表同步**（仅当本 phase 是 overall 程序的子 phase 时；single-spec 项目跳过此校验）：
  - Issue inventory：本 phase spec 或 plan 中提及的所有 `#NNN` issue 编号均已在 overall Issue inventory 中登记（新增或更新）
  - Phase inventory：本 phase 行的 scope / design spec / plan / acceptance criteria / dependency 字段已更新到最新状态
  - Dependency graph：若本 phase 新增或移除依赖关系，ASCII 图已同步
  - Change history：本 phase 的变更已 append 一行（含 version + 日期 + 摘要）

  任何一表未同步 → 视为 spec commit 违规，**不得 commit**，必须先同步再提交
  ```
- 此结构将长 Do 字段拆为 1 主句 + 1 bullet list + 1 收尾句，符合 skill-authoring §3 预算

### 4.3 brainstorming SKILL.zh-CN.md 同步

**位置**：`### commit-spec` 节点的 Do 字段（zh-CN 镜像）

**同步要求**：与英文主源节对节、语义对语义完全对齐。commit-spec 节点 Do 字段的中英文应包含相同的 4 表同步校验步骤。

### 4.4 emit + validate

**命令**：
```bash
pnpm run emit && pnpm run validate
```

**预期**：
- emit freshness check 绿（brainstorming SKILL.md + .zh-CN.md 衍生同步）
- rule-reference integrity 绿（commit-spec 节点 anchor 解析成功）
- 其他 validate blocks 绿

### 4.5 验收

- overall-spec-template.md Issue inventory 段含「更新触发条件」规则（3 触发条件 + 漏更新检测规则）
- brainstorming SKILL.md commit-spec 节点 Do 字段含四表同步校验（Issue inventory / Phase inventory / Dependency graph / Change history）
- brainstorming SKILL.zh-CN.md commit-spec 节点 Do 字段同步（节对节）
- emit + validate 绿（brainstorming 衍生同步）

**原子 commit**：`docs: harden overall-spec-template issue inventory rules + brainstorming commit-spec node (P7 preventive fix)`

---

## Acceptance Criteria

对齐 P7 design spec §7（v1.1）：

1. 符合 skill-authoring.md v1.0（图节点与小节一一对应、无独立 Rules 散文堆、无独立 Red Flags 小节、无 Checklist）
2. 2 节点（detect + ask）+ BLOCKED 终态 + APPROVED 隐式终态
3. BLOCKED 节点原因字段明确为"engine bug"（orchestrator 宿主 harness 必然存在）
4. Failure Modes 表含 recovery 列（report-issue 路径 + 按组件分类的 label `bug, dogfood, osuperpowers`）
5. Invariant I1（Explicit Propagation）声明 + 禁止 skill 层与引擎层隐式 env var + 引擎现状确认注
6. cli-driven-development SKILL.md + .zh-CN.md 的 `#rule-ask` anchor 同步更新为 `#ask`
7. cli-select SKILL.zh-CN.md 同步
8. **preventive fix 落地**：`overall-spec-template.md` Issue inventory 段含「更新触发条件」规则（3 触发条件 + 漏更新检测）；`brainstorming/SKILL.md` 的 `commit-spec` 节点 Do 字段含「四表同步校验」步骤；`brainstorming/SKILL.zh-CN.md` 同步
9. emit + validate 绿（cli-select + brainstorming 两技能衍生均同步）
10. CDD execution: workspace 存在 + 全 task handoff.json + ledger 全 APPROVED + Final Review 产物

---

## Execution Strategy

**2 个 CDD task**（cli-select 重写为内聚改动；preventive fix 为独立改动，分开原子 commit）：

### CDD Task 1：cli-select 重写 + anchor 更新 + emit + validate + 终扫

**对应 plan Task 1 + Task 2 + Task 3**

**Brief 范围**：
- 重写 `packages/osuperpowers/skills/cli-select/SKILL.md`（节点锚定式，按 Task 1 §结构）
- 重写 `SKILL.zh-CN.md`（中文镜像，节对节对齐）
- 跨 skill anchor 更新（`cli-driven-development/SKILL.md` + `.zh-CN.md` 两处 `#rule-ask` → `#ask`）
- `pnpm run emit && pnpm run validate` 绿
- 终扫预演（5 条 grep pattern 全部零匹配）

**Task-level review 重点**：
- 2 节点 + digraph 一一对应（图正文一致性校验）
- 每节点 4 要素完整（Do/Read/Exit/Fail，从 spec §3 逐字派生）
- 1 Invariant ≤ 5 上限
- 2 Failure Modes 与 digraph 边对齐 + 含 recovery 列
- zh-CN 镜像节对节对齐
- 跨 skill anchor 更新到位
- emit + validate 绿
- 终扫 5 条 grep 全部零匹配

**CDD Task 1 commit message**：`refactor: rewrite cli-select to node-anchored format (P7)`

### CDD Task 2：preventive fix（overall-spec-template + brainstorming commit-spec 节点）

**对应 plan Task 4**

**Brief 范围**：
- 更新 `packages/osuperpowers/skills/brainstorming/docs/overall-spec-template.md`：Issue inventory 段新增「更新触发条件」规则（3 触发条件 + 漏更新检测）
- 更新 `packages/osuperpowers/skills/brainstorming/SKILL.md`：`commit-spec` 节点 Do 字段新增「四表同步校验」步骤（Issue inventory / Phase inventory / Dependency graph / Change history）
- 同步 `brainstorming/SKILL.zh-CN.md`（commit-spec 节点 Do 字段 zh-CN 镜像）
- `pnpm run emit && pnpm run validate` 绿（brainstorming 衍生同步）

**Task-level review 重点**：
- overall-spec-template Issue inventory 段 3 触发条件 + 漏更新检测规则完整
- brainstorming commit-spec 节点 Do 字段四表同步校验步骤完整（4 表 + 违规语义）
- brainstorming SKILL.zh-CN.md commit-spec 节点 Do 字段节对节对齐
- emit + validate 绿（brainstorming 衍生同步）

**CDD Task 2 commit message**：`docs: harden overall-spec-template issue inventory rules + brainstorming commit-spec node (P7 preventive fix)`

**Atomic commits（3 个）**：
1. `docs: add P7 cli-select design spec + sync overall spec v1.14`（spec + overall 同步，已 commit；overall spec 引用以 plan header 的 v1.14 为准——spec §8 commit #1 文案残留 v1.13 为历史原因，实施时按 v1.14 读取）
2. `refactor: rewrite cli-select to node-anchored format (P7)`（CDD Task 1 = plan Task 1 + Task 2 + Task 3）
3. `docs: harden overall-spec-template issue inventory rules + brainstorming commit-spec node (P7 preventive fix)`（CDD Task 2 = plan Task 4）

---

## Plan Document Commit

**Plan 文档本身**：单独 commit `docs: add P7 cli-select implementation plan`（按 commit 纪律：plan 获批即 commit，不等 dev 合并）

---

## Risk & Mitigation

| 风险 | 缓解 |
|---|---|
| 跨 skill anchor 引用超出预期 2 处 | grep 扫描先行；若发现大量引用，评估是否需拆分 anchor 更新为独立 Task |
| `#ask` anchor 在 emit 衍生文件（`.agents/skills/cli-select/SKILL.md`）中解析失败 | emit 会自动从源文件生成衍生；anchor slug 生成逻辑已处理简单 kebab-case |
| emit 失败因 SKILL.md front matter 不合规 | 依 emit 错误信息定位 front matter 字段，对齐 P4/P5 的 finishing SKILL.md front matter 模式 |
| 终扫 pattern 漏网（如 `Rule: ` 残留） | 5 条 grep 全部覆盖；若发现残留，回 Task 1 修复后重扫 |
| nested CLI stdout 不可靠（P5 dogfood 教训） | 使用 overall spec v1.10 的「orchestrator handoff 检查义务」：cdd-task.mjs 返回后必须读 handoff.json 判断状态；CLI 调用使用 background 模式 |
| report-issue label 组件分类在 P9 #136 fix 前未生效 | P7 仅声明目标 label；实际生效依赖 P9；P7 期间执行 BLOCKED recovery 时用户需手动 `gh issue edit --add-label osuperpowers --remove-label osuperpowers-router` |
| preventive fix 改动 brainstorming SKILL.md（已被 P4 重构为节点锚定式） | commit-spec 节点 Do 字段扩展不破坏 digraph 结构；emit 衍生会自动同步；若影响图正文一致性则回 Task 4 调整 |
| brainstorming commit-spec 节点 Do 字段过长（含四表校验步骤） | 节点 Do 字段允许 1-3 句话（skill-authoring §3）；本扩展仍在此预算内（主句 + 校验子句）；若超预算则拆为 Invariant 子项 |
