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
  J --> K{spec-review?}
  K -->|blocker=0| FIX[cli-fix-all-findings]
  K -->|blocker found| FIX
  FIX -->|blocker=0| Q{user-confirm-commit?}
  FIX -->|blocker>0| K
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
  - `new-program` mode → straight to `grilling-mode?` (program-level design ultimately reaches `overall-spec?`).
  - `phase-within-program` mode + phase **already in** Phase inventory → `grilling-mode?` (normal path).
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

- **Do**: Branch grilling behavior based on `read-program` mode. Upstream grilling SKILL.md baseline unchanged (Read, not Skill-invoke — I1).

  - **`phase-within-program`** → implementation grilling: root-cause analysis → impact boundary → fix direction → technical approach. One issue per grilling session.
  - **`new-program`** → scope-level grilling: each candidate phase's scope definition, dependencies, acceptance criteria, issue ownership. All phases in one session.

  **Shared discipline** (upstream baseline + self-check):
  - One question at a time, wait for answer before continuing
  - Each question includes a recommended answer
  - Before each question, self-check: ① One question only? ② Recommended answer included? ③ Root cause explored (phase-within-program only)? → If any fails → re-do the question correctly.

- **Read**: Grilling SKILL.md framework (loaded in `read-sub-skills`) + mode marker (from `read-program`)
- **Exit**: `phase-within-program` → `propose-approaches`; `new-program` → `propose-phase-approaches`
- **Fail**: Self-check fails 2 consecutive times → BLOCKED (grilling discipline broken); mid-grill detects phase split / new scope → route back to `claim-phase`

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

- **Do**: Determine write granularity based on mode:
  - **`new-program`** → charter-only: scope decomposition + issue inventory + phase inventory + dependency graph + acceptance criteria. **No phase-level implementation details.** Use overall-spec-template.md (contains "Charter only — no implementation detail" GATE)
  - **`phase-within-program`** → phase-level detailed design (including grilling outputs: root cause / fix direction / technical decisions). Use phase-spec-template.md

- **Read**: mode marker + all design decisions + template (path: `packages/osuperpowers/skills/brainstorming/docs/`)
- **Exit**: File written → `spec-review?`
- **Fail**: Template missing/unreadable → BLOCKED (missing template)

### `spec-review?`

- **Do**: Execute 3-pass spec review (completeness / consistency&scope / clarity&YAGNI). Each pass **must** dispatch `node {pluginRoot}/bin/engine/docs-task.mjs --harness <name> --mode review --template spec-review --doc <path>`. **Self-review, manual checks, or any other substitute for docs-task CLI invocation is forbidden.** Follow D2/D3 from `_docs/docs-review.md` (D1 skip-on-clean does not apply — all 3 passes are mandatory). Review Stopping (I5): follow [Review Stopping](../_docs/docs-review.md#rule-review-stopping) in docs-review.md — blocker>0: cli-fix-all-findings → re-run; blocker=0: cli-fix-all-findings → done. No re-run after blocker=0.
- **Read**: Spec document + `_docs/docs-review.md`
- **Exit**: blocker=0 → `cli-fix-all-findings` → `user-confirm-commit?`
- **Fail**: Re-run review after blocker=0 → violates I5 (Review Stopping).

### `cli-fix-all-findings`

- **Do**: Apply all findings from the captured docs-task review output to the spec document. No new review invocation — work from findings already captured in the current review cycle. When routed from blocker>0: fix blockers, then route back to `spec-review?`. When routed from blocker=0: fix warns/nits (optional), then proceed to `user-confirm-commit?`.
- **Read**: captured docs-task review output (findings from current review cycle)
- **Exit**: blocker>0 path → `spec-review?`; blocker=0 path → `user-confirm-commit?`
- **Fail**: Invoke new docs-task call instead of reading from captured review output → violates I5 (Review Stopping).

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
| I5 | **Review Stopping** — see [Review Stopping](../_docs/docs-review.md#rule-review-stopping) in docs-review.md; never re-run after blocker=0; fixing without re-running docs-task does not satisfy blocker=0 |
| I6 | **Register-before-grill** (scope: `phase-within-program` mode) — grilling runs only for phases already present in the overall Phase inventory. `new-program` mode passes through the `claim-phase` node but **skips the inventory check** to reach grilling directly (digraph `E -->|new-program mode| F`). In `phase-within-program` mode, if mid-grill a phase split / new issue emerges → route back to `claim-phase` → `sync-overall`; never grill unregistered scope. |
| I7 | **Serial-phase** — when `sync-overall` registers a new phase, verify its hard-dependency predecessor has **Design spec column = `Done`** in the overall Phase inventory; if not shipped (Design spec ≠ `Done`) → hard `BLOCKED: overall-sync-failed` (same terminal as §2.3; never release grilling for an unmet phase — this is exactly the v1.19c anti-pattern to block). |
| I8 | **Mode-aware flow** — `grilling-mode?` node branches behavior based on `read-program` mode: `new-program` → scope-level grilling → `propose-phase-approaches`; `phase-within-program` → implementation grilling → `propose-approaches`. `write-spec` node determines write granularity based on mode: `new-program` → charter-only (no implementation details); `phase-within-program` → phase-level detailed design. Mode marker is carried throughout the flow. |

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
| spec-review re-run after blocker=0 | Violates I5 (Review Stopping) — stop + report to user | Agent declares blocker=0 after fixing without re-running docs-task on that pass |
| Grilling self-check fails 2 consecutive times | BLOCKED (grilling discipline broken) | Self-check mechanism failed, user intervention required |
| spec-review does not invoke docs-task CLI | Violates spec-review Do — must re-execute | Review substitution anti-pattern |
| write-spec template missing/unreadable | BLOCKED (missing template) | Cannot determine write format |
