---
title: 引擎文档工具（Engine Doc-Tooling）— P30 计划：中断可表达 · 完成判据换代理 · 机械判据硬化
doc-type: plan
version: v0.6
date: 2026-11-08
slug: 2026-10-10-engine-doc-tooling-p30
base: develop
---

## Constraints

- **逐字取 spec**：本计划只实现 `docs/kairos/specs/2026-10-10-engine-doc-tooling-p30-design.md` **现行 `version`**（v0.5）所指的面；spec 版本一变，本约束的字面同笔改。
- **判收敛主线零改（硬底线 · D70）**：`NextStepRouter` 的闭合判定、`#blockerCount`、`REVIEW_CYCLE_CAP`、next-loop / architecture 孪生门、finding severity 词表与 rollup 规则，本计划**零字节改动**；任何任务不得顺手改那条转移表。
- **D81 裁定不得被实现推翻**：#431③ 免审区即全部豁免面（不做 `--diff-since`、不加 `origin`）· #437 契约 ∪ 台账同身份不拆。
- **组基线语义不动**：`CommitsSinceGroupBase.groupBaseOf` 仍取组内最早 `dispatchBase`；零 diff 放行只加 OR 分支。
- **`progress.json` 固定键集不动**：新事实只落 `RoundRecord` 与 `InFlightRecord` 两处已有记录面。
- **历史零迁移**：旧 `InFlightRecord`（无 `dispatchBase`）、旧 carrier（无 finding `id`）、旧 `brief_hash` 一律按 present-facts 读，不写迁移。
- **`--steal-stale` 硬切**：不保留别名、不留双旗标；pin 整体重锚属本相位的 deliberate break（D74 → minor）。
- 无新 CLI 动词；changeset `@oscaner-skills/cdd-engine` **minor**；不发布。
- 零模块级裸函数；波宽 ≤ 3：本计划分层 W1={1,3} · W2={2,6} · W3={4} · W4={5,7} · W5={8}。

## Review Focus

- **恢复提交被 abort 基线吞掉**：abort 记录若写入 `dispatchBase: null` 或取重派时 HEAD，`#431②` 原样复发——红测必须让「恢复提交」落在 abort 轮 base 之后、重派 base 之前。
- **`--recover` 盖戳后 review 仍被拒**：`supersededBy` 若只在 `#pendingFix` 生效而 `lineRoute` 仍读旧 review，派发门会以 `hop` 拒——两处必须同改，且 `#rowClosed` 不得被波及（改了会让已闭合线看起来还开着）。
- **reopen 变成万能后门**：条件写松（无 drift 也放行、或有在飞轮次也放行）会绕过 fix——红测要覆盖「无条件调用 → BLOCKED」。
- **验证型判据被当成零 diff 豁免**：`Files` 非空却零 diff 必须仍 `committed nothing`；「至少一个 task 空」不得算验证型。
- **flag 面残留**：`--steal-stale` 只在 declare/words/cli 三处不彻底——`lifecycle.ts` 的传递链、`inflight.ts` 的 holding message、`preflight.ts` 的 `DispatchFacts`，以及 preview / board-view / preflight / inflight 四个测试文件都会漏字面（`stealable` 是键名不是字面，键名不改）。
- **finding id 双向差集只打一侧**：改写 summary 的失败报文若仍只 print unknown，`#443④` 的可读性没修。
- **折行续行被静默丢弃**：列数不一致的行必须报一条 shape finding；静默过滤等于把假绿换成漏报。
- **版本头交叉校验误伤存量**：新增不变量上线时仓内 spec / plan / overall 不得被误伤；这条全量判定由 Task 3 的 corpus guard 测钉住，口径是**每文档具名 ceiling**下的「无新增漂移」而非「全绿」——存量文档在某条 lineage 腿上的 finding 数涨过它的 ceiling 即该测红并点名文件，修好降到 ceiling 以下则绿；而存量在既有判定面上的旧红（`p19-design` 的 `presence`）不在本测断言面内。

### Task 1: `--recover` 旗标面与 `--steal-stale` 硬切

#### Objective

把 `--steal-stale` 从旗标表、报文表、CLI 读取点整面改名到 `--recover`（含 `lifecycle` / `preflight` / `inflight` 传递链与四个测试文件的字面锚点；本期硬切，不留别名），并让 `implement` / `review` / `fix` 三个派发动词都声明它。只做旗标面；abort 与 reopen 的语义留给 Task 4 / Task 7。

#### Files

- Modify: `packages/cdd-engine/src-next/face/declare.ts`（旗标行 `stealStale` 改名 `recover`、`flag: "--recover"`；三个动词的旗标引用同步）
- Modify: `packages/cdd-engine/src-next/face/words.ts`（`stale` / `stealable` / `corruptLocked` / `corruptUnlocked` 四行报文的 `--steal-stale` 字面与注释改词；`InFlightWords` 键名不变——`stealable` 是标识符，不属字面门）
- Modify: `packages/cdd-engine/src-next/face/cli.ts`（两处 `parsed.args.stealStale` 读取点与 `--steal-stale` 注释改键名改词）
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（`#stealStale` 字段 / `opts.stealStale` / `acquire({ stealStale })` 传参与 `--steal-stale` 注释——旗标面的唯一传递链，不改行为）
- Modify: `packages/cdd-engine/src-next/face/preview.ts`（`--steal-stale` 注释改词；`words.inFlightWords().stealable` 键引用不变）
- Modify: `packages/cdd-engine/src-next/session/inflight.ts`（`acquire` 的 `stealStale` 选项、`#stealIfDead` 注释、`holdingMessage` 里的 `--steal-stale` 字面——用户可见的接管语）
- Modify: `packages/cdd-engine/src-next/session/preflight.ts`（`DispatchFacts.stealStale` 与 `#inFlightRefusal` 形参、`--steal-stale` 注释改键名改词）
- Test: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（帮助面与拒绝语零 `--steal-stale`；`words.inFlightWords()` 三行字面重锚）
- Test: `packages/cdd-engine/src-next/face/__tests__/words.guard.test.ts`
- Test: `packages/cdd-engine/src-next/face/__tests__/preview.test.ts`（`--steal-stale --dry-run` 用例与 `not.toContain("--steal-stale")` 断言重锚到 `--recover`）
- Test: `packages/cdd-engine/src-next/face/__tests__/board-view.test.ts`（`toContain("--steal-stale")` 字面锚点重锚；`.stealable` 键引用不变）
- Test: `packages/cdd-engine/src-next/session/__tests__/preflight.test.ts`（拒绝语字面 `stale holder — pid 4242 (re-run with …)` 与 `toContain` / `not.toContain` 用例重锚；`stealStale` 选项名随改）
- Test: `packages/cdd-engine/src-next/session/__tests__/inflight.test.ts`（`stealStale` 选项名与注释重锚；Task 4 在同一文件追加密钥面 pin——Task 4 DependsOn 1，串行，无并行写同一文件）

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
- 全库 grep 断言：`--steal-stale` 在 `packages/cdd-engine/src-next` 与 `packages/kairos/skills` 的**生产面**零命中；豁免面只有两条——历史 changeset 与本计划/spec 文本，以及 `src-next/**/__tests__/` 下的退役字面 pin（`face/__tests__/words.guard.test.ts` 必须以该字面断言它不存在，线上已按 `__tests__/` 过滤） — checkable: `grep -rn 'steal-stale' packages/cdd-engine/src-next packages/kairos/skills` 的命中全部落在 `__tests__/` 内的 pin 行（今日 5 行同为 `words.guard.test.ts`），生产面命中数 0
- 提交 — checkable: `git log -1 --oneline` 含本任务主题

#### Acceptance

- `words` 表与 help 渲染零 `--steal-stale`，含 `--recover`
- `implement` / `review` / `fix` 三个动词都接受 `--recover`（解析层 pin）
- 零别名、零双旗标

#### DependsOn

none

### Task 2: 完成判据加证据分支（零 diff 验证型）

#### Objective

让 `implement` 的完成判据在「零提交」时按计划声明放行验证型 wave：`CompletionContext` 增两个只读 provider cell（`emptyFileTasks` / `evidenceOk`），`CommitsSinceGroupBase.judge` 加 OR 分支；非空 `Files` 的零 diff 仍 BLOCKED。

#### Files

- Modify: `packages/cdd-engine/src-next/contract/completion-criterion.ts`（`CompletionContext` 两 cell；`CommitsSinceGroupBase.judge` OR 分支 + soft 观察；`CompletionContext.row` 的读者声明**保持**——W2 已把它写进该 cell 的 docstring（具名 `CommitsSinceGroupBase.judge` 读 `row.wave`），今日源码零 `RESERVED` 字面，本任务只确认这条声明与两 cell 的实现一致，不重写注记）
- Modify: `packages/cdd-engine/src-next/contract/task-blocks.ts`（`PlanTaskBlocksReader#filePathsOf(block)`：`Files` 字段值行里的路径 token）
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（`#criterionViolations` 的 `judge({...})` 填两 cell：计划面读 `Files` + 证据门读回的 `evidenceOk`）
- Test: `packages/cdd-engine/src-next/contract/__tests__/completion-criterion.test.ts`
- Test: `packages/cdd-engine/src-next/contract/__tests__/task-blocks.test.ts`（`filePathsOf` 的 colocated home——空值 / 仅空白 / 缺字段 / 字面 `(none)` 四形态同判的 pin 落在 reader 自己的测试面）
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
- wave 的 task id 集由 `ctx.row.wave`（`ProgressRow.wave`，`session/ledger.ts:197-199`——逗号分隔的 wave 键，`"1,2"` 即 `{1,2}`）现读：`emptyFileTasks` 只是空 `Files` 子集、不含成员面，缺这一读就退化成「子集非空」；`CompletionContext.row` 的读者声明落定（`CommitsSinceGroupBase.judge` 是本 cell 的读者）——W2 已在 docstring 落地，本任务只保持不改
- soft 观察字面（零 diff 验证型通过时记一条）

#### Steps

- 写失败测：`Files` 空集 + `evidenceOk: true` + 零提交的 implement 上下文 → `fulfilled: true` 且 `observations` 非空 — checkable: FAIL（今日 `committed nothing` hard）
- 写失败测：同一夹具但 `evidenceOk: false` → `fulfilled: false`（仍 BLOCKED） — checkable: FAIL 或语义断言不成立
- 写失败测：`row.wave = "1,2"` ∧ `emptyFileTasks = {1}` ∧ task 2 的 `Files` 非空 → `fulfilled: false`；成对夹具同 wave 但 `emptyFileTasks = {1,2}` → 放行（两个夹具只差成员集，区分「全集空」与「子集非空」两种读法） — checkable: FAIL（若实现按「至少一个空」即绿）
- 写失败测：`Files` 值为字面 `(none)` → 该 task id ∈ `emptyFileTasks`（`filePathsOf` 视为零路径 token，`(none)` 不得被读成一个路径；与空值 / 仅空白 / 缺字段同一判定） — checkable: FAIL（今日无该判定面）
- 实现两 cell 与 OR 分支；`#criterionViolations` 填值（`Files` 取自计划解析，`evidenceOk` 取自既有证据判决，不二次读盘） — checkable: 上四测 PASS；既有 completion-criterion 族全绿
- 提交 — checkable: `git log -1 --oneline` 含本任务主题

#### Acceptance

- 验证型（wave 内每个 task 的 `Files` 皆空）∧ 证据绿 → 通过并带 soft 观察
- `Files` 空判定：空值 / 仅空白 / 缺字段 / 字面 `(none)` 皆空，四者同判（`(none)` pin）
- `Files` 皆空但证据缺失或违约 → 仍 BLOCKED（既有证据门）
- 任一 task `Files` 非空 → 零提交仍 `committed nothing`（成对 pin）
- `groupBaseOf` 语义零改

#### DependsOn

1

### Task 3: change-history 行集与版本读面硬化

#### Objective

把 change-history 的行集与版本读面收紧到可机械判定：行集只取表体行、列数与表头不一致的行不算 lineage 行且报一条 shape finding；版本只读首列且锚定；新增 `change-history-latest-matches-front-matter` 不变量；docs-fix 模板加两句。

#### Files

- Modify: `packages/cdd-engine/src-next/contract/invariants.ts`（版本读面改锚定；新增 `ChangeHistoryLatestMatchesFrontMatterInvariant` 与 `ChangeHistoryRowShapeInvariant`）
- Modify: `packages/cdd-engine/src-next/contract/doc.ts`（`tableSection` 保留表头与表体原样，行形状判定留给不变量层）
- Modify: `packages/cdd-engine/src-next/contract/declare.ts`（change-history 行 selector 锚定首列版本）
- Modify: `packages/cdd-engine/src-next/render/templates.ts`（docs-fix 变体两句：追加行必须 bump front-matter；表格单元格不得硬折行）
- Test: `packages/cdd-engine/src-next/contract/__tests__/invariants.test.ts`（或既有 lint/invariants 测文件）
- Test: `packages/cdd-engine/src-next/render/__tests__/templates.test.ts`
- Test: `packages/cdd-engine/src-next/contract/__tests__/doc-corpus.guard.test.ts`（corpus guard：遍历 `docs/kairos/{specs,plans,overalls}`，按 front-matter `doc-type` 取 doc key，以**每文档具名 ceiling** 断言「存量不得更加红」——`change-history-row-shape` 的冻结基线（15 篇历史文档，overall 单篇 110 行，p24 对为 spec 26 / plan 24）由测内常量具名并写明「历史零迁移」理由；`change-history-latest-matches-front-matter` 对 p24 对**各 1**（`docs/kairos/specs/2026-10-10-engine-doc-tooling-p24-design.md` 与 `docs/kairos/plans/2026-10-10-engine-doc-tooling-p24.md`），其余文档 0——这两篇的最新表行正是自身形状折行的行，历史零迁移下不修表，故非零 ceiling 具名而非掩盖；`change-history-version-unique` 全部为 0；P30 自身文档一律零 finding；断言面不扩到既有 `presence` 等判定面）

#### Consumes

- `ParsedTable`（`headerRow` / `rows`）与 `JudgeContext`
- `Invariant` 基类与 `Invariants` 注册表
- 既有 `FrontMatterVersionInLineageInvariant` / `ChangeHistoryVersionUniqueInvariant`

#### Produces

- 锚定的版本读面（只读首列、`^v\d+\.\d+$`）
- 不变量 `change-history-latest-matches-front-matter`（front-matter 版本 == lineage 最新数值版本，两端点名）
- 不变量 `change-history-row-shape`（列数 != 表头列数的表体行：一条 finding，不静默丢弃）
- `front-matter-version-in-lineage` 的**成员读面**改取**全部表体行**的首列锚定版本（任一表体行的首列等于 header 版本即成员成立），而生重（`change-history-version-unique`）与 `change-history-latest-matches-front-matter` 仍只读列宽与表头一致的行集——形状折行的最新行因此不注册为 lineage 行却在成员判定面照旧算数
- docs-fix 模板两句（子串 pin）
- corpus guard 测（**ceiling 口径**，非全零口径）：仓内存量 spec / plan / overall 对三条 lineage 腿按**每文档具名 ceiling** 断言「不得新增」——`change-history-row-shape` 的存量漂移（15 篇冻结文档 / overall 单篇 110 行 / p24 对 spec 26 与 plan 24）属既有语料事实，历史零迁移下不在本相位修复，故以基线钉住「修好即绿、变坏即红并点名」；`change-history-latest-matches-front-matter` 在 p24 对**各具名 ceiling 1**（这两篇的最新表行本身就是形状折行的行，其数值最大版本落在一个非 lineage 行上，历史零迁移下不修表），其余文档 ceiling 为 0；`change-history-version-unique` 全部 ceiling 为 0；P30 自身文档零 finding。该测可红，不是抽样；存量一处与新不变量无关的既有红（`p19-design` 的 `presence` 面）本测既不吞也不修

#### Steps

- 写失败测：折行夹具（表格单元格硬换行且续行含管道符）→ 今日产出 `duplicate change-history version`，期望改为「一条 shape finding，且无 duplicate」 — checkable: 定向 vitest FAIL（今日报 duplicate）
- 写失败测：front-matter `v0.4` + lineage 数值最大 `v0.5` → 新不变量红；`v0.5` + `v0.5` → 绿 — checkable: FAIL（今日成员制通过）
- 写失败测：行内正文含 `spec vX.Y` 但首列不是版本 → 不产生 lineage 行 — checkable: FAIL（今日 `firstVersion` 会读该行）
- 写失败测：表头 4 列、最新表行为形状折行（3 列）且首列携带 header 版本 → 成员判定仍绿（不落 `version outside the document's own lineage`），同时该行不被生重与 latest-matches 读成 lineage 行 — checkable: FAIL（今日成员读面只读表头列宽一致的行集，该行落下即误红）
- 实现锚定读面与两条不变量（成员读面取全部表体行、生重与 latest-matches 取表头列宽行集）；docs-fix 模板加两句 — checkable: 上四测 PASS；`pnpm -C packages/cdd-engine exec vitest run src-next/contract/__tests__` 全绿
- 仓内全量自检：`node packages/cdd-engine/src-next/bin.ts review --type phase-spec --spec docs/kairos/specs/2026-10-10-engine-doc-tooling-p30-design.md --dry-run` 与 plan 同形各跑一次 — checkable: 两次 exit 0（两个抽样目标不被新不变量误伤）
- 写 corpus guard 测：逐篇遍历 `docs/kairos/{specs,plans,overalls}`，`doc-type` → doc key，按每文档 ceiling 断言三条 lineage 腿「不得新增」，ceiling 常量在测内具名并附「历史零迁移」理由 — checkable: FAIL（今日新不变量不存在；上线后任一存量文档比基线更红即该测红并点名文件）
- 提交 — checkable: `git log -1 --oneline` 含本任务主题

#### Acceptance

- 折行续行（列数不一致的表体行）不产生第二个 lineage 行，且只报一条 shape finding（反向 pin：静默丢弃即红）
- 版本只从首列锚定读；行内任意位置的版本号不算
- header 落后于 lineage 中数值最大的版本（与表序无关）→ 红；相等 → 绿
- 成员判定面（`front-matter-version-in-lineage`）读全部表体行的首列锚定版本：形状折行的最新行携带 header 版本时仍绿，且该行不注册为 lineage 行（生重与 latest-matches 的行集不变）
- docs-fix 模板含两句（子串 pin）
- 仓内存量 spec / plan / overall 在 corpus guard 测下对三条 lineage 腿**无新增漂移**：`change-history-row-shape` 不超过具名基线（15 篇冻结文档 / overall 单篇 110 行 / p24 对 spec 26 与 plan 24），`change-history-latest-matches-front-matter` 在 p24 对各不超过 1、其余为 0，`change-history-version-unique` 为 0，P30 自身文档零 finding（该测可红：任一存量文档涨过 ceiling 即点名文件）；两个采样 dry-run 同绿，存量既有红不归本任务

#### DependsOn

none

### Task 4: abort 入账（`--recover` 的 abort 腿）

#### Objective

让「引擎外被杀的那一轮」在账本上留下事实：`InFlightRecord` 增 `dispatchBase`（acquire 写 HEAD），`--recover` 接管陈旧 in-flight 时折一条 `RoundRecord`（`targetAction: false` + hard violation cause `interrupted`），并把 `interrupted` 加进既有 `CrashCause` 联合。陈旧面按 spec §2.1① 有三个形态，折账不得只认死持有者：`inspect()` 的 `held ∧ ¬alive`（持有进程已死）· `corrupt`（记录不可读且锁残留）· `absent` 但锁残留（锁无记录）——三者都在接管面，steal reason 取 `#stealIfDead` 已有的三条；折账面按 §2.2 的机制只覆盖带得回记录的形态（另两形态 `steal()` 返回 `null`，没有 `op` / `cycle` / `dispatchBase` 可读，虚构身份比不记账更坏）。

#### Files

- Modify: `packages/cdd-engine/src-next/session/inflight.ts`（`InFlightRecord.dispatchBase`；`acquire` 记录时写入；`foldAbort` 分支的事实来源即 `inspect()` 的三形态与 `steal()` 的返回值——`held` 回记录，`corrupt` 与锁残留回 `null`）
- Modify: `packages/cdd-engine/src-next/session/ledger.ts`（`CrashCause` 增 `interrupted`；`RoundRecord` 读面无需新增字段）
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（acquire 传 HEAD；新增**公开**成员 `foldAbort(): Promise<boolean>`——`InFlight#inspect` 判陈旧后按三形态分支接管（`held ∧ ¬alive` → `steal("the holder is dead")` 取回记录 → `ledger.recordRound` 折账；`corrupt` 与锁残留 → 对应 steal reason 只接管），返回本次是否落了一条 abort 记录。必须是公开入口：`CliLifecycle` 今日只对外露 `detectHost` / `step()`，而接管发生在 `step()` 内部的 `#runDispatch` → `#inflight.acquire(..., { recover })`，`#` 私有成员在 composition root 无法先折账再盖戳）
- Modify: `packages/cdd-engine/src-next/face/cli.ts`（`#dispatchOf` 拆出 `#lifecycleOf(scene, parsed)`，由 composition root 持有 harness 实例；`--recover` 判定里先 `await lifecycle.foldAbort()`，再进 `step()`——`step()` 不承担 abort 折账）
- Test: `packages/cdd-engine/src-next/session/__tests__/inflight.test.ts`
- Test: `packages/cdd-engine/src-next/face/__tests__/lifecycle.test.ts`（`foldAbort` 三形态的 colocated pin：`held ∧ ¬alive` 折一条 abort 记录；`corrupt` 与锁残留两形态只接管、零新增 `RoundRecord`；Task 4 DependsOn 2，与该任务串行，不并行写同一文件）
- Test: `packages/cdd-engine/src-next/contract/__tests__/completion-criterion.test.ts`（组基线读被杀轮 base）

#### Consumes

- `InFlight#steal` / `#stealIfDead` / `InFlightRecord`
- `Ledger#recordRound` / `RoundViolation.hard(message, cause)`
- `CommitsSinceGroupBase.groupBaseOf`

#### Produces

- `InFlightRecord.dispatchBase: string | null`
- `CrashCause` 含 `interrupted`
- `CliLifecycle.foldAbort(): Promise<boolean>`（公开入口，composition root 调用）：先 `InFlight#inspect()`，按三形态分支——`held ∧ ¬alive` → `steal("the holder is dead")`，用取回的记录写一条 abort `RoundRecord`（op 由 phase 派生 · cycle/attempt/dispatchBase 取记录值 · `verdict.targetAction: false` · `verdict.treeClean: true` · 一条 hard violation cause `interrupted`）；`corrupt` → `steal("the record is corrupt and the lock is left behind")` 只接管，不写记录；`absent` + 锁残留 → `steal("a lock without a record")` 只接管，不写记录（无记录即无身份，见 `treeClean` 段同一「只记可得事实」纪律）。返回值 = 本次是否落了一条 abort 记录。**不写** `crash-*.json`、不提升草稿。`treeClean` 必须显式钉 true：`RoundRecordInit.verdict` 缺省即 `{ treeClean: true, targetAction: true }`（`session/ledger.ts:794`），但 `#softOf`（同文件 `:1173`）把 `treeClean === false` 记成一条脏树 soft——折账没有 dispatch-after 观察，不是脏树信号，留缺省推断会让两种实现落下不同的账面事实
- 组基线因此回到被杀轮之前：恢复提交落在 base 之后可被看见

#### Steps

- 写失败测（三形态各一夹具）：`held ∧ ¬alive` / `corrupt` + 残留锁 / 无记录但锁残留 → `--recover` 后三形态都被接管；`held` 形态 progress 出现一条 abort 记录（`targetAction: false`、cause `interrupted`），另两形态零新增 `RoundRecord`（反向 pin：虚构 `op` / `cycle` 即红） — checkable: FAIL（今日只丢锁不记账，三形态无一在账本上有事实）
- 写失败测：abort 轮 base=B、恢复提交落在 B 之后、重派 attempt 2 base=C（C 含恢复提交）→ `CommitsSinceGroupBase.judge` 通过 — checkable: FAIL（今日 `committed nothing`）
- 写失败测：旧记录（无 `dispatchBase`）被 abort 时仍入账且 `dispatchBase: null`，判据退回更早的有值记录 — checkable: FAIL
- 写失败测（账面）：abort 折账后该记录 `verdict` 恰为 `{ treeClean: true, targetAction: false }`，且该行 soft 计数零增量（成对 pin：`treeClean: false` 会凭空多一条脏树观察，被 retired `contractViolationCount` 读走） — checkable: FAIL（今日无折账面）
- 实现 `dispatchBase` 落记录、`interrupted` 字面、公开 `foldAbort()` 与 cli 调用点 — checkable: 上四测 PASS；`pnpm -C packages/cdd-engine exec vitest run src-next/session/__tests__/inflight.test.ts` 全绿
- 提交 — checkable: `git log -1 --oneline` 含本任务主题

#### Acceptance

- 陈旧 in-flight + `--recover` → 三形态都接管（`held ∧ ¬alive` · `corrupt` + 残留锁 · 锁残留无记录）；`held` 形态账本留 abort 记录（`targetAction:false` · `treeClean:true` · cause `interrupted` · 携带该轮 `dispatchBase`），只此一条 hard，零脏树 soft；另两形态只接管、零新增记录（禁止虚构 `op` / `cycle`）
- 恢复提交（abort base 之后、重派 base 之前）能通过完成判据
- 不写 crash 文件、不提升草稿、`progress.json` 键集不变
- `CrashCause` 只有一处扩展（无并行枚举）

#### DependsOn

1, 2

### Task 5: disposition 主键引擎化（finding id 与双侧差集）

#### Objective

review 载体落盘时由引擎按序写稳定 `id`（`F1`、`F2`…；`FINDING` 声明里 `id` 为**可选**，child 不必填，引擎 materialize 时写入并覆盖）；fix 的 dispositions 改按 `id` 键；失败报文同打「carrier 有而 disposition 缺」与「disposition 有而 carrier 无」两侧差集；旧 carrier 无 `id` 时退回 summary 匹配并记 soft。

#### Files

- Modify: `packages/cdd-engine/src-next/session/handoff-schema.ts`（`FINDING` 子节点增**可选** `id` 属性——只改声明形状，写值点不在此文件：该类的面是 `schemaText` / `violations` / `evidenceViolations`）
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（`#findingsList`（`face/lifecycle.ts:1333`）按序盖 `id`，覆盖子代理写的值——引擎写值的唯一落点）
- Modify: `packages/cdd-engine/src-next/contract/completion-criterion.ts`（`FixDispositions` 键集改 id；`#keyRefusal` 两侧差集；无 id carrier 回退 summary + soft）
- Test: `packages/cdd-engine/src-next/contract/__tests__/completion-criterion.test.ts`
- Test: `packages/cdd-engine/src-next/session/__tests__/handoff-schema.test.ts`

#### Consumes

- `FINDING` 声明与 `HandoffSchema#schemaText` / `#violations`
- `FixDispositions#requesterInputOf` / `#keyRefusal` / `#valueRefusal`
- `DraftOutcome#carrier`

#### Produces

- carrier 的每条 finding 带 `id`（`F` + 序号，序 = carrier 序），声明侧 `id` 为可选（child 零义务）
- dispositions 以 `id` 为键；未知/缺失键两侧差集同报文，且**每条目带 `id` + summary 首句**：missing 侧摘要取自请求方 carrier 的 finding 行（按 carrier 序），unknown 侧 carrier 无该 id，只打 `id` 并标 `unknown`，不编造摘要
- 旧 carrier（无 `id`）：summary 匹配 + 一条 soft 观察（colocated pin）

#### Steps

- 写失败测：review 载体落盘后每条 finding 带等序 `id`，且子代理不写 `id` 的草稿仍通过 read-back — checkable: FAIL（今日无 `id`；若把 `id` 写成必填，无 `id` 草稿会被误 BLOCK）
- 写失败测：fix 载体把某条 finding 的 summary 改写一个词、按原 `id` 写 disposition → 判据通过 — checkable: FAIL（今日报 `never raised`）
- 写失败测：disposition 多一条未知 `id`（`F9`）且少一条应有 `id`（`F2`）→ 一次报文同时含两个差集，且 `F2` 那侧带该 finding 的 summary 首句（今日 `#keyRefusal`（`contract/completion-criterion.ts:434`）只打裸键） — checkable: FAIL（今日只打 unknown 即返回，且裸键无摘要）
- 写失败测：无 `id` 的旧 carrier → 按 summary 匹配通过且 `observations` 含 soft — checkable: FAIL
- 实现 `id` 写入点、键集切换、双侧差集与回退 — checkable: 上四测 PASS；`pnpm -C packages/cdd-engine exec vitest run src-next/contract/__tests__/completion-criterion.test.ts` 全绿
- 提交 — checkable: `git log -1 --oneline` 含本任务主题

#### Acceptance

- carrier 每条 finding 带稳定 `id`，子代理写值被覆盖
- 改写 summary 不再产生 unknown；两侧差集同现于一次失败报文，missing 侧每条带 `id` + summary 首句、unknown 侧带 `id` 并标 `unknown`（一次失败即可行动）
- 旧 carrier 走 summary 回退并记 soft（软观察缺失即红）
- 历史 carrier 零迁移

#### DependsOn

4

### Task 6: 已关闭波纪律（文字面）

#### Objective

把「已关闭波的内容是历史」落成写作纪律：引擎评审 prompt 轴（plan / spec 变体）与 `cdd-plan` 的 `NEXT-LOOP` 节点各加一句，附子串 pin；引擎侧零新增 finding 路由分支。`NEXT-LOOP` 是该 skill 唯一派发 fix 轮的节点（`packages/kairos/skills/cdd-plan/SKILL.md:68-73`）——该 skill 没有 `fix` 节点，其节点集是 `run-cdd-plan-session` / `backfill-design` / `author-plan` / `self-review` / `commit-plan` / `NEXT-LOOP`。

#### Files

- Modify: `packages/cdd-engine/src-next/render/templates.ts`（plan / spec 评审轴的 closed-wave 句）
- Modify: `packages/kairos/skills/cdd-plan/SKILL.md`（在 `NEXT-LOOP` 的 `- **Do**` 段末**追加第二句**，写明 finding 落在已关闭 task 块的内容面时改文档去对齐已交付切分、禁止搬运已关闭任务的工作；`author-plan` 的「Appending work」句（第 47 行）不动，也不复用——那句讲的是「新工作以新 task 追加」）
- Test: `packages/cdd-engine/src-next/render/__tests__/templates.test.ts`
- Test: `packages/kairos/tests/cdd-plan-spec.test.ts`（该 skill 的既有节点段 pin 文件；断言按**节点段**切分——`### \`NEXT-LOOP\`` 起到下一个 `### ` 之前，而 `NEXT-LOOP` 是 `## Invariants` 前的最后一个节点，故段界取最近的 `### ` 或 `## `，整文件子串不算交付）
- Test: `packages/cdd-engine/src-next/session/__tests__/dispatch-authority.test.ts`（结构性 pin 的 home——路由两面的源文件按行命中数断言，零命中即「零新增 finding 路由分支」）

#### Consumes

- `render/templates.ts` 的 `docNarrativeAxes` 与 plan 变体轴
- `packages/kairos/tests` 的既有子串 pin 手法

#### Produces

- 两处文本各一句（改文档对齐已交付切分 · 禁止搬动已关闭任务的工作）
- 子串 pin 各一条（`cdd-plan` 那条是 `NEXT-LOOP` 节点段内子串，不是整文件子串）

#### Steps

- 写失败测：`templates` 的 plan 与 spec 变体渲染文本含该句 — checkable: FAIL（今日无该句）
- 写失败测：`cdd-plan` 的 `NEXT-LOOP` 节点段（`### \`NEXT-LOOP\`` 起至下一个 `### ` 前）含该句；同测断言该句不靠 `author-plan` 第 47 行的既有闭波句满足（两句措辞不同，整文件子串会让未交付的 fix 轮指令假绿） — checkable: FAIL（今日 `NEXT-LOOP` 段内无该句）
- 落两句文本 — checkable: 上两测 PASS
- 结构性 pin：`dispatch-authority` 与 `next` 侧零新增 finding 路由分支（对相关符号的命中数断言） — checkable: 断言 PASS
- 提交 — checkable: `git log -1 --oneline` 含本任务主题

#### Acceptance

- `render/templates.ts` 评审轴与 `cdd-plan` 的 `NEXT-LOOP` 节点段含对应句（节点段内子串 pin，非整文件子串）
- 引擎侧零新增 finding 路由分支（结构性 pin）

#### DependsOn

3

### Task 7: 外部改设计的 reopen（`--recover` 的 reopen 腿）

#### Objective

让「review 的结论被外部改写取代」成为可记账事实：`RoundRecord` 增 `supersededBy`；`#pendingFix` 与 `lineRoute` 选取最新 completed review 时跳过带该戳的记录（`#rowClosed` 与波行闭合判定**不改**）；`--recover` 在 `review` + doc/branch 行 + 三条件成立时先分 `N+1`、再盖戳、再放行；拒绝语的 `next:` 带 `--recover`。

#### Files

- Modify: `packages/cdd-engine/src-next/session/ledger.ts`（`RoundRecord.supersededBy`；`#pendingFix` / `lineRoute` 的 review 选取跳过；`supersedeReview(cycle, byCycle)`）
- Modify: `packages/cdd-engine/src-next/session/dispatch-authority.ts`（`pending-fix` 且 drift 的拒绝语 `next` 变体携带 `--recover`）
- Modify: `packages/cdd-engine/src-next/face/cli.ts`（`--recover` 三段判定与双缺 BLOCKED 报文、reopen 腿的触发条件与调用序：composition root 持有的 `lifecycle.foldAbort()`（Task 4 的公开入口）→ `ledger.supersedeReview` 盖戳 → 派 `N+1`；不得靠 `step()` 内部顺序实现）
- Test: `packages/cdd-engine/src-next/session/__tests__/ledger.test.ts`
- Test: `packages/cdd-engine/src-next/session/__tests__/dispatch-authority.test.ts`（`DispatchAuthority#message` 渲染的 `drift ∧ pending-fix` 拒绝语：一行内同现 pending-fix 理由 token 与 `--recover` 字面）
- Test: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（双缺拒绝面不落普通派发 · 三动词与 wave 行的负向触发面 · abort→reopen 合并序）

#### Consumes

- `Ledger#reviewGate` / `#pendingFix` / `lineRoute` / `#latestCompletedCycleOfRow` / `#rowClosed`
- `Ledger#pendingFix` 的成员腿 `#completedCyclesOfRow(row, "fix")`（`session/ledger.ts:1424`）——「fix 是否仍被欠着」的判据，也就是 fix ⟷ review 同 cycle 的 D28 身份面（`ReviewedIdentity` 是 reviewed-revision 的回写腿判定，不是这个面）
- Task 4 的 abort 折账入口

#### Produces

- `RoundRecord.supersededBy?: { cycle: number; cause: "recover" }`
- `Ledger#supersedeReview(cycle, byCycle)`（只盖戳，不写假 fix）
- `#pendingFix` / `lineRoute` 跳过 superseded review；`#rowClosed` 零改
- 拒绝语 `next`：`drift ∧ pending-fix` 时给出带 `--recover` 的同形 review 命令——命令经 `CliGate#hopCommand`（`face/gate.ts:102`，调用点 `face/cli.ts:987`）渲染，`DispatchAuthority#message` 把理由与它拼成一行
- 双缺拒绝面（§2.1③）：无陈旧 in-flight 且无 `drift ∧ pending-fix` → BLOCKED，报文同时点名两个缺失条件，命令在此终止、不进普通派发
- 合并腿序（§2.1④）：同一条 `--recover` 先调 `lifecycle.foldAbort()`（Task 4 的公开入口）、再盖 `supersededBy`、再派 `N+1` review——次序在 CLI 的判定处固定

#### Steps

- 写失败测：drift ∧ pending-fix ∧ 无在飞 → `--recover` 后 `review` 可派发，新 review cycle 为旧 +1，旧 review 带 `supersededBy` — checkable: FAIL（今日 `pending-fix` 拒绝）
- 写失败测：同夹具缺任一条条件（无 drift / 无 pending-fix / 有在飞）→ BLOCKED 且报文点名缺项 — checkable: FAIL（今日无该报文）
- 写失败测：supersede 后 `#rowClosed` 对一条已闭合线的判定不变（成对 pin：闭合不被 supersede 打开） — checkable: FAIL 若实现顺手改了 `#rowClosed`
- 写失败测（双缺拒绝面）：既无陈旧 in-flight、也无 `drift ∧ pending-fix` 时 `--recover` → BLOCKED，报文同时点名两个缺失条件；同夹具下 `review` / `implement` / `fix` 三动词都不得落普通派发（断言派发入口零调用） — checkable: FAIL（今日无该判定面，flag 直落普通派发）
- 写失败测（合并腿）：陈旧 in-flight ∧ drift ∧ pending-fix 的一条 `--recover` → 账本里 abort `RoundRecord`（cause `interrupted`）先落、旧 review 后被 `supersededBy` 盖戳、随后派 cycle `N+1` 的 review（按落账序与 cycle 断言，不按实现内部调用序） — checkable: FAIL（今日两条腿都不存在）
- 写失败测（`next:` 面）：`drift ∧ pending-fix` 行上 review 被拒 → `DispatchAuthority#message` 的一行同现 pending-fix 理由 token 与 `--recover` 字面（命令由 `CliGate#hopCommand`（`face/gate.ts:102`）渲染 `cdd review … --recover`） — checkable: FAIL（今日只打 `reason · next: <旧 review 命令>`，零 `--recover`）
- 写失败测（负向触发面）：同夹具下 `fix --recover` 与 `implement --recover` 只走 abort 腿——旧 review 无 `supersededBy`、无新 review cycle；wave 行的 `review --recover` 同样不重开（brief-drift 仍是 P29 的路）；三动词的 abort 腿仍可用 — checkable: FAIL（今日无 reopen 判定，负向断言无从成立）
- 实现 `--recover` 三段判定、双缺报文、`supersededBy`、两处跳过、调用序与拒绝语 `next` — checkable: 上七测 PASS；`pnpm -C packages/cdd-engine exec vitest run src-next/session/__tests__/ledger.test.ts src-next/face/__tests__/cli.test.ts` 全绿
- 提交 — checkable: `git log -1 --oneline` 含本任务主题

#### Acceptance

- drift ∧ pending-fix（无在飞）经 `--recover` 后 `review` 可派发，新 cycle = 旧 +1，旧轮带 `supersededBy`
- 双缺（无陈旧 in-flight 且无 `drift ∧ pending-fix`）→ BLOCKED 且报文点名两个缺失条件，绝不静默降级为普通派发（`review` / `implement` / `fix` 三动词 pin）
- `drift ∧ pending-fix` 的拒绝语一行内同现 pending-fix 理由与 `--recover`（`next:` 面 pin，经 `CliGate#hopCommand` 渲染）
- 单条 `--recover` 上 abort 与 reopen 同现时顺序固定：abort 记录先落、`supersededBy` 后盖、`N+1` 再派（落账序 pin）
- reopen 触发面：仅 `review` + doc / branch 行；`fix --recover`、`implement --recover`、wave 行一律不重开（负向 pin），abort 腿三动词皆可用
- `#rowClosed` / 波行闭合判定零行为变化（成对 pin）
- fix 身份仍与请求方 review 同 cycle（按 `Ledger#pendingFix` 的成员判据断言，不用 `ReviewedIdentity` 的回写腿）

#### DependsOn

4

### Task 8: changeset 与全量门

#### Objective

补齐变更集并跑全量门；确认判收敛主线零字节改动，且仓内文档相对 Task 3 的具名 ceiling 无新增漂移。

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
- 跑 `pnpm run validate` — checkable: exit 0（root · kairos · engine · typecheck ×3 · version-sync · emit fresh · 零裸函数）；engine suite 内含 Task 3 的 corpus guard 测，故「存量文档涨过具名 ceiling」在本门里可红
- 复核 corpus guard 覆盖：`docs/kairos/{specs,plans,overalls}` 三目录皆被遍历（不是只测两份样本） — checkable: 目录遍历断言命中数 ≥ 1 且三目录各至少一篇
- 断言判收敛主线零改：`git diff develop -- packages/cdd-engine/src-next/session/next.ts` 对闭合判定与 blocker 计数零命中 — checkable: 命中数 0（或只有注释级改动并有说明）
- 提交 — checkable: `git log -1 --oneline` 含本任务主题

#### Acceptance

- changeset 存在且为 minor
- `pnpm run validate` exit 0
- 判收敛主线零字节改动
- 仓内 spec / plan / overall 对三条 lineage 腿无新增漂移（shape 不超过具名基线，latest-matches 在 p24 对各 ≤ 1 且其余为 0，version-unique 为 0；Task 3 的 corpus guard 测随 engine suite 在 `pnpm run validate` 内绿，非口头声称；存量既有红不归本相位）

#### DependsOn

7, 5, 6

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-08 | 初版：八任务四波 W1={1,3}·W2={2,4,6}·W3={5,7}·W4={8}——recover 旗标硬切 · 完成判据证据分支 · change-history 硬化 · abort 入账 · finding id 双侧差集 · 已关闭波纪律 · reopen 严格条件 · changeset 与全量门 | [human] 裁定 · Claude（kairos:cdd-plan · 2026-11-08） |
| v0.2 | 2026-11-08 | 评审回填（plan-review-1 F1–F7）：① Task 1 Files 扩到 `--steal-stale` 的全部字面面——`lifecycle.ts` / `inflight.ts` / `preflight.ts` 传递链，加 preview / board-view / preflight / inflight 四个测试文件（报文字面改词，`stealable` 键名不变）；② Task 7 补「双缺 → BLOCKED 且不得降级为普通派发」红测；③ Task 7 补 abort→reopen 合并腿序红测；④ Task 2 补 `Files` 字面 `(none)` 的空判定 pin；⑤ Task 7 补 reopen 触发面负向 pin（`fix` / `implement` / wave 行）；⑥ Task 3 增 corpus guard 测——仓内 spec / plan / overall 对两条新不变量与 `change-history-version-unique` 零误伤成为可红 pin（不断言既有 `presence` 面上的存量红），Task 8 全量门引用；⑦ Task 5 DependsOn 4 由编排方落定（`2c80fb21`），本轮零结构面改动 | Oscaner M. · Claude（kairos:cdd-dev · docs-fix · 2026-11-08） |
| v0.3 | 2026-11-08 | **W1 评审期裁定回填（tasks-1,3-review-1 B1）**：Task 3 Acceptance 由「存量全绿」改为「每文档具名 ceiling 的不得新增」——既有语料里 15 篇冻结文档的 Change-history 表列宽不齐（overall 单篇 110 行），历史零迁移下本相位不修表，故以基线钉「修好即绿 / 变坏即点名」；`latest-matches-front-matter` 与 `version-unique` 的 ceiling 仍为 0，P30 自身文档零 finding。原「全绿」措辞是规划期没有量过语料就写下的断言 | [human] 裁定 · Claude（kairos:cdd-plan · 2026-11-08） |
| v0.4 | 2026-11-08 | **评审回填（plan-review-3 F1–F5）**：① Task 3 Acceptance 残留的「存量全绿」改为每文档具名 ceiling（与 Files/Produces 同口径），Review Focus 与 Task 8 的 Objective/Steps/Acceptance 同步改为「相对具名 ceiling 无新增漂移」；② 补齐 latest-matches 的非零 ceiling——p24 对（spec 与 plan）各 1，因形状折行的最新行携带数值最大版本且历史零迁移下不修表，`change-history-version-unique` 仍为 0；③ Task 3 增「成员读面取全部表体行首列版本」pin（Produces + Acceptance + colocated 测步），生重与 latest-matches 仍只读表头列宽一致的行集；④ Acceptance 的「最新行」消歧为「lineage 中数值最大的版本（与表序无关）」；⑤ 波图 W1={1,3}·W2={2,6}·W3={4}·W4={5,7}·W5={8} 与 Task 4 DependsOn 1, 2 已由编排方在 `d806c1e4` 落定，本轮零结构面改动 | Oscaner M. · Claude（kairos:cdd-dev · docs-fix · 2026-11-08） |
| v0.5 | 2026-11-08 | **评审回填（plan-review-4 F1–F9）**：① Task 4 的折账入口改为公开成员 `CliLifecycle.foldAbort()`（私有 `#foldAbort` 在 composition root 不可达——接管发生在 `step()` 内部的 `#runDispatch` → `acquire`），并拆出 `#lifecycleOf` 由 composition root 持有实例，使 §2.1④ 的「先 abort 再 reopen」在 CLI 判定处可得；② Task 2 声明 wave 成员集取自 `ctx.row.wave`（`ProgressRow.wave`，`ledger.ts:197-199`），`CompletionContext.row` 的 RESERVED 注记同步改，部分为空的夹具补 `row.wave = "1,2"` 与 `emptyFileTasks = {1}` 成对读法；③ Task 4 钉 `verdict.treeClean: true`（`#softOf` 会把 false 折成脏树 soft）并加账面 pin；④ Task 7 补 `next:` 面红测与验收（`DispatchAuthority#message` 一行同现 pending-fix 理由与 `--recover`，命令经 `CliGate#hopCommand`（`gate.ts:102`，调用点 `cli.ts:987`）），并把 Consumes 从 `ReviewedIdentity` 改指 `Ledger#pendingFix` / `#completedCyclesOfRow`；⑤ Task 6 的落点由不存在的「fix 节点」改为 `NEXT-LOOP` 节点段（第 68–73 行），pin 改节点段内子串、`author-plan` 第 47 行不动；⑥ Task 5 的失败报文补「每条目带 `id` + summary 首句」的红测与验收，并从 `handoff-schema.ts` 条目删除 `#materialize` 归属；⑦ Task 1 的全库 grep 豁免面改为「`__tests__/` 内的退役字面 pin」——今日 5 命中全在 `words.guard.test.ts` | Oscaner M. · Claude（kairos:cdd-dev · docs-fix · 2026-11-08） |
| v0.6 | 2026-11-08 | **评审回填（plan-review-5 F1–F3）**：① Task 4 的陈旧面按 spec §2.1① 三形态展开——Objective / Files / Produces / Steps / Acceptance 逐条覆盖 `held ∧ ¬alive` · `corrupt` + 残留锁 · 锁残留无记录，`foldAbort` 按 `Inspect()` 分支并取 `#stealIfDead` 已有的三条 steal reason；折账面按 §2.2 的机制只覆盖带得回记录的形态（另两形态 `steal()` 返回 `null`），加 pin 禁虚构 `op` / `cycle`，并补 `face/__tests__/lifecycle.test.ts` 三形态 colocated pin；② Task 5 的两处行号重锚到当前符号家（`#findingsList` @ `face/lifecycle.ts:1333` · `#keyRefusal` @ `contract/completion-criterion.ts:434`）；③ Task 2 的 `CompletionContext.row` 事项由「RESERVED 注记改写」改为「保持 W2 已落地的读者声明」（docstring 已具名 `CommitsSinceGroupBase.judge`，源码零 `RESERVED` 字面） | Oscaner M. · Claude（kairos:cdd-dev · docs-fix · 2026-11-08） |
