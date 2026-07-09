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

Personal overrides for the upstream [`superpowers`](https://github.com/obra/superpowers) plugin. Each override skill's own `description` declares its trigger — typically **"MUST invoke BEFORE `superpowers:<target>`"** — so Claude Code's Skill matcher selects the override from the user's prompt semantics, not from an unobservable "target skill is active" condition. The override then either **replaces** the upstream skill's default behavior or **delegates** to a [`mattpocock-skills`](https://github.com/mattpocock/skills) skill.

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

Installing the plugin makes the override skills discoverable by Claude Code's Skill matcher — no extra CLAUDE.md wiring is required to trigger them, because each override's own `description` names the user-facing scenarios (`brainstorm`, `write a plan`, `dispatch subagents`, …) the matcher looks for. What CLAUDE.md still adds is a **discoverable index**: a short block telling the model these overrides exist and which upstream skill each one shadows. Add the following to your global `~/.claude/CLAUDE.md` (or the equivalent system-level instructions for your setup):

```markdown
## Skills

Check for a relevant skill before any task; if there's a >1% chance one applies, invoke it.

Personal override skills sit in front of upstream `superpowers:*` skills — each override's own `description` states when to invoke it (typically **before** its upstream target fires). New personal rules go inside the override skill, not this file. Overrides may delegate further to `mattpocock/skills` — details in each override.

| Override skill | Target |
|---|---|
| `brainstorming-overrides` | `superpowers:brainstorming` |
| `writing-plans-overrides` | `superpowers:writing-plans` |
| `subagent-driven-development-overrides` | `superpowers:subagent-driven-development` |
| `subagent-lifecycle` | Cross-cutting — any subagent/Agent dispatch |
```

The mapping block is advisory (Claude reads it, may or may not act on it); the reliable trigger is the `description` on each SKILL.md, which Claude Code's Skill tool matches against every user turn.

## Contributing to your own fork

New rules for an existing override go **inside** that override skill as `Rule N` — never in your global `~/.claude/CLAUDE.md`. Each override marks the insertion point with `<!-- Additional rules … -->`.

New override skills follow the fixed shape:

- **Frontmatter `description`** — starts with `MUST invoke BEFORE superpowers:<target>` and then enumerates the user-facing scenarios that should trigger the match ("when the user asks to …", the corresponding `/slash-command`, keyword synonyms in whatever languages the user works in). Avoid framing the trigger around "when target skill is active" — the matcher cannot observe that condition and will never select the override.
- **Body** — opens with `## Rules`, closes with `## Red Flags` and `## Common Rationalizations`.

See [CLAUDE.md](CLAUDE.md) for the full pattern.

## License

Personal use. No warranty. Adapt freely for your own setup.
