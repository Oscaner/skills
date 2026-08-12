---
name: os-writing-plans
description: 独立写计划流程编排器 —— Read 上游 superpowers:writing-plans 作为基线，叠加个人规则（逐节写 / fresh-subagent 评审 passes / to-tickets 发布重定向）。
---

# OS Writing-Plans

完整写计划流程编排，可独立调用。

## Rules

### Rule: Read Upstream

解析上游 `writing-plans` 的 SKILL.md 路径（同 [Rule: Read Upstream](../os-brainstorming/SKILL.md#rule-read-upstream) 的解析优先级 + 报错子句），Read 解析出的 `writing-plans/SKILL.md` 作为基线。**Read 而非 Skill-invoke**。

### Rule: Read Sub-Skills

按需 Read `mattpocock-skills` 的 `skills/engineering/to-tickets/SKILL.md`（ticket 拆分 Steps 1-4）。加载失败协议见 [subagent-lifecycle.md](../docs/subagent-lifecycle.md#rule-delegate-load-failure)。

### Rule: Section-by-Section

计划逐节 Write/Edit（一个 section 一次工具调用），不整篇一次性生成。

### Rule: Fresh-Subagent Review Passes

计划用 fresh subagent 评审 passes（Completeness & spec alignment → Task decomposition → Buildability & type consistency），纪律见 [review-dispatch.md](../docs/review-dispatch.md)。

### Rule: Tickets Publish Redirect

ticket 拆分后发布到本地单文件 `docs/superpowers/tickets/YYYY-MM-DD-<feature>-tickets.md`（不发布远程 tracker）。

## Red Flags

- 「整篇一个 Write」→ 逐节写（Rule: Section-by-Section）
- 「tickets 发 GitHub」→ 本地单文件（Rule: Tickets Publish Redirect）
