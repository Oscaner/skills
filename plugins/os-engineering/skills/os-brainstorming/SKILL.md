---
name: os-brainstorming
description: 独立 brainstorm 流程编排器 —— Read 上游 superpowers:brainstorming 作为基线，叠加个人规则（grilling 澄清 / overall+phase / fresh-subagent 评审 passes）。可独立调用；被 /brainstorming 的 spor 薄指针转发。
---

# OS Brainstorming

完整 brainstorm 流程编排，可独立调用。

## Rules

### Rule: Read Upstream

Resolve `{superpowers-plugin-root}`（优先 `$CLAUDE_PLUGIN_ROOT/../superpowers`，回退 repo 同级 `plugins/superpowers`，两者皆无 → 报错 + 提示解析路径）。Read `skills/brainstorming/SKILL.md` 作为流程基线。**Read 而非 Skill-invoke**（Skill-invoke 会触发 spor 拦截）。

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
