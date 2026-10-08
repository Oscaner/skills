# 文档架构方法论 v2 — P3.2 Implementation Plan（全系统从零重建 greenfield）

**Spec:** [2026-10-02-doc-architecture-v2-p3.2-design.md](docs/kairos/specs/2026-10-02-doc-architecture-v2-p3.2-design.md)

- **Parent program**: [2026-10-02-doc-architecture-v2-overall.md v1.26](docs/kairos/specs/2026-10-02-doc-architecture-v2-overall.md)
- **Version**: v1.18 · 2026-10-08（**wave-board 展示定案**（用户 2026-10-08 拍板「修法 hack——DependsOn/Wave 推导没处理好·更新 plan」）：plan-graph 展示 = 引擎自持 wave-board（每 wave 一行 · 确定性 · 零第三方 · 零补丁 · wave chain 不再需要）· beautiful-mermaid 退役（不控布局出自 hack = 技术债）· 消费面 reduction 透传保持——spec v1.15 · overall v1.32 随）；前置 v1.17 · 2026-10-08（**plan-graph wave 标签**——渲染器布局不保 wave 序，节点盒内 `T17 · W13` 标签承载 · 消费面 reduction 保持——spec v1.14 · overall v1.31 随）；前置 v1.16 · 2026-10-08（**直依赖引擎约简 backfill**（用户 2026-10-08 拍板「direct-only 是引擎问题——否则重派丢上下文」）：引擎消费面 = transitive-reduction（`#depsOf` 约简 · validate 读原始声明 · 闭包/wave 不变）· plan-graph 按 wave 深度排序（TB 层级 = 最长路径 = wave index）· lint 传递冗余 advisory——spec v1.13 · overall v1.30 随）；前置 v1.15 · 2026-10-08（**plan-graph 渲染定案——引入 `beautiful-mermaid`**（用户 2026-10-08 拍板「直接引入第三方」）：T24 读面渲染 = `beautiful-mermaid` 第三方（elkjs 布局 · mermaid → ASCII 盒图）· 引擎 emit flowchart LR + renderMermaidASCII —— spec v1.12 · overall v1.29 随）；前置 v1.14 · 2026-10-08（**T24 扩域——波次读面 `plan-graph`**（用户 2026-10-08 拍板「知情权」）：`cdd schema get plan-graph –-plan` 只读分支 · `TaskGraph.report(done)` 一投影两显示（读面 + pre-flight 门输出）· 进度 = ledger 闭环复用不复制——spec v1.11 · overall v1.28 随）；前置 v1.13 · 2026-10-08（**T24 扩域——波次 pre-flight 接线**（用户 2026-10-08 拍板「review plan 加 wave pre-flight 前置校验」）：`DependsOn` 值域契约（首 `(` 前列表 · 注释零参与）· `TaskGraph.validate()` 接线三处门（review plan 前置 · implement 派发前置 · `--tasks` 拆派生波 → BLOCK）· 派生波表随门输出——spec v1.10 · overall v1.27 随）；前置 v1.12 · 2026-10-08（**严格派生波次 + P5 补遗重写**（用户 2026-10-08 拍板「严格派生波次·零手工拆组·重写 plan·全 backfill」）：派发 = `effectiveGroups` 唯一（零手工拆组 · 历史拆组 W5/W8 记偏差）· 新 **T25 = P5 承接补遗**（refKind 四型 · skills 有序链 · capabilities per-harness · DependsOn 16）· **T17 终验后置**（16,25）· T21 承接范围澄清（M1/禁文/refs/准则——漏映射三件归 T25）· spec 层 P4–P7 「Done 宣言」作废（承接映射表，状态以 plan 任务为准）——spec v1.9 · overall v1.26 随）；前置 v1.11 · 2026-10-08（**T15 收口 review backfill**（用户 2026-10-08 六前提复盘 · T15 真实探针后）：FIX_BASE 锚=评审 head · task review `INPUT_RANGE`=TASK_BASE..HEAD · review per-type 固定前缀（criteria/lens 折入 · spec/plan lens 补）· work 公共尾 shared · 孤儿键删 · evidence 命名家族字首化——spec v1.8 随）；前置 v1.10 · 2026-10-08（**fix 面 readback 后缀措辞**——用户 2026-10-08 拍板「`first read <findings> back to confirm` → `read file back to confirm`」：FIX_READBACK_SUFFIX 字串随改 · T23 词面同步）；前置 v1.9 · 2026-10-08（**handoff 契约面 rewrite——T15 收口扩域**——用户 2026-10-08 拍板（kill T15 implement 停摆析因）：T15 在 cutover + dispatch 调用面（v1.8）之上扩 **handoff 契约面整改**（spec v1.7 随）：per-mode 可写子集 schema 注入固定前缀（implement→evidence · fix→fix+evidence · review/docs-fix→findings）· review 家族统一 RETURN_STDOUT_BLOCK（RETURN_JSON/DOCS_FIX 退役）· **test-evidence schema 化 + 引擎真读回**（第二个虚设补钉）· `## Handoff` 散文 + HANDOFF_WRITE_GATE 清理 · 引擎读回重建（child draft → 校验 → 物化同路径 · 失败 = 不覆盖 + BLOCK + crash record + resume）——spec v1.7 随）；前置 v1.8 · 2026-10-08（**T22 单文件裁定 + dispatch 调用面纪律 + child prompt 分派表 backfill**——用户 2026-10-08 拍板三连，spec v1.6 随：① **T22 宪法化折为单文件**（overall 保持一份文件、零 `-archive.md`——宪法化 = 单文件内结构化收敛（Standing rules 成典 · 版本行 lineage 消解 → 结构化修订记录 · change-history cell → 结构化 record）· declare.ts 登记行不简化 · 全树 4 overalls 同口径迁移）· ② **T15 cutover 首验补丁**（新引擎 dispatch child 缺 prompt——slash-ref 独立位置参数被 claude 吞 → HOSTS `promptForm` 数据列 + 单位置参数 + 真实探针双门槛，T13 假阳「新树全绿」补密钥）· ③ **child prompt 分派表**（mode 分派表 + 每 mode 固定前缀缓存友好 + per-mode round context 精简子集 + 参数规整命名 INPUT_/OUTPUT_/WORKSPACE_/FIX_BASE/ROLE/SCOPE——T11/T12/T13 面随波收敛，T15 实现收口））；前置 v1.7 · 2026-10-08（**反依赖门放开 backfill——T24 边违约五类收编 + 环活门**——用户 2026-10-08 拍板「放开『任务只能依赖更小编号』约束，Wave 编排完全基于 DependsOn 推导」：TaskGraph contradiction 边违约类退役 · **前向引用合法**（`- **DependsOn**:` 可指向任意现存任务 id）· **cycle 类活门**（环 = 具名违约 · doc-contract 早拦/评审派发 BLOCK）· **编号降级 ID + 波内升序 tiebreak** · referenceLint 新增**编号/拓扑序 advisory WARN**（只警不拦）· 引擎面 = **新任务 T24（W12 · DependsOn 2,5,6,15）** · 技能面 cdd-plan 作者句随波收敛——spec v1.5 随 · 现 plan 全低编号边零迁移）；前置 v1.6 · 2026-10-08（**`next:` 形式补钉**——用户 2026-10-08 拍板「先落补钉再执行」：胶囊 `next:` 渲染 = Route 事实（kind+载荷 · 非完整 cdd 命令）——Route 事实型钉入 T7 · 渲染断言钉入 T10 capsule 面，T16 技能面以「事实 → 命令映射」为消费前提——旧树命令式提示取消的涌现形态补为决策）；前置 v1.5 · 2026-10-08（**T23 next fix 面 readback 后缀**——用户 2026-10-08 拍板「NextStepRouter `kind: fix` 时补 `(read file back to confirm)`」：旧树 readbackWording 设计意图于新架构落地为纯文案提示 · 机械防线由 ledger round/C5-1 兜 · 编排方是否遵守非强约束——plan review-2 闭合后追加）；前置 v1.4 · 2026-10-07（前置 v1.3 = P7 提前承接 backfill——T19 翻译系统 · T20 base 命令面；**v1.4 = P4/P5/P6/P7 全吸收 + 数据面归位 backfill**——用户 2026-10-07 拍板「config-next 完成以后删除 config」+「都是一体的」+「吸收进 P3.2」升华：**T21 数据面归位**（三稳态 JSON → typed 平面 infra/runtime · face/host · render/templates，P4/P5 承接净入——M1 supersede · refs 登记 · 三处禁文删除 · review 准则收口 · 零读 config/ · 导出面保持）· **T22 宪法化承接（P6）**（overall 拆宪法/archive · 版本行散文消解 · Standing rules 成典 · 全树 4 overalls）· **T15 扩域删 config/**（整目录零残留，零重建）· T14 认领 skill-anatomy 归位 · T16 CLAUDE.md/README 数据面同步——overall v1.23 · spec v1.4 随））））
- **Depends on**: P3.1（Done）· P3.2 design spec v1.9（Approved · 2026-10-08）
- **Base**: develop

执行序：新树 `src-next` 自底向上建齐（骨架 → contract → session → face → infra/render → bin）→ 引擎测试全绿 → `scripts-next` 重写 → cutover（入口切换 + 删旧树 + **`scripts-next` → `scripts` 改名**）→ 技能 8→6 → P5 承接补遗 → 终验。新旧零依赖贯穿全计划（T1 起 grep 断言、每任务自测）。

**严格派生波次纪律（v1.12 · 用户 2026-10-08 拍板）**：派发 **EXACTLY `effectiveGroups`** —— 引擎 TaskGraph 由 `- **DependsOn**:` 边推导的 ready batch（波内升序），一架一轮，**零手工拆组**（`--tasks` 只取完整派生组）；任何拆组/重排 = Plan Sole Writer 的**边修订**（改 DependsOn 重推导），绝无 ad-hoc 子集派发。已发生的历史拆组——派生 W5 `{7,9,18}` 拆 `{7,9}`+`{18}` · 派生 W8 `{13,19,20,23}` 拆 `{13}`+`{19,20}`+`{23}`——记录为偏差（其成员均已闭环，不重派）；T24 的「Wave 推导纯边驱动 · 编排方零手动位移」从任务语义升为全计划硬纪律。

### Task 1: 骨架——src-next 5 平面 + 双面构建 + 零依赖断言

- **Objective**: 建立 `packages/cdd-engine/src-next/` 五平面骨架（contract/session/face/render/infra + bin.ts），tsconfig 双 include、vitest 独立 project，零跨树依赖 grep 断言起立
- **Files**: `packages/cdd-engine/src-next/`（建五平面骨架：contract/session/face/render/infra）· `packages/cdd-engine/tsconfig.json`（include 增 `src-next`）· `packages/cdd-engine/vitest.config.ts`（增 src-next project）· `packages/cdd-engine/src-next/__tests__/zero-dep.test.ts`（新建）
- **Consumes**: 无（从零起建）
- **Produces**: `src-next/` 五平面骨架 · tsconfig/vitest 双面 · `zero-dep.test.ts`（双向零 import grep）
- **Steps**:
  - 建 `src-next/{contract,session,face,render,infra}` 五个平面目录 + `src-next/bin.ts` 占位 — checkable: 五目录 + 入口存在
  - 改 `tsconfig.json` include 增 `src-next/**`（与 `src/**` 并存）— checkable: `tsc -p packages/cdd-engine --noEmit` 对空骨架通过
  - 改 `vitest.config.ts` 增独立 project（include `src-next/**/__tests__/**/*.test.ts`），旧 `src` tests 配置不动 — checkable: vitest 列表同时含 src 与 src-next 两个 project
  - 写 `zero-dep.test.ts`：grep `src-next` 内 import 声明不得引用 `../src/` 或 `src/` 旧符号（双向）— checkable: 空骨架下测试绿
  - `git commit -m "feat(engine): P3.2 src-next 骨架 + 双面构建 + 零依赖断言"`（committed 前跑 TDD 自测绿）
- **Acceptance**:
  - `src-next` 五平面 + bin.ts 占位存在；tsconfig/vitest 双面绿
  - `zero-dep.test.ts` 绿（任意 src-next 文件 import 旧树 → 测试失败）
- **DependsOn**: none

### Task 2: contract · declare——三 doc 类型元素登记表

- **Objective**: `src-next/contract/declare.ts` 定义元素登记表契约（ElementRegistry：锚 token · presence · value pattern · ref kind · 归属面）并落地 overall/plan/phase-spec 三份 typed 声明数据
- **Files**: `packages/cdd-engine/src-next/contract/declare.ts`（新建）· `packages/cdd-engine/src-next/contract/__tests__/declare.test.ts`（新建）
- **Consumes**: T1 骨架
- **Produces**: `ElementRegistry` 类型 + `declaredRegistries: { overall, plan, phaseSpec }`（声明数据，判定/派生/消费的单一真相）
- **Steps**:
  - 定义 `ElementRegistry` 接口（element: { anchor, presence, valuePattern?, refKind?, home }）+ 类型守卫 — checkable: 类型测试过
  - 三份登记表数据（overall/plan/phase-spec 各 20–40 元素，量级按方法论文档骨架枚举——overall 章节面 · plan 任务块+头字段 · phase-spec 骨架面，登记表只多不少；锚取自骨架语义，不得从旧树拷贝代码）— checkable: 每型 ≥20 元素（计数断言）且每元素过类型校验
  - 写 declare.test：登记表完整性（presence 合法域 · 锚唯一 · refKind 枚举内）— checkable: test 绿
  - commit `feat(engine): contract/declare 三登记表`（自测绿后）
- **Acceptance**:
  - 三登记表存在；每元素五字段齐全；锚唯一性测试绿；每型 ≥20 元素（计数断言入 acceptance，防少写）
  - 零 import 旧树（zero-dep 测试仍绿）
- **DependsOn**: 1

### Task 3: contract · project——派生投影（shape/schema/slices/tokens/reference）

- **Objective**: `src-next/contract/project.ts` 从登记表派生五投影：shape 投影（section 结构面，旧 955 行散文不继承）· JSON schema（字节从新树首版即钉）· slices 解析 regex · tokens · reference 词汇
- **Files**: `packages/cdd-engine/src-next/contract/project.ts`（新建）· `src-next/contract/__tests__/project.test.ts`（新建）
- **Consumes**: T2 `declaredRegistries`
- **Produces**: `projectRegistries()`（{shape, schema, slices, tokens, reference} 五投影，全派生、零手写副本）——五投影**最终以 `Projector` 类方法面落地**（构造注入登记表 · 方法 shape/schema/slices/tokens/reference/registries · escapeRegExp 私有静态），裸函数形态由 T18 一次收净
- **Steps**:
  - `projectSchema()`：登记表 → 三 doc JSON schema 结构（含属性/必填描述）— checkable: 输出的 schema 对象可 JSON.stringify 且字节快照入测试
  - `projectShape()`：登记表 → 三 doc section 结构面（shape 投影；旧 955 行 shape 散文不继承，纯派生零手写）— checkable: shape 元素与登记表一一对应且快照入测试
  - `projectSlices()`：锚 → 解析用 regex 面（与 tokens 同源、共享派生链）— checkable: 每个登记元素 slice 可解析其锚
  - `projectTokens()` / `projectReference()`：词面/reference 词汇派生 — checkable: tokens/reference 与登记表元素一一对应
  - 测试钉字节快照（首版 pin，含 shape/schema 双快照）— checkable: project.test 绿且快照稳定
  - commit `feat(engine): contract/project 五投影派生`
- **Acceptance**:
  - 五投影从登记表纯派生（shape/schema 快照 pin）；shape 面 = `projectShape()` 派生，新树零手写 shape 散文（grep 断言）
- **DependsOn**: 2

### Task 4: contract · judge——单解释器 + 上下文缝不变式策略类族

- **Objective**: `src-next/contract/judge.ts` 单解释器 `Contract.validate()` 协调器 + 不变式策略类族（presence/uniqueness/domain/crosslink/order/continuity/residue/hollow/selfBounded/file-existence/sibling-scan/cross-doc-chain/section-scoped-domain），零 switch-case 判定分发；解析层 `doc.ts`（三 doc 类型 parse + 跨文档链根）归口本任务（spec §2.2：doctype 类只留 parse+投影，judge/graph/run 消费）
- **Files**: `src-next/contract/doc.ts`（新建，解析层：三 DocType parse + 跨文档链根，类面零判定方法）· `src-next/contract/judge.ts`（新建）· `src-next/contract/invariants.ts`（新建，策略类族）· `src-next/contract/__tests__/doc.test.ts`（新建，解析层测试）· `src-next/contract/__tests__/judge.test.ts`（新建）
- **Consumes**: T2 登记表 · T3 投影（slices 解析 regex + reference 词汇；shape/schema 结构面供 doc.ts parse 消费）
- **Produces**: doc.ts 解析层（三 DocType parse + 跨文档链根）· `Invariant` 抽象基类 + 十三实现 · `Contract#validate(doc): Finding[]` 协调器
- **Steps**:
  - 定义 `Invariant` 基类（evaluate(ctx): Finding[]）+ JudgeContext 类型 — checkable: 类型测试过
  - `doc.ts` 解析层：overall/plan/phase-spec 三 DocType parse（overall 四表 · plan 任务块+四表 · phase-spec 骨架抽取）+ 跨文档链根（Class-A/B 解析留接口，判定归 cross-doc-chain 不变式）— checkable: parse 正例测试绿（四表/任务块/骨架/链根）
  - 基础九不变式类（presence…selfBounded），各以登记表为判定源 — checkable: judge.test 每类负例通过
  - 上下文缝四不变式类（file-existence/sibling-scan/cross-doc-chain/section-scoped-domain，cross-doc-chain 消费 doc.ts 链根）— checkable: 四类负例测试过
  - `Contract#validate` 协调器：按登记表组配策略集顺序运行（ctx 装载走 doc.ts parse）、汇总 Finding — checkable: 协调器测试（多不变式混合）绿
  - 零裸函数自检：doc/judge/invariants 无导出的行为裸函数（仅类成员）— checkable: grep 断言绿
  - commit `feat(engine): contract doc+judge 解析层 + 单解释器 + 不变式策略类族`
- **Acceptance**:
  - 十三不变式策略类 + 协调器；判定分发零 switch-case（grep）；全部负例测试绿；doc.ts 三 DocType 类零判定方法（类面 grep 判定符号零残留，spec §2.2 断言面）
- **DependsOn**: 2, 3

### Task 5: contract · lint——reference lint 独立 WARN pass

- **Objective**: `src-next/contract/lint.ts` reference lint 独立 WARN pass（消费 T3 派生 reference 词汇），不混入判定义
- **Files**: `src-next/contract/lint.ts`（新建）· `src-next/contract/__tests__/lint.test.ts`（新建）
- **Consumes**: T3 reference 派生 · T4 judge Finding 形态
- **Produces**: `LintPass#run(doc): Warn[]`（WARN-only，站口触发）
- **Steps**:
  - 定义 Warn 形态 + LintPass 类 — checkable: 类型测试过
  - 实现引用扫描（锚匹配 + reference 词汇消费）— checkable: 正例/负例/跨文档引用测试绿
  - WARN-only 断言（不产出 Finding/BLOCK）— checkable: WARN 面测试绿
  - commit `feat(engine): contract/lint reference WARN pass`
- **Acceptance**:
  - LintPass 独立面；WARN 不阻塞；reference 词汇来自派生（零自带 copy）
- **DependsOn**: 3, 4

### Task 6: session · graph+state——TaskGraph + frontier + ExecutionState

- **Objective**: `src-next/session/graph.ts` TaskGraph（六类 validate：missing-edge/duplicate/missing-id/self-loop/contradiction/cycle + `batches()` 波次 + 反依赖门）+ `frontier(done)` 动态面 + `state.ts` ExecutionState 查询面
- **Files**: `src-next/session/graph.ts`（新建）· `src-next/session/state.ts`（新建）· `src-next/session/__tests__/graph.test.ts`（新建）
- **Consumes**: T1 骨架 · T4 doc.ts（plan DocType.parse：`### Task N:` 块 + DependsOn 边解析归口 doc.ts，Graph 复用同一解析实例）
- **Produces**: `TaskGraph`（validate/batches/frontier）· `ExecutionState`（doneTasks(): Set<number> / readyBatch() 为方法，非独立新类）
- **Steps**:
  - `TaskGraph` 类：消费 doc.ts 的 plan parse（`### Task N:` 块 + `DependsOn` 边——解析单家在 doc.ts，Graph 不再自解析）→ 加工边校验 — checkable: 解析结果消费测试过
  - 六类 validate + 反依赖门 + batches 波次推导 — checkable: 六负例 + 波次断言测试绿
  - `frontier(done)` + `ExecutionState`（查询面）— checkable: frontier 就绪波次测试绿
  - commit `feat(engine): session graph+state`
- **Acceptance**:
  - 六类 validate 与波次负例全绿；缺边/反依赖单家在此（无第二处 edge 判定）
- **DependsOn**: 1, 2, 4

### Task 7: session · next——NextStepRouter 单点

- **Objective**: `src-next/session/next.ts` NextStepRouter 单点（C5 决策表）：review 零 findings → none|next-group · fix blocker>0 → review（新 ref）· warn/nit → none（闭合）· BLOCKED/TIMEOUT 无 next
- **Files**: `src-next/session/next.ts`（新建）· `src-next/session/__tests__/next.test.ts`（新建）
- **Consumes**: T6 frontier/ExecutionState · T4 Finding 严重度面
- **Produces**: `NextStepRouter#next(state, ref): Route|null`（决策表单点）
- **Steps**:
  - 定义 Route 型（kind 枚举 = {none, next-group, review} + payload 事实载荷字段，非完整 cdd 命令）与软帽（soft-cap 3 轮）常量；轮次上下文 round（implement/review/fix）为 next() 输入面（dispatch 会话注入），与 Route.kind 分离——kind 专指路由决策枚举 — checkable: 类型测试过（kind 域内 · payload 必有 · round 域内）
  - next() 决策表（含 fix 面 blocker>0/warn-nit 分支 + 零 findings → `next: none | next-group`）— checkable: 正例/负例测试绿（warn/nit → `next: none` · blocker>0 → review · BLOCKED 无 next）
  - 软帽建议（"BLOCKED: review-cycle-cap" 语）— checkable: 软帽测试绿
  - commit `feat(engine): session next 单点`
- **Acceptance**:
  - next() 是唯一 next: 生成面；语义表负例全绿；**`next()` 返回 Route 事实：kind 枚举 {none, next-group, review} + payload 载荷字段（kind 枚举于步骤钉死）；BLOCKED/TIMEOUT 无 next（非 next 面）；胶囊 `next:` 渲染断言在 T10 capsule 面（v1.6 钉——T7 自身作用域可验证，非跨任务）**
- **DependsOn**: 6, 4

### Task 8: session · run——参数化单 lifecycle

- **Objective**: `src-next/session/run.ts` 参数化**单 lifecycle**（task/branch/spec/plan 目标类型 faces 数据表驱动），替代旧三 lifecycle 并行；一 dispatch 一 advance
- **Files**: `src-next/session/run.ts`（新建）· `src-next/session/faces.ts`（新建，faces 数据表）· `src-next/session/__tests__/run.test.ts`（新建）
- **Consumes**: T6 graph/state · T7 next · T9 ledger（handoff/round）
- **Produces**: `Lifecycle` 参数化单类（faces 表：审计目标/doc 面/next 语义）+ `advance()` 跑一步
- **Steps**:
  - faces 数据表（task/branch/spec/plan 各自的审计目标 + 产物面 + next 消费语义）— checkable: faces 表测试过
  - Lifecycle.advance()（frontier→派发→结果→记账→next 路由）— checkable: 四类型端到端小循环测试绿
  - 胶囊交互点（经 face/capsule，见 T10）留接口——非硬消费（T10 建成即接，本任务不建立面向 T10 的硬依赖，无缺失边）— checkable: 接口类型测试绿
  - commit `feat(engine): session run 单 lifecycle`
- **Acceptance**:
  - 单一 lifecycle 类覆盖四目标类型；端到端 advance 测试全绿
- **DependsOn**: 6, 7, 9（依赖边完整性由 T6 TaskGraph missing-edge validate 承诺校验——缺边即缺边负例失败）

### Task 9: session · ledger——会话账本

- **Objective**: `src-next/session/ledger.ts` 会计话账本（progress 键集 · handoff 读写 · crash 快照 · round 载体）——旧 artifacts/×9 归一本
- **Files**: `src-next/session/ledger.ts`（新建）· `src-next/session/__tests__/ledger.test.ts`（新建）
- **Consumes**: T6 graph/state（done 记录）
- **Produces**: `Ledger`（progress/handoff/crash/round 四合一；写 = 引擎单作者）
- **Steps**:
  - Ledger 类：progress 键集读写 + handoff（build/name/persist）— checkable: ledger.test 通过
  - crash 快照（lane crash → 恢复记录）· round 载体 — checkable: crash/round 测试绿
  - commit `feat(engine): session ledger 账本`
- **Acceptance**:
  - 账本四合一；handoff 写单作者断言；crash 恢复测试绿
- **DependsOn**: 6

### Task 10: face · words+capsule——词表单源 + 胶囊面

- **Objective**: `src-next/face/words.ts` 词汇表单源（doc 词 + 胶囊词 + 守卫词一家）+ `capsule.ts` 单胶囊面（status · blocker · handoff · next）
- **Files**: `src-next/face/words.ts`（新建）· `src-next/face/capsule.ts`（新建）· `src-next/face/__tests__/face.test.ts`（新建）
- **Consumes**: T2 登记表（词面锚）· T7 next（Route 型 · next 事实）
- **Produces**: `Words`（单词表 + 存取器合一）· `Capsule#emit(status, blocker, handoff, next)`（`status · blocker · handoff · next:` 词面字节稳定，首版即钉 pin）
- **Steps**:
  - Words 类：doc 词 + 胶囊站词 + 守卫 ban 词并入一词表数据 — checkable: 词表测试绿（无第二词表）
  - Capsule.emit 单一输出面；`next:` 渲染 = Route 事实（kind+载荷 · 非完整 cdd 命令）——经 T7 Route 型消费 — checkable: 胶囊字节快照 pin 测试绿（next: 行按 Route 事实渲染、零命令文本）
  - v1 词面与既有消费词面一致（同词不改判，非兼容而是稳态）— checkable: 词面对照测试绿
  - commit `feat(engine): face words+capsule`
- **Acceptance**:
  - 一词表单源（无并行词表）；胶囊词面字节 pin 绿；capsule `next:` 渲染 = Route 事实（kind+载荷 · 非命令文本，字节断言）
- **DependsOn**: 2, 7

### Task 11: face · cli——组合根

- **Objective**: `src-next/face/cli.ts` 组合根：implement/review/fix/schema/issue/base-branch 子命令面（词面稳态；**base-branch 形态在 T20 收敛为 `base set|get`**），装配 contract/session/face 各对象为唯一裸入口
- **Files**: `src-next/face/cli.ts`（新建，唯一裸入口·组合根）· `src-next/bin.ts`（装载 cli）· `src-next/face/__tests__/cli.test.ts`（新建）
- **Consumes**: T8 lifecycle · T10 capsule/words · T9 ledger
- **Produces**: `cli(parse/run)` 子命令面（6 命令 · 部件参数校验零未知 flag）
- **Steps**:
  - 组装解析器（6 子命令声明）+ 组合根装配 — checkable: cli.test 子命令面测试绿
  - 各子命令 run 体调 lifecycle/capsule/ledger — checkable: 6 命令最少端到端（dry-run）测试绿
  - 未知 flag 拒绝（guardArgs 语义）— checkable: 负例测试绿
  - commit `feat(engine): face cli 组合根`
- **Acceptance**:
  - 6 子命令面 + 组合根；未知 flag BLOCK；bin.ts 即唯一入口
- **DependsOn**: 8, 10, 9

### Task 12: infra + render——基建（≤5 文件）+ 模板/brief

- **Objective**: `src-next/infra/`（resource/config · git · process · workspace，≤5 文件）+ `render/`（templates + brief——活面，仅新建）
- **Files**: `src-next/infra/{resource,config,git,process,workspace}.ts`（新建 ≤5）· `src-next/render/{templates,brief}.ts`（新建）· `src-next/infra/__tests__/infra.test.ts`（新建）
- **Consumes**: T1 骨架 · T3 tokens（render 词面消费）
- **Produces**: infra 五件组（路径/配置/git/进程/工作区）+ render 两件（模板装配 · brief 数据渲染）
- **Steps**:
  - infra/resource+config 合并路径定位（RESOURCE_SPECS 式）— checkable: 定位测试绿
  - infra/{git,process,workspace} — checkable: 三件测试绿
  - render/templates（模板装配 + hard gates）+ render/brief（任务 brief 数据渲染，步骤 checkable 校验）— checkable: render 测试绿
  - commit `feat(engine): infra+render`
- **Acceptance**:
  - infra ≤5 文件；render 两件活面测试绿
- **DependsOn**: 1, 3

### Task 13: bin 接线 + 新树引擎测试全绿

- **Objective**: `bin.ts` 完整接线（cli 装载 + 环境检测 + 退出语义），新树自身的 vitest 全绿（独立 project）
- **Files**: `src-next/bin.ts`（改）· `src-next/**/__tests__/**`（全量）· `packages/cdd-engine/vitest.config.ts`（改：src-next project 就绪）
- **Consumes**: T11 cli · T12 infra/render · T5 lint · T8 run · T9 ledger
- **Produces**: 新树可运行 CLI（从 `node src-next/bin.ts …`）· 新树测试全绿基线
- **Steps**:
  - bin.ts 完整（环境检测 + cli 装载 + exit 语义）— checkable: `node src-next/bin.ts schema get plan` 输出规范 schema
  - 补齐新树测试缺口（每平面 __tests__ 全绿）— checkable: `pnpm --filter @oscaner-skills/cdd-engine test` 含 src-next project 全绿
  - 新树自测基线记录（文件/用例数）入计划 + **零裸函数全树断言面收账**（`grep -rn "^export function" src-next --include="*.ts"`，排除 `__tests__`——session/face/render/infra 平面一并入基线账，T18 全树 grep 断言面自此基线确立）— checkable: 基线表落盘 · 断言面记录
  - commit `feat(engine): bin 接线 + 新树测试全绿`
- **Acceptance**:
  - `node src-next/bin.ts` 六命令可用；src-next project vitest 全绿；旧 src 测试保持绿（双面同时绿）；零裸函数全树断言面并入基线账
- **DependsOn**: 5, 11, 12（lint 闭包 {3,4} 经 5 直达；8/9 经 11 传递闭包含入）

### Task 14: scripts-next 重写——守卫消费引擎元数据 + 单编排器

- **Objective**: `scripts-next/` 重写：守卫**消费新树导出**（通道审计/词 ban 表数据化零正则世界）+ **认领 skill-anatomy 归位**（`config/schema/skill-anatomy.json` → 引擎契约面 typed 导出，v1.4 数据面归位前置于本任务的唯一 schema 契约）+ 单一 emit/validate 编排器（双 Orchestrator 合一 · 薄 wrapper 折叠）。守卫消费的引擎导出面 = **T21 数据面归位保持的稳定 API**（T14 ∥ T21 同波：T21 只改内部数据表示、导出名不变——零波次竞态）
- **Files**: `scripts-next/`（新建：emit 单编排 · validate 单编排 · guard-lib）· `src-next/contract/skill-anatomy.ts`（新建：skill-anatomy 契约归位）· `scripts-next/__tests__/`（新建）
- **Consumes**: T13 新树导出面（元数据：词表/通道/结构断言）× 新树 bin（smoke 消费面）· T21 保持的稳定导出面
- **Produces**: scripts-next（emit+validate 单编排 · guard 数据表驱动）· skill-anatomy 引擎契约面导出
- **Steps**:
  - guard 库（checkAnatomy 语义保留：技能结构契约；channel/词面审计消费新树导出，零正则 re-walk）— checkable: guard 测试绿（消费面断言）
  - skill-anatomy 归位：`config/schema/skill-anatomy.json` 内容迁 `src-next/contract/skill-anatomy.ts` typed 导出（CLAUDE.md/maintainers 链接同步入 T16）— checkable: guard 经引擎导出消费绿 · config 旧址零引用
  - 单 emit 编排（source.json+manifests 派生）+ 单 validate 编排（runner 数据表）— checkable: emit 产物字节校验 + validate 子流程测试绿
  - smoke-cdd 面向新树 bin — checkable: smoke 干跑绿
  - commit `feat(scripts): scripts-next 守卫元数据化 + 单编排器 + skill-anatomy 归位`
- **Acceptance**:
  - 无并行正则世界（通道审计 = 新树导出断言）；单 emit/validate 编排器；skill-anatomy 引擎契约面导出（guard 消费导出非 JSON 路径）；scripts-next 测试全绿
- **DependsOn**: 13

### Task 15: cutover——入口切换 + 删旧树

- **Objective**: 入口切换（cdd-engine package.json#exports/bin + tsconfig include → `src-next`；root package.json scripts 重连 → scripts-next/run.ts，`.kairos`/run 链随新树命中），随后**删除旧树**（`src/` 旧平面 · `scripts/` 旧工具）· 工具链终态**`scripts-next` → `scripts` 改名**（spec §6.1——先删旧 `scripts/` 再占回规范名，新工具链终态恒为 `scripts/`）· **旧数据面 `config/` 整目录删除**（v1.4 数据面归位——13 文件 ~150K 零残留，零重建：T21 后新树零读 config/，此处纯删），旧技能文件移除在 T16 一并
- **Files**: `packages/cdd-engine/package.json`（改 exports/bin）· `packages/cdd-engine/tsconfig.json`（改 include → src-next）· `packages/cdd-engine/vitest.config.ts`（改）· root `package.json`（改 scripts：validate/precommit/emit/emit:check → 先连 `node scripts-next/run.ts …`、改名后单点更新为 `node scripts/run.ts …`，commit 链随新树命中）· `scripts-next/`（改名 → `scripts/` 占回规范名，spec §6.1）· `scripts/`（删）· `packages/cdd-engine/src/`（删）· **`packages/cdd-engine/config/`（删：engine-config/harness-contract/template-contract/contract-lexicon + schema/ 九文件 —— T21 数据面归位后无读者）**
- **Consumes**: T13 新树全绿 · T14 scripts-next 全绿（skill-anatomy 已归位引擎导出，config/schema 无残留读者）· T21 数据面归位（config/ 读取面清零）
- **Produces**: 切点后的活跃树 = 新树；旧树/旧脚本/旧数据面零残留
- **Steps**:
  - 出口切换 cdd-engine package.json/tsconfig/vitest → src-next + scripts-next — checkable: `node packages/cdd-engine/src-next/bin.ts implement --help` 等从新入口可跑
  - root package.json 四项 scripts 重连至 scripts-next/run.ts（validate/precommit/emit/emit:check；husky→lint-staged→`pnpm run precommit` 链随新树命中，关键命令不死亡）— checkable: `pnpm run validate`/`pnpm run emit` 经新链绿
  - 删旧 `src/` 旧平面目录 + `scripts/` 旧工具 + `config/` 旧数据面（skill-anatomy 无读者——T14 已归位引擎导出）— checkable: 三目录不存在（`test ! -d`）；删除提交本身走新 precommit 面（链已重连，无 ENOENT）
  - `scripts-next` → `scripts` 改名（spec §6.1 工具链终态占回规范名：旧 `scripts/` 已删无同名冲突；root package.json 四项 scripts 的 `scripts-next/run.ts` 引用随之单点更新为 `scripts/run.ts`，与 CLAUDE.md 关键命令面 `scripts/run.ts emit` 命令面一致）— checkable: `test ! -d scripts-next` · `pnpm run validate/emit` 经 `scripts/run.ts` 新链绿
  - 零残留 grep 作用于引擎/脚本/**数据面**（cdd-engine 旧符号 · scripts/ 旧分组/旧 helper 名 · `scripts-next` 名零残留——唯一工具链名为 `scripts/` · `config/` slash 路径形在 src-next 面零命中——新树零 config 引用面，T21 后已清零） — checkable: 引擎/脚本/数据面残留 grep 断言绿（技能文件残留归 T16/T17 swap，不在本 grep 作用域）
  - **dispatch 调用面收口（v1.8 · T15 cutover 首验）**：HOSTS 加 `promptForm` 数据列（prompt 位置语义）· `#childPrompt` 单位置参数（skill-ref 前缀并入 prompt 首行）· child prompt mode 分派表（每 mode 固定前缀 + per-mode round context 精简子集 + INPUT_/OUTPUT_/WORKSPACE_/FIX_BASE/ROLE/SCOPE 规整命名）· 真实 CLI 探针验证 prompt 到达 child（FakeSync 桩 + 真实探针双门槛）— checkable: `claude -p` 探针回显 marker · 分派表/命名零旧名残留 grep · 测试全绿
  - **handoff 契约面整改（v1.9 · 三连裁定）**：child 产出一律落盘（stdout 三行指针 + handoff JSON 写文件，全家族统一 `RETURN_STDOUT_BLOCK`——`RETURN_JSON`/`DOCS_FIX` return 区退役）· 结构约束 = **注入 JSON schema**（per-mode 可写子集 ```json fence · 一声明两投影：prompt 注入 + 引擎读回校验 typed · 零 `config/schema/*.json`）· **散文清理**（`## Handoff` 段 + `HANDOFF_WRITE_GATE` 删净）· **引擎读回重建**（`#bookkeep` 前的 read-back：child draft → 校验 → 物化同路径 full-replace；失败不覆盖 + BLOCK + crash record + resume）· **test-evidence 一并 schema 化 + 引擎真读回**（缺 typecheck = BLOCK，第二个散文虚设补钉）· 真实探针验证 findings 经文件回流路由 — checkable: 探针 findings 回流 · 散文零残留 grep · `RETURN_JSON` 零引用 · 测试全绿
  - **T15 收口 review 落地（v1.11 · 探针后六项）**：FIX_BASE 锚=评审 head（`#fixedPoint` 读 `commits.head` · fallback base）· task review `INPUT_RANGE`=TASK_BASE..HEAD（implement 载体派生 7-char · fallback planPath）· review per-type 固定前缀（criteria/lens 折入 · spec/plan lens 补 · `INPUT_CRITERIA`/`INPUT_LENS` token 消亡）· work 公共尾 shared（evidence+commits partial · report 行统一 · docs-fix 只取 commits）· 孤儿键删（fix `INPUT_RULES` · `INPUT_PLAN` marker）· evidence 命名家族字首化（branch → `branch-{range}-test-evidence.json`）— checkable: fix prompt FIX_BASE=评审 head · review prompt INPUT_RANGE=范围 · criteria/lens 不入动态 tail · 零孤儿键 · 测试全绿
  - commit `refactor(engine): cutover 切 src-next + 删旧树·旧数据面 + scripts-next→scripts 改名`（大删 + 改名，经重连后的新 precommit 面提交）
  - commit（dispatch 收口，如 cutover 后另有提交）`fix(engine): dispatch child prompt 分派表 + 调用面数据化`——B+C 改动独立提交，随 T15 评审
- **Acceptance**:
  - 活跃入口全指新树；引擎/脚本/**数据面**旧树零残留（grep 断言：src-next 无 `config/` slash 路径命中 · `config/` 目录不存在 · `scripts-next` 改名后零残留）；**T21 数据面归位先于 T15 达成**（DependsOn 21 为硬前置——config/ 零读面清零后才删）；更新后引擎 CLI 从新树跑通六命令；root `pnpm run validate/precommit/emit` 经 `scripts/run.ts` 新链绿（**`scripts/run.ts` 为唯一工具链名**）——删除旧树提交即走新 precommit 面
  - **dispatch 调用面（v1.8）**：HOSTS `promptForm` 列 · child prompt 单位置参数（零独立 ref 位置参数 · grep 反断言）· mode 分派表 + per-mode round context 精简 · 规整命名零旧名残留 · 真实探针双门槛 · 测试全绿——T15 向「引擎 CLI 从新树跑通」的首次真实验证
  - **handoff 契约面（v1.9）**：child 产出一律落盘（handoff JSON 写文件 + stdout 三行指针）· 全家族统一 `RETURN_STDOUT_BLOCK`（`RETURN_JSON`/`DOCS_FIX` 退役零残留）· 注入 per-mode 可写子集 JSON schema（```json fence · 一声明两投影 · 零 `config/schema/*.json`）· `## Handoff` 段 + `HANDOFF_WRITE_GATE` 散文零残留 · 引擎读回重建（child draft → 校验 → 物化同路径 · 失败不覆盖 + resume）· test-evidence schema 化 + 引擎真读回（缺 typecheck = BLOCK）· 真实探针验证 findings 经文件回流路由
  - **T15 收口 review（v1.11）**：FIX_BASE 锚=评审 head（fix prompt 实物不再带 TASK_BASE 基值）· task review `INPUT_RANGE`=TASK_BASE..HEAD（实物为范围非 plan 路径）· review per-type 固定前缀（criteria/lens 在固定区 · 动态 tail 无 axes 重付）· work 公共尾共享（实现/fix prompt 的 evidence+commits 不再逐字重复）· 孤儿键零（fix 无 `INPUT_RULES` · `INPUT_PLAN` 无 marker）· evidence 命名家族字首（branch 无 `tasks-` 前缀）
- **DependsOn**: 14, 21

### Task 16: 技能 8→6 重写 + skill-anatomy + emit 再生 + README

- **Objective**: `packages/kairos/skills/` 重写为 6 集（cdd-design · cdd-spec-writer · cdd-plan · cdd-dev · cdd-close · cdd-report）；**五链 digraph（design/spec-writer/plan/dev/close）统一骨架** = 一次性执行节点 + NEXT-LOOP 单自环（边零状态标签），**两项例外**——cdd-close 止于 finish 编排语义门 + 终端（无 review 自环）· cdd-report 一次性上报工具链（无自环）；**cdd-design 收敛参数化单模板**（spec §4.1：run-cdd-charter 双节点 + run-cdd-spec/run-cdd-phase 两近同 dispatch 节点合一）；skill-anatomy 注册 6 集（经 T14 归位的引擎契约面导出）+ 目录扫描守卫（**P4 承接映射显式化 · v1.12：P4 第二 acceptance「封闭 6 集零新增成员 · 第 9 席作废」的责任落此**）；emit 再生 (.claude/.cursor/marketplace)；README 随 6 集重写；**next: 消费前提（v1.6 钉）**——技能按 `next:` Route 事实映射具体命令：Route.kind 枚举 = {none, next-group, review}（T7 钉）按 kind+载荷映射 cdd 命令，非命令文本；BLOCKED/TIMEOUT 为非 next 面（无 next 行），技能不消费 `next:`
- **Files**: `packages/kairos/skills/*/SKILL.md`（8→6 重写）· `src-next/contract/skill-anatomy.ts`（改：6 集注册；T14 归位面）· `.claude-plugin/`·`.cursor-plugin/`·`marketplace/`（emit 产物）· `packages/kairos/README.md`（改）· `packages/kairos/README.zh-CN.md`（镜像同步，README 三件 mirror 政策同更）· **`CLAUDE.md`（改：skill-anatomy 链接 → 引擎契约面）+ `docs/maintainers/04-program-experience.md`（改：路径引用同步）**
- **Consumes**: T15 新引擎语义（next: 单环路 / 胶囊词面）· T7 Route 型（next 事实 · 技能映射断言消费）· T14 `scripts/`（checkAnatomy 经引擎导出——T15 改名后终态名）· T20 `cdd base` 命令面（技能文本 seam：`cdd base` 词面同步落）
- **Produces**: 6 集 SKILL.md（spec-writer 合一参数化 · next-loop 折叠）· skill-anatomy 6 集注册 · emit 产物再生
- **Steps**:
  - 六款 SKILL.md 重写（**五链 digraph 统一骨架**：design/spec-writer/plan/dev 四链 NEXT-LOOP 单自环 + cdd-close 止于 finish 编排语义门 + 终端 + cdd-report 一次性上报工具链——两项例外显式（无自环）· digraph 边零状态标签；Node Definitions 零路由自述 · 纪律全数归 Invariants；上游 import 面保持——superpowers:brainstorming / writing-plans / finishing-a-development-branch / mattpocock-skills:grilling，M 组 fit 映射不动；零程序历史 pin——SKILL.md 无程序叙事段/反历史块；cdd-spec-writer 参数化 single/phase/overall + **cdd-design 参数化单模板**（双 run-cdd-charter 节点 + run-cdd-spec/run-cdd-phase 近同节点收敛，spec §4.1））— checkable: 六文件结构自查（digraph↔defs 一致 + 边零状态标签）+ 上游 import 面与程序历史零残留 grep
  - skill-anatomy 注册 6 集（引擎契约面改）+ 目录扫描守卫期望更新 — checkable: `node scripts/... validate` guard 绿（或新树校验面）
  - `node scripts/run.ts emit` 再生清单 — checkable: emit 产物与 `emit-check` 零漂移
  - README 消费面随 6 集重写（技能表/upstream 安装表/独立入口说明）+ `packages/kairos/README.zh-CN.md` 镜像同步 — checkable: README 表与目录扫描深度一致；镜像与英文面一致（README 三件 mirror 政策）
  - CLAUDE.md + maintainers 文档 skill-anatomy 路径引用 → 引擎契约面（T14 归位面）— checkable: 引用 grep 新路径一致
  - next: 消费断言——6 集 SKILL.md 对 `next:` 站词的消费为 Route 事实（kind→命令映射，kind 取自 T7 枚举；BLOCKED/TIMEOUT 非 next 面不消费），零命令文本 `next:` 引用（grep/结构自查：无整条 cdd 命令续在 next: 站词后）— checkable: 事实映射 grep 断言绿（v1.6 消费前提 checkable 面）
  - commit `feat(kairos): 技能 8→6 + skill-anatomy + emit 再生`（governed by precommit/validate）
- **Acceptance**:
  - 6 集 SKILL.md 落地；五链 digraph 统一骨架（四链 NEXT-LOOP 自环 · cdd-close 止于 finish 编排语义门 + 终端 · cdd-report 无自环——两项例外）+ 边零状态标签 + digraph↔defs↔text 一致断言绿；cdd-design 参数化单模板（charter 双节点 + spec/phase 近同节点收敛）断言绿；skill-anatomy 6 集 + 注册守卫；emit 新鲜；README 一致（含 `README.zh-CN.md` 镜像同步）；CLAUDE.md/maintainers 路径引用同步；上游 import 面保持 + 零程序历史 pin 保持（grep 断言）；next: 消费断言绿（SKILL.md 按 Route 事实 kind→命令映射、零命令文本 `next:` 引用——v1.6 消费前提验收面）
- **DependsOn**: 15, 20

### Task 17: 终验 + 消费面同步 + changesets + 净减账

- **Objective**: 全量终验（validate ALL PASS · typecheck ×3 · biome · emit 新鲜）· 三 schema description 与登记表一致（派生同步）· changesets（cdd-engine major / kairos major）· 净减账落档（29k → −20%±）· 历史文档零 retro-rename 复核
- **Files**: `.changeset/*.md`（新建）· `docs/kairos/specs/*.md`（只读复核，不改历史正文）· 净减账记录（计划/文档面）
- **Consumes**: T16 技能/emit · T25 P5 承接补遗 · T15 新树 · T14 `scripts/`
- **Produces**: validate ALL PASS · changesets · 净减账记录
- **Steps**:
  - 全量终验链 — checkable: `node scripts/run.ts validate`（或 precommit 等价）ALL PASS
  - typecheck ×3 + biome — checkable: 全绿
  - 三 schema description 与登记表一致性复核（派生对账）— checkable: 对账断言绿
  - `pnpm run changeset` 建 changeset（cdd-engine major · kairos major）— checkable: .changeset/* 落盘
  - 零残留全树 grep（旧符号/旧技能数 8→6 残留/`scripts-next` 名——唯一工具链名 `scripts/`）· 净减账（新树 src-next 行数 vs 旧基线）— checkable: grep 零 + 净减行数入记录
  - 历史文档零 retro-rename 复核（docs/kairos/specs 既往版本行不动）— checkable: git log 对比复核通过
  - commit `chore: P3.2 终验 + changesets + 净减账`
- **Acceptance**:
  - validate ALL PASS · typecheck ×3 · biome · emit 新鲜；changesets 落盘；净减账达标（或记录真实值）；历史正文零 retro-rename
- **DependsOn**: 16, 25

### Task 18: 零裸函数全平面整改——Contract 派生/判定面收类

- **Objective**: 全契约平面归零模块级裸函数（用户 2026-10-07 裁决「我不希望有裸函数」）：`contract/project.ts` 六投影函数 + `escapeRegExp` → **`Projector` 类**（构造注入 `declaredRegistries` · 方法面 shape/schema/slices/tokens/reference/registries · escapeRegExp 私有静态）；`contract/declare.ts` 两守卫 → **`RegistryGuard` 类静态方法**（type predicate 收类成员）；judge/doc/lint 消费面随构造注入；全树模块级导出仅 类型/常量数据/类/组合根（grep 断言钉死）
- **Files**: `src-next/contract/project.ts`（改：收类）· `src-next/contract/declare.ts`（改：守卫收类）· `src-next/contract/judge.ts`（改：`Projector` 构造注入消费）· `src-next/contract/doc.ts`（改：`Projector` 消费）· `src-next/contract/lint.ts`（改：`Projector` 消费）· `src-next/contract/__tests__/{project,declare}.test.ts`（改：类方法面）· `src-next/contract/__tests__/zero-dep-related`（无新增）
- **Consumes**: T2 登记表 · T3 投影（裸函数现面）· T4 judge/doc（裸函数消费）· T5 lint（裸函数消费）
- **Produces**: `Projector` 类 + `RegistryGuard` 类；**全树**（`src-next/**` 除 `__tests__`）模块级 `export function` 零命中（唯一豁免 = 组合根装载面 bin.ts/cli.ts，spec §2.1）
- **Steps**:
  - `Projector` 类（构造注入 registries；方法 shape/schema/slices/tokens/reference/registries；escapeRegExp 私有静态）— checkable: 类面测试绿
  - `RegistryGuard.isElement()` / `RegistryGuard.isRegistry()` 静态谓词（原 isRegistryElement/isElementRegistry 语义）— checkable: 守卫测试绿
  - judge/doc/lint 三消费面改 `new Projector(declaredRegistries)` 注入与 `.xxx()` 方法调用 — checkable: 波及测试全绿（src-next vitest 全绿）
  - 零裸函数 grep 断言入 acceptance：`grep -rn "^export function" src-next --include="*.ts"`（排除 `__tests__`；组合根装载面 bin.ts/cli.ts 豁免，spec §2.1「…/组合根」）零命中 — checkable: grep 绿（session/face/render/infra 平面随同收面，断言面自 T13 基线起即全树）
  - commit `refactor(engine): Contract 派生/守卫面收类——零裸函数全平面`
- **Acceptance**:
  - `Projector`/`RegistryGuard` 类落地；`src-next/**`（除 `__tests__`）模块级导出仅 类型/常量数据/类/组合根（装载面豁免）；零裸函数 grep 零命中（全树断言）；消费面（judge/doc/lint/project/declare 测试）全绿
- **DependsOn**: 3, 5, 6

### Task 19: 翻译系统——P7 全量核心（词表 locale 面 + 双向翻译层 + langs 派生 + 渲染器归位）

- **Objective**: 用户 2026-10-07 拍板「IssueBodyRenderer.langs 升级为翻译系统，P7 提前」——单词表（T10)加 **locale 面**（每条词挂 `{ en: 规范型, zh?: 中文别名 }`）· 单一**双向翻译层 `Translator`**（`normalize(输入)→规范 token` 中文别名↔英文规范型 · doc parse/判定消费；`localize(token,locale)→输出词` · 人类可读渲染面 locale-normalized）· **`langs` 投影派生**（`["en","zh"]` 硬编码归零 = 词表 locale 键集投影）· **IssueBodyRenderer 从 face/cli 迁 render/** + 语言表数据化；capsule 机面 `status/next:/CDD_BLOCKED:` 英文恒定不 locale 化（机器面非人类文本）；P7 原「doc token English-primary 化」转换半随 greenfield 消解（新树首版锚即英文）· 识别半由翻译层承接，「legacy 中文标记可解析」随旧树删除消解
- **Files**: `src-next/face/words.ts`（改：locale 列 + 翻译层数据）· `src-next/contract/translate.ts`（新建：`Translator` 类，词表驱动零 switch）· `src-next/render/issue-body.ts`（新建：IssueBodyRenderer 迁入 render/）· `src-next/face/cli.ts`（改：渲染器移出组合根）· `src-next/face/__tests__/face.test.ts`（改：词表 locale 面测试）· `src-next/face/__tests__/cli.test.ts`（改：渲染器测试移出 → render.test.ts 归位）· `src-next/render/__tests__/render.test.ts`（新建：渲染器测试归位）· `src-next/contract/__tests__/translate.test.ts`（新建）
- **Consumes**: T10 单词表 · T3/T18 `Projector` 派生 · T11 cli（渲染器现落印）
- **Produces**: `Translator` 类（normalize/localize）· Words locale 面（词条目 alias 数据）· `langs` 投影派生 · render/issue-body.ts（IssueBodyRenderer 归位 · 语言表数据驱动）
- **Steps**:
  - Words locale 面：词条目允许 `{ en, zh? }` — checkable: 词表测试绿（无第二词表）
  - `Translator` 类：normalize（中文别名↔规范型双向）+ localize（locale-normalized 输出），词表驱动零 switch、零裸函数 — checkable: translate.test 正/负例绿（含中文别名识别）
  - `langs` 派生：语言键集 = 词表 locale 键集投影；IssueBodyRenderer 校验改投影包含 — checkable: langs 投影测试绿（无硬编码 `["en","zh"]`）
  - IssueBodyRenderer 迁 `render/issue-body.ts`（face/cli 仅装配）：段标签数据化 + 渲染器测试归位（原 cli.test.ts 内渲染器测试随迁 `render.test.ts` 新建；cli.test.ts 只留子命令面测试）— checkable: render.test + cli.test 绿
  - capsule 机面英文恒定断言（status/next:/CDD_BLOCKED: 不 locale 化）— checkable: 胶囊字节 pin 仍绿
  - commit `feat(engine): 翻译系统——词表 locale + Translator 双向层 + langs 派生`（自测绿后）
- **Acceptance**:
  - `Translator` 类 + Words locale 面落地；`langs` 投影派生（零 `["en","zh"]` 硬编码 grep）；IssueBodyRenderer 归位 render/（cli 零渲染器成员）；capsule 机面英文恒定；双向识别正/负例绿；零裸函数与 zero-dep 断言保持绿
- **DependsOn**: 3, 10, 11

### Task 20: CLI `base` 命令面收敛

- **Objective**: `base-branch set|get` → **`base set|get`**（用户 2026-10-07 拍板「base-branch set|get 可以升级成为 base set|get」）——六命令面（implement/review/fix/schema/issue/base）；技能面调用（cdd-dev/cdd-close 的 `cdd base-branch get/set`）在 T16 重写时同步落 `cdd base`，本任务不动技能文件
- **Files**: `src-next/face/cli.ts`（改：base-branch 子命令 → base set|get）· `src-next/face/__tests__/cli.test.ts`（改）
- **Consumes**: T11 cli（base-branch 现面）
- **Produces**: `cli` 面 base set|get 子命令（T11 的 base-branch 形态替换）
- **Steps**:
  - cli.ts base-branch set|get → base set|get（argv 解析 · 词面同步；`cdd base set --plan … --base …` / `cdd base get --plan …`）— checkable: cli.test 六命令面 + base 正/负例绿
  - 消费点随改（ledger/run 读 base 命令路径）— checkable: 测试全绿
  - commit `feat(engine): CLI base set|get 命令面收敛`（自测绿后）
- **Acceptance**:
  - `cdd base set|get` 生效且 `base-branch` 命令面新树零残留（grep）；六命令面完整；测试全绿
- **DependsOn**: 11

### Task 21: 数据面归位——P4/P5 承接（三 JSON → typed 平面）

- **Objective**: 用户 2026-10-07 拍板「config-next 完成以后删除 config」+「都是一体的」——**数据面不占目录**（零外部 JSON 消费者核查：引擎外仅本 repo 自有 kairos tests + 将删旧 scripts，全由 P3.2 接管）：三稳态 JSON（engine-config / harness-contract / template-contract）**收敛为新树 typed 平面成员**——`infra/runtime.ts`（engine-config 面：contextContract·handoffNamespace·$version；failureCategories/slugRule 死字段剔除）· `face/host.ts`（harness-contract 面：host 检测 · dispatch · refs）· `render/templates.ts`（template-contract 面：dispatch 提示词 + review 准则）；JSON 解析/`resource.ts` 路径表/`$schema`/`_doc` 散文面删除；**P4 承接**（review 准则 = typed 数据：dispatch.review 行 + axesGuide —— URC spec/plan 三轴 + writing-plans 自检 + verification evidence；「第 9 席技能」随技能 6 集封闭集作废）· **P5 承接**（DispatchPacket 被 capsule+handoff+模板面取代；残留 = **M1 supersede** dispatch.implement tdd→`mattpocock-skills:implement` + refs 域登记 · **三处禁文删除** review.task/branch note「parallel sub-agents forbidden」×2 + axesGuide「no parallel sub-agents」）；新树**零读 config/**（grep）· **导出面保持**（T14 守卫同波消费的稳定 API 名不变——内部换表示零波次竞态）；kairos tests 改指新数据面
状态（v1.12）：**本任务承接 P5 三件只有 M1 supersede / refs 登记 / 三处禁文删除**；overall P5 行的其余验收——refKind 四型推导 · skills 有序链渲染 · capabilities per-harness 声明——**吸收时漏映射，落回 T25（v1.12 新增）**，不属本任务。P4 承接只含「准则 typed 数据」；「封闭 6 集守卫」属 T16（v1.12 显式化）。实施回溯 · 已完成。
- **Files**: `src-next/infra/runtime.ts`（新建）· `src-next/face/host.ts`（新建）· `src-next/render/templates.ts`（新建）· `src-next/infra/config.ts`（改：ConfigStore JSON 读取 → typed 消费）· `src-next/infra/resource.ts`（删：路径表）· `src-next/face/cli.ts`（改：#skillRef/#reviewAxes/模板装配 → typed 面）· `src-next/**/__tests__/**`（改：数据面测试/夹具改指）· `packages/kairos/tests/*.test.ts`（改：改指新数据面）
- **Consumes**: T11 cli（JSON 读取现面）· T12 infra/render（resource/config 现面）· T13 全绿基线
- **Produces**: typed 数据平面（infra/runtime · face/host · render/templates）· P4/P5 承接内容落地 · 新树零 JSON/零 config/ 路径 · 稳定导出面
- **Steps**:
  - infra/runtime.ts + face/host.ts + render/templates.ts 落 typed 数据（单源：每面一份，零副本）— checkable: 单源断言（无第二份）· 无 `$schema`/`_doc` 散文
  - P5 承接：M1 supersede（dispatch.implement → mattpocock-skills:implement）+ refs 域登记；三处禁文删除 — checkable: 禁文 grep 零 · supersede + refs 断言
  - P4 承接：review 准则收口（URC 三轴含 verification evidence + writing-plans 自检，typed 数据被装配面引用）— checkable: 装配面引用准则 + 对照断言
  - 消费面改指（ConfigStore → typed · cli 装配 · 模板装配）+ resource.ts 删除 — checkable: `src-next` 面 `config/` slash 路径零命中
  - kairos tests 改指新数据面 — checkable: kairos 测试绿
  - 导出面保持（T14 同波消费 API 名不变）— checkable: T14 消费面编译绿
  - commit `refactor(engine): 数据面归位 typed 平面——P4/P5 承接`（自测绿后）
- **Acceptance**:
  - 三 JSON 零残留（grep）；`config/` 在 src-next 面零路径命中；禁文全删（grep 零）；M1 supersede 落（dispatch.implement = mattpocock-skills:implement）；review 准则收口；全树测试绿（src-next vitest + kairos）；导出面稳定（T14 消费编译绿）
- **DependsOn**: 11, 12, 13

### Task 22: 宪法化承接——P6（overall 单文件结构化收敛 · v1.8 单文件裁定）

- **Objective**: 用户 2026-10-07 拍板吸收 P6、**2026-10-08 拍板收敛单文件**（「不需要 overall-archive.md——overall 变两份文件增加消费者心智负担」）——overall 保持一份文件、零 `-archive.md`、零新增 artifact（spec v1.6 §6.5 · overall v1.24 File paths 承诺通道关闭）：**版本行 lineage 散文消解**（telescope 尾链 → 结构化修订记录）· change-history 巨型 cell → 结构化 record · **Standing rules「空壳、死代码即删」成典常态化**（已被 T15 删旧实证）· 全树 4 overalls 同口径迁移（内容逐字 · 容器改造 · 历史正文零 retro-rename）——**declare.ts 登记行不简化**（Issue inventory/Change history 保持 required，零引擎改动，doc-contract 门对单文件新形走通）
- **Files**: `docs/kairos/specs/2026-10-02-doc-architecture-v2-overall.md`（改：单文件宪法化——版本行 lineage 消解 + 修订记录结构化 + Standing rules 成典 cell）· 全树其余 3 overalls（改：同口径迁移）· `src-next/contract/declare.ts`（改：登记行定案——不简化，keep required，仅注释随形收敛）
- **Consumes**: T15 切后稳定链 · T3 登记表/投影面（overall 登记行现面）
- **Produces**: 单文件宪法化 · 版本行散文消解 · Standing rules 成典 · 零新增 artifact
- **Steps**:
  - 宪法化修订（overall 本体：Goal/Standing rules 规范化折叠 · issue/history → 结构化 cell · 版本行 lineage → 结构化修订记录）— checkable: 单文件结构绿
  - 版本行 lineage 散文消解 → 结构化修订记录（telescope 尾链断）— checkable: 修订记录表 + 版本行引用点检
  - Standing rules 常态化成典（空壳死代码即删——T15 实证入典）— checkable: 宪法定案文本
  - 全树 4 overalls 同口径迁移（内容逐字 · 容器改造 · 零新增文件）— checkable: 迁移 grep（内容保真 · 历史正文零 retro-rename · `overall-archive` 零残留）
  - declare.ts 登记行定案（不简化 · keep required）— checkable: doc-contract 门绿 + 登记行 required 断言
  - commit `docs(kairos): P6 宪法化承接——overall 单文件结构化收敛 + 版本行结构化`（零引擎登记行改动）
- **Acceptance**:
  - 宪法化单文件落地 + 4 overalls 迁移；版本行散文零残留（grep）；Standing rules 成典；零 `-archive.md`（grep 零残留）；declare.ts 登记行 required 保持；新引擎 doc-contract 门对新形绿；历史正文零 retro-rename
- **DependsOn**: 15

### Task 23: next fix 面 readback 后缀

- **Objective**: 用户 2026-10-08 拍板——`NextStepRouter` 于 **round = fix（fix 面路由）**时，capsule `next:` 渲染行尾追加 **`(read file back to confirm)`**（纯文案提示 · 编排方是否遵守非强约束）：旧树 `readbackWording`「(read <handoff> back to confirm)」的设计意图在新架构落地为文案提示——防盲目 fix 的机械防线由 ledger round/C5-1 兜，后缀仅为编排者确认提示；round 为 next() 输入面轮次上下文（T7 钉），与 Route.kind 路由决策枚举分离（kind ≠ 轮次）
- **Files**: `src-next/session/next.ts`（改：fix 面路由携带 readback 文案）· `src-next/face/cli.ts`（改：next: 渲染行尾追加）· `src-next/session/__tests__/next.test.ts`（改：fix 面 next: 行含后缀断言）
- **Consumes**: T7 next 路由器（fix 面现面）· T11 cli 渲染
- **Produces**: fix 面 next: 渲染行尾后缀
- **Steps**:
  - round = fix 时路由 → 渲染追加 `(read file back to confirm)` — checkable: next.test 断言（fix 面含后缀 · review 面不含）
  - cli capsule 渲染接入 — checkable: cli 面 next: 行含后缀
  - commit `feat(engine): next fix 面 readback 后缀`
- **Acceptance**:
  - round = fix（fix 面）的 next: 渲染行尾含 `(read file back to confirm)`（词面断言）；review 面 next: 行不含；测试全绿
- **DependsOn**: 7, 11

### Task 24: 反依赖门放开——边违约五类收编 + 环活门

- **Objective**: 用户 2026-10-08 拍板「放开『任务只能依赖更小编号』约束，Wave 编排完全基于 DependsOn 推导」（spec §3.1 v1.5）——TaskGraph 反依赖门退役：**前向引用合法**（`- **DependsOn**:` 可指向任意现存任务 id）· **cycle 类为活门**（环 = 具名 plan 违约 · doc-contract 早拦/评审派发 BLOCK）· **编号降级为 ID + 波内升序 tiebreak**（波内 ascending 派发保持）· referenceLint 侧新增**编号/拓扑序 advisory WARN**（编号未随拓扑仅建议重排——只警不拦 · 作者「编号≈阅读序」引导保留）——Wave 推导纯边驱动，编排器零手动位移（T13 型 off-ledger deferral 类消灭）；语义改动定 cutover 后动（不混入 T15 切波 · 改动落定型新树——T13 基线教训同源，以边声明为本不复现模糊面）；**pre-flight 接线（v1.13 扩域 · spec §3.8）**——`DependsOn` 值域契约（首个 `(` 前裸数字列表 · 行尾注释零参与，散文数字化入边的 duplicate/self-loop 缺陷类在契约面消除）+ `TaskGraph.validate()` 接线三处门（`cdd review --type plan` 前置 / implement 派发前置 → 具名 BLOCK child 零派发）+ 严格派生波机械化（`--tasks` 拆派生波 → BLOCK）+ 派生波表随门输出（零新子命令）；**消费面 reduction 透传（v1.16 · 直依赖引擎约简）**——`TaskGraph#depsOf` 一律 transitive-reduction（派发/波次/读面），作者声明完整前置集冗余零危害 · validate 读原始声明 · 闭包/wave 不变 · lint 加传递冗余 advisory（只警不拦）；**plan-graph 展示 = wave-board（v1.18）**——引擎自持 wave 行（确定性 · wave chain 冗余删除），beautiful-mermaid 退役（§3.8 渲染决策作废——不控布局、全图规模丢 label、正则补丁 = 技术债）
- **Files**: `src-next/session/graph.ts`（改：contradiction 边违约类退役 · 五类收编 · `batches()` 纯边推导 · header「linearization anchor」注释改写）· `src-next/contract/lint.ts`（改：编号/拓扑序 advisory WARN）· `src-next/contract/declare.ts`（改：598 行边声明注释收敛）· 测试（`src-next/session/__tests__/graph.test.ts` 改：contradiction 负例 → 前向引用正例 + 环具名违约 · `src-next/contract/__tests__/lint.test.ts` 改：advisory WARN 用例）· `packages/kairos/skills/cdd-plan/SKILL.md`（改：作者规则句「may only list lower-numbered tasks」收敛/删除）
- **Consumes**: T2 declare（边声明登记面）· T5 lint（reference lint 面）· T6 graph（六类现面）· T11 cli（schema get plan 消费面）· T16 技能重写（cdd-plan 文本面——W12 同波 16→22→24 升序殿后见最终形态，非硬依赖）
- **Produces**: 五类边违约 TaskGraph · 前向引用合法 · cycle 活门 · 编号 advisory lint · 技能作者句无「lower-numbered」残留
- **Steps**:
  - graph.ts contradiction 类退役（类型面/校验/错误文案/`batches()`/header 注释）· 前向引用合法 · cycle 活门具名报错 — checkable: graph.test 前向引用正例绿 + 环用例具名违约 + 五类类型面
  - lint.ts 编号/拓扑序 advisory WARN（只警不拦）— checkable: lint.test advisory 用例绿 · 非 BLOCK
  - declare.ts 边声明注释收敛 · `schema get plan` 输出面无「反依赖」描述 — checkable: 注释/schema 输出 grep + doc-contract 前向引用负例转正
  - cdd-plan SKILL.md 作者句更新（「may only list lower-numbered tasks」零残留）— checkable: 技能面 grep + skill-anatomy 结构绿
  - **pre-flight 接线（v1.13 · §3.8）**：边提取括号截断（`DependsOn` 值域 = 首 `(` 前裸数字列表 · 行尾注释零参与 · duplicate/self-loop 由散文注入的用例转负例断言）· `TaskGraph.validate()` 接线 `cdd review --type plan` 前置 + implement/review/fix 派发前置（具名 BLOCK · child 零派发）· implement 门校验 `--tasks` = 派生 ready batch 整组（拆组 → BLOCK）· 派生波表随门输出 — checkable: 括号截断断言 · 门 BLOCK 负例（含真实自环/拆组）· 波表输出断言
  - **波次读面（v1.14 · §3.8 · 展示定案 v1.18）**：`cdd schema get plan-graph --plan <path>`（`TaskGraph#report(done)` 一投影两显示 · **显示 = 引擎自持 wave-board**——每 wave 一行、行内 task+标记（✔/▶/○）· 确定性按 wave 序 · zero第三方/zero补丁（beautiful-mermaid 退役——不控布局、全图规模丢 label）· zero新子命令）— checkable: 板题输出断言 · 全 task 每行有 wave · 消费面 reduction 同源断言
  - **消费面 reduction + 传递冗余 advisory（v1.16 · §3.8）**：`#depsOf` 返回约简（batches/frontier/report/hasPath 全走 · validate 仍读原始声明 · 闭包不变）· lint `#transitiveAdvisories`（T4 依赖 T2 经 T3 可达 → WARN）— checkable: 约简边断言 · advisory 用例绿 · wave（闭合）不变断言
  - **wave-board 展示（v1.18）**：plan-graph 显示 = 引擎自持 wave 行（每 wave 一行 · 标记 ✔/▶/○ · wave chain 删除 · beautiful-mermaid 退役）— checkable: 板出断言 · 全 task 每行有 wave
  - commit `refactor(engine): 反依赖门放开——边违约五类收编 + 环活门`（自测绿后）
- **Acceptance**:
  - TaskGraph 边违约五类（missing-edge / duplicate / missing-id / self-loop / cycle）；前向引用合法（原 contradiction 负例转正 · `contradiction`/「反依赖」零残留 grep）；cycle 活门具名违约（BLOCK · 负例断言）；编号 = ID + 波内 ascending tiebreak 保持；lint advisory 只警不拦；新树测试全绿
  - **pre-flight（v1.13）**：边提取括号截断（`DependsOn` 散文数字零入边 · 负例断言）· review plan / 三派发前置 validate 门（duplicate · self-loop · contradiction · phantom · cycle → 具名 BLOCK · 负例断言）· `--tasks` 拆派生波 → BLOCK（负例断言）· 派生波表随门输出（断言）— 任务丢失/拆组类全死门内
- **DependsOn**: 2, 5, 6, 15（T13 基线教训——语义改动落 cutover 后定型树；W12 同波 T16/T22，升序 24 殿后见技能重写最终形态）

---

## 记录 · 新树基线（T13 落盘 · 双面构建期）

T13 起的新树自测基线（后续 T14–T24 以此为准；旧树 count pin 漂移为 plan-owned 基线，见任务报告）：

- **新树自测基线（文件/用例数）**：生产面 **25 文件**（contract 7 · session 6 · face 3 · render 3 · infra 5 · 根 bin.ts 1）· 测试面 **16 文件**（contract 6 · session 4 · face 2 · render 1 · infra 1 · 根 `__tests__` 2）· **251 用例**（src-next 独立 project 全绿）。`node src-next/bin.ts` 六命令黑盒可用（schema get 输出派生 schema · issue render 聚合正文 · base set/get 工件读写 · implement/review/fix dry-run 胶囊 + handoff）。
- **零裸函数全树断言面（自 T13 基线起即全树；T18 收面协议）**：`grep -rn "^export function" src-next --include="*.ts"`（排除 `__tests__`）= **1 命中**——`src-next/face/cli.ts` 组合根 `cli()`（组合根装载面豁免）；非豁免行为面零。
- **净减账基线（T13 起记）**：新树生产面 **7,619 行**（T17 出具 29k → −20%± 净减账，真实值为准）。

### Task 25: P5 承接补遗——refKind 四型 · skills 有序链 · capabilities per-harness（v1.12 新增）

- **Objective**: overall P5 行吸收时**漏映射的三项验收**落回（v1.12 承接映射闭环）——① **refKind 四型推导**（commit-set ledger / commit-range / doc-revision 双层收敛 / graph-node——含 spec/plan 评审的 **doc_hash ref 绑定 + 同 ref 拒重**，随 ledger/review-ref 推导落 typed 数据）② **skills 有序链渲染**（多 `/xxxx` / `/skill:<bare>` form 的链式渲染消费面——cdd-dev 有序分派链）③ **capabilities per-harness 声明**（claude=parallel 实测子代理面 · host 行数据列）——三项均为 typed 数据 + 装配面消费，零散文；承接映射：overall P5 行 = T21（已落 M1/禁文/refs ✓）+ **T25（本任务）**，闭环可审计
- **Files**: `packages/cdd-engine/src-next/face/host.ts`（capabilities 数据列 · refs 面扩展）· `packages/cdd-engine/src-next/session/ledger.ts`/ref 推导面（refKind 四型 · doc_hash ref 绑定 · 同 ref 拒重）· 技能面 `packages/kairos/skills/*/SKILL.md`（有序链渲染消费）· `src-next/**/__tests__/**`（断言）
- **Consumes**: T16 技能 6 集终态 · T11/T13/T21 引擎面 · T24 反依赖门面
- **Produces**: P5 三件 typed 落地 · overall P5 行承接映射闭环
- **Steps**:
  - refKind 四型数据化（commit-set ledger / commit-range / doc-revision 双层 / graph-node——`doc_hash` ref 绑定 + 同 ref 拒重判定）— checkable: 四型断言 + 同 ref 拒重负例
  - capabilities per-harness 声明（host 行 `capabilities` 列：claude=parallel · cursor/pi 按实测面）— checkable: host 断言 · 零散文
  - skills 有序链渲染（`/xxxx`/`/skill:` 多 form 的链式渲染消费——cdd-dev 有序分派链断言）— checkable: 渲染断言
  - 承接映射闭环：`grep` overall P5 验收行 ↔ T21/T25 步骤逐条可对 — checkable: 映射表断言绿
  - commit `feat(engine): P5 承接补遗——refKind 四型 · capabilities · 有序链（v1.12）`
- **Acceptance**:
  - refKind 四型推导落 typed 数据 + doc_hash ref 绑定/同 ref 拒重（负例断言绿）· capabilities 每 host 行数据声明（零散文 · 断言绿）· skills 有序链渲染消费（断言绿）
  - 承接映射闭环：overall P5 行的每一条 acceptance 都能落到 T21 或 T25 的 step/验收行（映射表逐条对账）——「What gets absorbed must get mapped.」
- **DependsOn**: 16

## Constraints

- **严格派生波次（v1.12 · 硬纪律）**：派发 EXACTLY `effectiveGroups`（TaskGraph 由 `- **DependsOn**:` 边推导的 ready batch · 波内升序），一架一轮，零手工拆组；拆组/重排 = Plan Sole Writer 的边修订（改 DependsOn 重推导）；`--tasks` 只取完整派生组。已发生拆组（W5/W8）记历史偏差不重派
- **承接映射闭环（v1.12 · 全计划）**：phase 吸收（P4–P7）的每条 acceptance 必须可映射到某个 plan 任务的 step/验收行（「What gets absorbed must get mapped」）；T25 承接映射为样板——漏映射即 plan 缺陷
- **新旧零依赖（贯穿 T1–T24）**：`src-next` ↔ 旧树双向零 import；新树全量按新架构/OOP 单范式重写，不借用旧符号/旧 helper/旧目录形状；**数据面归位（T21，v1.4）**：三稳态 JSON 收敛为 typed 平面成员（infra/runtime · face/host · render/templates）——新树零 JSON 读取、零读旧 `config/` 路径（grep 断言），`config/` 整目录随 T15 cutover 删除零重建；schema/lexicon 派生产物由新树自派生（并行期测试不读旧派生产物）
- **双面构建纪律**：cutover 前旧树保持活跃（入口未切）；每任务自测绿（该任务面 vitest/独立断言）再交下任务；新树 vitest project 与旧树并存且各自全绿
- **每任务一个提交**：conventional commit（feat/refactor/docs/chore 前缀）；precommit（lint-staged）绿才提交；历史文档正文零 retro-rename（docs/kairos/specs 既往版本行不动）
- **净减账为方向证明**：T13 起记录新树行数基线，T17 出具 29k → −20%± 的净减账（真实值为准，不架构假账）
