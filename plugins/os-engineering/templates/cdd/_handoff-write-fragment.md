## Handoff write

Write/update handoff per [`docs/handoff-schema.md`](../../docs/handoff-schema.md) from file paths only（per [`docs/controller-handoff.md`](../../docs/controller-handoff.md) H1–H2 file-only discipline）。

> Template variables: included inline into enclosing templates which define `{{HANDOFF}}`, `{{WORKSPACE}}`, `{{TASK}}` via `_cdd_template_value`.

### Segment: implement

1. Read `{{WORKSPACE}}/task-{{TASK}}-test-evidence.json` (omit `behavior_change` in handoff).
2. Gate: Complex/`behavior_change:true` → hard (require command/passed/exit_code); Simple → soft (WARN).
3. Set `status: DONE` on success; blocker finding → `status: BLOCKED`.

### Segment: review

1. Read handoff.json + axis reports (`task-N-review-standards.md`, `task-N-review-spec.md`).
2. Parse `## Findings (D3)` JSON block from each axis → **merge** into prior handoff `findings[]`
   (keep `deferred: true` items; never replace wholesale).
3. **Mark every `warn`/`nit` finding `deferred: true`** — unconditionally, whether or not
   the round also contains a `blocker` (D1: mixing must not re-enter deferred items in the fix loop).
4. Scan for "cannot verify"/"unverifiable" → `unverifiable[]`; non-empty → BLOCKED.
5. Plan/brief violations → `plan_conflicts[]` (orchestrator STOPs).
6. Set status by severity: any `blocker` → `CHANGES_REQUESTED`; otherwise → `APPROVED`.
7. On CHANGES_REQUESTED: write open-findings JSON (non-deferred = blocker findings only) beside handoff.

### Segment: fix

1. Read handoff.json + open-findings.json.
2. Resolve non-deferred findings per fix outcome (remove fixed / update remaining).
3. **Preserve all `deferred: true` findings** from prior handoff `findings[]` — deferred
   items never enter the fix loop and never drop across rounds (D5a).
4. Update findings; set status per fix outcome (re-review decides final APPROVED/CHANGES_REQUESTED).

### Self-validate

Before H1: `jq . {{HANDOFF}}` → check status/commits.base/commits.head non-null. Fail → `status: BLOCKED`.

### Atomicity

Implement+handoff in one process. Handoff write fails → H1 `status: BLOCKED`. Retry → full mode re-run (idempotent).
