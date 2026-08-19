---
name: cli-code-review
description: Reviews an arbitrary diff (base..head or current branch vs origin/main) using the selected harness CLI, returning a findings report. Independent of the per-task review mode inside the cdd chain.
---

# CLI Code Review

Review code in an arbitrary diff range, delegated to the selected harness CLI agent.

## Rules

### Rule: Choose Harness

Select a harness via [Rule: Ask](../cli-select/SKILL.md#rule-ask) first.

### Rule: Scope

Scope = explicit `base..head`, or current branch vs `origin/main` (derived via `git merge-base`).

### Rule: Diff Package

Use the upstream `review-package` script to generate a diff package (`review-package PLAN_FILE BASE HEAD <out>`), which serves as the review input.

### Rule: Review Prompt

Construct a self-contained review prompt (containing review dimensions + diff file paths; the CLI agent has no repo skill context, so criteria must be included in the prompt -- do not assume `Skill(...)` is loadable), then dispatch via `{plugin_root}/bin/engine/cdd-exec.mjs --harness <name> --prompt "<prompt>"`.

### Rule: Findings Report

Collect the agent's output findings (organized by severity: blocker / warn / nit) as the report; no findings -> pass. Report to the user, do not auto-merge.

## Red Flags

- "Reviewing uncommitted changes using HEAD~1" -> use explicit base..head or merge-base (Rule: Scope)
- "Assuming the CLI agent can load the mattpocock code-review skill" -> droid/pi do not have that skill; the prompt must be self-contained (Rule: Review Prompt)
