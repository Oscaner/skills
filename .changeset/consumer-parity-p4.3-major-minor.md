---
"@oscaner-skills/cdd-engine": major
"@oscaner-skills/osuperpowers": minor
---

P4.3 consumer-parity 宣讲面收口：`--task` → `--tasks` 别名零替换全量完成 + 守卫 fixture 与 consumer-sim 链同步。

**cdd-engine（breaking → major，1.0.0 → 2.0.0）**：

- **`--task` → `--tasks` 全替换零别名（BREAKING）**：dispatch-group 语义下任务派发单位是组（`--tasks <n|n,n,…>`，singleton 组等于原每任务派发）；单数 `--task` 已从 CLI 解析面整删（unknown-option exit 2）。本 changeset 收口最后文档表层：cdd-engine 包 README 族（README.md / README.zh-CN.md 的 implement 表行 + review 选项列举共 4 行）示例迁 `--tasks`，zh-CN mirror 同步。
- **守卫 fixture 同步**：residue 守卫测试合成 fixture 字面量迁 `--tasks`——retired-`brief` 守卫 argv（`cdd brief --tasks 1 …`，与 cli-shape 退役命令全形断言同构）+ skills 面 `cdd fix` 命令形 fixture，anti-reintroduce 行为断言保留；smoke-cdd consumer-sim fix 链 `--findings` 路径字面量随 Task 2 组命名迁 canonical 形 `tasks-1-review-1.json`（`tasksKey([1])` = `"1"` 派生的 singleton-group handoff 名）。

**osuperpowers（minor，0.1.1 → 0.2.0）**：skills 文本更新——cli-driven-development SKILL.md 面向 dispatch-group 的 `--tasks` 文案面由本 phase 收敛（评审循环 fix 节点命令形 `cdd fix --type task --tasks <n> …`）；consumer-surface purity 归位（CLAUDE.md 铁律）——cli-driven-development SKILL.md 的 `## Full Flow Refactor Rationale` 章节移除、消费面零残留（设计 rationale 迁仓内 maintainer skill-authoring 文档 §9.1 注册表，SKILL.md 不留任何 note/锚），机器断言面同步（digraph-consistency.test.mjs Assertion 3：越界 skill 的 rationale 必须注册在 maintainer 侧 + SKILL.md 零 growth/refactor narrative heading）。

> **semver 说明**：CLI 选项整删/更名（`--task` → `--tasks`）为 breaking，cdd-engine 按 major 发布；消费者迁移面：一切派发命令以 `--tasks <n|n,n,…>` 取代 `--task <n>`，产物名随组键（`tasks-{a}-{b}-*`）不再出现 `task-N-*` 形。
