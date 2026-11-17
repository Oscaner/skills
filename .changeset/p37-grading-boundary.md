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
  read-back judges each finding's `contract.path`. A path resolves in three ordered
  tiers — an exact repo entry, else a unique suffix, else the gate reports an ambiguity
  finding that names every candidate instead of silently picking a first hit. A line bound is
  judged on the file's own real lines, so a claim one line past the end is dead rather than
  lenient by one. A token carrying a `/` is a path whatever its extension (an asset
  coordinate is a claim like any other), while a dotted member name such as `process.env`
  stays a symbol. A bare
  symbol resolves only as a code declaration — a name that survives merely in a comment
  or a retirement guard's regex is dead, and the index is the reviewed repo's own
  sources rather than a fixed list of tree names, so the gate judges a consumer
  repository's declarations instead of reading an empty index there. A path a plan's `Create:` line declares while
  the tree has not landed it is pending, not dead: the judged document's own plan (its
  `slug:`, or the `program:` its identity document declares) opens that skip, and the
  program charter's `✔ Done（…）` row closes it. A dead pin is a real `warn` finding
  under the reviewed face's own lens — `consistency` on the spec shapes, `inventory` on
  a charter, `buildability` on a plan, `standards` on a wave or branch, always a label
  that face's prompt declares — it never refuses a round, but it does move a review to
  `REVIEW_FIX`. The shipped docs corpus is clean against that criterion — the tier ①→③
  reading over the whole declared corpus is zero after the one-off migration — and the
  engine suite's structural test holds it there: a document entering the corpus, a
  claim that stops resolving, or a path that starts naming more than one entry turns it
  red.
- Counts become checkable. A measured number in a document now carries a
  `census:<id> = <n>` reference, and a gate compares that `<n>` with the registered row's
  export — unequal is red, and an id nobody registered throws instead of reading as a
  number without a producer. Seven rows are registered: the pin census (`pin.symbol` ·
  `pin.path` · `pin.total` · `pin.files` — four readings off ONE scan, with `pin.path`
  covering the test pins too and `pin.files` the corpus volume rather than a finding
  count) and the two shipped registries (`criteria.rows` · `questions.rows` ·
  `questions.cells`). The reference grammar is half the judgment: a `census:` word
  outside the fixed form is prose about the form, while a well-formed but unregistered
  id still throws, so the gate's floor is not weakened by skipping metacharacters. A
  gate that compared zero references is red rather than silently green. At this point it
  measures one level — a document's count against the code that produces that number:
  the pin corpus and the two criteria tables, nothing inferred from prose.
