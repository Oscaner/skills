---
name: cli-task
description: Dispatches a task to the selected harness CLI for execution. Three paths: one-shot free-form, --loop iteration (sentinel stops), brief path (handoff contract). Reuses the cdd engine (registry + cdd-review.mjs / cdd-task.mjs), no ledger/plan orchestrator responsibilities.
---

# CLI Task

Dispatch a single task to the selected harness CLI for execution, returning the final output.

## Rules

### Rule: Choose Harness

Select a harness via [Rule: Ask](../cli-select/SKILL.md#rule-ask) first, passing it explicitly as `--harness <name>`.

### Rule: One-shot Free-Form

Default path: `{plugin_root}/bin/engine/cdd-review.mjs --harness <name> --prompt "<task description>"`, returning the normalized final output (text passthrough / stream-json extracts finalText).

### Rule: Loop

`cli-task --loop "<base prompt>"`: iteratively call `cdd-review.mjs`, where each round's prompt = base prompt + `[Iteration N -- previous result: <previous round final text>]` (feeds back the previous round's output). Stops when output contains the sentinel (default `<promise>NO MORE TASKS</promise>`, overridable via `--sentinel`) or `--max` is reached (default 20); displays the final text each round.

### Rule: Brief Path

User provides a brief path -> follows the handoff contract: set `CDD_TASK_BRIEF` and other env vars, then call `{plugin_root}/bin/engine/cdd-task.mjs --harness <name> --task N --mode <implement|task-review|fix>` (mode is user-specified, defaults to implement; the user brief IS the task brief, cli-task does not transform it).

## Red Flags

- "--loop sends the same prompt each round, it will change anyway" -> stateless print CLI produces identical output each round; you MUST feed back the previous round's result (Rule: Loop)
- "free-form also needs to write handoff.json" -> one-shot free-form tasks do not write ledger/handoff (Rule: One-shot Free-Form)
