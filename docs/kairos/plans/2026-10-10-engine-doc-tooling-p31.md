---
title: 引擎文档工具（Engine Doc-Tooling）— P31 计划：账本事实与磁盘一致性
doc-type: plan
version: v0.1
date: 2026-11-09
slug: 2026-10-10-engine-doc-tooling-p31
base: develop
---

## Constraints

- **逐字取 spec**：本计划只实现 `docs/kairos/specs/2026-10-10-engine-doc-tooling-p31-design.md` **现行 `version`**（v0.2）所指的面；spec 版本一变，本约束的字面同笔改。
- **判收敛主线零改（硬底线 · D70）**：`NextStepRouter` 闭合判定、`#blockerCount`、`REVIEW_CYCLE_CAP`、next-loop / architecture 孪生门、finding severity 词表与 rollup 规则**零字节改动**；`session/next.ts` 只允许 `FIX_READBACK_SUFFIX` 一个字符串常量改字（它是提示文案，不是转移表）。
- **落地序硬约束（spec §Constraints）**：sidecar + readback 文案 → digest 读回 → draft/final → seal。计划波序 W1{1,2,6} → W2{3} → W3{4} → W4{5} → W5{7} 即此序；任一波颠倒即 BLOCKED。
- **`.kairos/` 不入 git**：强化只走权限位（`0o444`）与 sidecar 分离，不新增跟踪面、不改 `.gitignore`。
- **无新 CLI 动词**：不加 `cdd annotate`、不加 `--ruling`；编排者直写 sidecar 文件。
- **`progress.json` 固定键集不动**：新增事实只落 `RoundRecord`（`carrierDigest` / `draftPath`）与 `InFlightRecord` 两处已有记录面。
- **历史零迁移**：无 `carrierDigest` 的旧记录按 present-facts 读（不做比对、不报 mismatch）；旧 carrier 不做 chmod 回溯。
- **sidecar 永不 seal**：只 seal 引擎自己的载体（draft 与 final）。
- **零模块级裸函数**；波内任务 ≤ 3。
- changeset 只 `@oscaner-skills/cdd-engine` **minor**；`@oscaner-skills/kairos` 不 bump；不发布。

## Review Focus

- **mismatch 在「读得到但已变」这一态上被漏判**：digest 只在写入时记、读取时比对；若把 absence 与 mismatch 合并，篡改过的载体读成 `null` 会退化成「没有载体」的合法路径（既有 legacy skip 腿会放行）。红测必须区分三态：absent / ok / mismatch。
- **seal 只盖成功路径**：`#reject`（stall / 非零退出）、spawn 前门禁拒、`--recover` abort 三条终态各需一次 seal，否则被杀轮次的草稿长期可写——这是本 issue 原暴露面。
- **unseal 范围过宽**：按目录或 slug 解封会把「作为 fix 输入的上一轮 review 载体」一并解封，在整个 fix 窗口重开漏洞。红测要断言输入载体在 fix 全程仍为 `0o444`。
- **sidecar 写了但 child 看不见**：`INPUT_RULINGS` 若只在 review 轮渲染、或在空 sidecar 时仍印 `- \`INPUT_RULINGS\`:` 空行，两种都让「裁定」沦为假动作。成对 pin：有 sidecar 必含裁定正文 / 无 sidecar 必无该行。
- **写回判据被当成豁免**：`touchedDoc === null`（git 不可读）必须仍绑当前并留 soft 观察；把它当成 `false` 会让非 git 树的 fix 永远不写回，把行永久钉在 drift 上。
- **header 门把存量打红**：全语料 0 的前提是存量已规范；若新 invariant 把某篇存量文档打红，先量后改，不许把 ceiling 放宽。

---

### Task 1: change-history 表头列集门

#### Objective

新增不变量 `change-history-header-columns`：`## Change history` 表头必须精确等于声明列集 `Version · date · summary · author`，并把它接进规则登记表、语料门与 docs-fix 模板的写作纪律句。`change-history-row-shape` 不动。

#### Files
- 新建：`packages/cdd-engine/src-next/contract/__tests__/change-history-header.test.ts`
- 修改：`packages/cdd-engine/src-next/contract/invariants.ts`（在 `ChangeHistoryRowShapeInvariant` 旁新增类与声明列集常量）
- 修改：`packages/cdd-engine/src-next/contract/rules.ts`（import + 登记行）
- 修改：`packages/cdd-engine/src-next/render/templates.ts`（docs-fix 模式固定前缀加一句竖线纪律）
- 修改：`packages/cdd-engine/src-next/contract/__tests__/doc-corpus.guard.test.ts`（`PINNED_KINDS` 加 kind、`DRIFT_CEILING` 加空表、PROGRAM_DOCS 加 P31 spec/plan 两条）
- 修改：`packages/cdd-engine/src-next/contract/__tests__/rules.test.ts`（登记表快照）

#### Consumes
- `contract/invariants.ts` 的 `Invariant` 基类：`protected changeHistory(ctx)` 返回 `{ headerRow, rows }`，`protected finding(ctx, section, summary, fix)` 造一条 finding
- `contract/rules.ts` 的 `DocRule` 行形状：`{ scope: "doc", id, docKeys: "all", create }`

#### Produces
- `export const CHANGE_HISTORY_COLUMNS: readonly ["Version", "date", "summary", "author"]`（`invariants.ts`）
- `export class ChangeHistoryHeaderColumnsInvariant extends Invariant`，`readonly name = "change-history-header-columns"`

#### Steps

- [ ] **Step 1: 写红测** — `change-history-header.test.ts` 五例：四列声明表头零 finding；多一列（`Version · date · summary · 落点 · author`）一条 finding 且 `kind` 为 `change-history-header-columns`、`section` 为 `Change history`；少一列一条；列名漂移（`Date` 大写）一条；无 `## Change history` 节零 finding（不虚构判定对象）。

```ts
const judge = (body: string): Finding[] =>
  new ChangeHistoryHeaderColumnsInvariant().evaluate(
    ctxOf(`---\ntitle: t\nversion: v1.0\n---\n\n## Change history\n\n${body}`),
  );
expect(judge("| Version | date | summary | author |\n| --- | --- | --- | --- |\n")).toEqual([]);
expect(judge("| Version | date | summary | 落点 | author |\n")).toHaveLength(1);
```

- [ ] **Step 2: 跑红** — `pnpm -C packages/cdd-engine exec vitest run src-next/contract/__tests__/change-history-header.test.ts` 期望 `ReferenceError`/集合为空（类未定义）。

- [ ] **Step 3: 实现类** — 在 `ChangeHistoryRowShapeInvariant` 之后加 `CHANGE_HISTORY_COLUMNS` 常量与新类：取 `this.changeHistory(ctx).headerRow`，`null`/空返回 `[]`；`trim` 后逐格与声明集比对，`length` 或任一格不等则 `this.finding(ctx, "Change history", \`the header reads <实际> against the declared colum...\`, "keep the four declared columns — the skeleton emits them; adding a fifth hides its rows from the lineage")` 一条。

- [ ] **Step 4: 登记与模板** — `rules.ts` 加 `{ scope: "doc", id: "change-history-header-columns", docKeys: "all", create: () => new ChangeHistoryHeaderColumnsInvariant() }`（紧邻 `change-history-row-shape` 行之后）；`templates.ts` 的 docs-fix 固定前缀在既有 change-history 两句旁加：`A Change-history summary must escape a literal pipe as \\| — an unescaped one splits the cell and corrupts every lineage read.`

- [ ] **Step 5: 语料与登记表** — `doc-corpus.guard.test.ts` 的 `PINNED_KINDS` 追加该 kind、`DRIFT_CEILING["change-history-header-columns"] = {}`（空表 ≡ 全 0）；`PROGRAM_DOCS` 追加 `docs/kairos/specs/2026-10-10-engine-doc-tooling-p31-design.md` 与 `docs/kairos/plans/2026-10-10-engine-doc-tooling-p31.md`，并在该测的 `findingsOn` 断言里加 `change-history-header-columns` 一行。`rules.test.ts` 快照按新登记行更新。

- [ ] **Step 6: 全绿 + 提交** — `pnpm -C packages/cdd-engine exec vitest run src-next/contract` 全绿；`pnpm exec tsc --noEmit -p packages/cdd-engine` exit 0；`git commit -m "feat(contract): pin the change-history header column set (#447)"`。

#### Acceptance
- 表头多/少一列或列名漂移各产生**恰好一条** `change-history-header-columns` finding；声明四列表头零 finding。
- `change-history-row-shape` 行为不变：既有 `judge.test.ts` 三例与 `doc-corpus.guard.test.ts` 的 shape ceiling 原样通过（正交）。
- 全语料 `excessOver("change-history-header-columns", {})` 为空（每篇文档 0 条）。
- docs-fix 固定前缀含转义竖线句（子串断言）。

#### DependsOn
none

---

### Task 2: 裁定 sidecar 与 `INPUT_RULINGS` 渲染

#### Objective

让编排者的裁定有一个受支持的落点：`<carrier 路径>.json` → `.rulings.json` 的 sidecar 文件，严格 schema 读回；fix / docs-fix 的 round-context 渲染 `INPUT_RULINGS`；`FIX_READBACK_SUFFIX` 改指 sidecar 而非「handoff 文件」。

#### Files
- 新建：`packages/cdd-engine/src-next/session/carrier-rulings.ts`
- 新建：`packages/cdd-engine/src-next/session/__tests__/carrier-rulings.test.ts`
- 修改：`packages/cdd-engine/src-next/session/next.ts:311-312`（`FIX_READBACK_SUFFIX` 字面）
- 修改：`packages/cdd-engine/src-next/render/templates.ts`（`TOKENS` 加行；fix 与 docs-fix 两个 `roundContext` 在 `INPUT_REVIEWS` 之后加 `- \`INPUT_RULINGS\`: {{INPUT_RULINGS}}`）
- 修改：`packages/cdd-engine/src-next/face/lifecycle.ts:866`（`#valuesOf` 增一格，与 `INPUT_REVIEWS` 同一条件）
- 修改：`packages/cdd-engine/src-next/render/__tests__/templates.test.ts`、`packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（后缀字面 7 处重锚）

#### Consumes
- `face/lifecycle.ts#reviewsPath(frame)`：fix 轮的载体绝对路径（`null` off-face）
- `render/templates.ts` 的 `TOKENS` 行形状 `{ name, zone }` 与空值行丢弃行为（assembler 丢空 token 行）

#### Produces
- `export class CarrierRulings`，静态方法：
  - `static pathFor(carrierPath: string): string` — 结尾 `.json` 换 `.rulings.json`（非 `.json` 结尾原样加 `.rulings.json`）
  - `static read(carrierPath: string): { readonly rulings: readonly Ruling[] } | null` — 文件不存在 → `null`
  - `static verdict(carrierPath: string, findingIds: ReadonlySet<string>): RulingVerdict`，`RulingVerdict = { kind: "absent" } | { kind: "ok"; rulings } | { kind: "invalid"; reason }`
- `export interface Ruling { readonly finding: string; readonly ruling: string; readonly at?: string; readonly by?: string }`
- 新 `FIX_READBACK_SUFFIX` 字面：`"(confirm the reviews handoff · if a finding needs a ruling, record it beside that handoff — same path with .json replaced by .rulings.json)"`

#### Steps

- [ ] **Step 1: 写红测（carrier-rulings）** — `pathFor("a/b/phase-spec-review-1.c2.json") === "a/b/phase-spec-review-1.c2.rulings.json"`；缺文件 → `{kind:"absent"}`；合法文件 → `{kind:"ok"}` 且 rulings 逐条等于写入；五条 invalid 各一例：非 JSON、`rulings` 非数组、条目缺 `ruling`、未知顶层键、`finding` 不在 carrier 的 id 集。

- [ ] **Step 2: 跑红** — 该测试文件失败（模块不存在）。

- [ ] **Step 3: 实现 `CarrierRulings`** — 单类、只读文件；`readFileSync` 包 try；`verdict` 按上面五例逐条返回 `invalid` 并带一句 reason；未知键用「顶层 `carrier`/`rulings` + 条目 `finding`/`ruling`/`at`/`by`」白名单拒绝。

- [ ] **Step 4: 写红测（渲染）** — `templates.test.ts`：fix 模板在有 sidecar 夹具时渲染出 `INPUT_RULINGS` 行且含裁定正文；无 sidecar 时整行缺席（`not.toContain("INPUT_RULINGS")`）。`cli.test.ts`：`FIX_READBACK_SUFFIX` 新字面出现在 wave / plan / branch / doc 四条 fix 的 `next:` 行（既有 7 处锚点整体重锚）。

- [ ] **Step 5: 实现渲染与文案** — `TOKENS` 加 `{ name: "INPUT_RULINGS", zone: "round-context" }`；fix 与 docs-fix 的 `roundContext` 紧跟 `INPUT_REVIEWS` 插入该行；`#valuesOf` 里 `INPUT_RULINGS: op === "fix" ? this.#rulingsRel(frame) : ""`，`#rulingsRel` 读 `CarrierRulings.verdict(reviewsPath, findingIds)`：`ok` → `this.#rel(CarrierRulings.pathFor(path))`，其余 → `""`；`invalid` 时向 `#valuesOf` 的违规收集面推一条 hard（见 Step 6）。`next.ts` 改常量字面。

- [ ] **Step 6: 违反面接线** — `verdict.kind === "invalid"` 在**派发前**转成 `CDD_BLOCKED`（与既有 pre-flight 拒绝同通道，`outcome` 不产生、child 零 spawn）：在 `face/lifecycle.ts#runDispatch` 开头、`#inflight.acquire` 之前判一次，命中即 `this.#blocked(...)` + 返回 `{ status: "BLOCKED", violations: [RoundViolation.hard(reason, "contract-violation")] }`。

- [ ] **Step 7: 全绿 + 提交** — `pnpm -C packages/cdd-engine exec vitest run src-next/render src-next/face src-next/session` 全绿；typecheck exit 0；`git commit -m "feat(session): carrier rulings sidecar and INPUT_RULINGS round context (#444)"`。

#### Acceptance
- `CarrierRulings.pathFor` 与 spec §2.1 的 `.json → .rulings.json` 规则一致（成对 pin：draft 名与 `.cN` 名两种输入）。
- 有 sidecar 的 fix 渲染含裁定正文；无 sidecar 时 prompt 内零 `INPUT_RULINGS` 字面（成对 pin）。
- sidecar 五种坏形态在派发前 `CDD_BLOCKED`，child 零 spawn（断言 dispatcher 未被调用）。
- review 轮（`op !== "fix"`）的 round-context 零 `INPUT_RULINGS`。

#### DependsOn
none

---

### Task 3: 载体内容摘要与 `carrier-mismatch`

#### Objective

载体落盘时把字节 sha256 记进 `RoundRecord.carrierDigest`；凡引擎读载体的入口先比对，不匹配即 `CDD_BLOCKED` 并打印 `carrier-mismatch · line=<path> · recorded=<sha8> · current=<sha8>`，且不启动 child。三态严格区分：absent / ok / mismatch。

#### Files
- 新建：`packages/cdd-engine/src-next/session/carrier-integrity.ts`
- 新建：`packages/cdd-engine/src-next/session/__tests__/carrier-integrity.test.ts`
- 修改：`packages/cdd-engine/src-next/infra/workspace.ts:181-186`（`writeJson` 拆出 `writeJsonHashed`）
- 修改：`packages/cdd-engine/src-next/session/ledger.ts:1564-1572`（`persistHandoff` 返回 `{ path, digest }`）、`:113-135`（`RoundRecord` 加 `carrierDigest`）、`:1606-1608`（`readHandoff` 校验）、`:646-648`（`#persist` 返回字节串）
- 修改：`packages/cdd-engine/src-next/session/run.ts:702-717`（`persistHandoff` 新返回形状 + 记录 `carrierDigest`）
- 修改：`packages/cdd-engine/src-next/face/cli.ts`（捕获 `CarrierMismatchError` → CDD_BLOCKED 通道 + 既有 blocked 退出码）
- 修改：`packages/cdd-engine/src-next/face/lifecycle.ts`（`#reconstruct` 捕获 → BLOCKED outcome）

#### Consumes
- `infra/workspace.ts#writeJson`：`ensure()` → `#normalizePaths` → `#atomic.write(resolve(name), JSON.stringify(normalized, null, 2) + "\n")`
- `session/run.ts#bookkeep`：`carrierPath = this.#ledger.persistHandoff(op, frame.type, frame.params, carrier)`

#### Produces
- `export class CarrierIntegrity`，`static sha256(bytes: string): string`、`static mismatch(recorded: string | null, current: string | null): { recorded: string; current: string } | null`（任一为 `null` → `null`，表示无从比对）
- `export class CarrierMismatchError extends Error`，字段 `readonly line: string; readonly recorded: string; readonly current: string`，`message` = `carrier-mismatch · line=<line> · recorded=<sha8> · current=<sha8>`
- `Workspace.writeJsonHashed(name: string, value: unknown): string`（返回写入字节的 sha256 hex）；`writeJson` 改为 `writeJsonHashed` 的薄壳（单点序列化）
- `Ledger.persistHandoff(...): { readonly path: string; readonly digest: string }`

#### Steps

- [ ] **Step 1: 写红测（完整性）** — `CarrierIntegrity.sha256` 对固定串返回已知 hex（钉一个常量）；`mismatch(null, "x")` 与 `mismatch("x", null)` 都为 `null`；`mismatch("a","a")` 为 `null`；`mismatch("a","b")` 返回两端。

- [ ] **Step 2: 写红测（三态）** — 夹具：写一个 carrier 并记 digest → 不改字节时 `readHandoff` 返回对象；删除文件时返回 `null`（absent 合法）；把文件改成另一串字节时 `readHandoff` 抛 `CarrierMismatchError`，`message` 含 `recorded=` 与 `current=` 且两者不同。第四例：旧记录无 `carrierDigest`（present-facts）→ 即便字节被改也**不抛**、照常返回（零迁移）。

- [ ] **Step 3: 跑红** — 两文件失败。

- [ ] **Step 4: 实现完整性类与写盘** — `carrier-integrity.ts` 两个类（`node:crypto` 的 sha256）；`workspace.writeJsonHashed` 把既有 `JSON.stringify(normalized, null, 2) + "\n"` 算一次 digest 后返回，`writeJson` 调它并丢弃返回值；`#persist` 返回该 digest。

- [ ] **Step 5: 实现记录与校验** — `RoundRecord` 加 `readonly carrierDigest?: string | null`；`recordRound` 透传；`#bookkeep` 存 `carrierDigest: digest`；`readHandoff` 在读到对象后取该 (op,type,round) 最新记录的 digest（新私有读 `#digestOf(op, type, params)`），`mismatch` 非空即抛 `CarrierMismatchError`。

- [ ] **Step 6: 接入两条通道** — `face/cli.ts` 顶层 catch 该错误 → `io.stderr("CDD_BLOCKED: " + message)` + 既有 blocked 退出码；`face/lifecycle.ts#reconstruct` 捕获 → 返回 `{ status:"BLOCKED", violations:[RoundViolation.hard(message, "contract-violation")] }`（child 已跑完的那条通道，与派发前拒绝互补）。`#bookkeep` 的 `carrierPath` 读新返回形状。

- [ ] **Step 7: 全绿 + 提交** — `pnpm -C packages/cdd-engine exec vitest run src-next/session src-next/face src-next/infra` 全绿；typecheck exit 0；`git commit -m "feat(session): carrier digest and carrier-mismatch hard stop (#444)"`。

#### Acceptance
- absent / ok / mismatch 三态各有独立 pin；absent 与 mismatch 不得合并成同一返回值。
- 篡改后的载体在 fix 派发前被拒，dispatcher 零调用；board / capsule 读同一路径亦走同一判定（结构性 pin：读面无第二条 `readHandoff` 旁路）。
- 旧记录（无 `carrierDigest`）零迁移：既有 fixture 全绿，无新 mismatch。
- `carrier-mismatch` 报文含 `line` / `recorded` / `current` 三段（子串断言）。

#### DependsOn
2

---

### Task 4: draft 与 final 分路径（`<stem>.c<N>.json`）

#### Objective

定稿不再覆盖草稿：final 写 `<stem>.c<N>.json`（N = 该轮 cycle），草稿留在派发原路径；`RoundRecord` 同时记 `carrierPath`（final）与 `draftPath`，digest 改为对 final 字节。

#### Files
- 修改：`packages/cdd-engine/src-next/session/round-naming.ts`（新增 `finalName` / `finalPath`）
- 修改：`packages/cdd-engine/src-next/session/ledger.ts`（`persistHandoff` 写 final 并返回 `{ path, draftPath, digest }`；`RoundRecord` 加 `draftPath`；`recordRound` 透传）
- 修改：`packages/cdd-engine/src-next/session/run.ts:702-717`（读新返回形状，记录两路径）
- 修改：`packages/cdd-engine/src-next/session/__tests__/ledger.test.ts`、`packages/cdd-engine/src-next/session/__tests__/run.test.ts`

#### Consumes
- Task 3 的 `persistHandoff` 返回形状与 `carrierDigest` 记录
- `RoundNaming#stem(op, type, params)` 与 `handoffName(op, type, params)`

#### Produces
- `RoundNaming.finalName(op: string, type: string, params: HandoffParams): string` — 把 `handoffName` 结尾的 `.json` 换成 `.c<N>.json`，`N = params.round`
- `RoundNaming.finalPath(...)` — resolve 后的绝对路径
- `Ledger.persistHandoff(...): { readonly path: string; readonly draftPath: string; readonly digest: string }`

#### Steps

- [ ] **Step 1: 写红测（命名）** — `finalName("review","wave",{tasks:"1",round:2}) === "tasks-1-review-2.c2.json"`；`finalName("fix","phase-spec",{round:3}) === "phase-spec-fix-3.c3.json"`；`round` 缺省时 `N` 为空串导致的名字**不得**出现——缺 `round` 直接返回 `handoffName`（不制造 `.c.json`）。

- [ ] **Step 2: 写红测（共存）** — 一个 review 轮 bookkeep 后：磁盘上同时存在草稿名与 `.c<N>.json`；记录 `carrierPath` 指向 final、`draftPath` 指向草稿；两者 digest 一致；把草稿删掉后 `readHandoff`（走 final）仍可读。

- [ ] **Step 3: 实现命名与写入** — `finalName` 用 `params.round` 拼；`persistHandoff` 先 `#persist(finalName, data)`（拿 digest），再原样返回 `{ path: finalPath, draftPath: handoffPath, digest }`；**不删除草稿、不写草稿**。

- [ ] **Step 4: 记录两路径** — `RoundRecord.draftPath?: string | null`；`#bookkeep` 三字段一起落记录；`readHandoff` 的 digest 查找不变（仍按 `carrierPath` 对应的 final）。

- [ ] **Step 5: 全绿 + 提交** — `pnpm -C packages/cdd-engine exec vitest run src-next/session src-next/face` 全绿；typecheck exit 0；`git commit -m "feat(session): final carriers land at their cycle path, drafts stay (#444)"`。

#### Acceptance
- final 与 draft 同名 stem、不同后缀，且 `RoundRecord` 两路径都可读（成对 pin）。
- bookkeep 不再对同一路径整文件替换（结构性 pin：`persistHandoff` 的写入名与 `handoffName` 不同）。
- `round` 缺省的调用不产生 `.c.json` 畸形名（边界 pin）。

#### DependsOn
3

---

### Task 5: 本轮产物 unseal / seal 与无主 sweep

#### Objective

引擎载体落盘即只读（`0o444`）：preflight 只解封**本轮自己的产物路径**，收工（及每一条终态）重新 seal；下一轮 preflight 开头 sweep 该 slug 名下任何无主 unsealed 引擎产物。sidecar 永不 seal。

#### Files
- 新建：`packages/cdd-engine/src-next/infra/carrier-seal.ts`
- 新建：`packages/cdd-engine/src-next/infra/__tests__/carrier-seal.test.ts`
- 修改：`packages/cdd-engine/src-next/session/ledger.ts`（`persistHandoff` 写后 seal final 与 draft 名）
- 修改：`packages/cdd-engine/src-next/face/lifecycle.ts`（`#runDispatch` 在 acquire 前 unseal 本轮路径 + sweep；`#reject` 结束时 seal 草稿名；spawn 前门禁拒的返回前 seal；`--recover` abort 折账后 seal）
- 修改：`packages/cdd-engine/src-next/session/run.ts`（`#bookkeep` 失败面：`carrierPath === null` 时仍 seal 本轮草稿名）

#### Consumes
- Task 4 的 `RoundNaming.finalPath` 与 `Ledger.handoffPath`
- `infra/workspace.ts#resolve`（工作区路径解析）

#### Produces
- `export class CarrierSeal`，静态方法：`static seal(target: string): void`（存在则 `chmodSync(target, 0o444)`）、`static unseal(target: string): void`（存在则 `chmodSync(target, 0o644)`）、`static sweep(directory: string, keep: readonly string[]): readonly string[]`（把该目录下 `*.json` 中模式为 `0o444` 且不在 `keep` 的**引擎产物**重新 seal 并返回被处理的文件名；返回空数组即无事可做）

#### Steps

- [ ] **Step 1: 写红测（权限）** — 临时目录写一文件，`seal` 后 `stat.mode & 0o777 === 0o444`；`unseal` 后 `0o644`；对不存在的路径两方法都不抛。

- [ ] **Step 2: 写红测（终态全覆盖）** — 四条夹具各断言收工后本轮草稿名与 final 都是 `0o444`：① 成功 bookkeep；② `#reject`（模拟非零退出）；③ spawn 前门禁拒；④ `--recover` abort 折账。第五条：fix 轮派发后，作为输入的上一轮 review 载体仍 `0o444`（unseal 范围不过宽）。

- [ ] **Step 3: 实现 `CarrierSeal`** — `chmodSync` + `try/catch` 忽略 `ENOENT`；`sweep` 用 `readdirSync` 过滤 `*.json`，跳过 `keep` 与 `.rulings.json`（sidecar 永不动）。

- [ ] **Step 4: 接线 preflight** — `#runDispatch` 在 `#inflight.acquire` 之前：`CarrierSeal.sweep(workspaceDir, [])`，随后 `unseal(handoffPath)` 与 `unseal(finalPath)`（本轮两名）。

- [ ] **Step 5: 接线收工与终态** — `Ledger.persistHandoff` 写完立即 `seal(finalPath)` 与 `seal(draftPath)`；`#reject` 返回前 `seal(handoffPath)`；门禁拒分支返回前同；abort 折账处 `seal(handoffPath)`；`#bookkeep` 的 `carrierPath === null` 分支 `seal(handoffPath)`。

- [ ] **Step 6: 全绿 + 提交** — `pnpm -C packages/cdd-engine exec vitest run src-next/infra src-next/session src-next/face` 全绿；typecheck exit 0；`git commit -m "feat(infra): seal round carriers and sweep orphaned unseals (#444)"`。

#### Acceptance
- 四条终态（成功 / stall-reject / 门禁拒 / recover-abort）收工后本轮载体均 `0o444`（四条独立 pin）。
- 输入载体在 fix 全程 `0o444`（范围不过宽 pin）。
- `sweep` 不触碰 `.rulings.json`（sidecar 永不 seal pin）。
- 下一轮 preflight 能恢复一个被外部 `chmod 644` 的旧载体（sweep 有效性 pin）。

#### DependsOn
4

---

### Task 6: 写回只绑本轮动过的字节

#### Objective

把 `reviewedRevision` 的收工写回从「绑当前字节」改为「仅当本轮 `dispatchBase..HEAD` 确实动过该文档才绑」；未动过保持旧绑定让 drift 留痕；未派发快照与 git 不可读分别按 present-facts 与 soft 观察处理。

#### Files
- 修改：`packages/cdd-engine/src-next/infra/git.ts`（新增 `pathsSince`）
- 修改：`packages/cdd-engine/src-next/session/run.ts:207-240`（`DispatchOutcome` 加 `touchedDoc`）、`:734-760`（写回判据）
- 修改：`packages/cdd-engine/src-next/face/lifecycle.ts`（`#runDispatch` 收工算 `touchedDoc`；`#recordOf` 不涉及）
- 修改：`packages/cdd-engine/src-next/session/__tests__/run.test.ts`、`packages/cdd-engine/src-next/infra/__tests__/infra.test.ts`

#### Consumes
- `infra/git.ts#commitsSince(cwd, base)`：既有 postmortem 读面（同一 base）
- `session/run.ts#recordReviewedDocRevision` / `#recordDocRevisionOf`：唯一 doc 腿写回体
- `DispatchOutcome.dispatchBase`：本轮派发基线

#### Produces
- `GitClient.pathsSince(cwd: string, base: string | null): Promise<readonly string[]>` — `git log --name-only --pretty=format: <base>..HEAD` 的行集，去重去空；非 repo / base 为 `null` → `[]`
- `DispatchOutcome.touchedDoc?: boolean | null` — `true` 动过、`false` 未动过、`null` git 不可读、`undefined` 未测量（hermetic / injected dispatcher）

#### Steps

- [ ] **Step 1: 写红测（路径命中）** — 临时 repo：提交 A 后派发，轮内提交改 `docs/x.md` → `pathsSince(base)` 含 `docs/x.md`；只改 `docs/y.md` 时不含 `docs/x.md`；`base = null` → `[]`。

- [ ] **Step 2: 写红测（写回判据）** — 四例：① `touchedDoc: true` → `reviewedRevisionOf` 等于收工字节（P24 语义保）；② `touchedDoc: false` → `reviewedRevisionOf` 仍是旧值，且随后 dry-run review 报 drift/open（不是 `unchanged`）；③ `touchedDoc: null` → 写回当前字节**且**本轮 `violations` 含一条 soft（观测面）；④ `touchedDoc` 缺省（injected dispatcher）→ 与今日一致（写回），零 soft。

- [ ] **Step 3: 运行红** — ② 与 ③ 失败（今日无条件写回、无 soft）。

- [ ] **Step 4: 实现 git 读面** — `GitClient.pathsSince` 用 `this.#git(cwd).log({ from: base, to: "HEAD", "--name-only": null })` 的 `diff`/`files` 面不可靠，改用 `raw(["log","--name-only","--pretty=format:","${base}..HEAD"])` 并按行切分；`try/catch` 返 `[]`。

- [ ] **Step 5: 实现判据** — `#runDispatch` 收工处（`#commitsSince` 旁）算：`docPath` = 本轮会被写回的文档路径（doc 腿用 `frame.target.doc`、branch 腿用 `planPath`、wave 腿不参与）；`base === null` → `touchedDoc: null`；否则 `pathsSince(base).includes(rel(docPath))`。`#bookkeep` 的 `leg !== null` 分支改为：`touchedDoc === false` → 跳过并**不**改行；`touchedDoc === null` → 照旧写回 + 推一条 `RoundViolation.soft("the round's own commits were unreadable — the reviewed revision was bound to the current bytes", "unknown")`；其余照旧。

- [ ] **Step 6: 全绿 + 提交** — `pnpm -C packages/cdd-engine exec vitest run src-next/session src-next/infra src-next/face` 全绿；typecheck exit 0；`git commit -m "fix(session): bind the reviewed revision only to bytes this round touched (#446)"`。

#### Acceptance
- 四例判据各自独立 pin；② 的验收以「后续 review 报 drift」而非仅字段值断言（行为面）。
- `review` / `fix` / `branch-review` 三相位共用同一判据（`ReviewedIdentity.legOf` 未改，写回门在 `#bookkeep` 单点）。
- 免审区口径不变：既有「front matter / `## Change history` / version 头改动不算 drift」pin 全绿。

#### DependsOn
none

---

### Task 7: changeset 与全门

#### Objective

为本次消费面变更落 changeset，跑通完整校验门，并把 P31 两条缺口修法的交付证据固定在仓库状态里。

#### Files
- 新建：`.changeset/p31-ledger-disk-integrity.md`
- 修改：`docs/kairos/specs/2026-10-10-engine-doc-tooling-p31-design.md`（`## Change history` 追加 v0.3 行：实现期回填，若有）

#### Consumes
- 前六任务的实现面
- `.changeset/README.md` 的级别规则（D74：方法论未变 ⇒ minor）

#### Produces
- changeset 文件：`@oscaner-skills/cdd-engine` 一条 `minor`，正文三句（sidecar rulings · carrier 摘要与只读 · 条件写回）与一句 header 列集门

#### Steps

- [ ] **Step 1: 写 changeset** — `---\n"@oscaner-skills/cdd-engine": minor\n---\n\n` + 四句（载体 sidecar 与 `INPUT_RULINGS` · 载体 sha 与 `carrier-mismatch` · draft/final 分路径与只读 · reviewed revision 只绑本轮字节 · change-history 表头列集门）。

- [ ] **Step 2: 跑全门** — `pnpm run validate`；期望 exit 0（root · kairos · engine · typecheck ×3 · version-sync · emit fresh · 零裸函数）。

- [ ] **Step 3: 修红或报告** — 红则按失败项修；修不动的 BLOCKED 交回，不掩盖。

- [ ] **Step 4: 提交** — `git add .changeset docs/kairos` + `git commit -m "chore(cdd-engine): changeset and full gate for P31"`。

#### Acceptance
- `pnpm run validate` exit 0。
- `.changeset/*.md` 中 `@oscaner-skills/cdd-engine` 为 `minor`，无 `major`（`scripts/__tests__/changeset-levels.test.ts` 绿）。
- `pnpm run emit:check` 无 drift。

#### DependsOn
1,2,3,4,5,6

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-11-09 | 初版：七任务（表头列集门 · sidecar+INPUT_RULINGS · 摘要与 mismatch · draft/final 分路径 · seal/sweep · 条件写回 · changeset 与全门）· 波序 W1{1,2,6}/W2{3}/W3{4}/W4{5}/W5{7} 对应 spec 落地序 · Review Focus 六条 | Claude（kairos:cdd-plan · 2026-11-09） |