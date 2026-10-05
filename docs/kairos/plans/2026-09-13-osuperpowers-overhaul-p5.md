# osuperpowers 架构重构 P5 实施计划 — report-issues 改名与流程精炼 + engine 生命周期重建

**Spec:** [2026-09-13-osuperpowers-overhaul-p5-design.md](docs/kairos/specs/2026-09-13-osuperpowers-overhaul-p5-design.md)

- **Parent program**: [2026-09-13-osuperpowers-overhaul-overall.md v1.27](../specs/2026-09-13-osuperpowers-overhaul-overall.md)
- **Depends on**: P4 shipped（skill 树 + engine 输出契约，PR #262 已 merge，2026-09-16）
- **Base**: develop（finishing read-base 的数据源）

- **Interface 转录注记**: 各任务 `- **Consumes**: 刻意留空（树迁移 B 转录决策）——源 Do 散文未承载独立具名输入事实，consumes（Task 记录 interface 可选项）不填充；任务输入由 DependsOn/AtomicWith 声明边与 objective/steps 承载，consumer-parity p1–p4.1 因承接具名输入事实而全量填充。

## Constraints
### 口径

- P5 是**双主营**——① report-issues 改名与流程精炼（用户初始流程 + E 族 6 条）② cdd-engine 生命周期重建（全量 TS + unbuild · CLI 换 citty · DispatchLifecycle 抽象基类 + hookable 注册面 · commit 边界双门 · 目录依赖单向轴 · 第三方收敛全项）。engine 黑盒契约（4 子命令面 / handoff 输出 / 失败类目）零变化——重建仅内部形态。所有改动 `pnpm run validate` 全绿 + `emit:check` 无 drift。

### commit 边界机制（本 program 全 phase 生效）

- dispatch 两端门——入口门（进入 review 前主 agent 产物已提交、dispatch 期零写树）+ 出口门（产生修改的 dispatch 后修改已提交）；主 agent 处理的由主 agent commit。计划各 Task 的 review/fix 环均遵守。

### Task 1: cdd-engine 包转型 TypeScript + unbuild 构建骨架

- **Objective**: cdd-engine 包转型 TypeScript + unbuild 构建骨架（最小 src/bin.ts 占位入口，真实命令面归 Task 9）

- **Produces**: `tsconfig.json` + `build.config.ts`(unbuild) + package.json main/exports/bin 指 dist + files 含 dist/templates + vitest TS 支持 + build/dev-stub/test scripts + 最小 `src/bin.ts` 占位入口

- **Files**: packages/cdd-engine/tsconfig.json, packages/cdd-engine/build.config.ts, packages/cdd-engine/package.json, packages/cdd-engine/vitest.config.mjs, packages/cdd-engine/src/bin.ts, packages/cdd-engine/bin/cdd.mjs

- **Steps**:
  1. `packages/cdd-engine` 从 JS ESM 包转型为 TS 包：新增 `tsconfig.json`、`build.config.ts`（unbuild）、`package.json` 的 `main`/`exports`/`bin` 指向 `dist/` 产物、`files` 含 `dist/` + `templates/`；`vitest` 配置支持 TS 测试；`npm scripts`（`build`/`dev:stub`/`test`）落地 — checkable: `pnpm --filter @oscaner-skills/cdd-engine build` 产出 `dist/`
  2. 建**最小 `src/bin.ts` 占位入口**（转发现有 `bin/cdd.mjs` commander 命令面，使 `build`/`dev:stub` 入口成立——真实命令面随 Task 9 citty 化落地） — checkable: `unbuild --stub` 后 `node packages/cdd-engine/dist/cli.mjs --help` 可运行（经占位入口转发现有 commander 命令面）；engine suite 现存测试（JS 态）全绿（转换前基线）（注：本 Task 只建骨架，不改业务逻辑——JS→TS 逐文件迁移在后续 Task 随模块重构进行）

- **Acceptance**:
  - `pnpm --filter @oscaner-skills/cdd-engine build` 产出 `dist/`；`unbuild --stub` 后 `node packages/cdd-engine/dist/cli.mjs --help` 可运行（经占位入口转发现有 commander 命令面——`--version` 非现有执行面，parse.mjs 无 `.version()` 声明，属 unknown option，不作验收锚点）；engine suite 现存测试（JS 态）全绿（转换前的基线）


### Task 2: 第三方依赖引入（simple-git / yaml / tinyglobby / handlebars / consola / hookable / citty）

- **Objective**: 第三方依赖引入（simple-git / yaml / tinyglobby / handlebars / consola / hookable / citty）

- **Produces**: 根 devDependencies 增 yaml（emit 工具链，不进 osuperpowers dependencies）；cdd-engine dependencies 增 six；commander 保留（Task 9 移除）

- **Files**: package.json, packages/cdd-engine/package.json, pnpm-lock.yaml

- **Steps**:
  1. 仓库根 devDependencies 增 `yaml`（emit 工具链——spec §2.13 裁定 (b)：**不进 osuperpowers `package.json#dependencies`**，消费者运行时零新增依赖）；`packages/cdd-engine/package.json` dependencies 增 `simple-git`、`tinyglobby`、`handlebars`、`hookable`、`citty`、`consola`；**`commander` 不在此移除**——待 Task 9 同一 Task 迁 citty 后移除（本 Task 只引包不动解析入口） — checkable: `pnpm install` 解析成功；各包可 `import`；`commander` 零残留的验收锚点移到 Task 9

- **Acceptance**:
  - `pnpm install` 解析成功；各包可 `import`；`commander` 零残留的验收锚点移到 Task 9（本 Task 结束时刻意保留 commander——Task 9 迁 CLI 后 cdd-engine package.json 零残留）


### Task 3: 目录按依赖单向轴重组（cli → dispatch → {rules, artifacts, render} → infra）

- **Objective**: 目录按依赖单向轴重组（cli → dispatch → {rules, artifacts, render} → infra）+ 测试路径同步迁移（一任务内完成）

- **Produces**: `lib/` → `src/` 按 spec §2.13 目录树重组（cli/dispatch/rules/artifacts/render/infra）；`bin/cdd.mjs` → `src/bin.ts`；build.config 入口对齐；测试路径同步（CDD_MJS exec 常量改指 dist/cli.mjs + ../lib/*.mjs 改指 ../src/）

- **Files**: packages/cdd-engine/lib/（→ src/ 重组）, packages/cdd-engine/bin/cdd.mjs, packages/cdd-engine/src/bin.ts, packages/cdd-engine/build.config.ts, packages/cdd-engine/src/（全部测试文件）

- **Steps**:
  1. `packages/cdd-engine/lib/` → `src/` 按 spec §2.13 目录树重组：`cli/` 命令面 · `dispatch/` 生命周期域 · `rules/` · `artifacts/` · `render/` · `infra/`；`templates/` 保持独立资源目录；`bin/cdd.mjs` → `src/bin.ts`（Task 1 占位入口被真实现覆盖）；`build.config.ts` 入口对齐 — checkable: 目录结构按 spec §2.13 落位（git mv + 引用同步）
  2. **测试路径同步迁移（一任务内完成，否则 ENOENT/断链）**——全部 CDD_MJS exec 常量改指 `packages/cdd-engine/dist/cli.mjs`（依赖 Task 1 stub 产物）+ 全部 `../lib/*.mjs` 静态导入（含 vi.mock 的 helpers）改指 `../src/` — checkable: `git mv` + 测试路径迁移后全部既有测试仍绿——8 个测试文件定义 CDD_MJS（约 13 处 exec 常量）改指 dist/cli.mjs、114 处 `../lib/` 导入（26 文件，含 vi.mock）改指 `../src/` 后零 ENOENT/断链；**纯搬移不改逻辑**，零行为变化（迁移护栏）（注：模块内部重构随后续 Task——先结构后内容）

- **Acceptance**:
  - `git mv` + 测试路径迁移后全部既有测试（engine suite + validate 各块）仍绿——8 个测试文件定义 CDD_MJS（约 13 处 exec 常量，cli-shape/host-detection/docs-task/base-branch/lifecycle.wiring/branch-review/root/task/cdd 等）改指 `dist/cli.mjs`、114 处 `../lib/` 导入（26 文件，含 vi.mock）改指 `../src/` 后零 ENOENT/断链；**纯搬移不改逻辑**，零行为变化（迁移护栏）


### Task 4: `infra/` 基础设施层（git / proc / invoke / root / context / registry / exit / log）

- **Objective**: `infra/` 基础设施层（git / proc / invoke / root / context / registry / exit / log）——只建不拆

- **Produces**: `infra/git.ts`（simple-git 单点封装）· proc.ts · invoke.ts · root.ts（repoRoot 唯一 cwd 点）· context.ts · registry.ts · exit.ts · log.ts（consola）；既有旧实现驻留 src/ 存量

- **Files**: packages/cdd-engine/src/infra/git.ts, packages/cdd-engine/src/infra/proc.ts, packages/cdd-engine/src/infra/invoke.ts, packages/cdd-engine/src/infra/root.ts, packages/cdd-engine/src/infra/context.ts, packages/cdd-engine/src/infra/registry.ts, packages/cdd-engine/src/infra/exit.ts, packages/cdd-engine/src/infra/log.ts

- **Steps**:
  1. `infra/git.ts`（simple-git 单点封装：status/add/commit/head/log——替换 `contract/commit.mjs` 手写 `execFileSync("git")` helper 与零星 git）；`infra/proc.ts`（进程生命周期）；`infra/invoke.ts`（CLI 调用契约）；`infra/root.ts`（repoRoot 唯一 cwd 点）；`infra/context.ts`（context-contract 读取）；`infra/registry.ts`（harness registry）；`infra/exit.ts`；`infra/log.ts`（consola 统一日志） — checkable: `infra/git.ts`/`root.ts`/`log.ts` 建成且为新实现的唯一依赖点；既有 contract/commit 语义测试全绿（dirty→BLOCKED / head mismatch / review skip / fail-open）——**基线不回归 claim，非 API 换底**（换底 owner = Task 5）
  2. **本 Task 只建不拆**——旧调用随 Task 5/8 更换时改指，Task 4 结束边界旧实现仍驻留 `src/`；repo 级零残留指标在 Task 5/8/9 结清归属、不在 Task 4 claim — checkable: repo 级零残留指标归属在此结清（execFileSync("git") 零残留 → Task 5；process.cwd() 计数 = 1 → Task 8/9）（注：infra 是零 CDD 语义层，随便换）

- **Acceptance**:
  - `infra/git.ts`/`root.ts`/`log.ts` 建成且为新实现的唯一依赖点（**本 Task 只建不拆**——旧调用随 Task 5/8 更换时改指，Task 4 结束边界旧实现仍驻留 `src/`，存量不要求归零）；既有 contract/commit 语义测试全绿（dirty→BLOCKED / head mismatch / review skip / fail-open）——**基线不回归 claim，非 API 换底**（换底唯一 owner = Task 5）；repo 级零残留指标（`execFileSync("git")` 零残留 → Task 5；`process.cwd()` 计数 = 1 / 零 `console.log` 散用 → Task 8/9）在此结清归属、不在 Task 4 claim


### Task 5: `rules/` CDD 判定层（commit 双门 / stopping / failure / schema）

- **Objective**: `rules/` CDD 判定层（commit 双门 / stopping / failure / schema）——API 换底唯一 owner

- **Produces**: `rules/commit.ts`（commit 边界双门：入口门 clean-tree dirty→BLOCKED + 出口门 validateCommitContract 语义经 infra/git.ts simple-git）；`rules/stopping.ts`；`rules/failure.ts`（失败六类 + 配额隔离 + maybeExhaust）；`rules/schema.ts`（handoff JSON schema 校验）

- **Files**: packages/cdd-engine/src/rules/commit.ts, packages/cdd-engine/src/rules/stopping.ts, packages/cdd-engine/src/rules/failure.ts, packages/cdd-engine/src/rules/schema.ts, packages/cdd-engine/src/infra/git.ts

- **Steps**:
  1. `rules/commit.ts`——**commit 边界双门**（spec §2.12 第二部分：入口门 clean-tree 校验 dirty→BLOCKED + 出口门 validateCommitContract 语义含 rewriteHandoffBlocked，判定走 infra/git.ts simple-git）；`rules/stopping.ts`（阻塞守卫簇）；`rules/failure.ts`（失败六类 + 配额隔离 + maybeExhaust）；`rules/schema.ts`（handoff JSON schema 校验 validate/recover + handoff-namespace） — checkable: 既有 commit-contract 语义测试全绿（dirty→BLOCKED / head mismatch / review skip / fail-open——仅底层换 simple-git，**API 换底 claim 唯一 owner**）
  2. **手写 git `execFileSync("git")` 在 `src/` 零残留——repo 级 git 零残留指标唯一落点**；failure/stopping 语义零变化（400+ tests 护栏） — checkable: 手写 git `execFileSync("git")` 零残留（src/）；failure/stopping 语义零变化（注：双门生命周期用例单一 owner = Task 7 基类实现级测试；Task 10 只持 docs-fix 出口门用例）

- **Acceptance**:
  - 既有 commit-contract 语义测试全绿（dirty→BLOCKED / head mismatch / review skip / fail-open —— 仅底层换 simple-git，**API 换底 claim 唯一 owner**）；**手写 git `execFileSync("git")` 在 `src/` 零残留——repo 级 git 零残留指标唯一落点（Task 4 已结清归属）**；failure/stopping 语义零变化（400+ tests 护栏）——入口门/出口门**生命周期用例**不在此 claim（判定挂载与用例单一 owner = Task 7 基类实现级测试；Task 10 只持 docs-fix 出口门用例）


### Task 6: `dispatch/hooks.ts` hookable 注册面 + `dispatch/phases.ts` 阶段表

- **Objective**: `dispatch/hooks.ts` hookable 注册面 + `dispatch/phases.ts` 阶段表

- **Produces**: `dispatch/hooks.ts`（hookable 实例 + 固定 hook 点声明 dispatch:before/dispatch:after + commit 门 hook + 外部插件注册入口）；`dispatch/phases.ts`（PHASES 阶段表数据化：pre-flight/dispatch/post-flight 三阶段）

- **Files**: packages/cdd-engine/src/dispatch/hooks.ts, packages/cdd-engine/src/dispatch/phases.ts

- **Steps**:
  1. `dispatch/hooks.ts`——hookable 实例 + **固定 hook 点声明**（`dispatch:before` / `dispatch:after` + commit 门 hook；spec §2.12 第一阶段）；外部插件注册入口（未来消费面）；`dispatch/phases.ts`——PHASES 阶段表数据化（pre-flight / dispatch / post-flight 三阶段，每阶段 step 挂载点） — checkable: hooks 实例可 `callHook('dispatch:before')` / 注册 handler 触发；phases 表结构可读可测（阶段 id 枚举、序、责任注释）
  2. 测试覆盖 hook 点触发顺序（before → phases → after） — checkable: hook 点触发顺序测试绿（注：注册面是真可插拔（用户裁定），但固定 hook 点枚举防钩子爆炸；engine 内部变体走继承不依赖注册面（Task 7））

- **Acceptance**:
  - hooks 实例可 `callHook('dispatch:before')` / 注册 handler 触发；phases 表结构可读可测（阶段 id 枚举、序、责任注释）；测试覆盖 hook 点触发顺序（before → phases → after）


### Task 7: `dispatch/base.ts` DispatchLifecycle 抽象基类（模板方法骨架）

- **Objective**: `dispatch/base.ts` DispatchLifecycle 抽象基类（模板方法骨架）：run() = pre-flight → dispatch → post-flight + commit 双门默认 hook

- **Produces**: `DispatchLifecycle` 抽象类（run() 模板方法 + 默认 hook 实现 commitPreCheck → resolveContext → validateMode → dispatch abstract → schemaValidate → normalizeResult → commitPostCheck；构造注 hooks/ctx）；入口门用例（review 起点 dirty → BLOCKED）

- **Files**: packages/cdd-engine/src/dispatch/base.ts

- **Steps**:
  1. `DispatchLifecycle` 抽象类（TS 虚方法编译期约束）：`run()` 模板方法 = `pre-flight → dispatch → post-flight` 骨架 + 默认 hook 实现（`commitPreCheck` 入口门 → `resolveContext` → `validateMode` → `dispatch` abstract → `schemaValidate` → `normalizeResult` → `commitPostCheck` 出口门）；构造注 `hooks`/`ctx` — checkable: 基类无法实例化（abstract）；子类只需覆写关注 hook 即可运行（测试用最小 stub 子类跑通 run() 全流程）；模板方法序断言（pre → dispatch → post + commit 双门卷入）
  2. **入口门用例（review 起点 dirty → BLOCKED）——单一 owner（本 Task 基类实现级测试；Task 5/10 不重复 claim）** — checkable: 入口门用例绿（单一 owner）（注：这是「抽象基类继承覆写」的落点——commit 双门挂基类默认 hook，task/docs 继承）

- **Acceptance**:
  - 基类无法实例化（abstract）；子类只需覆写关注 hook 即可运行（测试用最小 stub 子类跑通 run() 全流程）；模板方法序断言（pre → dispatch → post + commit 双门卷入）；**入口门用例（review 起点 dirty → BLOCKED）——单一 owner（本 Task 基类实现级测试；Task 5/10 不重复 claim）**


### Task 8: `dispatch/task.ts` + `dispatch/docs.ts` 功能生命周期（继承覆写）

- **Objective**: `dispatch/task.ts` + `dispatch/docs.ts` 功能生命周期（继承覆写）+ artifacts/render 剩余模块同步 TS 化

- **Produces**: `TaskLifecycle extends DispatchLifecycle`（resolveContext 含 brief 生成/fixed-point 派生 · dispatch render→spawn agent · postFlight H1 四行/exit 归一 · 双门继承基类）；`DocsLifecycle`（docs 面同消费双门）；`artifacts/` + `render/` TS 化（handoff/progress/base-branch/brief，naming glob 经 tinyglobby）

- **Files**: packages/cdd-engine/src/dispatch/task.ts, packages/cdd-engine/src/dispatch/docs.ts, packages/cdd-engine/src/artifacts/handoff/write.ts, packages/cdd-engine/src/artifacts/handoff/finalize.ts, packages/cdd-engine/src/artifacts/handoff/naming.ts, packages/cdd-engine/src/artifacts/progress.ts, packages/cdd-engine/src/artifacts/base-branch.ts, packages/cdd-engine/src/render/brief.ts

- **Steps**:
  1. `TaskLifecycle extends DispatchLifecycle`（task 功能：resolveContext 含 brief 生成/fixed-point 派生、dispatch 含 render→spawn agent、postFlight 含 H1 四行/exit 归一、双门继承基类）；`DocsLifecycle extends DispatchLifecycle`（docs 面 spec/plan review/fix dispatch——**docs 面同消费入口门出口门**，spec review-2 [2] 裁定）；原 `run-task.mjs` 13.5 步逻辑迁入两功能类的 hook 覆写 — checkable: `cdd review --type spec|plan`（docs）与 `cdd implement/fix`（task）经新生命周期跑通——engine 黑盒契约（4 子命令 / handoff 输出）零变化；双门在 docs 面生效（docs review 起点 dirty → BLOCKED）；既有 task/docs 测试全绿
  2. **`artifacts/` + `render/` 剩余模块同步 TS 化**（Artifacts 层：handoff/{write,finalize,naming}.ts · progress.ts · base-branch.ts；Render 层：brief.ts——`naming.ts` glob 收拢为 `tinyglobby`） — checkable: artifacts/render 全量 TS 化 + `naming` glob 经 tinyglobby——既有 naming/progress/base-branch/handoff/brief 测试转换后仍绿；**`process.cwd()` 计数 = 1（root.ts 唯一）+ 零 `console.log` 散用（经 consola）**

- **Acceptance**:
  - `cdd review --type spec|plan`（docs）与 `cdd implement/fix`（task）经新生命周期跑通——engine 黑盒契约（4 子命令 / handoff 输出）零变化；双门在 docs 面生效（docs review 起点 dirty → BLOCKED）；既有 task/docs 测试全绿；artifacts/render 全量 TS 化 + `naming` glob 经 tinyglobby——既有 naming/progress/base-branch/handoff/brief 测试转换后仍绿（AC11 全量 TS 兜底）；**`process.cwd()` 计数 = 1（root.ts 唯一）+ 零 `console.log` 散用（经 consola）——repo 级 cwd/log 零残留指标在此达成**（旧消费面随本 Task 全量 TS 化改指 infra；Task 9 CLI 重建继续经 `infra/root.ts` + `infra/log.ts`，零回渗）


### Task 9: CLI 换 citty（`src/bin.ts` + `cli/` 命令面）

- **Objective**: CLI 换 citty（`src/bin.ts` + `cli/` 命令面）+ commander 随本 Task 移除

- **Produces**: `bin.ts` defineMainCommand + implement/review/fix/base-branch 四子命令；`cli/` 各 action 装配 DispatchLifecycle 子类；`--dry-run` program 级；commander 零残留

- **Files**: packages/cdd-engine/src/bin.ts, packages/cdd-engine/src/cli/（各 action）, packages/cdd-engine/package.json

- **Steps**:
  1. `bin.ts` 用 `defineMainCommand` + 子命令声明（implement/review/fix/base-branch 四子命令——spec review-2 [3] 裁定：无第五个 docs 子命令，docs 经 review/fix `--type spec|plan`）；`cli/` 各 action 装配 DispatchLifecycle 子类；`--dry-run` 保留 program 级；`--help`/usage 面经 citty 生成 — checkable: `cdd --help` 子命令集合 = implement/review/fix/base-branch（基线断言更新）；implement/review/fix/**base-branch** 四子命令黑盒行为与 commander 版一致——**base-branch 含嵌套 set/get 面**；既有黑盒测试全绿（含 base-branch.test.mjs）
  2. **`commander` 随本 Task 从 cdd-engine dependencies 移除**（CLI 全量切 citty 后无消费者——本 Task 是移除唯一时点锚，Task 2 结束时刻意保留的 commander 在此归零） — checkable: `cdd-engine/package.json` `commander` 零残留（Task 2 验收改指的锚点在此达成）（注：这是命令面收敛——P3 已删 brief/research 后的终态四命令）

- **Acceptance**:
  - `cdd --help` 子命令集合 = implement/review/fix/base-branch（基线断言更新）；implement/review/fix/**base-branch** 四子命令黑盒行为与 commander 版一致——**base-branch 含嵌套 set/get 面**（parse.mjs 现状二级命令 set/get，经 citty 声明保留或随 SUBCOMMAND_USAGE/parse 迁移行明确列出），既有黑盒测试全绿（含 base-branch.test.mjs）；SUBCOMMAND_USAGE/parse 相关测试迁移到 citty 声明；`cdd-engine/package.json` `commander` 零残留（Task 2 验收改指的锚点在此达成）


### Task 10: commit 双门全接线 + `templates/fix/docs.md` 补提交指令

- **Objective**: commit 双门全接线 + `templates/fix/docs.md` 补提交指令 + 六个 SKILL.md review-fix 循环措辞统一

- **Produces**: 入口门经基类默认 hook 自动生效（本 Task 只验证生效面）；出口门负 dispatch 返回后校验（含 docs fix）；`templates/fix/docs.md` 补提交指令；六 skill review-fix 措辞「进入 review 前确保工作树干净」

- **Files**: packages/cdd-engine/templates/fix/docs.md, packages/osuperpowers/skills/writing-phase-spec/SKILL.md, packages/osuperpowers/skills/writing-single-spec/SKILL.md, packages/osuperpowers/skills/writing-overall-spec/SKILL.md, packages/osuperpowers/skills/writing-plans/SKILL.md, packages/osuperpowers/skills/brainstorming/SKILL.md, packages/osuperpowers/skills/cli-driven-development/SKILL.md

- **Steps**:
  1. **入口门无需 `cli/` 接线**——基类默认 hook（commitPreCheck）经 task/docs 继承自动生效（review dispatch 前 clean-tree 校验，dirty → BLOCKED；落点 dispatch/base.ts 见 Task 7，本 Task 只验证生效面）；出口门在 dispatch 返回后校验（含 docs fix） — checkable: docs fix 出口门用例（docs fix 后 dirty → BLOCKED）——本 Task 唯一用例（入口门用例 owner 已归 Task 7）
  2. `templates/fix/docs.md` 补提交指令（与 task 族同构：fix agent 完成时 commit 被修文档，conventional + 无 attribution + 无改动 skip + out-of-scope 不碰） — checkable: `templates.content.test.mjs` 断言 fix/docs.md 含提交指令；dispatch/docs.ts 中若保留 No commit-contract 注释则删除
  3. **六个 SKILL.md 的 review-fix 循环措辞统一为「进入 review 前确保工作树干净」**（writing-phase-spec / writing-single-spec / writing-overall-spec / writing-plans / brainstorming / cli-driven-development 六处） — checkable: **六个 SKILL.md 逐个断言**（每 skill 一条）review-fix 循环措辞含「进入 review 前确保工作树干净」

- **Acceptance**:
  - docs fix 出口门用例（docs fix 后 dirty → BLOCKED）——本 Task 唯一用例（入口门用例 owner 已归 Task 7，不重复）；`templates.content.test.mjs` 断言 fix/docs.md 含提交指令；dispatch/docs.ts 中若保留 "No commit-contract" 注释则删除（旧 run-docs.mjs 已成重建前文件，无需单独处理）；**六个 SKILL.md 逐个断言**（每 skill 一条）review-fix 循环措辞含「进入 review 前确保工作树干净」


### Task 11: report-issues 改名面（report-issue → report-issues）

- **Objective**: report-issues 改名面（report-issue → report-issues）：git mv + name/description + finding-meta 唯一改名源 + 解析路径四处随迁

- **Produces**: `git mv skills/report-issue/ skills/report-issues/` + SKILL frontmatter + finding-meta components 枚举（唯一改名源）+ 解析路径四处随改 + 引用面（SKILL ×3 / writing-plans ×1 / README / residue 注释）

- **Files**: packages/osuperpowers/skills/report-issue/（→ report-issues/）, packages/osuperpowers/scripts/report-templates.mjs, packages/osuperpowers/tests/report-templates.test.mjs, scripts/emit/issue-templates.mjs, scripts/emit/issue-templates.test.mjs, packages/osuperpowers/skills/cli-driven-development/SKILL.md, packages/osuperpowers/skills/writing-plans/SKILL.md, README.md, scripts/validate/residue.mjs

- **Steps**:
  1. `git mv skills/report-issue/ skills/report-issues/`；SKILL.md frontmatter `name` + description；`finding-meta.json` components 枚举（**唯一改名源**）；**`finding-meta.json` 解析路径四处随 `git mv` 改指 `report-issues/`**（report-templates.mjs:15 · report-templates.test.mjs:16 · issue-templates.mjs:16(+:4 注释) · issue-templates.test.mjs:19） — checkable: `grep report-issue`（单数，词边界）机制面零命中（历史 plan/spec + CHANGELOG 豁免；作用域 = skills / finding-meta / renderer / emit / README / tests）
  2. `cli-driven-development/SKILL.md` ×3 + `writing-plans/SKILL.md` ×1（裸 token）→ 新名；README:20 技能表；`report-templates.test.mjs` components 断言；`residue.mjs` 注释 + 测试词形随改 — checkable: `pnpm run emit` + `emit:check` drift=0（注：spec §2.3 改名面全表；residue 守卫词形在 Task 16 加（防回渗））

- **Acceptance**:
  - `grep report-issue`（单数，词边界）机制面零命中（历史 plan/spec + CHANGELOG 豁免；作用域 = skills / finding-meta / renderer / emit / README / tests）；`pnpm run emit` + `emit:check` drift=0


### Task 12: `writing-plans` 存活句重写 + maintainer docs 全量词形同步

- **Objective**: `writing-plans` 存活句重写 + maintainer docs 全量词形同步（report-issue 词形零残留）

- **Produces**: `writing-plans/SKILL.md:44` 存活句整体重写（report-issues resolves program attribution through progress.json#plan → **Spec:** → overall → Related 链接）+ writing-plans-spec.test 换锚；docs/maintainers 全量词形同步

- **Files**: packages/osuperpowers/skills/writing-plans/SKILL.md, packages/osuperpowers/tests/writing-plans-spec.test.mjs, docs/maintainers/data-driven-templates.md, docs/maintainers/skill-authoring.md

- **Steps**:
  1. `writing-plans/SKILL.md:44` 存活句整体重写——「report-issue resolve-destination resolves its program chain…」→ 新流程表述：`report-issues` resolves program attribution through `progress.json#plan` → **Spec:** → overall → Related 链接（spec review-2 [5] 裁定：不保留已删 resolve-destination 节点名）；配套 `writing-plans-spec.test.mjs:34` 断言换锚 — checkable: 机制面 + maintainer docs 面零 `report-issue` 词形残留（含 `skills/report-issue/` 路径形）；**实测 `grep -rnE '\breport-issue\b' docs/maintainers/` 零命中**
  2. **`docs/maintainers/` 全量词形同步**（面级 sweep）：`data-driven-templates.md`（SOT 路径 + 渲染函数行随 §2.5 收敛删、三表单表 → 两表单）+ `skill-authoring.md:119`（Native 词例随改） — checkable: writing-plans-spec 测试换锚后绿（注：maintainer docs 无机械守卫兜底——全量枚举 + 验收面级 grep 双保险接管）

- **Acceptance**:
  - 机制面 + maintainer docs 面零 `report-issue` 词形残留（含 `skills/report-issue/` 路径形）；**实测 `grep -rnE '\breport-issue\b' docs/maintainers/` 零命中**（面级兜底，未枚举文件同受检）；writing-plans-spec 测试换锚后绿


### Task 13: `finding-meta.json` 重构（report-meta 2+1 / formFieldDefs 2 键 / reportDef / masterDef）

- **Objective**: `finding-meta.json` 重构（report-meta 2+1 / formFieldDefs 2 键 / reportDef / masterDef）+ 表单 emit 连带同步

- **Produces**: metaFields 6→2（skill·step）+ kinds/sessionTypes 枚举删 + formFieldDefs 3→2 键 + reportDef.labels 两枚 + masterDef 收敛 {sessionTitle, harnessRow}；issue-templates.test「3 个 yml」→ 2；compare.mjs productFiles 删 session_report.yml

- **Files**: packages/osuperpowers/skills/report-issues/templates/finding-meta.json, packages/osuperpowers/scripts/report-templates.mjs, scripts/emit/issue-templates.test.mjs, scripts/emit/compare.mjs

- **Steps**:
  1. `metaFields` 6→2（`skill`·`step` 删 harness/kind/cdd/date）；`kinds` 枚举删；`sessionTypes` 枚举删；`components` 值经 Task 11 改名后继验（新值 `osuperpowers:report-issues`——改名单一 owner = Task 11，本 Task 只继验不重复 claim）；`formFieldDefs` 3→2 键（删 session_report；bug_report/enhancement 删 session-type 下拉） — checkable: finding-meta JSON 形状 = spec §2.6 终态表逐行
  2. 新增 `reportDef.labels` = `["osuperpowers","cdd-engine"]`；`masterDef.title` 删（标题中性 topic 直出）+ masterDef 收敛 `{ sessionTitle, harnessRow }` — checkable: `reportDef.labels` 唯一 labels 定义点；`masterDef.title` 删
  3. **表单 emit 面连带同步**——`issue-templates.test.mjs` 三处「3 个 yml」断言 → 2 个；`compare.mjs:39` productFiles 删 `session_report.yml` 项（否则 emit:check 陈旧 walk 报警） — checkable: emit:check drift=0（表单 emit 后同步）；issue-templates.test「3 个 yml」→「2 个 yml」绿；compare.mjs 同步后陈旧 walk 零报警

- **Acceptance**:
  - finding-meta JSON 形状 = spec §2.6 终态表逐行；`reportDef.labels` 唯一 labels 定义点；emit:check drift=0（表单 emit 后同步）；issue-templates.test.mjs「3 个 yml」断言改「2 个 yml」绿 + compare.mjs productFiles 同步后陈旧 walk 零报警


### Task 14: renderer 重写（`report-templates.mjs` 裸调用单模式 + yaml + 入参校验）

- **Objective**: renderer 重写（`report-templates.mjs` 裸调用单模式 + yaml + 入参校验）：先生明渲染 + findings 分型 + dedup/related

- **Produces**: 删 `--mode`（裸调用单入口）· 删 renderComment/renderTitle/resolveDropdownOptions/sessionTypes 注入分支；renderYml 隔离 emit-only 模块（render-yaml.mjs）改 yaml.stringify；聚合 body 渲染；CLI 入参结构校验

- **Files**: packages/osuperpowers/scripts/report-templates.mjs, packages/osuperpowers/scripts/render-yaml.mjs, packages/osuperpowers/tests/report-templates.test.mjs, package.json

- **Steps**:
  1. 删 `--mode`（裸调用单入口）；删 `renderComment`/`renderTitle`/`resolveDropdownOptions`/`sessionTypes` 注入分支；`renderYml` **隔离为 emit-only 模块**（`osuperpowers/scripts/render-yaml.mjs`，仅 `scripts/emit/*.mjs` 消费）后改 `yaml.stringify` — checkable: `report-templates.test.mjs` 入参校验用例（空/非法 → exit 1 + 字段路径）；零 `--mode`/renderComment/renderTitle/resolveDropdownOptions/sessionTypes 残留
  2. 聚合 body 渲染（Session 一行 Harness + findings 分型分段每 finding 后 2 行 meta + 尾收 Dedup/Related + 2 字段 report-meta）；CLI 入口入参结构校验（findings 非空 / type ∈ enums / lang ∈ en/zh / meta.skill/step 必填，失败 exit 1 + 字段路径） — checkable: 聚合渲染用例（N-finding meta 关联：逐 finding 断言四段后紧随 Skill/Step 归属正确）；dedup/related 渲染用例（open → Dedup 行 / closed → Regression / program → Related）
  3. **聚合 body 裸调用入口零 `yaml` import**（消费者运行时零新增依赖——yaml 只经 emit-only 模块） — checkable: 聚合 body 裸调用入口零 `yaml` import（注：裸调用 = `node report-templates.mjs < stdin`）

- **Acceptance**:
  - `report-templates.test.mjs`——入参校验用例（空/非法 → exit 1 + 字段路径）；聚合渲染用例（N-finding meta 关联：逐 finding 断言四段后紧随 Skill/Step 归属正确）；dedup/related 渲染用例（open → Dedup 行 / closed → Regression / program → Related）；零 `--mode`/`renderComment`/`renderTitle`/`resolveDropdownOptions`/`sessionTypes` 残留；**聚合 body 裸调用入口零 `yaml` import**（消费者运行时零新增依赖——yaml 只经 emit-only 模块）


### Task 15: report-issues SKILL.md 重写（新聚合流程 digraph）

- **Objective**: report-issues SKILL.md 重写（新聚合流程 digraph）：explore → collect → reform → confirm → dedup → create-issue? 链

- **Produces**: 新 digraph + 节点定义（工具链 scope 过滤 · 中性 topic 提炼 ≤60 chars · 单趟 dedup updated:>90d window · 不建空 issue 门）；不动式 I1/I3/I5/I6 保留、I7 删、I8/I9 新增；report-meta 终态 2+1

- **Files**: packages/osuperpowers/skills/report-issues/SKILL.md

- **Steps**:
  1. 新 digraph（explore-current-session → collect → reform → confirm → dedup → create-issue? → {create-issue | report-links-only} → report）；节点定义含——工具链 scope 过滤（组件槽位 + 行为谓词 + 拒绝样例 def）、中性 topic 提炼（≤60 chars 含 type/component 剥离）、单趟 dedup（`updated:>90d` window 常量 + `gh issue list --search "updated:>=<ISO now-90d>"` 物化句 + 批量内存匹配）、不建空 issue 门 — checkable: SKILL.md 含完整新 digraph + 节点定义；零 `resolve-destination`/`ensure-session`/`append-comment`/master 复用/`[Session report] <slug> <date>` 壳前缀残留
  2. 不动式：I1 Confirm Gate / I3 Manual / I5 Renderer Determinism / I6 Evidence Contract 保留，I7 删，I8 Dedup Window / I9 Program Link 新增；report-meta 终态 2+1 — checkable: 零 `--mode`/renderComment/renderTitle 词形残留（renderer 已裸调用单入口）；`standalone` 兜底桶概念零表述（注：`#explore-context` 措辞去枚举化（E-7）并入本 Task 复核）

- **Acceptance**:
  - SKILL.md 含完整新 digraph + 节点定义；零 `resolve-destination`/`ensure-session`/`append-comment`/master 复用/`[Session report] <slug> <date>` 壳前缀残留；零 `--mode`/`renderComment`/`renderTitle` 词形残留（renderer 已裸调用单入口，Task 14 删面——消费者按旧 SKILL.md 调用将撞死接口）；`standalone` 兜底桶概念零表述


### Task 16: GitHub label rename + residue 防回渗守卫

- **Objective**: GitHub label rename + residue 防回渗守卫（report-issue 词边界 + 五词形 + git guard + dedup 查询句实测）

- **Produces**: `gh label edit cdd --name cdd-engine`；residue stale-lexicon 增词形守卫（`\breport-issue\b` + --mode/renderComment/renderTitle/resolveDropdownOptions/sessionTypes + execFileSync("git") guard）；dedup 查询句实测三判据

- **Files**: （gh 外发操作）, scripts/validate/residue.ts, scripts/validate/__tests__/residue.test.ts

- **Steps**:
  1. **一次性 repo 数据迁移**（外向操作，独立 Task 不可并入命名重命名）：`gh label edit cdd --name cdd-engine --description "CDD orchestrator / engine / H6 CLI workflow / gate / handoff"` → `gh label list` 验证 — checkable: `gh label list` 有 `cdd-engine` 无 `cdd`（历史 issue 标签随迁）
  2. residue stale-lexicon 加 `report-issue`（词边界 `\breport-issue\b`）+ `--mode`/`renderComment`/`renderTitle`/`resolveDropdownOptions`/`sessionTypes` 词形守卫 + `execFileSync("git")` guard（防手写 git 回渗） — checkable: 机制面词形守卫零命中（复数 `report-issues` 放行）；residue 测试绿
  3. **dedup 查询句实测（spec §2.4 dev 验证——与 label rename 同批兑现）**——以 `date -v-90d +%F` 物化 ISO 绝对日期执行 `gh issue list --state all --limit 100 --search "updated:>=<now-90d>"` 实测三判据：(a) 不报 search 语法错误；(b) 结果集含 open+closed 双态；(c) 与已知久未更新 issue 对照确认 90d 窗口生效 — checkable: dedup 查询句实测三判据 (a)/(b)/(c) 逐条通过（与 label rename 同批完成）（注：guard 词形在引入 guard 的同一 round 必须能绿——裸 `report-issue` 会 substring 命中复数 → 必须词边界）

- **Acceptance**:
  - `gh label list` 有 `cdd-engine` 无 `cdd`；机制面词形守卫零命中（复数 `report-issues` 放行）；residue 测试绿；dedup 查询句实测三判据 (a)/(b)/(c) 逐条通过（与 label rename 同批完成）


### Task 17: README 更新 + CLAUDE.md dev 调用链 + 运维文档 third-party-dependencies.md

- **Objective**: README 更新 + CLAUDE.md dev 调用链 + 运维文档 third-party-dependencies.md

- **Produces**: osuperpowers README 技能表 + engine 面同步；CLAUDE.md dev 段（dev:stub + dist/cli.mjs 直调，不 npm link）；`docs/maintainers/third-party-dependencies.md`（全部第三方 pkg 登记 + 不引清单 + yaml 隔离边界）

- **Files**: packages/osuperpowers/README.md, CLAUDE.md, docs/maintainers/third-party-dependencies.md

- **Steps**:
  1. `osuperpowers/README.md` 技能表 + engine 面同步；**CLAUDE.md dev 段**更新——`node packages/cdd-engine/bin/cdd.mjs` 随 bin 产品化作废 → `pnpm --filter @oscaner-skills/cdd-engine dev:stub && node packages/cdd-engine/dist/cli.mjs <subcommand>`（仍不 npm link 全局，说明原因） — checkable: CLAUDE.md dev 调用链可直接复制执行（stub 后 citty CLI 可用）
  2. 新增 `docs/maintainers/third-party-dependencies.md`——登记全部第三方 pkg（citty/hookable/consola/simple-git/yaml/tinyglobby/handlebars/execa/ajv/semver/unbuild · 用途/版本约束/替换的手写面/维护锚点 · 不引清单：XState/tapable/emittery/oclif/isomorphic-git/js-yaml/husky-not-in-pkg + 理由） — checkable: third-party-dependencies.md 覆盖全部 pkg + 不引清单，且显式记录 yaml 隔离边界（仅 emit-only 模块 render-yaml.mjs 消费 · 仅 root devDependencies · 消费者运行时零第三方依赖）；README 零 report-issue 残留（注：husky 边界说明入文档）

- **Acceptance**:
  - CLAUDE.md dev 调用链可直接复制执行（stub 后 clitty CLI 可用）；third-party-dependencies.md 覆盖全部 pkg + 不引清单，且显式记录 yaml 隔离边界（仅 emit-only 模块 render-yaml.mjs 消费 · 仅 root devDependencies · 消费者运行时零第三方依赖——renderer 入口不得 import yaml；禁经 osuperpowers 发布为运行时依赖）；README 零 report-issue 残留


### Task 18: E-8 schema 紧凑注入 + E-7 explore-context 措辞

- **Objective**: E-8 schema 紧凑注入 + E-7 explore-context 措辞（renderHandoffStub 紧凑 + brainstorming 去枚举化）

- **Produces**: `renderHandoffStub` 紧凑 `JSON.stringify(schema)`（handlebars triple-stash）；templates.test 紧凑格式断言；`brainstorming/SKILL.md` #explore-context 措辞去枚举化

- **Files**: packages/cdd-engine/src/render/templates.mjs, packages/cdd-engine/src/render/__tests__/templates.test.mjs, packages/osuperpowers/skills/brainstorming/SKILL.md

- **Steps**:
  1. `renderHandoffStub`（→ render/templates.mjs）`JSON.stringify(schema, null, 2)` → `JSON.stringify(schema)` 紧凑（handlebars triple-stash 非转义注入） — checkable: 注入 stub 为紧凑 JSON（`JSON.parse(stub) === schema` 保持）；无 2-缩进断言绿
  2. `templates.test.mjs` 增紧凑格式断言（无 2-缩进模式）+ 省 tok 断言（可选）；`brainstorming/SKILL.md` #explore-context Do/Read 措辞去枚举化（code/issues/docs/git log = 参考性示例非固定 4 渠道） — checkable: brainstorming #explore-context 零「固定 4 渠道」表述（E-7）

- **Acceptance**:
  - 注入 stub 为紧凑 JSON（`JSON.parse(stub) === schema` 保持）；无 2-缩进断言绿；brainstorming #explore-context 零「固定 4 渠道」表述


### Task 19: changeset + 全量验证收口

- **Objective**: changeset + 全量验证收口：双 changeset + validate ALL PASS + emit:check 无 drift

- **Produces**: `.changeset/p5-report-issues-aggregation.md`（osuperpowers minor）+ `.changeset/p5-engine-rebuild-ts-lifecycle.md`（cdd-engine）；全量 validate（全块）+ emit:check

- **Files**: .changeset/p5-report-issues-aggregation.md, .changeset/p5-engine-rebuild-ts-lifecycle.md

- **Steps**:
  1. `.changeset/` 建 `p5-report-issues-aggregation.md`（osuperpowers minor：改名 + renderer 重构 + ISSUE_TEMPLATE 瘦身 + label 变更 + **renderYml/yaml 隔离 emit-only 模块**）+ `p5-engine-rebuild-ts-lifecycle.md`（cdd-engine：TS 迁移 + 生命周期重建 + 第三方收敛 + citty 替换） — checkable: 各 phase changeset 齐备（P6 acceptance 复核粒度）
  2. 全量 `pnpm run validate`（全块）+ `pnpm run emit:check` — checkable: `pnpm run validate`（全块）ALL PASS + emit:check 无 drift（不带块数措辞）；engine suite（TS 化后）+ osuperpowers suite 全绿（注：yaml 按 §2.13 (b) 在 changeset 说明仅 root devDependencies、插件零新增运行时依赖）

- **Acceptance**:
  - 各 phase changeset 齐备（P6 acceptance 复核粒度）；`pnpm run validate`（全块）ALL PASS + emit:check 无 drift（不带块数措辞——仓库编排块数与注释自报存分歧，spec AC9 终态已收敛为无块数表述）；engine suite（TS 化后）+ osuperpowers suite 全绿
