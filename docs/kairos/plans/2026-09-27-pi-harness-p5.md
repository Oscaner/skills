# Pi Harness P5 实施计划（Pi Harness P5 Implementation Plan）

**Spec:** [2026-09-27-pi-harness-p5-design.md](docs/kairos/specs/2026-09-27-pi-harness-p5-design.md)

- **Parent program**: [2026-09-27-pi-harness-overall.md v1.27](docs/kairos/specs/2026-09-27-pi-harness-overall.md)
- **Version**: v1.3 · 2026-10-02（P5 编译面收敛与结算：结算 → 迁移 → 上闸 → 守卫 → buildability → 零构建收敛 → 终验；T7/T8 同组 atomic）。v1.0 → v1.1 = plan-review-1 五 finding 落地：ESM 检测前置 + 迁移 kairos 测试类型清零归位（T4）· src 48 精确枚举收敛 · contract-lexicon 写权归一（T5）· T9 closeout 豁免 + 版本实态回填口径 · T9 changeset 并解 kairos type:module。v1.1 → v1.2 = Plan Sole Writer 补入：review `next:` fix 建议附 `(read <handoff> back to confirm)`（user 2026-10-02 mid-flight，spec 2.3/v1.3 联动）。v1.2 → v1.3 = plan-review-2 三 finding 落地：T6 路由 bullet 词表改只读断言消费（写权归一 T5——`next:` 读回措辞纳入 T5 全量词表 scope，删条件式写权）· T4 validate 断言面改指迁移后 `ci-validate.test.ts` · 逃逸 grep 目标补源配置面 + docs 面零命中归 T7 live 面 grep（双任务 grep 面 = spec acceptance 全量 live 面）
- **Depends on**: P5 design v1.3 Approved（`18d30c16` review r1+r2 收口 + `f3e78471` v1.3 design backfill）
- **Base**: develop

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

## Section 1: 任务总览——文件结构图（实施落点）

| 面 | 文件 | 责任 | 任务 |
|---|---|---|---|
| engine 源 | `packages/cdd-engine/src/**`（非测试） | 类型债 src 面（48）真相优先结算 | T1 |
| engine 测试 | `packages/cdd-engine/src/**/__tests__/*.test.ts` | 类型债测试面（739）机械结算 | T2 |
| kairos 测试 | `packages/kairos/tests/*.test.mjs` + `helpers.mjs` | `.mjs→.ts` 迁移 | T3 |
| emit 模块 | `scripts/emit/render-yaml.mjs` | `.mjs→.ts` 迁移 + import 同步 | T3 |
| 配置面 | `vitest.config.mjs`（root+engine）· `lint-staged.config.mjs` | `.mjs→.ts` 迁移 | T3 |
| 闸面 | engine/scripts/kairos-tests 三 tsconfig · root `typecheck` · `scripts/validate/type-check.ts` | 三项目 tsc 闸 + validate/precommit 双接点 | T4 |
| 守卫面 | `scripts/lib/contract-lexicon.ts` + `contract-lexicon.json` + residue 面 | 逃逸禁令 + 全仓源面零 .mjs | T5 |
| 引擎契约 | `config/template-contract.json`（reviews/evidence）· engine 读回逻辑 + schema · `templates.test.ts`/`registry.test.ts` | buildability 双证据 | T6 |
| 开发面 | engine vitest 黑盒（9 CDD_MJS · 11 execa）· smoke-cdd · CLAUDE.md · `docs/maintainers/05` | dev/CI 零构建 + 删除层 | T7 |
| 发布面 | `tsconfig.build.json` · engine package.json（bin/main/exports/files/engines）· engine README 对 | tsc-emit 发布 + 实证锚 | T8 |
| 终验 | validate 全块 · `.changeset/` · overall v1.28 | 终验 + changeset + closeout 回填 | T9 |

## Section 2: 任务分解

### Task 1: 类型债结算——engine src 结构性面（48 → src 零错）

- **Do**: 按 spec 2.2 真相优先清单修复 `packages/cdd-engine/src/**`（非 `__tests__`）48 处类型错误：
  - `src/artifacts/handoff/finalize.ts`（`agentHandoff` null ×27 + validation `reason` 取窄 ×1（TS2339 @567）——共 28）：重审 write→finalize 契约——载荷在 finalize 时点结构上不可能为 null；以 payload 型 presence 判别 / 默认化把 nullable 从类型中移除（**零散 `!` 是抹平，弃**）
  - `src/dispatch/branch.ts`（`round`/`findings`/`base` ×8）：`BranchLifecycleOpts` 契约**如实扩字段**（declared truth——`round` 对 crash record、`findings` 对判定源计数、`base` 对 diff 面）
  - `src/infra/harness.ts`（`detect` 撞名 TS2300 ×2 + `HarnessRow|{}` TS2322 ×2——共 4）：OOP 消歧（Harness 抽象 `detect(env)` 谓词与右侧重命名/信号归一）；`HarnessRow | {}` 的 `{}` fallback 灭——undefined-coalesce 真形态，call site 单点处理
  - `src/dispatch/task.ts`（`DispatchOp` string→union ×2）：上游源类型收窄（`mode`/op 派生点），非下游 cast
  - `src/dispatch/docs.ts`（×2）/ `src/infra/registry.ts`（×1）/ `src/infra/resource.ts`（×1）/ `src/rules/write-boundary.ts`（×2）：path 型收窄 + 判别 union 正确取窄（28+8+4+2+2+1+1+2 = 48）
  - 全程遵守逃逸禁令（无 `@ts-ignore`/`@ts-expect-error`/`any`/双 cast；`!` 仅经单一类型化 assert helper）+ **零行为变化**（不顺手重构、不入新逻辑）
- **验收**:
  - `./packages/cdd-engine/node_modules/.bin/tsc --noEmit -p packages/cdd-engine/tsconfig.json` 全部报错**位于 `src/**/__tests__/**`**（src 非测试面零错误；`__tests__` 存量归属 T2）
  - `@ts-ignore` / `@ts-expect-error` 于 engine src（非 `__tests__`）零命中
  - `pnpm --filter @oscaner-skills/cdd-engine test` 全绿（零行为变化）· `pnpm run precommit` 绿
- **注**: 判据用「报错分布」而非 exit 0（exit 0 终态归 T2）；src 面修复不改任何运行时行为，engine suite 为护栏

### Task 2: 类型债结算——`__tests__` 机械面（739 → engine tsc exit 0 = 787→0）

- **Do**: 结算 `packages/cdd-engine/src/**/__tests__/*.test.ts` 面 739 错误——机械族（实测分布 `cdd.test.ts` 302 / `docs-runner.test.ts` 73 / `handoff-finalize.test.ts` 71 / `host-detection.test.ts` 29 为 Top；模式 = 隐式 any 参数/返回（TS7006/18046/7031）· `{}` 上取属性（TS7053/2339 → 定义 fixture 接口）· catch-unknown 收窄 · possible-null 解构（`r.handoff` 族 → 真收窄或 fixture 非空构型）· mock 函数签名（`new (unknown)` / spread / execa-spawn 形参））；fixture 边界 `as T` 允许；逃逸禁令与 T1 同规——**`@ts-ignore`/`@ts-expect-error` 全仓 engine 面清零**
- **验收**:
  - `./packages/cdd-engine/node_modules/.bin/tsc --noEmit -p packages/cdd-engine/tsconfig.json` **exit 0**（787→0 终态）
  - `pnpm --filter @oscaner-skills/cdd-engine test` 全绿 · `pnpm run precommit` 绿（零行为变化护栏）
- **注**: 这是「先清底」的终态点——后续 T4 上闸前以本任务为前置

### Task 3: 全仓源面 `.mjs→.ts` 迁移（全代码 TS 化 iron rule）

- **Do**: 按 spec 2.1 迁移清单：
  - `packages/kairos/tests/*.test.mjs`（**10 个**：cdd-plan-spec / ci-validate / grep-sweep-regression / maintainers-docs / no-gate / pi-install-smoke / pi-package / presentation-surface / review-loop-clean-tree / status-routing-convergence）+ `helpers.mjs`（1 个）→ `.test.ts`/`.ts`——import 规格符改 `.ts`（含跨项目 `../../../scripts/validate/kairos.ts` 先例扩展为一致性）；**目录 index 导入（如 `../../../scripts/validate/index.ts`）一律改指非 index 显式文件入口**——nodenext 下目录 index 导入 TS2307（runtime 先例成立、typecheck 先例不成立）；node:test 语法 strip 兼容（erasable-only）
  - `scripts/emit/render-yaml.mjs` → `.ts`（`scripts/emit/issue-templates.ts` + `scripts/emit/__tests__/issue-templates.test.ts` 2 处 import 同步）
  - `vitest.config.mjs`（root + `packages/cdd-engine`）→ `vitest.config.ts`；`lint-staged.config.mjs` → `lint-staged.config.ts`
  - **产物面零迁移**：`dist/`（发布产物）· `.kairos/`（gitignored 运行时）· `templates/`（内容种子）
- **验收**:
  - kairos 测试面（node:test 经 validate SubprocessBlock / `node --test`）全绿 · root vitest（scripts）全绿 · engine vitest 全绿
  - `git ls-files | grep '\.mjs$'` 排除 `dist/` 产物面后**零命中**（源面 `.mjs` 清零）
  - 迁移输出面符合 T4 目标 tsconfig（nodenext + erasableSyntaxOnly）语义：import 全 `.ts` 后缀 · 零目录 index 导入（机械 grep 可判）；**类型清零不归本任务**——迁移产生的 TS7006 隐式 any 族由 T4 结算（类型清零所有权见 Task 4 Do）
- **注**: 迁移是 T4 闸面覆盖（scripts/kairos-tests include）与 T5 守卫（全仓源面零 .mjs）的前置——先迁移后上闸

### Task 4: 三项目 tsc 闸 + type-check 块（validate/precommit 双接点）

- **Do**: 按 spec 2.1：
  - `packages/cdd-engine/tsconfig.json`：加 **`erasableSyntaxOnly: true`**（Node strip 运行契约镜像——engine 即主 strip 运行时）；include 加 `vitest.config.ts`（config 面并入闸；`build.config.ts` 行由 T7 删除后移除）
  - 新建 `scripts/tsconfig.json`：`module: nodenext` · `moduleResolution: nodenext` · `allowImportingTsExtensions: true` + `noEmit: true` · `strict: true` · `skipLibCheck` · **`erasableSyntaxOnly: true`**；include `scripts/**/*.ts`（含 emit / observe-cache / `__tests__`）**+ root `vitest.config.ts` / `lint-staged.config.ts`**
  - 新建 `packages/kairos/tests/tsconfig.json`：同 scripts 语义（node:test 直跑面）；include tests 面
  - **ESM 检测前置**：`packages/kairos/package.json` 增 `"type": "module"`（实测缺失——nodenext 下用 `import.meta` 的迁移测试 TS1470；kairos 纯 SKILL/plugin 面、无 CJS 运行时 JS 模块，ESM 化安全）；changeset 联动口径由 T9 并解（kairos patch changeset，见 commit 边界机制）
  - **迁移 kairos 测试类型清零显式归本任务**（T3 只保迁移格式/规格，不背类型债）：迁移产生的 TS7006 隐式 any 族 + nodenext import 语义错误（目录 index 导入 / T1470 类）随本任务专清——结算后 `pnpm run typecheck` 三项目零错（本任务验收自带判据）
  - root `package.json`：`"typecheck": "tsc --noEmit -p packages/cdd-engine && tsc --noEmit -p scripts && tsc --noEmit -p packages/kairos/tests"`；devDependencies 增 `typescript@^7.0.2`（判官单源，与 engine 拉齐）→ `pnpm install` 锁文件更新
  - 新建 `scripts/validate/type-check.ts`：导出 steps（`SubprocessBlock` cmd=`pnpm` args=`run typecheck`）；compose 进 `scripts/validate/index.ts`（终验）+ `scripts/validate/pre-commit.ts`（提交）**双接点**；validate step 名/order 断言面（`ci-validate.test.ts` / `pre-commit.test.ts` 类 name-set——迁移后文件名）同步含新块
- **验收**:
  - `pnpm run typecheck` exit 0（engine/scripts/kairos-tests 三项目零错误）
  - `pnpm run precommit` 绿（含新 type-check 块）· `node scripts/run.ts validate`（或对应块级别）type-check 块 OK
  - validate step 名断言（若存在 name-set/lockstep pin）同步后全绿
- **注**: 三项目 include 面总覆盖 = 全迁移 TS 面（含配置面——`.mjs→ts` 后任一 TS 文件被恰一项目盘到）；build.config 残留行 T7 随删除链清理

### Task 5: 逃逸禁令 + residue/lexicon 守卫升级

- **Do**: 按 spec 2.1/2.2 零债口径：
  - `scripts/lib/contract-lexicon.ts`（ContractLexiconGuard）：扩 **逃逸零命中检查**（`@ts-ignore`/`@ts-expect-error` 于 engine src + scripts + kairos tests + 源配置面 = 零——与同任务 `.mjs` residue 目标准口径对齐；docs 面逃逸 token 由 T7 live 面 grep 兜底）+ **residue 目标升全仓源面零 `.mjs`**（engine src + scripts + kairos tests + 源配置面；产物面 `dist/` 除外）+ checkWording 对零债措辞断言
  - `config/contract-lexicon.json`（engine）词表补**全量**：逃逸禁令 / 零债 / buildability 双证据 / review `next:` 读回措辞（`(read <handoff> back to confirm)` 附注——restate 与否与补全均在本任务定）——**词表写权全归本任务**（T6 只读断言消费，不新增词表）
  - 相应 guard 测试（`scripts/lib/__tests__/` + engine residue/lexicon 测试面）延展
- **验收**:
  - guard 对四消费面断言全绿（root 相应 validate 块 + `pnpm --filter @oscaner-skills/cdd-engine test`）
  - guard 逃逸零命中（engine src + scripts + kairos tests + 源配置面）· 源面 `.mjs` 零命中（产物面除外）· 全量 live 面（含 docs 面）逃逸 token 零命中由 T7 live 面 grep 闸验收兜底
  - `pnpm run precommit` 绿
- **注**: T5 在 T3/T2 之后（迁移/清零完成才有可判据的零面）；词表面与 T6 buildability 共用 contract-lexicon 单文件

### Task 6: cdd 闭环 buildability 双证据（evidence + lensEnum + axesGuide + 断言）

- **Do**: 按 spec 2.3 双槽：
  - `packages/cdd-engine/config/template-contract.json`：`reviews.task` / `reviews.branch` 的 **`lensEnum` 增 `"buildability"`**（dispatch 的 REVIEW_LENS_GUIDE 由 `lensEnum.join(" · ")` 自动派生——无独立 prompt 改动）+ 对应 **axesGuide 补 buildability 轴**——reviewer 在评审中**显式跑** `tsc --noEmit`（或该仓等价）+ 测试，findings lens-tag `buildability` 自证「双命令已跑」；命令用**转译描述**（不硬编码 pnpm/npm，消费仓 toolchain 自洽）
  - implement Evidence gate：task-family evidence 文件扩 **`typecheck` 项**（`command`/`exit_code`/`passed`，与既有 `test` 项同构）——engine 读回核验，缺任一 → `status: BLOCKED`（与 `behavior_change` 缺失同型）；相应 schema（evidence 形态）延展 + 读回逻辑
  - 守卫测试：`templates.test.ts` / `registry.test.ts`（engine）断言 task+branch `reviewTypeConfig` 的 **`lensEnum` 含 `"buildability"` 且 axesGuide 含 buildability 双证据文句**（`tsc` + `test` token）——两条并判，lens-tag 才可执行
  - ContractLexicon buildability 措辞经 checkWording + templates.test/registry.test 断言消费（**只读**——措辞写权全归 T5，本任务仅断言词表已含 buildability 双证据措辞，不新增词表）
  - **路由说明（review→fix 输出面，user 2026-10-02 mid-flight —— spec 2.3 联动）**：review 的 `next:` fix 建议附 **`(read <handoff> back to confirm)`** 说明——`NextStepRouter`（C5 决策表）next-line 生成补携该读回提示 + 对应 result-face/next-step 测试断言 + contract-lexicon `next:` 读回措辞**只读断言消费**（**只读**——restate 与否及措辞补全全归 T5 全量词表 scope，本任务仅断言词表已含该措辞、不新增词表；与同任务 buildability 措辞行同构，不产生第二写权）——派发者在 fix 前读回 findings handoff 确认再 dispatch（本 phase 亲历先例：plan-review-1 先手读 handoff）
  - **SKILL 面零动**（P3 zero-restate + P5 实测零命中）· README/CLAUDE.md 无消费故事变更
- **验收**:
  - engine suite 全绿（含新断言：lensEnum 成员 + axesGuide 文句 + evidence `typecheck` 字段结构 + 缺项→BLOCKED 读回）
  - `templates.test.ts`/`registry.test.ts` 新断言绿 · contract-lexicon guard 绿 · `pnpm run precommit` 绿
  - review `next:` fix 建议载 `(read <handoff> back to confirm)`（NextStepRouter next-line 断言绿）
- **注**: lensEnum 是机制面（REVIEW_LENS_GUIDE 派生），axesGuide 是措辞面——两处同改，守卫并判；plan（doc) review 的 lensEnum 已含 buildability（现成先例）

### Task 7: 零构建 dev/CI 面 + 删除层（与 Task 8 同组 dispatch）

- **Do**: 按 spec 2.4：
  - engine vitest 黑盒：**9 处 `const CDD_MJS` 定义 · 11 处 execa 调用**（`cdd.test.ts` / `host-detection.test.ts` / `base-branch.test.ts` 等）全改指 **`node packages/cdd-engine/src/bin.ts`**（spawn 命令字面），`globalSetup` self-stub（缺 dist 自动 `dev:stub` 逻辑）**删除**
  - validate `smoke-cdd.ts` pin（engine 黑盒/冒烟 spawn 面）改指 `src/bin.ts`
  - **删除层（死壳即删）**：engine `devDependencies` 删 `unbuild` + `@typescript/typescript6`（`typescript@^7.0.2` 保留）· 删 `packages/cdd-engine/build.config.ts` · engine package.json 删 `build`/`dev:stub` scripts（后续 T8 重建 `build` = tsc emit）· `pnpm install` 重写锁文件 · engine tsconfig include 移除 `build.config.ts` 行
  - CLAUDE.md「Development-time CDD invocation」→ **`node packages/cdd-engine/src/bin.ts <subcommand>`** 直调（dev:stub 叙述删除）
  - `docs/maintainers/05-third-party-dependencies.md`：unbuild 登记改 **retired** + `@typescript/typescript6` prose 行转述——**不得携带被禁 token 原文**（`build.config`/`dev:stub`/`@typescript/typescript6`/`globalSetup` 均转述：如「the old dev-stub chain」）
- **验收**:
  - engine suite 全绿（黑盒经 `src/bin.ts` spawn——`CDD_MJS` 族改指后零 `dist/cli.mjs` 引用）· root vitest 绿 · `pnpm run precommit` 绿
  - live 面 grep 零命中：`build.config` / `dev:stub` / `@typescript/typescript6` / `globalSetup` / `@ts-ignore` / `@ts-expect-error`（live 面 = CLAUDE.md · `docs/maintainers/05` · engine README 对 · 源面/config 面——逃逸 token 并入本列表，与 T5 guard 合计 = 完整 live 面；历史 spec/plan 正文与发布面 schema/产物除外，live 面定义同 Constraints 契约）
  - `node packages/cdd-engine/src/bin.ts --help` exit 0
- **注**: 本任务删目录面，但发布面（T8）仍在同组——删除中态不可验收，同组 atomic 落地；`pnpm install` 后 engine node_modules 需重解析（unbuild/TS6 移除）

### Task 8: 发布面（tsc-emit 单工具）+ 实证锚（与 Task 7 同组 dispatch）

- **Do**: 按 spec 2.4：
  - 新建 `packages/cdd-engine/tsconfig.build.json`：`module: nodenext` · `moduleResolution: nodenext` · `allowImportingTsExtensions: true` + **`rewriteRelativeImportExtensions: true`** · `noEmit: false` · `outDir: dist` · `rootDir: src` · exclude `**/__tests__/**` · `typeRoots` 显式 engine `node_modules/@types` · `verbatimModuleSyntax`/`erasableSyntaxOnly`/`strict`/`skipLibCheck` 保持
  - engine `package.json`：`bin` → `{"cdd": "dist/bin.js"}` · `main` / `exports["."]` → `./dist/bin.js` · `files` → `["dist/","config/","templates/"]`（**`src/` 零 ship**——发布必 JS）· `engines` → `>=22.18.0` · 重建 `"build"` script = `tsc -p tsconfig.build.json && <config→dist/config copy>`（小 node 脚本或 cp；保持 release.yml/CI `pnpm build` 入口名）
  - engine README 对（`packages/cdd-engine/README.md` + `README.zh-CN.md`）toolchain/dev-invocation 段 → `node packages/cdd-engine/src/bin.ts`、移除 `dev:stub`/`dist/cli.mjs` 引用（consumer-shipped——npm 必发 README*）
  - **实证锚**：`pnpm pack`（packages/cdd-engine，目标 files/bin）→ 临时项目 `npm install <tgz>` → `.bin/cdd --help` exit 0（走真实引擎栈；dev 面 `node src/bin.ts` 冒烟已在 T7 验）
  - 发布 `tsc --emit` 前置 = T2 结算（emit 吃 48 债——本组 starts after T1/T2；若 emit 报错即结算未清完，回 T2 面）
- **验收**:
  - `tsc -p tsconfig.build.json` exit 0（发布 emit）· 产物 `dist/bin.js` shebang 保留 + 相对 import 全 `.js`（无 `.ts` 残留引用）
  - `pnpm pack` 产物含 `package/dist/bin.js`、**不含 `package/src/`**；临时安装 `.bin/cdd --help` exit 0
  - engine README 对 live 面零 `dev:stub`/`dist/cli.mjs`（grep；发布面 schema/产物除外）
  - engine suite 全绿 · `pnpm run precommit` 绿
- **注**: `dist/cli.mjs` 名随 unbuild 退役（发布面 bin 名 = `dist/bin.js`）；`resolveResource` 的 dev↔dist published-first 面保持（config copy → `dist/config`）

### Task 9: 终验 + changeset + overall closeout 回填

- **Do**: 按 spec 2.5/acceptance：
  - `pnpm run validate` 全块全绿（type-check 块 · engine suite · scripts suite · kairos tests（`.ts` 迁后）· residue/lexicon guard · emit 面）
  - **acceptance 复验对照 spec**（逐条核 2.1–2.4 acceptance：三项目 tsc 0 · 双接点绿 · 全仓源面零 .mjs · 删除面 grep 零命中 · pack→install→bin 实证 · buildability 双证据 · 黑盒全指 src/bin.ts）
  - changeset：`pnpm run changeset` 建 **cdd-engine patch**（bin/files/main/exports/engines + 构建面收敛——消费者可见非 breaking）+ **kairos patch changeset**（`type: module` ESM 前置面改，T4）——并解「kairos 无面不改」原口径
  - overall **v1.28 closeout 回填**（branch-review 预条件 backfill-overall；**Constraints「零文档修改权」的显式豁免**——对标 P4.1 Task 6 先例：backfill-overall 独立执行、**独立 `docs(kairos):` conventional commit**，不混入 changeset 任务提交）：P5 Design spec / Implementation plan 列 `[Pending] → Done` + change-history 行（spec **v1.3**（实态）/ plan **最终已批版本号**——closeout 时点以实态回填，不预设预测号）+ **v1.27 计数修正落地**（`kairos tests×11` → `10 *.test.mjs + 1 helpers.mjs`——spec Section 4 的 backfill-as-version 待办）
- **验收**:
  - `pnpm run validate` **ALL PASS**
  - `.changeset/*.md` 存在（cdd-engine patch + kairos patch）· P5 plan closeout 链（branch-review 预条件）满足
  - overall v1.28 四表一致（Issue inventory P5 计数修正 · Phase inventory P5 两列 Done · 依赖图不变 · change-history v1.28）
- **注**: closeout 回填 = 本 phase implementation 终结的 backfill-overall（对标 v1.25 P4 计划 closeout 先例）；changeset 类型终审在任务内（若发布面意外带 breaking——如 bin 命令名变故——升 major，实态为准）

## Task Groups

- **Task 7, 8**: 零构建架构收敛——dev/CI 面 + 删除层与发布面（tsc-emit + manifest + README 对 + 实证锚）同组 atomic，删除中间态不可验收，布局/删除步骤先行

---

## Section 3: 预研锚点（plan 引用的事实，供 implement 直接取用）

- **判定命令**：`./packages/cdd-engine/node_modules/.bin/tsc --noEmit -p packages/cdd-engine/tsconfig.json`（T1/T2 判据）
- **787→0 实测分布**（本 session 全量跑）：总 787 = `__tests__` 739 + src 48；Top 测试文件 `cdd.test.ts` 302 / `docs-runner.test.ts` 73 / `handoff-finalize.test.ts` 71；src 错误族 = finalize `agentHandoff` null ×27（TS18047）+ validation `reason` 取窄 ×1（TS2339 @567）/ branch ×8 / harness `detect` 撞名 ×2（TS2300）+ `HarnessRow|{}` ×2（TS2322）/ task `DispatchOp` ×2 / docs ×2 / registry ×1 / resource ×1 / write-boundary ×2——28+8+4+2+2+1+1+2 = **48**，与标题「src 48」精确收敛（与 spec 2.2 同数）；报错权威 = tsc 输出，枚举供定向
- **实证链**（本 session 已手跑）：`node packages/cdd-engine/src/bin.ts --help` exit 0 · staged pack→`npm install`→`.bin/cdd --help` + `schema get overall` 走真实引擎栈 · 发射 JS `bin.js` shebang 保留 + `.ts→.js` 重写零残留
- **`reviews.task/branch.lensEnum` 现值**：`["standards","spec"]`（buildability 未入——T6 增补）；plan review `lensEnum` 已含 buildability（先例）
