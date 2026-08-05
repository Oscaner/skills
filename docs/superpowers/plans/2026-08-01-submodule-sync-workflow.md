# Submodule Sync Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automate weekly submodule tag sync (three separate PRs + tracking Issues) and reset `superpowers-overrides` to `{semver}-overrides.0` on superpowers semver bumps, with tag/release on merge.

**Architecture:** Single cron workflow calls `bump-submodule.mjs` per submodule; tag detection lives in `submodule-tags.mjs` (SHA compare, not `--remote`). Version scheme moves to `.0` base reset; align changeset path is removed; `tag-if-missing.mjs` handles releases when version is already set in package.json.

**Tech Stack:** Node.js ESM scripts, GitHub Actions (`checkout@v7`, `pnpm`, `gh` CLI), git submodules, changesets (overrides-only releases only).

**Spec:** [`docs/superpowers/specs/2026-08-01-submodule-sync-workflow-design.md`](../specs/2026-08-01-submodule-sync-workflow-design.md)

## Global Constraints

- Submodule detection: latest **release tag** only (`v*` / `skill-v*`), compare **pinned SHA** vs **latest tag SHA**
- Cron: `0 1 * * 1` UTC (Mon 09:00 Asia/Shanghai) + `workflow_dispatch`
- No auto-merge; one PR per submodule; branch `chore/bump-<name>`; labels `submodule-bump`, `automated`
- Issue: create on first bump only; subsequent updates comment on same Issue (`Tracking Issue: #N` in PR body)
- Overrides version: `{superpowers-semver}-overrides.N`, **N starts at 0** on base reset; existing `6.2.0-overrides.11` unchanged
- Version-utils / version-packages `.0` migration **must ship with** bump-submodule superpowers semver path (same PR series)
- **Execution order:** Single integration branch/PR for Tasks 1–4 before merge to `main`; Task 5 blocked until Task 3 on `main`. Do not merge superpowers semver bump automation until Task 4 (tag-if-missing) is on `main`.
- **Task dependency graph:** Task 1 → Task 3 (semver `.0`); Task 2 → Task 3; Task 4 independent but must precede first semver bump merge; Task 5 → Tasks 2+3; Task 6 → all
- Delete `scripts/create-align-changeset.mjs`; remove from `release.yml`
- Final gate: `pnpm run validate` passes

---

## File Structure

| File | Responsibility |
|---|---|
| `scripts/lib/version-utils.mjs` | Parse/increment overrides versions (`.0` base reset) |
| `scripts/lib/version-utils.test.mjs` | Unit tests for version math |
| `scripts/lib/submodule-tags.mjs` | Fetch tags, semver-sort, `{ tag, sha }`, pinned SHA, `hasUpdate()` |
| `scripts/lib/submodule-tags.test.mjs` | Unit tests with mocked git or fixture tag lists |
| `scripts/bump-submodule.mjs` | CLI entry: dry-run JSON + apply bump per submodule |
| `scripts/tag-if-missing.mjs` | Tag + GitHub Release if `superpowers-overrides@{version}` missing |
| `.github/workflows/submodule-sync.yml` | Cron + gh PR/Issue orchestration |
| `.github/workflows/release.yml` | Remove align step; add `tag-if-missing.mjs` after changesets |
| `scripts/version-packages.mjs` | Align base-reset paths to `.0` |
| `.changeset/README.md`, `CLAUDE.md` | Document new version scheme + automated bump |

---

### Task 1: Version scheme `.0` migration

**Files:**
- Modify: `scripts/lib/version-utils.mjs`
- Modify: `scripts/version-packages.mjs`
- Create: `scripts/lib/version-utils.test.mjs`

**Interfaces:**
- Produces: `parseOverridesVersion(version) → { base, n } | null`
- Produces: `computeNextVersion(current, superpowersVersion) → string` — base mismatch returns `{superpowersVersion}-overrides.0`; same base increments `n`

- [ ] **Step 1: Write failing tests**

Create `scripts/lib/version-utils.test.mjs`:

```javascript
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseOverridesVersion,
  computeNextVersion,
} from "./version-utils.mjs";

describe("parseOverridesVersion", () => {
  it("parses .0", () => {
    assert.deepEqual(parseOverridesVersion("6.3.0-overrides.0"), {
      base: "6.3.0",
      n: 0,
    });
  });
});

describe("computeNextVersion", () => {
  it("base reset returns .0 not .1", () => {
    assert.equal(
      computeNextVersion("6.2.0-overrides.11", "6.3.0"),
      "6.3.0-overrides.0",
    );
  });
  it("increments on same base from .0", () => {
    assert.equal(
      computeNextVersion("6.3.0-overrides.0", "6.3.0"),
      "6.3.0-overrides.1",
    );
  });
  it("increments from .11", () => {
    assert.equal(
      computeNextVersion("6.2.0-overrides.11", "6.2.0"),
      "6.2.0-overrides.12",
    );
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `node --test scripts/lib/version-utils.test.mjs`  
Expected: FAIL — base reset still returns `.1`

- [ ] **Step 3: Update version-utils.mjs**

In `computeNextVersion`, change base-reset branch:

```javascript
if (!parsed || parsed.base !== superpowersVersion) {
  return `${superpowersVersion}-overrides.0`;
}
```

- [ ] **Step 4: Update version-packages.mjs**

Line 33: `` `${superpowersVersion}-overrides.0` ``  
Line 40: `nextVersion.endsWith("-overrides.0")`

- [ ] **Step 5: Run tests — expect PASS**

Run: `node --test scripts/lib/version-utils.test.mjs`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/version-utils.mjs scripts/lib/version-utils.test.mjs scripts/version-packages.mjs
---

### Task 2: `submodule-tags.mjs` library

**Files:**
- Create: `scripts/lib/submodule-tags.mjs`
- Create: `scripts/lib/submodule-tags.test.mjs`

**Interfaces:**
- Consumes: none
- Produces:
  - `TAG_PATTERNS` — map submodule name → RegExp
  - `SUBMODULE_PATHS` — map name → `plugins/<name>`
  - `parseSemverFromTag(tag, pattern) → string | null`
  - `sortTagsBySemver(tags, pattern) → string[]`
  - `fetchTags(submodulePath) → void` — runs `git fetch --tags origin`
  - `listMatchingTags(submodulePath, pattern) → string[]`
  - `resolveTagSha(submodulePath, tag) → string`
  - `pinnedSha(submodulePath) → string`
  - `nearestTag(submodulePath, pattern) → string | null`
  - `latestTag(submodulePath, pattern) → { tag, sha }`
  - `hasUpdate(submodulePath, pattern) → boolean`

- [ ] **Step 1: Write failing tests (pure functions only)**

Create `scripts/lib/submodule-tags.test.mjs`:

```javascript
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseSemverFromTag,
  sortTagsBySemver,
  TAG_PATTERNS,
} from "./submodule-tags.mjs";

describe("parseSemverFromTag", () => {
  it("parses superpowers v tag", () => {
    assert.equal(parseSemverFromTag("v6.2.0", TAG_PATTERNS.superpowers), "6.2.0");
  });
  it("parses impeccable skill-v tag", () => {
    assert.equal(
      parseSemverFromTag("skill-v4.0.4", TAG_PATTERNS.impeccable),
      "4.0.4",
    );
  });
});

describe("sortTagsBySemver", () => {
  it("orders semver highest last", () => {
    const sorted = sortTagsBySemver(
      ["v6.1.0", "v6.2.0", "v6.0.3"],
      TAG_PATTERNS.superpowers,
    );
    assert.equal(sorted.at(-1), "v6.2.0");
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `node --test scripts/lib/submodule-tags.test.mjs`  
Expected: FAIL — module not found

- [ ] **Step 3: Implement submodule-tags.mjs**

```javascript
import { execSync } from "node:child_process";

export const TAG_PATTERNS = {
  "mattpocock-skills": /^v(\d+\.\d+\.\d+)$/,
  superpowers: /^v(\d+\.\d+\.\d+)$/,
  impeccable: /^skill-v(\d+\.\d+\.\d+)$/,
};

export const SUBMODULE_PATHS = {
  "mattpocock-skills": "plugins/mattpocock-skills",
  superpowers: "plugins/superpowers",
  impeccable: "plugins/impeccable",
};

export function parseSemverFromTag(tag, pattern) {
  const m = pattern.exec(tag);
  return m ? m[1] : null;
}

export function sortTagsBySemver(tags, pattern) {
  return [...tags].sort((a, b) => {
    const pa = parseSemverFromTag(a, pattern)?.split(".").map(Number) ?? [];
    const pb = parseSemverFromTag(b, pattern)?.split(".").map(Number) ?? [];
    for (let i = 0; i < 3; i++) {
      if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
    }
    return 0;
  });
}

function git(submodulePath, args) {
  return execSync(`git -C ${submodulePath} ${args}`, { encoding: "utf8" }).trim();
}

export function fetchTags(submodulePath) {
  git(submodulePath, "fetch --tags origin");
}

export function listMatchingTags(submodulePath, pattern) {
  const raw = git(submodulePath, "tag -l");
  return raw.split("\n").filter((t) => t && pattern.test(t));
}

export function resolveTagSha(submodulePath, tag) {
  return git(submodulePath, `rev-parse ${tag}^{commit}`);
}

export function pinnedSha(submodulePath) {
  return git(submodulePath, "rev-parse HEAD");
}

export function nearestTag(submodulePath, pattern) {
  try {
    const tag = git(submodulePath, "describe --tags --abbrev=0");
    return pattern.test(tag) ? tag : null;
  } catch {
    return null;
  }
}

export function latestTag(submodulePath, pattern) {
  const tags = sortTagsBySemver(listMatchingTags(submodulePath, pattern), pattern);
  if (tags.length === 0) throw new Error(`No tags matching ${pattern} in ${submodulePath}`);
  const tag = tags.at(-1);
  return { tag, sha: resolveTagSha(submodulePath, tag) };
}

export function hasUpdate(submodulePath, pattern) {
  fetchTags(submodulePath);
  const latest = latestTag(submodulePath, pattern);
  return pinnedSha(submodulePath) !== latest.sha;
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `node --test scripts/lib/submodule-tags.test.mjs`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/submodule-tags.mjs scripts/lib/submodule-tags.test.mjs
---

### Task 3: `bump-submodule.mjs`

**Files:**
- Create: `scripts/bump-submodule.mjs`

**Interfaces:**
- Consumes: Task 2 exports; Task 1 `computeNextVersion` for overrides `.0` on semver bump
- Produces: CLI — exit 0 + JSON stdout on `--dry-run`; exit 0 silent when `updated: false`; mutates submodule + manifests when apply

- [ ] **Step 1: Scaffold CLI + dry-run path**

```javascript
#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { computeNextVersion } from "./lib/version-utils.mjs";
import {
  TAG_PATTERNS,
  SUBMODULE_PATHS,
  fetchTags,
  latestTag,
  pinnedSha,
  nearestTag,
  parseSemverFromTag,
} from "./lib/submodule-tags.mjs";

const VALID = new Set(Object.keys(SUBMODULE_PATHS));
const dryRun = process.argv.includes("--dry-run");
const name = process.argv.find((a) => VALID.has(a));
if (!name) {
  console.error("Usage: bump-submodule.mjs <mattpocock-skills|superpowers|impeccable> [--dry-run]");
  process.exit(1);
}

const root = process.cwd();
const submodulePath = SUBMODULE_PATHS[name];
const pattern = TAG_PATTERNS[name];

function readJson(p) {
  return JSON.parse(readFileSync(join(root, p), "utf8"));
}

function checkoutTag(tag) {
  execSync(`git -C ${submodulePath} checkout ${tag}`, { stdio: "inherit" });
}

function main() {
  const oldPinSha = pinnedSha(submodulePath).slice(0, 7);
  const oldTag = nearestTag(submodulePath, pattern);
  fetchTags(submodulePath);
  const { tag: newTag, sha: newSha } = latestTag(submodulePath, pattern);

  if (pinnedSha(submodulePath) === newSha) {
    if (dryRun) console.log(JSON.stringify({ updated: false, submodule: name }));
    return;
  }

  const result = {
    updated: true,
    submodule: name,
    oldPinSha,
    oldTag,
    newTag,
    semverChanged: false,
    files: [submodulePath],
  };

  if (name === "superpowers") {
    const source = readJson("marketplace/source.json");
    result.oldSuperpowersVer = source.plugins.find((p) => p.name === "superpowers").version;
    // dry-run semver: read plugin.json at tag without checkout
    const newVerAtTag = JSON.parse(
      execSync(`git -C ${submodulePath} show ${newTag}:.claude-plugin/plugin.json`, {
        encoding: "utf8",
      }),
    ).version;
    result.semverChanged = result.oldSuperpowersVer !== newVerAtTag;
  }

  if (dryRun) {
    console.log(JSON.stringify(result));
    return;
  }

  // apply path filled in Step 3
  applyBump(name, result, newTag);
  console.log(JSON.stringify(result));
}

main();
```

- [ ] **Step 2: Verify dry-run locally**

Run: `node scripts/bump-submodule.mjs impeccable --dry-run`  
Expected: JSON with `"updated": true` and `"newTag": "skill-v4.0.4"` (or current latest)

Run: `node scripts/bump-submodule.mjs superpowers --dry-run`  
Expected: `"updated": false` if already at `v6.2.0`

- [ ] **Step 3: Implement `applyBump` per submodule**

Add before `main()`:

```javascript
function prependChangelog(version, line) {
  const changelogPath = join(root, "plugins/superpowers-overrides/CHANGELOG.md");
  const header = "# superpowers-overrides\n\n";
  const entry = `## ${version}\n\n### Patch Changes\n\n- ${line}\n\n`;
  const existing = readFileSync(changelogPath, "utf8");
  writeFileSync(changelogPath, header + entry + existing.slice(header.length));
}

function applyBump(name, result, newTag) {
  if (name === "superpowers") {
    const sourcePath = "marketplace/source.json";
    const source = readJson(sourcePath);
    const oldVer = result.oldSuperpowersVer;
    checkoutTag(newTag);
    const newVer = readJson("plugins/superpowers/.claude-plugin/plugin.json").version;
    result.semverChanged = oldVer !== newVer;
    if (result.semverChanged) {
      const overridesVer = computeNextVersion(oldVer, newVer); // → {newVer}-overrides.0
      source.plugins.find((p) => p.name === "superpowers").version = newVer;
      writeFileSync(join(root, sourcePath), JSON.stringify(source, null, 2) + "\n");
      result.files.push(sourcePath);
      const pkgPath = "plugins/superpowers-overrides/package.json";
      const pkg = readJson(pkgPath);
      pkg.version = overridesVer;
      writeFileSync(join(root, pkgPath), JSON.stringify(pkg, null, 2) + "\n");
      result.files.push(pkgPath);
      prependChangelog(overridesVer, `Align with superpowers ${newVer}`);
      result.files.push("plugins/superpowers-overrides/CHANGELOG.md");
      execSync("node scripts/sync-manifest-versions.mjs", { stdio: "inherit", cwd: root });
    } else {
      execSync("pnpm run emit", { stdio: "inherit", cwd: root });
    }
    return;
  }

  checkoutTag(newTag);

  if (name === "impeccable") {
    const sourcePath = "marketplace/source.json";
    const source = readJson(sourcePath);
    const ver = readJson("plugins/impeccable/plugin/.claude-plugin/plugin.json").version;
    source.plugins.find((p) => p.name === "impeccable").version = ver;
    writeFileSync(join(root, sourcePath), JSON.stringify(source, null, 2) + "\n");
    result.files.push(sourcePath);
    execSync("pnpm run emit", { stdio: "inherit", cwd: root });
  }
  // mattpocock-skills: gitlink only
}
```

Wire `applyBump(name, result, newTag)` in `main()` where comment says.

- [ ] **Step 4: Run validate after manual apply (do NOT commit dirty tree)**

Run on a throwaway branch if testing apply:
```bash
node scripts/bump-submodule.mjs impeccable --dry-run
pnpm run validate
```
Expected: validate still passes on current tree (dry-run doesn't mutate)

- [ ] **Step 5: Commit**

```bash
git add scripts/bump-submodule.mjs
---

### Task 4: `tag-if-missing.mjs` + release cleanup

**Files:**
- Create: `scripts/tag-if-missing.mjs`
- Modify: `.github/workflows/release.yml`
- Delete: `scripts/create-align-changeset.mjs`

**Interfaces:**
- Consumes: `plugins/superpowers-overrides/package.json` version field
- Produces: git tag `superpowers-overrides@{version}` + GitHub Release when missing; `--dry-run` logs intent only

- [ ] **Step 1: Implement tag-if-missing.mjs**

```javascript
#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const dryRun = process.argv.includes("--dry-run");
const root = process.cwd();
const version = JSON.parse(
  readFileSync(join(root, "plugins/superpowers-overrides/package.json"), "utf8"),
).version;
const tag = `superpowers-overrides@${version}`;

function tagExists() {
  try {
    execSync(`git rev-parse ${tag}`, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

if (tagExists()) {
  console.log(`OK — ${tag} already exists`);
  process.exit(0);
}

if (dryRun) {
  console.log(`DRY-RUN — would create ${tag} and GitHub Release`);
  process.exit(0);
}

execSync(`git tag ${tag}`, { stdio: "inherit" });
execSync(`git push origin ${tag}`, { stdio: "inherit" });
execSync(`gh release create ${tag} --generate-notes`, { stdio: "inherit" });
console.log(`OK — released ${tag}`);
```

- [ ] **Step 2: Update release.yml**

Remove:
```yaml
      - name: Prepare align changeset if superpowers bumped
        run: node scripts/create-align-changeset.mjs
```

Add after changesets action:
```yaml
      - name: Fetch tags for tag-if-missing
        run: git fetch --tags origin
      - name: Tag and release untagged overrides version
        run: node scripts/tag-if-missing.mjs
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Add `contents: write` is already present.

- [ ] **Step 3: Delete create-align-changeset.mjs**

```bash
git rm scripts/create-align-changeset.mjs
```

- [ ] **Step 4: Dry-run locally**

Run: `node scripts/tag-if-missing.mjs --dry-run`  
Expected: `DRY-RUN` or `OK — already exists` for current version

- [ ] **Step 5: Commit**

```bash
git add scripts/tag-if-missing.mjs .github/workflows/release.yml
---

### Task 5: `submodule-sync.yml` workflow

**Files:**
- Create: `.github/workflows/submodule-sync.yml`
- Create: `scripts/submodule-sync-publish.sh` (gh PR/Issue orchestration for one submodule — keeps YAML readable)

**Interfaces:**
- Consumes: `bump-submodule.mjs` JSON dry-run output
- Produces: open/updated PR on `chore/bump-<name>`; Issue create or comment

- [ ] **Step 1: Create submodule-sync-publish.sh**

```bash
#!/usr/bin/env bash
set -euo pipefail
NAME="$1"
BRANCH="chore/bump-${NAME}"

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

DRY=$(node scripts/bump-submodule.mjs "$NAME" --dry-run)
JSON=$(echo "$DRY" | node -pe "JSON.stringify(JSON.parse(require('fs').readFileSync(0,'utf8')))")
UPDATED=$(echo "$JSON" | node -pe "JSON.parse(process.argv[1]).updated" "$JSON")
[[ "$UPDATED" == "true" ]] || { echo "skip $NAME"; exit 0; }

NEW_TAG=$(echo "$JSON" | node -pe "JSON.parse(process.argv[1]).newTag" "$JSON")
OLD_LABEL=$(echo "$JSON" | node -pe "const j=JSON.parse(process.argv[1]);j.oldTag||j.oldPinSha" "$JSON")

git fetch origin main
git fetch origin "$BRANCH" || true
OPEN_PR=$(gh pr list --search "head:${BRANCH} is:open" --json number,body --jq '.[0] // empty')

if [[ -n "$OPEN_PR" ]] && git show-ref --verify --quiet "refs/remotes/origin/${BRANCH}"; then
  git checkout -B "$BRANCH" "origin/${BRANCH}"
  git merge origin/main --no-edit
else
  git checkout -B "$BRANCH" origin/main
fi

node scripts/bump-submodule.mjs "$NAME"
git add -A
git commit -m "chore: bump ${NAME} submodule"
git push -u origin "$BRANCH"

ISSUE_NUM=""
if [[ -n "$OPEN_PR" ]]; then
  ISSUE_NUM=$(echo "$OPEN_PR" | jq -r '.body' | sed -n 's/.*Tracking Issue: #\([0-9]*\).*/\1/p')
fi
if [[ -z "$ISSUE_NUM" ]]; then
  ISSUES=$(gh issue list --search "Submodule bump: ${NAME} in:title" --state open --json number)
  COUNT=$(echo "$ISSUES" | jq 'length')
  if [[ "$COUNT" -gt 1 ]]; then
    echo "ERROR: ambiguous Issue search for ${NAME}" >&2
    exit 1
  fi
  ISSUE_NUM=$(echo "$ISSUES" | jq -r '.[0].number // empty')
fi
if [[ -z "$ISSUE_NUM" ]]; then
  ISSUE_NUM=$(gh issue create --title "Submodule bump: ${NAME}" --body "Automated submodule sync tracking." --json number --jq '.number')
fi
gh issue comment "$ISSUE_NUM" --body "Updated: ${OLD_LABEL} → ${NEW_TAG}"

ROLLBACK_NOTE=""
if [[ "$NAME" == "mattpocock-skills" && "$OLD_LABEL" != "$NEW_TAG" ]]; then
  ROLLBACK_NOTE=$'\n\n> **Note:** Pin was ahead of latest release tag; this PR rolls back to tag-based tracking (`'"${NEW_TAG}"''`).'
fi

if [[ -z "$OPEN_PR" ]]; then
  gh pr create --head "$BRANCH" --base main \
    --title "chore: bump ${NAME} submodule" \
    --body "Tracking Issue: #${ISSUE_NUM}

Automated tag sync.${ROLLBACK_NOTE}" \
    --label submodule-bump --label automated
else
  gh pr comment "$(echo "$OPEN_PR" | jq -r '.number')" --body "Updated pointer: ${OLD_LABEL} → ${NEW_TAG}"
fi
```

- [ ] **Step 2: Create submodule-sync.yml**

```yaml
name: Submodule Sync

on:
  schedule:
    - cron: "0 1 * * 1"
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
          fetch-depth: 0
          token: ${{ secrets.GITHUB_TOKEN }}
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - name: Sync mattpocock-skills
        continue-on-error: true
        run: bash scripts/submodule-sync-publish.sh mattpocock-skills
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - name: Sync superpowers
        continue-on-error: true
        run: bash scripts/submodule-sync-publish.sh superpowers
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - name: Sync impeccable
        continue-on-error: true
        run: bash scripts/submodule-sync-publish.sh impeccable
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

- [ ] **Step 3: chmod + validate YAML**

```bash
chmod +x scripts/submodule-sync-publish.sh
pnpm run validate
```

Expected: ALL PASS (workflow file doesn't affect validate unless referenced in ci)

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/submodule-sync.yml scripts/submodule-sync-publish.sh
git commit -m "feat: add weekly submodule sync workflow"
```

---

### Task 6: Documentation + final validation

**Files:**
- Modify: `.changeset/README.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update .changeset/README.md version scheme**

Replace `.1` first-release examples with `.0`:

```markdown
- `6.2.0-overrides.0` — aligned with superpowers 6.2.0, no overrides changes yet
- `6.2.0-overrides.1` — first overrides-only release on superpowers 6.2.0 base
- `6.3.0-overrides.0` — resets when superpowers base moves to 6.3.0
```

Remove "release workflow auto-creates align changeset" — replaced by submodule-sync workflow.

- [ ] **Step 2: Update CLAUDE.md**

In **Releasing** section, replace manual superpowers bump + align changeset paragraph with:

```markdown
**Superpowers submodule bump:** automated weekly via `.github/workflows/submodule-sync.yml` (tag-based). Manual: checkout latest `v*` tag in `plugins/superpowers`, update `marketplace/source.json`, set overrides to `{semver}-overrides.0`, `pnpm run emit`. Align changeset no longer used.
```

Add under **Common operations**:

```markdown
**Trigger submodule sync manually:** GitHub Actions → Submodule Sync → Run workflow
```

- [ ] **Step 3: Full validation**

```bash
node --test scripts/lib/version-utils.test.mjs
node --test scripts/lib/submodule-tags.test.mjs
node scripts/bump-submodule.mjs superpowers --dry-run
node scripts/bump-submodule.mjs impeccable --dry-run
node scripts/tag-if-missing.mjs --dry-run
pnpm run validate
```

Expected: all tests PASS, validate ALL PASS

- [ ] **Step 4: Commit**

```bash
git add .changeset/README.md CLAUDE.md
git commit -m "docs: document submodule sync workflow and .0 version scheme"
```

---

## Spec Coverage Checklist

| Spec requirement | Task |
|---|---|
| Tag-based SHA detection | Task 2 |
| bump-submodule dry-run + apply | Task 3 |
| superpowers semver → overrides `.0` | Task 1 + 3 |
| Weekly cron + workflow_dispatch | Task 5 |
| PR per submodule, Issue tracking | Task 5 |
| tag-if-missing on merge | Task 4 |
| Deprecate align changeset | Task 4 |
| Version scheme docs | Task 6 |
| `pnpm run validate` | Task 6 |

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-01-submodule-sync-workflow.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration (`superpowers:subagent-driven-development`)
2. **Inline Execution** — execute tasks in this session with checkpoints (`superpowers:executing-plans`)

**Which approach?**

After execution mode is chosen, `/to-tickets` breakdown (Step 4 quiz) can publish to `docs/superpowers/tickets/2026-08-01-submodule-sync-workflow-tickets.md` if desired.
