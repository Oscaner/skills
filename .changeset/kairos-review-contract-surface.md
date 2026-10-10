---
"@oscaner-skills/kairos": patch
---

docs: the review-convergence / `next:` routing contract lands on every orchestrator skill surface, and the flow ordering matches the clean-tree hard gate:

- **Review Convergence anchored to `status`** — the S1/S2/S3 convergence (cdd-design · cdd-spec-writer · cdd-plan · cdd-dev · cdd-close) is anchored to the engine's `status` values (`CHANGES_REQUESTED` / `REVIEW_FIX` / `APPROVED`) instead of a `blocker` count read from the output contract; the `blocker` word now maps to a single meaning (review finding severity).
- **`next:` as the default next hop** — the orchestrator skills read the `next:` line for the default next-hop dispatch instead of re-deriving their own fix/review routing prose; the reviewer-closing prose collapses to the shared `next:` reference, and mid-flight backfills keep precedence over the suggestion. The Review Convergence `next:` examples in all four orchestrator skills now render complete executable commands — `implement --plan <path> --tasks 17` · `review --type <wave|spec|plan|branch> <type-arg>` · `fix --type <type> <type-arg> --findings <path> (read file back to confirm)` — as the engine emits them, with the `(read file back to confirm)` readback discipline preserved.
- **Commit-before-first-review ordering** — cdd-spec-writer and cdd-plan move the conventional commit between authoring and review: the authored document commits before the first review round (the order the clean-tree hard gate forces — the review-entry gate dispatches only on a committed ref), their digraphs route author → commit → review-fix loop → handoff, and cdd-dev declares the review-entry gate (the implement child commits its own work; the engine's clean-tree check guards the review entry).
- **Naming register** — the bounded mapping for `blocker` / `BLOCKED` / the handoff `blocker` field is registered.
