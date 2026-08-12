---
name: os-init
description: 参数化初始化工具。`os-init spor` 初始化 superpowers 自检表（写项目 CLAUDE.md / .cursor rules，表指向 os-*/cli-* 目标）。未来 `os-init <x>` 扩展其它目标。
---

# OS Init

初始化各系统的自检表。

## Rules

### Rule: Parameterized

`os-init spor` → 写 superpowers 触发自检表（CLAUDE.md override-trigger 表 + .cursor rules），表项「上游触发 → Skill(os-engineering:os-* / mattpocock-skills:tdd)」。未来扩展 `os-init <x>`。

### Rule: Idempotent

重复运行覆盖自检表（保留用户手动追加的非冲突内容）。

## 自检表内容（os-init spor 写入）

`os-init spor` 将下列内容写入项目 `CLAUDE.md` / `.cursor rules`（自检表来源 = overrides manifest 目标表，单一 SOT）：

```markdown
<!-- os-engineering-version: 0.1.0 -->

## os-engineering self-check

| Trigger | First tool call |
|---|---|
| `/brainstorming` | Skill(os-engineering:os-brainstorming) |
| `/writing-plans` | Skill(os-engineering:os-writing-plans) |
| `/subagent-driven-development` | Skill(os-engineering:cli-driven-development) |
| `/executing-plans` | Skill(os-engineering:os-executing-plans) |
| `/finishing-a-development-branch` | Skill(os-engineering:os-finishing) |
| `/systematic-debugging` | Skill(os-engineering:os-debugging) |
| `/test-driven-development` | Skill(mattpocock-skills:tdd) |
| `/verification-before-completion` | Skill(os-engineering:os-verification) |
| `/receiving-code-review` | Skill(os-engineering:os-code-review) |
| `/using-git-worktrees` | Skill(os-engineering:os-finishing) |
```

## Red Flags

- 「只改 CLAUDE.md 漏了 .cursor rules」→ `os-init spor` 两处都写
- 「手动改表项」→ 表项来源是 overrides manifest（单一 SOT），由 os-init 覆盖同步
