---
"@oscaner-skills/cdd-engine": minor
---

`cdd board` now prints each round's `notes` as a count. Every round's note bodies used to be inlined into its progress cell, so a phase board's bytes were mostly prose; the token now stops at `notes +M`, keeps that count exactly where it sat, and appends the same folded rows under a new bool flag, `--notes` (no counted variant). A board rendered with `--notes` is byte-identical to the previous output, a board rendered without it carries the count and no body, and neither form changes the token order (`verb · body · mark · +N · downgrade note · notes +M`) or the one-line-per-token shape.

The closure reading that `doc-contract` receives is now a reader of its own (`ClosedDocument`), enumerated through the same identity index the command preamble already builds; the fence-aware markdown reader and the path grammar moved onto the rule plane — those three legs keep judging.

The pin gate itself retires whole. A document's backticked path, symbol and test title are no longer judged: the criterion row that named the gate leaves `CRITERIA_ROWS` (the rubric renders one row shorter, and the row `face` vocabulary loses its `test` value), a round no longer injects warn rows into a review's `findings`, and the review criteria table carries no engine-authored lens. No flag is removed — `cdd review`, `cdd plan` and the handoff schema are unchanged.

The census comparison machine retires with the corpus arm it served: `contract/census.ts` keeps only the reference grammar (`CensusGate.referencesOf`), and the rule declaration surface's seat vocabulary loses its `corpus` value — a doc row now declares `dispatch` · `close`, a ledger row `ledger`. No judgment changes: the shape rules still read the grammar, and the retired corpus arms leave their rules with the fixtures they had (a violation reports, a neighbour stays silent, an empty candidate set is measured).
