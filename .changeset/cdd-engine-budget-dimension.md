---
"@oscaner-skills/cdd-engine": patch
---

fix: budget-dimension unification — `timeouts.defaults` keyed by dispatch op (implement 6h / review 3h / fix 6h), the legacy `task` budget key deleted, and the three dispatch islands wire their ACTUAL op into the termination budget.

- **Op-dimensional budget config** — `engine-config.json#contextContract.timeouts.defaults` moves from `{task, review}` to `{implement: 21600000, review: 10800000, fix: 21600000}` (fix shares the implement amount, user ruling 2026-09-30); the `task` key is deleted (the canonical is engine-self-maintained, zero consumer surface).
- **Wiring bugs fixed** — every dispatch island now resolves its termination budget by its ACTUAL op: the task island passes its dispatched mode (a `cdd review --type task` round previously read the IMPLEMENT budget through the hardcoded `"task"` key — the accident where an overrunning task review was never capped by the review budget), the docs island passes its mode (docs fix previously read the review budget), and branch-fix passes `"fix"` (previously read the review budget). branch-review keeps `"review"` — its op semantically IS review.
- **Typed budget surface** — `DispatchOp` (`"implement" | "review" | "fix"`) + `DEFAULT_TIMEOUTS: Record<DispatchOp, number | undefined>`; a non-op budget key fails at compile time, and the unknown→undefined fail-safe is preserved for a canonical missing a key.
- **Wiring-layer tests** — seven op-combo assertions (task.implement / task.review / task.fix / branch.review / branch.fix / docs.review / docs.fix) confirm the spawn received `terminationCfg.budgetMs` = the dispatched op's canonical default at the invokeCli / invokeCliWithRetry seam (the regression gate: the prior wiring bugs escaped because the wiring layer had no tests).