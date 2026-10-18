---
"@oscaner-skills/cdd-engine": patch
---

refactor(cdd-engine): round context 退役 `INPUT_DOC` —— 语义化 `INPUT_PLAN` / `INPUT_SPEC` 双锚（用户 backfill 2026-10-18）:

- **`INPUT_DOC` 退役** — 通用「judged doc」锚拆分：plan/branch 线带 `INPUT_PLAN`（计划文档）`+` `INPUT_SPEC`（计划 `spec:` design-spec 引用）；spec 线带 `INPUT_SPEC`（judged spec）；wave 线无 doc 锚（空槽由 assembler 丢弃）。
- **branch 双锚** — branch review round context 同时携带 `INPUT_PLAN` + `INPUT_SPEC`：branch 帧在 CLI seam 读计划、派生 spec-link（原 `case "plan"` 独享的 §2.2 seam 路径收归 plan/branch 共享），评审可判 plan→spec 一致性。
- **`AuditTarget.kind` 拆分** — `{ kind: "doc" }` 全部拆为 `{ kind: "plan" }` / `{ kind: "spec" }`（run.ts 类型 + cli/gate/lifecycle 13 消费判别 + 测试钉）：doc 身份语义显式化，`kind` 即被审文档类型。
- **模板契约 $version 8** — TOKENS 注册表 `INPUT_DOC` → `INPUT_PLAN`；review/fix/docs-fix 指令 prose 与 round-context 行改语义对；`INPUT_PLAN` 自退役词表复活为语义名。