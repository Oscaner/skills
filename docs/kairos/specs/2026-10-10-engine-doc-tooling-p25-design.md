---
title: 引擎文档工具（Engine Doc-Tooling）— P25 设计：写回判定的单源（`#bookkeep` ⇄ `#recordsOf`）
doc-type: phase-spec
version: v0.10
date: 2026-11-05
slug: 2026-10-10-engine-doc-tooling-p25
program: 2026-10-10-engine-doc-tooling
author: "[human] · Claude（kairos:cdd-design [P25] grilling → 本会话落 spec · 2026-11-05）"
---

## Design

本相位治一处**同族残余**：「哪些轮会写 reviewed identity、写到哪条腿」这件事在引擎里有**两份实现**。真实记账 `session/run.ts#bookkeep`（`:746-748` 的 phase 白名单 + `:749-752` 的 target kind 三分支）与 dry-run 预览 `face/preview.ts#recordsOf`（`:159` 的同一份 phase 字面量 + `:172-178` 的 `#reviewedLegOf`）各存一份。

**一句话的病根**：这是 P24 治过的「第二套逻辑」在**预览面**的残余。P24 收掉了板面的 frontier、收掉了胶囊的 hop 装配，但没有收这一份——因为它比前两个更隐蔽：两处**物理上无法共用同一条判定**（`#bookkeep` 还乘了 `record.verdict.targetAction`，dry run 手里没有 verdict），于是「各自写一份」看起来像是不得已。

**它今天造成的实际风险**：P24 把 `fix` 加进白名单时必须同时改两处；漏一处，预览就少报一条本相位引入的写，**而没有任何门会红**。`face/__tests__/preview.test.ts:148-164` 的 fix 轮用例只是**行为 pin**（钉预览侧当前输出），不是漂移探针——两处今后不同步改动，它不会红。

**边界（本相位不越的线）**：不改 `#bookkeep` 的记账内容与顺序 · 不改预览的 `render` 面与行序 · 不改 `targetAction` 的语义 · 不引入第二套 kind → 腿映射 · **§1–§5 不动任何 `next:` / `reason:` 字节**（§6 是明确划出的例外：fresh plan 窗口内 `next:` 与 `reason:` 各一行改变，逐字见 §6「改动的字节」） · 不改 `Ledger` 的 `recordReviewedRevision` 签名。

### 1. 缺口（取证）

#### 1.1 两份实现，逐字对照

| | 真实记账（`session/run.ts`） | dry-run 预览（`face/preview.ts`） |
|---|---|---|
| phase 白名单 | `:746-748`：`record.verdict.targetAction && (frame.phase === "review" \|\| frame.phase === "branch-review" \|\| frame.phase === "fix")` | `:159`：`if (frame.phase === "review" \|\| frame.phase === "branch-review" \|\| frame.phase === "fix")` |
| kind → 腿 | `:749-752`：`plan`/`spec` → `#recordReviewedDocRevision`；`wave` → `#recordReviewedWaveBrief`；`branch` → `#recordReviewedBranchRevision` | `:172-178` `#reviewedLegOf`：`wave` → `"reviewedRevision(brief)"`；`plan`/`spec` → `"reviewedRevision(doc)"`；`branch` → 有 plan path 才 `"reviewedRevision(doc)"`，否则 `null` |

两处对**同一组事实**各写一遍，且**顺序还不一样**（记账侧 doc 分支写在 wave 之前，预览侧 wave 写在 doc 之前）——这正是复制会漂移的典型征兆。

#### 1.2 为什么「无法共用」是个错觉

看起来不可共用的是**verdict**，不是判定本身。判定实际是两个正交问题：

1. **这一轮的 phase 允不允许写**——纯函数，只看 `phase`（`RoundPhase`：`implement` · `review` · `branch-review` · `fix`）；
2. **这个 target kind 写到哪条腿**——纯函数，只看 `kind`（`branch` 另需 plan path 这一**输入**，不是判定）。

`targetAction` 是**运行时结果**，它守的是「这一轮算不算完成」，与「写哪条腿」正交。把它塞进判定只会让签名撒谎（dry run 必须传一个恒 `true` 的假值）。

### 2. 定案：判定的形状与家

**形状**（grilling Q1 裁定）：返回值是**腿类型**而非布尔——

```ts
type ReviewedLeg = "doc" | "brief" | "branch";
class ReviewedIdentity {
  static legOf(phase: RoundPhase, kind: AuditTarget["kind"]): ReviewedLeg | null;
}
```

三条腿与记账侧三个写方法**一一对应**：`doc` → `#recordReviewedDocRevision`（`plan` / `spec` 两个 kind 共用这条腿，doc 路径从 `frame.target.doc` 取）· `brief` → `#recordReviewedWaveBrief` · `branch` → `#recordReviewedBranchRevision`（读 `#planPath`）。`branch` 独享一条腿名而不是并进 `doc`，因为「有没有 plan path」是调用方的**输入**：`legOf` 只回答「写 branch 腿」，写不写由调用方按输入决定。记账侧因此是 `switch (leg)` 的 1:1 派发，**派发点不再残留任何 kind 分支**（三个 `#record…` 方法保留各自的**类型收窄守卫**——`#recordReviewedWaveBrief` 的 `frame.target.kind !== "wave"`、`#recordReviewedDocRevision` 的 `plan` / `spec` 守卫——它们是类型收窄，不是判定）；预览侧把 `doc` 与 `branch` 都渲染为 `reviewedRevision(doc)`、`brief` 渲染为 `reviewedRevision(brief)`——消费面字节不变。

**参数类型必须写准**：

- `phase` 是 `RoundPhase`（`session/ledger.ts:71` = `OpType | "branch-review"`，`OpType` = `implement` · `review` · `fix`）。不是 `op`——`op` 是 `OpType`，装不下 `branch-review`。
- `kind` 是 `AuditTarget["kind"]`（`session/run.ts:73-80` = `wave` · `branch` · `plan` · `spec`）。**不是 `TargetType`**（`session/faces.ts:26` = `phase-spec` · `overall` · `plan` · `single-spec` · `wave` · `branch`——没有 `spec` 成员，且三个文档形状不是判定所 switch 的 `plan` / `spec` 两个词）。
- 两个调用点今天分支的就是这两个值：`#bookkeep`（`run.ts:749-752`）与 `#reviewedLegOf`（`preview.ts:172-178`）都判 `frame.target.kind`，故两处都传 `frame.phase` 与 `frame.target.kind`。把 `frame.target.type` 传进去既不过类型检查，也只会诱出第二张 type → 腿映射表（边界线禁止）。
- **未列出的 kind 一律 `null`**（保守链）：目标联合将来长出新成员时两面以同一方式「不写」，绝不落成一次 doc 写回——这是 `preview.ts:165-171` 今天的 docstring 已经许诺的行为，本相位保留它，并**为它补 pin**（矩阵碰不到这一格：矩阵只枚举四个合法 kind 且禁止调 `legOf`）：`reviewed-identity.guard.test.ts` 直调 `legOf`，断言越界 kind（`"bogus" as AuditTarget["kind"]`）与 `implement` 相位下的四个合法 kind 全返回 `null`；另加一道**纯度文本门**证明判定不读 `targetAction` / plan path（§3）。
- phase 白名单以**声明常量** `REVIEWED_WRITE_PHASES` 落在判定文件里，只声明一次（§3 门 2 的断言对象）。

`null` = 这一轮 / 这个 target 不写。返回腿类型一次性覆盖「写不写」与「写哪条」两问；若返回 `boolean`，调用方还得各自再判一次腿，等于把刚合并的东西又劈开——预览面 `#reviewedLegOf` 的重复正源于此。

**家**（grilling Q2 裁定）：新增 `session/reviewed-identity.ts`。理由：`Ledger` 已 **1709 行 / ~88K 字节**，不该再塞判定；`session/run.ts` **990 行 / ~50K 字节**且是 lifecycle 实体，让 `face/` 平面的预览面从一个 lifecycle 文件 import 静态会制造不必要的跨面耦合。新文件极小，两面都 import 它，依赖方向干净。

**verdict 的归属**（grilling Q4 裁定）：判定只收 `(phase, kind)`；`targetAction` 留在 `#bookkeep`。这处**不对称必须显式记在判定旁边**，不写清就会被后人当成遗漏补齐。

**不对称不止一处**：`targetAction` 之外还有一处**既有**且被字节冻结的差异——`wave` 目标在 `planPath === null`（或 brief 不可渲染）时，真跑 `#recordReviewedWaveBrief` **什么都不写**，预览 `:173` 却无论有无 plan path 都陈述 `reviewedRevision(brief)`。§3 把两处一起登记并说明矩阵如何对待它们（不要把它当「两面唯一的合法差异」）。

**plan path 的归属**：`branch` 的「有没有 plan path」是**输入**不是判定，仍由调用方各自提供（记账侧 `#planPath`、预览侧 `#scene.planPath`）；`legOf` 只回答「branch 写 branch 腿」（渲染成 `reviewedRevision(doc)`）——这就是 `branch` 在腿类型里独享一名、而不是与 `plan` / `spec` 合为 `doc` 的原因。

### 3. 定案：双面证据（缺一不可）

**矩阵行为断言**：三轴逐格、**三值**比对——每个可达格断言 `left == right == expected`：`phase`（四个 `RoundPhase` 全列）× `kind`（`wave` · `branch` · `plan` · `spec`）× `planPath`（有 / 无）。

- **`expected` = 手写的 oracle 表**：下表「期望腿」列就是断言的一部分——一张在用例里**手写**的常量表（`phase × kind × planPath` → 腿），**不从 `legOf` 推导、不 import 判定文件**；左右两侧各自与它逐字比。
- **`left` = 预览面的真实输出**：逐相调 `Preview#render(op, frame)`（`preview.test.ts` 既有做法），读 `would record:` 行里的 `reviewedRevision(doc|brief)`。**不用单条 `cdd fix --dry-run`**——它只跑 fix 面，`implement` / `review` / `branch-review` 三相取不到。
- **`right` = 真跑一轮后的账本事实**：真跑一个**完成**轮（`record.verdict.targetAction === true`），再读账本上绑定的身份。**判据是哈希，不是 kind**：`fix` 格的右侧断言 `reviewedDocRevisionOf(<key>)?.doc_hash === sha1(<该轮判断输入的当前内容>)`（wave 面同形：`reviewedRevisionOf(<waveKey>)?.brief_hash === sha1(<该轮渲染出的 brief>)`）。理由是 `fix` 轮**绕过已完成的 review 轮**到达，而那条 review 已经用同一个 key、同一个 ref kind 绑过一次——「fix 的写回被丢掉」在 `reviewedRevisionOf(key).kind` 上**恒为绿**，根本看不出来；哈希才回答「写回停在哪一轮」。因此夹具必须让 fix 轮的判断输入与 review 轮**不同**（改写被审的 plan / spec；wave 面改写该 wave 的任务段或 plan 的 `## Constraints`，让渲染出的 brief 变），并**先**断言两侧哈希不相等——输入没动，该格就是空洞的，必须响亮失败而不是静默变绿。`review` / `branch-review` 格保持 kind 判据（它们的上一轮不是同 key 的绑定）。夹具还需给出**可渲染的 plan / brief**（`planPath` 及其任务的 brief 源）——否则真跑侧落入「输入不可读 / 无 plan fact」的既有分支，测的就不是判定。
- **两面都不许走 `legOf`**：否则用例只证「同一函数被调了两次」。

**为什么是三值而非只比左右**：重构后两面都流经 `legOf`，只做 `left == right` 能抓的只有**每面适配器**（渲染映射、`switch (leg)` 派发）的漂移——`legOf` 自己返回错值，两侧一起错，仍旧全绿。手写 `expected` 把判定本身也钉住：`fix × spec` 若被判成 `brief`，`left` 与 `right` 一起漂而都不等于 oracle 的 `doc`，用例红。于是分工是——**矩阵证「两面同值，且值与手写 oracle 一致」**，**结构门证「单源」**。

派发形状由 `faces.ts` 的 `product.reviewLead` 定（branch 线的 review 领队是 `branch-review`，其余线是 `review`；`implement` 只在 wave 线上派发），故可达格是（「期望腿」列即 oracle 取值）：

| 相位 | 可达 kind | 期望腿（`planPath` 有 / 无） | 今日 pin |
|---|---|---|---|
| `implement` | `wave` | 无腿 / 无腿 | `preview.test.ts:101` |
| `review` | `wave` | `brief` / **不对称 ②**（见下） | `:79` |
| `review` | `plan` · `spec` | `doc` / `doc` | `:122` |
| `fix` | `wave` | `brief` / **不对称 ②** | — |
| `fix` | `plan` · `spec` | `doc` / `doc` | `:162` |
| `branch-review` | `branch` | `doc` / 无腿 | `:144`（`planPath` 有）· **`planPath` 无的一格今日无 pin，本相位补** |
| `fix` | `branch` | `doc` / 无腿 | — |

**跳过格**（派发不产生，用例里显式列名 + 原因，不静默省略）：`implement × branch|plan|spec`（`implement` 只在 wave 线派发）· `branch-review × wave|plan|spec`（`branch-review` 只在 branch 线派发）· `planPath` 轴对 `plan` / `spec` kind 无意义（同格，不重复断言）。

**两处已登记的不对称**（§2 已订正：不是「唯一一处」）：

1. **`targetAction`**——真跑独有：`BLOCKED` / `TIMEOUT` / 硬失败的轮 `targetAction` 为假，`#bookkeep` 不写；dry run 手里没有 verdict，恒陈述「完成轮会写的那条腿」。
2. **`wave` + `planPath === null`（或 brief 不可渲染）**——**既有、且被字节冻结**（`preview.test.ts:79` 不重锚）：真跑 `#recordReviewedWaveBrief` 什么都不写，预览 `:173` 仍陈述 `reviewedRevision(brief)`。本相位**保留**它。故该格是三值断言里的**唯一例外**：`expected` 腿登记为「不对称 ②」，断言 `left` = `reviewedRevision(brief)`、`right` = 无写回（两侧各自对上登记值），而不是要求三者相等，也不当矩阵失败。

**结构门（两条，今日必红）**：新增 `packages/cdd-engine/src-next/session/__tests__/reviewed-identity.guard.test.ts`，照 D26 先例（`session/__tests__/wave-line-phase.guard.test.ts`：门是一条可红的断言，不是散落注释）：

1. **白名单消失门**：`frame.phase === "branch-review"` 字面量在两文件的出现数各为 **0**（实测 `preview.ts:159` 与 `run.ts:747` 各一处 ⇒ **今日红——这条就是「今天就有两份」的证明**；改完转绿；加回副本即重新红）。`run.ts:844` 的 `phase === "branch-review"` 是无关的相位归一（不带 `frame.`），**不计入**此门。
2. **声明单源门**：扫 `packages/cdd-engine/src-next/**/*.ts` 并**排除 `__tests__/`**（门自身的 pattern 串住在那里，排除后才不会自匹配），统计匹配 `(export )?const REVIEWED_WRITE_PHASES\b` 的行数，断言**恰为 1**，且该声明落在 `session/reviewed-identity.ts`（只扫本文件恒为 1、检不出「别处又声明一份」；`src-next` 全域扫才成门）。今日无此声明 ⇒ 今日红。

**保守链与纯度的 pin（两条，同在 `reviewed-identity.guard.test.ts`）**：矩阵只枚举四个合法 kind 且不许调 `legOf`，故「未列出的 kind 一律 `null`」与「判定只收 `(phase, kind)`」这两件事矩阵**证不到**，各补一条：

1. **运行时 pin**：直调 `ReviewedIdentity.legOf`——`legOf("review", "bogus" as AuditTarget["kind"])` 返回 `null`，且 `implement × {wave, branch, plan, spec}` 四格全为 `null`（前者钉保守链的落点，后者钉「相位不在白名单即不写」）。禁止调 `legOf` 的禁令只约束矩阵文件，不约束本文件。
2. **纯度文本门**：读 `session/reviewed-identity.ts`，**先剥掉注释**再断言——(a) 无 `from "node:fs"`、无 `readFile` / `readFileSync`（判定不读文件）；(b) 对 `./run.ts` / `./ledger.ts` 的 import 全是 `import type`（不取运行时值，故拿不到账本）；(c) 剥注释后的代码里不出现 `targetAction` 与 `planPath` 两个词。剥注释是必须的：§4 要求旁注**点名**这两项不属于判定，不剥注释的门会与那条要求自相矛盾——门管的是**代码**不读它们。

**为什么删掉了「调用门」**（评审第 2 轮 W2 的裁定，写下来免得后人当成遗漏）：文件级的「两文件各至少一处含 `ReviewedIdentity.legOf(`」**可被一句 docstring 满足**——而 §4 恰恰要求把陈旧 docstring 指到 `ReviewedIdentity`；改成「锚到方法体」的文本抽取则脆弱易误判（方法体一重组就假红）。**一个可能是死的门不如不留**：删掉后，单源由门 2 承担；矩阵承担的是「两面**同值，且值与手写 oracle 一致**」，**不是**「只有一份」——一面若留着一份**当前恰好正确**的私有副本，它照样取得 oracle 的值、矩阵照样绿；能抓这种副本的是**白名单消失门**，而那道门对换成 `Set` / `includes` / 单引号写法的副本无效（限度见下段）。故正确说法是「删掉调用门后，覆盖**恰好**落在门 1 与门 2 的真值域内」，而不是「覆盖没有缺口」。

**该门的限度（如实写出，不声称「拦住一切」）**：两条门读的是**字面量原文**（含注释文本）。把白名单改写成 `includes([...])` / `Set` / 单引号的副本可以同时绕过两条门——矩阵测的是**同值**，副本今天同值就绿。故它今天仍是一颗**漂移种子**：一旦有人只改一面，矩阵会因三值断言而红，但**那一刻才红**，单源本身没有静态证据。本相位不为它加更强的静态分析（AST / 类型级）——限度留在这里，作为后续相位的事实。

**为什么两条都要**（这条必须写进 spec，否则后人会以为一条就够）：

- **矩阵单独不够**——有人把列表原样抄一份，两份一致，矩阵仍然全绿。它测的是「两面**同值且值对**」，不是「只有一份」。
- **结构门单独也不够**——它证明「白名单只剩一处」，证明不了**值是错的**：`legOf` 自己判错时两条门照绿（这一半由矩阵的 `expected` 腿接住）。
- 两条合起来才封住：矩阵证「两面**同值且值对**」，结构门证「**单源**」。

**字节零变（限 §1–§5）**：写回判定单源化不触碰任何消费面字节——`cdd fix --dry-run` 与真跑的输出与今日逐字节相同，本真值域只覆盖写回判定的消费面。`preview.test.ts:79` / `:101` / `:122` / `:144` / `:162` 五条既有 `would record:` 断言**不重锚**——这是纯重构的判据。**§6 不在此判据内**：它改动 fresh plan 窗口的板面/胶囊 `next:` 与 `reason:` 两行（§6「改动的字节」）；把 §6 也算进「字节零变」会让本 spec 自相矛盾。

### 4. 落点、依赖与发行

| 面 | 文件 | 落点 |
|---|---|---|
| 判定本体 | `session/reviewed-identity.ts`（新增） | `ReviewedIdentity.legOf(phase: RoundPhase, kind: AuditTarget["kind"]): ReviewedLeg \| null`；声明常量 `REVIEWED_WRITE_PHASES`；旁注写明 `targetAction` 与 plan path 两项**不属于判定**的输入，并登记 §3 的两处不对称 |
| 真实记账 | `session/run.ts` | `:746-748` 的 phase 白名单与 `:749-752` 的 kind 三分支改调 `legOf`；`#recordReviewedDocRevision` / `#recordReviewedWaveBrief` / `#recordReviewedBranchRevision` 保留（它们做的是**写**，不是判定） |
| 预览 | `face/preview.ts` | `:159` 的 phase 字面量与 `:172-178` 的 `#reviewedLegOf` 改调 `legOf`；`#reviewedLegOf` 退化为「腿 → 字符串」的渲染映射（或直接内联），**不再持有 phase 白名单或 kind 三分支** |
| 陈旧的旁注 | `face/preview.ts` · `session/run.ts` | 同笔改写三处将变假的注释：`preview.ts:147-154`（`#recordsOf` 的「a SECOND copy … kept apart on purpose」段）· `preview.ts:165-171`（`#reviewedLegOf` 的链描述）· `run.ts:726-745`（phase 门与三分支的内联叙述）——三者改指向 `ReviewedIdentity`，并保留 `targetAction` 与 null plan path 的事实；叙述按**相位名字**（“review / branch-review / fix”），**不复述** `frame.phase === "branch-review"` 这类比较式字面量——白名单消失门计的是字面量原文（含注释），复述一句会把门留在红 |
| 流水线前沿 | `session/pipeline.ts` | `#waveState`（`:209-223`）增**面级**进入判据（§6）：设 `entered` = 该 plan 推出的任一 wave key 上 `roundCount(implement + review + fix)` 之和 > 0；为假时 `active`（`:219`）**与** `target`（`:220-221`）**同时**为 `null`，为真时二者照旧；并同步改述文件头 `:19-33` 的规则说明——「未进入」不再只等于「文档缺席」 |
| 测试 | `session/__tests__/reviewed-identity.matrix.test.ts`（新增）· `session/__tests__/reviewed-identity.guard.test.ts`（新增）· `face/__tests__/preview.test.ts` · `session/__tests__/run.test.ts` | **矩阵只有一个家**：`reviewed-identity.matrix.test.ts` 持手写的 oracle 表 + `left == right == expected` 三值断言（左侧自建 `Preview`，右侧复刻 `run.test.ts` 的 runner double 真跑一轮——`session/__tests__` 早已 `../../face/*` 跳面 import）· `reviewed-identity.guard.test.ts` 持两条结构门（§3）+ **两条验收文本 pin**（`#bookkeep` 方法体内零 `frame.target.kind ===` · `reviewed-identity.ts` 对 `./run.ts` / `./ledger.ts` 的 import 必须走 `import type`；它们是验收 pin，**不计入** §3 的两条结构门）+ **保守链的两条 pin**（§3：直调 `legOf` 的「越界 kind / `implement` 全 `null`」断言 · 剥注释后的纯度文本门）· `preview.test.ts` **只保留**五条既有 `would record:` 断言（不重锚、不搬），加一条 `branch` + 无 plan path 的新 preview pin · `run.test.ts` 不动（矩阵不复用它已有的用例，只照其夹具形状）· **§6 的 pin 家**：`session/__tests__/pipeline.test.ts`（session 面裁决 + 孪生回归 + 多批次三格）· `face/__tests__/board-view.test.ts`（板面 `next:` / `reason:` 两行的字节，照 P24 T7 (b1)「一个装配、两面渲染」的形状）· `face/__tests__/capsule.test.ts`（胶囊 `next:` / `reason:` 行） |
| 发行 | `.changeset/p25-one-write-back-judgment.md`（新增） | `@oscaner-skills/cdd-engine` **minor** 一条（§1–§5 纯重构 + §6 消费面字节变化，D74 取 minor） |

**为什么是类而非箭头常量对象**：判定的白名单是一条**声明常量**，而矩阵与结构门都必须指向**同一个具名家**；`ReviewedIdentity` 这个名字让守卫、调用点与之后的相位都锚在同一处，一个零状态的箭头常量对象只会把 `legOf` 藏进匿名字面量。判定只有一个静态方法，故按仓先例（`faces.ts` 的 `TargetFaceTable`）加 `// biome-ignore lint/complexity/noStaticOnlyClass: the judgment is one named contract shared by two faces — an arrow-const object would hide the single source from the structural gate`。

**依赖**：P24 已 Done（`P24 -> P25` hard，本相位不依赖 P24 的产物，只依赖其闭合后的树——那里的 `fix` 白名单正是本相位要收的那一份）。

**发行**：`@oscaner-skills/cdd-engine` **minor**（`.changeset/p25-one-write-back-judgment.md`）——§1–§5 的写回判定单源本身是纯重构（零字节变化），但 §6 改变 fresh plan 的板面/胶囊输出（`implement` → `route to /skill:cdd-dev skill`），属**消费面可见字节变化**；按 D74 取 minor（方法论契约未变，故不是 major）。零新命令、零新旗标。§4 的落点表发行行与 Acceptance 同写 **minor**——本版三处不再出现 `patch`。

### 5. 非目标

- 不做「预览面与真跑共用**整条** `#bookkeep`」——两者差一个 verdict，合并会把 dry run 变成真跑的形状。
- 不改 `recordReviewedRevision` / `recordReviewedBrief` 的签名或写回时机。
- 不给判定加第二个入参（如 `completed`）——那是把运行时结果泄进纯判定。
- 不顺手改 `preview.ts` 的其它重复（例如 `reads:` 行的路径来源）——不在本相位证据面内。

### 6. 定案：wave 面的「未进入」不得编码成 active hop

**缺口**：`Ledger#waveLineRoute` 在**零完成 implement** 时返回 `{ kind: "next-wave", tasks }`（`session/ledger.ts:957-958`）。这个返回对**线视角**是对的——「这条波该派发了」。但 `PipelineFrontier` 把它当**该面已进入**的证据：

- `PipelineFrontier#next` 规则 ①（`pipeline.ts:100-101`）：frontier 面**有 active hop 时优先渲它**，面到面的 handoff 让位；
- 于是 plan 刚收口时，frontier 落在 wave 面、其 active 非 null ⇒ 渲 `implement --plan … --tasks N`；
- 而 `PIPELINE_NEXT.plan` 的面到面出口是 `{ kind: "ref", ref: "kairos:cdd-dev" }`（`session/next.ts:107-114`）——**这一面被挤掉了**。

**实案**：P24 全程只在**波次全部耗尽**之后才印出 `route to /skill:cdd-dev skill`；plan 刚收口那一跳一律印 `implement`。kairos 链的契约是 `plan → cdd-dev`（dev 技能负责 base 解析、批准门与 implement/review/fix 的整链），故这个面不该只在耗尽后出现。

**这是同一族第三次**：一个值被用来表达两件事——

| 值 | 今天同时表达 | 应当分开 |
|---|---|---|
| `Route.kind === "next-wave"` | ①「这条线的下一跳」②「这个流水线面已进入」 | 线视角保留 ①；面视角需要 ② 的**独立判据** |

（前两次：§2 的 `drift` 一值驱动「路由替换」与「原因 cell」；P24 §12 前的 `nextLineOpen` 惰性格。）

**定案**：`PipelineFrontier#waveState`（`session/pipeline.ts:209-223`）给 wave 面加一道**面级**进入判据，并且**同时**作用在 `active` 与 `target` 上：

- `entered === false` ⇒ `active = null`（`:219`）**且** `target = null`（`:220-221`）；
- `entered === true` ⇒ 照旧：`active = waveLineRoute(waveKey)`（可为 `null`）、`target = { type: "wave", id: waveKey ?? "", plan: planPath }`。

**为什么两格都要置 `null`**（评审第 4 轮 B1）：只把 `active` 置 `null` 会落进 **`#next` 的规则 ②**（`pipeline.ts:102-107`：`active === null && target !== null` ⇒ 渲该面**自己的**出口），而 wave 面的自有出口是 `PIPELINE_NEXT.wave` 的字面量 `review --type branch --plan <plan>`（`session/next.ts:112`）——比今天更糟。`active` 与 `target` 同时为 `null` 才落进**规则 ③**（`pipeline.ts:108-117`：frontier 未进入 ⇒ 渲**前一个已进入面**的出口），即 plan 面的 `PIPELINE_NEXT.plan` = `{ kind: "ref", ref: "kairos:cdd-dev" }`。故正确的裁决是：`face === null`（规则 ③ 是交换规则，`face` 归锚面）、`route = { kind: "handoff", entry: PIPELINE_NEXT.plan }`、`target = { type: "plan", id: planPath, plan: planPath }`。

**进入判据（面级，不是 wave key 级）**（评审第 4 轮 B2）：判据必须问「这个**面**进过没有」，不能问「当前这个 wave key 有没有轮」——`#waveKeyOf`（`:240-243`）返回的是**就绪批次**（`graph.frontier(closedWaves()).join(",")`）：batch 1 收口后 batch 2 才成为就绪批次、它自身轮数为 0，按 key 判会把每一个批次间隔误判成「未进入」并退回 cdd-dev，多批次 plan 全程只剩 handoff。故 `entered` 定义为：

> 对 `TaskGraph#batches()` 推出的**每个** batch 取其 wave key（逐 batch `join(",")`，与 `#waveKeyOf` 的拼法同源），只要**任一** key 满足 `roundCount(key, "implement") + roundCount(key, "review") + roundCount(key, "fix") > 0`，该面即已进入。

用既有的 `Ledger#roundCount`（`session/ledger.ts:716-719`，DISTINCT cycle 计数，**含失败尝试**），**不加新 API**；不取 `completedCycles`，因为「派发过但被 BLOCKED」也算已进入（面不该退回去重交一次 handoff）。零 batch 的 plan（无任务块）与无 plan graph 同等落进「未进入」——那是同一个事实：这一面从未进入。

**`LedgerKey` 与 identity 的拼法（评审第 5 轮 N1）**：三次读数写成 `roundCount(key, mode)`——**不传第三参**，`identity` 取默认 `null`。`key` 是该 batch 的任务 id 用 `,` 拼成的字符串（`LedgerKey = number | string` · `ledger.ts:291` · 与 `#waveKeyOf` 的 `frontier.join(",")` 同拼法），`mode` 逐次取 `"implement"` / `"review"` / `"fix"`。这与 `waveLineRoute` 读的是**同一个形态**（`ledger.ts:957`：`completedCycles(waveKey, "implement")` 同样不带 identity），也与 `closedWaves()` 落的那一行一致——`rowFor` 只按 `row.wave === String(key)` 找行（`ledger.ts:652`），identity 只在退役 `spec` 行的兼容回退里被读（`:659-662`），永远匹配不上一个 batch key。故「同一行」由**拼接拼法 + 省略 identity** 两件事保证；实现里不得把 `frame.type` 之类的文档类型字样当 identity 传进来。

**不变的是什么**：四条面序规则的**文本**、`#next` 的判定顺序、`PIPELINE_NEXT` 表、`waveLineRoute` 的返回值都不变；变的是 wave 面 `target` 是否在场这一**输入**，于是同一个 frontier 从规则 ① 改走规则 ③。文件头 `pipeline.ts:19-33` 今天把「未进入」写成「no target — an absent doc」，同笔改成「no target：文档缺席，**或**该面自己的进入判据未成立」，否则注释与代码各说一套（`#lastEnteredIndex` 的 docstring `:268` 同口径）。

**改动的字节（逐字，只在这个窗口内）**：窗口 = plan 已收口 + 有任务图 + 该 plan 的 wave 面零轮记录。窗口内板面与胶囊的两行改变：

- `next:` —— `implement --plan <plan> --tasks <N>` ⇒ `route to /skill:cdd-dev skill`（宿主 `claude` 为 `route to /kairos:cdd-dev skill`）；
- `reason:` —— `task-open` ⇒ `closed-line`（规则 ③ 的 route 是 `handoff`，`NextStepRouter#reasonOf` 把 `handoff` 族落进 `closedLine`）。

窗口外（任一 wave 轮已记账，或 frontier 已走到 branch 面）两个面逐字节不变。

**证据（必红 → 绿）**：

- **裁决格**（`session/__tests__/pipeline.test.ts`）：spec 与 plan 各记一条零 findings 的 review 收口 + 该 plan 的任务图 + wave 面零轮记录 ⇒ 断言 `next().face === null`、`next().route` = `{ kind: "handoff", entry: PIPELINE_NEXT.plan }`、`next().target` = plan target。**今日渲 `face === "wave"` / `{ kind: "next-wave", tasks: "1" }` / wave target，必红**。
- **渲染格**（`face/__tests__/board-view.test.ts`，照 P24 T7 (b1) 的形状：一个 `hopOf` 同时喂板面与胶囊）：`rows.next === "route to /skill:cdd-dev skill"`、`rows.reason === "  reason:  closed-line"`，胶囊末两行 `next: …` / `reason: …` 同值（`face/__tests__/capsule.test.ts` 持同形 pin）。**今日为 `implement --plan … --tasks N` + `reason:  task-open`，必红**。

**孪生回归**：同一夹具里记一条 wave 轮（哪怕其 verdict 使 `targetAction` 为假）之后，`next()` 恢复 `face === "wave"` 与 `active = waveLineRoute(waveKey)`，渲染回到 `implement` / `review` 字面、`reason:` 回到 `task-open`（面已进入，handoff 不再出现）。

**多批次 pin（专抓「按 key 判进入」的实现）**：`planDoc([[1], [2]])` 上记一条 wave-1 轮并让 wave 1 收口 ⇒ 就绪批次的 key 已是 `"2"`、它自身轮数为 0；断言 `next().face === "wave"` 且 `route = { kind: "next-wave", tasks: "2" }`（板面即 `implement --plan … --tasks 2`）。按 key 判进入的实现会在这一刻退回 cdd-dev，此格必红。

**既有 pin 的重锚（如实登记，不静默改绿）**：`pipeline.test.ts:139-151` 的「规则 ② —— plan 无任务块 ⇒ wave 面持 target 并交 `PIPELINE_NEXT.wave`」是**零 batch** 夹具，按本判据归入「未进入」，故该用例改锚到规则 ③ 的 cdd-dev 出口（同一族的字节变化，同一个理由）；规则 ② 自身的 pin 由「已进入、而 `waveLineRoute` 返回 `null`」的夹具承担（`waveLineRoute` 的 `null` 出口在 `ledger.ts:977` · `:988`，即抽干 / soft cap）。

**发行级别**：本项**改变消费面字节**（fresh plan 的板面/胶囊 `next:` 与 `reason:` 两行），故 P25 由**纯重构**升为 **minor**（D74：消费面可见字节变化即 minor；方法论契约未变）。§4 的落点表发行行、§4 的发行段与 Acceptance 一律写 **minor**，本版三处不再出现 `patch`。

**非目标**：不改 `waveLineRoute` 本身的返回值（线视角不看这道进入判据）· 不改 `#next` 的四条面序规则与 `PIPELINE_NEXT` 表（规则 ③ 的重判来自 `target` 缺席这一**输入**，不是规则改写；规则文本只在文件头按「未进入」的新定义改述）· 不动 `branch` 面。

### Acceptance criteria

- `ReviewedIdentity.legOf(phase: RoundPhase, kind: AuditTarget["kind"]): ReviewedLeg | null` 是「写不写 + 写哪条腿」的**唯一实现**；`#bookkeep` 与 `#recordsOf` 都调它——两处传的是 `frame.phase` 与 `frame.target.kind`（今天分支的就是这两个值：`run.ts:749-752` · `preview.ts:172-178`），未列出的 kind 一律 `null`。
- **矩阵用例（禁止调用 `legOf`）**：`phase × kind × planPath` 三轴逐格、**三值**（可达格与跳过格见 §3 表），**`expected` 取用例里手写的 oracle 表**（不从 `legOf` 推导、不 import 判定文件），**`left` 取预览面的真实输出**（逐相 `Preview#render(op, frame)` 的 `would record:` 行中的 `reviewedRevision(doc|brief)`），**`right` 取真实记账后的账本事实，判据分型（与 §3 一致，不是「每格都比哈希」）**：**`fix` 格比哈希**——完成轮后账本绑定的 `doc_hash` / `brief_hash` 等于**该轮判断输入的当前内容哈希**（`fix` 轮越过一个已绑过同 key 的 review 轮，只比 ref kind 时「fix 写回被丢掉」恒绿）；**`review` / `branch-review` 格比 ref kind**——它们的上一轮不是同 key 的绑定。两面都不许走 `legOf`，否则用例只证「同一函数被调了两次」。矩阵住在 **`session/__tests__/reviewed-identity.matrix.test.ts`（单一新文件）**。**今日为何不会红、本相位之后靠什么红**：今天两面恰好一致且判定不错，故三值断言今日**是绿的**——它能红的是**未来只有一面被改**或**`legOf` 自己判错**（后者是只比左右拦不住的）；`wave` + 无 plan path 一格按**已登记不对称**断言（两侧各自对登记值），`branch` + 无 plan path 一格**新增 pin**。
- **结构门（两条，今日必红）**：`session/__tests__/reviewed-identity.guard.test.ts` 的**白名单消失门 / 声明单源门**（§3）——今日 `frame.phase === "branch-review"` 在 `preview.ts:159` 与 `run.ts:747` 各一处 ⇒ 白名单消失门必红；改完转绿；把副本加回去即重新红；声明单源门今日无声明亦红，门得恰好一处声明在 `session/reviewed-identity.ts` 后转绿。第三个「调用门」已按评审第 2 轮 W2 **删除**，理由写在 §3（文件级调用匹配可被一句 docstring 满足，宁可无门不要死门）。限度（换一种写法的副本可绕过）已在 §3 写明。
- **wave 面的「未进入」与规则 ③（§6）**：`PipelineFrontier#waveState` 的进入判据是**面级**的（该 plan 任一 batch 的 wave key 上 implement / review / fix 的 `roundCount` 之和 > 0）；`entered === false` 时 `active` **与** `target` **同时**为 `null`，于是 `#next` 落**规则 ③**、渲前一个已进入面（plan）的出口：plan 已收口 + 有任务图 + wave 零轮记录 ⇒ `next()` 为 `{ face: null, route: { kind: "handoff", entry: PIPELINE_NEXT.plan }, target: <plan target> }`，板面与胶囊渲 `next: route to /skill:cdd-dev skill` + `reason:  closed-line`（今日渲 `implement --plan … --tasks N` + `task-open`，必红）；记一条 wave 轮之后恢复渲 `implement` / `review` 字面（孪生回归）；**多批次** pin：wave 1 已收口、wave 2 自身零轮时仍渲 `implement --plan … --tasks 2`（按 key 判进入的实现必红）；`pipeline.test.ts:139-151` 的零 batch 夹具改锚到规则 ③（如实登记）。pin 家：`session/__tests__/pipeline.test.ts` · `face/__tests__/board-view.test.ts` · `face/__tests__/capsule.test.ts`。
- **保守链与纯度的 pin（两条，本轮补）**：`reviewed-identity.guard.test.ts` 直调 `legOf`——越界 kind（`"bogus" as AuditTarget["kind"]`）返回 `null`、`implement × {wave, branch, plan, spec}` 四格全 `null`；同一文件持**纯度文本门**——`session/reviewed-identity.ts` 剥注释后无文件读取（无 `node:fs` / `readFile*`）、对 `./run.ts` / `./ledger.ts` 只有 `import type`、且不出现 `targetAction` 与 `planPath`。矩阵**证不到**这两件事（只枚举四个合法 kind 且禁止调 `legOf`），不补 pin 的话「未列出的 kind 一律 `null`」只是无 pin 的声称。
- 五条既有 `would record:` 断言（`preview.test.ts:79` · `:101` · `:122` · `:144` · `:162`）**一行不改**仍绿。
- **字节口径（分节，不混说）**：§1–§5 的写回判定单源化对消费面**零字节变化**（`next:` / `reason:` / 板面行序逐字节不变，五条既有 `would record:` 断言不重锚即证据）；§6 **有意**改变 fresh plan 窗口内的两行——`next:` 由 `implement --plan <plan> --tasks <N>` 变 `route to /skill:cdd-dev skill`、`reason:` 由 `task-open` 变 `closed-line`（见 §6「改动的字节」）。`env -u AI_AGENT pnpm run validate` 退出码 0；changeset `.changeset/p25-one-write-back-judgment.md` 为 `@oscaner-skills/cdd-engine` **minor**（D74：消费面可见字节变化即 minor；本相位不改方法论契约，故不是 major）。

## Constraints

- **§1–§5 是纯重构**：写回判定的消费面字节**零变化**，五条既有断言不重锚即证据。**§6 是明确划出的例外**——它改变 fresh plan 窗口的 `next:` 与 `reason:` 两行（逐字见 §6），是本相位**有意**的消费面字节变化，按 D74 取 minor；把它读成「越界」会把 §6 判成违规。
- **判定必须纯**：`legOf` 不得读账本、不得读文件、不得接 verdict——只凭 `(phase, kind)` 回答。这条由 §3 的**纯度文本门**与运行时 pin 证，不只写在旁注里。
- **不对称显式化**：三处并存的事实必须写在判定旁边——`targetAction`（真跑独有）· plan path（输入而非判定）· `wave` + 无 plan path 时真跑不写、预览陈述 brief 腿（既有、本相位保留）。只写前两处会诱后人把第三处当遗漏补齐。
- **结构门必须可红**：§3 的**两条**门（白名单消失 / 声明单源）写定在 `reviewed-identity.guard.test.ts`，今日因 `frame.phase === "branch-review"` 各一处、且 `REVIEWED_WRITE_PHASES` 尚未声明而必红；不可红的门不算门。
- **零新依赖 / 零新命令 / 零环境变量**。

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-05 | 初稿：P25 写回判定单源——腿类型返回（非布尔）· 新家 `session/reviewed-identity.ts` · 双面证据（矩阵 + 结构零门，附「为何缺一不可」）· `targetAction` 留 `#bookkeep` 并显式登记不对称 · 纯重构、patch | Oscaner M. · Claude（kairos:cdd-design [P25] grilling → 本会话落 spec · 2026-11-05） |
| v0.2 | 2026-11-05 | **自查订正（编排器）**：原 Acceptance 说「矩阵用例在改动前的树上必红」不准确——今日两面恰好一致，「同值」断言今天是绿的。改为：**矩阵用例禁止调用 `legOf`**（左取预览真实输出、右取真跑后的账本 ref kind），它防的是「未来只有一面被改」的漂移；而「今天就有两份」由**结构零门**直接证明（今日必红）。两条各证一件事（Acceptance 两条 + Change history v0.2） | Oscaner M. · Claude（kairos:cdd-spec-writer · 自查 · 2026-11-05） |
| v0.3 | 2026-11-05 | **评审第 1 轮 fix（七条 findings 全接受）**：① `legOf` 参数类型写准——`(phase: RoundPhase, kind: AuditTarget["kind"])`，调用点传 `frame.phase` / `frame.target.kind`（`TargetType` 无 `spec` 成员，传 kind 不过类型检查）；§1.2 的 `op` 改 `phase` ② 矩阵补第三轴 `planPath` + 可达 / 跳过格表 + **两处**已登记不对称（`targetAction` · `wave` + 无 plan path），新增 `branch` + 无 plan path 的 pin ③ 结构门写成三条可红的门（调用 / 白名单消失 / 声明单源）并写明限度 ④ overall 已回填 **v3.17**（编排器落地：AC ②/③ 与 `(phase, target kind, plan path)` 措辞） ⑤ §4 补三处陈旧 docstring、changeset 文件名、`biome-ignore` 行与「为什么是类」 ⑥ change history 行统一四格 ⑦ 规模改准（`ledger.ts` 1709 行 / ~88K 字节 · `run.ts` 990 行 / ~50K 字节），「same source」统一为「同值 / 单源」 ⑧ 矩阵左侧改逐相 `Preview#render`（`cdd fix --dry-run` 只跑 fix 面） | Oscaner M. · Claude（kairos:cdd-spec-writer · spec fix 1 · 2026-11-05） |
| v0.4 | 2026-11-05 | **plan 评审第 1 轮 fix（作者裁定 W1）**：`ReviewedLeg` 由两值改三值 `"doc" \| "brief" \| "branch"`，与 `#recordReviewedDocRevision` / `#recordReviewedWaveBrief` / `#recordReviewedBranchRevision` **一一对应**——`branch` 独享一名，因为 plan path 是它的输入；记账侧 `switch (leg)` 后零 kind 分支残留，预览侧 `doc` 与 `branch` 同渲染 `reviewedRevision(doc)`（消费面字节不变）。§2「plan path 的归属」同口径 | Oscaner M. · Claude（kairos:cdd-plan · plan fix 1 · 2026-11-05） |
| v0.5 | 2026-11-05 | **spec 评审第 2 轮 fix（W1 · W2 · W3 · W4 · N1 · N2 全接受；N3 已由编排器落地）**：① 矩阵改**三值**断言 `left == right == expected`（`expected` 取手写 oracle 表，不从 `legOf` 推导）——只比左右封不住「`legOf` 自己判错」，§3 的「门和矩阵都是绿的」句随之改正 ② **删除结构门①（调用门）**并写明理由（文件级匹配可被一句 docstring 满足，宁可无门不要死门），结构门降为**两条** ③ 门②（声明单源）作用域钉死为 `src-next/**/*.ts` 排除 `__tests__/`，断言恰 1 处且落在 `session/reviewed-identity.ts` ④ §4 签名补 `\| null` ⑤ 「不再残留任何 kind 分支」改为准确说法（派发点无分支，三个 `#record…` 保留类型收窄守卫） ⑥ 矩阵单一归属 `session/__tests__/reviewed-identity.matrix.test.ts`，`preview.test.ts` 只保留五条 pin + 新 `branch` 空 plan path 一格 ⑦ N3 由编排器落地（overall **v3.18**，提交 `49b797a0`） | Oscaner M. · Claude（kairos:cdd-spec-writer · spec fix 2 · 2026-11-05） |
| v0.6 | 2026-11-05 | **plan 评审第 2 轮 fix（作者裁定 B1 · N3 同笔落地）**：① §3 的 `right` 判据由「账本 ref kind」改**哈希**——`fix` 轮绕过已完成的 review 轮到达、同 key 同 kind 已被 review 绑过，「丢掉的 fix 写回」在 kind 上**恒绿**；改为 `doc_hash` / `brief_hash` 等于**该轮判断输入的当前内容哈希**，并规定夹具必须让 fix 的判断输入与 review 不同、且先断言两侧哈希不相等（否则该格惰性）② §4 的测试行写明 `reviewed-identity.guard.test.ts` 另持两条**验收文本 pin**（`#bookkeep` 体内零 `frame.target.kind ===` · `reviewed-identity.ts` 的 import 必须 `import type`），不计入 §3 的两条结构门 | Oscaner M. · Claude（kairos:cdd-plan · plan fix 2 · 2026-11-05） |
| v0.7 | 2026-11-05 | **spec 评审第 3 轮 fix（W1 · N1 · N2 接受；N3 已由编排器落地）**：① **W1 保守链与纯度补 pin**——矩阵碰不到「未列出 kind」与「判定只收 `(phase, kind)`」这两件事（只枚举四个合法 kind 且禁止调 `legOf`），故 `reviewed-identity.guard.test.ts` 新增两条：直调 `legOf` 断言越界 kind（`"bogus" as AuditTarget["kind"]`）与 `implement × {wave, branch, plan, spec}` 全 `null`；以及**纯度文本门**（剥注释后无 `node:fs` / `readFile*`、对 `./run.ts` / `./ledger.ts` 只有 `import type`、代码不出现 `targetAction` / `planPath`）。两条同时写进 §2 · §3 · §4 · Acceptance · Constraints ② **N1** Acceptance 的矩阵右侧判据改为**分型**（`fix` 格比哈希、`review` / `branch-review` 格比 ref kind），与 §3 一致，不再读成「每格都比哈希」 ③ **N2** §3 两句过度声称改正——矩阵证的是「两面同值且值与手写 oracle 一致」，不是「只有一份」；私有而**当前恰好正确**的副本照样取得 oracle 的值、矩阵照样绿，能抓它的是白名单消失门，而该门对换字面写法的副本无效（限度照旧登记） ④ **N3** 编排器已落地（overall **v3.19**，提交 `4e1a4061`），本轮不改 overall | Oscaner M. · Claude（kairos:cdd-plan · spec fix 3 · 2026-11-05） |
| v0.8 | 2026-11-05 | **范围追加（用户裁定）**：新增 §6「wave 面的『未进入』不得编码成 active hop」——`waveLineRoute` 零完成 implement 时返回 `next-wave`，被 frontier 误读为「面已进入」，挤掉 `PIPELINE_NEXT.plan = kairos:cdd-dev` 的面到面 handoff（P24 全程只在波次耗尽后才印该 handoff）；判据改为 `roundCount` 三 op 之和 > 0；发行级别 patch → **minor**（§4 同笔）；§4 落点表与 Acceptance 同步 |
| v0.9 | 2026-11-05 | **spec 评审第 4 轮 fix（B1 · B2 · B3 · W1 · W2 · N1 全接受）**：① **B1** §6 机制重设：只置 `active = null` 会落进规则 ②（渲 wave 面自有出口的 branch 字面），故进入判据**同时**作用于 `active` 与 `target`，两者俱 `null` 才落规则 ③（渲 plan 面出口 = cdd-dev）；写明裁决 face / route / target、`pipeline.ts:102-107` 与 `:108-117` 的行锚、文件头 `:19-33` 的「未进入」定义同笔改述 ② **B2** 进入判据由 wave key 级改**面级**（该 plan 任一 batch 的 wave key 上三 op `roundCount` 之和 > 0），并补多批次 pin（wave 1 收口后仍渲 `tasks 2`）与「零 batch 夹具改锚规则 ③」的如实登记 ③ **B3** 字节口径分节：边界 / §3 / Constraints / Acceptance 四处一律归为「§1–§5 零字节」，§6 划为例外并逐字点名改变的 `next:` 与 `reason:` 两行 ④ **W1** 发行级别三处对齐 **minor**（§4 表行与 Acceptance 的 `patch` 改正） ⑤ **W2** §6 的 pin 家登记：`session/__tests__/pipeline.test.ts` · `face/__tests__/board-view.test.ts` · `face/__tests__/capsule.test.ts` ⑥ **N1** 点名规则 ③ 与「entered」的定义，并与 `pipeline.ts` 头注释对齐 | Oscaner M. · Claude（kairos:cdd-spec-writer · spec fix 4 · 2026-11-05） |
| v0.10 | 2026-11-05 | **spec 评审第 5 轮 fix（N1 接受；W1 由编排器落地）**：§6 补一节「`LedgerKey` 与 identity 的拼法」——面级进入判据的三次 `roundCount` 读数一律写成 `roundCount(key, mode)`，`key` 为该 batch 任务 id 的 `,` 拼接串（与 `#waveKeyOf` 同拼法）、**省略**第三参（`identity` 默认 `null`），与 `waveLineRoute` 的 `completedCycles(waveKey, "implement")`（`ledger.ts:957`）读同一行；`rowFor` 只按 `row.wave === String(key)` 找行（`:652`），identity 仅用于退役 `spec` 行的回退（`:659-662`），故实现不得传 `frame.type`。W1（overall P25 行 AC ④ `patch` → `minor` 与 scope ⑥ 改面级）属编排器面，本环节无权改；overall v3.21 只追加了 Change history 行，P25 行正文仍读旧值（见本轮 report 的 note） | Oscaner M. · Claude（kairos:cdd-spec-writer · spec fix 5 · 2026-11-05） |
