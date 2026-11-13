---
"@oscaner-skills/cdd-engine": minor
---

A dispatch prompt now states which target it judges, names the face each sentence
actually reads, and bounds its own discipline clauses.

**The target type renders.** The token that selected the review variant was supplied
but never printed, so a fix or docs-fix child never read the target word its `--type`
declared. It is now `TARGET_TYPE`, rendered as ``- `TARGET_TYPE`: <target word>``
immediately below `ROLE` on the six review faces, the two fix faces (`wave` ·
`branch`) and the four document-fix faces (`plan` · `phase-spec` · `overall` ·
`single-spec`). The value is the CLI `--type` word, so the prompt speaks the same
vocabulary the command line does. An implement round has no target, so its layout
omits the line and the empty value is dropped — no blank slot.

**Each sentence names its own face.** The shared review sentence had folded the branch
review into the plan review, contradicting the branch criteria body in the same prompt.
The branch review now names the live tree against its base branch, with `INPUT_PLAN` as
its plan-conformance reference; the plan, spec and overall reviews each name their own
judged document. The fix sentence no longer describes a spec line — a document fix runs
the docs-fix row, so that face never appears there; on a branch line `INPUT_SPEC` is
what it always was, the design spec as a conformance reference and never the judged
document. A docs-fix round on a plan line marks its `INPUT_SPEC` reference un-editable.

**One charter anchor on the overall face.** The overall round injected the same charter
path into both `INPUT_SPEC` and `INPUT_OVERALL`, asking for the charter to be judged
against itself. `INPUT_SPEC` is now empty on that face in both its rounds, leaving
`INPUT_OVERALL` as the single charter anchor; the four other document faces keep their
`INPUT_SPEC` unchanged.

**The discipline clauses bound their own scope.** The freeze clause asserted an absolute
freeze beside the `capability: may.amend = content` declaration and the docs-fix
in-place instruction, so a document round read an authorization, an order and an
absolute prohibition in one prompt. It now freezes approved plan/spec files only beyond
this round's declared amending scope, with the structure face outside amending authority
in every round. The capability declaration names the judged document families
(phase-spec · single-spec · overall charter · plan) so it agrees with that clause on
every face, including a docs-fix round on a charter. The commit clause states that a
read-only round has nothing to commit and its only writes are the prescribed `OUTPUT_*`
artifacts, instead of contradicting the round's `**Read-only:**` discipline.

**Three renamed-concept residues are gone.** The program-conformance criterion is scoped
to phase-spec — a single-spec carries no `program:` and no `INPUT_OVERALL` and is not a
phase, so it is no longer asked to judge against a parent that cannot exist. The branch
criteria body speaks `wave` rather than the retired `task`. The charter's severity
rubric reads charter / phase author instead of "the reviewed spec" against "a reasonable
downstream author".

Shell titles, the `**Criteria — …:**` labels and the `**Lens labels:**` lines stay
byte-identical; a criteria body may change only where the scoping above requires it,
uniformly across the variants that share it. The template contract's `$version` moves
20 → 23 to mark the token- and shell-text changes.
