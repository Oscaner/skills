---
"@oscaner-skills/cdd-engine": minor
---

Every round artifact now derives its name from one place, the board names a crashed
round, and the handoff read-back refuses only the slots a child actually owes.

**One name derivation.** `RoundNaming` renders every artifact from a `RoundArtifact`
identity — line, op, cycle, attempt — so the draft, the final carrier, the report, the
log, the crash record and the evidence file can no longer disagree about a round's own
identity. The `-a{n}` attempt suffix is inserted at the stem tail (before `.c{c}`) and
omitted at attempt 1; the implement family carries its cycle like the review and fix
families do, so a task's implement carrier is `tasks-1-implement-1.json` and never
shadows a later attempt.

**The board names a crash.** A round that booked a withheld target action with at least
one hard violation renders one `crashed:` row in the top fact block — op, cycle ·
attempt, and the first hard cause. The row is an observation: the counts, the legend and
the `next:` hop are byte-identical with or without it.

**The read-back has two tiers.** A required slot that breaks its declaration still
blocks the round; a decorative slot — `notes`, `dispositions`, or a finding's `id` /
`section` / `line` / `fix` — is dropped from the draft in place and surfaced once on the
carrier's notes. A wrong optional column costs a field, never a round.

**Only an open wave is judged against the layers.** `closed-wave-fits-depends-on-layers`
now reads the ledger's open waves: a closed wave's layer fit was judged when it was
dispatchable, so a later plan edit no longer retro-flags a shipped wave. The rule id is
unchanged.

**The evidence sentence names its slot.** The injected contract text asks for "the file
named by `OUTPUT_EVIDENCE`" instead of spelling a family-prefixed file name, so the
naming face stays the single source of the artifact spelling.
