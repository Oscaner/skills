# Submodule Sync Workflow v2 — Design Spec

**Date:** 2026-08-01  
**Status:** Approved (2026-08-01)  
**Supersedes:** [2026-08-01-submodule-sync-workflow-design.md](./2026-08-01-submodule-sync-workflow-design.md) (orchestration + Issue/PR layers only; bump logic unchanged)

## Problem

v1 shipped `submodule-sync-publish.sh` as the git/PR/Issue glue layer. Production runs exposed recurring failure modes:

- `gh` CLI version drift (`--json` unsupported on `issue create`)
- Bash quoting bugs (markdown backticks in `ROLLBACK_NOTE`)
- Non-fast-forward push when remote branch exists without open PR
- Manual rebase/force-push complexity
- `continue-on-error` masking failures until a custom Summary step was added

Business requirements from v1 remain valid (tag-based bump, separate PR per submodule, tracking Issue, superpowers `.0` reset, tag-if-missing on merge). This spec replaces **orchestration and GitHub integration** only.

## Goals

1. **Reusable workflow + matrix** — one job per submodule; `fail-fast: false` for natural partial-failure visibility.
2. **Actions-first** — no `gh` CLI in CI paths; use marketplace Actions + GitHub REST via Action wrappers.
3. **Delete `submodule-sync-publish.sh`** — zero bash glue for sync.
4. **Scripts consolidation (scope I)** — merge redundant validate/sync scripts; migrate release tagging to Actions.
5. Keep **`bump-submodule.mjs`** as the single business-logic entry for submodule bumps.

## Non-Goals

- Auto-merge bump PRs.
- Track upstream `main` tips (tag/release only).
- Change `bump-submodule.mjs` detection or per-submodule apply semantics.
- Modify overrides skill content on superpowers bump.

## Decisions (brainstorming)

| # | Decision |
|---|----------|
| 1 | Matrix caller → reusable `bump-submodule-reusable.yml` |
| 2 | PR: `peter-evans/create-pull-request@v8` (major tag pin) |
| 3 | Issue tracking: label pair `submodule-bump` + `submodule:<name>` |
| 4 | Issue chain: `micalevisk/last-issue-action@v2` → `peter-evans/create-issue-from-file@v6` → `peter-evans/create-or-update-comment@v5` |
| 5 | No update: silent success; later steps gated with `if:` on dry-run `updated` |
| 6 | Action versions: major tags (`@v8`, `@v6`, `@v2`, `@v5`) not SHA pin |
| 7 | Scripts scope **I**: delete bash publish script; merge sync/validate scripts; migrate `tag-if-missing` to release workflow Action |

## Architecture

```
submodule-sync.yml (caller)
  on: cron (Mon 09:00 CST) + workflow_dispatch
  jobs:
    bump:
      strategy:
        matrix:
          submodule: [mattpocock-skills, superpowers, impeccable]
        fail-fast: false
      uses: ./.github/workflows/bump-submodule-reusable.yml
      with:
        submodule: ${{ matrix.submodule }}
      secrets: inherit

bump-submodule-reusable.yml
  on: workflow_call
  inputs:
    submodule: { required: true, type: string }
  permissions:
    contents: write
    pull-requests: write
    issues: write
  jobs:
    sync:
      runs-on: ubuntu-latest
      steps: (see Reusable workflow steps)
```

No `continue-on-error`, no manual Summary step — matrix job failure surfaces workflow failure directly.

## Reusable workflow steps

| # | Step id | Condition | Action / command |
|---|---------|-----------|------------------|
| 1 | `checkout` | always | `actions/checkout@v7` — `submodules: recursive`, `fetch-depth: 0`, `token: ${{ secrets.GITHUB_TOKEN }}` |
| 2 | `setup` | always | pnpm + Node 22 + `pnpm install --frozen-lockfile` |
| 3 | `detect` | always | `node scripts/bump-submodule.mjs <name> --dry-run` → parse JSON outputs (see below) |
| 4 | `apply` | `detect.outputs.updated == 'true'` | `node scripts/bump-submodule.mjs <name>` |
| 5 | `find-issue` | `detect.outputs.updated == 'true'` | `micalevisk/last-issue-action@v2` |
| 6 | `create-issue` | `updated && find-issue.outputs.has-found != 'true'` | runtime-write issue body file → `peter-evans/create-issue-from-file@v6` |
| 7 | `issue-number` | `updated` | compose `#N` from find-issue or create-issue outputs |
| 8 | `pr-body` | `updated` | set `rollback_note` output (mattpocock only; empty string otherwise) |
| 9 | `cpr` | `updated` | `peter-evans/create-pull-request@v8` |
| 10 | `issue-comment` | `updated` | `peter-evans/create-or-update-comment@v5` — **always append** (no `comment-id`) |

**Order invariant:** Steps 5–7 **before** CPR (step 9) so PR body includes `Tracking Issue: #N`.

**Git operations:** Do **not** manually checkout bump branch, rebase, commit, or push. CPR manages `chore/bump-<submodule>`.

### Detect step (`id: detect`)

Parse `--dry-run` JSON (same shape as v1):

```json
{ "updated": true, "oldTag": "v1.1.0", "oldPinSha": "ed37663", "newTag": "v1.1.0", ... }
```

```yaml
- id: detect
  run: |
    json=$(node scripts/bump-submodule.mjs "${{ inputs.submodule }}" --dry-run)
    echo "$json" | node -e "
      const j = JSON.parse(require('fs').readFileSync(0,'utf8'));
      const fs = require('fs');
      const o = (k,v) => fs.appendFileSync(process.env.GITHUB_OUTPUT, k+'='+v+'\n');
      o('updated', j.updated === true);
      o('new_tag', j.newTag ?? '');
      o('old_label', j.oldTag ?? j.oldPinSha ?? '');
    "
```

Issue comment and PR copy use `old_label` → `new_tag`.

### Issue create (step 6)

**Not** committed files — generate at runtime:

```yaml
- id: write-issue-body
  if: steps.detect.outputs.updated == 'true' && steps.find-issue.outputs.has-found != 'true'
  run: |
    mkdir -p .github/issue-bodies
    cat > ".github/issue-bodies/${{ inputs.submodule }}.md" <<'EOF'
    Automated submodule sync tracking for `${{ inputs.submodule }}`.
    EOF

- id: create-issue
  uses: peter-evans/create-issue-from-file@v6
  with:
    title: Submodule bump: ${{ inputs.submodule }}
    content-filepath: .github/issue-bodies/${{ inputs.submodule }}.md
    labels: |
      submodule-bump
      submodule:${{ inputs.submodule }}
```

(`create-issue-from-file` outputs `issue-number` when creating; verify in action README at implementation time.)

### Issue comment (step 10)

Omit `comment-id` so each bump **appends** a new comment (matches v1): `Updated: ${{ steps.detect.outputs.old_label }} → ${{ steps.detect.outputs.new_tag }}`.

### CPR configuration (step 9, `id: cpr`)

```yaml
branch: chore/bump-${{ inputs.submodule }}
base: main
title: chore: bump ${{ inputs.submodule }} submodule
labels: |
  submodule-bump
  automated
commit-message: chore: bump ${{ inputs.submodule }} submodule
body: |
  Tracking Issue: #${{ steps.issue-number.outputs.number }}

  Automated tag sync.
  ${{ steps.pr-body.outputs.rollback_note }}
```

Set `steps.issue-number` after steps 5–6:

```yaml
- id: issue-number
  if: steps.detect.outputs.updated == 'true'
  run: |
    if [ "${{ steps.find-issue.outputs.has-found }}" = "true" ]; then
      echo "number=${{ steps.find-issue.outputs.issue-number }}" >> "$GITHUB_OUTPUT"
    else
      echo "number=${{ steps.create-issue.outputs.issue-number }}" >> "$GITHUB_OUTPUT"
    fi
```

Set `steps.pr-body` (`id: pr-body`) — always runs when `updated`, writes **`GITHUB_OUTPUT`**:

```yaml
- id: pr-body
  if: steps.detect.outputs.updated == 'true'
  run: |
    if [ "${{ inputs.submodule }}" = "mattpocock-skills" ]; then
      echo "rollback_note=> **Note:** Pin was not aligned to latest release tag; this PR syncs to \`${{ steps.detect.outputs.new_tag }}\`." >> "$GITHUB_OUTPUT"
    else
      echo "rollback_note=" >> "$GITHUB_OUTPUT"
    fi
```

### Labels

**Must exist before first workflow run** (GitHub does not auto-create unknown labels). One-time bootstrap via repo settings or:

```bash
gh label create submodule-bump --color EDEDED --description "Automated submodule sync tracking"
gh label create submodule:mattpocock-skills --color EDEDED
gh label create submodule:superpowers --color EDEDED
gh label create submodule:impeccable --color EDEDED
```

Document in `CLAUDE.md`. Include bootstrap in implementation plan (not repeated every cron run).

| Label | Purpose |
|-------|---------|
| `submodule-bump` | All automated bump tracking issues |
| `submodule:mattpocock-skills` | Per-submodule disambiguation |
| `submodule:superpowers` | |
| `submodule:impeccable` | |
| `automated` | On PRs (existing) |

At most **one open** tracking Issue per submodule. `last-issue-action` picks last updated if multiple exist — treat >1 open as operational debt, not job failure.

### Migration from v1 Issue tracking

Existing Issues created by v1 (title search, no labels) are **not** auto-linked. One-time manual step after v2 deploy: add `submodule-bump` + `submodule:<name>` labels to open tracking Issues (#31 etc.), or close duplicates. v2 will not fail on label migration gaps; may create a second Issue until labels are fixed.

## Unchanged: bump business logic

`scripts/bump-submodule.mjs` + `scripts/lib/submodule-tags.mjs` behavior matches v1 spec:

- Tag patterns: `v*` (mattpocock, superpowers), `skill-v*` (impeccable)
- Bump when `pinnedSha !== latestTag.sha`
- superpowers semver change → `{semver}-overrides.0` + CHANGELOG + `sync-overrides-versions.mjs`
- mattpocock → checkout tag + `pnpm run emit` (tag-derived version fallback in marketplace-utils)
- impeccable → sync source.json version + emit

Refer to v1 spec §2 for JSON output shape and per-submodule tables.

## Scripts consolidation (scope I)

### Delete

| File | Reason |
|------|--------|
| `scripts/submodule-sync-publish.sh` | Replaced by reusable workflow + Actions |

### Merge

| From | Into | New name |
|------|------|----------|
| `scripts/sync-manifest-versions.mjs` + `scripts/sync-dogfood-self-check.mjs` | single module | `scripts/sync-overrides-versions.mjs` |
| `scripts/validate-source.mjs` + `scripts/validate-wrapper-paths.mjs` + `scripts/validate-marketplace-sources.mjs` | single module | `scripts/validate-marketplace.mjs` |
| `ci-validate.sh` steps 8–10 inline `node -e` | extracted script | `scripts/validate-version-sync.mjs` |

**Call site updates:**

- `bump-submodule.mjs`, `version-packages.mjs` → `sync-overrides-versions.mjs`
- `ci-validate.sh`:
  - step 6 + 12 + 13 → `node scripts/validate-marketplace.mjs` (schema + wrapper paths + emitted plugin dirs)
  - step 8 + 9 + 10 → `node scripts/validate-version-sync.mjs` (overrides triple-check, prerelease prefix, superpowers sync)

**Merged script behavior (preserve existing semantics):**

| Script | Behavior |
|--------|----------|
| `sync-overrides-versions.mjs` | Read overrides `package.json` version → write `plugin.json` + `source.json` → `pnpm run emit` → sync dogfood self-check into `CLAUDE.md` + `.cursor/rules/superpowers-overrides.mdc` (inline former `sync-dogfood-self-check.mjs`) |
| `validate-marketplace.mjs` | Run in order: source.json schema (ex `validate-source`) → cursor wrapper paths (ex `validate-wrapper-paths`) → claude/cursor marketplace plugin dirs exist (ex `validate-marketplace-sources`); exit non-zero on first failure |
| `validate-version-sync.mjs` | Run in order: overrides version triple-check (step 8) → prerelease prefix (step 9) → superpowers version sync (step 10); same assertions as current inline `node -e` blocks |

### Migrate: release tag + GitHub Release

Remove `scripts/tag-if-missing.mjs` and the `Fetch tags for tag-if-missing` step from `release.yml`.

After `changesets/action` (which may commit version bumps), tag **current workspace HEAD** (same as v1 script — not `context.sha` if changesets added a commit):

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

- name: Create GitHub Release if missing
  uses: softprops/action-gh-release@v2
  with:
    tag_name: superpowers-overrides@${{ steps.overrides-ver.outputs.version }}
    generate_release_notes: true
    skip_if_release_exists: true
```

Add `permissions: contents: write` if release creation needs it (already on job).

Local verification: `git rev-parse superpowers-overrides@$(node -p "require('./plugins/superpowers-overrides/package.json').version")`.

### Final scripts layout (target)

```
scripts/
  bump-submodule.mjs
  ci-validate.sh              # thinner orchestrator
  emit-marketplace.mjs
  sync-overrides-versions.mjs # merged
  validate-marketplace.mjs    # merged
  validate-version-sync.mjs   # extracted
  version-packages.mjs
  lib/
    marketplace-utils.mjs
    submodule-tags.mjs
    submodule-tags.test.mjs
    version-utils.mjs
    version-utils.test.mjs
```

14 files → 10 files (excluding tests under lib/).

## Error handling

| Scenario | Behavior |
|----------|----------|
| `updated=false` | Steps 4–8 skipped; job success |
| One matrix job fails | Others continue; workflow fails |
| CPR finds no changes | CPR exits without PR (should not happen if step 4 ran) |
| Network / tag fetch failure | Job fails |
| GITHUB_TOKEN PR scope | CPR PR does **not** trigger `ci.yml` on `pull_request` (GitHub anti-recursion); human re-runs CI or close/reopen PR |
| Open bump branch deleted | CPR recreates branch + PR; Issue reused via labels |

## Testing

**Local:**

```bash
node scripts/bump-submodule.mjs superpowers --dry-run
pnpm run validate
node --test scripts/lib/*.test.mjs
```

**CI (first `workflow_dispatch` after deploy):**

| Submodule | Expected |
|-----------|----------|
| mattpocock-skills | PR if pin ≠ `v1.1.0` tag SHA; Issue with labels; rollback note in PR |
| impeccable | PR forward to latest `skill-v*` if behind |
| superpowers | skip if already at latest tag SHA |
| CPR re-run | Updates existing `chore/bump-*` PR; appends Issue comment; no duplicate PR |

Pass: all jobs green when up-to-date; failed job when Action/step errors; workflow red if any matrix job red.

## Files to create/modify

| File | Action |
|------|--------|
| `.github/workflows/submodule-sync.yml` | Rewrite — matrix caller only |
| `.github/workflows/bump-submodule-reusable.yml` | Create |
| `.github/workflows/release.yml` | Replace tag-if-missing step with Action |
| `scripts/submodule-sync-publish.sh` | Delete |
| `scripts/tag-if-missing.mjs` | Delete |
| `scripts/sync-overrides-versions.mjs` | Create (merge) |
| `scripts/sync-manifest-versions.mjs` | Delete |
| `scripts/sync-dogfood-self-check.mjs` | Delete |
| `scripts/validate-marketplace.mjs` | Create (merge) |
| `scripts/validate-version-sync.mjs` | Create (extract) |
| `scripts/validate-source.mjs` | Delete |
| `scripts/validate-wrapper-paths.mjs` | Delete |
| `scripts/validate-marketplace-sources.mjs` | Delete |
| `scripts/bump-submodule.mjs` | Update import path for sync script |
| `scripts/version-packages.mjs` | Update import path |
| `scripts/ci-validate.sh` | Point to new validate scripts |
| `CLAUDE.md` | Update submodule sync + scripts docs |
| `.changeset/README.md` | Remove `tag-if-missing.mjs` references; document release.yml Actions |

## Acceptance criteria

1. No `gh` CLI invocations in submodule sync or release tag paths.
2. `submodule-sync-publish.sh` deleted; workflow uses reusable + matrix only.
3. Matrix `fail-fast: false`; any failed submodule job fails the workflow run.
4. Tracking Issue via labels; PR body links Issue; comment on each bump.
5. Scripts count reduced per layout above; `pnpm run validate` passes.
6. superpowers semver bump still sets `{semver}-overrides.0`; merge still creates tag + Release.
7. v1 bump detection semantics unchanged (tag SHA vs pin SHA).
8. Existing v1 tracking Issues migrated manually with labels (documented); no duplicate PR on CPR re-run.

## Implementation prerequisite

Read v1 spec [§2 bump-submodule](./2026-08-01-submodule-sync-workflow-design.md) for full JSON output and per-submodule apply tables when implementing workflow YAML.

## Relationship to v1

| v1 component | v2 disposition |
|--------------|----------------|
| `bump-submodule.mjs` | Keep |
| `submodule-tags.mjs` | Keep |
| `version-utils.mjs` | Keep |
| `submodule-sync-publish.sh` | Delete |
| Serial steps + continue-on-error | Matrix + reusable |
| `gh issue/pr` | Action chain + CPR |
| `tag-if-missing.mjs` | release.yml Action |
