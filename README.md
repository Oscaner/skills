# oscaner-skills

Personal [Claude Code](https://claude.com/claude-code) plugin marketplace. Packages skills as installable plugins — no build step, no runtime, just Markdown + JSON that Claude Code discovers via its plugin manifest chain.

## Installation

Add this marketplace to Claude Code, then install any plugin from it:

```bash
# In Claude Code
/plugin marketplace add oscaner/oscaner-skills
/plugin install mattpocock-skills@oscaner-skills
/plugin install mattpocock-superpowers@oscaner-skills
```

Cloning this repo directly (rather than installing via the marketplace) requires initializing the `mattpocock-skills` submodule:

```bash
git clone https://github.com/oscaner/oscaner-skills.git
cd oscaner-skills
git submodule update --init
```

To bump the pinned `mattpocock-skills` revision later: `git submodule update --remote mattpocock-skills` and commit the pointer with a `chore:` message.

## Plugins

### [mattpocock-skills](mattpocock-skills/)

Vendored as a git submodule tracking [`mattpocock/skills`](https://github.com/mattpocock/skills). Not edited in-tree — this marketplace just re-exports it so the overrides below can delegate to `mattpocock-skills:grilling`, `mattpocock-skills:tdd`, and `mattpocock-skills:to-issues`.

### [mattpocock-superpowers](mattpocock-superpowers/)

Personal overrides for the upstream [`superpowers`](https://github.com/obra/superpowers) plugin. Each override wraps a specific `superpowers:*` skill; when the upstream skill fires (via `/<name>` command, a `<command-name>` tag, a `Skill` tool call, or its body appearing in the current turn's system context), the override MUST run **first** — as the very first tool call of that turn — before any exploration, `TodoWrite`, or upstream-skill-body instruction. The override then either **replaces** the upstream skill's default behavior or **delegates** to a [`mattpocock-skills`](https://github.com/mattpocock/skills) skill.

Precedence is enforced by two coordinated mechanisms — each override's `description` (which lists all four trigger sources verbatim and specifies "FIRST tool call this turn"), and a HARD PRECEDENCE RULE block in the user's global `~/.claude/CLAUDE.md` (see [System prompt wiring](#system-prompt-wiring) below). Neither is optional; the two together are what keep the model from being dragged into the upstream skill's checklist before the override has a chance to reshape the flow.

| Override skill | Overrides | What it does |
|---|---|---|
| `brainstorming-overrides` | `superpowers:brainstorming` | Replaces self-review with up to 3 fresh-subagent passes (Completeness → Consistency → Clarity); delegates requirements-gathering to `mattpocock-skills:grilling` (one question at a time, no batching). |
| `writing-plans-overrides` | `superpowers:writing-plans` | Forces incremental section-by-section writes; replaces self-review with up to 3 fresh-subagent passes; delegates issue breakdown to `/to-issues` with a hard user-approval gate. |
| `subagent-driven-development-overrides` | `superpowers:subagent-driven-development` | Scales review rounds to task complexity (Simple = 1 round, Complex = up to 3); batches related simple tasks; delegates implementation to `mattpocock-skills:tdd`. |
| `subagent-lifecycle` | *cross-cutting* | Referenced by every other override's review-pass rule. Enforces **fresh** subagent per pass and **concurrent iff independent** dispatch. |

All multi-pass overrides share a token-efficient dispatch discipline:

- **D1 escalate-on-finding** — Pass 1 runs alone; passes 2 & 3 skipped iff Pass 1 returns zero findings.
- **D2 delta review** — Later passes receive only changed sections + a diff summary, except the final global-coherence pass.
- **D3 findings-only output** — Reviewers return `{findings: [...]}` — no summaries, no positive commentary, empty array means approve.

## Repository layout

```
.claude-plugin/marketplace.json    # top-level marketplace manifest
<plugin>/.claude-plugin/plugin.json  # per-plugin manifest (lists skills)
<plugin>/skills/<skill>/SKILL.md   # the skill itself (frontmatter + rules)
```

Every level's manifest must reference the level below it. A SKILL.md that exists on disk but isn't listed in its plugin's `skills[]` is invisible to Claude Code.

## System prompt wiring

Installing the plugin makes the override skills discoverable — but discovery alone is not enough. When the upstream `superpowers:*` skill body enters the current turn's system context (which happens the moment a user types `/brainstorming`, `/writing-plans`, etc.), that body carries strong first-move instructions of its own ("first, do X"). Without a *hard* precedence rule, the model reads those instructions and starts executing them before the override ever gets a chance to fire.

The wiring below plants that hard rule in the user's global `~/.claude/CLAUDE.md`. Together with the four-trigger `description` on each SKILL.md (which names every possible entry point verbatim), it makes override invocation the mandatory first tool call whenever any listed upstream skill is triggered:

```markdown
## Skills

### Override precedence — check before your first tool call

If the incoming turn matches any trigger below, your **first tool call MUST be the override `Skill` call** — no `TodoWrite` / `Read` / `Bash` / `Grep` / `Edit` first, even if the upstream skill body says "you MUST do X first". That imperative doesn't apply until the override runs.

Triggers: `<command-name>` / `<command-message>` tag, `/superpowers:*` in user text, inlined upstream `SKILL.md` body, or an about-to-fire `Skill` call to the upstream.

| Trigger for | First tool call |
|---|---|
| `superpowers:brainstorming` | `Skill(brainstorming-overrides)` |
| `superpowers:writing-plans` | `Skill(writing-plans-overrides)` |
| `superpowers:subagent-driven-development` | `Skill(subagent-driven-development-overrides)` |
| Any Agent/subagent dispatch | `Skill(subagent-lifecycle)` |

Override `SKILL.md` is the source of truth for its rules; new personal rules go there, not here. Overrides may delegate to `mattpocock-skills`.

For any other task, check for a relevant skill first; if >1% chance one applies, invoke it.
```

The "first tool call MUST be" phrasing and the exhaustive trigger list are the load-bearing parts — softer wording ("typically before target fires", "when target is active") lets the model follow the upstream skill body's own first-move checklist and skip the override.

## Contributing to your own fork

New rules for an existing override go **inside** that override skill as `Rule N` — never in your global `~/.claude/CLAUDE.md`. Each override marks the insertion point with `<!-- Additional rules … -->`.

New override skills follow the fixed shape:

- **Frontmatter `description`** — starts with `MUST invoke BEFORE superpowers:<target> as your FIRST tool call this turn` and then enumerates all four trigger sources explicitly: (1) the `/<slash-command>` (both bare and `superpowers:`-prefixed forms), (2) `<command-name>` tags naming either form, (3) the upstream skill body appearing in the current turn's system context, (4) natural-language scenarios (verbs, keyword synonyms in whatever languages the user works in). Precedence-critical: describe the trigger via **user-turn-observable** signals, and require the override as the *first* tool call — never phrase it as "when target skill is active" (unobservable) or "typically before" (soft).
- **CLAUDE.md wiring** — add a row to the override-precedence table in [System prompt wiring](#system-prompt-wiring) in the same commit. The `description` alone is not enough; without the CLAUDE.md row the model will still follow the upstream skill's first-move instructions.
- **Body** — opens with `## Rules`, closes with `## Red Flags` and `## Common Rationalizations`.

See [CLAUDE.md](CLAUDE.md) for the full pattern.

## License

Personal use. No warranty. Adapt freely for your own setup.
