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
- `face/lifecycle.ts#reviewsPath(frame)`：fix 轮的载体绝对路径（`null` off-face）
- `render/templates.ts` 的 `TOKENS` 行形状 `{ name, zone }` 与空值行丢弃行为（assembler 丢空 token 行）

#### Produces
- `export class CarrierRulings`，静态方法：
  - `static pathFor(carrierPath: string): string` — 结尾 `.json` 换 `.rulings.json`（非 `.json` 结尾原样加 `.rulings.json`）
  - `static read(carrierPath: string): { readonly rulings: readonly Ruling[] } | null` — 文件不存在 → `null`
  - `static verdict(carrierPath: string, findingIds: ReadonlySet<string>): RulingVerdict`，`RulingVerdict = { kind: "absent" } | { kind: "ok"; rulings } | { kind: "invalid"; reason }`
- `export interface Ruling { readonly finding: string; readonly ruling: string; readonly at?: string; readonly by?: string }`
- 新 `FIX_READBACK_SUFFIX` 字面：`"(confirm the reviews handoff · if a finding needs a ruling, record it beside that handoff — same path with .json replaced by .rulings.json)"`



- 写失败测 `carrier-rulings.test.ts`：`pathFor` 两种入参、缺文件 `absent`、合法文件 `ok`、五条 `invalid`（非 JSON · `rulings` 非数组 · 条目缺 `ruling` · 未知顶层键 · `finding` 不在 carrier id 集）— checkable: 定向 vitest 该文件 FAIL（模块不存在）
- 实现 `session/carrier-rulings.ts`：`pathFor` 换后缀 · `read` 只在文件存在时解析 · `verdict` 三态并逐条给 reason · 白名单拒未知键 — checkable: 上一步全 PASS，typecheck exit 0
- 写失败测（渲染面）：有 sidecar 夹具时 fix prompt 含裁定正文；无 sidecar 时 prompt 零 `INPUT_RULINGS` 字面；review 轮（`op !== "fix"`）零该字面 — checkable: 定向 vitest FAIL（`TOKENS` 无该行）
- `render/templates.ts` 的 `TOKENS` 加 `{ name: "INPUT_RULINGS", zone: "round-context" }`，fix 与 docs-fix 的 `roundContext` 在 `INPUT_REVIEWS` 之后加该行；`face/lifecycle.ts#valuesOf` 填 `op === "fix"` 时按 `CarrierRulings.verdict` 推导路径、其余空串 — checkable: 上一步三例 PASS，且空值行被既有 assembler 丢弃（prompt 内零该字面）
- 派发前硬停：`#runDispatch` 在 `#inflight.acquire` 之前对 `invalid` 走 `#blocked` 并返回 `{ status: "BLOCKED", violations: [RoundViolation.hard(reason)] }` — checkable: 坏 sidecar 夹具下 dispatcher 零调用（注入 dispatcher 的 spy 计数为 0）
- `session/next.ts` 的 `FIX_READBACK_SUFFIX` 改为指向 sidecar 的新字面；`cli.test.ts` 七处 anchors 整体重锚 — checkable: `cli.test.ts` 四条 fix 的 `next:` 断言 PASS，且全库 `FIX_READBACK_SUFFIX` 引用零字面复制
- 提交 — checkable: `git log -1 --oneline` 含本任务主题

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



- 写失败测 `carrier-integrity.test.ts`：`sha256` 固定串已知 hex · `mismatch` 四例（`null` 任一端 · 同值 · 异值两端）— checkable: 定向 vitest FAIL（模块不存在）
- 写失败测（三态）：写 carrier 并记 digest → 未改字节可读 · 删文件返 `null` · 改字节抛 `CarrierMismatchError` 且报文含 `recorded=`/`current=` · 旧记录无 digest 时即便改字节也不抛 — checkable: 定向 vitest FAIL（今日 `readHandoff` 无 digest 面）
- `infra/workspace.ts` 拆出 `writeJsonHashed(name, value): string`（返回写入字节 sha256），`writeJson` 改为其薄壳；`#{persist}` 返回该 digest — checkable: 既有 `infra.test.ts` 全绿（写盘字节零变化），新方法单测 PASS
- `RoundRecord` 加 `carrierDigest?: string | null`、`recordRound` 透传；`#bookkeep` 存 digest；`readHandoff` 读到对象后取该 (op,type,round) 最新记录的 digest 比对，不等即抛 — checkable: 三态四例 PASS
- 两条通道接线：`face/cli.ts` 顶层捕获该错误走 `CDD_BLOCKED` 通道与既有 blocked 退出码；`face/lifecycle.ts#reconstruct` 捕获转 BLOCKED outcome — checkable: 篡改载体后 fix 派发前被拒且 dispatcher 零调用；board/capsule 读同一路径同判
- 提交 — checkable: `git log -1 --oneline` 含本任务主题

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

定稿不再覆盖草稿：final 写 `<stem>.c<N>.json`（N = 该轮 cycle），草稿留在派发原路径；`RoundRecord` 同时记 `carrierPath`（final）与 `draftPath`，digest 改为对 final 字节，且 final JSON 本体带同值 `contentSha256` 字段（spec §2.3 的两处记录面）。

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
- final JSON 的内嵌字段 `contentSha256: string`（与返回的 `digest`、`RoundRecord.carrierDigest` 三者同值）



- 写失败测（命名）：`finalName("review","wave",{tasks:"1",round:2}) === "tasks-1-review-2.c2.json"` 与 `finalName("fix","phase-spec",{round:3}) === "phase-spec-fix-3.c3.json"`；`round` 缺省时回落 `handoffName`，不产 `.c.json` — checkable: 定向 vitest FAIL（方法不存在）
- 写失败测（共存与三处同值）：bookkeep 后草稿名与 `.c<N>.json` 并存 · 记录 `carrierPath`=final 与 `draftPath`=草稿 · final 内 `contentSha256`、返回 `digest`、记录 `carrierDigest` 三者相等且等于 final 最终字节 sha256 · 删草稿后经 final 仍可读 — checkable: 定向 vitest FAIL
- `RoundNaming` 加 `finalName` / `finalPath`（`params.round` 拼 `.c<N>`，缺 `round` 回落）— checkable: 命名两例 PASS
- `persistHandoff` 写 final、对已写字节算 digest、把 `contentSha256` 补进该 JSON、对补写后的最终字节重算 digest 并返回 `{ path, draftPath, digest }`；**不写不删草稿**（代码注释写明「digest 必须覆盖含该字段的字节」）— checkable: 共存三处同值例 PASS
- `RoundRecord` 加 `draftPath?: string | null`，`#bookkeep` 与 `carrierDigest` 同笔落记录 — checkable: 记录两路径例 PASS，typecheck exit 0
- 提交 — checkable: `git log -1 --oneline` 含本任务主题

#### Acceptance
- final 与 draft 同名 stem、不同后缀，且 `RoundRecord` 两路径都可读（成对 pin）。
- final 文件内 `contentSha256`、返回的 `digest`、记录 `carrierDigest` 三者同值，且等于 final 最终字节的 sha256（三处同值 pin）。
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



- 写失败测 `carrier-seal.test.ts`：`seal` 后 `stat.mode & 0o777 === 0o444`、`unseal` 后 `0o644`、不存在路径两方法不抛 — checkable: 定向 vitest FAIL（模块不存在）
- 写失败测（终态四条 + 一条范围）：成功 bookkeep · `#reject` · spawn 前门禁拒 · `--recover` abort 各自收工后本轮草稿与 final 均 `0o444`；fix 派发全程作为输入的上一轮 review 载体仍 `0o444` — checkable: 定向 vitest FAIL
- 实现 `infra/carrier-seal.ts`：`seal`/`unseal` 走 `chmodSync` 并吞 `ENOENT`；`sweep(directory, keep)` 只处理 `*.json`、跳过 `keep` 与 `.rulings.json`，重新 seal 并返回处理的文件名 — checkable: 权限三例 PASS
- preflight 接线：`#runDispatch` 在 `#inflight.acquire` 之前 `sweep(workspaceDir, [])` + `unseal(handoffPath)` + `unseal(finalPath)` — checkable: 范围例 PASS（输入载体未被解封）
- 收工与终态接线：`persistHandoff` 写完 seal final 与草稿名；`#reject`／门禁拒／abort 折账／`#bookkeep` 的 `carrierPath === null` 分支各 seal 一次 — checkable: 终态四条 PASS
- 提交 — checkable: `git log -1 --oneline` 含本任务主题

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



- 写失败测（git 读面）：临时 repo 提交 A 后轮内提交改 `docs/x.md` → `pathsSince(base)` 含之；只改 `docs/y.md` 时不含；`base=null` → `[]` — checkable: 定向 vitest `infra.test.ts` FAIL（方法不存在）
- 写失败测（写回判据四例）：`touchedDoc:true` 绑收工字节 · `false` 保持旧值且随后 dry-run 报 drift/open · `null` 绑当前且本轮 violations 含一条 soft · 缺省（injected）与今日一致零 soft — checkable: 定向 vitest `run.test.ts` FAIL（②③ 今日不成立）
- `infra/git.ts` 加 `pathsSince(cwd, base)`：`git log --name-only --pretty=format: <base>..HEAD` 按行切、去重去空、`try/catch` 返 `[]` — checkable: 三例 PASS
- `DispatchOutcome` 加 `touchedDoc?: boolean | null`；`#runDispatch` 在 `#commitsSince` 旁算（doc 腿用 `frame.target.doc`、branch 腿用 `planPath`、wave 腿不参与；`base===null` → `null`）— checkable: typecheck exit 0，三腿分支各有一条用例
- `#bookkeep` 写回门改为三态：`false` 跳过不改行 · `null` 照旧写回 + 推 `RoundViolation.soft(...)` · 其余照旧 — checkable: 四例 PASS，既有 P24「fix 自产不算 drift」pin 全绿
- 提交 — checkable: `git log -1 --oneline` 含本任务主题

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