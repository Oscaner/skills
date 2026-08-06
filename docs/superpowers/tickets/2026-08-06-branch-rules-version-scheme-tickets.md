# Tickets: Branch rules + version scheme

Implement `develop`-first branch governance, CI gates, automation retarget, and three-segment overrides versioning. Parent plan: [../plans/2026-08-06-branch-rules-version-scheme.md](../plans/2026-08-06-branch-rules-version-scheme.md). Spec: [../specs/2026-08-06-branch-rules-version-scheme-design.md](../specs/2026-08-06-branch-rules-version-scheme-design.md).

Work the **frontier**: any ticket whose blockers are all done.

| # | Title | Blocked by | Plan tasks | Demo |
|---|-------|------------|------------|------|
| T1 | Three-segment version utils | — | Task 1 | `node --test scripts/lib/version-utils.test.mjs` PASS |
| T2 | Migrate repo to `6.2.0-overrides.0.15.0` | T1 | Task 2 | `pnpm run validate` PASS with new version |
| T3 | develop-first CI + automation | — | Task 3 | PR to `develop` runs `validate`; changesets `baseBranch: develop` |
| T4 | Ruleset + legacy cleanup scripts | T3 | Task 4 | Scripts exist and are executable |
| T5 | Maintainer documentation | T2, T3 | Task 5 | Docs describe develop→main flow + version scheme |
| T6 | Rollout verification | T1–T5 | Task 6 | Rulesets live; release tag on main; legacy tags gone |

---

## T1 — Three-segment version utils

**What to build:** Overrides versioning parses and computes `{base}-overrides.{major}.{minor}.{patch}`; legacy single-counter format rejected; unit tests run in CI.

**Blocked by:** None — can start immediately.

- [ ] `parseOverridesVersion("6.2.0-overrides.0.15.0")` returns `{ base, major, minor, patch }`
- [ ] `computeNextVersion` increments patch on same base; resets to `0.0.0` on superpowers base change (including patch bump)
- [ ] `node --test scripts/lib/version-utils.test.mjs` PASS
- [ ] `scripts/ci-validate.sh` includes version-utils test step

---

## T2 — Migrate repo to `6.2.0-overrides.0.15.0`

**What to build:** Entire repo version surface migrated from `6.2.0-overrides.15` to `6.2.0-overrides.0.15.0`; validate rejects legacy format.

**Blocked by:** T1 — Three-segment version utils

- [ ] `plugins/superpowers-overrides/package.json` version is `6.2.0-overrides.0.15.0`
- [ ] `validate-version-sync.mjs` rejects single-counter format
- [ ] `version-packages.mjs` init/baseReset use `0.0.0` suffix
- [ ] CHANGELOG top entry documents scheme migration
- [ ] `pnpm run validate` PASS

---

## T3 — develop-first CI + automation

**What to build:** All daily/automation PRs target `develop`; PRs to `main` from non-`develop` branches fail CI gate; changesets Version PRs open on `develop`.

**Blocked by:** None — can start immediately (parallel with T1/T2).

- [ ] `ci.yml` runs on PRs to `develop` and `main`
- [ ] `main-source-gate.yml` job named `Main PRs must come from develop`
- [ ] `.changeset/config.json` `baseBranch: develop`
- [ ] dependabot + submodule-sync PR base is `develop`
- [ ] `changesets-version.yml` runs on push to `develop`
- [ ] `release.yml` has comment documenting split (version on develop, tag on main)

---

## T4 — Ruleset + legacy cleanup scripts

**What to build:** Idempotent `gh` ruleset apply script and legacy tag cleanup script (bash 3.2 compatible, safe grep).

**Blocked by:** T3 — develop-first CI + automation

- [ ] `scripts/gh-branch-rulesets.sh` + JSON payloads for `protect-develop` / `protect-main`
- [ ] `scripts/cleanup-legacy-release-tags.sh` uses `grep -Ee` and `while read` (no `mapfile`)
- [ ] Both scripts executable

---

## T5 — Maintainer documentation

**What to build:** CLAUDE.md, changeset README, and README describe develop integration, develop→main release, and three-segment version with `0.0.0` reset examples.

**Blocked by:** T2 — Migrate repo; T3 — develop-first CI + automation

- [ ] Releasing docs match spec branch model
- [ ] Version examples use `6.2.0-overrides.0.15.0` format (not single counter)
- [ ] Submodule bump reset documented as `-overrides.0.0.0`

---

## T6 — Rollout verification

**What to build:** Maintainer applies rulesets, merges develop→main release PR, cleans legacy tags; all spec acceptance criteria verified.

**Blocked by:** T1, T2, T3, T4, T5

- [ ] PR merged to `develop`; `default_branch=develop`
- [ ] Throwaway PR to `main` from feat branch fails gate check
- [ ] `./scripts/gh-branch-rulesets.sh` applied; direct push blocked
- [ ] Release PR `develop → main` creates tag `superpowers-overrides@6.2.0-overrides.0.15.0`
- [ ] `./scripts/cleanup-legacy-release-tags.sh` on `main` removes old single-counter tags
- [ ] No duplicate Version PR opened on `main` push
