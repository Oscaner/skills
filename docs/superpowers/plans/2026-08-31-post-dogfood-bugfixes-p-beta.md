# Pβ Skill Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three skill-layer issues: task heading H3 constraint (#198), Review Stopping unification (#195/#196), report-issue dedup closed detection (#194), plus directory restructuring for shared docs

**Architecture:** Changes span `packages/osuperpowers/skills/` (writing-plans, brainstorming, report-issue SKILL.md files), `packages/osuperpowers/skills/_docs/` (new shared docs directory), and zh-CN mirrors. Destructive refactors allowed per user authorization.

**Tech Stack:** Markdown (SKILL.md files), shell (git mv for file moves)

## Global Constraints

- 仓库语言政策：SKILL.md / docs 英文主源 + zh-CN 镜像
- 不 commit 除非用户明确要求；changeset 逐 phase 建
- vendored 子模块不可改
- All zh-CN mirrors MUST be updated as part of the same task as the English source
- `pnpm run validate` must pass after all tasks
- Destructive refactors allowed (user authorized)

---

### Task 1: Move docs-review.md to _docs/ (directory restructure)

**Files:**
- Move: `packages/osuperpowers/skills/brainstorming/docs/docs-review.md` → `packages/osuperpowers/skills/_docs/docs-review.md`
- Move: `packages/osuperpowers/skills/brainstorming/docs/docs-review.zh-CN.md` → `packages/osuperpowers/skills/_docs/docs-review.zh-CN.md`

**Interfaces:** None (file move only; downstream tasks reference the new path)

- [ ] **Step 1: Create _docs/ directory**

```bash
mkdir -p packages/osuperpowers/skills/_docs
```

- [ ] **Step 2: Move docs-review.md and zh-CN mirror**

```bash
git mv packages/osuperpowers/skills/brainstorming/docs/docs-review.md packages/osuperpowers/skills/_docs/docs-review.md
git mv packages/osuperpowers/skills/brainstorming/docs/docs-review.zh-CN.md packages/osuperpowers/skills/_docs/docs-review.zh-CN.md
```

- [ ] **Step 3: Verify both files exist at new path**

```bash
ls -la packages/osuperpowers/skills/_docs/docs-review.md packages/osuperpowers/skills/_docs/docs-review.zh-CN.md
```

Expected: both files present at `_docs/`

- [ ] **Step 4: Verify old path removed**

```bash
ls packages/osuperpowers/skills/brainstorming/docs/docs-review.md 2>&1
```

Expected: "No such file" — old path cleaned up

- [ ] **Step 5: Commit**

```bash
git add packages/osuperpowers/skills/_docs/ packages/osuperpowers/skills/brainstorming/docs/
git commit -m "refactor: move docs-review.md to _docs/ (cross-skill shared) (#195)"
```

---

### Task 2: writing-plans SKILL.md refactor (#198 + #195)

**Files:**
- Modify: `packages/osuperpowers/skills/writing-plans/SKILL.md`
- Modify: `packages/osuperpowers/skills/writing-plans/SKILL.zh-CN.md` (mirror sync)

**Interfaces:**
- Consumes: `_docs/docs-review.md` path (Task 1)

- [ ] **Step 1: Add I5 H3 invariant to writing-plans SKILL.md**

Add new invariant I5 to the Invariants table (after I4):

```
| I5 | **Task Heading H3** — Plan task headings MUST use H3 (`### Task N:` format), matching brief.mjs extraction pattern (line 11 in `packages/osuperpowers/bin/engine/lib/brief.mjs`). H2 or any other level will cause brief extraction failure at CDD dispatch time. |
```

- [ ] **Step 2: Update write-plan Do field with H3 constraint**

In the `write-plan` node's Do field, add after "Each section uses one tool call (Section-by-Section — I2)":

```
Task headings MUST be H3 (`### Task N:`), matching the brief extraction format in `brief.mjs`.
```

- [ ] **Step 3: Update plan-review Do field reference path**

In the `plan-review` node, change the docs-review.md reference from `../brainstorming/docs/docs-review.md` to `../_docs/docs-review.md`:

```
Follow D1/D2/D3 from [docs-review.md](../_docs/docs-review.md)
```

Also update the Read field:
```
- **Read**: Plan document + spec document + [docs-review.md](../_docs/docs-review.md)
```

- [ ] **Step 4: Update plan-review Do field Review Stopping text to reference I4**

In the `plan-review` node's Do field, update the Review Stopping section to reference the invariant:

**Before:**
```
Review Stopping: ① run 3-pass → ② blocker found → fix → re-run only that pass → loop until blocker=0 → ③ all passes blocker=0 → present warn/nit to user → proceed.
```

**After:**
```
Review Stopping (see I4): ① run 3-pass → ② blocker found → fix → re-run only that pass → loop until blocker=0 → ③ all passes blocker=0 → present warn/nit to user → proceed.
```

- [ ] **Step 5: Update plan-review Fail field to reference I4**

Ensure the Fail field explicitly references I4:
```
- **Fail**: Re-run review after blocker=0 → violates I4 (Review Stopping). New cdd-review call for warn/nit → violates I4.
```

- [ ] **Step 6: Update Failure Modes table**

Add new failure mode:
```
| plan-review re-run after blocker=0 | Violates I4 (Review Stopping) — stop + report to user | Agent re-runs review after all passes are blocker=0 |
```

- [ ] **Step 7: Verify SKILL.md**

Read writing-plans SKILL.md to confirm:
- I5 invariant exists
- write-plan has H3 constraint
- plan-review references `_docs/docs-review.md`
- plan-review Fail references I4
- Failure Modes table has new entry

- [ ] **Step 8: Update zh-CN mirror**

Apply equivalent changes to SKILL.zh-CN.md.

- [ ] **Step 9: Verify zh-CN mirror**

Read SKILL.zh-CN.md to confirm all changes mirrored.

- [ ] **Step 10: Commit**

```bash
git add packages/osuperpowers/skills/writing-plans/SKILL.md packages/osuperpowers/skills/writing-plans/SKILL.zh-CN.md
git commit -m "refactor(writing-plans): add H3 invariant (I5), Review Stopping (I4), update docs-review path (#198 #195)"
```

---

### Task 3: brainstorming SKILL.md refactor (#195)

**Files:**
- Modify: `packages/osuperpowers/skills/brainstorming/SKILL.md`
- Modify: `packages/osuperpowers/skills/brainstorming/SKILL.zh-CN.md` (mirror sync)

**Interfaces:**
- Consumes: `_docs/docs-review.md` path (Task 1)

- [ ] **Step 1: Update wording of existing I5 Review Stopping in brainstorming SKILL.md**

brainstorming SKILL.md already has I5 = Review Stopping. This step updates the wording only — no new invariant is added. Change the I5 text to add the "all passes are" qualifier and "(read from already-captured output of the current review cycle)" clause:

**Current I5 text:**
```
| I5 | **Review Stopping** — re-run driven only by blockers; no re-run after blocker=0; no new cdd-review call to obtain warn/nit |
```

**Updated I5 text:**
```
| I5 | **Review Stopping** — re-run driven only by blockers; no re-run after all passes are blocker=0; no new cdd-review call to obtain warn/nit (read from already-captured output of the current review cycle). |
```

- [ ] **Step 2: Update spec-review Do field reference path**

In the `spec-review` node, change the docs-review.md reference from `./docs/docs-review.md` to `../_docs/docs-review.md`:

```
Follow D1/D2/D3 from [docs-review.md](../_docs/docs-review.md)
```

Also update the Read field:
```
- **Read**: Spec document + [docs-review.md](../_docs/docs-review.md)
```

- [ ] **Step 3: Update spec-review Fail field to reference I5**

Ensure the Fail field explicitly references I5:
```
- **Fail**: Re-run review after blocker=0 → violates I5 (Review Stopping). New cdd-review call for warn/nit → violates I5.
```

- [ ] **Step 4: Update spec-review Review Stopping text**

In the spec-review Do field, the Review Stopping section should reference the invariant:
```
Review Stopping (see I5): ① run 3-pass → ② blocker found → fix → re-run only that pass → loop until blocker=0 → ③ all passes blocker=0 → present warn/nit to user → proceed.
```

- [ ] **Step 5: Update Failure Modes table**

Add new failure mode to brainstorming SKILL.md:
```
| spec-review re-run after blocker=0 | Violates I5 (Review Stopping) — stop + report to user | Agent re-runs review after all passes are blocker=0 |
```

- [ ] **Step 6: Verify SKILL.md**

Read brainstorming SKILL.md to confirm:
- I5 invariant updated (wording)
- spec-review references `_docs/docs-review.md`
- spec-review Fail references I5
- Failure Modes has new entry

- [ ] **Step 7: Update zh-CN mirror**

Apply equivalent changes to SKILL.zh-CN.md.

- [ ] **Step 8: Verify zh-CN mirror**

Read SKILL.zh-CN.md to confirm all changes mirrored.

- [ ] **Step 9: Commit**

```bash
git add packages/osuperpowers/skills/brainstorming/SKILL.md packages/osuperpowers/skills/brainstorming/SKILL.zh-CN.md
git commit -m "refactor(brainstorming): update Review Stopping I5 wording, add Failure Modes entry, update docs-review path (#195)"
```

---

### Task 4: report-issue SKILL.md refactor (#194)

**Files:**
- Modify: `packages/osuperpowers/skills/report-issue/SKILL.md`
- Modify: `packages/osuperpowers/skills/report-issue/SKILL.zh-CN.md` (mirror sync)

**Interfaces:** None (self-contained skill change)

- [ ] **Step 1: Update dedup node to query --state all**

Find the `dedup` node's Do field. Change the gh issue list command:

**Before:**
```
gh issue list --repo Oscaner/skills --state open --limit 100 --json number,title,body
```

**After:**
```
gh issue list --repo Oscaner/skills --state all --limit 100 --json number,title,body,state
```

The `state` field is added to the JSON output for open/closed differentiation in resolve-hit.

- [ ] **Step 2: Refactor resolve-hit node to differentiate open vs closed**

Replace the current resolve-hit Do field:

**Before:**
```
- **Do**: When an existing issue matches, show the match and let the user choose three ways: **Create new issue / Add comment to existing / Skip**.
```

**After:**
```
- **Do**: When an existing issue matches, differentiate by state:
  - **Open match**: show the match and let the user choose: **Create new issue / Add comment to existing / Skip**.
  - **Closed match**: show the match (including close reason if available) and let the user choose: **Create new issue / Reopen + comment / Comment-only / Skip**. Reopen uses `gh issue reopen --repo Oscaner/skills <number>` before commenting.
```

- [ ] **Step 3: Add I4 Closed Issue Awareness invariant**

Add new invariant I4 to the Invariants table (after I3):

```
| I4 | **Closed Issue Awareness** — dedup queries `--state all` (not just open); closed matches present reopen+comment option; regressions against closed issues must not silently create duplicates. |
```

- [ ] **Step 4: Update Failure Modes table**

Add new failure mode:
```
| `gh issue reopen` fails | fail-open (report stderr, keep finding for manual retry) | Closed issue may be locked or restricted | User manually reopens |
```

- [ ] **Step 5: Verify SKILL.md**

Read report-issue SKILL.md to confirm:
- dedup queries `--state all` with `state` field
- resolve-hit has open vs closed branches
- I4 invariant exists
- Failure Modes has reopen failure entry

- [ ] **Step 6: Update zh-CN mirror**

Apply equivalent changes to SKILL.zh-CN.md.

- [ ] **Step 7: Verify zh-CN mirror**

Read SKILL.zh-CN.md to confirm all changes mirrored.

- [ ] **Step 8: Commit**

```bash
git add packages/osuperpowers/skills/report-issue/SKILL.md packages/osuperpowers/skills/report-issue/SKILL.zh-CN.md
git commit -m "refactor(report-issue): dedup closed issue detection, reopen+comment flow (#194)"
```

---

### Task 5: Validate

- [ ] **Step 1: Run full validation**

Run: `pnpm run emit && pnpm run validate`
Expected: All checks pass, exit 0

- [ ] **Step 2: Fix any emit drift**

If emit produces changes (from moved files), commit them:

```bash
git add packages/osuperpowers/skills/_docs/ packages/osuperpowers/skills/brainstorming/docs/ .agents/ marketplace/
git commit -m "chore: regenerate manifests after Pβ directory restructure"
```

- [ ] **Step 3: Re-run validation to confirm clean**

Run: `pnpm run validate`
Expected: ALL PASS

---

### Task 6: Changeset + Final commit

- [ ] **Step 1: Create changeset**

```bash
pnpm run changeset
```

Or manually create `.changeset/<slug>.md` with Pβ changes summary.

- [ ] **Step 2: Commit changeset**

```bash
git add .changeset/
git commit -m "chore: add changeset for Pβ skill fixes"
```

---
