---
"@oscaner-skills/cdd-engine": patch
---

The write-back judgment is split by phase: `ReviewedIdentity#gatedByTouchedDoc` answers
`true` for `fix` alone, so `#bookkeep` applies the `touchedDoc` condition to the fix
phases only while every judging phase writes its reviewed revision back unconditionally.
A completed `review` or `branch-review` now binds the revision it concluded on even when
the round touched no document — the completion, not the file edit, is the write-back
condition, so an out-of-round edit re-drifts to `review` instead of leaving the line
endlessly re-dispatched with the ledger's `reviewedRevision` never advancing.
The `fix` side keeps #446 exactly as it was: `touchedDoc: true` binds the current
revision, `false` keeps the old binding, `null` binds and carries one `soft` observation,
and an absent value defaults to binding — `REVIEWED_WRITE_PHASES` and the `touchedDoc`
fact computation (`face/lifecycle.ts#touchedDocOf`) are untouched, as is
`session/next.ts`.
