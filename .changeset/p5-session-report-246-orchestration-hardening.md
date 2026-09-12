---
'@oscaner-skills/osuperpowers': minor
'@oscaner-skills/cdd-engine': patch
---

CDD 编排硬化（P5）：`cdd base-branch set/get` 子命令（base-branch artifact 由 engine 唯一写入，schema 校验 4 值 enum + `confirmed_at` 必填（legacy/手写旧件不静默放过，`get` 非零退回）+ 幂等 + `--force` + CDD/standalone 双落点，determine-base/read-base 委托只读）+ implement dispatch 自供应 brief（`cdd implement --plan` 单次调用拿全实现上下文，写侧 honor `CDD_TASK_BRIEF` override 与读侧同解析 + dir bootstrap）+ workspace slug 收敛（strip 单一 `-design`/`-plan` suffix，run-task + review 双派生点同源）+ 代码目录/CLI 整理（删 bin `.gitkeep`、拆分 cli/shared、runBriefCli 归 lib/cli）+ skills/docs 编排收敛（dispatch-mode 删 brief 前置步、determine-base/read-base 委托、base-branch.md 4 值 enum + 双 slug 拆分、_docs/review.md slug 同步）。Closes #246 F10/F11。

> **兼容可删**：`cdd base-branch set/get` 可用，orchestrator 旧 `cdd brief` 前置调用兼容保留、可以安全删除。
