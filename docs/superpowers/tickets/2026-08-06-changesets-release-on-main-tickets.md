# Tickets: Changesets release on main + develop sync

Fix develop-side changesets release (#59): accumulate on `develop`, release on `main`, auto sync PR when `main` is ahead. Parent plan: [2026-08-06-changesets-release-on-main.md](../plans/2026-08-06-changesets-release-on-main.md). Spec: [2026-08-06-changesets-release-on-main-design.md](../specs/2026-08-06-changesets-release-on-main-design.md).

Work the **frontier**: any ticket whose blockers are all done.

## T1 — Remove develop-side release workflow

**What to build:** Pushing to `develop` no longer triggers any changesets Version PR workflow; changesets `baseBranch` points at `main` so future Version PRs target `main`.

**Blocked by:** None — can start immediately.

**Plan tasks covered:** Task 1

**Demo:** `changesets-version.yml` deleted; `.changeset/config.json` has `"baseBranch": "main"`; `rg changesets-version` shows no workflow references.

- [ ] `.github/workflows/changesets-version.yml` deleted
- [ ] `.changeset/config.json` → `"baseBranch": "main"`
- [ ] Commit: `fix: release changesets only on main, not develop`

## T2 — Extend release.yml with sync PR

**What to build:** After a successful publish or new GitHub Release on `main`, when `main` is strictly ahead of `develop`, workflow opens/updates a `main → develop` sync PR. Submodule fast-forward (branches equal) skips sync PR.

**Blocked by:** T1 — Remove develop-side release workflow

**Plan tasks covered:** Task 2

**Demo:** `release.yml` has `id: changesets`, `id: gh-release`, needs-sync check, back-merge + create-pull-request steps; `pnpm run validate` passes.

- [ ] Top comment documents full flow (no `changesets-version` reference)
- [ ] `fetch-depth: 0` on checkout for branch comparison
- [ ] Sync PR steps match spec (release gate + needs-sync gate)
- [ ] Existing tag/GH Release steps unchanged
- [ ] Commit: `feat: auto-open main to develop sync PR after release`

## T3 — Documentation + spec deviation note

**What to build:** Maintainer docs describe the corrected flow; branch-rules spec records Deviation pointing to the changesets-on-main spec.

**Blocked by:** T2 — Extend release.yml with sync PR

**Plan tasks covered:** Task 3

**Demo:** README, CLAUDE, `.changeset/README` match spec flow; branch-rules spec has Deviation note; no stale "Version PR targets develop" references.

- [ ] `.changeset/README.md` updated
- [ ] `README.md` branch-flow paragraph fixed
- [ ] `CLAUDE.md` Releasing section rewritten
- [ ] Branch-rules spec Deviation note added
- [ ] Commit: `docs: changesets release on main with develop sync PR`
