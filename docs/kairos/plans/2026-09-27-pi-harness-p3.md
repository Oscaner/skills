# Pi Harness P3 实施计划（Pi Harness P3 Implementation Plan）

**Spec:** [2026-09-27-pi-harness-p3-design.md](docs/kairos/specs/2026-09-27-pi-harness-p3-design.md)

- **Parent program**: [2026-09-27-pi-harness-overall.md v1.17](docs/kairos/specs/2026-09-27-pi-harness-overall.md)
- **Version**: v1.10 · 2026-09-30（plan review-3 fixes v1.3 + 用户拍板 T6 bootstrap v1.4 → Workspace 收编 v1.5 → T6 补钉 v1.6 → T7 崩溃恢复 v1.7 → review-5 fixes v1.8 → **T8 统一终止模型 v1.9** → **T9 预算维度统一 v1.10**）
- **Depends on**: P3 design v1.6 Approved（`495707f4` 前版 C1–C7 + 契约面 D1–D4 + Contract Lexicon L2 + 崩溃恢复 T7 + 统一终止模型 T8 + 预算维度统一 T9）
- **Base**: develop

## Constraints

### 口径

- **单一真相（G1）**：engine harness 标识符行键集合恰 `{claude, cursor, pi}`——`harness-registry.json` 行键 + 测试 name-set 断言同源；`cursor-agent` 唯一合法暴露点 = registry `cli` 字段数据值（外部二进制名，不可改）
- **零残留不豁免（G2，用户拍板）**：守卫扫 live 面零 `cursor-agent`（唯一允许命中 = registry `cli` 数据值所在行 + contract-lexicon.json 同源数据行——词表 harness `clis` 映射 / residue 禁令表数据行，守卫读词表即单源、数据行随词表引入同具放行形态）；历史正文（2026-09-13 family / change-history 行）即史实，不 retro-rename、无豁免机制；P3 扫面 = engine src/tests + scripts + docs/maintainers 三面（scripts 面测试位默认排除、守卫自身测试自豁免——逐面 `__tests__` 处置见 T2），README 家族与 osuperpowers tests 残留面零化随 P4 激活（零化序列：T1 随 rename 同落清零 engine src/tests + scripts 活动引用，T2 随守卫部署同落清零 docs/maintainers——自 T2 起每任务闭合三面零命中，唯一允许 = registry `cli` 数据值所在行 +（T4 起）contract-lexicon.json 数据行，放行集合随数据源推导、仍是数据派生白名单而非人改豁免清单）
- **OOP 抽象统一（C1/C5/C6）**：Criterion ②——行为收敛为 instance methods、零裸函数导出；C5 收编 next-step.ts / result-face.ts / finalize.ts 三处裸函数为 `StatusDeriver` / `NextStepRouter` / `ResultFace`，模块级单例收敛为构造注入；C6 收编四个独立守卫入口为 `ContractLexiconGuard` 单类
- **命令契约双轴（D1–D3）**：review 判定轴（CHANGES_REQUESTED/REVIEW_FIX/APPROVED 引擎推导）独占；implement/fix 工作轮统一 `COMPLETED`；`blocker:` 判定源计数（fix = `--findings` 输入 review 计数）；stdout 全 op 单胶囊 `status · blocker · handoff` + `next:`
- **host-marker 白名单恰 4 键不变**：`["AI_AGENT","CLAUDE_CODE_SESSION_ID","CURSOR_TRACE_ID"]` + `PATH`（context.test.ts 钉死）——pi 复用 `AI_AGENT` 通道零新键
- **分层不破（Non-goal）**：engine registry（spawn 契约面）与 emit 分发注册表 `scripts/lib/harness-registry.ts`（分发 manifest 面）不合并；本 phase 不触碰 emit 侧
- **消费面零引擎形状 restate（C7，iron rule）**：orchestrator skills 只锚路由 token（`next:` / `CDD_BLOCKED:` / handoff `findings`），`3-line return block` / `4th line counters` 类字面量清零；契约词表单一事实源后，形状改动零 skill 面漂移

### commit 边界机制

- 实现提交按任务粒度（conventional commits，无 attribution trailers）
- spec/plan 文档仅由 orchestrator（Plan Sole Writer）与 cdd fix-agent 修改；implement agent 零文档修改权
- **engine 数据面变更需 changeset**：`harness-registry.json` renaming + pi 行 + `contract-lexicon.json` 随包发布（build.config copy → dist/resources/）+ T6 workspace 域收编（lifecycle 落点变更 = engine 行为面）——changeset 记 cdd-engine（类型按 `.changeset/README.md` version scheme 判定，先读再判）
- 每任务闭合面测试绿 + `pnpm run precommit` 绿；engine 改面用 `pnpm --filter @oscaner-skills/cdd-engine test`（T3 后需 `dev:stub` 重跑以承接新契约面）
- 无 emit 产物面变更（Contract Lexicon 词表 = engine 数据面，非分发 manifest）——`pnpm run emit:check` 保持 fresh

### Flow Atomicity

- 单任务原子：每个任务闭合前该任务面测试 + 相关 validate 面全绿；name-set / byte / 白名单 pin 破即是设计漂移信号，报告 orchestrator 判定而非"带伤闭合"
- 串行 dispatch：T1→T2→T3→T4→T5→T6→T7→T8→T9，全 singleton 组（无 `## Task Groups` 合并）
- T3（命令契约面）闭合必跑 `dev:stub` 使后续 dispatch 消费新契约面；T4 词表接线后 validate 单 block 是验收主体

### 顺序原则

- T1（C1+C2 engine 数据面核心：harness.ts 抽象 + registry rename + pi 行）→ T2（C3 测试接线：三元组 name-set + 优先级矩阵 + residue G2 守卫）→ T3（C5 命令契约面：StatusDeriver/NextStepRouter/ResultFace + 调用面）→ T4（C6 Contract Lexicon：contract-lexicon.json + ContractLexiconGuard 收敛）→ T5（C7 消费面措辞 + C4 声明 + 运维文档/CLAUDE.md + changeset + 终验 validate 全绿）→ T6（Workspace 域收编：WorkspaceRoot/Workspace 双类 + 双源灭绝 + 死壳删除 + lifecycle 归位，用户拍板追加）→ T7（崩溃恢复健壮性：HARNESS_ABORT + crash-only snapshot + stash 平面删除，消费 T6 Workspace 域）→ T8（统一终止模型：exit gate 前终止全类覆盖 + crash record 三方统一 + cause + resume 软帽 + 类别/机制解耦，用户拍板追加）
- T6→T7 置尾：workspace 数据面收编依赖前五任务的实际产物面（contract lexicon / 契约面已落），且 bootstrap 保证（`.osuperpowers/.gitignore` 自守卫）+ lifecycle 归位 slug 是全程序 workspace 落点的统一收口；T7 崩镜记录/恢复（crash record 落盘 + crash-only snapshot + 恢复路由）依赖 T6 Workspace 域承接（`crashPath` / `writeJson` / snapshot 落点），顺序必在 T6 之后——T6 收编为 T7 铺平单一落点
- T7→T8 置尾：T8 在 T7 落地物上增量（crash record 形状 / teardown 单路机制已具），T7 通用谓词天然兜住 over-budget/timeout（engine terminated child = 非零退出 + 无 handoff），T8 仅正式化 cause 归类 + 三方统一 + 软帽——**零空窗**；T8 顺序必在 T7 之后
- T8→T9 置尾：T9（预算维度统一）在 T8 落地物上增量——T8 大改 task.ts（teardown 单路化），T9 再动同一岛 spawn 点的 mode 传参（一行增量零冲突）；T9 修复的正是预算接线 bug（task island 硬编码 `"task"` 使 `review --type task` 错读实施预算），op 维度与 T8 的 cause `engine-over-budget` 语义对齐；T9 顺序必在 T8 之后
- 每任务 end-to-end：实现 → 该任务面测试绿 → precommit 面绿

### 仓库纪律

- node：`fnm use`（.nvmrc）；引擎调用 `node packages/cdd-engine/dist/cli.mjs` 直调（`dev:stub` 后），不走 global cdd
- language policy：代码/测试 English-primary（本计划为 internal docs，中文豁免 Strategy B）；无 attribution trailers
- 消费面零程序叙事（iron rule）：SKILL.md / 消费者侧文件不带本程序 phase/issue 叙事——C7 措辞更新只删形状 restate，不注入程序笔法
- 引擎 `.mjs` plane zero：新增测试用 `.test.ts`（vitest）/ `.test.mjs`（node:test），src 不落 `.mjs`
- pi invoke 事实（O2）：`-p --mode text`（本机 `pi --help` 实证，pi 无 `--force`/`--output-format` 形态）——不臆造 pi 无证据的 spawn 面


### Task 1: C1+C2 engine 数据面核心（harness.ts 抽象 + registry rename + pi 行）

- **Objective**: C1+C2 engine 数据面核心（harness.ts 抽象 + registry rename + pi 行）：Harness 四类 + cli 单源 + row 键三元组

- **Produces**: `src/infra/harness.ts`（Harness/CursorHarness/ClaudeHarness/PiHarness/ORDER，零裸函数导出）；`harness-registry.json` 行键 `cursor-agent` → `cursor`（cli 值保持）+ pi 行；`detectCurrentHarness` 按 ORDER 遍历；测试面键引用同落

- **Files**: packages/cdd-engine/src/infra/harness.ts, packages/cdd-engine/src/infra/harness-registry.json, packages/cdd-engine/src/cli/shared.ts, scripts/observe-cache.ts, packages/cdd-engine/src/cli/__tests__/cdd.test.ts, packages/cdd-engine/src/infra/__tests__/registry.test.ts, packages/cdd-engine/src/infra/__tests__/infra.registry.test.ts, packages/cdd-engine/src/infra/__tests__/registry.cache.test.ts, packages/cdd-engine/src/infra/__tests__/invoke.dispatch-set.test.ts, packages/cdd-engine/src/cli/__tests__/host-detection.test.ts, scripts/__tests__/observe-cache.test.ts

- **Steps**:
  1. 新建 `packages/cdd-engine/src/infra/harness.ts`（OOP 抽象，Criterion ②）——`abstract class Harness`（id + 类型化行访问 + abstract detect）；`CursorHarness`（detect = CURSOR_TRACE_ID）；`ClaudeHarness`（detect = CLAUDE_CODE_SESSION_ID || AI_AGENT claude-code 前缀）；`PiHarness`（detect = AI_AGENT === "pi"）；`ORDER` 常量 `[Cursor, Claude, Pi]`（注册序即优先级）；单侧消费 Registry 数据门面 — checkable: `harness.ts` 含全导出，零裸函数导出
  2. `packages/cdd-engine/src/infra/harness-registry.json`：行键 `cursor-agent` → `cursor`（`cli` 值保持 `"cursor-agent"`——外部二进制名唯一数据暴露点）；新增 `pi` 行（cli "pi" · invoke "-p --mode text" · output text · ship full · cache pending）；行键集合 = `{claude, cursor, pi}` — checkable: `harness-registry.json` 行键恰 `{claude, cursor, pi}` 且 cursor 行 cli = "cursor-agent"、pi 行 invoke = "-p --mode text"
  3. `cli/shared.ts` `detectCurrentHarness(env)` 签名不变（residue 直读锚保持），实现按 `ORDER` 遍历实例调 detect，命中返回 instance.id，全空返回 ""；`scripts/observe-cache.ts` 日头行键随 registry 行键直出；测试面键引用随 rename 同落（registry.test / infra.registry.test / registry.cache.test / invoke.dispatch-set.test / host-detection.test / observe-cache.test / cdd.test.ts 注释） — checkable: `detectCurrentHarness` 对 `{CURSOR_TRACE_ID:"1"}` → "cursor"、`{AI_AGENT:"pi"}` → "pi"、`{}` → ""；测试面键引用同落（Flow Atomicity 改名任务闭合即全绿）；engine `pnpm test` + scripts vitest 该面全绿 + precommit 面绿

- **Acceptance**:
  - `harness.ts` 含 `Harness`/`CursorHarness`/`ClaudeHarness`/`PiHarness`/`ORDER` 导出，零裸函数导出；`harness-registry.json` 行键恰 `{claude, cursor, pi}` 且 `cursor` 行 `cli` = `"cursor-agent"`、`pi` 行 `cli` = `"pi"` + `invoke` = `"-p --mode text"` + cache pending 三字段；`detectCurrentHarness` 对 `{CURSOR_TRACE_ID:"1"}` → `"cursor"`、`{AI_AGENT:"pi"}` → `"pi"`、`{}` → `""`（T2 表驱动全量另验）；engine `pnpm test` + `scripts` vitest 该面全绿（测试面键引用随 rename 同落，见 Do）；precommit 面绿。


### Task 2: C3 测试接线 + residue G2 守卫

- **Objective**: C3 测试接线 + residue G2 守卫（host-detection 表驱动 + 三元组 name-set 反向 + live 面 cursor-agent 守卫）

- **Produces**: host-detection 表驱动（单 marker 五 case + 优先级矩阵）；registry name-set `{claude,cursor,pi}` 正反双向；registry.cache pi 行 profile；residue G2 守卫（三面零 cursor-agent，唯一允许 registry cli 数据行）；docs/maintainers 03:48 行键镜像

- **Files**: packages/cdd-engine/src/cli/__tests__/host-detection.test.ts, packages/cdd-engine/src/infra/__tests__/registry.test.ts, packages/cdd-engine/src/infra/__tests__/infra.registry.test.ts, packages/cdd-engine/src/infra/__tests__/registry.cache.test.ts, scripts/validate/residue.ts, scripts/validate/__tests__/residue.test.ts, docs/maintainers/03-context-caching-doctrine.md

- **Steps**:
  1. `host-detection.test.ts` 表驱动重写——cursor · claude session · claude AI_AGENT · pi · unknown + **优先级矩阵**（CURSOR_TRACE_ID+AI_AGENT=pi → cursor；CLAUDE_CODE_SESSION_ID+AI_AGENT=pi → claude；全空 → ""） — checkable: host-detection 表驱动全绿（单 marker 五 case + 优先级矩阵三 case + `{}` empty）
  2. `registry.test.ts` / `infra.registry.test.ts` 补**无杂键反向**断言（杂键即 fail，G1 双向钉死）+ 注释归位；`registry.cache.test.ts` cursor/pi 行 profile 用例 + 全行迭代 schema 校验含 pi（零硬编码） — checkable: registry 测试 name-set 恰 `{claude, cursor, pi}` 全绿（正向 T1 同落 + 无杂键反向）；registry.cache 全行迭代含 pi 行过 schema
  3. `scripts/validate/residue.ts` 新增 **live 面 last-index 守卫**（G2）——扫描 engine src（含测试）+ scripts + docs/maintainers 三面，`cursor-agent` 命中即 fail；**逐面 `__tests__` 处置钉死**（engine src 走 includeTests · scripts 面默认自豁免 · docs/maintainers 全扫）；守卫 body 不以字面承载词法（拼接构造） — checkable: residue G2 守卫三回归用例全绿 + 三面有效扫面零命中（唯一允许 registry `cli` 数据值）；engine `pnpm test` 全绿 + validate 服务面全绿 + precommit 面绿
  4. `docs/maintainers/03-context-caching-doctrine.md:48` Baseline entries 行键 `cursor-agent` → `cursor` 镜像（docs/maintainers 面唯一活残留随守卫同落零化） — checkable: docs/maintainers 03:48 行键镜像随守卫同落零化

- **Acceptance**:
  - host-detection 表驱动全绿（单 marker 五 case + 优先级矩阵三 case + `{}` empty）；registry 测试 name-set 恰 `{claude, cursor, pi}` 全绿（正向 T1 同落 + 无杂键反向）；registry.cache 全行迭代含 pi 行过 schema；invoke.dispatch-set 无 `cursor-agent` 引用；host-marker 白名单恰 4 键断言（`context.test.ts` / `infra.context.test.ts`）保持绿；residue G2 守卫三回归用例全绿 + 三面有效扫面零命中（engine src 含测试 / scripts live（非 `__tests__`）/ docs/maintainers 全扫，唯一允许 registry `cli`——守卫自身回归测试位属默认自豁免、不构成漏扫；docs/maintainers 03:48 行键镜像随守卫同落零化）；engine `pnpm test` 全绿；`pnpm run validate` 服务面全绿；precommit 面绿。


### Task 3: C5 命令契约面（StatusDeriver / NextStepRouter / ResultFace）

- **Objective**: C5 命令契约面（StatusDeriver / NextStepRouter / ResultFace）：判定轴/工作轮双轴 + 单胶囊 stdout + 构造注入

- **Produces**: `StatusDeriver`（deriveReviewStatus 判定轴 + workStatus 工作轮 COMPLETED）；`NextStepRouter`（next instance-method，决策表原样迁移）；`ResultFace`（全 op 单胶囊）三组件零裸函数、构造注入；调用面同步（review/fix/task/branch/docs）

- **Files**: packages/cdd-engine/src/rules/status.ts（StatusDeriver 落点）, packages/cdd-engine/src/rules/next-step.ts, packages/cdd-engine/src/cli/result-face.ts, packages/cdd-engine/src/cli/review.ts, packages/cdd-engine/src/cli/fix.ts, packages/cdd-engine/src/dispatch/task.ts, packages/cdd-engine/src/dispatch/branch.ts, packages/cdd-engine/src/dispatch/docs.ts

- **Steps**:
  1. 新建 `StatusDeriver`：`deriveReviewStatus(findings)` → 判定轴（CHANGES_REQUESTED / REVIEW_FIX / APPROVED，收编 finalize 推导语义）；`workStatus(declared)` → 工作轮轴（COMPLETED / BLOCKED，收编 implementStatusFromReturnLine 的 APPROVED|BLOCKED 折叠——APPROVED 折叠改为 COMPLETED） — checkable: StatusDeriver 全导出、零裸函数、构造注入（无模块级单例）
  2. 新建 `NextStepRouter`：`next(input)` → instance method，C5 决策表原样迁入（next-step.ts nextStepFor 语义逐行保留）；模块级单例收敛为构造注入 — checkable: NextStepRouter 全导出、构造注入；`next:` 行 C5 决策表语义逐行不变（next-step.test 迁移后全绿）
  3. 新建 `ResultFace`（全 op 单一 stdout 面）：`emit(op, ctx)` → `status: {…} · blocker: {n} · handoff: {path}` + `next: {…}`；构造注入 #statusDeriver/#nextRouter/#convergence；review → 判定轴 + 自身 findings blocker；implement/fix → 工作轮 + 判定源计数（fix = `--findings` 输入 review 的 blocker 数；implement 无判定源 → `blocker: 0`） — checkable: review 输出判定轴 + 自身 findings blocker；implement/fix 输出工作轮 COMPLETED、fix blocker = `--findings` 输入计数、implement blocker = 0；task/docs 两族单胶囊同形
  4. 调用面同步：cli/review.ts / cli/fix.ts / dispatch/task.ts / dispatch/branch.ts / dispatch/docs.ts 消费点改走 `ResultFace`；测试迁移/重写 result-face.test + next-step.test（同路径不并存新旧两文件）；`pnpm --filter @oscaner-skills/cdd-engine dev:stub` 重跑 + 冒烟 — checkable: result-face.test / next-step.test 全绿；冒烟（`--dry-run` + host env + 干净树前置）输出单胶囊；engine `pnpm test` 全绿 + precommit 面绿

- **Acceptance**:
  - 三组件（StatusDeriver/NextStepRouter/ResultFace）全导出、零裸函数、构造注入（无模块级单例）；review 输出判定轴 + 自身 findings blocker（`status: CHANGES_REQUESTED · blocker: 1 · handoff: …`）；implement/fix 输出工作轮（`status: COMPLETED`）、fix 的 `blocker:` = `--findings` 输入计数（非自报空数组）且 implement 的 `blocker:` = 0（无判定源，D2）；task/docs 两族单胶囊同形；`next:` 行 C5 决策表语义逐行不变（next-step.test 迁移后全绿）；engine `pnpm test` 全绿（含 result-face.test）；`dev:stub` 后 `node dist/cli.mjs review --type spec --spec <实际 spec 路径> --dry-run` 冒烟输出单胶囊（`--spec <path>` 操作数必填——缺失时 `resolveTargetDoc` 对 type=spec 直接 exit 2 `missing required --spec <path>`，按字面命令走不到输出面；叠加 `--dry-run` 轻量断言胶囊形状、不触发真实 review dispatch，对齐 parse.ts `--dry-run` 主令声明；冒烟在 host env（如 `CLAUDE_CODE_SESSION_ID=1`，对齐 smoke-cdd 先例）+ 干净树前置下执行，缺一即前置 BLOCK）；precommit 面绿。


### Task 4: C6 Contract Lexicon（contract-lexicon.json + ContractLexiconGuard）

- **Objective**: C6 Contract Lexicon（contract-lexicon.json + ContractLexiconGuard）：五域词表 + 四检查单守卫 + checkWording 零形状 restate

- **Produces**: `contract-lexicon.json`（五域：harness / status / stdout / residue / anatomy）；build.config copy entry 扩展；`ContractLexiconGuard`（checkAnatomy / checkResidue / checkWording / checkConfig）四方法；validate 单 block 收敛；SKILL.md :59/:119/:108 改锚

- **Files**: packages/cdd-engine/src/infra/contract-lexicon.json, packages/cdd-engine/build.config.ts, scripts/lib/contract-lexicon.ts, packages/osuperpowers/skills/cli-driven-development/SKILL.md

- **Steps**:
  1. 新建 `contract-lexicon.json`（`packages/cdd-engine/src/infra/`——与 registry 同目录同发布 cadence）：五域单词表——harness（ids + clis 镜像）· status（vocab 五元 + 双轴映射）· stdout（胶囊/next/CDD_BLOCKED/findings 锚）· residue（禁令表：cursor-agent 唯一允许 registry cli 数据值）· anatomy（skill-anatomy registry 引用）；build.config.ts copy pattern 扩展 `["harness-registry.json", "contract-lexicon.json"]` — checkable: `contract-lexicon.json` 五域词表存在且与引擎事实一致；`dist/resources/contract-lexicon.json` 随 build 物化存在
  2. 新建 `scripts/lib/contract-lexicon.ts`：`class ContractLexiconGuard`——`checkAnatomy(skills)`（digraph-consistency 断言迁入）· `checkResidue(targets)`（residue 收集器迁入 + targetsOverride 注入）· `checkWording(skills)`（C7 措辞守卫：形态 restate 字面量 fail + 路由 token 锚）· `checkConfig(engineConfig)`（channel audit 迁入） — checkable: `ContractLexiconGuard` 四方法全绿（三先例 test 入口收敛后断言经 guard 同源通过）；词表单一事实源（guard 读 lexicon 不经手写许清单）
  3. validate 单 block 接线：四独立 test 入口（digraph-consistency / residue.test / context.test / 新 contract-wording）收敛为 guard 一次驱动；消费面同任务零化——`cli-driven-development/SKILL.md:59` 删 `3-line return block`/`4th line counters` 形状 restate 改锚路由 token；`:119`/`:108` 同任务改锚（fail-set 粒度钉死） — checkable: checkWording 零形状 restate（SKILL.md :59/:119/:108 已零化/改锚）；validate 单 block 下全绿 + precommit 面绿；`pnpm run emit:check` fresh

- **Acceptance**:
  - `contract-lexicon.json` 五域词表存在且与引擎事实一致（harness 三元组 / status 五元 + 双轴映射（判定轴三态/工作轮 COMPLETED）/ stdout 胶囊 / residue 禁令 / anatomy registry），`dist/resources/contract-lexicon.json` 随 build copy entry 物化存在（dev:stub / build 后）；`ContractLexiconGuard` 四方法全绿（checkAnatomy 等价 digraph-consistency / checkResidue 等价 residue 收集器（词表数据行并入放行集合后等价性与既存回归同绿）/ checkWording 零形状 restate（SKILL.md `:59` / `:119` / `:108` 已同任务零化/改锚，fail-set 粒度按 Do 钉死）/ checkConfig 等价 channel audit）——三先例 test 入口收敛后断言经 guard 同源通过；validate 单 block 下全绿（`pnpm run validate`——守卫 + 词表共存：词表 harness `clis` / residue 禁令表数据行放行、词表非数据域 `cursor-agent` 残留仍 fail，G2 三面零命中成立）；`pnpm run emit:check` fresh（词表 = engine 数据面，非 manifest 产物）；precommit 面绿。


### Task 5: C7 消费面措辞 + C4 声明 + 运维文档/CLAUDE.md + changeset + 终验

- **Objective**: C7 消费面措辞 + C4 声明 + 运维文档/CLAUDE.md + changeset + 终验（消费面零引擎形状 restate）

- **Produces**: 其余 orchestrator skills 零形状 restate 复核；docs/maintainers（01/02/03/04）契约措辞同步；根 CLAUDE.md emit/validate/engine 契约描述；cdd-engine changeset；终验 validate 全绿

- **Files**: packages/osuperpowers/skills/cli-driven-development/SKILL.md, docs/maintainers/01-template-doctrine.md, docs/maintainers/02-naming-conventions.md, docs/maintainers/03-context-caching-doctrine.md, docs/maintainers/04-program-experience.md, CLAUDE.md

- **Steps**:
  1. `cli-driven-development/SKILL.md` 复核改锚路由 token（next:/CDD_BLOCKED:/handoff findings）且 :119/:108 措辞与单胶囊/handoff 契约一致；其余 orchestrator skills 盘点已证零形状 restate——复核即可必要时微调 — checkable: `cli-driven-development/SKILL.md` 零引擎形状 restate，仅锚路由 token
  2. `docs/maintainers/`：01-template-doctrine（registry 行键镜像）· 02-naming-conventions（契约措辞指针 + Contract Lexicon 引用）· 03-context-caching-doctrine（Baseline 补 pi 行）· 04-program-experience（Contract Lexicon 机制记录）；根 `CLAUDE.md` emit/validate 描述随 Contract Lexicon 单 block + C5 单胶囊更新；`pnpm run emit` 重跑 → `emit:check` 零漂移 — checkable: docs/maintainers 全家族与契约面/词表一致、行键镜像零 cursor-agent；CLAUDE.md 描述更新；`pnpm run emit` + `emit:check` 零漂移
  3. C4 空壳声明 + 坐标系分层（R1）：确认 report/issue-body.json masterDef.harnessRow 字段零改动、Host 行不被行键改写；changeset 建 cdd-engine（cursor rename + pi 行 + 契约面 + lexicon 数据面，类型按 scheme）；终验 `pnpm run validate` 全绿 — checkable: C4 核对（harnessRow 零改动、坐标分层成立）；changeset 存在；`pnpm run validate` 全块全绿 + precommit 面绿

- **Acceptance**:
  - `cli-driven-development/SKILL.md` 零引擎形状 restate（`3-line return block` / `4th line counters` 类字面量清零），仅锚路由 token；docs/maintainers 全家族与契约面/词表一致、行键镜像零 cursor-agent（G2 三面扫描含 docs/maintainers 零命中）；根 CLAUDE.md emit/validate/engine 契约描述更新；C4 核对：`packages/cdd-engine/templates/report/issue-body.json:202` `masterDef.harnessRow`（`- Harness: <harness>`）字段零改动、Host 行不被引擎行键改写（坐标分层成立）；`pnpm run emit` + `emit:check` 零漂移；changeset 存在（cdd-engine，breaking/patch 按 scheme）；`pnpm run validate` 全块全绿；precommit 面绿。


### Task 6: Workspace 域收编（WorkspaceRoot/Workspace 双类 + 双源灭绝 + lifecycle 归位，用户拍板 2026-09-30）

- **Objective**: Workspace 域收编（WorkspaceRoot/Workspace 双类 + 双源灭绝 + lifecycle 归位 slug + naming.ts 死壳删除）

- **Produces**: `src/infra/workspace.ts`（WorkspaceRoot.from/ensure/gitignore/for/enumerate + Workspace readJson/writeJson/lifecyclePath）；lifecycle 归位 `<workspaceRoot>/<slug>/lifecycle.json`（reapStale 改枚举形）；`naming.ts` 删除（10 项导出逐项归位）；6 处散装 mkdirSync 归零；根 .gitignore `.superpowers` 退役

- **Files**: packages/cdd-engine/src/infra/workspace.ts, packages/cdd-engine/src/infra/root.ts, packages/cdd-engine/src/cli/bin.ts, packages/cdd-engine/src/cli/review.ts, packages/cdd-engine/src/dispatch/task.ts, packages/cdd-engine/src/dispatch/branch.ts, packages/cdd-engine/src/dispatch/base.ts, packages/cdd-engine/src/artifacts/handoff/naming.ts, packages/cdd-engine/src/artifacts/handoff/write.ts, packages/cdd-engine/src/artifacts/progress.ts, packages/cdd-engine/src/infra/proc.ts, packages/cdd-engine/templates/engine-config.json, .gitignore

- **Steps**:
  1. 新建 `packages/cdd-engine/src/infra/workspace.ts`（OOP，Criterion ②）——`class WorkspaceRoot`：`static from(repoRoot, config)`（自 ConfigLoader.handoffNamespace().workspaceRoot 派生——消除 bin.ts/review.ts 双源）· path · gitignorePath · ensure()（根级 `*` 自守卫）· for(doc): Workspace（slug 派生唯一入口，取代 resolveWorkspace）· enumerate()；`class Workspace`：path · ensure()（收编 6 处散装 mkdirSync）· readJson/writeJson（原子 JSON 读写）· progressPath/briefPath/lifecyclePath 子路径唯一事实源 — checkable: `src/infra/workspace.ts` 含双类全导出、零裸函数；`.osuperpowers/.gitignore`（根级 `*`）自守卫；6 处散装 mkdirSync 归零
  2. **lifecycle 归位 slug**：`WorkspaceRoot.for(plan)` + `.lifecyclePath`——`CddRuntime.initProcLifecycle({ diskPath })` 的 diskPath 由 dispatch 上下文注入 `.lifecyclePath`（`<workspaceRoot>/<slug>/lifecycle.json`），不再 repo 级单一文件；`reapStale` 改 `WorkspaceRoot.enumerate()` 枚举全部 slug 的 lifecycle.json 全扫（幸存者逐文件写回、绝不聚合单一盘路径） — checkable: `lifecycle.json` 落 `<workspaceRoot>/<slug>/` 而非 repo 级；reap stale 枚举全扫等价（逐 slug 独立 + 幸存者逐文件写回，测试钉死）
  3. **双源灭绝**：`bin.ts:114` 启动期 repo 级单文件绑定删除（启动无 dispatch 上下文无 slug）；`review.ts taskReviewWorkspace` → `WorkspaceRoot.from(...).for(doc)`；`naming.ts:193-212 materializeWorkspace` → WorkspaceRoot 路径；**死壳即删**：删除 `naming.ts`（10 项导出逐项归位）+ 根 `.gitignore` `.superpowers` 行退役；**注入改造**：ProgressLedger/Handoff 构造注入 Workspace；**namespace 单源**：engine-config workspaceRoot 唯一事实源零硬编码 — checkable: `naming.ts` 删除、10 项导出逐项归位 + 转接面闭合后零引用（grep 零命中）；根 .gitignore 无 `.superpowers` 行；`pnpm run validate` 全绿 + precommit 面绿

- **Acceptance**:
  - `src/infra/workspace.ts` 含 `WorkspaceRoot`/`Workspace` 全导出、零裸函数；`.osuperpowers/.gitignore`（根级 `*`）自守卫——新 repo 首次 cdd 运行即存在；`lifecycle.json` 落 `<workspaceRoot>/<slug>/` 而非 repo 级（无 `.osuperpowers/cdd/lifecycle.json` 单文件；bin.ts:114 启动 repo 级绑定已删除、启动清扫改枚举形）；`naming.ts` 删除、10 项导出逐项归位 + 转接面（src 非测试 13 + 测试面）全部闭合后零引用（grep 零命中）；6 处散装 `mkdirSync` 归零（`Workspace.ensure()` 单点）；根 `.gitignore` 无 `.superpowers` 行；`pnpm run validate` 全绿（含 workspace 新 suite + lifecycle reap 枚举等价）+ precommit 面绿。


### Task 7: 崩溃恢复健壮性（HARNESS_ABORT + crash-only snapshot + stash 平面删除，用户拍板 2026-09-30）

- **Objective**: 崩溃恢复健壮性（HARNESS_ABORT + crash-only snapshot + crash record）：失败分类 + teardown + commitSnapshot + stash 平面删除

- **Produces**: failureCategories 增 `HARNESS_ABORT`（harnessAbortCount / harness-abort terminal）；teardown（孤儿处理：tail + snapshot + crash record + BLOCKED capsule）；`commitSnapshot()`（--no-verify 唯一正当理由注释）；crash record（crashPath(lane, round)）；NextStepRouter crash-record 行；stash 平面零残留

- **Files**: packages/cdd-engine/src/infra/proc.ts, packages/cdd-engine/src/rules/commit.ts, packages/cdd-engine/src/infra/workspace.ts, packages/cdd-engine/src/rules/next-step.ts, packages/cdd-engine/src/dispatch/base.ts, packages/cdd-engine/templates/engine-config.json, packages/cdd-engine/templates/schema/task-handoff-schema.json, packages/cdd-engine/templates/schema/docs-handoff-schema.json, packages/cdd-engine/src/infra/git.ts, packages/cdd-engine/src/artifacts/residue.ts, docs/maintainers/04-program-experience.md, packages/osuperpowers/skills/cli-driven-development/SKILL.md

- **Steps**:
  1. **失败分类**：`engine-config.json#failureCategories` 增 `HARNESS_ABORT`（counter harnessAbortCount · terminal BLOCKED: harness-abort-exhausted · countsTowardConvergence 逐类独立）；**teardown（孤儿处理，lane 无关）**：run wrapper 检测 child 非零退出 && handoff 未写 → ① 捕获 child stdout/stderr 尾部（~40 行）② crash-only snapshot ③ Workspace 落 crash record ④ 出 BLOCKED capsule（类别改判 HARNESS_ABORT） — checkable: `failureCategories` 含 HARNESS_ABORT；child 异常退出（无 handoff）→ tail 保留 + snapshot commit + crash record 落 crashPath(lane, round)（字段齐）+ BLOCKED capsule next 同命令 resume
  2. **crash-only snapshot**：`rules/commit.ts` 增 `commitSnapshot()`（`git add -A && git commit --no-verify`，消息 `chore(cdd-engine): crash-only snapshot — <lane> abort (exit <n>)`；树无变化 no-op；`--no-verify` 唯一正当理由 = 崩溃瞬间树可能语法半成品，快照是恢复点非验收面——理由落注释）；**crash record**：`Workspace.crashPath(lane, round)` 落 `{exitCode, stderrTail[], stdoutTail[], snapshotSha, attemptedHandoff, next}` — checkable: commitSnapshot（树干净 no-op / --no-verify 语义）；crash record 写盘（crashPath 两参钉定 round 化文件名）
  3. **next 路由**：NextStepRouter 决策表增行——`status ∈ {BLOCKED} + crashRecord 在场 → next: <同命令 resume>`（决策源必为 crash record 而非 carrier）；模糊失败保持无 next:；**stash 平面删除（死壳即删）**——apply 侧（dispatch/task.ts resumeFromResidue 块）+ 保留侧（dispatch/base.ts settleResidue + residue.ts preserveAndAnnounceResidue）+ infra/git.ts stashPush/Apply/Message + branch.ts stash 注释 + brief.ts resume-brief stash 分支 + 双 schema `recovery` 载体整体删除；**话术同步**：SKILL failure 面收一句「harness 异常退出 → crash-only snapshot + crash record；按 BLOCKED next: 原命令重跑即续作」 — checkable: next-step.test 钉 crash-record 新行；**stash 平面零残留**（`stash apply`/`stashApply`/`stashPush`/`stashMessage`/`recovery.residue_ref`/「git stash drop」/`stash_message`/`residue_scope`/`wip_stat`/`preserved` 零命中）；`pnpm run validate` 全绿 + precommit 面绿

- **Acceptance**:
  - `failureCategories` 含 `HARNESS_ABORT`（harnessAbortCount / harness-abort / `BLOCKED: harness-abort-exhausted`）；child 异常退出（无 handoff）→ child stdout/stderr 尾部保留 + crash-only snapshot commit + crash record 落 `Workspace.crashPath(lane, round)`（字段齐：exitCode/stderrTail/stdoutTail/snapshotSha/attemptedHandoff/next）+ BLOCKED capsule `status: BLOCKED · … · next: <同命令 resume>`；`NextStepRouter` 决策表含 crash-record 行（next-step.test 钉死）；**stash 平面零残留**——按命名面逐一闭合（apply 侧 / 保留侧 / camelCase 方法族 / 注释措辞 / JSON 属性键 / 教训条目 / 话术面，Do 枚举即边界），字面 grep（短语 / camelCase / JSON 键）降为兜底扫描而非边界：`stash apply` · `stashApply` · `stashPush` · `stashMessage` · `recovery.residue_ref` · 「git stash drop」 · `stash_message` · `residue_scope` · `wip_stat` · `preserved` 零命中（engine src/tests + templates/schema + skills + maintainers + CLAUDE.md）；`pnpm run validate` 全绿（含 channel-audit harnessAbortCount 计数）+ precommit 面绿。


### Task 8: 统一终止模型（fold A–D：exit gate 前终止全类覆盖 + crash record 三方统一 + cause + resume 软帽 + 类别/机制解耦，用户拍板 2026-09-30）

- **Objective**: 统一终止模型（fold A–D：exit gate 前终止全类覆盖 + crash record 三方统一 + cause + resume 软帽）

- **Produces**: teardown 谓词加宽 = 任意 exit gate 前终止（同一实现路径）；crash record `cause`（child-exit/child-signal/engine-over-budget/engine-timeout/unknown）；crash record 三方统一（teardown 写 / resume 读 / reapStale 枚举 stale records）；`recovery.residue_ref` 删除；resume 软帽 3 次 → crash-recovery-cap

- **Files**: packages/cdd-engine/src/infra/proc.ts, packages/cdd-engine/src/infra/workspace.ts, packages/cdd-engine/src/dispatch/task.ts, packages/cdd-engine/src/rules/failure.ts, packages/cdd-engine/src/rules/next-step.ts, packages/cdd-engine/src/artifacts/progress.ts, packages/cdd-engine/templates/engine-config.json

- **Steps**:
  1. **谓词加宽**：teardown 触发 = `dispatch 在 exit gate 前终止 且 handoff 未写`（engine 终止与 child 死亡**同一实现路径**）——终止点只有 handoff（正常面）/ crash record（异常面）双 artifact；**cause 字段**：crash record 增 `cause`（child-exit / child-signal / engine-over-budget / engine-timeout / unknown）postmortem 用、**行为零分叉** — checkable: teardown 触发谓词 = 任意 exit gate 前终止——over-budget/timeout 终止 → snapshot + crash record（含 cause）+ BLOCKED capsule next 同命令 resume，与 child-exit **同一实现路径**（teardown 矩阵测试钉死，非并行第二套）；cause 含字段且行为零分叉
  2. **A — crash record 三方统一**：resume 读 crash record（snapshot commit 为基线续作）；reapStale 枚举 stale crash records（复用 WorkspaceRoot.enumerate()）；`recovery.residue_ref` 持久化字段删除、`resume-pending` 由「crash record 在场」派生（progress/lifecycle 第二持久点灭绝）；**C — 类别/机制解耦**：failureCategories 保留身份面，终止后机制单路（TIMEOUT/EXECUTION_FAILURE 残余独立 recovery 机制归零） — checkable: crash record 三方统一；`recovery.residue_ref` / 旧独立 recovery 持久化面零残留（grep 零命中 + channel-audit 断言）
  3. **D — resume 软帽**：崩溃恢复按任务独立软上限 3 次 → `BLOCKED: crash-recovery-cap` 用户裁决（403/OOM/over-budget 非任务缺陷不计入类别 cap）；逐任务恢复计数落 progress/lifecycle 持久化；**话术/测试**：SKILL failure 面一句话已覆盖全类；测试 = teardown 矩阵（四类终止模拟 → 同路 snapshot + crash record（cause）+ next 同命令 resume）+ resume 软帽打到 cap + reapStale 枚举清理 + resume-pending 派生断言 — checkable: resume 软帽 3 次 → `BLOCKED: crash-recovery-cap`（类别 cap 面不动）；teardown 矩阵测试全绿；`pnpm run validate` 全绿（含渠道审计）+ precommit 面绿

- **Acceptance**:
  - teardown 触发谓词 = **任意 exit gate 前终止**（非 child-exit 独占）——over-budget/timeout 终止 → snapshot + crash record（含 `cause`）+ BLOCKED capsule `next:` 同命令 resume，与 child-exit **同一实现路径**（teardown 矩阵测试钉死，非并行第二套）；crash record 含 `cause` 字段且行为零分叉；crash record 三方统一（teardown 写 / resume 读 / reapStale 枚举 stale records）；`recovery.residue_ref` / 旧独立 recovery 持久化面零残留（grep 零命中 + channel-audit 断言）；resume 软帽 3 次 → `BLOCKED: crash-recovery-cap`（FailureResolver 类别 cap 面不动）；`pnpm run validate` 全绿（含渠道审计）+ precommit 面绿。


### Task 9: 预算维度统一（op 维度抽象：timeouts.defaults {implement/review/fix} + 三岛按 op 接线 + DispatchOp union + 接线层测试，用户拍板 2026-09-30）

- **Objective**: 预算维度统一（op 维度抽象：timeouts.defaults {implement/review/fix} + 三岛按 op 接线 + DispatchOp union）

- **Produces**: `timeouts.defaults` `{task, review}` → `{implement: 21600000, review: 10800000, fix: 21600000}`（删 task key）；三岛 spawn 按实际 op 传参（task.ts/docs.ts/branch.ts 删硬编码）；`DispatchOp` union + `DEFAULT_TIMEOUTS` 类型化；三岛接线断言（7 op 组合）

- **Files**: packages/cdd-engine/templates/engine-config.json, packages/cdd-engine/src/dispatch/task.ts, packages/cdd-engine/src/dispatch/docs.ts, packages/cdd-engine/src/dispatch/branch.ts, packages/cdd-engine/src/infra/invoke.ts

- **Steps**:
  1. **config**：`timeouts.defaults` `{task, review}` → `{implement: 21600000, review: 10800000, fix: 21600000}`——删 `task` key（零消费者面，破坏性删除安全）；fix 与 implement 同额（用户拍板）；数值语义 = implement 6h / review 3h / fix 6h — checkable: `timeouts.defaults` 恰 `{implement, review, fix}` 且**无 `task` key**（config 读断言 + grep 兜底）
  2. **三岛接线**：spawn 点按实际 op 传参——task.ts `resolveTerminationConfig(mode, …)`（mode ∈ implement|review|fix，删 `"task"` 硬编码——修复 `review --type task` 错读实施预算 bug）；docs.ts 删 `"review"` 硬编码；branch.ts branch-fix → `"fix"`（branch-review 保持 "review"） — checkable: `cdd review --type task` 预算 = review 默认 3h（接线断言钉死，T7 事故根因）；branch-fix = fix 默认 6h；三岛接线断言全绿（7 个 op 组合——spawn 传出 budget = 对应 op 默认值）
  3. **类型化**：`DispatchOp` union（`"implement" | "review" | "fix"`）+ `DEFAULT_TIMEOUTS: Record<DispatchOp, number | undefined>`——传错 op 编译期即报；unknown→undefined 防御语义保留；**测试**：resolver 单测 `"task"` 断言 → `"implement"` + fix 断言 + unknown 防御面降级 config 缺 key；**注释同步**：invoke.ts/docs.ts 描述改 op 维度 — checkable: resolver 单测迁完（`"task"` budget 断言零残留）；`DEFAULT_TIMEOUTS` 类型面 union 化；`pnpm run validate` 全绿（含 channel-audit）+ precommit 面绿

- **Acceptance**:
  - `timeouts.defaults` 恰 `{implement: 21600000, review: 10800000, fix: 21600000}` 且**无 `task` key**（config 读断言 + grep 兜底）；`cdd review --type task` 预算 = review 默认 3h（接线断言钉死，T7 事故根因即此）· branch-fix = fix 默认 6h；三岛接线断言全绿（7 个 op 组合——spawn 传出 budget = 对应 op 默认值）；resolver 单测迁完（`"task"` budget 断言零残留）；`DEFAULT_TIMEOUTS` 类型面 union 化；`pnpm run validate` 全绿（含 channel-audit）+ precommit 面绿。
