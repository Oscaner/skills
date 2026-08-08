# Release Flow Phase Separation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix `release.yml` so tag/GitHub Release/sync PR only run in publish mode (after the Version PR merge), and the git tag points at main's tip — not a `changeset-release/*` branch tip.

**Architecture:** `changesets/action` runs in two modes. PR mode (changesets pending) opens the Version PR and returns `hasChangesets=true`; publish mode (no changesets) runs `changeset tag` and returns `hasChangesets=false`. We gate every publish-only step on `hasChangesets == 'false'`, let `changeset tag` create the tag locally on main, push it explicitly, create the Release via `softprops`, and only then run the sync PR.

**Tech Stack:** GitHub Actions (YAML), `changesets/action@v1`, `actions/github-script@v9`, `softprops/action-gh-release@v3`, reusable workflow `sync-main-to-develop.yml`.

## File Structure

| File | Role | Change |
|------|------|--------|
| `.github/workflows/release.yml` | Release orchestrator | Rework publish-mode gating |
| `docs/superpowers/specs/2026-08-06-changesets-release-on-main-design.md` | Prior spec | Add deviation note |
| `README.md` | Docs | Update flow description |
| `CLAUDE.md` | Docs | Update Releasing flow |

---

### Task 1: Rework `release.yml` publish-mode gating

**Files:**
- Modify: `.github/workflows/release.yml`

**Interfaces:**
- Consumes: `changesets/action@v1` outputs (`hasChangesets`)
- Produces: correct tag `superpowers-overrides@<version>` on origin/main, GitHub Release, sync PR

**Context for the implementer:** `changesets/action` has two modes. When changesets are pending it opens/updates a Version PR and sets `hasChangesets=true`; when none remain it runs `publish` (`changeset tag`) and sets `hasChangesets=false`. Every publish-only step must run **only** when `hasChangesets == 'false'`. The current file runs them unconditionally — that is the bug.

- [ ] **Step 1: Add `hasChangesets` job output and gate `sync-develop`**

Current:
```yaml
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
```
Change to:
```yaml
jobs:
  release:
    runs-on: ubuntu-latest
    outputs:
      hasChangesets: ${{ steps.changesets.outputs.hasChangesets }}
    steps:
```

Current:
```yaml
  sync-develop:
    needs: release
    uses: ./.github/workflows/sync-main-to-develop.yml
    secrets: inherit
```
Change to:
```yaml
  sync-develop:
    needs: release
    if: needs.release.outputs.hasChangesets == 'false'
    uses: ./.github/workflows/sync-main-to-develop.yml
    secrets: inherit
```

- [ ] **Step 2: Add `createGithubReleases: false` and `id: changesets` to the action step**

Current:
```yaml
      - uses: changesets/action@v1
        with:
          version: node scripts/version-packages.mjs
          publish: pnpm exec changeset tag
          commit: "chore: release superpowers-overrides"
          title: "chore: release superpowers-overrides"
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```
Change to:
```yaml
      - uses: changesets/action@v1
        id: changesets
        with:
          version: node scripts/version-packages.mjs
          publish: pnpm exec changeset tag
          createGithubReleases: false
          commit: "chore: release superpowers-overrides"
          title: "chore: release superpowers-overrides"
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```
`createGithubReleases: false` stops the action creating its own (prerelease-marked) Release AND its own tag push. `id: changesets` lets later steps read `hasChangesets`.

- [ ] **Step 3: Delete the two tag-creation steps**

Delete entirely (the wrong-commit tag source):
```yaml
      - name: Resolve HEAD SHA for tagging
        id: head
        run: echo "sha=$(git rev-parse HEAD)" >> "$GITHUB_OUTPUT"
      - name: Read overrides version
        id: overrides-ver
        run: echo "version=$(node -p "require('./plugins/superpowers-overrides/package.json').version")" >> "$GITHUB_OUTPUT"
      - name: Create git tag if missing
        uses: actions/github-script@v9
        with:
          script: |
            const tag = `superpowers-overrides@${{ steps.overrides-ver.outputs.version }}`;
            try {
              await github.rest.git.getRef({ ...context.repo, ref: `tags/${tag}` });
              core.info(`${tag} already exists`);
            } catch (e) {
              if (e.status !== 404) throw e;
              await github.rest.git.createRef({
                ...context.repo,
                ref: `refs/tags/${tag}`,
                sha: '${{ steps.head.outputs.sha }}',
              });
              core.info(`Created ${tag}`);
            }
```
(`Resolve HEAD SHA for tagging`, `Read overrides version`, `Create git tag if missing` — remove all three. `Read overrides version` is re-added below in publish-mode-gated form.)

- [ ] **Step 4: Add publish-mode-gated version read, tag push, release-exists check, release create**

After the `changesets/action` step, add:
```yaml
      - name: Read overrides version
        id: overrides-ver
        if: steps.changesets.outputs.hasChangesets == 'false'
        run: echo "version=$(node -p "require('./plugins/superpowers-overrides/package.json').version")" >> "$GITHUB_OUTPUT"
      - name: Push git tag
        if: steps.changesets.outputs.hasChangesets == 'false'
        run: git push origin "superpowers-overrides@${{ steps.overrides-ver.outputs.version }}"
      - name: Check if GitHub Release exists
        id: release-exists
        if: steps.changesets.outputs.hasChangesets == 'false'
        uses: actions/github-script@v9
        with:
          script: |
            const tag = `superpowers-overrides@${{ steps.overrides-ver.outputs.version }}`;
            try {
              await github.rest.repos.getReleaseByTag({ ...context.repo, tag });
              core.setOutput('exists', 'true');
            } catch (e) {
              if (e.status !== 404) throw e;
              core.setOutput('exists', 'false');
            }
      - name: Create GitHub Release if missing
        id: gh-release
        if: steps.changesets.outputs.hasChangesets == 'false' && steps.release-exists.outputs.exists != 'true'
        uses: softprops/action-gh-release@v3
        with:
          tag_name: superpowers-overrides@${{ steps.overrides-ver.outputs.version }}
          generate_release_notes: true
```

- [ ] **Step 5: Update the header comment**

Current:
```yaml
# Release flow (main only):
#   develop accumulates .changeset/*.md → develop→main PR → push main
#   → changesets/action opens Version PR (target main)
#   → merge Version PR → publish + tag + GitHub Release
#   → sync-main-to-develop.yml opens PR when main is ahead of develop
```
Change to:
```yaml
# Release flow (main only):
#   develop accumulates .changeset/*.md → develop→main PR → push main
#   → changesets/action opens Version PR (target main); hasChangesets=true → tag/Release/sync skipped
#   → merge Version PR → push main again; hasChangesets=false → publish mode
#   → changeset tag (local) + explicit git push → GitHub Release → sync PR
```

- [ ] **Step 6: Validate YAML parses**

Run (js-yaml 4 is in the pnpm store):
```bash
node -e "const fs=require('fs');const yaml=require('/Users/oscaner/Projects/oscaner-skills/node_modules/.pnpm/js-yaml@4.3.0/node_modules/js-yaml');yaml.load(fs.readFileSync('.github/workflows/release.yml','utf8'));console.log('YAML OK')"
```
Expected: `YAML OK`

- [ ] **Step 7: Verify no `published` remains**

Run:
```bash
grep -n "published" .github/workflows/release.yml || echo "no published — OK"
```
Expected: `no published — OK`

- [ ] **Step 8: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "fix: gate release tag/release/sync on publish mode"
```

---

### Task 2: Update docs to match the corrected two-phase flow

**Files:**
- Modify: `docs/superpowers/specs/2026-08-06-changesets-release-on-main-design.md`
- Modify: `README.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: the corrected `release.yml` behavior from Task 1
- Produces: docs that no longer describe the old `published`-based gate as authoritative

- [ ] **Step 1: Add deviation note to the prior spec**

Append to the bottom of `docs/superpowers/specs/2026-08-06-changesets-release-on-main-design.md`:

```markdown
## Deviation

The **sync-PR gate** section (including the outer `published == 'true' || gh-release.outcome == 'success'` gate, the `published`-based run matrix, and the `id: gh-release` dependency) is **replaced** by [2026-08-08-release-flow-phase-separation-design.md](./2026-08-08-release-flow-phase-separation-design.md): publish-mode work (tag push, Release, sync PR) now gates on `hasChangesets == 'false'`.
```

- [ ] **Step 2: Update README.md branch-flow paragraph**

Locate `README.md:61` (the `**Branch flow:**` line) and confirm it describes the two-phase behavior. If it mentions only "Version PRs, git tags, and GitHub Releases run on main; sync PR keeps develop aligned", it is already correct in spirit — add "in publish mode (after the Version PR merges)" if the tag/Release timing is stated. Only edit if the text implies tag/Release happen before the Version PR is merged.

- [ ] **Step 3: Update CLAUDE.md Releasing section**

Locate the `**Release to production:**` paragraph (`CLAUDE.md:211`). It currently reads: "Merge to `main` → release.yml opens a Version PR targeting `main`. Merge the Version PR on `main` → git tag and GitHub Release. When `main` is ahead of `develop`, the workflow opens an automated `main → develop` sync PR."

Verify it matches the corrected flow (Version PR merge → publish mode → tag + Release → sync). If it already says the Version PR must be merged before tag/Release, no change needed. Only edit if it implies otherwise.

- [ ] **Step 4: Verify docs don't reference `published` gate**

Run:
```bash
grep -rn "published ==\|gh-release.outcome" README.md CLAUDE.md .changeset/ docs/ 2>/dev/null || echo "no stale gate references — OK"
```
Expected: `no stale gate references — OK` (or a list of files to clean up that describe the old outer gate).

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-08-06-changesets-release-on-main-design.md README.md CLAUDE.md
git commit -m "docs: align release flow docs with publish-mode gating"
```

---

### Task 3: Clean up the mis-created tag / Release / PRs (manual, on GitHub)

**Files:** none (remote operations via `gh`)

**Interfaces:**
- Consumes: nothing from Tasks 1–2
- Produces: clean state — no wrong tag, no premature Release, no stale sync PR

**This task is manual, run AFTER Task 1 lands on main.** It is the incident cleanup from the spec. Do **not** run it before the workflow fix is deployed, or the mis-created artifacts will interfere with the fix's own verification.

- [ ] **Step 1: Delete the mis-created Release + tag**

```bash
gh release delete superpowers-overrides@6.2.0-overrides.0.15.3 --yes --cleanup-tag
```
`--cleanup-tag` removes the tag `superpowers-overrides@6.2.0-overrides.0.15.3` (currently on `04843a7`, an unmerged `changeset-release/main` tip) together with the Release.

- [ ] **Step 2: Close sync PR #92**

```bash
gh pr close 92
```
It was created before the release completed; the fixed flow will reopen one at the correct time.

- [ ] **Step 3: Close Version PR #91**

```bash
gh pr close 91
```
Its `changeset-release/main` branch was generated against the pre-fix workflow; the fixed flow regenerates it on the next push.

- [ ] **Step 4: Verify PR #90 is intact**

```bash
gh pr view 90 --json state,mergedAt --jq '{state,mergedAt}'
```
Expected: `state` = `MERGED`, `mergedAt` set. Its content is correct; main still carries the 3 changeset files that the next Version PR will consume.

- [ ] **Step 5: Verify tag no longer exists**

```bash
git ls-remote origin "refs/tags/superpowers-overrides@6.2.0-overrides.0.15.3"
```
Expected: empty output (tag deleted).

- [ ] **Step 6: Trigger the corrected flow on main**

Any push to main with the fixed workflow will regenerate the Version PR. Then merge it → publish mode creates the tag (on main's tip), pushes it, creates the Release, opens the sync PR.

```bash
# after pushing the fix to main:
gh run list --workflow=release.yml --limit 3
```
Expected: a run appears; it opens a Version PR (no tag/Release/sync created yet).

- [ ] **Step 7: Verify the full release on the follow-up push**

After merging the Version PR, check:
```bash
git ls-remote origin "refs/tags/superpowers-overrides@6.2.0-overrides.0.15.3"   # tag on main's tip
gh release list --limit 1                                                        # Release exists, not prerelease
gh pr list --head chore/sync-main-to-develop --state open                        # sync PR open
```
Expected: tag exists and is in main's history; Release present; sync PR open.

---


---


---


## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-08-08-release-flow-phase-separation.md`.** Two execution options:

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
