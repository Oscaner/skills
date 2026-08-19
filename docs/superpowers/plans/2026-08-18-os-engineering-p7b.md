# P7b: 技能目录改名 + 命名空间 + 文档更新 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename 9 `skills/os-*` directories to remove `os-` prefix, update all references in manifest/SKILL.md/scripts/docs, and verify `pnpm run validate` passes.

**Architecture:** Git mv for directory renames, then sed/global-replace for all references. The namespace prefix `engineering:` → `osuperpowers:` and `os-` skill prefix is removed. Documentation files (~15 .md files) are updated via sed in a specific order to avoid replacement ordering issues.

**Tech Stack:** git, sed (BSD/macOS), pnpm

**Spec:** `docs/superpowers/specs/2026-08-18-os-engineering-p7b-design.md`

---

## File Structure

### Renamed directories (9)
- `packages/osuperpowers/skills/os-brainstorming/` → `skills/brainstorming/`
- `packages/osuperpowers/skills/os-writing-plans/` → `skills/writing-plans/`
- `packages/osuperpowers/skills/os-executing-plans/` → `skills/executing-plans/`
- `packages/osuperpowers/skills/os-finishing/` → `skills/finishing/`
- `packages/osuperpowers/skills/os-debugging/` → `skills/debugging/`
- `packages/osuperpowers/skills/os-verification/` → `skills/verification/`
- `packages/osuperpowers/skills/os-code-review/` → `skills/code-review/`
- `packages/osuperpowers/skills/os-init/` → `skills/init/`
- `packages/osuperpowers/skills/os-report-issue/` → `skills/report-issue/`

### Manually edited files (in order of §5 replacement rules)
| File | Type | Est. changes |
|------|------|-------------|
| `packages/osuperpowers-router/overrides.manifest.json` | name + source paths | 16 fields |
| `packages/osuperpowers/skills/brainstorming/SKILL.md` | internal refs | 0-3 |
| `packages/osuperpowers/skills/writing-plans/SKILL.md` | internal refs | 0-3 |
| `packages/osuperpowers/skills/executing-plans/SKILL.md` | internal refs | 0-3 |
| `packages/osuperpowers/skills/finishing/SKILL.md` | internal refs | 0-3 |
| `packages/osuperpowers/skills/debugging/SKILL.md` | internal refs | 0-3 |
| `packages/osuperpowers/skills/verification/SKILL.md` | internal refs | 0-3 |
| `packages/osuperpowers/skills/code-review/SKILL.md` | internal refs | 0-3 |
| `packages/osuperpowers/skills/init/SKILL.md` | + spor.md, harness.md | 5-10 |
| `packages/osuperpowers/skills/report-issue/SKILL.md` | label refs | 2-4 |
| `scripts/emit.mjs` | namespace name | 1 |
| `README.md` | paths + names | 10 |
| `README.zh-CN.md` | paths + names | 10 |
| `CLAUDE.md` | paths + names | 12 |
| `packages/osuperpowers/CLAUDE.md` | paths + names | 30 |
| `packages/osuperpowers/README.md` | skill names | 20 |
| `packages/osuperpowers/README.zh-CN.md` | skill names | 20 |
| `packages/osuperpowers-router/CLAUDE.md` | namespace refs | 15 |
| `packages/osuperpowers-router/README.md` | namespace refs | 15 |
| `packages/osuperpowers-router/README.zh-CN.md` | namespace refs | 15 |
| `packages/osuperpowers/docs/cdd-reference.md` | paths | 5 |
| `packages/osuperpowers/docs/cdd-reference.zh-CN.md` | paths | 5 |
| `packages/osuperpowers-router/docs/cross-harness-overrides.md` | paths + names | 10 |
| `packages/osuperpowers-router/docs/sdd-h6-reference.md` | relative paths | 2 |
| `docs/gate-install.md` | paths | 2 |
| `docs/research/2026-08-16-harness-plugin-availability.md` | paths | 10 |
| `docs/research/2026-08-10-harness-marketplace-hooks.md` | paths | 5 |

### Auto-regenerated files (by `pnpm run emit`)
- All plugin manifests, hooks, self-check tables, .agents/skills/ copy

---

### Task 1: Rename skill directories

**Files:**
- Modify: 9 skill directories via `git mv`

**Interfaces:**
- Produces: new directory structure under `packages/osuperpowers/skills/`

- [ ] **Step 1: Rename all 9 directories**

```bash
cd packages/osuperpowers/skills
git mv os-brainstorming brainstorming
git mv os-writing-plans writing-plans
git mv os-executing-plans executing-plans
git mv os-finishing finishing
git mv os-debugging debugging
git mv os-verification verification
git mv os-code-review code-review
git mv os-init init
git mv os-report-issue report-issue
cd ../../..
```

- [ ] **Step 2: Verify all renames**

```bash
ls -d packages/osuperpowers/skills/{brainstorming,writing-plans,executing-plans,finishing,debugging,verification,code-review,init,report-issue}/
# Confirm old directories are gone
test ! -e packages/osuperpowers/skills/os-brainstorming
test ! -e packages/osuperpowers/skills/os-init
```

---

### Task 2: Update overrides.manifest.json

**Files:**
- Modify: `packages/osuperpowers-router/overrides.manifest.json`

**Interfaces:**
- Consumes: Task 1 (directories renamed)
- Produces: manifest with updated name/source fields

- [ ] **Step 1: Update name fields (remove `os-` from skill names)**

```bash
# Replace 'osuperpowers:os-' with 'osuperpowers:' in name fields
# Using sed to match the exact pattern in the JSON
sed -i '' 's/"name": "osuperpowers:os-/"name": "osuperpowers:/g' packages/osuperpowers-router/overrides.manifest.json
```

- [ ] **Step 2: Update source fields (remove `os-` from directory names)**

```bash
# Replace '../osuperpowers/skills/os-' with '../osuperpowers/skills/' in source fields
sed -i '' 's|\.\./osuperpowers/skills/os-|../osuperpowers/skills/|g' packages/osuperpowers-router/overrides.manifest.json
```

- [ ] **Step 3: Verify both changes**

```bash
python3 -c "
import json
m = json.load(open('packages/osuperpowers-router/overrides.manifest.json'))
for t in m['targets']:
    print(f\"{t['name']:40s} {t['source'] or 'null'}\")
# Verify no 'os-' remains in skill names (except cli-*)
for t in m['targets']:
    if t['source'] and 'os-' in t['source']:
        print(f'ERROR: os- still in source: {t[\"source\"]}')
    if t['name'] and t['name'].startswith('osuperpowers:os-'):
        print(f'ERROR: os- still in name: {t[\"name\"]}')
print('OK')
"
```

---

### Task 3: Update SKILL.md internal references

**Files:**
- Modify: `packages/osuperpowers/skills/*/SKILL.md` (for renamed skills)
- Modify: `packages/osuperpowers/skills/*/SKILL.zh-CN.md` (zh-CN companion files — same refs)
- Modify: `packages/osuperpowers/skills/init/spor.md`
- Modify: `packages/osuperpowers/skills/init/harness.md`

**Interfaces:**
- Consumes: Task 1 (directories renamed)
- Produces: all SKILL.md files with updated references

- [ ] **Step 1: Check os-report-issue/SKILL.md for label references**

```bash
grep -n 'superpowers-overrides' packages/osuperpowers/skills/report-issue/SKILL.md
# If found, replace manually (this is a label name, not a path)
```

- [ ] **Step 2: Check os-init/spor.md for self-check table and update manually**

```bash
grep -n 'Skill(osuperpowers:os-' packages/osuperpowers/skills/init/spor.md
# Update the self-check table manually — emit does not modify source files.
# Replace each 'Skill(osuperpowers:os-*)' with 'Skill(osuperpowers:*)' in the table
```

- [ ] **Step 3: Check all renamed SKILL.md + SKILL.zh-CN.md + spor.md + harness.md for `os-` self-references**

```bash
for d in brainstorming writing-plans executing-plans finishing debugging verification code-review init report-issue; do
  echo "=== $d/SKILL.md ==="
  grep -n 'os-brainstorming\|os-writing-plans\|os-executing-plans\|os-finishing\|os-debugging\|os-verification\|os-code-review\|os-init\|os-report-issue\|Skill(osuperpowers:os-\|\.\./os-' packages/osuperpowers/skills/$d/SKILL.md 2>/dev/null || echo "(none)"
  echo "=== $d/SKILL.zh-CN.md ==="
  grep -n 'os-brainstorming\|os-writing-plans\|os-executing-plans\|os-finishing\|os-debugging\|os-verification\|os-code-review\|os-init\|os-report-issue\|Skill(osuperpowers:os-\|\.\./os-' packages/osuperpowers/skills/$d/SKILL.zh-CN.md 2>/dev/null || echo "(none)"
done
# Also check cli-* skills that reference os-* skills
for d in cli-select cli-task cli-driven-development cli-code-review; do
  echo "=== $d/SKILL.md ==="
  grep -n 'os-brainstorming\|os-writing-plans\|os-executing-plans\|os-finishing\|os-debugging\|os-verification\|os-code-review\|os-init\|os-report-issue' packages/osuperpowers/skills/$d/SKILL.md 2>/dev/null || echo "(none)"
done
# Check init sub-files
echo "=== init/spor.md ==="
grep -n 'Skill(osuperpowers:os-' packages/osuperpowers/skills/init/spor.md 2>/dev/null || echo "(none)"
echo "=== init/harness.md ==="
grep -n 'os-init' packages/osuperpowers/skills/init/harness.md 2>/dev/null || echo "(none)"
```

- [ ] **Step 4: Fix any found references**

For each SKILL.md that has references:
- `Skill(osuperpowers:os-brainstorming)` → `Skill(osuperpowers:brainstorming)` (remove `os-` from skill name)
- `../os-brainstorming/SKILL.md` → `../brainstorming/SKILL.md` (directory path)
- `os-init` → `init` (command name)
- `os-report-issue` → `report-issue` (skill name)

Use individual sed commands per file as needed.

---

### Task 4: Update scripts/emit.mjs namespace

**Files:**
- Modify: `scripts/emit.mjs`

**Interfaces:**
- Consumes: Task 1 (directories renamed)
- Produces: emit tool uses new namespace name

- [ ] **Step 1: Update emitAgentsSkillsCopy namespace name**

```bash
grep -n 'emitAgentsSkillsCopy' scripts/emit.mjs
# Find the namespaces array and update "engineering" → "osuperpowers"
sed -i '' 's/\("engineering",.*join(root, "packages\/osuperpowers\/skills"\)/"osuperpowers", join(root, "packages\/osuperpowers\/skills")/' scripts/emit.mjs
```

Verify the change:
```bash
grep -A2 'emitAgentsSkillsCopy' scripts/emit.mjs | head -6
```

---

### Task 5: Update documentation files

**Files:**
- Modify: ~15 .md files (see File Structure section)

**Interfaces:**
- Consumes: Task 1 (directories renamed)
- Produces: all documentation with updated paths and names

- [ ] **Step 1: Path replacements (order 1-4)**

```bash
# Order 1: packages/engineering/ → packages/osuperpowers/
sed -i '' 's|packages/engineering/|packages/osuperpowers/|g' \
  README.md README.zh-CN.md CLAUDE.md \
  packages/osuperpowers/CLAUDE.md packages/osuperpowers/README.md \
  packages/osuperpowers/README.zh-CN.md \
  packages/osuperpowers-router/CLAUDE.md packages/osuperpowers-router/README.md \
  packages/osuperpowers-router/README.zh-CN.md \
  packages/osuperpowers/docs/cdd-reference.md \
  packages/osuperpowers/docs/cdd-reference.zh-CN.md \
  packages/osuperpowers-router/docs/cross-harness-overrides.md \
  packages/osuperpowers-router/docs/sdd-h6-reference.md \
  docs/gate-install.md docs/research/2026-08-16-harness-plugin-availability.md \
  docs/research/2026-08-10-harness-marketplace-hooks.md

# Order 2: packages/engineering → packages/osuperpowers (no trailing slash)
sed -i '' 's|packages/engineering|packages/osuperpowers|g' \
  README.md README.zh-CN.md CLAUDE.md \
  packages/osuperpowers/CLAUDE.md packages/osuperpowers/README.md \
  packages/osuperpowers/README.zh-CN.md \
  packages/osuperpowers-router/CLAUDE.md packages/osuperpowers-router/README.md \
  packages/osuperpowers-router/README.zh-CN.md \
  packages/osuperpowers/docs/cdd-reference.md \
  packages/osuperpowers/docs/cdd-reference.zh-CN.md \
  packages/osuperpowers-router/docs/cross-harness-overrides.md \
  packages/osuperpowers-router/docs/sdd-h6-reference.md \
  docs/gate-install.md docs/research/2026-08-16-harness-plugin-availability.md \
  docs/research/2026-08-10-harness-marketplace-hooks.md

# Order 3: packages/superpowers-overrides/ → packages/osuperpowers-router/
sed -i '' 's|packages/superpowers-overrides/|packages/osuperpowers-router/|g' \
  README.md README.zh-CN.md CLAUDE.md \
  packages/osuperpowers/CLAUDE.md packages/osuperpowers/README.md \
  packages/osuperpowers/README.zh-CN.md \
  packages/osuperpowers-router/CLAUDE.md packages/osuperpowers-router/README.md \
  packages/osuperpowers-router/README.zh-CN.md \
  packages/osuperpowers/docs/cdd-reference.md \
  packages/osuperpowers/docs/cdd-reference.zh-CN.md \
  packages/osuperpowers-router/docs/cross-harness-overrides.md \
  packages/osuperpowers-router/docs/sdd-h6-reference.md \
  docs/gate-install.md docs/research/2026-08-16-harness-plugin-availability.md \
  docs/research/2026-08-10-harness-marketplace-hooks.md

# Order 4: ../../engineering/ → ../../osuperpowers/ (relative paths)
sed -i '' 's|\.\./\.\./engineering/|../../osuperpowers/|g' \
  packages/osuperpowers-router/docs/sdd-h6-reference.md \
  packages/osuperpowers/docs/cdd-reference.md \
  packages/osuperpowers/docs/cdd-reference.zh-CN.md
```

- [ ] **Step 2: Plugin name replacement (order 5)**

```bash
# Order 5: superpowers-overrides → osuperpowers-router
sed -i '' 's/superpowers-overrides/osuperpowers-router/g' \
  README.md README.zh-CN.md CLAUDE.md \
  packages/osuperpowers/CLAUDE.md packages/osuperpowers/README.md \
  packages/osuperpowers/README.zh-CN.md \
  packages/osuperpowers-router/CLAUDE.md packages/osuperpowers-router/README.md \
  packages/osuperpowers-router/README.zh-CN.md \
  packages/osuperpowers-router/docs/cross-harness-overrides.md \
  docs/gate-install.md docs/research/2026-08-16-harness-plugin-availability.md \
  docs/research/2026-08-10-harness-marketplace-hooks.md
```

- [ ] **Step 3: Namespace replacement (orders 6-8)**

```bash
# Order 6: engineering:os- → osuperpowers: (removes namespace + os- prefix)
sed -i '' 's/engineering:os-/osuperpowers:/g' \
  README.md README.zh-CN.md CLAUDE.md \
  packages/osuperpowers/CLAUDE.md packages/osuperpowers/README.md \
  packages/osuperpowers/README.zh-CN.md \
  packages/osuperpowers-router/CLAUDE.md packages/osuperpowers-router/README.md \
  packages/osuperpowers-router/README.zh-CN.md \
  packages/osuperpowers-router/docs/cross-harness-overrides.md \
  packages/osuperpowers/docs/cdd-reference.md \
  packages/osuperpowers/docs/cdd-reference.zh-CN.md \
  docs/gate-install.md docs/research/2026-08-16-harness-plugin-availability.md \
  docs/research/2026-08-10-harness-marketplace-hooks.md

# Order 7: engineering:cli- → osuperpowers:cli-
sed -i '' 's/engineering:cli-/osuperpowers:cli-/g' \
  README.md README.zh-CN.md CLAUDE.md \
  packages/osuperpowers/CLAUDE.md packages/osuperpowers/README.md \
  packages/osuperpowers/README.zh-CN.md \
  packages/osuperpowers-router/CLAUDE.md packages/osuperpowers-router/README.md \
  packages/osuperpowers-router/README.zh-CN.md \
  packages/osuperpowers-router/docs/cross-harness-overrides.md \
  docs/research/2026-08-16-harness-plugin-availability.md

# Order 8: engineering: → osuperpowers: (catch-all)
sed -i '' 's/engineering:/osuperpowers:/g' \
  README.md README.zh-CN.md CLAUDE.md \
  packages/osuperpowers/CLAUDE.md packages/osuperpowers/README.md \
  packages/osuperpowers/README.zh-CN.md \
  packages/osuperpowers-router/CLAUDE.md packages/osuperpowers-router/README.md \
  packages/osuperpowers-router/README.zh-CN.md \
  packages/osuperpowers-router/docs/cross-harness-overrides.md \
  packages/osuperpowers/docs/cdd-reference.md \
  packages/osuperpowers/docs/cdd-reference.zh-CN.md \
  docs/gate-install.md docs/research/2026-08-16-harness-plugin-availability.md \
  docs/research/2026-08-10-harness-marketplace-hooks.md
```

- [ ] **Step 4: Skill name replacements (orders 9-10)**

```bash
# Order 9: os-* skill names → without os- prefix
# (Only for skill names that appear as text, not in paths/namespaces already handled)
sed -i '' 's/os-brainstorming/brainstorming/g' \
  README.md README.zh-CN.md CLAUDE.md \
  packages/osuperpowers/CLAUDE.md packages/osuperpowers/README.md \
  packages/osuperpowers/README.zh-CN.md \
  packages/osuperpowers-router/CLAUDE.md packages/osuperpowers-router/README.md \
  packages/osuperpowers-router/README.zh-CN.md \
  packages/osuperpowers/docs/cdd-reference.md \
  packages/osuperpowers/docs/cdd-reference.zh-CN.md

sed -i '' 's/os-writing-plans/writing-plans/g' \
  README.md README.zh-CN.md CLAUDE.md \
  packages/osuperpowers/CLAUDE.md packages/osuperpowers/README.md \
  packages/osuperpowers/README.zh-CN.md \
  packages/osuperpowers-router/CLAUDE.md packages/osuperpowers-router/README.md \
  packages/osuperpowers-router/README.zh-CN.md \
  packages/osuperpowers/docs/cdd-reference.md \
  packages/osuperpowers/docs/cdd-reference.zh-CN.md

# Repeat for: os-executing-plans, os-finishing, os-debugging, os-verification, os-code-review
# (same pattern on the same file list, plus cli-* skill files that reference these)
sed -i '' 's/os-executing-plans/executing-plans/g' \
  README.md README.zh-CN.md CLAUDE.md \
  packages/osuperpowers/CLAUDE.md packages/osuperpowers/README.md \
  packages/osuperpowers/README.zh-CN.md \
  packages/osuperpowers-router/CLAUDE.md packages/osuperpowers-router/README.md \
  packages/osuperpowers-router/README.zh-CN.md \
  packages/osuperpowers/docs/cdd-reference.md \
  packages/osuperpowers/docs/cdd-reference.zh-CN.md \
  packages/osuperpowers/skills/cli-select/SKILL.md \
  packages/osuperpowers/skills/cli-driven-development/SKILL.md

# Order 10: os-init → init
sed -i '' 's/os-init/init/g' \
  README.md README.zh-CN.md CLAUDE.md \
  packages/osuperpowers/CLAUDE.md packages/osuperpowers/README.md \
  packages/osuperpowers/README.zh-CN.md \
  packages/osuperpowers-router/CLAUDE.md packages/osuperpowers-router/README.md \
  packages/osuperpowers-router/README.zh-CN.md \
  packages/osuperpowers/docs/cdd-reference.md \
  packages/osuperpowers/docs/cdd-reference.zh-CN.md \
  packages/osuperpowers-router/docs/cross-harness-overrides.md \
  docs/gate-install.md docs/research/2026-08-16-harness-plugin-availability.md \
  docs/research/2026-08-10-harness-marketplace-hooks.md

# os-report-issue → report-issue
sed -i '' 's/os-report-issue/report-issue/g' \
  README.md README.zh-CN.md CLAUDE.md \
  packages/osuperpowers/CLAUDE.md packages/osuperpowers/README.md \
  packages/osuperpowers/README.zh-CN.md \
  packages/osuperpowers-router/CLAUDE.md packages/osuperpowers-router/README.md \
  packages/osuperpowers-router/README.zh-CN.md
```

- [ ] **Step 5: Verify no stale references remain**

```bash
# Check for remaining old paths
echo "=== packages/engineering ==="
grep -rn 'packages/engineering' \
  README.md README.zh-CN.md CLAUDE.md \
  packages/osuperpowers/CLAUDE.md packages/osuperpowers/README.md \
  packages/osuperpowers/README.zh-CN.md \
  packages/osuperpowers-router/CLAUDE.md packages/osuperpowers-router/README.md \
  packages/osuperpowers-router/README.zh-CN.md \
  packages/osuperpowers/docs/cdd-reference.md \
  packages/osuperpowers/docs/cdd-reference.zh-CN.md \
  packages/osuperpowers-router/docs/cross-harness-overrides.md \
  packages/osuperpowers-router/docs/sdd-h6-reference.md \
  docs/gate-install.md docs/research/2026-08-16-harness-plugin-availability.md \
  docs/research/2026-08-10-harness-marketplace-hooks.md 2>/dev/null || echo "CLEAN"

echo "=== packages/superpowers-overrides ==="
grep -rn 'packages/superpowers-overrides' \
  README.md README.zh-CN.md CLAUDE.md \
  packages/osuperpowers/CLAUDE.md packages/osuperpowers/README.md \
  packages/osuperpowers/README.zh-CN.md \
  packages/osuperpowers-router/CLAUDE.md packages/osuperpowers-router/README.md \
  packages/osuperpowers-router/README.zh-CN.md \
  packages/osuperpowers/docs/cdd-reference.md \
  packages/osuperpowers/docs/cdd-reference.zh-CN.md \
  packages/osuperpowers-router/docs/cross-harness-overrides.md \
  packages/osuperpowers-router/docs/sdd-h6-reference.md \
  docs/gate-install.md docs/research/2026-08-16-harness-plugin-availability.md \
  docs/research/2026-08-10-harness-marketplace-hooks.md 2>/dev/null || echo "CLEAN"

echo "=== engineering: namespace ==="
grep -rn 'engineering:os-\|engineering:cli-' \
  packages/ --include='*.md' 2>/dev/null || echo "CLEAN"
```

---

### Task 6: Regenerate manifests + verify + commit

**Files:**
- All auto-regenerated files

**Interfaces:**
- Consumes: Tasks 1-5 (all changes in place)

- [ ] **Step 1: Run pnpm run emit to regenerate manifests**

```bash
pnpm run emit
```

Expected: `OK — emitted unified first-party manifests`

- [ ] **Step 2: Run pnpm run emit:check**

```bash
pnpm run emit:check
```

Expected: `OK — emit fresh`

- [ ] **Step 3: Run full validation**

```bash
pnpm run validate
```

Expected: ALL PASS

- [ ] **Step 4: Final verification — no stale namespace references**

```bash
echo "=== Final check: engineering: ==="
grep -rn 'engineering:' \
  README.md README.zh-CN.md CLAUDE.md \
  packages/osuperpowers/ --include='*.md' \
  packages/osuperpowers-router/ --include='*.md' \
  docs/ 2>/dev/null | grep -v 'node_modules' | grep -v '\.git/' | grep -v '\.changeset/' \
  | grep -v 'CHANGELOG' | grep -v 'docs/superpowers/specs' | grep -v 'docs/superpowers/plans' \
  | grep -v 'docs/superpowers/tickets' || echo "CLEAN — no engineering: namespace refs"
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: rename skill directories, update namespace, and sync all docs

- git mv 9 skills/os-* directories to remove os- prefix
- Update overrides.manifest.json name/source fields
- Update SKILL.md internal references
- Update emit.mjs namespace name
- Update all documentation files (15+ .md files)
- Regenerate all manifests via pnpm run emit
- pnpm run validate: ALL PASS"
```