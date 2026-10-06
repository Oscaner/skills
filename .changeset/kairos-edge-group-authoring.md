---
"@oscaner-skills/kairos": patch
---

docs: doc-architecture-v2 P3 consumer-surface sync — the cdd-plan and cdd-dev SKILL.md authoring surfaces move from the retired `## Task Groups` / `taskGroups` dispatch-group mechanism to the edge-declaration model.

- **cdd-plan authoring surface** — `author-plan` directs plan authors to declare dependencies and merged groupings as edges on the task records: `- **DependsOn**:` (directed, rank-forward — a task may only list lower-numbered tasks) and `- **AtomicWith**:` (undirected). The engine derives the dispatch groups from those edges (`effectiveGroups` = atomic-closure components in component-DAG order); an edge-free task list is the all-singleton default.
- **cdd-dev implement-group** — the group-list description follows the same derivation: dispatch groups come from the plan's task records' `dependsOn`/`atomicWith` edges via the engine's `effectiveGroups`, with zero references to the retired `## Task Groups` section or `taskGroups` record.
