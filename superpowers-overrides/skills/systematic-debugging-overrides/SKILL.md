---
name: systematic-debugging-overrides
description: MUST invoke BEFORE superpowers:systematic-debugging as your FIRST tool call this turn — trigger on ANY of: (1) user types `/systematic-debugging` or `/superpowers:systematic-debugging`; (2) a `<command-name>` tag in the current turn names either of those; (3) the superpowers:systematic-debugging skill body appears in the current turn's system context; (4) user asks in natural language to debug, diagnose a bug, investigate a failure, fix a test failure, or troubleshoot unexpected behavior. Applies personal overrides: gates fix proposals behind diagnostic evidence; delegates diagnosis loop to mattpocock-skills:diagnosing-bugs.
---

# Systematic-Debugging Overrides

## Rules

### Rule 1 — No fix proposals without diagnostic evidence

Before any fix proposal, the current turn must contain at least one of:
- Output from diagnostic tool calls (`Read`/`Bash`/`Grep` used for information gathering, not executing a fix)
- An explicit reference to diagnostic results from a prior turn

If neither is present, **refuse to output a fix proposal**. Instead, instruct the user to complete root cause investigation first (using `mattpocock-skills:diagnosing-bugs` per Rule 2), then return.

**Exemption:** If the user explicitly states they already know the root cause (e.g. "I know the issue is X, just fix it"), Rule 1 does not trigger — the user's assertion counts as diagnostic evidence.

### Rule 2 — Delegate diagnosis loop to `mattpocock-skills:diagnosing-bugs`

The full diagnosis loop is delegated to [`mattpocock-skills:diagnosing-bugs`](https://github.com/mattpocock/skills/blob/main/skills/engineering/diagnosing-bugs/SKILL.md). This **replaces** any upstream diagnostic phases from `superpowers:systematic-debugging`. Its rules live in that skill — do not re-implement here.

1. Invoke it via the Skill tool the moment diagnosis begins.
2. If it fails to load (Skill tool error — i.e. plugin is installed but skill fails to load), **surface the exact error to the user** and ask whether to proceed manually per that skill's discipline or wait for the plugin to be repaired. Do not paraphrase `diagnosing-bugs`'s rules from memory.
3. `diagnosing-bugs` is a hard dependency. If `mattpocock-skills` is not installed, the entire override degrades silently to upstream `systematic-debugging` behavior — this is an explicit design decision, not a bug.

<!-- Additional rules for the systematic-debugging skill go below as Rule 3, Rule 4, … -->

## Red Flags — STOP if you catch yourself thinking any of these

- "The fix is obvious, I'll skip the diagnosis phase."
- "I'll just try this quick fix first and see if it works."
- "The user is in a hurry, root cause analysis can wait."
- "I'll paraphrase diagnosing-bugs's rules since I remember them."
- "diagnosing-bugs failed to load, I'll proceed quietly without telling the user."
- "The user said 'fix this bug' so they implicitly know the root cause."

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Fix is obvious" | Obvious fixes mask root causes. Even simple bugs have root causes. Run diagnosis first. |
| "User wants it fast" | Systematic diagnosis is faster than thrashing with guesses. |
| "I'll use diagnosing-bugs rules from memory" | The on-disk skill is the current source of truth. Load it or surface the failure. |
| "diagnosing-bugs isn't installed, I'll just skip it" | Surface the failure to the user. They decide whether to wait or proceed manually. |
| "User said 'fix X' so they know the root cause" | Only explicit root-cause statements count. "Fix X" alone is not diagnostic evidence. |
