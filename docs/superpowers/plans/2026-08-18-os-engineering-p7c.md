# P7c: Version Management + Release Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix stale `@oscaner-skills/engineering` / `superpowers-overrides` references in version scripts and release workflow, and clean up consumed changesets.

**Architecture:** Mechanical package-name renames in 2 files + deletion of 7 stale changeset files. No behavioral changes.

**Tech Stack:** Node.js scripts, GitHub Actions YAML, changeset markdown files.

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

**Interfaces:**
- Consumes: None
- Produces: Clean `.changeset/` directory with no stale old-package-name references

- [ ] **Step 1: List files to delete**

Run: `ls .changeset/engineering-*.md`
Expected: 7 files (p1, p2, p3, p3-overrides, p4, p5, p6)

- [ ] **Step 2: Delete all engineering changeset files**

```bash
rm .changeset/engineering-p1.md .changeset/engineering-p2.md .changeset/engineering-p3.md .changeset/engineering-p3-overrides.md .changeset/engineering-p4.md .changeset/engineering-p5.md .changeset/engineering-p6.md
```

- [ ] **Step 3: Verify no old-package references remain in .changeset/**

Run: `grep -rl '@oscaner-skills/engineering' .changeset/ 2>/dev/null; echo "exit: $?"`
Expected: exit 1 (no matches)

- [ ] **Step 4: Verify .changeset/ still has valid files**

Run: `ls .changeset/`
Expected: `README.md`, `config.json` (and any `VERSION_*.md` pending changesets) — no `engineering-*` files

- [ ] **Step 5: Commit**

```bash
git add .changeset/engineering-p1.md .changeset/engineering-p2.md .changeset/engineering-p3.md .changeset/engineering-p3-overrides.md .changeset/engineering-p4.md .changeset/engineering-p5.md .changeset/engineering-p6.md
git commit -m "chore: remove consumed changeset files from pre-P7 era"
```

---

### Task 4: Full validation

**Files:**
- None modified (verification only)

**Interfaces:**
- Consumes: All changes from Tasks 1-3
- Produces: Green CI validation confirming no drift

- [ ] **Step 1: Run emit check**

Run: `pnpm run emit:check`
Expected: exit 0 (no drift)

- [ ] **Step 2: Run full validation**

Run: `pnpm run validate`
Expected: exit 0 (all 12 validation blocks pass)

- [ ] **Step 3: Verify no stale references across entire repo**

Run: `grep -rn '@oscaner-skills/engineering' scripts/ .github/ .changeset/ 2>/dev/null; echo "exit: $?"`
Expected: exit 1 (no matches)

Run: `grep -rn 'superpowers-overrides@' .github/workflows/release.yml 2>/dev/null; echo "exit: $?"`
Expected: exit 1 (no matches)
