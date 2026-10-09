---
"@oscaner-skills/kairos": patch
---

All kairos orchestrator SKILL.md node definitions now state facts only — no restatement. Every node Do/Read/Exit/Fail keeps only the facts it owns: the upstream-import mechanics ("flow consumed inline / one import per session / not a session spawn"), the target-role re-descriptions in handoff/import nodes, and the node copies of Invariant / Failure-Modes / Invocation-discipline facts (Review Convergence literals, commit-immediacy, background execution, unskippable review, moved-ref-new-review, clean-tree gate, hard-error face) are deleted — each fact lives in exactly one of the four skill surfaces (digraph · node definitions · invariants · failure modes). The discipline is recorded for maintainers in `docs/maintainers/06-skill-node-discipline.md` (the maintainers family gains its sixth content doc; the ≤ 56,000 byte anchor and its ledger are updated).
