---
"@oscaner-skills/cdd-engine": minor
---

Task-scope ledger — roundBase/scopeBase split (P6 spec T7.6): a task's reviewable git range is now an engine-owned, cross-round-stable anchor instead of a per-round snapshot. `progress.json` task entries gain `scope_base`, seeded earliest-wins from the first implement round's base and never overwritten by a later round's snapshot; a recovery implement round whose materialized `base == HEAD` (the deliverable was already committed when the previous round died) may adopt a base declared by the return block — validated as an ancestor of HEAD and never adopted for a fresh round — restoring the true contribution range. Task review/fix fixed-points derive from the ledger first and fall back to the prior-handoff chain for legacy progress rows; residue settlement records the ledger value for the resume path.

> **Semver note**: additive capability (ledger field + declared-base adoption lane) with the 0/1/2/3 exit table, usage lines and diagnostics preserved; normal (non-recovery) task flows are byte-identical — released as a minor following the P3/P4 precedent.
