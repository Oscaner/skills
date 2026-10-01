---
"@oscaner-skills/cdd-engine": patch
---

feat: workspace data-plane consolidation — one WorkspaceRoot/Workspace domain owns every on-disk workspace concern.

- **WorkspaceRoot / Workspace classes** (`src/infra/workspace.ts`) — the workspace derivation, the root-level `.osuperpowers/.gitignore` self-guard (`*\n`, a fresh repo's first cdd run writes its own guard), the `Workspace#for(doc)` slug-derivation single entry, the per-workspace atomic JSON read/write pair, and the child-path single facts (`progressPath` / `briefPath` / `lifecyclePath`). The old `handoff/naming.ts` module (workspaceSlug / resolveWorkspace / materializeWorkspace + the family-naming helpers) is deleted; the handoff family-naming surface moved to the Handoff class statics.
- **Process-lifecycle registry lands per workspace slug** — `initProcLifecycle`'s disk path is injected from the dispatch context (`<workspaceRoot>/<slug>/lifecycle.json`) instead of the repo-level `.osuperpowers/cdd/lifecycle.json` single file; the startup sweep (`reapStale`) enumerates every slug's `lifecycle.json` (read → filter → kill → write-back per slug), so it holds with no single-file binding.
- **Injection rework** — `ProgressLedger` and `Handoff` take the canonical `Workspace` at construction (the string progress-dir / workspace-path surfaces are gone); the scattered `mkdirSync` sites across base-branch / handoff-write / runtime / branch / task converge on `Workspace#ensure`.
