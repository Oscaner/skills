# 新增 Phase 协议

`osuperpowers:brainstorming` 中向多 phase 程序新增 phase 的参考文档。overall 规约为唯一事实来源（SOT）；一个 phase 必须先登记进 overall，其设计才能被 grilling。

## ① 四表同步清单

当 `sync-overall` 运行时，更新父 overall 规约中的全部四张表，然后校验一致性：

- **Issue 清单** — 为每个新 issue 追加一行：`| P<new> | [#NNN](url) | 一句话摘要 |`。若某个已有 issue 仅是易主，则更新其 Phase 列而非新增一行。
- **Phase 清单** — 追加一行：`| P<new> | [scope] | [Pending]/link | [Pending]/link | [可验证验收] | [硬阻塞或软建议，引用图] |`。Design spec / plan 单元格随 phase 推进逐步填充。
- **依赖图** — 添加边：`P<pred> -> P<new>`（硬阻塞），若后继依赖该 phase 则再加 `P<new> -> P<succ>`。仅当为非阻塞的顺序便利时使用 `-> (soft)`。
- **变更历史** — 追加一行：`- vX.Y · YYYY-MM-DD — <原因：用户决策 + 范围边界>`。

一致性校验（`sync-overall` 退出前必须全部成立）：
1. 新 phase 的 spec/plan 引用的每个 `#NNN` 都存在于 Issue 清单中。
2. 依赖图引用的每个 phase 都存在于 Phase 清单中。
3. 新 phase 的每个硬依赖前驱 phase 的 **Design spec 列 = `Done`**（未交付 → 硬 BLOCKED）。

## ② 反模式（v1.19c 实时案例）

在撰写 v1.19c 时，P10 仅完成了设计规约（尚未 plan→dev→merge），本 session 却并行展开了 P14 的设计规约 + 三轮评审 —— 一次性违反两条纪律：
- **串行纪律**：在 P10 交付前就开始了 P14。
- **先登记后 grilling**：在 P14 的 phase 行于 overall 中稳定之前就 grilling 了 P14 的设计。

二者正是本协议要阻断的反模式。结构性闸门（claim-phase → sync-overall → re-explore → grilling）从工具层面使该违规不可发生。

## ③ 流程

detect（explore-context 探测）→ claim-phase（清单查表 = 权威）→ [若未登记] sync-overall（四表同步 + 一致性校验，失败时硬 BLOCKED）→ re-explore（claim-phase，此时已登记）→ grilling。
