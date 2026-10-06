# CDD Engine Smoke Spec

- **Version**: v1.0 · 2026-09-21

- **Parent program**: [smoke-overall.md v1.0](./smoke-overall.md)

## Design

### Acceptance criteria

- `the smoke chain audits clean`

## Constraints

- smoke spec delta

no-op fixture — the doc-contract gate reads the chain only for real dispatches; dry-run smoke
short-circuits before the agent runs.
