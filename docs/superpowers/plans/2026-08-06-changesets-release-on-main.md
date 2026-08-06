# Changesets Release on Main — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix incorrect develop-side changesets release (#59) — accumulate changesets on `develop`, consume and release only on `main`, then auto-open `main → develop` sync PR when `main` is ahead after publish.

**Architecture:** Delete the develop-only Version PR workflow; point changesets `baseBranch` at `main`; extend existing `release.yml` with `needs-sync` check and `peter-evans/create-pull-request` back-merge. Docs updated to match; branch-rules spec gets a Deviation note.

**Tech Stack:** GitHub Actions, changesets/action, peter-evans/create-pull-request@v8, Markdown docs

**Spec:** [2026-08-06-changesets-release-on-main-design.md](../specs/2026-08-06-changesets-release-on-main-design.md)

## Global Constraints

- **develop** accumulates `.changeset/*.md` only — no release/version workflow on push to `develop`
- **main** is the sole changesets consumer (Version PR + publish + tag + GitHub Release)
- `baseBranch` in `.changeset/config.json` must be **`main`**
- Sync PR opens only when: (a) this run published or created a new GitHub Release, AND (b) `main` is strictly ahead of `develop`
- Submodule-only `develop → main` fast-forward (branches equal) must **not** open sync PR
- Do not re-open #59; do not auto-merge sync PR
- Version PR title unchanged: `chore: release superpowers-overrides`
- `changesets/action` step id **`changesets`**; GitHub Release step id **`gh-release`**

---

## File structure (locked)

| File | Action | Responsibility |
|------|--------|----------------|
| `.github/workflows/changesets-version.yml` | Delete | Incorrect develop-side Version PR workflow |
| `.changeset/config.json` | Modify | `baseBranch: "main"` |
| `.github/workflows/release.yml` | Modify | Add `id`s, needs-sync check, back-merge + sync PR steps |
| `.changeset/README.md` | Modify | Main-only release flow + sync PR |
| `README.md` | Modify | Branch-flow paragraph |
| `CLAUDE.md` | Modify | Releasing section |
| `docs/superpowers/specs/2026-08-06-branch-rules-version-scheme-design.md` | Modify | Deviation note → this spec |

---

### Task 1: Remove develop-side release workflow

**Files:**
- Delete: `.github/workflows/changesets-version.yml`
- Modify: `.changeset/config.json`

**Interfaces:**
- Consumes: spec § Delete + Modify config
- Produces: no workflow on `push → develop`; changesets `baseBranch: "main"`

- [ ] **Step 1: Delete develop workflow**

Remove `.github/workflows/changesets-version.yml` entirely.

- [ ] **Step 2: Point baseBranch at main**

In `.changeset/config.json`, change:

```json
"baseBranch": "main"
```

- [ ] **Step 3: Verify no stale references**

Run:

```bash
rg 'changesets-version' --glob '!docs/superpowers/**'
```

Expected: only hits in docs/plan artifacts or branch-rules plan (Task 3 will clean docs); no workflow references remain.

- [ ] **Step 4: Commit**

```bash
git add -A .github/workflows/changesets-version.yml .changeset/config.json
git commit -m "fix: release changesets only on main, not develop"
```

---

### Task 2: Extend release.yml with sync PR

**Files:**
- Modify: `.github/workflows/release.yml`

**Interfaces:**
- Consumes: Task 1 (`baseBranch: main`); spec sync PR YAML
- Produces: `steps.changesets.outputs.published`, `steps.gh-release.outcome`, `steps.needs-sync.outputs.needs_sync`

- [ ] **Step 1: Update top comment**

Replace lines 1–2 with a comment describing the full flow (develop accumulates → develop→main → Version PR on main → publish → sync PR). Remove reference to deleted `changesets-version.yml`.

- [ ] **Step 2: Add step ids**

On `changesets/action@v1` step, add `id: changesets`.

On `Create GitHub Release if missing` step, add `id: gh-release`.

- [ ] **Step 3: Add sync PR steps after gh-release**

Append these steps (from spec):

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
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
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

Note: `checkout@v7` must use sufficient fetch depth for branch comparison — add `fetch-depth: 0` to the checkout step if not already present.

- [ ] **Step 4: Validate YAML locally**

Run:

```bash
pnpm run validate
```

Expected: PASS (no structural breakage).

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "feat: auto-open main to develop sync PR after release"
```

---

### Task 3: Documentation + spec deviation note

**Files:**
- Modify: `.changeset/README.md`
- Modify: `README.md` (~line 61 branch-flow paragraph)
- Modify: `CLAUDE.md` (Releasing section, ~lines 203–213)
- Modify: `docs/superpowers/specs/2026-08-06-branch-rules-version-scheme-design.md`

**Interfaces:**
- Consumes: corrected flow from spec
- Produces: maintainer docs matching implementation

- [ ] **Step 1: Rewrite `.changeset/README.md` release flow**

Replace develop-side Version PR steps with:

1. Add changeset in feature PR → merge to **`develop`**
2. Open PR **`develop → main`**
3. Push to **`main`** → `release.yml` opens Version PR targeting **`main`**
4. Merge Version PR on **`main`** → tag + GitHub Release
5. When `main` is ahead of `develop`, automated **`main → develop`** sync PR opens (manual merge)

Remove `baseBranch: develop` language; point to `main`.

- [ ] **Step 2: Fix `README.md` branch-flow line**

Change from "Changeset Version PRs target `develop`" to: develop accumulates changesets; Version PR + tag + Release on `main`; sync PR back to `develop`.

- [ ] **Step 3: Rewrite `CLAUDE.md` Releasing section**

Replace incorrect bullets about `changesets-version.yml` on develop with the corrected flow from spec. Keep submodule bump and branch protection paragraphs; update release path only.

- [ ] **Step 4: Add Deviation note to branch-rules spec**

At top of `docs/superpowers/specs/2026-08-06-branch-rules-version-scheme-design.md` (after title/metadata), add:

> **Deviation (2026-08-06):** Changesets release flow superseded by [2026-08-06-changesets-release-on-main-design.md](./2026-08-06-changesets-release-on-main-design.md). Version PRs now target `main`; sync PR is `main → develop` after release.

- [ ] **Step 5: Verify no stale develop-release references**

Run:

```bash
rg 'changesets-version|Version PR.*develop|baseBranch.*develop' README.md CLAUDE.md .changeset/
```

Expected: no matches (except historical context in deviation note if quoted).

- [ ] **Step 6: Commit**

```bash
git add .changeset/README.md README.md CLAUDE.md docs/superpowers/specs/2026-08-06-branch-rules-version-scheme-design.md
git commit -m "docs: changesets release on main with develop sync PR"
```

---

## Manual verification (post-merge to develop/main)

These cannot be fully tested locally; run after merging to `develop` then `main`:

1. Push/merge to **`develop`** with a pending changeset → confirm **no** Version PR workflow runs
2. Merge **`develop → main`** → confirm `release.yml` opens Version PR targeting **`main`**
3. Merge Version PR → confirm tag + GitHub Release created
4. Confirm sync PR **`main → develop`** opened when `main` is ahead
5. Submodule-only path: fast-forward `develop → main` → confirm **no** sync PR when branches equal

---

## Spec acceptance mapping

| Acceptance criterion | Task |
|---------------------|------|
| No release workflow on develop push | Task 1 |
| Version PR targets main | Task 1 + Task 2 |
| Tag + Release after Version PR merge | Task 2 (existing steps) |
| Sync PR when main ahead | Task 2 |
| No sync PR on submodule fast-forward | Task 2 (`needs-sync`) |
| `baseBranch: main` | Task 1 |
| `changesets-version.yml` deleted | Task 1 |
| Docs match | Task 3 |



