# Maintainer Docs — index

Maintainer-only documents for this monorepo's developers (English-primary; not shipped to consumers — the packages' `contentRoot` is `"."`, so `packages/*/` is what publishes). Files are numbered in two groups: the doctrine family (01–04, methodology distilled from the program) and the mechanism family (05–06, concrete working guides for this repo). All family-internal links use the numbered filenames below. The node-anchored SKILL.md anatomy's single structure authority is the engine's skill-anatomy schema (`packages/cdd-engine/src/documents/schema/skill-anatomy.json`), machine-checked against every skill by `packages/osuperpowers/tests/digraph-consistency.test.mjs` — the retired skill-authoring text doc is gone with it.

| # | File | Positioning | Reader |
|---|---|---|---|
| 01 | [01-data-driven-templates.md](01-data-driven-templates.md) | Data-driven template convention (canonical JSON → one renderer → emit/runtime products, guarded by `emit:check`) | Maintainers touching template-shaped content (packages/cdd-engine templates, emit products, ISSUE_TEMPLATE bodies) |
| 02 | [02-template-doctrine.md](02-template-doctrine.md) | Template systematization doctrine for both planes (engine prompt templates + skill document templates) | Maintainers systematizing prompt or skill-document templates |
| 03 | [03-naming-conventions.md](03-naming-conventions.md) | Naming system + terminology-first registry (F8): scoped semantic names, active terms, mechanismNames migration, banned legacy names, enforcement | Maintainers naming any authorable surface or auditing name consistency |
| 04 | [04-context-caching-doctrine.md](04-context-caching-doctrine.md) | Host-harness prompt-cache doctrine (six axioms, C1–C7, registry cache profiles, observation boundaries) | Maintainers assembling agent prompts for cache hits |
| 05 | [05-program-experience.md](05-program-experience.md) | Hard-won lessons across every phase, the baking input for skill document templates | Program maintainers; anyone running a future program touching this codebase |
| 06 | [06-third-party-dependencies.md](06-third-party-dependencies.md) | Adopted / not-adopted dependency ledger (spec §2.13), YAML + husky isolation boundaries | Maintainers evaluating, upgrading, or adding dependencies |
