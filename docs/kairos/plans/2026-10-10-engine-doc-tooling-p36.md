---
title: '引擎文档工具（Engine Doc-Tooling）— P36 计划：身份面收权（身份域 × 产物矩阵 · 缺席有门 · 形状可发现）'
doc-type: plan
version: v0.1
date: 2026-11-15
slug: 2026-10-10-engine-doc-tooling-p36
base: develop
---

## Constraints

- **逐字取 spec**：本计划只实现 `docs/kairos/specs/2026-10-10-engine-doc-tooling-p36-design.md` **现行 version v0.7** 所指的面；spec 版本一变，本约束的字面同笔改。
- **守恒边界**：既有六 kind（`draft` · `final` · `report` · `log` · `crash` · `evidence`）+ 三个工作区字面量（`progress.json` / `base.json` / `in-flight.json`）+ `tasks-{tasks}-brief.md` 的**名字逐字节不变**；P31/P34 已交付 pin 只许新增不许翻。历史拼写的可读性**不在**守恒面（spec §3.3）。
- **引擎只拒不改**：任何产物（载体、sidecar、文档）不得被移动、改写或删除；修复动作归编排器。
- **视图面零判定权**：board / capsule / preview 只渲染矩阵判定结果，不得重新推导名字。
- **零裸函数**：`packages/cdd-engine/src-next` 与 `packages/kairos/tests` 内不写行首 `function `；类或 `const` 箭头。静态面确有必要时带一行 `// biome-ignore lint/complexity/noStaticOnlyClass:` 理由。
- **一次读取**：任何读面（prompt 格、门、板面）读同一个判别值，不各读一次。
- **消费面纯度**：skill 文本零程序史 / 零相位号 / 零引擎内部实现词。

### Task 1: 矩阵骨架与 `WorkspaceDomain`

#### Objective

把「名字从哪来」立成一张封闭登记表：`session/round-artifacts.ts` 落 `Kind` / `Identity` / `Attributed` / `ArtifactRead` / `ArtifactRow` 五个值类型与 `ArtifactRegistry` 深类（`rows()` · `rowOf(kind)` · `render(identity, kind)` · `attribute(name)` · `read(identity, kind)`），首批只登记 workspace 四行（`progress` · `base` · `in-flight` · `brief`），并给出往返 pin 的骨架。本任务**不迁移** round / doc 两域（它们是 T2 / T3），但 `Identity` 的判别联合一次写全。

#### Files

- Create: `packages/cdd-engine/src-next/session/round-artifacts.ts`（值类型 + `ArtifactRegistry` + `WorkspaceDomain` 实现；`RoundDomain` / `DocDomain` 由 T2 / T3 登记进同表的同一处）
- Create: `packages/cdd-engine/src-next/session/__tests__/round-artifacts.test.ts`
- Modify: `packages/cdd-engine/src-next/session/inflight.ts`（`FILE` 常量继续是唯一字面，改为经 registry 读取；不改值）
- Modify: `packages/cdd-engine/src-next/face/artifacts.ts`（`base.json` 两处字面改经 registry；字节不变）
- Modify: `packages/cdd-engine/src-next/session/ledger.ts`（`progress.json` 读写两处字面改经 registry；字节不变）

#### Consumes

- `session/round-naming.ts` 的 `ArtifactKind` / `RoundArtifact` / `renderName` 既有形状（T2 复用，本任务不依赖其内部）
- `infra/runtime.ts` 的 `ENGINE_RUNTIME`（`brief` 的作者与读面）
- 既有 pin：`face/__tests__/cli.test.ts` 的 `base.json` 字面、`session/__tests__/ledger.test.ts` 的 `progress.json` 字面

#### Produces

- `type Kind`（联合：`draft · final · report · log · crash · evidence · rulings · progress · base · in-flight · brief`）
- `type Identity = {domain:"round"; line; op; cycle; attempt} | {domain:"doc"; slug; docType} | {domain:"workspace"}`
- `type ArtifactRead = {kind:"absent"} | {kind:"ok"; path} | {kind:"invalid"; path; reason} | {kind:"misplaced"; derived; found: readonly string[]; identity}`
- `type Attributed = {identity; kind}`
- `class ArtifactRegistry`：`rows(): readonly ArtifactRow[]` · `rowOf(kind): ArtifactRow` · `render(identity, kind): string` · `attribute(name): Attributed | null` · `read(identity, kind): ArtifactRead`

#### Steps

- 写失败测：`round-artifacts.test.ts` 断言 `rows()` 含四行 workspace kind、每行的 `author` / `sealed` / `identityFrom` 三格非空 —— checkable: 该文件跑红，报 `ArtifactRegistry` 未导出
- 实现五个值类型 + `ArtifactRegistry` 壳 + workspace 四行 —— checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/session/__tests__/round-artifacts.test.ts` 绿
- 写往返 pin：四行的 `attribute(render({domain:"workspace"}, kind))` 回到同一 `kind`，且 `render` 出的名字与今日字面逐字节相等（`progress.json` / `base.json` / `in-flight.json` / `tasks-{tasks}-brief.md`） —— checkable: 该断言绿
- 把三处字面改经 registry —— checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/session/__tests__/ledger.test.ts src-next/face/__tests__/artifacts.test.ts` 绿且零字节差

#### Acceptance

`ArtifactRegistry` 可实例化；`rows()` 恰四行 workspace kind；四行往返 pin 绿；三处字面改经 registry 后既有测试逐字节零差（守恒边界覆盖 workspace 面）。

#### DependsOn

none

### Task 2: `RoundDomain` 搬入矩阵 · `rulings` 行 · `pathFor` 删除

#### Objective

把 `RoundNaming` 的六 kind 渲染收进矩阵的 round 行（`identityFrom: "rendered"`），新增 **`rulings`** 行（`author: "orchestrator"`、`sealed: false`、与 `final` 同 stem **由身份渲染**），并删除 `CarrierRulings.pathFor`——sidecar 路径从此是 `render({domain:"round", …}, "rulings")` 的产物。`RoundNaming` 的旧名保留为别名，六 kind 名字逐字节不变。

#### Files

- Modify: `packages/cdd-engine/src-next/session/round-artifacts.ts`（round 行登记 + `render` 分派）
- Modify: `packages/cdd-engine/src-next/session/round-naming.ts`（`renderName` 委托 registry；`RoundArtifact` 映射到 `Identity` 的 round 变体）
- Modify: `packages/cdd-engine/src-next/session/carrier-rulings.ts`（`pathFor` 删除；`read` / `verdict` 改收 `Identity` 并在内部用 registry 渲染；`carrier` 键校验仍以 **carrier 的 basename** 为参照，故 `verdict` 同时收 `carrierPath`）
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（`#rulingsInputOf` / `#rulingsRefusal` 改走 `registry.read(identity, "rulings")`）
- Test: `packages/cdd-engine/src-next/session/__tests__/round-naming.test.ts`（六 kind 名字逐字节不变）
- Test: `packages/cdd-engine/src-next/session/__tests__/carrier-rulings.test.ts`（`pathFor` 零残留；`verdict` 对 `carrier` 键仍按其 basename 判）

#### Consumes

- Task 1 的 `ArtifactRegistry` / `Identity` / `ArtifactRead`
- `session/carrier-rulings.ts` 的严格 schema 判定（`TOP_KEYS` / `RULING_KEYS` / `#carrierRefusal`）
- `session/ledger.ts` 的 `carrierPathOf`（`carrier` 键的 basename 参照）

#### Produces

- round 七行登记（六既有 + `rulings`），`rulings` 名字 = `<line>-<op>-<cycle>[-a{n}].c<cycle>.rulings.json`
- `CarrierRulings.verdict(carrierPath, identity, findingIds)`（入参同时带 carrier 路径与 sidecar 身份）
- `pathFor` 删除后的唯一路径出口：`ArtifactRegistry#render(identity, "rulings")`

#### Steps

- 写失败测：`rulings` 的 `render` 等于 `final` 名换尾（cycle 段保留、`-a{n}` 保留） —— checkable: 跑红（行未登记）
- 登记 round 七行并让 `renderName` 委托 —— checkable: `round-naming.test.ts` 六 kind 逐字节绿 + 新 `rulings` 用例绿
- 删 `pathFor`、改 `read` / `verdict` 入参 —— checkable: `grep -rn "pathFor" packages/cdd-engine/src-next` 零命中；`carrier-rulings.test.ts` 绿
- 往返 pin 扩到 round 七行：`attribute(render(identity, kind))` 回到同一 `(identity, kind)`（含 `rulings` 的 `-a{n}` 与 cycle 段） —— checkable: 该断言绿
- 改 `lifecycle` 两处 —— checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/face/__tests__/lifecycle.test.ts` 绿

#### Acceptance

`rulings` 名字与 `final` 同 stem；`pathFor` 全仓零命中；`verdict` 仍拒 `carrier` 键不符的 sidecar；六 kind 名字逐字节不变；**往返 pin 覆盖 round 七行**（T1 只覆盖 workspace 四行，本任务补齐另一半）。

#### DependsOn

1

### Task 3: `DocDomain` + `SlugIndex` 单建一次

#### Objective

文档域进矩阵，但**只做 `attribute` / `locate`**：身份来自 front-matter `slug:`，路径取 `DocEntry.rel`，**没有 `render`**（spec §2.2 / §1.3）。同时把 `SlugIndex` 从「五处各 build」收成**建一次随 scene 下行**（`ctx.slugIndex ?? build` 升为唯一入口），并把 `attribute(slug)` 的多份命中判成 `invalid`（读取面不再取第一份）。

#### Files

- Modify: `packages/cdd-engine/src-next/infra/slug-index.ts`（`attribute(slug)` 返回 `Attributed | "ambiguous"`；`identityDoc` / `planOf` 在 ≥2 命中时不再返回第一份，改回 `null` + 由 `attribute` 报 `ambiguous`）
- Modify: `packages/cdd-engine/src-next/session/round-artifacts.ts`（doc 四行登记，`identityFrom: "declared"`）
- Modify: `packages/cdd-engine/src-next/face/cli.ts`（四处 `SlugIndex.build` 改吃场景/参数注入的索引）
- Modify: `packages/cdd-engine/src-next/session/preflight.ts`（同上）
- Test: `packages/cdd-engine/src-next/infra/__tests__/slug-index.test.ts`（`attribute` 四态：命中 / 未命中 / 非法 / 多份 ⇒ `ambiguous`）
- Test: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（`SlugIndex.build` 调用点收敛：结构断言）

#### Consumes

- Task 1 的 `ArtifactRegistry` / `Identity` / `Attributed`
- `infra/slug-index.ts` 的 `#bySlug` / `#judge` / `duplicatedRolesOf`（多份身份文档已有判定面）
- `contract/invariants.ts` 的 `ctx.slugIndex ?? build`（既有先例，升为唯一入口）

#### Produces

- doc 四行登记（`overall` · `phase-spec` · `single-spec` · `plan`，`identityFrom: "declared"`）
- `SlugIndex#attribute(slug): Attributed | "ambiguous" | null`
- 索引的唯一生产点（scene 构建一次）

#### Steps

- 写失败测：同一 slug 两份 phase-spec 时 `attribute(slug)` 回 `ambiguous`，且 `identityDoc(slug)` 回 `null` —— checkable: 跑红
- 实现 `attribute` + 三处判定收紧 —— checkable: `slug-index.test.ts` 绿
- 登记 doc 四行（无 `render`） —— checkable: `rowOf("plan").identityFrom === "declared"`
- 把四处 `build` 收成注入 —— checkable: 结构断言绿（源码中 `SlugIndex.build` 只余 scene 构建处）

#### Acceptance

doc 行零 `render`；同 slug 多份 ⇒ `ambiguous`（派发面 T6 据此硬停）；`SlugIndex.build` 调用点收敛到一处。

#### DependsOn

1

### Task 4: `plan-source` 正查与反查的三态

#### Objective

`PlanSource` 两条腿都改成**问身份、不问名字**（spec §2.7）：正查（相位 → plan）与反查（plan → 相位 spec）都走索引 + **扫描面干净度**的三态：(a) 命中按 `DocEntry.rel` 读；(b) 未命中且扫描面干净 ⇒ `undeclared` / `spec-absent`；(c) 未命中且扫描面不干净 ⇒ **未判态**（不拒绝、板面照渲 `(none)`）。`SlugIndex#scanRoot` 暴露**丢弃计数**（不可读 + `doc-type` 未入册），三态读的就是它。`<slug>.md` / `<slug>-design.md` 两条派生整条删除；`PlanOrphan.specPath` 收为 `null`（无读者）；P35 的值 pin 与板面 pin 按三态重锚。

#### Files

- Modify: `packages/cdd-engine/src-next/infra/plan-source.ts`（`readFor` / `#orphanOf` 重写；`PlanOrphan` 去掉 `specPath`）
- Modify: `packages/cdd-engine/src-next/infra/slug-index.ts`（`#scanRoot` 返回丢弃计数，随索引暴露）
- Modify: `packages/cdd-engine/src-next/face/words.ts`（`planOrphanSpec` 报文改述为「该 slug 名下没有身份文档（索引干净未命中）」）
- Modify: `packages/cdd-engine/src-next/contract/invariants.ts`（`CrossDocChainInvariant#planChain` 吃同一个三态：未判态不产 `Finding`）
- Test: `packages/cdd-engine/src-next/infra/__tests__/plan-source.test.ts`（三态六格 + 「slug 自带 `-design`」用例）
- Test: `packages/cdd-engine/src-next/face/__tests__/board-view.test.ts`（`! no-spec` 只属 (b)；(c) 与今日逐字节相同）

#### Consumes

- Task 3 的 `SlugIndex#attribute` / 单建索引
- `infra/plan-source.ts` 的 `PlanRead` 三态与 `PlanSource` 缝
- P35 的两条既有 pin（值 pin / 板面 pin）

#### Produces

- `PlanSource#readFor(entry)` / `#orphanOf(head)` 的三态裁决（`hit` / `clean-miss` / `indeterminate`）
- `SlugIndex#discarded(): {unreadable: number; unregistered: number}`
- `words.ts` 的新报文（无派生路径）

#### Steps

- 写失败测：slug 以 `-design` 结尾的相位 + plan ⇒ 正查命中、反查 (a)，**零拒绝** —— checkable: 今日必红（派生 `-design-design.md`）
- 写三态六格测（命中 / 干净缺失 / 脏缺失 × 正查反查） —— checkable: 跑红
- 实现 `discarded()` 与 `PlanSource` 重写 —— checkable: 两条测文件绿
- 改 `words.ts` 报文 + `planChain` 吃三态 —— checkable: `contract/__tests__/invariants.test.ts` 绿且未判态零 `Finding`

#### Acceptance

正查 / 反查各三格可判且成对 pin；`-design` 结尾 slug 放行；`(c)` 未判态零拒绝、板面字节与今日相同；`specPath` 零读者。

#### DependsOn

3

### Task 5: 归主文法 · duplicate ⇒ invalid · 归属泛化 · `sealed` 列

#### Objective

矩阵补两格（spec §2.5 / §2.8）：**归主文法**（每个 rendered 行声明「哪些名字仍归本行」——`ok` / `misplaced` / orphan 三格）与 **`sealed` 列**（`CarrierSeal` 改读它，`RULINGS_SUFFIX` 退役）。同时把 `Ledger#orphanHandoffs` 泛化成「目录里 `attribute` 认不得的名字即 orphan」（零写只显示），`attribute` 对同 `(identity, kind)` 的 ≥2 名字给 `misplaced`。

#### Files

- Modify: `packages/cdd-engine/src-next/session/round-artifacts.ts`（`ArtifactRow` 增 `attribution` 字面量；`attribute` 实现归主文法）
- Modify: `packages/cdd-engine/src-next/infra/carrier-seal.ts`（删 `RULINGS_SUFFIX`；`#isStray` 读 `sealed` 列）
- Modify: `packages/cdd-engine/src-next/session/ledger.ts`（`orphanHandoffs` 泛化为矩阵驱动）
- Test: `packages/cdd-engine/src-next/session/__tests__/round-artifacts.test.ts`（accepted-vs-orphan 枚举 pin）
- Test: `packages/cdd-engine/src-next/infra/__tests__/carrier-seal.test.ts`（`sealed` 列驱动；`report` / `log` / `crash` / `evidence` 一律不封）

#### Consumes

- Task 2 的 round 七行（含 `rulings`）
- `infra/carrier-seal.ts` 的 `sweep` / `seal` / `unseal`
- `session/ledger.ts` 的 `#handoffOwner` 两套正则（本任务由矩阵归主文法取代）

#### Produces

- `ArtifactRow.attribution`（正例 / 变体 / 非本行的三格字面量）
- `ArtifactRegistry#attribute` 的 `misplaced` 产出面（同 identity × kind ≥2 名字）
- `CarrierSeal#sweep` 读 `sealed` 列

#### Steps

- 写失败测：同一 round 的 `.rulings.json` 与 `.c1.rulings.json` 并存 ⇒ `attribute` 报双候选（供 T6 组报文） —— checkable: 跑红
- 实现归主文法 + `sealed` 列 —— checkable: 两条测文件绿
- 泛化 `orphanHandoffs` —— checkable: `session/__tests__/ledger.test.ts` 的 orphan 面绿；未登记名字出现在板上
- 删 `RULINGS_SUFFIX` —— checkable: `grep -rn "RULINGS_SUFFIX" packages/cdd-engine/src-next` 零命中

#### Acceptance

归主文法逐行声明且被枚举 pin；`CarrierSeal` 零后缀字面；orphan 仍零写只显示；`.rulings.json` 字面只在矩阵行与其夹具。

#### DependsOn

2, 3

### Task 6: `misplaced = block` 门

#### Objective

落 spec §2.3 / §2.4 的判别值与门：`#artifactReadOf(frame, kind)` **一次**算出 `ArtifactRead`，prompt 格与门读同一个值；`misplaced` ⇒ 派发前 `CDD_BLOCKED: artifact-identity`，报文四段（`derived` / `found` / `identity` / `repair`），多候选全列不选，`--dry-run` 同源可见，child 零 spawn，引擎只拒不改。

#### Files

- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（`#artifactReadOf` + `#artifactRefusal` 取代 `#rulingsRefusal`；`#valuesOf` 读同一值）
- Modify: `packages/cdd-engine/src-next/face/words.ts`（`artifact-identity` 词与四段报文）
- Modify: `packages/cdd-engine/src-next/face/preview.ts`（纯读门同源）
- Test: `packages/cdd-engine/src-next/face/__tests__/lifecycle.test.ts`（成对：变体在 ⇒ 停；两处都缺 ⇒ 不拦）
- Test: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（`--dry-run` 可见 + child 零 spawn）

#### Consumes

- Task 5 的 `attribute` 双候选面
- `session/preflight.ts` 的在飞门顺序（门须在取在飞记录之前）
- `face/words.ts` 的既有 `CDD_BLOCKED` 词表

#### Produces

- `#artifactReadOf(frame, kind): ArtifactRead`（唯一读取）
- `artifact-identity` 报文四段的词面
- `--dry-run` 的 `reads:` / 拒绝同源

#### Steps

- 写失败测：错位 sidecar ⇒ `CDD_BLOCKED: artifact-identity`、四段齐、`runner.calls` 为空 —— checkable: 跑红
- 实现读取面 + 门 + 报文 —— checkable: `lifecycle.test.ts` 绿
- 写预览同源测 —— checkable: `cli.test.ts` 的 dry-run 用例绿
- 写多候选测 —— checkable: 报文列全、不选、不写

#### Acceptance

成对 pin 成立（变体在 ⇒ 停 / 两处都缺 ⇒ 不拦且 prompt 字节零变）；多候选不二选一；`--dry-run` 与真实面同源；child 零 spawn。

#### DependsOn

2, 5

### Task 7: board 单向投影（`art:` 事实行 + `--artifacts`）

#### Objective

board 加**一条异常事实行** `art:`（默认零字节；健康树不新增字符），与 `in-flight:` / `crashed:` / `orphan:` 同族，插在行区之后、`next:` 之前；`--artifacts` 才摊开「一 kind 一列、一轮一行」的排障视图。board **不持有名字规则**，只渲染矩阵判定结果。

#### Files

- Modify: `packages/cdd-engine/src-next/face/board-view.ts`（`art:` 事实行 + `--artifacts` 视图）
- Modify: `packages/cdd-engine/src-next/face/cli.ts`（旗标接线）
- Test: `packages/cdd-engine/src-next/face/__tests__/board-view.test.ts`（健康树逐字节不变 + 异常仅新增一行）
- Test: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（`--artifacts` 展开面）

#### Consumes

- Task 6 的 `ArtifactRead`（板面只读判定结果）
- `face/board-view.ts` 的 `nextLine` / `reasonLine` / `inFlightRows` 既有事实行形状

#### Produces

- `art:` 事实行的字面与缩进（与 `orphan:` 同款）
- `cdd board … --artifacts` 的排障视图

#### Steps

- 写失败测：健康树上 board 输出逐字节等于今日（含 `next:` / `reason:` 位置） —— checkable: 先绿（作为守恒基线）
- 写失败测：一处 misplaced ⇒ 输出恰新增 `art:` 三行 —— checkable: 跑红
- 实现事实行 + 旗标 —— checkable: 两条测文件绿

#### Acceptance

健康树零字节变化（P33/P34/P35 的 board pin 全绿）；异常仅新增 `art:` 事实行；`--artifacts` 默认关。

#### DependsOn

6

### Task 8: legacy 拆族

#### Objective

按 spec §3 拆掉历史拼写读法：`RETIRED_SPEC_KEY` / `RETIRED_SPEC_LINE_KEYS`（**9 处消费 / 6 个方法**：`rowFor` · `#retiredSpecApplies` · `resolveHandoffName` · `#resolvedCarrierName` · `#retiredCarrierName` · `#ownerRow` · `#lineWord`）· `#legacyCarrierName` · `RULINGS_SUFFIX`（T5 已拆）。拆后旧 workspace 的板面退化为缺行 + orphan，新派发零影响；P34 §2.6 的「历史零迁移可读」收窄为「历史文件不被删除/改写；引擎不再识别历史拼写」。

#### Files

- Modify: `packages/cdd-engine/src-next/session/ledger.ts`（九个消费点全拆；`#retiredCarrierName` / `#legacyCarrierName` 删除）
- Modify: `packages/cdd-engine/src-next/session/round-naming.ts`（若 `CARRIER` 的 legacy 分支随拆，一并收）
- Test: `packages/cdd-engine/src-next/session/__tests__/ledger.test.ts`（退役面用例删除 / 改写为「旧键不再解析」）
- Test: `packages/cdd-engine/src-next/face/__tests__/board-view.test.ts`（旧 workspace 缺行 + orphan 的期望字节）

#### Consumes

- Task 2 / Task 5 的矩阵（归主文法接管旧名字 → orphan）
- spec §3.2 的实测命令与数字（31 workspace / 221 行 / 16 行 `spec` / 193 条 `spec-*`）

#### Produces

- 退役字面零残留（`RETIRED_SPEC_KEY` / `RETIRED_SPEC_LINE_KEYS` / `#retiredCarrierName` / `#legacyCarrierName` 全删）
- 旧 workspace 的新期望字节（缺行 + orphan）

#### Steps

- 写失败测：`wave: "spec"` 的账本行**不再**解析成文档行（读作缺行） —— checkable: 跑红（今日仍解析）
- 拆九个消费点 + 两个方法 —— checkable: 该测绿
- 改 board 的旧 workspace 期望字节 —— checkable: `board-view.test.ts` 绿
- 全仓 grep 门 —— checkable: 四个退役标识零命中

#### Acceptance

四个退役标识零残留；旧 workspace 板面缺行 + orphan；新派发行为零变化（守恒边界仍绿）。

#### DependsOn

2, 5

### Task 9: 词表别名 · 固定前缀读法句 · 读回提示印路径

#### Objective

三处消费面（spec §2.8 / §2.10）：`rulings` 行声明 `identifier: {canonical:"finding", accepts:["finding","id"]}` 且读取面双向兼容；fix / docs-fix 两壳各补**一句**读法（裁定回答某 finding id 并压过该 finding 自身建议 · carrier 只读）；`FIX_READBACK_SUFFIX` 从「教规则」改为「印已解析路径」（由 `Route` 带值、`RouteRenderer` 只填），并按 D74 记 deliberate pin 重锚。

#### Files

- Modify: `packages/cdd-engine/src-next/session/carrier-rulings.ts`（`identifier` 接受集）
- Modify: `packages/cdd-engine/src-next/render/templates.ts`（两壳各一句；`INPUT_RULINGS` 行只印路径）
- Modify: `packages/cdd-engine/src-next/session/next.ts`（`FIX_READBACK_SUFFIX` 收回规则句，改为值位占位）
- Modify: `packages/cdd-engine/src-next/face/route-render.ts`（五处 fix 行填解析后的 sidecar 路径）
- Test: `packages/cdd-engine/src-next/session/__tests__/carrier-rulings.test.ts`（`id` 与 `finding` 双向）
- Test: `packages/cdd-engine/src-next/render/__tests__/render.test.ts`（两壳各一句、`INPUT_RULINGS` 零正文）
- Test: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts` + `packages/kairos/tests/status-routing-convergence.test.ts`（fix 行字面重锚）

#### Consumes

- Task 2 的 `rulings` 行与其渲染
- Task 6 的判别值（present / absent 两格）
- `face/route-render.ts` 的五个 fix 行拼装点

#### Produces

- `IDENTIFIER` 词的接受集（单源）
- 两壳的读法句（字节稳定）
- 新的 `next:` fix 行字面（含解析后 sidecar 路径）

#### Steps

- 写失败测：`id` 键的 sidecar 被接受、未知键仍拒 —— checkable: 跑红
- 写失败测：`INPUT_RULINGS` 行零正文、两壳各含读法句 —— checkable: 跑红
- 实现三处 —— checkable: 三测文件绿
- 重锚 fix 行 pin（记录 deliberate） —— checkable: `cli.test.ts` 与 kairos 行为断言绿

#### Acceptance

`finding` / `id` 双向且未知键仍整份拒；两壳读法句在册且 `INPUT_RULINGS` 零正文；fix 行印解析后路径、`.rulings.json` 字面不出现在 `next.ts`。

#### DependsOn

2, 6

### Task 10: `docRoots` 零拼接门 + help 示例改形

#### Objective

把 #485 从「修一个分支」变成「结构上不允许写出来」：`docRoots` 只允许出现在三处白名单（`SlugIndex` 扫描根 · runtime/`RepoRoot` 组合 · `contract/invariants.ts` 的命名空间派生）；任何以 doc root 为基的模板串或 `path.join` 组合即红。`face/declare.ts` 的四个 help 示例（`implement` / `review` / `base set` / `board`）改成 `--plan <path>` / `--spec <path>` 形，零文档根插值。

#### Files

- Modify: `packages/cdd-engine/src-next/face/declare.ts`（四处示例）
- Create: `packages/cdd-engine/src-next/__tests__/doc-path-door.test.ts`（结构门：源码扫描）
- Test: 同一文件内的正反例（白名单三处放行 / 一处模板串即红）

#### Consumes

- Task 4 删除两条派生后的树（门落地即绿的前提）
- `packages/cdd-engine/src-next/contract/invariants.ts` 的 `DOC_ROOT_NAMESPACE` / `DOC_ROOT_SEGMENTS`（白名单第二项）
- `check:no-bare-functions` 的门形态先例（`scripts/` 的 grep 门）

#### Produces

- 一条可执行的结构门（`doc-path-door.test.ts`）
- 四处 help 示例的新形态（消费可见字节变化，记 D74）

#### Steps

- 写门 + 正反例（先在白名单上跑绿、在注入的模板串上跑红） —— checkable: 门文件自测绿
- 改四处示例 —— checkable: 门绿且 `cli.test.ts` 的 help 断言重锚后绿
- 全仓跑门 —— checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/__tests__/doc-path-door.test.ts` 绿

#### Acceptance

门可红可修：注入一处 `${docRoots.specs}/${slug}` 即红；白名单三处零误报；`declare.ts` 四处示例零文档根插值。

#### DependsOn

4

### Task 11: 消费面三 skill + README 双语迁移段

#### Objective

消费面落点与迁移说明（spec §2.10 / §3.4）：`cdd-dev` / `cdd-plan` / `cdd-spec-writer` 各一条裁决落点指令（挂既有 `## Invariants` 表一行，**不改** `skill-anatomy` 的 section registry）；cdd-engine README（EN + `.zh-CN.md` **双语同源**）补迁移段：89 个错位 sidecar 的一次性改名命令 + 升级后首次派发会 `CDD_BLOCKED: artifact-identity` 的说明。

#### Files

- Modify: `packages/kairos/skills/cdd-dev/SKILL.md`（`## Invariants` 一条）
- Modify: `packages/kairos/skills/cdd-plan/SKILL.md`（同上）
- Modify: `packages/kairos/skills/cdd-spec-writer/SKILL.md`（同上）
- Modify: `packages/cdd-engine/README.md` + `packages/cdd-engine/README.zh-CN.md`（迁移段，双语同源）
- Test: `packages/kairos/tests/skill-anatomy.test.ts`（既有强判：新行不得越出 registry）
- Test: `packages/kairos/tests/`（README 双语同步的既有 pin）

#### Consumes

- Task 9 的落点语义（裁定文件的路径与读法）
- `contract/skill-anatomy.ts` 的 `## Invariants` 既有 section（宿主）
- AGENTS.md 的语言政策（README 家族 EN + `.zh-CN.md` 同源）

#### Produces

- 三 skill 各一行落点指令（零程序史 / 零相位号）
- README 双语迁移段（命令 + 首次派发行为）

#### Steps

- 写三行指令 —— checkable: `pnpm -C packages/kairos exec vitest run tests/skill-anatomy.test.ts` 绿
- 写 README EN 段 + zh-CN 镜像 —— checkable: 双语 pin 绿
- 全量门 —— checkable: `pnpm run validate` exit 0

#### Acceptance

三 skill 各一条且在 registry 既有 section 内；README 双语同源；`pnpm run validate` exit 0；changeset `cdd-engine` minor + `kairos` minor 在册。

#### DependsOn

8, 9, 10

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-15 | 初稿：11 个任务按 `DependsOn` 成 **6 波**（W1{1} 矩阵骨架+workspace · W2{2,3} round/doc 两域 · W3{4,5} plan-source 三态 + 归属/辨识面 · W4{6,8,10} 门 / legacy 拆除 / docRoots 门 · W5{7,9} board 投影 + 词表与提示面 · W6{11} 消费面与迁移），每波 ≤3 个任务；守恒边界与「引擎只拒不改」写进 Global Constraints。 | [human] 裁定 · Claude（kairos:cdd-plan · 2026-11-15） |
