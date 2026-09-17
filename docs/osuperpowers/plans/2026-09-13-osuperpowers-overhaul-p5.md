# osuperpowers 架构重构 P5 实施计划 — report-issues 改名与流程精炼 + engine 生命周期重建

**Spec:** [2026-09-13-osuperpowers-overhaul-p5-design.md](docs/osuperpowers/specs/2026-09-13-osuperpowers-overhaul-p5-design.md)

- **Parent program**: [2026-09-13-osuperpowers-overhaul-overall.md v1.27](../specs/2026-09-13-osuperpowers-overhaul-overall.md)
- **Depends on**: P4 shipped（skill 树 + engine 输出契约，PR #262 已 merge，2026-09-16）
- **Base**: develop（finishing read-base 的数据源）

**口径**：P5 是**双主营**——① report-issues 改名与流程精炼（用户初始流程 + E 族 6 条）② cdd-engine 生命周期重建（全量 TS + unbuild · CLI 换 citty · DispatchLifecycle 抽象基类 + hookable 注册面 · commit 边界双门 · 目录依赖单向轴 · 第三方收敛全项）。engine 黑盒契约（4 子命令面 / handoff 输出 / 失败类目）零变化——重建仅内部形态。所有改动 `pnpm run validate` 全绿 + `emit:check` 无 drift。

**commit 边界机制（本 program 全 phase 生效）**：dispatch 两端门——入口门（进入 review 前主 agent 产物已提交、dispatch 期零写树）+ 出口门（产生修改的 dispatch 后修改已提交）；主 agent 处理的由主 agent commit。计划各 Task 的 review/fix 环均遵守。

### Task 1: cdd-engine 包转型 TypeScript + unbuild 构建骨架

- **Do**: `packages/cdd-engine` 从 JS ESM 包转型为 TS 包：新增 `tsconfig.json`、`build.config.ts`（unbuild）、`package.json` 的 `main`/`exports`/`bin` 指向 `dist/` 产物、`files` 含 `dist/` + `templates/`；`vitest` 配置支持 TS 测试；`npm scripts`（`build`/`dev:stub`/`test`）落地；建**最小 `src/bin.ts` 占位入口**（转发现有 `bin/cdd.mjs` commander 命令面，使 `build`/`dev:stub` 入口成立——真实命令面随 Task 9 citty 化落地，本 Task 仅保证入口可达）
- **验收**: `pnpm --filter @oscaner-skills/cdd-engine build` 产出 `dist/`；`unbuild --stub` 后 `node packages/cdd-engine/dist/cli.mjs --help` 可运行（经占位入口转发现有 commander 命令面——`--version` 非现有执行面，parse.mjs 无 `.version()` 声明，属 unknown option，不作验收锚点）；engine suite 现存测试（JS 态）全绿（转换前的基线）
- **注**: 本 Task 只建骨架，不改业务逻辑；JS→TS 逐文件迁移在后续 Task 随模块重构进行（任务组对齐 spec §2.13 目录树）

### Task 2: 第三方依赖引入（simple-git / yaml / tinyglobby / handlebars / consola / hookable / citty）

- **Do**: 仓库根（root）devDependencies 增 `yaml`（emit 工具链——spec §2.13 裁定 (b)：**不进 osuperpowers `package.json#dependencies`**，消费者运行时零新增依赖）；`packages/cdd-engine/package.json` dependencies 增 `simple-git`、`tinyglobby`、`handlebars`、`hookable`、`citty`、`consola`（版本随生态 latest）；**`commander` 不在此移除**——待 Task 9 同一 Task 迁 citty 命令面后移除（本 Task 只引包不动解析入口，Task 3-8 既有测试 import commander 不断链）
- **验收**: `pnpm install` 解析成功；各包可 `import`；`commander` 零残留的验收锚点移到 Task 9（本 Task 结束时刻意保留 commander——Task 9 迁 CLI 后 cdd-engine package.json 零残留）
- **注**: 依赖引入先行——后续 Task 逐步替换手写实现（spec §2.13 表逐行）

### Task 3: 目录按依赖单向轴重组（cli → dispatch → {rules, artifacts, render} → infra）

- **Do**: `packages/cdd-engine/lib/` → `src/` 按 spec §2.13 目录树重组：`cli/` 命令面 · `dispatch/` 生命周期域（base/task/docs/hooks/phases 预留）· `rules/`（commit/stopping/failure/schema）· `artifacts/`（handoff/progress/base-branch）· `render/`（templates/brief）· `infra/`（git/proc/invoke/root/context/registry/exit/log）；`templates/` 保持独立资源目录；`bin/cdd.mjs` → `src/bin.ts`（Task 1 占位入口被真实现覆盖）；`build.config.ts` 入口对齐；**测试路径同步迁移（一任务内完成，否则 ENOENT/断链）**——全部 CDD_MJS exec 常量改指 `packages/cdd-engine/dist/cli.mjs`（依赖 Task 1 stub 产物）+ 全部 `../lib/*.mjs` 静态导入（含 vi.mock 的 helpers）改指 `../src/`
- **验收**: `git mv` + 测试路径迁移后全部既有测试（engine suite + validate 各块）仍绿——8 个测试文件定义 CDD_MJS（约 13 处 exec 常量，cli-shape/host-detection/docs-task/base-branch/lifecycle.wiring/branch-review/root/task/cdd 等）改指 `dist/cli.mjs`、114 处 `../lib/` 导入（26 文件，含 vi.mock）改指 `../src/` 后零 ENOENT/断链；**纯搬移不改逻辑**，零行为变化（迁移护栏）
- **注**: 目录重组是纯机械 move；模块内部重构（TS 化 + 拆分）随后续 Task——先结构后内容

### Task 4: `infra/` 基础设施层（git / proc / invoke / root / context / registry / exit / log）

- **Do**: `infra/git.ts`（simple-git 单点封装：status/add/commit/head/log——替换 `contract/commit.mjs` 手写 `execFileSync("git")` helper 与 `brief/finalize/root` 零星 git）；`infra/proc.ts`（进程生命周期，execa 保留）；`infra/invoke.ts`（CLI 调用契约）；`infra/root.ts`（repoRoot 唯一 cwd 点）；`infra/context.ts`（context-contract 读取）；`infra/registry.ts`（harness registry）；`infra/exit.ts`；`infra/log.ts`（consola 统一日志）
- **验收**: `infra/git.ts`/`root.ts`/`log.ts` 建成且为新实现的唯一依赖点（**本 Task 只建不拆**——旧调用随 Task 5/8 更换时改指，Task 4 结束边界旧实现仍驻留 `src/`，存量不要求归零）；既有 contract/commit 语义测试全绿（dirty→BLOCKED / head mismatch / review skip / fail-open）——**基线不回归 claim，非 API 换底**（换底唯一 owner = Task 5）；repo 级零残留指标（`execFileSync("git")` 零残留 → Task 5；`process.cwd()` 计数 = 1 / 零 `console.log` 散用 → Task 8/9）在此结清归属、不在 Task 4 claim
- **注**: spec §2.13 git 行 + 只维护功能逻辑验证：infra 是零 CDD 语义层，随便换

### Task 5: `rules/` CDD 判定层（commit 双门 / stopping / failure / schema）

- **Do**: `rules/commit.ts`——**commit 边界双门**（spec §2.12 第二部分：入口门 clean-tree 校验 dirty→BLOCKED + 出口门 validateCommitContract 语义含 rewriteHandoffBlocked，判定走 infra/git.ts simple-git）；`rules/stopping.ts`（Review Stopping 守卫簇：blockerCount/stoppedExit3/guard）；`rules/failure.ts`（失败六类 + 配额隔离 + maybeExhaust）；`rules/schema.ts`（handoff JSON schema 校验 validate/recover + handoff-namespace）
- **验收**: 既有 commit-contract 语义测试全绿（dirty→BLOCKED / head mismatch / review skip / fail-open —— 仅底层换 simple-git，**API 换底 claim 唯一 owner**）；**手写 git `execFileSync("git")` 在 `src/` 零残留——repo 级 git 零残留指标唯一落点（Task 4 已结清归属）**；failure/stopping 语义零变化（400+ tests 护栏）——入口门/出口门**生命周期用例**不在此 claim（判定挂载与用例单一 owner = Task 7 基类实现级测试；Task 10 只持 docs-fix 出口门用例）
- **注**: 双门落点 = `rules/commit.ts`（判定）+ `dispatch/base.ts`（挂载，Task 7）；rules 层是「改须重想评审语义」的高风险层

### Task 6: `dispatch/hooks.ts` hookable 注册面 + `dispatch/phases.ts` 阶段表

- **Do**: `dispatch/hooks.ts`——hookable 实例 + **固定 hook 点声明**（`dispatch:before` / `dispatch:after` + commit 门 hook；spec §2.12 第一阶段）；外部插件注册入口（未来消费面）；`dispatch/phases.ts`——PHASES 阶段表数据化（pre-flight / dispatch / post-flight 三阶段，每阶段 step 挂载点）
- **验收**: hooks 实例可 `callHook('dispatch:before')` / 注册 handler 触发；phases 表结构可读可测（阶段 id 枚举、序、责任注释）；测试覆盖 hook 点触发顺序（before → phases → after）
- **注**: 注册面是真可插拔（用户裁定），但固定 hook 点枚举防钩子爆炸；engine 内部变体走继承不依赖注册面（Task 7）

### Task 7: `dispatch/base.ts` DispatchLifecycle 抽象基类（模板方法骨架）

- **Do**: `DispatchLifecycle` 抽象类（TS 虚方法编译期约束）：`run()` 模板方法 = `pre-flight → dispatch → post-flight` 骨架 + 默认 hook 实现（`commitPreCheck` 入口门 → `resolveContext` → `validateMode` → `dispatch` abstract → `schemaValidate` → `normalizeResult` → `commitPostCheck` 出口门）；构造注 `hooks`/`ctx`
- **验收**: 基类无法实例化（abstract）；子类只需覆写关注 hook 即可运行（测试用最小 stub 子类跑通 run() 全流程）；模板方法序断言（pre → dispatch → post + commit 双门卷入）；**入口门用例（review 起点 dirty → BLOCKED）——单一 owner（本 Task 基类实现级测试；Task 5/10 不重复 claim）**
- **注**: 这是 spec §2.12「抽象基类继承覆写」的落点——commit 双门挂基类默认 hook，task/docs 继承

### Task 8: `dispatch/task.ts` + `dispatch/docs.ts` 功能生命周期（继承覆写）

- **Do**: `TaskLifecycle extends DispatchLifecycle`（task 功能：虚方法覆写——resolveContext 含 brief 生成/fixed-point 派生、dispatch 含 render→spawn agent、postFlight 含 H1 四行/exit 归一、双门继承基类）；`DocsLifecycle extends DispatchLifecycle`（docs 功能：spec/plan review/fix dispatch——**docs 面同消费入口门出口门**，spec review-2 [2] 裁定）；原 `run-task.mjs` 13.5 步逻辑迁入两功能类的 hook 覆写；**`artifacts/` + `render/` 剩余模块同步 TS 化**（Artifacts 层：`handoff/{write,finalize,naming}.ts` · `progress.ts` · `base-branch.ts`；Render 层：`brief.ts`——`naming.ts` glob 收拢为 `tinyglobby`，spec §2.13 表逐行）
- **验收**: `cdd review --type spec|plan`（docs）与 `cdd implement/fix`（task）经新生命周期跑通——engine 黑盒契约（4 子命令 / handoff 输出）零变化；双门在 docs 面生效（docs review 起点 dirty → BLOCKED）；既有 task/docs 测试全绿；artifacts/render 全量 TS 化 + `naming` glob 经 tinyglobby——既有 naming/progress/base-branch/handoff/brief 测试转换后仍绿（AC11 全量 TS 兜底）；**`process.cwd()` 计数 = 1（root.ts 唯一）+ 零 `console.log` 散用（经 consola）——repo 级 cwd/log 零残留指标在此达成**（旧消费面随本 Task 全量 TS 化改指 infra；Task 9 CLI 重建继续经 `infra/root.ts` + `infra/log.ts`，零回渗）
- **注**: 功能聚簇——`task.ts` 一文件看全 task 功能；迁移动机 spec §2.13「运维导航验证」

### Task 9: CLI 换 citty（`src/bin.ts` + `cli/` 命令面）

- **Do**: `bin.ts` 用 `defineMainCommand` + 子命令声明（implement/review/fix/base-branch 四子命令——spec review-2 [3] 裁定：无第五个 `docs` 子命令，docs 经 review/fix `--type spec|plan`）；`cli/` 各 action 装配 DispatchLifecycle 子类；`--dry-run` 保留 program 级；`--help`/usage 面经 citty 生成；**`commander` 随本 Task 从 cdd-engine dependencies 移除**（CLI 全量切 citty 后无消费者——本 Task 是移除唯一时点锚，Task 2 结束时刻意保留的 commander 在此归零）
- **验收**: `cdd --help` 子命令集合 = implement/review/fix/base-branch（基线断言更新）；implement/review/fix/**base-branch** 四子命令黑盒行为与 commander 版一致——**base-branch 含嵌套 set/get 面**（parse.mjs 现状二级命令 set/get，经 citty 声明保留或随 SUBCOMMAND_USAGE/parse 迁移行明确列出），既有黑盒测试全绿（含 base-branch.test.mjs）；SUBCOMMAND_USAGE/parse 相关测试迁移到 citty 声明；`cdd-engine/package.json` `commander` 零残留（Task 2 验收改指的锚点在此达成）
- **注**: 这是命令面收敛（P3 已删 brief/research 后的终态四命令）；commander 残留零

### Task 10: commit 双门全接线 + `templates/fix/docs.md` 补提交指令

- **Do**: **入口门无需 `cli/` 接线**——基类默认 hook（`commitPreCheck`）经 task/docs 继承自动生效（review dispatch 前 clean-tree 校验，dirty → BLOCKED；落点 `dispatch/base.ts` 见 Task 7，本 Task 只验证生效面、不重复实现）；出口门在 dispatch 返回后校验（含 docs fix）；`templates/fix/docs.md` 补提交指令（与 task 族同构：fix agent 完成时 commit 被修文档，conventional + 无 attribution + 无改动 skip + out-of-scope 不碰）；**六个 SKILL.md 的 review-fix 循环措辞统一为「进入 review 前确保工作树干净」**（writing-phase-spec / writing-single-spec / writing-overall-spec / writing-plans / brainstorming / cli-driven-development 六处——spec §2.12 落点 4 + AC10；主 agent dispatch 期间零写树，mechanism 由 engine 入口门强制，skill 只陈述义务、不重复实现）
- **验收**: docs fix 出口门用例（docs fix 后 dirty → BLOCKED）——本 Task 唯一用例（入口门用例 owner 已归 Task 7，不重复）；`templates.content.test.mjs` 断言 fix/docs.md 含提交指令；dispatch/docs.ts 中若保留 "No commit-contract" 注释则删除（旧 run-docs.mjs 已成重建前文件，无需单独处理）；**六个 SKILL.md 逐个断言**（每 skill 一条）review-fix 循环措辞含「进入 review 前确保工作树干净」
- **注**: spec §2.12 P5 落点 1-4 全落地——落点锚在 `dispatch/base.ts`/`rules/commit.ts`（review-2 [1] 归一后的面）+ 六 skill 描记面（落点 4）

### Task 11: report-issues 改名面（report-issue → report-issues）

- **Do**: `git mv skills/report-issue/ skills/report-issues/`；SKILL.md frontmatter `name` + description；`finding-meta.json` components 枚举（**唯一改名源**）；**`finding-meta.json` 解析路径四处随 `git mv` 改指 `report-issues/`**——`packages/osuperpowers/scripts/report-templates.mjs`:15、`packages/osuperpowers/tests/report-templates.test.mjs`:16（`../skills/report-issue/...` 段）、`scripts/emit/issue-templates.mjs`:16（+ :4 注释 `via the report-issue`）、`scripts/emit/issue-templates.test.mjs`:19（`../../packages/osuperpowers/skills/report-issue/...` 段）；`cli-driven-development/SKILL.md` ×3（:61/:115/:116 `osuperpowers:report-issue`）+ `writing-plans/SKILL.md` ×1（:44 裸 token `report-issue`）→ 新名；README:20 技能表；`report-templates.test.mjs` components 断言；`writing-plans-spec.test.mjs` resolve-destination 提及（换新锚，见 Task 12）；`scripts/validate/residue.mjs`:703-708 注释 + `residue.test.mjs`:820（ORCHESTRATOR_SKILLS 注释）/:878（测试描述）词形 `report-issue` → `report-issues`（spec §2.3 四文件同步——先于 Task 16 guard 引入轮完成，否则新 guard 命中陈旧词形）
- **验收**: `grep report-issue`（单数，词边界）机制面零命中（历史 plan/spec + CHANGELOG 豁免；作用域 = skills / finding-meta / renderer / emit / README / tests）；`pnpm run emit` + `emit:check` drift=0
- **注**: spec §2.3 改名面全表；residue 守卫词形在 Task 16 加（防回渗）

### Task 12: `writing-plans` 存活句重写 + maintainer docs 全量词形同步

- **Do**: `writing-plans/SKILL.md:44` 存活句整体重写——「report-issue `resolve-destination` resolves its program chain…」→ 新流程表述：`report-issues` resolves program attribution through `progress.json#plan` → **Spec:** → overall → Related 链接（spec review-2 [5] 裁定：不保留已删 resolve-destination 节点名）；配套 `writing-plans-spec.test.mjs:34` 断言换锚（如 `/progress\.json#plan.*first hop/`）；**`docs/maintainers/` 全量词形同步**（面级 sweep，不只枚举文件）：`data-driven-templates.md`（:3/:90/:93 的 SOT 路径 + 渲染函数行 `renderTitle/renderComment/renderMasterBody` 随 §2.5 收敛删、`renderYml` 保留、:91 三表单表 → 两表单、:93 AC12 note → 聚合表述）+ `skill-authoring.md:119`（Native 词例 `report-issue` → `report-issues`——Task 11 收口后的唯一边角）
- **验收**: 机制面 + maintainer docs 面零 `report-issue` 词形残留（含 `skills/report-issue/` 路径形）；**实测 `grep -rnE '\breport-issue\b' docs/maintainers/` 零命中**（面级兜底，未枚举文件同受检）；writing-plans-spec 测试换锚后绿
- **注**: maintainer docs 无机械守卫兜底（spec review-2 [4] 裁定）——全量枚举 + 验收面级 grep 双保险接管，本 Task 拥有整个 sweep

### Task 13: `finding-meta.json` 重构（report-meta 2+1 / formFieldDefs 2 键 / reportDef / masterDef）

- **Do**: `metaFields` 6→2（`skill`·`step` 删 harness/kind/cdd/date）；`kinds` 枚举删；`sessionTypes` 枚举删；`components` 值经 Task 11 改名后继验（新值 `osuperpowers:report-issues`——改名单一 owner = Task 11，本 Task 只继验不重复 claim）；`formFieldDefs` 3→2 键（删 session_report；bug_report/enhancement 删 session-type 下拉）；新增 `reportDef.labels` = `["osuperpowers","cdd-engine"]`；`masterDef.title` 删（标题中性 topic 直出）+ masterDef 收敛 `{ sessionTitle, harnessRow }`；**表单 emit 面连带同步（spec §2.3 四文件）**——`scripts/emit/issue-templates.test.mjs` :23/:140-148/:165 三处「3 个 yml」断言（含 session_report.yml）→ 2 个；`scripts/emit/compare.mjs`:39 `productFiles` 删 `session_report.yml` 项（否则 emit:check 陈旧 walk 报警）
- **验收**: finding-meta JSON 形状 = spec §2.6 终态表逐行；`reportDef.labels` 唯一 labels 定义点；emit:check drift=0（表单 emit 后同步）；issue-templates.test.mjs「3 个 yml」断言改「2 个 yml」绿 + compare.mjs productFiles 同步后陈旧 walk 零报警
- **注**: spec §2.6 + ISSUE_TEMPLATE 瘦身面的 canonical 落点

### Task 14: renderer 重写（`report-templates.mjs` 裸调用单模式 + yaml + 入参校验）

- **Do**: 删 `--mode`（裸调用单入口）；删 `renderComment`/`renderTitle`/`resolveDropdownOptions`/`sessionTypes` 注入分支；`renderYml` **隔离为 emit-only 模块**（`osuperpowers/scripts/render-yaml.mjs`，仅 `scripts/emit/*.mjs` 消费——spec §2.13 裁定 (b)：`yaml` 只入仓库根 devDependencies，不进 osuperpowers dependencies）后改 `yaml.stringify`；聚合 body 渲染（Session 一行 Harness + findings 分型分段每 finding 后 2 行 meta + 尾收 Dedup/Related + 2 字段 report-meta）；CLI 入口入参结构校验（findings 非空 / type ∈ enums / lang ∈ en/zh / meta.skill/step 必填，失败 exit 1 + 字段路径）
- **验收**: `report-templates.test.mjs`——入参校验用例（空/非法 → exit 1 + 字段路径）；聚合渲染用例（N-finding meta 关联：逐 finding 断言四段后紧随 Skill/Step 归属正确）；dedup/related 渲染用例（open → Dedup 行 / closed → Regression / program → Related）；零 `--mode`/`renderComment`/`renderTitle`/`resolveDropdownOptions`/`sessionTypes` 残留；**聚合 body 裸调用入口零 `yaml` import**（消费者运行时零新增依赖——yaml 只经 emit-only 模块）
- **注**: spec §2.5 全表 + §2.10 测试面 + §2.13 yaml 行（(b) 隔离裁定）；裸调用 = `node report-templates.mjs < stdin`

### Task 15: report-issues SKILL.md 重写（新聚合流程 digraph）

- **Do**: 新 digraph（explore-current-session → collect → reform → confirm → dedup → create-issue? → {create-issue | report-links-only} → report）；节点定义含——工具链 scope 过滤（组件槽位 + 行为谓词 + 拒绝样例 def）、中性 topic 提炼（≤60 chars 含 type/component 剥离）、单趟 dedup（`updated:>90d` window 常量 + `gh issue list --search "updated:>=<ISO now-90d>"` 物化句 + 批量内存匹配）、不建空 issue 门；不动式：I1 Confirm Gate / I3 Manual / I5 Renderer Determinism / I6 Evidence Contract 保留，I7 删，I8 Dedup Window / I9 Program Link 新增；report-meta 终态 2+1
- **验收**: SKILL.md 含完整新 digraph + 节点定义；零 `resolve-destination`/`ensure-session`/`append-comment`/master 复用/`[Session report] <slug> <date>` 壳前缀残留；`standalone` 兜底桶概念零表述
- **注**: spec §2.4 全节；`#explore-context` 措辞去枚举化（E-7）并入本 Task 复核

### Task 16: GitHub label rename + residue 防回渗守卫

- **Do**: **一次性 repo 数据迁移**（外向操作，独立 Task 不可并入命名重命名）：`gh label edit cdd --name cdd-engine --description "CDD orchestrator / engine / H6 CLI workflow / gate / handoff"` → `gh label list` 验证（有 cdd-engine 无 cdd，历史 issue 标签随迁）；residue stale-lexicon 加 `report-issue`（词边界 `\breport-issue\b`）+ `--mode`/`renderComment`/`renderTitle`/`resolveDropdownOptions`/`sessionTypes` 词形守卫 + `execFileSync("git")` guard（防手写 git 回渗）；**dedup 查询句实测（spec §2.4 dev 验证——与 label rename 同批兑现）**——以 `date -v-90d +%F` 物化 ISO 绝对日期执行 `gh issue list --state all --limit 100 --search "updated:>=<now-90d>"` 实测三判据：(a) 不报 search 语法错误；(b) 结果集含 open+closed 双态（search 端点默认双态，验证 `--state all` 与 `--search` 无状态丢失）；(c) 与仓库已知久未更新的 issue 号对照确认 90d 窗口生效
- **验收**: `gh label list` 有 `cdd-engine` 无 `cdd`；机制面词形守卫零命中（复数 `report-issues` 放行）；residue 测试绿；dedup 查询句实测三判据 (a)/(b)/(c) 逐条通过（与 label rename 同批完成）
- **注**: spec §2.8 residue 守卫 + §2.7 label rename；guard 词形在引入 guard 的同一 round 必须能绿（spec review-2 [7] 模式：裸 `report-issue` 会 substring 命中复数→ 必须词边界）

### Task 17: README 更新 + CLAUDE.md dev 调用链 + 运维文档 third-party-dependencies.md

- **Do**: `osuperpowers/README.md` 技能表 + engine 面同步；**CLAUDE.md dev 段**更新——`node packages/cdd-engine/bin/cdd.mjs` 随 bin 产品化作废 → `pnpm --filter @oscaner-skills/cdd-engine dev:stub && node packages/cdd-engine/dist/cli.mjs <subcommand>`（仍不 npm link 全局，说明原因）；新增 `docs/maintainers/third-party-dependencies.md`——登记全部第三方 pkg（citty/hookable/consola/simple-git/yaml/tinyglobby/handlebars/execa/ajv/semver/unbuild · 用途/版本约束/替换的手写面/维护锚点 · 不引清单：XState/tapable/emittery/oclif/isomorphic-git/js-yaml/husky-not-in-pkg + 理由）
- **验收**: CLAUDE.md dev 调用链可直接复制执行（stub 后 clitty CLI 可用）；third-party-dependencies.md 覆盖全部 pkg + 不引清单；README 零 report-issue 残留
- **注**: spec §2.13 运维文档 + 开发调用链；husky 边界说明（root dev-only 不进包）入文档

### Task 18: E-8 schema 紧凑注入 + E-7 explore-context 措辞

- **Do**: `renderHandoffStub`（→ `render/templates.ts`）`JSON.stringify(schema, null, 2)` → `JSON.stringify(schema)` 紧凑（handlebars triple-stash 非转义注入）；`templates.test.mjs` 增紧凑格式断言（无 2-缩进模式）+ 省 tok 断言（可选）；`brainstorming/SKILL.md` #explore-context Do/Read 措辞去枚举化（code/issues/docs/git log = 参考性示例非固定 4 渠道）
- **验收**: 注入 stub 为紧凑 JSON（`JSON.parse(stub) === schema` 保持）；无 2-缩进断言绿；brainstorming #explore-context 零「固定 4 渠道」表述
- **注**: spec §2.10 E-8 断言 + §2.4 E-7 nodes 复核

### Task 19: changeset + 全量验证收口

- **Do**: `.changeset/` 建 `p5-report-issues-aggregation.md`（osuperpowers minor：改名 + renderer 重构 + ISSUE_TEMPLATE 瘦身 + label 变更 + **renderYml/yaml 隔离 emit-only 模块**——`yaml` 仅入仓库根 devDependencies，插件 `package.json#dependencies` 零新增、消费者运行时零新增依赖）+ `p5-engine-rebuild-ts-lifecycle.md`（cdd-engine：TS 迁移 + 生命周期重建 + 第三方收敛 + citty 替换——patch/minor 随版本策略判定）；全量 `pnpm run validate`（全块）+ `pnpm run emit:check`
- **验收**: 各 phase changeset 齐备（P6 acceptance 复核粒度）；`pnpm run validate`（全块）ALL PASS + emit:check 无 drift（不带块数措辞——仓库编排块数与注释自报存分歧，spec AC9 终态已收敛为无块数表述）；engine suite（TS 化后）+ osuperpowers suite 全绿
- **注**: 逐 phase changeset 纪律；yaml 按 §2.13 (b) 在 changeset 说明：仅 root devDependencies、插件零新增运行时依赖（review-2 [8] 的 (a)/(b) 二选一已裁 (b)，不得表述为依赖新增）

---

## Review

Rule: Fresh-Subagent Review Passes must all pass before reaching user review and cli-driven-development.