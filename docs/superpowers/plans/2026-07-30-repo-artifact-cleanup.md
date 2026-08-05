# Repo Artifact Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove stale gitignored superpowers docs, add dogfood version-stamp CI, and dedupe tracked agent/human docs (`CLAUDE.md`, `README.md`, `cross-harness-overrides.md`).

**Architecture:** Single PR, serial tasks. CI extension lives in existing `validate-overrides-build.sh`. Doc edits link depth out to `CLAUDE.md` / plugin docs. No emit-chain or submodule changes.

**Tech Stack:** Bash, Python 3 (inline in validate script), Markdown.

**Spec:** [plugins/superpowers-overrides/docs/2026-07-30-repo-artifact-cleanup-design.md](../../plugins/superpowers-overrides/docs/2026-07-30-repo-artifact-cleanup-design.md)

## Global Constraints

- Delete **exactly** the 12 enumerated files under `docs/superpowers/`; keep empty `specs/`, `plans/`, `tickets/` dirs and `.gitignore` entry. Deletion is **local only** — never `git add` deleted paths.
- After Task 1, `docs/superpowers/plans/` may temporarily contain only this plan file (gitignored execution artifact); all other subdirs must be file-empty.
- Do **not** remove dogfood copies (`.cursor/rules/superpowers-overrides.mdc`, `CLAUDE.md` self-check block) or `build/generated/*`.
- Dogfood CI: append to `validate-overrides-build.sh` only — no new script file.
- README net shorter (~30% vs ~179 lines); no triplicate enforcement sections.
- Out of scope: submodules, emit restructuring, archiving specs into git.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `docs/superpowers/specs/*.md` (×4) | Delete (local) | Stale gitignored specs |
| `docs/superpowers/plans/*.md` (×4) | Delete (local) | Stale gitignored plans |
| `docs/superpowers/tickets/*.md` (×4) | Delete (local) | Stale gitignored tickets |
| `plugins/superpowers-overrides/tests/validate-overrides-build.sh` | Modify | Add dogfood version-stamp check |
| `plugins/superpowers-overrides/docs/cross-harness-overrides.md` | Modify | Remove dead spec links; CHANGELOG history blurb |
| `CLAUDE.md` | Modify | Manifest-driven “add override skill” steps |
| `README.md` | Modify | Dedupe; Quick start; link out for depth |

**Unchanged:** `build/generated/*`, `.cursor/rules/superpowers-overrides.mdc`, marketplace emit outputs, submodules.

---

### Task 1: Delete stale gitignored docs

**Files:**
- Delete (local only): 12 files under `docs/superpowers/` per spec

- [ ] **Step 1: List files before delete**

```bash
find docs/superpowers -type f | sort
```

Expected: 12 files dated 2026-07-30 (plus this plan once written).

- [ ] **Step 2: Delete enumerated files**

```bash
rm -f \
  docs/superpowers/specs/2026-07-30-spor-skill-prefix-design.md \
  docs/superpowers/specs/2026-07-30-unified-skill-naming-design.md \
  docs/superpowers/specs/2026-07-30-opaque-skill-naming-spike-design.md \
  docs/superpowers/specs/2026-07-30-cursor-marketplace-emit-design.md \
  docs/superpowers/plans/2026-07-30-spor-skill-prefix.md \
  docs/superpowers/plans/2026-07-30-unified-skill-naming.md \
  docs/superpowers/plans/2026-07-30-opaque-skill-naming-spike.md \
  docs/superpowers/plans/2026-07-30-cursor-marketplace-emit.md \
  docs/superpowers/tickets/2026-07-30-spor-skill-prefix-tickets.md \
  docs/superpowers/tickets/2026-07-30-unified-skill-naming-tickets.md \
  docs/superpowers/tickets/2026-07-30-opaque-skill-naming-spike-tickets.md \
  docs/superpowers/tickets/2026-07-30-cursor-marketplace-emit-tickets.md
```

- [ ] **Step 3: Verify only this plan remains (if present)**

```bash
find docs/superpowers -type f
```

Expected: at most `docs/superpowers/plans/2026-07-30-repo-artifact-cleanup.md`.

- [ ] **Step 4: Confirm dirs + gitignore**

```bash
test -d docs/superpowers/specs && test -d docs/superpowers/plans && test -d docs/superpowers/tickets
grep -q '^docs/superpowers$' .gitignore || grep -q 'docs/superpowers' .gitignore
```

Expected: dirs exist; gitignore entry present. Do **not** commit deletions.

---

### Task 2: Dogfood version-stamp CI

**Files:**
- Modify: `plugins/superpowers-overrides/tests/validate-overrides-build.sh` (append after existing `validate self-check version stamps` block)

**Interfaces:**
- Consumes: `installed_version` from `plugins/superpowers-overrides/.claude-plugin/plugin.json`
- Produces: new echo section `== validate dogfood self-check version stamps ==` that fails when repo-root deploy copies drift

- [ ] **Step 1: Append dogfood check block**

Insert before final `echo "ALL PASS"`:

```bash
echo "== validate dogfood self-check version stamps =="
REPO_ROOT="$(cd "$ROOT/../.." && pwd)"
python3 -c "
import json, re, sys
from pathlib import Path
plugin_root = Path('$ROOT')
repo_root = Path('$REPO_ROOT')
version = json.loads((plugin_root / '.claude-plugin/plugin.json').read_text())['version']

cursor_path = repo_root / '.cursor/rules/superpowers-overrides.mdc'
claude_path = repo_root / 'CLAUDE.md'
cursor = cursor_path.read_text()
claude = claude_path.read_text()

needle = f'superpowers-overrides-version: {version}'
assert needle in cursor, f'{cursor_path}: missing or stale stamp — re-run /spor-init'

m = re.search(r'<!-- superpowers-overrides-version: ([^ ]+) -->', claude.splitlines()[0])
assert m and m.group(1) == version, f'{claude_path}: line 1 stamp mismatch — re-run /spor-init'
print('OK')
"
```

- [ ] **Step 2: Run overrides validation**

```bash
./plugins/superpowers-overrides/tests/validate-overrides-build.sh
```

Expected: `ALL PASS` including new dogfood section.

- [ ] **Step 3: Commit**

```bash
git add plugins/superpowers-overrides/tests/validate-overrides-build.sh
git commit -m "feat: CI-check dogfood self-check version stamps"
```

---

### Task 3: Fix `cross-harness-overrides.md`

**Files:**
- Modify: `plugins/superpowers-overrides/docs/cross-harness-overrides.md` (L5–9 “Design specs” block)

- [ ] **Step 1: Remove dead spec links**

Delete the “Design specs” bullet list (v1/v2/v3 links to `docs/superpowers/specs/*`).

- [ ] **Step 2: Insert CHANGELOG history paragraph**

Replace with:

```markdown
Naming evolved across releases: v1 emit model → v2 `-overrides` suffix → v3 `spor-*` prefix (current). See [CHANGELOG.md](../CHANGELOG.md) entries `6.2.0-overrides.3` through `6.2.0-overrides.6`.
```

- [ ] **Step 3: Verify no broken links**

```bash
rg 'docs/superpowers/specs/' plugins/superpowers-overrides/docs/cross-harness-overrides.md
```

Expected: no matches.

- [ ] **Step 4: Commit**

```bash
git add plugins/superpowers-overrides/docs/cross-harness-overrides.md
git commit -m "docs: drop dead spec links from cross-harness-overrides"
```

---

### Task 4: Update `CLAUDE.md` override-skill instructions

**Files:**
- Modify: `CLAUDE.md` (~L110–116)

- [ ] **Step 1: Replace subsection**

Replace from `**Add a new override skill to \`superpowers-overrides\`**` through the two “Missing step …” bullets with:

```markdown
**Add a new override skill to `superpowers-overrides`** — four things must change together in one commit, or the skill is invisible or won't auto-trigger:

1. Create `plugins/superpowers-overrides/skills/<name>/SKILL.md` with the four-trigger frontmatter (see [The overrides pattern](#the-overrides-pattern-superpowers-overrides)).
2. Add `"./skills/<name>"` to `skills[]` in [plugins/superpowers-overrides/.claude-plugin/plugin.json](plugins/superpowers-overrides/.claude-plugin/plugin.json).
3. Add a target row to [plugins/superpowers-overrides/overrides.manifest.json](plugins/superpowers-overrides/overrides.manifest.json), then run `pnpm run generate:overrides` (regenerates `bin/override-prompt-expansion.sh` and `build/generated/*`). Do **not** hand-edit the hook script.
4. Add a row to the override table in [README.md](README.md) for discoverability.

Missing step 1 or 2 → skill invisible to Claude Code. Missing manifest entry or skipping `generate:overrides` → hook and self-check drift.
```

- [ ] **Step 2: Verify no manual hook instructions remain**

```bash
rg 'case branch|hand-edit.*override-prompt' CLAUDE.md
```

Expected: no matches.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: manifest-driven override skill setup in CLAUDE.md"
```

---

### Task 5: Simplify `README.md`

**Files:**
- Modify: `README.md` (target ≤125 lines, down from ~179)

- [ ] **Step 1: Draft new section outline**

Reorder/consolidate to:

1. **Title + CI badge + one-line description** (keep)
2. **Installation** — marketplace commands + submodule clone (keep, trim prose)
3. **Plugins** — two short subsections (`mattpocock-skills`, `superpowers-overrides` one-liner each); **remove** long precedence paragraph and 13-row table
4. **Quick start** — merged block: install plugins → `/spor-init` → use `/superpowers:*` (Claude Code) or `/spor-*` (Cursor); link to [cross-harness-overrides.md](plugins/superpowers-overrides/docs/cross-harness-overrides.md) for Cursor Team Marketplace + discovery fallback
5. **Override skills (summary)** — 4-row mini-table: `spor-init`, `spor-brainstorming`, `spor-writing-plans`, `spor-subagent-driven-development`; link to [CLAUDE.md](CLAUDE.md) for full list
6. **Repository layout** — keep tree + emit note (unchanged)
7. **Enforcement** — **single** 5–8 line section: hooks + project rules/CLAUDE.md via `/spor-init`; link cross-harness doc; **delete** separate `System prompt wiring` and `How the override system works` sections
8. **Maintainers** — `pnpm run generate:overrides && emit && validate`; changeset pointer; CURSOR-SMOKE link
9. **Releasing** — keep table (unchanged)
10. **Contributing** — one sentence + link to [CLAUDE.md#the-overrides-pattern-superpowers-overrides](CLAUDE.md#the-overrides-pattern-superpowers-overrides)
11. **License** (keep)

- [ ] **Step 2: Apply edit**

Rewrite `README.md` following the outline. Do not remove install/release commands.

- [ ] **Step 3: Verify metrics**

```bash
wc -l README.md
rg 'System prompt wiring|How the override system works' README.md
rg 'case branch' README.md
rg 'the-overrides-pattern-superpowers-overrides' README.md
```

Expected: ≤125 lines; no matches for removed section titles; no case-branch mentions.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: simplify README — dedupe enforcement, link out for depth"
```

---

### Task 6: Final validation

**Files:**
- Modify (if needed): `.cursor/rules/superpowers-overrides.mdc`, `CLAUDE.md` line-1 version comment — only if dogfood CI fails

- [ ] **Step 1: Full validate**

```bash
pnpm run validate
```

Expected: `ALL PASS` (includes dogfood stamp check from Task 2).

- [ ] **Step 2: Fix dogfood drift if CI fails**

Re-run `/spor-init` in this repo (preferred). Fallback for maintainers:

```bash
cp plugins/superpowers-overrides/build/generated/cursor-self-check.mdc .cursor/rules/superpowers-overrides.mdc
# Sync CLAUDE.md line 1 with build/generated/claude-self-check.md, then re-run validate
```

- [ ] **Step 3: Repo-wide dead-link scan**

```bash
rg 'docs/superpowers/specs/' --glob '*.md' --glob '!docs/superpowers/**' .
rg '2026-07-30-unified-skill-naming|2026-07-29-cross-harness' --glob '*.md' .
```

Expected: zero matches in tracked docs.

- [ ] **Step 4: Commit tracked design doc (if not yet committed)**

```bash
git add plugins/superpowers-overrides/docs/2026-07-30-repo-artifact-cleanup-design.md
git commit -m "docs: add repo artifact cleanup design spec"
```

- [ ] **Step 5: PR test plan checklist**

Record in PR body:

- [ ] 12 stale gitignored files deleted locally
- [ ] `pnpm run validate` green
- [ ] README line count ≤125; single enforcement section
- [ ] No dead links to `docs/superpowers/specs/*` in tracked docs

---
