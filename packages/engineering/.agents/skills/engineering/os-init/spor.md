# os-init spor

`os-init spor` 初始化 superpowers 触发自检表（写项目 CLAUDE.md / .cursor rules，表指向 os-*/cli-* 目标）。自检表来源 = overrides manifest 目标表（单一 SOT）。

## Rules

### Rule: Parameterized

`os-init spor` → 写 superpowers 触发自检表（CLAUDE.md override-trigger 表 + .cursor rules），表项「上游触发 → Skill(engineering:os-* / mattpocock-skills:tdd)」。

### Rule: Idempotent

重复运行覆盖自检表（保留用户手动追加的非冲突内容）。

### Rule: Table Source

自检表来源 = overrides manifest 目标表（`packages/superpowers-overrides/overrides.manifest.json`，单一 SOT）。手动改表项会被 `os-init spor` 覆盖同步。

## 自检表内容（os-init spor 写入）

`os-init spor` 将下列内容写入项目 `CLAUDE.md` / `.cursor rules`：

```markdown
<!-- engineering-version: 0.1.0 -->

## engineering self-check

| Trigger | First tool call |
|---|---|
| `/brainstorming` | Skill(engineering:os-brainstorming) |
| `/writing-plans` | Skill(engineering:os-writing-plans) |
| `/subagent-driven-development` | Skill(engineering:cli-driven-development) |
| `/executing-plans` | Skill(engineering:os-executing-plans) |
| `/finishing-a-development-branch` | Skill(engineering:os-finishing) |
| `/systematic-debugging` | Skill(engineering:os-debugging) |
| `/test-driven-development` | Skill(mattpocock-skills:tdd) |
| `/verification-before-completion` | Skill(engineering:os-verification) |
| `/receiving-code-review` | Skill(engineering:os-code-review) |
| `/using-git-worktrees` | Skill(engineering:os-finishing) |
```

> 版本 stamp 与 `engineering` package 版本同步（`scripts/version-packages.mjs`），两份都写：SKILL.md（版本标记）与本文档模板块。

## Red Flags

- 「只改 CLAUDE.md 漏了 .cursor rules」→ `os-init spor` 两处都写
- 「手动改表项」→ 表项来源是 overrides manifest（单一 SOT），由 os-init 覆盖同步
