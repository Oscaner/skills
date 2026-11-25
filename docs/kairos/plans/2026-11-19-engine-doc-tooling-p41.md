---
title: 'P41 · 文档声明的机检面：形状门 + 证据面 + 一份住所'
doc-type: plan
version: v0.18
date: 2026-11-20
slug: 2026-11-19-engine-doc-tooling-p41-design
base: develop
---

## Constraints

- 六条规则行一律 **warn 起步**，翻位是 Task 8 的最后一个动作；pin 断言「无一规则声明 warn」在翻位后为真。
- **一处定义**：规则行只住 `contract/rules.ts#RULE_REGISTRY`，面图只住 `contract/declare.ts`，判据值只住 `contract/review-criteria.ts#CRITERIA_ROWS`；`face/` 不新起第二份清单。
- **门只拒不改**：任何拒绝都不移动、不改写、不删除文档。判词是「存在一条 block 命中即拒」——只有 warn 命中的文档放行，规则自己那一行读 `warned`。
- **消费面守恒**：退出码表 · `CDD_BLOCKED` 通道 · 既有拒绝报文的前缀与字段分隔符 · `next:` 字面逐字节不变；新增形态只有三种——`<rule id>: warned — <n> warning(s)` · `skipped (closed document)` · 一条 `details` 行。
- **扫描面只读散文**：行内代码段与围栏块豁免；表格单元格照扫；引用块按行首 `>` 判定（不是树节点）。围栏跳过这一处定义住 `contract/pins.ts#PinSpans`，形状规则的散文行切分复用它，不起第二份判法。
- 本文件的正文按它自己要落的规则书写：无行号坐标、无裸测量字面（计数写成中文数词或 `census:<id> = <n>`）、无挂符号的时序指示词。
- **实现前窗口的预期红**：本 plan 是语料的一行，一处读数在实现面落地之前读红，且不随文档修正自愈——`pins.guard.test.ts` 的零命中臂：指向尚未落地符号的 pin 由 `PinAudit` 照数（审计的跳过只覆盖 `Create:` 声明的**路径**，不覆盖符号名），最后一个声明符号随 Task 5 落地——窗口也在那一处闭合，因为未解析的四个 pin 名字（`skippedClosedDocument` · `provenClosed` · `PinAudit#provenClosed` · `ForwardPaths#provenClosed`）全由 Task 5 的 Files 声明，Task 5 之后读到这条红就只能是回归。这一处是实现前的预期红，不是回归，各任务的 checkable 与 Acceptance 因此不把它纳进判据，这一处之外的读数照判。
- **窗口内不写测量值**：`census:criteria.rows` 的新值属判据行落地之后的形状，落地之前只以 `census:<id> = <n>` 的占位形态出现，本文件不写它的目标值。语料规模常量不在此列——它是判断，属同批义务，由 Task 1 复位的步骤持有。

### Task 1: 面图与严重度基座

#### Objective
让「某个节属于判据面、记录面还是登记面」成为 `contract` 平面上的一张**声明**，而不是散落在判据里的约定；同时把 `severity` 加进规则声明行与 `Finding`，使「一条规则命中时是拒还是只告警」由规则表一处给出。面图的域由一条可判公式给出：注册表里锚以标题字面起头的元素，其余元素随所在节继承角色；域内没角色即缺口，缺口本身就是判词。

#### Files
- Modify: `packages/cdd-engine/src-next/contract/declare.ts`（`### 设计决策留存` 补成一个可选 facet 元素——`anchor: "### 设计决策留存"`、`presence: "optional"`、前缀式 `valuePattern: "^### 设计决策留存"`、`home: "facet"`、`selector`，与同秩的三个 `###` facet 同形；新增面图声明 `DOC_FACES` 与它的派生 `FaceMap`）
- Modify: `packages/cdd-engine/src-next/contract/rules.ts`（`RuleDeclaration` 的两份 scope 各增 `severity` 与 `skipWhenClosed`，六条新行在后续任务里加；`RULE_REGISTRY` 既有二十六行——doc 面二十四行 · ledger 面两行——各补 `severity: "block"` 与 `skipWhenClosed: false`）
- Modify: `packages/cdd-engine/src-next/contract/invariants.ts`（`Finding` 拆成草稿与盖章两形：`FindingDraft` 是策略的返回，`Finding extends FindingDraft` 多一个 `severity`；`Invariant#finding` 与 `LedgerRuleBase#finding` 返回草稿，既有子类的局部数组随基类返回型机械改型，判据不动）
- Modify: `packages/cdd-engine/src-next/contract/judge.ts`（`Contract.policy` 收一个可注入的注册表参数并返回「声明 + 策略」的成对行，`Contract.stamped` 是**已声明规则**的唯一盖章点；`Contract.validate` 收闭合事实并在闭合时跳过 `skipWhenClosed` 的行；`#syntaxFinding` 的那条 `doc-syntax` 不属任何规则行，按既有阻断语义自行盖 `"block"`；注册表落在实例上（`#registry`），`ruleRows()` 改成读同一份的实例方法，ledger 面的 `#ledgerFindings` 同读它——注入的规则集就是判定面与 `checked:` 面共同报告的那一份）
- Modify: `packages/cdd-engine/src-next/session/preflight.ts`（`Contract.ruleRows()` 的调用点改读契约实例的 `ruleRows()`，`checked:` 面因此与判定面同源，不起第二份读法）
- Modify: `packages/cdd-engine/src-next/contract/__tests__/pins.guard.test.ts`（语料规模常量复位到批后语料文件数——本 plan 已入语料，取值 85；本相位不再新增文档，故它一次性成立）
- Modify: `packages/cdd-engine/src-next/contract/__tests__/judge.test.ts`（`Contract.policy()` 的既有读法随成对行改型——`policy()[docKey]` 的每一项由策略变成绑定，`.name` 改读 `binding.strategy.name`；`Contract.ruleRows()` 的静态读法同批改成契约实例的读法）
- Modify: `packages/cdd-engine/src-next/contract/__tests__/declare.test.ts`（注册表的元素总数期望值随那个 facet 元素加一；它按 docKey 逐项点名的那条算术行是同批义务）
- Modify: `packages/cdd-engine/src-next/contract/__tests__/selector-coverage.test.ts`（两处元素总数期望值各随那个 facet 元素加一——`expect(total).toBe(112)`；两条用例标题里的 `111` 同改；文件头注释里的那个陈旧计数是既有字面，本任务不动它）
- Modify: `packages/cdd-engine/src-next/contract/__tests__/__snapshots__/project.{schema,shape}.overall.snap`（该 facet 元素落地后这两份快照各多一条：json 面的 `properties` 与 `shape` 的 facet 组；它们由 `toMatchFileSnapshot` 重写，不手改）
- Create: `packages/cdd-engine/src-next/contract/__tests__/faces.guard.test.ts`
- Create: `packages/cdd-engine/src-next/contract/__tests__/rules-severity.test.ts`

#### Consumes
- `ElementRegistry`（既有，`contract/declare.ts`）——按 `selector` 的锚字面取域
- `Finding` / `Invariant` / `JudgeContext`（既有，`contract/invariants.ts`）
- `RULE_REGISTRY` 与 `Contract` 的判定点（既有，`contract/rules.ts` · `contract/judge.ts`）——档位在后者盖章
- `corpusOf` / `PinAudit`（既有，`contract/pins.ts`）——语料规模常量的取值来源

#### Produces
```ts
// contract/declare.ts — 一个元素一行；facet 是可选的，presence 只有 required 发骨架槽
export type DocFace = "decision" | "record" | "registration";
export interface FaceRow {
  readonly anchor: string;          // 注册表元素的 anchor——只作 ROWS 的键，不是标题字面
  readonly headingMatch: RegExp;    // 该元素的 valuePattern 编译而来；无 valuePattern 时取 selector 的标题判法，两者都无则不进 ROWS（由 gaps() 报）
  readonly docKey: DocKey;
  readonly face: DocFace;
}
export class FaceMap {
  static readonly ROWS: readonly FaceRow[];            // 注册表里锚以标题字面起头的元素，逐元素一行
  static roleOf(docKey: DocKey, heading: string, ancestors?: readonly string[]): DocFace | "unmapped";
  // heading 是标题行，不是节正文；ancestors 是它上方的标题栈（最内层在前）
  // 节名归一后按 headingMatch 逐行比：自身命中最内层的注册元素即取它的角色；自身不命中时随
  // 祖先栈里最近的注册祖先继承（`#### 7.5.1` 随 `### 7.`，`### N.` 与 `#### N.M` 随 `## Design`）；
  // 自身与祖先栈都不命中即 "unmapped"（缺口）
  static gaps(): readonly { docKey: DocKey; anchor: string }[];              // 域内无角色的元素
}
// contract/rules.ts — severity 与闭合豁免都住在联合上，两类 scope 同一处声明
export interface RuleDeclarationBase {
  readonly id: string;
  readonly docKeys: "all" | readonly DocKey[];
  readonly severity: "block" | "warn";
  readonly skipWhenClosed: boolean;   // 六条形状行为 true，既有行为 false
}
export interface DocRuleDeclaration extends RuleDeclarationBase {
  readonly scope: "doc";
  create: () => Invariant;
}
export interface LedgerRuleDeclaration extends RuleDeclarationBase {
  readonly scope: "ledger";
  create: () => LedgerRule;
}
export type RuleDeclaration = DocRuleDeclaration | LedgerRuleDeclaration;
// contract/invariants.ts — 策略交出草稿，档位只由判定点盖章
export interface FindingDraft {
  readonly path: string; readonly field: string; readonly message: string;
  readonly fix: string; readonly kind: string;
}
export interface Finding extends FindingDraft {
  readonly severity: "block" | "warn";   // 由规则声明盖章，不由策略自己填
}
// contract/judge.ts — 声明与策略成对，盖章一处，政策可注入
export interface DocRuleBinding {
  readonly declaration: DocRuleDeclaration;
  readonly strategy: Invariant;
}
static policy(registry: readonly RuleDeclaration[] = RULE_REGISTRY): Record<DocKey, readonly DocRuleBinding[]>;
static stamped(drafts: readonly FindingDraft[], declaration: RuleDeclaration): readonly Finding[];
ruleRows(): readonly RuleDeclaration[];   // 本实例的注册表——判定面与 checked: 面同源
validate(input: ContractInput, closed = false): Finding[];   // 闭合时跳过 skipWhenClosed 的策略
```

#### Steps
- `pins.guard.test.ts` 的语料规模常量复位到批后的语料文件数（取值 85），一对断言：语料文件数等于该常量 ⇒ 规模那一臂绿；把它改成批前的旧值 ⇒ 立即红 — checkable: 规模断言的期望值等于 `PinAudit.filesOf(corpusOf(root)).length` 的实测值（本步落地的取值即实测值）；该文件的零命中臂属窗口内预期红（见 `## Constraints`），不在此步判据内
- 在 `contract/declare.ts` 把 `### 设计决策留存` 补成 facet 元素（`anchor: "### 设计决策留存"` · `presence: "optional"` · `valuePattern: "^### 设计决策留存"` · `home: "facet"` · `selector: SelectorSpec.heading("### 设计决策留存")`）— checkable: 三个投影各由承载它的那一面读，不混成一处——`properties` 一臂读 `schema get overall --output json`（该命令的顶层键只有 `docType` · `$schema` · `title` · `description` · `type` · `properties` · `required`，既不带 `shape` 也不带 `slices`，另两臂因此不由它读）；`shape` 的 facet 组一臂读 `project.shape.overall.snap`（该元素的锚字面在快照里出现一次）；`slices` 一臂读 `project.test.ts` 既有的派生等式 `expect(doc.slices).toHaveLength(registry.elements.length)`（逐 docKey 成立，元素入册即覆盖，不另写一条期望值）；`--output skeleton` 的字节不变（`git diff` 对该命令输出为空）；同批的既有用例随该元素收紧——`declare.test.ts` 的算术行与两张 overall 快照一起改，`pnpm -C packages/cdd-engine exec vitest run src-next/contract` 绿
- 写 `FaceMap.ROWS`：从 `ElementRegistry` 里筛「锚以 `## ` · `### ` · `#### ` 起头」的元素，每行带该元素的 `headingMatch`（由其 `valuePattern` 编译；无 `valuePattern` 时取 `selector` 的标题判法；两者都无则不进 `ROWS`，由 `gaps()` 报出来，故没有元素能按 `anchor` 字面解析），按 §1.4 的逐 docKey 表给角色；四个 docKey 各一组 — checkable: `FaceMap.gaps()` 返回空数组；成对反证——拿掉任一域内元素的角色 ⇒ `gaps()` 非空
- 写 `FaceMap.roleOf` 的解析规则：标题归一后按 `headingMatch` 逐行比，自身命中最内层的注册元素即取它的角色；自身不命中时收第三个可选参数 `ancestors`（标题栈，最内层在前）随最近的注册祖先继承（`### N.` 与 `#### N.M` 随 `## Design`）——不按 `anchor` 的字面比，也不起第二张名单 — checkable: 一对夹具——`### Task 1: 面图` 经 `### Task N:` 元素的 `valuePattern` 解析出角色、`### 1. 形状面` 与其下的 `#### 1.1 面图是声明` 随 `## Design` 读 `decision`；把解析面换成 `anchor` 字面比 ⇒ 三条都读 `unmapped`；语料一臂——四级子标题 `#### 7.5.1` 自带读 `unmapped`，带上祖先栈（`### 7.` · `## Design`）读 `decision`，祖先栈里也没有注册节时读作缺口
- 写 `faces.guard.test.ts` 第一对用例：一份 phase-spec 夹具，同一行 `第 41 行` 只放 `## Change history` ⇒ `FaceMap.roleOf` 返回 `"record"`；同一行搬进 `## Design` ⇒ 返回 `"decision"` — checkable: 两条断言同时通过
- 写第二对：把所有列表条目与 token 类锚（`Constraint delta bullet` · `Task id token`）从 `FaceMap.ROWS` 里剔除后 `gaps()` 为空——证明它们随所在节继承角色，不需要第二张名单 — checkable: 断言 `ROWS` 里不存在 `anchor` 以 `- ` 起头的行，且 `gaps()` 为空
- 写第三对（overall docKey）：带后缀的标题 `### 设计决策留存（2026-10-10 —— 元层裁定 + 注册）` 经该元素的**前缀式 `valuePattern`** 解析出 `"registration"`，`## Constraints` 下的同一行读 `"decision"` — checkable: 两条断言同时通过；把该元素的 `valuePattern` 换成 `anchor` 字面比 ⇒ 第一臂读 `"unmapped"`
- 既有读法的随动：`judge.test.ts` 里 `Contract.policy()` 的 `.name` 改读 `binding.strategy.name`，`declare.test.ts` 的算术行与两张 overall 快照随那个 facet 元素同批更新 — checkable: `pnpm -C packages/cdd-engine exec tsc --noEmit -p .` 通过；`pnpm -C packages/cdd-engine exec vitest run src-next/contract` 绿（该命令下的四处随动文件即本步的坐标）
- `contract/rules.ts` 的 `RuleDeclaration` 两份 scope 增 `severity` 与 `skipWhenClosed`，既有二十六行（doc 面与 ledger 面各一组）一律 `"block"` 与 `false` — checkable: `pnpm -C packages/cdd-engine exec tsc --noEmit` 通过；`rules-severity.test.ts` 按一份**既有二十六行的显式名册**断言档位全为 `block`、闭合豁免全为 `false`（名册外的行不在这一臂的判据里，故后续任务新增或翻位规则行不改它）；ledger 面的两行同读
- `contract/invariants.ts` 把 `Finding` 拆成 `FindingDraft` 与 `Finding`：`Invariant#finding` · `LedgerRuleBase#finding` 返回草稿，既有子类的局部数组随基类返回型机械改型 — checkable: `pnpm -C packages/cdd-engine exec tsc --noEmit` 通过；`rules-severity.test.ts` 的草稿臂——一个测试策略经基类 `finding()` 交出的对象不带 `severity` 键
- `contract/judge.ts`：`Contract.policy` 收可注入的注册表（默认 `RULE_REGISTRY`）并返回「声明 + 策略」的成对行；`Contract.stamped` 是已声明规则的唯一盖章点（`doc-syntax` 那条由 `#syntaxFinding` 自己盖，是这一句点名的例外）；`Contract.validate` 收 `closed = false`，闭合时跳过 `skipWhenClosed` 的行；`#syntaxFinding` 的一条按既有阻断语义盖 `"block"`；注册表落在实例上，`ruleRows()` 与 ledger 面的 `#ledgerFindings` 同读它 — checkable: `rules-severity.test.ts` 第二对在**注入的注册表**上成立——一条 `severity: "warn"` 的测试规则命中时 `findings[0].severity === "warn"`，把该声明的档位改成 `block` 后同读 `block`（夹具不碰任何真实行，故 Task 8 的翻位不改它）；一份语法面夹具读 `block`；注入注册表的实例 `ruleRows()` 只回注入的那一行，无参构造回到默认注册表
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p41):` 起头

#### Acceptance
`FaceMap.gaps()` 在四个 docKey 上为空，且缺口可被成对反证（拿掉一个域内元素的角色即非空）；解析面是元素的 `valuePattern`/`selector` 而非 `anchor` 字面——`### Task N:` · `### N.` · `#### N.M` 与带后缀的 `### 设计决策留存（…）` 都解析出角色（各有一对夹具，换成字面比即读 `unmapped`），无 `valuePattern` 也无标题判法的元素不进 `ROWS` 而落进 `gaps()`；自身不命中的标题随祖先栈里最近的注册祖先继承（`#### 7.5.1` 一臂），祖先栈里没有注册节时读作缺口；面图对同一行文案在两个节里给出两个角色（成对），overall 上 `## Constraints` 与登记面各一角色（成对）；`ROWS` 里没有以 `- ` 起头的 anchor，故列表条目与 token 类锚没有第二张名单；该元素的三条投影各增一条，且各由承载它的那一面读（`properties` 读 `schema get overall --output json`、facet 组读 `project.shape.overall.snap`、`slices` 读 `project.test.ts` 的派生等式），`--output skeleton` 的字节逐字节相同；策略交出的是 `FindingDraft`（无 `severity` 键），`Finding.severity` 只由 `Contract.stamped` 盖，且政策可注入——一条 `warn` 测试规则在注入注册表上读 `warn`、声明改 `block` 后读 `block`，语法面的一条按既有阻断语义盖 `block`；`Contract.stamped` 的独占性只对已声明规则成立——`doc-syntax` 由 `#syntaxFinding` 自盖；注入的注册表就是 `ruleRows()` 报告的同一份（判定面与 `checked:` 面同源），既有二十六行按显式名册读 `block` 与 `false`；语料规模常量等于批后语料文件数；既有 `Contract.policy()` 读法改读 `binding.strategy.name` 与契约实例的 `ruleRows()`，`declare.test.ts` 的算术行与两张 overall 快照随那个 facet 元素同批更新；身份面回归那一对住在既有的 `contract/__tests__/doc-body.test.ts`——它判「追加一条历史行并 bump 版本 ⇒ `doc-revision` 摘要逐字节不变」与「判据面改一个词 ⇒ 变」，本任务只把这处坐标写进判据面，不为身份面新增用例。

#### DependsOn
none

### Task 2: 四类可变量的规则行

#### Objective
把「判据面不得出现四类可变量」落成四条规则行：`measure-literal` · `line-coordinate` · `live-arithmetic` · `temporal-indicator`。每一类都是一条 **token 文法**，不是一条语义分类——机器没有「这条断言是否关于活的树」的分类器，所以判据只能是形状。扫描面只读散文：行内代码段与围栏块豁免，表格单元格照扫。

#### Files
- Modify: `packages/cdd-engine/src-next/contract/invariants.ts`（四个新 `Invariant` 子类 + 散文行切开基元 `ProseLines` + 两形共享面：`ProseLines` 只做切行与行内代码段剥离，围栏跳过调 `contract/pins.ts#PinSpans`；`ProseWalk.of` 是标题栈走读，交出带 `role` 与 `heading` 的条目，四条文法与 `SingleHomeInvariant` 同读它，故它是这一族的真实共享面而不是某一形的内部细节；`ProseFace.judge` 是四条文法的共同判面（只判 `decision` 行），`ProseFace.gaps` 是缺口判词且只有一个调用点——本族第一条声明行 `measure-literal`，其余三条文法不重复登记；`ProseWalk` 与 `ProseFace` 都不导出，模块外看得见的是 `ProseLines` 与四个规则类，故 `ProseFace.gaps` 的单一调用点是模块内部事实，不是一个导出面能破的承诺；`JudgeContext` 增 `text` 一条——行源交出的正文，YAML 头不在其中，四条文法只读它）
- Modify: `packages/cdd-engine/src-next/contract/pins.ts`（`PinSpans` 长出围栏感知的散文行读一对——`proseEntriesOf(text)` 交围栏外的每一行连同它的源文本行号，`proseOf(text)` 是同一走读的字符串投影；围栏状态与 `tokensOf` 同一次走读，`tokensOf` 与 `ProseLines` 各读一条投影取 span、取行，不起第二份判法）
- Modify: `packages/cdd-engine/src-next/contract/rules.ts`（四条 `doc` 行，`severity: "warn"`，`skipWhenClosed: true`）
- Modify: `packages/cdd-engine/src-next/contract/__tests__/rules.test.ts`（`RULE_REGISTRY` 的计数断言随本任务的四条新行改到本任务的批后取值——总数 `toHaveLength(30)`、doc 面 `28`、ledger 面 `2`；Task 3 与 Task 4 各再改一次，批后终态是 `toHaveLength(32)` · `30` · `2`）
- Modify: `packages/cdd-engine/src-next/contract/judge.ts`（`#contextOf` 把行源已交出的正文一并交进 `JudgeContext.text`——不多一次读、不新起第二条接缝，也不让策略改读 `ctx.fs.read(ctx.path)`）
- Create: `packages/cdd-engine/src-next/contract/__tests__/shape-rules.test.ts`

#### Consumes
- `FaceMap.roleOf`（Task 1）——规则只扫 `decision` 面，第三个参数收散文扫描器的标题栈（最内层在前，故交入时把入栈序翻一次）
- `CensusGate` / `CensusTable`（既有，`contract/census.ts`）——`measure-literal` 的合法形态判定
- `PinSpans`（既有，`contract/pins.ts`）——围栏跳过这一处定义的持有者；本任务给它加围栏感知的散文行读一对：`proseEntriesOf(text)`（带行号，`ProseLines` 在它上面取行）与 `proseOf(text)`（它的字符串面，`tokensOf` 在它上面取 span），不新起第二份判法
- 行源 `#rowSource`（既有，`contract/judge.ts`）——正文的唯一来处；`ProseLines.of` 的实参就是它交出的那段正文（经 `JudgeContext.text` 到位），与 `tree` 同一批归一字节

#### Produces
```ts
// contract/pins.ts — 围栏跳过只有一条走读，两条散文行读都是它的投影
// 新增：`PinSpans.proseEntriesOf(text)`（围栏外的每一行连同它的 1 起行号）与它的字符串面 `proseOf(text)`
// 共享的散文行切开：围栏跳过读 `PinSpans#proseEntriesOf`，本类只切行、剥行内代码段
export interface ProseLine {
  readonly line: number;    // 源文本里的 1 起行号，围栏行照数
  readonly raw: string;     // 行逐字节原文——符号候选的读面
  readonly blanked: string; // 同一行把行内代码段换成等长空白——token 文法的读面
}
export class ProseLines {
  static of(content: string): readonly ProseLine[];   // 围栏内的行不进来；每行两条读面齐备
  static isQuoted(line: string): boolean;             // 行首 `>` —— 引用块的唯一判法
}
// contract/invariants.ts — 走读与判框两形都住本模块、都不导出；模块外看得见的是 ProseLines 与四个规则类
// 缺口是面图的性质，不是任一文法自己发现的：一条走读、一个调用点
interface ProseLineRecord extends ProseLine {   // 同一走读的条目，四条文法都从它取行
  readonly heading: string;
  readonly role: DocFace | "unmapped";
}
class ProseWalk {
  // 标题栈走读：一次推进；四条文法与 SingleHomeInvariant 同读它，故它是共享面而非某一形的内部细节
  static of(ctx: JudgeContext): readonly ProseLineRecord[];
}
class ProseFace {
  // 判框与走读都不导出：本模块对外的面是 ProseLines 与四个规则类
  static judge(ctx: JudgeContext, judgeLine: (record: ProseLineRecord) => readonly FindingDraft[]): FindingDraft[];
  static gaps(ctx: JudgeContext, kind: string): FindingDraft[];   // 每条未登记标题恰一条，kind 取自调用它的那一行
}
export class MeasureLiteralInvariant extends Invariant { readonly name = "measure-literal"; }
export class LineCoordinateInvariant extends Invariant { readonly name = "line-coordinate"; }
export class LiveArithmeticInvariant extends Invariant { readonly name = "live-arithmetic"; }
export class TemporalIndicatorInvariant extends Invariant { readonly name = "temporal-indicator"; }
```

#### Steps
- 写 `ProseLines`：围栏跳过调 `PinSpans#proseEntriesOf`（围栏状态住 `contract/pins.ts`，本类不另写一份；行号随条目一并到位，不另数一遍），把每行里的行内代码段替换为等长空白（保列位），`isQuoted` 判行首 `>` — checkable: 一对断言——围栏里的 `第 41 行` 不在返回行里，围栏外的同一串在；第二条——`line` 读的是源文本坐标（围栏行照数）
- 把扫描面定在 `ctx.text` 上：`JudgeContext` 增 `text`（行源交出的正文，YAML 头不在其中），`#contextOf` 一并交进上下文，四条文法只读它——**不**取 `ctx.fs.read(ctx.path)`：那条路把 front-matter 行也扫进来，而 front-matter 行没有所属的注册节，会以 `unmapped` 落判，一份正文干净的文档就此被拒 — checkable: `shape-rules.test.ts` 的 front-matter 臂——头里同时带一处测量字面与一处坐标的夹具零 finding；成对——同一串搬进 `## Design` ⇒ 报
- `measure-literal` 文法：十进制整数、一个空格、闭集单位（`passed` · `failed` · `tests` · `files` · `rows` · `行` · `处` · `条`），整数两侧须独立成词——小数的小数部分与带点编号里的数字都不是整数——且该串不在 `census:<id> = <n>` 的引用里 — checkable: `shape-rules.test.ts` 六条断言——`97 passed` 报；`census:<id> = <n>` 零报（占位形态不是引用：id 不是点分小写而 `<n>` 不是十进制整数）；`七处` 零报（中文数词不是整数）；`0.5 rows` 零报（小数的小数部分不是整数）；`v1.2 rows` 零报（带点编号里的数字不是整数）；`42 widgets` 零报（单位不在闭集内，落在文法之外，本行不判它）。夹具里的非零读数写在测试文件内，本文件的例子只用占位形态
- `line-coordinate` 文法：`第 N 行` · `line N` · 路径后接 `:N` — checkable: 三种形态各报一条 finding，`kind` 均为 `line-coordinate`；**plan 面自带载具**——一份 plan 夹具的 `#### Steps` 里写一句散文 `path:line` ⇒ 报一次、`kind` 读 `line-coordinate`，同一句放进行内代码段、同一节里改写成工作项（`- Modify: <path>`）⇒ 各零 finding（三者只差那一处形态），plan 面因此不靠 spec 面的用例替它作证
- `live-arithmetic` 文法：整数、可选空格、运算符（`−` U+2212 · `-` ASCII · `–` en dash 三者同判）、可选空格、整数、`=`、整数 — checkable: 三份只差运算符字形的夹具各报一次；成对——同一处差值重述成必须成立的条件（`差值由某守卫维持`）⇒ 零报，重述之后没有可判的算式形状，故这条零臂与三条报臂只差那一种写法
- `temporal-indicator` 文法：闭集 `today` · `currently` · `今天` · `今日` · `仍`，所在分句（按 `，` · `；` · `。` · `·` · `——` 切）里须有符号候选（一个行内代码段，或一个带 `/` `.` `#` 的裸词元）；分句切分只认双写的 `——`，单写的一个 `—` 不是分隔符（`—+` 那种宽松读法不作数） — checkable: 三条反证——`豁免面清单仍为空` 零报（孤立副词：分句里没有符号候选），`` 今日形面 `schema get` `` 报，把后一句重述成必须成立的条件（`` 形面 `schema get` 的输出须涵盖该元素 ``）⇒ 零报——指示词不在而符号候选在，故这一条拦的是挂载形态而不是符号本身
- 四条规则只扫 `FaceMap.roleOf` 判作 `decision` 的行：散文扫描器沿行推进时维护标题栈（入栈序即最外层在前），交给第三个参数的是 `[...ancestors].reverse()`（最内层在前），故 `### 7.` 下的 `#### 7.5.1` 随最近的注册祖先继承角色；`unmapped` 也交一条 finding（缺口即判词），而缺口是**面图**的性质：一条缺口恰是一条 finding，只由本族第一条声明行 `measure-literal` 经 `contract/invariants.ts#ProseFace.gaps` 报（该调用点只有一个，其余三条文法对它零 finding——一条缺口不摊成四条） — checkable: 把一条违规放进 `## Change history` 零报，放进 `## Design` 报；缺口臂——一条未登记的标题在 `measure-literal` 上恰一条 finding、`kind` 读 `measure-literal`，`line-coordinate` · `live-arithmetic` · `temporal-indicator` 三种文法对它零 finding；继承臂——`FaceMap.roleOf` 对 `### 7. 某节` 与它下面的 `#### 7.5.1 某条` 都回 `decision`（P15 · P21 语料里的既有形状），故那两行里的一条 `line-coordinate` 违例，其 `kind` 读 `line-coordinate`；成对反证——把调用退回两参形态（不交标题栈）⇒ `#### 7.5.1` 那一行改读缺口判词、`kind` 不再是 `line-coordinate`
- overall docKey 的成对臂：一行 `第 41 行` 只放 `## Constraints` ⇒ `line-coordinate` 报一条；同一行搬进 `### 设计决策留存（2026-10-10 —— 元层裁定 + 注册）` ⇒ 零报（登记面不判） — checkable: 两条断言同时通过，且登记面那条不以 `unmapped` 落判
- 提交 — checkable: 四条规则行在 `RULE_REGISTRY` 里出现，且各带 `severity: "warn"` 与 `skipWhenClosed: true`

#### Acceptance
四类各有一条报与一条不报的成对；`measure-literal` 对 `census` 引用零报、对占位形态与中文数词零报、对小数与带点编号里的数字零报（左边界成对）、对单位不在闭集内的裸数零报（出集成对——文法之外不是判据）；`live-arithmetic` 三字形同判，而同一处差值重述成必须成立的条件零报（重述成对）；`temporal-indicator` 的孤立副词零报、挂符号的报、同一句重述成必须成立的条件零报（三条成对），分句切分只认双写的 `——`（单写的一个 `—` 不切分句）；四条规则都只扫判据面（记录面与登记面零报，overall 上 `## Constraints` 报而登记面零报——成对）；继承面同判——`### 7.` 下的 `#### 7.5.1` 判作 `decision`、违例的 `kind` 是规则自己的名字（成对：不交标题栈即落缺口判词，`kind` 不再是那个名字）；缺口只报一次——一条未登记标题恰一条 finding、`kind` 读 `measure-literal`，其余三条文法对它零 finding（`ProseFace.gaps` 只有一个调用点）；plan 面自带载具——`#### Steps` 里的一句散文 `path:line` 报一次 `line-coordinate`，行内代码段与工作项零 finding（三者只差那一处形态）；围栏跳过只有一处定义（`PinSpans#proseEntriesOf`，`proseOf` 是它的字符串面），`ProseLines` 不持有第二份；扫描面是行源交出的正文（`ctx.text`）——front-matter 头里带测量字面与坐标 ⇒ 零报（成对：同一串搬进判据面 ⇒ 报）；全量 `pnpm -C packages/cdd-engine exec vitest run src-next/contract` 在 `## Constraints` 声明的那两处窗口红之外绿——`pins.guard.test.ts` 的零命中臂与 `census.guard.test.ts` 的 `pin.total` 不属本任务的判据，P37 对里那两处 `= 0` 声明一字不动（改写它们等于替一扇尚未存在的门记账）。

#### DependsOn
1

### Task 3: 记录面的日期形状行

#### Objective
把「历史行的日期格是 ISO 日期」从一扇**惰性**的注册模式变成一条真规则：`Change history` 的 `date` 元素声明了 `valuePattern: ^\d{4}-\d{2}-\d{2}$`，而 `DomainInvariant` 经选择器取候选节点、选择器的单元格匹配就是那个模式——不匹配即无候选，于是违规永不上报。新规则行独立判它，取值只有一处来源（该元素的 `valuePattern`）。

#### Files
- Modify: `packages/cdd-engine/src-next/contract/invariants.ts`（`ChangeHistoryDateShapeInvariant`）
- Modify: `packages/cdd-engine/src-next/contract/rules.ts`（一行 `change-history-date-shape`，`docKeys: "all"`，`severity: "warn"`，`skipWhenClosed: true`）
- Modify: `packages/cdd-engine/src-next/contract/__tests__/rules.test.ts`（同一份计数断言随本任务那一行改到本任务的批后取值——`toHaveLength(31)` · `29` · `2`）
- Test: `packages/cdd-engine/src-next/contract/__tests__/shape-rules.test.ts`

#### Consumes
- `ElementRegistry` 的 `Change history date` 元素（既有）——`valuePattern` 是唯一取值来源
- `MarkdownTree` 的表读取（既有，`contract/markdown-tree.ts`）

#### Produces
```ts
export class ChangeHistoryDateShapeInvariant extends Invariant { readonly name = "change-history-date-shape"; }
```

#### Steps
- 写规则：读 `## Change history` 的每一行（跳过表头与分隔行），取日期列，断言它匹配该元素的 `valuePattern` — checkable: 日期格写 `xxx` ⇒ 一条 finding；写 `2026-11-20` ⇒ 零
- 在同一夹具上断言 `change-history-row-shape` 与 `change-history-header-columns` 都零报——日期不借那两行的判词 — checkable: 两条断言同时通过
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p41):` 起头

#### Acceptance
日期格非法 ⇒ 报 `change-history-date-shape`（成对：改回 ISO 零报）；同一夹具上另两行零报；一条历史行不带「测量方式」⇒ 零报（提交信息不是文档）。

#### DependsOn
1

### Task 4: 一份住所的重复句规则

#### Objective
同一条判据不得被复述进两份不同 slug 的文档。判据是句子级**字符 3-gram Jaccard ≥ 0.6** 且两侧归一化长度均 ≥ 40 字符；左域是在范围内的文档，右域是**除本文件与同 slug 文档之外**的全部文档；引用块与围栏块按行形态豁免。

#### Files
- Modify: `packages/cdd-engine/src-next/contract/invariants.ts`（`SingleHomeInvariant` + 句子切分与归一化的纯函数面 `SentenceIndex`）
- Modify: `packages/cdd-engine/src-next/contract/judge.ts`（与 Task 2 同一条 `JudgeContext.text`：两任务同波，声明的是同一个字段，本任务不为它再加接缝）
- Modify: `packages/cdd-engine/src-next/contract/rules.ts`（一行 `single-home`，`docKeys: "all"`，`severity: "warn"`，`skipWhenClosed: true`）
- Modify: `packages/cdd-engine/src-next/contract/__tests__/rules.test.ts`（同一份计数断言随本任务那一行落到批后终态——`toHaveLength(32)` · `30` · `2`）
- Create: `packages/cdd-engine/src-next/contract/__tests__/single-home.test.ts`

#### Consumes
- `ProseLines`（Task 2）——行内代码段剥离、围栏跳过、`isQuoted`；句子切分读的正文与它同源（`ctx.text`，行源交出、YAML 头不在其中）
- `DocFs`（既有，`contract/invariants.ts`）——右域的文档读取面

#### Produces
```ts
export class SentenceIndex {
  // 归一化后的句子，连同它的散文长度（去掉行内代码段后）与源文本行号；
  // `from` 把行号搬到邻接文档的文件坐标——报文里念的是读者打开的那一行
  static of(
    content: string,
    from?: number,
  ): readonly { readonly text: string; readonly prose: number; readonly line: number }[];
  // 行首列表标记后接四个声明动词之一——工作项行，两侧都不进比较域
  static isWorkItem(line: string): boolean;
  static trigrams(text: string): ReadonlySet<string>;
  // 相似度面：阈值以它陈述（同句 1.0）
  static jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number;
  // 判定面：生产上唯一读的那条，按两侧大小先算所需的共享数、扫到一半即可退出
  static sameCriterion(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean;
  static readonly MIN_LENGTH = 40;
  static readonly THRESHOLD = 0.6;
}
export class SingleHomeInvariant extends Invariant { readonly name = "single-home"; }
```

#### Steps
- 写 `SentenceIndex.of`（实参是 `ctx.text`——正文面，front-matter 头不在其中）：切句按 `。` `！` `？` `!` `?` 与后接空白的 `.`，代码段与围栏内不切，表格行与列表项各自成句；归一化去行内代码标记、折空白、折大小写、丢标点 — checkable: 一对夹具给出两条句子，其中表格行仍成一条
- 写 `trigrams`、`jaccard` 与判定面 `sameCriterion`（阈值只取 `THRESHOLD` 一处，判定式按两侧大小先算所需的共享数、扫到一半即可退出）— checkable: 同一句 ⇒ 1.0；只差标点与空白 ⇒ 1.0；两个不相干句 ⇒ 低于 0.3；成对——同一对的 `sameCriterion` 为真，不相干那对为假
- 写规则：左域取被判文档的判据面句子（≥ 40 字符，且门槛按**去掉行内代码段后**的散文计——点名一条路径的指针句因此不进域），且**工作项行不进域**：行首列表标记后接 `Modify:` · `Create:` · `Test:` · `Delete:` 的行在两侧都被跳过（`- Modify: <path>` 归一化后每份 plan 逐字相同，比它等于判死模板）；右域同样跳过这一形状，并**经 `ctx.translator` 归一化后再切句**（两侧必须读同一个归一化面），右域扫 `DocFs.list` 覆盖的 spec/plan/overall 三 root，跳过同 slug 文档与本文件，逐对算 Jaccard — checkable: 两份不同 slug 的夹具各带同一句 ⇒ 一条 finding 念两侧文件与两侧开头；同句搬进引用块 ⇒ 零报；工作项成对：两份不同 slug 各带同一行 `- Modify:` 指向同一文件、且两半都在行内代码段之外带四十字符以上的散文 ⇒ 零报，去掉列表标记写成判据句 ⇒ 报（两半唯一的差别是列表标记，故第二半红是因为它不再是工作项）；指针句成对：两句各抄同一条长路径、两侧散文都不足下界 ⇒ 零报，同一路径两侧各配四十字符以上的散文 ⇒ 报（两半唯一的差别是散文量，故第一半绿是因为路径不计入下界）
- 同 slug 豁免一对：把同一句放进同 slug 的 spec 与 plan ⇒ 零报 — checkable: 断言零 finding
- 右域的闭合臂一对：同一句同时出现在一份**已闭合**的文档与一份不同 slug 的未闭合文档上 ⇒ 照报——左侧是那份未闭合文档，右侧把那份闭合文档念出（右域不按闭合过滤）；成对——把同一句搬进引用块 ⇒ 零报 — checkable: 两条断言同时通过，报文念出闭合那份的文件名
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p41):` 起头

#### Acceptance
阈值与长度下界成对可核（同句 1.0 · 不相干低于阈值）；引用块与围栏块豁免；同 slug 对零报（成对：换 slug 后同一句报）；右域不按闭合过滤——闭合文档在右侧仍被念出（成对：搬进引用块零报）；报文含两侧文件与两侧开头；单位不在闭集内的裸数与短句都不进比较域；句子切分的输入是 `ctx.text`（正文面，front-matter 头不在其中），front-matter 行不进切句面；工作项行在两侧都不进域（成对：两半都带四十字符以上的散文、只去掉列表标记后同一句报）；长度下界量的是散文（成对：两句各抄同一条长路径、两侧散文都不足下界 ⇒ 零报，同一路径两侧各配四十字符以上的散文 ⇒ 报），故点名一条路径的指针句不进比较域；两侧同读 `ctx.translator` 的归一化面（含 `组` 这类别名判据的中文夹具 ⇒ 报，改前零报）

#### DependsOn
1

### Task 5: 严重度渲染、details 过滤与生命周期范围

#### Objective
把档位与范围落到消费者能读的地方：规则行按档位渲染（`passed` · `failed` · `warned — <n> warning(s)` · `skipped (closed document)` · `skipped (no doc target)`）；`doc-contract` 的 `details` 只列 block 命中；闭合读 `contract/pins.ts#ForwardPaths` 已解析的那份 Phase inventory（两个命名格任一 `✔ Done` 点名本文件即闭合），并向形状门暴露同一个读数；没有总体时拒绝里多一条 `details` 行，字节是 `face/words.ts#PreflightWords.closureUnavailable` 的整句（`closure: no overall charter is registered in this tree, so the document's closed state is unprovable — every shape rule judged it`），取自 spec §1.4 的登记，不另起措辞、不给中文译名。

#### Files
- Modify: `packages/cdd-engine/src-next/session/preflight.ts`（`DocOutcome` 的 `judged` 增 `closed`；`#ruleRows` 按声明渲染——`skipWhenClosed` 且 `closed` ⇒ `skipped (closed document)`，其余行按档位；拒绝判词改成「存在 block 命中」；`doc-contract` 拒绝的 `details` 过滤到 block；无总体时追加那条 `details` 行——触发键是门内已建的那份 `SlugIndex`（`entries` 里有一项 `docType` 为 `overall` 即登记可用），门只多一次列表读、不另列一次语料，也不经端口；构造面只增一个单方法的闭合端口 `provenClosed?: (rel: string) => boolean`，缺省 `() => false`（没有真实访问器时没有任何文档算「已证明闭合」，故未供端口的构造站点零改动，`session/__tests__/plan-read-consistency.test.ts` 不进本任务的改动面；组装点恒供端口，缺省值只服务不判闭合的构造站点）；渲染面不另收行表——它读契约实例的 `ruleRows()`，而判定用的注册表由构造面既有的 `contract` 项注入，故档位与渲染读同一条清单，`session/` 面不起第二份规则集）
- Modify: `packages/cdd-engine/src-next/face/words.ts`（`checkedWords()` 增 `warned` 与 `skippedClosedDocument` 两个词；`preflightWords()` 增 `closureUnavailable` 第三个词——整句逐字为 `closure: no overall charter is registered in this tree, so the document's closed state is unprovable — every shape rule judged it`，唯一推送点是 `PreFlight#vet` 的 `doc-contract` 分支，不另起措辞、不给中文译名）
- Modify: `packages/cdd-engine/src-next/contract/pins.ts`（`ForwardPaths` 暴露 `provenClosed(rel)`：两个命名格任一 `✔ Done` 且 `basename` 恰一份命中 ⇒ 闭合；`PinAudit` 上一条同名访问器把它交出去——形状门不自己 new 一个 `ForwardPaths`，也不新起第二份材料）
- Modify: `packages/cdd-engine/src-next/face/cli.ts`（组装点持那条按首次使用构造的审计访问器——`PinAudit` 的一次派发唯一构造处，并把同一个访问器交给 `PreFlight`（闭合端口）与 `CliLifecycle`（`contract.path` 回读）：一次 review 派发的形状门与回读落在同一份审计上，wave 与 branch 派发一次语料扫描都不付；`PreFlight` 只收访问器、不自己 new，而 `vet` 跑在 `#lifecycleOf` 之前，读数在那一刻已可取；三条按 root 记忆化的接缝（身份索引 · 审计 · 生产 `PreFlight`）共用一处 memo 形，失效点只住那里，不成三对 `#...Root` 字段）
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（`#pinAudit()` 改成读组装点注入的审计访问器——本条生命周期不再自己 new 一个 `PinAudit`，两条语料面（被判文档的正文与 `contract.path` 回读）落在同一份上；构造面增一个可缺省项 `pinAudit?: () => PinAudit`，缺省回落到本条自己的按首次使用构造的那份（即既有的 `#pinIndex` 派发），故未供该访问器的十一处构造站点——`face/__tests__/lifecycle.test.ts` 九处与 `face/__tests__/dispatch-input.test.ts` 两处——零改动）
- Test: `packages/cdd-engine/src-next/session/__tests__/preflight-rows.test.ts`
- Create: `packages/cdd-engine/src-next/contract/__tests__/pins-guard-closure.test.ts`
- Modify: `docs/diagrams/src/architecture.en.json` · `docs/diagrams/src/architecture.zh-CN.json`（引擎 CLI 那一格的 `cli.ts` 坐标随字段搬进声明块重取——两格指的仍是同一条命令装配壳，JSON 手维、HTML 由 `pnpm run emit` 重出）

#### Consumes
- `Finding.severity`（Task 1）与六条规则行（Task 2 · Task 3 · Task 4）——闭合豁免只盖带 `skipWhenClosed` 的六行，其余行照判
- `Contract.ruleRows()`（既有，Task 1 后每行带 `severity` 与 `skipWhenClosed`）
- `ForwardPaths` 的 Phase inventory 解析（既有）与它在本任务新公开的闭合读数 `provenClosed`；端口取 `PinAudit#provenClosed`（`ForwardPaths` 的实例不外露）；闭合登记是否可用由 `doc-contract` 门自己回答——那份 `SlugIndex` 已在门里建好，`entries` 是它的公开读法，不另起端口方法
- 组装点 `face/cli.ts`（既有）与它的 `face/lifecycle.ts`（既有）——闭合读数的唯一构造处是组装点持有的那条按首次使用构造的审计访问器；`PreFlight` 不自己 new 一个 `PinAudit`（那会把每次派发变成一次语料扫描），也不起第二份实例（那会把一次 review 派发的语料索引两遍）；`CliLifecycle` 的同一访问器是可缺省项，缺省即它自己的记忆化工厂，故既有的构造站点不必随这项改动编辑

#### Produces
```ts
type DocOutcome =
  | { readonly kind: "judged"; readonly findings: readonly Finding[]; readonly closed: boolean; readonly layersUnavailable?: boolean }
  | { readonly kind: "no-doc-target" }
  | { readonly kind: "not-judged" }
  | { readonly kind: "unreadable" };
// 一行怎么渲染只读声明：带 `skipWhenClosed` 且 `closed` ⇒ skipped (closed document)；
// 否则按命中档位（block ⇒ failed，仅 warn ⇒ warned，零命中 ⇒ passed）
// 闭合不新增 kind：判定照跑，只有六条带旗标的策略被跳过，其余规则的命中一样进拒绝判词
// contract/pins.ts — PinAudit 上的公开访问器，与私有的 ForwardPaths#closedBy 极性相反，
// 两个名字刻意不同形：pin 面读「未被证明的未闭合」，形状门读「已证明的闭合」
provenClosed(rel: string): boolean;             // 两个命名格同判；零命中与多命中都不算闭合
// 闭合端口只有这一个方法：审计由组装点按首次使用构造，形状门与 contract.path 回读共用同一份
// 「登记可用」不是端口的一条读法——门在自己建的那份 SlugIndex 的 entries 上判（零份总体即那条 details 行的唯一触发）
// 那条 details 行不另起措辞：字节就是 PreflightWords.closureUnavailable 的整句（本任务把该词加进 face/words.ts）
// 构造面另收一个可缺省项：闭合端口 provenClosed?: (rel: string) => boolean —— 缺省 () => false
// （无访问器即无文档被证明闭合，故未供端口的构造站点不欠编辑）；渲染面不另收行表，
// 它读 Contract.ruleRows()，与判定共用构造面既有 contract 项注入的那份注册表
// face/lifecycle.ts — 第三条可缺省项住另一处构造面：缺省即本类自己的记忆化工厂
pinAudit?: () => PinAudit;                      // 缺省回落到 #pinIndex 的按首次使用构造
```

#### Steps
- 闭合的判定面：`doc-contract` 门先问闭合读数（经构造注入的端口，不在门里自己建审计），把 `closed` 交给 `Contract.validate(input, closed)`——六条带 `skipWhenClosed` 的策略不跑、也不交 finding，其余规则照跑 — checkable: 一份在 `## Change history` 表头缺一列的闭合夹具被 `change-history-header-columns` 拒一次（六条形状行不行以代判）；成对——同一份内容的未闭合副本里六条形状行照判，其中那条 `change-history-date-shape` 的违例读 `failed`（该副本经构造面的 `contract` 项注入一份把那条行声明成 `block` 的测试注册表，与档位渲染那一条同形），故这个字节读的是注入的声明，不随真实注册表的起步档而变
- `#ruleRows` 按声明渲染：命中且 `warn` ⇒ `${id}: ${words.warned} — ${n} warning(s)`；命中且 `block` ⇒ `${id}: ${words.failed}`；未命中 ⇒ `${id}: ${words.passed}`；带 `skipWhenClosed` 且夹具闭合 ⇒ `${id}: ${words.skippedClosedDocument}`，同一夹具上不带该旗标的行照档位读 `passed` 或 `failed`；夹具经构造面既有的 `contract` 项注入一份测试注册表（一条 `warn` 行 · 一条 `block` 行 · 一条带 `skipWhenClosed` 的行），渲染与判定因此读同一份声明，Task 8 的翻位不改这五条 — checkable: `session/__tests__/preflight-rows.test.ts` 五条成对断言（含「同一次判定里两种词共存」那一条），注册表经 `contract` 项注入、不读真实注册表
- 拒绝判词从「有 finding 即拒」改成「存在 block 命中即拒」（`findings.some((f) => f.severity === "block")`）— checkable: 一对断言——只有 warn 命中的夹具不被拒（exit 0，该行读 `warned`）；含 block 命中的夹具被拒一次；`checked:` 行字节逐字节不变。那条 warn 夹具不建在真实规则行上：finding 的档位由判定用的那份注册表盖章，渲染读的也是同一份（`Contract.ruleRows()`），故夹具经 `PreFlight` 构造面既有的 `contract` 项注入一份测试注册表（一条 `severity: "warn"` 的测试声明，`rules-severity.test.ts` 的同一形），翻位之后这条断言也不改字节
- 两处 `skipped (no doc target)` 计数臂与 wave 面那条同读 `RULE_REGISTRY` 的派生值——`session/__tests__/preflight.test.ts` 与 `face/__tests__/cli.test.ts` 各自定义 `DOC_RULE_ROWS = RULE_REGISTRY.filter((row) => row.scope === "doc").length`——故两个文件不在本任务的改动面：六条规则行落地后派生值自己走到本批条数，计数不写成字面，用例标题里也没有数词要改 — checkable: `git diff --name-only` 不含这两份用例文件；`pnpm -C packages/cdd-engine exec vitest run src-next/session/__tests__/preflight.test.ts src-next/face/__tests__/cli.test.ts` 绿
- `doc-contract` 的 `details` 过滤到 `severity === "block"` — checkable: 混合档夹具上 `details` 只有 block 那条的 `kind@field`
- 无总体时追加 `details` 行——字节是 `face/words.ts#PreflightWords.closureUnavailable` 的整句（`closure: no overall charter is registered in this tree, so the document's closed state is unprovable — every shape rule judged it`），唯一推送点是 `PreFlight#vet` 的 `doc-contract` 分支；有总体但无格点名时**不**追加——触发键是门内已建那份 `SlugIndex` 的 `entries`（有一项 `docType` 为 `overall` 即登记可用），不是端口上 `provenClosed` 的假值：后者的两个假分支在端口上同形，拿它写这条行会把「有总体而不点名」当成「无可用的闭合登记」 — checkable: 两条成对断言——无总体那一份夹具的 `details` 含 `new Words().preflightWords().closureUnavailable`（逐字对读该词，不比对任何转述或译名）；有总体而不点名的那一份 `details` 不含该串（同一读法的 `not.toContain` 那一臂）
- `ForwardPaths#provenClosed`：两命名格同判、恰一份命中；零命中与多命中都不算闭合；`PinAudit#provenClosed` 把它交出去，审计由组装点持有的访问器按首次使用构造——端口与 `CliLifecycle` 的回读收的是同一个访问器；`CliLifecycle` 的 `pinAudit` 是可缺省项，缺省回落到本类自己的记忆化工厂，故未供它的构造站点不必编辑 — checkable: `pnpm -C packages/cdd-engine exec tsc --noEmit -p .` 通过（含未供访问器的十一处构造站点）；`pins-guard-closure.test.ts` 三对断言（单格命中 · 双格命中 · 多命中）；两条计数臂，每条点名自己用的派发平面——一条**工作平面**的 wave 派遣发跑完：闭合端口一次未被调用、`PinAudit` 构造零次；一条带 findings（每条带 `contract.path`）的 review 派发（判平面）跑完：形状门与回读落在同一份审计上、`PinAudit` 构造恰一次（两者问的是组装点的同一访问器）。零构造那一臂只对工作平面成立：判平面的回读先注一次 pin 读数、再无条件下取审计，故 wave review 与 branch review 都必构造一份；闭合端口零调用那一半对两个平面都成立
- `skipped (no doc target)` 的面按**派发类型**定：同一份带违例的 plan 作 `--type plan` 判 ⇒ 命中行 `failed`；作 wave 派遣发 ⇒ 六行全 `skipped (no doc target)`；两次都经构造面的 `contract` 项注入同一份测试注册表，且把那条规则声明成 `block`（与档位渲染那一臂同形）——`failed` 是翻位之后的字节，起步档的真实注册表读 `warned`，故这一臂不随翻位而变 — checkable: `session/__tests__/preflight-rows.test.ts` 一对断言，只改派发类型，注册表经 `contract` 项注入
- 无格点名的 single-spec：一份带违例的 single-spec 夹具（无任何总体的命名格点名它）以 `cdd review --type single-spec --spec <path>` 判 ⇒ 六条形状规则照判、命中行读 `failed`（六行所在的测试注册表经构造面的 `contract` 项注入、档位声明成 `block`，所以这一臂读的是翻位之后的字节，不依赖真实注册表的起步档），不读 `skipped (closed document)`；成对——把同一份内容的文件名写进两个命名格 ⇒ 六条形状行读 `skipped (closed document)`、其余行照判 — checkable: `session/__tests__/preflight-rows.test.ts` 一对断言
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p41):` 起头

#### Acceptance
五档渲染各有一对（`passed` · `failed` · `warned` · `skipped (closed document)` · `skipped (no doc target)`）；后两档字节与既有形态一致的档（`passed` · `failed` · `skipped (no doc target)`）逐字节不变；拒绝判词成对可核（只有 warn 命中 ⇒ 不拒，含 block 命中 ⇒ 拒一次）；闭合只豁免带 `skipWhenClosed` 的六行（成对：闭合夹具上的非形状违例照拒，未闭合副本里六行照判）；`details` 只列 block；无总体那条 `details` 行的字节逐字等于 `face/words.ts#PreflightWords.closureUnavailable` 的整句（成对：有总体而不点名时该串不出现），它的出现条件读门内那份 `SlugIndex` 的 `entries`、收窄成立（与 `provenClosed` 的假值不混形）；`provenClosed` 的两格同判与「恰一份命中」都有反证；两条计数臂相反相成且各点名派发平面——工作平面的 wave 派遣发不构造审计（判平面的 wave review 不在零构造那一侧：回读对每个判平面轮都取一次审计），带 `contract.path` 的 review 派发只构造一份（形状门与回读共用同一实例），而闭合端口零调用那一半对两个平面都成立；无格点名的 single-spec 照判（成对：格点名后六条形状行读 `skipped (closed document)`、其余行照判）；五条档位臂建在经 `contract` 项注入的测试注册表上（含那条 `warn` 行），渲染与判定读同一份声明，翻位之后仍绿；两处构造面收的两项都可缺省（闭合端口缺省读「无文档被证明闭合」、`CliLifecycle` 的审计访问器缺省回落到本类自己的记忆化工厂），故未供这两项的构造站点（`session/__tests__/plan-read-consistency.test.ts` 那一臂，以及 `face/__tests__/lifecycle.test.ts` 与 `face/__tests__/dispatch-input.test.ts` 里不传访问器的那些站点）不欠编辑、本任务的 `tsc --noEmit` 也不因它们变红。

#### DependsOn
2, 3, 4

### Task 6: 证据面

#### Objective
让 blocker 的每一条树事实断言都带一处读者可自核的字节：finding 增 `evidence: { repro, output? }`，`repro` 为空即等同于缺席；判定挂在既有 `HandoffSchema.gradingViolations` 的草稿回读路径上，判据本体是 `CRITERIA_ROWS` 的 `evidence-missing` 行；裁定侧车增 `verdict`（闭集）与 `probe`（驳回必填）。

#### Files
- Modify: `packages/cdd-engine/src-next/session/handoff-schema.ts`（findings 条目增 `evidence`，存在性判 `repro.trim().length > 0`；`gradingViolations` 增一条判据，`GradingViolation` 增 `criterion` 判别键——一条拒因自带自己的判据词，不由列表顺序或分量决定）
- Modify: `packages/cdd-engine/src-next/contract/review-criteria.ts`（`CRITERIA_ROWS` 增 `evidence-missing` 行，进 `renderRubric` 的 blocker 片段）
- Modify: `packages/cdd-engine/src-next/session/carrier-rulings.ts`（`RULING_FIELDS` 增 `verdict` 与 `probe`；`verdict` 闭集 `fixed` | `rejected`；`rejected` 缺 `probe` ⇒ 整份侧车不被接受）
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（`#gradingRefusal` 按 `criterion` 分组逐段渲染——一段一个判据词加自己那一段的 finding 标签，单判据轮因此逐字节仍是既有报文；新判据由此接进 `CDD_BLOCKED: evidence-missing:` 通道）
- Test: `packages/cdd-engine/src-next/session/__tests__/handoff-schema.test.ts`（`gradingViolations` 的两条 `toEqual` 期望值各多一个 `criterion` 键——「refuses every blocker without a scenario」与「reads a blank scenario as missing」两条用例；另补一条混合载荷臂：一份输入里两个判据词各一条违例）
- Test: `packages/cdd-engine/src-next/session/__tests__/handoff-plane.guard.test.ts`
- Test: `packages/cdd-engine/src-next/contract/__tests__/review-criteria.test.ts`
- Test: `packages/cdd-engine/src-next/session/__tests__/carrier-rulings.test.ts`

#### Consumes
- `HandoffSchema.planeOf`（既有）——`review` 与 wave/branch 同平面；fix 是 `work` 平面，不欠这条义务
- `CRITERIA_ROWS` 与 `renderRubric`（既有）
- `CarrierRulings`（既有）——顶层只接受 `carrier` / `rulings`

#### Produces
```ts
// session/handoff-schema.ts
export interface FindingEvidence { readonly repro: string; readonly output?: string; }
export interface FindingEntry { /* 既有字段 */ readonly evidence?: FindingEvidence; }
// 拒因自带判据词：一条拒因一个词，混合轮按词分组逐段渲染
export interface GradingViolation {
  readonly criterion: "grading-impact-missing" | "evidence-missing";
  readonly id?: string;
  readonly summary?: string;
}
// contract/review-criteria.ts — `CriteriaRow` 的六个键，一个不省；`gate` 是 face 上的一个值，不是 tier
{ id: "evidence-missing", tier: "blocker", face: "gate", body: …, duty: …, counterExample: … }
// session/carrier-rulings.ts
const RULING_FIELDS = ["ruling", "at", "by", "verdict", "probe"] as const;
export type Verdict = "fixed" | "rejected";
```

#### Steps
- 写 `evidence-missing` 判据行：六键齐（`id` · `tier: "blocker"` · `face: "gate"` · `body` · `duty` · `counterExample`），正文列出每个违规 finding 的 id 与 summary，报文首词与正文形状照 `grading-impact-missing` — checkable: `review-criteria.test.ts` 的 id 名册含该行，且 face census 用例（按 face 分组的 id 名册）同批扩——`gate` 组读两条（`grading-impact-missing` 与 `evidence-missing`），`numbered` 与 `test` 两组不变；`tier` 档断言通过
- `GradingViolation` 增 `criterion`（闭集两词），一条拒因自带自己的判据词，`#gradingRefusal` 按它分组逐段渲染——一段一个判据词加自己那一段的 finding 标签；单判据轮的报文逐字节不变（既有的那条回读路径不因第二个判据而改形）— checkable: 混合夹具（一条 blocker 缺 `impact.scenario`、一条 blocker 的 `repro` 为空白串）上两个判据词都出现，各自的标签落在自己那一段；同一条混合载荷在 `handoff-schema.test.ts` 的谓词面再断言一次（两个判据词同在一份返回里）；单判据夹具的报文与既有字节相同
- 接进 `gradingViolations` 的同一条回读路径 — checkable: blocker 缺 `evidence` ⇒ `CDD_BLOCKED: evidence-missing:`；warn 缺 ⇒ 通过；`repro: " "` ⇒ 同样被拒（与缺席同一条用例面）
- `repro` 的两种合法形态各一条用例：一条命令、一个 `doc.md#section` 指针 — checkable: 两条都通过
- `planeOf` 面：fix 草稿带 `dispositions` 而无 `findings` 槽 ⇒ 不欠这条义务 — checkable: 一条断言
- 侧车：`RULING_FIELDS` 增两键；`verdict: "rejected"` 缺 `probe` ⇒ 整份不被接受；`verdict: "fixed"` 缺 `probe` ⇒ 通过；不带 `verdict` 的存量侧车 ⇒ 通过（不补迁移）— checkable: 三条断言
- `census:criteria.rows` 由 `5` 变 `6`：先核 `contract/census.ts#censusTableOf` 已从 `CRITERIA_ROWS.length` 派生（已派生则本步不改它——这是核对，不是改动面，`contract/__tests__/census.guard.test.ts` 的门也不动），再把闭集 P37 对里声明它的四处引用逐字改成 `6`——P37 design 的 §1.3 与 §6.1、同一份 design 的 `## Change history` 的 v0.13 行、P37 plan 的 `### Task 8` 的 `#### Steps` — checkable: `contract/__tests__/census.guard.test.ts` 对这条 id 零失配
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p41):` 起头

#### Acceptance
blocker 缺 `evidence` 被拒（与 `repro` 为空白串各一条，同一报文）；混合轮两个判据词都出现且各带自己那一段的标签（成对：单判据轮的报文逐字节不变）；warn 缺通过；两种 `repro` 形态都通过；fix 草稿不欠这条义务；侧车两键的三种组合各一条；`census:criteria.rows` 的四处引用零失配；`renderRubric` 的 blocker 片段含该行且 `review-criteria.test.ts` 的 id 名册同批更新。

#### DependsOn
none

### Task 7: 章程自修

#### Objective
翻位之后本程序章程会被自己的判据面拒——五节里把命令清单、例外面与模板形面挂在一个符号上，用的是时序措辞；`### Non-goals` 那一颗子弹还带一处测量字面。本任务把五节改写成条件句，并把**三类**重复句各收敛成一个**指针**（点名持有者的节，不复述原句）——gate 判据、发布姿态，以及章程自己的回填纪律（改动先回填本文件、版本随之 bump，`## Document scope` 与 `## Constraints` 各一处，四份相位文档复述同一句），使三族齐零：两个文法各自零命中，且 `single-home` 在章程上零命中。同一次写入还回填章程 `## Phase inventory` 的 P41 行——**Scope ③** 的下界改成量散文、**Acceptance ⑥** 补一句工作项行不是判据，两处措辞取 Task 4 落地的域（这项回填不在五节里，五节自修够不到注册节），章程的 `## Change history` 同批记一行、front-matter 的 `version:` 随之 bump。

#### Files
- Modify: `docs/kairos/overalls/2026-10-10-engine-doc-tooling-overall.md`（`### Goal` · `### Non-goals` · `### Cross-cutting` · `## Boundary rules` · `## Constraints` 五节改成条件句；`### Non-goals` 那颗子弹的计数删掉或写成 `census:<id> = <n>`；**三类重复句**各收敛成指针——gate 判据 · 发布姿态 · 回填纪律（`## Document scope` 与 `## Constraints` 里那两句改写成只点名持有者节的指针）；**验收回填**——`## Phase inventory` 的 P41 行 **Scope ③** 改成「下界量的是散文，行内代码段整段不计，点名一条路径的指针句因此不进域」、**Acceptance ⑥** 补一句「工作项行不是判据，`- Modify:` 一类行在两侧都不进域」，Acceptance ③ 的严重度一条一字不动；并在 `## Change history` 记一行、front-matter 的 `version:` 同批 bump）
- Create: `packages/cdd-engine/src-next/contract/__tests__/charter-self-repair.test.ts`

#### Consumes
- 六条规则行（Task 2 · 3 · 4）与档位渲染（Task 5）——本任务的判据是它们不报
- 章程的五节原文（`docs/kairos/overalls/2026-10-10-engine-doc-tooling-overall.md`）

#### Produces
```ts
// 无新符号面：本任务的产出是文档内容与四条成对用例
```

#### Steps
- 写四对用例的前两对：改回原句 ⇒ 命中八处（`### Goal` · `### Cross-cutting` · `## Boundary rules` 各一处 `temporal-indicator`，`## Constraints` 两处，`### Non-goals` 两处 `temporal-indicator` 加一处 `measure-literal`）；两个文法修净而重复句留着 ⇒ 被 `single-home` 拒 — checkable: 两条夹具各断言 finding 集合的 `kind`
- 把五节改成条件句；那颗子弹的计数删掉 — checkable: 两个文法在章程五节上零命中
- 验收回填：章程 `## Phase inventory` 的 P41 行 **Scope ③** 按 Task 4 的散文下界重述（下界量的是散文，点名一条路径的指针句因此不进域）、**Acceptance ⑥** 补一句工作项例外（`- Modify:` 一类行在两侧都被跳过）；两处与新规则同读，不回填就等于让实现面写一条与登记面相反的判据，而该行的 Acceptance ③（严重度那一条）一字不动 — checkable: 章程的 P41 行 Scope ③ 带散文下界、Acceptance ⑥ 带工作项例外、Acceptance ③ 仍是严重度那一条；同一次写入在章程的 `## Change history` 记一行，且历史表最新一行的版本号等于 front-matter 的 `version:`
- 三类重复句各收敛成指向持有者的节（`见 <path> 的 ## Constraints`），不复述原句、不带判据标签——gate 判据指向 P3 · P4 · P5 三份 design 与 P4 plan 的 `## Constraints`，发布姿态指向 P13 design 的 `## Constraints`，回填纪律指向 P9 design 的 `## Constraints`（`docs/kairos/specs/2026-10-10-engine-doc-tooling-p9-design.md`） — checkable: `single-home` 在章程上零命中；三类合计十处命中全消，只收敛前两类 ⇒ 回填纪律那四处在 `single-home` 上照旧报
- 后两对用例：指针句自身零拒绝；携带判据标签的复述 ⇒ 被同源句命中 — checkable: 一对断言
- 提交 — checkable: `git log -1 --format=%s` 以 `docs(p41):` 起头

#### Acceptance
三族齐零（两个文法 + `single-home`）在章程五节上成立；改回原句 ⇒ 八处命中且两类都出现；只修两文法而留重复句 ⇒ 仍被拒；三类重复句的指针处置齐全（gate 判据 · 发布姿态 · 回填纪律，各自点名持有者的 `## Constraints`），故 `single-home` 的零命中臂覆盖全部三类——只处置前两类时回填纪律那一类照旧命中；指针句过 `single-home` 两对；翻位之后以 `cdd review --type overall --spec docs/kairos/overalls/2026-10-10-engine-doc-tooling-overall.md` 判章程为零拒绝；验收回填落在同一个文件的注册节——P41 行的 Scope ③ 量散文、Acceptance ⑥ 工作项行不是判据、Acceptance ③ 的严重度一条不动，两处与 Task 4 落地的域同读；同一次写入的历史表多一行，其版本号等于 front-matter 的 `version:`。

#### DependsOn
2, 4

### Task 8: 消费面收口

#### Objective
把新增面收进两处说明书与一份 spec 评审 rubric，并把过渡值烧掉：`cdd-spec-writer` 的 `author-spec` 与 `cdd-plan` 的 `author-plan` 各照抄三条 claim shape（每条点名它对应的规则行，不增段落）；`render/templates.ts` 的 `docNarrativeAxes` 同批改口——count 一形只认 `census:<id> = <n>`，narrative 一句的许可面挪到工作项上（`what belongs to the plan is the work item`，不是一句散文 `path:line`）；它是三种 claim shape 的第三个住户，同一句话在 rubric 与门之间不许有两个答案；`cdd-plan` 的 `Citations` 一条同批改口成只许可工作项——plan 拥有的是工作项，不是坐标；两处登记随同一次写入落地——rubric 作为第三处住户写进 spec §4 的住户名单（与两个 skill 节点并列），rubric 的计数重锚写进章程 `## Phase inventory` 的 P28 行验收格（第二条子串换成新措辞的稳定子串，另两条与既有三个 pin 不重锚），两处各记一行 `## Change history`、front-matter 的 `version:` 同批 bump；changeset 两层各记 `minor`（`cdd-engine` 与 `kairos`——两个 skill 节点是本次交付的 kairos 一半）；六条规则行的告警位翻成 block；pin 断言「无一规则声明 warn」。

#### Files
- Modify: `packages/kairos/skills/cdd-spec-writer/SKILL.md`（`author-spec` 的三行 claim shape）
- Modify: `packages/kairos/skills/cdd-plan/SKILL.md`（`author-plan` 的同一组三行；外加 `Citations` 一条改口——plan 拥有的是工作项（`- Modify: <path>`），不是坐标，不再许可一句散文 `path:line`，与 `line-coordinate` 在 plan 面上的判词同源）
- Modify: `packages/cdd-engine/src-next/render/templates.ts`（`docNarrativeAxes` 的 count 一形改成只认 `census:<id> = <n>`——id 取自 census 登记表，新措辞沿用 claim shape 的 count 一条（`a count is stated only as census:<id> = <n>, the id taken from the census registry`），「点名维持该值的守卫或测试」不再是合法形态，而 `measure-literal` 拒的正是它；该函数的 doc comment 里把散文计数称作 `the guard's business` 那一句与同一括号里把计数称作 `a guarded count` 的那一处同批改口，计数改称 census 形态的名字——正文与注释要一起动，只改正文等于让注释继续教旧形态。这是三种 claim shape 的第三个住户，也是 spec 评审 prompt 的唯一来源；narrative 一句同批把许可面挪到工作项上——`what belongs to the plan is the work item` 与 `never a prose path:line` 两个半句与 count 一形同源，故 rubric 的两条判据都在本任务这一行里有着落，不留半个句子给没人认领的面；它的住户登记由本任务的 spec 行承担）
- Modify: `packages/cdd-engine/src-next/render/__tests__/templates.test.ts`（`VOLATILE_FACT_ANCHORS` 的第二条稳定子串从 `pinned by the named guard` 换成新措辞里的 `census registry`，与上一条同一批落地；锚仍是三条、一条守一种 shape，`keeps every other narrative anchor` 那条与 plan 变体字节冻结那条零改动；同批落地 spec §4 · 验收臂登记的反向对读——`REVIEWS.spec.axesGuide` 不含以 `- **` 起头的子弹行、不含四条规则行 id（`line-coordinate` · `measure-literal` · `live-arithmetic` · `temporal-indicator`），预置一份复制 skill 块的形态即红；第三条锚 `belongs to the plan` 不动，但改挂的位置随措辞走——它守的是 narrative 一句里**工作项**那一半（`what belongs to the plan is the work item`），spec v0.17 撤回的正是「散文 `path:line` 归 plan」那一半，锚因此不再替那句旧许可作证）
- Modify: `packages/cdd-engine/src-next/contract/rules.ts`（六条新行的 `severity` 翻成 `"block"`）
- Modify: `packages/cdd-engine/src-next/contract/__tests__/shape-rules.test.ts`（六条形状行的档位断言随翻位改口：`expect(row.severity, id).toBe("warn")` 的期望值改成 `block`，`it` 标题里的档位字面同改成 `block`，`describe` 标题按改口后断言的事重写（`the six shape rows carry` 起头，落 `block` 与 `skip a closed document` 两处字面，`land as warn` 那半句删掉），文件头那句 `all warn at landing` 一字不动——`at landing` 就是这段历史，标题说事实、注释记登记面，两者不再拆台；`skipWhenClosed` 那一臂一字不动。漏了这一行，本任务的 `pnpm run validate` 不可能 exit 0——该文件此前的波次里只以 `Create:` 与 `Test:` 出现，翻位之后那条断言即红）
- Create: `.changeset/p41-doc-shape-gate.md`（两个包键，档位同为 `minor`）
- Modify: `packages/cdd-engine/src-next/contract/__tests__/rules-severity.test.ts`（Task 1 建的那份，本任务只加一条终态断言——`expect(RULE_REGISTRY.filter((row) => row.severity === "warn")).toHaveLength(0)`，即本任务 `#### Produces` 里那行；既有的三条腿（前置名册 · 草稿臂 · 注入臂）一字不动，故它不属翻位重写的面，只多一条断言）
- Modify: `docs/kairos/specs/2026-11-19-engine-doc-tooling-p41-design.md`（§4 的 claim-shape 住户名单补上 rubric 这一处——`render/templates.ts` 的 `docNarrativeAxes` 与两个 skill 节点并列，同一组三行、计数只认 `census:<id> = <n>`，「两处照抄」改口成三处住户同抄；`## Change history` 记一行、front-matter 的 `version:` 同批 bump）
- Modify: `docs/kairos/overalls/2026-10-10-engine-doc-tooling-overall.md`（`## Phase inventory` 的 P28 行验收格里那三条子串，第二条从 `pinned by the named guard` 换成新措辞里的 `census registry`，并写明该条由本相位重锚；另两条子串与既有三个 pin 一字不动；`## Change history` 记一行、front-matter 的 `version:` 同批 bump）
- Test: `packages/kairos/tests/skill-anatomy.test.ts`（既有：标题面守恒）
- Create: `packages/kairos/tests/claim-shapes.test.ts`

#### Consumes
- 六条规则行（Task 2 · 3 · 4）与它们的档位（Task 1）
- 章程自修（Task 7）——翻位前它必须已在范围内合规

#### Produces
```text
# 无新类型：Produces 是消费面字节与一条 pin。三条 claim shape 的最终措辞就是下面这三行，
# 两个节点逐字照抄、不另造（spec §4 v0.17 的同一段引文）；narrative 一条的许可面是工作项，不是坐标
- **pin** — a behavior claim cites a colocated pin by module path + symbol name; a line coordinate is not a pin (`line-coordinate`)
- **count** — a count is stated only as `census:<id> = <n>`, the id taken from the census registry; a bare integer plus a count unit in prose is refused (`measure-literal`), as is an arithmetic over live counts (`live-arithmetic`); naming the guard that maintains the value is the reason for the reference, not its form
- **narrative** — a present-tense description of the tree as it stands is refused in a spec and in a plan alike: what belongs to the plan is the work item (`- Modify: <path>`), never a prose `path:line`; the condition that must hold belongs to the spec; restate such a description as that condition (`temporal-indicator` · `line-coordinate`)
```
```ts
// rules-severity.test.ts 的终态断言
expect(RULE_REGISTRY.filter((row) => row.severity === "warn")).toHaveLength(0);
```

#### Steps
- `cdd-spec-writer` 的 `author-spec` 节点把三条 claim shape 换成 Produces 里那段引文（逐字，不另造；每条点名对应规则行）— checkable: `claim-shapes.test.ts` 以 Produces 的三行为期望串，与两个节点逐字对读通过
- `cdd-plan` 的 `author-plan` 节点照抄同一组三行，同一次写入改 `Citations` 一条（只许可工作项，不再许可一句散文 `path:line`） — checkable: 两处字节相同（`claim-shapes.test.ts` 的第二条断言）；`Citations` 该行含 `- Modify: <path>` 且不含 `the path:line citation belongs to the plan`（旧许可的字节面，逐字对读）
- 第三个住户改口：`render/templates.ts` 的 `docNarrativeAxes` 的 count 一形改成只认 `census:<id> = <n>`，id 取自 census 登记表，「点名维持该值的守卫或测试」不再是合法形态，doc comment 里把散文计数称作 `the guard's business` 的那一句与同一括号里把计数称作 `a guarded count` 的那一处同批改口，计数改称 census 形态的名字；narrative 一句同批把许可面挪到工作项上（`what belongs to the plan is the work item` 与 `never a prose path:line`），第三条锚 `belongs to the plan` 因此守的是工作项那一半；同一批把 `templates.test.ts` 的第二条锚换成新措辞里的稳定子串 — checkable: `REVIEWS.spec.axesGuide` 含 `census registry` 且不含 `pinned by the named guard`，含 `what belongs to the plan is the work item` 且不含 `the path:line citation belongs to the plan`，`templates.test.ts` 的三条锚各命中一次；该 doc comment 不含 `a guarded count` 与 `the guard's business`（注释与正文同读，只改正文即红）；`pnpm -C packages/cdd-engine exec vitest run src-next/render/__tests__/templates.test.ts` exit 0
- 住户登记：spec §4 的 claim-shape 住户名单补上 rubric 这一处——`render/templates.ts` 的 `docNarrativeAxes` 与两个 skill 节点并列，同一组三行、计数只认 `census:<id> = <n>`，「两处照抄」改口成三处住户同抄；同一次写入在 spec 的 `## Change history` 记一行，front-matter 的 `version:` 随之 bump — checkable: spec §4 的住户名单含 `docNarrativeAxes`，且该处与两个 skill 节点、与 rubric 对同一句话给同一个答案（`claim-shapes.test.ts` 的期望串与 `templates.test.ts` 的锚指向同一组三行）；spec 的历史表最新一行的版本号等于 front-matter 的 `version:`
- 重锚登记：章程 `## Phase inventory` 的 P28 行验收格里那三条子串，第二条从 `pinned by the named guard` 换成新措辞里的 `census registry`，并写明该条由本相位重锚；另两条子串与既有三个 pin 一字不动；章程的 `## Change history` 记一行，front-matter 的 `version:` 随之 bump — checkable: 章程的 P28 行含 `census registry` 且不含 `pinned by the named guard`，另两条子串与 `typecheck` / `test command` / `Claimed→pin` 零 diff；章程历史表最新一行的版本号等于 front-matter 的 `version:`；`cdd review --type overall --spec docs/kairos/overalls/2026-10-10-engine-doc-tooling-overall.md` 判章程零拒绝
- 写 changeset：两个包键各记 **minor**——`@oscaner-skills/cdd-engine` 与 `@oscaner-skills/kairos`：后者是本次交付的 kairos 一半（两个 skill 节点都在 `packages/kairos/` 下，`.changeset/README.md` 对那一侧的改动同样要求 changeset，只改 skill 散文的先例也是 kairos minor）；条目列出六条规则行 · 五档渲染词 · 一条 `details` 行 · `evidence` 键 · 侧车两键 · 拒绝报文一种 — checkable: `pnpm exec changeset status` exit 0——点错成工作区外的包名时它照红，而 `pnpm run version-sync` 只审包版本收敛、读不到 `.changeset/` 下的文件，故不作本步的判据（版本收敛由本任务的全量门覆盖，`validate` 内含 `version-sync`）；changeset 文件的最外层带这两个键，档位同为 `minor`，无 YAML 误写
- 六条规则行的 `severity` 翻成 `"block"`，`skipWhenClosed: true` 不动；`rules-severity.test.ts` 的档位夹具与 Task 5 的五条渲染臂都建在经 `contract` 项注入的测试注册表上——判定盖章与渲染读的是同一条清单，故翻位不改这两条腿；同一批要改的是 `shape-rules.test.ts` 里那条档位断言、`it` 标题里的档位字面与 `describe` 标题（按改口后断言的事重写，文件头那句 `at landing` 按历史保留），并把终态断言写进 `rules-severity.test.ts`（两文件都已在 Files 列），两处的 `skipWhenClosed` 一臂一字不动 — checkable: `rules-severity.test.ts` 的终态断言为真（它是本步落地的——Task 1 建的文件里只有三条腿，无这一条）；`shape-rules.test.ts` 的 `describe` 标题含 `block` 与 `skip a closed document` 而不含 `land as`，`it` 标题读 `severity: block`，文件头那句 `all warn at landing` 零 diff；本步的 diff 只落 `rules.ts` 的六处档位、`shape-rules.test.ts` 的那三处字面与 `rules-severity.test.ts` 新增的那一条断言，`skill-anatomy.test.ts` 零 diff
- 全量门 — checkable: `pnpm run validate` exit 0（一处预期红在窗口内转绿：语料规模常量在 Task 1 复位；本任务只做翻位与消费面收口，不声明任何符号）
- 提交 — checkable: `git log -1 --format=%s` 以 `feat(p41):` 起头

#### Acceptance
两处的三行逐字相同且各点名规则行，并与 Produces 的引文逐字相同（narrative 一条的许可面是工作项——`what belongs to the plan is the work item`；逐字臂与 spec §4 的引文因此指名同一串字节）；`author-plan` 的 `Citations` 一条只许可工作项（`- Modify: <path>`），不再许可一句散文 `path:line`；`REVIEWS.spec.axesGuide` 的 count 一形只认 `census:<id> = <n>`（含 `census registry`、不含 `pinned by the named guard`），narrative 一句的许可面读工作项（含 `what belongs to the plan is the work item` 与 `never a prose path:line`，不含旧许可的 `the path:line citation belongs to the plan`），且 `templates.test.ts` 的三条锚各命中一次、`belongs to the plan` 挂在工作项那一半——三个住户对同一句话给的答案相同；`docNarrativeAxes` 的 doc comment 与正文同读（`a guarded count` 与 `the guard's business` 两处已同批改口，只改正文即红）；spec §4 的住户名单含 rubric 这一处，其历史表多一行、头部版本与该行相同，故设计面的登记与三个住户的实际字节不再分歧；章程 P28 行的验收格里第二条子串读 `census registry`、另两条与既有三个 pin 零 diff，章程的历史表多一行、头部版本与该行相同，故重新锚定的 pin 是登记过的一处决定而不是未记的漂移；`pnpm run validate` exit 0；`RULE_REGISTRY` 里无 `warn`，由 `rules-severity.test.ts` 新增的那条终态断言承（Task 1 的三条腿零改动，`shape-rules.test.ts` 的档位断言随翻位改口，其 `describe` 标题与 `it` 标题读改口后的事实、文件头那句 `at landing` 按历史零 diff）；changeset 两层同为 minor（`@oscaner-skills/cdd-engine` 与 `@oscaner-skills/kairos`），由 `pnpm exec changeset status` 判（点错包名即红）；`skill-anatomy.test.ts` 的标题面守恒（无新增标题）。

#### DependsOn
5, 6, 7

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.18 | 2026-11-20 | **delivery record**：八个任务四波全部交付，每波走实现 → 波评审 → 修复链；分支终审一轮八条全修（其中一条修掉了上一相位登记为「不属其交付面」的锁竞态 teardown）。波次结构按注册形态落地：W1 面图与档位基座 + 证据面 · W2 四条规则 + 日期行 + 一份住所 · W3 渲染与范围 + 章程自修 · W4 说明书与翻位 | Oscaner M. · Claude（kairos:cdd-close） |
| v0.17 | 2026-11-20 | 第十三轮评审回填（plan fix 13）：① **三条零臂落地**（F1）——Task 2 的 `measure-literal` 步多一条出集零臂（`42 widgets`）、`live-arithmetic` 步与 `temporal-indicator` 步各多一条重述零臂（差值与时序句改成必须成立的条件），Acceptance 的「四类各有一对」因此对四类都为真，不再只有三类；② **两形按已落地的形状声明**（F2）——`#### Produces` 与 Files 行把标题栈走读从 `ProseFace` 里分出来，`ProseWalk` 与判框都不导出，`SingleHomeInvariant` 同读那条走读，`ProseFace.gaps` 的单一调用点因此是模块内部事实；③ **facet 元素的三个投影按面拆开**（F3）——`properties` 读 json 面、facet 组读 `project.shape.overall.snap`、`slices` 读 `project.test.ts` 的派生等式，该命令不再替另两面作证。Task id 集与 `DependsOn` 集未动。正文按本文件自己要落的规则书写 | [human] · Claude（kairos:cdd-plan · docs-fix） |
| v0.16 | 2026-11-20 | 第十二轮评审回填（plan fix 12）：① **Task 8 的 claim shape 面追上 spec v0.17**（F1）——`#### Produces` 的 narrative 一条换成 spec §4 的同一段字节（plan 拥有的是工作项，不是一句散文 `path:line`，点名 `temporal-indicator` · `line-coordinate` 两行），`templates.test.ts` 的第三条锚 `belongs to the plan` 改挂到工作项那一半，`docNarrativeAxes` 那一行同时认领 narrative 一句，`cdd-plan` 的 `Citations` 一条入 Files 与第二步且其字节有 checkable 对读。② **`PreflightWords.closureUnavailable` 有了声明与逐字句子**（F2）——Task 5 的 `words.ts` 行转成第三个词、Objective 与推送那一步引 spec 的整句，checkable 两条成对断言以该词本身对读。③ **缺口的上报行点名**（F3）——Task 2 声明 `ProseFace.gaps` 的唯一调用点与「一条缺口恰一条 finding、其余三条文法零 finding」的臂。④ **plan 面自带载具**（F4）——Task 2 的坐标臂补一份 `#### Steps` 夹具（散文 `path:line` 报，行内代码段与工作项零报）。Task id 集与 `DependsOn` 集未动。正文按本文件自己要落的规则书写 | [human] · Claude（kairos:cdd-plan · docs-fix） |
| v0.15 | 2026-11-20 | **W8 wave 评审回填（fix 1）**：① **narrative 一条撤回「快照归 plan」的许可**（F2）——`temporal-indicator` 声明 `docKeys: "all"`，故「现在时叙述归 plan」是一句被它自己点名的规则行拒绝的许可；`#### Produces` 的引文改成「两个文档一律不许快照：`path:line` 引用归 plan，必须成立的条件归 spec」，两个 skill 节点与本任务 §4 引文同批；既有三条锚一字不动。② **rubric 的反向对读落地**（F1）——`templates.test.ts` 补一条：`REVIEWS.spec.axesGuide` 不含子弹行、不含四条规则行 id，本任务 Files 行随之登记。正文按本文件自己要落的规则书写 | [human] · Claude Opus 5（kairos:cdd-dev · tasks-8-fix 1） |
| v0.14 | 2026-11-20 | 第十一轮评审回填（plan fix 11）：① **重锚拿到登记面**（F1）——Task 8 增重锚登记步与章程 Files 行：`## Phase inventory` 的 P28 行验收格第二条子串换成 `census registry`、另两条与既有三个 pin 不重锚，章程历史记一行、版本同批 bump；② **第三个住户的登记有了主**（F2）——spec §4 的 claim-shape 住户名单补进 `render/templates.ts` 的 `docNarrativeAxes`（与两个 skill 节点并列、同一组三行、计数只认 `census:<id> = <n>`），spec 历史记一行、版本同批 bump，「登记归设计面、不在改动面」的悬空处置撤掉；③ **注释随正文一起改**（F3）——`a guarded count` 与 `the guard's business` 同批改口，那一步的 checkable 同时断言注释行。Task id 集与 `DependsOn` 集未动。正文按本相位自己的规则书写 | [human] · Claude（kairos:cdd-plan · docs-fix） |
| v0.13 | 2026-11-20 | 第十轮评审回填（plan fix 10）：① **spec 评审 rubric 补进 Task 8 的改动面**（F1）——`render/templates.ts` 的 `docNarrativeAxes` 与承它的 `templates.test.ts` 锚同批改口：计数只认 `census:<id> = <n>`，「点名维持该值的守卫或测试」不再是合法形态，doc comment 里那句同批改口；三个 claim shape 的住户对同一句话给同一个答案，第三个住户的登记归设计面；② **changeset 那一步换成会红的判据**（F2）——checkable 改读 `pnpm exec changeset status`（点错包名即红），`version-sync` 交回全量门；③ **翻位那一步的标题口径统一**（F3）——`describe` 按改口后的事实重写、`it` 只换档位字面，文件头 `at landing` 留作历史。Task id 集与 `DependsOn` 集未动。正文按本相位自己的规则书写 | [human] · Claude（kairos:cdd-plan · docs-fix） |
| v0.12 | 2026-11-20 | 第九轮评审回填（plan fix 9）：① **渲染面只留一条注册表**（F1）——Task 5 的构造面撤掉 `ruleRows?`，五条档位臂与 `skipped (closed document)` 臂改经既有的 `contract` 项注入测试注册表（`new Contract(testRegistry)`）：盖章的档位与渲染读的 `Contract.ruleRows()` 因此是同一条清单，某行重排档位时两侧一起动、不可能只红一处；Files · Consumes · Produces · Steps · Acceptance 与 Task 8 的翻位步同批改口，「一处定义」在 `session/` 面同样成立。正文按本相位自己的规则书写 | [human] · Claude（kairos:cdd-plan · docs-fix） |
| v0.11 | 2026-11-20 | 第八轮评审回填（plan fix 8）：① **终态 pin 断言有了落地面**（F1）——Task 8 的 Files 把 `rules-severity.test.ts` 从 `Test:` 改成 `Modify:` 并点名那一条终态断言（`RULE_REGISTRY` 里无 `warn`），翻位那一步的 diff 面因此收三处而非两处，零 diff 条款只留给 `skill-anatomy.test.ts`；② **生命周期面的审计访问器声明了缺省形态**（F2）——Task 5 的 Files · Produces · Steps · Acceptance 同批点名 `pinAudit?: () => PinAudit` 与「缺省回落到本类自己的记忆化工厂」，未供该访问器的十一处构造站点零改动。正文按本相位自己的规则书写 | [human] · Claude（kairos:cdd-plan · docs-fix） |
| v0.10 | 2026-11-20 | 第七轮评审回填（plan fix 7）：① **`shape-rules.test.ts` 入 Task 8 的改动面**（F1）——六条形状行的档位断言与承它的两条标题随翻位改口，`skipWhenClosed` 一臂不动，故全量门可达 exit 0；② **第三类重复句补上处置**（F2）——章程自己的回填纪律也是 `single-home` 的实账，Task 7 的 Objective · Files · Steps · Acceptance 四处点名，指针指向 P9 design 的 `## Constraints`，零命中臂覆盖三类；③ **Task 5 的两条档位臂与翻位解耦**（F3 · F4）——闭合副本的行表经构造面注入成 `block`，warn 判词臂经 `PreFlight` 的 `contract` 项注入测试注册表；④ **验收回填的格名改正**（F5）——P41 行重述的是 Scope ③ 的下界，Acceptance ③ 的严重度一条不动，Acceptance ⑥ 仍收工作项例外；⑤ **计数臂那一步的重复 checkable 删掉**（F6）；⑥ **身份面回归的坐标入 Task 1 的判据面**（F7）。正文按本相位自己的规则书写 | [human] · Claude（kairos:cdd-plan · docs-fix） |
| v0.9 | 2026-11-20 | **W2 第三轮 wave 评审回填（F1）**：① Task 2 与 Task 4 的 `#### Produces` 改成已落地的形状——Task 2 补字面面 `ProseLine`（行号 · 原文 · 剥段后三读）与 `ProseLines.of(content): readonly ProseLine[]`，`PinSpans` 的两条散文行读入册（`proseEntriesOf` 带行号、`proseOf` 是它的字符串面，`tokensOf` 读后者）；Task 4 补 `of` 的第二参 `from` 与三键返回（`text` · `prose` · `line`）、工作项判式 `isWorkItem` 与判定面 `sameCriterion`，`jaccard` 保留为阈值陈述的面；② 两处任务的 Files · Consumes · Steps · Acceptance 随同改口，围栏跳过一处定义改读 `PinSpans#proseEntriesOf`。正文按本相位自己的规则书写 | [human] · Claude（kairos:cdd-dev · docs-fix） |
| v0.8 | 2026-11-20 | 第六轮评审回填（plan fix 6）：① **章程验收回填入 Task 7**——`## Phase inventory` 的 P41 验收 ③ 改成下界量散文、⑥ 补工作项例外（同 slug 例外已由章程 v4.47 登记，本轮只补未登记的两处），并在章程的 `## Change history` 记一行、同批 bump 章程版本；Task 7 的 Objective · Files · Steps · Acceptance 四处同改；② **Task 4 补两条可判成对**：指针句（两句各抄同一条长路径 ⇒ 零报，同一路径两侧各配四十字符以上的散文 ⇒ 报）与工作项两半的散文括注（两半的唯一差别是列表标记）；③ **预期红窗口的终点改挂 Task 5**——四个未解析的 pin 名字全由 Task 5 声明，Task 8 的全量门只做翻位；④ Task 2 的 Acceptance 点名那两处窗口红不受判，P37 对里的 `= 0` 声明一字不动；⑤ Task 5 的两条计数臂逐条点名派发平面（零构造只对工作平面成立，判平面的 wave review 照构造一份）；⑥ Task 5 的派发类型臂与 single-spec 臂的行表经构造面注入成 block，`failed` 的读法不随翻位；⑦ `preflight.test.ts` 与 `cli.test.ts` 的计数从 `RULE_REGISTRY` 派生，两文件零 diff、用例标题无数词。正文按本相位自己的规则书写 | [human] · Claude（kairos:cdd-plan · docs-fix） |
| v0.7 | 2026-11-20 | **W2 wave 评审回填（F1 · F2）**：① 工作项行（`- Modify:` 一类）在 `single-home` 的两侧都不进域——它是文件点名不是判据，而同一份模板让每份 plan 逐字相同，比它等于判死模板；② 两侧必须读同一个归一化面（右域经 `ctx.translator`），否则含别名的中文判据永不命中；③ **长度下界按散文计**（去掉行内代码段之后），因为规则上线后判本文件时报出的两处里有一处是「两句各抄同一条路径」——路径不是散文。两条都进了 Task 4 的 Step 与 Acceptance | [human] · Claude（kairos:cdd-dev） |
| v0.6 | 2026-11-20 | 第五轮评审回填（plan fix 5）：① 本文件自身的三处时序措辞退到无符号分句——`## Constraints` 声明的「无挂符号的时序指示词」现由本文件满足（祖先栈的空读法写作「读作缺口」、无参构造写作「回到默认注册表」）；② Task 2 的散文扫描步骤补标题栈——扫描器把 `[...ancestors].reverse()` 交给 `FaceMap.roleOf` 的第三个参数，并补继承臂（`### 7.` 下的 `#### 7.5.1` 判作 `decision`）与两参形态的反证；③ Task 5 的构造面两项都声明缺省形态——闭合端口 `provenClosed?` 缺省 `() => false`（未供端口的构造站点零改动），行表 `ruleRows?` 缺省读 `Contract.ruleRows()`。正文按本相位自己的规则书写 | [human] · Claude（kairos:cdd-plan · docs-fix） |
| v0.5 | 2026-11-20 | 第四轮评审回填（plan fix 4）：① Task 6 的单判据句改写，分句切分口径钉在双写 `——` 上——Task 2 的文法声明与 Acceptance 补同一条读法（单写的一个 `—` 不切分句）；② 三处计数钉住的用例入册：`rules.test.ts` 随 Task 2 · 3 · 4 各改一次（批后终态 `toHaveLength(32)` · `30` · `2`），`preflight.test.ts` 的两处与 `cli.test.ts` 的一处随 Task 5 改到 `30`；③ `selector-coverage.test.ts` 的两处元素总数随 Task 1 的 facet 元素加一（`expect(total).toBe(112)`）；④ `handoff-schema.test.ts` 入 Task 6 的测试面，并点名两条带 `criterion` 的 `toEqual` 与一条混合载荷臂；⑤ 闭合端口收成单方法 `provenClosed`——「登记可用」由门读自己那份 `SlugIndex` 回答，审计的唯一构造处上移到组装点 `face/cli.ts`，`PreFlight` 与 `CliLifecycle` 收同一个访问器；⑥ 渲染面多一张可注入的规则行表（`PreFlight` 构造面的 `ruleRows`），五条档位成对臂建在它上面，翻位不改。正文按本相位自己的规则书写 | [human] · Claude（kairos:cdd-plan · docs-fix） |
| v0.4 | 2026-11-20 | 第三轮评审回填（plan fix 3）：① Task 8 的 changeset 记两层——`@oscaner-skills/cdd-engine` 与 `@oscaner-skills/kairos` 各 minor，两个 skill 节点是交付的 kairos 一半（`.changeset/README.md` 对 `packages/kairos/` 的改动同样要求 changeset），Acceptance 与 Objective 同改；② 扫描面的输入点名为 `JudgeContext.text`（行源交出的正文，YAML 头不在其中），`contract/judge.ts` 入 Task 2 与 Task 4 的改动面，并补 front-matter 臂（头里的测量字面与坐标零报）；③ Task 1 的改动面补 `judge.test.ts` · `declare.test.ts` 与两张 overall 快照，`.name` 改读 `binding.strategy.name`；④ `GradingViolation` 增 `criterion` 判别键，`#gradingRefusal` 按词分组逐段渲染并补混合轮臂；⑤ 闭合读数的构造处收在 `face/lifecycle.ts` 的记忆化访问器上（`face/lifecycle.ts` 入 Task 5 的改动面），并补 review 派发的计数臂；⑥ 闭合端口增 `closureProvable()`，无总体那条 `details` 行有了唯一触发键；⑦ `roleOf` 的第二个参数改名 `heading`；⑧ 「唯一盖章点」限定为已声明规则。正文按本相位自己的规则书写 | [human] · Claude（kairos:cdd-plan · docs-fix） |
| v0.3 | 2026-11-20 | 第二轮评审回填（plan fix 2）：① 闭合范围收窄到六条形状行——`RuleDeclaration` 增 `skipWhenClosed`，`DocOutcome` 不加 `closed-document` 类（`judged` 增 `closed`），`#ruleRows` 只对带旗标的行读 `skipped (closed document)`，并补一条闭合夹具上非形状违例照拒的成对臂；② 面图的解析面写成元素的 `valuePattern`/`selector` 加继承规则，补 `### Task 1:` 与 `### N.`/`#### N.M` 的夹具；③ 补 overall docKey 的成对臂（`## Constraints` 报、带后缀的 `### 设计决策留存（…）` 零报）；④ `PinSpans` 长一条围栏感知的散文行读 `proseOf` 并进 Task 2 的改动面；⑤ 档位改由草稿与盖章两形分离——`FindingDraft` 归策略、`Finding` 由 `Contract.stamped` 盖，`policy` 收可注入注册表，`warn` 夹具不碰真实行；⑥ 闭合端口点名 `PinAudit#provenClosed` 并要求按首次使用解析；⑦ 测量字面补左边界（小数与带点编号）的夹具；⑧ Task 6 删去 `census.guard.test.ts` 的「无关」改动行，改为核对说明。正文按本相位自己的规则书写 | [human] · Claude（kairos:cdd-plan · docs-fix） |
| v0.2 | 2026-11-20 | 首轮评审回填（plan fix 1）：① 面图元素按同秩 facet 声明——`### 设计决策留存` 取前缀锚、前缀式 `valuePattern` 与 `home: "facet"`，json 面三条投影与 `gaps()` 的成对反证写进 checkable；② Task 5 补「存在 block 命中即拒」的判词步与它的成对臂；③ Task 1 补语料规模常量的复位步（它是判断、属同批义务，不随实现自愈）；④ 档位声明上移到 `RuleDeclaration` 联合、工厂名改 `create`、`contract/judge.ts` 入册、既有行数改正；⑤ 闭合读数改名 `provenClosed` 并点名组装点 `face/cli.ts`，形状门的夹具与断言改用 `session/__tests__/preflight-rows.test.ts`；⑥ 证据面的判据行按 `CriteriaRow` 的真实六键声明，并点名 face 名册那一条用例；⑦ 三条 claim shape 的字节进 Task 8 的 Produces，`census:criteria.rows` 改占位形态；⑧ 待创建测试路径改 `Create:` 行，窗口内两处预期红写进 Constraints；⑨ Task 7 的终态命令补 `--spec`；⑩ 补两处缺失的验收臂（闭合文档在右域、无格点名的 single-spec）。正文按本相位自己的规则书写 | [human] · Claude（kairos:cdd-plan · docs-fix） |
| v0.1 | 2026-11-20 | 首版：八任务四波 `{1,6} → {2,3,4} → {5,7} → {8}`。切分按 spec 的五组交付走：面图与档位基座（T1）· 四类可变量的四条规则行（T2）· 记录面日期行（T3）· 一份住所（T4）· 档位渲染与生命周期范围（T5）· 证据面（T6，与 T1 同波且无依赖）· 章程自修（T7）· 消费面收口含翻位与 pin（T8）。起草时撞到一处设计缺口并按 `backfill-design` 回填：spec v0.8 增同 slug 豁免（plan 的 Acceptance 本就是 spec 判据的可核形态）。正文按本相位自己的六条规则书写 | [human] · Claude（kairos:cdd-plan） |
