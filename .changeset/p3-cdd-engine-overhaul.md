---
"@oscaner-skills/cdd-engine": major
"@oscaner-skills/osuperpowers": minor
---

feat(cdd-engine): P3 overhaul — single cdd bin + URC review contract + harness operation×type injection

- **Single CLI (`bin/cdd.mjs`)**: the five legacy bins (cdd-task / docs-task / branch-review / cdd-select / cdd-research) are deleted — implement/review×{task,branch,spec,plan}/fix/select/research/brief/contract all route through one Commander entry.
- **Review templates data-driven**: six legacy review/fix templates collapse into `templates/review/` = `review.md` shared shell + `reviews.json` per-type config (task/branch/spec/plan) + `doc-fix.md`; `templates/task/` = `implement.md` + `fix.md`.
- **Review Stopping (URC)**: single-cycle single-dispatch with always-fix-all; APPROVED/blocker=0 rejects re-dispatch of the same ref (exit 3, SP-4 keeps BLOCKED/TIMEOUT re-dispatchable). Per-type round sequences (`spec-N.json`, `task-N-task-review-N.json`, `branch-review-<b>..<h>-rN.json`) via `resolveNextRound`.
- **Harness operation×type injection**: `harness-registry.json` `prefix`/`suffix` resolved by `(op, type)` — implement/fix → `/mattpocock-skills:tdd`, review task/branch → `/mattpocock-skills:code-review`, spec/plan → shared review.md (no skill injection).
- **Handoff schema**: optional `notes` field accepted (Enh T); `markDeferred`/deferred orphan residue removed (Enh S).
- **Rules SSoT**: skill review rule consolidated in `packages/osuperpowers/skills/_docs/review.md` (replaces docs-review.md); D1/D2/D3/PASS=< obsolete vocabulary purged.
- `cdd contract --check-dirty/--check-head/--clear-findings`; dry-run via `CDD_DRY_RUN=1`.

osuperpowers: `_docs/review.md` URC rewrite (node-anchored, lens-tagged single dispatch) consumed by brainstorming/writing-plans review nodes.