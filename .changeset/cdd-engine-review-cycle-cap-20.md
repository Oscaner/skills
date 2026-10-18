---
"@oscaner-skills/cdd-engine": patch
---

fix: review-cycle 软上限 `REVIEW_CYCLE_CAP` 10 → 20（session 路由 · 用户裁定 2026-10-17）:

- **review-cycle 软上限上调** — 连续 `consecutiveS1` review-cycle 达到上限时 fix face 将下一跳交给用户裁定（`soft-cap` 建议，soft by nature：可被用户 / Plan Sole Writer 覆写）。用户裁定把上限从 10 提高到 20：给长 review-fix 马拉松（多任务 plan）更多自主回合后才打扰用户。行为面零改动——`next.ts` 路由逻辑、`SOFT_CAP_SUGGESTION` 措辞、退出码与 `next:` 字面全部不变，仅阈值变化。
- **测试** — `next.test.ts` 的字面 pin（`toBe(20)` ×2 · 编译期 `const cap: 20`）同步；`run.test.ts` 的 cap 驱动 walk 自适应（注释声明「a cap change needs no test edit」）。
