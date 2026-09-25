# 消费者面一致性（Consumer Parity）— P4.4 Phase Design Spec

- **Version**: v1.2 · 2026-09-25
- **Status**: Draft
- **Author**: [human] · Claude Opus 5 (1M context)（osuperpowers:brainstorming → writing-phase-spec）
- **Parent program**: [consumer-parity overall v1.38](2026-09-21-consumer-parity-overall.md)
- **Depends on**: P4.3（shipped · [p4.3-design v1.7](2026-09-21-consumer-parity-p4.3-design.md)）

## Section 0: Incremental warning

本 spec 承诺单一 phase（P4.4）的增量。phase-size 裁决 = **fit（单 phase spec）**：四面并作（engine 全面 OOP 化 · `scripts/` 编排面同构 · 全树 deps 升最新 · biomejs 全面接入）在单 phase 内以 **task groups 分批**推进，**不拆子 phase**——任何拆/序变更须先回填 parent overall（backfill-as-version）再继续，不允许实现期绕过。

## Section 1: Constraints pointer

Cross-phase 约定以 parent overall（v1.38）为准，conflict 时 overall wins（此处不重复）。本 phase 生效的整体约定：

- **允许破坏性变更**（charter bullet）：cdd-engine 0.1.0 基准，P4.2 1.0.0 首次稳定开版前为破口窗口；本 phase breaking（OOP restructure + 4 major deps）登记 changelog、1.0.0 收口
- 本仓文档合规判据面 = engine lifecycle（dispatch 运行时审计 + engine 套件），无 repo 侧 charter 守卫
- 语言政策：spec/plan 中文（Strategy B）· SKILL.md / docs / README 英文主源
- 不 commit 除非用户明确要求；spec/plan 交付除外（I2 立即提交）
- changeset 逐 phase 建；breaking 变更面归属清晰
- 开发期引擎调用：`node packages/cdd-engine/dist/cli.mjs` 直调（`pnpm --filter @oscaner-skills/cdd-engine dev:stub` 后），不走 global register
- 零新增执法子命令（charter Non-goal #1；唯一发现型 = `cdd schema get`）

## Section 2: Design body

### 2.1 统一抽象：全面 OOP 化（用户 2026-09-25 裁决 · 判定标准终版）

全仓产品源码 ts 面**不再有模块级裸函数模块**（含纯计算规则面）——每一域概念 = 类：**状态类**（承接状态/生命周期/不变量）或**无状态域服务类**（承接纯计算规则，方法即规则、协同对象构造注入）。判定标准六条：

1. **有状态/生命周期/不变量 → 状态类**
2. **纯计算规则 → 无状态域服务类**（零纯函数模块；无独立纯函数导出模块层）
3. **裸 `number[]` / 裸 `Record` 在域接口出现 = 残面**，归零（→ `TaskGroup` 实例 / typed 载体）
4. **模块级可变状态 = 残面**，全收 `RuntimeContext`
5. **转发壳 / 空壳 / 中间态（仅为兼容而设的薄层）= 缺陷**，即删
6. 只读纯数据收 **typed 载体**（type/interface），不建空壳 class

### 2.2 类谱（最终 taxonomy）

| 面 | 类（承载面） | 来源 / 落点 |
|---|---|---|
| RuntimeContext | `CddRuntime`（唯一可变态面：构造注入 · 测试可替） | 收编 `dryRun`（cli/shared.ts:18-24）· `_root`（infra/root.ts:16-31）· proc 全局 `registry/diskPath/idleTimer`（infra/proc.ts:330-332）· `signalExitCode`（bin.ts:54）· memo `cacheProfileValidator`（infra/registry.ts:98） |
| 值对象 | `TaskGroup`（静态工厂 · dedup · 排序 · `key()` · 成员断言） | `parseTaskList()`（cli/shared.ts:84）+ `tasksKey()`（handoff/naming.ts:37）双标量升级 |
| 调度生命周期 | `DispatchLifecycle` 族（既有 template-method 基底扩展）：`TaskLifecycle`（13.5 步）· `DocsLifecycle` · `BranchLifecycle` | 长链 `runReview`（cli/review.ts:76-226）· `runFix`（cli/fix.ts:23-120）· `buildCtx`（task.ts:122-158）迁入类步骤；`cli/*.ts` 退化为**组合根**（argv 解析 + 构造 + dispatch + 出口） |
| 调度产物面 | `RoundContext`（round 基准 · base token · 轮次锚）· `Handoff`（typed 载体：构建/命名/落盘/终态化）· `ProgressLedger`（六 key 账本 · `rowFor/entryFor` 单源 + 写入不变量）· `ResidueManager`（residue 检测/结算/恢复状态机） | `TaskLedgerRow`（progress.ts:25-63）· 裸 `Record` handoff + `templates/schema/task-handoff-schema.json`（16-prop 校验留在 engine schema 面，不做第二执法实现）· `RecoveryInfo/DeadCarrierRead`（residue.ts:141/277） |
| 输出渲染面 | `BriefRenderer`（无状态域服务类：渲染方法即规则 · 构造注入文件/git 判据） | 类化 `generateBrief`（render/brief.ts:25，现导出异步纯函数模块）→ `BriefRenderer#render` |
| 域规则服务 | `ConvergenceChecker` · `FailureResolver` · `StatusJudge` · `CloseoutChecker` · `DocumentsValidator` · `TaskListParser` 等 | 重写 rules/（convergence/failure/status/closeout/documents）—— 纯函数模块 → 无状态域服务类；`parseTaskList` 锚点见 §2.3（cli/shared.ts:84 → `TaskListParser`，非 rules/ 面） |
| Infra | `Registry` · `GitClient`（WipStat）· proc 生命周期类 | infra/ 面类化 |
| scripts 同构 | `Command` 类族（citty 命令树 + invocationArgs meta）· `ValidateBlock` 类族 + `ValidateRunner` | run.ts（scripts/run.ts:49-93）· validate（runner.ts:20-27）· scripts/lib 纯工具 → 无状态域服务类 |

### 2.3 模块级态收编（残面→RuntimeContext）

上表来源列五个模块级可变态全数收编 `CddRuntime`：solo 模块级可变态（`let` 声明）面归零，构造注入 —— engine 测试与 scripts 测试经替身注入实证；`cli/shared.ts:84 parseTaskList` → `TaskListParser` 类化落点（不在 rules/ 面），`cli/parse.ts` 组合根静态可导入、零副作用约束保持（cli-shape.test.ts / schema.test.ts 随破坏面改造，允许 breaking）。

### 2.4 破坏面（breaking — 1.0.0 收口）

- **engine 导出函数面重排**：`runTask` · `runDocsTask` · `generateBrief` · `buildCtx` · `parseTaskList` 随类化移至类公共面（`TaskLifecycle.run` · `TaskGroup.parse` · `BriefRenderer.render` 等）；**不做薄壳转发保红线**（判定标准 ⑤）；engine 测试套件随类化同步改造（breaking 允许）
- **CLI argv 契约不变**：`--tasks` / `--type` / `--plan` / `--findings` 等 bin 入口面稳定（skills 与消费者经 CLI 调用，零回归）
- **4 major deps 破坏行为逐项实证**：execa 9→10（API 删除/破坏面）· vitest 3→5（配置/API 迁移）· typescript 5→7（编译/类型行为）· @types/node 22→26（类型面）——逐项实证登记 changelog
- **1.0.0 收口**：以上全部进 P4.2 发布 changelog（发布面消费 OOP 化完成态 + 全树 latest 基线）

### 2.5 `scripts/` 编排面同构

- `run.ts` citty 命令树（mainCommand + 7 子命令 + `invocationArgs` 契约表）→ **`Command` 类族**（装配 + invoke + meta）；命令文件 = 组合根，非转发壳
- validate `steps: StepDescriptor[]`（11 块）→ **`ValidateBlock` 类族** + `ValidateRunner`（单循环）；**11 步名/序/`grepTargets`/`channelTargets` 域事实保持**——`ci-validate.test.mjs:171` 钉死的名/序/元面不因类化漂移（域事实，非 facade 保留；若类化揭示 legacy 步名则当场改名 + 守卫同域演化）
- `scripts/lib/`（version-utils · doc-root · marketplace-utils · observe-cache）→ 无状态域服务类

### 2.6 biomejs 全面接入（2026-09-24 用户裁决）

- **biome.json 随仓发布**：`recommended` ruleset + formatter；scope = **src + scripts + 全仓 ts 面**（含 engine `__tests__` 与 scripts `__tests__`）
- **husky pre-commit**：新增 `biome check --write`（format 自动改 + lint 违规拦截 = 门），与既有 `pnpm run precommit` 校验链并列
- 门先行于重构（task group 次序 TG2），重构全程在静态门下走；零违规为 commit 前常态

### 2.7 全树 deps 升最新（R7 · 2026-09-25 用户裁决纳入）

- **4 个 major**（= 4 个 dependabot PR 内容）：「execa `^9.6.1`→`10.0.1`（root + cdd-engine）· vitest `^3.2.7`→`5.0.1`（root devDep + cdd-engine devDep）· typescript `^5.9.3`→`7.0.2`（cdd-engine devDep）· @types/node `^22.20.3`→`26.6.2`（cdd-engine devDep）」
- **全树 caret floor 刷新**：`pnpm update --latest`（`^0.2`→`^0.2.2` · `^7`→`^7.8.5` 等 floor 落定，lockfile 一次收口）；osuperpowers 无第三方依赖（仅 workspace:*）
- **执行通道**：P4.4 工作树直接 `pnpm update --latest` 落地 → 4 个 dependabot PR（Oscaner/skills #238/#266/#267/#268，base=develop 已漂移）gh close（superseded by P4.4）
- **先行独立 task group**（TG1）：major 兼容问题最早暴露，OOP 重构站在干净依赖上

### 2.8 task groups 编排（writing-plans 裁定节点输入 · 建议分组）

| TG | 内容 | 出口门 |
|---|---|---|
| TG1 | **deps bump**（全树 latest + caret floor 刷新；close 4 PR） | 4 major 破坏行为实证登记 · engine 测试绿 · validate 绿 |
| TG2 | **biomejs 门先行**（biome.json + husky pre-commit `biome check --write`） | 静态门落地实证 · 零违规 |
| TG3 | **engine 域层**（`TaskGroup` 类 · `CddRuntime` · 载体 typed 化 · 模块态收编） | 域接口零裸标量（sweep 实证）· 套件绿 |
| TG4 | **lifecycle 收口**（长链入类 · `RoundContext/Handoff/ProgressLedger/ResidueManager` + 域规则服务类 · 导出面重排 + 测试改造） | 破坏面收口实证 · 套件绿 |
| TG5 | **scripts 类化**（`Command` 族 · `ValidateBlock` 族） | run.test / ci-validate 面随域演化对齐 |
| TG6 | **收口**（validate 11 块全绿 · 破坏面 changelog 登记 · overall backfill · changeset） | validate 全绿 · 零残面 sweep |

每 TG 独立 commit；clean-tree 纪律全程保持（engine 入口 gate：dirty → BLOCKED）。

### 2.9 三段结案（review status 词汇三分 · #278 · 2026-09-25 用户裁决并入）

Review 判定从两态（CHANGES_REQUESTED / APPROVED）划为**三态**，消除「APPROVED 携带 warn/nit 却跳过 fix 直接 complete」的心智误判面——**行为本质与既有 I3「blocker=0 → fix all findings，do not re-run」一致**，仅把状态划分变显式、由状态机而非 agent 自觉执行：

- **S1 blocker > 0** → `CHANGES_REQUESTED` → needs-fix → needs-re-review → 循环至收敛（现状不变）
- **S2 blocker = 0 ∧（warn + nit）> 0** → **收口态**（review 状态词汇第三值）→ **复用现有 `cdd fix --findings <handoff>`** 一轮 → complete（**无 re-review**）
- **S3 blocker + warn + nit = 0** → `APPROVED` → complete（fast path，现状不变）

引擎面（最小改动，全部落在本 phase 类化面）：
- `finalize.ts` 状态派生族（`classifySeverity` / `rollupStatus` / `deriveReviewStatus` 单一 owner）产出第三状态值——blocker>0 → `CHANGES_REQUESTED` · blocker=0∧warn/nit>0 → **收口态** · 零 → `APPROVED`
- `rules/status.ts` `deriveTaskState`：收口态 → **fix 轮路由 → complete**（与 S1 的 needs-fix → needs-re-review 路径区分）
- fix dispatch 对收口态放行（与 needs-fix 同 gate）——**fix 行为本身零改动**：无 per-finding disposition 新机制、无 `targets later task` 过滤（不关心 tag，当前 task 有 findings 即 fix）

Skills 面（emit 输入面）：五件 Review Convergence 文本改三段表述（writing-single-spec · writing-overall-spec · writing-phase-spec · writing-plans + cli-driven-development 的 I3/I1 行 + review/fix 节点路径），改后 `pnpm run emit` + 产物重生成

Breaking：handoff `status` 词汇新增第三值 → 1.0.0 收口（P4.2 changelog）；历史 workspace 已落定终态（APPROVED+findings → complete）**不回滚**

### Acceptance criteria

- `pnpm outdated` 零落后（全树 latest）：execa 10.0.1 · typescript 7.0.2 · vitest 5.0.1 · @types/node 26.6.2 + 全树 caret floor 刷新实证；4 个 dependabot PR（execa / typescript / vitest / @types/node）已 closed（superseded by P4.4，gh 断言）；`pnpm install --frozen-lockfile` 绿（lockfile 与依赖面一致）
- 4 major deps 破坏行为逐项实证登记（execa@10 API 破坏面 · vitest@5 迁移面 · TS@7 编译/类型行为 · @types/node@26 类型面——engine 测试绿 + dispatch 实证 + 登记 changelog）
- 全面 OOP 化按「零纯函数模块」口径实证：域规则服务类全类化（convergence / failure / status / closeout / documents / parse 零独立纯函数导出模块，grep 断言）；判定标准六条 sweep 实证（零模块级裸函数导出 · 零模块级可变态 · 零裸标量 裸 Record 域接口穿行 · 零转发壳 / 零空壳 class —— sweep + 代码评审）
- `CddRuntime` 构造注入实证（dryRun / root / proc 状态 / exit signalling / memo 全收编；engine 测试注入替身绿）
- `TaskGroup` 类化：五个历史散点派生统一收进 `TaskGroup` 单源（`--tasks` 解析 · `effectiveGroups` · progress ledger key · handoff 文件名 · `TaskLifecycle#tasks/#groupKey`）——与 §2.2 类自身能力面五枚举（静态工厂 · dedup · 排序 · `key()` · 成员断言）互补，零 `number[]` / 裸串穿行（sweep）
- CLI 长链迁入 lifecycle 类步骤（`runReview` / `runFix` / `buildCtx` 主体逻辑入类；`cli/*.ts` 退化为组合根——argv 解析 + 构造 + dispatch + 出口；无转发壳实证）
- progress / residue / handoff 载体类化（`ProgressLedger` 六 key + `rowFor/entryFor` 单源不变量 · `ResidueManager` 状态机 · `Handoff` typed 载体；schema 校验仍在 engine schema 面、无双实现实证）
- engine 导出函数面破坏性重排到位 + engine 测试套件随类化全绿（breaking 允许、无薄壳）；CLI argv 契约（`--tasks` / `--type` / `--plan` / `--findings`）不变——skills 与消费者调用面零回归（smoke 实证）
- scripts 侧同构实证：`Command` 类族 + `ValidateBlock` 类族落地；11 步名/序/`grepTargets`/`channelTargets` 域事实保持（`ci-validate.test.mjs` 断言全绿，或同域演化后对齐）；`run.test.ts` 命令树断言同域对齐
- biomejs 全面接入实证：biome.json 随仓发布（recommended）· husky pre-commit 触发 `biome check --write` 零违规通过（pre-commit 输出断言）· 覆盖 src + scripts + 全仓 ts 面（配置断言）
- `pnpm run validate` 11 块全绿；`emit:check` 无 drift；破坏面（OOP restructure + 4 major deps + review 三段结案状态词汇新值）登记 changelog，1.0.0 收口就绪；本 spec Parent program v1.39 版本行 lineage 合法；P4.4 Design-spec / Implementation plan 列随 phase 推进正确回填（backfill-overall，branch-review 前）
- review 状态词汇三值落地实证：S1 blocker 循环（现状回归）· S2 收口态 → 复用现有 `cdd fix --findings` 一轮 → complete（无 re-review）· S3 零 finding fast path——engine 测试自造链 + 现场回归
- S2 fix 轮复用现有 `cdd fix --findings`、零 per-finding disposition 新机制、零 `targets later task` 过滤（当前 task 有 findings 即 fix）实证
- skills 五面 Review Convergence 文本改三段表述（writing-single-spec · writing-overall-spec · writing-phase-spec · writing-plans + cli-driven-development；emit 输入面，改后 `pnpm run emit` + `emit:check` 无 drift）；breaking = handoff `status` 词汇新值登记 changelog、1.0.0 收口、历史终态不回滚

## Section 3: Deviations from overall

| Overall assumption | Phase decision | Overall updated? |
|---|---|---|
| P4.4 注册期 scope/AC（v1.26/v1.31，先注册不探索） | 全面 OOP 化裁决（含规则面全类化、零纯函数模块）+ 破坏性变更允许 + R7 全仓依赖升最新（4 major PR + caret floor 刷新）+ scope/AC 定稿（phase-size = fit · task groups 编排） | Yes — v1.38 · 2026-09-25 |
| review status 两态词汇（CHANGES_REQUESTED / APPROVED，engine 现状） | 三段结案重构（#278 · 2026-09-25 用户裁决）：状态词汇三分（blocker>0 → CHANGES_REQUESTED · blocker=0∧warn/nit>0 → 收口态 · 零 → APPROVED）+ `deriveTaskState` 收口态路由复用现有 `cdd fix` 后 complete（无 re-review · 无 per-finding 行为 · 无 tag 过滤）；breaking 词汇面 1.0.0 收口、历史终态不回滚 | Yes — v1.39 · 2026-09-25 |
| （其余全部设计裁决已随 overall v1.38/v1.39 回填：P4.4 行 scope/AC · Issue inventory P4.4 行 +#278 锚点行 · change-history v1.38/v1.39，见 overall 变更基准） | 本 spec 不偏离 charter；实施细节见 §2.1–§2.9 | Yes — v1.39 · 2026-09-25 |

## Section 4: Notes for downstream

- **P4.2（发布闭环）**：1.0.0 首次稳定开版收进本 phase breaking 面（OOP restructure + 4 major deps + review 三段结案状态词汇新值 #278）；发布面消费 OOP 化完成态与全树 latest 基线（依赖图 `P4.4 ->(hard) P4.2` 已登记）
- **biomejs 静态门**：P4.2 起 husky pre-commit 静态质量门常驻（与既有 precommit 校验链并列）
- **repo 定位改述 cdd 方法论（v1.33 记录）**：待 P4.2 阶段启动分析落地，本 phase 不处理

## Section 5: Review

Fresh-subagent review passes before user review and writing-plans — baseline = committed tree, Review Convergence（三段结案：blocker > 0 → fix 后 re-review；blocker = 0 ∧ warn/nit > 0 → fix 收口轮、无 re-review；零 finding → 批准收敛）。spec 批准即 commit（I2），不等 dev 合并。
