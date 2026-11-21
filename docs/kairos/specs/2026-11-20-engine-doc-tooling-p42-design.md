---
title: '评审面的两档收口 — Phase Spec'
doc-type: phase-spec
version: v0.1
date: 2026-11-20
slug: '2026-11-20-engine-doc-tooling-p42-design'
program: 2026-10-10-engine-doc-tooling
author: "[human] · Claude Opus 5（kairos:cdd-design · grilling Q1–Q3 落定）"
---

## Design

`nit` 跨过两个相位，却从未有过权力：`session/handoff-schema.ts#rollup` 只数 blocker，`warn` 与 `nit` 到达同一个结论。第三档唯一在场的语义是跨轮降级记账（`#tierRankOf` 的三级阶梯），而它在两档下同样成立——`blocker` 降到 `warn` 就是一次降级。故词表收两档，`nit` 承载过的观察改走载体已有的 `notes` 槽；同批把任务块的两条结构判据立为门。

### 1. 档位收口

#### 1.1 `rollup` 数档位，结论对 warn 逐字节不变

- `session/handoff-schema.ts#rollup` 从「findings 非空」改为按档位判：`blocker` 命中 ⇒ `CHANGES_REQUESTED`；`warn` 命中 ⇒ `REVIEW_FIX`；零 finding ⇒ `APPROVED`。**对既有 `warn` 的行为逐字节不变**——这条是守恒臂，不是新语义。
- 改变的只有词表：`session/ledger.ts#FindingSeverity` 与 `contract/review-criteria.ts#CriteriaTier` 都收成 `blocker` / `warn`，载体的 `severity` 枚举同批收缩。存量载体与侧车不在迁移面——`nit` 的写者只有 review 的 child，本相位之后不再有写者。
- 破坏性字节登记三处：`severity: "nit"` 的载体被拒（`contract-violation`，报文点名取值集）· `contract/review-criteria.ts#TIER_ORDER` 的取值集 · review 指令里 `warn/nit → REVIEW_FIX` 那句。三处都走 changeset minor（D74）。

#### 1.2 删档不删行

- `contract/review-criteria.ts#CRITERIA_ROWS` 保持 `census:criteria.rows = 6` 行——删的是档，不是行。两条 `nit` 行改判 `warn`，正文重写成「这条观察该去哪」：
  - `expression-only`：从「pure expression 是 nit」改写为「纯表达的观察进 `notes`，留在 findings 里的必须点名它改变了哪一项判断」。`duty` 从「欠一句为什么不是 warn」改为「欠一句它改变的那项判断」。
  - `regrade-mark`：教学保留（降档要写理由），结论不变——标记是展示事实（`face/board-view.ts#BoardView.regradeNoteOf` 与 capsule 那一行），不是一条 finding。
- `contract/review-criteria.ts#TIER_ORDER` 收成 `blocker` → `warn`；`contract/review-criteria.ts#CriteriaRegistry.renderRubric` 的「每档至少一行」保持抛错语义，抛错面变两档——出现第三档即抛（成对臂：一份带 `nit` 行的注册表在该用例上必红）。
- `#tierRankOf` 收成两端；降级检测的判词从「低一档」变成「低一档——唯一的一档」，`regradeNote` 的两个调用点（`face/lifecycle.ts` · `face/board-view.ts`）不动。

### 2. `notes` 转正

#### 2.1 承载面：下一轮 brief 与板面轮次块

- `session/handoff-schema.ts#CARRIER` 的 `notes` 槽从「声明但无人读」升为承载面：**本线下一轮**的 brief 里出现，且 `face/board-view.ts` 的轮次块里出现（计数与逐条）。
- 不进 `rollup`：一条 note 不改变结论、不产生 fix 需求、不欠 `dispositions`。转正的是「可读」，不是「可判」。
- **不跨线**：note 不继承到下一条线，因为它的引文指向本线那份文档的具体一句。
- brief 的承载不新起 token：`notes` 从上一轮载体读，与 brief 的既有装配同源，P38 的派发输入表零新增行。这是范围收窄不是遗漏——新 token 会让每条派发线都欠一个值。

#### 2.2 引擎自己不搬进 notes

- 降档标记（`contract/review-criteria.ts#regradeNote`）保持展示事实；`face/lifecycle.ts` 注入的 pin 违约 finding 保持 `warn`。两条都不搬进 `notes`——一个是标记、一个是真断言，搬任一都会把「可判」与「可读」再混一次。

### 3. 任务块判据

#### 3.1 `Create:` 唯一且最早

- 读面：`contract/pins.ts#ForwardPaths` 已按行扫 `- Create:`，扩出 `Modify:` / `Test:` / `Delete:` 三类是同一处的动词集扩展，不新起第二个扫描器。
- 判：同一路径的 `Create:` 声明恰一条，且其任务号小于该路径任何其他声明行所在的任务号。
- 为什么不是「同一路径出现两次」：`Create:` 之后 `Modify:` 是正常增量结构（一个任务建文件、后一个任务加功能），判死它会让模板本身成为违例。判据因此是**唯一性与顺序**，不是重复次数。
- 两类违约共用一条判据行的两个臂：双 `Create`（两个任务都声称建它）与 `Modify→Create`（后一个任务建一个前一任务已改的文件）。报文点名两个任务号与那条路径。

#### 3.2 悬挂与成环

- 读面：`contract/task-blocks.ts#TaskBlock.fields` 的 `DependsOn` · `Consumes` · `Produces`。
- 悬挂：`Consumes` / `Produces` 的行带 `（Task N）` 标记而 N 不在已声明任务号集 ⇒ 报 `dangling-task-ref`。**无标记的行跳过**——与 `temporal-indicator` 同一纪律：无候选即不裁决，散文不因形似而被判。
- 成环：`DependsOn` 是声明的单号，构成函数图；出现环 ⇒ 报 `depends-on-cycle`，报文给环的路径。
- 两条判词各占一条规则行（档位可各自不同），落同一个不变量类；两条都不动 `contract/declare.ts` 的 `#### DependsOn` 取值域——本相位判的是图的性质，不是字段的形状。

### 4. 消费面

- 三处已发面同批改写，`nit` 零命中：`packages/kairos/skills/cdd-spec-writer/SKILL.md` · `packages/kairos/skills/cdd-plan/SKILL.md` · `render/templates.ts#REVIEWS` 的 review 指令（现写死 `warn/nit → REVIEW_FIX`）。
- brief 的 notes 段是一句指令级说明（上一轮的可读观察、不欠动作），不复制板面的逐条形态。
- changeset 两包 minor：`cdd-engine` 与 `kairos`。

### Acceptance criteria

- **A1 · 档位词表**：`FindingSeverity` 与 `CriteriaTier` 的取值集恰为 `blocker` 与 `warn`；一份 `severity: "nit"` 的载体被拒，报文点名这两个取值。成对：同一份载体把该值改 `warn` ⇒ 接受。
- **A2 · 结论三臂**：空 findings ⇒ `APPROVED`；仅 `warn` ⇒ `REVIEW_FIX`；含 `blocker` ⇒ `CHANGES_REQUESTED`。三臂共用一份夹具的三种填法，且 `warn` 那一臂的报文逐字节等于本相位之前的同一份夹具。
- **A3 · 判据表不动行**：`CRITERIA_ROWS` 的行数等于 `census:criteria.rows = 6`，两条原 `nit` 行读 `warn` 档；`census.guard.test.ts` 对这条 id 零失配（这是核对，不是改动面）。
- **A4 · 渲染两档**：`renderRubric()` 的产物含两段且只含两段；一份注册表带着 `nit` 行 ⇒ 抛错。成对：同一份注册表删掉那一行 ⇒ 正常渲染。
- **A5 · 降级可记**：上一轮 `blocker`、本轮同一条 `warn` ⇒ `regradeNote` 给出标记；上一轮 `warn`、本轮 `warn` ⇒ 无标记（成对：只改本轮那一档）。
- **A6 · notes 可读**：一条 note 进载体后结论不变（空 findings ⇒ `APPROVED`），本线下一轮 brief 与板面轮次块各出现它一次；删掉该条 ⇒ 两处都不出现。成对臂只改这一条 note。
- **A7 · notes 不跨线**：同一份载体进入下一条线的首轮 ⇒ brief 与板面都不读它；同一份内容放进本线下一轮 ⇒ 两处都读（成对：只改线）。
- **A8 · `Create:` 判据**：任务 3 `- Create:` 而任务 5 `- Modify:` ⇒ 零拒绝；两个任务都 `- Create:` ⇒ 报；任务 3 `- Modify:` 而任务 5 `- Create:` ⇒ 报。三条夹具只有任务号与动词不同。
- **A9 · 任务图**：`（Task 42）` 指向不存在的任务 ⇒ 报 `dangling-task-ref`；同一行去掉标记 ⇒ 零拒绝；`DependsOn` 成环 ⇒ 报 `depends-on-cycle`；无环链 ⇒ 零拒绝。
- **A10 · 消费面零残留**：三处已发面里 `nit` 零命中，review 指令只写两档。
- **A11 · 全量门**：`pnpm run validate` 退出码为零。

## Constraints

- **引擎只拒不改**：任何拒绝都不移动、不改写、不删除文档；恢复归编排器。
- **单事实单份**：档位词表住 `contract/review-criteria.ts` 与 `session/ledger.ts` 各一处，`face/` 不新起第二份；任务图的读面沿用 `contract/task-blocks.ts` 与 `contract/pins.ts` 既有两处。
- **消费面守恒**：`next:` 字面 · 退出码 · `CDD_BLOCKED` 通道 · 既有拒绝报文逐字节不变。§1.1 登记的三处破坏性字节是唯一的例外，且一律 minor。
- **新判据 warn 起步且必须自毁**：`single-create` · `dangling-task-ref` · `depends-on-cycle` 三条规则行起步 `warn`，本相位末任务同批翻 `block`，pin 断言「无一规则声明 warn」在翻位后为真。过渡值不留在闭合态。
- **不动的面**：P37 的判档本体（本相位改档数不改边界）· `contract/declare.ts` 的字段取值域 · 载体与侧车的存量迁移 · 派发输入表的行集。
- **不做**：从散文抽宾语（`owner-less`）· 差分恒真 · `<!-- non-normative -->` 段落标记。三条都属于另一类缺陷——评审读不懂语义，而本相位只判形状。

## Change history

| Version | Date | Change | Owner |
|---|---|---|---|
| v0.1 | 2026-11-20 | 首版。三笔：档位收两档（词表与判据表同批）· `notes` 转正为承载面（brief 与板面）· 任务块两族判据（`Create:` 唯一且最早 · 悬挂与成环） | Oscaner M. · Claude（kairos:cdd-design） |