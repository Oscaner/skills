# 文档架构方法论 v2 — P3.2 Implementation Plan（全系统从零重建 greenfield）

**Spec:** [2026-10-02-doc-architecture-v2-p3.2-design.md](docs/kairos/specs/2026-10-02-doc-architecture-v2-p3.2-design.md)

- **Parent program**: [2026-10-02-doc-architecture-v2-overall.md v1.23](docs/kairos/specs/2026-10-02-doc-architecture-v2-overall.md)
- **Version**: v1.6 · 2026-10-08（**`next:` 形式补钉**——用户 2026-10-08 拍板「先落补钉再执行」：胶囊 `next:` 渲染 = Route 事实（kind+载荷 · 非完整 cdd 命令）——Route 事实型钉入 T7 · 渲染断言钉入 T10 capsule 面，T16 技能面以「事实 → 命令映射」为消费前提——旧树命令式提示取消的涌现形态补为决策）；前置 v1.5 · 2026-10-08（**T23 next fix 面 readback 后缀**——用户 2026-10-08 拍板「NextStepRouter `kind: fix` 时补 `(first read <findings> back to confirm)`」：旧树 readbackWording 设计意图于新架构落地为纯文案提示 · 机械防线由 ledger round/C5-1 兜 · 编排方是否遵守非强约束——plan review-2 闭合后追加）；前置 v1.4 · 2026-10-07（前置 v1.3 = P7 提前承接 backfill——T19 翻译系统 · T20 base 命令面；**v1.4 = P4/P5/P6/P7 全吸收 + 数据面归位 backfill**——用户 2026-10-07 拍板「config-next 完成以后删除 config」+「都是一体的」+「吸收进 P3.2」升华：**T21 数据面归位**（三稳态 JSON → typed 平面 infra/runtime · face/host · render/templates，P4/P5 承接净入——M1 supersede · refs 登记 · 三处禁文删除 · review 准则收口 · 零读 config/ · 导出面保持）· **T22 宪法化承接（P6）**（overall 拆宪法/archive · 版本行散文消解 · Standing rules 成典 · 全树 4 overalls）· **T15 扩域删 config/**（整目录零残留，零重建）· T14 认领 skill-anatomy 归位 · T16 CLAUDE.md/README 数据面同步——overall v1.23 · spec v1.4 随）））
- **Depends on**: P3.1（Done）· P3.2 design spec v1.4（Approved · 2026-10-07）
- **Base**: develop

执行序：新树 `src-next` 自底向上建齐（骨架 → contract → session → face → infra/render → bin）→ 引擎测试全绿 → `scripts-next` 重写 → cutover（入口切换 + 删旧树 + **`scripts-next` → `scripts` 改名**）→ 技能 8→6 → 终验。新旧零依赖贯穿全计划（T1 起 grep 断言、每任务自测）。

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
  - commit `refactor(engine): cutover 切 src-next + 删旧树·旧数据面 + scripts-next→scripts 改名`（大删 + 改名，经重连后的新 precommit 面提交）
- **Acceptance**:
  - 活跃入口全指新树；引擎/脚本/**数据面**旧树零残留（grep 断言：src-next 无 `config/` slash 路径命中 · `config/` 目录不存在 · `scripts-next` 改名后零残留）；**T21 数据面归位先于 T15 达成**（DependsOn 21 为硬前置——config/ 零读面清零后才删）；更新后引擎 CLI 从新树跑通六命令；root `pnpm run validate/precommit/emit` 经 `scripts/run.ts` 新链绿（**`scripts/run.ts` 为唯一工具链名**）——删除旧树提交即走新 precommit 面
- **DependsOn**: 14, 21

### Task 16: 技能 8→6 重写 + skill-anatomy + emit 再生 + README

- **Objective**: `packages/kairos/skills/` 重写为 6 集（cdd-design · cdd-spec-writer · cdd-plan · cdd-dev · cdd-close · cdd-report）；**五链 digraph（design/spec-writer/plan/dev/close）统一骨架** = 一次性执行节点 + NEXT-LOOP 单自环（边零状态标签），**两项例外**——cdd-close 止于 finish 编排语义门 + 终端（无 review 自环）· cdd-report 一次性上报工具链（无自环）；**cdd-design 收敛参数化单模板**（spec §4.1：run-cdd-charter 双节点 + run-cdd-spec/run-cdd-phase 两近同 dispatch 节点合一）；skill-anatomy 注册 6 集（经 T14 归位的引擎契约面导出）+ 目录扫描守卫；emit 再生 (.claude/.cursor/marketplace)；README 随 6 集重写；**next: 消费前提（v1.6 钉）**——技能按 `next:` Route 事实映射具体命令：Route.kind 枚举 = {none, next-group, review}（T7 钉）按 kind+载荷映射 cdd 命令，非命令文本；BLOCKED/TIMEOUT 为非 next 面（无 next 行），技能不消费 `next:`
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
- **Consumes**: T16 技能/emit · T15 新树 · T14 `scripts/`
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
- **DependsOn**: 16

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

### Task 22: 宪法化承接——P6（overall 拆宪法/档案）

- **Objective**: 用户 2026-10-07 拍板吸收 P6——overall 文档**宪法/档案双层**：`2026-10-02-doc-architecture-v2-overall.md` 拆「宪法本体（Goal / Standing rules 规范化折叠 / Cross-cutting / Phase inventory / Dependency graph）+ `-archive.md`（issue/history 结构化 record + doc-revision ref 机械化 backfill）」· **版本行 lineage 散文消解**（telescope 尾链 → 结构化修订记录）· change-history 巨型 cell → 结构化 record · **Standing rules「空壳、死代码即删」成典常态化**（已被 T15 删旧实证）· archive 精确命名定（v1.0「Archive 命名归 P6 定义」承诺通道落）· 全树 4 overalls 同口径迁移（内容逐字 · 容器改造 · 历史正文零 retro-rename）· **登记表行随**（declare.ts overall 登记行认可新形——新引擎 doc-contract 门对新形走通）
- **Files**: `docs/kairos/specs/2026-10-02-doc-architecture-v2-overall.md`（改：宪法/档案拆层 + 版本行/修订记录结构化）· `docs/kairos/specs/2026-10-02-doc-architecture-v2-overall-archive.md`（新建：issue/history 结构化 record）· 全树其余 3 overalls（改：同口径迁移）· `src-next/contract/declare.ts`（改：overall 登记行随新形）· `src-next/contract/__tests__/declare.test.ts`（改）
- **Consumes**: T15 切后稳定链 · T3 登记表/投影面（overall 登记行现面）
- **Produces**: 宪法/档案双层 · 版本行散文消解 · Standing rules 成典 · archive 命名定 · 登记表行新形
- **Steps**:
  - 宪法拆分（本体 + archive；Goal/Standing rules 规范化折叠 · issue/history 结构化 record）— checkable: 两文件结构绿
  - 版本行 lineage 散文消解 → 结构化修订记录（telescope 尾链断）— checkable: 修订记录表 + 版本行引用点检
  - Standing rules 常态化成典（空壳死代码即删——T15 实证入典）— checkable: 宪法定案文本
  - 全树 4 overalls 同口径迁移（内容逐字 · 容器改造）— checkable: 迁移 grep（内容保真 · 历史正文零 retro-rename）
  - archive 命名定（File paths Archive 行承诺通道落）+ declare.ts 登记行随 — checkable: 命名表 + doc-contract 门对新形绿
  - commit `docs(kairos): P6 宪法化承接——宪法/档案双层 + 版本行结构化`（登记行随）
- **Acceptance**:
  - 宪法/档案双层落地 + 4 overalls 迁移；版本行散文零残留（grep）；Standing rules 成典；archive 命名定；新引擎 doc-contract 门对新形绿；历史正文零 retro-rename
- **DependsOn**: 15

### Task 23: next fix 面 readback 后缀

- **Objective**: 用户 2026-10-08 拍板——`NextStepRouter` 于 **round = fix（fix 面路由）**时，capsule `next:` 渲染行尾追加 **`(first read <findings> back to confirm)`**（纯文案提示 · 编排方是否遵守非强约束）：旧树 `readbackWording`「(read <handoff> back to confirm)」的设计意图在新架构落地为文案提示——防盲目 fix 的机械防线由 ledger round/C5-1 兜，后缀仅为编排者确认提示；round 为 next() 输入面轮次上下文（T7 钉），与 Route.kind 路由决策枚举分离（kind ≠ 轮次）
- **Files**: `src-next/session/next.ts`（改：fix 面路由携带 readback 文案）· `src-next/face/cli.ts`（改：next: 渲染行尾追加）· `src-next/session/__tests__/next.test.ts`（改：fix 面 next: 行含后缀断言）
- **Consumes**: T7 next 路由器（fix 面现面）· T11 cli 渲染
- **Produces**: fix 面 next: 渲染行尾后缀
- **Steps**:
  - round = fix 时路由 → 渲染追加 `(first read <findings> back to confirm)` — checkable: next.test 断言（fix 面含后缀 · review 面不含）
  - cli capsule 渲染接入 — checkable: cli 面 next: 行含后缀
  - commit `feat(engine): next fix 面 readback 后缀`
- **Acceptance**:
  - round = fix（fix 面）的 next: 渲染行尾含 `(first read <findings> back to confirm)`（词面断言）；review 面 next: 行不含；测试全绿
- **DependsOn**: 7, 11

## Constraints

- **新旧零依赖（贯穿 T1–T23）**：`src-next` ↔ 旧树双向零 import；新树全量按新架构/OOP 单范式重写，不借用旧符号/旧 helper/旧目录形状；**数据面归位（T21，v1.4）**：三稳态 JSON 收敛为 typed 平面成员（infra/runtime · face/host · render/templates）——新树零 JSON 读取、零读旧 `config/` 路径（grep 断言），`config/` 整目录随 T15 cutover 删除零重建；schema/lexicon 派生产物由新树自派生（并行期测试不读旧派生产物）
- **双面构建纪律**：cutover 前旧树保持活跃（入口未切）；每任务自测绿（该任务面 vitest/独立断言）再交下任务；新树 vitest project 与旧树并存且各自全绿
- **每任务一个提交**：conventional commit（feat/refactor/docs/chore 前缀）；precommit（lint-staged）绿才提交；历史文档正文零 retro-rename（docs/kairos/specs 既往版本行不动）
- **净减账为方向证明**：T13 起记录新树行数基线，T17 出具 29k → −20%± 的净减账（真实值为准，不架构假账）
