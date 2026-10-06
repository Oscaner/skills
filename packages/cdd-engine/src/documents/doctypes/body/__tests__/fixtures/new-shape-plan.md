# Fixture Plan — Task Data Shape

**Spec:** [2026-10-02-doc-architecture-v2-p3-design.md](docs/kairos/specs/2026-10-02-doc-architecture-v2-p3-design.md)

**Parent program:** [2026-10-02-doc-architecture-v2-overall.md v1.6](docs/kairos/specs/2026-10-02-doc-architecture-v2-overall.md)

**Version:** v1.0 · 2026-10-05

**Depends on:** P1（shipped · [p1-design v1.1](p1-design.md)）

**Base:** develop

## Constraints

- The plan's own delta — the parent spec/overall conventions auto-apply and are never restated.
- A task step carries its checkable outcome on every `- **Steps**:` entry.

### Task 1: Task data shape projection

- **Objective**: project the new plan record shape onto the SchemaFactory product
- **DependsOn**: none
- **AtomicWith**: none
- **Files**: `packages/cdd-engine/src/documents/doctypes/body/plan-body.ts`
- **Consumes**: plan schema leaves (taskHeadings format / constraints formA)
- **Produces**: `config/schema/plan.json` (new golden)
- **Steps**:
  1. Write the PlanBody leaf projection — checkable: `plan-body.ts` compiles under the new shape
  2. Re-derive the schema product — checkable: `plan.json` is byte-faithful to the projection
- **Acceptance**:
  - The four DOC_TOKENS leaf paths survive the re-projection
  - The rendered brief carries no `- **Do**:` face

### Task 2: renderBrief from task data

- **Objective**: render the task-handoff brief from the Task record
- **DependsOn**: none
- **AtomicWith**: none
- **Files**: `packages/cdd-engine/src/documents/doctypes/body/plan-body.ts`
- **Consumes**: the Task data model (objective / steps / acceptance)
- **Produces**: the handoff brief content
- **Steps**:
  1. Render the objective line — checkable: brief opens with the objective
  2. Render every step with its checkable — checkable: brief lists each action + outcome
- **Acceptance**:
  - A step missing its checkable fails validation
  - The brief carries zero prose carving
