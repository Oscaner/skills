# Next-Step Routing 修复 + Mode Selection 强化 Implementation Plan

> **对于 agentic workers:** REQUIRED SUB-SKILL: Use `osuperpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 osuperpowers 体系下的 next-step routing 泄漏（brainstorming → writing-plans → executing-plans 链路上游引用）并强化 executing-plans Mode Selection 的 HARD-GATE 约束。

**Architecture:** 4 个文件的显式修改 + 自动 manifest 刷新，不涉及 engine 代码或上游 submodule 改动。

**Tech Stack:** SKILL.md（Markdown），subagent-lifecycle.md（Markdown），`pnpm run emit`

## Global Constraints

- 不修改 `vendors/` 下任何文件（上游 submodule）
- 不修改任何 engine 代码（`bin/engine/`）
- `subagent-lifecycle.md` 的 Rule: Delegate Load Failure 行为必须统一（不区分"目标缺失"与"插件缺失"）
- `brainstorming/SKILL.md` `Rule: Read Sub-Skills` 必须改为强制读取语义
- `executing-plans/SKILL.md` `Rule: Mode Selection` 必须包裹 `<HARD-GATE>`
- 修改后 `pnpm run emit` + `pnpm run validate` 必须通过

---

## Task Structure

### Task 1: brainstorming/SKILL.md — 强化 Read Sub-Skills + 新增 Next-Step Routing

**Files:**
- Modify: `packages/osuperpowers/skills/brainstorming/SKILL.md:22-24` — Rule: Read Sub-Skills
- Modify: `packages/osuperpowers/skills/brainstorming/SKILL.md:62-71` — 新增 Rule: Next-Step Routing + Red Flag

**Interfaces:**
- Consumes: spec §F1
- Produces: brainstorming 完成后路由到 `osuperpowers:writing-plans`

- [ ] **Step 1: 修改 Rule: Read Sub-Skills**

替换原文为

```
### Rule: Read Sub-Skills

**必须**读取 `mattpocock-skills` `skills/productivity/grilling/SKILL.md`（强制步骤——clarification question 委托）。
读取失败（文件不存在/读取错误）→ **报告错误 + 询问用户下一步**，
用户可决定绕过 grilling 继续或中止流程。所有失败场景行为统一。
Load failure protocol: see [subagent-lifecycle.md](../docs/subagent-lifecycle.md#rule-delegate-load-failure).
```

- [ ] **Step 2: 新增 Rule: Next-Step Routing + Red Flag**

在 `Rule: Spec Review via CLI` 之后、`Rule: Write Design Doc` 之前插入 Next-Step Routing：

```
### Rule: Next-Step Routing

After brainstorming completes, invoke **`osuperpowers:writing-plans`** (not upstream `superpowers:writing-plans`). The osuperpowers wrapper adds section-by-section writing, cli review passes, and ticket publish redirect on top of the upstream baseline.
```

在 Red Flags 列表末尾追加（注意格式与现有条目一致——使用 `- "..." -> ...` 格式）：

```markdown
- "Invoke writing-plans / superpowers:writing-plans" -> invoke **`osuperpowers:writing-plans`** (Rule: Next-Step Routing)
```

- [ ] **Step 3: 验证**

检查 `packages/osuperpowers/skills/brainstorming/SKILL.md` 结构：Rule: Read Sub-Skills 已改为强制语义，Next-Step Routing 规则存在，Red Flag 存在。

---

### Task 2: writing-plans/SKILL.md — 新增 Next-Step Routing + 替换 Execution Handoff

**Files:**
- Modify: `packages/osuperpowers/skills/writing-plans/SKILL.md:30-37` — 新增 Rule: Next-Step Routing + Red Flags

**Interfaces:**
- Consumes: spec §F2
- Produces: writing-plans 完成后路由到 `osuperpowers:executing-plans`

- [ ] **Step 1: 新增 Rule: Next-Step Routing**

在 `Rule: Tickets Publish Redirect` 之后插入：

```markdown
### Rule: Next-Step Routing

After plan review passes, invoke **`osuperpowers:executing-plans`** (not upstream `superpowers:subagent-driven-development` or `superpowers:executing-plans`). `osuperpowers:executing-plans` is the single entry point — it handles mode selection (in-session / subagent / cli) internally, applies osuperpowers-specific rules (Task Complexity, Confirm Once, Fix Loop, Confirm Seams, Per-Task Review, Quality Invariants, D6 Aggregation, Ledger), and routes to the correct execution path.

**Execution handoff text:**

> "Plan complete and saved to `docs/superpowers/plans/<filename>.md`. Ready to execute — I'll hand off to `osuperpowers:executing-plans` for mode selection and execution."

Do NOT offer a subagent-vs-inline choice — `osuperpowers:executing-plans` does that.
```

- [ ] **Step 2: 新增 Red Flags**

```markdown
- "Invoke superpowers:subagent-driven-development / superpowers:executing-plans" -> invoke **`osuperpowers:executing-plans`** (Rule: Next-Step Routing)
- "Offer subagent vs inline choice" -> `osuperpowers:executing-plans` handles mode selection (Rule: Next-Step Routing)
```

- [ ] **Step 3: 验证**

检查 writing-plans/SKILL.md：Next-Step Routing 规则存在，handoff text 不包含 subagent/inline 二选一，Red Flags 存在。

---

### Task 3: executing-plans/SKILL.md — Mode Selection HARD-GATE + 路由修复 + Red Flags

**Files:**
- Modify: `packages/osuperpowers/skills/executing-plans/SKILL.md` — Mode Selection 加 HARD-GATE
- Modify: `packages/osuperpowers/skills/executing-plans/SKILL.md` — Final 步骤路由（requesting-code-review + finishing-a-development-branch → osuperpowers 版本）
- Modify: `packages/osuperpowers/skills/executing-plans/SKILL.md` — 新增 Red Flags

**Interfaces:**
- Consumes: spec §F3
- Produces: executing-plans 启动时强制 AskUserQuestion + Final 步骤路由到 osuperpowers:code-review 和 osuperpowers:finishing

- [ ] **Step 1: Mode Selection 加 HARD-GATE 包裹**

将原文：

```
### Rule: Mode Selection

At startup, use `AskUserQuestion` to let the user choose a mode (in-session | subagent | cli). After selection, call `cdd-session-activate.mjs minimal <session_key> <repo_root> --mode <mode>` to write `pending.mode`.
```

替换为：

```
### Rule: Mode Selection

<HARD-GATE>
At startup, BEFORE any other action (before reading plan, before setup, before ANY tool call that touches the repo), use `AskUserQuestion` to let the user choose a mode (in-session | subagent | cli). Do NOT accept a mode pre-selection from a prior skill's handoff — the orchestrator always asks directly. After selection, call `cdd-session-activate.mjs minimal <session_key> <repo_root> --mode <mode>` to write `pending.mode`.
</HARD-GATE>
```

- [ ] **Step 2: Final 步骤路由修复**

将 Rule: Orchestrator Checklist Final 步骤中的：

```
**Final:** `requesting-code-review` whole-branch in-session -> clean -> `finishing-a-development-branch`.
```

替换为：

```
**Final:** [osuperpowers:code-review](../code-review/SKILL.md) whole-branch in-session -> clean -> [osuperpowers:finishing](../finishing/SKILL.md).
```

- [ ] **Step 3: 新增 Red Flags**

在现有 Red Flags 列表末尾追加：

```
- "User already chose subagent/inline in writing-plans handoff" -> Mode Selection is a HARD-GATE, always ask directly (Rule: Mode Selection)
- "Start executing without calling AskUserQuestion" -> Mode Selection must be the first action, before any repo tool call (Rule: Mode Selection)
- "Load from state with prior mode selection" -> session restored with cached mode must still call AskUserQuestion (Rule: Mode Selection)
- "Use superpowers:subagent-driven-development / superpowers:executing-plans" -> upstream subagent-driven-development references to superpowers:* must be explicitly mapped to osuperpowers counterparts (the plan's own Next-Step Routing rule governs this)
```

- [ ] **Step 4: 验证**

检查 executing-plans/SKILL.md：Mode Selection 有 HARD-GATE 包裹，Final 步骤路由正确指向 osuperpowers:*，Red Flags 包含 4 条新条目。

---

### Task 4: subagent-lifecycle.md — 统一 Delegate Load Failure 行为

**Files:**
- Modify: `packages/osuperpowers/docs/subagent-lifecycle.md` — Rule: Delegate Load Failure

**Interfaces:**
- Consumes: spec §术语定义
- Produces: 所有失败场景行为统一（报告错误 + 询问用户下一步）

- [ ] **Step 1: 修改 Rule: Delegate Load Failure**

将原文：

```
### Rule: Delegate Load Failure

When delegating to `mattpocock-skills:*` fails: target skill cannot be resolved/loaded → report the error to the user and ask for next steps (do not silently skip the delegation); entire plugin is missing → silent degradation (that delegation step is skipped, the flow continues, the result is annotated as "not delegated"). Cited by delegation rules in debugging (→ diagnosing-bugs), code-review (→ grilling/tdd), writing-plans (→ to-tickets), brainstorming (→ grilling).
```

替换为：

```
### Rule: Delegate Load Failure

When delegating to a sub-skill (`mattpocock-skills:*` or any skill referenced in Read Sub-Skills) fails: target skill cannot be resolved/loaded → report the error to the user and ask for next steps. All failure scenarios behave identically — no silent degradation. The user can decide to skip the delegation or abort the flow. Cited by delegation rules in debugging (→ diagnosing-bugs), code-review (→ grilling/tdd), writing-plans (→ to-tickets), brainstorming (→ grilling).
```

- [ ] **Step 2: 验证**

检查 subagent-lifecycle.md：不再区分"目标缺失"与"插件缺失"两种行为。

---

### Task 5: emit + validate

**Files:**
- Auto: `.agents/` 下所有 manifest 文件

**Interfaces:**
- Consumes: 前 4 个 Task 完成的文件修改
- Produces: 同步后的 manifest 文件，验证通过

- [ ] **Step 1: 运行 `pnpm run emit`**

Expected: `OK — emitted unified first-party manifests`

- [ ] **Step 2: 运行 `pnpm run validate`**

Expected: 所有验证模块通过。

**注意：** Red Flag 引用 `Rule: Mode Selection`（非 `Rule: Mode Selection HARD-GATE`），HARD-GATE 不是 heading 的一部分，避免 rule-reference test 报 dangling。

- [ ] **Step 3: 如果 validate 失败，修复后重试**

- [ ] **Step 4: 手动验证 spec 条件 #6**

验证三种模式（in-session / subagent / cli）均能通过 `executing-plans` 的 `AskUserQuestion` 被选中并正确写入 `pending.mode`：

```bash
# 验证 cdd-session-activate.mjs 可执行
node packages/osuperpowers/bin/engine/cdd-session-activate.mjs --help 2>&1 | head -5

# 确认脚本存在且可调用
test -f packages/osuperpowers/bin/engine/cdd-session-activate.mjs && echo "OK: script exists"
```

手动验证：触发 executing-plans 后应看到 AskUserQuestion 弹出三种模式选择。

- [ ] **Step 5: Commit**

```bash
git add packages/osuperpowers/skills/brainstorming/SKILL.md
git add packages/osuperpowers/skills/writing-plans/SKILL.md
git add packages/osuperpowers/skills/executing-plans/SKILL.md
git add packages/osuperpowers/docs/subagent-lifecycle.md
git add packages/osuperpowers/.agents/
git commit -m "feat: add next-step routing rules and strengthen Mode Selection HARD-GATE"
```

---