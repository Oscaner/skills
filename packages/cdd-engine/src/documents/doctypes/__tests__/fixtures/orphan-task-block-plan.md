# Orphan task block P1 — Implement plan (single-form BLOCK fixture)

**Spec:** [orphan-design.md](docs/kairos/specs/orphan-design.md)

## Constraints

- delta constraint one

### Task 1: legacy Do-form block

- **DependsOn**: none
- **AtomicWith**: none
- **Do**: a legacy `- **Do**:` task body carries none of the data-shaped fields (no `- **Objective**:`
  / `- **Steps**:` / `- **Acceptance**:`) — under the single-form grammar the block is an orphan
  and the plan fails validation.