---
title: 'P44 · 引擎接手面收口：授权绑门 · 目标消失形态 · single-home 退役 · 读数只记不判'
doc-type: plan
version: v0.6
date: 2026-11-25
slug: '2026-11-25-engine-doc-tooling-p44-design'
base: develop
---

## Constraints

- **`--recover` 是唯一接手路径**：目标已消失不构成自动释放的理由；flag 永不越过 `alive === true`（spec §3.3 · §7.1）。
- **in-flight 门只判不写**：接手与记账仍在派发路径（`acquire` · `foldAbort`）上，`session/preflight.ts` 零新增写点。
- **`vet` 的门顺序零变**：tree-clean → in-flight → plan-carrier → graph → plan-ledger → doc-contract → 四条派发前门；「第一拒绝者拥有判决」不动。
- **机械面只许判派生**（D101 · D102 · D103）：本相位新增的判据只有两条存在性读取与一次派生改真；不新增门名、不新增 lens 标签、不新增分级档、不新增语料臂。
- **一个事实一种拼写**：第四态的行字只住 `face/words.ts#CAPSULE_WORDS.inFlight.targetGone` 一处，四个读者各读那一格。
- **不发布**：changeset 归并落 pending，`packages/cdd-engine` 一包 **minor**（D74：方法论契约不变；`packages/kairos/` 本相位零字节改动）。

### Task 1: 记录自己的目标事实

#### Objective
让 in-flight 记录的判断带出「它主张的目标已不在」这一事实，判据只用记录自带的两次存在性读取：`session/inflight.ts#InFlightRecord.plan`（repoRoot 相对路径）与 `InFlightRecord.slug` 的 workspace 目录。**记录带哪条事实才判哪条**——`plan` 为 `null` 只属于由 `--spec` 派发的文档面（`phase-spec` / `single-spec` / `overall`），plan 与 branch 面一律带 `--plan` 且记录必写该路径，所以判据是「记录里有没有这条事实」，不是「这是哪个面」。**读数逐格留到渲染面**：两条读数各占 `targetGone` 的一格，`targetGone.plan` 与 `targetGone.workspace` 各是一个布尔，而「目标已不在」由两格派生的折叠谓词承担——一个布尔只说「有一格读出不在」，说不出是哪一格，而第四态的行要渲的正是**读出不在的那几格**（spec §3.2），所以事实必须逐格留到渲染面才够用。记录没带的那条事实（`plan` 为 `null`）没有读出不在的形状，它那一格为假。任一带出的事实读出「不在」即折叠谓词为真：混合态（plan 被改名而 workspace 目录仍在）同判，与 spec §7.1 接受的误报面同读，而它渲出的只有 plan 子句。形态学零变——`InFlightState` 的 kind 集合不动，stale 记录的接手路径仍只有一条。

#### Files
- Modify: `packages/cdd-engine/src-next/session/inflight.ts`
- Test: `packages/cdd-engine/src-next/session/__tests__/inflight.test.ts`
- Test: `packages/cdd-engine/src-next/face/__tests__/board-view.test.ts`

#### Consumes
- spec §3.1（判据与混合态）· §7.1（接受的误报面）

#### Produces
- `InFlightState` 的 `held` 分支携带 `targetGone: { readonly plan: boolean; readonly workspace: boolean }`——每格是记录自带的对应那条存在性事实的读数；「目标已不在」的折叠谓词（任一格为真）由两格派生，不另存第三格；`InFlight.inspect` 的读取面
- `InFlightState` 的 kind 集合（`absent` / `held` / `corrupt`）零新增；`InFlight.staleState` 的返回面零变

#### Steps
- 在 `InFlight.inspect` 的 `held` 分支逐格取值 — checkable: `targetGone.plan` 读 `InFlightRecord.plan` 的存在性，`targetGone.workspace` 读 `<workspaceRoot>/<slug>` 目录的存在性；两格都是布尔，各由一条读数得出
- `held` 分支的字面量随之补齐 — checkable: 新成员是必填的，故 `session/inflight.ts` 的构造点与 `face/__tests__/board-view.test.ts` 里逐字写出的每个 `held` 对象字面量各取 `targetGone: { plan: false, workspace: false }`（该臂另需一格读数时取那个读数）；`pnpm exec tsc --noEmit -p packages/cdd-engine` exit 0——该 tsconfig 的 `include` 覆盖 `src-next` 的测试文件，漏一处即红，而那一处不在本波其它任务的写面里
- 折叠谓词派生 — checkable: 「目标已不在」只由两格派生出（任一格为真），`InFlightState` 的 `held` 分支上没有第二个布尔字段（grep 该分支的成员集）
- 写明「带哪条事实才判哪条」 — checkable: `plan` 为 `null` 的记录 `targetGone.plan` 为 `false`，折叠谓词只由 workspace 那一格决定（文档面单条事实的 pin 绿）
- 混合态同判 — checkable: `plan` 不在树上 ∧ workspace 目录在 ⇒ 两格取相反值（`plan` 真 · `workspace` 假），折叠谓词为真
- 形态学零变 — checkable: `InFlightState` 联合类型的 kind 字面零新增（grep 该类型的成员集）
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p44):` 起头（两条存在性读取是新行为，不是测试面改动）

#### Acceptance
三条存在性分支各一条 pin（带 plan 且不在 · 带 plan 且在 · plan 为 null 且 workspace 在）+ 混合态一条 + 逐格读数一条（混合态两格取相反值）；`face/__tests__/board-view.test.ts` 的 `held` 字面量随新成员补齐、`tsc` 收口到 exit 0；`InFlightState` 零新 kind、零第三格。

#### DependsOn
none

### Task 2: 接手授权绑 in-flight 门

#### Objective
把 leg ①（`face/lifecycle.ts#CliLifecycle.foldAbort` 的 stale 记录接手）的授权从「整段结构门通过」收窄为**两条已读事实的合取**：`session/preflight.ts#PreFlightVerdict.checked` 里存在 `in-flight:` 行 ∧ `session/inflight.ts#InFlight.staleState()` 非 `null`。这行只证 **tree-clean 已过**：`session/preflight.ts#PreFlight.#inFlightRow` 在 `#inFlightRefusal` 之前就把行推进 `checked`，被 in-flight 门自己拒的判决照样带着它，所以「in-flight 门没有拒绝」由 `staleState() !== null` 那条合取项承担、不由这行证明。两条缺一不可：脏树被拒时 in-flight 行根本不进 `checked`，此时只读 `staleState()` 会在脏树上开始 fold abort。`PreFlightVerdict.holding` 不是判据——它只在 in-flight 门自己拒绝时填入，而 leg ① 成立的那条路径上门恰恰放过。legs ②③（supersede 戳 · `N+1` 派发）仍守 `structure === null`；`foldAbort` 的 abort 账零变。**结构门的拒绝不被接手判决夺走**：leg ① 一旦不再骑 `structure === null`，`--recover` 的树就会进到接手判定里，而 `structure !== null` 时 legs ②③ 被关掉、活 holder 的 `staleState()` 又是 `null`，于是两条腿都不落地——这条路径必须返回 `allowed` 让第一拒绝者保留它的判决（活 holder 拿到 in-flight 门自己的 held BLOCK），`blocked` / `RECOVER_NOTHING` 只属于 `structure === null` 且两腿皆未落地的树。

#### Files
- Modify: `packages/cdd-engine/src-next/face/cli.ts`
- Test: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`

#### Consumes
- Task 1 的 `InFlightState.held.targetGone`（本任务不读它，只共用 `staleState()` 的形态学）
- spec §2.1（双条件授权）· §2.2（legs ②③ 仍守结构腿）· §2.3（不改的东西）

#### Produces
- `#recoverRun` 的 leg ① 授权谓词：`checked` 含 `in-flight:` 行 ∧ `staleState() !== null`
- `#recoverRun` 的 structure 事实：入参多一格「结构门仍有拒绝」的布尔（`face/cli.ts#Cli` 的调用处把 `structure` 在否传进来），`#reopenLeg` 的入参零变；该格为真 ∧ 两条腿皆未落地 ⇒ 返回 `allowed`
- 行为 pin：活 holder（`alive === true`）∧ `--recover` 的端到端（stderr 只剩 in-flight 门的 held BLOCK——pid 与记录里的 command，无「nothing to take over」句 · 记录与锁零改动）
- 行为 pin：`--recover` ∧ doc-contract 拒绝的端到端（记录被接手清除 · abort 账恰一条 `interrupted` · 随后同一命令不带 `--recover` 时被 doc-contract 拒绝而不是被 in-flight 拒绝）
- 行为 pin：legs ②③ 在「文档门拒绝 ∧ 有漂移 ∧ 有 pending fix」的树上零 supersede 戳、零新 review 轮派发（同一棵树去掉文档违规后两者落地）

#### Steps
- 把 leg ① 的授权改成合取式 — checkable: 从 `structure === null` 改为「`checked` 行存在 ∧ `staleState()` 非 null」，`structure` 只留给 legs ②③
- 脏树不 fold — checkable: tree-clean 拒绝 ∧ 树上有 stale 记录 ⇒ 记录零改动、`recordRound` 零调用
- 活 holder 不位移 — checkable: `alive === true` ∧ 任一后续门拒绝 ⇒ 记录原样、零 abort 账；`staleState()` 对活记录返回 `null`，leg ① 的合取因此不成立
- 非折分支不夺判决 — checkable: `structure !== null` ∧ leg ① 未折 ⇒ 接手判决返回 `allowed`，stderr 只留第一拒绝者那一句（活 holder 时是 held BLOCK，含 pid 与 command，不含「nothing to take over」）；`blocked` / `RECOVER_NOTHING` 只在 `structure === null` ∧ 两腿皆未落地时出现
- 两条结构门的 CLI 臂 — checkable: `face/__tests__/cli.test.ts` 里用 `holdTree` 写下活 holder，跑一个非 `--dry-run` 的动作带 `--recover` ⇒ 退出 1、`io.stderrText` 含 held BLOCK 且不含「nothing to take over」，记录与锁零改动；另加脏树 ∧ stale 记录 ∧ `--recover` 臂 ⇒ `io.stderrText` 含 `tree-clean` 拒绝句，记录逐字节不变（既有那条结构门拒绝的记录断言因此不被早退的 `blocked` 抹掉）
- abort 账一条 — checkable: 被接手的记录恰写一条 `interrupted`，op/cycle/attempt/`dispatchBase` 逐字来自记录
- 文档门拒绝不写戳 — checkable: `review --type plan --recover` 在「文档门拒绝 ∧ 有漂移 ∧ 有 pending fix」的树上 ⇒ leg ① 折过（记录已清），但零 `supersededBy` 戳、零新 review 轮派发；同一棵树去掉文档违规 ⇒ 戳与下一轮都落地。`#reopenLeg` 不收结构事实（`structure` 只留在调用处），若把文档门的判决穿给它，新参数名与改动的文件写进这一步
- 提交 — checkable: `git log -1 --format=%s` 以 `fix(p44):` 起头

#### Acceptance
行为 pin 全绿（脏树不 fold · 活 holder 不位移 · 非折分支不夺判决 · abort 账一条 · 文档门拒绝不写戳 · `--recover` 端到端 · legs ②③ 零戳零派发 · 活 holder 与脏树两条 CLI 臂）；`foldAbort` 与 `session/ledger.ts#AbortFold.bookedOf` 零改动。

#### DependsOn
1

### Task 3: 第四态的四个读者

#### Objective
新增 `face/words.ts#CAPSULE_WORDS.inFlight.targetGone` 一行：两个子句格分别命名「它主张的 plan 不在了」与「它的 workspace 目录不在了」（只渲读出不在的那几格），整行仍带 `--recover` 接管指令。`face/words.ts#InFlightWords` 那一组行形状随之多一行（接口只装行，方法在 `class Words` 上）。四个读者各就位：`session/preflight.ts#PreFlight.#inFlightRow` 对 `targetGone` 记录改读这一格（其 `checked.inFlight.stale` 保留「持有者已死、目标还在」一格）、`face/words.ts#Words.inFlightBlocked` 的阻断报文、`face/board-view.ts#BoardView.inFlightRows` 的 board 行、`face/preview.ts#Preview.heldBlock` 的 dry-run 接管提示（`--dry-run` 的 in-flight 分支在阻断报文之前返回，只有它打那一句）。四个读者都经同一个渲染器取整条裸行——读出不在的那几格子句加 `--recover` 接管句——没有一面把表里的原行推出去。`face/__tests__/words.guard.test.ts` 的接管提示是逐行手写的枚举，第四态行必须进那一列。

#### Files
- Modify: `packages/cdd-engine/src-next/face/words.ts`
- Modify: `packages/cdd-engine/src-next/session/preflight.ts`
- Modify: `packages/cdd-engine/src-next/face/board-view.ts`
- Modify: `packages/cdd-engine/src-next/face/preview.ts`
- Test: `packages/cdd-engine/src-next/face/__tests__/words.guard.test.ts`
- Test: `packages/cdd-engine/src-next/session/__tests__/preflight-rows.test.ts`
- Test: `packages/cdd-engine/src-next/session/__tests__/preflight.test.ts`
- Test: `packages/cdd-engine/src-next/face/__tests__/board-view.test.ts`
- Test: `packages/cdd-engine/src-next/face/__tests__/preview.test.ts`

#### Consumes
- Task 1 的 `targetGone.plan` 与 `targetGone.workspace` 两格读数（行渲哪一格由它们决定）
- spec §3.2（四面同词表 · 两张表各一格）· 「Acceptance criteria」里「第四态的判据与拼写」与「第四态的四个观测面」两条

#### Produces
- `CAPSULE_WORDS.inFlight.targetGone`（唯一 home 的行字）
- `Words.inFlightBlocked(record, alive, targetGone?)`——第三参是 Task 1 的两格读数，可选；`alive === true` 时无论两格为何都仍渲 held 的字节，`face/cli.ts#Cli.#renderHeld` 的 acquire 竞争面因此保持两参调用、零字节改动
- `Words.inFlightTargetGone(targetGone): string`——裸行的唯一渲染面（兄弟渲染器）：返回**整条裸行**（读出不在的那几格子句 + `--recover` 接管句），持有目标的那一格零输出，不带 held 前缀；四个读者都读它——`session/preflight.ts#PreFlight.#inFlightRow` · `face/words.ts#Words.inFlightBlocked` · `face/board-view.ts#BoardView.inFlightRows` · `face/preview.ts#Preview.heldBlock`——今天后两处各自把 `inFlightWords().stealable` 模板原字节推出去，两子句条件渲的形态在那里没有入口；`Words.inFlightBlocked` 仍负责把这个裸行接在 `inFlightHeld` 之后
- 四个读者对读出不在的那几格的渲染；`checked.inFlight.stale` 与 `inFlight.stealable` 的活目标语义保

#### Steps
- 落行字 — checkable: `CAPSULE_WORDS.inFlight.targetGone` 存在，含两个子句占位与 `--recover` 接管指令；`InFlightWords` 的键集多该键
- 子句格按读数渲 — checkable: 行的两个子句格各由 `targetGone.plan` 与 `targetGone.workspace` 的一格决定渲不渲（格为真才出句），记录没带的那条事实那一格恒不出句
- `checked:` 行改读 — checkable: 折叠谓词为真的记录的 `in-flight:` 行读该行字；活目标 stale 记录仍读 `checked.inFlight.stale`。`session/preflight.ts#PreFlight.#inFlightRow` 自己调 `Words.inFlightTargetGone(targetGone)` 取整条裸行，不把 `CAPSULE_WORDS.inFlight.targetGone` 原行推出去。`session/__tests__/preflight.test.ts` 的 stale 臂（记录写 `plan: "docs/p.md"` 与 `slug: "other-slug"`，两者都不在夹具树上）随之改成第四态的字节，同一文件的活 holder 臂那条 `/^in-flight: held/` 断言原样保留
- 活口优先 — checkable: `alive === true` 的记录无论两格读数为何都读 held 的活口（`#inFlightRow` 先判 `state.alive`，第四态只在 `alive === false` 时进），三个提示面同臂
- 四个读者读同一格 — checkable: `in-flight:` 行 · 阻断报文 · board 行 · dry-run 提示对折叠谓词为真的记录输出同一句；`Words.inFlightBlocked` 取第三参（Task 1 的两格读数）渲子句，`face/cli.ts#Cli.#renderHeld` 的 acquire 竞争面保持两参、字节零变（活 holder 不渲第四态子句）；四个读者都不自己拼模板，各读 `Words.inFlightTargetGone(targetGone)` 那一条裸行（`PreFlight.#inFlightRow` 的行、`BoardView.inFlightRows` 的死口后缀、`Preview.heldBlock` 的接管提示行与阻断报文同源），同一格读数在四面字节一致
- 每面一条字节臂 — checkable: 同一条 `targetGone` 读数下，四个渲染面（`in-flight:` 行 · 阻断报文 · board 行 · dry-run 提示）的字节各含 `--recover`；镜像混合态（`plan` 路径不在树上 ∧ `<workspaceRoot>/<slug>` 目录在）上四面都不含 workspace 子句
- 成对臂 — checkable: 目标还在的 stale 记录 ⇒ 三提示面仍 `stealable` 且 `checked:` 行仍 `stale`；两格都读出不在 ⇒ 四面换词（无一面复述 `stealable`）
- 混合态 — checkable: 只带 workspace 事实且该目录不在 ⇒ 行只渲 workspace 那一格子句
- 镜像混合态 — checkable: `plan` 路径不在树上 ∧ `<workspaceRoot>/<slug>` 目录在 ⇒ 折叠谓词为真，四个读者同读的那一格只渲 plan 子句、workspace 子句零输出（目标还在的那条事实不由这一行替它说话）
- 硬切枚举 — checkable: `words.guard.test.ts` 的接管提示枚举含第四态行，「含 `--recover` · 不含 `--steal-stale`」两条断言对它成立
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p44):` 起头

#### Acceptance
四处渲染面各一条 pin（各含 `--recover`，镜像混合态上各不含持有格的子句）+ 成对两臂 + 混合态两条镜像臂（plan 不在而目录在 · 目录不在而 plan 在）+ 活口优先一条（`alive === true` ∧ 两格读出不在 ⇒ 四面仍读 held 的活口）+ 裸行渲染一条（四个读者对同一格读数取 `Words.inFlightTargetGone` 的整条裸行字节，无一面临推 `stealable` 或 `targetGone` 原行）；零新增 lens 标签与站名。

#### DependsOn
1

### Task 4: 提示面：评审问句与写权纪律

#### Objective
三处判据体各加一句，零新增 lens 标签、零新增分级：① `contract/review-criteria.ts#LENS_QUESTION_ROWS` 的现成 `spec-consistency` 行扩写**指称问句**——文档给出一个读数时，问它数的是哪几条、那几条还在不在树上（#521 的处置：脱钩是这条问句的答案，不是新判据）；② 同表 wave/branch 共享的 `spec-lens` 行收 S4「需求看着实现了、实现看着不对」；③ `render/templates.ts#CALIBRATION_TAIL` 加 S5「多轴分别报，禁止合并成一个『最严重』」；④ 同文件 `CLAUSES` 新增 `cl:own-document`：写面按模式点名，不挂在 `findings` 上——**implement** 轮 = 自己的目标文档 + wave brief 里 `### Task N:` 点名的任务文件（它的载体只有 `work` 面、没有 `findings`，`judge` 面由 review 轮写）；**fix** · **docs-fix** 轮 = 自己的目标文档 + finding 画面点名的代码文件（docs-fix 轮就是被判文档自己）；**review** 轮 = 自己的目标文档（只读）+ 它的 `findings` 载体，**零代码写面**——这半读的是同一提示里那句 `Read-only`（「never mutate tracked content, the index, HEAD, or branch state」），不是第四个写面。其它文档（父宪章 · 兄弟 spec · 计划）在它的写权之外、经编排器回填落地；与 `cl:plan-freeze` 的分工写在同一处（后者管目标文档**内**的许可，前者管文档**集**的边界）；四个模式共享该子句，`TEMPLATE_PROMPT.$version` 随提示字节递增。`render/templates.ts#REVIEWS` 的 `lensEnum` 与 `LENS_QUESTIONS.forReviewKind` 的行数零变。

#### Files
- Modify: `packages/cdd-engine/src-next/contract/review-criteria.ts`
- Modify: `packages/cdd-engine/src-next/render/templates.ts`
- Test: `packages/cdd-engine/src-next/contract/__tests__/review-criteria.test.ts`
- Test: `packages/cdd-engine/src-next/render/__tests__/templates.test.ts`
- Test: `packages/cdd-engine/src-next/render/__tests__/render.test.ts`

#### Consumes
- spec §4.2（指称问句）· §5.1（S4 的缺口边界）· §5.2（只收判据、不收流程）· §9.1 / §9.2（写权边界与两条子句的分工）

#### Produces
- `spec-consistency` 行的指称问句；`spec-lens` 行的 S4 问句；`CALIBRATION_TAIL` 的 S5 一句
- `CLAUSES` 的 `cl:own-document`（四模式共享：写面按 implement · fix · docs-fix 三个点名，**review** 轮零代码写面并明写它读的是 `Read-only` 那句），与 `cl:plan-freeze` 的分工句；`TEMPLATE_PROMPT.$version` 递增
- `REVIEWS.spec.lensEnum` 零新增标签；`LENS_QUESTION_ROWS` 行数与 `forReviewKind` 的投影行数零变

#### Steps
- 扩写 `spec-consistency` 行 — checkable: 该行问句含「数的是哪几条 / 那几条还在不在树上」两问，行 id 与 `lens` 零变
- 扩写共享 `spec-lens` 行 — checkable: 该行（`reviewKinds: ["wave","branch"]`）含「看着实现了、实现看着不对」一问，wave 与 branch 两个投影逐字同句
- `CALIBRATION_TAIL` 加 S5 — checkable: 该常量含「多轴分别报，禁止合并成一个『最严重』」一句，且不出现在任何 per-key 副本里（一事实一处）
- 零新增 — checkable: `REVIEWS` 的 `lensEnum` 键集与 `LENS_QUESTION_ROWS` 行数零变（两条断言）
- 写权纪律 — checkable: `CLAUSES` 含 `cl:own-document` 且四个模式（implement · review · fix · docs-fix）的渲染各自含该句；该句含三个写面名（**implement** 轮的 `### Task N:` 任务文件 · **fix** 轮的 finding 画面点名的代码文件 · **docs-fix** 轮的 finding 画面点名的代码文件，后者就是被判文档自己），并对 **review** 轮写明零代码写面（只写它的 `findings` 载体，写权读同一提示里的 `Read-only` 句）；`$version` 递增；成对四臂：fix 轮写本轮目标文档仍被允许 · implement 轮写一份 brief 点名的任务文件仍被允许（findings-only 形状在这一臂红） · 写一份 findings 之外的文档零许可 · 一份 review 外壳（`render/templates.ts#TEMPLATE_PROMPT.reviews.<type>.shell`）同时含 `Read-only` 与该子句，而该子句里无任何 review 轮的代码写面。`render/__tests__/render.test.ts` 的 `$version` pin 是这一递增的唯一 stale 断言，随本步一起走：`expect(TEMPLATE_PROMPT.$version)` 的期望值与上方那段逐相位递增史注释同批跟上（pin 从 25 到 26），否则该套件在写面之外红
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p44):` 起头

#### Acceptance
三句各一条 pin + 两条零变断言 + 写权子句的四模式共享断言与四臂成对断言（末臂：review 外壳同时含 `Read-only` 与该子句，且该子句不点名 review 的代码写面）+ `$version` pin 与它的递增史注释同批改真一条；`SEVERITY_RUBRIC` 的组装面零变。

#### DependsOn
none

### Task 5: `single-home` 整条退役

#### Objective
删 `contract/rules.ts` 的 `single-home` 规则行，删 `contract/invariants.ts#SingleHomeInvariant` 与 `SentenceIndex` 整组（`MIN_LENGTH` · `THRESHOLD` · `isWorkItem` · 3-gram 比较面），删它自己的夹具文件。测试面同批收口：`SHAPE_RULE_IDS` 去掉该 id；席位表删该行（表长读 `RULE_REGISTRY` 自身，不加字数）；`charter-self-repair` 该族的臂随规则退出、不重挂；`fix-round-gate` 的「docs-fix 外壳不点名」负向对只剩 `change-history-date-shape` 一条；`selector-coverage` 的邻域种植臂改指 `contract/invariants.ts#CrossDocChainInvariant` 的 `specChain`——它经 `#parentLineage` 用 `ctx.fs` 缝读 `program:` 指向的那份 overall，臂要保的「邻域读走缝、不走 checkout」一条不减。

#### Files
- Modify: `packages/cdd-engine/src-next/contract/invariants.ts`
- Modify: `packages/cdd-engine/src-next/contract/rules.ts`
- Delete: `packages/cdd-engine/src-next/contract/__tests__/single-home.test.ts`
- Modify: `packages/cdd-engine/src-next/contract/__tests__/shape-rules.test.ts`
- Modify: `packages/cdd-engine/src-next/contract/__tests__/rules.test.ts`
- Modify: `packages/cdd-engine/src-next/contract/__tests__/charter-self-repair.test.ts`
- Modify: `packages/cdd-engine/src-next/contract/__tests__/selector-coverage.test.ts`
- Modify: `packages/cdd-engine/src-next/session/__tests__/fix-round-gate.test.ts`

#### Consumes
- spec §8.1（代理不是派生 · 两向皆错 · 解药即病）· §8.2 的删面清单
- D103

#### Produces
- 形状门三行：`line-coordinate` · `live-arithmetic` · `change-history-date-shape`
- `selector-coverage` 的邻域种植臂落在 `CrossDocChainInvariant#specChain` 上

#### Steps
- 删注册与实现 — checkable: `single-home` 在 `contract/rules.ts` 的 `RULE_REGISTRY` 零命中；`SingleHomeInvariant` / `SentenceIndex` 在 `packages/cdd-engine/src-next` 的源码面零命中
- 删夹具 — checkable: `contract/__tests__/single-home.test.ts` 不在树上
- 测试面收口 — checkable: `SHAPE_RULE_IDS` 与席位表各少该行；`charter-self-repair` 该族臂零残留；`fix-round-gate` 的负向对只剩 `change-history-date-shape`
- 测试面模块头改真 — checkable: 三处模块头不再点名该 id——`shape-rules.test.ts` 的 `SHAPE_RULE_IDS` 上方那条 roster 注释、`charter-self-repair.test.ts` 模块头里描述该族臂与右域语料的几句、`selector-coverage.test.ts` 的模块头与邻域种植注释（后者改指 `contract/invariants.ts#CrossDocChainInvariant` 的 `specChain`）；三个文件里该 id 零命中，而「邻域读走 `ctx.fs` 缝」那句论证不减
- 邻域臂改指 — checkable: `selector-coverage` 的种植臂断言 `CrossDocChainInvariant` 经 `ctx.fs` 读到 `program:` 指向的 overall（缝被走到，checkout 零读取）
- 注册表注释的 scope 计数改真 — checkable: `contract/rules.ts` 注册表注释里的 doc scope 与 ledger scope 两个计数随该行退役改真（`contract/__tests__/rules.test.ts` 的派生比对是唯一判据，它的 `doc rows` 一格点名这一处；注释照 `RULE_REGISTRY` 自身长度写，不写算式、不另立断言）
- 全绿 — checkable: `pnpm -C packages/cdd-engine test` exit 0，且引擎套件数比退役前少（无 skip 掩饰）
- 提交 — checkable: `git log -1 --format=%s` 以 `refactor(p44):` 起头（删注册与实现是真行为面改动，不归 test 类型）

#### Acceptance
测试面各处一条断言（含三处模块头的改真）；形状门行册帧成三行；`cross-doc-chain` 的邻域臂语义不降级。

#### DependsOn
none

### Task 6: 名册改真与本 spec 的验收尾

#### Objective
`single-home` 退役后名册在源码面有四处转述，同批改真：`contract/invariants.ts` 的模块头名册行、`contract/rules.ts` 的注册注释、`face/cli.ts#Cli.#contract` 的字段注释与 `#beginCommand` 的两处注释。同批把两处「为已删语料而写」的代码改真：`face/cli.ts#Cli.#beginCommand` 不再重建 `#contract`（它的每个字段都是构造期从声明表派生的只读值，重建与不重建得到同一个判断面），`#contract` 的字段注释与方法注释里「strategies hold their own state」那一半去掉、改成「命令边界不重建」的那一句；测试侧 `__tests__/support/memory-fs.ts` 的模块头只留两条还在的夹具家族。**零残留 grep pin** 写成显式形态：扫 `contract/` 与 `face/` 的源码面按规则 id 匹配，`__tests__/` 只保留负向断言，`single-homed` 这类散文词不在扫描面。文档面的名册（P43 spec §4.2 的名册句 · 宪章的 P44 行）属于登记面，归**编排器的回填**，本任务只把它记成一条 `Produces:` 义务、不写这两个文件的字节。最后把本 spec 的验收尾**改回统一措辞**——它是这条规则的自证现场，退役后无需豁免；这一步是显式的文档编辑，不掉在「收尾顺手改」里。

#### Files
- Modify: `packages/cdd-engine/src-next/contract/invariants.ts`
- Modify: `packages/cdd-engine/src-next/contract/rules.ts`
- Modify: `packages/cdd-engine/src-next/face/cli.ts`
- Modify: `packages/cdd-engine/src-next/__tests__/support/memory-fs.ts`
- Modify: `docs/kairos/specs/2026-11-25-engine-doc-tooling-p44-design.md`
- Test: `packages/cdd-engine/src-next/contract/__tests__/rules.test.ts`

#### Consumes
- Task 5 的退役面
- spec §8.2 的「名册改真」「`#contract` 的重建随语料退役」「本 spec 的验收尾」三条

#### Produces
- 四处源码注释里只有 `contract/invariants.ts` 的模块头名册行逐字枚举剩下的三个形状 id，`contract/rules.ts` 的注册表注释只留它自己的两句描述、零规则 id；`#beginCommand` 不再重建 `#contract`；测试侧 `DocFs` 的模块头只列两条在册夹具
- 零残留 pin 落在 `contract/__tests__/rules.test.ts`（红/绿成对）；本 spec 的验收尾回到写定的那一句
- 登记面回填义务：P43 spec §4.2 的名册句与宪章的 P44 行（由编排器落地，本任务零字节改动）

#### Steps
- 源码面四处改真 — checkable: 每处按它现在实际带的东西收口，不按名册想象的形状改——① `contract/invariants.ts` 的模块头名册行（`the shape gate (P41)` 那一行）去掉该 id，`line-coordinate` · `live-arithmetic` · `change-history-date-shape` 仍逐字在那一行；② `contract/rules.ts` 的注册表注释里的括注（`the variable classes · single-home · the record face's date shape`）去掉 ` · single-home`、留它自己的两句描述——这一处从不逐字带规则 id，故它**不**承载那三个 id，不把名册写进它；③ `face/cli.ts#Cli.#contract` 的字段注释与 ④ `#beginCommand` 的方法注释、行内注释改读「命令边界不重建」那一句，不再点名任何规则 id（那两处的判断是构造期派生，不是更短的名册）。断言按处分：`single-home` 在这四处零命中；三个形状 id 的逐字出现只钉 `contract/invariants.ts` 的名册行一处；`contract/rules.ts` 的注册表注释取负向断言（括注里不带任何规则 id）
- `#contract` 的重建随语料退役 — checkable: `face/cli.ts#Cli.#beginCommand` 里 `new Contract()` 零命中，`#contract` 字段注释与该方法的文档注释改成「命令边界不重建」的那一句，字段类型与它的派生面零改；pin 取源码形态（那条构造缺席），行为断言不可得时不强凑
- 测试侧缝头改真 — checkable: `__tests__/support/memory-fs.ts` 的模块头只列 P41 T7 的 charter 夹具与 P43 T9 的 selector matrix，`single-home` 在该文件零命中
- 零残留 pin — checkable: 扫描面（`contract/` + `face/` 源码按规则 id 匹配 · `__tests__/` 只留负向断言）写成 `contract/__tests__/rules.test.ts` 里的红/绿成对——把 id 写回 `contract/rules.ts` 即红，交付树上零命中
- 登记面回填义务 — checkable: 本任务源面那一次提交的 `git diff --name-only` 不含 `docs/kairos/specs/2026-11-23-engine-doc-tooling-p43-design.md` 与宪章（名册句与 P44 行的回填由编排器落地，见上方 `Produces:` 的登记面义务）
- 本 spec 验收尾改回 — checkable: 该条逐字为「引擎 vitest 全绿 · `pnpm run validate` ALL PASS · `packages/cdd-engine` 一包 changeset 取 **minor**（D74：方法论契约不变）。」——差异只在本相位自己的两处更正（`ALL PASS` 与一包），判据是与这句写定的字节比对，不与其它相位 spec 比对
- 提交（源面）— checkable: `git log -1 --format=%s` 以 `refactor(p44):` 起头——名册与注释改真、`#beginCommand` 的零重建、测试侧缝头与零残留 pin 同一提交
- 提交（文档尾）— checkable: 紧随其后的一条提交 `git log -1 --format=%s` 以 `docs(p44):` 起头，且 `git diff --name-only HEAD~1..HEAD` 只列本 spec 那一处验收尾（源面改动不跟它混在一条里）

#### Acceptance
四处源码各一条断言 + `#beginCommand` 的零重建一条 + 测试侧缝头一条；零残留 pin 的红/绿成对；本 spec 的尾与写定的那一句逐字一致；登记面两个文件在本任务源面那次提交里零改动。

#### DependsOn
5

### Task 7: 已发布死指称改真

#### Objective
`--steal-stale` 在 P30（D81）已被 `--recover` 取代，源码面的硬切 pin 扫的是源码，`docs/diagrams/src/journey.{en,zh-CN}.json` 在扫描面之外，于是退役词随 Pages 发布给消费者。改真两行（EN + zh-CN）后 `pnpm run emit` 重生 HTML。不新增扫图门：判据是派生的（那个 flag 还在吗），一次人工改真即可。

#### Files
- Modify: `docs/diagrams/src/journey.en.json`
- Modify: `docs/diagrams/src/journey.zh-CN.json`
- Generated: `docs/diagrams/journey.en.html` · `docs/diagrams/journey.zh-CN.html`（由 `pnpm run emit` 重生，不手改）

#### Consumes
- spec §6.1
- `face/__tests__/words.guard.test.ts` 的 `--steal-stale` 硬切 pin（源码面）

#### Produces
- `--steal-stale` 在 `docs/diagrams/src/` 零命中
- 重生后的 HTML 与源一致（`pnpm run emit:check` fresh）

#### Steps
- 改真两行 — checkable: 两张图源的接管句读作 `--recover`，句义不变
- 重生 — checkable: `pnpm run emit` 后 `pnpm run emit:check` exit 0
- 零残留 — checkable: `--steal-stale` 在 `docs/diagrams/src/` 零命中（历史文档面不追改）
- 提交 — checkable: `git log -1 --format=%s` 以 `docs(p44):` 起头

#### Acceptance
两张图源各一条断言 + `emit:check` fresh；历史 spec/plan 的引用保持原样（记录面）。

#### DependsOn
6

### Task 8: changeset 与收尾校验

#### Objective
按 D74 记 `packages/cdd-engine` **minor** 一包（`packages/kairos/` 在本相位零字节改动，不开第二个包），摘要点名两件事：接手授权的双条件、`single-home` 退役。然后跑全量门，把「绿」落在证据上。

#### Files
- Create: `.changeset/p44-takeover-surface.md`

#### Consumes
- Tasks 1–7 的交付面

#### Produces
- 一条 changeset：`@oscaner-skills/cdd-engine: minor`
- 全量门的退出码证据（`pnpm run validate` · `emit:check` · 引擎套件）

#### Steps
- 写 changeset — checkable: 文件含 `"@oscaner-skills/cdd-engine": minor`，且不含 `kairos`
- 跑全量门 — checkable: `pnpm run validate` exit 0，且输出含 `emit:check` 与 `version-sync` 两段
- 引擎套件计数 — checkable: 套件数与 Task 5 的退役后计数一致（无 skip 掩盖）
- 提交 — checkable: `git log -1 --format=%s` 以 `chore(p44):` 起头

#### Acceptance
`pnpm run validate` exit 0；changeset 一包 minor；树干净。

#### DependsOn
1, 2, 3, 4, 5, 6, 7

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-25 | 首稿：八个任务四波（Wave 1 = T1 · T4 · T5 无依赖；Wave 2 = T2 · T3 · T6；Wave 3 = T7；Wave 4 = T8）· 每任务一条可判交付物 · 依赖图与 spec 的六项逐项对应；T7 串在 T6 之后（同批文档面改真按登记面先行），四波均不超三个任务 | Oscaner M. · Claude（kairos:cdd-plan） |
| v0.2 | 2026-11-25 | 计划期 backfill（用户补入 ⑦）：`cl:own-document` 折进 T4（同一提示面 `render/templates.ts`），T4 改名为「提示面：评审问句与写权纪律」——单开一个任务会让第二波变四个，与 `wave-width-at-most-three` 相撞；任务数与四波形状零变 | Oscaner M. · Claude（kairos:cdd-plan 计划期回填） |
| v0.3 | 2026-11-25 | 首轮 plan 评审整改（F1–F10）：T4 的 `cl:own-document` 写面改为按模式点名（implement 取 brief 的 `### Task N:` 任务文件），成对臂换成三臂；T3 补镜像混合态臂（plan 不在而目录在）；T2 的 `in-flight:` 行只证 tree-clean 已过，并补 legs ②③ 的第五臂；T6 把登记面（P43 spec §4.2 与宪章 P44 行）改为编排器回填义务、补 `#beginCommand` 零重建与测试侧缝头两步、零残留 pin 落到 `contract/__tests__/rules.test.ts`、验收尾改成对写定句的字节比对 | Oscaner M. · Claude（kairos:cdd-plan 修复轮） |
| v0.4 | 2026-11-25 | 二轮 plan 评审整改（F1–F7）：T1 的产出从单一布尔改成逐格读数（`targetGone.plan` · `targetGone.workspace`，折叠谓词由两格派生），T3 的渲法与两处混合态臂改读这两格；T3 的 `Words.inFlightBlocked` 定下第三参（可选·活口优先）与 `#renderHeld` 的两参零字节，并补「活口优先」臂；T3 与 T4 补上 stale 行 pin 与 `$version` pin 两个写面内的文件；T5 补三处测试模块头的改真；T6 的源码面四处 checkable 改按每处实际带的东西陈说；T4 的 S5 归回 spec §5.1 的原句，T3 的 `Consumes` 点名两条验收，T6 的登记面步骤只留负向半 | Oscaner M. · Claude（kairos:cdd-plan 修复轮） |
| v0.5 | 2026-11-25 | 三轮 plan 评审整改（F1–F5）：T1 把 `face/__tests__/board-view.test.ts` 收进写面、把 `held` 字面量的补齐单写成一步（新成员必填，`tsc` 在 Wave 1 收口）；T4 的 `cl:own-document` 把 review 轮写成零代码写面（与同一提示的 `Read-only` 句同读），写面名回到 implement · fix · docs-fix 三个，成对臂补第 4 条 review 外壳臂；T6 的名册语句按处拆开（三个形状 id 只钉 `contract/invariants.ts` 的名册行，`contract/rules.ts` 的括注只掉 `single-home`、取负向断言）；T3 补 `Words.inFlightTargetGone` 裸行渲染器，board 行与 dry-run 提示改读它；T1 · T5 · T6 的提交类型改成 `feat` · `refactor` · `refactor` 加 `docs`（T6 拆两条提交）；另：T2 的验收从五条 pin 改成六条、T5 补注册表注释 scope 计数的改真一步 | Oscaner M. · Claude（kairos:cdd-plan 修复轮） |
| v0.6 | 2026-11-25 | 四轮 plan 评审整改（F1 · F2，另一条笔记）：T2 补「非折分支不夺判决」——`structure !== null` ∧ leg ① 未折即返回 `allowed`，`blocked` / `RECOVER_NOTHING` 只留结构门放过的树，`#recoverRun` 入参多一格结构事实，并补活 holder 与脏树两条 CLI 臂；T3 把 `Words.inFlightTargetGone` 的契约改成整条裸行（读出不在的那几格子句 + `--recover` 接管句，持有格零输出），四个读者一并点名（`PreFlight.#inFlightRow` 也走它），补每面一条字节臂与镜像混合态的零子句断言；T4 的 `#CLAUSES` 改回树上的 `CLAUSES` | Oscaner M. · Claude（kairos:cdd-plan 修复轮） |
