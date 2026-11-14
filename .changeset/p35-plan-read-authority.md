---
"@oscaner-skills/cdd-engine": minor
---

The plan's read is the read authority for every face: the board, the pre-flight graph gate and the pipeline frontier now derive their wave sets from one `PlanRead`, and the places that used to guess a plan path from the document index no longer do.

- The doc faces (`cdd board --spec`, `cdd review --type phase-spec`) take the plan path from the read itself: a plan that reads out is entered even when the index does not register it, a plan whose bytes do not read keeps the phase-spec hand-off (`route to kairos:cdd-plan skill`), and a plan whose grammar breaks routes to the plan face's exit phrase (`route to kairos:cdd-dev skill`) rather than a literal that fills in the path.
- `slug` is the whole identity, as before: a phase whose plan sits on a file name other than `<slug>.md` reads as "no plan yet" (`wave     (none)`, exit 0) with no error and no fallback to an index guess.
- The reverse lookup that asks whether a plan names a phase only probes existence: a `<slug>-design.md` that is present but unreadable is NOT an orphan. Every face proceeds, and the board renders the spec row as the undecided `(none)` instead of fabricating `! no-spec` and a spurious `CDD_BLOCKED`.
- One plan read per command means every wave-bearing face agrees: the board's `W1 {…}` rows, the graph the pre-flight judges and the frontier's wave keys are the same list, and a plan that changes on disk after the read never makes one face report a different document.
