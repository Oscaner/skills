# Cursor attach-only enforce

**Date:** 2026-08-05  
**Status:** Draft — pending user review  
**Plugin:** superpowers-overrides  
**Scope:** Cursor harness only; Claude Code hooks unchanged

## Problem

Cursor `preToolUse` enforce blocks the first tool on every override trigger (bare `/brainstorming`, prefixed slash, spor slash, upstream SKILL attach). This causes bad UX when users combine a slash command with an immediate task (e.g. investigate a slow API + read logs): `Read`/`Grep` are denied while `Shell` bypasses via `beforeShellExecution`.

Root conflict: upstream skill checklist says "explore project context first"; override requires loading `spor-*` first. Enforce was added because Cursor cannot inject `additionalContext` on submit (unlike Claude Code `UserPromptExpansion`).

However, **full enforce on every trigger is too coarse**:

- Slash commands: `agent_skills` already lists `spor-*` with `fullPath`; deny hurts normal work.
- Attach upstream SKILL: highest drift risk — upstream body dominates context; enforce remains valuable.

## Goal

- **Eliminate deny** on bare `/brainstorming`, `/spor-*`, and prefixed slash triggers.
- **Retain hard enforce** only when user attaches upstream `superpowers/*/SKILL.md`.
- Improve deny message with concrete `skill_suffix` when attach enforce fires.

## Non-goals

- No `beforeShellExecution` hook (do not block Shell/rg workaround path further).
- No session loaded marker (unnecessary when slash no longer pending).
- No Claude Code hook changes.
- No NL keyword interception in detect.

## Decision summary

| Trigger | Pending? | Enforce first tool? |
|---------|----------|---------------------|
| Attach upstream SKILL path | Yes | Yes |
| Bare `/brainstorming`, `/writing-plans`, … | No | No — rules only |
| `/spor-brainstorming`, … | No | No — rules only |
| `superpowers:brainstorming` in prompt | No | No — rules only |

Enforcement fallback on slash: `.cursor/rules/superpowers-overrides.mdc` (from `/spor-init`) + spor skill `description` ("MUST invoke BEFORE … FIRST tool call").

## Architecture

### State machine

```
UserPromptSubmit (override-cursor-detect.sh)
  │
  ├─ attachment matches upstream SKILL attach pattern?
  │     yes → write pending/<session_key>.json
  │     no  → (fall through)
  │
  ├─ bare /slash, spor /slash, prefixed superpowers:* in prompt?
  │     → do NOT write pending
  │
  └─ return {continue: true}

preToolUse (override-cursor-enforce.sh) — only when pending exists
  │
  ├─ pending expired (TTL 300s)? → clear, allow
  │
  ├─ Read path ends with pending.skill_suffix? → clear pending, allow
  ├─ Skill superpowers-overrides:<override>? → clear pending, allow
  │
  └─ else → deny with skill_suffix in agent_message
```

### Pending schema

Path: `$TMPDIR/oscaner-superpowers-overrides/pending/<session_key>.json`

`session_key` = `conversation_id` ?? `session_id` ?? first 16 hex of `sha256(prompt)`

```json
{
  "override": "spor-brainstorming",
  "skill_suffix": "skills/spor-brainstorming/SKILL.md",
  "detected_at": 1735689600,
  "trigger": "attach"
}
```

- `skill_suffix` derived at generator time from manifest `source` (e.g. `./skills/spor-brainstorming` → `skills/spor-brainstorming/SKILL.md`).
- `trigger` is always `attach` under this design (only attach writes pending).
- TTL: **300s** unchanged.

### Deny message (attach only)

When deny fires:

```
MANDATORY OVERRIDE — upstream skill attached without spor override loaded.
Your FIRST tool call MUST be Read("<skill_suffix>") using the fullPath from agent_skills for <override>.
(Claude Code: Skill("superpowers-overrides:<override>") if available.)
Do NOT follow the upstream skill checklist until the spor override is loaded.
```

Enforce allow path unchanged: Read `path // file_path` matching `/skills/${override}/SKILL.md$` or `/${override}/SKILL.md$`, or Skill `superpowers-overrides:${override}`.

## Components

### Generator (`build/render-cursor-hooks.sh`)

1. **detect script**
   - Keep attachment loop → `write_pending` with `override`, `skill_suffix`, `trigger: attach`.
   - Delete prefixed, spor-slash, and bare-slash prompt match branches from detect (no pending, no dead code).
   - Add `skill_suffix` to `write_pending` args from manifest target `source`.

2. **enforce script**
   - Read `skill_suffix` from pending for deny message.
   - Allow logic unchanged.

3. **hooks-cursor.json**
   - Unchanged structure: `beforeSubmitPrompt` + `preToolUse`.

### Tests

**`tests/override-cursor-detect.test.sh`**

- `/brainstorming` prompt → **no** pending file.
- Attachment path matching upstream cache → pending with `trigger: attach` and `skill_suffix`.
- `/spor-brainstorming` → no pending.

**`tests/override-cursor-enforce.test.sh`**

- Pending from attach → Grep deny, Read spor allow, pending cleared.
- Deny message contains `skill_suffix`.
- No pending → all tools allow (existing noop case).

### Documentation

**`docs/cross-harness-overrides.md`**

- Cursor enforcement table: detect **attach only**; slash → rules fallback.
- Pending schema adds `skill_suffix`.
- Manual smoke: attach upstream SKILL → enforce; `/brainstorming` alone → no deny.

**`build/templates/self-check.mdc`** (regenerated via `generate:overrides`)

- Cursor: hooks enforce **attach only**; slash commands rely on self-check + spor description.

**CHANGELOG** (on ship): patch note under next overrides release.

## Error handling

- Missing `jq`: detect → `{continue:true}`; enforce → `{permission:"allow"}` (fail open, existing behavior).
- Expired pending: enforce allows and deletes file.
- Wrong override Read path on deny retry: agent retries with agent_skills fullPath; 300s TTL eventual escape.

## Verification

```bash
pnpm run generate:overrides
pnpm run validate:overrides
./plugins/superpowers-overrides/tests/override-cursor-detect.test.sh
./plugins/superpowers-overrides/tests/override-cursor-enforce.test.sh
./plugins/superpowers-overrides/tests/validate-overrides-build.sh
```

Manual (Cursor):

1. Fresh chat, `/brainstorming` only → first tool Grep/Read → **no deny** (Hooks log: no pending).
2. Attach upstream `brainstorming/SKILL.md` + question → first Grep **deny** → Read spor **allow** → subsequent tools **allow**.
3. Settings → Hooks → Execution Log confirms detect skip on slash.

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Slash-trigger drift without enforce | Strong self-check rule; spor description; user docs recommend `/spor-*`; Claude Code still fully enforced |
| User attaches upstream SKILL often | Attach enforce preserved |
| Generator drift | CI `validate:overrides --check` |

## Out of scope (future)

- Cursor `beforeSubmitPrompt` context injection (product request).
- `beforeShellExecution` parity with preToolUse.
- Session loaded marker if attach-only proves insufficient for slash drift.
