# @oscaner-skills/engineering

[English](README.md) | [简体中文](README.zh-CN.md)

Claude Code 工程技能插件 — os-\* 编排系列、cli-\* CDD 引擎技能、CDD 编排器门控。

## 功能概述

本插件提供两大技能系列：

- **os-\* 编排器** — 读取上游 `superpowers` 基线并叠加个人规则的流程编排器（澄清问题通过 `grilling`、规格审查通过 fresh subagent passes、工单发布重定向等）
- **cli-\* CDD 引擎** — 三模式链（implement / review / fix），将编码任务分发到外部 AI CLI（`claude`、`cursor-agent`、`droid`、`pi`）
- **CDD 门控** — 对 `Write`/`Edit` 和 `Bash` 工具调用执行 pending-state 约束的钩子

## 技能列表

| 技能 | 类型 | 说明 |
|------|------|------|
| `os-brainstorming` | 编排器 | 发现阶段委托给 `grilling`；子代理规格审查；大范围整体/分阶段 |
| `os-writing-plans` | 编排器 | 逐节方案编写 + 审查；工单输出到 `docs/superpowers/tickets/` |
| `os-executing-plans` | 编排器 | 三模式执行器（会话内 / 子代理 / CLI） |
| `os-finishing` | 编排器 | 分支收尾 / PR；禁止 worktree；约定式提交 |
| `os-debugging` | 编排器 | 先收集证据再修复；委托给 `diagnosing-bugs` |
| `os-verification` | 编排器 | 无验证证据不得声称完成 |
| `os-code-review` | 编排器 | 反馈不清 → `grilling`；修复 → `tdd` |
| `os-init` | 工具 | 项目初始化（`os-init spor` 写入自检规则） |
| `os-report-issue` | 工具 | 结构化问题报告 |
| `cli-driven-development` | CDD 引擎 | CLI 三模式链分发器 |
| `cli-select` | CDD 引擎 | 交互式 harness 选择 |
| `cli-task` | CDD 引擎 | 单任务 CDD 执行 |
| `cli-code-review` | CDD 引擎 | CDD 驱动的代码审查 |

## 安装

```bash
npm install @oscaner-skills/engineering
```

或从 oscaner-skills Claude Code marketplace 安装。

## 快速开始

1. 从 marketplace 安装 `superpowers`、`superpowers-overrides`、`engineering` 和 `mattpocock-skills`。
2. 在每个项目中运行 **`/os-init spor`** 写入自检规则。
3. 使用上游 superpowers 技能 — 路由器自动路由到工程编排器。

### Claude Code

```bash
/osuperpowers:brainstorming    # → os-brainstorming
/osuperpowers:writing-plans    # → os-writing-plans
/osuperpowers:executing-plans  # → os-executing-plans
```

### Cursor

```bash
/brainstorming    # → os-brainstorming（裸上游斜杠命令）
/writing-plans    # → os-writing-plans
```

## CDD CLI harness 脚本

CDD 引擎通过插件捆绑脚本分发。单一 CLI 运行器为 `bin/engine/cdd-run.mjs`。

| Harness | CLI 二进制 | 状态 |
|---------|-----------|------|
| claude | `claude` | 完整支持 |
| cursor-agent | `cursor-agent` | 完整支持 |
| droid | `droid` | 完整支持 |
| pi | `pi` | 完整支持 |
| codex | `codex` | 不支持 |
| copilot | `copilot` | 不支持 |
| gemini | `gemini` | 不支持 |

## 维护者文档

- [CLAUDE.md](CLAUDE.md) — 工程插件内部机制（钩子、overrides 模式、emit、验证、发布）

## 许可证

MIT
