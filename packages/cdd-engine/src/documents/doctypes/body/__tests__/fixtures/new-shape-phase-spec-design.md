# Fixture Phase Spec — New Skeleton (full conditional surface)

- **Version**: v1.0 · 2026-10-05
- **Status**: Draft
- **Author**: [human] · Claude Opus 5
- **Parent program**: [phase-spec fixture parent overall]({{parent-overall}})
- **Depends on**: P1（shipped · [p1-design v1.1](p1-design.md)）

## Design

The phase's design body — approaches, architecture, components, data flow, errors, testing. This
era is a fixture proving the new-skeleton shape: the parent-overall conventions are not restated.

### Acceptance criteria

- `phase-spec-body.test.ts` compiles under the new-skeleton shape projections
- `config/schema/phase-spec.json` re-derives byte-faithfully from `PhaseSpecBody.projectSchemaShape()`
- The new-shape fixtures pass docContractValidate (conditional positive + zero-residue)

## Constraints

No self-owned delta — the parent overall's conventions auto-apply (the inheritance-point pointer):
this section restates nothing from the overall; the `**Parent program**` line above is the read
target.

## Incremental warning

This phase commits to exactly one increment — the doc-architecture-v2 P2 plane (a single phase).

## Deviations

| Overall assumption | Phase decision | Overall updated? |
|---|---|---|
| Whole-program conventions win on conflict | P2 keeps the dual-read skeleton for the legacy tree | Yes — v1.3 · 2026-10-05 |

## Notes for downstream

P3 onward authors the new three-truth skeleton; this fixture is the engine-side 实证 of that shape.

## Review record

Fixture reviewed under Review Convergence — blocker = 0 → done.
