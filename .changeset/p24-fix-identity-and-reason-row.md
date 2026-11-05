---
"@oscaner-skills/cdd-engine": minor
---

**A completed fix round advances the line's reviewed identity, every hop-rendered `next:`
line gains a `reason:` row, a drifted wave hop names `doc-drift`, and the round capsule
renders the board's own hop (P24).** Consumer-visible face changes carried by one release
entry:

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

A wave hop whose brief moved after the review bound it now says `doc-drift`: the row that
could only say `task-open` in that state now names the movement, on `cdd board --plan
<path>` and in the `peekNext` directive alike. The wave still derives its hop from a single
`nextHopOf` call — the brief-drift fact is one conditional field on that input object,
never a second route, and it never moves the wave's station.

The board's pipeline frontier reads drift on the spec and plan lines too: a spec (or plan)
whose content moved after a clean review no longer counts as a closed face, so the frontier
holds on that document's face and renders its review lead with `reason: doc-drift` instead
of walking on to the next command (the wave's `implement --plan … --tasks …`, which the
dispatch would reject). Once that re-review closes, the frontier advances again. An absent
spec or plan is judged exactly as before.

The round capsule now renders the object `cdd board` renders. One assembly in the session
plane answers both — the verdict's target supplies the hop, its document and the named
reason — so where the capsule used to print this line's own next step it prints the
pipeline frontier's, `next:` and `reason:` alike, and the two faces can no longer disagree.
On a closed line that also holds a same-slug plan, the three documents that own the
identity slot take the successor plan face's review literal: a closed phase-spec prints
`review --type plan --plan …` with `reason: task-open` (it printed `route to …:cdd-plan
skill` with `reason: closed-line`), and a closed `overall` charter and a closed
`single-spec` print the same literal (they printed `done` with `closed-line` / `face-closed`
respectively). A closed charter with no plan document keeps its `next: done` /
`reason: closed-line` bytes, and a node with no spec document keeps its line-local hop
unchanged.

The board's summary cell no longer conflates success volume with failure history. Within
the board's summary cell, a verb that carries a failed attempt now shows an ok/attempts
ratio (omitted when that verb has no successful round, so a failure-only row keeps its
bare ✗ token) and marks a recovered retry with `✗→✓`; every row that carries no failed
attempt keeps its bytes unchanged. The cell renders the plan line's own
history as `review 13 ✓+74 · fix 13/14 ✓ · fix 12 ✗→✓` where it printed `review 13 ✓+74 ·
fix 11 ✓ · fix 1 ✗ · fix 2 ✓`: the count reads as attempts, the failed round is named by
its cycle instead of a re-counted segment, and a failed attempt whose same-cycle
re-dispatch completed is marked as recovered.
