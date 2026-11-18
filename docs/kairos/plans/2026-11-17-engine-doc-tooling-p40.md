---
title: 'P40 · 派发前拒绝的记账面：四门并入 structure 腿 + 树级拒绝事实'
doc-type: plan
version: v0.31
date: 2026-11-18
slug: 2026-11-17-engine-doc-tooling-p40-design
base: develop
---

## Constraints

- **归属不变式**：拒绝是**树**的事实，不是轮的事实。本相位之后，任何 structure 腿拒绝都不得让 `Ledger#recordRound` 被调用一次——判据是「拒绝后 `waves[n].rounds` 长度与拒绝前相等」，不是「今天恰好没写」。
- **一条腿**：四条新行是 `session/preflight.ts#PreFlightGateName` 的第 6–9 行，不是第二条腿。`DispatchLeg` 三值闭集（`structure` / `upstream` / `line`）不动；复既有 `DispatchRefusal` 与 `DispatchAuthority#structureRefusal`，零新类型。
- **面的依赖方向**：判据抽进 `contract/`（最低层），`session/` 与 `face/` 都只向下引用；`session/preflight.ts` 不得**新增**对 `face/` 的 import——今天它已有一条 type-only 的 `import type { Words } from "../face/words.ts"`（`contract/judge.ts` 凭同一豁免引同一张词表），这条留在原处，本相位不再添第二条（环的拆除是 P39 的活）。
- **两个到期触发，各带自己的谓词**：门口清除（整条腿通过，`!parsed.dryRun`）与 `InFlight#release()` 的唯一调用点（**仅当**站立记录的站名是 `in-flight`）。后者不是豁免层——「不留豁免层」管拒绝路径，清除谓词管事实时效。
- **消费面守恒（点名，不打包）**：逐字节不变的是——五行既有 `CDD_BLOCKED` 行 · `dispatch-input` 那一行 · 既有 `crashed:` 语义 · `in-flight` 那一臂（`preflight.gate === "in-flight" && preflight.holding !== undefined`：活主 · 死主 · 带锁的坏记录三种形状）的 `lock:` 面。**会变**的是：`no-host` / `carrier` / `artifact` 三行多出站名前缀（它们今天只印一句裸话）· 预览块由三门镜像收为五行预报 · board 新增两行。
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
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（#answeredByNaming 的读取字段由 `decl.preview` 换成 `decl.written`，一行加两段注释；不换行为——实施轮实测：该字段若留到 Task 3 才换，则 `ContextLine` 的 `preview` 档与唯一的读者同时存在、声明面已无载体，预览豁免静默失效，face 侧测试在 Task 1 与 Task 3 之间转红）
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
一棵树任一时刻最多一条拒绝事实，落在 `in-flight.json` 的邻居。写入走命名空间发布（先 `WorkspaceRoot#ensure()` 写 `.gitignore` 标记，再原子写），否则一条拒绝会把消费仓弄脏、并让此后每次派发都在 `tree-clean` 行被引擎自己的文件拒掉。读面三态：站立 / 缺席 / 不可读。读面有两个读者，语义不同：**「这条拒绝是我的吗」**（board 与命令面，按 `facts.slug` 过滤）与**「这棵树上站着一条 `in-flight` 拒绝吗」**（释放点的清除，树级、不过滤）——一个 `read()` 兼任两义就得挑一种语义，并对另一个读者静默说谎。

#### Files
- Create: `packages/cdd-engine/src-next/session/refusal.ts`
- Create: `packages/cdd-engine/src-next/session/__tests__/refusal.test.ts`
- Modify: `packages/cdd-engine/src-next/session/round-artifacts.ts`（`refusal` 的五个登记点：`Kind` 闭集 · `WorkspaceKind` 闭集 · `WORKSPACE_KINDS` 数组 · 名字拼写矩阵行（`refusal: "refusal.json"` 落进 `WORKSPACE_LITERALS`）· `workspaceName` 的映射臂（前四点到位后由查表臂自动覆盖，不新增分支）。五点同一个文件：`Kind` 是另一个闭集，`ENTRIES` 定型为 `readonly MatrixEntry[]`（`kind: Kind`）而 `isWorkspaceKind(kind: Kind): kind is WorkspaceKind` 需要 `WorkspaceKind` 含于 `Kind`——只加 `WorkspaceKind` 的那一条编译不过。同批换词的是这个文件里逐处数着工作区域的**文字**：`The workspace domain's four kinds` · `Identity` 的 `the three coordinate-less literals` · `the four workspace rows`（两处：矩阵头与 `WorkspaceDomain`）· `The three coordinate-less workspace names` 与 `the three literals take tasks: null` · `four engine-authored files` 与 `the three literal names` · 文件头那段把 `progress` · `base` · `in-flight` 数成三个的清单。第五行落地时这些计数不换，矩阵自己的说明就停在四个种类上，而 `refusal` 会被读成这套坐标规则之外的一类）
- Test: `packages/cdd-engine/src-next/session/__tests__/round-artifacts.test.ts`（它钉 `entries()` 的行集恰为 `[...ROUND_KINDS, ...WORKSPACE_KINDS]`，其中 `WORKSPACE_KINDS` 是测试文件自己那份四行清单：第五个工作区行落地时两处同批加词，其余断言不动）

#### Consumes
- `ArtifactRegistry.nameOf`（`session/round-artifacts.ts`）——名字的唯一语法
- `WorkspaceRoot`（`infra/workspace.ts`）——`ensure()` 发布 keep-out 标记
- `AtomicWriter`（`infra/atomic.ts`）——原子写
- `PreFlightGateName`（`session/preflight.ts`）——记录 `station` 格的类型：九值闭集，五行既存站名今天就在，Task 4 把 RowStation 的四个值并进来（门名与 structure 腿的 reason token 是同一张词表）
- RowStation（Task 3，`contract/preflight-rows.ts`）——判据产出的四值，只定型 `RowRefusal.station`；记录不是判据，不收这一格
- `OpType`（`session/ledger.ts`）——轮动词闭集的唯一声明：记录的 `op` 格与 Task 4 的 `DispatchIdentity.op` 同读它，不另立第二个三词并集

#### Produces
```ts
// session/refusal.ts
export interface RefusalFacts {
  readonly at: string;            // ISO 时刻
  readonly slug: string;          // 相位工作区名
  readonly op: OpType;            // session/ledger.ts 的三词闭集（与 DispatchIdentity.op 同一拼写）
  readonly type: TargetType;
  readonly cycle: number;
  readonly attempt: number;
  readonly station: PreFlightGateName;   // 九值闭集（Task 4 之后含 RowStation 的四个值）：
                                         // 记录写的是「哪一行拒了」，不是判据产出的四值
  readonly detail: string;        // 单行；活判词首行剥掉站名
}
export type RefusalState =
  | { readonly kind: "absent" }
  | { readonly kind: "corrupt"; readonly reason: string }
  | { readonly kind: "standing"; readonly facts: RefusalFacts };

export class PreFlightRefusal {
  static readonly FILE: string;                        // ArtifactRegistry.nameOf("refusal", null)
  constructor(root: WorkspaceRoot, slug: string);      // slug = 本工作区自己的名字，read() 的唯一用途
  path(): string;
  async write(facts: RefusalFacts): Promise<void>;     // ensure() → 原子写（覆盖）
  clear(): void;                                       // 幂等
  read(): RefusalState;                                // 三态，永不抛；facts.slug 不等于构造 slug 时答 absent
  readRaw(): RefusalState;                             // 同一三态，**不做** slug 比较：唯一读者是释放点的
                                                       // 清除谓词（Task 6）——被作废的是树的事实
}
```

- `station` 的类型是**行集**，不是判据的四值：`RowRefusal.station`（Task 3）上的 RowStation 说的是判据真的只产四个值；记录由九行共写（`tree-clean` · `in-flight` · `graph` · `plan-ledger` · `doc-contract` 与四条新行），四值类型装不下其中五条——把它写成四值，编译器就会对引擎真正写下的数据撒谎。
- 两个读面的分工写进同一个类，因为分歧就在一处：`read()` 答「这条拒绝是我的吗」（board 与命令面），`readRaw()` 答「这棵树上站着什么」（释放点的清除）。让一个方法兼任两义，必有一种语义被静默改写。

#### Steps
- **Step 1: 写八条失败测试**（写读往返 · 无 `.kairos` 的仓里写后树仍干净 · 覆盖不追加 · 畸形 JSON 得 corrupt · clear 幂等 · **跨工作区按 slug 成对**：同一棵树上写一条 `slug: "other"` 的事实，以本 slug 构造的读面答 `absent`，以 `"other"` 构造的读面答 `standing` 且八字段逐字相同 · **九值宽度在记录自己的门上**：写一条 `station: "tree-clean"` 的事实并原样读回，八字段逐字相同——四值类型装不下它，这条用例是那个类型错的唯一告警 · **闭集词在同一个边界上判**：八格的原语类型都对、只把 `station` / `op` / `type` 换成一个集合外的词（`tree-claen` · `branch-review` · `task`），三种伤害都答 `corrupt` 且 reason 指出受伤的格——`read()` 不退化成 `standing` 后把非法词交给消费者） — checkable: `session/__tests__/refusal.test.ts` 存在且八条用例齐
- **Step 2: 跑测试确认红** — checkable: 该文件报 `Cannot find module .../refusal.ts`
- **Step 3: 加名字的五个登记点**（`Kind` 联合多一个 `"refusal"` · `WorkspaceKind` 联合同一词 · `WORKSPACE_KINDS` 数组同一词 · 矩阵行 `"refusal": "refusal.json"` 进 `WORKSPACE_LITERALS` · `workspaceName` 的查表臂随之成立；五点同一个文件，只加拼写行会让 `nameOf` 抛「matrix holds no workspace row」，漏掉 `Kind` 则类型门红；`round-artifacts.test.ts` 的行集清单同批加词；文件里那几处计数 prose 同批换词） — checkable: `nameOf("refusal", null)` 返回 refusal.json 且不加第二处字面量；`rg -n 'four workspace|three coordinate-less|four engine-authored' packages/cdd-engine/src-next/session/round-artifacts.ts` 零命中
- **Step 4: 实现类**（`write` 先 `ensure()` 后原子写 · `read` 三态永不抛、`standing` 只对本 slug 的 `facts` 成立 · `readRaw()` 同一三态但零 slug 比较（释放点的唯一读法）· `clear` force-remove） — checkable: 类落地且 `check:no-bare-functions` 对 `src-next/session` 为绿
- **Step 5: 跑测试确认绿 + 类型门** — checkable: 八条全过、`session/__tests__/round-artifacts.test.ts` 全绿，且 `pnpm exec tsc --noEmit -p packages/cdd-engine` exit 0（本任务的登记点因此能自己变红：`Kind` 缺一条即编译失败，而不靠别的任务发现）
- **Step 6: 提交** — checkable: `git show --stat HEAD` 含类、类测试、拼写表与它的测试四个文件

#### Acceptance
八条测试全绿；记录的 `station` 收的是九值闭集（`PreFlightGateName`），`tree-clean` 那条用例在记录自己的门上钉住这条宽度——RowStation 只定型判据的 `RowRefusal`；三处闭集（`station` · `op` · `type`）在读面就按各自的运行时表判（`DISPATCH_REASON` 的 structure token 集 · `RoundRecords.opOf` · `targetFaces`）：八格原语都对而词在集外的记录答 `corrupt` 并指出受伤的格，不退化成 `standing`——「形状对、词非法」是 §4.2「吞下一条拒绝比标错一条更糟」的那一类伤害，不能靠类型注释代替读面判据，也不另立第三张词表；`readRaw()` 与 `read()` 的分工成立：前者对任何 slug 的站立记录答 `standing`（释放点的清除读它），后者对别的 slug 答 `absent`（board 与命令面读它）；`round-artifacts.ts` 里数着工作区域的那几处文字随第五行换词（`rg -n 'four workspace|three coordinate-less|four engine-authored'` 零命中，矩阵的说明不停在四个种类上）；写入后仓库仍 `tree-clean`（F2 的直接回归）；refusal.json 是通过 `ArtifactRegistry` 拼出的名字（无第二处字面量，第五个登记点连 `Kind` 一起到齐）；`read()` 对畸形文件返回 `corrupt` 而不抛，且对**别的相位工作区**的记录返回 `absent`（spec §3.1 的渲染归属由这一类自答：判据住在读面，命令面、预览面与 board 的每个读者因此继承同一个比较，没有第二个 slug 判点；成对方向由 Step 1 的第六条断言——同一个 slug 上它照常答 `standing`，那条记录在它自己的板上可见）；`pnpm exec tsc --noEmit -p packages/cdd-engine` exit 0，且 `round-artifacts.test.ts` 的行集断言（`[...ROUND_KINDS, ...WORKSPACE_KINDS]`）随第五行更新后全绿——两条判据在本任务自己的门里，不借后一轮的 `validate` 才发现。

#### DependsOn
3

### Task 3: 四门判据抽成纯值模块

#### Objective
四道门的判据离开 `face/lifecycle.ts` 的实例方法，成为 `contract/` 里对**值**的纯判定：吃本任务自己声明的契约层值与一份注入的词面（派发输入事实 · 一份平值记录 · **那一轮解析后的声明行** · **两个已声明的场景事实** · 一份 artifact 快照 · 引擎写的那一格在这一次判定上的命名答案 · 四行的词面），吐站名与原因。

判据的定义由**声明面**给出，不由第二张表——因此判据真正读的那三个类型随之搬进 `contract/`：`ContextLine` 及其 `requiredOn` 臂、`RequiredArm`（含 `when: program|identity` 两臂）、以及两个 `when` 臂读的场景事实。声明表本身仍留在渲染面（`TemplateAssembler#layoutOf` 是那张表唯一的选取器，它今天就返回声明行）；判据收的是它解析出来的行与布尔化的事实，不收场景对象、不 import `render/`。exigible 格的解析（类型命中 + `when` 前置条件 → 该格的词）一并落在 contract，一处，面侧只提供值。本任务**不改行为**——face 改为调用它，字节与今日一致；门的位置在 Task 4 才动。

判据要读的**目标面**同批有自己的家，这件事也是可判的：`TargetType` 今天住在 `session/faces.ts`，而本任务的两个新模块（`contract/preflight-rows.ts` 与 `contract/context-declarations.ts`）不 import `session/`——`contract/` 里既有的三条 contract→session 边（`contract/pins.ts` 的拼写矩阵 · `contract/completion-criterion.ts` 的 carrier 完整性 · `contract/liveness-signal.ts` 的账本类型）是 P39 的活，本相位不动它们，本句也不拿它们当这条规则的例外——判据按类型集解析 `requiredOn` 的臂（`arm.types === "always" || arm.types.includes(type)`），不自带目标面就不成立。因此 `TargetType` 的定义原文搬进 `contract/target-type.ts`，`session/faces.ts` 改为一处 re-export（`session/` 的既有读者零改动，方向是 session → contract）；判据把它当**声明参数**收进来，不从场景对象里取。

平面方向是这条判据的立身之本：`contract/` 不知道 `render/TemplateValues` 与 face 私有的 ArtifactCell 长什么样。face 在自己的调用点做**适配**（把 `TemplateValues` 当平值记录用、把 `layoutOf` 的声明行原样交过去、把场景事实布尔化，ArtifactCell 的 `mismatch` 臂映射成 carrier 的两段事实），因此 `contract/preflight-rows.ts` 与声明模块不出现任何 face 或 render 的类型。

#### Files
- Create: `packages/cdd-engine/src-next/contract/preflight-rows.ts`
- Create: `packages/cdd-engine/src-next/contract/__tests__/preflight-rows.test.ts`
- Create: `packages/cdd-engine/src-next/contract/context-declarations.ts`（声明面的三个类型与 exigible 格的那一处解析：`RequiredArm` · `ContextLine` · SceneFacts，以及把声明行 + 场景事实解析成判定行的唯一一个入口。搬家的理由是可判的——判据要读声明，而 `contract/` 不许 import `render/`；搬完 `render/templates.ts` 反向 import，声明表与它的选取器留在原处）
- Create: `packages/cdd-engine/src-next/contract/carrier-line.ts`（carrier 那一句的唯一合成点：抛错与拒绝行念同一条格式，`session/carrier-integrity.ts` 与判据都只调它，不各拼一份）
- Create: `packages/cdd-engine/src-next/contract/target-type.ts`（`TargetType` 的新家：定义自 `session/faces.ts` 原文搬入，零语义改动、零新词）
- Modify: `packages/cdd-engine/src-next/session/faces.ts`（定义改为从 `contract/target-type.ts` 的 re-export，`session/` 与 `render/` 的既有读者零改动——方向是 session → contract）
- Modify: `packages/cdd-engine/src-next/render/templates.ts`（声明类型反向 import：`RequiredArm` / `ContextLine` 的定义移到 contract，本文件 import 回来；三张 mode 表、`TemplateAssembler`、`#assertEngineWritten` 与其余类型不动，零行为搬家）
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（CliLifecycle#inputRefusalOf 与 #artifactCellOf 的调用点改为委托；#answeredByNaming 只剩注释 prose 换词——它的判据已在 Task 1 换成读 `decl.written`，本任务不动这个判定，只换描述它的那句话，并新增 #namingAnswer 把逐声明答案归约成判据的 `naming` 一格；#emptyReasonOf 随它的选词搬进 `ExigibleCells`（同一判据的第二处声明不留）；no-host 那句与它的通道锚改读词表 `CAPSULE_WORDS.preflight` / `Words#station`，本文件因此不再持有该句字节）
- Modify: `packages/cdd-engine/src-next/face/words.ts`（四新行词面的字节之家：`no-host` 那句从 `face/lifecycle.ts` 迁进 `CAPSULE_WORDS.preflight`（spec §1.3 的措辞搬家），并由一个访问器把四行的词面交给调用点；`dispatchInput` 是 `CAPSULE_WORDS` 的既有那行（访问器连全表分隔符 `CAPSULE_WORDS.separator` 一并交出去——判据按它把站名接到段上，该文件里因此没有第二份 ` · ` 字面）；`artifactIdentity` 同理原样转发；`artifactIdentity` 增一格 `invalid`（`rulings sidecar — {reason}`，自 `face/lifecycle.ts` 的 #artifactRefusalOf 迁入——那一臂今天是一条裸字面，spec §3.3 的字节不变），artifact 行的两臂因此都落在同一张表里；同批改述 #artifactRefusalOf 的 docstring——它今天把 `rulings sidecar — <reason>` 再念一遍（同一文件里那是个 docstring，不是第二处字面），不改则本任务那条单命中 grep 命中两处）
- Modify: `packages/cdd-engine/src-next/infra/carrier-seal.ts`（`#isSidecar` 的 docstring 把 `rulings sidecar — ` 再念一遍——不改则那条单命中 grep 命中两处；与 #artifactRefusalOf · `CarrierIntegrity` 两条 docstring 同批改述，零行为、零语义）
- Modify: `packages/cdd-engine/src-next/session/carrier-integrity.ts`（报文改由 CarrierLine 合成——抛错的 message 与拒绝行念同一条格式，不改字节、不加第二份拼装；并给出 `facts()`：carrier 路径与两个 sha8，供快照携带**事实**而不是携带已渲染的句子；同批改述它自己的格式 docstring——那一句逐字写着 `carrier-mismatch · line=…`，不改则载体行模块那条单命中 grep 命中两处）
- Test: `packages/cdd-engine/src-next/face/__tests__/dispatch-input.test.ts`（仅换掉注释里那句旧字面量；断言零改动）
- Test: `scripts/__tests__/journey-twin.test.ts`（`TargetType` 的定义搬走后，这条源探针从 `session/faces.ts` 改读它的新家 `contract/target-type.ts`；断言口径不变——六词与 `spec` 退役那一条照旧）

#### Consumes
- Task 1 的 `ContextLine.written` 与 `NAMED_BRIEF_CELL`
- `TargetType`（新家 `contract/target-type.ts`，自 `session/faces.ts` 搬入）——判定行的臂按它命中，`DispatchInputFacts.type` 也由它定型
- `DocFs`（`contract/invariants.ts`）——存在性读：它**以输入格进**（与 `JudgeContext` 的 `fs` 同形，由 `PreFlight#vet` 把自己构造期注入的那一个交下来），判据因此既不 new `NodeFs` 也不 import 任何具体实现
- `RepoRoot` 与 `RepoPath`（`infra/root.ts`）——路径基的唯一值对象与唯一 relativize/resolve 转换对
- `DocEntry.program` / `DocEntry.docType`（`infra/slug-index.ts`）——面侧只把它们**布尔化**成交给判据的场景事实（「声明了 program」与「解析出的链接」是两件事，`when` 臂读的是前者）
- 声明行与那张表的选取器（在 face 的调用点被读，不被本模块 import）：`TemplateAssembler#layoutOf` 解析出的那一轮声明行（`ContextLine[]`）——判据按它决定哪些格 exigible，不按自己的第二张表
- 面侧的适配源（在 face 的调用点被读，不被本模块 import）：`TemplateValues`（`render/templates.ts`，一份 `Record<string, string>`）· face 私有的 ArtifactCell（`face/lifecycle.ts`，构件私有的两臂值类型，刻意不导出）· `ArtifactRead`（`session/round-artifacts.ts`，快照镜像的源）· 三处词面（`face/words.ts` 的 `CAPSULE_WORDS`），以 RowWording 的平值注入——carrier 不在此列，它的句子由 CarrierLine 从快照的事实合成

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
/** `{{TOKEN}}` 槽语法——唯一读者。住在它读的声明旁边（渲染器的
 *  `TemplateAssembler.slotOf` 委托给它），判据因此不必自带第二份花括号语法。 */
export class ContextSlot {
  static of(line: string): string | undefined;
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
/** 契约层的 artifact 快照——镜像私有 ArtifactCell 的两臂，只带判定要读的平值。
 *  `mismatch` 臂携带 carrier 的**事实**（路径 + 两个 sha8），不携带已渲染的句子：
 *  那一条句由 `CarrierLine` 在唯一一处合成，行与抛错念同一个格式；快照里放一份预先
 *  渲染好的报文就是同一件事实的第二次渲染。
 *  两臂都带 `reviewsPath`（fix 面的 `--reviews` 路径，或账本里已记录的上游轮载体）：
 *  它是 **composition 的输入格**（spec §1.1 ②：ArtifactCell 同时供 carrier 与 artifact
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
  /** `ok` / `invalid`: 读到的路径（`ok` 那一格即 `INPUT_RULINGS` 的唯一来源）；
   *  `misplaced`: **渲染名**（`derived`）；`absent`: null。 */
  readonly path: string | null;
  readonly reason: string | null;
  readonly found: readonly string[];
  /** `misplaced` 臂的身份词面（面侧 `Words#identityWords` 渲染——contract 不自带拼写），
   *  填 `identity:` 那一格；其余三臂 null。 */
  readonly identity: string | null;
  /** `misplaced` 臂的 sidecar 种类词（`rulings`），填报告首行的 `{kind}` 槽；其余三臂
   *  null。 */
  readonly sidecarKind: string | null;
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
    /** `found` 名单之间的连接词（` · `）与空名单的字（`(none)`）——它们是词不是事实，
     *  因此住在词面里，判据里零字面。 */
    readonly foundJoin: string;
    readonly emptyFound: string;
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
  readonly artifact: ArtifactSnapshot; // 面侧 ArtifactCell 的映射结果
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
/** artifact 报告的事实（`misplaced` 臂）——一处合成的输入。 */
export interface ArtifactReportFacts {
  readonly sidecarKind: string; // 报告首行的 `{kind}`
  readonly derived: string; // 渲染名
  readonly found: readonly string[]; // 落在它位置上的名字
  readonly identity: string; // 身份词面（面侧渲染）
}
export class PreFlightRows {
  static judge(input: PreFlightRowsInput): readonly RowRefusal[]; // 全部违规格一次报完（不短路）
  /** `misplaced` 报告的唯一合成点：判据与 `Words#artifactIdentity`（board 夹具的参照
   *  渲染器）都调它，两个读者因此读同一张表、拼同一个形状，不会各拼一份。 */
  static artifactReportOf(
    wording: RowWording["artifact"],
    facts: ArtifactReportFacts,
  ): string;
}
```

- `repoRoot` 收既有的路径基值对象 `RepoRoot`（`infra/root.ts`），不是裸字符串：声明格里的路径是 repoRoot-relative（spec §1.1），存在性读只经 `RepoRoot` 的 `relativize` / `resolve` 这一对转换落成绝对路径——模块内不许用 `path.join`（或任何裸字符串拼装）自己拼一段路径（今天 #inputRefusalOf 的注释点名的正是「从子目录派发把每条落地路径读成缺失」那个缺陷）。这条只管**路径**：本模块的正式工作之一是合成多行 detail，`RowRefusal.detail` 的续行、`RowWording.dispatchInput.separator` 与 artifact 的 `repair` 两句都用 `Array#join` 拼字符串，与 `face/words.ts` 今日同形。

#### Steps
- **Step 1: 写七条失败测试**（no-host · carrier · 必填格空 · 路径格缺失 · 三处同时三条一次报完且顺序固定 · engine 写的槽零存在性读 · 声明表驱动的 exigibility：`always` / 类型集 / `when: program|identity` 三臂各判一次，判据只读声明行与两个场景事实） — checkable: `contract/__tests__/preflight-rows.test.ts` 七条用例齐
- **Step 2: 跑测试确认红** — checkable: 该文件报 `Cannot find module .../preflight-rows.ts`
- **Step 3: 搬声明类型与判据进纯模块，face 侧改为取值、映射与委托**（`RequiredArm` / `ContextLine` 移进 `contract/context-declarations.ts`，`render/templates.ts` 反向 import；`TargetType` 的定义移进 `contract/target-type.ts`，`session/faces.ts` 反向 re-export；`values` 与 `layoutOf(values)` 的声明行直接传；两个场景事实布尔化后传；ArtifactCell 的 `mismatch` 臂映射成 carrier 事实而不是报文；三份词面按 RowWording 注入） — checkable: `face/lifecycle.ts` import 该模块，四道门的判定式不再出现在 face；`contract/preflight-rows.ts` · `contract/context-declarations.ts` · `contract/target-type.ts` 的 import 列表里没有 `face/` · `render/` · `session/`（词面是注入值，模块内零句措辞字面；目标面因此有自己的 contract 家，不是判据反向依赖 session）；声明类型只有一处定义（`rg -n 'export interface ContextLine' packages/cdd-engine/src-next` 单命中且落在新建的声明模块）；`TargetType` 也只有一处定义（`rg -n 'export type TargetType' packages/cdd-engine/src-next` 单命中且落在 `contract/target-type.ts`，`session/faces.ts` 那处是 re-export）；carrier 那一句的格式只有一处（`rg -n 'carrier-mismatch · line=' packages/cdd-engine/src-next -g '!**/__tests__/**'` 单命中且落在新建的 carrier 行模块，`session/carrier-integrity.ts` 改为调它）；artifact 那一行的两个臂各有一处字节之家（`rg -n 'rulings sidecar — ' packages/cdd-engine/src-next -g '!**/__tests__/**'` 单命中且落在 `face/words.ts`——既有那条裸字面随之进表）；`rg -n 'preview: "satisfied"' packages/cdd-engine/src-next` 零命中（全树：Task 1 收掉 `render/` 切片，本任务换掉 #answeredByNaming 的注释 prose 与 `dispatch-input.test.ts` 的旧注释）；存在性读只经注入的 `fs` 一格（`contract/preflight-rows.ts` 里 `NodeFs` 零命中，输入格里有 `fs: DocFs`——判据不 import 具体实现，也不需要临时目录）
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

- **值的预帧装配**：`vet` 落在 `OpenFrame` 之前（spec 2.4：帧出自 `Lifecycle#peekNext()`，而 `run` 在裁决之后才构造），而今天唯一的两名生产者都绑帧——`CliLifecycle#valuesOf(frame, cell)` 与 #artifactCellOf(frame)。因此值的装配自己成一个文件：一个**无帧、无 workspace** 的 composer，吃声明好的平值（identity：op · type · phase · tasks · (cycle, attempt)；scene：那条线的 doc / plan / spec / overall 路径 · base 分支 · 引擎写的 brief 路径经 `RoundNaming#brief(tasks)` 命名 · 工作区目录与 slug · 三个 OUTPUT_* 与 `## Handoff schema` 文本；artifact：快照的整格——`read` 臂与 `mismatch` 臂都带 fix 面的 `--reviews` 路径，`mismatch` 臂另带载体路径与两个 sha8），吐一份平值记录。rulings 边车的路径**不进 scene**：它由快照 `read` 臂的 `path` 派生（`kind: "ok"` 时），同一件事实不在两个类型里各存一份。**单源保证写成条件**：门判的那份值与提示词渲染的那份值是同一个 composer 的同一次调用产物——seam 收它的输出、渲染器收它的输出，两边都不重组（Task 5 把渲染器接到这次调用上）。
- **两格最容易漏、且只能靠无帧事实得到**：wave 面的 `WAVE` 读 `tasks`（`#valuesOf` 今天在 `frame.params.tasks` 上取值，非 wave 面为空串），fix 面的 `INPUT_REVIEWS` 读请求载体路径。前者进 DispatchIdentity，后者随 artifact 快照（spec §1.1 ②：ArtifactCell 同时供 carrier 与 artifact 两行，并携带 `--reviews` 路径）——两者都必须是无帧可得的平值，否则 Task 4 的成对测试（composer 的记录与 `#valuesOf` 的记录逐字相同）在 fix 与 wave 两个面上无法成立。请求载体路径的**三支规则只有一个家**：组合根持有 `--reviews` 的值（`parsed.paths.reviews`）、账本与三格身份事实（`type` · `key` · 本轮 `cycle`）——都是无帧事实，但它们**不进一个新的推演**：flag → 已记录载体 → 评审族名的优先序由 `face/dispatch-values.ts` 的 RequestingCarrier 一处给出（`#reviewsPath` 今天的三选一逐字搬入，`face/lifecycle.ts` 的三个私有方法改为对它的委托），组合根调它一次、把那一格值交给 composer。族名那一支的下标**只有 cycle**：attempt 由 `Ledger#resolveHandoffName` 的 `#attemptAware` 补成评审自己记录的那一个（fix 腿知道 cycle，不知道评审的 attempt）——拿本轮 `(cycle, attempt)` 去取会点出 `-a{fix attempt}` 这个名字，而那条载体评审从未写过。
- **reason 表的四行**：`session/preflight.ts` 的 docstring 说「每个门名就是 structure 腿在 `DISPATCH_REASON` 里的 reason token」，而 `DispatchAuthority#structureRefusal` 返回 `reason: gate`（`DispatchReason` 是那张表的 token 联合）。九值门名不进表，那个赋值就编译不过；而「另起一套 reason 拼写」会给出同一件拒绝两套名字。因此四行的 token 就是 RowStation 的四个值，leg 全为 `structure`，表与门名一份词汇。

#### Files
- Modify: `packages/cdd-engine/src-next/session/preflight.ts`（`PreFlightGateName` 扩为九值、`PreFlightContext` 增五格输入（`host` · `values` · `declarations` · `scene` · `artifact`，见 Produces）、`PreFlight#vet` 按序判定四行；`PreFlightReason` **不扩**——四新行的措辞来自 `RowRefusal.detail`，那个 enum 的 docstring 承诺零死值）
- Test: `packages/cdd-engine/src-next/session/__tests__/dispatch-authority.test.ts`（structure 腿的行集与顺序断言）
- Create: `packages/cdd-engine/src-next/session/__tests__/preflight-rows.test.ts`（四行在缝合层的端到端：值的来源、顺序、短路规则）
- Create: `packages/cdd-engine/src-next/face/dispatch-values.ts`（预帧值装配：无帧、无 workspace 的 composer，框架层以下的所有事实都以平值入、平值出；渲染器与缝合读同一份）
- Modify: `packages/cdd-engine/src-next/session/next.ts`（`DISPATCH_REASON` 加四条 structure 行：token 就是 RowStation 的四个值，`leg: "structure"`；一张表、一套拼写，不另起 reason 词汇）
- Modify: `packages/cdd-engine/src-next/face/cli.ts`（生产侧唯一那次 `vet` 调用：新增的五格输入在此装配——composer 调一次、宿主值探一次、声明行由 `#template.layoutOf(values)` 取、两个场景事实由 `scene.program` / `scene.docType` 布尔化（两个值都在组合根手上，`session/` 因此不新增 `render/` 的 import），artifact 快照的**整格在这里生产**（见表与 Produces 的快照注）：两臂都带 reviewsPath——`--reviews` 值 · 账本里同回合同评审记录的载体取路 · 族名，三者由同一个无帧取路（本条新建的 RequestingCarrier，见 Produces）选出，组合根交值、不自己重推优先级；`read` 臂由既有的无帧缝 `ArtifactReads#read("rulings", reviewsPath, digest)` 判读写（用组合根手上的 `scene.workspace`——它的构造期零 I/O；digest 取账本那条评审记录的 `carrierDigest`，即 #requesterDigest 的无帧同源），`mismatch` 臂由它抛的 `CarrierMismatchError` 映射而成（那个错自带路径与两个全 hex 值，sha8 由 `CarrierIntegrity` 一处缩短；Task 3 同批把这三格收成 `facts()`）——两个臂无一项靠帧，Task 5 退役 #artifactCellOf 之后这里是唯一的生产者；`(cycle, attempt)` 不随 context 走（它不喂任何一行，只进拒绝记录，见 Produces）；断言零改动。宿主值本任务先探一次并只交给 context；Task 6 把**同一个值**交给 lifecycle 与 Preview 两处读者，不开第二条探测路径。composer 的 scene 格同批把 `scene.workspace.root.basis`（`RepoRoot`）交进去，路径的归一因此落在 composer 内（组合根不做第二处转换）。**`--recover` 的谓词在同批收成一处**：`Cli#runWork` 里一个 `const recover = !parsed.dryRun && parsed.args.recover === "true"`，`stale` 的读、缝合的 `recover` 输入、恢复腿的守卫、派发缝自己的折叠与 harness 的接管许可全部取这一值——今天同一个合取在四处重拼且必须逐字相等，第五处（harness 的恢复旗标）本来只读旗标不读 `--dry-run`，也改由调用点交值；这不是口味：四个拼写就是四次错位的时机，「composer 为一个折叠从未登录的轮分配号」是它的一种症状。**同一文件里还有加行的第二处**：`Cli#renderPreflightBlocked` 的 gate 名条件（今天三值 `tree-clean` · `in-flight` · `doc-contract`，其余两行落到 `cdd <verb>: …` 一支）——四个新站名与 `PreFlightGateName` 的九值同批进那一支，spec §3.3 的「加行的动作有两处、缺一即错」；漏掉它，`dispatch-input` 的拒绝就念成 `cdd <verb>: dispatch-input · …`，而 Task 6 钉的字节是 `CDD_BLOCKED: dispatch-input · …`。两半落在同一个提交里）
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（请求载体的三支规则搬出：`#reviewsPath` · `#reviewFamilyPath` · `#requesterRecord` 的体改为对 RequestingCarrier 的委托，三者共用一处帧到平值事实的适配（`frame.type` · `frame.key` · `frame.round` · `frame.params.tasks` 四格）；骨架与读者留原处——完成性判据读 `#reviewsPath`，族名面读 `#reviewFamilyPath`。行为一行不改：三支的序、族名那一支的 cycle-only 下标、记录那一支的同合同最新一条，逐字搬进新家）
- Test: `packages/cdd-engine/src-next/session/__tests__/preflight.test.ts`（`waveCtx` · `docCtx` · `branchCtx` · `carrierCtx` 四个 context 构造器同批补上新输入；全部 `vet` 调用都经这四个构造器或它们的展开喂入，因此逐调用零改动；断言零改动）
- Test: `packages/cdd-engine/src-next/session/__tests__/plan-read-consistency.test.ts`（第五个 context 构造器 `preflightCtxOf` 同批补上新输入，它的 `vet` 调用零改动——不补它则本任务的 `tsc --noEmit` 门在 Step 5 红，而那个文件不在任何任务的 Files 里）
- Modify: `packages/cdd-engine/src-next/session/ledger.ts`（新增 `AbortFold`：`--recover` 的 abort fold 将要记账那一轮的 `(op · key · cycle · attempt)` 的唯一读面——`CliLifecycle#bookAbort` 与组合根的身份分配共读它，`withPending` 给出「本 key 的记录加折叠即将写下的一轮」这个切片。理由：折叠按 P30 §2.1④ 排在裁决**之后**，而装配排在裁决之前——没有这一格，composer 的 attempt 会比帧分配的少一，`OUTPUT_*` / handoff 名指向被折叠的那一次尝试，而轮记录与载体落在下一次）
- Test: `packages/cdd-engine/src-next/session/__tests__/ledger.test.ts`（`AbortFold` 的三条：折叠的身份（含 `branch-review` → `review`）· 身份不齐时不记账 · 分配在「记录 + 待折叠一轮」上求，且别的 key 的待折叠轮不位移本 key）
- Test: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（`--recover` 折叠一轮之后的派发：提示词里的 `OUTPUT_*` 名就是折叠之后那一次尝试的名，不是被杀那一次——Task 5 把渲染器接到 composer 之后，这条断言仍是同一句话）

#### Consumes
- Task 3 的 `PreFlightRows.judge` · PreFlightRowsInput · RowWording · DispatchInputFacts · RowRefusal · ArtifactSnapshot
- `PreFlightContext` / `PreFlightVerdict`（既有）
- `RoundNaming#attemptOf` 与 `Ledger#roundCount`——将要消耗的 `(cycle, attempt)` 的唯一来源
- `RoundRecords.opOf`（`session/ledger.ts`）——`reviewLead` 折成 `OpType` 的唯一一处（`branch-review` → `review`）：identity 的 `op` 格收折后值，Task 6 的写者用同一个值求 `attempt`，两处不各持一张映射表
- `RoundNaming#brief` 与 `#briefName`（`session/round-naming.ts`）——引擎写的 brief 格的命名，与 `--dry-run` 预览同一条推演（composer 收的是它的输出，不收帧）
- `RepoRoot`（`infra/root.ts`）——composer 路径格的唯一 basis：组合根把 `scene.workspace.root.basis` 传进场景事实，`#valuesOf` 的 `#rel` 那一处转换随它搬进 composer
- 请求载体路径的三个无帧来源（均在组合根被读，一次交值给 composer，规则不进 composer 的推演）：`--reviews` 的解析值（`face/cli.ts` 的 `parsed.paths.reviews`）· 账本里同回合同评审记录的载体取路（`#reviewsPath` 今天的第一、二支，`Ledger#carrierPathOf`）· 评审族的族名（第三支，下标**只有 cycle**：`RoundNaming` 只给族名，attempt 由 `Ledger#resolveHandoffName` 的 `#attemptAware` 补成评审自己记录的那一个——拿本轮 `(cycle, attempt)` 去取会点出 `-a{fix attempt}` 这个名字，而那条载体评审从未写过）。三支的序与判定搬进同一个无帧取路（本条的 RequestingCarrier，见 Produces），组合根与 `#reviewsPath` 都调它；`Ledger` 与 `RoundRecord` 是它的两个输入类型（记录那一支按同合同 `op === "review"` 取最新一条），`(cycle, attempt)` 只留给记录与命名的身份，不做取路的下标
- `HostDetect.detect`（`face/host.ts`）——宿主值的唯一探针；本任务在组合根探一次并交值给 context（Task 6 把同一个值分给另两处读者并退役派发体里那次重复探测）
- `DispatchReason` / `DISPATCH_REASON`（`session/next.ts`）——structure 腿 reason token 的唯一表；四行加在那里，`structureRefusal` 的 `reason: gate` 才继续成立
- `Words`（`face/words.ts`）与 CarrierLine（`contract/carrier-line.ts`）——四行词面中三行按 RowWording 的平值注入 PreFlightRowsInput（`session/` 早已持有 `Words` 的类型，这条注入不新增第二条 `face/` 的 import），carrier 那一行由 CarrierLine 从快照的事实合成

#### Produces
```ts
// face/dispatch-values.ts —— 预帧值装配（无帧、无 workspace）
export interface DispatchIdentity {
  /** 已折好的轮动词——`RoundRecords.opOf(expected)` 一处折（branch 线的 `branch-review`
   *  → `review`），组合根交值、composer 不自己映射：`attemptOf` 也在同一个值上求。 */
  readonly op: OpType;
  readonly type: TargetType;
  readonly phase: string; // 渲染的 isReview / evidence 两腿读它，不读帧
  readonly tasks: string; // wave 面的 WAVE 格读它（非 wave 面由 composer 置空，帧不外借）
  readonly cycle: number; // OUTPUT_* 与 brief / handoff 的命名下标：本轮将要消费的那一轮
  readonly attempt: number; // 同上——两格一起构成本次派发的身份，不是任何一行的输入
}
export interface DispatchSceneFacts {
  readonly repoRoot: RepoRoot; // 路径格的唯一 basis（scene.workspace.root.basis）；#rel 的转换点随它搬进 composer
  readonly docPath: string | null;
  readonly planPath: string | null;
  readonly specLink: string | null;
  readonly overallLink: string | null;
  readonly baseBranch: string | null;
  readonly briefPath: string; // RoundNaming#brief(tasks) —— 引擎写的格
  // 不在这里的两格：`(cycle, attempt)` 住 identity（上面），rulings 边车的路径不住 scene
  // ——`INPUT_RULINGS` 由快照的 read 臂派生（`ArtifactSnapshotRead.path` 在 `kind: "ok"`
  // 时就是它），同一件事实不在两个类型里各存一份。
  // 路径格的两种写法都进 compose：`briefPath` · `workspaceDir` · `reportPath` · `evidencePath` ·
  // `handoffPath` 由生产者交上来的绝对值，`docPath` / `planPath` / `specLink` / `overallLink`
  // 在 CLI 缝上已是 repoRoot-relative；收成一种写法的唯一地方是 compose（下面）。
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
   * （仅 wave 面）——三格因此无帧可得。
   *  每一条路径格都在这里经 `scene.repoRoot.relativize` 收成 repoRoot-relative 的一种写法——
   *  `#valuesOf` 的 `#rel` 搬下来的唯一转换点，basis 骑在场景事实里（不占第四格）：
   *  `RoundNaming#report` / `#evidence` 与 `workspace.path` 产绝对，argv 面交上来的
   *  `INPUT_SPEC` 已是相对的，`RepoRoot.relativize` 两种都吃得下（今天 `#rel` 的同一函数）。 */
  static compose(
    identity: DispatchIdentity,
    scene: DispatchSceneFacts,
    artifact: ArtifactSnapshot,
  ): Readonly<Record<string, string>>;
}

/** 请求载体路径的三支优先序，一处（`#reviewsPath` 今天的三选一逐字搬入）：flag →
 *  已记录载体 → 评审族名。两个读者调它——组合根（产 `INPUT_REVIEWS`）与
 *  `CliLifecycle#reviewsPath`（完成性判据与族名面），同一件事实因此只有一条规则。
 *  无帧：四格身份事实由调用点解出（帧侧或组合根侧都可以），本类不收帧类型。 */
export interface RequestingCarrierFacts {
  readonly type: TargetType;
  readonly key: string; // frame.key 的无帧同源
  readonly cycle: number; // frame.round
  readonly tasks: string; // frame.params.tasks —— 族名那一支读它
}
export class RequestingCarrier {
  /** 三支：flag → 已记录载体 → 族名。第二支在记录存在但解析不出路径时答 null。 */
  static path(ledger: Ledger, flag: string | null, facts: RequestingCarrierFacts): string | null;
  /** 族名：下标只有 cycle，attempt 由 `resolveHandoffName` 的 `#attemptAware` 补。 */
  static familyPath(ledger: Ledger, facts: RequestingCarrierFacts): string;
  /** 本轮回答的上游评审记录：同合同、`op === "review"`、最新一条。 */
  static requesterRecord(ledger: Ledger, facts: RequestingCarrierFacts): RoundRecord | null;
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
// 五格不靠 spread 渡河：`PreFlightContext.repoRoot` 是裸字符串而判据要值对象，
// `facts` 只有两格、与 context 的字段不是同一形状——逐格写实：
PreFlightRows.judge({
  facts: { type: ctx.type, host: ctx.host },
  values: ctx.values,
  declarations: ctx.declarations,
  scene: ctx.scene,
  artifact: ctx.artifact,
  repoRoot: new RepoRoot(ctx.repoRoot),
  fs: this.#fs,
  naming: { answered: false }, // 派发模式的答案（预览臂是它唯一的读者）
});

// session/next.ts —— DISPATCH_REASON 的四条新 structure 行（token 即站名）
// noHost: { token: "no-host", leg: "structure" }
// carrier: { token: "carrier", leg: "structure" }
// dispatchInput: { token: "dispatch-input", leg: "structure" }
// artifact: { token: "artifact", leg: "structure" }
```
- `PreFlight#vet` 的判定序：既有五行（原序，逐行判定、首个违纪即拒）→ 四新行（no-host → carrier → dispatch-input → artifact，**四条全判、一次报完**）。verdict 的 `gate` 与 `message` 取四条里的**第一条**违纪行：`message` 是该行 `detail` 首行**剥掉串首站名**后的余下部分（spec §2.1 / §3.3）——站名由 `gate` 单独携带，`DispatchAuthority#message` 是唯一把它放回串首的位置，命令面与预览面因此各只有一段站名前缀；`details` 只收**它之后**的各条（三条违纪 ⇒ 两条 details）。这不是口味：`face/cli.ts#Cli#renderPreflightBlocked` 先印 `message` 再逐条印 `details`，收全部四条会让首条的句子在同一个块里出现两遍；而既有 `details` 的语义本来就是「`message` 之下的各条」（`graph` / `plan-ledger` 的 issue / finding 行），四行沿用同一条，不新开第二个意思。
- 既有五行按面取舍，`order` 的行数是面的函数：`graph` 只在 `wave` / `plan` 的 ready 读上（非 ready 的读既不推也不报）· `plan-ledger` 只在 `plan` / `wave` / `branch` 上 · `doc-contract` 只在四个 doc 面上（`phase-spec` · `overall` · `plan` · `single-spec`）。四新行不受面影响、每一面都判都记——spec 的 `checked:` 具名变更 ④ 承诺的正是这四行 always，不是九行 always。**唯一没有输入面的情形是 wave 面上预测批次为空**：`WAVE` 与 `INPUT_WAVE_BRIEF` 都是引擎从 `frontier(doneTasks())` 推得的值（`DispatchIdentity.tasks`），编排者无从供给，拒它只会盖掉 line 腿真正的答案（`split`——计划没有可派的 open wave）。因此四行在这一种输入上整批退场（`PreFlight#hasInputFace`），`order` / `checked` 也不记这四行，裁决交给 line 腿。
- 优先级位移（spec 的第六项具名变更）：四行排在 line 腿**之前**，因此同一个 fixture 同时犯门与线两条时，报的是门的行；门通过之后，线的拒绝仍可达。
- 单源保证：`PreFlightRowsInput.values` 与渲染器读的那份值来自同一个 composer 的同一次调用（Task 4 期间两条调用点同时在场：`cli.ts` 的 `vet` 前一次，`CliLifecycle` 侧的旧 `#valuesOf` 仍在；Task 5 把后者换成前者的输出，两个消费者就只剩一次装配）。
- 缝合侧的五格输入各有生产者，**没有一格靠 import 补**：`values` / `artifact` 是 composer 与快照的输出，`host` 是组合根那一次探测的值，`declarations` 是 `#template.layoutOf(values)` 的返回，`scene` 是 `scene.program` / `scene.docType` 两个布尔——后两格今天就在组合根手上。`session/` 因此不新增对 `render/` 或 `face/` 的 import（`render/templates.ts` 反过来 import `session/faces.ts`，那条边会把 `session/preflight.ts → render/templates.ts → session/faces.ts` 连成环）。`(cycle, attempt)` 不进 context：它不喂任何一行（spec §1.1 把它判给拒绝事实自己的身份），组合根直接把它写进拒绝记录的两格。
- **判据的 `naming` 一格由缝合自己作答，不增第六格**：`PreFlight#vet` 传常量 `naming: { answered: false }`。理由可核而不靠猜——`face/lifecycle.ts#CliLifecycle` 的 #answeredByNaming 唯一的读者是 #inputRefusalOf 的 `mode === "preview"` 那一臂（派发模式从不问它），而引擎写的格的存在性那一腿已由声明面的 `written: "engine"` 抑制，命名只影响「空值是否被豁免」——派发路径上仍是拒绝。因此这一格在每一面都等于派发模式的答案，且它是判据自己的输入格、不是 `PreFlightContext` 的一格（进 context 会与 Step 3 的 checkable 和 Acceptance 的五格相抵）；Task 5 退役 `mode` 时整格随豁免一起退场。

#### Steps
- **Step 1: 写七条失败测试**（缺宿主 · 值坏 · 三个站同时违纪：`message` 念首条（已剥串首站名，`CDD_BLOCKED:` 行里站名只出现一次）、`details` 两条、拼出的整块里三句各出现一次（首条不得重复） · 文档坏与值坏并存时 doc-contract 先拒 · 预帧装配可独立调用（composer 不 import 帧类型、不读 workspace）且它产出的记录与 `CliLifecycle` 今日从帧推得的值**逐字相同**（成对，证明两条路径同源；Task 5 把后者换成前者）——成对断言在 wave 面与 fix 面各跑一次，因此含 `WAVE`（读 `identity.tasks`）与 `INPUT_REVIEWS`（读快照的 `reviewsPath`）两格 · 九值门名与 reason 表的四个 token 一一对应 · **快照两臂都活着**：`read` 臂与 `mismatch` 臂各喂一次——被篡改的请求载体在 pre-flight 就拒成 `carrier` 行，Task 5 退役旧生产者之后 `artifact` 与 `carrier` 两行仍由这一对断言守着 · **族名那一支的下标只有 cycle**：fix 轮的 attempt 是 2、同族评审的最新记录是 a1 ⇒ 取路落在 a1 那一条载体上（同一夹具改用随帧 attempt 的下标即落到 a2，而那条名字评审从未写过） · **批次为空时四行整批退场**：wave 面的值记录 `WAVE` 为空串 ⇒ `vet` 的 `order` 只剩既有四行、`structureRefusal` 为 null，同一个请求的 line 腿报 `split`（四行不得拿引擎自己推不出的格去拒一次没有批次可派的派发）） — checkable: `session/__tests__/preflight-rows.test.ts` 九条用例齐
- **Step 2: 跑测试确认红** — checkable: 该文件报红，原因指向未扩的九值或缺失的 context 输入
- **Step 3: 扩类型、四行 reason 表、预帧 composer 与判定**（九值 · `DISPATCH_REASON` 四行 · context 五输入必填 · 四行全判一次报完 · 批次为空时四行整批退场（`PreFlight#hasInputFace`）· composer 无帧无 workspace · `cli.ts` 那次 `vet` 的五格输入齐 · identity 的 attempt 在「本 key 的记录 + 折叠待记账的一轮」上求） — checkable: `PreFlightGateName` 的声明含 RowStation；`PreFlightContext` 含 `host` / `values` / `declarations` / `scene` / `artifact`，且不含 `round`（`rg -n 'round:' packages/cdd-engine/src-next/session/preflight.ts` 零命中——身份不喂任何一行）；`DISPATCH_REASON` 含四个新 `leg: "structure"` 行，`PreFlightReason` 仍是五值；composer 的文件里 `OpenFrame` 零命中；`DispatchValues.compose` 是三个参数（identity · scene · 快照），identity 含 `tasks` / `cycle` / `attempt`，快照两臂均带 reviewsPath 且 `read` 臂的 `path` 是 `INPUT_RULINGS` 的唯一来源；`naming` 由 `PreFlight#vet` 以常量 `{ answered: false }` 传给 `judge`，而 `PreFlightContext` 的接口体里 `naming` 零命中（六格会让五格那条断言与它自己的生产者互相矛盾）；`vet` 的那一次 `judge` 调用逐格写实、不靠 spread（`repoRoot` 由 `new RepoRoot(ctx.repoRoot)` 换成值对象，`facts` 由 `type` / `host` 两格现拼——两边的形状无关，抄 spread 会立刻两条 tsc 错）；identity 的 `op` 是 `RoundRecords.opOf` 的折后值（`branch-review` 折成 `review` 的映射只有那一处）；**判据拿到的 `fs` 是 `PreFlight#vet` 交下来的那一个**（`contract/preflight-rows.ts` 里 `NodeFs` 零命中、输入格里有 `fs: DocFs`）；判词装配处剥一次串首站名（`message` 的赋值只有一处，`DispatchAuthority#message` 不再有第二个补回点，`dispatch-input` 与其余三行同一道处理）；**路径格的 basis 进场景事实**（DispatchSceneFacts 含 `repoRoot`，`rg -n 'relativize' packages/cdd-engine/src-next/face/dispatch-values.ts` 只有 compose 内的那几处——组合根与测试都不做第二次转换）；**加行的两处同批**（`rg -n 'preflight.gate ===' packages/cdd-engine/src-next/face/cli.ts` 命中八处：七处在 `#renderPreflightBlocked` 的 gate 名条件内（`tree-clean` · `in-flight` · `doc-contract` 与四新行），第八处是 `--dry-run` 的 `in-flight` 臂——Task 6 按谓词保留）；**请求载体的三支只有一个家**（`rg -n 'carrierPathOf|resolveHandoffPath' packages/cdd-engine/src-next/face/dispatch-values.ts` 两命中，同 pattern 在 `face/lifecycle.ts` 零命中——规则不在任何文件里出现第二份）
- **Step 4: 写优先级位移的成对测试**（门与线同犯 ⇒ 报门的行；补齐门之后再跑 ⇒ 报线的行） — checkable: 该对断言同文件内可红可绿
- **Step 5: 跑绿 + 跑既有缝合测试 + 类型门** — checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/session/__tests__/` 全绿（含新输入下断言零改动的 `preflight.test.ts` · `plan-read-consistency.test.ts`），且 `pnpm exec tsc --noEmit -p packages/cdd-engine` exit 0（四行 reason 进表后 `structureRefusal` 的 `reason: gate` 仍成立；生产侧那次 `vet` 与两个测试文件的五个 context 构造器（`preflight.test.ts` 的四个 · `plan-read-consistency.test.ts` 的 `preflightCtxOf`）均已补齐输入，43 处 `vet` 调用零改动）
- **Step 6: 提交** — checkable: `git show --stat HEAD` 含 `session/preflight.ts`、`session/next.ts`、`session/ledger.ts`、`face/dispatch-values.ts`、`face/cli.ts`、`face/lifecycle.ts` 与六个测试文件

#### Acceptance
九值闭集；`order` 按面取既有行（`graph` 仅 `wave` / `plan` 的 ready 读 · `plan-ledger` 仅 `plan` / `wave` / `branch` · `doc-contract` 仅四个 doc 面），四新行在每一面都在、都记（故 `plan` 面九行、`wave` 面八行、`branch` 面与其余三个 doc 面七行——九行是 `plan` 面的行数，不是「每次派发恒含九行」），唯一例外是运行面并不存在的那一种：wave 面上预测批次为空时四行整批退场（`order` 只剩 `tree-clean` · `in-flight` · `graph` · `plan-ledger`），裁决由 line 腿的 `split` 行给出——有成对断言钉住（structured 腿零拒绝 + 同一个请求的 line 腿 `split`）；`session/preflight.ts` 不新增 `face/` 的 import（既有那条 type-only `Words` 保留，grep 断言是「无新增」而不是「零命中」）；四行全报而非逐条短路，`message` 取首条、`details` 只收其后的各条（多违纪块里每句各出现一次，首条不重复）；`doc-contract` 仍排在四行之前；优先级位移有成对断言（门的行在前、线的行在门通过后仍可达）；**值的装配有无帧的单一入口**（composer 不 import 帧类型、不读 workspace 对象，测试直接调它即得一份可用值），composer 的输入是它自己声明的三格（identity · scene · 快照，每格都在 Produces 里点名，没有「Objective 列了而类型不接」的格：`tasks` 与 `(cycle, attempt)` 在 identity，fix 面的请求载体路径在快照的 `reviewsPath`，路径的唯一 basis 在 scene 的 `repoRoot`），且 composer 输出的记录与 `CliLifecycle#valuesOf` 今日从帧推得的值**逐字相同**（成对断言，覆盖 wave 与 fix 两个面；成对的第一半是**记录本身**——`CliLifecycle#valuesOf(frame)` 作为唯一的测试可见读面公开，两边的 `Readonly<Record<string, string>>` 逐格 `toEqual`，因为提示词字节看不见「该 role 的声明会丢掉的格」（fix 面的 `INPUT_REVIEWS`、review 面的 `WAVE`），只有两份记录能作证；字节那一半留着当第二半；路径格经 `scene.repoRoot.relativize` 在 compose 内收成一种写法——`#rel` 的转换点没有丢，也没有在调用点补第二道，而 `#valuesOf` 今日正是逐格走 `#rel`；两个消费者此时仍是两处派生——「同一份输出」是 Task 5 的判据，那里有判据一次 / 镜像零次的 spy 断言），快照的两臂都有生产者且都活着（`read` 臂与 `mismatch` 臂各喂一次，被篡改的请求载体在 pre-flight 就拒成 `carrier` 行；Task 5 退役 #artifactCellOf 之后这里仍是唯一生产者）；**identity 的 `op` 是折后值**（`RoundRecords.opOf` 一处折，`branch-review` → `review`；composer 与拒绝记录的写者读同一个值，`attemptOf` 也在它上面求——board 行因此不会印出一个别的行不用的动词拼写）；**`(cycle, attempt)` 与折叠后的帧一致**（`--recover` 的 abort fold 排在裁决之后，所以 composer 分配两个号时账本里还没有被杀那一轮：两个号都在「本 key 的记录 + `AbortFold.bookedOf` 说折叠即将写下的一轮」这同一个切片上求（`AbortFold#withPending` + `RoundRecords.cyclesOf`——review 面的 cycle 是它在该切片上的寄存器长度，不是折叠前账本的读数，否则一条被杀在 `1·a1` 的 review 会装配成 `1·a2` 而帧派发 `2·a1`），两号的唯一家是 `ConsumedRound.of`（`session/ledger.ts`），且 `#bookAbort` 读同一个 `bookedOf`——一个折叠夹具的成对断言：折叠后派发的提示词名的是 `-a2`（不是被杀那一次的 `-a1`），而折叠读出的 `(cycle, attempt)` 正是帧拿到的那一格，review 面与 implement 面各一条）；**九值门名没有破 reason 表**（`DISPATCH_REASON` 的四条新行 token 即站名，`structureRefusal` 的 `reason: gate` 无需 cast 即过 `tsc --noEmit`；`PreFlightReason` 保持五值，四新行不带它——它们的措辞来自 `RowRefusal.detail`，不发生第四个词汇表）；**缝合侧的判定输入都有生产者**（`host` · `values` · `declarations` · `scene` · `artifact` 五格，每格在 Files 里点名一个来源，`session/` 零新增 `render/` / `face/` 的 import；判据自己的 `naming` 一格由缝合以 `{ answered: false }` 自答——派发模式的答案，不进 context、不增第六格；判据的存在性读同样不增 context 的一格——`PreFlight#vet` 把自己构造期注入的 `fs` 交给 `judge`（默认 `NodeFs`），判据因此不 import 具体实现）；生产侧唯一 `vet` 调用与两个测试文件的五个 context 构造器（`preflight.test.ts` 的 `waveCtx` · `docCtx` · `branchCtx` · `carrierCtx`，`plan-read-consistency.test.ts` 的 `preflightCtxOf`）在同一提交内补齐，43 处 `vet` 调用零改动；**加行的第二处同批到位**（`PreFlightGateName` 的九值与 `Cli#renderPreflightBlocked` 的 gate 名条件在同一个提交里：条件点名七个站名，`graph` · `plan-ledger` 仍落 `cdd <verb>: …` 一支——`rg -n 'preflight.gate ===' packages/cdd-engine/src-next/face/cli.ts` 八命中，其中七处在那一支）；**请求载体的三支优先序只有一个家**（组合根与 `#reviewsPath` 同调 RequestingCarrier，`face/lifecycle.ts` 里零 `carrierPathOf` / `resolveHandoffPath`；族名那一支的下标只有 cycle，attempt 由 `resolveHandoffName` 补——`(cycle, attempt)` 只做记录与命名的身份，不做取路的下标）。

#### DependsOn
1, 3

### Task 5: 退役派发体四门与预览的三门镜像

#### Objective
判定有了唯一的家，派发体里那四道门与三门镜像同时退场——第二处问同一个判定就是第二份事实来源。镜像不只在预览面：它的家是 `face/cli.ts#Cli#runWork` 的 `--dry-run` 臂（`carrierRefusal` → inputRefusal(frame, "preview") → artifactRefusal，再自己调 `Preview#artifactBlock`），spec §2.4 的「循环里镜像的退役」说的就是它——因此该文件进本任务的 Files。`preview.ts` 不进：它今天既不持门判定也没有「三联门块」，`render()` 已经是五行预报、`artifactBlock` 只是把交下来的 reason 拆成行，镜像与它自己那支 `artifactBlock` 分支都在 `Cli#runWork` 里。本任务对 `preview.ts` 的产物因此是一条**约束**而不是一次编辑（见 Produces）。随之退场的是**门拒绝分支**上的 `#sealRoundCarriers`：门在开名之前判，没有名字需要封回。门之外的封名不在此列——abort 记账、丢掉 in-flight 锁的那次派发、终止处理器的死亡路径三条都必须留着。

三个公开判定入口（`CliLifecycle#carrierRefusal` · #artifactRefusal · #inputRefusal）随它们唯二的生产调用点（派发体三处 · `Cli#runWork` 的三门镜像）一并退场，**不留委托壳**：三个入口今天都从**帧**取那份值（inputRefusal 直接调 `#valuesOf(frame, …)`），而本任务正是把帧推演从判据侧拿掉——留一个壳就等于把 `#valuesOf` 的帧重组重新挂回一个公开方法，判据的家与值的家又分两处。代价是一份面测试不再有入口，那件事在本任务的 Files 行里按用例点名（Step 1 第五条的 spy 因此改成对判据本身）。

本任务同时把渲染器接到 Task 4 的那个**同一次装配**上：`CliLifecycle` 不再自己从帧推一份值（`#valuesOf` 退成读组合根交过来的记录），否则门判的值与提示词渲染的值就是两处派生——spec 2.1 的「四格输入」因此只剩一个组合点。那份记录的**运输方式**在本任务里定死：它走构造器的一格（`values`，与 Task 6 的宿主值同一种形状——值走构造器，方法只剩一个读点），两个生产构造点（组合根的 `#lifecycleOf` 与 `#recoverRun` 的一次性实例）各交 `runWork` 里 `before.values` 的**同一个对象**；`#valuesOf(frame)` 的签名保留，但它的体不再读帧——签名留着只是让两个 session 面成对断言的调用形状不必搬家，读点因此仍只有一处。同批退场的还有判据侧的命名豁免：PreFlightRowsInput 的 `naming` 那一格在本任务里整体退场，引擎写的格由声明面自己作答（`written: "engine"` + 命名槽），因为这时门已经跑到 brief 渲染之前，而 brief 还没被写出来——把豁免留在那里就会让每次 wave 派发在 `target-absent` 上死。

#### Files
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（删四门判定；删**门拒绝分支**上的 `#sealRoundCarriers`——carrier · dispatch-input · artifact 三处，不是拒绝路径上的全部调用；三个公开入口 `carrierRefusal` · artifactRefusal · inputRefusal 连同它们的 docstring 同批退场——派发面从此没有任何「问一次判定」的入口；判定搬走后**只服务于那三个入口的私有机械**同批退场，逐个点名：#inputRefusalOf（连它的 `mode` 参数）· #artifactRefusalOf · #artifactCellOf · #artifactReadOf · #requesterDigest · #rulingsInputOf · #answeredByNaming（它唯一的读者就是 `mode === "preview"` 那一臂，而它自己的签名 `(decl, token, frame)` 从来没有 `mode` 参数）· Task 3 为这三个入口留下的七件机械——RowJudgment 接口（它的 artifactCell: ArtifactCell 成员正是 ArtifactCell 删除的绊脚石）· #rowsOf · #snapshotOf · #snapshotReadOf（签名按退役的 `ArtifactReadOf` 定型）· `#sceneFacts` · #namingAnswer（#answeredByNaming 的唯一调用者）· #firstRowOf 静态，七件随三个入口一起退场——`#runDispatch` 里那个 #artifactCellOf(frame) 局部，以及只被它们使用的 ArtifactCell 类型 · NO_ARTIFACT 常量 · `session/artifact-reads.ts` 的三个 import（`ABSENT_READ` · `ArtifactReadOf` · `ArtifactReads`）——这一批没有任何一条门会看见：套件是绿的、`tsc` 没开 noUnusedLocals（`packages/cdd-engine/tsconfig.json`）、`check:no-bare-functions` 在这里零命中，`biome` 只报 import；`#reviewsPath` · `#reviewFamilyPath` · `#requesterRecord` 不在此列，它们在完成性判据与族名面上另有活读者，且三支规则已在 Task 4 搬进无帧取路——本任务之后三者只余委托骨架，`#reviewsPath` 仍是完成性判据的唯一入口）；构造器新增 `values` 一格（`Readonly<Record<string, string>>`，必填、无默认值——可选会让缺省退回帧推演，也就是把本任务要消掉的那条路径留成 fallback），`#valuesOf(frame)` 的体成为对它的读
- Modify: `packages/cdd-engine/src-next/face/dispatch-values.ts`（**交付时新增的一格**：`ArtifactSnapshots.of`——组合根那份 artifact 快照装配（原 `Cli#artifactSnapshotOf` / `#snapshotReadOf`）搬进本模块，因为它就是 composer 三格里的第三格，且现在有**两个**生产者：组合根与任何要派发一帧的夹具。`#requesterRecord` 随 `#requesterDigest` 一并退场（它唯一的读者就是后者；`#reviewsPath` / `#reviewFamilyPath` 留着，`#reviewsPath` 仍是完成性判据的唯一入口），构造器的 `fs` 一格同批退场（它只服务退役的四门））
- Create: `packages/cdd-engine/src-next/__tests__/support/dispatch-values.ts`（夹具侧的同一装配：`TestDispatchValues.of(scene, frame, { reviews })` = 身份 · 场景事实 · 快照三格经 `DispatchValues.compose`；三个测试文件读它，`lifecycle.test.ts` 与 `cli.test.ts` 的九 / 四十五处构造点因此各多一行而不是各写一份手值记录）
- Modify: `packages/cdd-engine/src-next/face/cli.ts`（`Cli#runWork` 的 `--dry-run` 臂删掉三门镜像与它自己那支拒绝分支，只留五行预报；`#lifecycleOf` 与 `#recoverRun` 的一次性实例同批各补构造器的 `values` 一格——值就是 Task 4 已在同一函数里装配好的 `before.values`，本任务把那份记录交给第二个消费者，不重装一份）
- Modify: `packages/cdd-engine/src-next/contract/preflight-rows.ts`（命名豁免那一格退场：`naming` 输入删除，引擎写的格只由 `declarations` 上的 `written` 判定；`mode` 概念从判据里消失，一个读点）
- Modify: `packages/cdd-engine/src-next/session/preflight.ts`（`naming` 那一格的生产调用点同批删除：`PreFlightRows.judge` 调用里的 `naming: { answered: false }` 与它上面那段注释一并退场——判据不再收这一格，留着它就是 TS2353，而本任务的 Step 4 门跑 vitest（esbuild 剥类型），看不见这个多出来的对象字面量属性，残余会漏到 Task 6 的 `tsc` 门里一个本任务不拥有的文件；本任务因此自带同一条类型门）
- Modify: `packages/cdd-engine/src-next/face/words.ts`（行合成的第二处与两词闭集的第二处声明随旧入口退场：`Words#dispatchInput`（`[station, segments.join(separator)].join(" · ")` 那一处，判据接管后零调用）· DispatchInputSegment（它的唯一读者 #emptyReasonOf 已在 Task 3 随判据搬进 contract 而退场，本任务删这一格）· DispatchInputReason（同名并集的第二处声明，判据那侧的 `ExigibleCell.reason` 是唯一声明处）；`Words#artifactIdentity` **不在此列**——它的两个读者是 `board-view.test.ts` 的夹具，而它读的正是 `CAPSULE_WORDS.artifactIdentity` 那四段（判据经注入的词面读同一张表，因此不是第二份字节之家），本任务只把它的生产调用点换成判据）
- Test: `packages/cdd-engine/src-next/face/__tests__/lifecycle.test.ts`（构造器的 `values` 一格 + **随门退场的面级用例**：该文件那九处夹具的 `values` 由**夹具自己的帧事实**经 `DispatchValues.compose(identity, scene, snapshot)` 组出——与 `session/__tests__/preflight-rows.test.ts` 同一条规则，不另写一份手值记录；本任务之后 `#valuesOf` 读的就是这份注入记录，`values: {}` 会让提示词渲染成空串，因此该文件从 spawn 的 argv 上断言的提示词字节（`dispatchFrame` / `runFixFrame` 展开的那几处）**逐字不变**，夹具一空就红。**交付时补记**：P31 T3「carrier-integrity 门」整块 · P36 T6「misplaced sidecar 门」整块 · P34 T2 的两条门拒绝用例 · P31 T2 的 bad-sidecar 拒绝循环 · P31 T5 的「pre-spawn 门拒绝封名」一条 · P34 T3 的「两条 reversal ② 门拒绝」一条，六处随它们断言的门一起退场（它们的题目就是那些门；判据一半归 `contract/__tests__/preflight-rows.test.ts`，面一半归 Task 6 的 `cli.test.ts` E2E）；同文件新增两条换代用例：判据在派发面上**零次**调用、退役符号与三条非门封名在源码里逐条零命中）
- Test: `packages/cdd-engine/src-next/face/__tests__/preview.test.ts`（**交付时补记**：`--dry-run` 经循环那一条同时用 `vi.spyOn(DispatchValues, "compose")` 钉住「组合根的 composer 恰好一次」——(n) 的第三半在 `cli.test.ts` 的 E2E 组里够不到（该组仍红，见 Acceptance 的披露），因此落在这条已经过组合根的用例上，与同一个用例里的判据 spy 并排断言）
- Test: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（仅循环级：`--dry-run` 经 `Cli#runWork` 的循环跑一次，判据一次、镜像零次；该文件的 E2E 组在本任务之后仍红，owner 是 Task 6——见 Acceptance 的披露，因此它**不在**本任务 Step 4 的门里）
- Test: `packages/cdd-engine/src-next/face/__tests__/dispatch-input.test.ts`（入口迁移，三个公开入口退场后逐条落定：以纯判据为题的用例（(a)–(h2) · (j)–(l) · (m) 的两处门调用 · (p) · **(i) 的 inputRefusal(reviewFrameOf()) 调用**——它问的是纯判据，与同一用例里的 `step()` 断言是两件事，只有后者留下）把**期望字面量原样**搬到契约判据（`PreFlightRows.judge`）这个入口下并把家搬到下一条的契约测试文件；(p) 的 `mode` 参数与预览豁免随 `mode` 退场重写成「同一判据、任何面无存在性读」；(n) 的「一次装配」三半各有归属（`#runDispatch` 零判定调用在 `lifecycle.test.ts` · `#valuesOf` 只读组合根交来的记录在 `session/__tests__/preflight-rows.test.ts` 的 `toBe` 对 · 组合根的 composer 恰好一次在 `preview.test.ts` 的循环用例上——三分之一在 `cli.test.ts` 的 E2E 组里够不到，那组仍红）；(i) 与 (m) 的 `step()` 断言 · 两个 async 用例留在原文件不动；(o) 的封闭集断言不属于面，随它读的模块一起搬走——新家是下一条的契约测试文件，pin 改读 `contract/context-declarations.ts`（两词的唯一声明处），`face/words.ts` 那一半随 DispatchInputReason 退役删掉。构造器的 `values` 一格与本文件同一条夹具规则——该文件那五处夹具的 `values` 由夹具自己的帧事实经 `DispatchValues.compose` 组出，spawn 的 argv 上那处提示词字节断言因此**逐字不变**（`values: {}` 会让它反转），入参记录不手写）
- Test: `packages/cdd-engine/src-next/contract/__tests__/preflight-rows.test.ts`（承接上一条搬来的纯判据用例：它们的期望字节不变，夹具换成契约判据自己的输入——声明行由 `TemplateAssembler#layoutOf` 取，场景事实 · 快照 · 目标面是平值；一个判据一份字节断言，面侧只留钉接线的用例；case (o) 也落在这里——它 pin 的两词闭集现在由 `contract/context-declarations.ts` 声明，它自己的源码读法因此指向声明处而不是 `face/words.ts`；`naming` 那一格退场时，本文件的处理**不是一律删格**：两处真夹具（`inputOf` 的默认格、case (f) 里那一格）是纯删格，case (f') 则**整条用例随豁免退场**——它的题目（「没有命名答案时引擎写的空格是一次空值」）正是被删掉的那一件事，`naming` 一去 `#reasonOfCell` 的 `answered` 只剩 `cell.written === "engine"`，那条期望再也发生不了，删格只会留下一条恒红的用例）
- Test: `packages/cdd-engine/src-next/session/__tests__/preflight-rows.test.ts`（两处成对断言改写成「门与渲染器读同一个注入对象」：构造 `CliLifecycle` 时交 `values` = `DispatchValues.compose(...)` 产生的**同一个记录**，断言 `lifecycle.valuesOf(frame)` 与它同一（`toBe`，不是 `toEqual`），提示词字节仍以该记录的 `TemplateAssembler` 渲染为参照——本任务之后前者就是后者的输入，`toEqual` 会静默退回同义反复，而这两格是「值只有一个生产点」在测试面上唯一的证人）

#### Consumes
- Task 4 的 `PreFlightVerdict`（`gate` / `message` / `details` / `order`）与组合根交下来的那份**装配好了的平值记录**（DispatchValues 的输出：渲染器读它，不再自己从帧推）
- `Preview.artifactBlock`（既有，预览的拒绝块）

#### Produces
- `CliLifecycle` 的派发前判定面只剩「交付」：渲染读的那份值是组合根交过来的那一次装配（`#valuesOf` 的体成为对它的读，不再从帧重组一份）；判定一律来自缝合。
- 判据的命名豁免退场：PreFlightRowsInput 只剩四个值 + 声明行 + 场景事实 + 词面，引擎写的格在每一面、每一种模式下同一个判据。
- `face/preview.ts` 零编辑，且这是一条可判的约束：它今天就不持门判定、没有三门的块，`render()` 已是五行预报，`artifactBlock` 是**唯一**的拒绝块渲染器（只把交下来的 reason 拆成行）。镜像退役后它仍是那个渲染者——不接管 details 行、不长出 `details` 参数、不再问任何一道门；Step 3 的 checkable 因此按「`preview.ts` 不在本次 `--stat` 里」核，而不是按一句实现说明核。
- `Cli#runWork` 的 `--dry-run` 臂只剩「取帧 → 渲染五行预报」：它不再自己问三道门，也不再自带一支 `Preview#artifactBlock` 拒绝分支——拒绝面统一由组合根那一支陈词（Task 6）。

#### Steps
- **Step 1: 写五条失败测试**（一次派发只判一次 · 门拒绝分支零封名调用 · 预览块与被拒同源逐字节相同 · 丢掉 in-flight 锁的那次派发仍封回本轮两个名字：`#inflight.acquire` 抛 `HoldingError` 之后两条 carrier 名都不可写 · **循环里的镜像退役**：`cdd implement --tasks 1 --plan <plan> --dry-run` 经 `Cli#runWork` 的循环跑一次，`PreFlightRows.judge` 的 spy 恰好一次，而通过夹具上仍只印五行预报——`--dry-run` 的出口只余预览块与一行 `refused:` 这件事**不在本条**：那是 Task 6 的条目 11–13（流的收束与 exit 码是本任务的声明边之外的一步，本任务跑到时 `refused:` 行还不存在）） — checkable: `lifecycle.test.ts` 与 `preview.test.ts` 各多出对应用例（第四条在 `lifecycle.test.ts`），第五条**落在 `preview.test.ts`**（交付时改写：该文件的 dry-run 夹具是绿的，而 `cli.test.ts` 的 E2E 组在本任务之后仍红——把这条告警写进一个自己够不到的绿里等于没写；`--dry-run` 经 `Cli#runWork` 的循环跑一次、`PreFlightRows.judge` 的 spy 恰好一次、五行预报仍在；三个门方法已不存在，它们的「零调用」由 Step 3 的源码零命中守）
- **Step 2: 跑测试确认红** — checkable: 三个面测试文件报红，原因指向仍在的第二次判定
- **Step 3: 删派发体四门 · 删门拒绝分支的封名 · 删循环的三门镜像 · 预览侧零编辑（`artifactBlock` 原样留下）** — checkable: `rg -n 'sealRoundCarriers' packages/cdd-engine/src-next/face/lifecycle.ts` 只剩定义对（`#sealRoundCarriers` / `#sealRoundCarriersOf`）与三条**非门**调用——abort 记账（`#bookAbort` 里的 `#sealRoundCarriersOf(op, "wave", …)`）· 丢掉锁的那次派发（`#inflight.acquire` 的 `catch` 里的封名：gate→acquire 竞态下这两条名字都得封回，否则下一次 preflight 的孤儿清扫才收得回）· 终止处理器里的死亡路径封名（P31 T5 §2.4：kill / timeout / crash 之后仍须封，必须保留）；carrier · dispatch-input · artifact 三处门拒绝分支零命中；rg -n 'carrierRefusal|artifactRefusal|inputRefusal' packages/cdd-engine/src-next/face -g '!**/__tests__/**' 零命中（镜像与三个公开入口随它们唯二的生产调用点一起退场，不是把 `, "preview"` 删掉留下第二判官）；只服务那三个入口的私有机械也零命中，但**按文件核、不按 face 面核**（rg -n 'inputRefusalOf|artifactRefusalOf|artifactCellOf|artifactReadOf|requesterDigest|rulingsInputOf|answeredByNaming|rowsOf|snapshotOf|snapshotReadOf|sceneFacts|namingAnswer|firstRowOf|RowJudgment|NO_ARTIFACT|ArtifactCell' packages/cdd-engine/src-next/face/lifecycle.ts 零命中，且 `rg -n 'artifact-reads' packages/cdd-engine/src-next/face/lifecycle.ts` 零命中——退役面就是这一个文件，留着它们就是留一条没有活读者的 artifact 读取路径，下一手会当它是第二份事实源；**按面核必红**：`face/board-view.ts` 是 `artifact-reads` 的另一个活读者（`art:` 投影的 `ArtifactReads` import 与它自己的 #artifactReadOf），也带一个叫 NO_ARTIFACTS 的投影常量（不是本任务的 NO_ARTIFACT），而 board 不在这条退役面上；面级的零命中只有三个退役入口那一条（carrierRefusal|artifactRefusal|inputRefusal，board 不持有））；行合成的第二处与两词闭集的第二处声明也零命中（rg -n 'Words#dispatchInput|DispatchInputSegment|DispatchInputReason' packages/cdd-engine/src-next/face -g '!**/__tests__/**' 零命中——判据接管后同一条句子只剩一个合成点、同一个闭集只剩一处声明）；构造器的 `values` 没有可选写法（`rg -n 'values\?:' packages/cdd-engine/src-next/face/lifecycle.ts` 零命中），且它有恰好一个写点与一个读点（`rg -n 'opts\.values' packages/cdd-engine/src-next/face/lifecycle.ts` 恰好一处——构造器把每个选项存进字段，`valuesOf` 不碰 `opts`；`rg -n 'this\.#values\b' packages/cdd-engine/src-next/face/lifecycle.ts` 两命中：构造器的赋值与 `valuesOf` 的体——`\b` 挡在字段名与 `Of` 之间，`this.#valuesOf(` 的那些调用因此不进这条计数）
- **Step 4: 跑绿 + 本任务拥有的四个面测试 + 迁移后的判据面** — checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/contract/ src-next/face/__tests__/lifecycle.test.ts src-next/face/__tests__/preview.test.ts src-next/face/__tests__/dispatch-input.test.ts src-next/session/__tests__/preflight-rows.test.ts` 全绿（含入口迁移后的 `dispatch-input.test.ts` · 承接它的 `contract/__tests__/preflight-rows.test.ts` · 改写成同一对象的那个 session 面文件）；这一道门里 `lifecycle.test.ts` 与 `dispatch-input.test.ts` 的夹具各由自己的帧事实经 `DispatchValues.compose` 组出 `values`，它们的提示词字节断言因此**逐字不变**（`values: {}` 会让这两处当场反转，而 `tsc` 对它们一声不吭）；`face/__tests__/cli.test.ts` 的 E2E 组**不在这道门里**——它今天就是红的，连同它那 61 例的归属一起交给 Task 6（见 Acceptance 的披露）；`rg -n 'answeredByNaming|#valuesOf\(' packages/cdd-engine/src-next/contract` 零命中（豁免格与帧推演不进判据）；**交付时新增**：`src-next/contract/` 里就有 pin 门（`pins.guard.test.ts` / `census.guard.test.ts`），退役符号让 docs 语料里 158 条 pin 变成死 pin——这条门因此要求同批重锚那八份文档（`docs/kairos/{plans,specs,overalls}` 的 P34 · P36 · P37 · P38 · P40 家族），做法是把行内反引号里的退役符号改成裸词（pin 只判行内 code span，围栏与裸词都不是 claim）；`pnpm exec tsc --noEmit -p packages/cdd-engine` exit 0（`naming` 那一格退场后，生产侧那处调用与 `contract/__tests__/preflight-rows.test.ts` 的**两处夹具同批删格**，而该文件的 case (f') **整条退场**——它的夹具就是那条用例本身（`naming: { answered: false }` 喂的是一次引擎写的空格），删格只会让它转红，退场判据是「`written: "engine"` 的格在每一种输入上都不受空值惩罚」；vitest 为这三处付不出任何代价，这道门是它们唯一的守卫，基线是 Task 4 收口时的同一条命令）
- **Step 5: 提交** — checkable: 本波的实现落成**一个**原子提交，改动内含 Task 5 与 Task 7 两个任务体（「一次原子提交、不按任务拆」在本波压过「Task 5 独占一次 stat」这条读法），因此判据按**本任务自己的路径**核：`git show --stat HEAD -- packages/cdd-engine/src-next/face/lifecycle.ts packages/cdd-engine/src-next/face/cli.ts packages/cdd-engine/src-next/contract/preflight-rows.ts packages/cdd-engine/src-next/session/preflight.ts packages/cdd-engine/src-next/face/__tests__/lifecycle.test.ts packages/cdd-engine/src-next/face/__tests__/preview.test.ts packages/cdd-engine/src-next/face/__tests__/cli.test.ts packages/cdd-engine/src-next/face/__tests__/dispatch-input.test.ts packages/cdd-engine/src-next/contract/__tests__/preflight-rows.test.ts packages/cdd-engine/src-next/session/__tests__/preflight-rows.test.ts` 十行齐（`face/cli.ts` 与 `cli.test.ts` 是循环那一半，见 Files 行）；**`preview.ts` 的零编辑按 hunk 核、不按 stat 行核**——`git show HEAD -- packages/cdd-engine/src-next/face/preview.ts` 的改动只有 Task 7 的交界（行首词搬进 `CAPSULE_WORDS` 与 docstring 改述），本任务不给它加一行，「零编辑」读作「本任务不产生它的 hunk」而不是「它不在 `--stat` 里」

#### Acceptance
一次派发只判一次（`PreFlightRows.judge` 的 spy 计数 = 1，含 `--dry-run` 经循环那一次）；门判的值与提示词渲染的值是同一个 composer 的同一次输出（渲染侧不再从帧重组一份：那份记录经构造器的 `values` 一格进来，`#valuesOf` 只有一个读点，两个生产构造点都交 `before.values` 的同一对象；`session/__tests__/preflight-rows.test.ts` 的两处成对断言因此从「两次独立推演相等」改成「只有一个对象」（`toBe`）——`toEqual` 在本任务之后是同义反复而不是证据，该文件同时在 Files 与 Step 4 门里）；**交付时补记**：`dispatch-input.test.ts` 的两条 async「被拒一轮」用例与 (m) 的 `step()` 半条不再成立——面不再拒绝，那两条的题目就是「门在 spawn 之前拦住」；它们退场，`(m)` 改写成「面不判、坏格到得了 child」，而 (i) 的 `step()` 半条原样留下（它问的是提示词字节，与门无关）。`lifecycle.test.ts` 的六处面级门用例同批退场（见 Files 行）；判据侧零命名豁免（引擎写的格在四个面、两种模式下同一个判据，`naming` 输入已不存在，它的生产调用点与三处夹具在同一次提交里落地——两处删格、case (f') 整条退出，因为它的题目（「没有命名答案时空格是空值」）随豁免一起作废，`pnpm exec tsc --noEmit -p packages/cdd-engine` exit 0 是本任务的门之一——vitest 剥类型，看不见残余的对象字面量属性）；三个公开判定入口在 `src-next/face` 的产物里零命中——它们随门退场，不是留成委托壳（留壳就会把 `#valuesOf` 的帧重组重新挂回一个公开方法）；**门拒绝分支**零封名调用（按谓词核，不按条数：`rg -n 'sealRoundCarriers'` 在 `face/lifecycle.ts` 只余三条非门调用——`#bookAbort` 的 `#sealRoundCarriersOf` · `#inflight.acquire` 的 `catch` 封名 · 终止处理器的死亡路径封名，后两条分别是 gate→acquire 竞态与 P31 T5 §2.4 的晚落地保证，不得随本任务退役）；丢掉锁的那次派发仍把本轮两个名字封回；预览块与命令面同源；**私有机械不留在场上**（#inputRefusalOf · #artifactRefusalOf · #artifactCellOf · #artifactReadOf · #requesterDigest · #rulingsInputOf · #answeredByNaming 与 Task 3 留下的七件机械——RowJudgment · #rowsOf · #snapshotOf · #snapshotReadOf · `#sceneFacts` · #namingAnswer · #firstRowOf——以及 ArtifactCell · NO_ARTIFACT · `artifact-reads` 的三个 import 在 `src-next/face/lifecycle.ts` 里零命中——退役面就是这一个文件：`face/board-view.ts` 的 `artifact-reads` 读者与 NO_ARTIFACTS 投影常量是 board 自己的活代码，face 面的零命中只对三个退役入口成立；它们失去读者后不会让任何一条门转红，所以这条零命中就是它们唯一的登记；按 face 面收下的则是 `Words#dispatchInput` · DispatchInputSegment · DispatchInputReason——行合成的第二处与两词闭集的第二处声明，而 `Words#artifactIdentity` 留下（board 夹具的簿记，读的是同一张表））；面测试的入口迁移逐条落定、无一条断言随入口消失而没有归属（纯判据用例的期望字节原样落进 `contract/__tests__/preflight-rows.test.ts`——含 (i) 的 inputRefusal 调用，(n) 的三半各在它的归属处断言（`lifecycle.test.ts` 的零判定调用 · `session/__tests__/preflight-rows.test.ts` 的同一对象 · `preview.test.ts` 循环用例上的 composer 一次），(p) 重写为「同一判据、任何面无存在性读」，(i) 与 (m) 的 `step()` 断言 · 两个 async 用例留原文件，(o) 搬到契约测试文件并改读声明那两词闭集的模块，`face/words.ts` 那一半随它退役）；`src-next/face/` 与 `src-next/contract/` 在**本任务门里**全绿（门的行集是 Step 4 那五个路径：`src-next/contract/` 与四个面测试文件——`lifecycle.test.ts` · `preview.test.ts` · `dispatch-input.test.ts` · `session/__tests__/preflight-rows.test.ts`）；**`face/__tests__/cli.test.ts` 的 E2E 组不在本任务的绿里**——它在本任务之后仍然是红的，本任务收口时实测 61 failed / 233 passed；`aa67541c` 上同一个文件也报 61 例红，所以那个数不是本波改出来的，**成分**是。红分三类。① 共享夹具 `HostEnvironment` 在 `beforeEach` 清掉两个宿主标记，`#runDispatch` 顶部的 no-host 早退把每一次工作派发都拒了——把标记钉回去后 47 例转绿。② 仍红的 14 例：夹具在 `BASE_BRANCH` 空时现在先被 `dispatch-input` 拒（优先级位移），旧断言的 `wrong-phase` 那行不再可达。③ **本波引入的第三类：`--dry-run` 的拒绝面**——循环里的三门镜像退役后，`--dry-run` 的结构腿拒绝改由组合根那一支陈述（`CDD_BLOCKED:` 走 stderr，stdout 上既没有预览块也没有 `  refused:` 行），于是 P38 T3 的四条预览钉在树上转红，直到 Task 6 把 `Preview#artifactBlock` 接进那条出口、并把宿主标记钉回共享夹具：renders the gate's own reason on the `refused:` row — three violation arms, byte for byte 与 prints the carrier-integrity refusal the real run hits — the requesting digest, judged 断的就是那一行（实测两处 `previewValue` 断言都收到 `(no refused row)`）；`fix --dry-run renders the artifact-identity refusal the real run would hit — and writes nothing` 断的是同一个 `artifact-identity` 块的首行与续行（今天的 stdout 是空的，实测在预览块首行那条断言上转红）；`is satisfied by the brief's NAMING — a preview never reds the brief it would have rendered itself` 则断言一次**通过**的预览（exit 0 与六行预报），而今天的预览先被 no-host 行拒（stdout 空、exit 1）——后两条都断在「预览根本没渲染出来」，成因是预览不再短路。四条在 `aa67541c` 上都是绿的：那时镜像在 `Cli#runWork` 里先返回，预览既走不到 no-host 早退，`refused:` 行也由镜像自己印出——所以「61 → 0」不是「同一批 61 例」，Task 6 收口时必须把这四条当作本波留下的守卫来数。三类都归 Task 6：它拥有该文件、也持有退役早退 · 宿主标记与“加行两处”的活，它的 Step 4 门跑全 `face/` + `session/`；本任务因此不写一条自己够不到的绿。

#### DependsOn
4

### Task 6: 组合根：写、清、dry-run 守卫、宿主探针

#### Objective
组合根是唯一写者与唯一清除者，两者对称但不在同一个跨段区间里——它们是两个锚点：**清除**在 `vet` 返回之后、`--recover` 的接管判定（`recover && structureRefusal(preflight) === null`）**之前**，`structureRefusal(preflight) === null` 且**非** `--dry-run` ⇒ 清除；**写入**在 `verdict.leg === "structure"` 那一支里、`#renderPreflightBlocked` 之前，拒绝存在且非 `--dry-run` ⇒ 写记录。`#renderChecked` 与 `ensure()` 不构成写与清的边界——approved 路径上今天是 `#renderChecked(preflight)` 在前、`scene.workspace.ensure()` 在后，把清除写进这二者之间就是把它排在接管判定之后：一次九行全过、而 `#recoverRun` 答「无可接管」的 `--recover` 派发在 verdict 之前以 exit 1 收场，清除因此永不执行，一条 `tree-clean` 记录会活过一次整条结构腿通过了的派发。宿主只探一次，交值给缝合、派发体与预览三处。派发体的释放点上补第二个清除触发，带 `in-flight` 谓词；该谓词在记录不可读时**没有能成立的到期条件**——`readRaw()` 答 `corrupt` 时 `station` 读不到，那条记录因此原样留在盘上（写成「不是 `absent` 就清」会把持有期间写下的一条截断记录删掉，而本任务十九条断言与 Task 7 的 corrupt 用例全绿）。那一次读是**树级**的（`readRaw()`，不做 slug 比较）：一条 `in-flight` 拒绝在持有者释放的一刻就失效，而写下它的那次派发未必属于本工作区——按 slug 过滤的 `read()` 去读，别的相位写下的那条就会活过它的失效点，board 上一行说这棵树没被占、另一行说它因为被占而拒。

`--dry-run` 上的入口也在同一段收成一个：`runWork` 里 `verdict.leg === "structure"` 那一支今天在 `--dry-run` 上分岔成两条出口（`preflight.gate === "in-flight" && preflight.holding !== undefined` 那一臂走 `Preview#heldBlock`，其余走 `#renderPreflightBlocked`），此后整条结构腿的拒绝在 `--dry-run` 上一律由预览面陈述——stdout 的预览块 + 一条 `  refused:  station · detail` 行，`CDD_BLOCKED:` 不出现在任何流上，details 行与 checked 面仍在 stdout（details 的印点在此点名：`Cli#runWork` 在预览块之后逐条印 `preflight.details`，形状照搬 `#renderPreflightBlocked` 今日的细节段——`Preview` 不接管它，否则同一个块就有两个渲染者，而首个渲染会静默地是空的）；`checked` 面的印点同样点名：同一个出口在 details 行之后调 `#renderChecked(preflight, (text) => this.#io.stdout(text))`——与 `in-flight` 那条保留臂今天的写法逐字同形，`Preview` 不接管它（不调它，脏树上的 `cdd review --dry-run` 只印预览块与 `refused:` 行，spec §2.4 的「checked 面保留」为假，而 Step 1 每一条断言仍绿）；`in-flight` 那一臂按**谓词**保留、不按标签保留：`preflight.gate === "in-flight" && preflight.holding !== undefined`（今天 `face/cli.ts` 里就是这个条件）——它覆盖活主 · 死主 · 带锁的坏记录三种形状，三种都带 `lock:` 面与各自的提示、无 `refused:` 行；`--dry-run` 使 `ctx.recover` 为假，死主与带锁的坏记录因此同样被 `#inFlightRefusal` 拒绝并带上 `holding`。入口合并改写的是拒绝的**流与出口**，不是判据——两种出口念的是同一条活判词（Task 4 的 verdict）。随入口合并而来的是 exit 码：no-host 成了一道门之后，无 harness 的树里 `--dry-run` 从「五行预报 + exit 0」变成「预览块 + exit 1」，有 harness 的树仍预报、仍 exit 0（spec 具名变更③）。

宿主值的三处读者在这一任务里同时落地（**派发路径上恰好一次探测**）：（a）`PreFlightContext.host`（no-host 行）；（b）`CliLifecycle` 的 spawn 读注入的 `HOSTS[值]`，`#runDispatch` 顶部那次 detectHost() 调用与它的提前 return 同批退役，CliLifecycle#detectHost 这个只被那一处调用的适配方法随之退场（那段字面已由 Task 3 搬进词表：`#runDispatch` 今天印的是 `this.#words.preflightWording().noHost`，本任务退役的是探针与早退，不是那句措辞）；（c）`face/preview.ts#Preview` 的构造器改收宿主值，`child:` 行的 `(no host detected — real run would BLOCK)` 分支与钉它的那条测试一并退役。派发路径之外的三处 `HostDetect.detect` 读取（`CliGate` 的 `#renderer` · `Cli#runBoard` · `Cli#runWork` 的 `Capsule`）不动。 两个构造器改收值之后，五个测试文件里的调用点同批迁居（`lifecycle.test.ts` · `dispatch-input.test.ts` · `preview.test.ts` · `session/__tests__/reviewed-identity.matrix.test.ts` · `session/__tests__/preflight-rows.test.ts`）——只迁调用形状，断言一律不改；`tsc --noEmit` 是这条迁移的判据（Step 4）。**第六个测试文件是另一件事**：`face/__tests__/cli.test.ts` 的 E2E 组在本任务之前就是红的（Task 5 的 Acceptance 披露了它），本任务收下两处**夹具活**，它们不在「断言一律不改」之列：① **共享夹具钉一个宿主标记**——`HostEnvironment` 的 `beforeEach` 清完标记后写上 `CLAUDE_CODE_SESSION_ID`（与该类自己那条「测试自己 pin 标记时仍看自己的值」的既有约定同形，`afterAll` 的 `restore()` 照旧把启动时的环境还原），该组 61 例里 47 例的红就止于此（实测：只钉标记即 47 绿 / 14 红）；② **14 例的夹具与期望随优先级位移更新**——一条 `review` 派发在 `BASE_BRANCH` 空时现在先被 `dispatch-input` 拒（`CDD_BLOCKED: dispatch-input · review · BASE_BRANCH · empty-value`），旧断言的 `wrong-phase · next: ` 不再可达，因此那 14 例的夹具补上 base 产物或把期望改到结构腿那一行（按用例各自的意图选，改哪边写在该例自己的注释里）。两件的工作量按 `rg` 定位，不按本行的旧计数核。调用点数以迁移后的实况为准（迁移前二十处、五个测试文件；**逐文件分布不写在这里**——它随 Task 5 的入口迁移而变，任何一版快照都只是当天的读数，实现者按 `rg` 对 `new CliLifecycle` 与 `new Preview` 实测定位）——最后两处正是 Task 5 已经交了 `values` 格、本任务必须补 `host` 格的同一个构造调用；漏掉它，本任务自己的 Step 4 两道门（`tsc --noEmit` 报 TS2741、`vitest run src-next/session/` 在 `HOSTS[undefined]` 上抛）就在一个本任务不拥有的文件上转红，而最省事的错法（把 `host` 改成可选）正好把本任务要删的第二条探测路径又留成 fallback。计数按迁移后的实况核，不按某一版快照核。

#### Files
- Modify: `packages/cdd-engine/src-next/face/cli.ts`（`runWork` 的**两个锚点**（不是一个跨段区间）：清除在 `vet` 返回之后、`--recover` 的接管判定之前；写入在 `verdict.leg === "structure"` 那一支里、`#renderPreflightBlocked` 之前——`#renderChecked` 与 `ensure()` 只是 approved 路径上的后续两步（今天是 `#renderChecked(preflight)` 在前、`scene.workspace.ensure()` 在后），写与清的边界因此不在这两者之间；`host` 探针一次并把值交给三处；释放点清除；`--dry-run` 上结构腿拒绝的出口收束与 exit 码成对）
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（构造器收注入的宿主值；spawn 读 `HOSTS[值]`；`#runDispatch` 顶部的 detectHost() 调用与提前 return 退役（那句 no-host 措辞已由 Task 3 搬进词表）；释放点的清除谓词）
- Modify: `packages/cdd-engine/src-next/face/preview.ts`（构造器改收宿主值；`child:` 行直读那张表，空值分支退役。**docstring 不在本任务的编辑面**：`Preview#artifactBlock` 上方那段今天已读作 P40 之后的角色（「the STRUCTURE leg's ONE refusal renderer … One renderer, two faces」，`packages/cdd-engine/src-next/face/preview.ts` 里那几行），`rg -n 'one of the three' packages/cdd-engine/src-next/face/preview.ts` 今天已零命中——本任务按 verify-only 核这一条，不重写已经正确的 prose，也不为一份「改述」记一次编辑；本行真正落到树上的改动只剩宿主值那一处）
- Modify: `packages/cdd-engine/src-next/session/dispatch-authority.ts`（只有一处要改：`structureRefusal` 的 docstring 里那张五行清单（`tree-clean` · `in-flight` · `graph` · `plan-ledger` · `doc-contract`）改念九行——四个站名随 `PreFlightGateName` 与 `DISPATCH_REASON` 已在 Task 4 到位；`#message` 的 `${reason} · ${detail}` 形状不动，它今天已是九行的唯一渲染处，本任务在渲染侧零新增）
- Test: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（十九条新用例 + 共享夹具的宿主标记 + 14 处旧夹具/期望的优先级位移更新——后两件见 Objective，它们不是「只迁调用形状」，而是该文件转绿的那一半）
- Test: `packages/cdd-engine/src-next/face/__tests__/dispatch-input.test.ts`（仅迁 `CliLifecycle` 的构造调用，断言零改动）
- Test: `packages/cdd-engine/src-next/face/__tests__/lifecycle.test.ts`（仅迁 `CliLifecycle` 的构造调用，断言零改动）
- Test: `packages/cdd-engine/src-next/face/__tests__/preview.test.ts`（迁 `Preview` 的构造调用，外加第三处夹具编辑：钉 `child:` 行 no-host 字面量（`"(no host detected — real run would BLOCK)"`）的那条用例随该分支退役一并退役——Objective 的「与钉它的那条测试一并退役」就是这第三条，不是「断言一律不改」的例外被漏写；其余断言零改动）
- Test: `packages/cdd-engine/src-next/session/__tests__/reviewed-identity.matrix.test.ts`（仅迁 `Preview` 的构造调用，断言零改动）
- Test: `packages/cdd-engine/src-next/session/__tests__/preflight-rows.test.ts`（仅补 `CliLifecycle` 构造器的 `host` 一格——那两处已由 Task 5 交了 `values`，`host` 仍缺，而它们就在本任务 Step 4 的 `vitest run src-next/session/` 门里；`host` 与本任务其余四处同形（写死的 `"claude"` 一类值，不新起夹具），断言零改动）

#### Consumes
- Task 2 的 PreFlightRefusal（`write` / `clear` / `read` / `readRaw()`——释放点的清除读后者：树级事实不属于某个工作区）
- Task 4 的 `DispatchIdentity`（`face/dispatch-values.ts`，组合根在 `#beforeOf` 里装配并交给 composer 的**同一个值**）——记录 identity 三格的唯一来源：写者读 `before.identity` 的 `op` / `cycle` / `attempt`，不重推；`op` 已是 `branch-review` → `review` 的折后值，`attempt` 已在「本 key 的记录 + `AbortFold.bookedOf` 说折叠即将写下的一轮」上求过（`ConsumedRound.of`，`session/ledger.ts`）。写者因此**不调** `RoundNaming#attemptOf(records, op, cycle)`：那是同一个号的第二次推导，而 `--recover` 的 abort fold 排在裁决之后，重推出来的号会比装配的那个少一
- Task 4 的 `PreFlightVerdict`、Task 5 的派发体入口（整条腿已过）
- `InFlight#release` 的唯一调用点：`face/lifecycle.ts` 派发体里那一次 `await this.#inflight.release()`（符号定位，不写行号——实现者每轮自行重新定位；`face/cli.ts` 与 `session/run.ts` 都不是它的家）
- `HOSTS` 与 `HostDetect.detect`（`face/host.ts`）——宿主值的唯一拼写表与唯一探针
- `Preview` 的构造器（`face/preview.ts`）——宿主值改从构造器入

#### Produces
- `Cli#runWork` 的三段：探宿主 → `vet` → 拒则写 / 通则清 → `#renderChecked` → `ensure()` → `renderBrief`；探到的那一个值同时交给 `PreFlightContext`、`CliLifecycle` 与 `Preview`。
- 释放点清除：`release()` 之后经 `readRaw()` 读**树级**记录（不做 slug 比较），`station === "in-flight"` 才清——被作废的事实属于这棵树，不属于写下它的那个工作区。谓词的两支因此都写出来：`station` 读得到且等于 `in-flight` ⇒ 清（一次 `clear()`）；第三态 `corrupt` ⇒ **不清**（没有 `station` 就没有能成立的到期条件，删掉它是替一条不可读的事实做决定；它站到下一次结构腿通过、在门口被清为止，spec §2.2 / §4.2）——board 那一侧的 corrupt 行由 Task 7 Step 1 的 corrupt 行用例断言，本条只钉「释放之后 `readRaw()` 仍答 `corrupt` 且文件仍在盘上」。
- 拒绝记录的 identity 三格取自组合根**已为本次派发装配好的那一个 identity**（`before.identity`：判据判的、渲染器渲染的、记录写的是同一格）：`op` 是 `RoundRecords.opOf` 的折后值，`cycle` / `attempt` 是 `ConsumedRound.of` 在「本 key 的记录 + `AbortFold.bookedOf` 的待折叠一轮」上求出的那一对。写者不另调 `attemptOf`、不自己拼第四套动词拼写，因此一条被拒的 `--recover` 派发写下的号与随后那次 approved 派发消费的号是同一个。
- 预览出口的 `checked:` 面：同一个出口在预览块、`refused:` 行与 details 行之后调 `#renderChecked(preflight, (text) => this.#io.stdout(text))`——与 `--dry-run` 的 `in-flight` 臂今天那一次同一形状、同一写者（`face/cli.ts` 上 `#renderChecked` 的带写者调用因此有两处：保留的 `in-flight` 臂与收束后的出口）。spec §2.4 的「checked 面保留」自此有一个点名的印点；`Preview` 不新增 checked 参数、不长出第二个渲染语义——它连 details 都不持，checked 面同理。
- 预览出口的 details：`Cli#runWork` 在预览块之后逐条印 `preflight.details`（`  ${detail}` 的形状照搬 `#renderPreflightBlocked` 今日的细节段）——spec §2.4 的「details 行保留」因此有一个点名的印点，而 `Preview` 不新增 details 参数、不长出第二个渲染语义；不印它们，`graph` / `plan-ledger` 那些 issue / finding 行在入口合并后静默消失。

#### Steps
- **Step 1: 写十九条失败测试**（拒绝不写轮记录且重派仍 `review 1·1` · 记录八字段齐 · **branch 线的拒绝记录身份**：`cdd review --type branch` 在 `tree-clean` 行被拒、且账本里已有一轮 branch 评审（`review 1·a1`）⇒ 记录的 `op` 是 `review`（不是 `branch-review`）、`cycle` / `attempt` 是待跑那一轮的 `1` / `2`，三格派生出的 board 标识因此是 `review 1·a2`（board 的字节归 Task 7 钉，这里钉它派生自的三格） · 通过即清 · `--dry-run` 零写零清 · `tree-clean` 站名不被释放清掉 · **释放即到期（按记录核）**：A 持 in-flight 时 B 在 `in-flight` 行被拒并写下 `station: in-flight` 的记录，A 随后正常结束并释放 ⇒ `read()` 回到 `absent`（board 上两行的并存与同消由 Task 7 按同一条事实断言，本任务不读 board） · **跨工作区的释放即到期**：相位 X 的派发 A 持锁、相位 Y 的派发 B 在 `in-flight` 行被拒并写下 `slug: Y` 的记录，A 正常结束并释放 ⇒ 树级读面（`readRaw()`）回 `absent`，以 Y 构造的 `read()` 也回 `absent`（清除不过 slug 滤网；只按 A 自己的 `read()` 读，Y 那条会站到下一次派发在门口清它为止，而 `cdd board <Y>` 会同时印 `in-flight: free — no dispatch holds this tree` 与 `refused: … in-flight · …`） · **不可读的记录不被释放清掉**：一个有活主的树上，持有期间被写下一条截断的 refusal.json（`station` 不可读）⇒ 持有者正常结束并释放 ⇒ `readRaw()` 仍答 `corrupt`、文件仍在盘上（谓词读不到 `station`，没有任何一条到期条件成立；成对：同一夹具里把记录换成一条合法的 `in-flight` 记录，同一个释放把它清掉——同一谓词、可读与不可读两种输入）；board 那一半（corrupt 行仍被印）由 Task 7 Step 1 的 corrupt 行用例断言，本任务只钉记录本身 · **门口清除先于 line 腿**：记录由一次 `tree-clean` 拒绝落下，把树弄干净，再跑一次九行全过、而 line 腿拒绝的派发（`implement` 相位的 wave 上 `cdd review`）⇒ exit 1 且念 line 腿那一行，board 无 `refused:` 行 · **字节面按站名核**：四个门各真跑拒绝一次，首行分别是 `CDD_BLOCKED: no-host · …` / `carrier · …` / `dispatch-input · …` / `artifact · …`，且五行既有行与 `dispatch-input` 一行与改前逐字节相同（成对：先钉改前字节）、artifact 的四段续行（`derived:` · `found:` · `identity:` · `repair:` 占两行）跟随首行而 refusal.json 里没有它们 · `--recover` 不认领且 refusal.json 仍在、`station` 与被拒那一刻相同 · approved 派发的 `checked:` 面在 implement / review / fix 三个 fixture 上各断言一次**该面的**行名集合（wave fixture 是八行：`tree-clean` · `in-flight` · `graph` · `plan-ledger` + 四新行；`doc-contract` 不在 wave 面上，断言不许连它一起点名），四新行一律 always · `--dry-run` 入口收成一个：脏树上三动词各跑一次，stdout 出现预览头 + 一条 `  refused:  station · detail`，`CDD_BLOCKED:` 在两个流上都零命中；**details 也不得静默消失**：一次诊断住在 details 里的拒绝（`graph` / `plan-ledger` 面：issue / finding 行在 details，不在首行）经 `--dry-run` 跑一次，每一条 detail 在 stdout 各出现一次、且排在预览块之后（不印它，入口合并就把那几行吞了，而其余一切断言仍绿）；**`checked:` 面同样不得静默消失**：同一条 dry-run 用例上断言该面的行名集合出现在 `refused:` 行之后（面按 fixture 取，与 Acceptance 的三面之一同一口径）——只印预览块与 `refused:` 行的那一版在这条断言下红，而其余各条仍可全绿 · 无 harness 树的 `--dry-run` 是预览块 + exit 1（成对：有 harness 的树仍五行预报 + exit 0） · `in-flight` 活主的 `--dry-run` 仍是 `lock:` 面与接管提示、无 `refused:` 行（成对：同一条谓词 `preflight.gate === "in-flight" && preflight.holding !== undefined`） · **`in-flight` 那一臂按谓词保留、按形状成对**：同谓词的另两种形状各跑一次——死主（`--recover` 被 `--dry-run` 作废，`#inFlightRefusal` 仍拒，接管提示在）与带锁的坏记录（`InFlight#inspect` 的 corrupt + locked，印 `corruptLocked` 词面）——两者都印 `lock:` 面加各自提示、都不出现 `refused:` 行；死主那一臂已由 `preview.test.ts` 里那条「prints the takeover hint for a dead holder」用例钉住（本任务断言不变），本条补的是带锁的坏记录与「三种形状同一谓词」这条事实 · **被拒的 `--recover` 也写折叠之后的身份**：一棵树上有一条**死主**的 in-flight 记录（它的被杀轮不在账本里）且树是脏的 ⇒ `cdd fix --type wave --recover` 在 `tree-clean` 行被拒，记录的 `(cycle, attempt)` 是折叠之后那一个（与 composer、与随后那次 approved 派发拿到的是同一格），board 的 `refused:` 行与下一次派发消费的号因此一致 · **门口清除排在 `--recover` 的接管判定之前**：一条站立的 `tree-clean` 记录 + 一棵干净的树 + 一次无可接管的 `--recover` 派发（九行全过）⇒ exit 1 且念无可接管那句（`#recoverRun` 在结构腿通过之后返回它）、盘上已无 refusal.json、board 无 `refused:` 行——把清除写在 verdict 之后的那一版在这条用例上红，而其余十八条仍可全绿） — checkable: `cli.test.ts` 多出十九条用例
- **Step 2: 跑测试确认红** — checkable: 该文件报红，首条用例的失败信息即改前实况（`crashed:` 行仍在）
- **Step 3: 接线**（探针一次并把值交给三处 · 派发体与预览改读值 · 拒则写 / 通则清 · 释放点按 `in-flight` 谓词清 · `--dry-run` 的结构腿拒绝收成预览面一个出口） — checkable: 写与清同住 `runWork`、各占结构腿的一支且共用 `!parsed.dryRun`，且清除排在 `--recover` 的接管判定之前（顺序可核：`structureRefusal(preflight)` 的读先于 `#recoverRun`，清除落在这两者之间；写入落在 `#renderPreflightBlocked` 之前）；释放点的清除走 `readRaw()` 而不是 `read()`（`rg -n 'readRaw' packages/cdd-engine/src-next/face/lifecycle.ts` 恰好一处，同一文件里没有第二处 slug 比较）；记录的 `op` / `cycle` / `attempt` 三格直读 `before.identity`（`branch-review` 不落进记录的 `op` 格，折叠之后的号也不由写者重推）；`--dry-run` 分支上 `#renderPreflightBlocked` 零调用（只剩预览块一条出口），且该出口上 `#renderChecked` 带显式写者（`rg -n 'renderChecked\(preflight, \(text\)' packages/cdd-engine/src-next/face/cli.ts` 两命中：保留的 `in-flight` 臂与收束后的出口——零命中意味着 checked 面在 dry-run 上静默消失），`Preview#heldBlock` 仅存于 `preflight.gate === "in-flight" && preflight.holding !== undefined` 那一臂（活主 · 死主 · 带锁的坏记录三种形状——「有活主」比这个谓词窄，标签会让两种形状被写进预览块）；`rg -n 'HostDetect.detect' packages/cdd-engine/src-next -g '!**/__tests__/**'` 只剩组合根与三处具名面外读者（**四个读者、五行**——第五行是 `face/cli.ts` 在 P40 T4 写下的那句说明「宿主探针只答一个值」的注释，它正当留在原地；判据按读者数读，不按命中行数读），CliLifecycle#detectHost 零命中；记录的两个号取自组合根已装配好的 identity（`rg -n 'attemptOf' packages/cdd-engine/src-next/face/cli.ts` 零命中——同一个号的唯一推导点已随 composer 搬进 `session/ledger.ts` 的 `ConsumedRound.of` 方法体（`rg -n 'naming\(\)\.attemptOf' packages/cdd-engine/src-next/session/ledger.ts` 恰好一处），composer 在「本 key 的记录 + `AbortFold.bookedOf` 的待折叠一轮」上求 attempt 就在那里，因此 face 面零命中而 Task 4 的残留仍是正资产而不是缺口；写者这一支不调它，所以「写者不重推 identity」的判据是这一处的归属，不是它的条数为零）；`--dry-run` 出口上 details 仍被印（`rg -n 'preflight\.details' packages/cdd-engine/src-next/face/cli.ts` 命中且其中一处在 dry-run 出口段，`rg -n 'details' packages/cdd-engine/src-next/face/preview.ts` 零命中——预览不接管细节行）
- **Step 4: 跑绿 + 派发面全量 + 类型门** — checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/face/ src-next/session/` 全绿（`face/__tests__/cli.test.ts` 的 E2E 组是这道门里唯一跨任务的那一项：它的两件夹具活归本任务，见 Objective），且 `pnpm exec tsc --noEmit -p packages/cdd-engine` exit 0（两个构造器的二十个调用点已连同五个测试文件一并迁居，含 `session/__tests__/preflight-rows.test.ts` 的两处 `host` 格）
- **Step 5: 提交** — checkable: `git show --stat HEAD` 含 `cli.ts`、`lifecycle.ts`、`preview.ts`、`dispatch-authority.ts` 与 `cli.test.ts`

#### Acceptance
十九条测试全绿；写与清各占结构腿的一支、同一个 `!parsed.dryRun` 守卫，且清除排在 `--recover` 的接管判定之前——一条无可接管的 `--recover` 派发（九行全过）之后 refusal.json 已不在盘上、board 无 `refused:` 行，把清除排在 verdict 之下的那一版在 Step 1 的第十九条上红；`--dry-run` 上的结构腿拒绝只有一个出口且只走 stdout（`CDD_BLOCKED:` 在两个流上零命中，`preflight.gate === "in-flight" && preflight.holding !== undefined` 那一臂的 `lock:` 面成对不变，活主 · 死主 · 带锁的坏记录三种形状各有一次断言），无 harness 的树 exit 1、有 harness 的树 exit 0；`--recover` 路径上 refusal.json 仍在且 `station` 不变；三面各有一条 `checked:` 行名集合断言——按面取该面的既有行再加四新行（implement / review / fix 的 wave fixture 是八行：`tree-clean` · `in-flight` · `graph` · `plan-ledger` · `no-host` · `carrier` · `dispatch-input` · `artifact`；`doc-contract` 只在 doc 面上出现，九行是 `plan` 面的行数、不是每次派发的行数），写行名与适用面、不写整块快照；`--dry-run` 零写零清；`tree-clean` 站名的记录不被一次释放清掉，而 `in-flight` 站的那条被持有者的一次释放清掉（按 `read()` 核；board 上两行的并存与同消属 Task 7）；**不可读的记录（`corrupt`）同样不被清掉**——释放点的谓词读不到 `station`，那一支没有能成立的到期条件：释放之后 `readRaw()` 仍答 `corrupt`、文件仍在盘上（成对：同谓词下一条合法的 `in-flight` 记录被同一次释放清掉；board 仍印 corrupt 行，那一半由 Task 7 的 corrupt 行用例断言）；**跨工作区的释放同样到期**（释放点的读是树级的 `readRaw()`：相位 X 的持有者释放后，相位 Y 的被拒派发写下的 `in-flight` 记录不在）；branch 线的拒绝记录 `op` 是 `review`、`attempt` 是待跑那一轮的号（`op` 是 `RoundRecords.opOf` 一处折、`cycle` / `attempt` 取自组合根已装配好的 `before.identity`，`branch-review` 不进记录的 `op` 格，写者不重推 identity）；**被拒的 `--recover` 写下的号是折叠之后的那一个**（`(cycle, attempt)` 与 composer、与随后那次 approved 派发拿到的是同一格——两条成对断言：一条在写下去的那条记录上，一条在它之后那次派发的提示词名上）；九行全过而 line 腿拒绝的那次派发之前，记录已由门口清除（board 无 `refused:` 行）；四个门各真跑拒绝一次，首行各带自己的站名，五行既有行与 `dispatch-input` 一行逐字节同改前，artifact 的四段续行跟随首行而 refusal.json 无续行；重派仍是 `review 1·1`；**派发路径上恰好一次宿主探测**（`rg -n 'HostDetect.detect' packages/cdd-engine/src-next -g '!**/__tests__/**'` **四个读者、五行**：组合根 + `CliGate` 的 `#renderer` + `Cli#runBoard` + `Cli#runWork` 的 `Capsule`，第五行是组合根那段说明「宿主探针只答一个值」的注释——计数落在读者上，不落在它自己的注释上），`#runDispatch` 顶部的 detectHost() 调用与提前 return（其措辞已由 Task 3 搬进词表，本任务不再有第二份字面）与 `Preview` 的 `child:` 空值分支均已退役；两个构造器的调用点已全部迁居（迁移前的实况是二十处、五个测试文件——最后两处是 `session/__tests__/preflight-rows.test.ts` 的 `host` 格，它们与 `values` 格落在同一个构造调用上；计数按 Task 5 入口迁移后的实况核，不按迁移前的旧计数：`pnpm exec tsc --noEmit -p packages/cdd-engine` exit 0）；**`face/__tests__/cli.test.ts` 在本任务之后全绿**（宿主标记钉在共享夹具的 `beforeEach` 里 · 14 例的夹具与期望随优先级位移更新 · 两个构造器的调用点迁居）——它今天那 61 例的红在本任务这一格收口，别的任务不再声明一次；**`--dry-run` 拒绝里的 details 仍在 stdout**（每条 detail 一行，排在预览块之后）；**`checked:` 面也在 stdout，且与 `refused:` 行并存**（同一次 dry-run 出口调 `#renderChecked` 带 stdout 写者，断言该面的行名集合与命令面同一口径——行集合与 `refused:` 行同在一条 stdout 上，而 `CDD_BLOCKED:` 仍在两个流上零命中；`rg -n 'renderChecked\(preflight, \(text\)' packages/cdd-engine/src-next/face/cli.ts` 两命中是它的源码形状）。

#### DependsOn
2, 4, 5

### Task 7: board 的两行

#### Objective
board 念一条 `refused:` 行，读的是记录里的 `station` + 单行 `detail`；位置在**树级事实块之后**——`inFlightRows` 一次吐 `in-flight:` · `orphan:` · `crashed:` 三段落，refusalRows 排在它之后，因此无孤儿、无崩轮时 `refused:` 就是 `in-flight:` 的下一行，有则那些行夹在中间（装配位置就是断言的位置，没有排序步骤）；spec §3.1 已经这样写（`位置：树级事实块的块尾`，它的括注把「紧跟 `in-flight:` 之后」写成块里没有 `orphan:` 与 `crashed:` 时的特例），`行的下一行` 在 spec 上零命中，因此 Task 8 只按 verify-only 核那一句、不在那里重写一遍，本任务只补一条崩轮在场的夹具，把选定的顺序钉住。记录不可读时念一条自己的 corrupt 行，绝不静默视作「没有拒绝」。两行都不参与聚合、不影响计数与 `next:`。

词面只有一个家：`refused:` 的 token 与它那两空格的值间隔住 `CAPSULE_WORDS` 的同一行，预览面与 board 面都读它，各自只加自己的外层——`face/preview.ts#Preview#artifactBlock` 今天把那一词写在模板字面量里，本任务把它换成读词表（spec §3.1 的「同词，不是同形」正是这个分工）。两份字面量各住一处时，下一次改词只改一处，另一个面就停在旧词上——那正是那句 spec 句子要防的漂移。

两行的**关系**也在这里断言，因为它是 board 的渲染事实：`in-flight:` 与 `refused:` 可以并存（「因为正在跑而被拒」是腿的第 2 行），而两者各自的事实到期时两行同消——夹具直接经 Task 2 的记录写/清 API 与 in-flight 状态驱动，board 只渲染事实、不参与清除（清除的两个到期点属 Task 6）。这两条断言住在这里，因为只有本任务产出 `refused:` 行；把它们留在 Task 6 就是让一个不拥有该行的任务去断言它。

记录的三态由**组合根**读一次、作为渲染参数交下去：`Cli#runBoard` 在造 `InFlight` 的同一处造记录读面（`WorkspaceRoot` + `entry.slug` 两个值都在那里），board 自己零 workspace 构造、零第二次读——与 `holding` 同一个形状，但**必填、无默认值**：缺省一份 `absent` 会让忘了交参数的板静默不印这一行，而「行会出现」的用例仍然全绿，这正是 `PreFlightContext.inflight` 不许缺省的同一种失败面。跨工作区的方向不由 board 判：记录的读面对 `facts.slug` 不等于本 slug 的记录答 `absent`（Task 2），board 因此零 slug 比较，只渲染它拿到的那个三态值。同一个类还带一个树级的读面（`readRaw()`，不做 slug 比较），它的唯一读者是 Task 6 释放点的清除谓词——board 不读它：把「这条拒绝是我的吗」与「这棵树上站着什么」并成一个读法，两个读者必有一个读错。

#### Files
- Modify: `packages/cdd-engine/src-next/face/board-view.ts`（`refusalRows(state, words)`，与 `inFlightRows` 并列装配；`render` 的必填段新增一格三态记录值（位置在 `host` 之后、`channels` 之前：`channels` · `holding` · `next` · `projection` 四个尾参都带默认值，必填格排在它们之间或之后就是 TS1016），`#nodeBoard` 把它交给 refusalRows）
- Modify: `packages/cdd-engine/src-next/face/words.ts`（`refused:` 行的唯一词面：token 与它那两空格的值间隔同住一行、两个面各读同一格（预览只加自己的缩进，board 只加自己的轮标识），另加一句 corrupt 词与 `in-flight` 的 corrupt 词并排）
- Modify: `packages/cdd-engine/src-next/face/preview.ts`（`Preview#artifactBlock` 的行首改读词表那一格：模板字面量里的 `refused:` 与它那两空格间隔随本任务搬进 `CAPSULE_WORDS`，预览只留自己的两空格缩进——字节零变化，`artifactBlock` 的其余形状（签名、两行首的拼法、exit 1 的归属）不动；docstring 不归本任务：它的改述在 Task 6 已随入口合并落地（块的角色从「三道门之一」变成「结构腿的只读拒绝块」），本任务只把行首的词从字面量搬到词表的一格，docstring 因此与它描述的行同时在位）；**交付时补记**：Task 5 在同一提交之前已让那句话变成假（三道门退场），所以本任务同批把 docstring 的第一段从「三道门之一」改成「结构腿的唯一拒绝块」——v0.25 F5 归给 Task 6 的那句改述因此提前落地，Task 6 只余接线
- Modify: `packages/cdd-engine/src-next/face/cli.ts`（`Cli#runBoard`：在 `new InFlight(workspaceRoot, entry.slug ?? "")` 旁构一次记录读面（`new PreFlightRefusal(workspaceRoot, entry.slug ?? "").read()`）并把三态作为 `BoardView.render` 的参数交下去——这是记录在 board 面上的唯一生产者，缺它那行就永远不会被印；`Cli#runWork` 面不改）
- Test: `packages/cdd-engine/src-next/face/__tests__/board-view.test.ts`（共享夹具 `renderEntry` 与文件内其余直接 `BoardView.render` 调用同批补新格的值——位置参数因此错位一位，`tsc --noEmit` 是这条迁移的旗标；六条单元用例同在这一次迁移里）
- Test: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（一条 `runArgv(["board", …])` 的端到端：树里站着一条 `slug` 等于 board 自己 slug 的记录 ⇒ stdout 出现 `  refused:` 行；记录清掉后同一命令不再印它；该文件的 E2E 组要等 Task 6 才全绿（Task 5 的 Acceptance 披露了它今天的红），所以本条的红绿观测落在 Task 6 之后，本任务的 Step 4 不包含它—— `board-view.test.ts` 的六条单元用例在同一步里先红先绿）
- Test: `packages/cdd-engine/src-next/session/__tests__/plan-read-consistency.test.ts`（仅迁 `BoardView.render` 的构造调用，断言零改动——新格是 `holding` 的邻居，位置参数因此错位一位）
- Test: `packages/cdd-engine/src-next/session/__tests__/run.test.ts`（同上：仅迁 `BoardView.render` 的构造调用，断言零改动）

#### Consumes
- Task 2 的 RefusalState（三态）
- `BoardView.inFlightRows` 的装配位置与 `words` 面（既有）
- in-flight 的站立状态（`session/inflight.ts` 的读面，既有）与 Task 2 的记录写/清 API——并存与同消两条断言靠它们驱动，不借 Task 6 的接线
- `Cli#runBoard` 已有的两个值：`WorkspaceRoot`（`infra/workspace.ts`）与 `entry.slug`——记录读面的构造参数就在同一处，board 面因此不需要自己新建 `WorkspaceRoot`（`#ledgerOf` 那个 `WorkspaceRoot` 是 `progress.json` 与 `art:` 读缝的家，不是记录的家）

#### Produces
```ts
// 一条 token 的行：` · ` 在此是行的内容，不是 token 分隔符
static refusalRows(state: RefusalState, words: Words): readonly string[];
// 装配面：`BoardView.render(…, host, refusal, channels, holding, next, projection)` ——
// 新增的 refusal 是必填段的那一格：四个尾参（`channels` · `holding` · `next` ·
// `projection`）都带默认值，必填格只能排在它们之前（`host` 之后、`channels` 之前，
// 这就是 TS1016 那条错的位置），语义上是 `holding` 的同型邻居（三态值，**必填、无
// 默认值**：默认一份 `absent` 会让忘了交参数的板静默不印这一行），`#nodeBoard` 在
// `inFlightRows` 之后调 refusalRows——`inFlightRows`
// 一次吐 `in-flight:` · `orphan:` · `crashed:` 三段落，所以第一条 `refused:` 落在树级事实块
// 之后，孤儿与崩轮行可以夹在中间（无二者时它就是 `in-flight:` 的下一行）；那一段之后的
// 空行谓词随之多一臂（记录非 absent 时同样断行，否则 refused 行会贴上下一块）
// 形状（围栏，非既有坐标）——轮标识与 `crashed:` 的 token 同一拼写（{cycle}·a{attempt}）
//   refused: {op} {cycle}·a{attempt} {station} · {detail}
//   refused: review 1·a1 dispatch-input · review · BASE_BRANCH · empty-value
//   refused: unreadable refusal record
// 一个词、两个面（spec §3.1「同词，不是同形」）：token 与它那两空格的值间隔同住
// `CAPSULE_WORDS` 的一行，两个面只加自己的外层——
//   preview.artifactBlock:  `  ` + token + gap + 活判词首行（今天的字节逐字不变）
//   board.refusalRows:      `  ` + token + ` ` + {op} {cycle}·a{attempt} ` ` + {station} · {detail}
```

- 行的轮标识不是新写法：它是 `face/board-view.ts` 的 `#crashTokens` 已经在念的 `{cycle}·a{attempt}`（spec §3.1），因此同一张板上的 `crashed:` 与 `refused:` 说的是同一个轮身份；两个面各自的**外层**不同（`crashed:` 无前缀、`refused:` 带 `{op} {cycle}·a{attempt} `），但标识的拼写只有一种。

#### Steps
- **Step 1: 写七条失败测试**（standing 的形状与位置——首条用例钉住 `refused: review 1·a1 dispatch-input · …` 的字节，`a` 与 `crashed:` 的 token 同形，一条不带的写法当场红 · corrupt 行且 exit 0 · absent 零新行且既有行逐字节不变 · **两行并存**：`in-flight` 有活主且记录站在 `in-flight` ⇒ board 先印 `in-flight:` 再印 `refused:`，两行不必互斥 · **两行同消**：同一夹具里记录被清、持有被释放 ⇒ 两行一起消失，不出现只剩一行陈述陈旧事实 · **顺序在崩轮在场时可判**：同一棵树上一条 `crashed:` 轮 + 一条站立的拒绝 ⇒ `refused:` 排在 `crashed:` 之后（即树级事实块之后），不是 `in-flight:` 的下一行——无孤儿、无崩轮的夹具上两种读法字节相同，只有这个夹具能分开它们；spec §3.1 的位置句已读「树级事实块的块尾」（Task 8 按 verify-only 核） · **端到端**：`runArgv(["board", …])` 在站着一条同 slug 记录的树上印 `  refused:` 行、记录清掉后不再印——五条单元用例可全部绿着而 `cdd board` 一行不印，本条是那个缺口的唯一告警。跨工作区那一对方向不在这里：它住 Task 2 的读面（记录的读面对别的 slug 答 `absent`），board 面零 slug 比较，因此它在渲染面写不出来） — checkable: `board-view.test.ts` 多出六条用例，`cli.test.ts` 多出一条端到端（前六条直接构 state，第七条走真命令）
- **Step 2: 跑测试确认红** — checkable: 该文件报红，原因指向缺失的 refusalRows
- **Step 3: 实现两行与词面**（三态分派 · 词进一处 · 记录读面的唯一生产者在 `Cli#runBoard`） — checkable: board 输出里 `refused:` 行出现在树级事实块之后（无孤儿、无崩轮的夹具上它就是 `in-flight:` 的下一行）；`rg -n 'new WorkspaceRoot' packages/cdd-engine/src-next/face/board-view.ts` 恰好一处（`#ledgerOf` 里的那个构造；同一文件顶部还有一行 `import { Workspace, WorkspaceRoot }`，那是它的 import，不是第二条构造——按 `WorkspaceRoot` 核会答两行，按构造核才答一行。记录读面的 `WorkspaceRoot` 在组合根，不在渲染面）；`rg -n 'refused' packages/cdd-engine/src-next/face/preview.ts` 零命中（词从词表来，预览只留外层——今天那一处模板字面量是它唯一的字面量）
- **Step 4: 跑绿 + board 面** — checkable: `board-view.test.ts` 与 `face.test.ts` 全绿，`preview.test.ts` 亦全绿（`--dry-run` 的 `refused:` 行逐字节不变——本条只把字面量换成词表的一格）
- **Step 5: 提交** — checkable: `git show --stat HEAD` 含 `board-view.ts`、`words.ts`、`preview.ts`、`cli.ts`、`board-view.test.ts`、`cli.test.ts` 与两个 session 面测试文件（`session/__tests__/plan-read-consistency.test.ts` · `session/__tests__/run.test.ts`）

#### Acceptance
三态各自可核，且跨工作区的成对方向在它自己的家断言——记录的读面对 `facts.slug` 不等于本 slug 的记录答 `absent`、对同一个 slug 答 `standing`（Task 2 的第六条用例），board 因此零 slug 比较、只渲染交给它的那个三态值；`refused:` 行出现在树级事实块之后（无孤儿、无崩轮时它就是 `in-flight:` 的下一行；有则 `orphan:` / `crashed:` 夹在中间，装配位置就是断言的位置），且这一处由一条「一条崩轮 + 一条站立拒绝」的用例钉住（两种读法只在崩轮在场的夹具上可分开，只有 `in-flight:` 下一行的夹具是假绿）；spec §3.1 的位置句与本条已经同口径（spec 读 `位置：树级事实块的块尾`，括注交代了「紧跟 `in-flight:` 之后」的特例，`行的下一行` 零命中；Task 8 因此按 verify-only 核这两半，spec 与代码说的是同一个位置），行内轮标识的拼写与 `crashed:` 一致（`{op} {cycle}·a{attempt} {station} · {detail}`，首条用例钉住字节）；`in-flight:` 与 `refused:` 可并存，且记录清除与持有释放之后两行同消（成对，夹具经记录 API 与 in-flight 状态驱动，board 只渲染）；corrupt 不静默、不 exit 1；`absent` 时既有行逐字节不变；**记录的三态由组合根读一次、作为渲染参数交下去**（`Cli#runBoard` 是它唯一的生产者，`board-view.ts` 零**新增** `WorkspaceRoot` 构造——`new WorkspaceRoot` 仍只有 `#ledgerOf` 那一处（`progress.json` 与 `art:` 读缝的家，不是记录的家），它顶上那行 import 随它留存），且有一条 `runArgv(["board", …])` 的端到端证明 `refused:` 行真的会被印出来（五条单元用例各自绿而 `cdd board` 不印是完全可能的：生产者缺失就是那个失败面）；`render` 的新格必填、无默认值、且排在必填段（位置在 `host` 之后、`channels` 之前——四个尾参都带默认值，必填格排在它们之间即 TS1016），两个 session 面调用点（`session/__tests__/plan-read-consistency.test.ts` · `session/__tests__/run.test.ts`）只迁构造调用、断言零改动，而 `board-view.test.ts` 的共享夹具 `renderEntry` 与它文件内其余直接 `BoardView.render` 调用同批补上同一格（那是本任务拥有的文件，不补则 `tsc --noEmit` 在那里转红，而 Step 4 的门是「`board-view.test.ts` 全绿」；`tsc --noEmit` exit 0 是整条迁移的旗标）；`refused:` 只有一个家——`CAPSULE_WORDS` 那一行同时供预览面与 board 面读（`face/preview.ts` 里该词零命中，外层各留各面：预览两空格、board 带轮标识，预览的字节与改前逐字相同）。

#### DependsOn
2

### Task 8: changeset · 章程回填 · 全量门禁

#### Objective
把这一轮的消费面变化登记齐：changeset 一条 `minor`、章程的 P40 design-spec 一格与版本、spec 与 plan 的版本与 change history、P38 spec 上的一条换向记录，然后跑全量门禁。版本与历史行是登记。**改前的 grep 先划出还活着的编辑面**，而不是按旧稿的清单重写一遍：`rg -n '每一面都被调用|每次派发'` 在 spec 上只余版本历史行与已带例外的句子（那五句 `checked:` 例外已读「有输入面的派发」并带让位例外），§3.1 的位置句已读「树级事实块的块尾」、章程的 D96 与 Phase inventory AC ⑥ 也已读同一口径（章程 v4.22 的回填）——因此**活着的只有三处**：章程 in-register 段那一行 · 章程 Phase inventory P40 行的**验收 ③ 格**（它只念三个方向，而 spec 的同一条判据念六个、同一行的 summary 格与 D96 都已读「两个到期触发点」——见 Files 行），与 spec §3.1 的**读取归属句**（它仍写「读取点就在渲染 `in-flight:` 行的同一处」）。这三处是纠正，其余几处按 verify-only 处理：重写一句已经正确的句子既证不出差异，也会把一个过了十二轮的措辞再动一次。带日期的 change-history 行是记录，不改写、也不进这批纠正。

#### Files
- Create: `.changeset/p40-preflight-refusal.md`
- Modify: `docs/kairos/overalls/2026-10-10-engine-doc-tooling-overall.md`（P40 的 **design-spec 一格** `✔ Done` 与 version + change history；外加一处 `checked:` 叙述的空批次例外，逐处点名：**in-register 那一段的行为语义增量账是唯一还活着的一处**（那一行的「每次派发 `checked:` 面的新增四行」带上「每一次判了输入面的派发」的例外）；D96 决策行的「在册增量收口」句与 Phase inventory P40 行的 AC ⑥ 已读「有输入面的派发」并带让位例外（章程 v4.22 的回填），按 verify-only 处理——重写它们既改不出差异，又会把已定的措辞再动一次；**Phase inventory P40 行的验收 ③ 格同批扩写**（它与上面那个 AC ⑥ 不是同一格：⑥ 记 `checked:` 面的在册增量、已带例外，③ 记拒绝事实的生命周期）——③ 今天只念三个方向（通过即清 · 反向 · 并存），而 spec 的同一条判据念六个（另三条：释放即到期 · 门口清除先于 line 腿 · 释放不清别的站），且同一行的 summary 格与 D96 都已读「两个到期触发点」——扩写成与 spec 同一不变量（一条拒绝事实 · 两个到期触发点，加那三条方向），使验收 ③ 与 D96 指名同一个不变量；不改它，相位收口按 ③ 只验三个方向就能判 Done，而一条 `refused: … in-flight · …` 可以活过写下它的持有者——那正是第二个到期触发点要禁的形状；`## Change history` 的 v4.18 / v4.19 / v4.22 各行是带日期的记录，原样保留、例外句不进历史行；**Phase inventory 的 plan 格留 `[Pending]`**——本相位最后一项交付物是 Task 9（lefthook 迁移），那一格由它收口时写入，本任务把它写 Done 会让计划格在计划自己的末项还不存在时读作已交付）
- Modify: `docs/kairos/specs/2026-11-17-engine-doc-tooling-p40-design.md`（version + change history；**改前 grep 的实况先摆出来**——那五句 `checked:` 例外（§1.1 两处 · §3.3 · Acceptance · Constraints ④）已读「有输入面的派发」并带让位例外，§3.1 的位置句已读「树级事实块的块尾」且已指名 `BoardView#refusalRows`，因此它们按 verify-only 处理、不重写；本任务在 spec 上**只余一处实质编辑**：§3.1 的**读取归属句**——它今天仍写「读取点就在渲染 `in-flight:` 行的同一处（`face/board-view.ts`）」，而 Task 7 在组合根造 `InFlight` 的同一处读一次、把三态值交给 board，`board-view.ts` 只渲染、零新增 `new WorkspaceRoot`（Task 7 的 Files 与 Acceptance），因此改写为「读取点在组合根造 `InFlight` 的同一处，board 只渲染交下来的三态值，不新开第二次扫描」（不改这一句，一次按 spec 面的一致性读会去 `face/board-view.ts` 找那个读取点，找不到就把它搬回渲染面，正是 Task 7 禁止的那件事）；本文件自己的 `## Change history` 行是带日期的记录，原样保留）
- Modify: `docs/kairos/plans/2026-11-17-engine-doc-tooling-p40.md`（version + change history）
- Modify: `docs/kairos/specs/2026-11-17-engine-doc-tooling-p38-design.md`（spec §1.1 的具名要求：只在 change history 追加一条指向本相位的换向记录——P38 的历史行原样保留，不重写）

#### Consumes
- Task 1–7 的交付事实

#### Produces
- `.changeset/p40-preflight-refusal.md`：`cdd-engine: minor`，正文**逐条**点出 spec Constraints 的六处具名变更，不概括、不合并：① `no-host` · `carrier` · `artifact` 三行的首行多一段站名（detail 文本不变）· ② `--dry-run` 上的结构腿拒绝改由 stdout 的预览块陈述 · ③ 无 harness 树里的 `--dry-run` 从「五行预报 + exit 0」变为「预览块 + exit 1」· ④ 每一次**判了输入面**的派发的 `checked:` 面各多四行（排头词不是「每次派发」：wave 面上预测批次为空时四行整批退场、`checked:` 也不记它们，裁决交给 line 腿的 `split`——否则一条已收口的计划会报 `dispatch-input · WAVE · empty-value`，盖掉 replan 那条真答案；既有钉读字节随动，`carrier` 与 `artifact` 在非 fix 面上空格短路仍记一行）· ⑤ board 的两行（`refused:` 与不可读记录的 corrupt 行，含新产物 refusal.json）· ⑥ 两腿同时不合格时报文从 line 腿改归结构腿。六行里 ②③ 是同一个入口的两个面，写在同一行的两半；④ 是独立一行，因为它的字节移动是每个消费者都看得见的。
- 章程同步到交付后的状态：P40 的 **design-spec 一格** `✔ Done` + version + 一条带日期的历史行；in-register 段那一处补上「每一次判了输入面的派发」的例外（口径与 changeset ④ 一致），D96 行与 Phase inventory AC ⑥ 两处原样留存（已带同一句例外，verify-only）；外加 Phase inventory P40 行**验收 ③ 格的扩写**（三个方向 → 六个，与 spec 2.3 同一不变量；那一格与 AC ⑥ 是两格）；**Phase inventory 的 plan 格不在这里写**——它留给 Task 9 收口（见 Task 9 的 Files 与 Steps）。
- P38 spec 的 `INPUT_WAVE_BRIEF` per-mode 豁免已被本相位退役，那条换向记录是它自己的指向：历史行不改，版本 +1 与历史行同批。

#### Steps
- **Step 1: 写 changeset**（`cdd-engine: minor`，正文六行对应 spec Constraints ①–⑥，`checked:` 面那一条单独一行） — checkable: `.changeset/p40-preflight-refusal.md` 存在且六条具名变更齐（`rg -n 'checked:'` 在该文件上有命中，refusal.json 与 `refused:` 也在其上）
- **Step 2: 回填章程与文档版本**（先跑改前 grep 把编辑面钉住：`rg -n '每一面都被调用|每次派发'` 在 spec 与章程上、`rg -n '行的下一行|树级事实块'` 在 spec 上各答一次，逐行确认哪几处还活着——活着的现在有三处：章程 in-register 段那一行 · 章程 Phase inventory P40 行的验收 ③ 格 · spec §3.1 的读取归属句；接着**只改这几件**：P40 的 design-spec 一格 `✔ Done` · 章程与 spec/plan 各 +1 与历史行 · P38 spec 追加一条换向行并同批 +1 · 章程 in-register 段的例外句 · 章程 Phase inventory P40 行验收 ③ 格的扩写（三个方向 → 六个） · spec §3.1 的读取归属句改成「读取点在组合根造 `InFlight` 的同一处，board 只渲染交下来的三态值」；D96 行 · Phase inventory AC ⑥ · spec 那五句 · §3.1 的位置句一律 verify-only；Phase inventory 的 plan 格留 `[Pending]`，由 Task 9 写） — checkable: 四份文档的 front-matter 版本与最新历史行一致；空批次的例外的可核形状（三份文件同一条 `rg`，再过滤出两族之外的命中，求法写全）：`rg -n '每一面都被调用|每次派发' docs/kairos/specs/2026-11-17-engine-doc-tooling-p40-design.md docs/kairos/overalls/2026-10-10-engine-doc-tooling-overall.md .changeset/p40-preflight-refusal.md | rg -v '有输入面|判了输入面|hasInputFace|[|] v[0-9]+[.]'` 答零行——改前它只答章程 in-register 那一行（五句 spec 句子已带限定，版本行与带日期的历史行是记录，`[|] v[0-9]+[.]` 这一族因此在章程的 `v4.x` 行上也成立），改后同一过滤仍答零行（那一行换成了「每一次判了输入面的派发」）；spec §3.1 的位置句**按它自己那一句核**，不按全文件任意 `树级事实块` 命中：`rg -n '位置：树级事实块的块尾' docs/kairos/specs/2026-11-17-engine-doc-tooling-p40-design.md` 恰好一处（正向，改前已成立、本任务 verify-only），`rg -n '行的下一行' docs/kairos/specs/2026-11-17-engine-doc-tooling-p40-design.md` 零命中（反向）——原先的正向 pattern `树级事实块之后` 在 spec 的验收行上本就命中，证不出 §3.1 那一句被改过还是没被改过，因此正向必须锚到 §3.1 自己的句首；读取归属句正负两半都成立：`rg -n '读取点就在渲染' docs/kairos/specs/2026-11-17-engine-doc-tooling-p40-design.md` 零命中（负半：旧归属句不在），`rg -n '只渲染交下来的三态值' docs/kairos/specs/2026-11-17-engine-doc-tooling-p40-design.md` 有命中（正半：新归属句在位）；章程 Phase inventory 的 P40 行在本次提交后 plan 格仍是 `[Pending]`、design-spec 格为 `✔ Done`（`rg -n '^\| P40 ' docs/kairos/overalls/2026-10-10-engine-doc-tooling-overall.md` 该行两格各读一次）
- **Step 3: 全量门禁** — checkable: `pnpm run validate` exit 0
- **Step 4: 提交** — checkable: `git show --stat HEAD` 含 changeset 与四份文档

#### Acceptance
`pnpm run validate` exit 0；`pnpm run emit:check` 无漂移；changeset 级别为 `minor` 且正文六条对应 spec Constraints ①–⑥（无漏项：`checked:` 的四行 · board 两行与新产物 · 三行站名前缀 · `--dry-run` 的入口与 exit 码 · 两腿归属）；**④ 的排头词是「每一次判了输入面的派发」**——改前 grep 已把编辑面收到三处，本任务的实质编辑就是那三处：同一条例外在 spec 那五句（§1.1 两处 · §3.3 · Acceptance · Constraints ④）与章程的 D96 行 · Phase inventory AC ⑥ 上已经就位（章程 v4.22 的回填），按 verify-only 处理、不重写，章程 `## Change history` 的带日期行原样保留、不计入这一口径；spec §3.1 的位置句同样 verify-only，判据锚到那一句自己（`位置：树级事实块的块尾` 恰好一处、`行的下一行` 零命中——`树级事实块之后` 这个串在 spec 的验收行上本就命中，证不出 §3.1 那一句的状态，当不了正向）；spec §3.1 的读取归属句同样同批改齐（「读取点在组合根造 `InFlight` 的同一处，board 只渲染交下来的三态值」，正负两半同上：`读取点就在渲染` 零命中、`只渲染交下来的三态值` 有命中——spec 与 Task 7 的 Files / Acceptance 因此指名同一个家，`board-view.ts` 不再被一句话召回第二个 `WorkspaceRoot`）；**章程 Phase inventory P40 行的验收 ③ 格同批扩写**（六条方向齐：两个到期触发点各一条——通过即清与释放即到期 · `in-flight:` 与 `refused:` 并存 · 释放不清别的站 · 门口清除先于 line 腿 · 反向；口径与 spec 2.3 的三条不变量同一条）——只念三个方向的那一格会让一次相位收口在释放点从未被测的情况下判 Done，而 `refused: … in-flight · …` 能活过写下它的持有者；章程与三份文档（P40 spec · P40 plan · P38 spec）的版本、历史行与交付事实一致，P38 的历史行未被改写；**章程 Phase inventory 的 P40 行只写 design-spec 一格**（`✔ Done`），plan 格留 `[Pending]`——它由 Task 9 收口时写入，本任务写它会让计划格在本计划自己的末项还不存在时宣告交付（那一格与自己最后一项交付物同批落定，见 Task 9 的 Files 与 Step 7）。

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
- Modify: `docs/kairos/overalls/2026-10-10-engine-doc-tooling-overall.md`（**只一处：P40 的 plan 格收口**——Phase inventory P40 行的 plan 状态格由 `[Pending]` 改为 `✔ Done`（带交付日期），章程 version +1 与一条带日期的 change-history 行同批；本相位最后一项交付物是本任务，因此这一格由本任务写，Task 8 已明写把它留在这里。design-spec 一格与 in-register 例外句已由 Task 8 写入，本任务不碰）
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
- **Step 5: 三条等价性实测、四条观测（在临时树里跑）**（坏 `.ts` 被拦且文件未被写回 · **同一次提交的日志里没有 `pnpm run precommit` 的运行记录**——顺序腿：格式违规必须停在 `biome check`，`parallel: true` 或把 `precommit` 提前都会让这一条转红，而前一条仍然绿 · 删一个 `.ts` 后提交不红 · 干净提交的日志里出现 `pnpm run precommit` 那一次）——四次观测落在三次真提交上（前两条观测的是同一次提交），三条都要真实提交才证明得了，而交付分支只应留 Step 8 的一次原子提交，`git worktree` 又被本仓规则禁止：因此把当前工作树连 `.git` 整棵复制到临时目录（`cp -R`——Step 1–4 的改动还没提交，`git clone` 只带已提交内容），在那里跑 `lefthook install` 并摆夹具，三次提交落在临时树里。 — checkable: 三次真实提交的 exit code 分别为 1 / 0 / 0（日志取自临时树），第一次提交的日志里 `pnpm run precommit` 零命中（顺序由日志证，不靠 `parallel` 的意图），且第一次之后该临时树的 `git status` 显示该文件仍被修改；交付树上 `git log --oneline` 因此只有 Step 8 那一次提交
- **Step 6: 全量门禁** — checkable: `pnpm run validate` exit 0
- **Step 7: 章程收口**（Phase inventory P40 行的 plan 格 `[Pending]` → `✔ Done` + 交付日期 · 章程 version +1 与一条带日期的 change-history 行） — checkable: `rg -n '^\| P40 ' docs/kairos/overalls/2026-10-10-engine-doc-tooling-overall.md` 该行的 design-spec 格与 plan 格都读 `✔ Done`，章程 front-matter 的 `version:` 与它的最新历史行一致；本步骤的改动与 Step 1–6 同一次提交（交付与它收口的这一格必须同时落地，拆成两次提交就变成「plan 格在交付之前或之后单独变绿」，而这一格的判据是「本相位最后一项交付物与它同批」）
- **Step 8: 提交** — checkable: `git show --stat HEAD` 含 lefthook.yml · package.json · pnpm-lock.yaml · 章程与两处删除（Step 5 的三次提交不在本树，不在这条 —stat 里）

#### Acceptance
坏格式的 `.ts` 被拦且**未被写回**（`biome check` 不带 `--write`）；删一个 `.ts` 后提交不红；干净提交通过且日志含 `pnpm run precommit` 的运行；**顺序也是被测的条件**：坏格式那次提交的日志里 `pnpm run precommit` 零命中（违规停在格式门，不往后跑全量门禁——四条观测、三次提交，均在临时树里跑，交付分支只留一次原子提交）；`.husky/` 与 `lint-staged.config.ts` 不在树上、`husky` / `lint-staged` 在 `package.json` 与 `pnpm-lock.yaml` 的依赖面零命中；`prepare` 安装 lefthook；`AGENTS.md` 零改动（它不指名机制，规则迁移后仍成立——由 grep `husky\|lint-staged` 在 AGENTS.md 零命中断言）；**章程的 P40 两格在本任务收口后都读 `✔ Done`**（design-spec 格由 Task 8 写、plan 格由本任务的 Step 7 写，与本次提交同批；提交的 `--stat` 因此含章程那一份，Task 8 的 Acceptance 里「plan 格留 `[Pending]`」在这里闭合）；`pnpm run validate` exit 0；无 changeset（本任务不改任何 first-party package 的行为）。

#### DependsOn
1, 2, 3, 4, 5, 6, 7, 8

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.31 | 2026-11-18 | 第二十轮 fix 轮（F1–F4 全采纳）：① **Task 6 的 `preview.ts` docstring 降为 verify-only**——那句话在波浪 5,7 的交付里已经改述（今天读作「the STRUCTURE leg's ONE refusal renderer … One renderer, two faces」），`one of the three` 早已零命中，原行的「本任务改述」与它自己的零命中判据因此分不出「改过」与「没动过」；Files 行改成 verify-only 并写明本行真正落到树上的编辑只剩宿主值那一处（F1）；② **写与清写成两个锚点**——清除在 `vet` 返回之后、`--recover` 的接管判定之前（spec 2.2 的那个合取此前在计划上零命中），写入在 `verdict.leg === "structure"` 那一支里、`#renderPreflightBlocked` 之前；原稿的「`ensure()` 与 `#renderChecked` 之间」在代码上是反的（`#renderChecked` 在前、`ensure()` 在后），照它落位会让一次九行全过、`#recoverRun` 答无可接管的 `--recover` 派发带着一条 `tree-clean` 记录收场——Objective · Files · Step 1（新增第十九条用例）· Step 3 · Acceptance 同批（F2）；③ **章程验收 ③ 格进 Task 8 的编辑面**——它只念三个方向，而 spec 2.3 念六个、同行的 summary 格与 D96 都已读「两个到期触发点」；Objective · Files · Produces · Step 2 · Acceptance 同批把编辑面收到三处并写明扩写方向（F3）；④ **迁移清单的逐文件分布删掉、只留总数**——`dispatch-input.test.ts` 5 与 `preview.test.ts` 3 是更早的读数（今天 2 与 6），Objective 的「十七条断言」也滞后于 Step 1 的十八条；两处改为按 `rg` 定位、断言数以十九条为准（F4）。Task id 集与 `DependsOn` 集未动 | Oscaner M. · Claude |
| v0.30 | 2026-11-18 | 波浪 5,7 的第一轮 review-fix 轮（F1–F6 全采纳）：① **Task 7 不再把一句已经正确的 spec 句子归给 Task 8**——§3.1 今天已读 `位置：树级事实块的块尾` 且以括注交代「紧跟 `in-flight:` 之后」的特例，`行的下一行` 在 spec 上零命中，Objective · Step 1 · Acceptance 三处改成「已对齐 / Task 8 只做 verify-only」，Task 7 只留崩轮在场的夹具（F1）；② **Task 5 的 `cli.test.ts` 披露补上第三类红**——本波退役 `--dry-run` 的三门镜像后，P38 T3 的四条预览钉（断 `refused:` 行的两条 · 断「预览根本没渲染」的两条）转红，披露因此按三类写、按收口时实测的 `61 failed / 233 passed` 计数，并把四条标题点名，指明它们要等 Task 6 把 `Preview#artifactBlock` 接进出口、把宿主标记钉回夹具（F2）；③ **判据模块的头注释删掉已退役的 `naming` 输入**（`contract/preflight-rows.ts`）（F3）；④ **Task 5 的 Step 5 判据按路径收窄**——本波落成的是含两个任务体的一个原子提交，stat 改按本任务自己的十行核，`preview.ts` 的零编辑改按 hunk 核（它的改动只有 Task 7 的交界）（F4）；⑤ **「组合根的 composer 恰好一次」有了证人**——(n) 的第三半落进 `preview.test.ts` 的 `--dry-run` 循环用例（`vi.spyOn(DispatchValues, "compose")` 一次），三半各有归属写进 Files 与 Acceptance（F5）；⑥ **两处死标识删除**（`lifecycle.test.ts` 里的 _FIX_DRAFT 常量 · `board-view.test.ts` 夹具上那个从未读过的覆盖参数）（F6）。Task id 集与 `DependsOn` 集未动 | Oscaner M. · Claude |
| v0.29 | 2026-11-18 | 第十九轮 fix 轮（F1–F3 全采纳）：① **释放谓词的 corrupt 支有主**——Task 6 收下「持有期间写下的一条截断记录在同一次释放之后仍在盘上」这一对（Objective 的谓词两支 · Produces 写清 `corrupt` ⇒ 不清 · Step 1 第十八条用例 · Acceptance 的成对断言），board 那一半指向 Task 7 的 corrupt 行用例；缺它，把谓词写成「不是 `absent` 就清」的一版与十七条断言全绿而记录被误删（F1）；② **Task 8 的编辑面按改前 grep 重划**——五句 `checked:` 例外 · §3.1 的位置句 · 章程 D96 与 Phase inventory AC ⑥ 已就位（章程 v4.22），降为 verify-only 并把 grep 证据写进 Files / Step 2 / Acceptance，实质编辑只剩章程 in-register 段那一行与 spec §3.1 的读取归属句；§3.1 的正向判据锚到那一句自己（`位置：树级事实块的块尾`），不再用全文件命中的 `树级事实块之后`（它在验收行上本就命中）（F2）；③ **plan 格的 Done 移位**——章程 Phase inventory 的 plan 格改由 Task 9 收口写入（Task 9 的 Files 增一行、Steps 新增 Step 7 与其可核断言、提交顺延为 Step 8），Task 8 只写 design-spec 一格并明写 plan 格留 `[Pending]`；原稿让计划格在本计划末项还不存在时读作已交付（F3）。Task id 集与 `DependsOn` 集未动 | Oscaner M. · Claude |
| v0.28 | 2026-11-18 | 波浪 5,7 的实现轮如实回填（不新增判定，只把「计划说的」改成「树上落成的」）：① **Task 5 的面级门用例随门退场**——`lifecycle.test.ts` 的 P31 T3 / P36 T6 两块与四条单例、`dispatch-input.test.ts` 的两条 async「被拒一轮」用例，题目就是那些被删的门，Expectations 无处可落，Files 与 Acceptance 同批点名；同文件补两条换代用例（派发面上判据零次调用、退役符号零命中）；② **第五条告警用例换家**——`--dry-run` 经循环的那条落 `preview.test.ts`（`cli.test.ts` 的 E2E 组仍红，写进够不到的绿里等于没写）；③ **artifact 快照装配提取成 `ArtifactSnapshots`**（`face/dispatch-values.ts`，即 composer 的第三格）——夹具与组合根因此读同一份装配，Task 5 的 Files 增这一格与夹具支撑文件；④ **pin 语料的重锚进 Step 4 门**——退役符号让 158 条 docs pin 变死 pin，八份文档（P34 · P36 · P37 · P38 · P40 家族）同批把行内反引号改成裸词；⑤ **Task 7 的 `preview.ts` docstring 提前改述**（Task 5 已让旧叙述失真）。Task id 集与 `DependsOn` 集未动 | Oscaner M. · Claude |
| v0.27 | 2026-11-18 | 第十八轮 fix 轮（F1–F5 全采纳）：① **`checked:` 面在 dry-run 出口点名**——Task 6 的 Produces 增一条：收束后的出口在预览块、`refused:` 行与 details 之后调 `#renderChecked(preflight, (text) => this.#io.stdout(text))`（与 `in-flight` 保留臂同形），Objective · Step 1 的 dry-run 用例 · Step 3 与 Acceptance 各补一条该面行名集合的断言——缺它，脏树上的 `cdd review --dry-run` 不印 `checked:` 面，spec §2.4 的 checked 面保留为假而十七条断言仍全绿（F1）；② **§3.1 的读取归属进 Task 8 的 spec 编辑面**——改写为「读取点在组合根造 `InFlight` 的同一处，board 只渲染交下来的三态值，不新开第二次扫描」，Objective · Files · Step 2 · Acceptance 同批，正负两半的 grep 判据随位置句（F2）；③ **Task 7 的 `WorkspaceRoot` 判据收窄到构造**——`rg -n 'new WorkspaceRoot'` 恰好一处（顶上那行 import 不是第二处构造，原 pattern 在树上答两行），Acceptance 的零构造改成零新增构造（F3）；④ **Task 5 的 `preview.ts` 退成约束**——它今天不持门判定、`render()` 已是五行预报、`artifactBlock` 只渲染交下来的 reason，镜像在 `Cli#runWork`；Objective · Files · Produces · Step 3 · Step 5 的 `--stat` 同批，`preview.test.ts` 留下做那条字节断言（F4）；⑤ **Task 7 的迁移清单收下 `board-view.test.ts`**——共享夹具 `renderEntry` 与文件内其余直接 `BoardView.render` 调用同批补新格，Files 与 Acceptance 同批（F5）。Task id 集与 `DependsOn` 集未动 | Oscaner M. · Claude |
| v0.26 | 2026-11-18 | 波浪 2,4 的第二轮 fix 轮（F1 · F2 全采纳）：① **review 面的 cycle 也按折叠后的切片求**——abort fold 排在裁决之后，composer 在折叠前装配，此前只把待折叠那一轮算进 attempt、cycle 仍读折叠前账本的 `roundCount`，于是一条被杀在 `1·a1` 的 review 会装配成 `1·a2` 而帧派发 `2·a1`；两个号现在同在一个切片上求（`AbortFold#withPending` + `RoundRecords.cyclesOf`，`roundCount` 与 composer 同读后者的寄存器），两号的唯一家是 `ConsumedRound.of`（`session/ledger.ts`），Task 4 的 Acceptance 增 review 面的成对断言（F1）；② **`--recover` 的谓词收成一处**——`Cli#runWork` 一个 `const recover`，`stale` 的读 · 缝合的 `recover` 输入 · 恢复腿的守卫 · 派发缝自己的折叠 · harness 的接管许可全部取它，四处重拼的合取与第五处只读旗标的拼写一并退场（F2）；③ **pin 迁到新家**——composer 的旧分配方法随分配搬走后不再存在，Task 6 的判据从「`attemptOf` 在 `face/cli.ts` 恰好一处」改成该文件零命中、唯一推导点在 `ConsumedRound.of` 的方法体内。Task id 集与 `DependsOn` 集未动 | Oscaner M. · Claude |
| v0.25 | 2026-11-18 | 第十七轮 fix 轮（F1–F5 全采纳）：① **第五个迁移文件归位**——Task 6 的迁移清单从四个测试文件改成五个，增收 `session/__tests__/preflight-rows.test.ts`（`host` 两格；`values` 两格已由 Task 5 交），Objective 的「第五个测试文件是另一件事」顺延成第六个，Step 4 与 Acceptance 的计数由 18 / 十八处改成 20 / 二十处——漏掉它，本任务自己的 tsc 门（TS2741）与 `vitest run src-next/session/`（`HOSTS[undefined]`）会在一个不拥有的文件上转红，而最省事的错法是把 `host` 改回可选、把要退役的第二条探测路径留成 fallback（F1）；② **两个面测试的夹具规则点名**——`lifecycle.test.ts` 与 `dispatch-input.test.ts` 的 `values` 由夹具自己的帧事实经 `DispatchValues.compose` 组出（与 `session/__tests__/preflight-rows.test.ts` 同一条规则），并写明它们的提示词字节断言逐字不变：`values: {}` 会渲染出空提示词，`lifecycle.test.ts` 的 `dispatchFrame` / `runFixFrame` 与 `dispatch-input.test.ts` 的入口迁移用例当场反转（F2）；③ **case (f') 随豁免退场**——`contract/__tests__/preflight-rows.test.ts` 的三处 `naming` 格分成两类：`inputOf` 的默认格与 case (f) 那一格是纯删格，case (f') 整条用例退场（它的题目就是「没有命名答案时空格是空值」，`naming` 一去 `#reasonOfCell` 的 `answered` 只剩 `written === "engine"`，那条期望不再发生）；Task 5 的 Files · Step 4 · Acceptance 三处同批写实（F3）；④ **版本行族放宽到 `v<数字>.`**——Task 8 Step 2 的过滤从 spec 的 `v0.` 放宽，章程 v4.18 / v4.19 两行都含「每次派发」且是带日期的记录，原过滤让「两族之外零命中」在正确编辑过的语料上取不到（F4）；⑤ **`artifactBlock` 的 docstring 有人拥有**——Task 6 的 `preview.ts` 行收下它的改述（块的角色从「三道门之一」变成「结构腿的只读拒绝块」），Task 7 不再冻结 docstring、只搬行首的词（F5）。Task id 集与 `DependsOn` 集未动 | Oscaner M. · Claude |
| v0.24 | 2026-11-18 | 第十六轮 fix 轮（F1–F6 全采纳）：① **`naming` 那一格的生产调用点归位**——Task 5 的 Files 增收 `session/preflight.ts`（删 `PreFlightRows.judge` 调用里的 `naming: { answered: false }` 与那段注释），Step 4 与 Acceptance 补 `pnpm exec tsc --noEmit -p packages/cdd-engine`：本任务的门跑 vitest 走 esbuild、剥掉类型，多出来的对象字面量属性在那里是绿的，残余会漏到 Task 6 的 tsc 门里一个本任务不拥有的文件（F1）；② **「写者不重推 identity」按残余钉**——`attemptOf` 在 `face/cli.ts` 是恰好一处、落在 Task 4 的 composer 分配方法体内（该定位在本波的 fix 轮随分配搬进 `session/ledger.ts` 的 `ConsumedRound.of`，见 v0.26），Task 6 的零命中改成「恰好一处且在该方法体内」，并删掉同一步里「`attempt` 在它上面求」那句让写者自己重推的话，写者只读 `before.identity` 的三格（F2）；③ **空批次例外逐处点名**——Task 8 的 spec 编辑面从两句扩到五句（§1.1 主句 · §1.1 回填段 · §3.3 · Acceptance · Constraints ④）、章程编辑面点名三处（in-register 段 · D96 行 · Phase inventory AC ⑥），带日期的 change-history 行写明原样保留，Step 2 的 grep 判据改成「两族之外零命中」（F3）；④ **§3.1 位置句的判据可匹配**——原 pattern 里 `in-flight:` 与「行的下一行」之间隔着反引号，改前改后都答零命中；改成 `行的下一行` 零命中加 `树级事实块之后` 有命中的正负两半（F4）；⑤ **`#values` 是字段不是 `opts.values`**——Task 5 的判据改成「`opts.values` 恰好一处（构造器赋值）+ `this.#values` 两命中」，原句把 `valuesOf` 说成读 `opts.values`，而构造器把每个选项存进字段（F5）；⑥ **`preview.test.ts` 的第三处夹具编辑点名**——Task 6 的 Files 写明钉 `child:` 行 no-host 字面量的那条用例随分支退役，不再只由 Objective 反推（F6）。Task id 集与 `DependsOn` 集未动 | Oscaner M. · Claude |
| v0.23 | 2026-11-18 | 第十五轮 fix 轮（F1–F7 全采纳）：① **红门不得由够不到它的任务声明**——Task 5 的 Step 4 门收窄到它拥有的四个面测试文件加 `src-next/contract/`；`face/__tests__/cli.test.ts` 的 E2E 组（在 `aa67541c` 上实测 61 例红：共享夹具在 `beforeEach` 清掉宿主标记，`#runDispatch` 的 no-host 早退把每次工作派发都拒了；钉回标记后 47 例转绿、仍 14 例红，那 14 例是优先级位移后的旧断言）连同两件夹具活（宿主标记 + 14 例的夹具/期望）一起归 Task 6，Task 6 的 Step 4 才声明全绿（F1）；② **空批次的例外登记到它被计数的地方**——changeset ④ 的排头词改成「每一次判了输入面的派发」，spec §1.1 / Constraints ④ 与章程的 in-register 段同批各带一句例外，Task 8 的 Files / Step 2 / Acceptance 各补一条可核断言（F2）；③ **拒绝记录的号取自组合根已装配好的 identity**（`before.identity`）——写者不调 `attemptOf` 重推（`--recover` 的 abort fold 排在裁决之后，重推会少一），Task 6 的 Consumes / Produces / Step 3 / Acceptance 同批改写，Step 1 加一条「被拒的 `--recover` 写折叠之后的号」用例（十六条改十七条）（F3）；④ **值的运输方式点名**——`CliLifecycle` 构造器新增 `values` 一格（必填、无默认值），`#valuesOf` 只在它上面读，两个生产构造点各交 `before.values` 的同一对象；`session/__tests__/preflight-rows.test.ts` 的两处成对断言改写成「同一个注入对象」（`toBe`），该文件进 Task 5 的 Files 与 Step 4 门（F4）；⑤ **`--dry-run` 拒绝里的 details 点名印点**——`Cli#runWork` 在预览块之后逐条印 `preflight.details`，`Preview` 不接管它，Step 1 的 dry-run 用例补一条 details 非空面的断言（F5）；⑥ **`refused:` 行位置与 spec §3.1 同批对齐**——Task 8 把 §3.1 那一句改成「树级事实块之后」，Task 7 补一条「一条崩轮 + 一条拒绝」的夹具把选定顺序钉住（六条改七条）（F6）；⑦ **宿主探针的计数落在读者上**——四个读者、五行，第五行是组合根自己那句注释，Task 6 的 Step 3 与 Acceptance 同批改写（F7）。Task id 集与 `DependsOn` 集未动 | Oscaner M. · Claude |
| v0.22 | 2026-11-18 | 波浪 2,4 的 fix 轮（F1 · F2 · F3 · F5 · F6 全采纳，F4 与两条 pin 门 warn 不采纳）：① **没有输入面的派发不判四行**——wave 面上预测批次为空（`WAVE` 是 `frontier(doneTasks())` 的引擎推演，编排者无从供给）时四行整批退场，`order` / `checked` 也不记它们，裁决交给 line 腿的 `split`；缺了它，一条已收口的计划派发时报 `CDD_BLOCKED: dispatch-input · WAVE · empty-value`，盖掉 replan 那条真答案。Task 4 的「四新行每一面都在都记」与 Acceptance 同批限定，Step 1 加一条成对用例（八条改九条）（F1）；② **成对断言的第一半是记录本身**——`CliLifecycle#valuesOf(frame)` 成为唯一的测试可见读面（Task 5 随 `#valuesOf` 退役），两份 `Readonly<Record<string, string>>` 逐格 `toEqual`，提示词字节当第二半：该 role 的声明会丢掉的格（fix 面的 `INPUT_REVIEWS`、review 面的 `WAVE`）在字节里看不见（F2）；③ **记录的闭集词在读面就判**——`station` / `op` / `type` 对各自的运行时表校验（`DISPATCH_REASON` 的 structure token 集 · `RoundRecords.opOf` · `targetFaces`），八格原语类型都对而词在集外的记录答 `corrupt` 并指出受伤的格；Task 2 Step 1 与 Acceptance 随之（七条改八条）（F3）；④ **折叠与身份分配共读一个 `AbortFold`**（`session/ledger.ts`）——`--recover` 的 abort fold 按 P30 §2.1④ 排在裁决之后，故 composer 的 attempt 在「本 key 的记录 + 折叠即将记账的一轮」上求（`AbortFold#withPending`），`CliLifecycle#bookAbort` 读同一个 `bookedOf`；Task 4 Files 收 ledger.ts 与两个测试文件，Acceptance 加一条成对断言（F5）；⑤ 九值站名的用例夹具改用中性 `detail`（不以站名开头，§2.1 的形状）（F6）；⑥ **不采纳两条**：F4（`cli.test.ts` 的固定夹具迁移按计划归 Task 6，本轮的红是已披露的）与 F7 / F8（`.kairos/*-brief.md` 是编排者产物，`PinIndex` 有意跳过 `.kairos`——一个本地文件不得让坐标在别处解析；§7.1 的词表筛在 `contract.path` 语料上缺一道，属 P37 门的后续，不在本波浪的契约面） | Oscaner M. · Claude |
| v0.21 | 2026-11-18 | 第十四轮 fix 轮（F1–F4 全采纳）：① **加行的第二处进 Task 4**——`Cli#renderPreflightBlocked` 的 gate 名条件（今天三值 `tree-clean` · `in-flight` · `doc-contract`）与 `PreFlightGateName` 的九值同批加四新站名，Task 4 的 Files（`face/cli.ts`）· Step 3 可核断言（`preflight.gate ===` 八命中、七处在条件内）· Acceptance 三处同批；漏掉它 `dispatch-input` 会落到 `cdd <verb>: …` 一支，而 Task 6 钉的是 `CDD_BLOCKED: dispatch-input · …`（F1）；② **`refused:` 只有一个家**——词面与那两空格的值间隔住 Task 7 的 `CAPSULE_WORDS` 那一行，`Preview#artifactBlock` 的模板字面量同批搬走（`preview.ts` 进 Task 7 Files，该词在该文件零命中），预览只留缩进、board 只留轮标识（F2）；③ **请求载体的三支优先序收成一个无帧取路**——RequestingCarrier（`face/dispatch-values.ts`）供组合根与 `#reviewsPath` 同调，`face/lifecycle.ts` 的三个私有方法改为委托，族名那一支的下标只带 cycle（attempt 由 `resolveHandoffName` 的 `#attemptAware` 补），Task 4 Files 增 `face/lifecycle.ts`、Step 1 加一条族名下标的用例（七条改八条）（F3）；④ **board 的新格排在必填段**——`channels` · `holding` · `next` · `projection` 四个尾参都带默认值，必填格插在它们之间即 TS1016，位置写成 `host` 之后、`channels` 之前（F4）。Task id 集与 `DependsOn` 集未动 | Oscaner M. · Claude |
| v0.20 | 2026-11-18 | 第十三轮 fix 轮（F1–F5 全采纳，F1 / F2 / F3 按裁定落地）：① **记录的站名是行集不是判据的四值**——`RefusalFacts.station` 由 RowStation 改为 `PreFlightGateName`（Task 4 之后含 RowStation 的四个值），RowStation 只留 `RowRefusal`；Task 2 加一条 `tree-clean` 记录的往返用例，把九值宽度钉在记录自己的门上（六条改七条）（F1）；② **两个读面各守自己的语义**——`read()` 保留 slug 过滤（board 与命令面问「这条拒绝是我的吗」），新增树级原样读面 `readRaw()`（释放点的清除问「这棵树上站着一条 in-flight 拒绝吗」，被作废的是树的事实）；Task 6 加一条跨工作区的释放即到期用例（十四条改十六条），Objective · Consumes · Produces · Steps · Acceptance 同批写明两个读者为何不同（F2）；③ **`op` 的折只有一处**——`RoundRecords.opOf(expected)`（branch-review → review）进 Task 4 的 Consumes 与 DispatchIdentity、Task 6 的写者，`attempt` 在折后的值上求；Task 6 加一条 branch 线拒绝记录的 identity 用例（F3）；④ **`round-artifacts.ts` 的计数文字进登记面**——第五行落地时该文件里数着工作区域的那几处 prose（工作区种类 · 无坐标字面量 · 工作区行 · 引擎产出的文件 · 文件头清单）同批换词，Task 2 的 Files · Step 3 · Acceptance 各补一条可核断言（F4）；⑤ **`vet` 的那次 `judge` 调用写实**——五格不靠 spread 渡河：`repoRoot` 由 `new RepoRoot(ctx.repoRoot)` 换成值对象、`facts` 由 `type` / `host` 两格现拼，抄 spread 会立刻两条 tsc 错（F5）。Task id 集与 `DependsOn` 集未动 | Oscaner M. · Claude |
| v0.19 | 2026-11-18 | 第十二轮 fix 轮（F1–F6 全采纳，F1 / F2 / F4 / F5 按裁定落地）：① **渲染归属的判据住读面**——PreFlightRefusal 的构造 slug 有了唯一职责：read() 对 `facts.slug` 不等于本 slug 的记录答 `absent`，Task 2 因此加一条跨工作区成对用例（五条改六条）；Task 7 的「跨工作区两向」从 board 单元用例里移出（渲染面零 slug 比较，写不出来），Acceptance 写明这条方向的家（F1）；② **`render` 的新格必填、无默认**——默认一份 `absent` 会让漏交参数的板静默不印该行；两个 session 面调用点（`session/__tests__/plan-read-consistency.test.ts` · `session/__tests__/run.test.ts`）以「仅迁构造调用、断言零改动」进 Task 7 的 Files 与 Step 5 的 `--stat` 清单（F2）；③ **board 的位置声明写实**——`inFlightRows` 一次吐 `in-flight:` · `orphan:` · `crashed:` 三段落，`refused:` 因此落在树级事实块之后（无孤儿无崩轮时才是 `in-flight:` 的下一行），Objective · Produces · Step 3 · Acceptance 四处同批改写（F3）；④ **Task 5 的退役清点补齐七件**——RowJudgment · #rowsOf · #snapshotOf · #snapshotReadOf · `#sceneFacts` · #namingAnswer · #firstRowOf 进 Files 的逐项点名、零命中 grep 与 Acceptance（F4）；⑤ **lefthook 的顺序腿成为一条观测**——坏格式那次提交的日志里 `pnpm run precommit` 零命中，Step 5 与 Acceptance 同批补上（三次提交、四条观测）（F5）；⑥ **Task 6 的 no-host 措辞归属订正**——那句已由 Task 3 搬进词表，本任务退役的是 detectHost() 调用、提前 return 与 detectHost 适配方法（F6）。Task id 集与 `DependsOn` 集未动 | Oscaner M. · Claude |
| v0.18 | 2026-11-18 | 第十一轮 fix 轮（F1–F7 全采纳）：① **退役零命中按文件核、不按 face 面核**——`artifact-reads` 与 #artifactReadOf · NO_ARTIFACTS 在 `face/board-view.ts` 是活代码（`art:` 投影的读缝与投影常量），Task 5 的两条零命中 grep 与 Acceptance 因此收窄到 `face/lifecycle.ts`，face 面的零命中只留给三个退役入口（F1）；② **board 的记录有了生产者**——`Cli#runBoard` 在造 `InFlight` 的同一处读一次三态、作为 `BoardView.render` 的参数交下去（`holding` 的同型邻居），`face/cli.ts` 与一条 `runArgv(["board", …])` 端到端进 Task 7 的 Files 与 Steps，六条改七条（F2）；③ **composer 带路径 basis**——DispatchSceneFacts 增 `repoRoot`，每条路径格在 `compose` 内经 `relativize` 收成一种写法（`#rel` 的转换点随它搬走），成对断言不再靠调用点补一道转换（F3）；④ **Task 5 的第五条缩回本任务能证的事**——镜像退役只钉判据 spy 一次与五行预报，`refused:` 行与出口收束留给 Task 6 的条目 11–13（F4）；⑤ **`--dry-run` 的 in-flight 臂按谓词保留**——条件写成 `preflight.gate === "in-flight" && preflight.holding !== undefined`（活主 · 死主 · 带锁的坏记录三形状），Task 6 补一条按形状成对的用例，十三条改十四条（F5）；⑥ **RefusalFacts 的 op 格用 `OpType`**——不另立第二个三词并集（F6）；⑦ **`dispatch-authority.ts` 的改动写实**——只改 `structureRefusal` docstring 的五行清单为九行，`#message` 的渲染形状零改动（F7）。Task id 集与 `DependsOn` 集未动 | Oscaner M. · Claude |
| v0.17 | 2026-11-18 | **实施轮订正（Task 3）**：① **快照带齐 artifact 报告要读的事实**——`ArtifactSnapshotRead` 增 `identity`（面侧 `Words#identityWords` 渲染的身份词面）与 `sidecarKind`（报告首行的 `{kind}`），并把 `path` 的 `misplaced` 语义写明为渲染名；原四格喂不出报告的 `derived:` / `identity:` / `{kind}` 三格，判据就只能把合成推回面侧（F1）；② **词面补齐两格**——`RowWording.artifact` 增 `foundJoin` / `emptyFound`（` · ` 与 `(none)` 是词不是事实，住词面，判据里零字面），与 `CAPSULE_WORDS.artifactIdentity` 同批落家（F2）；③ **报告只有一处合成**——`PreFlightRows.artifactReportOf` 收成公开静态，判据与 `Words#artifactIdentity`（board 夹具的参照渲染器）同调它，两个读者不会各拼一份（F3）；④ **槽语法跟着声明走**——`context-declarations.ts` 增 `ContextSlot`，`TemplateAssembler.slotOf` 委托它；判据要读声明行的槽，自带第二份正则就是第二份语法（F4）；⑤ **#answeredByNaming 留在场上、#emptyReasonOf 随判据退场**——前者是四份文档（p40 计划与 spec · p38 spec）的符号 pin，本任务按原指示只换注释 prose，并新增 #namingAnswer 把逐声明答案归约成判据的一格；后者的选词搬进 `ExigibleCells`，Task 5 那一行随之订正（F5）；⑥ **`carrier-seal.ts` 的 docstring 同批改述**——`rulings sidecar — ` 的单命中判据在 `infra/carrier-seal.ts` 早有第二处命中，不点它那条 grep 永不成立（F6）；⑦ **源探针跟着定义搬**——`scripts/__tests__/journey-twin.test.ts` 从 `session/faces.ts` 读 `TargetType` 的源探针改读新家，原 Files 清单漏了它（F7）。Task id 集与 `DependsOn` 集未动 | Oscaner M. · Claude |
| v0.16 | 2026-11-18 | 第九轮 fix 轮（F1–F6 全采纳）：① **判词装配写明剥站名**——`PreFlightVerdict.message` 是该行 detail 首行剥掉串首站名后的余下部分，`DispatchAuthority#message` 是唯一把它放回串首的位置；RowWording 的 dispatchInput 因此补齐 station 与 stationJoin 两格（判据按它拼出今天的字节），原句「`message` 已经是 `station · detail` 那一句」删除（F1）；② **快照两臂都有生产者**——Task 4 的 `cli.ts` 一行写明 reviewsPath 三选一之后由既有的无帧缝 `ArtifactReads#read` 判读写、`CarrierMismatchError` 映射成 mismatch 臂（载体事实取自 `CarrierIntegrity` 的 `facts()`），并加一条成对用例喂两臂，Task 5 退役 #artifactCellOf 之后它仍是唯一生产者（F2）；③ **判据收 fs 一格**——输入格增 `fs: DocFs`（与 `JudgeContext` 同形），`PreFlight#vet` 把它构造期注入的那一个交下来，判据不 new `NodeFs`，「路径格缺失」用假 fs 就能核（F3）；④ **行合成与闭集的第二处声明退役**——`Words#dispatchInput` · DispatchInputSegment · DispatchInputReason 进 Task 5 的 files · 零命中 grep · 验收，两词闭集改由 `contract/context-declarations.ts` 的 ExigibleReason 唯一声明，case (o) 搬到契约测试文件并改读该模块，`Words#artifactIdentity` 留下并写明理由（F4）；⑤ **Task 4 的验收回到这一波能证的事**——「同一份输出」改为「与 `#valuesOf` 逐字相同」，单一消费者是 Task 5 的 spy 判据（F5）；⑥ **首稿指针改标 P38**——`ExigibleCells.resolve` 的 docstring 改念 P38 spec §1.3 / §2.2（F6）。Task id 集与 `DependsOn` 集未动 | Oscaner M. · Claude |
| v0.15 | 2026-11-18 | 第八轮 fix 轮（F1–F4 全采纳）：① **判槽的归约变成可观测的一条**——`TemplateAssembler.engineWrittenSlots` 把三处 `written: "engine"` 声明归约成一槽，构造期断言消费它，每个槽的首个载体花掉一条待判项；测试改钉归约本身（三处声明 → `[INPUT_WAVE_BRIEF]`），删掉归约即红（实测：把 Set 换成 push 的副本上该用例 1 failed / 32 passed），原先那条「同槽跨行只判一次」的用例因 `#assertEngineWritten` 首个违例即抛、永不能为它所指的性质转红，随归约的 pin 到位而退役（F1）；② **Step 5 的提交形状补上 plan 回填**——实施提交 `8eb54813` 含第五个路径 `docs/kairos/plans/2026-11-17-engine-doc-tooling-p40.md`（v0.4 回填 +3/−1），判据原写四个路径，与树不符（F2）；③ **重复用例退役其一**——`templates.test.ts` 的拒绝用例与 `context-lines.test.ts` 的 (f) 是同一份；拒绝留在构造期判据 (a)–(g) 的家，`templates.test.ts` 只留 P40 专属的声明覆盖与归约两条（F3）；④ **声明计数按对象钉**——用例 1 的 `>= 3` 按行计（8 行）而其注释按声明计（3 处），现补一条声明对象的计数 pin 并把注释写成实测值（F4）。Task id 集与 `DependsOn` 集未动 | Oscaner M. · Claude |
| v0.14 | 2026-11-18 | 第七轮 fix 轮（F1–F5 全采纳）：① **判据的 `naming` 一格由缝合自答**——Task 4 写明 `PreFlight#vet` 传常量 `{ answered: false }`（#answeredByNaming 唯一的读者是预览臂的那道 `mode === "preview"` 守卫，引擎写的格的存在性腿已由 `written: "engine"` 抑制），它不占 context 的第六格：`PreFlightContext` 仍是五格，Step 3 的 checkable 与 Acceptance 因此与实现同形（F1）；② **`join` 规则收窄到路径面**——Task 3 的 Acceptance 与 repoRoot 那条从「`join` 零命中」改为「`path.join` 零命中且无 `node:path` 的 import」，`Array#join` 明确合规（`detail` 的续行与 artifact 两句 `repair` 正要用它，`face/words.ts` 今日同形）（F2）；③ **`details` 收首条之后的各条**——`#renderPreflightBlocked` 先印 `message` 再逐条印 `details`，收全部四条会让首条句子在块里印两遍；Task 4 的 Produces、Step 1 与 Acceptance 改为此形状并钉一条多违纪块的整块字节断言（F3）；④ **Task 9 的三次实测提交搬进临时树**——交付分支只留 Step 7 的一次原子提交，`git worktree` 又被规则禁止，Step 5 因此写明把工作树连 `.git` 复制到临时目录再跑（F4）；⑤ **两处单命中 grep 的 docstring 同批改述**——#artifactRefusalOf 与 `CarrierIntegrity` 的 docstring 各自把那条格式再念一遍，进 Task 3 的 Files 与搬家的字面同批改述，单命中判据因此成立（F5）。Task id 集与 `DependsOn` 集未动 | Oscaner M. · Claude |
| v0.13 | 2026-11-18 | 第六轮 fix 轮（F1–F8 全采纳）：① **缝合的五格输入各有生产者**——`PreFlightContext` 由四格改五格（`host` · `values` · `declarations` · `scene` · `artifact`），后两格由组合根交值（`#template.layoutOf(values)` 与 `scene.program` / `scene.docType` 布尔化），`(cycle, attempt)` 不随 context 走（它不喂任何一行，只进拒绝记录）——`session/` 因此不新增 `render/` 的 import（`render/templates.ts` 反过来 import `session/faces.ts`，那条边会成环）（F1）；② **board 行的轮标识与 `crashed:` 同拼写**——Task 7 的围栏改回 `{op} {cycle}·a{attempt} {station} · {detail}`，首条用例钉字节（F2）；③ **context 构造器的真实清单**——`waveCtx` · `docCtx` · `branchCtx` · `carrierCtx` 四个加一条，`plan-read-consistency.test.ts` 的 `preflightCtxOf` 进 Task 4 Files，计数改为五个构造器 / 43 处 `vet` 调用（F3）；④ **artifact 行的两个臂都有字面之家**——`RowWording.artifact` 增 `invalid` 格，present-but-unreadable 那句 `rulings sidecar — {reason}` 从 `face/lifecycle.ts` 迁进 `CAPSULE_WORDS.artifactIdentity`，并补一条单命中 grep（F4）；⑤ **死格与死词汇不登台**——判据的事实类型只留它自己读的两格（`type` · `host`），composer 的 scene 格少一格（rulings 路径改为由快照的 `read` 臂派生），`PreFlightReason` 不扩（四新行的措辞来自行的 detail）（F5）；⑥ **退役的私有机械逐个点名**——#inputRefusalOf · #artifactRefusalOf · #artifactCellOf · #artifactReadOf · #requesterDigest · #rulingsInputOf · #answeredByNaming 与 ArtifactCell · NO_ARTIFACT · `artifact-reads` 的三个 import 进 Task 5，并补一条零命中 grep（F6）；⑦ **(i) 的两半分开落定**——inputRefusal(reviewFrameOf()) 随纯判据搬迁，只有 `step()` 断言留下（F7）；⑧ **平面句收窄**——`contract/` 不 import `session/` 只声明本任务两个新模块，既有三条 contract→session 边归 P39（F8）。Task id 集与 `DependsOn` 集未动 | Oscaner M. · Claude |
| v0.1 | 2026-11-18 | 首稿：八任务 / 六波（{1} → {3} → {2,4} → {5,7} → {6} → {8}）。判据抽 `contract/` 以避免 session→face 的新环（RowStation 是站名域的唯一声明，`PreFlightGateName` 以它扩四值）；brief 改记引擎写先行；记录晚于判据、早于接线；board 独立于接线；优先级位移与 `--recover` 各自成对验收；changeset 收尾 | Oscaner M. · Claude |
| v0.2 | 2026-11-18 | 评审修复一轮（F1–F5 全采纳）：判据的输入改为契约层自声明值（ArtifactSnapshot 两臂 + 平值记录），face 在调用点适配，Task 3 的 Consumes 改成真模块路径（F1）；`#inflight.release()` 的唯一调用点钉到 `face/lifecycle.ts` 派发体并加入 Task 6 Files（F2）；宿主值的三处读者与 `#runDispatch` 的 no-host 字面、`Preview` 的 `child:` 空值分支退役并入 Task 6（F3）；封名退场改写为谓词并点名存活的 abort 记账调用（F4）；`refusal` 名字扩为 `round-artifacts.ts` 的四个登记点（F5） | Oscaner M. · Claude |
| v0.3 | 2026-11-18 | 第二轮评审修复（F1–F3 全采纳）：① Task 1 的零命中判据收窄到 `render/` 切片（`templates.ts` 的声明与注释 prose + 两个测试文件，`render/__tests__/context-lines.test.ts` 补进 Files），全树零命中移入 Task 3——face/lifecycle.ts#answeredByNaming 要到 Task 3 才换判据，且 `face/__tests__/dispatch-input.test.ts` 的注释里也有一份旧字面量（该文件因此以「仅改注释、断言零改动」进 Task 3 Files），两处都到齐后全树判据才可转绿（F1）；② Task 5 的封名退场改成点名两条存活调用（`#bookAbort` 的 `#sealRoundCarriersOf` 与终止处理器的死亡路径封名），退役范围按谓词限定在四门拒绝分支，死亡路径封名写明必须保留（F2）；③ Task 6 补第七条测试与验收：approved 派发的 `checked:` 面在 implement / review / fix 三个 fixture 上各断言一次九行行名集合（spec 具名变更④此前无归属）（F3） | Oscaner M. · Claude |
| v0.4 | 2026-11-18 | 实施轮订正（Task 1）：`preview` 字段退场后 face/lifecycle.ts#answeredByNaming 的读取字段必须在同一提交内换成 `written: "engine"`，否则声明面与唯一读者脱节、预览豁免静默失效——该文件因此进 Task 1 Files（v0.3 的「Task 3 才换判据」作废）；本任务仍只换读取字段，不动 `mode` 守卫与 per-mode 例外，行为逐字节不变。Task 3 的其余职责（判据抽 `contract/preflight-rows.ts`、`dispatch-input.test.ts` 的旧字面量）不变（`mode` 守卫与 per-mode 例外的退场归 Task 5——本行原记在 Task 3 名下，订正于此） | Oscaner M. · Claude |
| v0.5 | 2026-11-18 | 第三轮评审修复（F1–F2 全采纳）：① `--dry-run` 入口合并（spec 具名变更②③）此前无归属——Task 6 是唯一改 `face/cli.ts` 的任务却只声明三段与七条测试，现补进 Objective 一段（`verdict.leg === "structure"` 在 `--dry-run` 上收成预览面一个出口，`in-flight` 有活主保留 `lock:` 面，no-host 成门后无 harness 树 exit 1）与 Step 3 的可核条件，并加三条成对测试（三动词 stdout 预览块且 `CDD_BLOCKED:` 双流零命中 · 无 harness exit 1 对有 harness exit 0 · 活主 `lock:` 面不变），七条改十条，Acceptance 同步（F1）；② Task 6 的 `--recover` 测试与 Acceptance 补上 spec 验收的拒绝记录存活子句「refusal.json 仍在且 `station` 与被拒那一刻相同」（F2） | Oscaner M. · Claude |
| v0.6 | 2026-11-18 | 第一波 fix 轮（F1 · 两条 blocker 全受理）：① **pin 迁到今日符号名**——Task 1 把构造期断言改名为 `TemplateAssembler#assertEngineWritten`，本计划 Task 1 Files 行随之改记今日符号名（旧名只作裸词保留，见第 ② 条同理）；② **未落地词汇退回裸词**——refusal.json · RowStation · DispatchInputFacts · RowRefusal · ArtifactSnapshot · PreFlightRefusal · RefusalState · refusalRows 在本相位落地前只在围栏块与裸词里出现，行内反引号是把它们钉成落地前就红的死 pin；约束「pin 写法」这一条由此在本计划自己的 14 处上兑现；③ 语料规模 pin 由实现侧同批抬到 83（新增本计划一份），`pins.guard` 与 `census.guard` 归零。Task id 集与 `DependsOn` 集未动 | Oscaner M. · Claude |
| v0.7 | 2026-11-18 | 第二轮 fix 轮（F1–F6 全采纳）：① **封名退场的谓词改正**——门拒绝分支是三处（carrier · dispatch-input · artifact），非门调用也是三条（`#bookAbort` 的 `#sealRoundCarriersOf` · `#inflight.acquire` 的 catch 封名 · 终止处理器的死亡路径封名），Task 5 的 Step 3 与 Acceptance 去掉「四条 / 两条」计数并逐条点名，Step 1 三条改四条（丢掉锁的那次派发仍封回两条名字）（F1）；② **验收方向补齐**——Task 6 补三条 spec AC③ 的方向（释放即到期 · 持有期间两行并存 · 九行全过而 line 腿拒绝后记录已不在），十条改十四条，Acceptance 同步（F2）；③ **字节面断言归位**——Task 6 新增一条按站名核的真跑字节面断言（四个门各念自己的站名前缀 · 五行既有行与 `dispatch-input` 一行逐字节同改前 · artifact 的四段续行跟随首行而 refusal.json 无续行），spec 的具名变更不再只靠 Task 5 的预览/命令同源那一条（F3）；④ **P38 换向记录进 Task 8**——`docs/kairos/specs/2026-11-17-engine-doc-tooling-p38-design.md` 进 Files，只追加一条指向本相位的换向行并同批 +1，P38 的历史行原样保留（F4）；⑤ **存在性读走路径基值对象**——`PreFlightRows.judge` 的 `repoRoot` 由裸字符串改为 `RepoRoot`，Consumes 补上该值对象，Produces 与 Acceptance 写明存在性读只经 `relativize` / `resolve` 一个转换点、模块内零 `join`（F5）；⑥ **归属订正**——Task 3 的 #answeredByNaming 只剩注释 prose（判据已在 Task 1 换成读 `decl.written`），v0.4 行里记在 Task 3 名下的「`mode` 守卫退场」订正为 Task 5 的活（F6）。Task id 集与 `DependsOn` 集未动 | Oscaner M. · Claude |
| v0.8 | 2026-11-18 | 第三轮 fix 轮（F1–F6 全采纳）：① **九行改成按面取行集**——`order` 的行数是面的函数（`graph` 仅 `wave` / `plan` 的 ready 读 · `plan-ledger` 仅 `plan` / `wave` / `branch` · `doc-contract` 仅四个 doc 面），Task 4 的「恒含九行」与 Task 6 的九行 `checked:` 断言改为按面取该面既有行加四新行（wave fixture 八行、`plan` 面九行），always 的只是那四新行（F1）；② **依赖方向判据改为「无新增」**——`session/preflight.ts` 今天已有 type-only 的 `Words` import（`contract/judge.ts` 凭同一豁免），Constraints 与 Task 4 验收的「不得 import `face/`」改为「不新增」并点名既有那一条留存（F2）；③ **四行词面有家了**——`face/words.ts` 与 `session/carrier-integrity.ts` 进 Task 3 Files（`no-host` 那句从 `face/lifecycle.ts` 迁入，spec §1.3；`carrier-mismatch` 模板提成静态常量），judge 改收参数对象 PreFlightRowsInput 并注入 RowWording：第五个输入因此不越参数上限，contract 仍零 import、模块内零句措辞（F3）；④ **循环里的镜像归位**——镜像的家是 `face/cli.ts#Cli#runWork` 的 `--dry-run` 臂，该文件与 `cli.test.ts` 进 Task 5 Files，Step 3 补三个门方法名在该文件的零命中判据，测试补一条经循环跑一次、判据一次/镜像零次的用例（F4）；⑤ **构造器迁移的十八处归位**——四个测试文件（`lifecycle` · `dispatch-input` · `preview` · `reviewed-identity.matrix`）进 Task 6 Files、只迁构造调用而断言零改动，Task 3 的「断言零改动」写明调用由 Task 6 同批迁移，Task 6 Step 4 补 `tsc --noEmit` 门（F5）；⑥ **#answeredByNaming 的退场写实**——它本身没有 `mode` 参数（签名 `(decl, token, frame)`），随 per-mode 例外退场的是方法整体（F6）。Task id 集与 `DependsOn` 集未动 | Oscaner M. · Claude |
| v0.9 | 2026-11-18 | 第四轮 fix 轮（F1–F7 全采纳，F1 / F2 / F3 / F5 / F6 / F7 六条按裁定落地）：① **判据的声明输入归位**——判据真正读的声明类型（`ContextLine` · `RequiredArm` · 两个 `when` 臂读的场景事实）与 exigible 格的解析搬进 `contract/` 的声明模块，`render/templates.ts` 反向 import 回来，声明表与它的选取器留在原处；PreFlightRowsInput 增 `declarations` / `scene` / `naming` 三格，声明行上的一处 `decl.written` 使引擎写的格零存在性读，空值那一腿到 Task 5 与声明合一，命名豁免因此有路可退（F1）；② **值的预帧装配成文件**——`face/dispatch-values.ts` 的 composer 无帧、无 workspace，吃声明好的平值吐平值记录，Task 4 Files 收入它并把单源保证写成条件（门判的值与渲染的值是同一次装配），Task 4 因此在组合根探一次宿主并把四格输入交进 context，Task 5 把渲染器接到同一次装配上（F2）；③ **reason 表随门名一起扩**——`session/next.ts` 进 Task 4 Files，`DISPATCH_REASON` 加四条 structure 行（token 即 RowStation 的四个值），Task 4 Step 5 补 `tsc --noEmit` 门，`structureRefusal` 的 `reason: gate` 不再靠 cast（F3）；④ **迁移点进 Files**——生产侧唯一 `vet` 调用（`face/cli.ts`）与 `preflight.test.ts` 的 `waveCtx` / `branchCtx` 及七个调用点进 Task 4，断言零改动，不把新输入改成可选（F4）；⑤ **carrier 那一句只有一处合成**——`RowWording.carrier` 退场，ArtifactSnapshot 的 `mismatch` 臂携带 carrier 事实（路径 + 两个 sha8，由 `CarrierIntegrity` 的事实取出），格式住新建的 carrier 行模块，抛错的 message 与拒绝行念同一条（F5）；⑥ **changeset 逐条登记**——Task 8 正文按 spec Constraints ①–⑥ 六行列举（含 `checked:` 面的字节移动与两腿归属），不再是四项概括（F6）；⑦ **两条 board 断言迁到 Task 7**——「释放即到期」改为按记录 `read()` 核留在 Task 6（十四条改十三条），「两行并存」与「两行同消」进 Task 7 并按记录 API + in-flight 状态驱动（四条改六条），图的声明未动（F7）。Task id 集与 `DependsOn` 集未动 | Oscaner M. · Claude |
| v0.12 | 2026-11-18 | **T9 的幻觉工作删除（编排者 plan 写权）**：`AGENTS.md` 从 Files 与 Steps 移出——它从不指名 husky / lint-staged，两处只讲行为，迁移后依然成立；改为验收里的一条零命中断言。教训：清单里每一项都要能回答「不改会怎样」，答不上来的就是幻觉工作 | Oscaner M. · Claude |
| v0.11 | 2026-11-18 | **并入 Task 9（用户裁定 · 章程 v4.21）**：提交钩子 husky + lint-staged → lefthook，八步、`DependsOn: 1–8`（排在六波之后，与本相位主线无契约关联）。三条等价性写成实测（坏 ts 被拦且不写回 · 删 ts 不红 · 干净提交跑过 precommit），并显式声明本任务不产生 changeset | Oscaner M. · Claude |
| v0.10 | 2026-11-18 | 第五轮 fix 轮（F1–F4 全采纳，F1 / F2 按裁定落地）：① **composer 的格补齐**——请求载体路径进 ArtifactSnapshot 两臂（composition 的输入格，spec §1.1 ② 把它判给 ArtifactCell），`tasks` 与 `(cycle, attempt)` 进 DispatchIdentity，`compose(identity, scene, artifact)` 三个参数，请求载体路径的无帧推演明写归组合根（`--reviews` 值 · 账本的已记录上游轮载体 · `RoundNaming` 的族名），DispatchInputFacts 不再重复存该值，Task 4 的成对断言因此在 wave 与 fix 两面各跑一次（F1）；② **目标面有自己的 contract 家**——`TargetType` 定义自 `session/faces.ts` 搬进 `contract/target-type.ts`（该文件改为 re-export，既有读者零改动），`ExigibleCells.resolve` 增第三个声明参数 `type`（`judge` 传 `facts.type`），Task 3 的 import 断言与 Step 3 的 grep 同口径写出 `face/` · `render/` · `session/` 三条并新增 `TargetType` 单定义 grep（F2）；③ **三个公开判定入口随门退场**——`carrierRefusal` · artifactRefusal · inputRefusal 与 `mode` 参数同批消失（留委托壳等于把帧重组挂回公开方法），`face/__tests__/dispatch-input.test.ts` 进 Task 5 Files 并按用例落定：纯判据用例的期望字节搬到契约判据入口并落 `contract/__tests__/preflight-rows.test.ts`，(n) 改在装配的新归属处断言，(p) 的 `mode` 与预览豁免重写，(i) · (m) 的 `step()` 断言 · (o) · 两个 async 用例留原处；Step 1 的第五条 spy 从三个门方法改为 `PreFlightRows.judge` 恰好一次，Step 3 的零命中 grep 从 `cli.ts` 扩展到 `src-next/face`；Task 6 的构造器调用点计数改为按迁移后实况核（F3）；④ **拼写表的第五个登记点是 `Kind`**——`round-artifacts.ts` 的登记点由四个改五个（漏 `Kind` 时 `ENTRIES` 与 `isWorkspaceKind` 编译不过），`round-artifacts.test.ts` 的行集清单进 Task 2 Files，Task 2 的 Step 5 补 `tsc --noEmit` 门与对应验收（F4）。Task id 集与 `DependsOn` 集未动 | Oscaner M. · Claude |
