---
title: '引擎文档工具（Engine Doc-Tooling）— P36 设计：身份面收权（身份域 × 产物矩阵 · 缺席有门 · 形状可发现）'
doc-type: phase-spec
version: v0.10
date: 2026-11-15
slug: '2026-10-10-engine-doc-tooling-p36'
program: 2026-10-10-engine-doc-tooling
parent-version: v3.76
author: '[human] 裁定 · Claude（kairos:cdd-design · 2026-11-15）'
---

## Design

两个 issue、一个病：**身份被第二次表达**。

issue #484 说裁决 sidecar 的路径拼不出来、条目键名反直觉；issue #485 说 plan 派发按文件名推导设计规格、与同一包里按 slug 索引的 `cross-doc-chain` 给出相反结论。两条的表面症状不同（一个静默、一个硬停），病灶是同一句：**身份已经由 `RoundNaming` / `SlugIndex` 收成单源了，但只要某个面没被登记进去，它就会退回到「用另一个名字去猜」——猜出来的名字看起来完全合法，只是属于另一个坐标，而没有任何门看得见。**

本相位因此不分头修两个 issue，而是把「身份」升成一等公民，收成**身份域 × 产物 kind 的矩阵**：

- **身份域**回答「身份从哪来」：`round`（frame + 账本记录，派生）· `doc`（front-matter `slug:`，声明）· `workspace`（常量：三个无坐标字面量 + brief 的 `tasks` 坐标）。
- **kind** 回答「哪些文件属于这个身份」：每个 kind 一行，声明 `author` / `identityFrom` / 名字规则 / `sealed` / `misplaced` / 归主文法 / 标识词表。**矩阵不设 `absence` 列：缺席永不阻断**（§2.3）。
- **两个端口**：`attribute(name) → 身份 + kind | unknown`（三域都有）与 `render(身份, kind) → 名字`（**只有 `identityFrom: "rendered"` 的行有**）。一条往返 pin 把两端口绑死，逐行枚举（§2.2）。
- **一个判别值**：`absent · ok(path) · invalid(reason, found?) · misplaced(derived, found[])`，策略由行声明，不再由「哪个分支返回了空串」决定。
- **一个观测面**：board 只渲染矩阵的差异，永不持有名字规则。

三件不破坏的事：既有的**工作拼写**逐字节不变（P31/P34 已交付 pin 只增不翻）；`INPUT_RULINGS` 的 fix-only 语义与 round-context 行序不动；`next:` 字面（D70）与健康树的板面字节不动。

一件**主动放弃**的事：历史拼写的可读性。`RETIRED_SPEC_*` 与 P34 的无 cycle implement 读法一并拆除（§3），P34 §2.6 的「历史零迁移可读」收窄为「历史文件不被删除、不被改写；引擎不再识别历史拼写」。依据是数据：这族读法只服务已关闭的 workspace，而它们不会再被派发。

### 1. 病根

#### 1.1 一条链、三处断点（#484）

| # | 断点 | 注册时事实（D92 · P36 注册基线；已交付面随注当前符号） | 症状 |
| --- | --- | --- | --- |
| ① | **路径由文件名派生** | 注册时 `CarrierRulings.pathFor` 按 `--reviews` 实参的**完整文件名**换尾；同轮 workspace 并存 `<line>-<op>-<n>.json`（draft）与 `<line>-<op>-<n>.c<N>.json`（final），于是推导名随拼写漂移——传 draft 得 draft stem、传 final 得 `.c<N>` stem，写入方无从判定（**已交付**：该成员删除，sidecar 名字改由矩阵 `render(identity, "rulings")` 渲染） | **issue 提交方那个消费仓**实测 89 个 sidecar / 位于推导路径 0 个（该仓把 sidecar 一律写成 draft stem）；**本仓是反向标定**：51 个 `*.rulings.json` 全部落在 `.c<N>` 终稿 stem（`pathFor` 的推导路径命中）——所以缺陷是**写读约定分叉**，不是「路径无处可达」 |
| ② | **缺席静默** | `#rulingsInputOf`（`face/lifecycle.ts`）对 `absent` 返回空串，装配器丢整行；`invalid` 才派发前硬停 | 最可能的人为错误落在唯一无痕的分支：exit 0、handoff 照常落盘 |
| ③ | **形状无发现面** | 条目只认 `{finding, ruling, at?, by?}`，而邻接产物一律用 `id`；`schema get` 只登记 doc type | 写对路径、写错键名 ⇒ 整份拒；写错路径 ⇒ 连线索都看不到 |
| ④ | **消费面无入口** | 六个 `cdd-*` skill 零处提 sidecar；唯一线索 `FIX_READBACK_SUFFIX` 教的是**规则**不是解析结果 | 落点知识只能来自源码考古 |

#### 1.2 第四次复发

| 复发 | 形态 | 修法 | 是否根治 |
| --- | --- | --- | --- |
| P34 前 | `finalName(draftName, round)` + `families` 的 `{round}` 占位替换 | 名字收进 `RoundNaming` | 只治引擎自有 kind |
| P34 | `RoundRecord.carrierPath` / `draftPath` 两份坐标副本 | 路径由身份派生、字段退役 | 同上 |
| P15 | board 由文件名反推身份 | 身份改 front-matter `slug:` | 同上 |
| **P31（#484）** | `CarrierRulings.pathFor(carrierPath)` | 未修 | —— |
| **4.12.0（#485）** | `PlanSource#orphanOf` 拼 `<slug>-design.md` | 未修 | —— |

病句形式化：**某个产物的名字由另一个**名字**派生 ⇒ 身份被第二次表达。** 第二次表达没有门，因为门径向「名字是否合规」判，而第二次表达产出的名字**恰好合规**——它只是属于另一个坐标。

#### 1.3 同一个病的第二个门（#485）

| 面 | 注册时实现 | 对同一份文档的结论 |
| --- | --- | --- |
| `cross-doc-chain`（`contract/invariants.ts`） | 注册时 `SlugIndex.identityDoc(slug)`（按 front-matter `slug:` 建组）；**已交付**：该成员退役，改问 `hasIdentity(slug)`（即 `docsOf(slug)` 的 n ≥ 1） | 通过 |
| `plan-carrier` 腿（`PlanSource#orphanOf` · `infra/plan-source.ts`） | `` `${docRoots.specs}/${slug}-design.md` `` + `fs.exists` | 恒不存在（slug 自带 `-design` 时拼成 `-design-design.md`） |

后果：`review --type plan`、`implement --tasks`、`review --type branch` 三类派发全部硬停，而 `board` 同一份 plan 仍正常显示 spec 行——同一份文档，两个面给出相反结论。issue 实测：一个仓 26 份 plan 有 12 份被挡下。

更刺眼的是：**索引里已经有 plan 条目，`readFor` 却不用**。`readFor(entry)` 的 `entry` 是**身份文档**（phase-spec / overall）条目——它的 `rel` 是 `specs/<name>-design.md`，不是 plan；`plans/<slug>.md` 是同一个 slug 派生出的**第二个名字**（`DocEntry` 有 `path` 与 `rel`，`infra/slug-index.ts`；`docsOf(slug)` 的 plan 行本来就带着 `plans/<slug>.md` 的 `rel`）。于是同一份身份被表达两次，第二次还落在另一个坐标上：把 `entry.rel` 直接当 plan 读会把设计规格解析成 plan，doc 轮与 board 每个 phase 的 plan 行一起 degrade——#485 的「放行」正是靠错文件达成的。pin 就在这一对，只是两半不在同一段：入参是 `infra/__tests__/plan-source.test.ts:213-227` 里 `rel: specs/prog-p1-design.md` 的条目（该格断言 `kind === "undeclared"`），而真正被打开的 `plans/prog-p1.md` 在健康读那格 `:173-183` 才被断言。

拒绝文案再把病因指错一层：说「the plan's slug names no design spec」并给两条互斥修法（补规格 / 改 slug），而 slug 本身是对的；照做会造出 `-design-design.md`，或改坏一个同时是 workspace 目录名的身份。本相位的裁决是把这条反查从「问名字」改成「问身份」（三态，§2.7）。

#### 1.4 工作区层的老账

| 字面量 | 符号 pin | 现状 |
| --- | --- | --- |
| `"progress.json"` | `Ledger#readProgress` / `Ledger#writeProgress`（`session/ledger.ts`） | 读写各拼一次 |
| `"base.json"` | `Artifacts#baseSet` / `Artifacts#readBase`（`face/artifacts.ts`）· `Cli#baseBranchOf`（`face/cli.ts`） | 写面与读面各拼一次 |
| `"in-flight.json"` | `InFlight.FILE`（`session/inflight.ts`）· 已交付为 `ArtifactRegistry.nameOf("in-flight", null)` | 常量单源，已入矩阵（`in-flight` 行是唯一拼写处） |
| `tasks-{tasks}-brief.md` | `RoundNaming#briefName`（`session/round-naming.ts`） | 已在命名单源内，却自陈「不是轮次产物」——正好证明矩阵缺口 |

#### 1.5 全树审计：散落项与裁定

**Round 域**

| 项 | 符号 pin | 病灶 | 裁定 |
| --- | --- | --- | --- |
| `pathFor` | `CarrierRulings.pathFor`（`session/carrier-rulings.ts`） | 名字由文件名派生 | 删 → 矩阵 `rulings` 行 |
| `carrierPattern` / `CARRIER` | `session/round-naming.ts` 的 `carrierPattern`（`:41`）与 `CARRIER`（`:56`） | 拼写知识 #1（渲染端） | 归矩阵 pattern |
| `#WAVE_CARRIER` / `#LINE_CARRIER` | `Ledger.#WAVE_CARRIER` / `Ledger.#LINE_CARRIER` | 拼写知识 #2（归属端） | 归 `attribute` |
| `RULINGS_SUFFIX` | `CarrierSeal`（`infra/carrier-seal.ts`）——**已交付**：该常量删除，改问矩阵的 `sealed` 行（`rowOf(kind)?.sealed`） | 拼写知识 #3（写保护端） | 归 `sealed` 列 |
| `RETIRED_SPEC_KEY` / `RETIRED_SPEC_LINE_KEYS` | `session/ledger.ts` 的两个常量，消费点按符号枚举（不写计数，清单见 §3.1） | 第二张「行键 → 行」表 | **拆除**（§3） |
| `#retiredCarrierName` / `#legacyCarrierName` / `#ownerRow` / `#lineWord` | `Ledger.#retiredCarrierName` · `Ledger.#legacyCarrierName` · `Ledger.#ownerRow` · `Ledger.#lineWord`（`session/ledger.ts`） | 旧拼写读法 | **拆除**（§3） |

**Doc 域**

| 项 | 符号 pin | 病灶 | 裁定 |
| --- | --- | --- | --- |
| `<slug>.md` 派生 | `PlanSource#readFor`（`infra/plan-source.ts`） | plan 也是 slug 的派生名——索引里已有 plan 条目却不用 | 改问索引，**同一套三态**：plan 行 → `entry.rel`；无 plan 行 **且** plans 根扫描面干净 ⇒ `undeclared`；无 plan 行**而** plans 根不干净 ⇒ 未判态（零拒绝、不冒充「没有 plan」，§2.7） |
| `<slug>-design.md` 派生 | `PlanSource#orphanOf`（`infra/plan-source.ts`） | #485 直接病因 | **删除派生**：改问身份的**三态**反查（§2.7）——索引有该 slug 的身份文档 ⇒ 放行；索引干净缺失 ⇒ `spec-absent`；扫描面不干净 ⇒ 未判态 |
| 索引五处入口 | `Cli#sceneOf` / `Cli#runBoard` / `Cli#runWork`（`face/cli.ts`）· `PreFlight#vet`（`session/preflight.ts`）· `DocContractChain` 的 `cross-doc-chain`（`contract/invariants.ts`） | 同一索引各建一次 | **单建一次随 scene/ctx**（五处 → 三处：一处 scene/ctx 构造 + 两个 `?? build` 兜底，§2.9 ⑤） |
| `identityDoc` / `planOf` 取第一份 | `SlugIndex#identityDoc` / `SlugIndex#planOf`（`infra/slug-index.ts`）——**已交付**：两者退役，同处是 `docsOf(slug)`（集合，0/1/n）与 `hasIdentity(slug)` | 判定面已有 `duplicate-identity` / `duplicate-plan`，读取面却静默 | 同型多份 ⇒ `read` 回 `invalid(found)`；跨型多份 ⇒ 集合口 n > 1（§4.4） |
| help 示例写死文档路径 | `face/declare.ts` 的 `example` 四行——`implement` · `review` · `base set` · `board`，全部 `` `${ENGINE_DOC_ROOTS.…}/<doc>` `` | 文案在教命名约定（`p3.md` 三处 + `p3-design.md` 一处） | 四处全改 `--plan <path>` / `--spec <path>` 形，文档根零插值（§2.9 ④） |

**Workspace 域**：§1.4 的四个字面量入表。

**已经是单源、不动**：`SLUG_VALUE_PATTERN → SlugIndex` 同一字符串编译 · `RepoRoot` / `#rel`（P9）· `RoundNaming.renderName` 的六 kind 渲染（P34）。

#### 1.6 为什么不加特判

- **只修 #484**（变体探测 + 存在性硬停 + `schema get rulings`）：三处都停在「给这一例加特判」，下一个编排者产物来了同一场讨论重演。settled 时这三样**已撤销**：`schema get rulings` 独立发现面与「壳条目形状」两笔**不在本相位范围**（v3.73 注册 → settled 撤销），矩阵 + 判别值 + 别名取代它们。
- **只修 #485**（`#orphanOf` 改问索引）：plan 面通了，`readFor` 仍由身份 slug 派生 `plans/<slug>.md` 而不问索引里的 plan 条目，矩阵外的第三个名字源还在。
- **`schema get artifacts` 独立发现面**：三个消费者场景（落点 / 写错没 / 盘上有什么）已分别由「读回印派生路径」「`CDD_BLOCKED: artifact-identity` 报文」「`cdd board --artifacts`」覆盖，第四面无人读即债。
- **开放溯源图**：节点集开放 ⇒ 未登记即无声；且今天的消费者问的全是函数 `file → owning identity`，没有一个是边。
- **内容寻址**：P34 已否决（摧毁可寻址交接）。
- **让 `absent` 也渲染期望路径**：翻掉 P31 §2.5 的成对钉，属规格变更。
- **保留 legacy 读法**：见 §3。

### 2. 裁定

#### 2.1 一张矩阵：身份域 × 产物 kind

```ts
type ArtifactRow = {
  readonly domain: "round" | "doc" | "workspace";
  readonly author: "engine" | "orchestrator" | "human";
  readonly sealed: boolean;
  readonly identifier?: IdentifierVocabulary;
  readonly policy?: string;
} & (
  | { readonly identityFrom: "rendered";
      readonly render: (identity: Identity, kind: Kind) => string;
      readonly misplaced: "block" }
  | { readonly identityFrom: "declared" }   // front-matter `slug:`；无渲染名，`misplaced` 不适用
);
```

矩阵**没有 `absence` 列**：缺席是读取事实而不是行策略，**永不阻断**（§2.3）；唯一与缺席相关的说明挂在 `rulings` 行自己的 policy 上。

| 域 | kind | author | identityFrom | 名字 | sealed | 策略（policy） |
| --- | --- | --- | --- | --- | --- | --- |
| round | `draft` | engine | rendered | 现有规则，**逐字节不变** | **true** | 归主文法见 §2.5 |
| round | `final` | engine | rendered | 现有规则，**逐字节不变** | **true** | 归主文法见 §2.5 |
| round | `report` | engine | rendered | `<stem>-report.md`，不变 | **false** | 不参与归属门 |
| round | `log` | engine | rendered | `<stem>.log`，不变 | **false** | 不参与归属门 |
| round | `crash` | engine | rendered | `crash-<stem>.json`，不变 | **false** | 不参与归属门 |
| round | `evidence` | engine | rendered | `<stem>-test-evidence.json`，不变 | **false** | 不参与归属门 |
| round | **`rulings`（新增）** | **orchestrator** | rendered | `<line>-<op>-<cycle>[-a<n>].c<cycle>.rulings.json`（与 `final` 同 stem，**由身份渲染**；attempt 为 1 时 `-a<n>` 不出现——渲染器从不铸 `-a1`；无 cycle 身份 ⇒ `<line>-<op>.rulings.json`，与 `final` 同 stem，缺省坐标不铸段） | **false** | **缺席合法**（裁决尚未记录不是缺陷）+ 归主文法见 §2.5 |
| workspace | `progress` | engine | rendered | `progress.json`，不变（坐标 `tasks: null`） | **false** | —— |
| workspace | `base` | engine | rendered | `base.json`，不变（坐标 `tasks: null`） | **false** | —— |
| workspace | `in-flight` | engine | rendered | `in-flight.json`，不变（坐标 `tasks: null`） | **false** | —— |
| workspace | `brief` | engine | rendered | `tasks-{tasks}-brief.md`，不变（坐标 `tasks` 必填） | **false** | 唯一带坐标的 workspace kind |
| doc | `overall` | human | **declared** | **无规则**（自由命名；身份由 `slug:` 自述，读取一律经索引） | **false** | 文件名与 `slug:` 不符合法 |
| doc | `phase-spec` | human | **declared** | **无规则** | **false** | 同上 |
| doc | `single-spec` | human | **declared** | **无规则** | **false** | 同上 |
| doc | `plan` | human | **declared** | **无规则** | **false** | 同上；反查三态见 §2.7 |

`rulings` 与 `final` 同 stem 是刻意的：sidecar 是「这一轮的评审载体」的附件，坐标必须是 `(line, op, cycle, attempt)`，于是 `--reviews` 传 draft 还是 final 都不再影响它——`pathFor` 的整个存在理由消失。注意这不是文字游戏：它由**身份**渲染，与 `final` 共用四段拼接，**不是对 `final` 的名字做字符串替换**（后者正是 `pathFor` 的错法）。

**身份只有一个来源**：`rulings` 的坐标 = `attribute(path.basename(the --reviews 载体))` 回出的那一个 round 身份——即**被评审的那一轮**，`op` 恒为 `review`、`cycle` / `attempt` 取该载体自己的坐标。门的 `derived:` 段（§2.4）、§2.10 的读回值、`#rulingsInputOf` 的路径行都从这一个身份渲染；**不得**用本轮（fix 轮）的身份算——那会铸出 `plan-fix-1.c1.rulings.json`，一个没有门看得见、child 却会照着写的第二个表达式，正是本相位要消的那个病。

身份的判别联合与家在何处：

```ts
type Identity =
  | { domain: "round"; line: string; op: OpType; cycle?: number | string; attempt?: number }
  | { domain: "doc"; slug: string; docType: DocKey }
  | { domain: "workspace"; tasks: string | null };
```

- `tasks` 是 brief 的名字坐标，也是 workspace 域唯一会变的量：`progress` / `base` / `in-flight` 三个字面量恒取 `tasks: null`（渲染它们时 `tasks` 必须为 `null`，brief 必须非 `null`）。选这一形态而非给 `render` 加可选参数，是因为往返 pin 必须**全**：若 `tasks` 只有 `render` 看得见，`attribute("tasks-3-brief.md")` 就回不出同一身份，pin 在那一行不可满足（评审 blocker 的修法二）。
- round 身份的 `cycle` / `attempt` **保持可选**（`cycle?: number | string` / `attempt?: number`，与 `RoundArtifact` 同形）：无 cycle 的拼写（`tasks-<n>-implement.json`、draft 与 final 同名）是这两个成员的**合法取值**，不是待清理的例外——P34 那条 pin（`session/__tests__/round-naming.test.ts:99-103`）原样保留，矩阵只许在它之上新增行。渲染器对缺省坐标只是不铸那一段，于是 `rulings` 与 `final` 仍同 stem：无 cycle 身份 ⇔ `<line>-<op>.rulings.json`。
- **行集只有一个家**：矩阵（含 doc 四行）、两个端口、`RoundDomain`、`WorkspaceDomain` 全部住 `session/round-artifacts.ts`（`RoundDomain` 即 `RoundNaming` 的扩行，旧名保留为别名）。`infra/slug-index.ts` 只是 doc 域端口的**实现**（`attribute` / `locate` 的委托对象），`DocDomain` 不再有第二个路径推导处。封闭集门按行集那一处建。
- `CarrierRulings` 保留严格 schema 判定，路径改由矩阵渲染，但**入参仍带 carrier 的事实**：`read(sidecarPath, carrierPath)` / `verdict(sidecarPath, carrierPath, findingIds)`，其中 `sidecarPath` 是 `render(identity, "rulings")` 经 `Workspace#resolve` 的结果，`carrierPath` 是本轮的 `--reviews` 载体。理由是严格 schema 的一条既有判定：顶层可选键 `carrier` 必须等于 `path.basename(carrierPath)`（本仓 51/51 个 sidecar 都带该键），只拿渲染出的 sidecar 路径时这条比对永不成立 ⇒ 升级后每个合法 sidecar 都被判 `invalid`、派发前硬停，翻掉「门不变」。所以矩阵只接管**名字**，`carrier` 键继续读 carrier 自身的事实——两个方向各自只有一个来源，任一方向都不得由另一侧的字符串反推。

#### 2.2 三个身份域，一个契约

```ts
interface IdentityDomain {
  readonly domain: "round" | "doc" | "workspace";
  kinds(): readonly Kind[];
  entries(): readonly MatrixEntry[];                        // 本域的 (kind, row) 行表，矩阵聚合的输入
  attribute(name: string): Attributed | null;               // 名字 → 身份 + kind（三域都有）
  locate(identity: Identity, kind: Kind, base: Workspace): string | null;   // 路径：rendered 域渲染，declared 域取 entry.rel
  read(identity: Identity, kind: Kind, base: Workspace): ArtifactRead;      // 一份读取，判别值
}
```

- **`base` 是读取时的坐标，不是构造绑定**：矩阵描述名字，一条命令观察多个 workspace——一个板面同时渲多个 node workspace，域若在构造期绑死一个目录，就会把另一个 node 的名字解析到本目录（合法名字、错坐标，正是本相位要收的那个病）。`locate` / `read` 因此收 `base: Workspace` 参数，域实例本身不持目录。
- **一个聚合对象，一个实例**：`ArtifactRegistry` 是矩阵的公共端口——`entries()` / `rows()` / `rowOf(kind)` / `render(identity, kind)` / `attribute(name)` / `locate(…)` / `read(…)`，外加无实例静态入口 `nameOf(kind, tasks)`（workspace 三字面量与 brief 的同一个 `render`，供不持 registry 的读点用**同一套拼写**）。实例由组合根**每条命令建一个**，`Cli#indexOf` 拿到索引后就地 `bindDocIndex(index)` 把声明域换进**同一个**实例（零第二实例、零模块级默认实例），于是「每个读面持有同一个实例」是接线事实而非期望。
- `RoundDomain` — `RoundNaming` 扩行 + `rulings`；`attribute` 取代 `carrierPattern` 与 `#WAVE_CARRIER` / `#LINE_CARRIER` 两套正则。
- `DocDomain` — **身份类（identity class）由索引的集合端口回答**：`docsOf(slug): readonly DocEntry[]`（0 / 1 / n，**永不选第一份**）与 `hasIdentity(slug): boolean`（n ≥ 1）。凡是问「这个 slug 名下有没有/有哪几份身份文档」的消费者（板面的 spec 格、`planChain`）都读这个集合口，不读 `read`——`read(identity, kind)` 按**声明的 `docType`** 单值判定，而身份类跨 `overall` / `phase-spec` / `single-spec` 三型，单值读答不出「三型里共有几份」。`attribute(name)` 因此保持 `Attributed | null` 两态（名字 → 身份是一对一），歧义不在 `attribute` 上判。
- `DocDomain` — **没有 `render`**：不是「渲染失败」，是「文档没有名字规则」这一事实；`attribute` / `locate` 委托索引（`locate` 取 `entry.rel`），`read` 委托索引 + 文档读取。plan 的路径同样来自索引：`locate({domain: "doc", slug, docType: "plan"}, "plan")` 取 `docsOf(slug)` 里那行 plan 的 `rel`——**恰一份**才取（`locate` 对 0 份与 ≥2 份都回 `null`，所以调用方必须问集合，不能只看 `null`）；无 plan 行时按 plans 根扫描面分两格——干净 ⇒ `undeclared`，不干净 ⇒ 未判态（零拒绝，§2.7）；**≥2 行**时不得答 `undeclared`：它落身份标记面（板面 `MARK_SLUG_DUPLICATED` + 集合内全部 `rel`、`next:` 不印 `kairos:cdd-plan`），派发由既有 `SlugIndex#slugVerdict` 的 `duplicated` 挡下（§2.7 第四格）。身份文档条目的 `rel` 是它自己的 spec 路径，**不得**当作 plan 路径（§1.3）。`render(slug, "phase-spec")` 式的推导（`<slug>-design.md`）从引擎侧铲除。
- `WorkspaceDomain` — 三个无坐标字面量 + brief 的 `tasks` 坐标；`attribute` 认四个字面量并回出对应坐标。

往返 pin 只绑 `identityFrom: "rendered"` 的行，**逐行枚举**（不是一句话概括）：`attribute(render(identity, kind)) === { identity, kind }`，其中身份为该行的坐标形态——`draft` / `final` / `report` / `log` / `crash` / `evidence` / `rulings` 取 round 身份（含 `cycle` / `attempt` 缺席的无 cycle 形态，同样逐行跑）；`progress` / `base` / `in-flight` 取 `{ domain: "workspace", tasks: null }`；`brief` 取 `{ domain: "workspace", tasks: "<组>" }`（P34 已有渲染侧单射，这里补**渲染 ∘ 反解 = id** 的另一半）。声明物（doc 四行）不参与该 pin，它的保障是 §2.9 ④。

#### 2.3 读取收成一个判别值

```ts
type ArtifactRead =
  | { kind: "absent" }
  | { kind: "ok"; path: string }
  | { kind: "invalid"; path: string; found?: readonly string[]; reason: string }
  | { kind: "misplaced"; derived: string; found: readonly string[]; identity: Identity };
```

| 情形 | 策略 | 行为 |
| --- | --- | --- |
| 推导名在盘上、schema 合法，**且该身份没有其它能归主的名字** | — | `ok`，round context 只印一行路径（正文不进 round context，§2.10）；同身份另有一个能归主的名字 ⇒ 落 `misplaced` 臂（§4.1：一并列出、不选） |
| 推导名在盘上但 schema 非法 | `invalid` ⇒ block | 派发前硬停（现行为，不变） |
| 推导名缺失、同轮 stem 变体存在 | `misplaced` ⇒ **block** | 派发前硬停（§2.4） |
| 推导名与变体都缺失 | `absent` ⇒ **永不阻断** | `rulings` 面静默（**prompt 字节与今日逐字节相同**）；其余读点各自走既有失败通道 |
| 名字能归主但不等于渲染名 | `misplaced` ⇒ block | 同上（归主文法见 §2.5） |
| 同一 `(slug, docType)` 命中 ≥2 份身份文档 | `invalid(found: [a, b])` ⇒ block | doc 域 `read` 按**声明的 `docType`** 单值判定，回 `invalid` 并列出全部 `rel`，永不取第一份（§4.4）；`attribute` 仍回身份（名字本身无歧义） |
| 同一 slug 跨 `overall` / `phase-spec` / `single-spec` 命中 ≥2 份 | 集合端口 `docsOf(slug)` 回 n > 1（**不是** `read` 的一个结果） | 身份类跨三型，单值读答不出「共有几份」：板面渲 `MARK_SLUG_DUPLICATED` + 集合内全部 `rel`，派发由既有 `SlugIndex#slugVerdict` 的 `duplicated`（`duplicatedRolesOf` 已看 `identity` / `plan` 两类重复）挡下（§4.4） |

`misplaced` 不引入新扫描面：`attribute` 已在矩阵里，把「同轮同 kind 的名字」反解出来即可。这一条是 issue ① 的严格版：不是「探测存在的变体」，而是「**任何能归主的名字都必须等于渲染名**」。

**一份读取、两个消费者**（P35 的教训直接适用）：判别值由 `face/lifecycle.ts` 的 `#artifactReadOf(frame, kind)` 一次算出，prompt 格（`#valuesOf`）与派发门（`#artifactRefusal`，取代 `#rulingsRefusal`）读同一个值。

**缺席不进矩阵**：`progress` / `base` / `in-flight` / doc 四行的「文件不在」是各自读点既有的失败通道（账本缺失、base 未设、文档未声明），不给它们加一条矩阵级策略——一个命名相位不伪装成行为相位；`rulings` 的「裁决尚未记录」是**合法状态**，写在该行 policy 上（§2.1），不得因缺席拦派发、不得伪造路径（P31 §2.5 成对钉原样保留）。

#### 2.4 `misplaced = block`：报文四段，只拒不改

门的位置与 `#rulingsRefusal` 今日相同（`face/lifecycle.ts` 的 `#dispatch`，取在飞记录之前、seal 之前）。reason 词新增 `artifact-identity`，落在既有 `CDD_BLOCKED` 通道。

```
CDD_BLOCKED: artifact-identity · the round's `rulings` sidecar sits off its rendered name
  derived:  .kairos/cdd/<ws>/plan-review-1.c1.rulings.json
  found:    .kairos/cdd/<ws>/plan-review-1.rulings.json
  identity: line=plan · op=review · cycle=1 · attempt=1
  repair:   rename the found file to the derived name — the engine never moves,
            rewrites or deletes an artifact; the workspace is yours
```

报文里的 `identity:` 就是 §2.1 那一个身份（上例的载体 `plan-review-1.c1.json` ⇒ `line=plan · op=review · cycle=1 · attempt=1`），与 `derived:` 同源：两者都从 `attribute(path.basename(the --reviews 载体))` 渲染，不由 fix 轮的身份算。

**门的适用范围 = 本轮 `#artifactReadOf` 实际解析到的 kind**（今日只有 `rulings`；矩阵里其余 rendered kind 的行照旧答出 `misplaced: "block"`，但没有派发面去解析它们）。其余 kind 在盘上的任何名字差异仍是 orphan 观察面（§2.5 的反面约束）——所以 P34 前的 legacy 载体（文件仍在盘上、读法已拆）落到 **orphan**，派发不被拦，这正是 §3.3「新派发零影响」的机械证明。

四条纪律：**只拒不改**（引擎不移动/改写/删除任何产物）· **多候选一并列出、绝不二选一** · **`--dry-run` 同源可见**（纯读门）· **board 可见**（同一判定落成 `art:` 事实行，派发前就能看到）。

#### 2.5 归属门泛化，`sealed` 入列，归主文法入列

- `Ledger#orphanHandoffs` 从「只扫 `carrierPattern` 认得的名字」泛化为**两级判据**——这是对「`attribute` 认不得即 orphan」单级写法的显式修订（单级会把「已归主但无人认领」的载体漏成静默）：
  - **(i) 不归主**——`attribute → null`：矩阵外名字、P34 前 legacy 拼写（`spec-<op>-<round>.json`、无 cycle 的 `tasks-<n>-implement*.json`）归这一格。
  - **(ii) 归主但无人认领**——名字归到 round 域的 `draft` / `final` 两 kind，而账本里没有任何记录认领该 `(op, cycle, attempt)`（行键由身份派生）⇒ orphan。域外名字（workspace 三字面量 + brief、doc 四行）归主即非 orphan，不进这一格。
  - 口径保持 P34/D89 的**零写只显示**：两级都只上板面 `orphan:` 行，永不阻断派发。
- `CarrierSeal` 删除 `RULINGS_SUFFIX` 白名单，改读矩阵的 `sealed` 列；矩阵每行都显式写了 `sealed`（`report` / `log` / `crash` / `evidence` 四行 = `false`），不留空格给实现期发明缺省。
- **归主文法不进行类型**（母契约的行集八问逐问有落点）：`domain` / `author` / `identityFrom` / `sealed` / `identifier` 是 `ArtifactRow` 的字段；`nameRule` 由 rendered 行的 `render` 承担、declared 行由 `identityFrom` 答「无名字规则」；`misplaced` 是与 `identityFrom: "rendered"` 配对的字面 `"block"`；**`归主文法` 住本节的三条落格规则 + 下面的逐行答案 + `session/__tests__/round-naming.test.ts` 的枚举 pin，不进类型**——它是一组判据而不是一列数据，装进字段会在类型里养出第二张要同步的等价拼写表。
- **归主文法**（每个 rendered 行都必须答「哪些名字仍归主」）：容忍集 = 同身份的等价拼写，判据只读名字不改盘。三条落格规则：
  - **等于渲染名** ⇒ `ok`。唯一合法拼写，逐字节由 `render` 决定。
  - **能归主但不等于渲染名** ⇒ `misplaced`。对 `rulings` 具体是：**同身份省略 `.c<cycle>` 段**（`<line>-<op>-<cycle>.rulings.json`，issue 实测的那 89 个写作惯例）、**attempt 段显式写出 `-a1`**（渲染器从不铸 `-a1`）、以及 cycle 段与 attempt 段同时按 draft stem 拼写。对 `draft` / `final`：`-a1` 显式形态归入同一格（它能归主、不是渲染名）。
  - **不归主** ⇒ `attribute` 回 `null` ⇒ orphan。P34 前的 legacy 拼写（`spec-<op>-<round>.json`、cycle-less `tasks-<n>-implement.json`）与任何矩阵外名字都在这一格：**不硬停、不静默**。
  - 这条语法由枚举 pin 钉住，家 = `session/__tests__/round-naming.test.ts`（P34 单射 pin 的现成家）：accepted 与 orphan 两侧各枚举一条；`misplaced` 一侧由 `session/__tests__/carrier-rulings.test.ts` 钉。

逐行答案（每个 rendered 行都要在枚举 pin 里给出它这一格）：

| rendered 行 | 能归主但不等于渲染名的拼写（`misplaced`） | 其余拼写 |
| --- | --- | --- |
| `draft` / `final` / `report` / `log` / `crash` / `evidence` | 显式写出 attempt 段 `-a1`（渲染器从不铸 `-a1`） | orphan |
| `rulings` | 省 `.c<cycle>` 段（`<line>-<op>-<cycle>.rulings.json`，issue 实测的那 89 个写作惯例）· 显式 `-a1` · 两者同时按 draft stem 拼写 | orphan |
| `progress` / `base` / `in-flight` | 无——名字里没有坐标段，唯一能归主的拼写就是渲染名 | orphan |
| `brief` | 无——`tasks` 就在渲染名里，没有可省的段 | orphan |

- 无 cycle 身份（`cycle` / `attempt` 缺席）时，`rulings` 的「省 `.c<cycle>` 段」与渲染名重合、不是变体；该身份下 `misplaced` 只剩显式 `-a1` 一格。
- 反面约束（防噪音）：**`misplaced` 只对「能归主的名字」成立**；`attribute → null` 一律是 orphan（观察面），绝不因为目录里多了一个陌生文件就拦派发。

#### 2.6 board：单向投影，默认零字节

```
  art:     plan · rulings   ! misplaced
           derived  .kairos/cdd/<ws>/plan-review-1.c1.rulings.json
           found    .kairos/cdd/<ws>/plan-review-1.rulings.json
```

- **健康树零新增字符**——`art:` 只在有 `misplaced` / `invalid` 时出现（与 `crashed:` 行同一策略）；P33/P34/P35 的 board 字节 pin 全绿是硬验收。
- **不新增列**：`art` 不进行尾计数格（`implement 1 ✓ · review 1 ✓+3` 的 `+3` 是 findings 计数，产物盘点是文件状态，两个轴）。
- **判读顺序不变**：`art:` 插在行区之后、`next:` / `reason:` 之前；`next:` 永远最后两行。
- **排障视图**：`cdd board --plan … --artifacts` 才摊开「一 kind 一列、一轮一行」，默认关；明写为排障视图，不是日常视图。
- **board 永不持有名字规则**：P35/D90 的根因就是读取权落在 view 平面。

#### 2.7 文档域反查：三态，不是二态（P35 §2.7 的修订）

Plan 的 slug 找不到身份文档时，P35 问的是**名字**（派生 `<slug>-design.md` 再探存在性）；本相位问的是**身份**——索引里有没有一份声明了该 `slug` 的文档。这条修订是显式的，不是沉默违约：P35 §2.7 的「反查只问存在性、不问内容谓词」在「存在但读不出 ⇒ 未判态」这一半上与三态**同向**，现在把那一半升成正式的一层。

三态（`PlanRead.orphan()` 的判定，逐层）——外加一格不属三态的重复面 (d)：

| 层 | 事实 | `orphan()` | 派发 | board |
| --- | --- | --- | --- | --- |
| (a) | 索引命中该 slug 的身份文档 | `null` | **放行** | 照今日渲 spec 行 |
| (b) | 索引未命中 **且** 三个 doc 根（`overalls/` · `specs/` · `plans/`）的扫描面全干净（无不可读候选、无读得出但未入册候选） | `spec-absent`（`cause` 单值，无路径） | `CDD_BLOCKED: doc-contract` | spec 行 `! no-spec` + hop-less `next:` |
| (c) | 索引未命中 **且** 任一 doc 根的扫描面不干净 | `null`（**未判态**） | **零拒绝，放行** | 照今日渲 `(none)`；不渲 `! no-spec` |
| （d）同一 slug 有两行 plan | `docsOf(slug)` 的 plan 行 ≥2——`locate` 回 `null`，与「0 份」不可分辨 | **不答 `undeclared`**（plan 路径不取第一行，也不授权「没有 plan」） | 由既有 `SlugIndex#slugVerdict` 的 `duplicated` 硬拒（`duplicate-plan`） | plan 格渲 `MARK_SLUG_DUPLICATED` + 集合内全部 `rel`；`next:` 不印 `kairos:cdd-plan` |

- **判干净要三个根都干净**：身份反查的候选面不止 `specs/`——`SlugIndex#isIdentity`（`infra/slug-index.ts`）接受 overall（`overalls/`）与 phase-spec / single-spec，`planChain` 的报文也把 overall 列为合法身份文档，所以「slug 指向 program overall」的 plan 是**合法配置**。只数 `specs/` 就会把一个落在 `overalls/` 的未入册候选或读不出候选造成的 (c) 现场判成 (b)：对一份健康 plan 报 `CDD_BLOCKED: doc-contract`，报文还宣称「index clean miss」。
- **扫描面干净是一个事实，不是一次猜测**：`SlugIndex#scanRoot`（`infra/slug-index.ts`）今日把「读不出」的候选静默丢掉（「an unreadable candidate is not a document」），于是「索引没有」与「盘上没有」被混成一件事——这正是 P35 §2.7 那条「不得用 `phaseSpecsOf` / `planOf` 反装」顾虑的同一个病。修法：`#scanRoot` **每根**保留一对**丢弃计数**（不可读候选 + 读得出但 `doc-type` 不在登记表的候选），三个根共六个值随索引一起暴露；三态读的就是这组计数，不新开扫描面、不新增第二条读取路径。计数是**按根**的事实（一个不可读候选让该根整根失去判 (b) 的资格），这个粗粒度与三态本身的粒度一致。
- **plan 的路径读同一套三态**（`PlanSource#readFor` 的定位步骤）：`docsOf(slug)` 有 plan 行 ⇒ 取该行 `rel`（不派生、不猜文件名）；无 plan 行 **且** plans 根那对计数为 0 ⇒ 干净缺失，`undeclared`（今日字节：板面 `(none)`、`next:` 落 `kairos:cdd-plan`、stderr 零 `CDD_WARN:`）；无 plan 行 **而** plans 根计数非 0 ⇒ **未判态**：派发零拒绝、板面渲今日的 `(none)`，但**不冒充「这相位没有 plan」**——装配面写一行 `CDD_WARN:` 带丢弃候选计数，因为「读不出 / 未入册」不得授权「没有」（§4.5）。`PlanRead` 仍是三态（`undeclared` / `unreadable` / `ready`）：未判态不新增第四个状态，它只是 `undeclared` 这一格上的**理由**，把「静默等同」换成「可见的未判」。**plan 行 ≥2** 单独一格（上表 (d)）：`locate` 对「0 份」与「≥2 份」都回 `null`，照 `null` 走就会把「两份」答成 `undeclared`（板面 `(none)` + `next: kairos:cdd-plan`）——正是本条禁止的「读不出 / 未入册不得授权「没有」」。所以 plan 路径先问集合：n === 1 才取 `rel`，n ≥ 2 落身份标记面（板面 `MARK_SLUG_DUPLICATED` + 集合内全部 `rel`、`next:` 不印 `kairos:cdd-plan`），派发由 `slugVerdict` 的 `duplicated` 挡下；它与 doc 域 `read` 的 `(slug, docType)` 拒绝臂同源（`invalid(found)`，§4.4）。
- **`cross-doc-chain` 吃同一组计数**：#485 的反查不止 plan-carrier 一条腿——`CrossDocChainInvariant#planChain`（`contract/invariants.ts`）在身份回 `null` 时直接产一条 Finding（**已交付**：它改问 `hasIdentity(slug)`，不再经 `#identityDocOf`；同一组丢弃计数尚未接入，那正是本条要补的一半），而 `PreFlight#vet`（`session/preflight.ts`）把**任何** Finding 变成 `gate: doc-contract` 的硬拒；于是「索引未命中 + 扫描面不干净」的现场仍被拒，报文还说出一句与事实相反的话（「the plan carries no identity document with the same slug」，而扫描面里明明有候选，只是读不出或未入册）。修法：`planChain` 读**同一组**丢弃计数——null 身份 + 任一 doc 根不干净 ⇒ **不出 Finding**（未判态，与 (c) 同一臂）；null 身份 + 三个根全干净 ⇒ 与 (b) 同一条 Finding（此时两条腿同向：plan-carrier 的 `spec-absent` 在前，chain 的 `slug` 腿在后，结论一致）。计数由 `SlugIndex` 自报（上一条），chain 不新开扫描、不新增读取路径。
- **派生路径整条废除**：`<slug>-design.md` 不再出现在引擎任何字符串里（§2.9 ④ 的零拼接门同时钉住它）。`spec-absent` 的报文改述为「the slug names no identity document (index clean miss)」——只印 `<slug>`、**不印任何派生路径**；`PlanOrphan#specPath` 随之**退役**（`PlanOrphan` 只留 `cause`：三态下已无任何读者，(b)(c) 都没有路径可印），`PlanReadWords#planOrphanSpec(slug)` 收成单参、报文零路径片段——端口签名与 `spec-absent` 的报文字节一并进 AC 的 pin（`infra/__tests__/plan-source.test.ts`）。
- **P35 Constraints 的派生条款同批修订**（deliberate · D74，记入 overall D92 ⑦）：P35 Constraints 原文「plan 路径由 `ENGINE_DOC_ROOTS.plans` + slug 派生，不在 front matter 里声明路径」拆成两半——后半句（文档不自述路径）保留，前半句改为「plan 路径取索引 plan 行的 `rel`」；同一条的「不重写 `infra/slug-index.ts` 的扫描谓词」保持原样：`#scanRoot` 只多出按根的一对丢弃计数，文档谓词（`*.md` 且内容可读）一字不动。
- **P35 三条 pin 重锚**（deliberate · D74）：值 pin `infra/__tests__/plan-source.test.ts`（原「`<slug>-design.md` 存在但读不出 ⇒ 零拒绝、`(none)`」改写为 (a)(b)(c) 三格 + 「盘上存在但声明成别的 slug ⇒ (b)」），板面 pin `face/__tests__/board-view.test.ts`（`! no-spec` 只属 (b)；`(c)` 与今日逐字节相同）。**第三条是 P35 AC ③ 的「派生 plan `ready` 但未入册」**：它的「缺 `doc-type: plan`」一半在落本相位后属**未判态**——`stationPath()` 回 `null`、doc 面 `next:` 回到 `kairos:cdd-plan`、plan 行与 wave 行渲 `(none)`、stderr 一行 `CDD_WARN:`、派发零拒绝（`face/__tests__/cli.test.ts` 那一格按此改写）；「新 plan 覆盖旧 entry」一半仍健康（索引里那行仍是 plan 行 ⇒ `rel` 与健康读都不变）。三个观测点（spec 行 / hop-less `next:` / 报文）仍按 P35 §2.7 的通道选择执行，只是短路谓词从「派生路径不存在」换成「`orphan()?.cause === "spec-absent"`」。
- **消费者可见变化**（写进 changeset 依据）：`<slug>-design.md` 存在、但它声明的 slug 不是本 plan 的 slug 时，今日放行、落地后判 (b)（身份才是判据，文件名不是）。(c) 保证这条变化不会误伤「读不出」的语料。同批第二条：plan 文件在盘上却缺 `doc-type: plan` 时，今日健康渲出、落地后落未判态（`(none)` + `CDD_WARN:`，派发零拒绝）。

#### 2.8 标识词表入列

`rulings` 行声明 `identifier: { canonical: "finding", accepts: ["finding", "id"] }`：读取面双向兼容（内部归一 `finding`），未知键仍整份拒；写入面单拼写，由提示面（fix/docs-fix 壳的 `INPUT_RULINGS` 行附一句条目形状）与读回提示共同给出，**不新增第三处枚举**。`review` 的 `findings[]` 与 fix 的 `dispositions` 的 `id` 不动——本相位只让「同一标识在两份相邻产物里换名字」这件事**有声明处**。

读回提示面（`session/next.ts` 的 `FIX_READBACK_SUFFIX`）随之从**规则句**改成**结果句**：今日那句「same path with .json replaced by .rulings.json」本身就在教命名约定（issue ④ 的病根），它改为印**已解析的 sidecar 路径**——

```
(confirm the reviews handoff · if a finding needs a ruling, record it at <rendered sidecar path>)
```

`<rendered sidecar path>` 与门的 `derived:` 段**同一个值**（`render(identity, "rulings")` 经 `Workspace#resolve`），由路由器按**载体身份**（`attribute(path.basename(carrierPath))`，不是 fix 轮的 `(line, op)`）算出后随 `Route` 下行，`RouteRenderer` 只填值、不推导（§2.6 的「渲染面零名字规则」同样适用）。于是 `session/next.ts` 里不再出现 `.rulings.json` 字面（§2.9 ⑤），而句子仍逐字节确定。fix 行字面属消费可见变化（D70 的 `next:` 是裁决面）：`face/__tests__/face.test.ts` 的 fix 行断言、`face/__tests__/cli.test.ts` 与 `face/__tests__/capsule.test.ts` 的同一字面、`packages/kairos/tests/status-routing-convergence.test.ts` 的行为断言一并**重锚**（deliberate · D74 · `cdd-engine` minor）。

#### 2.9 机械强制五项

1. **往返 pin** — 全部 `identityFrom: "rendered"` 的行，逐行枚举：`attribute(render(identity, kind)) === (identity, kind)`（行集见 §2.2 的枚举，含 brief 的 `tasks` 坐标与三个 `tasks: null` 字面量）。
2. **守恒 pin** — 既有六 kind + 三个工作区字面量 + brief 的名字逐字节不变（矩阵重构是纯搬移）。
3. **未登记即观察** — 目录里放一个矩阵外的新名字 ⇒ 板面 `orphan:` 行出现；不阻断、不静默。
4. **文档路径零拼接门** — 谓词固定为：**任何以 doc root 为基的路径模板串或 `path.join` 组合即红**——`${docRoots.<root>}/<任意非空>` 形式的模板串、以及 `path.join(<root|docRoot>, …)`。白名单**恰三条**：① `SlugIndex` 的扫描根（`#scanRoot` 的三次调用与 `insideDocRoots`）；② runtime / `RepoRoot` 的组合（`contract/invariants.ts` 的 `#scanRoots` 把 `ENGINE_DOC_ROOTS` 的值与根组合）；③ `contract/invariants.ts` 的 `DOC_ROOT_NAMESPACE` / `DOC_ROOT_SEGMENTS` 派生（`:56` / `:61`）。`face/declare.ts` 的四个 help 示例**不在白名单**——四处全改成 `--plan <path>` / `--spec <path>` 形，文案里零文档根插值。这条把 #485 从「修一个分支」变成「结构上不允许再写出来」。
5. **唯一构造点** — `.rulings.json` 字面只允许出现在矩阵行与其测试夹具；`finding` / `id` 的接受集同样单源。

#### 2.10 `INPUT_RULINGS` 只印路径：正文归文档（P31 §2.5 的修订）

今日 `#rulingsInputOf` 返回**路径 + 每条裁定的正文**（P31 §2.5 的 AC 原文：「渲染文本与 sidecar 一致」）。本相位把正文从 round context 撤出，与 `INPUT_REVIEWS` **同形**：

```
- `INPUT_REVIEWS`: .kairos/cdd/<ws>/plan-review-1.c1.json
- `INPUT_RULINGS`: .kairos/cdd/<ws>/plan-review-1.c1.rulings.json
```

三条理由，一条比一条硬：

1. **一个输入面一种读法**——`INPUT_REVIEWS` 只给路径，finding 正文由 child 打开 carrier 读；`INPUT_RULINGS` 给正文就是同一张 prompt 上的两套约定。
2. **round context 是动态尾部**——P33 把判别符移进尾部正是为了前缀稳定；正文长度由裁定内容决定，尾部字节不可预测，且裁定越多尾部越长。
3. **正文入 prompt = 文档的第二次表达**——本相位治的就是「同一事实有两份副本，副本没有门」。prompt 里的裁定正文没有任何门与 sidecar 对账（P31 只是在渲染时读一次），sidecar 才是真源。

落法：

- `#rulingsInputOf` 只返回**路径行**——身份取 `attribute(path.basename(the --reviews 载体))`（§2.1 的「这一轮的评审载体」，`op` 恒为 `review`），`render(身份, "rulings")` 经 `#rel` 归一；`#rulingLine` 退役。
- **固定前缀补一句读法**（`FIX_SHELL` 与 `DOCS_FIX_SHELL` 各一句，同一句式）：`INPUT_RULINGS` 命名的编排者裁定文件必须在动 finding 之前读；每条裁定回答一个 finding id，并**压过该 finding 自己的建议**（`REJECTED` = 不采纳该 finding 的改法）；carrier 本身只读、永不改写。这是「指令住在固定前缀、事实住在 round context」这条既有分界的直接应用。
- **门不变**：sidecar 的严格 schema 仍由派发前判定（`invalid` ⇒ `CDD_BLOCKED`，child 零 spawn）；正文撤出 prompt 不影响这道门。
- **成对钉保留**：sidecar 缺席 ⇒ **零行**（P31 §2.5 的另一半原样绿），present ⇒ **恰好一行路径、零正文行**。
- **这是一条对 P31 §2.5 AC 的显式修订**，与 §2.7 对 P35 §2.7 的修订同性质：记入本 spec、overall D92、并重锚 fix/docs-fix 的 prompt 字节 pin（deliberate · D74）。

### 3. legacy 拆除

#### 3.1 拆什么

| 面 | 符号 pin | 作用 |
| --- | --- | --- |
| `RETIRED_SPEC_KEY` / `RETIRED_SPEC_LINE_KEYS` | `session/ledger.ts` 的两个常量，消费点按符号枚举——`Ledger.rowFor` · `#retiredSpecApplies` · `resolveHandoffName` · `#resolvedCarrierName` · `#retiredCarrierName` · `#ownerRow` · `#lineWord` · `#LINE_CARRIER` | 把键 `spec` 的行读成当前文档行（计数一律改符号枚举，不写「N 处」） |
| `Ledger.rowFor` / `#retiredSpecApplies` 的行级回退 | `Ledger.rowFor` / `Ledger.#retiredSpecApplies`（`session/ledger.ts`） | 「键 `spec` ⇒ 当前声明行」的行级退役键回退，读取面与 board 共用同一次查表 |
| `resolveHandoffName` / `#resolvedCarrierName` 的 doc 线 alias | `Ledger#resolveHandoffName`（`RETIRED_SPEC_LINE_KEYS.has(type)`）/ `Ledger#resolvedCarrierName`（`key === RETIRED_SPEC_KEY`）（`session/ledger.ts`） | 文档行类型的旧载体名回退，`#retiredCarrierName` 的两个调用点 |
| `#retiredCarrierName` | `Ledger.#retiredCarrierName`（`session/ledger.ts`） | `spec-<op>-<round>.json` 旧载体名 |
| `#legacyCarrierName` | `Ledger.#legacyCarrierName`（`session/ledger.ts`） | 无 cycle 的 `tasks-<n>-implement.json` 旧载体名 |
| `#ownerRow` / `#lineWord` 的退役分支 | `Ledger.#ownerRow` / `Ledger.#lineWord`（`session/ledger.ts`） | 旧行键 → 当前行的映射 |
| `RULINGS_SUFFIX` | `CarrierSeal`（`infra/carrier-seal.ts`）——**已交付**：常量已删，改问矩阵 `sealed` 行 | 第三处 sidecar 拼写知识（并入 §2.5） |

#### 3.2 依据（测得条件 + 命令，不是形容词）

这族读法唯一的消费者是已关闭 workspace 的回看（`cdd board <旧 slug>`、capsule），所以判据是「这些读法今天还能到达哪些面」，而不是「盘上还有多少旧文件」。测量（2026-11-15 · 本仓根）：

```sh
find .kairos/cdd -maxdepth 2 -name progress.json | wc -l          # 31 个 workspace
cat $(find .kairos/cdd -maxdepth 2 -name progress.json) | grep -c '"wave"'        # wave 行（判据：≥ 200 行）
grep -l '"spec"' $(find .kairos/cdd -maxdepth 2 -name progress.json) | wc -l     # 16 个 workspace 仍带退役键 spec
find .kairos/cdd -maxdepth 2 -name 'tasks-*-implement.json' | wc -l               # 125 个无 cycle implement 载体
find .kairos/cdd -maxdepth 2 -name 'spec-*' | wc -l                               # 193 个旧拼写条目
```

- `spec-*` 的 193 是**条目总数**，构成 = 88 个 `spec-*.json`（含 49 个 `spec-review-*.json`）+ 78 个 `spec-*-report.md` + 其余 27 个同前缀条目；不是「数百」，写「数百」是夸大证物。
- 口径写死为「测量时点 = 2026-11-15、命令如上、**数字含本 workspace 自身**」：注册本 workspace 之前的同一组命令回 30 / 220，那个 +1 已经发生。**`wave` 行数只作条件、不作常量**——它在一个 workspace 内部就会涨（本 workspace 自己又记了三条：注册时 221、测量时 224），重新测量不能让它稳住；所以它写的是「`wave` 行 ≥ 200」，即退役键的读者是一座大的已关闭语料，而不是活的派发面。其余五个数随树长大但量级不变。
- 结论句因此是条件式：**这族读法的消费者只有已关闭 workspace 的回看**，它们不再被派发，新 workspace 一律写当前拼写。留着的代价是持续的：一条「哪些 type 走旧载体名」的集合在账本里决定三处行为，而每个后续面（board / orphan / seal / 矩阵）都得记得它——这正是散落的来源。

#### 3.3 后果与既有裁定收窄

- 16 个旧 workspace 的 **doc 行读不到**（board 显示缺行）；旧载体变成 `orphan:`（可见、不阻断）；重新派发会从 cycle 1 开始（这些相位都已 Done，不会重派）。拆的是**两套退出路**，同批同进退：行级（`Ledger.rowFor` 的 `spec` 行回退 → `#retiredSpecApplies`）与载体级（`resolveHandoffName` 的 doc 线 alias → `#resolvedCarrierName` → `#retiredCarrierName`；以及 `#legacyCarrierName` 的无 cycle implement 读法），外加旧行键映射（`#ownerRow` / `#lineWord`）与归属正则的 `spec` 分支（`#LINE_CARRIER`）——不留半条。
- **新派发零影响**，且这条有机械证明而不只是断言：旧拼写在矩阵里 `attribute → null` ⇒ orphan 观察面，`misplaced` 门只对能归主的名字成立（§2.4/§2.5）。
- P34 §2.6 的「历史文件与历史记录零迁移可读」**收窄**为「历史文件不被删除、不被改写；引擎不再识别历史拼写」。这是对已 ratified invariant 的显式修订，记入 overall D92，不默默改。

#### 3.4 迁移：现存错位 sidecar

issue 提交方那 89 个 `*.rulings.json` 全部落在推导路径外；升级会立刻把它们读成 `misplaced` ⇒ 硬停。迁移是**一次性、显式、由主编排器执行**的动作：

```sh
# 对每个 <line>-<op>-<n>.rulings.json，若同目录存在 <line>-<op>-<n>.c<N>.json（final），
# 改名为 <line>-<op>-<n>.c<N>.rulings.json。
# 改名后必须复判：cdd fix … --dry-run 的读回不一致即说明条目形状除 id 之外还有偏差，
# 需要编排器按报文修内容（引擎从不改写产物）。
```

两点必须写清，不能含糊：

- **键名不是已知的全部偏差**。条目键名 `id` 由 §2.8 的别名兼容；但 issue 的「条目 schema 合规 0 个」是「键名 + 其余偏差」的合集，实测清单未逐条列出，所以**不写「无需改内容」**——迁移的收尾动作是复判，不合格者由编排器修复（可见、可修，正是最需要一次做对的那批 workspace）。
- sidecar 从不被封（P31），改名不受写保护影响；顶层 `carrier` 键（可选）若存在，其值是 carrier 的文件名，改名侧车不改这一项。命令写进 cdd-engine README 升级说明，与其 `README.zh-CN.md` 镜像同批改（仓库 README 家族是英文 + `.zh-CN.md` 同源，两侧不得只改一侧），并与三个 skill 的落点指令同批。

### 4. 失败面

#### 4.1 多候选

同一 `(identity, kind)` 命中两个以上名字：`found` 列全部，停在这里，**引擎不选**。修复由编排器做（删多余的那个）。这条优先于 `ok`：渲染名在盘上且合法、同时另有一个能归主的名字（§3.4 迁移做一半正是这个现场），结论仍是**停**，不因渲染名存在而放行——否则那个变体既不是 orphan（`attribute` 认得）也不会被报出，正是「猜名字」的老病。

#### 4.2 缺席合法

`rulings` 的缺席是合法状态（`absence` 不进矩阵）：裁决尚未记录不得因缺席拦派发、不得在 prompt 里伪造路径（P31 §2.5 成对钉原样保留）；其余读点的缺席仍走各自既有的失败通道。

#### 4.3 未登记的名字

矩阵外的文件只进 `orphan:` 观察行，永不阻断派发（P34/D89 同一立场）。

#### 4.4 同一 slug 多份身份文档

判定面已有 `duplicate-identity` / `duplicate-plan`（`SlugIndex.#judge`）与 `slugVerdict.duplicated`；本相位把**读取面**补齐，且补在能承载集合的那一面：

- `SlugIndex#docsOf(slug)` 回 0 / 1 / n，**永不取第一份**；`identityDoc` / `planOf` 退役。
- doc 域 `read` 在同 `(slug, docType)` 命中 ≥2 份时回 `invalid(found: [a, b], reason: "duplicate-identity")`——这是**同型**歧义的唯一判定处。
- 身份类（跨三型）的歧义由集合口回答：消费方（板面 spec 格、`planChain`）读 `docsOf(slug)` 的 0/1/n，n > 1 渲既有标记 `MARK_SLUG_DUPLICATED` + 集合内全部 `rel`，不借任何一份的 version / status。
- `attribute(name)` **不加第三态**：名字 → 身份是一对一，歧义是「同一个身份有多份文档」，不是「名字对应多个身份」。
#### 4.5 存在但读不出

文件在推导名上但 IO 失败（权限、被删竞态）⇒ `invalid(path, "unreadable")`，不得读成 `absent`——「读不到」不得授权「没有」。

### Acceptance criteria

- 往返 pin，**逐行枚举**（`identityFrom: "rendered"` 的十一个 kind）：`draft` / `final` / `report` / `log` / `crash` / `evidence` / `rulings` 取 round 身份（`line/op/cycle/attempt`，attempt 1 时渲染名不含 `-a1`；**无 cycle 形态各再跑一遍**：`cycle` / `attempt` 缺席 ⇒ 渲染名不含那两段、`attribute` 回出同一无 cycle 身份，P34 的 `tasks-1-implement.json` pin 原样绿）；`progress` / `base` / `in-flight` 取 `{domain: "workspace", tasks: null}`；`brief` 取 `{domain: "workspace", tasks: "<组>"}` 且 `attribute(render(...))` 回出同一 `tasks`；矩阵外新增名字必须先有行 — pin `session/__tests__/round-naming.test.ts`。
- 守恒：既有六 kind + `progress.json` / `base.json` / `in-flight.json` / brief 的名字逐字节不变（P31/P34 已交付 pin 只增不翻）。
- `misplaced = block` 成对 pin：推导路径缺而同轮 stem 变体在 ⇒ 派发前 `CDD_BLOCKED: artifact-identity`、报文四段齐、child 零 spawn、`--dry-run` 同源可见；两处都缺 ⇒ 不拦，且 absent 面 prompt 字节零变。
- 门的作用面收窄：**盘上存在 P34 前 legacy 拼写载体**（`spec-review-1.json` / 无 cycle 的 `tasks-1-implement.json`）时派发**不被拦**——它们不归主 ⇒ orphan 观察面；`misplaced` 只在「能归主且不等于渲染名」时成立 — pin `session/__tests__/handoff-plane.guard.test.ts` 或同域结构测试。
- 归主文法三格枚举（accepted / misplaced / orphan）各一条，且**逐行给出 §2.5 表的答案**：`<line>-<op>-<cycle>.rulings.json`（省 `.c<cycle>`）与显式 `-a1` 落 `misplaced`、legacy 与矩阵外名字落 orphan；`progress` / `base` / `in-flight` / `brief` 四行的容忍集为空（枚举里显式写「无此格」而非留空）— pin `session/__tests__/round-naming.test.ts` 与 `session/__tests__/carrier-rulings.test.ts`。
- 多候选：同 identity × kind 两个名字并存（含「渲染名合法 + 同身份另有一个能归主的名字」这一格）⇒ 报文列全、不选、不写；child 零 spawn；该格优先于 `ok`（推导名在盘上不得放行）。
- **#485 面（三态）**：索引有该 slug 的身份文档 ⇒ `review --type plan` / `implement --tasks` / `review --type branch` 全部放行，且 `plan-carrier` 与 `cross-doc-chain` 对同一份文档结论一致（不一致即红）；索引干净缺失 ⇒ `CDD_BLOCKED: doc-contract`，报文只印 `<slug>`（**不含任何派生路径**）、board spec 行 `! no-spec` + hop-less `next:`；索引缺失但**任一** doc 根扫描面不干净（不可读候选或读得出未入册候选）⇒ **零拒绝**、board 照今日渲 `(none)`、`PlanOrphan` 只剩 `cause`（`specPath` 已退役）。**`cross-doc-chain` 同格钉**：三格各一条断言——(c) 上 `#contract.validate` 零 `cross-doc-chain@slug` Finding（因此 `PreFlight#vet` 不拒）、(b) 上该 Finding 与 plan-carrier 的 `spec-absent` 同向（两面都拒，各自说自己的事实）、(a) 上两端零 Finding。**plan 路径取自索引的 plan 条目**：`readFor` 的入参是身份文档条目，其 `rel` 是 spec 自身路径（入参那条 pin 在 `infra/__tests__/plan-source.test.ts:213-227`、真正打开的派生路径那条在 `:173-183`），plan 一律经 `docsOf(slug)` 的 plan 行取 `entry.rel`；无 plan 行时按 plans 根那对计数分格——干净缺失 ⇒ `undeclared`、不干净 ⇒ 未判态（零拒绝 + `(none)` + 一行 `CDD_WARN:`，下一格同钉）；**plan 行 ≥2** 不折成 `undeclared`（plan 格渲 `MARK_SLUG_DUPLICATED` + 集合内全部 `rel`、`next:` 不印 `kairos:cdd-plan`，派发由 `slugVerdict` 的 `duplicated` 拒）；`plans/<slug>.md` 与 `<slug>-design.md` 在 `infra/` 零命中；换源调用点点名 `Cli#runBoard` / `#boardReadTable` 与 `Cli#sceneOf`；`planOrphanSpec(slug)` 单参、报文零路径片段（`infra/__tests__/plan-source.test.ts`）。
- **P35 三条 pin 重锚**（deliberate · D74）：值 pin `infra/__tests__/plan-source.test.ts` 改为三格判定表（含「`<slug>-design.md` 在盘上但声明的是另一个 slug ⇒ (b)」与「不可读候选 ⇒ (c)」）；板面 pin `face/__tests__/board-view.test.ts` 钉住 `! no-spec` 只属 (b)、(c) 与今日逐字节相同；短路谓词是 `read.kind === "unreadable" || read.orphan()?.cause === "spec-absent"` 同一对。第三条：**P35 AC ③ 的「派生 plan `ready` 但未入册」**——「缺 `doc-type: plan`」一半改为未判态（`stationPath()` 回 `null`、doc 面 `next:` 回 `kairos:cdd-plan`、plan 行与 wave 行 `(none)`、stderr 一行 `CDD_WARN:`、零拒绝），「新 plan 覆盖旧 entry」一半仍健康 — pin `face/__tests__/cli.test.ts` 与 `infra/__tests__/plan-source.test.ts`。
- **plan 路径三态**（与身份反查同构）：plan 行在 ⇒ `readFor` 读该行 `rel`（`plans/<slug>.md` 字符串零命中）；无 plan 行 + plans 根两个计数为 0 ⇒ `undeclared`、板面 `(none)`、`next:` 落 `kairos:cdd-plan`、stderr 零 `CDD_WARN:`；无 plan 行 + plans 根计数非 0（不可读候选 / 读得出但 `doc-type` 未入册）⇒ 未判态：零拒绝、`(none)`、一行 `CDD_WARN:` 带计数；**plan 行 ≥2**（同一 slug 两行 plan）⇒ 不取第一行、也不落 `undeclared`——plan 格渲 `MARK_SLUG_DUPLICATED` + 集合内全部 `rel`、`next:` 不印 `kairos:cdd-plan`、派发由 `SlugIndex#slugVerdict` 的 `duplicated` 拒 — pin `infra/__tests__/plan-source.test.ts` · `face/__tests__/board-view.test.ts` · `face/__tests__/cli.test.ts`。
- **扫描面干净**由索引自报：`SlugIndex` 暴露**三个 doc 根各一对**丢弃计数（`overalls/` · `specs/` · `plans/`；各为「不可读候选」「读得出但 `doc-type` 未登记候选」），六个值全为 0 才允许判 (b)——身份反查跨三根（`#isIdentity` 接受 overall，`planChain` 的报文也把 overall 列为合法身份文档），plan 路径的「干净」只读 plans 根那一对；计数与入册结果同一次扫描产出（不新增第二次扫描）；`CrossDocChainInvariant#planChain` 读同一组计数判 (c)（不新开扫描、不新增读取路径）— pin `infra/__tests__/slug-index` 族。
- **文档路径零拼接门**：谓词 = 以 doc root 为基的模板串 `${docRoots.<root>}/<非空>` 或 `path.join(<root|docRoot>, …)`，加回一处即红；白名单**恰三条**（`SlugIndex` 扫描根 · runtime/`RepoRoot` 组合 · `contract/invariants.ts` 的命名空间/段派生），`face/declare.ts` 的 `example` 四行不在其中、改为 `--plan <path>` / `--spec <path>` 形且零文档根插值。
- **索引单建**：`SlugIndex.build` 的生产调用点从注册时的五处收敛到三处——scene/ctx 构建的**一处**（已交付：`Cli#indexOf`，`face/cli.ts` 内只剩它一次 `SlugIndex.build`，注册时的 `#sceneOf` / `#runBoard` / `#runWork` 三个自建点已收进它）是唯一构造入口，另两处 `ctx.slugIndex ?? SlugIndex.build(...)` 兜底（`session/preflight.ts` · `contract/invariants.ts`）**允许保留**（未随 ctx 拿到索引的判定面仍可自建一次）；红 pin 是「**这三处之外无 `SlugIndex.build`**」（三处 = `Cli#indexOf` + 两个 `?? build` 兜底），不是「全树只允许一个字面」。
- **矩阵单实例**：`ArtifactRegistry` 的生产构造点恰一处（组合根按命令建一个，`face/cli.ts`），声明域只经 `bindDocIndex(index)` **就地**换进同一实例、零第二实例；`locate` / `read` 收 `base: Workspace` 而不在构造期绑目录（一个板面渲多 node workspace，绑死一个就会把另一个 node 的名字解析到本目录）；`ArtifactRegistry.nameOf(kind, tasks)` 是 workspace 三字面量与 brief 的无实例入口、与实例 `render` 同一拼写——pin `session/__tests__/round-artifacts.test.ts` 的「constructs the registry at exactly ONE production site」与 `nameOf == render` 那一格。
- **重复身份**：同型重复（同一 `(slug, docType)` 两份）⇒ `read({domain: "doc", slug, …}, kind)` 回 `invalid` 且 `found` 列全两路径、派发硬停；**跨型重复**（`overall` / `phase-spec` / `single-spec` 三型共 n > 1）**不走 `read`** ⇒ 集合口 `docsOf(slug)` 的 n > 1 渲 `MARK_SLUG_DUPLICATED` + 集合内全部 `rel`，派发由 `slugVerdict` 的 `duplicated` 拒；**plan 同型重复**（`(slug, "plan")` ≥2）与同型同一拒绝面、不折成 `undeclared`；`attribute` 仍回身份（`Attributed | null` 不加第三态）；`identityDoc` / `planOf` **退役**（`docsOf(slug)` 只答集合，判读经 `read`）——`planChain` 问 `hasIdentity(slug)`（n ≥ 1 即真，不出「没有身份文档」），`Cli#sceneOf` / `BoardView#nodeSources` / `BoardView#programBoard` 的新读法见 §4.4。
- 归属（两级）：不归主的名字 ⇒ `orphan:` 行；归主到 `draft`/`final` 但账本无记录认领 ⇒ 同样 `orphan:` 行；两者都不阻断派发。`CarrierSeal` 不再硬编码任何后缀（`.rulings.json` 字面只在矩阵行与其夹具）。
- board：健康树默认视图逐字节不变（`next:` / `reason:` 位置与字节不动）；有 misplaced 时仅新增 `art:` 事实行；`--artifacts` 才展开。
- 词表：`finding` / `id` 双向兼容（内部归一 `finding`，未知键仍整份拒）；review `findings[]` / fix `dispositions` 的 `id` 零改动。
- **读回提示印结果不印规则**：fix `next:` 行以 `(confirm the reviews handoff · if a finding needs a ruling, record it at <rendered sidecar path>)` 收尾，其中路径与门的 `derived:` 同值、由路由器按身份算出随 `Route` 下行，`RouteRenderer` 零推导；`session/next.ts` 内不出现 `.rulings.json` 字面（与「字面只在矩阵行与其夹具」不冲突：句子移的是**值**不是**拼写规则**）；重锚 pin = `face/__tests__/face.test.ts` 的 fix 行断言 · `face/__tests__/cli.test.ts` · `face/__tests__/capsule.test.ts` · `packages/kairos/tests/status-routing-convergence.test.ts`，按 D74 记为消费可见变化（`cdd-engine` minor）。
- legacy：`RETIRED_SPEC_*` / `#retiredCarrierName` / `#legacyCarrierName` / `#ownerRow` / `#lineWord` 的退役分支零残留（grep 门，逐符号点名：行级回退 = `Ledger.rowFor` 的 `spec` 行 + `#retiredSpecApplies`；carrier 级 = `resolveHandoffName` 的 doc 线 alias + `#resolvedCarrierName`；归属正则 = `#LINE_CARRIER` 的 `spec` 分支）；旧 workspace 的 board 退化为缺行 + orphan，新派发零影响。
- **迁移两条**：① 夹具 = 错位 sidecar（`<line>-<op>-<n>.rulings.json`）+ 终稿 carrier（`.c<N>.json`）——迁移前派发 `CDD_BLOCKED: artifact-identity`，改名为 `.c<N>.rulings.json` 后同一命令通过（`ok`），child 正常 spawn；② cdd-engine README 升级说明里那一行迁移命令在册，且注明改名后必须复判（条目形状除 `id` 之外的偏差由编排器修，引擎不改写），并与其 `README.zh-CN.md` 镜像同批（README 家族两侧不得只改一侧）— pin `session/__tests__/carrier-rulings.test.ts` + README 断言所在的结构测试。
- **`INPUT_RULINGS` 只印路径**：sidecar 存在时 round context 恰一行路径、零正文行；固定前缀（fix / docs-fix 两壳）含「裁定回答 finding id 并压过该 finding 自身建议、carrier 只读」一句；sidecar 缺席时该 token 零行（P31 §2.5 的另一半原样绿）；`#rulingLine` 零残留；fix / docs-fix 的 prompt 字节 pin 按 v0.4 重锚（deliberate · D74）；**门不变**：`verdict(sidecarPath, carrierPath, findingIds)` 仍把顶层 `carrier` 键与 `path.basename(carrierPath)` 比对——带该键的合法 sidecar（本仓 51/51 都带）照旧走 `ok`，渲染路径取代的是**名字**，不是 carrier 事实。
- 消费面：`cdd-dev` / `cdd-plan` / `cdd-spec-writer` 各**在既有 `## Invariants` 表尾加一行**（`cdd-dev` = `I6` · `cdd-plan` = `I5` · `cdd-spec-writer` = `I4`，三者同句：fix 派发若某条 finding 需要裁定，把裁定写到引擎在 `next:` 里印出的那个 sidecar 路径上，编排器永不自行推导该路径）；**不新增 `##` 节**（`contract/skill-anatomy.ts` 的 section registry 是严格白名单，新增节要同步 `sections` / `public`——本相位不加节，registry 零改动，`packages/kairos/tests/skill-anatomy.test.ts` 的 `rowPattern` 已匹配 `\| I<n> \|` 行）；skill 文本不出现 `.rulings.json` 字面，零程序史 / 零相位号。

- `pnpm run validate` exit 0 · changeset `cdd-engine` **minor**（新增硬停门、prompt 字节、fix `next:` 字面、**未入册 plan 从「健康渲出」改为未判态 `(none)` + `CDD_WARN:`** 均属消费可见变化 · D74）· `kairos` **minor**（skill 文本）。

## Constraints

- **身份只有一个源**：任何产物的名字必须是身份 × kind 的渲染；出现第二个派生点（由另一个名字换尾、拼后缀）即为缺陷。
- **声明物与产出物分轴**：文档的身份由 front-matter 自述，引擎**不得**由 slug 推导文档路径；plan 那一行的 `DocEntry.rel` 就是它的路径（`plans/<slug>.md`），派生即冗余——无 plan 行时按 plans 根扫描面分 `undeclared` / 未判态（§2.7），而身份文档条目的 `rel` 是 spec 自身路径、**不得**当 plan 路径用（§1.3）；反查问身份（索引）而**不问名字**（§2.7 三态）。P35 Constraints 的「plan 路径由 `ENGINE_DOC_ROOTS.plans` + slug 派生」被本相位显式修订为「取索引 plan 行的 `rel`」，扫描谓词不动。
- **引擎只拒不改**：不移动、不改写、不删除任何产物；修复动作永远归编排器。
- **视图面零判定权**：board / capsule / preview 只渲染矩阵的判定结果，重新推导名字即为缺陷。
- **既有工作拼写零改动**：本相位是命名知识的搬移与补行，不是重命名；**历史拼写的可读性不在守恒面内**（§3.3 的显式放弃）。
- **矩阵是封闭集**：新增 kind 必须加行并回答 author / sealed / misplaced / 归主文法四问；新增域必须回答「坐标是什么」。**缺席不设列**：缺席是读取事实，永不阻断。

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-15 | 初稿：issue #484 抽象为「身份域 × 产物矩阵」（一个身份源、两个端口、一个判别值、每 kind 声明的策略列）；`CarrierRulings.pathFor` 删除，`rulings` 成为矩阵一行；工作区四字面量收口；board 只增异常事实行。 | [human] 裁定 · Claude（kairos:cdd-spec-writer · 2026-11-15） |
| v0.2 | 2026-11-15 | 并入 issue #485 并按其证据**修正 doc 域设计**：文档是声明物（`identityFrom: "declared"`），没有名字规则、没有 `misplaced`——v0.1 里「文件名≠slug ⇒ block」会把消费方 10 份合法文档拦下，作废。新增：`DocEntry.rel` 取代两处路径拼接 · `SlugIndex` 单建一次 · 同 slug 多份 ⇒ `invalid` · `docRoots` 拼接 grep 门 · legacy 拆族（`RETIRED_SPEC_*` / `#legacyCarrierName` / `#retiredCarrierName` / `RULINGS_SUFFIX`，依据 16 行 `/` 125 组活数据只服务已关闭 workspace）+ P34 §2.6 收窄。 | [human] 裁定 · Claude（kairos:cdd-spec-writer · 2026-11-15） |
| v0.3 | 2026-11-15 | 评审 round 1 全量落地（F1–F15）：**doc 域反查改三态**并把 P35 §2.7 的修订写进 §2.7（问身份不问名字，`<slug>-design.md` 派生整条废除，`specPath` 回 `null`，扫描面干净由索引自报的丢弃计数给出；P35 值 pin 与板面 pin 重锚）· 矩阵**删 `absence` 列**、doc 四 kind 拆四行（缺席永不阻断）· 往返 pin 按行枚举并给 brief 一个 `tasks` 坐标（workspace 三字面量 = `tasks: null`）· 重复身份从 `attribute` 挪到 `read` 的 `invalid(found)` 集合并加宽该臂 · `misplaced` 的作用面收窄到本轮解析到的 kind、归主文法三格入列并配枚举 pin · 零拼接门写成可判谓词 + 恰三条白名单（`face/declare.ts` 四处 help 示例改为 `--spec <path>` 形）· `FIX_READBACK_SUFFIX` 改为印结果路径并点名重锚 pin · 三个 skill 的落点指令挂在既有 `## Invariants` 表尾（registry 零改动）· §3.2 换成命令 + 实测数字（193 = 88 json + 49 review json + 78 report md）、§1.1 的 89/0 显式限定为 issue 提交方那个消费仓并以本仓 51 个 `.c<N>` sidecar 作反向标定 · 迁移补两条验收（改名后派发转 `ok`、README 命令在册）并删掉「无需改内容」的断言 · 纯行号定位改符号 pin（`SlugIndex#identityDoc` :174 / `#planOf` :182 / `Ledger.#retiredCarrierName` :1882 / `#ownerRow` :1927 / `carrierPattern` :41）· `sealed` 列逐行写全 · `DocDomain` 措辞与行集单一之家。 | [human] 裁定 · Claude（kairos:cdd-spec-writer · 2026-11-15） |
| v0.4 | 2026-11-15 | **用户裁定：`INPUT_RULINGS` 只印路径，正文不进 round context（P31 §2.5 的显式修订）**——与 `INPUT_REVIEWS` 同形：一个输入面一种读法 · 尾部字节不再随裁定长度漂移（P33 前缀稳定）· 正文入 prompt 是「文档的第二次表达」，prompt 副本没有任何门与 sidecar 对账。落法：`#rulingsInputOf` 只回路径行、`#rulingLine` 退役；`FIX_SHELL` / `DOCS_FIX_SHELL` 各补一句读法（裁定压过 finding 自身建议 · carrier 只读）；门不变（`invalid` 仍派发前硬停）；成对钉改为「present ⇒ 恰好一行路径、零正文」「absent ⇒ 零行」。 | [human] 裁定 · Claude（编排器 in-flight 回填 · 2026-11-15） |
| v0.5 | 2026-11-15 | 评审 round 2 全量落地（F1–F9）：**F1** 三态接进 `CrossDocChainInvariant#planChain`——null 身份 + 扫描面不干净 ⇒ 零 Finding（(c) 的「零拒绝」不再被 `doc-contract` 腿推翻，也删掉那句与事实相反的反查句）· **F2** `CarrierRulings` 入参保留 carrier 事实：`read(sidecarPath, carrierPath)` / `verdict(sidecarPath, carrierPath, findingIds)`，顶层 `carrier` 键仍与 carrier 的 basename 比对（本仓 51/51 个 sidecar 带该键，否则升级即全员 `invalid`），矩阵只接管名字 · **F3** §2.3 的 `ok` 行改为「只印路径行、正文归文档（§2.10）」· **F4** `ok` 加限定「该身份无其它能归主的名字」，多候选优先于 `ok`（§4.1 与 AC 同步）· **F5** `PlanOrphan#specPath` 退役（只留 `cause`）、`planOrphanSpec(slug)` 收单参，端口与报文字节进 AC · **F6** `identityDoc` / `planOf` 退役为 `docsOf(slug)` + doc 域 `read`，并点名三个消费者的新读法（`planChain` 问 `hasIdentity`）· **F7** 母契约的 Phase inventory ⑨/⑩ 已在 v3.76 配对，本相位复核通过、无需再改 · **F8** §1.1 ① 改述为「推导名随 `--reviews` 拼写漂移、写入方无从判定」（撤掉「永不等于推导路径」的过强断言）· **F9** §3.2 重测为 31 workspace / 221 行、口径写成「含本 workspace 自身」，退役键改以 workspace 计数。 | [human] 裁定 · Claude（kairos:cdd-spec-writer · 2026-11-15） |
| v0.6 | 2026-11-15 | 评审 round 3 全量落地（F1–F6）：**F1（blocker）** `readFor` 的入参是身份文档条目、其 `rel` 是 spec 自身路径——原文「`entry.rel` 已在手却重新拼」是站不住的事实陈述（依它实现会把设计规格当 plan 解析，board 与 doc 轮的 plan 行全掉），改述为「plan 也是 slug 的派生名、索引里已有 plan 条目却不用」：plan 路径一律经 `docsOf(slug)` 的 plan 行取 `entry.rel`、无 plan 条目 ⇒ `undeclared`，`§1.3` / `§1.5` / `§1.6` / `§2.2` / AC（点名 `infra/__tests__/plan-source.test.ts:216-224` 与换源调用点 `Cli#runBoard` / `#boardReadTable` / `Cli#sceneOf`）与 Constraints 同步 · **F2** `planOf` 的第四个消费者 `BoardView#programBoard`（phase 板 plan 行）补进 §4.4 与重复身份 AC · **F3** §3.1 补两行（`Ledger.rowFor` / `#retiredSpecApplies` 的行级回退、`resolveHandoffName` / `#resolvedCarrierName` 的 doc 线 alias）并把「4 处消费」换成符号枚举，§3.3 与 legacy AC 同步点名，grep 门不再把未声明的改动面塞给 plan · **F4** round 身份保留可选坐标（`cycle` 接受 `number` 或 `string`、`attempt` 接受 `number`）——无 cycle 拼写是这两个成员的合法取值、不是待清理的例外，P34 `round-naming.test.ts:99-103` 的 pin 原样保留，`rulings` 与 `final` 仍同 stem ⇒ 无 cycle 身份 ⇔ `<line>-<op>.rulings.json`；往返 pin 与 AC 各加跑无 cycle 形态 · **F5** 迁移命令与其 `README.zh-CN.md` 镜像同批（§3.4 与迁移 AC ②）· **F6** 明写母契约行集八问的落点：`nameRule` = rendered 行的 `render` / declared 行的「无名字规则」，`归主文法` **不进类型**、住 §2.5 三条规则 + 逐行答案表 + `round-naming.test.ts` 枚举 pin。 | [human] 裁定 · Claude（kairos:cdd-spec-writer · 2026-11-15） |
| v0.7 | 2026-11-15 | 评审 round 4 全量落地（F1–F7）：**F1** `rulings` 的身份钉成**载体的身份**（`attribute(path.basename(the --reviews 载体))`，`op` 恒为 `review`）——§2.1 / §2.4 / §2.10 与 AC 同源，删掉「按本轮身份」这个第二个表达式（按 fix 轮身份会铸出 `plan-fix-1.c1.rulings.json`）· **F2** P35 Constraints 的「plan 路径由 `ENGINE_DOC_ROOTS.plans` + slug 派生」写成显式修订（改取索引 plan 行的 `rel`；`#scanRoot` 只增按根丢弃计数、文档谓词不动）并记入 D92 ⑦，母契约 Phase inventory P36 验收 ④ 由「`readFor` 只读 `entry.rel`」改为「plan 路径取自 `docsOf(slug)` 的 plan 行 `rel`；`readFor` 的入参是身份文档条目」 · **F3** (b) 的「扫描面干净」由只数 `specs/` 改为三个 doc 根全干净（`overalls/` · `specs/` · `plans/` 各一对计数，六个值全 0），并写清为何跨三根（`#isIdentity` 接受 overall）· **F4** plan 的路径读同一套三态（plan 行 ⇒ `rel`；干净缺失 ⇒ `undeclared`；plans 根不干净 ⇒ 未判态：零拒绝 + `(none)` + 一行 `CDD_WARN:`），P35 AC ③ 的「未入册 plan」重锚为未判态（「缺 `doc-type: plan`」一半改、「新 plan 覆盖旧 entry」一半仍健康），changeset 依据点名 · **F5** 索引单建写成可判口径——scene/ctx 一处构造入口 + 两处 `?? build` 兜底（`session/preflight.ts:364` · `contract/invariants.ts:332`）允许，红 pin 是「这三处之外无 `SlugIndex.build`」（五处 → 三处）· **F6** 引用拆分：`plan-source.test.ts` 的入参在 `:213-227`、打开的派生路径在 `:173-183`；`CarrierRulings.pathFor` 行号 `:57` → `:59` · **F7** §2.1 矩阵 `rulings` 行的「与 `final` 同名」改为「与 `final` 同 stem」。 | [human] 裁定 · Claude（kairos:docs-fix · 2026-11-15） |
| v0.8 | 2026-11-15 | **W2 修复轮的实现倒逼 spec 回填（编排者裁定 · 评审 tasks-2,3-review-2 F2 指出的正是这一点）**：计划 v0.10 把 T3 从「板面读 doc 域 `read(...)`」改成「读索引的集合端口」，理由是 `read` 按**声明的 `docType`** 单值判定，而 spec 格的**身份类**跨 `overall` / `phase-spec` / `single-spec` 三型——单值读答不出「三型里共有几份」。§2.2 因此补「身份类由集合端口回答」；§4.4 相应改写：同型歧义归 doc `read` 的 `invalid(found)`，跨型歧义归 `docsOf` 的 0/1/n（n>1 渲 `MARK_SLUG_DUPLICATED` + 全部 rel），**`attribute` 保持两态不加第三态**。这条回填是「spec 是权威」的落地：计划先动、spec 后跟，顺序记在这里而不是默默对齐。 | [human] 裁定 · Claude（编排器 in-flight 回填 · 2026-11-15） |
| v0.9 | 2026-11-15 | 评审 round 5 全量落地（F1–F7）：**F1** §2.3 的重复身份行拆成两臂——同型（同一 `(slug, docType)`）归 doc 域 `read` 的 `invalid(found)`、跨型归集合口 `docsOf` 的 n > 1（板面 `MARK_SLUG_DUPLICATED` + 全部 `rel`、派发由 `slugVerdict` 的 `duplicated` 挡下），删掉一条在 v0.8 契约下不可能产生的跨型 `read` 承诺 · **F2** plan 路径补上「同一 slug 两行 plan」这一格：`locate` 对 0 份与 ≥2 份都回 `null`，照 `null` 走会把「两份」答成 `undeclared`（授权「没有 plan」，正是 §2.7 禁止的）——plan 行恰一份才取 `rel`、≥2 落身份标记面（`next:` 不印 `kairos:cdd-plan`、派发由 `slugVerdict` 拒），§2.2 / §2.7 三态表新格 (d) / AC「plan 路径三态」/ AC 重复身份同批 · **F3** §2.2 的 `IdentityDomain` 契约按已交付实现回填：`locate` / `read` 收 `base: Workspace`（一个板面渲多 node workspace）、补 `entries()`、写明 `ArtifactRegistry` 聚合（`rows` / `rowOf` / `static nameOf`）与 `bindDocIndex` 就地绑定 + 零模块级默认实例，AC 新增「矩阵单实例」红 pin · **F4** 母契约 D92 ⑦ 与 Phase inventory P36 的 scope ② / 验收 ⑤ 改成同型 / 跨型两臂 + 集合端口（`docsOf` 0/1/n · `hasIdentity` · `identityDoc` / `planOf` 退役）与矩阵单实例，Design-spec 指针同步到本轮版本，母契约追加一条 Change history 行（v3.81）· **F5** §1 的「今日事实」列改成注册时基线并对已交付面随注当前符号（`pathFor` 删除 · `CarrierSeal` 问 `sealed` 行 · `identityDoc` / `planOf` → `docsOf` / `hasIdentity` · `InFlight.FILE` = `ArtifactRegistry.nameOf("in-flight", null)` · `planChain` 改问 `hasIdentity`），AC「索引单建」的「今日三处自建点」改为已交付的唯一构造点 `Cli#indexOf` · **F6** §3.2 的 `wave` 行计数换成它作证的条件（`wave` 行 ≥ 200，读者是一座已关闭的大语料），其余五个数不动 · **F7** 行号 pin 一律删成符号 pin（`RETIRED_SPEC_*` · `Ledger.rowFor` / `#retiredSpecApplies` · `#resolveHandoffName` / `#legacyCarrierName` · `carrierPattern` / `CARRIER` · `#rulingsInputOf` · `#orphanOf` · `SlugIndex.#isIdentity` · `CarrierSeal` 等），不让每落一波再错一次。 | [human] 裁定 · Claude（kairos:docs-fix · 2026-11-15） |
| v0.10 | 2026-11-15 | **归属判据回填为两级（编排者裁定 · plan 评审 9 F3）**：spec 原写「目录里 `attribute` 认不得的名字即 orphan」单级口径，而 T5 已交付的是两级——单级会把「已归主但无人认领」的载体（`tasks-1-fix-1-a2.json` 一类已交付 pin 的对象）静默漏掉。§2.5 改为 (i) 不归主 + (ii) 归主到 `draft`/`final` 但账本无记录认领；AC 的「归属」条同改。母契约 P36 行 ⑥ 的同一句随本轮回填。 | [human] 裁定 · Claude（编排器 in-flight 回填 · 2026-11-15） |
