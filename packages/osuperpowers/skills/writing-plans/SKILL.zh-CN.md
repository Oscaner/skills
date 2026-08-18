---
name: writing-plans
description: 独立写计划流程编排器 —— Read 上游 superpowers:writing-plans 作为基线，叠加个人规则（逐节写 / cli review 评审 passes / to-tickets 发布重定向）。
---

# OS Writing-Plans

完整写计划流程编排，可独立调用。

## Rules

### Rule: Read Upstream

Read 上游 `superpowers:writing-plans` 的 SKILL.md 作为流程基线 **当可用时**（解析优先级 + 不可用回退同 [Rule: Read Upstream](../brainstorming/SKILL.md#rule-read-upstream)）。**Read 而非 Skill-invoke**。

### Rule: Read Sub-Skills

按需 Read `mattpocock-skills` 的 `skills/engineering/to-tickets/SKILL.md`（ticket 拆分 Steps 1-4）。加载失败协议见 [subagent-lifecycle.md](../docs/subagent-lifecycle.md#rule-delegate-load-failure)。

### Rule: Section-by-Section

计划逐节 Write/Edit（一个 section 一次工具调用），不整篇一次性生成。

### Rule: Plan Review via CLI

计划 review 分 3 类 pass（completeness & spec alignment / task decomposition / buildability & type consistency），每 pass 一次 fresh `cdd-exec` 派发：
  cdd-exec --harness claude --prompt "<plan-document-reviewer 模板 + pass 类别 + 文档路径>"
**模板解析复用** [Rule: Read Upstream](#rule-read-upstream) 的路径规则（`{plugin-root}` = engineering 根）。派发纪律见 [review-dispatch.md](../docs/review-dispatch.md)（D1/D2/D3 + fresh-pass，原样映射到 cli）。

### Rule: Tickets Publish Redirect

ticket 拆分后发布到本地单文件 `docs/superpowers/tickets/YYYY-MM-DD-<feature>-tickets.md`（不发布远程 tracker）。

## Red Flags

- 「整篇一个 Write」→ 逐节写（Rule: Section-by-Section）
- 「tickets 发 GitHub」→ 本地单文件（Rule: Tickets Publish Redirect）
