---
"@oscaner-skills/cdd-engine": patch
---

**P8 §18 next 面统一——单 `Route` 概念 + 单 resolver + 单渲染器（D40 · 用户裁定 2026-10-15）** — 把 next/closure 判定从「三处判定 + 五处闭合副本 + 二份渲染」收成单一源（纯引擎内部重构 · CLI 输出形状 + 消费面零变）。① **单概念**：`session/next.ts` 的 `Route` union 增 `handoff` kind（携 `PIPELINE_NEXT` 入口）——face 内 C5 前沿与 face 间交接同属一个 union，`PIPELINE_NEXT` 降为 resolver 内部数据。② **单 resolver**：新增 `NextStepRouter.resolve(active, key)`（+ 静态 `handoff(key)`）——线内有活动态透传，线耗尽交 face 间 handoff；board 的 `#nextOf` 与 capsule 同调。③ **单渲染器**：新增 `face/route-render.ts` 的 `RouteRenderer`——capsule `#doneText` 与 board `#entryText` 二份逐字重复消除（board 的 `next:` 与引擎 `next:` 按构造逐字节一致）。④ **闭合判定 `Ledger` 单源**：`Ledger#linePhase`（+ 公开 `routeClosed`）成为单点，`run.ts#nextLinePhase`/`#markTerminal` 与 `gate.ts#linePhase`（原自称 twin）全委托；`{done,next-wave}` 闭侧谓词单址（`Ledger.routeClosed`）。⑤ **board wave 行补 task 范围**（`W{n}` → `W{n}  <ids>`，如 `W1  5,11`）。回归 pin：`handoff`/`resolve` 单测 · 跳号行 `{review:[1,2], fix:[2]}` board 判 == `Ledger#lineClosed` 判 · wave 行含 task ids。
