# Pi Harness 支持 P5 — 编译面收敛与结算（Phase Design Spec）

- **Version**: v1.2 · 2026-10-02（review 循环收口：r1 七 finding 落地——发布面 files/main/exports 修指 dist · engine/scripts 门禁入配置面 + engine erasableSyntaxOnly · kairos-tests 10+1 计数 · engine README/05 改面 + retired 转述措辞；r2 二 finding 落地——task/branch lensEnum 接 buildability · CDD_MJS 实测计数；v1.0 定稿形态保持）
- **Status**: Draft
- **Author**: [human] · Claude Opus 5 (1M context)（kairos:cdd-design → grilling → cdd-phase）
- **Parent program**: [2026-09-27-pi-harness-overall.md v1.27](2026-09-27-pi-harness-overall.md)
- **Depends on**: P4（shipped · [p4-design v1.6](2026-09-27-pi-harness-p4-design.md)）——hard 前驱 Design spec = Done / Implementation plan = Done（v1.25 closeout）

## Section 0: Incremental warning

本 spec 承诺恰好一个 phase（P5 编译面收敛与结算）。P5 的分割/重排不是本地编辑——phase inventory 行、依赖边与 change-history 行先落 parent overall（backfill-as-version），再动 spec。v1.27 已落地本 phase 全量 scope 定案；本 spec 仅记录 increment 的实现形态。

## Section 1: Constraints pointer

Cross-phase 约定属 parent overall，本 spec 不复述（overall wins on conflict）。引用要点：
- **P5 破坏性变更授权**（overall Constraints v1.27 登记，2026-10-02 用户拍板）：允许破坏性变更 / 重写代码 / 重组目录；约束 = 高维思考 / OOP 抽象统一 / 最佳实践 / **零技术债务 + 死壳即删**
- 事实定稿（v1.27 Constraints）：Node `node_modules` 下类型剥离永久禁止（发布必 JS）· Node ≥22.18 strip 默认（dev 零构建）· `typescript@7` 单工具兼判官 + 发射
- 不 commit 除非用户明确要求；spec 交付除外（I2 立即提交）· changeset 逐 phase 建

## Section 2: Design body

### 2.1 编译面门禁（`tsc --noEmit` 一等 gate + 三项目闸 + 全仓源面 ts 化）

**根因**（v1.26 复盘 + 本 session 补证）：precommit 子集排除 engine 两块 · vitest esbuild 转译不查型 · unbuild 不查型 · scripts 零 tsconfig · 全仓零 `tsc --noEmit`。补证：root 零 typescript（engine tsconfig 存在但零接线）；dev 面可零构建直跑（2.4）；`typescript@7` 原生 CLI 判官形态（`@typescript/typescript6` = JS-API 线，本仓零消费）。

**三项目 tsconfig 面**：
- **engine**：`packages/cdd-engine/tsconfig.json` 原位——`strict`/`noEmit`/`skipLibCheck`/`moduleResolution: bundler` 保持（构建面语义）+ **`erasableSyntaxOnly: true`**（Node strip 运行契约镜像——engine 即主 strip 运行时 `node src/bin.ts` 直跑，防「能编译但 Node 跑不了」；src 实测零非 erasable 构造，落地即绿）；include `src`（含 `__tests__`）+ `vitest.config.ts`（config 面并入闸——vitest 转译不查型）；`build.config.ts` 删除后（2.4）不再入 include
- **scripts**：新建 `scripts/tsconfig.json`——`module: nodenext` · `moduleResolution: nodenext` · `allowImportingTsExtensions: true` + `noEmit: true` · `strict: true` · `skipLibCheck` · **`erasableSyntaxOnly: true`**（Node strip 运行契约镜像——防「能编译但 Node 跑不了」）· include `scripts/**/*.ts`（含 emit / observe-cache / `__tests__`）+ root `vitest.config.ts` / `lint-staged.config.ts`（根配置面并入闸——vitest/lint-staged 由 esbuild/原生加载，均不查型，配置盲区不留）
- **kairos-tests**：新建 `packages/kairos/tests/tsconfig.json`——与 scripts 同语义（node:test 直跑面）；`.mjs→.ts` 后并入闸

**命令形态**：root script `"typecheck": "tsc --noEmit -p packages/cdd-engine && tsc --noEmit -p scripts && tsc --noEmit -p packages/kairos/tests"`；root devDeps 增 `typescript@^7.0.2`（判官单源，与 engine 的 `typescript@^7` 拉齐）。**`@typescript/typescript6` 删除**（2.4）。三项目 include 面总覆盖 = 全迁移 TS 面（engine `src` + `vitest.config.ts` · scripts 全量 + root `vitest.config.ts` / `lint-staged.config.ts` · kairos-tests 全量）——`.mjs→ts` 后的任一 TS 文件（源面与配置面）都被恰一项目盘到，配置面不留类型盲区。

**type-check 块（validate + precommit 双接点）**：`scripts/validate/type-check.ts` 导出 steps（`SubprocessBlock` cmd=`pnpm` args=`run typecheck`）；compose 进 `scripts/validate/index.ts`（终验）与 `scripts/validate/pre-commit.ts`（提交）——同一步、两接点。根因之一即「precommit 子集排除 engine 两块」，双接点防提交面空窗复现。

**全仓源面 `.mjs→.ts`（全代码 TS 化 iron rule）**：
- `packages/kairos/tests/*.test.mjs`（10 个——cdd-plan-spec / ci-validate / grep-sweep-regression / maintainers-docs / no-gate / pi-install-smoke / pi-package / presentation-surface / review-loop-clean-tree / status-routing-convergence）+ `helpers.mjs`（1 个）→ `.test.ts`/`.ts`（import 规格符改 `.ts`——现有测试已 import `../../../scripts/validate/kairos.ts`（带 `.ts` 后缀）先例成立）
- `scripts/emit/render-yaml.mjs` → `.ts`（`issue-templates.ts` + 其 test 共 2 处 import 同步）
- `vitest.config.mjs`（root + engine）→ `vitest.config.ts`（vitest 原生支持）
- `lint-staged.config.mjs` → `lint-staged.config.ts`（lint-staged v17 原生支持 `.ts/.cts/.mts`，configFiles.js 实证）
- **产物面零迁移**：`dist/`（发布产物，其名 = 发布面契约，2.4 改 `dist/bin.js`）· `.kairos/`（gitignored 运行时）· `templates/`（内容种子）

**守卫升级**：residue `.mjs` 守卫目标扩为「全仓源面零 .mjs」（engine src + scripts + kairos tests + configs）；逃逸禁令 `@ts-ignore`/`@ts-expect-error` 零命中入 ContractLexiconGuard/新 grep 面（2.2 零债口径）。

### 2.2 类型债全量结算（787 → 0，真相优先）

**判据**：`tsc --noEmit` engine 全树 **exit 0**（上闸前先清底；结算与门禁同 phase 落）。

**实测分布（本 session 全量跑）**：
- `__tests__` **739**：`cdd.test.ts` 302（最大存量）/ `docs-runner.test.ts` 73 / `handoff-finalize.test.ts` 71 / `host-detection.test.ts` 29 / `runner.test.ts` 23 / `cli-shared.test.ts` 21 … ——机械族主导：隐式 any（TS7006/18046/7031）、`{}` 上取属性（TS7053/2339）、catch-unknown（18046）、possible-null 解构（18047）、mock 函数签名（2507/2698/2322）
- **src 48** 全结构性：finalize `agentHandoff` null ×27（TS18047）/ branch `round`/`findings`/`base` ×8（TS2339）/ harness `detect` 撞名 ×2（TS2300）+ `HarnessRow|{}`（TS2322）/ task `DispatchOp` string→union ×2（TS2322）/ docs `string|undefined→PathLike` ×2 / registry `{}`→string / resource `published` 判别 / write-boundary `base` on `{}`

**真相优先修复清单（src，非抹平——Criterion ② OOP/高维）**：
1. `agentHandoff`（finalize.ts @492-567 ×27）：重审 write→finalize 契约——载荷在 finalize 时点结构上不可能为 null；以 payload 型 presence 判别 / 默认化把 nullable 从类型中移除 → 27 处同源消亡（零散 `!` 是抹平，弃）
2. `BranchLifecycleOpts`（branch.ts）：契约如实扩 `round`/`findings`/`base` 字段（declared truth——`round` 语义对 crash record、`findings` 对判定源计数）
3. `detect` 撞名（harness.ts TS2300）：OOP 消歧（Harness 抽象 `detect(env)` 谓词与右面重命名/信号归一），非 `as` 压
4. `HarnessRow | {}`：`{}` fallback 灭——undefined-coalesce 真形态，call site 单点处理
5. `DispatchOp` string→union：上游源类型收窄（`mode`/op 派生点），非下游 cast
6. docs/registry/resource/write-boundary：path 型收窄 + 判别 union 正确取窄

**零债口径（入 contract-lexicon 词表 + guard）**：`@ts-ignore`/`@ts-expect-error` 结算中**清零且全禁**；显式 `any` / `as unknown as X` **默认禁**（框架真实边界逐案评审登记）；`!` **限单一类型化 assert helper**（非散落裸断言）；fixture 边界 `as T`（`{}` → 真实 fixture 接口）允许。

**零行为变化护栏**：结算 = 纯类型面修改；行为由既有测试全绿守（对标 P5 系迁移护栏先例「0 行为变化，纯搬移/纯类型不改逻辑」）。结算不入新逻辑、不顺手重构。

### 2.3 cdd 闭环 buildability 双证据

**现状**：implement 侧 Evidence gate（template-contract clause 7）记 `test-evidence.json`（`command`/`exit_code`/`passed`，engine 读回机检）；review 侧 `reviews.task/branch` axesGuide = Standards/Spec/Scope 三轴，**零 buildability 措辞**（「测试能跑」只是 implement 证据的间接读取）。

**变更（双槽——machine 机检 + reviewer judgment）**：
- **implement 证据闸扩 `typecheck` 项**：evidence 文件记 `typecheck` 命令（`command`/`exit_code`/`passed`，与既有 `test` 项同构）；engine 读回核验，缺任一 → `status: BLOCKED`（与 `behavior_change` 缺失同型）
- **review 指令补 buildability 轴**：`reviews.task/branch.lensEnum` 增 `"buildability"`（REVIEW_LENS_GUIDE 由 `lensEnum.join(" · ")` 自动派生——无独立 prompt 改动）+ 对应 axesGuide 段——reviewer 在评审中**显式跑** `tsc --noEmit`（或该仓等价）+ 测试，findings lens-tag `buildability` 自证「双命令已跑」；命令用**转译描述**（不硬编码 pnpm/npm——消费仓 toolchain 自洽），本仓引擎闭环自指时跑的就是本 phase 的三项目闸
- **守卫**：`templates.test.ts`/`registry.test.ts` 断言 task+branch `reviewTypeConfig` 的 `lensEnum` 含 `"buildability"` **且** axesGuide 含 buildability 双证据文句（`tsc` + `test` token）——两条并判，lens-tag 要求才可执行而非仅文本描述；evidence 新字段结构合法（adapt schema）；ContractLexicon 词表补 buildability 措辞（checkWording 对 template-contract 断言）
- **消费面零动**：SKILL（cdd-dev orchestrator）zero-restate 规则 + 实测零命中 → 零 SKILL 改动；README/CLAUDE.md 无消费故事变更

### 2.4 零构建架构收敛（单工具 `typescript@7`）+ 死壳即删

**实证链（本 session 端到端）**：① `node packages/cdd-engine/src/bin.ts --help` exit 0（Node 24.21 原生 strip，零 unbuild/jiti）② `dist/cli.mjs` dev 态 = unbuild `--stub` 的 jiti 载入器（`createJiti` → `jiti.import(src/bin.ts)` + 自引用别名）——冗余层 ③ Node 对 `node_modules` 下 strip **永久禁止**（`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING` 实测；Node 官方「discourage publishing packages written in TypeScript」；tracker #57215 closed-as-not-planned）→ **发布必 JS** ④ `tsc --emit`（`tsconfig.build.json`：`module: nodenext` + `rewriteRelativeImportExtensions`）端到端跑通：shebang 保留、`.ts→.js` 重写、零残留 `.ts` 引用；staged pack → 消费安装 → `.bin/cdd` → `--help` + `schema get overall` 走真实引擎栈。

**目标形态**：
- **dev/CI 面**：`node packages/cdd-engine/src/bin.ts <subcommand>`（Node ≥22.18）——CLAUDE.md「Development-time CDD invocation」改指 · engine vitest 黑盒 **9 处 `const CDD_MJS` 定义 · 11 处 execa 调用**（`cdd.test.ts` 等 CDD_MJS 族）全改指 `src/bin.ts` · `globalSetup` self-stub 删除（无 dist 缺省逻辑可删）· validate `smoke-cdd` pin 改指
- **发布面**：`tsconfig.build.json`（`module: nodenext` · `moduleResolution: nodenext` · `allowImportingTsExtensions` + `rewriteRelativeImportExtensions` · `noEmit: false` · `outDir: dist` · exclude `**/__tests__/**` · typeRoots 显式指 engine `node_modules/@types`）→ `tsc -p` 产 `dist/` JS 模块树 + config copy（`dist/config`——published-first resolveResource 面保持，P4 C7 不破）；manifest **入口三连一并改指发射产物**——`bin: {"cdd": "dist/bin.js"}` · `main` / `exports["."]` 改指 `./dist/bin.js`（`dist/cli.mjs` 随 unbuild 删除后不再存在；零 JS-API 消费——`src/bin.ts` 注释声明，保持 manifest 可解析即可）· `files: ["dist/","config/","templates/"]`（发布面 = `tsc --emit` 的 JS 树，`src/` 源面零 ship——node_modules 类型剥离永久禁令即「发布必 JS」）· `engines: >=22.18`
- **删除层（死壳即删）**：unbuild（devDeps）· jiti（stub 机制）· `build.config.ts` · `dev:stub` script（engine package.json + CLAUDE.md）· `@typescript/typescript6`（零 d.ts 需求 = 零 JS-API 消费实证）· `dist/` stub 产物面的外围逻辑（globalSetup）· vitest 自给缺省分支 —— **改写面**：`docs/maintainers/05-third-party-dependencies.md` unbuild 登记改 retired · CLAUDE.md 相应段重写 · engine README 对（`packages/cdd-engine/README.md` + `README.zh-CN.md`）toolchain/dev-invocation 段改指 `node packages/cdd-engine/src/bin.ts`、移除 `dev:stub`/`dist/cli.mjs` 引用（consumer-shipped——npm 必发 README*，live 面同污点）
- **retired/删除登记措辞（live 面 grep 契约）**：`docs/maintainers/05` 等登记文本**不得携带被禁 token 原文**（`build.config` / `dev:stub` / `@typescript/typescript6` / `globalSetup`——已被 acceptance live 面 grep 判为目标污点，retired 登记若保留原文即自败于本 phase 验收）；一律转述——如「the old dev-stub chain」「the TS6-compat shim」，05 现存的 `@typescript/typescript6` 相关 prose 行同此处理（现 05:21 unbuild 行含 `build.config.ts`/`dev:stub` 原文、05:25 含包名原文，改 retired 时逐行转述）
- **实证锚（P5 验收）**：`pnpm pack`（target files/bin）→ 临时项目 `npm install` → `.bin/cdd` 执行（已手跑通过——成为 plan/CI 验收）

### 2.5 测试与验证面

- type-check 闸：validate + precommit 双接点全绿；root `pnpm run typecheck` 三项目 exit 0
- engine suite：结算后全绿（0 行为变化）+ 新断言（evidence `typecheck` 字段结构 / task+branch lensEnum 含 buildability + review 指令文本含 buildability + tsc + test / 黑盒 exec 全指 `src/bin.ts`）
- scripts suite：render-yaml `.mjs→.ts` 迁移后绿 + type-check 接线测试
- kairos tests：`.mjs→.ts` 后 node:test 直跑绿（`scripts/validate/kairos.ts` 等跨项目 `.ts` import 先例扩展）
- residue/lexicon：全仓源面零 `.mjs` + `build.config`/`dev:stub`/TS6/globalSetup/ts-ignore 系 grep 零命中（live 面；历史 plan 正文 = 史实不 retro-rename）
- 发布面实证：pack → install → `.bin/cdd`（CI/手动锚）
- `pnpm run validate` 全绿

### Acceptance criteria

- `pnpm run typecheck`（engine + scripts + kairos-tests 三项目）exit 0：engine 787→0、scripts 零错、kairos-tests 零错
- validate 与 precommit 均含 `type-check` 块且全绿（双接点）
- 全仓源面零 `.mjs`（residue 守卫绿，产物面除外）；`packages/kairos/tests`、`scripts/emit`、vitest/lint-staged configs 全 `.ts`
- 零构建删除面 **live 面** grep 零命中：`build.config` / `dev:stub` / `@typescript/typescript6` / `globalSetup` / `@ts-ignore` / `@ts-expect-error`（live 面 = CLAUDE.md · `docs/maintainers/05` · engine README 对 · 源面/config 面；历史 spec/plan 正文与发布面 schema/产物除外）
- `tsc --emit` 发布面：`pnpm pack` → 临时项目 `npm install` → `.bin/cdd` 执行成功（`--help` exit 0，走真实引擎栈）
- CLAUDE.md + engine README 对（EN/zh）dev 链均 = `node packages/cdd-engine/src/bin.ts`、零 `dev:stub`/`dist/cli.mjs` 引用；`docs/maintainers/05` unbuild 登记 retired（被禁 token 一律转述，非原文）
- buildability 双证据：`reviews.task/branch.lensEnum` 含 `"buildability"`（REVIEW_LENS_GUIDE 自动派生）且 axesGuide 含 buildability 双证据文句（`templates.test.ts`/`registry.test.ts` 断言绿）；implement evidence 扩 `typecheck` 项且 engine 读回机检（缺 → BLOCKED 测试绿）
- engine vitest 黑盒 exec 全指 `src/bin.ts`（live 面 `dist/cli.mjs` 引用零命中，发布面 schema/产物除外）
- `pnpm run validate` 全绿

## Section 3: Deviations from overall

| Overall assumption | Phase decision | Overall updated? |
|---|---|---|
| 无（本 phase 全量决策已随 overall v1.27 grilling 定案回填——零构建收敛 / 全仓 .mjs→ts / 三项目闸 / 死壳即删验收均落四表） | 与 overall 无偏差 | Yes — v1.27 · 2026-10-02 |

## Section 4: Notes for downstream

- **P6（若存在）**：`cdd init` 未来 phase 消费同一 harness 契约（overall v1.24 定）——本 phase 的 type-check 面与零构建形态是其前置基建；engine-config 不建 buildability 命令配置面（YAGNI——review 指令用转译描述，消费仓自洽），若未来需要再建为独立 phase
- 发布面 `tsc --emit` 依赖结算完成（emit 也吃 48 条 src 债）→ **publish 前置 = 结算完成**，先清底再上闸
- `typescript@7` 原生 CLI 无 JS-API——若未来 kairos/cdd-engine 需要程序化嵌 TS（如 dts）需另引入 JS-API 线（本 phase 零需求，登记为已知边界）
- **overall v1.27 计数修正（backfill-as-version 待办）**：overall 正文「kairos tests×11 + helpers」（scope 行 72 与 change-history 行 143）实为 **10 个 `*.test.mjs` + 1 `helpers.mjs`**——本 spec 2.1 已以 10 为准；approved overall 冻结，本 phase 不动原文，下次 overall backfill-as-version 时随 P5 落地一并修正

## Section 5: Review

- **spec-review 循环记录**（Review Convergence I1，`cdd review --type spec` 逐循环）：
  - **r1**（v1.0，base `13ec3860`）：`CHANGES_REQUESTED · blocker 1`（+3 warn +3 nit）→ `cdd fix`（`spec-fix-1`，commit `ba60cfa2`）——blocker = 发布面 `files` 丢 `dist/` 且带 `src/`（与 bin/发布必 JS 矛盾）→ 修指 `["dist/","config/","templates/"]` + bin/main/exports 改指 `dist/bin.js`；warns = engine 缺 `erasableSyntaxOnly`（主 strip 运行时镜像）→ 补；配置面不入闸 → scripts include 扩 root configs + engine include 扩 `vitest.config.ts`；kairos-tests 计数 11→10+1；engine README 对入改面；nits = 05 retired 转述措辞、main/exports re-point
  - **r2**（fix-1 后，base `ba60cfa2`）：`REVIEW_FIX · blocker 0`（1 warn + 1 nit）→ `cdd fix`（`spec-fix-2`，commit `b6e141f6`）——warn = `buildability` 未入 `reviews.task/branch.lensEnum`（REVIEW_LENS_GUIDE 由 lensEnum 派生，lens-tag 需可强制）→ 补 + 守卫并判成员；nit = CDD_MJS「~13 处」→ 实测 9 定义 · 11 调用
  - **closure**：blocker = 0 → fix 全 → done 无 re-review；评审记录终状 = 11 findings 全落地、零 blocker 残
- 基线 = committed tree（v1.27 overall（`db489699`）· spec v1.0（`13ec3860`）· fix-1（`ba60cfa2`）· fix-2（`b6e141f6`））；Review Convergence：blocker > 0 → fix 全 finding → re-review；blocker = 0 → fix 全 finding → done，无 re-review