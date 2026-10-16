# Maintainer Docs — index

Maintainer-only documents for this monorepo's developers (English-primary; not shipped to consumers — the packages' `contentRoot` is `"."`). Numbered 01–03; internal links use the numbered filenames.

| # | File | Positioning |
|---|---|---|
| 01 | [01-doctrine.md](01-doctrine.md) | Doctrine: the template contract (R1–R5 · I1–I4 · cache integration), the skill-node authoring discipline, and the non-mechanical program-experience lessons |
| 02 | [02-naming.md](02-naming.md) | Naming system + terminology-first registry: scoped names, active terms, banned names, enforcement |
| 03 | [03-cache-doctrine.md](03-cache-doctrine.md) | Host-harness prompt-cache doctrine: the six cross-provider axioms + the C1–C7 dispatch-assembly contract |

## Convergence ledger (P4.2 → P6)

The ledger tracks the maintainers family's byte convergence. P4.2 Task 9 merged the two template docs; the P5 sweeps kept the token/cache facts current; P6 collapsed the family from five content docs + index to three + index, folding the mechanism maps and narration into the enforcement (the code and its tests), keeping only the durable judgment. Plan anchor: total ≤ 56 KB — `maintainers-docs.test.ts` asserts each After cell against the live file, the Total Before cell against the per-file Before sum, and the Total After cell against the per-file After sum.

| File | Before (B) | After (B) | Note |
|---|---|---|---|
| 01-doctrine.md | 28,254 | 4,350 | folded from the retired 01 + 04 + 06 docs · template essence R1–R5 + I1–I4, skill-node facts-only, non-mechanical experience · smoke positioning sentence |
| 02-naming.md | 9,180 | 5,261 | renamed from the retired 02 doc · mechanism map + migration history trimmed, term registry + banned table kept |
| 03-cache-doctrine.md | 8,450 | 2,371 | renamed from the retired 03 doc · six axioms + C1–C7 kept, mechanism narration trimmed |
| README.md | 2,671 | 2,066 | index + ledger re-anchored to the three-doc family |
| **Total** | 48,555 | 14,048 | plan anchor ≤ 56,000 |
