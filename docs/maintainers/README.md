# Maintainer Docs — index

Maintainer-only documents for this monorepo's developers (English-primary; not shipped to consumers — the packages' `contentRoot` is `"."`). Numbered 01–06; internal links use the numbered filenames.

| # | File | Positioning |
|---|---|---|
| 01 | [01-template-doctrine.md](01-template-doctrine.md) | Template doctrine: the data-driven template contract (canonical → one renderer → emit/runtime products, `emit:check`-guarded) + two-plane systematization |
| 02 | [02-naming-conventions.md](02-naming-conventions.md) | Naming system + terminology-first registry (F8): scoped names, active terms, migration, banned names, enforcement |
| 03 | [03-context-caching-doctrine.md](03-context-caching-doctrine.md) | Host-harness prompt-cache doctrine (six axioms, C1–C7, cache profiles, observation boundaries) — the engine's live cache contract |
| 04 | [04-program-experience.md](04-program-experience.md) | Hard-won lessons across every phase; the baking input for skill document templates |
| 05 | [05-third-party-dependencies.md](05-third-party-dependencies.md) | Adopted / not-adopted dependency ledger (§2.13), YAML + husky isolation boundaries |
| 06 | [06-skill-node-discipline.md](06-skill-node-discipline.md) | Skill node authoring discipline: facts only, no restatement (each fact lives in exactly one of the four skill surfaces) |

## P4.2 convergence ledger

Task 9 merged the two template docs, trimmed program-experience, updated 02/05 to the P4.4 final state. Plan anchor: total ≤ 56 KB (P3.2 facts-only sweep adds 06-skill-node-discipline) — `maintainers-docs.test.ts` asserts each After cell against the live file.

| File | Before (B) | After (B) | Note |
|---|---|---|---|
| 01-template-doctrine.md | 14,378 | 10,866 | merged from 01 + 02 · §9 doc-structure facts (unilateral edge) |
| 02-naming-conventions.md | 7,994 | 9,075 | blocker bounded mapping added |
| 03-context-caching-doctrine.md | 8,706 | 8,383 | row-key mirror (P3 T2) · cached-bytes trims |
| 04-program-experience.md | 21,773 | 12,834 | trimmed ~9 KB · +item 57 |
| 05-third-party-dependencies.md | 10,018 | 10,240 | P4.4 deps + unbuild/TS6 retirement + P3.2 shell-strip (eight-package runtime prune) + P1 dependency upgrade (simple-git 3→4 · @types/node 24-line lock · 4.x forward notes) |
| 06-skill-node-discipline.md | 0 | 1,900 | P3.2 facts-only sweep · skill-node discipline (facts only, no restatement) |
| README.md | 2,324 | 2,605 | index converged + 06 row + anchor revision + P5 retirement ledger |
| **Total** | 65,193 | 55,903 | plan anchor ≤ 56,000 |
