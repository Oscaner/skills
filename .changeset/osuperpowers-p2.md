---
"@oscaner-skills/osuperpowers": patch
"@oscaner-skills/osuperpowers-router": patch
---

osuperpowers P2 — os-\* 家族抽离（核心集审计，8 技能）。

- 8 个独立流程编排技能：`os-brainstorming` / `os-writing-plans` / `os-executing-plans`（三模式总编器：in-session → 上游 executing-plans / subagent → subagent-driven-development / cli → `cli-driven-development`）/ `os-finishing`（含 worktree 拒绝）/ `os-verification` / `os-debugging` / `os-code-review` / `os-report-issue`。
- 不建非 1:1 对齐技能：tdd 直映 mattpocock（seam 门折进 cdd implement）、executing-plans 直映 os-executing-plans、p0-fallback 删除。
- cross-cutting 文档 `spor-subagent-lifecycle`、`spor-token-efficient-review-dispatch` 降为插件 docs；overall + phase 模板迁入。
- gate 模式感知：`pending.mode`（in-session / subagent / cli；cli 严格，其余放行 repo 编辑）。