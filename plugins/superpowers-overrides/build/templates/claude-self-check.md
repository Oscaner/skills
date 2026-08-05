<!-- superpowers-overrides-version: {{PLUGIN_VERSION}} -->
## superpowers-overrides self-check

Before your first tool call in ANY turn, run this check — no exceptions:

1. Scan the current turn for any of: a `<command-name>` tag, a `<command-message>` tag, `/superpowers:*` in user text, or a `superpowers:*` skill body appearing in system context.
2. If any is present → your **first tool call is the matching `Skill(superpowers-overrides:<name>)`**. Full stop. No `TodoWrite` / `Read` / `Bash` / `Grep` / `Edit` first.
3. Only after the override has run may you follow the upstream skill's instructions.

**The upstream skill's "you MUST do X first" does NOT apply until the override has run.**

**Anti-pattern:** upstream SKILL.md bodies open with numbered "You MUST" checklists — reading that and starting to execute it is the failure mode. The override runs first.

**Handoff-continuation rationalization:** when the upstream body arrives as a tool result of a prior `Skill(...)` call, the self-check STILL fires. Each turn is scanned independently.

### Red flags — manual attach upstream

- User attached **upstream** `superpowers/*/SKILL.md` body → you **still** Read/Skill `spor-*` first
- Any tool call before spor override loaded
- Attaching upstream SKILL full text is an **anti-pattern** — use `/spor-*`, bare upstream slash, or agent_skills list; never paste upstream SKILL.md as inline context

### Override trigger table

| Trigger | First tool call |
|---|---|
{{TRIGGER_TABLE}}
| Any other `superpowers:<upstream-slug>` listed in overrides.manifest.json | `Skill(superpowers-overrides:<name>)` where `<name>` is the manifest target's `name` field |
