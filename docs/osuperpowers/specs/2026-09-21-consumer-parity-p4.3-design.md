# 消费者面一致性（Consumer Parity）— P4.3 cdd 多 task 模式 + task groups 裁定 + Mid-Flight Backfill 语义修复 Design Spec

- **Version**: v1.5 · 2026-09-24
- **Status**: Draft
- **Author**: [human] · Claude Opus 5 (1M context)（osuperpowers:brainstorming → writing-phase-spec）
- **Parent program**: [consumer-parity overall v1.29](2026-09-21-consumer-parity-overall.md)
- **Depends on**: P4.1（shipped · [p4.1-design v1.5](2026-09-21-consumer-parity-p4.1-design.md)）

## Section 0: Incremental warning

本 phase 承载六块增量：① cdd CLI `--task` → `--tasks` 多 task 模式（单数据模型）② cli-driven-development 正式 enter loop 前新增 **task groups 裁定**节点 ③ **Mid-Flight Backfill 语义歧义修复**（I4 文本五面重写）④⑤ **cdd-engine doc-contract gate 修复**（#274/#276，2026-09-24 用户裁决并入）⑥ **`cdd schema get` 发现型子命令 + skills read-schema 直取**（2026-09-24 用户裁决并入）——scope 扩展已回填 overall v1.28（Issue inventory 锚点行 #274/#276 · P4.3 行 scope/AC ④⑤⑥ · change-history v1.27/v1.28 行）；engine breaking 面均属 1.0.0 前窗口。P4.4（`scripts/` + cdd-engine 全面 OOP 化）已注册为独立 phase（overall v1.26，serial gate：P4.3 Design spec 非 `[Pending]` 前不释放其 grilling）——本 phase 的抽象升级**止于 `--tasks` 面必需的最小改造**（TaskGroup 单数据模型），不越界开展全层类重构（那属 P4.4）；范围变更先回填 parent overall（backfill-as-version）再继续。

## Section 1: Constraints pointer

Cross-phase 规则以 parent overall v1.29 为准（overall wins on conflict）：

- **允许破坏性变更**（charter 约束 bullet）：cdd-engine 0.1.0 基准，P4.2 1.0.0 首次稳定开版前为破口窗口；breaking 收进 P4.2 changelog
- 判据三定式（C1 可达性 / C2 结构性 / C3 退化）适用于本 phase 一切处置判断
- 四表纪律：回填 = branch-review 前置义务；结构性 mismatch → BLOCK
- 语言政策：本 spec 中文主源（Strategy B 内部程序文档）；SKILL.md / docs 英文主源（Strategy A）——I4 文本重写为英文原文面
- `skills/` 是 **emit 输入面**：SKILL.md 改动后必须 `pnpm run emit` + `emit:check` 无 drift + 产物重生成（AC 已含）
- engine 直调：`node packages/cdd-engine/dist/cli.mjs`（dev:stub 材料化，不走 global register）；skills 调用 cdd **输出零过滤**（P3 裁决：禁 `tail`/`head`/`2>&1 |`/`EXIT=$?`）
- 零产物 fixture：engine 测试不得以本仓产物为 fixture（P3 裁决）
- 相续 phase 边界：P4.4 全面 OOP 化承接 TaskGroup 扩展；P4.2 发布面消费 `--tasks`/flow 修订完成态

## Section 2: Design body

**设计主干 = 一个数据模型 + 一个落盘 + 一处重写 + 一份产出面清单 + 一张死码判定表**。

**2.1 CLI 契约：`--tasks` 单数据模型**（2026-09-24 grilling 裁决）

- **`--task` → `--tasks` 全替换零别名**（1.0.0 前破口，不留过渡 shim）
- **单数据模型**：`--tasks` 携带逗号分隔 task 列表（长度 ≥ 1）；`--tasks 1` = 长度 1 的组；**无单/多双面、无单独代码路径**；三命令同位——`cdd implement --tasks <n|n,n,…> --plan <path>` · `cdd review --type task --tasks … --plan <path>` · `cdd fix --type task --tasks … --plan <path> --findings <handoff>`
- **组即单位**（用户裁决：分了 task 组就全走 task 组，免心智分支）：一次 dispatch session 处理整组——brief 各留其份（round 信息），round-context / handoff / 进度 / 残差**按组一份**；review 一轮审整组、fix **整组重申**（无子集派发，agent 自判归因）；re-dispatch 建议串整组面
- **行为聚合**：组级单 dispatch 退出码语义不变（成功 0 / BLOCKED 1 / usage 2 / convergence 3）
- **parse 层**（`parseTaskList`，**纯格式校验**）：split(`,`).map(trim) → 逐 token 整数校验 + 去重（`1,1` → `1`）+ 空 slice 拒绝；非整数 exit 2（Bug-A 契约升级消息：`--tasks must be comma-separated integers: <token>`）——**plan-aware 超界 BLOCK 归组级 brief-gen**（`render/brief.ts` 校验面，读盘后任务数可得）：超界整体 BLOCK + 逐项列示缺失（保留 `/task N not found/` 契约）
- **canonical argv 通道锁步**：`templates/engine-config.json` `channels.argv.task {flag: "--task", type: "int"}` → `"tasks" {flag: "--tasks", type: "int-list"}`——与 parse.ts 同改同提（residue Row-9/10 守卫从它派生 CANONICAL_ARGV_FLAGS）
- **组件改动面**（Explore 实证清单）：`parse.ts`（SUBCOMMAND_USAGE ×3 · 三个 arg 声明 `tasks` · dispatch 调用点 `intTask` → `parseTaskList`）、`shared.ts`（`intTask` 内核复用于逐 token 校验 + 消息升级）、`review.ts:190` / `fix.ts:41` 缺失必填错误串、`bin.ts:9` 头注释、`dispatch/task.ts`（TaskLifecycle `#taskNum` 标量 → 组载体）、`rules/failure.ts:117-121` 与 `dispatch/task.ts:760-761` re-dispatch 建议串、`render/brief.ts:33-36` 超界检查（组级校验面）

**2.2 task groups 裁定节点 + plan 落盘（含空默认语义）**

- **裁定节点**（cli-driven-development，正式 enter loop 前）：task groups 界定 → 用户确认 → 才进 implement→review→fix loop；门控镜像 `determine-base`（AskUserQuestion；拒答 → BLOCKED）
- **digraph 改造**：`C --> T{task groups 裁定}` 新节点于 `set-base-branch → implement-task` 边（确认后组列表流入 D 的 `--tasks`）；`H{more-tasks?}` → `{more-groups?}`
- **`taskGroups` 入 plan canonical schema**（`src/documents/schema/plan.json`）：`optional` · `default: []` · `items: {tasks: number[]}` 且 `minItems ≥ 2`（长度 1 组为冗余 → 单组态只存在于空默认，同时简化裁定节点写盘判定）
- **空默认语义**（2026-09-24 用户裁决）：`taskGroups: []`/缺省 ⇒ `effectiveGroups = [[1],[2],…,[N]]` = **per-task 现状等价、零迁移**；非空 ⇒ 声明组取代
- **落盘规则**：「Task Groups」节**仅在合并分组时落盘**（裁定输出非平凡才动 plan）+ 独立 commit + 干净树后进 loop；零分组时无 plan churn
- **消化面单处派生**：`effectiveGroups = taskGroups.length ? taskGroups : singletons(taskNumbersFromPlan(plan))`（`rules/documents.ts` · `dispatch/base.ts` 迭代随组）——无第二实现
- **CLI 与 plan 记录关系**：`--tasks` = dispatch 指令（源 truth）；plan `taskGroups` = 编排记录（默认空 → per-task）。**分歧支配规则**：`taskGroups` 唯一写者为裁定节点，任何合并组（列表长度 ≥ 2）dispatch 前「Task Groups」节已落盘（§2.2 落盘规则）——CLI 与记录恒一致、无漂移态，re-dispatch 分组不丢；`--tasks 1` 单组与空默认 singletons 同态，分歧不成立

**2.3 Mid-Flight Backfill I4 语义修复（五面重写）**

- **承载面 = 五件**（v1.26 已把 AC「三件」改述）：writing-single-spec **I3** · writing-overall-spec **I3** · writing-phase-spec **I4** · writing-plans **I4** · cli-driven-development **I7**——行体现同文，改后仍逐字节一致（编号差异保留，不统一）
- **重写语义四点 + 显式顺序**（现文缺「暂停/恢复」时序）：任何 dispatch（implement/review/fix）返回 → **立地落地 backfill** → **独立 commit** → **循环暂停至树净** → **恢复后下一轮 review in-band 审计**（changed-surface booking，非 block）；pending-acceptance sole-writer 路径保留
- **engine 零新机制**（clean-tree 硬门已存在）；「涉 engine CLI」= §2.1 的 `--tasks` 面，重写纯 skills 文本

**2.4 模板与 schema 产出面**（2026-09-24 核查结论，随 CLI 契约调整）

| 层次 | 文件 | 变更（范围 = `--tasks` 契约面；④⑤ 改动面见 §2.6/AC · ⑥ 改动面见 §2.7/AC） |
|---|---|---|
| 锁步（必改） | `templates/engine-config.json` argv 通道 | `task` → `tasks`（flag + type `int` → `int-list`） |
| 锁步（必改） | `src/documents/schema/plan.json` | `taskGroups` 属性（§2.2 语义） |
| 产物契约 | `engine-config.json` `handoffNamespace.families` | `task-{task}-*.json` → 组单位命名（组键规则：组键 = 组元素**按序以 `-` 连接的完整 list 串**、无 range 缩写——`--tasks 1` → `tasks-1` · `--tasks 1,2` → `tasks-1-2` · `--tasks 1,2,3` → `tasks-1-2-3`；与 family 后缀组合：`tasks-1-2-implement` / `tasks-1-2-review-{round}` / `tasks-1-2-fix-{round}`；AC ③ 依赖该命名面；最小形态，P4.4 抽象化输入） |
| 产物契约 | `templates/schema/task-handoff-schema.json` | handoff 内容补组引用（tasks 列表 + per-task 区段字段） |
| emit 输入 | `skills/cli-driven-development/SKILL.md` ×3 调用串 → `--tasks`（改后 `pnpm run emit` + refresh） |
| 宣讲面 | cdd-engine 包 README `--task` 示例 ×4 行（`implement` 表行 · `cdd review --task` 选项列举，README.md:31,37 / README.zh-CN.md:33,39；zh-CN mirror 同改；osuperpowers 包同旗零命中，无改） |
| 守卫面 | `scripts/validate/__tests__/residue.test.ts:1149` + `:121` 合成 fixture 字面量随迁（:121 retired-`brief` 守卫 `cdd brief --task 1 --plan p --output o` argv 迁 `--tasks`、anti-reintroduce 断言保留，与 cli-shape.test.ts:108 同构） |
| 不动 | `phase-spec.json` · `template-contract.json`（review lens，非 flag）· `lifecycle.json`（零 task 引用）· frozen 历史 docs（overhaul 族 / p3-p6 历史行，豁免）——**carve-out**：`src/documents/schema/overall.json` 不入本行（§2.6 #276 ④⑤ 描述层三处必改：`changeHistory.header.columns` 首格 `version` 判定 · `issueInventory.row.issueRef` 字面枚举 · `phaseInventory.rowShape.cellCount` + `columnNames.header` 6 内容列；改动见 §2.6 + AC ⑫） |

**2.5 死码清扫判定表**（2026-09-24 用户裁决：空壳、死代码即删；逐项判定防误删行为断言）

| 面 | 处置判定 |
|---|---|
| `shared.ts:intTask` 单值入口 | 内核复用（逐 token 校验），单值入口随改名删除 |
| `cli-shape.test.ts:108` retired-`brief` 回归 | **非死码**——anti-reintroduce 行为断言（`cdd brief …` → 未知命令 exit 2）保留，argv 迁 `--tasks` |
| `residue.test.ts:121` retired-`brief` 守卫 fixture | **非死码**——retired-子命令 lexicon 守卫断言保留，argv 迁 `--tasks`（与 cli-shape.test.ts:108 同构） |
| `dispatch/task.ts:760-761` / `rules/failure.ts` re-dispatch 建议串 | 改整组面（`cdd fix --tasks 1,2` 形态） |
| handoff/进度命名残面 | 组键命名最小形态落 §2.4；残余标量残面**留白 P4.4**（本 phase 不越界） |

**测试面**——engine 测试：`--tasks 1` 与 `--tasks 1,2` 同一 dispatch 路径行为实证（成功 · 超界 BLOCK · 去重 · trim · 空 slice 拒绝 · 非整数 exit 2）、组 review/fix 一轮整组、re-dispatch 串整组断言、现有 `--task` 用例全量迁 `--tasks`；`smoke-cdd` consumer-sim 链随迁；skills 面：`pnpm run emit` + `emit:check` 无 drift、I4 五面同文 grep 断言、digraph 节点/边新判据接线。

**2.6 doc-contract gate 修复（#274 / #276，2026-09-24 用户裁决并入 · engine breaking 面 · 1.0.0 前窗口）**

**#274 — plan 列中间态 + claim 等值 + 诊断**（issue #274）

- **状态词汇**：plan 列合法态 `[Pending]`（未开工）→ `[In-flight]`（已开工 · **无 reverse claim 义务**）→ `**Done**`（+ closeout claim）——`rules/documents.ts` `isPendingText` 旁新增 `isInflightText`；in-flight 列不触发 reverse claim 硬门（closeout 规则明示 carve-out，见 §3 第一行）
- **claim 双向等值放宽**：link 形态 plan cell 对齐 design 列 `ownDesignToken` 提取——双向校验从「逐字符严格相等」（`stripCellMarkup(plan_cell) === claim_target`）改为「link 指向同一 plan 文档即等」，消除 CLAIM_RE stop-set `[ ]（ ）` 与 link 形态的无解冲突
- **诊断改进**：claim 解析不再整子句扫 phase（prose 提及的 phase 误作 claim target）；只认显式 claim 结构（`Pending → **Done**`）；多 phase 命中时报错附「同子句 prose 提及 phase 亦成 target」提示

**#276 — overall.json 描述 ↔ enforcement 对齐 + 报错 UX**（issue #276）

- **事实源判定**：enforcement 按位置读、语义正确（`documents.ts:585` 表头首格 `version` · `890-905` issue-ref 合法枚举 · Phase 行 6 内容列 c1=id / c3=Design / c4=plan / c6=dependency，fixture `smoke-overall.md` 行形）→ **schema 描述层改向 enforcement 实读形态**（不反向改 engine 读法、不加 Scope 列）：
  - `changeHistory.header.columns` enum → 统一描述首格 `version` 判定
  - `issueInventory.row.issueRef` 字面形式 → 合法枚举 none / `#NNN` / `[#NNN]` / `#NNN#issuecomment-<digits>` / 整格括号（`^[（(][^）)]*[）)]$`）
  - `phaseInventory.rowShape.cellCount` / `columnNames.header` → 6 内容列、与 smoke-overall.md 行形一致（描述层改写：`rowShape.cellCount` const=8 与 `columnNames.count` const=7、`columnNames.header` const=7 列三处自相矛盾值，统一向 enforcement 实读的 6 内容列）
- **报错 UX**：`bad/empty version` · `unrecognized issue ref` · `not a Phase-inventory id` 三处附 `should look like:` 正确形态行；移除误导的「use the canonical 7-column Phase inventory header」提示（引擎不按该列序读取）

**测试面补（#274/#276）**——engine 测试自造链覆盖（smoke-overall fixture 形态；零本仓产物 fixture，P3 裁决）；触发回归 = P3.8 触发现场复现（`[In-flight]` 列 + link 形态 plan cell + prose 提及 phase 不误命中）；#276 修正后照 schema 描述所写形态不再被 gate 拒绝（对拍断言）。

**2.7 `cdd schema get` 发现型子命令 + skills read-schema 直取**（2026-09-24 用户裁决并入 · Non-goal #1 例外扩编）

- **动机**：现 read-schema 面 = `cdd help` 打目录 → agent 跨文件系统定位并 Read 文件（心智负担 + 步骤间接）；`cdd schema get <type>` 直出 canonical schema 原文（stdout）一步到位，省去跨系统文件查找（用户需求原文）
- **命令形态**：`cdd schema get <type>`——type 面 = canonical doc 类型枚举**四件全量**（overall / plan / phase-spec / add-phase-protocol，对齐 engine `DOC_SCHEMA_NAMES` 注册表；服务对象 = canonical doc-structure schema 目录内的 schema 文件，`loadDocSchema` 按名加载、四件同源——不做子集 carve-out，避免对 canonical 类型报「未知」的误导 UX，也免去维护命令枚举与注册表的双列表）；stdout 直出 canonical schema JSON 原文（单一来源 = engine 包 schema；未发布期 dist/documents/schema 同源）；doc-type 未知 → usage exit 2 + 可用名枚举（枚举即该四件，与命令形枚举同源）；`cdd help` 保留——仍打印 `cli:` / `schemas:` / `templates:` 三行绝对目录（doc-structure schema 直取已由 `cdd schema get` 承接，handoff schema 与 templates 面仍靠 help 目录）；与 help 同属**发现型 · 零执法逻辑**（Non-goal #1：`cdd help` 唯一例外 → `cdd help` + `cdd schema get` 双发现型豁免，charter v1.28 修订）
- **组件面**：新增 `cli/schema.ts`（子命令组）——`parse.ts` citty 声明 `schema` 子命令 + `get <type>` enum 校验（四件 = `DOC_SCHEMA_NAMES` 全量：overall / plan / phase-spec / add-phase-protocol，实现面直接消费注册表常量、零双枚举）；`exit.ts` 出口族统一、stdout 结果面、无裸 return；**无新 flag** → canonical argv 通道不变、residue Row-9/10 无涉；engine-config 零改动
- **测试面**：`cdd schema get phase-spec` 输出与 `dist/documents/schema/phase-spec.json` 同字节（engine 测试）；未知 doc-type → exit 2 + 可用名枚举（四件）；help 功能回归
- **skills 更新（emit 输入面，与 §2.3 I4 重写同批文件）**：三件 schema-bearing 技能（writing-overall-spec / writing-phase-spec / writing-plans）的 read-schema 指令从「run `cdd help` → `schemas:` 目录 → Read `<type>.json`」改「run `cdd schema get <type>` 直取成文」；writing-single-spec read-schema 节点显式 N/A（single specs 无 canonical 结构 schema），不收改。`cdd help` 定位串除 read-schema 节点外尚有残留面（writing-overall-spec role-note「(`cdd help` → `overall.json`)」/「(via `cdd help`)」、writing-plans pending-patch zone「`cdd help` → `plan.json`」）——一并清为 `cdd schema get` 形态；改后 `pnpm run emit` + `emit:check` 无 drift + 产物重生成；plan 侧 I4 五面重写 + read-schema 直取合并为同一 skills task（两类改动同文件同批落地）

### Acceptance criteria

- `cdd implement --tasks 1` 与 `--tasks 1,2` 走同一 dispatch 路径、行为正确（engine 测试绿 + dispatch 实证）；`--task` 单数旗标零残留：`packages/cdd-engine/src` · `scripts/` · `skills/` · 两包 README grep `--task` 零命中（frozen 历史 docs 豁免）
- `--tasks` 值边界正确：`--tasks 1, 2` 容忍空格（trim）· `--tasks 1,1` 去重 · `--tasks 1,`（尾逗号空 slice）exit 2 拒绝（与格式面一致）· `--tasks 1,9`（9 超界）整体 BLOCK + 缺失列示 · `--tasks abc` 非整数 exit 2（Bug-A 升级消息 `must be comma-separated integers`）
- `cdd review --type task --tasks 1,2` 一轮审整组（round/blocker/findings 组级归因）；`cdd fix --type task --tasks 1,2 --findings <handoff>` 整组修；re-dispatch 建议串为整组面（`cdd fix --tasks 1,2` 形态，无子集）
- plan 无 taskGroups 节（空默认）时 loop 逐 `--tasks 1`、`--tasks 2` 推进且与 P4.3 前现状等价（实证）；非空 taskGroups 按声明组 dispatch
- `plan.json` schema 含 `taskGroups` 属性（`optional` · `default: []` · item `minItems ≥ 2`）；`effectiveGroups` 在 `taskNumbersFromPlan`/`base.ts` 单处派生、无第二实现
- cli-driven-development flow digraph 含 task-groups 裁定节点（`C --> T --> D` 边）、`{more-groups?}` 判定、loop 入口以用户确认门控（拒答 BLOCKED）；组列表流入 `cdd implement --tasks a,b`
- Mid-Flight Backfill 文本五面（writing-single-spec · writing-overall-spec · writing-phase-spec · writing-plans + cli-driven-development）一致、语义无歧义（含四点顺序：返回即落地 → 独立 commit → 暂停至树净 → 恢复后 in-band 审；grep 五面同文 + 措辞核对）
- `templates/engine-config.json` argv `tasks` 通道（flag `--tasks` · type `int-list`）与 parse.ts 锁步（residue Row-9/10 守卫绿，validate 过）
- `pnpm run emit` 后 `emit:check` 无 drift；`pnpm run validate` 11 块全绿；本 spec 的 Parent program v1.29 版本行 lineage 合法；P4.3 行 Design-spec / Implementation plan 列随 phase 推进正确回填（backfill-overall，branch-review 前完成）
- `[In-flight]` 计划列状态合法（`isInflightText` · 无 reverse claim 义务 · 非 mismatch cell）；`[Pending]` → `[In-flight]` → `**Done**` 三态语义 + claim 只在 closeout 出现（engine 测试自造链 + P3.8 触发现场回归）
- Link 形态 plan cell 与 claim 双向等值（ownDesignToken 对齐：link 指向同一 plan 文档即等，弃逐字符严格相等）；子句 prose 提及 phase 不再整体作 claim 目标（诊断提示到位）
- overall.json 描述与 enforcement 三处同形（change-history 表头首格 `version` · issue-ref 合法枚举 · Phase 行 6 内容列；`documents.ts`↔schema 对拍断言）+ 三处报错附 `should look like:` 正确形态（bad/empty version · unrecognized issue ref · not a Phase-inventory id）+ 误导的 7 列提示移除
- `cdd schema get <type>`（type ∈ 四件：overall / plan / phase-spec / add-phase-protocol，对齐 `DOC_SCHEMA_NAMES` 全量）stdout 与 canonical schema 同字节（engine 测试断言）；未知 doc-type → usage exit 2 + 可用名枚举（= 该四件、与命令形枚举同源）；零执法逻辑（黑盒断言无校验面）；`cdd help` 功能不回归
- writing-* read-schema 直取：三件 schema-bearing 技能（writing-overall-spec / writing-phase-spec / writing-plans）read-schema 节点改 `cdd schema get <type>`；writing-single-spec read-schema 显式 N/A（零 canonical 结构 schema）、无改。（grep：三件命中 `cdd schema get` · 零残留 `cdd help` 定位串——`cdd help` → `schemas:` directory 与 `cdd help` → `overall.json` / `phase-spec.json` / `plan.json`（read-schema 节点 + 节点外 role-note、pending-patch zone 全清））+ `pnpm run emit` 后 `emit:check` 无 drift
- Non-goal #1 双发现型修订落地（`cdd help` + `cdd schema get` 均零执法逻辑；其余零新增子命令不变，grep 断言）

## Section 3: Deviations from overall

| Overall assumption | Phase decision | Overall updated? |
|---|---|---|
| closeout 规则（P2 统一规则：结构性 mismatch 非空 → BLOCK · 声明源↔列双向全列） | plan 列新增 `[In-flight]` 中间态：已开工 · 无 reverse claim 义务（claim 只在 closeout `Pending → **Done**` 出现）· `[In-flight]` 非缺失 cell、不计 mismatch | Yes — v1.27 · 2026-09-24 |
| Non-goal #1（P2 裁决：`cdd help` 唯一新增子命令 · 发现型信息面） | 例外扩为 `cdd help` + `cdd schema get <type>` 双发现型子命令（均零执法逻辑；schema get 直出内容、免跨系统文件查找）；其余「零新增子命令」豁免不变 | Yes — v1.28 · 2026-09-24 |
| （其余全部设计裁决已随 overall v1.27 回填：P4.3 行 scope/AC ①–⑤同步 · P4.4 注册 · 依赖图 `P3 → P4.1 → P4.3 → P4.4 → P4.2`，见 v1.26/v1.27 change-history 行） | 同上 | Yes — v1.27 · 2026-09-24 |

## Section 4: Notes for downstream

- **P4.4（全面 OOP 化）**：承接 §2.1/§2.5 的 TaskGroup 单数据模型与组键命名面，扩展为 cdd-engine 全层类抽象 + `scripts/` 编排面同构；本 phase 留白的标量残面（handoff/进度命名）为其实践输入（overall 已登记，serial gate：P4.3 Design 非 `[Pending]` 前不释放其 grilling）
- **P4.2（发布闭环）**：1.0.0 首次稳定开版收进 `--tasks` breaking 与 flow 修订（依赖图 `P4.4 -> P4.2` 已登记）

## Section 5: Review

Fresh-subagent review passes before user review and writing-plans — baseline = committed tree, Review Convergence（blocker > 0 → fix all findings → re-review；blocker = 0 → fix all findings → done，no re-review）。spec 批准即 commit（I2），不等 dev 合并。
