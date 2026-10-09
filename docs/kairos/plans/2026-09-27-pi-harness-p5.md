# Pi Harness P5 实施计划（Pi Harness P5 Implementation Plan）

**Spec:** [2026-09-27-pi-harness-p5-design.md](docs/kairos/specs/2026-09-27-pi-harness-p5-design.md)

- **Parent program**: [2026-09-27-pi-harness-overall.md v1.27](docs/kairos/specs/2026-09-27-pi-harness-overall.md)
- **Version**: v1.3 · 2026-10-02
- **Depends on**: P5 design v1.3 Approved（`18d30c16` review r1+r2 收口 + `f3e78471` v1.3 design backfill）
- **Base**: develop

- **Interface 转录注记**: 各任务 `- **Consumes**: 刻意留空（树迁移 B 转录决策）——源 Do 散文未承载独立具名输入事实，consumes（Task 记录 interface 可选项）不填充；任务输入由 DependsOn/AtomicWith 声明边与 objective/steps 承载，consumer-parity p1–p4.1 因承接具名输入事实而全量填充。

## Constraints

### 口径

- **零债/死壳即删（P5 破坏性授权，user 2026-10-02）**：允许破坏性变更 / 重写代码 / 重组目录；约束 = 高维思考 / OOP 抽象统一 / 最佳实践 / **零技术债务 + 死壳即删**（空壳、死代码、已废构建面删除不留残壳）
- **真相优先（spec 2.2）**：类型债修复 = 契约如实收窄/扩字段/OOP 消歧，非抹平——无散落 `!`、无下游 cast、无 `{}` fallback；**零行为变化护栏**（结算纯类型面，行为由既有测试全绿守，不顺手重构）
- **逃逸禁令（spec 2.1/2.2，入 contract-lexicon + guard）**：`@ts-ignore`/`@ts-expect-error` 结算清零且全禁；显式 `any` / `as unknown as X` 默认禁（框架真实边界逐案评审登记）；`!` 限单一类型化 assert helper；fixture 边界 `as T`（`{}` → 真实接口）允许
- **判官单源（spec 2.1/2.4）**：全仓单 `typescript@^7`（root devDeps 新增 + engine devDeps 保留）；`@typescript/typescript6` 删除（零 d.ts 需求 = 零 JS-API 消费实证）；unbuild / jiti / dev-stub / globalSetup 删除（本地直调实证：`node packages/cdd-engine/src/bin.ts --help` exit 0）
- **dev/CI 引擎调用（P5 新链）**：`node packages/cdd-engine/src/bin.ts <subcommand>` 直调（Node ≥22.18 原生 strip），不走 global cdd；**发布面必为编译 JS**（Node 对 `node_modules` 下类型剥离永久禁止——`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING` 实测 + 官方设计意图 + tracker #57215 closed-as-not-planned）——禁止把 `.ts` 源面写入 npm 包
- **先清底再上闸（spec 2.2）**：结算（T1/T2）先行，门禁上闸（T4）在后；发布 `tsc --emit` 前置 = 结算完成（emit 也吃 48 条 src 债）
- **live 面 grep 契约（spec 2.4/acceptance）**：`build.config` / `dev:stub` / `@typescript/typescript6` / `globalSetup` / `@ts-ignore` / `@ts-expect-error` **零命中**（live 面 = CLAUDE.md · `docs/maintainers/05` · engine README 对 · 源面/config 面；历史 spec/plan 正文与发布面 schema/产物除外）；**retired/删除登记不得携带被禁 token 原文**（转述——如「the old dev-stub chain」「the TS6-compat shim」）
- **引擎调用输出零过滤**：无 `tail`/`head`/`2>&1 |`/`EXIT=$?` capture；spec/plan 文档仅 orchestrator（Plan Sole Writer）与 cdd fix-agent 修改，implement agent 零文档修改权（**唯一豁免：T9 overall closeout 回填**——branch-review 预条件 backfill-overall，独立 `docs(kairos):` 提交，见 Task 9）

### commit 边界机制

- 实现提交按任务/合并组粒度（conventional commits，无 attribution trailers）
- T7/T8 同组原子：删除链与发布面同组落地（删除中间态不可验收）；布局/删除步骤先行，发布面跟进
- T9 统一建 changeset：**cdd-engine patch**（bin/files/main/exports/engines 为消费者可见非 breaking——bin 命令名 `cdd` 不变 · 零 API 消费者）；kairos 面改一轮（`type: module` ESM 前置，T4）→ **kairos patch changeset** 一并建（plugin/SKILL 面无 CJS 运行时模块，非 breaking）——并解「kairos 无面不改」原口径
- 每任务闭合面测试绿 + `pnpm run precommit` 绿；`pnpm run validate` 为终验（T9）

### Flow Atomicity

- **T7 → T8**：零构建 arch 收敛 = dev/CI 面（黑盒 re-point + 删除链）与发布面（emit + manifest + README + 实证锚）**同组 `7,8` atomic dispatch**；步骤序 = engine 黑盒 re-point/删除先行（T7 面），发布面跟进（T8 面）
- **T1 → T2**：结算两段（src 结构性 → `__tests__` 机械）独立闸（engine tsconfig 含 `__tests__`，T2 为全树 exit 0 终态）；T1 的 src-零错以「报错全数位于 `__tests__`」为中间判据

### 顺序原则

结算（T1/T2）→ 全仓 .mjs→.ts 迁移（T3）→ 三项目闸 + type-check 块（T4）→ 守卫/词表（T5）→ buildability 双证据（T6）→ 零构建收敛（T7/T8 同组）→ 终验 + changeset + closeout 回填（T9）——先清底再上闸；emit 前置 = 结算完成

---


### Task 1: 类型债结算——engine src 结构性面（48 → src 零错）

- **Objective**: 类型债结算——engine src 结构性面（48 → src 零错）：真相优先修复 finalize/branch/harness/task/docs 等 48 处，零行为变化
- **DependsOn**: none

- **Produces**: `packages/cdd-engine/src/**`（非 __tests__）48 处类型错误真相优先结算（finalize agentHandoff null ×28 · branch 契约如实扩字段 ×8 · harness OOP 消歧 ×4 · task DispatchOp ×2 · docs/registry/resource/write-boundary ×6）；`@ts-ignore`/`@ts-expect-error` 于 src 非 __tests__ 零命中

- **Files**: packages/cdd-engine/src/artifacts/handoff/finalize.ts, packages/cdd-engine/src/dispatch/branch.ts, packages/cdd-engine/src/infra/harness.ts, packages/cdd-engine/src/dispatch/task.ts, packages/cdd-engine/src/dispatch/docs.ts, packages/cdd-engine/src/infra/registry.ts, packages/cdd-engine/src/infra/resource.ts, packages/cdd-engine/src/rules/write-boundary.ts

- **Steps**:
  1. 按 spec 2.2 真相优先清单修复 `packages/cdd-engine/src/**`（非 __tests__）48 处类型错误——`finalize.ts`（agentHandoff null ×27 + validation reason 取窄 ×1：以 payload 型 presence 判别/默认化把 nullable 从类型移除，**零散 `!` 是抹平弃**）；`branch.ts`（round/findings/base ×8：BranchLifecycleOpts 契约如实扩字段 declared truth）；`harness.ts`（detect 撞名 + HarnessRow|{} 的 `{}` fallback 灭——undefined-coalesce 真形态）；`task.ts`（DispatchOp string→union 上游源类型收窄）；docs/registry/resource/write-boundary（path 型收窄 + 判别 union 正确取窄） — checkable: `tsc --noEmit -p packages/cdd-engine/tsconfig.json` 全部报错**位于 `src/**/__tests__/**`**（src 非测试面零错误）
  2. 全程遵守逃逸禁令（无 `@ts-ignore`/`@ts-expect-error`/`any`/双 cast；`!` 仅经单一类型化 assert helper）+ **零行为变化**（不顺手重构、不入新逻辑） — checkable: `@ts-ignore` / `@ts-expect-error` 于 engine src（非 __tests__）零命中
  3. `pnpm --filter @oscaner-skills/cdd-engine test` 全绿（零行为变化）· `pnpm run precommit` 绿 — checkable: engine suite 全绿（零行为变化护栏）· precommit 绿（注：判据用「报错分布」而非 exit 0——exit 0 终态归 T2）

- **Acceptance**:
  - `./packages/cdd-engine/node_modules/.bin/tsc --noEmit -p packages/cdd-engine/tsconfig.json` 全部报错**位于 `src/**/__tests__/**`**（src 非测试面零错误；`__tests__` 存量归属 T2）
  - `@ts-ignore` / `@ts-expect-error` 于 engine src（非 `__tests__`）零命中
  - `pnpm --filter @oscaner-skills/cdd-engine test` 全绿（零行为变化）· `pnpm run precommit` 绿


### Task 2: 类型债结算——`__tests__` 机械面（739 → engine tsc exit 0 = 787→0）

- **Objective**: 类型债结算——`__tests__` 机械面（739 → engine tsc exit 0 = 787→0）：隐式 any/`{}`/catch-unknown/fixture 接口结算
- **DependsOn**: 1

- **Produces**: `__tests__/*.test.ts` 面 739 错误机械结算（TS7006/18046/7031 隐式 any · TS7053/2339 `{}` 上取属性 → fixture 接口 · catch-unknown 收窄 · possible-null 解构 · mock 函数签名）；`@ts-ignore`/`@ts-expect-error` 全仓 engine 面清零；tsc exit 0

- **Files**: packages/cdd-engine/src/**/__tests__/（全测试面）

- **Steps**:
  1. 结算 `packages/cdd-engine/src/**/__tests__/*.test.ts` 面 739 错误——机械族（实测分布 cdd.test.ts 302 / docs-runner.test.ts 73 / handoff-finalize.test.ts 71 / host-detection.test.ts 29 为 Top；模式 = 隐式 any 参数/返回 · `{}` 上取属性（定义 fixture 接口）· catch-unknown 收窄 · possible-null 解构 · mock 函数签名）；fixture 边界 `as T` 允许；逃逸禁令与 T1 同规——**`@ts-ignore`/`@ts-expect-error` 全仓 engine 面清零** — checkable: `tsc --noEmit -p packages/cdd-engine/tsconfig.json` **exit 0**（787→0 终态）；`@ts-ignore`/`@ts-expect-error` 全仓 engine 面清零
  2. `pnpm --filter @oscaner-skills/cdd-engine test` 全绿 · `pnpm run precommit` 绿（零行为变化护栏） — checkable: engine test 全绿 · precommit 绿（注：这是「先清底」的终态点——后续 T4 上闸前以本任务为前置）

- **Acceptance**:
  - `./packages/cdd-engine/node_modules/.bin/tsc --noEmit -p packages/cdd-engine/tsconfig.json` **exit 0**（787→0 终态）
  - `pnpm --filter @oscaner-skills/cdd-engine test` 全绿 · `pnpm run precommit` 绿（零行为变化护栏）


### Task 3: 全仓源面 `.mjs→.ts` 迁移（全代码 TS 化 iron rule）

- **Objective**: 全仓源面 `.mjs→.ts` 迁移（全代码 TS 化 iron rule）：kairos tests 10+1 · render-yaml · vitest/lint-staged configs，产物面零迁移
- **DependsOn**: 2

- **Produces**: kairos tests（10 *.test.mjs + helpers.mjs）→ .test.ts/.ts（import 全 `.ts` 后缀 · 零目录 index 导入）；`scripts/emit/render-yaml.mjs` → .ts；`vitest.config.mjs` / `lint-staged.config.mjs` → .ts；源面 `.mjs` 清零（产物面除外）

- **Files**: packages/kairos/tests/（10 test + helpers）, scripts/emit/render-yaml.mjs, vitest.config.mjs, packages/cdd-engine/vitest.config.mjs, lint-staged.config.mjs

- **Steps**:
  1. `packages/kairos/tests/*.test.mjs`（10 个）+ `helpers.mjs` → `.test.ts`/`.ts`——import 规格符改 `.ts`；**目录 index 导入一律改指非 index 显式文件入口**（nodenext 下目录 index 导入 TS2307）；node:test 语法 strip 兼容（erasable-only） — checkable: kairos 测试面（node:test 经 validate SubprocessBlock / `node --test`）全绿 · root vitest（scripts）全绿 · engine vitest 全绿
  2. `scripts/emit/render-yaml.mjs` → `.ts`（issue-templates.ts + __tests__ 2 处 import 同步）；`vitest.config.mjs`（root + engine）→ `.ts`；`lint-staged.config.mjs` → `.ts` — checkable: `git ls-files | grep '\.mjs$'` 排除 `dist/` 产物面后**零命中**（源面 .mjs 清零）；迁移输出面符合 T4 目标 tsconfig 语义（import 全 .ts 后缀 · 零目录 index 导入）
  3. **产物面零迁移**：`dist/`（发布产物）· `.kairos/`（gitignored 运行时）· `templates/`（内容种子） — checkable: 产物面零迁移（注：迁移产生的 TS7006 隐式 any 族由 T4 结算——类型清零所有权见 Task 4）

- **Acceptance**:
  - kairos 测试面（node:test 经 validate SubprocessBlock / `node --test`）全绿 · root vitest（scripts）全绿 · engine vitest 全绿
  - `git ls-files | grep '\.mjs$'` 排除 `dist/` 产物面后**零命中**（源面 `.mjs` 清零）
  - 迁移输出面符合 T4 目标 tsconfig（nodenext + erasableSyntaxOnly）语义：import 全 `.ts` 后缀 · 零目录 index 导入（机械 grep 可判）；**类型清零不归本任务**——迁移产生的 TS7006 隐式 any 族由 T4 结算（类型清零所有权见 Task 4 Do）


### Task 4: 三项目 tsc 闸 + type-check 块（validate/precommit 双接点）

- **Objective**: 三项目 tsc 闸 + type-check 块（validate/precommit 双接点）+ ESM 检测前置（kairos type:module）+ 迁移 kairos 测试类型清零
- **DependsOn**: 3

- **Produces**: engine tsconfig `erasableSyntaxOnly` + scripts/kairos-tests 两 tsconfig；root typecheck 脚本（三项目 tsc --noEmit）；`scripts/validate/type-check.ts`（SubprocessBlock 双接点）；`packages/kairos/package.json` `"type": "module"`；迁移 kairos 测试类型清零（TS7006/nodenext import 语义）

- **Files**: packages/cdd-engine/tsconfig.json, scripts/tsconfig.json, packages/kairos/tests/tsconfig.json, package.json, scripts/validate/type-check.ts, scripts/validate/index.ts, scripts/validate/pre-commit.ts, packages/kairos/package.json

- **Steps**:
  1. `packages/cdd-engine/tsconfig.json` 加 **`erasableSyntaxOnly: true`** + include 加 vitest.config.ts；新建 `scripts/tsconfig.json`（nodenext + allowImportingTsExtensions + strict + erasableSyntaxOnly；include scripts + root configs）；新建 `packages/kairos/tests/tsconfig.json`（同 scripts 语义） — checkable: 三项目 tsconfig 在位且覆盖全迁移 TS 面
  2. **ESM 检测前置**：`packages/kairos/package.json` 增 `"type": "module"`（nodenext 下 import.meta 测试 TS1470 实测；kairos 纯 SKILL/plugin 面 ESM 化安全）；**迁移 kairos 测试类型清零显式归本任务**——迁移产生的 TS7006 隐式 any 族 + nodenext import 语义错误（目录 index / T1470）专清 — checkable: `pnpm run typecheck` exit 0（engine/scripts/kairos-tests 三项目零错误）
  3. root `package.json` `"typecheck": "tsc --noEmit -p packages/cdd-engine && tsc --noEmit -p scripts && tsc --noEmit -p packages/kairos/tests"` + devDependencies typescript@^7.0.2 → `pnpm install`；新建 `scripts/validate/type-check.ts`（SubprocessBlock）compose 进 index.ts（终验）+ pre-commit.ts（提交）双接点；validate step 名断言面同步 — checkable: `pnpm run precommit` 绿（含新 type-check 块）· `node scripts/run.ts validate` type-check 块 OK；validate step 名断言（name-set/lockstep pin）同步后全绿

- **Acceptance**:
  - `pnpm run typecheck` exit 0（engine/scripts/kairos-tests 三项目零错误）
  - `pnpm run precommit` 绿（含新 type-check 块）· `node scripts/run.ts validate`（或对应块级别）type-check 块 OK
  - validate step 名断言（若存在 name-set/lockstep pin）同步后全绿


### Task 5: 逃逸禁令 + residue/lexicon 守卫升级

- **Objective**: 逃逸禁令 + residue/lexicon 守卫升级（WordTable 内核 + 所有权分裂 + 三族分层）
- **DependsOn**: 4

- **Produces**: ContractLexiconGuard 扩逃逸零命中 + residue 目标升全仓源面零 .mjs + checkWording 零债措辞；`contract-lexicon.json` 三族分层（command/guards/schema）+ 统一叶约定；`scripts/lib/guard-lexicon.json`（guards 迁出）；`src/infra/word-table.ts` 类型化视图 + `config/schema/contract-lexicon.json`（第 9 schema）；死代码即删

- **Files**: scripts/lib/contract-lexicon.ts, packages/cdd-engine/config/contract-lexicon.json, scripts/lib/guard-lexicon.json, packages/cdd-engine/src/infra/word-table.ts, packages/cdd-engine/config/schema/contract-lexicon.json, packages/cdd-engine/src/infra/resource.ts

- **Steps**:
  1. `ContractLexiconGuard`：扩 **逃逸零命中检查**（`@ts-ignore`/`@ts-expect-error` 于 engine src + scripts + kairos tests + 源配置面 = 零）+ **residue 目标升全仓源面零 `.mjs`** + checkWording 零债措辞断言 — checkable: guard 对四消费面断言全绿；guard 逃逸零命中 + 源面 .mjs 零命中（产物面除外）
  2. `contract-lexicon.json`（engine）三族分层（`command`（status/capsule/route）· `guards`（residue/escape/zeroDebt/buildability）· `schema`（anatomy））+ 统一叶约定（机器 token 一律数组 · 措辞一律 wording · `_doc` 中性化）；**所有权分裂**：command + schema 留 engine；guards 迁 `scripts/lib/guard-lexicon.json`——引擎包零守卫词残留（ship 面死载荷抽干） — checkable: WordTable 内核落地：三族分层 json · `config/schema/contract-lexicon.json` 存在且 validate 适配 · guards 零引擎包残留 · 全仓零 lexicon 旧字段字面（grep 断言）
  3. **引擎反读兑现 C6 意图**：新增 `src/infra/word-table.ts` 类型化视图（构造注入 + 构造时 schema 校验 + vocab()/wording()/tokens()/ref() 访问器）；capsule 输出点改数据出词（代码零词面重复）；新建 `config/schema/contract-lexicon.json`（第 9 schema，additionalProperties: false）；**死代码、空壳即删**（旧 #lexicon.* 逐字段读面全删 · 引擎去真源化后旧字面量即删） — checkable: 引擎 word-table 视图访问器消费（capsule 出词自数据）；`pnpm run precommit` 绿（注：T5 在 T3/T2 之后——迁移/清零完成才有可判据的零面）

- **Acceptance**:
  - guard 对四消费面断言全绿（root 相应 validate 块 + `pnpm --filter @oscaner-skills/cdd-engine test`）
  - guard 逃逸零命中（engine src + scripts + kairos tests + 源配置面）· 源面 `.mjs` 零命中（产物面除外）· 全量 live 面（含 docs 面）逃逸 token 零命中由 T7 live 面 grep 闸验收兜底
  - `pnpm run precommit` 绿
  - WordTable 内核落地：三族分层 json 形态 · `config/schema/contract-lexicon.json` 存在且 validate 适配 · 引擎 word-table 视图访问器消费（capsule 出词自数据）· `guards` 零引擎包残留（`scripts/lib/guard-lexicon.json` 在位）· 全仓零 lexicon 旧字段字面（grep 断言）


### Task 6: cdd 闭环 buildability 双证据（evidence + lensEnum + axesGuide + 断言）

- **Objective**: cdd 闭环 buildability 双证据（evidence + lensEnum + axesGuide + review next: 读回提示）
- **DependsOn**: 5

- **Produces**: reviews.task/branch `lensEnum` 增 `"buildability"` + axesGuide buildability 轴（tsc+test 双证据）；implement Evidence gate 扩 `typecheck` 项（缺 → BLOCKED）；`NextStepRouter` next-line 附 `(read <handoff> back to confirm)`；测试断言（templates.test / registry.test 只读消费）

- **Files**: packages/cdd-engine/config/template-contract.json, packages/cdd-engine/src/rules/next-step.ts, packages/cdd-engine/src/cli/result-face.ts, packages/cdd-engine/src/render/brief.ts

- **Steps**:
  1. `template-contract.json`：`reviews.task` / `reviews.branch` 的 **`lensEnum` 增 `"buildability"`**（REVIEW_LENS_GUIDE 自动派生）+ 对应 axesGuide 补 buildability 轴——reviewer 显式跑 `tsc --noEmit` + 测试，findings lens-tag buildability 自证；命令用**转译描述**（不硬编码 pnpm/npm，消费仓 toolchain 自洽） — checkable: `templates.test.ts`/`registry.test.ts` 断言 task+branch `lensEnum` 含 buildability 且 axesGuide 含双证据文句（tsc + test token）
  2. implement Evidence gate：task-family evidence 文件扩 **`typecheck` 项**（`command`/`exit_code`/`passed`，与 `test` 项同构）——engine 读回核验，缺任一 → `status: BLOCKED`（与 `behavior_change` 缺失同型） — checkable: engine 测试断言 evidence `typecheck` 字段结构 + 缺项→BLOCKED 读回
  3. **路由说明（review→fix 输出面）**：`NextStepRouter` next-line 生成补携 **(read <handoff> back to confirm)** 说明（派发者 fix 前读回 findings handoff 确认）+ result-face/next-step 测试断言 + contract-lexicon next: 读回措辞**只读断言消费**（措辞写权全归 T5） — checkable: review `next:` fix 建议载 `(read <handoff> back to confirm)`（NextStepRouter next-line 断言绿）；SKILL 面零动 · README/CLAUDE.md 无消费故事变更

- **Acceptance**:
  - engine suite 全绿（含新断言：lensEnum 成员 + axesGuide 文句 + evidence `typecheck` 字段结构 + 缺项→BLOCKED 读回）
  - `templates.test.ts`/`registry.test.ts` 新断言绿 · contract-lexicon guard 绿 · `pnpm run precommit` 绿
  - review `next:` fix 建议载 `(read <handoff> back to confirm)`（NextStepRouter next-line 断言绿）


### Task 7: 零构建 dev/CI 面 + 删除层（与 Task 8 同组 dispatch）

- **Objective**: 零构建 dev/CI 面 + 删除层（与 Task 8 同组 dispatch）：黑盒 re-point src/bin.ts + unbuild/dev-stub 删除 + live 面 grep 禁止 token 零命中
- **DependsOn**: 6

- **Produces**: engine vitest 黑盒（9 CDD_MJS · 11 execa）全改指 `node packages/cdd-engine/src/bin.ts`；`globalSetup` self-stub 删除；smoke-cdd pin 改指 src/bin.ts；删除层（unbuild + @typescript/typescript6 + build.config.ts + build/dev:stub scripts）；CLAUDE.md / maintainers 05 转述更新

- **Files**: packages/cdd-engine/src/（黑盒测试面）, scripts/validate/smoke-cdd.ts, packages/cdd-engine/package.json, packages/cdd-engine/build.config.ts, packages/cdd-engine/vitest.config.mjs, CLAUDE.md, docs/maintainers/05-third-party-dependencies.md

- **Steps**:
  1. engine vitest 黑盒：**9 处 `const CDD_MJS` 定义 · 11 处 execa 调用**（cdd.test.ts / host-detection.test.ts / base-branch.test.ts 等）全改指 **`node packages/cdd-engine/src/bin.ts`**（spawn 命令字面），`globalSetup` self-stub（缺 dist 自动 dev:stub 逻辑）**删除**；validate `smoke-cdd.ts` pin 改指 src/bin.ts — checkable: engine suite 全绿（黑盒经 `src/bin.ts` spawn——`CDD_MJS` 族改指后零 `dist/cli.mjs` 引用）；`node packages/cdd-engine/src/bin.ts --help` exit 0
  2. **删除层（死壳即删）**：engine devDependencies 删 `unbuild` + `@typescript/typescript6`（typescript@^7.0.2 保留）· 删 `packages/cdd-engine/build.config.ts` · engine package.json 删 `build`/`dev:stub` scripts（后续 T8 重建 build = tsc emit）· `pnpm install` 重写锁文件 · engine tsconfig include 移除 build.config.ts 行 — checkable: live 面 grep 零命中：`build.config` / `dev:stub` / `@typescript/typescript6` / `globalSetup` / `@ts-ignore` / `@ts-expect-error`（live 面 = CLAUDE.md · maintainers 05 · engine README 对 · 源面/config 面；历史 spec/plan 正文与发布面 schema/产物除外）
  3. CLAUDE.md「Development-time CDD invocation」→ **`node packages/cdd-engine/src/bin.ts <subcommand>`** 直调（dev:stub 叙述删除）；`docs/maintainers/05-third-party-dependencies.md` unbuild 登记改 **retired** + TS6 prose 转述——**不得携带被禁 token 原文** — checkable: root vitest 绿 · `pnpm run precommit` 绿（注：本任务删目录面，但发布面（T8）仍在同组——删除中态不可验收，同组 atomic）


- **Acceptance**:
  - engine suite 全绿（黑盒经 `src/bin.ts` spawn——`CDD_MJS` 族改指后零 `dist/cli.mjs` 引用）· root vitest 绿 · `pnpm run precommit` 绿
  - live 面 grep 零命中：`build.config` / `dev:stub` / `@typescript/typescript6` / `globalSetup` / `@ts-ignore` / `@ts-expect-error`（live 面 = CLAUDE.md · `docs/maintainers/05` · engine README 对 · 源面/config 面——逃逸 token 并入本列表，与 T5 guard 合计 = 完整 live 面；历史 spec/plan 正文与发布面 schema/产物除外，live 面定义同 Constraints 契约）
  - `node packages/cdd-engine/src/bin.ts --help` exit 0


### Task 8: 发布面（tsc-emit 单工具）+ 实证锚（与 Task 7 同组 dispatch）

- **Objective**: 发布面（tsc-emit 单工具）+ 实证锚（与 Task 7 同组 dispatch）：tsconfig.build + bin/main/exports/files/engines + pack→install 实证
- **DependsOn**: 6

- **Produces**: `tsconfig.build.json`（rewriteRelativeImportExtensions + outDir dist + exclude __tests__）；engine package.json（`bin` → dist/bin.js · main/exports → dist/bin.js · files → [dist/config/templates] · engines ≥22.18.0 · build = tsc -p）；engine README 对更新；实证锚（pack → 临时仓 install → .bin/cdd --help exit 0）

- **Files**: packages/cdd-engine/tsconfig.build.json, packages/cdd-engine/package.json, packages/cdd-engine/README.md, packages/cdd-engine/README.zh-CN.md

- **Steps**:
  1. 新建 `packages/cdd-engine/tsconfig.build.json`：nodenext · rewriteRelativeImportExtensions · noEmit: false · outDir dist · rootDir src · exclude `**/__tests__/**` · typeRoots 显式 engine node_modules/@types · verbatimModuleSyntax/erasableSyntaxOnly/strict/skipLibCheck 保持 — checkable: `tsc -p tsconfig.build.json` exit 0（发布 emit）· 产物 `dist/bin.js` shebang 保留 + 相对 import 全 `.js`（无 .ts 残留引用）
  2. engine `package.json`：`bin` → `{"cdd": "dist/bin.js"}` · `main`/`exports["."]` → `./dist/bin.js` · `files` → `["dist/","config/","templates/"]`（**`src/` 零 ship**——发布必 JS）· `engines` → `>=22.18.0` · 重建 `"build"` script = `tsc -p tsconfig.build.json && <config→dist/config copy>`；engine README 对 toolchain/dev-invocation 段 → `node packages/cdd-engine/src/bin.ts`、移除 dev:stub/dist/cli.mjs 引用 — checkable: `pnpm pack` 产物含 `package/dist/bin.js`、**不含 `package/src/`**；engine README 对 live 面零 `dev:stub`/`dist/cli.mjs`（grep；发布面 schema/产物除外）
  3. **实证锚**：`pnpm pack`（packages/cdd-engine，目标 files/bin）→ 临时项目 `npm install <tgz>` → `.bin/cdd --help` + `schema get overall` 走真实引擎栈（包装面双探针；dev 面 node src/bin.ts 冒烟已在 T7 验） — checkable: 临时安装 `.bin/cdd --help` exit 0（`schema get overall` 同栈探针）；engine suite 全绿 · `pnpm run precommit` 绿（注：发布 tsc --emit 前置 = T2 结算；`dist/cli.mjs` 名随 unbuild 退役）


- **Acceptance**:
  - `tsc -p tsconfig.build.json` exit 0（发布 emit）· 产物 `dist/bin.js` shebang 保留 + 相对 import 全 `.js`（无 `.ts` 残留引用）
  - `pnpm pack` 产物含 `package/dist/bin.js`、**不含 `package/src/`**；临时安装 `.bin/cdd --help` exit 0
  - engine README 对 live 面零 `dev:stub`/`dist/cli.mjs`（grep；发布面 schema/产物除外）
  - engine suite 全绿 · `pnpm run precommit` 绿


### Task 9: 终验 + changeset + overall closeout 回填

- **Objective**: 终验 + changeset + overall closeout 回填（validate ALL PASS + cdd-engine/kairos patch changesets + P5 closeout v1.28）
- **DependsOn**: 7

- **Produces**: `pnpm run validate` 全块全绿（type-check 块 · engine suite · scripts suite · kairos tests（.ts 迁后）· residue/lexicon guard · emit 面）；changesets（cdd-engine patch + kairos patch）；overall v1.28 closeout 回填（两列 Done + change-history + v1.27 计数修正）

- **Files**: .changeset/（cdd-engine + kairos 两件）, docs/kairos/specs/2026-09-27-pi-harness-overall.md

- **Steps**:
  1. `pnpm run validate` 全块全绿（type-check 块 · engine suite · scripts suite · kairos tests（.ts 迁后）· residue/lexicon guard · emit 面）；**acceptance 复验对照 spec**（逐条核 2.1–2.4 acceptance：三项目 tsc 0 · 双接点绿 · 全仓源面零 .mjs · 删除面 grep 零命中 · pack→install→bin 实证 · buildability 双证据 · 黑盒全指 src/bin.ts） — checkable: `pnpm run validate` **ALL PASS**
  2. changeset：`pnpm run changeset` 建 **cdd-engine patch**（bin/files/main/exports/engines + 构建面收敛，消费者可见非 breaking）+ **kairos patch changeset**（`type: module` ESM 前置面改，T4） — checkable: `.changeset/*.md` 存在（cdd-engine patch + kairos patch）；P5 plan closeout 链（branch-review 预条件）满足
  3. overall **v1.28 closeout 回填**（branch-review 预条件 backfill-overall；Constraints「零文档修改权」显式豁免——独立 `docs(kairos):` conventional commit）：P5 Design spec / Implementation plan 列 → Done + change-history 行（spec v1.3 / plan 最终已批版本号——closeout 时点实态回填）+ **v1.27 计数修正落地**（`kairos tests×11` → `10 *.test.mjs + 1 helpers.mjs`） — checkable: overall v1.28 四表一致（Issue inventory P5 计数修正 · Phase inventory P5 两列 Done · 依赖图不变 · change-history v1.28）（注：changeset 类型终审在任务内——若发布面意外带 breaking 升 major，实态为准）

- **Acceptance**:
  - `pnpm run validate` **ALL PASS**
  - `.changeset/*.md` 存在（cdd-engine patch + kairos patch）· P5 plan closeout 链（branch-review 预条件）满足
  - overall v1.28 四表一致（Issue inventory P5 计数修正 · Phase inventory P5 两列 Done · 依赖图不变 · change-history v1.28）

## Change history

| Version | date | summary | author |
|---|---|---|---|
| v1.1 |  | plan-review-1 五 finding 落地：ESM 检测前置 + 迁移 kairos 测试类型清零归位（T4）· src 48 精确枚举收敛 · contract-lexicon 写权归一（T5）· T9 closeout 豁免 + 版本实态回填口径 · T9 changeset 并解 kairos type:module | [human] |
| v1.2 |  | Plan Sole Writer 补入：review `next:` fix 建议附 `(read <handoff> back to confirm)`（user 2026-10-02 mid-flight，spec 2.3/v1.3 联动） | [human] |
| v1.3 | 2026-10-02 | P5 编译面收敛与结算：结算 → 迁移 → 上闸 → 守卫 → buildability → 零构建收敛 → 终验；T7/T8 同组 atomic；plan-review-2 三 finding 落地：T6 路由 bullet 词表改只读断言消费（写权归一 T5——`next:` 读回措辞纳入 T5 全量词表 scope，删条件式写权）· T4 validate 断言面改指迁移后 `ci-validate.test.ts` · 逃逸 grep 目标补源配置面 + docs 面零命中归 T7 live 面 grep（双任务 grep 面 = spec acceptance 全量 live 面） | [human] |
| v1.4 | 2026-10-02 | P5 mid-flight backfill（user 2026-10-02 词表形态裁定，Plan Sole Writer）：T5 Do 增 **WordTable 内核**——三族分层 + 统一叶约定 + 第 9 schema + 视图类 validate-on-load；**所有权分裂**（command/schema = 引擎契约事实留 engine 且引擎反读出词；guards = 运维验证事实迁 scripts/lib/guard-lexicon.json）；死代码空壳即删清单（引擎字面量去真源化 / 旧守卫读面归零 / ship 面死载荷抽干） | [human] |
