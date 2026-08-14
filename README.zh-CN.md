# oscaner

[English](README.md) | [简体中文](README.zh-CN.md)

[![CI](https://github.com/Oscaner/skills/actions/workflows/ci.yml/badge.svg)](https://github.com/Oscaner/skills/actions/workflows/ci.yml)

*用 superpowers-overrides + engineering 把 superpowers 的全流程和 mattpocock 的精专缝成一条工程化流水线。*

个人 [Claude Code](https://claude.com/claude-code) 插件市场。四个插件组成一条流水线：构思 → 计划 → 开发 → 交付。

## 为什么有这个市场

**[Superpowers](https://github.com/obra/superpowers)** 大而全——从 brainstorming、写计划、子 agent 驱动开发，到验证、收尾分支，一套走完。

**[mattpocock-skills](vendors/mattpocock-skills/)** 小而精——`grilling` 挖清需求，`tdd` 管实现，`to-tickets` 切任务。每个 skill 只做一件事，但做得很准。

单独用哪一个，都缺一块：什么时候 delegate、spec 怎么审、大功能怎么分期。**superpowers-overrides** 是**触发路由器**——它不带任何技能体。它拦截上游 superpowers 触发（slash 命令、SKILL attach），路由到匹配的 **engineering** 编排器（`os-*`）或 **mattpocock-skills** 委托（`tdd`、`grilling`）。`os-*` 编排器在上游基线上叠加个人规则——grilling 澄清、fresh-subagent spec review、大 scope 走 **overall + phase** 分解。

**[engineering](packages/engineering/)** 是**技能 + 引擎 + gate** 层——`os-*` 编排器（`os-brainstorming`、`os-writing-plans`、`os-executing-plans` …）与 `cli-*` 家族（`cli-select`、`cli-task`、`cli-driven-development`、`cli-code-review`）跑在 cdd 引擎上，带 per-harness registry 探测，外加跨 harness 的 CDD orchestrator gate。

## 插件列表

市场注册了五个插件。其中两个是 **first-party**（在 `packages/` 下于树内维护）；三个是 **vendored** 上游 submodule（不在树内编辑，在 `vendors/` 下锁定版本）：

| 插件 | 目录 | npm 包 | 类型 |
|--------|-----------|-------------|------|
| **superpowers-overrides** | [packages/superpowers-overrides/](packages/superpowers-overrides/) | `@oscaner-skills/superpowers-overrides` | first-party — 触发路由器 |
| **engineering** | [packages/engineering/](packages/engineering/) | `@oscaner-skills/engineering` | first-party — 技能 + cdd 引擎 + gate |
| **superpowers** | [vendors/superpowers/](vendors/superpowers/) | `@oscaner-skills/superpowers` | vendored 上游 submodule |
| **mattpocock-skills** | [vendors/mattpocock-skills/](vendors/mattpocock-skills/) | `@oscaner-skills/mattpocock-skills` | vendored 上游 submodule |
| **impeccable** | [vendors/impeccable/](vendors/impeccable/) | `@oscaner-skills/impeccable` | vendored 上游 submodule |

first-party 的元数据在各自 `package.json` 的 `oscaner-plugin` 字段里（**包即源**）：`pnpm run emit` 从 `packages/` + `vendors/` 派生 `marketplace/source.json` 并重新生成所有 per-harness manifest。vendored 插件由 [`scripts/lib/emit/source.mjs`](scripts/lib/emit/source.mjs) 里的装配模板描述。新增一个 first-party 插件是全自动的——见 [新增 first-party 插件](#新增-first-party-插件)。

### hooks 矩阵

hooks 随插件一起发布，只在插件通过 Claude Code / Cursor marketplace 安装时激活。harness → 路径映射声明在 `oscaner-plugin.hooks`；`pnpm run emit` 把每个 hooks 文件写到声明的路径。

| 插件 | harness | hooks 文件 | 处理器 |
|--------|---------|------------|----------|
| superpowers-overrides | Claude Code | `hooks/hooks.json` | `UserPromptExpansion`（3 个 matcher）→ `bin/override-prompt-expansion.sh` |
| superpowers-overrides | Cursor | `hooks/hooks-cursor.json` | `beforeSubmitPrompt` → `bin/override-cursor-detect.sh`；`preToolUse` → `bin/override-cursor-enforce.sh` |
| engineering | Claude Code | `hooks/hooks.json` | `PreToolUse`（`Write`/`Edit`、`Bash`）→ `bin/override-claude-cdd-gate.sh` |
| engineering | Cursor | `hooks/hooks-cursor.json` | `preToolUse` → `bin/override-cursor-cdd-gate.sh` |

完整 enforcement 模型（detect/enforce、pending 状态、fail-open、shell 白名单）→ [cross-harness-overrides.md](packages/superpowers-overrides/docs/cross-harness-overrides.md)。

## 流水线

```
Overall spec → Phase spec → Plan → SDD/TDD → Verify → Ship
```

overrides 在设计阶段加入 grilling 和 subagent review；grilling、tdd、to-tickets 通过 delegate 交给 mattpocock。

各阶段对应哪些 override → [superpowers-overrides 说明](packages/superpowers-overrides/README.zh-CN.md)。

## 安装

```bash
# In Claude Code
/plugin marketplace add oscaner/skills
/plugin install mattpocock-skills@oscaner
/plugin install superpowers@oscaner
/plugin install superpowers-overrides@oscaner
/plugin install engineering@oscaner
```

克隆本仓库（本地开发需初始化 submodule）：

```bash
git clone https://github.com/Oscaner/skills.git
cd skills
git submodule update --init
```

### npm 包

每个插件也会作为 `@oscaner-skills/*` scoped npm 包发布——first-party 走 changesets，vendored 插件由 [`scripts/publish-vendor.mjs`](scripts/publish-vendor.mjs) 重新装配发布（保留上游 LICENSE）。这些包携带同样的 `oscaner-plugin` 元数据；hooks 只在通过 Claude Code / Cursor marketplace 安装时激活。

```bash
# first-party
npm install @oscaner-skills/superpowers-overrides @oscaner-skills/engineering
# vendored 重发（上游内容）
npm install @oscaner-skills/superpowers @oscaner-skills/mattpocock-skills @oscaner-skills/impeccable
```

## 快速开始

1. 从 marketplace 安装 `superpowers`、`superpowers-overrides`、`engineering`、`mattpocock-skills`。
2. 每个项目跑一次 **`os-init spor`**——插件升级后重跑。具体 slash 命令因 harness 而异 → [用法](packages/superpowers-overrides/README.zh-CN.md#用法)。
3. 照常调用 superpowers 工作流——路由器会先路由到对应的 engineering / mattpocock 目标。

## 延伸阅读

[superpowers-overrides 说明](packages/superpowers-overrides/README.zh-CN.md)——路由器目标、Claude Code / Cursor 差异、三层 enforcement。

## 新增 first-party 插件

市场是**包即源**——新增一个 first-party 插件会自动接入派生、workspace 和发布流程，无需手工注册：

1. 创建 `packages/<name>/package.json`，带上 `oscaner-plugin` 字段（`contentRoot`、`harnesses`、可选 `hooks`）——这是唯一元数据源。
2. `pnpm run emit` 从它派生 `marketplace/source.json`（[`deriveFirstPartyNames`](scripts/lib/emit/manifests.mjs) 扫描 `packages/*` 找该字段）并重新生成市场文档。
3. `pnpm-workspace.yaml`（`packages/*`）自动纳入；一个点名它的 changeset 就会通过 [`scripts/version-packages.mjs`](scripts/version-packages.mjs) 把它作为 `@oscaner-skills/<name>` 发布。

per-harness hooks：在 `oscaner-plugin.hooks` 里加 harness → 路径映射，emit 就会写出该 hooks 文件。新的 harness manifest：扩展 `oscaner-plugin.harnesses`。[`scripts/emit.mjs`](scripts/emit.mjs) 里 per-plugin 的 harness 发射目前是针对 `engineering` 和 `superpowers-overrides` 定制的——新插件类型需要在其中加 emitter（或提交好它的 manifest 以通过 cursor 路径断言）。

vendoring 上游插件是另一条路：加一个 `vendors/<name>` submodule + [`scripts/lib/emit/source.mjs`](scripts/lib/emit/source.mjs) 里的 `VENDOR_PLUGINS` 装配模板；[`scripts/publish-vendor.mjs`](scripts/publish-vendor.mjs) 负责装配并重发。

## 维护者

修改 overrides（或任一 first-party 插件 manifest）后：`pnpm run emit && pnpm run validate`。

发布流程：[`.changeset/README.md`](.changeset/README.md)。贡献模式：[`CLAUDE.md`](CLAUDE.md)。

## 许可

本仓库 first-party 代码（`superpowers-overrides`、marketplace 工具链）采用 [MIT](LICENSE)。

Vendored 插件保留各自许可——见各插件目录（如 `vendors/mattpocock-skills/LICENSE`）。
