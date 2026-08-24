---
name: cli-driven-development
description: 计划执行器（仅 CLI）+ 编器 + 引擎 —— 用选定 harness CLI 的三模式链（implement / task-review / fix）驱动计划任务开发，承担编器职责（任务分类 / fix loop / 质量门 / D6 聚合 / Final branch-review），并在 finishing 前跑一次最终 branch-review CLI pass。
---

# CLI-Driven Development（cdd）

用选定的 harness CLI 执行计划任务的三模式链。**本技能同时是编器与引擎**：既执行也做编器决策（模式链、D6 聚合、Final Review）。

## Rules

### Rule: Harness Selection

执行前先经 [Rule: Ask](../cli-select/SKILL.md#rule-ask) 选定 harness，以 `--harness <name>` 传入。无 full harness 安装 → BLOCKED。

### Rule: Three-Mode Chain

每任务三种模式各一次 CLI 调用（见 [cdd-reference.md](../../docs/cdd-reference.md) H6）：

```bash
{plugin_root}/bin/engine/cdd-task.mjs --harness <name> --task N --mode implement
{plugin_root}/bin/engine/cdd-task.mjs --harness <name> --task N --mode task-review
```

`--mode fix` 仅当 task-review 返回 CHANGES_REQUESTED 时进入（fix loop，上限 5 轮）。

### Rule: Handoff Contract

每模式结束写/更新 `CDD_HANDOFF_PATH`（task-N-handoff.json）；stdout ≤ [Return Block 契约](../../docs/controller-handoff.md#rule-return-block) 四行；非零退出且无 handoff → BLOCKED。模板见 `templates/cdd/{implement,task-review,fix}.md` + `_handoff-write-fragment.md`。

### Rule: Commit Gate

implement / fix 模式返回时校验工作区干净（`cdd_validate_commit_contract`）：脏树 → 重写 handoff `status: BLOCKED` + 非零退出；非 git / git 错误 → fail-open。

### Rule: Ledger

`APPROVED` 才在 `CDD_LEDGER`（progress.md）追加 `Task N: complete` 行；CLI 子进程不写 ledger。

### Rule: Final Review（终局评审）

<HARD-GATE>
全部 task 返回 APPROVED 且 ledger 完成后，必须在交接给 `osuperpowers:finishing` 前，
经选定 harness CLI 跑一次整分支 review。禁止跳过该 pass；禁止自动 merge 其 findings。
</HARD-GATE>

命令：

```bash
{plugin_root}/bin/engine/cdd-review.mjs --harness <name> \
  --template branch-review \
  --param BASE=<git merge-base origin/develop HEAD 的结果> \
  --param HEAD=<head> \
  --param PLAN=<plan-path>
```

BASE 是集成分支点（`origin/develop`），不是 `origin/main`——本仓库集成进 `develop`。
findings 汇报给用户；不自动 merge。通过后交接 `osuperpowers:finishing`。

## Red Flags

- 「--resume / -c / 任何携带历史会话的 flag」→ 禁止（H6.5），用一次性 print 模式
- 「在编器会话里改 repo 文件」→ 引擎链只经 cdd-task.mjs；会话侧由 orchestrator-gate 约束
- 「branch-review findings 被自动 merge」→ findings 仅汇报，绝不自动 merge（Rule: Final Review）
- 「跳过 Final Review 直接 finishing」→ Final Review 是 `osuperpowers:finishing` 前的 HARD-GATE（Rule: Final Review）
