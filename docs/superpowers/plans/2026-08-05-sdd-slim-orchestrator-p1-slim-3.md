# p1-slim.3 Orchestrator Load Footprint 瘦身 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce CLI-default SDD orchestrator load footprint from ~496 to ≤350 lines (Tier 2) by splitting controller-handoff H6–H8 to a reference doc, lazy-loading p0 rules, and single-sourcing handoff schema.

**Architecture:** Extract H6–H8 prose from `spor-token-efficient-controller-handoff` into `docs/sdd-h6-reference.md`; move spor-SDD Rules 3/5b/5c + D4 full text into `spor-sdd-p0-fallback` (on disk, Read only on Rule 0b); centralize handoff.json schema in `templates/sdd-handoff-schema.md`. No bin/hook behavior changes.

**Tech Stack:** Markdown skills, bash validation scripts, `pnpm run validate`

**Spec:** [2026-08-05-sdd-slim-orchestrator-p1-slim-3-design.md](../specs/2026-08-05-sdd-slim-orchestrator-p1-slim-3-design.md)

## Global Constraints

- No new row in `overrides.manifest.json` for `spor-sdd-p0-fallback`
- `spor-sdd-p0-fallback` lives under `skills/` (plugin.json globs `./skills/`) — lazy-load = Read on Rule 0b only
- No upstream superpowers SDD changes
- No CLI final whole-branch review
- Do not delete Red Flags / Common Rationalizations rows in spor-SDD
- spor-SDD ≤ **160** lines after edit
- controller-handoff ≤ **110** lines after edit
- Tier 1: spor-SDD + controller-handoff ≤ **225** lines
- Tier 2: Tier 1 + subagent-lifecycle + review-dispatch ≤ **350** lines
- PreToolUse gate + Rule 0a item 4 checklist semantics unchanged

---

## File structure (locked)

| File | Responsibility |
|------|----------------|
| `plugins/superpowers-overrides/docs/sdd-h6-reference.md` | H6–H8 CLI contract SOT (env, exit codes, harness table, Mode B) |
| `plugins/superpowers-overrides/templates/sdd-handoff-schema.md` | handoff.json schema SOT |
| `plugins/superpowers-overrides/skills/spor-sdd-p0-fallback/SKILL.md` | p0 Rules 3/5b/5c + D4 appendix |
| `plugins/superpowers-overrides/skills/spor-token-efficient-controller-handoff/SKILL.md` | H1–H5 + H6–H8 pointer |
| `plugins/superpowers-overrides/skills/spor-subagent-driven-development/SKILL.md` | CLI-default orchestrator; Rule 0b → p0-fallback |
| `plugins/superpowers-overrides/skills/spor-handoff-writer/SKILL.md` | Segment I/O; cite schema |
| `plugins/superpowers-overrides/skills/spor-token-efficient-review-dispatch/SKILL.md` | D4 pointer only |
| `plugins/superpowers-overrides/tests/sdd-orchestrator-line-budget.test.sh` | Tier 1/2 `wc -l` gate |
| `plugins/superpowers-overrides/tests/validate-overrides-build.sh` | Assert p0-fallback dir exists |

---

### Task 1: H6 reference doc + slim controller-handoff

**Files:**
- Create: `plugins/superpowers-overrides/docs/sdd-h6-reference.md`
- Modify: `plugins/superpowers-overrides/skills/spor-token-efficient-controller-handoff/SKILL.md`

**Interfaces:**
- Consumes: current controller-handoff lines 83–182 (H6–H8 + Mode B)
- Produces: `docs/sdd-h6-reference.md` with sections `H6`, `H7`, `H8`, `Mode B`; controller-handoff ends with pointer block per spec §2.1

- [ ] **Step 1: Create `docs/sdd-h6-reference.md`**

Copy verbatim (then lightly re-heading) from current controller-handoff `### Rule H6` through `**Mode B ...**` paragraph:

- Four-mode table (`SDD_MODE`: implement/handoff/review/fix)
- Env contract table (all 9 variables)
- Typical shell sequence (4 lines)
- Workspace path contract table
- Batching conventions table
- Exit codes 0/1/2
- H7 no consumer-repo scripts paragraph
- H8 opt-in/opt-out + harness mapping table
- Mode B summary paragraph

Add header:

```markdown
# SDD CLI Orchestrator Reference (H6–H8)

> Worker discipline SOT: `templates/sdd-cli/{implement,handoff,review,fix}.md`
> Orchestrator gate discipline: `spor-token-efficient-controller-handoff` H1–H5
```

- [ ] **Step 2: Slim controller-handoff SKILL.md**

Keep lines 1–82 (through H5). Delete old H6–H8 sections (lines 83–182).

Insert before `## Red Flags`:

```markdown
### Rule H6–H8 — CLI dispatch (reference)

Orchestrator: shell `sdd-run-task-<harness>.sh` per spor-SDD Rule 7; **do not** paraphrase env/exit/harness details — Read `{plugin_root}/docs/sdd-h6-reference.md` once per session if needed.

Worker discipline SOT remains `templates/sdd-cli/{implement,handoff,review,fix}.md`.
```

In H4 open-findings table: add cite `Full D3 shape: templates/sdd-handoff-schema.md`.

In H5: add `Schema: templates/sdd-handoff-schema.md`.

Update frontmatter `description`: change `H1–H8` → `H1–H5; H6–H8 in docs/sdd-h6-reference.md`.

- [ ] **Step 3: Verify line count**

Run:

```bash
wc -l plugins/superpowers-overrides/skills/spor-token-efficient-controller-handoff/SKILL.md
grep -E 'SDD_WORKSPACE|Exit codes' plugins/superpowers-overrides/docs/sdd-h6-reference.md
! grep -E 'SDD_WORKSPACE|Exit codes' plugins/superpowers-overrides/skills/spor-token-efficient-controller-handoff/SKILL.md
```

Expected: controller-handoff ≤ 110 lines; env table only in reference doc.

- [ ] **Step 4: Commit**

```bash
git add plugins/superpowers-overrides/docs/sdd-h6-reference.md \
  plugins/superpowers-overrides/skills/spor-token-efficient-controller-handoff/SKILL.md
git commit -m "feat: split SDD H6–H8 to reference doc and slim controller-handoff"
```

---

### Task 2: Handoff schema SOT + slim handoff-writer

**Files:**
- Create: `plugins/superpowers-overrides/templates/sdd-handoff-schema.md`
- Modify: `plugins/superpowers-overrides/skills/spor-handoff-writer/SKILL.md`
- Modify: `plugins/superpowers-overrides/templates/sdd-cli/handoff.md`

**Interfaces:**
- Consumes: handoff-writer lines 33–112 (schema + tables)
- Produces: `templates/sdd-handoff-schema.md`; handoff-writer retains Inputs/Outputs/segment tables + parsing rules only

- [ ] **Step 1: Create `templates/sdd-handoff-schema.md`**

Move from current `spor-handoff-writer/SKILL.md`:

- Single-task JSON example (lines 37–61)
- Batch JSON example (lines 66–79)
- `commits.base` alignment table (lines 82–88)
- Status by segment table (lines 26–31)
- Brief definitions for `findings[]`, `unverifiable[]`, `plan_conflicts[]`

Add opening line: `Single source of truth for task-N-handoff.json — cited by handoff-writer and controller-handoff H4/H5.`

- [ ] **Step 2: Slim handoff-writer**

Delete `## handoff.json schema` section and JSON blocks. Insert after `## Outputs`:

```markdown
## Schema

Read field definitions and examples from [`templates/sdd-handoff-schema.md`](../../templates/sdd-handoff-schema.md) — do not paraphrase.
```

Keep: Inputs table, Outputs, Test evidence gate, Review segment parsing, D3 orchestrator return, Red Flags.

**Decision (locked):** Move **Status by segment** table into `sdd-handoff-schema.md` only — not duplicated in handoff-writer.

- [ ] **Step 3: One-line cite in `templates/sdd-cli/handoff.md`**

Append before return instructions:

```markdown
Handoff JSON shape: see `templates/sdd-handoff-schema.md` in plugin root.
```

- [ ] **Step 4: Verify schema single-source**

Run:

```bash
grep -c '"task":' plugins/superpowers-overrides/templates/sdd-handoff-schema.md
grep -c '"task":' plugins/superpowers-overrides/skills/spor-handoff-writer/SKILL.md
wc -l plugins/superpowers-overrides/skills/spor-handoff-writer/SKILL.md
```

Expected: schema file has JSON examples; handoff-writer has 0 `"task":` JSON blocks; ≤ 90 lines.

- [ ] **Step 5: Commit**

```bash
git add plugins/superpowers-overrides/templates/sdd-handoff-schema.md \
  plugins/superpowers-overrides/skills/spor-handoff-writer/SKILL.md \
  plugins/superpowers-overrides/templates/sdd-cli/handoff.md
git commit -m "feat: single-source handoff.json schema"
```

---

### Task 3: p0-fallback skill + slim spor-SDD + D4 pointer

**Files:**
- Create: `plugins/superpowers-overrides/skills/spor-sdd-p0-fallback/SKILL.md`
- Modify: `plugins/superpowers-overrides/skills/spor-subagent-driven-development/SKILL.md`
- Modify: `plugins/superpowers-overrides/skills/spor-token-efficient-review-dispatch/SKILL.md`

**Interfaces:**
- Consumes: spor-SDD Rules 3, 5b, 5c; review-dispatch D4 lines 45–65
- Produces: `spor-sdd-p0-fallback` with frontmatter `name: spor-sdd-p0-fallback`; spor-SDD Rule 0b items 2–5 per spec

- [ ] **Step 1: Create `spor-sdd-p0-fallback/SKILL.md`**

Frontmatter:

```yaml
---
name: spor-sdd-p0-fallback
description: p0 in-session SDD worker rules — Read only when spor-SDD Rule 0b triggers. Not an override slash target. Contains Rules 3, 5b, 5c and D4 review gate.
---
```

Body: move verbatim from current spor-SDD:

- Rule 3 (TDD delegate + exemption + implementer artifacts)
- Rule 5b (implementer dispatch pointer)
- Rule 5c (in-session review + cite templates/handoff-writer/H1–H5)
- **Appendix D4** — full text from review-dispatch lines 45–65 (dual-axis gate + red flags)

Add p0 Red Flags — move **only** this row from spor-SDD Red Flags:

- `"p0 fallback — skip the announce line."`

Do **not** move Rule 0a-related flags (lines 141–142 stay in spor-SDD).

- [ ] **Step 2: Slim spor-SDD**

**Rule 0a item 3** — replace orchestrator + worker bullets:

```markdown
3. **Orchestrator + worker (pointers only):**
   - Orchestrator: Setup/ledger/plan-constraints via upstream scripts + Rule 7 + controller-handoff H1–H5; shell details in `{plugin_root}/docs/sdd-h6-reference.md`; per-task Rule 1 → Rule 4 (once) → TASK_BASE in brief → H6 → Rule 5a → Rule 6; final whole-branch review orchestrator in-session (no CLI final)
   - Worker discipline SOT: `templates/sdd-cli/{implement,handoff,review,fix}.md` — do not paraphrase
   - CLI worker review steps run in H6 subprocesses only — see Rule 5a (orchestrator does NOT dispatch handoff-writer/code-review in-session)
```

**Rule 0b** — replace items 2–4 with:

1. Triggers when Rule 7 item 2 applies (unchanged).
2. **Then** Read upstream `subagent-driven-development` skill body.
3. Announce: `CLI unavailable — falling back to p0 in-session SDD.`
4. Read `{plugin_root}/skills/spor-sdd-p0-fallback/SKILL.md`; Rules 3, 5b, 5c SOT lives there.
5. Per-task commit: Rule 5b in p0-fallback skill (conventional commit; aligned with `implement.md`).

**Delete** Rules 3, 5b, 5c entirely.

**Rule 5** — keep only `#### Rule 5a`; update cite to `controller-handoff H1–H5` (line 98).

**Rule 7 item 1** — change to: `H6 four-mode CLI chain per docs/sdd-h6-reference.md`.

**Rule 7 item 2** — change to: `p0 Rule 0b → spor-sdd-p0-fallback + H1–H5 in-session`.

Update Red Flags referencing p0: point to p0-fallback file where needed; keep all rows (do not delete).

- [ ] **Step 3: Pointer-only D4 in review-dispatch**

Replace `### D4 — code-review dual-axis gate (p0)` block (lines 45–65) with:

```markdown
### D4 — code-review dual-axis gate (p0 only)

When SDD per-task review runs in-session (Rule 0b), see `spor-sdd-p0-fallback` Rule 5c appendix. CLI-default path: D4 runs inside H6 `review` subprocess — orchestrator does not load D4 prose.
```

- [ ] **Step 4: Verify manifest + grep**

Run:

```bash
! grep -F 'spor-sdd-p0-fallback' plugins/superpowers-overrides/overrides.manifest.json
grep -q 'name: spor-sdd-p0-fallback' plugins/superpowers-overrides/skills/spor-sdd-p0-fallback/SKILL.md
! grep -E '^### Rule 3|^#### Rule 5b|^#### Rule 5c' plugins/superpowers-overrides/skills/spor-subagent-driven-development/SKILL.md
wc -l plugins/superpowers-overrides/skills/spor-subagent-driven-development/SKILL.md
```

Expected: spor-SDD ≤ 160; p0 rules only in p0-fallback; manifest has no p0-fallback target.

- [ ] **Step 5: Commit**

```bash
git add plugins/superpowers-overrides/skills/spor-sdd-p0-fallback/ \
  plugins/superpowers-overrides/skills/spor-subagent-driven-development/SKILL.md \
  plugins/superpowers-overrides/skills/spor-token-efficient-review-dispatch/SKILL.md
git commit -m "feat: lazy-load p0 SDD rules and slim spor-SDD"
```

---

### Task 4: Line-budget CI + docs + overall inventory

**Files:**
- Create: `plugins/superpowers-overrides/tests/sdd-orchestrator-line-budget.test.sh`
- Modify: `plugins/superpowers-overrides/tests/validate-overrides-build.sh`
- Modify: `plugins/superpowers-overrides/docs/cross-harness-overrides.md`
- Modify: `docs/superpowers/specs/2026-08-05-sdd-token-efficiency-overall.md`
- Modify: `docs/superpowers/specs/2026-08-05-sdd-slim-orchestrator-p1-slim-3-design.md` (§Smoke results)

**Interfaces:**
- Consumes: Tier 1/2 caps from spec AC #3–#4
- Produces: executable test script wired into `scripts/ci-validate.sh` via existing validate-overrides-build call chain

- [ ] **Step 1: Create line-budget test script**

`plugins/superpowers-overrides/tests/sdd-orchestrator-line-budget.test.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SKILLS="$ROOT/skills"

sdd="$(wc -l < "$SKILLS/spor-subagent-driven-development/SKILL.md" | tr -d ' ')"
ctrl="$(wc -l < "$SKILLS/spor-token-efficient-controller-handoff/SKILL.md" | tr -d ' ')"
life="$(wc -l < "$SKILLS/spor-subagent-lifecycle/SKILL.md" | tr -d ' ')"
rev="$(wc -l < "$SKILLS/spor-token-efficient-review-dispatch/SKILL.md" | tr -d ' ')"

tier1=$((sdd + ctrl))
tier2=$((tier1 + life + rev))

echo "Tier 1 (spor-SDD + controller-handoff): $tier1 lines"
echo "Tier 2 (+ lifecycle + review-dispatch): $tier2 lines"

[ "$sdd" -le 160 ] || { echo "FAIL: spor-SDD $sdd > 160"; exit 1; }
[ "$ctrl" -le 110 ] || { echo "FAIL: controller-handoff $ctrl > 110"; exit 1; }
[ "$tier1" -le 225 ] || { echo "FAIL: Tier 1 $tier1 > 225"; exit 1; }
[ "$tier2" -le 350 ] || { echo "FAIL: Tier 2 $tier2 > 350"; exit 1; }

# p0-fallback exists but not in manifest
[ -f "$SKILLS/spor-sdd-p0-fallback/SKILL.md" ] || { echo "FAIL: missing p0-fallback"; exit 1; }
! grep -q 'spor-sdd-p0-fallback' "$ROOT/overrides.manifest.json"

# schema single file — JSON examples only in sdd-handoff-schema.md
hw_examples=$(grep -c '"task":' "$SKILLS/spor-handoff-writer/SKILL.md" || true)
schema_examples=$(grep -c '"task":' "$ROOT/templates/sdd-handoff-schema.md" || true)
[ "$hw_examples" -eq 0 ] || { echo "FAIL: handoff-writer still has inline schema"; exit 1; }
[ "$schema_examples" -ge 1 ] || { echo "FAIL: schema file missing JSON example"; exit 1; }

echo "OK — line budget"
```

```bash
chmod +x plugins/superpowers-overrides/tests/sdd-orchestrator-line-budget.test.sh
```

- [ ] **Step 2: Wire into validate-overrides-build.sh**

After `== validate cross-cutting skills exist ==` block, add:

```bash
echo "== validate spor-sdd-p0-fallback exists =="
[ -f "$SKILLS/spor-sdd-p0-fallback/SKILL.md" ] || { echo "MISSING spor-sdd-p0-fallback"; exit 1; }
! grep -q 'spor-sdd-p0-fallback' "$MANIFEST" || { echo "FAIL: p0-fallback must not be in manifest"; exit 1; }
echo "OK"

echo "== validate SDD orchestrator line budget =="
"$ROOT/tests/sdd-orchestrator-line-budget.test.sh"
```

- [ ] **Step 3: Update cross-harness-overrides.md**

Add subsection under SDD gate docs:

```markdown
### SDD H6 reference doc (p1-slim.3)

CLI env/exit/harness tables live in `docs/sdd-h6-reference.md`. Orchestrator skills cite H1–H5 only; Read reference doc once per session when shelling H6.
```

- [ ] **Step 4: Update overall inventory**

In `docs/superpowers/specs/2026-08-05-sdd-token-efficiency-overall.md`:

- Add row: `p1-slim.3` | orchestrator load ≤350 | link to design spec | Pending
- Add charter row: `p1-slim.3` | H6 ref split + p0 lazy-load + schema SOT + line-budget CI
- Bump version v2.2 → v2.3; append change history entry

- [ ] **Step 5: Run full validate**

```bash
cd /Users/oscaner/Projects/oscaner-skills
pnpm run validate
plugins/superpowers-overrides/tests/sdd-orchestrator-line-budget.test.sh
```

Expected: exit 0.

- [ ] **Step 6: Verify spor-executing-plans (grep only)**

```bash
grep -E 'H6|controller-handoff|sdd-h6-reference' plugins/superpowers-overrides/skills/spor-executing-plans/SKILL.md || echo "OK — no cites to update"
```

Expected: no file changes.

- [ ] **Step 7: Smoke verification + update design spec §Smoke**

**AC 5 — p0 fallback order checklist (manual):**

```bash
SDD_NO_CLI=1  # in orchestrator session before SDD slash
```

Verify sequence: Read upstream SDD → announce line → Read `spor-sdd-p0-fallback/SKILL.md` → in-session dispatch (no H6 shell).

**AC 6 — CLI regression:**

```bash
plugins/superpowers-overrides/tests/sdd-cli-dry-run-smoke.sh
# Optional full E2E: docs/superpowers/plans/2026-08-05-sdd-dogfood-synthetic.md
```

Update `docs/superpowers/specs/2026-08-05-sdd-slim-orchestrator-p1-slim-3-design.md` §Smoke results rows 1/1b/2/3/4 with Pass + date.

- [ ] **Step 8: Commit**

```bash
git add plugins/superpowers-overrides/tests/sdd-orchestrator-line-budget.test.sh \
  plugins/superpowers-overrides/tests/validate-overrides-build.sh \
  plugins/superpowers-overrides/docs/cross-harness-overrides.md \
  docs/superpowers/specs/2026-08-05-sdd-token-efficiency-overall.md \
  docs/superpowers/specs/2026-08-05-sdd-slim-orchestrator-p1-slim-3-design.md
git commit -m "chore: SDD orchestrator line-budget CI and overall p1-slim.3 inventory"
```

---

## Spec coverage checklist

| Spec AC | Task |
|---------|------|
| AC 1 spor-SDD ≤160, no 3/5b/5c bodies | Task 3 |
| AC 2 controller-handoff ≤110, H6 in ref only | Task 1 |
| AC 3 Tier 1 ≤225 | Task 4 script |
| AC 4 Tier 2 ≤350 | Task 4 script |
| AC 5 p0 smoke order | Task 4 Step 7 |
| AC 6 CLI regression | Task 4 Step 7 |
| AC 7 pnpm validate | Task 4 |
| AC 8 schema single file | Task 2 + Task 4 script |
| AC 9 no manifest row | Task 3 + Task 4 |
| AC 10 D4 pointer | Task 3 |

---
