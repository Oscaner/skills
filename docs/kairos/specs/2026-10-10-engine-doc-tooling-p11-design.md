---
title: 引擎文档工具（Engine Doc-Tooling）— P11 设计：dispatch contract 收口（child Return 去结构化 + --dry-run 真只读预览）
doc-type: phase-spec
version: v0.5
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
- **`next:` 字面形态不变 · 退出码表 0/1/2 · CDD_BLOCKED 通道**不变——唯一例外 = §5 的 D51 fix 跳旗标 `--findings` → `--reviews`（`next:` 行其余字节不动）。
- **pre-flight 四门判定语义不变**——`session/preflight.ts` 零写调用，四门为**纯读**；本 phase 不改其判据，也不经它们产生任何写入。真实写点唯四：**真实运行派发入口**（`#runWork` 的 ensure，覆盖所有面）· **`CliGate#renderBrief`** · **`#bookkeep`** · **`#reject`**——§3.2 逐项关闭。
- **D29 黑盒边界守约**：skill 文本零引擎内部实现镜像；本 phase 的 skill 面改动为零（模板是引擎发射面，不是 skill 文本）。
- **不发布**：changesets 收尾至可发布态即止。

### 2. A 组 · child Return 去结构化

#### 2.1 模板 `## Return` 改为纯散文

`render/templates.ts` 的 `RETURN_ZONE`（`:414`）改为单个散文契约块（zone key 由 `RETURN_STDOUT_BLOCK` 更名为 **`RETURN_PROSE`**——语义单源；pin 重锚 deliberate）：

```markdown
## Return

Report in a few plain sentences what this round did, whether it succeeded, and — if it
did not — what blocked it. Nothing downstream parses this text; the handoff draft at
`OUTPUT_HANDOFF` is the round's machine-readable result. Do not emit key-value lines,
JSON, or any fixed block.

(fail: an uncaught failure → exit non-zero with a one-line reason)
```

- 散文**不转发**到 CLI stdout（stdout 是编排器的机器面，转发会污染抓取）。
- **`stdoutTail` 通道显式设计**：子进程非零退出（`face/lifecycle.ts:205-208`）与「exit 0 但无 `status:` 行」（`face/lifecycle.ts:211-214`；其门本 phase 删——见 §2.2）两条失败面**都落崩溃记录**——`#dispatch` 把 `result.stdout` 交给失败面，二者统一经 `#reject`（no-status 情形经 `#reconstruct` 的草稿缺失腿落到同一个 `#reject`）写 crash record；`stdoutTail` 存子进程输出**尾部**，长度以命名常量 **`STDOUT_TAIL_MAX`** 限界。今日 `#reject` 恒写 `stdoutTail: []`（`face/lifecycle.ts:540`）——本次让它真正有内容。
- `## Return` 小节保留（不整节删除）：它是 child 的收尾纪律，也是 host 日志的可读面。

#### 2.2 引擎侧删除清单

| 位置 | 删除物 | 理由 |
|---|---|---|
| `face/lifecycle.ts#parseBlockReturn`（`:414`） | 整个方法 | 死数据解析 |
| `face/lifecycle.ts#dispatch`（`:211-214`） | `if (!/^status:\s*\S+/m.test(result.stdout)) → BLOCKED` 门 | 冗余门（草稿缺失已由 `#reject` 更准确拦截） |
| `face/lifecycle.ts#reconstruct` | 第二参 `block: DispatchOutcome` + `:526` 的 `artifacts: block.artifacts` | 随 `#parseBlockReturn` 删除——调用形状变为 `#reconstruct(frame)` |
| `session/run.ts` `DispatchOutcome.artifacts`（`:104`，消费点 `:452`/`:455`） | 字段 + `#bookkeep` 的两处 `artifacts:` 传参 | 生产路径零消费者；hermetic 注入 dispatch 不再需要该槽（见 §2.3） |
| `render/templates.ts` `ReturnZone` 接口（`:68`）+ `returnFormats()`（`:505`，读于 `:527`/`:614`） | 接口与内省方法 | 单块后无「多形态」可枚举 |
| `infra/__tests__/infra.test.ts` / `render/__tests__/render.test.ts` | `Object.keys(template.return)`（`infra.test.ts:111`）/ `returnFormats()` pin（`render.test.ts:48`） | 随删除物退役 |

**保留**：`result.code !== 0 → BLOCKED` 作为唯一进程信号（失败面落 crash record——见 §2.1）；`#reconstruct` 的草稿 + evidence 回读通道原样，唯第二参随 `#parseBlockReturn` 删除（调用形状 `#reconstruct(frame)`，`#dispatch` 尾行 `return this.#reconstruct(frame)`）。

#### 2.3 hermetic 注入 dispatch 的产物面

测试面的注入 dispatch 今天用 `artifacts` 字段（`session/run.ts:104`）向 `#bookkeep` 的 fallback 传产物。字段删除后，注入 dispatch 直接提供 **`carrier`**（`DispatchOutcome.carrier` 既有字段，`session/run.ts:110`）表达产物，`#bookkeep` 的 fallback 只保留 `findings`（findings face）与空 work carrier 两条最简成型。**不接受第二种产物通道**——`carrier` 是引擎已声明的单一半成品面。

#### 2.4 测试面迁移（逐条列名）

本 phase 删掉的行为有四组 pin 仍锁着（「测试面全绿」是 AC，不逐条迁移则落地即红）。逐条就地重述，**以零写为准**：

| pin 位置 | 今日断言 | 迁移后 |
|---|---|---|
| `face/__tests__/cli.test.ts:2586-2624`（P4.1 F1 回归） | `--dry-run implement` → `--dry-run review` 链断言 `.kairos/cdd/p3` 存在 · `.gitignore === '*\n'` · 第二腿 exit 0 | 拆两面：**真实运行腿**用空仓 fixture 真 dispatch（断言建目录 + 渲染 brief + `.gitignore` = `*`）· **`--dry-run` 腿**改「预览输出 + 断言零写（`.kairos/` 缺席）」，且链式 review 不再被拒（dry-run 不占轮） |
| `src-next/__tests__/smoke.integration.test.ts:191-209`（发布门） | dry-run 链断言 `assertCapsule(res.stdout)` + `status:` 行 + `.kairos/cdd/fixture/` 行 | 以「preview 输出 + 零写」重述；`docs/maintainers/01-doctrine.md:41` 的发布门句同步 |
| `render/__tests__/render.test.ts:69-87` | 两行 fence 逐字节 pin（`['status: <APPROVED\|BLOCKED>', 'artifacts: report=<path> test_evidence=<path>']`） | 换成**散文区**断言（`RETURN_PROSE` 块存在 + 无 `status:`/`artifacts:` 键值行） |
| 合成批准块（`--dry-run` 调用点，`cli.test.ts` 内 72 处文本出现） | 经合成 dispatch `() => ({ status: 'APPROVED', findings: [] })` 造轮 | 改为注入 `dispatch:`/`carrier`，或转成 preview 行断言；`--dry-run` **调用点**计数与 D50 登记的 **23 处**对账后落定 |

`--dry-run` 计数以「调用点」为准与 D50 的 23 处对账（`cli.test.ts` 的 72 处含历史语境文本出现，二者不同量纲，实现时对齐）——§2.2/§2.3 的实现面按对账结果收口。

### 3. B 组 · `--dry-run` 真只读预览

#### 3.1 语义

`--dry-run` = **预览下一个派发步及其预期产物，对 repo 零写入、不占轮次**（issue #345 采纳方案 b）。它**不是**一次模拟运行，也不是 `--assume-approved`；它是一次**纯读的下一步预告**。

#### 3.2 零写入的边界（逐项关闭）

| 写点（今日 dry-run 会触发） | 处置 |
|---|---|
| `#sceneOf` 的 `new Workspace(...).ensure()`（`face/cli.ts:797`） | **场景装配不再代建 · 真实运行派发入口对所有面 ensure 一次**（不只 dry-run）——`#sceneOf` 在 dry-run 与真实运行都会跑，故不在那里 ensure；`#runWork` 在**预检通过后、首个写点（`renderBrief` 或 dispatch）之前**、对**所有面**（wave / spec / plan / branch）补一次 `Workspace.ensure()`（`dryRun` 旗标跳过，守本组零写）。它是子进程 OUTPUT_REPORT / OUTPUT_HANDOFF 目标目录的建立者，也是 `.kairos/.gitignore` keep-out 标记的唯一发布点（发布时机不变：真实运行首个写点）。`Workspace.writeJson` 仍自行 ensure；`CliGate#renderBrief` 不再单独 ensure（写点收敛到单一入口）。显式调用点两个（`face/cli.ts:797` · `:958`）均退休；`Workspace.ensure()` 方法本身保留（`writeJson` 内部调用它） |
| `#sceneOf` 的 `migrateJsonChild("progress.json"/"base.json")`（`face/cli.ts:803`/`:804`） | **全局退休**——`#readBase` 改走 `Workspace.readJson`（读写同一条归一化路径），P9 读时归一化真正覆盖 `base.json`；三调用点（`face/cli.ts:803` progress.json · `:804`/`:962` base.json）随本裁定退休，`Workspace.migrateJsonChild` 方法本体（`infra/workspace.ts:293`）成死码，连同其四个直测（`infra/__tests__/infra.test.ts:332-359`）一并删除（mandate 4） |
| `gate.renderBrief`（`writeFileSync` brief，`face/gate.ts:117-118`；派发于 `face/cli.ts:492`） | dry-run 跳过；预览以 `reads: <path> (would re-render from the current plan)` 陈述 |
| `#bookkeep` 的 `persistHandoff` / `recordRound` / `recordReviewedRevision` / `recordReviewedBrief`（写点 `session/run.ts:462`/`:467`/`:503`/`:517`） | dry-run 跳过；预览以 `would record:` 陈述 |
| `#reject` 的 `writeCrash` | dry-run 跳过 |
| `#dispatchOf` 的 synthetic `() => ({ status: "APPROVED", findings: [] })`（`face/cli.ts:640`） | **删除**——dry-run 不再派发、不再伪造结论 |

#### 3.3 预览输出形面

stdout 单块（无 `status:` / `next:` 行——不伪造 capsule）：

```
cdd review: preview (no repo changes)
  step:        review round 1 — wave 1
  reads:       .kairos/cdd/p3/tasks-1-brief.md (would re-render from the current plan)
  would write: .kairos/cdd/p3/tasks-1-review-1.json · .kairos/cdd/p3/tasks-1-review-1-report.md
  would record: progress.waves["1"].rounds.review += [1] · reviewedRevision(brief)
  child:       claude -p --output-format text --dangerously-skip-permissions (host: claude)
```

- `child:` 行按引擎实际词汇 pin：行 = `<HostId>` ＋ `" "` ＋ `HOSTS.<id>.invoke`——leading token 是 `<HostId>` 值（`claude` / `cursor` / `pi`，`face/host.ts:34`），其后的实参串取 `HOSTS.<id>.invoke` 原值（claude = `-p --output-format text --dangerously-skip-permissions`，逐字照 `face/host.ts:149`；二进制名 `claude` 是 `HOSTS.claude.cli`，不在 invoke 值内）；未检出 host 时写 `(no host detected — real run would BLOCK)`。**不写 `claude-code`**——那是 `aiAgentPrefix` 的探测标记值（`face/host.ts:152`），非 host id。预览**不依赖** host 检测（不 spawn child）。
- 不打印 `next:`：`next` 取决于本轮结论，打印即伪造。跨轮走向交给 `cdd board <slug>`。
- 路径一律 repoRoot-relative（D47 单形态）。

#### 3.4 与 pre-flight 的关系

pre-flight 四门**照常跑**（纯读），任一门拒绝则输出与真实运行**一致**的拒绝面并 exit 1，不打印预览。dry-run 的用途正是「确认命令可执行」，越门预览会给假的「可执行」结论。

#### 3.5 适用面收窄

`--dry-run` 仅对 `implement` / `review` / `fix` 有预览语义。其余命令（`base set|get` / `schema get` / `issue render` / `board`）携带该旗标 → usage 报错、exit 2（静默忽略的旗标是消费者心智负担）。

### 4. C 组 · 抽象与遗留清理

#### 4.1 `RoundNaming` 命名单源

预期产物名今天由 `CliLifecycle` 的私有方法散点计算：`#outputOf`（`face/lifecycle.ts:379`，用于 `:337-338`/`:663`/`:665`）· `#evidenceName`（`:405`，用于 `:504`）· `#evidencePrefix`（`:687`，用于 `:680`）。提取 `RoundNaming` 类（`session/round-naming.ts`），持有 frame → 产物名（**report / evidence / brief**）的派生，由 `CliLifecycle` 与 dry-run preview **两面**共用（`#reconstruct` 是 `CliLifecycle` 的自身方法，属第三调用点而非第三面）。这是本 phase **唯一新增抽象**，正好消灭现有的私有命名散点。

**handoff 名不另起推导**：委派 `Ledger#handoffName`（`session/ledger.ts:836`）的 `HANDOFF_FAMILIES` 表——该表声明「the naming table is the single truth, never a second list」（`session/ledger.ts:820`），族绑定仍读 config（`session/ledger.ts:335`/`:821`）；守 D26（一事实一处）。brief 名的产地是 `CliGate#renderBrief`（`face/gate.ts:118`）。

#### 4.2 遗留读写路径退休

见 §3.2 的前两行，逐项退休：

- **`Workspace.ensure()` 显式调用点重述**：`#sceneOf`（`face/cli.ts:797`）与 `#runBase`（`face/cli.ts:958`）两条显式调用点退休；`#runWork`（`face/cli.ts` 预检后、首个写点前）**新增一处**显式 `Workspace.ensure()`，**覆盖所有面**（wave / spec / plan / branch；`dryRun` 分支不达）——真实运行首个写点；`Workspace.writeJson` 内部自 ensure。`base set` 经 `writeJson` 自带 ensure；只读的 `cdd base get` 不再建 `.kairos/`（与 B 组「只读命令零写」同向，消弭同类缺陷）。`Workspace.ensure()` 方法本身保留（`writeJson` 内部调用它），且仍是 `.kairos/.gitignore` keep-out 标记的唯一发布点，发布时机不变（首个写点）。
- **`migrateJsonChild` 全调用点退休 + 死码删除**：`#readBase` 改走 `Workspace.readJson`（`face/artifacts.ts:221-223` 的裸 `JSON.parse(readFileSync(...))` 退役），使 P9 读时归一化真正覆盖 `base.json`——一事实一处，不留第二个疗伤点；三调用点（`face/cli.ts:803` progress.json · `:804`/`:962` base.json）随之退休，方法本体（`infra/workspace.ts:293`）成死码，连同其四个直测（`infra/__tests__/infra.test.ts:332-359`）一并删除（mandate 4）。

### 5. D 组 · dispatch 输入面命名收口（`--findings` → `--reviews`）

#### 5.1 缺陷

`cdd fix` 的输入旗标 `--findings`（`ARGV_CHANNEL.findings` · `face/declare.ts:56`）指向评审轮的**产出文档**：该 carrier 由 `CARRIER_FINDINGS` 声明，载 `findings` + `artifacts` + `notes` 三面（`session/handoff-schema.ts:85-93`）。旗标自身的 help 早已是 "the source review handoff JSON path"（`face/declare.ts:59`）——**声明名窄于实际指称**。同类背离还在 prompt 令牌 `INPUT_FINDINGS`（`face/lifecycle.ts:300` · `render/templates.ts:188`/`:209`/`:217`/`:278`/`:296`/`:441`）与内部路径字段（`face/cli.ts:152` 的 `PathArgs.findings` · `session/next.ts:53` 的 `Route` fix 跳 `findings` · `session/ledger.ts:93` 的 `Round.findingsPath`）。

以上八个行号为 **D51 落地点**（改名前后同行号），故今日读到的字节已是 `reviews`（如 `face/declare.ts:56` = `reviews: {` · `session/ledger.ts:93` = `reviewsPath?: string`）；pre-rename 态（`ARGV_CHANNEL.findings` / `Route.findings` / `Round.findingsPath`）以 §5.2 的判准文字承载，**不引 pre-hot-fix 修订**——Constraints「历史面不追改」。

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
- 子进程非零退出或无 draft 时产出 crash record 且 `stdoutTail` **非空**（尾部以命名常量 `STDOUT_TAIL_MAX` 限界）
- `DispatchOutcome.artifacts` 字段零残留；`#reconstruct` 第二参已删（调用形状 `#reconstruct(frame)`，`face/lifecycle.ts:526` 的 `block.artifacts` 零残留）；hermetic 注入 dispatch 经 `carrier` 表达产物
- 空仓首次**真实** dispatch：建出 workspace 并渲染 brief（零 ENOENT），`.kairos/.gitignore` = `*`（fresh-repo pin）
- 同一空仓 `--dry-run` 后 `.kairos/` 目录**缺席**（零写）
- `--dry-run` 对本 repo 零字节修改：`git status --porcelain` 前后一致（fixture repo pin）
- `--dry-run` 不占轮次：同一命令随后真实 review 可立即执行（ledger `rounds.review` 未被预占）
- 预览含 `step:` / `reads:` / `would write:` / `would record:` / `child:` 五行，且无 `status:` / `next:` 行；`child:` 行为 `HostId` + `HOSTS.<id>.invoke` 实参串（非 `claude-code`）
- pre-flight 拒绝时 dry-run 输出与真实运行一致并 exit 1
- 非 implement/review/fix 的 `--dry-run` exit 2
- `RoundNaming` 为命名唯一来源（`#outputOf` / `#evidenceName` / `#evidencePrefix` 零残留），且 handoff 名委派 `Ledger#handoffName` 的 `HANDOFF_FAMILIES` 表（不另起推导）
- 两条 `Workspace.ensure()` 显式调用点（`face/cli.ts:797` · `:958`）退休后零残留；`CliGate#renderBrief` 的显式 `ensure()`（`face/gate.ts:117-118`）为首个写点（dry-run 不触发）；`migrateJsonChild` 调用点与方法本体零残留（四直测一并删除）；持 legacy 绝对 `plan` 的 `base.json` 在 `cdd base get` 报 **repoRoot 相对形**
- `--findings` / `INPUT_FINDINGS` 在活面零残留（引擎 src · 测试 · `render/templates.ts` 令牌族 · `docs/maintainers/02-naming.md`）；引擎 `next:` 的 fix 跳字面用 `--reviews`；历史面不追改
- `declare.ts` flag help + `packages/cdd-engine/README.md` + `packages/cdd-engine/README.zh-CN.md` 三处文案一致；旧名 `RETURN_STDOUT_BLOCK` → `RETURN_PROSE` 在**全活面**零残留——引擎 src `render/templates.ts:37`/`:415`/`:425`/`:527`/`:614` · `infra/runtime.ts:76` · `face/lifecycle.ts:66`/`:411` ＋ 引擎测试 `infra/__tests__/infra.test.ts:55`/`:111` · `render/__tests__/render.test.ts:48` · `face/__tests__/sync-runner.test.ts:8` ＋ `docs/maintainers/02-naming.md:7`/`:40` · `03-cache-doctrine.md:21`（与 `ReturnZone` / `returnFormats()` / `#parseBlockReturn` 零残留并列；不设「保留旧字面」例外）
- 测试面全绿（含 §2.4 的逐条迁移：F1 双面 · 发布门 smoke 重述（`docs/maintainers/01-doctrine.md:41` 同步）· 两行 fence pin 换散文断言 · 合成批准块改注入/预览断言 · `--dry-run` 调用点计数与 D50 的 23 处对账）；cdd-engine changeset 在册（§5 旗标改名破坏性 → 全 phase 级次 **major**）；不发布

## Constraints

- **破坏性变更许可**：可以改旗标语义、删字段、改模板契约；不保留旧 `--dry-run` 的 book 语义。
- **零裸函数**：新增 `RoundNaming` 为类；模块级导出仅类型 / 数据 / 类。
- **不造轮子**：预览输出用手写行（无第三方依赖适用）；不引入模板引擎。
- **D29 黑盒边界**：skill 文本零改动；本 phase 的消费面可见变化仅限 README + flag help。
- **单一行为路径**：不为 dry-run 做分支特判蔓延——写点的关闭要么落在写点本身（`ensure` 显式调用点退休 · `migrate` 全退休），要么集中在 preview 的单一路径上（`renderBrief`/`bookkeep`）。
- **历史面不追改**：旗标/令牌改名的零残留断言只覆盖活面（引擎 src · 测试 · 模板 · maintainers 活文档）；历史 spec/plan/changeset/CHANGELOG 是记录，保持原样。

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-10-18 | 初稿——P11 phase-spec：child Return 去结构化（A 组）+ `--dry-run` 真只读预览（B 组）+ `RoundNaming` 与遗留读写清理（C 组）；裁定全承 D50 | Oscar M. · Claude Opus 5（kairos:cdd-design [P11] · 2026-10-18） |
| v0.2 | 2026-10-18 | 会话期追加（in-flight · 承 D51）：新增 §5 D 组——dispatch 输入面命名收口（`--findings` → `--reviews` / `INPUT_FINDINGS` → `INPUT_REVIEWS`）＋ review handoff `notes` 消费面澄清；§1.2 判准增「命名背离」类；§1.1 记录会话期裁定；AC 增活面零残留 pin 并把 changeset 级次升格 **major**；Constraints 增「历史面不追改」；AC 的 `RoundNaming` pin 符号名校正为真实三法 | Oscar M. · Claude Opus 5（kairos:cdd-design [P11] 会话 in-flight · 2026-10-18） |
| v0.3 | 2026-10-18 | docs-fix round 2——落实 R1–R11：§3.2 首行改「场景装配不再代建 · 写点自 ensure」（`renderBrief` 补 ensure；两个 `ensure()` 调用点退休）· §3.2 次行改 `#readBase` 走 `readJson`（`migrateJsonChild` 全调用点 + 方法本体 + 四直测删除）· §1.3 写点重述（四门纯读）与 `next:` 限定 · §2.1 `stdoutTail` 通道显式设计（`STDOUT_TAIL_MAX`）· §2.2 补 `#reconstruct` 第二参删除行 · 新增 §2.4 测试面迁移逐条列名 · §3.3 `child:` 行按 `HostId` + invoke 实参串 pin · §4.1 符号校正 + handoff 名委派 `Ledger` · §4.2 双调用点 + `#readBase` 归一化 · §5.1 锚点标注 D51 落地点 · AC 增 fresh-repo / base.json / stdoutTail pins 与 doc 全路径 | Oscar M. · Claude Opus 5（kairos:cdd-dev [P11] docs-fix round 2 · 2026-10-18） |
| v0.4 | 2026-10-18 | docs-fix round 3——落实 R1–R3：§4.2 ensure() 清单重述（两条 `face/cli.ts:797`/`:958` 调用点退休 + `CliGate#renderBrief` 新增一处为首个写点 · `writeJson` 内部自 ensure）消除与 §3.2 的自相矛盾 · AC 的 ensure pin 由「零残留」改为「两调用点退休后零残留 + `renderBrief` 为首个写点」· §3.3 `child:` 行 pin 值归属校正（行 = `<HostId>` + `" "` + `HOSTS.<id>.invoke`，invoke 值逐字照 `face/host.ts:149`，`claude` 二进制名不属 invoke）· AC 的 `RETURN_STDOUT_BLOCK` → `RETURN_PROSE` 零残留 pin 面由「只圈 docs/maintainers」扩至引擎全活面（src + 测试 + templates token 族 + docs/maintainers） | Oscar M. · Claude Opus 5（kairos:cdd-dev [P11] docs-fix round 3 · 2026-10-18） |
| v0.5 | 2026-10-19 | in-flight backfill（review blocker F1）——ensure 写点由「`CliGate#renderBrief` 一处（`type === "wave"` 门内）」扩面为「`#runWork` 真实运行派发入口对所有面一次（预检后、首个写点前，`dryRun` 分支不达）」：原设计仅在 wave 面经 `renderBrief` ensure，spec/plan/branch 面在空仓真实派发时 `.kairos/<slug>/` 缺席（子进程 OUTPUT_HANDOFF 指向不存在的目录，`.kairos/.gitignore` keep-out 标记未在子进程可污染前发布），`Workspace.ensure()` 首发时机被推迟到 wave 面；扩面后所有面同点 ensure。§3.2 首行 · §4.2 首条 · §1.3 写点重述同步 | Oscar M. · Claude Opus 5（kairos:cdd-dev [P11] in-flight backfill · 2026-10-19） |
