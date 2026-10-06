# osuperpowers 架构重构 P6 实施计划 — 统一规划收口（收敛程序）

**Spec:** [2026-09-13-osuperpowers-overhaul-p6-design.md](docs/kairos/specs/2026-09-13-osuperpowers-overhaul-p6-design.md)

- **Parent program**: [2026-09-13-osuperpowers-overhaul-overall.md v1.58](../specs/2026-09-13-osuperpowers-overhaul-overall.md)
- **Depends on**: P5 shipped（report-issues 改名 + engine 生命周期重建 + TS 化，PR #263 已 merge，2026-09-18）；P1–P4 shipped（hard 链完整）
- **Base**: develop（finishing read-base 的数据源）

- **Interface 转录注记**: 各任务 `- **Consumes**: 刻意留空（树迁移 B 转录决策）——源 Do 散文未承载独立具名输入事实，consumes（Task 记录 interface 可选项）不填充；任务输入由 DependsOn/AtomicWith 声明边与 objective/steps 承载，consumer-parity p1–p4.1 因承接具名输入事实而全量填充。

## Constraints
### 口径

- P6 是**终局收口 phase**，承载 §2.0 收敛论点——**每一项删除面有残留守卫、每一项收敛面有机械断言、每一项纪律有执法位（零纸面宣称）**。七域执行（A 能力宣称收缩 · B vendors 全撤 · C 测试就近+M1–M7 · D 模板系统化+C1–C7+双平面 · E 流程原子性+cdd 六缺口+stall · F 收口复核 F1–F8 · G 自省四修 G1–G4）。**诚实边界**：cache 验收为 dev 侧实测（CI 无 harness 不 gate）；术语改名（Review Convergence）历史 changelog/spec-plan 豁免。所有改动 `pnpm run validate` 全绿 + `emit:check` 无 drift。

### v1.2 回填（overall v1.45 / spec v1.8 同窗，用户 2026-09-18 TTL-free 升维指示）

- 新增 **Task 20「模板系统化终态（C1-max 字节布局层）」**——统一壳 + 槽级三段制（`壳 → Return → Round context 绝对末尾`）+ 渲染数据平面单文件（四 `.md` 并入 template-contract.json `sections`，`.md` 删除/派生）+ token `zone` 归属 + C4 升格（壳=无参常数）+ 门面去路径化 + `WORKSPACE_SLUG`（plan/spec 收敛）。**编号说明**：engine brief 提取为 `/^### Task \d+:/`（整数契约），不采用小数主号——Task 20 为追加号，**实施时序位于 T8 之后、T9 之前**（T8 三断言先立 → C1-max 落终态布局 → T9/T12/T18 直接落终态，零二次改动）。

### v1.3 回填（overall v1.46 / spec v1.9 同窗，用户 2026-09-19 指示）

- 新增 **Task 21「scripts/ 与 cdd-engine 统一 CLI 框架 + 测试就近 `__tests__` 化」**——scripts/run.ts 弃 Commander 改 citty（engine 同款）+ observe-cache.ts 手写 parseArgs 归 citty argsDef（boolean presence 语义保留）+ 退出码 table 对齐 engine（P5 §2.4.2）+ commander 根 devDep 移除 + citty 入根 devDeps；scripts 测试全迁 `__tests__/`（<dir>/__tests__/ + 顶层 scripts/__tests__/）+ root vitest include 收敛 `scripts/**/__tests__/**/*.test.ts`（T3 内存守卫不变）。

### v1.4 回填（overall v1.47 / spec v1.10 同窗，用户 2026-09-19 指示）

- 新增 **Task 22「plan-constraints 物料化契约」**（`cdd implement` pre-flight 自本 plan 声明源生成 plan-constraints.md（惜缺即生成 · 存在性门缺失/不可解均 BLOCK · dry-run 豁免）。**Constraints 源（两形态）**：canonical = 字面 `## Constraints` 一等段（由 writing-plans 模板强制——未来 plan 天然带段）；既有散文 plan = 声明指针提取面（本 plan v1.4 现状）：**口径** · **commit 边界机制** · **Flow Atomicity** · **顺序原则** 四标题锚切片；四段收敛为字面 `## Constraints` 段（段内四小节）原定 T22 实施；T22 收尾时该收敛**记录为延期项**——本 plan 现行为散文指针声明源（materializer 以 Form B 提取四段，契约先行、本 plan 提取精确），收敛动作（四段整并入字面 `## Constraints` 一等段 + 段内四小节化）留待后续 plan-doc round 执行，届时 materializer 自动改读 Form A）；**Task 18 扩段（H1 内容级三件）**——prompt bullet ×2 + src 标识符/阶段标题 rename + `\bH1\b` residue 机制面守卫。

### v1.5 回填（overall v1.48 / spec v1.11 同窗，用户 2026-09-19 终审实证指示）

- 新增 **Task 23「lifecycle 状态正交化 + H1 名称语义化」**（P6 终审实时 = T14 review 现场：`unverifiable` 被 `deriveReviewStatus` 裸折 `BLOCKED` 且不写 `failure_category`/`blocker` → `h1FromHandoff#defaultBlockerFor` 兜底伪造 gate 文案 + exit 0 自相矛盾，编排路由被带回重评歧路）。**修复语义（三面正交）**：`status`（本轮结论）· `failure_category`（失败机制通道：TIMEOUT/CONTRACT_VIOLATION/ENGINE_SELF_WRITTEN/EXECUTION_FAILURE/UNVERIFIABLE/PLAN_CONFLICT）· `unverifiable[]`/`plan_conflicts[]`（内容级附注）不再折叠混淆；**契约写入 schema field description**（schema 经 `renderHandoffSchemaJson` 原样注入 prompt——prompt 零散文、prompt/schema 永不掉线）；真·unverifiable → BLOCKED + `failure_category=UNVERIFIABLE` + 真实 blocker（未验什么/为什么）→ 编排者上报用户仲裁（skill failure-modes UNVERIFIABLE 条目生效）；plan-constraints §口径 dev-measured 验收项按 evidence-contract accepted-noted 不复位评审；**BLOCKED（任何通道）→ exit 1**（APPROVED/CHANGES_REQUESTED → 0——T14 现场 exit 0+BLOCKED 反转为红→绿）；`defaultBlockerFor` 伪造杀手（写位留真）；schema `allOf` 强制「BLOCKED ⇒ blocker 非空 or failure_category 存在」+ H1 永不伪造 gate 文案断言；**H1 无语义命名并入本 Task（T18⑤ 上移）**——src 标识符 `h1*`→`return*`（returnFourLines/returnFromHandoff/returnCountersLine/artifactsFromReturnLine/implementStatusFromReturnLine）+ 阶段标题「H1 four-line parse」→「return block parse」+ `\bH1\b` 入 residue 机制面守卫（零豁免）——拒绝「先命名后语义」的两阶段残留（与状态正交化同命中 h1FromHandoff/H1 呈现层）。

### v1.6 回填（overall v1.50 / spec v1.12 同窗，用户 2026-09-20 编排实证授权）

- 新增 **Task 24「执行层 WIP 保全合同」**（两次大型派发中途死亡实证：T23 implement attempt-1 exit 1 · branch-fix exit 143 SIGTERM——branch-fix 修 1 条 CJK warn 漂 15 引擎文件 +179/−169，confirmed-scope 溃坝）。**三个结构性缺口**：① 死亡即全损（未提交=非产物对，但「非提交」≠「必然销毁」——缺保全/可抢救路径）② fix findings-scope 无锁（T11 pending-acceptance 已锁 plan 侧、代码侧无执法位）③ 死亡诊断不足（blocker 仅「exited N」，无 WIP 规模/死因/产物线索）。**修复三件**：WIP 保全（非 exit-0+树脏 → engine 自动 `git stash push -u` + BLOCKED blocker 带 stash ref/规模，可 apply 评审/抢救/丢弃）· findings-scope lock（fix 注入 findings 文件集 + finalize diff 越界 BLOCK）· 死亡诊断三件（exit code + WIP 快照 ref + 规模 + 死因线索）。定序 = plan T19 之后、branch-fix 重派之前（scope-lock 生效前重派同 findings 会反复漂移）。

### v1.7 回填（overall v1.51 / spec v1.13 同窗，用户 2026-09-20 全面复盘授权）

- **Task 24 重写为「派发岛收敛 + 机制上链 + 错误收编」**——全面复盘（依赖矩阵 + 手查双证据）确认 DispatchLifecycle 抽象只覆盖半壁：task/docs 两岛继承，**branch 族 = 第三个手写实现岛**（未继承 Lifecycle，全套手写 round/Convergence/BLOCKED/schema/finalize/exit——T14 liveness / T23 carrier / 残局三代修复全碰不到它 = T23/branch-fix 143 事故的架构根因）；rules⇄artifacts 纠缠带（schema⇄finalize / failure⇄progress 两直接循环 + 六互引边）；Convergence 三定义、writeBlocked 四派、workspace 双处、return-block 四处半、手动 throw 47 处。六阶段收敛：**A 岛收编**（BranchLifecycle extends DispatchLifecycle）· **B 纠缠拆解**（status 推导族归 finalize、计数器族归 failure 单点、schema 只校验）· **C 机制单点**（Convergence / writeBlocked / workspace / return-block / hashFile）· **D 死代码清理**（convergence 孤岛 0 入度 / infra/log 零消费 / review 死 import）· **E 载体成熟（分 Task 25）**（settleResidue / writeBoundary / recovery carrier 入模板方法）· **F 错误收编**（全部手动 throw 归 exit.ts：面向编排者可恢复错误 → CddExitError 家族【exitCode+kind，bin 统一落码】；库内断言 → invariant() 工厂）· **G 架构纪律回写运维文档**（分层 / 机制锚点 / 错误收编三纪律）。新增 **Task 25「载体成熟」**（E 阶段：settleResidue / writeBoundary / recovery carrier 落地——原 Task 24 三件套基于收编后的 Lifecycle 重设计）。

### v1.8 回填（overall v1.52 / spec v1.14 同窗，用户 2026-09-20 T25 TIMEOUT 实证 + 统一抽象授权）

- 新增 **Task 26「派发终止契约 + 续传」**——timeout（预算）与 liveness（活性）= 同一终止判据的两信号被拆成两套实现（同一 TIMEOUT 语义、两条判定路径），并为一个 `termination monitor`（spawnManaged 挂点）：信号① stall（活性 primary，CPU+workspace mtime idleWindow 无推进）· 信号② budget（last-resort cap，墙钟 elapsed——liveness 失效面 + 活跃永不完成的唯一防线）→ killGroup + TIMEOUT + cause 化 blocker（stalled/over-budget/SIGTERM）；**删除面**：三 env 键（CDD_TASK/REVIEW/CLI_TIMEOUT）· config perModeOverride/globalOverride 两段 · execa timeout/forceKillAfterDelay 通道 · resolver 并一 · 三岛两参并一参；**保留**：idleWindow 15min · budget cap（task 3h【180min，T25/T26 双 TIMEOUT 实证后 canon，v1.11】/review 60min 重定位为 cap）· TIMEOUT 分类/blocker 单点/退出码表 0/1/2/3；**resume-from-residue（续传，T25 实证缺陷修复）**——T25 TIMEOUT 后 stash 保全 727 行但不落回 → 重派从零 → 90min token 全烧（termination 是单向闸缺对称续传）；re-dispatch pre-flight 读上轮 recovery.residue_ref → git stash apply 恢复 WIP → brief 附「residue 现状附言」（render/brief.ts 读 recovery carrier）→ 新 agent 审计续作而非重写；**接口契约**：T25 settleResidue 输出（recovery.residue_ref + stash 命名）≡ T26 resume 输入；termination = 终止→保全→续传完整闭环。

### v1.9 回填（overall v1.53 / spec v1.15 同窗，用户 2026-09-20 验收缺陷记录）

- **T26 resume legacy 检索兜底**——T25 首轮 TIMEOUT 保全发生在 settleResidue 落地前（编排者手工 stash，`recovery.residue_ref` 未写入 handoff——schema 无此字段）= resume schema 驱动路径对历史 handoff 失效（真实验收盲区）；T26 resume 增补兜底：`recovery.residue_ref` 缺失时按标准化 stash message（`cdd-<op>-<type>-<task>-<round>-<cause>`）扫描 `git stash list` 匹配恢复；T25 settleResidue 机械保全用同格式 message——新轮走 schema 主路径、历史轮走检索兜底，同一续传语义；T25 重派推迟至 T26 落地后 = resume 首个真实黑盒实证（从 stash@{0} 727 行续传而非 0 重写）。

### v1.10 回填（overall v1.54 / spec v1.16 同窗，用户 2026-09-20 T26 恢复轮 base==head 实证 + 统一抽象授权）

- 新增 **Task 27「任务级 scope 账本（roundBase/scopeBase 分离）」**——T26 恢复轮（交付物 ea5d8433+3063e274 在 TIMEOUT 下先行提交 → re-dispatch TASK_BASE=HEAD → carrier `commits.base==head==3063e274`）使 review 固定点推导链（`prev.commits.base → TASK_FIXED_POINT → REVIEW_REFERENCE=${TASK_FIXED_POINT}..HEAD`）塌缩空范围 = 真实交付物（`bde88ec5..HEAD`，29 文件 +1445/−435）零审查关闭的实证缺陷；统一抽象：`base` 一名两义拆分（roundBase=本轮 commit 座位每轮快照 · scopeBase=task 贡献真实起点须跨轮稳定穿越轮死亡）+ progress 账本 `tasks[N].scope_base`（引擎自有、earliest-wins）+ 恢复轮 return-block 声明 base 采纳（base==head 信号 + 祖先校验 + fresh 永不采纳） + review/fix 固定点读账本（legacy 回落）+ settleResidue 记 `recovery.scope_base`；T26 恢复轮 #2（声明 base=bde88ec5）→ 全范围 review 依赖本 Task 落地。

### v1.11 回填（overall v1.55 / spec v1.17 同窗）

- **task 预算 3h canon 化修正**——T26 fix-1 将 review finding（3063e274 预算变更缺 frozen 文档回填）方向读反：回退 engine-config 至 90min；按用户裁决恢复 `defaults.task`=10_800_000（T25/T26 双 TIMEOUT 实证）+ 5 断言同步 + Task 26 Do budget 表述 90min→3h；其余 7 finding 处理不变。

### v1.12 回填（overall v1.56 / spec v1.18 同窗）

- 新增 **Task 28「residue save 侧单点收敛」**——T25 resume 续作把 T24 前草稿 rules/residue.ts 接入为 save side，与 T26 shipped artifacts/residue.ts 同机制双 owner（双 stash-message 契约 + 双 git helper + task 车道与模板钩子同轮双 stash）；收敛 save 全族归 artifacts 单 owner（preserved 幂等 + settleFromCarrier adapter + 统一标准化 message），删 rules 副本 + gitStashPreserve + 死 helper；write-boundary 为新物保留。

### v1.13 回填（overall v1.58 / spec v1.19 同窗）

- 新增 **Task 29「引擎 lifecycle 统一校验」**——closeout 三轮复盘定稿（用户 2026-09-21）：核心在引擎、注入 lifecycle、零子命令；DispatchLifecycle 增两钩子（docContractValidate 物料格式校验 → blocked exit+guidance · statusValidate 六态状态机 + 计划裁决 → CDD_INFO）；零 CLI 面/零文档写入/零 schema 变更。

### v1.14 回填（overall v1.59 / spec v1.20 同窗）

- 新增 **Task 30「TaskState 单源统一 + 状态判定修正」**——T29 首个 statusValidate 裁决暴露双缺陷：判定优先级错位（合法终局误判 needs-re-review）+ TaskState 双源（progress 存储 status vs 六态派生）；统一 = 状态纯派生账本只存事实（deriveTaskState 唯一实现 + progress tasks[N].status 删除 + 消费迁移）。

### v1.15 回填（overall v1.60 / spec v1.21 同窗）

- 新增 **Task 31「src 注释锚首清零执法」**——§35 第二半无执法位 → residue 守卫扩展「src 注释禁锚首」+ 引擎 67 处注释语义前置排修。

### commit 边界机制（本 program 全 phase 生效）

- dispatch 两端门——入口门（进入 review 前主 agent 产物已提交、dispatch 期零写树）+ 出口门（产生修改的 dispatch 后修改已提交）；主 agent 处理的由主 agent commit。计划各 Task 的 review/fix 环均遵守。

### Flow Atomicity（本 phase 强化）

- 任何 skill 内部流程/文档变更 = 整 skill 统一调整（无局部补丁）；cli-driven-development 的全部 P6 描写（branch-loop / dry-run WARN / pending-acceptance / 术语）在 Task 9 一次性整 skill 改齐。

### 顺序原则（spec §2.4）

- 删除面先行（T1 A → T2 B）→ 目标布局落地（T3 测试就近 + T4 scripts .ts）→ 机制增量落新布局（T5–T14）→ **域 G 与 D-2 同窗（随 T1 .agents 移除后：T7/T15–T17 均在 T1 之后）** → 收口复核（T18 术语 · T19）；**C1-max（Task 20）定序 = T8 之后、T9 之前**（spec §2.4 顺序注：晚于 T5 骨架、早于 T7——branch-loop/clauses 入库/术语清扫直接落终态；T8 三断言先立使模板变更受其约束）。**scripts 统一（Task 21）定序 = C1-max（Task 20）之后、收口复核（T18 术语 · T19）之前**（repo 一致性收尾；engine 与 scripts 测试/CLI 惯例同批收敛）。；**constraints 物料化（Task 22）定序 = T10（dry-run 门判 WARN 化）之后、T11 之前**（同为 implement pre-flight 门面——先 WARN 化再上 constraints 存在性门；本 plan 的 Constraints 源 = 口径/commit 边界机制/Flow Atomicity/顺序原则 四段声明面）。**lifecycle 状态正交化（Task 23）定序 = T14（stall 探测器，实证源）fix 收口之后、T18（术语清扫）之前**——实证驱动的终审项（unverifiable→BLOCKED 通道混淆现场），紧邻收口复核保持终态语义直达；T18⑤（H1 内容级 rename）随之上移 Task 23，T18⑤ 条目降级为 Audit（T23 产物零回退确认）。**派发岛收敛（Task 24）定序 = T19（收口复核）之后、T25 之前**——收口后编排侧重构项（T23/branch-fix 143 事故架构根因）：branch 岛收编（A）→ 纠缠拆解（B）→ 机制单点（C）→ 死代码清理（D）→ 错误收编（F）→ 运维文档（G），每阶段 validate 全绿推进；T11/T12 同族互补：plan 修改权锁已落（T11）、纪律条款已落（T12）、本 Task 补机制上链 + 错误收编两执法位。**载体成熟（Task 25）定序 = Task 24 之后**——branch 岛收编完成、机制单点就位后，settleResidue/writeBoundary/recovery carrier 才有统一挂点（原 Task 24 WIP 保全三件套并入本 Task E 阶段）。**派发终止契约 + 续传（Task 26）定序 = Task 25 之后**——settleResidue/recovery carrier 是 resume 的输入契约（T25 输出 ≡ T26 输入，衔接面 spec T7.5 钉死）；本 Task 实证源 = T25 TIMEOUT（70min 后 stash 727 行但不落回 → 重派从零 → token 白烧）。**执行层 WIP 保全合同（Task 24）定序 = T19（收口复核）之后、branch-fix 重派之前**——2026-09-20 编排实证（T23 attempt-1 exit 1 · branch-fix exit 143 SIGTERM 15 文件 scope 漂移）；findings-scope lock 生效前重派 branch-fix 会让同一 findings 反复驱动 agent 漂移，故本 Task 先落地再重派；与 T11（pending-acceptance 收编权）同族——plan 侧锁已落，本 Task 补代码侧锁。**任务级 scope 账本（Task 27）定序 = Task 26 之后（T26 恢复轮 #2 重派之前）**——T26 恢复轮 base==head 使 review 范围塌缩 = T26 恢复机制的自身生命周期缺口（settleResidue/resume 只快照轮、无任务级 scope 概念）；本 Task 落地后 T26 恢复轮 #2（声明 base=bde88ec5）→ 全范围 review → 关闭；T25 重派（混合味：部分提交 + WIP）同样受益。

### Task 1: 能力宣称收缩（spec 域 A，A1–A8）

- **Objective**: 能力宣称收缩（spec 域 A，A1–A8）：README/zh/CLAUDE.md 去 8-harness + pi 死字段删 + `.agents/` emit 面移除
- **DependsOn**: none
- **AtomicWith**: none

- **Produces**: README/zh/CLAUDE.md 零「8 harness」宣称、零 gate-install 死引用；keywords 零 droid/pi；`.agents/` 零跟踪零产出零引用；CLAUDE.md 派生提示改写；emit:check 无 drift

- **Files**: README.md, README.zh-CN.md, CLAUDE.md, packages/osuperpowers/package.json, scripts/emit/（emitAgentsSkillsCopy 删除面）, packages/osuperpowers/.agents/（git rm 14 文件）

- **Steps**:
  1. ① README.md / README.zh-CN.md / CLAUDE.md 去 8-harness 表述（保留 claude/cursor-agent 证实面 + 中性「多 harness 可消费」）；README.zh-CN 陈旧面清理（`docs/gate-install.md` 死引用 · Trae/Vibe/Kiro/OpenCode/init-harness 模式）；② `oscaner-plugin.claude.keywords` 去 droid/pi + **`package.json#pi` 死 manifest 字段删除**；③ manifests.mjs 注释清理 — checkable: README/zh/CLAUDE.md 零「8 harness」宣称、零 `gate-install` 死引用；`keywords` 零 droid/pi、package.json 零 `#pi` 字段
  2. ④ **`.agents/` emit 面移除**：`emitAgentsSkillsCopy` 删除 + orchestrate prune/compare 路径删除 + **`git rm` 14 tracked 文件（实测含 .keep）** + emit.test 用例同步；⑤ 根 CLAUDE.md「`.agents/` is derived」派生提示改写为面向剩余 emit 产物集合（.claude-plugin / .cursor-plugin / marketplace / ISSUE_TEMPLATE）；⑥ harness-registry 精简审计复核 — checkable: `packages/osuperpowers/.agents/` git **零跟踪**、emit 零产出、src/emit 代码零 `emitAgentsSkillsCopy`/`pruneStaleAgentsNamespaces` 引用；CLAUDE.md 零「`.agents/` is derived」
  3. ⑦ `pnpm run emit` 后 `emit:check` drift=0；`pnpm run validate` 相关块全绿 — checkable: `pnpm run emit:check` 无 drift；`pnpm run validate` 相关块全绿（注：本 Task 是其他 emit 相关任务的**前置**——T7 D-2 / T15 G1 免 emit 往返）

- **Acceptance**:
  - README/zh/CLAUDE.md 零「8 harness」宣称、零 `gate-install` 死引用；`keywords` 零 droid/pi、package.json 零 `#pi` 字段；`packages/osuperpowers/.agents/` git **零跟踪**、emit 零产出、src/emit 代码零 `emitAgentsSkillsCopy`/`pruneStaleAgentsNamespaces` 引用；CLAUDE.md 零「`.agents/` is derived」派生提示；`pnpm run emit:check` 无 drift；`pnpm run validate` 相关块全绿


### Task 2: vendors 自维护面全撤（spec 域 B，B1–B12）

- **Objective**: vendors 自维护面全撤（spec 域 B，B1–B12）：submodule 相关删净 + submodule 本体撤离 + 语汇守卫
- **DependsOn**: none
- **AtomicWith**: none

- **Produces**: 零 submodule-sync/bump 配置 · zero publish-vendor · validate 12 块 · `.gitmodules` 零条目 + `vendors/` 不存在 · marketplace/vendor 零条目 · version-sync 零 resolveVendorVersion · 守卫零命中

- **Files**: .github/workflows/submodule-sync.yml, .github/workflows/submodule-bump.yml, .github/workflows/release.yml, scripts/validate/submodule.mjs, scripts/release/publish-vendor*, .gitmodules, vendors/（三目录）, marketplace/source.json, scripts/validate/other related

- **Steps**:
  1. ① 删 `.github/workflows/submodule-sync.yml` + `submodule-bump.yml`；② release.yml `publish-vendor` 步骤删（含关联引用）；③ 删 `scripts/validate/submodule.mjs` + run.mjs validate 块（**13→12 块**）；④ pr-validate/release checkout `submodules: recursive` 撤空；⑤ 删 `scripts/release/publish-vendor*` + submodule-tags.test.mjs + bump-submodule 子命令 — checkable: 零 `submodule-sync.yml`/`submodule-bump.yml` 配置 · zero release `publish-vendor` 步 · validate **12 块** · checkout 零 `submodules: recursive`
  2. ⑥ **submodule 本体撤离**：`git submodule deinit -f --all` → 删 `.gitmodules` 三条 + `vendors/` 三目录 → `git add .gitmodules`；⑦ marketplace/source.json 三 vendor 条目删 + re-emit；⑧ version-sync superpowers 检查删（resolveVendorVersion 消解 flake）；⑨ marketplace-utils vendor 派生删 + emit 路径清理 + data-driven-templates assembly 引用更新 — checkable: `.gitmodules` 零条目 + `vendors/` 目录不存在；marketplace/source.json 与 emit 产物零 vendor 条目；version-sync 零 `resolveVendorVersion`/superpowers 检查
  3. ⑩ CLAUDE.md「Vendored submodules」章节删；⑪ README/zh 改指上游（三个官方安装命令引用保留 + 标上游出处）；⑫ stale-lexicon/residue 增 `vendors/`·`publish-vendor`·`submodule` 语汇守卫 — checkable: 防回渗守卫零命中；`pnpm run validate` 12 块全绿（块数断言）（注：顺序先删引用再拆 submodule（防孤儿引用）；B6 不触碰 submodule 内容本体——撤离 ≠ 修改）

- **Acceptance**:
  - 零 `submodule-sync.yml`/`submodule-bump.yml` 配置 · zero release `publish-vendor` 步 · validate **12 块** · checkout 零 `submodules: recursive` · 零 `publish-vendor`（代码/workflow/步/子命令）· `.gitmodules` 零条目 + `vendors/` 目录不存在 · marketplace/source.json 与 emit 产物零 vendor 条目 · version-sync 零 `resolveVendorVersion`/superpowers 检查 · 防回渗守卫零命中；`pnpm run validate` 12 块全绿（块数断言）


### Task 3: cdd-engine 测试就近迁移 + tests/ 退役 + 内存守卫复核（spec 域 C，M1–M7）

- **Objective**: cdd-engine 测试就近迁移 + tests/ 退役 + 内存守卫复核（spec 域 C，M1–M7）
- **DependsOn**: none
- **AtomicWith**: none

- **Produces**: tests/ 拓扑全量就近迁移（53 文件 = 48 测试 + helpers + fixtures）；helpers → infra/__tests__/helpers.ts；vitest include 收敛 `src/**/__tests__/**/*.test.ts`；`.mjs` 终态断言（src 恒真 0 · tests 0）；内存守卫复核；运维文档同步

- **Files**: packages/cdd-engine/tests/（→ src/**/__tests__/ 全量迁移）, packages/cdd-engine/src/infra/__tests__/helpers.ts, packages/cdd-engine/vitest.config.mjs, docs/maintainers/（运维文档同步）

- **Steps**:
  1. ① **tests/ 拓扑全集就近迁移**（**实测 53 文件 = 48 测试节点【30 `.mjs` + 18 `.ts`】+ helpers.mjs + fixtures 多文件**）：infra.* → src/infra/__tests__/ · dispatch.* → src/dispatch/__tests__/ · rules.* → src/rules/__tests__/ · 其余按被测源就近；② helpers → src/infra/__tests__/helpers.ts；③ vi.mock 路径随迁改指就近 `.ts` — checkable: `git status` 零 `tests/` 残留（退役）；engine suite 全绿（迁移为纯搬移零行为变化——迁移护栏）；vitest include 收敛后套件仍全量发现
  2. ④ vitest include 收敛 `['src/**/__tests__/**/*.test.ts']`、`tests/` 目录退役；⑤ **`.mjs` 终态断言**（src 恒真 0 `.mjs` + tests 0 `.mjs`【32→0】）；⑥ 内存守卫复核（`maxWorkers=1 + fileParallelism=false + maxConcurrency=2` 双 config 固化 + 断言） — checkable: residue/结构守卫断言 src 恒真 0 `.mjs` + tests 0 `.mjs` 通过；内存守卫配置断言就位
  3. ⑦ 运维文档同步（vitest include / tests 退役 / data-driven-templates exemplars 测试路径 / skill-authoring 测试命名段 / third-party-deps .mjs 平面 / CLAUDE.md dev 段） — checkable: 文档引用零陈旧（注：迁移先行（land-first）——后续机制 Task 的新测试直接落新布局；`rules/stopping.test.ts` 随批迁至 src/rules/__tests__/（T18 术语批 rename））

- **Acceptance**:
  - `git status` 零 `tests/` 残留（退役）；engine suite 全绿（迁移为纯搬移零行为变化——迁移护栏）；vitest include 收敛后套件仍全量发现；residue/结构守卫断言 src 恒真 0 `.mjs` + tests 0 `.mjs` 通过；内存守卫配置断言（maxWorkers=1/fileParallelism=false/maxConcurrency=2）就位；文档引用零陈旧


### Task 4: repo `scripts/` 编排层全量 `.ts` 化（spec 域 C/Q2-B）

- **Objective**: repo `scripts/` 编排层全量 `.ts` 化（spec 域 C/Q2-B）：44 个 .mjs → .ts + 显式 .ts 扩展导入
- **DependsOn**: none
- **AtomicWith**: none

- **Produces**: `scripts/{emit,validate,lib,release,rulesets,run}.mjs`（44 个）→ `.ts`；`node scripts/run.ts validate` 直跑（原生 strip）；CI 调用名随迁；scripts 面 `.mjs` 44→0

- **Files**: scripts/（44 个 .mjs → .ts）, .github/workflows/pr-validate.yml, .github/workflows/release.yml

- **Steps**:
  1. `scripts/{emit,validate,lib,release,rulesets,run}.mjs`（44 个）→ `.ts`：rename + **显式 `.ts` 扩展导入**（Node 24 原生 type-stripping惯例，与 cdd-engine src 同法）+ 最小类型标注（ERASABLE 语法保证） — checkable: `node scripts/run.ts validate` 12 块全绿（type-stripping 直跑零 loader）；`scripts/` 编排层 `.mjs` **44→0**（零残留，留存例外为零且理由零）
  2. CI 三处调用名随迁（pr-validate `node scripts/run.ts smoke-cdd` · release `node scripts/run.ts version` 等）；vitest include 随迁 `.test.ts` — checkable: CI workflow 调用名全部改指 `.ts`；`pnpm run validate` + `emit:check` 全绿（注：编排层非发布面（消费者无 scripts/）；`osuperpowers/scripts/` 两个 `.mjs` 不在此 Task 范围（Q1-A 保留面））

- **Acceptance**:
  - `node scripts/run.ts validate` 12 块全绿（type-stripping 直跑零 loader）；`scripts/` 编排层 `.mjs` **44→0**（零残留，留存例外为零且理由零）；CI workflow 调用名全部改指 `.ts`；`pnpm run validate` + `emit:check` 全绿


### Task 5: 模板系统化第一平面（engine 提示词：骨架/条款/token/JSON 归并/rename/两段制）

- **Objective**: 模板系统化第一平面（engine 提示词：骨架/条款/token/JSON 归并/rename/两段制）
- **DependsOn**: none
- **AtomicWith**: none

- **Produces**: 文件布局归一（review.md→docs/review.md 等）；JSON 归并（engine-config.json 3 并 1 · template-contract.json 4 族合 1；schemas 独立保留）；rename 规范化（18 令牌 → 新命名规范零遗留）；骨架 registry（sections + segments）；配置单点消费（config.ts/templates.ts）

- **Files**: packages/cdd-engine/templates/（review/fix/task 族布局）, packages/cdd-engine/templates/engine-config.json, packages/cdd-engine/templates/template-contract.json, packages/cdd-engine/templates/schema/, packages/cdd-engine/src/infra/config.ts, packages/cdd-engine/src/render/templates.ts

- **Steps**:
  1. ① **文件布局归一**：`review/review.md` → `docs/review.md` · `fix/docs.md` → `docs/fix.md` · `task/` 族归位；② **JSON 归并（单平面单文件）**：运行时配置 3 并 1 → `templates/engine-config.json`；渲染数据 4 族合 1 → `templates/template-contract.json`（skeleton + tokens + clauses + reviews.json）；**schemas 独立保留**（task/docs-handoff-schema.json——双用面） — checkable: 4 模板抗骨架数据校验一致（章节序/段名/segments 归属恒等）；`engine-config.json`/`template-contract.json` 存在且消费方程单点；schemas 独立且字节契约保留
  2. ③ **rename 规范化（18 令牌实测）**：`H1_BLOCK`→`RETURN_STDOUT_BLOCK` · `HANDOFF`/`HANDOFF_TYPE` 合并为 `HANDOFF_TARGET` · `HANDOFF_STUB`→`HANDOFF_SCHEMA_JSON` · `LENS_GUIDE`→`REVIEW_LENS_GUIDE` · `AXES`→`REVIEW_AXES` · `HARD_GATE`→`HANDOFF_WRITE_GATE` · `RETURN_MODE`→`RETURN_FORMAT` · `TYPE`→`REVIEW_TYPE`；token registry 驱动渲染 — checkable: token registry 全收敛（18 令牌 → 新命名规范，**零遗留旧态名**）
  3. ④ **骨架 registry**（`template-contract.json#sections` + `#segments{static,variant}`）：4 模板按骨架数据生成/校验；⑤ **配置单点消费**：`src/infra/config.ts` 加载 engine-config · `src/render/templates.ts` 加载 template-contract；测试引用路径随迁 — checkable: 条款零重复（clauses 单源）；测试引用路径随迁全绿；`pnpm run validate` 全绿（注：E2⑤ 的纪律条款在 T12 落 clauses——本 Task 建容器结构）

- **Acceptance**:
  - 4 模板抗骨架数据校验一致（章节序/段名/segments 归属恒等）；条款零重复（clauses 单源）；token registry 全收敛（18 令牌 → 新命名规范，**零遗留旧态名**：H1_BLOCK / HANDOFF 三义旧名 / TYPE / LENS_GUIDE…）；`engine-config.json`/`template-contract.json` 存在且消费方程单点（config.ts/templates.ts）；schemas 独立且字节契约保留（`JSON.parse(stub)===schema` 测试仍绿）；测试引用路径随迁全绿；`pnpm run validate` 全绿


### Task 6: cache-first C1–C7 + registry cache profile（spec 域 D-3 + 数据面）

- **Objective**: cache-first C1–C7 + registry cache profile（spec 域 D-3 + 数据面）
- **DependsOn**: none
- **AtomicWith**: none

- **Produces**: C1 组装序不变式 + C2 结构单源 + C3 确定性序列化 + C4 re-dispatch 字节复用 + C5 派发集恒定 + C6 写费经济 + C7 每 harness 观测 + 字节不变式守卫测试

- **Files**: packages/cdd-engine/src/render/templates.ts, packages/cdd-engine/templates/template-contract.json, packages/cdd-engine/src/infra/harness-registry.json, scripts/observe-cache.ts, docs/maintainers/context-caching-doctrine.md

- **Steps**:
  1. ① **C1 组装序不变式**：`[registry prefix] → [静态模板壳] → [变体载荷全置尾]`；② **C2** 壳/条款结构单源；③ **C3 确定性序列化**：schema 注入 canonical key 序（手写串零环境重排）；④ **C4 re-dispatch 字节复用**：静态区按 (name × canonical params) memoize，字节恒等重派发零重渲染 — checkable: 组装序恒为「registry prefix → 静态壳 → 变体载荷」（守卫测试绿）；重派发零重渲染（memoize 断言）；同 (harness,op,type) 派发集逐字节同集（断言绿）
  2. ⑤ **C5 派发集恒定**：同 (harness,op,type) 的 invoke 串/model/cwd/env 逐字节同集断言；⑥ **C6 写费经济**：静态区最薄审计；⑦ **C7 每 harness 观测**：`harness=cache` profile 落 registry（claude explicit/512/0.1/1.25/5/observable；cursor-auto pending）+ schema 校验；dev 观测脚本（连续同类型 round `/cost` 读 tok > 0 可测）；⑧ **字节不变式守卫测试**（稳定段零易变令牌 + 壳字节恒等断言） — checkable: registry 条目含 cache profile 且 schema 校验过；dev 观测脚本就位且**连续同类型 round read tok > 0 可测**（记录实测值，诚实边界入文档：TTL 窗口内主张、跨时段不承诺）；字节不变式守卫测试绿

- **Acceptance**:
  - 组装序恒为「registry prefix → 静态壳 → 变体载荷」（守卫测试绿）；重派发零重渲染（memoize 断言）；同 (harness,op,type) 派发集逐字节同集（断言绿）；registry 条目含 cache profile 且 schema 校验过；dev 观测脚本就位且**连续同类型 round read tok > 0 可测（观测脚本默认追加 `--debug` 实测；`/cost` 仅交互手动）**（记录实测值，诚实边界入文档：TTL 窗口内主张、跨时段不承诺）


### Task 7: skill 文档模板系统化第二平面（spec D-2，4 文件；随 T1 .agents 移除后）

- **Objective**: skill 文档模板系统化第二平面（spec D-2，4 文件；随 T1 .agents 移除后）
- **DependsOn**: none
- **AtomicWith**: none

- **Produces**: 四文件统一骨架（Header + Section 0–N 固定段序）；占位/token 引用条款；P1–P6 经验烘焙；命名规范

- **Files**: packages/osuperpowers/skills/cli-driven-development/docs/base-branch.md, packages/osuperpowers/skills/writing-overall-spec/docs/overall-spec-template.md, packages/osuperpowers/skills/writing-overall-spec/docs/add-phase-protocol.md, packages/osuperpowers/skills/writing-phase-spec/docs/phase-spec-template.md, docs/maintainers/program-experience.md

- **Steps**:
  1. ① `skills/cli-driven-development/docs/base-branch.md` · `writing-overall-spec/docs/overall-spec-template.md` · `add-phase-protocol.md` · `writing-phase-spec/docs/phase-spec-template.md` 四文件**统一骨架**（Header + Section 0–N 固定段序）；② 占位/token 引用条款（模板引条款不内联散文规则）；③ **P1–P6 经验烘焙**（§2.6 清单 / program-experience.md：四表 sync · 干净树前置 · session-call 语义 · 回填即版本 · 零纸面宣称 · 防回渗守卫 · 承诺收缩 · 测试就近）；④ 命名规范 — checkable: 4 文件统一骨架（段序/shape 一致性）；经验烘焙条目与 program-experience.md/§2.6 一一对应（零裸骨架段落）；命名面达标
  2. `pnpm run emit` 后 `.agents/` 不因本 Task 产生（T1 已移除）+ `emit:check` 无 drift — checkable: `pnpm run emit` 后 `.agents/` 不产生 + `emit:check` 无 drift（注：**必须随 T1 之后**（.agents 移除后改 skill docs 免 emit 往返））

- **Acceptance**:
  - 4 文件统一骨架（段序/shape 一致性）；经验烘焙条目与 program-experience.md/§2.6 一一对应（零裸骨架段落）；命名面达标；`pnpm run emit` 后 `.agents/` 不因本 Task 产生（T1 已移除——免 emit 往返验证）+ `emit:check` 无 drift


### Task 8: skill 流程原子性三断言 + flow 变更纪律（spec E1，Q3 升级）

- **Objective**: skill 流程原子性三断言 + flow 变更纪律（spec E1，Q3 升级）
- **DependsOn**: none
- **AtomicWith**: none

- **Produces**: skill-authoring.md 增「流程调整回顾整流程」守则节；validate 新增 digraph↔节点完整性三断言（双向完整 · 骨架同构 · 增长信号）

- **Files**: docs/maintainers/skill-authoring.md, scripts/validate/（digraph 三断言面）

- **Steps**:
  1. ① skill-authoring.md 增「**流程调整回顾整流程**」守则节（任何 skill 流程变更：digraph+节点+失败面重读 → 形状适配判断 → 统一调整 sibling → 才落点；膨胀信号必须给出全 flow 重构理由） — checkable: skill-authoring.md 含 flow 变更纪律节
  2. ② validate 新增 **digraph↔节点完整性三断言**：**双向完整**（digraph 节点集 ↔ `### 节点定义` 互满射，孤儿/悬空即 fail）· **骨架同构**（writing-* 三兄弟骨架一致；skeleton deltas 表 = 校验输入）· **增长信号**（节点/边计数入报告，跨界增长强制全 flow 重构说明） — checkable: validate 三断言全绿（现有 8 skill 零孤儿/零未登记 delta）；节点/边计数报告含于 validate 输出（注：三断言与 T15（G1 改写 skills）同批——G1 是「整 skill 统一调整」的第一个实证）

- **Acceptance**:
  - skill-authoring.md 含 flow 变更纪律节；validate 三断言全绿（现有 8 skill 零孤儿/零未登记 delta）；节点/边计数报告含于 validate 输出；`pnpm run validate` 相关块全绿


### Task 9: cdd 六缺口①——`cdd fix --type branch` 命令面 + branch 级 review-fix loop 全形（spec E2①）

- **Objective**: cdd 六缺口①——`cdd fix --type branch` 命令面 + branch 级 review-fix loop 全形（spec E2①）+ cli-driven-development digraph 一次改齐
- **DependsOn**: none
- **AtomicWith**: none

- **Produces**: engine `cli/fix.ts` branch type 分支 + dispatch/phases 增 branch 阶段表 + Stopping 语义（ref = BASE..HEAD）；`cli-driven-development/SKILL.md` 整 skill 一次改齐（canon shape digraph K→J→L + branch-fix-loop 改名 + dry-run WARN/pending-acceptance/术语一次描齐）

- **Files**: packages/cdd-engine/src/cli/fix.ts, packages/cdd-engine/src/dispatch/phases.ts, packages/osuperpowers/skills/cli-driven-development/SKILL.md

- **Steps**:
  1. ① **engine** `cli/fix.ts` 增 branch type 分支（type guard 现拒绝 branch——放开 + branch roundPattern：`branch-review-{R}.json` 定位 → `branch-fix-{R}` 轮次）；`dispatch/phases.ts` 增 branch 阶段表；Stopping 语义（branch ref = BASE..HEAD commit range——fix 后新 ref 合法 re-review） — checkable: `cdd fix --type branch` 可用（branch review findings 全 engine 闭环——BRB 实测：branch-review → branch-fix → re-review 走通，零编排 inline）
  2. ② **cli-driven-development/SKILL.md 整 skill 一次改齐（Flow Atomicity）**：digraph 重画为 **canon shape**（`K[branch-review] → {blocker=0?} → J[branch-fix] →（blocker>0 → K / blocker=0 → L[handoff-finishing]）`）；`branch-fix-loop` 节点改名 `branch-fix` + 语义（`cdd fix --type branch --findings branch-review-{R}.json` 为唯一修复通道引擎闭环）；Stopping/轮次（软上限保留 branch 定位）+ dry-run WARN 措辞 + pending-acceptance 措辞 + 术语（Review Convergence）一次性全部描入 — checkable: cli-driven-development digraph 为 canon shape（与族 loop 同构）；`branch-fix-loop` 零残留；软上限记录；**其全部 P6 描写尽在本 Task 产物——T11/T18 对该文件零认领**；`pnpm run validate` 全绿

- **Acceptance**:
  - `cdd fix --type branch` 可用（branch review findings 全 engine 闭环——BRB 实测：branch-review → branch-fix → re-review 走通，零编排 inline）；cli-driven-development digraph 为 canon shape（与族 loop 同构——风格审查/断言）；`branch-fix-loop` 零残留；软上限记录；**cli-driven-development SKILL.md 的全部 P6 描写（branch-loop/dry-run WARN/pending-acceptance/Review Convergence 术语）尽在本 Task 产物——T11/T18 对该文件零认领（其条目降为审计确认本产物零旧措辞）**；`pnpm run validate` 全绿


### Task 10: cdd 六缺口②③——dry-run 门判 WARN 化 + 黑盒干净树前置文档化（spec E2②③/G4①）

- **Objective**: cdd 六缺口②③——dry-run 门判 WARN 化 + 黑盒干净树前置文档化（spec E2②③/G4①）
- **DependsOn**: none
- **AtomicWith**: none

- **Produces**: dry-run 门判 WARN 化（commitPreCheck dryRun 降级：stderr 脏树 WARN + exit 0 走完模拟）；接口消歧（dry-run 走 pre-flight 早退，不经 spawnManaged）；黑盒干净树前置文档化三面

- **Files**: packages/cdd-engine/src/rules/commit.ts, packages/cdd-engine/src/dispatch/base.ts, vitest.config.mjs, CLAUDE.md

- **Steps**:
  1. ① **dry-run 门判 WARN 化**（非全跳过）：`run()` 模板 pre-flight `commitPreCheck` 见 `dryRun` 降级——检查脏树 → stderr 打印「工作树含未提交变更；dry-run 纯模拟不受影响，真实 dispatch 需干净树」→ 不 BLOCK、exit 0 走完模拟；**接口消歧（与 T14）：dry-run 不走 spawnManaged（无 liveness 介入）——liveness/TIMEOUT handoff 扩张仅约束真实 dispatch** — checkable: `dry-run`（review/fix/spec/plan 各型）在脏树 **EXIT 0 + stderr 脏树 WARN 可断言**（dry-run 黑盒全绿）；真实 dispatch 干净树门判语义不变（dirty→BLOCKED 用例仍绿）；**dry-run 路径零 liveness 介入断言**
  2. ② **黑盒干净树前置文档化**：vitest config 注释 / 测试文档 / CLAUDE.md dev 段显式记录「5b CLI 黑盒用例依赖入口门意义下的干净树」（P5 14 同根因教训） — checkable: 前置文档化三面就位；`pnpm run validate` 全绿（注：与 T9 协同——SKILL 措辞若涉 dry-run 由 T9 一次改齐，行为归本 Task）

- **Acceptance**:
  - `dry-run`（review/fix/spec/plan 各型）在脏树 **EXIT 0 + stderr 脏树 WARN 可断言**（dry-run 黑盒全绿——docs-task/cli-shape 相关用例转绿）；真实 dispatch 干净树门判语义不变（dirty→BLOCKED 用例仍绿）；**dry-run 路径零 liveness 介入断言；TIMEOUT 扩张仅真实 dispatch 断言（与 T14 接口消歧验证）**；前置文档化三面就位；`pnpm run validate` 全绿


### Task 11: cdd 六缺口④——跨 Task findings 收编（pending-acceptance-patch，spec E2④）

- **Objective**: cdd 六缺口④——跨 Task findings 收编（pending-acceptance-patch，spec E2④）+ orchestrator 收编权
- **DependsOn**: none
- **AtomicWith**: none

- **Produces**: review findings「targets later task」tag 约定（零 schema 变更）；plan 增 `pending-acceptance-patch` 区（task-ref + patch 描述；orchestrator 唯一写者——writing-plans 文档写明）；后续 task 验收承接（mechanically assertable）

- **Files**: packages/osuperpowers/skills/writing-plans/SKILL.md, packages/osuperpowers/skills/cli-driven-development/SKILL.md（audit 面）

- **Steps**:
  1. ① review findings 标注约定「**targets later task**」tag（convention，**零 schema 变更**）；② **plan 增 `pending-acceptance-patch` 区**（文档惯例 + 样例：task-ref + patch 描述；**orchestrator 唯一写者**——writing-plans 文档写明 fix/implement agent 不得写；cli-driven-development 文件零认领——其措辞由 T9 唯一写面带入，本 Task 审计确认） — checkable: plan 文档结构含 pending-acceptance-patch 区定义 + 样例；writing-plans 载明「fix agent 零 plan 修改权、收编权归 orchestrator」；cli-driven-development/SKILL.md 零本 Task 改动（审计确认）
  2. ③ 后续 task 验收承接（plan 样例展示：后续 task 的验收含 patch——机械可断言） — checkable: 跨 Task findings 走收编（实证：T11/T14-fix 类越界场景走 findings 报 orchestrator 而非擅改 plan）；`pnpm run validate` 全绿（注：v1.31 语义延续——修改权回归 orchestrator，fix agent 零修改权不放松）

- **Acceptance**:
  - plan 文档结构含 pending-acceptance-patch 区定义 + 样例；writing-plans 文档载明「fix agent 零 plan 修改权、收编权归 orchestrator」；cli-driven-development/SKILL.md 零本 Task 改动（T9 产物已含 pending-acceptance 措辞——审计确认）；跨 Task findings 走收编（实证：T11/T14-fix 类越界场景走 findings 报 orchestrator 而非擅改 plan）；`pnpm run validate` 全绿


### Task 12: cdd 六缺口⑤——纪律条款入库（spec E2⑤/D1.2）

- **Objective**: cdd 六缺口⑤——纪律条款入库（spec E2⑤/D1.2）：clauses 单源全 7 条 + 模板零内联纪律散文
- **DependsOn**: none
- **AtomicWith**: none

- **Produces**: `template-contract.json#clauses` 落地 v1.29–v1.31 全部纪律条款（cl:english-comments · cl:eof-newline · cl:no-full-tree-find · cl:bash-stall-limit · cl:plan-freeze · cl:atomic-commit · cl:self-validate）；4 模板以 `{{> clause cl:xxx}}` 引用

- **Files**: packages/cdd-engine/templates/template-contract.json, packages/cdd-engine/templates/（4 模板）

- **Steps**:
  1. `template-contract.json#clauses` 落地 v1.29–v1.31 全部纪律条款：`cl:english-comments` · `cl:eof-newline` · `cl:no-full-tree-find`（禁大目录全量 find / 大文件裸读）· `cl:bash-stall-limit`（Bash 卡 >10min 终止换等价命令）· `cl:plan-freeze`（已审批 plan/spec 零修改权）· `cl:atomic-commit` · `cl:self-validate` — checkable: clauses 单源全 7 条落库
  2. 4 模板以 `{{> clause cl:xxx}}` 引用（T5 容器 + 本 Task 条款正文）；模板正文零内联纪律散文 — checkable: 4 模板零内联纪律散文（条款引用覆盖）；行为变更一处生效（条款文本单点断言）；E2⑤ 与 T1/砂面产出互洽；`pnpm run validate` 全绿（注：EOF/CJK 可测项兼由 residue 断言兜底（双轨））

- **Acceptance**:
  - clauses 单源全 7 条落库；4 模板零内联纪律散文（条款引用覆盖）；行为变更一处生效（条款文本单点断言）；E2⑤ 纪律与 T1/砂面产出互洽；`pnpm run validate` 全绿


### Task 13: cdd 六缺口⑥——plan/spec 锚点终态校验（spec E2⑥/F1）

- **Objective**: cdd 六缺口⑥——plan/spec 锚点终态校验（spec E2⑥/F1）：路径/版本锚点对实态 git 树校验
- **DependsOn**: none
- **AtomicWith**: none

- **Produces**: residue/一致性扩展——spec/plan 内引用的路径/版本锚点（`**Spec:**` 链接 · Parent program 链接 · 文件路径）对实态 git 树校验；「docs 与落地一致」的锚点面

- **Files**: scripts/validate/residue.ts, scripts/validate/__tests__/residue.test.ts

- **Steps**:
  1. 全 plan/spec 路径锚对实态文件校验（T17/T18 类 review 锚点漂移零复发）：residue/一致性扩展——spec/plan 内引用锚点对实态 git 树校验 — checkable: 校验器新增锚点断言绿（零漂移）；既有 spec/plan 全量锚对实态通过；T17/T18 类 review 不再报锚点；`pnpm run validate` 全绿（注：与 T19 收口复核（F1）协同——本 Task 落校验器，T19 全量执行）

- **Acceptance**:
  - 校验器新增锚点断言绿（零漂移）；既有 spec/plan 全量锚对实态通过；T17/T18 类 review 不再报锚点；`pnpm run validate` 全绿


### Task 14: stall 探测器三件套（spec E3）

- **Objective**: stall 探测器三件套（spec E3）：spawnManaged liveness monitor + invoke 透传 + TIMEOUT 语义扩展 + 恢复路径契约化
- **DependsOn**: none
- **AtomicWith**: none

- **Produces**: `infra/proc.ts` spawnManaged 派发期 liveness monitor（每 ~60s 采样 CPU + workspace mtime，IDLE_WINDOW 内无推进 → 杀进程组 → TIMEOUT handoff）；infra/invoke.ts 透传 idle 参数；`rules/failure.ts` TIMEOUT 语义扩展；DEFAULT_TIMEOUTS 配置面

- **Files**: packages/cdd-engine/src/infra/proc.ts, packages/cdd-engine/src/infra/invoke.ts, packages/cdd-engine/src/rules/failure.ts, packages/cdd-engine/templates/engine-config.json

- **Steps**:
  1. `infra/proc.ts` **spawnManaged 派发期 liveness monitor**：每 ~60s 采样双信号（子进程累计 CPU + workspace/工作树最新文件 mtime），IDLE_WINDOW（默认 ~15min）内无推进 → 杀进程组 → TIMEOUT handoff（blocker 注明「agent 工具调用卡死 + 未提交改动待清偿」）；判据精确（思考/读文件烧 CPU、挂起工具调用 CPU≈0 且树静默 → 不误杀） — checkable: liveness monitor 双信号判据测试绿（静止超窗被杀 · 活跃不误杀）；TIMEOUT handoff blocker 含清偿指引
  2. `infra/invoke.ts` 透传 idle 参数；`rules/failure.ts` TIMEOUT 语义扩展；`DEFAULT_TIMEOUTS` 配置面；恢复路径契约化（残留清偿指引写 blocker：discard/commit 后 re-dispatch，入口门保证干净） — checkable: 无整过程 90min 拖死事件（dev 实证记录）；`pnpm run validate` 全绿（注：v1.29–v1.31 登记；与 T12 工具纪律条款协同）

- **Acceptance**:
  - liveness monitor 双信号判据测试绿（静止超窗被杀 · 活跃不误杀）；TIMEOUT handoff blocker 含清偿指引；无整过程 90min 拖死事件（dev 实证记录）；`pnpm run validate` 全绿


### Task 15: 自省四修 G1——session-call 语义诚实化（spec G1，全域 19 处）

- **Objective**: 自省四修 G1——session-call 语义诚实化（spec G1，全域 19 处）
- **DependsOn**: none
- **AtomicWith**: none

- **Produces**: skill-authoring session-call 原语定义修订；6 skill ~19 处「Run a /」全改（内联消费 + 产物记载 + 路由）

- **Files**: docs/maintainers/skill-authoring.md, packages/osuperpowers/skills/brainstorming/SKILL.md, packages/osuperpowers/skills/writing-phase-spec/SKILL.md, packages/osuperpowers/skills/writing-single-spec/SKILL.md, packages/osuperpowers/skills/writing-overall-spec/SKILL.md, packages/osuperpowers/skills/writing-plans/SKILL.md, packages/osuperpowers/skills/finishing/SKILL.md

- **Steps**:
  1. ① skill-authoring.md **session-call 原语定义修订**：`load 上游 skill = import 其流程一次`——加载即内联消费（不可能二次 spawn）· 每会话每上游类型至多消费一次 · 重入按**已落产物**路由 · 否决再 Run 措辞 — checkable: skill-authoring session-call 原语定义修订落地
  2. ② **6 skill ~19 处 `Run a /` 全改**（实测分布：brainstorming 6 · writing-phase-spec 4 · writing-single-spec 3 · writing-overall-spec 3 · writing-plans 2 · finishing 1）：从「Run a /xxx session」改写为「上游流程作为本会话基线**内联消费**；产物 = …；路由到 …」；handoff-* 交接按交接语汇统一 — checkable: 6 skill 19 处零虚假 run 措辞（内联消费 + 产物记载）；digraph 三断言（T8）在改写前后均绿；`pnpm run emit` 后 `emit:check` 无 drift；`pnpm run validate` 全绿（注：**随 T1 之后**（.agents 移除后改 skills 免 emit 往返）；T8 三断言是改写护栏）

- **Acceptance**:
  - 6 skill 19 处零虚假 run 措辞（内联消费 + 产物记载）；skill-authoring session-call 原语定义修订落地；digraph 三断言（T8）在改写前后均绿；`pnpm run emit` 后 `emit:check` 无 drift；`pnpm run validate` 全绿


### Task 16: 自省四修 G2/G3——grilling 需求全量清单 + validate 脚本 maintainer-only 边界

- **Objective**: 自省四修 G2/G3——grilling 需求全量清单 + validate 脚本 maintainer-only 边界
- **DependsOn**: none
- **AtomicWith**: none

- **Produces**: G2 grilling 需求全量清单前置（brainstorming / writing-phase-spec 流程定义）；G3 validate 脚本 maintainer-only 边界文档化（写入 maintainer docs + writing-overall-spec）

- **Files**: docs/maintainers/skill-authoring.md, packages/osuperpowers/skills/brainstorming/SKILL.md, packages/osuperpowers/skills/writing-phase-spec/SKILL.md, packages/osuperpowers/skills/writing-overall-spec/SKILL.md, docs/maintainers/

- **Steps**:
  1. ① **G2 grilling 需求全量清单前置**：brainstorming / writing-phase-spec 流程定义——phase-within-program grilling **先逐项枚举 overall/phase 已登记需求（含状态）**，用户确认覆盖完整后再入 frontier 问题（入 skill-authoring 流程节 + 两 skill 文档措辞） — checkable: 两 skill 流程含需求全量枚举步骤（先枚举后 frontier——措辞可断言）
  2. ② **G3 validate 脚本 maintainer-only 边界文档化**：`scripts/validate/*` = 发布根仓内部编排面（消费者无、非打包面）；当时由 scripts/validate 承担 charter 四表守卫是 maintainer-mode（本仓 dogfood）定位——该守卫归属已由 consumer-parity 归位 engine lifecycle，写入 maintainer docs + writing-overall-spec 注明角色归类 — checkable: validate 脚本边界记录于 maintainer docs + writing-overall-spec；`pnpm run validate` 全绿（注：G2/G3 是程序自省——程序自身的流程宣称诚实化）

- **Acceptance**:
  - 两 skill 流程含需求全量枚举步骤（先枚举后 frontier——措辞可断言）；validate 脚本边界记录于 maintainer docs + writing-overall-spec；`pnpm run validate` 全绿


### Task 17: 自省四修 G4——pre-commit 结构性修复（spec G4③）

- **Objective**: 自省四修 G4——pre-commit 结构性修复（spec G4③）：黑盒隔离 + pre-commit 树无关子集 + CI 全量
- **DependsOn**: none
- **AtomicWith**: none

- **Produces**: 黑盒树依赖用例迁 mkdtemp 真仓隔离或 CI-only；pre-commit 钩子收敛树无关目标（6 组 9 块）；CI 全量（pr-validate 全 12 块含树依赖黑盒）

- **Files**: .husky/pre-commit, packages/cdd-engine/（黑盒用例隔离面）, .github/workflows/pr-validate.yml, CLAUDE.md

- **Steps**:
  1. ① **黑盒树依赖用例迁 mkdtemp 真仓隔离** 或标记 CI-only（5b CLI 黑盒用例——pre-commit 只跑树无关子集）；② **pre-commit 钩子收敛树无关目标**（`.husky/pre-commit`：emit-check/residue/consistency/unit 等树无关子集）+ **CI 全量**（pr-validate：全 12 块含树依赖黑盒——干净检出语义不变）；③ dry-run WARN 化已由 T10 落地（本 Task 闭环断言） — checkable: **pre-commit 在脏树零结构性失败**（`git add <file> && git commit` 通过——dry-run WARN + 黑盒隔离/树无关子集生效）；CI 全量含黑盒（干净检出全绿）；CLAUDE.md dev 段记录提交流程
  2. `pnpm run validate` 12 块全绿 — checkable: `pnpm run validate` 12 块全绿（注：结构性矛盾根因 = 入口门对所有 dispatch 强执行 + 黑盒依赖真实树干净；修复 = 门槛对齐边界（树无关子集 local / 树依赖面 CI + entry-gate 留真实边界））

- **Acceptance**:
  - **pre-commit 在脏树零结构性失败**（`git add <file> && git commit` 通过——dry-run WARN + 黑盒隔离/树无关子集生效）；CI 全量含黑盒（干净检出全绿）；CLAUDE.md dev 段记录提交流程（树无关前置）；`pnpm run validate` 12 块全绿


### Task 18: F8 术语优化——Review Convergence 全仓 rename（spec F8）

- **Objective**: F8 术语优化——Review Convergence 全仓 rename（spec F8）：术语制度 + 改名清单 + 代码/文件名同步 + 残留守卫
- **DependsOn**: none
- **AtomicWith**: none

- **Produces**: naming-conventions 增 terminology registry + 仲裁规则；`Review Stopping` → **Review Convergence**（4 skill 16 处本 Task + T9 1 处审计）；`fix-loop-exhausted`→`review-cycle-cap` · `timeout-exhausted`→`dispatch-timeout-cap`；`src/rules/stopping.ts` → convergence.ts；residue 守卫扩展

- **Files**: docs/maintainers/naming-conventions.md, packages/osuperpowers/skills/writing-single-spec/SKILL.md, packages/osuperpowers/skills/writing-phase-spec/SKILL.md, packages/osuperpowers/skills/writing-overall-spec/SKILL.md, packages/osuperpowers/skills/writing-plans/SKILL.md, CLAUDE.md, packages/cdd-engine/src/rules/stopping.ts, packages/cdd-engine/src/rules/convergence.ts, scripts/validate/residue.ts, docs/maintainers/（方法论 docs）

- **Steps**:
  1. ① **术语制度**：`naming-conventions.md` 扩「terminology registry」（term/定义/已废旧名禁止表/mechanismNames 迁移清单）+ **仲裁规则**（术语与机制名语义 gap 时**术语第一**、rename 代码达成一致）；② **改名清单落地**：`Review Stopping` → **`Review Convergence`**（**5 skills 17 处实测——4 skill 写面归本 Task，cli-driven-development 1 处由 T9 带入本 Task 审计确认**）· CLAUDE.md · overall · maintainer docs · `fix-loop-exhausted` → `review-cycle-cap` · `timeout-exhausted` → `dispatch-timeout-cap` — checkable: `Review Convergence` 全 live 面就位（4 skill 16 处本 Task + cli-driven-development 1 处 T9 产物审计确认 · CLAUDE.md · overall · maintainer docs · rules/convergence.ts）；`review-cycle-cap`/`dispatch-timeout-cap` 就位
  2. ③ **代码/文件名同步（仲裁随批）**：`src/rules/stopping.ts` → `convergence.ts` + 测试随域 C 已迁位置 rename + import/引用全迁（机制语义本体不动） — checkable: src 零 `stopping` 模块/标识符；residue 旧词断言全绿；naming-conventions 含 terminology registry（mechanismNames）
  3. ④ **残留守卫**：residue/stale-lexicon 断言**扩展机制标识符面**（src 零 `stopping` · 零 `fix-loop-exhausted`/`timeout-exhausted` 字面 · `Review Stopping` live 面零残留）；保留清单登记；⑤ **H1 内容级 rename（v1.4 扩段；v1.5 上移 Task 23，本条降级为审计）**——原登记面由 Task 23 实施承接 — checkable: **H1 内容级零残留（本条审计确认）**——prompt 正文零 `H1` + src 零 `h1*` 标识符 + `\bH1\b` 守卫零命中（Task 23 产物审计确认）；历史 changelog/spec-plan 豁免；`pnpm run validate` 全绿（注：改名是术语第一仲裁的第一次全仓执行）

- **Acceptance**:
  - `Review Convergence` 全 live 面就位（**4 skill 16 处本 Task 改写 + cli-driven-development 1 处 T9 产物审计确认** · CLAUDE.md · overall · maintainer docs · `rules/convergence.ts`）；`review-cycle-cap`/`dispatch-timeout-cap` 就位；src 零 `stopping` 模块/标识符；residue 旧词断言全绿；naming-conventions 含 terminology registry（mechanismNames）；**H1 内容级零残留（v1.4 登记；v1.5 上移 Task 23，本条审计确认）**——prompt 正文（contract sections 全三区）零 `H1` 单词（RETURN_STDOUT_BLOCK/return block 语义名）+ src 零 `h1` 前缀标识符 + `\bH1\b` residue 守卫零命中（Task 23 产物审计确认）；**历史 changelog/spec-plan 豁免**（v1.28–v1.44 行 + 历史程序文档不重写）；`pnpm run validate` 全绿


### Task 19: 收口复核 F1–F6/F7/F8（spec 域 F）

- **Objective**: 收口复核 F1–F6/F7/F8（spec 域 F）：锚点/残留/changeset/validate/方法论 doc/F7 整理/F8 验证
- **DependsOn**: none
- **AtomicWith**: none

- **Produces**: F1 锚点终态校验全量 + F2 残留守卫扩展 + F3 changeset 复核/版本落地 + F4 命名制度对照 + F5 全绿 + F6 方法论 doc 核对 + F7 运维文档整理重组 + F8 术语收口验证

- **Files**: docs/maintainers/（全量内容审计重组）, .changeset/, packages/osuperpowers/CHANGELOG.md, scripts/validate/

- **Steps**:
  1. ① F1 锚点终态校验全量执行（T13 校验器跑全 spec/plan）；② F2 残留守卫扩展（vendors/publish-vendor/submodule/.agents/droid-pi 语汇全量断言）+ F4 命名制度对照全量扫描；③ F3 逐 phase changeset 复核 + **版本落地验证**（`pnpm run version --dry-run` 消费后 next ≠ 当前）+ smoke workspace flake 排查 — checkable: 12 块全绿 + `emit:check` 无 drift；changeset 齐备 + 版本落地已验证；锚点/残留/术语残留全断言零
  2. ④ F5 `pnpm run validate` 12 块全绿 + **零纸面宣称总校验**（每 spec 项 ↔ 执法位映射核对）；⑤ F6 4 份方法论 doc（naming-conventions / context-caching-doctrine / template-doctrine / program-experience）存在且与落地一致核对 — checkable: **零纸面宣称总校验通过**（映射表核对零未执法项）；方法论 doc 与落地一致
  3. ⑥ **F7 运维文档整理重组**：`docs/maintainers/` 全量内容审计（删无用 + 节级删 stale 引用）+ 按内容域重划文件/目录 + 全引用同步 + 重组后每 doc 锚对实态；⑦ F8 术语优化收口验证（T18 产物 + nomenclature 全仓扫描）+ **父整体 P6 行残留审计三件复核**（① zero「豁免」词形 ②「已跟踪 14 文件」就位 ③ scope cell 零「17 令牌」字面） — checkable: F7 重组完成（无用文档零/重划后引用面全绿）；`pnpm run validate` + `emit:check` 为 final gate（注：收口复核是「docs 与落地一致」的统一验收；P6 为终局 phase）

- **Acceptance**:
  - 12 块全绿 + `emit:check` 无 drift；changeset 齐备 + 版本落地已验证；锚点/残留/术语残留全断言零；方法论 doc 与落地一致；F7 重组完成（无用文档零/重划后引用面全绿）；**零纸面宣称总校验通过**（映射表核对零未执法项）；`pnpm run validate` + `emit:check` 为 final gate


### Task 20: 模板系统化终态（spec D-3 C1-max 字节布局层；overall v1.45 / spec v1.8 回填）

- **Objective**: 模板系统化终态（spec D-3 C1-max 字节布局层；overall v1.45 / spec v1.8 回填）：统一壳 + 槽级三段制 + 渲染数据平面单文件 + C4 升格
- **DependsOn**: none
- **AtomicWith**: none

- **Produces**: 统一壳（四模板归并字面常数壳，零注入槽）；槽级三段制（壳 → Return 字节常数 → Round context 绝对末尾唯一动态区）；渲染数据平面单文件（四 .md 并入 template-contract.json sections）；token registry `zone` 归属；C4 壳无参常数（staticShellKey 消除）；门面去路径化；WORKSPACE_SLUG

- **Files**: packages/cdd-engine/templates/（四模板 + template-contract.json + engine-config.json）, packages/cdd-engine/src/render/templates.ts, packages/cdd-engine/src/dispatch/（task/docs/branch）, packages/cdd-engine/src/cli/（review/branch-review/docs）

- **Steps**:
  1. ① **统一壳**：四模板归并为「字面常数壳」（title + Instructions 纪律壳 + Handoff 壳散文 + schema 注入）——壳内**零注入槽**（跨模板字节恒等）；② **槽级三段制**：段序 = `壳 → ## Return（字节常数）→ ## Round context（绝对末尾，一切 per-dispatch 实值）`；③ **渲染数据平面单文件**：四 `.md` 并入 `template-contract.json#sections`，`.md` 删除（人读面走 emit 派生） — checkable: 四 `.md` 零手写模板文件（或 emit 派生校验 + drift=0）；段序恒为「壳 → Return → Round context」且 Return 字节常数
  2. ④ **token registry 增 `zone` 归属**（壳禁槽 / round-context / return）——结构校验器断言「壳零残余 moustache + 槽仅现所属区」；⑤ **C4 升格**：壳 = 进程级**无参常数**（`staticShellKey` 消除，编译一次永久复用）；⑥ **门面去路径化**：reviewHardGate 等实值迁入 Round context 槽，壳门面散文为字节常数 — checkable: token zone 归属断言全绿；C4 壳无参常数（staticShellKey 消除、重派发零重渲染断言强化）；跨模板字面头字节恒等断言绿
  3. ⑦ **`WORKSPACE_SLUG`**：canonical slug 槽（engine-config slugRule 已规约）——plan 与搭档 spec 收敛同值；⑧ 消费方与测试迁移（位置敏感断言 ×4 · templates.cache.test · consumers） — checkable: `WORKSPACE_SLUG` 就位（plan/spec 收敛）；`pnpm run emit` 后 `.agents/` 不产生 + `emit:check` 无 drift；engine suite 全绿 + validate 12 块全绿（注：**实施时序 = T8 完成之后、T9 之前**；C4 升格后观测缝保持）

- **Acceptance**:
  - 四 `.md` 零手写模板文件（或 emit 派生校验 + drift=0）；段序恒为「壳 → Return → Round context」且 Return 字节常数（动态区唯一绝对尾）；token zone 归属断言「壳零注入 + 槽仅现所属区」全绿；C4 壳无参常数（staticShellKey 消除、重派发零重渲染断言强化）；跨模板字面头字节恒等断言绿；`WORKSPACE_SLUG` 就位（plan/spec 收敛）；`pnpm run emit` 后 `.agents/` 不因本 Task 产生 + `emit:check` 无 drift；engine suite 全绿 + `pnpm run validate` 12 块全绿


### Task 21: scripts/ 与 cdd-engine 统一 CLI 框架 + 测试就近 `__tests__` 化（spec 域 C M8/M9；overall v1.46 / spec v1.9 回填）

- **Objective**: scripts/ 与 cdd-engine 统一 CLI 框架 + 测试就近 `__tests__` 化（spec 域 C M8/M9）：citty 单框架 + observe-cache argsDef + scripts 测试 100% 就近
- **DependsOn**: none
- **AtomicWith**: none

- **Produces**: scripts/run.ts 弃 Commander 改 citty（与 engine 同构）；observe-cache.ts 手写 parseArgs 归 citty argsDef；commander 根 devDep 移除 + citty 入根；scripts 测试全迁 __tests__/；root vitest include 收敛

- **Files**: scripts/run.ts, scripts/observe-cache.ts, package.json, scripts/**/__tests__/（迁移面）, vitest.config.mjs, docs/maintainers/（运维同步）

- **Steps**:
  1. ① **CLI 框架统一（citty 单框架惯例）**：`scripts/run.ts` 弃 Commander → citty defineCommand（mainCommand + subCommands【emit/emit-check/validate/smoke-cdd/version/apply-rules】+ argsDef + --help 预屏 + exit 2/1）；子命令 handler 保留 lazy dynamic import — checkable: scripts/ 零 Commander + 零手写 parseArgs（run.ts/observe-cache 全 citty）；退出码与 engine 表一致（usage/parse exit 2 · 失败 exit 1 断言）
  2. ② `scripts/observe-cache.ts` 手写 parseArgs → citty argsDef（boolean presence 天然 + --harness/--rounds 值参）；③ 依赖面：commander 根 devDep 移除 + citty 入根 devDeps；④ 测试就近 `__tests__` 化：scripts/<dir>/<file>.test.ts → scripts/<dir>/__tests__/<file>.test.ts + 顶层 observe-cache.test.ts → scripts/__tests__/ — checkable: scripts 测试 100% `__tests__/` 就近（`find scripts -name '*.test.ts' -not -path '*/__tests__/*'` = 0）；root vitest include 收敛后套件全量发现
  3. ⑤ root vitest include 收敛 `scripts/**/__tests__/**/*.test.ts`（T3 内存守卫保持）；⑥ 运维文档同步；⑦ validate 12 块全绿 + parse/presence 断言全绿 — checkable: observe-cache presence 语义 + run.ts 子命令值传断言全绿；commander 根 dep 零引用；`pnpm run validate` 12 块全绿（注：citty 依赖以根 devDeps 显式声明；顺序 = Task 20（C1-max）之后、T18/T19 之前）

- **Acceptance**:
  - scripts/ 零 Commander + 零手写 parseArgs（run.ts/observe-cache 全 citty）；退出码与 engine 表一致（usage/parse exit 2 · 失败 exit 1 断言）；scripts 测试 100% `__tests__/` 就近（`find scripts -name '*.test.ts' -not -path '*/__tests__/*'` = 0）；root vitest include 收敛后套件全量发现（scripts 全部测试绿）；observe-cache presence 语义 + run.ts 子命令值传断言全绿；commander 根 dep 零引用；`pnpm run validate` 12 块全绿


### Task 22: plan-constraints 物料化契约（spec E2/T7.1；overall v1.47 / spec v1.10 回填）

- **Objective**: plan-constraints 物料化契约（spec E2/T7.1）：materializePlanConstraints + 存在性门 + dry-run 豁免 + stale 锚
- **DependsOn**: none
- **AtomicWith**: none

- **Produces**: `materializePlanConstraints(plan, workspace)`（自 plan 声明源确定性生成 + plan hash 头锚）；存在性门（缺失 → BLOCK 可行动 blocker）；dry-run 豁免；stale 检测选；materializer 单测 + 黑盒

- **Files**: packages/cdd-engine/src/dispatch/task.ts, packages/cdd-engine/src/render/brief.ts, docs/maintainers/（plan 模板/写作流同步）

- **Steps**:
  1. ① **物料化**：`dispatch/task.ts` 增 `materializePlanConstraints(plan, workspace)`：implement pre-flight 若 `plan-constraints.md` 缺失，自 **plan 声明源**（本 plan = 口径/commit 边界机制/Flow Atomicity/顺序原则 四段声明面）生成一次（含 plan hash 头锚作 stale 锚）；与 brief 生成同点（workspace 派生工件一等待遇） — checkable: `cdd implement`（真实非 dry-run）pre-flight 必含 constraints 存在性门：缺失 → exit 1 + 可行动 blocker；`plan-constraints.md` 自 plan 声明源确定性生成（含 plan hash 锚）
  2. ② **存在性门**：implement pre-flight 检查——缺失 → **BLOCK**（可行动 blocker："plan-constraints.md missing — run materializer or declare a plan Constraints source"）而非静默 fallback；生成器不可解 → 同样 BLOCK；③ **dry-run 豁免**（零副作用模拟）；④ **stale 检测选**（plan hash 锚比对——可复算基准入测试）；⑤ 测试：materializer 单测 + 黑盒；⑥ 文档：plan 模板/写作流记 Constraints 源声明约定 — checkable: dry-run 豁免（走通零 BLOCK）；全 workspace 历史 note「plan-constraints.md 不存在 → brief 唯一权威」零复发（grep）；validate 12 块全绿 + engine suite 全绿

- **Acceptance**:
  - `cdd implement`（真实非 dry-run）pre-flight 必含 constraints 存在性门：缺失 → exit 1 + 可行动 blocker（非静默 fallback）；`plan-constraints.md` 自 plan 声明源确定性生成（含 plan hash 锚）；dry-run 豁免（走通零 BLOCK）；全 workspace 历史 note「plan-constraints.md 不存在 → brief 唯一权威」零复发（grep 新报告零同款）；validate 12 块全绿 + engine suite 全绿


### Task 23: lifecycle 状态正交化 + H1 名称语义化（spec T7.2；overall v1.48 / spec v1.11 回填）

- **Objective**: lifecycle 状态正交化 + H1 名称语义化（spec T7.2）：status·failure_category·unverifiable/plan_conflicts 三面正交 + BLOCKED exit 1 + 契约入 schema + H1 rename
- **DependsOn**: none
- **AtomicWith**: none

- **Produces**: 三面正交化（deriveReviewStatus/rollupStatus 不再裸折 BLOCKED——必带 failure_category + 真实 blocker）；契约入 schema field description（prompt 零散文）；BLOCKED（任何通道）→ exit 1；defaultBlockerFor 伪造杀手；H1 无语义命名 rename（h1*→return*）+ `\bH1\b` 入 residue 机制面守卫

- **Files**: packages/cdd-engine/src/artifacts/handoff/finalize.ts, packages/cdd-engine/src/dispatch/task.ts, packages/cdd-engine/src/dispatch/docs.ts, packages/cdd-engine/src/dispatch/branch.ts, packages/cdd-engine/templates/schema/task-handoff-schema.json, packages/cdd-engine/templates/schema/docs-handoff-schema.json, packages/cdd-engine/src/artifacts/progress.ts, packages/cdd-engine/src/dispatch/phases.ts, packages/cdd-engine/templates/template-contract.json, scripts/validate/residue.ts

- **Steps**:
  1. ① **三面正交化**：`status`（本轮结论）· `failure_category`（失败机制通道）· `unverifiable[]`/`plan_conflicts[]`（内容级附注）不再折叠混淆——deriveReviewStatus/rollupStatus unverifiable/plan_conflicts 裸折 BLOCKED 改为 **必带 `failure_category` + 真实 blocker**；② **契约入 schema field description**（schema 经 renderHandoffSchemaJson 原样注入 prompt；plan-constraints §口径 dev-measured 按 accepted-noted） — checkable: `unverifiable`/`plan_conflicts` 折 BLOCKED 时必带 failure_category + 真实 blocker（裸折零残留）；schema description 承载语义（task/docs 双 schema 断言 + prompt 零散文）；真·unverifiable → BLOCKED + UNVERIFIABLE + blocker 含「未验什么/为什么」（黑盒）
  2. ③ **BLOCKED → exit 1（任何通道）**：APPROVED / CHANGES_REQUESTED → 0——退出码映射面统一；④ **`defaultBlockerFor` 伪造杀手**：H1 blocker 行只允许真实来源，BLOCKED 无真实原因 → `blocker: ""`（不伪造）；schema allOf 强制「BLOCKED ⇒ blocker 非空 or failure_category 存在」 — checkable: BLOCKED 任何通道 exit 1 + APPROVED/CHANGES_REQUESTED exit 0（T14 现场用例反转红→绿）；schema allOf 强制校验绿 + defaultBlockerFor 伪造零残留
  3. ⑤ **H1 无语义命名 rename（spec F8a 上移本 Task）**：src 标识符 `h1*`→`return*`（h1FourLines→returnFourLines · h1FromHandoff→returnFromHandoff · h1CountersLine→returnCountersLine · artifactsFromH1Line→artifactsFromReturnLine · implementStatusFromH1→implementStatusFromReturnLine）· phases.ts「H1 four-line parse」→「return block parse」· template-contract shell 2 bullet → return block 语义名；**`\bH1\b` 入 residue stale-lexicon 机制面守卫（零豁免）** — checkable: `\bH1\b` residue 守卫零命中 + src 零 `h1*` 标识符 + prompt 正文零 `H1`；engine suite 全绿 + validate 12 块全绿

- **Acceptance**:
  - `unverifiable`/`plan_conflicts` 折 BLOCKED 时必带 `failure_category` + 真实 blocker（裸折零残留——单测 + T14 复现场景红→绿）；schema description 承载 unverifiable/dev-measured 语义（task/docs 双 schema 断言 + prompt 零散文验证——`renderHandoffSchemaJson` 输出即权威）；真·unverifiable review → BLOCKED + UNVERIFIABLE + blocker 含「未验什么/为什么」（黑盒）；§口径 dev-measured review 零 BLOCK 零 unverifiable（T14「90min 无拖死」类实证）；BLOCKED 任何通道 exit 1 + APPROVED/CHANGES_REQUESTED exit 0（T14 现场用例反转红→绿）；schema `allOf` BLOCKED 强制校验绿 + `defaultBlockerFor` 伪造零残留；`\bH1\b` residue 守卫零命中 + src 零 `h1*` 标识符 + prompt 正文零 `H1`；engine suite 全绿 + `pnpm run validate` 12 块全绿


### Task 24: 派发岛收敛 + 机制上链 + 错误收编（架构级统一抽象，spec T7.3；overall v1.51 / spec v1.13 回填）

- **Objective**: 派发岛收敛 + 机制上链 + 错误收编（架构级统一抽象，spec T7.3）：BranchLifecycle 收编 + 纠缠拆解 + 机制单点 + 死代码清理 + 错误收编
- **DependsOn**: none
- **AtomicWith**: none

- **Produces**: A 派发状态机补全（BranchLifecycle extends DispatchLifecycle）；B 纠缠带拆解（status 推导族归 finalize · 计数器族归 failure · schema 只校验）；C 机制单点（Convergence/writeBlocked/workspace/return-block/hashFile）；D 死代码清理；F 错误收编（CddExitError 家族 + invariant 工厂）；G 架构纪律回写

- **Files**: packages/cdd-engine/src/dispatch/branch.ts, packages/cdd-engine/src/cli/branch-review.ts, packages/cdd-engine/src/cli/branch-fix.ts, packages/cdd-engine/src/dispatch/base.ts, packages/cdd-engine/src/artifacts/handoff/finalize.ts, packages/cdd-engine/src/rules/failure.ts, packages/cdd-engine/src/rules/schema.ts, packages/cdd-engine/src/artifacts/progress.ts, packages/cdd-engine/src/rules/convergence.ts, packages/cdd-engine/src/infra/exit.ts, docs/maintainers/program-experience.md, docs/maintainers/osuperpowers-plugin.md

- **Steps**:
  1. ① **A 派发状态机补全**——branch 族收编为 `BranchLifecycle extends DispatchLifecycle`（round/ref · prompt 组装 · schema 校验 · finalize · exit 全改覆写 hook，CLI 形状不变）；② **B 纠缠带拆解**——finalize 收 status 推导全族为唯一 owner；failure 收计数器族为唯一 owner；schema 只校验；progress 与 failure 互引拆 — checkable: branch 族继承 DispatchLifecycle（branch-review/branch-fix 零手写 lifecycle）；rules⇄artifacts 直接循环依赖零（schema⇄finalize / failure⇄progress 拆——vite 循环依赖断言或 graph 检查）
  2. ③ **C 机制单点**——Convergence 三定义收一（rules/convergence.ts 唯一 owner；hashFile 迁 artifacts）；writeBlocked 四派统一为 blockedCarrierFor 单载点；workspace 两处归 naming；return-block 文本面单点（解析 + 序列化一处）；④ **D 死代码清理**——rules/convergence 孤岛 · infra/log 零生产消费 · cli/review 死 import 全清 — checkable: Convergence / writeBlocked / workspace / return-block / hashFile 各单点（同逻辑复制零——grep 断言）；规则死代码零
  3. ⑤ **F 错误收编**——全部手动 throw 归 exit.ts：面向编排者可恢复错误统一为 `CddExitError` 家族（exitCode + kind；0/1/2/3 退出码表不变）；库内断言统一走 `invariant(cond, msg)` 工厂；⑥ **G 架构纪律回写运维文档**（分层边界 · 机制锚点上链 · 错误收编三纪律） — checkable: **全部手动 throw 经 exit.ts**（生产代码 `throw new Error` 裸用零——grep 断言）；退出码表 0/1/2/3 不变（黑盒 exit-code 断言原样绿）；运维文档含架构三纪律；engine suite 全绿 + validate 12 块全绿

- **Acceptance**:
  - branch 族继承 DispatchLifecycle（branch-review/branch-fix 零手写 lifecycle——withLifecycle 内联零、writeBranchBlocked/writeBranchFixBlocked 单点化）；rules⇄artifacts 直接循环依赖零（schema⇄finalize / failure⇄progress 拆——vite 循环依赖断言或 graph 检查）；Convergence / writeBlocked / workspace / return-block / hashFile 各单点（同逻辑复制零——grep 断言）；rules/convergence.ts 孤岛（若删）· infra/log · cli/review 死 import 零；**全部手动 throw 经 exit.ts**（生产代码 `throw new Error` 裸用零——全部换 CddExitError 家族 / invariant 工厂；grep 断言）；退出码表 0/1/2/3 不变（黑盒 exit-code 断言原样绿）；运维文档含架构三纪律（program-experience「架构纪律」节 + osuperpowers-plugin 引用）；engine suite 全绿 + `pnpm run validate` 12 块全绿


### Task 25: 载体成熟——settleResidue / writeBoundary / recovery carrier（spec T7.4；overall v1.51 / spec v1.13 回填）

- **Objective**: 载体成熟——settleResidue / writeBoundary / recovery carrier（spec T7.4）：残局归属 + 纯软归属记账 + 恢复 carrier
- **DependsOn**: none
- **AtomicWith**: none

- **Produces**: settleResidue（EXECUTION_FAILURE/TIMEOUT + 树脏 → git stash push -u → recovery carrier 含 ref + 规模）；writeBoundary（changes[] 归属记账 + diff⊄changes[] → CDD_WARN 绝不 BLOCK + scope-composition 轴）；recovery carrier（结构化 recovery 字段 + §35 语义自足零阶段 anchor）

- **Files**: packages/cdd-engine/src/dispatch/base.ts, packages/cdd-engine/src/dispatch/task.ts, packages/cdd-engine/src/templates or engine-config, packages/cdd-engine/templates/schema/task-handoff-schema.json, packages/cdd-engine/templates/schema/docs-handoff-schema.json, packages/cdd-engine/templates/template-contract.json, packages/cdd-engine/src/dispatch/branch.ts, docs/maintainers/program-experience.md

- **Steps**:
  1. ① **settleResidue（残局归属）**——DispatchLifecycle 模板方法增 post-flight 步骤（commitPostCheck 前）：EXECUTION_FAILURE/TIMEOUT + 工作树脏 → engine 自动 `git stash push -u`（纯对象库保全、message 含 task/round 标注）→ stash ref + WIP 规模写入 recovery carrier（blocker 只留人读散文）；CONTRACT_VIOLATION 类**不自动吞** — checkable: EXECUTION_FAILURE/TIMEOUT + 树脏 → recovery carrier 含 stash ref + 规模（黑盒 + 单测）；`git stash list` 可见快照、apply 后 diff 与死前一致（可抢救实证）
  2. ② **writeBoundary（纯软归属记账，不再 BLOCK）**——implement/fix handoff `changes[]`（每项 file + reason）入 task/docs schema；机械对账 `git diff <base>..HEAD` 文件集 ⊄ changes[] → 仅 `CDD_WARN`（stderr + notes），**绝不 BLOCK**；校验兜底上移评审层：`template-contract.json#reviews` 四 type axesGuide 增 **scope-composition 轴** + 共享壳 Instructions 增「改动面合理性」检查 — checkable: fix 轮 diff 越 findings 文件集 → 结构化 finding/BLOCK（T23/branch-fix 复现场景红→绿）；scope 轴（grep/渲染断言）
  3. ③ **recovery carrier**——task/docs handoff schema 增结构化 `recovery` 字段（cause / exit_code / residue_ref / wip_stat / preserved）+ schema description 承载契约 · **语义自足（§35）**——注入面零阶段 anchor（`T\d+/P\d+` 零命中）· 机制名自足（changes[] = changed-file attribution ledger · recovery = residue recovery carrier）；④ 恢复路径契约更新（`git stash list` 检索 → apply 评审 → commit 或 drop → re-dispatch） — checkable: recovery schema field 双 schema description 承载 + prompt 零散文；EXECUTION_FAILURE blocker 区分 exit 1 / 143 / TIMEOUT；旧「discard or commit」残留文案零（grep）；**注入面零阶段 anchor**——template-contract/schema description grep `T\d+|P\d+` 零命中；engine suite 全绿 + validate 12 块全绿

- **Acceptance**:
  - EXECUTION_FAILURE/TIMEOUT + 树脏 → recovery carrier 含 stash ref + 规模（黑盒 + 单测）；`git stash list` 可见快照、apply 后 diff 与死前一致（可抢救实证）；fix 轮 diff 越 findings 文件集 → 结构化 finding/BLOCK（T23/branch-fix 复现场景红→绿）；recovery schema field 双 schema（task/docs）description 承载 + prompt 零散文验证；EXECUTION_FAILURE blocker 区分 exit 1 / 143 / TIMEOUT；旧「discard or commit」残留文案零（grep）；**注入面零阶段 anchor**——template-contract/schema description grep `T\d+|P\d+` 零命中（residue 守卫断言 + §35 执法）；engine suite 全绿 + `pnpm run validate` 12 块全绿


### Task 26: 派发终止契约 + 续传——termination monitor + resume-from-residue（spec T7.5；overall v1.52 / spec v1.14 回填）

- **Objective**: 派发终止契约 + 续传——termination monitor + resume-from-residue（spec T7.5）：stall/budget 两信号合一 + resume 续传 + legacy 检索兜底
- **DependsOn**: none
- **AtomicWith**: none

- **Produces**: termination monitor 统一（信号① stall · 信号② budget → killGroup + TIMEOUT + cause 化 blocker；SIGTERM 外部信号并入 cause）；删除面（三 env 键 · perMode/globalOverride 两段 · execa timeout 通道 · resolver 并一）；resume-from-residue（recovery.residue_ref → git stash apply + brief residue 附言 + legacy stash 检索兜底）

- **Files**: packages/cdd-engine/src/infra/proc.ts, packages/cdd-engine/src/dispatch/task.ts, packages/cdd-engine/src/dispatch/branch.ts, packages/cdd-engine/src/dispatch/docs.ts, packages/cdd-engine/src/render/brief.ts, packages/cdd-engine/templates/engine-config.json, packages/cdd-engine/src/infra/invoke.ts

- **Steps**:
  1. ① **termination monitor 统一**——`infra/proc.ts` `spawnManaged` 内并为一个判定层：信号① stall（活性 primary——CPU + workspace mtime 无推进 → killGroup + cause="stalled"）· 信号② budget（last-resort cap——墙钟 elapsed ≥ budget → killGroup + cause="over-budget"）；沿用既有 killGroup + TIMEOUT 分类 + blocker 单点；SIGTERM 并入 cause（three cause 可区分） — checkable: `spawnManaged` 单一 termination 判定层（stall/budget 两信号、cause 化 blocker——stalled/over-budget 黑盒可区分）+ `resolveTerminationConfig` 单点
  2. ② **删除面**——三 timeout env 键解析移除 · config perModeOverride/globalOverride 两段删 · execa timeout/forceKillAfterDelay 通道废除 · `resolveTimeoutMs`/`resolveLivenessConfig` 并为一个 `resolveTerminationConfig()` 单读点 · 三岛两参并一参 — checkable: 三 env 键零读取（grep 断言）+ config 无 perMode/globalOverride 两段 + execa 无 timeout 通道
  3. ③ **resume-from-residue（续传）**——re-dispatch pre-flight 检测上轮 recovery carrier：读 `recovery.residue_ref` → `git stash apply` 恢复 WIP → `render/brief.ts` 增「residue 现状附言」段（data-driven from carrier，零 anchor）→ 新 agent 先审计 WIP 再续作；**legacy stash 检索兜底（v1.9 缺陷修复）**——`recovery.residue_ref` 缺失时按标准化 stash message（`cdd-<op>-<type>-<task>-<round>-<cause>`）扫描 `git stash list` 匹配恢复 — checkable: **续传黑盒**——TIMEOUT 保全 → re-dispatch → WIP 出现在新工作树 + brief 含 residue 附言 + agent 增量改动（非重写）；**legacy 检索兜底黑盒**——ref 缺失的历史 TIMEOUT handoff → 检索匹配 → WIP 恢复；**恢复轮声明 base 采纳（v1.10 契约）**——引擎采纳车道（≠HEAD + 祖先校验）重建 commits.base/scope 账本；退出码表不变

- **Acceptance**:
  - `spawnManaged` 单一 termination 判定层（stall/budget 两信号、cause 化 blocker——stalled/over-budget 黑盒可区分）+ `resolveTerminationConfig` 单点；三 env 键零读取（grep 断言）+ config 无 perMode/globalOverride 两段 + execa 无 timeout 通道；**续传黑盒**——TIMEOUT 保全 → re-dispatch → WIP 出现在新工作树 + brief 含 residue 附言 + agent 增量改动（复现 T25 场景：从 0 行到 727 行再续作，非重写）；**legacy 检索兜底黑盒**——`recovery.residue_ref` 缺失的历史 TIMEOUT handoff（stash message 带 `cdd-<op>-<type>-<task>-<round>-<cause>` 标注）→ 检索匹配 → WIP 恢复；recovery.residue_ref 契约双 Task 一致（T25/T26 衔接断言）；退出码表 0/1/2/3 不变；engine suite 全绿 + `pnpm run validate` 12 块全绿；**恢复轮声明 base 采纳（v1.10 契约）**——重新派发 implement 时 TASK_BASE==HEAD（恢复签名）→ agent return-block `commits:` 行声明的真实范围起点被引擎采纳（≠HEAD + 祖先校验）→ review 范围 = `声明..HEAD` 全量（T26 实证：bde88ec5..HEAD 非空，杜绝空范围零审查）


### Task 27: 任务级 scope 账本——roundBase/scopeBase 分离（spec T7.6；overall v1.54 / spec v1.16 回填）

- **Objective**: 任务级 scope 账本——roundBase/scopeBase 分离（spec T7.6）：scope_base earliest-wins + 恢复轮声明采纳 + fixed-point 源改读账本
- **DependsOn**: none
- **AtomicWith**: none

- **Produces**: progress tasks[N] 增 `scope_base`（引擎唯一写者、earliest-wins · 恢复声明 base 严格早于当前账本值才允许前移）；finalizeImplement 恢复轮声明采纳（≠HEAD + 祖先校验，fresh 永不采纳）；review/fix 固定点读账本（legacy 回落）；settleResidue 记 recovery.scope_base

- **Files**: packages/cdd-engine/src/artifacts/progress.ts, packages/cdd-engine/src/artifacts/handoff/finalize.ts, packages/cdd-engine/src/dispatch/task.ts, packages/cdd-engine/src/dispatch/base.ts

- **Steps**:
  1. ① **scope 账本（progress 引擎自有）**——`artifacts/progress.ts` tasks[N] 增 `scope_base`（引擎唯一写者）：首轮 implement seed = brief TASK_BASE · **earliest-wins**（后续轮 TASK_BASE 快照不覆盖；恢复声明 base 严格早于当前账本值【仍是 HEAD 祖先】才允许前移）· 账本缺失回落现有链 — checkable: progress.json tasks[N].scope_base 存在且 earliest-wins（重派实现车不覆盖实证）
  2. ② **恢复轮声明采纳**——finalizeImplement：材料化 `base==head`（恢复签名）且 return-block `commits: base=` 声明存在 → 校验（≠ HEAD 且 HEAD 祖先——`git merge-base --is-ancestor`）→ 以声明为 `commits.base`；fresh implement（base≠head）永不采纳 agent base — checkable: 恢复轮声明 base 被引擎采纳（祖先校验 + ≠HEAD + fresh 拒绝三车道黑盒）
  3. ③ **fixed-point 源改读账本**——`dispatch/task.ts` review/fix 固定点推导读 progress `scope_base` 优先，legacy 行回落既有链；④ **settleResidue 同步**——recovery carrier 记 `recovery.scope_base`（账本值优先 / fallback 死轮 brief TASK_BASE）；⑤ 测试：单测（earliest-wins · 祖先校验拒伪造 · 账本缺失回落）+ 黑盒（恢复轮声明 base → REVIEW_REFERENCE = `声明..HEAD` 非空） — checkable: review/fix 固定点 = 账本值（T26 实证：REVIEW_REFERENCE = `bde88ec5..HEAD` 非空）；settleResidue 记 recovery.scope_base；常规任务 review/fix 行为零变化（全量 suite 绿）；注入面零阶段 anchor；退出码表不变；engine suite 全绿

- **Acceptance**:
  - progress.json tasks[N].scope_base 存在且 earliest-wins（重派实现车不覆盖实证）；恢复轮声明 base 被引擎采纳（祖先校验 + ≠HEAD + fresh 拒绝三车道黑盒）；review/fix 固定点 = 账本值（T26 实证：REVIEW_REFERENCE = `bde88ec5..HEAD` 非空）；settleResidue 记 recovery.scope_base；常规任务（无恢复）review/fix 行为零变化（全量 suite 绿）；注入面零阶段 anchor（§35 residue 守卫零命中）；退出码表 0/1/2/3 不变；engine suite 全绿 + validate 12 块全绿


### Task 28: residue save 侧单点收敛——双 owner 归一（spec T7.7；overall v1.56 / spec v1.18 回填）

- **Objective**: residue save 侧单点收敛——双 owner 归一（spec T7.7）：save 全族归 artifacts + 幂等守卫 + adapter + 标准化 message
- **DependsOn**: none
- **AtomicWith**: none

- **Produces**: `artifacts/residue.ts` 收 save 全族（recoveryEligible · RESIDUE_PRESERVED_CAUSES · preserveAndAnnounceResidue + `preserved` 幂等守卫)；`settleFromCarrier` adapter（自 carrier + 文件名派生 op/type/task/round/cause）；`rules/residue.ts` 整删 · `gitStashPreserve` 删；标准化 stash message

- **Files**: packages/cdd-engine/src/artifacts/residue.ts, packages/cdd-engine/src/rules/residue.ts, packages/cdd-engine/src/infra/git.ts, packages/cdd-engine/src/dispatch/base.ts, packages/cdd-engine/src/dispatch/branch.ts, packages/cdd-engine/src/artifacts/__tests__/residue-save.test.ts

- **Steps**:
  1. ① **save 全族单 owner 归 `artifacts/residue.ts`**——recoveryEligible / RESIDUE_PRESERVED_CAUSES 迁入 · preserveAndAnnounceResidue 归位 · **`preserved` 幂等守卫**（settleResidue 写 recovery 时置 preserved=true，已保全轮跳过）；② **`settleFromCarrier(cwd, handoffPath, repoRoot?)` adapter**——自 carrier + 文件名派生 op/type/task/round/cause → 调 canonical settleResidue（统一标准化 stash message `cdd-<op>-<type>-task-N-rN-cause`） — checkable: artifacts/residue.ts 为 save 唯一 owner（rules/residue.ts 不存在、`gitStashPreserve` 零定义、`cdd residue:` 零残留）；implement TIMEOUT 黑盒恰一张 stash + `residue_ref` 指向标准化 message + re-dispatch resume 还原成功；preserved 幂等守卫单测绿
  2. ③ **删除面**——`rules/residue.ts` 整文件删 · `infra/git.ts` `gitStashPreserve` 删（gitStashPush/Apply/List 保留）· 相关无引用面随删；④ **双触发验证**——黑盒：implement TIMEOUT（假 CLI）恰一张 stash（task 车道 pre-write preserved → 模板钩子幂等跳过）+ carrier recovery 指向标准化 stash + resume 可还原 — checkable: base 钩子 / branch 内联 / task 车道三路径同契约（标准化 message 断言）；CONTRACT_VIOLATION 不自动吞（既有守卫）；注入面零阶段 anchor；退出码表不变；engine suite 全绿 + validate 12 块全绿

- **Acceptance**:
  - artifacts/residue.ts 为 save 唯一 owner（rules/residue.ts 不存在、`gitStashPreserve` 零定义、`cdd residue:` 零残留）；implement TIMEOUT 黑盒恰一张 stash + `residue_ref` 指向标准化 message 的 stash + re-dispatch resume 还原成功（既有 T26 resume 黑盒复用）；template 钩子 + 车道共存幂等（preserved 守卫单测）；base 钩子 / branch 内联 / task 车道三路径同契约（标准化 message 断言）；CONTRACT_VIOLATION 不自动吞（既有守卫）；注入面零阶段 anchor（residue 守卫断言零命中）；退出码表 0/1/2/3 不变；engine suite 全绿 + validate 12 块全绿


### Task 29: 引擎 lifecycle 统一校验——docContractValidate + statusValidate（spec T7.8；overall v1.58 / spec v1.19 回填）

- **Objective**: 引擎 lifecycle 统一校验——docContractValidate + statusValidate（spec T7.8）：三类必要契约 + 六态收敛状态机 + 双钩子
- **DependsOn**: none
- **AtomicWith**: none

- **Produces**: 共享校验模块（plan/phase spec/overall 三类必要契约）；`docContractValidate` 钩子（pre-flight，failures → blocked exit 1 + guidance；dry-run 同检 WARN）；`deriveTaskState` 六态收敛状态机 + `statusValidate` 钩子（post-flight，CDD_INFO 状态 + 计划裁决）

- **Files**: packages/cdd-engine/src/rules/documents.ts, packages/cdd-engine/src/dispatch/base.ts, packages/cdd-engine/src/rules/status.ts, packages/cdd-engine/src/artifacts/progress.ts

- **Steps**:
  1. ① **共享校验模块**——三类必要契约：plan（`### Task N:` 连续可提取 · `**Spec:**` 存在且指向现有 spec · constraints 源声明可提取 · 无占位符）、phase spec（Parent program 链接指向存在 overall · 目标 phase 已注册 · 版本行格式）、overall（phase inventory canonical 表头 · 行形守卫 · 目标 phase 行存在 · 版本升序）；README/返回值：failures[]（物料/字段/缺什么/怎么修——指导信息） — checkable: implement/review/fix 每轮自动跑 docContractValidate（无效物料 → blocked exit 1 + 指导信息；三类 doc 各一 invalid fixture 黑盒）
  2. ② **`docContractValidate` 钩子**（DispatchLifecycle pre-flight）：校验当前派发 task 的 plan + 其 spec + parent overall；failures 非空 → blocked exit 1 + stderr 指导信息；dry-run 同检（WARN 语义）；③ **六态收敛状态机**——`deriveTaskState(workspace, taskNum)`：in-flight / needs-review / needs-fix / **needs-re-review** / resume-pending / complete — checkable: statusValidate 每轮输出六态当前状态 + 计划裁决（T14 类 needs-re-review 显式可行动）
  3. ④ **`statusValidate` 钩子**（post-flight）——reconcile 当前任务状态 + 计划完成度裁决（plan `### Task N:` 集 ↔ 六态表）→ CDD_INFO；⑤ 测试：三类 doc invalid / 六态各通道派生 / 计划裁决 / 正常派发黑盒；⑥ 边界：引擎零文档写入、零载体 schema 变更、零新增 CLI 面（唯一新增面 = lifecycle 两钩子） — checkable: 「plan Done」终态声明对应引擎裁决 all-complete；退出码表不变；engine suite 全绿 + validate 12 块全绿；零新 CLI 面/零文档写入/零 schema 变更（grep 断言）

- **Acceptance**:
  - implement/review/fix 每轮自动跑 docContractValidate（无效物料 → blocked exit 1 + 指导信息；三类 doc 各一 invalid fixture 黑盒）· statusValidate 每轮输出六态当前状态 + 计划裁决（T14 类 needs-re-review 显式可行动）· 「plan Done」终态声明对应引擎裁决 all-complete · 退出码表 0/1/2/3 不变 · 引擎 suite 全绿（新增被钩子触达的用例）+ `pnpm run validate` 12 块全绿 · 零新 CLI 面/零文档写入/零 schema 变更（grep 断言）


### Task 30: TaskState 单源统一 + 状态判定修正（spec T7.9；overall v1.59 / spec v1.20 回填）

- **Objective**: TaskState 单源统一 + 状态判定修正（spec T7.9）：deriveTaskState 判定修正 + progress status 字段删除
- **DependsOn**: none
- **AtomicWith**: none

- **Produces**: deriveTaskState 判定修正（以最后 review 状态为第一信号）；progress.json `tasks[N].status` 字段删除（TaskState 纯派生、账本只存事实）；消费迁移（所有读 progress-row status 处改走 deriveTaskState）

- **Files**: packages/cdd-engine/src/rules/status.ts, packages/cdd-engine/src/artifacts/progress.ts, packages/cdd-engine/src/artifacts/__tests__/progress-owner.test.ts, packages/cdd-engine/src/rules/__tests__/（statusValidate 裁决用例）

- **Steps**:
  1. ① **deriveTaskState 判定修正**（rules/status.ts）——以**最后 review 状态为第一信号**：最后 review APPROVED → complete（其后的 fix 为合法终局，非重审触发——修正 T29 实证的 28 个误判）；最后 review 非 APPROVED → 后有 fix → needs-re-review / 无 fix → needs-fix；无 review → implement 车道四态；删除 counts 相等（reviews===fixes）的误判逻辑 — checkable: deriveTaskState 唯一 TaskState 来源（grep：progress tasks[N].status 写入/读取点归零——仅 readProgressJSON 迁移兼容读取）；T29 复现场景翻转（28 合法终局 → complete，T14 类 needs-re-review 保留）
  2. ② **TaskState 单源**——progress.json `tasks[N].status` 字段删除：ProgressData 类型去 status · task.ts 写回降为「确保行在」（complete 语义 = deriveTaskState 唯一权威）· createEmptyProgress 不再 seed status · readProgressJSON 迁移兼容旧行含 status（忽略不报错）；③ **消费迁移**——所有读 progress-row status 处改走 deriveTaskState（逐一核对：handoffStatus/statusValidate/runner/smoke） — checkable: progress 行写回后无 status 字段；readProgressJSON 对含 status 旧行零报错（迁移兼容）；合法终局链绿 · T14 类绿 · 无 review implement 车道四态绿；退出码表不变；engine suite 全绿 + validate 12 块全绿

- **Acceptance**:
  - deriveTaskState 唯一 TaskState 来源（grep：progress tasks[N].status 写入/读取点归零——仅 readProgressJSON 迁移兼容读取）；T29 复现场景翻转（28 个合法终局 → complete，T14 类 needs-re-review 保留）；progress 行写回后无 status 字段；readProgressJSON 对含 status 旧行零报错（迁移兼容）；退出码表 0/1/2/3 不变；engine suite 全绿 + validate 12 块全绿


### Task 31: src 注释锚首清零执法——residue 守卫扩展 + 67 处排修（spec T7.10；overall v1.60 / spec v1.21 回填）

- **Objective**: src 注释锚首清零执法——residue 守卫扩展 + 67 处排修（spec T7.10）
- **DependsOn**: none
- **AtomicWith**: none

- **Produces**: residue 守卫新增「src 注释禁锚首」检查（`packages/cdd-engine/src/**/*.ts` 注释首个有效 token ∈ 阶段锚 regex 族 → FAIL；合法 trailing/文件头保留）；引擎 67 处锚首注释改为语义前置

- **Files**: scripts/validate/residue.ts, packages/cdd-engine/src/（67 处注释排修面）, scripts/validate/__tests__/residue.test.ts

- **Steps**:
  1. ① **residue 守卫扩展**（scripts/validate/residue.ts）——新增「src 注释禁锚首」检查：`packages/cdd-engine/src/**/*.ts` 注释内容**首个有效 token** ∈ 阶段锚 regex 族（`P\d+` / `T\d+(\.\d+)?` / `Task \d+` / `spec T\d+`）→ 结构化 FAIL（含文件+行）；**合法形态保留**：文件头以路径/模块名开头（锚可 trailing 括注内）、锚作 trailing 溯源后缀、纯语义散文；守卫进 5c 面并在 scripts unit 断言（新用例：合法 trailing 绿 / 锚首红 / 文件头绿） — checkable: residue 锚首检查零违规（引擎 src 无任何注释以阶段锚开头——67 处清零）；合法 trailing 溯源后缀与文件头形态不被误报
  2. ② **引擎排修**——全引擎 src 67 处锚首注释改为**语义前置**（锚移尾或删除，语义不失真；逐条人工复核非机械替换） — checkable: §35 注入面零锚首守卫不变；engine suite 全绿 + validate 12 块全绿（注：实证 = 用户 2026-09-21 发问 T29/T30 新注释含锚首形态 + 引擎历史 67 处；执法 = 机械守卫 + 排修，不留债）

- **Acceptance**:
  - residue 锚首检查零违规（引擎 src 无任何注释以阶段锚开头——67 处清零）；合法 trailing 溯源后缀与文件头形态不被误报（守卫用例绿）；§35 注入面零锚首守卫不变；engine suite 全绿 + validate 12 块全绿
