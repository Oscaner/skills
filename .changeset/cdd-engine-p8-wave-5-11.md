---
"@oscaner-skills/cdd-engine": minor
"@oscaner-skills/kairos": minor
---

P8 wave 5,11 — the `cdd board <slug>` command + the cdd-design hub ablation:

- **T5** — `cdd board <slug>` lands as the seventh CLI command (`CliVerb` six → seven, the
  `CLI_COMMANDS` board row, `#runBoard` + the wired action). `BoardView.render` produces the
  phase board (`overall/spec/plan/wave/branch` + one line per derived wave + the fixed legend
  `progress: ✔ done · ▶ current · ○ pending` + the `next:` line) and the program board
  (overall line + one `phase P<N>` summary line + `next: done`). The `next:` derivation
  consumes `PIPELINE_NEXT` (no second table): the first unexhausted face in line order
  (spec → plan → wave → branch), its entry rendered through the same `REFS[ref][host]` /
  literal-fill render the Capsule's `done` face uses; line exhaustion reuses the engine's
  single C5 closure judge. A present doc carrying no `- **Doc type**:` declaration renders
  `doc-type: missing (BLOCKED)` and the board exits 2 (spec §12 · D34 — no filename
  fallback). The command is a pure read: no preflight gate, zero tree/ledger writes, zero
  child dispatch; a missing slug or a no-match slug exits 2. The six-command structural pins
  re-anchor to seven rows.
- **T11** — cdd-design's dead `NEXT-LOOP` hub ablates (no producer — the engine next face has
  zero design routing): the node block + its three out-edges are removed, `run-cdd-spec-writer`
  hands `handoff-next` directly, and the family reclassifies `loop` → `onepass`. The
  design-scope hub machinery retires from the skill-anatomy contract (`SkillRosterRow.handoff`
  field, `loopHubNode.rowPrefixes`, `nextLoopConditions` / `edgeConditionWords` drop
  `until session closes`, the design clauses in `loopShapeRule`/`edgeConditionRule`,
  `registry.crossings["cdd-design"]`, the dead `terminalStates.handoff` row) and the checker
  (`#familyShapeFindings` prefix loop, `#edgeConditionFindings` designScope branch + closure-exit
  assertion).
