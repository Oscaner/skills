---
"@oscaner-skills/kairos": patch
---

**P8 §16 cdd-design 节点改名 + handoff 分裂（D38 · 用户裁定 2026-10-15）** — 收口 cdd-design 的 handoff 一名两义：D37 消融 hub 后 `run-cdd-spec-writer` 与 `run-cdd-charter` 同指 `handoff-next`，而二线语义已分叉（spec 线应交引擎统一 next 面 · charter 线才交 design 域续环）。**改名**：`run-cdd-spec-writer` → `run-cdd-spec`（与 `run-cdd-charter` 对标 · 去 `-writer` 赘余）。**终端分裂**：`run-cdd-spec → handoff-next`（此 `handoff-next` 重定义为**遵循引擎 `next:` 字面规范**）· `run-cdd-charter → handoff-phase-design`（**新终端** · 承接原 `handoff-next` 的 design 域行为——hand off 到 `/compact` 或下一 phase 的 `kairos:cdd-design` [Px program]）。digraph 12 → 13 节点（`C → handoff-phase-design` 仅改边 target · 边 16 不变）。契约（`skill-anatomy.ts`）零改。
