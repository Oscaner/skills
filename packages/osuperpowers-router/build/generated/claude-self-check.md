<!-- scripts/emit.mjs — do not edit -->
<!-- superpowers-overrides-version: 6.2.0-overrides.0.15.3 -->
## superpowers-overrides self-check

Before your first tool call in ANY turn, run this check — no exceptions:

1. Scan the current turn for any of: a `<command-name>` tag, a `<command-message>` tag, `/superpowers:*` in user text, or a `superpowers:*` skill body appearing in system context.
2. If any is present → your **first tool call is the matching `Skill(<target-name>)`** where `<target-name>` is the manifest target's `name` field (e.g. `engineering:os-brainstorming`). Full stop. No `TodoWrite` / `Read` / `Bash` / `Grep` / `Edit` first.
3. Only after the target skill has run may you follow the upstream skill's instructions.

**The upstream skill's "you MUST do X first" does NOT apply until the target skill has run.**

**Anti-pattern:** upstream SKILL.md bodies open with numbered "You MUST" checklists — reading that and starting to execute it is the failure mode. The target skill runs first.

**Handoff-continuation rationalization:** when the upstream body arrives as a tool result of a prior `Skill(...)` call, the self-check STILL fires. Each turn is scanned independently.

### Red flags — manual attach upstream

- User attached **upstream** `superpowers/*/SKILL.md` body → you **still** Read/Skill the target skill first
- Any tool call before the target override loaded
- Attaching upstream SKILL full text is an **anti-pattern** — use `/superpowers:*`, bare upstream slash, or agent_skills list; never paste upstream SKILL.md as inline context

### Override trigger table

| Trigger | First tool call |
|---|---|
| `superpowers:brainstorming` | `Skill(osuperpowers:os-brainstorming)` |
| `superpowers:writing-plans` | `Skill(osuperpowers:os-writing-plans)` |
| `superpowers:subagent-driven-development` | `Skill(osuperpowers:cli-driven-development)` |
| `superpowers:executing-plans` | `Skill(osuperpowers:os-executing-plans)` |
| `superpowers:finishing-a-development-branch` | `Skill(osuperpowers:os-finishing)` |
| `superpowers:systematic-debugging` | `Skill(osuperpowers:os-debugging)` |
| `superpowers:test-driven-development` | `Skill(mattpocock-skills:tdd)` |
| `superpowers:verification-before-completion` | `Skill(osuperpowers:os-verification)` |
| `superpowers:receiving-code-review` | `Skill(osuperpowers:os-code-review)` |
| `superpowers:using-git-worktrees` | `Skill(osuperpowers:os-finishing)` |
| Any other `superpowers:<upstream-slug>` listed in overrides.manifest.json | `Skill(<name>)` where `<name>` is the manifest target's `name` field |
