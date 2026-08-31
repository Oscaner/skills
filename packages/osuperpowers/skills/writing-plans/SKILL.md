---
name: writing-plans
description: Independent plan-writing orchestrator -- Node-anchored flow with digraph as single control-flow source of truth. Reads upstream superpowers:writing-plans as baseline, layers personal rules (section-by-section writing / plan-review / commit discipline). Callable standalone; triggered by /writing-plans via overrides router.
---

# Osuperpowers Writing-Plans

Full plan-writing flow orchestration, callable standalone.

## Flow Digraph

```mermaid
flowchart TD
  A[read-upstream] -->|loaded| B[write-plan]
  A -->|missing| Z((BLOCKED: install superpowers))
  B --> C[plan-review]
  C -->|blocker found| C
  C -->|blocker=0| D{user-ok?}
  C -->|pass1 clean| E
  D -->|fix selected| E
  D -->|approved| E[commit-plan]
  E --> F((HANDOFF: cli-driven-development))
```

## Node Definitions

### `read-upstream`

- **Do**: Read upstream `superpowers:writing-plans` SKILL.md as the process baseline. **Read, not Skill-invoke** (Skill-invoke triggers router interception — I1). Resolution: ① harness plugin system locates the sibling `superpowers` plugin's SKILL.md; ② fallback to vendored path in the same repo. The baseline is the SKILL.md file only — harness-injected docs (CLAUDE.md, README, vendor contributor guides) are not the baseline
- **Read**: Upstream `superpowers:writing-plans` SKILL.md file
- **Exit**: File exists and readable → `write-plan`; missing → BLOCKED (install superpowers plugin)
- **Fail**: Skill-invoke upstream → violates I1

### `write-plan`

- **Do**: Write plan section by section to `docs/superpowers/plans/YYYY-MM-DD-<feature>.md`. Each section uses one tool call (Section-by-Section — I2). Before writing, perform scope-check (if spec covers multiple subsystems, suggest splitting into separate plans). After all sections are written, present the complete plan to the user in one message. Includes self-review (spec coverage check + placeholder scan + type consistency) — issues found during self-review are fixed inline, not looped or passed to plan-review
- **Read**: Approved spec document + upstream plan template structure
- **Exit**: Plan written + self-review passed → `plan-review`
- **Fail**: Bulk writing in one call → violates I2

### `plan-review`

- **Do**: Execute 3-pass plan-review (completeness & spec alignment / task decomposition / buildability & type consistency), each pass dispatches an independent `cdd-review` CLI call: `node {pluginRoot}/bin/engine/cdd-review.mjs --harness <name> --template plan-review --param PASS=<pass-type> --param DOC=<path> --param SPEC=<spec-path>`. Follow D1/D2/D3 from [docs-review.md](../_docs/docs-review.md). Review Stopping: ① run 3-pass → ② blocker found → fix → re-run only that pass → loop until blocker=0 → ③ all passes blocker=0 → present warn/nit to user → proceed. Pass 1 zero findings (D1) → skip subsequent passes → `commit-plan`. Only Pass 2 is delta-scoped; Pass 3 is always full-doc
- **Read**: Plan document + spec document + [docs-review.md](../_docs/docs-review.md)
- **Exit**: blocker=0 → `user-ok?` (present warn/nit); Pass 1 clean (D1) → skip to `commit-plan`
- **Fail**: Re-run review after blocker=0 → violates I4. New cdd-review call for warn/nit → violates I4

### `user-ok?`

- **Do**: Present warn/nit list from plan-review output. User options: ① Proceed to Execution Handoff ② Fix selected warns/nits. Re-run is never offered after blocker=0
- **Read**: warn/nit findings from plan-review output (read from already-captured output; no new cdd-review call)
- **Exit**: Proceed → `commit-plan`; fix selected → apply fixes (intermediate step, not modeled as separate node) → `commit-plan` (no review re-run)
- **Fail**: Re-run review → violates I4

### `commit-plan`

- **Do**: Commit plan document to git. Plan approved = commit immediately (I3); do not wait for dev merge
- **Read**: Plan file path
- **Exit**: Commit complete → HANDOFF: cli-driven-development
- **Fail**: Git error → report + fail-open (do not block user plan review)

## Invariants

| # | Invariant |
|---|---|
| I1 | **Read, not Skill-invoke** — upstream skill files are Read only, never Skill-invoked (triggers router interception) |
| I2 | **Section-by-Section** — plan written section by section, one tool call per section; writing granularity decoupled from confirmation timing |
| I3 | **Plan commit discipline** — plan approved = commit immediately; do not wait for dev merge |
| I4 | **Review Stopping** — re-run driven only by blockers; no re-run after blocker=0; no new cdd-review call to obtain warn/nit |

## Failure Modes

| failure | behavior | reason |
|---|---|---|
| Upstream superpowers:writing-plans SKILL.md missing | BLOCKED (with install superpowers plugin guidance) | Block policy: no silent fallback |
| Git commit error | report + fail-open | Do not block user plan review |
