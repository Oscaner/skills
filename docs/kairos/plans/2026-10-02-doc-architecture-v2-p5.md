# 文档架构方法论 v2 — P5 Plan（DispatchContract + DispatchPacket 收敛重规划）

**Spec:** [2026-10-02-doc-architecture-v2-p5-design.md](docs/kairos/specs/2026-10-02-doc-architecture-v2-p5-design.md)

- **Parent program**: [doc-architecture-v2-overall.md v1.59](docs/kairos/specs/2026-10-02-doc-architecture-v2-overall.md)
- **Version**: v1.3 · 2026-10-10
- **Depends on**: P3.2（Done · [p3.2-plan v1.31](docs/kairos/plans/2026-10-02-doc-architecture-v2-p3.2.md) —— serial-phase GATE 满足 · v1.57 收敛重规划基线 · v1.58 契契修复 · v1.59 重开机制 T7)
- **Base**: develop

执行序（**波标签 = plan-graph board 派生标签 · W1 起序**）：W1 = {T1, T2, T3, T4, T6, T7}（W1 内串行落位——共享文件面：T1/T2 同 host.ts/host.test.ts · T1/T7 同 cli.ts——同 implement round 单轮串行 · 不得按「独立」并行派发防文件双向冲突；T3 FIX_SHELL typed · T4 graph-node 删 · T6 契契修复（judge 面）· T7 重开机制（ledger + cli 面））→ W2 = {T5}（终验 · 零残留 grep · changesets · closeout 回填前置）。

## Constraints

- **零新 CLI 子命令**：收敛只删/改现有 DISPATCH/REFS/templates/ledger 面（charter Non-goal #1 保持）
- **TDD colocated**：引擎改动先测后写（src-next 各模块 `__tests__` 同址）；删除断言随删（净负断言）
- **T1 原子簇纪律**：删 `DispatchTable.fix` 必填 typed 成员 = 原子变更——host.ts/cli.ts/guard.ts + 测试同 commit，任一分离则 tsc 破（checkChannels `pushRef(undefined)` TypeError）
- **固定体契约**：FIX_SHELL 增量 = typed 指令句（英文 · 每句可机断言）· 零上游技能全文吸收（引用 vs 吸收的 fit 规则落点）
- **零残留 grep 面**：`mattpocock-skills:tdd` · `CHAINS`/`ChainKey` · `graph-node`/`GraphNodeRef`/`graphNode(`——代码面 = `packages/cdd-engine/src-next` + `scripts` + `packages/kairos`（产品 + 测试 ts 面 · 含 `__tests__`）零命中；决策登记 trail 豁免清单 = P5 plan 自文 · design spec v1.1 · overall v1.57（文档层登记语义命中不算残留）
- **历史正文零 retro-rename**：overall M/R 组已 v1.57 land（决策表现状面）；本 plan 不动历史正文
- **English-primary 消费面**：引擎注释/模板/commit 信息英文；内部 specs/plans 中文（Strategy B）
- **变更集义务**：cdd-engine 一枚（host/templates/ledger/guard 收敛）· kairos 若 SKILL 面动随 T5（预期零）——独立提交
- **DependsOn 反依赖门**：边仅引用更小编号（编号序 = 拓扑线性化锚）
- **契契一致性（T6）**：prose 任务提及零硬检（reference-lint WARN-only 为唯一观察面 · DependsOn 为唯一结构引用面——T6 违反即回归）

### Task 1: fix 面无 ref——DISPATCH/REFS/`#skillRef`/guard 原子簇收敛

- **Objective**: design §2.3/§2.5——`DISPATCH.fix` 槽删除 · `DispatchTable.fix` 必填字段删除 · `REFS` 删 `mattpocock-skills:tdd` 键（三 host 斜杠形式随删）· `cli.ts#skillRef` fix 相位返回 null（与 spec/plan review、docs-fix 同构——review 表仅 wave/branch 两槽机制不动）· `scripts/lib/guard.ts` checkChannels 的 `pushRef(this.#dispatch.fix)` 派生行随删（guard.ts:727 · checkChannels dispatch/refs 派生块 717-731 域 · 头注同步）· cli.ts ≈470 注释样板（`"/mattpocock-skills:tdd"` 例）随改——原子簇（删必填 typed 成员迫使消费者同 commit · tsc 全程不破）
- **Files**: `packages/cdd-engine/src-next/face/host.ts` · `packages/cdd-engine/src-next/face/cli.ts` · `scripts/lib/guard.ts` · `packages/cdd-engine/src-next/face/__tests__/host.test.ts` · `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（核改若含 fix prompt 前缀断言——现源梳理仅 implement/code-review 前缀断言在册 · 复审）· `scripts/__tests__/guard.test.ts`（核改）
- **Consumes**: `DispatchTable.fix`（host.ts:116 必填成员）· `DISPATCH.fix`（host.ts:247）· `REFS["mattpocock-skills:tdd"]`（host.ts:279-282）· `#skillRef`（cli.ts:473-494 fix 分支）· `GuardLibrary#dispatch` + `pushRef`（guard.ts:717-731）
- **Produces**: DISPATCH 两活面（implement → `mattpocock-skills:implement` · review.wave/branch → `mattpocock-skills:code-review`）· `#skillRef(fix)` → null · `checkChannels` 零 fix push（`this.#dispatch.fix` 不存在下不抛 TypeError）
- **Steps**:
  - 失败先行：guard.test 新增负例——`DISPATCH` 面不含 fix 键时 `checkChannels()` 通过（现 `pushRef(this.#dispatch.fix)` 行使 `value.ref` 抛 TypeError——先证红）— checkable: 断言红（TypeError 复现）
  - `host.ts` 删 `DISPATCH.fix` 槽 + `DispatchTable.fix` 字段（含头注 116 行域）· `REFS` 删 `mattpocock-skills:tdd` 键三行（279-282）· 收口注释（`#skillRef` 注释内 tdd 例）— checkable: tsc 在 cli/guard 消费者报缺属（预期中间态红）
  - `cli.ts` `#skillRef` 改 implement-only 取槽（`dispatch[frame.phase as "implement"]` · fix 相位自然回落 null 分支）· ≈470 行注释样板改（去 tdd 例）— checkable: 编译绿
  - `guard.ts` checkChannels 删 `pushRef(this.#dispatch.fix)` 行 · 头注（二三步定义区）同步 — checkable: guard.test 全绿（contain 负例验证零 TypeError）
  - `cli.test.ts`/`host.test.ts` 核改：全树无 tdd ref 断言残留 · 前缀断言面（implement `:1592-1594` · code-review `:1822-1869` 保持 · fix 面无 `/mattpocock-skills:tdd` 前缀断言新增或确认缺失合理）— checkable: 两文件全绿
  - 代码面 grep `mattpocock-skills:tdd` 零残留（作用域 = `packages/cdd-engine/src-next` + `scripts` + `packages/kairos` · 含 `__tests__`；决策登记 trail 豁免清单 = P5 plan 自文 · design spec v1.1 · overall v1.57） — checkable: 零命中
  - commit — checkable: `feat(engine): fix face no skill-ref — DISPATCH.fix/REFS tdd key/guard checkChannels fix push removed (DispatchContract 收敛)` 落位 · 树净
- **Acceptance**: `DISPATCH` 两活面（fix 槽+字段+tdd 键零残留）· `#skillRef(fix)` null · `checkChannels` 零 fix push 负例绿 · 引擎 vitest 全绿（387−Δ）
- **DependsOn**: none

### Task 2: CHAINS 数据面删除

- **Objective**: design §3.1/§3.2——`CHAINS` 常量（host.ts:134-151）· `ChainKey` 类型（:154）· `HostContract.chains` 字段（:161）+ 头注删除；`host.test.ts` **ordered skill chains describe 块删除**（37-83 行 · 3 it/6 expect · 37 `describe` 始——P3.2 序链数据面期的 self-test 段，CHAINS 唯一消费者）——**capabilities per-harness describe 块（24-35 行）A4 存活保留**（design §1.2 · 明示只登记不动）；验收 C1 撤销（REFS 已覆盖 per-host 渲染 · 链序零消费）
- **Files**: `packages/cdd-engine/src-next/face/host.ts` · `packages/cdd-engine/src-next/face/__tests__/host.test.ts`（块删 + 残余清理：头注序链叙述 · `formOf` · `REFS`/`HostId`/`HostReferenceTable` import——落 Steps 2）
- **Consumes**: `CHAINS`（host.ts:134 唯一声明 + host.test.ts:14 import · 37-83 消费）
- **Produces**: `HostContract` 面 chains 域归零（chains/ChainKey/CHAINS 三符号删除 · REFS 保持全键 per-host 渲染）
- **Steps**:
  - `host.ts` 删 `CHAINS` 常量 + `ChainKey` 类型 + `HostContract.chains` 字段 + 头注（128-162 域梳理）· host.test.ts 消费面暂不清理（保留 `CHAINS` import） — checkable: 红（host.test.ts:14 `CHAINS` import 指向已删导出 · tsc 报——真红可复现）
  - `host.test.ts` 删 ordered skill chains describe 块（37-83 · 3 it/6 expect）· 保留 capabilities 块（24-35）· 残余清理：头注序链叙述段（:2-10）· `formOf`（:16-22）· import 行（:13 删 `HostId`/`HostReferenceTable` · :14 留 `HOSTS` 删 `CHAINS`/`REFS`） — checkable: 编译绿 · host.test 全绿（capabilities 断言存活 · biome 未用 import/函数零残留门禁过）
  - 代码面 grep `CHAINS`/`ChainKey` 零残留（作用域 = `packages/cdd-engine/src-next` + `scripts` + `packages/kairos` · 「chains」小写注释豁免 · 决策登记 trail 豁免清单 = P5 plan 自文 · design spec v1.1 · overall v1.57） — checkable: 零命中
  - commit — checkable: `refactor(engine): delete CHAINS ordered-chain data plane (zero consumers · REFS covers per-host rendering)` 落位 · 树净
- **Acceptance**: `CHAINS`/`ChainKey`/`chains` 字段零残留（含 `__tests__`）· capabilities per-harness 断言存活（A4）· 引擎 vitest 全绿（387−3 it）
- **DependsOn**: none

### Task 3: FIX_SHELL 补 typed 两条（验而后修 + 条件 tdd）

- **Objective**: design §2.4/§4.2——`templates.ts` FIX_SHELL（≈181-197）增量两条 typed 指令句（英文 · 固定体字节契约 · FRAME_ITEMS 之后）：① **验而后修**——措辞对齐 receiving-code-review 血统（`READ→VERIFY against codebase→EVALUATE technically sound→one at a time, test each`）：每条 finding 先对 codebase 实态核对 → 技术成立才改 · 不成立留 note 拒盲从 · 逐条 · 每修必验；② **条件 tdd**——B1 `appliesTo` 语义承接：IF finding 要求行为变更且缺测试 → 先写/改测试 red→green 纪律一句（恒常不触发）——零上游技能全文吸收（~200 行技能文本 vs 2 条句）
- **Files**: `packages/cdd-engine/src-next/render/templates.ts` · `packages/cdd-engine/src-next/render/__tests__/render.test.ts`
- **Consumes**: `FIX_SHELL`（templates.ts:181 行）· FRAME_ITEMS/EVIDENCE_ITEM 固定体面
- **Produces**: `FIX_SHELL` 含两条 typed（子串可机断言 · 头序字节稳定）
- **Steps**:
  - 失败先行：`render.test.ts` 增断言——fix round 固定体含「verify-then-apply」核心语词（`verify`/`technically sound` 域）· 条件 tdd 条件句（`requires a behavior change` 域）— checkable: 红（现值 FIX_SHELL 无）
  - `templates.ts` FIX_SHELL 补两条 typed 句（英文 · 对齐 §2.4 措辞语义 · 保持 `## Round context` 前固定区域） — checkable: 断言绿 · 固定体头/序不变（快照/前缀字节稳定）
  - commit — checkable: `feat(engine): FIX_SHELL gains verify-then-apply + conditional-tdd typed instructions (receiving-code-review bloodline)` 落位 · 树净
- **Acceptance**: FIX_SHELL 含两条 typed（断言绿）· 固定体契约保持（字节/头序）· 零技能全文残留 · 引擎 vitest 全绿（387+Δ）
- **DependsOn**: none

### Task 4: graph-node ref 删除（RefKind 四型→三型）

- **Objective**: design §3.3/§3.4——`ledger.ts` `RefKind` union 成员 `"graph-node"` 删除（:181 → 三型 `"commit-set-ledger" | "commit-range" | "doc-revision"`）· `GraphNodeRef` 接口（:213-215）· `ReviewRef` 成员（:220）· `graphNode()` 构造（:265-266）· 相等 case（:294-295）+ 头注（:178 · :211）删除；`ledger.test.ts` graphNode 断言段删（425-426 · 462-463）；R5 关闭裁定已落 overall v1.57（只登记不改）
- **Files**: `packages/cdd-engine/src-next/session/ledger.ts` · `packages/cdd-engine/src-next/session/__tests__/ledger.test.ts`
- **Consumes**: `RefKind`（ledger.ts:181）· `ReviewRef`（:220）· `refs.graphNode` 构造/相等（:265 · :294）
- **Produces**: `RefKind` 三型 union（零 graph-node）· `ReviewRef` 三型（CommitSetLedgerRef | CommitRangeRef | DocRevisionRef）
- **Steps**:
  - 失败先行：`ledger.test.ts` 新增负例——`RefKind` union 含 `"graph-node"`（`("graph-node" extends RefKind ? true : false) extends true` → 断言为 false） — checkable: 红（现四型 union 含 graph-node）
  - `ledger.ts` 删 union 成员 + `GraphNodeRef` + `ReviewRef` 成员 + `graphNode()` 构造 + 相等 case + 头注 — checkable: 编译绿（旧测试 graphNode 引用先删）· ledger.test 全绿（新旧断言并存期同步删旧 graphNode 断言段 425-426/462-463）
  - 代码面 grep `graph-node`/`GraphNodeRef`/`graphNode\(` 零残留（作用域 = `packages/cdd-engine/src-next` + `scripts` + `packages/kairos` · 含 `__tests__`；决策登记 trail 豁免清单 = P5 plan 自文 · design spec v1.1 · overall v1.57——R5 已 v1.57 关闭登记） — checkable: 零命中
  - commit — checkable: `refactor(engine): delete graph-node ref (RefKind 4→3 — wave atomicity makes node-level review structurally absent)` 落位 · 树净
- **Acceptance**: `RefKind` 三型（零 graph-node）· graphNode 符号零残留（含 `__tests__`）· 引擎 vitest 全绿（387−Δ）
- **DependsOn**: none

### Task 5: 终验 + 零残留 + changesets + closeout 回填前置

- **Objective**: design §5——引擎 vitest 全绿（387 − 删断言 + FIX_SHELL 断言新增 · 数字实态为准）· `pnpm run typecheck`（×3）· `biome clean` · **`pnpm run validate` ALL PASS**（emit 新鲜 · doc-contract gate · channel audit——checkChannels 收敛后零 drift）· 零残留 grep 三面（tdd · CHAINS · graph-node）· changesets（cdd-engine 一枚 · kairos 若 SKILL 面动随——预期零）· closeout 回填前置登记（Phase inventory P5 行 → Done + 交付记录随 cdd-close closeout 落档）
- **Files**: `.changeset/*.md`（cdd-engine · `pnpm run changeset` 生成）· closeout 落点（非本任务修改目标）：docs/kairos/specs/2026-10-02-doc-architecture-v2-overall.md（P5 行 Done 回填——**T5 内不改动该文件** · gloss 稿草拟落工作区/交付登记 · v1.58 由 cdd-close closeout 落档）
- **Consumes**: Task 1-4 全部产物
- **Produces**: validate ALL PASS 全量断言面 · changesets 落位（cdd-engine）· 交付记录回填登记（closeout 前置）
- **Steps**:
  - `pnpm --filter @oscaner-skills/cdd-engine test` — checkable: 全绿（净负断言 + 新增断言 · 数字实态）
  - `pnpm run typecheck`（cdd-engine / scripts / kairos-tests ×3） — checkable: exit 0
  - `biome check`（或 `pnpm exec biome check`） — checkable: clean
  - `pnpm run validate` — checkable: ALL PASS（emit 新鲜 · residue / lexicon / channel audit / doc-contract gate / version sync）
  - 零残留 grep 三面（`mattpocock-skills:tdd` · `CHAINS`/`ChainKey`（小写 chains 注释豁免）· `graph-node`/`GraphNodeRef`/`graphNode(`——代码面 = `packages/cdd-engine/src-next` + `scripts` + `packages/kairos`（含 `__tests__`）· 决策登记 trail 豁免清单核 = P5 plan 自文 · design spec v1.2 · overall v1.58） — checkable: 零命中
  - changeset：cdd-engine—`pnpm run changeset`（DispatchContract 收敛：fix face no ref · CHAINS/graph-node 删 · FIX_SHELL typed）×1 · kairos 若 SKILL 面动 ×1 — checkable: `.changeset/` 新增落位
  - 回填登记（交付记录草拟 · closeout 前置）：gloss 稿 = P5 行 acceptance 逐条核（spec v1.2 · plan v1.2 · 分支终审记录）· 草稿落工作区/交付登记（不触 repo 源树） — checkable: 登记稿齐备 · 树净
  - commit — checkable: `chore(engine): changeset——DispatchContract 收敛（fix face no ref · CHAINS/graph-node 删 · FIX_SHELL typed）` 落位 · 树净
- **Acceptance**: `validate ALL PASS` · 零残留 grep 三面零命中 · changesets 落位（cdd-engine）· 交付记录回填登记齐备（closeout 随）
- **DependsOn**: 1, 2, 3, 4

### Task 6: 契契修复——prose task 提及硬检删除

- **Objective**: design §6（v1.2 backfill · find 自产 dogfood——plan authoring precommit 实证：正文合法引用既有 program 的历史任务序号被 crosslink 判为未注册任务引用）——`planCrosslinks`（invariants.ts）"Task prose reference" 硬 finding 检查**删除**（兑现 declare.ts:626「WARN-only observation surface」声明 + lint.ts:213「missing-id——never a suspect」文档设计——同一 token 双面矛盾裁决消解）· **DependsOn 越界硬门保留**（唯一结构引用面）· prose 观察面唯一归属 = reference-lint WARN pass（零新逻辑——lint.ts 已静默 unregistered）· `declare.ts:626` 注释更新（crosslink 不消费 · lint 唯一消费者）· 消费者面：plan 含未注册 `T<n>` 提及（历史任务号/波标签/缩写）过 gate 零 finding
- **Files**: `packages/cdd-engine/src-next/contract/invariants.ts`（planCrosslinks 删 prose 块 · DependsOn 循环保留）· `packages/cdd-engine/src-next/contract/declare.ts`（:626 注释更新）· `packages/cdd-engine/src-next/contract/__tests__/invariants.test.ts`（prose 硬检负例删/改 + 新回归：`T<n>` 提及零 finding）· `packages/cdd-engine/src-next/contract/__tests__/lint.test.ts`（missing-id 静默回归若缺则补）· 核改面（若 doc-contract gate/参数断言引用 prose 硬检）
- **Consumes**: `planCrosslinks`（invariants.ts）· "Task prose reference" 元素（declare.ts:627 · valuePattern）· `LintPass`（lint.ts——已持 prose 观察 · 不新增）
- **Produces**: `planCrosslinks` = DependsOn 硬门 only（零 prose finding）· 未注册 `T<n>` 提及零 finding（gate BLOCK-free）· reference-lint WARN 面不动（missing-edge suspects · unregistered 静默）
- **Steps**:
  - 失败先行：invariants.test 新增负例——plan 正文含 prose 提及未注册任务号（既有 program 历史任务序号类）→ judge findings 零命中（现 prose 块硬检必炸——先证红） — checkable: 红（crosslink finding 复现）
  - `invariants.ts` `planCrosslinks` 删 prose 块（prose 遍历 + finding push）· DependsOn 越界循环保留 — checkable: tsc 绿 · 负例绿（零 finding）
  - `declare.ts:626` 注释更新（crosslink 不消费该元素 · reference-lint 为唯一消费者——一声明注释与解析行为对齐） — checkable: 编译绿
  - 旧 prose 硬检负例删/改迁移（若现测 "prose references unregistered" 用例）· missing-id 静默回归断言（lint.test：含未注册 `T<n>` 提及 zero WARN） — checkable: invariants.test + lint.test 全绿
  - 全仓 grep `Task prose reference` 消费面——crosslink 零引用（仅 declare 登记 + lint 消费） — checkable: 消费面收敛
  - commit — checkable: `fix(engine): drop crosslink hard-check on prose task references (WARN-only per declare — lint owns the observation · DependsOn stays the structural gate)` 落位 · 树净
- **Acceptance**: 未注册 `T<n>` 提及过 gate 零 finding（回归断言）· DependsOn 越界硬门保留（负例在册）· reference-lint WARN 面保持 · declare.ts 注释对齐 · 引擎 vitest 全绿（387−Δ+Δ）
- **DependsOn**: none

### Task 7: doc line review 重开机制（reviewedDocRevision · identity-aware）

- **Objective**: design §7（v1.3 backfill · 用户拍板「应该要有一个机制能够重开 review · 中途 backfill 在 cdd 概念里很常见」）——line 态 = f(target identity)：doc line 补齐 wave/branch 线的 identity 驱动评审语义——ledger line record 增 **`reviewedDocRevision`**（doc review 完成时写入 · 复用 `DocRevisionRef` 双层收敛判定 version/body 变更）· `#lineGate` null 分支（cli.ts:1328 域）改 identity 判定：`target.kind === "doc"` 且 当前 `docRevision` ≠ reviewed → 放行自动重开（`recordRound` 续轮 · dispatch 流程零改 · round 续号 `{line}-review-{N+1}`）· 相等 → revision-aware BLOCK 消息替换（`plan already reviewed at vX.Y (doc-hash …) — target revision unchanged; amend body/version to open a new review` · 旧 "no open round" 对 doc line 面退役）· branch（`key="branch"`）/wave（WaveGate）不涉 · clean-tree 门先行 · 闭合语义不变（重开后照旧 review→fix→done · `next:` 字面零改）
- **Files**: `packages/cdd-engine/src-next/session/ledger.ts`（line record + `reviewedDocRevision` · doc review 完成写入面）· `packages/cdd-engine/src-next/face/cli.ts`（`#lineGate` null 分支 · 消息替换 · words 词表面若引）· `packages/cdd-engine/src-next/session/__tests__/ledger.test.ts` · `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`
- **Consumes**: `DocRevisionRef`/`docRevision()`（ledger.ts:203/260）· `recordRound`（ledger.ts:398）· `#lineGate`/`#linePhase` null 路径（cli.ts:1328/1483-1510）· 当前 doc 文件读取（hash 计算 · 零 parse 依赖）
- **Produces**: `reviewedDocRevision` line 记录 · doc line 漂移自动重开（round 续号）· 未漂移 revision-aware BLOCK（旧消息 doc 面退役）
- **Steps**:
  - 失败先行：cli.test 重开负例——plan 夹被修订（内容变更）后再跑 `review --type plan` → 现值 "no open round" BLOCK（先证红） — checkable: 红（闭合 BLOCK 复现 · 消息含 "no open round"）
  - `ledger.ts` line record 增 `reviewedDocRevision`（可空 ReviewRef）· doc review 完成写入面（review 轮落库绑定当前 doc 身份） — checkable: 编译绿 · ledger.test 增（写入/读取断言）
  - `cli.ts` `#lineGate` null 分支：doc + `docRevision(当前) ≠ reviewed` → 放行（记新轮）· 相等 → 替换消息（旧 "no open round" 对 doc 面退役 · branch/wave/无 target 面原语义保持） — checkable: 重开负例绿（round 续号断言）· 未漂移断言捕获新消息
  - 回归：branch/wave 无关（非 doc 面行为不变）· clean-tree 脏树仍 BLOCK · 重开后 fix→re-review→done 闭环 — checkable: 相关测试全绿
  - 全仓 grep 旧消息 doc 面零残留（词表/断言面若引随核） — checkable: doc 面零 "no open round"
  - commit — checkable: `feat(engine): doc line review reopens on doc-revision drift — reviewedDocRevision + identity-aware line gate` 落位 · 树净
- **Acceptance**: doc line 漂移自动重开（round 续号断言）· 未漂移 revision-aware BLOCK（消息断言）· branch/wave 无关回归 · clean-tree 门先行保持 · 引擎 vitest 全绿（387−Δ+Δ）
- **DependsOn**: none

## Change history

| Version | date | summary | author |
|---|---|---|---|
| v1.3 | 2026-10-10 | **T7 doc line review 重开机制 backfill（用户拍板「backfill → 手动清理 review 状态 → re-review」）**：新任务 7——ledger line record + `reviewedDocRevision`（doc review 完成写）· `#lineGate` null 分支 identity 判定（doc 漂移自动重开 · round 续号 · 未漂移 revision-aware BLOCK 替换旧 "no open round" doc 面）· branch/wave 不涉 · 执行序 W1 = {T1-T4, T6, T7}（T1/T7 共享 cli.ts 串行注）· Parent program 升 overall v1.59 | [human] · Claude Opus 5（kairos:cdd-plan · Plan Sole Writer） |
| v1.2 | 2026-10-10 | **T6 契契修复 backfill（用户拍板「收进 P5」· find 自产 dogfood）**：新任务 6——prose task 提及硬检删除（planCrosslinks prose 块 · DependsOn 硬门保留 · 观察面归 reference-lint WARN · declare.ts:626 注释对齐 · 回归断言）· 执行序 W1 = {T1-T4, T6} · 约束补契契一致性 · 豁免清单/gloss 版本升 v1.2/v1.58 · Parent program 升 overall v1.58 | [human] · Claude Opus 5（kairos:cdd-plan · Plan Sole Writer） |
| v1.1 | 2026-10-10 | **plan-review-1 全修（2 warn · 4 nit）**：零残留 grep 作用域钉为可判定代码面（`packages/cdd-engine/src-next` + `scripts` + `packages/kairos` · 产品 + 测试 ts 面）· 决策登记 trail 豁免清单 = P5 plan 自文 · design spec v1.1 · overall v1.57（三面 checkable 统一改写）· 执行序去「四根独立」并行暗示（T1/T2 共享 host.ts/host.test.ts 同 round 串行）· T1 guard.ts 引用钉正 727（827 误）· T2 重排失败先行（host.ts 删 CHAINS 制造真红 → 测试侧清理）· T2 Files/Steps 补登 host.test.ts 残余清理（头注序链叙述 · `formOf` · `REFS`/`HostId`/`HostReferenceTable` import）· T5 Files 改 overall.md 为 closeout 落点（非本任务修改目标 · 不改动）· 文件尾补 EOF 换行 | [human] · Claude Opus 5（kairos:cdd-plan · plan-review 1 → plan-fix 1） |
| v1.0 | 2026-10-10 | 初版——P5 收敛重规划实施计划：W1 {T1 fix 面无 ref 原子簇 / T2 CHAINS 删 / T3 FIX_SHELL typed / T4 graph-node 删} → W2 {T5 终验}——design v1.1 五组全承接 · DependsOn 三波次 · T1 原子簇纪律（必填 typed 成员删除迫使同 commit）· 零残留 grep 三面 · changesets cdd-engine | [human] · Claude Opus 5（kairos:cdd-plan · writing-plans 导入） |
