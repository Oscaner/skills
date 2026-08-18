# superpowers-overrides

[English](README.md) | [简体中文](README.zh-CN.md)

**触发路由插件**，用于 [superpowers](https://github.com/obra/superpowers) + [engineering](../engineering/)。本插件**不包含任何 skill 正文** — 它拦截上游 `superpowers:*` 触发器，并将它们路由到对应的 **engineering** 编排器（`os-*` / `cli-*`）或 **mattpocock-skills** 委托（`tdd`）。

## 功能说明

当你调用 `/brainstorming`、`/writing-plans` 或其他 superpowers skill 时，路由会优先触发并加载对应的目标：

- `engineering:os-*` — 读取上游基线并应用个人规则的流程编排器
- `engineering:cli-driven-development` — CDD 引擎 skill
- `mattpocock-skills:tdd` — `/test-driven-development` 的实现委托

三层机制确保路由不被跳过：

1. **触发映射表** — 每个上游入口点在 `overrides.manifest.json` 中映射到目标（唯一事实来源）
2. **插件内置 Hooks** — Claude Code：`UserPromptExpansion` 匹配器；Cursor：`beforeSubmitPrompt` 检测 + `preToolUse` 强制执行
3. **项目规则** — `os-init spor` 将自检规则写入项目（`CLAUDE.md` 或 `.cursor/rules/superpowers-overrides.mdc`）

## 路由目标

| 触发器 | 目标 | 功能 |
|--------|------|------|
| `/brainstorming` | `engineering:os-brainstorming` | 将发现委托给 `grilling`；子代理 spec 审查 |
| `/writing-plans` | `engineering:os-writing-plans` | 逐节计划编写 + 审查；ticket 输出到 `docs/superpowers/tickets/` |
| `/subagent-driven-development` | `engineering:cli-driven-development` | CDD 引擎 — 工具 CLI 三模式链 |
| `/executing-plans` | `engineering:os-executing-plans` | 三模式编排器（会话内 / 子代理 / CLI） |
| `/finishing-a-development-branch` | `engineering:os-finishing` | 分支完成 / PR；禁止 worktree；约定式提交 |
| `/systematic-debugging` | `engineering:os-debugging` | 先收集证据再修复；委托给 `diagnosing-bugs` |
| `/test-driven-development` | `mattpocock-skills:tdd` | 红绿循环；seam 确认门控 |
| `/verification-before-completion` | `engineering:os-verification` | 无验证证据不得声称完成 |
| `/receiving-code-review` | `engineering:os-code-review` | 不明确的反馈转给 `grilling`；修复转给 `tdd` |
| `/using-git-worktrees` | `engineering:os-finishing` | 拒绝创建 worktree（用户策略） |

## 安装

```bash
npm install @oscaner-skills/superpowers-overrides
```

或从 oscaner-skills marketplace 与配套插件（`superpowers`、`engineering`、`mattpocock-skills`）一起安装。

## 快速开始

1. 从 marketplace 安装 `superpowers`、`superpowers-overrides`、`engineering` 和 `mattpocock-skills`。
2. 在每个项目中运行 **`os-init spor`**（插件升级后需重新运行）。
3. 调用上游 superpowers skill — 路由自动生效。

### Claude Code

- 工作流：`/superpowers:brainstorming`、`/superpowers:writing-plans` ...
- 初始化：`/os-init spor` 将自检块写入项目 `CLAUDE.md`。

### Cursor

- 工作流：裸上游斜杠命令（`/brainstorming`）或基于规则的拦截。
- 初始化：`os-init spor` 写入 `.cursor/rules/superpowers-overrides.mdc`。
- Hooks 随插件一起安装；**不要**在项目中添加 `.cursor/hooks.json`。

## 许可证

[MIT](LICENSE)
