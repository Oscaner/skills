---
"@oscaner-skills/kairos": patch
---

docs: doc-architecture-v2 P3.1 consumer-surface sync — the cdd-plan and cdd-dev authoring directives converge on the unilateral edge declaration and the engine-derived wave dispatch groups.

- **cdd-plan authoring surface** — plan authors declare plan dependencies as the single directed edge on each task record: `- **DependsOn**: <n, n, …>` (a task may only list lower-numbered tasks; `none`/empty is the explicit no-dependency declaration). The engine's `TaskGraph` derives the dispatch groups from the edge declarations: `effectiveGroups` = the wave batches — one dispatch group per ready wave, ascending task numbers within a wave; a no-dependency task list is the single root wave, so every `### Task N:` dispatches as one group, zero plan churn.
- **cdd-dev implement-group** — the group dispatcher follows the same derivation: each ready wave is one dispatch group (`<n>` a singleton, `<a,b>` a merged group), the group list read from the plan's task records via `effectiveGroups`, with zero reference to any retired grouping mechanism (the `## Task Groups` section and the `taskGroups` record are never part of the authoring surface).
