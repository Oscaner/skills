---
"@oscaner-skills/kairos": patch
"@oscaner-skills/cdd-engine": patch
---

fix(kairos) + fix(engine): restore the author-entry skeleton bootstrap literal, and pin it against silent strip:

- **Restore the mechanism (a P7/D29 regression)** — `cdd-spec-writer`'s `author-spec` and `cdd-plan`'s `author-plan` regains the entry bootstrap command: `schema get <type> --output skeleton <target path>`, then fill the slots in place (structure stays as generated). P7 commit `9d6f4e27` (D29) stripped it as "internal syntax", but D29's own judgment carries the **entry-node bootstrap exception** — the one literal command per flow that starts the authoring before any `next:` exists — and the author nodes ARE those entries. The same command was correctly kept as bootstrap in `cdd-dev`'s `determine-base`/`set-base`; only here it was mis-stripped because D29 keyed on surface SHAPE, not entry ROLE.
- **Delete the prose structure mirror** — the author nodes no longer restate the target's document structure in prose ("the plan carries the task-heading colon form · `## Constraints` …"). That restatement was itself the failure mode D29 set out to remove — a drifting second structure truth. The engine's `schema get <type>` skeleton is now the single structure authority (the same contract the reviewer reads).
- **Regression pin** — the skill-anatomy contract (`contract/skill-anatomy.ts`) gains an `authorBootstrap` fact (the author-entry nodes + the skeleton bootstrap command pattern) and `SkillAnatomyCheck` asserts every registered author-entry node carries its bootstrap literal. This class of regression — an entry command silently stripped — can no longer pass review green.
