# superpowers-overrides

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


