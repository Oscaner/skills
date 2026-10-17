---
"@oscaner-skills/cdd-engine": patch
---

fix: board `next:` 单源于引擎面间派生（`NextStepRouter.walk` · D45 ⑳）:

- **根因** — `board-view.ts#nextOf` 复制了引擎的面间派生规则：取「首条未闭合线」后用**该线自身**的 `PIPELINE_NEXT` 键 handoff。spec 闭合 + plan 未开始（`docs.plan === null`）时，board 取**未开始的 plan 线**自身键 → `cdd-dev`，而正确应为**刚闭合的 spec 面**的出口 → `cdd-plan`（面边界差一格）；同类：全 phase 闭合时 board 渲 `done` 而引擎吐 `/kairos:cdd-close`。
- **单源化** — `session/next.ts` 增 `NextStepRouter.walk(report)`：板报**观测事实**（每面的 closed / active / target · keyed by `PIPELINE_FACES`），router 判**下一步**（面序 + frontier + 入口 + 锚皆单源 · `PIPELINE_FACES` 序与 `PIPELINE_NEXT` 出口同栖一处）。`board-view.ts#nextOf` 退化为纯消费者（零 forked selector）。
- **回归** — `next.test.ts` 增 walk 用例（含 off-by-one 守卫 +6）· `board-view.test.ts` 三处 pin 重锚（`cdd-dev`→`cdd-plan`）。board 实测 `next: /kairos:cdd-plan`，与引擎一致。
