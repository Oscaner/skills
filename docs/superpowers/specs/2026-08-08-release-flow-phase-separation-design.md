# Release flow: phase separation and correct tag/release/sync timing

**Date:** 2026-08-08
**Status:** Draft — pending user review
**Repo:** [Oscaner/skills](https://github.com/Oscaner/skills)
**Scope:** Fix release.yml creating tag/GitHub Release/sync PR before the Version PR is merged; make tag point at the correct commit; eliminate the patch-work of conditional steps.
**Supersedes (partial):** [2026-08-06-changesets-release-on-main-design.md](./2026-08-06-changesets-release-on-main-design.md) — the sync-PR gating section, including the outer `published == 'true' || gh-release.outcome == 'success'` gate, the `published`-based run matrix, and the `id: gh-release` dependency, all replaced by the `hasChangesets` gate here.

## Problem

Merging PR #90 (`develop → main`) triggered `release.yml`. The `changesets/action` found 3 pending changesets, so it entered **PR mode**: it switched the workspace to the `changeset-release/main` branch, ran the version script, opened Version PR #91, and returned `published=false`.

The steps after `changesets/action` ran **unconditionally**. They:

1. Resolved HEAD to the `changeset-release/main` branch tip (`04843a7`) — **not** `main` (`747d24c`).
2. Created git tag `superpowers-overrides@6.2.0-overrides.0.15.3` on that wrong commit.
3. Created a GitHub Release for that tag.
4. Opened sync PR #92 (`main → develop`) — before the release even happened.

Net result: tag, Release, and sync PR all appeared while Version PR #91 was still open. The tag pointed at an unmerged branch tip, and the sync PR carried an incomplete main (missing the version bump that #91 would bring).

**Root cause:** the workflow does not distinguish **PR mode** from **publish mode**. The two modes of `changesets/action@v1` differ in intent and workspace state, and every downstream step must gate on which mode ran.

## Goals

1. tag + GitHub Release + sync PR run **only** in publish mode (no pending changesets), after the Version PR is merged.
2. The git tag points at the **main** commit that contains the version bump — never a `changeset-release/*` branch tip.
3. Remove the fragile `git rev-parse HEAD` + `createRef` tag-creation path.
4. Keep the existing PR-list-style Release notes (`generate_release_notes: true`).
5. Clean up the mis-created tag / Release / sync PR from this incident.

## Non-goals

- Change the two-PR flow (`develop → main`, then Version PR on `main`). Confirmed with user: keep dual-PR.
- Auto-merge the sync PR (develop ruleset requires manual merge).
- Change Version PR title (`chore: release superpowers-overrides`).
- Revert PR #90 or rewrite main history. `main`'s content is correct; only the workflow timing was wrong.
- Change CI, dependabot, or submodule-sync targets.

## Verified technical facts

These were confirmed from source before designing (do not re-derive):

| Fact | Source |
|------|--------|
| `changesets/action` PR mode switches workspace to `changeset-release/<branch>`, runs `version`, opens PR, returns `published=false` | `dist/index.js` — PR-mode branch calls `prepareBranch` + `version` + PR creation |
| `changesets/action` publish mode runs the `publish` script, then sets `published=true` only if the script's stdout parses `New tag:` lines | `Rt` function — parses `/New tag:\s+(.+?)@(.+)/` |
| `published` depends on stdout parsing, so a publish where the tag already exists yields `published=false` | `Rt` — empty `u` when no `New tag:` in output → `{published:!1}` |
| `changeset tag` creates **local** tags only — no push | `changesets-cli.cjs.js` `tag()` |
| The action's `pushTag` (`git push origin <tag>`) and native Release creation (`Lt`) are **both** gated on `createGithubReleases`; setting it `false` means the tag is **not** pushed and no Release is created by the action | `Rt` — `a && await Promise.all(u.map(e => pushTag + Lt))`, where `a` is `createGithubReleases` |
| With `createGithubReleases: true`, the action creates a Release with `prerelease: version.includes('-')` — our version `6.2.0-overrides.0.15.3` contains `-`, so it would be marked prerelease | `Lt` function |
| With `createGithubReleases: true`, Release body is the changelog entry, not PR-list notes | `Lt` — body = changelog entry via `Mt()` |
| `changesets` logger writes `New tag:` lines to **stdout** | `@changesets/logger` — `console.log(format(...))` |

Conclusion from the facts: rely on **`hasChangesets`**, not `published`, to gate publish-mode work. `hasChangesets` is `true` in PR mode and `false` in publish mode; it does not depend on stdout parsing and survives a pre-existing tag.

## Design

### Core: split the workflow by `hasChangesets`

| | PR mode (changesets pending) | Publish mode (no changesets) |
|---|---|---|
| `hasChangesets` output | `true` | `false` |
| Intent of this push | open / update Version PR | actually release |
| tag + Release + sync | **skip** | **run** |

`release` job exposes `hasChangesets` as a job output; every publish-only step and the `sync-develop` job gate on `hasChangesets == 'false'`.

### Tag: `changeset tag` creates it locally, we push it explicitly

In publish mode, `publish: pnpm exec changeset tag` runs against the checked-out HEAD — which is `main` after the Version PR merge — and creates the tag **locally** on that commit. Because `createGithubReleases: false` also disables the action's `pushTag`, we push the concrete tag ourselves:

```yaml
- name: Push git tag
  if: steps.changesets.outputs.hasChangesets == 'false'
  run: git push origin "superpowers-overrides@${{ steps.overrides-ver.outputs.version }}"
```

This step runs after `Read overrides version`, so the tag name is computed from the same post-merge `package.json` that `changeset tag` tagged — they cannot diverge.

Delete the custom `Resolve HEAD SHA for tagging` + `Create git tag if missing` steps entirely. They were the source of the wrong-commit tag: `git rev-parse HEAD` resolved to the `changeset-release/main` branch tip that PR mode had left the workspace on.

If `changeset tag` finds the tag already exists (e.g. re-run), it logs `Skipping tag (already exists)`; `git push origin <tag>` then fails with "tag already exists" only if the remote tag points elsewhere — after cleanup this does not occur, and a same-commit re-run pushes the identical ref (a no-op).

### Release: explicitly `createGithubReleases: false`, we create a real Release

Set `createGithubReleases: false` on `changesets/action`. The action's native Release creation would mark our `-`-containing version as a **prerelease** and use the changelog body (verified). Instead, in publish mode, check for an existing Release and create one with `softprops/action-gh-release`:

The `exists` guard is deliberate and must not be dropped: `release.yml` fires on every push to `main`, and the `softprops` action would fail (or silently no-op) on a tag that already has a Release. The guard makes the no-new-release push a clean no-op. Keep it even though the tag step itself is idempotent — the Release create is not.

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

Order matters: `changeset tag` created the local tag in the `changesets/action` step (publish mode), `Push git tag` pushes it to origin, then `softprops` creates the Release against the now-existing remote tag.

`id: gh-release` is kept for diff-minimality; nothing downstream reads `steps.gh-release.outcome` anymore (the sync gate no longer uses it).

In publish mode the working tree is `main` at the merged Version PR head, so `package.json` already carries the bumped version — `Read overrides version` reads the correct value. (In PR mode this step is skipped, so no stale-value risk.)

### Sync PR: only in publish mode

`sync-develop` job gets `if: needs.release.outputs.hasChangesets == 'false'`. This is the same workflow (`sync-main-to-develop.yml`) called at the correct time — after the Version PR is merged and the release is done, when `main` genuinely contains the version bump.

### Permissions

`release.yml` already has `contents: write` (for tag push / release create) and `pull-requests: write` (for PRs). No change.

## Run matrix

| Push to main | `hasChangesets` | tag + Release | sync PR |
|---|---|---|---|
| `develop → main` with pending changesets | `true` | **No** (PR mode) | **No** |
| Version PR merged (no changesets left) | `false` | **Yes** — `changeset tag` local + our push + softprops Release | **Yes** |
| Push with no new release (tag/Release already exist) | `false` | **No** (Release exists check) | **Yes** (main ahead) or **No** (aligned) |

## Cleanup of current incident state

Ordered, before the fix ships:

1. Delete mis-created Release + tag:
   ```bash
   gh release delete superpowers-overrides@6.2.0-overrides.0.15.3 --yes --cleanup-tag
   ```
   The tag `superpowers-overrides@6.2.0-overrides.0.15.3` currently points at `04843a7` (unmerged `changeset-release/main` tip); `--cleanup-tag` removes it with the Release.
2. Close sync PR #92 (created before release completed; let the fixed flow reopen it at the right time).
3. Close Version PR #91 (its `changeset-release/main` branch was generated against the pre-fix workflow; the fixed flow will regenerate it on the next push).
4. Keep PR #90 merged on `main` — its content is correct; `main` still carries the 3 changeset files that the next Version PR will consume.

The stale remote branches `changeset-release/main` (head of #91) and `chore/sync-main-to-develop` (head of #92) are **intentionally left in place** — closing the PRs does not delete them, and both workflows overwrite them on the next run (`changesets/action` `prepareBranch`; sync workflow `checkout -B` + `--force-with-lease`). Deleting them is optional and not required for the fix.

After the fix lands, trigger `release.yml` on `main` again (any push) so the action regenerates the Version PR → merge → publish mode creates tag + Release + sync PR correctly.

## Acceptance criteria

- [ ] Merging a `develop → main` PR with pending changesets does **not** create a tag, Release, or sync PR; it only opens/updates the Version PR.
- [ ] Merging the Version PR (which is a `push → main`) triggers publish mode; `changeset tag` creates the tag **on main's tip**, our `git push origin <tag>` publishes it (verify via `git ls-remote` that the tag target is in `main` history).
- [ ] The GitHub Release is created for that tag with PR-list notes and **not** marked prerelease.
- [ ] The sync PR (`main → develop`) is opened only after the release completes.
- [ ] `hasChangesets` (not `published`) is the single gate; `published` does not appear in `release.yml`.
- [ ] The custom `git rev-parse HEAD` + `createRef` tag step no longer exists in `release.yml`.
- [ ] Cleanup above is done: wrong tag + Release deleted, #91 + #92 closed, #90 intact.

## Risks

| Risk | Mitigation |
|---|---|
| `hasChangesets == 'false'` on a push that also has no changesets but where tag/Release already exist | Release-exists check makes it a no-op; sync PR still correct |
| Publish-mode tag push fails on an already-existing tag | `changeset tag` logs skip; our `git push origin <tag>` fails only if the remote tag points elsewhere (does not occur after cleanup) |
| Publish script stdout does not produce `New tag:` (e.g. tag pre-exists) | We don't depend on `published` — only `hasChangesets` |
| `package.json` version read in publish mode differs from the tag | They are the same file at the same HEAD; `changeset tag` and `Read overrides version` both read post-merge main |
| Workflow regenerates Version PR on next push while #91 is still open | `changesets/action` updates the existing open PR on the same branch (`changeset-release/main`) rather than creating a duplicate |
| Sync trigger is publish mode, not "a new release happened this run" — it opens on any publish-mode push where main is ahead, including pushes that produced no new tag/Release | Intended behavior change (run matrix row 3); sync job's own ahead/not-ahead logic decides whether a PR actually opens |

## Files touched (implementation preview)

| Path | Action |
|------|--------|
| `.github/workflows/release.yml` | Rework gates: job output `hasChangesets`; remove tag-creation steps; add explicit `git push origin <tag>`; `createGithubReleases: false`; publish-mode guards on version-read / tag-push / release-exists / release-create; `sync-develop` gated on `hasChangesets == 'false'` |
| `docs/superpowers/specs/2026-08-06-changesets-release-on-main-design.md` | Add deviation note pointing to this spec for the sync-PR gate |
| `README.md` / `CLAUDE.md` (Releasing section) | Update flow description to the corrected two-phase behavior if they describe the old gate |
