# oscaner

[![CI](https://github.com/Oscaner/skills/actions/workflows/ci.yml/badge.svg)](https://github.com/Oscaner/skills/actions/workflows/ci.yml)

Personal [Claude Code](https://claude.com/claude-code) plugin marketplace. Packages skills as installable plugins — Markdown + JSON manifests, plus pnpm/changesets for `superpowers-overrides` releases and CI validation.

## Installation

Add this marketplace to Claude Code, then install any plugin from it:

```bash
# In Claude Code
/plugin marketplace add oscaner/skills
/plugin install mattpocock-skills@oscaner
/plugin install superpowers@oscaner
/plugin install superpowers-overrides@oscaner
```

Cloning this repo directly (rather than installing via the marketplace) requires initializing the `mattpocock-skills` submodule:

```bash
git clone https://github.com/Oscaner/skills.git
cd skills
git submodule update --init
```

To bump the pinned `mattpocock-skills` revision later: `git submodule update --remote mattpocock-skills` and commit the pointer with a `chore:` message.

## Plugins

### [mattpocock-skills](plugins/mattpocock-skills/)

Vendored as a git submodule tracking [`mattpocock/skills`](https://github.com/mattpocock/skills). Not edited in-tree — this marketplace just re-exports it so the overrides below can delegate to `mattpocock-skills:grilling`, `mattpocock-skills:tdd`, and `mattpocock-skills:to-tickets`.

### [superpowers-overrides](plugins/superpowers-overrides/)

Personal overrides for the upstream [`superpowers`](https://github.com/obra/superpowers) plugin. Each override wraps a specific `superpowers:*` skill; when the upstream skill fires (via `/<name>` command, a `<command-name>` tag, a `Skill` tool call, or its body appearing in the current turn's system context), the override MUST run **first** — as the very first tool call of that turn — before any exploration, `TodoWrite`, or upstream-skill-body instruction. The override then either **replaces** the upstream skill's default behavior or **delegates** to a [`mattpocock-skills`](https://github.com/mattpocock/skills) skill.

Precedence is enforced by three coordinated mechanisms — each override's `description` (which lists all four trigger sources verbatim and specifies "FIRST tool call this turn"), a `UserPromptExpansion` hook that injects an `additionalContext` reminder on slash-command trigger, and a **project-level CLAUDE.md self-check** written by `/superpowers-overrides:init`. Run `init` once per project to prepend the override trigger table to the project's `CLAUDE.md`; this is the primary enforcement mechanism and fires before any skill body is loaded.

| Override skill | Overrides | What it does |
|---|---|---|
| `init` | — | Writes the override self-check trigger table to the current project's `CLAUDE.md` (prepended at top). Run once per project; primary enforcement mechanism for overrides. |
| `brainstorming-overrides` | `superpowers:brainstorming` | Replaces self-review with up to 3 fresh-subagent passes (Completeness → Consistency → Clarity); delegates requirements-gathering to `mattpocock-skills:grilling` (one question at a time, no batching). |
| `writing-plans-overrides` | `superpowers:writing-plans` | Forces incremental section-by-section writes; replaces self-review with up to 3 fresh-subagent passes; delegates ticket breakdown to `/to-tickets` with a hard user-approval gate, then publishes as a single `docs/superpowers/tickets/YYYY-MM-DD-<feature>-tickets.md` (sibling to `specs/` and `plans/`) — no remote tracker. |
| `subagent-driven-development-overrides` | `superpowers:subagent-driven-development` | Scales review rounds to task complexity (Simple = 1 round, Complex = up to 3); batches related simple tasks; delegates implementation to `mattpocock-skills:tdd`. |
| `using-git-worktrees-overrides` | `superpowers:using-git-worktrees` | Refuses worktree creation entirely (per user policy in `~/.claude/CLAUDE.md`); offers branch-based isolation (`git checkout -b`, `git stash`) instead; propagates refusal back to caller skills (writing-plans, executing-plans, sdd, finishing-a-development-branch) that request worktree setup as a sub-step. |
| `executing-plans-overrides` | `superpowers:executing-plans` | Redirects to `subagent-driven-development` when subagents are available (upstream itself recommends this); routes worktree sub-step through `using-git-worktrees-overrides` (refuse); delegates task implementation to `mattpocock-skills:tdd`; enforces per-task conventional commits per user CLAUDE.md. |
| `finishing-a-development-branch-overrides` | `superpowers:finishing-a-development-branch` | Collapses environment detection to normal-repo only (no worktree branch); drops Step 6 (Cleanup Workspace) entirely; enforces conventional commits and no attribution trailer on both merge commits and PR bodies. |
| `systematic-debugging-overrides` | `superpowers:systematic-debugging` | Gates fix proposals behind diagnostic evidence (Rule 1); delegates diagnosis loop to `mattpocock-skills:diagnosing-bugs` (Rule 2). |
| `test-driven-development-overrides` | `superpowers:test-driven-development` | Confirms test seams with user before starting (blocking, Rule 2); delegates full TDD loop to `mattpocock-skills:tdd` (Rule 1). |
| `verification-before-completion-overrides` | `superpowers:verification-before-completion` | Pre-claim gate: invokes upstream before any completion claim (Rule 1); self-check banning softening language without verification evidence (Rule 2). |
| `receiving-code-review-overrides` | `superpowers:receiving-code-review` | Delegates unclear feedback clarification to `mattpocock-skills:grilling` (Rule 1); delegates each non-mechanical fix to `mattpocock-skills:tdd` (Rule 2). |
| `subagent-lifecycle` | *cross-cutting* | Invoked by reference from every review override and every parallel-agent dispatch. Enforces **fresh** subagent per pass and **concurrent iff independent** dispatch. Never a slash command. |
| `token-efficient-review-dispatch` | *cross-cutting* | Invoked by reference from every review override. Defines the three dispatch mechanisms (D1 escalate-on-finding, D2 delta review, D3 findings-only output) in one place — overrides cite instead of copy-paste. Never a slash command. |

Both cross-cutting skills exist to prevent copy-paste drift across overrides: `subagent-lifecycle` owns the "fresh + concurrent-iff-independent" invariant, `token-efficient-review-dispatch` owns the D1/D2/D3 mechanisms. Each review override cites both by link rather than repeating their content — when the invariants change, one edit propagates.

## Repository layout

```
marketplace/source.json              # canonical registry (human-edited)
.claude-plugin/marketplace.json    # generated — Claude Code marketplace
.cursor-plugin/marketplace.json    # generated — Cursor Team Marketplace
cursor-plugins/                    # generated Cursor plugin wrappers
plugins/<plugin>/                  # vendored + first-party plugin trees
plugins/<plugin>/.claude-plugin/plugin.json
plugins/<plugin>/skills/<skill>/SKILL.md
```

Edit [marketplace/source.json](marketplace/source.json), then `pnpm run emit && pnpm run validate`. Do not hand-edit generated marketplace files.

## System prompt wiring

**Hooks-based reminder:** A `UserPromptExpansion` hook injects an `additionalContext` reminder when `/superpowers:*` slash commands are triggered. Requires `jq` (`brew install jq` on macOS).

**Primary enforcement — project CLAUDE.md:** Run `/superpowers-overrides:init` once per project. It prepends the override self-check trigger table to the project's `CLAUDE.md`, which fires before any skill body is loaded into context and is the most reliable enforcement mechanism.

**Upgrading from global config:** If you previously added the override trigger table to `~/.claude/CLAUDE.md`, you can remove it and run `init` in each project instead.

## Usage

### First-time setup per project

After installing the plugin, run this once in each project where you want overrides to be enforced:

```
/superpowers-overrides:init
```

This prepends the override trigger table to the project's `CLAUDE.md`. From then on, `/superpowers:brainstorming` (and all other `superpowers:*` skills) will automatically invoke their override counterpart first.

To add to the global `~/.claude/CLAUDE.md` instead (applies to all projects):

```
/superpowers-overrides:init    # then tell the AI: "add to global"
```

### Using overrides

Once `init` has run, use the upstream skill commands as normal — overrides fire automatically:

| You type | What runs first | Then |
|---|---|---|
| `/superpowers:brainstorming` | `superpowers-overrides:brainstorming-overrides` | delegates clarifying questions to `mattpocock-skills:grilling` |
| `/superpowers:writing-plans` | `superpowers-overrides:writing-plans-overrides` | section-by-section writes, subagent review passes |
| `/superpowers:subagent-driven-development` | `superpowers-overrides:subagent-driven-development-overrides` | complexity-based review rounds |
| `/superpowers:systematic-debugging` | `superpowers-overrides:systematic-debugging-overrides` | gates fix proposals behind diagnostic evidence |
| `/superpowers:test-driven-development` | `superpowers-overrides:test-driven-development-overrides` | seams confirmation before delegating to `mattpocock-skills:tdd` |

All other `superpowers:*` skills follow the same pattern — see the override table above.

### Using overrides in Cursor

Cursor uses a flat skill namespace — override skills share one canonical tree with Claude Code under `plugins/superpowers-overrides/skills/`. Override targets use the `-overrides` suffix (e.g. `brainstorming-overrides`) so they never deduplicate with upstream `superpowers` skills.

#### Team Marketplace (recommended)

1. **Admin:** Cursor Dashboard → Settings → Plugins → Team Marketplaces → Import → `https://github.com/Oscaner/skills`
2. **Member:** Customize → Plugins → install `superpowers`, `superpowers-overrides`, and any other plugins you need
3. **Per project:** run init (writes `.cursor/rules/superpowers-overrides.mdc`)
4. **Verify:** Agent skills list shows `brainstorming` and `brainstorming-overrides`; `/brainstorming-overrides` works

#### Claude Code marketplace (same repo)

```bash
/plugin marketplace add oscaner/skills
/plugin install superpowers@oscaner
/plugin install superpowers-overrides@oscaner
```

If override skills do not appear after install, see the discovery fallback in [plugins/superpowers-overrides/docs/cross-harness-overrides.md](plugins/superpowers-overrides/docs/cross-harness-overrides.md).

After editing override skills, manifest, or generators:

```bash
pnpm run generate:overrides   # when manifest or generator templates change
pnpm run emit                 # regenerate marketplace manifests
pnpm run validate
```

See [.changeset/README.md](.changeset/README.md) for release/changeset workflow.

Manual smoke checklist: [plugins/superpowers-overrides/docs/CURSOR-SMOKE.md](plugins/superpowers-overrides/docs/CURSOR-SMOKE.md).

## Releasing

Only `superpowers-overrides` is versioned from this marketplace. Tags: `superpowers-overrides@{superpowers-version}-overrides.{N}` (e.g. `superpowers-overrides@6.2.0-overrides.1`).

| Change | What to do |
|--------|------------|
| Overrides skill / manifest / build | `pnpm changeset` → PR → merge → merge Version PR → tag |
| Superpowers submodule bump | Update pointer + `marketplace/source.json` superpowers version → `pnpm run emit` → PR → merge (align changeset auto-created) |

Changelog: [plugins/superpowers-overrides/CHANGELOG.md](plugins/superpowers-overrides/CHANGELOG.md) (created on first release).

### How the override system works

While hooks now handle auto-triggering, understanding the three-part mechanism is useful for contributors:

1. **Hook-based reminder** — The `UserPromptExpansion` hook in `plugins/superpowers-overrides/hooks/hooks.json` (matcher `^superpowers:`) fires when a `/superpowers:*` slash command is typed, injecting an `additionalContext` reminder to call the override first.
2. **Anti-pattern naming** — Upstream `SKILL.md` bodies open with a numbered "You MUST" checklist so consistently that the pattern needs an explicit name; without it the model reads the checklist and starts executing it. The hook's message names this failure mode. A closely related failure — the **handoff-continuation rationalization** — is also named: when the upstream body arrives as a tool result of a prior `Skill(...)` call, the model treats it as a natural continuation and skips the override.
3. **Project CLAUDE.md self-check** — Written by `/superpowers-overrides:init`. Prepended to the project's `CLAUDE.md`, it enumerates every trigger → override mapping. This fires in every turn via the system prompt and is the strongest enforcement layer.

## Contributing to your own fork

New rules for an existing override go **inside** that override skill as `Rule N` — never in your global `~/.claude/CLAUDE.md`. Each override marks the insertion point with `<!-- Additional rules … -->`.

New override skills follow the fixed shape:

- **Frontmatter `description`** — starts with `MUST invoke BEFORE superpowers:<target> as your FIRST tool call this turn` and then enumerates all four trigger sources explicitly: (1) the `/<slash-command>` (both bare and `superpowers:`-prefixed forms), (2) `<command-name>` tags naming either form, (3) the upstream skill body appearing in the current turn's system context, (4) natural-language scenarios (verbs, keyword synonyms in whatever languages the user works in). Precedence-critical: describe the trigger via **user-turn-observable** signals, and require the override as the *first* tool call — never phrase it as "when target skill is active" (unobservable) or "typically before" (soft).
- **Body** — opens with `## Rules`, closes with `## Red Flags` and `## Common Rationalizations`. Each rule takes one of three shapes: **replaces** (upstream default → your behavior), **delegates** (route the step to a `mattpocock-skills:*` skill), or **partial-delegate** (wrap the upstream skill's Steps 0–K unchanged, override Step K+1 locally — `writing-plans` Rule 3 is the canonical example, delegating `/to-tickets` Steps 1–4 verbatim and overriding Step 5's publish target). When a single rule needs multiple enforcement mechanisms (locate, redirect, structure the user-quiz…), decompose it into sub-rules `Rule Na` / `Rule Nb` / `Rule Nc` under one umbrella heading rather than as sibling top-level rules.

See [CLAUDE.md](CLAUDE.md) for the full pattern.

## License

Personal use. No warranty. Adapt freely for your own setup.
