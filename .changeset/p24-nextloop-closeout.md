---
"@oscaner-skills/cdd-engine": minor
---

**The loop closes, the reason rides its own row, and a wave line can drift like a doc line
(P24).** Three consumer-visible facts, and the shipped prose now states each of them.

A **fix** round with zero blockers now closes its line. The reviewed identity advances on
the completed fix, so the replacement review no longer reopens against the very document
that fix just moved — the `next:` row hands off (`cdd-close`, the next wave) instead of
sending the line back to a review that has nothing left to judge.

Every hop-rendered `next:` line is followed by one `reason: <token>` row naming the fact
that produced it. The `next:` bytes are unchanged — the token takes its own line, so the
literal still pastes into a shell verbatim, and a round with no hop prints neither row.

A **wave** line now reopens on drift and says so: the brief's reviewed identity is recorded
on the wave the way a document's is, so `cdd board --plan <path>` and the `peekNext`
directive mark the hop `doc-drift` when the brief moved after the review bound it. The
wave still derives its hop from a single call — the drift fact is one conditional field on
that input, never a second route.
