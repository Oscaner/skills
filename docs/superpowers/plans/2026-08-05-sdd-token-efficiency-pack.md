# SDD Token 效率 — Phase pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `superpowers-overrides` to upstream-style single-layer plugin packaging — committed `.cursor-plugin` + `.codex-plugin` at plugin root, `emitMode: plugin-root` in marketplace source, delete `cursor-plugins/superpowers-overrides/` wrapper — without changing penf hook logic.

**Architecture:** Extend `pnpm run generate:overrides` with two new render scripts that read `package.json` + `.claude-plugin/plugin.json` and write harness manifests at plugin root. `emit-marketplace.mjs` branches on `cursor.emitMode`: wrapper (default) vs `plugin-root` (overrides only). Validation skips wrapper checks for plugin-root plugins and fails if wrapper dir remains.

**Tech Stack:** Bash, Python 3 (`build/lib/`), `pnpm` emit/validate, JSON Schema (`marketplace/source.schema.json`).

**Spec:** [pack design v1.0](../specs/2026-08-05-sdd-token-efficiency-pack-design.md)

**Prerequisite:** **penf ship complete** (release tag + CURSOR-SMOKE blocking). Before Task 1, verify penf release tag exists and `plugins/superpowers-overrides/docs/CURSOR-SMOKE.md` has penf smoke sign-off comment.

## Global Constraints

- **Scope:** `plugins/superpowers-overrides` generators/manifests/docs + repo-root `marketplace/` + `scripts/` emit/validate; **no** other plugin wrapper migration; **no** hook script logic changes; **no** p0/p1.
- **Hook invariants:** Do **not** modify `hooks-cursor.json` content, `bin/override-cursor-*.sh`, CC `hooks.json`, or pending-state contract.
- **Generation:** Hand-editing `.cursor-plugin/plugin.json` or `.codex-plugin/plugin.json` forbidden — run `pnpm run generate:overrides`.
- **`overrides.manifest.json`:** Used only for hook/CC generators (penf); **not** an input to harness manifest render scripts.
- **`emitMode`:** Only `"plugin-root"` in `marketplace/source.json`; declarative — **no** hardcoded `superpowers-overrides` in emit branch beyond reading the field.
- **Wrapper deletion:** `cursor-plugins/superpowers-overrides/` must not exist after Task 3; CI must fail if it reappears.
- **Codex stub:** minimal fields only — no `interface`, no `repository`.
- **Cursor manifest:** `"skills": "./skills/"`, `"hooks": "./hooks/hooks-cursor.json"`, `"displayName": "Superpowers Overrides"`.
- **Metadata truth:** `package.json` for version/description/author/license; name from `.claude-plugin/plugin.json`; align description with `marketplace/source.json` overrides entry.
- **Commits:** conventional (`feat:`, `fix:`, `docs:`, `chore:`); no AI trailers; commit after each task unless user says otherwise.

---

## File structure (locked)

| File | Responsibility |
|------|----------------|
| `plugins/superpowers-overrides/build/lib/plugin_metadata.py` | Load/validate `package.json` + `.claude-plugin/plugin.json` metadata for generators |
| `plugins/superpowers-overrides/build/render-cursor-manifest.sh` | Generate `.cursor-plugin/plugin.json` |
| `plugins/superpowers-overrides/build/render-codex-manifest.sh` | Generate `.codex-plugin/plugin.json` |
| `plugins/superpowers-overrides/build/generate-all.sh` | Wire manifest render scripts + `--check` |
| `plugins/superpowers-overrides/.cursor-plugin/plugin.json` | Generated committed Cursor harness manifest |
| `plugins/superpowers-overrides/.codex-plugin/plugin.json` | Generated committed Codex harness manifest |
| `plugins/superpowers-overrides/tests/manifest-harness.test.py` | Assert generated manifest shape + metadata |
| `marketplace/source.json` | overrides `cursor: { "emitMode": "plugin-root" }` only |
| `marketplace/source.schema.json` | cursor oneOf: wrapper vs plugin-root |
| `scripts/emit-marketplace.mjs` | Skip wrapper generation for plugin-root |
| `scripts/lib/marketplace-utils.mjs` | plugin-root path asserts + wrapper dir forbidden |
| `scripts/validate-marketplace.mjs` | plugin-root schema + wrapper skip/forbid |
| `plugins/superpowers-overrides/docs/MIGRATION-pack-single-layer.md` | Breaking migration guide |

---

### Task 1: Metadata truth + harness manifest generators

**Files:**
- Create: `plugins/superpowers-overrides/build/lib/plugin_metadata.py`
- Create: `plugins/superpowers-overrides/build/render-cursor-manifest.sh`
- Create: `plugins/superpowers-overrides/build/render-codex-manifest.sh`
- Modify: `plugins/superpowers-overrides/build/generate-all.sh`
- Modify: `plugins/superpowers-overrides/package.json`
- Create: `plugins/superpowers-overrides/tests/manifest-harness.test.py`
- Modify: `plugins/superpowers-overrides/tests/validate-overrides-build.sh`
- Create: `plugins/superpowers-overrides/.cursor-plugin/plugin.json` (via generate)
- Create: `plugins/superpowers-overrides/.codex-plugin/plugin.json` (via generate)

**Interfaces:**
- Produces: `plugin_metadata.load_harness_metadata(plugin_root: Path) -> dict` with keys `name`, `version`, `description`, `author`, `license`, `displayName`
- Produces: `.cursor-plugin/plugin.json` and `.codex-plugin/plugin.json` at plugin root

- [ ] **Step 1: Align `package.json` metadata**

Add to `plugins/superpowers-overrides/package.json`:

```json
"author": {
  "name": "Oscaner Miao",
  "email": "oscaner1997@gmail.com"
},
"description": "Personal overrides for the superpowers plugin that force delegation to other skills."
```

(description must match `marketplace/source.json` overrides.description verbatim)

- [ ] **Step 2: Write failing manifest harness test**

Create `plugins/superpowers-overrides/tests/manifest-harness.test.py`:

```python
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def load(p):
    return json.loads((ROOT / p).read_text())

def test_cursor_manifest():
    m = load(".cursor-plugin/plugin.json")
    assert m["name"] == "superpowers-overrides"
    assert m["displayName"] == "Superpowers Overrides"
    assert m["skills"] == "./skills/"
    assert m["hooks"] == "./hooks/hooks-cursor.json"
    assert "_generated" in m
    assert (ROOT / m["skills"]).is_dir()
    assert (ROOT / m["hooks"]).is_file()

def test_codex_manifest_minimal():
    m = load(".codex-plugin/plugin.json")
    assert m["name"] == "superpowers-overrides"
    assert m["skills"] == "./skills/"
    assert m["hooks"] == {}
    assert "interface" not in m
    assert "repository" not in m
    assert "_generated" in m

def test_metadata_matches_package_json():
    pkg = load("package.json")
    cursor = load(".cursor-plugin/plugin.json")
    codex = load(".codex-plugin/plugin.json")
    for m in (cursor, codex):
        assert m["version"] == pkg["version"]
        assert m["description"] == pkg["description"]
        assert m["author"] == pkg["author"]
        assert m["license"] == pkg["license"]

def test_description_matches_marketplace_source():
    import json
    repo = ROOT.parents[1]
    source = json.loads((repo / "marketplace/source.json").read_text())
    overrides = next(p for p in source["plugins"] if p["name"] == "superpowers-overrides")
    pkg = load("package.json")
    assert pkg["description"] == overrides["description"]

if __name__ == "__main__":
    test_cursor_manifest()
    test_codex_manifest_minimal()
    test_metadata_matches_package_json()
    test_description_matches_marketplace_source()
    print("OK")
```

- [ ] **Step 3: Run test to verify it fails**

Run: `python3 plugins/superpowers-overrides/tests/manifest-harness.test.py`
Expected: FAIL — `.cursor-plugin/plugin.json` missing

- [ ] **Step 4: Implement `plugin_metadata.py` + render scripts**

`plugin_metadata.py` reads:
- `name` from `.claude-plugin/plugin.json`
- `version`, `description`, `author`, `license` from `package.json`
- Asserts `name == "superpowers-overrides"` and `package.json.name == name`
- Asserts `package.json.description` === `marketplace/source.json` overrides.description (read repo-root source.json)
- Version ↔ source.json parity: **do not duplicate** — owned by existing `scripts/validate-version-sync.mjs` (`pnpm run validate` step 8–10)

`render-cursor-manifest.sh` emits (pretty JSON):

```json
{
  "_generated": "plugins/superpowers-overrides/build/render-cursor-manifest.sh — do not edit",
  "name": "superpowers-overrides",
  "displayName": "Superpowers Overrides",
  "description": "<from package.json>",
  "version": "<from package.json>",
  "author": { "name": "...", "email": "..." },
  "license": "MIT",
  "skills": "./skills/",
  "hooks": "./hooks/hooks-cursor.json"
}
```

`render-codex-manifest.sh` emits minimal stub (same metadata fields + `"skills": "./skills/"`, `"hooks": {}`).

Both scripts support `--check` via `diff -u` against committed output (mirror `render-rules.sh`).

Wire both into `generate-all.sh` **before** hook renders (manifests are independent).

- [ ] **Step 5: Generate + re-run tests**

Run: `pnpm run generate:overrides`
Run: `python3 plugins/superpowers-overrides/tests/manifest-harness.test.py`
Expected: `OK`

Add to `validate-overrides-build.sh` before `generate-all.sh --check`:

```bash
echo "== validate harness manifests =="
python3 "$ROOT/tests/manifest-harness.test.py"
```

- [ ] **Step 6: Commit**

```bash
git add plugins/superpowers-overrides/package.json \
  plugins/superpowers-overrides/build/lib/plugin_metadata.py \
  plugins/superpowers-overrides/build/render-cursor-manifest.sh \
  plugins/superpowers-overrides/build/render-codex-manifest.sh \
  plugins/superpowers-overrides/build/generate-all.sh \
  plugins/superpowers-overrides/.cursor-plugin/plugin.json \
  plugins/superpowers-overrides/.codex-plugin/plugin.json \
  plugins/superpowers-overrides/tests/manifest-harness.test.py \
  plugins/superpowers-overrides/tests/validate-overrides-build.sh
git commit -m "feat(overrides): generate plugin-root cursor and codex manifests"
```

---

### Task 2: Marketplace source + schema + emit plugin-root branch

**Files:**
- Modify: `marketplace/source.json`
- Modify: `marketplace/source.schema.json`
- Modify: `scripts/emit-marketplace.mjs`
- Modify: `scripts/lib/marketplace-utils.mjs`
- Modify: `scripts/validate-marketplace.mjs` (schema validation only in Task 2; plugin-root branches in Task 3)

**Interfaces:**
- Consumes: committed `.cursor-plugin/plugin.json` at plugin root (Task 1)
- Produces: `isPluginRoot(plugin)` helper; `cursorMarketplaceSource(plugin)` returns `./plugins/superpowers-overrides` for overrides

- [ ] **Step 1: Update overrides cursor block in source.json**

Replace `superpowers-overrides.cursor` with:

```json
"cursor": { "emitMode": "plugin-root" }
```

Remove `displayName`, `skills`, `hooks`.

- [ ] **Step 2: Extend source.schema.json cursor oneOf**

Add `$defs/cursorPluginRoot`:

```json
{
  "type": "object",
  "required": ["emitMode"],
  "additionalProperties": false,
  "properties": {
    "emitMode": { "type": "string", "enum": ["plugin-root"] }
  }
}
```

Change `$defs/cursor` to:

```json
"oneOf": [
  { "$ref": "#/$defs/cursorWrapper" },
  { "$ref": "#/$defs/cursorPluginRoot" }
]
```

Rename existing cursor def to `cursorWrapper` (displayName + skills required; hooks optional).

- [ ] **Step 2b: Wire JSON Schema validation**

Add to `scripts/validate-marketplace.mjs` (prefer **python jsonschema** in `ci-validate.sh` step 6 if no ajv in repo — check `package.json` first):

```bash
# ci-validate.sh fragment (if jsonschema available):
python3 -c "
import json
from jsonschema import validate
root = '$(pwd)'
source = json.load(open('marketplace/source.json'))
schema = json.load(open('marketplace/source.schema.json'))
validate(source, schema)
print('OK — source.json schema')
"
```

Run: `node scripts/validate-marketplace.mjs` (or schema-only smoke after wiring)
Expected: passes with new overrides cursor block

- [ ] **Step 3: Implement emit branch in `emit-marketplace.mjs`**

In the plugin loop:

```javascript
function isPluginRoot(plugin) {
  return plugin.cursor?.emitMode === "plugin-root";
}

// cursor marketplace entry:
const cursorSource = isPluginRoot(plugin)
  ? `./${plugin.contentRoot}`
  : `cursor-plugins/${plugin.name}`;

// wrapper generation:
if (!isPluginRoot(plugin)) {
  // existing mkdir + writeJson wrapper manifest
}
```

Update `compareTrees()` paths list: exclude `cursor-plugins/<name>/...` for plugin-root plugins.

- [ ] **Step 4: Update `marketplace-utils.mjs` assertCursorPathsExist**

```javascript
export function isPluginRoot(plugin) {
  return plugin.cursor?.emitMode === "plugin-root";
}

export function assertCursorPathsExist(root, plugin) {
  if (isPluginRoot(plugin)) {
    const contentRoot = join(root, plugin.contentRoot);
    const manifestPath = join(contentRoot, ".cursor-plugin/plugin.json");
    if (!existsSync(manifestPath)) {
      throw new Error(`Missing plugin-root manifest: ${manifestPath}`);
    }
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    for (const field of ["skills", "hooks"]) {
      if (!manifest[field]) continue;
      const abs = resolve(contentRoot, manifest[field]);
      if (!existsSync(abs)) {
        throw new Error(`Missing ${field} for ${plugin.name}: ${abs}`);
      }
    }
    // NOTE: wrapper-dir forbidden check deferred to Task 3 (wrapper still exists mid-plan)
    return;
  }
  // existing wrapper-root resolution unchanged
}
```

- [ ] **Step 5: Run emit (mid-plan: emit OK, full validate NOT green until Task 3)**

Run: `pnpm run generate:overrides && node scripts/emit-marketplace.mjs`
Expected: succeeds even while `cursor-plugins/superpowers-overrides/` still exists

Inspect `.cursor-plugin/marketplace.json` — overrides entry:

```json
"source": "./plugins/superpowers-overrides"
```

**Expected red until Task 3** (do not require green validate after Task 2 commit):
- `node scripts/validate-marketplace.mjs` — `validateSourceSchema` fails (plugin-root lacks displayName/skills) until Task 3 Step 1
- `node scripts/validate-marketplace.mjs` — `validateWrapperPaths` may still pass (wrapper exists)
- `pnpm run validate` — fails at step 6/7 until Task 3 complete

Do **not** delete wrapper until Task 3.

- [ ] **Step 6: Commit**

```bash
git add marketplace/source.json marketplace/source.schema.json \
  scripts/emit-marketplace.mjs scripts/lib/marketplace-utils.mjs \
  .cursor-plugin/marketplace.json
git commit -m "feat(marketplace): plugin-root emit mode for superpowers-overrides"
```

---

### Task 3: Validate scripts + delete wrapper + full CI green

**Files:**
- Modify: `scripts/validate-marketplace.mjs`
- Delete: `cursor-plugins/superpowers-overrides/` (entire directory)
- Modify: `.cursor-plugin/marketplace.json` (via emit refresh)

**Interfaces:**
- Consumes: `isPluginRoot()` from `marketplace-utils.mjs` (import or duplicate minimal check)

- [ ] **Step 1: Update `validateSourceSchema`**

Replace rigid `cursor.displayName/skills` check with:

```javascript
import { existsSync } from "node:fs";
// at top, import isPluginRoot from marketplace-utils OR inline same check

for (const p of source.plugins) {
  // ...existing required fields...
  if (isPluginRoot(p)) {
    const manifest = join(root, p.contentRoot, ".cursor-plugin/plugin.json");
    if (!existsSync(manifest)) throw new Error(`${p.name} missing ${manifest}`);
  } else {
    if (!p.cursor.displayName || !p.cursor.skills) {
      throw new Error(`${p.name} missing cursor.displayName or cursor.skills`);
    }
  }
}
```

- [ ] **Step 2: Update `validateWrapperPaths`**

```javascript
for (const p of source.plugins) {
  if (isPluginRoot(p)) {
    const wrapperDir = join(root, "cursor-plugins", p.name);
    if (existsSync(wrapperDir)) {
      throw new Error(`plugin-root ${p.name} wrapper must be deleted: ${wrapperDir}`);
    }
    const contentRoot = join(root, p.contentRoot);
    const manifest = JSON.parse(
      readFileSync(join(contentRoot, ".cursor-plugin/plugin.json"), "utf8"),
    );
    for (const field of ["skills", "hooks"]) {
      if (!manifest[field]) continue;
      const abs = resolve(contentRoot, manifest[field]);
      if (!existsSync(abs)) throw new Error(`${p.name} plugin-root ${field} missing: ${abs}`);
    }
    continue;
  }
  // existing wrapper path resolution
}
```

- [ ] **Step 3: Delete wrapper directory**

```bash
rm -rf cursor-plugins/superpowers-overrides
```

Verify: `ls cursor-plugins/superpowers-overrides` → No such file or directory

- [ ] **Step 4: Regenerate emit + implement marketplace source assert + full validate**

Implement `validateMarketplaceSources()` extension **before** running validate:

```javascript
const source = JSON.parse(readFileSync(join(root, "marketplace/source.json"), "utf8"));
for (const entry of cursor.plugins) {
  const plugin = source.plugins.find((p) => p.name === entry.name);
  if (plugin?.cursor?.emitMode === "plugin-root") {
    const expected = `./${plugin.contentRoot}`;
    if (entry.source !== expected) {
      throw new Error(`${entry.name} cursor source want ${expected}, got ${entry.source}`);
    }
  }
}
```

Run: `pnpm run emit`
Run: `node scripts/emit-marketplace.mjs --check`
Expected: `OK — marketplace emit fresh` (no overrides wrapper in diff list)

Run: `pnpm run validate`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/validate-marketplace.mjs \
  .cursor-plugin/marketplace.json
git add -u cursor-plugins/superpowers-overrides
git commit -m "feat(marketplace): remove overrides cursor wrapper and validate plugin-root"
```

---

### Task 4: Migration + runtime documentation

**Files:**
- Create: `plugins/superpowers-overrides/docs/MIGRATION-pack-single-layer.md`
- Modify: `plugins/superpowers-overrides/docs/cross-harness-overrides.md`
- Modify: `plugins/superpowers-overrides/docs/CURSOR-SMOKE.md`
- Modify: `marketplace/README.md`
- Modify: `README.md`
- Modify: `README.zh-CN.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Write MIGRATION-pack-single-layer.md**

Sections:
1. **Why** — single-layer contentRoot matches upstream superpowers; wrapper deprecated
2. **Cursor users** — refresh Team Marketplace / reinstall `superpowers-overrides`; confirm marketplace `source` is `./plugins/superpowers-overrides`
3. **Claude Code users** — no reinstall; cache tree gains `.cursor-plugin/` + `.codex-plugin/`; behavior unchanged
4. **Historical note** — penf design spec describes wrapper-era topology; superseded by pack
5. **Contributors** — `pnpm run generate:overrides && pnpm run validate` after metadata changes

- [ ] **Step 2: Update cross-harness-overrides.md**

Replace references to:
- `cursor-plugins/superpowers-overrides/.cursor-plugin/plugin.json`
- `marketplace/source.json cursor.hooks`

With:
- `plugins/superpowers-overrides/.cursor-plugin/plugin.json`
- hooks declared at `./hooks/hooks-cursor.json` relative to plugin root

- [ ] **Step 3: Update CURSOR-SMOKE.md installation path**

Add note at top of install section: plugin hooks load from **plugin root** `.cursor-plugin/plugin.json` (not `cursor-plugins/` wrapper). **Do not change** smoke scenario checklists (penf owns those).

Add **pack lightweight checklist** section (from spec Verification Manual):

- [ ] Settings → Hooks visible after marketplace refresh
- [ ] Sample `/brainstorming` trigger still fires detect/enforce
- [ ] Claude cache contains `.cursor-plugin/` + `.codex-plugin/`

- [ ] **Step 4: Update README.md + README.zh-CN.md + marketplace/README.md + CLAUDE.md**

README: overrides Cursor install path = `plugins/superpowers-overrides` contentRoot; `emitMode: plugin-root`.

`marketplace/README.md`: document two cursor modes — wrapper (default) vs `plugin-root` (overrides only).

`CLAUDE.md`: one sentence under marketplace section — overrides uses plugin-root single layer (no `cursor-plugins/` wrapper).

- [ ] **Step 5: Run validate**

Run: `pnpm run validate`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add plugins/superpowers-overrides/docs/MIGRATION-pack-single-layer.md \
  plugins/superpowers-overrides/docs/cross-harness-overrides.md \
  plugins/superpowers-overrides/docs/CURSOR-SMOKE.md \
  marketplace/README.md README.md README.zh-CN.md CLAUDE.md
git commit -m "docs(overrides): pack single-layer migration and install paths"
```

---

### Task 5: Release artifacts + manual smoke sign-off

**Files:**
- Create: `.changeset/<slug>.md`
- Modify: `plugins/superpowers-overrides/CHANGELOG.md`

- [ ] **Step 1: Add changeset**

Run: `pnpm changeset`

Summary (example):

```markdown
---
"superpowers-overrides": major
---

Breaking: Cursor Team Marketplace source for superpowers-overrides now points to plugin root (`plugins/superpowers-overrides`) instead of `cursor-plugins/superpowers-overrides/`. Refresh marketplace / reinstall plugin. Hook behavior unchanged.
```

- [ ] **Step 2: CHANGELOG entry**

Add under `## Unreleased` in `plugins/superpowers-overrides/CHANGELOG.md`:

```markdown
### Breaking Changes

- **pack:** Cursor marketplace installs from plugin-root `.cursor-plugin` (single-layer). Removed `cursor-plugins/superpowers-overrides/` wrapper. See `docs/MIGRATION-pack-single-layer.md`.
```

- [ ] **Step 3: Manual lightweight smoke (blocking before merge)**

Execute pack checklist from `CURSOR-SMOKE.md` / spec Verification Manual. Record in `MIGRATION-pack-single-layer.md` footer:

```markdown
<!-- pack smoke: YYYY-MM-DD by <name> — hooks visible, /brainstorming trigger OK -->
```

- [ ] **Step 4: Final validate**

Run: `pnpm run validate`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add .changeset/ plugins/superpowers-overrides/CHANGELOG.md \
  plugins/superpowers-overrides/docs/MIGRATION-pack-single-layer.md
git commit -m "chore(overrides): pack breaking changeset and changelog"
```

---

## Spec coverage checklist (plan author)

| Spec section | Task |
|--------------|------|
| P1 Generator + metadata asserts | Task 1 |
| P2 source.json + schema + emit + marketplace-utils | Task 2 |
| P2 validate-marketplace + wrapper delete + emit freshness | Task 3 |
| P3 Migration + README + marketplace README | Task 4 |
| P4 cross-harness + CURSOR-SMOKE + CLAUDE | Task 4 |
| Release changeset + CHANGELOG | Task 5 |
| Manual lightweight smoke | Task 5 |
| penf-design **not** modified | — (MIGRATION note only) |
| Hook logic unchanged | Global Constraints |

---
