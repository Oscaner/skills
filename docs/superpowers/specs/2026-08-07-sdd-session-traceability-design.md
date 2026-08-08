# H6 CLI Agent Session Traceability

**Date:** 2026-08-07
**Issue:** https://github.com/Oscaner/skills/issues/79
**Status:** approved

## Problem

SDD CLI agents (`sdd-run-task-claude.sh`, `sdd-run-task-cursor.sh`) invoke the harness in one-shot print mode (`-p` / `--print` / `--output-format text`). Print mode does not register sessions in the `/resume` list or `~/.claude/sessions/`. The orchestrator and user cannot locate which session executed Task N's implement, nor inspect/recover a task's execution context via the session picker.

H6.5 already forbids `--resume` (ensuring clean context per invocation). The gap is that there is no way at all to see these executions in the session system — not about reusing context, just about visibility.

## Root Cause

This is inherent to print mode, not a missing flag:

- `~/.claude/sessions/` only contains records with `"kind": "interactive"` — print mode is not interactive
- `--session-id` only targets `--resume`/`--continue` (specify which session to resume), not print mode
- `--name` in print mode does not write to the session registry
- `--no-session-persistence` docs state "(only works with --print)" — print mode never persisted sessions in the `/resume` sense
- `--background` starts a long-lived daemon, incompatible with one-shot per-mode dispatch

Verified via local testing (2026-08-07, Claude Code v2.1.224) and web search — no workaround exists.

## Solution

Document the behavior. No code changes.

### Files changed

| File | Change |
|---|---|
| `plugins/superpowers-overrides/docs/sdd-h6-reference.md` | New H6.6 section: session traceability explanation, implications, alternatives-considered |
| `plugins/superpowers-overrides/bin/sdd-run-task-claude.sh` | Top comment block: note that print mode creates no session, point to H6.6 |
| `plugins/superpowers-overrides/bin/sdd-run-task-cursor.sh` | Same comment update |

### Shell comment update

Insert after the flag invocation comment in each script (line 5 of the top comment block in both scripts):

**sdd-run-task-claude.sh:**
> Print mode (-p) is one-shot — no session is registered in /resume or ~/.claude/sessions/. Audit trail is ledger + handoff files, not session list. See H6.6.

**sdd-run-task-cursor.sh:**
> Print mode (--print) is one-shot — no session is registered in /resume or ~/.claude/sessions/. Audit trail is ledger + handoff files, not session list. See H6.6.

### Non-changes

- No shell execution logic changed (the `claude -p "$prompt"` / `cursor-agent --print ...` invocation lines stay as-is)
- No flags added to `claude -p` or `cursor-agent --print`
- H6.5 forbidden list unchanged

### H6.6 format

Match existing doc's numbered-rule style under H6:

> 6. **Session traceability:** CLI agents use one-shot print mode (`--print` / `--output-format text`), which does NOT register sessions in the `/resume` list or `~/.claude/sessions/`. This is inherent to print mode — print mode executes a single prompt and exits; session persistence belongs to interactive sessions only. **Audit trail:** ledger (`progress.md`) + handoff files (`task-N-handoff.json`) + per-task reports (`task-N-report.md`). **Recovery:** re-run the orchestrator shell for that task+mode. **Alternatives considered:** `--session-id` (only targets `--resume`/`--continue`), `--name` (in print mode does not write to session registry), `--background` (long-lived daemon, incompatible with one-shot per-mode dispatch).

### Related

- Issue #53 (gate consistency) — same family of dogfood DX improvements
