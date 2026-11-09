---
"@oscaner-skills/cdd-engine": minor
---

A round's ledger facts now have to survive the disk: a carrier cannot be silently
rewritten, a fix round's write-back binds only to the bytes that round touched, and a
change-history header must be exactly the declared four columns.

- **Rulings ride a sidecar, not the carrier.** A finding's ruling is a `.rulings.json`
  sibling of its review carrier (same stem, ending `.json` → `.rulings.json`), authored by
  the orchestrator — no new CLI verb, no `--ruling` flag. A fix / docs-fix dispatch with a
  valid sidecar carries an `INPUT_RULINGS` round-context line naming that path; an absent
  sidecar renders no line at all. The sidecar is judged strictly before spawn: a missing
  `rulings` key, non-JSON bytes, a ruling without `finding` / `ruling`, an unknown key at
  either level, or a finding id that is not in the carrier each stop the dispatch as
  `CDD_BLOCKED` with the offending path, and the child is never spawned.
- **A carrier carries its own digest, and is read-only once it lands.** Every carrier the
  engine authors records the digest of its payload (`contentSha256`, plus
  `RoundRecord.carrierDigest`), and every read entry — the fix input, the board counts, the
  capsule — compares the bytes with it; a tampered carrier is refused as `carrier-mismatch`
  on the `CDD_BLOCKED` channel naming both ends (`recorded=` / `current=`), instead of being
  read as the round's answer. The carrier is sealed `0o444` from the instant it is authored:
  a dispatch unseals exactly its own two names, every terminal — booked, rejected, aborted,
  gate-refused, holder-race-lost — seals them again, and the next preflight sweeps any
  carrier a process killed outside the engine left writable. Ruling sidecars are never
  sealed, and a digest-less historical record is read as a present fact (no mismatch, no
  backfill, no `chmod` walk).
- **The draft stays the draft; the final lands beside it.** `bookkeep` no longer overwrites
  the child's handoff: the finalized payload is written at a settled `<stem>.c<N>.json`
  beside the draft, the round record names both (`carrierPath` → final, `draftPath` →
  draft), and every face that names the fix input — `--reviews`, resume, the ruling sidecar
  sibling — names the final.
- **Write-back binds only bytes this round touched.** `reviewedRevision` moves to the
  reviewed document's revision only when this round's own commits (`dispatchBase..HEAD`)
  touched it. A review that concluded before an out-of-round edit keeps pointing at the
  reviewed bytes, so the next review reports drift rather than `unchanged`; a fix that
  edited the document binds the new bytes; when git cannot be read the binding stays put
  and the round carries one `soft` observation, with its verdict unchanged.
- **The change-history header is inside the gate.** A new `change-history-header-columns`
  invariant requires the header row to be exactly `Version · date · summary · author`
  (trimmed, cell by cell), so a hand-added fifth column is a finding instead of a row width
  nobody checks; `change-history-row-shape` keeps the orthogonal row-width leg, and the
  corpus carries zero findings of the new kind.
