---
"@oscaner-skills/cdd-engine": minor
---

A dispatch prompt's referent sentences now name the face the round actually reads, and
the overall round carries one charter anchor.

- **The branch review is judged on the live tree.** The shared review sentence folded
  the branch review into the plan review, contradicting the branch criteria body that
  sits in the same prompt ("branch review IS the full diff"). The branch review now
  names the live tree against its base branch, with `INPUT_PLAN` as its
  plan-conformance reference; the plan, spec and overall reviews each name their own
  judged document.
- **The fix round no longer claims a spec line.** A document fix runs the docs-fix
  row, so the spec line the fix sentence described never appears on that face. On the
  branch line the `INPUT_SPEC` slot is what it always was — the design spec, a
  conformance reference, never the judged document.
- **The docs-fix round marks its reference un-editable.** On a plan-doc line the
  `INPUT_SPEC` slot is a reference that must not be edited in this round, and the
  overall line's own anchor is named there too.
- **One charter anchor on the overall face.** The overall round injected the same
  charter path into both `INPUT_SPEC` and `INPUT_OVERALL`, so the round asked for the
  charter to be judged against itself. `INPUT_SPEC` is now empty on that face in both
  its rounds (review and docs-fix), leaving `INPUT_OVERALL` as the single charter
  anchor; the four other document faces keep their `INPUT_SPEC` unchanged. The
  template contract's `$version` moves 21 → 22 to mark the shell-text change.