# Submodule Sync Workflow — Design Spec

**Date:** 2026-08-01  
**Status:** Draft (pending user review)

## Problem

Three vendored submodules (`mattpocock-skills`, `superpowers`, `impeccable`) require periodic updates. Today this is manual: run `git submodule update --remote`, bump `marketplace/source.json`, run `pnpm run emit`, and for superpowers semver changes, align `superpowers-overrides` via the changeset release chain.

There is no automated detection or PR workflow. Dependabot covers npm and GitHub Actions only, not git submodules.

## Goals

1. Weekly automated sync: pin each submodule to its upstream **latest release tag** (includes rollback when pin diverges from tag, e.g. mattpocock-skills ahead of `v1.1.0`).
2. Open (or update) a separate PR per submodule; no auto-merge.
3. Create a tracking Issue on first PR; append Issue comments on subsequent pointer updates.
4. When `superpowers` semver changes, reset `superpowers-overrides` to `{newSemver}-overrides.0`.
5. On merge to `main`, tag and GitHub Release any `superpowers-overrides` version not yet tagged.
6. Consolidate bump logic into a single script entry point; deprecate align-only changeset flow.

## Non-Goals

- Auto-merge bump PRs.
- Track upstream `main` branch tips (tag/release only).
- Modify overrides skill content when superpowers bumps (CI will flag incompatibilities; human fixes in the same or follow-up PR).
- Renovate/Dependabot submodule integration.

## Decisions (from brainstorming)

| # | Decision |
|---|---|
| 1 | Monitor all three submodules; separate PR per submodule |
| 2 | Open PR for human review; create Issue on first PR; no auto-merge |
| 3 | Cron: Monday 09:00 Asia/Shanghai (`0 1 * * 1` UTC) + `workflow_dispatch` |
| 4 | Version scheme: `{superpowers-semver}-overrides.N` with **N starting at 0** on base reset |
| 5 | Submodule detection: latest **release tag**, not main branch tip |
| 6 | Overrides reset only when superpowers **semver** changes (not same-semver tag moves) |
| 7 | If open bump PR exists, update its branch; Issue comment on subsequent updates |
| 8 | Merge triggers tag + GitHub Release via `tag-if-missing.mjs` |
| 9 | Single workflow + `bump-submodule.mjs`; deprecate `create-align-changeset.mjs` |

## Architecture

```
cron (Mon 09:00 CST) ──► submodule-sync.yml
                              │
                              ├─► bump-submodule.mjs mattpocock-skills
                              ├─► bump-submodule.mjs superpowers
                              └─► bump-submodule.mjs impeccable
                                        │
                                        ├─ no update → skip
                                        └─ has update → create/update PR + Issue
                                                              │
                                                              ▼
                                                         CI validate
                                                              │
                                                              ▼
                                                    manual merge to main
                                                              │
                                                              ▼
                                                         release.yml
                                                              │
                                                              └─► tag-if-missing.mjs
```

## Components

### 1. `scripts/lib/submodule-tags.mjs`

Shared tag resolution:

```javascript
const TAG_PATTERNS = {
  "mattpocock-skills": /^v(\d+\.\d+\.\d+)$/,
  superpowers:         /^v(\d+\.\d+\.\d+)$/,
  impeccable:          /^skill-v(\d+\.\d+\.\d+)$/,
};
```

Functions:

- `fetchTags(submodulePath)` — `git -C <path> fetch --tags origin`
- `latestTag(submodulePath, pattern)` — filter tags by pattern, semver-sort, return `{ tag, sha }` for highest
- `pinnedSha(submodulePath)` — commit SHA currently checked out in submodule
- `hasUpdate(submodulePath, pattern)` — compare **pinned SHA** vs **latest tag's SHA** (not tag-name string equality)

**Detection contract:** A bump is needed when `pinnedSha !== latestTag.sha`. This handles pins not exactly on a tag (e.g. `mattpocock-skills` currently 40 commits ahead of `v1.1.0`): the latest tag SHA differs from the pinned SHA, so the first run correctly proposes checkout of `v1.1.0`.

### 2. `scripts/bump-submodule.mjs`

**CLI:**

```bash
node scripts/bump-submodule.mjs <submodule> [--dry-run]
# submodule: mattpocock-skills | superpowers | impeccable
```

**Execution order (all submodules):**

1. Read `oldVer` / metadata from repo root **before** touching submodule checkout (required for superpowers semver detection).
2. `fetchTags` + resolve `latestTag`.
3. If `pinnedSha === latestTag.sha` → exit (`updated: false`).
4. `git -C plugins/<name> checkout <latestTag.tag>` (exact tag ref, not `--remote`).
5. Submodule-specific manifest/emit steps (below).
6. Stage gitlink + changed files at repo root.

**Output (JSON on stdout for `--dry-run`):**

```json
{
  "updated": true,
  "submodule": "superpowers",
  "oldPinSha": "3dcbd5c",
  "oldTag": "v6.2.0",
  "newTag": "v6.3.0",
  "semverChanged": true,
  "files": ["plugins/superpowers", "marketplace/source.json"]
}
```

`oldTag` is the nearest annotated tag to the current pin, or `null` when pin is not tag-aligned (e.g. mattpocock-skills). Issue/PR copy uses `oldTag ?? oldPinSha` when `oldTag` is null.

#### Per-submodule behavior

**`mattpocock-skills`**

| Step | Action |
|---|---|
| Detect | Latest `v*` tag vs current pin |
| Change | Submodule gitlink only |
| source.json | No change (no version field) |
| emit | No |

**`impeccable`**

| Step | Action |
|---|---|
| Detect | Latest `skill-v*` tag vs current pin |
| Change | Submodule gitlink |
| source.json | Sync `impeccable.version` from `plugins/impeccable/plugin/.claude-plugin/plugin.json` (matches `contentRoot`) |
| emit | `pnpm run emit` |

**`superpowers`**

| Condition | Action |
|---|---|
| New tag, semver unchanged | Submodule gitlink + `pnpm run emit` |
| New tag, semver changed | Above + update `source.json` `superpowers.version` + set overrides to `{newSemver}-overrides.0` in `package.json` + prepend CHANGELOG entry + `sync-manifest-versions.mjs` (runs emit) |

Semver detection (order matters — step 1 before checkout, step 4 after):

```javascript
// 1. Before checkout
const oldVer = source.plugins.find(p => p.name === "superpowers").version;
// 2–3. checkout latest tag in submodule
// 4. After checkout
const newVer = JSON.parse(read("plugins/superpowers/.claude-plugin/plugin.json")).version;
const semverChanged = oldVer !== newVer;
```

**First-run side effect:** `mattpocock-skills` is currently pinned 40 commits ahead of `v1.1.0` (latest tag). Tag-based detection will propose rolling back to `v1.1.0`. PR body must explain this.

### 3. `.github/workflows/submodule-sync.yml`

```yaml
on:
  schedule:
    - cron: "0 1 * * 1"   # Mon 09:00 Asia/Shanghai
  workflow_dispatch:

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
          token: ${{ secrets.GITHUB_TOKEN }}
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      # Three serial steps below (not matrix — avoids concurrent push conflicts)
```

**Per submodule (three steps in one job, `continue-on-error: true` on each):**

1. `node scripts/bump-submodule.mjs <name> --dry-run` → skip if `updated: false`
2. Find open PR: `gh pr list --search "head:chore/bump-<name>" --state open`
3. Checkout existing head branch or create `chore/bump-<name>` from `origin/main`
4. **Rebase:** `git merge origin/main` (or rebase) so bump branch is current
5. `node scripts/bump-submodule.mjs <name>`
6. Commit + push
7. **Issue tracking (before PR create on first run):**
   - Resolve existing Issue: regex on open PR body `Tracking Issue: #(\d+)`; fallback `gh issue list --search "Submodule bump: <name> in:title" --state open --json number`.
   - **0 matches:** `gh issue create` → get `#N`
   - **1 match:** reuse `#N`
   - **>1 matches:** fail job (ambiguous; human cleanup)
   - **Subsequent updates:** `gh issue comment #N --body "Updated: <oldTag|oldPinSha> → <newTag>"`
8. **PR:** first time `gh pr create --body "Tracking Issue: #N\n\n..."`; updates only push (no duplicate PR). Optional `gh pr comment` only when PR already exists and pointer changed.

**First-time order:** steps 7 (create Issue) → step 8 (`gh pr create` with `Tracking Issue: #N` in body).

**PR metadata:**

- Labels: `submodule-bump`, `automated`
- Branch: `chore/bump-<submodule>`
- CI: existing `ci.yml` on PR

### 4. `scripts/tag-if-missing.mjs`

Called from `release.yml` after changesets action.

1. Read `plugins/superpowers-overrides/package.json` → `version`
2. If git tag `superpowers-overrides@{version}` exists → exit 0
3. Create tag, push, `gh release create superpowers-overrides@{version} --generate-notes`

**Division of labor:**

| Scenario | Tags via |
|---|---|
| Superpowers semver bump → `{ver}-overrides.0` (version set in bump PR) | `tag-if-missing.mjs` |
| Overrides-only release (changeset → `.1`, `.2`, …) | Existing changesets release chain |

Supports `--dry-run` for local testing.

### 5. Version scheme migration (`.0` start)

**`scripts/lib/version-utils.mjs` changes:**

```javascript
// Base reset (superpowers semver changed)
`${superpowersVersion}-overrides.0`   // was .1

// Increment on same base
.0 → .1 → .2 → …
```

**`scripts/version-packages.mjs`:** align first-release and base-reset paths to `.0`.

**Docs:** update `.changeset/README.md`, `CLAUDE.md` version scheme section.

**Existing releases unchanged:** `6.2.0-overrides.11` stays; next superpowers base starts at `.0`.

**Blocking dependency:** §5 version-utils / version-packages changes must land in the same implementation PR as superpowers semver-bump automation — partial deploy would write `.0` while release chain still expects `.1`.

### 6. Deprecations

- **`scripts/create-align-changeset.mjs`** — remove from `release.yml`; delete script. Superpowers align is handled directly in `bump-submodule.mjs`.
- **`version-packages.mjs` base-reset check** — update `endsWith("-overrides.1")` to `endsWith("-overrides.0")` where applicable.

## Error Handling

| Scenario | Behavior |
|---|---|
| Pinned SHA equals latest tag SHA | Skip submodule (`updated: false`); workflow exit 0 |
| `git fetch --tags` network failure | Job fails; GitHub sends workflow failure notification |
| CI fails on bump PR | PR stays open with red CI; human decides fix or close |
| Open bump PR branch deleted | Recreate branch + PR; reuse existing open Issue via title search (do not create duplicate Issue) |
| Superpowers bump breaks overrides compat | `validate:overrides` / `ci-validate.sh` fails; PR body notes possible manual overrides fixes |
| Tag already exists | `tag-if-missing.mjs` skips (idempotent) |
| Submodule step failure | Other submodules still run (`fail-fast: false`) |

## Testing

**Local (implementation phase):**

```bash
node scripts/bump-submodule.mjs superpowers --dry-run
node scripts/tag-if-missing.mjs --dry-run
pnpm run validate
```

**Optional:** unit tests for `version-utils.mjs` `.0` increment logic.

**First production validation:**

1. `workflow_dispatch` manual trigger
2. Expect up to three PRs on first run:
   - `mattpocock-skills`: rollback to `v1.1.0` (pin currently ahead of tag)
   - `impeccable`: forward bump `skill-v4.0.2` → `skill-v4.0.4`
   - `superpowers`: skip if already at `v6.2.0`
3. Review, merge, confirm tag/release where overrides version changed

## Files to Create/Modify

| File | Action |
|---|---|
| `.github/workflows/submodule-sync.yml` | Create |
| `scripts/bump-submodule.mjs` | Create |
| `scripts/lib/submodule-tags.mjs` | Create |
| `scripts/tag-if-missing.mjs` | Create |
| `scripts/lib/version-utils.mjs` | Modify (`.0` start) |
| `scripts/version-packages.mjs` | Modify |
| `.github/workflows/release.yml` | Add `tag-if-missing` step; remove align changeset step |
| `scripts/create-align-changeset.mjs` | Delete |
| `.changeset/README.md` | Update version scheme docs |
| `CLAUDE.md` | Update version scheme + submodule bump docs |

## Acceptance Criteria

1. Weekly cron runs without error when all submodules are up to date (no PRs opened).
2. When pinned SHA ≠ latest tag SHA, a PR appears within one cron cycle (forward bump or rollback-to-tag).
3. Updating an existing open bump PR does not create duplicate PRs or Issues.
4. Superpowers semver bump PR sets overrides to `{semver}-overrides.0` and passes CI (or fails with actionable errors).
5. Merging a bump PR that sets a new overrides version creates `superpowers-overrides@{version}` tag and GitHub Release.
6. Overrides-only changesets still release via existing changesets chain (`.1`, `.2`, …).
7. `pnpm run validate` passes after all changes.
