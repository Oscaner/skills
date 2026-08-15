# os-engineering P4a 实施计划：发布架构 v2（包即源）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 迁移到发布架构 v2 —— 目录重组 `packages/`（first-party）+ `vendors/`（上游 submodule 源），package.json 的 `oscaner-plugin` 字段成为唯一元数据源，统一 pnpm workspace + changesets 发布所有 `@oscaner-skills/*` 包（vendors 构建期装配 republish），source.json 派生，marketplace 从 packages 生成。

**Architecture:** 插件从 `plugins/` 平铺迁至 `packages/`（engineering/superpowers-overrides）+ `vendors/`（mattpocock-skills/impeccable/superpowers 上游 submodule，不编辑）。每包 package.json 加 `oscaner-plugin` 字段（claude.category/contentRoot/harnesses/hooks 每 harness 映射）；emit 从 packages 生成 source.json（派生）+ marketplace + harness manifests；pnpm workspace + changesets 统一版本/发布 first-party，vendors 经 `publish-vendor.mjs` 装配 republish（保留上游 LICENSE）。

**Tech Stack:** Node.js、Bash、JSON、pnpm workspace、changesets；验证命令 `pnpm run validate`

## Global Constraints

- 包即源：`package.json` 的 `oscaner-plugin` 字段是唯一元数据源（vendors 例外：装配模板）
- 目录：`packages/`（first-party 维护）+ `vendors/`（上游 submodule 源，不编辑不维护）
- changesets 仅版本化/发布 first-party；vendors 版本取自 submodule-tags + publish-vendor 装配
- hooks 每 harness 映射（claude/cursor）+ marketplace/plugin manifest 注册；npm 包携带但仅 claude/cursor marketplace 安装时激活
- 保留上游 LICENSE + 归属；零 sdd/spor 残留（5c）
- `pnpm run validate` 每任务后 ALL PASS；提交信息 conventional commits，无 attribution

---

## File Map

| 文件 | 操作 | Task |
|------|------|------|
| `plugins/engineering` → `packages/engineering` | Move（git mv） | T1 |
| `plugins/superpowers-overrides` → `packages/superpowers-overrides` | Move | T1 |
| `plugins/mattpocock-skills` → `vendors/mattpocock-skills` | Move（submodule path） | T1 |
| `plugins/impeccable` → `vendors/impeccable` | Move | T1 |
| `plugins/superpowers` → `vendors/superpowers` | Move | T1 |
| `.gitmodules` | Modify（paths → vendors/） | T1 |
| `marketplace/source.json` | Modify（contentRoot → packages//vendors/） | T1 |
| `scripts/emit.mjs` + `scripts/lib/emit/*` | Modify（paths + FIRST_PARTY_NAMES 派生 + source.json 派生） | T1/T2 |
| `scripts/ci-validate.sh` + `scripts/validate-version-sync.mjs` | Modify（plugins/ → packages//vendors/） | T1 |
| `scripts/sync-overrides-versions.mjs` | Modify（paths → packages/） | T6 |
| `scripts/lib/marketplace-utils.mjs` | Modify（truthPaths → packages//vendors/） | T1 |
| `scripts/lib/submodule-tags.mjs` | Modify（SUBMODULE_PATHS → vendors/） | T1 |
| `pnpm-workspace.yaml` | Modify（packages/* + vendors/*） | T1/T4 |
| `packages/*/package.json` | Modify（`oscaner-plugin` 字段） | T2 |
| `scripts/lib/emit/*`（hooks 生成） | Modify（每 harness hooks 映射 + manifest 注册） | T3 |
| `scripts/version-packages.mjs` + `scripts/lib/version-utils.mjs` | Modify（first-party + vendors 装配） | T4 |
| `scripts/publish-vendor.mjs` | Create（vendors 装配 republish） | T5 |
| `scripts/bump-submodule.mjs` | Modify（paths → vendors/ + packages/） | T6 |
| `.github/workflows/submodule-sync.yml` + `bump-submodule-reusable.yml` | Verify/Modify | T6 |
| `.changeset/*` + `README.md` | Modify（包名） | T4 |
| `README.md` / `README.zh-CN.md` / `cross-harness-overrides.md` / CLAUDE.md | Modify（目录/包名/hooks 矩阵） | T7 |

---

### Task 1: 目录迁移（packages/ + vendors/）

**Files:**
- Move: `plugins/engineering` → `packages/engineering`；`plugins/superpowers-overrides` → `packages/superpowers-overrides`
- Move: `plugins/mattpocock-skills` → `vendors/mattpocock-skills`；`plugins/impeccable` → `vendors/impeccable`；`plugins/superpowers` → `vendors/superpowers`
- Modify: `.gitmodules`、`marketplace/source.json`、`scripts/emit.mjs` + `scripts/lib/emit/*`、`scripts/lib/marketplace-utils.mjs`、`pnpm-workspace.yaml`

**Interfaces:**
- Consumes: 无
- Produces: packages//vendors/ 结构就位，emit/marketplace 路径解析正确

- [ ] **Step 1: git mv first-party 到 packages/**

```bash
mkdir -p packages
git mv plugins/engineering packages/engineering
git mv plugins/superpowers-overrides packages/superpowers-overrides
```

- [ ] **Step 2: git mv submodules 到 vendors/ + .gitmodules 更新**

```bash
mkdir -p vendors
git mv plugins/mattpocock-skills vendors/mattpocock-skills
git mv plugins/impeccable vendors/impeccable
git mv plugins/superpowers vendors/superpowers
# .gitmodules path 更新为 vendors/<name>
```

- [ ] **Step 3: source.json contentRoot 更新**

`marketplace/source.json`：engineering → `packages/engineering`；superpowers-overrides → `packages/superpowers-overrides`；mattpocock-skills → `vendors/mattpocock-skills`；impeccable → `vendors/impeccable/plugin`；superpowers → `vendors/superpowers`。**cursor.skills 字段同步**（mattpocock-skills/impeccable 的 `cursor.skills` → `../../vendors/...`，否则 assertCursorPathsExist 抛错）。

- [ ] **Step 4: emit + marketplace-utils + submodule-tags + ci-validate + validate-version-sync paths**

`scripts/emit.mjs` + `scripts/lib/emit/*` + `scripts/lib/marketplace-utils.mjs`（truthPaths）+ `scripts/lib/submodule-tags.mjs`（SUBMODULE_PATHS）+ **`scripts/ci-validate.sh` + `scripts/validate-version-sync.mjs`** + **`scripts/lib/emit/emit.test.mjs`（MANIFEST_PATH + build/templates 引用）** 中的 `plugins/<name>` 改为 `packages/<name>` / `vendors/<name>`（validate 依赖这些脚本/测试，遗漏则 validate 必挂）。

- [ ] **Step 5: pnpm-workspace.yaml + pnpm install**

```yaml
packages:
  - packages/*
  - vendors/*
```

改后跑 **`pnpm install`** 并提交 pnpm-lock.yaml（vendors/* 入 workspace 会拉入 impeccable 依赖；frozen-lockfile CI 需要 lockfile 新鲜）。

- [ ] **Step 6: emit + validate**

```bash
pnpm run emit
pnpm run validate
```

预期：marketplace 解析新路径，validate ALL PASS。

- [ ] **Step 7: 提交**

```bash
git add -A
git commit -m "refactor: migrate plugins to packages/ + vendors/ layout"
```

---

### Task 2: 包即源（oscaner-plugin 字段 + source.json 派生）

**Files:**
- Modify: `packages/engineering/package.json` + `packages/superpowers-overrides/package.json`（`oscaner-plugin` 字段）
- Modify: `scripts/emit.mjs` + `scripts/lib/emit/*`（FIRST_PARTY_NAMES 派生 + source.json 派生）

**Interfaces:**
- Consumes: T1（packages/ 就位）
- Produces: package.json 唯一元数据源；source.json 派生；emit 从 packages 生成 marketplace

- [ ] **Step 1: packages/*/package.json 加 `oscaner-plugin` 字段**

```json
// packages/engineering/package.json
{
  "name": "@oscaner-skills/engineering",
  "version": "0.1.0",
  "oscaner-plugin": {
    "claude": { "category": "engineering", "keywords": ["engineering", "cli", "cdd"] },
    "contentRoot": ".",
    "harnesses": ["cursor", "codex", "kimi", "gemini", "pi"],
    "hooks": { "claude": "./hooks/hooks.json", "cursor": "./hooks/hooks-cursor.json" },
    "pi": { "skills": ["./skills"] }
  }
}
```

> `harnesses` = **非 claude 薄 manifest 目标**（claude 是独立主 manifest，另经 `hooks.claude` 挂载）；`pi` 是 pi 元数据唯一源（`oscaner-plugin.pi`，emit 不再读顶层 `package.json#pi`；T5 装配的 vendor package.json 同样在装配模板内置 `pi` key）。

**package.json 补全元数据**：engineering/overrides 的 package.json 需带 description/author/license/homepage/repository（派生 source.json 时取包内字段，缺失则这些字段在派生后消失）。**vendor 装配模板（T5）先定义**（cursor wrapper displayName/skills + name/version/contentRoot/LICENSE/pi），使 T2 的 source.json 派生对 vendors 不阻塞于后置 T5。

- [ ] **Step 2: FIRST_PARTY_NAMES 派生**

`scripts/lib/emit/manifests.mjs`：`FIRST_PARTY_NAMES` 从 `packages/*` 含 `oscaner-plugin` 字段的目录推导（不再手维护枚举）。

- [ ] **Step 3: source.json 派生（emit 枚举 packages，不再读 source.json）**

`scripts/emit.mjs`：**枚举从 `packages/*`（含 oscaner-plugin）+ SUBMODULE_PATHS（vendors）推导**，不再 `readSource()`；生成 source.json（marketplace 聚合）—— name/version/description/contentRoot/category/keywords + author/homepage/repository/license + cursor wrapper；**顶层 source.json 字段（$schema/metadata/owner）由 emit 常量提供**。`emit.mjs` 的 `ensurePiKey` 改为读 `oscaner-plugin.pi`（不再维护顶层 `package.json#pi`）。`source.json` 不再手写插件条目（降为派生产物）。

- [ ] **Step 4: emit.test.mjs 更新（FIRST_PARTY_NAMES 派生后）**

`emit.test.mjs` 的 FIRST_PARTY_NAMES deepEqual 断言随派生更新（MANIFEST_PATH 等纯路径重命名已在 T1 处理）。

- [ ] **Step 5: 校验**

```bash
node scripts/emit.mjs --check   # source.json 派生与 packages 一致
pnpm run validate
```

- [ ] **Step 6: 提交**

```bash
git add -A packages scripts
git commit -m "feat: package-as-source — oscaner-plugin metadata + derived source.json"
```

---

### Task 3: hooks 每 harness 映射 + 注册

**Files:**
- Modify: `scripts/lib/emit/*`（hooks 生成 + manifest 注册）
- Modify（生成产物）: `packages/engineering/hooks/*`、`packages/superpowers-overrides/hooks/*`、`.claude-plugin/plugin.json` 等

**Interfaces:**
- Consumes: T2（oscaner-plugin 字段含 hooks 映射）
- Produces: 每 harness hooks 生成 + marketplace/plugin manifest 注册

- [ ] **Step 1: emit 按 `oscaner-plugin.hooks` 映射生成 hooks**

emit 读 `oscaner-plugin.hooks`（claude → `hooks/hooks.json`，cursor → `hooks/hooks-cursor.json`），生成每 harness hooks 内容（router UserPromptExpansion / gate PreToolUse）并写入 package 对应文件。

- [ ] **Step 2: manifest 注册**

marketplace/plugin manifest（`.claude-plugin/plugin.json`、cursor manifest）的 `hooks` 字段指向生成文件 → 各 harness 安装时加载。

- [ ] **Step 3: 校验 + 提交**

```bash
pnpm run emit --check && pnpm run validate
git add -A
git commit -m "feat: per-harness hooks registration via oscaner-plugin.hooks"
```

---

### Task 4: 统一发布（pnpm workspace + changesets，first-party）

**Files:**
- Modify: `scripts/version-packages.mjs` + `scripts/lib/version-utils.mjs`（first-party + vendors 装配发布）
- Modify: `.changeset/*` + `README.md`（包名）

**Interfaces:**
- Consumes: T1（workspace）+ T2（oscaner-plugin）
- Produces: changesets 版本化/发布 first-party（engineering / superpowers-overrides）

- [ ] **Step 1: version-packages.mjs 扩展 + private 开启发布（first-party）**

`version-packages.mjs` 处理 first-party（engineering 独立 semver + superpowers-overrides 相对 scheme）；**`packages/*/package.json` 的 `private` 改为 `false`**（否则 npm publish / changesets 发布被阻）。**vendors 装配发布由 T5（publish-vendor.mjs）独立接入** —— 本任务只做 first-party changesets 接线，不依赖 T5。

- [ ] **Step 2: changesets 覆盖 first-party + release 链**

`.changeset/*` 键名用新包名（`@oscaner-skills/engineering` / `@oscaner-skills/superpowers-overrides`）；workspace 解析 first-party。**`.changeset/config.json` 的 `access` 改 `public`**（scoped 包需 public）；**release.yml 的 publish 步骤**加 `pnpm exec changeset publish`（当前只有 `changeset tag` 无 npm publish）；**sync-overrides-versions.mjs 路径更新依赖 T6**（T4 的 publish 流调用它，路径须已迁移）。

- [ ] **Step 3: 提交**

```bash
git add -A scripts .changeset
git commit -m "feat: unified changesets publish for first-party packages"
```

---

### Task 5: vendors 装配 republish（publish-vendor.mjs）

**Files:**
- Create: `scripts/publish-vendor.mjs`

**Interfaces:**
- Consumes: T1（vendors/ submodule 就位）
- Produces: 构建期装配 `@oscaner-skills/{superpowers,mattpocock-skills,impeccable}` 包（保留 LICENSE）

- [ ] **Step 1: 创建 publish-vendor.mjs**

```js
// 对每个 vendor（mattpocock-skills / impeccable / superpowers）:
// 1. 读 vendors/<name>/ 内容（git submodule 源，不编辑）
// 2. 暂存目录复制 + 写 scoped package.json（name=@oscaner-skills/<name> + version=<per-vendor: superpowers/mattpocock→submodule-tags；impeccable→plugin.json truth（ext-v1.3.1 非 v tag，submodule-tags 返回 null）> + contentRoot=<per-vendor: impeccable→plugin/, 其余→.> + 保留上游 LICENSE + pi key）
// 3. npm publish（--dry-run 可测）
// 错误: submodule 未 checkout → 提示 git submodule update；LICENSE 缺失 → 中止
```

- [ ] **Step 2: 装配 dry-run**

```bash
node scripts/publish-vendor.mjs --dry-run
```

预期：装配产物含 scoped package.json + LICENSE + pi key；dry-run 通过。

- [ ] **Step 3: 提交**

```bash
git add scripts/publish-vendor.mjs
git commit -m "feat: vendors assembly republish via publish-vendor.mjs"
```

---

### Task 6: submodule bump 链迁移

**Files:**
- Modify: `scripts/bump-submodule.mjs`（paths → vendors/ + packages/）
- Verify: `.github/workflows/submodule-sync.yml` + `bump-submodule-reusable.yml`

**Interfaces:**
- Consumes: T1（vendors/ 就位）
- Produces: bump 链指向 vendors/，superpowers bump 同步 packages/superpowers-overrides

- [ ] **Step 1: bump-submodule.mjs + sync-overrides-versions.mjs 路径更新**

（SUBMODULE_PATHS → `vendors/<name>` 已在 T1 处理。）`bump-submodule.mjs` + **`sync-overrides-versions.mjs`** 的 `vendors/superpowers/.claude-plugin/plugin.json`、`packages/superpowers-overrides/package.json` + CHANGELOG 路径更新。

- [ ] **Step 2: workflows 验证**

`submodule-sync.yml` + `bump-submodule-reusable.yml`：matrix 保持 3 submodule，路径经脚本解析（验证）。

- [ ] **Step 3: bump dry-run + 提交**

```bash
node scripts/bump-submodule.mjs superpowers --dry-run
git add -A scripts .github
git commit -m "refactor: bump-submodule chain to vendors/ paths"
```

---

### Task 7: 文档 + 终检

**Files:**
- Modify: `README.md` / `README.zh-CN.md` / `cross-harness-overrides.md` / CLAUDE.md（目录/包名/hooks 矩阵）

**Interfaces:**
- Consumes: T1-T6
- Produces: 文档一致 + validate ALL PASS

- [ ] **Step 1: README / cross-harness 更新**

README 插件表（packages/ + vendors/ + 包名）、hooks 矩阵、安装说明（npm / marketplace）。**未来插件接入约定**：加一个 `packages/<name>/` 目录（含 `oscaner-plugin` 字段）→ 自动接入 emit（FIRST_PARTY_NAMES 派生）+ workspace + changesets 发布（文档化）。

- [ ] **Step 2: 终检**

```bash
# 零残留（sdd/spor/旧 plugins/ 路径）—— 命中则 FAIL
if grep -rnE '\b(sdd_|spor-|plugins/os-engineering|plugins/superpowers-overrides|plugins/mattpocock|plugins/impeccable|plugins/superpowers\b)' scripts packages vendors marketplace .github 2>/dev/null; then
  echo "RESIDUE FOUND"; exit 1
else
  echo "OK — 无残留"
fi
pnpm run emit && pnpm run validate
```

预期：ALL PASS，emit fresh，零残留。

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "docs: publish-arch-v2 — packages/vendors layout + package-as-source + hooks matrix"
```


---


---


---
