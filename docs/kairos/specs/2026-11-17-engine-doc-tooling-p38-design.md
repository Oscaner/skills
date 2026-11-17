---
title: 'P38 · 派发输入契约：必填表、`none` 表示法与 `dispatch-input` 门'
doc-type: phase-spec
version: v0.1
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
  requiredOn: "never" | "always" | TargetType[], // 哪些 target type 缺了它这一轮就不成立
}
```

`TemplatePrompt` 的每个 `ModePromptRow.roundContext` 从 `readonly string[]` 变为 `readonly ContextLine[]`；非槽行（`## Round context` 标题、空行）用 `requiredOn: "never"` + `absent: "drop"` 表达，它们没有值可比。

四种状态全覆盖：

| 值 | type 关系 | 后果 |
|---|---|---|
| 非空 | — | 渲染该值；路径格另要求它存在 |
| 空 | ∈ requiredOn | **门红** `empty-value` |
| 空 | ∉ requiredOn · `absent: drop` | 整行消失 |
| 空 | ∉ requiredOn · `absent: none` | 渲染裸词 `none` |

requiredOn 必须是**按 target type 收窄的集合**，因为 `fix` 与 `review` 各只有一份 layout，而它服务六种 `TargetType`（`phase-spec` · `single-spec` · `plan` · `branch` · `wave` · `overall`）。把必填性表达成「行上的 type 集合」而非「每 type 一份 layout」，避免同一份 12 行常量被复制成六份、其中五份只差必填性。

#### 1.2 每个字段只回答一个问题

requiredOn 回答「哪些 type 缺了它这一轮不成立」；absent 回答「其余那些 type，缺席是丢行还是写一个字」。absent **不**表达「这一行渲不渲染」——值非空时它一律渲染，两者的分工由 1.1 的真值表定义。

两个字段正交，不是冗余：`requiredOn: never` 且需要丢行的格将来完全可能出现，而 absent 恰好能表达它。

#### 1.3 死格与合法缺席

- **死格判据**：`absent: "drop"` 的行，requiredOn 不得覆盖它服务的**全部** target type——否则 `drop` 分支永远走不到，声明了一个不存在的状态。这是声明期的红线，不是运行期的告警。
- **合法缺席不是 optional**：`overall` 面的 `INPUT_SPEC` 不是一个「可选格」，是**没有这一格**（章程不是自己的 spec，C2）；`single-spec` 面的 `INPUT_OVERALL` 同理（单 spec 无父程序）。两者的区别必须在声明里可读——前者不写该行的 requiredOn 集合，后者由「该 type 没有父程序」结构决定，而不是靠 `absent: none` 软化。
- **requiredOn 的抖动面**：一个 `phase-spec` 若缺 `program:`、一个 `plan` 若缺 `spec:`，此后是**硬红**（`target-absent`），修法是补 front-matter，不是绕过门。这是本相位最大的一次行为反转，见 §2.3。

#### 1.4 表本体

requiredOn 按「这一轮缺了它还能不能judged」推出，不按「今天恰好取了什么值」。absent 除 `INPUT_RULINGS` 外一律 `drop`：

| row | 格 | absent | requiredOn | 依据 |
|---|---|---|---|---|
| implement | `WAVE` · `INPUT_WAVE_BRIEF` | drop | always | brief 是 implement 唯一的计划面（完整镜像） |
| review | `INPUT_WAVE_BRIEF` | drop | [wave] | 只有 wave 评审judged 的是 brief |
| review | `INPUT_PLAN` | drop | [plan, branch] | plan 面 judged 它；branch 面是计划一致性参照 |
| review | `INPUT_SPEC` | drop | [phase-spec, single-spec, plan, branch, wave] | 每个面都要验「代码/计划是否兑现设计」 |
| review | `INPUT_OVERALL` | drop | [overall, phase-spec, plan, branch, wave] | overall 面 judged 它；其余面是父章程一致性 |
| review | `BASE_BRANCH` | drop | [branch, wave] | 树评审的比对基准 |
| fix | `INPUT_REVIEWS` | drop | always | 没有评审输入的 fix 轮不成立 |
| fix | `INPUT_RULINGS` | **none** | never | 可以真没有，且这一事实值得写在 prompt 上 |
| fix | `INPUT_WAVE_BRIEF` | drop | [wave] | wave 的 fix 靠 brief |
| fix | `INPUT_PLAN` | drop | [plan, branch] | wave 面已由 brief 整份承载，再给 `INPUT_PLAN` 是同一事实的第二份 |
| fix | `INPUT_SPEC` | drop | [phase-spec, single-spec, plan, branch, wave] | overall 面没有这一格（C2） |
| fix | `INPUT_OVERALL` | drop | [phase-spec, plan, branch, wave] | overall 面没有这一格 |
| docs-fix | `INPUT_REVIEWS` | drop | always | 同 fix |
| docs-fix | `INPUT_RULINGS` | **none** | never | 同 fix |
| docs-fix | `INPUT_PLAN` | drop | [plan] | 只有 plan 文档是judged 对象；branch 不是文档修复面 |
| docs-fix | `INPUT_SPEC` | drop | [phase-spec, single-spec, plan] | plan 面 = 设计参考；spec 面 = judged；overall 面没有这一格 |
| docs-fix | `INPUT_OVERALL` | drop | [overall, phase-spec, plan] | overall 面 = judged 本身；`single-spec` 无父程序 |

`OUTPUT_*` 与 `WORKSPACE_*` 格不参与本维度：写出路径**本轮才创建**（存在性不可判），work-mode 事实由引擎计算（永不缺席）。它们的 requiredOn 恒为 `always`、absent 恒为 `drop`，判决只落在读入路径格上。

### 2. `dispatch-input` 门

#### 2.1 纯读形态与门序

门是一个**纯读**：输入是本轮即将渲染的那份 `TemplateValues` 与当前 frame，输出是拒绝串或 null。它挂在既有 `artifactRefusal` 的同一形状旁边——`face/lifecycle.ts` 已有先例（`artifactRefusal(frame)` 供 `--dry-run` 读，`#artifactRefusalOf(cell)` 供真派发拒，两者是同一判定的两个消费者）。

位置在 **artifact 门之前**：它判「这一轮能不能成立」（读的路径在不在），artifact 门判「输入的质量」（sidecar 合规否）。前者更基本，且不读文件内容。

被拒 ⇒ child 零 spawn · **不占轮次** · 不留 in-flight 记录（与 `artifact-identity` 拒绝同处理）。

#### 2.2 报文与原因闭集

报文复用既有 `Words` 机制（`face/words.ts`），不新开第二条消费面。一格一行，一次报**全部**违规格：

```
CDD_BLOCKED: dispatch-input · <row> · <TOKEN> · <reason>
```

`reason` 是闭集三条：`missing-line`（声明要求该格而 layout 未携带——声明自身被改坏）· `empty-value`（值被要求而非空却为空）· `target-absent`（值非空但路径不存在）。

「一次报全部」与 P37 的 `grading-impact-missing` 同形（那条也是点名每一个）：一次派发被拒，编排器要一轮修完；只报第一条会让「修一格、再撞下一格」重复 N 轮。

#### 2.3 三处行为反转（其余派发逐字节不变）

| # | 今日 | 之后 |
|---|---|---|
| 1 | `spec:` / `program:` 链接缺席 ⇒ 静默丢行 | `CDD_BLOCKED: dispatch-input · <row> · INPUT_SPEC · target-absent` |
| 2 | fix 轮拿不到 review 载体（`resolveHandoffPath` 只拼名不查存在）⇒ 静默 | 硬红（`INPUT_REVIEWS` = `always`） |
| 3 | `INPUT_RULINGS` 缺席 ⇒ 行消失 | 渲染裸词 `none` |

**声明的其余部分是惰性的**：它只声明「缺了就不成立」，不改任何今天能正常工作的派发字节。除了 prompt 因 §3.3 与 §5.4 新增的两句话与 `$version` 递增，三处反转之外的派发字节不变。

#### 2.4 与 `--dry-run` 的同源

`--dry-run` 的门入口是 `face/cli.ts` 里 `harness.artifactRefusal(frame)` 那处，`dispatch-input` 挂在它旁边。判据可核的最低形态是**同一返回值的两个消费者**：pin 断言同一帧下 `--dry-run` 报的拒绝串与真派发 `CDD_BLOCKED` 的 reason 逐字节相同。

`--dry-run` **不新增输出行**：把读格渲染出来会新增一条渲染面，而渲染面每多一处就多一处「预览与真派发各说各话」的机会。整段 prompt 的字节等价属 P39 的守恒面，不在此越界。

### 3. `none` 的语义

#### 3.1 它是渲染字面量，不是值

`#valuesOf` 对可选格仍然交空串（诚实：没有就是没有），由装配器在 `absent: "none"` + 空值处渲染出裸词 `none`。若改为在 `#valuesOf` 编造 `none`，「引擎漏传」与「本轮确实没有」在值层面再次不可分辨——P33 的病原样复发。

裸词而非反引号：`none` 在这里是**值**，与旁边的路径值同格同形；加反引号会让它看起来像代码路径，而它恰恰表示「没有代码路径」。破折号不可判（人读得懂，门读不懂）。

#### 3.2 三态可分辨

- requiredOn 命中 + 空 ⇒ 门红（引擎漏传）
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

`TOKENS` 与各 row 服务过的 type 之积，每一格必须被某条声明覆盖；未覆盖即红。这一条补的是逐格成对的盲区（漏声明一个格），与本仓既有的成对 pin 纪律一致。

#### 4.3 不加 `census:<id>`

覆盖事实**只有一处**（声明表本身），§4.2 已让「漏一格」可红。加计数只会让每一次正当的格增删都要改一个数字——与拒绝全表快照同一条理由：红得没有信息量的门，会教人去无脑更新它。

### 5. 派发输出面：`scratch/`

#### 5.1 纪律与它的结构依据

四个 shell（`IMPLEMENT_SHELL` · `REVIEW_ITEM` · `FIX_SHELL` · `DOCS_FIX_SHELL`，`render/templates.ts`）各加同一句，措辞固定为：

```
Anything that is not a round artifact — analysis scripts, one-off scans, intermediate JSON/TSV — goes in `<workspace>/scratch/<round-id>/`, never at the workspace root. Nothing there is evidence and nothing there is read back: this round's artifacts are exactly the `OUTPUT_*` paths above.
```

「不是三个而是四个」的理由：这条纪律的判据是「每一次派发」，不是「三种 mode」。`docs-fix` 是第四份独立 shell 正文，漏它则该 mode 的临时脚本照旧沉到工作区根。

子目录而非扁平前缀：`Workspace#names()`（`infra/workspace.ts`）只回 `entry.isFile()`，而 `orphanHandoffs()`（`session/ledger.ts`）遍历它——故 `scratch/**` 天然不产 `orphan:` 行。**判据是结构，不是白名单**：白名单是豁免层，它会让「下一个不该被报的文件」也需要一条登记。

#### 5.2 `<round-id>`

取 `{family}-{key}`——`#naming` 已有的轮次 identity，与 `handoff` / `report` / `evidence` 同前缀。同一轮的三份产物本就共前缀，scratch 跟着走才「可追溯到轮次」；带上 cycle/attempt 会让同一轮的分析分裂到多个目录。

#### 5.3 「不得作为证据」是散文，不是判据

没有任何读取面会去看「证据是否引用了 scratch 文件」；把它写成判据需要一个新读取面，与「判据是结构」相反。因此这一句是纪律（`scratch/` 里的东西不进 git、不进报告、不进 evidence 行），可核的只有 §5.4 那对 pin。

#### 5.4 引擎不建目录

目录由孩子 `mkdir -p`。引擎建目录**本身就是一次写**，会让 `scratch/` 从「结构上不可见」变成「结构上一个空目录」，并破掉「引擎只拒不改」与 `--dry-run` 的零写入承诺。

成对 pin：工作区根播一个裸临时文件 ⇒ `board` 落一条 `orphan:`；同一文件移入 `scratch/<round-id>/` ⇒ 该行消失、其余行不变。这证明的是结构而非白名单。

实测依据：P37 工作区（`.kairos/cdd/2026-11-16-engine-doc-tooling-p37/scratch/{tasks-7,tasks-7-fix-1,tasks-8}/`）的 16 个临时脚本，原报 16 条 `orphan:`，移入三个子目录后归零、零代码改动。

### 6. 章程回填（与本文同批提交，由本 spec 的评审一并审）

三项，逐条给出原文与改法——评审若只审散文，会漏掉章程那三处字节：

1. **⑤ 降为样本行**。原文：「⑤ **与 P33 对账**——「名字带了、语义错了」类缺陷由 required 表兜住（overall 面 `INPUT_SPEC` 自指示为样本）。」改为：「⑤ **与 P33 对账**（**不新增验收**）——overall 面 `INPUT_SPEC` 自指示作 ①④ pin 的**样本行**……」；验收表**不加** ⑤ 编号。
2. **⑥ 三改四**。原文「三个 shell（implement / review / fix）各加一句」与「三个 shell 各加一句」两处，均改为「**四个** shell（含 `docs-fix`）」；D94 行与 P38 详情行各一处。
3. **两维改名**。D94 行与 P38 条目行/详情行的 `render: always | when-present` × `target: required | optional` 改为 `{absent: drop | none, requiredOn: never | always | TargetType[]}`，并补死格判据与「按 target type 收窄」的理由。

同时：非目标两处挖洞为「shell 正文的**其余**指令，`scratch/` 与 `none` 两句除外」；母宪章 `version` 递增并追加一条 change-history 行。

### Acceptance criteria

- `dispatch-input` 门可红可修：每个 requiredOn 命中的格播空值 ⇒ `CDD_BLOCKED: dispatch-input` 且报文点名该 row 与该 token、child 零 spawn、不占轮次、不留 in-flight 记录；在册树 ⇒ 绿。`--dry-run` 与真派发对同一帧报出的拒绝串逐字节相同。
- 目标路径不存在 ⇒ 同一门的 `target-absent`；requiredOn 未命中的格不受此判。
- fix 与 docs-fix 的 `INPUT_RULINGS` **恒在**：有 sidecar ⇒ 路径；无 sidecar ⇒ 裸词 `none`（字节 pin）；P31 §2.5 的「absent ⇒ 零行」旧钉翻新并注明 deliberate（D74）。
- 必填值为空串 ⇒ 同一门的 `empty-value`（不得靠装配器丢行掩盖）。
- 逐格成对 pin 全覆盖 + 一条穷尽性断言（`TOKENS` × 各 row 服务的 type，每格必须被声明覆盖）；死格判据可红（`absent: drop` 的行若 requiredOn 覆盖全部服务 type ⇒ 声明期红）。
- `scratch` 面的成对 pin：工作区根播一个裸临时文件 ⇒ `board` 落一条 `orphan:`；同一文件移入 `scratch/<round-id>/` ⇒ 该行消失、其余行不变；四个 shell 各带那句话的字节 pin。
- `pnpm run validate` exit 0 · changeset `cdd-engine` **minor** · kairos 无。

## Constraints

- **消费面守恒**：除 §2.3 三处反转与 §3.3 / §5.1 两句 shell 新文本（`$version` 递增）外，任何一轮的 dispatch prompt 逐字节不变。声明的其余部分是惰性的——它只声明「缺了就不成立」。
- **不新增 CLI 动词、不改 `next:` 字面**：门的失败面走既有 `CDD_BLOCKED` 通道。
- **`$version` 递增**：prompt 数据面因两句 shell 新文本与声明形状变化而递增一版；它是「prompt 字节已变」的唯一机械信号。
- **`--dry-run` 不新增输出行**：判据可核的最低形态是同一返回值的两个消费者，不是多印一份。
- **不加白名单、不加 census、不写全表快照**：三者都是「用登记代替结构」或「用计数代替判据」。
- **pin 写法**：路径 + 符号，不用行号。**尚未在源树里出现的词汇不能写成行内 pin**——pin 门的符号语料是源码里的标识符全集，一个还没落地的名字解析不到（本次草稿的 requiredOn 就是 24 条 unresolvable）。本文因此只在 §1.1 的围栏块里声明新词汇，行内一律用裸词：围栏块是例子，不是断言。
- **引擎只拒不改**：`dispatch-input` 拒绝后不移动、不改写、不删除任何产物；恢复动作归编排器。
- **合法缺席与漏传必须可区分**：`overall` 面的 `INPUT_SPEC`、`single-spec` 面的 `INPUT_OVERALL` 是「没有这一格」，不是「可有可无」。
- **边界**：`render/templates.ts` 的形状重构属 P39（god objects 分波次拆），本相位只改声明与门，不拆类。

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-17 | 初稿：grilling Q1–Q27 裁定落成正文——两维声明 `{absent, requiredOn}` 与真值表 · 表本体（按功能面推，不按今日取值）· 纯读门与门序、报文原因闭集 · 三处行为反转与「其余惰性」主张 · `none` 为渲染字面量 + shell 半句 · 逐格成对 + 穷尽性断言（不写快照、不加 census）· `scratch/` 四 shell 与结构不可见 · 章程三项回填（⑤ 降样本行 · ⑥ 三→四 · 两维改名） | Oscaner M. · Claude（kairos:cdd-spec-writer · 2026-11-17） |
