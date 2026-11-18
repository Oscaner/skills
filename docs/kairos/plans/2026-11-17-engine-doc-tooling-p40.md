---
title: 'P40 · 派发前拒绝的记账面：四门并入 structure 腿 + 树级拒绝事实'
doc-type: plan
version: v0.1
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
- Modify: `packages/cdd-engine/src-next/render/templates.ts`（`ContextLine` 的声明格、三处 `preview: "satisfied"` 声明、`TemplateAssembler#assertPreviewAnswer`）
- Test: `packages/cdd-engine/src-next/render/__tests__/templates.test.ts`

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

- [ ] **Step 1: 写失败测试**——在 `templates.test.ts` 追加三条：① 三张 mode 表的 brief 行都接受 `written: "engine"`（构造不抛）；② 一个非 brief 槽声明 `written: "engine"` ⇒ 构造期抛，报文点名该槽；③ 同一槽在两行声明 ⇒ 仍只判一次（槽是单位，不是行）。
- [ ] **Step 2: 跑它，确认红**——`pnpm -C packages/cdd-engine exec vitest run src-next/render/__tests__/templates.test.ts`，期待 `written` 不存在 / 断言未改名导致的失败。
- [ ] **Step 3: 改类型与三处声明**——`ContextLine` 增 `written?: "engine"`，删 `preview` 档；三处 brief 声明改 `written: "engine"`；`#assertPreviewAnswer` 改名 `#assertEngineWritten`，判据改为「带 `written: "engine"` 的声明，其 `token` 必须是 `NAMED_BRIEF_CELL`」，以槽去重。
- [ ] **Step 4: 跑测试确认绿**——同 Step 2 的命令。
- [ ] **Step 5: Commit**——`git add packages/cdd-engine/src-next/render/templates.ts packages/cdd-engine/src-next/render/__tests__/templates.test.ts && git commit -m "feat(render): declare the brief cell engine-written instead of preview-satisfied"`。

#### Acceptance
三张 mode 表的 brief 格声明为 `written: "engine"`；非 brief 槽声明它时构造期红且报文点名该槽；`src-next/render/__tests__/` 全绿；`grep -rn 'preview: "satisfied"' packages/cdd-engine/src-next` 零命中（既有测试字面量同步改写）。

#### DependsOn
none

### Task 2: 树级拒绝记录（一条，两触发到期）

#### Objective
一棵树任一时刻最多一条拒绝事实，落在 `in-flight.json` 的邻居。写入走命名空间发布（先 `WorkspaceRoot#ensure()` 写 `.gitignore` 标记，再原子写），否则一条拒绝会把消费仓弄脏、并让此后每次派发都在 `tree-clean` 行被引擎自己的文件拒掉。读面三态：站立 / 缺席 / 不可读。

#### Files
- Create: `packages/cdd-engine/src-next/session/refusal.ts`
- Create: `packages/cdd-engine/src-next/session/__tests__/refusal.test.ts`
- Modify: `packages/cdd-engine/src-next/session/round-artifacts.ts`（名字拼写表加 `refusal` 行，与 `in-flight` 并列）

#### Consumes
- `ArtifactRegistry.nameOf`（`session/round-artifacts.ts`）——名字的唯一语法
- `WorkspaceRoot`（`infra/workspace.ts`）——`ensure()` 发布 keep-out 标记
- `AtomicWriter`（`infra/atomic.ts`）——原子写
- `RowStation`（Task 3，`contract/preflight-rows.ts`）——站名域的唯一声明，Task 4 的 `PreFlightGateName` 以它为四个新值

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

- [ ] **Step 1: 写失败测试**——`refusal.test.ts` 五条：① `write` 之后 `path()` 存在且 `read()` 得 `standing`，字段逐项相等；② 在没有 `.kairos` 的临时仓里 `write` ⇒ 命名空间与其 `.gitignore`（内容 `*`）同时落地（用 `GitClient#isClean` 或 `git status --porcelain` 断言树仍干净，这是 F2 的回归钉）；③ 二次 `write` 覆盖而非追加；④ 手写畸形 JSON ⇒ `read()` 得 `corrupt` 且带原因，不抛；⑤ `clear()` 幂等（缺席时调用不抛）。
- [ ] **Step 2: 跑红**——`pnpm -C packages/cdd-engine exec vitest run src-next/session/__tests__/refusal.test.ts`。
- [ ] **Step 3: 加名字拼写行**——`session/round-artifacts.ts` 的拼写表加 `refusal: "refusal.json"`（与 `in-flight` 并列，矩阵是名字的唯一语法）。
- [ ] **Step 4: 实现类**——`write` 先 `root.ensure()` 再 `AtomicWriter`；`read` 三态；`clear` 用 `rmSync({force:true})`。守「一棵树最多一条」这一条不变量，不持轮状态、不参与轮判定。
- [ ] **Step 5: 跑绿**——同 Step 2。
- [ ] **Step 6: Commit**——`feat(session): add the tree-level refusal record beside in-flight`。

#### Acceptance
五条测试全绿；写入后仓库仍 `tree-clean`（F2 的直接回归）；`refusal.json` 是通过 `ArtifactRegistry` 拼出的名字（无第二处字面量）；`read()` 对畸形文件返回 `corrupt` 而不抛。

#### DependsOn
3

### Task 3: 四门判据抽成纯值模块

#### Objective
四道门的判据离开 `face/lifecycle.ts` 的实例方法，成为 `contract/` 里对**值**的纯判定：吃 `DispatchInputFacts` + `TemplateValues` + `ArtifactCell`，吐站名与原因。本任务**不改行为**——face 改为调用它，字节与今日一致；门的位置在 Task 4 才动。

#### Files
- Create: `packages/cdd-engine/src-next/contract/preflight-rows.ts`
- Create: `packages/cdd-engine/src-next/contract/__tests__/preflight-rows.test.ts`
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（`CliLifecycle#inputRefusalOf` 与 `#artifactCellOf` 的调用点改为委托；`#answeredByNaming` 的判据改为读 `written: "engine"`）

#### Consumes
- Task 1 的 `ContextLine.written` 与 `NAMED_BRIEF_CELL`
- `TemplateValues`、`ArtifactCell`、`OpenFrame`（`face/lifecycle.ts` 既有导出）
- `DocFs`（`contract/invariants.ts`）——存在性读
- `DocEntry.program` / `DocEntry.docType`（`infra/slug-index.ts`）

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
export class PreFlightRows {
  static judge(
    facts: DispatchInputFacts,
    values: TemplateValues,
    artifact: ArtifactCell,
    repoRoot: string,
  ): readonly RowRefusal[];                    // 全部违规格一次报完（不短路）
}
```

- [ ] **Step 1: 写失败测试**——`preflight-rows.test.ts` 六条：① `host === ""` ⇒ 一条 `no-host`；② artifact 为 `mismatch` ⇒ 一条 `carrier`；③ 必填格空值 ⇒ 一条 `dispatch-input` 且 detail 点名 row 与 token；④ 路径格不存在 ⇒ 同站名、原因为 `target-absent`；⑤ 三处同时违纪 ⇒ **三条一次报完**（顺序：no-host → carrier → dispatch-input → artifact）；⑥ 声明 `written: "engine"` 的 brief 格在任何 `host` 取值下都不产生存在性读（直接对着 values 断言，不碰盘）。
- [ ] **Step 2: 跑红**——`pnpm -C packages/cdd-engine exec vitest run src-next/contract/__tests__/preflight-rows.test.ts`。
- [ ] **Step 3: 搬判据**——把 `#inputRefusalOf` / `#answeredByNaming` / artifact 与 carrier 的判定搬进 `PreFlightRows.judge`，face 侧只留取值与委托；`detail` 保持今日的多行形状。
- [ ] **Step 4: 跑绿 + 跑既有面测试，确认字节未变**——`pnpm -C packages/cdd-engine exec vitest run src-next/contract/__tests__/preflight-rows.test.ts src-next/face/__tests__/lifecycle.test.ts src-next/face/__tests__/dispatch-input.test.ts`。
- [ ] **Step 5: Commit**——`refactor(contract): extract the four pre-dispatch judgments into a pure module`。

#### Acceptance
六条测试全绿；`lifecycle.test.ts` 与 `dispatch-input.test.ts` 无改动即绿（本任务不改行为）；`contract/preflight-rows.ts` 不 import `face/` 或 `session/` 的任何符号（依赖方向可 grep 断言）。

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
- Task 3 的 `PreFlightRows.judge` · `DispatchInputFacts` · `RowRefusal`
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
  readonly values: TemplateValues;             // 装配好的那一次
  readonly artifact: ArtifactCell;
  readonly round: { readonly cycle: number; readonly attempt: number };
}
```
- `PreFlight#vet` 的判定序：既有五行（原序，逐行判定、首个违纪即拒）→ 四新行（no-host → carrier → dispatch-input → artifact，**四条全判、一次报完**）。verdict 的 `gate` 取四条里的第一条违纪站名，`details` 收全部四条。
- 优先级位移（spec 的第六项具名变更）：四行排在 line 腿**之前**，因此同一个 fixture 同时犯门与线两条时，报的是门的行；门通过之后，线的拒绝仍可达。

- [ ] **Step 1: 写失败测试**——`session/__tests__/preflight-rows.test.ts` 四条：① 缺宿主 ⇒ verdict 的 `gate` 是 `no-host` 且 `order` 里九行齐；② 值坏 ⇒ `gate === "dispatch-input"`，`message` 首行是 `dispatch-input · …`（站名在首行，Task 5 之前也成立）；③ 三处同时违纪 ⇒ `details` 三条且顺序固定；④ 文档坏且值也坏 ⇒ `doc-contract` 先拒（四行排在它之后）。
- [ ] **Step 2: 跑红**——`pnpm -C packages/cdd-engine exec vitest run src-next/session/__tests__/preflight-rows.test.ts`。
- [ ] **Step 3: 扩类型与判定**——`PreFlightGateName` / `PreFlightReason` 扩值；`PreFlightContext` 增四个输入（`host` 必填，不留类型级默认——未接线的门不能静默通过）；`vet` 在 `doc-contract` 之后调 `PreFlightRows.judge`，把 `RowRefusal` 映射成 `gate` / `reason` / `message` / `details`。
- [ ] **Step 5: 优先级位移的成对测试**——同一 fixture 既缺必填格又缺少线面输入 ⇒ 报门的行；补齐门所需的格后再跑 ⇒ 报线的行（`DispatchLeg` 为 `line`）。此条写进 `preflight-rows.test.ts`。
- [ ] **Step 4: 跑绿 + 跑既有缝合测试**——`pnpm -C packages/cdd-engine exec vitest run src-next/session/__tests__/`.
- [ ] **Step 6: Commit**——`feat(preflight): judge the four dispatch-input rows inside the structure leg`。

#### Acceptance
九值闭集且 `order` 恒含九行；`session/preflight.ts` 不 import `face/`（grep 断言）；四行全报而非逐条短路；`doc-contract` 仍排在四行之前；优先级位移有成对断言（门的行在前、线的行在门通过后仍可达）。

#### DependsOn
1, 3

### Task 5: 退役派发体四门与预览的三门镜像

#### Objective
判定有了唯一的家，派发体里那四道门与预览里的三门镜像同时退场——第二处问同一个判定就是第二份事实来源。随之退场的是拒绝路径上的 `#sealRoundCarriers`：门在开名之前判，没有名字需要封回。

#### Files
- Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（删四门判定与 `#sealRoundCarriers` 的三处调用；`#inputRefusalOf` 与 `#answeredByNaming` 的 `mode` 参数退场）
- Modify: `packages/cdd-engine/src-next/face/preview.ts`（三联门块收为五行预报；`artifactBlock` 保留为唯一的拒绝块渲染）
- Test: `packages/cdd-engine/src-next/face/__tests__/lifecycle.test.ts`
- Test: `packages/cdd-engine/src-next/face/__tests__/preview.test.ts`

#### Consumes
- Task 4 的 `PreFlightVerdict`（`gate` / `message` / `details` / `order`）
- `Preview.artifactBlock`（既有，预览的拒绝块）

#### Produces
- `CliLifecycle` 的派发前判定面只剩「值装配 + 交付」：`#valuesOf` 与 artifact cell 仍在此处（它们是装配，不是判定），判定一律来自缝合。
- `Preview` 的 `--dry-run` 分支只渲染五行预报 + 判定块，不再自己做门判定。

- [ ] **Step 1: 写失败测试**——`lifecycle.test.ts` 追加两条：① 派发体里不再存在第二次判定（spy `PreFlightRows.judge` 的调用次数在一次派发中为 1）；② 拒绝路径不再封 carrier（对一个尚未开名的轮，拒绝后 `CarrierSeal` 零调用）。`preview.test.ts` 追加一条：三个门的预览与被拒真的同源（同输入 ⇒ 预览块与命令面块的原因逐字节相同）。
- [ ] **Step 2: 跑红**——`pnpm -C packages/cdd-engine exec vitest run src-next/face/__tests__/lifecycle.test.ts src-next/face/__tests__/preview.test.ts`。
- [ ] **Step 3: 删两处**——派发体四门与 `#sealRoundCarriers` 的拒绝调用、预览的三门镜像；`mode` 参数退场，`preview` 侧改为读 verdict。
- [ ] **Step 4: 跑绿 + 全 face 面**——`pnpm -C packages/cdd-engine exec vitest run src-next/face/`。
- [ ] **Step 5: Commit**——`refactor(face): retire the in-round gates and the preview mirror`。

#### Acceptance
一次派发只判一次（spy 计数 = 1）；拒绝路径零 `CarrierSeal` 调用；预览块与命令面同源；`src-next/face/` 全绿。

#### DependsOn
4

### Task 6: 组合根：写、清、dry-run 守卫、宿主探针

#### Objective
组合根是唯一写者与唯一清除者，且两者对称：`vet` 返回后，`structureRefusal(preflight) !== null` 且**非** `--dry-run` ⇒ 写记录；`=== null` 且非 `--dry-run` ⇒ 清除。宿主只探一次，交值给缝合、派发体与预览三处。派发体的释放点上补第二个清除触发，带 `in-flight` 谓词。

#### Files
- Modify: `packages/cdd-engine/src-next/face/cli.ts`（`runWork` 的 vet 之后、`ensure()` 与 `#renderChecked` 之间的三段；`host` 探针一次；释放点清除）
- Modify: `packages/cdd-engine/src-next/session/dispatch-authority.ts`（structure 腿的 reason 渲染按九行取值，沿用 `#message` 的「reason 分隔 detail」形状）
- Test: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`

#### Consumes
- Task 2 的 `PreFlightRefusal`（`write` / `clear` / `read`）
- Task 4 的 `PreFlightVerdict`、Task 5 的派发体入口（整条腿已过）
- `InFlight#release` 的唯一调用点（`face/cli.ts` 或 `session/run.ts`，以现树为准）

#### Produces
- `Cli#runWork` 的三段：探宿主 → `vet` → 拒则写 / 通则清 → `#renderChecked` → `ensure()` → `renderBrief`。
- 释放点清除：`release()` 之后读记录，`station === "in-flight"` 才清。

- [ ] **Step 1: 写失败测试**——`cli.test.ts` 追加六条：① 无 `base.json` 的 wave 评审 ⇒ 命令输出 `CDD_BLOCKED` 且站名在首行；`waves[n].rounds` 长度不变；重派仍 `review 1·1`（**成对：改前红**）；② 同一派发后 `refusal.json` 存在且八字段齐；③ 拒绝后跑一次合法派发 ⇒ 记录消失；④ `--dry-run` 中途被拒 ⇒ 零写入（记录不出现也不消失）；⑤ 记录站名为 `tree-clean` 时，另一次派发释放后记录仍在（谓词不是「有记录就清」）；⑥ 对一次被拒的派发执行 `--recover` ⇒ 不认领、零恢复写入、`cycle` 不动、不写轮记录，同一拒绝复发（`无可接管` 那句在这条路径上不可达，测试断言的是这四件事而非某句措辞）。
- [ ] **Step 2: 跑红**——`pnpm -C packages/cdd-engine exec vitest run src-next/face/__tests__/cli.test.ts`。
- [ ] **Step 3: 接线**——探针一次并交值；写/清三段按 6.1；释放点按谓词清除。
- [ ] **Step 4: 跑绿 + 派发面全量**——`pnpm -C packages/cdd-engine exec vitest run src-next/face/ src-next/session/`。
- [ ] **Step 5: Commit**——`feat(cli): write and clear the refusal record at the composition root`。

#### Acceptance
六条测试全绿；写与清在同一处、同一 `!parsed.dryRun` 守卫；`--dry-run` 零写零清；`tree-clean` 站名的记录不被一次释放清掉；重派仍是 `review 1·1`。

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
- Task 2 的 `RefusalState`（三态）
- `BoardView.inFlightRows` 的装配位置与 `words` 面（既有）

#### Produces
```ts
// 一条 token 的行：` · ` 在此是行的内容，不是 token 分隔符
static refusalRows(state: RefusalState, words: Words): readonly string[];
// 形状（围栏，非既有坐标）
//   refused: review 1·1 dispatch-input · review · BASE_BRANCH · empty-value
//   refused: unreadable refusal record
```

- [ ] **Step 1: 写失败测试**——四条：① `standing` ⇒ 一行 `  refused: {op} {cycle}·a{attempt} {station} · {detail}`，位置紧接 `in-flight:` 之后；② `corrupt` ⇒ 一行 corrupt 词、无 `refused:` 行、board 仍 exit 0；③ `absent` ⇒ 零新行，且既有 `in-flight:` / `crashed:` 行逐字节不变；④ 记录里的 `slug` 是**另一个**工作区 ⇒ 本 board 不渲染该行，而在它自己的 board 上照常渲染（同一条记录、两处观察，一条断言两个方向）。
- [ ] **Step 2: 跑红**——`pnpm -C packages/cdd-engine exec vitest run src-next/face/__tests__/board-view.test.ts`。
- [ ] **Step 3: 实现两行**——`refusalRows` 三态分派；词面进 `words.ts` 一处构造；装配点紧跟 `inFlightRows`。
- [ ] **Step 4: 跑绿 + board 面**——`pnpm -C packages/cdd-engine exec vitest run src-next/face/__tests__/board-view.test.ts src-next/face/__tests__/face.test.ts`。
- [ ] **Step 5: Commit**——`feat(board): render the tree's standing refusal beside in-flight`。

#### Acceptance
三态各自可核，含跨工作区的一对方向；`refused:` 紧跟 `in-flight:`；corrupt 不静默、不 exit 1；`absent` 时既有行逐字节不变。

#### DependsOn
2

### Task 8: changeset · 章程回填 · 全量门禁

#### Objective
把这一轮的消费面变化登记齐：changeset 一条 `minor`、章程的 P40 两格与版本、spec 与 plan 的版本与 change history，然后跑全量门禁。

#### Files
- Create: `.changeset/p40-preflight-refusal.md`
- Modify: `docs/kairos/overalls/2026-10-10-engine-doc-tooling-overall.md`（P40 两格状态与 version）
- Modify: `docs/kairos/specs/2026-11-17-engine-doc-tooling-p40-design.md`（version + change history）
- Modify: `docs/kairos/plans/2026-11-17-engine-doc-tooling-p40.md`（version + change history）

#### Consumes
- Task 1–7 的交付事实

#### Produces
- `.changeset/p40-preflight-refusal.md`：`cdd-engine: minor`，正文点名四项消费面变化（board 两行 · 新产物 refusal.json · 三行报文新增站名 · 预览块收缩）。
- 章程 P40 两格与文档版本同步到交付后的状态。

- [ ] **Step 1: 写 changeset**——`cdd-engine: minor`，正文四行分别对应四项消费面变化，并指向 spec 的六项具名变更。
- [ ] **Step 2: 回填章程与文档版本**——P40 的 Design spec / Implementation plan 两格改为 `✔ Done（<文件名> · <日期>）`，章程版本 +1 并追加 change-history 行；spec / plan 各自版本 +1 与历史行。
- [ ] **Step 3: 全量门禁**——`pnpm run validate`，期待 exit 0。
- [ ] **Step 4: 提交**——`chore(release): declare cdd-engine minor for P40`。

#### Acceptance
`pnpm run validate` exit 0；`pnpm run emit:check` 无漂移；changeset 级别为 `minor`；章程与两份文档的版本、历史行与交付事实一致。

#### DependsOn
1, 2, 3, 4, 5, 6, 7

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-18 | 首稿：八任务 / 六波（{1} → {3} → {2,4} → {5,7} → {6} → {8}）。判据抽 `contract/` 以避免 session→face 的新环（`RowStation` 是站名域的唯一声明，`PreFlightGateName` 以它扩四值）；brief 改记引擎写先行；记录晚于判据、早于接线；board 独立于接线；优先级位移与 `--recover` 各自成对验收；changeset 收尾 | Oscaner M. · Claude |
