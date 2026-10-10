# 文档架构方法论 v2 — P5 Plan（DispatchContract + DispatchPacket 收敛重规划）

**Spec:** [2026-10-02-doc-architecture-v2-p5-design.md](docs/kairos/specs/2026-10-02-doc-architecture-v2-p5-design.md)

- **Parent program**: [doc-architecture-v2-overall.md v1.57](docs/kairos/specs/2026-10-02-doc-architecture-v2-overall.md)
- **Version**: v1.1 · 2026-10-10
- **Depends on**: P3.2（Done · [p3.2-plan v1.31](docs/kairos/plans/2026-10-02-doc-architecture-v2-p3.2.md) —— serial-phase GATE 满足 · v1.57 收敛重规划基线)
- **Base**: develop

执行序（**波标签 = plan-graph board 派生标签 · W1 起序**）：W1 = {T1, T2, T3, T4}（W1 内串行落位——T1/T2 共享 host.ts/host.test.ts 文件面，同 implement round 单轮串行 · 不得按「四根独立」并行派发防 host.ts/host.test.ts 双向冲突；T3 FIX_SHELL typed · T4 graph-node 删）→ W2 = {T5}（终验 · 零残留 grep · changesets · closeout 回填前置）。

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
  - 零残留 grep 三面（`mattpocock-skills:tdd` · `CHAINS`/`ChainKey`（小写 chains 注释豁免）· `graph-node`/`GraphNodeRef`/`graphNode(`——代码面 = `packages/cdd-engine/src-next` + `scripts` + `packages/kairos`（含 `__tests__`）· 决策登记 trail 豁免清单核 = P5 plan 自文 · design spec v1.1 · overall v1.57） — checkable: 零命中
  - changeset：cdd-engine—`pnpm run changeset`（DispatchContract 收敛：fix face no ref · CHAINS/graph-node 删 · FIX_SHELL typed）×1 · kairos 若 SKILL 面动 ×1 — checkable: `.changeset/` 新增落位
  - 回填登记（交付记录草拟 · closeout 前置）：gloss 稿 = P5 行 acceptance 逐条核（spec v1.1 · plan v1.1 · 分支终审记录）· 草稿落工作区/交付登记（不触 repo 源树） — checkable: 登记稿齐备 · 树净
  - commit — checkable: `chore(engine): changeset——DispatchContract 收敛（fix face no ref · CHAINS/graph-node 删 · FIX_SHELL typed）` 落位 · 树净
- **Acceptance**: `validate ALL PASS` · 零残留 grep 三面零命中 · changesets 落位（cdd-engine）· 交付记录回填登记齐备（closeout 随）
- **DependsOn**: 1, 2, 3, 4

## Change history

| Version | date | summary | author |
|---|---|---|---|
| v1.1 | 2026-10-10 | **plan-review-1 全修（2 warn · 4 nit）**：零残留 grep 作用域钉为可判定代码面（`packages/cdd-engine/src-next` + `scripts` + `packages/kairos` · 产品 + 测试 ts 面）· 决策登记 trail 豁免清单 = P5 plan 自文 · design spec v1.1 · overall v1.57（三面 checkable 统一改写）· 执行序去「四根独立」并行暗示（T1/T2 共享 host.ts/host.test.ts 同 round 串行）· T1 guard.ts 引用钉正 727（827 误）· T2 重排失败先行（host.ts 删 CHAINS 制造真红 → 测试侧清理）· T2 Files/Steps 补登 host.test.ts 残余清理（头注序链叙述 · `formOf` · `REFS`/`HostId`/`HostReferenceTable` import）· T5 Files 改 overall.md 为 closeout 落点（非本任务修改目标 · 不改动）· 文件尾补 EOF 换行 | [human] · Claude Opus 5（kairos:cdd-plan · plan-review 1 → plan-fix 1） |
| v1.0 | 2026-10-10 | 初版——P5 收敛重规划实施计划：W1 {T1 fix 面无 ref 原子簇 / T2 CHAINS 删 / T3 FIX_SHELL typed / T4 graph-node 删} → W2 {T5 终验}——design v1.1 五组全承接 · DependsOn 三波次 · T1 原子簇纪律（必填 typed 成员删除迫使同 commit）· 零残留 grep 三面 · changesets cdd-engine | [human] · Claude Opus 5（kairos:cdd-plan · writing-plans 导入） |
