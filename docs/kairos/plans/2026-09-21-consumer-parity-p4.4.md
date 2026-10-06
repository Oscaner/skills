# 消费者面一致性（Consumer Parity）— P4.4 全面 OOP 化 + deps 升最新 + biomejs + 三段结案 + PAP 移除 Implementation Plan

**Spec:** [2026-09-21-consumer-parity-p4.4-design.md](docs/kairos/specs/2026-09-21-consumer-parity-p4.4-design.md)
- **Parent program**: [consumer-parity overall v1.42](docs/kairos/specs/2026-09-21-consumer-parity-overall.md)
- **Version**: v1.5 · 2026-09-25（Task 3 升维：TaskGroup 规范序列化 `"1,2"` · 命名面六统一 · 契约 token 面收敛（DISPATCH_UNIT 等）· 描述面全同步——2026-09-25 用户裁决）
- **Base**: develop
- **Depends on**: P4.3（shipped · [p4.3-design v1.7](docs/kairos/specs/2026-09-21-consumer-parity-p4.3-design.md)）

- **Interface 转录注记**: 各任务 `- **Consumes**: 刻意留空（树迁移 B 转录决策）——源 Do 散文未承载独立具名输入事实，consumes（Task 记录 interface 可选项）不填充；任务输入由 DependsOn/AtomicWith 声明边与 objective/steps 承载，consumer-parity p1–p4.1 因承接具名输入事实而全量填充。

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


### Task 1: 全树 deps 升最新（R7 · TG1 先行）

- **Objective**: 全树 deps 升最新（R7 · TG1 先行）：4 major（execa/vitest/typescript/@types/node）+ 全树 caret floor 刷新 + dependabot PR close

- **Produces**: 全树 deps latest（execa 10.0.1 · typescript 7.0.2 · vitest 5.0.1 · @types/node 26.6.2 + caret floor）；4 major 破坏面逐项消化登记；4 个 dependabot PR closed；frozen-lockfile 零 diff

- **Files**: package.json, packages/cdd-engine/package.json, pnpm-lock.yaml

- **Steps**:
  1. ① 根 + `packages/cdd-engine` 执行 `pnpm update --latest`：4 major（execa `^9.6.1`→`10.0.1` · vitest `^3.2.7`→`5.0.1` · typescript `^5.9.3`→`7.0.2` · @types/node `^22.20.3`→`26.6.2`）+ 全树 caret floor 刷新 — checkable: `pnpm outdated` 零落后（execa 10.0.1 · typescript 7.0.2 · vitest 5.0.1 · @types/node 26.6.2 + 全树 floor 最新，grep/实跑）
  2. ② 逐个消化 4 major 破坏面（execa@10 API 删除/破坏面 · vitest@5 配置/API 迁移 · ts@7 编译/类型行为 · @types/node@26 类型面）——engine 测试红改绿 + `tsc` 通过 + 现场 dispatch 实证，**逐项登记** — checkable: 4 major 破坏行为逐项实证登记（engine 测试绿 + dispatch 实证 + changelog 登记面）
  3. ③ `pnpm --filter @oscaner-skills/cdd-engine test` 全绿 + scripts vitest 全绿 + `pnpm run precommit` 绿；④ 4 个 dependabot PR（#238 execa · #266 typescript · #267 vitest · #268 @types/node）gh close（superseded by P4.4）；⑤ `pnpm install --frozen-lockfile` 绿 — checkable: 4 个 dependabot PR 已 closed（gh 断言）；`pnpm install --frozen-lockfile` 零 diff；engine/scripts 测试全绿；`pnpm run precommit` 绿

- **Acceptance**:
  - `pnpm outdated` 零落后（execa 10.0.1 · typescript 7.0.2 · vitest 5.0.1 · @types/node 26.6.2 + 全树 floor 最新，grep/实跑）
  - 4 major 破坏行为逐项实证登记（engine 测试绿 + dispatch 实证 + changelog 登记面）
  - 4 个 dependabot PR 已 closed（gh 断言，superseded by P4.4）
  - `pnpm install --frozen-lockfile` 零 diff；engine/scripts 测试全绿；`pnpm run precommit` 绿


### Task 2: biomejs 全面接入（TG2 · 门先行）

- **Objective**: biomejs 全面接入（TG2 · 门先行）：biome.json 随仓 + husky biome check + 首轮收敛

- **Produces**: `biome.json`（recommended ruleset + formatter，覆盖 src + scripts + 全仓 ts 面）；root biome script + husky pre-commit `biome check --write`；首轮格式收敛（零手工风格债）；自本 task 起 commit 前零违规常态

- **Files**: biome.json, package.json, .husky/pre-commit

- **Steps**:
  1. ① `biome.json` 随仓落地：`recommended` ruleset + formatter；覆盖 **src + scripts + 全仓 ts 面**（含 engine __tests__ 与 scripts __tests__）；② root `package.json` 增 biome 脚本 + husky pre-commit 钩子增 `biome check --write`（format autofix + lint 违规=门，与既有 `pnpm run precommit` 校验链并列） — checkable: `biome.json` 随仓发布（grep）+ husky pre-commit 触发 `biome check --write`（pre-commit 输出断言）
  2. ③ 首轮 `biome check --write` 收敛全仓格式（零手工风格债）；④ 自本 task 起 commit 前零违规常态（Task 3–11 全程在门下） — checkable: 全仓 ts 面 `biome check` 零违规（Task 11 复核断言）；lint 配置随仓（消费者面可复现）；门先行实证（Task 3+ 的 commit 均在 biome 门下）

- **Acceptance**:
  - `biome.json` 随仓发布（grep）+ husky pre-commit 触发 `biome check --write`（pre-commit 输出断言）
  - 全仓 ts 面 `biome check` 零违规（Task 11 复核断言）；lint 配置随仓（消费者面可复现）
  - 门先行实证：Task 3+ 的 commit 均在 biome 门下（pre-commit 链含 biome 步）


### Task 3: TaskGroup 组身份统一 —— 规范序列化 `"1,2"` · 命名面六统一 · 契约 token 面收敛（TG3）

- **Objective**: TaskGroup 组身份统一 — 规范序列化 `"1,2"` · 命名面六统一 · 契约 token 面收敛（TG3）

- **Produces**: `class TaskGroup` 值对象（fromTokens/fromNumbers · key() 规范序列化 · GROUP_KEY_PATTERN 单源）；五签名统一 + 六命名面 `tasks-1,2-*`；`tasksKey()` 删除；roundPattern 扫描正则单源化；契约 token 面（DISPATCH_UNIT/BRIEF/FINDINGS/FIXED_POINT/CONSTRAINTS/WORKSPACE/DOC 塌缩）；描述/注释面全同步；`--tasks 1-2` 连字符 exit 2

- **Files**: packages/cdd-engine/src/domain/task-group.ts, packages/cdd-engine/src/cli/shared.ts, packages/cdd-engine/src/rules/documents.ts, packages/cdd-engine/src/artifacts/progress.ts, packages/cdd-engine/config/template-contract.json, packages/cdd-engine/templates/engine-config.json, packages/cdd-engine/src/dispatch/task.ts, packages/cdd-engine/src/dispatch/branch.ts, packages/cdd-engine/src/artifacts/handoff/naming.ts, packages/cdd-engine/src/render/brief.ts, packages/cdd-engine/src/rules/status.ts, packages/cdd-engine/src/render/templates.ts, packages/cdd-engine/src/artifacts/handoff/finalize.ts

- **Steps**:
  1. ① **`class TaskGroup`** 值对象（落 `src/` 域层）：静态工厂 `fromTokens` / `fromNumbers` · **`key()` = 规范序列化**（comma-joined 无空格 · 单例 `"1"` · 合并组 `"1,2"`——全仓唯一组身份）· 成员断言方法 · **键文法单源 `GROUP_KEY_PATTERN`**（`\d+(?:,\d+)*`） — checkable: `TaskGroup#key()` 规范序列化 `"1,2"` 单源实证：旧 `tasks-1-2-*` 六个命名面 + `1-2` 组键形零活残留（grep）；六面全 `tasks-1,2-*` 断言
  2. ② **五签名统一 + 六命名面**：`--tasks` 解析 · effectiveGroups（rules/documents.ts）· progress ledger key（`{task}|{group:"1,2"}`）· handoff 文件名（`tasks-{tasks}-*`）· `TaskLifecycle#tasks/#groupKey` · **命名面六统一**（brief / implement·review·fix handoff / report/evidence → 全 `tasks-1,2-*`）；**删除 `tasksKey()`（名实双清）**④ **契约 token 面（template-contract.json）**：`TASK_NUMBER/TASK_BRIEF/TASK_FINDINGS/TASK_FIXED_POINT/TASK_CONSTRAINTS/TASK_WORKSPACE/DOCS_DOC/DOCS_FINDINGS/DOCS_FIXED_POINT` 塌缩为 **DISPATCH_UNIT** · **BRIEF** · **FINDINGS** · **FIXED_POINT** · **CONSTRAINTS** · **WORKSPACE** · **DOC**（保留 HANDOFF_TARGET / HANDOFF_WRITE_GATE / MODE / REVIEW_TYPE / REVIEW_REFERENCE / REVIEW_AXES / REVIEW_LENS_GUIDE / REVIEW_PLAN_LINE / RETURN_FORMAT） — checkable: 契约 token 面更名落地（templates templates tokens[] 无 `TASK_*`/`DOCS_*` 旧名 · shell clause #1/#3/#7 + 描述面同步 · clause #7 evidence 命名与引擎实读同字节）
  3. ③ **roundPattern 扫描正则单源化**：naming.ts 硬编码 `\d+(?:-\d+)*` → 从 `TaskGroup.GROUP_KEY_PATTERN` 派生；⑤ **描述/注释面全同步**（契约 shell clause 符号枚举改新名 · 源码注释 8 处换新形——`1-2` 组键字面零活残留）；⑥ **breaking/残面面**：`--tasks 1-2` 连字符形非法（token 非整数 → exit 2）· residue/channel-audit 命名 token 同步 · 全 token 更名 + 键形变入 breaking 桶 — checkable: 键文法单源实证（`GROUP_KEY_PATTERN` 被 roundPattern 消费 · 零硬编码扫描正则）；`--tasks 1-2` exit 2（parse 测试断言）；描述/注释面零旧 token 旧键字样；有效分区 == 全 task 号集覆盖断言（guard 不变）；breaking 登记 changelog

- **AtomicWith**: 4, 5

- **Acceptance**:
  - `TaskGroup#key()` 规范序列化 `"1,2"` 单源实证：旧 `tasks-1-2-*` 六个命名面 + `1-2` 组键形零活残留（grep（frozen 豁免）· 六面全 `tasks-1,2-*` 断言）
  - 契约 token 面更名落地（template-contract.json tokens[] 无 `TASK_*`/`DOCS_*` 旧名 · shell clause #1/#3/#7 + 描述面同步 · clause #7 evidence 命名与引擎实读同字节）· 描述/注释面零旧 token 旧键字样（源码注释 + 契约描述 grep）
  - 键文法单源实证（`GROUP_KEY_PATTERN` 被 roundPattern 消费 · 零硬编码扫描正则）；`--tasks 1-2` exit 2（parse 测试断言）
  - 有效分区 == 全 task 号集覆盖断言（engine 测试，guard 不变）；bin 入口 argv 契约（`--tasks` / `--type` / `--plan` / `--findings`）字面保持
  - `cli-shape` / `schema` / `templates.*` / `runner` 消费测试同改为新 token；engine 套件全绿；breaking 登记 changelog


### Task 4: CddRuntime 模块态收编（TG3）

- **Objective**: CddRuntime 模块态收编（TG3）：模块级可变态全收 + 构造注入实证

- **Produces**: `class CddRuntime`（dryRun/DRY_RUN/setDryRun · `_root` 单例 · proc 全局 registry/diskPath/idleTimer · signalExitCode · cacheProfileValidator memo · templateContract CACHE）；模块级可变态（let 声明）面归零；构造注入替身测试

- **Files**: packages/cdd-engine/src/cli/shared.ts, packages/cdd-engine/src/infra/root.ts, packages/cdd-engine/src/infra/proc.ts, packages/cdd-engine/src/cli/bin.ts, packages/cdd-engine/src/infra/registry.ts, packages/cdd-engine/src/render/templates.ts, packages/cdd-engine/src/infra/__tests__/（CddRuntime 注入测试）

- **Steps**:
  1. **`class CddRuntime`** 收编模块级可变态——`dryRun`/`DRY_RUN()`/`setDryRun()`（cli/shared.ts）· `_root` 单例（infra/root.ts）· proc 全局 `registry/diskPath/idleTimer`（infra/proc.ts）· `signalExitCode`（bin.ts）· memo `cacheProfileValidator`（infra/registry.ts）· memo `templateContract` 缓存（render/templates.ts 模块级 CACHE 态随 TemplateLoader 类化迁入（Task 7 ①）） — checkable: 模块级可变态全收 `CddRuntime`（sweep 零模块级 `let` 可变态面 · 含 templates CACHE 迁入）
  2. **构造注入**（engine 测试经替身注入实证；scripts 面同款可测）；solo 模块级可变态（`let` 声明）面归零（sweep 实证）；proc 生命周期收进类封装 — checkable: 构造注入替身测试绿（engine 测试注入 `CddRuntime` 替身实证 dryRun/root/proc 均经类面）；`CddRuntime` 为唯一可变态面

- **AtomicWith**: 3, 5

- **Acceptance**:
  - 模块级可变态全收 `CddRuntime`（sweep 零模块级 `let` 可变态面 · 含 templates CACHE 迁入）
  - 构造注入替身测试绿（engine 测试注入 `CddRuntime` 替身实证 dryRun/root/proc 均经类面）
  - `CddRuntime` 为唯一可变态面（域接口经类传递）


### Task 5: 域载体 typed 化（TG3）

- **Objective**: 域载体 typed 化（TG3）：would-be 纯数据载体收 typed 载体 + 裸 Record 面零回归

- **Produces**: typed 载体化：TaskDispatchContext/TaskRunOptions · DispatchContext/DispatchLifecycleOptions · ReviewOpts/FixOpts · ProgressData/TaskLedgerRow/LedgerKey · HandoffParams · TaskStatusRow/PlanVerdict · WipStat；裸 Record handoff 读取面 → typed（schema 校验仍留 engine schema 面）；零空壳 class

- **Files**: packages/cdd-engine/src/dispatch/task.ts, packages/cdd-engine/src/dispatch/base.ts, packages/cdd-engine/src/cli/review.ts, packages/cdd-engine/src/cli/fix.ts, packages/cdd-engine/src/artifacts/progress.ts, packages/cdd-engine/src/artifacts/handoff/naming.ts, packages/cdd-engine/src/rules/status.ts, packages/cdd-engine/src/infra/git.ts

- **Steps**:
  1. would-be 纯数据载体收 **typed 载体**（纯只读保持 interface/type，**不建空壳 class**——判定标准⑥）：`TaskDispatchContext`/`TaskRunOptions` · `DispatchContext`/`DispatchLifecycleOptions` · `ReviewOpts`/`FixOpts` · `ProgressData`/`TaskLedgerRow`/`LedgerKey` · `HandoffParams` · `TaskStatusRow`/`PlanVerdict` · `WipStat` — checkable: 域接口零裸 `Record` 穿行（grep/sweep 实证）
  2. ② 裸 `Record<string, unknown>` handoff 读取面 → typed 载体（16-prop task-handoff-schema 校验仍留 engine schema 面、**不做第二执法实现**）；③ `cli/parse.ts` 组合根静态可导入、零副作用约束保持 — checkable: 零空壳 class（代码评审实证：typed 载体无空方法壳）；handoff schema 校验仍在 schema 面（无双实现实证）

- **AtomicWith**: 3, 4

- **Acceptance**:
  - 域接口零裸 `Record` 穿行（grep/sweep 实证）
  - 零空壳 class（代码评审实证：typed 载体无空方法壳）
  - handoff schema 校验仍在 schema 面（无双实现实证）


### Task 6: lifecycle 收口 —— 类化补全 + 产物面（TG4）

- **Objective**: lifecycle 收口 — 类化补全 + 产物面（TG4）：buildCtx 入类 + branch 薄壳并入组合根 + RoundContext/ProgressLedger/Handoff/ResidueManager 类

- **Produces**: `buildCtx` 迁入 `TaskLifecycle` 类公共面；branch 族薄壳并入 review/fix 组合根（`cli/branch-review.ts` / `cli/branch-fix.ts` 删除）；`RoundContext` · `ProgressLedger`（六 key 单源不变量）· `Handoff`（typed 载体类）· `ResidueManager` 类落地

- **Files**: packages/cdd-engine/src/dispatch/task.ts, packages/cdd-engine/src/cli/review.ts, packages/cdd-engine/src/cli/fix.ts, packages/cdd-engine/src/cli/branch-review.ts, packages/cdd-engine/src/cli/branch-fix.ts, packages/cdd-engine/src/dispatch/branch.ts, packages/cdd-engine/src/domain/round-context.ts, packages/cdd-engine/src/artifacts/progress.ts, packages/cdd-engine/src/artifacts/handoff/handoff.ts, packages/cdd-engine/src/artifacts/residue.ts

- **Steps**:
  1. `buildCtx`（task.ts）迁入 `TaskLifecycle` 类公共面（ctx 装配随类构造经注入接管）+ branch 族薄壳**并入组合根**：`runBranchReview` / `runBranchFix` 的 withLifecycle 薄转发逻辑并入 review/fix 组合根 type 路由，**删两文件**（判定标准⑤ · 死代码即删）；`cli/*.ts` 保持组合根（argv 解析 + 构造 + dispatch + 出口）——无转发壳 — checkable: buildCtx 类公共面实证；branch 族薄壳并入组合根实证（`cli/branch-review.ts` / `cli/branch-fix.ts` 删除 · review/fix 组合根覆盖 branch 派发）
  2. ② **`RoundContext`** 类（round 基准 · base token · 轮次锚）；③ **`ProgressLedger`** 类（六 key 账本 · `rowFor/entryFor` 单源 + 写入不变量）；④ **`Handoff`** typed 载体类（构建/命名/落盘/终态化；schema 校验归 schema 面）；⑤ **`ResidueManager`** 类（residue 检测/结算/恢复状态机；`RecoveryInfo/DeadCarrierRead/ResidueAppendixInput` 收编）；⑥ engine 测试随类化同步改造（breaking 允许） — checkable: `RoundContext`/`ProgressLedger`/`Handoff`/`ResidueManager` 类落地 + 测试绿；progress 六 key + rowFor/entryFor 单源不变量保持；handoff 命名/finalize 行为经类面等价

- **AtomicWith**: 7, 8

- **Acceptance**:
  - buildCtx 类公共面实证（裸函数 `buildCtx` → `TaskLifecycle` 类公共方法 · ctx 装配经类面）；`cli/*.ts` 组合根保持回归断言（runReview/runFix 现状 withLifecycle 薄包装不退化 · 无转发壳 · 判定标准⑤）；branch 族薄壳并入组合根实证（`cli/branch-review.ts` / `cli/branch-fix.ts` 删除 · review/fix 组合根 type 路由覆盖 branch 派发）
  - `RoundContext`/`ProgressLedger`/`Handoff`/`ResidueManager` 类落地 + 测试绿
  - progress 六 key + `rowFor/entryFor` 单源不变量保持；handoff 命名/finalize 行为经类面等价（engine 测试）


### Task 7: 域规则服务类 + 导出面重排（TG4）

- **Objective**: 域规则服务类 + 导出面重排（TG4）：纯函数 rules 模块 → 无状态域服务类 + 豁免清单

- **Produces**: 类化：`ConvergenceChecker` · `FailureResolver` · `StatusJudge` · `CloseoutChecker` · `DocumentsValidator` · `CommitChecker` · `HandoffSchemaValidator` · `ChangedSurfaceAuditor` · `TaskListParser` · `BriefRenderer` · `GitClient` · `Registry` · `ConfigLoader` · `EngineInvoker` · `ReturnBlockParser` · `TemplateLoader`；engine 导出函数面破坏性重排；豁免清单八项

- **Files**: packages/cdd-engine/src/rules/（全目录）, packages/cdd-engine/src/render/brief.ts, packages/cdd-engine/src/infra/（git/config/invoke/registry）, packages/cdd-engine/src/artifacts/return-block.ts, packages/cdd-engine/src/render/templates.ts

- **Steps**:
  1. ① 纯函数 rules 模块 → **无状态域服务类**（方法即规则 · 协同对象构造注入）：ConvergenceChecker · FailureResolver · StatusJudge · CloseoutChecker · DocumentsValidator · CommitChecker（双层门判）· HandoffSchemaValidator · ChangedSurfaceAuditor · TaskListParser · BriefRenderer（generateBrief 类化 → #render）· GitClient · Registry · ConfigLoader · EngineInvoker · ReturnBlockParser · TemplateLoader（模块级 CACHE 态迁入 CddRuntime） — checkable: 域规则服务类全落地 + infra 面类化实证：**执法集**内 ts 面零独立纯函数导出模块（rules/ 全目录收敛 · parse/brief · infra config/invoke/registry/git · return-block · render/templates 均无裸函数导出）
  2. ② engine 导出函数面随类化重排（`runTask` → `TaskLifecycle.run` · `runDocsTask` → `DocsLifecycle.run` · `generateBrief` → `BriefRenderer#render`）——**无薄壳转发保红线**（判定标准⑤）；③ engine 测试套件随导出面改造；④ docContractValidate 四表/结构抽取行为经类化后不变 — checkable: `BriefRenderer` 化实证（generateBrief 公开面 → #render 方法）；导出函数面破坏性重排到位 + engine 测试全绿；docContractValidate 行为无损；argv 契约面回归（--tasks/--type/--plan/--findings 经 bin 入口现场 dispatch 实证零回归）
  3. **命名豁免清单**（infra 原语/运行时工具面——不建单方法空壳 class，不扩表）：infra/exit.ts · infra/log.ts · infra/resource.ts · infra/context.ts · artifacts/hash.ts · documents/tokens.ts · dispatch/hooks.ts · cli/result-face.ts — checkable: 豁免清单八项不扩表（新增豁免须经 review 裁定）；spec §2.1「零模块级裸函数模块」口径按执法集 + 豁免清单落定

- **AtomicWith**: 6, 8

- **Acceptance**:
  - 域规则服务类全落地 + infra 面类化实证（`GitClient`/`Registry`/`ConfigLoader`/`EngineInvoker`/`ReturnBlockParser`/`TemplateLoader` 落地）：**执法集**内 ts 面零独立纯函数导出模块——rules/ 全目录收敛（含 commit/schema/write-boundary 随 `CommitChecker`/`HandoffSchemaValidator`/`ChangedSurfaceAuditor` 类化归零）· parse/brief · infra/ 的 config/invoke/registry/git · artifacts/return-block · render/templates 均无裸函数导出；**命名豁免清单**（infra 原语/运行时工具面——非域规则，判定标准② 执法范围为域规则模块；强制类化违反工程常理，不建单方法空壳 class——判定标准⑥）：`infra/exit.ts`（invariant/exitOk/exitWithCode 进程退出原语）· `infra/log.ts`（setLogLevel）· `infra/resource.ts`（resolvePackageRoot）· `infra/context.ts`（loadContract）· `artifacts/hash.ts`（hashFile）· `documents/tokens.ts`（escapeRegExp/deriveDocTokens）· `dispatch/hooks.ts`（createDispatchHooks/registerDispatchPlugin）· `cli/result-face.ts`（docsResultFace）——**不扩表**（新增豁免须经 review 裁定）；spec §2.1「零模块级裸函数模块」口径按执法集 + 豁免清单落定
  - `BriefRenderer` 化实证（`generateBrief` 公开面 → `#render` 方法；test 面改消费类实例）
  - 导出函数面破坏性重排到位 + engine 测试全绿；docContractValidate 行为无损（四表/结构断言）；argv 契约面回归：`--tasks`/`--type`/`--plan`/`--findings` 经 bin 入口现场 dispatch 实证零回归（skills 经 CLI 调用 · spec §2.4 + AC 对应面）


### Task 8: 三段结案 `REVIEW_FIX`（TG4 · #278）

- **Objective**: 三段结案 `REVIEW_FIX`（TG4 · #278）：status 第三值 + deriveTaskState 路由 + fix 收口语义

- **Produces**: `finalize.ts` 状态派生族产出第三状态值 `REVIEW_FIX`（blocker=0∧warn/nit>0 收口态）；`deriveTaskState`：REVIEW_FIX → fix 轮路由 → complete（无 re-review）；S3 零 finding fast path；docs+task schema status enum 增 REVIEW_FIX；fix 行为零改动（无 per-finding disposition）

- **Files**: packages/cdd-engine/src/artifacts/handoff/finalize.ts, packages/cdd-engine/src/rules/status.ts, packages/cdd-engine/templates/schema/task-handoff-schema.json, packages/cdd-engine/templates/schema/docs-handoff-schema.json

- **Steps**:
  1. ① `finalize.ts` 状态派生族产出**第三状态值**——blocker>0 → `CHANGES_REQUESTED` · blocker=0∧warn/nit>0 → **`REVIEW_FIX`（收口态）** · 零 → `APPROVED`；② `rules/status.ts` `deriveTaskState`：`REVIEW_FIX` → **fix 轮路由 → complete**（与 S1 needs-fix→needs-re-review 区分 · **无 re-review**）；S3 零 finding → APPROVED → complete（fast path 不变） — checkable: 状态词汇三值实证（handoff `status` enum 含 REVIEW_FIX · finalize 三值产出 · deriveTaskState 路由：S2 收口态 → fix 轮 complete 无 re-review、S3 零 finding 直通）
  2. ③ fix dispatch 对收口态放行（与 needs-fix 同 gate）——**fix 行为零改动**（无 per-finding disposition 新机制 · 无 tag 过滤）；④ handoff docs+task schema `status` enum 增 `REVIEW_FIX`；⑤ engine 测试自造链（mkdtemp）：S1 blocker 循环回归 · S2 收口态 → `cdd fix --findings` → complete 无 re-review · S3 零 finding fast path；⑥ stdout status 行呈现收口态 — checkable: S2 复用现有 `cdd fix --findings`、零 per-finding behavior、零 tag 过滤；历史终态不回滚（旧 APPROVED+findings → complete 终态保留）；breaking 登记：REVIEW_FIX 词汇新值入 changelog、1.0.0 收口就绪

- **AtomicWith**: 6, 7

- **Acceptance**:
  - 状态词汇三值实证（handoff `status` enum 含 `REVIEW_FIX` · `finalize` 三值产出 · `deriveTaskState` 路由：S2 收口态 → fix 轮 complete 无 re-review、S3 零 finding 直通）
  - S2 复用现有 `cdd fix --findings`、零 per-finding behavior、零 tag 过滤（当前 task 有 findings 即修全）
  - 历史终态不回滚（旧 `APPROVED`+findings → complete 终态保留）
  - breaking 登记：`REVIEW_FIX` 词汇新值入 changelog、1.0.0 收口就绪


### Task 9: scripts 编排类化（TG5）

- **Objective**: scripts 编排类化（TG5）：Command 类族 + ValidateBlock 类族 + run.ts 命令树类化

- **Produces**: `run.ts` citty 命令树 → `Command` 类族（装配 + invoke + meta）+ validate `steps` → `ValidateBlock` 类族 + `ValidateRunner`（单循环）；11 步名/序/域事实字节保持；scripts/lib 纯工具类化

- **Files**: scripts/run.ts, scripts/validate/runner.ts, scripts/validate/_validate/*.ts（step 文件）, scripts/lib/（version-utils · doc-root · marketplace-utils · observe-cache）, scripts/__tests__/run.test.ts

- **Steps**:
  1. ① `run.ts` citty 命令树（mainCommand + 7 子命令 + invocationArgs 契约表）→ **`Command` 类族**（装配 + invoke + meta）；命令文件 = 组合根，非转发壳；② validate `steps: StepDescriptor[]`（11 块）→ **`ValidateBlock` 类族** + `ValidateRunner`（单循环）；**11 步名/序/`grepTargets`/`channelTargets` 域事实字节保持**（ci-validate.test.mjs 钉死面不因类化漂移） — checkable: `Command` 类族 + `ValidateBlock` 类族落地；`scripts/__tests__/run.test.ts` 命令树断言同域对齐；11 步域事实保持（ci-validate.test.mjs 断言全绿）
  2. ③ `scripts/lib` 纯工具（version-utils · doc-root · marketplace-utils · observe-cache）+ emit 编排面 → 无状态域服务类（判定标准②） — checkable: scripts vitest 全绿（228+ 用例随类化零回归）

- **Acceptance**:
  - `Command` 类族 + `ValidateBlock` 类族落地；`scripts/__tests__/run.test.ts` 命令树断言同域对齐
  - 11 步域事实保持（`ci-validate.test.mjs` 断言全绿，或同域演化后对齐）
  - scripts vitest 全绿（228+ 用例随类化零回归）


### Task 10: skills 文本批次 —— 五面三段表述 + PAP 移除面 + 裁定迁移/loop 更名（TG6）

- **Objective**: skills 文本批次 — 五面三段表述 + PAP 移除面 + 裁定迁移/loop 更名（TG6）

- **Produces**: 五面 SKILL.md Review Convergence 三段表述（REVIEW_FIX 同名入文本）；Pending Acceptance Patch 移除面（writing-plans 条件节删 · cli-development I6 删 · I7 改指 Plan Sole Writer）；裁定迁移（writing-plans 非交互落盘 Task Groups 节 + plan taskGroups 声明）+ loop 更名 group-*（去 adjudicate-task-groups）；schema 面（plan.json pendingAcceptancePatch 删 · skill-anatomy 条件节/growth 条目删）；emit 重生成

- **Files**: packages/osuperpowers/skills/writing-single-spec/SKILL.md, packages/osuperpowers/skills/writing-overall-spec/SKILL.md, packages/osuperpowers/skills/writing-phase-spec/SKILL.md, packages/osuperpowers/skills/writing-plans/SKILL.md, packages/osuperpowers/skills/cli-driven-development/SKILL.md, packages/cdd-engine/config/schema/plan.json, packages/cdd-engine/config/schema/skill-anatomy.json, packages/cdd-engine/src/rules/__tests__/documents.test.ts, packages/cdd-engine/src/documents/__tests__/schema.test.ts

- **Steps**:
  1. ① **五面 Review Convergence 三段表述**（REVIEW_FIX 同名入文本；语义 = S1 blocker>0 → fix 后 re-review · S2 blocker=0∧warn/nit>0 → fix 收口轮、无 re-review · S3 零 finding → 批准收敛） — checkable: 五面文本三段表述同形（grep `REVIEW_FIX` × 五件 + 措辞核对）；`emit:check` 无 drift
  2. ② **Pending Acceptance Patch 移除面**：`writing-plans` 删 `## Pending Acceptance Patch` 条件节 · I3 改述（authority 句改写「跨 task 裁决由 orchestrator 以 Plan Sole Writer **直写目标 task 的 Do 与验收**；fix/implement agents 零 plan 修改权」）· fix 节点 tag 句删；`cli-driven-development` **I6 整条删** · fix 节点 tag 句删 · I7 改指 Plan Sole Writer；④ schema 面：`plan.json` 删 `pendingAcceptancePatch` 节点 · `skill-anatomy.json` 条件节注册表删条目 + **growth 注册表删 cli-driven-development 越界条目** — checkable: PAP 移除面零活残留（zone / `accepts pending-acceptance-patch` / `targets later task` / `## Pending Acceptance Patch` heading 零活面 grep · plan.json 无节点 · skill-anatomy 注册表无条件节 · cli-development 无 I6 且 I7 改指 Plan Sole Writer；**跨 task 裁决直写实证**：orchestrator 直写 Do 与 验收 → brief 抽取逐字携带）
  3. ③ **裁定迁移 + loop 更名**：`writing-plans` 文本（author-plan 内**非交互**裁定分组落盘「Task Groups」节 + plan `taskGroups` 声明 · 无 AskUserQuestion · 零分组无节）；`cli-driven-development` 移除 `adjudicate-task-groups` 节点与定义 + `task-groups-undecided` 终端（`C → D` 直连）· **loop 更名 group-***（`implement-group` / `run-group-review` / `fix-group` · `more-groups?` 保留 · 组列表 = 声明合并组 ∪ 未覆盖任务单组） — checkable: 裁定迁移实证（writing-plans 无 AskUserQuestion 且含 authoring 期裁定落盘语义 · cli-development digraph 无 adjudicate-task-groups / 无 task-groups-undecided · `C → D` 直连 · 节点更名 group-* · more-groups? 保留）；零白绿：digraph-consistency 断言全绿

- **AtomicWith**: 11

- **Acceptance**:
  - 五面文本三段表述同形（grep `REVIEW_FIX` × 五件 + 措辞核对）；`emit:check` 无 drift
  - PAP 移除面零活残留（zone / `accepts pending-acceptance-patch` / `targets later task` / `## Pending Acceptance Patch` heading 零活面 grep（frozen 豁免）· plan.json 无 `pendingAcceptancePatch` 节点 · skill-anatomy 注册表无该条件节 · cli-development 无 I6 且 I7 改指 Plan Sole Writer · 两 SKILL.md fix 节点 tag 句删 · engine tests 断言随删 · growth 注册表无 cli-development 越界条目）；**跨 task 裁决直写实证**：orchestrator 直写目标 task 的 **Do** 与 **验收** → brief 抽取逐字携带（行为入 Do · 验证入 验收，spec §2.10 AC 对应面）
  - 裁定迁移实证（writing-plans 无 AskUserQuestion 且含 authoring 期裁定落盘语义 · cli-development digraph 无 `adjudicate-task-groups` / 无 `task-groups-undecided` · `C → D` 直连 · 节点更名 group-*（`implement-group` / `run-group-review` / `fix-group`）· `more-groups?` 保留）
  - 零白绿：digraph-consistency 断言（双向完备/同构/growth）全绿


### Task 11: 收口 —— validate 全绿 · breaking 登记 · overall 回填 · changeset（TG6）

- **Objective**: 收口 — validate 全绿 · breaking 登记 · overall 回填 · changeset（TG6）

- **Produces**: `pnpm run validate` 11 块全绿；破坏面 changelog 登记就绪（cdd-engine breaking 四面 + osuperpowers skills 文本）；changeset 落盘 ×2；plan complete 后四表回填；零残面 sweep + biome 全仓零违规复核

- **Files**: docs/kairos/specs/2026-09-21-consumer-parity-overall.md, .changeset/, packages/cdd-engine/CHANGELOG.md（登记面）

- **Steps**:
  1. ① `pnpm run validate` 11 块全绿（emit freshness · kairos 树/wiring · engine dev-stub + 套件 · engine 零残面 + channel audit · marketplace · scripts unit · version-sync） — checkable: `pnpm run validate` 11 块全绿 · `emit:check` 无 drift
  2. ② **破坏面 changelog 登记就绪**（cdd-engine breaking 四面：OOP restructure · 4 major deps · REVIEW_FIX 词汇 · PAP 移除面；osuperpowers：skills 文本变更）；③ changeset 落盘（cdd-engine major · osuperpowers feature/docs）；④ **plan complete 后四表回填**（backfill-overall——branch-review 前置义务）：P4.4 行 Design-spec 列 → `[p4.4-design v1.8]` link · Implementation plan 列 → `Done` · change-history v-bump + closeout claim — checkable: changeset 存在（cdd-engine major breaking · osuperpowers 变更面归属清晰）；破坏面登记 changelog（1.0.0 收口就绪）；P4.4 行四表回填实证（Design-spec link · Implementation plan Done · change-history claim 双向一致）
  3. ⑤ 零残面 sweep——按 Task 7 验收执法集 + 命名豁免清单口径执行（执法集内零模块级裸函数导出 · 域接口零裸标量/裸 Record · 零模块级可变态 · 零转发壳 · 零空壳 class）；⑥ `biome check` 全仓零违规复核（Task 2 门终态确认） — checkable: 零残面 sweep 全绿 + biome 全仓零违规复核通过

- **AtomicWith**: 10

- **Acceptance**:
  - `pnpm run validate` 11 块全绿 · `emit:check` 无 drift
  - changeset 存在（cdd-engine major breaking · osuperpowers 变更面归属清晰）
  - 破坏面登记 changelog（1.0.0 收口就绪）
  - P4.4 行四表回填实证（Design-spec link · Implementation plan `Done` · change-history claim 双向一致）
  - 零残面 sweep 全绿 + biome 全仓零违规复核通过
