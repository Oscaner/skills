---
title: 'P40 · 派发前拒绝的记账面：四门并入 structure 腿 + 树级拒绝事实'
doc-type: plan
version: v0.16
date: 2026-11-18
slug: 2026-11-17-engine-doc-tooling-p40-design
base: develop
---

## Constraints

- **归属不变式**：拒绝是**树**的事实，不是轮的事实。本相位之后，任何 structure 腿拒绝都不得让 `Ledger#recordRound` 被调用一次——判据是「拒绝后 `waves[n].rounds` 长度与拒绝前相等」，不是「今天恰好没写」。
- **一条腿**：四条新行是 `session/preflight.ts#PreFlightGateName` 的第 6–9 行，不是第二条腿。`DispatchLeg` 三值闭集（`structure` / `upstream` / `line`）不动；复既有 `DispatchRefusal` 与 `DispatchAuthority#structureRefusal`，零新类型。
- **面的依赖方向**：判据抽进 `contract/`（最低层），`session/` 与 `face/` 都只向下引用；`session/preflight.ts` 不得**新增**对 `face/` 的 import——今天它已有一条 type-only 的 `import type { Words } from "../face/words.ts"`（`contract/judge.ts` 凭同一豁免引同一张词表），这条留在原处，本相位不再添第二条（环的拆除是 P39 的活）。
- **两个到期触发，各带自己的谓词**：门口清除（整条腿通过，`!parsed.dryRun`）与 `InFlight#release()` 的唯一调用点（**仅当**站立记录的站名是 `in-flight`）。后者不是豁免层——「不留豁免层」管拒绝路径，清除谓词管事实时效。
- **消费面守恒（点名，不打包）**：逐字节不变的是——五行既有 `CDD_BLOCKED` 行 · `dispatch-input` 那一行 · 既有 `crashed:` 语义 · `in-flight` 有活主那一臂的 `lock:` 面。**会变**的是：`no-host` / `carrier` / `artifact` 三行多出站名前缀（它们今天只印一句裸话）· 预览块由三门镜像收为五行预报 · board 新增两行。
- **一个值两处派生**：记录只存 `station` + 单行 `detail`（`detail` = 活判词首行剥掉站名）；活判词（多行）由命令面与预览面原样渲染。续行（`derived:` · `found:` · `identity:` · `repair:`）**永不进文件**。
- **前向声明写法**：本计划将创建的文件写在 `- Create: 路径` 行——pin 门的时间面只读这一种形状；既有文件写 `- Modify:`，往既有测试文件追加写 `- Test:`；新建测试文件同样走 `- Create:`。
- **pin 写法**：路径 + 符号，不用行号；尚未在源树出现的词汇（refusal · station 的四个新值）只进围栏块或裸词，行内反引号即成为一条落地前就红的死 pin。
- **零裸函数**：新逻辑进类（`check:no-bare-functions` 是门）；类 ≤200 行、方法 ≤4 参数；不拆 `render/templates.ts` · `face/lifecycle.ts` 的 god object（P39 的活）。
- **引擎只拒不改**：拒绝不移动、不改写、不删除任何既有产物；门的前移不得让已被写的文件变成孤儿。
- **版本级**：changeset 为 `cdd-engine` **minor**（board 新行 · 新产物 · 三行报文新增站名，均为消费面可见）。

### Task 1: `INPUT_WAVE_BRIEF` 改记「引擎写」

#### Objective
brief 是引擎自己写的格：它的名字就是答案，文件由引擎在 spawn 之前写好，所以任何路径都不做存在性读。把这条从「仅预览的按模式豁免」改成声明面上的一档 `written: "engine"`，并使构造期断言按**槽**（不是按行）守它——三张 mode 表的同一格因此共享一条判据。

#### Files
- Modify: `packages/cdd-engine/src-next/render/templates.ts`（`ContextLine` 的声明格、三处 `preview: "satisfied"` 声明、两段描述该档的注释 prose、`TemplateAssembler#assertEngineWritten`，由原 assertPreviewAnswer 改名；判槽的归约 `TemplateAssembler.engineWrittenSlots` 与它同批落地，断言消费它）
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（`#answeredByNaming` 的读取字段由 `decl.preview` 换成 `decl.written`，一行加两段注释；不换行为——实施轮实测：该字段若留到 Task 3 才换，则 `ContextLine` 的 `preview` 档与唯一的读者同时存在、声明面已无载体，预览豁免静默失效，face 侧测试在 Task 1 与 Task 3 之间转红）
- Test: `packages/cdd-engine/src-next/render/__tests__/templates.test.ts`
- Test: `packages/cdd-engine/src-next/render/__tests__/context-lines.test.ts`（`preview: "satisfied"` 的两处既有字面量同批改写为 `written: "engine"`）

#### Consumes
- `TemplateAssembler.NAMED_BRIEF_CELL`（既有常量，`render/templates.ts`）
- `TemplateAssembler` 的构造期断言序列（`(a)`–`(e)`）

#### Produces
```ts
// ContextLine 的声明格：一档新枚举，替代 preview: "satisfied"
readonly written?: "engine";
// 构造期断言改名并改判据：判「声明了 engine 的槽必须是 NAMED_BRIEF_CELL」，判槽不判行
#assertEngineWritten(row: ModePromptRow, decl: ContextLine): void;
// 判槽的归约：三处声明（implement · fix · review 尾）答一槽，断言消费它
static engineWrittenSlots(rows: readonly ModePromptRow[]): readonly string[];
```

#### Steps
- **Step 1: 写两条失败测试**（三张 mode 表接受 brief 行 · `engineWrittenSlots` 把三处声明归约成一槽） — checkable: `render/__tests__/templates.test.ts` 多出两条用例；非 brief 槽的拒绝只有一份，住在 `render/__tests__/context-lines.test.ts` 的 (f)（构造期判据 (a)–(g) 的家），两个文件不再各写一遍
- **Step 2: 跑测试确认红** — checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/render/__tests__/templates.test.ts` 报红，原因指向缺失的 `written` 档
- **Step 3: 加类型档 · 改三处声明 · 断言改名 `#assertEngineWritten` 并消费 `TemplateAssembler.engineWrittenSlots` 的按槽归约** — checkable: `rg -n 'preview: "satisfied"' packages/cdd-engine/src-next/render` 零命中（`templates.ts` 的三处声明与其两段注释 prose · 本任务声明的两个测试文件，均同批换词）
- **Step 4: 跑测试确认绿** — checkable: 同 Step 2 命令 0 failed
- **Step 5: 提交** — checkable: `git show --stat HEAD` 只含 `templates.ts`、两个测试文件、`face/lifecycle.ts`（后者一行读取字段，见 Files 的订正理由）与本 plan 自己的 `v0.4` 回填（实施轮为把 `face/lifecycle.ts` 拉进 Task 1 而改的 Files 行与改史行）

#### Acceptance
三张 mode 表的 brief 格声明为 `written: "engine"`；非 brief 槽声明它时构造期红且报文点名该槽（拒绝只有一份用例：`context-lines.test.ts` 的 (f)）；判槽的归约可测——`TemplateAssembler.engineWrittenSlots` 在三处声明上答一槽，删掉归约该用例即转红；`src-next/render/` 全绿；`rg -n 'preview: "satisfied"' packages/cdd-engine/src-next/render` 零命中（`templates.ts` 的三处声明与两段注释 prose、`templates.test.ts` · `context-lines.test.ts` 的既有字面量同批换词；全树零命中是 Task 3 的判据——`face/lifecycle.ts` 与 `dispatch-input.test.ts` 里的旧字面量到那时才换）。

#### DependsOn
none

### Task 2: 树级拒绝记录（一条，两触发到期）

#### Objective
一棵树任一时刻最多一条拒绝事实，落在 `in-flight.json` 的邻居。写入走命名空间发布（先 `WorkspaceRoot#ensure()` 写 `.gitignore` 标记，再原子写），否则一条拒绝会把消费仓弄脏、并让此后每次派发都在 `tree-clean` 行被引擎自己的文件拒掉。读面三态：站立 / 缺席 / 不可读。

#### Files
- Create: `packages/cdd-engine/src-next/session/refusal.ts`
- Create: `packages/cdd-engine/src-next/session/__tests__/refusal.test.ts`
- Modify: `packages/cdd-engine/src-next/session/round-artifacts.ts`（`refusal` 的五个登记点：`Kind` 闭集 · `WorkspaceKind` 闭集 · `WORKSPACE_KINDS` 数组 · 名字拼写矩阵行（`refusal: "refusal.json"` 落进 `WORKSPACE_LITERALS`）· `workspaceName` 的映射臂（前四点到位后由查表臂自动覆盖，不新增分支）。五点同一个文件：`Kind` 是另一个闭集，`ENTRIES` 定型为 `readonly MatrixEntry[]`（`kind: Kind`）而 `isWorkspaceKind(kind: Kind): kind is WorkspaceKind` 需要 `WorkspaceKind` 含于 `Kind`——只加 `WorkspaceKind` 的那一条编译不过）
- Test: `packages/cdd-engine/src-next/session/__tests__/round-artifacts.test.ts`（它钉 `entries()` 的行集恰为 `[...ROUND_KINDS, ...WORKSPACE_KINDS]`，其中 `WORKSPACE_KINDS` 是测试文件自己那份四行清单：第五个工作区行落地时两处同批加词，其余断言不动）

#### Consumes
- `ArtifactRegistry.nameOf`（`session/round-artifacts.ts`）——名字的唯一语法
- `WorkspaceRoot`（`infra/workspace.ts`）——`ensure()` 发布 keep-out 标记
- `AtomicWriter`（`infra/atomic.ts`）——原子写
- RowStation（Task 3，`contract/preflight-rows.ts`）——站名域的唯一声明，Task 4 的 `PreFlightGateName` 以它为四个新值

#### Produces
```ts
// session/refusal.ts
export interface RefusalFacts {
  readonly at: string;            // ISO 时刻
  readonly slug: string;          // 相位工作区名
  readonly op: "implement" | "review" | "fix";
  readonly type: TargetType;
  readonly cycle: number;
  readonly attempt: number;
  readonly station: RowStation;            // 四值闭集，来自 contract/preflight-rows.ts
  readonly detail: string;        // 单行；活判词首行剥掉站名
}
export type RefusalState =
  | { readonly kind: "absent" }
  | { readonly kind: "corrupt"; readonly reason: string }
  | { readonly kind: "standing"; readonly facts: RefusalFacts };

export class PreFlightRefusal {
  static readonly FILE: string;                        // ArtifactRegistry.nameOf("refusal", null)
  constructor(root: WorkspaceRoot, slug: string);
  path(): string;
  async write(facts: RefusalFacts): Promise<void>;     // ensure() → 原子写（覆盖）
  clear(): void;                                       // 幂等
  read(): RefusalState;                                // 三态，永不抛
}
```

#### Steps
- **Step 1: 写五条失败测试**（写读往返 · 无 `.kairos` 的仓里写后树仍干净 · 覆盖不追加 · 畸形 JSON 得 corrupt · clear 幂等） — checkable: `session/__tests__/refusal.test.ts` 存在且五条用例齐
- **Step 2: 跑测试确认红** — checkable: 该文件报 `Cannot find module .../refusal.ts`
- **Step 3: 加名字的五个登记点**（`Kind` 联合多一个 `"refusal"` · `WorkspaceKind` 联合同一词 · `WORKSPACE_KINDS` 数组同一词 · 矩阵行 `"refusal": "refusal.json"` 进 `WORKSPACE_LITERALS` · `workspaceName` 的查表臂随之成立；五点同一个文件，只加拼写行会让 `nameOf` 抛「matrix holds no workspace row」，漏掉 `Kind` 则类型门红；`round-artifacts.test.ts` 的行集清单同批加词） — checkable: `nameOf("refusal", null)` 返回 refusal.json 且不加第二处字面量
- **Step 4: 实现类**（`write` 先 `ensure()` 后原子写 · `read` 三态永不抛 · `clear` force-remove） — checkable: 类落地且 `check:no-bare-functions` 对 `src-next/session` 为绿
- **Step 5: 跑测试确认绿 + 类型门** — checkable: 五条全过、`session/__tests__/round-artifacts.test.ts` 全绿，且 `pnpm exec tsc --noEmit -p packages/cdd-engine` exit 0（本任务的登记点因此能自己变红：`Kind` 缺一条即编译失败，而不靠别的任务发现）
- **Step 6: 提交** — checkable: `git show --stat HEAD` 含类、类测试、拼写表与它的测试四个文件

#### Acceptance
五条测试全绿；写入后仓库仍 `tree-clean`（F2 的直接回归）；refusal.json 是通过 `ArtifactRegistry` 拼出的名字（无第二处字面量，第五个登记点连 `Kind` 一起到齐）；`read()` 对畸形文件返回 `corrupt` 而不抛；`pnpm exec tsc --noEmit -p packages/cdd-engine` exit 0，且 `round-artifacts.test.ts` 的行集断言（`[...ROUND_KINDS, ...WORKSPACE_KINDS]`）随第五行更新后全绿——两条判据在本任务自己的门里，不借后一轮的 `validate` 才发现。

#### DependsOn
3

### Task 3: 四门判据抽成纯值模块

#### Objective
四道门的判据离开 `face/lifecycle.ts` 的实例方法，成为 `contract/` 里对**值**的纯判定：吃本任务自己声明的契约层值与一份注入的词面（派发输入事实 · 一份平值记录 · **那一轮解析后的声明行** · **两个已声明的场景事实** · 一份 artifact 快照 · 引擎写的那一格在这一次判定上的命名答案 · 四行的词面），吐站名与原因。

判据的定义由**声明面**给出，不由第二张表——因此判据真正读的那三个类型随之搬进 `contract/`：`ContextLine` 及其 `requiredOn` 臂、`RequiredArm`（含 `when: program|identity` 两臂）、以及两个 `when` 臂读的场景事实。声明表本身仍留在渲染面（`TemplateAssembler#layoutOf` 是那张表唯一的选取器，它今天就返回声明行）；判据收的是它解析出来的行与布尔化的事实，不收场景对象、不 import `render/`。exigible 格的解析（类型命中 + `when` 前置条件 → 该格的词）一并落在 contract，一处，面侧只提供值。本任务**不改行为**——face 改为调用它，字节与今日一致；门的位置在 Task 4 才动。

判据要读的**目标面**同批有自己的家，这件事也是可判的：`TargetType` 今天住在 `session/faces.ts`，而本任务的两个新模块（`contract/preflight-rows.ts` 与 `contract/context-declarations.ts`）不 import `session/`——`contract/` 里既有的三条 contract→session 边（`contract/pins.ts` 的拼写矩阵 · `contract/completion-criterion.ts` 的 carrier 完整性 · `contract/liveness-signal.ts` 的账本类型）是 P39 的活，本相位不动它们，本句也不拿它们当这条规则的例外——判据按类型集解析 `requiredOn` 的臂（`arm.types === "always" || arm.types.includes(type)`），不自带目标面就不成立。因此 `TargetType` 的定义原文搬进 `contract/target-type.ts`，`session/faces.ts` 改为一处 re-export（`session/` 的既有读者零改动，方向是 session → contract）；判据把它当**声明参数**收进来，不从场景对象里取。

平面方向是这条判据的立身之本：`contract/` 不知道 `render/TemplateValues` 与 face 私有的 `ArtifactCell` 长什么样。face 在自己的调用点做**适配**（把 `TemplateValues` 当平值记录用、把 `layoutOf` 的声明行原样交过去、把场景事实布尔化，`ArtifactCell` 的 `mismatch` 臂映射成 carrier 的两段事实），因此 `contract/preflight-rows.ts` 与声明模块不出现任何 face 或 render 的类型。

#### Files
- Create: `packages/cdd-engine/src-next/contract/preflight-rows.ts`
- Create: `packages/cdd-engine/src-next/contract/__tests__/preflight-rows.test.ts`
- Create: `packages/cdd-engine/src-next/contract/context-declarations.ts`（声明面的三个类型与 exigible 格的那一处解析：`RequiredArm` · `ContextLine` · SceneFacts，以及把声明行 + 场景事实解析成判定行的唯一一个入口。搬家的理由是可判的——判据要读声明，而 `contract/` 不许 import `render/`；搬完 `render/templates.ts` 反向 import，声明表与它的选取器留在原处）
- Create: `packages/cdd-engine/src-next/contract/carrier-line.ts`（carrier 那一句的唯一合成点：抛错与拒绝行念同一条格式，`session/carrier-integrity.ts` 与判据都只调它，不各拼一份）
- Create: `packages/cdd-engine/src-next/contract/target-type.ts`（`TargetType` 的新家：定义自 `session/faces.ts` 原文搬入，零语义改动、零新词）
- Modify: `packages/cdd-engine/src-next/session/faces.ts`（定义改为从 `contract/target-type.ts` 的 re-export，`session/` 与 `render/` 的既有读者零改动——方向是 session → contract）
- Modify: `packages/cdd-engine/src-next/render/templates.ts`（声明类型反向 import：`RequiredArm` / `ContextLine` 的定义移到 contract，本文件 import 回来；三张 mode 表、`TemplateAssembler`、`#assertEngineWritten` 与其余类型不动，零行为搬家）
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（`CliLifecycle#inputRefusalOf` 与 `#artifactCellOf` 的调用点改为委托；`#answeredByNaming` 只剩注释 prose 换词——它的判据已在 Task 1 换成读 `decl.written`，本任务不动这个判定，只换描述它的那句话）
- Modify: `packages/cdd-engine/src-next/face/words.ts`（四新行词面的字节之家：`no-host` 那句从 `face/lifecycle.ts` 迁进 `CAPSULE_WORDS.preflight`（spec §1.3 的措辞搬家），并由一个访问器把四行的词面交给调用点；`dispatchInput` 是 `CAPSULE_WORDS` 的既有那行（访问器连全表分隔符 `CAPSULE_WORDS.separator` 一并交出去——判据按它把站名接到段上，该文件里因此没有第二份 ` · ` 字面）；`artifactIdentity` 同理原样转发；`artifactIdentity` 增一格 `invalid`（`rulings sidecar — {reason}`，自 `face/lifecycle.ts` 的 `#artifactRefusalOf` 迁入——那一臂今天是一条裸字面，spec §3.3 的字节不变），artifact 行的两臂因此都落在同一张表里；同批改述 `#artifactRefusalOf` 的 docstring——它今天把 `rulings sidecar — <reason>` 再念一遍（同一文件里那是个 docstring，不是第二处字面），不改则本任务那条单命中 grep 命中两处）
- Modify: `packages/cdd-engine/src-next/session/carrier-integrity.ts`（报文改由 CarrierLine 合成——抛错的 message 与拒绝行念同一条格式，不改字节、不加第二份拼装；并给出 `facts()`：carrier 路径与两个 sha8，供快照携带**事实**而不是携带已渲染的句子；同批改述它自己的格式 docstring——那一句逐字写着 `carrier-mismatch · line=…`，不改则载体行模块那条单命中 grep 命中两处）
- Test: `packages/cdd-engine/src-next/face/__tests__/dispatch-input.test.ts`（仅换掉注释里那句旧字面量；断言零改动）

#### Consumes
- Task 1 的 `ContextLine.written` 与 `NAMED_BRIEF_CELL`
- `TargetType`（新家 `contract/target-type.ts`，自 `session/faces.ts` 搬入）——判定行的臂按它命中，`DispatchInputFacts.type` 也由它定型
- `DocFs`（`contract/invariants.ts`）——存在性读：它**以输入格进**（与 `JudgeContext` 的 `fs` 同形，由 `PreFlight#vet` 把自己构造期注入的那一个交下来），判据因此既不 new `NodeFs` 也不 import 任何具体实现
- `RepoRoot` 与 `RepoPath`（`infra/root.ts`）——路径基的唯一值对象与唯一 relativize/resolve 转换对
- `DocEntry.program` / `DocEntry.docType`（`infra/slug-index.ts`）——面侧只把它们**布尔化**成交给判据的场景事实（「声明了 program」与「解析出的链接」是两件事，`when` 臂读的是前者）
- 声明行与那张表的选取器（在 face 的调用点被读，不被本模块 import）：`TemplateAssembler#layoutOf` 解析出的那一轮声明行（`ContextLine[]`）——判据按它决定哪些格 exigible，不按自己的第二张表
- 面侧的适配源（在 face 的调用点被读，不被本模块 import）：`TemplateValues`（`render/templates.ts`，一份 `Record<string, string>`）· face 私有的 `ArtifactCell`（`face/lifecycle.ts`，构件私有的两臂值类型，刻意不导出）· `ArtifactRead`（`session/round-artifacts.ts`，快照镜像的源）· 三处词面（`face/words.ts` 的 `CAPSULE_WORDS`），以 RowWording 的平值注入——carrier 不在此列，它的句子由 CarrierLine 从快照的事实合成

#### Produces
```ts
// contract/context-declarations.ts —— 声明面的类型（自 render/templates.ts 搬入，该文件反向
// import；零行为搬家）。判据的定义来自声明，不来自第二张表。
export interface RequiredArm {
  readonly types: "always" | readonly TargetType[];
  readonly when?: "program" | "identity";
}
export interface ContextLine {
  readonly line: string;
  readonly path?: true;
  readonly absent: "drop" | "none";
  readonly requiredOn: readonly RequiredArm[];
  readonly written?: "engine";
}
/** 两个 `when` 臂读的**已声明**场景事实（布尔，不是解析后的链接）。 */
export interface SceneFacts {
  readonly program: boolean;
  readonly docType: boolean;
}
/** 一格 exigible 判定行的两词闭集（P38 spec §2.2）——本相位之后它是这两个词**唯一的
 *  声明处**：`face/words.ts` 的同名并集随旧入口退场（Task 5），case (o) 的封闭集 pin
 *  因此搬来读本模块。 */
export type ExigibleReason = "target-absent" | "empty-value";
/** 一格 exigible 判定行——由声明行 + 场景事实解析出来；判据读它，不再自己读面。 */
export interface ExigibleCell {
  readonly token: string;
  readonly path: true | undefined;
  readonly written: "engine" | undefined;
  readonly reason: ExigibleReason; // P38 spec §2.2 的两词闭集
}
export class ExigibleCells {
  /** P38 spec §1.3 的臂解析与 §2.2 的选词，一处：type 命中 + `when` 前置条件 → 该格的词。
   *  目标面是**声明参数**：不自带一张类型表，不从场景对象里揣一个，也不 import
   *  `session/`——`judge` 传 `input.facts.type`，`always` / 类型集 / `never`（`types: []`）
   *  三臂因此都能在一个平面上判定。 */
  static resolve(
    declarations: readonly ContextLine[],
    scene: SceneFacts,
    type: TargetType,
  ): readonly ExigibleCell[];
}

// contract/carrier-line.ts —— carrier 那一句的唯一合成点（抛错与拒绝行共用一处格式）
export interface CarrierFacts {
  readonly line: string; // carrier 的路径
  readonly recorded: string; // sha8（缩短只在 CarrierIntegrity 一处发生）
  readonly current: string; // sha8
}
export class CarrierLine {
  static of(facts: CarrierFacts): string; // carrier-mismatch · line=… · recorded=… · current=…
}

// contract/preflight-rows.ts（`TargetType` 从 `./target-type.ts` 取——判据要读的目标面在
// contract 里有自己的家，不由 session 拥有）
export type RowStation = "no-host" | "carrier" | "dispatch-input" | "artifact";
/** 判据**自己**读的平值事实——只有两格，因为其余事实都已各有其家，收在这里就是
 *  同一件事实的第二份：`tasks` / `(cycle, attempt)` 在 composer 的 identity 格，三条
 *  路径链接在 scene 格，`--reviews` 载体路径在 ArtifactSnapshot 的 `reviewsPath`
 *  （spec §1.1 ② 把它判给 ArtifactCell）——Task 4 的 composer 由它产 `INPUT_REVIEWS`，
 *  判据读 composer 产出的那个值（`values` 的那一格）。一格没有读者的类型不给下一手
 *  留填空题：谁要读哪件事实，就沿它自己的家去取。 */
export interface DispatchInputFacts {
  readonly type: TargetType; // `requiredOn` 的类型臂（`ExigibleCells.resolve` 的第三个参数）
  readonly host: string; // 宿主探针的结果，空串 = 无宿主（no-host 行的唯一输入）
}
export interface RowRefusal {
  readonly station: RowStation;
  /** 多行：首行即结论，续行是 derived:/found:/identity:/repair:。首行**可以**以站名
   *  开头（`dispatch-input` 的词面自带它，那张字面不改）——`PreFlightVerdict.message`
   *  因此取首行并剥掉串首站名，两个面各自只多出一段站名前缀。 */
  readonly detail: string;
}
/** 契约层的 artifact 快照——镜像私有 `ArtifactCell` 的两臂，只带判定要读的平值。
 *  `mismatch` 臂携带 carrier 的**事实**（路径 + 两个 sha8），不携带已渲染的句子：
 *  那一条句由 `CarrierLine` 在唯一一处合成，行与抛错念同一个格式；快照里放一份预先
 *  渲染好的报文就是同一件事实的第二次渲染。
 *  两臂都带 `reviewsPath`（fix 面的 `--reviews` 路径，或账本里已记录的上游轮载体）：
 *  它是 **composition 的输入格**（spec §1.1 ②：`ArtifactCell` 同时供 carrier 与 artifact
 *  两行，并携带 `--reviews` 路径），Task 4 的 composer 由它产 `INPUT_REVIEWS`；判据自己
 *  不读它——判据读的是 composer 产出的 `values` 那一格。 */
export type ArtifactSnapshot =
  | {
      readonly kind: "mismatch";
      readonly reviewsPath: string | null;
      readonly carrier: CarrierFacts;
    }
  | {
      readonly kind: "read";
      readonly reviewsPath: string | null;
      readonly read: ArtifactSnapshotRead;
    };
export interface ArtifactSnapshotRead {
  readonly kind: "absent" | "ok" | "invalid" | "misplaced"; // `ArtifactRead` 的四臂
  readonly path: string | null;
  readonly reason: string | null;
  readonly found: readonly string[];
}
/** 四行的词面——形状在这里声明，值由调用点注入（Task 4 起是 seam，Task 3 期间是 face 的
 *  调用点），因此本模块既不 import `face/` 也不 import `session/`，四行的措辞也不会在这里
 *  出现第二份字节。每一格的字节之家：`noHost` 在 `face/words.ts`（本任务从
 *  `face/lifecycle.ts` 迁入，spec §1.3）· carrier 只有一处**格式**，住
 *  `contract/carrier-line.ts`（因此没有注入槽）· `dispatchInput` 是 `CAPSULE_WORDS` 的
 *  既有那行 · artifact 的两臂各有一格，同在 `CAPSULE_WORDS.artifactIdentity`（`misplaced`
 *  的四段续行与 `invalid` 那一句），`face/lifecycle.ts` 里因此不再留裸措辞。 */
export interface RowWording {
  readonly noHost: string; // 一句，无填充槽
  /** 与 `CAPSULE_WORDS.dispatchInput` 的三格 + 全表分隔符一一对应：判据按
   *  `station` + 各段以 `separator` 相连、再以 `stationJoin` 接到站名上，拼出今天的
   *  字节；`PreFlightVerdict.message` 随后把串首站名剥掉，`DispatchAuthority#message`
   *  再补回一次——站名因此只在一处进、一处在出。 */
  readonly dispatchInput: {
    readonly station: string; // dispatch-input
    readonly segment: string; // {row} · {token} · {reason}
    readonly separator: string; // 段间 "; "
    readonly stationJoin: string; // 站名与段之间 " · "（CAPSULE_WORDS.separator）
  };
  readonly artifact: {
    readonly invalid: string; // {reason} —— present-but-unreadable sidecar（rulings sidecar — {reason}）
    readonly reason: string; // {kind}
    readonly derived: string; // {derived}
    readonly found: string; // {found}
    readonly identity: string; // {identity}
    readonly repair: readonly string[]; // 固定两句
  };
}
/** 判据的全部输入收成一个参数对象（字段数不是参数数——签名只有一个参数，「方法 ≤4 参数」
 *  不被输入格数越过）。判据读的四类事实全在这里：值、声明行、场景事实、快照。 */
export interface PreFlightRowsInput {
  readonly facts: DispatchInputFacts;
  readonly values: Readonly<Record<string, string>>; // 面侧 `TemplateValues` 的原样形状，零 import
  readonly declarations: readonly ContextLine[]; // 那一轮解析后的声明行（面侧 layoutOf 的产物）
  readonly scene: SceneFacts; // 两个已声明场景事实
  readonly artifact: ArtifactSnapshot; // 面侧 `ArtifactCell` 的映射结果
  readonly repoRoot: RepoRoot; // 路径基值对象：存在性读只经 resolve，绝不 path.join
  /** 存在性读的那一个缝（与 `JudgeContext` 的 `fs` 同形）：`PreFlight#vet` 把它构造期
   *  注入的那一个交下来，判据因此不 new `NodeFs`、也不 import 任何具体实现——
   *  「路径格缺失」与「引擎写的槽零存在性读」两条用例用记录用的假 fs 就能核。 */
  readonly fs: DocFs;
  readonly wording: RowWording; // 四行的词面，由调用点注入
  /** 引擎写的格在这一次判定上的命名答案：Task 3 期间只有预览面问它（行为不变），
   *  Task 5 退役 `mode` 之后这一格整体退场——声明面自己就是答案。 */
  readonly naming: { readonly answered: boolean };
}
export class PreFlightRows {
  static judge(input: PreFlightRowsInput): readonly RowRefusal[]; // 全部违规格一次报完（不短路）
}
```

- `repoRoot` 收既有的路径基值对象 `RepoRoot`（`infra/root.ts`），不是裸字符串：声明格里的路径是 repoRoot-relative（spec §1.1），存在性读只经 `RepoRoot` 的 `relativize` / `resolve` 这一对转换落成绝对路径——模块内不许用 `path.join`（或任何裸字符串拼装）自己拼一段路径（今天 `#inputRefusalOf` 的注释点名的正是「从子目录派发把每条落地路径读成缺失」那个缺陷）。这条只管**路径**：本模块的正式工作之一是合成多行 detail，`RowRefusal.detail` 的续行、`RowWording.dispatchInput.separator` 与 artifact 的 `repair` 两句都用 `Array#join` 拼字符串，与 `face/words.ts` 今日同形。

#### Steps
- **Step 1: 写七条失败测试**（no-host · carrier · 必填格空 · 路径格缺失 · 三处同时三条一次报完且顺序固定 · engine 写的槽零存在性读 · 声明表驱动的 exigibility：`always` / 类型集 / `when: program|identity` 三臂各判一次，判据只读声明行与两个场景事实） — checkable: `contract/__tests__/preflight-rows.test.ts` 七条用例齐
- **Step 2: 跑测试确认红** — checkable: 该文件报 `Cannot find module .../preflight-rows.ts`
- **Step 3: 搬声明类型与判据进纯模块，face 侧改为取值、映射与委托**（`RequiredArm` / `ContextLine` 移进 `contract/context-declarations.ts`，`render/templates.ts` 反向 import；`TargetType` 的定义移进 `contract/target-type.ts`，`session/faces.ts` 反向 re-export；`values` 与 `layoutOf(values)` 的声明行直接传；两个场景事实布尔化后传；`ArtifactCell` 的 `mismatch` 臂映射成 carrier 事实而不是报文；三份词面按 RowWording 注入） — checkable: `face/lifecycle.ts` import 该模块，四道门的判定式不再出现在 face；`contract/preflight-rows.ts` · `contract/context-declarations.ts` · `contract/target-type.ts` 的 import 列表里没有 `face/` · `render/` · `session/`（词面是注入值，模块内零句措辞字面；目标面因此有自己的 contract 家，不是判据反向依赖 session）；声明类型只有一处定义（`rg -n 'export interface ContextLine' packages/cdd-engine/src-next` 单命中且落在新建的声明模块）；`TargetType` 也只有一处定义（`rg -n 'export type TargetType' packages/cdd-engine/src-next` 单命中且落在 `contract/target-type.ts`，`session/faces.ts` 那处是 re-export）；carrier 那一句的格式只有一处（`rg -n 'carrier-mismatch · line=' packages/cdd-engine/src-next -g '!**/__tests__/**'` 单命中且落在新建的 carrier 行模块，`session/carrier-integrity.ts` 改为调它）；artifact 那一行的两个臂各有一处字节之家（`rg -n 'rulings sidecar — ' packages/cdd-engine/src-next -g '!**/__tests__/**'` 单命中且落在 `face/words.ts`——既有那条裸字面随之进表）；`rg -n 'preview: "satisfied"' packages/cdd-engine/src-next` 零命中（全树：Task 1 收掉 `render/` 切片，本任务换掉 `#answeredByNaming` 的注释 prose 与 `dispatch-input.test.ts` 的旧注释）；存在性读只经注入的 `fs` 一格（`contract/preflight-rows.ts` 里 `NodeFs` 零命中，输入格里有 `fs: DocFs`——判据不 import 具体实现，也不需要临时目录）
- **Step 4: 跑绿 + 跑既有面测试确认字节未变** — checkable: 三个测试文件全绿且 `lifecycle.test.ts` · `dispatch-input.test.ts` 的断言零改动（后者只改了一句注释里的旧字面量）
- **Step 5: 提交** — checkable: `git show --stat HEAD` 含四个新模块（判据 · 声明类型 · carrier 行 · 目标面的家）、新测试、`render/templates.ts`、`session/faces.ts`、`session/carrier-integrity.ts`、`face/lifecycle.ts` 与 `dispatch-input.test.ts`

#### Acceptance
七条测试全绿；`lifecycle.test.ts` 与 `dispatch-input.test.ts` 的断言零改动即绿（本任务不改行为；`dispatch-input.test.ts` 只改一句注释里的旧字面量——它的 `CliLifecycle` 构造调用随构造器改动由 Task 6 同批迁移，它的三个门方法入口随 Task 5 的退场迁移，本任务不碰）；`contract/preflight-rows.ts` 与 `contract/context-declarations.ts` 不 import `face/` · `render/` · `session/` 的任何符号（依赖方向可 grep 断言：`TargetType` 因此有自己的 contract 家，不是这条规则的一个例外），模块内零句四行措辞（全部经注入的词面抵达），四行词面各有一处字节之家（`no-host` 在 `face/words.ts` · carrier 只有一处**格式**，住新建的 carrier 行模块，抛错的 message 与拒绝行念同一条 · `dispatchInput` 与 `artifactIdentity` 在 `CAPSULE_WORDS`，且 artifact 的**两个**臂都在那张表里：`misplaced` 的四段续行与 present-but-unreadable 那句 `rulings sidecar — {reason}`（快照 `read` 臂的 `invalid` 一格不再是裸字面，它有自己的格做家））；**判据的输入是它自己声明的契约形状，且包含它真正读的那几格**——值、声明行、两个已声明场景事实、目标面（`resolve` 的第三个参数 `type`，`judge` 传 `facts.type`）、快照（不是场景对象、不是第二张声明表、零 face / render 类型）；引擎写的格在判据里只有一个读点（声明行上的 `written: "engine"`），它使该格在任何面、任何模式下都不做存在性读；空值那一腿在 Task 3 仍按今天的形状只在预览面被命名行豁免（`dispatch-input.test.ts` 的 dispatch 断言因此零改动即绿），Task 5 退役 `mode` 之后豁免与声明合一，该格在四个面、两种模式下同一个判据；存在性读只经 `RepoRoot` 的 `relativize` / `resolve` 转换对（`contract/preflight-rows.ts` 里 `path.join` 零命中、且无 `node:path` 的 import——路径基不从裸字符串拼；`Array#join` 不在那条规则里，它正是这个模块合成 detail 续行与 artifact 两句 `repair` 的工具），并且只经**注入的**那一个 `fs`（输入格，与 `JudgeContext` 同形；模块里 `NodeFs` 零命中，因此假 fs 就能核「路径格缺失」）；全树 `rg -n 'preview: "satisfied"' packages/cdd-engine/src-next` 零命中（三处声明、三处注释 prose 与两个测试文件的字面量均在 Task 1 与本任务后到齐；`dispatch-input.test.ts` 是该清单里唯一只动注释的文件）。

#### DependsOn
1

### Task 4: structure 腿增四行

#### Objective
四道门成为 pre-flight 缝合的第 6–9 行，排在 `doc-contract` 之后：输入面是否合格，先要有合格的文档。缝合只吃**值**（values · artifact · 宿主事实 · 那一轮解析后的声明行 · 两个已声明的场景事实；将要消耗的 `(cycle, attempt)` 只进拒绝记录、不进缝合），绝不 import face 的模块——判据由 Task 3 的纯模块提供。优先级位移随之登记：line 腿今天排在门之前，此后排在门之后。

组合的四格输入里有两项的**生产者今天不存在**（声明行与场景事实另有两格今天就在组合根手上，只是还没上台），本任务因此把它们一起立起来，而不是留给接线时赊账：

- **值的预帧装配**：`vet` 落在 `OpenFrame` 之前（spec 2.4：帧出自 `Lifecycle#peekNext()`，而 `run` 在裁决之后才构造），而今天唯一的两名生产者都绑帧——`CliLifecycle#valuesOf(frame, cell)` 与 `#artifactCellOf(frame)`。因此值的装配自己成一个文件：一个**无帧、无 workspace** 的 composer，吃声明好的平值（identity：op · type · phase · tasks · (cycle, attempt)；scene：那条线的 doc / plan / spec / overall 路径 · base 分支 · 引擎写的 brief 路径经 `RoundNaming#brief(tasks)` 命名 · 工作区目录与 slug · 三个 OUTPUT_* 与 `## Handoff schema` 文本；artifact：快照的整格——`read` 臂与 `mismatch` 臂都带 fix 面的 `--reviews` 路径，`mismatch` 臂另带载体路径与两个 sha8），吐一份平值记录。rulings 边车的路径**不进 scene**：它由快照 `read` 臂的 `path` 派生（`kind: "ok"` 时），同一件事实不在两个类型里各存一份。**单源保证写成条件**：门判的那份值与提示词渲染的那份值是同一个 composer 的同一次调用产物——seam 收它的输出、渲染器收它的输出，两边都不重组（Task 5 把渲染器接到这次调用上）。
- **两格最容易漏、且只能靠无帧事实得到**：wave 面的 `WAVE` 读 `tasks`（`#valuesOf` 今天在 `frame.params.tasks` 上取值，非 wave 面为空串），fix 面的 `INPUT_REVIEWS` 读请求载体路径。前者进 DispatchIdentity，后者随 artifact 快照（spec §1.1 ②：`ArtifactCell` 同时供 carrier 与 artifact 两行，并携带 `--reviews` 路径）——两者都必须是无帧可得的平值，否则 Task 4 的成对测试（composer 的记录与 `#valuesOf` 的记录逐字相同）在 fix 与 wave 两个面上无法成立。请求载体路径的**推演归组合根**：它持有 `--reviews` 的值（`parsed.paths.reviews`），持有账本（同回合同评审记录的那条取路）与 `RoundNaming`（族名），且知道本轮将要消费的 `(cycle, attempt)`——三者都是无帧事实；它交给 composer 的是一格值，不是一次推演。
- **reason 表的四行**：`session/preflight.ts` 的 docstring 说「每个门名就是 structure 腿在 `DISPATCH_REASON` 里的 reason token」，而 `DispatchAuthority#structureRefusal` 返回 `reason: gate`（`DispatchReason` 是那张表的 token 联合）。九值门名不进表，那个赋值就编译不过；而「另起一套 reason 拼写」会给出同一件拒绝两套名字。因此四行的 token 就是 RowStation 的四个值，leg 全为 `structure`，表与门名一份词汇。

#### Files
- Modify: `packages/cdd-engine/src-next/session/preflight.ts`（`PreFlightGateName` 扩为九值、`PreFlightContext` 增五格输入（`host` · `values` · `declarations` · `scene` · `artifact`，见 Produces）、`PreFlight#vet` 按序判定四行；`PreFlightReason` **不扩**——四新行的措辞来自 `RowRefusal.detail`，那个 enum 的 docstring 承诺零死值）
- Test: `packages/cdd-engine/src-next/session/__tests__/dispatch-authority.test.ts`（structure 腿的行集与顺序断言）
- Create: `packages/cdd-engine/src-next/session/__tests__/preflight-rows.test.ts`（四行在缝合层的端到端：值的来源、顺序、短路规则）
- Create: `packages/cdd-engine/src-next/face/dispatch-values.ts`（预帧值装配：无帧、无 workspace 的 composer，框架层以下的所有事实都以平值入、平值出；渲染器与缝合读同一份）
- Modify: `packages/cdd-engine/src-next/session/next.ts`（`DISPATCH_REASON` 加四条 structure 行：token 就是 RowStation 的四个值，`leg: "structure"`；一张表、一套拼写，不另起 reason 词汇）
- Modify: `packages/cdd-engine/src-next/face/cli.ts`（生产侧唯一那次 `vet` 调用：新增的五格输入在此装配——composer 调一次、宿主值探一次、声明行由 `#template.layoutOf(values)` 取、两个场景事实由 `scene.program` / `scene.docType` 布尔化（两个值都在组合根手上，`session/` 因此不新增 `render/` 的 import），artifact 快照的**整格在这里生产**（见表与 Produces 的快照注）：两臂都带 reviewsPath——`--reviews` 值 · 账本里同回合同评审记录的载体取路 · 族名，三者优先序同 `#reviewsPath`；`read` 臂由既有的无帧缝 `ArtifactReads#read("rulings", reviewsPath, digest)` 判读写（用组合根手上的 `scene.workspace`——它的构造期零 I/O；digest 取账本那条评审记录的 `carrierDigest`，即 `#requesterDigest` 的无帧同源），`mismatch` 臂由它抛的 `CarrierMismatchError` 映射而成（那个错自带路径与两个全 hex 值，sha8 由 `CarrierIntegrity` 一处缩短；Task 3 同批把这三格收成 `facts()`）——两个臂无一项靠帧，Task 5 退役 `#artifactCellOf` 之后这里是唯一的生产者；`(cycle, attempt)` 不随 context 走（它不喂任何一行，只进拒绝记录，见 Produces）；断言零改动。宿主值本任务先探一次并只交给 context；Task 6 把**同一个值**交给 lifecycle 与 Preview 两处读者，不开第二条探测路径）
- Test: `packages/cdd-engine/src-next/session/__tests__/preflight.test.ts`（`waveCtx` · `docCtx` · `branchCtx` · `carrierCtx` 四个 context 构造器同批补上新输入；全部 `vet` 调用都经这四个构造器或它们的展开喂入，因此逐调用零改动；断言零改动）
- Test: `packages/cdd-engine/src-next/session/__tests__/plan-read-consistency.test.ts`（第五个 context 构造器 `preflightCtxOf` 同批补上新输入，它的 `vet` 调用零改动——不补它则本任务的 `tsc --noEmit` 门在 Step 5 红，而那个文件不在任何任务的 Files 里）

#### Consumes
- Task 3 的 `PreFlightRows.judge` · PreFlightRowsInput · RowWording · DispatchInputFacts · RowRefusal · ArtifactSnapshot
- `PreFlightContext` / `PreFlightVerdict`（既有）
- `RoundNaming#attemptOf` 与 `Ledger#roundCount`——将要消耗的 `(cycle, attempt)` 的唯一来源
- `RoundNaming#brief` 与 `#briefName`（`session/round-naming.ts`）——引擎写的 brief 格的命名，与 `--dry-run` 预览同一条推演（composer 收的是它的输出，不收帧）
- 请求载体路径的三个无帧来源（均在组合根被读，不进 composer）：`--reviews` 的解析值（`face/cli.ts` 的 `parsed.paths.reviews`）· 账本里同回合同评审记录的载体取路（`#reviewsPath` 今天的三选一优先序）· 评审族的族名（`RoundNaming`，下标是本轮 `(cycle, attempt)` 而不是帧的下标）
- `HostDetect.detect`（`face/host.ts`）——宿主值的唯一探针；本任务在组合根探一次并交值给 context（Task 6 把同一个值分给另两处读者并退役派发体里那次重复探测）
- `DispatchReason` / `DISPATCH_REASON`（`session/next.ts`）——structure 腿 reason token 的唯一表；四行加在那里，`structureRefusal` 的 `reason: gate` 才继续成立
- `Words`（`face/words.ts`）与 CarrierLine（`contract/carrier-line.ts`）——四行词面中三行按 RowWording 的平值注入 PreFlightRowsInput（`session/` 早已持有 `Words` 的类型，这条注入不新增第二条 `face/` 的 import），carrier 那一行由 CarrierLine 从快照的事实合成

#### Produces
```ts
// face/dispatch-values.ts —— 预帧值装配（无帧、无 workspace）
export interface DispatchIdentity {
  readonly op: OpType;
  readonly type: TargetType;
  readonly phase: string; // 渲染的 isReview / evidence 两腿读它，不读帧
  readonly tasks: string; // wave 面的 WAVE 格读它（非 wave 面由 composer 置空，帧不外借）
  readonly cycle: number; // OUTPUT_* 与 brief / handoff 的命名下标：本轮将要消费的那一轮
  readonly attempt: number; // 同上——两格一起构成本次派发的身份，不是任何一行的输入
}
export interface DispatchSceneFacts {
  readonly docPath: string | null;
  readonly planPath: string | null;
  readonly specLink: string | null;
  readonly overallLink: string | null;
  readonly baseBranch: string | null;
  readonly briefPath: string; // RoundNaming#brief(tasks) —— 引擎写的格
  // 不在这里的两格：`(cycle, attempt)` 住 identity（上面），rulings 边车的路径不住 scene
  // ——`INPUT_RULINGS` 由快照的 read 臂派生（`ArtifactSnapshotRead.path` 在 `kind: "ok"`
  // 时就是它），同一件事实不在两个类型里各存一份。
  readonly workspaceDir: string;
  readonly workspaceId: string;
  readonly reportPath: string;
  readonly evidencePath: string;
  readonly handoffPath: string;
  readonly handoffSchema: string;
}
export class DispatchValues {
  /** 一次装配，两个消费者：缝合判它，渲染器渲染它（不重组）。三个参数即 spec §1.1 的
   *  四格输入（(`cycle`, `attempt`) 与 identity 同住）：身份 · 场景事实 · 快照。
   *  `INPUT_REVIEWS` 读快照的 `reviewsPath`（fix 面；非 fix 面隔空串），`INPUT_RULINGS`
   * 读快照 `read` 臂的 `path`（`kind: "ok"` 时，否则空串），`WAVE` 读 `identity.tasks`
   * （仅 wave 面）——三格因此无帧可得。 */
  static compose(
    identity: DispatchIdentity,
    scene: DispatchSceneFacts,
    artifact: ArtifactSnapshot,
  ): Readonly<Record<string, string>>;
}

// session/preflight.ts
export type PreFlightGateName =
  | "tree-clean" | "in-flight" | "graph" | "plan-ledger" | "doc-contract"
  | RowStation; // 四个新行就是 RowStation 的四个值，零第二处枚举
export interface PreFlightContext {
  // …既有字段…
  readonly host: string; // 组合根探一次，交值不交模块
  readonly values: Readonly<Record<string, string>>; // 装配好的那一次（契约层的平值记录）
  readonly declarations: readonly ContextLine[]; // 声明行：组合根用 #template.layoutOf(values) 取
  readonly scene: SceneFacts; // 两个已声明场景事实，组合根由 scene.program / scene.docType 布尔化
  readonly artifact: ArtifactSnapshot; // face 侧映射后的契约值，不是私有 ArtifactCell
}

// session/preflight.ts —— 判据的 `naming` 一格由缝合自答，不占 context 的第六格；
// 存在性读的缝同样不占 context 的一格：vet 把自己构造期注入的那一个交下来。
// PreFlightRows.judge({ …ctx, fs: this.#fs, naming: { answered: false } })  // 派发模式的答案（预览臂是它唯一的读者）

// session/next.ts —— DISPATCH_REASON 的四条新 structure 行（token 即站名）
// noHost: { token: "no-host", leg: "structure" }
// carrier: { token: "carrier", leg: "structure" }
// dispatchInput: { token: "dispatch-input", leg: "structure" }
// artifact: { token: "artifact", leg: "structure" }
```
- `PreFlight#vet` 的判定序：既有五行（原序，逐行判定、首个违纪即拒）→ 四新行（no-host → carrier → dispatch-input → artifact，**四条全判、一次报完**）。verdict 的 `gate` 与 `message` 取四条里的**第一条**违纪行：`message` 是该行 `detail` 首行**剥掉串首站名**后的余下部分（spec §2.1 / §3.3）——站名由 `gate` 单独携带，`DispatchAuthority#message` 是唯一把它放回串首的位置，命令面与预览面因此各只有一段站名前缀；`details` 只收**它之后**的各条（三条违纪 ⇒ 两条 details）。这不是口味：`face/cli.ts#Cli#renderPreflightBlocked` 先印 `message` 再逐条印 `details`，收全部四条会让首条的句子在同一个块里出现两遍；而既有 `details` 的语义本来就是「`message` 之下的各条」（`graph` / `plan-ledger` 的 issue / finding 行），四行沿用同一条，不新开第二个意思。
- 既有五行按面取舍，`order` 的行数是面的函数：`graph` 只在 `wave` / `plan` 的 ready 读上（非 ready 的读既不推也不报）· `plan-ledger` 只在 `plan` / `wave` / `branch` 上 · `doc-contract` 只在四个 doc 面上（`phase-spec` · `overall` · `plan` · `single-spec`）。四新行不受面影响、每一面都判都记——spec 的 `checked:` 具名变更 ④ 承诺的正是这四行 always，不是九行 always。
- 优先级位移（spec 的第六项具名变更）：四行排在 line 腿**之前**，因此同一个 fixture 同时犯门与线两条时，报的是门的行；门通过之后，线的拒绝仍可达。
- 单源保证：`PreFlightRowsInput.values` 与渲染器读的那份值来自同一个 composer 的同一次调用（Task 4 期间两条调用点同时在场：`cli.ts` 的 `vet` 前一次，`CliLifecycle` 侧的旧 `#valuesOf` 仍在；Task 5 把后者换成前者的输出，两个消费者就只剩一次装配）。
- 缝合侧的五格输入各有生产者，**没有一格靠 import 补**：`values` / `artifact` 是 composer 与快照的输出，`host` 是组合根那一次探测的值，`declarations` 是 `#template.layoutOf(values)` 的返回，`scene` 是 `scene.program` / `scene.docType` 两个布尔——后两格今天就在组合根手上。`session/` 因此不新增对 `render/` 或 `face/` 的 import（`render/templates.ts` 反过来 import `session/faces.ts`，那条边会把 `session/preflight.ts → render/templates.ts → session/faces.ts` 连成环）。`(cycle, attempt)` 不进 context：它不喂任何一行（spec §1.1 把它判给拒绝事实自己的身份），组合根直接把它写进拒绝记录的两格。
- **判据的 `naming` 一格由缝合自己作答，不增第六格**：`PreFlight#vet` 传常量 `naming: { answered: false }`。理由可核而不靠猜——`face/lifecycle.ts#CliLifecycle` 的 `#answeredByNaming` 唯一的读者是 `#inputRefusalOf` 的 `mode === "preview"` 那一臂（派发模式从不问它），而引擎写的格的存在性那一腿已由声明面的 `written: "engine"` 抑制，命名只影响「空值是否被豁免」——派发路径上仍是拒绝。因此这一格在每一面都等于派发模式的答案，且它是判据自己的输入格、不是 `PreFlightContext` 的一格（进 context 会与 Step 3 的 checkable 和 Acceptance 的五格相抵）；Task 5 退役 `mode` 时整格随豁免一起退场。

#### Steps
- **Step 1: 写七条失败测试**（缺宿主 · 值坏 · 三个站同时违纪：`message` 念首条（已剥串首站名，`CDD_BLOCKED:` 行里站名只出现一次）、`details` 两条、拼出的整块里三句各出现一次（首条不得重复） · 文档坏与值坏并存时 doc-contract 先拒 · 预帧装配可独立调用（composer 不 import 帧类型、不读 workspace）且它产出的记录与 `CliLifecycle` 今日从帧推得的值**逐字相同**（成对，证明两条路径同源；Task 5 把后者换成前者）——成对断言在 wave 面与 fix 面各跑一次，因此含 `WAVE`（读 `identity.tasks`）与 `INPUT_REVIEWS`（读快照的 `reviewsPath`）两格 · 九值门名与 reason 表的四个 token 一一对应 · **快照两臂都活着**：`read` 臂与 `mismatch` 臂各喂一次——被篡改的请求载体在 pre-flight 就拒成 `carrier` 行，Task 5 退役旧生产者之后 `artifact` 与 `carrier` 两行仍由这一对断言守着） — checkable: `session/__tests__/preflight-rows.test.ts` 七条用例齐
- **Step 2: 跑测试确认红** — checkable: 该文件报红，原因指向未扩的九值或缺失的 context 输入
- **Step 3: 扩类型、四行 reason 表、预帧 composer 与判定**（九值 · `DISPATCH_REASON` 四行 · context 五输入必填 · 四行全判一次报完 · composer 无帧无 workspace · `cli.ts` 那次 `vet` 的五格输入齐） — checkable: `PreFlightGateName` 的声明含 RowStation；`PreFlightContext` 含 `host` / `values` / `declarations` / `scene` / `artifact`，且不含 `round`（`rg -n 'round:' packages/cdd-engine/src-next/session/preflight.ts` 零命中——身份不喂任何一行）；`DISPATCH_REASON` 含四个新 `leg: "structure"` 行，`PreFlightReason` 仍是五值；composer 的文件里 `OpenFrame` 零命中；`DispatchValues.compose` 是三个参数（identity · scene · 快照），identity 含 `tasks` / `cycle` / `attempt`，快照两臂均带 reviewsPath 且 `read` 臂的 `path` 是 `INPUT_RULINGS` 的唯一来源；`naming` 由 `PreFlight#vet` 以常量 `{ answered: false }` 传给 `judge`，而 `PreFlightContext` 的接口体里 `naming` 零命中（六格会让五格那条断言与它自己的生产者互相矛盾）；**判据拿到的 `fs` 是 `PreFlight#vet` 交下来的那一个**（`contract/preflight-rows.ts` 里 `NodeFs` 零命中、输入格里有 `fs: DocFs`）；判词装配处剥一次串首站名（`message` 的赋值只有一处，`DispatchAuthority#message` 不再有第二个补回点，`dispatch-input` 与其余三行同一道处理）
- **Step 4: 写优先级位移的成对测试**（门与线同犯 ⇒ 报门的行；补齐门之后再跑 ⇒ 报线的行） — checkable: 该对断言同文件内可红可绿
- **Step 5: 跑绿 + 跑既有缝合测试 + 类型门** — checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/session/__tests__/` 全绿（含新输入下断言零改动的 `preflight.test.ts` · `plan-read-consistency.test.ts`），且 `pnpm exec tsc --noEmit -p packages/cdd-engine` exit 0（四行 reason 进表后 `structureRefusal` 的 `reason: gate` 仍成立；生产侧那次 `vet` 与两个测试文件的五个 context 构造器（`preflight.test.ts` 的四个 · `plan-read-consistency.test.ts` 的 `preflightCtxOf`）均已补齐输入，43 处 `vet` 调用零改动）
- **Step 6: 提交** — checkable: `git show --stat HEAD` 含 `session/preflight.ts`、`session/next.ts`、`face/dispatch-values.ts`、`face/cli.ts` 与四个测试文件

#### Acceptance
九值闭集；`order` 按面取既有行（`graph` 仅 `wave` / `plan` 的 ready 读 · `plan-ledger` 仅 `plan` / `wave` / `branch` · `doc-contract` 仅四个 doc 面），四新行在每一面都在、都记（故 `plan` 面九行、`wave` 面八行、`branch` 面与其余三个 doc 面七行——九行是 `plan` 面的行数，不是「每次派发恒含九行」）；`session/preflight.ts` 不新增 `face/` 的 import（既有那条 type-only `Words` 保留，grep 断言是「无新增」而不是「零命中」）；四行全报而非逐条短路，`message` 取首条、`details` 只收其后的各条（多违纪块里每句各出现一次，首条不重复）；`doc-contract` 仍排在四行之前；优先级位移有成对断言（门的行在前、线的行在门通过后仍可达）；**值的装配有无帧的单一入口**（composer 不 import 帧类型、不读 workspace 对象，测试直接调它即得一份可用值），composer 的输入是它自己声明的三格（identity · scene · 快照，每格都在 Produces 里点名，没有「Objective 列了而类型不接」的格：`tasks` 与 `(cycle, attempt)` 在 identity，fix 面的请求载体路径在快照的 `reviewsPath`），且 composer 输出的记录与 `CliLifecycle#valuesOf` 今日从帧推得的值**逐字相同**（成对断言，覆盖 wave 与 fix 两个面；两个消费者此时仍是两处派生——「同一份输出」是 Task 5 的判据，那里有判据一次 / 镜像零次的 spy 断言），快照的两臂都有生产者且都活着（`read` 臂与 `mismatch` 臂各喂一次，被篡改的请求载体在 pre-flight 就拒成 `carrier` 行；Task 5 退役 `#artifactCellOf` 之后这里仍是唯一生产者）；**九值门名没有破 reason 表**（`DISPATCH_REASON` 的四条新行 token 即站名，`structureRefusal` 的 `reason: gate` 无需 cast 即过 `tsc --noEmit`；`PreFlightReason` 保持五值，四新行不带它——它们的措辞来自 `RowRefusal.detail`，不发生第四个词汇表）；**缝合侧的判定输入都有生产者**（`host` · `values` · `declarations` · `scene` · `artifact` 五格，每格在 Files 里点名一个来源，`session/` 零新增 `render/` / `face/` 的 import；判据自己的 `naming` 一格由缝合以 `{ answered: false }` 自答——派发模式的答案，不进 context、不增第六格；判据的存在性读同样不增 context 的一格——`PreFlight#vet` 把自己构造期注入的 `fs` 交给 `judge`（默认 `NodeFs`），判据因此不 import 具体实现）；生产侧唯一 `vet` 调用与两个测试文件的五个 context 构造器（`preflight.test.ts` 的 `waveCtx` · `docCtx` · `branchCtx` · `carrierCtx`，`plan-read-consistency.test.ts` 的 `preflightCtxOf`）在同一提交内补齐，43 处 `vet` 调用零改动。

#### DependsOn
1, 3

### Task 5: 退役派发体四门与预览的三门镜像

#### Objective
判定有了唯一的家，派发体里那四道门与三门镜像同时退场——第二处问同一个判定就是第二份事实来源。镜像不只在预览面：它的家是 `face/cli.ts#Cli#runWork` 的 `--dry-run` 臂（`carrierRefusal` → `inputRefusal(frame, "preview")` → `artifactRefusal`，再自己调 `Preview#artifactBlock`），spec §2.4 的「循环里镜像的退役」说的就是它——因此该文件与 `preview.ts` 同批进本任务的 Files。随之退场的是**门拒绝分支**上的 `#sealRoundCarriers`：门在开名之前判，没有名字需要封回。门之外的封名不在此列——abort 记账、丢掉 in-flight 锁的那次派发、终止处理器的死亡路径三条都必须留着。

三个公开判定入口（`CliLifecycle#carrierRefusal` · `#artifactRefusal` · `#inputRefusal`）随它们唯二的生产调用点（派发体三处 · `Cli#runWork` 的三门镜像）一并退场，**不留委托壳**：三个入口今天都从**帧**取那份值（`inputRefusal` 直接调 `#valuesOf(frame, …)`），而本任务正是把帧推演从判据侧拿掉——留一个壳就等于把 `#valuesOf` 的帧重组重新挂回一个公开方法，判据的家与值的家又分两处。代价是一份面测试不再有入口，那件事在本任务的 Files 行里按用例点名（Step 1 第五条的 spy 因此改成对判据本身）。

本任务同时把渲染器接到 Task 4 的那个**同一次装配**上：`CliLifecycle` 不再自己从帧推一份值（`#valuesOf` 退成读组合根交过来的记录），否则门判的值与提示词渲染的值就是两处派生——spec 2.1 的「四格输入」因此只剩一个组合点。同批退场的还有判据侧的命名豁免：PreFlightRowsInput 的 `naming` 那一格在本任务里整体退场，引擎写的格由声明面自己作答（`written: "engine"` + 命名槽），因为这时门已经跑到 brief 渲染之前，而 brief 还没被写出来——把豁免留在那里就会让每次 wave 派发在 `target-absent` 上死。

#### Files
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（删四门判定；删**门拒绝分支**上的 `#sealRoundCarriers`——carrier · dispatch-input · artifact 三处，不是拒绝路径上的全部调用；三个公开入口 `carrierRefusal` · `artifactRefusal` · `inputRefusal` 连同它们的 docstring 同批退场——派发面从此没有任何「问一次判定」的入口；判定搬走后**只服务于那三个入口的私有机械**同批退场，逐个点名：`#inputRefusalOf`（连它的 `mode` 参数）· `#artifactRefusalOf` · `#artifactCellOf` · `#artifactReadOf` · `#requesterDigest` · `#rulingsInputOf` · `#answeredByNaming`（它唯一的读者就是 `mode === "preview"` 那一臂，而它自己的签名 `(decl, token, frame)` 从来没有 `mode` 参数）、`#runDispatch` 里那个 `#artifactCellOf(frame)` 局部，以及只被它们使用的 `ArtifactCell` 类型 · `NO_ARTIFACT` 常量 · `session/artifact-reads.ts` 的三个 import（`ABSENT_READ` · `ArtifactReadOf` · `ArtifactReads`）——这一批没有任何一条门会看见：套件是绿的、`tsc` 没开 noUnusedLocals（`packages/cdd-engine/tsconfig.json`）、`check:no-bare-functions` 在这里零命中，`biome` 只报 import；`#reviewsPath` 不在此列，它在完成性判据与族名面上另有活读者）
- Modify: `packages/cdd-engine/src-next/face/cli.ts`（`Cli#runWork` 的 `--dry-run` 臂删掉三门镜像与它自己那支拒绝分支，只留五行预报）
- Modify: `packages/cdd-engine/src-next/face/preview.ts`（三联门块收为五行预报；`artifactBlock` 保留为唯一的拒绝块渲染）
- Modify: `packages/cdd-engine/src-next/contract/preflight-rows.ts`（命名豁免那一格退场：`naming` 输入删除，引擎写的格只由 `declarations` 上的 `written` 判定；`mode` 概念从判据里消失，一个读点）
- Modify: `packages/cdd-engine/src-next/face/words.ts`（行合成的第二处与两词闭集的第二处声明随旧入口退场：`Words#dispatchInput`（`[station, segments.join(separator)].join(" · ")` 那一处，判据接管后零调用）· `DispatchInputSegment`（只有它与退场的 `#emptyReasonOf` 读）· `DispatchInputReason`（同名并集的第二处声明，判据那侧的 `ExigibleCell.reason` 是唯一声明处）；`Words#artifactIdentity` **不在此列**——它的两个读者是 `board-view.test.ts` 的夹具，而它读的正是 `CAPSULE_WORDS.artifactIdentity` 那四段（判据经注入的词面读同一张表，因此不是第二份字节之家），本任务只把它的生产调用点换成判据）
- Test: `packages/cdd-engine/src-next/face/__tests__/lifecycle.test.ts`
- Test: `packages/cdd-engine/src-next/face/__tests__/preview.test.ts`
- Test: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（仅循环级：`--dry-run` 经 `Cli#runWork` 的循环跑一次，判据一次、镜像零次）
- Test: `packages/cdd-engine/src-next/face/__tests__/dispatch-input.test.ts`（入口迁移，三个公开入口退场后逐条落定：以纯判据为题的用例（(a)–(h2) · (j)–(l) · (m) 的两处门调用 · (p) · **(i) 的 `inputRefusal(reviewFrameOf())` 调用**——它问的是纯判据，与同一用例里的 `step()` 断言是两件事，只有后者留下）把**期望字面量原样**搬到契约判据（`PreFlightRows.judge`）这个入口下并把家搬到下一条的契约测试文件；(p) 的 `mode` 参数与预览豁免随 `mode` 退场重写成「同一判据、任何面无存在性读」；(n) 的「一次装配」改在它新的归属处断言（`#runDispatch` 零判定调用 · `#valuesOf` 只读组合根交来的记录 · 组合根的 composer 恰好一次）；(i) 与 (m) 的 `step()` 断言 · 两个 async 用例留在原文件不动；(o) 的封闭集断言不属于面，随它读的模块一起搬走——新家是下一条的契约测试文件，pin 改读 `contract/context-declarations.ts`（两词的唯一声明处），`face/words.ts` 那一半随 `DispatchInputReason` 退役删掉）
- Test: `packages/cdd-engine/src-next/contract/__tests__/preflight-rows.test.ts`（承接上一条搬来的纯判据用例：它们的期望字节不变，夹具换成契约判据自己的输入——声明行由 `TemplateAssembler#layoutOf` 取，场景事实 · 快照 · 目标面是平值；一个判据一份字节断言，面侧只留钉接线的用例；case (o) 也落在这里——它 pin 的两词闭集现在由 `contract/context-declarations.ts` 声明，它自己的源码读法因此指向声明处而不是 `face/words.ts`）

#### Consumes
- Task 4 的 `PreFlightVerdict`（`gate` / `message` / `details` / `order`）与组合根交下来的那份**装配好了的平值记录**（DispatchValues 的输出：渲染器读它，不再自己从帧推）
- `Preview.artifactBlock`（既有，预览的拒绝块）

#### Produces
- `CliLifecycle` 的派发前判定面只剩「交付」：渲染读的那份值是组合根交过来的那一次装配（`#valuesOf` 的体成为对它的读，不再从帧重组一份）；判定一律来自缝合。
- 判据的命名豁免退场：PreFlightRowsInput 只剩四个值 + 声明行 + 场景事实 + 词面，引擎写的格在每一面、每一种模式下同一个判据。
- `Preview` 的 `--dry-run` 分支只渲染五行预报 + 判定块，不再自己做门判定。
- `Cli#runWork` 的 `--dry-run` 臂只剩「取帧 → 渲染五行预报」：它不再自己问三道门，也不再自带一支 `Preview#artifactBlock` 拒绝分支——拒绝面统一由组合根那一支陈词（Task 6）。

#### Steps
- **Step 1: 写五条失败测试**（一次派发只判一次 · 门拒绝分支零封名调用 · 预览块与被拒同源逐字节相同 · 丢掉 in-flight 锁的那次派发仍封回本轮两个名字：`#inflight.acquire` 抛 `HoldingError` 之后两条 carrier 名都不可写 · **循环里的镜像退役**：`cdd implement --tasks 1 --plan <plan> --dry-run` 经 `Cli#runWork` 的循环跑一次，`PreFlightRows.judge` 的 spy 恰好一次，而 `--dry-run` 的出口只余预览块与一行 `refused:`） — checkable: `lifecycle.test.ts` 与 `preview.test.ts` 各多出对应用例（第四条在 `lifecycle.test.ts`），第五条在 `cli.test.ts`（循环是 cli 面的，preview 面的测试到不了它；三个门方法已不存在，它们的「零调用」由 Step 3 的源码零命中守）
- **Step 2: 跑测试确认红** — checkable: 三个面测试文件报红，原因指向仍在的第二次判定
- **Step 3: 删派发体四门 · 删门拒绝分支的封名 · 删循环的三门镜像 · 预览改为读 verdict** — checkable: `rg -n 'sealRoundCarriers' packages/cdd-engine/src-next/face/lifecycle.ts` 只剩定义对（`#sealRoundCarriers` / `#sealRoundCarriersOf`）与三条**非门**调用——abort 记账（`#bookAbort` 里的 `#sealRoundCarriersOf(op, "wave", …)`）· 丢掉锁的那次派发（`#inflight.acquire` 的 `catch` 里的封名：gate→acquire 竞态下这两条名字都得封回，否则下一次 preflight 的孤儿清扫才收得回）· 终止处理器里的死亡路径封名（P31 T5 §2.4：kill / timeout / crash 之后仍须封，必须保留）；carrier · dispatch-input · artifact 三处门拒绝分支零命中；`rg -n 'carrierRefusal|artifactRefusal|inputRefusal' packages/cdd-engine/src-next/face -g '!**/__tests__/**'` 零命中（镜像与三个公开入口随它们唯二的生产调用点一起退场，不是把 `, "preview"` 删掉留下第二判官）；只服务那三个入口的私有机械也零命中（`rg -n 'inputRefusalOf|artifactRefusalOf|artifactCellOf|artifactReadOf|requesterDigest|rulingsInputOf|answeredByNaming|NO_ARTIFACT|ArtifactCell' packages/cdd-engine/src-next/face -g '!**/__tests__/**'` 零命中，且 `rg -n 'artifact-reads' packages/cdd-engine/src-next/face` 零命中——留着它们就是留一条没有活读者的 artifact 读取路径，下一手会当它是第二份事实源）；行合成的第二处与两词闭集的第二处声明也零命中（`rg -n 'Words#dispatchInput|DispatchInputSegment|DispatchInputReason' packages/cdd-engine/src-next/face -g '!**/__tests__/**'` 零命中——判据接管后同一条句子只剩一个合成点、同一个闭集只剩一处声明）
- **Step 4: 跑绿 + 全 face 面 + 迁移后的判据面** — checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/face/ src-next/contract/` 全绿（含入口迁移后的 `dispatch-input.test.ts` 与承接它的 `contract/__tests__/preflight-rows.test.ts`）；`rg -n 'answeredByNaming|#valuesOf\(' packages/cdd-engine/src-next/contract` 零命中（豁免格与帧推演不进判据）
- **Step 5: 提交** — checkable: `git show --stat HEAD` 含 `lifecycle.ts`、`preview.ts`、`cli.ts`、`contract/preflight-rows.ts` 与五个测试文件（`cli.test.ts` · `preview.test.ts` · `lifecycle.test.ts` · 迁移的 `dispatch-input.test.ts` · 承接搬入用例的 `contract/__tests__/preflight-rows.test.ts`）

#### Acceptance
一次派发只判一次（`PreFlightRows.judge` 的 spy 计数 = 1，含 `--dry-run` 经循环那一次）；门判的值与提示词渲染的值是同一个 composer 的同一次输出（渲染侧不再从帧重组一份）；判据侧零命名豁免（引擎写的格在四个面、两种模式下同一个判据，`naming` 输入已不存在）；三个公开判定入口在 `src-next/face` 的产物里零命中——它们随门退场，不是留成委托壳（留壳就会把 `#valuesOf` 的帧重组重新挂回一个公开方法）；**门拒绝分支**零封名调用（按谓词核，不按条数：`rg -n 'sealRoundCarriers'` 在 `face/lifecycle.ts` 只余三条非门调用——`#bookAbort` 的 `#sealRoundCarriersOf` · `#inflight.acquire` 的 `catch` 封名 · 终止处理器的死亡路径封名，后两条分别是 gate→acquire 竞态与 P31 T5 §2.4 的晚落地保证，不得随本任务退役）；丢掉锁的那次派发仍把本轮两个名字封回；预览块与命令面同源；**私有机械不留在场上**（`#inputRefusalOf` · `#artifactRefusalOf` · `#artifactCellOf` · `#artifactReadOf` · `#requesterDigest` · `#rulingsInputOf` · `#answeredByNaming` 与 `ArtifactCell` · `NO_ARTIFACT` · `artifact-reads` 的三个 import 在 `src-next/face` 的生产代码里零命中——它们失去读者后不会让任何一条门转红，所以这条零命中就是它们唯一的登记；同一条零命中收下 `Words#dispatchInput` · `DispatchInputSegment` · `DispatchInputReason`——行合成的第二处与两词闭集的第二处声明，而 `Words#artifactIdentity` 留下（board 夹具的簿记，读的是同一张表））；面测试的入口迁移逐条落定、无一条断言随入口消失而没有归属（纯判据用例的期望字节原样落进 `contract/__tests__/preflight-rows.test.ts`——含 (i) 的 `inputRefusal` 调用，(n) 在装配的新归属处断言，(p) 重写为「同一判据、任何面无存在性读」，(i) 与 (m) 的 `step()` 断言 · 两个 async 用例留原文件，(o) 搬到契约测试文件并改读声明那两词闭集的模块，`face/words.ts` 那一半随它退役）；`src-next/face/` 与 `src-next/contract/` 全绿。

#### DependsOn
4

### Task 6: 组合根：写、清、dry-run 守卫、宿主探针

#### Objective
组合根是唯一写者与唯一清除者，且两者对称：`vet` 返回后，`structureRefusal(preflight) !== null` 且**非** `--dry-run` ⇒ 写记录；`=== null` 且非 `--dry-run` ⇒ 清除。宿主只探一次，交值给缝合、派发体与预览三处。派发体的释放点上补第二个清除触发，带 `in-flight` 谓词。

`--dry-run` 上的入口也在同一段收成一个：`runWork` 里 `verdict.leg === "structure"` 那一支今天在 `--dry-run` 上分岔成两条出口（`in-flight` 且有活主走 `Preview#heldBlock`，其余走 `#renderPreflightBlocked`），此后整条结构腿的拒绝在 `--dry-run` 上一律由预览面陈述——stdout 的预览块 + 一条 `  refused:  station · detail` 行，`CDD_BLOCKED:` 不出现在任何流上，details 行与 checked 面仍在 stdout；`in-flight` 有活主那一臂按 spec 2.4 保留 `lock:` 面与接管提示、无 `refused:` 行。入口合并改写的是拒绝的**流与出口**，不是判据——两种出口念的是同一条活判词（Task 4 的 verdict）。随入口合并而来的是 exit 码：no-host 成了一道门之后，无 harness 的树里 `--dry-run` 从「五行预报 + exit 0」变成「预览块 + exit 1」，有 harness 的树仍预报、仍 exit 0（spec 具名变更③）。

宿主值的三处读者在这一任务里同时落地（**派发路径上恰好一次探测**）：（a）`PreFlightContext.host`（no-host 行）；（b）`CliLifecycle` 的 spawn 读注入的 `HOSTS[值]`，`#runDispatch` 顶部那次 `detectHost()` 调用、它的提前 return 与它印的 `CDD_BLOCKED: no host harness detected …` 字面同批退役，`CliLifecycle#detectHost` 这个只被那一处调用的适配方法随之退场；（c）`face/preview.ts#Preview` 的构造器改收宿主值，`child:` 行的 `(no host detected — real run would BLOCK)` 分支与钉它的那条测试一并退役。派发路径之外的三处 `HostDetect.detect` 读取（`CliGate` 的 `#renderer` · `Cli#runBoard` · `Cli#runWork` 的 `Capsule`）不动。 两个构造器改收值之后，四个测试文件里的调用点同批迁居（`lifecycle.test.ts` · `dispatch-input.test.ts` · `preview.test.ts` · `session/__tests__/reviewed-identity.matrix.test.ts`）——只迁调用形状，断言一律不改；`tsc --noEmit` 是这条迁移的判据（Step 4）。调用点数以迁移后的实况为准（迁移前 18 处：`lifecycle.test.ts` 9 · `dispatch-input.test.ts` 5 · `preview.test.ts` 3 · `reviewed-identity.matrix.test.ts` 1）——Task 5 的入口迁移把 `dispatch-input.test.ts` 里的纯判据用例搬走，那一处的数因此会少了，按 `rg` 定位而不是按本行的旧计数核。

#### Files
- Modify: `packages/cdd-engine/src-next/face/cli.ts`（`runWork` 的 vet 之后、`ensure()` 与 `#renderChecked` 之间的三段；`host` 探针一次并把值交给三处；释放点清除；`--dry-run` 上结构腿拒绝的出口收束与 exit 码成对）
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（构造器收注入的宿主值；spawn 读 `HOSTS[值]`；`#runDispatch` 顶部的 `detectHost()` 调用与 no-host 字面退役；释放点的清除谓词）
- Modify: `packages/cdd-engine/src-next/face/preview.ts`（构造器改收宿主值；`child:` 行直读那张表，空值分支退役）
- Modify: `packages/cdd-engine/src-next/session/dispatch-authority.ts`（structure 腿的 reason 渲染按九行取值，沿用 `#message` 的「reason 分隔 detail」形状）
- Test: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`
- Test: `packages/cdd-engine/src-next/face/__tests__/dispatch-input.test.ts`（仅迁 `CliLifecycle` 的构造调用，断言零改动）
- Test: `packages/cdd-engine/src-next/face/__tests__/lifecycle.test.ts`（仅迁 `CliLifecycle` 的构造调用，断言零改动）
- Test: `packages/cdd-engine/src-next/face/__tests__/preview.test.ts`（仅迁 `Preview` 的构造调用，断言零改动）
- Test: `packages/cdd-engine/src-next/session/__tests__/reviewed-identity.matrix.test.ts`（仅迁 `Preview` 的构造调用，断言零改动）

#### Consumes
- Task 2 的 PreFlightRefusal（`write` / `clear` / `read`）
- Task 4 的 `PreFlightVerdict`、Task 5 的派发体入口（整条腿已过）
- `InFlight#release` 的唯一调用点：`face/lifecycle.ts` 派发体里那一次 `await this.#inflight.release()`（符号定位，不写行号——实现者每轮自行重新定位；`face/cli.ts` 与 `session/run.ts` 都不是它的家）
- `HOSTS` 与 `HostDetect.detect`（`face/host.ts`）——宿主值的唯一拼写表与唯一探针
- `Preview` 的构造器（`face/preview.ts`）——宿主值改从构造器入

#### Produces
- `Cli#runWork` 的三段：探宿主 → `vet` → 拒则写 / 通则清 → `#renderChecked` → `ensure()` → `renderBrief`；探到的那一个值同时交给 `PreFlightContext`、`CliLifecycle` 与 `Preview`。
- 释放点清除：`release()` 之后读记录，`station === "in-flight"` 才清。

#### Steps
- **Step 1: 写十三条失败测试**（拒绝不写轮记录且重派仍 `review 1·1` · 记录八字段齐 · 通过即清 · `--dry-run` 零写零清 · `tree-clean` 站名不被释放清掉 · **释放即到期（按记录核）**：A 持 in-flight 时 B 在 `in-flight` 行被拒并写下 `station: in-flight` 的记录，A 随后正常结束并释放 ⇒ `read()` 回到 `absent`（board 上两行的并存与同消由 Task 7 按同一条事实断言，本任务不读 board） · **门口清除先于 line 腿**：记录由一次 `tree-clean` 拒绝落下，把树弄干净，再跑一次九行全过、而 line 腿拒绝的派发（`implement` 相位的 wave 上 `cdd review`）⇒ exit 1 且念 line 腿那一行，board 无 `refused:` 行 · **字节面按站名核**：四个门各真跑拒绝一次，首行分别是 `CDD_BLOCKED: no-host · …` / `carrier · …` / `dispatch-input · …` / `artifact · …`，且五行既有行与 `dispatch-input` 一行与改前逐字节相同（成对：先钉改前字节）、artifact 的四段续行（`derived:` · `found:` · `identity:` · `repair:` 占两行）跟随首行而 refusal.json 里没有它们 · `--recover` 不认领且 refusal.json 仍在、`station` 与被拒那一刻相同 · approved 派发的 `checked:` 面在 implement / review / fix 三个 fixture 上各断言一次**该面的**行名集合（wave fixture 是八行：`tree-clean` · `in-flight` · `graph` · `plan-ledger` + 四新行；`doc-contract` 不在 wave 面上，断言不许连它一起点名），四新行一律 always · `--dry-run` 入口收成一个：脏树上三动词各跑一次，stdout 出现预览头 + 一条 `  refused:  station · detail`，`CDD_BLOCKED:` 在两个流上都零命中 · 无 harness 树的 `--dry-run` 是预览块 + exit 1（成对：有 harness 的树仍五行预报 + exit 0） · `in-flight` 有活主的 `--dry-run` 仍是 `lock:` 面与接管提示、无 `refused:` 行） — checkable: `cli.test.ts` 多出十三条用例
- **Step 2: 跑测试确认红** — checkable: 该文件报红，首条用例的失败信息即改前实况（`crashed:` 行仍在）
- **Step 3: 接线**（探针一次并把值交给三处 · 派发体与预览改读值 · 拒则写 / 通则清 · 释放点按 `in-flight` 谓词清 · `--dry-run` 的结构腿拒绝收成预览面一个出口） — checkable: 写与清在 `runWork` 同一段内且共用 `!parsed.dryRun`；`--dry-run` 分支上 `#renderPreflightBlocked` 零调用（只剩预览块一条出口），`Preview#heldBlock` 仅存于 `in-flight` 有活主那一臂；`rg -n 'HostDetect.detect' packages/cdd-engine/src-next -g '!**/__tests__/**'` 只剩组合根与三处具名面外读者（共四命中），`CliLifecycle#detectHost` 零命中
- **Step 4: 跑绿 + 派发面全量 + 类型门** — checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/face/ src-next/session/` 全绿，且 `pnpm exec tsc --noEmit -p packages/cdd-engine` exit 0（两个构造器的十八个调用点已连同四个测试文件一并迁居）
- **Step 5: 提交** — checkable: `git show --stat HEAD` 含 `cli.ts`、`lifecycle.ts`、`preview.ts`、`dispatch-authority.ts` 与 `cli.test.ts`

#### Acceptance
十三条测试全绿；写与清在同一处、同一 `!parsed.dryRun` 守卫；`--dry-run` 上的结构腿拒绝只有一个出口且只走 stdout（`CDD_BLOCKED:` 在两个流上零命中，`in-flight` 有活主那一臂的 `lock:` 面成对不变），无 harness 的树 exit 1、有 harness 的树 exit 0；`--recover` 路径上 refusal.json 仍在且 `station` 不变；三面各有一条 `checked:` 行名集合断言——按面取该面的既有行再加四新行（implement / review / fix 的 wave fixture 是八行：`tree-clean` · `in-flight` · `graph` · `plan-ledger` · `no-host` · `carrier` · `dispatch-input` · `artifact`；`doc-contract` 只在 doc 面上出现，九行是 `plan` 面的行数、不是每次派发的行数），写行名与适用面、不写整块快照；`--dry-run` 零写零清；`tree-clean` 站名的记录不被一次释放清掉，而 `in-flight` 站的那条被持有者的一次释放清掉（按 `read()` 核；board 上两行的并存与同消属 Task 7）；九行全过而 line 腿拒绝的那次派发之前，记录已由门口清除（board 无 `refused:` 行）；四个门各真跑拒绝一次，首行各带自己的站名，五行既有行与 `dispatch-input` 一行逐字节同改前，artifact 的四段续行跟随首行而 refusal.json 无续行；重派仍是 `review 1·1`；**派发路径上恰好一次宿主探测**（`rg -n 'HostDetect.detect' packages/cdd-engine/src-next -g '!**/__tests__/**'` 四命中：组合根 + `CliGate` 的 `#renderer` + `Cli#runBoard` + `Cli#runWork` 的 `Capsule`），`#runDispatch` 顶部那份 no-host 字面与 `Preview` 的 `child:` 空值分支均已退役；两个构造器的调用点已全部迁居（计数按 Task 5 入口迁移后的实况，不按迁移前的 18 处：`pnpm exec tsc --noEmit -p packages/cdd-engine` exit 0）。

#### DependsOn
2, 4, 5

### Task 7: board 的两行

#### Objective
board 在 `in-flight:` 之后念一条 `refused:` 行，读的是记录里的 `station` + 单行 `detail`；记录不可读时念一条自己的 corrupt 行，绝不静默视作「没有拒绝」。两行都不参与聚合、不影响计数与 `next:`。

两行的**关系**也在这里断言，因为它是 board 的渲染事实：`in-flight:` 与 `refused:` 可以并存（「因为正在跑而被拒」是腿的第 2 行），而两者各自的事实到期时两行同消——夹具直接经 Task 2 的记录写/清 API 与 in-flight 状态驱动，board 只渲染事实、不参与清除（清除的两个到期点属 Task 6）。这两条断言住在这里，因为只有本任务产出 `refused:` 行；把它们留在 Task 6 就是让一个不拥有该行的任务去断言它。

#### Files
- Modify: `packages/cdd-engine/src-next/face/board-view.ts`（`refusalRows(state, words)`，与 `inFlightRows` 并列装配）
- Modify: `packages/cdd-engine/src-next/face/words.ts`（`refused:` 行的一处构造 + 一句 corrupt 词，与 `in-flight` 的 corrupt 词并排）
- Test: `packages/cdd-engine/src-next/face/__tests__/board-view.test.ts`

#### Consumes
- Task 2 的 RefusalState（三态）
- `BoardView.inFlightRows` 的装配位置与 `words` 面（既有）
- in-flight 的站立状态（`session/inflight.ts` 的读面，既有）与 Task 2 的记录写/清 API——并存与同消两条断言靠它们驱动，不借 Task 6 的接线

#### Produces
```ts
// 一条 token 的行：` · ` 在此是行的内容，不是 token 分隔符
static refusalRows(state: RefusalState, words: Words): readonly string[];
// 形状（围栏，非既有坐标）——轮标识与 `crashed:` 的 token 同一拼写（{cycle}·a{attempt}）
//   refused: {op} {cycle}·a{attempt} {station} · {detail}
//   refused: review 1·a1 dispatch-input · review · BASE_BRANCH · empty-value
//   refused: unreadable refusal record
```

- 行的轮标识不是新写法：它是 `face/board-view.ts` 的 `#crashTokens` 已经在念的 `{cycle}·a{attempt}`（spec §3.1），因此同一张板上的 `crashed:` 与 `refused:` 说的是同一个轮身份；两个面各自的**外层**不同（`crashed:` 无前缀、`refused:` 带 `{op} {cycle}·a{attempt} `），但标识的拼写只有一种。

#### Steps
- **Step 1: 写六条失败测试**（standing 的形状与位置——首条用例钉住 `refused: review 1·a1 dispatch-input · …` 的字节，`a` 与 `crashed:` 的 token 同形，一条不带的写法当场红 · corrupt 行且 exit 0 · absent 零新行且既有行逐字节不变 · 跨工作区两向 · **两行并存**：`in-flight` 有活主且记录站在 `in-flight` ⇒ board 先印 `in-flight:` 再印 `refused:`，两行不必互斥 · **两行同消**：同一夹具里记录被清、持有被释放 ⇒ 两行一起消失，不出现只剩一行陈述陈旧事实） — checkable: `board-view.test.ts` 多出六条用例
- **Step 2: 跑测试确认红** — checkable: 该文件报红，原因指向缺失的 refusalRows
- **Step 3: 实现两行与词面**（三态分派 · 词进一处） — checkable: board 输出里 `refused:` 紧跟 `in-flight:`
- **Step 4: 跑绿 + board 面** — checkable: `board-view.test.ts` 与 `face.test.ts` 全绿
- **Step 5: 提交** — checkable: `git show --stat HEAD` 含 `board-view.ts`、`words.ts` 与 `board-view.test.ts`

#### Acceptance
三态各自可核，含跨工作区的一对方向；`refused:` 紧跟 `in-flight:`，行内轮标识的拼写与 `crashed:` 一致（`{op} {cycle}·a{attempt} {station} · {detail}`，首条用例钉住字节）；`in-flight:` 与 `refused:` 可并存，且记录清除与持有释放之后两行同消（成对，夹具经记录 API 与 in-flight 状态驱动，board 只渲染）；corrupt 不静默、不 exit 1；`absent` 时既有行逐字节不变。

#### DependsOn
2

### Task 8: changeset · 章程回填 · 全量门禁

#### Objective
把这一轮的消费面变化登记齐：changeset 一条 `minor`、章程的 P40 两格与版本、spec 与 plan 的版本与 change history、P38 spec 上的一条换向记录，然后跑全量门禁。

#### Files
- Create: `.changeset/p40-preflight-refusal.md`
- Modify: `docs/kairos/overalls/2026-10-10-engine-doc-tooling-overall.md`（P40 两格状态与 version）
- Modify: `docs/kairos/specs/2026-11-17-engine-doc-tooling-p40-design.md`（version + change history）
- Modify: `docs/kairos/plans/2026-11-17-engine-doc-tooling-p40.md`（version + change history）
- Modify: `docs/kairos/specs/2026-11-17-engine-doc-tooling-p38-design.md`（spec §1.1 的具名要求：只在 change history 追加一条指向本相位的换向记录——P38 的历史行原样保留，不重写）

#### Consumes
- Task 1–7 的交付事实

#### Produces
- `.changeset/p40-preflight-refusal.md`：`cdd-engine: minor`，正文**逐条**点出 spec Constraints 的六处具名变更，不概括、不合并：① `no-host` · `carrier` · `artifact` 三行的首行多一段站名（detail 文本不变）· ② `--dry-run` 上的结构腿拒绝改由 stdout 的预览块陈述 · ③ 无 harness 树里的 `--dry-run` 从「五行预报 + exit 0」变为「预览块 + exit 1」· ④ 每次派发的 `checked:` 面各多四行（既有钉读字节随动，`carrier` 与 `artifact` 在非 fix 面上空格短路仍记一行）· ⑤ board 的两行（`refused:` 与不可读记录的 corrupt 行，含新产物 refusal.json）· ⑥ 两腿同时不合格时报文从 line 腿改归结构腿。六行里 ②③ 是同一个入口的两个面，写在同一行的两半；④ 是独立一行，因为它的字节移动是每个消费者都看得见的。
- 章程 P40 两格与文档版本同步到交付后的状态。
- P38 spec 的 `INPUT_WAVE_BRIEF` per-mode 豁免已被本相位退役，那条换向记录是它自己的指向：历史行不改，版本 +1 与历史行同批。

#### Steps
- **Step 1: 写 changeset**（`cdd-engine: minor`，正文六行对应 spec Constraints ①–⑥，`checked:` 面那一条单独一行） — checkable: `.changeset/p40-preflight-refusal.md` 存在且六条具名变更齐（`rg -n 'checked:'` 在该文件上有命中，refusal.json 与 `refused:` 也在其上）
- **Step 2: 回填章程与文档版本**（P40 两格 Done · 章程与 spec/plan 各 +1 与历史行 · P38 spec 追加一条换向行并同批 +1） — checkable: 四份文档的 front-matter 版本与最新历史行一致
- **Step 3: 全量门禁** — checkable: `pnpm run validate` exit 0
- **Step 4: 提交** — checkable: `git show --stat HEAD` 含 changeset 与四份文档

#### Acceptance
`pnpm run validate` exit 0；`pnpm run emit:check` 无漂移；changeset 级别为 `minor` 且正文六条对应 spec Constraints ①–⑥（无漏项：`checked:` 的四行 · board 两行与新产物 · 三行站名前缀 · `--dry-run` 的入口与 exit 码 · 两腿归属）；章程与三份文档（P40 spec · P40 plan · P38 spec）的版本、历史行与交付事实一致，P38 的历史行未被改写。

#### DependsOn
1, 2, 3, 4, 5, 6, 7

### Task 9: 提交钩子 husky + lint-staged → lefthook

#### Objective
提交门换由 lefthook 承担，行为等价、语义逐条断言：`biome check` 仍**不带** `--write`（一条格式违规必须让提交失败且不写回），`pnpm run precommit` 仍每次提交跑一次、仍排在 `biome check` 之后。等价性不靠「看起来一样」：已删除文件在 lefthook 的 `{staged_files}` 里与 lint-staged 不同，必须由一次真实提交判定。本任务按用户裁定并入本相位（章程 v4.21 的 scope amendment），与 §1–§4 无契约关联，不产生 changeset。

#### Files
- Create: `lefthook.yml`
- Modify: `package.json`（删 `prepare: husky` 与 `husky` / `lint-staged` 两个 devDependency，加 `lefthook` devDependency、`prepare` 改为安装 lefthook）
- Modify: `pnpm-lock.yaml`（随依赖增删更新）
- `AGENTS.md` **不在改动面**：它两处只讲行为（`pnpm run precommit` 是钩子跑的 · 钩子跑 `biome check` 不带 `--write`），从不指名 husky 或 lint-staged，迁移后两句依然成立。验收里把它作为可核事实断言，而不是去改一句本来正确的话。
- Modify: `.husky/pre-commit`（删除）· `.husky/_/`（删除整个 shim 目录）
- Modify: `lint-staged.config.ts`（删除）

#### Consumes
- 今日提交门的实况：`.husky/pre-commit` 一行 `pnpm exec lint-staged`；`lint-staged.config.ts` 的 `{"*.ts": ["biome check"], "*": ["pnpm run precommit"]}`；`package.json` 的 `prepare: husky` 与 `husky ^9.1.7` / `lint-staged ^17.6.0`
- `pnpm run precommit`（既有脚本，内容不变）
- lefthook 2.2.2（npm 当前最新）

#### Produces
```yaml
# lefthook.yml 的两条命令（顺序即今天的 lint-staged 任务序）
pre-commit:
  parallel: false
  commands:
    biome:      { glob: "*.ts", run: "pnpm exec biome check {staged_files}" }
    precommit:  { run: "pnpm run precommit" }
```
- `package.json`：`"prepare": "lefthook install"`；devDependencies 含 `lefthook`，不含 `husky` / `lint-staged`。

#### Steps
- **Step 1: 写 lefthook.yml**（两条命令、`parallel: false`、顺序 biome → precommit） — checkable: 文件存在且 `lefthook install` 接受它（安装无报错）
- **Step 2: 换依赖与 prepare**（删 husky/lint-staged，加 lefthook，`prepare: lefthook install`） — checkable: `node -e` 读 `package.json` 得 prepare 与 devDependencies 三态正确，且 `pnpm install` 更新 lockfile 无冲突
- **Step 3: 删两处旧机制**（`.husky/` 整目录、`lint-staged.config.ts`） — checkable: 两者在树上都不存在（`ls` 与 `rg --files` 各零命中）
- **Step 4: 安装钩子** — checkable: `git config core.hooksPath` 不再是 `.husky/_`，且 `.git/hooks/pre-commit` 存在
- **Step 5: 三条等价性实测（在临时树里跑）**（坏 `.ts` 被拦且文件未被写回 · 删一个 `.ts` 后提交不红 · 干净提交的日志里出现 `pnpm run precommit` 那一次）——三条都要真实提交才证明得了，而交付分支只应留 Step 7 的一次原子提交，`git worktree` 又被本仓规则禁止：因此把当前工作树连 `.git` 整棵复制到临时目录（`cp -R`——Step 1–4 的改动还没提交，`git clone` 只带已提交内容），在那里跑 `lefthook install` 并摆夹具，三次提交落在临时树里。 — checkable: 三次真实提交的 exit code 分别为 1 / 0 / 0（日志取自临时树），且第一次之后该临时树的 `git status` 显示该文件仍被修改；交付树上 `git log --oneline` 因此只有 Step 7 那一次提交
- **Step 6: 全量门禁** — checkable: `pnpm run validate` exit 0
- **Step 7: 提交** — checkable: `git show --stat HEAD` 含 lefthook.yml · package.json · pnpm-lock.yaml 与两处删除（Step 5 的三次提交不在本树，不在这条 —stat 里）

#### Acceptance
坏格式的 `.ts` 被拦且**未被写回**（`biome check` 不带 `--write`）；删除一个 `.ts` 后提交不红；干净提交通过且日志含 `pnpm run precommit` 的运行（三条实测在临时树里跑，交付分支只留一次原子提交）；`.husky/` 与 `lint-staged.config.ts` 不在树上、`husky` / `lint-staged` 在 `package.json` 与 `pnpm-lock.yaml` 的依赖面零命中；`prepare` 安装 lefthook；`AGENTS.md` 零改动（它不指名机制，规则迁移后仍成立——由 grep `husky\|lint-staged` 在 AGENTS.md 零命中断言）；`pnpm run validate` exit 0；无 changeset（本任务不改任何 first-party package 的行为）。

#### DependsOn
1, 2, 3, 4, 5, 6, 7, 8

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.16 | 2026-11-18 | 第九轮 fix 轮（F1–F6 全采纳）：① **判词装配写明剥站名**——`PreFlightVerdict.message` 是该行 detail 首行剥掉串首站名后的余下部分，`DispatchAuthority#message` 是唯一把它放回串首的位置；RowWording 的 dispatchInput 因此补齐 station 与 stationJoin 两格（判据按它拼出今天的字节），原句「`message` 已经是 `station · detail` 那一句」删除（F1）；② **快照两臂都有生产者**——Task 4 的 `cli.ts` 一行写明 reviewsPath 三选一之后由既有的无帧缝 `ArtifactReads#read` 判读写、`CarrierMismatchError` 映射成 mismatch 臂（载体事实取自 `CarrierIntegrity` 的 `facts()`），并加一条成对用例喂两臂，Task 5 退役 `#artifactCellOf` 之后它仍是唯一生产者（F2）；③ **判据收 fs 一格**——输入格增 `fs: DocFs`（与 `JudgeContext` 同形），`PreFlight#vet` 把它构造期注入的那一个交下来，判据不 new `NodeFs`，「路径格缺失」用假 fs 就能核（F3）；④ **行合成与闭集的第二处声明退役**——`Words#dispatchInput` · `DispatchInputSegment` · `DispatchInputReason` 进 Task 5 的 files · 零命中 grep · 验收，两词闭集改由 `contract/context-declarations.ts` 的 ExigibleReason 唯一声明，case (o) 搬到契约测试文件并改读该模块，`Words#artifactIdentity` 留下并写明理由（F4）；⑤ **Task 4 的验收回到这一波能证的事**——「同一份输出」改为「与 `#valuesOf` 逐字相同」，单一消费者是 Task 5 的 spy 判据（F5）；⑥ **首稿指针改标 P38**——`ExigibleCells.resolve` 的 docstring 改念 P38 spec §1.3 / §2.2（F6）。Task id 集与 `DependsOn` 集未动 | Oscaner M. · Claude |
| v0.15 | 2026-11-18 | 第八轮 fix 轮（F1–F4 全采纳）：① **判槽的归约变成可观测的一条**——`TemplateAssembler.engineWrittenSlots` 把三处 `written: "engine"` 声明归约成一槽，构造期断言消费它，每个槽的首个载体花掉一条待判项；测试改钉归约本身（三处声明 → `[INPUT_WAVE_BRIEF]`），删掉归约即红（实测：把 Set 换成 push 的副本上该用例 1 failed / 32 passed），原先那条「同槽跨行只判一次」的用例因 `#assertEngineWritten` 首个违例即抛、永不能为它所指的性质转红，随归约的 pin 到位而退役（F1）；② **Step 5 的提交形状补上 plan 回填**——实施提交 `8eb54813` 含第五个路径 `docs/kairos/plans/2026-11-17-engine-doc-tooling-p40.md`（v0.4 回填 +3/−1），判据原写四个路径，与树不符（F2）；③ **重复用例退役其一**——`templates.test.ts` 的拒绝用例与 `context-lines.test.ts` 的 (f) 是同一份；拒绝留在构造期判据 (a)–(g) 的家，`templates.test.ts` 只留 P40 专属的声明覆盖与归约两条（F3）；④ **声明计数按对象钉**——用例 1 的 `>= 3` 按行计（8 行）而其注释按声明计（3 处），现补一条声明对象的计数 pin 并把注释写成实测值（F4）。Task id 集与 `DependsOn` 集未动 | Oscaner M. · Claude |
| v0.14 | 2026-11-18 | 第七轮 fix 轮（F1–F5 全采纳）：① **判据的 `naming` 一格由缝合自答**——Task 4 写明 `PreFlight#vet` 传常量 `{ answered: false }`（`#answeredByNaming` 唯一的读者是预览臂的那道 `mode === "preview"` 守卫，引擎写的格的存在性腿已由 `written: "engine"` 抑制），它不占 context 的第六格：`PreFlightContext` 仍是五格，Step 3 的 checkable 与 Acceptance 因此与实现同形（F1）；② **`join` 规则收窄到路径面**——Task 3 的 Acceptance 与 repoRoot 那条从「`join` 零命中」改为「`path.join` 零命中且无 `node:path` 的 import」，`Array#join` 明确合规（`detail` 的续行与 artifact 两句 `repair` 正要用它，`face/words.ts` 今日同形）（F2）；③ **`details` 收首条之后的各条**——`#renderPreflightBlocked` 先印 `message` 再逐条印 `details`，收全部四条会让首条句子在块里印两遍；Task 4 的 Produces、Step 1 与 Acceptance 改为此形状并钉一条多违纪块的整块字节断言（F3）；④ **Task 9 的三次实测提交搬进临时树**——交付分支只留 Step 7 的一次原子提交，`git worktree` 又被规则禁止，Step 5 因此写明把工作树连 `.git` 复制到临时目录再跑（F4）；⑤ **两处单命中 grep 的 docstring 同批改述**——`#artifactRefusalOf` 与 `CarrierIntegrity` 的 docstring 各自把那条格式再念一遍，进 Task 3 的 Files 与搬家的字面同批改述，单命中判据因此成立（F5）。Task id 集与 `DependsOn` 集未动 | Oscaner M. · Claude |
| v0.13 | 2026-11-18 | 第六轮 fix 轮（F1–F8 全采纳）：① **缝合的五格输入各有生产者**——`PreFlightContext` 由四格改五格（`host` · `values` · `declarations` · `scene` · `artifact`），后两格由组合根交值（`#template.layoutOf(values)` 与 `scene.program` / `scene.docType` 布尔化），`(cycle, attempt)` 不随 context 走（它不喂任何一行，只进拒绝记录）——`session/` 因此不新增 `render/` 的 import（`render/templates.ts` 反过来 import `session/faces.ts`，那条边会成环）（F1）；② **board 行的轮标识与 `crashed:` 同拼写**——Task 7 的围栏改回 `{op} {cycle}·a{attempt} {station} · {detail}`，首条用例钉字节（F2）；③ **context 构造器的真实清单**——`waveCtx` · `docCtx` · `branchCtx` · `carrierCtx` 四个加一条，`plan-read-consistency.test.ts` 的 `preflightCtxOf` 进 Task 4 Files，计数改为五个构造器 / 43 处 `vet` 调用（F3）；④ **artifact 行的两个臂都有字面之家**——`RowWording.artifact` 增 `invalid` 格，present-but-unreadable 那句 `rulings sidecar — {reason}` 从 `face/lifecycle.ts` 迁进 `CAPSULE_WORDS.artifactIdentity`，并补一条单命中 grep（F4）；⑤ **死格与死词汇不登台**——判据的事实类型只留它自己读的两格（`type` · `host`），composer 的 scene 格少一格（rulings 路径改为由快照的 `read` 臂派生），`PreFlightReason` 不扩（四新行的措辞来自行的 detail）（F5）；⑥ **退役的私有机械逐个点名**——`#inputRefusalOf` · `#artifactRefusalOf` · `#artifactCellOf` · `#artifactReadOf` · `#requesterDigest` · `#rulingsInputOf` · `#answeredByNaming` 与 `ArtifactCell` · `NO_ARTIFACT` · `artifact-reads` 的三个 import 进 Task 5，并补一条零命中 grep（F6）；⑦ **(i) 的两半分开落定**——`inputRefusal(reviewFrameOf())` 随纯判据搬迁，只有 `step()` 断言留下（F7）；⑧ **平面句收窄**——`contract/` 不 import `session/` 只声明本任务两个新模块，既有三条 contract→session 边归 P39（F8）。Task id 集与 `DependsOn` 集未动 | Oscaner M. · Claude |
| v0.1 | 2026-11-18 | 首稿：八任务 / 六波（{1} → {3} → {2,4} → {5,7} → {6} → {8}）。判据抽 `contract/` 以避免 session→face 的新环（RowStation 是站名域的唯一声明，`PreFlightGateName` 以它扩四值）；brief 改记引擎写先行；记录晚于判据、早于接线；board 独立于接线；优先级位移与 `--recover` 各自成对验收；changeset 收尾 | Oscaner M. · Claude |
| v0.2 | 2026-11-18 | 评审修复一轮（F1–F5 全采纳）：判据的输入改为契约层自声明值（ArtifactSnapshot 两臂 + 平值记录），face 在调用点适配，Task 3 的 Consumes 改成真模块路径（F1）；`#inflight.release()` 的唯一调用点钉到 `face/lifecycle.ts` 派发体并加入 Task 6 Files（F2）；宿主值的三处读者与 `#runDispatch` 的 no-host 字面、`Preview` 的 `child:` 空值分支退役并入 Task 6（F3）；封名退场改写为谓词并点名存活的 abort 记账调用（F4）；`refusal` 名字扩为 `round-artifacts.ts` 的四个登记点（F5） | Oscaner M. · Claude |
| v0.3 | 2026-11-18 | 第二轮评审修复（F1–F3 全采纳）：① Task 1 的零命中判据收窄到 `render/` 切片（`templates.ts` 的声明与注释 prose + 两个测试文件，`render/__tests__/context-lines.test.ts` 补进 Files），全树零命中移入 Task 3——`face/lifecycle.ts#answeredByNaming` 要到 Task 3 才换判据，且 `face/__tests__/dispatch-input.test.ts` 的注释里也有一份旧字面量（该文件因此以「仅改注释、断言零改动」进 Task 3 Files），两处都到齐后全树判据才可转绿（F1）；② Task 5 的封名退场改成点名两条存活调用（`#bookAbort` 的 `#sealRoundCarriersOf` 与终止处理器的死亡路径封名），退役范围按谓词限定在四门拒绝分支，死亡路径封名写明必须保留（F2）；③ Task 6 补第七条测试与验收：approved 派发的 `checked:` 面在 implement / review / fix 三个 fixture 上各断言一次九行行名集合（spec 具名变更④此前无归属）（F3） | Oscaner M. · Claude |
| v0.4 | 2026-11-18 | 实施轮订正（Task 1）：`preview` 字段退场后 `face/lifecycle.ts#answeredByNaming` 的读取字段必须在同一提交内换成 `written: "engine"`，否则声明面与唯一读者脱节、预览豁免静默失效——该文件因此进 Task 1 Files（v0.3 的「Task 3 才换判据」作废）；本任务仍只换读取字段，不动 `mode` 守卫与 per-mode 例外，行为逐字节不变。Task 3 的其余职责（判据抽 `contract/preflight-rows.ts`、`dispatch-input.test.ts` 的旧字面量）不变（`mode` 守卫与 per-mode 例外的退场归 Task 5——本行原记在 Task 3 名下，订正于此） | Oscaner M. · Claude |
| v0.5 | 2026-11-18 | 第三轮评审修复（F1–F2 全采纳）：① `--dry-run` 入口合并（spec 具名变更②③）此前无归属——Task 6 是唯一改 `face/cli.ts` 的任务却只声明三段与七条测试，现补进 Objective 一段（`verdict.leg === "structure"` 在 `--dry-run` 上收成预览面一个出口，`in-flight` 有活主保留 `lock:` 面，no-host 成门后无 harness 树 exit 1）与 Step 3 的可核条件，并加三条成对测试（三动词 stdout 预览块且 `CDD_BLOCKED:` 双流零命中 · 无 harness exit 1 对有 harness exit 0 · 活主 `lock:` 面不变），七条改十条，Acceptance 同步（F1）；② Task 6 的 `--recover` 测试与 Acceptance 补上 spec 验收的拒绝记录存活子句「refusal.json 仍在且 `station` 与被拒那一刻相同」（F2） | Oscaner M. · Claude |
| v0.6 | 2026-11-18 | 第一波 fix 轮（F1 · 两条 blocker 全受理）：① **pin 迁到今日符号名**——Task 1 把构造期断言改名为 `TemplateAssembler#assertEngineWritten`，本计划 Task 1 Files 行随之改记今日符号名（旧名只作裸词保留，见第 ② 条同理）；② **未落地词汇退回裸词**——refusal.json · RowStation · DispatchInputFacts · RowRefusal · ArtifactSnapshot · PreFlightRefusal · RefusalState · refusalRows 在本相位落地前只在围栏块与裸词里出现，行内反引号是把它们钉成落地前就红的死 pin；约束「pin 写法」这一条由此在本计划自己的 14 处上兑现；③ 语料规模 pin 由实现侧同批抬到 83（新增本计划一份），`pins.guard` 与 `census.guard` 归零。Task id 集与 `DependsOn` 集未动 | Oscaner M. · Claude |
| v0.7 | 2026-11-18 | 第二轮 fix 轮（F1–F6 全采纳）：① **封名退场的谓词改正**——门拒绝分支是三处（carrier · dispatch-input · artifact），非门调用也是三条（`#bookAbort` 的 `#sealRoundCarriersOf` · `#inflight.acquire` 的 catch 封名 · 终止处理器的死亡路径封名），Task 5 的 Step 3 与 Acceptance 去掉「四条 / 两条」计数并逐条点名，Step 1 三条改四条（丢掉锁的那次派发仍封回两条名字）（F1）；② **验收方向补齐**——Task 6 补三条 spec AC③ 的方向（释放即到期 · 持有期间两行并存 · 九行全过而 line 腿拒绝后记录已不在），十条改十四条，Acceptance 同步（F2）；③ **字节面断言归位**——Task 6 新增一条按站名核的真跑字节面断言（四个门各念自己的站名前缀 · 五行既有行与 `dispatch-input` 一行逐字节同改前 · artifact 的四段续行跟随首行而 refusal.json 无续行），spec 的具名变更不再只靠 Task 5 的预览/命令同源那一条（F3）；④ **P38 换向记录进 Task 8**——`docs/kairos/specs/2026-11-17-engine-doc-tooling-p38-design.md` 进 Files，只追加一条指向本相位的换向行并同批 +1，P38 的历史行原样保留（F4）；⑤ **存在性读走路径基值对象**——`PreFlightRows.judge` 的 `repoRoot` 由裸字符串改为 `RepoRoot`，Consumes 补上该值对象，Produces 与 Acceptance 写明存在性读只经 `relativize` / `resolve` 一个转换点、模块内零 `join`（F5）；⑥ **归属订正**——Task 3 的 `#answeredByNaming` 只剩注释 prose（判据已在 Task 1 换成读 `decl.written`），v0.4 行里记在 Task 3 名下的「`mode` 守卫退场」订正为 Task 5 的活（F6）。Task id 集与 `DependsOn` 集未动 | Oscaner M. · Claude |
| v0.8 | 2026-11-18 | 第三轮 fix 轮（F1–F6 全采纳）：① **九行改成按面取行集**——`order` 的行数是面的函数（`graph` 仅 `wave` / `plan` 的 ready 读 · `plan-ledger` 仅 `plan` / `wave` / `branch` · `doc-contract` 仅四个 doc 面），Task 4 的「恒含九行」与 Task 6 的九行 `checked:` 断言改为按面取该面既有行加四新行（wave fixture 八行、`plan` 面九行），always 的只是那四新行（F1）；② **依赖方向判据改为「无新增」**——`session/preflight.ts` 今天已有 type-only 的 `Words` import（`contract/judge.ts` 凭同一豁免），Constraints 与 Task 4 验收的「不得 import `face/`」改为「不新增」并点名既有那一条留存（F2）；③ **四行词面有家了**——`face/words.ts` 与 `session/carrier-integrity.ts` 进 Task 3 Files（`no-host` 那句从 `face/lifecycle.ts` 迁入，spec §1.3；`carrier-mismatch` 模板提成静态常量），judge 改收参数对象 PreFlightRowsInput 并注入 RowWording：第五个输入因此不越参数上限，contract 仍零 import、模块内零句措辞（F3）；④ **循环里的镜像归位**——镜像的家是 `face/cli.ts#Cli#runWork` 的 `--dry-run` 臂，该文件与 `cli.test.ts` 进 Task 5 Files，Step 3 补三个门方法名在该文件的零命中判据，测试补一条经循环跑一次、判据一次/镜像零次的用例（F4）；⑤ **构造器迁移的十八处归位**——四个测试文件（`lifecycle` · `dispatch-input` · `preview` · `reviewed-identity.matrix`）进 Task 6 Files、只迁构造调用而断言零改动，Task 3 的「断言零改动」写明调用由 Task 6 同批迁移，Task 6 Step 4 补 `tsc --noEmit` 门（F5）；⑥ **`#answeredByNaming` 的退场写实**——它本身没有 `mode` 参数（签名 `(decl, token, frame)`），随 per-mode 例外退场的是方法整体（F6）。Task id 集与 `DependsOn` 集未动 | Oscaner M. · Claude |
| v0.9 | 2026-11-18 | 第四轮 fix 轮（F1–F7 全采纳，F1 / F2 / F3 / F5 / F6 / F7 六条按裁定落地）：① **判据的声明输入归位**——判据真正读的声明类型（`ContextLine` · `RequiredArm` · 两个 `when` 臂读的场景事实）与 exigible 格的解析搬进 `contract/` 的声明模块，`render/templates.ts` 反向 import 回来，声明表与它的选取器留在原处；PreFlightRowsInput 增 `declarations` / `scene` / `naming` 三格，声明行上的一处 `decl.written` 使引擎写的格零存在性读，空值那一腿到 Task 5 与声明合一，命名豁免因此有路可退（F1）；② **值的预帧装配成文件**——`face/dispatch-values.ts` 的 composer 无帧、无 workspace，吃声明好的平值吐平值记录，Task 4 Files 收入它并把单源保证写成条件（门判的值与渲染的值是同一次装配），Task 4 因此在组合根探一次宿主并把四格输入交进 context，Task 5 把渲染器接到同一次装配上（F2）；③ **reason 表随门名一起扩**——`session/next.ts` 进 Task 4 Files，`DISPATCH_REASON` 加四条 structure 行（token 即 RowStation 的四个值），Task 4 Step 5 补 `tsc --noEmit` 门，`structureRefusal` 的 `reason: gate` 不再靠 cast（F3）；④ **迁移点进 Files**——生产侧唯一 `vet` 调用（`face/cli.ts`）与 `preflight.test.ts` 的 `waveCtx` / `branchCtx` 及七个调用点进 Task 4，断言零改动，不把新输入改成可选（F4）；⑤ **carrier 那一句只有一处合成**——`RowWording.carrier` 退场，ArtifactSnapshot 的 `mismatch` 臂携带 carrier 事实（路径 + 两个 sha8，由 `CarrierIntegrity` 的事实取出），格式住新建的 carrier 行模块，抛错的 message 与拒绝行念同一条（F5）；⑥ **changeset 逐条登记**——Task 8 正文按 spec Constraints ①–⑥ 六行列举（含 `checked:` 面的字节移动与两腿归属），不再是四项概括（F6）；⑦ **两条 board 断言迁到 Task 7**——「释放即到期」改为按记录 `read()` 核留在 Task 6（十四条改十三条），「两行并存」与「两行同消」进 Task 7 并按记录 API + in-flight 状态驱动（四条改六条），图的声明未动（F7）。Task id 集与 `DependsOn` 集未动 | Oscaner M. · Claude |
| v0.12 | 2026-11-18 | **T9 的幻觉工作删除（编排者 plan 写权）**：`AGENTS.md` 从 Files 与 Steps 移出——它从不指名 husky / lint-staged，两处只讲行为，迁移后依然成立；改为验收里的一条零命中断言。教训：清单里每一项都要能回答「不改会怎样」，答不上来的就是幻觉工作 | Oscaner M. · Claude |
| v0.11 | 2026-11-18 | **并入 Task 9（用户裁定 · 章程 v4.21）**：提交钩子 husky + lint-staged → lefthook，八步、`DependsOn: 1–8`（排在六波之后，与本相位主线无契约关联）。三条等价性写成实测（坏 ts 被拦且不写回 · 删 ts 不红 · 干净提交跑过 precommit），并显式声明本任务不产生 changeset | Oscaner M. · Claude |
| v0.10 | 2026-11-18 | 第五轮 fix 轮（F1–F4 全采纳，F1 / F2 按裁定落地）：① **composer 的格补齐**——请求载体路径进 ArtifactSnapshot 两臂（composition 的输入格，spec §1.1 ② 把它判给 ArtifactCell），`tasks` 与 `(cycle, attempt)` 进 DispatchIdentity，`compose(identity, scene, artifact)` 三个参数，请求载体路径的无帧推演明写归组合根（`--reviews` 值 · 账本的已记录上游轮载体 · `RoundNaming` 的族名），DispatchInputFacts 不再重复存该值，Task 4 的成对断言因此在 wave 与 fix 两面各跑一次（F1）；② **目标面有自己的 contract 家**——`TargetType` 定义自 `session/faces.ts` 搬进 `contract/target-type.ts`（该文件改为 re-export，既有读者零改动），`ExigibleCells.resolve` 增第三个声明参数 `type`（`judge` 传 `facts.type`），Task 3 的 import 断言与 Step 3 的 grep 同口径写出 `face/` · `render/` · `session/` 三条并新增 `TargetType` 单定义 grep（F2）；③ **三个公开判定入口随门退场**——`carrierRefusal` · `artifactRefusal` · `inputRefusal` 与 `mode` 参数同批消失（留委托壳等于把帧重组挂回公开方法），`face/__tests__/dispatch-input.test.ts` 进 Task 5 Files 并按用例落定：纯判据用例的期望字节搬到契约判据入口并落 `contract/__tests__/preflight-rows.test.ts`，(n) 改在装配的新归属处断言，(p) 的 `mode` 与预览豁免重写，(i) · (m) 的 `step()` 断言 · (o) · 两个 async 用例留原处；Step 1 的第五条 spy 从三个门方法改为 `PreFlightRows.judge` 恰好一次，Step 3 的零命中 grep 从 `cli.ts` 扩展到 `src-next/face`；Task 6 的构造器调用点计数改为按迁移后实况核（F3）；④ **拼写表的第五个登记点是 `Kind`**——`round-artifacts.ts` 的登记点由四个改五个（漏 `Kind` 时 `ENTRIES` 与 `isWorkspaceKind` 编译不过），`round-artifacts.test.ts` 的行集清单进 Task 2 Files，Task 2 的 Step 5 补 `tsc --noEmit` 门与对应验收（F4）。Task id 集与 `DependsOn` 集未动 | Oscaner M. · Claude |
