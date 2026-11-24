---
"@oscaner-skills/cdd-engine": minor
---

`cdd board` now prints each round's `notes` as a count. Every round's note bodies used to be inlined into its progress cell, so a phase board's bytes were mostly prose; the token now stops at `notes +M`, keeps that count exactly where it sat, and appends the same folded rows under a new bool flag, `--notes` (no counted variant). A board rendered with `--notes` is byte-identical to the previous output, a board rendered without it carries the count and no body, and neither form changes the token order (`verb · body · mark · +N · downgrade note · notes +M`) or the one-line-per-token shape.

The closure reading that `doc-contract` receives is now a reader of its own (`ClosedDocument`), enumerated through the same identity index the command preamble already builds; the fence-aware markdown reader and the path grammar moved onto the rule plane. No command, flag or rendered byte of the pin gate changes in this release.
