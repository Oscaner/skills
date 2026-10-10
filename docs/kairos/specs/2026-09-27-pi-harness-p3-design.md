# Pi Harness P3 — engine 数据面（Pi Harness P3: Engine Data Plane）— Phase Spec

- **Version**: v1.6 · 2026-09-30
- **Status**: Draft
- **Author**: [human] · Claude Opus 5 (1M context) (osuperpowers:brainstorming → writing-phase-spec)
- **Parent program**: [2026-09-27-pi-harness-overall.md v1.17](2026-09-27-pi-harness-overall.md)
- **Depends on**: P1（shipped · [p1-design v1.5](2026-09-27-pi-harness-p1-design.md)）；P2（shipped · 契约面定案——`{claude, cursor, pi}` 三元组行键集）

## Design
### 2. engine 数据面 · 命令契约面设计
#### 2.1 目标与范围

P3 把 engine 数据面收敛到与 P2 已定的分发契约同构：`harness-registry.json` 行键 `cursor-agent`→`cursor`（追平三元组 `{claude, cursor, pi}`），`detectCurrentHarness` 硬编码 if 链改 **OOP 多态**（Harness 抽象 + 子类 `detect(env)` 谓词 + 注册序 first-match），新增 `pi` 行（`cli` 二进制 `pi` · ship full · invoke `-p --mode text` · cache 未实测态）；并借 P3 破坏性授权（用户拍板 2026-09-29）扩展到**命令契约面**——implement/review/fix 语义双轴分离、单胶囊 stdout 面、Contract Lexicon 机制、消费面措辞同步、运维文档/CLAUDE.md 同步。范围外：engine 记录/artifacts 数据面（空壳废除声明，见 C4）、emit 分发注册表（Non-goal 分层）、README 家族收口与 osuperpowers tests 残留面（`tests/helpers.mjs:16` / `tests/presentation-surface.test.mjs:274`）零化（P4 文档·测试·收口——P3 守卫扫面不含此二面，见 G2/C3）。

锚点图例：D = 命令契约面定案锚、L = 契约词表/措辞锚、O = OOP 决定、G = 守卫决定、R = 实证/声明决定；锚点仅供本 spec 内部溯源（D/L 系为本 spec 定案面，与 parent overall 的 D 编号非同号异义——引用 overall 锚点一律带「overall」前缀限定）：

| 锚点 | 定案内容 |
|---|---|
| O1 | Harness OOP 抽象（grilling Q1 路线，用户拍板 A 方案）：`Harness` 抽象类 + `ClaudeHarness`/`CursorHarness`/`PiHarness` 子类 `detect(env)` 谓词多态；`detectCurrentHarness` 实现改注册序遍历 first-match；`harness-registry.json` 仍是发布资源 + 校验锚 |
| O2 | pi 行定稿（grilling Q1/Q2，pi CLI 本机实证）：`cli` `pi` · invoke `-p --mode text`（pi 无 `--force`/`--output-format`）· ship full · prefix/suffix 镜像 claude/cursor · cache = auto-prefix/pending/observable false（克隆 cursor 未实测态） |
| O3 | 注册序 = 优先级（grilling Q3）：`[cursor, claude, pi]`——SPECIFIC marker 先于 GENERIC env marker，与现状 if 链语义（CURSOR_TRACE_ID 先判）一致 |
| G1 | name-set 断言（grilling Q3）：registry 迭代测试断言行键**恰**为 `{claude, cursor, pi}`（anti-white-green，防未来再引入非归一标识符） |
| G2 | live 面 last-index 守卫（grilling R3 + 用户零豁免拍板）：**P3 扫面 = engine src/tests + scripts + docs/maintainers 三面**（P3 可归零面），扫 `cursor-agent` 即 fail；唯一允许命中 = registry `cli` 数据值（白名单单点，非豁免清单——命中点随 registry 数据走）；守卫面内合法点名二进制 `cursor-agent` 一律改写措辞（行键 `cursor` / 抽象措辞），字面残留恰 registry `cli` 字段一枚；README 家族 + osuperpowers tests 残留面零化与纳入守卫随 P4 文档·测试·收口激活（见 §4） |
| R1 | `cdd` 记录/h·id 显示值 = **空壳**（实证）：artifacts/progress.ts、round-context.ts、return-block.ts、result-face.ts 零 harness 字段；真显示面 = observe-cache 日头（行键直出）+ issue 渲染 Host 行（宿主自报名）——scope 项改声明，见 C4 |
| D1 | 命令契约双轴（用户拍板）：review 判定轴（CHANGES_REQUESTED/REVIEW_FIX/APPROVED 引擎推导）独占；implement/fix 工作轮统一 `COMPLETED`——不再打印 `APPROVED` 冒充判定 |
| D2 | `blocker:` 全族保留、语义 = 判定源计数：review = 自身 findings；fix = 源 review findings（消除 fix 自报空数组恒 0）；implement 无判定源（无 findings 输入）→ `blocker: 0`——task 族 M3 退役列恢复同义 |
| D3 | stdout 面全 op 单胶囊：`status · blocker · handoff` + `next:`；commits/artifacts/counters 收进 handoff，stdout 不再 restate 引擎形状 |
| L1 | 契约措辞单源：orchestrator skills 只锚路由 token（`next:`/`CDD_BLOCKED:`/handoff `findings`），零引擎形状 restate（`3-line return block` 类字面量清零，见 C7） |
| L2 | Contract Lexicon 机制（用户拍板）：`contract-lexicon.json` 单词表（harness/status/stdout/residue/anatomy 五域）+ `ContractLexiconGuard` OOP 守卫（checkAnatomy/checkResidue/checkWording/checkConfig）+ validate 单 block——三先例 + contract-wording 收敛（见 C6） |

**C1 Harness OOP 抽象（O1/O3）** — 新模块 `packages/cdd-engine/src/infra/harness.ts`：
- `abstract class Harness`：`id`（row key）· 类型化行访问（cli/invoke/output/ship/cache/prefix/suffix 契约自持）· `abstract detect(env: NodeJS.ProcessEnv): boolean`
- 子类（谓词多态）：
  - `CursorHarness.detect(env)` = `Boolean(env.CURSOR_TRACE_ID)`（SPECIFIC，最高优先）
  - `ClaudeHarness.detect(env)` = `Boolean(env.CLAUDE_CODE_SESSION_ID) || (env.AI_AGENT ?? "").startsWith("claude-code")`
  - `PiHarness.detect(env)` = `env.AI_AGENT === "pi"`（`PI_CODING_AGENT=true` 佐证，overall D4 宿主检测事实；GENERIC 通道，末位）
- 注册序常量（O3）：`[Cursor, Claude, Pi]`——first-match 即胜，SPECIFIC 先于 GENERIC，与旧 if 链行为等价（旧序 CURSOR_TRACE_ID → session → AI_AGENT；pi 接 GENERIC 末位）
- `detectCurrentHarness(env)`（shared.ts 签名不变，residue `detectCurrentHarness(process.env)` 直读锚点保持）实现改为：遍历注册序实例调 `detect`，命中返回 `instance.id`，全空返回 `""`；`requireHostHarness` 不变
- `Registry` 类（infra/registry.ts）不动为数据门面；新增的 OOP 层单向消费它（`harness.ts` → 读行 → 实例化），无反向 import

**C2 registry 行 rename + pi 行（O2）** — `packages/cdd-engine/src/infra/harness-registry.json`：
- 行键 `cursor-agent` → `cursor`（`cli` 值保持 `"cursor-agent"`——二进制名外部事实，唯一数据暴露点）
- 新增 `pi` 行：`cli: "pi"` · `invoke: "-p --mode text"`（本机 `pi --help` 实证：非交互 `-p` + `--mode text`，无 `--force`/`--output-format` 等价物）· `output: "text"` · `ship: "full"` · prefix（implement/review/fix 镜像 claude/cursor）· `suffix: {}` · `cache: {mechanism: "auto-prefix", minTokens: "pending", observable: false}`（克隆 cursor 未实测态——不虚报缓存特性，等实测填乘数）
- 行键集合 = `{claude, cursor, pi}`（G1 断言目标）；`additionalProperties` 约束不影响行级新增字段（cache 子对象 schema 已含 `required [mechanism, minTokens]`）
- 受影响代码面同步：`scripts/observe-cache.ts`（`--harness claude|cursor` 描述 + default claude + 日头行键）· `host-detection` 相关注释（shared.ts:24 / cdd.test.ts:190 等）

**C3 守卫与测试接线（G1/G2）**：
- `registry.test.ts` / `infra.registry.test.ts`：行键断言 `["cursor-agent",...]` → **恰 `{claude, cursor, pi}`**（G1，正向 + 无杂键反向）
- `registry.cache.test.ts`：cursor 行 profile 用例 + pi 行 pending profile 用例；全行迭代 schema 校验自动纳入 pi（零硬编码）
- `invoke.dispatch-set.test.ts`：`reg["cursor-agent"]` → `reg["cursor"]`
- `host-detection.test.ts`：表驱动重写——cursor（CURSOR_TRACE_ID）· claude session（CLAUDE_CODE_SESSION_ID）· claude AI_AGENT（`claude-code*` 前缀）· pi（`AI_AGENT=pi`）· unknown（`AI_AGENT=codex` → `""`）· **优先级矩阵**（CURSOR_TRACE_ID + AI_AGENT=pi → cursor；CLAUDE_CODE_SESSION_ID + AI_AGENT=pi → claude；全空 → `""`）——三位宿主 origin 全测（P3 验收）
- `scripts/validate/residue.ts`：新增 **live 面 last-index 守卫**（G2）——扫描 **engine src（含测试）+ scripts + docs/maintainers 三面**（P3 可归零面），`cursor-agent` 命中即 fail；唯一允许 = `harness-registry.json` 行 `cli` 字段值（白名单单点，非豁免清单——命中点随 registry 数据走）；守卫面内合法点名二进制 `cursor-agent` 的测试/注释/文档措辞一律改写（经行键 `cursor` 或抽象措辞），字面残留恰 registry `cli` 字段一枚——三面残留已全部映射（engine src/tests 由 C1/C2/C3 清零，`scripts/observe-cache.ts` + `__tests__/observe-cache.test.ts` 由 C2 清零，`docs/maintainers/03-context-caching-doctrine.md:48` 由文档验收行清零）；**smoke-cdd 无 `cursor-agent` pin、无需改动**（守卫经 validate 的 residue block 生效，smoke-cdd 独立块仅 dist registry 运行时解析）；README 家族（`packages/osuperpowers/README.md:72` / `README.zh-CN.md:74` 行键格）与 osuperpowers tests 残留面（`tests/helpers.mjs:16` / `tests/presentation-surface.test.mjs:274`）零化随 P4 激活（届时扩展扫面纳入）
- `scripts/validate/__tests__/residue.test.ts`：为 G2 守卫新增回归用例（与既有收集器 `targetsOverride` 注入模式一致）——(a) 白名单单点放行（registry `cli` 数据值所在行/文件即绿）、(b) 三守卫面任一 `cursor-agent` 命中即 fail、（c）白名单随 registry 数据变化（anti-white-green：registry `cli` 值改为他值后守卫放行新值、旧值命中即 fail——与 G1 对齐）
- host-marker 白名单恰 4 键断言不动（`infra.context.test.ts` / `context.test.ts`）——pi 零新 env 键

**C4 空壳声明 + 坐标系分层（R1）**：
- **记录面空壳**：`artifacts/*` 与 `cli/result-face` 零 harness 字段（实证）——原 scope 项「`cdd` 记录与 `h`/`id` 显示值归一」无作业面，回填为事实声明（overall v1.12 已删）
- **显示面坐标系分层**：issue 渲染 `- Harness: <harness>` 行（`templates/report/issue-body.json:202`）数据源 = `report-issues/SKILL.md:34` 宿主**自报名**（如 `claude-code`），与 registry 行键**非同一坐标系**——P3 声明此分层（引擎行键 ≠ 宿主自报名），不改写 Host 行；P4 名义映射表承载渲染
- **observe-cache 日头**（`observe-cache.ts:235` 打印 `observe-cache: ${harness} · …`）是唯一"行键直出"显示面——随 C2 rename 自然归一，零额外作业

**C5 命令契约面统一（D1–D3，用户拍板 + OOP 形态）** — engine 命令契约面重构，收编三处裸函数为三个 OOP 组件：
- `StatusDeriver`（新类，收编 finalize.ts 推导 + return-block 折叠）：`deriveReviewStatus(findings)` → 判定轴（CHANGES_REQUESTED / REVIEW_FIX / APPROVED）· `workStatus(declared)` → 工作轮轴（COMPLETED / BLOCKED，收编 implementStatusFromReturnLine 的 APPROVED|BLOCKED 折叠）
- `NextStepRouter`（新类，收编 next-step.ts `nextStepFor`）：C5 决策表原样迁为 instance method `next(input)`——模块级单例 `convergence`（src/rules/next-step.ts:34，ConvergenceChecker 实例）收敛为构造注入，零裸函数、零模块级可变状态
- `ResultFace`（新类——全 op 单一 stdout 面，替换 result-face.ts `docsResultFace` + task 族 4 行块）：`emit(op, ctx)` → `status: {…} · blocker: {n} · handoff: {path}` + `next: {…}`；组成 = 构造注入 `#statusDeriver` / `#nextRouter` / `#convergence`；review → 判定轴 + 自身 findings blocker；implement → 工作轮 COMPLETED + `blocker: 0`（无判定源）；fix → 工作轮 + 判定源计数（= `--findings` 输入 review 的 blocker 数）
- 方案 D3 收紧：commits/artifacts/counters 收进 handoff（stdout 只留状态胶囊）——engine stdout 形状变化经 L1 同步到 orchestrator skills（见 C7）
- 测试：`result-face.test.ts`（新，钉死单胶囊 shape）· `next-step.test.ts` 迁移为 instance-method 断言 · 现有调脸 `cli/review.ts`/`cli/fix.ts`/`dispatch/*` 消费点同步

**C6 Contract Lexicon 机制（L2，用户拍板）** — 三先例统一为「单词表 + 单守卫」：
- `contract-lexicon.json`（新，`packages/cdd-engine/templates/` 或 `src/infra/`——与 `harness-registry` 同源同期发布）：五域单词表——`harness`（ids/clis，随 C2 rename 后={claude,cursor,pi}）· `status`（vocab + 双轴映射，随 C5）· `stdout`（胶囊 shape + `CDD_BLOCKED:` 通道 + handoff `findings`/`next:` 锚 token）· `residue`（禁令表：`cursor-agent` → 唯一允许 registry `cli` 数据值，随 G2）· `anatomy`（skill-anatomy 的 heading/edge/node registry，随先例 1）
- `ContractLexiconGuard`（新类，`scripts/lib/contract-lexicon.ts`——emit 与 validate 双侧消费，同 P2 `HarnessRegistry` 先例）：`checkAnatomy(skills)`（digraph-consistency 断言迁入）· `checkResidue(targets)`（residue 收集器迁入，含 `targetsOverride` 注入模式）· `checkWording(skills)`（C7 措辞守卫）· `checkConfig(engineConfig)`（engine-config channel audit 迁入）——Criterion ② 零裸函数
- validate 单 block 接线：四独立 test 入口（digraph-consistency / residue.test / context.test / 新 contract-wording）收敛为 `ContractLexiconGuard` 一次驱动
- 成本与拆解：跨 engine + scripts 两面，作为 P3 契约面内实施（可拆分：先落 `contract-lexicon.json` + `checkWording`，再迁三先例入 guard）

**C7 消费面措辞同步 + 运维文档/CLAUDE.md（L1，用户拍板交付）**：
- `cli-driven-development/SKILL.md:59`（implement-group Read 钉死 `3-line return block` + `4th line counters` 形状）→ 删形状 restate，改锚路由 token（`next:` / `CDD_BLOCKED:` / handoff `findings`）；`SKILL.md:66`（review Read 语义确认，status 判定轴不变）复核
- 其余 orchestrator skills（writing-* trio / brainstorming / finishing / report-issues）零引擎形状 restate（盘点已证），复核即可
- **docs/maintainers 同步**：01-template-doctrine（harness-registry 行键镜像 cursor + pi）· 02-naming-conventions（契约措辞指针）· 03-context-caching-doctrine（Baseline entries 随 C2）· 04-program-experience（Contract Lexicon 机制记录）——行键镜像零 cursor-agent（G2 验收）
- **根 CLAUDE.md 同步**：`pnpm run emit`/validate 描述随 Contract Lexicon 单 block 更新；engine 调用面（dev:stub / cdd CLI）契约措辞随 C5 单胶囊更新；commit/validate 流程描述不因本 phase 变更

#### 2.2 崩溃恢复健壮性（crash recovery — 用户拍板追加 T7）

事故复盘（P3 T6 implement，上游模型 403 杀死内层 agent → `cli exited 1 and handoff missing`）暴露五缺陷：
① 无报错保留（child 403 trace 丢失）② resume 流程绕（stash-residue 恢复误命中 P4.4 过期 stash，apply
冲突把 ~70 文件抹成未合并态）③ BLOCKED 输出无 `next:` ④ 建议 discard（token 浪费）⑤ stash 混乱编排器
决策。设计主线（允许破坏性/重写/重组/死壳即删）：**崩溃恢复从「stash 状态魔法」归一为「commit 确定性
事实」——child 异常退出时 engine 就地落一个 ref-keyed 工作区 artifact（crash snapshot commit + crash
record），恢复 = 同命令重跑即续作**。

- **失败分类**：`templates/engine-config.json#failureCategories` 增 `HARNESS_ABORT`（`counter:
  harnessAbortCount` · `returnMarker: harness-abort` · `terminal: BLOCKED: harness-abort-exhausted`）—
  —与 `EXECUTION_FAILURE` 区分：成因外部（harness/模型 403）、可确定性恢复；每类计数独立，一类终态
  不泄漏进另一类（channel-audit 语义沿用）；`rules/failure.ts` FailureResolver 机械读取（类目声明
  单源）
- **teardown（孤儿处理，lane 无关）**：run wrapper（implement/review/fix/docs 四 lane 共用一条）检测
  child 非零退出 && handoff 未写 → ① 捕获 child stdout/stderr **尾部**（~40 行，缓解「403 不明不白」）
  ② crash-only commit ③ Workspace 落 crash record ④ 出 BLOCKED capsule（类别改判 `HARNESS_ABORT`）
- **crash-only snapshot**：`rules/commit.ts` 增 `commitSnapshot`（`git add -A && git commit --no-verify`，
  消息 `chore(cdd-engine): crash-only snapshot — <lane> abort (exit <n>)`；树无变化则 no-op）——复用
  现有 git 管线，**一个 commit 动词、两处调用**（exit gate + crash teardown）。`--no-verify` = 唯一
  「看似破纪律、实为必要」例外：崩溃瞬间树可能语法半成品，pre-commit 的 biome 会拒收——快照是恢复点
  非验收面，质量门禁在 resume 后的 exit gate + review + merge；理由落文档
- **crash record 落 Workspace 域**：`Workspace.crashPath(lane)` 子路径（`.osuperpowers/cdd/<slug>/crash-
  <lane>-<round>.json`）经现有 `writeJson` 落盘：`{exitCode, stderrTail[], stdoutTail[], snapshotSha,
  attemptedHandoff, next}`——与 lifecycle/handoff/base-branch 同族同级（T6 统一落盘面直接吃掉它）
- **next 路由**：`NextStepRouter` 决策表增一行——`status ∈ {BLOCKED} + crashRecord 在场 → next: <同命令
  resume>`（Inputs 增 `recovery?` 面：snapshotSha + resumeCommand）；原则守着、例外开窗：模糊失败（无
  crash record）仍无 `next:`，可确定性恢复的失败必有 `next:`；C5-1 决策表注释 + `next-step.test.ts` 同步
- **stash 平面删除（死壳即删）**：boot apply 路径（dispatch/base.ts）、`recovery.residue_ref` persist、
  `artifacts/residue.ts` 的 stash 部分、SKILL 「resume or discard / git stash drop」措辞、相关测试全清——
  恢复原语归一 commit ledger，编排器零分支记忆
- **话术同步**：SKILL failure 面一句定型——「harness 异常退出 → 工作区存 crash-only snapshot + crash
  record；按 BLOCKED `next:` 原命令重跑即续作（不重做、不丢残骸）」；docs/maintainers + 根 CLAUDE.md
  failure-mode 表同步
- **收敛法自洽**：快照 commit 移动 BASE..HEAD ref → re-review 新 ref = 新 review（I3），快照零特权

#### 2.3 统一终止模型（fold A–D — 用户拍板追加 T8）

§2.2 窄谓词（child 非零退出 && handoff 未写）收住 child-exit/child-signal；高维复盘折叠把模型升为**对偶全量**（§2.2 为地基，本节约为层加宽；允许破坏性/重写/重组/死壳即删）：

- **对偶核心**：任何 dispatch 恰好终止于一个持久 artifact——exit gate 通过 = **handoff**（正常面），exit gate 前终止 = **crash record**（异常面）；两份 ref-keyed、落 Workspace 状态族、被同一组生命周期面读取；恢复原语两侧同构：**终止瞬间的工作树（已提交/已快照）即状态**，engine 零进程内记忆
- **A — crash record 三方统一**：teardown（写）/ resume（读：snapshot commit 为基线续作）/ reapStale（枚举 stale crash record，复用 `WorkspaceRoot.enumerate()`——孤儿语义从 stash 考古变 artifact 枚举）；`recovery.residue_ref` 持久化字段**删除**，`resume-pending` 由「crash record 在场」派生（第二持久点灭绝）
- **B — 恢复原语归一**（T7 已有，此处全覆盖）：exit gate commit 与 crash snapshot 是同一个 commit 动词的两个调用点；over-budget/timeout 的旧 stash 路随 T7 stash 平面删除而灭、迁入统一 teardown——**零空窗论证**：T7 通用谓词（child 终止 && 无 handoff）天然兜住 engine 终止（terminated child = 非零退出 + 无 handoff），T8 仅正式化 cause 归类
- **C — 类别身份/机制解耦**：`failureCategories` 保留为**身份面**（counter / terminal / channel-audit 逐类独立、一类终态不泄漏进另一类——已承诺不变量不动）；**终止后的机制不再按类分叉**——无论 cause，runner 终止后单路（snapshot + record + resume）；TIMEOUT / EXECUTION_FAILURE 各自残余的独立 recovery 机制归零
- **D — resume 软帽**：崩溃恢复按任务独立软上限（3 次 resume → `BLOCKED: crash-recovery-cap` 用户裁决，对齐 branch-fix I9 软帽哲学）；403 / OOM / over-budget **非任务缺陷**，不计入 FailureResolver 类别 cap（类别计数面不因外部事故冤枉任务——极重要：否则预算/上游事故耗尽重试 = 任务被冤枉终态）
- **cause 字段**：crash record 增 `cause`：`child-exit` / `child-signal` / `engine-over-budget` / `engine-timeout` / `unknown`——postmortem 专用、**行为零分叉**（resume 不因 cause 不同路）
- **边界自检**：engine 自身 liveness（engine 进程内内存泄漏面）属 liveness monitor 另轨，本模型只管 **child 终止面**；`dispatchIncomplete`（CONTRACT_VIOLATION / ENGINE_SELF_WRITTEN：部分 handoff = 合同违约面）语义保留，不并入终止面

#### 2.4 预算维度统一（op 维度抽象 — 用户拍板追加 T9）

§2.3 把终止面收为对偶 artifact；预算（wall-clock hard cap，`timeouts.defaults`）是 termination 的触发源之一（cause `engine-over-budget`）。预算配置对象当前挂在**岛名**上（`{task, review}`）——task island 一个 call site 承载 implement/review/fix 三 op、`resolveTerminationConfig("task")` 硬编码 → `review --type task` **错读实施预算**（T7 task review 已 2h 未被 review 1h 掐掉即为该错读的直接后果）；branch-fix 同样错读 `"review"`。预算本质是 **op 维度**（工作轮资源上限），岛/type 是平行通道、与资源需求无关（同一轮 review 花在 task 或 branch 上预算应同）：

- **op 三 key**：`timeouts.defaults` → `{implement: 21600000 (6h), review: 10800000 (3h), fix: 21600000 (6h)}`——删 `task` key（config 是 engine 自养 canonical、零消费者面，破坏性删除安全）；fix 与 implement 同额（用户拍板）
- **接线按实际 op**：三岛 spawn 点传各自实际 op——task.ts / docs.ts 传已有的 `mode`（「mode 即 op」已是三岛既有模态：task.ts `INVOKE_PARAMS[mode] ?? { op: mode }`、docs.ts `{ op: mode }`），branch.ts branch-fix `"review"`→`"fix"`；修复后 review 轮在 op 维度下**永远**读 review 预算——错位从「可能发生」变「不可能发生」（改坐标系而非打补丁）
- **类型化**：`DispatchOp = "implement" | "review" | "fix"` union + `DEFAULT_TIMEOUTS: Record<DispatchOp, number | undefined>`——传错 op 编译期即报；`unknown → undefined` 防御从「调用方传错」降级为「config 缺 key」（T14 零 env 键面不变）
- **接线层测试**（本次逃逸根源：现有测试只测 resolver `mode→budget`、不测岛→resolver 传参）：三岛各一断言——dispatch 在自身 op 下 spawn 传出的 `terminationCfg.budgetMs` = 该 op 默认值（task.implement 6h / task.review 3h / task.fix 6h / branch.review 3h / branch.fix 6h / docs.review 3h / docs.fix 6h）

### Acceptance criteria

- `harness-registry.json` 行键集合断言恰 `{claude, cursor, pi}`（registry / infra.registry 测试 name-set，G1）
- `detectCurrentHarness` 表驱动测试全绿：cursor/claude-session/claude-AI_AGENT/pi/unknown + 优先级矩阵（CURSOR_TRACE_ID > CLAUDE_CODE_SESSION_ID > AI_AGENT；pi = GENERIC 末位）
- pi 行 `invoke` = `"-p --mode text"`，cache = `{mechanism: "auto-prefix", minTokens: "pending", observable: false}`，过全行迭代 schema 校验（registry.cache.test）
- residue live 面守卫：engine src/tests + scripts + docs/maintainers 三面扫描 `cursor-agent` 零命中（唯一允许 = registry `cli` 数据值），validate 全绿——README 家族与 osuperpowers tests 残留面（`packages/osuperpowers/README.md:72` / `README.zh-CN.md:74` · `tests/helpers.mjs:16` · `tests/presentation-surface.test.mjs:274`）零化及纳入守卫随 P4 激活，P3 不承诺此二面归零
- `scripts/observe-cache.ts` + 测试使用 `cursor` 行键（零 `cursor-agent`）
- docs/maintainers 引擎 registry 行键镜像（`03-context-caching-doctrine.md` Baseline entries）改行键 `cursor` + pi 行，零 `cursor-agent`
- host-marker 白名单恰 4 键断言不变（`AI_AGENT`/`CLAUDE_CODE_SESSION_ID`/`CURSOR_TRACE_ID`/`PATH`）
- engine 测试套件（cdd-engine `pnpm test`）全绿，无回归
- **命令契约测试全绿**：`StatusDeriver` 判定轴/工作轮推导（review 三态 + implement/fix `COMPLETED`）· `NextStepRouter` C5 决策表 instance-method 等价（next-step.test 迁移后全绿）· `ResultFace` 单胶囊 shape 钉死（result-face.test.ts）——review 输出判定轴 + 自身 findings blocker；implement 输出工作轮 COMPLETED + `blocker: 0`（无判定源）；fix 输出工作轮 + 源-review blocker 计数；task/docs 两族同形
- **Contract Lexicon 守卫全绿**：`contract-lexicon.json` 五域词表存在且与引擎事实一致（单词表 = 单一事实源）· `ContractLexiconGuard` 四检查（checkAnatomy/checkResidue/checkWording/checkConfig）在 validate 单 block 下全绿 · 三先例 test 入口收敛后无回归（digraph-consistency/residue.test/context.test 断言经 guard 同源通过）
- **消费面措辞同步**：`cli-driven-development/SKILL.md` 零引擎形状 restate（`3-line return block` / `4th line counters` 类字面量清零），仅锚路由 token（`next:`/`CDD_BLOCKED:`/handoff `findings`）；`contract-wording` 检查零命中
- **运维文档 + CLAUDE.md 同步落地**：docs/maintainers 全家族（01/02/03/04）与契约面/词表一致、行键镜像零 cursor-agent · 根 CLAUDE.md emit/validate 描述随 Contract Lexicon 单 block 与 C5 单胶囊更新 · `pnpm run emit` + `emit:check` 零漂移（skill 文本变化后重新 emit）
- **T7 崩溃恢复全绿**：failureCategories 含 `HARNESS_ABORT`（harnessAbortCount / harness-abort terminal）· NextStepRouter 决策表含 recovery 行（BLOCKED + crashRecord → 同命令 resume `next:`，next-step.test 钉死）· teardown 集成测试（模拟 child exit 1 无 handoff → child tail 保留 + crash-only snapshot + crash record 落 `Workspace.crashPath` + BLOCKED capsule 带 next:）· commitSnapshot 行为测试（树干净 no-op / `--no-verify` 语义）· **stash 平面零残留**（grep `stash apply`/`recovery.residue_ref`/「git stash drop」零命中，含 SKILL/maintainers/CLAUDE.md 措辞）· `pnpm run validate` 全绿 + precommit 面绿
- **T8 统一终止模型全绿**：teardown 触发谓词 = **任意 exit gate 前终止**——over-budget/timeout 与 child-exit/child-signal **同一实现路径**（teardown 矩阵测试：四类终止模拟 → 同路 snapshot + crash record（含 `cause`）+ BLOCKED capsule next 同命令 resume，非并行第二套）· crash record 含 `cause`（child-exit/child-signal/engine-over-budget/engine-timeout/unknown）且行为零分叉 · crash record 三方统一（teardown 写 / resume 读 / reapStale 枚举 stale crash records，`WorkspaceRoot.enumerate()` 复用）· `recovery.residue_ref` / 旧独立 recovery 持久化面零残留（grep 零命中 + channel-audit 计数断言）· resume 软帽：3 次 → `BLOCKED: crash-recovery-cap` 用户裁决，FailureResolver 类别 cap 面不动 · `pnpm run validate` 全绿 + precommit 面绿
- **T9 预算维度统一全绿**：`timeouts.defaults` = `{implement: 21600000, review: 10800000, fix: 21600000}` 且**无 `task` key**（config 读断言 + grep 兜底）· 三岛接线断言全绿（7 op 组合 spawn 传出 budget = 对应 op 默认值——task.implement 6h / task.review 3h / task.fix 6h / branch.review 3h / branch.fix 6h / docs.review 3h / docs.fix 6h）· resolver 单测迁完（`"task"` budget 断言零残留）· `DispatchOp` union 编译期禁 `"unknown"`（unknown 防御语义保留为 config 缺 key fail-safe）· `pnpm run validate` 全绿 + precommit 面绿

## Constraints

- 跨 phase 约定以 parent overall v1.13 为准（overall wins on conflict），本 phase 不重复表述，仅指针：
- **P3 破坏性变更授权（2026-09-29，Constraints 登记）**：engine 数据面可重写代码 / 重整文件——约束 = 高维思考 / 抽象统一（OOP）/ 最佳实践 / 零技术债务
- **命令契约面授权（2026-09-29，v1.13 Constraints 登记）**：implement/review/fix 语义双轴分离（判定轴 review 独占 / 工作轮 implement·fix 打 `COMPLETED`）· `blocker:` 判定源计数 · 全 op 单胶囊 stdout 面 · Contract Lexicon 机制（contract-lexicon.json 单词表 + `ContractLexiconGuard` OOP 守卫）· 消费面（orchestrator skills）零引擎形状 restate · 运维文档 + CLAUDE.md 同步交付
- **豁免概念废除**：守卫扫 live 面（engine src/tests + scripts + docs/maintainers + README 家族 + osuperpowers tests）零 `cursor-agent`，唯一允许命中 = registry `cli` 数据值；历史正文（2026-09-13 family / change-history 行）即史实，不 retro-rename、无豁免机制。**P3 分期实施**：守卫扫面率先落三面（engine src/tests + scripts + docs/maintainers，本 phase 可归零面），README 家族与 osuperpowers tests 随 P4 文档统一验收纳入——program 终态五面归零定律不破（见 G2/C3/§4）
- **CLI 二进制名不可改**（外部事实）：`cli` 字段保留 `claude` / `cursor-agent` / `pi`；名义映射表（标识符 ↔ 二进制 ↔ 宿主 marker）P4 落 README 渲染
- **Non-goal：注册表分层不破**——本 phase 的 engine registry（spawn 契约面）与 emit 分发注册表 `scripts/lib/harness-registry.ts`（分发 manifest 面）不合并（P2 定案延续）
- **host-marker 白名单恰 4 键不变**：`channels.env.hostHarness.markers` = `["AI_AGENT","CLAUDE_CODE_SESSION_ID","CURSOR_TRACE_ID"]` + `PATH`（engine-config.json:80-87，`context.test.ts:36` 钉死）——pi 检测复用 `AI_AGENT` 通道，零新键
- 开发期引擎直调 `node packages/cdd-engine/dist/cli.mjs`；spec/plans 中文（Strategy B）；changeset/commit 纪律不因本 phase 变更

## Deviations

| Overall assumption | Phase decision | Overall updated? |
|---|---|---|
| P3 scope 含「`cdd` 记录与 `h`/`id` 显示值归一（历史豁免清单注册）」 | 记录面零 harness 字段（实证空壳）→ scope 项废除为事实声明；issue Host 行坐标系分层声明；豁免清单概念废除 | Yes — v1.12 · 2026-09-29 |
| D4「引擎对 pi 的 spawn 采用 `pi -p` 风格 print 模式（per-op 形态 P3 phase spec 定稿）」 | 定稿 = `invoke "-p --mode text"`（本机 `pi --help` 实证：无 `--force`/`--output-format` 形态） | Yes — v1.12 · 2026-09-29 |
| P3 原 scope「detect 匹配面改名」 | 升格为 OOP 多态化（Harness 抽象 + 子类 detect 谓词 + 注册序 first-match）——P3 破坏性变更授权内的抽象统一重构 | Yes — v1.12 · 2026-09-29 |
| P3/P4 原「历史豁免清单注册」锚 | 豁免概念废除：守卫扫 live 面零残留，唯一允许命中 = registry `cli` 数据值；历史正文即史实 | Yes — v1.12 · 2026-09-29 |
| P3 原 scope 无命令契约面 | 命令契约面统一（D1–D4）：语义双轴 + blocker 判定源计数 + 单胶囊 stdout 面 + OOP 三组件 + Contract Lexicon 机制 + 消费面措辞同步 + 运维文档/CLAUDE.md——P3 契约面增项 | Yes — v1.13 · 2026-09-29 |
| 三先例（skill-anatomy / residue / engine-config）各自成系 | 收敛为 `contract-lexicon.json` 单词表 + `ContractLexiconGuard` 单守卫 + validate 单 block（原子化：三先例 + contract-wording 合一） | Yes — v1.13 · 2026-09-29 |

## Notes for downstream

- **P4 名义映射表**：标识符 ↔ 二进制 ↔ 宿主 marker 三面映射的**数据**已由 P3（registry 行内 `cli`/`invoke` 数据 + OOP detect 谓词）承载；P4 README 家族只做**渲染**（registry 数据导出），零手写重复映射——P4 spec 消费本 phase 的 `harness.ts` 实例化面
- **P4 文档统一验收**：docs/maintainers 已在 P3 随 C2 归零；P4 将守卫扫面扩展纳入 README 家族（`packages/osuperpowers/README.md:72` / `README.zh-CN.md:74` 行键格 `cursor-agent`→`cursor`）与 osuperpowers tests（`tests/helpers.mjs:16` 注释 / `tests/presentation-surface.test.mjs:274` 测试名）零化，并**定案 README Harness 表 cli 列二进制名 `cursor-agent` 渲染与守卫字面零化的关系**——守卫白名单单点 = registry `cli` 数据值，cli 列是数据导出渲染面（非豁免清单），P4 spec 设计其放行语义（root README 家族已零命中，仅复核）；历史正文即史实、无豁免；P4 需注意 `report-issues/SKILL.md:34` 的宿主自报名示例（`claude-code`）属于自报名坐标系，与 registry 行键分层（该不变量 P3 已声明，P4 渲染沿用）
- **历史豁免**（已废概念）：本次 rename 不做 retro-rename；历史文件（2026-09-13 family / pi-harness 各 version change-history 行）保留 `cursor-agent` 原文即史实
- **engine dist 资源**：`harness-registry.json` 随包发布（build.config.ts copy → `dist/resources/`）；本轮 rename + pi 行 + contract-lexicon.json = engine npm 包数据面变更，需 changeset 记录
- **P3 消费面同步**（C7）：`cli-driven-development/SKILL.md:59` 形状 restate 待删改（P3 交付时）——P3 交付后 orchestrator skill 措辞与引擎契约面同源（契约词表）；P4 收口时若引擎形状再变，`ContractLexiconGuard.checkWording` 将机械拦截旧 token re-entry（零漂移）
- **Contract Lexicon 与 emit 的关系**：`contract-lexicon.json` 若放 engine templates/schema（`../../cdd-engine` 引用面），emit 产物面不新增文件（词表 = engine 数据面，非分发 manifest）；CLAUDE.md/`pnpm run emit` 描述随 validate block 更新（emit:check 零漂移）
- **T7 波及面（崩溃恢复）**：`HARNESS_ABORT` 类别与 crash record 是新增横切——validate 的 channel-audit 需将 harnessAbortCount 纳入逐类计数断言（零泄漏）；`--no-verify` 快照语义写入 maintainers（hook 旁路的唯一正当理由 = crash-only snapshot）；P4 收口若引擎形状再变，ContractLexiconGuard.checkWording 机械拦截（零漂移）；crash record 属于工作区状态族，不参与消费面 restate
- **T8 波及面（统一终止模型）**：resume 软帽进入 state 面（progress/lifecycle 持久化 crash 恢复计数，逐任务独立）；reapStale 枚举面扩为 crash records + lifecycle 全部工作区 artifact（T6 enum 基座直接复用）；`recovery.residue_ref` 删除面 = progress 字段 + SKILL 措辞 + 测试（channel-audit 断言随删）；类别/机制解耦后 failureCategories 表增 `HARNESS_ABORT` 的身份面测试维持、机制层单路测试新增——类别身份与机制测试分面、互不耦合

## Change history

| Version | date | summary | author |
|---|---|---|---|
| v1.1 |  | spec review-1 fix | [human] |
| v1.2 |  | P3 契约面/词表增项 | [human] |
| v1.3 |  | spec review-2 fix | [human] |
| v1.4 |  | 崩溃恢复健壮性增项 | [human] |
| v1.5 |  | 统一终止模型增项 | [human] |
| v1.6 | 2026-09-30 | 预算维度统一增项 | [human] |
