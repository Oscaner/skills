---
"superpowers-overrides": minor
---

SDD orchestrator gate shell/workspace consistency + stale-workspace hijack prevention (issue #53). Read-only git diagnostics (`git status`/`git diff`/`git log`/`git show`/`git rev-parse`/`git branch`/`git remote`/`git ls-files`/`git diff-tree`) now allowed during active tasks, hardened against compound commands and mutating sub-verbs; deny message upgraded to a full allowlist matrix. Stale workspace hijack prevented via `TASK_BASE` git-object check and bound-workspace priority. Gate test fixtures isolated under `tests/fixtures/sdd-gate/`, full allow/deny matrix smoke test added and mounted in CI.
