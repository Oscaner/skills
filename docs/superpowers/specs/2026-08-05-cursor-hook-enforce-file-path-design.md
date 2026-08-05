# Cursor Hook Enforce — `file_path` Field Fix

**Date:** 2026-08-05  
**Status:** Approved  
**Scope:** `superpowers-overrides` Cursor `preToolUse` enforce handler

## Problem

Cursor smoke checklist item 16 fails: `/brainstorming` → valid first `Read` of `spor-brainstorming/SKILL.md` is **denied**; wrong tools may slip through in parallel batches.

### Root cause (confirmed)

Cursor `preToolUse` passes Read tool input as `tool_input.file_path`, not `tool_input.path`:

```json
{
  "tool_name": "Read",
  "tool_input": {
    "file_path": "/Users/kang/.claude/plugins/cache/oscaner/superpowers-overrides/6.2.0-overrides.13/skills/spor-brainstorming/SKILL.md"
  }
}
```

`bin/override-cursor-enforce.sh` only reads `.path`:

```bash
read_path=$(printf '%s' "$tool_input" | jq -r '.path // ""')
```

When `path` is empty, the path regex never runs → `allow=false` → deny, even though the file path is correct and would match `/skills/spor-brainstorming/SKILL.md$`.

Unit tests use `.path` and pass; production Cursor payload uses `.file_path` — test/reality gap.

### Secondary issue

Deny `agent_message` only mentions `Skill("superpowers-overrides:spor-*")`. Cursor Agent has no `Skill` tool; the compliant first action is `Read` of the spor SKILL path. Misleading message causes agents to retry impossible tools.

## Goals

1. Allow first `Read` when Cursor sends `file_path` (or `path`) ending in `/skills/spor-<slug>/SKILL.md` or `/spor-<slug>/SKILL.md`.
2. Continue denying all other first tools while pending override state exists.
3. Update deny message to lead with Read (Cursor) and mention Skill (Claude Code).
4. Add test coverage for Cursor-shaped `tool_input`.
5. Re-run penf smoke item 16 after fix.

## Non-goals

- Detect/enforce race hardening (defer unless second smoke shows CURSOR-SMOKE false positives after this fix).
- Changes to Claude Code hooks or self-check rule semantics.
- Installing project-level `.cursor/hooks.json`.

## Solution (Plan A)

### 1. Enforce path extraction

In `plugins/superpowers-overrides/bin/override-cursor-enforce.sh`:

```bash
read_path=$(printf '%s' "$tool_input" | jq -r '.path // .file_path // ""')
```

If `build/render-cursor-hooks.sh` embeds duplicate enforce logic, update the template and run `pnpm run generate:overrides` so generated artifacts stay in sync.

### 2. Deny message

Replace Skill-only wording with Cursor-first guidance:

```
MANDATORY OVERRIDE — oscaner hook intercepted this turn.
Your FIRST tool call MUST be Read("<path ending in /spor-<slug>/SKILL.md>").
(Claude Code: Skill("superpowers-overrides:spor-<slug>") if available.)
Do NOT call any other tool before it. Do NOT follow the skill body instructions below until after you have called the override.
```

Use the actual `override` slug in the message (same as today).

Also update the generator template in `build/render-cursor-hooks.sh` and `build/render-hook.sh` / `bin/override-prompt-expansion.sh` if they share the same deny string for consistency.

### 3. Tests

Extend `plugins/superpowers-overrides/tests/override-cursor-enforce.test.sh`:

- After detect writes pending, send enforce input with `tool_input.file_path` set to `$SPOR_SKILL` → expect `permission: allow` and pending cleared.
- Keep existing `.path` test (backward compatibility).

Run:

```bash
plugins/superpowers-overrides/tests/override-cursor-enforce.test.sh
pnpm run validate:overrides
```

### 4. Documentation

- `plugins/superpowers-overrides/docs/CURSOR-SMOKE.md` — note Cursor Read uses `file_path` in hook payload; valid first tool unchanged (Read spor path or Skill).
- `plugins/superpowers-overrides/docs/cross-harness-overrides.md` — one line under enforce section: path field = `path` or `file_path`.

## Verification

Manual smoke (fresh conversation):

1. Send `/brainstorming` only.
2. First tool: `Read` with `file_path` → spor SKILL → **allow** (tool succeeds).
3. Wrong first tool (Grep, Task) → **deny** with updated message.
4. Check `$TMPDIR/oscaner-superpowers-overrides/pending/` — cleared after valid Read.

Update CURSOR-SMOKE.md checkbox item 16 when pass.

## Files to touch

| File | Change |
|------|--------|
| `bin/override-cursor-enforce.sh` | `file_path` fallback; deny message |
| `build/render-cursor-hooks.sh` | Template sync (if duplicated) |
| `tests/override-cursor-enforce.test.sh` | `file_path` case |
| `docs/CURSOR-SMOKE.md` | Payload note |
| `docs/cross-harness-overrides.md` | Payload note |
| Generated outputs | Via `pnpm run generate:overrides` if needed |

## Risks

| Risk | Mitigation |
|------|------------|
| Other harnesses send different keys | Coalesce `path // file_path` only; add keys when observed |
| Generator drift | `validate:overrides` in CI |
| Parallel first-tool race | Out of scope; revisit if smoke still flaky |
