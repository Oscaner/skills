---
name: spor-test-driven-development
description: MUST invoke BEFORE superpowers:test-driven-development as your FIRST tool call this turn — trigger on ANY of: (1) user types `/spor-test-driven-development`, `/superpowers-overrides:spor-test-driven-development`, `/test-driven-development` or `/superpowers:test-driven-development` or `/tdd`; (2) a `<command-name>` tag in the current turn names any of those; (3) the superpowers:test-driven-development skill body appears in the current turn's system context; (4) user asks in natural language to do TDD, write tests first, follow red-green-refactor, or implement a feature test-first. Applies personal overrides: confirms seams with user before starting (blocking); delegates implementation loop to mattpocock-skills:tdd.
---

# Test-Driven Development Overrides

## Rules

### Rule 1 — Delegate to `mattpocock-skills:tdd`

The entire TDD implementation loop is delegated to [`mattpocock-skills:tdd`](https://github.com/mattpocock/skills/blob/main/skills/engineering/tdd/SKILL.md). This **replaces** the upstream `superpowers:test-driven-development` flow. Do not re-implement any TDD rules here — seams, red-green-refactor, anti-patterns, and mocking constraints all live in that skill.

1. After seams are confirmed (Rule 2), invoke `mattpocock-skills:tdd` via the Skill tool and follow its loop.
2. On load failure, follow [`spor-subagent-lifecycle`](../spor-subagent-lifecycle/SKILL.md) Rule 3.

### Rule 2 — Confirm seams before delegating (blocking)

Before invoking `mattpocock-skills:tdd`, confirm the test boundaries (seams) with the user:

1. **Propose seams**: List which public interfaces/boundaries will be tested and which will not, based on the current task context. Frame as a proposal, not a question — "I'll test at these seams: [X, Y]. Not testing: [Z]. Does this look right?"
2. **Wait for explicit approval** (blocking): Do not call Skill tool until the user responds. Silence is not approval.
3. Once approved, invoke `mattpocock-skills:tdd` (Rule 1) with the confirmed seams in context.

<!-- Additional rules for the test-driven-development skill go below as Rule 3, Rule 4, … -->

## Red Flags — STOP if you catch yourself thinking any of these

- "Seams are obvious, I'll skip the confirmation and just start."
- "User said 'do TDD', that's implicit approval for my seam choices."
- "I'll run mattpocock-skills:tdd first and confirm seams inside it."
- "tdd failed to load / I know the rules — I'll proceed from memory."
- "User hasn't replied but probably agrees, I'll proceed."

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Seams are obvious" | Silent seams = tests against the wrong interface. One message to confirm is cheap. |
| "User said 'do TDD'" | That's the task, not seam approval. Confirm the boundaries explicitly. |
| "Confirming seams is overhead" | Unconfirmed seams cause rework. Blocking confirmation is the point. |
| "I'll just use tdd from memory" | The on-disk skill is the current source of truth. Load it or surface the failure. |
| "Not installed, I'll proceed quietly" | Degrade silently to upstream. Do NOT paraphrase tdd from memory. |
