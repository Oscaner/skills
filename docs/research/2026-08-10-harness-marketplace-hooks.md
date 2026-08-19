# Harness Marketplace / Hooks / Skills / Instruction-File Reference

Research question: for all ~15 harnesses (claude, cursor, gemini, pi, codex, agents, grok, opencode, trae, trae-cn, rovodev, qoder, github, vibe, kiro), what are the marketplace/plugin-manifest, hooks, skill-loading, and instruction-file capabilities — and what must the root marketplace, osuperpowers-router (trigger router), and engineering (skill emit + gate) each add per harness?

Serves as the reference doc for the engineering P3 `build.js` multi-harness emit and the P3/P4 scoping decision.

**Verification basis**: primary sources (official docs, first-party repos) fetched 2026-08-10/12. Cross-checked against the impeccable plugin's prior research (`plugins/impeccable/docs/HARNESSES.md`, last verified 2026-07; `plugins/impeccable/scripts/lib/transformers/providers.js`). Where a claim disagrees with impeccable's table, the newer primary source wins and is flagged.

---

## 1. Harness matrix

Legend — Marketplace: `plugin-manifest` (native manifest for installing plugin-style packages), `dir-copy` (no manifest, copy skills into a directory), `none` (no distribution mechanism). Hooks: the lifecycle/prompt-interception surface. Skill loading: native skill directory. Instruction file: always- or auto-loaded project instruction file (the carrier for a self-check/trigger table).

| Harness | Marketplace / plugin manifest | Hooks (events) | Skill loading | Instruction file |
|---|---|---|---|---|
| **Claude Code** | Yes — `.claude-plugin/plugin.json`; marketplace `.claude-plugin/marketplace.json` (multi-plugin repos); install `/plugin install`. Components: `skills/ commands/ agents/ hooks/hooks.json .mcp.json .lsp.json monitors/ bin/ settings.json`. Plugin skills namespaced `/plugin:skill`. `CLAUDE_PLUGIN_ROOT` env. | ~30 events: `SessionStart`, `UserPromptSubmit`, **`UserPromptExpansion`** (the only prompt-expansion hook in any harness), `PreToolUse` (blocking), `PostToolUse`, `PermissionRequest`, `Stop`, `SubagentStart/Stop`, `InstructionsLoaded`, etc. Config: `.claude/settings.json` or plugin `hooks/hooks.json`. Matcher: exact list or regex. | `.claude/skills/` (standalone) + plugin `skills/` (namespaced). SKILL.md + frontmatter; runtime `$ARGUMENTS` substitution. | `CLAUDE.md` (+ `.claude/rules/*.md`, loaded via `InstructionsLoaded`). |
| **Cursor** | Yes — `.cursor-plugin/plugin.json` (Cursor Plugin layout) or root `plugin.json` (agent-plugins.org). Team Marketplace (Dashboard → Plugins); `.cursor-plugin/marketplace.json` for multi-plugin repos. Components: `rules/ agents/ commands/ skills/ hooks mcp.json variables`. | `hooks.json` at `.cursor/hooks.json` (project; also Enterprise/Team/User levels). Events: `sessionStart/end`, **`preToolUse`** (blocking), `postToolUse`, `subagentStart/Stop`, `beforeSubmitPrompt` (= UserPromptExpansion analog), `beforeShellExecution`, `beforeMCPExecution`, `beforeReadFile`/`afterFileEdit`, `preCompact`, `stop`, `afterAgentResponse`, `workspaceOpen`. Loads Claude Code hooks too. | `.cursor/skills/` + `.agents/skills/` + `.claude/skills/` (compat). Frontmatter: `name`, `description`, `paths`, `disable-model-invocation`, `metadata`. | `.cursor/rules/*.mdc` (inclusion modes incl. Always). |
| **Gemini CLI** | Extensions (no registry): `gemini-extension.json` at extension root; `gemini extensions install <GitHub-URL>`. Components: `skills/` (SKILL.md), `hooks/hooks.json`, `commands/` (TOML), `agents/` (sub-agents, preview), `themes`, `policies/`, MCP. Installed to `<home>/.gemini/extensions`. | 11 events: `SessionStart`, `SessionEnd`, `BeforeAgent`, `AfterAgent`, `BeforeModel`, `AfterModel`, `BeforeToolSelection`, **`BeforeTool`** (blocking), `AfterTool`, `PreCompress`, `Notification`. Config: `settings.json` `"hooks"` key (project `.gemini/settings.json`, user, system) or extension `hooks/hooks.json`. Project hooks are fingerprinted (untrusted on change). | `.gemini/skills/` + `.agents/skills/` alias; `~/.gemini/skills/`. Only `name` + `description` validated. `activate_skill` tool; `gemini skills install <repo>`. | `GEMINI.md` (`~/.gemini/GEMINI.md` + workspace/JIT scan; filename configurable via `context.fileName`, can be `AGENTS.md`). `.gemini/commands/*.toml` custom commands. |
| **Pi** | Yes (packages): `pi install npm:@x / git:host/repo / path`. Package = `package.json` `pi` key or conventional dirs (`skills/ extensions/ prompts/ themes/`). Settings `~/.pi/agent/settings.json` + `.pi/settings.json`. | No CLI hooks manifest. **Extensions** (TS) subscribe to lifecycle events: `input` (intercept/transform prompt), `tool_call` (blockable), `before_agent_start`, `context` (modify messages), `session_start`, `tool_execution_*`, etc. Extensions in `~/.pi/agent/extensions/` + `.pi/extensions/`. | `.pi/skills/` + `.agents/skills/`; `~/.pi/agent/skills/`. Full Agent-Skills frontmatter (`name description license compatibility metadata allowed-tools disable-model-invocation`). Also package `skills/`, settings `skills` array, `--skill <path>`. | Context files: `AGENTS.md`/`CLAUDE.md` concatenated; `AGENTS.override.md` replaces in a dir. System-prompt override: `.pi/SYSTEM.md` (project) / `~/.pi/agent/SYSTEM.md` (global); `APPEND_SYSTEM.md`. |
| **Codex** | Yes — `.codex-plugin/plugin.json` (`name version description skills` [+ hooks]). Components: skills, connectors, MCP servers, browser extensions, hooks, scheduled task templates. Install via `/plugins`; distribution via marketplace sources (universal OpenAI directory; local marketplace for dev). | `.codex/hooks.json` (or inline `[hooks]` in `config.toml`). Events: `SessionStart`, `SessionEnd`, `SubagentStart/Stop`, **`PreToolUse`** (blocking), `PermissionRequest`, `PostToolUse`, `PreCompact`/`PostCompact`, `UserPromptSubmit`, `Stop`. Enabled by default; `[features] hooks = false` disables. Per-hook trust ceremony; `--dangerously-bypass-hook-trust`. | `.agents/skills/` (scanned CWD→repo root + repo root + `~/.agents/skills` + `/etc/codex/skills` + system). `agents/openai.yaml` sidecar. Subagents: `.codex/agents/*.toml` (standalone) — skills can also bundle `agents/` TOML auto-discovered. | `AGENTS.md` (global `~/.codex/AGENTS.md`, project root, subdir `AGENTS.override.md`; fallback names; 32 KiB cap). |
| **agents** (shared `.agents/` convention) | None (directory convention, not a product). | None (no host). | `.agents/skills/` is the cross-harness portable location — read by Codex, Cursor, Gemini, Copilot, OpenCode, Pi, Rovo, Vibe, Grok. | `AGENTS.md` (shared standard, read by most harnesses). |
| **Grok Build** | Yes — native `.grok/plugins/` + `~/.grok/plugins/` + `~/.grok/plugins/marketplaces/`; `[[marketplace.sources]]` in `~/.grok/config.toml`. **Claude Code compatible**: reads `.claude-plugin` marketplaces, plugins, `.claude/skills`, hooks, instruction files — the root claude marketplace is consumable as-is. Plugin components: skills, agents, hooks, MCP, LSP. | `.grok/hooks/*.json` (project + user). Events: `SessionStart`, `SessionEnd`, `UserPromptSubmit`, **`PreToolUse`** (only blocking event), `PostToolUse`, `PostToolUseFailure`, `PermissionDenied`, `Stop`, `StopFailure`, `Notification`, `SubagentStart/Stop`, `PreCompact`/`PostCompact`. Trust: `/hooks-trust`. Also reads `.claude/settings.json` + `.cursor/hooks.json`. | `.grok/skills/` + `~/.grok/skills/` + plugin `skills/` + `.agents/skills/` + `.claude/skills/` + `.cursor/skills/` (compat). | `AGENTS.md` family + `CLAUDE.md` family + `.grok/rules/*.md` + `.claude/rules/` + `.cursor/rules/`. No native `GROK.md`. |
| **OpenCode** | Yes (plugins): `.opencode/plugins/` + `~/.config/opencode/plugins/` TS modules; npm packages via `plugin` array in `opencode.json`. No marketplace.json registry. | Via plugin hooks object: `tool.execute.before`, `tool.execute.after`, `shell.env`, `session.*`, `message.*`, `file.edited`, `permission.asked`, `command.executed`, etc. No hooks.json CLI config. | `.opencode/skills/` + `.claude/skills/` + `.agents/skills/`; global `~/.config/opencode/skills/`. `name`+`description` required. `skill({name})` tool; `permission.skill` rules. | `AGENTS.md` (root, traversing up; global `~/.config/opencode/AGENTS.md`; `CLAUDE.md` fallback). `instructions` globs in `opencode.json`. |
| **Trae / Trae-CN** | IDE extension marketplace exists (docs are a JS SPA; manifest format not confirmed from primary source). | No hooks page found in Trae docs. | `.trae/skills/` (project) + global skills dir + `.agents/skills/` (via `find-skills` skill). `skill-config.json` lists disabled project skills. | Rules: `.trae/rules/` folder (project root + any subdir), **loaded in full** at chat start; user rules + project rules via settings. |
| **Rovo Dev** | None documented. Config `~/.rovodev/config.yml`. | `/hooks` command exists in CLI; no hook-event docs found. | `.rovodev/skills/` + `~/.rovodev/skills/` + `.agents/skills/` (built-in > user > project priority). | Memory files: `~/.rovodev/AGENTS.md` (user), `AGENTS.md` + `AGENTS.local.md` (project dirs). Migrates legacy `CLAUDE.md`, `codex.md`, `.cursor/rules/*.mdc`, `rules.md`. |
| **Qoder** | Yes — `.qoder-plugin/plugin.json` (only `name` required; conventional dirs: `commands/ agents/ skills/ hooks/hooks.json output-styles/ workflows/ bin/ .mcp.json`). `marketplace.json` (`name`/`owner`/`plugins`). `/plugins` + `qodercli plugins`. Security: `blockGitExtensions`, `allowedExtensions`. | `.qoder/settings.json` `"hooks"` key (user/project/project.local). Events **mirror Claude Code**: `SessionStart`, `SessionEnd`, `UserPromptSubmit`, **`PreToolUse`** (blocking), `PostToolUse`, `PostToolUseFailure`, `PermissionRequest`, `PermissionDenied`, `Stop`, `StopFailure`, `SubagentStart/Stop`, `PreCompact`/`PostCompact`, `Notification`, `InstructionsLoaded`, `ConfigChange`, `CwdChanged`, `FileChanged`, `WorktreeCreate`/`Remove`, `Elicitation`/`Result`. | `.qoder/skills/` + `~/.qoder/skills/`. Standard SKILL.md (`name`+`description` required; progressive disclosure; auto + `/skill-name`). | `AGENTS.md` (project, `AGENTS.local.md`, `~/.qoder/AGENTS.md`) + `.qoder/rules/**/*.md` with `trigger: always_on/manual/model_decision/glob`. |
| **GitHub Copilot** | VS Code marketplace extensions (`chatSkills` contribution point) + agent plugins (`/plugin:skill` prefix); no `.github-plugin` manifest. Community = copy into `.github/skills/`. | `.github/hooks/*.json` (workspace), `.claude/settings.json`, `~/.copilot/hooks`, agent frontmatter `hooks` (Preview), plugin `hooks.json`. Events: `SessionStart`, `UserPromptSubmit`, **`PreToolUse`** (blocking), `PostToolUse`, `PreCompact`, `SubagentStart/Stop`, `Stop`. Format = Claude Code, **but matcher values are ignored** (hooks run on all tools). | `.github/skills/` + `.claude/skills/` + `.agents/skills/`; `~/.copilot/skills/`. Frontmatter: `name description argument-hint user-invocable disable-model-invocation context`. | `AGENTS.md` (or a single `CLAUDE.md`/`GEMINI.md` at root), `.github/copilot-instructions.md`, `.github/instructions/*.instructions.md`. |
| **Vibe (Mistral)** | None documented. Config `config.toml`. | `.vibe/hooks.toml` + `~/.vibe/hooks.toml`. Events: **`pre_tool`** (can deny/rewrite), `post_tool` (deny/append context), `post_agent`. TOML `[[hooks]]` with `type command match timeout strict`. | `.vibe/skills/` + `.agents/skills/` + `~/.vibe/skills/`; `skill_paths` in `config.toml`; `enabled_skills`/`disabled_skills` filters. | `AGENTS.md` (`~/.vibe/AGENTS.md` + project first-found walking up, trusted folders only). |
| **Kiro** | None documented. | `.kiro/hooks/*.json` (any `.json`, `version: "v1"`, `hooks[]` with `trigger` + `matcher` + `action`). Events: `PostFileSave`, `PostFileCreate`, `PostFileDelete`, **`PreToolUse`** (blocking), `PostToolUse`, **`UserPromptSubmit`** (blocking), `SessionStart`, `Stop`, **`PreTaskExec`** (blocking), `PostTaskExec`. Action = `command` (shell) or `agent` (prompt injection). | `.kiro/skills/` + `~/.kiro/skills/` (workspace > global). Frontmatter: `name description license compatibility metadata`. Custom agents opt in via `skill://` URIs in `resources`. | Steering: `.kiro/steering/*.md` + `~/.kiro/steering/` (frontmatter `inclusion: always/fileMatch/manual/auto`; foundation files `product.md` `tech.md` `structure.md`); `AGENTS.md` also supported in steering locations. |

Notes and discrepancies vs. `plugins/impeccable/docs/HARNESSES.md`:
- **Qoder user/project precedence**: impeccable says project overrides user; Qoder CLI skills doc says "user-level Skills override project-level". IDE docs (extensions/skills) say project takes priority. Flag for the emit — precedence differs IDE vs CLI.
- **Codex subagents**: impeccable says skills auto-discover bundled `agents/` TOML; the current primary doc only documents `.codex/agents/*.toml` standalone. Keep impeccable's claim flagged as skill-bundled-agents.
- **Copilot hooks** are verified primary (VS Code docs); impeccable listed `.github/hooks/*.json` — confirmed, plus matcher-ignored caveat.
- **Pi `.pi/SYSTEM.md`** is a *system-prompt override*, not a standard instruction file — impeccable's table didn't mention it; primary README confirms `AGENTS.md`/`CLAUDE.md` context files + `.pi/SYSTEM.md`.
- **OpenCode hooks**: impeccable says "no hook surface"; current docs show hooks via the plugin system (`tool.execute.before` etc.). OpenCode has no hooks.json — plugins are TS modules.
- **Trae**: impeccable documented `.trae/skills/` (confirmed) + `.trae-cn/skills/` (mapped). Rules at `.trae/rules/` confirmed; `.mdc` extension not visible in the fetched page text (inline code spans were stripped) — assume Cursor-compatible `.mdc`, verify before relying on it.

---

## 2. Per-harness assessment

For each harness: what the root marketplace, osuperpowers-router (trigger router), and engineering must add. Scope tags: **[P3]** = in the current P3 build.js + router scope; **[P4]** = defer to a P4 split; **[N/A]** = not possible with that mechanism.

### 2.1 Claude Code (source of truth)
- **Root marketplace**: **[P3]** `marketplace/source.json` already registers osuperpowers-router + engineering; emitted to `.claude-plugin/marketplace.json`. Keep. `plugin.json` for engineering points at `./skills/` (source tree = claude version). Superpowers-overrides P3 becomes a no-skill router: `plugin.json` `skills` removed, only `hooks/hooks.json` (UserPromptExpansion) + `bin/override-prompt-expansion.sh` + `build/generated/*` self-check remain.
- **Router**: **[P3]** UserPromptExpansion triple matcher (`^superpowers:`, bare `/<slug>`, `^/spor-*`) already exists. P3 retargets the injected `Skill(...)` from `spor-*` to `osuperpowers:*` targets. This is the only harness with a native prompt-*expansion* hook — keep the router here.
- **engineering**: **[P3]** skills live in `skills/` (plugin manifest path) — no emit copy needed for claude. Gate PreToolUse hooks move into engineering `hooks/hooks.json` (P3 B1). Self-check table goes in project `CLAUDE.md` (`init router` writes it).

### 2.2 Cursor
- **Root marketplace**: **[P3]** `.cursor-plugin/marketplace.json` emit exists; osuperpowers-router uses **plugin-root** emit (its `.cursor-plugin/plugin.json` already declares `skills` + `hooks`). P3 removes the **wrapper** emit for engineering (`cursor: {displayName, skills}` in source.json) and emits engineering as plugin-root too (or keeps wrapper — overall v1.7 says remove wrapper emit). Note the flat-namespace dedup rule (cross-harness-overrides.md): any emitted os-* skill must not collide with upstream `superpowers:*` names; `os-*`/`cli-*` prefixes are safe.
- **Router**: **[P3]** cursor detect (`beforeSubmitPrompt`) + enforce (`preToolUse`) hooks already ship plugin-bundled; retarget to os-* targets. Slash triggers rely on `.cursor/rules/osuperpowers-router.mdc` self-check as primary (Cursor cannot inject context on submit).
- **engineering**: **[P3]** build.js emits 12 skills to `.cursor/skills/`. Gate PreToolUse hooks → engineering cursor adapter (`override-cursor-cdd-gate.sh`) + `hooks-cursor.json`. Self-check → `.cursor/rules/engineering.mdc` (or extended `osuperpowers-router.mdc`).

### 2.3 Gemini CLI
- **Root marketplace**: **[P4]** Gemini has no marketplace registry; native packaging = `gemini-extension.json` + `gemini extensions install <git-url>`. Emitting a Gemini extension manifest per-repo is a P4 native-packaging item. P3 fallback: directory copy of skills to `.gemini/skills/` (also works globally via `gemini skills install <repo>`).
- **Router**: **[N/A / P4]** No `UserPromptExpansion`; the closest is `BeforeAgent` (fires after user submit, before planning) or `BeforeTool`. A P4 Gemini router adapter would need `settings.json` hooks with `BeforeAgent`/`BeforeTool` matchers — possible but new ground (fingerprint trust ceremony). Not in P3.
- **engineering**: **[P3]** skills emit to `.gemini/skills/`. Self-check/trigger table → `.gemini/GEMINI.md` (always loaded). Gate: `BeforeTool` matcher hooks in `.gemini/settings.json` is P4 (needs trust handling); P3 documents "invoke os-* directly" via GEMINI.md.

### 2.4 Pi
- **Root marketplace**: **[P4]** Pi packages (`package.json` `pi` key + `pi install`) are a real distribution channel but a distinct package format — a P4 native-packaging item. P3 fallback: directory copy to `.pi/skills/`.
- **Router**: **[N/A]** No CLI hooks. Extension `input`/`tool_call` events require TypeScript extensions — out of scope for the shell-based router.
- **engineering**: **[P3]** skills emit to `.pi/skills/` (+ `.agents/skills/` alias works). Self-check → `.pi/SYSTEM.md` (system prompt) or `AGENTS.md` (context file, concatenated). Gate: N/A in P3 (extensions only).

### 2.5 Codex
- **Root marketplace**: **[P4]** `.codex-plugin/plugin.json` + plugin catalog/marketplace sources exist, but publishing to the OpenAI universal directory is a heavyweight P4 item. P3 fallback: skills emit to `.agents/skills/` (Codex primary scan path) — no plugin needed.
- **Router**: **[N/A / P4]** No `UserPromptExpansion`. `UserPromptSubmit` exists but ignores matchers. A P4 router would need `UserPromptSubmit` hooks (runs on every prompt) or PreToolUse gating — poor fit for slash routing.
- **engineering**: **[P3]** skills emit to `.agents/skills/` (shared with cursor/gemini/copilot/opencode/pi/rovo/vibe/grok). Self-check → `AGENTS.md`. Gate: `PreToolUse` hooks in `.codex/hooks.json` exist (blocking) but require per-hook trust ceremony — P4.

### 2.6 agents (shared `.agents/`)
- **Root marketplace**: N/A (directory convention, not a product).
- **Router**: N/A (no host hooks).
- **engineering**: **[P3]** This is the highest-leverage emit target: one copy of all 12 skills in `.agents/skills/` makes them load in Codex, Cursor, Gemini, Copilot, OpenCode, Pi, Rovo, Vibe, Grok. Self-check → root `AGENTS.md` (shared standard). Emit order in build.js should treat `.agents/skills/` as a first-class target, not an afterthought.

### 2.7 Grok Build
- **Root marketplace**: **[P3]** Grok reads Claude Code marketplaces/plugins directly — the existing `.claude-plugin/marketplace.json` is consumable as-is (zero extra marketplace work). Native `.grok/plugins/` + `[[marketplace.sources]]` is optional.
- **Router**: **[N/A / P4]** No `UserPromptExpansion`; `UserPromptSubmit` is passive. PreToolUse is the only blocking event. P4 router adapter possible (matcher on tools), not P3.
- **engineering**: **[P3]** skills emit to `.grok/skills/` (Claude-compatible frontmatter — the claude transform is nearly reusable). Self-check → `AGENTS.md` or `.grok/rules/*.md`. Gate: PreToolUse hooks in `.grok/hooks/engineering.json` (Claude tool-name matchers alias to Grok tools; `GROK_PLUGIN_ROOT` env; `/hooks-trust` required) — feasible in P3 if gate scope extends to grok, else P4.

### 2.8 OpenCode
- **Root marketplace**: **[N/A]** No marketplace registry; plugins are TS modules/npm packages. Directory copy is the only P3 path.
- **Router**: **[N/A]** Hooks exist only as TS plugin code (`tool.execute.before`), not shippable from a shell build.
- **engineering**: **[P3]** skills emit to `.opencode/skills/`. Self-check → `AGENTS.md` (auto-loaded) or `instructions` globs in `opencode.json`. Gate: N/A in P3 (TS plugin would be P4).

### 2.9 / 2.10 Trae / Trae-CN
- **Root marketplace**: **[P4]** Trae has an IDE extension marketplace; manifest format not confirmed from primary source (JS SPA). Skip in P3.
- **Router**: **[N/A]** No hooks documented.
- **engineering**: **[P3]** skills emit to `.trae/skills/` and `.trae-cn/skills/` (the latter confirmed by impeccable HARNESSES.md). Self-check → `.trae/rules/*.mdc` (rules loaded in full, Cursor-style; extension `.mdc` unconfirmed — verify). Skills note: Trae loads rules in full vs skills on-demand — the self-check table should go in rules, not a skill.

### 2.11 Rovo Dev
- **Root marketplace**: **[N/A]** No marketplace.
- **Router**: **[N/A]** `/hooks` command exists but no event docs; assume none.
- **engineering**: **[P3]** skills emit to `.rovodev/skills/`. Self-check → `AGENTS.md` (Rovo memory convention; user `~/.rovodev/AGENTS.md` + project `AGENTS.md`/`AGENTS.local.md`).

### 2.12 Qoder
- **Root marketplace**: **[P4]** Native `.qoder-plugin/plugin.json` + `marketplace.json` exist and are Claude-Code-shaped, but plugin install is IDE/CLI managed; a P4 native-manifest item. P3 fallback: directory copy to `.qoder/skills/`.
- **Router**: **[N/A / P4]** Hooks mirror Claude Code (incl. `UserPromptSubmit`), but no expansion hook; a P4 router adapter is conceivable via `UserPromptSubmit` (runs every prompt).
- **engineering**: **[P3]** skills emit to `.qoder/skills/`. Self-check → `AGENTS.md` or `.qoder/rules/**/*.md` (trigger frontmatter incl. `always_on`). Gate: **[P4]** PreToolUse in `.qoder/settings.json` is Claude-Code-identical — highest-fidelity port after claude/cursor, but trust/settings plumbing is new; defer with the other native gate adapters.

### 2.13 GitHub Copilot
- **Root marketplace**: **[N/A]** No repo-level plugin manifest; distribution is VS Code marketplace extensions or directory copy.
- **Router**: **[N/A / P4]** Hooks exist (`.github/hooks/*.json`, Claude format) **but matchers are ignored** — a PreToolUse gate would fire on every tool call, not just the target. P4 with caution; not P3.
- **engineering**: **[P3]** skills emit to `.github/skills/` (works across VS Code, Copilot CLI, cloud agent; also `.agents/skills/` alias). Self-check → `AGENTS.md` (or `.github/copilot-instructions.md`).

### 2.14 Vibe (Mistral)
- **Root marketplace**: **[N/A]** No marketplace.
- **Router**: **[N/A]** `pre_tool`/`post_agent` hooks are tool-level, no prompt expansion.
- **engineering**: **[P3]** skills emit to `.vibe/skills/`. Self-check → `AGENTS.md` (trusted folders only — note: untrusted projects won't load it). Gate: `pre_tool` in `.vibe/hooks.toml` is shell-based (TOML, `command` receives JSON) — P4 candidate.

### 2.15 Kiro
- **Root marketplace**: **[N/A]** No marketplace.
- **Router**: **[N/A]** `UserPromptSubmit` is blocking but there is no expansion/additional-context mechanism (Kiro hook actions are `command` or agent-prompt injection).
- **engineering**: **[P3]** skills emit to `.kiro/skills/`. Self-check → `.kiro/steering/*.md` with `inclusion: always` (loaded every interaction) or `AGENTS.md` in steering locations. Gate: `PreToolUse` blocking hooks in `.kiro/hooks/*.json` — P4 candidate.

---

## 3. Recommendation: P3 vs P4 split

**Verdict: the current P3 scope (12-skill emit to 14 harnesses + router retarget + gate migration) is right-sized, with a clear P4 split for native packaging and non-claude/cursor gate adapters.**

### Keep in P3 (fully supported, directory-copy viable)
1. **Multi-harness skill emit** — every one of the 14 non-claude harnesses loads skills from a documented directory (Section 1, "Skill loading" column). A `build.js` + `lib/providers.js` that emits `skills/` to `.cursor .gemini .pi .codex .agents .grok .opencode .trae .trae-cn .rovodev .qoder .github .vibe .kiro` (per-harness frontmatter transforms, impeccable-style) is feasible today. **Treat `.agents/skills/` as a first-class emit target** — it is the single highest-leverage copy (loaded by 9 harnesses).
2. **Per-harness self-check / README emit** — all 14 have an always- or auto-loaded instruction file that can carry the "invoke os-* directly" trigger table: `.cursor/rules/*.mdc`, `.gemini/GEMINI.md`, `.pi/SYSTEM.md` (or `AGENTS.md`), `AGENTS.md` (codex/opencode/rovodev/qoder/github/vibe), `.grok/rules/*.md`, `.trae/rules/*.mdc`, `.kiro/steering/*.md`. P3 B5's "write a self-check/README per harness directory" is confirmed correct and necessary — the router hooks exist **only** on claude + cursor, so every other harness gets the self-check table as its primary enforcement.
3. **Router retarget (claude + cursor only)** — `UserPromptExpansion` (claude) and `beforeSubmitPrompt` detect + `preToolUse` enforce (cursor) are the only two harnesses with the interception primitives the router needs. P3's "router = claude + cursor, no skill bodies" is the right terminal boundary.
4. **Gate migration to engineering (claude + cursor)** — PreToolUse adapters on these two harnesses are proven (existing tests). Keep the P3 gate scope to claude + cursor.
5. **Upstream coordination** — copy `plugins/superpowers/skills/` wholesale into each harness dir so `os-*` skills' "Read upstream" resolves in-harness (P3 B4/B5).

### Split into P4 (native packaging + non-claude/cursor gate)
1. **Native marketplace/plugin manifests** for harnesses that have them, when directory copy is insufficient:
   - **Gemini**: `gemini-extension.json` (+ `gemini extensions install` flow).
   - **Codex**: `.codex-plugin/plugin.json` + plugin-catalog publishing.
   - **Qoder**: `.qoder-plugin/plugin.json` + `marketplace.json`.
   - **Pi**: package.json `pi` manifest (`pi install`).
   - **Grok**: `[[marketplace.sources]]` in `config.toml` (optional — Claude marketplace compat already covers P3).
   - **Trae**: extension-marketplace manifest (format unverified — research first).
2. **Gate hook adapters for harnesses with equivalent PreToolUse/BeforeTool primitives** — each needs native config + a trust ceremony:
   - **Grok** (`PreToolUse`, `/hooks-trust`, `GROK_PLUGIN_ROOT`) — closest to claude; highest priority.
   - **Qoder** (`PreToolUse` in `.qoder/settings.json`, Claude-identical event names) — highest-fidelity port.
   - **Codex** (`PreToolUse`, per-hook trust, `--dangerously-bypass-hook-trust`).
   - **Gemini** (`BeforeTool`, settings.json hooks, project-hook fingerprinting).
   - **Vibe** (`pre_tool` in `.vibe/hooks.toml`).
   - **Kiro** (`PreToolUse` in `.kiro/hooks/*.json`).
   - **Copilot** — defer/caution: matchers ignored, a gate would run on every tool call.
3. **Router extensions** for harnesses without expansion hooks (all non-claude/cursor) — only if a P4 product need emerges; the self-check tables + README are the P3-enough fallback.

### Rationale
- The P3 emit is *pure directory copying + frontmatter transforms* — no new product risk; every target path is documented primary-source.
- The router and gate are the only components with real harness-specific protocol risk (trust ceremonies, matcher semantics, fingerprinting). Bundling native adapters for 7+ more harnesses into P3 would turn a packaging phase into a per-harness protocol project. The P4 split keeps P3 reviewable and shippable.
- `pnpm run validate` freshness CI (build.js emit drift check) is the P3 acceptance mechanism — it works regardless of how many harnesses are emitted, since it compares generated trees.

---

## Sources

### Claude Code
- Hooks: https://code.claude.com/docs/en/hooks
- Plugins: https://code.claude.com/docs/en/plugins
- Plugin marketplaces: https://code.claude.com/docs/en/plugin-marketplaces
- Skills: https://code.claude.com/docs/en/skills

### Cursor
- Plugins / Team Marketplace: https://cursor.com/docs/plugins
- Hooks: https://cursor.com/docs/hooks
- Skills: https://cursor.com/docs/context/skills

### Gemini CLI
- Skills: https://geminicli.com/docs/cli/skills/
- Hooks: https://geminicli.com/docs/hooks/
- GEMINI.md: https://geminicli.com/docs/cli/gemini-md/
- Extensions: https://geminicli.com/docs/extensions/ ; reference: https://geminicli.com/docs/extensions/reference/
- Custom commands: https://geminicli.com/docs/cli/custom-commands/

### Pi
- Skills: https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/skills.md
- Packages: https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/packages.md
- Extensions (events): https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/extensions.md
- Context files / SYSTEM.md / AGENTS.md: https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/README.md

### Codex
- Skills: https://learn.chatgpt.com/docs/build-skills
- Hooks: https://learn.chatgpt.com/docs/hooks
- AGENTS.md: https://learn.chatgpt.com/docs/agent-configuration/agents-md
- Subagents: https://learn.chatgpt.com/docs/agent-configuration/subagents
- Plugins: https://learn.chatgpt.com/docs/plugins ; build: https://learn.chatgpt.com/docs/build-plugins

### Grok Build
- Skills / plugins / marketplaces: https://docs.x.ai/build/features/skills-plugins-marketplaces
- Hooks: https://docs.x.ai/build/features/hooks
- Project rules / instruction files: https://docs.x.ai/build/features/project-rules

### OpenCode
- Skills: https://opencode.ai/docs/skills/
- Agents: https://opencode.ai/docs/agents/
- Rules (AGENTS.md): https://opencode.ai/docs/rules/
- Plugins (hooks): https://opencode.ai/docs/plugins/

### Trae / Trae-CN
- Skills: https://docs.trae.ai/ide/skills (raw HTML, JS SPA)
- Rules: https://docs.trae.ai/ide/rules (raw HTML, JS SPA)

### Rovo Dev
- Agent skills: https://support.atlassian.com/rovo/docs/extend-rovo-dev-cli-with-agent-skills
- CLI commands: https://support.atlassian.com/rovo/docs/rovo-dev-cli-commands
- Settings: https://support.atlassian.com/rovo/docs/manage-rovo-dev-cli-settings
- Memory / AGENTS.md: https://support.atlassian.com/rovo/docs/use-memory-in-rovo-dev-cli

### Qoder
- CLI skills: https://docs.qoder.com/cli/Skills
- Hooks: https://docs.qoder.com/cli/hooks.md
- Rules: https://docs.qoder.com/user-guide/rules.md
- Memory / AGENTS.md: https://docs.qoder.com/cli/memory.md
- Plugins / marketplace: https://docs.qoder.com/cli/plugins-reference.md

### GitHub Copilot
- Agent skills: https://code.visualstudio.com/docs/copilot/customization/agent-skills
- Custom agents: https://code.visualstudio.com/docs/copilot/customization/custom-agents
- Hooks: https://code.visualstudio.com/docs/copilot/customization/hooks
- Custom instructions (AGENTS.md, copilot-instructions.md): https://docs.github.com/en/copilot/customizing-copilot/adding-custom-instructions-for-github-copilot

### Mistral Vibe
- Skills: https://docs.mistral.ai/vibe/code/cli/skills
- Agents / AGENTS.md: https://docs.mistral.ai/vibe/code/cli/agents
- Hooks: https://docs.mistral.ai/vibe/code/cli/hooks

### Kiro
- Skills: https://kiro.dev/docs/skills/
- Hooks: https://kiro.dev/docs/hooks/
- Steering: https://kiro.dev/docs/steering/

### Local cross-reference (repo)
- `plugins/impeccable/docs/HARNESSES.md` — prior harness capability research
- `plugins/impeccable/scripts/lib/transformers/providers.js` — emit target configs (configDir, frontmatter fields, emitHooks, hooksManifestRel)
- `docs/superpowers/specs/2026-08-10-engineering-p3-design.md` — P3 scope being assessed
- `plugins/osuperpowers-router/docs/cross-harness-overrides.md` — router/gate architecture and claude+cursor enforcement model
