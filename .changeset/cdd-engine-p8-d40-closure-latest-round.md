---
"@oscaner-skills/cdd-engine": patch
---

**P8 §18 闭合计法根修（D40 前置 · 用户裁定 2026-10-15）** — 引擎的闭合计法 `Ledger#rowClosed` / `#waveLinePhase` 在「re-review 收口」的行上判错：序列 `review=[1,2] · fix=[1]`（review-1 CHANGES_REQUESTED → fix-1 APPROVED → re-review-2 APPROVED）时，旧式 `Math.min(latestFix, latestReview)` 读**陈旧的 fix@1**（route `review`）而非**收口的 review@2**（route `done`），把已闭合的波永久读作「open at fix」——波门据此拒绝下一波（P8 `{5,11}` 实测：`next:` 指向 `{12,13,14}` 而波门判 W3 仍 in-flight）。改为**判最后记录的那一轮**（fix-K 当且仅当 fix 记录于最新 review 的周期 K · D28 身份读），`waveLinePhase` 同病同修。回归 pin：`{review:[1,2], fix:[1]}` → `closedWaves` 含该波 + `waveLinePhase` 为 null。这是 D40「next/closure 判定收敛单源」的前置根修。
