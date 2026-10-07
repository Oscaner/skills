# CDD Engine Smoke

# base: develop

**Spec:** [smoke-spec.md](./smoke-spec.md)

## Constraints

- result-bearing fixture (doc-contract gate audits the smoke chain on real dispatches)

### Task 1: dry-run smoke

- **Objective**: dry-run smoke
- **DependsOn**: none
- **Steps**:
  1. run the dry-run — checkable: the round completes
- **Acceptance**:
  - dry-run completes
