---
"@oscaner-skills/cdd-engine": minor
---

The diagram twin gate now names its own repair. Every mismatch it reports — citation multiset, copy twin, revision pin — ends with `— regenerate: pnpm run emit`, because a twin red always means the same thing: the source moved and the artifact did not follow, and the repository's emit is the one fix that needs no extra install. The semantic gate (`face/__tests__/diagrams.guard.test.ts`) stays deliberately hint-free — there the source itself is wrong, so regenerating would only re-print the mistake — and a comparative pin now keeps that distinction from eroding. `docs/diagrams/README.md` and `AGENTS.md` point daily regeneration at `pnpm run emit`, with `archify finalize` kept as the documented manual full-gate path.
