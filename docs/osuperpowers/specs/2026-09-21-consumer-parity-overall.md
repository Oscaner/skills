# 消费者面一致性（Consumer Parity）— Overall Spec

- **Version**: v1.7 · 2026-09-21
- **Status**: Approved
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

**Goal**：消除本仓使用 osuperpowers（skills + 插件）+ cdd-engine 与消费者安装使用产品之间的行为分歧——文档/charter 合法性的执法位归位到 **engine lifecycle**（docContractValidate / statusValidate 全自动，零新增 CLI 命令），本仓自己的程序与消费者走同一执法路径，本仓 = 产品缺陷首发 canary，行为校验面收敛到消费者等价面，发布的内容即被校验的内容。

四表纪律（charter 合法性面；docContractValidate 全量审计 + statusValidate 结案强制一致，与 P1 triage / P2 全量审计逐项对应）——「四表」＝ 双向 backfill 声明 ↔ 列、plan/design 文档存在性、依赖图成员、锚点注册域（锚点 ∈ overall 文档 Issue inventory 表行，无锚 no-op）四张表状执法面（下述第 1/2/3/5 条）；phase 注册完整性（第 4 条）与 issue 行 well-formed（第 6 条）随必要子集并入全量审计与 engine 判据面，不单列、不计入四表：
1. 双向 backfill 声明 ↔ 列
2. plan/design 文档存在性
3. 依赖图成员
4. phase 注册完整性（随必要子集并入全量审计，不单列）
5. 锚点注册域——锚点 ∈ overall 文档 Issue inventory 表行；无锚 no-op（engine 通用自证）
6. issue 行 well-formed（并入 engine 判据面）
7. 结案强制一致：closeout 声明 ↔ 四表列，未回填不给 complete（statusValidate 裁决）

**Non-goals**：
- **不新增 cdd CLI 子命令**（2026-09-21 用户拍板，执法走 lifecycle 自动执行）
- 不改 emit / marketplace / changeset 内部流水（范围边界：产品面 + 校验面）——唯一例外：emit 内部流水改动仅限 doc-structure 模板渲染目标 + 其 emit:check / 运行时组合接线，属产品面 + 校验面承载（沿 data-driven-template 约定，v1.2 同源派生）；marketplace / changeset 流水仍不动
- 不把本仓 GitHub issue 注册数据语义强加给消费者（锚点注册域并入 engine 通用自证、无锚 no-op；本仓只保留 issue **数据**本体，不再是本仓侧检查）
- 不改 README / CLAUDE.md 的 harness **宣称类内容**（harness 支持面、安装/来源宣称——非行为描述类陈述）；P4 只做**行为描述类**一致性同步：行为描述与落地行为不符 → P4 改文字（范围明确）；harness 宣称因本程序 breaking 而失去成立 → 超出 P4 范围，走 finding/backfill 上抛，不在 P4 内改

**Cross-cutting constraints**：
- 破坏性变更允许；从高维度统一抽象，确保最佳实践，**不留技术债务**（必要子集透镜并入全量审计，无双实现；必要子集——即现 docContractValidate 的 necessary 子集校验（rules/documents.ts；overhaul v1.58 落地）——作为全量审计的必要成员并入，不单列）
- **spec/plan 结构定义同源派生**（用户 2026-09-21 要求，沿 data-driven-template 约定）：doc-structure 单源（engine 包内 canonical 定义）→ emit 渲染 skill 侧 templates + engine 侧 docContractValidate / brief 抽取**同构运行时消费**——零双维护，`emit:check` 漂移守卫 + 运行时组合校验
- engine 零文档写入保持——引擎只判只指引，回填由作者执行
- 本程序自身四表仍受现有 `scripts/validate/overall-consistency.ts` 机器校验，直至 P3 退役该守卫（程序终结于其目标——dogfood）

## Issue inventory

| Phase | Issue (ref) | Title summary |
|---|---|---|
| P1 | none | 分歧面逐项 triage 判定 + shim 排查（triage 判据与 shim 处置明细落盘 P1 design 判定表） |
| P2 | none | engine lifecycle 统一抽象：docContractValidate 全量审计 + statusValidate 结案强制一致（breaking） |
| P2 | none | docs-family fix 通道 commit 义务未 concretize（2026-09-21 dogfood 实证：同契约两轮异行为 spec-fix r1 BLOCKED / spec-fix r2 APPROVED）——P2 harness 契约统一必清项 |
| P3 | none | 本仓校验面重建：overall-consistency / plan-spec-anchors 退役 + validate 接线走 engine 同路径 + smoke-cdd 升级 consumer-sim 挂 release 门 |
| P4 | none | 发布一致性闭环：旧程序 ×9 changesets 版本化整合 + breaking 发布面 + consumer-sim release 门实测 + pack 内容面审计 + README/CLAUDE.md 一致性 |

## Phase inventory

| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |
|---|---|---|---|---|---|---|
| P1 | **分歧面审计 + 判定登记**：判据驱动逐项 triage——① 双向 backfill / ② 文档存在性 glob / ③ 依赖图成员 → **engine**；④ phase 注册完整性 → 随必要子集并入全量审计，不单列；⑤ 锚点注册域（锚点 ∈ overall 文档 Issue inventory 表行）→ **engine 通用自证**（无锚 no-op）；⑥ issue 行 well-formed → 并入 engine 判据面；**shim 排查**——本仓现有绕产品面的短路面逐项清点、逐项给处置结论（能去掉的去、能并入 engine 的并——C3 退化判据：useless 必删、不留历史叙述豁免）；13 件 overhaul 族冻结文档「仅本仓侧 charter 执法」引用即刻清理（验收② A 裁决：frozen 照清，file:line 逐处处置映射——改写中性句 / 剥除主张 / 删句，见 P1 design 处置表） | [Pending] | [Pending] | P1 design 落盘 = triage 判定表 + shim 清单（逐项处置结论）；本仓程序文档（2026-09-13-osuperpowers-overhaul 族——overall 及其 p1–p6 design / plan 共 13 件）无任何"仅本仓侧 charter 执法"依赖残留（13 件清理后 grep 零活主张，block 12 自检 2/2 仍绿）；处置 shim 产生的文字/结构改动经 cdd 链 review；S5（run.ts:89 stale「(4-command H1 chain)」描述）单行修正纳入本 phase | 无（program 起点） |
| P2 | **engine lifecycle 统一抽象（breaking）**：docContractValidate（pre-flight）扩为**全量 charter 审计**——任一 dispatch 涉 parent overall 时整程序四表一次齐查（双向 backfill 声明 ↔ 列、文档存在性、依赖图成员、锚点注册域——锚点 ∈ overall 文档 Issue inventory 表行（文档表，非 GitHub issue 数据），无锚 no-op、phase 注册完整性、issue 行 well-formed）；statusValidate（post-flight）扩为**结案强制一致**——plan complete 终态由引擎裁决消费 closeout 声明 ↔ 四表列，未回填不给 complete（F13 类机械封死——沿用上一程序 branch-review 的 closeout 强制一致机制）；necessary 子集透镜并入全量审计（rules/documents.ts 重构、无双实现）；**spec/plan 结构定义同源派生**——canonical doc-structure 定义（engine 包内单源）→ emit 渲染 skill 侧 templates（overall / phase-spec / plan / add-phase-protocol 执法位标注）+ engine 侧 docContractValidate / brief 抽取同构运行时消费（删硬编码 token 与 SKILL.md 散文 token 的双手写）；模板/文档执法位迁移（add-phase-protocol 等标注 lifecycle 执法位，移除"机械守卫在本仓 scripts 侧"的表述）；**harness 契约统一**——docs-family fix 通道 commit 义务 concretize（round-context 补 base、docs handoff 增 commits 字段，与 task-family 同面；出口门判据不变），消除同契约异行为（spec-fix r1 BLOCKED「uncommitted at return」/ spec-fix r2 APPROVED，2026-09-21 dogfood 实证），BLOCKED 面补可见诊断输出 | [Pending] | [Pending] | 任意 dispatch（implement/review/fix/docs）在 parent overall 四表不合法时给 BLOCKED + 指引（退出码语义不变）；closeout 未回填时 plan 终态不判 complete；本仓与消费者的 charter 执法同一条 engine 路径（无 scripts 侧兜底依赖）；引擎测试覆盖全量审计 + 结案强制一致两新面；breaking 版本面明确；**doc-structure 单源实证——改 canonical 定义一处 → templates 与 engine 校验/抽取同步生效，`emit:check` 零 drift，无第二处手工 token**；**docs-family fix 契约确定性实证——同契约束轮次行为一致（提交 → APPROVED），BLOCKED 有可见诊断** | P1 ->(hard) |
| P3 | **本仓校验面重建**：`scripts/validate/overall-consistency.ts` + `plan-spec-anchors.ts` **退役**（42 用例并入 engine 套件或删除，grep 零残留）；validate 接线重构——本仓 own 程序四表合规 = 跑 engine lifecycle 审计同路径、block 12 中守卫面移除；`smoke-cdd` 升级 consumer-sim（pnpm pack → 临时仓安装 → 消费者视角跑引擎链）挂 release 门 | [Pending] | [Pending] | `scripts/validate/` 无 charter 守卫残留（grep/sweep 实证 + 用例面说明）；本仓文档合规判定与消费者同引擎路径（validate 中可见）；consumer-sim 黑盒在发布门可跑并输出消费者等效结果；`pnpm run validate` 重构后全绿 | P2 ->(hard) |
| P4 | **发布一致性闭环**：旧程序 osuperpowers-overhaul ×9 changesets 版本化整合（与本程序变更的发布顺序裁决）；breaking 发布面；consumer-sim release 门实测通过；**pack 内容面审计**（npm pack 内容含 dist/templates/skills，不含仓内 tests/、scripts/ 治理残件）；README / CLAUDE.md 行为描述类陈述与落地行为一致（harness 宣称类内容不触及，见 Program charter Non-goal） | [Pending] | [Pending] | 发布的 cdd-engine / osuperpowers 包经 consumer-sim 实测通过（发布品即校验品）；pack 内容面审计干净；README/CLAUDE.md 行为描述类陈述与行为无分歧（harness 宣称类内容不动）；两程序 changesets 版本化无冲突、变更面归属清晰 | P3 ->(hard) |

## Dependency graph (ASCII)

```
P1 -> P2   (hard: P2 落地以 P1 判定表为输入)
P2 -> P3   (hard: 校验面重建依赖引擎新执法面)
P3 -> P4   (hard: 发布闭环依赖 consumer-sim 消费实物)
```

Legend:
- `->` = hard block（依赖前置 phase 发布后方可启动）
- `-> (soft)` = suggestion only（非阻塞排序建议；本图无边）

## Boundary rules

> 每 phase：完整 brainstorm → plan → dev。Shipped before dependents start。
> Dev 期发现的新 needs / 新约束 MUST 先回填本 overall（version bump + change-history 行 + sync affected phase acceptance/dependency）再继续实现，不允许实现期绕过。

## Maintenance

- 四表逐 phase 回填；charter only，无 task 列表（phase spec 承载增量）
- 本程序自身四表在本轮程序中**仍受现有 `scripts/validate/overall-consistency.ts` 机器校验**（狗食：我们即将退役的守卫正校验我们自己的 charter，直至 P3 落地）
- 策略偏移 / phase 拆分即时回填本 overall

## Change history

| v1.0 | 2026-09-21 | 程序 charter：消费者面一致性——charter 执法位归位 engine lifecycle（零新增 CLI）、仓库侧守卫退役、校验面 = 消费者等价面、发布一致闭环（P1–P4） | [human] · Claude Opus 5 (1M context) |
| v1.1 | 2026-09-21 | cdd spec-review r1（blocker=0，3 warn + 5 nit）全 finding 落地：⑥ 并入 P2 全量审计枚举、④ 随必要子集并入不单列、Non-goal#4 行为描述/宣称类拆分、F13 内联 gloss、Goal 拆句 + 纪律枚举、issue 行单行化、P1 验收枚举 2026-09-13-overhaul 族、依赖图补图例（v1.0→v1.1） | [human] · Claude Opus 5 (1M context) |
| v1.2 | 2026-09-21 | 用户增补：spec/plan **结构定义同源派生**（data-driven-template 约定）——canonical doc-structure 单源 → skill templates 渲染产物 + engine 校验/抽取同构消费，零双维护；P2 scope/acceptance + cross-cutting 增补（v1.1→v1.2） | [human] · Claude Opus 5 (1M context) |
| v1.3 | 2026-09-21 | cdd spec-review r2（1 warn + 1 nit）全 finding 落地：Non-goal #2 显式 carve-out（emit 内部流水改动仅限 doc-structure 模板渲染目标 + 其 emit:check / 运行时组合接线，属产品面 + 校验面承载，marketplace / changeset 流水仍不动）；锚点注册域措辞统一——纪律 #5 / P1 ⑤ / P2 全量审计同用「锚点 ∈ overall 文档 Issue inventory 表行；无锚 no-op」，P2 枚举加注 inventory 指文档表非 GitHub issue 数据（v1.2→v1.3） | [human] · Claude Opus 5 (1M context) |
| v1.4 | 2026-09-21 | dogfood 发现登记（本仓 canary 首发命中）：docs-family fix 通道 **commit 义务未 concretize**——round-context 无 TASK_FIXED_POINT + docs handoff schema 声言无 commits 字段，出口门却强制 clean tree → 同契约两轮异行为（spec-fix r1 BLOCKED「uncommitted changes at return (fix)」/ spec-fix r2 APPROVED；task-family 对照全 APPROVED）；BLOCKED 面 CLI 无可见诊断。P2 scope/acceptance 增补 harness 契约统一（v1.3→v1.4） | [human] · Claude Opus 5 (1M context) |
| v1.5 | 2026-09-21 | cdd spec-review r3（1 warn + 1 nit）全 finding 落地：「四表」定义锚补枚举 gloss（纪律 lead-in——双向 backfill 声明 ↔ 列 / plan·design 文档存在性 / 依赖图成员 / 锚点注册域，即下述 1/2/3/5 条；phase 注册完整性 / issue 行 well-formed 并入不单列、不计入四表）；docs-family fix 轮次缩写统一改标「spec-fix rN」——v1.4 行 / Issue inventory / P2 scope 三处同改，与既有「spec-review rN」措辞区分（v1.4→v1.5） | [human] · Claude Opus 5 (1M context) |
| v1.6 | 2026-09-21 | 程序批准：Status Draft → Approved（overall 已合入 develop，PR #269）· 进入 P1 brainstorm（v1.5→v1.6） | [human] · Claude Opus 5 (1M context) |
| v1.7 | 2026-09-21 | P1 brainstorm R1–R3 裁决回填：判据定式落盘——C1 可达性 / C2 结构性 / C3 退化（useless 必删、无历史叙述豁免）；shim 清单四分类（替换执法 · 声称残留 · 路径差异 · 描述漂移）+ 处置表 S1–S6；13 件 overhaul 族冻结文档清理 = P1 执行（验收② A 解释：frozen 照清）；处置项新增 S5（run.ts:89 stale「4-command」描述 → P1 单行修正）、S6（.changeset ×2 block-12 声称 → P4 版本化时清）（v1.6→v1.7） | [human] · Claude Opus 5 (1M context) |
