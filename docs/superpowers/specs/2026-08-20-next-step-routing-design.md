# Next-Step Routing 修复 + Mode Selection 强化

> **版本:** 1.1  
> **状态:** 草稿  
> **依赖:** 无  
> **扫描范围:** 全部 13 个 osuperpowers skills（brainstorming, cli-code-review, cli-driven-development, cli-select, cli-task, code-review, debugging, executing-plans, finishing, init, report-issue, verification, writing-plans）

## 问题

### Q1: 路由泄漏

osuperpowers 体系的 skill 完成当前阶段后，下一步路由指向了上游 `superpowers:*` 而非 `osuperpowers:*`。具体：

| 文件 | 泄漏位置 | 上游目标 | 应指向 |
|------|----------|----------|--------|
| `brainstorming/SKILL.md` | Rule: Write Design Doc → `writing-plans`（裸名，可能解析到上游） | `superpowers:writing-plans` | `osuperpowers:writing-plans` |
| `writing-plans/SKILL.md` | upstream `superpowers:writing-plans` Execution Handoff | `superpowers:subagent-driven-development` / `superpowers:executing-plans` | `osuperpowers:executing-plans` |
| `executing-plans/SKILL.md` | Rule: Orchestrator Checklist Final 步骤 | `requesting-code-review` + `finishing-a-development-branch`（上游裸名） | `osuperpowers:code-review` + `osuperpowers:finishing` |

其余 10 个 skills（cli-code-review, cli-driven-development, cli-select, cli-task, code-review, debugging, finishing, init, report-issue, verification）经逐文件人工检查，不存在路由泄漏。

### Q2: Mode Selection 被跳过（#159）

executing-plans 收到 plan 后不调用 AskUserQuestion 进行模式选择，用户从 writing-plans handoff 预选的 subagent 模式被无视，直接以 in-session 模式执行。

### Q3: grilling 子技能读取语义模糊

brainstorming Rule: Read Sub-Skills 的 "On demand" 措辞暗示 grilling 委派是可选的，实际应为强制步骤。遮挡了 #162 报告的多次流程跳过问题。

## 术语定义

### HARD-GATE

HARD-GATE 是 osuperpowers SKILL.md 中的最高优先级指令约束。格式：用 `<HARD-GATE>...</HARD-GATE>` 标签包裹规则正文。语义：orchestrator 必须在任何工具调用之前检查该 Gate 的条件是否满足，不满足则不得执行下一步。它不依赖 hook 或运行时，是 agent 指令层的一等约束——与上游 `superpowers:brainstorming` 的 HARD-GATE 同一定义。

### Red Flag

Red Flag 是 SKILL.md 底部的关键词/模式列表，每条形如 `"<触发模式>" -> <应执行动作>`。它是 orchestrator 的运行时检查清单，当 agent 发现自己的行为匹配触发模式时应立即停止并执行对应动作。Red Flag 是规则层（Rules）的补充拦截：规则声明正向流程，Red Flag 拦截已知的负向偏离。

### "停止任务"（grilling Load Failure）

`Rule: Read Sub-Skills` 中 grilling 子技能读取失败的行为：输出错误消息（格式：`[OS-BRAINSTORMING] 子技能加载失败：<path>`），**询问用户下一步**（不硬停止——用户可决定绕过 grilling 继续，或中止流程）。不区分"目标文件缺失"与"entire submodule 缺失"，所有失败场景行为统一。

## 修复策略

采用"Next-Step Routing 规则 + Red Flags"方案。每个有路由关系的 skill 增加一条显式 `Rule: Next-Step Routing`，声明下一步应调用的 osuperpowers skill 名称；Red Flags 作为关键词拦截的补充防线。不修改 hook、engine 或上游 submodule。

## 具体改动

### F1: brainstorming/SKILL.md

**Rule: Read Sub-Skills（修改现有规则）：**

```
### Rule: Read Sub-Skills

**必须**读取 `mattpocock-skills` `skills/productivity/grilling/SKILL.md`（强制步骤——clarification question 委托）。读取失败（文件不存在/读取错误）→ **停止任务**，输出错误消息后返回控制权给调用方。

Load failure protocol: see [subagent-lifecycle.md](../docs/subagent-lifecycle.md#rule-delegate-load-failure)。
```

**新增 Rule: Next-Step Routing（置于 Rule: Write Design Doc 之后）：**

```
### Rule: Next-Step Routing

After brainstorming completes, invoke **`osuperpowers:writing-plans`** (not upstream `superpowers:writing-plans`). The osuperpowers wrapper adds section-by-section writing, cli review passes, and ticket publish redirect on top of the upstream baseline.
```

**新增 Red Flag：**
- `"Invoke writing-plans / superpowers:writing-plans"` -> invoke **`osuperpowers:writing-plans`** 替代（Rule: Next-Step Routing）

### F2: writing-plans/SKILL.md

**新增 Rule: Next-Step Routing（置于 Rule: Tickets Publish Redirect 之后）：**

```
### Rule: Next-Step Routing

After plan review passes, invoke **`osuperpowers:executing-plans`** (not upstream `superpowers:subagent-driven-development` or `superpowers:executing-plans`). `osuperpowers:executing-plans` is the single entry point — it handles mode selection (in-session / subagent / cli) internally, applies osuperpowers-specific rules (Task Complexity, Confirm Once, Fix Loop, Confirm Seams, Per-Task Review, Quality Invariants, D6 Aggregation, Ledger), and routes to the correct execution path.

**Execution handoff text:**

> "Plan complete and saved to `docs/superpowers/plans/<filename>.md`. Ready to execute — I'll hand off to `osuperpowers:executing-plans` for mode selection and execution."

Do NOT offer a subagent-vs-inline choice — `osuperpowers:executing-plans` does that.
```

**新增 Red Flags：**
- `"Invoke superpowers:subagent-driven-development / superpowers:executing-plans"` -> invoke **`osuperpowers:executing-plans`** 替代（Rule: Next-Step Routing）
- `"Offer subagent vs inline choice"` -> `osuperpowers:executing-plans` 处理模式选择（Rule: Next-Step Routing）

### F3: executing-plans/SKILL.md

**Rule: Mode Selection（加 HARD-GATE 包裹）：**

```
### Rule: Mode Selection

<HARD-GATE>
At startup, BEFORE any other action (before reading plan, before setup, before ANY tool call that touches the repo), use `AskUserQuestion` to let the user choose a mode (in-session | subagent | cli). Do NOT accept a mode pre-selection from a prior skill's handoff — the orchestrator always asks directly. After selection, call `cdd-session-activate.mjs minimal <session_key> <repo_root> --mode <mode>` to write `pending.mode`.
</HARD-GATE>
```

**Line 58 Final 步骤路由修复（Rule: Orchestrator Checklist）：**

- `requesting-code-review` → `[osuperpowers:code-review](../code-review/SKILL.md)`
- `finishing-a-development-branch` → `[osuperpowers:finishing](../finishing/SKILL.md)`

**新增 Red Flags：**
- `"User already chose subagent/inline in writing-plans handoff"` -> Mode Selection 是 HARD-GATE，必须重新询问（Rule: Mode Selection）
- `"Start executing without calling AskUserQuestion"` -> Mode Selection 必须是第一个动作（Rule: Mode Selection）
- `"Load from state with prior mode selection"` -> 从 session 上下文恢复时，如果发现已有模式选择记录，仍须重新调用 `AskUserQuestion`——不信任跨-turn 的模式选择缓存（Rule: Mode Selection HARD-GATE）
- `"Use superpowers:subagent-driven-development / superpowers:executing-plans"` -> 从上游 subagent-driven-development 文本读取到的 `superpowers:*` 技能引用均需替换为 osuperpowers 版本

### Pending.mode 输出路径

执行 `cdd-session-activate.mjs`（路径：`packages/osuperpowers/bin/engine/`）写入 `pending.mode`，位置由 engine 自动推导（当前 repo root `/Users/oscaner/Projects/oscaner-skills/.superpowers/`）。此文件已存在，不需要额外创建脚本。

## 边缘情况

| 场景 | 处理 |
|------|------|
| upstream `superpowers:brainstorming` 不在安装中（非 claude harness） | brainstorming 的 Next-Step Routing 仍路由到 `osuperpowers:writing-plans`——不需要上游安装 |
| upstream 更新后 Execution Handoff 内容变化 | writing-plans SKILL.md 的 Next-Step Routing 覆盖上游 handoff——上游内容变化不影响路由 |
| 用户明确要求使用 upstream skill | 用户偏好优先于默认路由——Red Flag 触发时应询问用户意图 |
| executing-plans 收到 "subagent" 预选标记 | HARD-GATE 覆盖预选——必须通过 AskUserQuestion 重新确认 |

## 验证条件

1. `brainstorming/SKILL.md` 包含 Rule: Next-Step Routing + 对应 Red Flag
2. `writing-plans/SKILL.md` 包含 Rule: Next-Step Routing + 替换后的 Execution Handoff + 对应 Red Flags
3. `executing-plans/SKILL.md` 的 Mode Selection 包含 HARD-GATE 包裹 + Orchestrator Checklist Final 步骤路由已修复 + 对应 Red Flags
4. `pnpm run emit:check` 通过（manifest 一致性）
5. `pnpm run validate` 通过（完整验证套件）
6. executing-plans 三种模式（in-session / subagent / cli）均能通过 `AskUserQuestion` 被正确选中，`cdd-session-activate.mjs minimal <session_key> <repo_root> --mode <mode>` 正确写入对应 `pending.mode`