# Tickets: cursor-agent CLI 重构

删除 spor-subagent-driven-development 中的 p0 fallback 降级路径，并将所有 Cursor CLI 调用从 `cursor agent` 迁移到 `cursor-agent` 独立 CLI。参见 [实施计划](../plans/2026-08-06-cursor-agent-cli-refactor.md) 和 [设计文档](../specs/2026-08-06-cursor-agent-cli-refactor-design.md)。

Work the **frontier**：T1 无阻塞可立即开始，T2 等 T1 完成后开始。

---

## T1: 精简 spor-subagent-driven-development SKILL.md（删除 p0 fallback）

**What to build:** 删除 `spor-subagent-driven-development` SKILL.md 中的 p0 fallback 降级路径，强制 CLI 使用，CLI 不可用时改为 BLOCKED 并报告原因。完成后 SKILL.md 中不再出现 `p0`（除保留的 `p0 program invariant` 行外）、`Rule 0b`、`spor-sdd-p0-fallback`、`SDD_NO_CLI`、`not opt-out` 等概念。

**Blocked by:** None — can start immediately.

- [ ] frontmatter `description` 中的 `p0 fallback delegates tdd;` 短语已删除
- [ ] `Rule 0 — Path branch (p1-slim)` 和 `Rule 0a — CLI-default` 合并为 `Rule 0 — CLI-mandatory (p1)`
- [ ] `Rule 0b — p0 fallback` 整块已删除
- [ ] `Rule 0 item 1` 中的 `not opt-out,` 短语已删除
- [ ] Rule 7 item 2 改写为 BLOCKED + 报告原因，opt-out 触发器已删除
- [ ] Rule 5a 中的 `/ p0 Rule 5c` 短语已删除
- [ ] Red Flags 中 `"Exit 2 means stop the plan."` 和 `"p0 fallback — skip the announce line."` 已删除或更新
- [ ] Common Rationalizations 中 `"Rule 7 only applies when user asks for CLI"` 行已删除
- [ ] `pnpm run validate` 通过

---

## T2: 将所有 Cursor CLI 调用迁移到 `cursor-agent`

**What to build:** 将 `smoke-provider-hooks.mjs`、`sdd-run-task-cursor.sh`、`sdd-run-plan-cursor.sh` 中所有对 `cursor agent`（编辑器版 CLI）的调用替换为 `cursor-agent`（独立 CLI），包括 CLI 存在性检测、实际调用、认证错误信息和注释。

**Blocked by:** T1（需要先完成 T1，确保 validate 在干净状态下通过）

- [ ] `smoke-provider-hooks.mjs`：`run('agent', ...)` 全部替换为 `run('cursor-agent', ...)`（4 处）
- [ ] `smoke-provider-hooks.mjs`：`agent login` 替换为 `cursor-agent login`（2 处 error message + 2 处正则）
- [ ] `sdd-run-task-cursor.sh`：`command -v cursor` → `command -v cursor-agent`，`cursor agent --print ...` → `cursor-agent --print ...`，注释同步（共 7 处）
- [ ] `sdd-run-plan-cursor.sh`：`command -v cursor` → `command -v cursor-agent`，注释同步（共 3 处）
- [ ] `pnpm run validate` 通过
