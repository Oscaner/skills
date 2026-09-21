# 消费者面一致性（Consumer Parity）— Overall Spec

- **Version**: v1.0 · 2026-09-21
- **Status**: Draft
- **Author**: [human] · Claude Opus 5 (1M context) (osuperpowers:brainstorming)
- **Constraints**:
  - 仓库语言政策：SKILL.md / docs 英文主源；本 spec 中文（Strategy B internal docs）
  - 不 commit 除非用户明确要求；spec 交付除外（writing-overall-spec I2 立即提交）
  - changeset 逐 phase 建
  - **允许破坏性变更**（engine breaking 面，2026-09-21 用户拍板）
  - 开发期引擎调用：`node packages/cdd-engine/dist/cli.mjs` 直调，不走 global register

## Document scope

Charter only — no implementation detail.
- **Overall approval is not equivalent to any phase started**（GATE）。
- 变更先回填本 overall（backfill-as-version），再继续实现。

## File paths

| Artifact | Path |
|---|---|
| Overall | `specs/2026-09-21-consumer-parity-overall.md` |
| Phase spec | `specs/2026-09-21-consumer-parity-p<N>-design.md` |
| Phase plan | `plans/2026-09-21-consumer-parity-p<N>.md` |

## Program charter

**Goal**：消除本仓使用 osuperpowers（skills + 插件）+ cdd-engine 与消费者安装使用产品之间的行为分歧——文档/charter 合法性（四表纪律：双向 backfill 声明、plan/design 文档存在性、依赖图成员、锚点注册域、phase 注册完整性）的执法位归位到 **engine lifecycle**（docContractValidate / statusValidate 全自动，零新增 CLI 命令），本仓自己的程序与消费者走同一执法路径，本仓 = 产品缺陷首发 canary。行为校验面收敛到消费者等价面，发布的内容即被校验的内容。

**Non-goals**：
- **不新增 cdd CLI 子命令**（2026-09-21 用户拍板，执法走 lifecycle 自动执行）
- 不改 emit / marketplace / changeset 内部流水（范围边界：产品面 + 校验面）
- 不把本仓 GitHub issue 注册数据语义强加给消费者（锚点注册域并入 engine 通用自证、无锚 no-op；本仓只保留 issue **数据**本体，不再是本仓侧检查）
- 不改 README / CLAUDE.md 的 harness 宣称类内容（非本分歧；P4 只做行为一致性同步）

**Cross-cutting constraints**：
- 破坏性变更允许；从高维度统一抽象，确保最佳实践，**不留技术债务**（必要子集透镜并入全量审计，无双实现）
- engine 零文档写入保持——引擎只判只指引，回填由作者执行
- 本程序自身四表仍受现有 `scripts/validate/overall-consistency.ts` 机器校验，直至 P3 退役该守卫（程序终结于其目标——dogfood）

## Issue inventory

| Phase | Issue (ref) | Title summary |
|---|---|---|
| P1 | none | 分歧面逐项 triage 判定（2026-09-21 brainstorm 判定；判据：依赖本仓数据 vs 普适流程故障 vs 已入 necessary 子集）+ shim 排查（本仓绕产品面的短路面清点与处置） |
| P2 | none | engine lifecycle 统一抽象——docContractValidate（pre-flight）扩为全量 charter 审计 + statusValidate（post-flight）扩为结案强制一致（F13 机械封死）；模板/文档执法位迁移 |
| P3 | none | 本仓校验面重建——overall-consistency / plan-spec-anchors 退役（用例并入 engine 套件）；validate 接线重构（本仓 dogfood 走 engine 审计同路径）；smoke-cdd 升级 consumer-sim 挂 release 门 |
| P4 | none | 发布一致性闭环——旧程序 ×9 changesets 版本化整合 + breaking 发布面 + consumer-sim release 门实测 + pack 内容面审计（tests/scripts 不进发布品）+ README/CLAUDE.md 一致性 |

## Phase inventory

| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |
|---|---|---|---|---|---|---|
| P1 | **分歧面审计 + 判定登记**：判据驱动逐项 triage——① 双向 backfill / ② 文档存在性 glob / ③ 依赖图成员 → **engine**；④ phase 注册完整性 → 已入 necessary 子集不动；⑤ 锚点注册域 → **engine 通用自证**（无锚 no-op）；⑥ issue 行 well-formed → 并入 engine 判据面；**shim 排查**——本仓现有绕产品面的短路面逐项清点、逐项给处置结论（能去掉的去、能并入 engine 的并） | [Pending] | [Pending] | P1 design 落盘 = triage 判定表 + shim 清单（逐项处置结论）；本仓程序文档（其余 in-flight 记录）无任何"仅本仓侧 charter 执法"依赖残留；处置 shim 产生的文字/结构改动经 cdd 链 review | 无（program 起点） |
| P2 | **engine lifecycle 统一抽象（breaking）**：docContractValidate（pre-flight）扩为**全量 charter 审计**——任一 dispatch 涉 parent overall 时整程序四表一次齐查（双向 backfill 声明 ↔ 列、文档存在性、依赖图成员、锚点 ∈ issue inventory、phase 注册完整性）；statusValidate（post-flight）扩为**结案强制一致**——plan complete 终态由引擎裁决消费 closeout 声明 ↔ 四表列，未回填不给 complete（F13 类机械封死）；necessary 子集透镜并入全量审计（rules/documents.ts 重构、无双实现）；模板/文档执法位迁移（add-phase-protocol 等标注 lifecycle 执法位，移除"机械守卫在本仓 scripts 侧"的表述） | [Pending] | [Pending] | 任意 dispatch（implement/review/fix/docs）在 parent overall 四表不合法时给 BLOCKED + 指引（退出码语义不变）；closeout 未回填时 plan 终态不判 complete；本仓与消费者的 charter 执法同一条 engine 路径（无 scripts 侧兜底依赖）；引擎测试覆盖全量审计 + 结案强制一致两新面；breaking 版本面明确 | P1 ->(hard) |
| P3 | **本仓校验面重建**：`scripts/validate/overall-consistency.ts` + `plan-spec-anchors.ts` **退役**（42 用例并入 engine 套件或删除，grep 零残留）；validate 接线重构——本仓 own 程序四表合规 = 跑 engine lifecycle 审计同路径、block 12 中守卫面移除；`smoke-cdd` 升级 consumer-sim（pnpm pack → 临时仓安装 → 消费者视角跑引擎链）挂 release 门 | [Pending] | [Pending] | `scripts/validate/` 无 charter 守卫残留（grep/sweep 实证 + 用例面说明）；本仓文档合规判定与消费者同引擎路径（validate 中可见）；consumer-sim 黑盒在发布门可跑并输出消费者等效结果；`pnpm run validate` 重构后全绿 | P2 ->(hard) |
| P4 | **发布一致性闭环**：旧程序 osuperpowers-overhaul ×9 changesets 版本化整合（与本程序变更的发布顺序裁决）；breaking 发布面；consumer-sim release 门实测通过；**pack 内容面审计**（npm pack 内容含 dist/templates/skills，不含仓内 tests/、scripts/ 治理残件）；README / CLAUDE.md 与落地行为一致 | [Pending] | [Pending] | 发布的 cdd-engine / osuperpowers 包经 consumer-sim 实测通过（发布品即校验品）；pack 内容面审计干净；README/CLAUDE.md 宣称与行为无分歧；两程序 changesets 版本化无冲突、变更面归属清晰 | P3 ->(hard) |

## Dependency graph (ASCII)

```
P1 -> P2   (hard: P2 落地以 P1 判定表为输入)
P2 -> P3   (hard: 校验面重建依赖引擎新执法面)
P3 -> P4   (hard: 发布闭环依赖 consumer-sim 消费实物)
```

## Boundary rules

> 每 phase：完整 brainstorm → plan → dev。Shipped before dependents start。
> Dev 期发现的新 needs / 新约束 MUST 先回填本 overall（version bump + change-history 行 + sync affected phase acceptance/dependency）再继续实现，不允许实现期绕过。

## Maintenance

- 四表逐 phase 回填；charter only，无 task 列表（phase spec 承载增量）
- 本程序自身四表在本轮程序中**仍受现有 `scripts/validate/overall-consistency.ts` 机器校验**（狗食：我们即将退役的守卫正校验我们自己的 charter，直至 P3 落地）
- 策略偏移 / phase 拆分即时回填本 overall

## Change history

| v1.0 | 2026-09-21 | 程序 charter：消费者面一致性——charter 执法位归位 engine lifecycle（零新增 CLI）、仓库侧守卫退役、校验面 = 消费者等价面、发布一致闭环（P1–P4） | [human] · Claude Opus 5 (1M context) |