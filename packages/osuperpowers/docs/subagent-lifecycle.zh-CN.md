# Subagent Lifecycle

跨切面参考：被 osuperpowers 技能的评审 passes 规则引用。

## Rules

### Rule: Fresh Subagent Per Pass

每次评审 pass 派发一个 fresh subagent，不复用前序 pass 的 agent。原因：避免评审者被前一轮输出锚定。

### Rule: Concurrent iff Independent

多个 pass 仅在相互独立（无数据依赖，即不读前序 pass 的输出）时并发。有依赖则串行。

### Rule: Delegate Load Failure

委派 `mattpocock-skills:*` 加载失败时：目标 skill 无法解析/加载 → 向用户报错 + 询问下一步（不静默跳过委派）；plugin 整体缺失 → 静默降级（该委派环节跳过，流程继续，结果标注未委派）。被 debugging（→ diagnosing-bugs）、code-review（→ grilling/tdd）、writing-plans（→ to-tickets）、brainstorming（→ grilling）的委派规则引用。

## Red Flags

- 「复用上一个 reviewer，上下文热」→ fresh subagent 是令牌效率与客观性的平衡（Rule: Fresh Subagent Per Pass）
