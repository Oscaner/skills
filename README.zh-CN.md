# oscaner-skills

> 🔗 **Mirror 同步声明**：本文件（`README.zh-CN.md`）是英文源 [README.md](README.md) 的同步中文 **mirror**——顶层章节集合逐条一致（9 段，节点按位置一一对应）；本文为对外宣讲面的中文口径，语义以英文源为准。**同步时间戳**：2026-09-26。

[English](README.md) | [中文](README.zh-CN.md)

[![PR Validate](https://github.com/Oscaner/skills/actions/workflows/pr-validate.yml/badge.svg)](https://github.com/Oscaner/skills/actions/workflows/pr-validate.yml)
[![npm](https://img.shields.io/npm/v/@oscaner-skills/kairos?label=kairos)](https://www.npmjs.com/package/@oscaner-skills/kairos)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**A cdd-first methodology: continuously-discovered development as the core discipline, AI coding skills as the distribution vehicle.**

（cdd-first 方法论：以持续发现式开发为核心理念，以 AI 编程技能为分发载体。）

本仓库是该方法论及其分发载体的家园。核心理念——**cdd**（continuously-discovered development，持续发现式开发）——被编码为技能，并以可安装插件形式发布，可供多种 AI 编程 harness 消费（已在 **Claude Code** 与 **Cursor Agent** 上验证）。第一方插件在本仓库 `packages/` 下构建，以 `@oscaner-skills/*` scope 发布到 npm；`cdd` 引擎驱动整个流程。

## cdd 理念导览

**cdd（continuously-discovered development，持续发现式开发）** 是一种将规划视为持续发现过程而非一次性前置产物的开发理念。需求通过小步、可验证的增量来发现：每个任务都对照计划规划、依据任务简报由宿主 harness CLI 执行，并对照共享的收敛规则进行评审——因此下一个增量总是基于前一个增量实际学到的东西来规划。

cdd 不是把计划写一次就指望它扛住现实，而是让规划贯穿整个开发过程始终在线，并让每一步都可证明（「是否收敛了？」）而不是想当然（「应该没问题吧？」）。

### 为什么这样设计

- **发现而非预测。** 需求通过实现与评审来发现，而非事先猜测。每一轮的评审发现都会成为下一轮简报的输入——不凭信任接纳任何需求。
- **小步、可验证的增量。** 每个任务由计划划定范围、由简报承载、以显式状态收尾。过程始终清晰，每处变更都可证明。
- **单一来源，派生产物。** 事实只存在一处——计划、schema 或 manifest——一切对外发布的东西都由它们派生，纸面与实践不会漂移分家。
- **确定性执行。** `cdd` 引擎以命令驱动整条链：同样的计划、同样的简报、同样的命令、同样的结果。人与 harness 遵循同一份契约。

### 三种模式链

核心循环是一条由三种模式构成的链：

| 模式 | 职责 |
|------|------|
| `implement` | 对照计划的约束，为一组任务执行任务简报 |
| `review` | 对照固定的评审参考与 lens 指南，评审实现结果 |
| `fix` | 应用评审发现——blocker、warn 与 nit——并让该轮收敛 |

这条链是一个闭环：implement → review → fix，然后是下一组的 implement。阻断的评审会被送回 `fix` 并重新评审，直到通过；通过的评审收敛后循环前进。当所有组都收敛后，最终的分支评审关闭本次变更并交接给收尾。`cdd` 引擎确定性运行整条链——将每个阶段派发给宿主 harness 并写入 handoff 产物。

### 收敛纪律

评审是结构化的，而非印象式的。每条发现都带有严重级别——blocker、warn 或 nit——与一个 lens，一轮只有在发现收敛时才会结束：

- **blocker** 发现会把该轮送回 `fix` 并重新评审，直到不再剩 blocker；
- **warn / nit** 发现由一轮收敛的 fix 应用并完成，无需重新评审，发现会被记录；
- **零发现** 直接关闭评审。

**Review Convergence** 是这一切背后的共享收口规则——评审从不无声通过，fix 轮也从不重开已定的决策。同一条规则关闭任务评审、分支评审、spec 评审与计划评审，让整套方法论在一种纪律下收敛，而非靠一堆临时检查清单。

## 这是什么

一个将个人 AI 编程技能打包为可安装插件的市场，供多种 AI 编程 harness 消费。第一方插件位于本仓库 `packages/` 下，由我们以 `@oscaner-skills/*` scope 发布到 npm；上游插件**不**在本仓库打包——从各自的发布方安装，kairos 编排器通过 `/` 前缀的 `plugin:skill` 引用读取它们（如 `/superpowers:brainstorming`）。

## 插件列表

| 插件 | 来源 |
|------|------|
| **kairos** | 第一方——[本仓库](https://github.com/Oscaner/skills)、[`packages/kairos/`](packages/kairos/)，以 [`@oscaner-skills/kairos`](https://www.npmjs.com/package/@oscaner-skills/kairos) 发布。技能（kairos 编排器、`cli-*` 家族）及 CDD 引擎 |
| **superpowers** | 上游——[obra/superpowers](https://github.com/obra/superpowers)。工作流技能：cdd-design、writing plans、verification、branch finish |
| **mattpocock-skills** | 上游——[mattpocock/skills](https://github.com/mattpocock/skills)。精准工具：`grilling`、`tdd` |
| **impeccable** | 上游——[pbakaus/impeccable](https://github.com/pbakaus/impeccable)。前端设计技能 |

上游插件版本遵循各自的发布节奏，本市场不跟踪——始终从各自发布方安装（见[安装](#安装)）。

## 安装

### 从市场安装（推荐）

```bash
# Claude Code
/plugin marketplace add oscaner/skills
/plugin install kairos@oscaner-skills
```

### 从 npm 安装

```bash
npm install @oscaner-skills/kairos
```

### 上游插件

上游插件（superpowers / mattpocock-skills / impeccable）不在此仓库打包——请从各自发布方按其官方命令安装（上方「[插件列表](#插件列表)」中标注「上游」，链接至其 GitHub 主页）。

### 按 harness 安装

| Harness | 安装方式 |
|---------|---------|
| Claude Code | Marketplace 安装 |
| Cursor Agent | Marketplace 安装 |

kairos 通过各 harness 自己的插件市场安装；Claude Code 与 Cursor Agent 均无需逐 harness 配置文件。

## 快速开始

1. 从市场或 npm 安装插件（见[安装](#安装)）。
2. 确保 `cdd` 引擎 CLI 在 `PATH` 上（`command -v cdd`）；若缺失，运行 `npm i -g @oscaner-skills/cdd-engine`。`cdd-dev` 的 `detect-engine` 节点会在 dispatch 时重新检查。
3. 按名称调用 kairos 编排器——`kairos:cdd-design`、`kairos:cdd-plan` 等家族技能。每个技能将对应的上游流程作为本会话基线导入并运行自身的编排图；kairos 技能**不会拦截或自动改道**上游 `/superpowers:*` 调用——需要原版变体时直接调用对应原版技能。

## 架构

### 包布局

```
packages/
├── kairos/   # 第一方插件：kairos 编排 + cli-* 家族 + CDD 引擎技能
└── cdd-engine/     # @oscaner-skills/cdd-engine —— CDD 引擎 CLI 包（kairos 的依赖）
```

### 包即源，一条 emit 派生链

市场采用**包即源**模式——元数据位于各第一方 `package.json` 的 `oscaner` 字段中。构建步骤 `pnpm run emit` 从中派生一切：

```
package.json#oscaner --> emit --> marketplace/source.json
                                     --> .claude-plugin/marketplace.json
                                     --> .cursor-plugin/marketplace.json
                                     --> 各插件 .claude-plugin/plugin.json
```

第一方插件无需手动注册——`pnpm run emit` 自动发现它们。

完整架构说明：[CLAUDE.md](CLAUDE.md)。

## 各包文档

- [`packages/kairos/`](packages/kairos/README.md)——插件自身指南：技能清单、安装、快速开始、`cdd` CLI harness 对照表
- [`packages/cdd-engine/`](packages/cdd-engine/)——CDD 引擎包源码（在本仓库维护）
- [`docs/maintainers/`](docs/maintainers/README.md)——本仓库开发者的 maintainers 专属文档索引

## 开发

### 常用操作

```bash
# 编辑任一插件清单或技能后
pnpm run emit && pnpm run validate
```

### 新增第一方插件

1. 创建 `packages/<name>/package.json`，带 `oscaner` 字段。
2. 运行 `pnpm run emit`——自动发现插件并重新生成所有清单。
3. 添加 changeset 命名它——以 `@oscaner-skills/<name>` 发布。

无需手动注册。详见 [CLAUDE.md](CLAUDE.md)。

### 分支流程

`develop` 为集成分支——日常 PR 合入此处。生产发布经 `develop --> main`。版本 PR、git tag 与 GitHub Release 仅在 `main` 上运行。

发布流程：[`.changeset/README.md`](.changeset/README.md)。

## 许可

第一方代码（`kairos`、marketplace 工具链）：[MIT](LICENSE)。
