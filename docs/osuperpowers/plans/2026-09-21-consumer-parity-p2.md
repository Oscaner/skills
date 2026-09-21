# 消费者面一致性（Consumer Parity）P2 实施计划 — engine lifecycle 统一抽象
**Spec:** [2026-09-21-consumer-parity-p2-design.md](docs/osuperpowers/specs/2026-09-21-consumer-parity-p2-design.md)

- **Parent program**: [2026-09-21-consumer-parity-overall.md v1.11](../specs/2026-09-21-consumer-parity-overall.md)
- **Depends on**: P1（shipped）；P2 design v1.2 Approved（`7b34a72e`）
- **Base**: develop（finishing read-base 数据源；consumer-parity-p2 工作分支）

## Constraints

### 口径

P2 是 **engine 实现 phase（breaking）**：实现面 = canonical doc-structure schema 单源 + `cdd help` 子命令 + engine 同构消费迁移 + 全量 charter 审计 + closeout 统一规则 + harness 契约单源 + breaking major 版本面；**零新增执法 CLI 子命令**（唯一例外 = `cdd help`，零执法逻辑）。所有 engine 改动 `pnpm run validate` 12 块全绿 + block 12 自检 2/2 + `emit:check` 零 drift（本仓自用程序四表仍受 scripts 守卫直至 P3——本 phase 不得破坏该面）。engine 零文档写入（回填由 orchestration 执行）；SKILL.md / docs 英文主源；schema canonical 先落 → 消费迁移 → 审计/契约接线（顺序原则）。

### commit 边界机制

dispatch 两端门——入口门（进入 review 前工作树干净）+ 出口门（产生修改的 dispatch 后修改已提交）。**known gap**（overall v1.4 登记 · P2 自身设计承载）：T5 落地前 docs-handoff schema 显式声明「无 commits 字段」→ 本 plan 的 review/fix 轮次（T1–T5 前）fix agent 无法在 handoff 声明 commits → **编排者核验 handoff + 缺则补提交**（canary 实证）；T5 落地后由新契约承载（与 task-family 同面）。changeset：P2 = engine package 面 → **收口建 1 个 major changeset**（breaking 面，overall「changeset 逐 phase 建」；P1 无 package 面不建空 changeset 的裁决不适用于本 phase）。

### Flow Atomicity

六任务线性链、逐任务可独立验证：T1（schema + `cdd help`）→ T2（engine 同构消费迁移 + md 模板退役）→ T3（全量审计 + base 默认 override）→ T4（closeout 统一规则）→ T5（harness 契约单源）→ T6（breaking 版本 + 零债收口）。每任务引擎测试就近落（`src/**/__tests__/**/*.test.ts`）；任务间不放跨任务悬空项（发现即回填 spec/overall 再继续）。

### 顺序原则

canonical（T1）先于消费迁移（T2）——审计 token 一律从 schema 派生，避免手写 token 两代共存；审计基础设施（T3）先于 closeout 规则（T4）——mismatch 推断模块消费审计面；契约单源（T5）为修改面、可与审计并行但按依赖置后；T6 收口聚合零债断言 + 版本面。每步 validate 保持全绿。

---

### Task 1: canonical doc-structure JSON Schema + `cdd help` 子命令（design §2.3 · AC5）

- **Do**: ① engine 包内新建 canonical doc-structure 定义（`packages/cdd-engine/src/documents/schema/`）：**JSON Schema（draft 2020-12）+ `description`**，覆盖 doc 类型——overall（四表表头 + 7 列名 / 行形 / claim 模式 `CLAIM_RE` 族 + plan/design 链接词 / change-history 版本规则）/ plan（header 字段 `**Spec:**` · `**Parent program**` · `**Version**`——解析语义沿既有契约：`**Spec:**` 任意行 findIndex（`resolveSpecFromPlan` 语义；line-2 为模板/示例惯例而非 schema required-position）、`**Version**` 仅 phase-spec 严格 required、plan 头 `**Version**`/line-2 落为示例字段；`### Task N:` 冒号形 / `- **验收**:` / `## Constraints` 字面 + prose-anchor 指针四元 / pending-acceptance-patch 面）/ phase-spec（header 块 / Section 0–5 骨架 / `### Acceptance criteria` 唯一子节）/ add-phase-protocol 面（注册 checklist 结构）；② 新增 **`cdd help` 子命令**（overall v1.10 Non-goal#1 carve-out）：打印 **cdd CLI 所在绝对目录** + **必要文档目录**（schemas 目录 / templates 目录），供 AI 定位资源；**零执法逻辑**（不触发审计、不改 exit 语义）；③ schema 目录与模板目录路径由 `cdd help` 输出（消费者安装面与 dev 直调面皆运行时实测）；④ engine 单点 schema 加载器（随包发布的可寻址路径）。
- **验收**: `cdd help` 输出 CLI 绝对目录 + schemas/templates 目录且路径实测存在（dev 直调与模拟消费者安装两态）；schema 文件符合 draft 2020-12 校验（description 全覆盖四个 doc 类型结构面）；help 不触发审计、exit 0；`packages/cdd-engine` vitest 就近用例绿（AC5）；新 schema/document 目录零事务性行为。
- **注**: 本任务只建 canonical + 发现通道，**不迁移任何消费方**（T2 起步时才迁移）；是 T2/T3 的机械前提。

### Task 2: engine 同构消费迁移 + 存量 md 模板退役（design §2.3 · AC4/AC9）

- **Do**: ① `rules/documents.ts` 结构 token 迁移——删除手写硬编码（SPEC_MARK/PARENT_MARK/VERSION_HEADER_RE/HISTORY_VERSION_CELL_RE/CLAIM 模式等），改由 Task 1 canonical schema 派生/加载（`validateDispatchDocuments` 相关断言 token 单源）；② brief 抽取迁移——`render/brief.ts` `### Task ${n}:` 与 `dispatch/task.ts` PLAN_CONSTRAINTS 面（字面 `## Constraints` + PROSE_ANCHORS 四元）token 改由 schema 派生；③ 存量 md 模板退役——删除 `packages/osuperpowers/skills/writing-overall-spec/docs/overall-spec-template.md` · `packages/osuperpowers/skills/writing-phase-spec/docs/phase-spec-template.md` · `packages/osuperpowers/skills/writing-overall-spec/docs/add-phase-protocol.md`，结构事实归 canonical（grep 零残留）；④ skills `read-template` 节点改写为 `read-schema`（运行 `cdd help` → 读 schema → 按 schema + description 成文；**零硬编码路径**）；⑤ **C4 模板/文档执法位迁移**（overall v1.10 P2 行（3）既有裁决）：add-phase-protocol 等标注 lifecycle 执法位、移除「机械守卫在本仓 scripts 侧」表述——schema 承载结构事实、skill 文档承载「执法位 = engine lifecycle」指引。
- **验收**: TC 单源实证——改 canonical 定义一处 → engine 校验/抽取同步生效（派生 token 断言：`grep` 删除面零残留）；`grep` 零 md 模板副本 / 零第二处手工 token（scope：engine 包内手动 token 面 + SKILL.md 散文 token 面 + repo/skill md 模板副本；`scripts/validate` 侧残留归 §4 P3 退役面，非本任务断言对象——design AC4 scope 限定）；skill `cdd help` 引导路径可执行（消费者面零硬编码路径）；engine vitest（schema 派生 token 断言 + read-schema / brief 抽取等模板退役后的额外消费面）全绿；`pnpm run validate` 全绿（含 5c residue / block 12 自检——本仓现存 spec/plan 集经新解析路径零新增失败，**plans/*.md 全集作 plan-schema 解析语义 canary**：`**Spec:**` 任意行 findIndex · `**Version**` 仅 phase-spec 严格——既有契约语义承接）。
- **注**: 迁移后 `validateDispatchDocuments` 的 pre-flight 入口语义不变（T3 重构 single entry 时保留）；C4 是 P2 面（schema 落地后即刻），非 P3。

### Task 3: 全量 charter 审计 + base 默认 override（design §2.1 · AC1/AC2）

- **Do**: ① **lineage 驱动触发**——dispatch 文档链（plan → `**Spec:**` → `**Parent program**` → overall）resolve 出 parent overall → 整程序四表一次齐查；**逐 lane 链入口**（task = dispatch plan、docs = 目标 spec/plan 文档本身、branch = `--plan` ref）；resolve 不出 → 四表 no-op、necessary-subset（plan 契约 + Class A）恒跑（Class B / overall 契约无 parent overall 时天然 no-op）；② 审计面四表 + 附带全量（token 自 Task 1 canonical）：① 双向 backfill 声明 ↔ 列（closeout 部分 T4 接线）、② 文档存在性 glob、③ 依赖图成员、④ phase 注册完整性（phase 身份经 overall Phase inventory 解析、不依赖 basename P 编号）、⑤ 锚点注册域（无锚 no-op）、⑥ issue 行 well-formed（Class B 旧有 phase 注册子检查迁入 ④，Class B 仅保留 Parent program → overall 解析 + overall 契约面；version-lineage 子检查并入 overall 契约面——canonical change-history 版本规则承接）；③ **necessary 子集透镜并入**——`validateDispatchDocuments` 重构为**单一审计入口** + per-doc-type 检查面，plan 契约 / Class A / Class B / overall 契约成为必要成员（不单列、不双实现）；④ **base 默认 override**——`docContractValidate` 提升 base 生命周期默认钩子（task/docs/branch 全通道生效；lane 声明审计对象；overall 自身为 review 对象时自审）；⑤ 失败语义（原样）：非 dry-run 结构性 mismatch 非空 → BLOCKED（exit 1）+ 逐项指引（`formatDocFailures` 形状）；dry-run → CDD_WARN、exit 0；退出码语义不变。
- **验收**: AC1——任意 dispatch（implement/review/fix/docs/branch 家族——含 branch-review/branch-fix）涉 parent overall 四表结构性不合法 → BLOCKED + 指引；lineage 未 resolve → 四表 no-op、necessary-subset 仍跑；dry-run 降级 CDD_WARN 且 exit 0；AC2 部分（docContractValidate 面）——三通道 docContractValidate 均生效（base 默认 override 测试断言）、overall 自审边界用例（AC2 的 statusValidate 半面挂点见 T4 验收）；四表面逐面非法态用例（①–⑥ each → BLOCK）；Class B 归并 + version-lineage 并入处置回归（documents.ts 单实现断言——AC7「无双重实现」）；engine vitest 就近全绿 + `pnpm run validate` 全绿。
- **注**: 本任务是审计骨架（结构性面）；closeout 终态欠账 与 高亮 recommand 在 T4 接线（本任务 ① 双向只接 doc claims ↔ 列结构性面）。

### Task 4: closeout 统一规则（design §2.2 · AC3 · AC7 部分）

- **Do**: ① **mismatch 单一推断模块**（engine rules 单点）：输入 = overall 解析（四表）+ 声明集 + engine 派生终态（plan workspace 可得时：`derivePlanVerdict.done`）；输出 = mismatch 集，分两门面——**结构性**（缺失 cell / 缺 claim）与**终态欠账**（plan-complete 未回填）；② **pre-flight 硬门接线**——结构性面 mismatch 非空 → BLOCKED + 逐项指引（复用 Task 3 失败语义）；**终态欠账面 pre-flight fail-open（不 BLOCK）**；③ **lane 边界**（overall v1.11 回填）：branch 通道 pre-flight 排除终态欠账成员（其闭环 dispatch 恒位于 finishing 回填之前、非合法咬合点——时序语义推导、非 lane 豁免常量）；docs 通道无 plan workspace → engine 终态声明源缺席 → 该成员天然 no-op（声明源缺席，非豁免）；④ **post-flight 高亮 recommand**——`statusValidate` 提升 base 默认（lanes 生效）；识别 plan-complete 且 mismatch 含「终态欠账」→ stdout 高亮打印下一步回填（可 diff 列态缺口、指向 overall 路径——Class B lineage 已知）；**exit 不变、fail-open**；⑤ 无死锁回归——branch-review → branch-fix 闭环在 plan-done ∧ overall 未回填时不被欠账 BLOCK（happy-path 用例）；fresh checkout 无 progress.json → 零误伤。
- **验收**: AC3——声明源 ↔ 列双向全列（forward + reverse，plan + design，无 plan-only 遗留）且 engine 派生终态并入声明源；mismatch 集单一推断模块（改一处、pre/post 两通道行为同变——同源回归断言）；结构性 mismatch → BLOCK + 指引；终态欠账 mismatch pre-flight fail-open（不 BLOCK）+ post-flight 高亮回填 recommand（stdout 可捕获断言，exit 语义不变）；AC2 部分（statusValidate 面）——task/docs/branch 三通道 statusValidate base 默认生效（含 post-flight 高亮单通道行为断言）；spec §2.2 咬合点正例处置登记（合法咬合点集合为空的时序推导 + 语义承载面 + 来源声明，见注——非静默删减）；branch lane 边界 + docs 声明源缺席 + fresh checkout 用例；engine 零文档写入（回填不落 engine 代码——设计约束断言）；engine vitest 就近全绿 + `pnpm run validate` 全绿（block 12 自检仍 2/2）。
- **注**: 本任务完成 closeout 两门面机械；AC7「无豁免例外常量」于此验证（lane 边界是时序推导非常量）。**咬合点正例登记**（spec §2.2：「终态后首个携带该 plan workspace 的后续 dispatch 仍欠账 → BLOCK」）：当前单 phase 单 plan 线性 loop 下合法咬合点集合为**空**——task 通道 dispatch 时 plan 未 done（终态成员零命中）、branch 通道被本任务 ③ 时序排除（恒在 finishing 回填之前）、docs 通道无 plan workspace（终态声明源缺席）、finishing 回填后不再有携带该 workspace 的 dispatch；故正例 BLOCK 无合法触发点，其语义由本任务 ② fail-open + ④ 高亮承载（回填义务归 orchestration/finishing）——声明来源 spec §2.2、非静默删减（时序推导面，同 AC7「无豁免例外常量」面）。

### Task 5: harness 契约单源（design §2.4 · AC6 · breaking 面）

- **Do**: ① **lifecycle 契约核心块统一**——handoff schema 核心字段对齐：`status`（APPROVED/CHANGES_REQUESTED/BLOCKED + TIMEOUT——docs status enum 增 TIMEOUT，breaking 面声明）/ `commits{base,head}`（base `^[0-9a-f]{40}$`）/ `artifacts` / `findings` / `failure_category` / `blocker`（单数）/ `changes` / `round`…统一核心、lane 差异仅边界物（docs: `doc_path`/`doc_hash`；task: `task`/progress；branch: `--base/--head` ref 语义）；② **docs handoff 逆转**——`templates/schema/docs-handoff-schema.json` 删除「Docs rounds carry no commits field」显式声明段，增 `commits{base,head}`（与 task-family 同形状）；③ **round-context docs base token**——docs round 增 base 作用点 token（与 task-family `TASK_FIXED_POINT` 同位语义：= dispatch 入口 base）；token 名/渲染经 canonical（template-contract.json round-context zone）；④ **出口门**——判据不变（返回时 clean tree）；docs fix 未 commit → BLOCKED + stdout 可见诊断（「uncommitted changes at return — 先 commit 再返回」）；⑤ **契约确定性测试**——同契约束轮次（docs fix 一 commit / 一未 commit）→ 行为类一致（commit → APPROVED；未 commit → BLOCKED + 诊断在 stdout 可见）。
- **验收**: AC6——docs-handoff `commits{base,head}` 落地（逆转旧声明段，schema 校验通过）；round-context docs base token 渲染落地（canonical 派生）；同契约束轮次行为一致测试（commit → APPROVED；未 commit → BLOCKED + stdout 可见诊断）；`blocker` 单数统一 + docs status TIMEOUT 归属声明（breaking 面记录进 changeset 范围）；AC7——handoff schema 无双核心块（单源断言）、base 默认 override 全通道生效（复用 Task 3/4 断言）；`pnpm run validate` 全绿 + engine vitest 全绿。
- **注**: 本任务是 T1–T4 之后唯一的 contract schema 修改面；breaking = major（T6 版本化承载）。

### Task 6: breaking 版本面 + 零债收口（design §2.5 · AC8 · 零债断言聚合）

- **Do**: ① **breaking 版本面**——cdd-engine major bump changeset（1 件，收口建；变更面 = 本 phase 全部：handoff schema + round-context + lifecycle 契约结构升级 + `cdd help` + schema 单源），版本号 + changelog 面裁决；② **零债断言聚合**——AC7 全项机械断言：无 plan-only 遗留（grep）· closeout 推断无第二实现（单一推断模块断言）· 无豁免例外常量（lane 边界为时序推导、无豁免常量 token）· handoff schema 无双核心块（单源断言）· base 默认 override 全通道生效（docContractValidate · statusValidate 各 task/docs/branch 三通道，逐钩子断言见 Task 3/4 验收）；③ **全量收口复核**——测试三新面（全量审计 / closeout 统一推断 / 契约确定性）+ `pnpm run validate` 12 块全绿（CI 同口径、干净已提交树）+ `emit:check` 零 drift；④ **本仓 = canary 自证**——本仓自有 program 文档链（P2 plan v1.0（本文件）→ P2 design v1.2 → consumer-parity overall v1.11）过 engine 新审计路径 + 新 plan-schema 解析零误伤（dogfood：四表合法 → 全绿、plan 头既有解析语义经 schema 零新增失败），engine 拆包消费者模拟路径可用（`cdd help` 指向可寻址 schema）。
- **验收**: AC8——breaking 版本面明确（major bump 变更面清单与发布面一致）；零债断言全项绿（可 grep/断言复现）；`pnpm run validate` 全绿（12 块，干净已提交树）；AC1–AC9 逐条可复核（回收 Task 1–5 验收面 + 本任务收口面）；engine vitest 全绿；本仓 program 文档链（plan → design → overall）过 engine 审计零误伤（dogfood 实证）。
- **注**: 若本仓 docs-family fix 通道 commit 义务上下文的 canary 缺口仍复现（T5 落地后应消失）→ 编排侧按 overall v1.4 登记补提交并登记；版本化发布动作（npm publish 等）仍归 P4，本任务只定版本面 + changeset。
