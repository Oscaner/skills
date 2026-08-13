# os-engineering P4a 阶段设计：发布架构 v2（包即源）

## Header

- **Version**: v1.0 · 2026-08-10
- **Status**: Draft
- **Author**: Oscaner Miao · Claude Code (Opus 4.8)
- **Parent program**: [os-engineering 整体设计 v2.3](2026-08-10-os-engineering-overall.md)
- **Depends on**: P1-P3（engineering 插件 + cli-\* + os-\* 家族 + 统一 emit 已就位）

## §0 Incremental warning

> P4a 增量只涉及本阶段。跨阶段约定以 overall v2.3 为准；冲突时 overall 优先。

## §1 Constraints pointer

不重复 overall 约定。P4a 生效的约束：

- **包即源**：`package.json` 的 `oscaner-plugin` 字段是唯一元数据源（vendors 例外：装配模板提供元数据）；source.json 派生
- 目录：`packages/`（first-party，维护）+ `vendors/`（上游 submodule 源，**不编辑不维护**）
- 统一发布：pnpm workspace + changesets 覆盖所有 `@oscaner-skills/*` 包（vendors 构建期装配 republish，保留上游授权）
- 未来插件 = 加一个包目录自动接入 emit + 发布
- `pnpm run validate` 每任务后 ALL PASS；零 sdd/spor 残留（既有 5c）

## §2 Design body

### 架构

插件从 `plugins/` 平铺迁至 `packages/`（first-party）+ `vendors/`（上游 submodule）。package.json 成为每包唯一元数据源（`oscaner-plugin` 字段），source.json 由 emit 派生，marketplace + harness manifests 从 packages 生成。pnpm workspace + changesets 统一版本/发布全部 `@oscaner-skills/*`。

```
packages/                    vendors/
  engineering/                 mattpocock-skills/   ← 上游 submodule
  superpowers-overrides/       impeccable/          ← 上游 submodule
                               superpowers/         ← 上游 submodule

package.json (oscaner-plugin) → pnpm run emit → source.json(派生) + marketplace + harness manifests
                              → pnpm changeset → 版本 → npm publish（vendors 装配 republish）
```

### 组件

#### A. 目录迁移

`plugins/engineering` + `plugins/superpowers-overrides` → `packages/`；`plugins/{mattpocock-skills,impeccable,superpowers}` → `vendors/`（git mv + `.gitmodules` path 更新）。同步更新：

- `marketplace/source.json` contentRoot
- `scripts/emit.mjs` + `scripts/lib/emit/*`（productRoots/paths；**FIRST_PARTY_NAMES 改为派生** —— 从 `packages/*` 含 `oscaner-plugin` 字段的目录推导，不再手维护枚举）
- `scripts/lib/marketplace-utils.mjs`（truthPaths）
- `scripts/lib/submodule-tags.mjs`（SUBMODULE_PATHS）
- `pnpm-workspace.yaml`（packages/ + vendors/）
- 全引用（docs/README/CI）

#### B. 包即源（oscaner-plugin 字段）

每个 package.json 加 `oscaner-plugin` 字段（插件元数据）：

```json
{
  "name": "@oscaner-skills/engineering",
  "version": "0.1.0",
  "description": "...",
  "license": "MIT",
  "oscaner-plugin": {
    "claude": { "category": "engineering", "keywords": ["engineering", "cli", "cdd"] },
    "contentRoot": ".",
    "harnesses": ["cursor", "codex", "kimi", "gemini", "pi"],
    "hooks": {
      "claude": "./hooks/hooks.json",
      "cursor": "./hooks/hooks-cursor.json"
    }
  }
}
```

> `contentRoot` 默认 `.`（包根）；`harnesses` 为薄 manifest harness 名列表（均指向 canonical `./skills/`，单一路径常量，无 per-harness 重复声明）。`oscaner-plugin.harnesses.pi` 是 pi 元数据唯一源（emit 不再维护顶层 `package.json#pi` key）。

> **hooks 每 harness 映射 + 注册**：`oscaner-plugin.hooks` = 每 harness hook 文件映射（claude → `hooks/hooks.json`，cursor → `hooks/hooks-cursor.json`）；emit 生成各 harness hooks 并在 marketplace/plugin manifest（`plugin.json` 的 `hooks` 字段）注册。npm 包携带 hooks 文件，但仅在 claude/cursor marketplace 安装时激活（pi/opencode 无 hooks 机制，用 extensions）。

**hooks 支持矩阵（研究结论，详见 `docs/research/2026-08-10-harness-hooks-matrix.md`）**：

| 注册通道 | harness | hooks 注册 |
|---|---|---|
| **package/marketplace（P4a）** | claude | `.claude-plugin` `hooks/hooks.json`（UserPromptExpansion 路由器 + PreToolUse gate，已就位） |
| | cursor | 插件 `hooks.json`（`beforeSubmitPrompt` detect + `preToolUse` enforce；**只能 gate 不能 expand**） |
| | grok | **直接读 claude marketplace/插件**（root marketplace 即 P4a 通道） |
| | trae | 「Import hooks from Claude Code」toggle（读 `.claude/settings.json`，I/O schema 需兼容） |
| | codex | `.codex-plugin` `hooks/hooks.json`（PreToolUse gate + UserPromptSubmit；per-hook trust） |
| | qoder | 插件 hooks（PreToolUse，无 trust 流程） |
| | copilot | VS Code extension hooks（**matcher 忽略** → 每工具都触发，延后） |
| **npm 包（P4a）** | opencode / pi | **无 hooks.json** —— 仅 TS 扩展（`tool.execute.before` / `on('input')`），非 shell 可发 |
| **P4b 原生配置** | grok/qoder/trae/codex/gemini/vibe/kiro | 各需原生 hooks 配置 + 信任仪式（见 §4 排序） |
| **无事件** | rovo | `/hooks` 命令但无事件文档 |

**vendors 元数据源**：vendors（superpowers/mattpocock-skills/impeccable）无 in-repo package.json —— 它们的 name/version/contentRoot 由**装配侧模板**提供（`scripts/publish-vendor.mjs` 内置每个 vendor 的 scoped 包模板：`@oscaner-skills/<name>` + version=submodule-tags + contentRoot `.` + 上游 LICENSE + pi key）；emit/changesets 通过 `submodule-tags.mjs` 的 version 或装配模板声明引用 vendor 版本。**source.json 派生**对 vendors 用装配模板字段，对 first-party 用 `oscaner-plugin` 字段。

**contentRoot 语义**：统一**包相对**（默认 `.`）；marketplace `source` = `<package-dir>/<contentRoot>`（如 `./packages/engineering` / `./vendors/superpowers`）；发布产物的 package.json 载 `contentRoot: "."`（tarball 内）。

**marketplace source 形态**：in-repo marketplace 保持 repo 相对路径 source（`./packages/<name>` / `./vendors/<name>`）；npm 发布的包服务外部消费者。**本仓库无 URL source 字段**。

- `source.json` 降为派生：emit 从各包 package.json 生成 marketplace 聚合。**派生字段集**：name/version/description/contentRoot/category/keywords + author/homepage/repository/license（均取包内字段）+ cursor wrapper（非 plugin-root 插件的 displayName + skills 路径，取 `oscaner-plugin.harnesses` 或装配模板）
- marketplace + harness manifests 从 packages 生成

#### C. 统一发布（pnpm workspace + changesets）

- `pnpm-workspace.yaml` 覆盖 `packages/*` + `vendors/*`（vendors 作为 workspace 成员仅用于本地解析/emit，**不直接 changeset 版本化**）
- **changesets 仅版本化/发布 first-party**（engineering / superpowers-overrides）；**vendor 包**版本取自 `submodule-tags.mjs`（上游 tag）经 `publish-vendor.mjs` 装配 republish（不进 changesets）
- `version-packages.mjs` 扩展处理 first-party + vendors 装配发布
- 未来插件 = 加包目录（含 `oscaner-plugin` 字段）→ 自动接入 emit + 发布

#### D. vendors 装配 republish

`scripts/publish-vendor.mjs`（构建期装配，不碰上游）：

```js
// 对每个 vendor（mattpocock-skills / impeccable / superpowers）:
// 1. 读 vendors/<name>/ 内容（git submodule 源）
// 2. 暂存目录复制 + 写 scoped package.json（name=@oscaner-skills/<name> + version=submodule-tags + contentRoot=vendors/<name> + 保留上游 LICENSE + pi key）
// 3. npm publish（dry-run 可测）
```

- 不入库、不改上游；发布产物 = 装配的 scoped 包
- 保留上游 LICENSE + 归属声明

#### E. submodule bump 链迁移

- `.gitmodules` + `submodule-tags.mjs` 的 `SUBMODULE_PATHS` → `vendors/<name>`
- `scripts/bump-submodule.mjs`：路径更新（`vendors/superpowers/.claude-plugin/plugin.json`、`packages/superpowers-overrides/package.json` + CHANGELOG）
- `.github/workflows/submodule-sync.yml` + `bump-submodule-reusable.yml`：matrix 保持 3 个 submodule，验证路径经脚本解析
- superpowers bump 时同步 `packages/superpowers-overrides/package.json`（对齐 superpowers 版本）

### 数据流

```
package.json (oscaner-plugin) → pnpm run emit → source.json(派生) + marketplace + harness manifests
                              → pnpm changeset → 版本 → npm publish（first-party 直发；vendors 装配 republish）
```

### 错误处理

| 场景 | 行为 |
|------|------|
| vendor submodule 未 checkout | publish-vendor 报错 + 提示 `git submodule update` |
| vendor LICENSE 缺失/不可读 | publish-vendor **中止并报错**（不发布无授权包） |
| package.json 缺 `oscaner-plugin` 字段 | emit 报错 + 列出缺失包 |
| changeset 覆盖非 @oscaner-skills/* 包 | 发布脚本跳过 + 提示 |

### 测试

- 目录迁移后 emit freshness（packages 路径）
- `oscaner-plugin` 字段 schema 校验
- source.json 派生与 packages 一致（对比测试）
- changesets/workspace 解析（first-party）；vendors 装配（submodule-tags 版本 + LICENSE）dry-run
- publish-vendor.mjs dry-run（装配产物 + LICENSE 保留）
- bump-submodule 路径（vendors/）dry-run
- `pnpm run validate` ALL PASS

### 验收标准

- [ ] `packages/engineering` + `packages/superpowers-overrides` + `vendors/{mattpocock-skills,impeccable,superpowers}` 就位（.gitmodules 更新）
- [ ] 每包 package.json 带 `oscaner-plugin` 字段；emit 从 packages 生成 marketplace + manifests
- [ ] `source.json` 派生（无手写插件条目）
- [ ] pnpm workspace + changesets 版本化/发布 first-party（engineering / superpowers-overrides）；vendors 装配 republish（submodule-tags 版本 + LICENSE 保留）dry-run 通过
- [ ] `scripts/publish-vendor.mjs` 装配 republish（保留 LICENSE）dry-run 通过
- [ ] submodule bump 链（.gitmodules/SUBMODULE_PATHS/bump-submodule.mjs/workflows）指向 vendors/
- [ ] 未来插件 = 加包目录即接入（文档化约定）
- [ ] `pnpm run validate` ALL PASS；零 sdd/spor 残留

## §3 Deviations from overall

| Overall 假设 | 阶段决定 | Overall 已更新? |
|---|---|---|
| P4 单一阶段 | P4 拆 P4a（发布 v2）+ P4b（gate adapters） | 是（v2.3 P4a/P4b 行） |
| submodule 迁 `plugins/_vendor/` | 迁 `vendors/`（命名统一）+ bump 链迁移纳入 | 是（v2.3 约束/P4a 行） |

## §4 Notes for downstream（P4b）

- **P4b 跨 harness gate adapters（按接近 claude 排序）**：Grok（PreToolUse + `/hooks-trust`）> Qoder（Claude-identical，无 trust）> **Trae**（新，Cursor 格式 + Claude-import toggle，I/O schema 需兼容）> Codex（per-hook trust）> Gemini（BeforeTool + 指纹）> Vibe（pre_tool TOML）> Kiro（PreToolUse JSON）> Copilot（matcher 忽略，延后）；Pi/OpenCode 仅 TS 扩展（非 shell gate）；Rovo 无事件文档
- **prompt-expansion 路由器**：仅 Claude 有真 `UserPromptExpansion`；Cursor `beforeSubmitPrompt` 可阻断不可 expand；其余 harness 靠 per-harness self-check/触发表（P3 已发射）为主要执行
- **重运行时产物**：opencode runtime 插件 / pi TS 扩展（P4a 纯 markdown 不需要）
- **研究参考**：`docs/research/2026-08-10-harness-hooks-matrix.md`（hooks 全矩阵 + verified-against + P4a/P4b 含义）

## §5 Review

Rule 1 passes（Completeness → Consistency & scope → Clarity & YAGNI）before user review and writing-plans。
