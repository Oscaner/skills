# SDD Slim Orchestrator v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shrink `spor-subagent-driven-development/SKILL.md` from 232 to ≤160 lines by replacing duplicated prose with pointer cites, without changing CLI/H6 behavior.

**Architecture:** Single-file refactor — Rule 0a pointer block, Rule 5b/5c pointer-only, Rule 3 trim, Rule 6 cross-ref fix. Overall inventory row documents the phase.

**Tech Stack:** Markdown skills, `wc`/`rg` smoke checks, `pnpm run validate`.

**Spec:** [2026-08-05-sdd-slim-orchestrator-v2-design.md](../specs/2026-08-05-sdd-slim-orchestrator-v2-design.md)

## Global Constraints

- **Only** edit `plugins/superpowers-overrides/skills/spor-subagent-driven-development/SKILL.md` for skill rules (Task 1)
- **No** new skills; **no** `overrides.manifest.json` changes
- **No** changes to `templates/sdd-cli/`, `bin/`, `spor-executing-plans`
- Hard cap: **`wc -l` ≤ 160** on spor-SDD skill file
- p0 fallback semantics unchanged (Rule 0b + upstream SDD + pointer 5b/5c)
- Conventional commits; no attribution trailers
- `pnpm run validate` must pass after Task 2

## File map

| File | Responsibility |
|------|----------------|
| `plugins/superpowers-overrides/skills/spor-subagent-driven-development/SKILL.md` | Pointer-only Rule 0a/5b/5c; Rule 3/6 trim |
| `docs/superpowers/specs/2026-08-05-sdd-token-efficiency-overall.md` | p1-slim.1 inventory row |

---

### Task 1: Slim spor-SDD to pointer-only rules

**Files:**
- Modify: `plugins/superpowers-overrides/skills/spor-subagent-driven-development/SKILL.md`

**Interfaces:**
- Consumes: spec Design § Rule 0a/5a/5b/5c/3/6 replacement blocks
- Produces: spor-SDD ≤160 lines with guards on Rules 3, 5b, 5c

- [ ] **Step 1: Replace Rule 0a items 3–5 with pointer block**

Delete nested **Setup** / **Per-task loop** / **Final** lists (current ~L17–42) and old item 5 standalone line.

Replace with spec item 3 exactly:

```markdown
3. **Orchestrator + worker (pointers only):**
   - Orchestrator: Setup/ledger/plan-constraints via upstream scripts + Rule 7 + controller-handoff H6–H8; per-task Rule 1 → Rule 4 (once) → TASK_BASE in brief → H6 → Rule 5a → Rule 6; final whole-branch review orchestrator in-session (no CLI final)
   - Worker discipline SOT: `templates/sdd-cli/{implement,handoff,review,fix}.md` — do not paraphrase Rule 3/5b/5c
   - CLI worker review steps run in H6 subprocesses only — see Rule 5a (orchestrator does NOT dispatch handoff-writer/code-review in-session)
```

Keep Rule 0a items 1–2 and Rule 0b unchanged.

- [ ] **Step 2: Replace Rule 5b body**

```markdown
#### Rule 5b — In-session implementer dispatch (p0 fallback only)

When Rule 0a applies, skip — `templates/sdd-cli/implement.md` is SOT.

p0 path: dispatch implementer per upstream SDD Task Loop §1 (`implementer-prompt.md`); filenames brief → report + test-evidence; commit/H1 per `implement.md`.
```

- [ ] **Step 3: Replace Rule 5c body**

Remove steps 2–8 and Degradation block. Replace with:

```markdown
#### Rule 5c — In-session per-task review (p0 fallback only)

When Rule 0a applies, skip — H6 + `templates/sdd-cli/` is SOT.

p0 path: handoff-writer + code-review per `templates/sdd-cli/{handoff,review,fix}.md`, `spor-handoff-writer`, and controller-handoff H1–H5; degradation per controller-handoff H2 degradation note + handoff-writer skill.
```

- [ ] **Step 4: Trim Rule 3**

Keep title, guard line, link to tdd, one-line Markdown exemption, one-line load failure.

Remove numbered items 1–3 (`Instruct each implementer…`, `Confirm the seams…`, exemption paragraph duplicate — keep single exemption line).

Fix stale cross-ref at end of Rule 3: change `Rule 5b step 1` → `implement.md H1 contract`.

- [ ] **Step 5: Fix Rule 6 item 2**

Change `(Rule 5a / Rule 5c step 7)` → `(Rule 5a)`.

- [ ] **Step 6: Line-count gate**

```bash
wc -l plugins/superpowers-overrides/skills/spor-subagent-driven-development/SKILL.md
```

If **> 160**: condense Rule 4 `CLI-default` paragraph to one line, then trim redundant tail in Rule 5a if still over cap, re-run `wc -l`. Must be ≤ 160 before Task 2.

- [ ] **Step 7: Grep smoke**

```bash
# no nested checklist headers under Rule 0a
! rg -n "^\s+\*\*Setup \(once" plugins/superpowers-overrides/skills/spor-subagent-driven-development/SKILL.md

# no Step 5 override block in 5c
! rg -n "Override Step 5" plugins/superpowers-overrides/skills/spor-subagent-driven-development/SKILL.md

# guards present
rg -c "When Rule 0a applies, skip" plugins/superpowers-overrides/skills/spor-subagent-driven-development/SKILL.md
# expected count: 3
```

- [ ] **Step 8: Commit**

```bash
git add plugins/superpowers-overrides/skills/spor-subagent-driven-development/SKILL.md
git commit -m "refactor: slim spor-SDD to pointer-only rules (p1-slim.1)"
```

---

### Task 2: Overall inventory + validate

**Files:**
- Modify: `docs/superpowers/specs/2026-08-05-sdd-token-efficiency-overall.md` (Decomposition table + charter row)

**Interfaces:**
- Consumes: Task 1 spor-SDD ≤160 lines
- Produces: overall spec p1-slim.1 row; validate green

- [ ] **Step 1: Add p1-slim.1 inventory row**

In **Decomposition** table after p1-slim row:

```markdown
| spor-SDD on-disk slim | **p1-slim.1** | [p1-slim.1 design](2026-08-05-sdd-slim-orchestrator-v2-design.md) | p1-slim ship | impl pending |
```

In **交付物摘要（charter）** table after p1-slim row:

```markdown
| p1-slim.1 | spor-SDD ≤160 lines; Rule 0a/5b/5c pointer-only |
```

Update v2 spec §3 Deviations row `Overall updated?` from **Pending** to **Yes** (overall inventory row added).

- [ ] **Step 2: Full validate**

```bash
CI=true pnpm run validate
```

Expected: exit 0.

- [ ] **Step 3: AC checklist**

```bash
wc -l plugins/superpowers-overrides/skills/spor-subagent-driven-development/SKILL.md
rg -c "When Rule 0a applies, skip" plugins/superpowers-overrides/skills/spor-subagent-driven-development/SKILL.md
! rg -n "Override Step 5" plugins/superpowers-overrides/skills/spor-subagent-driven-development/SKILL.md
rg -n "^\s+[0-9]+\. \*\*code-review\*\*" plugins/superpowers-overrides/skills/spor-subagent-driven-development/SKILL.md
```

Expected: lines ≤160; skip guard count 3; no `Override Step 5`; no numbered code-review dispatch step under Rule 5c (pointer-only).

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-08-05-sdd-token-efficiency-overall.md \
        docs/superpowers/specs/2026-08-05-sdd-slim-orchestrator-v2-design.md
git commit -m "docs: add p1-slim.1 inventory row and mark overall sync"
```
