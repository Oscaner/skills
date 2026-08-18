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

P7c 是 P7 系列的第三个子阶段，处理版本管理脚本和发布流水线中的残留旧包名引用。P7a/P7b 完成了目录和命名空间改名，但 `version-packages.mjs` 和 `release.yml` 中仍引用旧包名，导致版本跳跃静默跳过 osuperpowers 插件、release tag 使用旧命名。

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

## §4 验证方案

```bash
# 1. 执行改动（§1-§3）

# 2. 验证无遗留旧引用
grep -rn '@oscaner-skills/engineering' scripts/ .github/ .changeset/
# 预期：exit 1（无匹配）

grep -rn 'superpowers-overrides@' .github/workflows/release.yml
# 预期：exit 1（无匹配）

# 3. 验证脚本可执行
node scripts/version-packages.mjs --dry-run 2>&1 || true
# 预期：无抛出，正常处理 changeset

# 4. 全量验证
pnpm run emit:check
pnpm run validate
```

**验收标准**：
- ✅ `version-packages.mjs` 中无 `@oscaner-skills/engineering` 引用
- ✅ `release.yml` 矩阵使用 `osuperpowers-router@` / `osuperpowers@` tag 前缀
- ✅ `.changeset/` 中无引用旧包名的 changeset 文件
- ✅ `pnpm run emit:check` 无 drift
- ✅ `pnpm run validate` 全部通过
