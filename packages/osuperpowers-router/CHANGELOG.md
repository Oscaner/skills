# osuperpowers-router

## 6.2.0-router.0.15.4

### Patch Changes

- osuperpowers P1 — plugin skeleton + `cli-*` family + droid/pi harnesses + CLI mode rework.
  
  - Created the os-engineering plugin: marketplace/source.json registration, plugin.json, CI validate integration.
  - Reorganized the SDD harness mechanism: declarative harness registry (JSON: harness → cli_bin / invocation flags / output format / review_prefix / ship level) + a single generic runner `cdd-run.sh` (`--harness <name> --task N --mode …` / `--plan`); deleted per-harness wrapper and stub scripts.
  - Added droid and pi as full harnesses (stream-json parsing / `--auto` level / completion sentinel).
  - Full sdd → cdd rename: `SDD_*` → `CDD_*` env vars, `cdd-common.sh`, `cdd-run.sh`, workspace `.superpowers/sdd/` → `.superpowers/cdd/`, `docs/cdd-reference.md`, `templates/cdd/`.
  - New `cli-*` skills: `cli-select` (installed-harness listing + recommendation), `cli-task` (generic one-shot dispatch), `cli-driven-development` (three-mode chain), `cli-code-review`.

- osuperpowers P2 — `os-*` orchestrator family extraction (core-set audit, 8 skills).
  
  - 8 standalone flow-orchestration skills: `os-brainstorming` / `os-writing-plans` / `os-executing-plans` (three-mode master orchestrator: in-session → upstream executing-plans / subagent → subagent-driven-development / cli → `cli-driven-development`) / `os-finishing` (with worktree refusal) / `os-verification` / `os-debugging` / `os-code-review` / `os-report-issue`.
  - Deliberately non-1:1 mappings: tdd maps directly to mattpocock (seam gate folded into cdd implement), executing-plans maps to os-executing-plans, p0-fallback deleted.
  - Cross-cutting docs (`spor-subagent-lifecycle`, `spor-token-efficient-review-dispatch`) demoted to plugin docs; overall + phase templates moved in.
  - Gate mode-awareness: `pending.mode` (in-session / subagent / cli — cli strictly gated, others allow repo edits).

- osuperpowers P3 — thin router + superpowers-style emission.
  
  - osuperpowers-router reduced to a **trigger router** (plugin-root, claude + cursor): manifest triggers → target table (`spor-*` → `os-*`/`cli-*`/mattpocock tdd), hooks/expansion/self-check point at `os-*`/`cli-*`; all `spor-*` skills deleted; numbered rule-reference mode retired.
  - os-engineering = skills + engine + gate: gate fully migrated (PreToolUse hooks), `os-init` landed (parameterized), independent versioning.
  - Unified emit tool (`pnpm run emit`): generates all first-party products from source.json — thin claude/cursor/codex/kimi/gemini/pi manifests pointing at `skills/` + GEMINI.md + shared `.agents/skills/` + router hooks/self-check + version sync.
  - Dropped rovo/vibe/kiro native emission (no native installer; the gate surface was later restored in P4b).

- osuperpowers P4 — publishing architecture v2 (package-as-source) + gate surface ported to Node.
  
  - Directory rework: `packages/` (first-party) + `vendors/` (upstream submodule sources: superpowers / mattpocock-skills / impeccable — never edited); `package.json#oscaner-plugin` is the single metadata source of truth (marketplace/source.json derived).
  - pnpm workspace + changesets version and publish all `@oscaner-skills/*` packages together (vendored plugins republished via build-time assembly, upstream attribution preserved).
  - Marketplace + harness manifests generated from packages; a future plugin = add a package directory, automatically wired into emit + publishing.
  - Gate surface ported to Node: `cdd-gate-core` + thin CLI (single `gateDecide` implementation); 7 native-hook gate adapters (grok/qoder/trae/codex/gemini/vibe/kiro) + opencode/pi TypeScript adapters (shipped with the package); per-harness gate manifest wiring; ~800 lines of bash eliminated.
  - The `os-init gates` concept landed (later superseded by the P6b `init harness` installer).

- osuperpowers P5 — CDD engine + CI + test scripts ported to Node (single-language closure).
  
  - All bash engine scripts (`cdd-common.sh` / `cdd-run.sh` / `cdd-exec.sh` / `cdd-select.sh` / `cdd-session-activate.sh`, ~3000 lines) migrated to Node (.mjs); core modules (harness registry, exit utils, templates, ledger, runner/contract H6 chain) ported.
  - `ci-validate.mjs` unifies the 12-block validate orchestration.
  - All shell tests and `rule-reference.test.py` migrated to `node:test` (engine + gate + init + utils module trees).
  - End state: single-language Node executable surface (bash/node dual-stack retired).

- osuperpowers P6 — engine/flow hardening + delivery completion (install-and-use honesty).
  
  - **Harness pre-checks (P6a)**: before entering a nested CLI in every mode (implement/review/fix), probe per-harness availability of the required skills plugins (superpowers / mattpocock-skills / `@oscaner-skills/*` — no submodule assumption) plus plan/brief/templates presence; missing → exit 3 (install-and-use channel) / stderr hint (init channel) + per-harness install guidance; spec/plan review now runs through the CLI review mode (cdd-exec dispatch, D1/D2/D3 mapping).
  - **Delivery completion (P6b)**: pi key completed (skills + gate TS extension); gemini mattpocock-extension assembly with error guard; qoder/codex plugin manifests completed → genuine install-and-use; `init harness` per-harness installer (harness-detect → multi-select → native config writes + skills copy + manifest full-sync `{ osuperpowersVersion, files: { path → { hash, source } } }`); grok moved to install-and-use (Claude marketplace).
  - **Research integration (P6c)**: mattpocock-skills:research woven into the brainstorming flow (explore-context delegates to a research agent + findings markdown).

- osuperpowers P7 — brand unification + legacy-naming cleanup (zero tech debt).
  
  **P7a — package dir rename + emit adaptation**: `packages/engineering` → `packages/osuperpowers`, `packages/superpowers-overrides` → `packages/osuperpowers-router`; package.json (name/repository.directory/description), `scripts/emit.mjs`, `scripts/ci-validate.mjs` and emit tests synced; `pnpm run emit` regenerates every derived manifest.
  
  **P7b — skill dir rename + namespace**: 9 `skills/os-*` directories lose the `os-` prefix (`os-brainstorming` → `brainstorming`, etc.); namespace unified to `osuperpowers:*` (router target table, SKILL.md references, `skills/init/` self-check table, `.agents/skills` copies); emit namespace name updated.
  
  **P7c — version management + release pipeline**: `version-packages.mjs` package name → `@oscaner-skills/osuperpowers`; `release.yml` tag prefixes → `osuperpowers-router@`/`osuperpowers@`; opencode config, issue-template labels, GitHub labels, `.changeset/README.md` residual references cleaned; consumed changesets removed.
  
  **P7d — legacy-naming zero-tech-debt purge**: emit function names (`engineeringClaudeHooks`/`engineeringCursorHooks`/`engineeringHooksFor`/`emitOsEngineering` → `osuperpowers*`) + metadata (category/keywords/description); runtime pending root `${TMPDIR}/osuperpowers/pending-cdd` (hard cut — fail-open safe); harness channel `os-init` → `init` (hints unified to `osuperpowers:init harness <name>`); install surface `bin/os-init` → `bin/init`, manifest `~/.osuperpowers/state/`, artifact names `osuperpowers.json`/`osuperpowers.ts`, `osuperpowersVersion`/`OSUPERPOWERS_VERSION`, vibe hook `osuperpowers-cdd-gate`; plugin docs / skill bodies / router docs fully cleaned (incl. deleting the SUPERSEDED `sdd-h6-reference.md`); acceptance lanes redesigned (`-i` token patterns + filename scan + whitelists, replacing the easy-to-miss per-line `-v` grep); historical P7 docs + overall spec closed out (rename-record mapping tables exempt). `version-packages.mjs` gains a real `--dry-run` and rejects unknown arguments.

## 6.2.0-overrides.0.15.3

### Patch Changes

- SDD orchestrator gate shell/workspace consistency + stale-workspace hijack prevention (issue [#53](https://github.com/Oscaner/skills/issues/53)). Read-only git diagnostics (`git status`/`git diff`/`git log`/`git show`/`git rev-parse`/`git branch`/`git remote`/`git ls-files`/`git diff-tree`) now allowed during active tasks, hardened against compound commands and mutating sub-verbs; deny message upgraded to a full allowlist matrix. Stale workspace hijack prevented via `TASK_BASE` git-object check and bound-workspace priority. Gate test fixtures isolated under `tests/fixtures/sdd-gate/`, full allow/deny matrix smoke test added and mounted in CI.


- Document why SDD CLI agents are not traceable via /resume — H6.6 in the reference doc + shell comments.


- Breaking: remove `--mode handoff` and `--segment` flag. Handoff write is now inline in implement/review/fix modes. ([#88](https://github.com/Oscaner/skills/issues/88))


## 6.2.0-overrides.0.15.2

### Patch Changes

- Add `spor-report-issue` standalone skill. After finishing a development session, `/spor-report-issue` analyses the conversation context, SDD ledgers, and git log to surface bugs and enhancement candidates, then offers to file them as GitHub issues via `gh issue create` with automatic `dogfood`, `superpowers-overrides`, and conditional `sdd` labels. Includes dedup detection against existing open issues and bilingual (EN/ZH) issue body templates.
  
  Also adds `.github/ISSUE_TEMPLATE/bug_report.yml` and `enhancement.yml` for structured web-UI issue creation with matching field names.

- Remove p0 fallback from spor-subagent-driven-development; CLI is now mandatory. When the CLI is unavailable the orchestrator reports BLOCKED with the script path, harness, and exit code — no silent fallback to in-session execution.
  
  Migrate all Cursor CLI calls from the editor-bundled `cursor agent` to the standalone `cursor-agent` binary across `sdd-run-task-cursor.sh`, `sdd-run-plan-cursor.sh`, and `scripts/smoke-provider-hooks.mjs`.

## 6.2.0-overrides.0.15.1

### Patch Changes

- BREAKING: Overrides version scheme is now three-segment `{superpowers-semver}-overrides.{major}.{minor}.{patch}` (e.g. `6.2.0-overrides.0.15.0`). Legacy single-counter `{base}-overrides.{N}` is rejected by release validation. Any superpowers semver segment change resets overrides to `{new-base}-overrides.0.0.0`.


## 6.2.0-overrides.0.15.0

### Patch Changes

- Version scheme: adopt three-segment overrides semver `{base}-overrides.{major}.{minor}.{patch}` (migrated from `6.2.0-overrides.15`).

## 6.2.0-overrides.15

### Patch Changes

- p0 handoff + lean code-review delegation


- p1 SDD CLI harness — plugin-bundled sdd-run-task/plan scripts (cursor+claude full, codex/copilot/gemini stubs), H6–H8, SDD Rule 7, templates, and validate checks


- p1-slim.1 spor-SDD on-disk slim — pointer-only Rule 0a/5b/5c, orchestrator checklist trimmed to ≤160 lines, CLI-default forbids upstream SDD skill body load


- p1-slim.2 SDD orchestrator gate — cross-harness PreToolUse (Cursor + Claude Code), shared gate lib + session activate, spor-SDD Rule 0a checklist, CI smoke tests, and synthetic dogfood plan


- p1-slim thin orchestrator — Rule 0 CLI-default vs p0 fallback branch, spor-executing-plans router, implement.md commit contract, Rule 5 split (5a/5b/5c)


## 6.2.0-overrides.14

### Patch Changes

- **Cursor attach-only enforce**
  - Detect writes pending only on upstream SKILL attach; slash commands no longer trigger preToolUse deny.
  - Pending includes `skill_suffix`; deny message references attach + agent_skills fullPath.
  - Docs and self-check template updated.

- **Fix Cursor `preToolUse` enforce rejecting valid spor Read first tools**
  
  - Cursor sends Read paths in `tool_input.file_path`; enforce only read `.path`, denying legitimate `Read(.../spor-*/SKILL.md)` calls after detect.
  - Coalesce `path // file_path` in enforce generator; regenerate `override-cursor-enforce.sh`.
  - Deny message now leads with Read (Cursor) and mentions Skill (Claude Code).
  - Shell test covers Cursor-shaped `file_path` payload; CURSOR-SMOKE / cross-harness docs updated.

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
