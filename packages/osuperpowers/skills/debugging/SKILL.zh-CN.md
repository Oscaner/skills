---
name: debugging
description: 独立系统化调试编排器 —— Read 上游 superpowers:systematic-debugging 作为基线，叠加个人规则（无诊断证据不提案 / 委派 diagnosing-bugs）。
---

# Osuperpowers Debugging

系统化调试：证据先于修复提案。

## Rules

### Rule: Read Upstream

Read 上游 `superpowers:systematic-debugging` 的 SKILL.md 作为流程基线 **当可用时**（解析优先级 + 不可用回退同 [Rule: Read Upstream](../brainstorming/SKILL.md#rule-read-upstream)）。**Read 而非 Skill-invoke**。

### Rule: No-Fix-Without-Evidence

修复提案前，当前轮必须有诊断工具输出（Read/Bash/Grep 用于信息收集）或对先前诊断结果的显式引用。否则**拒绝输出修复提案**，先完成根因调查。豁免：用户明确说已知根因。

### Rule: Delegate Diagnosis

诊断循环委派 `mattpocock-skills:diagnosing-bugs`（Skill-invoke），不重实现。加载失败协议见 [subagent-lifecycle.md](../docs/subagent-lifecycle.md#rule-delegate-load-failure)。

## Red Flags

- 「先猜再验证」→ 无证据不提案（Rule: No-Fix-Without-Evidence）
