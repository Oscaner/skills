---
name: os-brainstorming
description: 独立 brainstorm 流程编排器 —— Read 上游 superpowers:brainstorming 作为基线，叠加个人规则（grilling 澄清 / overall+phase / fresh-subagent 评审 passes）。可独立调用；由 /brainstorming 触发经 overrides 路由器直达。
---

# OS Brainstorming

完整 brainstorm 流程编排，可独立调用。

## Rules

### Rule: Read Upstream

解析上游 `superpowers:brainstorming` 的 SKILL.md 路径，统一优先级（`{plugin-root}` = 本插件 os-engineering 根）：

1. **in-harness 副本优先**：`{plugin-root}/.agents/skills/superpowers/brainstorming/SKILL.md`（os-engineering 多 harness 发射的共享副本；`.cursor/.gemini/.../skills/superpowers/<slug>/SKILL.md` 等 per-harness 副本存在时同优先级）
2. **回退兄弟插件根**：claude `$CLAUDE_PLUGIN_ROOT/../superpowers/skills/brainstorming/SKILL.md`
3. **回退同仓库相对路径**：`<repo-root>/plugins/superpowers/skills/brainstorming/SKILL.md`

三处皆无 → 报错 + 提示解析路径。Read 解析出的 `brainstorming/SKILL.md` 作为流程基线。**Read 而非 Skill-invoke**（Skill-invoke 会触发路由器拦截）。

### Rule: Read Sub-Skills

按需 Read `mattpocock-skills` 的 `skills/productivity/grilling/SKILL.md`（澄清问题委派）。加载失败协议见 [subagent-lifecycle.md](../docs/subagent-lifecycle.md#rule-delegate-load-failure)。

### Rule: Overall-Phase

大需求（≥3 子系统 / 分几期 / overhaul）先写 overall spec，再分阶段。文档结构见 [overall-phase-spec-template.md](../docs/overall-phase-spec-template.md)。GATE：overall 批准 ≠ 阶段已启动。

### Rule: Fresh-Subagent Review Passes

写出的 spec 用 fresh subagent 评审 passes（Completeness → Consistency & scope → Clarity & YAGNI），派发纪律见 [review-dispatch.md](../docs/review-dispatch.md) + [subagent-lifecycle.md](../docs/subagent-lifecycle.md)。

### Rule: Write Design Doc

spec 存 `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`，用户审阅后 → writing-plans。

## Red Flags

- 「Skill-invoke 上游 brainstorm」→ Read 而非 Skill-invoke（Rule: Read Upstream）
- 「简单项目跳过设计」→ 每个项目都过设计（上游流程要求）
