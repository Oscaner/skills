---
"@oscaner-skills/cdd-engine": patch
"@oscaner-skills/kairos": patch
---

**fix-route readback suffix wording + skills mirror strip (P8 spec §11 · user ruling 2026-10-15)**

- `FIX_READBACK_SUFFIX` (session/next.ts) reworded from "(confirm the findings · annotate the carrier with the adjudications)" to "(confirm the findings · if a finding needs a ruling, record the ruling in the findings file)" — behavior language a cold-start orchestrator can act on without repo-internal vocabulary (handoff carrier / adjudications were underivable without maintainers docs); the `if` criterion is user-specified: whether a finding needs a ruling. Literal pins in next.test.ts updated (value pin + compile-time literal-type pin); capsule.ts doc comment follows.
- The four pipeline skills' SKILL.md (cdd-dev, cdd-plan, cdd-spec-writer, cdd-design) no longer copy the engine's suffix wording — the suffix arrives with the `next:` literal at dispatch time, so a skill-side copy was a drifting second truth (D29 judgment applies). The skills keep only the discipline sentence: consume the findings handoff, execute the `next:` literal as written.
- docs/maintainers/02-naming.md `annotate` row reworded to the if-needed ruling criterion; convergence-ledger byte counts updated (5,241 → 5,261; total 14,028 → 14,048).
