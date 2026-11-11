---
"@oscaner-skills/cdd-engine": minor
---

review-cycle soft cap `REVIEW_CYCLE_CAP` 50 → 80（session routing · user mandate 2026-11-11）:

- The soft cap is a budget, not a convergence rule. After `REVIEW_CYCLE_CAP` consecutive blocker review cycles the engine stops proposing the next hop and hands the decision to the user (`soft-cap`). Raising it only buys a longer autonomous marathon before the line interrupts the user; the severity-graded convergence table (any blocker → fix → re-review · warn/nit-only → `REVIEW_FIX` closure · zero findings → pass) is byte-identical.
- Pins re-anchored at both levels — the runtime `toBe` and the compile-time literal type in `session/__tests__/next.test.ts` — and the `next-loop` twin diagram sources (EN + zh-CN) now state 80 consecutive blocker cycles, so either side moving turns the pair red.
