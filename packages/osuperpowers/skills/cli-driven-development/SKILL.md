---
name: cli-driven-development
description: Plan executor (cli-only) + orchestrator + engine — drives planned task development via the selected harness CLI three-mode chain (implement / task-review / fix), owns orchestrator responsibilities (task classification / fix loop / quality gate / final branch-review), and a final branch-review CLI pass before finishing.
---

# CLI-Driven Development (cdd)

Execute planned tasks with the selected harness CLI via a three-mode chain. **This skill is both orchestrator and engine**: it executes AND makes orchestrator decisions (mode chain, Final Review).

## Rules

### Rule: Harness Selection

Before execution, select a harness via [ask](../cli-select/SKILL.md#ask) and pass it as `--harness <name>`. No full harness installed -> BLOCKED.

### Rule: Three-Mode Chain

Each task gets one CLI call per mode (see [cdd-reference.md](./docs/cdd-reference.md) H6):

```bash
{plugin_root}/bin/engine/cdd-task.mjs --harness <name> --task N --mode implement
{plugin_root}/bin/engine/cdd-task.mjs --harness <name> --task N --mode task-review
```

`--mode fix` is only entered when task-review returns CHANGES_REQUESTED (fix loop, max 5 rounds).

### Rule: Handoff Contract

At the end of each mode, write/update `CDD_HANDOFF_PATH` (task-N-handoff.json); stdout <= [Return Block contract](./docs/controller-handoff.md#rule-return-block) four lines; non-zero exit with no handoff -> BLOCKED. Templates at `templates/cdd/{implement,task-review,fix}.md` + `_handoff-write-fragment.md`.

### Rule: Commit Gate

When implement / fix mode returns, validate that the workspace is clean (`cdd_validate_commit_contract`): dirty tree -> rewrite handoff `status: BLOCKED` + non-zero exit; non-git / git error -> fail-open.

### Rule: Ledger

Only append `Task N: complete` line to `CDD_LEDGER` (progress.md) when status is `APPROVED`; CLI subprocesses do not write to the ledger.

### Rule: Final Review

<HARD-GATE>
After ALL tasks return APPROVED and the ledger is complete, you MUST run a
whole-branch review via the selected harness CLI before handing off to
`osuperpowers:finishing`. Do NOT skip this pass. Do NOT auto-merge its findings.
</HARD-GATE>

Run:

```bash
{plugin_root}/bin/engine/cdd-review.mjs --harness <name> \
  --template branch-review \
  --param BASE=<git merge-base origin/develop HEAD> \
  --param HEAD=<head> \
  --param PLAN=<plan-path>
```

BASE is the integration branch point (`origin/develop`), not `origin/main` — this repo integrates into `develop`. Report the findings to the user; do NOT auto-merge. When clean, hand off to `osuperpowers:finishing`.

## Red Flags

- "--resume / -c / any flag that carries historical session" -> forbidden (H6.5), use one-shot print mode
- "Modify repo files inside an orchestrator session" -> engine chain only goes through cdd-task.mjs; session side is constrained by orchestrator-gate
- "branch-review findings auto-merged" -> findings are reported, never auto-merged (Rule: Final Review)
- "Skip Final Review and go straight to finishing" -> Final Review is a HARD-GATE before `osuperpowers:finishing` (Rule: Final Review)
