# Repo Artifact Cleanup Design

**Date:** 2026-07-30  
**Status:** Approved  
**Scope:** Tracked doc drift fixes, gitignored local spec cleanup, and dogfood version-stamp CI for `superpowers-overrides` in `oscaner-skills`.

## Problem

The marketplace repo accumulated layers that look redundant:

1. **Generated vs deployed copies** — `build/generated/*` duplicates `.cursor/rules/superpowers-overrides.mdc` and the `CLAUDE.md` self-check block. **Resolution:** keep both layers (intentional); add CI so dogfood stamps match `plugin.json` (no merge/delete).
2. **Stale local specs** — `docs/superpowers/` (gitignored) holds shipped/superseded naming and emit docs.
3. **Outdated agent docs** — `CLAUDE.md` still instructs manually editing `bin/override-prompt-expansion.sh`; `cross-harness-overrides.md` links to missing spec files.

Most “duplicates” are intentional (source → generated → dogfood deploy). This spec addresses #2 and #3 directly, and #1 via CI only.

## Decisions (user-approved)

| Question | Choice |
|----------|--------|
| Scope | Tracked docs + gitignored local cleanup + dogfood CI (not submodule/emit restructuring) |
| Superseded local specs | Delete enumerated 12 files; history via CHANGELOG / git only |
| Dogfood deploy copies | Keep committed; add CI version-stamp check |
| `docs/superpowers/` future | Keep directory + gitignore; delete existing files only |
| Doc fixes | Same PR as cleanup |
| README | Light edit for concision — dedupe, link out for depth |

## What stays (not redundant)

```
overrides.manifest.json
  ├─ render-hook.sh → bin/override-prompt-expansion.sh
  ├─ render-claude-self-check.sh + templates → build/generated/claude-self-check.md
  └─ render-rules.sh + templates → build/generated/cursor-self-check.mdc
         └─ spor-init → project CLAUDE.md / .cursor/rules/superpowers-overrides.mdc

marketplace/source.json
  └─ emit → .claude-plugin/marketplace.json
         → .cursor-plugin/marketplace.json
         → cursor-plugins/*/ (wrappers for submodule paths)
```

**Do not remove or merge:**

- `build/templates/` and `build/generated/`
- Emit outputs (Claude + Cursor marketplace manifests)
- `cursor-plugins/` wrappers
- Committed dogfood copies at repo root (`.cursor/rules/superpowers-overrides.mdc`, `CLAUDE.md` self-check block)

## What gets deleted

Delete **exactly these 12 files** under local `docs/superpowers/` (gitignored, not in git history). Do not delete other paths unless they appear later; any new file under these dirs is out of scope for this PR.

**specs/**
- `2026-07-30-spor-skill-prefix-design.md`
- `2026-07-30-unified-skill-naming-design.md`
- `2026-07-30-opaque-skill-naming-spike-design.md`
- `2026-07-30-cursor-marketplace-emit-design.md`

**plans/**
- `2026-07-30-spor-skill-prefix.md`
- `2026-07-30-unified-skill-naming.md`
- `2026-07-30-opaque-skill-naming-spike.md`
- `2026-07-30-cursor-marketplace-emit.md`

**tickets/**
- `2026-07-30-spor-skill-prefix-tickets.md`
- `2026-07-30-unified-skill-naming-tickets.md`
- `2026-07-30-opaque-skill-naming-spike-tickets.md`
- `2026-07-30-cursor-marketplace-emit-tickets.md`

**Keep empty directories:** `docs/superpowers/specs/`, `plans/`, `tickets/` plus `.gitignore` entry for future brainstorming output.

## CI: dogfood version alignment

Add validation that installed plugin version matches deployed self-check stamps at repo root.

**Implementation:** append a new section to `plugins/superpowers-overrides/tests/validate-overrides-build.sh` (do not create a separate script). Reuse the same parsing rules as the existing generated-artifact stamp check:

1. Read `installed_version` from `plugins/superpowers-overrides/.claude-plugin/plugin.json`.
2. Parse `.cursor/rules/superpowers-overrides.mdc` frontmatter `superpowers-overrides-version:` (same as generated `.mdc`).
3. Parse `CLAUDE.md` with regex `<!-- superpowers-overrides-version: ([^ ]+) -->` on the **first line of the file** (matches current dogfood layout and `build/generated/claude-self-check.md`).
4. Fail if either stamp is missing or ≠ `installed_version`. Message: re-run `/spor-init`.

**Relationship to existing checks:** the same script already validates `build/generated/*` stamps; this addition validates **dogfood deploy copies** only.

## Documentation updates (same PR)

### `cross-harness-overrides.md`

- Remove the “Design specs” bullet list linking to `docs/superpowers/specs/*`.
- Replace with a short paragraph: naming evolved v1 emit → v2 `-overrides` suffix → v3 `spor-*` prefix; see `CHANGELOG.md` entries for `6.2.0-overrides.3` through `6.2.0-overrides.6`.

### `CLAUDE.md` — “Add a new override skill” section

Replace the full subsection through the “Missing step …” failure-mode bullets (currently ~L110–116):

- **Intro:** four things must change together (was “three”).
- **Steps 1–4:** SKILL.md, plugin.json, manifest + `pnpm run generate:overrides`, README row.
- **Failure-mode bullets:** update to manifest/generator drift (remove “Missing step 3 → hooks … case branch” wording).

### `README.md` — simplify (same PR)

**Goal:** shorter entry point for humans; agent/contributor depth stays in `CLAUDE.md` and `plugins/superpowers-overrides/docs/`.

**Keep (unchanged substance):**
- Installation (marketplace + submodule clone)
- Plugin one-liners (`mattpocock-skills`, `superpowers-overrides`)
- Repository layout + `pnpm run emit && validate`
- Releasing table
- Contributing pointer → `CLAUDE.md`

**Consolidate / trim:**
- **Enforcement wiring** appears 3× today (`Plugins` intro, `System prompt wiring`, `How the override system works`) → merge into **one** short section (~5–8 lines): hooks + `/spor-init` + link to `cross-harness-overrides.md` for Cursor/harness detail.
- **Override skill table** (13 rows) → replace with compact summary + link to override table in `cross-harness-overrides.md` or `CLAUDE.md` (keep at most 3–4 high-traffic rows, e.g. `spor-init`, `spor-brainstorming`, `spor-writing-plans`, `spor-subagent-driven-development`).
- **Usage / First-time setup / Cursor** — merge overlapping setup steps; single “Quick start” block (install plugins → `/spor-init` → use `/superpowers:*` or `/spor-*` in Cursor).
- **Contributing “New override skills”** long frontmatter bullet → one sentence + link to `CLAUDE.md#the-overrides-pattern-superpowers-overrides`.

**Do not:**
- Remove install/release commands
- Duplicate generator/manifest steps already in `CLAUDE.md` (link instead)
- Grow README with new content — net line count should **decrease** (target: ~30% shorter than current ~179 lines, without losing install path)

**Verify:** no broken relative links; `rg 'case branch' README.md` still clean.

## Out of scope

- Submodule trees (`plugins/superpowers/`, `plugins/mattpocock-skills/`, `impeccable/`)
- Removing dogfood copies from git
- Changing emit chain structure
- Archiving specs into git (user chose delete-only)

## Success criteria

1. **Manual (pre-merge checklist):** the 12 enumerated files are gone; `docs/superpowers/{specs,plans,tickets}/` contain no other files.
2. No dead links to deleted spec files in tracked docs.
3. `pnpm run validate` passes including new dogfood version check in `validate-overrides-build.sh`.
4. `CLAUDE.md` “Add a new override skill” subsection describes manifest-driven generator workflow with no manual hook `case` instructions.
5. `README.md` is measurably shorter; no triplicate enforcement sections; override detail linked out rather than inlined.

## Implementation notes

- Run file deletion on developer machine (gitignored paths); no git commit for deleted spec content. Record completion in PR test plan, not CI.
- After CI lands, if dogfood copies drift, run `/spor-init` to refresh before merge.
- This design doc lives in `plugins/superpowers-overrides/docs/` (tracked) because `docs/superpowers/` is gitignored by convention.
