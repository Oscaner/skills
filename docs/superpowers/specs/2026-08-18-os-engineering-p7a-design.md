# P7a：包目录改名 + emit 脚本适配

## Header

- **Version**: v1.0 · 2026-08-18
- **Status**: Approved
- **Phase**: P7a (of P7 series — brand unification)
- **Dependencies**: P6e (文档重写) 完成后启动
- **Author**: Oscaner Miao · Claude Code (Opus 4.8)
- **Constraints**:
  - Conventional commits，无 attribution / co-author trailer
  - 禁用 git worktree
  - 过渡期 `pnpm run validate` 必须保持通过

## §0 Document scope

P7a 是 P7 系列的第一个子阶段，仅处理包目录改名和 emit 脚本适配。技能目录名改名（`os-*` → `*`）和命名空间（`engineering:` → `osuperpowers:`）留到 P7b。

## §1 目录改名

```
packages/engineering/              → packages/osuperpowers/
packages/superpowers-overrides/    → packages/osuperpowers-router/
```

使用 `git mv` 保留历史记录。`packages/` 下的目录名是 plugin name 的自动发现源（`scripts/lib/emit/source.mjs` 第 178 行：`name: dirName`），改名后 marketplace 中的 plugin name 自动变为 `osuperpowers` 和 `osuperpowers-router`。

## §2 package.json 更新

**`packages/osuperpowers/package.json`**（原 `packages/engineering/package.json`）：

| 字段 | 旧值 | 新值 |
|------|------|------|
| `name` | `@oscaner-skills/engineering` | `@oscaner-skills/osuperpowers` |
| `repository.directory` | `packages/engineering` | `packages/osuperpowers` |
| `description` | `Standalone engineering skills...` | `Standalone osuperpowers skills: os-* orchestrators, cli-* family, CDD engine, cross-harness gate.` |

**`packages/osuperpowers-router/package.json`**（原 `packages/superpowers-overrides/package.json`）：

| 字段 | 旧值 | 新值 |
|------|------|------|
| `name` | `@oscaner-skills/superpowers-overrides` | `@oscaner-skills/osuperpowers-router` |
| `repository.directory` | `packages/superpowers-overrides` | `packages/osuperpowers-router` |
| `description` | `Personal overrides for the superpowers plugin...` | `Trigger router for osuperpowers: intercepts upstream superpowers triggers and routes to osuperpowers / mattpocock targets.` |

`name` 是 npm 包名，改名后新包发布到 npm，旧包保留但不再更新。

## §3 overrides.manifest.json source 路径更新

`overrides.manifest.json` 中每个 target 的 `source` 字段引用了 `../engineering/skills/...`，改为 `../osuperpowers/skills/...`。`name` 字段（`engineering:os-brainstorming` 等）保持不变（P7b 改）。

| 旧 source | 新 source |
|-----------|-----------|
| `../engineering/skills/os-brainstorming` | `../osuperpowers/skills/os-brainstorming` |
| `../engineering/skills/os-writing-plans` | `../osuperpowers/skills/os-writing-plans` |
| `../engineering/skills/cli-driven-development` | `../osuperpowers/skills/cli-driven-development` |
| `../engineering/skills/os-executing-plans` | `../osuperpowers/skills/os-executing-plans` |
| `../engineering/skills/os-finishing` | `../osuperpowers/skills/os-finishing` |
| `../engineering/skills/os-debugging` | `../osuperpowers/skills/os-debugging` |
| `../engineering/skills/os-verification` | `../osuperpowers/skills/os-verification` |
| `../engineering/skills/os-code-review` | `../osuperpowers/skills/os-code-review` |

mattpocock-skills:tdd 的 source 为 null，不需要改。

## §4 scripts/emit.mjs 更新

### productRoots 数组（第 105-118 行）

| 旧路径 | 新路径 |
|--------|--------|
| `packages/engineering/.claude-plugin` | `packages/osuperpowers/.claude-plugin` |
| `packages/engineering/.cursor-plugin` | `packages/osuperpowers/.cursor-plugin` |
| `packages/engineering/.codex-plugin` | `packages/osuperpowers/.codex-plugin` |
| `packages/engineering/.kimi-plugin` | `packages/osuperpowers/.kimi-plugin` |
| `packages/engineering/.qoder-plugin` | `packages/osuperpowers/.qoder-plugin` |
| `packages/engineering/hooks` | `packages/osuperpowers/hooks` |
| `packages/engineering/.agents` | `packages/osuperpowers/.agents` |
| `packages/superpowers-overrides/.claude-plugin` | `packages/osuperpowers-router/.claude-plugin` |
| `packages/superpowers-overrides/.cursor-plugin` | `packages/osuperpowers-router/.cursor-plugin` |
| `packages/superpowers-overrides/.codex-plugin` | `packages/osuperpowers-router/.codex-plugin` |
| `packages/superpowers-overrides/hooks` | `packages/osuperpowers-router/hooks` |
| `packages/superpowers-overrides/bin` | `packages/osuperpowers-router/bin` |
| `packages/superpowers-overrides/build/generated` | `packages/osuperpowers-router/build/generated` |

### productFiles 数组（第 122-125 行）

- `packages/engineering/gemini-extension.json` → `packages/osuperpowers/gemini-extension.json`
- `packages/engineering/GEMINI.md` → `packages/osuperpowers/GEMINI.md`

### emitAll() 函数（第 424-426 行）

- `plugin.name === "superpowers-overrides"` → `plugin.name === "osuperpowers-router"`
- `plugin.name === "engineering"` → `plugin.name === "osuperpowers"`

### assertVersionBump() 函数（第 398 行）

- `"packages/engineering"` → `"packages/osuperpowers"`

### emitAgentsSkillsCopy() 函数（第 222 行）

- `join(root, "packages/engineering/skills")` → `join(root, "packages/osuperpowers/skills")`

## §5 scripts/ci-validate.mjs 更新

### 步骤 1-3（overrides 插件验证，第 78-130 行）
- `packages/superpowers-overrides` → `packages/osuperpowers-router`（共 6 处）

### 步骤 4（hooks 可执行验证，第 134-161 行）
- `packages/superpowers-overrides` → `packages/osuperpowers-router`（共 3 处）

### 步骤 5b（engineering 插件验证，第 168-236 行）
- `packages/engineering` → `packages/osuperpowers`（共 10 处）

### 步骤 5c（零残留 grep，第 239-259 行）
- `packages/engineering/bin` → `packages/osuperpowers/bin`
- `packages/engineering/skills` → `packages/osuperpowers/skills`
- `packages/superpowers-overrides/bin` → `packages/osuperpowers-router/bin`
- `packages/superpowers-overrides/hooks` → `packages/osuperpowers-router/hooks`
- `packages/superpowers-overrides/build/generated` → `packages/osuperpowers-router/build/generated`

## §6 测试文件 + 其他脚本

### scripts/lib/emit/emit.test.mjs

- 所有 `"superpowers-overrides"` 引用 → `"osuperpowers-router"`
- 所有 `"engineering"` 引用 → `"osuperpowers"`
- 排序断言中的 `"engineering"` → `"osuperpowers"`

### scripts/lib/first-party-publish.test.mjs

- `"engineering"` → `"osuperpowers"`
- `"superpowers-overrides"` → `"osuperpowers-router"`

### scripts/sync-overrides-versions.mjs

- `packages/superpowers-overrides/package.json` → `packages/osuperpowers-router/package.json`

## §7 验证方案

```bash
# 1. 目录改名（保留 git 历史）
git mv packages/engineering packages/osuperpowers
git mv packages/superpowers-overrides packages/osuperpowers-router

# 2. 更新 package.json 和所有脚本（手动编辑）

# 3. 重新生成所有 manifests
pnpm run emit

# 4. 验证 emit 产物无 drift
pnpm run emit:check

# 5. 完整验证
pnpm run validate
```

**验收标准**：
- ✅ `pnpm run emit:check` 无 drift
- ✅ `pnpm run validate` 全部通过（12 个验证块全绿）
- ✅ 新旧目录不在 git 中同时存在
- ✅ marketplace/source.json 的 plugin name 自动变为 `osuperpowers` 和 `osuperpowers-router`
- ✅ `.claude-plugin/marketplace.json` 中 source 路径指向新目录
- ✅ `.cursor-plugin/marketplace.json` 中 source 路径指向新目录

## §8 变更清单（完整文件列表）

### 目录改名
- `packages/engineering/` → `packages/osuperpowers/`
- `packages/superpowers-overrides/` → `packages/osuperpowers-router/`

### 需编辑的文件
1. `packages/osuperpowers/package.json` — name, repository.directory, description
2. `packages/osuperpowers-router/package.json` — name, repository.directory, description
3. `packages/osuperpowers-router/overrides.manifest.json` — source 路径（8 处）
4. `scripts/emit.mjs` — productRoots（13 处）、productFiles（2 处）、emitAll（2 处）、assertVersionBump（1 处）、emitAgentsSkillsCopy（1 处）
5. `scripts/ci-validate.mjs` — 步骤 1-3（6 处）、步骤 4（3 处）、步骤 5b（10 处）、步骤 5c（5 处）
6. `scripts/lib/emit/emit.test.mjs` — 包名引用（多处）
7. `scripts/lib/first-party-publish.test.mjs` — 包名断言（2 处）
8. `scripts/sync-overrides-versions.mjs` — 包路径（1 处）

### 自动重新生成的文件（无需手动编辑）
- `marketplace/source.json`
- `.claude-plugin/marketplace.json`
- `.cursor-plugin/marketplace.json`
- `packages/osuperpowers/.claude-plugin/plugin.json`
- `packages/osuperpowers/.cursor-plugin/plugin.json`
- `packages/osuperpowers/.codex-plugin/plugin.json`
- `packages/osuperpowers/.kimi-plugin/plugin.json`
- `packages/osuperpowers/.qoder-plugin/plugin.json`
- `packages/osuperpowers/gemini-extension.json`
- `packages/osuperpowers/GEMINI.md`
- `packages/osuperpowers/hooks/hooks.json`
- `packages/osuperpowers/hooks/hooks-cursor.json`
- `packages/osuperpowers/.agents/skills/engineering/*`
- `packages/osuperpowers-router/.claude-plugin/plugin.json`
- `packages/osuperpowers-router/.cursor-plugin/plugin.json`
- `packages/osuperpowers-router/.codex-plugin/plugin.json`
- `packages/osuperpowers-router/hooks/hooks.json`
- `packages/osuperpowers-router/hooks/hooks-cursor.json`
- `packages/osuperpowers-router/bin/prompt-expansion.mjs`
- `packages/osuperpowers-router/bin/pi-router.ts`
- `packages/osuperpowers-router/bin/cursor-detect.mjs`
- `packages/osuperpowers-router/bin/cursor-enforce.mjs`
- `packages/osuperpowers-router/build/generated/claude-self-check.md`
- `packages/osuperpowers-router/build/generated/cursor-self-check.mdc`