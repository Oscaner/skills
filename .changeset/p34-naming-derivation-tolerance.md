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
shadows a later attempt. Round records no longer carry `carrierPath` / `draftPath`: the
ledger derives both from the record's own identity, so a record cannot disagree with the
name it was written under, and an existing row's values are still read as history. A
row that never recorded a path still resolves its carrier: the read ladder probes the
retired spellings first — `spec-{op}-{round}.json`, and the cycle-less
`tasks-{tasks}-implement.json` of a first-cycle implement — before reporting the carrier
absent, so a folded legacy row and the orphan scan agree about the same file.

**The fix resume names the review's own attempt.** A fix round that resumes over a
review record whose carrier is gone falls back to the review family's name with only the
cycle in hand: the family's attempt comes from its own recorded round, never from the
retrying fix frame, so a crashed review is resumed on a name review attempt 1 actually
wrote.

**The board names a crash.** A round that booked a withheld target action with at least
one hard violation renders its token in the top fact block's single `crashed:` row —
op, cycle · attempt, and the first hard cause — with every crashed round joined by
` · ` on that one line. The row is an observation: the counts, the legend and the
`next:` hop are byte-identical with or without it. A round that declared its own
BLOCKED / TIMEOUT and booked only soft entries has no crashed token; the failure entry
the engine synthesizes for a round that authored no fact of its own is booked as
`round-blocked`, never `contract-violation` — a declared conclusion is not a broken
contract.

**The read-back has two tiers.** A required slot that breaks its declaration still
blocks the round; a decorative slot — `notes` on either plane, the judge plane's
`artifacts`, a work round's `dispositions`, or a finding's `id` / `section` / `line` /
`fix` — is dropped from the draft in place and surfaced once on the carrier's notes. A
wrong optional column costs a field, never a round. A finding's own `id` is the one
decorative column with an engine replacement: the drop retires the child's value and the
engine stamps its `F{n}` key afterwards, so the persisted row always carries the
primary key the next fix round's dispositions are keyed by.

**Only an open wave is judged against the layers.** `closed-wave-fits-depends-on-layers`
now reads the ledger's open waves: a closed wave's layer fit was judged when it was
dispatchable, so a later plan edit no longer retro-flags a shipped wave. The rule id is
unchanged.

**The evidence sentence names its slot.** The injected contract text asks for "the file
named by `OUTPUT_EVIDENCE`" instead of spelling a family-prefixed file name, so the
naming face stays the single source of the artifact spelling.
