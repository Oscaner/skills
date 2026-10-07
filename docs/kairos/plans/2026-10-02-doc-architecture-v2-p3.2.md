# 文档架构方法论 v2 — P3.2 Implementation Plan v1.0（全系统从零重建 greenfield）

**Spec:** [2026-10-02-doc-architecture-v2-p3.2-design.md](docs/kairos/specs/2026-10-02-doc-architecture-v2-p3.2-design.md)

- **Parent program**: [2026-10-02-doc-architecture-v2-overall.md v1.21](docs/kairos/specs/2026-10-02-doc-architecture-v2-overall.md)
- **Version**: v1.0 · 2026-10-07
- **Depends on**: P3.1（Done）· P3.2 design spec v1.2（Approved · 2026-10-07）
- **Base**: develop

执行序：新树 `src-next` 自底向上建齐（骨架 → contract → session → face → infra/render → bin）→ 引擎测试全绿 → cutover（入口切换 + 删旧树）→ scripts-next → 技能 8→6 → 终验。新旧零依赖贯穿全计划（T1 起 grep 断言、每任务自测）。

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
  - 三份登记表数据（overall 约 N 元素 · plan 约 N · phase-spec 约 N；锚取自方法论文档骨架语义，不得从旧树拷贝代码）— checkable: 三表非空且每元素过类型校验
  - 写 declare.test：登记表完整性（presence 合法域 · 锚唯一 · refKind 枚举内）— checkable: test 绿
  - commit `feat(engine): contract/declare 三登记表`（自测绿后）
- **Acceptance**:
  - 三登记表存在；每元素五字段齐全；锚唯一性测试绿
  - 零 import 旧树（zero-dep 测试仍绿）
- **DependsOn**: 1

### Task 3: contract · project——派生投影（schema/slices/tokens/reference）

- **Objective**: `src-next/contract/project.ts` 从登记表派生四投影：JSON schema（字节从新树首版即钉）· slices 解析 regex · tokens · reference 词汇
- **Files**: `packages/cdd-engine/src-next/contract/project.ts`（新建）· `src-next/contract/__tests__/project.test.ts`（新建）
- **Consumes**: T2 `declaredRegistries`
- **Produces**: `projectRegistries()`（{schema, slices, tokens, reference} 四投影，全派生、零手写副本）
- **Steps**:
  - `projectSchema()`：登记表 → 三 doc JSON schema 结构（含属性/必填描述）— checkable: 输出的 schema 对象可 JSON.stringify 且字节快照入测试
  - `projectSlices()`：锚 → 解析用 regex 面（与 tokens 同源过期渠道）— checkable: 每个登记元素 slice 可解析其锚
  - `projectTokens()` / `projectReference()`：词面/reference 词汇派生 — checkable: tokens/reference 与登记表元素一一对应
  - 测试钉字节快照（首版 pin）— checkable: project.test 绿且快照稳定
  - commit `feat(engine): contract/project 四投影派生`
- **Acceptance**:
  - 四投影从登记表纯派生（project.test 快照 pin）；无手写 shape 散文
- **DependsOn**: 2

### Task 4: contract · judge——单解释器 + 上下文缝不变式策略类族

- **Objective**: `src-next/contract/judge.ts` 单解释器 `Contract.validate()` 协调器 + 不变式策略类族（presence/uniqueness/domain/crosslink/order/continuity/residue/hollow/selfBounded/file-existence/sibling-scan/cross-doc-chain/section-scoped-domain），零 switch-case 判定分发
- **Files**: `src-next/contract/judge.ts`（新建）· `src-next/contract/invariants.ts`（新建，策略类族）· `src-next/contract/__tests__/judge.test.ts`（新建）
- **Consumes**: T2 登记表 · T3 reference 投影（crosslink/ref 判定）
- **Produces**: `Invariant` 抽象基类 + 十三实现 · `Contract#validate(doc): Finding[]` 协调器
- **Steps**:
  - 定义 `Invariant` 基类（evaluate(ctx): Finding[]）+ JudgeContext 类型 — checkable: 类型测试过
  - 基础九不变式类（presence…selfBounded），各以登记表为判定源 — checkable: judge.test 每类负例通过
  - 上下文缝四不变式类（file-existence/sibling-scan/cross-doc-chain/section-scoped-domain）— checkable: 四类负例测试过
  - `Contract#validate` 协调器：按登记表组配策略集顺序运行、汇总 Finding — checkable: 协调器测试（多不变式混合）绿
  - 零裸函数自检：judge/invariants 无导出的行为裸函数（仅类成员）— checkable: grep 断言绿
  - commit `feat(engine): contract/judge 单解释器 + 不变式策略类族`
- **Acceptance**:
  - 十三不变式策略类 + 协调器；判定分发零 switch-case（grep）；全部负例测试绿
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
- **Consumes**: T2 登记表（task 块解析锚）· T1 骨架
- **Produces**: `TaskGraph`（validate/batches/frontier）· `ExecutionState`（doneTasks(): Set<number> / readyBatch() 为方法，非独立新类）
- **Steps**:
  - `TaskGraph` 类：以登记表锚解析 `### Task N:` 块 + `DependsOn` 边 — checkable: 解析测试过
  - 六类 validate + 反依赖门 + batches 波次推导 — checkable: 六负例 + 波次断言测试绿
  - `frontier(done)` + `ExecutionState`（查询面）— checkable: frontier 就绪波次测试绿
  - commit `feat(engine): session graph+state`
- **Acceptance**:
  - 六类 validate 与波次负例全绿；缺边/反依赖单家在此（无第二处 edge 判定）
- **DependsOn**: 1, 2

### Task 7: session · next——NextStepRouter 单点

- **Objective**: `src-next/session/next.ts` NextStepRouter 单点（C5 决策表）：review 零 findings → none|next-group · fix blocker>0 → review（新 ref）· warn/nit → none（闭合）· BLOCKED/TIMEOUT 无 next
- **Files**: `src-next/session/next.ts`（新建）· `src-next/session/__tests__/next.test.ts`（新建）
- **Consumes**: T6 frontier/ExecutionState · T4 Finding 严重度面
- **Produces**: `NextStepRouter#next(state, ref): Route|null`（决策表单点）
- **Steps**:
  - 定义 Route/软帽（soft-cap 3 轮）常量 — checkable: 类型测试过
  - next() 决策表（含 fix 面 blocker>0/warn-nit 分支 + 零 findings 组next）— checkable: 正例/负例测试绿（warn/nit → `next: none` · blocker>0 → review · BLOCKED 无 next）
  - 软帽建议（"BLOCKED: review-cycle-cap" 语）— checkable: 软帽测试绿
  - commit `feat(engine): session next 单点`
- **Acceptance**:
  - next() 是唯一 next: 生成面；语义表负例全绿
- **DependsOn**: 6, 4

### Task 8: session · run——参数化单 lifecycle

- **Objective**: `src-next/session/run.ts` 参数化**单 lifecycle**（task/branch/spec/plan 目标类型 faces 数据表驱动），替代旧三 lifecycle 并行；一 dispatch 一 advance
- **Files**: `src-next/session/run.ts`（新建）· `src-next/session/faces.ts`（新建，faces 数据表）· `src-next/session/__tests__/run.test.ts`（新建）
- **Consumes**: T6 graph/state · T7 next · T9 ledger（handoff/round）
- **Produces**: `Lifecycle` 参数化单类（faces 表：审计目标/doc 面/next 语义）+ `advance()` 跑一步
- **Steps**:
  - faces 数据表（task/branch/spec/plan 各自的审计目标 + 产物面 + next 消费语义）— checkable: faces 表测试过
  - Lifecycle.advance()（frontier→派发→结果→记账→next 路由）— checkable: 四类型端到端小循环测试绿
  - 胶囊交互点（经 face/capsule，见 T10）留接口 — checkable: 接口类型测试绿
  - commit `feat(engine): session run 单 lifecycle`
- **Acceptance**:
  - 单一 lifecycle 类覆盖四目标类型；端到端 advance 测试全绿
- **DependsOn**: 6, 7

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
- **Consumes**: T2 登记表（词面锚）· T7 next（next: 站词）
- **Produces**: `Words`（单词表 + 存取器合一）· `Capsule#emit(status, blocker, handoff, next)`（`status · blocker · handoff · next:` 词面字节稳定，首版即钉 pin）
- **Steps**:
  - Words 类：doc 词 + 胶囊站词 + 守卫 ban 词并入一词表数据 — checkable: 词表测试绿（无第二词表）
  - Capsule.emit 单一输出面 — checkable: 胶囊字节快照 pin 测试绿
  - v1 词面与既有消费词面一致（同词不改判，非兼容而是稳态）— checkable: 词面对照测试绿
  - commit `feat(engine): face words+capsule`
- **Acceptance**:
  - 一词表单源（无并行词表）；胶囊词面字节 pin 绿
- **DependsOn**: 2, 7

### Task 11: face · cli——组合根

- **Objective**: `src-next/face/cli.ts` 组合根：implement/review/fix/schema/issue/base-branch 子命令面（词面稳态），装配 contract/session/face 各对象为唯一裸入口
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
  - 新树自测基线记录（文件/用例数）入计划 — checkable: 基线表落盘
  - commit `feat(engine): bin 接线 + 新树测试全绿`
- **Acceptance**:
  - `node src-next/bin.ts` 六命令可用；src-next project vitest 全绿；旧 src 测试保持绿（双面同时绿）
- **DependsOn**: 11, 12

### Task 14: scripts-next 重写——守卫消费引擎元数据 + 单编排器

- **Objective**: `scripts-next/` 重写：守卫**消费新树导出**（通道审计/词 ban 表数据化零正则世界）+ 单一 emit/validate 编排器（双 Orchestrator 合一 · 薄 wrapper 折叠）
- **Files**: `scripts-next/`（新建：emit 单编排 · validate 单编排 · guard-lib）· `scripts-next/__tests__/`（新建）
- **Consumes**: T13 新树导出面（元数据：词表/通道/结构断言）× 新树 bin（smoke 消费面）
- **Produces**: scripts-next（emit+validate 单编排 · guard 数据表驱动）
- **Steps**:
  - guard 库（checkAnatomy 语义保留：技能结构契约；channel/词面审计消费新树导出，零正则 re-walk）— checkable: guard 测试绿（消费面断言）
  - 单 emit 编排（source.json+manifests 派生）+ 单 validate 编排（runner 数据表）— checkable: emit 产物字节校验 + validate 子流程测试绿
  - smoke-cdd 面向新树 bin — checkable: smoke 干跑绿
  - commit `feat(scripts): scripts-next 守卫元数据化 + 单编排器`
- **Acceptance**:
  - 无并行正则世界（通道审计 = 新树导出断言）；单 emit/validate 编排器；scripts-next 测试全绿
- **DependsOn**: 13

### Task 15: cutover——入口切换 + 删旧树

- **Objective**: 入口切换（package.json#exports/bin + tsconfig include → `src-next`；`.kairos`/run 链 → scripts-next），随后**删除旧树**（`src/` 旧平面 · `scripts/` 旧工具），旧技能文件移除在 T16 一并
- **Files**: `packages/cdd-engine/package.json`（改 exports/bin）· `packages/cdd-engine/tsconfig.json`（改 include → src-next）· `packages/cdd-engine/vitest.config.ts`（改）· `scripts/`（删）· `packages/cdd-engine/src/`（删）
- **Consumes**: T13 新树全绿 · T14 scripts-next 全绿
- **Produces**: 切点后的活跃树 = 新树；旧树/旧脚本零残留
- **Steps**:
  - 出口切换 package.json/tsconfig/vitest → src-next + scripts-next — checkable: `node packages/cdd-engine/src-next/bin.ts implement --help` 等从新入口可跑
  - 删旧 `src/` 旧平面目录 + `scripts/` 旧工具 — checkable: 目录不存在（`test ! -d`）
  - 零残留 grep（旧符号/旧分组/旧 helper 名全树零命中）— checkable: 残留 grep 断言绿
  - commit `refactor(engine): cutover 切 src-next + 删旧树`（大删）
- **Acceptance**:
  - 活跃入口全指新树；`src/`、`scripts/` 旧树零残留（grep 断言）；更新后引擎 CLI 从新树跑通六命令
- **DependsOn**: 14

### Task 16: 技能 8→6 重写 + skill-anatomy + emit 再生 + README

- **Objective**: `packages/kairos/skills/` 重写为 6 集（cdd-design · cdd-spec-writer · cdd-plan · cdd-dev · cdd-close · cdd-report）；全链 digraph = 执行节点 + 单 next-loop 自环（边零状态标签）；skill-anatomy 注册 6 集 + 目录扫描守卫；emit 再生 (.claude/.cursor/marketplace)；README 随 6 集重写
- **Files**: `packages/kairos/skills/*/SKILL.md`（8→6 重写）· `packages/cdd-engine/config/schema/skill-anatomy.json`（改 6 集注册）· `.claude-plugin/`·`.cursor-plugin/`·`marketplace/`（emit 产物）· `packages/kairos/README.md`（改）
- **Consumes**: T15 新引擎语义（next: 单环路 / 胶囊词面）· T14 scripts-next（checkAnatomy）
- **Produces**: 6 集 SKILL.md（spec-writer 合一参数化 · next-loop 折叠）· skill-anatomy 6 集注册 · emit 产物再生
- **Steps**:
  - 六链 SKILL.md 重写（digraph 单 next-loop 自环 · Node Definitions 零路由自述 · 纪律全数归 Invariants；cdd-spec-writer 参数化 single/phase/overall）— checkable: 六文件结构自查（digraph↔defs 一致）
  - skill-anatomy 注册 6 集 + 目录扫描守卫期望更新 — checkable: `node scripts-next/... validate` guard 绿（或新树校验面）
  - `node scripts-next/run.ts emit` 再生清单 — checkable: emit 产物与 `emit-check` 零漂移
  - README 消费面随 6 集重写（技能表/upstream 安装表/独立入口说明）— checkable: README 表与目录扫描深度一致
  - commit `feat(kairos): 技能 8→6 + skill-anatomy + emit 再生`（governed by precommit/validate）
- **Acceptance**:
  - 6 集 SKILL.md 落地；digraph↔defs↔text 一致断言绿；skill-anatomy 6 集 + 注册守卫；emit 新鲜；README 一致
- **DependsOn**: 15

### Task 17: 终验 + 消费面同步 + changesets + 净减账

- **Objective**: 全量终验（validate ALL PASS · typecheck ×3 · biome · emit 新鲜）· 三 schema description 与登记表一致（派生同步）· changesets（cdd-engine major / kairos major）· 净减账落档（29k → −20%±）· 历史文档零 retro-rename 复核
- **Files**: `.changeset/*.md`（新建）· `docs/kairos/specs/*.md`（只读复核，不改历史正文）· 净减账记录（计划/文档面）
- **Consumes**: T16 技能/emit · T15 新树 · T14 scripts-next
- **Produces**: validate ALL PASS · changesets · 净减账记录
- **Steps**:
  - 全量终验链 — checkable: `node scripts-next/run.ts validate`（或 precommit 等价）ALL PASS
  - typecheck ×3 + biome — checkable: 全绿
  - 三 schema description 与登记表一致性复核（派生对账）— checkable: 对账断言绿
  - `pnpm run changeset` 建 changeset（cdd-engine major · kairos major）— checkable: .changeset/* 落盘
  - 零残留全树 grep（旧符号/旧技能数 8→6 残留）· 净减账（新树 src-next 行数 vs 旧基线）— checkable: grep 零 + 净减行数入记录
  - 历史文档零 retro-rename 复核（docs/kairos/specs 既往版本行不动）— checkable: git log 对比复核通过
  - commit `chore: P3.2 终验 + changesets + 净减账`
- **Acceptance**:
  - validate ALL PASS · typecheck ×3 · biome · emit 新鲜；changesets 落盘；净减账达标（或记录真实值）；历史正文零 retro-rename
- **DependsOn**: 16

## Constraints

- **新旧零依赖（贯穿 T1–T17）**：`src-next` ↔ 旧树双向零 import；新树全量按新架构/OOP 单范式重写，不借用旧符号/旧 helper/旧目录形状；外部契约 JSON（engine-config/harness-contract/template-contract）以稳态数据读取，schema/lexicon 派生产物由新树自派生（并行期测试不读旧派生产物）
- **双面构建纪律**：cutover 前旧树保持活跃（入口未切）；每任务自测绿（该任务面 vitest/独立断言）再交下任务；新树 vitest project 与旧树并存且各自全绿
- **每任务一个提交**：conventional commit（feat/refactor/docs/chore 前缀）；precommit（lint-staged）绿才提交；历史文档正文零 retro-rename（docs/kairos/specs 既往版本行不动）
- **净减账为方向证明**：T13 起记录新树行数基线，T17 出具 29k → −20%± 的净减账（真实值为准，不架构假账）