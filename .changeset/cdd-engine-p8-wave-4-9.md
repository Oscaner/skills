---
"@oscaner-skills/cdd-engine": minor
"@oscaner-skills/kairos": patch
---

P8 wave 4,9 — board progress projection + self-loop label correction with branch-node ablation:

- **T4** — `BoardView` gains the progress projection (`BoardProgress` / `BoardLine`): each node (overall + every on-disk phase) reads its OWN workspace `progress.json`; the `×N` cell counts the cycle-NUMBER array's elements (D28 identity — `[1,3]` → `×2`, the retired numeric form renders nothing); the wave segment derives one line per wave (the ✔/▶/○ markers ride the SAME `closedWaves()` read the pre-flight gate consumes, `TaskGraph.report` 同源). Pure reads — a missing plan leaves the wave segment empty, a missing overall leaves the doc facts null, never a throw.
- **T9** — the four loop-chain skills' self-loop label corrects from `until next=done` (the pre-D33 worldview, whose condition is never true post-D33) to `until next is terminal` (a skill ref / engine literal hands the orchestrator off); cdd-design's closure exit renames `next=done` → `until session closes` (the design continuation is not an engine next-face consumer); cdd-dev's `branch-review`/`branch-fix` nodes ablate (the branch line routes entirely through the engine's next face — the hub keeps two out-edges, the branch facts fold into the hub's Do + Failure Modes). The skill-anatomy contract's `nextLoopConditions` word table, `loopShapeRule`/`edgeConditionRule` text and the checker's label pins sync; the branch closed-loop assertion block and the two branch-specific contract rules retire.
