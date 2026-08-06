# Design: spor-report-issue Skill

**日期：** 2026-08-06  
**范围：** superpowers-overrides plugin — 新增独立 skill `spor-report-issue`；新增 `.github/ISSUE_TEMPLATE/` 模板

---

## 背景

在用 spor 工具链开发功能的过程中，开发者会遇到工具 bug、流程不顺畅的地方或可优化的点。目前需要手动分析 session 记录、手动构造 issue body、手动检查已有 issue 再决定新建还是 comment——繁琐且容易遗漏。

`spor-report-issue` 将这个流程标准化：一条命令分析、汇总、提交，并保持 issue 格式一致。

---

## 目标

- 手动触发（`/spor-report-issue`），用户显式决定何时上报
- 自动从对话上下文 + ledger + git log 三源归纳问题
- 重复检测：先匹配已有 issue，再决定 comment 还是新建
- issue 语言跟随用户当前 session 语言
- `.github/ISSUE_TEMPLATE/` 和 SKILL.md 内嵌 CLI 模板字段结构完全一致

---

## 文件变更清单

### 新增

```
plugins/superpowers-overrides/
└── skills/
    └── spor-report-issue/
        └── SKILL.md

.github/
└── ISSUE_TEMPLATE/
    ├── bug_report.yml
    └── enhancement.yml
```

### 修改

| 文件 | 变更 |
|------|------|
| `plugins/superpowers-overrides/.claude-plugin/plugin.json` | 注册 `./skills/spor-report-issue`（与 `spor-subagent-lifecycle`、`spor-handoff-writer` 同方式，仅加入 `skills` 数组） |
| `plugins/superpowers-overrides/overrides.manifest.json` | **无需修改**。manifest schema 要求每条目必须有 `overrides` 字段（`plugin:skill` 格式），standalone skill 不入 manifest，只注册到 `plugin.json` |
| `README.md` | 添加 skill 说明行 |

---

## Skill 设计

### 定位

`spor-report-issue` 是 **standalone skill**（不 override 任何上游 skill），与 `spor-subagent-lifecycle`、`spor-handoff-writer` 同类。不需要加入 override 触发机制，直接通过 `/spor-report-issue` 调用。

### 触发

手动调用：`/spor-report-issue` 或 `/superpowers-overrides:spor-report-issue`。

### 五阶段执行流程

#### 阶段 1 — 收集信息

三个信息源，按优先级：

1. **对话上下文**（最直接）：当前 session 的工具调用记录、错误信息、handoff 状态、review 发现的 findings
2. **Ledger**：读 `.superpowers/sdd/*/progress.md`，提取 fix round、BLOCKED、parked、deferred minor 条目
3. **Git log**：`git log $(git merge-base HEAD origin/main)..HEAD --oneline`（以 `origin/main` 为基准，识别 fix round 提交（`fix:` 前缀）和异常提交模式；若 `origin/main` 不可用则回退到 `git log -20 --oneline`）

#### 阶段 2 — 分类归纳（Claude 推理）

归纳为两类：

| 类型 | 判断标准 | GitHub label |
|------|----------|-------------|
| `bug` | 工具/脚本行为与预期不符（timeout、exit code 错误、gate 误判、handoff 格式错误等） | `bug` |
| `enhancement` | 流程可改进但未出错（DX 优化、文档缺失、CI 覆盖不足、模板字段不完整等） | `enhancement` |

每条问题包含：
- 标题（简短、可作为 issue title）
- 一句话描述
- 受影响的组件（skill 名、脚本路径、命令）
- 证据（来自 session 的具体错误信息或 ledger 条目）

#### 阶段 3 — 展示汇总，用户确认

以列表形式展示归纳结果，询问用户：
- 整体是否准确？
- 有无需要删减或补充的条目？

用户确认后进入逐条处理。

#### 阶段 4 — 逐条处理（重复检测 + 提交）

对每条问题：

1. `gh issue list --state open --limit 100 --json number,title,body` → 用关键词匹配标题和 body
2. 找到相似 issue → 展示候选列表，询问用户：
   - **新建 issue**：用模板构造 body，`gh issue create`
   - **往已有 issue 加 comment**：`gh issue comment <number>`
   - **跳过**：记录但不提交
3. 按用户选择执行

**语言规则：** issue title 和 body 使用当前 session 语言。检测方式：看用户在**当前 session 中最近几条消息**使用的语言，以最后一条用户消息的语言为准。若 session 为混合语言（如问题描述用英文、对话用中文），以对话语言（中文）为准。回退默认：英文。

**重复检测机制：**
1. `gh issue list --state open --limit 100 --json number,title,body` 获取所有开放 issue
2. 对每条待提交问题，提取**受影响组件名**（如 `sdd-run-task-claude.sh`、`handoff-writer`、`gate`）和**核心行为词**（如 `timeout`、`CHANGES_REQUESTED`、`exit 137`）作为关键词
3. 在已有 issue 的 title 和 body 中做**大小写不敏感的子串匹配**
4. 匹配到任意一条 → 展示候选列表，询问用户：**新建 / comment / 跳过**；无匹配 → 询问用户：**新建 / 跳过**

**Labels 策略：**

| label | 来源 |
|-------|------|
| `bug` 或 `enhancement` | 按问题类型固定 |
| `dogfood` | skill 自动添加（所有 spor-report-issue 提交的 issue 都是 dogfood）|
| `superpowers-overrides` | skill 自动添加（硬编码当前 plugin 名；未来其他 plugin 复制时修改此处）|
| `sdd` | 按内容判断：涉及 SDD（Subagent-Driven Development）/ H6 CLI 链 / orchestrator / handoff 时追加 |

#### 阶段 5 — 最终汇报

打印所有操作结果：
- 新建 issue → URL
- 新增 comment → URL
- 跳过 → 列表

---

## Issue Body 模板

SKILL.md 内嵌两个 CLI 模板（中英双语各一套，按 session 语言选择）。

### Bug Template（英文版）

```markdown
## Context

<dogfood session context — branch, date, which spor skills were in use>

## Problem

<what happened, with exact error messages or tool output where available>

## Impact

<what this blocked or degraded — token cost, extra rounds, incorrect state>

## Suggested fix

<concrete suggestion if any; otherwise "Under investigation">

## Related

<links to related issues or commits if known>
```

### Bug Template（中文版）

```markdown
## 背景

<Dogfood session 上下文 — 分支、日期、使用了哪些 spor skill>

## 问题

<发生了什么，尽量附上具体报错信息或工具输出>

## 影响

<阻塞或降级了什么——token 消耗、额外轮次、状态错误等>

## 建议修复

<具体建议；若暂不清楚则写"待排查">

## 相关

<相关 issue 链接或 commit，如有>
```

### Enhancement Template（英文版）

```markdown
## Context

<dogfood session context — branch, date, which spor skills were in use>

## Current behavior

<what happens today>

## Desired behavior

<what should happen instead>

## Suggested approach

<concrete suggestion if any; otherwise "Open for discussion">

## Related

<links to related issues or commits if known>
```

### Enhancement Template（中文版）

```markdown
## 背景

<Dogfood session 上下文 — 分支、日期、使用了哪些 spor skill>

## 当前行为

<目前的实际表现>

## 期望行为

<应该是什么表现>

## 建议方案

<具体建议；若暂不清楚则写"欢迎讨论">

## 相关

<相关 issue 链接或 commit，如有>
```

---

## GitHub ISSUE_TEMPLATE 文件设计

### `bug_report.yml`

- `name`: Bug report
- `description`: Report a bug found while using spor skills
- `labels`: `["bug"]`（其余 label 由 skill 通过 `gh issue create --label` 动态追加；通过 GitHub web UI 使用此模板创建的 issue 仅有 `bug` label，不含 `dogfood`/`superpowers-overrides`——web UI 路径属于手动上报，label 由用户自行补充）
- 字段：**Context**、**Problem**、**Impact**、**Suggested fix**、**Related**
- 字段结构与 SKILL.md Bug Template 完全一致

### `enhancement.yml`

- `name`: Enhancement
- `description`: Suggest an improvement to spor skills or workflow
- `labels`: `["enhancement"]`（同 bug_report.yml，web UI 路径 label 由用户自行补充）
- 字段：**Context**、**Current behavior**、**Desired behavior**、**Suggested approach**、**Related**
- 字段结构与 SKILL.md Enhancement Template 完全一致

### `config.yml`

删除。`blank_issues_enabled: false` 只影响 GitHub web UI，对 skill CLI 路径无任何贡献，属于非目标范围的限制。不新增此文件。

---

## 非目标

- **不** 自动触发（finishing-a-development-branch 结束时不自动推荐）
- **不** 处理 submodule-bump 类 issue（与 dogfood 无关）
- **不** 支持 Linear / Jira 等其他 tracker（只针对 GitHub）
- **不** 分析历史 session（只看当前 session 上下文）

---

## 成功标准

1. `/spor-report-issue` 触发后，skill 能从对话上下文 + ledger + git log 归纳出有意义的问题列表
2. 每条问题提交前都经过 `gh issue list` 重复检测
3. 新建 issue 的 body 结构与 `.github/ISSUE_TEMPLATE/` 模板字段一致
4. Labels 按策略正确附加（`bug`/`enhancement` + `dogfood` + `superpowers-overrides` + 可选 `sdd`）
5. Issue 语言与 session 语言一致
6. `pnpm run validate` 通过
