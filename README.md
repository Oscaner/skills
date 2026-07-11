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
| `writing-plans-overrides` | `superpowers:writing-plans` | Forces incremental section-by-section writes; replaces self-review with up to 3 fresh-subagent passes; delegates ticket breakdown to `/to-tickets` with a hard user-approval gate, then publishes as a single `docs/superpowers/issues/YYYY-MM-DD-<feature>-tickets.md` (sibling to `specs/` and `plans/`) — no remote tracker. |
| `subagent-driven-development-overrides` | `superpowers:subagent-driven-development` | Scales review rounds to task complexity (Simple = 1 round, Complex = up to 3); batches related simple tasks; delegates implementation to `mattpocock-skills:tdd`. |
| `using-git-worktrees-overrides` | `superpowers:using-git-worktrees` | Refuses worktree creation entirely (per user policy in `~/.claude/CLAUDE.md`); offers branch-based isolation (`git checkout -b`, `git stash`) instead; propagates refusal back to caller skills (writing-plans, executing-plans, sdd, finishing-a-development-branch) that request worktree setup as a sub-step. |
| `executing-plans-overrides` | `superpowers:executing-plans` | Redirects to `subagent-driven-development` when subagents are available (upstream itself recommends this); routes worktree sub-step through `using-git-worktrees-overrides` (refuse); delegates task implementation to `mattpocock-skills:tdd`; enforces per-task conventional commits per user CLAUDE.md. |
| `finishing-a-development-branch-overrides` | `superpowers:finishing-a-development-branch` | Collapses environment detection to normal-repo only (no worktree branch); drops Step 6 (Cleanup Workspace) entirely; enforces conventional commits and no attribution trailer on both merge commits and PR bodies. |
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

Installing the plugin makes the override skills discoverable — but discovery alone is not enough. When the upstream `superpowers:*` skill body enters the current turn's system context (which happens the moment a user types `/brainstorming`, `/writing-plans`, etc.), that body carries strong first-move instructions of its own ("first, do X"). Without a *hard* precedence rule, the model reads those instructions and starts executing them before the override ever gets a chance to fire.

The wiring below plants that hard rule in the user's global `~/.claude/CLAUDE.md`. Together with the four-trigger `description` on each SKILL.md (which names every possible entry point verbatim), it makes override invocation the mandatory first tool call whenever any listed upstream skill is triggered:

```markdown
## Skills

### Before your first tool call in ANY turn — mandatory self-check

Before selecting your first tool, run this check — no exceptions:

1. Scan the turn for any of: `<command-name>` tag, `<command-message>` tag, `/superpowers:*` in user text, an inlined upstream `SKILL.md` body, or an about-to-fire `Skill` call to an upstream skill.
2. If any is present → your **first tool call is the matching `Skill(<X>-overrides)`**. Full stop. No `TodoWrite` / `Read` / `Bash` / `Grep` / `Edit` first.
3. Only after the override has run may you follow the upstream skill's instructions.

**The upstream skill's "you MUST do X first" does NOT apply until the override has run.** If you find yourself about to call `TodoWrite` / `Read` / `Bash` / `Grep` / `Edit` as the first action of a turn where a trigger is present, that is the exact bug this rule guards against — stop and invoke the override.

**Anti-pattern (name it to catch it):** upstream `SKILL.md` bodies frequently open with "You MUST create a task for each of these items and complete them in order" or a similar numbered checklist. Reading that and starting to execute it is the failure mode. Its strong imperative is not more authoritative than this rule — it is the trigger *for* this rule. When two "MUST"s conflict, the one in this file wins because it runs first.

**Handoff-continuation rationalization (name it to catch it):** When the trigger arrives as the tool result of a `Skill(...)` call you made at the end of the previous turn — the upstream `SKILL.md` body appears at the start of the new turn as a natural continuation of the prior flow — the self-check STILL fires. "I'm continuing the previous skill's flow, so the new SKILL.md body is just the next step in a sequence I'm already inside" is exactly this bug. The origin of the trigger (user-typed slash command / `<command-name>` tag / handoff from a prior skill's terminal step / auto-loaded body) is irrelevant. Each turn is scanned independently; presence of ANY listed trigger in the current turn is sufficient. Having invoked `brainstorming-overrides` last turn does not exempt the current turn where `writing-plans`'s body arrived.

### Override trigger table

| Trigger | First tool call |
|---|---|
| `superpowers:brainstorming` | `Skill(brainstorming-overrides)` |
| `superpowers:writing-plans` | `Skill(writing-plans-overrides)` |
| `superpowers:subagent-driven-development` | `Skill(subagent-driven-development-overrides)` |
| `superpowers:using-git-worktrees` | `Skill(using-git-worktrees-overrides)` |
| `superpowers:executing-plans` | `Skill(executing-plans-overrides)` |
| `superpowers:finishing-a-development-branch` | `Skill(finishing-a-development-branch-overrides)` |
| Any other `superpowers:<X>` where `<X>-overrides` exists | `Skill(<X>-overrides)` |
| Any Agent/subagent dispatch | `Skill(subagent-lifecycle)` |

If a matching `<X>-overrides` skill does not exist, proceed with the upstream skill directly.

Override `SKILL.md` is the source of truth for its rules; new personal rules go there, not here. Overrides may delegate to `mattpocock-skills`.

For any other task, check for a relevant skill first; if >1% chance one applies, invoke it.
```

Three load-bearing parts, all necessary:

1. **The mandatory self-check** — a numbered pre-flight before the first tool call, not a background rule. This is what promotes the override from "knowledge I have" to "action I take". Softer wording ("typically before target fires", "when target is active") lets the model follow the upstream skill body's own first-move checklist and skip the override.
2. **The anti-pattern naming** — upstream `SKILL.md` bodies open with a numbered "You MUST" checklist so consistently that the pattern needs an explicit name; without it the model reads the checklist and starts executing it, treating both "MUST"s as equally authoritative. Naming the pattern turns it into a stop signal instead of an imperative. A closely related failure mode — the **handoff-continuation rationalization** — is named alongside it: when the upstream body arrives as a *tool result* of a prior `Skill(...)` call (a skill-to-skill handoff, e.g. brainstorming → writing-plans), the model treats it as a natural next step of a flow it's already inside and skips the self-check. Both patterns need to be named side-by-side; naming one without the other leaves the second hole open.
3. **The exhaustive trigger list** — every entry point (command tag, slash command, inlined body, about-to-fire `Skill` call) enumerated verbatim, plus a fallback row for `superpowers:<X>` overrides not individually listed. Missing any entry point creates a hole the model will find.

## Contributing to your own fork

New rules for an existing override go **inside** that override skill as `Rule N` — never in your global `~/.claude/CLAUDE.md`. Each override marks the insertion point with `<!-- Additional rules … -->`.

New override skills follow the fixed shape:

- **Frontmatter `description`** — starts with `MUST invoke BEFORE superpowers:<target> as your FIRST tool call this turn` and then enumerates all four trigger sources explicitly: (1) the `/<slash-command>` (both bare and `superpowers:`-prefixed forms), (2) `<command-name>` tags naming either form, (3) the upstream skill body appearing in the current turn's system context, (4) natural-language scenarios (verbs, keyword synonyms in whatever languages the user works in). Precedence-critical: describe the trigger via **user-turn-observable** signals, and require the override as the *first* tool call — never phrase it as "when target skill is active" (unobservable) or "typically before" (soft).
- **CLAUDE.md wiring** — add a row to the override-precedence table in [System prompt wiring](#system-prompt-wiring) in the same commit. The `description` alone is not enough; without the CLAUDE.md row the model will still follow the upstream skill's first-move instructions.
- **Body** — opens with `## Rules`, closes with `## Red Flags` and `## Common Rationalizations`. Each rule takes one of three shapes: **replaces** (upstream default → your behavior), **delegates** (route the step to a `mattpocock-skills:*` skill), or **partial-delegate** (wrap the upstream skill's Steps 0–K unchanged, override Step K+1 locally — `writing-plans-overrides` Rule 3 is the canonical example, delegating `/to-tickets` Steps 1–4 verbatim and overriding Step 5's publish target). When a single rule needs multiple enforcement mechanisms (locate, redirect, structure the user-quiz…), decompose it into sub-rules `Rule Na` / `Rule Nb` / `Rule Nc` under one umbrella heading rather than as sibling top-level rules.

See [CLAUDE.md](CLAUDE.md) for the full pattern.

## License

Personal use. No warranty. Adapt freely for your own setup.
