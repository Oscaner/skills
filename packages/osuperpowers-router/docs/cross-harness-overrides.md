# Cross-Harness Skill Overrides

Portable convention for marketplace plugins that **route** upstream skill triggers to override targets across harnesses.

Naming evolved across releases: v1 emit model → v2 `-overrides` suffix → v3 `spor-*` prefix → **v4 trigger router** (current). v3's `spor-*` skill bodies were deleted; **osuperpowers-router now ships no skill bodies** and routes to engineering targets. See [CHANGELOG.md](../CHANGELOG.md) entries `6.2.0-overrides.3` through `6.2.0-overrides.6`.

## Problem

| Harness class | Identity | Same `name` from two plugins |
|---------------|----------|------------------------------|
| Claude Code / Grok (plugin mode) | `plugin:skill` namespace | Both visible |
| Flat namespace (Cursor, Codex, Copilot, …) | Folder + frontmatter `name` | **Dedup** — one hidden |

Override skills that reuse upstream skill names work in Claude Code but break in Cursor when both plugins are installed. v3's `spor-*` prefix dodged flat-namespace dedup at the cost of a parallel skill tree to maintain.

## Solution (v4 — trigger router + engineering)

**osuperpowers-router** is a **trigger router** (claude + cursor), not a skill pack:

1. **No skill bodies** — `skills/` is absent/empty; `overrides.manifest.json` maps upstream triggers to targets in **engineering** (`os-*` / `cli-*`) or **mattpocock-skills** (`tdd`).
2. **Manifest** — declare targets with explicit `name`, `overrides`, and `source` fields (cross-plugin path).
3. **Generators** — manifest-driven `scripts/emit.mjs` writes committed hook + self-check artifacts (`build/generated/*`, `bin/prompt-expansion.mjs`).
4. **engineering multi-harness emit** — the skills + engine plugin emits thin per-harness manifests (claude/cursor/codex/kimi/gemini/pi) all pointing at the canonical `./skills/` tree, plus a shared `.agents/skills/` copy (engineering only — upstream superpowers is not vendored) for codex/gemini/pi/qoder/opencode scanners. Modeled after impeccable's build.js + PROVIDERS pattern.
5. **Enforcement** — harness-specific hooks + project self-check rules (see [Enforcement](#enforcement) below).
6. **Package layout & hooks registration** — the router and engineering engine are first-party packages under `packages/` (`@oscaner-skills/osuperpowers-router`, `@oscaner-skills/engineering`), each with its metadata in `package.json#oscaner-plugin` (**package-as-source**). Upstream plugins (`superpowers`, `mattpocock-skills`, `impeccable`) are vendored submodules under `vendors/`, republished as `@oscaner-skills/<name>` by `scripts/publish-vendor.mjs`; their marketplace descriptors come from the assembly templates in `scripts/lib/publish-vendor.mjs` (`ASSEMBLY_TEMPLATE` — the owner) plus the marketplace cursor blocks in `scripts/lib/emit/source.mjs` (`VENDOR_PLUGINS`). Hooks are registered per harness via `oscaner-plugin.hooks` — the harness → path mapping is the single source of truth, and `scripts/emit.mjs` writes each hooks file at the declared path and references it from the generated per-harness manifest.

No `.cursor/skills/` emit duplicate. No frontmatter rewrite at build time.

**CI:** `pnpm run emit:check` checks generator drift; `tests/validate-overrides-build.mjs` validates the router + engineering engine.

Claude Code interception: `Skill(osuperpowers:brainstorming)` (manifest `name` field).

## Enforcement

Override-first is enforced by **plugin-bundled hooks** plus project self-check rules. Hooks ship with the plugin — **never** copy hook files into consumer projects.

### Cursor — detect + enforce (plugin-bundled)

**File:** `hooks/hooks-cursor.json` (declared in `package.json#oscaner-plugin.hooks` — the SOT; emit writes the file at that path and references it from the plugin-root `.cursor-plugin/plugin.json` → `"hooks": "./hooks/hooks-cursor.json"`).

| Hook | Handler | Role |
|------|---------|------|
| `beforeSubmitPrompt` (`UserPromptSubmit`) | `bin/cursor-detect.mjs` | Match **upstream SKILL attach paths** → write pending / activate CDD session |
| `preToolUse` (no matcher) | `bin/cursor-enforce.mjs` | If pending exists: **allow** first `Read` (target SKILL path via `tool_input.path` / `tool_input.file_path`) or `Skill` (manifest target name); **deny** all other first tools |

Bare `/brainstorming`, `/superpowers:*`, and prefixed slash commands → **no pending**; self-check rules (`.cursor/rules/osuperpowers-router.mdc`) are primary enforcement for slash triggers.

Cursor cannot inject context on submit (no `additional_context` on `beforeSubmitPrompt`). Detect writes pending on attach only; enforce blocks wrong first tools when pending exists.

**Pending state contract** (detect writes, enforce reads):

- Path: `$TMPDIR/oscaner-osuperpowers-router/pending/<session_key>.json`
- `session_key` = `conversation_id` ?? `session_id` ?? first 16 hex of `sha256(prompt)`
- Schema: `{"override":"<target-name>","skill_suffix":"skills/os-<slug>/SKILL.md","detected_at":<unix>,"trigger":"attach"}`
- TTL: **300s** — expired pending → enforce allows and deletes file
- Cleared when enforce allows a valid first tool

**Init does not install hooks** — `init router` only refreshes `.cursor/rules/osuperpowers-router.mdc`. Consumer `git status` must show **no** new `.cursor/hooks.json`.

### CDD orchestrator gate

Cross-harness PreToolUse enforcement for CDD orchestrator sessions (Claude Code, Cursor, and the other gated harnesses — per-harness install → [docs/gate-install.md](../../../docs/gate-install.md)). The gate ships with **engineering** — the overrides plugin is a trigger router and carries no gate hooks. The gate surface is **Node** (P4b): one decision core + one adapter per harness.

| Item | Detail |
|------|--------|
| Pending path | `$TMPDIR/oscaner-engineering/pending-cdd/<session_key>.json` |
| Activation | CDD slash (`/subagent-driven-development`, `/superpowers:subagent-driven-development`, `/executing-plans`) via Claude expansion |
| Decision core | `engineering/bin/gate/cdd-gate-core.mjs` — single fail-open, mode-aware decision point (git read-only allowlist + workspace-bound Write) |
| Adapters | `engineering/bin/gate/adapters/<harness>.mjs` — claude, cursor + 9 more (grok/qoder/trae/codex/gemini/vibe/kiro/opencode/pi) |
| Fail-open | No pending, cannot resolve workspace, or adapter exception → allow (skill checklist fallback) |

Claude Code: `engineering/hooks/hooks.json` adds `PreToolUse` matchers (`Write|Edit`, `Bash`) → `engineering/bin/gate/adapters/claude.mjs`. Cursor: `engineering/hooks/hooks-cursor.json` adds `preToolUse` → `engineering/bin/gate/adapters/cursor.mjs`. These hooks are checked-in plugin files — the overrides generators emit only the trigger-router hooks (`UserPromptExpansion` / detect + enforce).

**Shell contract (read-only git diagnostics):** the gate allows read-only git Bash during active tasks — `git status` / `git diff` / `git log` / `git show` / `git rev-parse` / `git branch` / `git remote` / `git ls-files` / `git diff-tree` (also via `git -C <path>` / `git --git-dir=<path>`). Anything else — mutating git verbs, non-git commands, compound commands, heredocs — is denied (fail-closed). Repo changes flow only through the H6 implement shell (`cdd-run.mjs --harness <name>`) or Write under the bound workspace.

**Deny message:** a multi-line allowlist matrix listing every allowed Bash verb, the allowed Write root (`.superpowers/cdd/<plan-basename>/`), and the H6 implement shell. Same single-source verb list drives both the judgment and the message.

**Anti-hijack:** a task brief activates only when its `TASK_BASE` is a real git object (`git -C <repo> cat-file -e <sha>`, CWD-independent) — stale stub SHAs never activate a workspace. Bound workspace (`pending.workspace`) wins; the gate scans only when unbound, so it is not hijacked by unrelated/stale workspaces. Full matrix in [`engineering/docs/cdd-reference.md`](../../engineering/docs/cdd-reference.md) (§ CDD gate matrix).

### CDD H6 reference doc

CLI env/exit/harness tables live in [`engineering/docs/cdd-reference.md`](../../engineering/docs/cdd-reference.md). Orchestrator skills cite H1–H5 only; Read reference doc once per session when shelling H6.

### Claude Code — two UserPromptExpansion matchers + expansion

**File:** `hooks/hooks.json` — two `UserPromptExpansion` matchers (manifest-generated):

1. `^superpowers:` — prefixed upstream slash commands
2. Combined bare-`/<upstream-slug>` regex — e.g. `/brainstorming` (one matcher covering every upstream slug)

Both invoke `bin/prompt-expansion.mjs`, which injects `additionalContext` containing **MANDATORY OVERRIDE** and the required `Skill(<target-name>)` first call (e.g. `Skill(osuperpowers:brainstorming)`).

`^/os-<upstream-slug>` (engineering targets) is not hook-intercepted — it is routed by the project `CLAUDE.md` self-check (`<command-name>` scan + trigger table from `init router`).

Project `CLAUDE.md` self-check (from `init router`) is fallback when hooks are unavailable.

### Self-check rules (both harnesses)

`init router` (engineering) writes committed generator output into the project:

- Cursor → `.cursor/rules/osuperpowers-router.mdc`
- Claude Code → `CLAUDE.md` override trigger table

On Cursor: hooks enforce on **upstream SKILL attach**; slash commands rely on these self-check rules as **primary** enforcement. On both harnesses:

- **Anti-pattern:** manually attach upstream `superpowers/*/SKILL.md` body — use slash commands or read the target engineering skill instead; upstream SKILL full text in context still requires the target skill first.

Manual smoke (Settings → Hooks → Execution Log):

1. `/brainstorming` + Grep first tool → **no deny** (no pending; self-check governs)
2. Attach upstream `brainstorming/SKILL.md` + Grep first tool → **deny** → Read brainstorming SKILL → allow

## Manifest schema

**File:** `overrides.manifest.json`

```json
{
  "$schema": "./build/overrides-manifest.schema.json",
  "plugin": "osuperpowers-router",
  "targets": [
    {
      "name": "osuperpowers:brainstorming",
      "overrides": "superpowers:brainstorming",
      "source": "../engineering/skills/brainstorming"
    }
  ]
}
```

| Field | Description |
|-------|-------------|
| `plugin` | Router plugin namespace name |
| `name` | Target skill id in all harnesses (`plugin:skill`, e.g. `osuperpowers:brainstorming`) |
| `overrides` | Upstream `plugin:skill` id to intercept |
| `source` | Path to canonical skill directory (cross-plugin) |

**Upstream slug for trigger tables:** parse from `overrides` (`superpowers:brainstorming` → `brainstorming`).

## Naming rule

The router ships no `spor-*` skills. Target skill ids are the engineering / mattpocock canonical names (`osuperpowers:*`, `osuperpowers:cli-*`, `mattpocock-skills:tdd`). Init entry point: `init router` (Claude Code: `/init router`).

## Build commands

```bash
pnpm run emit                 # unified emit — writes per-harness manifests + hooks + .agents/skills
pnpm run validate             # full CI chain (emit + router + gate + build freshness + rule-reference)
node packages/osuperpowers-router/tests/validate-overrides-build.mjs
```

Regenerate after editing `overrides.manifest.json`, engineering skills, or generator templates.

## Plugin discovery fallback (Cursor)

Skills ship under `packages/osuperpowers/skills/` in the plugin tree. After marketplace install, verify the engineering skills (12 emitters + init) appear in the agent skills list.

If skills are missing (Team Marketplace blocked or third-party import disabled):

```bash
mkdir -p .cursor/skills
cp -R path/to/packages/osuperpowers/skills/* .cursor/skills/
cp -R path/to/vendors/superpowers/skills/* .cursor/skills/   # upstream, separate plugin
```

Then run `init router` for `.cursor/rules/osuperpowers-router.mdc`.

## Cursor setup

1. Install `superpowers`, `osuperpowers-router`, `engineering`, and `mattpocock-skills` from the marketplace.
2. Run `init router` in Cursor (copies or refreshes the self-check rule → `.cursor/rules/osuperpowers-router.mdc`; re-run after plugin upgrade if rules are stale).
3. Invoke upstream slash commands — slash triggers rely on project self-check rules; hooks enforce on upstream SKILL attach only.

Manual verification: same as [Self-check rules](#self-check-rules-both-harnesses) smoke bullets above.

## CDD CLI harness scripts

Token-efficient CDD orchestration uses plugin-bundled scripts — referenced by `executing-plans` and `cli-driven-development`. Orchestrator resolves harness once per plan; the engine does **not** re-detect CLI at runtime.

| Harness | CLI binary | Ship level |
|---------|------------|------------|
| **claude** | `claude` | **Full** — `claude -p … --output-format text --dangerously-skip-permissions` |
| **cursor-agent** | `cursor-agent` | **Full** — `cursor-agent --print --output-format text --force` |
| **droid** | `droid` | **Full** — `droid exec --auto medium --output-format stream-json` |
| **pi** | `pi` | **Full** — `pi -p --no-session --no-approve` |
| **codex** | `codex` | **Not-supported** — exit 1 BLOCKED |
| **copilot** | `copilot` | **Not-supported** — exit 1 BLOCKED |
| **gemini** | `gemini` | **Not-supported** — exit 1 BLOCKED |

Shared library: `engineering/bin/engine/lib/` Node modules — `runner.mjs` (workspace path contract `CDD_WORKSPACE`/`CDD_LEDGER`/…, exit codes 0 OK / 1 BLOCKED / 2 CLI missing, **and the shared task/plan run-loop** `runTask` (one mode per invocation) / `runPlan` (pending tasks × 3-mode chain)), `registry.mjs` (harness registry), `contract.mjs` (commit gate + handoff), `templates.mjs` (mode prompt render), `ledger.mjs` (ledger append). The single CLI runner is `engineering/bin/engine/cdd-run.mjs` (`--harness <name> --task N --mode M` | `--plan <path>`), registry-driven from `engineering/bin/engine/harness-registry.json`. The **post-run commit gate** (`validateCommitContract` in `contract.mjs`): implement/fix modes validate a clean working tree on return (dirty → handoff rewritten `status: BLOCKED` + non-zero exit; fail-open on non-git / git error). See [engineering/docs/cdd-reference.md](../../engineering/docs/cdd-reference.md) (§ Post-run commit gate).

### Invocation modes

**Mode A (per task):** orchestrator calls one mode per CLI invocation:

```bash
{engineering}/bin/engine/cdd-run.mjs --harness <name> --task N --mode implement|review|fix
```

**Mode B (plan driver / AFK):** batch pending tasks from plan + ledger:

```bash
{engineering}/bin/engine/cdd-run.mjs --harness <name> --plan <path>
```

Plan driver runs the 3-mode chain per pending task. Ledger append on APPROVED only.

### Exit codes and fallback

| Exit | Meaning | Orchestrator action |
|------|---------|---------------------|
| 0 | Success | Continue chain |
| 1 | BLOCKED (not-supported harness or explicit block) | Stop — **not** p0 fallback |
| 2 | CLI not in PATH | Orchestrator **BLOCKED** |

Not-supported harness selected → exit 1 → orchestrator **BLOCKED**. No `--resume` or session-carry flags (H6.5).

**CI:** `tests/validate-overrides-build.mjs` asserts the engineering engine (harness registry + `cdd-run.mjs`/`cdd-select.mjs`/`cdd-exec.mjs` executable + engine tests); the engineering gate/hook scripts and the gate test suite are validated in `scripts/ci-validate.mjs` (5b block).

Templates: `engineering/templates/cdd/` (implement, review, fix) + `_handoff-write-fragment.md`.

## Deferred harnesses (documented, not built)

| Harness | Rules output (future) | CDD CLI (p1) |
|---------|----------------------|--------------|
| Codex / Copilot / Mistral Vibe | `AGENTS.md` section | Stub scripts (exit 1) |
| Gemini CLI | `.gemini/GEMINI.md` | Stub scripts (exit 1) |
| OpenCode / Pi / Qoder / Rovo / Kiro | Per harness config file | Not built |

See [impeccable/docs/HARNESSES.md](../../impeccable/docs/HARNESSES.md) for directory mappings.

## Adoption guide (third-party marketplaces)

1. **Manifest** — add `overrides.manifest.json` with `name`, upstream `overrides` id, and `source` path per target.
2. **Routing** — router plugin ships no skill bodies; targets live in the skills plugin (`os-*` orchestrators) or a delegate (`tdd`). Flat-namespace dedup is avoided by target names already being plugin-qualified.
3. **Generators** — use the unified `scripts/emit.mjs`; commit hook + self-check outputs; CI `--check` on drift.
4. **Init** — copy or refresh committed `build/generated/*` at runtime; never run generators in init. Generated self-check files embed `engineering-version` (Cursor frontmatter / Claude HTML comment) stamped from the engineering plugin version; `init router` compares project rules against installed version and overwrites when missing or stale.

Copy the manifest, generator scripts, and `validate-overrides-build.mjs` from this plugin as a starting point.

## Phase 2 (not v1)

- NL keyword interception in rules self-check
- Emit rules for Codex / Copilot / Gemini from the same manifest
- Agent Skills spec proposal for `overrides` / `extends` frontmatter
- Cursor product request for native `plugin:skill` namespace
