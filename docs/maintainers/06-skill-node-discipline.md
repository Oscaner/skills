# Skill Node Discipline — Facts Only, No Restatement

Maintainer-only guidance for authoring the kairos orchestrator SKILL.md files (`packages/kairos/skills/*/SKILL.md`); not shipped to consumers.

## The principle

Every Node Definition (Do / Read / Exit / Fail) states only the facts **this node owns**. A node never restates a fact a single declaration already carries:

- **target skill's role** → the target's own `description` (a handoff/import node names the target, never re-describes it)
- **Review Convergence** — the `next:` dispatch-ready literal, dispatch-as-written, no kind→command mapping; fixes go via the fix round, never inline edits
- **"approved = commit immediately"** → the Invariants commit-discipline row
- **background execution**, **review unskippable**, **fix commit moves the ref → new ref is a new review** → the Invariants rows (cdd-dev)
- **clean-tree-before-review** (dirty → BLOCKED) → the Invocation discipline's Round-rhythm line (once per skill)
- **upstream import mechanics** ("flow consumed inline", "one import per session", "not a session spawn") → none — "Import X (pi：/skill:X)" alone is unambiguous; the mechanics sentence is deleted, never moved
- **cross-node failure behavior** (hard-error face, BLOCKED reasons, crash records) → the skill's own `## Failure Modes` table (node Fail = local only)

## Checklist

Keep a sentence in a node only if it names behavior THIS node performs **and** it is not the echo of an Invariant, a Failure Modes row, the Invocation discipline, or the target skill's description. Sentences opening "per I1/I2…", "Review Convergence …", "as the … channel owns…" are misplaced — promote the fact once, delete the node copy.

The four surfaces (Flow Digraph → Node Definitions → Invariants → Failure Modes) are the whole body of an orchestrator skill; each fact lives in exactly one.