---
"@oscaner-skills/osuperpowers": minor
---

P4.4 consumer-parity 收口——skills 文本语义迁移（三件套：Review Convergence 三段表述 · Pending Acceptance Patch 移除 · task groups 裁定迁移 + loop 更名）。

- **五面 Review Convergence 三段表述（writing-single-spec / writing-overall-spec / writing-phase-spec / writing-plans I1 + cli-driven-development I3）**：`REVIEW_FIX` 状态词汇同名入文本（1.0.0 收口面）——S1 blocker>0 → `cdd fix` 后 re-review（循环至收敛）· S2 blocker=0∧warn/nit>0 → `cdd fix` 收口轮（REVIEW_FIX — 无 re-review）· S3 零 finding → 批准收敛；review/fix 节点路径同步承载三段语义。
- **Pending Acceptance Patch 移除（#279）**：writing-plans `## Pending Acceptance Patch` 条件节（finding-tag 约定 · zone shape · Task 14 样例）整删；I3 改为 **Plan Sole Writer**（跨 task 裁决由 orchestrator 直写目标 task 的 **Do** 与 **验收**，fix/implement agents 零 plan 修改权）；cli-driven-development **I6 整条删**；两件 fix 节点「LATER task / targets later task tag」句删；I7 → I6 改指 Plan Sole Writer；五面 Mid-Flight Backfill 尾部路由句改「routes through the orchestrator as Plan Sole Writer」。
- **task groups 裁定迁移 + loop 更名**：writing-plans author-plan 内 tasks 写毕即**非交互**裁定分组落盘（`## Task Groups` 节 + plan `taskGroups` 声明 · 无 AskUserQuestion · 零分组无节、默认全单组）；cli-driven-development 移除 `adjudicate-task-groups` 节点/定义与 `task-groups-undecided` 拒答终端（`C → D` 直连），**loop 更名 `group-implement-review-fix`**（`implement-group` / `run-group-review` / `fix-group` 节点名 · `more-groups?` 保留 · 组列表 = 声明合并组 ∪ 未覆盖任务单组（经 engine `effectiveGroups` 派生结果），每组分一个 `--tasks`）。

> **Semver 说明**：skill 编排语义迁移为行为变化，osuperpowers 按 minor 发布；消费者迁移面 = orchestration 流程文本按新节点名与三段结案语义执行。
