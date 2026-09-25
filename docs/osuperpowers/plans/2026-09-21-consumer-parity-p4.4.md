# 消费者面一致性（Consumer Parity）— P4.4 全面 OOP 化 + deps 升最新 + biomejs + 三段结案 + PAP 移除 Implementation Plan

**Spec:** [2026-09-21-consumer-parity-p4.4-design.md](docs/osuperpowers/specs/2026-09-21-consumer-parity-p4.4-design.md)
- **Parent program**: [consumer-parity overall v1.42](docs/osuperpowers/specs/2026-09-21-consumer-parity-overall.md)
- **Version**: v1.0 · 2026-09-25
- **Base**: develop
- **Depends on**: P4.3（shipped · [p4.3-design v1.7](docs/osuperpowers/specs/2026-09-21-consumer-parity-p4.3-design.md)）

## Constraints

### 破坏性变更窗口（breaking allowed）
cdd-engine 0.1.0 基准，P4.2 1.0.0 首次稳定开版前为破口窗口；本 phase breaking 四面全收 changelog = **全面 OOP restructure（engine 导出函数面重排）** · **4 major deps**（execa 9→10 · typescript 5→7 · vitest 3→5 · @types/node 22→26）· **`REVIEW_FIX` 状态词汇新值**（#278 三段结案）· **Pending Acceptance Patch 移除面**（plan.json/skill-anatomy 节点删 · 标签约定出技能文本，#279）。历史终态不回滚。

### 四表纪律
回填 = branch-review 前置义务（backfill-overall 由 orchestration 于 branch-review 前执行）；结构性 mismatch → BLOCK；本 plan 终结态（plan complete）落地后 P4.4 行 Design-spec / Implementation plan 列按 closeout 规则回填（Task 11 收口位）。

### 语言政策
本 plan 中文主源（Strategy B）；SKILL.md / docs / README 英文主源（Strategy A）——skill 文本变更（Task 10）为英文原文面；值 token（phase id / tag / SHA / 路径）中立。

### engine 直调与零过滤
`node packages/cdd-engine/dist/cli.mjs`（`pnpm --filter @oscaner-skills/cdd-engine dev:stub` 材料化；不走 global register）；skills 调用 cdd 输出零过滤（禁 `tail`/`head`/`2>&1 |`/`EXIT=$?`）。

### emit 输入面
skills/ 改动（Task 10）后必须 `pnpm run emit` + `emit:check` 无 drift + 产物重生成。

### 零产物 fixture
engine 测试不得以本仓产物为 fixture（P3 裁决）——三段结案路由 / 载体类化回归用 mkdtemp 自造链。

### 全面 OOP 判定标准（六条）
① 有状态/生命周期/不变量 → 状态类；② 纯计算规则 → 无状态域服务类（零纯函数模块）；③ 裸 `number[]`/裸 `Record` 域接口 = 残面归零；④ 模块级可变状态 = 残面全收 `CddRuntime`；⑤ 转发壳/空壳/中间态 = 缺陷即删；⑥ 只读纯数据收 typed 载体不建空壳 class。

### biome 静态门
Task 2 落地后 pre-commit 触发 `biome check --write`（format autofix + lint 违规拦）零违规，与既有 `pnpm run precommit` 校验链并列；重构全程（Task 3–11）在门下走。

### 死代码即删
空壳、死代码随拆即删（无过渡 shim · 无别名 · 无历史叙述豁免）；frozen 历史 docs（overhaul 族 / 已 shipped plan 与 overall change-history）不动。

## Task Groups

- **Task 3, 4, 5**: engine 域层类化 —— TaskGroup 值对象 · CddRuntime 模块态收编 · 域载体 typed 化（同批 implement/review/fix 一个周期，接口相互耦合）
- **Task 6, 7, 8**: lifecycle 收口 —— 长链入类 + 产物面（RoundContext/ProgressLedger/Handoff/ResidueManager）· 域规则服务类 + 导出面重排 · 三段结案 `REVIEW_FIX`（engine 破坏面同批收口）
- **Task 10, 11**: skills 文本批次 + 收口 —— 五面三段表述 · PAP 移除面 · 裁定迁移/loop 更名 + 全绿/登记/回填（emit 输入面 + plan complete 同批）

### Task 1: 全树 deps 升最新（R7 · TG1 先行）

- **Do**: ① 根 + `packages/cdd-engine` 执行 `pnpm update --latest`：4 major（execa `^9.6.1`→`10.0.1` · vitest `^3.2.7`→`5.0.1` · typescript `^5.9.3`→`7.0.2` · @types/node `^22.20.3`→`26.6.2`）+ 全树 caret floor 刷新（`^0.2`→`^0.2.2` · `^7`→`^7.8.5` · `^3`→`^3.4.2` · `^4`→`^4.7.9` · `^6`→`^6.1.2` 等）② 逐个消化 4 major 破坏面（execa@10 API 删除/破坏面 · vitest@5 配置/API 迁移 · ts@7 编译/类型行为 · @types/node@26 类型面）——engine 测试红改绿 + `tsc` 通过 + 现场 dispatch 实证，**逐项登记** ③ `pnpm --filter @oscaner-skills/cdd-engine test` 全绿 + scripts vitest 全绿 + `pnpm run precommit` 绿 ④ 4 个 dependabot PR（Oscaner/skills #238 execa · #266 typescript · #267 vitest · #268 @types/node，base=develop 已漂移）gh close（superseded by P4.4）⑤ `pnpm install --frozen-lockfile` 绿（lockfile 与依赖面一致）
- **验收**:
  - `pnpm outdated` 零落后（execa 10.0.1 · typescript 7.0.2 · vitest 5.0.1 · @types/node 26.6.2 + 全树 floor 最新，grep/实跑）
  - 4 major 破坏行为逐项实证登记（engine 测试绿 + dispatch 实证 + changelog 登记面）
  - 4 个 dependabot PR 已 closed（gh 断言，superseded by P4.4）
  - `pnpm install --frozen-lockfile` 零 diff；engine/scripts 测试全绿；`pnpm run precommit` 绿

### Task 2: biomejs 全面接入（TG2 · 门先行）

- **Do**: ① `biome.json` 随仓落地：`recommended` ruleset + formatter；覆盖 **src + scripts + 全仓 ts 面**（含 engine `__tests__` 与 scripts `__tests__`）② root `package.json` 增 biome 脚本 + husky pre-commit 钩子增 `biome check --write`（format autofix + lint 违规=门，与既有 `pnpm run precommit` 校验链并列）③ 首轮 `biome check --write` 收敛全仓格式（零手工风格债）④ 自本 task 起 commit 前零违规常态（Task 3–11 全程在门下）
- **验收**:
  - `biome.json` 随仓发布（grep）+ husky pre-commit 触发 `biome check --write`（pre-commit 输出断言）
  - 全仓 ts 面 `biome check` 零违规（Task 11 复核断言）；lint 配置随仓（消费者面可复现）
  - 门先行实证：Task 3+ 的 commit 均在 biome 门下（pre-commit 链含 biome 步）

### Task 3: TaskGroup 类化 + 五签名统一（TG3）

- **Do**: ① `cli/shared.ts:84 parseTaskList()` + `handoff/naming.ts:37 tasksKey()` 双标量 → **`class TaskGroup`**（静态工厂 `TaskGroup.fromTokens` · 校验（逐 token 整数 · 去重 · 排序）· `key()` · 成员断言方法），落 `src/` 域层 ② **五处历史散点签名统一收 `TaskGroup`**：`--tasks` 解析（TaskListParser 面）· `effectiveGroups`（rules/documents.ts:189-217）· progress ledger key（artifacts/progress.ts `{task}|{group:"1-2"}`）· handoff 文件名（handoff/naming.ts `tasks-{tasks}-review-{round}.json`）· `TaskLifecycle#tasks/#groupKey`（dispatch/task.ts:288-315）——零 `number[]`/裸串域接口穿行 ③ doc-contract / brief 抽取消费面同步（engine 测试绿）④ `cli-shape.test.ts` / `schema.test.ts` 随破坏面改造（`parse` 静态可导入零副作用面：类静态入口保持或随改造重定义，允许 breaking）
- **验收**:
  - `TaskGroup` 类化五签名统一实证（progress/handoff/task 各面签名收 `TaskGroup`，sweep 零 `number[]` 域接口穿行）
  - 类能力五枚举落地（静态工厂 `fromTokens` · 校验去重 · 排序 · `key()` · 成员断言）——与 spec §2.2 互补对照
  - `--tasks 1` / `--tasks 1,2` dispatch 行为与 P4.3 等价（engine 测试 + 现场回归）；`parse` 静态导入约束处置明确

### Task 4: CddRuntime 模块态收编（TG3）

- **Do**: ① **`class CddRuntime`** 收编五个模块级可变态——`dryRun`/`DRY_RUN()`/`setDryRun()`（cli/shared.ts:18-24）· `_root` 单例（infra/root.ts:16-31）· proc 全局 `registry/diskPath/idleTimer`（infra/proc.ts:330-332）· `signalExitCode`（bin.ts:54）· memo `cacheProfileValidator`（infra/registry.ts:98）② **构造注入**（engine 测试经替身注入实证；scripts 面同款可测）③ solo 模块级可变态（`let` 声明）面归零（sweep 实证）；proc 生命周期收进类封装
- **验收**:
  - 五个可变态全收 `CddRuntime`（sweep 零模块级 `let` 可变态面）
  - 构造注入替身测试绿（engine 测试注入 `CddRuntime` 替身实证 dryRun/root/proc 均经类面）
  - `CddRuntime` 为唯一可变态面（域接口经类传递）

### Task 5: 域载体 typed 化（TG3）

- **Do**: ① would-be 纯数据载体收 **typed 载体**（纯只读保持 interface/type，**不建空壳 class**——判定标准⑥）：`TaskDispatchContext`/`TaskRunOptions`（task.ts:161/241）· `DispatchContext`/`DispatchLifecycleOptions`（base.ts:43/58）· `ReviewOpts`/`FixOpts`（cli/review.ts:20 · cli/fix.ts:13）· `ProgressData`/`TaskLedgerRow`/`LedgerKey`（progress.ts:25-42）· `HandoffParams`（naming.ts:24）· `TaskStatusRow`/`PlanVerdict`（status.ts:114）· `WipStat`（git.ts:195）② 裸 `Record<string, unknown>` handoff 读取面 → typed 载体（16-prop `task-handoff-schema.json` 校验仍留 engine schema 面、**不做第二执法实现**）③ `cli/parse.ts` 组合根静态可导入、零副作用约束保持（cli-shape/schema 测试随破坏面改造）
- **验收**:
  - 域接口零裸 `Record` 穿行（grep/sweep 实证）
  - 零空壳 class（代码评审实证：typed 载体无空方法壳）
  - handoff schema 校验仍在 schema 面（无双实现实证）

### Task 6: lifecycle 收口 —— 长链入类 + 产物面（TG4）

- **Do**: ① 长链 `runReview`（cli/review.ts:76-226）· `runFix`（cli/fix.ts:23-120）· `buildCtx`（task.ts:122-158）主体逻辑迁入 `DispatchLifecycle`/`TaskLifecycle` 类步骤（与既有 template-method pre-flight/dispatch/post-flight 同构）；`cli/*.ts` 退化为**组合根**（argv 解析 + 构造 + dispatch + 出口）——**无转发壳**（判定标准⑤）② **`RoundContext`** 类（round 基准 · base token · 轮次锚；审阅轮次唯一上下文）③ **`ProgressLedger`** 类（六 key 账本 · `rowFor/entryFor` 单源 + 写入不变量）④ **`Handoff`** typed 载体类（构建/命名/落盘/终态化；schema 校验归 schema 面）⑤ **`ResidueManager`** 类（residue 检测/结算/恢复状态机；`RecoveryInfo/DeadCarrierRead/ResidueAppendixInput` 收编）⑥ engine 测试随类化同步改造（breaking 允许）
- **验收**:
  - 长链主体逻辑入类（`cli/*.ts` 组合根实证 · 无转发壳）
  - `RoundContext`/`ProgressLedger`/`Handoff`/`ResidueManager` 类落地 + 测试绿
  - progress 六 key + `rowFor/entryFor` 单源不变量保持；handoff 命名/finalize 行为经类面等价（engine 测试）

### Task 7: 域规则服务类 + 导出面重排（TG4）

- **Do**: ① 纯函数 rules 模块 → **无状态域服务类**（方法即规则 · 协同对象构造注入）：`ConvergenceChecker`（rules/convergence.ts）· `FailureResolver`（rules/failure.ts）· `StatusJudge`（rules/status.ts）· `CloseoutChecker`（rules/closeout.ts）· `DocumentsValidator`（rules/documents.ts）· `TaskListParser`（cli/shared.ts parse 面）· **`BriefRenderer`**（render/brief.ts `generateBrief` 类化 → `BriefRenderer#render`，构造注入文件/git 判据）② engine 导出函数面随类化重排（`runTask` → `TaskLifecycle.run` · `runDocsTask` → `DocsLifecycle.run` · `generateBrief` → `BriefRenderer#render` · `buildCtx`/`parseTaskList` → 类公共面）——**无薄壳转发保红线**（判定标准⑤）③ engine 测试套件随导出面改造（breaking 允许）④ docContractValidate 四表/结构抽取行为经类化后不变（engine 套件覆盖）
- **验收**:
  - 域规则服务类全落地（grep 零独立纯函数导出模块；rules/ 与 parse/brief 面无裸函数导出）
  - `BriefRenderer` 化实证（`generateBrief` 公开面 → `#render` 方法；test 面改消费类实例）
  - 导出函数面破坏性重排到位 + engine 测试全绿；docContractValidate 行为无损（四表/结构断言）

### Task 8: 三段结案 `REVIEW_FIX`（TG4 · #278）

- **Do**: ① `finalize.ts` 状态派生族（`classifySeverity`/`rollupStatus`/`deriveReviewStatus` 单一 owner）产出**第三状态值**——blocker>0 → `CHANGES_REQUESTED` · blocker=0∧warn/nit>0 → **`REVIEW_FIX`（收口态）** · 零 → `APPROVED` ② `rules/status.ts` `deriveTaskState`：`REVIEW_FIX`（收口态）→ **fix 轮路由 → complete**（与 S1 needs-fix→needs-re-review 区分 · **无 re-review**）；S3 零 finding → `APPROVED` → complete（fast path 不变）③ fix dispatch 对收口态放行（与 needs-fix 同 gate）——**fix 行为零改动**（无 per-finding disposition 新机制 · 无 tag 过滤，当前 task 有 findings 即修全）④ handoff docs+task schema `status` enum 增 `REVIEW_FIX` ⑤ engine 测试自造链（mkdtemp）：S1 blocker 循环回归 · S2 收口态 → `cdd fix --findings` → complete 无 re-review · S3 零 finding fast path ⑥ stdout status 行呈现收口态（调度结果可见性）
- **验收**:
  - 状态词汇三值实证（handoff `status` enum 含 `REVIEW_FIX` · `finalize` 三值产出 · `deriveTaskState` 路由：S2 收口态 → fix 轮 complete 无 re-review、S3 零 finding 直通）
  - S2 复用现有 `cdd fix --findings`、零 per-finding behavior、零 tag 过滤（当前 task 有 findings 即修全）
  - 历史终态不回滚（旧 `APPROVED`+findings → complete 终态保留）
  - breaking 登记：`REVIEW_FIX` 词汇新值入 changelog、1.0.0 收口就绪

### Task 9: scripts 编排类化（TG5）

- **Do**: ① `run.ts` citty 命令树（`mainCommand` + 7 子命令 + `invocationArgs` 契约表，scripts/run.ts:49-93）→ **`Command` 类族**（装配 + invoke + meta）；命令文件 = 组合根，非转发壳 ② validate `steps: StepDescriptor[]`（11 块，runner.ts:20-27）→ **`ValidateBlock` 类族** + `ValidateRunner`（单循环）；**11 步名/序/`grepTargets`/`channelTargets` 域事实字节保持**（`ci-validate.test.mjs:171` 钉死面不因类化漂移——若 class 化揭示 legacy 步名则当场改名 + 守卫同域演化）③ `scripts/lib` 纯工具（version-utils · doc-root · marketplace-utils · observe-cache）+ emit 编排面 → 无状态域服务类
- **验收**:
  - `Command` 类族 + `ValidateBlock` 类族落地；`scripts/__tests__/run.test.ts` 命令树断言同域对齐
  - 11 步域事实保持（`ci-validate.test.mjs` 断言全绿，或同域演化后对齐）
  - scripts vitest 全绿（228+ 用例随类化零回归）

### Task 10: skills 文本批次 —— 五面三段表述 + PAP 移除面 + 裁定迁移/loop 更名（TG6）

- **Do**: ① **五面 Review Convergence 三段表述**（writing-single-spec I1 · writing-overall-spec I1 · writing-phase-spec I1 · writing-plans I1 · cli-driven-development I3 的 Review Convergence 行 + review/fix 节点路径；`REVIEW_FIX` 同名入文本；语义 = S1 blocker>0 → fix 后 re-review · S2 blocker=0∧warn/nit>0 → fix 收口轮、无 re-review · S3 零 finding → 批准收敛）② **Pending Acceptance Patch 移除面**：`writing-plans` 删 `## Pending Acceptance Patch` 条件节（finding-tag 约定 · zone shape · Task 14 样例）· I3 改述（题名去 `(Pending Acceptance)` · 删 zone-write/tag 收编/patch-bullet 机制句 · authority 句改写「跨 task 裁决（用户裁决 / phase 级 re-scope）由 orchestrator 以 Plan Sole Writer **直写目标 task 的 Do 与验收**；fix/implement agents 零 plan 修改权」）· fix 节点 tag 句删；`cli-driven-development` **I6 整条删** · fix 节点「LATER task tag」句删 · I7 改指 Plan Sole Writer ③ **裁定迁移 + loop 更名**：`writing-plans` 文本（author-plan 内 **非交互**裁定分组落盘「Task Groups」节 + plan `taskGroups` 声明 · 无 AskUserQuestion · 零分组无节）· `cli-driven-development` 移除 `adjudicate-task-groups` 节点与定义 + `task-groups-undecided` 终端（`C → D` 直连）· **loop 更名 `group-implement-review-fix`**（`implement-group` / `run-group-review` / `fix-group` 节点名 · `more-groups?` 保留 · 组列表自 plan 记录读取）④ schema 面：`plan.json` 删 `pendingAcceptancePatch` 节点 · `skill-anatomy.json` 条件节注册表删条目（zone 描述 · `- **Task N (patch)**:` 样例 pattern · `### Task N:` 样heading）+ **growth 注册表删 cli-driven-development 越界条目**（移除后 13 节点/17 边落回边界内）⑤ engine `documents.test.ts` / `schema.test.ts` 断言随删 ⑥ `pnpm run emit` + 产物重生成 + `emit:check` 无 drift（frozen 历史 docs 保留）
- **验收**:
  - 五面文本三段表述同形（grep `REVIEW_FIX` × 五件 + 措辞核对）；`emit:check` 无 drift
  - PAP 移除面零活残留（zone / `accepts pending-acceptance-patch` / `targets later task` / `## Pending Acceptance Patch` heading 零活面 grep（frozen 豁免）· plan.json 无 `pendingAcceptancePatch` 节点 · skill-anatomy 注册表无该条件节 · cli-development 无 I6 且 I7 改指 Plan Sole Writer · 两 SKILL.md fix 节点 tag 句删 · engine tests 断言随删 · growth 注册表无 cli-development 越界条目）
  - 裁定迁移实证（writing-plans 无 AskUserQuestion 且含 authoring 期裁定落盘语义 · cli-development digraph 无 `adjudicate-task-groups` / 无 `task-groups-undecided` · `C → D` 直连 · 节点更名 group-*（`implement-group` / `run-group-review` / `fix-group`）· `more-groups?` 保留）
  - 零白绿：digraph-consistency 断言（双向完备/同构/growth）全绿

### Task 11: 收口 —— validate 全绿 · breaking 登记 · overall 回填 · changeset（TG6）

- **Do**: ① `pnpm run validate` 11 块全绿（emit freshness · osuperpowers 树/wiring · engine dev-stub + 套件 · engine 零残面 + channel audit · marketplace · scripts unit · version-sync）② **破坏面 changelog 登记就绪**（cdd-engine breaking 四面：OOP restructure · 4 major deps · `REVIEW_FIX` 词汇 · PAP 移除面；osuperpowers：skills 文本变更——1.0.0 收口就绪）③ changeset 落盘（`pnpm run changeset`：cdd-engine major · osuperpowers feature/docs）④ **plan complete 后四表回填**（backfill-overall —— branch-review 前置义务）：P4.4 行 Design-spec 列 → `[p4.4-design v1.8](…)` · Implementation plan 列 → `Done` · change-history v-bump + closeout claim（`Pending → Done`）⑤ 零残面 sweep（域接口零裸标量/裸 Record · 零模块级可变态 · 零转发壳 · 零空壳 class）⑥ `biome check` 全仓零违规复核（Task 2 门终态确认）
- **验收**:
  - `pnpm run validate` 11 块全绿 · `emit:check` 无 drift
  - changeset 存在（cdd-engine major breaking · osuperpowers 变更面归属清晰）
  - 破坏面登记 changelog（1.0.0 收口就绪）
  - P4.4 行四表回填实证（Design-spec link · Implementation plan `Done` · change-history claim 双向一致）
  - 零残面 sweep 全绿 + biome 全仓零违规复核通过