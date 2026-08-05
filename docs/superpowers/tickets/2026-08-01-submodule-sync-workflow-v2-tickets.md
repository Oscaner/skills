# Submodule Sync Workflow v2 — Tickets

Parent plan: [docs/superpowers/plans/2026-08-01-submodule-sync-workflow-v2.md](../plans/2026-08-01-submodule-sync-workflow-v2.md)

| # | Title | Blocked by | Plan tasks | Demo |
|---|-------|------------|------------|------|
| T0 | Merge sync scripts | — | Task 1 | `pnpm run validate` passes; `sync-overrides-versions.mjs` replaces manifest+dogfood |
| T1 | Consolidate validate scripts | — | Task 2 | `ci-validate.sh` calls merged validators; ALL PASS |
| T2 | Migrate release tagging to Actions | — | Task 3 | `tag-if-missing.mjs` deleted; `release.yml` uses github-script + gh-release |
| T3 | Add reusable bump workflow | T0 | Task 4 | `bump-submodule-reusable.yml` exists with full step chain |
| T4 | Matrix caller + delete bash glue | T3 | Task 5 | `submodule-sync.yml` matrix-only; `submodule-sync-publish.sh` gone |
| T5 | Docs + label bootstrap | T2, T4 | Task 6 | CLAUDE.md + changeset README updated; label bootstrap documented |

---

## T0 — Merge sync scripts

**What to build:** Single `sync-overrides-versions.mjs` replaces `sync-manifest-versions.mjs` + `sync-dogfood-self-check.mjs`; update bump and version-packages call sites.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] `scripts/sync-overrides-versions.mjs` created with merged behavior
- [ ] Old sync scripts deleted; call sites updated
- [ ] `pnpm run validate` passes
- [ ] Commit: `refactor: merge sync-overrides-versions script`

---

## T1 — Consolidate validate scripts

**What to build:** `validate-marketplace.mjs` + `validate-version-sync.mjs` replace three validate scripts and ci-validate inline blocks; keep steps 1–5, 7, 11 in ci-validate.

**Blocked by:** None — can start immediately (may run parallel with T0 in separate branch; serial merge recommended).

**Status:** ready-for-agent

- [ ] Merged validate scripts created; old three deleted
- [ ] `ci-validate.sh` updated; steps 1–5, 7, 11 preserved
- [ ] `pnpm run validate` + `node --test scripts/lib/*.test.mjs` pass
- [ ] Commit: `refactor: consolidate marketplace and version validate scripts`

---

## T2 — Migrate release tagging to Actions

**What to build:** Remove `tag-if-missing.mjs`; release.yml creates tag at HEAD + GitHub Release via Actions.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] `release.yml` updated per v2 spec (HEAD sha, github-script, softprops/action-gh-release)
- [ ] `tag-if-missing.mjs` deleted; no stale references
- [ ] `pnpm run validate` passes
- [ ] Commit: `refactor: release overrides tag via GitHub Actions`

---

## T3 — Add reusable bump workflow

**What to build:** `.github/workflows/bump-submodule-reusable.yml` with detect → bump → Issue Action chain → CPR → comment.

**Blocked by:** T0 (sync script path stable).

**Status:** ready-for-agent

- [ ] Read v1 spec §2 before implementing YAML
- [ ] Verified `create-issue-from-file@v6` output name for issue number
- [ ] Full reusable workflow committed
- [ ] Commit: `feat: add reusable bump-submodule workflow`

---

## T4 — Matrix caller + delete bash glue

**What to build:** Rewrite `submodule-sync.yml` as matrix caller; delete `submodule-sync-publish.sh`.

**Blocked by:** T3.

**Status:** ready-for-agent

- [ ] Matrix caller with `fail-fast: false`; no continue-on-error
- [ ] Bash publish script deleted; no references remain
- [ ] `pnpm run validate` passes
- [ ] Commit: `feat: matrix submodule sync via reusable workflow`

---

## T5 — Docs + label bootstrap

**What to build:** Update CLAUDE.md and .changeset/README.md; document label bootstrap and v1 Issue migration.

**Blocked by:** T2, T4.

**Status:** ready-for-agent

- [ ] Docs reflect v2 architecture and script layout
- [ ] Label bootstrap + Issue #31 migration documented
- [ ] Post-merge verification checklist included
- [ ] Commit: `docs: submodule sync v2 workflow and script layout`

---

## Post-merge (human)

1. Run label bootstrap on repo.
2. Label Issue #31 with `submodule-bump` + `submodule:mattpocock-skills`.
3. `workflow_dispatch` Submodule Sync twice (verify CPR re-run).
4. Verify release tag path on next overrides merge.
