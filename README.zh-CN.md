# oscaner

[English](README.md) | [简体中文](README.zh-CN.md)

[![CI](https://github.com/Oscaner/skills/actions/workflows/ci.yml/badge.svg)](https://github.com/Oscaner/skills/actions/workflows/ci.yml)

*用 superpowers-overrides + os-engineering 把 superpowers 的全流程和 mattpocock 的精专缝成一条工程化流水线。*

个人 [Claude Code](https://claude.com/claude-code) 插件市场。四个插件组成一条流水线：构思 → 计划 → 开发 → 交付。

## 为什么有这个市场

**[Superpowers](https://github.com/obra/superpowers)** 大而全——从 brainstorming、写计划、子 agent 驱动开发，到验证、收尾分支，一套走完。

**[mattpocock-skills](plugins/mattpocock-skills/)** 小而精——`grilling` 挖清需求，`tdd` 管实现，`to-tickets` 切任务。每个 skill 只做一件事，但做得很准。

单独用哪一个，都缺一块：什么时候 delegate、spec 怎么审、大功能怎么分期。**superpowers-overrides** 是**触发路由器**——它不带任何技能体。它拦截上游 superpowers 触发（slash 命令、SKILL attach），路由到匹配的 **os-engineering** 编排器（`os-*`）或 **mattpocock-skills** 委托（`tdd`、`grilling`）。`os-*` 编排器在上游基线上叠加个人规则——grilling 澄清、fresh-subagent spec review、大 scope 走 **overall + phase** 分解。

**[os-engineering](plugins/os-engineering/)** 是**技能 + 引擎 + gate** 层——`os-*` 编排器（`os-brainstorming`、`os-writing-plans`、`os-executing-plans` …）与 `cli-*` 家族（`cli-select`、`cli-task`、`cli-driven-development`、`cli-code-review`）跑在 cdd 引擎上，带 per-harness registry 探测，外加跨 harness 的 CDD orchestrator gate。

## 流水线

```
Overall spec → Phase spec → Plan → SDD/TDD → Verify → Ship
```

overrides 在设计阶段加入 grilling 和 subagent review；grilling、tdd、to-tickets 通过 delegate 交给 mattpocock。

各阶段对应哪些 override → [superpowers-overrides 说明](plugins/superpowers-overrides/README.zh-CN.md)。

## 安装

```bash
# In Claude Code
/plugin marketplace add oscaner/skills
/plugin install mattpocock-skills@oscaner
/plugin install superpowers@oscaner
/plugin install superpowers-overrides@oscaner
/plugin install os-engineering@oscaner
```

克隆本仓库（本地开发需初始化 submodule）：

```bash
git clone https://github.com/Oscaner/skills.git
cd skills
git submodule update --init
```

## 快速开始

1. 从 marketplace 安装 `superpowers`、`superpowers-overrides`、`os-engineering`、`mattpocock-skills`。
2. 每个项目跑一次 **`os-init spor`**——插件升级后重跑。具体 slash 命令因 harness 而异 → [用法](plugins/superpowers-overrides/README.zh-CN.md#用法)。
3. 照常调用 superpowers 工作流——路由器会先路由到对应的 os-engineering / mattpocock 目标。

## 延伸阅读

[superpowers-overrides 说明](plugins/superpowers-overrides/README.zh-CN.md)——路由器目标、Claude Code / Cursor 差异、三层 enforcement。

## 维护者

修改 overrides（或任一 first-party 插件 manifest）后：`pnpm run emit && pnpm run validate`。

发布流程：[`.changeset/README.md`](.changeset/README.md)。贡献模式：[`CLAUDE.md`](CLAUDE.md)。

## 许可

本仓库 first-party 代码（`superpowers-overrides`、marketplace 工具链）采用 [MIT](LICENSE)。

Vendored 插件保留各自许可——见各插件目录（如 `plugins/mattpocock-skills/LICENSE`）。
