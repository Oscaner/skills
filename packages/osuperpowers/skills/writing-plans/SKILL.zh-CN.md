---
name: writing-plans
description: 独立 plan 写作编排器——读取上游 superpowers:writing-plans 作为基线，叠加个人规则（逐节写入 / CLI review pass / tickets 发布重定向）。
---

# Osuperpowers Writing-Plans

完整 plan 写作流程编排，可单独调用。

## Checklist

1. 读取上游 `superpowers:writing-plans` SKILL.md（Rule: Read Upstream）
2. 读取 spec 文件，理解设计约束
3. 逐节写入 plan——每节一次 tool call（Rule: Section-by-Section）
4. 3-pass Plan Review via CLI（completeness / decomposition / buildability）
5. 将写完的 plan 一次性呈现给用户确认
6. Execution Handoff → 移交 `osuperpowers:executing-plans`

## Rules

### Rule: Read Upstream

有上游时读取 `superpowers:writing-plans` SKILL.md 作为基线（解析优先级 + 不可用回退同 [Rule: Read Upstream](../brainstorming/SKILL.md#rule-read-upstream)）。**读取，不 Skill-invoke**。

### Rule: Read Sub-Skills

按需读取 `mattpocock-skills` `skills/engineering/to-tickets/SKILL.md`（ticket 拆分步骤 1-4）。加载失败协议见 [subagent-lifecycle.md](../docs/subagent-lifecycle.md#rule-delegate-load-failure)。

### Rule: Section-by-Section

逐节写入/编辑 plan（每节一次 tool call），而非一次性批量生成。

写入粒度与确认时机解耦：每节独立 tool call 写入（写入粒度）；所有节写入完成后一次性呈现给用户（确认时机）。**禁止**每节完成后暂停等待用户回应。

### Rule: Plan Review via CLI

<HARD-GATE>
Plan 写完后，必须按序执行三次 cdd-review CLI pass
（completeness / decomposition / buildability），
不可用内联自检替代，全部通过后方可进入 Execution Handoff。
</HARD-GATE>

Plan review 有 3 种 pass 类型（completeness & spec 对齐 / task 分解 / buildability & 类型一致性），每个 pass 派发一次新的 `cdd-review`：
  cdd-review --harness claude --template plan-review --param PASS=<completeness|decomposition|buildability> --param DOC=<plan-path> --param SPEC=<spec-path>
**模板解析复用** [Rule: Read Upstream](#rule-read-upstream) 的路径规则（`{plugin-root}` = osuperpowers 根）。派发纪律见 [docs-review.md](../docs/docs-review.md)（D1/D2/D3 + fresh-pass，原样映射到 cli；Review Stopping 循环 + Handoff Output）。
Review Stopping next-step 标签（本技能）：`"Execution Handoff"`。

### Rule: Tickets Publish Redirect

ticket 拆分后，发布到单一本地文件 `docs/superpowers/tickets/YYYY-MM-DD-<feature>-tickets.md`（不发布到远程 tracker）。

### Rule: Next-Step Routing

plan review 通过后，调用 **`osuperpowers:executing-plans`**（非上游 `superpowers:subagent-driven-development` 或 `superpowers:executing-plans`）。

**Execution handoff 文本：**

> "Plan complete and saved to `docs/superpowers/plans/<filename>.md`. Ready to execute — I'll hand off to `osuperpowers:executing-plans` for mode selection and execution."

不提供 subagent vs inline 选择——`osuperpowers:executing-plans` 自行处理模式选择。

## Red Flags

- "一次性写入全部内容" → 逐节写入（Rule: Section-by-Section）
- "发布 tickets 到 GitHub" → 单一本地文件（Rule: Tickets Publish Redirect）
- "调用 superpowers:subagent-driven-development / superpowers:executing-plans" → 调用 **`osuperpowers:executing-plans`**（Rule: Next-Step Routing）
- "提供 subagent vs inline 选择" → `osuperpowers:executing-plans` 处理模式选择（Rule: Next-Step Routing）
- "每节写完后询问用户是否继续" → 写完所有节再确认（Rule: Section-by-Section）
- "用内联自检替代 Plan Review cdd-review CLI" → 违反 HARD-GATE Plan Review，必须调用三次 CLI
- "展示 subagent / in-session / CLI 三选一选项" → 使用 Execution Handoff 文本，移交 `osuperpowers:executing-plans`（Rule: Next-Step Routing）
- "blocker=0 后自动修复 warn/nit 并重跑 review" → 违反 Review Stopping 规则（docs-review.md），应呈现给用户，用户决策后视需求决定是否重跑
- "为获取 warn/nit 内容额外发起新的 cdd-review 调用" → 违反 Review Stopping 规则，从本次 3-pass cycle 已有输出读取
