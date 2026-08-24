---
name: cli-select
description: Lists the harness CLIs installed on the system and asks which one to use for task execution. Recommended priority: droid > pi > current harness. Referenced by cli-driven-development / cli-task.
---

# CLI Select

Select the harness CLI to execute tasks: detect, list, recommend, ask.

## Rules

### Rule: Detect

Run `{plugin_root}/bin/engine/cdd-select.mjs` and parse its three output lines:

- `available:` -- harnesses that are ship=full and installed (comma-separated)
- `unsupported_installed:` -- harnesses that are ship=not-supported but installed (informational, not included in recommendations)
- `recommended:` -- the recommended default (droid > pi > current harness > first alphabetically)

### Rule: Ask

Use `AskUserQuestion` to list each item in `available`, mark the recommended item with "(Recommended)" and place it first, then ask the user to choose.

### Rule: Empty list

`available:` is empty (cdd-select.mjs exit 1) -> **BLOCKED**, report the registered full harness list and missing hints. Do not silently fall back.

### Rule: Propagate

Pass the selected harness to the caller via **explicit** `--harness <name>` (`cdd-task.mjs --harness <name> ...`). Do not set implicit environment variables.

## Red Flags

- "The current harness is not in available, so force-use it anyway" -> if current is not full / not detected, skip and fall back (Rule: Empty list)
- "available is empty but codex is in PATH, so recommend codex" -> not-supported items are excluded from recommendations (Rule: Detect)
