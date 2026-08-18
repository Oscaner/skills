# osuperpowers-router

[English](README.md) | [简体中文](README.zh-CN.md)

**触发路由插件**，用于 [superpowers](https://github.com/obra/superpowers) + [osuperpowers](../osuperpowers/)。本插件**不包含任何 skill 正文** — 它拦截上游 `superpowers:*` 触发器，并将它们路由到对应的 **osuperpowers** 编排器（`os-*` / `cli-*`）或 **mattpocock-skills** 委托（`tdd`）。

## 功能说明

当你调用 `/brainstorming`、`/writing-plans` 或其他 superpowers skill 时，路由会优先触发并加载对应的目标：

- `osuperpowers:*` — 读取上游基线并应用个人规则的流程编排器
- `osuperpowers:cli-driven-development` — CDD 引擎 skill
- `mattpocock-skills:tdd` — `/test-driven-development` 的实现委托

三层机制确保路由不被跳过：

1. **触发映射表** — 每个上游入口点在 `overrides.manifest.json` 中映射到目标（唯一事实来源）
2. **插件内置 Hooks** — Claude Code：`UserPromptExpansion` 匹配器；Cursor：`beforeSubmitPrompt` 检测 + `preToolUse` 强制执行
3. **项目规则** — `init router` 将自检规则写入项目（`CLAUDE.md` 或 `.cursor/rules/osuperpowers-router.mdc`）

## 路由目标

| 触发器 | 目标 | 功能 |
|--------|------|------|
| `/brainstorming` | `osuperpowers:brainstorming` | 将发现委托给 `grilling`；子代理 spec 审查 |
| `/writing-plans` | `osuperpowers:writing-plans` | 逐节计划编写 + 审查；ticket 输出到 `docs/superpowers/tickets/` |
| `/subagent-driven-development` | `osuperpowers:cli-driven-development` | CDD 引擎 — 工具 CLI 三模式链 |
| `/executing-plans` | `osuperpowers:executing-plans` | 三模式编排器（会话内 / 子代理 / CLI） |
| `/finishing-a-development-branch` | `osuperpowers:finishing` | 分支完成 / PR；禁止 worktree；约定式提交 |
| `/systematic-debugging` | `osuperpowers:debugging` | 先收集证据再修复；委托给 `diagnosing-bugs` |
| `/test-driven-development` | `mattpocock-skills:tdd` | 红绿循环；seam 确认门控 |
| `/verification-before-completion` | `osuperpowers:verification` | 无验证证据不得声称完成 |
| `/receiving-code-review` | `osuperpowers:code-review` | 不明确的反馈转给 `grilling`；修复转给 `tdd` |
| `/using-git-worktrees` | `osuperpowers:finishing` | 拒绝创建 worktree（用户策略） |

## 安装

```bash
npm install @oscaner-skills/osuperpowers-router
```

或从 oscaner-skills marketplace 与配套插件（`superpowers`、`osuperpowers`、`mattpocock-skills`）一起安装。

## 快速开始

1. 从 marketplace 安装 `superpowers`、`osuperpowers-router`、`osuperpowers` 和 `mattpocock-skills`。
2. 在每个项目中运行 **`init router`**（插件升级后需重新运行）。
3. 调用上游 superpowers skill — 路由自动生效。

### Claude Code

- 工作流：`/superpowers:brainstorming`、`/superpowers:writing-plans` ...
- 初始化：`/init router` 将自检块写入项目 `CLAUDE.md`。

### Cursor

- 工作流：裸上游斜杠命令（`/brainstorming`）或基于规则的拦截。
- 初始化：`init router` 写入 `.cursor/rules/osuperpowers-router.mdc`。
- Hooks 随插件一起安装；**不要**在项目中添加 `.cursor/hooks.json`。

## 许可证

[MIT](LICENSE)
