# Fixture Phase Spec — New Skeleton (zero conditional residue)

- **Version**: v1.0 · 2026-10-05
- **Status**: Draft
- **Author**: [human] · Claude Opus 5
- **Parent program**: [phase-spec fixture parent overall]({{parent-overall}})
- **Depends on**: P1（shipped）

## Design

The phase's design body — approaches, architecture, components, data flow, errors, testing. This
era is a fixture proving that condition=false leaves zero residue: no conditional section exists.

### Acceptance criteria

- `phase-spec-body.test.ts` compiles under the new-skeleton shape projections
- `config/schema/phase-spec.json` re-derives byte-faithfully from `PhaseSpecBody.projectSchemaShape()`
- The new-shape fixtures pass docContractValidate (zero-residue — no conditional section present)

## Constraints

No self-owned delta — the parent overall's conventions auto-apply (the inheritance-point pointer):
this section restates nothing from the overall; the `**Parent program**` line above is the read
target.
