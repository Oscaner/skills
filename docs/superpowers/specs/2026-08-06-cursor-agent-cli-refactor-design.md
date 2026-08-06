# Design: cursor-agent CLI 重构

**日期：** 2026-08-06  
**范围：** superpowers-overrides plugin — spor-subagent-driven-development SKILL.md；impeccable plugin — sdd-run 脚本、smoke 测试、hooks 文档

---

## 背景

Cursor 官方提供了两个 agent CLI 入口：

- `cursor agent`：随 Cursor 编辑器安装，版本绑定编辑器，不稳定
- `cursor-agent`：官方独立 agent CLI，稳定，适合自动化/CI 场景

当前代码库混用了 `cursor agent`（编辑器版）以及依赖 p0 fallback 降级链的 SDD 逻辑，两者都需要清理。

---

## 变更 A — spor-subagent-driven-development SKILL.md 精简

### 目标

删除 p0 fallback 路径，强制使用 CLI，无法使用时明确报错而非静默降级。

### 删除内容

- **Rule 0b**（p0 fallback 整块）：包含 `Triggers when Rule 7 item 2 applies`、announce 行、`spor-sdd-p0-fallback` 引用
- **Rule 0a/0b 标签**：合并回单一 `Rule 0`，保留 CLI-default 逻辑和 orchestrator checklist
- **Rule 7 item 2 中的 opt-out 触发器**：`--no-cli` / `SDD_NO_CLI=1` / config `"cli": false`
- **Rule 7 item 2 中的降级动作**：`→ p0 Rule 0b → spor-sdd-p0-fallback` 替换为 `→ BLOCKED，报告原因`
- **所有 `spor-sdd-p0-fallback` 链接引用**
- **Red Flags 过时条目**：
  - `"Exit 2 means stop the plan."`——新行为是 exit 2 → 显式 BLOCKED + 报告原因（非静默停止），此条目描述的是"误以为 exit 2 会默默终止计划"的错误认知，已由新 Rule 7 item 2 的明确措辞取代，保留反而引起歧义
  - `"p0 fallback — skip the announce line."`
- **Common Rationalizations 过时条目**：
  - `"Rule 7 only applies when user asks for CLI"` — opt-out 不复存在，此行失效

### 新增/改写内容

**Rule 7 item 2 改写为：**

> CLI unavailable (script exit **2**) or script not found → orchestrator **BLOCKED**. Report: script path attempted, harness, exit code. Do not fall back to in-session execution.

**Rule 0（合并后）结构：**

```
Rule 0 — Path: CLI-mandatory (p1)

1. This session MUST NOT Read/Skill upstream subagent-driven-development skill body.
2. [原 Rule 0a 全部保留：Allowed shell-invoke、Pointers、orchestrator checklist]
```

### 保留内容不变

- Rule 0 中"不得 Read 上游 SDD skill body"禁令
- Rule 0 orchestrator checklist（compact，所有步骤）
- Rule 1（task complexity）
- Rule 2（fix loop cap 5）
- Rule 4（cheaper models）— 注：Rule 3 在当前 SKILL.md 中不存在，编号直接从 Rule 2 跳到 Rule 4，保持不变
- Rule 5（per-task review）
- Rule 6（quality invariants）
- Rule 7 items 1、3、4、5

---

## 变更 B — cursor-agent 重命名

### 目标

将所有对 `cursor agent`（编辑器版 CLI）的调用替换为 `cursor-agent`（独立 CLI）。

### 文件变更清单

#### `plugins/impeccable/scripts/smoke-provider-hooks.mjs`

| 位置 | 旧 | 新 |
|------|----|----|
| `runCursorProviderSmoke` — `run(...)` 调用 | `run('agent', [...])` | `run('cursor-agent', [...])` |
| `runAgentChoiceCursor` — `run(...)` 调用 | `run('agent', [...])` | `run('cursor-agent', [...])` |
| `ensureCursorAgent` — version check | `run('agent', ['--version'], ...)` | `run('cursor-agent', ['--version'], ...)` |
| `ensureCursorAgent` — 认证错误信息（出现两处，约 L668 和 L845） | `` `agent login` `` | `` `cursor-agent login` `` |

> **注：** `ensureCursorAgent` 的安装命令是 `curl https://cursor.com/install -fsS | bash`，不含 `agent` 字面量，无需修改。

#### `plugins/superpowers-overrides/bin/sdd-run-task-cursor.sh`

| 位置 | 旧 | 新 |
|------|----|----|
| CLI 存在性检测 | `command -v cursor` | `command -v cursor-agent` |
| CLI 调用 | `cursor agent --print --output-format text --force "$prompt"` | `cursor-agent --print --output-format text --force "$prompt"` |
| 脚本头部注释 source of truth 行 | `cursor agent --print --output-format text --force "$prompt"` | `cursor-agent --print --output-format text --force "$prompt"` |
| `sdd_exit_cli_missing` 错误信息 | `cursor not found in PATH` | `cursor-agent not found in PATH` |

#### `plugins/superpowers-overrides/bin/sdd-run-plan-cursor.sh`

| 位置 | 旧 | 新 |
|------|----|----|
| CLI 存在性检测 | `command -v cursor` | `command -v cursor-agent` |
| `sdd_exit_cli_missing` 错误信息 | `cursor not found in PATH` | `cursor-agent not found in PATH` |

> **注：** `sdd-run-plan-cursor.sh` 不直接调用 cursor CLI——实际调用委托给 `sdd-run-task-cursor.sh`（`_run_task_mode` 函数）。因此无需改"CLI 调用"行，只需更新存在性检测和错误信息，与 task 脚本对齐。

#### `plugins/impeccable/skill/reference/hooks.md`

经核查，`hooks.md` 中没有 `cursor agent` CLI 命令引用——涉及 Cursor 的内容均为 Settings UI 操作说明（"confirm hooks are enabled under Settings -> Hooks"）和配置文件路径（`.cursor/hooks.json`），不含需要更新的命令行字符串。**此文件无需修改。**

---

## 变更 C — 需求 1（状态可见性）

跳过。由 hedr（harness event-driven renderer，live-server 的浏览器端 agent 状态展示层）满足，无需在本次变更中处理。

---

## 非目标

- 不改动 `spor-sdd-p0-fallback/SKILL.md` 本身（该文件保留，只是不再被 SDD 路径引用；可在后续单独评估是否归档）
- 不改动 `spor-executing-plans`（其 Rule 1 redirect 到 SDD，SDD 改了之后自然生效）
- 不改动 `live-copy-edit-agent.mjs` 中的 claude/codex provider 逻辑

---

## 成功标准

1. `spor-subagent-driven-development` SKILL.md 中不再出现 `p0`、`Rule 0b`、`spor-sdd-p0-fallback`、`opt-out`、`SDD_NO_CLI` 等词
2. CLI 不可用时，SDD 输出 BLOCKED 并报告具体原因，不静默降级
3. `sdd-run-task-cursor.sh` 和 `sdd-run-plan-cursor.sh` 中不再出现 `cursor agent`（空格版）
4. `smoke-provider-hooks.mjs` 中所有 cursor 相关 CLI 调用使用 `cursor-agent`，认证错误信息同步
5. `pnpm run validate` 通过
