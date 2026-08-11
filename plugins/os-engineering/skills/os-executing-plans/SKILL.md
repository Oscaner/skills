---
name: os-executing-plans
description: 独立执行计划总编排器 —— 用户选择执行模式（in-session / subagent / cli），编排器控制器 Rules 1-8 三模式共用。cli 模式委托 cli-driven-development；in-session/subagent 模式 Read 上游对应技能驱动。
---

# OS Executing-Plans

执行书面计划的总编排器。三种模式由用户选择。

## Rules

### Rule: Read Upstream

按用户所选模式 Read 上游：
- **in-session** → `{superpowers-plugin-root}/skills/executing-plans/SKILL.md`
- **subagent** → `{superpowers-plugin-root}/skills/subagent-driven-development/SKILL.md`
- **cli** → [cli-driven-development](../cli-driven-development/SKILL.md)（Skill-invoke 委托，不 Read 上游）

### Rule: Mode Selection

启动时用 `AskUserQuestion` 让用户选模式（in-session | subagent | cli）。选定后调 `cdd-session-activate.sh minimal <session_key> <repo_root> --mode <mode>` 写 `pending.mode`。

### Rule: Task Complexity

每任务先分类：触及 1-2 文件 + 机械实现 → **Simple**；3+ 文件 / 跨模块 / 需设计判断 / 用户要求彻底 → **Complex**。影响 diff scope、测试门、model 层级。

### Rule: Confirm Once

spec+plan 完备 → 最便宜 implementer 层级；首次派发前确认一次。

### Rule: Fix Loop

`CHANGES_REQUESTED` → fix → scoped review → 重复直到 `APPROVED` 或 **5 轮**（超限 STOP + 升级）。

### Rule: Per-Task Review

每任务评审门：读 handoff.json 驱动（plan_conflicts → STOP；CHANGES_REQUESTED → Fix Loop；NEEDS_CONTEXT/unverifiable → STOP）。cli 模式 worker review 在 CLI 子进程内；in-session/subagent 模式评审门在会话内。

### Rule: Quality Invariants

1. 测试证据门（task-N-test-evidence.json）
2. plan_conflicts[] → 人为裁决
3. unverifiable[] 非空 → BLOCKED
4. handoff NEEDS_CONTEXT → STOP

### Rule: D6 Aggregation

全任务 APPROVED 后聚合 deferred → 用户决策（全部 defer / 点名修）→ 有界一次 final fix 波 + scoped re-review。

### Rule: Ledger

`APPROVED` 才在 `CDD_LEDGER` 追加 `Task N: complete`。

## Red Flags

- 「CLI 可用就跳过模式选择」→ 三模式必须询问（Rule: Mode Selection）
- 「in-session 也走 cdd-run.sh」→ in-session 是会话内实现，不走 CLI（Rule: Read Upstream）
- 「把编排器决策塞进 cli-driven-development」→ 引擎只管执行（Rule: Read Upstream 的 cli 分支）
