# superpowers-overrides

## 6.2.0-overrides.13

### Patch Changes

- Breaking: Cursor Team Marketplace installs `superpowers-overrides` from plugin root (`plugins/superpowers-overrides`) instead of `cursor-plugins/superpowers-overrides/`. Refresh marketplace or reinstall. Adds committed `.cursor-plugin` and `.codex-plugin` at plugin root. Hook logic unchanged.


- Breaking: Cursor Team Marketplace installs **superpowers** from plugin root (`./plugins/superpowers`) instead of `cursor-plugins/superpowers/`. Removed redundant wrapper; upstream submodule `.cursor-plugin` is the manifest source. Refresh marketplace or reinstall. Adds `cursor-plugins/README.md` documenting hybrid emit (plugin-root vs wrapper). Does not change superpowers submodule content or hook logic.


## 6.2.0-overrides.12

### Patch Changes

- **penf — override-first enforcement (Cursor + Claude Code)**

  - **Cursor:** plugin-bundled `hooks-cursor.json` with `beforeSubmitPrompt` detect (pending state) and `preToolUse` enforce (deny non-`spor-*` first tools; allow Read/Skill spor). Marketplace `cursor.hooks` wired via emit.
  - **Claude Code:** manifest-generated `hooks.json` matchers for `^superpowers:`, bare `/<slug>`, and `^/spor-<slug>`; expansion script maps all three trigger forms.
  - **Generators:** `trigger_patterns.py`, `render-claude-hooks.sh`, `render-cursor-hooks.sh`; shell tests + CI executable checks.
  - **Self-check / docs:** red flags for manual upstream SKILL attach; `spor-init` clarifies plugin hooks (no project `.cursor/hooks.json`); CURSOR-SMOKE blocking checklist for penf ship gate.

## 6.2.0-overrides.11

### Patch Changes

- **`spor-brainstorming`** refines multi-phase guidance from dogfooding: Program flow diagram and three invariants (overall gate, independent phase cycle, overall as plan of record); Rule 3b now stops grilling on sub-phase splits and updates overall in the same turn; consolidated Red Flags/Rationalizations; slimmer overall-phase template (structure only).


## 6.2.0-overrides.10

### Patch Changes

- **`spor-brainstorming`** adds Rule 3 step 4 **overall gate**: after decomposition approval and overall review, do not propose or write phase specs in the same plan or turn — wait for explicit user go-ahead per phase. Rule 3a requires that prerequisite; template §0 states overall approval ≠ phase brainstorming started.


## 6.2.0-overrides.9

### Patch Changes

- **`spor-brainstorming`** splits overall/phase guidance: the template is document structure only (~140 lines); process discipline moves to SKILL Rule 3 sub-rules **3a–3e** (independent phase brainstorming, feed-back deviations to overall, serial/parallel execution, in-place decomposition, completion signal). Phase specs must update the overall when strategy diverges; Deviations table records cross-phase drift.


## 6.2.0-overrides.8

### Patch Changes

- **`spor-brainstorming`** overall/phase spec template is now a full authoring guide for multi-phase programs: user-language specs (no fixed locale or hardcoded harness/model), `docs/superpowers/` path naming for overall and per-phase artifacts, program-charter scope boundaries, status/version lifecycle, inventory link semantics, phase design body tied to upstream brainstorming, downstream Notes section, parallel-branch execution rules, phase-spec Rule 1 review, and git-tag completion escape hatch. Rule 3 updated to cite file paths, parallel execution, and phase review.


## 6.2.0-overrides.7

### Patch Changes

- Sync dogfood self-check deploy copies during release version bump so changesets pre-commit validate passes.


- Embed `superpowers-overrides-version` in generated self-check artifacts and teach `/spor-init` to refresh project rules when the installed plugin version differs (or when legacy unversioned rules are present).


## 6.2.0-overrides.6

### Patch Changes

- Revert spor-bs opaque naming spike; restore `spor-brainstorming`. Cursor marketplace dedup is not fixable by id or description changes — use project `.cursor/skills/` copy.


## 6.2.0-overrides.5

### Patch Changes

- BREAKING (spike): Rename brainstorming override to `spor-bs` to test Cursor marketplace dedup fix. Re-run init after upgrade. Manual smoke: plugin Skills count should increase without project copy.


## 6.2.0-overrides.4

### Patch Changes

- BREAKING: Rename all override skills to `spor-*` prefix so Cursor flat namespace no longer deduplicates them against upstream `superpowers` skills. Supersedes the `-overrides` suffix naming from 6.2.0-overrides.3. Re-run `/spor-init` after upgrade.


## 6.2.0-overrides.3

### Patch Changes

- BREAKING: Rename override skills to `-overrides` suffix; delete `.cursor/skills/` emit tree. Re-run init after upgrade. Manual Cursor install copies from `plugins/superpowers-overrides/skills/`.


## 6.2.0-overrides.2

### Patch Changes

- Add Cursor Team Marketplace support: canonical `marketplace/source.json` registry with dual emit to `.claude-plugin/marketplace.json`, `.cursor-plugin/marketplace.json`, and `cursor-plugins/` wrappers. Move all plugins under `plugins/` for clearer repo layout. Extend CI validation and release workflow to keep emitted manifests fresh. Add husky pre-commit running `ci-validate.sh`.


## 6.2.0-overrides.1

### Patch Changes

- Initial release with CI and changesets automation.
