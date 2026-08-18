# P7c：版本管理 + 发布流水线适配

## Header

- **Version**: v1.0 · 2026-08-18
- **Status**: Approved
- **Phase**: P7c (of P7 series — brand unification)
- **Dependencies**: P7b（技能目录改名 + 命名空间 + 文档更新）完成后启动
- **Author**: Oscaner Miao · Claude Code (Opus 4.8)
- **Constraints**:
  - Conventional commits，无 attribution / co-author trailer
  - 禁用 git worktree
  - 过渡期 `pnpm run validate` 必须保持通过

## §0 Document scope

P7c 是 P7 系列的第三个子阶段，处理版本管理脚本、发布流水线、配置文件、issue templates、GitHub labels 和 changeset 文档中的残留旧包名引用。P7a/P7b 完成了目录和命名空间改名，但多个文件中仍引用旧包名，导致功能性 bug（opencode 插件解析失败、版本跳跃静默跳过）和用户可见的旧命名残留。

## §1 scripts/version-packages.mjs — 包名替换

### 问题

脚本中 3 处引用旧包名 `@oscaner-skills/engineering`，导致 changeset 版本跳跃时静默跳过 osuperpowers 插件（功能性 bug）。

### 改动

```diff
- const PLUGIN_NAME = '@oscaner-skills/engineering'
+ const PLUGIN_NAME = '@oscaner-skills/osuperpowers'
```

所有 `cs.releases.find(r => r.name === PLUGIN_NAME)` 调用自动跟随，无需逐行修改。

### 验证

```bash
grep -n '@oscaner-skills/engineering' scripts/version-packages.mjs
# 预期：无输出（0 处残留）
```

## §2 .github/workflows/release.yml — tag 前缀更新

### 问题

Release workflow 矩阵仍使用旧插件名和 tag 前缀，导致 git tag 和 GitHub Release 使用旧命名。

### 改动

```diff
  matrix:
    include:
-     - name: superpowers-overrides
-       tag_prefix: "superpowers-overrides@"
+     - name: osuperpowers-router
+       tag_prefix: "osuperpowers-router@"
-     - name: engineering
-       tag_prefix: "engineering@"
+     - name: osuperpowers
+       tag_prefix: "osuperpowers@"
```

### 验证

```bash
grep -n 'superpowers-overrides\|engineering@' .github/workflows/release.yml
# 预期：无输出
```

## §3 .changeset/ — 删除已消费的旧 changeset

### 问题

`.changeset/` 下存在引用 `@oscaner-skills/engineering` 的 changeset 文件（P7a/P7b 之前的遗留产物）。这些 changeset 的版本跳跃已发生或不再有效。

### 改动

删除所有引用旧包名的 changeset 文件：

```bash
ls .changeset/*.md | xargs grep -l '@oscaner-skills/engineering'
# 删除上述匹配到的文件
```

`CHANGELOG.md` 和 `.changeset/config.json` 不动。

## §4 opencode.json 配置 — 包名修复

### 问题

`packages/osuperpowers/bin/gate/configs/opencode.json` 中 `plugin` 数组引用旧包名 `@oscaner-skills/engineering`。opencode 安装时会按此名查找插件，当前会导致解析失败（功能性 bug）。

### 改动

```diff
- "plugin": ["@oscaner-skills/engineering"]
+ "plugin": ["@oscaner-skills/osuperpowers"]
```

### 验证

```bash
grep -n '@oscaner-skills/engineering' packages/osuperpowers/bin/gate/configs/opencode.json
# 预期：exit 1
```

## §5 Issue templates + install hint — 标签名更新

### 问题

两个 issue template 引用旧标签名 `superpowers-overrides`；`install-harness.mjs` 中 opencode hint 引用旧包名。

### 改动

**`.github/ISSUE_TEMPLATE/enhancement.yml` (line 9) 和 `bug_report.yml` (line 9)：**

```diff
- Additional labels (`dogfood`, `superpowers-overrides`, and `cdd` ...
+ Additional labels (`dogfood`, `osuperpowers-router`, and `cdd` ...
```

**`packages/osuperpowers/bin/os-init/install-harness.mjs` (line 100)：**

```diff
- hint: "opencode.json `plugin` 数组加 `@oscaner-skills/engineering`"
+ hint: "opencode.json `plugin` 数组加 `@oscaner-skills/osuperpowers`"
```

### 验证

```bash
grep -rn 'superpowers-overrides' .github/ISSUE_TEMPLATE/
# 预期：exit 1
grep -n '@oscaner-skills/engineering' packages/osuperpowers/bin/os-init/install-harness.mjs
# 预期：exit 1
```

## §6 GitHub labels — 旧标签迁移

### 问题

GitHub 上存在旧标签 `superpowers-overrides` 和 `engineering`，需要创建新标签 `osuperpowers-router` 和 `osuperpowers` 并删除旧标签。

### 改动

```bash
gh label create osuperpowers-router --color EDEDED --description "osuperpowers-router plugin (first-party)"
gh label create osuperpowers --color EDEDED --description "osuperpowers plugin (first-party)"
gh label delete superpowers-overrides --yes
gh label delete engineering --yes
```

如有 issue 使用旧标签，先批量迁移到新标签再删除。

### 验证

```bash
gh label list | grep -E 'superpowers-overrides|engineering|osuperpowers'
# 预期：只出现 osuperpowers 和 osuperpowers-router
```

## §7 .changeset/README.md — 文档更新

### 问题

README 中大量引用旧包名和路径。

### 改动

全局替换：
- `@oscaner-skills/superpowers-overrides` → `@oscaner-skills/osuperpowers-router`
- `@oscaner-skills/engineering` → `@oscaner-skills/osuperpowers`
- `packages/superpowers-overrides/` → `packages/osuperpowers-router/`
- `packages/engineering/` → `packages/osuperpowers/`
- `superpowers-overrides@{version}` → `osuperpowers-router@{version}`
- `engineering@{version}` → `osuperpowers@{version}`
- `engineering/skills/os-init/` → `packages/osuperpowers/skills/init/`

### 验证

```bash
grep -n 'superpowers-overrides\|@oscaner-skills/engineering' .changeset/README.md
# 预期：exit 1
```

## §8 验证方案

```bash
# 1. 执行改动（§1-§7）

# 2. 全仓库 grep（排除 vendors/ 和 node_modules/）
echo "=== superpowers-overrides ==="
grep -rn 'superpowers-overrides' --include='*.{md,yml,yaml,json,mjs,js,ts}' --exclude-dir=vendors --exclude-dir=node_modules . 2>/dev/null || echo "(clean)"

echo "=== @oscaner-skills/engineering ==="
grep -rn '@oscaner-skills/engineering' --include='*.{md,yml,yaml,json,mjs,js,ts}' --exclude-dir=vendors --exclude-dir=node_modules . 2>/dev/null || echo "(clean)"

echo "=== packages/engineering ==="
grep -rn 'packages/engineering' --include='*.{md,yml,yaml,json,mjs,js,ts}' --exclude-dir=vendors --exclude-dir=node_modules . 2>/dev/null || echo "(clean)"

echo "=== packages/superpowers-overrides ==="
grep -rn 'packages/superpowers-overrides' --include='*.{md,yml,yaml,json,mjs,js,ts}' --exclude-dir=vendors --exclude-dir=node_modules . 2>/dev/null || echo "(clean)"
# 预期：全部 (clean)，或仅匹配历史文档（docs/superpowers/specs/、docs/superpowers/plans/、docs/research/）
# 历史文档中的旧引用是预期保留的，不需要修复

# 3. 验证脚本可执行
node scripts/version-packages.mjs --dry-run 2>&1 || true
# 预期：无抛出

# 4. 全量验证
pnpm run emit:check
pnpm run validate

# 5. GitHub labels
gh label list | grep -E 'superpowers-overrides|^engineering '
# 预期：exit 1（旧标签已删除）
```

**验收标准**：
- ✅ `version-packages.mjs` 中无 `@oscaner-skills/engineering` 引用
- ✅ `release.yml` 矩阵使用 `osuperpowers-router@` / `osuperpowers@` tag 前缀
- ✅ `opencode.json` 使用 `@oscaner-skills/osuperpowers`
- ✅ issue templates 使用 `osuperpowers-router` 标签名
- ✅ `install-harness.mjs` opencode hint 使用新包名
- ✅ GitHub 上无 `superpowers-overrides` / `engineering` 旧标签
- ✅ `.changeset/README.md` 使用新包名和路径
- ✅ `.changeset/` 中无引用旧包名的 changeset 文件
- ✅ `pnpm run emit:check` 无 drift
- ✅ `pnpm run validate` 全部通过
