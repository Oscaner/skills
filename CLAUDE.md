# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository purpose

This is a **Claude Code plugin marketplace** (not a runtime codebase). It packages personal skills as installable plugins consumed by Claude Code itself. There is no build step, no test suite, no package manager — content is plain Markdown + JSON, discovered by Claude Code via the marketplace/plugin manifest chain.

## Plugins registered here

Two plugins are declared in [.claude-plugin/marketplace.json](.claude-plugin/marketplace.json):

1. **`mattpocock-skills`** — vendored as a **git submodule** at [mattpocock-skills/](mattpocock-skills/) tracking `https://github.com/mattpocock/skills.git` (see [.gitmodules](.gitmodules)). Do **not** edit files under this directory in-tree; changes belong upstream. To update the pinned revision, run `git submodule update --remote mattpocock-skills` and commit the pointer bump with a `chore:` message. Fresh clones need `git submodule update --init` before Claude Code can resolve `mattpocock-skills:*` skill references (e.g. `grilling`, `tdd`, `to-tickets`) that the overrides delegate to.
2. **`mattpocock-superpowers`** — first-party, edited in-tree. This is where new override skills go.

## Marketplace → plugin → skill chain

Three levels of manifest wire everything together; changing a skill's location means updating one file at each level:

1. [.claude-plugin/marketplace.json](.claude-plugin/marketplace.json) — top-level `oscaner-skills` marketplace. Registers plugins by relative `source` path. Adding a new plugin means adding an entry to `plugins[]` here.
2. `<plugin>/.claude-plugin/plugin.json` — e.g. [mattpocock-superpowers/.claude-plugin/plugin.json](mattpocock-superpowers/.claude-plugin/plugin.json). Registers skills by relative directory path. Adding a new skill to a plugin means adding its directory to `skills[]` here.
3. `<plugin>/skills/<skill-name>/SKILL.md` — the skill itself. Frontmatter (`name`, `description`) is what Claude Code loads into system context on every user turn. For override skills, `description` is one half of the precedence enforcement (the other half is the mandatory self-check in the user's global `~/.claude/CLAUDE.md` — see [The overrides pattern](#the-overrides-pattern-mattpocock-superpowers) below). Write it as `MUST invoke BEFORE superpowers:<target> as your FIRST tool call this turn — trigger on ANY of: (1) /<slash-command> (bare or superpowers:-prefixed); (2) <command-name> tag; (3) upstream skill body in system context; (4) natural-language <verbs>`. Framings like "Use whenever <other skill> is active" or "typically before target fires" do not work — the model reads the upstream skill body's own first-move instructions and starts executing them; only a hard "FIRST tool call this turn" phrasing paired with the CLAUDE.md rule reliably preempts that.

If a skill's SKILL.md exists on disk but is not listed in the plugin's `skills[]`, Claude Code will not find it. This is the most common breakage.

## The overrides pattern (mattpocock-superpowers)

The [mattpocock-superpowers](mattpocock-superpowers/) plugin's whole purpose is to **override** upstream `superpowers:*` skills without forking them. Each override skill follows a fixed shape:

- Frontmatter `description` starts with `MUST invoke BEFORE superpowers:<target> as your FIRST tool call this turn` and enumerates all four trigger sources explicitly: (1) `/<slash-command>` in both bare and `superpowers:`-prefixed forms; (2) `<command-name>` tags naming either form; (3) the upstream skill body appearing in the current turn's system context; (4) natural-language scenarios (verbs, synonyms). The "FIRST tool call" phrasing and the exhaustive trigger list are load-bearing — softer wording ("typically before target fires", "when target is active") lets the model follow the upstream skill body's own first-move checklist and skip the override.
- Body opens with `## Rules`, numbered `Rule 1`, `Rule 2`, … Each rule takes one of three shapes: (a) **replaces** upstream behavior (self-review → fresh-subagent passes); (b) **delegates** to a `mattpocock-skills:*` skill (grilling, tdd, to-tickets); (c) **partial-delegate** — wraps the upstream skill's Steps 0–K unchanged and overrides Step K+1 locally (writing-plans Rule 3 is the canonical example: Steps 1–4 of `/to-tickets` are delegated verbatim, Step 5 "publish" is redirected to a single local `docs/superpowers/issues/<date>-<feature>-tickets.md`, keeping the upstream single-file shape). Partial-delegate rules must state up front which steps are delegated and which are overridden — the split is what prevents Step K+1 from silently reverting to upstream defaults.
- When one rule has multiple internal enforcement mechanisms (e.g. "locate the delegate", "redirect publish target", "structure the user-approval quiz"), decompose it into sub-rules `Rule Na` / `Rule Nb` / `Rule Nc` under a single umbrella heading. Sub-rules are cheaper than sibling top-level rules when the mechanisms share a triggering context but attack different failure modes.
- Body closes with `## Red Flags` (thoughts that should stop you) and `## Common Rationalizations` (excuse → reality table). Both are load-bearing — the override is designed to catch drift, so removing these sections defeats the point.
- New rules go **inside** the override skill as `Rule N`, never in the user's global `~/.claude/CLAUDE.md`. The HTML comment `<!-- Additional rules … -->` marks the insertion point.

Precedence is enforced by **three coordinated mechanisms**, not one:

1. The four-trigger `description` above (SKILL.md side).
2. A **mandatory self-check block** in the user's global `~/.claude/CLAUDE.md` (personal, outside this repo) that requires a pre-flight scan for triggers before the first tool call of every turn, and maps each upstream skill to its override. The canonical form lives in [README.md](README.md) under "System prompt wiring" — treat it as the source of truth. When adding a new override, bump the table there **in the same commit** as the new SKILL.md; a description-only change is not enough, because the upstream skill body's own first-move instructions will otherwise win.
3. An **anti-pattern naming block** inside that same self-check, calling out two failure modes side-by-side: (a) upstream `SKILL.md` bodies routinely open with numbered "You MUST" checklists — and reading such a checklist and starting to execute it *is* the failure mode this rule guards against; (b) the **handoff-continuation rationalization** — when the upstream body arrives as the tool result of a prior `Skill(...)` call (a skill-to-skill handoff, e.g. brainstorming → writing-plans), the model treats it as a natural next step of a flow it's already inside and skips the self-check. Without the explicit naming of both, the model either treats two "MUST"s as equally authoritative and picks the one nearest to its action point (the upstream body, because it's inlined last), or excuses the whole self-check as "not applicable inside an ongoing flow". Name each pattern to turn it into a stop signal instead of an imperative or a permission slip.

## Cross-cutting skills

Two skills in `mattpocock-superpowers` are **not** overrides — they hold invariants that multiple overrides cite instead of duplicating. Neither has a slash command; they are invoked by reference from `Rule N` lines inside the overrides. Editing them propagates to every override that cites them.

- [mattpocock-superpowers/skills/subagent-lifecycle/SKILL.md](mattpocock-superpowers/skills/subagent-lifecycle/SKILL.md) — **fresh subagent per pass**, **concurrent iff independent** dispatch. Cited by every review override's review-pass rule. Independence means no data dependency (no reading Pass N-1's fixed output), not merely "different categories".
- [mattpocock-superpowers/skills/token-efficient-review-dispatch/SKILL.md](mattpocock-superpowers/skills/token-efficient-review-dispatch/SKILL.md) — **D1 escalate-on-finding**, **D2 delta review**, **D3 findings-only output**. Cited by every review override's review-pass rule. Its "final pass gets full doc, middle passes get delta" rule is the invariant that keeps global-coherence signal from being lost to token efficiency.

When editing any override that dispatches review passes, cite these skills rather than paraphrasing them — paraphrases drift; citations don't. When adding a new invariant that applies to multiple overrides, add a new rule to the appropriate cross-cutting skill and cite it, don't inline it across the overrides.

## Git conventions for this repo

- Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`).
- No attribution / co-author / AI-generation trailers in commit messages.
- No `git worktree` — forbidden by user policy.
- `git add -f` on a gitignored file requires explicit user confirmation.
