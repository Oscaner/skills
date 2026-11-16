---
"@oscaner-skills/cdd-engine": minor
---

Grading becomes checkable end to end (P37).

- The three tier boundaries, each tier's evidence duty and each tier's counterexample
  are rows in one criteria registry, and the severity rubric is assembled from them —
  the tier prose is no longer a second copy of the criteria.
- A `blocker` finding owes a reproducible `impact.scenario`; a blocker without one is
  refused on the handoff read-back with `CDD_BLOCKED: grading-impact-missing`, naming
  every offending finding. `warn` / `nit` owe nothing, and the review rollup still
  returns one status.
- Each lens declares what counts as crossing into functional impact: nineteen
  (review kind, lens) questions live in their own table, and every review prompt now
  ends its criteria line with that kind's numbered question list. The two
  `(severity by your judgment)` escapes are gone and the wave / branch lens enums gain
  the `scope` value their guides already judged.
- Wave and branch reviews see the phase contract: the round context carries
  `INPUT_SPEC` (and `INPUT_OVERALL` when the identity document has a `program:`), so a
  contract violation is visible on the code-review face.
- Cross-round regrade: when a finding returns one tier lower while the earlier round
  carried a non-empty `impact.scenario`, the new round owes a `regrade` reason. A
  missing reason prints one visible mark on the board's verb token and one on the
  capsule's summary line; a stated reason prints the reason itself, once on each face —
  display only: no finding row, no carrier entry, and the round's conclusion is
  unchanged.
- Pin parseability gate: a document's path, bare-symbol or test-title claims must
  resolve in the tree. One criterion, three corpora: the engine suite scans the whole
  docs corpus, a document review scans the judged document's own body, and the handoff
  read-back judges each finding's `contract.path`. A bare symbol resolves only as a code
  declaration — a name that survives merely in a comment or a retirement guard's regex is
  dead. A dead pin is a real `warn` finding under the reviewed face's own lens —
  `consistency` on the spec shapes, `inventory` on a charter, `buildability` on a plan,
  `standards` on a wave or branch, always a label that face's prompt declares — it never
  refuses a round, but it does move a review to `REVIEW_FIX`.
