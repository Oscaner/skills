---
name: os-code-review
description: 独立接收评审反馈编排器 —— Read 上游 superpowers:receiving-code-review 作为基线，叠加个人规则（grilling 澄清 / tdd 委派）。可选调 cli-code-review 派发评审。
---

# OS Code Review

处理评审反馈：验证证据、拒绝表演式附和。

## Rules

### Rule: Read Upstream

解析上游 `receiving-code-review` 的 SKILL.md 路径（同 [Rule: Read Upstream](../os-brainstorming/SKILL.md#rule-read-upstream) 的解析优先级 + 报错子句），Read 解析出的 `receiving-code-review/SKILL.md` 作为基线。**Read 而非 Skill-invoke**。

### Rule: Understand

上游 RESPONSE 模式的 UNDERSTAND 步：反馈项不清晰 → 委派 `mattpocock-skills:grilling` 澄清，全部项达成共识才进 VERIFY。加载失败协议见 [subagent-lifecycle.md](../docs/subagent-lifecycle.md#rule-delegate-load-failure)。

### Rule: Implement

IMPLEMENT 步：每个 fix 委派 `mattpocock-skills:tdd`（红-绿循环）。豁免：纯机械编辑（无行为/schema/config 变化——重命名、空白、注释重排）。可疑时用 TDD。加载失败协议见 [subagent-lifecycle.md](../docs/subagent-lifecycle.md#rule-delegate-load-failure)。

### Rule: Optional CLI Review

需派发评审时可调 [cli-code-review](../cli-code-review/SKILL.md)（任意 diff 经选定 harness CLI）。

## Red Flags

- 「模糊反馈靠猜」→ grilling 澄清（Rule: Understand）
