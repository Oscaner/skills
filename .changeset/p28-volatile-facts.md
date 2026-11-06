---
"@oscaner-skills/cdd-engine": minor
"@oscaner-skills/kairos": minor
---

The spec review prompt and the two authoring skills now ask for a claim's **shape**, not a snapshot of today's tree. `render/templates.ts#docNarrativeAxes` carries the three-shape `Claimed→pin` clause — a pin cites the module path + symbol name (a line number is not a pin), a count is stated as pinned by the named guard or test, and a present-tense description of today's shape belongs to the plan while a design spec states the condition that must hold; the plan variant is byte-unchanged, because a plan's `path:line` is a delivery target. `cdd-spec-writer`'s `author-spec` node states the same three shapes in three lines and `cdd-plan`'s `author-plan` node keeps citations in the plan, so the citation line never migrates into a spec. No new gate: the writing moment is ungated, the review is where a violation surfaces.
