---
"@oscaner-skills/cdd-engine": major
---

P4.4 Task 10/11 cdd-engine breaking 面（P4.4 破口窗口收口登记）：Pending Acceptance Patch 移除面（#279）。

- **plan.json `pendingAcceptancePatch` 节点整删（BREAKING — schema 面）**：pending-acceptance-patch zone 的文档结构描述（heading const `## Pending Acceptance Patch` · entry pattern `- **Task N (patch)**:` · carry-through mechanism `accepts pending-acceptance-patch`）全部移除；`taskGroups` 声明的描述同步改指 plan-author 非交互裁定 + effectiveGroups 全量派生（声明合并组 ∪ 未覆盖任务隐式单组，并集恒 == 全 task 号集）；plan doc 不再承载 zone。
- **skill-anatomy.json 注册表收缩（BREAKING — machine-check 面）**：条件节注册表删 `pendingAcceptancePatch` 条目（conditional enum 仅剩 `skeletonDeltas` · sections 描述/headingKinds `### Task N:` 样例 heading 全删）；**growth 注册表清零**——cli-driven-development 越界条目移除（loop 收缩至 13 节点/17 边落回边界内，crossings 转为 per-skill map、现零注册）；digraph-consistency 机器断言随 schema 单源收缩；schema.test 断言随删。
- **`targets later task` / `accepts pending-acceptance-patch` 标签约定出技能文本（BREAKING — prompt 面）**：跨 task 裁决改由 orchestrator 以 Plan Sole Writer 直写目标 task 的 **Do** 与 **验收**（fix/implement agents 零 plan 修改权）；skills 文本零 pending-acceptance 字样。

> **Semver 说明**：doc-structure schema 节点/注册表移除 + 标签约定退役 = 消费面 breaking，cdd-engine 按 major 发布；消费者迁移面：计划文档不再写 `## Pending Acceptance Patch` zone，跨 task 裁决由编排者直写目标 task 的 Do/验收行；growth 注册表已空（越界即须回边界或新注册）。
