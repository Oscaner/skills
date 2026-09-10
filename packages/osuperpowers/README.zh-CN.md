# @oscaner-skills/osuperpowers

[English](README.md) | [简体中文](README.zh-CN.md)

Claude Code 工程技能插件 — osuperpowers 编排系列与 cli-\* CDD 引擎技能。

## 功能概述

本插件提供两大技能系列：

- **osuperpowers 编排器** — 读取上游 `superpowers` 基线并叠加个人规则的流程编排器（澄清问题通过 `grilling`、规格审查通过 fresh subagent passes、工单发布重定向等）
- **cli-\* CDD 引擎** — 三模式链（implement / review / fix），将编码任务分发到外部 AI CLI（`claude`、`cursor-agent`）

## 技能列表

| 技能 | 类型 | 说明 |
|------|------|------|
| `brainstorming` | 编排器 | 发现阶段委托给 `grilling`；子代理规格审查；大范围整体/分阶段 |
| `writing-plans` | 编排器 | 逐节方案编写 + 审查；工单输出到 `docs/superpowers/tickets/` |
| `cli-driven-development` | 编排器 + 引擎 | 计划执行器（cli-only）；CLI 三模式链分发器 + 最终 branch-review CLI |
| `finishing` | 编排器 | 分支收尾 / PR；禁止 worktree；约定式提交 |
| `init` | 工具 | Marketplace 安装指引 — 指向对应 harness 的插件 marketplace；检查 `cdd` 引擎 CLI |
| `report-issue` | 工具 | 结构化问题报告 |

## 安装

```bash
npm install @oscaner-skills/osuperpowers
```

或从 oscaner-skills Claude Code marketplace 安装。

## 快速开始

1. 从 marketplace 安装 `superpowers`、`osuperpowers` 和 `mattpocock-skills`。
2. 在每个项目中运行 **`/init`** 从对应 harness 的插件 marketplace 安装 osuperpowers。
3. 调用 osuperpowers 技能 — 在 Claude Code 中使用 `/osuperpowers:<技能>`，在 Cursor 中使用裸斜杠命令。

### Claude Code

```bash
/osuperpowers:brainstorming    # → brainstorming
/osuperpowers:writing-plans    # → writing-plans
```

### Cursor

```bash
/brainstorming    # → brainstorming（裸上游斜杠命令）
/writing-plans    # → writing-plans
```

## CDD CLI harness 脚本

CDD 引擎通过插件捆绑脚本分发。单一 CLI 运行器为 `cdd`。

| Harness | CLI 二进制 | 状态 |
|---------|-----------|------|
| claude | `claude` | 完整支持 |
| cursor-agent | `cursor-agent` | 完整支持 |

## 维护者文档

- [docs/maintainers/osuperpowers-plugin.md](../../docs/maintainers/osuperpowers-plugin.md) — 工程插件内部机制（overrides 模式、emit、验证、发布）

## 许可证

MIT
