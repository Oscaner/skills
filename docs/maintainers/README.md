# Maintainer Docs — index

Maintainer-only documents for this monorepo's developers (English-primary; not shipped to consumers — the packages' `contentRoot` is `"."`). Numbered 01–05; internal links use the numbered filenames.

| # | File | Positioning |
|---|---|---|
| 01 | [01-template-doctrine.md](01-template-doctrine.md) | Template doctrine: the data-driven template contract (canonical → one renderer → emit/runtime products, `emit:check`-guarded) + two-plane systematization |
| 02 | [02-naming-conventions.md](02-naming-conventions.md) | Naming system + terminology-first registry (F8): scoped names, active terms, migration, banned names, enforcement |
| 03 | [03-context-caching-doctrine.md](03-context-caching-doctrine.md) | Host-harness prompt-cache doctrine (six axioms, C1–C7, cache profiles, observation boundaries) — the engine's live cache contract |
| 04 | [04-program-experience.md](04-program-experience.md) | Hard-won lessons across every phase; the baking input for skill document templates |
| 05 | [05-third-party-dependencies.md](05-third-party-dependencies.md) | Adopted / not-adopted dependency ledger (§2.13), YAML + husky isolation boundaries |

## P4.2 convergence ledger

Task 9 merged the two template docs, trimmed program-experience, updated 02/05 to the P4.4 final state. Plan anchor: total ≤ 53 KB — `maintainers-docs.test.ts` asserts each After cell against the live file.

| File | Before (B) | After (B) | Note |
|---|---|---|---|
| 01-template-doctrine.md | 14,378 | 10,295 | merged from 01 + 02 |
| 02-naming-conventions.md | 7,994 | 8,969 | blocker bounded mapping added |
| 03-context-caching-doctrine.md | 8,706 | 8,757 | row-key mirror (P3 T2) |
| 04-program-experience.md | 21,773 | 12,829 | trimmed ~9 KB |
| 05-third-party-dependencies.md | 10,018 | 10,137 | P4.4 deps registered + kairos rename |
| README.md | 2,324 | 1,987 | index converged + kairos rename |
| **Total** | 65,193 | 52,974 | plan anchor ≤ 53,000 |
