---
"@oscaner-skills/kairos": patch
---

docs: cdd-spec / cdd-phase SKILL skeleton guidance synced to the new doc-structure skeleton (three-truth skeleton + conditional sections), matching the doc-type schemas `cdd schema get` reads.

- **cdd-phase `author-spec`** — the retired six-segment content enumeration (approaches / architecture / components / data flow / errors / testing) is replaced by the permanent three-truth skeleton (`## Design` with the unique `### Acceptance criteria` subsection · `## Constraints` as the delta-only inheritance point) plus the conditional sections (`## Incremental warning` / `## Deviations` / `## Notes for downstream` / `## Review record`) written only when their condition holds — zero residue otherwise.
- **cdd-spec `author-spec`** — the free-form single-spec guidance drops the retired Section 0–5 reference (no canonical document skeleton), keeping the required `**Version**` header line.
- Consumer-surface purity preserved: both edits are executable direction only, zero program history.
