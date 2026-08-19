# osuperpowers

## 0.1.1

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

