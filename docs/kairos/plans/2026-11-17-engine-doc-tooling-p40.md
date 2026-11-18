---
title: 'P40 · 派发前拒绝的记账面：四门并入 structure 腿 + 树级拒绝事实'
doc-type: plan
version: v0.7
date: 2026-11-18
slug: 2026-11-17-engine-doc-tooling-p40-design
base: develop
---

## Constraints

- **归属不变式**：拒绝是**树**的事实，不是轮的事实。本相位之后，任何 structure 腿拒绝都不得让 `Ledger#recordRound` 被调用一次——判据是「拒绝后 `waves[n].rounds` 长度与拒绝前相等」，不是「今天恰好没写」。
- **一条腿**：四条新行是 `session/preflight.ts#PreFlightGateName` 的第 6–9 行，不是第二条腿。`DispatchLeg` 三值闭集（`structure` / `upstream` / `line`）不动；复既有 `DispatchRefusal` 与 `DispatchAuthority#structureRefusal`，零新类型。
- **面的依赖方向**：判据抽进 `contract/`（最低层），`session/` 与 `face/` 都只向下引用；`session/preflight.ts` 不得 import `face/` 的任何符号（那是 P39 要拆的环，本相位不制造新环）。
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
- Modify: `packages/cdd-engine/src-next/render/templates.ts`（`ContextLine` 的声明格、三处 `preview: "satisfied"` 声明、两段描述该档的注释 prose、`TemplateAssembler#assertEngineWritten`，由原 assertPreviewAnswer 改名）
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
```

#### Steps
- **Step 1: 写三条失败测试**（三张 mode 表接受 brief 行 · 非 brief 槽声明 engine 期间红 · 同槽跨行只判一次） — checkable: `render/__tests__/templates.test.ts` 多出三条用例
- **Step 2: 跑测试确认红** — checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/render/__tests__/templates.test.ts` 报红，原因指向缺失的 `written` 档
- **Step 3: 加类型档 · 改三处声明 · 断言改名 `#assertEngineWritten` 并按槽判** — checkable: `rg -n 'preview: "satisfied"' packages/cdd-engine/src-next/render` 零命中（`templates.ts` 的三处声明与其两段注释 prose · 本任务声明的两个测试文件，均同批换词）
- **Step 4: 跑测试确认绿** — checkable: 同 Step 2 命令 0 failed
- **Step 5: 提交** — checkable: `git show --stat HEAD` 只含 `templates.ts`、两个测试文件与 `face/lifecycle.ts`（后者一行读取字段，见 Files 的订正理由）

#### Acceptance
三张 mode 表的 brief 格声明为 `written: "engine"`；非 brief 槽声明它时构造期红且报文点名该槽；`src-next/render/` 全绿；`rg -n 'preview: "satisfied"' packages/cdd-engine/src-next/render` 零命中（`templates.ts` 的三处声明与两段注释 prose、`templates.test.ts` · `context-lines.test.ts` 的既有字面量同批换词；全树零命中是 Task 3 的判据——`face/lifecycle.ts` 与 `dispatch-input.test.ts` 里的旧字面量到那时才换）。

#### DependsOn
none

### Task 2: 树级拒绝记录（一条，两触发到期）

#### Objective
一棵树任一时刻最多一条拒绝事实，落在 `in-flight.json` 的邻居。写入走命名空间发布（先 `WorkspaceRoot#ensure()` 写 `.gitignore` 标记，再原子写），否则一条拒绝会把消费仓弄脏、并让此后每次派发都在 `tree-clean` 行被引擎自己的文件拒掉。读面三态：站立 / 缺席 / 不可读。

#### Files
- Create: `packages/cdd-engine/src-next/session/refusal.ts`
- Create: `packages/cdd-engine/src-next/session/__tests__/refusal.test.ts`
- Modify: `packages/cdd-engine/src-next/session/round-artifacts.ts`（`refusal` 的四个登记点：`WorkspaceKind` 闭集 · `WORKSPACE_KINDS` 数组 · 名字拼写矩阵行 · `workspaceName` 映射）

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
- **Step 3: 加名字的四个登记点**（`WorkspaceKind` 联合多一个 `"refusal"` · `WORKSPACE_KINDS` 数组同一词 · 矩阵行 `"refusal": "refusal.json"` · `workspaceName` 的映射臂；四个点同一个文件，只加拼写行会让 `nameOf` 抛「matrix holds no workspace row」） — checkable: `nameOf("refusal", null)` 返回 refusal.json 且不加第二处字面量
- **Step 4: 实现类**（`write` 先 `ensure()` 后原子写 · `read` 三态永不抛 · `clear` force-remove） — checkable: 类落地且 `check:no-bare-functions` 对 `src-next/session` 为绿
- **Step 5: 跑测试确认绿** — checkable: 五条全过
- **Step 6: 提交** — checkable: `git show --stat HEAD` 含类、测试与拼写表三文件

#### Acceptance
五条测试全绿；写入后仓库仍 `tree-clean`（F2 的直接回归）；refusal.json 是通过 `ArtifactRegistry` 拼出的名字（无第二处字面量）；`read()` 对畸形文件返回 `corrupt` 而不抛。

#### DependsOn
3

### Task 3: 四门判据抽成纯值模块

#### Objective
四道门的判据离开 `face/lifecycle.ts` 的实例方法，成为 `contract/` 里对**值**的纯判定：吃本任务自己声明的三个契约层值（DispatchInputFacts · 一份平值记录 · 一份 artifact 快照），吐站名与原因。本任务**不改行为**——face 改为调用它，字节与今日一致；门的位置在 Task 4 才动。

平面方向是这条判据的立身之本：`contract/` 不知道 `render/TemplateValues` 与 face 私有的 `ArtifactCell` 长什么样。face 在自己的调用点做**适配**（把 `TemplateValues` 当平值记录用，把 `ArtifactCell` 的 `read` / `mismatch` 两臂映射成契约层的快照），因此 `contract/preflight-rows.ts` 不出现任何 face 或 render 的类型。

#### Files
- Create: `packages/cdd-engine/src-next/contract/preflight-rows.ts`
- Create: `packages/cdd-engine/src-next/contract/__tests__/preflight-rows.test.ts`
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（`CliLifecycle#inputRefusalOf` 与 `#artifactCellOf` 的调用点改为委托；`#answeredByNaming` 只剩注释 prose 换词——它的判据已在 Task 1 换成读 `decl.written`，本任务不动这个判定，只换描述它的那句话）
- Test: `packages/cdd-engine/src-next/face/__tests__/dispatch-input.test.ts`（仅换掉注释里那句旧字面量；断言零改动）

#### Consumes
- Task 1 的 `ContextLine.written` 与 `NAMED_BRIEF_CELL`
- `DocFs`（`contract/invariants.ts`）——存在性读
- `RepoRoot` 与 `RepoPath`（`infra/root.ts`）——路径基的唯一值对象与唯一 relativize/resolve 转换对
- `DocEntry.program` / `DocEntry.docType`（`infra/slug-index.ts`）
- 面侧的适配源（在 face 的调用点被读，不被本模块 import）：`TemplateValues`（`render/templates.ts`，一份 `Record<string, string>`）· face 私有的 `ArtifactCell`（`face/lifecycle.ts`，构件私有的两臂值类型，刻意不导出）· `ArtifactRead`（`session/round-artifacts.ts`，快照镜像的源）

#### Produces
```ts
// contract/preflight-rows.ts
export type RowStation = "no-host" | "carrier" | "dispatch-input" | "artifact";
export interface DispatchInputFacts {
  readonly type: TargetType;
  readonly tasks: string;
  readonly reviewsPath: string | null;
  readonly specPath: string | null;
  readonly overallPath: string | null;
  readonly baseBranch: string | null;
  readonly host: string;                       // 宿主探针的结果，空串 = 无宿主
}
export interface RowRefusal {
  readonly station: RowStation;
  readonly detail: string;                     // 多行：首行即结论，续行是 derived:/found:/identity:/repair:
}
/** 契约层的 artifact 快照——镜像私有 `ArtifactCell` 的两臂，只带判定要读的平值。
 *  face 在自己的调用点做映射（`read` 臂取 kind/path/reason/found；`mismatch` 臂取 message）。 */
export type ArtifactSnapshot =
  | { readonly kind: "mismatch"; readonly message: string }
  | { readonly kind: "read"; readonly read: ArtifactSnapshotRead };
export interface ArtifactSnapshotRead {
  readonly kind: "absent" | "ok" | "invalid" | "misplaced";  // `ArtifactRead` 的四臂
  readonly path: string | null;
  readonly reason: string | null;
  readonly found: readonly string[];
}
export class PreFlightRows {
  static judge(
    facts: DispatchInputFacts,
    values: Readonly<Record<string, string>>,   // 面侧 `TemplateValues` 的原样形状，零 import
    artifact: ArtifactSnapshot,                // 面侧 `ArtifactCell` 的映射结果
    repoRoot: RepoRoot,                        // 路径基值对象：存在性读只经 resolve，绝不 join
  ): readonly RowRefusal[];                    // 全部违规格一次报完（不短路）
}
```

- `repoRoot` 收既有的路径基值对象 `RepoRoot`（`infra/root.ts`），不是裸字符串：声明格里的路径是 repoRoot-relative（spec §1.1），存在性读只经 `RepoRoot` 的 `relativize` / `resolve` 这一对转换落成绝对路径——模块内不许用 `join` 自己拼一段绝对路径（今天 `#inputRefusalOf` 的注释点名的正是「从子目录派发把每条落地路径读成缺失」那个缺陷）。

#### Steps
- **Step 1: 写六条失败测试**（no-host · carrier · 必填格空 · 路径格缺失 · 三处同时三条一次报完且顺序固定 · engine 写的槽零存在性读） — checkable: `contract/__tests__/preflight-rows.test.ts` 六条用例齐
- **Step 2: 跑测试确认红** — checkable: 该文件报 `Cannot find module .../preflight-rows.ts`
- **Step 3: 搬判据进纯模块，face 侧改为取值、映射与委托**（`values` 直接以平值记录传；`ArtifactCell` → ArtifactSnapshot 的映射写在 face 的调用点） — checkable: `face/lifecycle.ts` import 该模块，四道门的判定式不再出现在 face，且 `contract/preflight-rows.ts` 的 import 列表里没有 `face/` 与 `render/`；`rg -n 'preview: "satisfied"' packages/cdd-engine/src-next` 零命中（全树：Task 1 收掉 `render/` 切片，本任务换掉 `#answeredByNaming` 的注释 prose 与 `dispatch-input.test.ts` 的旧注释）
- **Step 4: 跑绿 + 跑既有面测试确认字节未变** — checkable: 三个测试文件全绿且 `lifecycle.test.ts` · `dispatch-input.test.ts` 的断言零改动（后者只改了一句注释里的旧字面量）
- **Step 5: 提交** — checkable: `git show --stat HEAD` 含新模块、新测试、`lifecycle.ts` 与 `dispatch-input.test.ts`

#### Acceptance
六条测试全绿；`lifecycle.test.ts` 与 `dispatch-input.test.ts` 的断言零改动即绿（本任务不改行为；`dispatch-input.test.ts` 只改一句注释里的旧字面量）；`contract/preflight-rows.ts` 不 import `face/` 或 `session/` 的任何符号，也不 import `render/`（依赖方向可 grep 断言）；判据的三个输入全部是本模块自己声明的契约值；存在性读只经 `RepoRoot` 的 `relativize` / `resolve` 转换对（`contract/preflight-rows.ts` 里 `join` 零命中——路径基不从裸字符串拼）；全树 `rg -n 'preview: "satisfied"' packages/cdd-engine/src-next` 零命中（三处声明、三处注释 prose 与两个测试文件的字面量均在 Task 1 与本任务后到齐；`dispatch-input.test.ts` 是该清单里唯一只动注释的文件）。

#### DependsOn
1

### Task 4: structure 腿增四行

#### Objective
四道门成为 pre-flight 缝合的第 6–9 行，排在 `doc-contract` 之后：输入面是否合格，先要有合格的文档。缝合只吃**值**（values · artifact · 宿主事实 · 将要消耗的 `(cycle, attempt)`），绝不 import face 的模块——判据由 Task 3 的纯模块提供。优先级位移随之登记：line 腿今天排在门之前，此后排在门之后。

#### Files
- Modify: `packages/cdd-engine/src-next/session/preflight.ts`（`PreFlightGateName` 扩为九值、`PreFlightReason` 扩四值、`PreFlightContext` 增四个输入、`PreFlight#vet` 按序判定四行）
- Test: `packages/cdd-engine/src-next/session/__tests__/dispatch-authority.test.ts`（structure 腿的行集与顺序断言）
- Create: `packages/cdd-engine/src-next/session/__tests__/preflight-rows.test.ts`（四行在缝合层的端到端：值的来源、顺序、短路规则）

#### Consumes
- Task 3 的 `PreFlightRows.judge` · DispatchInputFacts · RowRefusal · ArtifactSnapshot
- `PreFlightContext` / `PreFlightVerdict`（既有）
- `RoundNaming#attemptOf` 与 `Ledger#roundCount`——将要消耗的 `(cycle, attempt)` 的唯一来源

#### Produces
```ts
export type PreFlightGateName =
  | "tree-clean" | "in-flight" | "graph" | "plan-ledger" | "doc-contract"
  | RowStation;                                // 四个新行就是 RowStation 的四个值，零第二处枚举
export interface PreFlightContext {
  // …既有字段…
  readonly host: string;                       // 组合根探一次，交值不交模块
  readonly values: Readonly<Record<string, string>>;  // 装配好的那一次（契约层的平值记录）
  readonly artifact: ArtifactSnapshot;         // face 侧映射后的契约值，不是私有 ArtifactCell
  readonly round: { readonly cycle: number; readonly attempt: number };
}
```
- `PreFlight#vet` 的判定序：既有五行（原序，逐行判定、首个违纪即拒）→ 四新行（no-host → carrier → dispatch-input → artifact，**四条全判、一次报完**）。verdict 的 `gate` 取四条里的第一条违纪站名，`details` 收全部四条。
- 优先级位移（spec 的第六项具名变更）：四行排在 line 腿**之前**，因此同一个 fixture 同时犯门与线两条时，报的是门的行；门通过之后，线的拒绝仍可达。

#### Steps
- **Step 1: 写四条失败测试**（缺宿主 · 值坏 · 三处同时 details 三条 · 文档坏与值坏并存时 doc-contract 先拒） — checkable: `session/__tests__/preflight-rows.test.ts` 四条用例齐
- **Step 2: 跑测试确认红** — checkable: 该文件报红，原因指向未扩的九值或缺失的 context 输入
- **Step 3: 扩类型与判定**（九值 · 四原因 · context 四输入必填 · 四行全判一次报完） — checkable: `PreFlightGateName` 的声明含 RowStation；`PreFlightContext` 含 `host`/`values`/`artifact`/`round`
- **Step 4: 写优先级位移的成对测试**（门与线同犯 ⇒ 报门的行；补齐门之后再跑 ⇒ 报线的行） — checkable: 该对断言同文件内可红可绿
- **Step 5: 跑绿 + 跑既有缝合测试** — checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/session/__tests__/` 全绿
- **Step 6: 提交** — checkable: `git show --stat HEAD` 含 `session/preflight.ts` 与两个测试文件

#### Acceptance
九值闭集且 `order` 恒含九行；`session/preflight.ts` 不 import `face/`（grep 断言）；四行全报而非逐条短路；`doc-contract` 仍排在四行之前；优先级位移有成对断言（门的行在前、线的行在门通过后仍可达）。

#### DependsOn
1, 3

### Task 5: 退役派发体四门与预览的三门镜像

#### Objective
判定有了唯一的家，派发体里那四道门与预览里的三门镜像同时退场——第二处问同一个判定就是第二份事实来源。随之退场的是**门拒绝分支**上的 `#sealRoundCarriers`：门在开名之前判，没有名字需要封回。门之外的封名不在此列——abort 记账、丢掉 in-flight 锁的那次派发、终止处理器的死亡路径三条都必须留着。

#### Files
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（删四门判定；删**门拒绝分支**上的 `#sealRoundCarriers`——carrier · dispatch-input · artifact 三处，不是拒绝路径上的全部调用；`#inputRefusalOf` 与 `#answeredByNaming` 的 `mode` 参数退场）
- Modify: `packages/cdd-engine/src-next/face/preview.ts`（三联门块收为五行预报；`artifactBlock` 保留为唯一的拒绝块渲染）
- Test: `packages/cdd-engine/src-next/face/__tests__/lifecycle.test.ts`
- Test: `packages/cdd-engine/src-next/face/__tests__/preview.test.ts`

#### Consumes
- Task 4 的 `PreFlightVerdict`（`gate` / `message` / `details` / `order`）
- `Preview.artifactBlock`（既有，预览的拒绝块）

#### Produces
- `CliLifecycle` 的派发前判定面只剩「值装配 + 交付」：`#valuesOf` 与 artifact cell 仍在此处（它们是装配，不是判定），判定一律来自缝合。
- `Preview` 的 `--dry-run` 分支只渲染五行预报 + 判定块，不再自己做门判定。

#### Steps
- **Step 1: 写四条失败测试**（一次派发只判一次 · 门拒绝分支零封名调用 · 预览块与被拒同源逐字节相同 · 丢掉 in-flight 锁的那次派发仍封回本轮两个名字：`#inflight.acquire` 抛 `HoldingError` 之后两条 carrier 名都不可写） — checkable: `lifecycle.test.ts` 与 `preview.test.ts` 各多出对应用例（第四条的断言在 `lifecycle.test.ts`）
- **Step 2: 跑测试确认红** — checkable: 两个面测试文件报红，原因指向仍在的第二次判定
- **Step 3: 删派发体四门 · 删门拒绝分支的封名 · 预览改为读 verdict** — checkable: `rg -n 'sealRoundCarriers' packages/cdd-engine/src-next/face/lifecycle.ts` 只剩定义对（`#sealRoundCarriers` / `#sealRoundCarriersOf`）与三条**非门**调用——abort 记账（`#bookAbort` 里的 `#sealRoundCarriersOf(op, "wave", …)`）· 丢掉锁的那次派发（`#inflight.acquire` 的 `catch` 里的封名：gate→acquire 竞态下这两条名字都得封回，否则下一次 preflight 的孤儿清扫才收得回）· 终止处理器里的死亡路径封名（P31 T5 §2.4：kill / timeout / crash 之后仍须封，必须保留）；carrier · dispatch-input · artifact 三处门拒绝分支零命中
- **Step 4: 跑绿 + 全 face 面** — checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/face/` 全绿
- **Step 5: 提交** — checkable: `git show --stat HEAD` 含 `lifecycle.ts`、`preview.ts` 与两个测试文件

#### Acceptance
一次派发只判一次（spy 计数 = 1）；**门拒绝分支**零封名调用（按谓词核，不按条数：`rg -n 'sealRoundCarriers'` 在 `face/lifecycle.ts` 只余三条非门调用——`#bookAbort` 的 `#sealRoundCarriersOf` · `#inflight.acquire` 的 `catch` 封名 · 终止处理器的死亡路径封名，后两条分别是 gate→acquire 竞态与 P31 T5 §2.4 的晚落地保证，不得随本任务退役）；丢掉锁的那次派发仍把本轮两个名字封回；预览块与命令面同源；`src-next/face/` 全绿。

#### DependsOn
4

### Task 6: 组合根：写、清、dry-run 守卫、宿主探针

#### Objective
组合根是唯一写者与唯一清除者，且两者对称：`vet` 返回后，`structureRefusal(preflight) !== null` 且**非** `--dry-run` ⇒ 写记录；`=== null` 且非 `--dry-run` ⇒ 清除。宿主只探一次，交值给缝合、派发体与预览三处。派发体的释放点上补第二个清除触发，带 `in-flight` 谓词。

`--dry-run` 上的入口也在同一段收成一个：`runWork` 里 `verdict.leg === "structure"` 那一支今天在 `--dry-run` 上分岔成两条出口（`in-flight` 且有活主走 `Preview#heldBlock`，其余走 `#renderPreflightBlocked`），此后整条结构腿的拒绝在 `--dry-run` 上一律由预览面陈述——stdout 的预览块 + 一条 `  refused:  station · detail` 行，`CDD_BLOCKED:` 不出现在任何流上，details 行与 checked 面仍在 stdout；`in-flight` 有活主那一臂按 spec 2.4 保留 `lock:` 面与接管提示、无 `refused:` 行。入口合并改写的是拒绝的**流与出口**，不是判据——两种出口念的是同一条活判词（Task 4 的 verdict）。随入口合并而来的是 exit 码：no-host 成了一道门之后，无 harness 的树里 `--dry-run` 从「五行预报 + exit 0」变成「预览块 + exit 1」，有 harness 的树仍预报、仍 exit 0（spec 具名变更③）。

宿主值的三处读者在这一任务里同时落地（**派发路径上恰好一次探测**）：（a）`PreFlightContext.host`（no-host 行）；（b）`CliLifecycle` 的 spawn 读注入的 `HOSTS[值]`，`#runDispatch` 顶部那次 `detectHost()` 调用、它的提前 return 与它印的 `CDD_BLOCKED: no host harness detected …` 字面同批退役，`CliLifecycle#detectHost` 这个只被那一处调用的适配方法随之退场；（c）`face/preview.ts#Preview` 的构造器改收宿主值，`child:` 行的 `(no host detected — real run would BLOCK)` 分支与钉它的那条测试一并退役。派发路径之外的三处 `HostDetect.detect` 读取（`CliGate` 的 `#renderer` · `Cli#runBoard` · `Cli#runWork` 的 `Capsule`）不动。

#### Files
- Modify: `packages/cdd-engine/src-next/face/cli.ts`（`runWork` 的 vet 之后、`ensure()` 与 `#renderChecked` 之间的三段；`host` 探针一次并把值交给三处；释放点清除；`--dry-run` 上结构腿拒绝的出口收束与 exit 码成对）
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（构造器收注入的宿主值；spawn 读 `HOSTS[值]`；`#runDispatch` 顶部的 `detectHost()` 调用与 no-host 字面退役；释放点的清除谓词）
- Modify: `packages/cdd-engine/src-next/face/preview.ts`（构造器改收宿主值；`child:` 行直读那张表，空值分支退役）
- Modify: `packages/cdd-engine/src-next/session/dispatch-authority.ts`（structure 腿的 reason 渲染按九行取值，沿用 `#message` 的「reason 分隔 detail」形状）
- Test: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`

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
- **Step 1: 写十四条失败测试**（拒绝不写轮记录且重派仍 `review 1·1` · 记录八字段齐 · 通过即清 · `--dry-run` 零写零清 · `tree-clean` 站名不被释放清掉 · **释放即到期**：A 持 in-flight 时 B 在 `in-flight` 行被拒并写下 `station: in-flight` 的记录，A 随后正常结束并释放 ⇒ board 上 `in-flight:` 与 `refused:` 两行同时消失 · **拒绝与持有并存**：同一竞态里 A 释放之前，`in-flight:` 与 `refused:` 两行同时在场 · **门口清除先于 line 腿**：记录由一次 `tree-clean` 拒绝落下，把树弄干净，再跑一次九行全过、而 line 腿拒绝的派发（`implement` 相位的 wave 上 `cdd review`）⇒ exit 1 且念 line 腿那一行，board 无 `refused:` 行 · **字节面按站名核**：四个门各真跑拒绝一次，首行分别是 `CDD_BLOCKED: no-host · …` / `carrier · …` / `dispatch-input · …` / `artifact · …`，且五行既有行与 `dispatch-input` 一行与改前逐字节相同（成对：先钉改前字节）、artifact 的四段续行（`derived:` · `found:` · `identity:` · `repair:` 占两行）跟随首行而 refusal.json 里没有它们 · `--recover` 不认领且 refusal.json 仍在、`station` 与被拒那一刻相同 · approved 派发的 `checked:` 面在 implement / review / fix 三个 fixture 上各断言一次九行行名集合、一律 always · `--dry-run` 入口收成一个：脏树上三动词各跑一次，stdout 出现预览头 + 一条 `  refused:  station · detail`，`CDD_BLOCKED:` 在两个流上都零命中 · 无 harness 树的 `--dry-run` 是预览块 + exit 1（成对：有 harness 的树仍五行预报 + exit 0） · `in-flight` 有活主的 `--dry-run` 仍是 `lock:` 面与接管提示、无 `refused:` 行） — checkable: `cli.test.ts` 多出十四条用例
- **Step 2: 跑测试确认红** — checkable: 该文件报红，首条用例的失败信息即改前实况（`crashed:` 行仍在）
- **Step 3: 接线**（探针一次并把值交给三处 · 派发体与预览改读值 · 拒则写 / 通则清 · 释放点按 `in-flight` 谓词清 · `--dry-run` 的结构腿拒绝收成预览面一个出口） — checkable: 写与清在 `runWork` 同一段内且共用 `!parsed.dryRun`；`--dry-run` 分支上 `#renderPreflightBlocked` 零调用（只剩预览块一条出口），`Preview#heldBlock` 仅存于 `in-flight` 有活主那一臂；`rg -n 'HostDetect.detect' packages/cdd-engine/src-next -g '!**/__tests__/**'` 只剩组合根与三处具名面外读者（共四命中），`CliLifecycle#detectHost` 零命中
- **Step 4: 跑绿 + 派发面全量** — checkable: `pnpm -C packages/cdd-engine exec vitest run src-next/face/ src-next/session/` 全绿
- **Step 5: 提交** — checkable: `git show --stat HEAD` 含 `cli.ts`、`lifecycle.ts`、`preview.ts`、`dispatch-authority.ts` 与 `cli.test.ts`

#### Acceptance
十四条测试全绿；写与清在同一处、同一 `!parsed.dryRun` 守卫；`--dry-run` 上的结构腿拒绝只有一个出口且只走 stdout（`CDD_BLOCKED:` 在两个流上零命中，`in-flight` 有活主那一臂的 `lock:` 面成对不变），无 harness 的树 exit 1、有 harness 的树 exit 0；`--recover` 路径上 refusal.json 仍在且 `station` 不变；三面各有一条 `checked:` 行名集合断言（`tree-clean` · `in-flight` · `graph` · `plan-ledger` · `doc-contract` · `no-host` · `carrier` · `dispatch-input` · `artifact`，写行名与适用面、不写整块快照）；`--dry-run` 零写零清；`tree-clean` 站名的记录不被一次释放清掉，而 `in-flight` 站的那条被持有者的一次释放清掉、释放之前两行同时在场；九行全过而 line 腿拒绝的那次派发之前，记录已由门口清除（board 无 `refused:` 行）；四个门各真跑拒绝一次，首行各带自己的站名，五行既有行与 `dispatch-input` 一行逐字节同改前，artifact 的四段续行跟随首行而 refusal.json 无续行；重派仍是 `review 1·1`；**派发路径上恰好一次宿主探测**（`rg -n 'HostDetect.detect' packages/cdd-engine/src-next -g '!**/__tests__/**'` 四命中：组合根 + `CliGate` 的 `#renderer` + `Cli#runBoard` + `Cli#runWork` 的 `Capsule`），`#runDispatch` 顶部那份 no-host 字面与 `Preview` 的 `child:` 空值分支均已退役。

#### DependsOn
2, 4, 5

### Task 7: board 的两行

#### Objective
board 在 `in-flight:` 之后念一条 `refused:` 行，读的是记录里的 `station` + 单行 `detail`；记录不可读时念一条自己的 corrupt 行，绝不静默视作「没有拒绝」。两行都不参与聚合、不影响计数与 `next:`。

#### Files
- Modify: `packages/cdd-engine/src-next/face/board-view.ts`（`refusalRows(state, words)`，与 `inFlightRows` 并列装配）
- Modify: `packages/cdd-engine/src-next/face/words.ts`（`refused:` 行的一处构造 + 一句 corrupt 词，与 `in-flight` 的 corrupt 词并排）
- Test: `packages/cdd-engine/src-next/face/__tests__/board-view.test.ts`

#### Consumes
- Task 2 的 RefusalState（三态）
- `BoardView.inFlightRows` 的装配位置与 `words` 面（既有）

#### Produces
```ts
// 一条 token 的行：` · ` 在此是行的内容，不是 token 分隔符
static refusalRows(state: RefusalState, words: Words): readonly string[];
// 形状（围栏，非既有坐标）
//   refused: review 1·1 dispatch-input · review · BASE_BRANCH · empty-value
//   refused: unreadable refusal record
```

#### Steps
- **Step 1: 写四条失败测试**（standing 的形状与位置 · corrupt 行且 exit 0 · absent 零新行且既有行逐字节不变 · 跨工作区两向） — checkable: `board-view.test.ts` 多出四条用例
- **Step 2: 跑测试确认红** — checkable: 该文件报红，原因指向缺失的 refusalRows
- **Step 3: 实现两行与词面**（三态分派 · 词进一处） — checkable: board 输出里 `refused:` 紧跟 `in-flight:`
- **Step 4: 跑绿 + board 面** — checkable: `board-view.test.ts` 与 `face.test.ts` 全绿
- **Step 5: 提交** — checkable: `git show --stat HEAD` 含 `board-view.ts`、`words.ts` 与 `board-view.test.ts`

#### Acceptance
三态各自可核，含跨工作区的一对方向；`refused:` 紧跟 `in-flight:`；corrupt 不静默、不 exit 1；`absent` 时既有行逐字节不变。

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
- `.changeset/p40-preflight-refusal.md`：`cdd-engine: minor`，正文点名四项消费面变化（board 两行 · 新产物 refusal.json · 三行报文新增站名 · 预览块收缩）。
- 章程 P40 两格与文档版本同步到交付后的状态。
- P38 spec 的 `INPUT_WAVE_BRIEF` per-mode 豁免已被本相位退役，那条换向记录是它自己的指向：历史行不改，版本 +1 与历史行同批。

#### Steps
- **Step 1: 写 changeset**（`cdd-engine: minor`，正文四行对应四项消费面变化） — checkable: `.changeset/p40-preflight-refusal.md` 存在且含四行变化
- **Step 2: 回填章程与文档版本**（P40 两格 Done · 章程与 spec/plan 各 +1 与历史行 · P38 spec 追加一条换向行并同批 +1） — checkable: 四份文档的 front-matter 版本与最新历史行一致
- **Step 3: 全量门禁** — checkable: `pnpm run validate` exit 0
- **Step 4: 提交** — checkable: `git show --stat HEAD` 含 changeset 与四份文档

#### Acceptance
`pnpm run validate` exit 0；`pnpm run emit:check` 无漂移；changeset 级别为 `minor`；章程与三份文档（P40 spec · P40 plan · P38 spec）的版本、历史行与交付事实一致，P38 的历史行未被改写。

#### DependsOn
1, 2, 3, 4, 5, 6, 7

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-18 | 首稿：八任务 / 六波（{1} → {3} → {2,4} → {5,7} → {6} → {8}）。判据抽 `contract/` 以避免 session→face 的新环（RowStation 是站名域的唯一声明，`PreFlightGateName` 以它扩四值）；brief 改记引擎写先行；记录晚于判据、早于接线；board 独立于接线；优先级位移与 `--recover` 各自成对验收；changeset 收尾 | Oscaner M. · Claude |
| v0.2 | 2026-11-18 | 评审修复一轮（F1–F5 全采纳）：判据的输入改为契约层自声明值（ArtifactSnapshot 两臂 + 平值记录），face 在调用点适配，Task 3 的 Consumes 改成真模块路径（F1）；`#inflight.release()` 的唯一调用点钉到 `face/lifecycle.ts` 派发体并加入 Task 6 Files（F2）；宿主值的三处读者与 `#runDispatch` 的 no-host 字面、`Preview` 的 `child:` 空值分支退役并入 Task 6（F3）；封名退场改写为谓词并点名存活的 abort 记账调用（F4）；`refusal` 名字扩为 `round-artifacts.ts` 的四个登记点（F5） | Oscaner M. · Claude |
| v0.3 | 2026-11-18 | 第二轮评审修复（F1–F3 全采纳）：① Task 1 的零命中判据收窄到 `render/` 切片（`templates.ts` 的声明与注释 prose + 两个测试文件，`render/__tests__/context-lines.test.ts` 补进 Files），全树零命中移入 Task 3——`face/lifecycle.ts#answeredByNaming` 要到 Task 3 才换判据，且 `face/__tests__/dispatch-input.test.ts` 的注释里也有一份旧字面量（该文件因此以「仅改注释、断言零改动」进 Task 3 Files），两处都到齐后全树判据才可转绿（F1）；② Task 5 的封名退场改成点名两条存活调用（`#bookAbort` 的 `#sealRoundCarriersOf` 与终止处理器的死亡路径封名），退役范围按谓词限定在四门拒绝分支，死亡路径封名写明必须保留（F2）；③ Task 6 补第七条测试与验收：approved 派发的 `checked:` 面在 implement / review / fix 三个 fixture 上各断言一次九行行名集合（spec 具名变更④此前无归属）（F3） | Oscaner M. · Claude |
| v0.4 | 2026-11-18 | 实施轮订正（Task 1）：`preview` 字段退场后 `face/lifecycle.ts#answeredByNaming` 的读取字段必须在同一提交内换成 `written: "engine"`，否则声明面与唯一读者脱节、预览豁免静默失效——该文件因此进 Task 1 Files（v0.3 的「Task 3 才换判据」作废）；本任务仍只换读取字段，不动 `mode` 守卫与 per-mode 例外，行为逐字节不变。Task 3 的其余职责（判据抽 `contract/preflight-rows.ts`、`dispatch-input.test.ts` 的旧字面量）不变（`mode` 守卫与 per-mode 例外的退场归 Task 5——本行原记在 Task 3 名下，订正于此） | Oscaner M. · Claude |
| v0.5 | 2026-11-18 | 第三轮评审修复（F1–F2 全采纳）：① `--dry-run` 入口合并（spec 具名变更②③）此前无归属——Task 6 是唯一改 `face/cli.ts` 的任务却只声明三段与七条测试，现补进 Objective 一段（`verdict.leg === "structure"` 在 `--dry-run` 上收成预览面一个出口，`in-flight` 有活主保留 `lock:` 面，no-host 成门后无 harness 树 exit 1）与 Step 3 的可核条件，并加三条成对测试（三动词 stdout 预览块且 `CDD_BLOCKED:` 双流零命中 · 无 harness exit 1 对有 harness exit 0 · 活主 `lock:` 面不变），七条改十条，Acceptance 同步（F1）；② Task 6 的 `--recover` 测试与 Acceptance 补上 spec 验收的拒绝记录存活子句「refusal.json 仍在且 `station` 与被拒那一刻相同」（F2） | Oscaner M. · Claude |
| v0.6 | 2026-11-18 | 第一波 fix 轮（F1 · 两条 blocker 全受理）：① **pin 迁到今日符号名**——Task 1 把构造期断言改名为 `TemplateAssembler#assertEngineWritten`，本计划 Task 1 Files 行随之改记今日符号名（旧名只作裸词保留，见第 ② 条同理）；② **未落地词汇退回裸词**——refusal.json · RowStation · DispatchInputFacts · RowRefusal · ArtifactSnapshot · PreFlightRefusal · RefusalState · refusalRows 在本相位落地前只在围栏块与裸词里出现，行内反引号是把它们钉成落地前就红的死 pin；约束「pin 写法」这一条由此在本计划自己的 14 处上兑现；③ 语料规模 pin 由实现侧同批抬到 83（新增本计划一份），`pins.guard` 与 `census.guard` 归零。Task id 集与 `DependsOn` 集未动 | Oscaner M. · Claude |
| v0.7 | 2026-11-18 | 第二轮 fix 轮（F1–F6 全采纳）：① **封名退场的谓词改正**——门拒绝分支是三处（carrier · dispatch-input · artifact），非门调用也是三条（`#bookAbort` 的 `#sealRoundCarriersOf` · `#inflight.acquire` 的 catch 封名 · 终止处理器的死亡路径封名），Task 5 的 Step 3 与 Acceptance 去掉「四条 / 两条」计数并逐条点名，Step 1 三条改四条（丢掉锁的那次派发仍封回两条名字）（F1）；② **验收方向补齐**——Task 6 补三条 spec AC③ 的方向（释放即到期 · 持有期间两行并存 · 九行全过而 line 腿拒绝后记录已不在），十条改十四条，Acceptance 同步（F2）；③ **字节面断言归位**——Task 6 新增一条按站名核的真跑字节面断言（四个门各念自己的站名前缀 · 五行既有行与 `dispatch-input` 一行逐字节同改前 · artifact 的四段续行跟随首行而 refusal.json 无续行），spec 的具名变更不再只靠 Task 5 的预览/命令同源那一条（F3）；④ **P38 换向记录进 Task 8**——`docs/kairos/specs/2026-11-17-engine-doc-tooling-p38-design.md` 进 Files，只追加一条指向本相位的换向行并同批 +1，P38 的历史行原样保留（F4）；⑤ **存在性读走路径基值对象**——`PreFlightRows.judge` 的 `repoRoot` 由裸字符串改为 `RepoRoot`，Consumes 补上该值对象，Produces 与 Acceptance 写明存在性读只经 `relativize` / `resolve` 一个转换点、模块内零 `join`（F5）；⑥ **归属订正**——Task 3 的 `#answeredByNaming` 只剩注释 prose（判据已在 Task 1 换成读 `decl.written`），v0.4 行里记在 Task 3 名下的「`mode` 守卫退场」订正为 Task 5 的活（F6）。Task id 集与 `DependsOn` 集未动 | Oscaner M. · Claude |
