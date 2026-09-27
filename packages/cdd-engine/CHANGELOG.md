# @oscaner-skills/cdd-engine

## 1.0.0

### Major Changes

- [#272](https://github.com/Oscaner/skills/pull/272) [`6bf48a3`](https://github.com/Oscaner/skills/commit/6bf48a35c5a2f1b5f87993757a352ed0162cc1b3) Thanks [@Oscaner](https://github.com/Oscaner)! - P2 consumer-parity breaking 面：harness 契约单源 + 全量 charter 审计 + closeout 统一规则 + `cdd help` + doc-structure schema 单源（breaking = cdd-engine major，随 0.1.0 基线并入 **1.0.0 首次稳定开版**、不起跳 2.0.0；版本化发布动作归 P4.2，本 changeset 定版本面与变更面清单）。
  
  **handoff schema 契约统一（BREAKING）**：
  
  - **docs-handoff 逆转**：`templates/schema/docs-handoff-schema.json` 删除「Docs rounds carry no commits field」显式声明段，增 `commits{base,head}`（与 task-family 同形状：base 全 40 位 SHA `^[0-9a-f]{40}$`、required `[base]`）——docs-family fix 出口门 commit 记账判据由此成立（overall v1.4 known-gap 关闭，同契约束轮次行为确定性：commit → APPROVED；未 commit → BLOCKED + stdout 可见诊断）。
  - **status enum 增 TIMEOUT**：docs-handoff status 由 `[APPROVED, CHANGES_REQUESTED, BLOCKED]` 升级为与 task-family 同枚举 `[APPROVED, BLOCKED, CHANGES_REQUESTED, TIMEOUT]`——lifecycle 核心块统一（breaking：docs 面 status 枚举扩面）。
  - **recovery 核心块统一**：docs-handoff `recovery` 增 `stash_message` + `scope_base`（与 task-family 同载体——`src/artifacts/residue.ts` 单源写入面；docs 缺省语义不变，resume pre-flight 契约同面）。
  - **blocker 单数统一**：两族均只声明单数 `blocker`，无复数 `blockers` 键。
  
  **round-context docs base token**：docs round 增 base 作用点 token（与 task-family `TASK_FIXED_POINT` 同位语义：= dispatch 入口 base）；token 名 / 渲染经 `template-contract.json` round-context zone 单源（canonical）定义并随 schema 消费。
  
  **lifecycle 契约结构升级（BREAKING）**：task / docs / branch 三通道共享**一个 lifecycle 契约**——`docContractValidate`（全量 charter 审计 pre-flight 门：plan/spec/overall 契约 + parent overall 四表 + closeout 结构性面 + 终态欠账硬门）与 `statusValidate`（六态收敛 + plan verdict + 终态欠账 post-flight 高亮）提升为 **base 生命周期默认钩子全通道生效**（lane 仅声明审计对象 / plan 路径）；docs-family 消费面由此获得同一条执法链（整体 breaking 面随本 phase 声明）。
  
  **`cdd help` 子命令**（Non-goal#1 唯一例外）：新增发现型 help——打印 CLI 绝对目录 + 必要文档目录（schemas / templates），零执法逻辑、git 仓库外可用、无生命周期副作用；skills 经此发现通道直取 doc-structure schema 成文（零硬编码路径）。
  
  **doc-structure schema 单源**：canonical doc-structure（overall / plan / phase-spec / add-phase-protocol，draft 2020-12 JSON Schema + descriptions）随包发布（`dist/documents/schema/` 可寻址，`cdd help` 指向）；存量 md 模板（overall-spec-template / phase-spec-template / add-phase-protocol）退役；engine 校验 / 抽取 token 自 canonical 派生（`documents/tokens.ts` 单一派生点——零第二手工 token、repo/skill 侧 md 模板副本全禁）；本仓程序文档链（plan → design → overall）过 engine 新审计路径零误伤（canary dogfood）。
  
  **全量 charter 审计 + closeout 统一规则**（lifecycle 行为面，随上述钩子全通道生效）：lineage 驱动的四表审计（①–⑥ 面）、closeout 声明源 ↔ 列双向全列（forward + reverse，plan + design）+ engine 派生终态并入 + mismatch 单一推断模块（pre-flight 与 post-flight 同源消费）、终态欠账硬门（回填 = branch-review 前置义务）、dry-run CDD_WARN 降级与 exit 语义不变。
  
  > **semver 说明**：handoff schema 结构升级（docs-family `commits{base,head}` 逆转旧「无 commits」声明 + status 增 TIMEOUT + recovery 核心统一）+ round-context 新 base token + lifecycle 契约结构升级（三通道共享默认钩子）+ 新增 `cdd help` 子命令 = **breaking**，按 major 发布。消费者迁移面：docs-family handoff 消费者需接受新核心块字段（同 task-family 契约）；engine 侧行为面（审计 / closeout 门）对既有合法程序文档链零新增失败（四表合法 → 全绿，dogfood 实证）。仓库内部件（`scripts/run.ts validate` 侧 charter 守卫）随 P3 退役、P4.2 发布闭环承载版本化（cdd-engine 1.0.0 首次稳定开版），本 changeset 仅定版本面。

- [#277](https://github.com/Oscaner/skills/pull/277) [`f8b0f41`](https://github.com/Oscaner/skills/commit/f8b0f418cf02672598894a2e2739b5e8f0451d0b) Thanks [@Oscaner](https://github.com/Oscaner)! - P4.3 consumer-parity 宣讲面收口：`--task` → `--tasks` 别名零替换全量完成 + 守卫 fixture 与 consumer-sim 链同步。
  
  **cdd-engine（breaking → major，1.0.0 → 2.0.0）**：
  
  - **`--task` → `--tasks` 全替换零别名（BREAKING）**：dispatch-group 语义下任务派发单位是组（`--tasks <n|n,n,…>`，singleton 组等于原每任务派发）；单数 `--task` 已从 CLI 解析面整删（unknown-option exit 2）。本 changeset 收口最后文档表层：cdd-engine 包 README 族（README.md / README.zh-CN.md 的 implement 表行 + review 选项列举共 4 行）示例迁 `--tasks`，zh-CN mirror 同步。
  - **守卫 fixture 同步**：residue 守卫测试合成 fixture 字面量迁 `--tasks`——retired-`brief` 守卫 argv（`cdd brief --tasks 1 …`，与 cli-shape 退役命令全形断言同构）+ skills 面 `cdd fix` 命令形 fixture，anti-reintroduce 行为断言保留；smoke-cdd consumer-sim fix 链 `--findings` 路径字面量随 Task 2 组命名迁 canonical 形 `tasks-1-review-1.json`（`tasksKey([1])` = `"1"` 派生的 singleton-group handoff 名）。
  
  **osuperpowers（minor，0.1.1 → 0.2.0）**：skills 文本更新——cli-driven-development SKILL.md 面向 dispatch-group 的 `--tasks` 文案面由本 phase 收敛（评审循环 fix 节点命令形 `cdd fix --type task --tasks <n> …`）；consumer-surface purity 归位（CLAUDE.md 铁律）——cli-driven-development SKILL.md 的 `## Full Flow Refactor Rationale` 章节移除、消费面零残留（设计 rationale 迁仓内 maintainer skill-authoring 文档 §9.1 注册表，SKILL.md 不留任何 note/锚），机器断言面同步（digraph-consistency.test.mjs Assertion 3：越界 skill 的 rationale 必须注册在 maintainer 侧 + SKILL.md 零 growth/refactor narrative heading）。
  
  > **semver 说明**：CLI 选项整删/更名（`--task` → `--tasks`）为 breaking，cdd-engine 按 major 发布；消费者迁移面：一切派发命令以 `--tasks <n|n,n,…>` 取代 `--task <n>`，产物名随组键（`tasks-{a}-{b}-*`）不再出现 `task-N-*` 形。

- [#280](https://github.com/Oscaner/skills/pull/280) [`be4432c`](https://github.com/Oscaner/skills/commit/be4432c1900b94540801d5e3293bc8875e8e2e0e) Thanks [@Oscaner](https://github.com/Oscaner)! - P4.4 全树 deps 升最新（cdd-engine major）——4 major 破坏面逐项消化登记：
  
  - **execa 9 → 10（BREAKING 用例面）**：`execaCommand` / `execaCommandSync` 删除（v10 全量改数组式/template literal 调用）；本仓 consumer-sim（`scripts/validate/smoke-cdd.ts`）的 `git rev-parse HEAD` 调用迁 `execaSync("git", ["rev-parse", "HEAD"])`。其余运行时面（`execa`/`execaSync`/`extendEnv`/result `stdout`·`stderr`·`exitCode`·`timedOut`）在 v10 保留，engine 派发链（`spawnManaged` 进程组 + dry-run 五命令链）实证未破坏。
  - **typescript 5 → 7（BREAKING 工具链面）**：TS7 原生（Go）移植不随包发布 JS compiler API——依赖该 API 的工具（unbuild 的 rollup-plugin-dts dts 生成）装载即抛错；修复 = 补装官方兼容包 `@typescript/typescript6`（rollup-plugin-dts 的 fallback 通道），`pnpm build`（真 dts 产物）与 `dev:stub` 恢复。编译/类型行为：native `tsc` 对本仓编译面产出与 5.9 **零新增错误锚点**（684 处 pre-existing 测试文件类型债，升级前后位置集逐位一致）。
  - **vitest 3 → 5（迁移面零变更）**：使用面（`pool: 'forks'` / `globalSetup` / `maxWorkers` / `minWorkers` / `maxConcurrency` / `testTimeout` / `coverage.provider` / `include` 共置 glob）在 v5 全部保留有效；engine 套件（1010）与 scripts 套件（228）原配置全绿，无需迁移。
  - **@types/node 22 → 26（类型面零新增）**：升级前后 `tsc` 错误锚点集合逐位一致，无新增 node 类型面破坏。
  - **全树 caret floor 刷新**：`^0.2`→`^0.2.2`（citty）· `^7`→`^7.8.5`（semver）· `^3`→`^3.4.2`（consola）· `^4`→`^4.7.9`（handlebars）· `^6`→`^6.1.2`（hookable）· `^3.36.0`（simple-git）· `^0.2.17`（tinyglobby）· `^8.20.0`（ajv）；`pnpm outdated` 零落后、`pnpm install --frozen-lockfile` 零 diff。
  
  > **Semver 说明**：4 major deps 升级为消费面破坏（engine 行为面随 execa 用例面/构建工具链迁移），cdd-engine 按 major 发布；`@typescript/typescript6` 仅为工具链兼容包（不禁用 TS7 native tsc）。

- [#280](https://github.com/Oscaner/skills/pull/280) [`ad973c4`](https://github.com/Oscaner/skills/commit/ad973c42d5fcf48ab594aa641222dcd014262e19) Thanks [@Oscaner](https://github.com/Oscaner)! - P4.4 Task 6/7/8 cdd-engine breaking 面（P4.4 破口窗口收口登记）：全面 OOP restructure（engine 导出函数面重排）+ `REVIEW_FIX` 状态词汇新值（三段结案，[#278](https://github.com/Oscaner/skills/issues/278)）。
  
  - **engine 导出函数面重排（BREAKING）**：`runTask` → 类公共面 `TaskLifecycle.run`（静态组合根）；`runDocsTask` → `DocsLifecycle.run`；`generateBrief` → `BriefRenderer#render`；`buildCtx`/`parseTaskList` → `TaskLifecycle`/`cli-shared` 类公共方法。零薄壳转发（转发壳 = 缺陷即删, 判定标准⑤）——消费者以 `TaskLifecycle.run(harness, tasks, opts)` / `DocsLifecycle.run(opts)` 取代裸函数调用。
  - **standalone harness CLIs 合入组合根（BREAKING CLI 面）**：`cli/branch-review.ts` / `cli/branch-fix.ts` 整删——branch 审阅/修复经 `cdd review --type branch [--base --head]` / `cdd fix --type branch` 单一入口（组合根 type 路由），无独立 bin 转发。
  - **域规则模块 → 无状态域服务类（重构面，构造注入）**：`ConvergenceChecker` / `FailureResolver` / `StatusJudge` / `CloseoutChecker` / `DocumentsValidator` / `CommitChecker` / `HandoffSchemaValidator` / `ChangedSurfaceAuditor` / `TaskListParser` / `BriefRenderer` / `GitClient` / `Registry` / `ConfigLoader` / `EngineInvoker` / `ReturnBlockParser` / `TemplateLoader` 收类，方法即规则；`rules/` 全目录零裸纯函数导出。`ResidueManager` / `ProgressLedger` / `Handoff` / `RoundContext` 载体类落地（six-key 账本 `rowFor/entryFor` 单源、handoff 构建/命名/落盘/终态化经类面）。
  - **`REVIEW_FIX` 状态词汇新值（BREAKING — status enum 新增第三结案值, [#278](https://github.com/Oscaner/skills/issues/278) 三段结案）**：warn/nit-only 审阅轮 → `REVIEW_FIX`（收口态）而非旧 `APPROVED` 归并——fix 轮复用现有 `cdd fix --findings` 路由任务到 complete，**无 re-review**（与 S1 blocker 的 needs-fix → needs-re-review 区分）；零 blocker 且零 findings 仍 `APPROVED` fast path 不变；历史终态不回滚（旧 `APPROVED`+findings 终态保留）。handoff schema（task/docs）`status` enum + 回读定稿（`finalizeHandoff` 派生）与 `deriveTaskState` 路由同步三值。
  
  > **Semver 说明**：导出面破坏 + 新状态词汇值 = 消费面 breaking，cdd-engine 按 major 发布。消费者迁移面：(1) 直接消费 engine 库面处改调类静态组合根；(2) 解析审阅轮 handoff / return-block 时必须识别 `status: REVIEW_FIX`（warn/nit-only 结案）——非 approval，亦非 blocker 循环。

- [#280](https://github.com/Oscaner/skills/pull/280) [`9e76f6d`](https://github.com/Oscaner/skills/commit/9e76f6dab6477350b9ad3ff40f952e10230ee2ce) Thanks [@Oscaner](https://github.com/Oscaner)! - P4.4 Task 10/11 cdd-engine breaking 面（P4.4 破口窗口收口登记）：Pending Acceptance Patch 移除面（[#279](https://github.com/Oscaner/skills/issues/279)）。
  
  - **plan.json `pendingAcceptancePatch` 节点整删（BREAKING — schema 面）**：pending-acceptance-patch zone 的文档结构描述（heading const `## Pending Acceptance Patch` · entry pattern `- **Task N (patch)**:` · carry-through mechanism `accepts pending-acceptance-patch`）全部移除；`taskGroups` 声明的描述同步改指 plan-author 非交互裁定 + effectiveGroups 全量派生（声明合并组 ∪ 未覆盖任务隐式单组，并集恒 == 全 task 号集）；plan doc 不再承载 zone。
  - **skill-anatomy.json 注册表收缩（BREAKING — machine-check 面）**：条件节注册表删 `pendingAcceptancePatch` 条目（conditional enum 仅剩 `skeletonDeltas` · sections 描述/headingKinds `### Task N:` 样例 heading 全删）；**growth 注册表清零**——cli-driven-development 越界条目移除（loop 收缩至 13 节点/17 边落回边界内，crossings 转为 per-skill map、现零注册）；digraph-consistency 机器断言随 schema 单源收缩；schema.test 断言随删。
  - **`targets later task` / `accepts pending-acceptance-patch` 标签约定出技能文本（BREAKING — prompt 面）**：跨 task 裁决改由 orchestrator 以 Plan Sole Writer 直写目标 task 的 **Do** 与 **验收**（fix/implement agents 零 plan 修改权）；skills 文本零 pending-acceptance 字样。
  
  > **Semver 说明**：doc-structure schema 节点/注册表移除 + 标签约定退役 = 消费面 breaking，cdd-engine 按 major 发布；消费者迁移面：计划文档不再写 `## Pending Acceptance Patch` zone，跨 task 裁决由编排者直写目标 task 的 Do/验收行；growth 注册表已空（越界即须回边界或新注册）。

- [#280](https://github.com/Oscaner/skills/pull/280) [`91bd5e9`](https://github.com/Oscaner/skills/commit/91bd5e9e3f79a274b47dbe8974a2a40fe4bacd18) Thanks [@Oscaner](https://github.com/Oscaner)! - P4.4 Task 3/4/5 cdd-engine breaking 面（P4.4 破口窗口收口登记）：`TaskGroup` 组身份统一 + 契约 token 面收敛 + `CddRuntime` 模块态收编 + 域载体 typed 化：
  
  - **组键形 `tasks-{a}-{b}-*` → `tasks-{a},{b}-*`（BREAKING 产物名面）**：dispatch 组身份收敛为 `TaskGroup` 值对象（`key()` 规范序列化 = CLI `--tasks` 参数串，comma-joined 无空格——单例 `"1"`、合并组 `"1,2"`）；六命名面（brief / implement·review·fix handoff / report / test-evidence）全部 `tasks-{key}-*` 化；`tasksKey()` 函数整删。消费者迁移面：一切组产物文件名为 `tasks-1,2-*`（旧 `tasks-1-2-*` 消亡）。
  - **`--tasks 1-2` 连字符形非法（BREAKING 解析面）**：`parseTaskList` 迁移至 `TaskGroup.fromTokens`（逐 token 严格整数校验 · 去重 · 递增排序）；连字符/空 token/非整数 → exit 2（旧版 `parseInt` 会静默吞 `1-2` 为 `[1]`）。
  - **契约 token 面收敛（BREAKING prompt 面）**：九个 `TASK_*`/`DOCS_*` token 塌缩为 `DISPATCH_UNIT`（本轮 dispatch 单位，task=组键 · branch=base..head）/ `BRIEF` / `FINDINGS` / `FIXED_POINT` / `CONSTRAINTS` / `WORKSPACE` / `DOC`；保留 `MODE` / `REVIEW_*` / `HANDOFF_TARGET` / `HANDOFF_WRITE_GATE` / `WORKSPACE_SLUG` / `RETURN_FORMAT`。模板契约 `$version` 2 → 3。
  - **effectiveGroups 隐式单组派生补全（BREAKING 行为面——声明组未全覆盖时）**：有效组 = 声明合并组 ∪ 未覆盖任务隐式单组（按 task 号序），有效组并集恒 == 全 plan task 号集（P4.3 实现会丢弃未声明 task）。
  - **`CddRuntime` 模块态收编（重构面，公共 API 不变）**：全部模块级可变态（dryRun / 根单例 / proc registry·diskPath·idleTimer / signalExitCode / cache-profile memo / 模板渲染 CACHE）收进 `src/infra/runtime.ts` 单例；`infra/proc.ts` 变薄 re-export；派发面新增 `runtime` 构造注入替身缝（engine 测试经替身实证 dryRun/root/proc 均经类面）。
  - **域载体 typed 化（重构面）**：`TaskDispatchContext` / `DispatchContext` / `ProgressData` 等域接口去掉索引签名、精确声明成员（handoff schema 16-prop 校验仍留 schema 面，无双实现）；`ReviewOpts` / `FixOpts` 组字段收 `TaskGroup`。
  
  > **Semver 说明**：产物名 / CLI 解析 / prompt 契约 token / 声明组未全覆盖分区 = 消费面破坏，cdd-engine 按 major 发布；消费者迁移面 = 组产物文件名 `tasks-1,2-*`、`--tasks` 仅接受逗号整数串、prompt round-context 槽读新 token 名。

### Minor Changes

- [#281](https://github.com/Oscaner/skills/pull/281) [`7177ae5`](https://github.com/Oscaner/skills/commit/7177ae5e84a9279410bcf075ea33a8325306f637) Thanks [@Oscaner](https://github.com/Oscaner)! - P4.2 consumer-parity 数据面单源收口：新纯渲染子命令 `cdd issue render` + finding-meta 权威迁移（非 breaking，minor）。
  
  - **`cdd issue render` 纯渲染子命令（Non-goal [#1](https://github.com/Oscaner/skills/issues/1) 例外扩入——schema get 发现型 + issue render 纯渲染型双豁免）**：stdin findings JSON → stdout aggregate issue body，确定性渲染、零执法逻辑、无生命周期副作用；实现面 = P4.4 OOP 形态 `IssueReportRenderer` domain service + cli 条目路由（stdin JSON 结构校验失败 exit 1 + 违规字段路径）。report-issues 技能 I5 改「body 由 `cdd issue render` 直出」，pluginRoot-ascending 文件寻址机制删除——消费者不再就近找 `.claude-plugin/plugin.json` → scripts/。
  - **finding-meta 权威迁 engine**：issue body 模板权威（原 `packages/osuperpowers/skills/report-issues/templates/finding-meta.json`）迁 cdd-engine `templates/` 面（`DOC_SCHEMA_NAMES` 不新增 doc-type——模板唯一消费者 = 渲染器，emit 经 repo → engine 方向 import，无发现型消费者）；emit issue-templates 生成改从 engine import，`emit:check` 零 drift。
  
  > **Semver 说明**：新增子命令面 + 模板权威迁移为**新能力面**（非 breaking——既有面零变化）；cdd-engine 按 minor 发布，随 pending majors 一次集成发版至 **1.0.0**（0.1.0 基线 + 原生 major 集合 = 原生 changesets 自然产出）。

- [#281](https://github.com/Oscaner/skills/pull/281) [`75669f7`](https://github.com/Oscaner/skills/commit/75669f7bf3881938722ea0487a88e3c0cacc31e9) Thanks [@Oscaner](https://github.com/Oscaner)! - P4.2 consumer-parity 派生产物再生语义：`plan-constraints.md` 改为每次 implement dispatch（每 TG 起点）无条件再生（非 breaking，minor）。
  
  - **去 generate-once**：`materializePlanConstraints` 删除既有文件早退——每次从 plan 声明的 Constraints source 重新提取并覆写 `plan-constraints.md`（同 plan 重写同字节 = 确定性保持；plan hash 锚保留在确定性 header 作 provenance，不再作 stale 判定）。implement pre-flight 同步删除 `existsSync` 存在性跳过，每 TG 起点必调 ⇒ mid-backfill 对 plan Constraints 的更新随下一次 dispatch 自动落到派生产物。
  - **死代码即删**：`isPlanConstraintsStale`（含 `PLAN_HASH_RE`）随「无条件再生」成恒真而删除，src + tests 零残留。
  
  > **Semver 说明**：CLI/字段面零变化，仅派生产物（`plan-constraints.md`，Do not edit 声明）的再生语义变更——非 breaking；cdd-engine 按 minor 发布，随 pending majors 一次集成发版至 **1.0.0**。

- [#256](https://github.com/Oscaner/skills/pull/256) [`6814592`](https://github.com/Oscaner/skills/commit/68145921e033e0e26388e24e69ddd3f0ca64709a) Thanks [@Oscaner](https://github.com/Oscaner)! - P1 runtime 布局: workspace 根 .superpowers/cdd → .osuperpowers/cdd（handoff/progress/lifecycle/base-branch/report-target 全随迁）; standalone scope 整体移除（cdd base-branch 单调 --plan）; 旧根 dead-workspace 清理。

- [#258](https://github.com/Oscaner/skills/pull/258) [`9c6148d`](https://github.com/Oscaner/skills/commit/9c6148dd807b4f64e27fbc8c7c1da818b1e00132) Thanks [@Oscaner](https://github.com/Oscaner)! - P2 docs 根落点迁移: rootFromDocPath 识别 docs/osuperpowers/{specs,plans} 布局（drop docs/superpowers 旧 marker）; overall-consistency 单根收敛; docs/superpowers stale-lexicon 守卫。

- [#261](https://github.com/Oscaner/skills/pull/261) [`6233932`](https://github.com/Oscaner/skills/commit/62339329cc7d14e1d91c5e8fe81f5e9ca11e8bc1) Thanks [@Oscaner](https://github.com/Oscaner)! - P3 cdd 命令面收敛：`cdd` 子命令由 6 收敛为 4（implement / review / fix / base-branch）。
  
  - **`cdd brief` 删除**：零消费者——engine 已在 implement 的 plan 定稿处自给 brief（`run-task.mjs` F11：`generateBrief` + `CDD_TASK_BRIEF` override 写/读同源 + dir bootstrap）；`lib/brief.mjs#generateBrief` 保留供 run-task。
  - **`cdd research` 删除**：唯一消费者 `cli-research` skill 一并删除（删除命令必须同步其唯一调用方）；`lib/cli/research.mjs`（`RESEARCH_METHODOLOGY` / `buildResearchPrompt` / `writeFindings` / `runResearch`）与 `lib/cli/brief.mjs`（`runBriefCli`）整文件移除。
  - **级联死配置连根**：`DEFAULT_TIMEOUTS.research` / `modeEnv.research`（`CDD_RESEARCH_TIMEOUT`）/ `LEGACY_MODE_ENV` 整表及 `resolveTimeoutMs` 的 legacy 分支 / 零生产者的 `lib/brief.mjs#validateBrief`。
  - **防回渗守卫**：新增 stale-lexicon 两条（命令形 `/\bcdd (brief|research)\b/` + `/RESEARCH_TIMEOUT/`）——命令形刻意非裸词，保留 `/mattpocock-skills:research` 会话调用的合法空间。
  
  > **semver 说明**：`cdd brief` / `cdd research` 的删除实为 **breaking**（如实应为 `cdd-engine` major），本次按 minor 发布。

- [#262](https://github.com/Oscaner/skills/pull/262) [`1d33809`](https://github.com/Oscaner/skills/commit/1d3380989e281130a8fbaafa4479125d512e98f0) Thanks [@Oscaner](https://github.com/Oscaner)! - P4 engine 契约面重构 + skills 面全面重写（含行为兼容性变更）。
  
  **cdd-engine — 契约面重构：**
  
  - **单一坐标系**：CLI 内容路径入参（plan / doc / path 等）统一为**仓根相对**解析，绝对路径直用；不再保留 cwd 相对回落。路径未命中时退出码固定为 1，诊断恒为三行（含实际尝试路径）。
  - **单根收敛**：cwd → 仓根转换在 bin + lib 内收口为唯一一处，子进程与生命周期路径全部自根派生。
  - 失败分支契约回正：BLOCKED 载荷由引擎字面量填充、恢复载荷不依赖对象展开语义、progress 透传与派发输出格式保持一致。
  
  > **semver 说明**：CLI 路径语义由 cwd 相对改为仓根相对**实为 breaking**，本次按 minor 发布。
  
  **osuperpowers — skills 面全面重写（8 个）：**
  
  - 新增三个 spec-writer：writing-single-spec / writing-overall-spec / writing-phase-spec；
  - 委托型重写：brainstorming / writing-plans / finishing；
  - 原生型重写：cli-driven-development + report-issue 精简。
  - **`init` 删除**：技能集收敛为编排型 8 个。

- [#263](https://github.com/Oscaner/skills/pull/263) [`09dee9f`](https://github.com/Oscaner/skills/commit/09dee9faf79f7cb72433588c089edcd9ae4edf51) Thanks [@Oscaner](https://github.com/Oscaner)! - P5 engine 全面重建：全量 TS + unbuild、生命周期域重建、第三方收敛、CLI 换 citty（黑盒契约零变化）。
  
  **TS 化 + 构建：**
  
  - 全量 TypeScript + unbuild 构建（抽象基类虚方法成为编译期约束）；`main`/`exports`/`bin` → `dist/cli.mjs`，dev 与发布同走 dist 入口（`unbuild --stub` 即时加载）；`bin/cdd.mjs` 并入 `src/bin.ts`。
  
  **CLI 换 citty（commander 移除）：**
  
  - 顶层命令面 = implement / review / fix / base-branch（base-branch 保留嵌套 set/get），guardArgs 未知 option 拒绝；--help/usage 经 citty 声明；退出码经 bin 包装归一。
  
  **生命周期域重建：**
  
  - `DispatchLifecycle` 抽象基类（模板方法 run()：pre-flight → dispatch → post-flight）+ `TaskLifecycle`/`DocsLifecycle` 功能聚簇继承覆写 + hookable 注册面（dispatch:before/after 固定 hook 点）+ `PHASES` 数据化阶段表。
  - **commit 边界双门**：入口门（review/fix dispatch 起点干净树校验，dirty → BLOCKED）+ 出口门（validateCommitContract）；docs 面同消费双门；`fix/docs.md` 补提交指令。
  
  **第三方依赖收敛（spec §2.13，只维护功能逻辑）：**
  
  - simple-git 替换手写 git（`execFileSync("git")` 零残留）、tinyglobby 收 glob、handlebars 替换占位替换循环、consola 统一日志；yaml/husky 等按边界见文档；不引清单（XState/tapable/emittery/oclif/js-yaml 等）登记于运维文档。
  
  > **semver 说明**：全量重建为**内部形态**——engine 黑盒契约（4 子命令面 / handoff 输出 / failure 类目）零变化，skills 与消费者面零感知，400+ tests 为迁移护栏；按 minor 发布（无 breaking，亦非纯 patch 级机械改动）。

- [#264](https://github.com/Oscaner/skills/pull/264) [`8281ef4`](https://github.com/Oscaner/skills/commit/8281ef4f7c3304c4e516218580161ab0a2904752) Thanks [@Oscaner](https://github.com/Oscaner)! - P6 引擎统一收敛（convergence family, cdd-engine minor）——五个 feature 合并发布：
  
  - **模板平面系统化 + 命名收敛（T5）**：prompt templates 重组织（docs/task/schema），engine config 并 `engine-config.json`、render 数据并 `template-contract.json`；template tokens 改限域全名（`H1_BLOCK`→`RETURN_STDOUT_BLOCK`、`HARD_GATE`→`HANDOFF_WRITE_GATE`、`HANDOFF_TYPE`→`HANDOFF_TARGET`、`LENS_GUIDE`→`REVIEW_LENS_GUIDE`）；return-format 判别符 `returnFormat`（legacy `h1`/`json` 退役）。
  - **派发期 liveness monitor（E3）**：`spawnManaged` 采样进程组 CPU + 工作树 mtime，静止超窗（15min）→ kill + TIMEOUT（`timedOut` + `stalled` blocker + 清偿契约 + fail-open）；CPU 按样本差判定防陈旧基线误杀。
  - **派发岛收敛 + 错误收编（T24）**：branch review/fix 收编 `BranchLifecycle`（round/prompt/schema/finalize/exit-gate 全上链——branch-fix 继承 commit 契约：脏树/head-mismatch BLOCK）；status 推导族归 finalize、计数器归 failure、Convergence 归 convergence、return-block 单点；编排错误统一 `CddExitError`（exitCode+kind）、库内断言走 `invariant()`、`hashFile` 归 artifacts。
  - **派发终止契约 + 续传（T26）**：dispatch 死亡 = 终止→保全→续传单生命周期——`spawnManaged` 统一 monitor（stall 活性 primary + budget last-resort cap）经单一纯判据 → 三 cause（stalled/over-budget/signal）；预算/停滞 implement 轮将 WIP `git stash push -u` 保全（标准化 `cdd-<op>-<type>-<task>-r<round>-<cause>` + `recovery.residue_ref`），re-dispatch 预检读载体重放 + brief 附数据驱动 residue 附言（legacy stash-list 检索兜底 pre-schema）。
  - **任务级 scope 账本（T27）**：任务可审 git 范围 = 引擎自有跨轮稳定锚——`progress.json#tasks[].scope_base` earliest-wins；恢复轮 materialized `base==HEAD` 时可采纳 return-block 声明的 true base（祖先校验、fresh 永不采纳）；review/fix 固定点改读账本（legacy 回落）。
  
  > **Semver note**: token/`returnFormat` 判别符 rename 为契约面破坏（`h1`/`json` 退役）但限 round-context 面；其余（island 收敛 / liveness / termination+resume / scope ledger）为内部重构 + 新增能力——整体按 minor 发布（P3/P4 先例）。

### Patch Changes

- [#264](https://github.com/Oscaner/skills/pull/264) [`8281ef4`](https://github.com/Oscaner/skills/commit/8281ef4f7c3304c4e516218580161ab0a2904752) Thanks [@Oscaner](https://github.com/Oscaner)! - P6 修复族（fixes family, cdd-engine patch）——三个 fix 合并发布：
  
  - **writeBoundary 接线 + 残留注解修正（T25 fix）**：task face 同步 canonical `ctx.handoffPath` → implement 载体真正落 changed-surface ledger-origin notes（此前读空路径记录永不落盘）；docs no-handoff BLOCKED carrier 在 agent exit 0 时省略 `recovery.exit_code`（exit_code 保持严格死亡码：1/143）；残留 stash 附言补 round marker（`cdd residue: <cause> <basename> r1`）。
  - **residue save 单 owner 收敛（T28）**：残留保全 save 侧全族归 `artifacts/residue.ts`——eligibility（`recoveryEligible`/`RESIDUE_PRESERVED_CAUSES`）、carrier 锚定 adapter `settleFromCarrier`、`preserved` 幂等守卫、announce 包装；一切 save 路径单一标准化 stash message（同 task lane 契约；T28 前双 owner 双写 stash 缺陷消除——lane pre-write `preserved=true`、共用钩子幂等空转）；`rules/residue.ts` + `gitStashPreserve` 删除；`recovery.wip_stat` 归档并存 `residue_scope`。
  - **doc-contract + status lifecycle 钩子（T29）**：每次真实派发 pre-flight 跑 `docContractValidate`（plan `### Task N:` 连续提取 · `**Spec:**` 解析至现有 spec · Constraints 源可提取 · 无占位；phase spec 版本行 + Parent program 指向 + phase 注册；overall canonical 头 + 行形守卫 + 版本升序）——失败 blocked exit 1 + 逐字段指导（dry-run 降 WARN）；post-flight `statusValidate` 报六态收敛（in-flight/needs-review/needs-fix/needs-re-review/resume-pending/complete）+ 计划完成度 CDD_INFO；`rules/documents.ts` + `rules/status.ts` 只读，引擎新增面 = 两个 DispatchLifecycle 模板方法钩子（零 CLI 面/零 schema 变更/零 doc 写）。
  
  - **src 注释锚首清零执法（T31）**：§35 第二半（src 注释语义主体 + 锚仅 trailing 溯源后缀）纸面规则落执法位——residue 守卫新增「src 注释禁锚首」检查（`packages/cdd-engine/src/**/*.ts` 注释首 token ∈ 阶段锚族 → FAIL；块粒度计数、文件头豁免仅当头注 path/模块开头、尾缀/纯语义放行），全引擎 135 个锚首注释块语义前置排修（含中文注释 English 化，测试位同扫，纯注释零行为面）。
  
  > **Semver note**: 四个 fix（writeBoundary 接线 / regenerate single-owner / doc-contract+status 钩子 / src 注释锚首执法）均为缺陷修复/内部收敛，按 patch 发布（保持 0/1/2/3 退出码表与 CLI 面不变）。，按 patch 发布（保持 0/1/2/3 退出码表与 CLI 面不变）。
