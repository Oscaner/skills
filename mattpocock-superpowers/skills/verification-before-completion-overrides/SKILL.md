---
name: verification-before-completion-overrides
description: MUST invoke BEFORE superpowers:verification-before-completion as your FIRST tool call this turn — trigger on ANY of: (1) user types `/verification-before-completion` or `/superpowers:verification-before-completion`; (2) a `<command-name>` tag in the current turn names either of those; (3) the superpowers:verification-before-completion skill body appears in the current turn's system context; (4) about to claim work is complete, fixed, passing, or done in any workflow (sdd, executing-plans, or standalone). Applies personal overrides: pre-claim gate before any completion claim; self-check rule banning softening language without verification evidence.
---

# Verification-Before-Completion Overrides

## Rules

### Rule 1 — Pre-claim gate: invoke upstream before any completion claim

Before drafting any output that claims work is complete, fixed, passing, or done — invoke `superpowers:verification-before-completion` first. This is a **pre-claim** gate, not a post-claim intercept:

- **Timing**: trigger when the model internally decides "I can claim this is done", before producing the output
- **Scope**: all workflows — sdd controller marking a task complete, executing-plans finishing a step, standalone task completion
- **No delegate-failure handling needed**: `superpowers:verification-before-completion` lives in the same plugin as this override and is always available

### Rule 2 — Self-check: softening language = unverified claim

Before outputting any response, scan for the following softening language:

**Status-class (evidence-free status claims):**
- "should pass", "should work", "should be fixed"
- "looks good", "seems to work", "appears correct"
- "probably fixed", "likely works"

**Satisfaction expressions (premature celebration):**
- "Great!", "Perfect!", "Done!", "Excellent!", "Looks great!", "Awesome!"
- Any expression of satisfaction before verification evidence is present

If any of the above is detected AND the current turn does not already contain verification evidence (defined as: the verification command itself + complete stdout output + exit code), then:

1. **Delete** the softening language from the draft
2. **Run** the verification command and capture its full output
3. **Only then** state the claim — with the verification evidence attached

Rule 2 is a self-check: the model applies it to its own draft output before sending, without external tool interception.

<!-- Additional rules for the verification-before-completion skill go below as Rule 3, Rule 4, … -->

## Red Flags — STOP if you catch yourself thinking any of these

- "Tests should pass, I'll just say so and move on."
- "I ran tests earlier this session, that counts as current evidence."
- "The code change is small, verification is overkill."
- "I'll express satisfaction first and verify if asked."
- "Saying 'looks good' is just politeness, not a claim."
- "This is the sdd controller marking complete — the implementer already verified."

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Ran tests earlier" | Evidence must be in the current turn. Prior runs are stale. |
| "Change is small" | Small changes have bugs too. Run verification. |
| "It's just politeness" | "Great!" before evidence IS a completion claim. Delete it, verify first. |
| "Implementer already verified" | Controller must independently confirm before marking complete. |
| "Should pass is not a claim" | "Should" is explicitly evidence-free. It is the pattern this rule catches. |
