---
"@oscaner-skills/cdd-engine": minor
---

**A completed fix round advances the line's reviewed identity, and every hop-rendered
`next:` line gains a `reason:` row (P24).** Two consumer-visible face changes.

The reviewed-revision write-back now fires on a completed **fix** round, not only on a
review: the round that moved the document is the round that binds the new identity, so a
warn-only fix no longer leaves the line drifting in its own delta and the `next:` row
closes (`done` / the pipeline handoff / the next wave) where it used to print
`review --type …` forever. A `BLOCKED` / `TIMEOUT` fix binds nothing, an out-of-round
document edit still reopens the review, and `progress.json` keeps its key set.

Each `next:` line a hop renders is followed by exactly one `reason: <token>` row carrying
one of the seven named facts (`doc-drift`, `pending-fix`, `soft-cap`, `task-open`,
`doc-class-blocked`, `face-closed`, `closed-line`). The `next:` bytes are unchanged — the
diagnostic fact takes its own line, so the literal still pastes into a shell verbatim. A
round with no hop (BLOCKED / TIMEOUT) prints neither row. The capsule takes the row's
prefix from the word table (a fifth `reason:` station), the board from its own 11-column
layout literal; both render the same token for the same hop. The `--dry-run` preview gains
the fix leg and reports the branch line's `reviewedRevision(doc)` write-back it always
performed.