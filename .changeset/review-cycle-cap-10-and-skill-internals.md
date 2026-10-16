---
"@oscaner-skills/cdd-engine": patch
"@oscaner-skills/kairos": patch
---

refactor(engine) + refactor(kairos): the review-cycle soft cap rises to 10 rounds, and the consumer skills drop their engine-internal narration:

- **Review-cycle soft cap 3 → 10** — `REVIEW_CYCLE_CAP` (`session/next.ts`) now defers a fix face to user adjudication only after 10 consecutive blocker rounds (was 3). The pinned constant assertion and the cap-driven lifecycle walk follow the new value; the walk reads `REVIEW_CYCLE_CAP` directly, so a future cap move needs no test edit (the old walk hard-coded three rounds).
- **Consumer skills carry zero engine internals** — `cdd-design` / `cdd-dev` / `cdd-plan` / `cdd-spec-writer` state only the engine's BEHAVIOR contract (dispatch the command, read the `next:` line, dispatch it as written) and drop every implementation detail that had leaked across the boundary: the wave-derivation mechanism, the scope-anchor injection, the handoff-carrier structure, the host-detection mechanism, the "engine-enforced gate" narration, and the soft-cap value mirror (`recommended ≤ 3` — a stale copy of an engine constant, the exact failure mode this removes). The `next:` line is the sole route source; the orchestrator needs no engine internals.
