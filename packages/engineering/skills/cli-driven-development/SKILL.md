---
name: cli-driven-development
description: cdd 引擎 —— 用选定 harness CLI 驱动计划任务的开发：三模式链（implement/review/fix）+ handoff 契约 + commit gate + ledger。引擎模式：编器职责（任务分类/fix loop/质量门/D6 聚合）由 os-executing-plans 承担。
---

# CLI-Driven Development（cdd）

用选定的 harness CLI 执行计划任务的三模式链。**这是引擎**：它执行，不做编器决策。

## Rules

### Rule: Harness Selection

执行前先经 [Rule: Ask](../cli-select/SKILL.md#rule-ask) 选定 harness，以 `--harness <name>` 传入。无 full harness 安装 → BLOCKED。

### Rule: Three-Mode Chain

每任务三种模式各一次 CLI 调用（见 [cdd-reference.md](../../docs/cdd-reference.md) H6）：

```bash
{plugin_root}/bin/engine/cdd-run.sh --harness <name> --task N --mode implement
{plugin_root}/bin/engine/cdd-run.sh --harness <name> --task N --mode review
```

`--mode fix` 仅当 review 返回 CHANGES_REQUESTED 时进入（fix loop，上限 5 轮）。

### Rule: Handoff Contract

每模式结束写/更新 `CDD_HANDOFF_PATH`（task-N-handoff.json）；stdout ≤ [Return Block 契约](../../docs/controller-handoff.md#rule-return-block) 四行；非零退出且无 handoff → BLOCKED。模板见 `templates/cdd/{implement,review,fix}.md` + `_handoff-write-fragment.md`。

### Rule: Commit Gate

implement / fix 模式返回时校验工作区干净（`cdd_validate_commit_contract`）：脏树 → 重写 handoff `status: BLOCKED` + 非零退出；非 git / git 错误 → fail-open。

### Rule: Ledger

`APPROVED` 才在 `CDD_LEDGER`（progress.md）追加 `Task N: complete` 行；CLI 子进程不写 ledger。

## Red Flags

- 「--resume / -c / 任何携带历史会话的 flag」→ 禁止（H6.5），用一次性 print 模式
- 「在编器会话里改 repo 文件」→ 引擎链只经 cdd-run.sh；会话侧由 orchestrator-gate 约束
- 「把编器决策塞进引擎」→ 分类/质量门/D6 属于编器（os-executing-plans），不是引擎
