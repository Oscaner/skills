# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository purpose

This is a **Claude Code plugin marketplace** (not a runtime codebase). It packages personal skills as installable plugins consumed by Claude Code itself. There is no build step, no test suite, no package manager — content is plain Markdown + JSON, discovered by Claude Code via the marketplace/plugin manifest chain.

## Plugins registered here

Two plugins are declared in [.claude-plugin/marketplace.json](.claude-plugin/marketplace.json):

1. **`mattpocock-skills`** — vendored as a **git submodule** at [mattpocock-skills/](mattpocock-skills/) tracking `https://github.com/mattpocock/skills.git` (see [.gitmodules](.gitmodules)). Do **not** edit files under this directory in-tree; changes belong upstream. To update the pinned revision, run `git submodule update --remote mattpocock-skills` and commit the pointer bump with a `chore:` message. Fresh clones need `git submodule update --init` before Claude Code can resolve `mattpocock-skills:*` skill references (e.g. `grilling`, `tdd`, `to-issues`) that the overrides delegate to.
2. **`mattpocock-superpowers`** — first-party, edited in-tree. This is where new override skills go.

## Marketplace → plugin → skill chain

Three levels of manifest wire everything together; changing a skill's location means updating one file at each level:

1. [.claude-plugin/marketplace.json](.claude-plugin/marketplace.json) — top-level `oscaner-skills` marketplace. Registers plugins by relative `source` path. Adding a new plugin means adding an entry to `plugins[]` here.
2. `<plugin>/.claude-plugin/plugin.json` — e.g. [mattpocock-superpowers/.claude-plugin/plugin.json](mattpocock-superpowers/.claude-plugin/plugin.json). Registers skills by relative directory path. Adding a new skill to a plugin means adding its directory to `skills[]` here.
3. `<plugin>/skills/<skill-name>/SKILL.md` — the skill itself. Frontmatter (`name`, `description`) is what Claude Code's Skill matcher scans on every user turn. The `description` is the discovery signal — write it as a **user-prompt-observable** trigger (`MUST invoke BEFORE superpowers:<target> — trigger when the user asks to <verb>, <verb>, or types /<slash-command>`). Framings like "Use whenever <other skill> is active" do not work: the matcher only sees the current user prompt, not which other skills are running.

If a skill's SKILL.md exists on disk but is not listed in the plugin's `skills[]`, Claude Code will not find it. This is the most common breakage.

## The overrides pattern (mattpocock-superpowers)

The [mattpocock-superpowers](mattpocock-superpowers/) plugin's whole purpose is to **override** upstream `superpowers:*` skills without forking them. Each override skill follows a fixed shape:

- Frontmatter `description` starts with `MUST invoke BEFORE superpowers:<target>` and enumerates the user-facing scenarios (verbs, slash commands, keyword synonyms) that should trigger the match. The matcher selects skills from **user prompt semantics** on every turn — a description phrased as "when target skill is active" describes an unobservable condition and will never fire.
- Body opens with `## Rules`, numbered `Rule 1`, `Rule 2`, … Each rule either **replaces** upstream behavior (self-review → fresh-subagent passes) or **delegates** to a `mattpocock-skills:*` skill (grilling, tdd, to-issues).
- Body closes with `## Red Flags` (thoughts that should stop you) and `## Common Rationalizations` (excuse → reality table). Both are load-bearing — the override is designed to catch drift, so removing these sections defeats the point.
- New rules go **inside** the override skill as `Rule N`, never in the user's global `~/.claude/CLAUDE.md`. The HTML comment `<!-- Additional rules … -->` marks the insertion point.

The user's global `~/.claude/CLAUDE.md` (personal, outside this repo) carries a short **index block** listing each override and its upstream target — advisory context for the model, not the trigger itself. The canonical form lives in [README.md](README.md) under "System prompt wiring" — treat it as the source of truth when adding a new override (bump the table there in the same commit). The reliable trigger is the SKILL.md `description`; the CLAUDE.md block just makes the overrides discoverable in system context.

## Cross-cutting: subagent-lifecycle

[mattpocock-superpowers/skills/subagent-lifecycle/SKILL.md](mattpocock-superpowers/skills/subagent-lifecycle/SKILL.md) is not an override — it's a cross-cutting policy referenced by every other override's Rule 2 (self-review). Its two rules (**fresh** subagent per pass; concurrent iff passes are independent) are load-bearing across the plugin. When editing any override that dispatches review passes, keep it consistent with subagent-lifecycle — don't add serial ordering unless the passes genuinely share state, and don't reuse subagents across rounds.

## Token-efficient dispatch (D1/D2/D3)

Both `brainstorming-overrides` and `writing-plans-overrides` share a three-mechanism dispatch discipline for their review passes. When editing these skills or adding new ones with multi-pass review, keep the same names so they remain grep-able:

- **D1 escalate-on-finding** — Pass 1 alone; skip 2 & 3 iff Pass 1 returned zero findings and enumerated its checklist.
- **D2 delta review** — Later passes receive only changed sections + diff summary, except the final global-coherence pass which receives the full document.
- **D3 findings-only output** — Reviewer output schema is `{findings: [{lens, severity, section|file, line?, summary, fix}]}`. Empty array = approve. No summaries, no positive commentary.

## Git conventions for this repo

- Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`).
- No attribution / co-author / AI-generation trailers in commit messages.
- No `git worktree` — forbidden by user policy.
- `git add -f` on a gitignored file requires explicit user confirmation.
