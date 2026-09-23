# oscaner-skills

> 🔗 **Mirror 同步声明**：本文件（`README.zh-CN.md`）是英文源 [README.md](README.md) 的同步中文 **mirror**——顶层章节集合逐条一致（8 段，节点按位置一一对应）；本文为对外宣讲面的中文口径，语义以英文源为准。**同步时间戳**：2026-09-23。

[English](README.md) | [中文](README.zh-CN.md)

[![PR Validate](https://github.com/Oscaner/skills/actions/workflows/pr-validate.yml/badge.svg)](https://github.com/Oscaner/skills/actions/workflows/pr-validate.yml)
[![npm](https://img.shields.io/npm/v/@oscaner-skills/osuperpowers?label=osuperpowers)](https://www.npmjs.com/package/@oscaner-skills/osuperpowers)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

个人 AI 编程技能市场。一方插件 + 上游集成，一条流水线——可供多种 AI 编程 harness 消费（已在 **Claude Code** 与 **Cursor Agent** 上验证）。

## 这是什么

一个将个人 AI 编程技能打包为可安装插件的市场，供多种 AI 编程 harness 消费。一方插件位于本仓库 `packages/` 下，由我们以 `@oscaner-skills/*` scope 发布到 npm；上游插件**不**在本仓库打包——从各自的发布方安装，osuperpowers 编排器通过 `/` 前缀的 `plugin:skill` 引用读取它们（如 `/superpowers:brainstorming`）。

## 插件列表

| 插件 | 版本 | 来源 |
|------|------|------|
| **osuperpowers** | 0.1.1 | 一方——[本仓库](https://github.com/Oscaner/skills)、[`packages/osuperpowers/`](packages/osuperpowers/)，以 [`@oscaner-skills/osuperpowers`](https://www.npmjs.com/package/@oscaner-skills/osuperpowers) 发布。技能（osuperpowers 编排器、`cli-*` 家族）及 CDD 引擎 |
| **superpowers** | — | 上游——[obra/superpowers](https://github.com/obra/superpowers)。工作流技能：brainstorming、writing plans、verification、branch finish |
| **mattpocock-skills** | — | 上游——[mattpocock/skills](https://github.com/mattpocock/skills)。精准工具：`grilling`、`tdd` |
| **impeccable** | — | 上游——[pbakaus/impeccable](https://github.com/pbakaus/impeccable)。前端设计技能 |

上游插件版本遵循各自的发布节奏，本市场不跟踪——始终从各自发布方安装（见[安装](#安装)）。

## 安装

### 从市场安装（推荐）

```bash
# Claude Code
/plugin marketplace add oscaner/skills
/plugin install osuperpowers@oscaner-skills
```

### 从 npm 安装

```bash
npm install @oscaner-skills/osuperpowers
```

### 上游插件

上游插件（superpowers / mattpocock-skills / impeccable）不在此仓库打包——请从各自发布方按其官方命令安装（上方「[插件列表](#插件列表)」中标注「上游」，链接至其 GitHub 主页）。

### 按 harness 安装

| Harness | 安装方式 |
|---------|---------|
| Claude Code | Marketplace 安装 |
| Cursor Agent | Marketplace 安装 |

osuperpowers 通过各 harness 自己的插件市场安装；Claude Code 与 Cursor Agent 均无需逐 harness 配置文件。

## 快速开始

1. 从市场或 npm 安装插件（见[安装](#安装)）。
2. 确保 `cdd` 引擎 CLI 在 `PATH` 上（`command -v cdd`）；若缺失，运行 `npm i -g @oscaner-skills/cdd-engine`。`cli-driven-development` 的 `detect-engine` 节点会在 dispatch 时重新检查。
3. 照常调用 superpowers 工作流——osuperpowers 技能会自动拦截上游触发器并路由到对应目标。

## 架构

### 包布局

```
packages/
├── osuperpowers/   # 一方插件：osuperpowers 编排 + cli-* 家族 + CDD 引擎技能
└── cdd-engine/     # @oscaner-skills/cdd-engine —— CDD 引擎 CLI 包（osuperpowers 的依赖）
```

### 包即源，一条 emit 派生链

市场采用**包即源**模式——元数据位于各一方 `package.json` 的 `oscaner-plugin` 字段中。构建步骤 `pnpm run emit` 从中派生一切：

```
package.json#oscaner-plugin --> emit --> marketplace/source.json
                                     --> .claude-plugin/marketplace.json
                                     --> .cursor-plugin/marketplace.json
                                     --> 各插件 .claude-plugin/plugin.json
```

一方插件无需手动注册——`pnpm run emit` 自动发现它们。

完整架构说明：[CLAUDE.md](CLAUDE.md)。

## 各包文档

- [`packages/osuperpowers/`](packages/osuperpowers/README.md)——插件自身指南：技能清单、安装、快速开始、`cdd` CLI harness 对照表
- [`packages/cdd-engine/`](packages/cdd-engine/)——CDD 引擎包源码（在本仓库维护）
- [`docs/maintainers/`](docs/maintainers/README.md)——本仓库开发者的 maintainers 专属文档索引

## 开发

### 常用操作

```bash
# 编辑任一插件清单或技能后
pnpm run emit && pnpm run validate
```

### 新增一方插件

1. 创建 `packages/<name>/package.json`，带 `oscaner-plugin` 字段。
2. 运行 `pnpm run emit`——自动发现插件并重新生成所有清单。
3. 添加 changeset 命名它——以 `@oscaner-skills/<name>` 发布。

无需手动注册。详见 [CLAUDE.md](CLAUDE.md)。

### 分支流程

`develop` 为集成分支——日常 PR 合入此处。生产发布经 `develop --> main`。版本 PR、git tag 与 GitHub Release 仅在 `main` 上运行。

发布流程：[`.changeset/README.md`](.changeset/README.md)。

## 许可

一方代码（`osuperpowers`、marketplace 工具链）：[MIT](LICENSE)。
