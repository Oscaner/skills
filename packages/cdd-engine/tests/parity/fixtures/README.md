# The parity fixtures

The corpus's fixtures are the old suite's own shapes (spec §2.3), kept as declared file
sets and materialized into a fresh git-initialised temp tree per probe: the engine
resolves its root from the git top level, so a fixture is a real repository, never a
mocked path.

The TREE shapes declared in `trees.ts` (one entry per shape, no second list) and three
NON-TREE fixtures (`non-tree.ts`): the `init` `PATH` stand-in plus its injected step
runner, the `issue render` stdin findings body, and the frozen run date the skeleton
assembler takes as a constructor argument.

## The shapes and their knobs

A shape is the tree's KIND; `TreeOptions` is the state that kind carries, so a cell that
needs a wider wave or a half-written ledger turns a knob instead of minting a shape.
`overall` is the one shape that is NOT a knob's state: it is a DOCUMENT KIND — a charter plus
the phase specification whose `program:` names it — and only that shape's board is the
program's, so no knob of the other shapes can stand in for it:

| knob | what it sets |
| --- | --- |
| `tasks` | the plan's width — how many task blocks it declares |
| `chain` | whether task N depends on task N−1 (one task per derived layer) or every task stands alone (one wide layer) |
| `rounds` | how far the open wave's row has advanced: `none` (dispatched, no round yet) · `implement` · `review` · `re-review` (implement · review · fix recorded with the source review still carrying a blocker, so the wave owes its RE-REVIEW — the one state whose review cycle and next review cycle differ) · `closed` |
| `snapshot` | whether a closed row keeps its plan-task set — the wave gate's append exemption reads it |
| `holder` | the two in-flight shapes' holder facts; `"live"` asks the harness to resolve this process |
| `corruptLock` | plants the corrupt in-flight record WITH its lock left behind (the third holding shape) |
| `orphanDraft` | `materialize` drops one handoff draft no recorded round claims — the board's `orphan:` row |
| `crashedRound` | books one round whose verdict withheld its target action and carries a HARD violation — the board's `crashed:` row |
| `artifactArms` | carries the inventory's two arms: a review round whose rulings sidecar sits at its rendered name (read `ok`) and a review round whose carrier stands but whose sidecar is absent (read `absent`) |
| `twoWaves` | declares a two-wave plan — two chained tasks, and a progress document recording BOTH wave rows: the board's segment then has two rows to place one frontier marker and one label column on |
| `phaseCells` | gives the `overall` shape's phase one completed round on each line its program-board row summarises (`phase-spec` · `plan` · `branch`), so the phase row prints its cells |
| `unreadable` | repo-relative paths that land and then have their permission bits cleared — an EXISTING target that cannot be read. The probes and the tree shapes hold no mode literal: a fixture declares the paths and `materialize` clears their bits after the commit (git must be able to read the blob it records; the command under observation must not) |

The three cause fixtures the refusal cells need are shapes with knobs, never new shapes:
a wide wave is `wave` + `tasks: 4`; a split is `wave` + `tasks: 2` requested as one task;
a chained plan is `wave` + `chain: true`; a half-closed batch is `wave` + `rounds:
"closed"` + `snapshot: false`.

## What the recordings normalize

Two families of byte cannot be equal across two materializations of the same fixture, and
the recorder spells them as corpus constants rather than dropping the cell:

- the fixture's OWN root — a diagnostic that prints the resolved absolute path (a carrier
  mismatch, an artifact report) records it as `<repo>`;
- the corpus's own runtime facts — a holder's `pid`, its `started:` instant and its
  `running for` uptime are facts about the process the corpus started, so they record as
  `<pid>` / `<startedAt>` / `<uptime>`; a `recorded=` digest is the engine's memory of a
  carrier whose bytes carry a write instant, so it records as `<digest>`. The judgment
  around them — `alive` / `gone`, the takeover hint, the target-gone sentence, the
  `current=` digest of the bytes the corpus itself plants — stays in the byte.

`f3.skeleton-landing` records the landing PROJECTION, not a byte string: the cell's value
is the path the command echoed plus what the run left at the target
(`landed.md target=written` today). The judgment happens INSIDE the run — both trees write
their own target under the same clock, and `landingDiff` compares the two targets' sha256,
so a target the run did not write is a difference rather than a fact. Nothing in this cell
is compared against the baseline: the skeleton's `date:` line is the system clock and the
CLI has no seam for it, so a cross-day byte baseline for that cell would be a lie. Its
content face is `f3.skeleton.*`, recorded in-process under the corpus's frozen date.

Each shape's reading through the old entry is recorded below. A reading is evidence, not
an expectation: the expectations are the bytes in `baseline/src-next.json`.

### `empty`

`cdd board --plan docs/kairos/plans/p9.md` (exit 2)

```
cdd board: no docs match --plan docs/kairos/plans/p9.md
```

`cdd implement --tasks 1 --plan docs/kairos/plans/p9.md --dry-run` (exit 2)

```
Usage: cdd implement [options]
error: cannot read file: docs/kairos/plans/p9.md
```

### `wave` with `unreadable: [<the plan>]`

The "exists but cannot be read" axis, on its own, because the two failure families answer
the same exit code and different bytes:

`cdd board --plan docs/kairos/plans/p9.md` (exit 2)

```
cdd board: cannot read --plan docs/kairos/plans/p9.md
```

`cdd board --plan docs/kairos/plans/absent.md` (exit 2) — the ABSENT arm, which is what a
probe would record instead if it swapped one target for the other:

```
cdd board: no docs match --plan docs/kairos/plans/absent.md
```

### `wave`

`cdd board --plan docs/kairos/plans/p9.md` (exit 0)

```
cdd board: p9

  in-flight: free — no dispatch holds this tree
  overall  p9-overall.md   v1.0 · Approved
  spec     p9-design.md    v1.0 · Draft
  plan     p9.md           v1.0
```

`cdd implement --tasks 1 --plan docs/kairos/plans/p9.md --dry-run` (exit 0)

```
cdd implement: preview (no repo changes)
  step:        implement round 1 — wave 1
  reads:       .kairos/cdd/p9/tasks-1-brief.md (would re-render from the current plan)
  would write: .kairos/cdd/p9/tasks-1-implement-1.json · .kairos/cdd/p9/tasks-1-implement-1-report.md · .kairos/cdd/p9/tasks-1-implement-1-test-evidence.json
  would record: progress.waves["1"].rounds += { op: implement, cycle: 1, attempt: 1 }
  child:       pi -p --mode text
```

### `inflight`

`cdd board --plan docs/kairos/plans/p9.md` (exit 0)

```
cdd board: p9

  in-flight: pid <pid> · op: implement · cycle: 1 · attempt: 1 · slug: p9 · wave: 1
```

`cdd implement --tasks 1 --plan docs/kairos/plans/p9.md --dry-run` (exit 1)

```
cdd implement: preview (no repo changes)
  lock: held by pid <pid> · command: cdd implement --tasks 1 --plan p9.md · started: <startedAt> · wave: 1 · slug: p9
checked:
  tree-clean
  in-flight: held — pid <pid>
```

### `refused`

`cdd board --plan docs/kairos/plans/p9.md` (exit 0)

```
cdd board: p9

  in-flight: free — no dispatch holds this tree
  refused: implement 1·a1 graph · task 1 depends on a task the plan does not declare
```

`cdd implement --tasks 1 --plan docs/kairos/plans/p9.md --dry-run` (exit 0)

```
cdd implement: preview (no repo changes)
  step:        implement round 1 — wave 1
  reads:       .kairos/cdd/p9/tasks-1-brief.md (would re-render from the current plan)
```

### `doc-drift`

`cdd board --plan docs/kairos/plans/p9.md` (exit 0)

```
cdd board: p9

  in-flight: free — no dispatch holds this tree
  overall  p9-overall.md   v1.0 · Approved
  spec     p9-design.md    v1.0 · Draft
  plan     p9.md           v1.0
```

`cdd implement --tasks 1 --plan docs/kairos/plans/p9.md --dry-run` (exit 1)

```
cdd implement: cannot dispatch a implement round — wrong-phase · next: review --type phase-spec --spec docs/kairos/specs/p9-design.md
checked:
  tree-clean
```

### `stale-holder`

`cdd board --plan docs/kairos/plans/p9.md` (exit 0)

```
cdd board: p9

  in-flight: pid <pid> · op: implement · cycle: 1 · attempt: 1 · slug: p9 · wave: 1
```

`cdd implement --tasks 1 --plan docs/kairos/plans/p9.md --dry-run` (exit 1)

```
cdd implement: preview (no repo changes)
  lock: held by pid <pid> · command: cdd implement --tasks 1 --plan p9.md · started: <startedAt> · wave: 1 · slug: p9
the dispatch's target is gone — the plan the record names is not on this tree — re-run the same command with --recover to take the in-flight record over
```

### `branch-closed`

`cdd board --plan docs/kairos/plans/p9.md` (exit 0)

```
cdd board: p9

  in-flight: free — no dispatch holds this tree
  overall  p9-overall.md   v1.0 · Approved
  spec     p9-design.md    v1.0 · Draft
  plan     p9.md           v1.0
```

`cdd implement --tasks 1 --plan docs/kairos/plans/p9.md --dry-run` (exit 1)

```
cdd implement: cannot dispatch a implement round — wrong-phase · next: review --type phase-spec --spec docs/kairos/specs/p9-design.md
checked:
  tree-clean
```

### `overall`

`cdd board --plan docs/kairos/specs/p9-overall.md` (exit 0)

```
cdd board: p9-overall

  overall  p9-overall.md   v1.0 · Approved   review 1 ✓

  phase p9  Draft   wave W1…   title: P9 spec

  next:    done
```

`cdd board --plan docs/kairos/specs/p9-overall.md --artifacts` (exit 0) adds the program
seat's own observation — the charter line's review round reads `absent`, so the row appears
only with the switch open:

```
  art:     overall · rulings · c1·a1   absent
```

Closure and the wave gate's causes are read off the same declarations: a `closed` row
needs its review CARRIER on disk (the closure judge reads the round's own carrier bytes,
so a row without one is an open verdict whatever its records say), and a closed row
WITHOUT its plan-task snapshot is the shape that makes a mixed batch block
(`waveProgress` in `trees.ts` plants both).
