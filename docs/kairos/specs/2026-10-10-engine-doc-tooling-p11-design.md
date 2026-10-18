---
title: 引擎文档工具（Engine Doc-Tooling）— P11 设计：dispatch contract 收口（child Return 去结构化 + --dry-run 真只读预览）
doc-type: phase-spec
version: v0.2
date: 2026-10-18
status: Draft
author: Oscar M. · Claude Opus 5（kairos:cdd-design [P11] 会话 · 用户两项 mandate · 2026-10-18）
parent-program: 2026-10-10-engine-doc-tooling-overall.md
parent-version: v2.52
depends-on: P10（Done · v0.10 · hard——P10 全链闭合后 dispatch contract 收口 · overall 依赖图 D50）
---

## Design

本 phase 承接 P10 收口后的续 phase（2026-10-18 cdd-design [P11] 会话注册 D50），收口**引擎派发契约**上的三处失真——同一个根：**契约声明面与引擎实际消费/指称的面不是同一个东西**。

**其一，child Return 是一份死契约。** 模板 `RETURN_ZONE` 要求 child stdout 以固定两行收尾（`status: <APPROVED|BLOCKED>` / `artifacts: report=<path> test_evidence=<path>`），`CliLifecycle#dispatch` 也确实 grep `^status:\s*\S+`，缺则 `CDD_BLOCKED: child <cli> returned no status line`。但**查证现状：该结构今天已是死数据 + 一道 presence 门**——`#parseBlockReturn` 解析出的 `status` 零消费者（`#reconstruct` 的结论完全从 `Task 草稿` 的 declared status / findings rollup 派生）；stdout 的 `artifacts:` 在草稿回读成功时被 `#canonicalArtifacts` 逐槽覆盖（仅 hermetic 注入 dispatch 的 fallback 分支使用）。换句话说：引擎**唯一**从这两行拿走的，是「有没有 `status:` 这一行」这一个布尔。而 agent 的 stdout 形态极不稳定——一行排版漂移即制造一次无意义 BLOCK，用户为本轮 mandate 的原话。

**其二，`--dry-run` 声明的是只读，实际是写入 + 占槽。** `README.md` 写「simulate the dispatch without writing handoff artifacts」，而 `#dispatchOf` 在 `dryRun` 时替换为合成 `() => ({ status: "APPROVED", findings: [] })` 之后，**book 流程照常执行**：`#sceneOf` 的 `new Workspace(...).ensure()` 建目录 + 写 `.gitignore`、`migrateJsonChild` 改文件、`gate.renderBrief` 写 brief、`#bookkeep` 写 `<kind>-review-N.json` 并 `recordRound`。后果是 issue #345 记录的实害：一次例行试跑静默占掉文档唯一的 review 槽位，真实 review 被 `cannot dispatch a review round — already reviewed at vX` 拒绝，恢复路径只有 bump 版本。

**其三，`--findings` 是一处命名背离。** `cdd fix` 的输入旗标指向的是评审轮的**产出文档**——其 carrier 载 `findings` / `artifacts` / `notes` 三面（`session/handoff-schema.ts` 的 `CARRIER_FINDINGS`），而旗标自身的 help 早已写作 "the source review handoff JSON path"（`face/declare.ts:59`）：**声明名窄于实际指称**（§5 · D51）。

三处失真的同一根：**契约声明面与引擎实际消费/指称的面不是同一个东西**。本 phase 的判准即把两者对齐——child 契约只声明引擎真正消费的东西（没有），`--dry-run` 只做它声明的事（只读预览），输入旗标只指称它真正指向的物件（评审轮的产出文档）。

### 1. 目标与边界

#### 1.1 设计输入与授权

- **设计输入**：本会话问答全裁定（kairos:cdd-design [P11] · 用户逐题裁定 Q1–Q13 全按推荐）· 已回填 overall D50 + 四表（v2.51）。
- **重构授权**：用户六前提 mandate（1 允许破坏性变更 · 2 高维 OOP 抽象统一零裸函数 · 3 零技术债免散文堆砌免声明再抄 · 4 高内聚低耦合死码空壳清理 · 5 消费心智负担优先 · 6 最大重构整合最大精简 · 7 不造轮子优先第三方 pkg）。
- **会话期追加裁定（in-flight · 承 D50）**：dispatch 输入面命名收口——`--findings` → `--reviews` · `INPUT_FINDINGS` → `INPUT_REVIEWS`（D51 · 已回填 overall v2.52），见 §5。
- **程序记录**：out-of-band 热修面 = D51 命名收口（会话期 · 独立提交），其余裁定归 D50 主题内；issue #345 为唯一外部输入。

#### 1.2 判定基线

沿 D26 法条（一事实一处 · 判定时刻现读 · 副本永不具权威）在本 phase 的两个落点：

| 类 | 义 | 本 phase 实例 |
|---|---|---|
| **死契约** | 契约声明一项输入，引擎不消费它 | `RETURN_ZONE` 的 `status:`/`artifacts:` 两行 |
| **声明-行为背离** | 一个旗标的名字/文档与它的副作用不符 | `--dry-run` 写产物且占轮次 |
| **命名背离** | 一个旗标/令牌的名字与它指向的物件不是同一个东西 | `--findings` 指向评审轮的产出文档（§5） |

#### 1.3 保留面（冻结）

- **结论派生不变**：`HandoffSchema.conclusionOf` / `rollup` / `#reconstruct` 的草稿回读 + evidence 回读语义逐条不变——本 phase 只删 stdout 侧的并行通道，不动草稿侧。
- **异常 child 的拦截面不变**：非零退出码 → `BLOCKED`；草稿缺失/畸形/schema 违约 → `#reject` + crash record。删掉的只是「exit 0 且无 `status:` 行」这一条**冗余**门。
- **`next:` 字面 · 退出码表 0/1/2 · CDD_BLOCKED 通道**不变。
- **pre-flight 四门判定语义不变**（本 phase 只改它们在 dry-run 下的**写入副作用**，不改判据）。
- **D29 黑盒边界守约**：skill 文本零引擎内部实现镜像；本 phase 的 skill 面改动为零（模板是引擎发射面，不是 skill 文本）。
- **不发布**：changesets 收尾至可发布态即止。

### 2. A 组 · child Return 去结构化

#### 2.1 模板 `## Return` 改为纯散文

`render/templates.ts` 的 `RETURN_ZONE` 改为单个散文契约块（zone key 由 `RETURN_STDOUT_BLOCK` 更名为 **`RETURN_PROSE`**——语义单源；pin 重锚 deliberate）：

```markdown
## Return

Report in a few plain sentences what this round did, whether it succeeded, and — if it
did not — what blocked it. Nothing downstream parses this text; the handoff draft at
`OUTPUT_HANDOFF` is the round's machine-readable result. Do not emit key-value lines,
JSON, or any fixed block.

(fail: an uncaught failure → exit non-zero with a one-line reason)
```

- 散文**不转发**到 CLI stdout（stdout 是编排器的机器面，转发会污染抓取）；仅在 `BLOCKED` 时把尾部存入 crash record 的 `stdoutTail`（今日恒 `[]`——本次让它真正有内容）。
- `## Return` 小节保留（不整节删除）：它是 child 的收尾纪律，也是 host 日志的可读面。

#### 2.2 引擎侧删除清单

| 位置 | 删除物 | 理由 |
|---|---|---|
| `face/lifecycle.ts#parseBlockReturn` | 整个方法 | 死数据解析 |
| `face/lifecycle.ts#dispatch` | `if (!/^status:\s*\S+/m.test(result.stdout)) → BLOCKED` 门 | 冗余门（草稿缺失已由 `#reject` 更准确拦截） |
| `session/run.ts` `DispatchOutcome.artifacts` | 字段 + `#bookkeep` 的两处 `artifacts:` 传参 | 生产路径零消费者；hermetic 注入 dispatch 不再需要该槽（见 §2.3） |
| `render/templates.ts` `ReturnZone` 接口 + `returnFormats()` | 接口与内省方法 | 单块后无「多形态」可枚举 |
| `infra/__tests__/infra.test.ts` / `render/__tests__/render.test.ts` | `Object.keys(template.return)` / `returnFormats()` pin | 随删除物退役 |

**保留**：`result.code !== 0 → BLOCKED` 作为唯一进程信号；`#reconstruct` 的草稿 + evidence 回读通道原样。

#### 2.3 hermetic 注入 dispatch 的产物面

测试面的注入 dispatch 今天用 `artifacts` 字段向 `#bookkeep` 的 fallback 传产物。字段删除后，注入 dispatch 直接提供 **`carrier`**（`DispatchOutcome.carrier` 既有字段）表达产物，`#bookkeep` 的 fallback 只保留 `findings`（findings face）与空 work carrier 两条最简成型。**不接受第二种产物通道**——`carrier` 是引擎已声明的单一半成品面。

### 3. B 组 · `--dry-run` 真只读预览

#### 3.1 语义

`--dry-run` = **预览下一个派发步及其预期产物，对 repo 零写入、不占轮次**（issue #345 采纳方案 b）。它**不是**一次模拟运行，也不是 `--assume-approved`；它是一次**纯读的下一步预告**。

#### 3.2 零写入的边界（逐项关闭）

| 写点（今日 dry-run 会触发） | 处置 |
|---|---|
| `#sceneOf` 的 `new Workspace(...).ensure()` | **全局退休**（不只 dry-run）——`writeJson` 已自行 ensure，`Workspace.ensure()` 的显式调用是重复 |
| `#sceneOf` 的 `migrateJsonChild("progress.json"/"base.json")` | **全局退休**——P9 的读时归一化（`Workspace#normalizePaths`）已覆盖 straggler，migrate 的收益为零 |
| `gate.renderBrief`（`writeFileSync` brief） | dry-run 跳过；预览以 `reads: <path> (would re-render from the current plan)` 陈述 |
| `#bookkeep` 的 `persistHandoff` / `recordRound` / `recordReviewedRevision` / `recordReviewedBrief` | dry-run 跳过；预览以 `would record:` 陈述 |
| `#reject` 的 `writeCrash` | dry-run 跳过 |
| `#dispatchOf` 的 synthetic `() => ({ status: "APPROVED", findings: [] })` | **删除**——dry-run 不再派发、不再伪造结论 |

#### 3.3 预览输出形面

stdout 单块（无 `status:` / `next:` 行——不伪造 capsule）：

```
cdd review: preview (no repo changes)
  step:        review round 1 — wave 1
  reads:       .kairos/cdd/p3/tasks-1-brief.md (would re-render from the current plan)
  would write: .kairos/cdd/p3/tasks-1-review-1.json · .kairos/cdd/p3/tasks-1-review-1-report.md
  would record: progress.waves["1"].rounds.review += [1] · reviewedRevision(brief)
  child:       claude -p (host: claude-code)
```

- `child:` 行展示 host 检测结果：`claude -p (host: claude-code)` 或 `(no host detected — real run would BLOCK)`。预览**不依赖** host 检测（不 spawn child）。
- 不打印 `next:`：`next` 取决于本轮结论，打印即伪造。跨轮走向交给 `cdd board <slug>`。
- 路径一律 repoRoot-relative（D47 单形态）。

#### 3.4 与 pre-flight 的关系

pre-flight 四门**照常跑**（纯读），任一门拒绝则输出与真实运行**一致**的拒绝面并 exit 1，不打印预览。dry-run 的用途正是「确认命令可执行」，越门预览会给假的「可执行」结论。

#### 3.5 适用面收窄

`--dry-run` 仅对 `implement` / `review` / `fix` 有预览语义。其余命令（`base set|get` / `schema get` / `issue render` / `board`）携带该旗标 → usage 报错、exit 2（静默忽略的旗标是消费者心智负担）。

### 4. C 组 · 抽象与遗留清理

#### 4.1 `RoundNaming` 命名单源

预期产物名今天由 `CliLifecycle#outputPath` / `#evidenceName` 私有计算。提取 `RoundNaming` 类（`session/round-naming.ts`），持有 frame → 产物名的全部派生（`handoff` / `report` / `evidence` / `brief`），由 `CliLifecycle`、dry-run preview、`#reconstruct` 三方共用。这是本 phase **唯一新增抽象**，正好消灭现有的私有命名散点。

#### 4.2 遗留读写路径退休

见 §3.2 的前两行：`Workspace.ensure()` 的显式调用点（`#sceneOf`）与 `migrateJsonChild` 全调用点删除。`Workspace.ensure()` 方法本身保留（`writeJson` 内部调用它）。

### 5. D 组 · dispatch 输入面命名收口（`--findings` → `--reviews`）

#### 5.1 缺陷

`cdd fix` 的输入旗标 `--findings`（`ARGV_CHANNEL.findings` · `face/declare.ts:56`）指向评审轮的**产出文档**：该 carrier 由 `CARRIER_FINDINGS` 声明，载 `findings` + `artifacts` + `notes` 三面（`session/handoff-schema.ts:85-93`）。旗标自身的 help 早已是 "the source review handoff JSON path"（`face/declare.ts:59`）——**声明名窄于实际指称**。同类背离还在 prompt 令牌 `INPUT_FINDINGS`（`face/lifecycle.ts:300` · `render/templates.ts:188`/`:209`/`:217`/`:278`/`:296`/`:441`）与内部路径字段（`face/cli.ts:152` 的 `PathArgs.findings` · `session/next.ts:53` 的 `Route` fix 跳 `findings` · `session/ledger.ts:93` 的 `Round.findingsPath`）。

#### 5.2 裁定

| 面 | 改前 | 改后 |
|---|---|---|
| 旗标（`ARGV_CHANNEL`） | `--findings` | **`--reviews`** |
| prompt 令牌 | `INPUT_FINDINGS` | **`INPUT_REVIEWS`** |
| 内部路径字段 | `PathArgs.findings` · `Route` fix 跳的 `findings` · `Round.findingsPath` | `reviews` · `reviews` · `reviewsPath` |
| 引擎 `next:` 的 fix 跳字面 | `… --findings <path>` | `… --reviews <path>` |

**保留**：carrier 的 `findings` 字段名——它声明的是评审产出的 findings 面，与旗标的指称对象不是同一个东西（改名会把它与 `DispatchOutcome.findings` 混为一谈）。`--dry-run` / `--type` / `--plan` / `--spec` / `--tasks` 不动。

**活面 / 历史面**：活面 = 引擎 src（declare · cli · lifecycle · route-render · next · ledger · capsule 注释）· 引擎测试 · `render/templates.ts` 令牌族 · `docs/maintainers/02-naming.md`；**历史面不追改**——历史 spec/plan/changeset/CHANGELOG 是记录，原样保留（零残留断言只覆盖活面）。

#### 5.3 消费面澄清（伴生裁定）

整份 review handoff JSON **本就是 fix child 的读入面**（`INPUT_REVIEWS` 指向它，child 自读整档）。因此 carrier 的 `notes` 面（引擎 WARN + child 自写的 set-aside 清单与证据上报）**不是死通道**——其消费者是 child 与编排器；引擎内部 `grep notes` 零消费方是**设计事实**，不是「无门」缺陷。注册连带红灯写在 `notes` 面、由编排器处置，即该通道的正常用法。

#### 5.4 落地与级次

会话期 **in-flight 热修**（独立提交 · 承 D42/D44/D49 out-of-band 先例）；P11 spec 只登记裁定与落点，**不留剩余实现面**（P11 后续实现面 = A/B/C 组）。**变更集级次**：破坏性旗标改名 → cdd-engine **major**（升格 D50 的 minor 判定）。

### Acceptance criteria

- 模板 `## Return` 为纯散文、zone key 为 `RETURN_PROSE`；`ReturnZone` / `returnFormats()` / `#parseBlockReturn` 零残留（grep pin）
- 引擎对 child stdout 零解析：唯一信号为 `result.code !== 0`；「exit 0 无 status 行」门零残留
- `DispatchOutcome.artifacts` 字段零残留；hermetic 注入 dispatch 经 `carrier` 表达产物
- `--dry-run` 对本 repo 零字节修改：`git status --porcelain` 前后一致 + `.kairos/` 目录不存在（fixture repo pin）
- `--dry-run` 不占轮次：同一命令随后真实 review 可立即执行（ledger `rounds.review` 未被预占）
- 预览含 `step:` / `reads:` / `would write:` / `would record:` / `child:` 五行，且无 `status:` / `next:` 行
- pre-flight 拒绝时 dry-run 输出与真实运行一致并 exit 1
- 非 implement/review/fix 的 `--dry-run` exit 2
- `RoundNaming` 为命名唯一来源（`#outputOf` / `#evidenceName` / `#evidencePrefix` 零残留）
- `#sceneOf` 的 `ensure()` / `migrateJsonChild` 调用点零残留
- `--findings` / `INPUT_FINDINGS` 在活面零残留（引擎 src · 测试 · `render/templates.ts` 令牌族 · `docs/maintainers/02-naming.md`）；引擎 `next:` 的 fix 跳字面用 `--reviews`；历史面不追改
- `declare.ts` flag help + `README.md` + `README.zh-CN.md` 三处文案一致
- 测试面全绿；cdd-engine changeset 在册（§5 旗标改名破坏性 → 全 phase 级次 **major**）；不发布

## Constraints

- **破坏性变更许可**：可以改旗标语义、删字段、改模板契约；不保留旧 `--dry-run` 的 book 语义。
- **零裸函数**：新增 `RoundNaming` 为类；模块级导出仅类型 / 数据 / 类。
- **不造轮子**：预览输出用手写行（无第三方依赖适用）；不引入模板引擎。
- **D29 黑盒边界**：skill 文本零改动；本 phase 的消费面可见变化仅限 README + flag help。
- **单一行为路径**：不为 dry-run 做分支特判蔓延——写点的关闭要么是全局退休（`ensure`/`migrate`），要么集中在 preview 的单一路径上（`renderBrief`/`bookkeep`）。
- **历史面不追改**：旗标/令牌改名的零残留断言只覆盖活面（引擎 src · 测试 · 模板 · maintainers 活文档）；历史 spec/plan/changeset/CHANGELOG 是记录，保持原样。

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-10-18 | 初稿——P11 phase-spec：child Return 去结构化（A 组）+ `--dry-run` 真只读预览（B 组）+ `RoundNaming` 与遗留读写清理（C 组）；裁定全承 D50 | Oscar M. · Claude Opus 5（kairos:cdd-design [P11] · 2026-10-18） |
| v0.2 | 2026-10-18 | 会话期追加（in-flight · 承 D51）：新增 §5 D 组——dispatch 输入面命名收口（`--findings` → `--reviews` / `INPUT_FINDINGS` → `INPUT_REVIEWS`）＋ review handoff `notes` 消费面澄清；§1.2 判准增「命名背离」类；§1.1 记录会话期裁定；AC 增活面零残留 pin 并把 changeset 级次升格 **major**；Constraints 增「历史面不追改」；AC 的 `RoundNaming` pin 符号名校正为真实三法 | Oscar M. · Claude Opus 5（kairos:cdd-design [P11] 会话 in-flight · 2026-10-18） |
