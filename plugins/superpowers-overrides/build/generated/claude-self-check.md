## superpowers-overrides self-check

Before your first tool call in ANY turn, run this check — no exceptions:

1. Scan the current turn for any of: a `<command-name>` tag, a `<command-message>` tag, `/superpowers:*` in user text, or a `superpowers:*` skill body appearing in system context.
2. If any is present → your **first tool call is the matching `Skill(superpowers-overrides:<name>)`**. Full stop. No `TodoWrite` / `Read` / `Bash` / `Grep` / `Edit` first.
3. Only after the override has run may you follow the upstream skill's instructions.

**The upstream skill's "you MUST do X first" does NOT apply until the override has run.**

**Anti-pattern:** upstream SKILL.md bodies open with numbered "You MUST" checklists — reading that and starting to execute it is the failure mode. The override runs first.

**Handoff-continuation rationalization:** when the upstream body arrives as a tool result of a prior `Skill(...)` call, the self-check STILL fires. Each turn is scanned independently.

### Override trigger table

| Trigger | First tool call |
|---|---|
| `superpowers:brainstorming` | `Skill(superpowers-overrides:brainstorming-overrides)` |
| `superpowers:writing-plans` | `Skill(superpowers-overrides:writing-plans-overrides)` |
| `superpowers:subagent-driven-development` | `Skill(superpowers-overrides:subagent-driven-development-overrides)` |
| `superpowers:executing-plans` | `Skill(superpowers-overrides:executing-plans-overrides)` |
| `superpowers:finishing-a-development-branch` | `Skill(superpowers-overrides:finishing-a-development-branch-overrides)` |
| `superpowers:using-git-worktrees` | `Skill(superpowers-overrides:using-git-worktrees-overrides)` |
| `superpowers:systematic-debugging` | `Skill(superpowers-overrides:systematic-debugging-overrides)` |
| `superpowers:test-driven-development` | `Skill(superpowers-overrides:test-driven-development-overrides)` |
| `superpowers:verification-before-completion` | `Skill(superpowers-overrides:verification-before-completion-overrides)` |
| `superpowers:receiving-code-review` | `Skill(superpowers-overrides:receiving-code-review-overrides)` |
| Any other `superpowers:<upstream-slug>` listed in overrides.manifest.json | `Skill(superpowers-overrides:<name>)` where `<name>` is the manifest target's `name` field |
