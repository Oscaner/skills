# P7c: Version Management + Release Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all stale `@oscaner-skills/engineering` / `superpowers-overrides` references across scripts, workflows, configs, issue templates, GitHub labels, and changeset docs.

**Architecture:** Mechanical package-name renames in ~8 files + deletion of 7 stale changeset files + GitHub label migration. No behavioral changes.

**Tech Stack:** Node.js scripts, GitHub Actions YAML, JSON configs, changeset markdown files, GitHub labels (gh CLI).

## Global Constraints

- Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`)
- No attribution / co-author / AI-generation trailers in commit messages
- Git worktrees are forbidden
- `pnpm run validate` must pass after changes

---

### Task 1: Update version-packages.mjs package name

**Files:**
- Modify: `scripts/version-packages.mjs` (lines 95, 99, 109)

**Interfaces:**
- Consumes: None (first task)
- Produces: Correct `PLUGIN_NAME` constant used by `changesetSetForPlugin()` and `cs.releases.find()` calls

- [ ] **Step 1: Verify current stale references**

Run: `grep -n '@oscaner-skills/engineering' scripts/version-packages.mjs`
Expected: 3 matches at lines 95, 99, 109

- [ ] **Step 2: Replace all occurrences**

Edit `scripts/version-packages.mjs` — replace every `@oscaner-skills/engineering` with `@oscaner-skills/osuperpowers`:

```js
// Line 95: changesetSetForPlugin call
const changesetsForPlugin = changesets.filter(cs =>
    cs.releases.some(r => r.name === '@oscaner-skills/osuperpowers')
);

// Line 99: releases.find in changesetsPassed filter
const releases = changesetsPassed.filter(cs =>
    cs.releases.find(r => r.name === '@oscaner-skills/osuperpowers')
);

// Line 109: releases.find in plugins array
const release = cs.releases.find(r => r.name === '@oscaner-skills/osuperpowers');
```

- [ ] **Step 3: Verify no stale references remain**

Run: `grep -n '@oscaner-skills/engineering' scripts/version-packages.mjs`
Expected: exit 1 (no matches)

- [ ] **Step 4: Commit**

```bash
git add scripts/version-packages.mjs
git commit -m "fix: update version-packages.mjs to use @oscaner-skills/osuperpowers"
```

---

### Task 2: Update release.yml tag prefixes

**Files:**
- Modify: `.github/workflows/release.yml` (lines 57-60)

**Interfaces:**
- Consumes: None (independent of Task 1)
- Produces: Correct `matrix.name` and `matrix.tag_prefix` values used by `release-plugin` job steps

- [ ] **Step 1: Verify current stale references**

Run: `grep -n 'superpowers-overrides\|engineering@' .github/workflows/release.yml`
Expected: 2 matches at lines 57-58 and 59-60

- [ ] **Step 2: Update matrix entries**

Edit `.github/workflows/release.yml` — replace the matrix `include` block:

```yaml
    strategy:
      matrix:
        include:
          - name: osuperpowers-router
            tag_prefix: "osuperpowers-router@"
          - name: osuperpowers
            tag_prefix: "osuperpowers@"
```

- [ ] **Step 3: Verify no stale references remain**

Run: `grep -n 'superpowers-overrides\|engineering@' .github/workflows/release.yml`
Expected: exit 1 (no matches)

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "fix: update release.yml tag prefixes to osuperpowers-router/osuperpowers"
```

---

### Task 3: Delete consumed changeset files

**Files:**
- Delete: `.changeset/engineering-p1.md`
- Delete: `.changeset/engineering-p2.md`
- Delete: `.changeset/engineering-p3.md`
- Delete: `.changeset/engineering-p3-overrides.md`
- Delete: `.changeset/engineering-p4.md`
- Delete: `.changeset/engineering-p5.md`
- Delete: `.changeset/engineering-p6.md`
- Delete: `.changeset/seven-mice-dance.md`
- Delete: `.changeset/twelve-waves-rescue.md`

**Interfaces:**
- Consumes: None
- Produces: Clean `.changeset/` directory with no stale old-package-name references

- [ ] **Step 1: List all changeset files**

Run: `ls .changeset/*.md`
Expected: `README.md` + `engineering-p*.md` (7 files) + `seven-mice-dance.md` + `twelve-waves-rescue.md`

- [ ] **Step 2: Delete all stale changeset files**

```bash
rm .changeset/engineering-p1.md .changeset/engineering-p2.md .changeset/engineering-p3.md .changeset/engineering-p3-overrides.md .changeset/engineering-p4.md .changeset/engineering-p5.md .changeset/engineering-p6.md .changeset/seven-mice-dance.md .changeset/twelve-waves-rescue.md
```

- [ ] **Step 3: Verify no stale references remain in .changeset/**

Run: `grep -rl '@oscaner-skills/engineering\|@oscaner-skills/superpowers-overrides' .changeset/ 2>/dev/null; echo "exit: $?"`
Expected: only `README.md` matches (fixed in Task 7), no changeset `.md` files

- [ ] **Step 4: Verify .changeset/ still has valid files**

Run: `ls .changeset/`
Expected: `README.md`, `config.json` only — no `engineering-*` or orphaned files

- [ ] **Step 5: Commit**

```bash
git add .changeset/engineering-p1.md .changeset/engineering-p2.md .changeset/engineering-p3.md .changeset/engineering-p3-overrides.md .changeset/engineering-p4.md .changeset/engineering-p5.md .changeset/engineering-p6.md .changeset/seven-mice-dance.md .changeset/twelve-waves-rescue.md
git commit -m "chore: remove consumed changeset files from pre-P7 era"
```

---

### Task 4: Fix opencode.json config

**Files:**
- Modify: `packages/osuperpowers/bin/gate/configs/opencode.json`

**Interfaces:**
- Consumes: None (independent)
- Produces: Correct package name in opencode plugin config

- [ ] **Step 1: Verify current stale reference**

Run: `cat packages/osuperpowers/bin/gate/configs/opencode.json`
Expected: `"plugin": ["@oscaner-skills/engineering"]`

- [ ] **Step 2: Replace package name**

Edit `packages/osuperpowers/bin/gate/configs/opencode.json`:

```json
{
  "plugin": ["@oscaner-skills/osuperpowers"]
}
```

- [ ] **Step 3: Verify no stale reference remains**

Run: `grep -n '@oscaner-skills/engineering' packages/osuperpowers/bin/gate/configs/opencode.json`
Expected: exit 1 (no matches)

- [ ] **Step 4: Commit**

```bash
git add packages/osuperpowers/bin/gate/configs/opencode.json
git commit -m "fix: update opencode.json plugin name to @oscaner-skills/osuperpowers"
```

---

### Task 5: Update issue templates, install hint, and pi README

**Files:**
- Modify: `.github/ISSUE_TEMPLATE/enhancement.yml` (line 9)
- Modify: `.github/ISSUE_TEMPLATE/bug_report.yml` (line 9)
- Modify: `packages/osuperpowers/bin/os-init/install-harness.mjs` (line 100)
- Modify: `packages/osuperpowers/bin/gate/configs/pi/README.md` (line 30)

**Interfaces:**
- Consumes: None (independent)
- Produces: Correct label name in issue templates, correct package names in install hints

- [ ] **Step 1: Verify current stale references**

Run: `grep -rn 'superpowers-overrides' .github/ISSUE_TEMPLATE/`
Expected: 2 matches (enhancement.yml, bug_report.yml)

Run: `grep -rn '@oscaner-skills/engineering' packages/osuperpowers/bin/os-init/install-harness.mjs packages/osuperpowers/bin/gate/configs/pi/README.md`
Expected: 2 matches

- [ ] **Step 2: Update enhancement.yml**

Edit `.github/ISSUE_TEMPLATE/enhancement.yml` line 9 — replace `superpowers-overrides` with `osuperpowers-router`:

```yaml
- label: osuperpowers-router
  description: osuperpowers-router plugin (first-party)
```

Also update the `active: false` entry for `superpowers-overrides`:

```yaml
- label: osuperpowers-router
  active: false
```

- [ ] **Step 3: Update bug_report.yml**

Edit `.github/ISSUE_TEMPLATE/bug_report.yml` line 9 — same replacement as Task 5 Step 2:

```yaml
- label: osuperpowers-router
  description: osuperpowers-router plugin (first-party)
```

Also update the `active: false` entry:

```yaml
- label: osuperpowers-router
  active: false
```

- [ ] **Step 4: Update install-harness.mjs**

Edit `packages/osuperpowers/bin/os-init/install-harness.mjs` line 100 — replace `@oscaner-skills/engineering` with `@oscaner-skills/osuperpowers`:

```js
hint: "opencode.json `plugin` 数组加 `@oscaner-skills/osuperpowers`"
```

- [ ] **Step 5: Update pi README.md**

Edit `packages/osuperpowers/bin/gate/configs/pi/README.md` line 30 — replace `@oscaner-skills/engineering` with `@oscaner-skills/osuperpowers`:

```bash
"$(node -p "require.resolve('@oscaner-skills/osuperpowers/bin/gate/adapters/pi.ts')")" \
```

- [ ] **Step 6: Verify no stale references remain**

Run: `grep -rn 'superpowers-overrides' .github/ISSUE_TEMPLATE/`
Expected: exit 1

Run: `grep -rn '@oscaner-skills/engineering' packages/osuperpowers/bin/os-init/install-harness.mjs packages/osuperpowers/bin/gate/configs/pi/README.md`
Expected: exit 1

- [ ] **Step 7: Commit**

```bash
git add .github/ISSUE_TEMPLATE/enhancement.yml .github/ISSUE_TEMPLATE/bug_report.yml packages/osuperpowers/bin/os-init/install-harness.mjs packages/osuperpowers/bin/gate/configs/pi/README.md
git commit -m "fix: update issue templates, install hint, and pi README to use new plugin names"
```

---

### Task 6: Fix test assertions with stale package names

**Files:**
- Modify: `scripts/lib/version-utils.test.mjs` (lines 116-137)
- Modify: `packages/osuperpowers-router/tests/manifest-harness.test.mjs` (line 64)

**Interfaces:**
- Consumes: None (independent)
- Produces: Test fixtures and assertions use correct package names

- [ ] **Step 1: Update version-utils.test.mjs fixtures**

Edit `scripts/lib/version-utils.test.mjs` — replace old package names in test fixtures:

```js
// Line 116: releases fixture
releases: [{ name: "@oscaner-skills/osuperpowers-router", type: "patch" }],

// Line 118: releases fixture
{ id: "b", releases: [{ name: "@oscaner-skills/osuperpowers", type: "minor" }] },

// Line 122: expected releases
{ name: "@oscaner-skills/osuperpowers-router", type: "patch" },

// Line 128: changesetSetForPlugin calls
changesetSetForPlugin(changesets, "@oscaner-skills/osuperpowers"),

// Line 137: edge case test
changesetSetForPlugin([{ id: "x" }], "@oscaner-skills/osuperpowers"),
```

- [ ] **Step 2: Run version-utils tests**

Run: `node --test scripts/lib/version-utils.test.mjs`
Expected: all tests pass

- [ ] **Step 3: Update manifest-harness.test.mjs assertion**

Edit `packages/osuperpowers-router/tests/manifest-harness.test.mjs` line 64 — update assertion text:

```js
assert.ok(overrides, "osuperpowers-router missing from marketplace/source.json");
```

- [ ] **Step 4: Run router tests**

Run: `node --test packages/osuperpowers-router/tests/manifest-harness.test.mjs`
Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/version-utils.test.mjs packages/osuperpowers-router/tests/manifest-harness.test.mjs
git commit -m "fix: update test assertions to use new package names"
```

---

### Task 7: Update cross-harness-overrides.md

**Files:**
- Modify: `packages/osuperpowers-router/docs/cross-harness-overrides.md` (line 25)

**Interfaces:**
- Consumes: None (independent)
- Produces: Documentation uses correct package names

- [ ] **Step 1: Verify current stale reference**

Run: `grep -n '@oscaner-skills/engineering' packages/osuperpowers-router/docs/cross-harness-overrides.md`
Expected: 1 match at line 25

- [ ] **Step 2: Update package name**

Edit `packages/osuperpowers-router/docs/cross-harness-overrides.md` line 25 — replace `@oscaner-skills/engineering` with `@oscaner-skills/osuperpowers`:

```
`@oscaner-skills/osuperpowers-router`, `@oscaner-skills/osuperpowers`
```

- [ ] **Step 3: Verify**

Run: `grep -n '@oscaner-skills/engineering' packages/osuperpowers-router/docs/cross-harness-overrides.md`
Expected: exit 1

- [ ] **Step 4: Commit**

```bash
git add packages/osuperpowers-router/docs/cross-harness-overrides.md
git commit -m "docs: update cross-harness-overrides.md package name references"
```

---

### Task 8: Migrate GitHub labels

**Files:**
- None modified (GitHub API only via `gh` CLI)

**Interfaces:**
- Consumes: None (independent)
- Produces: GitHub labels `osuperpowers` and `osuperpowers-router` exist; `superpowers-overrides` and `engineering` deleted

- [ ] **Step 1: Check current labels**

Run: `gh label list | grep -E 'superpowers-overrides|^engineering |osuperpowers'`
Expected: `superpowers-overrides` and `engineering` exist, `osuperpowers` and `osuperpowers-router` do not

- [ ] **Step 2: Check for issues using old labels**

Run:
```bash
gh issue list --label superpowers-overrides --json number --jq '.[].number'
gh issue list --label engineering --json number --jq '.[].number'
```
If any issues are found, migrate them first:
```bash
# For each issue number:
gh issue edit <NUMBER> --add-label osuperpowers-router --remove-label superpowers-overrides
# or
gh issue edit <NUMBER> --add-label osuperpowers --remove-label engineering
```

- [ ] **Step 3: Create new labels**

```bash
gh label create osuperpowers-router --color EDEDED --description "osuperpowers-router plugin (first-party)"
gh label create osuperpowers --color EDEDED --description "osuperpowers plugin (first-party)"
```

- [ ] **Step 4: Delete old labels**

```bash
gh label delete superpowers-overrides --yes
gh label delete engineering --yes
```

- [ ] **Step 5: Verify**

Run: `gh label list | grep -E 'superpowers-overrides|^engineering '`
Expected: exit 1 (no matches)

Run: `gh label list | grep -E 'osuperpowers-router|osuperpowers'`
Expected: both new labels present

---

### Task 9: Update .changeset/README.md

**Files:**
- Modify: `.changeset/README.md`

**Interfaces:**
- Consumes: None (independent)
- Produces: Changeset docs with correct package names and paths

- [ ] **Step 1: Verify current stale references**

Run: `grep -n 'superpowers-overrides\|@oscaner-skills/engineering\|packages/engineering/\|packages/superpowers-overrides/' .changeset/README.md`
Expected: multiple matches

- [ ] **Step 2: Apply replacements in order**

Edit `.changeset/README.md` — apply these replacements in order:

1. `@oscaner-skills/superpowers-overrides` → `@oscaner-skills/osuperpowers-router`
2. `@oscaner-skills/engineering` → `@oscaner-skills/osuperpowers`
3. `packages/superpowers-overrides/` → `packages/osuperpowers-router/`
4. `packages/engineering/` → `packages/osuperpowers/`
5. `superpowers-overrides@{version}` → `osuperpowers-router@{version}`
6. `engineering@{version}` → `osuperpowers@{version}`
7. `engineering/skills/os-init/` → `packages/osuperpowers/skills/init/`

- [ ] **Step 3: Verify no stale references remain**

Run: `grep -n 'superpowers-overrides\|@oscaner-skills/engineering\|packages/engineering/' .changeset/README.md`
Expected: exit 1 (no matches)

- [ ] **Step 4: Commit**

```bash
git add .changeset/README.md
git commit -m "docs: update changeset README to use new plugin names"
```

---

### Task 10: Full validation

**Files:**
- None modified (verification only)

**Interfaces:**
- Consumes: All changes from Tasks 1-9
- Produces: Green CI validation confirming no drift

- [ ] **Step 1: Run emit check**

Run: `pnpm run emit:check`
Expected: exit 0 (no drift)

- [ ] **Step 2: Run full validation**

Run: `pnpm run validate`
Expected: exit 0 (all 12 validation blocks pass)

- [ ] **Step 3: Verify no stale references across entire repo (excl. vendors/ and node_modules/)**

Run:
```bash
echo "=== superpowers-overrides ==="
grep -rn 'superpowers-overrides' --include='*.{md,yml,yaml,json,mjs,js,ts}' --exclude-dir=vendors --exclude-dir=node_modules . 2>/dev/null || echo "(clean)"

echo "=== @oscaner-skills/engineering ==="
grep -rn '@oscaner-skills/engineering' --include='*.{md,yml,yaml,json,mjs,js,ts}' --exclude-dir=vendors --exclude-dir=node_modules . 2>/dev/null || echo "(clean)"

echo "=== bare engineering (plugin name / path ref) ==="
grep -rn 'engineering' --include='*.{md,yml,yaml,json,mjs,js,ts}' --exclude-dir=vendors --exclude-dir=node_modules . 2>/dev/null | grep -v '"category": "engineering"' | grep -v 'real engineering' | grep -v 'engineering skills' | grep -v 'docs/superpowers/specs/' | grep -v 'docs/superpowers/plans/' | grep -v 'docs/research/' | grep -v 'docs/superpowers/tickets/' | grep -v 'CHANGELOG' || echo "(clean)"

echo "=== packages/engineering ==="
grep -rn 'packages/engineering' --include='*.{md,yml,yaml,json,mjs,js,ts}' --exclude-dir=vendors --exclude-dir=node_modules . 2>/dev/null || echo "(clean)"

echo "=== packages/superpowers-overrides ==="
grep -rn 'packages/superpowers-overrides' --include='*.{md,yml,yaml,json,mjs,js,ts}' --exclude-dir=vendors --exclude-dir=node_modules . 2>/dev/null || echo "(clean)"
```

Expected: all five sections output `(clean)` or only match known-safe patterns:
- `"category": "engineering"` — category metadata, not a package name
- `CHANGELOG.md` — historical records
- `docs/superpowers/specs/`, `docs/superpowers/plans/`, `docs/research/`, `docs/superpowers/tickets/` — historical docs
- `scripts/cleanup-legacy-release-tags.mjs` — intentionally references old tag format for cleanup
- `scripts/bump-submodule.mjs` — historical header comment

If any match appears outside these known-safe patterns, fix it before proceeding.

- [ ] **Step 4: Verify GitHub labels**

Run: `gh label list | grep -E 'superpowers-overrides|^engineering '`
Expected: exit 1 (no matches)
