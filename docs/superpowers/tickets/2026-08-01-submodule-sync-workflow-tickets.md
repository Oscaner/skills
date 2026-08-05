# Submodule Sync Workflow — Tickets

Parent plan: [`docs/superpowers/plans/2026-08-01-submodule-sync-workflow.md`](../plans/2026-08-01-submodule-sync-workflow.md)

| # | Title | Blocked by | Plan tasks | Demo |
|---|---|---|---|---|
| T0 | Overrides version `.0` scheme | — | Task 1 | `node --test scripts/lib/version-utils.test.mjs` PASS |
| T1 | Submodule tag resolution library | — | Task 2 | `node --test scripts/lib/submodule-tags.test.mjs` PASS |
| T2 | bump-submodule CLI | T0, T1 | Task 3 | `bump-submodule impeccable --dry-run` → updated + newTag |
| T3 | tag-if-missing + release cleanup | T0 | Task 4 | `tag-if-missing --dry-run`; align script deleted |
| T4 | Weekly submodule-sync workflow | T2, T3 | Task 5 | workflow + publish.sh committed; chmod +x |
| T5 | Docs + full validate | T4 | Task 6 | `pnpm run validate` ALL PASS |

**Integration note:** T0–T3 should land on one branch before merging T4 to `main` (superpowers semver bump requires `.0` scheme + tag-if-missing on main).

---

## T0 — Overrides version `.0` scheme

**What to build:** `{superpowers-semver}-overrides.N` starts at `.0` on base reset; changesets increment `.0→.1→…`; existing `6.2.0-overrides.11` unchanged.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] `version-utils.test.mjs` passes (base reset → `.0`, increment from `.0`)
- [ ] `version-packages.mjs` uses `.0` for first release and base-reset detection
- [ ] Committed on integration branch

---

## T1 — Submodule tag resolution library

**What to build:** Pure helpers to fetch tags, semver-sort, compare pinned SHA vs latest tag SHA for `v*` / `skill-v*` patterns.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] `submodule-tags.mjs` exports TAG_PATTERNS, latestTag, pinnedSha, hasUpdate
- [ ] `submodule-tags.test.mjs` passes for parse + sort
- [ ] Committed on integration branch

---

## T2 — bump-submodule CLI

**What to build:** Single script entry per submodule: dry-run JSON + apply path (mattpocock gitlink only; impeccable source.json + emit; superpowers semver → overrides `.0` + CHANGELOG + sync-manifest).

**Blocked by:** T0, T1

**Status:** ready-for-agent

- [ ] `--dry-run` outputs spec JSON including semverChanged (via `git show tag:plugin.json`)
- [ ] Apply path uses `computeNextVersion` for overrides `.0`
- [ ] `superpowers --dry-run` returns updated:false when at latest tag
- [ ] Committed on integration branch

---

## T3 — tag-if-missing + release cleanup

**What to build:** On merge to main, tag + GitHub Release when package.json version has no git tag; remove align changeset script and release.yml step.

**Blocked by:** T0

**Status:** ready-for-agent

- [ ] `tag-if-missing.mjs` idempotent with `--dry-run`
- [ ] `release.yml` fetches tags + runs tag-if-missing after changesets
- [ ] `create-align-changeset.mjs` deleted
- [ ] Committed on integration branch (merge T0–T3 together before T4)

---

## T4 — Weekly submodule-sync workflow

**What to build:** Cron Mon 09:00 CST workflow calling publish script per submodule: open/update PR, Issue create/comment, no auto-merge.

**Blocked by:** T2, T3

**Status:** ready-for-agent

- [ ] `submodule-sync.yml` with submodules checkout + token
- [ ] `submodule-sync-publish.sh` handles Issue # resolution, branch fetch, git identity, mattpocock rollback PR note
- [ ] `continue-on-error: true` per submodule
- [ ] Committed

---

## T5 — Docs + full validate

**What to build:** Update `.changeset/README.md` and `CLAUDE.md`; run full validation suite.

**Blocked by:** T4

**Status:** ready-for-agent

- [ ] Version scheme docs reflect `.0` start + automated bump
- [ ] `pnpm run validate` ALL PASS
- [ ] All unit tests pass
