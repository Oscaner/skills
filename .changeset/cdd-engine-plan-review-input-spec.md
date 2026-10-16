---
"@oscaner-skills/cdd-engine": minor
---

feat: plan review round context 注入 spec doc（`INPUT_SPEC` · D44）:

- **`INPUT_SPEC` token** — plan-review 的 round context 新增 `INPUT_SPEC`：从 plan 文档头的 `**Spec:**` 链（`PlanDocType.chainRoot.specLink`）派生的设计 spec 锚（spec 完全不可见 → 现可见），使 reviewer 能judge 计划是否与其设计 spec 对齐。
- **plan 评审判据** — `REVIEWS.plan.axesGuide` 增 spec conformance 轴：每条 spec 需求必须映射到一个 task；无 task 承接的 spec 需求 = completeness finding。
- **注入链** — `cli#sceneOf` 的 `case "plan"` 复用已读的 `planText` 派生 `specLink`（零二次文件读）→ `DispatchScene.specLink` → `Lifecycle#valuesOf` → `REVIEW_CONTEXT` + `TOKENS`；off-plan 面 slot 空（assembler 丢弃）。
