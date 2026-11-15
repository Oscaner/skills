---
"@oscaner-skills/kairos": minor
---

The three orchestrators that dispatch a fix round (`cdd-dev` · `cdd-plan` · `cdd-spec-writer`) each carry one **Ruling Landing** invariant at their `## Invariants` table tail, in one byte-identical sentence: when a fix dispatch needs a ruling on a finding, the ruling lands at the sidecar path the engine prints in `next:` — the orchestrator never derives that path itself. The instruction names the printed path and never a file name, so the shipped skill prose carries zero spelling of the sidecar artifact; a structural gate in the kairos suite fails any drift between the three sentences or any reappearance of the literal.

The cdd-engine README pair gains the migration note that pairs with the instruction (EN source + zh mirror, same batch): a sidecar written before this release sits off the rendered path, the first dispatch after upgrading stops with `CDD_BLOCKED: artifact-identity`, and the one-time rename plus the re-judgment that must follow it are spelled out. That is documentation of the engine's existing behavior — the engine's consumer-visible changes ride the four minor entries already in this release.
