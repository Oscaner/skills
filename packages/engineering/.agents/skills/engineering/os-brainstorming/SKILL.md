---
name: os-brainstorming
description: 独立 brainstorm 流程编排器 —— Read 上游 superpowers:brainstorming 作为基线，叠加个人规则（grilling 澄清 / overall+phase / cli review 评审 passes）。可独立调用；由 /brainstorming 触发经 overrides 路由器直达。
---

# OS Brainstorming

完整 brainstorm 流程编排，可独立调用。

## Rules

### Rule: Read Upstream

Read 上游 `superpowers:brainstorming` 的 SKILL.md 作为流程基线 **当可用时**（claude / cursor 装有 superpowers 插件）。**Read 而非 Skill-invoke**（Skill-invoke 会触发路由器拦截）。

解析路径（`{plugin-root}` = 本插件 engineering 根）：
1. **兄弟插件根**：claude `$CLAUDE_PLUGIN_ROOT/../superpowers/skills/brainstorming/SKILL.md`（cursor 同理）
2. **回退同仓库相对路径**：`<repo-root>/vendors/superpowers/skills/brainstorming/SKILL.md`

上游不可用（非 claude harness / 未装 superpowers 插件）→ **不报错**：以本技能自身 Rules 为完整流程直接执行。本技能自身 Rules 是承重流程，Read 上游只是增强。

### Rule: Read Sub-Skills

按需 Read `mattpocock-skills` 的 `skills/productivity/grilling/SKILL.md`（澄清问题委派）。加载失败协议见 [subagent-lifecycle.md](../docs/subagent-lifecycle.md#rule-delegate-load-failure)。

### Rule: Overall-Phase

大需求（≥3 子系统 / 分几期 / overhaul）先写 overall spec，再分阶段。文档结构见 [overall-phase-spec-template.md](../docs/overall-phase-spec-template.md)。GATE：overall 批准 ≠ 阶段已启动。

### Rule: Spec Review via CLI

spec review 分 3 类 pass（completeness / consistency&scope / clarity&YAGNI），每 pass 一次 fresh `cdd-exec` 派发：
  cdd-exec --harness claude --prompt "<spec-document-reviewer 模板 + pass 类别 + 文档路径>"
派发纪律见 [review-dispatch.md](../docs/review-dispatch.md)（D1/D2/D3 + fresh-pass，原样映射到 cli）。

### Rule: Write Design Doc

spec 存 `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`，用户审阅后 → writing-plans。

## Red Flags

- 「Skill-invoke 上游 brainstorm」→ Read 而非 Skill-invoke（Rule: Read Upstream）
- 「简单项目跳过设计」→ 每个项目都过设计（上游流程要求）
