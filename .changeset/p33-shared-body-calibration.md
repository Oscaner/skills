---
"@oscaner-skills/cdd-engine": minor
---

The dispatch prompt's shared body now names the object each sentence is about, and its
discipline clauses bound their own scope.

- **The freeze clause limits itself to the declared capability.** It used to assert an
  absolute freeze beside the `capability: may.amend = content` declaration and the
  docs-fix in-place instruction, so a document round read an authorization, an order
  and an absolute prohibition in one prompt. The clause now freezes approved plan/spec
  files only beyond this round's declared amending scope; the structure face stays
  outside amending authority in every round.
- **The commit clause names the read-only round.** A review round has nothing to
  commit — its only writes are the prescribed `OUTPUT_*` artifacts — so the clause says
  so instead of contradicting the round's `**Read-only:**` discipline.
- **The capability declaration names the judged document families.** It reads
  phase-spec / single-spec / overall charter / plan, so the declaration and the freeze
  clause agree on every document face, including a docs-fix round on a charter.
- **The program-conformance criterion is scoped to phase-spec.** A single-spec carries
  no `program:` and no `INPUT_OVERALL` and is not a phase, so the shared narrative body
  no longer asks it to judge against a parent that cannot exist.
- **The branch criteria speak `wave`.** The retired `task` word is gone from the
  criteria body.
- **The charter's severity rubric reads charter / phase author.** The overall review
  judged a charter as "the reviewed spec" against "a reasonable downstream author".

`$version` moves 22 → 23 to mark the shell-text change.
