# Pi Harness P3 实施计划（Pi Harness P3 Implementation Plan）

**Spec:** [2026-09-27-pi-harness-p3-design.md](docs/osuperpowers/specs/2026-09-27-pi-harness-p3-design.md)

- **Parent program**: [2026-09-27-pi-harness-overall.md v1.13](docs/osuperpowers/specs/2026-09-27-pi-harness-overall.md)
- **Version**: v1.2 · 2026-09-29（plan review-2 fixes：contract-lexicon 与 G2 守卫关系定裁 + 命中面/验收措辞勘正）
- **Depends on**: P3 design v1.3 Approved（`5b4ecfa7`，C1–C7 锚点定案 + 契约面 D1–D4 + Contract Lexicon L2）
- **Base**: develop

## Constraints

### 口径

- **单一真相（G1）**：engine harness 标识符行键集合恰 `{claude, cursor, pi}`——`harness-registry.json` 行键 + 测试 name-set 断言同源；`cursor-agent` 唯一合法暴露点 = registry `cli` 字段数据值（外部二进制名，不可改）
- **零残留不豁免（G2，用户拍板）**：守卫扫 live 面零 `cursor-agent`（唯一允许命中 = registry `cli` 数据值所在行 + contract-lexicon.json 同源数据行——词表 harness `clis` 映射 / residue 禁令表数据行，守卫读词表即单源、数据行随词表引入同具放行形态）；历史正文（2026-09-13 family / change-history 行）即史实，不 retro-rename、无豁免机制；P3 扫面 = engine src/tests + scripts + docs/maintainers 三面，README 家族与 osuperpowers tests 残留面零化随 P4 激活（零化序列：T1 随 rename 同落清零 engine src/tests + scripts 活动引用，T2 随守卫部署同落清零 docs/maintainers——自 T2 起每任务闭合三面零命中，唯一允许 = registry `cli` 数据值所在行 +（T4 起）contract-lexicon.json 数据行，放行集合随数据源推导、仍是数据派生白名单而非人改豁免清单）
- **OOP 抽象统一（C1/C5/C6）**：Criterion ②——行为收敛为 instance methods、零裸函数导出；C5 收编 next-step.ts / result-face.ts / finalize.ts 三处裸函数为 `StatusDeriver` / `NextStepRouter` / `ResultFace`，模块级单例收敛为构造注入；C6 收编四个独立守卫入口为 `ContractLexiconGuard` 单类
- **命令契约双轴（D1–D3）**：review 判定轴（CHANGES_REQUESTED/REVIEW_FIX/APPROVED 引擎推导）独占；implement/fix 工作轮统一 `COMPLETED`；`blocker:` 判定源计数（fix = `--findings` 输入 review 计数）；stdout 全 op 单胶囊 `status · blocker · handoff` + `next:`
- **host-marker 白名单恰 4 键不变**：`["AI_AGENT","CLAUDE_CODE_SESSION_ID","CURSOR_TRACE_ID"]` + `PATH`（context.test.ts 钉死）——pi 复用 `AI_AGENT` 通道零新键
- **分层不破（Non-goal）**：engine registry（spawn 契约面）与 emit 分发注册表 `scripts/lib/harness-registry.ts`（分发 manifest 面）不合并；本 phase 不触碰 emit 侧
- **消费面零引擎形状 restate（C7，iron rule）**：orchestrator skills 只锚路由 token（`next:` / `CDD_BLOCKED:` / handoff `findings`），`3-line return block` / `4th line counters` 类字面量清零；契约词表单一事实源后，形状改动零 skill 面漂移

### commit 边界机制

- 实现提交按任务粒度（conventional commits，无 attribution trailers）
- spec/plan 文档仅由 orchestrator（Plan Sole Writer）与 cdd fix-agent 修改；implement agent 零文档修改权
- **engine 数据面变更需 changeset**：`harness-registry.json` renaming + pi 行 + `contract-lexicon.json` 随包发布（build.config copy → dist/resources/）——changeset 记 cdd-engine（类型按 `.changeset/README.md` version scheme 判定，先读再判）
- 每任务闭合面测试绿 + `pnpm run precommit` 绿；engine 改面用 `pnpm --filter @oscaner-skills/cdd-engine test`（T3 后需 `dev:stub` 重跑以承接新契约面）
- 无 emit 产物面变更（Contract Lexicon 词表 = engine 数据面，非分发 manifest）——`pnpm run emit:check` 保持 fresh

### Flow Atomicity

- 单任务原子：每个任务闭合前该任务面测试 + 相关 validate 面全绿；name-set / byte / 白名单 pin 破即是设计漂移信号，报告 orchestrator 判定而非"带伤闭合"
- 串行 dispatch：T1→T2→T3→T4→T5，全 singleton 组（无 `## Task Groups` 合并）
- T3（命令契约面）闭合必跑 `dev:stub` 使后续 dispatch 消费新契约面；T4 词表接线后 validate 单 block 是验收主体

### 顺序原则

- T1（C1+C2 engine 数据面核心：harness.ts 抽象 + registry rename + pi 行）→ T2（C3 测试接线：三元组 name-set + 优先级矩阵 + residue G2 守卫）→ T3（C5 命令契约面：StatusDeriver/NextStepRouter/ResultFace + 调用面）→ T4（C6 Contract Lexicon：contract-lexicon.json + ContractLexiconGuard 收敛）→ T5（C7 消费面措辞 + C4 声明 + 运维文档/CLAUDE.md + changeset + 终验 validate 全绿）
- T5 置末位：消费面措辞与运维文档同步依赖前四任务的实际产物面；changeset 记录全部 P3 交付
- 每任务 end-to-end：实现 → 该任务面测试绿 → precommit 面绿

### 仓库纪律

- node：`fnm use`（.nvmrc）；引擎调用 `node packages/cdd-engine/dist/cli.mjs` 直调（`dev:stub` 后），不走 global cdd
- language policy：代码/测试 English-primary（本计划为 internal docs，中文豁免 Strategy B）；无 attribution trailers
- 消费面零程序叙事（iron rule）：SKILL.md / 消费者侧文件不带本程序 phase/issue 叙事——C7 措辞更新只删形状 restate，不注入程序笔法
- 引擎 `.mjs` plane zero：新增测试用 `.test.ts`（vitest）/ `.test.mjs`（node:test），src 不落 `.mjs`
- pi invoke 事实（O2）：`-p --mode text`（本机 `pi --help` 实证，pi 无 `--force`/`--output-format` 形态）——不臆造 pi 无证据的 spawn 面

### Task 1: C1+C2 engine 数据面核心（harness.ts 抽象 + registry rename + pi 行）

- **Do**: 新建 `packages/cdd-engine/src/infra/harness.ts`（OOP 抽象，Criterion ②）：
  - `abstract class Harness`：`id`（`"claude"` | `"cursor"` | `"pi"`）· 类型化行访问（cli/invoke/output/ship/cache/prefix/suffix 契约自持）· `abstract detect(env: NodeJS.ProcessEnv): boolean`
  - `class CursorHarness extends Harness`：`detect(env)` = `Boolean(env.CURSOR_TRACE_ID)`（SPECIFIC，最高优先）
  - `class ClaudeHarness extends Harness`：`detect(env)` = `Boolean(env.CLAUDE_CODE_SESSION_ID) || (env.AI_AGENT ?? "").startsWith("claude-code")`
  - `class PiHarness extends Harness`：`detect(env)` = `env.AI_AGENT === "pi"`（`PI_CODING_AGENT=true` 佐证，GENERIC 末位）
  - `ORDER` 常量 = `[Cursor, Claude, Pi]`（注册序即优先级：SPECIFIC 先于 GENERIC，与旧 if 链语义等价）
  - 单侧消费 `Registry` 数据门面（`harness.ts` → 读行 → 实例化），无反向 import
  - `packages/cdd-engine/src/infra/harness-registry.json`：行键 `cursor-agent` → `cursor`（`cli` 值保持 `"cursor-agent"`——二进制名外部事实，唯一数据暴露点）；新增 `pi` 行（`cli: "pi"` · `invoke: "-p --mode text"` · `output: "text"` · `ship: "full"` · prefix/review/fix 镜像 claude/cursor · `suffix: {}` · `cache: {mechanism: "auto-prefix", minTokens: "pending", observable: false}` 克隆 cursor 未实测态）；行键集合 = `{claude, cursor, pi}`
  - `packages/cdd-engine/src/cli/shared.ts`：`detectCurrentHarness(env)` 签名不变（residue `detectCurrentHarness(process.env)` 直读锚点保持），实现改为按 `ORDER` 遍历实例调 `detect`，命中返回 `instance.id`，全空返回 `""`；`shared.ts:24` 注释随行更新；`requireHostHarness` 不变
  - `scripts/observe-cache.ts`：`--harness claude|cursor` 描述 + default 不动 + 日头行键随 registry 行键直出（`observe-cache.ts:26,62,235` 更新）
  - `cdd.test.ts:190` 注释更新（host 合法键 `{claude, cursor, pi}`）
  - 测试面键引用随 rename 同落（Flow Atomicity：改名任务闭合即该面全绿，T2 仅承接表驱动全量升级）——registry.test.ts name-set（`:15/:22/:24`）与 `:134` 全 harness 迭代键数组 → `{claude, cursor, pi}`（T1 已加 pi 行，即 ground truth）+ `:12` it 标题（`读取 2 harness（T2 收敛 claude/cursor-agent）`）随三元组同落改 3 harness 语义；`:22` / `:134` 标题同规则——it 标题不得残留 `cursor-agent` 字面、infra.registry.test.ts:19/21 name-set → 三元组、registry.cache.test.ts:31/32（`reg["cursor-agent"]` → `reg["cursor"]` + 用例名）、invoke.dispatch-set.test.ts:86（→ `reg["cursor"]`）、host-detection.test.ts:66/68 期望（`"cursor-agent"` → `"cursor"`）+ `:3` 注释、observe-cache.test.ts:77/85（日头行键期望 → `"cursor"`）
- **验收**: `harness.ts` 含 `Harness`/`CursorHarness`/`ClaudeHarness`/`PiHarness`/`ORDER` 导出，零裸函数导出；`harness-registry.json` 行键恰 `{claude, cursor, pi}` 且 `cursor` 行 `cli` = `"cursor-agent"`、`pi` 行 `cli` = `"pi"` + `invoke` = `"-p --mode text"` + cache pending 三字段；`detectCurrentHarness` 对 `{CURSOR_TRACE_ID:"1"}` → `"cursor"`、`{AI_AGENT:"pi"}` → `"pi"`、`{}` → `""`（T2 表驱动全量另验）；engine `pnpm test` + `scripts` vitest 该面全绿（测试面键引用随 rename 同落，见 Do）；precommit 面绿。
- **注**: `Registry` 类（infra/registry.ts）不改行为（数据门面），`harness.ts` 单向消费；rename 同落后 `cursor-agent` 字面剩余 = registry `cli` 字段数据值一枚（唯一合法暴露点）+ 历史正文（2026-09-13 family / change-history 行即史实，不 retro-rename）+ docs/maintainers 03:48 镜像（G2 三扫面活残留，由 T2 随守卫同落零化）。

### Task 2: C3 测试接线 + residue G2 守卫

- **Do**: engine 测试面同步 + live 面守卫：
  - `cli/__tests__/host-detection.test.ts`：表驱动重写——cursor（CURSOR_TRACE_ID）· claude session（CLAUDE_CODE_SESSION_ID）· claude AI_AGENT（`claude-code*` 前缀）· pi（`AI_AGENT=pi`）· unknown（`AI_AGENT=codex` → `""`）；**优先级矩阵**（CURSOR_TRACE_ID + AI_AGENT=pi → cursor；CLAUDE_CODE_SESSION_ID + AI_AGENT=pi → claude；全空 → `""`）——三位宿主 origin 全测；文件头注释更新
  - `infra/__tests__/registry.test.ts` / `infra/__tests__/infra.registry.test.ts`：三元组正向 name-set 断言已随 T1 rename+pi 行同落（恰 `{claude, cursor, pi}`，G1）——此处补 **无杂键反向** 断言（杂键即 fail，G1 双向钉死）+ 注释归位
  - `infra/__tests__/registry.cache.test.ts`：cursor 行 profile（auto-prefix/pending）用例 + pi 行 pending profile 用例（`cacheProfileFor(reg["pi"])` toMatchObject）；L39-44 全行迭代 schema 校验自动纳入 pi（零硬编码）
  - `scripts/validate/residue.ts`：新增 **live 面 last-index 守卫**（G2）——扫描 engine src（含测试）+ scripts + docs/maintainers 三面，`cursor-agent` 命中即 fail；唯一允许 = `harness-registry.json` 行 `cli` 字段值（白名单数据派生、非人改豁免清单，命中点随 registry 数据走）；`contract-lexicon.json` 引入后其同源数据行（harness `clis` 映射 / residue 禁令表）并入数据源放行集合——守卫数据源 = [harness-registry.json, contract-lexicon.json]，词表缺席时其放行行自然为零、T4 落地后并入（校验实现按「数据源行掩码」或「白名单单点正则」任一形态承接，测试钉死行为）；smoke-cdd 无 `cursor-agent` pin、无需改动
  - `scripts/validate/__tests__/residue.test.ts`：G2 守卫回归用例（与既有收集器 `targetsOverride` 注入模式一致）——(a) 白名单数据源行放行（registry `cli` 数据值所在行绿）、(b) 三守卫面任一非数据行 `cursor-agent` 命中即 fail（含词表行放行互补断言：`targetsOverride` 注入 lexicon 形状数据行 → 绿，词表 harness `clis` 映射 / residue 禁令表数据行放行、数据域外残留仍 fail）、(c) 白名单随 registry 数据变化（anti-white-green：registry `cli` 值改后新值放行、旧值命中即 fail——与 G1 对齐）
  - `docs/maintainers` 同任务零化（守卫部署即三面零命中）：03-context-caching-doctrine.md:48 Baseline entries 行键 `cursor-agent` → `cursor` 镜像——docs/maintainers 面唯一活残留随守卫同落；T5 移除该行作业
- **验收**: host-detection 表驱动全绿（单 marker 五 case + 优先级矩阵三 case + `{}` empty）；registry 测试 name-set 恰 `{claude, cursor, pi}` 全绿（正向 T1 同落 + 无杂键反向）；registry.cache 全行迭代含 pi 行过 schema；invoke.dispatch-set 无 `cursor-agent` 引用；host-marker 白名单恰 4 键断言（`context.test.ts` / `infra.context.test.ts`）保持绿；residue G2 守卫三回归用例全绿 + 三面扫描零命中（唯一允许 registry `cli`；docs/maintainers 03:48 行键镜像随守卫同落零化）；engine `pnpm test` 全绿；`pnpm run validate` 服务面全绿；precommit 面绿。
- **注**: G2 守卫放行语义 = 命中点在数据源数据内即绿——数据源集合 = [harness-registry.json, contract-lexicon.json（T4 引入）]，词表数据行（harness `clis` 映射 / residue 禁令表）随 T4 并入放行（校验实现按「扫描面排除 registry + 词表数据源行（数据行掩码）」或「白名单单点正则」任一形态，测试钉死行为）。

### Task 3: C5 命令契约面（StatusDeriver / NextStepRouter / ResultFace）

- **Do**: engine 命令契约面重构（D1–D3）：
  - 新建 `StatusDeriver`：`deriveReviewStatus(findings)` → 判定轴（CHANGES_REQUESTED / REVIEW_FIX / APPROVED，收编 finalize.ts 推导语义）；`workStatus(declared)` → 工作轮轴（COMPLETED / BLOCKED，收编 return-block `implementStatusFromReturnLine` 的 APPROVED|BLOCKED 折叠——APPROVED 折叠改为 COMPLETED）
  - 新建 `NextStepRouter`：`next(input: NextStepArgs)` → instance method，C5 决策表原样迁入（next-step.ts `nextStepFor` 语义逐行保留）；模块级单例 `convergence`（next-step.ts:34）收敛为构造注入；零裸函数、零模块级可变状态
  - 新建 `ResultFace`（全 op 单一 stdout 面）：`emit(op, ctx)` → `status: {…} · blocker: {n} · handoff: {path}` + `next: {…}`；构造注入 `#statusDeriver` / `#nextRouter` / `#convergence`；review → 判定轴 + 自身 findings blocker；implement/fix → 工作轮 + 判定源计数（fix = `--findings` 输入 review 的 blocker 数；implement 无判定源 → **`blocker: 0`**，与 spec D2 一致）；替换 result-face.ts `docsResultFace` + task 族 4 行块（commits/artifacts/counters 收进 handoff，stdout 只留状态胶囊）
  - 调用面同步：cli/review.ts / cli/fix.ts / dispatch/task.ts / dispatch/branch.ts / dispatch/docs.ts 消费点改走 `ResultFace`（status/blocker/next 语义不变仅形状统一）
  - 测试：迁移/重写 `cli/__tests__/result-face.test.ts`（既存 `docsResultFace` 4 用例随 face 替换迁移为 ResultFace 单胶囊 shape 断言，钉死判定轴/工作轮双轴 + fix 源-review blocker——同路径不并存新旧两文件）· `rules/__tests__/next-step.test.ts` 迁移为 instance-method 断言（决策表 row 逐条保留）
  - 开发态承接：改动后 `pnpm --filter @oscaner-skills/cdd-engine dev:stub` 重跑
- **验收**: 三组件（StatusDeriver/NextStepRouter/ResultFace）全导出、零裸函数、构造注入（无模块级单例）；review 输出判定轴 + 自身 findings blocker（`status: CHANGES_REQUESTED · blocker: 1 · handoff: …`）；implement/fix 输出工作轮（`status: COMPLETED`）、fix 的 `blocker:` = `--findings` 输入计数（非自报空数组）且 implement 的 `blocker:` = 0（无判定源，D2）；task/docs 两族单胶囊同形；`next:` 行 C5 决策表语义逐行不变（next-step.test 迁移后全绿）；engine `pnpm test` 全绿（含 result-face.test）；`dev:stub` 后 `node dist/cli.mjs review --type spec` 冒烟输出单胶囊；precommit 面绿。
- **注**: 本任务的 stdout 形状变化（task 4 行块 → 单胶囊）正是 C7 消费面措辞更新（T4/T5）的触发源——契约变更→skill 措辞同步依赖：`cli-driven-development/SKILL.md:59` 形状 restate 删改随 T4 checkWording 接线同落（见 T4 Do），其余 skills 措辞复核随 T5；T3 交付时引擎侧不残留旧形状消费面。

### Task 4: C6 Contract Lexicon（contract-lexicon.json + ContractLexiconGuard）

- **Do**: 三先例 + contract-wording 统一为单词表 + 单守卫：
  - 新建 `contract-lexicon.json`（选址定 `packages/cdd-engine/src/infra/`——与 harness-registry.json 同目录、同 copy 管线、同发布 cadence，随包发布至 dist/resources/）：五域单词表——`harness`（ids={claude,cursor,pi} + clis 映射 = registry `cli` 数据值镜像）· `status`（vocab 五元 + 双轴映射：判定轴三态/工作轮 COMPLETED）· `stdout`（胶囊 `status · blocker · handoff` + `next:` + `CDD_BLOCKED:` stderr 通道 + handoff `findings` 锚）· `residue`（禁令表：`cursor-agent` 唯一允许 = registry `cli` 数据值，随 G2）· `anatomy`（skill-anatomy 的 heading/edge/node registry 引用）——词表 harness `clis` 映射与 residue 禁令表数据行 = 守卫数据源放行集合成员（见 G2 与 T2 守卫），词表其余数据域零 `cursor-agent` 残留
  - build.config.ts：`src/infra` copy entry 的 pattern 由 `["harness-registry.json"]` 扩展为 `["harness-registry.json", "contract-lexicon.json"]`——guard 仓库级读 src 单源，dist/resources 产物随包发布（templates/ 候选否：词表与 registry 同管线同 cadence 落地）
  - 新建 `scripts/lib/contract-lexicon.ts`：`class ContractLexiconGuard`（Criterion ② 零裸函数）——`checkAnatomy(skills)`（digraph-consistency 断言迁入）· `checkResidue(targets)`（residue 收集器迁入，含 `targetsOverride` 注入模式）· `checkWording(skills)`（C7 措辞守卫：orchestrator skills 零引擎形状 restate——`3-line return block` / `4th line counters` 类字面量 fail + 路由 token `next:`/`CDD_BLOCKED:`/`findings` 锚）· `checkConfig(engineConfig)`（engine-config channel audit 迁入）
  - validate 单 block 接线：四独立 test 入口（digraph-consistency / residue.test / context.test / 新 contract-wording）收敛为 `ContractLexiconGuard` 一次驱动（`scripts/validate/` 加或并入既有 block）
  - 消费面同任务零化（checkWording 接线即零命中）：`packages/osuperpowers/skills/cli-driven-development/SKILL.md:59` 删 `3-line return block` / `4th line counters` 形状 restate、改锚路由 token（`next:` / `CDD_BLOCKED:` / handoff `findings`）；`:119`（Failure Modes TIMEOUT 行 `retry within the counters cap … per the output contract`）同任务改锚——counters 收进 handoff 后引用点改指 handoff 内 counters，`retry 有界 + terminal` 处理语义保留；checkWording fail-set 语义 = 形状 restate 字面量形态（`3-line return block` / `4th line counters` 类），裸 token（`counters` / `output contract` 单独出现）不属 fail-set——改锚后 `:119` 不属形状 restate；接线前已知命中面（`:59` + `:119`）随同任务清零；T5 降为其余 skills 复核
  - 词表单一事实源：guard 读 `contract-lexicon.json`（不经手写许清单），行为断言与词表同源
- **验收**: `contract-lexicon.json` 五域词表存在且与引擎事实一致（harness 三元组 / status 五元 + 双轴映射（判定轴三态/工作轮 COMPLETED）/ stdout 胶囊 / residue 禁令 / anatomy registry），`dist/resources/contract-lexicon.json` 随 build copy entry 物化存在（dev:stub / build 后）；`ContractLexiconGuard` 四方法全绿（checkAnatomy 等价 digraph-consistency / checkResidue 等价 residue 收集器（词表数据行并入放行集合后等价性与既存回归同绿）/ checkWording 零形状 restate（SKILL.md:59 与 `:119` 已同任务零化/改锚）/ checkConfig 等价 channel audit）——三先例 test 入口收敛后断言经 guard 同源通过；validate 单 block 下全绿（`pnpm run validate`——守卫 + 词表共存：词表 harness `clis` / residue 禁令表数据行放行、词表非数据域 `cursor-agent` 残留仍 fail，G2 三面零命中成立）；`pnpm run emit:check` fresh（词表 = engine 数据面，非 manifest 产物）；precommit 面绿。
- **注**: 收敛是**行为等价迁移**（断言面不缩水）；P4 收口时 README 家族 + osuperpowers tests 纳入 guard 扫面（P3 不承诺，随 P4 激活）。

### Task 5: C7 消费面措辞 + C4 声明 + 运维文档/CLAUDE.md + changeset + 终验

- **Do**: 消费面同步 + 文档收口 + 终验：
  - `packages/osuperpowers/skills/cli-driven-development/SKILL.md`：`:59` 形状 restate（`3-line return block` / `4th line counters`）与 `:119`（Failure Modes TIMEOUT 行 counters 措辞）已随 T4 checkWording 接线同任务改锚（`:119` 引用点改指 handoff 内 counters，`retry 有界 + terminal` 语义保留）——此处复核改锚路由 token（`next:` / `CDD_BLOCKED:` / handoff `findings`）且 `:119` 措辞与单胶囊/handoff 契约一致；`:66`（review Read）复核单胶囊语义确认；消费面零引擎形状 restate，不注入程序笔法（iron rule）
  - 其余 orchestrator skills（writing-single/overall/phase-spec / writing-plans / brainstorming / finishing / report-issues）：盘点已证零形状 restate——复核即可，必要时措辞微调
  - `docs/maintainers/`：01-template-doctrine（harness-registry 行键镜像 cursor + pi 参考）· 02-naming-conventions（契约措辞指针 + Contract Lexicon 机制引用）· 03-context-caching-doctrine（Baseline entries 补 pi 行 + 复核零 cursor-agent——行键镜像已随 T2 G2 守卫同落）· 04-program-experience（Contract Lexicon 机制记录）
  - 根 `CLAUDE.md`：`pnpm run emit` / validate 描述随 Contract Lexicon 单 block 更新；engine 调用面（dev:stub / cdd CLI）契约措辞随 C5 单胶囊更新（`cdd review`/`fix` 输出描述）；commit/validate 流程描述不因本 phase 变更
  - `pnpm run emit` 重跑（skill 文本变更后）→ `emit:check` 零漂移
  - C4 空壳声明 + 坐标系分层（R1）：记录面零 harness 字段事实声明已随 overall v1.12 回填——本任务仅确认 ecosystem 无反向引用（issue 渲染 Host 行不动）
  - changeset：建 cdd-engine changeset（cursor rename + pi 行 + 命令契约面 + contract-lexicon.json 数据面变更；类型按 `.changeset/README.md` version scheme 判定）
  - 终验：`pnpm run validate` 全绿（含 Contract Lexicon 单 block / residue G2 / 命名统一 pin）
- **验收**: `cli-driven-development/SKILL.md` 零引擎形状 restate（`3-line return block` / `4th line counters` 类字面量清零），仅锚路由 token；docs/maintainers 全家族与契约面/词表一致、行键镜像零 cursor-agent（G2 三面扫描含 docs/maintainers 零命中）；根 CLAUDE.md emit/validate/engine 契约描述更新；C4 核对：`packages/cdd-engine/templates/report/issue-body.json:202` `masterDef.harnessRow`（`- Harness: <harness>`）字段零改动、Host 行不被引擎行键改写（坐标分层成立）；`pnpm run emit` + `emit:check` 零漂移；changeset 存在（cdd-engine，breaking/patch 按 scheme）；`pnpm run validate` 全块全绿；precommit 面绿。
- **注**: 消费面措辞同步的验收主体 = `ContractLexiconGuard.checkWording`（T4 已接线）——T5 改动后该检查零命中即措辞同步生效；README 家族（`osuperpowers/README.md:72` / `README.zh-CN.md:74`）与 osuperpowers tests 残留面零化归 P4，P3 不承诺。
