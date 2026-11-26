# The parity fixtures

The corpus's fixtures are the old suite's own shapes (spec §2.3), kept as declared file
sets and materialized into a fresh git-initialised temp tree per probe: the engine
resolves its root from the git top level, so a fixture is a real repository, never a
mocked path.

Seven TREE shapes (one per fixture declaration in `trees.ts`) and three NON-TREE
fixtures (`non-tree.ts`): the `init` `PATH` stand-in plus its injected step runner, the
`issue render` stdin findings body, and the frozen run date the skeleton assembler takes
as a constructor argument.

Each shape's reading through the old entry is recorded below. A reading is evidence, not
an expectation: the expectations are the bytes in `baseline/src-next.json`.

### `empty`

`cdd board --plan docs/kairos/plans/p9.md`

```
cdd board: no docs match --plan docs/kairos/plans/p9.md
```

`cdd implement --tasks 1 --plan docs/kairos/plans/p9.md --dry-run`

```
Usage: cdd implement [options]
error: cannot read file: docs/kairos/plans/p9.md
```

### `wave`

`cdd board --plan docs/kairos/plans/p9.md`

```
cdd board: p9

  in-flight: free — no dispatch holds this tree
```

`cdd implement --tasks 1 --plan docs/kairos/plans/p9.md --dry-run`

```
cdd implement: cannot dispatch a implement round — wrong-phase · next: review --type phase-spec --spec docs/kairos/specs/p9-design.md
checked:
  tree-clean
```

### `inflight`

`cdd board --plan docs/kairos/plans/p9.md`

```
cdd board: p9

  in-flight: pid 17161 · op: implement · cycle: 1 · attempt: 1 · slug: p9 · wave: 1
```

`cdd implement --tasks 1 --plan docs/kairos/plans/p9.md --dry-run`

```
cdd implement: preview (no repo changes)
  lock: held by pid 17161 · command: cdd implement --tasks 1 --plan p9.md · started: 2026-11-26T02:30:38.000Z · wave: 1 · slug: p9
checked:
```

### `refused`

`cdd board --plan docs/kairos/plans/p9.md`

```
cdd board: p9

  in-flight: free — no dispatch holds this tree
```

`cdd implement --tasks 1 --plan docs/kairos/plans/p9.md --dry-run`

```
cdd implement: preview (no repo changes)
  step:        implement round 1 — wave 1
  reads:       .kairos/cdd/p9/tasks-1-brief.md (would re-render from the current plan)
```

### `doc-drift`

`cdd board --plan docs/kairos/plans/p9.md`

```
cdd board: p9

  in-flight: free — no dispatch holds this tree
```

`cdd implement --tasks 1 --plan docs/kairos/plans/p9.md --dry-run`

```
cdd implement: cannot dispatch a implement round — wrong-phase · next: review --type phase-spec --spec docs/kairos/specs/p9-design.md
checked:
  tree-clean
```

### `stale-holder`

`cdd board --plan docs/kairos/plans/p9.md`

```
cdd board: p9

  in-flight: pid 1 · op: implement · cycle: 1 · attempt: 1 · slug: p9 · wave: 1 — the dispatch's target is gone — the plan the record names is not on this tree — re-run the same command with --recover to take the in-flight record over
```

`cdd implement --tasks 1 --plan docs/kairos/plans/p9.md --dry-run`

```
cdd implement: preview (no repo changes)
  lock: held by pid 1 · command: cdd implement --tasks 1 --plan p9.md · started: 1970-01-01T00:00:00.000Z · wave: 1 · slug: p9
the dispatch's target is gone — the plan the record names is not on this tree — re-run the same command with --recover to take the in-flight record over
```

### `branch-closed`

`cdd board --plan docs/kairos/plans/p9.md`

```
cdd board: p9

  in-flight: free — no dispatch holds this tree
```

`cdd implement --tasks 1 --plan docs/kairos/plans/p9.md --dry-run`

```
cdd implement: cannot dispatch a implement round — wrong-phase · next: review --type phase-spec --spec docs/kairos/specs/p9-design.md
checked:
  tree-clean
```

