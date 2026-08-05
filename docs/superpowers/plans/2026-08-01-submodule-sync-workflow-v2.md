# Submodule Sync Workflow v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace bash/gh glue with reusable workflow + matrix + marketplace Actions; consolidate scripts per scope I.

**Architecture:** Matrix caller invokes `bump-submodule-reusable.yml` per submodule. Business logic stays in `bump-submodule.mjs`. CPR handles git/PR; Action chain handles Issues. Release tagging moves to `release.yml` Actions.

**Tech Stack:** GitHub Actions (checkout@v7, github-script@v9, peter-evans/create-pull-request@v8, micalevisk/last-issue-action@v2, peter-evans/create-issue-from-file@v6, peter-evans/create-or-update-comment@v5, softprops/action-gh-release@v2), Node 22, pnpm.

**Spec:** [docs/superpowers/specs/2026-08-01-submodule-sync-workflow-v2-design.md](../specs/2026-08-01-submodule-sync-workflow-v2-design.md)

## Global Constraints

- Action pins: major tags only (`@v8`, `@v9`, `@v6`, `@v2`, `@v5`) — no SHA pin.
- No `gh` CLI in submodule-sync or release tag paths after this plan.
- Do not change `bump-submodule.mjs` detection/apply semantics (only update sync script path).
- Labels `submodule-bump`, `submodule:mattpocock-skills`, `submodule:superpowers`, `submodule:impeccable` must exist before first workflow run (document bootstrap; one-time manual `gh label create`).
- Matrix `fail-fast: false`; no `continue-on-error` on sync jobs.
- Conventional commits; no AI attribution trailers.
- After each task: `pnpm run validate` must pass before commit.

---

## File map

| File | Action |
|------|--------|
| `scripts/sync-overrides-versions.mjs` | Create (merge sync-manifest + sync-dogfood) |
| `scripts/validate-marketplace.mjs` | Create (merge 3 validate scripts) |
| `scripts/validate-version-sync.mjs` | Create (extract ci-validate steps 8–10) |
| `scripts/sync-manifest-versions.mjs` | Delete |
| `scripts/sync-dogfood-self-check.mjs` | Delete |
| `scripts/validate-source.mjs` | Delete |
| `scripts/validate-wrapper-paths.mjs` | Delete |
| `scripts/validate-marketplace-sources.mjs` | Delete |
| `scripts/tag-if-missing.mjs` | Delete |
| `scripts/submodule-sync-publish.sh` | Delete |
| `scripts/bump-submodule.mjs` | Modify sync path |
| `scripts/version-packages.mjs` | Modify sync path |
| `scripts/ci-validate.sh` | Thin orchestrator |
| `.github/workflows/bump-submodule-reusable.yml` | Create |
| `.github/workflows/submodule-sync.yml` | Rewrite |
| `.github/workflows/release.yml` | Replace tag step |
| `CLAUDE.md` | Update |
| `.changeset/README.md` | Update |

---

### Task 1: Merge sync scripts → `sync-overrides-versions.mjs`

**Files:**
- Create: `scripts/sync-overrides-versions.mjs`
- Delete: `scripts/sync-manifest-versions.mjs`, `scripts/sync-dogfood-self-check.mjs`
- Modify: `scripts/bump-submodule.mjs`, `scripts/version-packages.mjs`

**Interfaces:**
- Produces: `scripts/sync-overrides-versions.mjs` — no-args CLI, run from repo root.

- [ ] **Step 1: Create merged script**

Copy `scripts/sync-manifest-versions.mjs` (lines 1–28), then inline `scripts/sync-dogfood-self-check.mjs` after `pnpm run emit` (remove the `execSync` call to sync-dogfood).

- [ ] **Step 2: Update call sites in `bump-submodule.mjs` and `version-packages.mjs`**

Replace `sync-manifest-versions.mjs` → `sync-overrides-versions.mjs`.

- [ ] **Step 3: Delete old files**

```bash
rm scripts/sync-manifest-versions.mjs scripts/sync-dogfood-self-check.mjs
```

- [ ] **Step 4: Verify**

```bash
pnpm run validate
```

Expected: ALL PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/sync-overrides-versions.mjs scripts/bump-submodule.mjs scripts/version-packages.mjs
git add -u scripts/sync-manifest-versions.mjs scripts/sync-dogfood-self-check.mjs
git commit -m "refactor: merge sync-overrides-versions script"
```

---

### Task 2: Merge validate scripts + extract version-sync

**Files:**
- Create: `scripts/validate-marketplace.mjs`, `scripts/validate-version-sync.mjs`
- Delete: `scripts/validate-source.mjs`, `scripts/validate-wrapper-paths.mjs`, `scripts/validate-marketplace-sources.mjs`
- Modify: `scripts/ci-validate.sh`

**Interfaces:**
- Consumes: existing file paths from deleted validate scripts (copy logic verbatim).
- Produces: two no-args CLIs; exit 1 + stderr message on failure.

- [ ] **Step 1: Create `scripts/validate-marketplace.mjs`**

Sequential calls (same order as spec):
1. Copy body of `validate-source.mjs`
2. Copy body of `validate-wrapper-paths.mjs` (without duplicate imports — single top-level imports)
3. Copy body of `validate-marketplace-sources.mjs`

Print one final `OK — validate-marketplace` or fail on first error.

- [ ] **Step 2: Create `scripts/validate-version-sync.mjs`**

Extract ci-validate.sh steps 8–10 inline `node -e` blocks into three functions with same assertions; print `OK` lines matching current output.

- [ ] **Step 3: Update `scripts/ci-validate.sh`**

Replace:
- steps 6, 12, 13 → `node scripts/validate-marketplace.mjs`
- steps 8–10 → `node scripts/validate-version-sync.mjs`

**Keep unchanged:** steps 1–5 (overrides plugin), step 7 (`emit-marketplace.mjs --check`), step 11 (mattpocock-skills resolvable directory check).

- [ ] **Step 4: Delete old validate scripts**

```bash
rm scripts/validate-source.mjs scripts/validate-wrapper-paths.mjs scripts/validate-marketplace-sources.mjs
```

- [ ] **Step 5: Verify**

```bash
pnpm run validate
```

Expected: ALL PASS (same 13 logical checks, fewer files).

- [ ] **Step 6: Commit**

```bash
git add scripts/validate-marketplace.mjs scripts/validate-version-sync.mjs scripts/ci-validate.sh
git add -u scripts/validate-source.mjs scripts/validate-wrapper-paths.mjs scripts/validate-marketplace-sources.mjs
git commit -m "refactor: consolidate marketplace and version validate scripts"
```

---

### Task 3: Migrate release tagging to Actions

**Files:**
- Modify: `.github/workflows/release.yml`
- Delete: `scripts/tag-if-missing.mjs`

- [ ] **Step 1: Edit `release.yml`**

Remove:
```yaml
      - name: Fetch tags for tag-if-missing
        run: git fetch --tags origin
      - name: Tag and release untagged overrides version
        run: node scripts/tag-if-missing.mjs
```

Add after `changesets/action` (from v2 spec § Migrate):
- `Resolve HEAD SHA for tagging` (`id: head`)
- `Read overrides version` (`id: overrides-ver`)
- `Create git tag if missing` (`actions/github-script@v9`)
- `Create GitHub Release if missing` (`softprops/action-gh-release@v2` with `skip_if_release_exists: true`)

Add job permission `issues: write` if gh-release needs it (usually `contents: write` suffices — already present).

- [ ] **Step 2: Delete script**

```bash
rm scripts/tag-if-missing.mjs
```

- [ ] **Step 3: Verify locally**

```bash
pnpm run validate
node --test scripts/lib/*.test.mjs
grep -r tag-if-missing . --include='*.md' --include='*.yml' --include='*.mjs' || true
git rev-parse "superpowers-overrides@$(node -p "require('./plugins/superpowers-overrides/package.json').version")" 2>/dev/null || echo "tag not yet created (OK pre-merge)"
```

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/release.yml
git add -u scripts/tag-if-missing.mjs
git commit -m "refactor: release overrides tag via GitHub Actions"
```

---

### Task 4: Create reusable bump workflow

**Files:**
- Create: `.github/workflows/bump-submodule-reusable.yml`

**Interfaces:**
- Consumes: `inputs.submodule` (string: `mattpocock-skills` | `superpowers` | `impeccable`)
- Consumes: `scripts/bump-submodule.mjs` dry-run JSON outputs

- [ ] **Step 0: Read v1 spec §2** (`docs/superpowers/specs/2026-08-01-submodule-sync-workflow-design.md`) for bump JSON output and per-submodule apply tables before writing YAML.

- [ ] **Step 1: Verify Action outputs**

Confirm `peter-evans/create-issue-from-file@v6` exports `issue-number` (check action README on GitHub). Adjust `steps.create-issue.outputs.*` if name differs.

- [ ] **Step 2: Create workflow file**

Implement all steps from spec (detect → apply → find-issue → write-issue-body → create-issue → issue-number → pr-body → cpr → issue-comment). Skeleton:

```yaml
name: Bump Submodule (reusable)

on:
  workflow_call:
    inputs:
      submodule:
        required: true
        type: string

permissions:
  contents: write
  pull-requests: write
  issues: write

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          submodules: recursive
          fetch-depth: 0
          token: ${{ secrets.GITHUB_TOKEN }}
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile

      - id: detect
        run: |
          json=$(node scripts/bump-submodule.mjs "${{ inputs.submodule }}" --dry-run)
          echo "$json" | node -e "
            const j=JSON.parse(require('fs').readFileSync(0,'utf8'));
            const fs=require('fs');
            const o=(k,v)=>fs.appendFileSync(process.env.GITHUB_OUTPUT,k+'='+String(v)+'\n');
            o('updated', j.updated===true);
            o('new_tag', j.newTag??'');
            o('old_label', j.oldTag??j.oldPinSha??'');
          "

      - name: Apply bump
        if: steps.detect.outputs.updated == 'true'
        run: node scripts/bump-submodule.mjs "${{ inputs.submodule }}"

      - id: find-issue
        if: steps.detect.outputs.updated == 'true'
        uses: micalevisk/last-issue-action@v2
        with:
          state: open
          labels: |
            submodule-bump
            submodule:${{ inputs.submodule }}

      - id: write-issue-body
        if: steps.detect.outputs.updated == 'true' && steps.find-issue.outputs.has-found != 'true'
        run: |
          mkdir -p .github/issue-bodies
          printf 'Automated submodule sync tracking for `%s`.\n' "${{ inputs.submodule }}" \
            > ".github/issue-bodies/${{ inputs.submodule }}.md"

      - id: create-issue
        if: steps.detect.outputs.updated == 'true' && steps.find-issue.outputs.has-found != 'true'
        uses: peter-evans/create-issue-from-file@v6
        with:
          title: Submodule bump: ${{ inputs.submodule }}
          content-filepath: .github/issue-bodies/${{ inputs.submodule }}.md
          labels: |
            submodule-bump
            submodule:${{ inputs.submodule }}

      - id: issue-number
        if: steps.detect.outputs.updated == 'true'
        run: |
          if [ "${{ steps.find-issue.outputs.has-found }}" = "true" ]; then
            echo "number=${{ steps.find-issue.outputs.issue-number }}" >> "$GITHUB_OUTPUT"
          else
            echo "number=${{ steps.create-issue.outputs.issue-number }}" >> "$GITHUB_OUTPUT"
          fi

      - id: pr-body
        if: steps.detect.outputs.updated == 'true'
        run: |
          if [ "${{ inputs.submodule }}" = "mattpocock-skills" ]; then
            printf 'rollback_note=> **Note:** Pin was not aligned to latest release tag; this PR syncs to `%s`.\n' "${{ steps.detect.outputs.new_tag }}" >> "$GITHUB_OUTPUT"
          else
            echo "rollback_note=" >> "$GITHUB_OUTPUT"
          fi

      - id: cpr
        if: steps.detect.outputs.updated == 'true'
        uses: peter-evans/create-pull-request@v8
        with:
          branch: chore/bump-${{ inputs.submodule }}
          base: main
          title: chore: bump ${{ inputs.submodule }} submodule
          commit-message: chore: bump ${{ inputs.submodule }} submodule
          labels: |
            submodule-bump
            automated
          body: |
            Tracking Issue: #${{ steps.issue-number.outputs.number }}

            Automated tag sync.
            ${{ steps.pr-body.outputs.rollback_note }}

      - uses: peter-evans/create-or-update-comment@v5
        if: steps.detect.outputs.updated == 'true'
        with:
          issue-number: ${{ steps.issue-number.outputs.number }}
          body: Updated: ${{ steps.detect.outputs.old_label }} → ${{ steps.detect.outputs.new_tag }}
```

**Note:** `bump-submodule.mjs --dry-run` prints `{"updated":false,...}` and exits 0 when no bump needed — do not use `|| true`.

- [ ] **Step 3: Validate YAML**

```bash
# optional: actionlint if installed
pnpm run validate
```

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/bump-submodule-reusable.yml
git commit -m "feat: add reusable bump-submodule workflow"
```

---

### Task 5: Rewrite caller + delete bash publish script

**Files:**
- Modify: `.github/workflows/submodule-sync.yml`
- Delete: `scripts/submodule-sync-publish.sh`

- [ ] **Step 1: Replace `submodule-sync.yml`**

```yaml
name: Submodule Sync

on:
  schedule:
    - cron: "0 1 * * 1"
  workflow_dispatch:

permissions:
  contents: write
  pull-requests: write
  issues: write

jobs:
  bump:
    strategy:
      fail-fast: false
      matrix:
        submodule: [mattpocock-skills, superpowers, impeccable]
    uses: ./.github/workflows/bump-submodule-reusable.yml
    with:
      submodule: ${{ matrix.submodule }}
    secrets: inherit
```

Remove all `continue-on-error`, inline steps, and Summary job.

- [ ] **Step 2: Delete bash script**

```bash
rm scripts/submodule-sync-publish.sh
```

- [ ] **Step 3: Verify no references**

```bash
grep -r submodule-sync-publish . || true
pnpm run validate
```

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/submodule-sync.yml
git add -u scripts/submodule-sync-publish.sh
git commit -m "feat: matrix submodule sync via reusable workflow"
```

---

### Task 6: Documentation + label bootstrap

**Files:**
- Modify: `CLAUDE.md`, `.changeset/README.md`
- Update spec status optional: v2 design → Approved

- [ ] **Step 1: Update `CLAUDE.md`**

Replace submodule-sync / tag-if-missing sections with:
- Matrix + reusable workflow architecture
- Label bootstrap one-liner (`gh label create ...`)
- v1 Issue migration note (label existing #31)
- GITHUB_TOKEN PR CI limitation
- New script names (`sync-overrides-versions`, validate scripts)

- [ ] **Step 2: Update `.changeset/README.md`**

Remove `tag-if-missing.mjs` references; describe release.yml Actions path.

- [ ] **Step 3: One-time label bootstrap (manual, document in commit message body or CLAUDE)**

```bash
gh label create submodule-bump --color EDEDED --description "Automated submodule sync tracking" 2>/dev/null || true
gh label create submodule:mattpocock-skills --color EDEDED 2>/dev/null || true
gh label create submodule:superpowers --color EDEDED 2>/dev/null || true
gh label create submodule:impeccable --color EDEDED 2>/dev/null || true
gh issue edit 31 --add-label submodule-bump --add-label submodule:mattpocock-skills 2>/dev/null || true
```

Run on repo after merge if labels missing.

- [ ] **Step 4: Final validate**

```bash
pnpm run validate
node --test scripts/lib/*.test.mjs
node scripts/bump-submodule.mjs mattpocock-skills --dry-run
node scripts/bump-submodule.mjs superpowers --dry-run
node scripts/bump-submodule.mjs impeccable --dry-run
```

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md .changeset/README.md
git commit -m "docs: submodule sync v2 workflow and script layout"
```

---

## Post-merge verification

1. Merge PR to `main`.
2. Bootstrap labels + label v1 Issue #31 if not done.
3. `workflow_dispatch` → Submodule Sync (run twice to verify CPR re-run updates existing PR and appends Issue comment — no duplicate PR).
4. Confirm matrix jobs: green when up-to-date; red on Action failure.
5. After next overrides version bump merge: confirm `release.yml` creates `superpowers-overrides@{version}` tag + GitHub Release (or skips if exists).

---

