# 文档架构方法论 v2 — P4.1 Design Spec（lifecycle 前置校验统一 · schema 一致硬化 · next 可执行字面量）

- **Version**: v1.2 · 2026-10-09
- **Status**: Draft
- **Author**: [human] · Claude Opus 5（kairos:cdd-design → cdd-spec-writer · 决策源 = grilling 收敛 + spec-review-1/2 修正 2026-10-09）
- **Parent program**: [doc-architecture-v2-overall.md v1.47](docs/kairos/specs/2026-10-02-doc-architecture-v2-overall.md)
- **Depends on**: P3.2（Done · overall v1.47 —— serial-phase GATE 满足，P4.1 可开线）
- **全树基线修正声明**：较 parent overall v1.47 的 P4.1 注册行/依赖图/变更行（5 拆链 · 47 spec/plan 补齐 · 10 无头建档），本 spec 基线以 2026-10-09 实测复核为准（4 携链 · 49 补表 · 12 无匹配形 = 10 真无头建档 + 2 bold 归一）——差异为父注册后的实测修正，phase close 六表同步以本声明对账

## Design

P4 起写期三发现作用域化为本 phase（用户 2026-10-09 拍板「直接作用域 lifecycle 前置校验 · schema 统一看」（六前提）+「next 最好是能给出可执行命令的字面量」（v1.39 语义文本实证反效——agent 反复试错映射反而增 token））：① review（及全部 dispatch）缺 clean-tree 前置硬门——技能文本已宣称「engine entry gate: dirty → BLOCKED」但引擎零实现（契契/实现错位，`isClean()` 原语闲置）；② 文档版本谱系结构泄漏——`**Version**` 头堆积链式/补充说明散文、spec/plan 无 `## Change history` 归宿、selfBounded 只判 overall、presence/pattern 三类型不一致；③ `next:` 语义字面（v1.39 · T26 ⑥-h）需 agent 心智映射为完整命令，试错成本反超 token 减量收益——反转决策：渲染完整可执行命令。本 phase 三发现统一收敛：前置校验进 Lifecycle 单一 seam · schema 面三类型同构 · next 字面可执行化。全树迁移基线（2026-10-09 实测）：**53 文档**（specs 29 · plans 24）· **4 overall**（已有 Change history）· **49 非 overall**（23 design + 1 cdd-review-contract-fix + 24 plans + 本文件）· **12 无匹配形**（10 真无头 · 2 bold 形——p3.2 design/plan `**vX.Y**`）· **4 携链**（p3.1/p3.2 design×2 + plan×2）· **25 非严格形 Version 头**（= 有头且非严格、不含 bold——2 bold 归 12 无匹配形桶，机械扫「有头非严格」27 = 25 + 2 口径自洽 · 含 3 旧 overall：osuperpowers `v1.61`/consumer-parity `v1.49` 缺日期 · pi-harness `v1.30` 带补充说明）。迁移范围按**规则**定义（spec-review-1 blocker 纠正：静态计数易腐，以规则 + 机械复核为准，数字为实测基线并非验收真值）。

### 1. Lifecycle 前置校验统一（pre-flight seam）

#### 1.1 现状与契契/实现错位

现有前置门散在三处（无统一 seam）：wave 波次门 + plan-graph validate 在 `#runWork`（face/cli.ts）· doc-contract 结构判定在 `Contract.validate()`（contract/judge.ts）· evidence/读回门在 dispatch child 面（产出回读，**非前置**）。`infra/git.ts#isClean()` 原语存在但全引擎零消费（引擎测试核验成立）。cdd-spec-writer / cdd-plan / cdd-dev 的 Invocation discipline 均宣称「engine entry gate: dirty → BLOCKED」——技能契约已声明、引擎行为缺失，每次 doc review 在脏树裸跑。

#### 1.2 Clean-tree 硬门（全动词）

`implement` / `review` / `fix` 任一 dispatch 前置统一插入 `isClean()` 检查：工作树脏 → BLOCKED（`CDD_BLOCKED:` 通道 + 指引「commit 或 discard 后按 `next:` 重跑」），child 零派发。三动词同一门（零例外、零 downgrade）——兑现技能文本已宣称的 entry gate，恢复 osuperpowers P4 双门纪律（review 基准 = 已提交状态）。

#### 1.3 Pre-flight seam 收敛形态（钉死单入口）

前置校验收敛为 **Lifecycle pre-flight seam 单入口**（`Lifecycle` 前置校验方法，或 service 面等价单点）：tree-clean 门 + doc-contract 门（`Contract.validate`）+ wave 波次门（`WaveGate.vet`）顺序组合；cli 只编排、不重复实现（零「cli 面第二份实现」）。门序：tree-clean →（wave 面）plan-graph validate + WaveGate →（doc 面）Contract.validate → dispatch。**evidence/读回门留驻 dispatch child 面**（产出回读语义 · 非前置；seam 不含）。

#### 1.4 输出契约

BLOCK 话术走既有 `CDD_BLOCKED:` 通道 + `next:` 重跑指引（词表钉）；skill 输出面零新字段。

### 2. Schema 一致硬化（三类型同构）

#### 2.1 `**Version**` presence required ×3

计划注册表 `**Version**` 现为 optional（历史残余；overall/phase-spec 均 required）→ 三类型统一 required。有版本谱系是文档常态；optional 造成「无头文档无谱系」不一致。bold 形（`**vX.Y**`）一并归一（2 文档——p3.2 design/plan）。

#### 2.2 `**Version**` valuePattern 严格形

头仅版本号+时间零补充说明（用户 2026-10-09 裁定：「Version 不需要有补充说明，只要版本号+时间即可。所有说明都应该在 change history 里」）：`^- \*\*Version\*\*: v\d+\.\d+ · \d{4}-\d{2}-\d{2}$`。头部链式（`前置 v…` telescope）与 parenthetical 补充说明从此结构上不可能——一切说明归 `## Change history`。

#### 2.3 `## Change history` required ×3（补齐）

spec/plan 注册表新增 `## Change history` 元素（含行/版本 token/日期元素，与 overall 同构）；presence = required（补齐，不 conditional）。version-lineage refKind 从此三类型都有结构归宿。

#### 2.4 selfBounded ×3

selfBounded invariant 现只判 overall（`this.overall(ctx)` 非 overall 归空）→ 扩展判 spec/plan：header version = 表中最新行且必在行内。版本头与变更记录一致性机械钉住三类型。

#### 2.5 派生面同步

元素登记表（contract/declare.ts）为唯一声明源——valuePattern/presence 改动 → 派生 schema / slices / description 全投影（一声明四派生），schema 字节 pin 测试随动更新。

### 3. 全树迁移（规则为准 · 基线数字实测）

#### 3.1 范围声明

迁移集 = **全树 53 文档**：4 overall（已有表 · 头部严格化——`v1.61`/`v1.49` 补日期（= 其 Change history 末行日期，零虚构）· pi-harness 去补充说明）+ **49 非 overall 补齐 `## Change history`**（23 design + 1 cdd-review-contract-fix + 24 plans + 本文件示范）+ **12 无匹配形**（10 真无头 plans 建档：补 `**Version**` 头 + 初始行，formalize 非虚构 · 2 bold 形 `**vX.Y**` 归一为严格形，有版号非建档）+ **4 携链拆链成行**。数字为 2026-10-09 实测基线；**实施期以机械清点复核为准**（验收按规则断言 · 不按基线字面数）。

#### 3.2 拆链与建表

4 携链文档（p3.1/p3.2 design×2 + plan×2，均无表）：头部 `前置 v…` 逐版本拆为 `## Change history` 行（overall 链已随 P4-close 拆除）。overall 已有表 → 仅头部严格化复核。表行版本升序 ascending。

#### 3.3 保真转录与零残留共处定案

**保真转录** = 头部历史文本结构性拆为表行（版本摘要逐字入 summary 列，历史正文零 retro-rename）：④ 携链 telescope 按 `前置 vX.Y` token 逐版拆行；`**Version**` 头补充说明内嵌的多版本历史**同样转录**（实测样本：consumer-parity p2 design v1.4 括号内 v1.0→v1.4 全史 · osuperpowers p3 design v1.2 括号内 v1.0/v1.1/v1.2 · pi-harness p5 plan v1.3 括号后 v1.0→v1.4 序列）——按 `· vX.Y` 版本 token **全量切行**（非仅最新版单行）、摘要逐字入行，行切分粒度由此定案。**机 pin 无损断言扫描面 = 迁移前头部文本 vs 迁移后表行并集零漏**；**`前置 v` 零残留 grep 扫描面 = `**Version**` 头行**（归一化后）——Change history 表行豁免（表行正当含历史字样「前置 vX.Y · date」；引述/版本行改名记录为历史清单豁免）。两验收不互斥：结构段剥离（头零残留）+ 行内残留按表行豁免。

#### 3.4 严格形与建档

全树 `**Version**` 头剥除补充说明/链/bold 形 → 严格形 `vX.Y · date`（25 非严格形全清，含 3 旧 overall——口径：非严格形 = 有头且非严格、不含 bold，2 bold 归 12 无匹配形桶；剥除文本零丢弃：链按 §3.2 拆行、补充说明按 §3.3 转录）。**10 真无头补 `**Version**` 头 + 初始行**（2 bold 形有头、非建档——p3.2 design/plan 兼为 4 携链，表行随 §3.2 拆链归入）。零虚构：建档日期 = 迁移日期，初始行如实记录「建档于迁移」。

### 4. 技能流程调整（author→commit→review）

#### 4.1 技能顺序随门调整

clean-tree 硬门迫使 author 先提交再 review：cdd-spec-writer / cdd-plan 的 author→review 之间插入 commit 步骤；cdd-dev 的 implement 已由 child commit（gate 顺延到 review 入口验证）；技能 digraph/节点文本/Invocation discipline 同步（三技能 + 相关引用面）。

#### 4.2 emit / changeset / validate

SKILL.md 调整走 skill-anatomy 契约 + `pnpm run emit` 再生；engine fix + kairos docs 各一 changeset；全量 validate ALL PASS。

### 5. `next:` 可执行命令字面量（find #3 · 反转 v1.39）

#### 5.1 现状与反效实证

v1.39（T26 ⑥-h）把 `next:` 定为语义字面（`[verb] [target-type] [id] (payload)`——`implement wave {tasks}` · `review wave {tasks} (base …)` · `fix wave {tasks} --findings …`），意图减 token。实证反效（本次现场案例）：`next: fix spec <path> --findings …` 缺 `--type spec` 被 CLI 拒 → 编排方试错补 flag、反复派发——**agent 心智映射成本 + 试错轮次反超语义减量收益**；「the literal is the dispatch, no kind→command mapping layer」的声称在语义字面下不成立（映射层实际存在）。

#### 5.2 反转：完整可执行命令渲染

`next:` 渲染 = **完整可执行命令**（`cdd <verb> --type <type> <id> <路径/荷载 flag>` 全参齐备：`cdd implement --type wave --plan <path> --tasks 17` · `cdd review --type spec --spec <path>` · `cdd fix --type spec --spec <path> --findings <handoff>` · `done` 裸终词保持）。(read file back to confirm) 等提示后缀保留。零映射层第一次为真——编排方取字面即可执行。

#### 5.3 组合点（OOP 统一 · 零硬编码）

组合点 = `#capsuleLines` → routeText：从**命令声明表**（`CLI_COMMANDS`/usage 域已声明 verb/flag 域 + **本 phase 补实现的 implement type 域**）派生全参 argv——implement 声明表补 `--type`（默认 wave，兑现 `#runWork` 已读的 `parsed.args.type ?? "wave"`）+ render 必含 `--plan`（required），否则含 `--type` 的 implement 字面 parse 必拒；帧事实（type/tasks/doc 路径/base-head/findings）填入声明参数域；命令声明即渲染源，无第二份硬编码格式串。⑦-n branch-ref 单身份派生保持（fix 从 `--findings` 读范围，零冗余 base/head 声明）。

#### 5.4 消费面同步

四技能 Review Convergence（I2/I1/I3）文本随改：`next:` = 完整可执行命令字面量（副词面例更新）；「read file back to confirm」读回纪律保持。skill-anatomy/emit 随。

#### 5.5 回归测试

next 字面**二次 parse 零错误**断言（把 next 字符串再喂 CLI `parse()` 成功——断言面 = **三命令动词 implement/review/fix × 全 type**；`routeWords` 四词 = 三命令动词 + `done` 终词，`done` 单独断言裸终词、**不喂 parse**；implement 声明表补 `--type`（默认 wave）+ render 必含 `--plan`（required）后方可 parse 通过）+ 三命令动词 × 全 type 干 run E2E 直接派发（`rev1→implement wave 2` 等实链重验）+ 词表 `routeWords` 词面同步。BLOCKED/TIMEOUT 轮保持无 next（`CDD_BLOCKED:` 通道语义不动）。

### Acceptance criteria

- `implement/review/fix 三动词 dispatch 前置含 clean-tree 硬门：脏树 → CDD_BLOCKED（含 commit/discard 指引）· child 零派发 · 回归测试（三动词 × 脏树负例）`
- `技能契约兑现：cdd-spec-writer/cdd-plan/cdd-dev 的「engine entry gate: dirty → BLOCKED」与引擎行为一致（契契/实现错位零残留断言）`
- `seam 单入口：tree-clean + doc-contract + wave 收敛 Lifecycle pre-flight（cli 零重复实现）· evidence/读回门留驻 child（归属声明可判）`
- `三类型注册表同构：**Version** required ×3 · valuePattern = 版本号+时间严格形（bold 形归一）· **Change history** required ×3（含行/日期元素）· 派生 schema/描述面随投影（字节 pin 测试更新）`
- `selfBounded 对 spec/plan 生效（header = 表中最新且必在行内）· 回归测试`
- `next: 渲染 = 完整可执行命令：三命令动词 × 全 type next 字面二次 parse 零错误（done 终词不喂 parse · implement 声明表补 --type 默认 wave + render 含 --plan 后可达）· 干 run E2E 直接派发 · 消费面技能文本同步（I2/I1/I3 + emit）· routeWords 词面同步`
- `全树合规（规则断言 · 基线 53 文档）：49 非 overall 建/补 Change history · 12 无匹配形（10 真无头建档 + 2 bold 归一行 · 表行源自拆链）· 4 拆链 · 25 非严格形清零（含 3 旧 overall · 机械扫有头非严格 27 = 25 + 2 bold 口径自洽）· `前置 v`/补充说明在 `**Version**` 头行零残留（表行豁免）· 实施期机械清点复核一致 · validate 零 drift`
- `历史正文内容保真（迁移只动容器 · 版本摘要逐字入行 + 机 pin 无损断言——扫描面 = 迁移前头部文本 vs 迁移后表行并集零漏，含补充说明内嵌版本序列按 `· vX.Y` 切行）· 零 retro-rename`
- `技能 author→commit→review 顺序落地（三技能文本 + digraph/节点同步）· emit 新鲜 · engine vitest 全绿 · validate ALL PASS`

## Constraints

- **零新 CLI 子命令**：clean-tree 门与 next 可执行化只动现有 implement/review/fix 的前置校验与渲染（charter Non-goal #1 保持；发现型 schema 面不扩）
- **TDD colocated**：引擎改动先测后写（src-next 各模块 `__tests__` 同址）
- **一声明四派生**：schema/pattern 改动只改元素登记表（contract/declare.ts），派生 schema/slices/描述面全投影，字节 pin 更新随动
- **历史正文零 retro-rename**：迁移只改容器（Version 头 / Change history 表），历史内容逐字保真 + 机 pin；CHANGELOG 记录与版本行改名记录为历史清单（含表行豁免面）
- **English-primary 消费面**：SKILL.md 调整英文写作；内部 specs/plans 中文（Strategy B）
- **变更集义务**：engine fix + kairos docs 各一 changeset，独立提交

## Change history

| Version | date | summary | author |
|---|---|---|---|
| v1.0 | 2026-10-09 | 初版——P4.1 注册（overall v1.47）后开写：lifecycle 前置校验统一（全动词 clean-tree 硬门入 pre-flight seam）· schema 三类型同构（Version required · 头仅号+时间 · Change history required ×3 · selfBounded ×3）· 全树迁移 · 技能 author→commit→review 调整 | [human] · Claude Opus 5（kairos:cdd-design → cdd-spec-writer） |
| v1.1 | 2026-10-09 | **spec-review-1 全修（1 blocker · 3 warn · 2 nit）+ find #3 补充**：全树清点基线修正（53 文档 · 4 overall · 49 补表 · 12 无头 · 4 携链 · 25 非严格形）——迁移改为规则断言 + 实施期机械复核（静态数字易腐）· 携链清单 5→4（overall 已拆）· 保真转录与零残留共处定案（grep 面 = Version 头行 · 表行豁免）· seam 钉死 Lifecycle 单入口 · evidence/读回门归属声明（child 面）· EOF newline；**新组 5：next 可执行命令字面量**（反转 v1.39 语义字面——实证 agent 映射试错反超 token · 组合点从命令声明表派生 · 零映射层兑现 · 二次 parse 回归） | [human] · Claude Opus 5（kairos:cdd-design → cdd-spec-writer） |
| v1.2 | 2026-10-09 | **spec-review-2 全修（3 warn · 2 nit）**：① implement 声明表补 `--type`（默认 wave）+ render 必含 `--plan`（required）——§5.2 字面置正（`cdd implement --type wave --plan <path> --tasks 17`）· §5.3 组合点改述（implement type 域 = 本 phase 补实现，原「已声明」不实）· §5.5/验收二次 parse 断言面可达（原字面 parse 必拒）② 12 无匹配形口径三处统一（Design/§3.4/验收：10 真无头 · 2 bold 归一——2 bold 有头非建档、表行源自拆链）+ 非严格形定义句（= 有头且非严格、不含 bold · 机械复核 27 = 25 + 2 口径自洽）③ 保真转录扩展至非 telescope 补充说明（`· vX.Y` token 全量切行 · 机 pin 扫描面 = 迁移前头部文本 vs 迁移后表行并集零漏）+ 3 旧 overall 补日期 = 其 Change history 末行日期（零虚构）④ 四动词 = routeWords 四词（三命令动词 + done 终词 · 二次 parse 断言面三命令动词、done 不喂 parse）⑤ 顶部声明全树基线较 overall v1.47 注册修正（5→4 拆链 · 47→49 补表 · 12 无匹配形） | [human] · Claude Opus 5（kairos:cdd-design → cdd-spec-writer） |
