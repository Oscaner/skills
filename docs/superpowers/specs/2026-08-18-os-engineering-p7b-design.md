# P7b：技能目录改名 + 命名空间 + 文档更新

## Header

- **Version**: v1.0 · 2026-08-18
- **Status**: Approved
- **Phase**: P7b (of P7 series — brand unification)
- **Dependencies**: P7a（包目录改名 + emit 脚本适配）完成后启动
- **Author**: Oscaner Miao · Claude Code (Opus 4.8)
- **Constraints**:
  - Conventional commits，无 attribution / co-author trailer
  - 禁用 git worktree
  - 过渡期 `pnpm run validate` 必须保持通过

## §0 Document scope

P7b 是 P7 系列的第二个子阶段，处理技能目录名和命名空间改名，以及所有文档引用更新。P7d（文档更新）合并入 P7b。

## §1 技能目录改名

```
packages/osuperpowers/skills/os-brainstorming/      → packages/osuperpowers/skills/brainstorming/
packages/osuperpowers/skills/os-writing-plans/      → packages/osuperpowers/skills/writing-plans/
packages/osuperpowers/skills/os-executing-plans/    → packages/osuperpowers/skills/executing-plans/
packages/osuperpowers/skills/os-finishing/          → packages/osuperpowers/skills/finishing/
packages/osuperpowers/skills/os-debugging/          → packages/osuperpowers/skills/debugging/
packages/osuperpowers/skills/os-verification/       → packages/osuperpowers/skills/verification/
packages/osuperpowers/skills/os-code-review/        → packages/osuperpowers/skills/code-review/
packages/osuperpowers/skills/os-init/               → packages/osuperpowers/skills/init/
packages/osuperpowers/skills/os-report-issue/       → packages/osuperpowers/skills/report-issue/
```

cli-* 技能目录不变（`cli-driven-development/`, `cli-select/`, `cli-task/`, `cli-code-review/`）。

## §2 overrides.manifest.json 更新

### name 字段

| 旧 name | 新 name |
|---------|---------|
| `osuperpowers:os-brainstorming` | `osuperpowers:brainstorming` |
| `osuperpowers:os-writing-plans` | `osuperpowers:writing-plans` |
| `osuperpowers:os-executing-plans` | `osuperpowers:executing-plans` |
| `osuperpowers:os-finishing` | `osuperpowers:finishing` |
| `osuperpowers:os-debugging` | `osuperpowers:debugging` |
| `osuperpowers:os-verification` | `osuperpowers:verification` |
| `osuperpowers:os-code-review` | `osuperpowers:code-review` |

`osuperpowers:cli-driven-development` 和 `mattpocock-skills:tdd` 不变。

> **注意**：`os-finishing` 在 manifest 中出现两次（targets[4]：`superpowers:finishing-a-development-branch`，targets[9]：`superpowers:using-git-worktrees`），两处都需要更新。

### source 字段

| 旧 source | 新 source |
|-----------|-----------|
| `../osuperpowers/skills/os-brainstorming` | `../osuperpowers/skills/brainstorming` |
| `../osuperpowers/skills/os-writing-plans` | `../osuperpowers/skills/writing-plans` |
| `../osuperpowers/skills/os-executing-plans` | `../osuperpowers/skills/executing-plans` |
| `../osuperpowers/skills/os-finishing` | `../osuperpowers/skills/finishing` |
| `../osuperpowers/skills/os-debugging` | `../osuperpowers/skills/debugging` |
| `../osuperpowers/skills/os-verification` | `../osuperpowers/skills/verification` |
| `../osuperpowers/skills/os-code-review` | `../osuperpowers/skills/code-review` |

> **注意**：`os-finishing` 在 manifest 中出现两次（两个 target 共享同一技能目录），source 表中只列一行，但 manifest 中两处 `../osuperpowers/skills/os-finishing` 都需要更新为 `../osuperpowers/skills/finishing`。

## §3 SKILL.md 内部引用更新

每个改名后的技能 SKILL.md 需要检查并更新：

1. **Self-reference 命名空间** — 如果引用了 `Skill(osuperpowers:os-*)`，改为 `Skill(osuperpowers:*)`
2. **路径引用** — 如果使用了 `../os-*/SKILL.md` 的 Markdown 链接，去掉 `os-` 前缀
3. **描述文本** — 如果提到了 `os-brainstorming` 等技能名，更新

### 重点检查文件

| 文件 | 检查内容 |
|------|----------|
| `skills/os-init/spor.md` | 自检表模板 `Skill(osuperpowers:os-*)` → `Skill(osuperpowers:*)`；`engineering-version` stamp 保持 |
| `skills/os-init/SKILL.md` | `os-init` → `init` 自我引用；`engineering-version` stamp 保持 |
| `skills/os-init/harness.md` | `os-init` → `init` 引用 |
| `skills/os-writing-plans/SKILL.md` | 引用了 `mattpocock-skills` 的 `skills/engineering/to-tickets/SKILL.md`（这个是 upstream 内部 namespace，保持 `engineering` 不变） |
| `skills/os-report-issue/SKILL.md` | `superpowers-overrides` label 引用 → `osuperpowers-router` |
| `skills/os-brainstorming/SKILL.md` | 可能引用 `os-*` 技能名 |

## §4 脚本适配

### scripts/emit.mjs

`emitAgentsSkillsCopy` 的 namespace 名更新：

```js
// 旧: ["engineering", join(root, "packages/osuperpowers/skills")]
// 新: ["osuperpowers", join(root, "packages/osuperpowers/skills")]
```

### os-init/spor.md 自检表模板

自检表行去掉 `os-` 前缀：

```
| `/brainstorming` | Skill(osuperpowers:brainstorming) |
| `/writing-plans` | Skill(osuperpowers:writing-plans) |
| `/subagent-driven-development` | Skill(osuperpowers:cli-driven-development) |
| `/executing-plans` | Skill(osuperpowers:executing-plans) |
| `/finishing-a-development-branch` | Skill(osuperpowers:finishing) |
| `/systematic-debugging` | Skill(osuperpowers:debugging) |
| `/verification-before-completion` | Skill(osuperpowers:verification) |
| `/receiving-code-review` | Skill(osuperpowers:code-review) |
| `/using-git-worktrees` | Skill(osuperpowers:finishing) |
```

## §5 文档更新

### 全局替换规则

**执行顺序**（必须先执行更具体的规则，再执行兜底规则）：

| 顺序 | 旧文本 | 新文本 | 说明 |
|------|--------|--------|------|
| 1 | `packages/engineering/` | `packages/osuperpowers/` | 路径替换（带尾斜杠，优先匹配目录路径） |
| 2 | `packages/engineering` | `packages/osuperpowers` | 路径替换（无尾斜杠，兜底匹配） |
| 3 | `packages/superpowers-overrides/` | `packages/osuperpowers-router/` | 路径替换 |
| 4 | `../../engineering/` | `../../osuperpowers/` | 相对路径替换（如 `sdd-h6-reference.md` 中的链接） |
| 5 | `superpowers-overrides` | `osuperpowers-router` | 插件名替换 |
| 6 | `engineering:os-` | `osuperpowers:` | 命名空间 + 去掉 `os-`（如 `engineering:os-brainstorming` → `osuperpowers:brainstorming`） |
| 7 | `engineering:cli-` | `osuperpowers:cli-` | 命名空间引用（cli-* 技能保留 `cli-`） |
| 8 | `engineering:` | `osuperpowers:` | 通用命名空间兜底（最后执行，覆盖遗漏的 `engineering:*`） |
| 9 | `os-brainstorming` → `os-writing-plans` → ... → `os-report-issue` | 去掉 `os-` 前缀 | 纯技能名引用 |
| 10 | `os-init` | `init` | 技能名/命令引用 |

### 需更新的文件

| 文件 | 旧引用数量（约） |
|------|-----------------|
| `README.md` | 10 处 |
| `README.zh-CN.md` | 10 处 |
| `CLAUDE.md` | 12 处 |
| `packages/osuperpowers/CLAUDE.md` | 30 处 |
| `packages/osuperpowers/README.md` | 20 处 |
| `packages/osuperpowers-router/CLAUDE.md` | 15 处 |
| `packages/osuperpowers-router/README.md` | 15 处 |
| `packages/osuperpowers/docs/cdd-reference.md` | 5 处 |
| `packages/osuperpowers/docs/cdd-reference.zh-CN.md` | 5 处 |
| `packages/osuperpowers-router/docs/cross-harness-overrides.md` | 10 处 |
| `packages/osuperpowers-router/docs/sdd-h6-reference.md` | 2 处 |
| `docs/gate-install.md` | 2 处 |
| `docs/research/2026-08-16-harness-plugin-availability.md` | 10 处 |
| `docs/research/2026-08-10-harness-marketplace-hooks.md` | 5 处 |

### 注意事项

- `mattpocock-skills` 的 `skills/engineering/to-tickets/SKILL.md` 路径是 upstream 内部 namespace，不在改名范围内
- `engineering-version` stamp 在 `spor.md` 和 `SKILL.md` 中保持（P7c 改版本号）
- `.agents/skills/engineering/` 目录由 emit 重新生成，namespace 名更新后自动跟随
- 历史 changeset 文件和 CHANGELOG 文件不修改

## §6 验证方案

```bash
# 1. 按 §1 改名
git mv skills/os-brainstorming skills/brainstorming
# ... 其余 12 个技能目录

# 2. 更新 manifest + 脚本 + 文档（按 §5 替换顺序执行）

# 3. 验证无遗留引用
grep -rn 'packages/engineering' README.md README.zh-CN.md CLAUDE.md packages/ --include='*.md' 2>/dev/null; echo "exit: $?"
grep -rn 'packages/superpowers-overrides' README.md README.zh-CN.md CLAUDE.md packages/ --include='*.md' 2>/dev/null; echo "exit: $?"
grep -rn 'engineering:os-\|engineering:cli-' packages/ --include='*.md' 2>/dev/null; echo "exit: $?"

# 4. 重新生成 manifests
pnpm run emit

# 5. 验证
pnpm run emit:check
pnpm run validate
```

**验收标准**：
- ✅ `pnpm run emit:check` 无 drift
- ✅ `pnpm run validate` 全部通过
- ✅ 所有文档中无 `packages/engineering`、`packages/superpowers-overrides` 路径引用
- ✅ 所有文档中无 `os-brainstorming` 等 `os-*` 技能名引用（`os-init` → `init`，`os-report-issue` → `report-issue`）
- ✅ 所有文档中无 `engineering:os-*` 或 `engineering:cli-*` 命名空间引用（应为 `osuperpowers:*` / `osuperpowers:cli-*`）
- ✅ 自检表使用 `Skill(osuperpowers:brainstorming)` 等新命名空间