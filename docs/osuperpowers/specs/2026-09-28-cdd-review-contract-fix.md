# Cdd Review 输出面契约修正（Cdd Review Output-Contract Fix）— Single Spec

- **Version**: v1.2 · 2026-09-28
- **Status**: Approved
- **Author**: [human] · Claude Opus 5 (1M context) (osuperpowers:brainstorming)
- **Issues（收口时关闭）**: #302（cdd review 输出与 findings 的 blocker 同词异义导致路由判读歧义）· #304（cdd 收口 claim 审计：prose 误触发 + 排障引导不指向根因）
- **程序形态**: 独立 single-spec 程序（无 parent overall，无 canonical schema）；docs-lane 门控仅断言 `- **Version**:` 头行

## 背景与根因

### C1（#302）：`blocker` 一词四义，两条 stdout face 同 token 异义

`blocker` 在本仓实有 4 个意义（探索实测定案）：

| # | 含义 | 载体 |
|---|---|---|
| M1 | review finding 严重级 `blocker`（blocker/warn/nit） | findings handoff JSON；永不打印到 stdout |
| M2 | blocker 级 finding 的计数 | docs 面结果行 `status: <s> · blocker: <n> · handoff:`（`cli/result-face.ts:20-25`，源 = `rules/convergence.ts#blockerCount` 单一真相） |
| M3 | handoff `blocker` 字段 = BLOCKED 轮次的 prose 理由串 | task/branch 面 return-block `blocker:` 行（`artifacts/return-block.ts`） |
| M4 | `BLOCKED` 状态 / `DispatchBlocked` / `CDD_BLOCKED:` stderr | 状态枚举 + exit 面 |

**实测根因（#302 原文叙述需修正）**: stdout `blocker:` 不是「执行层契约计数」——执行层失败计数器在 task/branch 面的 `counters:` 行。真正碰撞是 **跨 face 同 token 异义**：docs 面 `blocker:` = M2 计数；task/branch 面 `blocker:` = M3 prose（非 BLOCKED 轮默认 `none`，`returnFromHandoff:180` 经 `blockerDefaultFor` 输出）。实测证据按 face 分列两条、各自标注来源：status 面首行 **`status: CHANGES_REQUESTED`**（task return-block 第一行）——由 ≥1 blocker-severity finding 汇总而来（`finalize.ts` `classifySeverity`/`rollupStatus`）；prose 面 **`blocker: none`**（M3 默认值，`blockerDefaultFor` 输出）——不是 docs 结果行 `status: <s> · blocker: <n>` 的「· 分隔」记法（该行只印 M2 数值计数、从不印 none）。歧义由此产生：orchestrator 按判读指令「读 blocker count」命中 M3 prose 行（`none`）而非 M2 计数 → 得到 0 → 误路由 S2（收口轮不 re-review）。**task/branch 评审的 S1「必 re-review」守门被静默禁用。**

关键事实：**status 本身就是 severity 的汇总结码**（任一 `severity=blocker` → `CHANGES_REQUESTED`；warn/nit-only → `REVIEW_FIX`；Approved → `APPROVED`），且双 face 均已打印 `status:`。即「有效 blocker」路由量已编码在 status——引擎无需新增任何装配。

### C2（#304）：claim 审计无判别 + 排障引导不指向根因

两条失败链，同属 review-doc-contract 的 claim 审计：

- **(a) 判别缺失**：change-history 单元格内命中 CLAIM_RE（`(Pending|[Pending]) (→|->) <target>`）即当 claim，无 prose/claim 语境判别；同 clause 的 phase-range 简写（`P3.10.1-P3.10.5`）被静默展开为逐个 phase 并附加给该 clause 全部 claim。实测一条**纯记述性备注**「（Pending → p3.10.1 链接形态）」（描述同步方式、非声明）命中正则，联合 range 简写 → 未开工子阶段 plan 列被幽灵 claim 批量误配。#274（closed）修复的是「prose 提及 phase 成为 claim 目标」——本机制为其**残留面**（字面 `Pending →` 的教学/备注/引用语境 + range 简写的组合仍产生幽灵 claim）。
- **(b) 诊断误导**：doc-contract BLOCKED 输出 = mismatch 行 + 类别模板修复文案（「backfill the plan column…」「isolate prose 用 `；`」）。实测（#304 背景二）真根因 = **子阶段字母后缀违反 phase-id 语法**（`P3.10a` → 正则吞不出字母 → claim 挂到父行 `P3.10`），但文案全部导向形态修补，不附肇事原文/解析相位/机理——三轮盲修后才定位，最终靠读 engine 源码确认。「零误导错误信息」最佳实践被违背。

## 设计裁定

单 spec 双组件。路由判据统一（裁定 ①）后，S1/S2/S3 收敛表：

| status | 判读 | 轮次 |
|---|---|---|
| `APPROVED` | 零 blocker 级 finding | S3 验收收敛，不派 fix |
| `CHANGES_REQUESTED` | ≥1 blocker 级 finding | S1：fix 后必 re-review |
| `REVIEW_FIX` | 仅 warn/nit finding | S2：fix 收口轮，不 re-review |
| `BLOCKED` / `TIMEOUT` | 执行层/合同层事件 | failure-mode 表（BLOCKED / re-dispatch / report），不属 S1/S2/S3 |

---

## C1：#302 — blocker 一义一词

### ① 路由判据 = status

- 收敛轮次判据锚定 **status**（见上表），orchestrator 不再判读 stdout `blocker` 字段做 S1/S2/S3 路由。「有效 blocker = status=CHANGES_REQUESTED」一句闭环，等价于 #302 建议②的「stdout>0 OR findings severity=blocker ⇒ 必 re-review」且更简。
- orchestrator **不新增**读 findings（severity 同样不读）——findings 全文仍只经 `cdd fix --findings <handoff>` 交给 fix-agent，I5「不 self-apply」契约零新增 carve-out。
- **engine 侧不变**：`reviewConvergenceGuard`（`cli/review.ts:155,259`，读前一轮 handoff JSON 的 `prev.status` + `blockerCount`，机器面无歧义）与 `blockerCount()`（`rules/convergence.ts:33-35`）原样保留——收敛/续派机器守门与 orchestrator 路由面分离，各取所需。
- 实现期须以单测确认等价：任一 status 编码面（review 汇总）`CHANGES_REQUESTED ⟺ ≥1 severity=blocker finding`（`finalize.ts:68-102` 已实现，等价性断言落测试，防 SP-4 pass-through 等旁路稀释语义）。

### ② stdout return-block 删 `blocker:` prose 列（破坏性）

- task/branch 面 return-block（`artifacts/return-block.ts`：`returnFourLines:49-55` / `assembleReturnBlock:139-150` / `dryRunBlock:127-134` / `returnFromHandoff:155-183`）**删 `blocker:` 行**——两个行数面须区分：**agent 输出契约 = 3 行**（`status:` / `commits:` / `artifacts:`），**引擎 stdout = 4 行**（3 行 + `counters:`，`counters` 恒由引擎追加、agent 永不自产——`return-block.ts` returnCountersLine 注释「engine owns the count — the agent never produces counters」即约束）。模板常量 `RETURN_STDOUT_BLOCK` 族随之落 3 行契约，避免 prompt 更新者按 4 行要求 agent 自产 counters。
- **task/branch 面 M3 载体裁定**：删列后 return-block 不再承载 handoff `blocker` 字段的声明通道（材料化器 4 槽解构 `[statusLine, , artifactsLine, blockerLine]` 输出降为 3 行后错位）——该面 BLOCKED 理由**单一化为 stderr `CDD_BLOCKED: <reason>` 通道**（`infra/exit.ts:77`，已存在）：`finalize.ts` 材料化解构（`:558-562`，即「implement return status … without blocker」路径）随 3 行契约重接、`blocker` 槽位消除，stderr 捕获不到的场合落**占领位兜底文案**；task 面 handoff `blocker` 字段（`task-handoff-schema.json:171`）随之**空置**（保留槽位但不再作为 agent 声明通道），BLOCKED allOf（`:311-318`）相应调整为仅以 failure_category 支撑——该面理由可寻址面 = stderr + failure_category。
- **docs 面 handoff `blocker` 字段保持**（`docs-handoff-schema.json:82`，BLOCKED ⇒ 非空或 failure_category 的 allOf 约束不变）——docs agent 的声明通道经手写 handoff 落点而非 return-block，独立于删列，与 stderr 并存。
- `blockerDefaultFor`（`:115-122`）与 `"none"` 假象源**删除**——`blocker: none` 是 #302 语义碰撞的直接触发面。
- **docs 面保留** `status: <s> · blocker: <n> · handoff:`（M2 计数，`cli/result-face.ts`）——count of blocker-severity findings，语义与 M1 一致、与①路由判据互证；`result-face.test.ts:46` pin 保持。
- `counters:` 行（`rules/failure.ts#counters` 规范化标签）保留——执行层失败计数，从未叫过 blocker。
- agent prompt 模板同步：agent 输出契约不再携带 `blocker:` 行；模板常量（`RETURN_STDOUT_BLOCK` 族）随之收敛。

### ③ 命名档案收编（Principle 2 正式兑现）

- `docs/maintainers/02-naming-conventions.md` `§3.5`（`:70`，F8 时 `blocker` 列入「retained，no term-to-mechanism mapping」）→ `blocker` 移出保留词，于 `§3.2` 落 **bounded 映射**（正是 ① 拆词 + ② 去列后的事实语义）：
  - `blocker` = review finding 严重级（M1）——唯一「blocker」词义；
  - `BLOCKED` = 轮次状态（M4，`blocked`/`blocked` 状态词汇）；
  - handoff `blocker` 字段（docs 面）= BLOCKED 轮次理由串（M3 载体，docs schema allOf 保持）；task/branch 面理由经 stderr `CDD_BLOCKED:` 单通道（handoff `blocker` 字段空置，task schema allOf 仅以 failure_category 支撑）；stdout 面仅 docs 结果行 `blocker: <n>` 作 M1 计数呈现。
- §3.3 mechanismNames 迁移表补一行（stdout return-block `blocker:` 列 → 移除；`blockerDefaultFor` → 删除）。

### ④ skills ×5 判读与收敛文档重锚

- `cli-driven-development` + `writing-single-spec` / `writing-overall-spec` / `writing-phase-spec` / `writing-plans` 五份 SKILL.md 的 Review Convergence（I1/I3）与流程标签：`{blocker=0?}` 判据改述为 status 判据（`CHANGES_REQUESTED` ⇒ S1 必 re-review / `REVIEW_FIX` ⇒ S2 收口 / `APPROVED` ⇒ S3）；判读指令删「reads only the `status` / `blocker` count」措辞（`cli-driven-development/SKILL.md:59,66,72,86`），改「读 `status:` 路由」；Failure-Modes 表中「blocker from output contract」改写为 `status: BLOCKED` + stderr `CDD_BLOCKED:` 理由（M4 语义）。「blocker」一词在文档中统一锚定 finding 严重级。
- 消费面零程序叙事（iron rule）：skills 文案只承载收敛判据语义，不携带本程序 phase/issue 叙事。

---

## C2：#304 — claim 判别 + range 语义 + 诊断引导

（实现面：claim 审计逻辑于 `src/rules/documents.ts`（#274 落地处：`:213,241,350,463,800`）；doc-contract BLOCKED 输出于 docs 派发面。）

### ⑤ 判别 = 声明位形态（#274 残留面收口）

- claim 声明仅认可位于**声明起始位**的 `Pending → <phase-id>` / `[Pending] → <phase-id>` 形态。判别机制为**结构性规则**（非词表成员判定）：表格单元格或列表项 clause 的**头部 token** 命中 `Pending`/`[Pending]` 且**不在括注内联**（现行 anchor-free 的 CLAIM_SCAN_RE 需收到 `claimTarget` 的 `^` 锚语义——头部即锚点）。
- 括注（`（…）`）内、或非头部位置的字面命中 = **prose hint**，不声明、不参与收敛审计。引导词（「链接形态」「例如」「方式」…）仅作用户意图的示例说明，不构成可判定的词典——可判定的闭集只有头部 token + 非括注。
- 实测形态「（Pending → p3.10.1 链接形态）」按此规则归 prose（括注内联 + 非头部）。
- **#274 残留面 supersession 记录**：本 ⑤ 是 #274「prose 提及 phase 成为 claim 目标」的收口（字面 `Pending →` 形态全面纳入判别），入档于影响面 notes（同 A3 退役先例）。

### ⑥ range 简写语义

- `P3.10.1-P3.10.5` 的语义由 ⑤ 判别前置决定：**声明位** = 多目标声明（个相位逐一为目标，合法）；**prose 位** = 描述性列举，不声明。
- 诊断报告对 range 声明列出**展开相位清单**（排障可见），并同步实现期测量的展开边界，避免回到「静默批量误配」。

### ⑦ 语法错误显式化（修 #304(b) 真根因）

- 子阶段字母后缀（`P3.10a`）**不再静默吞入父行**（原正则吞不出字母 → claim 挂到 `P3.10`）——改报**非法 phase-id** 并给出合法形态指引：点分式 `P3.10.1`。
- 随行承接正名债「P3.10a-e → P3.10.1-.5」：宽容退场、规范寓教于错；诊断即合法形态教学面。

### ⑧ 诊断三件套（零误导错误信息）

doc-contract BLOCKED / mismatch 输出升级为：

1. **肇事上下文**：触发 claim 的 clause 摘录 + claim 解析到的相位 + 解析机理（如「P3.10a → 非法 phase-id（字母后缀）：不回退父行，合法形态指引 P3.10.1」——非法形态下解析相位槽位止于错误态；历史吞父行的旧机制仅作排障史标注为 #304(b) 旧机制，不放入解析相位槽位）；
2. **按类别分派建议**：语法类 → 合法 phase-id 形态 + 定位（表格行/单元格）；prose 类 → 肇事 clause 摘录 + 建议措辞；
3. **可执行动作**：每条错误至少一个可直接执行的定位/修复动作（如「将 `P3.10a` 改为 `P3.10.1`」）。

目标：收口闸门排障从「多轮盲修 + 源码考古」收敛为「一视可解」。

---

## 验收 criteria

- **C1 引擎**：return-block 无 `blocker:` 行（`returnFourLines`/`assembleReturnBlock`/`dryRunBlock`/`returnFromHandoff` 单测断言 + 输出契约 grep）；`blockerDefaultFor` 与「`blocker: none`」零残存；`smoke-cdd.ts:33,466` 输出契约 pin 更新为 4-key（`status/commits/artifacts/counters`）；docs 面 `result-face.ts` + `result-face.test.ts` 保持（M2 计数）。
- **C1 载体可寻址**：task/branch 面任一 BLOCKED 轮次的理由可经 stderr `CDD_BLOCKED:` / failure_category 寻址、docs 面经 handoff `blocker` 字段寻址——engine 单测断言 BLOCKED 轮非空理由线索不随删列静默丢失；`finalize.ts` 材料化解构已随 3 行契约重接（无 4 槽错位）、占领位兜底文案路径可达。
- **C1 路由等价**：engine 单测——构造含 `severity=blocker` finding 的 review handoff → 断言 status=CHANGES_REQUESTED（且收敛语义 = fix 后必 re-review）；warn/nit-only → REVIEW_FIX（收口）；zero findings → APPROVED。
- **C1 skills**：5 份 SKILL.md 零「blocker count」判读措辞、Review Convergence 以 status 锚定（grep/pin 守门）。
- **C1 命名**：`02-naming-conventions.md` §3.2 bounded 行落 + §3.5 移除 `blocker` + §3.3 迁移行。
- **C2 判别**：engine 单测以头部 token + 非括注为断言面——clause 头部 `Pending → P3.1` 命中；括注「（Pending → p3.10.1 链接形态）」与非头部位置的字面命中一律不声明（引导词不作词典成员判定）；#274 残留形态回归 pin。
- **C2 range**：声明位 range 展开为多目标；prose 位不展开；诊断附展开清单。
- **C2 语法**：`P3.10a` → 报非法 + 引导 `P3.10.1`（不复现「吞父行」）——#304(b) 实测链精确回归单测。
- **C2 诊断**：mismatch 输出载荷断言（clause 摘录 + 解析相位 + 机理 + 类别分派 + 可执行动作）。
- **收口**：changeset 双包各一（`@oscaner-skills/cdd-engine` patch + `@oscaner-skills/osuperpowers` patch，skills 文档随包）；validate/precommit 全绿（含 `smoke-cdd` 更新面）；issue #302 + #304 收口关闭。

## 影响面清单（file:line 事实锚点）

| 面 | 位置 | 动作 |
|---|---|---|
| return-block | `packages/cdd-engine/src/artifacts/return-block.ts:49-55,104-111,115-122,127-134,139-150,155-183` | 删 `blocker:` 行；`returnBlocker`/`blockerDefaultFor` 处置（载体面裁定） |
| result face | `src/cli/result-face.ts:20-25` · `src/cli/__tests__/result-face.test.ts:46` | 保留（M2 计数） |
| convergence | `src/rules/convergence.ts:33-35,78-89` · `src/cli/review.ts:155,259` | 不变（机器面） |
| finalize | `src/artifacts/handoff/finalize.ts:68-102,558-562` | `:68-102` 不变（status 编码）；材料化解构 `:558-562`（4 槽 → 3 行）随 ② 重接 + `blocker` 槽消除 + 「implement return status … without blocker」占领位兜底文案 |
| task handoff schema | `task-handoff-schema.json:171,311-318` | ② 载体裁定：`blocker` 字段（`:171`）空置（不再作为 agent 声明通道）；BLOCKED allOf（`:311-318`）调整为仅以 failure_category 支撑 |
| claim 审计 | `src/rules/documents.ts:207,213,241,350,463,800,1411-1413` | C2 判别/range/语法显式化/诊断（判别收口：CLAIM_SCAN_RE `:1411-1413` 收到 `claimTarget` 的 `^` 锚 `:207` 头部语义） |
| 输出契约 pin | `scripts/validate/smoke-cdd.ts:33,466` | 4-key 更新 |
| skills | `packages/osuperpowers/skills/cli-driven-development/SKILL.md:59,66,72,86,104,120-124` + writing-* ×4 I 节 | ①④ 判读/收敛重锚 |
| 命名档案 | `docs/maintainers/02-naming-conventions.md:8,42,70` | ③ 收编 |
| 模板常量 | `RETURN_STDOUT_BLOCK` 族（`template-contract.json`）+ task/branch/docs 派发 prompt | ② 同步（agent 输出契约 3 行 = status/commits/artifacts；引擎 stdout 4 行 = +counters） |

## 非目标

- 不改 finding severity 词汇本身（blocker/warn/nit 定级标度健康，结构不动）。
- 不重写 doc-contract validator 整体——只加判别 + range 语义 + 诊断载荷。
- 不宽容字母后缀 phase-id；点分式语法维持（正名债随 ⑦ 诊断引导兑现，不反向放宽正则）。
- 不改 engine 侧 `reviewConvergenceGuard` / `blockerCount` 机器收敛逻辑。
- 不触碰 #302/#304 之外的面（emit、pi-harness、consumer parity 既有豁免面不受波及）。

## Change history

| v1.0 | 2026-09-28 | 程序 charter：cdd review 输出面契约修正（#302 + #304 单 spec 双组件）——C1 blocker 一义一词（status 路由 / return-block 去列 / 命名收编 / skills 重锚）+ C2 claim 判别 / range / 诊断三件套；探索实证四义表与根因修正入档 | [human] · Claude Opus 5 (1M context) |
| v1.1 | 2026-09-28 | cdd spec-review r1（blocker=0，2 warn + 4 nit）全 finding 落地：⑧1 诊断示例重锚到修复后行为（字母后缀报非法不回退父行）+ ② task/branch 面 M3 载体正面裁定（stderr `CDD_BLOCKED:` 单通道 + 材料化解构 3 行重接 + task handoff schema `blocker` 字段空置/allOf 调整，`finalize.ts` 与 `task-handoff-schema.json` 补入影响面）+ agent 输出 3 行/引擎 stdout 4 行行数区分 + C1 实测根因证据按 face 分列 + ⑤ 判别改结构性规则（头部 token + 非括注）+ EOF 补换行（v1.0→v1.1） | [human] · Claude Opus 5 (1M context) |
| v1.2 | 2026-09-28 | 程序批准：Status Draft → Approved（cdd spec-review r1 收敛 blocker=0，REVIEW_FIX 收口轮 approved，零 re-review）——单 spec 合流 #302 + #304，进入 writing-plans | [human] · Claude Opus 5 (1M context) |
