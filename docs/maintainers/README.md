# Maintainer Docs — index

Maintainer-only documents for this monorepo's developers (English-primary; not shipped to consumers — the packages' `contentRoot` is `"."`, so `packages/*/` is what publishes). Partitioned by content domain.

## Engineering principles (methodology)

Doctrines distilled from the P1 → P6 program; the F6 methodology set, referenced by skill document templates and by any program touching this codebase.

| Doc | Content |
|---|---|
| [naming-conventions.md](naming-conventions.md) | Naming system + terminology-first registry (F8): scoped semantic names, active terms, mechanismNames migration, banned legacy names, enforcement |
| [context-caching-doctrine.md](context-caching-doctrine.md) | Host-harness prompt-cache doctrine (six axioms, C1–C7, registry cache profiles, observation boundaries) |
| [template-doctrine.md](template-doctrine.md) | Template systematization doctrine for both planes (engine prompt templates + skill document templates) |
| [program-experience.md](program-experience.md) | P1→P6 hard-won lessons, the baking input for skill document templates |

## Plugin operations (this-repo ops)

Operational guides for working this repository: plugin builds, emit chain, skills authoring, dependencies, releasing.

| Doc | Content |
|---|---|
| [osuperpowers-plugin.md](osuperpowers-plugin.md) | osuperpowers plugin maintainer guide (marketplace chain, emit, hooks, CDD engine internals, releasing) |
| [skill-authoring.md](skill-authoring.md) | SKILL.md authoring specification (flow digraph, node template, invariants, BLOCKED convention) |
| [data-driven-templates.md](data-driven-templates.md) | Data-driven template convention (canonical JSON → one renderer → emit/runtime products, guarded by `emit:check`) |
| [third-party-dependencies.md](third-party-dependencies.md) | Adopted / not-adopted dependency ledger (spec §2.13), YAML + husky isolation boundaries |
