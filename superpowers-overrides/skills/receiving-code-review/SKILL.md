---
name: receiving-code-review
description: MUST invoke BEFORE superpowers:receiving-code-review as your FIRST tool call this turn — trigger on ANY of: (1) user types `/receiving-code-review` or `/superpowers:receiving-code-review`; (2) a `<command-name>` tag in the current turn names either of those; (3) the superpowers:receiving-code-review skill body appears in the current turn's system context; (4) user shares code review feedback or asks to address review comments. Applies personal overrides: delegates unclear feedback clarification to mattpocock-skills:grilling (Rule 1); delegates each fix implementation to mattpocock-skills:tdd with mechanical-change exemption (Rule 2).
---

# Receiving-Code-Review Overrides

## Rules

### Rule 1 — UNDERSTAND step: delegate unclear feedback to `mattpocock-skills:grilling`

During the upstream UNDERSTAND step of the Response Pattern (READ→UNDERSTAND→VERIFY→EVALUATE→RESPOND→IMPLEMENT): if any review feedback item is unclear in meaning, intent, or expected outcome:

1. Delegate to [`mattpocock-skills:grilling`](https://github.com/mattpocock/skills/blob/main/skills/productivity/grilling/SKILL.md) to clarify each unclear item — do not guess or infer intent
2. All unclear items must reach shared understanding before proceeding to VERIFY. Do not proceed with partial clarity.
3. If grilling fails to load (Skill tool error — plugin installed but skill fails to load), **surface the exact error to the user** and ask whether to proceed manually per that skill's discipline or wait for the plugin to be repaired. Do not paraphrase `grilling`'s rules from memory.
4. If `mattpocock-skills` is not installed, degrade silently: proceed without grilling, relying on upstream UNDERSTAND step behavior.

### Rule 2 — IMPLEMENT step: delegate each fix to `mattpocock-skills:tdd`

During the upstream IMPLEMENT step: for each fix item, delegate implementation to [`mattpocock-skills:tdd`](https://github.com/mattpocock/skills/blob/main/skills/engineering/tdd/SKILL.md) and follow its red-green loop:

1. Invoke `mattpocock-skills:tdd` via the Skill tool for each fix, one at a time
2. **Exemption**: purely mechanical changes with no behavioral impact are exempt from TDD — this includes: pure renames, whitespace/formatting adjustments, comment-only changes. Judgment criterion: if the fix cannot change any observable behavior, it is exempt.
3. If tdd fails to load (Skill tool error — plugin installed but skill fails to load), **surface the exact error to the user** and ask whether to proceed manually per that skill's discipline or wait for the plugin to be repaired. Do not paraphrase `tdd`'s rules from memory.
4. If `mattpocock-skills` is not installed, degrade silently: proceed without tdd delegation, relying on upstream IMPLEMENT step behavior.

<!-- Additional rules for the receiving-code-review skill go below as Rule 3, Rule 4, … -->

## Red Flags — STOP if you catch yourself thinking any of these

- "I think I understand what they mean, I'll just implement it."
- "The feedback is probably asking for X, I'll proceed."
- "Asking for clarification will slow things down."
- "This fix is small, TDD is overkill."
- "I'll rename this variable and also refactor the logic — it's all one fix."
- "grilling/tdd failed to load, I'll just do it from memory."
- "I'll clarify one item and assume the others are the same."

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "I can infer what they mean" | Inferred intent causes wrong implementations. Invoke grilling. |
| "Clarification takes too long" | Wrong implementation takes longer. One grilling session is cheaper. |
| "This fix is small" | Small fixes still need tests. If it changes behavior, use TDD. |
| "Rename + refactor is one fix" | They're two different changes. Exempt the rename; use TDD for the refactor. |
| "grilling/tdd failed, I'll proceed from memory" | Surface the error. Do not paraphrase from memory. |
| "They said fix 1-6, I understand 1-3" | Stop. Clarify 4-6 before implementing anything. |
