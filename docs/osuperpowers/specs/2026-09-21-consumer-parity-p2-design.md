# 消费者面一致性（Consumer Parity）— P2 Design Spec

- **Version**: v1.2 · 2026-09-21（v1.0 起草 · v1.1 spec-review r1 fix 全落地：closeout 硬门 lane 边界 / 审计面 gloss + Class B 归并 / 逐 lane 链入口 / AC1 补 branch / AC4 + 漂移闭环 scope 限定 / §5 核验改 dogfood · v1.2 spec-review r2 fix 全落地：§3 lane 边界登记（#7 判定解读 · Overall updated = Yes——v1.11 sync-overall）/ C4·D4 裸记号消歧 / 核心块 blocker 单数 + docs status TIMEOUT 归属 / §2.1 行号锚改节锚 / Class B version-lineage 处置）
- **Status**: Approved
- **Author**: [human] · Claude Opus 5 (1M context)
- **Parent program**: [2026-09-21-consumer-parity-overall.md](./2026-09-21-consumer-parity-overall.md) · v1.11
- **Depends on**: P1（shipped · [p1-design v1.1](./2026-09-21-consumer-parity-p1-design.md)）；engine 实现面：`dispatch/base.ts` · `rules/documents.ts` · `rules/status.ts` · `dispatch/{task,docs,branch}.ts` · `render/brief.ts` · `templates/schema/*.json` · `templates/template-contract.json`

---

## Section 0: Incremental warning

> P2 增量仅限本 phase。跨 phase 约定见 [overall v1.11](./2026-09-21-consumer-parity-overall.md)；overall 冲突时 overall 胜。

本 spec 只做 **P2（engine lifecycle 统一抽象，breaking）** 的设计增量。仓库面退役（P3 出让脚本守卫、smoke-cdd consumer-sim）、发布闭环（P4 changesets 版本化 + breaking 发布面 + pack 审计）不属于本 phase，仅以「下游移交物」形式出现在 Section 4。P2 全部裁决已回填 overall（2026-09-21 grilling R1–R4 → v1.10 · closeout lane 边界 → v1.11 sync-overall），本 spec 给设计增量与验收面。

## Section 1: Constraints pointer

> 不重复 overall 约定；overall 冲突时 overall 胜。

引下列 overall v1.11 条目，不重述正文：
- **判据定式**（C1 可达性 / C2 结构性——v1.10 扩展：repo/skill 侧 md 模板副本全禁、schema 为唯一结构事实 / C3 退化——useless 必删、无历史叙述豁免）：overall Program charter · Cross-cutting「判据定式」段
- **Non-goals（v1.10 修订）**：不新增 cdd CLI 子命令——**唯一例外 = `cdd help`**（发现型信息子命令：打印 CLI 绝对目录 + 必要文档目录，零执法逻辑）；不改 emit 对 doc-structure（v1.10：参与面归零）、marketplace / changeset 流水
- **Cross-cutting（v1.10 修订）**：允许 breaking · spec/plan 结构定义同源派生（schema 唯一结构事实，skills 经 `cdd help` 直取，emit 不参与）· engine 零文档写入（只判只指引，回填由作者/orchestration 执行）· 本仓四表仍受 `scripts/validate/overall-consistency.ts` 机器校验直至 P3 · 本仓 = canary
- **四表纪律 #7（closeout 统一规则）**：overall v1.10/v1.11 定义（声明源 ↔ 列双向全列 + engine 派生终态并入声明源 + pre-flight 硬门 + post-flight 高亮 recommand + 回填由 orchestration 执行；**v1.11 二门面判读**——结构性面 mismatch 非空 → BLOCK、终态欠账 pre-flight fail-open + lane 边界，见 §2.2）
- **语言**：Strategy B（spec/plan 中文）；SKILL.md / docs 英文主源不动（语义化在 P2 内英文落地）

## Section 2: Design body

P2 增量 = **engine lifecycle 统一抽象（breaking）**，四大设计面 + breaking/测试面。全部判定已随 overall v1.10/v1.11 落盘；本节给机械形态、组件边界与验收。

### 2.1 全量 charter 审计（docContractValidate 扩面）

**现状基线**（P1 实证）：`dispatch/base.ts:117` 的 pre-flight hook `docContractValidate` 仅 `TaskLifecycle`（`dispatch/task.ts:515`）override；docs / branch 通道继承 base no-op → 改 spec/plan 文档不经过任何契约校验。necessary subset 现承载于 `rules/documents.ts`（`validateDispatchDocuments`：plan 契约 → Class A `**Spec:**` 解析 + label==basename → Class B `**Parent program**` → `-overall.md` + version lineage → overall 契约：canonical 表头 / row-shape / change-history 严格递增）；Class B phase 注册检查**仅当 plan basename 带 `P\d+`** 时触发。

**设计**：

1. **触发 = lineage 驱动（overall v1.10「lineage 驱动触发」）**：dispatch 上下文文档链（plan → `**Spec:**` → `**Parent program**` → overall）resolve 出 parent overall → 整程序**四表一次齐查**；**链入口逐 lane**：task = dispatch 的 plan、docs = 目标 spec/plan 文档本身、branch = `--plan` ref（branch.ts:276，同 plan workspace）；resolve 不出（单 spec 程序 / 无 parent program）→ 四表审计 no-op、necessary-subset（plan 契约 + Class A）恒跑（无锚 no-op 同构原则；Class B / overall 契约无 parent overall 时天然 no-op——同 §2.1 item 6 边界句措辞）。触发判定与 Class B lineage 复用同一解析面，零配置、消费者无害。
2. **审计面**（整体四表 + 附带，返回 mismatch/未合法集）：
   - **A1 双向 backfill 声明 ↔ 列**：forward（change-history claim ⇒ Phase inventory 列非 `[Pending]`）+ reverse（列已完成 ⇒ change-history 有 match claim）——**plan + design 全列**（closeout 统一规则并 2.2，无 plan-only 遗留）；
   - **A2 文档存在性 glob**：Phase inventory Design-spec / plan 列引用文档存在于仓库（slug glob）；
   - **A3 依赖图成员**：dep-graph ASCII 边 + Dependency 列 ∈ Phase id 集合；
   - **A4 锚点注册域**：锚点（issue refs）∈ overall 文档 Issue inventory 表行；无锚 no-op（不依赖 GitHub 数据）；
   - **④ phase 注册完整性**：lineage resolve 出 overall 即必查——phase 身份经 overall Phase inventory 解析（Design-spec 列链接 → plan `**Spec:**` 上溯），**不依赖 basename P 编号命名**；
   - **⑥ issue 行 well-formed**：row-shape / Phase ∈ ids。
   - 标签对应 gloss：A1–A4 ↔ 四表纪律第 1/2/3/5 条（`双向 backfill 声明 ↔ 列` / `文档存在性` / `依赖图成员` / `锚点注册域`）；④/⑥ ↔ 纪律第 4/6 条（`phase 注册完整性` / `issue 行 well-formed`），随必要子集并入全量审计与 engine 判据面、不单列、不计入四表（overall v1.10 四表纪律枚举）。
3. **necessary 子集透镜并入**：`validateDispatchDocuments` 重构为**单一审计入口** + per-doc-type 检查面（plan 契约 / Class A / Class B / overall 契约成为全量审计的必要成员，不单列、不双实现）；**Class B 归并口径**：既有基线 Class B 的 phase 注册子检查（仅当 basename 带 `P\d+`）**迁入 ④**（item 2：phase 身份经 overall Phase inventory 解析、不依赖 P 编号命名），Class B 仅保留 Parent program → overall 解析 + overall 契约面（canonical 表头 / row-shape / change-history 严格递增 + **version-lineage 子检查**——plan/spec 的 **Version**/claim 必须引用 overall 当前 **Version:** ∪ change-history 版本 cell（`rules/documents.ts` VERSION_HEADER_RE / HISTORY_VERSION_CELL_RE / overallTokenVersions 语义），**并入 overall 契约面**、经 2.3 canonical change-history 版本规则 + CLAIM_RE 版 claim 模式承接整体版本 token，fabricated / future token 失败——不静默丢弃，必要成员不静默丢失）——phase 注册面单一实现（AC7），无双重实现；`rules/documents.ts` 重构落点。
4. **全通道**：`docContractValidate` / `statusValidate` **提升 base 默认 override**（见 2.4）——task / docs / branch 三通道全生效；overall 自身为 review 对象 → 以自身为 overall 跑全量自审。
5. **失败语义（overall 验收原样）**：非 dry-run **结构性 mismatch（缺失 cell / 缺 claim）非空 → BLOCKED（exit 1）+ 逐项指引**（`formatDocFailures` 形状：`- [artifact] file — 字段: missing → fix`）；**终态欠账成员 pre-flight fail-open**（post-flight 高亮 + 咬合点，见 2.2 lane 边界）；dry-run → stderr **CDD_WARN、exit 0**；退出码语义不变。
6. **边界**：无 parent overall → 四表 no-op、necessary-subset 恒跑；engine 派生终态声明源仅当 plan workspace 存在时可得（见 2.2，非豁免——声明源缺席）。

### 2.2 closeout 统一规则（声明源 ↔ 列，overall v1.10/v1.11 #7）

**模型**：审计合法状态 = **声明源 ↔ 列，双向全列**。声明源 ＝ `{change-history claims} ∪ {engine 派生终态}`：

- **doc claims → 列**：forward（claim ⇒ 列非 `[Pending]`）+ reverse（列已完成 ⇒ change-history 有 match claim）——plan + design 全列；claim 模式沿用 `CLAIM_RE` 族（`(Pending|[Pending]) → …` + plan/design 链接词），其定义迁入 2.3 canonical（不再 hand-written repo 侧）。
- **engine 派生终态 → 列**：plan-complete（`rules/status.ts derivePlanVerdict.done`）⟺ overall 对应 plan 列已回填（非等待 + claim 存在）。engine 态作为文档外事实源——欠账检查（plan 终态未回填）即本规则的终态应用，不是独立规则。

**mismatch 单一推断模块**（engine rules 单点计算）：输入 = overall 解析（四表）+ 声明集 + engine 终态（plan workspace 可得时）；输出 = mismatch 集（逐项列缺口：缺失 cell / 缺 claim / 终态未回填）。mismatch 分两**门面**——**结构性不合法**（缺失 cell / 缺 claim）与**终态欠账**（plan-complete 未回填）——硬门只压结构性面，终态欠账走 post-flight + 咬合点（见下 lane 边界）。**pre-flight 与 post-flight 同源消费**——改此处一处，两通道同效（零双实现，可断言）。

**pre-flight 硬门**（docContractValidate，2.1 内）：**只压结构性面（缺失 cell / 缺 claim）**——结构性 mismatch 非空 → BLOCKED + 逐项指引（「先 backfill-overall：version bump + change-history claim + 列回填」，可 diff 缺失面）；**终态欠账（plan-complete 未回填）面 pre-flight fail-open（不 BLOCK）**——强制落点 = post-flight 高亮 + 咬合点（lane 边界，见下）；dry-run CDD_WARN 不变。

**post-flight 高亮 recommand**（statusValidate）：识别 plan-complete（`derivePlanVerdict.done`）且 mismatch 含「终态未回填」→ stdout **高亮**打印下一步回填（可 diff 列态缺口，指向 overall 路径——Class B lineage 已知）；**exit 不变、fail-open**——「回填由 orchestration 执行」的指引面。

**无死锁论证**（设计约束）：`done` 仅终态触发（全部 task complete + review APPROVED；Review Convergence 后不跨 round 重审）→ 终态与 finishing / 回填之间**确有 cdd dispatch**——branch-review → branch-fix 的 engine-closed 闭环携带 plan workspace 且正位于「plan done」与「finishing 回填」之间。**lane 边界（终态成员硬门语义）**：硬门只对四表结构性不合法（缺失 cell / 缺 claim）BLOCK；**终态欠账面 pre-flight fail-open**，强制落点 = post-flight 高亮 + 咬合点——咬合点 = 终态后首个携带该 plan workspace 的后续 dispatch（彼时 finishing 已执行回填，欠账应已清；仍欠账 → BLOCK，宣告回填义务未履行）。**branch 通道 pre-flight 排除终态成员**（只算结构性面）：其闭环 dispatch 恒位于 finishing 回填之前、不可能成为合法咬合点——排除是时序语义推导而非 lane 豁免常量（AC7）；由此 branch 闭环不被欠账 BLOCK → finishing / 回填得以执行 → 多 phase 程序 happy-path 无死锁。`task` 通道 dispatch 期间 plan 未 done → 终态成员零命中；`docs` 通道无 plan workspace → engine 终态声明源缺席 → 该成员天然 no-op（声明源缺席语义，非豁免）。fresh checkout 无 progress.json → `derivePlanVerdict.done=false` → 零误伤。

### 2.3 doc-structure 同源派生（schema 唯一结构事实）

**canonical**：engine 包内 **JSON Schema（draft 2020-12）+ `description`**（description = 写作指引，取代 md 模板散文角色）。覆盖 doc 类型：
- **overall schema**：`## Issue inventory` / `## Phase inventory` / `## Dependency graph` / `## Change history` 表头 + 列名（7 列 header）、行形（cell count）、claim 模式（`CLAIM_RE` 族 / plan+design 链接词）、change-history 版本规则；
- **plan schema**：header 字段（`**Spec:**` line-2 · `**Parent program**` · `**Version**`）、`### Task N:`（冒号形）、`- **验收**:`、`## Constraints`（字面 + prose-anchor 指针四元 `口径` / `commit 边界机制` / `Flow Atomicity` / `顺序原则`）、pending-acceptance-patch 面；
- **phase-spec schema**：header 块（Version/Status/Author/Parent program/Depends on）、Section 0–5 骨架、`### Acceptance criteria` 唯一子节；
- **add-phase-protocol 面**：注册 checklist 结构（四表行 / dep 边 / change-history 行 / 锚点形式）。

**消费通道 = `cdd help`（overall v1.10 Non-goal#1 carve-out）**：新增 `cdd help` 子命令——打印 **cdd CLI 所在绝对目录** + **必要文档目录**（schemas / templates 等）；skills 的 `read-template` 节点改写为「运行 `cdd help` → 读 schema → 按 schema + description 成文」；**零硬编码路径**（消费者安装面与 dev 直调面皆由运行时实测）；`cdd help` 零执法逻辑（不触发审计、不改 exit 语义）。

**engine 同构消费**：docContractValidate（2.1 审计 token + necessary-subset）+ brief 抽取从同一 schema 派生——保留单点 schema 加载（engine 包内、随包发布），删现有硬编码 token（`documents.ts` SPEC_MARK/PARENT_MARK/VERSION_HEADER_RE/HISTORY_VERSION_CELL_RE 等、`render/brief.ts` `### Task ${n}:`、`dispatch/task.ts` PLAN_CONSTRAINTS 面 token）与 SKILL.md 散文 token 的双手写。

**存量 md 模板退役**：`writing-overall-spec/docs/overall-spec-template.md` · `writing-phase-spec/docs/phase-spec-template.md` · `writing-overall-spec/docs/add-phase-protocol.md` 随 schema 落地**退役删除**（grep 零残留断言）；其结构事实归 canonical。**模板/文档执法位迁移（overall P2 scope (3) 既有裁决——2026-09-21 grilling）**：add-phase-protocol 等标注 lifecycle 执法位、移除「机械守卫在本仓 scripts 侧」的表述——schema 承载结构事实，skill 文档承载「执法位 = engine lifecycle」指引。

**漂移闭环**：agent 按 schema 成文 → 后续 dispatch docContractValidate 依同一 schema 校验；结构 token 无第二副本（grep 零 md 模板副本可机械断言，overall 验收「doc-structure 单源实证」）。**scope 限定**：零第二副本断言仅覆盖 engine 包内手动 token 面 + SKILL.md 散文 token 面 + repo/skill 侧 md 模板副本；`scripts/validate/overall-consistency.ts` 之手写结构 token 残留属 till-P3 退役面（§4 S1/S2 + F8a 处置位），不在本 phase 断言范围。

### 2.4 harness 契约单源（lifecycle 契约统一）

**一个 lifecycle 契约**：task / docs / branch 三通道共享——handoff schema 核心块统一：`status`（APPROVED/BLOCKED/CHANGES_REQUESTED/**TIMEOUT**——统一契约使 docs-family status enum 增 TIMEOUT：现行 docs-handoff-schema status = [APPROVED, CHANGES_REQUESTED, BLOCKED] 无 TIMEOUT，升级为与 task-family 同枚举 = docs 面 breaking，随本节 breaking 版本面 + AC6/docs 逆转面声明）· `commits{base,head}`（base `^[0-9a-f]{40}$`）· `artifacts` · `findings` · `failure_category` · `blocker` …；lane 差异仅**边界物**（docs: `doc_path`/`doc_hash`；task: `task`/progress；branch: `--base/--head` ref 语义）。

**docs handoff 逆转**：`templates/schema/docs-handoff-schema.json` **删除「Docs rounds carry no commits field」显式声明段**，增 `commits{base,head}`（与 task-family 同形状）——出口门对 docs fix 的 commit 记账判据由此成立（overall P2 scope §(4)「逆转既有显式声明」）；**status enum 增 TIMEOUT**（升级为与 task-family 同枚举、一致契约核心块——docs 面 breaking，随本节 breaking 版本面声明）。

**round-context base token**：docs round 增 base token（与 task-family `TASK_FIXED_POINT` 同位语义：作用于点 = dispatch 入口 base）；token 名 / 渲染经 canonical（`template-contract.json` round-context zone）定义并随 schema 单源消费。

**出口门**：判据不变（返回时 clean tree）；docs fix 未 commit → **BLOCKED + stdout 可见诊断**（「uncommitted changes at return — 先 commit 再返回」）——docs-family 出口门诊断落地（overall v1.4 known-gap 登记 · 同契约束轮次确定性实证）；同契约束轮次行为确定性（commit → APPROVED；未 commit → BLOCKED）为验收实证（overall「docs-family 契约确定性实证」）。

**base 默认 override 化**：`docContractValidate` + `statusValidate` 从「task-only override」提升为 **base 生命周期默认钩子**（2.1/2.2 全通道生效）；lane 只声明审计对象（doc 列表 / plan / branch ref）。

**breaking 版本面**：handoff schema + round-context + lifecycle 契约结构升级 = **cdd-engine major bump**（overall「breaking 版本面 = major」）；`templates/` 与 schema 变更随包发布（消费者面契约变化，P4 发布闭环承载版本化）。

### 2.5 测试面与零债断言（engine colocated，vitest，`src/**/__tests__/**/*.test.ts`）

1. **全量审计**：四表各面非法态 → BLOCKED + 指引（含 lineage no-op 场景、dry-run CDD_WARN 降级）；全通道（task/docs/branch）挂门断言；overall 自审边界。
2. **closeout 统一推断**：mismatch 集计算正确性（forward / reverse plan+design / engine 终态面）；pre-flight 门输出；post-flight 高亮输出可捕获（stdout 断言）；同源——改推断一处、两通道行为同变（回归断言）。
3. **契约确定性**：同契约束轮次（docs fix 一 commit / 一未 commit）→ 行为类一致；BLOCKED stdout 诊断可见。
4. **doc-structure 单源**：改 canonical 定义一处 → engine 校验/抽取同步（派生 token 断言）；grep 零 md 模板副本、零第二手工 token（scope 同 AC4——engine 内手动 token + SKILL.md 散文 token + repo/skill md 模板副本；`scripts/validate` 侧残留归 §4 P3 退役面，不入断言）。
5. **`cdd help`**：输出 CLI 绝对目录 + 必要文档目录正确；零执法逻辑（不触发审计、exit 语义不变）。

### Acceptance criteria

- AC1 **全量审计落地面**：任意 dispatch（implement/review/fix/docs/branch 家族——含 branch-review / branch-fix）涉 parent overall 四表结构性不合法 → BLOCKED（exit 1）+ 逐项指引；真实 dispatch 树不洁之外无豁免；lineage 未 resolve → 四表 no-op、necessary-subset（plan 契约 + Class A）恒跑；dry-run → CDD_WARN 降级。（终态欠账面另则：AC3 · §2.2 lane 边界。）
- AC2 **全通道挂门**：task/docs/branch 三通道 docContractValidate / statusValidate 均生效（base 默认 override，测试断言）；overall 自身为 review 对象时自审。
- AC3 **closeout 统一规则**：声明源 ↔ 列双向全列（forward + reverse，plan + design，无 plan-only 遗留）且 engine 派生终态并入声明源；mismatch 集单一推断模块（无第二实现，断言）；pre-flight 结构性 mismatch 非空 → BLOCKED + 指引、**终态欠账 mismatch pre-flight fail-open**（post-flight 高亮 + 咬合点，§2.2 lane 边界）、post-flight plan-complete 且未回填 → 高亮回填 recommand（同源输出；exit 语义不变）；engine 零文档写入（回填由 orchestration 执行）。
- AC4 **doc-structure 单源实证**：改 canonical 定义一处 → engine 校验/抽取同步生效 + skills 经 `cdd help` 消费同源产物；grep 零 md 模板副本、零第二处手工 token（**scope**：engine 包内手动 token + SKILL.md 散文 token + repo/skill md 模板副本；`scripts/validate` 侧残留 token 归 §4 P3 退役面 S1/S2 + F8a 处置位，非 AC4 断言对象）；`templates/` schema 随包可寻址。
- AC5 **`cdd help` 落地面**：打印 CLI 绝对目录 + 必要文档目录正确；零执法逻辑；skills 零硬编码路径。
- AC6 **harness 契约确定性**：docs-handoff `commits{base,head}` 字段落地（逆转旧声明段）+ **status enum 增 TIMEOUT**（与 task-family 同枚举、核心块统一）；round-context docs base token 落地；同契约束轮次行为一致（提交 → APPROVED；未提交 → BLOCKED + stdout 可见诊断）。
- AC7 **零债断言**：无 plan-only 遗留 · closeout 推断无第二实现 · 无豁免例外常量（声明源缺席语义替代）· handoff schema 无双核心块 · base 默认 override 全通道生效。
- AC8 **breaking 版本面**：cdd-engine major bump 面明确（handoff schema + round-context + lifecycle 契约结构升级）；本仓与消费者同一条 engine 执法路径（无 scripts 侧兜底依赖）。
- AC9 **存量 md 模板退役**：overall-spec-template / phase-spec-template / add-phase-protocol md 模板删除，结构事实归 canonical（grep 零残留）。

## Section 3: Deviations from overall

| Overall assumption | Phase decision | Overall updated? |
|---|---|---|
| Non-goal#1「不新增 cdd CLI 子命令」 | 唯一例外 = `cdd help`（发现型信息子命令：打印 CLI 绝对目录 + 必要文档目录，零执法逻辑） | Yes — v1.10 · 2026-09-21 |
| Non-goal#2「emit 内部流水改动仅限 doc-structure 模板渲染目标 + emit:check」 | emit 对 doc-structure 参与面归零（canonical schema 随包发布、skills 直取，无 md 模板产物、无 emit:check 该面） | Yes — v1.10 |
| 判据 C2「repo 侧人肉第二副本 = 违规」 | 扩展：repo/skill 侧 md 模板副本全禁，schema 为唯一结构事实 | Yes — v1.10 |
| P2 scope「spec/plan 结构定义同源派生 → emit 渲染 skill 侧 templates」 | 改：canonical JSON Schema + descriptions，skills 经 `cdd help` 直取成文，存量 md 模板退役 | Yes — v1.10 |
| P2 scope「F13 类机械封死 / 未回填不给 complete」 | 改：closeout 统一规则（声明源↔列双向全列 + engine 派生终态并入声明源 + mismatch 单一推断 + pre-flight 硬门 + post-flight 高亮 recommand；回填由 orchestration 执行） | Yes — v1.10 |
| P2 scope「harness 契约统一——docs-family commit 义务 concretize」 | 升级：lifecycle 契约单源（task/docs/branch 共享核心块 + base 默认 override 全通道 + breaking major） | Yes — v1.10 |
| 验收 E2「closeout 未回填时 plan 终态不判 complete」 | 改订（对父整体 #7『mismatch 非空 → BLOCK』与『post-flight plan-complete recommand』两条字面张力的**判定解读**，非新增偏离——r1 引入的 lane 边界）：**pre-flight 结构性 mismatch（缺失 cell / 缺 claim）非空 → BLOCK + 逐项指引**；**终态欠账（plan-complete 未回填）mismatch pre-flight fail-open**、post-flight 高亮回填 recommand（回填由 orchestration 执行）；**branch 通道 pre-flight 排除终态欠账成员**（时序语义推导，非 lane 豁免常量）；退出码语义不变 | Yes — v1.11（2026-09-21 sync-overall：二门面判读 + lane 边界回填） |

> `Overall updated?` 全为 Yes（v1.10 grilling R1–R4 裁决回填 · v1.11 r1 lane 边界 sync-overall 回填）——无未登记偏差。

## Section 4: Notes for downstream

- **P3（本仓校验面重建）**：输入 = S1/S2（`overall-consistency.ts` / `plan-spec-anchors.ts`）退役 + S3 活文档残留簇（file:line 已列 P1 design §2.2）+ S4 consumer-sim + 42 用例迁移面。P2 后此面两端变化：charter token 已入 canonical（P3 接线走 engine 同路径）、docs-handoff 契约已统一（P3 smoke-cdd 面按新契约升级 consumer-sim）；**F8a `\bH1\b` 守卫扫面盲区（scripts/ 不在 ALL_MECH_POSITIONS）处置位 = P3**（随 smoke-cdd/守卫退役面）。
- **P4（发布闭环）**：输入 = S6（.changeset ×2 声称）+ ×9 旧 changesets 版本化 + cdd-engine major breaking 发布面（本 phase 全部变更）+ pack 内容审计（`cdd help`、canonical schema、templates/ 均为发布面内容）。
- 本 phase 无「later phases 会处理」悬空项——所有跨 phase 移交均落上游 overall（v1.10/v1.11）或本 §4 指针。

## Section 5: Review

- **Baseline = committed tree**：进入 review 前工作树干净（entry gate）；review 读 dispatch 入口时的 committed tree。
- **Convergence**：blocker > 0 → fix 全部 findings → 重审；blocker = 0 → fix 全部（warn/nit 含）→ 停，不再审（Review Convergence，CLAUDE.md）。
- 本 spec 经 `cdd review --type spec --spec docs/osuperpowers/specs/2026-09-21-consumer-parity-p2-design.md` 单轮收敛；**known gap**（overall v1.4 登记）：docs-family fix 通道 commit 义务已由 P2 自身设计承载——**本 spec 自身的 fix 轮次除外**（`commits{base,head}` 字段是 P2 实现产物；现行 docs-handoff schema 显式声明「Docs rounds carry no commits field」，强写即违约 → engine 重写 BLOCKED）。该核验动作改述为 **P2 落地后的 dogfood 实证**（§2.5 test item 3 契约确定性用例 / §4 consumer-sim 按新契约升级后）。
