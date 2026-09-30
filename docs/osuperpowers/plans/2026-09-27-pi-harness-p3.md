# Pi Harness P3 实施计划（Pi Harness P3 Implementation Plan）

**Spec:** [2026-09-27-pi-harness-p3-design.md](docs/osuperpowers/specs/2026-09-27-pi-harness-p3-design.md)

- **Parent program**: [2026-09-27-pi-harness-overall.md v1.16](docs/osuperpowers/specs/2026-09-27-pi-harness-overall.md)
- **Version**: v1.8 · 2026-09-30（plan review-3 fixes v1.3 + 用户拍板 T6 bootstrap v1.4 → Workspace 收编 v1.5 → T6 补钉 v1.6 → **T7 崩溃恢复健壮性 v1.7 → review-5 fixes v1.8**）
- **Depends on**: P3 design v1.4 Approved（`495707f4`，C1–C7 锚点定案 + 契约面 D1–D4 + Contract Lexicon L2 + 崩溃恢复健壮性 T7）
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
- 串行 dispatch：T1→T2→T3→T4→T5→T6→T7，全 singleton 组（无 `## Task Groups` 合并）
- T3（命令契约面）闭合必跑 `dev:stub` 使后续 dispatch 消费新契约面；T4 词表接线后 validate 单 block 是验收主体

### 顺序原则

- T1（C1+C2 engine 数据面核心：harness.ts 抽象 + registry rename + pi 行）→ T2（C3 测试接线：三元组 name-set + 优先级矩阵 + residue G2 守卫）→ T3（C5 命令契约面：StatusDeriver/NextStepRouter/ResultFace + 调用面）→ T4（C6 Contract Lexicon：contract-lexicon.json + ContractLexiconGuard 收敛）→ T5（C7 消费面措辞 + C4 声明 + 运维文档/CLAUDE.md + changeset + 终验 validate 全绿）→ T6（Workspace 域收编：WorkspaceRoot/Workspace 双类 + 双源灭绝 + 死壳删除 + lifecycle 归位，用户拍板追加）→ T7（崩溃恢复健壮性：HARNESS_ABORT + crash-only snapshot + stash 平面删除，消费 T6 Workspace 域）
- T6→T7 置尾：workspace 数据面收编依赖前五任务的实际产物面（contract lexicon / 契约面已落），且 bootstrap 保证（`.osuperpowers/.gitignore` 自守卫）+ lifecycle 归位 slug 是全程序 workspace 落点的统一收口；T7 崩镜记录/恢复（crash record 落盘 + crash-only snapshot + 恢复路由）依赖 T6 Workspace 域承接（`crashPath` / `writeJson` / snapshot 落点），顺序必在 T6 之后——T6 收编为 T7 铺平单一落点
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
  - 测试面键引用随 rename 同落（Flow Atomicity：改名任务闭合即该面全绿，T2 仅承接表驱动全量升级）——registry.test.ts name-set（`:15/:22/:24`）与 `:134` 全 harness 迭代键数组 → `{claude, cursor, pi}`（T1 已加 pi 行，即 ground truth）+ `:12` it 标题（`读取 2 harness（T2 收敛 claude/cursor-agent）`）随三元组同落改 3 harness 语义；`:22` / `:134` 标题同规则、`:20-21` 注释（`leaving the registry converged on the two keys claude/cursor-agent (Task 2, P5)` 陈旧收敛叙事）随同落改写为三元组语义并删 P5 叙事——it 标题与注释均不得残留 `cursor-agent` 字面，registry.test.ts 全文件字面清零（name-set/标题/注释全覆盖，闭合锚点遗漏类缺口）、infra.registry.test.ts:19/21 name-set → 三元组、registry.cache.test.ts:31/32（`reg["cursor-agent"]` → `reg["cursor"]` + 用例名）、invoke.dispatch-set.test.ts:86（→ `reg["cursor"]`）、host-detection.test.ts:66/68 期望（`"cursor-agent"` → `"cursor"`）+ `:3` 注释、observe-cache.test.ts:77/85（日头行键期望 → `"cursor"`）
- **验收**: `harness.ts` 含 `Harness`/`CursorHarness`/`ClaudeHarness`/`PiHarness`/`ORDER` 导出，零裸函数导出；`harness-registry.json` 行键恰 `{claude, cursor, pi}` 且 `cursor` 行 `cli` = `"cursor-agent"`、`pi` 行 `cli` = `"pi"` + `invoke` = `"-p --mode text"` + cache pending 三字段；`detectCurrentHarness` 对 `{CURSOR_TRACE_ID:"1"}` → `"cursor"`、`{AI_AGENT:"pi"}` → `"pi"`、`{}` → `""`（T2 表驱动全量另验）；engine `pnpm test` + `scripts` vitest 该面全绿（测试面键引用随 rename 同落，见 Do）；precommit 面绿。
- **注**: `Registry` 类（infra/registry.ts）不改行为（数据门面），`harness.ts` 单向消费；rename 同落后 `cursor-agent` 字面剩余 = registry `cli` 字段数据值一枚（唯一合法暴露点，engine src 含测试全文件零字面——name-set/标题/注释全覆盖）+ 历史正文（2026-09-13 family / change-history 行即史实，不 retro-rename）+ docs/maintainers 03:48 镜像（G2 三扫面活残留，由 T2 随守卫同落零化）。

### Task 2: C3 测试接线 + residue G2 守卫

- **Do**: engine 测试面同步 + live 面守卫：
  - `cli/__tests__/host-detection.test.ts`：表驱动重写——cursor（CURSOR_TRACE_ID）· claude session（CLAUDE_CODE_SESSION_ID）· claude AI_AGENT（`claude-code*` 前缀）· pi（`AI_AGENT=pi`）· unknown（`AI_AGENT=codex` → `""`）；**优先级矩阵**（CURSOR_TRACE_ID + AI_AGENT=pi → cursor；CLAUDE_CODE_SESSION_ID + AI_AGENT=pi → claude；全空 → `""`）——三位宿主 origin 全测；文件头注释更新
  - `infra/__tests__/registry.test.ts` / `infra/__tests__/infra.registry.test.ts`：三元组正向 name-set 断言已随 T1 rename+pi 行同落（恰 `{claude, cursor, pi}`，G1）——此处补 **无杂键反向** 断言（杂键即 fail，G1 双向钉死）+ 注释归位
  - `infra/__tests__/registry.cache.test.ts`：cursor 行 profile（auto-prefix/pending）用例 + pi 行 pending profile 用例（`cacheProfileFor(reg["pi"])` toMatchObject）；L39-44 全行迭代 schema 校验自动纳入 pi（零硬编码）
  - `scripts/validate/residue.ts`：新增 **live 面 last-index 守卫**（G2）——扫描 engine src（含测试）+ scripts + docs/maintainers 三面，`cursor-agent` 命中即 fail；**逐面 `__tests__` 处置钉死**——engine src 面走 `{ includeTests: true }`（残留位正位于引擎测试文件（registry.test / host-detection.test / invoke.dispatch-set.test 等），T1 清零后扫测试文件才证得零残留，同 collectRootResolverHits 显式 opt-in 先例）；scripts 面走 walkTargetFiles 既有默认自豁免（`**/__tests__` 默认排除）——守卫自身回归测试位（scripts/validate/__tests__/residue.test.ts 的 (b) 用例）以字面/拼接引述所守卫词法属反向守卫测试位、不受扫；docs/maintainers 面无测试位、全扫。守卫 body 与回归测试不得以字面承载所守卫词法（guard body 不得成为所守卫词法的载体）——命中 token 经拼接构造（如 `"cursor-" + "agent"`）或经 `targetsOverride` 注入扫面外临时数据文件承载。唯一允许 = `harness-registry.json` 行 `cli` 字段值（白名单数据派生、非人改豁免清单，命中点随 registry 数据走）；`contract-lexicon.json` 引入后其同源数据行（harness `clis` 映射 / residue 禁令表）并入数据源放行集合——守卫数据源 = [harness-registry.json, contract-lexicon.json]，词表缺席时其放行行自然为零、T4 落地后并入（校验实现按「数据源行掩码」或「白名单单点正则」任一形态承接，测试钉死行为）；smoke-cdd 无 `cursor-agent` pin、无需改动
  - `scripts/validate/__tests__/residue.test.ts`（既有文件，G2 用例并入既存 stale/gate-lexicon 断言组）：G2 守卫回归用例（与既有收集器 `targetsOverride` 注入模式一致，命中 token 经拼接构造、不以字面承载词法）——(a) 白名单数据源行放行（registry `cli` 数据值所在行绿）、(b) 三守卫面任一非数据行 `cursor-agent` 命中即 fail（含词表行放行互补断言：`targetsOverride` 注入 lexicon 形状数据行 → 绿，词表 harness `clis` 映射 / residue 禁令表数据行放行、数据域外残留仍 fail）、(c) 白名单随 registry 数据变化（anti-white-green：registry `cli` 值改后新值放行、旧值命中即 fail——与 G1 对齐）
  - `docs/maintainers` 同任务零化（守卫部署即三面零命中）：03-context-caching-doctrine.md:48 Baseline entries 行键 `cursor-agent` → `cursor` 镜像——docs/maintainers 面唯一活残留随守卫同落；T5 移除该行作业
- **验收**: host-detection 表驱动全绿（单 marker 五 case + 优先级矩阵三 case + `{}` empty）；registry 测试 name-set 恰 `{claude, cursor, pi}` 全绿（正向 T1 同落 + 无杂键反向）；registry.cache 全行迭代含 pi 行过 schema；invoke.dispatch-set 无 `cursor-agent` 引用；host-marker 白名单恰 4 键断言（`context.test.ts` / `infra.context.test.ts`）保持绿；residue G2 守卫三回归用例全绿 + 三面有效扫面零命中（engine src 含测试 / scripts live（非 `__tests__`）/ docs/maintainers 全扫，唯一允许 registry `cli`——守卫自身回归测试位属默认自豁免、不构成漏扫；docs/maintainers 03:48 行键镜像随守卫同落零化）；engine `pnpm test` 全绿；`pnpm run validate` 服务面全绿；precommit 面绿。
- **注**: G2 守卫放行语义 = 命中点在数据源数据内即绿——数据源集合 = [harness-registry.json, contract-lexicon.json（T4 引入）]，词表数据行（harness `clis` 映射 / residue 禁令表）随 T4 并入放行（校验实现按「扫描面排除 registry + 词表数据源行（数据行掩码）」或「白名单单点正则」任一形态，测试钉死行为）。「三面零命中」覆盖语义以 Do 的逐面 `__tests__` 处置为权威（engine src 含测试 / scripts 排测试位 / docs/maintainers 全扫）——scripts 面测试位自豁免 + 守卫自身测试经拼接/targetsOverride 注入不载词法，二者共同保证守卫无自击且有效扫面无漏。

### Task 3: C5 命令契约面（StatusDeriver / NextStepRouter / ResultFace）

- **Do**: engine 命令契约面重构（D1–D3）：
  - 新建 `StatusDeriver`：`deriveReviewStatus(findings)` → 判定轴（CHANGES_REQUESTED / REVIEW_FIX / APPROVED，收编 finalize.ts 推导语义）；`workStatus(declared)` → 工作轮轴（COMPLETED / BLOCKED，收编 return-block `implementStatusFromReturnLine` 的 APPROVED|BLOCKED 折叠——APPROVED 折叠改为 COMPLETED）
  - 新建 `NextStepRouter`：`next(input: NextStepArgs)` → instance method，C5 决策表原样迁入（next-step.ts `nextStepFor` 语义逐行保留）；模块级单例 `convergence`（next-step.ts:34）收敛为构造注入；零裸函数、零模块级可变状态
  - 新建 `ResultFace`（全 op 单一 stdout 面）：`emit(op, ctx)` → `status: {…} · blocker: {n} · handoff: {path}` + `next: {…}`；构造注入 `#statusDeriver` / `#nextRouter` / `#convergence`；review → 判定轴 + 自身 findings blocker；implement/fix → 工作轮 + 判定源计数（fix = `--findings` 输入 review 的 blocker 数；implement 无判定源 → **`blocker: 0`**，与 spec D2 一致）；替换 result-face.ts `docsResultFace` + task 族 4 行块（commits/artifacts/counters 收进 handoff，stdout 只留状态胶囊）
  - 调用面同步：cli/review.ts / cli/fix.ts / dispatch/task.ts / dispatch/branch.ts / dispatch/docs.ts 消费点改走 `ResultFace`（status/blocker/next 语义不变仅形状统一）
  - 测试：迁移/重写 `cli/__tests__/result-face.test.ts`（既存 `docsResultFace` 4 用例随 face 替换迁移为 ResultFace 单胶囊 shape 断言，钉死判定轴/工作轮双轴 + fix 源-review blocker——同路径不并存新旧两文件）· `rules/__tests__/next-step.test.ts` 迁移为 instance-method 断言（决策表 row 逐条保留）
  - 开发态承接：改动后 `pnpm --filter @oscaner-skills/cdd-engine dev:stub` 重跑
- **验收**: 三组件（StatusDeriver/NextStepRouter/ResultFace）全导出、零裸函数、构造注入（无模块级单例）；review 输出判定轴 + 自身 findings blocker（`status: CHANGES_REQUESTED · blocker: 1 · handoff: …`）；implement/fix 输出工作轮（`status: COMPLETED`）、fix 的 `blocker:` = `--findings` 输入计数（非自报空数组）且 implement 的 `blocker:` = 0（无判定源，D2）；task/docs 两族单胶囊同形；`next:` 行 C5 决策表语义逐行不变（next-step.test 迁移后全绿）；engine `pnpm test` 全绿（含 result-face.test）；`dev:stub` 后 `node dist/cli.mjs review --type spec --spec <实际 spec 路径> --dry-run` 冒烟输出单胶囊（`--spec <path>` 操作数必填——缺失时 `resolveTargetDoc` 对 type=spec 直接 exit 2 `missing required --spec <path>`，按字面命令走不到输出面；叠加 `--dry-run` 轻量断言胶囊形状、不触发真实 review dispatch，对齐 parse.ts `--dry-run` 主令声明；冒烟在 host env（如 `CLAUDE_CODE_SESSION_ID=1`，对齐 smoke-cdd 先例）+ 干净树前置下执行，缺一即前置 BLOCK）；precommit 面绿。
- **注**: 本任务的 stdout 形状变化（task 4 行块 → 单胶囊）正是 C7 消费面措辞更新（T4/T5）的触发源——契约变更→skill 措辞同步依赖：`cli-driven-development/SKILL.md:59` 形状 restate 删改随 T4 checkWording 接线同落（见 T4 Do），其余 skills 措辞复核随 T5；T3 交付时引擎侧不残留旧形状消费面。

### Task 4: C6 Contract Lexicon（contract-lexicon.json + ContractLexiconGuard）

- **Do**: 三先例 + contract-wording 统一为单词表 + 单守卫：
  - 新建 `contract-lexicon.json`（选址定 `packages/cdd-engine/src/infra/`——与 harness-registry.json 同目录、同 copy 管线、同发布 cadence，随包发布至 dist/resources/）：五域单词表——`harness`（ids={claude,cursor,pi} + clis 映射 = registry `cli` 数据值镜像）· `status`（vocab 五元 + 双轴映射：判定轴三态/工作轮 COMPLETED）· `stdout`（胶囊 `status · blocker · handoff` + `next:` + `CDD_BLOCKED:` stderr 通道 + handoff `findings` 锚）· `residue`（禁令表：`cursor-agent` 唯一允许 = registry `cli` 数据值，随 G2）· `anatomy`（skill-anatomy 的 heading/edge/node registry 引用）——词表 harness `clis` 映射与 residue 禁令表数据行 = 守卫数据源放行集合成员（见 G2 与 T2 守卫），词表其余数据域零 `cursor-agent` 残留
  - build.config.ts：`src/infra` copy entry 的 pattern 由 `["harness-registry.json"]` 扩展为 `["harness-registry.json", "contract-lexicon.json"]`——guard 仓库级读 src 单源，dist/resources 产物随包发布（templates/ 候选否：词表与 registry 同管线同 cadence 落地）
  - 新建 `scripts/lib/contract-lexicon.ts`：`class ContractLexiconGuard`（Criterion ② 零裸函数）——`checkAnatomy(skills)`（digraph-consistency 断言迁入）· `checkResidue(targets)`（residue 收集器迁入，含 `targetsOverride` 注入模式）· `checkWording(skills)`（C7 措辞守卫：orchestrator skills 零引擎形状 restate——`3-line return block` / `4th line counters` 类字面量 fail + 路由 token `next:`/`CDD_BLOCKED:`/`findings` 锚）· `checkConfig(engineConfig)`（engine-config channel audit 迁入）
  - validate 单 block 接线：四独立 test 入口（digraph-consistency / residue.test / context.test / 新 contract-wording）收敛为 `ContractLexiconGuard` 一次驱动（`scripts/validate/` 加或并入既有 block）
  - 消费面同任务零化（checkWording 接线即零命中）：`packages/osuperpowers/skills/cli-driven-development/SKILL.md:59` 删 `3-line return block` / `4th line counters` 形状 restate、改锚路由 token（`next:` / `CDD_BLOCKED:` / handoff `findings`）；`:119`（Failure Modes TIMEOUT 行 `retry within the counters cap … per the output contract`）同任务改锚——counters 收进 handoff 后引用点改指 handoff 内 counters，`retry 有界 + terminal` 处理语义保留；`:108`（I7 dry-run 行 `an APPROVED stub handoff plus the return block contract only`）同任务改锚——裸 `return block` 是旧 stdout 多行输出块专名（T3 单胶囊后无对应现行物），改指现行单胶囊输出契约/handoff，dry-run 语义（不触发 agent spawn、stub handoff 写入、tree 状态无关）保留；**checkWording fail-set 粒度钉死**：形态词 = 指向旧 stdout 多行形状的专名字面——`3-line return block` / `4th line counters` / **独立裸 `return block`（无 `3-line` 限定亦属 fail）** 均入 fail-set，现行契约代指（`output contract` / `handoff` / `findings`）与收进 handoff 名域后的 `counters` 单独出现放行；改锚后 `:119`（counters 已锚 handoff）与 `:108`（已删 return block）均不属形状 restate；接线前已知命中面（`:59` + `:119` + `:108`）随同任务清零——checkWording 全文件扫描（非逐行枚举线）是兜底，枚举外形状词在 T4 落线即 fail 并于任务内清零（零放行带病）；T5 降为其余 skills 复核
  - 词表单一事实源：guard 读 `contract-lexicon.json`（不经手写许清单），行为断言与词表同源
- **验收**: `contract-lexicon.json` 五域词表存在且与引擎事实一致（harness 三元组 / status 五元 + 双轴映射（判定轴三态/工作轮 COMPLETED）/ stdout 胶囊 / residue 禁令 / anatomy registry），`dist/resources/contract-lexicon.json` 随 build copy entry 物化存在（dev:stub / build 后）；`ContractLexiconGuard` 四方法全绿（checkAnatomy 等价 digraph-consistency / checkResidue 等价 residue 收集器（词表数据行并入放行集合后等价性与既存回归同绿）/ checkWording 零形状 restate（SKILL.md `:59` / `:119` / `:108` 已同任务零化/改锚，fail-set 粒度按 Do 钉死）/ checkConfig 等价 channel audit）——三先例 test 入口收敛后断言经 guard 同源通过；validate 单 block 下全绿（`pnpm run validate`——守卫 + 词表共存：词表 harness `clis` / residue 禁令表数据行放行、词表非数据域 `cursor-agent` 残留仍 fail，G2 三面零命中成立）；`pnpm run emit:check` fresh（词表 = engine 数据面，非 manifest 产物）；precommit 面绿。
- **注**: 收敛是**行为等价迁移**（断言面不缩水）；P4 收口时 README 家族 + osuperpowers tests 纳入 guard 扫面（P3 不承诺，随 P4 激活）。

### Task 5: C7 消费面措辞 + C4 声明 + 运维文档/CLAUDE.md + changeset + 终验

- **Do**: 消费面同步 + 文档收口 + 终验：
  - `packages/osuperpowers/skills/cli-driven-development/SKILL.md`：`:59` 形状 restate（`3-line return block` / `4th line counters`）、`:119`（Failure Modes TIMEOUT 行 counters 措辞）与 `:108`（I7 dry-run 行裸 `return block` 措辞，T4 已并入已知命中面）已随 T4 checkWording 接线同任务改锚（`:119` 引用点改指 handoff 内 counters，`retry 有界 + terminal` 语义保留；`:108` 裸 `return block` 改锚删除、dry-run 语义保留）——此处复核改锚路由 token（`next:` / `CDD_BLOCKED:` / handoff `findings`）且 `:119` / `:108` 措辞与单胶囊/handoff 契约一致；`:66`（review Read）复核单胶囊语义确认；消费面零引擎形状 restate，不注入程序笔法（iron rule）
  - 其余 orchestrator skills（writing-single/overall/phase-spec / writing-plans / brainstorming / finishing / report-issues）：盘点已证零形状 restate——复核即可，必要时措辞微调
  - `docs/maintainers/`：01-template-doctrine（harness-registry 行键镜像 cursor + pi 参考）· 02-naming-conventions（契约措辞指针 + Contract Lexicon 机制引用）· 03-context-caching-doctrine（Baseline entries 补 pi 行 + 复核零 cursor-agent——行键镜像已随 T2 G2 守卫同落）· 04-program-experience（Contract Lexicon 机制记录）
  - 根 `CLAUDE.md`：`pnpm run emit` / validate 描述随 Contract Lexicon 单 block 更新；engine 调用面（dev:stub / cdd CLI）契约措辞随 C5 单胶囊更新（`cdd review`/`fix` 输出描述）；commit/validate 流程描述不因本 phase 变更
  - `pnpm run emit` 重跑（skill 文本变更后）→ `emit:check` 零漂移
  - C4 空壳声明 + 坐标系分层（R1）：记录面零 harness 字段事实声明已随 overall v1.12 回填——本任务仅确认 ecosystem 无反向引用（issue 渲染 Host 行不动）
  - changeset：建 cdd-engine changeset（cursor rename + pi 行 + 命令契约面 + contract-lexicon.json 数据面变更；类型按 `.changeset/README.md` version scheme 判定）
  - 终验：`pnpm run validate` 全绿（含 Contract Lexicon 单 block / residue G2 / 命名统一 pin）
- **验收**: `cli-driven-development/SKILL.md` 零引擎形状 restate（`3-line return block` / `4th line counters` 类字面量清零），仅锚路由 token；docs/maintainers 全家族与契约面/词表一致、行键镜像零 cursor-agent（G2 三面扫描含 docs/maintainers 零命中）；根 CLAUDE.md emit/validate/engine 契约描述更新；C4 核对：`packages/cdd-engine/templates/report/issue-body.json:202` `masterDef.harnessRow`（`- Harness: <harness>`）字段零改动、Host 行不被引擎行键改写（坐标分层成立）；`pnpm run emit` + `emit:check` 零漂移；changeset 存在（cdd-engine，breaking/patch 按 scheme）；`pnpm run validate` 全块全绿；precommit 面绿。
- **注**: 消费面措辞同步的验收主体 = `ContractLexiconGuard.checkWording`（T4 已接线）——T5 改动后该检查零命中即措辞同步生效；README 家族（`osuperpowers/README.md:72` / `README.zh-CN.md:74`）与 osuperpowers tests 残留面零化归 P4，P3 不承诺。

### Task 6: Workspace 域收编（WorkspaceRoot/Workspace 双类 + 双源灭绝 + lifecycle 归位，用户拍板 2026-09-30）

- **Do**: engine workspace 数据面一次收编（破坏性授权内：重写代码/重组目录/死壳即删）——
  - 新建 `packages/cdd-engine/src/infra/workspace.ts`（OOP，Criterion ② 零裸函数）：
    - `class WorkspaceRoot`：`static from(repoRoot, config)`（从 `ConfigLoader.handoffNamespace().workspaceRoot` 派生——消除 bin.ts:114 / review.ts:85 双源）· `path`（`<repoRoot>/<workspaceRoot>`）· `gitignorePath`（`<root>/.osuperpowers/.gitignore`）· `ensure()`（幂等创建目录 + 写 `"*\n"`——根级 bootstrap 自守卫，不依赖 repo 根 .gitignore）· `for(doc): Workspace`（slug 派生唯一入口，取代 `resolveWorkspace` 纯函数）· `enumerate(): string[]`（读 `<workspaceRoot>/` 子目录——reapStale 全扫用）
    - `class Workspace`：`readonly path`（`<workspaceRoot>/<slug>/`）· `ensure()`（写前 mkdir `{ recursive: true }`，收编 6 处散装 mkdirSync：base-branch.ts:115 / handoff/write.ts:49,64 / naming.ts:209 / runtime.ts:446 / branch.ts:384 / task.ts:643）· `readJson<T>(name): T | null` / `writeJson(name, data): void`（原子 JSON 读写：mkdir + stringify + writeFileSync，progress/handoff/base-branch 收敛）· 子路径唯一事实源：`progressPath` / `briefPath` / `lifecyclePath`
  - **lifecycle 归位 slug**（用户第二条）：`WorkspaceRoot.for(plan)` + `.lifecyclePath` —— `CddRuntime.initProcLifecycle({ diskPath })` 的 diskPath 由 dispatch 上下文（plan → workspace 已知时）注入 `.lifecyclePath`（`<workspaceRoot>/<slug>/lifecycle.json`），不再 repo 级单一文件；`reapStale` 改 `WorkspaceRoot.enumerate()` 枚举全部 slug 的 `lifecycle.json` 全扫（孤儿语义不变：foreign + owner dead；测试钉死等价）。枚举目标进入 `CddRuntime` 的方式显式化：自派生 `WorkspaceRoot.from(repoRoot, config)`（与现有 ConfigLoader namespace 单源同派生，不新增构造注入面）——消灭 `#diskPath` 单一绑定；读-滤-杀-写回全程逐 slug 文件，幸存者写回各自 `Workspace.lifecyclePath`、绝不聚合到单一盘路径，故启动清扫（bin.ts:115）在 `#diskPath` 未绑定时同样成立
  - **双源灭绝**：
    - `bin.ts:114` 启动期 `initProcLifecycle` 的 repo 级单文件绑定 → **删除启动调用**（启动时无 dispatch 上下文、无 plan/slug，此时任何 WorkspaceRoot 派生出的盘路径必为 repo 级单文件——恰为验收所禁）：注册落盘改由 dispatch 上下文注入 `Workspace.lifecyclePath`；bin.ts:115 启动 `reapStale` **保留但改形**（枚举目标走 `WorkspaceRoot.enumerate()`，无 plan 亦成立；`#diskPath` 未绑定时仅逐 slug 读-滤-杀-写回、不落任何单文件）
    - `review.ts:84-85 taskReviewWorkspace`（含 :78-83 随附注释块）→ `WorkspaceRoot.from(...).for(doc)`：注释块现叙事（`handoff-naming.workspaceSlug` / `workspaceRoot` 常量 / `tests/cli-shared.test.mjs` §2.9 row 6）全陈旧——`handoff-naming` 模块随本任务删除、顶层 `tests/` 目录本已退役，随迁改写为 WorkspaceRoot 派生，fork-prevention 回归位指认现行 `infra/__tests__/cli-shared.test.ts:265`（taskReviewWorkspace slug 收敛断言）
    - `naming.ts:193-212 materializeWorkspace` 内 `path.join(repoRoot, workspaceRoot)` → `WorkspaceRoot` 路径
  - **死壳即删**：删除 `naming.ts`——10 项导出逐项归位（workspaceSlug/resolveWorkspace/materializeWorkspace 迁 `Workspace`；handoffName/familyConfig/roundPattern/resolveNextRound/prevHandoffPath 迁 `WorkspaceRoot` 或并入 `Handoff` 类；`workspaceRoot` const 值语义由 `WorkspaceRoot` 经 `NAMESPACE.workspaceRoot` 派生承接、消除字面；`HandoffParams` 接口随函数签名迁移）——转接面以 grep 实测为准（src 非测试 import 面 13；`__tests__` 测试面随 suite 迁移断言同落）· 根 `.gitignore` 第 4 行 `.superpowers`（旧 namespace 残留）退役删除 · 历史遗留 `.superpowers/cdd/lifecycle.json` 已删（不重建）
  - **注入改造**：`ProgressLedger.read/write(progressDir, …)` 方法级 path 参数 → 构造注入 `Workspace`（消灭 string 路径面）· `Handoff` 构造注入 `Workspace`（路径派生收编）· `ReturnBlockParser` 不动（纯文本无路径面——保持隔离）
  - **namespace 单源**：engine-config.json `handoffNamespace.workspaceRoot` 是唯一事实源（ConfigLoader 已单源），workspace 面全程经 `NAMESPACE.workspaceRoot`，零硬编码字面
  - 测试：`workspace.test.ts`（新：from/ensure/gitignore/for/enumerate/readJson/writeJson/lifecyclePath）· progress/handoff/lifecycle.wiring/proc/root/naming 相关 suite 迁移断言（`workspaceRoot` 三元组、`.superpowers` 退役、mkdir 归零）· `lifecycle.proc.test` 验证 reapStale 枚举全扫等价——断言覆盖读-滤-杀-写回全链（逐 slug 独立 lifecycle.json + 幸存者逐文件写回）而非仅孤儿过滤语义
- **验收**: `src/infra/workspace.ts` 含 `WorkspaceRoot`/`Workspace` 全导出、零裸函数；`.osuperpowers/.gitignore`（根级 `*`）自守卫——新 repo 首次 cdd 运行即存在；`lifecycle.json` 落 `<workspaceRoot>/<slug>/` 而非 repo 级（无 `.osuperpowers/cdd/lifecycle.json` 单文件；bin.ts:114 启动 repo 级绑定已删除、启动清扫改枚举形）；`naming.ts` 删除、10 项导出逐项归位 + 转接面（src 非测试 13 + 测试面）全部闭合后零引用（grep 零命中）；6 处散装 `mkdirSync` 归零（`Workspace.ensure()` 单点）；根 `.gitignore` 无 `.superpowers` 行；`pnpm run validate` 全绿（含 workspace 新 suite + lifecycle reap 枚举等价）+ precommit 面绿。
- **注**: 本任务是用户 2026-09-30 拍板追加（bootstrap 第一条 + lifecycle 归位第二条 + 双源灭绝）+ 高维抽象统一复盘（允许破坏性/重写/重组目录/死壳即删）；consume 面同步（`cli-driven-development/SKILL.md` 及运维文档如引用 `.osuperpowers` 路径形态，随 T6 措辞复核——workspace 位置语义不变，仅实现落点收编，skill 面若零路径描述则零改动）。

### Task 7: 崩溃恢复健壮性（HARNESS_ABORT + crash-only snapshot + stash 平面删除，用户拍板 2026-09-30）

- **Do**: engine 崩溃恢复从「stash 状态魔法」归一为「commit 确定性事实」（破坏性授权内：重写/重组/死壳即删）——
  - **失败分类**：`templates/engine-config.json#failureCategories` 增 `HARNESS_ABORT`（`id: HARNESS_ABORT` · `counter: harnessAbortCount` · `returnMarker: harness-abort` · `terminal: BLOCKED: harness-abort-exhausted`，countsTowardConvergence 沿用 channel-audit 逐类独立语义）——`rules/failure.ts` FailureResolver 机械读取（类目声明单源 engine-config）；与 `EXECUTION_FAILURE` 区分：成因外部（harness/模型 403）、可确定性恢复
  - **teardown（孤儿处理，lane 无关）**：run wrapper（implement/review/fix/docs 四 lane 共用一条）检测 child 非零退出 && handoff 未写 → ① 捕获 child stdout/stderr **尾部**（~40 行）② crash-only snapshot ③ Workspace 落 crash record ④ 出 BLOCKED capsule（类别改判 `HARNESS_ABORT`，exit code 语义显式）
  - **crash-only snapshot**：`rules/commit.ts` 增 `commitSnapshot()`——`git add -A && git commit --no-verify`，消息 `chore(cdd-engine): crash-only snapshot — <lane> abort (exit <n>)`；树无变化则 no-op；复用现有 git 管线、**一个 commit 动词两处调用**（exit gate + crash teardown）；`--no-verify` 唯一正当理由 = 崩溃瞬间树可能语法半成品（biome 会拒收），快照是恢复点非验收面，质量门禁在 resume 后 exit gate + review + merge——理由落注释
  - **crash record**：`Workspace` 增 `crashPath(lane, round)` 子路径（round 由 teardown 的 dispatch 上下文 round 传入——两参钉定 round 化文件名，方法签名与落盘文件名一致）+ 经现有 `writeJson` 落 `.osuperpowers/cdd/<slug>/crash-<lane>-<round>.json`：`{exitCode, stderrTail[], stdoutTail[], snapshotSha, attemptedHandoff, next}`（与 lifecycle/handoff/base-branch 同族）
  - **next 路由**：`rules/next-step.ts` NextStepRouter 决策表增行——`status ∈ {BLOCKED} + crashRecord 在场 → next: <同命令 resume>`（Inputs 增 `recovery?` = 读 crash record 派生：snapshotSha + resumeCommand——handoff `recovery` 载体随 stash 平面删除，决策源必为 crash record 而非 carrier）；模糊失败（无 crash record）保持无 `next:`；C5-1 决策表注释 + `next-step.test.ts` 钉新行
  - **stash 平面删除（死壳即删，按命名面逐一枚举）**——apply 侧与保留侧各归其位、按字面可定位：
  - apply 侧 = implement 重派 pre-flight（dispatch/task.ts:608-640 `resumeFromResidue` 块，含 :613 注释面与 :639 `CDD_WARN: residue stash apply failed` 字面）
  - 保留侧单列为独立删除面 = dispatch/base.ts settleResidue 模板步骤（:139/:365，含 :362 注释）+ residue.ts:298 `preserveAndAnnounceResidue`——T7 后工作区残骸不再经 stash 保全、诊断改由 crash record 承接
  - `recovery.residue_ref` persist 随载体整体删除（见下 schema 定案）· `artifacts/residue.ts` 的 stash 部分 · 相关测试删改
  - 命名面全枚举：infra/git.ts `stashPush`/`stashApply`/`stashMessage`（:142/:154 起，camelCase 方法族）· dispatch/branch.ts:231-241 stash-workflow 注释与 recovery 载体写（`git stash list` / salvage or discard 措辞）· render/brief.ts:84 resume-brief stash 分支（applied a salvaged stash）· templates/schema/{task,docs}-handoff-schema.json 的 `recovery` 载体——**整体删除定案**：crash record（exitCode/stderrTail/stdoutTail/snapshotSha/attemptedHandoff/next）承接诊断与 snapshotSha 后 `recovery` 载体冗余（cause/exit_code 并入顶层机制字段，residue_ref/stash_message/residue_scope/wip_stat/preserved 随载体现），两 schema 文件同步删、next 决策行必读 crash record · docs/maintainers/04-program-experience.md:63 教训 #42（stash 契约 canonical token / `stash@{N}` / re-stashing）· SKILL/residue 措辞全清——恢复原语归一 commit ledger、编排器零分支记忆
  - **话术同步**：`cli-driven-development/SKILL.md` 各 failure 面（implement-group/run-group-review/fix-group/branch-review）收一句：「harness 异常退出 → 工作区存 crash-only snapshot + crash record；按 BLOCKED `next:` 原命令重跑即续作（不重做、不丢残骸）」；**engine 内 blocker/supplement 话术面同步**（dispatch/docs.ts:261 / rules/failure.ts:154——原 stash 恢复句（`git stash list/apply/drop` + salvage or discard 引导）改 crash-record 句「按 BLOCKED `next:` 原命令重跑即续作」，task.ts 预飞注释面已属 apply 侧删除面（见上））+ `docs/maintainers` + 根 `CLAUDE.md` failure-mode 面同步 + 本 403 事故教训登记（stash 跨分支误命中为根因）
  - 测试：engine-config 类目身份（HARNESS_ABORT 新增 + 计数独立）· next-step crash-record 新行（`recovery?` 输入槽读 crash record 派生）· commitSnapshot（树干净 no-op / `--no-verify` 语义）· crash record 写盘（`Workspace.crashPath(lane, round)`）· teardown 集成（模拟 child exit 1 无 handoff → tail 保留 + snapshot + record + BLOCKED capsule 带 next:）· 原 stash-residue 测试删改
- **验收**: `failureCategories` 含 `HARNESS_ABORT`（harnessAbortCount / harness-abort / `BLOCKED: harness-abort-exhausted`）；child 异常退出（无 handoff）→ child stdout/stderr 尾部保留 + crash-only snapshot commit + crash record 落 `Workspace.crashPath(lane, round)`（字段齐：exitCode/stderrTail/stdoutTail/snapshotSha/attemptedHandoff/next）+ BLOCKED capsule `status: BLOCKED · … · next: <同命令 resume>`；`NextStepRouter` 决策表含 crash-record 行（next-step.test 钉死）；**stash 平面零残留**——按命名面逐一闭合（apply 侧 / 保留侧 / camelCase 方法族 / 注释措辞 / JSON 属性键 / 教训条目 / 话术面，Do 枚举即边界），字面 grep（短语 / camelCase / JSON 键）降为兜底扫描而非边界：`stash apply` · `stashApply` · `stashPush` · `stashMessage` · `recovery.residue_ref` · 「git stash drop」 · `stash_message` · `residue_scope` · `wip_stat` · `preserved` 零命中（engine src/tests + templates/schema + skills + maintainers + CLAUDE.md）；`pnpm run validate` 全绿（含 channel-audit harnessAbortCount 计数）+ precommit 面绿。
- **注**: 用户 2026-09-30 拍板（403 事故复盘五缺陷 → 崩溃恢复归一设计）；`--no-verify` 是唯一「看似破纪律、实为必要」例外（理由见 design v1.4 §2.2）；本任务含空壳/死代码即删（stash 平面整体）；收敛法自洽——快照 commit 移动 BASE..HEAD ref，re-review 新 ref = 新 review（I3），快照零特权。
