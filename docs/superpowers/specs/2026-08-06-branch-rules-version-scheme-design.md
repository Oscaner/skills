# Branch rules + overrides version scheme

**Date:** 2026-08-06  
**Status:** Draft — pending user review  
**Repo:** [Oscaner/skills](https://github.com/Oscaner/skills)  
**Scope:** GitHub branch governance, CI gates, automation target branches, superpowers-overrides semver migration

## Problem

Today:

- No GitHub Rulesets or branch protection on `main` / `develop`.
- All PRs and automation (dependabot, submodule-sync, changesets) target `main`.
- `feat/*` / `fix/*` can open PRs directly to `main`.
- Overrides version uses a single counter: `{superpowers-semver}-overrides.{N}` (e.g. `6.2.0-overrides.15`).
- 14 legacy git tags / GitHub Releases exist under the old scheme.

We need a GitFlow-lite model: integrate on `develop`, release via `develop → main`, enforce with `gh` rulesets + CI, and adopt a three-segment overrides version.

## Goals

1. **`develop`** is the integration branch (already renamed from `v0`; no further rename).
2. Daily work (`feat/*`, `fix/*`, `chore/*`) and automation PRs target **`develop` only**.
3. **`main`** accepts PRs **only from `develop`**; release workflow stays on `push → main`.
4. Both **`develop`** and **`main`**: no direct push, require PR, require CI, **no admin bypass**.
5. Overrides version: `{superpowers-semver}-overrides.{major}.{minor}.{patch}`; reset to `0.0.0` when superpowers semver changes on **any** segment (including patch, e.g. `6.2.0` → `6.2.1`).
6. Delete legacy `superpowers-overrides@6.2.0-overrides.*` tags/releases; current version maps to `6.2.0-overrides.0.15.0`.

## Non-goals

- No org-level rulesets (repo-scoped only).
- No changes to vendored submodule repos.
- No rewriting historical CHANGELOG entry titles (archive only).
- No `v*` release-line branches (user chose `develop → main` directly).

## Branch model

```
feat/fix/chore/* ──PR──► develop ──PR (release)──► main
                              ▲                         │
                              │                         ▼
              dependabot / submodule-sync          release.yml
              / changesets Version PR              (tag + GH Release)
```

| Branch | Role | Merge policy |
|--------|------|--------------|
| `develop` | Integration | PR only; required check `validate` |
| `main` | Release | PR only from `develop`; required checks `validate` + `Main PRs must come from develop` |
| Topic branches | Work | PR → `develop` (convention; not blocked by CI gate) |

**Default branch:** `develop` (set via `gh api` if not already).

## GitHub Rulesets

Two repository rulesets, **`bypass_actors: []`** (no admin bypass).

### Ruleset: `protect-develop`

- **Target:** `refs/heads/develop`
- **Rules:** `pull_request`, `non_fast_forward`, `deletion`, `required_status_checks`
- **Required checks:** `validate` (strict: branch up to date)

### Ruleset: `protect-main`

- **Target:** `refs/heads/main`
- **Rules:** same as develop
- **Required checks:** `validate`, `Main PRs must come from develop` (strict)

Deliver as idempotent script: `scripts/gh-branch-rulesets.sh` (list → PATCH if exists, POST if not).

JSON payloads (generated or committed):

- `scripts/gh-branch-rulesets/develop.json` — ruleset `protect-develop`
- `scripts/gh-branch-rulesets/main.json` — ruleset `protect-main`

## CI workflows

### New: `.github/workflows/main-source-gate.yml`

- **Trigger:** `pull_request` → `main` (`opened`, `reopened`, `synchronize`, `edited`)
- **Job name:** `Main PRs must come from develop` (must match ruleset context exactly)
- **Logic:** fail unless `github.head_ref == develop`

GitHub has no native ruleset for “PR head must be branch X”; this workflow is the enforcement mechanism and a required status check on `main`.

### Modify: `.github/workflows/ci.yml`

```yaml
on:
  pull_request:
    branches: [develop, main]
```

Job name stays `validate` (existing ruleset reference).

### Unchanged: `.github/workflows/release.yml`

Still `on.push.branches: [main]`. Tag format: `superpowers-overrides@{version}`.

## Automation target branches

| File | Change |
|------|--------|
| `.changeset/config.json` | `"baseBranch": "develop"` |
| `.github/dependabot.yml` | `target-branch: develop` on both ecosystems |
| `.github/workflows/bump-submodule-reusable.yml` | `create-pull-request` `base: develop` |

## Version scheme

### Format

```
{superpowers-semver}-overrides.{major}.{minor}.{patch}
```

### Increment semantics

- **`overrides.major` is always `0`** until a future breaking overrides release (out of scope).
- **Changeset / patch release:** increment **`patch`** only (`0.15.0` → `0.15.1` → `0.15.2`).
- **`overrides.minor`:** set from legacy counter at migration (`N` → `0.N.0`); does not auto-increment on changesets.
- **Superpowers base change (any semver segment):** reset to `{new-base}-overrides.0.0.0`.

### One-time migration mapping

Old single-counter format `{base}-overrides.{N}` maps to `{base}-overrides.0.{N}.0` (counter → **minor**, patch = `0`).

| Old | New |
|-----|-----|
| `6.2.0-overrides.15` | `6.2.0-overrides.0.15.0` |
| `6.2.0-overrides.1` | `6.2.0-overrides.0.1.0` |

### Code changes

**`scripts/lib/version-utils.mjs`**

- `parseOverridesVersion`: regex `^(\d+\.\d+\.\d+)-overrides\.(\d+)\.(\d+)\.(\d+)$` → `{ base, major, minor, patch }`
- `computeNextVersion`: base unchanged → increment `patch`; base changed → `{superpowersVersion}-overrides.0.0.0`

**`scripts/lib/version-utils.test.mjs`:** update fixtures; add patch-level superpowers reset case.

**`scripts/version-packages.mjs`:**

- Init version: `{superpowersVersion}-overrides.0.0.0`
- `baseReset` detection: `nextVersion.endsWith("-overrides.0.0.0")` when base changed

**`scripts/bump-submodule.mjs`:** uses `computeNextVersion` — no logic change beyond utils.

**`scripts/validate-version-sync.mjs`:** add strict regex requiring three-segment suffix (reject legacy single-counter format).

**Docs:** `CLAUDE.md`, `.changeset/README.md`, README maintainers section.

**CHANGELOG:** keep historical `6.2.0-overrides.{N}` headers; add top entry for `6.2.0-overrides.0.15.0` noting scheme change.

## Legacy tag / release cleanup

One-time script: `scripts/cleanup-legacy-release-tags.sh`

- Match old-format tags: `superpowers-overrides@{base}-overrides.{N}` where `{N}` is a **single** numeric segment (regex: `-overrides\.\d+$`), i.e. **not** three segments (`-overrides.\d+.\d+.\d+$`).
- For each match: `gh release delete` (if exists) + delete git tag via API / `git push :refs/tags/...`
- **Do not** delete tags already on three-segment format

**When to run:** after first new-format release tag exists on `main` (Step 5 complete), before announcing scheme change — maintainer manual step in rollout.

## Rollout order

| Step | Action | Notes |
|------|--------|-------|
| 1 | PR to `develop`: CI extension, main-source-gate, automation targets, version utils + bump to `6.2.0-overrides.0.15.0` | Rulesets not yet applied — avoids blocking while checks don't exist |
| 2 | Merge PR; verify `validate` + gate jobs appear on a test PR |
| 3 | Run `scripts/gh-branch-rulesets.sh` | Requires checks to exist in repo |
| 4 | Confirm `default_branch=develop` via `gh api` | Skip if already set |
| 5 | Open and **merge** release PR `develop → main` | Creates first new-format tag on merge |
| 6 | Run `scripts/cleanup-legacy-release-tags.sh` on `main` | After Step 5 merge; maintainer manual |

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Rulesets created before CI jobs exist → merges blocked | Step 1 before Step 3 |
| Required check name mismatch | Job `name:` must exactly match ruleset `context` |
| Changesets Version PR now targets `develop` | Release still requires explicit `develop → main` PR |
| Deleted legacy tags break old doc links | CHANGELOG note; specs keep historical references as archive |
| Dependabot PRs fail until rulesets + CI land | Land workflow changes before rulesets |

## Acceptance criteria

- [ ] PR to `main` from `feat/foo` fails required check `Main PRs must come from develop`
- [ ] PR to `main` from `develop` passes all required checks (when CI green)
- [ ] Direct push to `main` or `develop` rejected by ruleset
- [ ] dependabot / submodule-sync / changesets open PRs against `develop`
- [ ] `pnpm run validate` passes with version `6.2.0-overrides.0.15.0`
- [ ] `computeNextVersion("6.2.0-overrides.0.15.0", "6.2.1")` → `6.2.1-overrides.0.0.0`
- [ ] Legacy single-counter release tags removed from GitHub

## Files touched (implementation preview)

| Path | Action |
|------|--------|
| `.github/workflows/main-source-gate.yml` | Add |
| `.github/workflows/ci.yml` | Modify triggers |
| `.changeset/config.json` | `baseBranch: develop` |
| `.github/dependabot.yml` | `target-branch: develop` |
| `.github/workflows/bump-submodule-reusable.yml` | `base: develop` |
| `scripts/lib/version-utils.mjs` | Three-segment semver |
| `scripts/lib/version-utils.test.mjs` | Update tests |
| `scripts/version-packages.mjs` | Init / baseReset |
| `scripts/gh-branch-rulesets.sh` | Add (+ JSON payloads) |
| `scripts/cleanup-legacy-release-tags.sh` | Add |
| `plugins/superpowers-overrides/package.json` | version → `6.2.0-overrides.0.15.0` |
| `marketplace/source.json` + emit | Sync version |
| `CLAUDE.md`, `.changeset/README.md`, README | Docs |
