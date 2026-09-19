---
"@oscaner-skills/osuperpowers": minor
---

P6 Task 1 能力宣称收缩：

- **能力宣称收缩**：README / README.zh-CN / CLAUDE.md 移除 8-harness 宣称，收敛为 claude / cursor-agent 两证实 harness + 中性「多 harness 可消费」表述；README.zh-CN 清理陈旧面（`docs/gate-install.md` 死引用 · Trae/Vibe/Kiro/OpenCode init-harness 模式 · 未证实 harness 行）。
- **manifest 元数据收缩**：`oscaner-plugin.claude.keywords` 移除 `droid` / `pi`；删除死 `pi` manifest 字段。
- **`.agents/` emit 面移除**：`emitAgentsSkillsCopy` / `pruneStaleAgentsNamespaces` 删除，emit 产物集收敛为 `.claude-plugin` + `.cursor-plugin` + marketplace + `.github/ISSUE_TEMPLATE`。

> **semver 说明**：能力收缩为散发的**消费者可见行为变更**（发现面 keywords / manifest 产物集 / README 宣称），非 bug 修复——按 minor 发布（无新增破坏面）。
