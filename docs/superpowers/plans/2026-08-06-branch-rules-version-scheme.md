# Branch Rules + Version Scheme — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce `develop`-first GitFlow with GitHub Rulesets + CI gates, retarget automation to `develop`, and migrate superpowers-overrides to three-segment version `{base}-overrides.{major}.{minor}.{patch}`.

**Architecture:** Land CI/workflows + version migration in one PR to `develop` first (before rulesets). Rulesets applied manually via idempotent `gh` script after required checks exist. Release remains `develop → main`; legacy tags cleaned post-first new-format release.

**Tech Stack:** GitHub Rulesets REST API (`gh api`), GitHub Actions, Node ESM (`version-utils.mjs`), changesets, shell scripts

**Spec:** [2026-08-06-branch-rules-version-scheme-design.md](../specs/2026-08-06-branch-rules-version-scheme-design.md)

## Global Constraints

- Integration branch: **`develop`** (already renamed from `v0` — do not rename again)
- `main` accepts PRs **only from `develop`** (enforced by CI gate + ruleset)
- Both `develop` and `main`: no direct push, require PR, require CI, **`bypass_actors: []`**
- Overrides version: `{superpowers-semver}-overrides.{major}.{minor}.{patch}`; reset to `0.0.0` on any superpowers semver segment change (including patch)
- Migration mapping: old `{base}-overrides.{N}` → `{base}-overrides.0.{N}.0`; current → `6.2.0-overrides.0.15.0`
- Changeset patch release: increment overrides **`patch`** only
- Required CI check job names must match ruleset contexts exactly: `validate`, `Main PRs must come from develop`
- Rulesets **not** applied until CI jobs exist on repo (rollout Step 1 before Step 3)
- Do not commit legacy tag deletion in code PR — maintainer runs cleanup script manually after first new-format release

---

## File structure (locked)

| File | Responsibility |
|------|----------------|
| `scripts/lib/version-utils.mjs` | Parse/compute three-segment overrides versions |
| `scripts/lib/version-utils.test.mjs` | Unit tests for version utils |
| `scripts/version-packages.mjs` | changesets bump; init `0.0.0`; baseReset detection |
| `scripts/validate-version-sync.mjs` | Strict three-segment regex validation |
| `.github/workflows/main-source-gate.yml` | Block non-`develop` PRs to `main` |
| `.github/workflows/ci.yml` | Run `validate` on PRs to `develop` and `main` |
| `.changeset/config.json` | `baseBranch: develop` |
| `.github/dependabot.yml` | `target-branch: develop` |
| `.github/workflows/bump-submodule-reusable.yml` | PR base `develop` |
| `.github/workflows/changesets-version.yml` | Open Version PR on push to `develop` |
| `scripts/gh-branch-rulesets.sh` | Idempotent ruleset create/update |
| `scripts/gh-branch-rulesets/develop.json` | Ruleset payload `protect-develop` |
| `scripts/gh-branch-rulesets/main.json` | Ruleset payload `protect-main` |
| `scripts/cleanup-legacy-release-tags.sh` | Delete old single-counter release tags |
| `CLAUDE.md`, `.changeset/README.md`, `README.md` | Maintainer docs |

---

### Task 1: Three-segment version utils (TDD)

**Files:**
- Modify: `scripts/lib/version-utils.mjs`
- Modify: `scripts/lib/version-utils.test.mjs`

**Interfaces:**
- Consumes: spec increment semantics
- Produces:
  - `parseOverridesVersion(version)` → `{ base, major, minor, patch } | null`
  - `computeNextVersion(current, superpowersVersion)` → version string

- [ ] **Step 1: Replace tests with new format (RED)**

Replace `scripts/lib/version-utils.test.mjs` contents:

```js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseOverridesVersion,
  computeNextVersion,
} from "./version-utils.mjs";

describe("parseOverridesVersion", () => {
  it("parses three-segment suffix", () => {
    assert.deepEqual(parseOverridesVersion("6.2.0-overrides.0.15.0"), {
      base: "6.2.0",
      major: 0,
      minor: 15,
      patch: 0,
    });
  });

  it("rejects legacy single-counter format", () => {
    assert.equal(parseOverridesVersion("6.2.0-overrides.15"), null);
  });
});

describe("computeNextVersion", () => {
  it("increments patch on same base", () => {
    assert.equal(
      computeNextVersion("6.2.0-overrides.0.15.0", "6.2.0"),
      "6.2.0-overrides.0.15.1",
    );
  });

  it("resets on superpowers minor bump", () => {
    assert.equal(
      computeNextVersion("6.2.0-overrides.0.15.3", "6.3.0"),
      "6.3.0-overrides.0.0.0",
    );
  });

  it("resets on superpowers patch bump", () => {
    assert.equal(
      computeNextVersion("6.2.0-overrides.0.15.0", "6.2.1"),
      "6.2.1-overrides.0.0.0",
    );
  });

  it("returns 0.0.0 for unknown current on new base", () => {
    assert.equal(
      computeNextVersion("not-a-version", "6.2.0"),
      "6.2.0-overrides.0.0.0",
    );
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `node --test scripts/lib/version-utils.test.mjs`  
Expected: FAIL (legacy parser / wrong increment)

- [ ] **Step 3: Implement `version-utils.mjs` (GREEN)**

```js
/** @param {string} version e.g. "6.2.0-overrides.0.15.0" */
export function parseOverridesVersion(version) {
  const m = /^(\d+\.\d+\.\d+)-overrides\.(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!m) return null;
  return {
    base: m[1],
    major: Number(m[2]),
    minor: Number(m[3]),
    patch: Number(m[4]),
  };
}

/** @param {string} current @param {string} superpowersVersion */
export function computeNextVersion(current, superpowersVersion) {
  const parsed = parseOverridesVersion(current);
  if (!parsed || parsed.base !== superpowersVersion) {
    return `${superpowersVersion}-overrides.0.0.0`;
  }
  return `${parsed.base}-overrides.${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
}
```

- [ ] **Step 5: Add tests to CI**

In `scripts/ci-validate.sh`, before `echo "== 8–10. version sync =="`, insert:

```bash
echo "== 7b. version-utils tests =="
node --test scripts/lib/version-utils.test.mjs
```

Renumber subsequent echo labels if desired (optional).

- [ ] **Step 6: Run tests — expect PASS**

Run: `node --test scripts/lib/version-utils.test.mjs`  
Expected: all tests PASS

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/version-utils.mjs scripts/lib/version-utils.test.mjs scripts/ci-validate.sh
git commit -m "feat: three-segment overrides version utils"
```

---

### Task 2: Wire version utils + migrate to `6.2.0-overrides.0.15.0`

**Files:**
- Modify: `scripts/version-packages.mjs`
- Modify: `scripts/validate-version-sync.mjs`
- Modify: `plugins/superpowers-overrides/package.json`
- Modify: `plugins/superpowers-overrides/CHANGELOG.md`
- Modify: `marketplace/source.json` (via sync script)
- Modify: emitted manifests, `CLAUDE.md`, `.cursor/rules/superpowers-overrides.mdc`, `build/generated/*` (via sync script)

**Interfaces:**
- Consumes: Task 1 `parseOverridesVersion`, `computeNextVersion`
- Produces: repo-wide version `6.2.0-overrides.0.15.0` after `sync-overrides-versions.mjs`

- [ ] **Step 1: Update `version-packages.mjs`**

Change init version:

```js
? `${superpowersVersion}-overrides.0.0.0`
```

Change `baseReset` detection:

```js
const baseReset =
  parsed !== null &&
  parsed.base !== superpowersVersion &&
  nextVersion.endsWith("-overrides.0.0.0");
```

- [ ] **Step 2: Add strict regex to `validate-version-sync.mjs`**

After existing version equality check, add:

```js
const THREE_SEG = /^\d+\.\d+\.\d+-overrides\.\d+\.\d+\.\d+$/;
if (!THREE_SEG.test(p.version)) {
  throw new Error(`Invalid overrides version format: ${p.version}`);
}
```

- [ ] **Step 3: Bump version + CHANGELOG entry**

Set `plugins/superpowers-overrides/package.json` `"version"` to `6.2.0-overrides.0.15.0`.

Prepend to `plugins/superpowers-overrides/CHANGELOG.md`:

```markdown
## 6.2.0-overrides.0.15.0

### Patch Changes

- Version scheme: adopt three-segment overrides semver `{base}-overrides.{major}.{minor}.{patch}` (migrated from `6.2.0-overrides.15`).

```

- [ ] **Step 4: Sync emitted manifests**

Run: `node scripts/sync-overrides-versions.mjs`  
Expected: `OK — synced 6.2.0-overrides.0.15.0`

- [ ] **Step 5: Validate**

Run: `pnpm run validate`  
Expected: all steps PASS (including version sync + three-segment regex)

- [ ] **Step 5: Smoke-test submodule bump utils (no file changes)**

If superpowers has a newer tag available, run dry-run and verify reset semantics via Node:

```bash
node -e "
import { computeNextVersion } from './scripts/lib/version-utils.mjs';
console.log(computeNextVersion('6.2.0-overrides.0.15.0', '6.2.1'));
"
```

Expected output: `6.2.1-overrides.0.0.0`

- [ ] **Step 6: Commit**

```bash
git add scripts/version-packages.mjs scripts/validate-version-sync.mjs \
  plugins/superpowers-overrides/package.json \
  plugins/superpowers-overrides/CHANGELOG.md \
  marketplace/source.json .claude-plugin/marketplace.json \
  plugins/superpowers-overrides/.claude-plugin/plugin.json \
  plugins/superpowers-overrides/.cursor-plugin/plugin.json \
  plugins/superpowers-overrides/.codex-plugin/plugin.json \
  CLAUDE.md .cursor/rules/superpowers-overrides.mdc \
  plugins/superpowers-overrides/build/generated/
git commit -m "feat: migrate overrides version to 6.2.0-overrides.0.15.0"
```

---

### Task 3: CI gates + automation target `develop`

**Files:**
- Create: `.github/workflows/main-source-gate.yml`
- Modify: `.github/workflows/ci.yml`
- Modify: `.changeset/config.json`
- Modify: `.github/dependabot.yml`
- Create: `.github/workflows/changesets-version.yml`
- Modify: `.github/workflows/release.yml` (comment only — confirm publish-on-main unchanged)

**Interfaces:**
- Consumes: spec CI section
- Produces: `validate` job on PRs to `develop`/`main`; gate job named exactly `Main PRs must come from develop`

- [ ] **Step 1: Create `.github/workflows/main-source-gate.yml`**

```yaml
name: Main Source Gate

on:
  pull_request:
    branches: [main]
    types: [opened, reopened, synchronize, edited]

jobs:
  enforce:
    name: Main PRs must come from develop
    runs-on: ubuntu-latest
    steps:
      - name: Check source branch
        env:
          HEAD_REF: ${{ github.head_ref }}
        run: |
          if [ "$HEAD_REF" != "develop" ]; then
            echo "::error::PRs to main must come from 'develop' (got '$HEAD_REF'). Merge into develop first."
            exit 1
          fi
          echo "OK: PR comes from develop."
```

- [ ] **Step 2: Extend `ci.yml` PR triggers**

```yaml
on:
  pull_request:
    branches: [develop, main]
```

- [ ] **Step 3: Retarget changesets**

In `.changeset/config.json`:

```json
"baseBranch": "develop"
```

- [ ] **Step 4: Retarget dependabot**

Add to **both** update blocks in `.github/dependabot.yml`:

```yaml
    target-branch: develop
```

- [ ] **Step 5: Retarget submodule-sync PR**

In `.github/workflows/bump-submodule-reusable.yml`, change `peter-evans/create-pull-request` input:

```yaml
          base: develop
```

- [ ] **Step 6: Create `.github/workflows/changesets-version.yml`**

Opens/consumes Version PRs on **`develop`** (spec: changesets Version PR targets develop):

```yaml
name: Changesets Version

on:
  push:
    branches: [develop]

concurrency: changesets-version-${{ github.ref }}

permissions:
  contents: write
  pull-requests: write

jobs:
  version:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          submodules: recursive
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm run emit
      - uses: changesets/action@v1
        with:
          version: node scripts/version-packages.mjs
          publish: echo "Version PR only — publish happens on main"
          commit: "chore: release superpowers-overrides"
          title: "chore: release superpowers-overrides"
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Note:** `release.yml` stays on `push → main` for git tag + GitHub Release. Flow: changesets on `develop` → Version PR merges to `develop` → release PR `develop → main` → `release.yml` tags.

- [ ] **Step 7: Document split in `release.yml`**

Add top-of-file comment block:

```yaml
# Version PRs: .github/workflows/changesets-version.yml (push → develop)
# Tag + GitHub Release: this workflow (push → main only)
```

No logic changes to release.yml jobs.

- [ ] **Step 8: Commit**

```bash
git add .github/workflows/main-source-gate.yml .github/workflows/ci.yml \
  .github/workflows/changesets-version.yml .github/workflows/release.yml \
  .changeset/config.json .github/dependabot.yml \
  .github/workflows/bump-submodule-reusable.yml
git commit -m "feat: target develop for CI and automation PRs"
```

---

### Task 4: GitHub ruleset + legacy cleanup scripts

**Files:**
- Create: `scripts/gh-branch-rulesets.sh`
- Create: `scripts/gh-branch-rulesets/develop.json`
- Create: `scripts/gh-branch-rulesets/main.json`
- Create: `scripts/cleanup-legacy-release-tags.sh`

**Interfaces:**
- Consumes: spec GitHub Rulesets section; CI job names from Task 3
- Produces: idempotent ruleset apply; one-time legacy tag cleanup

- [ ] **Step 1: Create `scripts/gh-branch-rulesets/develop.json`**

```json
{
  "name": "protect-develop",
  "target": "branch",
  "enforcement": "active",
  "bypass_actors": [],
  "conditions": {
    "ref_name": { "include": ["refs/heads/develop"] }
  },
  "rules": [
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false
      }
    },
    { "type": "non_fast_forward" },
    { "type": "deletion" },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [{ "context": "validate" }]
      }
    }
  ]
}
```

- [ ] **Step 2: Create `scripts/gh-branch-rulesets/main.json`**

Same as develop, but:

- `"name": "protect-main"`
- `"include": ["refs/heads/main"]`
- `required_status_checks` adds `{ "context": "Main PRs must come from develop" }`

- [ ] **Step 3: Create `scripts/gh-branch-rulesets.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail
REPO="${GITHUB_REPOSITORY:-Oscaner/skills}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

apply_ruleset() {
  local name="$1" file="$2"
  local id
  id="$(gh api "repos/${REPO}/rulesets" --jq ".[] | select(.name==\"${name}\") | .id" | head -1)"
  if [ -n "$id" ]; then
    echo "Ruleset ${name} already exists (${id}) — delete and recreate, or PATCH manually"
    echo "  gh api repos/${REPO}/rulesets/${id} -X DELETE"
    echo "  gh api repos/${REPO}/rulesets -X POST --input ${file}"
    exit 1
  else
    gh api "repos/${REPO}/rulesets" -X POST --input "$file"
    echo "Created ruleset ${name}"
  fi
}

apply_ruleset protect-develop "${SCRIPT_DIR}/gh-branch-rulesets/develop.json"
apply_ruleset protect-main "${SCRIPT_DIR}/gh-branch-rulesets/main.json"
```

Run: `chmod +x scripts/gh-branch-rulesets.sh`

- [ ] **Step 4: Create `scripts/cleanup-legacy-release-tags.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail
REPO="${GITHUB_REPOSITORY:-Oscaner/skills}"

git fetch --tags origin
tags=()
while IFS= read -r t; do tags+=("$t"); done < <(
  git tag -l 'superpowers-overrides@*' | grep -Ee '-overrides\.[0-9]+$' || true
)

if [ ${#tags[@]} -eq 0 ]; then
  echo "No legacy single-counter tags found."
  exit 0
fi

for tag in "${tags[@]}"; do
  echo "Deleting ${tag}..."
  gh release delete "$tag" -y --repo "$REPO" 2>/dev/null || true
  gh api -X DELETE "repos/${REPO}/git/refs/tags/${tag}" || git push origin ":refs/tags/${tag}"
done

echo "Done. Removed ${#tags[@]} legacy tag(s)."
```

Run: `chmod +x scripts/cleanup-legacy-release-tags.sh`

- [ ] **Step 5: Commit**

```bash
git add scripts/gh-branch-rulesets.sh scripts/gh-branch-rulesets/ \
  scripts/cleanup-legacy-release-tags.sh
git commit -m "feat: add gh ruleset and legacy tag cleanup scripts"
```

**Note:** Do **not** run `gh-branch-rulesets.sh` until Task 3 is merged and CI jobs have run at least once on a PR.

---

### Task 5: Maintainer documentation

**Files:**
- Modify: `CLAUDE.md` (Releasing section)
- Modify: `.changeset/README.md`
- Modify: `README.md` (Maintainers section if branch flow mentioned)

**Interfaces:**
- Consumes: approved spec branch model + version scheme
- Produces: docs describing `develop` integration, `develop → main` release, three-segment version

- [ ] **Step 1: Update `CLAUDE.md` Releasing section**

Replace single-counter examples with three-segment format. Document:

- Daily PRs → `develop`
- Release: merge `develop → main` PR
- Version scheme `{base}-overrides.{major}.{minor}.{patch}`; superpowers any-segment bump → `0.0.0` (not `-overrides.0`)
- Tag examples: `superpowers-overrides@6.2.0-overrides.0.15.0`
- Rulesets applied via `scripts/gh-branch-rulesets.sh`

- [ ] **Step 2: Update `.changeset/README.md`**

- `baseBranch: develop`
- Version examples use three segments
- Release flow: changeset Version PR merges to `develop`; then separate `develop → main` PR triggers tag

- [ ] **Step 3: Update `README.md` Maintainers**

Add one paragraph on branch flow (`develop` default, release via `main`).

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md .changeset/README.md README.md
git commit -m "docs: document develop-first branch flow and version scheme"
```

---

### Task 6: Rollout verification (maintainer manual)

**Files:** none (manual steps)

**Interfaces:**
- Consumes: Tasks 1–5 merged to `develop`; spec Rollout order

- [ ] **Step 1: Open PR `feat/branch-rules` → `develop`**

Include Tasks 1–5 commits. Verify CI runs `validate` on the PR.

- [ ] **Step 2: Confirm default branch is `develop`**

Run: `gh api repos/Oscaner/skills --jq .default_branch`  
Expected: `develop` (if not, `gh api repos/Oscaner/skills -X PATCH -f default_branch=develop`)

- [ ] **Step 3: Verify gate job (required)**

Open throwaway PR `feat/test-gate → main`; confirm job **`Main PRs must come from develop`** fails. Close without merging.

- [ ] **Step 4: Merge PR to `develop`**

Confirm a subsequent PR to `develop` shows both `validate` (if applicable) and that changesets-version workflow registered.

- [ ] **Step 5: Verify automation targets (spec acceptance #4)**

| Source | Verify |
|--------|--------|
| dependabot | `.github/dependabot.yml` has `target-branch: develop` |
| submodule-sync | `bump-submodule-reusable.yml` has `base: develop` |
| changesets | `.changeset/config.json` `baseBranch: develop`; Version PRs opened against `develop` after push with pending changeset |

- [ ] **Step 6: Apply rulesets**

Run: `./scripts/gh-branch-rulesets.sh`  
Verify: `gh api repos/Oscaner/skills/rulesets --jq '.[].name'`

**Troubleshooting:** Bot-opened PRs may not trigger `ci.yml` until manually re-run (known `GITHUB_TOKEN` limitation). Re-run CI on submodule-sync PRs before merge.

- [ ] **Step 7: Release PR `develop → main`**

Open PR, confirm both required checks pass, merge. Verify tag `superpowers-overrides@6.2.0-overrides.0.15.0` created. Confirm **no** second Version PR opened on `main` (only tag + release from `release.yml`).

- [ ] **Step 8: Cleanup legacy tags (on `main`)**

```bash
git checkout main && git pull
./scripts/cleanup-legacy-release-tags.sh
```

Verify: `git tag -l 'superpowers-overrides@*' | grep -Ee '-overrides\.[0-9]+$'` returns empty

- [ ] **Step 9: Acceptance smoke**

| Check | Command / action | Expected |
|-------|------------------|----------|
| Version utils | `node -e "import('./scripts/lib/version-utils.mjs').then(m=>console.log(m.computeNextVersion('6.2.0-overrides.0.15.0','6.2.1')))"` | `6.2.1-overrides.0.0.0` |
| Validate | `pnpm run validate` | PASS |
| Direct push blocked | `git push origin develop:develop` (should fail after rulesets) | rejected |
