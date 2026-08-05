# SDD Slim Orchestrator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Slim the SDD orchestrator session by forbidding upstream SDD load on CLI-default paths, moving worker discipline to `templates/sdd-cli/` as SOT, and splitting spor-SDD Rules into CLI vs p0-only guards.

**Architecture:** In-place refactor of `spor-subagent-driven-development` (new Rule 0 path branch; Rule 3/5 split with guards). Router-only `spor-executing-plans`. `implement.md` gains commit + `TASK_BASE` contract. No new skills, no bin changes.

**Tech Stack:** Markdown skills/templates, Bash validation (`pnpm run validate`), grep smoke checks.

**Spec:** [2026-08-05-sdd-slim-orchestrator-design.md](../specs/2026-08-05-sdd-slim-orchestrator-design.md)

## Global Constraints

- Scope: **`superpowers-overrides` skill + template text only**
- **Do not** edit upstream `plugins/superpowers/skills/subagent-driven-development/`
- **Do not** change p0 handoff schema or `bin/sdd-run-task-*.sh` behavior
- **Do not** add skills or `overrides.manifest.json` rows
- **Preserve** p0 in-session fallback (lazy upstream SDD load on Rule 0b)
- Conventional commits (`feat:` / `fix:` / `docs:` / `chore:`); no attribution trailers
- After all tasks: `pnpm run validate` must pass

## File map

| File | Responsibility |
|------|----------------|
| `plugins/superpowers-overrides/skills/spor-subagent-driven-development/SKILL.md` | Rule 0 + Rule 3/5 split + Red Flags |
| `plugins/superpowers-overrides/skills/spor-executing-plans/SKILL.md` | Router-only; drop Rules 3/5 |
| `plugins/superpowers-overrides/templates/sdd-cli/implement.md` | Commit + TASK_BASE instruct |
| `plugins/superpowers-overrides/skills/spor-token-efficient-controller-handoff/SKILL.md` | H6 worker SOT cross-ref |
| `docs/superpowers/specs/2026-08-05-sdd-token-efficiency-overall.md` | Add p1-slim inventory row |

---

### Task 1: spor-SDD Rule 0 + Rule 3/5 split

**Files:**
- Modify: `plugins/superpowers-overrides/skills/spor-subagent-driven-development/SKILL.md`

**Interfaces:**
- Consumes: spec §2.2, §2.5, §2.7; existing Rules 1–7 unchanged except where noted
- Produces: Rule 0 (0a/0b), guarded Rule 3, split Rule 5 (5a/5b/5c), updated Rule 4 note, new Red Flags

- [ ] **Step 1: Insert Rule 0 before Rule 1**

Add `### Rule 0 — Path branch (p1-slim)` immediately after `## Rules` and before `### Rule 1`.

**Language:** Write Rule 0 body in **English** (match existing spor-SDD). Use spec §2.2 + §2.5 as semantic SOT — translate, do not paste Chinese verbatim.

**Rule 0a — CLI-default** bullets 1–3: from spec §2.2 Rule 0a items 1–3.

**Rule 0a item 4 — inline orchestrator duties:** replace spec's "见 §2.5" pointer by **inlining** these subsections (checklist — all must appear):

*Setup (once per session):*
1. Run `scripts/sdd-workspace PLAN_FILE` → workspace path
2. Ledger check/create: first line `# SDD ledger — plan: <plan path>`
3. Read plan once → write `plan-constraints.md`
4. Pre-flight batch question for plan conflicts
5. Todo per task

*Per-task loop:*
1. Rule 1: Simple/Complex + optional batching
2. Rule 4: cheap-model confirm before first H6 shell (once)
3. Write `TASK_BASE: <sha>` into `task-N-brief.md` (`git rev-parse HEAD`) immediately before first H6 shell of the chain; batch: `FIRST_TASK_BASE`
4. Shell H6 four-mode chain (Rule 7)
5. Read handoff.json → Rule 5a gates + Rule 6
6. `CHANGES_REQUESTED` → Rule 2 fix loop (H6 fix segments, cap 5)
7. APPROVED → ledger append
8. Continuous execution; **do not** repeat Setup mid-plan

*Final (orchestrator in-session):*
1. Dispatch `superpowers:requesting-code-review` whole-branch — no ad-hoc review
2. Clean = no blocking findings + Rule 6 test evidence satisfied
3. Clean → `superpowers:finishing-a-development-branch`
4. No CLI dispatch for final review (p1 Q8)

**Rule 0a item 5:** Per-task review steps 2–8 run inside H6 CLI subprocesses — orchestrator does NOT dispatch handoff-writer or code-review in-session.

**Rule 0b — p0 fallback:** from spec §2.2 items 1–4 (English).

- [ ] **Step 2: Guard Rule 3**

Prepend to `### Rule 3`:

```markdown
**(p0 fallback only)** When Rule 0a applies, skip this rule — see `templates/sdd-cli/implement.md`.
```

Update frontmatter `description`: remove standalone "implementer subagents delegate to mattpocock-skills:tdd" phrasing; say "CLI-default forbids upstream SDD load; p0 fallback delegates tdd".

- [ ] **Step 3: Replace Rule 5 with 5a / 5b / 5c**

Rename current `### Rule 5` to `### Rule 5a — Orchestrator gates (both paths)`.

Keep only orchestrator-side content:
- Opening guard: `When Rule 0a applies, steps 2–8 of the review chain run inside H6 CLI subprocesses per templates/sdd-cli/ — orchestrator does NOT dispatch handoff-writer or code-review in-session.`
- Numbered list: Read handoff only; plan_conflicts STOP; CHANGES_REQUESTED → Rule 2; NEEDS_CONTEXT/unverifiable STOP
- Cite controller-handoff H1–H8

Add `### Rule 5b — In-session implementer dispatch (p0 fallback only)`:
- Guard skip on Rule 0a
- Move current Rule 5 step 1 (implementer → report + test-evidence + H1) here
- Add commit paragraph from spec §2.2 Rule 5b

Add `### Rule 5c — In-session per-task review (p0 fallback only)`:
- Guard skip on Rule 0a
- Move current Rule 5 steps 2–8 + Degradation block here unchanged

Fix cross-refs after split — run and update every hit:

```bash
rg -n "Rule 5" plugins/superpowers-overrides/skills/spor-subagent-driven-development/SKILL.md
```

Minimum updates:
- Rule 1 L25: `see Rule 5` → `see Rule 5a/5c` (5c p0-only; CLI-default uses templates + H6)
- Rule 3 implementer line: `Rule 5 step 1` → `Rule 5b`
- Rule 6 item 2: `Rule 5 step 7` → `Rule 5a`

- [ ] **Step 4: Patch Rule 4 and Rule 7**

Rule 4 — append after existing bullets:

```markdown
**CLI-default (Rule 0a):** cheap-model confirmation happens once before the first H6 shell. CLI implement sessions use the harness default cheap tier — do not duplicate model selection in `implement.md`.
```

Rule 7 item 2 — change `p0 Rule 5/6` → `p0 Rule 5b/5c/6 + H1–H5 in-session`.

- [ ] **Step 5: Add Red Flags and Rationalizations rows**

Append to Red Flags list:
- `"CLI available — I'll Read upstream SDD for Setup context."`
- `"Rule 0a — I'll paraphrase tdd in the override instead of citing implement.md."`
- `"p0 fallback — skip the announce line."`

Append Rationalizations row:
| `"Rule 5c is redundant when CLI works"` | `"Rule 0b requires full p0 path; 5c is the only in-session review dispatch."` |

- [ ] **Step 6: Verify Rule 0 + guards**

```bash
rg -n "### Rule 0|TASK_BASE|When Rule 0a applies, skip" plugins/superpowers-overrides/skills/spor-subagent-driven-development/SKILL.md
rg -n "dispatch.*implementer|invoke.*tdd" plugins/superpowers-overrides/skills/spor-subagent-driven-development/SKILL.md
```

Expected: Rule 0 + TASK_BASE present; tdd/implementer matches only in Rule 3, Rule 5b, or p0-only lines.

- [ ] **Step 7: Commit**

```bash
git add plugins/superpowers-overrides/skills/spor-subagent-driven-development/SKILL.md
git commit -m "feat: add SDD Rule 0 path branch and split Rule 5 for p1-slim"
```

---

### Task 2: spor-executing-plans router-only

**Files:**
- Modify: `plugins/superpowers-overrides/skills/spor-executing-plans/SKILL.md`

**Interfaces:**
- Consumes: Task 1 Rule 0 (redirect target)
- Produces: Rules 1–2, 4 (inline-only) only; updated frontmatter + Red Flags

- [ ] **Step 1: Update frontmatter description**

Replace `description:` with:

```yaml
description: MUST invoke BEFORE superpowers:executing-plans as your FIRST tool call this turn — trigger on ANY of: (1) user types `/spor-executing-plans`, `/superpowers-overrides:spor-executing-plans`, `/executing-plans` or `/superpowers:executing-plans`; (2) a `<command-name>` tag in the current turn names either of those; (3) the superpowers:executing-plans skill body appears in the current turn's system context; (4) user asks in natural language to execute a plan, implement a written plan file, or run through tasks in a plan doc. Applies personal overrides — redirects to subagent-driven-development when subagents available; refuses using-git-worktrees; inline-only commit when no subagents.
```

- [ ] **Step 2: Delete Rule 3 and Rule 5**

Remove entire `### Rule 3 — Implementer discipline delegates to mattpocock-skills:tdd` section.

Remove entire `### Rule 5 — After SDD redirect, apply p0 handoff discipline` section.

- [ ] **Step 3: Guard Rule 4**

Change heading to `### Rule 4 — Commit after each task (inline fallback only)`.

Insert as first line of Rule 4 body:

```markdown
When Rule 1 redirects to SDD, this rule does not apply — commit is SDD Rule 0a + `templates/sdd-cli/implement.md` or Rule 5b (p0).
```

Keep existing inline commit paragraph unchanged below the guard.

- [ ] **Step 4: Clean Red Flags / Rationalizations**

Remove Red Flag: `"executing-plans entry skips CLI when user typed /executing-plans."`

Remove Rationalizations rows:
- `"Each plan step is small, TDD adds overhead"`
- `"executing-plans is inline — no CLI"`

- [ ] **Step 5: Verify router shape**

Run:

```bash
rg -n "^### Rule" plugins/superpowers-overrides/skills/spor-executing-plans/SKILL.md
```

Expected: exactly `Rule 1`, `Rule 2`, `Rule 4` (no Rule 3 or 5).

- [ ] **Step 6: Commit**

```bash
git add plugins/superpowers-overrides/skills/spor-executing-plans/SKILL.md
git commit -m "feat: slim executing-plans override to router-only"
```

---

### Task 3: implement.md commit + controller-handoff cross-ref

**Files:**
- Modify: `plugins/superpowers-overrides/templates/sdd-cli/implement.md`
- Modify: `plugins/superpowers-overrides/skills/spor-token-efficient-controller-handoff/SKILL.md`

**Interfaces:**
- Consumes: Task 1 Rule 0a (TASK_BASE brief contract)
- Produces: implement template steps 5–7 with commit block; H6 table row for worker SOT

- [ ] **Step 1: Replace implement.md steps 5–6 with commit block**

In `plugins/superpowers-overrides/templates/sdd-cli/implement.md`, replace current steps 5–6 with:

```markdown
5. **Commit (base/head contract):**
   - `base` = SHA in the task brief as `TASK_BASE` (orchestrator writes this immediately before the H6 implement shell — `git rev-parse HEAD` at chain start). Batch blocks: use `FIRST_TASK_BASE` from brief.
   - After tests pass: if TDD already created **one or more** conventional commits covering this task's changes, set `head` = `git rev-parse HEAD` (do not create duplicate commits).
   - Otherwise: create **one** conventional commit (`feat:` / `fix:` / `refactor:` / …) with subject aligned to the task brief; no attribution / co-author / AI-generation trailers; then `head` = `git rev-parse HEAD`.
   - Uncommitted changes at return → `status: BLOCKED`.
6. Do **not** write or update handoff.json — a separate `mode=handoff` CLI invocation runs `spor-handoff-writer`.
7. Do **not** write ledger (`{{WORKSPACE}}/progress.md`) — orchestrator-only.
```

Steps 1–4 remain unchanged.

- [ ] **Step 2: Add H6 table row in controller-handoff**

In `spor-token-efficient-controller-handoff/SKILL.md`, add a row to the H6 four-mode table:

| `implement` | … existing …; **`TASK_BASE` in brief**; commit per `templates/sdd-cli/implement.md` |

Add after the table (new row or footnote row):

| Worker discipline SOT | `templates/sdd-cli/{implement,handoff,review,fix}.md` — orchestrator must not paraphrase delegation |

**§2.7 degradation (verify-only):** p1 defines CLI review degradation. Do **not** edit `review.md` unless dogfood finds a gap. Task 4 smoke row 6 verifies Rule 5c degradation survived the split.

- [ ] **Step 3: Verify implement template**

Run:

```bash
rg -n "TASK_BASE|conventional commit|BLOCKED" plugins/superpowers-overrides/templates/sdd-cli/implement.md
```

Expected: all three patterns present.

- [ ] **Step 5: Commit**

```bash
git add plugins/superpowers-overrides/templates/sdd-cli/implement.md \
        plugins/superpowers-overrides/skills/spor-token-efficient-controller-handoff/SKILL.md
git commit -m "feat: add per-task commit contract to SDD implement CLI template"
```

---

### Task 4: overall inventory + validate + smoke checklist

**Files:**
- Modify: `docs/superpowers/specs/2026-08-05-sdd-token-efficiency-overall.md`
- Modify: `docs/superpowers/specs/2026-08-05-sdd-slim-orchestrator-design.md` (§ Smoke results after dogfood)

**Interfaces:**
- Consumes: Tasks 1–3 complete
- Produces: overall inventory row; passing CI validate

- [ ] **Step 1: Add p1-slim row to overall Decomposition table**

In `docs/superpowers/specs/2026-08-05-sdd-token-efficiency-overall.md`, after the p1 row, add:

```markdown
| 薄 orchestrator + 模板 SOT | **p1-slim** | [p1-slim design](2026-08-05-sdd-slim-orchestrator-design.md) | p1 ship | [plan](../plans/2026-08-05-sdd-slim-orchestrator.md) published |
```

Add to **交付物摘要** table:

```markdown
| p1-slim | Rule 0 CLI/p0 branch; Rule 5 split; executing-plans router; implement.md commit |
```

Bump overall **Version** patch (e.g. v2.1 → v2.2) and append change-history line if section exists.

- [ ] **Step 2: Run full validate**

From **repository root**:

```bash
pnpm run validate
```

Expected: exit 0.

- [ ] **Step 3: Grep smoke — no double-write**

```bash
# executing-plans must not mention tdd delegate
! rg -n "mattpocock-skills:tdd" plugins/superpowers-overrides/skills/spor-executing-plans/SKILL.md

# spor-SDD Rule 3 must have p0 guard
rg -n "When Rule 0a applies, skip" plugins/superpowers-overrides/skills/spor-subagent-driven-development/SKILL.md | head -5

# Rule 0 must exist
rg -n "### Rule 0" plugins/superpowers-overrides/skills/spor-subagent-driven-development/SKILL.md
```

Expected: first command exits 1 (no matches); second and third succeed.

- [ ] **Step 4: Manual dogfood checklist (human verify-only — not blocking impl done)**

After Steps 1–3 pass, append **`## Smoke results`** to `docs/superpowers/specs/2026-08-05-sdd-slim-orchestrator-design.md` **after §3 Acceptance criteria, before §4 Non-goals**. Keep existing §3 items 1–5 unchanged; add table:

```markdown
## Smoke results

| # | Check | Pass? | Date |
|---|-------|-------|------|
| 1 | CLI-default: orchestrator does not Read upstream SDD skill body | | |
| 2 | p0: `SDD_NO_CLI=1` → announce + Read upstream SDD | | |
| 3 | implement CLI → handoff commits.base/head match git | | |
| 4 | No unguarded tdd delegate in spor-SDD / executing-plans | | |
| 5 | `pnpm run validate` green | | |
| 6 | Rule 5c degradation block present; Rule 0b path loads upstream SDD | | |
```

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-08-05-sdd-token-efficiency-overall.md \
        docs/superpowers/specs/2026-08-05-sdd-slim-orchestrator-design.md
git commit -m "docs: add p1-slim phase to SDD token efficiency overall spec"
```

---
