# osuperpowers-router 插件 — 维护者指南

> **读者定位**：本文面向本 monorepo（Oscaner/skills）的开发者，描述插件开发、emit 链、hooks、releasing 等维护流程。**消费者环境不适用**——安装插件的用户无需阅读本文。

## How it works

三种机制协同强制路由：

### 1. overrides.manifest.json（单一真源）

`packages/osuperpowers-router/overrides.manifest.json` 列出每个上游 trigger 及其 target。所有 hook 脚本与 self-check 表都由 `pnpm run emit` 从该 manifest 派生。**不要**手编 hook 脚本——改 manifest 再重新 emit。

### 2. Hooks（plugin-bundled）

**Claude Code** — `packages/osuperpowers-router/hooks/hooks.json`：
- Hook 类型：`UserPromptExpansion`
- 两个 matcher：`^superpowers:`（带命名空间的 slash）与一个合并正则用于 bare `/slug` 形式
- Handler：`packages/osuperpowers-router/bin/prompt-expansion.mjs` —— 读取 stdin JSON，在硬编码的 MAP 中查找命令，注入 `additionalContext` 告知模型其首个工具调用必须是 `Skill(<target>)`

**Cursor** — `packages/osuperpowers-router/hooks/hooks-cursor.json`：
- `beforeSubmitPrompt` → `packages/osuperpowers-router/bin/cursor-detect.mjs` —— 检测上游 skill 文件附件，写入 pending-state 文件
- `preToolUse` → `packages/osuperpowers-router/bin/cursor-enforce.mjs` —— 若存在 pending state，则拦截非 override 工具调用（例如 Read 上游 SKILL.md）并注入强制性的 override 消息
- Fail-open：若任何内容无法解析或 pending 文件过期（TTL 300s），hook 放行该操作

### 3. 项目级 self-check

`init router`（来自 osuperpowers）将一份 override trigger 表写入项目的 `CLAUDE.md`（Claude Code）或 `.cursor/rules/osuperpowers-router.mdc`（Cursor）。这是主要强制机制——它在任何 skill 正文载入上下文之前触发。

## Trigger mapping table

| 上游 trigger | Target | 描述 |
|---|---|---|
| `superpowers:brainstorming` | `osuperpowers:brainstorming` | 经 `grilling` 发现；subagent spec review |
| `superpowers:writing-plans` | `osuperpowers:writing-plans` | 逐节 plan 写入 + review；tickets 写入 `docs/superpowers/tickets/` |
| `superpowers:subagent-driven-development` | `osuperpowers:cli-driven-development` | CDD 引擎——harness CLI 三模式链 |
| `superpowers:finishing-a-development-branch` | `osuperpowers:finishing` | 分支收尾 / PR；无 worktree；conventional commits |
| `superpowers:systematic-debugging` | `osuperpowers:debugging` | 证据先于修复；委派给 `diagnosing-bugs` |
| `superpowers:test-driven-development` | `mattpocock-skills:tdd` | 红绿循环；直接 delegate |
| `superpowers:verification-before-completion` | `osuperpowers:verification` | 未经验证证据不得声称完成 |
| `superpowers:using-git-worktrees` | `osuperpowers:finishing` | 拒绝创建 worktree（用户政策） |

同样的映射也用于 bare `/slug` 形式（例如 `/brainstorming` 映射到 `osuperpowers:brainstorming`）。

## 约定：无 skill 正文

本插件**不随包发布任何 SKILL.md 文件**。所有 skill 正文位于 `packages/osuperpowers/skills/`。overrides 插件的 `packages/osuperpowers-router/skills/` 目录必须为空（或不存在）。验证脚本强制这一点——trigger-router 插件中若 skills 目录非空，`pnpm run validate` 会失败。

## 相关文件

- `packages/osuperpowers-router/overrides.manifest.json` —— trigger-to-target 映射（真源）
- `packages/osuperpowers-router/hooks/hooks.json` —— Claude Code hooks（UserPromptExpansion）
- `packages/osuperpowers-router/hooks/hooks-cursor.json` —— Cursor hooks（beforeSubmitPrompt + preToolUse）
- `packages/osuperpowers-router/bin/prompt-expansion.mjs` —— Claude Code hook handler
- `packages/osuperpowers-router/bin/cursor-detect.mjs` —— Cursor detect hook handler
- `packages/osuperpowers-router/bin/cursor-enforce.mjs` —— Cursor enforce hook handler
- `packages/osuperpowers/skills/` —— 所有 target skill 正文所在处
