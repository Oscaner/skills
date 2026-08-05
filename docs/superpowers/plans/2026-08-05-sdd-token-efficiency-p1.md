# SDD Token 效率 — Phase p1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship p1 CLI physical clear — plugin-bundled `sdd-run-task/plan-*` scripts (cursor+claude full, 3 stubs), H6–H8, SDD Rule 7, 4-mode CLI chain per task.

**Architecture:** `bin/lib/sdd-common.sh` holds path/env/template logic; harness scripts are thin wrappers calling `cursor agent` / `claude`; prompt templates instruct p0 skills (tdd, handoff-writer, code-review). Orchestrator/plan driver stays out of CLI sessions.

**Tech Stack:** Bash, Markdown templates, upstream `review-package` / `sdd-workspace`, `pnpm run validate`, `validate-overrides-build.sh`.

**Spec:** [p1 design v1.2.1](../specs/2026-08-05-sdd-token-efficiency-p1-design.md)

**Prerequisite (hard gate):** **p0 release tag** published (e.g. `superpowers-overrides@6.2.0-overrides.14+`); handoff schema frozen. Do **not** start Task 1 until tag exists.

## Global Constraints

- **Scope:** `plugins/superpowers-overrides/bin/`, `templates/sdd-cli/`, skill H6–H8 / Rule 7, tests, docs — **no** upstream superpowers edits; **no** p0 handoff schema changes.
- **Plugin-bundled only (H7):** scripts live under `{plugin_root}/bin/`; never Write copies to consumer projects.
- **4 modes:** `implement | handoff | review | fix` — one mode per CLI invocation; `SDD_HANDOFF_SEGMENT` for handoff mode.
- **Exit codes:** 0=OK; 1=BLOCKED/stub; 2=CLI missing → orchestrator falls back to p0.
- **Ledger:** orchestrator/plan script append only — CLI never writes ledger.
- **Final review:** orchestrator in-session (p0 path) — no CLI final-review mode in p1.
- **Ship gate:** `pnpm run validate` + validate-overrides-build + manual smoke checklist + changeset.
- **Commits:** conventional (`feat:`/`chore:`); no AI trailers; commit after each task.

---

## File structure (locked)

| Path | Responsibility |
|------|----------------|
| `bin/lib/sdd-common.sh` | plugin_root, env validation, template render, handoff check, exit codes |
| `bin/sdd-run-task-cursor.sh` | Full — 4-mode cursor agent |
| `bin/sdd-run-task-claude.sh` | Full — 4-mode claude |
| `bin/sdd-run-plan-cursor.sh` | Mode B — pending tasks loop |
| `bin/sdd-run-plan-claude.sh` | Mode B — pending tasks loop |
| `bin/sdd-run-task-{codex,copilot,gemini}.sh` | Stub — exit 1 HARNESS_STUB |
| `bin/sdd-run-plan-{codex,copilot,gemini}.sh` | Stub |
| `templates/sdd-cli/{implement,handoff,review,fix}.md` | CLI prompt bodies |
| `skills/spor-token-efficient-controller-handoff/SKILL.md` | Add H6–H8 |
| `skills/spor-subagent-driven-development/SKILL.md` | Add Rule 7 |
| `skills/spor-executing-plans/SKILL.md` | Cite H6–H8 |
| `tests/validate-overrides-build.sh` | Assert 10 scripts + common executable |

---

### Task 0: Preflight — p0 release gate

**Files:** (read-only)

- [ ] **Step 1:** Confirm p0 release tag exists on remote or `package.json` version matches released p0.

```bash
# Example — adjust tag to actual release
git tag -l 'superpowers-overrides@6.2.0-overrides.*' | tail -3
```

Expected: tag ≥ p0 ship; if missing → **STOP** (Q10 hard gate).

- [ ] **Step 2:** `pnpm run validate` exit 0.

- [ ] **Step 3:** Confirm p0 skills present (`spor-handoff-writer`, H1–H5 in controller-handoff, SDD Rule 5).

---

### Task 1: `sdd-common.sh` + CLI templates

**Files:**
- Create: `bin/lib/sdd-common.sh`
- Create: `templates/sdd-cli/implement.md`, `handoff.md`, `review.md`, `fix.md`

**Interfaces:**
- Produces: `sdd_render_template`, `sdd_require_env`, `sdd_plugin_root`, `sdd_assert_handoff`, exit code helpers

- [ ] **Step 1:** Implement `sdd-common.sh` per spec §2.2 (plugin_root from script path; env vars §2.3; exit 0/1/2).

- [ ] **Step 2:** Create 4 templates with placeholders `{{WORKSPACE}}`, `{{BRIEF}}`, `{{HANDOFF}}`, `{{SEGMENT}}`, `{{FINDINGS}}`, `{{CONSTRAINTS}}`, `{{FIXED_POINT}}` and skill instruct text from spec §2.5.

- [ ] **Step 3:** `shellcheck` or bash `-n` on common.sh if available.

- [ ] **Step 4:** Commit `feat: add sdd-common.sh and sdd-cli templates (p1)`.

---

### Task 2: Skill rules H6–H8 + Rule 7

**Files:**
- Modify: `skills/spor-token-efficient-controller-handoff/SKILL.md`
- Modify: `skills/spor-subagent-driven-development/SKILL.md`
- Modify: `skills/spor-executing-plans/SKILL.md`

- [ ] **Step 1:** Add H6–H8 to controller-handoff (4 modes, env table, opt-out chain, workspace §2.2a, batch §2.2b).

- [ ] **Step 2:** Add SDD Rule 7 + Red Flags (CLI mandatory, exit 2→p0, stub→BLOCKED, Rule 6 gates, final review in-session).

- [ ] **Step 3:** executing-plans cite H6–H8 after Rule 5.

- [ ] **Step 4:** Commit `feat: add p1 H6–H8 and SDD Rule 7`.

---

### Task 3: Cursor full harness scripts

**Files:**
- Create: `bin/sdd-run-task-cursor.sh`
- Create: `bin/sdd-run-plan-cursor.sh`

- [ ] **Step 1:** Task script: parse `--task`, `--mode`, `--segment`; source common.sh; review mode runs upstream `review-package` via workspace plan path; invoke `cursor agent` with rendered template; verify handoff; stdout H1 4 lines.

- [ ] **Step 2:** Plan script: parse `--plan`; resolve workspace; loop pending tasks (spec §模式 B); call task script 4-mode chain; append ledger on APPROVED.

- [ ] **Step 3:** File header comment documents exact `cursor agent` flags (source of truth).

- [ ] **Step 4:** `chmod +x` both scripts.

- [ ] **Step 5:** Commit `feat: add cursor sdd-run-task/plan scripts (p1)`.

---

### Task 4: Claude full harness scripts

**Files:**
- Create: `bin/sdd-run-task-claude.sh`
- Create: `bin/sdd-run-plan-claude.sh`

- [ ] **Step 1–4:** Mirror Task 3 for `claude` CLI (Skill(...) prefix in templates where needed).

- [ ] **Step 5:** Commit `feat: add claude sdd-run-task/plan scripts (p1)`.

---

### Task 5: Stub harness scripts (codex, copilot, gemini)

**Files:**
- Create: 6 stub scripts under `bin/`

- [ ] **Step 1:** Each stub: source common.sh; print `HARNESS_STUB: …` to stderr; exit 1.

- [ ] **Step 2:** `chmod +x` all six.

- [ ] **Step 3:** Commit `feat: add stub sdd-run scripts for codex/copilot/gemini (p1)`.

---

### Task 6: Validate build + docs

**Files:**
- Modify: `tests/validate-overrides-build.sh`
- Modify: `README.md`, `README.zh-CN.md`, `docs/cross-harness-overrides.md`

- [ ] **Step 1:** Extend validate script: assert 10 harness scripts + `bin/lib/sdd-common.sh` exist and `-x`.

- [ ] **Step 2:** README harness → script mapping table; cross-harness SDD CLI section.

- [ ] **Step 3:** `pnpm run validate` exit 0.

- [ ] **Step 4:** Commit `docs: p1 SDD CLI harness mapping and validate checks`.

---

### Task 7: Ship gate + spec status

- [ ] **Step 1:** Manual smoke checklist (spec Verification) — document results in task report.

- [ ] **Step 2:** Context baseline note (qualitative: orchestrator did not Read report bodies during 4-mode chain).

- [ ] **Step 3:** `pnpm changeset` for superpowers-overrides minor.

- [ ] **Step 4:** Update p1 spec Status → Approved/Shipped as appropriate.

- [ ] **Step 5:** Commit `chore: p1 ship gate changeset`.

---

## Manual smoke (post-ship)

1. Cursor 3-task plan: 4-mode chain completes; handoff APPROVED; ledger lines appended.
2. Rename/move `cursor` off PATH → orchestrator/script exit 2 → p0 fallback path documented.
3. Invoke stub harness script → exit 1 BLOCKED.
4. Consumer repo: no new `sdd-run-*.sh` files.

## Metrics (deferred)

Overall ≤15% context increment — measure on first dogfood 10-task plan post-ship; document method in release notes.

---