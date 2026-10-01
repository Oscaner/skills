---
"@oscaner-skills/kairos": patch
---

fix: reviews route on the engine-printed `next:` suggestion; status meanings unified.

- Review Convergence (S1/S2/S3) is anchored to `status` (`CHANGES_REQUESTED` / `REVIEW_FIX` / `APPROVED`) instead of a `blocker` count read from the output contract; the `blocker` word now maps to a single meaning (review finding severity).
- Orchestrator skills (cli-driven-development + the four writing-* skills) read the `next:` line for the default next-hop dispatch instead of re-deriving their own fix/review routing prose; the reviewer-closing prose collapses to the shared `next:` reference, and mid-flight backfills keep precedence over the suggestion.
- Naming conventions register the bounded mapping for `blocker` / `BLOCKED` / the handoff `blocker` field.