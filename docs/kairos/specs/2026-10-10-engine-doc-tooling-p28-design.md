---
title: 引擎文档工具（Engine Doc-Tooling）— P28 设计：再生层入仓 + spec 易变事实纪律
doc-type: phase-spec
version: v0.4
date: 2026-11-06
slug: 2026-10-10-engine-doc-tooling-p28
program: 2026-10-10-engine-doc-tooling
parent-version: v3.35
author: '[human] 裁定 · Claude（本会话 · 2026-11-06）'
---

## Design

两条债同相位：**再生不在门内**（#425，P26 自己推迟的那层）与 **spec 装得下易变事实**（#431 ①，评审噪声的既有来源）。两条都不是「再加一道门」，而是**把已经存在的能力接到它该在的位置**：再生由 `emit` 拥有（于是门能修），判据由 `axesGuide` 与写作指令承担（于是不装现状）。

本相位结束时必须成立三件事：`pnpm run emit` 能从六份源重生成六份产物且字节干净；孪生门变红时其消息直接给出修法；spec 评审的 dispatch 提示词与两份写作 skill 都按「确认判据、不确认现状」的口径表述。**不设新门**——这是本相位与既往相位的分野，也是它的诚实边界。

### 1. 病根与本次边界

#### 1.1 再生面：门能红，但不能修（#425）

- 孪生门（`face/__tests__/diagram-twin.guard.test.ts#DiagramTwin`）必须能判「源与产物不一致」——这一半已经成立。
- 缺的另一半是修法：工具不在仓里，`docs/diagrams/README.md` 给的是一个由人填写路径的 Archify 占位，贡献者必须先自行备好 Archify、再填对路径。
- 于是门的红等于不可修的红；对没有装过 Archify 的贡献者，这道门只报告不存在。

#### 1.2 事实面：义务的写法把易变事实迎进了 spec（#431 ①）

- 「每个行为声称必须引用 colocated pin」这条义务只活在散文里（`render/templates.ts#docNarrativeAxes` 与 plan 变体），它的写法同时接纳了三类必然过时之物：行号、散文计数、现在时叙述。
- **必须成立**：评审噪声只落在这三类形态上——多出第四类即本纪律尚未收口；而每轮修噪声又在制造新的时差，修完却永远不结束的观感由此而来。

#### 1.3 本次边界

- #431 的其余三条（实现/重派死锁 · 评审无增量面 · 已关闭任务的 finding 路由）**不在本相位**：它们各自的缝不同（完成判据基线 · 评审读取面 · finding 路由）。
- 混进来会把一个边界清楚的相位撑成四块互不相关的改造；那三条按各自缝另行登记。

### 2. 再生面：清单从源派生，`emit` 拥有再生

#### 2.1 钉法

- Archify 落**仓库根** `devDependencies`（`scripts/emit.ts` 是根工具，不在 `packages/cdd-engine` 内），形如 `github:tt-a1i/archify#208acba8d412335185b2056fedf54b3405df43fb&path:/archify`。
- **钉到 commit 而非分支**：`208acba8…` 是 `v3.2.0` 的 peeled commit，与产物头写的版本一致；分支 HEAD 会静默漂移。
- **走 `#path:` 子目录**：该 skill 的包在源码仓的子目录，仓库根是另一个包。
- **不进 npm registry**：同名包是一个无关的占位版本，真身只经源码仓分发。
- 进 `devDependencies` 不是 vendor：源码不落树，`pnpm-lock.yaml` 记 sha。

#### 2.2 清单

- 产物清单**从源派生**，派生与渲染归 `scripts/lib/diagrams.ts#DiagramProducts`，`emit` 内零映射表——六份源各自声明 `diagram_type`（`architecture` / `workflow` / `lifecycle`）、`meta.output`（仓内相对产物路径）、`meta.quality_profile`。
- 新增或删除一份图只需动源与目录，`emit` 一行不改。

#### 2.3 调用与失败语义

- 渲染器经 `spawnSync(process.execPath, [bin, "render", type, src, out, "--quality", q, "--repo-root", repoRoot])` 直起 JS，不依赖 PATH、不依赖 shell 垫片。
- `pnpm install --frozen-lockfile` 之后 bin 必然存在；缺它即报错停止，不静默跳过——否则产物会悄悄停在上一版。
- 六发**串行**：串行是本档要求的形态——并行只增复杂度而不换可感收益。
- **全有或全无**：六份先渲染到临时目录，全部成功后才经 `scripts/emit.ts#EmitService.writeText` 落到 output root 并登记 `generatedPaths`；半套产物会让字节对比的红失去定位能力。
- 该档与既有产物同批、共用同一个 `emit` / `emit:check` 面，**不造第二个命令**。

#### 2.4 孤儿走查

- `docs/diagrams/*.html` 减去手写的 `index.html` 减去派生集，非空即报 stale。
- 删源留孤 HTML 与「改源不重生成」是同一类静默漂移，门必须同时看得见两头。

#### 2.5 为什么不 `finalize`

- 六份源经 `render` 与经 `finalize` 的产物**必须字节一致**——这是 `emit` 走 `render` 的前提，失配时以 `render` 产物为准（见 §7.1）。
- `finalize` 额外附带 `browser-check`（走宿主 Chrome + CDP）、receipt 文件与一次 update 网络查询——这三项对「每次都跑」的 `emit` 是纯负担，只在「人工重生成时多一道保险」处才有意义。
- 故 **`emit` 走 `render`；`finalize` 保留为文档里的人工全门路径**（要 validate / deliver / check / browser-check 四门就跑它，receipt 用 `--out-dir` 指到临时目录）。

#### 2.6 版本升级

- 改钉的 sha ⇒ 产物字节可能变化 ⇒ 六份必须同批重生成。
- 这条**不需要新门**：`emit:check` 的字节对比会自动强制。

### 3. 再生面：门把修法说出来

#### 3.1 孪生门给修法

- 孪生门变红的语义是「源改了没重生成」，修法是跑 `emit`；该门的 mismatch 消息必须统一附 `— regenerate: pnpm run emit`。
- 门由此从「能红不能修」变成「红的时候给出一个不需要外部安装的修法」——这是 #425 的收口标志。

#### 3.2 两份守卫的分工

- **不合并**：孪生门判**可复现性**（源与产物是否同一份事实），语义门（`face/__tests__/diagrams.guard.test.ts#SOURCES`）判**正确性**（源自己说错了没有——源里的命令计数与正文不一致时，孪生门恒绿）。
- 语义门的红**不**附重生成提示：重生成只会把错的东西再生成一遍，它的修法是改源。

#### 3.3 两条 colocated pin

- 产物派生集合必须恰为该六条 `meta.output`。
- `index.html` 不在集合内——它是手写的语言切换页，被当成产物就会被 stale 走查误杀。

### 4. 易变事实面：spec 写判据，plan 写落点

#### 4.1 三种形态与各自改写法

- **pin**：行为声称按 **模块路径 + 符号名** 引证，行号不是 pin。
- **计数**：「N 处 / N 条 / N 个模块」改成「由具名守卫钉住」——数量由守卫自己维持，不靠散文同步。
- **叙述**：现在时描述「今天是什么形状」属 plan；在 spec 里必须改写成「必须成立」的判据。

#### 4.2 落点一：spec 评审的 dispatch 提示词

- 改 `render/templates.ts#docNarrativeAxes`（spec 变体）——`phase-spec` 与 `single-spec` 共用这一处定义，故一改覆盖两形。
- 定稿句（三形态同句，句内以分号分隔）：
  - `Claimed→pin: every behavior claim (usage-line attribution · semantic contract · byte face) must cite a colocated pin by module path + symbol name — a line number is not a pin; a count ("N places" · "N rows" · "N modules") must be stated as pinned by the named guard or test; a present-tense description of today's shape belongs to the plan — in a design spec a measurement input is a lens-tagged finding unless restated as a condition that must hold — the review checks every claim against its pin, claim by claim; a pinless claim is a lens-tagged finding`
- 既有回归钉（`typecheck` / `test command` / `Claimed→pin` 三 token 必须仍出现）不重锚。

#### 4.3 落点二：写作 skill 的 author 节点

- `cdd-spec-writer` 的 author 节点加三条并列短句（形态照「判据 / 计数 / 叙述」三行）。
- `cdd-plan` 只加一行「引用留在 plan，别搬进 spec」：计划侧 `path:line` 是交付落点（§4.4），三形态的 pin 条款与 plan 的落点形态相抵，故不搬。
- 写进**既有节点正文，不新增 section heading**——`skill-anatomy` 只认注册过的 heading。
- **与父相位登记对齐**：Phase inventory P28 行验收格现写「两份写作 skill 的 author 节点含三条形态」，与上一条的「plan 只加一行」不等；该格须回填为「`cdd-spec-writer` 三条形态 · `cdd-plan` 一行」——回填是编排器的登记动作（父总纲不在本轮写权内），本 spec 与其验收只认回填后的口径。

#### 4.4 plan 侧不动与「不设门」

- plan 变体逐字不动：plan 的 `path:line` 是交付落点、本就每轮重推，禁它没有收益。
- **不设门**：写入瞬间不拦，牙只在评审提示词与写作指令上。这与 D75 同向——不为一类散文新增机件。
- 诚实边界须写在明处：**spec 里仍能写出行号 pin**，只是每轮评审会把它挑出来。

#### 4.5 回归钉

- 保留 `render/__tests__/templates.test.ts` 的三 token 断言（`REVIEWS.spec.axesGuide` 上的 `typecheck` / `test command` / `Claimed→pin`）。
- 另加三条稳定子串（`module path + symbol name` · `pinned by the named guard` · `belongs to the plan`）：改措辞不会因标点误红，删掉某条形态必红。
- 不做整串字节 pin。

### 5. 文件面与实现缝

#### 5.1 改动缝

| 面 | 缝 | 动作 |
|---|---|---|
| 依赖 | 根 `package.json` · `pnpm-lock.yaml` | 加 Archify 的 `github:#path:` devDependency（钉 `208acba8…`） |
| 再生实现 | `scripts/lib/diagrams.ts#DiagramProducts` | 新增 `DiagramProducts`：派生清单 + 渲染 + 落盘；**渲染器从构造器注入**（默认实现 `spawnSync`），使 pin 能桩掉真实进程 |
| 再生成品 | `scripts/emit.ts#EmitService` | 产物档接入 `EmitService` 与 `generatedPaths`；stale 走查增孤儿腿 |
| 回归 pin | `scripts/__tests__/` | 派生集合与 `index.html` 排除两条 |
| 文档口径 | `docs/diagrams/README.md` · `AGENTS.md` | 日常再生 = `pnpm run emit`；人工全门 = `archify finalize`；删除人填的 Archify 占位参数 |
| 提示词 | `render/templates.ts#docNarrativeAxes` | 换 `Claimed→pin` 段 |
| 提示词 pin | `render/__tests__/templates.test.ts` | 三 token 保留 + 三条子串 |
| 门消息 | `face/__tests__/diagram-twin.guard.test.ts#DiagramTwin` | mismatch 消息附修法 |
| 写作指令 | `packages/kairos/skills/cdd-spec-writer/SKILL.md` · `.../cdd-plan/SKILL.md` | author 节点加三条形态 / 一行 |
| 变更集 | `.changeset/` | `cdd-engine` minor + `kairos` minor |

### 6. 任务切分与波次

#### 6.1 三个任务

- **T1（再生层）**：依赖钉法 + `DiagramProducts` + `emit` 一档 + 孤儿走查 + 两条 pin。
- **T2（门的修法 + 文档口径）**：孪生门消息 + `docs/diagrams/README.md` + `AGENTS.md`；`DependsOn: T1`——它引用的命令必须先存在。
- **T3（易变事实面）**：`docNarrativeAxes` 改写 + 三条子串 pin + 两份写作 skill；不依赖任何其它任务。

#### 6.2 波次

- 按 `DependsOn` 分层：**W1 = {T1, T3}**，**W2 = {T2}**。宽度 2 / 1，符合波宽上限。

### 7. 失败模式与边界

#### 7.1 失败面与各自修法

- **未安装依赖**（bin 不存在）：`emit` 报错停止，不静默跳过。
- **任一源渲染失败**：零写盘（全有或全无），错误指名该源。
- **删源留孤产物**：孤儿走查报 stale，修法是删那份 HTML。
- **升级钉的 sha**：字节对比红，直到六份同批重生成；无需新门。
- **新增图**：只加源与目录；`emit` 自动覆盖，`emit:check` 自动纳入。
- **`render` 与 `finalize` 的产物不再一致**（上游版本变更）：以 `emit` 的 `render` 产物为准，孪生门是终判——`finalize` 不是事实源。

### Acceptance criteria

- `再生可跑`：`pnpm run emit` 后工作树对 `docs/diagrams/` 零差异；六份产物由源派生（源码 pin：清单来自每份源的 `diagram_type` / `meta.output` / `meta.quality_profile`，`emit` 内零映射表）。
- `门能修且能红`：手改一份产物的一行 ⇒ `emit:check` 红并指名该文件；恢复后绿。删一份源 ⇒ 孤儿走查红并指名那份 HTML。
- `孪生门说修法`：该门 mismatch 消息含 `regenerate: pnpm run emit`（字符串 pin）；语义门的消息**不含**该提示（对照 pin，防误挂）。
- `两条 colocated pin`：派生集合等于六条 `meta.output`；`index.html` 不在集合内；各自可反向红。
- `依赖可追溯`：根 `devDependencies` 钉到 `208acba8…`（非分支、非 semver 范围）；`pnpm-lock.yaml` 记同一 sha；bin 由 `process.execPath` 直起（源码 pin：不经 PATH 与 shell 垫片）。
- `spec 面三形态可读`：`docNarrativeAxes` 仍含 `typecheck` / `test command` / `Claimed→pin`（既有 pin 零重锚），且含三条子串各一条（`module path + symbol name` · `pinned by the named guard` · `belongs to the plan`）；`REVIEWS.overall.axesGuide` 仍零 `path:line`（既有禁词 pin 不破）。
- `plan 变体零变化`：plan 的 `axesGuide` 与改前逐字相同（对照 pin）。
- `写作 skill 承接口径`：`cdd-spec-writer` 的 author 节点含三条形态，`cdd-plan` 含「引用留在 plan」一行；两份均**不新增 heading**（`skill-anatomy` 门绿）；父相位登记同口径——Phase inventory P28 行验收格回填为「`cdd-spec-writer` 三条形态 · `cdd-plan` 一行」（编排器登记，见 §4.3）。
- `文档口径改向`：`docs/diagrams/README.md` 与 `AGENTS.md` 的日常再生指向 `pnpm run emit`，人填的 Archify 占位参数零残留，人工 `finalize` 命令可复制执行。
- `全量门`：`pnpm run validate` exit 0；changeset `cdd-engine` **minor** + `kairos` **minor**。

## Constraints

- **不设门**：不为三类散文新增 doc-contract 规则或机检；牙只在 `axesGuide` 与写作指令上（用户裁定 · 与 D75 同向）。
- **`finalize` 面零改动**：人工全门路径的命令、旗标与 receipt 语义不动，只改文档口径。
- **孪生门只加消息**：三腿判据（引用多重集 · 文案孪生 · 产物身份）逐条不改；语义门整体不动。
- **plan 变体逐字不动**：本相位只改 spec 变体的提示词。
- **不改既有字节语义**：`emit:check` 的对比与 stale 机制只扩产物集，不换实现；既有两个产物根与文件清单不动。
- 无新命令、无新旗标、无新环境变量：再生入口仍是 `pnpm run emit`。
- 零模块级裸函数：`DiagramProducts` 写成类，渲染器经构造器注入（可桩）；静态面带 biome-ignore 与一行理由。
- `skill-anatomy` 零新增 heading：写作指令进既有节点正文。
- 波宽 ≤ 3：任务 `DependsOn` 分层任一不超过 3。
- **本 spec 自我执行新口径**：全文不装行号 pin、不写散文计数，引证一律 `path#symbol`；描述现状只在它是某条决定的前提处出现，且以「必须成立」的形态收尾。

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-06 | 初版：grilling 三轮的前沿全部落成设计——再生层走根 devDependency + 源自派生清单 + `render`（非 `finalize`）· `emit` 全有或全无并含孤儿走查 · 孪生门红时给修法、两份守卫分工不合并 · spec 变体三形态与两条写作落点、不设门 · 任务切分 W1={T1,T3} / W2={T2} | [human] 裁定 · Claude（本会话 · 2026-11-06） |
| v0.2 | 2026-11-06 | 结构合规重排（内容不变）：Design 各分组补 `#### N.M` 条目层级、`### Acceptance criteria` 归三级、验收条目改以代码片段起头——三处均按 `contract/declare.ts` 的 `presence` 元素对齐，此前形态过不了 doc-contract | Claude（本会话 · 2026-11-06） |
| v0.3 | 2026-11-06 | 评审修轮（phase-spec-review-1 全数应用）：§4.3 与验收格记录「plan 只收一行」与父相位登记格的回填口径（三形态只落 `cdd-spec-writer`）· 去掉 §1.2 与 §2.3 的实测叙述、§2.5 前提改「必须字节一致」· 代码行为声称改 `path#symbol`（`#DiagramTwin` · `#docNarrativeAxes` · `#EmitService.writeText` · `#DiagramProducts` · `#SOURCES`）· 文件补 EOF 换行 | Claude（本会话 · 2026-11-06） |
| v0.4 | 2026-11-06 | **design-backfill（cdd-plan）**：`parent-version` 跟进父 overall v3.35（Phase inventory P28 AC 写作 skill 口径对齐） | Claude（kairos:cdd-plan · design-backfill） |
