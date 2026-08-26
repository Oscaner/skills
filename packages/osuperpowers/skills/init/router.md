# init router

`init router` 初始化 superpowers 触发自检表（写项目 CLAUDE.md / .cursor rules，表指向 cli-* 目标）。自检表来源 = overrides manifest 目标表（单一 SOT）。

## Rules

### Rule: Parameterized

`init router` → 写 superpowers 触发自检表（CLAUDE.md override-trigger 表 + .cursor rules），表项「上游触发 → Skill(osuperpowers:* / mattpocock-skills:tdd)」。

### Rule: Idempotent

重复运行覆盖自检表（保留用户手动追加的非冲突内容）。

### Rule: Table Source

自检表来源 = overrides manifest 目标表（`packages/osuperpowers-router/overrides.manifest.json`，单一 SOT）。手动改表项会被 `init router` 覆盖同步。

## 自检表内容（init router 写入）

`init router` 将下列内容写入项目 `CLAUDE.md` / `.cursor rules`：

> **说明**：下表中的 Trigger 均来自上游 **superpowers** 插件（而非 osuperpowers）。当用户输入这些触发词时，`osuperpowers-router` 拦截并路由到右侧的 osuperpowers 编排器。

```markdown
<!-- osuperpowers-version: 0.1.1 -->

## osuperpowers self-check

| Upstream trigger (来自 superpowers) | Routed to osuperpowers skill |
|---|---|
| `/brainstorming` | Skill(osuperpowers:brainstorming) |
| `/writing-plans` | Skill(osuperpowers:writing-plans) |
| `/subagent-driven-development` | Skill(osuperpowers:cli-driven-development) |
| `/finishing-a-development-branch` | Skill(osuperpowers:finishing) |
| `/test-driven-development` | Skill(mattpocock-skills:tdd) |
| `/using-git-worktrees` | Skill(osuperpowers:finishing) |
```

> 版本 stamp 与 `osuperpowers` package 版本同步（`scripts/version-packages.mjs`），两份都写：SKILL.md（版本标记）与本文档模板块。

## Red Flags

- 「只改 CLAUDE.md 漏了 .cursor rules」→ `init router` 两处都写
- 「手动改表项」→ 表项来源是 overrides manifest（单一 SOT），由 init router 覆盖同步