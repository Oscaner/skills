---
name: os-finishing
description: 独立收尾流程编排器 —— Read 上游 superpowers:finishing-a-development-branch 作为基线，叠加个人规则（禁 worktree / conventional commit / 无 attribution / Option4 输入 discard）。
---

# OS Finishing

开发分支收尾：合并 / PR / 保留 / 丢弃。

## Rules

### Rule: Read Upstream

Resolve `{superpowers-plugin-root}`（同 [Rule: Read Upstream](../os-brainstorming/SKILL.md#rule-read-upstream) 的解析+报错子句），Read `skills/finishing-a-development-branch/SKILL.md` 作为基线。**Read 而非 Skill-invoke**。

### Rule: No Worktrees

**禁 worktree**（用户策略）。跳过上游 worktree 检测块，用 Standard 4 options（normal-repo 变体）。若意外检测到 worktree 状态 → STOP + 报告用户。跳过上游 Step 6（worktree remove/prune）。

### Rule: Conventional Commits

合并 commit / PR title 遵循 conventional commits；**禁止任何 attribution/co-author/AI-generation 行**（trailers、footers、inline 都不行）。PR body 只用 `## Summary` + `## Test Plan`，不追加 attribution 段。

### Rule: Option4 Typed Discard

Option 4（丢弃分支）要求用户**输入 discard 字面量**确认，不用多选菜单。摩擦是防误删。

## Red Flags

- 「跑一下 worktree 检测也无害」→ 禁 worktree，跳过检测块（Rule: No Worktrees）
- 「PR body 加 Claude attribution 是标配」→ 用户策略禁止（Rule: Conventional Commits）
