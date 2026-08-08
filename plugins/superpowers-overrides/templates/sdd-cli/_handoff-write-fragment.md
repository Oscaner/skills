## Handoff write

Write/update handoff per `templates/sdd-handoff-schema.md` from file paths only (per `spor-token-efficient-controller-handoff` H1–H2 file-only discipline).

> Template variables: included inline into enclosing templates which define `{{HANDOFF}}`, `{{WORKSPACE}}`, `{{TASK}}` via `_sdd_template_value`.

### Segment: implement

1. Read `{{WORKSPACE}}/task-{{TASK}}-test-evidence.json` (omit `behavior_change` in handoff).
2. Gate: Complex/`behavior_change:true` → hard (require command/passed/exit_code); Simple → soft (WARN).
3. Set `status: DONE` on success; blocker finding → `status: BLOCKED`.

### Segment: review

1. Read handoff.json + axis reports (`task-N-review-standards.md`, `task-N-review-spec.md`).
2. Parse `## Findings (D3)` JSON block from each axis → merge into `findings[]`.
3. Scan for "cannot verify"/"unverifiable" → `unverifiable[]`; non-empty → BLOCKED.
4. Plan/brief violations → `plan_conflicts[]` (orchestrator STOPs).
5. Empty findings → `status: APPROVED`; otherwise → `status: CHANGES_REQUESTED`.
6. On CHANGES_REQUESTED: write open-findings JSON beside handoff.

### Segment: fix

1. Read handoff.json + open-findings.json.
2. Update findings per resolved issues; set status per fix outcome.

### Self-validate

Before H1: `jq . {{HANDOFF}}` → check status/commits.base/commits.head non-null. Fail → `status: BLOCKED`.

### Atomicity

Implement+handoff in one process. Handoff write fails → H1 `status: BLOCKED`. Retry → full mode re-run (idempotent).
