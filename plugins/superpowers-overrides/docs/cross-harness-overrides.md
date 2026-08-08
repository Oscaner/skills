# Cross-Harness Skill Overrides

Portable convention for marketplace plugins that ship **override skills** alongside an upstream plugin.

Naming evolved across releases: v1 emit model → v2 `-overrides` suffix → v3 `spor-*` prefix (current). See [CHANGELOG.md](../CHANGELOG.md) entries `6.2.0-overrides.3` through `6.2.0-overrides.6`.

## Problem

| Harness class | Identity | Same `name` from two plugins |
|---------------|----------|------------------------------|
| Claude Code / Grok (plugin mode) | `plugin:skill` namespace | Both visible |
| Flat namespace (Cursor, Codex, Copilot, …) | Folder + frontmatter `name` | **Dedup** — one hidden |

Override plugins that reuse upstream skill names work in Claude Code but break in Cursor when both plugins are installed. The `-overrides` suffix (v2) was insufficient — Cursor still deduplicated against upstream names. v3 uses a plugin-level `spor-` prefix on every skill id.

## Solution (v3 — `spor-` prefix)

One canonical tree under `skills/` serves Claude Code, Cursor marketplace, and manual copy:

1. **Canonical source** — all skills live in `skills/spor-<slug>/` (e.g. `spor-brainstorming`). Directory basename equals frontmatter `name`.
2. **Manifest** — declare targets in `overrides.manifest.json` with explicit `name`, `overrides`, and `source` fields.
3. **Generators** — manifest-driven scripts write committed hook + self-check artifacts (`build/generated/*`, `bin/override-prompt-expansion.sh`).
4. **Enforcement** — harness-specific hooks + project self-check rules (see [Enforcement](#enforcement) below).

No `.cursor/skills/` emit duplicate. No frontmatter rewrite at build time.

**CI:** `pnpm run validate:overrides` checks generator drift; `tests/validate-overrides-build.sh` validates the canonical tree.

Claude Code interception: `Skill(superpowers-overrides:spor-brainstorming)` (manifest `name` field).

## Enforcement

Override-first is enforced by **plugin-bundled hooks** plus project self-check rules. Hooks ship with the plugin — **never** copy hook files into consumer projects.

### Cursor — detect + enforce (plugin-bundled)

**File:** `hooks/hooks-cursor.json` (declared in plugin-root `.cursor-plugin/plugin.json` → `"hooks": "./hooks/hooks-cursor.json"`).

| Hook | Handler | Role |
|------|---------|------|
| `beforeSubmitPrompt` (`UserPromptSubmit`) | `bin/override-cursor-detect.sh` | Match **upstream SKILL attach paths** or **SDD slash** → write pending / activate SDD session |
| `preToolUse` (no matcher) | `bin/override-cursor-enforce.sh` | If pending exists: **allow** first `Read` (spor SKILL path via `tool_input.path` or `tool_input.file_path`) or `Skill` (`superpowers-overrides:spor-*`); **deny** all other first tools |
| `preToolUse` (no matcher) | `bin/override-cursor-sdd-gate.sh` | SDD orchestrator gate — deny non-workspace Write/Edit and non-allowlist Bash during active tasks |

Bare `/brainstorming`, `/spor-*`, and prefixed slash commands (`superpowers:*`) → **no pending**; self-check rules (`.cursor/rules/superpowers-overrides.mdc`) are primary enforcement for slash triggers.

Cursor cannot inject context on submit (no `additional_context` on `beforeSubmitPrompt`). Detect writes pending on attach only; enforce blocks wrong first tools when pending exists.

**Pending state contract** (detect writes, enforce reads):

- Path: `$TMPDIR/oscaner-superpowers-overrides/pending/<session_key>.json`
- `session_key` = `conversation_id` ?? `session_id` ?? first 16 hex of `sha256(prompt)`
- Schema: `{"override":"spor-<slug>","skill_suffix":"skills/spor-<slug>/SKILL.md","detected_at":<unix>,"trigger":"attach"}`
- TTL: **300s** — expired pending → enforce allows and deletes file
- Cleared when enforce allows a valid first tool

**`spor-init` does not install hooks** — only refreshes `.cursor/rules/superpowers-overrides.mdc`. Consumer `git status` must show **no** new `.cursor/hooks.json`.

### SDD orchestrator gate (p1-slim.2)

Cross-harness PreToolUse enforcement for SDD orchestrator sessions (Cursor + Claude Code).

| Item | Detail |
|------|--------|
| Pending path | `$TMPDIR/oscaner-superpowers-overrides/pending-sdd/<session_key>.json` |
| Activation | SDD slash (`/subagent-driven-development`, `/spor-*`, `/superpowers:subagent-driven-development`, `/executing-plans`) via Cursor detect + Claude expansion |
| Shared lib | `bin/lib/sdd-orchestrator-gate.sh` — single allowlist + state machine |
| Adapters | `override-cursor-sdd-gate.sh`, `override-claude-sdd-gate.sh` |
| Fail-open | No jq, no pending, or cannot resolve workspace → allow (skill checklist fallback) |
| Known gap | p0 Task-tool implementer Write — hook cannot intercept subagent tools ([p1-slim.2 spec](../../docs/superpowers/specs/2026-08-05-sdd-slim-orchestrator-p1-slim-2-design.md)) |

Claude Code: `hooks/hooks.json` adds `PreToolUse` matchers (`Write|Edit`, `Bash`) → `override-claude-sdd-gate.sh`. Generators are SOT — run `pnpm run generate:overrides` after manifest edits.

**Shell contract (read-only git diagnostics):** the gate allows read-only git Bash during active tasks — `git status` / `git diff` / `git log` / `git show` / `git rev-parse` / `git branch` / `git remote` / `git ls-files` / `git diff-tree` (also via `git -C <path>` / `git --git-dir=<path>`). Anything else — mutating git verbs, non-git commands, compound commands, heredocs — is denied (fail-closed). Repo changes flow only through the H6 implement shell or Write under the bound workspace.

**Deny message:** a multi-line allowlist matrix listing every allowed Bash verb, the allowed Write root (`.superpowers/sdd/<plan-basename>/`), and the H6 implement shell. Same single-source verb list drives both the judgment and the message.

**Anti-hijack:** a task brief activates only when its `TASK_BASE` is a real git object (`git -C <repo> cat-file -e <sha>`, CWD-independent) — stale stub SHAs never activate a workspace. Bound workspace (`pending.workspace`) wins; the gate scans only when unbound, so it is not hijacked by unrelated/stale workspaces. Full matrix in [`sdd-h6-reference.md`](sdd-h6-reference.md) (§ SDD gate matrix).

### SDD H6 reference doc (p1-slim.3)

CLI env/exit/harness tables live in `docs/sdd-h6-reference.md`. Orchestrator skills cite H1–H5 only; Read reference doc once per session when shelling H6.

### Claude Code — triple matcher + expansion

**File:** `hooks/hooks.json` — three `UserPromptExpansion` matchers (manifest-generated):

1. `^superpowers:` — prefixed upstream slash commands
2. Bare `/<upstream-slug>` — e.g. `/brainstorming`
3. `^/spor-<upstream-slug>` — e.g. `/spor-brainstorming`

All invoke `bin/override-prompt-expansion.sh`, which injects `additionalContext` containing **MANDATORY OVERRIDE** and the required `Skill(superpowers-overrides:spor-*)` first call.

Project `CLAUDE.md` self-check (from `/spor-init`) is fallback when hooks are unavailable.

### Self-check rules (both harnesses)

`/spor-init` writes committed generator output into the project:

- Cursor → `.cursor/rules/superpowers-overrides.mdc`
- Claude Code → `CLAUDE.md` override trigger table

On Cursor: hooks enforce on **upstream SKILL attach**; slash commands rely on these self-check rules as **primary** enforcement. On both harnesses:

- **Anti-pattern:** manually attach upstream `superpowers/*/SKILL.md` body — attach **`spor-*`** or use slash commands instead; upstream SKILL full text in context still requires Read/Skill `spor-*` first.

Manual smoke (Settings → Hooks → Execution Log):

1. `/brainstorming` + Grep first tool → **no deny** (no pending; self-check governs)
2. Attach upstream `brainstorming/SKILL.md` + Grep first tool → **deny** → Read spor SKILL → allow

## Manifest schema

**File:** `overrides.manifest.json`

```json
{
  "$schema": "./build/overrides-manifest.schema.json",
  "plugin": "superpowers-overrides",
  "targets": [
    {
      "name": "spor-brainstorming",
      "overrides": "superpowers:brainstorming",
      "source": "./skills/spor-brainstorming"
    }
  ]
}
```

| Field | Description |
|-------|-------------|
| `plugin` | Override plugin namespace name |
| `name` | Canonical skill id in all harnesses (starts with `spor-`) |
| `overrides` | Upstream `plugin:skill` id to intercept |
| `source` | Path to canonical skill directory |

**Upstream slug for trigger tables:** parse from `overrides` (`superpowers:brainstorming` → `brainstorming`).

## Naming rule

All skills in this plugin use the `spor-` prefix in directory name and frontmatter `name`:

- Override targets: `spor-{upstream-slug}` (e.g. `spor-brainstorming` overrides `superpowers:brainstorming`)
- Cross-cutting: `spor-init`, `spor-subagent-lifecycle`, `spor-token-efficient-review-dispatch`

Init entry point: `/spor-init` (Claude Code: `/superpowers-overrides:spor-init`).

## Build commands

```bash
pnpm run generate:overrides    # write committed generator outputs
pnpm run validate:overrides    # --check drift
./plugins/superpowers-overrides/tests/validate-overrides-build.sh
```

Regenerate after editing `overrides.manifest.json` or generator templates.

## Plugin discovery fallback (Cursor)

Skills ship under `plugins/superpowers-overrides/skills/` in the plugin tree. After marketplace install, verify all 13 `spor-*` skills appear in the agent skills list.

If override skills are missing (Team Marketplace blocked or third-party import disabled):

```bash
mkdir -p .cursor/skills
cp -R path/to/plugins/superpowers-overrides/skills/* .cursor/skills/
cp -R path/to/plugins/superpowers/skills/* .cursor/skills/   # upstream, separate plugin
```

Then run init for `.cursor/rules/superpowers-overrides.mdc`.

## Cursor setup

1. Install `superpowers` + `superpowers-overrides` from the marketplace.
2. Run `/spor-init` in Cursor (copies or refreshes `build/generated/cursor-self-check.mdc` → `.cursor/rules/superpowers-overrides.mdc`; re-run after plugin upgrade if rules are stale).
3. Invoke `/spor-brainstorming` directly, or use upstream slash commands — slash triggers rely on project self-check rules; hooks enforce on upstream SKILL attach only.

Manual verification: same as [Self-check rules](#self-check-rules-both-harnesses) smoke bullets above.

## SDD CLI harness scripts (p1)

Token-efficient SDD orchestration uses plugin-bundled scripts under `bin/` — referenced by `spor-token-efficient-controller-handoff` (H6) and `spor-subagent-driven-development`. Orchestrator resolves harness once per plan; scripts do **not** re-detect CLI at runtime.

| Harness | Task script | Plan script | Ship level |
|---------|-------------|-------------|------------|
| **cursor** | `sdd-run-task-cursor.sh` | `sdd-run-plan-cursor.sh` | **Full** — `cursor agent --print --output-format text --force` |
| **claude** | `sdd-run-task-claude.sh` | `sdd-run-plan-claude.sh` | **Full** — `claude -p … --output-format text --dangerously-skip-permissions` |
| **codex** | `sdd-run-task-codex.sh` | `sdd-run-plan-codex.sh` | **Stub** — exit 1 BLOCKED |
| **copilot** | `sdd-run-task-copilot.sh` | `sdd-run-plan-copilot.sh` | **Stub** — exit 1 BLOCKED |
| **gemini** | `sdd-run-task-gemini.sh` | `sdd-run-plan-gemini.sh` | **Stub** — exit 1 BLOCKED |

Shared library: `bin/lib/sdd-common.sh` — workspace path contract (`SDD_WORKSPACE`, `SDD_LEDGER`, …), plugin root resolution, exit codes (0 OK; 1 BLOCKED/stub; 2 CLI missing), **and the shared task/plan run-loop**: `sdd_run_task` (one mode per invocation) / `sdd_run_plan` (pending tasks × 3-mode chain). Harness shells (`sdd-run-task-<harness>.sh`, `sdd-run-plan-<harness>.sh`) are thin wrappers keeping only the **irreducible differences** — CLI invocation flags, review prefix parameter, and the plan's task-script path + label — so claude/cursor shells cannot drift apart. The same lib hosts the **post-run commit gate** (`sdd_validate_commit_contract`): implement/fix modes validate a clean working tree on return (dirty → handoff rewritten `status: BLOCKED` + non-zero exit; fail-open on non-git / git error). See [sdd-h6-reference.md](sdd-h6-reference.md) (§ Post-run commit gate).

### Invocation modes

**Mode A (per task):** orchestrator calls one mode per CLI invocation:

```bash
{plugin_root}/bin/sdd-run-task-<harness>.sh --task N --mode implement|review|fix
```

**Mode B (plan driver / AFK):** batch pending tasks from plan + ledger:

```bash
{plugin_root}/bin/sdd-run-plan-<harness>.sh --plan <path>
```

Plan driver invokes sibling task script per mode. Ledger append on APPROVED only.

### Exit codes and fallback

| Exit | Meaning | Orchestrator action |
|------|---------|---------------------|
| 0 | Success | Continue chain |
| 1 | BLOCKED (stub harness or explicit block) | Stop — **not** p0 fallback |
| 2 | CLI not in PATH | Silent p0 in-session fallback |

Stub harness selected → exit 1 → orchestrator **BLOCKED**. No `--resume` or session-carry flags (H6.5).

**CI:** `tests/validate-overrides-build.sh` asserts all 10 harness scripts + `bin/lib/sdd-common.sh` exist and are executable.

Templates: `templates/sdd-cli/` (implement, review, fix) + `_handoff-write-fragment.md`.

## Deferred harnesses (documented, not built)

| Harness | Rules output (future) | SDD CLI (p1) |
|---------|----------------------|--------------|
| Codex / Copilot / Mistral Vibe | `AGENTS.md` section | Stub scripts (exit 1) |
| Gemini CLI | `.gemini/GEMINI.md` | Stub scripts (exit 1) |
| OpenCode / Pi / Qoder / Rovo / Kiro | Per harness config file | Not built |

See [impeccable/docs/HARNESSES.md](../../impeccable/docs/HARNESSES.md) for directory mappings.

## Adoption guide (third-party marketplaces)

1. **Manifest** — add `overrides.manifest.json` with `name`, upstream `overrides` id, and `source` path per target.
2. **Naming** — use a plugin-level prefix on all skill ids to avoid flat-namespace dedup with upstream (e.g. `spor-*`, `terreno-*`, `cds-*`).
3. **Generators** — share `manifest_targets.py`; commit hook + self-check outputs; CI `--check` on drift.
4. **Init** — copy or refresh committed `build/generated/*` at runtime; never run generators in init. Generated self-check files embed `superpowers-overrides-version` (Cursor frontmatter / Claude HTML comment) stamped from `.claude-plugin/plugin.json`; `/spor-init` compares project rules against installed version and overwrites when missing or stale.

Copy JSON schema, generator scripts, and `validate-overrides-build.sh` from this plugin as a starting point.

## Phase 2 (not v1)

- NL keyword interception in rules self-check
- Emit rules for Codex / Copilot / Gemini from the same manifest
- Agent Skills spec proposal for `overrides` / `extends` frontmatter
- Cursor product request for native `plugin:skill` namespace
