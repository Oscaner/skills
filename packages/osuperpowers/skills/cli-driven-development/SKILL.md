---
name: cli-driven-development
description: cdd engine -- drives planned task development with the selected harness CLI: three-mode chain (implement/task-review/fix) + handoff contract + commit gate + ledger. Engine mode: orchestrator responsibilities (task classification / fix loop / quality gate / D6 aggregation) are handled by executing-plans.
---

# CLI-Driven Development (cdd)

Execute planned tasks with the selected harness CLI via a three-mode chain. **This is the engine**: it executes, it does not make orchestrator decisions.

## Rules

### Rule: Harness Selection

Before execution, select a harness via [Rule: Ask](../cli-select/SKILL.md#rule-ask) and pass it as `--harness <name>`. No full harness installed -> BLOCKED.

### Rule: Three-Mode Chain

Each task gets one CLI call per mode (see [cdd-reference.md](../../docs/cdd-reference.md) H6):

```bash
{plugin_root}/bin/engine/cdd-run.mjs --harness <name> --task N --mode implement
{plugin_root}/bin/engine/cdd-run.mjs --harness <name> --task N --mode task-review
```

`--mode fix` is only entered when task-review returns CHANGES_REQUESTED (fix loop, max 5 rounds).

### Rule: Handoff Contract

At the end of each mode, write/update `CDD_HANDOFF_PATH` (task-N-handoff.json); stdout <= [Return Block contract](../../docs/controller-handoff.md#rule-return-block) four lines; non-zero exit with no handoff -> BLOCKED. Templates at `templates/cdd/{implement,task-review,fix}.md` + `_handoff-write-fragment.md`.

### Rule: Commit Gate

When implement / fix mode returns, validate that the workspace is clean (`cdd_validate_commit_contract`): dirty tree -> rewrite handoff `status: BLOCKED` + non-zero exit; non-git / git error -> fail-open.

### Rule: Ledger

Only append `Task N: complete` line to `CDD_LEDGER` (progress.md) when status is `APPROVED`; CLI subprocesses do not write to the ledger.

## Red Flags

- "--resume / -c / any flag that carries historical session" -> forbidden (H6.5), use one-shot print mode
- "Modify repo files inside an orchestrator session" -> engine chain only goes through cdd-run.mjs; session side is constrained by orchestrator-gate
- "Cram orchestrator decisions into the engine" -> classification / quality gate / D6 belong to the orchestrator (executing-plans), not the engine
