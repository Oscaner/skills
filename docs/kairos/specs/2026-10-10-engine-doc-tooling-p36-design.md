---
title: '引擎文档工具（Engine Doc-Tooling）— P36 设计：身份面收权（身份域 × 产物矩阵 · 缺席有门 · 形状可发现）'
doc-type: phase-spec
version: v0.2
date: 2026-11-15
slug: '2026-10-10-engine-doc-tooling-p36'
program: 2026-10-10-engine-doc-tooling
parent-version: v3.74
author: '[human] 裁定 · Claude（kairos:cdd-design · 2026-11-15）'
---

## Design

两个 issue、一个病：**身份被第二次表达**。

issue #484 说裁决 sidecar 的路径拼不出来、条目键名反直觉；issue #485 说 plan 派发按文件名推导设计规格、与同一包里按 slug 索引的 `cross-doc-chain` 给出相反结论。两条的表面症状不同（一个静默、一个硬停），病灶是同一句：**身份已经由 `RoundNaming` / `SlugIndex` 收成单源了，但只要某个面没被登记进去，它就会退回到「用另一个名字去猜」——猜出来的名字看起来完全合法，只是属于另一个坐标，而没有任何门看得见。**

本相位因此不分头修两个 issue，而是把「身份」升成一等公民，收成**身份域 × 产物 kind 的矩阵**：

- **身份域**回答「身份从哪来」：`round`（frame + 账本记录，派生）· `doc`（front-matter `slug:`，声明）· `workspace`（常量，单例）。
- **kind** 回答「哪些文件属于这个身份」：每个 kind 一行，声明 `author` / `identityFrom` / 名字规则 / `sealed` / `absence` / `misplaced` / 标识词表。
- **两个端口**：`attribute(name) → 身份 + kind | unknown`（三域都有）与 `render(身份, kind) → 名字`（**只有 `identityFrom: "rendered"` 的行有**）。一条往返 pin 把两端口绑死。
- **一个判别值**：`absent · ok(path) · invalid(reason) · misplaced(derived, found[])`，策略由行声明，不再由「哪个分支返回了空串」决定。
- **一个观测面**：board 只渲染矩阵的差异，永不持有名字规则。

三件不破坏的事：既有的**工作拼写**逐字节不变（P31/P34 已交付 pin 只增不翻）；`INPUT_RULINGS` 的 fix-only 语义与 round-context 行序不动；`next:` 字面（D70）与健康树的板面字节不动。

一件**主动放弃**的事：历史拼写的可读性。`RETIRED_SPEC_*` 与 P34 的无 cycle implement 读法一并拆除（§3），P34 §2.6 的「历史零迁移可读」收窄为「历史文件不被删除、不被改写；引擎不再识别历史拼写」。依据是数据：这族读法只服务已关闭的 workspace，而它们不会再被派发。

### 1. 病根

#### 1.1 一条链、三处断点（#484）

| # | 断点 | 今日事实 | 症状 |
| --- | --- | --- | --- |
| ① | **路径由文件名派生** | `CarrierRulings.pathFor`（`session/carrier-rulings.ts:57`）按 `--reviews` 实参的**完整文件名**换尾；同轮 workspace 并存 `<line>-<op>-<n>.json`（draft）与 `<line>-<op>-<n>.c<N>.json`（final），按 round stem 写出的 `.rulings.json` 永不等于推导路径 | issue 实测 89 个 sidecar / 位于推导路径 0 个 |
| ② | **缺席静默** | `#rulingsInputOf`（`face/lifecycle.ts:1390`）对 `absent` 返回空串，装配器丢整行；`invalid` 才派发前硬停 | 最可能的人为错误落在唯一无痕的分支：exit 0、handoff 照常落盘 |
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

| 面 | 今日实现 | 对同一份文档的结论 |
| --- | --- | --- |
| `cross-doc-chain`（`contract/invariants.ts`） | `SlugIndex.identityDoc(slug)`（按 front-matter `slug:` 建组） | 通过 |
| `plan-carrier` 腿（`infra/plan-source.ts:467`） | `` `${docRoots.specs}/${slug}-design.md` `` + `fs.exists` | 恒不存在（slug 自带 `-design` 时拼成 `-design-design.md`） |

后果：`review --type plan`、`implement --tasks`、`review --type branch` 三类派发全部硬停，而 `board` 同一份 plan 仍正常显示 spec 行——同一份文档，两个面给出相反结论。issue 实测：一个仓 26 份 plan 有 12 份被挡下。

更刺眼的是：**identity 记录本身已经带着路径**。`DocEntry` 有 `path` 与 `rel`（`infra/slug-index.ts:41`），`PlanSource.readFor(entry)` 却丢掉 `entry.rel` 去拼 `<slug>.md`（`infra/plan-source.ts:386`）——同一份身份被表达两次，第二次还拼错了。

拒绝文案再把病因指错一层：说「the plan's slug names no design spec」并给两条互斥修法（补规格 / 改 slug），而 slug 本身是对的；照做会造出 `-design-design.md`，或改坏一个同时是 workspace 目录名的身份。

#### 1.4 工作区层的老账

| 字面量 | 位置 | 现状 |
| --- | --- | --- |
| `"progress.json"` | `session/ledger.ts:741` | 读写各拼一次 |
| `"base.json"` | `face/artifacts.ts:174` / `face/cli.ts:1122` | 写面与读面各拼一次 |
| `"in-flight.json"` | `session/inflight.ts:129` | 常量单源，但矩阵外 |
| `tasks-{tasks}-brief.md` | `session/round-naming.ts` 的 `briefName` | 已在命名单源内，却自陈「不是轮次产物」——正好证明矩阵缺口 |

#### 1.5 全树审计：散落项与裁定

**Round 域**

| 项 | 位置 | 病灶 | 裁定 |
| --- | --- | --- | --- |
| `pathFor` | `session/carrier-rulings.ts:57` | 名字由文件名派生 | 删 → 矩阵 `rulings` 行 |
| `carrierPattern` / `CARRIER` | `session/round-naming.ts:44` | 拼写知识 #1（渲染端） | 归矩阵 pattern |
| `#WAVE_CARRIER` / `#LINE_CARRIER` | `session/ledger.ts:1993` / `:1999` | 拼写知识 #2（归属端） | 归 `attribute` |
| `RULINGS_SUFFIX` | `infra/carrier-seal.ts:24`、`:84` | 拼写知识 #3（写保护端） | 归 `sealed` 列 |
| `RETIRED_SPEC_KEY` / `RETIRED_SPEC_LINE_KEYS` | `session/ledger.ts:362` / `:370`，4 处消费 | 第二张「行键 → 行」表 | **拆除**（§3） |
| `#retiredCarrierName` / `#legacyCarrierName` / `#ownerRow` / `#lineWord` | `session/ledger.ts:1883` / `:1754` / `:1928` / `:1937` | 旧拼写读法 | **拆除**（§3） |

**Doc 域**

| 项 | 位置 | 病灶 | 裁定 |
| --- | --- | --- | --- |
| `<slug>.md` 派生 | `infra/plan-source.ts:386`（`readFor`） | `DocEntry.rel` 已在手却重新拼 | 用 `entry.rel` |
| `<slug>-design.md` 派生 | `infra/plan-source.ts:467`（`#orphanOf`） | #485 直接病因 | 问 `identityDoc(slug)` |
| 索引五处入口 | `face/cli.ts:512` / `:1249` / `:1591`、`session/preflight.ts:364`、`contract/invariants.ts:332` | 同一索引各建一次 | **单建一次随 scene/ctx** |
| `identityDoc` / `planOf` 取第一份 | `infra/slug-index.ts:182` / `:192` | 判定面已有 `duplicate-identity`，读取面却静默 | 多份 ⇒ `invalid` |
| help 示例写死 `p3-design.md` | `face/declare.ts:239` | 文案在教命名约定 | 改 `--spec <path>` |

**Workspace 域**：§1.4 的四个字面量入表。

**已经是单源、不动**：`SLUG_VALUE_PATTERN → SlugIndex` 同一字符串编译 · `RepoRoot` / `#rel`（P9）· `RoundNaming.renderName` 的六 kind 渲染（P34）。

#### 1.6 为什么不加特判

- **只修 #484**（变体探测 + 存在性硬停 + `schema get rulings`）：三处都停在「给这一例加特判」，下一个编排者产物来了同一场讨论重演。
- **只修 #485**（`#orphanOf` 改问索引）：plan 面通了，`readFor` 仍在拼 `<slug>.md`，矩阵外的第三个名字源还在。
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
  readonly absence: "ok" | "required";
  readonly identifier?: IdentifierVocabulary;
} & (
  | { readonly identityFrom: "rendered";
      readonly render: (identity: Identity, kind: Kind) => string;
      readonly misplaced: "block" }
  | { readonly identityFrom: "declared" }   // front-matter `slug:`；无渲染名，`misplaced` 不适用
);
```

| 域 | kind | author | identityFrom | 名字 | sealed | absence |
| --- | --- | --- | --- | --- | --- | --- |
| round | `draft` · `final` · `report` · `log` · `crash` · `evidence` | engine | rendered | 现有规则，**逐字节不变** | draft/final = true | ok |
| round | **`rulings`（新增）** | **orchestrator** | rendered | `<line>-<op>-<cycle>[-a<n>].c<cycle>.rulings.json`（与 `final` 同 stem，**由身份渲染**） | **false** | **ok** |
| workspace | `progress` · `base` · `in-flight` | engine | rendered | 现有三个字面量，**逐字节不变** | false | required |
| workspace | `brief` | engine | rendered | `tasks-{tasks}-brief.md`，不变 | false | ok |
| doc | `overall` · `phase-spec` · `single-spec` · `plan` | human | **declared** | **无规则**（自由命名；身份由 `slug:` 自述，读取一律经索引） | false | required / ok |

`rulings` 与 `final` 同 stem 是刻意的：sidecar 是「这一轮的评审载体」的附件，坐标必须是 `(line, op, cycle, attempt)`，于是 `--reviews` 传 draft 还是 final 都不再影响它——`pathFor` 的整个存在理由消失。注意这不是文字游戏：它由**身份**渲染，与 `final` 共用四段拼接，**不是对 `final` 的名字做字符串替换**（后者正是 `pathFor` 的错法）。

身份的判别联合与家在何处：

```ts
type Identity =
  | { domain: "round"; line: string; op: OpType; cycle: number; attempt: number }
  | { domain: "doc"; slug: string; docType: DocKey }
  | { domain: "workspace" };
```

- 矩阵、两个端口、`RoundDomain`、`WorkspaceDomain` 住 `session/round-artifacts.ts`（`RoundDomain` 即 `RoundNaming` 的扩行，旧名保留为别名）。
- `DocDomain` 与 `infra/slug-index.ts` **同源**：它就是索引的 `attribute` 面，不再有第二条文档路径推导。
- `CarrierRulings` 保留严格 schema 判定，路径改由矩阵渲染（`read` / `verdict` 的入参从「carrier 路径」变为「`(identity, "rulings")` 的渲染结果」）。

#### 2.2 三个身份域，一个契约

```ts
interface IdentityDomain {
  readonly domain: "round" | "doc" | "workspace";
  kinds(): readonly Kind[];
  attribute(name: string): Attributed | null;              // 名字 → 身份 + kind（三域都有）
  locate(identity: Identity, kind: Kind): string | null;   // 路径：rendered 域渲染，declared 域取 entry.rel
  read(identity: Identity, kind: Kind): ArtifactRead;      // 一份读取，判别值
}
```

- `RoundDomain` — `RoundNaming` 扩行 + `rulings`；`attribute` 取代 `carrierPattern` 与 `#WAVE_CARRIER` / `#LINE_CARRIER` 两套正则。
- `DocDomain` — **只做 `attribute` / `locate`（取 `entry.rel`）**，没有 `render`：不是「渲染失败」，是「文档没有名字规则」这一事实。`render(slug, "phase-spec")` 式的推导（`<slug>-design.md`）从引擎侧铲除。
- `WorkspaceDomain` — 单例，无坐标；`attribute` 认四个字面量。

往返 pin 只绑 `identityFrom: "rendered"` 的行：`attribute(render(identity, kind)) === { identity, kind }`（P34 已有渲染侧单射，这里补**渲染 ∘ 反解 = id** 的另一半）。声明物不参与该 pin，它的保障是 §2.8 ④。

#### 2.3 读取收成一个判别值

```ts
type ArtifactRead =
  | { kind: "absent" }
  | { kind: "ok"; path: string }
  | { kind: "invalid"; path: string; reason: string }
  | { kind: "misplaced"; derived: string; found: readonly string[]; identity: Identity };
```

| 情形 | 策略 | 行为 |
| --- | --- | --- |
| 推导名在盘上且合法 | — | `ok`，round context 印路径 + 正文（`rulings` 现行为） |
| 推导名在盘上但 schema 非法 | `invalid` ⇒ block | 派发前硬停（现行为，不变） |
| 推导名缺失、同轮 stem 变体存在 | `misplaced` ⇒ **block** | 派发前硬停（§2.4） |
| 推导名与变体都缺失 | `absent` ⇒ 按 `absence` 列 | `rulings` 的 `ok` 面静默（**prompt 字节与今日逐字节相同**） |
| 名字能归主但不等于渲染名 | `misplaced` ⇒ block | 同上 |
| 同一 slug 命中 ≥2 份身份文档 | `invalid` ⇒ block | 读取面不再取第一份（§4.4） |

`misplaced` 不引入新扫描面：`attribute` 已在矩阵里，把「同轮同 kind 的名字」反解出来即可。这一条是 issue ① 的严格版：不是「探测存在的变体」，而是「**任何能归主的名字都必须等于渲染名**」。

**一份读取、两个消费者**（P35 的教训直接适用）：判别值由 `face/lifecycle.ts` 的 `#artifactReadOf(frame, kind)` 一次算出，prompt 格（`#valuesOf`）与派发门（`#artifactRefusal`，取代 `#rulingsRefusal`）读同一个值。

`absence: required` 的四行**只声明、不强制**：它们各自的读点是既有失败通道（账本缺失、base 未设、文档未声明）。声明与强制分开是刻意的——一个命名相位不伪装成行为相位。

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

四条纪律：**只拒不改**（引擎不移动/改写/删除任何产物）· **多候选一并列出、绝不二选一** · **`--dry-run` 同源可见**（纯读门）· **board 可见**（同一判定落成 `art:` 事实行，派发前就能看到）。

#### 2.5 归属门泛化，`sealed` 入列

- `Ledger#orphanHandoffs` 从「只扫 `carrierPattern` 认得的名字」泛化为「目录里 `attribute` 认不得的名字即 orphan」；口径保持 P34/D89 的**零写只显示**：orphan 永不阻断。
- `CarrierSeal` 删除 `RULINGS_SUFFIX` 白名单，改读矩阵的 `sealed` 列。
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

#### 2.7 标识词表入列

`rulings` 行声明 `identifier: { canonical: "finding", accepts: ["finding", "id"] }`：读取面双向兼容（内部归一 `finding`），未知键仍整份拒；写入面单拼写，由提示面（fix/docs-fix 壳的 `INPUT_RULINGS` 行附一句条目形状）与读回提示共同给出，**不新增第三处枚举**。`review` 的 `findings[]` 与 fix 的 `dispositions` 的 `id` 不动——本相位只让「同一标识在两份相邻产物里换名字」这件事**有声明处**。

#### 2.8 机械强制五项

1. **往返 pin** — 全部 `identityFrom: "rendered"` 的 kind：`attribute(render(identity, kind)) === (identity, kind)`。
2. **守恒 pin** — 既有六 kind + 三个工作区字面量 + brief 的名字逐字节不变（矩阵重构是纯搬移）。
3. **未登记即观察** — 目录里放一个矩阵外的新名字 ⇒ 板面 `orphan:` 行出现；不阻断、不静默。
4. **文档路径零拼接** — `docRoots` 只允许出现在 `SlugIndex` 的扫描与 `RepoRoot` 组合处；引擎源码里出现「字符串拼接文档路径」（`${docRoots.…}/${slug}…`）即红。这条把 #485 从「修一个分支」变成「结构上不允许再写出来」。
5. **唯一构造点** — `.rulings.json` 字面只允许出现在矩阵行与其测试夹具；`finding` / `id` 的接受集同样单源。

### 3. legacy 拆除

#### 3.1 拆什么

| 面 | 位置 | 作用 |
| --- | --- | --- |
| `RETIRED_SPEC_KEY` / `RETIRED_SPEC_LINE_KEYS` | `session/ledger.ts:362` / `:370`（4 处消费） | 把键 `spec` 的行读成当前文档行 |
| `#retiredCarrierName` | `session/ledger.ts:1883` | `spec-<op>-<round>.json` 旧载体名 |
| `#legacyCarrierName` | `session/ledger.ts:1754` | 无 cycle 的 `tasks-<n>-implement.json` 旧载体名 |
| `#ownerRow` / `#lineWord` 的退役分支 | `session/ledger.ts:1928` / `:1937` | 旧行键 → 当前行的映射 |
| `RULINGS_SUFFIX` | `infra/carrier-seal.ts:24` | 第三处 sidecar 拼写知识（并入 §2.5） |

#### 3.2 依据（数据，不是猜测）

本仓 `.kairos/cdd` 实测：30 个 workspace · 220 行账本 · **16 行键为 `spec`**（P7–P22）· 旧拼写载体数百（`spec-review-*.json` / `spec-*-report.md`）· 无 cycle 的 implement 载体各 125 个。

这族读法的**唯一**消费者是这些已关闭的 workspace 的回看（`cdd board <旧 slug>`、capsule）；它们不再被派发，新 workspace 一律写当前拼写。留着的代价是持续的：一条「哪些 type 走旧载体名」的集合在账本里决定三处行为，而每个后续面（board / orphan / seal / 矩阵）都得记得它——这正是散落的来源。

#### 3.3 后果与既有裁定收窄

- 16 个旧 workspace 的 **doc 行读不到**（board 显示缺行）；旧载体变成 `orphan:`（可见、不阻断）；重新派发会从 cycle 1 开始（这些相位都已 Done，不会重派）。
- **新派发零影响。**
- P34 §2.6 的「历史文件与历史记录零迁移可读」**收窄**为「历史文件不被删除、不被改写；引擎不再识别历史拼写」。这是对已 ratified invariant 的显式修订，记入 overall D92，不默默改。

#### 3.4 迁移：现存错位 sidecar

issue 实测 89 个 `*.rulings.json` 全部落在推导路径外；升级会立刻把它们读成 `misplaced` ⇒ 硬停。迁移是**一次性、显式、由主编排器执行**的动作：

```sh
# 对每个 <line>-<op>-<n>.rulings.json，若同目录存在 <line>-<op>-<n>.c<N>.json（final），
# 改名为 <line>-<op>-<n>.c<N>.rulings.json。条目键名 id 已由 §2.7 的别名兼容，无需改内容。
```

sidecar 从不被封（P31），改名不受写保护影响；顶层 `carrier` 键（可选）若存在，其值是 carrier 的文件名，改名侧车不改这一项。命令写进 cdd-engine README 升级说明与三个 skill 的落点指令同批。

### 4. 失败面

#### 4.1 多候选

同一 `(identity, kind)` 命中两个以上名字：`found` 列全部，停在这里，**引擎不选**。修复由编排器做（删多余的那个）。

#### 4.2 缺席合法

`rulings` 的 `absence: ok`：裁决尚未记录是合法状态，不得因缺席拦派发、不得在 prompt 里伪造路径（P31 §2.5 成对钉原样保留）。

#### 4.3 未登记的名字

矩阵外的文件只进 `orphan:` 观察行，永不阻断派发（P34/D89 同一立场）。

#### 4.4 同一 slug 多份身份文档

判定面已有 `duplicate-identity` / `duplicate-plan`（`SlugIndex.#judge`）与 `slugVerdict.duplicated`；本相位把**读取面**补齐——`attribute(slug)` 命中 ≥2 份 ⇒ `invalid`，`identityDoc` / `planOf` 不再静默取第一份。

#### 4.5 存在但读不出

文件在推导名上但 IO 失败（权限、被删竞态）⇒ `invalid(path, "unreadable")`，不得读成 `absent`——「读不到」不得授权「没有」。

### Acceptance criteria

- 往返 pin：全部 `identityFrom: "rendered"` 的 kind 的 `attribute(render(identity, kind)) === (identity, kind)`；矩阵外新增名字必须先有行。
- 守恒：既有六 kind + `progress.json` / `base.json` / `in-flight.json` / brief 的名字逐字节不变（P31/P34 已交付 pin 只增不翻）。
- `misplaced = block` 成对 pin：推导路径缺而同轮 stem 变体在 ⇒ 派发前 `CDD_BLOCKED: artifact-identity`、报文四段齐、child 零 spawn、`--dry-run` 同源可见；两处都缺 ⇒ 不拦，且 absent 面 prompt 字节零变。
- 多候选：同 identity × kind 两个名字并存 ⇒ 报文列全、不选、不写；child 零 spawn。
- **#485 面**：slug 自身以 `-design` 结尾的规格 ⇒ `review --type plan` / `implement --tasks` / `review --type branch` 全部放行；`plan-carrier` 与 `cross-doc-chain` 对同一份文档结论必须一致（不一致即红）；`readFor` 只读 `entry.rel`（`<slug>.md` / `<slug>-design.md` 在 `infra/` 零命中）。
- **文档路径零拼接门**：`docRoots` 在引擎源码中只出现在 `SlugIndex` 扫描与 `RepoRoot` 组合处；`grep` 加回一处即红。
- **索引单建**：`SlugIndex.build` 调用点收敛到一处（scene/ctx 构建），`ctx.slugIndex ?? build` 之外无第二处生产入口。
- **重复身份**：同 slug 两份身份文档 ⇒ `attribute` 返回 `invalid`、派发硬停，`identityDoc` 不再取第一份。
- 归属：目录里未登记的名字 ⇒ 板面 `orphan:` 行，派发不被拦；`CarrierSeal` 不再硬编码任何后缀（`.rulings.json` 字面只在矩阵行与其夹具）。
- board：健康树默认视图逐字节不变（`next:` / `reason:` 位置与字节不动）；有 misplaced 时仅新增 `art:` 事实行；`--artifacts` 才展开。
- 词表：`finding` / `id` 双向兼容（内部归一 `finding`，未知键仍整份拒）；review `findings[]` / fix `dispositions` 的 `id` 零改动。
- legacy：`RETIRED_SPEC_*` / `#retiredCarrierName` / `#legacyCarrierName` / `#ownerRow` / `#lineWord` 的退役分支零残留（grep 门）；旧 workspace 的 board 退化为缺行 + orphan，新派发零影响。
- 消费面：`cdd-dev` / `cdd-plan` / `cdd-spec-writer` 各一条裁决落点指令在册（零程序史 / 零相位号）；`FIX_READBACK_SUFFIX` 的路径由渲染器取。
- `pnpm run validate` exit 0 · changeset `cdd-engine` **minor**（新增硬停门与 prompt 字节属消费可见变化 · D74）· `kairos` **minor**（skill 文本）。

## Constraints

- **身份只有一个源**：任何产物的名字必须是身份 × kind 的渲染；出现第二个派生点（由另一个名字换尾、拼后缀）即为缺陷。
- **声明物与产出物分轴**：文档的身份由 front-matter 自述，引擎**不得**由 slug 推导文档路径；`DocEntry` 自带 `rel`，派生即冗余。
- **引擎只拒不改**：不移动、不改写、不删除任何产物；修复动作永远归编排器。
- **视图面零判定权**：board / capsule / preview 只渲染矩阵的判定结果，重新推导名字即为缺陷。
- **既有工作拼写零改动**：本相位是命名知识的搬移与补行，不是重命名；**历史拼写的可读性不在守恒面内**（§3.3 的显式放弃）。
- **矩阵是封闭集**：新增 kind 必须加行并回答 author / sealed / absence / misplaced 四问；新增域必须回答「坐标是什么」。

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-15 | 初稿：issue #484 抽象为「身份域 × 产物矩阵」（一个身份源、两个端口、一个判别值、每 kind 声明的策略列）；`CarrierRulings.pathFor` 删除，`rulings` 成为矩阵一行；工作区四字面量收口；board 只增异常事实行。 | [human] 裁定 · Claude（kairos:cdd-spec-writer · 2026-11-15） |
| v0.2 | 2026-11-15 | 并入 issue #485 并按其证据**修正 doc 域设计**：文档是声明物（`identityFrom: "declared"`），没有名字规则、没有 `misplaced`——v0.1 里「文件名≠slug ⇒ block」会把消费方 10 份合法文档拦下，作废。新增：`DocEntry.rel` 取代两处路径拼接 · `SlugIndex` 单建一次 · 同 slug 多份 ⇒ `invalid` · `docRoots` 拼接 grep 门 · legacy 拆族（`RETIRED_SPEC_*` / `#legacyCarrierName` / `#retiredCarrierName` / `RULINGS_SUFFIX`，依据 16 行 `/` 125 组活数据只服务已关闭 workspace）+ P34 §2.6 收窄。 | [human] 裁定 · Claude（kairos:cdd-spec-writer · 2026-11-15） |
