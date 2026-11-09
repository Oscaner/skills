---
title: 引擎文档工具（Engine Doc-Tooling）— P31 计划：账本事实与磁盘一致性
doc-type: plan
version: v0.5
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

- 写失败测 `change-history-header.test.ts` 五例（四列零 finding · 多一列一条 · 少一列一条 · `Date` 大写列名一条 · 无节零 finding）— checkable: 定向 vitest 该文件 FAIL（`ChangeHistoryHeaderColumnsInvariant` 未定义）
- 在 `ChangeHistoryRowShapeInvariant` 之后加 `CHANGE_HISTORY_COLUMNS` 常量与新 invariant 类：`headerRow` 为 `null`/空返 `[]`，否则 `trim` 后逐格比长度与文案，不等即 `this.finding(ctx, "Change history", …)` 一条 — checkable: 上一步五例 PASS，`pnpm exec tsc --noEmit -p packages/cdd-engine` exit 0
- `contract/rules.ts` 在 `change-history-row-shape` 行之后登记 `{ scope: "doc", id: "change-history-header-columns", docKeys: "all", create }`；`rules.test.ts` 登记表快照按新行更新 — checkable: `rules.test.ts` 快照断言 PASS（缺登记行即红）
- `render/templates.ts` 的 docs-fix 固定前缀补一句：summary 内字面竖线须写 `\|`（与既有 change-history 两句相邻） — checkable: 定向 vitest 的模板子串断言 PASS（今日该句零命中）
- `doc-corpus.guard.test.ts` 的 `PINNED_KINDS` 加该 kind、`DRIFT_CEILING` 加空表 `{}`、`PROGRAM_DOCS` 加 P31 spec 与 plan 两条并在 `findingsOn` 断言里加该 kind — checkable: `excessOver("change-history-header-columns", {})` 为空且 PROGRAM_DOCS 两条各 0 条，全测 PASS
- 提交 — checkable: `git log -1 --oneline` 含本任务主题

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
- `face/lifecycle.ts#reviewsPath(frame)`：fix 轮的载体绝对路径（`null` off-face；Task 4 之后该值改为记录里的 final 路径，见 Task 4 Produces）
- `render/templates.ts` 的 `TOKENS` 行形状 `{ name, zone }` 与空值行丢弃行为（assembler 丢空 token 行）

#### Produces
- `export class CarrierRulings`，静态方法：
  - `static pathFor(carrierPath: string): string` — 结尾 `.json` 换 `.rulings.json`（非 `.json` 结尾原样加 `.rulings.json`）
  - `static read(carrierPath: string): { readonly rulings: readonly Ruling[] } | null` — 文件不存在 → `null`
  - `static verdict(carrierPath: string, findingIds: ReadonlySet<string>): RulingVerdict`，`RulingVerdict = { kind: "absent" } | { kind: "ok"; rulings } | { kind: "invalid"; reason }`
- `export interface Ruling { readonly finding: string; readonly ruling: string; readonly at?: string; readonly by?: string }`
- 新 `FIX_READBACK_SUFFIX` 字面：`"(confirm the reviews handoff · if a finding needs a ruling, record it beside that handoff — same path with .json replaced by .rulings.json)"`



#### Steps

- 写失败测 `carrier-rulings.test.ts`：`pathFor` 两种入参、缺文件 `absent`、合法文件 `ok`、九条 `invalid`（非 JSON · 缺 `rulings` 键 · `rulings` 非数组 · 条目缺 `finding` · 条目缺 `ruling` · 未知顶层键 · 条目出现未知键 · `finding` 不在 carrier id 集 · `carrier` 键存在但 ≠ 载体文件名）— checkable: 定向 vitest 该文件 FAIL（模块不存在）
- 实现 `session/carrier-rulings.ts`：`pathFor` 换后缀 · `read` 只在文件存在时解析 · `verdict` 三态并逐条给 reason · 顶层与 ruling 两级白名单拒未知键 · `carrier` 出现时须等于载体文件名 — checkable: 上一步全 PASS，typecheck exit 0
- 写失败测（渲染面）：有 sidecar 夹具时 fix prompt 含裁定正文；无 sidecar 时 prompt 零 `INPUT_RULINGS` 字面；review 轮（`op !== "fix"`）零该字面 — checkable: 定向 vitest FAIL（`TOKENS` 无该行）
- `render/templates.ts` 的 `TOKENS` 加 `{ name: "INPUT_RULINGS", zone: "round-context" }`，fix 与 docs-fix 的 `roundContext` 在 `INPUT_REVIEWS` 之后加该行；`face/lifecycle.ts#valuesOf` 填 `op === "fix"` 时按 `CarrierRulings.verdict` 推导路径、其余空串 — checkable: 上一步三例 PASS，且空值行被既有 assembler 丢弃（prompt 内零该字面）
- 派发前硬停：`#runDispatch` 在 `#inflight.acquire` 之前对九种 `invalid` 任一种走 `#blocked` 并返回 `{ status: "BLOCKED", violations: [RoundViolation.hard(reason)] }` — checkable: 坏 sidecar 夹具下 dispatcher 零调用（注入 dispatcher 的 spy 计数为 0）
- `session/next.ts` 的 `FIX_READBACK_SUFFIX` 改为指向 sidecar 的新字面；`cli.test.ts` 七处 anchors 整体重锚 — checkable: `cli.test.ts` 四条 fix 的 `next:` 断言 PASS，且全库 `FIX_READBACK_SUFFIX` 引用零字面复制
- 提交 — checkable: `git log -1 --oneline` 含本任务主题

#### Acceptance
- `CarrierRulings.pathFor` 与 spec §2.1 的 `.json → .rulings.json` 规则一致（成对 pin：draft 名与 `.cN` 名两种输入）。
- 有 sidecar 的 fix 渲染含裁定正文；无 sidecar 时 prompt 内零 `INPUT_RULINGS` 字面（成对 pin）。
- sidecar 九种坏形态（缺 `rulings` · 非 JSON · `rulings` 非数组 · 条目缺 `finding` · 条目缺 `ruling` · 未知顶层键 · 条目未知键 · `finding` 不在 carrier id 集 · `carrier` ≠ 载体文件名）各自单独一枚用例，均在派发前 `CDD_BLOCKED` 且 dispatcher 零调用（逐例单独断言，不合并成一枚）。
- review 轮（`op !== "fix"`）的 round-context 零 `INPUT_RULINGS`。

#### DependsOn
none

---

### Task 3: 载体内容摘要与 `carrier-mismatch`

#### Objective

载体落盘时把规范载荷摘要（`CarrierIntegrity.digestOf`，单点规则）记进 `RoundRecord.carrierDigest`；凡引擎读载体的入口先经同一校验读比对，不匹配即 `CDD_BLOCKED` 并打印 `carrier-mismatch · line=<path> · recorded=<sha8> · current=<sha8>`，且不启动 child。三态严格区分：absent / ok / mismatch。校验读是**单点**（`CarrierIntegrity.read` / `readFor`）：`Ledger.readHandoff`、fix 输入的裁定读（`FixDispositions.requesterInputOf`）、board/capsule 的 `+N` 计数读（`BoardView.#findingsCountOf`）三处读入口全部走它，读面无第二条 `readFileSync` 裸读；`#runDispatch` 在 `#inflight.acquire` 与 spawn 之前就做同一次校验读，篡改因此挡在 child 存在之前，`#reconstruct` 与 `cli.ts` 的捕获只作退路。

#### Files
- 新建：`packages/cdd-engine/src-next/session/carrier-integrity.ts`
- 新建：`packages/cdd-engine/src-next/session/__tests__/carrier-integrity.test.ts`
- 修改：`packages/cdd-engine/src-next/infra/workspace.ts:181-186`（`writeJson` 拆出 `writeJsonHashed`）
- 修改：`packages/cdd-engine/src-next/session/ledger.ts:1564-1572`（`persistHandoff` 返回 `{ path, digest }`）、`:113-135`（`RoundRecord` 加 `carrierDigest`）、`:1606-1608`（`readHandoff` 校验）、`:646-648`（`#persist` 返回字节串）
- 修改：`packages/cdd-engine/src-next/session/run.ts:702-717`（`persistHandoff` 新返回形状 + 记录 `carrierDigest`）
- 修改：`packages/cdd-engine/src-next/face/cli.ts`（捕获 `CarrierMismatchError` → CDD_BLOCKED 通道 + 既有 blocked 退出码）
- 修改：`packages/cdd-engine/src-next/face/lifecycle.ts:585-609`（`#runDispatch` 在 `#inflight.acquire` 之前做 fix 输入载体的校验读，不匹配走 `#blocked` 并返回 BLOCKED，不 acquire 不 spawn）、`:1041-1100`（`#reconstruct` 捕获 → BLOCKED outcome，退路而非门）
- 修改：`packages/cdd-engine/src-next/contract/completion-criterion.ts:358-392`（`FixDispositions.requesterInputOf` 改走同一校验读；mismatch 不得折叠成 `kind: "unreadable"`）
- 修改：`packages/cdd-engine/src-next/face/board-view.ts:368-380`（`#findingsCountOf` 改走同一校验读；absent 仍 0，mismatch 抛出）
- 修改：`packages/cdd-engine/src-next/face/__tests__/lifecycle.test.ts`、`packages/cdd-engine/src-next/face/__tests__/board-view.test.ts`、`packages/cdd-engine/src-next/contract/__tests__/completion-criterion.test.ts`、`packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（spawn 前门与逐面读入口的行为 pin）

#### Consumes
- `infra/workspace.ts#writeJson`：`ensure()` → `#normalizePaths` → `#atomic.write(resolve(name), JSON.stringify(normalized, null, 2) + "\n")`
- `session/run.ts#bookkeep`：`carrierPath = this.#ledger.persistHandoff(op, frame.type, frame.params, carrier)`
- `session/ledger.ts#readHandoff`（`:1606-1608`）：今日经私有 `#read<T>` 裸读载体，无摘要比对
- `contract/completion-criterion.ts#requesterInputOf`（`:358-392`）与 `face/board-view.ts#findingsCountOf`（`:368-380`）：今日各自 `readFileSync` + `JSON.parse` 裸读 `carrierPath`（分别为 `--reviews` / 记录路径），两处都绕过 `readHandoff`
- `face/lifecycle.ts#runDispatch`（`:585-609`）：`#inflight.acquire`（`:609`）之前只渲染 prompt，无任何载体读 —— 今日 tamper 只能在 child 返回后的 `#reconstruct` 才被看见，而 `#reconstruct` 今日连摘要面都没有

#### Produces
- `export class CarrierIntegrity`，静态方法：
  - `static sha256(bytes: string): string` — 原始字节的 sha256 hex
  - `static digestOf(value: unknown): string` — 载体摘要的**唯一规则**：删去顶层可选 `contentSha256` 键，按 `JSON.stringify(payload, null, 2) + "\n"` 重序列化，取 `sha256`。draft 无该键时与写盘字节同值；final 有该键时摘要覆盖 payload 而非文件字节（Task 4 复用，非循环）
  - `static mismatch(recorded: string | null, current: string | null): { recorded: string; current: string } | null` — 任一 `null` → `null`（无从比对）
  - `static read(path: string, recordedDigest: string | null): string | null` — **唯一校验读**：文件不存在 → `null`（absent，不抛）；`recordedDigest === null`（legacy 记录）→ 原样返回字节、零比对（present facts）；两者皆有则按 `digestOf(解析结果)` 重算并比对，不等抛 `CarrierMismatchError`（mismatch）
  - `static readFor(record: { readonly carrierPath: string | null; readonly carrierDigest?: string | null }): string | null` — `read` 的记录形薄壳（`carrierPath === null` → `null`）。只依赖结构类型、不 import `ledger`，故 `contract/` 与 `face/` 两侧都能直接用，无循环依赖
- `export class CarrierMismatchError extends Error`，字段 `readonly line: string; readonly recorded: string; readonly current: string`，`message` = `carrier-mismatch · line=<line> · recorded=<sha8> · current=<sha8>`
- `Workspace.writeJsonHashed(name: string, value: unknown): string`（返回写入字节的 sha256 hex）；`writeJson` 改为 `writeJsonHashed` 的薄壳（单点序列化）
- `Ledger.persistHandoff(...): { readonly path: string; readonly digest: string }`
- `Ledger.readHandoff`：同名读先取该 (op,type,round) 最新记录的 `carrierDigest`，再走 `CarrierIntegrity.read(path, digest)`，最后解析 —— 摘要规则只此一处，不另写 hash 分支
- `FixDispositions.requesterInputOf`：requester 载体经 `CarrierIntegrity.readFor(requester 记录)`（legacy 回落 `--reviews` 路径时摘要为 `null`、不比对）；mismatch 抛出，**不**折叠成 `kind: "unreadable"`
- `BoardView.#findingsCountOf`：`CarrierIntegrity.readFor(record)`；absent 仍返 0（present facts），mismatch 抛出 → CLI 顶层通道转 `CDD_BLOCKED`（不再静默成 0）



#### Steps

- 写失败测 `carrier-integrity.test.ts`：`sha256` 固定串已知 hex · `mismatch` 四例（`null` 任一端 · 同值 · 异值两端）— checkable: 定向 vitest FAIL（模块不存在）
- 写失败测（三态）：写 carrier 并记 digest → 未改字节可读 · 删文件返 `null` · 改字节抛 `CarrierMismatchError` 且报文含 `recorded=`/`current=` · 旧记录无 digest 时即便改字节也不抛 — checkable: 定向 vitest FAIL（今日 `readHandoff` 无 digest 面）
- `infra/workspace.ts` 拆出 `writeJsonHashed(name, value): string`（返回写入字节 sha256），`writeJson` 改为其薄壳；`#{persist}` 返回该 digest（draft 无 `contentSha256`，故与 `CarrierIntegrity.digestOf` 同值）— checkable: 既有 `infra.test.ts` 全绿（写盘字节零变化），新方法单测 PASS
- `RoundRecord` 加 `carrierDigest?: string | null`、`recordRound` 透传；`#bookkeep` 存 digest；`CarrierIntegrity` 加 `read` / `readFor` 两个校验读；`readHandoff` 取该 (op,type,round) 最新记录的 `carrierDigest` 后走 `CarrierIntegrity.read` 再解析（同一规则，不另写 hash 分支）— checkable: 三态四例 PASS
- 写失败测（spawn 前门，行为 pin）：篡改 fix 输入载体（上一轮 review 载体）后 `cdd fix` **在 child 存在之前**硬停 —— stderr 含 `CDD_BLOCKED` 与 `recorded=` / `current=` 两段前缀，注入 dispatcher 的 spy 调用计数为 0，且 `InFlight.inspect()` 为空（未 acquire）— checkable: 定向 vitest FAIL（今日 `#runDispatch` 不读载体）
- `#runDispatch` 在 `#inflight.acquire` 之前插入该门：`op === "fix"` 且 `#reviewsPath(frame) !== null` 时，取同轮 review 记录的 `carrierDigest`（无记录 → `null`，present-facts 零比对），`CarrierIntegrity.read` 抛 `CarrierMismatchError` 即 `#blocked(err.message, false)` 并返回 `{ status: "BLOCKED" }`（不 acquire、不 spawn）。其余 op 派发前不读既有载体（`INPUT_REVIEWS` 本就是 `op === "fix"` 专属），无门可设 — checkable: 上一步 PASS
- 写失败测（逐面读入口，行为 pin 各一枚）：board/capsule 的 `+N` 计数读与 `FixDispositions.requesterInputOf` 的裁定读分别篡改各自读到的载体后均 `CDD_BLOCKED` 且报文含 recorded/current；absent 仍走 present-facts（board 0 · fix 输入 `unreadable`）— checkable: 定向 vitest FAIL（今日两处裸读：篡改只读成 0 / `unreadable`）
- 逐面接线：`BoardView.#findingsCountOf` 改 `CarrierIntegrity.readFor(record)`（absent → 0，mismatch 抛出）；`FixDispositions.requesterInputOf` 改 `CarrierIntegrity.readFor(requester 记录)`，legacy 回落 `--reviews` 路径且无摘要不比对，mismatch 抛出而不折叠成 `kind: "unreadable"` — checkable: 上一步两例 PASS，`board-view.test.ts` / `completion-criterion.test.ts` 既有断言全绿
- 退路接线（不是门）：`face/cli.ts` 顶层捕获该错误走 `CDD_BLOCKED` 通道与既有 blocked 退出码；`face/lifecycle.ts#reconstruct` 捕获转 BLOCKED outcome — checkable: 直调 `#reconstruct` 的用例仍 `CDD_BLOCKED`（child 已存在时的最后一道，非本任务的验收门）
- 提交 — checkable: `git log -1 --oneline` 含本任务主题

#### Acceptance
- absent / ok / mismatch 三态各有独立 pin；absent 与 mismatch 不得合并成同一返回值。
- 篡改后的载体在 fix 派发前被拒（行为 pin）：stderr `CDD_BLOCKED` + 报文含 `recorded=` / `current=`，注入 dispatcher 的 spy 调用计数 0，`InFlight.inspect()` 为空；门在 spawn 之前，`#reconstruct` / `cli.ts` 的捕获只是退路。
- 逐面读入口行为 pin（互不合并）：board/capsule 的 `+N` 计数读、fix 输入的裁定读，篡改各自载体后均 `CDD_BLOCKED` 且报文带 recorded/current；absent 两态仍按 present-facts 走（board 0 · fix `unreadable`），absent 与 mismatch 不可混同。
- 旧记录（无 `carrierDigest`）零迁移：既有 fixture 全绿，无新 mismatch。
- `carrier-mismatch` 报文含 `line` / `recorded` / `current` 三段（子串断言）。

#### DependsOn
2

---

### Task 4: draft 与 final 分路径（`<stem>.c<N>.json`）

#### Objective

定稿不再覆盖草稿：final 写 `<stem>.c<N>.json`（N = 该轮 cycle），草稿留在派发原路径；`RoundRecord` 同时记 `carrierPath`（final）与 `draftPath`，digest 改为对 final **载荷**（不含 `contentSha256` 字段）的摘要，且 final JSON 本体带同值 `contentSha256` 字段（spec §2.3 的两处记录面）。final 胜出这一身份口径贯穿全部读面：`--reviews` · `INPUT_REVIEWS` · `#reviewsPath` · 崩溃记录与 BLOCKED 的 resume 命令（`#resumeOf` 的 fix 分支）。

#### Files
- 修改：`packages/cdd-engine/src-next/session/round-naming.ts`（新增 `finalName` / `finalPath` / `isCarrierName`）
- 修改：`packages/cdd-engine/src-next/session/ledger.ts`（`persistHandoff` 写 final 并返回 `{ path, draftPath, digest }`；`RoundRecord` 加 `draftPath`；`recordRound` 透传；`round` 的两处 `reviewsPath` 改取该轮 review 记录已记的 `carrierPath`）
- 修改：`packages/cdd-engine/src-next/session/run.ts:702-717`（读新返回形状，记录两路径）
- 修改：`packages/cdd-engine/src-next/face/lifecycle.ts:1141-1151`（`#reviewsPath` 以记录 `carrierPath`（final）取代 `existsSync(draft)` 作胜者）、`:1424-1457`（`#resumeOf` 的 fix 分支 `--reviews` 改取 `#reviewsPath(frame)` 同一口径，不再自拼 `resolveHandoffPath`）
- 修改：`packages/cdd-engine/src-next/session/__tests__/ledger.test.ts`、`packages/cdd-engine/src-next/session/__tests__/run.test.ts`、`packages/cdd-engine/src-next/session/__tests__/next.test.ts`、`packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（`--reviews` / `INPUT_REVIEWS` 重锚到 final）

#### Consumes
- Task 3 的 `persistHandoff` 返回形状与 `carrierDigest` 记录
- `RoundNaming#stem(op, type, params)` 与 `handoffName(op, type, params)`
- `face/lifecycle.ts#reviewsPath`（`:1141-1151`）今日的三层回落：显式 `--reviews` 旗标 → `resolveHandoffPath("review", …)` → `existsSync(draft)` → legacy `null`
- `session/ledger.ts#round`（`:1839` / `:1858`）：`reviewsPath: this.resolveHandoffPath("review", type, reviewParams)` 是 `--reviews` 的唯一路由来源；`session/next.ts:341` / `:362` 只透传 `ref.reviewsPath`，故本任务不动 `session/next.ts`
- `face/lifecycle.ts#resumeOf`（`:1424-1457`）：fix 分支今日 `const findings = scene.ledger.resolveHandoffPath("review", frame.type, frame.params)` 自拼草稿家族名，与 `#reviewsPath` 不同源 —— draft 与 `.c<N>.json` 并存时 resume 命令指回草稿，resume 的 `--reviews` 与 sidecar stem 就此分叉

#### Produces
- `RoundNaming.finalName(op: string, type: string, params: HandoffParams): string` — 把 `handoffName` 结尾的 `.json` 换成 `.c<N>.json`，`N = params.round`
- `RoundNaming.finalPath(...)` — resolve 后的绝对路径
- `RoundNaming.isCarrierName(name: string): boolean` — 只认本引擎 mint 的两类名字（draft 家族 `<stem>-<op>-<round>.json` 与 final `<stem>-<op>-<round>.c<N>.json`，即 `handoffName` 尾部加可选 `.c<N>`）；`progress.json` / `base.json` / `*-test-evidence.json` / `*.rulings.json` 一律 `false`（Task 5 的 sweep 谓词单点）
- `Round.reviewsPath`（`session/ledger.ts#round` 两个分支）= 该轮 review 记录已记的 `carrierPath`（final 绝对路径）；记录缺失或该值为 `null`（legacy 行）才回落 `resolveHandoffPath` 的草稿家族名 —— 记录存在即 final 胜出
- `face/lifecycle.ts#reviewsPath(frame)` 四层同源：显式 `--reviews` 旗标 → 同轮 review 记录的 `carrierPath` → 今日的 `resolveHandoffPath` + `existsSync` 回落 → legacy `null`
- `face/lifecycle.ts#resumeOf(frame)` 的 fix 分支 = `#reviewsPath(frame) ?? resolveHandoffPath("review", …)` —— `null` 只在 legacy 记录且盘上无载体时出现，此时保留今日字面，绝不把 `null` 印进命令；崩溃记录与 BLOCKED 的 `next:` 因此与 fix prompt 同指一个载体
- `Ledger.persistHandoff(...): { readonly path: string; readonly draftPath: string; readonly digest: string }`
- final JSON 的内嵌字段 `contentSha256: string` — 值 = `CarrierIntegrity.digestOf(final 载荷)`，载荷**不含**该字段（规则来自 Task 3，单点不改）；与返回的 `digest`、`RoundRecord.carrierDigest` 三者同值，读回按同一规则「删 `contentSha256` → 重序列化 → sha256」比对，故该值**不**等于含该字段的整个文件字节 sha256



#### Steps

- 写失败测（命名）：`finalName("review","wave",{tasks:"1",round:2}) === "tasks-1-review-2.c2.json"` 与 `finalName("fix","phase-spec",{round:3}) === "phase-spec-fix-3.c3.json"`；`round` 缺省时回落 `handoffName`，不产 `.c.json` — checkable: 定向 vitest FAIL（方法不存在）
- 写失败测（共存与三处同值）：bookkeep 后草稿名与 `.c<N>.json` 并存 · 记录 `carrierPath`=final 与 `draftPath`=草稿 · final 内 `contentSha256`、返回 `digest`、记录 `carrierDigest` 三者相等且等于 `CarrierIntegrity.digestOf(删去 contentSha256 后的 final 载荷)`（断言不落在含该字段的文件字节上）· 删草稿后经 final 仍可读 — checkable: 定向 vitest FAIL
- `RoundNaming` 加 `finalName` / `finalPath`（`params.round` 拼 `.c<N>`，缺 `round` 回落）— checkable: 命名两例 PASS
- `persistHandoff` 一次组装 final 载荷：先 `digest = CarrierIntegrity.digestOf(payload)`（payload 尚无该字段）→ 把 `contentSha256: digest` 作为**最后追加键**并入 payload 并一次落盘 → 返回 `{ path, draftPath, digest }`（不二次重算）；**不写不删草稿**（代码注释写明「摘要覆盖 payload 而非含该字段的文件字节——`H = sha256(JSON 含 H)` 不可满足」）— checkable: 共存三处同值例 PASS
- `RoundRecord` 加 `draftPath?: string | null`，`#bookkeep` 与 `carrierDigest` 同笔落记录 — checkable: 记录两路径例 PASS，typecheck exit 0
- 写失败测（reviews 身份，成对 pin）：同轮 draft 与 `<stem>.c<N>.json` 并存时，`ledger.round("review", …).reviewsPath`、`next` 渲染的 `--reviews`、fix prompt 的 `INPUT_REVIEWS`、`#reviewsPath`、`#resumeOf` 生成的 `cdd fix … --reviews <path>` 五者都指 `.c<N>.json`，故 `CarrierRulings.pathFor` 得 `.c<N>.rulings.json`；删掉 final 后五者回落草稿名（legacy 回落例）— checkable: 定向 vitest FAIL（今日前三面指草稿，resume 另走自拼路径）
- 接线：`session/ledger.ts#round` 两条 `reviewsPath` 改为「记录 `carrierPath` 为字符串 → 用它；缺记录或为 `null` → 今日的 `resolveHandoffPath` 回落」；`face/lifecycle.ts#reviewsPath` 按 Produces 的四层顺序接线（`existsSync(draft)` 只在记录未给 final 时参与）；`#resumeOf` 的 fix 分支改读 `#reviewsPath(frame)`（走同一次四层顺序，只在得 `null` 时回落 `resolveHandoffPath`）— checkable: 上一步 PASS，`cli.test.ts` 与 `next.test.ts` 的 `--reviews` 断言重锚后全绿，typecheck exit 0
- 提交 — checkable: `git log -1 --oneline` 含本任务主题

#### Acceptance
- final 与 draft 同名 stem、不同后缀，且 `RoundRecord` 两路径都可读（成对 pin）。
- fix 输入身份落在 final（spec §2.1 / §2.3 同 stem）：draft 与 `.c<N>.json` 并存时 `--reviews` / `INPUT_REVIEWS` / `#reviewsPath` 名字段一律为 `.c<N>.json`，sidecar 因此是 `.c<N>.rulings.json`；崩溃记录 / BLOCKED 的 `next:`（`#resumeOf`）里的 `--reviews` 同指 `.c<N>.json`（与上述三面同源，不另拼路径）；final 缺失时各处回落草稿名且 legacy 行仍可读（成对 pin，resume 命令含在断言内）。
- `session/next.ts` 仍只改 `FIX_READBACK_SUFFIX` 一处字面（结构性 pin：本任务对该文件零 diff；`--reviews` 的身份改在 `Round.reviewsPath` 的构造处，不在路由表）。
- final 文件内 `contentSha256`、返回的 `digest`、记录 `carrierDigest` 三者同值，且等于 `CarrierIntegrity.digestOf` 对「删去 `contentSha256` 的 final 载荷」的重算值（三处同值 pin；摘要覆盖 payload 而非含该字段的文件字节，规则非循环）。
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
- Task 4 的 `RoundNaming.finalPath`、`RoundNaming.finalName`、`RoundNaming.isCarrierName` 与 `Ledger.handoffPath`
- `infra/workspace.ts#resolve`（工作区路径解析）
- slug 工作区里的非 carrier JSON（`progress.json` / `base.json` / `*-test-evidence.json` / 崩溃与日志邻接 JSON）——只作「必须零触碰」的反例夹具，不进 seal 面

#### Produces
- `export class CarrierSeal`，静态方法：`static seal(target: string): void`（存在则 `chmodSync(target, 0o444)`）、`static unseal(target: string): void`（存在则 `chmodSync(target, 0o644)`）、`static sweep(directory: string, keep: readonly string[]): readonly string[]`（只处理该目录下**名字被 `RoundNaming.isCarrierName` 认可**、且**未 seal**——模式非 `0o444`、即被外部 `chmod` 过的可写文件——的引擎 carrier，跳过 `keep` 与 `*.rulings.json`；`progress.json` / `base.json` / `*-test-evidence.json` 等非 carrier JSON **零触碰**。返回**实际被 seal 的文件名**；已 `0o444` 的不计入，返回空数组即无事可做）



#### Steps

- 写失败测 `carrier-seal.test.ts`：`seal` 后 `stat.mode & 0o777 === 0o444`、`unseal` 后 `0o644`、不存在路径两方法不抛 — checkable: 定向 vitest FAIL（模块不存在）
- 写失败测（终态四条 + 一条范围）：成功 bookkeep · `#reject` · spawn 前门禁拒 · `--recover` abort 各自收工后本轮草稿与 final 均 `0o444`；fix 派发全程作为输入的上一轮 review 载体仍 `0o444` — checkable: 定向 vitest FAIL
- 实现 `infra/carrier-seal.ts`：`seal`/`unseal` 走 `chmodSync` 并吞 `ENOENT`；`sweep(directory, keep)` 只处理 `RoundNaming.isCarrierName(name)` 为真**且可写**（模式非 `0o444`）的文件、跳过 `keep` 与 `*.rulings.json`，seal 后把该文件名计入返回值（已 `0o444` 的零改动、不返回）— checkable: 权限三例 PASS + 「644 恢复」一例 + 「非 carrier JSON 零触碰」一例（`progress.json` / `base.json` / `wave-1-test-evidence.json` 置 `0o644` 后 sweep 完仍 `0o644` 且不出现在返回值中）
- 写失败测（seal 面宽度）：上述非 carrier JSON 在 `sweep(workspaceDir, [])` 后模式与内容零变化，`.rulings.json` 同；同目录一枚被 `chmod 644` 的 final 与一枚无主 draft 则被收口 — checkable: 定向 vitest FAIL（今日 sweep 无名字谓词）
- preflight 接线：`#runDispatch` 在 `#inflight.acquire` 之前 `sweep(workspaceDir, [])` + `unseal(handoffPath)` + `unseal(finalPath)` — checkable: 范围例 PASS（输入载体未被解封）
- 收工与终态接线：`persistHandoff` 写完 seal final 与草稿名；`#reject`／门禁拒／abort 折账／`#bookkeep` 的 `carrierPath === null` 分支各 seal 一次 — checkable: 终态四条 PASS
- 提交 — checkable: `git log -1 --oneline` 含本任务主题

#### Acceptance
- 四条终态（成功 / stall-reject / 门禁拒 / recover-abort）收工后本轮载体均 `0o444`（四条独立 pin）。
- 输入载体在 fix 全程 `0o444`（范围不过宽 pin）。
- `sweep` 不触碰 `.rulings.json`（sidecar 永不 seal pin）。
- `sweep` 的作用域只到引擎 carrier 名（`RoundNaming.isCarrierName`）：`progress.json` / `base.json` / `*-test-evidence.json` 在 `0o644` 下零改动、不出现在返回值中（spec §2.4 的 seal 面即 draft/final，宽面 pin）。
- 下一轮 preflight 能恢复一个被外部 `chmod 644` 的旧载体（sweep 有效性 pin：其名出现在返回值中，且模式回到 `0o444`；同目录已 `0o444` 的载体模式不变、不出现在返回值中）。

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
- `GitClient.pathsSince(cwd: string, base: string | null): Promise<readonly string[] | null>` — `git log --name-only --pretty=format: <base>..HEAD` 的行集，去重去空；读成功零命中 → `[]`；`base` 为 `null`（无派发基线）、非 repo、git 不可读 → `null`（**不可**退化成 `[]`：空集与读不到是两种事实）
- `DispatchOutcome.touchedDoc?: boolean | null` — `true` 动过、`false` 未动过、`null` git 不可读、`undefined` 未测量（hermetic / injected dispatcher）



#### Steps

- 写失败测（git 读面）：临时 repo 提交 A 后轮内提交改 `docs/x.md` → `pathsSince(base)` 含之；只改 `docs/y.md` 时不含；真 repo 真 base 零改动提交 → `[]`；`base=null` → `null`；非 repo 目录 → `null`（后两例钉住 `null ≠ []`）— checkable: 定向 vitest `infra.test.ts` FAIL（方法不存在）
- 写失败测（写回判据四例）：`touchedDoc:true` 绑收工字节 · `false` 保持旧值且随后 dry-run 报 drift/open · `null` 绑当前且本轮 violations 含一条 soft · 缺省（injected）与今日一致零 soft — checkable: 定向 vitest `run.test.ts` FAIL（②③ 今日不成立）
- `infra/git.ts` 加 `pathsSince(cwd, base)`：`git log --name-only --pretty=format: <base>..HEAD` 按行切、去重去空；`base === null` 与 `try/catch`（spawn 失败 / 非 repo / 非零退出）一律返 `null`，仅成功读取才返数组 — checkable: 五例 PASS
- `DispatchOutcome` 加 `touchedDoc?: boolean | null`；`#runDispatch` 在 `#commitsSince` 旁算（doc 腿用 `frame.target.doc`、branch 腿用 `planPath`、wave 腿不参与；`base===null` → `null`；`pathsSince` 返 `null` 时同样落 `touchedDoc: null`——读不到不等于未动过）— checkable: typecheck exit 0，三腿分支各有一条用例
- `#bookkeep` 写回门改为三态：`false`（`[]`，读成功且零命中）跳过不改行 · `null`（不可读 / 无基线）照旧写回 + 推 `RoundViolation.soft(...)` · 其余照旧 — checkable: 四例 PASS，既有 P24「fix 自产不算 drift」pin 全绿
- 提交 — checkable: `git log -1 --oneline` 含本任务主题

#### Acceptance
- 四例判据各自独立 pin；② 的验收以「后续 review 报 drift」而非仅字段值断言（行为面）。`false` 只由 `[]`（读成功零命中）产生，`null`（不可读 / 无 base 基线）不与 `[]` 混用（类型级 + 用例级双 pin）。
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

- 写 changeset `.changeset/p31-ledger-disk-integrity.md`：`"@oscaner-skills/cdd-engine": minor` + 五句（sidecar 与 `INPUT_RULINGS` · 载体摘要与只读 · draft/final 分路径 · 条件写回 · 表头列集门）— checkable: `scripts/__tests__/changeset-levels.test.ts` PASS（无 major、级别齐备）
- `pnpm run validate` — checkable: exit 0（root · kairos · engine · typecheck ×3 · version-sync · emit fresh · 零裸函数）
- `pnpm run emit:check` — checkable: 无 drift 报告
- 红则按失败项修，修不动即 BLOCKED 交回（不掩盖、不放宽 ceiling） — checkable: validate 与 emit:check 同时 exit 0
- 提交 — checkable: `git log -1 --oneline` 含本任务主题

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
| v0.2 | 2026-11-09 | 评审回填（plan-review-1 F1–F5）：Task 2 坏 schema 用例扩到九面并补 `carrier` ≠ 文件名的派发前硬停 pin · Task 3 立 `CarrierIntegrity.digestOf` 单点摘要规则、Task 4 摘要改覆盖「删 `contentSha256` 后的载荷」以消循环（文件字节口径作废）· Task 5 `sweep` 改为处理未 seal 的 `*.json` 并返回实际 sealed 名 · Task 6 `pathsSince` 以 `null` 区分不可读与零命中、`touchedDoc: null` 保留 soft 观察 | Claude（kairos:cdd-dev · plan-fix-1 · 2026-11-09） |
| v0.3 | 2026-11-09 | 评审回填（plan-review-2 F1–F2）：Task 4 补 fix 输入身份接线——`Round.reviewsPath` / `#reviewsPath` 改取记录 `carrierPath`（final），`existsSync(draft)` 不再是胜者，sidecar 随同落 `.c<N>.rulings.json`，并补四者同名的成对 pin；Task 5 `sweep` 收窄到 `RoundNaming.isCarrierName` 认可的 draft/final 家族，`progress.json` / `base.json` / `*-test-evidence.json` 零触碰 | Claude（kairos:cdd-dev · plan-fix-2 · 2026-11-09） |
| v0.4 | 2026-11-09 | 评审回填（plan-review-3 F1–F3）：Task 3 立单点校验读 `CarrierIntegrity.read` / `readFor`，`readHandoff` · fix 裁定读 · board 计数读三面统一接线，spawn 前门放进 `#runDispatch`（`#inflight.acquire` 之前硬停、dispatcher 零调用、未 acquire），逐面行为 pin 取代结构性 pin；Task 4 把 `#resumeOf` 的 `--reviews` 与 `#reviewsPath` 同源到 final，身份 pin 扩到五面 | Claude（kairos:cdd-dev · plan-fix-3 · 2026-11-09） |
| v0.5 | 2026-11-09 | **closeout 登记（cdd-close）**：七任务五波全部交付——W1{1,2,6} `ad0f4181`/`c9cfe177`/`212c453e` + fix `d471f2ee` · W2{3} `19b56e7a`/`1fa59b2b` + fix `76f27d55`（review-2 零 finding）· W3{4} `8f2e1aa4`（零 finding） · W4{5} `5dbb8ad3` + fix `68ed5436` · W5{7} `b1fb2abf`（零 finding）· 分支终审 0 finding。实现期计划回填仅一处：Task 7 的 spec 行「追加 v0.3 若有」判为 **none**（spec 正文未动；加行会触发 `change-history-latest-matches-front-matter` 并逼 bump spec 版本，反过来证伪 Constraints 的「只实现 v0.2 所指的面」）。`pnpm run validate` exit 0（engine 73/1594）· changeset `cdd-engine` minor | Oscaner M. · Claude（kairos:cdd-close · closeout-backfill · 2026-11-09） |
