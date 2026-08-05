# Tickets: SDD orchestrator universal gate (p1-slim.2)

Cross-harness PreToolUse gate + spor-SDD compact checklist + CI dogfood smoke. Parent plan: [../plans/2026-08-05-sdd-slim-orchestrator-p1-slim-2.md](../plans/2026-08-05-sdd-slim-orchestrator-p1-slim-2.md). Spec: [../specs/2026-08-05-sdd-slim-orchestrator-p1-slim-2-design.md](../specs/2026-08-05-sdd-slim-orchestrator-p1-slim-2-design.md).

Work the **frontier**: any ticket whose blockers are all done.

## T1 — SDD gate core + adapters + unit tests

**What to build:** Shared `sdd-orchestrator-gate.sh` state machine (ORCHESTRATING/TASK_ACTIVE/lazy bind/TTL clear), session activate, Cursor/Claude adapters, expansion hook, unit tests for AC#3/#4/#5 + fail-open.

**Blocked by:** None — can start immediately.

**Plan tasks covered:** Task 1

**Demo:** `override-cursor-sdd-gate.test.sh` + `override-claude-sdd-gate.test.sh` both OK.

- [ ] Gate lib single-sourced; adapters ≤50 lines each
- [ ] ORCHESTRATING: plugins Write deny; git rev-parse allow
- [ ] TASK_ACTIVE: H6 Bash allow; rm Bash deny
- [ ] Deny message includes correct `sdd-run-task-<harness>.sh`
- [ ] Commit: `feat: add cross-harness SDD orchestrator gate core`

## T2 — Hook generators + dual preToolUse

**What to build:** Extend render-cursor-hooks + render-claude-hooks; regenerate hooks; validate-overrides dual preToolUse assert; SDD slash detect on Cursor includes all spec patterns.

**Blocked by:** T1

**Plan tasks covered:** Task 2

**Demo:** `pnpm run generate:overrides && tests/validate-overrides-build.sh` green.

- [ ] `hooks-cursor.json` has 2 preToolUse entries
- [ ] `hooks/hooks.json` has PreToolUse Write|Edit + Bash
- [ ] Cursor detect activates pending on SDD slash
- [ ] Commit: `feat: wire SDD gate into Cursor and Claude hook generators`

## T3 — spor-SDD checklist restore

**What to build:** Rule 0a item 4 compact checklist; trims; 3 Red Flags; Rule 5a hook line; ≤160 lines.

**Blocked by:** None — can parallel with T2 after T1 lands (no file conflict with T2)

**Plan tasks covered:** Task 3

**Demo:** `wc -l` ≤ 160; Rule 0a has 4 numbered items.

- [ ] Item 4 matches spec verbatim
- [ ] p1-slim.1 «3 items» AC superseded
- [ ] Commit: `feat: restore spor-SDD compact orchestrator checklist (p1-slim.2)`

## T4 — CI smoke, synthetic plan, docs, inventory

**What to build:** sdd-cli-dry-run-smoke; synthetic dogfood plan; cross-harness-overrides section; ci-validate wiring; overall p1-slim.2 row; full validate green.

**Blocked by:** T1, T2

**Plan tasks covered:** Task 4

**Demo:** `CI=true pnpm run validate` exit 0.

- [ ] Three new tests wired in ci-validate.sh
- [ ] Synthetic plan exists; §Smoke table Pending for manual E2E
- [ ] No CURSOR-SMOKE.md edits
- [ ] Commit: `docs: add p1-slim.2 CI smoke, synthetic plan, and inventory`
