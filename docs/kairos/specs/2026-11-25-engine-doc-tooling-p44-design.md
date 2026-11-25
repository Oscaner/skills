---
title: '引擎接手面收口 — Phase Spec'
doc-type: phase-spec
version: v0.4
date: 2026-11-25
slug: '2026-11-25-engine-doc-tooling-p44-design'
program: 2026-10-10-engine-doc-tooling
author: '[human] · Claude Opus 5（kairos:cdd-design · 用户裁定 A「接手绑定 in-flight 门」+ 只记不判）'
---

## Design

本相位收三条缺陷与三笔记录面欠账，判据是同一个：**一个事实只能被它自己的判据授权**。①② 是同一条边界的两个方向：把「树」的事实挂在「文档」的判决下，于是文档门的拒绝撤销了树的清理；一个已经判得出来的形态没有被命名，于是操作者拿到的是「也许还活着」的报文。③④⑤ 则是反向的克制——读数与指称物脱钩这一类**不立新门**，只用问句与一次派生改真承担。⑥ 是一条判据用了**代理而不是派生**，于是 13 份文档各写一种说法，最终整条退役。

### 1. 判据：授权面划宽与判据面划错是两件事

#### 1.1 缺陷链路：树的清理被文档的判决撤销

实测（github#520）：一条 P39 的 fix 记录，`pid` 早已不在，它指向的 plan 不在树上，它 slug 的 workspace 目录也不存在。带 `--recover` 的评审被 doc-contract 拒，记录原样留下；修好文档再带 `--recover` 才被释放。中间忘带一次，引擎回「`--recover` has nothing to take over」——那一次它说的是对的，因为记录已释放。

成因不是记账，是**授权面**。`face/cli.ts#Cli` 的派发路径顺序是：`vet()`（九门，含 doc-contract）→ `structureRefusal(preflight)` → `structure === null` 时才判 `#recoverRun`。in-flight 门在 `--recover` 下对 stale 记录**放过**（`session/preflight.ts#PreFlight.#inFlightRefusal` 在 `alive === false ∧ recover` 时返回 null），可后续任何一门拒绝就让 `#recoverRun` 整段不执行，`foldAbort` 也就没跑。

两类事实因此被混在一处：in-flight 记录说的是**这棵树**有没有人拿着；doc-contract 说的是**这份文档**能不能派发。后者拒绝前者，等于让「文档不合格」变成「树仍然被持」。这不是保守，是把清理权交给了与它无关的判决。

#### 1.2 边界：机械面只许判派生

本条同时是 #521 的判据。一个读数能机械化当且仅当它**从表里算出来**（`CRITERIA_ROWS.length` 这一类派生）；「数字数的那几条还在不在」没有唯一来源可判，`measure-literal` 与 `pin` 已经用整条退役教过一次。本相位因此只允许两类新增判据：两条存在性读取（§3.1）与一次派生改真（§6.1）。任何「读数的内容是否与枚举一致」的尝试都不立项。

### 2. 接手授权面收窄（github#520 ①）

#### 2.1 leg ① 绑 in-flight 门

`#recoverRun` 的两条腿授权条件不同，把它们拆开：**leg ①**（abort 腿：接手被杀轮次的记录，`face/lifecycle.ts#CliLifecycle.foldAbort`）的授权条件是 **in-flight 门自己的放过判定**——门判 stale（`alive === false`）且本次调用带 `--recover`，这条腿就成立，与后续门是否拒绝无关。

判据形态：in-flight 门的判定结果（`session/preflight.ts#PreFlightVerdict` 携带的 in-flight 状态与 `checked` 行）已经是 `#recoverRun` 的输入，不再需要从「整段结构腿是否通过」反推。这是把已有事实直接读出来，不新增判定。

#### 2.2 legs ②③ 仍守结构腿

supersede 戳与 `N+1` 派发仍守 `structure === null`。它们改的是**文档的账**（把旧评审标成 superseded 并派发下一轮），文档门拒绝时不做才是对的。

#### 2.3 不改的东西

`vet` 的门顺序与「第一拒绝者拥有判决」不变；in-flight 门仍只判不写（`session/preflight.ts` 的只读纪律不破）；`acquire` 仍是真实派发的唯一写点；`foldAbort` 仍写那条 abort 账（`face/lifecycle.ts#AbortFold.bookedOf` 的 op/cycle/attempt/`dispatchBase` 逐字来自记录），因为**被杀的那一轮确实什么都没产出**——记账正确，被拒的是随后那一次派发，不是它。

### 3. `stale holder, target gone` 成为可判形态（github#520 ②）

#### 3.1 判据：记录自带的两条存在性事实

记录自带两条不需要读进程就能判的事实：`session/inflight.ts#InFlightRecord.plan`（repoRoot 相对路径，可判存在性）与 `InFlightRecord.slug`（其 workspace 目录可判存在性）。记录**带哪条事实才判哪条**：`plan: null` 的面（spec / branch 评审）没有 plan 事实，只判 workspace 目录一条；两条都带且都不成立时由一句话一并写出；任一条成立即不是残骸。两条都不成立时，这条记录**确定**是残骸，报文却与「进程刚死、目标还在」共用一句。

`session/inflight.ts#InFlight.inspect` 的 `held` 分支因此新增一个 `targetGone` 事实（由上述两条存在性读取得出），`InFlightState` 的语汇不变——它仍是 `held`，因为形态学（谁是接手候选项）不该分叉：stale 记录的接手路径只有一条。

#### 3.2 三面同词表

`face/words.ts#WORDS.inFlight` 新增一行 `targetGone`，带两个占位符分别命名「它主张的 plan 不在了」与「它的 workspace 目录不在了」；两条同时成立时由同一句一并写出，**一个事实一种拼写**。三个观测面读同一行字：`session/preflight.ts#PreFlight.#inFlightRow` 的 `in-flight:` 行、`face/words.ts#InFlightWords.inFlightBlocked` 的阻断报文、`face/board-view.ts#BoardView.inFlightRows` 的 board 行。不允许某个面复用 `stealable` 的旧句——那正是两面说法不一的开端。

#### 3.3 处置不变：不自动释放

`--recover` 仍是唯一接手路径，flag 永不越过 `alive === true`。目标已消失**不**自动释放：`plan` 是 repoRoot 相对路径，跨 worktree 或一次中途重命名都能让一条活着的记录看起来「目标不在」，自动释放会把并发的第二次派发放进来。第四态只把确定性写进报文，不改处置。

### 4. 读数与指称物脱钩：只记不判（github#521）

#### 4.1 记录面

`docs/kairos/overalls/2026-10-10-engine-doc-tooling-overall.md` 的决策表 D102 登记「机械面只许判派生，读数与指称物的脱钩由评审面承担」，判据正文见 §1.2。

#### 4.2 评审面问句

`contract/review-criteria.ts#LENS_QUESTION_ROWS` 的现成 `spec-consistency` 行（它已问「两处是否把同一事实说成两种」）扩写一句——文档给出一个读数时，问它数的是哪几条、那几条还在不在树上；读数与枚举脱钩是这条问句的答案，不是一条新判据。

#### 4.3 不新增 lens 标签

`render/templates.ts#REVIEWS.spec.lensEnum` 不变（`completeness | consistency | clarity`）。新增标签要付「谁来核」的账，而 D101 已经判过一次：没有唯一来源可判的判据，上线即空转。

### 5. 上游 review lens 借鉴（用户补入）

#### 5.1 逐条比对

对 superpowers 与 mattpocock-skills 各 review type 的 lens 逐条比对实况，五条候选里有两条**早已在树上**（`render/templates.ts#CALIBRATION_TAIL` 同句携带 S1「silence is not permission」与 S2「declined to judge」——它是纯 prompt 文本，不需要 review draft 的槽位），故本相位的借鉴面收窄为两条缺失项：

| 候选 | 来源 | 实况 | 处置 |
|---|---|---|---|
| S1 spec 的沉默不是许可 | superpowers `code-reviewer.md` | 已在 `CALIBRATION_TAIL` | 零动作 |
| S2 declined-to-judge 清单 | 同上 | 已在 `CALIBRATION_TAIL` | 零动作 |
| S3 Fowler 12 味 baseline 全枚举 | mattpocock `code-review` | 缺 | **不取**：`biome` 已管住其中数条，全枚举是每轮评审恒付的 prompt 税 |
| S4 需求看着实现了、实现看着不对 | 同上 | 缺（`spec-lens` 现只问「是否偏离契约」） | 扩写 wave/branch 共享的 `spec-lens` 问句行 |
| S5 不跨轴重排 | 同上 | 缺（尾句只讲同级缺陷保持同档） | `CALIBRATION_TAIL` 加一句：多轴分别报，禁止合并成一个「最严重」 |

#### 5.2 只收判据、不收流程

不引入 subagent 编排（引擎本来只派一个 child），不引入 `blocker`/`warn` 两档之外的新分级。

### 6. 已发布死指称改真

#### 6.1 判据与改法

`--steal-stale` 在 P30（D81）已被 `--recover` 取代，源码面有硬切 pin（`face/__tests__/words.guard.test.ts` 的零残留断言）。但该 pin 扫的是源码面，`docs/diagrams/src/journey.en.json` 与 `journey.zh-CN.json` 在扫描面之外，于是退役词仍随 Pages 发布给消费者：

> "…the in-flight holder is gone, and `--steal-stale` is the only takeover"

改真两行（EN + zh-CN）后由 `pnpm run emit` 重生 HTML。**不新增扫图门**：判据是派生的（那个 flag 还在吗），一次人工改真即可；把图源也纳入扫面是把「没有唯一来源」的账再欠一遍。

### 7. 失败面与接受的代价

#### 7.1 接受的代价

**被拒的派发仍写一条 abort 账**：leg ① 成立即接手，接手即记账。代价是一条 `interrupted` 记录可能对应一次随后被拒的派发；接受，因为被杀轮次的零产出是真的，而记录被清也是真的。

**第四态可能误报**：`plan` 暂时不在树上（跨 worktree、中途重命名）会让一条**活着**的记录读到 `targetGone`。接受，因为 liveness 仍是 `alive` 优先的判定（`alive === true` 时报文走 `held` 的活口），且处置不变，误报只影响措辞而不影响任何放行。

**`--dry-run` 的语义不变**：预览面把 `--recover` 归空（`recover` 是组合根的单一派生值），因此预览永不接手；它在 `in-flight:` 行上看到第四态、在阻断报文上看到同一句字，退出 1，零写入。

#### 7.2 不做

不新增门、不新增 lens 标签、不新增分级档、不新增语料臂；`vet` 的门顺序与 `next:` 路由零变。

### 8. `single-home` 退役：代理不是派生

#### 8.1 缺陷：它用相似度算「是不是同一条判据」

`single-home@Sentence` 的判据形状（`contract/invariants.ts#SingleHomeInvariant` + `SentenceIndex`）：左域是被判文档的**决策面**句子，右域是**其它所有文档的所有散文句**，归一化后取字符 3-gram，Jaccard ≥ 0.6 且正文 ≥ 40 字即判「这两句说的是同一条判据，住了两处」。

它判的是一个真实的关系（重复判据会漂移），这是它该在 P43 活下来的理由。它还有一条常被误读的豁免：**同 slug 的兄弟文档不比较**——代码注释写明「a design's spec and plan are the two faces of one document」，所以「spec 与 plan 讲同一个事实的不同面」从来不是它要拦的东西。

问题在于**它用相似度代理「是不是同一条判据」**，而这个判断没有唯一来源：

- **误报**：按构造必然重复的模板文本。phase-spec 的验收尾在实测 13 份 spec 里各住一份，于是门只接受改写措辞；
- **漏报**：它自己写着 "catches copying, not paraphrase"——换个说法就过；
- **解药即病**：它的修复建议是「把判据留在一处，另一处指过去」，逼作者改写**真句子**，产出内容相同、措辞各异的副本——正是它要治的漂移。13 份 spec 13 种写法，是这条规则自己制造的。

按 D102（机械面只许判派生）量：**代理不是派生**。这是 D103 的原始现场。

#### 8.2 退役面与承接

- **删**：`contract/rules.ts` 的 `single-home` 规则行；`contract/invariants.ts#SingleHomeInvariant` 与 `SentenceIndex` 整组（含 `MIN_LENGTH` / `THRESHOLD` / `isWorkItem` / 3-gram 比较面）。形状门**五 → 四**。
- **留**：`spec-consistency` 的 lens 问句不动——重复判据的**危害是漂移**，那条问句直接判漂移（"Do two places state the same fact differently…"），比判「文本像不像」更贴。
- **约定**：`AGENTS.md` 的「One home per rule」保持为写作约定（从第二处链接过去），不设门。
- **本 spec 的验收尾**：现为绕门而改写的版本；退役落地后**改回统一措辞**（它是这条规则的自证现场，退役后无需豁免）。


### Acceptance criteria

- `--recover` ∧ doc-contract 拒绝的端到端：记录被接手清除，abort 账恰一条 `interrupted`，随后同一命令不带 `--recover` 即可派发。
- 活 holder（`alive === true`）在任一后续门拒绝下仍不被位移：`--recover` 不越过活口，行为 pin 覆盖「in-flight 门放过 ∧ doc-contract 拒绝」与「in-flight 门拒绝」两条路径。
- legs ②③ 仍守 `structure === null`：文档门拒绝时不写 supersede 戳、不派 `N+1`。
- `--dry-run` ∧ stale 记录：零写入（`git status --porcelain` 前后为空），`in-flight:` 行显示第四态，退出 1。
- 第四态的判据与拼写：`plan` 不在树上、workspace 目录不存在两条事实各自可判，两条同时成立时一句话写出；`checked:` 行、阻断报文、`cdd board` 三面读同一行字（零 `stealable` 旧句残留）。
- `LENS_QUESTION_ROWS` 的 `spec-consistency` 行携带读数指称问句；`REVIEWS.spec.lensEnum` 零新增标签；`LENS_QUESTIONS.forReviewKind("spec")` 行数不变。
- `CALIBRATION_TAIL` 携带「多轴分别报、禁止跨轴重排」一句；`REVIEWS.wave` 与 `REVIEWS.branch` 的共享 `spec-lens` 行携带 S4 问句。
- `--steal-stale` 在 `docs/diagrams/src/` 零命中；`pnpm run emit` 后 `emit:check` fresh。
- 决策表 D102 与 D103 在册；charter 的 Phase inventory 表头不再引用已退役的 `phase-inventory.guard.test.ts`。
- `single-home` 零残座：`contract/rules.ts` 规则行 · `contract/invariants.ts#SingleHomeInvariant` 与 `SentenceIndex` 整组删除 · 零残留 grep pin · `cdd review` 不再产出 `single-home@*` finding。
- `spec-consistency` 的 lens 问句保留（重复判据的危害由它判）；`AGENTS.md` 的「One home per rule」写作约定不动；本 spec 的验收尾改回统一措辞。
- 引擎套件全绿 · `pnpm run validate` exit 0 · 两包 changeset 取 **minor**。

## Constraints

- **`--recover` 是唯一接手路径**：目标已消失不构成自动释放的理由；flag 永不越过 `alive === true`。
- **in-flight 门只判不写**：本相位不把任何写点搬进 `session/preflight.ts`；接手与记账仍在派发路径上。
- **`vet` 的门顺序零变**：tree-clean → in-flight → plan-carrier → graph → plan-ledger → doc-contract → 四条派发前门，顺序与「第一拒绝者拥有判决」不动。
- **机械面只许判派生**（D101 · D102）：本相位新增的判据只有两条存在性读取与一次派生改真。
- **零新增 token**：不新增门名、不新增 lens 标签、不新增分级档、不新增语料臂测试。
- **代理型判据零新增**（D102 · D103）：判据只许建立在有唯一来源的事实上；相似度代理不算判据。
- **不发布**：changeset 归并落 pending，两包 minor（D74）。

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-25 | 首稿：① 接手授权面收窄（leg ① 绑 in-flight 门 · legs ②③ 仍守结构腿）· ② `stale holder, target gone` 第四态（三面同词表）· ③ #521 只记不判（问句挂 `spec-consistency`）· ④ 上游借鉴收窄到 S4 + S5 · ⑤ 已发布死指称 `--steal-stale` 改真 | Oscaner M. · Claude（kairos:cdd-design → cdd-spec-writer） |
| v0.2 | 2026-11-25 | 首轮评审的 `doc-contract` 拒绝整改（F1–F2）：① 设计面按生成骨架补两级项标题（`### N.` 组 + `#### N.M` 项 · `presence@#### N.M item heading`）；② 验收末条改用 ` · ` 分段并改写开场，脱离 P12/P13/P14 的同句（`single-home@Sentence`）。内容零变更 | Oscaner M. · Claude（kairos:cdd-spec-writer 修复轮） |
| v0.3 | 2026-11-25 | 需求面回填 ⑥（用户裁定）：`single-home` 的域收窄——验收尾升为 `render/skeleton.ts` 的声明片段、`SentenceIndex` 按恒等豁免（§8）；§3.1 补「记录带哪条事实才判哪条」（活证据：被砍的评审轮留下 `plan: null` 的 stale 记录）；验收格增两条、约束格增一条 | Oscaner M. · Claude（kairos:cdd-spec-writer 回填） |
| v0.4 | 2026-11-25 | ⑥ 改判（用户裁定 · 退役而非收窄）：§8 重写为「代理不是派生」——`single-home` 整条退役，形状门五→四；v0.3 的声明片段方案作废（它只是为让代理不误报而存在）。退役理由入 D103；验收格与约束格同步，§3.1 / ①–⑤ 零动 | Oscaner M. · Claude（kairos:cdd-design 改判） |
