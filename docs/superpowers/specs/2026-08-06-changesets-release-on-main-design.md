# Changesets release on main + develop sync

**Date:** 2026-08-06  
**Status:** Approved — user reviewed 2026-08-06  
**Repo:** [Oscaner/skills](https://github.com/Oscaner/skills)  
**Scope:** Fix incorrect develop-side release PR (#59); release only on `main`; back-merge to `develop` after release  
**Supersedes (partial):** [2026-08-06-branch-rules-version-scheme-design.md](./2026-08-06-branch-rules-version-scheme-design.md) — changesets / release flow sections only

## Problem

Merging `feat/cicd` to `develop` triggered [.github/workflows/changesets-version.yml](../.github/workflows/changesets-version.yml), which opened PR [#59](https://github.com/Oscaner/skills/pull/59) (`chore: release superpowers-overrides`, target `develop`). This is incorrect:

- **develop** should only accumulate `.changeset/*.md` files from feature PRs — no release/version workflow.
- **Release** (Version PR, tag, GitHub Release) should happen only on **`main`**.
- After release on `main`, **develop must be synced** via `main → develop` PR so version bumps are not stranded on `main` only.

## Goals

1. Remove release/version automation from **`develop`** pushes.
2. Keep **`release.yml`** on `push → main` as the sole changesets consumer for Version PR + tag + GitHub Release.
3. Set changesets `baseBranch` to **`main`** so Version PRs target `main`.
4. After a successful release on `main`, automatically open/update a **`main → develop`** sync PR.
5. Update docs to match; record deviation from branch-rules spec.

## Non-goals

- Change Version PR title format (`chore: release superpowers-overrides`).
- Re-open or fix closed #59.
- Auto-merge sync PR (develop ruleset requires manual merge).
- Change develop CI, dependabot, or submodule-sync targets.

## Corrected release flow

```
feature PR + .changeset/*.md
        │
        ▼
    develop          ← accumulate changesets only; NO release workflow
        │
        ▼  PR: develop → main
      main           ← integration merge
        │
        ▼  push → main triggers release.yml
      main           ← changesets/action opens Version PR (target main)
        │
        ▼  merge Version PR on main
      main           ← version bump commit(s)
        │
        ▼  push → main triggers release.yml again
      main           ← publish (changeset tag) + git tag + GitHub Release
        │
        ▼  automated PR: main → develop
    develop          ← aligned with released version (manual merge)
```

### Branch responsibilities

| Branch | Changesets | Workflow |
|--------|------------|----------|
| **develop** | Merge `.changeset/*.md` from feature PRs | None for release |
| **main** | Consumes changesets via `release.yml` | Version PR → tag → GH Release → sync PR |

## Workflow changes

### Delete: `.github/workflows/changesets-version.yml`

Remove entirely. No replacement on `develop`.

### Modify: `.changeset/config.json`

```json
"baseBranch": "main"
```

Version PRs from `changesets/action` target **`main`**, not `develop`.

### Modify: `.github/workflows/release.yml`

**Keep** existing `push → main` trigger and changesets/action + tag + GH Release steps.

**Update** top comment to document full flow (no reference to deleted workflow).

**Required:** set `id: changesets` on the `changesets/action@v1` step (currently missing — sync step output references depend on it).

**Required:** set `id: gh-release` on the `Create GitHub Release if missing` step.

**Add** sync PR steps after GitHub Release creation:

```yaml
- name: Check if develop is behind main
  if: steps.changesets.outputs.published == 'true' || steps.gh-release.outcome == 'success'
  id: needs-sync
  run: |
    git fetch origin main develop
    ahead=$(git rev-list --count origin/develop..origin/main)
    echo "ahead=$ahead" >> "$GITHUB_OUTPUT"
    echo "needs_sync=$([ "$ahead" -gt 0 ] && echo true || echo false)" >> "$GITHUB_OUTPUT"

- name: Prepare main → develop back-merge
  if: steps.needs-sync.outputs.needs_sync == 'true'
  run: |
    git fetch origin main develop
    git checkout -B chore/sync-main-to-develop origin/develop
    git merge origin/main -m "chore: sync main release back to develop"

- name: Open sync PR main → develop
  if: steps.needs-sync.outputs.needs_sync == 'true'
  uses: peter-evans/create-pull-request@v8
  with:
    base: develop
    branch: chore/sync-main-to-develop
    title: "chore: sync main release back to develop"
    commit-message: "chore: sync main release back to develop"
    body: |
      Automated back-merge after release on `main`.
      Merge to keep `develop` aligned with the released version.
```

**Release gate (outer `if`):** only evaluate sync when a release actually happened this run:

```yaml
if: steps.changesets.outputs.published == 'true' || steps.gh-release.outcome == 'success'
```

**Sync PR gate (inner `if`):** only open PR when `main` is strictly ahead of `develop`:

```yaml
if: steps.needs-sync.outputs.needs_sync == 'true'
```

| Run type | `published` | `gh-release` | `main` vs `develop` | Sync PR |
|----------|-------------|--------------|---------------------|---------|
| Version PR opened (changesets pending on main) | `false` | skipped | — | **No** (release gate fails) |
| Changesets publish + new release | `true` | success | ahead (version bump on main only) | **Yes** |
| Submodule-only `develop → main` fast-forward + new release | `false` | success | equal (same tip) | **No** (expected — already aligned) |
| Push with no new release (tag/release already exist) | `false` | skipped | — | **No** |

The pre-step merge creates a non-empty working tree when `main` is ahead so `create-pull-request` has commits to push.

**Idempotency:** `peter-evans/create-pull-request` updates an existing open PR on the same branch name.

**Permissions:** `release.yml` already has `pull-requests: write`.

### Submodule-only path

Unchanged merge flow: submodule bump PR → `develop` → `develop → main` (typically fast-forward). When no pending changesets, `release.yml` creates tag + GitHub Release on `main` push. Because `develop` and `main` share the same tip, **no sync PR is expected** — the `needs-sync` check skips PR creation.

## Documentation updates

| File | Change |
|------|--------|
| `.changeset/README.md` | Remove changesets-version flow; document main-only release + sync PR |
| `README.md` | Fix branch-flow line (currently says Version PRs target `develop`) |
| `CLAUDE.md` | Releasing section: develop accumulates; main releases; sync PR |
| `docs/superpowers/specs/2026-08-06-branch-rules-version-scheme-design.md` | Add **Deviation** note pointing to this spec |

## Deviation from branch-rules spec

Original branch-rules spec (2026-08-06) stated:

> changesets Version PR merges to `develop` → separate `develop → main` release PR

**Replaced by this spec:**

> changesets accumulate on `develop` → `develop → main` → Version PR + tag on `main` → `main → develop` sync PR

## Acceptance criteria

- [ ] Push to `develop` with pending changesets does **not** run any release/version workflow
- [ ] Push to `main` (after `develop → main` with changesets) opens/updates Version PR targeting **`main`**
- [ ] Merging Version PR on `main` and subsequent push creates tag + GitHub Release
- [ ] After successful publish on `main`, when `main` is ahead of `develop`, a **`main → develop`** sync PR is opened or updated
- [ ] Submodule-only `develop → main` fast-forward (branches already aligned) does **not** open a sync PR
- [ ] `.changeset/config.json` has `"baseBranch": "main"`
- [ ] `changesets-version.yml` does not exist
- [ ] Docs match the flow above

## Risks

| Risk | Mitigation |
|------|------------|
| Sync PR on Version-PR-creation push | Release gate requires `published` or new `gh-release`; Version-PR runs skip both |
| Prepare merge conflicts (develop has unreleased changesets) | Workflow fails; maintainer opens manual `main → develop` PR or resolves on develop |
| Sync PR conflicts after opened | Manual resolve on the automated PR |
| Forgotten sync PR leaves develop behind | Document in README; sync PR title is grep-friendly |

## Files touched (implementation preview)

| Path | Action |
|------|--------|
| `.github/workflows/changesets-version.yml` | Delete |
| `.changeset/config.json` | `baseBranch: main` |
| `.github/workflows/release.yml` | Add needs-sync check + sync PR steps; update comments |
| `.changeset/README.md` | Rewrite release flow |
| `README.md` | Fix branch-flow paragraph |
| `CLAUDE.md` | Update Releasing |
| `docs/superpowers/specs/2026-08-06-branch-rules-version-scheme-design.md` | Deviation note |

## Deviation

The **sync-PR gate** section (including the outer `published == 'true' || gh-release.outcome == 'success'` gate, the `published`-based run matrix, and the `id: gh-release` dependency) is **replaced** by [2026-08-08-release-flow-phase-separation-design.md](./2026-08-08-release-flow-phase-separation-design.md): publish-mode work (tag push, Release, sync PR) now gates on `hasChangesets == 'false'`.
