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

Vendored as a git submodule tracking [`mattpocock/skills`](https://github.com/mattpocock/skills). Not edited in-tree — this marketplace just re-exports it so the overrides below can delegate to `mattpocock-skills:grilling`, `mattpocock-skills:tdd`, and `mattpocock-skills:to-tickets`.

### [mattpocock-superpowers](mattpocock-superpowers/)

Personal overrides for the upstream [`superpowers`](https://github.com/obra/superpowers) plugin. Each override wraps a specific `superpowers:*` skill; when the upstream skill fires (via `/<name>` command, a `<command-name>` tag, a `Skill` tool call, or its body appearing in the current turn's system context), the override MUST run **first** — as the very first tool call of that turn — before any exploration, `TodoWrite`, or upstream-skill-body instruction. The override then either **replaces** the upstream skill's default behavior or **delegates** to a [`mattpocock-skills`](https://github.com/mattpocock/skills) skill.

Precedence is enforced by three coordinated mechanisms — each override's `description` (which lists all four trigger sources verbatim and specifies "FIRST tool call this turn"), a mandatory pre-flight self-check block in the user's global `~/.claude/CLAUDE.md` (see [System prompt wiring](#system-prompt-wiring) below), and an anti-pattern naming block inside that same self-check that calls out the "upstream body's numbered `You MUST` checklist" as the specific failure mode being guarded against. None is optional; the three together are what keep the model from being dragged into the upstream skill's checklist before the override has a chance to reshape the flow.

| Override skill | Overrides | What it does |
|---|---|---|
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
.claude-plugin/marketplace.json    # top-level marketplace manifest
<plugin>/.claude-plugin/plugin.json  # per-plugin manifest (lists skills)
<plugin>/skills/<skill>/SKILL.md   # the skill itself (frontmatter + rules)
```

Every level's manifest must reference the level below it. A SKILL.md that exists on disk but isn't listed in its plugin's `skills[]` is invisible to Claude Code.

## System prompt wiring

**Hooks-based auto-override:** Override skills trigger automatically via plugin-bundled hooks. No manual `~/.claude/CLAUDE.md` configuration required. Install the plugin and the hooks activate on first session.

**Requirement:** `jq` must be installed (`brew install jq` on macOS). If absent, Claude Code displays a warning and overrides do not auto-trigger.

**Upgrading from manual config:** If you previously added the override trigger table to `~/.claude/CLAUDE.md`, you can remove it — hooks are now the sole enforcement mechanism.

### How the override system works

While hooks now handle auto-triggering, understanding the three-part mechanism is useful for contributors:

1. **Hook-based interception** — The hook registrations in `mattpocock-superpowers/hooks/hooks.json` (two events: `UserPromptExpansion` for slash commands, `PostToolUse` for skill handoffs) scans each turn for upstream `superpowers:*` skill triggers (`<command-name>` tag, `/slash-command`, inlined skill body, or about-to-fire `Skill` call) and dispatches the corresponding override skill as the very first tool call before any exploration or upstream-skill-body instruction. This replaces the manual CLAUDE.md self-check that was previously required.
2. **Anti-pattern naming** — Upstream `SKILL.md` bodies open with a numbered "You MUST" checklist so consistently that the pattern needs an explicit name in the hook's dispatch message; without it the model reads the checklist and starts executing it, treating both "MUST"s as equally authoritative. Naming the pattern turns it into a stop signal instead of an imperative. A closely related failure mode — the **handoff-continuation rationalization** — is named alongside it: when the upstream body arrives as a *tool result* of a prior `Skill(...)` call (a skill-to-skill handoff, e.g. brainstorming → writing-plans), the model treats it as a natural next step of a flow it's already inside and skips the override. Both patterns need to be named in the hook's message; naming one without the other leaves the second hole open.
3. **The exhaustive trigger list** — The hook scripts (`bin/override-prompt-expansion.sh` and `bin/override-skill-handoff.sh`) enumerates every entry point (command tag, slash command, inlined body, about-to-fire `Skill` call) verbatim. Missing any entry point creates a hole the model will find.

## Contributing to your own fork

New rules for an existing override go **inside** that override skill as `Rule N` — never in your global `~/.claude/CLAUDE.md`. Each override marks the insertion point with `<!-- Additional rules … -->`.

New override skills follow the fixed shape:

- **Frontmatter `description`** — starts with `MUST invoke BEFORE superpowers:<target> as your FIRST tool call this turn` and then enumerates all four trigger sources explicitly: (1) the `/<slash-command>` (both bare and `superpowers:`-prefixed forms), (2) `<command-name>` tags naming either form, (3) the upstream skill body appearing in the current turn's system context, (4) natural-language scenarios (verbs, keyword synonyms in whatever languages the user works in). Precedence-critical: describe the trigger via **user-turn-observable** signals, and require the override as the *first* tool call — never phrase it as "when target skill is active" (unobservable) or "typically before" (soft).
- **Body** — opens with `## Rules`, closes with `## Red Flags` and `## Common Rationalizations`. Each rule takes one of three shapes: **replaces** (upstream default → your behavior), **delegates** (route the step to a `mattpocock-skills:*` skill), or **partial-delegate** (wrap the upstream skill's Steps 0–K unchanged, override Step K+1 locally — `writing-plans-overrides` Rule 3 is the canonical example, delegating `/to-tickets` Steps 1–4 verbatim and overriding Step 5's publish target). When a single rule needs multiple enforcement mechanisms (locate, redirect, structure the user-quiz…), decompose it into sub-rules `Rule Na` / `Rule Nb` / `Rule Nc` under one umbrella heading rather than as sibling top-level rules.

See [CLAUDE.md](CLAUDE.md) for the full pattern.

## License

Personal use. No warranty. Adapt freely for your own setup.
