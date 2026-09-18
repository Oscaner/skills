# oscaner-skills

[English](README.md) | [中文](README.zh-CN.md)

[![PR Validate](https://github.com/Oscaner/skills/actions/workflows/pr-validate.yml/badge.svg)](https://github.com/Oscaner/skills/actions/workflows/pr-validate.yml)
[![npm](https://img.shields.io/npm/v/@oscaner-skills/osuperpowers?label=osuperpowers)](https://www.npmjs.com/package/@oscaner-skills/osuperpowers)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

个人 AI 编程技能市场。四个插件，一条流水线——可供多种 AI 编程 harness 消费（已在 **Claude Code** 与 **Cursor Agent** 上验证）。

## 这是什么

一个插件市场，将个人技能打包为可安装的插件，供多种 AI 编程 harness 使用。内容为 Markdown + JSON，通过市场/插件清单链在运行时发现。`packages/` 下的一方插件构成 pnpm 工作区（changesets、CI、统一的 `pnpm run emit` 构建步骤）。

流水线流程：

```
Spec --> Plan --> SDD/TDD --> Verify --> Ship
```

## 插件列表

| 插件 | 类型 | 说明 |
|------|------|------|
| **[osuperpowers](packages/osuperpowers/)** | 一方 | 技能（osuperpowers 编排器、`cli-*` 家族）、CDD 引擎 |
| **[superpowers](vendors/superpowers/)** | vendored | 上游工作流技能——brainstorming、writing plans、SDD、verification、branch finish |
| **[mattpocock-skills](vendors/mattpocock-skills/)** | vendored | 精准工具——`grilling`、`tdd` |
| **[impeccable](vendors/impeccable/)** | vendored | 前端设计技能 |

所有插件均以 `@oscaner-skills/*` scoped npm 包发布。

## 安装

### 从市场安装（推荐）

```bash
# Claude Code
/plugin marketplace add oscaner/skills
/plugin install osuperpowers@oscaner-skills
/plugin install superpowers@oscaner-skills
/plugin install mattpocock-skills@oscaner-skills
```

### 从 npm 安装

```bash
npm install @oscaner-skills/osuperpowers
npm install @oscaner-skills/superpowers @oscaner-skills/mattpocock-skills @oscaner-skills/impeccable
```

### 按 harness 安装

| Harness | 安装方式 |
|---------|---------|
| Claude Code | marketplace 安装 |
| Cursor Agent | marketplace 安装 |

osuperpowers 通过各 harness 自己的插件市场安装；claude 与 cursor-agent 无需每 harness 的配置文件或信任流程。

## 快速开始

1. 从市场或 npm 安装插件（见上文）。
2. 确保 `cdd` 引擎 CLI 在 PATH 上（`command -v cdd`）；若缺失，运行 `npm i -g @oscaner-skills/cdd-engine`。`cli-driven-development` 的 `detect-engine` 节点会在 dispatch 时重新检查。
3. 照常调用 superpowers 工作流——osuperpowers skills 会自动拦截上游触发器并路由到对应目标。

## 架构

市场采用**包即源**模式——元数据在各 `package.json` 的 `oscaner-plugin` 字段中。构建步骤 `pnpm run emit` 从中派生一切：

```
package.json#oscaner-plugin --> emit --> marketplace/source.json
                                     --> .claude-plugin/marketplace.json
                                     --> .cursor-plugin/marketplace.json
                                     --> 各插件 .claude-plugin/plugin.json
                                     --> hooks 文件（按 harness）
```

一方插件无需手动注册。vendored 插件通过 `scripts/release/vendor-assembly.mjs` 从 `vendors/` submodule 装配。

完整架构说明：[CLAUDE.md](CLAUDE.md)。

## 各包文档

- [packages/osuperpowers/](packages/osuperpowers/)——技能、CDD 引擎

## 开发

### 常用操作

```bash
# 编辑任一插件清单或技能后
pnpm run emit && pnpm run validate

# 克隆后初始化 submodule
git submodule update --init

# 升级 vendored submodule
git -C vendors/mattpocock-skills fetch --tags origin
git -C vendors/mattpocock-skills checkout v1.1.0
git add vendors/mattpocock-skills
git commit -m "chore: bump mattpocock-skills submodule"
```

### 新增一方插件

1. 创建 `packages/<name>/package.json`，带上 `oscaner-plugin` 字段。
2. 运行 `pnpm run emit`——自动发现插件并重新生成所有清单。
3. 添加 changeset 命名它——以 `@oscaner-skills/<name>` 发布。

无需手动注册。详见 [CLAUDE.md](CLAUDE.md)。

### 分支流程

`develop` 为集成分支，日常 PR 合入此处。生产发布通过 `develop --> main` PR。版本 PR、git tag 和 GitHub Release 仅在 `main` 上运行。

发布流程：[`.changeset/README.md`](.changeset/README.md)。

Vendored 插件（`@oscaner-skills/{superpowers,mattpocock-skills,impeccable}`）在每次 publish 模式发布时随 first-party 一起装配发布到 npm，并经由 registry 全量一致性差集保证每个 npm 版本同时拥有 git tag + GitHub Release。详见 [`.changeset/README.md` vendor 发布段](.changeset/README.md#vendor-publishing)。

## 许可

一方代码（`osuperpowers`、marketplace 工具链）：[MIT](LICENSE)。

Vendored 插件保留各自许可——见各插件目录。
