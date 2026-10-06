---
"@oscaner-skills/cdd-engine": major
---

feat: doc-architecture-v2 P3 — the single plan/spec grammar lands. Dispatch groups derive from the task records' edge declarations via the new `TaskGraph`; the legacy dual-read grammar faces are retired (a new document carrying `- **Do**:` task blocks / Form B anchors / `## Task Groups` / spec `## Section 1` fails doc validation with a BLOCK); and the whole legacy tree migrates to the canonical data form until zero residue.

- **TaskGraph group derivation (T1/T2)** — the dispatch group list derives from the plan's task records' edge fields (`- **DependsOn**:` / `- **AtomicWith**:` comma lists): atomic-closure components in component-DAG topological order, ties by each group's smallest task number. `effectiveGroups(planPath)` is the single group derivation; an edge-free plan yields the per-task singleton run; a broken edge model (missing-id / malformed-value / self-loop / reverse-rank contradiction / cycle / duplicate) throws `GraphViolationError` carrying the `GraphVerdict` failures — never a silent group order.
- **Single-form retirement (T3/T4)** — the legacy runtime read faces are deleted: `taskGroupsFromPlan` / the `## Task Groups` dispatch-group section / Form B prose anchors / the spec `## Section 1` read / `- **Do**:` task blocks, from both the runtime read path and the shape/token planes; the `taskGroups` schema node and its four tokens are deleted; plan.json re-derives from the single canonical body.
- **Rank-forward edges** — a task's `dependsOn` may only name lower-numbered tasks; a reverse-rank dependency is a contradiction BLOCK.
- **Tree migration guards (T5–T8)** — the plan/spec tree migrates to the canonical data form with the migration queue closed at zero pending and all tree documents validating clean.
