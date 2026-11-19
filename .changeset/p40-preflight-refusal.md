---
"@oscaner-skills/cdd-engine": minor
---

Refuse a dispatch before the round exists, and record the refusal as the tree's own fact (P40).

The four in-dispatch gates — no-host · carrier · dispatch-input · artifact — move into the
pre-flight `DispatchAuthority` structure leg as its rows 6–9, reusing the existing
`DispatchRefusal` and `structureRefusal()`. A structure-leg refusal never reaches
`Ledger#recordRound`: no round number is consumed, `board` prints no `crashed:` line, and a
re-dispatch reads as the round it would have been. The refusal lands as one tree-level record,
`.kairos/cdd/refusal.json` — a new artifact, the neighbour of `in-flight.json` — with eight
cells `{at, slug, op, type, cycle, attempt, station, detail}`, and `board` renders it as one
`refused:` line. One record per tree, with two expiry triggers: the gate clears it when the
whole structure leg passes, and the dispatch body clears an `in-flight` record when its holder
is released.

Six consumer-visible changes, one per spec constraint:

- ① `no-host`, `carrier` and `artifact` now print their station as the first segment of their
  first line — `CDD_BLOCKED: no-host · …`, `CDD_BLOCKED: carrier · carrier-mismatch · …`,
  `CDD_BLOCKED: artifact · artifact-identity · …`. The detail text is unchanged byte for byte;
  only the station prefix is new, and it applies to the first line only — the artifact row's
  `derived:` / `found:` / `identity:` / `repair:` continuation lines follow unchanged.
- ② A structure-leg refusal under `--dry-run` is stated by the stdout preview block
  (`refused:  <station> · <detail>` plus the seam's continuation lines, the details rows and
  the `checked:` face) instead of the five-row forecast, on both channels — `CDD_BLOCKED:` and
  `cdd <verb>: `. ③ That same entry carries its other half: in a tree with no harness,
  `--dry-run` changes from "five-row forecast + exit 0" to "preview block + exit 1". A tree
  with a harness still forecasts and still exits 0.
- ④ The `checked:` face gains four rows on every input-faced dispatch that reaches them —
  no-host · carrier · dispatch-input · artifact, all always, with no fix-only arm (`carrier` and
  `artifact` short-circuit to null on non-fix faces and still record a row). Every pinned read of
  the existing `checked:` bytes therefore moves; that is the named change, not a regression. The
  four rows stand down in two places, both named: a wave dispatch whose predicted batch is empty
  has no input face (the whole batch retires and the verdict goes to the line leg), and a
  dispatch refused by whichever row is judged before them never reaches them — `checked:`
  stops at the refusing row, so a dirty tree records `tree-clean` alone.
- ⑤ `board` gains two lines on the NODE board: the standing
  `refused: {op} {cycle}·a{attempt} {station} · {detail}` line at the tail of the tree-level
  fact block (after `in-flight:` · `orphan:` · `crashed:`), and `refused: unreadable refusal
  record` when the record on disk cannot be read — never silently treated as "no refusal".
  The program board (`cdd board --spec <overall>`) renders no tree-level fact block, so it
  shows neither line. The new artifact `refusal.json` is the fact behind both.
- ⑥ When both legs fail at once, the message now belongs to the structure leg instead of the
  line leg, because the four migrated gates run before it. The line leg's own refusals stay
  reachable after the nine structure rows pass.
