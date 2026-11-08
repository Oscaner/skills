---
title: 引擎文档工具（Engine Doc-Tooling）— P30 计划：中断可表达 · 完成判据换代理 · 机械判据硬化
doc-type: plan
version: v0.1
date: 2026-11-08
slug: 2026-10-10-engine-doc-tooling-p30
base: develop
---

## Constraints

- **逐字取 spec**：本计划只实现 `docs/kairos/specs/2026-10-10-engine-doc-tooling-p30-design.md` **现行 `version`**（v0.3）所指的面；spec 版本一变，本约束的字面同笔改。
- **判收敛主线零改（硬底线 · D70）**：`NextStepRouter` 的闭合判定、`#blockerCount`、`REVIEW_CYCLE_CAP`、next-loop / architecture 孪生门、finding severity 词表与 rollup 规则，本计划**零字节改动**；任何任务不得顺手改那条转移表。
- **D81 裁定不得被实现推翻**：#431③ 免审区即全部豁免面（不做 `--diff-since`、不加 `origin`）· #437 契约 ∪ 台账同身份不拆。
- **组基线语义不动**：`CommitsSinceGroupBase.groupBaseOf` 仍取组内最早 `dispatchBase`；零 diff 放行只加 OR 分支。
- **`progress.json` 固定键集不动**：新事实只落 `RoundRecord` 与 `InFlightRecord` 两处已有记录面。
- **历史零迁移**：旧 `InFlightRecord`（无 `dispatchBase`）、旧 carrier（无 finding `id`）、旧 `brief_hash` 一律按 present-facts 读，不写迁移。
- **`--steal-stale` 硬切**：不保留别名、不留双旗标；pin 整体重锚属本相位的 deliberate break（D74 → minor）。
- 无新 CLI 动词；changeset `@oscaner-skills/cdd-engine` **minor**；不发布。
- 零模块级裸函数；波宽 ≤ 3：本计划分层 W1={1,4,6} · W2={2,5,7} · W3={3} · W4={8}。

## Review Focus

- **恢复提交被 abort 基线吞掉**：abort 记录若写入 `dispatchBase: null` 或取重派时 HEAD，`#431②` 原样复发——红测必须让「恢复提交」落在 abort 轮 base 之后、重派 base 之前。
- **`--recover` 盖戳后 review 仍被拒**：`supersededBy` 若只在 `#pendingFix` 生效而 `lineRoute` 仍读旧 review，派发门会以 `hop` 拒——两处必须同改，且 `#rowClosed` 不得被波及（改了会让已闭合线看起来还开着）。
- **reopen 变成万能后门**：条件写松（无 drift 也放行、或有在飞轮次也放行）会绕过 fix——红测要覆盖「无条件调用 → BLOCKED」。
- **验证型判据被当成零 diff 豁免**：`Files` 非空却零 diff 必须仍 `committed nothing`；「至少一个 task 空」不得算验证型。
- **flag 面残留**：`--steal-stale` 只在 declare/words/cli 三处不彻底，帮助面或拒绝语会漏字面。
- **finding id 双向差集只打一侧**：改写 summary 的失败报文若仍只 print unknown，`#443④` 的可读性没修。
- **折行续行被静默丢弃**：列数不一致的行必须报一条 shape finding；静默过滤等于把假绿换成漏报。
- **版本头交叉校验误伤存量**：新增不变量上线时仓内 25 篇 spec/plan 必须全绿（现状 front-matter 版本是否已等于最新行，是任务的红测前置事实）。

### Task 1: `--recover` 旗标面与 `--steal-stale` 硬切

#### Objective

把 `--steal-stale` 从旗标表、报文表、CLI 读取点整类改名到 `--recover`（本期硬切，不留别名），并让 `implement` / `review` / `fix` 三个派发动词都声明它。只做旗标面；abort 与 reopen 的语义留给 Task 2 / Task 3。

#### Files

- Modify: `packages/cdd-engine/src-next/face/declare.ts`（旗标行 `stealStale` 改名 `recover`、`flag: "--recover"`；三个动词的旗标引用同步）
- Modify: `packages/cdd-engine/src-next/face/words.ts`（`stealable` 等四行报文改词）
- Modify: `packages/cdd-engine/src-next/face/cli.ts`（`--steal-stale` 读取点改键名）
- Modify: `packages/cdd-engine/src-next/face/preview.ts`（`--steal-stale` 注释改词）
- Test: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（帮助面与拒绝语零 `--steal-stale`）
- Test: `packages/cdd-engine/src-next/face/__tests__/words.guard.test.ts`

#### Consumes

- `face/declare.ts` 的 `FlagRow` 表与 `CLI_COMMANDS` 行
- `face/words.ts` 的 `WORD_TABLE`（`steal` 家族行）
- `face/cli.ts` 的旗标读取点

#### Produces

- 旗标键 `recover`（`flag: "--recover"`），`ParsedArgs` 上可用
- 帮助面、拒绝语、capsule、`words` 表零 `--steal-stale` 字面

#### Steps

- 写失败测：`words` 与 help 渲染输出对 `--steal-stale` 的命中数为 0 且对 `--recover` 命中数 ≥ 1 — checkable: 定向 vitest 该用例 FAIL（今日 `--steal-stale` 命中数大于 0）
- 写失败测：`cdd implement --help` 输出含 `--recover` — checkable: FAIL（今日含 `--steal-stale`）
- 改名 declare 旗标行与三处引用；words 四行报文改词；cli 读取点改键名 — checkable: 上两测 PASS，且 `pnpm exec tsc --noEmit -p packages/cdd-engine` exit 0
- 全库 grep 断言：`--steal-stale` 在 `packages/cdd-engine/src-next` 与 `packages/kairos/skills` 零命中（除历史 changeset 与本计划/spec 文本） — checkable: `grep -rn 'steal-stale' packages/cdd-engine/src-next packages/kairos/skills` 只余历史文档命中
- 提交 — checkable: `git log -1 --oneline` 含本任务主题

#### Acceptance

- `words` 表与 help 渲染零 `--steal-stale`，含 `--recover`
- `implement` / `review` / `fix` 三个动词都接受 `--recover`（解析层 pin）
- 零别名、零双旗标

#### DependsOn

none

### Task 4: 完成判据加证据分支（零 diff 验证型）

#### Objective

让 `implement` 的完成判据在「零提交」时按计划声明放行验证型 wave：`CompletionContext` 增两个只读 provider cell（`emptyFileTasks` / `evidenceOk`），`CommitsSinceGroupBase.judge` 加 OR 分支；非空 `Files` 的零 diff 仍 BLOCKED。

#### Files

- Modify: `packages/cdd-engine/src-next/contract/completion-criterion.ts`（`CompletionContext` 两 cell；`CommitsSinceGroupBase.judge` OR 分支 + soft 观察）
- Modify: `packages/cdd-engine/src-next/contract/task-blocks.ts`（`PlanTaskBlocksReader#filePathsOf(block)`：`Files` 字段值行里的路径 token）
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（`#criterionViolations` 的 `judge({...})` 填两 cell：计划面读 `Files` + 证据门读回的 `evidenceOk`）
- Test: `packages/cdd-engine/src-next/contract/__tests__/completion-criterion.test.ts`
- Test: `packages/cdd-engine/src-next/face/__tests__/lifecycle.test.ts`

#### Consumes

- `CompletionContext` / `CommitsSinceGroupBase`
- `TaskBlock.fields`（`key === "Files"` 的值行）
- `HandoffSchema#evidenceViolations` 与 `face/lifecycle.ts#evidenceViolations` 的既有判决
- `GitClient#commitsSince`

#### Produces

- `CompletionContext.emptyFileTasks: ReadonlySet<number>` · `CompletionContext.evidenceOk: boolean`
- `PlanTaskBlocksReader#filePathsOf(block: TaskBlock): readonly string[]`
- `CommitsSinceGroupBase` 的放行条件 = 有提交 **或**（该 wave 每个 task 都 ∈ `emptyFileTasks` ∧ `evidenceOk`）
- soft 观察字面（零 diff 验证型通过时记一条）

#### Steps

- 写失败测：`Files` 空集 + `evidenceOk: true` + 零提交的 implement 上下文 → `fulfilled: true` 且 `observations` 非空 — checkable: FAIL（今日 `committed nothing` hard）
- 写失败测：同一夹具但 `evidenceOk: false` → `fulfilled: false`（仍 BLOCKED） — checkable: FAIL 或语义断言不成立
- 写失败测：`emptyFileTasks` 只含一个 id 的双 task wave（另一个 task 有 `Files`）→ `fulfilled: false` — checkable: FAIL（若实现按「至少一个空」即绿）
- 实现两 cell 与 OR 分支；`#criterionViolations` 填值（`Files` 取自计划解析，`evidenceOk` 取自既有证据判决，不二次读盘） — checkable: 上三测 PASS；既有 completion-criterion 族全绿
- 提交 — checkable: `git log -1 --oneline` 含本任务主题

#### Acceptance

- 验证型（wave 内每个 task 的 `Files` 皆空）∧ 证据绿 → 通过并带 soft 观察
- `Files` 皆空但证据缺失或违约 → 仍 BLOCKED（既有证据门）
- 任一 task `Files` 非空 → 零提交仍 `committed nothing`（成对 pin）
- `groupBaseOf` 语义零改

#### DependsOn

none

### Task 6: change-history 行集与版本读面硬化

#### Objective

把 change-history 的行集与版本读面收紧到可机械判定：行集只取表体行、列数与表头不一致的行不算 lineage 行且报一条 shape finding；版本只读首列且锚定；新增 `change-history-latest-matches-front-matter` 不变量；docs-fix 模板加两句。

#### Files

- Modify: `packages/cdd-engine/src-next/contract/invariants.ts`（版本读面改锚定；新增 `ChangeHistoryLatestMatchesFrontMatterInvariant` 与 `ChangeHistoryRowShapeInvariant`）
- Modify: `packages/cdd-engine/src-next/contract/doc.ts`（`tableSection` 保留表头与表体原样，行形状判定留给不变量层）
- Modify: `packages/cdd-engine/src-next/contract/declare.ts`（change-history 行 selector 锚定首列版本）
- Modify: `packages/cdd-engine/src-next/render/templates.ts`（docs-fix 变体两句：追加行必须 bump front-matter；表格单元格不得硬折行）
- Test: `packages/cdd-engine/src-next/contract/__tests__/invariants.test.ts`（或既有 lint/invariants 测文件）
- Test: `packages/cdd-engine/src-next/render/__tests__/templates.test.ts`

#### Consumes

- `ParsedTable`（`headerRow` / `rows`）与 `JudgeContext`
- `Invariant` 基类与 `Invariants` 注册表
- 既有 `FrontMatterVersionInLineageInvariant` / `ChangeHistoryVersionUniqueInvariant`

#### Produces

- 锚定的版本读面（只读首列、`^v\d+\.\d+$`）
- 不变量 `change-history-latest-matches-front-matter`（front-matter 版本 == lineage 最新数值版本，两端点名）
- 不变量 `change-history-row-shape`（列数 != 表头列数的表体行：一条 finding，不静默丢弃）
- docs-fix 模板两句（子串 pin）

#### Steps

- 写失败测：折行夹具（表格单元格硬换行且续行含管道符）→ 今日产出 `duplicate change-history version`，期望改为「一条 shape finding，且无 duplicate」 — checkable: 定向 vitest FAIL（今日报 duplicate）
- 写失败测：front-matter `v0.4` + lineage 最新 `v0.5` → 新不变量红；`v0.5` + `v0.5` → 绿 — checkable: FAIL（今日成员制通过）
- 写失败测：行内正文含 `spec vX.Y` 但首列不是版本 → 不产生 lineage 行 — checkable: FAIL（今日 `firstVersion` 会读该行）
- 实现锚定读面与两条不变量；docs-fix 模板加两句 — checkable: 上三测 PASS；`pnpm -C packages/cdd-engine exec vitest run src-next/contract/__tests__` 全绿
- 仓内全量自检：`node packages/cdd-engine/src-next/bin.ts review --type phase-spec --spec docs/kairos/specs/2026-10-10-engine-doc-tooling-p30-design.md --dry-run` 与 plan 同形各跑一次 — checkable: 两次 exit 0（存量文档不被新不变量误伤）
- 提交 — checkable: `git log -1 --oneline` 含本任务主题

#### Acceptance

- 折行续行（列数不一致的表体行）不产生第二个 lineage 行，且只报一条 shape finding（反向 pin：静默丢弃即红）
- 版本只从首列锚定读；行内任意位置的版本号不算
- header 落后于最新行 → 红；相等 → 绿
- docs-fix 模板含两句（子串 pin）
- 仓内存量 spec / plan 在 dry-run 下全绿

#### DependsOn

none

### Task 2: abort 入账（`--recover` 的 abort 腿）

#### Objective

让「引擎外被杀的那一轮」在账本上留下事实：`InFlightRecord` 增 `dispatchBase`（acquire 写 HEAD），`--recover` 接管陈旧 in-flight 时折一条 `RoundRecord`（`targetAction: false` + hard violation cause `interrupted`），并把 `interrupted` 加进既有 `CrashCause` 联合。

#### Files

- Modify: `packages/cdd-engine/src-next/session/inflight.ts`（`InFlightRecord.dispatchBase`；`acquire` 记录时写入）
- Modify: `packages/cdd-engine/src-next/session/ledger.ts`（`CrashCause` 增 `interrupted`；`RoundRecord` 读面无需新增字段）
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（acquire 传 HEAD；新增 `#foldAbort(record: InFlightRecord): void` 走 `ledger.recordRound`）
- Modify: `packages/cdd-engine/src-next/face/cli.ts`（`--recover` 且在飞记录陈旧 → 调 `#foldAbort` 再接管）
- Test: `packages/cdd-engine/src-next/session/__tests__/inflight.test.ts`
- Test: `packages/cdd-engine/src-next/contract/__tests__/completion-criterion.test.ts`（组基线读被杀轮 base）

#### Consumes

- `InFlight#steal` / `#stealIfDead` / `InFlightRecord`
- `Ledger#recordRound` / `RoundViolation.hard(message, cause)`
- `CommitsSinceGroupBase.groupBaseOf`

#### Produces

- `InFlightRecord.dispatchBase: string | null`
- `CrashCause` 含 `interrupted`
- `CliLifecycle#foldAbort(record)`：写一条 abort `RoundRecord`（op 由 phase 派生 · cycle/attempt/dispatchBase 取记录值 · `verdict.targetAction: false` · 一条 hard violation cause `interrupted`），**不写** `crash-*.json`、不提升草稿
- 组基线因此回到被杀轮之前：恢复提交落在 base 之后可被看见

#### Steps

- 写失败测：陈旧 in-flight（持有进程已死）夹具下 `--recover` 后 progress 出现一条 abort 记录，`targetAction: false` 且 cause 为 `interrupted` — checkable: FAIL（今日只丢锁不记账）
- 写失败测：abort 轮 base=B、恢复提交落在 B 之后、重派 attempt 2 base=C（C 含恢复提交）→ `CommitsSinceGroupBase.judge` 通过 — checkable: FAIL（今日 `committed nothing`）
- 写失败测：旧记录（无 `dispatchBase`）被 abort 时仍入账且 `dispatchBase: null`，判据退回更早的有值记录 — checkable: FAIL
- 实现 `dispatchBase` 落记录、`interrupted` 字面、`#foldAbort` 与 cli 调用点 — checkable: 上三测 PASS；`pnpm -C packages/cdd-engine exec vitest run src-next/session/__tests__/inflight.test.ts` 全绿
- 提交 — checkable: `git log -1 --oneline` 含本任务主题

#### Acceptance

- 陈旧 in-flight + `--recover` → 账本留 abort 记录（`targetAction:false` · cause `interrupted` · 携带该轮 `dispatchBase`）
- 恢复提交（abort base 之后、重派 base 之前）能通过完成判据
- 不写 crash 文件、不提升草稿、`progress.json` 键集不变
- `CrashCause` 只有一处扩展（无并行枚举）

#### DependsOn

1

### Task 5: disposition 主键引擎化（finding id 与双侧差集）

#### Objective

review 载体落盘时由引擎按序写稳定 `id`（`F1`、`F2`…）；fix 的 dispositions 改按 `id` 键；失败报文同打「carrier 有而 disposition 缺」与「disposition 有而 carrier 无」两侧差集；旧 carrier 无 `id` 时退回 summary 匹配并记 soft。

#### Files

- Modify: `packages/cdd-engine/src-next/session/handoff-schema.ts`（`FINDING` 增 `id`；`#materialize` 路径上引擎写值）
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（`#findingsList` 按序盖 `id`，覆盖子代理写的值）
- Modify: `packages/cdd-engine/src-next/contract/completion-criterion.ts`（`FixDispositions` 键集改 id；`#keyRefusal` 两侧差集；无 id carrier 回退 summary + soft）
- Test: `packages/cdd-engine/src-next/contract/__tests__/completion-criterion.test.ts`
- Test: `packages/cdd-engine/src-next/session/__tests__/handoff-schema.test.ts`

#### Consumes

- `FINDING` 声明与 `HandoffSchema#schemaText` / `#violations`
- `FixDispositions#requesterInputOf` / `#keyRefusal` / `#valueRefusal`
- `DraftOutcome#carrier`

#### Produces

- carrier 的每条 finding 带 `id`（`F` + 序号，序 = carrier 序）
- dispositions 以 `id` 为键；未知/缺失键两侧差集同报文
- 旧 carrier（无 `id`）：summary 匹配 + 一条 soft 观察（colocated pin）

#### Steps

- 写失败测：review 载体落盘后每条 finding 带等序 `id` — checkable: FAIL（今日无 `id`）
- 写失败测：fix 载体把某条 finding 的 summary 改写一个词、按原 `id` 写 disposition → 判据通过 — checkable: FAIL（今日报 `never raised`）
- 写失败测：disposition 多一条未知 `id` 且少一条应有 `id` → 报文字面同时含两个差集 — checkable: FAIL（今日只打 unknown 即返回）
- 写失败测：无 `id` 的旧 carrier → 按 summary 匹配通过且 `observations` 含 soft — checkable: FAIL
- 实现 `id` 写入点、键集切换、双侧差集与回退 — checkable: 上四测 PASS；`pnpm -C packages/cdd-engine exec vitest run src-next/contract/__tests__/completion-criterion.test.ts` 全绿
- 提交 — checkable: `git log -1 --oneline` 含本任务主题

#### Acceptance

- carrier 每条 finding 带稳定 `id`，子代理写值被覆盖
- 改写 summary 不再产生 unknown；两侧差集同现于一次失败报文
- 旧 carrier 走 summary 回退并记 soft（软观察缺失即红）
- 历史 carrier 零迁移

#### DependsOn

4

### Task 7: 已关闭波纪律（文字面）

#### Objective

把「已关闭波的内容是历史」落成写作纪律：引擎评审 prompt 轴（plan / spec 变体）与 `cdd-plan` 的 fix 节点各加一句，附子串 pin；引擎侧零新增 finding 路由分支。

#### Files

- Modify: `packages/cdd-engine/src-next/render/templates.ts`（plan / spec 评审轴的 closed-wave 句）
- Modify: `packages/kairos/skills/cdd-plan/SKILL.md`（fix 节点句）
- Test: `packages/cdd-engine/src-next/render/__tests__/templates.test.ts`
- Test: `packages/kairos/tests/skill-anatomy.test.ts`（或既有 word-face pin 测文件）

#### Consumes

- `render/templates.ts` 的 `docNarrativeAxes` 与 plan 变体轴
- `packages/kairos/tests` 的既有子串 pin 手法

#### Produces

- 两处文本各一句（改文档对齐已交付切分 · 禁止搬动已关闭任务的工作）
- 子串 pin 各一条

#### Steps

- 写失败测：`templates` 的 plan 与 spec 变体渲染文本含该句 — checkable: FAIL（今日无该句）
- 写失败测：`cdd-plan` 的 fix 节点文本含该句 — checkable: FAIL
- 落两句文本 — checkable: 上两测 PASS
- 结构性 pin：`dispatch-authority` 与 `next` 侧零新增 finding 路由分支（对相关符号的命中数断言） — checkable: 断言 PASS
- 提交 — checkable: `git log -1 --oneline` 含本任务主题

#### Acceptance

- `render/templates.ts` 评审轴与 `cdd-plan` fix 节点含对应句（子串 pin）
- 引擎侧零新增 finding 路由分支（结构性 pin）

#### DependsOn

6

### Task 3: 外部改设计的 reopen（`--recover` 的 reopen 腿）

#### Objective

让「review 的结论被外部改写取代」成为可记账事实：`RoundRecord` 增 `supersededBy`；`#pendingFix` 与 `lineRoute` 选取最新 completed review 时跳过带该戳的记录（`#rowClosed` 与波行闭合判定**不改**）；`--recover` 在 `review` + doc/branch 行 + 三条件成立时先分 `N+1`、再盖戳、再放行；拒绝语的 `next:` 带 `--recover`。

#### Files

- Modify: `packages/cdd-engine/src-next/session/ledger.ts`（`RoundRecord.supersededBy`；`#pendingFix` / `lineRoute` 的 review 选取跳过；`supersedeReview(cycle, byCycle)`）
- Modify: `packages/cdd-engine/src-next/session/dispatch-authority.ts`（`pending-fix` 且 drift 的拒绝语 `next` 变体携带 `--recover`）
- Modify: `packages/cdd-engine/src-next/face/cli.ts`（reopen 腿的触发条件与调用序）
- Test: `packages/cdd-engine/src-next/session/__tests__/ledger.test.ts`
- Test: `packages/cdd-engine/src-next/session/__tests__/dispatch-authority.test.ts`

#### Consumes

- `Ledger#reviewGate` / `#pendingFix` / `lineRoute` / `#latestCompletedCycleOfRow` / `#rowClosed`
- `ReviewedIdentity`（fix ⟷ review 同 cycle 的身份）
- Task 2 的 abort 折账入口

#### Produces

- `RoundRecord.supersededBy?: { cycle: number; cause: "recover" }`
- `Ledger#supersedeReview(cycle, byCycle)`（只盖戳，不写假 fix）
- `#pendingFix` / `lineRoute` 跳过 superseded review；`#rowClosed` 零改
- 拒绝语 `next`：`drift ∧ pending-fix` 时给出带 `--recover` 的同形 review 命令

#### Steps

- 写失败测：drift ∧ pending-fix ∧ 无在飞 → `--recover` 后 `review` 可派发，新 review cycle 为旧 +1，旧 review 带 `supersededBy` — checkable: FAIL（今日 `pending-fix` 拒绝）
- 写失败测：同夹具缺任一条条件（无 drift / 无 pending-fix / 有在飞）→ BLOCKED 且报文点名缺项 — checkable: FAIL（今日无该报文）
- 写失败测：supersede 后 `#rowClosed` 对一条已闭合线的判定不变（成对 pin：闭合不被 supersede 打开） — checkable: FAIL 若实现顺手改了 `#rowClosed`
- 实现 `supersededBy`、两处跳过、调用序与拒绝语 `next` — checkable: 上三测 PASS；`pnpm -C packages/cdd-engine exec vitest run src-next/session/__tests__/ledger.test.ts` 全绿
- 提交 — checkable: `git log -1 --oneline` 含本任务主题

#### Acceptance

- drift ∧ pending-fix（无在飞）经 `--recover` 后 `review` 可派发，新 cycle = 旧 +1，旧轮带 `supersededBy`
- 条件不满足一律 BLOCKED 且点名缺项
- `#rowClosed` / 波行闭合判定零行为变化（成对 pin）
- fix 身份仍与请求方 review 同 cycle

#### DependsOn

2

### Task 8: changeset 与全量门

#### Objective

补齐变更集并跑全量门；确认判收敛主线零字节改动与仓内文档全绿。

#### Files

- Create: `.changeset/p30-recover-completion-and-criteria.md`
- Test: 无新增测试（本任务只做门与变更集）

#### Consumes

- Task 1–7 的交付面
- `.changeset/README.md` 的版本级判据（D74）

#### Produces

- changeset：`@oscaner-skills/cdd-engine` **minor**
- 全量门绿：`pnpm run validate`

#### Steps

- 写 changeset（minor；正文一句话说明四个面） — checkable: 文件存在且 front-matter 含 `"@oscaner-skills/cdd-engine": minor`
- 跑 `pnpm run validate` — checkable: exit 0（root · kairos · engine · typecheck ×3 · version-sync · emit fresh · 零裸函数）
- 断言判收敛主线零改：`git diff develop -- packages/cdd-engine/src-next/session/next.ts` 对闭合判定与 blocker 计数零命中 — checkable: 命中数 0（或只有注释级改动并有说明）
- 提交 — checkable: `git log -1 --oneline` 含本任务主题

#### Acceptance

- changeset 存在且为 minor
- `pnpm run validate` exit 0
- 判收敛主线零字节改动
- 仓内 spec / plan 在 doc-contract 下全绿

#### DependsOn

3,5,7

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-08 | 初版：八任务四波 W1={1,4,6}·W2={2,5,7}·W3={3}·W4={8}——recover 旗标硬切 · 完成判据证据分支 · change-history 硬化 · abort 入账 · finding id 双侧差集 · 已关闭波纪律 · reopen 严格条件 · changeset 与全量门 | [human] 裁定 · Claude（kairos:cdd-plan · 2026-11-08） |
