---
name: writing-plans
description: 独立写计划流程编排器 —— Read 上游 superpowers:writing-plans 作为基线，叠加个人规则（逐节写 / cli review 评审 passes / to-tickets 发布重定向）。
---

# Osuperpowers Writing-Plans

完整写计划流程编排，可独立调用。

## Rules

### Rule: Read Upstream

Read 上游 `superpowers:writing-plans` 的 SKILL.md 作为流程基线 **当可用时**（解析优先级 + 不可用回退同 [Rule: Read Upstream](../brainstorming/SKILL.md#rule-read-upstream)）。**Read 而非 Skill-invoke**。

### Rule: Read Sub-Skills

按需 Read `mattpocock-skills` 的 `skills/engineering/to-tickets/SKILL.md`（ticket 拆分 Steps 1-4）。加载失败协议见 [subagent-lifecycle.md](../docs/subagent-lifecycle.md#rule-delegate-load-failure)。

### Rule: Section-by-Section

计划逐节 Write/Edit（一个 section 一次工具调用），不整篇一次性生成。

### Rule: Plan Review via CLI

计划 review 分 3 类 pass（completeness & spec alignment / task decomposition / buildability & type consistency），每 pass 一次 fresh `cdd-review` 派发：
  cdd-review --harness claude --template plan-review --param PASS=<completeness|decomposition|buildability> --param DOC=<plan-path> --param SPEC=<spec-path>
**模板解析复用** [Rule: Read Upstream](#rule-read-upstream) 的路径规则（`{plugin-root}` = osuperpowers 根）。派发纪律见 [review-dispatch.md](../docs/review-dispatch.md)（D1/D2/D3 + fresh-pass，原样映射到 cli）。

### Rule: Tickets Publish Redirect

ticket 拆分后发布到本地单文件 `docs/superpowers/tickets/YYYY-MM-DD-<feature>-tickets.md`（不发布远程 tracker）。

### Rule: Next-Step Routing

计划 review 通过后，Skill-invoke **`osuperpowers:executing-plans`**（而非上游 `superpowers:subagent-driven-development` 或 `superpowers:executing-plans`）。`osuperpowers:executing-plans` 是唯一入口——它内部处理模式选择（in-session / subagent / cli）、应用 osuperpowers 特有规则（Task Complexity、Confirm Once、Fix Loop、Confirm Seams、Per-Task Review、Quality Invariants、D6 Aggregation、Ledger），并路由到正确的执行路径。

**执行移交文本：**

> 「Plan complete and saved to `docs/superpowers/plans/<filename>.md`. Ready to execute — I'll hand off to `osuperpowers:executing-plans` for mode selection and execution.」

不要提供 subagent vs inline 二选一——`osuperpowers:executing-plans` 负责模式选择。

## Red Flags

- 「整篇一个 Write」→ 逐节写（Rule: Section-by-Section）
- 「tickets 发 GitHub」→ 本地单文件（Rule: Tickets Publish Redirect）
- 「Invoke superpowers:subagent-driven-development / superpowers:executing-plans」→ invoke **`osuperpowers:executing-plans`**（Rule: Next-Step Routing）
- 「Offer subagent vs inline choice」→ `osuperpowers:executing-plans` 处理模式选择（Rule: Next-Step Routing）
