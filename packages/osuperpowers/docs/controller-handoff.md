# Controller Handoff (H1-H5)

The discipline by which the orchestrator (cli-driven-development) drives the cdd engine. Cited by cli-driven-development, cli-select, and the orchestrator skill. Cross-skill references use markdown links (semantic rule name + `#rule-<kebab>` anchor, e.g. `[Return Block](controller-handoff.md#rule-return-block)`).

## Rules

### Rule: Return Block

CLI agent stdout is at most H1 four lines (fixed keys, one per line); the orchestrator reads only H1:

```
status: <DONE|BLOCKED|NEEDS_CONTEXT>
commits: base=<sha> head=<sha>
artifacts: brief=<path> report=<path> test_evidence=<path>
blocker: <none|one-line>
```

Report bodies, review prose, full diffs, and test stdout exist only in files — they do not enter the dispatch return. The implementer writes `<workspace>/task-N-test-evidence.json` separately before returning (see [handoff-schema.md](handoff-schema.md)).

### Rule: Handoff Only

The orchestrator reads only `handoff.json` to drive the next step; it does not read report body / review axis prose:

- `plan_conflicts[]` non-empty → **STOP**
- `status: CHANGES_REQUESTED` → fix chain (H4)
- `status: NEEDS_CONTEXT` / `unverifiable[]` non-empty → **STOP**

### Rule: Review Package

Review uses the upstream `review-package` to generate a diff package; scope uses handoff `commits.base` (`git diff <base>...HEAD`).

### Rule: Fix Cap

Fix loop is capped at **5 rounds**; exceeding the cap → STOP + escalate (ask human); fix re-review scope uses `FIX_BASE..HEAD`, where `FIX_BASE` = HEAD before dispatch.

### Rule: Inline Handoff

Handoff writes are inlined in each mode template (`templates/cdd/{implement,task-review,fix}.md` + `_handoff-write-fragment.md`); there is no standalone handoff mode. The orchestrator must not merge Standards/Spec prose on its own.

---

H6-H8 (CLI dispatch / opt-in / harness registry / gate matrix) → [`docs/cdd-reference.md`](cdd-reference.md).
