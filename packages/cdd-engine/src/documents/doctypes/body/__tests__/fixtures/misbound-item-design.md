# Demo P3 — Phase Spec

- **Version**: v1.0 · 2026-10-07
- **Status**: Draft
- **Author**: [human] · Claude Opus 5
- **Parent program**: [parent-overall.md v1.0](./parent-overall.md)

## Design

### 2. Declared group

#### 1.1 Misbound item

The item's `N` = 1 references a group number the design body never declares — the declared group is
`2`. `spec.designItemOwnership`'s crosslink fires: an item `N` must resolve to a declared `### N.`.

### Acceptance criteria

- `spec.designItemOwnership` fires on the misbound 1.1 item (BLOCK)

## Constraints

- The fixture carries no self-owned delta — the skeleton satisfies the three-truth assertion only.
