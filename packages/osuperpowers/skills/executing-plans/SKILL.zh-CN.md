---
name: executing-plans
description: 独立执行计划总编排器 —— 用户选择执行模式（in-session / subagent / cli），编排器控制器规则集（11 条语义规则，三模式共用）。cli 模式委托 cli-driven-development；in-session/subagent 模式 Read 上游对应技能驱动。
---

# Osuperpowers Executing-Plans

执行书面计划的总编排器。三种模式由用户选择。

## Rules

### Rule: Read Upstream

按用户所选模式解析上游（解析优先级 + 不可用回退同 [Rule: Read Upstream](../brainstorming/SKILL.md#rule-read-upstream)）：
- **in-session** → 解析 `executing-plans` 的 SKILL.md 路径，Read 作为基线（当可用时）
- **subagent** → 解析 `subagent-driven-development` 的 SKILL.md 路径，Read 作为基线（当可用时）
- **cli** → [cli-driven-development](../cli-driven-development/SKILL.md)（Skill-invoke 委托，不 Read 上游）

### Rule: Mode Selection

<HARD-GATE>
启动时、**在任何其他操作之前**（读 plan 之前、设置之前、任何接触仓库的工具调用之前），用 `AskUserQuestion` 让用户选模式（in-session | subagent | cli）。不接受上游技能的预选——编排器始终直接询问。选定后调 `cdd-session-activate.mjs minimal <session_key> <repo_root> --mode <mode>` 写 `pending.mode`。
</HARD-GATE>

### Rule: Task Complexity

每任务先分类：触及 1-2 文件 + 机械实现 → **Simple**；3+ 文件 / 跨模块 / 需设计判断 / 用户要求彻底 → **Complex**。影响 diff scope、测试门、model 层级。

### Rule: Confirm Once

spec+plan 完备 → 最便宜 implementer 层级；首次派发前确认一次。

### Rule: Fix Loop

`CHANGES_REQUESTED` → fix → scoped review → 重复直到 `APPROVED` 或 **5 轮**（超限 STOP + 升级）。

### Rule: Confirm Seams

派发会用 tdd 的 implement worker 前，编排器在会话内向用户确认测试边界（seam），把确认结果 `CONFIRMED_SEAMS: <...>` 写进 task brief。cli 模式一次性 print-mode CLI 无法阻塞 —— `templates/cdd/implement.md` 非阻塞应用（「若 brief 含 `CONFIRMED_SEAMS`，应用之」），seam 确认由编排器层独占。

### Rule: Per-Task Review

每任务评审门：读 handoff.json 驱动（plan_conflicts → STOP；CHANGES_REQUESTED → Fix Loop；NEEDS_CONTEXT/unverifiable → STOP）。cli 模式 worker review 在 CLI 子进程内；in-session/subagent 模式评审门在会话内。纪律见 [controller-handoff.md](../../docs/controller-handoff.md) H1–H5。

### Rule: Quality Invariants

1. 测试证据门（task-N-test-evidence.json）
2. plan_conflicts[] → 人为裁决
3. unverifiable[] 非空 → BLOCKED
4. handoff NEEDS_CONTEXT → STOP

### Rule: Orchestrator Checklist

编排器每计划一次的三阶段循环（三模式共用骨架；cli 模式差异见 Per-task 括号）：

**Setup (once):** in-session/subagent → `sdd-workspace`；cli → 委托 [cli-driven-development](../cli-driven-development/SKILL.md) 的 workspace（cdd-task.mjs H6 chain 内自建）。统一后续：ledger → read plan once → `plan-constraints.md` → pre-flight → todo per task。

**Per-task:** Rule: Task Complexity 分类 → Rule: Confirm Once → Rule: Confirm Seams（tdd implement 派发前）→ append `TASK_BASE: <sha>` to brief → 执行链（cli 模式 shell H6 chain：implement → review → fix per Rule: Fix Loop；in-session/subagent 模式会话内实现 + 评审）→ Read `handoff.json` only → Rule: Per-Task Review + Rule: Quality Invariants → `APPROVED` → ledger。cli 模式 **Never** edit repo deliverables in this session — H6 CLI only。

**Final:** [osuperpowers:code-review](../code-review/SKILL.md) whole-branch in-session → clean → [osuperpowers:finishing](../finishing/SKILL.md)。

### Rule: D6 Aggregation

全任务 APPROVED 后聚合 deferred（grep `deferred` 子串，含 no-jq 降级行 `deferred not enumerated — jq missing`）→ **呈现给用户** → **用户决策门**（全部 defer / 点名修）→ 要修则**有界 final fix 波（一次）**：一个 fix agent + scoped re-review。

End semantics:
- re-review clean → 结束，handoff `status` 保持 `APPROVED`（**不重写**），ledger 保留 complete 行（可追加一行记 K 项已修）
- 暴露新 blocker → 仍一轮 fix 波，然后 **unconditionally report to the user**（clean 与否）—— **no cross-task fix loop**；剩余项不静默丢弃，report 结束
- **round cap 5 仅适用单任务 fix loop，不适用跨任务 final fix 波**

Mode B：用户 run 结束后自行读 ledger 聚合 deferred；shell 端无额外 end-of-run print。

### Rule: Ledger

`APPROVED` 才在 `CDD_LEDGER` 追加 `Task N: complete`。

## Red Flags

- 「CLI 可用就跳过模式选择」→ 三模式必须询问（Rule: Mode Selection）
- 「in-session 也走 cdd-task.mjs」→ in-session 是会话内实现，不走 CLI（Rule: Read Upstream）
- 「把编排器决策塞进 cli-driven-development」→ 引擎只管执行（Rule: Read Upstream 的 cli 分支）
- 「User already chose subagent/inline in writing-plans handoff」→ Mode Selection 是 HARD-GATE，必须重新询问（Rule: Mode Selection）
- 「Start executing without calling AskUserQuestion」→ Mode Selection 必须是第一个动作（Rule: Mode Selection）
- 「Load from state with prior mode selection」→ session 恢复带缓存模式仍须调用 AskUserQuestion（Rule: Mode Selection）
- 「Use superpowers:subagent-driven-development / superpowers:executing-plans」→ 上游 subagent-driven-development 引用的 superpowers:* 需显式映射到 osuperpowers 对应版本（本 plan 的 Next-Step Routing rule 负责）
