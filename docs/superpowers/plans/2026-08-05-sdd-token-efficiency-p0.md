# SDD Token 效率 — Phase p0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship p0 handoff + lean review in `superpowers-overrides` — H1–H5 controller discipline, `spor-handoff-writer`, SDD Rule 5/6 code-review delegation, executing-plans cite, D4 review dispatch.

**Architecture:** Two new cross-cutting skills (controller-handoff + handoff-writer) hold file-only contracts and JSON schema; existing SDD / executing-plans overrides cite them and replace multi-pass reviewers with `mattpocock-skills:code-review` + handoff-writer chain. No upstream superpowers or CLI changes.

**Tech Stack:** Markdown SKILL.md, JSON handoff schema (documented in skills), `pnpm run validate`, optional Python tests under `plugins/superpowers-overrides/tests/`.

**Spec:** [p0 design v1.3.1](../specs/2026-08-05-sdd-token-efficiency-p0-design.md)

**Prerequisite:** penf @ `6.2.0-overrides.12`+ shipped; `pnpm run validate` green on working branch before Task 1.

## Global Constraints

- **Scope:** `plugins/superpowers-overrides/**` only — **no** upstream `plugins/superpowers/**`; **no** p1 CLI; **no** emit/marketplace changes unless validate fails. Root `README.md` has no cross-cutting table — doc updates target **plugin** `README.md` + `README.zh-CN.md` only (spec Files to change root rows superseded here).
- **Plugin discovery:** `.claude-plugin/plugin.json` uses `"skills": "./skills/"` — new skill dirs auto-resolve; **do not** hand-edit unless validate reports orphan/missing.
- **Override pattern:** Four-trigger frontmatter on slash-command skills; cross-cutting skills cite-only (no slash); Red Flags + Common Rationalizations required.
- **Citations:** SDD Rule 5/6 cite `spor-token-efficient-controller-handoff` and `spor-handoff-writer` by relative path — do not paraphrase H1–H5 inline.
- **Ship gate:** `pnpm run validate` 全绿 + spec AC checklist + changeset for release.
- **Commits:** conventional (`feat:`); no AI trailers; **commit after each task** (plan default).

---

## File structure (locked)

| File | Responsibility |
|------|----------------|
| `skills/spor-token-efficient-controller-handoff/SKILL.md` | H1–H5 cross-cutting; cite-only |
| `skills/spor-handoff-writer/SKILL.md` | Independent handoff JSON writer; D3 output |
| `templates/sdd-handoff-writer-prompt.md` | Dispatch prompt template for handoff-writer subagent |
| `skills/spor-token-efficient-review-dispatch/SKILL.md` | Add D4 code-review dual-axis gate |
| `skills/spor-subagent-driven-development/SKILL.md` | Replace Rule 1; Rule 2 fix loop; new Rule 5/6 |
| `skills/spor-executing-plans/SKILL.md` | New Rule 5 — cite controller-handoff after SDD redirect |
| `plugins/superpowers-overrides/README.md` / `README.zh-CN.md` | Cross-cutting table rows for new skills |

**Untouched:** `overrides.manifest.json` (no slash hooks for new skills), upstream superpowers, marketplace emit.

---

### Task 0: Preflight — baseline green

**Files:** (read-only)

**Interfaces:**
- Produces: confirmation penf shipped, validate green, current SDD Rule 1 baseline captured

- [ ] **Step 1: Verify validate passes**

```bash
cd /Users/kang/Projects/oscaner-skills && fnm use && pnpm run validate
```

Expected: exit 0.

- [ ] **Step 2: Confirm penf prerequisite**

```bash
node -e "const p=require('./plugins/superpowers-overrides/package.json'); console.log('overrides version:', p.version);"
test -f plugins/superpowers-overrides/hooks/hooks-cursor.json && echo 'OK — penf cursor hooks present'
```

Expected: version ≥ `6.2.0-overrides.12`; hooks file exists.

- [ ] **Step 3: Snapshot current SDD Rule 1**

```bash
grep -n 'Complex tasks — up to 3 rounds' plugins/superpowers-overrides/skills/spor-subagent-driven-development/SKILL.md
```

Expected: match found (pre-p0 baseline).

---

### Task 1: `spor-token-efficient-controller-handoff` skill

**Files:**
- Create: `plugins/superpowers-overrides/skills/spor-token-efficient-controller-handoff/SKILL.md`

**Interfaces:**
- Produces: H1–H5 per spec §2.1

- [ ] **Step 1: Create SKILL.md with cross-cutting frontmatter**

```yaml
---
name: spor-token-efficient-controller-handoff
description: Cross-cutting SDD orchestrator handoff discipline (H1–H5). Invoked by reference from spor-subagent-driven-development and spor-executing-plans. No slash command.
---
```

- [ ] **Step 2: Write H1–H5 Rules** from spec §2.1 (include H1 4-line canonical format, batch open-findings naming, fix cap 5).

- [ ] **Step 3: Red Flags + Common Rationalizations** (≥4 each theme: read review prose, skip writer, paste summaries, silent fix-cap exceed).

- [ ] **Step 4: Verify on disk**

```bash
test -f plugins/superpowers-overrides/skills/spor-token-efficient-controller-handoff/SKILL.md && echo OK
```

- [ ] **Step 5: Commit**

```bash
git add plugins/superpowers-overrides/skills/spor-token-efficient-controller-handoff/
git commit -m "$(cat <<'EOF'
feat: add spor-token-efficient-controller-handoff cross-cutting skill (p0 H1–H5)
EOF
)"
```

---

### Task 2: `spor-handoff-writer` + template

**Files:**
- Create: `plugins/superpowers-overrides/skills/spor-handoff-writer/SKILL.md`
- Create: `plugins/superpowers-overrides/templates/sdd-handoff-writer-prompt.md`

**Interfaces:**
- Consumes: Task 1; spec §2.4 schema + lifecycle + test-evidence.json

- [ ] **Step 1: handoff-writer SKILL.md** — inputs (path-only), outputs (handoff.json + H1 4 lines), schema examples (single + batch), test gate, plan_conflicts, unverifiable→BLOCKED, D3, Red Flags.

- [ ] **Step 2: Template** `sdd-handoff-writer-prompt.md` with `{{phase}}`, `{{paths_list}}`, `{{handoff_path}}` placeholders.

- [ ] **Step 3: Commit**

```bash
git add plugins/superpowers-overrides/skills/spor-handoff-writer/ \
        plugins/superpowers-overrides/templates/sdd-handoff-writer-prompt.md
git commit -m "$(cat <<'EOF'
feat: add spor-handoff-writer skill and dispatch template (p0)
EOF
)"
```

---

### Task 3: Review-dispatch D4

**Files:**
- Modify: `plugins/superpowers-overrides/skills/spor-token-efficient-review-dispatch/SKILL.md`

- [ ] **Step 1: Add D4** per spec §2.6 (dual-axis one round, writer mandatory, `## Findings (D3)` JSON appendix).

- [ ] **Step 2: D4 Red Flags**

- [ ] **Step 3: Commit**

```bash
git add plugins/superpowers-overrides/skills/spor-token-efficient-review-dispatch/SKILL.md
git commit -m "$(cat <<'EOF'
feat: add D4 code-review dual-axis gate to review-dispatch (p0)
EOF
)"
```

---

### Task 4: SDD override — Rule 1/2/5/6

**Files:**
- Modify: `plugins/superpowers-overrides/skills/spor-subagent-driven-development/SKILL.md`

- [ ] **Step 1: Replace Rule 1** — remove 6-pass table; keep Simple/Complex classification; **rewrite Batching** to spec §2.3 (batch handoff file, one review pass, per-task ledger, `review_scope: batch`, `FIRST_TASK_BASE`).

- [ ] **Step 2: Update Rule 2** — fix loop + cap 5 + H4 cite.

- [ ] **Step 3: Add Rule 5** — full per-task sequence; §2.2 review file paths; review-package one-line stdout; code-review Step 5 override (`WRITTEN: <path>` only); adaptive diff input mapping; degradation §2.8; cites Tasks 1–3.

- [ ] **Step 4: Add Rule 6** — test gate; plan_conflicts; unverifiable→BLOCKED; **NEEDS_CONTEXT → STOP** (spec §2.4 lifecycle).

- [ ] **Step 5: Rule 4** — cheap implementer unchanged; code-review default model; handoff-writer cheap.

- [ ] **Step 6: Update Red Flags**

- [ ] **Step 7: Commit**

```bash
git add plugins/superpowers-overrides/skills/spor-subagent-driven-development/SKILL.md
git commit -m "$(cat <<'EOF'
feat: replace SDD per-task review with code-review + handoff-writer (p0)
EOF
)"
```

---

### Task 5: executing-plans Rule 5

**Files:**
- Modify: `plugins/superpowers-overrides/skills/spor-executing-plans/SKILL.md`

- [ ] **Step 1: Add Rule 5** — after SDD redirect, cite controller-handoff H1–H5; inline fallback out of scope.

- [ ] **Step 2: Commit**

```bash
git add plugins/superpowers-overrides/skills/spor-executing-plans/SKILL.md
git commit -m "$(cat <<'EOF'
feat: cite controller-handoff in executing-plans Rule 5 (p0)
EOF
)"
```

---

### Task 6: Plugin README docs (EN + zh-CN)

**Files:**
- Modify: `plugins/superpowers-overrides/README.md`
- Modify: `plugins/superpowers-overrides/README.zh-CN.md`

- [ ] **Step 1: EN table** — add controller-handoff + handoff-writer rows; update review-dispatch row to mention D4.

- [ ] **Step 2: zh-CN table** — mirror Step 1 in `README.zh-CN.md` Cross-cutting section.

- [ ] **Step 3: Commit**

```bash
git add plugins/superpowers-overrides/README.md plugins/superpowers-overrides/README.zh-CN.md
git commit -m "$(cat <<'EOF'
docs: document p0 handoff cross-cutting skills in plugin README (EN + zh-CN)
EOF
)"
```

---

### Task 7: Validate + changeset + ship gate

- [ ] **Step 1:** `pnpm run validate` — exit 0.

- [ ] **Step 2:** Python skill dir check (both new skills + SKILL.md).

- [ ] **Step 3:** Walk spec Acceptance criteria; note spec §4 quantified baselines **intentionally deferred** to post-ship dogfood (see Metrics section).

- [ ] **Step 4:** `pnpm changeset` for superpowers-overrides.

- [ ] **Step 5:** Bump p0 spec Status → `Approved` in local spec file.

- [ ] **Step 6: Commit**

```bash
git add .changeset/
git commit -m "$(cat <<'EOF'
chore: p0 ship gate changeset
EOF
)"
```

---

## Manual smoke (post-ship, qualitative)

1. Rule 5 never instructs orchestrator to Read review report bodies.
2. H1 4-line format in controller-handoff + handoff-writer.
3. Degradation relaxes H2 when mattpocock missing.

## Metrics (deferred)

Quantified token baselines — measure on first dogfood SDD run; not blocking this plan.
