---
title: 'P38 · 派发输入契约：必填表、`none` 表示法与 `dispatch-input` 门'
doc-type: phase-spec
version: v0.14
date: 2026-11-17
slug: 2026-11-17-engine-doc-tooling-p38-design
program: 2026-10-10-engine-doc-tooling
author: 'Oscaner M. · Claude（kairos:cdd-spec-writer · 2026-11-17）'
---

## Design

本相位让「一个 mode 在缺输入的情况下仍然渲染成功」不可能再发生。它关闭的形态（本相位自己已从树上移除）是：空值 token 被装配器悄悄消化成「没有这一行」，而 shell↔layout 一致性只校验「shell 正文点名的 token 被 layout 携带」——两者的交点恰好是**名字被携带、值与存在性从不被问**。本相位把这两半都改由声明说出：空值只剩三种去处（按声明丢行 · 按声明渲染裸词 `none` · 门红 `empty-value`），shell↔layout 一致性升为**构造期判据**——`TemplateAssembler#assertDeclarations`（`render/templates.ts`）在装配器构造时一次性判完，判不过就建不起来。于是 overall 面的 `INPUT_SPEC` 自指示不再能恒绿（P33 的原始样本），fix 轮也不再能拿到一个不存在的 `INPUT_RULINGS` 路径而在孩子运行时才撞墙。

交付面分三块，一块判据、一块表示法、一块纪律：每格声明它「缺了成不成立」，每格声明缺席长什么样，每轮声明临时脚本该去哪里。三块共用一个前提——**判据必须在派发之前、在同一个返回值上判**。

### 1. 声明的两个维度

#### 1.1 载体与真值表

layout 行升格为对象，声明与它管的那一行同处一地：

```
ContextLine = {
  line: string,                                  // 含 {{TOKEN}} 槽的渲染行
  absent: "drop" | "none",                       // 不成立以外的那些 type，缺席长什么样
  path?: true,                                   // 读入路径格：存在性判据只读这一位（§1.3 · §2.1）
  preview?: "value" | "satisfied",               // 预览答案的来源（§2.4 · 缺省 value）
  requiredOn: RequiredArm | RequiredArm[],       // 一格一条臂，或几条并列臂（任一条命中即 exigible）
}

RequiredArm = {
  types: "always" | TargetType[],                // 该 row 服务的全部 type，或其中一个子集（[] = 一个也不）
  when?: "program" | "identity",                 // 同一条臂上再叠一条结构前提（§1.3）
}

ModePromptRow = {
  mode: WorkMode,                                // implement / review / fix / docs-fix
  serves: TargetType[],                          // 该 row 真正渲染的 type 集：死格判据的比对基准（§1.3）
  roundContext: ContextLine[],                   // 该 mode 的 round context，逐行声明
}
```

`serves` 是每 row 一条的**服务集**，也就是 §1.3 死格判据的比对基准：`implement` → `[wave]` · `review` → 六种（`phase-spec` · `single-spec` · `plan` · `branch` · `wave` · `overall`）· `fix` → `[wave, branch]` · `docs-fix` → 四个文档面（`phase-spec` · `single-spec` · `plan` · `overall`）。判据读这一列、**不读该行的臂**——把服务集算成臂的并集，判据就成了同一份声明的重述，永远不可能红。

requiredOn 只有一种形态：一条臂是「`types`，可能再叠 `when`」，一格可以挂多条，**同一格的多条臂是并列（取并集，不是合取）**——每条各自判，任一条命中即 exigible；读成「每条都要命中」的合取，`review` / `docs-fix` 的 `INPUT_OVERALL` 那格就永不可 exigible（两臂的 `types` 集互斥：`[overall]` 与 `[phase-spec, plan, branch, wave]`），反转 ① 随之失效。章程的 D94 行与 Phase inventory 的 P38 行详情格仍写着「几条合取臂」（章程与 `render/templates.ts` 的两处 docblock 同病），更正登记在 §6 第十二项（章程侧 `v4.11`），不在本轮静默改字节。这不是语法糖：`review` 的 `INPUT_OVERALL` 同时需要一条无前提的 `overall` 臂（overall 面判的就是它）与一条 `{ types: [phase-spec, plan, branch, wave], when: "program" }` 臂（其余面只在身份文档声明了 `program:` 时才 exigible），而旧稿的四种形态（`never` · `always` · `TargetType[]` · `{types, when}`）每种只装得下一条臂，这种格就写不出来。

§1.4 的表里是规范形态的简写，一一对应：`always` = `{ types: "always" }` · `[wave]` = `{ types: ["wave"] }` · `never` = `{ types: [] }`（一个 type 也不命名，因此不触 §1.3 的死格判据）；一格两条臂以 ` · ` 并列。

`overall` 臂为什么不带 `when`：`OverallDocType#chainRoot`（`contract/doc.ts`）恒交 `programLink: null`——章程没有、也不该有自己的 `program:` 链接，判它不是「父章程一致性」而是「它就是判对象本身」。因此两条结构前提（`program:` 那一臂与 `identity` 那一臂）都只出现在非 overall 的臂上。

**路径格由声明说出，不由名字拼出**：`path: true` 标记「值命名一个必须存在的文件」的读入格（`INPUT_WAVE_BRIEF` · `INPUT_PLAN` · `INPUT_SPEC` · `INPUT_OVERALL` · `INPUT_REVIEWS` · `INPUT_RULINGS`），`target-absent` 只读这一位。`BASE_BRANCH` 是分支名、`ROLE` · `TARGET_TYPE` · `WAVE` · `WORKSPACE_*` 不是路径、`OUTPUT_*` 是**本轮才创建**的写路径（存在性不可判，§1.4 末段）——按 INPUT_ 前缀推「这是不是路径」，等于把第二个声明藏进拼写，而本相位只有一处声明。

结构前提不新开一维：它答的仍是同一个问题（「哪些 type 缺了它不成立」），只是把答案再限定在一条**结构事实**上——`when: "program"` 限定在「身份文档声明了 `program:`」的那些轮次，`when: "identity"` 限定在「身份文档声明了形状（`doc-type:`）」的那些轮次。两条都**不**读 `#valuesOf` 取该值时用的那个已解析值：exigibility 判的是**声明**——身份文档 front-matter 里那个 `program:` 字面量（`DocEntry.program`，`infra/slug-index.ts`：null 当且仅当这份文档没有声明）与那个 `doc-type:` 形状（`DocEntry.docType`，同一份解析头），`scene.overallLink` 与 `scene.specLink` 只**供值**。`program:` 那一条在断链的轮次上分岔（声明非空、解析值为 `null`），只读后者就会把真断裂读成合法缺席（§1.3 两臂）；`identity` 那一条同理：`scene.specLink` 为 `null` 既可能是「没有身份文档」也可能是「文档读不出形状」——前者由文档契约腿的 `spec-absent` 孤儿先拒（那一轮不发生派发），后者才是本门看到的不 exigible 形态，而声明写的是后者（§1.3 抖动面）。三个候选名字为什么只有一个能答「声明了没有」，写在 §2.1。

**预览答案也是声明的一格**：`preview` 只答「`--dry-run` 拿什么答这一格」，取值两种——`value`（缺省）读同一帧的值、`path: true` 照常问存在性；`satisfied` 只用于「值在预览期还不存在、而它的名字已由命名行写出」的格，含义两条：命名行点名 ⇒ 预览视为满足；未点名 ⇒ 落回 requiredOn 的空值臂 ⇒ `empty-value`。它不做存在性读、也不写盘。**唯一取 `satisfied` 的格是 `INPUT_WAVE_BRIEF`**（§1.4 三行标记）：`renderBrief` 只在真派发落盘（§2.4），预览若没有这一位，就只能在「照 `path: true` 问一个自己不会写下的文件」与「在门里硬编一格例外」之间选一个。

`TemplatePrompt` 的每个 `ModePromptRow.roundContext` 从 `readonly string[]` 变为 `readonly ContextLine[]`；非槽行（`## Round context` 标题、空行）用 `never`（= `{ types: [] }`）+ `absent: "drop"` 表达，它们没有值可比；`preview: satisfied` 的唯一性不是一句散文：装配器构造期的一次断言（`TemplateAssembler#assertEngineWritten`，`render/templates.ts`）把任何第二个 `satisfied` 格拦在建类之前。

四种状态全覆盖：

| 值 | type 关系 | 后果 |
|---|---|---|
| 非空 | — | 渲染该值；路径格另要求它存在 |
| 空 | ∈ requiredOn | **门红** `empty-value` |
| 空 | ∉ requiredOn · `absent: drop` | 整行消失 |
| 空 | ∉ requiredOn · `absent: none` | 渲染裸词 `none` |

requiredOn 必须是**按 target type 收窄的集合**，因为每个 mode 只有一份 layout，而一份 layout 服务的 `TargetType` 不止一个：`review` 的 `serves` 是六种（`phase-spec` · `single-spec` · `plan` · `branch` · `wave` · `overall`），`fix` 的 `serves` 只两种（`branch` · `wave`）——两处都不是另行断言的事实，取值就是 §1.1 围栏块里 `serves` 那一列——四个文档面（`phase-spec` · `single-spec` · `plan` · `overall`）上的 fix 轮由 `#roleOf`（`face/lifecycle.ts`）经 `TargetFaceTable.isDocShape` 判成 `docs-fix`，骑的是 `docs-fix` 的 layout（§1.4）。「六种」是 `fix` 动词接受的 `--type` 词集，不是它那一行的 ROLE 集——两者不同，声明只能按后者写。把必填性表达成「行上的 type 集合」而非「每 type 一份 layout」，理由是条件而非计数：**每个 mode 一份 layout、必填性落在行上**；每 type 一份会让唯一的差别（这一轮缺了它成不成立）被复制成 N 份 layout 逐份维护。

#### 1.2 每个字段只回答一个问题

requiredOn 回答「哪些 type 缺了它这一轮不成立」；absent 回答「其余那些 type，缺席是丢行还是写一个字」；path 回答「这个值是不是一个必须存在的路径」；preview 回答「`--dry-run` 拿什么答这一格」。absent **不**表达「这一行渲不渲染」——值非空时它一律渲染，两者的分工由 1.1 的真值表定义。

两个字段正交，不是冗余：`never` 且需要丢行的格将来完全可能出现，而 absent 恰好能表达它。preview 同理：它只换预览的答案来源，不动 exigibility、不动 absent、也不动 path 位——一个格可以同时是路径格与 `satisfied`（`INPUT_WAVE_BRIEF` 就是），因为这两个字段答的是两侧（真派发 / 预览）。

#### 1.3 死格、惰性列与结构前提

- **死格判据**：requiredOn 命名了一个该 row **从不服务**的 target type ⇒ 声明期红（构造期断言，不是运行期告警）。「服务」= 该 row 的 `serves` 声明（§1.1 围栏块）：判据读那一列，不从臂的并集推——从臂推出来的服务集与臂本身同源，判据就成了永远绿的重述。这是唯一的死格：它声明的是一个永远不会被问到的状态。本表自己的 `fix` 行初稿就长这个样子——它按 `fix` 动词的六词 `--type` 集声明，而那四个文档面由 `docs-fix` 行渲染，于是这四格永不被问到。判据一审自表即红，故 §1.4 的 `fix` 行只留它真正服务的两个 type；修表不是放宽判据。
- **惰性列不是死格**：`requiredOn: "always"` 让 `absent` 列在该行上失效——空值恒红，「不成立时缺席长什么样」再也不会被问到；`absent: "none"` 在 requiredOn 覆盖全部服务 type 时是同一类惰性。两者都是**合法声明**（`OUTPUT_*` · `WORKSPACE_*` 与 `implement` 的 `WAVE` 就落在这一格），写出来是为了让「这一行的缺席没有第二种形态」可读，不构成缺陷。
- **结构前提**：`INPUT_OVERALL` 的 exigibility 由结构决定，不由用户选择——`overall` 面它就是判对象（恒 exigible）；其余面**当且仅当**身份文档声明了 `program:` 才 exigible。判的是**声明**（身份文档的 `program:` 字面量，`DocEntry.program`），不是 `#valuesOf` 取值用的那个已解析路径（`scene.overallLink`）：断链时前者非空、后者为 `null`，同源就会把断裂读成缺席。也**不**读 `ChainRoot.programLink`——那是由声明派生的链接，而 `SingleSpecDocType` · `PlanDocType` · `OverallDocType` 的 chainRoot 按设计把它恒交 `null`，读它答不了「声明了没有」（§2.1 三名分工）。因此两臂必须分开读：`program:` **声明了却解析不到章程** ⇒ 硬红 `target-absent`（真断裂，§2.3 反转 ①），该格指向的文档存在性由 P36 的矩阵面 `DocFs` 读回答；**同 slug 身份文档没有 `program:`** ⇒ 该格不存在、行消失（P37 T4 的 ② 臂就是这一臂）。后一半不是一道运行期检查，而是一处**类型声明**：`single-spec` 的 front-matter 键集（`SINGLE_SPEC_ELEMENTS`，`contract/declare.ts`：title · doc-type · version · date · slug · author · issues，七键、`slug` 必填）里**没有 `program` 锚**——该 type 的面本就不该带这一格，它因此也不在 §1.4 `when: program` 的 type 集里。门只读**声明的字面量**（`DocEntry.program`），不读「该 type 保证了什么」；两处分开写清楚，才不会让「这个面没有这一格」与「有这一格而没值」混成一个判据。
- **合法缺席不是 optional**：`overall` 面的 `INPUT_SPEC` 不是一个「可选格」，是**没有这一格**（章程不是自己的 spec，C2）。这个区别必须在声明里可读——不写该行的 requiredOn 集合，而不是靠 `absent: none` 软化。
- **requiredOn 的抖动面**：`INPUT_SPEC` 不来自任何声明的标量——它跟着**同 slug 身份文档**走（`face/cli.ts` 由 `identityPath` 推 `specLink`），front-matter 头本就没有 `spec` 键（`contract/frontmatter.ts` 只暴露 `program` · `parent-version` · `base` · `issues`）。可声明的因此只能是**结构前提**而非标量值：`when: "identity"` 判的是同一份 entry 的**声明形状**（`DocEntry.docType` 非 null——索引登记了这份文档、且它写了 `doc-type:`），而 `phase-spec` · `single-spec` 两个文档面不叠前提（那里被判的文档**就是**身份文档本身）。两种形态因此都留给上游、不由本门红。**① 没有同 slug 身份文档**（entry 为 null）：在代码面上它不是 `undeclared`——argv 面（`PlanSource#readPath`，`infra/plan-source.ts`）从不交 `undeclared`，而缺身份文档的计划经 `PlanSource#lookupOf` 落到 `spec-absent` 孤儿，`PlanRead#refusal` 正是拒它的那一位（「the slug names no identity document (index clean miss)」），因此这一轮到不了 prompt 装配、该格从不被问。能说的因此只有**结果**：没有派发，就没有被判的载体；登记归文档契约腿，本门不另立一条臂，也**不要**把它读成一条「合法前向缺口」——那条腿在 `undeclared` · `clean` 上是零拒绝的，而缺文档不是那个状态。**② 文档在、但读不出形状**（写了 `slug:` 而没写 `doc-type:`）：这一候选被同一次扫描记成 `unregistered` 丢弃，于是文档根变脏、`PlanRead` 停在 `undecided` 读上，那条腿同样零拒绝（可见事实是 `PlanRead#warnLine` 的 `CDD_WARN:` 脏根诊断），而 `DocEntry.docType` 与 `scene.specLink` 同为 null ⇒ 不 exigible、行消失、派发字节不变（P37 T4 的 ④ 臂钉的就是它）。**② 与 `undecided` 是同一个读，不是两条臂**——把根弄脏的那份文档正是读不出形状的那一个，因此这一格只有**两**种非 exigible 形态（没有文档 · 读不出形状），不是三种；本门只读身份文档交出的那一格，不重复文档契约腿的登记（§2.3 的 `INPUT_SPEC` 行）。修法是**补身份文档**（或撤掉身份面），不是绕过门。exigible 的那半边由**同一次 doc 域读**供值（`scene.specLink` 就是那次读的路径）——判 exigibility 的事实与供值的那次读出自同一份 entry，那次读不答即 `empty-value`（引擎应给而没给），不是对合法缺口的反转。

#### 1.4 表本体

requiredOn 按「这一轮缺了它还能不能判」推出，不按「今天恰好取了什么值」。absent 除 `INPUT_RULINGS` 外一律 `drop`。行序与各 mode 的 layout 同序，便于逐行对账：

| row | 格 | path | absent | requiredOn | 依据 |
|---|---|---|---|---|---|
| implement | `ROLE` | — | drop | always | 身份恒有值；`always` 使 `absent` 列惰性（§1.3） |
| implement | `WAVE` | — | drop | always | implement 只服务 wave 面（`--tasks` 必给） |
| implement | `INPUT_WAVE_BRIEF` | ✓ | drop | always | brief 是 implement 唯一的计划面（完整镜像）；`preview: satisfied`（§2.4） |
| review | `ROLE` | — | drop | always | 恒有值；`always` 使 `absent` 列惰性 |
| review | `TARGET_TYPE` | — | drop | always | P33 的判别符：没有「无类型的评审」 |
| review | `WAVE` | — | drop | [wave] | 只有 wave 评审带 wave id |
| review | `INPUT_WAVE_BRIEF` | ✓ | drop | [wave] | 只有 wave 评审判的是 brief；`preview: satisfied`（§2.4） |
| review | `INPUT_PLAN` | ✓ | drop | [plan, branch] | plan 面判它；branch 面是计划一致性参照 |
| review | `INPUT_SPEC` | ✓ | drop | [phase-spec, single-spec] · `{types: [plan, branch, wave], when: identity}` | 每个面都要验「代码/计划是否兑现设计」；三个代码面按同 slug 身份文档是否声明了形状（§1.3 抖动面） |
| review | `INPUT_OVERALL` | ✓ | drop | `{types: [overall]}` · `{types: [phase-spec, plan, branch, wave], when: program}` | overall 面判它（无前提，§1.1）；其余面是父章程一致性，由 `program:` 声明决定（§1.3） |
| review | `BASE_BRANCH` | — | drop | [branch, wave] | 树评审的比对基准（分支名，不是路径格） |
| fix | `ROLE` | — | drop | always | 恒有值 |
| fix | `TARGET_TYPE` | — | drop | always | 判别符区分 `branch` 面与 `wave` 面 |
| fix | `WAVE` | — | drop | [wave] | wave 的 fix 才带 wave id |
| fix | `INPUT_WAVE_BRIEF` | ✓ | drop | [wave] | wave 的 fix 靠 brief；`preview: satisfied`（§2.4） |
| fix | `INPUT_PLAN` | ✓ | drop | [branch] | wave 面已由 brief 整份承载，再给 `INPUT_PLAN` 是同一事实的第二份 |
| fix | `INPUT_SPEC` | ✓ | drop | `{types: [branch, wave], when: identity}` | 两个面都要验「代码/计划是否兑现设计」；身份文档读不出形状时该格不 exigible（§1.3 抖动面）；四个文档面不在此行（见本节末段） |
| fix | `INPUT_OVERALL` | ✓ | drop | `{types: [branch, wave], when: program}` | 父章程一致性，由同 slug 身份文档的 `program:` 声明决定（§1.3） |
| fix | `INPUT_REVIEWS` | ✓ | drop | always | 没有评审输入的 fix 轮不成立 |
| fix | `INPUT_RULINGS` | ✓ | **none** | never | 可以真没有，且这一事实值得写在 prompt 上 |
| docs-fix | `ROLE` | — | drop | always | 恒有值 |
| docs-fix | `TARGET_TYPE` | — | drop | always | 判别符区分被修的文档面 |
| docs-fix | `WAVE` | — | drop | never | docs-fix 服务的 type 里没有 `wave`，该行永不成立——声明它，不是漏掉它 |
| docs-fix | `INPUT_PLAN` | ✓ | drop | [plan] | 只有 plan 文档是判对象；branch 不是文档修复面 |
| docs-fix | `INPUT_SPEC` | ✓ | drop | [phase-spec, single-spec] · `{types: [plan], when: identity}` | plan 面 = 设计参考（按身份文档的形状 exigible）；两个 spec 面 = judged；overall 面没有这一格 |
| docs-fix | `INPUT_OVERALL` | ✓ | drop | `{types: [overall]}` · `{types: [phase-spec, plan], when: program}` | overall 面 = judged 本身；其余面由 `program:` 结构决定（`single-spec` 面没有这一格，§1.3） |
| docs-fix | `INPUT_REVIEWS` | ✓ | drop | always | 同 fix |
| docs-fix | `INPUT_RULINGS` | ✓ | **none** | never | 同 fix |

`path` 列的 `✓` 就是声明对象的 `path: true`；两条臂以 ` · ` 并列，等价于 RequiredArm[] 的两个并列元素——任一条命中即 exigible，不是两臂俱中（§1.1）。表里只列每 row 的格——**每 row 的服务集不在表内重复**，它由 §1.1 的 `ModePromptRow.serves` 声明一次，§1.3 的死格判据读那里。`preview` 列不进表：缺省为 `value`（读同一帧的值、路径格照常问存在性），表里唯一取 `satisfied` 的是 `INPUT_WAVE_BRIEF` 三行，写在各自的「依据」列——它不是第二份声明，而是同一行的第二个字段（§1.1 · §2.4）。

`OUTPUT_*` 与 `WORKSPACE_*` 格不参与本维度：写出路径**本轮才创建**（存在性不可判），work-mode 事实由引擎计算（永不缺席）。它们的 requiredOn 恒为 `always`、absent 恒为 `drop`——`always` 使 `absent` 列在它们上面惰性（§1.3），判决只落在读入路径格上。**这一段就是它们的声明**：§4.2 的穷尽性断言把本段算作这些格的覆盖。

**`fix` 行的 ROLE 是两个 type，而 `fix` 动词的 `--type` 词集是六个词**：`cdd fix --type phase-spec` · `--type single-spec` · `--type plan` · `--type overall` 渲染的不是这一行——`#roleOf`（`face/lifecycle.ts`）把文档面上的 fix 相位判成 `docs-fix`，那些轮次骑 `docs-fix` 行与 `DOCS_FIX_SHELL`（`render/templates.ts`），`cdd fix --type overall` 的 prompt 因此带「- `INPUT_OVERALL`: <the charter>」行、不带「- `INPUT_SPEC`」行，`face/__tests__/cli.test.ts` 的 P33 T2 ② 臂钉的就是这两格。它**不**钉 `ROLE`：`ROLE: docs-fix` 这一字节只在同一 suite 的 `--type plan` 臂上被点名（该臂同句断言 `TARGET_TYPE: plan`），而 `--type overall` 轮的 ROLE 由同一条 `#roleOf` → `TargetFaceTable.isDocShape` 路径给出、没有独立 pin。表里若给 `fix` 行声明那四个 type，描述的就是一个该行永远不会被问到的状态，即 §1.3 的死格。**按 ROLE 写，不按动词词集写。**

### 2. `dispatch-input` 门

#### 2.1 纯读形态与门序

门是一个**纯读**：输出是拒绝串或 null，输入是三项——缺任一项就有格答不了：

- **值**：本轮即将渲染的那份 `TemplateValues`（`#valuesOf` 的 `INPUT_OVERALL` 臂读 `scene.overallLink`）。
- **声明**：身份文档**解析头里的两处声明**——`program:` 的那个词（`DocEntry.program`，`infra/slug-index.ts`：null 当且仅当这份文档没有写 `program:`）与 `doc-type:` 的那个形状（`DocEntry.docType`：null 当且仅当这份文档没有声明形状）。两者都是**声明的字面量**，场景装配把它们作为格交出（与 `specLink` · `overallLink` 并列，承载解析头本身），`#sceneOf`（`face/cli.ts`）从文档域读到它们：`when: program` 读 `program` 那一格，`when: identity` 读 `docType` 那一格。它们既不是一次新读、也不是已解析值：门在派发期不解析任何文档，只读这两格。**三个候选名字只有一个能答「声明了没有」**：`DocEntry.program` 是那个字面量（本门的唯一来源）；`ChainRoot.programLink`（`contract/doc.ts`）是它派生的链接，而 `SingleSpecDocType` · `PlanDocType` · `OverallDocType` 的 chainRoot 按设计**恒交 `null`**，于是它在单 spec / 计划 / 章程面上与「没声明」不可分辨；`scene.overallLink` 是**已解析**值，断链与未声明在它上面同样塌成 `null`。因此声明读 `DocEntry.program`、值读 `scene.overallLink`，两者在断链的轮次上分岔（前者非空、后者为 `null`），只读后者会把「声明了而解析不到」读成「没声明」（§1.3 两臂）；`when: identity` 走同一分工：声明读 `DocEntry.docType`、值读 `scene.specLink`。
- **存在性**：目标路径在不在——由 P36 的矩阵面 `DocFs` 读（`contract/invariants.ts`）回答，是 `target-absent` 的唯一来源；它只对 §1.1 声明了 `path: true` 的格发问。

它挂在既有 `artifactRefusal` 的同一形状旁边——`face/lifecycle.ts` 已有先例（`artifactRefusal(frame)` 供 `--dry-run` 读，`#artifactRefusalOf(cell)` 供真派发拒，两者是同一判定的两个消费者）。

位置在 **artifact 门之前**：它判「这一轮能不能成立」（读的路径在不在），artifact 门判「输入的质量」（sidecar 合规否）。前者更基本，且不读文件内容。

被拒 ⇒ child 零 spawn · **不占轮次** · 不留 in-flight 记录（与 `artifact-identity` 拒绝同处理）。

#### 2.2 报文与原因闭集

报文复用既有 `Words` 机制（`face/words.ts`），不新开第二条消费面。**一行** `CDD_BLOCKED:`（`#blocked`，`face/lifecycle.ts`——引擎唯一的阻断通道），reason 里逐格列出**全部**违规格：段间以 `; ` 连接，每段拼成 `row · TOKEN · reason`，` · ` 是段内分隔符：

```
CDD_BLOCKED: dispatch-input · <row> · <TOKEN> · <reason>; <row> · <TOKEN> · <reason>
```

`CDD_BLOCKED: ` 前缀只出现一次，由 `#blocked` 加，门自己的返回值不带前缀也不带换行——`--dry-run` 消费者与真派发读到的正是这一条串（§2.4）。一格一段、不折行：折行会让第二个违规看起来像两条独立阻断。

`reason` 是闭集两条：`empty-value`（值被要求而为空——引擎没交，或该值所依据的产物从未写下，例如无 `base.json` 时的 `BASE_BRANCH`，§2.3 反转 ④）· `target-absent`（该格指向的文档路径不存在，或结构前提（§1.3）声明了 `program:` 而章程解析不到）。

「声明要求该格而 layout 未携带」不在这份闭集里，且在派发期**不可表示**：声明骑在它管的那一行上（§1.1），没有行就没有声明。这个状态由**构造期判据**兜住——`TemplateAssembler#assertDeclarations`（`render/templates.ts`，构造一次即判、不是每次渲染重跑）里那条 shell↔layout 检查红了，装配器根本建不起来，谈不上派发。章程里的「必填行缺失」因此归那条构造期判据，不归本门。

「一次报全部」与 P37 的 `grading-impact-missing` **理由同源、形状不同**：那条的段是 findings（`#gradingRefusal` 把每个违规写成一个 `id "summary"`），这条的段是声明格（`row · TOKEN · reason`）；共用的是「一次全报 + `; ` 连接 + 单前缀」的机制，不是段内字节。理由相同：一次派发被拒，编排器要一轮修完；只报第一条会让「修一格、再撞下一格」重复 N 轮。

#### 2.3 空值清单（今日合法的空缺，哪些被判成红）

这张表不是「三处反转」的枚举，而是一道**可重走的账**：把 §1.4 的每一格对照 `#valuesOf`（`face/lifecycle.ts`）今天真会交空串的那些臂，逐格问三件事——① 这个空值在哪个 type 上可达？② 那个 type 落在该格的 requiredOn 里吗？③ 落在时，今天这一轮是不是照样能派发？三个都「是」就是一次行为反转，必须在本清单里点名并给出判法；否则该格归「不变」，并写明是哪一条使它不变（不可达 / 未被要求 / 上游先拒 / 该格没有可判的载体）。下一个改动的人重走这三问就能复核这份清单，不必重新发明判据。

| 格 | 今日合法的空值形态 | 本相位的判法 |
|---|---|---|
| `ROLE` · `TARGET_TYPE` | 永不为空（`#roleOf` 恒交一个 role；`TARGET_TYPE` 除 implement 外恒有值） | 不变 |
| `WAVE` | 非 wave 面上为空 | 不变（那些 type 不在 requiredOn 里） |
| `INPUT_WAVE_BRIEF` | 非 wave 面上为空；`--dry-run` 预览上为空（`scene.briefPath` 只在真派发时赋值，`renderBrief` 在预览里被跳过） | 非 wave 面不变；预览面按该格的 `preview: satisfied` 声明（§1.1 · §1.4）答——命名行**点名即视为满足**（`RoundNaming#briefName`），未点名则落回 requiredOn 的空值臂 `empty-value`；既不是存在性读、也不是写（§2.4） |
| `INPUT_PLAN` | plan 读未就绪时为空 | 不变（不可达：计划载体腿 `doc-contract` 先拒，§1.3） |
| `INPUT_SPEC` | 同 slug 身份文档缺席时为空（`scene.specLink === null`）；文档根丢弃候选（`PlanRead` 的 `undecided` 读）时同样为空 | 不变（该格的 exigibility 是结构前提 `when: identity`，§1.4），两种空形态都没可判的载体——① 没有同 slug 身份文档 ⇒ 那是 `spec-absent` 孤儿，文档契约腿的 `PlanRead#refusal` **先拒**（该轮根本不派发，因此该格不被问；它不是 `undeclared` · `clean` 上的合法缺口）；② 文档在、但读不出形状（声明 `slug:` 而无 `doc-type:`，P37 T4 的 ④ 臂）⇒ 这一候选正是把文档根弄脏的 `unregistered` 丢弃，`PlanRead` 因此停在 `undecided`（该腿零拒绝、只出 `PlanRead#warnLine` 的 `CDD_WARN:` 脏根诊断），`DocEntry.docType` 与 `scene.specLink` 同为 null，不 exigible、行消失。**② 与 `undecided` 是同一个读，不是两条**。exigible 那半边（形状声明了）由同一次 doc 域读供值，读不答即 `empty-value`（引擎应给而没给，不是合法缺口） |
| `INPUT_OVERALL` | 声明了 `program:` 而章程解析不到；`single-spec` 面没有这一格 | **反转 ①**：`target-absent`；`single-spec` 面不变（该 type 的 front-matter 声明里没有 `program` 锚，这一格不在它的 requiredOn 里，§1.3） |
| `BASE_BRANCH` | 无 `base.json` 时为空（`#baseBranchOf` 交空串，今天静默降级为「评审现场树」） | **反转 ④**：`empty-value`，恢复动作是 `cdd base set` |
| `INPUT_REVIEWS` | ① 本 cycle 记录了评审却解析不到载体（`#reviewsPath` 交 `null`，今天记成可见 skip）；② 家族名只拼不查存在（`#reviewFamilyPath`）⇒ 名字非空、文件不在 | **反转 ②**：`always` 管空值半边（`empty-value`），路径格的 `target-absent` 管文件不在半边 |
| `INPUT_RULINGS` | 无 sidecar 时为空 | **反转 ③**：渲染裸词 `none` |
| `OUTPUT_*` · `WORKSPACE_*` | 永不为空（本轮才创建 / 引擎计算） | 不变 |

四处反转的今日/之后对照：

| # | 今日 | 之后 |
|---|---|---|
| 1 | 身份文档声明了 `program:` 而章程解析不到 ⇒ `scene.overallLink` 为 `null`、行静静消失 | `CDD_BLOCKED: dispatch-input · <row> · INPUT_OVERALL · target-absent` |
| 2 | fix 轮拿不到 review 载体（`resolveHandoffPath` 只拼名不查存在）⇒ 静默 | `INPUT_REVIEWS` 空值 ⇒ `empty-value`；拼出的路径不在盘上 ⇒ `target-absent`。恢复动作归编排器：重派那一轮评审让载体重现，或给 `--reviews` 一个在仓库根下真实存在的路径——**fix 轮造不出自己的输入** |
| 3 | `INPUT_RULINGS` 缺席 ⇒ 行消失 | 渲染裸词 `none` |
| 4 | 无 `base.json` 的树评审 ⇒ `BASE_BRANCH` 空、静默降级为「评审现场树」 | `CDD_BLOCKED: dispatch-input · <row> · BASE_BRANCH · empty-value`（恢复动作 `cdd base set`） |

**守恒条款按清单读**：除本清单点名的四处反转与 §3.3 / §5.1 两句 shell 新文本（`$version` 递增）外，任何一轮的 dispatch prompt 逐字节不变。清单之外的格一律不变，理由逐格写在表里；「其余惰性」是这张清单的**补集**，不再是一句绝对断言——一句「其余都是惰性的」立在一张会把好几格移到 `empty-value` 的表旁边是读不通的。

反转 ① 只管「**声明了**却解析不到」，且它只属于 `program:` 那一臂：门读身份文档的声明（`DocEntry.program` 那个字面量）、不读 `scene.overallLink` 那个已解析值，所以断链不会再被读成缺席（§1.3）。原稿里并排的 `spec:` 一半已撤：`INPUT_SPEC` 没有可声明的标量，它的臂是 `when: identity`（同 slug 身份文档是否声明了形状），缺身份文档由文档契约腿的 `spec-absent` 孤儿先拒（`PlanRead#refusal`），那一轮不派发，不是本门的臂。`single-spec` 面上没有 `INPUT_OVERALL` 这一格也不在反转之列——那是类型声明本身（该 type 的键集里没有 `program` 锚，§1.3），P37 T4 的 ② 臂因此保持绿。

反转 ② 的两半必须分开写：`always` 只答「值不能为空」，它看不见「拼出来的名字在盘上不存在」——`#reviewsPath` 在 cycle 无评审记录时回落到 `#reviewFamilyPath`，而那一层只拼名不查存在，所以只靠 `always` 这个洞仍然是开的。空值半边归 `always`（`empty-value`），存在半边归路径格的 `target-absent`（§1.1 的 `path` 位）；两条一起才闭合。

反转 ④ 与本相位同一句话：无基准的树评审判不了「这轮改了什么」，而今天它静默降级成「评审现场树」。它落在 `empty-value` 而不是 `target-absent`，因为 `BASE_BRANCH` 是分支名、不是路径格（§1.1）；已 `cdd base set` 的工作区不受影响（`base.json` 在册即绿），恢复动作归编排器。

#### 2.4 与 `--dry-run` 的同源

`--dry-run` 的门入口是 `face/cli.ts` 里 `harness.artifactRefusal(frame)` 那处，`dispatch-input` 挂在它旁边。判据可核的最低形态是**同一返回值的两个消费者**：pin 断言同一帧下 `--dry-run` 报的拒绝串与真派发 `CDD_BLOCKED` 的 reason 逐字节相同——只有一格例外，即下面写明的引擎合成格。

`--dry-run` 与真派发共用同一个帧，只有一格由引擎现造：`INPUT_WAVE_BRIEF`。真派发面由 `CliGate#renderBrief` 落盘后把路径写进场景；预览面**不写**（预览是纯读，§5.4），它拿的是这一格**声明出来的答案**——`preview: satisfied`（§1.1 声明一次、§1.4 记在该行），读的是同一行的命名 `RoundNaming#briefName`（`renderBrief` 落盘写的就是这个名字）。`satisfied` 的含义只有两条：命名行点名 ⇒ 该格在预览里视为满足；未点名 ⇒ 落回 requiredOn 的空值臂 ⇒ `empty-value`。它既不做存在性读、也不写盘——`path: true` 的读只发生在真派发那侧，那时文件已经落盘。

分歧必须写在明处：**命名行点名 ≠ 盘上已有**。`renderBrief` 只在真派发里落盘，所以这一格的预览答案不是一次存在性读——**命名行点名即视为满足**。同源的字面边界因此是：除引擎合成的这一格外，每一格的拒绝串与真派发逐字节相同；这一格由声明给出预览答案（点名 ⇒ 满足；未命名 ⇒ 落回 requiredOn 的空值臂 ⇒ `empty-value`），而不是让预览去问一个它自己不会写下的文件。反过来说，真派发在这一格上照旧走 `path: true` 的存在性读——它落盘了，所以它问得出答案。这一格是表里唯一取 `satisfied` 的格，`face/__tests__` 的那对 pin 因此把 wave 预览与 wave 真派发配在同一帧上：预览臂断言「命名 ⇒ 无拒绝」，真派发臂断言「落盘 ⇒ 通过、且存在性仍成立」。

`--dry-run` **不新增输出行**：把读格渲染出来会新增一条渲染面，而渲染面每多一处就多一处「预览与真派发各说各话」的机会。整段 prompt 的字节等价属 P39 的守恒面，不在此越界。

> **换向记录（2026-11-18 · P40）**：本节那条 per-mode 例外已由 P40 作废——`INPUT_WAVE_BRIEF` 在声明面上改记为引擎写的（`preview: "satisfied"` 退出），任何路径都不再做存在性读，于是预览与真派发在这一格上不再分歧，`#answeredByNaming` 与 `inputRefusal` 的 `mode` 参数一并退场。本节正文按交付时的字节保留（不改写历史），改向以本条为准；本节其余判据（门序 · 报文原因闭集 · 逐格成对 pin）不动。

### 3. `none` 的语义

#### 3.1 它是渲染字面量，不是值

`#valuesOf` 对可选格仍然交空串（诚实：没有就是没有），由装配器在 `absent: "none"` + 空值处渲染出裸词 `none`。若改为在 `#valuesOf` 编造 `none`，「引擎漏传」与「本轮确实没有」在值层面再次不可分辨——P33 的病原样复发。

裸词而非反引号：`none` 在这里是**值**，与旁边的路径值同格同形；加反引号会让它看起来像代码路径，而它恰恰表示「没有代码路径」。破折号不可判（人读得懂，门读不懂）。

#### 3.2 三态可分辨

- requiredOn 命中（结构前提成立）+ 空 ⇒ 门红（引擎漏传）
- 未命中 + 空 + `absent: none` ⇒ 渲染 `none`（本轮没有）
- 有值 ⇒ 渲染路径，且要求它存在

**残余风险（显式承认）**：`never` 格若「artifact 存在而引擎丢了路径」，仍会渲染 `none`——门看不见这个差别。pin 用成对两臂钉住两条路（有 sidecar ⇒ 路径 / 无 sidecar ⇒ `none`），这是本判据能给出的最强度。

#### 3.3 shell 里的半句

一句造出了新词汇却不告诉读者它是什么，等于把孩子推向猜；猜错的形态是 `read none` 失败后报一条**可预见的假缺陷**。因此 `FIX_SHELL` 与 `DOCS_FIX_SHELL`（`render/templates.ts`）的读入指令各补半句，措辞固定为：

```
`INPUT_RULINGS` is a path, or the literal `none` when this round has no ruling sidecar.
```

非目标相应挖洞为「shell 正文的**其余**指令，`scratch/` 与 `none` 这两句除外」。

### 4. pin 面

#### 4.1 逐格成对，不写全表快照

每个 requiredOn 命中的格播一个空值 ⇒ 门红且报文点名该格；每个 `absent: drop` 格播空值 ⇒ 该行消失、其余行不变；`INPUT_RULINGS` 空值 ⇒ 断言渲染出裸词 `none` 的**字节**。`preview: satisfied` 的格不靠播空值覆盖，而是按 §2.4 那对同帧 pin 断言两臂（预览：点名 ⇒ 无拒绝；真派发：落盘 ⇒ 通过）。

不写全表快照：快照在**未来正当的修改**上也会红（加一个 mode 就要改快照），红得没有信息——那会让下一次改动的人学会「无脑更新期望值」，是门的死亡螺旋。

#### 4.2 穷尽性断言

穷尽性的论域是 **`TOKENS` 的 round-context zone**：其中每一个已登记的 round-context token，都必须被**某一份 row 的 layout 携带**，一个携带者也没有即红——判据是 `TemplateAssembler#assertEveryCellHasCarrier`（`render/templates.ts`），一次构造跑一遍全部 row。反方向写在它旁边、不并进这一条：每一份 layout 携带的槽都必须是一个已登记的 round-context token（`#assertRegistered`）——两个方向的断言不同（「登记了而没有携带者」与「携带了而没有登记」），合成一条就只剩一个方向的盲区。`HANDOFF_SCHEMA` 在 shell zone，不坐任何 round-context layout，也不是格；某 row 从不携带的行同理不是它的格。这一条补的是逐格成对的盲区（漏声明一个格），与本仓既有的成对 pin 纪律一致。

#### 4.3 不加 `census:<id>`

覆盖事实**只有一处**（声明表本身），§4.2 的 `TemplateAssembler#assertEveryCellHasCarrier` 已让「登记了而没有携带者」可红。加计数只会让每一次正当的格增删都要改一个数字——与拒绝全表快照同一条理由：红得没有信息量的门，会教人去无脑更新它。

### 5. 派发输出面：`scratch/`

#### 5.1 纪律与它的结构依据

四份 shell 正文（`IMPLEMENT_SHELL` · `REVIEW_ITEM` · `FIX_SHELL` · `DOCS_FIX_SHELL`，`render/templates.ts`）各加同一句，措辞固定为：

```
Anything that is not a round artifact — analysis scripts, one-off scans, intermediate JSON/TSV — goes under the round context's `WORKSPACE_DIR` in `scratch/<round-id>/` (create it with `mkdir -p` before writing), never at the workspace root, where `<round-id>` is the stem your `OUTPUT_HANDOFF` path in that same round context carries with its `-a<n>` attempt segment stripped, nothing there is evidence, nothing there is read back, and this round's artifacts are exactly the `OUTPUT_*` paths that round context lists.
```

这一句必须**自给**，不靠它之外的上下文：base 是 round context 的 `WORKSPACE_DIR`；`<round-id>` 从本轮自己的 `OUTPUT_HANDOFF` 路径的 stem 推、并**剥掉 `-a<n>` 段**（§5.2）；`mkdir -p` 显式写出（引擎不建目录，§5.4）；`OUTPUT_*` 指向 round context（装配器把 shell 排在 round-context 之前，写「above」会指向反方向）。

「不是三份而是四份」的理由：这条纪律的判据是「每一次派发」，不是「三种 mode」。`docs-fix` 是第四份独立 shell 正文，漏它则该 mode 的临时脚本照旧沉到工作区根。**“四份 shell 正文”是精确说法，不是修辞**：review 面没有一份叫「review body」的单一数组——`render/templates.ts` 按 target type 用该 type 的前缀 + `REVIEW_ITEM` + 共享尾段拼出正文（`REVIEW_CONTEXT` 是它的 layout），那句话落进 `REVIEW_ITEM` 这一块即可；把它数成「四个 shell」会让读者去找一份不存在的独立 review shell。

子目录而非扁平前缀：`Workspace#names()`（`infra/workspace.ts`）只回 `entry.isFile()`，而 `orphanHandoffs()`（`session/ledger.ts`）遍历它——故 `scratch/**` 天然不产 `orphan:` 行。**判据是结构，不是白名单**：白名单是豁免层，它会让「下一个不该被报的文件」也需要一条登记。

#### 5.2 `<round-id>`

取**轮次命名 identity**——按 `(line, op, cycle)` 定的那一轮，`handoff` / `report` / `evidence` 三份产物都从它渲。cycle 在内：同一行的不同 cycle 是不同轮次，scratch 跟着轮次走才「可追溯到轮次」；attempt 段不在内：一次重试要继续它那一轮的分析，另开目录就是把同一轮拆散。**渲染器不替你做这次剥离**：`RoundNaming.renderName`（`session/round-naming.ts`）渲的是某一 kind 的完整文件名，其 stem 为 `line-op[-cycle][-a<n>]`（`session/round-artifacts.ts` 的 `roundStem` 在 attempt ≥ 2 时加 `-a<n>` 段），`session/__tests__/round-naming.test.ts` 的「renders the six artifact kinds of one round off ONE stem — the literal grid」把这条钉住（`{line: "tasks-1", op: "implement", cycle: 2, attempt: 3}` ⇒ `tasks-1-implement-2-a3-report.md`）。所以 `<round-id>` 是那个 stem **剥掉** `-a<n>` 之后的样子：剥离是唯一派生，不是把渲出来的 stem 原样当 attempt-free 用。

但 `OUTPUT_HANDOFF` 的 stem **带着** attempt 段：它是 `renderRound(…, "draft")` 渲出的 `…-a<n>.json`，`session/round-artifacts.ts` 的 `roundStem` 在 attempt ≥ 2 时加 `-a<n>`。所以「从 `OUTPUT_HANDOFF` 的 stem 推」必须与「剥掉 `-a<n>`」成对读——§5.1 的 shipped 句子写的就是这条剥离规则，本节是同一规则的 spec 说法；两处只能有一个派生，不能一处按 stem、一处按剥后的 stem。

#### 5.3 「不得作为证据」是散文，不是判据

没有任何读取面会去看「证据是否引用了 scratch 文件」；把它写成判据需要一个新读取面，与「判据是结构」相反。因此这一句是纪律（`scratch/` 里的东西不进 git、不进报告、不进 evidence 行），可核的只有 §5.4 那对 pin。

#### 5.4 引擎不建目录

目录由孩子 `mkdir -p`。引擎建目录**本身就是一次写**，会让 `scratch/` 从「结构上不可见」变成「结构上一个空目录」，并破掉「引擎只拒不改」与 `--dry-run` 的零写入承诺。

成对 pin：工作区根播一个裸临时文件 ⇒ `board` 落一条 `orphan:`；同一文件移入 `scratch/<round-id>/` ⇒ 该行消失、其余行不变。这证明的是结构而非白名单。

### 6. 章程回填（第一至十一项已落地：章程 `v4.05`–`v4.10`；第十二项待应用：`v4.11`）

前八项回填**已全部落地**（第一至七项见 `v4.05`–`v4.07`，第八项见章程 `v4.08` 的 change-history 行）；第九项由 spec `v0.7` 回填（章程 `v4.09`），第十、十一项由 spec `v0.9` 回填（章程 `v4.10`），第十二项由 spec `v0.11` 登记、章程侧**待应用**。逐条保留原文与改法作为审计轨迹，位置按章程自己的表名写——评审若只审散文，会漏掉这几处字节；每项后的版本号与章程自己的 change history 行对得上，条款对账就是逐项去章程里读那个位置的当前字节。

1. **⑤ 降为样本行**（落地：v4.06）。位置：Phase inventory 的 P38 行详情格。原文：「⑤ **与 P33 对账**——…」改为：「⑤ **与 P33 对账**（**不新增验收**）——overall 面 `INPUT_SPEC` 自指示作 ①④ pin 的**样本行**……」；验收表**不加** ⑤ 编号。
2. **⑥ 三改四**（落地：v4.05 登记 · v4.06 统一为「四个」）。「三个 shell」在章程里共三处：设计决策留存表的 **D94 行** · **Issue inventory 的 P38 行** · **Phase inventory 的 P38 行验收 ⑥**。三处均改「**四个** shell」——只统一「四个 shell」这个词组，括注保留各处的原有字节（`D94` 行是「（implement / review / fix / docs-fix）」，验收 ⑥ 是「（含 `docs-fix`）」，Issue inventory 行没有括注）；`docs-fix` 是第四份独立 shell 正文，漏它则该 mode 的临时脚本照旧沉到工作区根。
3. **两维改名**（`render` × `target` → `{absent, requiredOn}`）（落地：v4.06）。四处：设计决策留存表的 **D94 行** · **Phase inventory 的 P38 行详情格** · **Dependency graph 的 `P36 -> P38` 条款** · **执行序的 P38 条款**。
4. **死格判据重述**（落地：v4.07）。位置：设计决策留存表的 D94 行与 Phase inventory 的 P38 行详情格各一处。原文「`absent: drop` 的行，requiredOn 不得覆盖它服务的全部 type」改为「requiredOn 命名了该行从不服务的 type ⇒ 声明期红」，并写明 `always`（及全覆盖下的 `none`）使 `absent` 列惰性——惰性列是合法声明（§1.3）。
5. **原因闭集收为两条**（落地：v4.07）。位置：Phase inventory 的 P38 行详情格。原文「必填行缺失 / 目标路径不存在 / 必填值为空 ⇒ `CDD_BLOCKED: dispatch-input`」与「原因闭集 `missing-line` / `empty-value` / `target-absent`」两处：`missing-line` 退场（声明骑在行上，该状态只能由装配器构造期的 shell↔layout 断言兜住），闭集收为 `empty-value` / `target-absent`。
6. **`<round-id>` 派生**（落地：v4.07）。位置：Phase inventory 的 P38 行详情格。原文「`<round-id>` = `{family}-{key}`（`#naming` 已有的轮次 identity，与 `handoff`/`report`/`evidence` 同前缀）」改为轮次命名 identity 的同一 stem（含 cycle、不含 attempt，§5.2）。
7. **穷尽性论域与验收措辞**（落地：v4.07）。位置：Phase inventory 的 P38 行验收 ①②⑥。验收 ① 的「`TOKENS` × 各 row 每格必须被声明覆盖」改为「`TOKENS` 的 round-context zone × 各 row 自己的 layout」；验收 ② 的「`target: optional` 的行不受此判」改为「requiredOn 未命中的格不受此判」；验收 ⑥ 的「三个 shell」改为「四个 shell」（同第 2 项）。

8. **臂形态 · 路径位 · 反转数字**（落地：`v4.08`，即章程 change-history 的 `v4.08` 行）。位置同第 4 项的两处：设计决策留存表的 **D94 行** 与 **Phase inventory 的 P38 行详情格**。三笔字节：① requiredOn 的域由 `never | always | TargetType[]` 改为「一格一条臂，或几条合取臂」——一条臂是 `types` 再可叠一个 `when` 结构前提，今日的域装不下 `INPUT_OVERALL` 的同格两臂；② 声明对象新增 `path: true` 位，`target-absent` 只读这一位，路径格由声明说出、不由名字的 INPUT_ 前缀推出（`BASE_BRANCH` 是分支名，不是路径格）；③ 反转计数 3 → 4——这个计数在章程里只有**一处**字节：Phase inventory 的 P38 行 Scope 格的 ① 段（「**三处反转除外**（`spec:`/`program:` 已声明而解析不到、fix 拿不到 review 载体、`INPUT_RULINGS` 缺席）」）；该处改为**四处**，并点名第四个：无 `base.json` 时的 `BASE_BRANCH` `empty-value`（恢复动作 `cdd base set`），同时撤掉该处的 `spec:` 一半（`INPUT_SPEC` 没有可声明的标量，缺身份文档不是本门的臂——那是文档契约腿的 `spec-absent` 孤儿，`PlanRead#refusal` 先拒、那一轮不派发，登记是 `spec-absent`，从来不是 `undeclared`；§1.3 · §2.3）。**D94 行与该 Scope 格的 ③ 段不载这个计数**，因此不在 ③ 的坐标里：那里的计数若也要出现，是**新写一句**，不是改一句已存在的字节。章程 `version:` 递增至 `v4.08` 并追加 change-history 行（已落地）。

9. **验收 ① 的缺行后果**（落地：`v4.09`，即章程 change-history 的 `v4.09` 行）。位置：Phase inventory 的 P38 行**验收 ①**。原文「缺任一必填行 ⇒ `CDD_BLOCKED: dispatch-input`、child 零 spawn、`--dry-run` 同源可见（同一返回值的两个消费者，报文逐字节相同）」这条后果对「缺一格」**不可达**：声明骑在它管的那一行上（§1.1），没有行就没有声明，该状态在派发期不可表示、只能由装配器的构造期判据一次性判红（§2.2）；照它实现会补出一条永不触发的 `missing-line` 臂。该处改为把**缺一格**与**空一格**分属两条判据：缺行归构造期判据（装配器根本建不起来），空值归同一门的 `empty-value`，被拒 ⇒ child 零 spawn、`--dry-run` 同源可见（同一返回值的两个消费者，报文逐字节相同）。章程 `version:` 递增至 `v4.09` 并追加 change-history 行。

10. **`undeclared` 改为 `spec-absent`**（落地：章程 `v4.10`，即章程 change-history 的 `v4.10` 行）。位置：章程 change-history 的 **`v4.08` 行**。该行的 ③ 把撤掉的 `spec:` 一半收在「缺身份文档归文档契约腿的 `undeclared` 状态」——错在状态名：缺同 slug 身份文档的计划是文档契约腿的 `spec-absent` 孤儿，`PlanRead#refusal` 先拒、那一轮不派发（§1.3），`undeclared` 是「相位还没有 plan」的正查状态，不是这一形态。**`v4.08` 行不改**——历史行记录的是当时被相信的字节，改历史行等于伪造审计轨迹；更正写成新的 `v4.10` 行，明说 `v4.08` 的措辞是 `undeclared`、正确登记是 `spec-absent`。

11. **穷尽性断言的方向**（落地：章程 `v4.10`，同一行）。位置：Phase inventory 的 P38 行**验收 ①**。原文「一条穷尽性断言（`TOKENS` 的 round-context zone × 各 row 自己的 layout，每格必须被声明覆盖，漏一格即红）」读成「某 row 自己那份 layout 里出现的每一格」时永远为真——layout 里的格就是它声明的格——而它要拦的是「登记了这个 token、却没有任何 row 携带它」。该处改为「`TOKENS` 的 round-context zone 里每个已登记的 round-context token 都必须被某份 row 的 layout 携带，一个携带者也没有即红」，即交付的 `TemplateAssembler#assertEveryCellHasCarrier`（`render/templates.ts`，§4.2）。

12. **臂的组合是并列，不是合取**（待应用：章程 `v4.11`）。位置：设计决策留存表的 **D94 行** 与 **Phase inventory 的 P38 行详情格**，两处今日都写着「几条合取臂」（第八项 ① 的措辞即此出处，那条落地记录保留不改）。合取与交付的判据相反——`#armHits`（`face/lifecycle.ts`）逐臂判，`#inputRefusalOf` 只在 `hits.length === 0` 时跳过该格，即**任一条命中即 exigible**；读成合取时 `review` / `docs-fix` 的 `INPUT_OVERALL` 两臂（`[overall]` 与 `[phase-spec, plan, branch, wave]`，type 集互斥）在任何 frame 上都不 exigible，反转 ① 随之失效（§1.1）。两处改为「一格一条臂，或几条**并列**臂（任一条命中即 exigible）」。源码面同批两处 docblock：`RequiredArm` 与 `ContextLine` 的 `requiredOn`（`render/templates.ts`）把「several conjunctive arms」改为并列措辞——判据的字节在 `face/lifecycle.ts`，docblock 只是跟随。章程 change-history 的 `v4.08` 行**不改**（历史行，同第十项的理由），措辞更正由本项的 `v4.11` 行说出。章程 `version:` 递增至 `v4.11` 并追加 change-history 行。

同时：非目标两处挖洞为「shell 正文的**其余**指令，`scratch/` 与 `none` 两句除外」（v4.05）；母宪章 `version` 递增并追加 change-history 行（v4.05 · v4.06 · v4.07 · v4.08 · v4.09 · v4.10）。

章程 `version:` 现为 `v4.10`（第一至十一项已落地），第十二项待应用时递增至 `v4.11`；后续评审若要改章程，开新一轮回填并递增版本，不静默改字节。

### Acceptance criteria

- `dispatch-input` 门可红可修：每个 requiredOn 命中的格播空值 ⇒ `CDD_BLOCKED: dispatch-input` 且报文点名该 row 与该 token、child 零 spawn、不占轮次、不留 in-flight 记录；在册树（`base.json` 已 `cdd base set`）⇒ 绿。`--dry-run` 与真派发对同一帧报出的拒绝串逐字节相同——**除引擎合成的 `INPUT_WAVE_BRIEF` 一格**：预览对它的答案由该格的 `preview: satisfied` 声明给出（命名行点名 ⇒ 满足，未命名 ⇒ `empty-value`），真派发照 `path: true` 问存在性（§2.4）；wave 预览与 wave 真派发配在同一帧上成对 pin。
- 声明只有一种臂形态且一格可挂多条**并列**臂（任一条命中即 exigible，不是两臂俱中）：`review` / `docs-fix` 的 `INPUT_OVERALL` 在同一格上同时有 `[overall]` 的无前提臂与 `when program` 臂，有 `program:` 的 overall 轮次与声明了 `program:` 的 `phase-spec` / `plan` / `branch` / `wave` 轮次各命中不同的一条，而 `single-spec` 面不在任何一条的 `types` 里（该面没有这一格）；`when identity` 是同一种形态的第二条前提，`INPUT_SPEC` 用它把三个代码面收窄到「身份文档声明了形状」的那些轮次；`path: true` 点名六个读入格，`target-absent` 只按该位发问（`BASE_BRANCH` · `ROLE` · `TARGET_TYPE` · `WAVE` · `WORKSPACE_*` 不是路径格）。
- §2.3 的四次反转逐条有 pin：① 声明了 `program:` 而章程解析不到 ⇒ `target-absent`；② fix / docs-fix 的 `INPUT_REVIEWS` 空值 ⇒ `empty-value`、拼出的路径不在盘上 ⇒ `target-absent`；③ 无 sidecar ⇒ 裸词 `none`；④ 无 `base.json` 的 tree 评审 ⇒ `empty-value`。清单外的格派发字节不变。
- `INPUT_SPEC` 的 `when: identity` 臂可判且不改字节：同 slug 身份文档声明了形状 ⇒ exigible（值为空即 `empty-value`，引擎应给而没给）；没有身份文档 ⇒ 文档契约腿的 `spec-absent` 孤儿先拒（`PlanRead#refusal`）、该轮不派发，因此它不是「该格不 exigible 而仍然派发」的缺口；文档在、但读不出形状（P37 T4 的 ④ 臂）⇒ 该读即 `undecided`（零拒绝）、该格不 exigible、行消失、派发字节与今日逐字节相同。
- 目标路径不存在 ⇒ 同一门的 `target-absent`；requiredOn 未命中的格不受此判。
- `INPUT_OVERALL` 的 exigibility 是结构前提：`overall` 面恒 exigible；其余面按身份文档的**声明**（`DocEntry.program` 那个字面量，而非派生链接 `ChainRoot.programLink` 、也非已解析值 `scene.overallLink`）决定——声明了而章程解析不到 ⇒ `target-absent`；未声明 ⇒ 该格不存在、派发照常（P37 T4 的 ② 臂保持绿；`single-spec` 的类型声明里没有 `program` 锚，它不在 `when: program` 的 `types` 集里，该面因此没有这一格）。
- fix 与 docs-fix 的 `INPUT_RULINGS` **恒在**：有 sidecar ⇒ 路径；无 sidecar ⇒ 裸词 `none`（字节 pin）；P31 §2.5 的「absent ⇒ 零行」旧钉翻新并注明 deliberate（D74）。
- 必填值为空串 ⇒ 同一门的 `empty-value`（不得靠装配器丢行掩盖）。
- 逐格成对 pin 全覆盖 + 一条穷尽性断言（`TOKENS` 的 round-context zone 里每个已登记的 round-context token 都必须被某份 row 的 layout 携带，一个携带者也没有即红；shell zone 的 `HANDOFF_SCHEMA` 不是格）；声明期的可红判据**五种**，同由 `TemplateAssembler#assertDeclarations`（`render/templates.ts`）在建类时一次判完——要求集死格（requiredOn 命名了该 row 从不服务的 type，`#assertServed`）⇒ 构造期红；槽注册（某 row 的 layout 携带的槽必须是已登记的 round-context token，`#assertRegistered`）⇒ 构造期红；shell↔layout 一致性（shell 正文点名的 cell 不被该 row 的 layout 携带）⇒ 构造期红（`#assertShellCarries`）；zone 覆盖（上面那条穷尽性断言，`#assertEveryCellHasCarrier`）⇒ 构造期红；`preview: satisfied` 挂在 `INPUT_WAVE_BRIEF` 之外的格上 ⇒ 构造期红且报文点名该格与 `INPUT_WAVE_BRIEF`（`#assertEngineWritten`，豁免只答命名行写下的那一格）；`always` 与全覆盖下的 `none` 是惰性列（可断言、不红）。
- `scratch` 面的成对 pin：工作区根播一个裸临时文件 ⇒ `board` 落一条 `orphan:`；同一文件移入 `scratch/<round-id>/` ⇒ 该行消失、其余行不变；四份 shell 正文各带那句话的字节 pin。
- `pnpm run validate` exit 0 · changeset `cdd-engine` **minor** · kairos 无。

## Constraints

- **消费面守恒**：除 §2.3 清单点名的四处反转（① ② ③ ④）与 §3.3 / §5.1 两句 shell 新文本（`$version` 递增）外，任何一轮的 dispatch prompt 逐字节不变。清单之外的格一律不变，理由逐格写在 §2.3 的表里——「其余惰性」是那张清单的**补集**，不是一句绝对断言。
- **不新增 CLI 动词、不改 `next:` 字面**：门的失败面走既有 `CDD_BLOCKED` 通道。
- **`$version` 递增**：prompt 数据面因两句 shell 新文本与声明形状变化而递增一版；它是「prompt 字节已变」的唯一机械信号。
- **`--dry-run` 不新增输出行**：判据可核的最低形态是同一返回值的两个消费者，不是多印一份。
- **不加白名单、不加 census、不写全表快照**：三者都是「用登记代替结构」或「用计数代替判据」。
- **pin 写法**：路径 + 符号，不用行号。**尚未在源树里出现的词汇不能写成行内 pin**——pin 门的符号语料是源码里的标识符全集，一个还没落地的名字解析不到。这条约束由 pin 门自己的行为钉住（在册语料零 finding、未落地名字即红），不靠计数。本文因此只在 §1.1 的围栏块里声明新词汇，行内一律用裸词：围栏块是例子，不是断言。
- **引擎只拒不改**：`dispatch-input` 拒绝后不移动、不改写、不删除任何产物；恢复动作归编排器。
- **合法缺席与漏传必须可区分**：`overall` 面的 `INPUT_SPEC`、`single-spec` 面上的 `INPUT_OVERALL`（该 type 的键集里没有 `program` 锚）、以及 `plan` / `branch` / `wave` 轮次上的 `INPUT_SPEC`（文档读不出形状 ⇒ 没有可判的载体，行消失；没有同 slug 身份文档 ⇒ 文档契约腿的 `spec-absent` 孤儿先拒，该轮不派发）是「没有这一格」，不是「可有可无」，也不是「漏传」。
- **边界**：`render/templates.ts` 的形状重构属 P39（god objects 分波次拆），本相位只改声明与门，不拆类。

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-17 | 初稿：grilling Q1–Q27 裁定落成正文——两维声明 `{absent, requiredOn}` 与真值表 · 表本体（按功能面推，不按今日取值）· 纯读门与门序、报文原因闭集 · 三处行为反转与「其余惰性」主张 · `none` 为渲染字面量 + shell 半句 · 逐格成对 + 穷尽性断言（不写快照、不加 census）· `scratch/` 四 shell 与结构不可见 · 章程三项回填（⑤ 降样本行 · ⑥ 三→四 · 两维改名） | Oscaner M. · Claude（kairos:cdd-spec-writer · 2026-11-17） |
| v0.2 | 2026-11-17 | docs-fix 第一轮（phase-spec review-1 · F1–F7 全部接纳）：死格判据重述为「requiredOn 命名了该 row 从不服务的 type」——`always` 与全覆盖下的 `none` 只是 `absent` 列惰性，属合法声明（§1.3 · 验收）· `INPUT_OVERALL` 的 exigibility 改为结构前提 `when program`（声明、两臂与验收）· `missing-line` 退场，原因闭集收为 `empty-value` / `target-absent` 两条，shell↔layout 一致性归 #assertShellLayout 的构造期断言（§2.2）· §1.4 补齐 `ROLE` · `TARGET_TYPE` · `WAVE` 三族格与 docs-fix 的 `never` 格 · §4.2 论域收为「`TOKENS` 的 round-context zone ∩ 各 row 自己的 layout」· §5.2 的 `<round-id>` 改用轮次命名 stem 并改正理由 · §6 改为逐条枚举七项章程字节（含验收 ②⑥ 与 Dependency graph / 执行序条款）· 章程回填同批落地（v4.07） | Oscaner M. · Claude（kairos:cdd-dev · 2026-11-17） |
| v0.3 | 2026-11-17 | docs-fix 第二轮（phase-spec review-2 · F1–F6 全部接纳）：`fix` 行按 ROLE 收为两个 type（`branch` · `wave`），四个文档面改记在 `docs-fix` 行名下（§1.1 · §1.3 死格自审 · §1.4 末段）；`INPUT_OVERALL` 的 exigibility 改判**声明** `ChainRoot.programLink`，`scene.overallLink` 只供值，存在性归 P36 矩阵面 `DocFs`（§1.1 · §1.3 · §2.1 三项输入 · 验收）；`INPUT_SPEC` 的抖动面重锚到同 slug 身份文档，`spec:` 一半从 §1.3 与 §2.3 反转 ① 撤出（缺文档归文档契约腿）；§2.2 报文定为单前缀 + `; ` 连接段、段内 ` · ` 分隔，并改正与 `grading-impact-missing` 的「同形」主张（§2.3 反转 ① 的 token 随之改为 `INPUT_OVERALL`）；§5.1 那句改为自给（`WORKSPACE_DIR` 为 base · 轮次 id 由 `OUTPUT_HANDOFF` 路径的 stem 推 · `mkdir -p` 显式 · 指向 round context）；§6 第 2 项只引三处共同字节「四个 shell」 | Oscaner M. · Claude（kairos:cdd-dev · 2026-11-17） |
| v0.4 | 2026-11-17 | docs-fix 第三轮（phase-spec review-3 · F1–F8 全部接纳）：requiredOn 收为一种形态 RequiredArm / RequiredArm[]——一格可挂多条**合取**臂，`review` 与 `docs-fix` 的 `INPUT_OVERALL` 因此同格带无前提 `[overall]` 臂与 `when program` 臂，`overall` 臂恒无前提（`OverallDocType#chainRoot` 的 `programLink: null`）；声明新增 `path: true` 位，路径格由声明说出、`target-absent` 只读该位（`BASE_BRANCH` 不是路径格）；§2.3 改为「空值清单」——逐格对照 `#valuesOf` 的空臂、三问定位反转，补上反转 ④（无 `base.json` 的树评审 `empty-value`）与反转 ② 的两半（`always` 管空值 · `target-absent` 管文件不在），守恒条款改为清单补集；§2.4 补预览面的 brief 值来源（`RoundNaming#briefName`，与 `renderBrief` 同一名字）；§2.1 的声明输入改指身份文档解析头那一格（既非新读、也非 `scene.overallLink`）；§5.1 句子与 §5.2 统一为「stem 剥掉 `-a<n>` 段」；§6 改为已落地账本（章程 `v4.07`，逐项标版本）；§2.2 的 `empty-value` 说明含「所依据的产物从未写下」 | Oscaner M. · Claude（kairos:cdd-dev · 2026-11-17） |
| v0.5 | 2026-11-17 | docs-fix 第四轮（phase-spec review-4 · F1–F9 全部接纳）：行内 pin 回到「源码里已落地的词汇」——requiredOn · RequiredArm · RequiredArm[] · INPUT_ 四处的反引号撤掉，新词汇只在 §1.1 的围栏块里声明（F1 · F6–F9），pin 门与 census 门恢复零 finding；§2.4 把同源主张收窄为「除引擎合成的 `INPUT_WAVE_BRIEF` 一格以外逐字节相同」，并写明这一格的预览答案是「命名行点名即视为满足」——一条声明出来的答案，既不是存在性读、也不是写（`renderBrief` 在预览里被跳过），「把该格填成路径格」改为「填值，声明不动」（F2）；§6 增第八项**待应用**字节（章程 `v4.08`：臂形态的域 · `path: true` 位 · 反转 3 → 4 并点名 `BASE_BRANCH`）（F3）；exigibility 的声明源三处统一为 `DocEntry.program`（声明字面量），并写明 `ChainRoot.programLink`（各 chainRoot 按设计恒交 null）与 `scene.overallLink`（已解析值、断链与未声明同归 null）各不能答什么（F4）；§2.3 的 `INPUT_SPEC` 行补 `undecided` 臂、锚到同 slug 身份文档并点名 `PlanRead#refusal` 经 `session/preflight.ts` 的文档契约腿（F5） | Oscaner M. · Claude（kairos:cdd-dev · 2026-11-17） |
| v0.6 | 2026-11-17 | docs-fix 第五轮（phase-spec review-5 · F1–F5 全部接纳，五条裁定均 ACCEPTED）：`INPUT_SPEC` 的臂改为结构前提 `when: identity`——同 slug 身份文档声明了形状（`DocEntry.docType`）才 exigible，没有身份文档归文档契约腿 `undeclared` · `clean` 的零拒绝状态（合法前向缺口），读不出形状（P37 T4 的 ④ 臂）则该格无可判载体，§2.3 的「不变」因此成立（F1）；`single-spec` 从 `INPUT_OVERALL` 的 `when: program` type 集里撤下（该 type 的键集里没有 `program` 锚，臂与值在那一面上一致），§1.3 的 `single-spec` 断言改写为「门读声明的字面量 vs 类型保证了什么」的结构陈述（F2）；预览答案升格为声明字段 `preview`（`value` / `satisfied` 两值，`INPUT_WAVE_BRIEF` 是唯一 `satisfied` 格，§1.1 声明一次 · §1.4 三行标记 · §2.4 只讲这一位），删掉「填上值而 `path: true` 位仍在」那句（它写的正是 §2.4 否定的存在性读）（F3）；§6 第八项 ③ 的坐标收为唯一载有该计数的一处（Phase inventory 的 P38 行 Scope 格 ① 段），D94 与 Scope ③ 退出坐标（F4）；§5.1 改称「四份 shell 正文」并写明 review 正文按 type 由前缀 + `REVIEW_ITEM` + 共享尾段拼成（F5） | Oscaner M. · Claude（kairos:cdd-dev · 2026-11-17） |
| v0.7 | 2026-11-17 | docs-fix 第六轮（phase-spec review-6 · F1–F6 全部接纳，F1 / F3 / F5 三条按裁定改法落地）：「没有同 slug 身份文档」改记为文档契约腿的 `spec-absent` 孤儿（`PlanRead#refusal` 先拒、该轮不派发），不再叫「合法前向缺口」（v0.6 行保留当时的措辞，以本轮为准）——`undecided` 也不再是第三条臂：读不出形状的那份 `unregistered` 丢弃正是弄脏文档根的那个读，该格因此只有两种非 exigible 形态（§1.1 · §1.3 · §2.3 行与反转 ① · 验收 · Constraints）（F1）；§6 第八项改记为 `v4.08` 已落地，删去两处「待应用 / `v4.07`」字节（F2）；新增第九项并落地章程 `v4.09`：验收 ① 删去对「缺任一必填行」不可达的 `CDD_BLOCKED: dispatch-input` 后果，改为「缺一格归构造期判据、空一格归 `empty-value`」（F3）；§1.1 围栏块声明 `ModePromptRow.serves`（四行服务集），§1.3 死格判据与 §1.4 表尾改指该列、不从臂的并集推（F4）；intro 与 §2.2 改述本相位**已强制**的形态，并点名 `TemplateAssembler#assertDeclarations`（那条 shell↔layout 断言已随声明升格退役）（F5）；§1.3 的 `single-spec` 键集补 `slug`，七个键、`slug` 必填（F6） | Oscaner M. · Claude（kairos:cdd-dev · 2026-11-17） |
| v0.8 | 2026-11-17 | branch-fix-1 轮（F4 裁定 ACCEPTED）：`preview: "satisfied"` 的唯一性由散文升为构造期断言——`TemplateAssembler#assertEngineWritten` 把第二个 `satisfied` 格拦在建类之前（报文点名该格与该格的规范载体），§1.1 与验收的「声明期可红判据」由一种增至两种；§1.3／§4.2 的其余判据与全部派发字节不变 | Oscaner M. · Claude（kairos:cdd-fix · 2026-11-17） |
| v0.9 | 2026-11-17 | docs-fix 第七轮（phase-spec review-7 · F1–F5 全部接纳，F1 / F3 两条按裁定落地）：§6 第八项的括注改记为 `spec-absent`（`PlanRead#refusal` 先拒、那一轮不派发），并新增第十项把章程 `v4.08` 行的 `undeclared` 措辞登记为 `v4.10` 的更正（历史行不改）；新增第十一项把章程验收 ① 的穷尽性方向一并回填（F1）；§4.2 的穷尽性论域由「`TOKENS` 的 round-context zone ∩ 该 row 自己那份 layout」改为「zone 里每个已登记 token 必须被某份 row 的 layout 携带」，反方向的槽登记写在旁边，§4.3 的「漏一格可红」改指 `#assertEveryCellHasCarrier`（F2）；验收的声明期判据由两种增至三种——补上 shell↔layout 的 `#assertShellCarries`（F3）；§5.2 的 `<round-id>` 定义为 `(line, op, cycle)` 上的轮次 identity，`renderName` 的 attempt 段由剥离规则给出（F4）；§1.1 的 `#assertEngineWritten` 补模块路径 `render/templates.ts`（F5）；章程同批递增 `v4.10` | Oscaner M. · Claude（kairos:cdd-dev · 2026-11-17） |
| v0.10 | 2026-11-17 | branch-fix-2 轮（F2 / F3 按裁定落地）：§2.3 反转 ② 的 after-column 补上恢复动作——重派那一轮评审让载体重现，或给 `--reviews` 一个在仓库根下真实存在的路径，并写明 fix 轮造不出自己的输入（F2 的裁定 ACCEPTED：硬拒绝欠一条编排器可读的修法，与反转 ④ 的 `cdd base set` 同形；同一句进 changeset）· 验收的声明期可红判据由三种改为**五种**——点名槽注册（`#assertRegistered`）与 zone 覆盖（`#assertEveryCellHasCarrier`）两个方向，与 plan Task 1 的五条对齐（F3） | Oscaner M. · Claude（kairos:cdd-fix · 2026-11-17） |
| v0.11 | 2026-11-17 | docs-fix 第八轮（phase-spec review-8 · F1–F5 全部接纳）：一格的多条臂改述为**并列**（取并集，任一条命中即 exigible）——§1.1 围栏注与正文、§1.4 表尾、验收三处去掉「合取」并写明合取读法会让 `review` / `docs-fix` 的 `INPUT_OVERALL` 永不可 exigible、反转 ① 随之失效，§6 新增第十二项登记章程两处「几条合取臂」与 `render/templates.ts` 两处 docblock 的并列措辞更正（章程侧待应用 `v4.11`）（F1）；§1.3 的 argv 面 pin 由 `PlanRead#readPath` 改回 `PlanSource#readPath`（`infra/plan-source.ts`）（F2）；§5.4 删去不可复现的 16 条 `orphan:` 实测计数，只留结构性判据与成对 pin（F3）；§1.3 的 P33 T2 ② 臂改述为它真正钉住的两格（`INPUT_OVERALL` 在场、`INPUT_SPEC` 不在），并写明 `ROLE: docs-fix` 只在 `--type plan` 臂上被点名、`--type overall` 轮没有独立 pin（F4）；§6 标题的版本范围改为 `v4.05`–`v4.10` 并标第十二项待应用，两处「本轮」deictic 改为 spec 版本（F5） | Oscaner M. · Claude（kairos:cdd-dev · 2026-11-17） |
| v0.12 | 2026-11-17 | **交付 · 相位关闭**：六任务四波全部落地——声明形状与三条构造期判据（`#assertDeclarations`）· 四态渲染 · 纯读门 `dispatch-input` 与门序 · `--dry-run` 字节等价与三门镜像 · 四段 `scratch/` 与两句 `none`（`$version` 25）· 章程 v4.05–v4.10 十一项回填。评审 8 轮 51 条全受理；四波 9 条、分支 2 轮 8 条；`pnpm run validate` exit 0；changeset `cdd-engine` minor。 | Oscaner M. · Claude（kairos:cdd-dev · 2026-11-17） |
| v0.13 | 2026-11-18 | **换向记录（P40 回填）**：§2.4 末尾追加一条指向 P40 的记录——该节那条 per-mode 例外已由 P40 作废（`INPUT_WAVE_BRIEF` 改记为引擎写的，任何路径都不再做存在性读，`#answeredByNaming` 与 `inputRefusal` 的 `mode` 参数退场）。本节正文与其余判据按交付时的字节保留，不动；本条只指向，不重写。 | Oscaner M. · Claude（kairos:docs-fix · 2026-11-18） |
| v0.14 | 2026-11-18 | **符号改名回填（P40 第一波 · fix 轮 F1）**：P40 的 Task 1 把本 spec 两处判据引用的构造期断言由 assertPreviewAnswer 改名为 `#assertEngineWritten`，§1.1 与 §4.2 的引用随之改记今日符号名，v0.8 / v0.9 两行血缘记录里的同一引用一并迁名；判据的形状与字节面不变（本轮只让已改名的符号重新可解析，`pins.guard` 的语料扫描因此归零）。 | Oscaner M. · Claude |
