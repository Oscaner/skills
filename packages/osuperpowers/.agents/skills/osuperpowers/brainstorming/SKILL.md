---
name: brainstorming
description: Independent brainstorm orchestrator -- Node-anchored flow with digraph as single control-flow source of truth. Reads upstream superpowers:brainstorming as baseline, layers personal rules (grilling / overall-phase routing / spec-review / commit discipline). Callable standalone; triggered by /brainstorming via overrides router.
---

# Osuperpowers Brainstorming

Full brainstorm flow orchestration, callable standalone.

## Flow Digraph

```mermaid
flowchart TD
  A[read-upstream] -->|loaded| B[read-sub-skills]
  A -->|missing| Z1((BLOCKED: install superpowers))
  B -->|loaded| C{read-program}
  B -->|missing| Z2((BLOCKED: install mattpocock-skills))
  C -->|mode resolved| D[explore-context]
  C -->|unparseable| Z4((BLOCKED: overall-parse-failed))
  D --> E{claim-phase}
  E -->|phase in overall Phase inventory| F{grilling-mode?}
  E -->|phase NOT in inventory (phase-within-program)| S[sync-overall]
  E -->|new-program mode| F
  S -->|four tables consistent| D
  S -->|inconsistent| Z3((BLOCKED: overall-sync-failed))
  E -->|inventory unparseable| Z3
  F -->|mid-grill split / new scope| E
  F -->|phase-within-program| G[propose-approaches]
  F -->|new-program| G2[propose-phase-approaches]
  G --> H[present-design]
  H -->|revise section| H
  H --> I{user-approves?}
  I -->|revise| H
  I -->|yes| J[write-spec]
  G2 --> H2{charter-approves?}
  H2 -->|revise| H2
  H2 -->|yes| J
  J --> K{spec-review}
  K -->|blocker found| K
  K -->|blocker=0| L{user-ok?}
  K -->|pass1 clean (D1 zero findings, skip D2/D3)| L
  L -->|fix selected (after blocker=0, no re-review per Review Stopping)| Q{user-confirm-commit?}
  L -->|approved| Q
  Q -->|confirmed| M[commit-spec]
  M --> N{overall-spec?}
  N -->|yes: next phase| O((HANDOFF: brainstorming))
  N -->|no: single spec| P((HANDOFF: writing-plans))
```

## Node Definitions

### `read-upstream`

- **Do**: Read upstream `superpowers:brainstorming` SKILL.md as the process baseline. **Read, not Skill-invoke** (Skill-invoke triggers router interception — I1). Resolution: ① harness plugin system locates the sibling `superpowers` plugin's SKILL.md; ② fallback to vendored path in the same repo. The baseline is the SKILL.md file only — harness-injected docs (CLAUDE.md, README, vendor contributor guides) are not the baseline
- **Read**: Upstream `superpowers:brainstorming` SKILL.md file
- **Exit**: File exists and readable → `read-sub-skills`; missing → BLOCKED (install superpowers plugin)
- **Fail**: Skill-invoke upstream → violates I1

### `read-sub-skills`

- **Do**: Read `mattpocock-skills` grilling SKILL.md, loading its framework as the grilling stage execution basis. Resolution: ① harness plugin system locates the sibling `mattpocock-skills` plugin; ② fallback to vendored path in the same repo
- **Read**: Grilling SKILL.md file
- **Exit**: Loaded → `read-program`; missing → BLOCKED (install mattpocock-skills)
- **Fail**: Load failure → BLOCKED with install guidance for mattpocock-skills plugin

### `read-program`

- **Do**: Detect whether a parent overall spec exists (convention path `docs/superpowers/specs/*-overall.md`; the user may supply the parent overall path explicitly in this node — input channel: a conversation message giving an absolute/relative path, which must match `docs/superpowers/specs/*-overall.md`). Note: `osuperpowers:brainstorming` is invoked by the harness via SKILL.md, not a CLI entry, so the parent overall path is obtained only via the conversation channel (no `--parent-overall` CLI param, to avoid conflicting with the brainstorming invocation model). If multiple matching overall files exist (glob hit >1) → terminal `BLOCKED: overall-parse-failed` (prompt the user to specify the unique parent path). Resolve to a mode: `new-program` (no parent overall) or `phase-within-program` (has a parent overall; this is a per-phase brainstorm).
- **Read**: `docs/superpowers/specs/*-overall.md` (if present) + optional user-supplied parent overall path (must match the format above).
- **Exit**: mode resolved → `explore-context` (carrying the mode marker).
- **Fail**: parent overall file exists but is unparseable / multiple matches cannot be disambiguated → terminal `BLOCKED: overall-parse-failed` (block with explicit prompt to specify the unique parent; never silently downgrade to new-program).

### `explore-context`

- **Do**: Carry the mode marker resolved by `read-program` (`new-program` / `phase-within-program`). Explore project context in that mode (files / docs / git log / existing research findings); from this, judge whether the current request needs a new phase or a phase split. Optional research still triggers only via the Confirm Gate (I2).
- **Read**: project files, docs, git log, research findings; parent overall (phase-within-program mode).
- **Exit**: exploration complete → `claim-phase` (carrying the mode marker). Note: `explore-context`'s "needs new phase?" judgment is only a suggestive probe; `claim-phase`'s Phase inventory lookup is the sole authoritative decision (on conflict, claim-phase wins).
- **Fail**: Research agent error/timeout → log stderr, fail-open (do not block flow). CLI path failure → fall back to Agent tool path.

### `claim-phase`

- **Do**: Based on `read-program`'s mode marker + the phase identifier in the user request (e.g. `/brainstorming P14`), judge whether that phase already exists in the parent overall's **Phase inventory** (the four-table sync procedure is in [add-phase-protocol.md](./docs/add-phase-protocol.md)):
  - `new-program` mode → straight to `grilling` (program-level design ultimately reaches `overall-spec?`).
  - `phase-within-program` mode + phase **already in** Phase inventory → `grilling` (normal path).
  - `phase-within-program` mode + phase **not in** Phase inventory (new phase / split) → `sync-overall`.
- **Read**: parent overall's Phase inventory table.
- **Exit**: in inventory / new-program → `grilling-mode?`; not in → `sync-overall`.
- **Fail**: Phase inventory table missing or unparseable → terminal `BLOCKED: overall-sync-failed` (same terminal as sync-overall, consistent semantics).

### `sync-overall`

- **Do**: Read the parent overall → perform the four-table sync (procedure + checklist in [add-phase-protocol.md](./docs/add-phase-protocol.md)):
  ① **Issue inventory** — append a new issue row (`#NNN` + owning phase; if this only splits an existing issue, fill the phase-ownership column);
  ② **Phase inventory** — append a new phase row (scope / design spec / plan / acceptance / dependency);
  ③ **Dependency graph** — add hard/soft edges (the new phase's dependency on predecessors + successors' dependency on the new phase);
  ④ **version bump + change-history** entry (record the reason, user decision, scope boundary).
  Then run the **four-table consistency check**: any `#NNN` referenced by the phase spec/plan must be in Issue inventory; any phase referenced by the Dependency graph must be in Phase inventory; the hard-dependency predecessor of the new phase must have **Design spec column = `Done`** in the parent overall's Phase inventory (same authority column as I7 in §2.5; no longer judged by plan cell / git state).
- **Read**: full parent overall spec (the Design spec column of Phase inventory).
- **Exit**: four tables consistent → back to `explore-context` (re-evaluate scope with the now-registered phase) → through `claim-phase` (phase now exists) → `grilling-mode?`.
- **Fail**: four tables inconsistent (e.g. dependency phase not shipped, dangling reference) → terminal `BLOCKED: overall-sync-failed`; never allow grilling an unregistered phase.

### `grilling-mode?`

- **Do**: Follow grilling SKILL.md framework verbatim — ask one question at a time, wait for each answer before continuing. Code-searchable facts: look up yourself. Decision questions: ask the user. Before grilling, confirm `claim-phase` has released this phase (structural guarantee — state explicitly in the Do field).
- **Read**: Grilling SKILL.md framework (loaded in `read-sub-skills`)
- **Exit**: `phase-within-program` → `propose-approaches`; `new-program` → `propose-phase-approaches`
- **Fail**: Substituting option menus or structured choice lists for grilling framework → violates invariant. Mid-grill detects a phase split / new scope → route back to `claim-phase` (pairs with I6).

### `propose-approaches`

- **Do**: Propose 2-3 approaches with trade-offs and recommendation. YAGNI ruthlessly
- **Read**: Decisions from grilling + research findings (if any)
- **Exit**: Approaches presented → `present-design`
- **Fail**: —

### `propose-phase-approaches`

- **Do**: Based on scope-level grilling output, present each phase's scope, dependencies, and acceptance criteria. User confirms the phase decomposition is correct.
- **Read**: scope-level grilling decisions + parent overall (if exists)
- **Exit**: Phase decomposition confirmed → `charter-approves?`
- **Fail**: —

### `charter-approves?`

- **Do**: User approves the charter decomposition.
- **Read**: charter decomposition from `propose-phase-approaches` + parent overall (if exists)
- **Exit**: Approved → `write-spec`; revise → `propose-phase-approaches`
- **Fail**: —

### `present-design`

- **Do**: Present design section by section, getting user confirmation per section before proceeding. Section complexity determines length
- **Read**: Chosen approach + all grilling decisions
- **Exit**: All sections confirmed → `user-approves?`; user requests revision → revise and re-present that section
- **Fail**: —

### `user-approves?`

- **Do**: Determine user's approval status for the overall design
- **Exit**: Approved → `write-spec`; revise → back to `present-design`
- **Fail**: —

### `write-spec`

- **Do**: Write design to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`. Overall spec: use [overall-spec-template.md](./docs/overall-spec-template.md). Phase spec: use [phase-spec-template.md](./docs/phase-spec-template.md)
- **Read**: All design decisions
- **Exit**: File written → `spec-review`
- **Fail**: —

### `spec-review?`

- **Do**: Execute 3-pass spec review (completeness / consistency&scope / clarity&YAGNI), each pass dispatches an independent `cdd-review` CLI call: `node {pluginRoot}/bin/engine/cdd-review.mjs --harness <name> --template spec-review --param PASS=<pass-type> --param DOC=<path>`. Follow D1/D2/D3 from [docs-review.md](../_docs/docs-review.md). Review Stopping (see I5): ① run 3-pass → ② blocker found → fix → re-run only that pass → loop until blocker=0 → ③ all passes blocker=0 → present warn/nit to user → proceed. Pass 1 zero findings (D1) → skip subsequent passes → `commit-spec`. Only Pass 2 is delta-scoped; Pass 3 is always full-doc
- **Read**: Spec document + [docs-review.md](../_docs/docs-review.md)
- **Exit**: blocker=0 → `user-ok?` (present warn/nit); Pass 1 clean (D1) → skip to `user-confirm-commit?` (still via `user-ok?` → `user-confirm-commit?`)
- **Fail**: Re-run review after blocker=0 → violates I5 (Review Stopping). New cdd-review call for warn/nit → violates I5.

### `user-ok?`

- **Do**: Present warn/nit list from spec-review output. User options: ① Proceed to commit ② Fix selected warns/nits. Re-run is never offered after blocker=0
- **Read**: warn/nit findings from spec-review output (read from already-captured output; no new cdd-review call)
- **Exit**: Proceed → `user-confirm-commit?` → `commit-spec`; fix selected → fix then → `user-confirm-commit?` → `commit-spec` (no review re-run)
- **Fail**: Re-run review → violates I5

### `commit-spec`

- **Do**: Commit spec document to git. Spec approved = commit immediately (I4); do not wait for dev merge.

  **Pre-commit overall spec 4-table sync check** (only when this phase is a sub-phase of an overall program; single-spec projects skip this check):
  - Issue inventory: all `#NNN` issue numbers mentioned in this phase's spec or plan are registered in the overall Issue inventory (added or updated)
  - Phase inventory: this phase row's scope / design spec / plan / acceptance criteria / dependency fields are updated to latest state
  - Dependency graph: if this phase adds or removes dependency relationships, the ASCII graph is synced
  - Change history: this phase's change has been appended as one row (including version + date + summary)

  Any table not synced → spec commit violation, **must not commit**, must sync first
- **Read**: Spec file path
- **Exit**: Commit complete → `overall-spec?`
- **Fail**: Git error → report + fail-open (do not block user spec review)

### `user-confirm-commit?`

- **Do**: At the spec closeout point, explicitly request commit confirmation from the user (CLAUDE.md forbids auto-commit, so a `user-confirm-commit?` gate is required before `commit-spec`).
- **Read**: none (pure confirmation).
- **Exit**: user confirms → `commit-spec`; user declines → hold (no commit; spec retained for later).
- **Fail**: — (confirmation gate has no failure branch)

### `overall-spec?`

- **Do**: Determine whether current spec is an overall spec (multi-phase) or a single phase spec
- **Exit**: Overall spec → HANDOFF: brainstorming (next phase's full brainstorm→plan→dev cycle); single phase spec → HANDOFF: writing-plans
- **Fail**: Overall approved then directly entering writing-plans (skipping phase-level brainstorming) → violates overall spec boundary rule

## Invariants

| # | Invariant |
|---|---|
| I1 | **Read, not Skill-invoke** — upstream skill files are Read only, never Skill-invoked (triggers router interception) |
| I2 | **Research requires user confirmation** — spawn research agents only after explicit user confirmation; never auto-trigger |
| I3 | **Design first** — no implementation actions until design is user-approved |
| I4 | **Spec commit discipline** — spec approved = commit immediately; do not wait for dev merge |
| I5 | **Review Stopping** — re-run driven only by blockers; no re-run after all passes are blocker=0; no new cdd-review call to obtain warn/nit (read from already-captured output of the current review cycle). |
| I6 | **Register-before-grill** (scope: `phase-within-program` mode) — grilling runs only for phases already present in the overall Phase inventory. `new-program` mode passes through the `claim-phase` node but **skips the inventory check** to reach grilling directly (digraph `E -->|new-program mode| F`). In `phase-within-program` mode, if mid-grill a phase split / new issue emerges → route back to `claim-phase` → `sync-overall`; never grill unregistered scope. |
| I7 | **Serial-phase** — when `sync-overall` registers a new phase, verify its hard-dependency predecessor has **Design spec column = `Done`** in the overall Phase inventory; if not shipped (Design spec ≠ `Done`) → hard `BLOCKED: overall-sync-failed` (same terminal as §2.3; never release grilling for an unmet phase — this is exactly the v1.19c anti-pattern to block). |

## Failure Modes

| failure | behavior | reason |
|---|---|---|
| Upstream superpowers:brainstorming SKILL.md missing | BLOCKED (with install superpowers plugin guidance) | Block policy: no silent fallback |
| Grilling SKILL.md missing | BLOCKED (with install mattpocock-skills guidance) | Block policy: sub-skill missing = no degradation |
| Research agent error/timeout | fail-open (log stderr, do not block flow) | Research is optional enhancement |
| Git commit error | report + fail-open | Do not block user spec review |
| CLI path failure | fall back to Agent tool path | CLI unavailable but default path works |
| Parent overall spec unparseable / multiple matches | BLOCKED (overall-parse-failed) | mode resolution cannot proceed | prompt user to specify the unique parent overall path |
| Phase inventory missing or unparseable | BLOCKED (overall-sync-failed) | claim-phase / sync-overall cannot gate | user supplies or fixes the overall Phase inventory |
| Four-table sync inconsistent (dependency not shipped / dangling ref) | BLOCKED (overall-sync-failed) | refuse to grill an unregistered / unmet-dependency phase | fix the overall four tables, then re-run sync-overall |
| spec-review re-run after blocker=0 | Violates I5 (Review Stopping) — stop + report to user | Agent re-runs review after all passes are blocker=0 |
