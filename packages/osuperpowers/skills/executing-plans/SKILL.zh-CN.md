---
name: executing-plans
description: 独立 plan 执行编排器——用户选择执行模式（in-session / subagent / cli），编排器控制器规则集（11 条语义规则，三种模式共用）。cli 模式委托给 cli-driven-development；in-session/subagent 模式读取对应的上游 skill。
---

# Osuperpowers Executing-Plans

执行已写 plan 的主编排器。用户选择三种模式之一。

<HARD-GATE>
启动时第一个动作必须是 AskUserQuestion 选择模式（in-session | subagent | cli），
在此之前禁止任何 repo tool call。不接受来自先前 skill handoff 的预选模式——编排器必须直接询问。
</HARD-GATE>

## Checklist

1. AskUserQuestion 选择模式（in-session / subagent / cli）
2. 读取对应上游 SKILL.md（Rule: Read Upstream）
3. Setup（workspace / ledger / plan / plan-constraints / pre-flight）
4. Per-task 循环：Task Complexity → Confirm Once → Confirm Seams → 执行 → **Per-Task Review** → ledger
5. D6 Aggregation（deferred items 聚合 → 用户决策）
6. `osuperpowers:code-review` → `osuperpowers:finishing`

## Rules

### Rule: Read Upstream

根据用户选择的模式解析上游（解析优先级 + 不可用回退同 [Rule: Read Upstream](../brainstorming/SKILL.md#rule-read-upstream)）：
- **in-session** → 解析 `executing-plans` SKILL.md 路径，读取作为基线（有上游时）
- **subagent** → 解析 `subagent-driven-development` SKILL.md 路径，读取作为基线（有上游时）
- **cli** → [cli-driven-development](../cli-driven-development/SKILL.md)（Skill-invoke 委托，不读取上游）

基线仅为解析路径指向的 SKILL.md 文件——注入的 vendor 文档不是基线（见 [Rule: Read Upstream](../brainstorming/SKILL.md#rule-read-upstream)）。

### Rule: Mode Selection

<HARD-GATE>
启动时，在任何其他动作之前（在读取 plan 之前、setup 之前、任何接触 repo 的 tool call 之前），使用 `AskUserQuestion` 让用户选择模式（in-session | subagent | cli）。不接受来自先前 skill handoff 的预选模式——编排器必须直接询问。选择后，调用 `cdd-session-activate.mjs minimal <session_key> <repo_root> --mode <mode>` 写入 `pending.mode`。
</HARD-GATE>

<HARD-GATE>
CLI 模式选定后，本 session 禁止使用 Write/Edit 工具修改仓库交付物（所有 git-tracked 文件及 skill 产物）。
所有代码变更必须通过 cdd-task.mjs H6 chain 执行。发现违规立即停止并报告用户。
</HARD-GATE>

### Rule: Task Complexity

先分类每个 task：涉及 1-2 个文件 + 机械性实施 → **Simple**；3+ 个文件 / 跨模块 / 需要设计判断 / 用户要求彻底 → **Complex**。影响 diff 范围、测试门控、模型层级。

### Rule: Confirm Once

spec+plan 完成 → 最低档实施层；在第一次 dispatch 前确认一次。

### Rule: Fix Loop

`CHANGES_REQUESTED` → 修复 → 范围 review → 重复直到 `APPROVED` 或 **5 轮**（超过 → STOP + 上报）。

### Rule: Confirm Seams

在 dispatch tdd implement worker 之前，编排器在 session 中与用户确认测试边界（seam），将确认结果 `CONFIRMED_SEAMS: <...>` 写入 task brief。cli 模式是 fire-and-forget print-mode CLI，不能阻塞——`templates/cdd/implement.md` 应用非阻塞方式（"若 brief 含 `CONFIRMED_SEAMS`，则应用"），seam 确认专属于编排器层。

### Rule: Per-Task Review

<HARD-GATE>
每个 task 实施完成后，必须读取 `$CDD_HANDOFF_PATH`（handoff.json）执行 Per-Task Review 门控，
判定 APPROVED 后才可写入 ledger 并推进下一 task。
禁止跳过 handoff 读取直接进入下一 task 或编译验证。适用于 in-session / subagent / cli 全部模式。
</HARD-GATE>

Per-task review 门控：由 handoff.json 驱动（plan_conflicts → STOP；CHANGES_REQUESTED → Fix Loop；NEEDS_CONTEXT/unverifiable → STOP）。cli 模式 worker review 在 CLI 子进程内运行；in-session/subagent 模式 review 门控在 session 中运行。规程见 [controller-handoff.md](../../docs/controller-handoff.md) H1-H5。

### Rule: Quality Invariants

1. 测试证据门控（task-N-test-evidence.json）
2. plan_conflicts[] → 人工裁决
3. unverifiable[] 非空 → BLOCKED
4. handoff NEEDS_CONTEXT → STOP

### Rule: Orchestrator Checklist

编排器的三阶段循环（三种模式共用骨架；Per-task 中注明 cli 模式差异）：

**Setup（一次）：** in-session/subagent → `sdd-workspace`；cli → 委托 workspace 给 [cli-driven-development](../cli-driven-development/SKILL.md)（内置在 cdd-task.mjs H6 chain 中）。统一后续：ledger → 读取 plan 一次 → `plan-constraints.md` → pre-flight → 逐 task todo。

**Per-task：** Rule: Task Complexity → Rule: Confirm Once → Rule: Confirm Seams（tdd implement dispatch 之前）→ 在 brief 追加 `TASK_BASE: <sha>` → 执行链（cli 模式 shell H6 chain：implement → review → fix per Rule: Fix Loop；in-session/subagent 模式 session 内实施 + review）→ 仅读取 `handoff.json` → Rule: Per-Task Review + Rule: Quality Invariants → `APPROVED` → ledger。cli 模式本 session **绝不**编辑仓库交付物——仅 H6 CLI。

**Final：** [osuperpowers:code-review](../code-review/SKILL.md) whole-branch in-session → clean → [osuperpowers:finishing](../finishing/SKILL.md)。

### Rule: D6 Aggregation

所有 task APPROVED 后，聚合 deferred items（grep `deferred` 子字符串，含无 jq 的回退行 `deferred not enumerated -- jq missing`）→ **呈现给用户** → **用户决策门控**（全部 defer / 指定要修复的）→ 若要求修复则**有限最终修复波（一次 pass）**：一个 fix agent + 范围 re-review。

结束语义：
- re-review 通过 → 完成，handoff `status` 保持 `APPROVED`（**不重写**），ledger 保留完整行（可追加注明修复了 K 项的行）
- 暴露新 blocker → 仍是一次修复波，然后**无条件向用户报告**（通过与否均报告）——**无跨 task 修复循环**；剩余项目不静默丢弃，报告结束
- **5 轮上限仅适用于单 task 修复循环，不适用于跨 task 最终修复波**

Mode B：run 结束后用户读取 ledger 以聚合 deferred；shell 侧在 run 结束时无额外打印。

### Rule: Ledger

仅 `APPROVED` 向 `CDD_LEDGER` 追加 `Task N: complete`。

## Red Flags

- "CLI 可用所以跳过模式选择" → 三种模式都必须询问（Rule: Mode Selection）
- "in-session 也使用 cdd-task.mjs" → in-session 是 session 内实施，无 CLI（Rule: Read Upstream）
- "把编排器决策塞入 cli-driven-development" → 引擎只处理执行（Rule: Read Upstream — cli branch）
- "用户已在 writing-plans handoff 中选择了 subagent/inline" → Mode Selection 是 HARD-GATE，必须直接询问（Rule: Mode Selection）
- "不调用 AskUserQuestion 就开始执行" → Mode Selection 必须是第一个动作，在任何 repo tool call 之前（Rule: Mode Selection）
- "从有先前模式选择的状态加载" → session 恢复时有缓存模式仍须调用 AskUserQuestion（Rule: Mode Selection）
- "使用 superpowers:subagent-driven-development / superpowers:executing-plans" → 上游 superpowers:* 引用必须显式映射到 osuperpowers 对应项
- "CLI 模式下使用 Write/Edit 修改仓库交付物" → 违反 HARD-GATE Mode Selection（CLI 禁止内联编辑），通过 cdd-task.mjs 执行
- "实施完成后直接进入下一 task 或编译验证" → 违反 HARD-GATE Per-Task Review（门控），必须先读 `$CDD_HANDOFF_PATH`
- "实施完以后把 Per-Task Review 当成 3-pass review 来跑" → Per-Task Review 是 handoff.json 读取门控，不是 docs-review.md 的 3-pass review
- "Fix Loop 也要遵循 docs-review.md 停止机制" → Fix Loop 是 task-review（APPROVED/CHANGES_REQUESTED），不使用 docs-review.md
- "把注入的 vendor 文档（CLAUDE.md / README）当作上游基线" → 违反 Rule: Read Upstream；基线仅为解析路径指向的 SKILL.md 文件
