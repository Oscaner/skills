# oscaner-skills

> 🔗 **Mirror 同步声明**：本文件（`README.zh-CN.md`）是英文源 [README.md](README.md) 的同步中文 **mirror**——顶层章节集合逐条一致（8 段，节点按位置一一对应）；语义以英文源为准。**同步时间戳**：2026-11-03。

[English](README.md) | [中文](README.zh-CN.md)

[![PR Validate](https://github.com/Oscaner/skills/actions/workflows/pr-validate.yml/badge.svg)](https://github.com/Oscaner/skills/actions/workflows/pr-validate.yml)
[![npm](https://img.shields.io/npm/v/@oscaner-skills/kairos?label=kairos)](https://www.npmjs.com/package/@oscaner-skills/kairos)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**A cdd-first methodology: continuously-discovered development as the core discipline, AI coding skills as the distribution vehicle.**

（cdd-first 方法论：以持续发现式开发为核心理念，以 AI 编程技能为分发载体。）

本仓库既是该方法论的家园，也是它的分发载体。核心理念被编码为技能、以可安装插件形式发布、可供多种 AI 编程 harness 消费（已在 **Claude Code** 与 **Pi** 上验证），并由 `cdd` 引擎驱动。

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

每条发现都带有严重级别——**blocker**、**warn** 或 **nit**——以及一个 lens。**Review Convergence** 是唯一的收口规则：blocker 进入 `fix` 并重新评审；仅 warn/nit 时以 `REVIEW_FIX` 收敛；零发现直接关闭。同一条规则关闭 wave、branch、phase-spec、overall、plan 与 single-spec 评审，因此没有任何一个面可以自造停止条件。

## 这是什么

一个将 AI 编程技能打包为可安装插件的市场，并附带这些技能所运行的引擎。三样东西一起交付：

- **六个 `cdd-*` 技能**——把一次变更从设计带到收口的编排器，另加 `cdd-report`，用于把会话自身出的问题记录成 issue。
- **`cdd` CLI**——`implement` · `review` · `fix` · `base` · `schema` · `issue` · `board` · `init`。它掌管前置门禁、计划账本、轮次记录与进度看板。
- **市场打包**——第一方插件在本仓库构建并由我们发布；上游插件从各自的发布方安装，编排器以 `/plugin:skill` 引用它们（例如 `/superpowers:brainstorming`）。

## 流程

一次变更经过五个阶段。每个阶段都是一个编排器，派发引擎轮次，并且只有当它的产物收敛后才交给下一阶段：

| 阶段 | 编排器 | 交付给你什么 |
|---|---|---|
| 设计 | `cdd-design` | 设计对话，并落到一种 spec 形态——single-spec、phase-spec 或 overall charter |
| 规格 | `cdd-spec-writer` | 评审至收敛并已提交的 spec |
| 计划 | `cdd-plan` | 任务波次——每波至多三个任务，这是引擎强制执行而非绕开的限制 |
| 开发 | `cdd-dev` | 每波的 implement / review / fix 轮次，以及关闭本次变更的分支评审 |
| 收口 | `cdd-close` | 收尾决策，随后关闭相关 issue |

`cdd-report` 站在链外：它会话在自身工具链中发现的问题与改进，聚合成一个 issue 提交。

### 一轮如何被判定

下一步由引擎而非编排器决定，且只依据证据决定：

- **每次派发都以判定收尾。** 即便被阻断或超时，轮次也会登记记录，所以“这一轮什么都没做”永远是显式记录，而非沉默的缺席。
- **完成与否按动词各自的判据裁定，绝不看子进程退出码。** `implement` 必须留下提交，`review` 必须留下能通过校验的 findings 载体，`fix` 必须回应请求里的每一条发现。
- **下一个去向是推演出来的，并连同其原因一起打印。** 每次运行以 `next:` 行收尾，紧接着是它的原因行，而 `cdd board --plan <path>` 会把同一个判定渲染成进度看板——这一行与看板不可能互相矛盾。
- **你就是停点。** 每个编排器都会先呈上产物，并在派发第一轮之前停下来等待你的明确批准。

## 快速上手

需要 Node ≥ 24——引擎的下限，它通过原生类型擦除直接运行 TypeScript 入口——并需要 harness CLI 在 `PATH` 上。

### 会装什么

`cdd init` **按序**安装三个插件，并且走该 harness 自己的命令渠道（`claude plugin *` / `pi *`），所以安装过程不会绕过它所要装入的 harness：

| 插件 | 来源 |
|------|------|
| **kairos** | 第一方——[`packages/kairos/`](packages/kairos/)，以 [`@oscaner-skills/kairos`](https://www.npmjs.com/package/@oscaner-skills/kairos) 发布。六个 `cdd-*` 技能及 CDD 引擎 |
| **superpowers** | 上游——[obra/superpowers](https://github.com/obra/superpowers)。工作流技能 |
| **mattpocock-skills** | 上游——[mattpocock/skills](https://github.com/mattpocock/skills)。精准工具：`grilling`、`tdd` |

上游版本遵循各自的发布节奏——`cdd init` 安装各发布方当前发布的版本。

### 首次运行

```bash
npx -y @oscaner-skills/cdd-engine@latest init --harness=claude
npx -y @oscaner-skills/cdd-engine@latest init --harness=pi
```

对已有安装加 `--update` 刷新，加 `--include-recommends` 则在核心集合之外装上六个 pi 能力包，或全局安装 `cdd`（`npm i -g @oscaner-skills/cdd-engine`）以省去前缀。逐 harness 的手工安装命令见 [`packages/kairos/README.md`](packages/kairos/README.md) 的安装表。

然后调用第一个编排器——`/kairos:cdd-design`——并跟着引擎的 `next:` 行走下去。其余无需配置：技能按需通过 `npx -y @oscaner-skills/cdd-engine@latest <子命令>` 获取引擎，引擎把运行态保存在 `.kairos/cdd/` 下，并在首次派发时自发布 `.kairos/.gitignore`（内容 `*`）。

## 架构与实现

```
packages/
├── kairos/        # 插件：六个 cdd-* 技能（编排器、spec writer、report）
│   ├── skills/    # 每个技能一份 SKILL.md——对外的交付面
│   └── tests/     # 结构解剖、词面与行为树探针
└── cdd-engine/    # @oscaner-skills/cdd-engine——cdd CLI
    ├── src-next/  # 五个平面：contract · face · infra · render · session
    └── templates/ # 随包发布的 report 与 issue-body 模板
```

市场采用**包即源**模式。元数据位于各第一方 `package.json#oscaner`；一个 emit 步骤派生全部产物，因此清单不可能与它所描述的包不一致：

```
package.json#oscaner → pnpm run emit → marketplace/source.json
                                    → .claude-plugin/ 清单
                                    → .github/ISSUE_TEMPLATE/
```

架构与开发者/引擎旅程以双语、经校验的图表维护——打开[图表入口](docs/diagrams/index.html)，在页头切换语言：

- [Architecture (EN)](docs/diagrams/architecture.en.html) · [架构（中文）](docs/diagrams/architecture.zh-CN.html)
- [Developer & engine journey (EN)](docs/diagrams/journey.en.html) · [开发者与引擎旅程（中文）](docs/diagrams/journey.zh-CN.html)
- [NEXT-loop & round judgment (EN)](docs/diagrams/next-loop.en.html) · [NEXT 循环与轮次判定（中文）](docs/diagrams/next-loop.zh-CN.html)

## 文档

- [`packages/kairos/README.md`](packages/kairos/README.md)——技能、安装、快速开始、harness 对照表
- [`packages/cdd-engine/README.md`](packages/cdd-engine/README.md)——`cdd` CLI 参考
- [`.changeset/README.md`](.changeset/README.md)——版本与发布流程
- [`docs/diagrams/README.md`](docs/diagrams/README.md)——图表及其重新生成方式
- [`AGENTS.md`](AGENTS.md)——面向编码 agent 的仓库约定（`CLAUDE.md` 是指向它的符号链接）

## 参与贡献

Node 26（`.nvmrc`）与 pnpm 12.18.0（`packageManager`）——若使用 fnm，先执行 `fnm use`。

```bash
pnpm install
pnpm run emit       # 从 package.json#oscaner 重新生成派生产物
pnpm run validate   # 完整门禁
```

`pnpm run validate` 覆盖整个断言面：emit 新鲜度 · 根、kairos、引擎三套测试 · 类型检查 ×3 · 包版本同步 · 零模块级裸函数。改动任一个包的行为还需附带 changeset——版本跟随方法论契约，所以即便对外可见的字节变更也只是 minor，`major` 由机器禁止。新增第一方插件：创建带 `oscaner` 字段的 `packages/<name>/package.json`，运行 `pnpm run emit`，并添加 changeset。

引擎开发调用本地源码而非已发布版本：`node packages/cdd-engine/src-next/bin.ts <子命令>`。聚焦命令、生成文件清单与提交约定见 [`AGENTS.md`](AGENTS.md)。

`develop` 是集成分支；生产发布经 `develop → main`。版本 PR、tag 与 GitHub Release 仅在 `main` 上运行。

## 许可

第一方代码（`kairos`、marketplace 工具链）：[MIT](LICENSE)。
