---
name: os-verification
description: 独立完成前验证编排器 —— Read 上游 superpowers:verification-before-completion 作为基线，叠加个人规则（pre-claim gate / 软化语言自检）。
---

# OS Verification

完成前验证：证据先于断言。

## Rules

### Rule: Read Upstream

解析上游 `verification-before-completion` 的 SKILL.md 路径（同 [Rule: Read Upstream](../os-brainstorming/SKILL.md#rule-read-upstream) 的解析优先级 + 报错子句），Read 解析出的 `verification-before-completion/SKILL.md` 作为基线。**Read 而非 Skill-invoke**。

### Rule: Pre-Claim Gate

任何声称「完成 / 已修 / 通过」的输出前，先调上游验证流程（触发时机 = 模型内部决定「可以说完成了」之前，非输出后拦截）。

### Rule: Softening-Language Self-Check

输出前扫描软化语言：状态类（"should pass"/"looks good"/"appears correct"）、规避类。发现 → 视为未验证声称，补证据。

## Red Flags

- 「简单改动不用验证」→ pre-claim gate 覆盖所有流程（Rule: Pre-Claim Gate）
