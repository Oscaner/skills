---
title: 'P38 · 派发输入契约：必填表、`none` 表示法与 `dispatch-input` 门'
doc-type: phase-spec
version: v0.3
date: 2026-11-17
slug: 2026-11-17-engine-doc-tooling-p38-design
program: 2026-10-10-engine-doc-tooling
author: 'Oscaner M. · Claude（kairos:cdd-spec-writer · 2026-11-17）'
---

## Design

本相位让「一个 mode 在缺输入的情况下仍然渲染成功」不可能再发生。今日的链路是：`TemplateAssembler#contextLines`（`render/templates.ts`）遇到空值 token 直接丢整行，而 `#assertShellLayout` 只校验「shell 正文点名的 token 被 layout 携带」——两者的交点恰好是**名字被携带、值与存在性从不被问**。于是 overall 面的 `INPUT_SPEC` 自指示可以恒绿（P33 的原始样本），fix 轮可以拿到一个不存在的 `INPUT_RULINGS` 路径，孩子到运行时才撞墙。

交付面分三块，一块判据、一块表示法、一块纪律：每格声明它「缺了成不成立」，每格声明缺席长什么样，每轮声明临时脚本该去哪里。三块共用一个前提——**判据必须在派发之前、在同一个返回值上判**。

### 1. 声明的两个维度

#### 1.1 载体与真值表

layout 行升格为对象，声明与它管的那一行同处一地：

```
ContextLine = {
  line: string,                                  // 含 {{TOKEN}} 槽的渲染行
  absent: "drop" | "none",                       // 不成立以外的那些 type，缺席长什么样
  requiredOn: "never" | "always" | TargetType[]  // 哪些 target type 缺了它这一轮就不成立
    | { types: TargetType[], when: "program" },  // 同上，且命中还须过一条结构前提（§1.3）
}
```

结构前提不新开一维：它答的仍是同一个问题（「哪些 type 缺了它不成立」），只是把答案再限定在「身份文档声明了 `program:`」的那些轮次上——但它**不**读 `#valuesOf` 取该值时用的那个已解析值：exigibility 判的是**声明**（身份文档的 `ChainRoot.programLink`，`contract/doc.ts`），`scene.overallLink` 只**供值**。两者在断链的轮次上分岔（`programLink` 非空、`overallLink` 为 `null`），只读后者就会把真断裂读成合法缺席（§1.3 两臂）。

`TemplatePrompt` 的每个 `ModePromptRow.roundContext` 从 `readonly string[]` 变为 `readonly ContextLine[]`；非槽行（`## Round context` 标题、空行）用 `requiredOn: "never"` + `absent: "drop"` 表达，它们没有值可比。

四种状态全覆盖：

| 值 | type 关系 | 后果 |
|---|---|---|
| 非空 | — | 渲染该值；路径格另要求它存在 |
| 空 | ∈ requiredOn | **门红** `empty-value` |
| 空 | ∉ requiredOn · `absent: drop` | 整行消失 |
| 空 | ∉ requiredOn · `absent: none` | 渲染裸词 `none` |

requiredOn 必须是**按 target type 收窄的集合**，因为每个 mode 只有一份 layout，而一份 layout 服务的 `TargetType` 不止一个：`review` 的 layout 服务六种（`phase-spec` · `single-spec` · `plan` · `branch` · `wave` · `overall`），`fix` 的 layout 只服务两种（`branch` · `wave`）——四个文档面（`phase-spec` · `single-spec` · `plan` · `overall`）上的 fix 轮由 `#roleOf`（`face/lifecycle.ts`）经 `TargetFaceTable.isDocShape` 判成 `docs-fix`，骑的是 `docs-fix` 的 layout（§1.4）。「六种」是 `fix` 动词接受的 `--type` 词集，不是它那一行的 ROLE 集——两者不同，声明只能按后者写。把必填性表达成「行上的 type 集合」而非「每 type 一份 layout」，理由是条件而非计数：**每个 mode 一份 layout、必填性落在行上**；每 type 一份会让唯一的差别（这一轮缺了它成不成立）被复制成 N 份 layout 逐份维护。

#### 1.2 每个字段只回答一个问题

requiredOn 回答「哪些 type 缺了它这一轮不成立」；absent 回答「其余那些 type，缺席是丢行还是写一个字」。absent **不**表达「这一行渲不渲染」——值非空时它一律渲染，两者的分工由 1.1 的真值表定义。

两个字段正交，不是冗余：`requiredOn: never` 且需要丢行的格将来完全可能出现，而 absent 恰好能表达它。

#### 1.3 死格、惰性列与结构前提

- **死格判据**：requiredOn 命名了一个该 row **从不服务**的 target type ⇒ 声明期红（构造期断言，不是运行期告警）。这是唯一的死格：它声明的是一个永远不会被问到的状态。本表自己的 `fix` 行初稿就长这个样子——它按 `fix` 动词的六词 `--type` 集声明，而那四个文档面由 `docs-fix` 行渲染，于是这四格永不被问到。判据一审自表即红，故 §1.4 的 `fix` 行只留它真正服务的两个 type；修表不是放宽判据。
- **惰性列不是死格**：`requiredOn: "always"` 让 `absent` 列在该行上失效——空值恒红，「不成立时缺席长什么样」再也不会被问到；`absent: "none"` 在 requiredOn 覆盖全部服务 type 时是同一类惰性。两者都是**合法声明**（`OUTPUT_*` · `WORKSPACE_*` 与 `implement` 的 `WAVE` 就落在这一格），写出来是为了让「这一行的缺席没有第二种形态」可读，不构成缺陷。
- **结构前提**：`INPUT_OVERALL` 的 exigibility 由结构决定，不由用户选择——`overall` 面它就是判对象（恒 exigible）；其余面**当且仅当**身份文档声明了 `program:` 才 exigible。判的是**声明**（`ChainRoot.programLink`），不是 `#valuesOf` 取值用的那个已解析路径（`scene.overallLink`）：断链时前者非空、后者为 `null`，同源就会把断裂读成缺席。因此两臂必须分开读：`program:` **声明了却解析不到章程** ⇒ 硬红 `target-absent`（真断裂，§2.3 反转 ①），该格指向的文档存在性由 P36 的矩阵面 `DocFs` 读回答；**根本没有 `program:`** 的独立 `single-spec` 面 ⇒ 该格不存在、行消失（P37 T4 的 ② 臂就是这一臂）。
- **合法缺席不是 optional**：`overall` 面的 `INPUT_SPEC` 不是一个「可选格」，是**没有这一格**（章程不是自己的 spec，C2）。这个区别必须在声明里可读——不写该行的 requiredOn 集合，而不是靠 `absent: none` 软化。
- **requiredOn 的抖动面**：`INPUT_SPEC` 不来自任何声明的标量——它跟着**同 slug 身份文档**走（`face/cli.ts` 由 `identityPath` 推 `specLink`），front-matter 头本就没有 `spec` 键（`contract/frontmatter.ts` 只暴露 `program` · `parent-version` · `base` · `issues`）。所以可声明的臂只有两条：「身份文档在、但读不出来」⇒ 硬红 `target-absent`；「根本没有身份文档」⇒ 已由文档契约腿 `PlanRead#refusal` 经 `session/preflight.ts` 拒（常态门，不新增一条 dispatch-input 臂）。修法是**补身份文档**（或撤掉身份面），不是绕过门。

#### 1.4 表本体

requiredOn 按「这一轮缺了它还能不能判」推出，不按「今天恰好取了什么值」。absent 除 `INPUT_RULINGS` 外一律 `drop`。行序与各 mode 的 layout 同序，便于逐行对账：

| row | 格 | absent | requiredOn | 依据 |
|---|---|---|---|---|
| implement | `ROLE` | drop | always | 身份恒有值；`always` 使 `absent` 列惰性（§1.3） |
| implement | `WAVE` · `INPUT_WAVE_BRIEF` | drop | always | brief 是 implement 唯一的计划面（完整镜像） |
| review | `ROLE` | drop | always | 恒有值；`always` 使 `absent` 列惰性 |
| review | `TARGET_TYPE` | drop | always | P33 的判别符：没有「无类型的评审」 |
| review | `WAVE` | drop | [wave] | 只有 wave 评审带 wave id |
| review | `INPUT_WAVE_BRIEF` | drop | [wave] | 只有 wave 评审判的是 brief |
| review | `INPUT_PLAN` | drop | [plan, branch] | plan 面判它；branch 面是计划一致性参照 |
| review | `INPUT_SPEC` | drop | [phase-spec, single-spec, plan, branch, wave] | 每个面都要验「代码/计划是否兑现设计」 |
| review | `INPUT_OVERALL` | drop | `[overall]` · `[phase-spec, single-spec, plan, branch, wave] when program` | overall 面判它；其余面是父章程一致性，由 `program:` 结构决定（§1.3） |
| review | `BASE_BRANCH` | drop | [branch, wave] | 树评审的比对基准 |
| fix | `ROLE` | drop | always | 恒有值 |
| fix | `TARGET_TYPE` | drop | always | 判别符区分 `branch` 面与 `wave` 面 |
| fix | `WAVE` | drop | [wave] | wave 的 fix 才带 wave id |
| fix | `INPUT_WAVE_BRIEF` | drop | [wave] | wave 的 fix 靠 brief |
| fix | `INPUT_PLAN` | drop | [branch] | wave 面已由 brief 整份承载，再给 `INPUT_PLAN` 是同一事实的第二份 |
| fix | `INPUT_SPEC` | drop | [branch, wave] | 两个面都要验「代码/计划是否兑现设计」；四个文档面不在此行（见本节末段） |
| fix | `INPUT_OVERALL` | drop | `[branch, wave] when program` | 父章程一致性，由同 slug 身份文档的 `program:` 声明决定（§1.3） |
| fix | `INPUT_REVIEWS` | drop | always | 没有评审输入的 fix 轮不成立 |
| fix | `INPUT_RULINGS` | **none** | never | 可以真没有，且这一事实值得写在 prompt 上 |
| docs-fix | `ROLE` | drop | always | 恒有值 |
| docs-fix | `TARGET_TYPE` | drop | always | 判别符区分被修的文档面 |
| docs-fix | `WAVE` | drop | never | docs-fix 服务的 type 里没有 `wave`，该行永不成立——声明它，不是漏掉它 |
| docs-fix | `INPUT_PLAN` | drop | [plan] | 只有 plan 文档是判对象；branch 不是文档修复面 |
| docs-fix | `INPUT_SPEC` | drop | [phase-spec, single-spec, plan] | plan 面 = 设计参考；spec 面 = judged；overall 面没有这一格 |
| docs-fix | `INPUT_OVERALL` | drop | `[overall]` · `[phase-spec, single-spec, plan] when program` | overall 面 = judged 本身；其余面由 `program:` 结构决定 |
| docs-fix | `INPUT_REVIEWS` | drop | always | 同 fix |
| docs-fix | `INPUT_RULINGS` | **none** | never | 同 fix |

`OUTPUT_*` 与 `WORKSPACE_*` 格不参与本维度：写出路径**本轮才创建**（存在性不可判），work-mode 事实由引擎计算（永不缺席）。它们的 requiredOn 恒为 `always`、absent 恒为 `drop`——`always` 使 `absent` 列在它们上面惰性（§1.3），判决只落在读入路径格上。**这一段就是它们的声明**：§4.2 的穷尽性断言把本段算作这些格的覆盖。

**`fix` 行的 ROLE 是两个 type，而 `fix` 动词的 `--type` 词集是六个词**：`cdd fix --type phase-spec` · `--type single-spec` · `--type plan` · `--type overall` 渲染的不是这一行——`#roleOf`（`face/lifecycle.ts`）把文档面上的 fix 相位判成 `docs-fix`，那些轮次骑 `docs-fix` 行与 `DOCS_FIX_SHELL`（`render/templates.ts`），已由 `face/__tests__/cli.test.ts` 的 P33 T2 ② 臂钉住（`cdd fix --type overall` 拿到的是 docs-fix 上下文）。表里若给 `fix` 行声明那四个 type，描述的就是一个该行永远不会被问到的状态，即 §1.3 的死格。**按 ROLE 写，不按动词词集写。**

### 2. `dispatch-input` 门

#### 2.1 纯读形态与门序

门是一个**纯读**：输出是拒绝串或 null，输入是三项——缺任一项就有格答不了：

- **值**：本轮即将渲染的那份 `TemplateValues`（`#valuesOf` 的 `INPUT_OVERALL` 臂读 `scene.overallLink`）。
- **声明**：当前 frame 的身份文档链接（`ChainRoot.programLink`，`contract/doc.ts`）——exigibility 的唯一来源，也是「声明了」的唯一读面。它与值必须分开读：断链的轮次上 `programLink` 非空而 `scene.overallLink` 为 `null`，只读后者会把「声明了而解析不到」读成「没声明」（§1.3 两臂）。
- **存在性**：目标路径在不在——由 P36 的矩阵面 `DocFs` 读（`contract/invariants.ts`）回答，是 `target-absent` 的唯一来源。

它挂在既有 `artifactRefusal` 的同一形状旁边——`face/lifecycle.ts` 已有先例（`artifactRefusal(frame)` 供 `--dry-run` 读，`#artifactRefusalOf(cell)` 供真派发拒，两者是同一判定的两个消费者）。

位置在 **artifact 门之前**：它判「这一轮能不能成立」（读的路径在不在），artifact 门判「输入的质量」（sidecar 合规否）。前者更基本，且不读文件内容。

被拒 ⇒ child 零 spawn · **不占轮次** · 不留 in-flight 记录（与 `artifact-identity` 拒绝同处理）。

#### 2.2 报文与原因闭集

报文复用既有 `Words` 机制（`face/words.ts`），不新开第二条消费面。**一行** `CDD_BLOCKED:`（`#blocked`，`face/lifecycle.ts`——引擎唯一的阻断通道），reason 里逐格列出**全部**违规格：段间以 `; ` 连接，每段拼成 `row · TOKEN · reason`，` · ` 是段内分隔符：

```
CDD_BLOCKED: dispatch-input · <row> · <TOKEN> · <reason>; <row> · <TOKEN> · <reason>
```

`CDD_BLOCKED: ` 前缀只出现一次，由 `#blocked` 加，门自己的返回值不带前缀也不带换行——`--dry-run` 消费者与真派发读到的正是这一条串（§2.4）。一格一段、不折行：折行会让第二个违规看起来像两条独立阻断。

`reason` 是闭集两条：`empty-value`（值被要求而为空）· `target-absent`（该格指向的文档路径不存在，或结构前提（§1.3）声明了 `program:` 而章程解析不到）。

「声明要求该格而 layout 未携带」不在这份闭集里，且在派发期**不可表示**：声明骑在它管的那一行上（§1.1），没有行就没有声明——这个状态只能是构造期的 shell↔layout 断言（`#assertShellLayout`）红了，装配器根本建不起来，谈不上派发。章程里的「必填行缺失」因此由那条构造期断言兜住，不由本门兜。

「一次报全部」与 P37 的 `grading-impact-missing` **理由同源、形状不同**：那条的段是 findings（`#gradingRefusal` 把每个违规写成一个 `id "summary"`），这条的段是声明格（`row · TOKEN · reason`）；共用的是「一次全报 + `; ` 连接 + 单前缀」的机制，不是段内字节。理由相同：一次派发被拒，编排器要一轮修完；只报第一条会让「修一格、再撞下一格」重复 N 轮。

#### 2.3 三处行为反转（其余派发逐字节不变）

| # | 今日 | 之后 |
|---|---|---|
| 1 | 身份文档声明了 `program:` 而章程解析不到 ⇒ `scene.overallLink` 为 `null`、行静静消失 | `CDD_BLOCKED: dispatch-input · <row> · INPUT_OVERALL · target-absent` |
| 2 | fix 轮拿不到 review 载体（`resolveHandoffPath` 只拼名不查存在）⇒ 静默 | 硬红（`INPUT_REVIEWS` = `always`） |
| 3 | `INPUT_RULINGS` 缺席 ⇒ 行消失 | 渲染裸词 `none` |

**声明的其余部分是惰性的**：它只声明「缺了就不成立」，不改任何今天能正常工作的派发字节。除了 prompt 因 §3.3 与 §5.1 新增的两句话与 `$version` 递增，三处反转之外的派发字节不变。

反转 ① 只管「**声明了**却解析不到」，且它只属于 `program:` 那一臂：门读身份文档的声明（`ChainRoot.programLink`）、不读 `scene.overallLink` 那个已解析值，所以断链不会再被读成缺席（§1.3）。原稿里并排的 `spec:` 一半已撤：`INPUT_SPEC` 没有可声明的标量，它跟同 slug 身份文档走，缺文档已由文档契约腿拒，不是本门的臂。根本没有 `program:` 的独立 `single-spec` 面也不在反转之列——它没有这一格（§1.3 结构前提），P37 T4 的 ② 臂因此保持绿。

#### 2.4 与 `--dry-run` 的同源

`--dry-run` 的门入口是 `face/cli.ts` 里 `harness.artifactRefusal(frame)` 那处，`dispatch-input` 挂在它旁边。判据可核的最低形态是**同一返回值的两个消费者**：pin 断言同一帧下 `--dry-run` 报的拒绝串与真派发 `CDD_BLOCKED` 的 reason 逐字节相同。

`--dry-run` **不新增输出行**：把读格渲染出来会新增一条渲染面，而渲染面每多一处就多一处「预览与真派发各说各话」的机会。整段 prompt 的字节等价属 P39 的守恒面，不在此越界。

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

每个 requiredOn 命中的格播一个空值 ⇒ 门红且报文点名该格；每个 `absent: drop` 格播空值 ⇒ 该行消失、其余行不变；`INPUT_RULINGS` 空值 ⇒ 断言渲染出裸词 `none` 的**字节**。

不写全表快照：快照在**未来正当的修改**上也会红（加一个 mode 就要改快照），红得没有信息——那会让下一次改动的人学会「无脑更新期望值」，是门的死亡螺旋。

#### 4.2 穷尽性断言

穷尽性的论域是 **`TOKENS` 的 round-context zone ∩ 该 row 自己那份 layout** 里出现的每一格，必须被某条声明覆盖；未覆盖即红。`HANDOFF_SCHEMA` 在 shell zone，不坐任何 round-context layout，也不是格；某 row 从不携带的行同理不是它的格。这一条补的是逐格成对的盲区（漏声明一个格），与本仓既有的成对 pin 纪律一致。

#### 4.3 不加 `census:<id>`

覆盖事实**只有一处**（声明表本身），§4.2 已让「漏一格」可红。加计数只会让每一次正当的格增删都要改一个数字——与拒绝全表快照同一条理由：红得没有信息量的门，会教人去无脑更新它。

### 5. 派发输出面：`scratch/`

#### 5.1 纪律与它的结构依据

四个 shell（`IMPLEMENT_SHELL` · `REVIEW_ITEM` · `FIX_SHELL` · `DOCS_FIX_SHELL`，`render/templates.ts`）各加同一句，措辞固定为：

```
Anything that is not a round artifact — analysis scripts, one-off scans, intermediate JSON/TSV — goes under the round context's `WORKSPACE_DIR` in `scratch/<round-id>/` (create it with `mkdir -p` before writing), never at the workspace root, where `<round-id>` is the stem your `OUTPUT_HANDOFF` path in that same round context carries, nothing there is evidence, nothing there is read back, and this round's artifacts are exactly the `OUTPUT_*` paths that round context lists.
```

这一句必须**自给**，不靠它之外的上下文：base 是 round context 的 `WORKSPACE_DIR`；`<round-id>` 从本轮自己的 `OUTPUT_HANDOFF` 路径的 stem 推（§5.2）；`mkdir -p` 显式写出（引擎不建目录，§5.4）；`OUTPUT_*` 指向 round context（装配器把 shell 排在 round-context 之前，写「above」会指向反方向）。

「不是三个而是四个」的理由：这条纪律的判据是「每一次派发」，不是「三种 mode」。`docs-fix` 是第四份独立 shell 正文，漏它则该 mode 的临时脚本照旧沉到工作区根。

子目录而非扁平前缀：`Workspace#names()`（`infra/workspace.ts`）只回 `entry.isFile()`，而 `orphanHandoffs()`（`session/ledger.ts`）遍历它——故 `scratch/**` 天然不产 `orphan:` 行。**判据是结构，不是白名单**：白名单是豁免层，它会让「下一个不该被报的文件」也需要一条登记。

#### 5.2 `<round-id>`

取**轮次命名 identity**——`RoundNaming.renderName`（`session/round-naming.ts`）从 `(line, op, cycle, attempt)` 渲出的那个 stem，`handoff` / `report` / `evidence` 三份产物都从它渲。cycle 在内：同一行的不同 cycle 是不同轮次，scratch 跟着轮次走才「可追溯到轮次」；attempt 段不在内：一次重试要继续它那一轮的分析，另开目录就是把同一轮拆散。

#### 5.3 「不得作为证据」是散文，不是判据

没有任何读取面会去看「证据是否引用了 scratch 文件」；把它写成判据需要一个新读取面，与「判据是结构」相反。因此这一句是纪律（`scratch/` 里的东西不进 git、不进报告、不进 evidence 行），可核的只有 §5.4 那对 pin。

#### 5.4 引擎不建目录

目录由孩子 `mkdir -p`。引擎建目录**本身就是一次写**，会让 `scratch/` 从「结构上不可见」变成「结构上一个空目录」，并破掉「引擎只拒不改」与 `--dry-run` 的零写入承诺。

成对 pin：工作区根播一个裸临时文件 ⇒ `board` 落一条 `orphan:`；同一文件移入 `scratch/<round-id>/` ⇒ 该行消失、其余行不变。这证明的是结构而非白名单。

实测依据：P37 工作区（`.kairos/cdd/2026-11-16-engine-doc-tooling-p37/scratch/{tasks-7,tasks-7-fix-1,tasks-8}/`）的 16 个临时脚本，原报 16 条 `orphan:`，移入三个子目录后归零、零代码改动。

### 6. 章程回填（与本文同批提交，由本 spec 的评审一并审）

七项，逐条给出原文与改法，位置按章程自己的表名写——评审若只审散文，会漏掉这几处字节。第 1 项与第 2 项的前两处已在先前提交落地，本批补第 2 项的第三处与第 3–7 项：

1. **⑤ 降为样本行**。位置：Phase inventory 的 P38 行详情格。原文：「⑤ **与 P33 对账**——…」改为：「⑤ **与 P33 对账**（**不新增验收**）——overall 面 `INPUT_SPEC` 自指示作 ①④ pin 的**样本行**……」；验收表**不加** ⑤ 编号。
2. **⑥ 三改四**。「三个 shell」在章程里共三处：设计决策留存表的 **D94 行** · **Issue inventory 的 P38 行** · **Phase inventory 的 P38 行验收 ⑥**。三处均改「**四个** shell」——只统一「四个 shell」这个词组，括注保留各处的原有字节（`D94` 行是「（implement / review / fix / docs-fix）」，验收 ⑥ 是「（含 `docs-fix`）」，Issue inventory 行没有括注）；`docs-fix` 是第四份独立 shell 正文，漏它则该 mode 的临时脚本照旧沉到工作区根。
3. **两维改名**（`render` × `target` → `{absent, requiredOn}`）。四处：设计决策留存表的 **D94 行** · **Phase inventory 的 P38 行详情格** · **Dependency graph 的 `P36 -> P38` 条款** · **执行序的 P38 条款**。
4. **死格判据重述**。位置：设计决策留存表的 D94 行与 Phase inventory 的 P38 行详情格各一处。原文「`absent: drop` 的行，requiredOn 不得覆盖它服务的全部 type」改为「requiredOn 命名了该行从不服务的 type ⇒ 声明期红」，并写明 `always`（及全覆盖下的 `none`）使 `absent` 列惰性——惰性列是合法声明（§1.3）。
5. **原因闭集收为两条**。位置：Phase inventory 的 P38 行详情格。原文「必填行缺失 / 目标路径不存在 / 必填值为空 ⇒ `CDD_BLOCKED: dispatch-input`」与「原因闭集 `missing-line` / `empty-value` / `target-absent`」两处：`missing-line` 退场（声明骑在行上，该状态只能由装配器构造期的 shell↔layout 断言兜住），闭集收为 `empty-value` / `target-absent`。
6. **`<round-id>` 派生**。位置：Phase inventory 的 P38 行详情格。原文「`<round-id>` = `{family}-{key}`（`#naming` 已有的轮次 identity，与 `handoff`/`report`/`evidence` 同前缀）」改为轮次命名 identity 的同一 stem（含 cycle、不含 attempt，§5.2）。
7. **穷尽性论域与验收措辞**。位置：Phase inventory 的 P38 行验收 ①②⑥。验收 ① 的「`TOKENS` × 各 row 每格必须被声明覆盖」改为「`TOKENS` 的 round-context zone × 各 row 自己的 layout」；验收 ② 的「`target: optional` 的行不受此判」改为「requiredOn 未命中的格不受此判」；验收 ⑥ 的「三个 shell」改为「四个 shell」（同第 2 项）。

同时：非目标两处挖洞为「shell 正文的**其余**指令，`scratch/` 与 `none` 两句除外」；母宪章 `version` 递增并追加一条 change-history 行。

### Acceptance criteria

- `dispatch-input` 门可红可修：每个 requiredOn 命中的格播空值 ⇒ `CDD_BLOCKED: dispatch-input` 且报文点名该 row 与该 token、child 零 spawn、不占轮次、不留 in-flight 记录；在册树 ⇒ 绿。`--dry-run` 与真派发对同一帧报出的拒绝串逐字节相同。
- 目标路径不存在 ⇒ 同一门的 `target-absent`；requiredOn 未命中的格不受此判。
- `INPUT_OVERALL` 的 exigibility 是结构前提：`overall` 面恒 exigible；其余面按身份文档的**声明**（`ChainRoot.programLink`，而非已解析值 `scene.overallLink`）决定——声明了而章程解析不到 ⇒ `target-absent`；未声明 ⇒ 该格不存在、派发照常（P37 T4 的 ② 臂保持绿）。
- fix 与 docs-fix 的 `INPUT_RULINGS` **恒在**：有 sidecar ⇒ 路径；无 sidecar ⇒ 裸词 `none`（字节 pin）；P31 §2.5 的「absent ⇒ 零行」旧钉翻新并注明 deliberate（D74）。
- 必填值为空串 ⇒ 同一门的 `empty-value`（不得靠装配器丢行掩盖）。
- 逐格成对 pin 全覆盖 + 一条穷尽性断言（`TOKENS` 的 round-context zone × 各 row 自己的 layout，每格必须被某条声明覆盖，shell zone 的 `HANDOFF_SCHEMA` 不是格）；声明期的可红判据只有一种——requiredOn 命名了该 row 从不服务的 type ⇒ 构造期红；`always` 与全覆盖下的 `none` 是惰性列（可断言、不红）。
- `scratch` 面的成对 pin：工作区根播一个裸临时文件 ⇒ `board` 落一条 `orphan:`；同一文件移入 `scratch/<round-id>/` ⇒ 该行消失、其余行不变；四个 shell 各带那句话的字节 pin。
- `pnpm run validate` exit 0 · changeset `cdd-engine` **minor** · kairos 无。

## Constraints

- **消费面守恒**：除 §2.3 三处反转与 §3.3 / §5.1 两句 shell 新文本（`$version` 递增）外，任何一轮的 dispatch prompt 逐字节不变。声明的其余部分是惰性的——它只声明「缺了就不成立」。
- **不新增 CLI 动词、不改 `next:` 字面**：门的失败面走既有 `CDD_BLOCKED` 通道。
- **`$version` 递增**：prompt 数据面因两句 shell 新文本与声明形状变化而递增一版；它是「prompt 字节已变」的唯一机械信号。
- **`--dry-run` 不新增输出行**：判据可核的最低形态是同一返回值的两个消费者，不是多印一份。
- **不加白名单、不加 census、不写全表快照**：三者都是「用登记代替结构」或「用计数代替判据」。
- **pin 写法**：路径 + 符号，不用行号。**尚未在源树里出现的词汇不能写成行内 pin**——pin 门的符号语料是源码里的标识符全集，一个还没落地的名字解析不到。这条约束由 pin 门自己的行为钉住（在册语料零 finding、未落地名字即红），不靠计数。本文因此只在 §1.1 的围栏块里声明新词汇，行内一律用裸词：围栏块是例子，不是断言。
- **引擎只拒不改**：`dispatch-input` 拒绝后不移动、不改写、不删除任何产物；恢复动作归编排器。
- **合法缺席与漏传必须可区分**：`overall` 面的 `INPUT_SPEC`、无 `program:` 的身份面（独立 `single-spec`）上的 `INPUT_OVERALL` 是「没有这一格」，不是「可有可无」。
- **边界**：`render/templates.ts` 的形状重构属 P39（god objects 分波次拆），本相位只改声明与门，不拆类。

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-17 | 初稿：grilling Q1–Q27 裁定落成正文——两维声明 `{absent, requiredOn}` 与真值表 · 表本体（按功能面推，不按今日取值）· 纯读门与门序、报文原因闭集 · 三处行为反转与「其余惰性」主张 · `none` 为渲染字面量 + shell 半句 · 逐格成对 + 穷尽性断言（不写快照、不加 census）· `scratch/` 四 shell 与结构不可见 · 章程三项回填（⑤ 降样本行 · ⑥ 三→四 · 两维改名） | Oscaner M. · Claude（kairos:cdd-spec-writer · 2026-11-17） |
| v0.2 | 2026-11-17 | docs-fix 第一轮（phase-spec review-1 · F1–F7 全部接纳）：死格判据重述为「requiredOn 命名了该 row 从不服务的 type」——`always` 与全覆盖下的 `none` 只是 `absent` 列惰性，属合法声明（§1.3 · 验收）· `INPUT_OVERALL` 的 exigibility 改为结构前提 `when program`（声明、两臂与验收）· `missing-line` 退场，原因闭集收为 `empty-value` / `target-absent` 两条，shell↔layout 一致性归 `#assertShellLayout` 的构造期断言（§2.2）· §1.4 补齐 `ROLE` · `TARGET_TYPE` · `WAVE` 三族格与 docs-fix 的 `never` 格 · §4.2 论域收为「`TOKENS` 的 round-context zone ∩ 各 row 自己的 layout」· §5.2 的 `<round-id>` 改用轮次命名 stem 并改正理由 · §6 改为逐条枚举七项章程字节（含验收 ②⑥ 与 Dependency graph / 执行序条款）· 章程回填同批落地（v4.07） | Oscaner M. · Claude（kairos:cdd-dev · 2026-11-17） |
| v0.3 | 2026-11-17 | docs-fix 第二轮（phase-spec review-2 · F1–F6 全部接纳）：`fix` 行按 ROLE 收为两个 type（`branch` · `wave`），四个文档面改记在 `docs-fix` 行名下（§1.1 · §1.3 死格自审 · §1.4 末段）；`INPUT_OVERALL` 的 exigibility 改判**声明** `ChainRoot.programLink`，`scene.overallLink` 只供值，存在性归 P36 矩阵面 `DocFs`（§1.1 · §1.3 · §2.1 三项输入 · 验收）；`INPUT_SPEC` 的抖动面重锚到同 slug 身份文档，`spec:` 一半从 §1.3 与 §2.3 反转 ① 撤出（缺文档归文档契约腿）；§2.2 报文定为单前缀 + `; ` 连接段、段内 ` · ` 分隔，并改正与 `grading-impact-missing` 的「同形」主张（§2.3 反转 ① 的 token 随之改为 `INPUT_OVERALL`）；§5.1 那句改为自给（`WORKSPACE_DIR` 为 base · 轮次 id 由 `OUTPUT_HANDOFF` 路径的 stem 推 · `mkdir -p` 显式 · 指向 round context）；§6 第 2 项只引三处共同字节「四个 shell」 | Oscaner M. · Claude（kairos:cdd-dev · 2026-11-17） |
