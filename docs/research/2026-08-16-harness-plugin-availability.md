# Harness Plugin/Skills Availability — Detecting Installed Upstream Skills from the End-User Perspective

Research question: for the os-engineering plugin system, how do you detect **programmatically** whether the upstream skills plugins (`superpowers`, `mattpocock-skills`) — and the self-published `@oscaner-skills/*` plugins — are **available/installed** in each AI-coding harness, **from the END USER's perspective** (not the author's git-submodule setup in `vendors/`)?

Serves as the reference for the os-engineering **CDD pre-flight check**: what to probe per harness (paths / env / commands) and what install instruction to print when a required upstream skill plugin is missing.

**Verification basis**: primary sources (official docs, first-party repos) fetched **2026-08-16** for Claude Code, Cursor, Grok, OpenCode, Pi, Qoder, Codex, Gemini. Claims not re-fetched today are carried from `docs/research/2026-08-10-harness-marketplace-hooks.md` (fetched 2026-08-10/12) and `docs/research/2026-08-10-harness-hooks-matrix.md` (fetched 2026-08-13) and are flagged. Where a claim is unverifiable from primary sources it is marked **[unverified]**.

---

## 1. Executive summary

- **Every harness has a different "is it installed?" answer.** The reliable detection primitives are, in order of authority: (1) a **CLI/list command** if the harness has one (`claude plugin list --json`, `pi list`, `qoder plugins list`, `gemini extensions list`); (2) a **filesystem probe of the harness's documented skill/plugin directories**; (3) an **env-var probe** (`CLAUDE_PLUGIN_ROOT`, `GROK_PLUGIN_ROOT`) where a hook already knows its own plugin root.
- **Claude Code has the only fully machine-checkable install state**: `claude plugin list --json` (installed + marketplace + enablement), the versioned cache `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/`, and `enabledPlugins` in settings. **Cache presence ≠ enabled** — a pre-flight must check enablement too.
- **Cursor, Qoder, Gemini, Codex do not document a plugin-cache path or a plugin-list command that shows where on disk plugins live.** For those, skill-dir probing (`.cursor/skills/`, `.qoder/skills/`, `.gemini/skills/`, `.agents/skills/`) is the practical detection path, not the plugin manager.
- **`.agents/skills/` is the highest-leverage portable skill location** (read by Codex, Cursor, OpenCode — verified today — plus Gemini, Copilot, Pi, Rovo, Vibe, Grok per prior research). A pre-flight that treats `.agents/skills/` as a first-class probe covers most harnesses with one check.
- **`@oscaner-skills/*` npm packages map to distinct channels**: Pi (`pi install npm:…` + `pi` package key), OpenCode (`plugin` array in `opencode.json`, auto-installed into `~/.cache/opencode/node_modules/` — but **only as TS hook modules, skills are NOT auto-discovered from the npm package**), Claude Code (**only if** a marketplace entry uses an `npm` source — the current `oscaner/skills` marketplace uses relative-path sources, not npm). For Gemini, `superpowers` is natively installable (`gemini-extension.json` shipped upstream); `mattpocock-skills` is not.
- **The current CDD pre-flight only checks the harness CLI exists** (`registry.mjs` `checkHarness` → `cliInPath`). It does **not** check that upstream skill plugins are loadable in the orchestrator harness or the dispatched harness — exactly the gap where a nested session "胡乱完成任务" instead of failing early.

---

## 2. Per-harness: install channels, on-disk locations, detection

Legend — **Authoritative probe**: a command/config that tells you installed state. **Skill-dir probe**: filesystem path that must contain `<name>/SKILL.md` for the skill to be loadable. **[unverified]**: not confirmed from a primary source this session; from prior research or inferred.

### 2.1 Claude Code (source of truth)

| Aspect | Detail | Source |
|---|---|---|
| Install channels | Marketplace: `/plugin marketplace add <src>` then `/plugin install <plugin>@<marketplace>`. CLI equivalents: `claude plugin marketplace add`, `claude plugin install <plugin>@<marketplace> --scope <user\|project\|local>`. Standalone skills dir `~/.claude/skills/`. Dev: `claude --plugin-dir <dir>`, `--plugin-url <zip>`. | plugins, plugin-marketplaces, discover-plugins |
| On-disk plugin cache | `~/.claude/plugins/cache/<marketplace>/<plugin>/<resolved-version>/`. Example for this repo's marketplace (`name: "oscaner"`): `~/.claude/plugins/cache/oscaner-skills/superpowers/<version>/` and `.../oscaner/mattpocock-skills/<version>/`. Skills then at `<cache>/<plugin>/<version>/skills/<skill>/SKILL.md`. Marketplace state: `~/.claude/plugins/known_marketplaces.json`. | plugins-reference ("Cache Path Convention"), plugin-marketplaces ("Pre-populate plugins for containers" shows the seed dir mirrors `~/.claude/plugins` = `known_marketplaces.json` + `marketplaces/<name>/` + `cache/<marketplace>/<plugin>/<version>/`) |
| Version-named dir | The `<version>` segment is the **resolved version**: `plugin.json` `version` > marketplace `version` > git SHA > archive digest > **`unknown` for npm sources or non-git local dirs**. So a pre-flight should **glob** `cache/oscaner/superpowers/*/` rather than pin a version. | plugins-reference ("Version Management and Cache Derivation") |
| Enablement state | `enabledPlugins` in `~/.claude/settings.json` (user), `.claude/settings.json` (project), `.claude/settings.local.json` (local), managed. Cache presence ≠ enabled; `claude plugin list` reports enabled state. | plugins-reference ("Installation Scopes", "Where Config Values Are Stored") |
| **Authoritative probe** | `claude plugin list --json` (installed plugins; `--available` adds marketplace plugins, requires `--json`). `claude plugin marketplace list --json` (each entry has `installLocation` = local cache path). `claude plugin details <name>` (component inventory). | plugins-reference ("CLI Commands") |
| Skill-dir probe | `~/.claude/skills/<name>/SKILL.md` (standalone) + plugin `skills/` under the cache. | plugins |
| Env vars (hook-visible only) | `${CLAUDE_PLUGIN_ROOT}` = plugin install dir, `${CLAUDE_PLUGIN_DATA}` = `~/.claude/plugins/data/<id>/`, `${CLAUDE_PROJECT_DIR}` = project root. **Exported to hook / MCP / LSP subprocesses**, not documented for the main agent Bash env. | plugins-reference ("Environment Variables for Plugins") |
| **Detection recipe** | 1) `claude plugin list --json` and check for IDs `superpowers@oscaner-skills`, `mattpocock-skills@oscaner-skills`, `engineering@oscaner-skills`, `osuperpowers-router@oscaner-skills` (parse `enabled`/`disabled`). 2) Fallback filesystem: glob `~/.claude/plugins/cache/oscaner-skills/{superpowers,mattpocock-skills,engineering,osuperpowers-router}/*/` and require `<root>/skills/<name>/SKILL.md` for the specific skill needed (e.g. `superpowers/skills/executing-plans/SKILL.md`, `mattpocock-skills/skills/productivity/grilling/SKILL.md`). 3) Enablement: confirm in `enabledPlugins` of the applicable scope settings. | this research |

**Install instruction when missing:** `/plugin marketplace add Oscaner/skills` then `/plugin install superpowers@oscaner-skills`, `/plugin install mattpocock-skills@oscaner-skills` (and the already-installed `engineering@oscaner-skills` / `osuperpowers-router@oscaner-skills`).

### 2.2 Cursor

| Aspect | Detail | Source |
|---|---|---|
| Install channels | Team Marketplace (Dashboard → Plugins; "Add Marketplace" / "Import from Repo"); install from **Customize** sidebar with project/user scope. Local dev: copy or symlink a plugin into `~/.cursor/plugins/local/<name>/` (accepts Agent-Plugin root `plugin.json` or `.cursor-plugin/plugin.json`). `.cursor-plugin/marketplace.json` for multi-plugin repos. | cursor.com/docs/plugins |
| On-disk plugin cache | **No documented cache path for Team-Marketplace installs.** Only the local-dev dir `~/.cursor/plugins/local/` is documented. **[unverified: no CLI/JSON registry of installed team plugins]** | cursor.com/docs/plugins |
| Skill-loading dirs | `.agents/skills/`, `.cursor/skills/` (project); `~/.agents/skills/`, `~/.cursor/skills/` (user); compat `.claude/skills/`, `.codex/skills/`, `~/.claude/skills/`, `~/.codex/skills/`. Recursively walks each root for `SKILL.md`. | cursor.com/docs/context/skills |
| **Authoritative probe** | **None documented.** UI only (Customize → Skills). | cursor.com/docs/plugins, cursor.com/docs/context/skills |
| **Detection recipe** | Probe skill dirs for the specific upstream skills: `superpowers/skills/{executing-plans,subagent-driven-development,...}/SKILL.md` and `mattpocock-skills/skills/productivity/grilling/SKILL.md` (or `engineering/tdd/SKILL.md`), under `.cursor/skills/`, `.agents/skills/`, `~/.cursor/skills/`, `~/.agents/skills/`, `.claude/skills/`, `~/.claude/skills/`. Also probe `~/.cursor/plugins/local/` for the plugin dirs. | this research |
| **Install instruction when missing** | Install from the Team Marketplace (Dashboard → Plugins), or directory-copy the skill folders into `.cursor/skills/` / `.agents/skills/`. | this research |

### 2.3 Grok Build

| Aspect | Detail | Source |
|---|---|---|
| Install channels | TUI extensions modal (`/plugins`); marketplace sources `[[marketplace.sources]]` in `~/.grok/config.toml` or `~/.grok/plugins/known_marketplaces.json`; `--plugin-dir <PATH>`; skill folders in `./.grok/skills/` / `~/.grok/skills/`. **Claude-Code compatible**: reads `.claude-plugin` marketplaces, plugins, skills, hooks as-is ("fully compatible with Claude Code with zero configuration"). | docs.x.ai/build/features/skills-plugins-marketplaces |
| On-disk locations | Plugins: `./.grok/plugins/`, `~/.grok/plugins/`, marketplace installs under `~/.grok/plugins/marketplaces/`, `[plugins] paths` in config.toml. Skills: `./.grok/skills/`, `~/.grok/skills/`, any enabled plugin's `skills/`, `[skills] paths`, `.agents/skills/`, `.claude/skills/`, `.cursor/skills/`. | docs.x.ai/build/features/skills-plugins-marketplaces (+ prior research) |
| Env var | Plugin hooks receive `GROK_PLUGIN_ROOT` and `GROK_PLUGIN_DATA`. | docs.x.ai/build/features/skills-plugins-marketplaces |
| **Authoritative probe** | TUI only (extensions modal). No CLI list command documented. Config `~/.grok/config.toml` lists `[plugins] paths` / `[skills] paths`. | docs.x.ai/build/features/skills-plugins-marketplaces |
| **Detection recipe** | Because Grok reads Claude Code plugins, first try the Claude Code cache: `~/.claude/plugins/cache/oscaner-skills/{superpowers,mattpocock-skills}/*/skills/`. Then probe `~/.grok/plugins/marketplaces/`, `~/.grok/skills/`, `.grok/skills/`, `.agents/skills/` for the specific skill dirs. | this research |
| **Install instruction when missing** | `grok` → `/plugins` → install from the oscaner marketplace source, or rely on `claude plugin install` (Grok reads the Claude cache), or copy skill folders into `~/.grok/skills/` / `.grok/skills/`. | this research |

### 2.4 OpenCode

| Aspect | Detail | Source |
|---|---|---|
| Install channels | npm packages via `plugin` array in `opencode.json` (auto-installed with Bun at startup). Local plugin dirs `.opencode/plugins/` + `~/.config/opencode/plugins/` (auto-loaded). **No marketplace.json registry.** | opencode.ai/docs/plugins |
| Where npm plugin code lives | `~/.cache/opencode/node_modules/` (Bun-installed npm plugin deps). | opencode.ai/docs/plugins |
| Skill-loading dirs | `.opencode/skills/`, `.claude/skills/`, `.agents/skills/` (walking up to git root); global `~/.config/opencode/skills/`, `~/.claude/skills/`, `~/.agents/skills/`. | opencode.ai/docs/skills |
| **Key nuance for skills** | OpenCode's `plugin` array loads **TS hook modules only** — it does **not** auto-discover `SKILL.md` from the npm package's `skills/`. Skills load from the skill directories, not from plugins. So `@oscaner-skills/superpowers` in `plugin: [...]` would load nothing unless it exports a plugin function; its skills need directory copy (or symlink) into a skill dir. **[verified: plugins page shows TS-module shape; skills page shows skill dirs only]** | opencode.ai/docs/plugins, opencode.ai/docs/skills |
| **Authoritative probe** | **None documented** (no `opencode plugins` list command). Verification is via the cache dir or startup output. | opencode.ai/docs/plugins |
| **Detection recipe** | Probe skill dirs (`.opencode/skills/`, `.agents/skills/`, `.claude/skills/`, `~/.config/opencode/skills/`) for `superpowers/*/SKILL.md` and `mattpocock-skills` skill names. Optionally probe `~/.cache/opencode/node_modules/@oscaner-skills/*/` to confirm the npm package is installed. | this research |
| **Install instruction when missing** | Add `@oscaner-skills/superpowers` / `@oscaner-skills/mattpocock-skills` to `plugin` in `opencode.json` (loads the module, if any) **and** copy the skill folders into `.agents/skills/` (or `.opencode/skills/`). The portable, guaranteed path is copying skills into `.agents/skills/`. | this research |

### 2.5 Pi

| Aspect | Detail | Source |
|---|---|---|
| Install channels | `pi install npm:@x / git:host/repo / path:/dir`. Package = `package.json` `pi` key (delivers `skills/`, `extensions/`, `prompts/`, `themes/`) or convention dirs. Filtering via settings `packages` array. | badlogic/pi-mono packages.md |
| On-disk locations | npm (user): `~/.pi/agent/npm/`; npm (project): `.pi/npm/`; git (user): `~/.pi/agent/git/<host>/<path>`; git (project): `.pi/git/...`. Settings: `~/.pi/agent/settings.json` + `.pi/settings.json`. Skill dirs: `.pi/skills/`, `~/.pi/agent/skills/`, `.agents/skills/`. | badlogic/pi-mono packages.md (+ prior research) |
| **Authoritative probe** | `pi list` — "show installed packages from settings". `pi config` toggles enabled extensions/skills/prompts/themes. | badlogic/pi-mono packages.md |
| **Detection recipe** | 1) `pi list` → look for `@oscaner-skills/superpowers`, `@oscaner-skills/mattpocock-skills`. 2) Filesystem: `~/.pi/agent/npm/@oscaner-skills/{superpowers,mattpocock-skills}/skills/` (user) or `.pi/npm/...` (project). 3) Skill dirs `.pi/skills/`, `~/.pi/agent/skills/`, `.agents/skills/` for the specific skill names. | this research |
| **Install instruction when missing** | `pi install npm:@oscaner-skills/superpowers npm:@oscaner-skills/mattpocock-skills` (both vendored packages carry the `pi` key with `skills: ["./skills"]`). `@oscaner-skills/engineering` has **no** `pi` key — its skills must be directory-copied to `.pi/skills/` or `.agents/skills/`. | publish-vendor.mjs `assemblePackageJson` / `piPackageKey`; packages/osuperpowers/package.json |

### 2.6 Gemini CLI

| Aspect | Detail | Source |
|---|---|---|
| Install channels | `gemini extensions install <git-url-or-local-path>` → copy into `<home>/.gemini/extensions`. `gemini extensions link <path>` for local symlink. `gemini extensions list` to verify. | geminicli.com/docs/extensions/reference |
| On-disk locations | `<home>/.gemini/extensions/<name>/` (each with `gemini-extension.json` at root). Skill dirs: `.gemini/skills/`, `~/.gemini/skills/`, `.agents/skills/`. | geminicli.com/docs/extensions/reference (+ prior research) |
| Env var | `${extensionPath}` = absolute path to the extension directory (usable in `gemini-extension.json` and `hooks/hooks.json`). | geminicli.com/docs/extensions/reference |
| **Authoritative probe** | `gemini extensions list` (terminal) or `/extensions list` (interactive). | geminicli.com/docs/extensions/ |
| **Detection recipe** | 1) `gemini extensions list` → check for `superpowers` (upstream ships `gemini-extension.json`) and `engineering` (this repo emits one). 2) Filesystem: `~/.gemini/extensions/superpowers/skills/...` and `~/.gemini/extensions/engineering/skills/...`. 3) Skill dirs `.gemini/skills/`, `~/.gemini/skills/`, `.agents/skills/` for `superpowers` and `mattpocock-skills` skill names. | this research |
| **Install instruction when missing** | `gemini extensions install github.com/Oscaner/skills` (installs engineering via its emitted `gemini-extension.json`; the vendored `superpowers` also ships one). `mattpocock-skills` has **no** `gemini-extension.json` — copy its skill folders into `~/.gemini/skills/` or `.agents/skills/`. | gate-install.md (Gemini channel); vendored superpowers `gemini-extension.json`; vendored mattpocock has no gemini manifest |

### 2.7 Qoder

| Aspect | Detail | Source |
|---|---|---|
| Install channels | `.qoder-plugin/plugin.json` (only `name` required). Interactive `/plugins install <plugin>`; CLI `qoder plugins install <plugin>`, `--plugin-dir <path>`. `marketplace.json` (name/owner/plugins; source can be relative, npm, git, github, url). | docs.qoder.com/cli/plugins-reference.md |
| On-disk plugin cache | **Not documented** in the plugins reference. Only the plugin source layout (`.qoder-plugin/plugin.json`, `skills/`, `hooks/hooks.json`, `bin/`, …) is documented. | docs.qoder.com/cli/plugins-reference.md |
| Skill-loading dirs | `skills/<skill>/SKILL.md` inside a plugin; prior research documented `.qoder/skills/` (project) + `~/.qoder/skills/` (user) from the Qoder CLI Skills doc — **the plugins-reference page fetched today does not mention them [unverified from this page]** | docs.qoder.com/cli/plugins-reference.md (+ prior research) |
| Env var | `QODER_PLUGIN_ROOT`/`QODER_PLUGIN_DATA` were documented in prior research (hooks matrix); **not confirmed on the plugins-reference page fetched today [unverified from this page]** | prior research (hooks matrix) |
| **Authoritative probe** | `qoder plugins list` — "List installed plugins". | docs.qoder.com/cli/plugins-reference.md |
| **Detection recipe** | 1) `qoder plugins list`. 2) Probe `.qoder/skills/`, `~/.qoder/skills/`, `.agents/skills/` for the upstream skill names. | this research |
| **Install instruction when missing** | `qoder plugins install <plugin>` from a marketplace, or copy skill folders into `~/.qoder/skills/` / `.qoder/skills/`. | this research |

### 2.8 Codex

| Aspect | Detail | Source |
|---|---|---|
| Install channels | `/plugins` browser (plugin catalog shared with ChatGPT). `.codex-plugin/plugin.json` manifest; marketplace sources (universal OpenAI directory, local marketplace for dev). Skills via `$skill-installer`, `$skill-creator`, or directory copy. | learn.chatgpt.com/docs/plugins, /docs/build-skills |
| On-disk plugin cache | **Not documented** on the fetched pages (`/docs/plugins` is nav-heavy; the build page would cover it). **[unverified: exact installed-plugin cache path]** | learn.chatgpt.com/docs/plugins |
| Skill-loading dirs | `.agents/skills` (CWD → repo root), `$HOME/.agents/skills` (USER), `/etc/codex/skills` (ADMIN), system (bundled). | learn.chatgpt.com/docs/build-skills |
| **Authoritative probe** | **None documented** (no `codex skills list`); `/plugins` browser shows installed state via Space toggle. | learn.chatgpt.com/docs/plugins |
| **Detection recipe** | Probe skill dirs for `superpowers` and `mattpocock-skills` skill names: `.agents/skills/`, `~/.agents/skills/`, `/etc/codex/skills` (admin, likely not writable). | learn.chatgpt.com/docs/build-skills |
| **Install instruction when missing** | Copy the skill folders into `.agents/skills/` (repo-level; works with `$HOME/.agents/skills` for user-global). A `.codex-plugin` package is the heavier distribution path. | this research |

### 2.9 `.agents/skills/` — the shared portable location

The cross-harness convention. Verified today that **Codex**, **Cursor**, and **OpenCode** read `.agents/skills/` (project) and `~/.agents/skills/` (user). Prior research (2026-08-10) adds Gemini, Copilot, Pi, Rovo, Vibe, Grok as readers. A pre-flight that probes `.agents/skills/` + `~/.agents/skills/` once covers the majority of harnesses.

---

## 3. How the self-published `@oscaner-skills/*` packages are installed + detected per harness

The repo publishes via `scripts/lib/publish-vendor.mjs` (vendored: `@oscaner-skills/superpowers`, `@oscaner-skills/mattpocock-skills`, `@oscaner-skills/impeccable`, each with `contentRoot` + `pi` key `{skills: ["./skills"]}`) and first-party `@oscaner-skills/engineering` + `@oscaner-skills/osuperpowers-router` (with `oscaner-plugin` field; `engineering` also sets `main: ./bin/gate/adapters/opencode.mjs`). The vendored assemblies keep `.claude-plugin/plugin.json` at the package root (both superpowers and mattpocock-skills ship one in-tree), so each npm package is itself a valid Claude Code plugin directory.

| Harness | `@oscaner-skills/*` install channel | Detect as | Source |
|---|---|---|---|
| **Claude Code** | Only via a marketplace entry with an `npm` source (`source: {source: "npm", package: "@oscaner-skills/..."}`). The current `.claude-plugin/marketplace.json` uses **relative-path** sources (`./packages/osuperpowers`, `./vendors/...`) — so today users install from the git marketplace `Oscaner/skills`, not npm. | `claude plugin list --json`; cache glob `~/.claude/plugins/cache/oscaner-skills/{superpowers,mattpocock-skills,engineering,osuperpowers-router}/*/`. npm-source version resolves to `unknown` unless pinned (plugins-reference) — glob, don't pin. | plugin-marketplaces (npm sources), plugins-reference (version resolution), this repo's marketplace.json |
| **Cursor** | Team Marketplace (git import) or directory copy; no npm channel documented. | skill-dir probe (`.cursor/skills/`, `.agents/skills/`). | cursor docs |
| **Grok** | Reads the Claude Code marketplace/plugin cache as-is (zero-config). | `~/.claude/plugins/cache/oscaner-skills/...`, `~/.grok/plugins/marketplaces/`, `~/.grok/skills/`. | docs.x.ai |
| **OpenCode** | `plugin: ["@oscaner-skills/superpowers", ...]` in `opencode.json` → Bun-installs into `~/.cache/opencode/node_modules/`. **But skills are not auto-discovered from npm packages** — skills need directory copy to a skill dir. | probe `~/.cache/opencode/node_modules/@oscaner-skills/*/` + skill dirs. | opencode.ai/docs/plugins, /docs/skills |
| **Pi** | `pi install npm:@oscaner-skills/superpowers` (vendored packages carry the `pi` key). | `pi list`; `~/.pi/agent/npm/@oscaner-skills/*/skills/` (user), `.pi/npm/...` (project). | badlogic/pi-mono packages.md; publish-vendor.mjs |
| **Gemini** | `gemini extensions install github.com/Oscaner/skills` (engineering + superpowers have `gemini-extension.json`). | `gemini extensions list`; `~/.gemini/extensions/{engineering,superpowers}/`. | geminicli.com/docs/extensions/reference |
| **Qoder** | Marketplace install of `.qoder-plugin`; no npm channel documented. | `qoder plugins list`; skill dirs. | docs.qoder.com |
| **Codex** | `.codex-plugin` plugin or directory copy of skills. | skill dirs (`.agents/skills/`, `~/.agents/skills/`). | learn.chatgpt.com |

---

## 4. Detection-methods summary table

| Harness | Authoritative CLI/JSON | Filesystem probe (most reliable) | Env-var probe | Install instruction to print |
|---|---|---|---|---|
| **Claude Code** | `claude plugin list --json` (enabled state), `claude plugin marketplace list --json` (`installLocation`), `claude plugin details <name>` | `~/.claude/plugins/cache/oscaner-skills/{superpowers,mattpocock-skills,engineering,osuperpowers-router}/*/skills/<skill>/SKILL.md` + `enabledPlugins` in settings | `$CLAUDE_PLUGIN_ROOT` (hook-only; sibling = `$CLAUDE_PLUGIN_ROOT/../<plugin>/`) | `/plugin marketplace add Oscaner/skills` + `/plugin install <plugin>@oscaner-skills` |
| **Cursor** | none documented | `.cursor/skills/`, `.agents/skills/`, `~/.cursor/skills/`, `~/.agents/skills/`, `.claude/skills/`; `~/.cursor/plugins/local/` | — | Team Marketplace install or copy skills to `.agents/skills/` |
| **Grok** | none (TUI `/plugins`) | `~/.claude/plugins/cache/oscaner-skills/…`, `~/.grok/plugins/marketplaces/`, `~/.grok/skills/`, `.grok/skills/`, `.agents/skills/` | `$GROK_PLUGIN_ROOT` (hook-only) | `grok` → `/plugins`; or copy skills to `~/.grok/skills/` |
| **OpenCode** | none documented | `.opencode/skills/`, `.agents/skills/`, `.claude/skills/`, `~/.config/opencode/skills/`; `~/.cache/opencode/node_modules/@oscaner-skills/*/` | — | add to `plugin` array + copy skills to `.agents/skills/` |
| **Pi** | `pi list` | `~/.pi/agent/npm/@oscaner-skills/*/skills/`, `.pi/npm/`, `.pi/skills/`, `~/.pi/agent/skills/`, `.agents/skills/` | — | `pi install npm:@oscaner-skills/superpowers npm:@oscaner-skills/mattpocock-skills` |
| **Gemini** | `gemini extensions list` | `~/.gemini/extensions/{engineering,superpowers}/skills/`; `.gemini/skills/`, `~/.gemini/skills/`, `.agents/skills/` | `$extensionPath` | `gemini extensions install github.com/Oscaner/skills` (+ copy mattpocock skills) |
| **Qoder** | `qoder plugins list` | `.qoder/skills/`, `~/.qoder/skills/`, `.agents/skills/` | `$QODER_PLUGIN_ROOT` [unverified] | `qoder plugins install` or copy skills to `~/.qoder/skills/` |
| **Codex** | none documented | `.agents/skills/`, `~/.agents/skills/`, `/etc/codex/skills` | — | copy skills to `.agents/skills/` |
| **`.agents/skills/` (shared)** | n/a | `.agents/skills/<plugin>/<skill>/SKILL.md` + `~/.agents/skills/…` — one probe covers Codex/Cursor/OpenCode (+ Gemini/Pi/Grok/Copilot/Rovo/Vibe per prior research) | — | copy skill folders into `.agents/skills/` |

---

## 5. Implications for the CDD pre-flight check

The current pre-flight (`packages/osuperpowers/bin/engine/lib/registry.mjs` `checkHarness`) verifies only: harness known → `ship == "full"` → CLI in PATH (`cliInPath`). It returns `CddBlockedError` with `kind: "cli-missing"` (exit 2). There is **no** check for upstream skill availability — the gap this research targets.

**Recommended addition — a second gate after the CLI check**, `checkUpstreamSkills(harness, required)`, probing the **current (orchestrator) harness** for the skill plugins the os-* orchestrator will Read/delegate to:

**Required upstream skills** (from `packages/osuperpowers/skills/os-*/SKILL.md`):
- `superpowers` — os-* "Read Upstream" resolves `{plugin-root}/../superpowers/skills/<name>/SKILL.md` (fallback `<repo-root>/vendors/superpowers/…`, author-only).
- `mattpocock-skills` — delegates: `tdd`, `to-tickets`, `grilling`, `code-review`, `diagnosing-bugs`, `research`. Concrete probe names: `superpowers/skills/executing-plans/SKILL.md`, `mattpocock-skills/skills/engineering/tdd/SKILL.md` + `mattpocock-skills/skills/productivity/grilling/SKILL.md`.
- First-party `@oscaner-skills/engineering` (self — always present when the gate runs) and `@oscaner-skills/osuperpowers-router` (router; needed for slash-trigger routing in Claude Code/Cursor).

**Per-harness probe + failure behavior** (mirror `checkHarness`'s structured `CddBlockedError`):

| Harness (registry key) | Probe (in priority order) | On missing → print |
|---|---|---|
| `claude` | `claude plugin list --json` → IDs `superpowers@oscaner-skills`/`mattpocock-skills@oscaner-skills` (check enabled). Fallback glob `~/.claude/plugins/cache/oscaner-skills/{superpowers,mattpocock-skills}/*/skills/…`. | `/plugin marketplace add Oscaner/skills` then `/plugin install superpowers@oscaner-skills` + `/plugin install mattpocock-skills@oscaner-skills`; then `/reload-plugins` |
| `cursor-agent` | Probe `.cursor/skills/`, `.agents/skills/`, `~/.cursor/skills/`, `~/.agents/skills/` for the two skill names. | Install from Team Marketplace, or copy skill folders into `.agents/skills/` (covers Cursor + Codex + OpenCode + most others) |
| `droid` | Probe the shared skill dirs (`.agents/skills/` + project skill dirs) — droid reads `.agents/skills/` per prior research. | copy skills into `.agents/skills/` |
| `pi` | `pi list` → `@oscaner-skills/{superpowers,mattpocock-skills}`; fallback `~/.pi/agent/npm/@oscaner-skills/*/skills/` + `.pi/skills/`, `.agents/skills/`. | `pi install npm:@oscaner-skills/superpowers npm:@oscaner-skills/mattpocock-skills` (engineering skills: copy to `.pi/skills/`) |
| `codex` | Probe `.agents/skills/`, `~/.agents/skills/`, `/etc/codex/skills`. | copy skills into `.agents/skills/` |
| `gemini` | `gemini extensions list` → `superpowers`/`engineering`; fallback `~/.gemini/extensions/…/skills/` + `.gemini/skills/`, `~/.gemini/skills/`. | `gemini extensions install github.com/Oscaner/skills`; copy mattpocock skills to `~/.gemini/skills/` |
| `qoder` | `qoder plugins list`; fallback `.qoder/skills/`, `~/.qoder/skills/`, `.agents/skills/`. | `qoder plugins install` from the marketplace, or copy skills to `~/.qoder/skills/` |
| `grok` | Claude cache `~/.claude/plugins/cache/oscaner-skills/…` + `~/.grok/skills/`, `.grok/skills/`. | `grok` → `/plugins`, or copy skills to `~/.grok/skills/` |

**Design guidance for the gate:**
1. **Probe order = authority order**: CLI/list command → filesystem glob → (hook env vars only when the check runs inside a hook). Do not rely on `$CLAUDE_PLUGIN_ROOT` outside a hook context — it is exported only to hook/MCP/LSP subprocesses, not documented for the agent's Bash tool.
2. **Glob version dirs, never pin**: `cache/<marketplace>/<plugin>/<version>/` — the `<version>` segment changes on update and is `unknown` for npm sources. Use `*`.
3. **Distinguish "not installed" from "disabled"**: in Claude Code, a plugin can be cached but disabled. If the authoritative list is unavailable, additionally check `enabledPlugins` in the applicable scope settings.
4. **`.agents/skills/` is the cheap universal probe** — one existence check there (plus `~/.agents/skills/`) covers Codex/Cursor/OpenCode/Gemini/Pi/Grok/Copilot/Rovo/Vibe. Recommend the pre-flight treat it as the shared fallback and, when skills are missing, print the single copy-to-`.agents/skills/` instruction.
5. **Fail behavior should be strict, not silent**: the existing os-* skills degrade silently when upstream is missing (subagent-lifecycle "Delegate Load Failure" → "plugin 整体缺失 → 静默降级"). The pre-flight is the place to turn that into an **early, loud failure** (exit code distinct from `cli-missing`, e.g. new `kind: "skills-missing"`) with the install instruction, before any nested task session runs and "胡乱完成任务."
6. **Check the dispatch target too**: when the cdd engine dispatches into a sub-harness CLI (`invoke`), that CLI's session also needs the upstream skills. Re-run the same probe against the target harness's skill dirs, not just the orchestrator harness.

---

## 6. Unverifiable / flagged items

- **Cursor Team-Marketplace installed-plugin on-disk path and CLI list** — not documented on cursor.com/docs/plugins (only `~/.cursor/plugins/local/` for local dev). Detection for team-marketplace installs is therefore skill-dir probing, not a plugin inventory.
- **Qoder on-disk plugin cache + `~/.qoder/skills` + `QODER_PLUGIN_ROOT`** — the plugins-reference page fetched today documents `qoder plugins list` but neither a cache path nor the global skills dir; the global skills dir and `QODER_PLUGIN_ROOT` come from prior research (Qoder CLI Skills doc, hooks matrix). **[from prior research]**
- **Codex installed-plugin on-disk path** — not on the fetched `/docs/plugins` overview (nav-heavy; the build page is not fetched). `.codex-plugin/plugin.json` layout and skill paths are verified from the skills doc.
- **`CLAUDE_CODE_PLUGIN_CACHE_DIR`** — documented on the plugin-marketplaces page (pre-populating a seed dir during a build), but the plugins-reference page states the cache path is fixed at `~/.claude/plugins/cache` with no override listed. Treat the cache dir as `~/.claude/plugins/cache` for detection; the env var is a build-time seed mechanism, not a runtime detection path.
- **OpenCode npm plugins do not auto-load `skills/`** — the plugins page shows the plugin module shape (TS hooks) and the skills page shows only skill-directory discovery. Confirmed enough to state that npm-package skills require directory copy; the exact loader behavior for a package that exports both a plugin function and a `skills/` dir is not explicitly documented.
- **`.agents/skills/` full reader list** — verified today for Codex/Cursor/OpenCode; the rest (Gemini/Copilot/Pi/Rovo/Vibe/Grok) rely on prior research (2026-08-10).

---

## Sources

### Fetched this session (2026-08-16, primary)
- Claude Code — Plugins: https://code.claude.com/docs/en/plugins
- Claude Code — Plugin marketplaces (schema, sources incl. npm, cache/seed layout): https://code.claude.com/docs/en/plugin-marketplaces
- Claude Code — Plugins reference (cache path `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/`, env vars `CLAUDE_PLUGIN_ROOT`/`CLAUDE_PLUGIN_DATA`, scopes, `claude plugin list`/`marketplace list`/`details`): https://code.claude.com/docs/en/plugins-reference
- Claude Code — Discover and install plugins (`/plugin install <name>@<marketplace>`, scopes, `enabledPlugins`): https://code.claude.com/docs/en/discover-plugins
- Cursor — Plugins (Team Marketplace, `~/.cursor/plugins/local/`, agent-plugins.org): https://cursor.com/docs/plugins
- Cursor — Skills (`.cursor/skills/`, `.agents/skills/`, `.claude/skills/`): https://cursor.com/docs/context/skills
- Grok Build — Skills/plugins/marketplaces (`.grok/skills/`, `~/.grok/plugins/`, Claude-compat, `GROK_PLUGIN_ROOT`): https://docs.x.ai/build/features/skills-plugins-marketplaces
- OpenCode — Skills (`.opencode/skills/`, `.claude/skills/`, `.agents/skills/`): https://opencode.ai/docs/skills/
- OpenCode — Plugins (`plugin` array, `~/.cache/opencode/node_modules/`, TS modules): https://opencode.ai/docs/plugins/
- Pi — Packages (`pi install npm:…`, `pi` key, `~/.pi/agent/npm/`, `pi list`): https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/packages.md
- Qoder — Plugins reference (`/plugins`, `qoder plugins list`, `.qoder-plugin/plugin.json`): https://docs.qoder.com/cli/plugins-reference.md
- Codex — Plugins (`/plugins`, plugin catalog): https://learn.chatgpt.com/docs/plugins
- Codex — Build skills (`.agents/skills/`, `$HOME/.agents/skills`, `/etc/codex/skills`): https://learn.chatgpt.com/docs/build-skills
- Gemini CLI — Extensions overview (`gemini extensions install/list`): https://geminicli.com/docs/extensions/
- Gemini CLI — Extensions reference (`<home>/.gemini/extensions`, `gemini-extension.json`, `${extensionPath}`): https://geminicli.com/docs/extensions/reference

### Repo-local cross-reference
- `docs/research/2026-08-10-harness-marketplace-hooks.md` — prior harness capability matrix (skill dirs, install channels for Copilot/Rovo/Vibe/Kiro/Trae, `.agents/skills/` reader list)
- `docs/research/2026-08-10-harness-hooks-matrix.md` — per-harness hooks + trust ceremonies (verified 2026-08-13)
- `docs/gate-install.md` — per-harness gate install channels + trust ceremonies (claude/cursor/grok/qoder/gemini/trae/vibe/kiro/pi/opencode/codex)
- `packages/osuperpowers/bin/engine/lib/registry.mjs` + `harness-registry.json` — current CDD pre-flight (`checkHarness` → CLI presence only)
- `packages/osuperpowers/bin/init/install-gates.mjs` — per-harness detection (`commandExists`, `~/.trae` dir check) and guide/trust text
- `packages/osuperpowers/skills/os-*/SKILL.md` — "Read Upstream" (claude `$CLAUDE_PLUGIN_ROOT/../superpowers/…`, fallback `<repo-root>/vendors/superpowers/…`) + mattpocock delegate list
- `packages/osuperpowers/docs/subagent-lifecycle.md` — "Rule: Delegate Load Failure" (silent degradation when a plugin is wholly missing)
- `scripts/lib/publish-vendor.mjs` — vendored `@oscaner-skills/*` assembly (`contentRoot`, `pi` key `{skills:["./skills"]}`)
- `packages/osuperpowers/package.json` / `packages/osuperpowers-router/package.json` — first-party npm package metadata (`oscaner-plugin`, `main` → opencode adapter)
- `.claude-plugin/marketplace.json` / `marketplace/source.json` — marketplace `name: "oscaner"`, plugin names (`superpowers`, `mattpocock-skills`, `engineering`, `osuperpowers-router`, `impeccable`), relative-path sources (not npm)
- Vendored submodules: `vendors/superpowers/` (has `.claude-plugin/plugin.json` + `gemini-extension.json`), `vendors/mattpocock-skills/` (has `.claude-plugin/plugin.json`, no gemini manifest), `vendors/impeccable/plugin/`
