# SDD Token 效率 — Phase pack-sp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate **superpowers** Cursor Team Marketplace install from wrapper (`cursor-plugins/superpowers/`) to **plugin-root** (`./plugins/superpowers`), delete the redundant wrapper, and document the hybrid emit rule in `cursor-plugins/README.md`.

**Architecture:** Reuse pack's existing `emitMode: plugin-root` branch in `emit-marketplace.mjs` / `validate-marketplace.mjs` — no new emit logic. Change only `marketplace/source.json` superpowers `cursor` block, delete generated wrapper, run `pnpm run emit`, then update contributor docs. Upstream submodule `.cursor-plugin/plugin.json` is the manifest truth source (not oscaner-generated).

**Tech Stack:** JSON (`marketplace/source.json`), `node scripts/emit-marketplace.mjs`, `pnpm run validate`, Markdown docs.

**Spec:** [pack-sp design v1.1](../specs/2026-08-05-sdd-token-efficiency-pack-sp-design.md)

**Prerequisite:** **pack impl merged** on the working branch — `superpowers-overrides` already uses `emitMode: plugin-root`, wrapper deleted, `pnpm run validate` green before starting Task 1.

**Idempotency:** Partial-run matrix:

| State | Task 0 | Task 1 | Tasks 2–4 |
|-------|--------|--------|-----------|
| Fresh (wrapper mode) | Run all steps | Run all steps | Run all |
| `source.json` already plugin-root, wrapper still exists | Skip Step 3 | Steps 1–2, 3 delete, 4–7 | Run all |
| Fully migrated (no wrapper, source plugin-root) | Skip Step 3; print SKIP | Skip Steps 1–5 & 7; run Step 6 validate only | Run if docs not yet updated |

Always run `pnpm run validate` before declaring done.

## Global Constraints

- **Scope:** `marketplace/source.json`, `.cursor-plugin/marketplace.json` (emit), delete `cursor-plugins/superpowers/`, new `cursor-plugins/README.md`, doc updates only — **no** submodule edits under `plugins/superpowers/`; **no** `superpowers-overrides/**` changes; **no** mattpocock / impeccable migration; **no** p0/p1.
- **Emit reuse:** Do **not** add new `emitMode` branches unless `pnpm run validate` exposes a gap — pack already implements plugin-root.
- **Manifest truth:** `plugins/superpowers/.cursor-plugin/plugin.json` is **upstream submodule** content — do not generate or hand-edit it.
- **Wrapper deletion:** `cursor-plugins/superpowers/` must not exist after Task 1; existing validate fails if recreated.
- **Hybrid rule:** Plugins **with** upstream `.cursor-plugin` → `emitMode: plugin-root`; **without** → wrapper (`cursor-plugins/<name>/`).
- **Ship gate:** `pnpm run validate`全绿 + manual lightweight Cursor checklist (not penf CURSOR-SMOKE blocking).
- **Commits:** conventional (`feat:`, `docs:`, `chore:`); no AI trailers; commit after each task unless user says otherwise.

---

## File structure (locked)

| File | Responsibility |
|------|----------------|
| `marketplace/source.json` | superpowers `cursor: { "emitMode": "plugin-root" }` only |
| `.cursor-plugin/marketplace.json` | Generated — superpowers `source`: `./plugins/superpowers` |
| `cursor-plugins/superpowers/` | **Delete** entire directory (wrapper artifact) |
| `cursor-plugins/README.md` | **New** — hybrid emit rule, plugin status table, upgrade checklist |
| `marketplace/README.md` | Update 3 sections per spec D4 |
| `CLAUDE.md` | Marketplace chain section — superpowers also plugin-root |
| `plugins/superpowers-overrides/docs/MIGRATION-pack-single-layer.md` | Optional one-line cross-link to pack-sp / cursor-plugins README |

**Untouched:** `scripts/emit-marketplace.mjs`, `scripts/validate-marketplace.mjs`, `plugins/superpowers/**`, `superpowers-overrides/**` (unless validate gap).

---

### Task 0: Preflight — pack impl present

**Files:** (read-only verification)

**Interfaces:**
- Produces: confirmation that `isPluginRoot()` emit/validate paths exist and overrides migration is complete

- [ ] **Step 1: Verify pack emit branch exists**

Run:

```bash
grep -n 'isPluginRoot' scripts/emit-marketplace.mjs scripts/validate-marketplace.mjs scripts/lib/marketplace-utils.mjs
```

Expected: all three files reference `isPluginRoot` / `emitMode`.

- [ ] **Step 2: Verify overrides already plugin-root**

Run:

```bash
node -e "
const s=require('./marketplace/source.json');
const o=s.plugins.find(p=>p.name==='superpowers-overrides');
if(o.cursor?.emitMode!=='plugin-root') throw new Error('overrides not plugin-root');
console.log('OK — overrides plugin-root');
"
test ! -d cursor-plugins/superpowers-overrides && echo 'OK — overrides wrapper gone'
```

Expected: both OK lines print.

- [ ] **Step 3: Verify superpowers baseline (skip if already migrated)**

Run:

```bash
node -e "
const s=require('./marketplace/source.json');
const sp=s.plugins.find(p=>p.name==='superpowers');
if(sp.cursor?.emitMode==='plugin-root') { console.log('SKIP — superpowers already plugin-root'); process.exit(0); }
if(!sp.cursor.displayName) throw new Error('missing displayName');
console.log('OK — superpowers still wrapper mode');
"
test -d cursor-plugins/superpowers && echo 'OK — superpowers wrapper exists' || echo 'SKIP — wrapper already deleted'
```

Expected: either OK lines (pre-migration) or SKIP lines (partial/complete migration). If both SKIP, follow idempotency matrix — Task 1 may be validate-only.

- [ ] **Step 4: Verify upstream manifest exists**

Run:

```bash
test -f plugins/superpowers/.cursor-plugin/plugin.json && \
node -e "
const m=require('./plugins/superpowers/.cursor-plugin/plugin.json');
const fs=require('fs'); const path=require('path');
const root='plugins/superpowers';
for (const [k,v] of Object.entries({skills:m.skills, hooks:m.hooks})) {
  if(!v) continue;
  const p=path.resolve(root,v);
  if(!fs.existsSync(p)) throw new Error(k+' missing: '+p);
}
console.log('OK — upstream manifest paths resolve');
"
```

Expected: `OK — upstream manifest paths resolve`

- [ ] **Step 5: Baseline validate green**

Run: `pnpm run validate`
Expected: all steps pass (pack complete state).

**No commit** — preflight only.

---

### Task 1: Marketplace migration — source.json + delete wrapper + emit

**Files:**
- Modify: `marketplace/source.json`
- Delete: `cursor-plugins/superpowers/` (entire directory)
- Modify: `.cursor-plugin/marketplace.json` (via emit)

**Interfaces:**
- Consumes: `plugins/superpowers/.cursor-plugin/plugin.json` (upstream, read-only)
- Produces: superpowers Cursor marketplace `source` === `./plugins/superpowers`; no `cursor-plugins/superpowers/`

- [ ] **Step 1: Update superpowers cursor block in source.json**

In `marketplace/source.json`, replace the `superpowers` plugin's `cursor` object:

```json
"cursor": {
  "emitMode": "plugin-root"
}
```

Remove `displayName`, `skills`, `hooks` from superpowers.cursor. Do **not** change other plugins.

- [ ] **Step 2: Run emit**

Run:

```bash
node scripts/emit-marketplace.mjs
```

Inspect superpowers entry in `.cursor-plugin/marketplace.json`:

```json
{
  "name": "superpowers",
  "source": "./plugins/superpowers",
  ...
}
```

Run drift check:

```bash
node scripts/emit-marketplace.mjs --check
```

Expected: exit 0 — `--check` diffs emitted JSON only; plugin-root plugins are excluded from wrapper paths. Wrapper **deletion** is enforced by `validate-marketplace.mjs` (Step 5), not `--check`.

- [ ] **Step 3: Delete superpowers wrapper**

```bash
rm -rf cursor-plugins/superpowers
```

Verify:

```bash
test ! -d cursor-plugins/superpowers && echo 'OK — wrapper deleted'
```

- [ ] **Step 4: Re-run emit + drift check (post-delete)**

Run:

```bash
node scripts/emit-marketplace.mjs
node scripts/emit-marketplace.mjs --check
```

Expected: both succeed; `compareTrees` must **not** list `cursor-plugins/superpowers/.cursor-plugin/plugin.json`.

- [ ] **Step 5: Run marketplace validation**

Run:

```bash
node scripts/validate-marketplace.mjs
```

Expected output includes:

```
OK — source.json schema
OK — source.json (4 plugins)
OK — wrapper paths resolve
OK — marketplace plugin sources exist
```

- [ ] **Step 6: Full validate**

Run: `pnpm run validate`
Expected: all green.

- [ ] **Step 7: Commit**

Skip if idempotency matrix row 3 (fully migrated) and `git status` shows no changes for these paths.

```bash
git add marketplace/source.json .cursor-plugin/marketplace.json
git rm -r cursor-plugins/superpowers 2>/dev/null || true
git diff --cached --quiet || git commit -m "feat(marketplace): superpowers cursor plugin-root emit mode"
```

Note: if `cursor-plugins/superpowers` was already absent from git index, verify `git status` shows expected state before commit.

---

### Task 2: `cursor-plugins/README.md` — hybrid emit handbook

**Files:**
- Create: `cursor-plugins/README.md`

**Interfaces:**
- Consumes: Task 1 completed (superpowers plugin-root, wrapper deleted)
- Produces: documented hybrid rule + status table + upgrade checklist (spec D3)

- [ ] **Step 1: Create `cursor-plugins/README.md`**

Write the file with these sections (content may be refined for clarity; all four sections required):

```markdown
# Cursor plugin wrappers (`cursor-plugins/`)

## Why this directory exists

Some plugins in the oscaner marketplace **do not** ship an upstream `.cursor-plugin/plugin.json`. For those plugins, oscaner **generates** a thin wrapper manifest under `cursor-plugins/<name>/.cursor-plugin/plugin.json` from fields in `marketplace/source.json` (`displayName`, `skills`, optional `hooks`).

Plugins that **already** have a Cursor manifest at their content root use **plugin-root** mode instead — no wrapper directory here.

See also [marketplace/README.md](../marketplace/README.md) for the edit/emit workflow.

## Hybrid emit rule

```
contentRoot/.cursor-plugin/plugin.json exists?
  YES → marketplace/source.json: { "cursor": { "emitMode": "plugin-root" } }
        Cursor Team Marketplace source → ./<contentRoot>
        Do NOT generate cursor-plugins/<name>/
  NO  → marketplace/source.json: cursor.displayName + cursor.skills (+ hooks?)
        emit → cursor-plugins/<name>/.cursor-plugin/plugin.json
        Cursor Team Marketplace source → cursor-plugins/<name>
```

After changing `source.json`, always run:

```bash
pnpm run emit && pnpm run validate
```

## Current plugin status

| Plugin | Mode | Notes |
|--------|------|-------|
| superpowers-overrides | plugin-root | pack — oscaner-generated manifest at plugin root |
| superpowers | plugin-root | pack-sp — upstream submodule manifest |
| mattpocock-skills | wrapper | no upstream `.cursor-plugin` |
| impeccable | wrapper | no upstream `.cursor-plugin` |

## Upgrade checklist (wrapper → plugin-root)

When upstream adds `.cursor-plugin/plugin.json` to a plugin's content root:

1. Verify `<contentRoot>/.cursor-plugin/plugin.json` exists and `skills` / `hooks` paths resolve relative to contentRoot.
2. Set `marketplace/source.json` → `"cursor": { "emitMode": "plugin-root" }` for that plugin.
3. Remove `cursor.displayName`, `cursor.skills`, `cursor.hooks` from that plugin entry.
4. Delete `cursor-plugins/<name>/` if it exists.
5. Run `pnpm run emit && pnpm run validate`.
6. Ask Cursor users to refresh the Team Marketplace.
7. Update this status table and [marketplace/README.md](../marketplace/README.md).
```

- [ ] **Step 2: Verify README structure**

Run:

```bash
test -f cursor-plugins/README.md
for h in '## Why this directory exists' '## Hybrid emit rule' '## Current plugin status' '## Upgrade checklist'; do
  grep -q "$h" cursor-plugins/README.md || { echo "MISSING: $h"; exit 1; }
done
grep -q 'plugin-root' cursor-plugins/README.md
for p in superpowers-overrides superpowers mattpocock-skills impeccable; do
  grep -q "$p" cursor-plugins/README.md || { echo "MISSING plugin row: $p"; exit 1; }
done
echo 'OK — README structure'
```

- [ ] **Step 3: Commit**

```bash
git add cursor-plugins/README.md
git commit -m "docs(marketplace): cursor-plugins hybrid emit handbook"
```

---

### Task 3: Doc cross-links — marketplace README + CLAUDE.md

**Files:**
- Modify: `marketplace/README.md`
- Modify: `CLAUDE.md`
- Modify (optional): `plugins/superpowers-overrides/docs/MIGRATION-pack-single-layer.md`

**Interfaces:**
- Consumes: Task 2 `cursor-plugins/README.md`
- Produces: D4 acceptance — all three marketplace/README sections updated; CLAUDE.md reflects superpowers plugin-root

- [ ] **Step 1: Update `marketplace/README.md` Generated outputs table**

Replace the table body with:

```markdown
| Path | Harness |
|------|---------|
| `.claude-plugin/marketplace.json` | Claude Code |
| `.cursor-plugin/marketplace.json` | Cursor Team Marketplace |
| `cursor-plugins/<name>/.cursor-plugin/plugin.json` | Cursor plugin wrappers (**wrapper mode only**) |
| `plugins/superpowers-overrides/.cursor-plugin/plugin.json` | Cursor manifest at plugin root — oscaner **generated** (`emitMode: plugin-root`) |
| `plugins/superpowers/.cursor-plugin/plugin.json` | Cursor manifest at plugin root — **upstream submodule (not emit)** |
```

- [ ] **Step 2: Update `marketplace/README.md` Cursor install modes prose**

Replace:

```markdown
Today only **`superpowers-overrides`** uses plugin-root. Other plugins keep wrapper emit.
```

With:

```markdown
**Plugin-root today:** `superpowers-overrides` (oscaner-generated manifest) and **`superpowers`** (upstream submodule manifest). Other plugins keep wrapper emit. See [cursor-plugins/README.md](../cursor-plugins/README.md) for the hybrid rule and upgrade checklist.
```

- [ ] **Step 3: Update `marketplace/README.md` Cursor Team Marketplace section**

Replace the single-plugin sentence with:

```markdown
Import `https://github.com/Oscaner/skills` in Cursor Dashboard → Settings → Plugins → Team Marketplaces. Plugins resolve via `.cursor-plugin/marketplace.json`. **`superpowers-overrides`** and **`superpowers`** install from plugin root (`./plugins/...`); see [cursor-plugins/README.md](../cursor-plugins/README.md). Overrides migration: [MIGRATION-pack-single-layer.md](../plugins/superpowers-overrides/docs/MIGRATION-pack-single-layer.md).
```

- [ ] **Step 4: Update `CLAUDE.md` Marketplace chain bullet 3**

Replace the existing bullet 3 under `## Marketplace → plugin → skill chain`:

```markdown
3. [.cursor-plugin/marketplace.json](.cursor-plugin/marketplace.json) + [cursor-plugins/](cursor-plugins/) — generated Cursor Team Marketplace wrappers (except `superpowers-overrides`, which uses **plugin-root** single layer — see [MIGRATION-pack-single-layer.md](plugins/superpowers-overrides/docs/MIGRATION-pack-single-layer.md)).
```

With:

```markdown
3. [.cursor-plugin/marketplace.json](.cursor-plugin/marketplace.json) + [cursor-plugins/](cursor-plugins/) — Cursor Team Marketplace: **plugin-root** for `superpowers-overrides` and `superpowers` (manifest at plugin root); **wrapper** emit for mattpocock-skills and impeccable under `cursor-plugins/`. Hybrid rule: [cursor-plugins/README.md](cursor-plugins/README.md). Overrides migration: [MIGRATION-pack-single-layer.md](plugins/superpowers-overrides/docs/MIGRATION-pack-single-layer.md).
```

- [ ] **Step 5 (optional): MIGRATION cross-link**

Add after the Historical note section in `MIGRATION-pack-single-layer.md`:

```markdown
## Related: superpowers plugin-root (pack-sp)

Upstream **superpowers** uses the same single-layer Cursor install (`./plugins/superpowers`). See [cursor-plugins/README.md](../../../cursor-plugins/README.md).
```

- [ ] **Step 6: Assert doc strings landed**

Run:

```bash
grep -q 'upstream submodule (not emit)' marketplace/README.md
grep -q 'superpowers-overrides.*superpowers' marketplace/README.md
grep -q 'cursor-plugins/README.md' marketplace/README.md
grep -q 'superpowers-overrides.*superpowers' CLAUDE.md
grep -q 'cursor-plugins/README.md' CLAUDE.md
echo 'OK — doc cross-links'
```

- [ ] **Step 7: Re-run validate**

Run: `pnpm run validate`
Expected: all green (doc-only changes should not break CI).

- [ ] **Step 8: Commit**

```bash
git add marketplace/README.md CLAUDE.md
# optional:
git add plugins/superpowers-overrides/docs/MIGRATION-pack-single-layer.md
git commit -m "docs(marketplace): pack-sp cross-links and plugin-root prose"
```

---

### Task 4: Ship gate — lightweight Cursor smoke

**Files:** (none — manual sign-off recorded in PR / ticket demo)

**Interfaces:**
- Consumes: Tasks 1–3 complete; `pnpm run validate` green

- [ ] **Step 1: Automated gate (repeat)**

Run:

```bash
pnpm run validate
node scripts/emit-marketplace.mjs --check
test ! -d cursor-plugins/superpowers
node -e "
const c=require('./.cursor-plugin/marketplace.json');
const sp=c.plugins.find(p=>p.name==='superpowers');
if(sp.source!=='./plugins/superpowers') throw new Error('bad source: '+sp.source);
console.log('OK — cursor marketplace source');
"
```

Expected: all pass.

- [ ] **Step 2: Manual Cursor checklist (blocking per spec)**

Perform and record (comment in PR or ticket demo):

- [ ] Cursor Dashboard → refresh `oscaner` Team Marketplace
- [ ] `superpowers` plugin still listed and installable
- [ ] Settings → Hooks shows upstream superpowers hooks from `plugins/superpowers/hooks/hooks-cursor.json` (e.g. `sessionStart` if present in that file)
- [ ] Sample skill discovery unchanged (known co-install limitation still applies)

- [ ] **Step 3: No commit required**

Manual sign-off only unless adding a dated HTML comment to a doc — **do not** expand scope to penf CURSOR-SMOKE suite.

---

## Spec coverage map

| Spec deliverable | Plan task |
|------------------|-----------|
| D1 source.json plugin-root | Task 1 |
| D2 delete wrapper + emit | Task 1 |
| D3 cursor-plugins/README.md | Task 2 |
| D4 marketplace/README + CLAUDE.md | Task 3 |
| D4 optional MIGRATION cross-link | Task 3 Step 5 |
| Automated verification | Task 1 Step 5–6, Task 4 Step 1 |
| Manual lightweight smoke | Task 4 Step 2 |
| Preflight pack dependency | Task 0 |

---
