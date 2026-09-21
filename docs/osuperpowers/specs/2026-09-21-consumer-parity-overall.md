# 消费者面一致性（Consumer Parity）— Overall Spec

- **Version**: v1.10 · 2026-09-21
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

**Goal**：消除本仓使用 osuperpowers（skills + 插件）+ cdd-engine 与消费者安装使用产品之间的行为分歧——文档/charter 合法性的执法位归位到 **engine lifecycle**（docContractValidate / statusValidate 全自动，零新增执法子命令，唯一例外 = `cdd help` 发现型），本仓自己的程序与消费者走同一执法路径，本仓 = 产品缺陷首发 canary，行为校验面收敛到消费者等价面，发布的内容即被校验的内容。

四表纪律（charter 合法性面；docContractValidate 全量审计 + closeout 统一规则，与 P1 triage / P2 全量审计逐项对应）——「四表」＝ 双向 backfill 声明 ↔ 列、plan/design 文档存在性、依赖图成员、锚点注册域（锚点 ∈ overall 文档 Issue inventory 表行，无锚 no-op）四张表状执法面（下述第 1/2/3/5 条）；phase 注册完整性（第 4 条）与 issue 行 well-formed（第 6 条）随必要子集并入全量审计与 engine 判据面，不单列、不计入四表：
1. 双向 backfill 声明 ↔ 列
2. plan/design 文档存在性
3. 依赖图成员
4. phase 注册完整性（随必要子集并入全量审计，不单列）
5. 锚点注册域——锚点 ∈ overall 文档 Issue inventory 表行；无锚 no-op（engine 通用自证）
6. issue 行 well-formed（并入 engine 判据面）
7. closeout 统一规则：声明源 ↔ 列双向全列（含 engine 派生终态并入声明源）；pre-flight mismatch 非空 → BLOCK + 指引，post-flight plan-complete 且未回填 → 高亮回填 recommand（回填由 orchestration 执行，2026-09-21 grilling 裁决）

**Non-goals**：
- **不新增 cdd CLI 子命令**（2026-09-21 用户拍板，执法走 lifecycle 自动执行；**唯一例外 = `cdd help`**——2026-09-21 grilling 裁决：发现型信息子命令，打印 cdd CLI 绝对目录 + schema 等必要文档目录，供 AI 定位资源；**零执法逻辑**，除 help 外仍零新增子命令）
- 不改 emit / marketplace / changeset 内部流水（范围边界：产品面 + 校验面）——v1.10 收窄：emit 对 doc-structure 的参与面**归零**（canonical = engine 包内 JSON Schema 随包发布、skills 直取成文，emit 不渲染 doc-structure 模板、无 md 模板产物；v1.2 同源派生表述据此修订，2026-09-21 grilling 裁决）；marketplace / changeset 流水仍不动
- 不把本仓 GitHub issue 注册数据语义强加给消费者（锚点注册域并入 engine 通用自证、无锚 no-op；本仓只保留 issue **数据**本体，不再是本仓侧检查）
- 不改 README / CLAUDE.md 的 harness **宣称类内容**（harness 支持面、安装/来源宣称——非行为描述类陈述）；P4 只做**行为描述类**一致性同步：行为描述与落地行为不符 → P4 改文字（范围明确）；harness 宣称因本程序 breaking 而失去成立 → 超出 P4 范围，走 finding/backfill 上抛，不在 P4 内改

**Cross-cutting constraints**：
- 破坏性变更允许；从高维度统一抽象，确保最佳实践，**不留技术债务**（必要子集透镜并入全量审计，无双实现；必要子集——即现 docContractValidate 的 necessary 子集校验（rules/documents.ts；overhaul v1.58 落地）——作为全量审计的必要成员并入，不单列）
- **spec/plan 结构定义同源派生**（用户 2026-09-21 要求，沿 data-driven-template 约定）：doc-structure 单源 = engine 包内 **canonical JSON Schema + descriptions**（v1.10：schema 唯一结构事实）→ skills 经 **`cdd help` 发现通道直取 schema 成文** + engine 侧 docContractValidate / brief 抽取**同构运行时消费**——零双维护、零 md 模板副本；emit 对 doc-structure 参与面归零（无 emit:check 该面守卫，见 Non-goal #2）；运行时组合校验兜底
- engine 零文档写入保持——引擎只判只指引，回填由作者执行
- 本程序自身四表仍受现有 `scripts/validate/overall-consistency.ts` 机器校验，直至 P3 退役该守卫（程序终结于其目标——dogfood）
- **判据定式（三判据；P1 逐项 triage 与 P2/P3 处置的记在案判定规则）**：**C1 可达性**——一条 charter 合规断言，只要消费者环境（纯包 + 无 `scripts/`、无可安装 validate）也应得到同等执法 → 归 engine lifecycle（docContractValidate / statusValidate）；engine 无法承载其时机（与 dispatch 无关的结构约束）→ 归 data-driven-template 单源或产品文档；落 repo scripts 侧第二实现 = 违规。**C2 结构性**——断言对象是结构 token / heading / 模板 → 一律同源派生（d4t 单源），engine 运行时同构消费；repo/skill 侧任何 md 模板副本全禁，**schema 为唯一结构事实**（2026-09-21 grilling 裁决）。**C3 退化（canary）**——本仓任何「仅本仓侧 charter 执法」依赖 → 处置二选一：并入 engine（该断言值得消费者得到）或删除（仅本仓必要而消费者不需要 ⇒ 本仓也不该有）；useless 必删、不留历史叙述豁免（2026-09-21 用户裁决）；处置完成态 = validate 全绿且零 scripts 侧兜底引用

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
| P1 | **分歧面审计 + 判定登记**：判据驱动逐项 triage——① 双向 backfill / ② 文档存在性 glob / ③ 依赖图成员 → **engine**；④ phase 注册完整性 → 随必要子集并入全量审计，不单列；⑤ 锚点注册域（锚点 ∈ overall 文档 Issue inventory 表行）→ **engine 通用自证**（无锚 no-op）；⑥ issue 行 well-formed → 并入 engine 判据面；**shim 排查**——本仓现有绕产品面的短路面逐项清点、逐项给处置结论（能去掉的去、能并入 engine 的并——C3 退化判据：useless 必删、不留历史叙述豁免）；13 件 overhaul 族冻结文档「仅本仓侧 charter 执法」引用即刻清理（验收② A 裁决：frozen 照清，file:line 逐处处置映射——改写中性句 / 剥除主张 / 删句，见 P1 design 处置表） | [p1-design v1.1](2026-09-21-consumer-parity-p1-design.md) | Done | P1 design 落盘 = triage 判定表 + shim 清单（逐项处置结论）；本仓程序文档（2026-09-13-osuperpowers-overhaul 族——overall 及其 p1–p6 design / plan 共 13 件）无任何"仅本仓侧 charter 执法"依赖残留（13 件清理后 grep 零活主张，block 12 自检 2/2 仍绿）；处置 shim 产生的文字/结构改动经 cdd 链 review；S5（run.ts:89 stale「(4-command H1 chain)」描述）单行修正纳入本 phase | 无（program 起点） |
| P2 | **engine lifecycle 统一抽象（breaking）**：(1) **全量 charter 审计**（docContractValidate pre-flight）——**lineage 驱动触发**：dispatch 文档链（plan → `**Spec:**` → `**Parent program**` → overall）resolve 出 parent overall → 整程序四表一次齐查（双向 backfill 声明 ↔ 列、文档存在性、依赖图成员、锚点注册域——锚点 ∈ overall 文档 Issue inventory 表行（文档表，非 GitHub issue 数据），无锚 no-op、phase 注册完整性、issue 行 well-formed——2026-09-21 grilling：phase 注册检查不再依赖 basename P 编号命名）；resolve 不出 → 四表审计 no-op、necessary-subset 恒跑；**全通道**——docContractValidate / statusValidate 提升 base 默认 override（task/docs/branch 全生效；overall 自身为 review 对象时自审）；(2) **closeout 统一规则**（2026-09-21 grilling 替代 F13 机械封死表述）——声明源 ↔ 列**双向全列**（plan + design：列已完成 ⇒ change-history 有 match claim；claim ⇒ 列非 [Pending]），**engine 派生终态（plan-complete）并入声明源**；mismatch 集**单一推断模块**；**pre-flight 硬门**（mismatch 非空 → BLOCK + 逐项指引，dry-run CDD_WARN、退出码语义不变）+ **post-flight 高亮 recommand**（plan-complete 且未回填 → 打印下一步回填，可 diff 列缺口）**同源消费**；回填由 orchestration 执行（finishing backfill-overall / writing-overall-spec sync）；necessary 子集透镜并入全量审计（rules/documents.ts 重构、无双实现）；(3) **spec/plan 结构定义同源派生**（2026-09-21 grilling 裁决）——canonical = engine 包内 **JSON Schema + descriptions**（不转 md）；skills 经 **`cdd help` 发现通道**（打印 CLI 绝对目录 + 必要文档目录）**直取 schema 成文**（零硬编码路径）；engine 侧 docContractValidate / brief 抽取同构消费同一 schema（删硬编码 token 与 SKILL.md 散文 token 的双手写）；存量 md 模板（overall / phase-spec / add-phase-protocol）随 schema 落地**退役**（模板/文档执法位迁移：add-phase-protocol 等标注 lifecycle 执法位，移除“机械守卫在本仓 scripts 侧”的表述）；(4) **harness 契约单源**（2026-09-21 grilling 升级）——task/docs/branch 共享**一个 lifecycle 契约**：handoff schema 核心块统一（commits.base/head · status · exit-gate 判据 · round-context base token），lane 差异仅边界物（doc_path vs task 序号）；逆转 docs-handoff-schema 既有“无 commits 字段”显式声明；出口门判据不变 + BLOCKED 面补可见诊断输出（spec-fix r1 BLOCKED「uncommitted at return」/ spec-fix r2 APPROVED 同契约异行为消除，2026-09-21 dogfood 实证）；breaking 版本面 = major | [Pending] | [Pending] | 任意 dispatch（implement/review/fix/docs）在 parent overall 四表不合法时给 BLOCKED + 指引（退出码语义不变；dry-run CDD_WARN）；closeout 声明源↔列双向全列（含 engine 派生终态并入声明源）一致性——pre-flight mismatch 非空 → BLOCK + 指引、post-flight plan-complete 且未回填 → 高亮回填 recommand（退出码语义不变；回填由 orchestration 执行）；本仓与消费者的 charter 执法同一条 engine 路径（无 scripts 侧兜底依赖）；引擎测试覆盖全量审计 + closeout 统一推断 + 契约确定性三新面；breaking 版本面明确（handoff schema + round-context + lifecycle 契约结构升级 = cdd-engine major）；**doc-structure 单源实证——改 canonical 定义一处 → engine 校验/抽取同步生效 + skills 消费同源产物，grep 零 md 模板副本、零第二处手工 token**；**`cdd help` 落地面——打印 CLI 绝对目录 + 必要文档目录正确、零执法逻辑、skills 零硬编码路径**；**docs-family 契约确定性实证——同契约束轮次行为一致（提交 → APPROVED；未提交 → BLOCKED + stdout 可见诊断）**；**零债断言——无 plan-only 遗留 · closeout 推断无第二实现 · 无豁免例外常量 · handoff schema 无双核心块 · base 默认 override 全通道生效** | P1 ->(hard) |
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
| v1.8 | 2026-09-21 | 判据定式落点补全（P1 design r1 review F3 回填）：C1/C2/C3 操作性定义从 change-history 名称式提升为 Cross-cutting 完整定义段——C1 可达性 / C2 结构 token 单源 / C3 退化处置，三判据即 P1 triage 与 P2/P3 处置的记在案判定规则（v1.7→v1.8） | [human] · Claude Opus 5 (1M context) |
| v1.9 | 2026-09-21 | **P1 shipped**（PR #270 合并，`89e5421f`）：P1 design v1.1 Approved（triage 判定表 + shim 清单 S1–S6 + 13 件处置表 26 命中/8 文件）· P1 plan 3-tasks 全闭环（J1 改写 4 处中性化 + J2/J3 保留 22 行实证 + S5 run.ts 单行 + AC 收口）· branch-review APPROVED → branch-fix；canary 实证登记：docs-family fix commit 义务缺口三连复现（P2 必清）、F8a `\bH1\b` 守卫扫面盲区（scripts/ 不在 ALL_MECH_POSITIONS，本 P1 清残留 5 处）；P1 Implementation plan 列回填（[Pending]→Done）；P1 Design-spec 列回填（[Pending]→p1-design v1.1）（v1.8→v1.9） | [human] · Claude Opus 5 (1M context) |
| v1.10 | 2026-09-21 | **P2 brainstorm 裁决回填**（R1–R4 全闭 · phase-size fit 单 phase）：① Non-goal#1 carve-out——`cdd help` 唯一新增子命令（发现型：打印 CLI 绝对目录 + 必要文档目录，零执法逻辑）② Non-goal#2 收窄——emit 对 doc-structure 参与面归零（schema 随 engine 包发布、skills 直取，无 md 模板产物）③ 判据 C2 守卫语扩展——repo/skill 侧 md 模板副本全禁，schema 唯一结构事实 ④ P2 scope C 段改写——canonical JSON Schema + descriptions、`cdd help` 发现通道、存量 md 模板退役 ⑤ P2 scope B 段/E2 合成——closeout 统一规则（声明源↔列双向全列 + engine 派生终态并入声明源 + mismatch 单一推断 + pre-flight 硬门 + post-flight 高亮 recommand 同源消费 + 回填由 orchestration 执行），替代 F13 机械封死表述 ⑥ P2 scope D/acceptance 升级——harness 契约单源（lifecycle 契约核心块统一 + docContractValidate/statusValidate base 默认 override 全通道 + breaking major）+ 零债断言 + `cdd help` 落地面；P2 全量审计触发改 lineage 驱动（v1.9→v1.10） | [human] · Claude Opus 5 (1M context) |
