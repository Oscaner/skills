---
"@oscaner-skills/cdd-engine": patch
---

fix: 渲染/回显面内嵌路径一律 repoRoot 相对（D47 · 治 `next:` 字面 + capsule/board/base/graph 路径散锚）:

- **根因** — D46 治的是注入 child 的 round-context prompt token（消费面 · `#valuesOf` 单出口），**未覆盖**引擎自身 stdout/stderr 渲染的字面内嵌路径值（回显面，两处不同面）。同一 plan 路径三形并存：`next:` 字面 `--plan` board 侧**绝对**（`workspace.ts` `docsOfSlug`）· 引擎轮侧 **argv 原形**（`run.ts#routeTarget` 直传 `#planPath`）· 两面 `--findings` **绝对**（`ledger.ts` `handoffPath`）；另 capsule `handoff:` cell · board 文档 cells（`overall`/`spec`/`plan`）· `base set`/`get` stdout·stderr · graph title 亦散锚 = D26「散锚」（一事实 ≥2 基准）。
- **单源修点** — `infra/workspace.ts` `WorkspaceRoot.relativize(repoRoot, value)`（唯一路径基准归一器）：绝对直取相对、repoRoot 相对直通、空值/空 root 短路。`face/route-render.ts` 的共享 `RouteRenderer`（board + 引擎两面唯一 `next:` 渲染器 · D40）增持 `repoRoot`，对 `--plan`/`--findings`/doc-id 一笔归一——board 与引擎的 `next:` 逐字节同形。capsule `handoff:` cell（`capsule.ts#emit`）· board 文档 cells（`board-view.ts#docCell`）· `base` 回显（`artifacts.ts` `baseSet`/`baseGet`）· graph title（`cli.ts`）在各自 emit 边界经同一值对象归一。
- **冻结边界** — `next:` 字面**形态**（动词/旗标/后缀/结构）不变（承 P5/D18④）；仅其内嵌**路径值**归一（用户裁定「整个引擎全面统一 repo root 相对」）。
- **回归** — `capsule.test.ts` +1（绝对 target/findings → 相对 + `handoff:` cell 同基）· `board-view.test.ts` +2（`next:` board↔capsule 逐字节同形 + 文档 cells 相对）· 既有 absolute-shape pins 重锚为相对（`cli.test.ts` 4 处 · `board-view.test.ts` 3 处）· 引擎 vitest 627/627 · kairos 73/73。
