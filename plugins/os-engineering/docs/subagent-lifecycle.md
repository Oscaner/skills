# Subagent Lifecycle

跨切面参考：被 os-* 技能的评审 passes 规则引用。

## Rules

### Rule: Fresh Subagent Per Pass

每次评审 pass 派发一个 fresh subagent，不复用前序 pass 的 agent。原因：避免评审者被前一轮输出锚定。

### Rule: Concurrent iff Independent

多个 pass 仅在相互独立（无数据依赖，即不读前序 pass 的输出）时并发。有依赖则串行。

## Red Flags
- 「复用上一个 reviewer，上下文热」→ fresh subagent 是令牌效率与客观性的平衡（Rule: Fresh Subagent Per Pass）
