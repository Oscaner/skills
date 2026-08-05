# Cursor Hook Enforce `file_path` Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Cursor `preToolUse` enforce so valid first `Read` calls using `tool_input.file_path` (not `.path`) are allowed, and deny messages guide Cursor agents to use Read.

**Architecture:** Cursor sends Read paths in `file_path`; enforce generator template only reads `.path`. Update `build/render-cursor-hooks.sh` enforce template to coalesce `path // file_path`, refresh deny copy for Cursor, regenerate `bin/override-cursor-enforce.sh`, extend shell test with Cursor-shaped payload, document in smoke docs.

**Tech Stack:** Bash, jq, Python (generator), existing `override-cursor-enforce.test.sh` harness.

**Spec:** [docs/superpowers/specs/2026-08-05-cursor-hook-enforce-file-path-design.md](../specs/2026-08-05-cursor-hook-enforce-file-path-design.md)

## Global Constraints

- Source of truth for enforce script is **`build/render-cursor-hooks.sh`** — edit template, then `pnpm run generate:overrides`; do not hand-edit `bin/override-cursor-enforce.sh` without regenerating.
- Detect script already uses `file_path or path` for attachments — mirror that pattern in enforce Read branch.
- Claude Code expansion (`override-prompt-expansion.sh`) may keep Skill-only wording; only Cursor enforce deny message changes.
- Run `pnpm run validate:overrides` before claiming done.
- Do not commit unless user asks.

## File Structure

| File | Responsibility |
|------|----------------|
| `plugins/superpowers-overrides/build/render-cursor-hooks.sh` | Enforce bash template embedded in Python heredoc; generates `bin/override-cursor-enforce.sh` |
| `plugins/superpowers-overrides/bin/override-cursor-enforce.sh` | Generated output — Cursor preToolUse handler |
| `plugins/superpowers-overrides/tests/override-cursor-enforce.test.sh` | Shell integration tests for allow/deny/TTL |
| `plugins/superpowers-overrides/docs/CURSOR-SMOKE.md` | Manual smoke checklist |
| `plugins/superpowers-overrides/docs/cross-harness-overrides.md` | Cross-harness enforce contract |

---

### Task 1: Fix enforce generator — `file_path` fallback + deny message

**Files:**
- Modify: `plugins/superpowers-overrides/build/render-cursor-hooks.sh` (~lines 252–274, enforce heredoc)
- Regenerate: `plugins/superpowers-overrides/bin/override-cursor-enforce.sh`
- Modify: `plugins/superpowers-overrides/tests/override-cursor-enforce.test.sh`

**Interfaces:**
- Consumes: pending JSON `{"override":"spor-<slug>",...}` from detect
- Produces: enforce stdout `{"permission":"allow"|"deny",...}`; Read allow when `tool_input.path` OR `tool_input.file_path` matches spor SKILL suffix

- [ ] **Step 1: Update Read path extraction in generator template**

In `render-cursor-hooks.sh` enforce heredoc, change:

```bash
read_path=$(printf '%s' "$tool_input" | jq -r '.path // ""')
```

to:

```bash
read_path=$(printf '%s' "$tool_input" | jq -r '.path // .file_path // ""')
```

- [ ] **Step 2: Update deny message in generator template**

Replace Skill-only `agent_message` with Cursor-first copy (keep `$skill_ref` variable):

```
MANDATORY OVERRIDE — oscaner hook intercepted this turn.
Your FIRST tool call MUST be Read("<path ending in /spor-<slug>/SKILL.md>").
(Claude Code: Skill("<skill_ref>") if available.)
Do NOT call any other tool before it. Do NOT follow the skill body instructions below until after you have called the override.
```

Use jq string concat with `$skill_ref` as today.

- [ ] **Step 3: Regenerate enforce script**

Run from repo root:

```bash
pnpm run generate:overrides
```

Verify `bin/override-cursor-enforce.sh` contains `.path // .file_path` and updated deny text.

- [ ] **Step 4: Add `file_path` test case**

Append to `override-cursor-enforce.test.sh` after existing `.path` allow test:

```bash
# Cursor Read payload uses file_path not path
printf '%s' '{"conversation_id":"conv-e1b","prompt":"/brainstorming","attachments":[]}' | "$DETECT" >/dev/null
allow_fp=$(printf '%s' "{\"conversation_id\":\"conv-e1b\",\"tool_name\":\"Read\",\"tool_input\":{\"file_path\":\"$SPOR_SKILL\"}}" | "$ENFORCE")
echo "$allow_fp" | jq -e '.permission == "allow"' >/dev/null
[ ! -f "$PENDING_ROOT/conv-e1b.json" ] || { echo "pending not cleared (file_path)"; exit 1; }
```

- [ ] **Step 5: Run enforce test**

```bash
plugins/superpowers-overrides/tests/override-cursor-enforce.test.sh
```

Expected: `OK — override-cursor-enforce`

- [ ] **Step 6: Run overrides validate**

```bash
pnpm run validate:overrides
```

Expected: pass (no generator drift)

---

### Task 2: Documentation + manual smoke verification

**Files:**
- Modify: `plugins/superpowers-overrides/docs/CURSOR-SMOKE.md`
- Modify: `plugins/superpowers-overrides/docs/cross-harness-overrides.md`

**Interfaces:**
- Consumes: Task 1 merged (enforce allows `file_path`)
- Produces: docs note; smoke item 16 ready for human check

- [ ] **Step 1: Update CURSOR-SMOKE.md**

Under **First-tool contract** section, add note:

> Cursor `preToolUse` Read payload uses `tool_input.file_path` (not `.path`). Enforce accepts either.

Leave checkbox item 16 unchecked until manual smoke passes.

- [ ] **Step 2: Update cross-harness-overrides.md**

Under Cursor enforce table row for `preToolUse`, add: Read path extracted from `tool_input.path` or `tool_input.file_path`.

- [ ] **Step 3: Manual smoke (human)**

Fresh Agent conversation → `/brainstorming` only:

1. First tool `Read` with `file_path` → spor SKILL → **allow**
2. Wrong tool (Grep/Task) in a separate run → **deny** with Read-first message
3. Pending file cleared after valid Read

Mark CURSOR-SMOKE item 16 `[x]` when pass.

- [ ] **Step 4: Full validate (optional but recommended)**

```bash
pnpm run validate
```

Expected: all checks pass.

---

## Spec Coverage

| Spec requirement | Task |
|------------------|------|
| `file_path` fallback | Task 1 Steps 1–3 |
| Deny message Cursor-first | Task 1 Step 2 |
| Test coverage | Task 1 Step 4–5 |
| Docs | Task 2 Steps 1–2 |
| Manual smoke | Task 2 Step 3 |

## Execution Handoff

**Plan saved to:** `docs/superpowers/plans/2026-08-05-cursor-hook-enforce-file-path.md`

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks
2. **Inline Execution** — execute in this session with checkpoints

Which approach?
