# superpowers-overrides

[English](README.md) | [简体中文](README.zh-CN.md)

对 [superpowers](https://github.com/obra/superpowers) + [engineering](../engineering/) 的**触发路由器**。本插件**不带任何技能体**——它拦截上游 superpowers 触发，路由到匹配的 **engineering** 编排器（`os-*` / `cli-*`）或 **mattpocock-skills** 委托（`tdd`）。个人 override 规则在 engineering 的 `os-*` 技能里——它们 Read 上游基线并叠加个人规则。

## 路由器做什么

调用 `/brainstorming`、`/writing-plans` 等 superpowers skill 时，路由器先触发，匹配目标加载：

- `engineering:os-*` — 流程编排器，Read 上游并叠加个人规则（如澄清问题 → `grilling`，spec review → fresh subagent passes）
- `engineering:cli-driven-development` / `cli-*` — cdd 引擎技能
- `mattpocock-skills:tdd` — `/test-driven-development` 的实现委托

三层机制防止路由被跳过：

1. **Trigger 表** — 每个上游入口映射到 `overrides.manifest.json` 中的目标（单一 SOT）。
2. **Hooks（plugin-bundled）** — Claude Code：`UserPromptExpansion` matchers。Cursor：`beforeSubmitPrompt` detect + `preToolUse` enforce（`hooks/hooks-cursor.json`）。**不写项目 hook 文件。**
3. **项目规则** — `os-init spor`（engineering）写入项目（`CLAUDE.md` 或 `.cursor/rules/superpowers-overrides.mdc`）；Cursor 上 hooks 未命中时为 fallback。

## 路由器目标

| 触发 | 目标 | 作用 |
|------|------|------|
| `/brainstorming` | `engineering:os-brainstorming` | discovery delegate 给 `grilling`；subagent spec review；大 scope 走 overall/phase |
| `/writing-plans` | `engineering:os-writing-plans` | 分段写 plan + review；tickets 发布到 `docs/superpowers/tickets/` |
| `/subagent-driven-development` | `engineering:cli-driven-development` | cdd 引擎——harness CLI 三模式链（implement/review/fix） |
| `/executing-plans` | `engineering:os-executing-plans` | 三模式编排器（in-session / subagent / cli） |
| `/finishing-a-development-branch` | `engineering:os-finishing` | 分支收尾 / PR；禁止 worktree；conventional commits |
| `/systematic-debugging` | `engineering:os-debugging` | 先有证据再提 fix；delegate 给 `diagnosing-bugs` |
| `/test-driven-development` | `mattpocock-skills:tdd` | 红-绿循环；seam 确认门在 engineering 模板 |
| `/verification-before-completion` | `engineering:os-verification` | 无验证证据不得声称完成 |
| `/receiving-code-review` | `engineering:os-code-review` | 不清楚的反馈 → `grilling`；fix → `tdd` |
| `/using-git-worktrees` | `engineering:os-finishing` | 拒绝创建 worktree（用户策略） |

完整映射在 [`overrides.manifest.json`](overrides.manifest.json)——emit 生成器与 `os-init spor` 自检表的单一 SOT。

## 用法

### 通用

1. 从 oscaner marketplace 安装 `superpowers`、`superpowers-overrides`、`engineering`、`mattpocock-skills`。
2. 每个项目运行 **`os-init spor`**（插件升级后重跑）。
3. 照常调用 upstream superpowers skill——路由器自动路由。

### Claude Code

- 工作流：`/superpowers:brainstorming`、`/superpowers:writing-plans` …
- Init：`/os-init spor` → 写入项目 `CLAUDE.md` self-check 块。

### Cursor

- 工作流：bare upstream slash（`/brainstorming`）或 rules 拦截。
- Init：`os-init spor` → 写入 `.cursor/rules/superpowers-overrides.mdc`。
- Hooks：从 marketplace 安装插件即可——detect/enforce 随插件发布；**不要**添加项目 `.cursor/hooks.json`。
- 详见 [cross-harness-overrides.md](docs/cross-harness-overrides.md)。

### Manual skill attach（手动附加 skill）

**推荐：**

- 使用 bare upstream slash（`/brainstorming`）——hooks + rules 自动路由。
- 需要 inline 上下文时 attach **engineering `os-*`** skill 文件（如 `os-brainstorming/SKILL.md`）。

**禁止：**

- Attach upstream `superpowers/*/SKILL.md` 正文——内联 upstream checklist 会压过路由纪律（即使 hooks 已触发）。应改用 slash 或 agent skills 列表。

Hook 与 enforcement 脚本 **随 plugin 安装**（与 upstream `superpowers` 同模式）。路由器不应在 consumer 项目里新增 hook 文件。

## CDD CLI harness 脚本

Token-efficient CDD 编排通过 plugin 内脚本 dispatch——`os-executing-plans` 编排，`cli-driven-development` 驱动 harness 链。Orchestrator 只解析一次 harness；唯一 CLI runner 是 `engineering/bin/engine/cdd-run.sh`。

| Harness | CLI 二进制 | 实现级别 |
|---------|------------|----------|
| **claude** | `claude` | **Full** — `claude -p … --output-format text --dangerously-skip-permissions` |
| **cursor-agent** | `cursor-agent` | **Full** — `cursor-agent --print --output-format text --force` |
| **droid** | `droid` | **Full** — `droid exec --auto medium --output-format stream-json` |
| **pi** | `pi` | **Full** — `pi -p --no-session --no-approve` |
| **codex** | `codex` | **Not-supported** — exit 1 BLOCKED |
| **copilot** | `copilot` | **Not-supported** — exit 1 BLOCKED |
| **gemini** | `gemini` | **Not-supported** — exit 1 BLOCKED |

共享库：`engineering/bin/engine/lib/cdd-common.sh`（workspace 路径、plugin root 解析、exit code）承载 task/plan run-loop（`cdd_run_task` / `cdd_run_plan`）；`engineering/bin/engine/cdd-run.sh` 是唯一 CLI runner（`--harness <name> --task N --mode M` | `--plan <path>`）。

**Mode A（单 task）：** `{engineering}/bin/engine/cdd-run.sh --harness <name> --task N --mode implement|review|fix`

**Mode B（plan driver / AFK）：** `{engineering}/bin/engine/cdd-run.sh --harness <name> --plan <path>` — pending tasks × 3-mode 链。

Not-supported harness → exit 1 → orchestrator **BLOCKED**（非 in-session p0 fallback）。CLI 缺失 → exit 2 → orchestrator **BLOCKED**。详见 [cross-harness-overrides.md](docs/cross-harness-overrides.md#cdd-cli-harness-scripts-p1)。

## 维护者文档

- [cross-harness-overrides.md](docs/cross-harness-overrides.md)
- [CLAUDE.md](../../CLAUDE.md) — override 模式、贡献指南
- [CHANGELOG.md](CHANGELOG.md)

## 许可

[MIT](LICENSE)
