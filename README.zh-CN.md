# oscaner-skills

> 🔗 **Mirror 同步声明**：本文件（`README.zh-CN.md`）是英文源 [README.md](README.md) 的同步中文 **mirror**——顶层章节集合逐条一致（9 段，节点按位置一一对应）；语义以英文源为准。**同步时间戳**：2026-10-22。

[English](README.md) | [中文](README.zh-CN.md)

[![PR Validate](https://github.com/Oscaner/skills/actions/workflows/pr-validate.yml/badge.svg)](https://github.com/Oscaner/skills/actions/workflows/pr-validate.yml)
[![npm](https://img.shields.io/npm/v/@oscaner-skills/kairos?label=kairos)](https://www.npmjs.com/package/@oscaner-skills/kairos)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**A cdd-first methodology: continuously-discovered development as the core discipline, AI coding skills as the distribution vehicle.**

（cdd-first 方法论：以持续发现式开发为核心理念，以 AI 编程技能为分发载体。）

本仓库既是该方法论的家园，也是它的分发载体。核心理念被编码为技能，并以可安装插件形式发布，可供多种 AI 编程 harness 消费（已在 **Claude Code** 与 **Pi** 上验证）。第一方包位于 `packages/` 下，以 `@oscaner-skills/*` 发布到 npm；`cdd` 引擎驱动整个流程。

## cdd 理念导览

**cdd（continuously-discovered development，持续发现式开发）** 将规划视为持续发现的过程，而非一次性前置文档。需求通过小步、可验证的增量来发现：每个任务都对照计划规划、由宿主 harness 执行，并对照共享的收敛规则评审——因此下一个增量总是基于前一个增量实际学到的东西来规划。

### 为什么这样设计

- **发现而非预测。** 评审发现成为下一轮的输入；不凭信任接纳任何需求。
- **小步、可验证的增量。** 每个任务都有计划、简报与显式状态。
- **单一来源，派生产物。** 事实只存一处，对外发布的东西都由它派生，纸面与实践不会漂移。
- **确定性执行。** 同样的计划、同样的简报、同样的命令、同样的结果。

### 三种模式链

核心循环是一条链：`implement` 执行简报，`review` 对照固定标准评审结果，`fix` 应用发现。被阻断的评审经 `fix` 回到重新评审；收敛的评审推进到下一组。最终的分支评审关闭本次变更。

### 收敛纪律

每条发现都带有严重级别——**blocker**、**warn** 或 **nit**——以及一个 lens。**Review Convergence** 是唯一的收口规则：blocker 进入 `fix` 并重新评审；仅 warn/nit 时以 `REVIEW_FIX` 收敛；零发现直接关闭。同一条规则关闭任务、分支、spec 与 plan 评审。

## 这是什么

一个将 AI 编程技能打包为可安装插件的市场，供多种 harness 消费。第一方插件在本仓库构建并由我们发布；上游插件从各自的发布方安装，kairos 编排器以 `/plugin:skill` 引用它们（例如 `/superpowers:brainstorming`）。

## 插件列表

| 插件 | 来源 |
|------|------|
| **kairos** | 第一方——[`packages/kairos/`](packages/kairos/)，以 [`@oscaner-skills/kairos`](https://www.npmjs.com/package/@oscaner-skills/kairos) 发布。六个 `cdd-*` 技能及 CDD 引擎 |
| **superpowers** | 上游——[obra/superpowers](https://github.com/obra/superpowers)。工作流技能 |
| **mattpocock-skills** | 上游——[mattpocock/skills](https://github.com/mattpocock/skills)。精准工具：`grilling`、`tdd` |

上游版本遵循各自的发布节奏——`cdd init` 安装各发布方当前发布的版本。

## 安装

```bash
npx -y @oscaner-skills/cdd-engine@latest init --harness=claude
npx -y @oscaner-skills/cdd-engine@latest init --harness=pi
```

`cdd init` 按序安装 kairos 及其上游包，经该 harness 自己的命令渠道——已全局安装 `cdd` 时可省 `npx -y @oscaner-skills/cdd-engine@latest` 前缀。逐 harness 的手工安装命令见 [`packages/kairos/README.md`](packages/kairos/README.md) 的安装表。

## 快速开始

1. 用 `cdd init --harness=<claude|pi>` 安装 kairos 及其上游包（见[安装](#安装)）。
2. 零安装前置——每个 kairos 技能都按需通过 `npx -y @oscaner-skills/cdd-engine@latest <子命令>` 获取引擎。
3. 按名称调用编排器：`/kairos:cdd-design`、`/kairos:cdd-plan`、`/kairos:cdd-dev`、`/kairos:cdd-close`。
4. 无需配置 `.gitignore`——引擎将运行态保存在 `.kairos/cdd/` 下，并在首次派发时自发布 `.kairos/.gitignore`（内容 `*`）。

## 架构

```
packages/
├── kairos/       # 插件：六个 cdd-* 技能（design、spec-writer、plan、dev、close、report）
└── cdd-engine/   # @oscaner-skills/cdd-engine：cdd CLI + 模板
```

市场采用**包即源**模式。元数据位于各第一方 `package.json#oscaner`；一个 emit 步骤派生全部产物：

```
package.json#oscaner → pnpm emit → marketplace/source.json
                                → .claude-plugin/ 清单
```

架构与开发者/引擎旅程以双语、经校验的图表维护——打开[图表入口](docs/diagrams/index.html)，在页头切换语言：

- [Architecture (EN)](docs/diagrams/architecture.en.html) · [架构（中文）](docs/diagrams/architecture.zh-CN.html)
- [Developer & engine journey (EN)](docs/diagrams/journey.en.html) · [开发者与引擎旅程（中文）](docs/diagrams/journey.zh-CN.html)
- [NEXT-loop & findings judgment (EN)](docs/diagrams/next-loop.en.html) · [NEXT 循环与 findings 判定（中文）](docs/diagrams/next-loop.zh-CN.html)

完整仓库约定：[CLAUDE.md](CLAUDE.md)。

## 各包文档

- [`packages/kairos/README.md`](packages/kairos/README.md)——技能、安装、快速开始、harness 对照表
- [`packages/cdd-engine/README.md`](packages/cdd-engine/README.md)——`cdd` CLI 参考
- [`.changeset/README.md`](.changeset/README.md)——版本与发布流程

## 开发

```bash
pnpm run emit       # 从 package.json#oscaner 重新生成清单
pnpm run validate   # emit 新鲜度 + 测试 + 类型检查 + 版本同步
```

新增第一方插件：创建带 `oscaner` 字段的 `packages/<name>/package.json`，运行 `pnpm run emit`，并添加 changeset。

`develop` 是集成分支；生产发布经 `develop → main`。版本 PR、tag 与 GitHub Release 仅在 `main` 上运行。

## 许可

第一方代码（`kairos`、marketplace 工具链）：[MIT](LICENSE)。
