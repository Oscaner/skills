---
"@oscaner-skills/cdd-engine": minor
---

A dispatch prompt now states which target it judges: the round context carries a
`TARGET_TYPE` line on every round that has one, immediately below `ROLE`.

- **The discriminant renders.** The token that selected the review variant was
  supplied but never printed, so a fix / docs-fix child never read the target word its
  `--type` declared. It is now `TARGET_TYPE`, rendered as
  ``- `TARGET_TYPE`: <target word>`` on the six review faces, the two fix faces
  (`wave` · `branch`) and the two document-fix faces' plan/spec types (`plan` ·
  `phase-spec` · `overall` · `single-spec`). The value is the CLI `--type` word, so the
  prompt speaks the same vocabulary the command line does.
- **Implement carries none.** An implement round has no target, so its layout omits the
  line and the empty value is dropped — one reading order, no blank slot.
- **Shell titles and criteria labels are untouched.** Only the round-context face grows;
  the three shells' first-line titles, the `**Criteria — …:**` labels and the
  `**Lens labels:**` lines are byte-identical to before, and the template contract's
  `$version` moves 20 → 21 to mark the token-face change.
