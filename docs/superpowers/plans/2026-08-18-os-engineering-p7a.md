# P7a: 包目录改名 + emit 脚本适配 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename `packages/engineering/` → `packages/osuperpowers/` and `packages/superpowers-overrides/` → `packages/osuperpowers-router/`, update all scripts and manifests to reference new paths, and verify `pnpm run emit:check` + `pnpm run validate` pass.

**Architecture:** Two first-party packages get renamed via `git mv` (preserving history). All hardcoded paths in emit scripts, CI validation, tests, and the overrides manifest source paths are updated to match. `pnpm run emit` regenerates all derived manifests from the new paths.

**Tech Stack:** Node.js, git, pnpm

**Spec:** `docs/superpowers/specs/2026-08-18-os-engineering-p7a-design.md`

---

## File Structure

### Renamed directories
- `packages/engineering/` → `packages/osuperpowers/`
- `packages/superpowers-overrides/` → `packages/osuperpowers-router/`

### Manually edited files
| File | Change |
|------|--------|
| `packages/osuperpowers/package.json` | name, repository.directory, description |
| `packages/osuperpowers-router/package.json` | name, repository.directory, description |
| `packages/osuperpowers-router/overrides.manifest.json` | source paths (8 entries) |
| `scripts/emit.mjs` | productRoots, productFiles, emitAll, assertVersionBump, emitAgentsSkillsCopy |
| `scripts/ci-validate.mjs` | all path references (steps 1-5c) |
| `scripts/lib/emit/emit.test.mjs` | plugin name references |
| `scripts/lib/first-party-publish.test.mjs` | plugin name references |
| `scripts/sync-overrides-versions.mjs` | package path |

### Auto-regenerated files (by `pnpm run emit`)
- `marketplace/source.json`, `.claude-plugin/marketplace.json`, `.cursor-plugin/marketplace.json`
- All per-harness plugin.json files under `packages/osuperpowers/.{claude,cursor,codex,kimi,qoder}-plugin/`
- `packages/osuperpowers/gemini-extension.json`, `packages/osuperpowers/GEMINI.md`
- `packages/osuperpowers/hooks/hooks.json`, `packages/osuperpowers/hooks/hooks-cursor.json`
- `packages/osuperpowers/.agents/skills/engineering/*`
- All per-harness plugin.json files under `packages/osuperpowers-router/.{claude,cursor,codex}-plugin/`
- `packages/osuperpowers-router/hooks/hooks.json`, `packages/osuperpowers-router/hooks/hooks-cursor.json`
- `packages/osuperpowers-router/bin/prompt-expansion.mjs`, `bin/pi-router.ts`, `bin/cursor-detect.mjs`, `bin/cursor-enforce.mjs`
- `packages/osuperpowers-router/build/generated/claude-self-check.md`, `build/generated/cursor-self-check.mdc`

---

### Task 1: Rename directories + update package.json

**Files:**
- Modify: `packages/osuperpowers/package.json` (was `packages/engineering/package.json`)
- Modify: `packages/osuperpowers-router/package.json` (was `packages/superpowers-overrides/package.json`)

**Interfaces:**
- Produces: renamed directories on disk, updated package names

- [ ] **Step 1: Rename directories with git mv**

```bash
git mv packages/engineering packages/osuperpowers
git mv packages/superpowers-overrides packages/osuperpowers-router
```

- [ ] **Step 2: Update `packages/osuperpowers/package.json`**

Edit:
- `"name"`: `@oscaner-skills/engineering` → `@oscaner-skills/osuperpowers`
- `"repository"."directory"`: `packages/engineering` → `packages/osuperpowers`
- `"description"`: `Standalone engineering skills...` → `Standalone osuperpowers skills: os-* orchestrators, cli-* family, CDD engine, cross-harness gate.`

```bash
# Edit the package.json file with the three changes
```

- [ ] **Step 3: Update `packages/osuperpowers-router/package.json`**

Edit:
- `"name"`: `@oscaner-skills/superpowers-overrides` → `@oscaner-skills/osuperpowers-router`
- `"repository"."directory"`: `packages/superpowers-overrides` → `packages/osuperpowers-router`
- `"description"`: `Personal overrides for the superpowers plugin...` → `Trigger router for osuperpowers: intercepts upstream superpowers triggers and routes to osuperpowers / mattpocock targets.`

- [ ] **Step 4: Verify the renames and package.json changes**

```bash
ls packages/osuperpowers/package.json
ls packages/osuperpowers-router/package.json
# Confirm old dirs are gone
test ! -e packages/engineering/
test ! -e packages/superpowers-overrides/
```

---

### Task 2: Update overrides.manifest.json source paths

**Files:**
- Modify: `packages/osuperpowers-router/overrides.manifest.json` (8 source paths)

**Interfaces:**
- Consumes: Task 1 (directories renamed)
- Produces: manifest source paths pointing to `../osuperpowers/skills/`

- [ ] **Step 1: Update all 8 source paths in overrides.manifest.json**

Replace `../engineering/` with `../osuperpowers/` in every `"source"` field:

```bash
# Using sed for the replacement
sed -i '' 's|\.\./engineering/|\.\./osuperpowers/|g' packages/osuperpowers-router/overrides.manifest.json
```

Verify the changes:

| Key | Old value | New value |
|-----|-----------|-----------|
| targets[0].source | `../engineering/skills/os-brainstorming` | `../osuperpowers/skills/os-brainstorming` |
| targets[1].source | `../engineering/skills/os-writing-plans` | `../osuperpowers/skills/os-writing-plans` |
| targets[2].source | `../engineering/skills/cli-driven-development` | `../osuperpowers/skills/cli-driven-development` |
| targets[3].source | `../engineering/skills/os-executing-plans` | `../osuperpowers/skills/os-executing-plans` |
| targets[4].source | `../engineering/skills/os-finishing` | `../osuperpowers/skills/os-finishing` |
| targets[5].source | `../engineering/skills/os-debugging` | `../osuperpowers/skills/os-debugging` |
| targets[6].source | `../engineering/skills/os-verification` | `../osuperpowers/skills/os-verification` |
| targets[7].source | `../engineering/skills/os-code-review` | `../osuperpowers/skills/os-code-review` |

Target[8] (mattpocock-skills:tdd) has `"source": null` — no change needed.

- [ ] **Step 2: Verify the JSON is still valid**

```bash
python3 -c "import json; json.load(open('packages/osuperpowers-router/overrides.manifest.json')); print('OK')"
```

---

### Task 3: Update scripts/emit.mjs

**Files:**
- Modify: `scripts/emit.mjs` (productRoots, productFiles, emitAll, assertVersionBump, emitAgentsSkillsCopy)

**Interfaces:**
- Consumes: Task 1 (directories renamed)
- Produces: emit tool references new directory paths

- [ ] **Step 1: Update productRoots array (13 entries)**

Replace all `packages/engineering/` paths with `packages/osuperpowers/` and all `packages/superpowers-overrides/` paths with `packages/osuperpowers-router/` in the `productRoots` array (lines ~105-118).

```bash
sed -i '' 's|packages/engineering/|packages/osuperpowers/|g' scripts/emit.mjs
sed -i '' 's|packages/superpowers-overrides/|packages/osuperpowers-router/|g' scripts/emit.mjs
```

- [ ] **Step 2: Update productFiles array (2 entries)**

Replace `packages/engineering/gemini-extension.json` → `packages/osuperpowers/gemini-extension.json` and `packages/engineering/GEMINI.md` → `packages/osuperpowers/GEMINI.md` (these were already covered by the sed above if they match the pattern).

- [ ] **Step 3: Update emitAll() dispatch**

Replace comment `// engineering` → `// osuperpowers` and plugin name checks:
- `plugin.name === "superpowers-overrides"` → `plugin.name === "osuperpowers-router"`
- `plugin.name === "engineering"` → `plugin.name === "osuperpowers"`

```bash
sed -i '' 's/plugin\.name === "superpowers-overrides"/plugin.name === "osuperpowers-router"/' scripts/emit.mjs
sed -i '' 's/plugin\.name === "engineering"/plugin.name === "osuperpowers"/' scripts/emit.mjs
```

- [ ] **Step 4: Verify assertVersionBump path**

Check that `"packages/engineering"` in `assertVersionBump()` (line ~398) was already covered by the sed. If not, fix manually.

- [ ] **Step 5: Verify emitAgentsSkillsCopy skills path**

Check that `join(root, "packages/engineering/skills")` in `emitAgentsSkillsCopy()` (line ~222) was already covered by the sed. The namespace name `"engineering"` (first element of the namespaces array) should stay unchanged — it's the skill namespace, changed in P7b.

---

### Task 4: Update scripts/ci-validate.mjs

**Files:**
- Modify: `scripts/ci-validate.mjs` (all path references)

**Interfaces:**
- Consumes: Task 1 (directories renamed)
- Produces: CI validation references new directory paths

- [ ] **Step 1: Update all path references**

```bash
sed -i '' 's|packages/superpowers-overrides|packages/osuperpowers-router|g' scripts/ci-validate.mjs
sed -i '' 's|packages/engineering|packages/osuperpowers|g' scripts/ci-validate.mjs
```

- [ ] **Step 2: Verify the changes look correct**

```bash
grep -n 'packages/osuperpowers' scripts/ci-validate.mjs | head -20
grep -n 'packages/osuperpowers-router' scripts/ci-validate.mjs | head -10
# Confirm no old paths remain
test "$(grep -c 'packages/engineering' scripts/ci-validate.mjs)" -eq 0
test "$(grep -c 'packages/superpowers-overrides' scripts/ci-validate.mjs)" -eq 0
```

---

### Task 5: Update test files + other scripts

**Files:**
- Modify: `scripts/lib/emit/emit.test.mjs`
- Modify: `scripts/lib/first-party-publish.test.mjs`
- Modify: `scripts/sync-overrides-versions.mjs`

**Interfaces:**
- Consumes: Task 1 (directories renamed)
- Produces: test assertions reference new package names

- [ ] **Step 1: Update scripts/lib/emit/emit.test.mjs**

```bash
sed -i '' 's/"superpowers-overrides"/"osuperpowers-router"/g' scripts/lib/emit/emit.test.mjs
sed -i '' 's/"engineering"/"osuperpowers"/g' scripts/lib/emit/emit.test.mjs
```

- [ ] **Step 2: Verify emit.test.mjs changes**

Check that `"engineering"` → `"osuperpowers"` happened correctly. Some `"engineering"` strings might be in context (like `"engineering"` as a category keyword) — verify those are not over-replaced.

```bash
grep -n 'osuperpowers' scripts/lib/emit/emit.test.mjs
grep -n '"engineering"' scripts/lib/emit/emit.test.mjs
```

- [ ] **Step 3: Update scripts/lib/first-party-publish.test.mjs**

```bash
sed -i '' 's/"engineering"/"osuperpowers"/g' scripts/lib/first-party-publish.test.mjs
sed -i '' 's/"superpowers-overrides"/"osuperpowers-router"/g' scripts/lib/first-party-publish.test.mjs
```

- [ ] **Step 4: Update scripts/sync-overrides-versions.mjs**

```bash
sed -i '' 's|packages/superpowers-overrides/package.json|packages/osuperpowers-router/package.json|' scripts/sync-overrides-versions.mjs
```

---

### Task 6: Regenerate manifests + verify

**Files:**
- All auto-regenerated files (see File Structure section)

**Interfaces:**
- Consumes: Tasks 1-5 (all changes in place)
- Produces: all derived manifests pointing to new paths, verified clean

- [ ] **Step 1: Run pnpm run emit to regenerate all manifests**

```bash
pnpm run emit
```

Expected: `OK — emitted unified first-party manifests`

- [ ] **Step 2: Run pnpm run emit:check to verify no drift**

```bash
pnpm run emit:check
```

Expected: `OK — emit fresh`

- [ ] **Step 3: Run full validation**

```bash
pnpm run validate
```

Expected: 12 validation blocks all pass, final line `ALL PASS`

- [ ] **Step 4: Verify marketplace entries**

```bash
# Verify plugin names in source.json
python3 -c "
import json
s = json.load(open('marketplace/source.json'))
names = [p['name'] for p in s['plugins']]
assert 'osuperpowers' in names, 'osuperpowers not found'
assert 'osuperpowers-router' in names, 'osuperpowers-router not found'
assert 'engineering' not in names, 'engineering still present'
assert 'superpowers-overrides' not in names, 'superpowers-overrides still present'
print('OK — marketplace plugin names correct')
"
```

- [ ] **Step 5: Confirm no old directories remain**

```bash
test ! -e packages/engineering/
test ! -e packages/superpowers-overrides/
# Confirm the old product roots are clean
test "$(grep -c 'packages/engineering' scripts/emit.mjs)" -eq 0
test "$(grep -c 'packages/superpowers-overrides' scripts/emit.mjs)" -eq 0
echo "All clean"
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: rename packages/engineering -> packages/osuperpowers, superpowers-overrides -> osuperpowers-router

- Rename directories via git mv (preserving history)
- Update package.json names for npm publishing
- Update overrides.manifest.json source paths to ../osuperpowers/skills/
- Update scripts/emit.mjs productRoots, productFiles, emitAll dispatch
- Update scripts/ci-validate.mjs all path references
- Update test assertions and sync-overrides-versions path
- Regenerate all manifests via pnpm run emit"
```