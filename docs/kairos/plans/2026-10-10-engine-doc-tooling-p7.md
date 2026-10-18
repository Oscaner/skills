---
title: 引擎文档工具（Engine Doc-Tooling）— P7 实施计划：单一实况判定面（commit-sha 全退役 + 物料无条件
  extract + brief 镜像 + round/键/字段实况化）
doc-type: plan
version: v0.9
date: 2026-10-14
spec: ../specs/2026-10-10-engine-doc-tooling-p7-design.md
parent-program: ../specs/2026-10-10-engine-doc-tooling-overall.md
depends-on: P6（Done · v0.4 · hard）
---

## Constraints

- **统一命题——单一实况判定面（D26 · 一切任务的验收根）**：任一事实（树身份 · 计划面 · round verdict · 线身份 · 字段处置）只有**一处实况源**、只在**判定时刻现读**；**派生副本永不具权威**（冻结 sha · 盘上 brief · 磁盘草稿 · argv 路径串 · 第二套 schema 裁决）· 副本若为缓存必**可失效重建**。本 phase 的 sha/brief/round/key/field 五处收口皆此一条法条的实例，非五条独立规则
- **六前提（D23）**：允许破坏性变更、可重写代码重组目录、不保守不打补丁；高维思考、OOP 抽象统一、零裸函数；最佳实践、零技术债、避免散文堆砌、避免声明再抄；高内聚、低耦合、死代码空壳全清；消费者心智负担优先；最大程度重构整合、最大程度精简系统
- **保留面冻结**：clean-tree gate（review 基线 = committed tree）· doc_revision 内容指纹（doc sha1 · run.ts:551 · 最新计划 reopen gate —— 非 commit sha）· doc-contract 判定语义（gate 零例外）· base set/get 语义不变 · `WAVE`/`tasks`/`OUTPUT_REPORT`/`OUTPUT_HANDOFF`/`OUTPUT_EVIDENCE`/`INPUT_DOC`/`INPUT_FINDINGS` token 保留 · 六命令功能语义不变（除 review 面 ref 退役）· `mattpocock-skills` 分派表零动
- **校验器与 materialize 同源同判**（§8.7）：对同一字段的处置永不背离——postflight 只对「materialize 会保留的字段」判语义（缺 required/类型/enum/长度 → BLOCK），对「materialize 会丢弃的字段」（非声明多余字段 · `engineOnly` 字段）同判 drop（+ 至多一条 WARN 落 carrier notes）
- **child prompt 组装面逐 token 对齐**（§3.6）：每个 mode shell 文本中出现的 `INPUT_*`/`OUTPUT_*`/`BASE_BRANCH` 名引用 ⊆ 该 mode round-context 布局 ∪ 共享尾部（新壳文-布局一致性断言 · 复用 `#contextLines` 槽位 regex · 构造成立级）
- **kairos 消费面字面同步**（§7）：cdd-dev/cdd-plan skill 文本 + 行为树 pins 随 engine 语义更替（consumer 环境无 monorepo 布局 · 消费面纯度：零程序史）· `docs/kairos/{specs,plans}` frozen 历史面零动
- **语义契约保**：退出码表 0/1/2 · CDD_BLOCKED 通道 · `next:` 字面 · 领域 run 语义零动（字节更替为 deliberate re-anchor）· `TEMPLATE_PROMPT.$version` 6 → 7（数据面版本记录）
- **零残留**：填后 `:::fill` 零残留 · 非豁免 `<…>` 零残留 · 引擎 vitest 全绿（零跳过零容错）· EOF 恰一 newline · 不发布（变更集归并落 pending）

### Task 1: sha 载体的类型面收编（GitClient 六→二 seam · BranchRef 类删 · Route.review 无 ref）
- **Objective**: 删除评测面的 commit-sha 类型载体——`GitClient` 留 `topLevel`/`isClean` 二 seam（`revParseHead`/`addAll`/`commit`/`log` 删）· `session/branch-ref.ts` 整文件删 · `BranchRef` 的全部消费点收编（`gate.refFromHandoff` · `gate.#lineParams` branch 腿 · `cli.ts` branch face 装配 + `scene.head` 注入 · `run.#paramsOf`/`#routeTarget` branch 腿 · `capsule.#routeText` branch ref 合成 · `lifecycle.#reviewRange`（:375/:382）`#resumeOf`（:685）branch-ref 消费点——移除归 T4）· `Route.review` 失 `{base,head}` → `{kind:"review"}` · `WorkScene.head` 删 · dry-run 合成 commits 改零 commits
- **Files**:
  - Modify: `packages/cdd-engine/src-next/infra/git.ts`（revParseHead git.ts:35-41 · addAll/commit/log git.ts:58-93 删 · topLevel/isClean 保留 · 头注收编 find #10 长 sha 叙事）
  - Delete: `packages/cdd-engine/src-next/session/branch-ref.ts`（整文件）
  - Modify: `packages/cdd-engine/src-next/face/gate.ts`（refFromHandoff gate.ts:123-133 删 · `#lineParams` branch 腿去 `base8`/`head8` :163-169 → `{ round }`）
  - Modify: `packages/cdd-engine/src-next/face/cli.ts`（branch face 装配 cli.ts:683-696 · scene.head cli.ts:718 删 · dry-run commits 合成 cli.ts:564-572 改 `{status:"APPROVED"}`）
  - Modify: `packages/cdd-engine/src-next/session/run.ts`（#paramsOf branch 腿 run.ts:466-470 · AuditTarget branch 腿 run.ts:72 · #routeTarget branch id run.ts:644-648 · DispatchScene.head 删）
  - Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（BranchRef 消费面登记 :26 import · :375/:382 #reviewRange · :685 #resumeOf —— 本任务仅登记消费面，实际移除归 T4）
  - Modify: `packages/cdd-engine/src-next/session/next.ts`（Route.review next.ts:45 失 ref · implement→review next.ts:91-95 · fix re-review next.ts:117-119 去双 legs 检查）
  - Modify: `packages/cdd-engine/src-next/face/capsule.ts`（#routeText branch ref 合成 capsule.ts:141-153 删）
- **Consumes**: 无（根任务）· spec §2.1/§2.2/§2.6 授权
- **Produces**: `GitClient` 二方法面（topLevel/isClean）· `Route.review = {kind:"review"}` · `AuditTarget` branch 腿去 base/head · 供 T3（ledger HandoffParams）/T6（capsule 渲染）/T7（CLI）消费
- **Steps**:
  - 删 git seam —— `infra/git.ts` 删 `revParseHead`/`addAll`/`commit`/`log` 四方法（生产面零调点实证）· 留 `topLevel`/`isClean` · 头注改写至二 seam 实况（find #10 长 sha 退役叙事入 maintainers 或删） — checkable: `grep -n "revParseHead\|addAll\|commit(\|log(" infra/git.ts` 零命中
  - 删 BranchRef —— `rm session/branch-ref.ts` · gate/cli/run/capsule 消费点同步改（gate 两处：`refFromHandoff` :123-133 删 · `#lineParams` branch 腿 :163-169 去 `scene.target.base/head` + `new BranchRef` → `{ round }`——`AuditTarget` branch 腿去 base/head 后 gate 同面即收编，不隔 wave）· lifecycle 的 BranchRef 消费点（:375/:382 #reviewRange · :685 #resumeOf）随 T4 移除 — checkable: `grep -rn "BranchRef" face/gate.ts face/cli.ts session/run.ts face/capsule.ts` 零命中 · T1+T4 合并后全库 `grep -rn "BranchRef" src-next` 零命中（lifecycle 消费点由 T4 消除）
  - Route.review 无 ref —— `session/next.ts` Route.review 去 `{base,head}` · implement→review 恒出 `{kind:"review"}`（去 commits.base 依赖）· fix re-review 恒出 `{kind:"review"}`（去双 legs null 检查） — checkable: next.ts review 两出口零 commits 引用
  - capsule 渲染去 ref —— `face/capsule.ts #routeText` review.branch 分支去 `new BranchRef`/`base8`/`head8` 合成 → `review --type branch --plan <path>` 单参 — checkable: capsule.ts 零 `BranchRef`/`base8`/`head8`
  - scene.head / dry-run commits 删 —— `face/cli.ts` WorkScene 去 head（:718 revParseHead 调用删）· dry-run dispatch 工作帧 `{status:"APPROVED"}`（零 commits）· `run.ts DispatchScene.head` 删 — checkable: cli.ts/run.ts 零 `scene.head`/`revParseHead`
  - 跑引擎套件核对 —— checkable: `pnpm -C packages/cdd-engine test`（vitest run）· 编译零 `BranchRef` 未定义 · 失败 pin 归入 T9 重锚
  - 提交原子 commit（`refactor(cdd-engine): 评测面 sha 类型载体收编——GitClient 六→二 seam · BranchRef 删 · Route.review 无 ref`） — checkable: git log 单原子
- **Acceptance**: GitClient 方法集 = `topLevel` + `isClean` · `session/branch-ref.ts` 不存在 · `Route.review` 无 ref 字段 · `AuditTarget` branch 腿零 `base`/`head` 且其消费点全在 T1（`gate.#lineParams` :163-169 · `run.#paramsOf` · `cli.scene.head` · `capsule`——同面收编，无跨 wave 编译耦合）· `BranchRef` 零残留 grep（T1 覆盖 gate/cli/run/capsule · lifecycle 消费点随 T4 → T1+T4 合并后全库零）· `revParseHead` 零残留 grep · 引擎 vitest 编译通过（失败 pin 留 T9）· EOF 恰一 newline
- **DependsOn**: none

### Task 2: handoff carrier schema 收缩（commits/changes 声明删 · 校验器与 materialize 同源同判）
- **Objective**: 从声明面删净 commit/changes 载体字段——`handoff-schema.ts` 删 `COMMITS` 节点 · `CARRIER_WORK.commits`/`CARRIER_FINDINGS.commits` · `CarrierValue.commits` · `CHANGED_FILE` 节点 · `CARRIER_WORK.changes` · `CarrierValue.changes`；并落实 §8.7 分类裁决——`violations` 对「materialize 会丢弃的字段」（非声明多余字段 · `engineOnly`）归一化 drop 不 BLOCK，语义错（缺 required/类型/enum/长度）保留 BLOCK
- **Files**:
  - Modify: `packages/cdd-engine/src-next/session/handoff-schema.ts`（COMMITS :74-82 · CARRIER_WORK.commits :108 · CARRIER_FINDINGS.commits :131 · CarrierValue.commits :182 · CHANGED_FILE :84-93 · CARRIER_WORK.changes :109 · CarrierValue.changes :183 删 · #check :315-360 分类裁决 · 头注叙事收编）
  - Modify: `packages/cdd-engine/src-next/session/ledger.ts`（buildHandoff 的 commits init 行 :640 删）
- **Consumes**: 无（根任务）· spec §2.5/§6.1/§8.7 授权
- **Produces**: `CARRIER_WORK`/`CARRIER_FINDINGS` 无 commits/changes 字段 · `violations` 分类裁决（drop-not-BLOCK 非声明字段）· 供 T4（lifecycle read-back）消费
- **Steps**:
  - 删 carrier 声明字段 —— `handoff-schema.ts` 删 `COMMITS`/`CHANGED_FILE` 两节点 · `CARRIER_WORK`/`CARRIER_FINDINGS` 的 `commits`/`changes` 属性 · `CarrierValue` 的 `commits`/`changes` 键（`CarrierOf` 经 `keyof properties` 自动收缩） — checkable: `grep -n "COMMITS\|CHANGED_FILE\|commits\|changes" session/handoff-schema.ts` 零命中（注释除外）
  - buildHandoff commits init 删 —— `ledger.ts:640` `if (init.commits !== undefined) carrier.commits = init.commits` 删 — checkable: `grep -n "carrier.commits" session/ledger.ts` 零命中
  - 分类裁决 —— `handoff-schema.ts #check` 对 `additionalProperties:false` 的未声明键：不 push BLOCK problem（drop 语义 · 与 materialize 一致）· 语义错（required 缺 / type 不符 / enum 越界 / min-maxLength）保留 —— **WARN 归口**：`#check` 只判语义错 BLOCK · **drop + drop-WARN 由 T4 的 `#materialize` 单点检出并落 carrier `notes`**（`#check` 不产 WARN · 两任务不重复不遗漏） — checkable: 单测——一个带非声明键的 work 草稿 `violations()` 返回 `[]`；一个缺 required 的草稿返回非空
  - `engineOnly` 归一化 —— `status`（findings face engineOnly）：child 草稿带 `status` 不再 BLOCK（drop · 引擎覆写） — checkable: 单测——findings 草稿带 `status` 过 `violations` 返回 `[]`
  - 跑引擎套件核对 —— checkable: `pnpm -C packages/cdd-engine test`（schema 相关 pin 变动归 T9）
  - 提交原子 commit（`refactor(cdd-engine): handoff carrier 声明收缩（commits/changes 删）+ 校验器分类裁决（drop-not-BLOCK）`） — checkable: git log 单原子
- **Acceptance**: `handoff-schema.ts` 零 commits/changes 声明 · `violations` 对非声明/`engineOnly` 字段 drop-not-BLOCK、对语义错 BLOCK（两向单测）· 引擎 vitest 通过 · EOF 恰一 newline
- **DependsOn**: none

### Task 3: ledger round/键/verdict 实况化（round-read 门控 · doc 线键 · 文件名去 range 占位 · ReviewRefs 收编）
- **Objective**: ledger 面三处实况化——① `Round.commits`/`scope_base` 死字段删 · `ReviewRefs` 收编至 doc-revision 单 kind（commit-set-ledger/commit-range 两 kind + commitSet/commitRange/kindOf + sameRef commit 两腿 + bind/#bound/bound 删）· `HandoffParams.base8/head8` + `handoffName` replaceAll 删（branch family 名已为 `branch-{op}-{round}`）· `writeCrash.snapshotSha` 删；② §2.8 round verdict 单源——`ledger.round()` 的 round-read 以 `recordRound` 进度门控（未被记录的 round 返回 null，无论磁盘草稿是否在）；③ §3.7 doc 线键——`run.ts #lineKey` 与 `gate.ts #lineKey` 两派生点 doc 腿均改线型常量
- **Files**:
  - Modify: `packages/cdd-engine/src-next/session/ledger.ts`（Round.commits :37/:44/:53/:89-90/:214 删 · scope_base :121 删 · ReviewRefs :246-309 收编（CommitSetLedgerRef :209 · CommitRangeRef :217-222 · commitSet :265 · commitRange :270 · kindOf :252 · sameRef :292-305 两腿 · bind/#bound/bound :283-309 删 · 留 doc-revision + docRevision/doc_hash）· HandoffParams.base8/head8 :186-188 删 · handoffName :609-617（replaceAll :612-613 删）· round() :738-779 round-read 以 roundCount 门控 · writeCrash snapshotSha 字段）
  - Modify: `packages/cdd-engine/src-next/session/run.ts`（#lineKey run.ts:441-444 doc 腿 → face.type · #recordReviewedDocRevision 键随 #lineKey 归一（无需单独改）· #roundFor/#nextLinePhase 门控 mode 映射）
  - Modify: `packages/cdd-engine/src-next/face/gate.ts`（#lineKey gate.ts:156-160 doc 腿 → scene.face.type · 注释 gate.ts:155 改写）（`#lineParams` branch 腿去 `base8`/`head8` :163-169 已随 T1 收编，此处不重列）
- **Consumes**: T2（carrier 无 commits/changes）· spec §2.5/§2.8/§3.7 授权
- **Produces**: `ledger.round()` 以 `roundCount` 门控（被拒 round 返回 null → route null → 零 next 行）· doc 线键 = 线型常量（run.ts + gate.ts 两派生点单源同键）· `+doc-revision` 单 kind · 供 T4（round-context）/T6（capsule）/T7（CLI lineKey 消费）
- **Steps**:
  - 死字段 + ReviewRefs 收编 —— 删 `Round.commits`/`scope_base`/`writeCrash.snapshotSha` · `ReviewRefs` 删 commit 两 kind + 关联方法（留 doc-revision 单 kind + `docRevision`/`doc_hash`）· `RefKind` 收为单值 — checkable: `grep -n "commitSet\|commitRange\|kindOf\|scope_base\|CommitRangeRef\|CommitSetLedgerRef" session/ledger.ts` 零命中
  - 文件名去 range 占位 —— `HandoffParams` 去 `base8`/`head8` · `handoffName` 去两条 replaceAll（family 名已 `branch-{op}-{round}`） — checkable: `grep -n "base8\|head8" session/ledger.ts` 零命中
  - §2.8 round verdict 单源 —— `ledger.round()` 开头前置早退 `if (roundCount(key, mode) < round) return null`（mode = 该 op.type family 的被记录 mode：review 腿 `reviewLead(type)`（wave/spec/plan→review · branch→branch-review）· fix 腿 `fix`）——门控**包裹**既有 carrier 读：早退后保留现有 `#consecutiveS1Run` 走查与 review 腿 `findings`/`findingsPath`/`status` 推导（不替换磁盘读，只在其前加门） — checkable: 单测——磁盘遗留一份未 recordRound 的 fix 草稿，`round("fix",…,r)` 返回 null
  - §3.7 doc 线键 —— `run.ts #lineKey` doc 腿 `return target.doc` → `return this.#face.type`（spec/plan）· `gate.ts #lineKey` doc 腿 `return scene.target.doc` → `return scene.face.type` —— `#recordReviewedDocRevision`（run.ts:551-563）经 `frame.key` 已随之归一（`#paramsOf` 的 doc 键同为 `frame.key`），**无需单独改** — checkable: `grep -rn "return.*target\.doc" session/run.ts face/gate.ts` 零命中（#lineKey 内）
  - 跑引擎套件核对 —— checkable: `pnpm -C packages/cdd-engine test`（ledger/gate pin 变动归 T9）
  - 提交原子 commit（`refactor(cdd-engine): ledger round/键/verdict 实况化——recordRound 门控 · doc 线键 · ReviewRefs 收编 doc-revision`） — checkable: git log 单原子
- **Acceptance**: `ledger.round()` 对未记录 round 返回 null（被拒草稿不再被读回）· doc 线键 = 线型常量（run.ts + gate.ts 单源同键 · 无第三派生点）· 全库 `base8`/`head8`/`commitSet`/`commitRange`/`scope_base` 零残留 · 引擎 vitest 通过 · EOF 恰一 newline
- **DependsOn**: 2

### Task 4: lifecycle read-back + round-context 收敛（commits 解析删 · INPUT_RANGE/PLAN/FIX_BASE 退 · brief 单输入 · 字段单裁落地）
- **Objective**: lifecycle 面收敛——`#parseBlockReturn` 删 commits regex · `DispatchOutcome.commits` 删 · `#commitsOf` 删 · `#bookkeep` commits 写点删 · `FIX_BASE`/`#fixedPoint` 删 · `INPUT_RANGE`/`#reviewRange` 删 · `INPUT_PLAN` 删 · `#waveBrief` exists 守卫删（任何 wave 帧返回 `scene.briefPath`）· `#outputOf` brief kind 删（`OUTPUT_BRIEF` 折叠）· `BASE_BRANCH` 值注入 · `#materialize` 落 §8.7 分类裁决（drop 非声明字段 + WARN 落 notes）· `#resumeOf` branch-review 字面改单参（`#reviewRange`/`#resumeOf` 的 BranchRef 消费点随之消除）
- **Files**:
  - Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（#valuesOf :273-321（INPUT_RANGE/INPUT_PLAN/FIX_BASE/OUTPUT_BRIEF 行删 · BASE_BRANCH 加）· #reviewRange :371-385 删 · #fixedPoint :403-408 删 · #waveBrief :390-397 守卫删 · #outputOf brief :339-343 删 · #parseBlockReturn :413-428 commits regex 删 · #commitsOf :656-659 删 · #bookkeep :494-543 commits 写点删 · #materialize :521-554 分类裁决 + WARN 落 notes · #recordReviewedDocRevision :551-563 键归一 · `#resumeOf` :673-687 branch-review 字面（:686 `ref.args()` 删）· BranchRef import :26 删）
- **Consumes**: T2（carrier 无 commits）· T3（ledger round/键）· T5（templates token 布局）· spec §2.4/§2.7/§3.1/§4.2/§5/§8.7 授权
- **Produces**: lifecycle `#valuesOf` 无 INPUT_RANGE/INPUT_PLAN/FIX_BASE/OUTPUT_BRIEF（含 BASE_BRANCH）· `#waveBrief` 三 face 统一返回 `scene.briefPath` · `#materialize` 分类裁决 · 供 T9（round-context pin）
- **Steps**:
  - commits 面删 —— `#parseBlockReturn` 去 commits regex 行 · `DispatchOutcome.commits` 字段删 · `#commitsOf` 方法删 · `#bookkeep` 的 commits 写点删 — checkable: `grep -n "commits\|#commitsOf" face/lifecycle.ts` 零命中
  - token 值收敛 —— `#valuesOf` 删 `INPUT_RANGE`/`INPUT_PLAN`/`FIX_BASE`/`OUTPUT_BRIEF` 行 · 加 `BASE_BRANCH`（值 = base artifact 分支名 · 经 `#scene` 读 `base get`）· 删 `#reviewRange`/`#fixedPoint`/`#outputOf(brief)` 方法 — checkable: `grep -n "INPUT_RANGE\|INPUT_PLAN\|FIX_BASE\|OUTPUT_BRIEF\|#reviewRange\|#fixedPoint" face/lifecycle.ts` 零命中
  - brief 单输入 —— `#waveBrief` 去 `existsSync` 守卫与 implement-only 分型 → 任何 wave 帧返回 `scene.briefPath` — checkable: `grep -n "existsSync\|waveBrief" face/lifecycle.ts` 零命中
  - branch-review resume 字面 —— `#resumeOf` branch-review 腿删 `new BranchRef(range.base, range.head)`/`ref.args()` → `cdd review --type branch --plan ${plan}` 单参 · 删 import（:26）与 `#reviewRange`（:371-385）的 `BranchRef.short` 消费 — checkable: `grep -n "BranchRef\|#reviewRange\|ref.args" face/lifecycle.ts` 零命中
  - §8.7 分类裁决落地 —— `#materialize` 只读声明字段（已 drop 非声明）· 检出非声明/`engineOnly` 字段时追加 WARN 至 carrier `notes` — checkable: 非声明字段草稿通过后 carrier notes 含一条 drop-WARN · 无 BLOCK（WARN 源 = `#materialize` 兑 draft 键 vs 声明集 · 见 T2 分类裁决步 —— `#check` 只判语义错 BLOCK · drop + WARN 由 `#materialize` 单点检出）
  - 跑引擎套件核对 —— checkable: `pnpm -C packages/cdd-engine test`（lifecycle pin 变动归 T9）
  - 提交原子 commit（`refactor(cdd-engine): lifecycle read-back/round-context 收敛——commits 解析删 · brief 单输入 · 字段单裁`） — checkable: git log 单原子
- **Acceptance**: `#valuesOf` 零 INPUT_RANGE/INPUT_PLAN/FIX_BASE/OUTPUT_BRIEF · 三 face brief 统一 `scene.briefPath` · `#materialize` 分类裁决（drop + WARN · 无 BLOCK）· 引擎 vitest 通过 · EOF 恰一 newline
- **DependsOn**: 2, 3, 5

### Task 5: templates 数据面 + 组装原子性（token 布局 · REVIEWS 判据 · cl:changed-surface 删 · 组装守卫 · $version）
- **Objective**: render/templates 数据面一次折叠——`TOKENS` 删 `INPUT_RANGE`/`INPUT_PLAN`/`FIX_BASE`/`OUTPUT_BRIEF`（加 `BASE_BRANCH`）· `REVIEW_CONTEXT` 换新共享尾部 · `MODE_PROMPTS`/`FIX_SHELL`/`DOCS_FIX_SHELL` shell 按新布局重写（FIX_SHELL 按线分句 · implement shell 读 brief 完整镜像）· `REVIEW_ITEM` 按型参照句 · **`REVIEWS.*.ref` 整体删（v0.6 回填 · 原「改参照型」被 D26 派生副本清理取代——ref 零消费 · 与 shell 散文同述一事）** · `#gate` 新增壳文-布局一致性断言 · 删 `cl:changed-surface` LICENSE 行 + CLAUSES · `$version` 6 → 7
- **Files**:
  - Modify: `packages/cdd-engine/src-next/render/templates.ts`（TOKENS :447-459 · REVIEW_CONTEXT :237-248 · MODE_PROMPTS :252-307 · `REVIEWS :312-337`（spec/plan `ref` INPUT_RANGE→INPUT_DOC :327/:333 · axesGuide 为同条 sibling 行 :329/:335 · wave/branch axesGuide 删虚构句）· REVIEW_ITEM :232-233 · RETURN_ZONE :423-439（3→2 行）· LICENSE_ITEMS cl:changed-surface :159 删 · CLAUSES :484-486 删 · #gate :589-614 加组装断言 · $version :493）
  - Modify: `packages/cdd-engine/src-next/render/brief.ts`（render :88-98 去 head 参 + WAVE_BASE 行 · 增 Constraints 段切片）
- **Consumes**: T2（carrier 声明）· spec §2.4/§2.7/§3.1/§3.3/§3.6/§5/§6.1/§8.3 授权
- **Produces**: templates 数据面**无** INPUT_RANGE/INPUT_PLAN/FIX_BASE/OUTPUT_BRIEF/cl:changed-surface · `BASE_BRANCH` 注册 · RETURN_ZONE 二行 · `#gate` 组装一致性断言 · brief render 去 head + Constraints 镜像 · 供 T4/T6/T7/T9
- **Steps**:
  - token 注册表 + RETURN_ZONE —— `TOKENS` 删四 token 加 `BASE_BRANCH` · `RETURN_STDOUT_BLOCK` 删 commits: 行（恰 status+artifacts 二行 · artifacts 处方去 OUTPUT_BRIEF） — checkable: `grep -n "INPUT_RANGE\|INPUT_PLAN\|FIX_BASE\|OUTPUT_BRIEF\|commits:" render/templates.ts`（非删除注释）零命中
  - shell + 判据 + axesGuide 重写 —— `MODE_PROMPTS`/`REVIEW_CONTEXT` 换布局 · `FIX_SHELL` 按线分句（wave→INPUT_WAVE_BRIEF · branch→INPUT_DOC）· implement shell 读 `INPUT_WAVE_BRIEF`（完整计划镜像）· **`REVIEWS.*.ref` 整体删（v0.6 回填 · `ReviewGuideRow.ref` + `REVIEWS.*.ref` 四行 · 零消费死码 · D26 派生副本）** · `REVIEWS.wave/branch.axesGuide` 改 review 自跑 git diff 措辞（删虚构句） — checkable: 渲染后的 shell 文本 token 归属 ⊆ 其布局 ∪ 共享尾部（`render(mode)` 输出逐 token 名比对 · 各组装断言前置） · `grep "ref:" render/templates.ts` 于 `ReviewGuideRow` 零命中
  - cl:changed-surface 删 —— `LICENSE_ITEMS` 行 + `CLAUSES` 条目删 — checkable: `grep -n "changed-surface\|cl:changed" render/templates.ts` 零命中
  - 组装一致性断言 —— `#gate` 新增：每 mode shell 文本中 `INPUT_*`/`OUTPUT_*`/`BASE_BRANCH` 名引用 ⊆ 该 mode round-context 布局 ∪ 共享尾部（复用 `#contextLines` regex） — checkable: 单测——构造一个壳文声称未携带 token 的 mode，断言抛错
  - brief 镜像 —— `render/brief.ts` `render` 去 head 参 · 增 `## Constraints` 段提取（复用 `#rawSection` 切片） — checkable: `grep -n "WAVE_BASE\|head" render/brief.ts`（签名）零命中 · brief 输出含 Constraints 段
  - $version —— `TEMPLATE_PROMPT.$version` 6 → 7 — checkable: templates.ts $version = 7
  - 提交原子 commit（`refactor(cdd-engine): templates 数据面折叠 + 组装一致性守卫 + brief 镜像（$version 6→7）`） — checkable: git log 单原子
- **Acceptance**: templates 零 INPUT_RANGE/INPUT_PLAN/FIX_BASE/OUTPUT_BRIEF/cl:changed-surface · RETURN_ZONE 二行 · 组装一致性断言生效（声称-布局 gap 抛错）· brief 含 Constraints 段 · `$version`=7 · 引擎 vitest 通过 · EOF 恰一 newline
- **DependsOn**: none

### Task 6: next/capsule 渲染面收敛（review 路由无 ref · fix 读回后缀）
- **Objective**: 路由渲染面随 `Route.review` 无 ref 收敛——`next.ts` 的 implement→review / fix re-review 出口零 commits 依赖（T1 已改结构，本任务核验并补 pin）· `capsule.ts #routeText` 的 review 全型渲染为零 sha 单参（wave→`--tasks --plan` · branch→`--plan` · spec→`--spec` · plan→`--plan`）· fix 路线保留 `FIX_READBACK_SUFFIX`
- **Files**:
  - Verify: `packages/cdd-engine/src-next/session/next.ts`（Route.review / implement→review / fix re-review 出口 · T1 已改 · 核验零 sha 残留）
  - Modify: `packages/cdd-engine/src-next/face/capsule.ts`（#routeText review 全型 capsule.ts:125-156 去 branch ref 合成 · fix 路线保留 suffix）
- **Consumes**: T1（Route.review 无 ref）· T3（ledger round 门控）· spec §2.6 授权
- **Produces**: `capsule #routeText` review 全型零 sha 单参 · 供 T9（capsule 渲染 pin）
- **Steps**:
  - 核验 next.ts 路由 —— 确认 implement→review / fix re-review 出口恒出 `{kind:"review"}`（T1 已改）· 无 missing-base null 行 — checkable: `grep -n "base\|head\|commits" session/next.ts`（注释外）零命中
  - capsule review 渲染 —— `#routeText` 四型 review 渲染零 sha（wave 带 `--tasks --plan` · branch/spec/plan 各单参）· 删 `route.head===undefined` 保底与 `new BranchRef` 合成 — checkable: `grep -n "BranchRef\|base8\|head8\|route.head" face/capsule.ts` 零命中
  - 跑引擎套件核对 —— checkable: `pnpm -C packages/cdd-engine test`（capsule pin 变动归 T9）
  - 提交原子 commit（`refactor(cdd-engine): next/capsule 渲染面——review 路由零 sha 单参`） — checkable: git log 单原子
- **Acceptance**: `capsule #routeText` review 四型零 sha · fix 路线保留 `FIX_READBACK_SUFFIX` · 引擎 vitest 通过 · EOF 恰一 newline
- **DependsOn**: 1, 5

### Task 7: CLI 命令面收口（declare flag 退役 · REQUIRED_GROUPS · BASE_BRANCH 注入 · 派发前无条件 extract）
- **Objective**: CLI 命令面收口——`declare.ts` 删 `head` 通道 · `base` 改 branch-name 语义 · `"sha"` 值域型全退 · `review` keys 去 base/head · `REQUIRED_GROUPS.review.branch=["--plan"]` · `fix.branch=["--findings","--plan"]`；`cli.ts` 派发前条件 `verb==="implement"` → `type==="wave"`（三 face 无条件 renderBrief）· 删 `artifacts.brief` 注入 · BASE_BRANCH 值经 `base get` 读入
- **Files**:
  - Modify: `packages/cdd-engine/src-next/face/declare.ts`（head 通道 :72 · base 通道语义 :71 · ShapedChannelValueType :109 删 "sha" · VALUE_SHAPES :143-146 删 sha · review keys :222-223 · REQUIRED_GROUPS :321/:327）
  - Modify: `packages/cdd-engine/src-next/face/cli.ts`（派发前条件 :415-416 · artifacts.brief 注入 :461-467 删 · BASE_BRANCH 注入路径）
- **Consumes**: T1（branch face 装配）· T5（templates token）· spec §2.3/§4.1 授权
- **Produces**: `declare.ts` 零 head/sha 值域型 · `REQUIRED_GROUPS` review.branch/fix.branch 新组 · CLI 三 face 无条件 extract · 供 T9（declare pin）
- **Steps**:
  - declare flag 退役 —— `declare.ts` 删 `head` 通道 · `base` 通道 `valueType` 改 branch 名 · 删 `"sha"` 值域型（ShapedChannelValueType + VALUE_SHAPES）· `review` keys 去 base/head — checkable: `grep -n '"sha"\|head.*:' face/declare.ts` 零命中
  - REQUIRED_GROUPS —— `review.branch` = `["--plan"]` · `fix.branch` = `["--findings","--plan"]` — checkable: declare.ts 两组新值落位
  - 派发前无条件 extract —— `cli.ts` 条件 `verb==="implement" && scene.planText!==null` → `type==="wave" && scene.planText!==null`（三 face 每次 renderBrief 覆盖）· 删 `artifacts.brief` 注入块 — checkable: `grep -n 'verb === "implement"\|artifacts.brief' face/cli.ts`（该条件）零命中
  - BASE_BRANCH 注入 —— CLI 从 `base get --plan <path>` 读分支名传入 lifecycle scene（供 `#valuesOf BASE_BRANCH`） — checkable: lifecyle scene 有 base branch 值来源 · 缺 artifact → 空槽
  - 跑引擎套件核对 —— checkable: `pnpm -C packages/cdd-engine test`（cli/declare pin 变动归 T9）
  - 提交原子 commit（`refactor(cdd-engine): CLI 命令面收口——flag 退役 · REQUIRED_GROUPS · 无条件 extract`） — checkable: git log 单原子
- **Acceptance**: `declare.ts` 零 head/`"sha"` 值域型 · REQUIRED_GROUPS 新组 · CLI 三 face 无条件 renderBrief · 引擎 vitest 通过 · EOF 恰一 newline
- **DependsOn**: 1, 5

### Task 8: kairos 消费面同步（I7 撤除 · cdd-dev/cdd-plan 字面）
- **Objective**: 消费面字面同步——`cdd-dev/SKILL.md` 删 I7 行（:89）· branch-review 节点字面改 `review --type branch --plan <path>`（:60 · 删 merge-base/rev-parse/diff persist）· `cdd-plan/SKILL.md` 的 implement 读约束句（:44）改经 wave brief 镜像
- **Files**:
  - Modify: `packages/kairos/skills/cdd-dev/SKILL.md`（I7 行 :89 删 · branch-review 节点 :60 字面重写）
  - Modify: `packages/kairos/skills/cdd-plan/SKILL.md`（author-plan 约束句 :44 改写）
- **Consumes**: 无（根任务）· spec §7.1/§7.2/§7.3 授权
- **Produces**: cdd-dev I7 撤除 + branch-review 字面零 sha · cdd-plan 约束句经 brief · 供 T9（行为树 pin）
- **Steps**:
  - I7 撤除 —— `cdd-dev/SKILL.md` 删 I7 行（`| I7 | **Entry gate reads the tree, not the committed range** |`） — checkable: `grep -c "I7" packages/kairos/skills/cdd-dev/SKILL.md` 零命中
  - branch-review 字面 —— `cdd-dev/SKILL.md` branch-review 节点 Do 句改 `review --type branch --plan <path>` · 删 merge-base/rev-parse/diff persist — checkable: `grep -n "merge-base\|rev-parse HEAD\|--head\|--base" packages/kairos/skills/cdd-dev/SKILL.md` 零命中
  - cdd-plan 约束句 —— `cdd-plan/SKILL.md:44` `reads DIRECTLY via INPUT_PLAN` → 经 wave brief 镜像 `## Constraints` 段（`INPUT_WAVE_BRIEF`） — checkable: `grep -c "INPUT_PLAN" packages/kairos/skills/cdd-plan/SKILL.md` 零命中
  - 消费面纯度核对 —— 零程序史（无 phase 号/rationale 叙事）· English-primary — checkable: skill-anatomy 检查通过
  - 提交原子 commit（`docs(kairos): P7 消费面同步——cdd-dev I7 撤除 + branch-review 字面 · cdd-plan 约束句`） — checkable: git log 单原子
- **Acceptance**: cdd-dev 零 I7/`--base --head`/merge-base · cdd-plan 零 `INPUT_PLAN` · 消费面纯度过 · EOF 恰一 newline
- **DependsOn**: none

### Task 9: 引擎测试重锚 + 新 pins（14 pin 文件 deliberate 重锚 · 五 pin）
- **Objective**: 全部引擎测试随语义更替 deliberate 重锚——`branch-ref.test.ts` 随 BranchRef 删（整文件删）· 其余 pin 文件更替信号面（INPUT_RANGE/WAVE_BASE/FIX_BASE/commits/changes/snapshotSha/scope_base）· 新增五 pin：源码面 sha 零残留 grep · BASE_BRANCH 注入 · 无条件 extract · 二行契约 · GitClient 二方法集 · dogfood 三 pin（被拒 round 无 next · 同 doc 单行键 · 未声明字段 drop）
- **Files**:
  - Delete: `packages/cdd-engine/src-next/session/__tests__/branch-ref.test.ts`
  - Modify: `packages/cdd-engine/src-next/**/__tests__/*.test.ts`（render/wave/handoff-schema/ledger/run/next/capsule/cli/infra/face/projection/handoff-plane.guard/channel-closure.guard/smoke 等信号面重锚）
  - Modify: `packages/cdd-engine/src-next/face/__tests__/`（新增 dogfood 三 pin · BASE_BRANCH 注入 pin · 组装一致性 pin）
- **Consumes**: T1-T7（引擎语义全变）· spec §7.4/§8.5 授权
- **Produces**: 引擎 vitest 全绿（重锚 + 新 pin）· 供 T10（全量验证）
- **Steps**:
  - 删 branch-ref.test.ts —— `rm` 该文件 — checkable: 文件不存在
  - 信号面重锚 —— 全部 pin 文件的 `INPUT_RANGE`/`WAVE_BASE`/`FIX_BASE`/`commits:`/`changes`/`snapshotSha`/`scope_base`/`--base --head` 字面 deliberate 更替 — checkable: `pnpm -C packages/cdd-engine test` 全绿
  - 新 pin · sha 零残留 —— 源码面 `WAVE_BASE|FIX_BASE|INPUT_RANGE|INPUT_PLAN|revParseHead|BranchRef` grep 零命中（pin 化） — checkable: 断言绿
  - 新 pin · BASE_BRANCH 注入 —— wave+branch review round context 携带 · spec/plan 不带 — checkable: 断言绿
  - 新 pin · 无条件 extract —— review dispatch 后 brief = 当前 plan 最新镜像（任务段 + Constraints · 零 WAVE_BASE 行）· 二行契约（status+artifacts）· GitClient 二方法集 — checkable: 断言绿
  - 新 pin · dogfood 三 —— 被拒 fix round capsule 无 `next:` 行 · 同 doc 绝对/相对路径单行 ledger + round 续号 · 未声明/`engineOnly` 字段归一化 drop 不 BLOCK — checkable: 三断言绿
  - 提交原子 commit（`test(cdd-engine): P7 测试重锚 + 五 pin（sha 零残留 · BASE_BRANCH · extract · dogfood 三）`） — checkable: git log 单原子
- **Acceptance**: 引擎 vitest 全绿（含五 pin + dogfood 三）· `branch-ref.test.ts` 已删 · sha 零残留 grep pin 绿 · EOF 恰一 newline
- **DependsOn**: 1, 2, 3, 4, 5, 6, 7, 8

### Task 10: 收尾扫 + 全量验证 + 变更集（叙事收编 · $version pin · 消费面词表 · 边界确认）
- **Objective**: 整个 phase 收尾——`git.ts`/`handoff-schema.ts`/`ledger.ts` 头注随删改重写（防散文堆砌 · 零声明再抄）· 消费面词表残留 grep pin（frozen docs 豁免）· 边界确认（wave 编排/lifecycle 相位/doc-contract gate/base/clean-tree/doc_revision 零动）· 全量验证 · 变更集归并 pending
- **Files**:
  - Modify: `packages/cdd-engine/src-next/infra/git.ts`（头注收编）· `session/handoff-schema.ts`（头注）· `session/ledger.ts`（头注）
  - Modify: `packages/cdd-engine/src-next/**/__tests__/`（消费面词表 pin 入户）
  - Create: `.changeset/<slug>.md`（cdd-engine + kairos 归并 pending）
- **Consumes**: T1-T9（全变更）· spec §8/§9 授权
- **Produces**: 叙事收编 · 消费面词表 pin · 全量 validate ALL PASS · 变更集 pending · 供分支终审
- **Steps**:
  - 头注叙事收编 —— git.ts / handoff-schema.ts / ledger.ts 头注删死方法叙事（find #10 长 sha · commits/changes 载）改至二 seam/收缩后实况 — checkable: 三文件头注零 `commits`/`changed`/长 sha 载叙事
  - 消费面词表 pin —— kairos skills/README 的 `INPUT_RANGE`/`WAVE_BASE`/`FIX_BASE`/`--base --head` 零残留（frozen docs/kairos/{specs,plans} 豁免） — checkable: grep pin 绿
  - 边界确认 —— 核对 wave 编排/lifecycle 相位/双 review face/doc-contract gate/base/clean-tree/doc_revision 零 diff（除 §2.8/§3.7 判定面） — checkable: `git diff origin/<base>...HEAD -- <边界面路径>` 零命中
  - 全量验证 —— checkable: `pnpm run validate`（或等价 CI 原生序列）ALL PASS · 引擎 vitest 全绿 · kairos suite 全绿 · emit:check fresh · EOF 全绿
  - 变更集归并 —— `.changeset` 写 cdd-engine（minor/major）+ kairos（patch）归并 pending（不发布） — checkable: `pnpm exec changeset status` 无 empty 条目
  - 提交原子 commit（`chore(cdd-engine): P7 收尾扫——叙事收编 · 消费面词表 pin · 边界确认 · 变更集归并`） — checkable: git log 单原子
- **Acceptance**: 三头注零死叙事 · 消费面词表 grep pin 绿 · 边界面零 diff · `pnpm run validate` ALL PASS · 变更集 pending 无 empty · EOF 全绿 · 不发布
- **DependsOn**: 1, 2, 3, 4, 5, 6, 7, 8, 9

### Task 11: 判定面 ⊥ 输入面（engineOnly 退役 · conclusionOf 单源 · readJson 三态 · 相位 guard）
- **Objective**: 判定面 ⊥ 输入面（D27 · D26 补完 · v1.30 载体单声明面收口）——**`engineOnly` 概念退役**（`CARRIER_FINDINGS.engineOnly:["status"]` 删 · `SchemaNode.engineOnly` 字段 + `#json` 的 `engineOnly` 过滤删 · 声明面=可写面）· **`#materialize` 删 findings 面 `carrier.status =`**（findings 载体只装声明面 `findings`/`artifacts`/`notes` · work 面保留 status）· **结论改判定时刻派生**（新单源 `HandoffSchema.conclusionOf(face, carrier)`：findings→`rollup(findings)` · work→`carrier.status` · `ledger.round` review/fix 腿 + `#pendingFix` 全改走它）· **`readJson` 三态化**（`ok`/`missing`/`malformed` · `#reconstruct` 据实报真因）· **`Ledger#waveLinePhase` 相位单源 guard pin**
- **Files**:
  - Modify: `packages/cdd-engine/src-next/session/handoff-schema.ts`（`CARRIER_FINDINGS.engineOnly:["status"]` :106 删 · `SchemaNode.engineOnly` 字段 :45-53 删 · `#json` 的 `engineOnly` 过滤 :290 删 · 头注 engineOnly 叙事收编 · 新增 `conclusionOf(face, carrier)` 类方法）
  - Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（`#materialize` :509 `carrier.status = status` → 仅 `face==="work"` 写 · :514 evidence 覆盖同门控 · `#reconstruct` :407-408 按 `readJson` 三态报真因）
  - Modify: `packages/cdd-engine/src-next/session/ledger.ts`（`round` :713 review 腿 / :730 fix 腿的 `carrier.status` → `conclusionOf(face, carrier)` · `#pendingFix` :462 同改 · `#blockerCountOf` 不动）
  - Modify: `packages/cdd-engine/src-next/session/run.ts`（`#bookkeep` :503-504 的 `carrier.status` 兜底 → 仅 work 面写）
  - Modify: `packages/cdd-engine/src-next/infra/workspace.ts`（`readJson` :79-86 三态化：返回 `{kind:"ok",value}|{kind:"missing"}|{kind:"malformed"}` 判别式 · 头注同步）
  - Modify: `packages/cdd-engine/src-next/session/__tests__/handoff-plane.guard.test.ts`（⑥ authority-hygiene leg 退休 · ①/③ 保留）
  - Modify: `packages/cdd-engine/src-next/**/__tests__/`（新 pin 入户：findings 载体零 status · conclusionOf 单源 · readJson 三态 · 相位单源 guard）
- **Consumes**: T2（carrier 无 commits/changes）· T3（ledger round 门控）· T4（lifecycle read-back/#materialize）· spec §8.8 授权
- **Produces**: findings 载体零 `status`（fix child 的 INPUT_FINDINGS 干净）· `HandoffSchema.conclusionOf` 单源 · `Workspace.readJson` 三态 · `Ledger#waveLinePhase` 单源 guard · 供分支终审
- **Steps**:
  - `engineOnly` 退役 —— `handoff-schema.ts` 删 `CARRIER_FINDINGS.engineOnly:["status"]` · 删 `SchemaNode.engineOnly` 字段声明 · 删 `#json` 的 `engineOnly` 过滤（现为无操作）· 头注 authority-hygiene 叙事收编 — checkable: `grep -n "engineOnly" session/handoff-schema.ts` 零命中
  - `conclusionOf` 单源 —— `handoff-schema.ts` 新增类方法 `conclusionOf(face: HandoffSchemaFace, carrier: Record<string, unknown>): RoundStatus`（findings → `this.rollup(findings)` · work → `carrier.status as RoundStatus`）· `ledger.round` review/fix 两腿 + `#pendingFix` 改调 `this.#handoffSchema.conclusionOf(...)`（ledger 需持 `HandoffSchema` 实例） — checkable: 单测——findings 载体 `{findings:[blocker]}` → `conclusionOf` 返回 CHANGES_REQUESTED
  - findings 载体不写 status —— `lifecycle.ts #materialize`：`carrier.status = status`（:509）+ evidence 覆盖（:514）仅 `face === "work"` 执行；`run.ts #bookkeep`（:503-504）兜底同门控 — checkable: 单测——一个 review round 的持久化 findings 载体无顶层 `status` 键；一个 implement round 的 work 载体有 `status`
  - `readJson` 三态 —— `workspace.ts readJson` 改返回 `{kind:"ok",value}|{kind:"missing"}|{kind:"malformed"}`（`ENOENT` → missing · `SyntaxError` → malformed · 其余 I/O 错 → malformed）· 全部调用点（`lifecycle.ts:435` evidence · `cli.ts:587` base · `ledger.ts:297`）跟进解构 · `lifecycle.ts #reconstruct`（:407-408）missing 报「not written」· malformed 报「malformed JSON at <path>」 — checkable: 单测——畸形 JSON 草稿 → `#reconstruct` 报 malformed 真因（非「not written」）
  - 相位单源 guard pin —— 新增 guard 测试：断言 `wave.ts #phaseOf` 与 `run.ts #nextWavePhase` 均委派 `Ledger#waveLinePhase`（源码 regex 或行为 pin） — checkable: guard 测试绿 · 故意分叉则红
  - guard ⑥ 退休 —— `handoff-plane.guard.test.ts` 删 authority-hygiene leg（`WRITE_PATH_FACES`/`carrierWrites`/`projectedOf` 随 engineOnly 退休）· ①/③ 保留 — checkable: `grep -n "engineOnly\|carrierWrites" session/__tests__/handoff-plane.guard.test.ts` 零命中
  - 跑引擎套件核对 —— checkable: `pnpm -C packages/cdd-engine test`（相关 pin 变动一并改绿）
  - 提交原子 commit（`refactor(cdd-engine): 判定面 ⊥ 输入面——engineOnly 退役 · conclusionOf 单源 · readJson 三态`） — checkable: git log 单原子
- **Acceptance**: findings 载体零 `status`（fix child 的 INPUT_FINDINGS 干净）· `conclusionOf` 单源判 round 结论（findings 派生 · work 读声明）· `readJson` 三态报真因（坏 JSON 不再误报未写入）· `engineOnly` 全库零残留 · 相位单源 guard 绿 · 引擎 vitest 通过 · EOF 恰一 newline
- **DependsOn**: 10

### Task 12: round 身份单源（progress 记周期号 · roundRecorded 门控 · 载体动作 annotate）
- **Objective**: round 的**身份**与**计数**分家（D28 · D26 家族）——`ProgressRow.rounds` 由 `Record<string, number>` 改 **`Record<string, number[]>`**（周期号集合 = 身份）· `recordRound(key, mode, cycle?)` 记**周期**（跳号记自身号 · 缺省记最新+1）· 新 `roundRecorded(key, mode, cycle)` 成员测试 · `round()` 门控由 `roundCount < round` 改 **`!roundRecorded(round)`** · 相位三处「pending fix」由计数比较改 **`latestReview ∉ fixCycles`** 成员测试（`waveLinePhase`/`#pendingFix`/`#rowClosed` + 孪生 `run.#nextLinePhase`/`gate.#linePhase`）· `#roundFor("fix") = reviews` **保留**（fix-K⟷review-K 配对不动）· `.kairos` progress 按载体名迁移。**同批**：载体动作 `backfill user adjudications into the carrier` → **`annotate the carrier with the adjudications`**（`backfill` 锁义为 doc 去向）。
- **Files**:
  - Modify: `packages/cdd-engine/src-next/session/ledger.ts`（`ProgressRow.rounds` 类型 · `#cyclesOf` 迁移助手 · `roundCount` 改 length · 新 `roundRecorded`/`latestCycle` · `recordRound` 记周期 · `round()` 门控 :695 · `waveLinePhase` :470 · `#pendingFix` :496 · `#rowClosed` :540）
  - Modify: `packages/cdd-engine/src-next/session/run.ts`（`#bookkeep` recordRound 传 `frame.round` :508 · `#nextLinePhase` 成员测试 :365-374）
  - Modify: `packages/cdd-engine/src-next/face/gate.ts`（`#linePhase` 成员测试 :129-138）
  - Modify: `packages/cdd-engine/src-next/session/next.ts`（`FIX_READBACK_SUFFIX` 值 + 注释 → `annotate`）
  - Modify: `packages/cdd-engine/src-next/face/capsule.ts`（route 渲染注释 → `annotate`）
  - Modify: `packages/cdd-engine/src-next/**/__tests__/`（numeric `rounds` pin 重锚 → 数组；新 pin：跳号 fix 读回 · `roundRecorded` · 旧 `fix:N` 迁移等价）
  - Modify: `packages/kairos/skills/cdd-dev|cdd-plan|cdd-spec-writer|cdd-design/SKILL.md`（`backfill user adjudications` → `annotate the carrier with the adjudications` · 5 处）
  - Modify: `docs/maintainers/02-naming.md`（`§2.2` 登记 `backfill` = doc 去向 · 载体动作 = `annotate`）
- **Consumes**: T3（ledger round 门控/键）· T11（conclusionOf/相位单源）· spec §8.9 授权
- **Produces**: `rounds` 记周期号（身份）· `roundRecorded` 门控 · 相位「pending fix」成员测试 · `annotate` 术语单义 · W10 场景回归（跳号 review 的 fix 正确读回）
- **Steps**:
  - 数据形态 —— `ProgressRow.rounds` 改 `Record<string, number[]>` · 新增 `#cyclesOf(row, mode)` 迁移助手（numeric 旧值 → `[1..N]`） — checkable: 单测——`{fix: 1}` 归一为 `[1]` · `{review:[1,2]}` 保持
  - 记周期 —— `recordRound(key, mode, cycle?)` 去重追加周期（缺省 = 最新+1）· `roundCount` 改 `length` · 新 `roundRecorded(key,mode,cycle)` 成员测试 — checkable: 单测——`recordRound("k","fix",2)` ⇒ `rounds.fix=[2]` · `roundRecorded("k","fix",2)=true` · `roundRecorded("k","fix",1)=false`
  - 门控改身份 —— `round()` 前置 `!roundRecorded(mode, round)` 早退（替 `roundCount < round`） — checkable: 单测——`{review:[1,2],fix:[2]}` 上 `round("fix",…,2)` 非 null（旧计数法返 null）
  - 相位成员测试 —— `waveLinePhase`/`#pendingFix`/`#rowClosed`/`run.#nextLinePhase`/`gate.#linePhase` 的「pending fix」改 `latestReview ∉ fixCycles` — checkable: 单测——drift 作废 review-1 后首个 fix（周期 2）不再判幻影 pending fix
  - `recordRound` 调用传 cycle —— `run.#bookkeep` 传 `frame.round` — checkable: `grep -n "recordRound(frame.key, frame.phase)" session/run.ts` 带第三参
  - 载体动作改名 —— `next.ts` `FIX_READBACK_SUFFIX` 值 + 注释 · `capsule.ts` 注释 · skill ×4（5 处） → `annotate the carrier with the adjudications` — checkable: `grep -rn "backfill user adjudications" packages/` 零命中 · `grep -rc "annotate the carrier with the adjudications"` 计数一致
  - 命名登记 —— `02-naming.md §2.2` 增 `backfill`（doc 去向）/`annotate`（载体动作）两行 — checkable: 登记行在册
  - progress 迁移 —— `.kairos` progress 按载体名重建周期号 — checkable: `schema get plan-graph` 板面波次闭环正确（W10 ✔ · 不重派幻影 fix）
  - 跑引擎套件核对 —— checkable: `pnpm -C packages/cdd-engine test` 全绿
  - 提交原子 commit（`refactor(cdd-engine): round 身份单源（progress 记周期号 · roundRecorded 门控）· 载体动作 annotate`） — checkable: git log 单原子
- **Acceptance**: `rounds` 记周期号（身份）· `roundRecorded` 门控替计数比较 · 相位「pending fix」成员测试（drift 跳号不造假）· W10 场景回归绿 · `backfill user adjudications` 零残留 · `annotate` 术语在册 · 引擎 vitest 全绿 · EOF 恰一 newline
- **DependsOn**: 11

### Task 13: skill ⇄ engine 黑盒边界（全六 skill 派发纪律统一 + 内部实现词剥离 · pin 同步）
- **Objective**: 让 skill 层对引擎退化为**黑盒消费者**——skill 文本只载引擎**行为契约**，零内部实现镜像（D29 · 六前提①②③④⑤⑥）。两条裁定：**A 派发纪律统一**——background 执行 + 等完成通知升为**全六 skill 公共纪律**（现仅 cdd-dev I2 有）；**删 `timeout + poll otherwise`** 能力分支（宿主实现细节 = 死代码）。**B 内部实现词剥离**——全六 SKILL.md 删净：`WaveGate` · `effectiveWaves` · "wave derivation"/"ready set"/"wave batches" · `INPUT_WAVE_BRIEF`/`BASE_BRANCH`/"round context" · `CDD_BLOCKED:` 字节名 · "the engine truncates its own output" · "status capsule（`status:`/`blocker:`/`handoff:`）" · 崩溃机制（"crash-only snapshot + crash record"）+ 失败分类学（`HARNESS_ABORT`/`ENGINE_SELF_WRITTEN`/`EXECUTION_FAILURE`/`PLAN_CONFLICT`）· `--resume`/`-c` · "`--type` renders only where the verb's type discriminates"（I-row ×4 逐字重复）· `schema get … --output skeleton` 语法 + 骨架槽位名。**保留**（黑盒行为）：引擎唯一派发路径（I5 的**意图** · 去 `WaveGate` 名）· 后台派发 `cdd` + 读全量 stdout/stderr · `next:` 行收尾照抄分派直到 `done` · BLOCKED/TIMEOUT 无 `next:` 携因上报 · **bootstrap 例外**（每 flow 入口节点唯一字面命令 · `determine-base`/`set-base`/入口派发保留）。**pin 同步（破坏性）**：`status-routing-convergence.test.ts`（:103-110）的 `CDD_BLOCKED:` + `status: BLOCKED` 断言 → **行为断言**（BLOCKED 携带原因 · 按行锚定 BLOCKED 行本身）；`status-routing-convergence.test.ts`（:52-61）的 `next:` 锚定**保留**；`skill-anatomy.test.ts`（:250-259）的 `next:` 后无完整命令 pin **保留**（该文件未被本 wave 触碰）；契约面 `routeFactRule`（`contract/skill-anatomy.ts`）精化（去 payload 结构描述 · 留 dispatch-ready literal）。
- **Files**:
  - Modify: `packages/kairos/skills/cdd-dev/SKILL.md`（preamble 统一派发纪律 · `implement-wave` 删 `WaveGate`/波次推导 · `branch-review` 删 `BASE_BRANCH`/"round context" · I2 合入 preamble · I3 删 `--type` 句 · I5 去 `WaveGate` · Failure Modes 收敛行为面）
  - Modify: `packages/kairos/skills/cdd-plan/SKILL.md`（preamble · `author-plan` 拆巨型段（删 skeleton 语法 + `INPUT_WAVE_BRIEF`/`effectiveWaves` · 留「声明 `DependsOn` → 引擎推波」）· I1 剥 `--type` 句）
  - Modify: `packages/kairos/skills/cdd-spec-writer/SKILL.md`（preamble · `author-spec` 删 skeleton 语法 · I1 剥 `--type` 句）
  - Modify: `packages/kairos/skills/cdd-design/SKILL.md`（preamble · I2 剥 `--type` 句）
  - Modify: `packages/kairos/skills/cdd-close/SKILL.md`（preamble）
  - Modify: `packages/kairos/skills/cdd-report/SKILL.md`（preamble）
  - Modify: `packages/kairos/tests/status-routing-convergence.test.ts`（`CDD_BLOCKED:`/`status: BLOCKED` 断言 → 行为断言 · 行内锚定）
  - Modify: `packages/cdd-engine/src-next/contract/skill-anatomy.ts`（`routeFactRule` 措辞精化）
- **Consumes**: 无（根任务 · 独立面）· spec §8.10 授权 · 用户对话裁定 A/B
- **Produces**: 全六 skill 黑盒化（零内部实现词）· 派发纪律统一（background + 等通知 · `timeout + poll` 零残留）· 黑盒契约四条在册 · pin 同步（行为断言）
- **Steps**:
  - 派发纪律统一 —— 六 skill preamble 的 "Direct invocation" → 统一派发纪律（background 执行 + 等完成通知 · 不轮询）；删 cdd-dev I2 的 `timeout + poll otherwise` — checkable: `grep -rn "timeout + poll" packages/kairos/skills/` 零命中 · 六 skill preamble 均述 background
  - 引擎内部词剥离 —— 全六 SKILL.md 删 `WaveGate`/`effectiveWaves`/波次推导内部/`INPUT_WAVE_BRIEF`/`BASE_BRANCH`/`CDD_BLOCKED:`/失败分类学/`--resume`·`-c`/`--type` 判别规则逐 verb 句/skeleton 语法 —— 保留黑盒行为（唯一派发路径 · 后台读全量 · `next:` 即分派 · BLOCKED 携因上报）+ bootstrap 字面命令 — checkable: `grep -rn "WaveGate\|effectiveWaves\|INPUT_WAVE_BRIEF\|BASE_BRANCH\|CDD_BLOCKED:\|HARNESS_ABORT\|ENGINE_SELF_WRITTEN\|--resume\|--output skeleton\|renders only where" packages/kairos/skills/` 零命中
  - cdd-plan author-plan 拆段 —— 巨型单节点段拆解：删 skeleton 语法 + `INPUT_WAVE_BRIEF`/`effectiveWaves` 内部词 · 留「声明 `DependsOn` → 引擎推波」的**行为**表述 — checkable: 该节点零内部 token · 仍述「声明 DependsOn 即推波」
  - Failure Modes 收敛 —— cdd-dev Failure Modes 删分类学（`HARNESS_ABORT` 等）+"crash-only snapshot" 机制 → 行为面（异常退出 → 按阻塞原因上报） — checkable: Failure Modes 表零分类学/机制词
  - pin 同步 · 行为断言 —— `status-routing-convergence.test.ts` 的 `CDD_BLOCKED:`+`status: BLOCKED` 必含断言改**行为断言**（Failure Modes 述 BLOCKED 携因 · 按行锚定 BLOCKED 行）· `status-routing-convergence.test.ts` 的 `next:` 锚定保留不动 · `routeFactRule` 措辞精化（去 payload 结构） — checkable: 改后的 status-routing 断言绿 · `next:` 锚定测试仍绿
  - 消费面纯度核对 —— 零程序史（无 phase 号/rationale 叙事）· English-primary — checkable: skill-anatomy 检查通过
  - 跑 kairos 套件核对 —— checkable: `pnpm -C packages/kairos test` 全绿 · `pnpm -C packages/cdd-engine test` 全绿（契约面改动）
  - 提交原子 commit（`docs(kairos): skill ⇄ engine 黑盒边界——派发纪律统一 + 内部实现词剥离 · pin 同步`） — checkable: git log 单原子
- **Acceptance**: 全六 skill 零引擎内部实现词（`WaveGate`/`effectiveWaves`/`INPUT_WAVE_BRIEF`/`BASE_BRANCH`/`CDD_BLOCKED:`/失败分类学/`--resume`/逐 verb flag 复述/skeleton 语法）· background + 等通知纪律全六 skill 齐（`timeout + poll` 零残留）· 黑盒契约四条在册 · `status-routing-convergence.test.ts` 行为断言绿（行内锚定）· `status-routing-convergence.test.ts` 的 `next:` 锚定仍绿 · kairos + cdd-engine vitest 全绿 · EOF 恰一 newline
- **DependsOn**: 12

### Task 14: wave 门控绑 brief（wave 线 reviewed 身份 = brief-revision · 非整 plan hash）
- **Objective**: wave 线的 reopen 门控从 **whole-plan hash** 改绑 **渲染后 brief 的内容指纹**（D30 · D26 家族）——wave 的真实判定输入是 brief（§5：本 wave 的任务段 + plan `## Constraints`），而非整 plan。纯 append（改其它 task / 加新 task）不留痕于本 wave 的 brief → 已 review 的 wave **不再被误重开**（backfill 本不该高成本）。**doc 线（spec/plan review）保持整文档 hash 不变**（文档整体评审 → 改动即重开 · 用户裁定）。**诚实身份**：wave 线**新增专属 ref kind `brief-revision`**（`{plan, brief_hash}`）——`doc_hash` 层永不指向非文档；`sameRef` 按 kind 判别（异 kind 永不相等）。
- **Files**:
  - Modify: `packages/cdd-engine/src-next/session/ledger.ts`（`RefKind` 单值 → `"doc-revision" | "brief-revision"` · 新 `BriefRevisionRef` + `ReviewedRevisionRef` 联合 · `ReviewRefs#briefRevision` + `sameRef` kind 判别 · `ProgressRow.reviewedDocRevision` → `reviewedRevision` · `recordReviewedDocRevision` → `recordReviewedRevision`（泛型）+ 新 `recordReviewedBrief` · `reviewedRevisionOf`（原始）+ `reviewedDocRevisionOf`（doc 线窄化） · `Ledger` 持 `BriefRenderer` · `#briefRevision`/`#briefDrift` · `waveLinePhase` 的 drift 检查改 `#briefDrift`）
  - Modify: `packages/cdd-engine/src-next/session/run.ts`（bookkeep：wave review 走 `#recordReviewedWaveBrief`（`recordReviewedBrief`）· doc review 仍整文档 `#recordReviewedDocRevision`）
  - Modify: `packages/cdd-engine/src-next/**/__tests__/`（T11/D16 五 pin deliberate 重锚：run.test.ts / wave.test.ts / cli.test.ts 的 wave 行 `reviewedRevision` = brief-revision · brief 指纹 hash；**新 pin**：wave 外 append → 不重开（run.test.ts + wave.test.ts））
- **Consumes**: T11（wave 行 reviewed 记录）· T12（round 身份/门控）· spec §8.11 授权
- **Produces**: `RefKind` 两值（doc-revision / brief-revision）· `ProgressRow.reviewedRevision: ReviewedRevisionRef` · wave 线绑 brief 指纹（`recordReviewedBrief`）· 供分支终审
- **Steps**:
  - 诚实身份 ref —— `RefKind` 加 `"brief-revision"` · 新 `BriefRevisionRef{kind, plan, brief_hash}` + `ReviewedRevisionRef = DocRevisionRef | BriefRevisionRef` · `ReviewRefs#briefRevision(plan, briefContent)` `sameRef` 按 kind 判别（异 kind false）— checkable: `grep -n "brief-revision" session/ledger.ts` 命中 · 单测——doc-revision ≠ brief-revision（异 kind sameRef false）
  - 行字段泛化 —— `ProgressRow.reviewedDocRevision` → `reviewedRevision: ReviewedRevisionRef` · `recordReviewedDocRevision` → `recordReviewedRevision`（泛型）· `reviewedRevisionOf`（原始读）+ `reviewedDocRevisionOf`（doc 线窄化读：非 doc kind → null）— checkable: `grep -n "reviewedDocRevision[^O]" session/ledger.ts` 零命中（字段/记录方法改名，仅窄化读留名）
  - wave 绑 brief —— `Ledger` 持 `BriefRenderer` · `recordReviewedBrief(waveKey, planPath)`（读 plan → render → `briefRevision`）· `#briefRevision`/`#briefDrift`（kind 守卫）· `waveLinePhase` 的 drift 检查 `docLineVerdict`（整 plan）→ `#briefDrift`（brief）— checkable: 单测——wave 内 task 段变 → drift（reopen review）· wave 外 append → 不 drift（stay fix）
  - bookkeep 分派 —— `run.ts #bookkeep`：wave review → `#recordReviewedWaveBrief`（`recordReviewedBrief(String(frame.key), planPath)`）· doc review → `#recordReviewedDocRevision`（整文档）— checkable: 单测——wave review 后 `reviewedRevisionOf(key).kind === "brief-revision"`
  - 五 pin 重锚 + 新 pin —— T11/D16 五 pin（run.test.ts ×2 · wave.test.ts ×2 · cli.test.ts ×2）的 wave 行 `reviewedDocRevision:{doc,doc_hash}` → `reviewedRevision` = brief-revision（brief 指纹）· 新增「wave 外 append 不重开」pin — checkable: `pnpm -C packages/cdd-engine test` 全绿
  - 跑引擎套件核对 —— checkable: `pnpm -C packages/cdd-engine test`（29 files）全绿
  - 提交原子 commit（`fix(cdd-engine): wave 门控绑 brief（D30 · 诚实身份）`） — checkable: git log 单原子（a0e7cb74 已落 · 本 task 记录该变更的 durable 事实）
- **Acceptance**: wave 线 reviewed 身份 = `brief-revision`（`{plan, brief_hash}` · `doc_hash` 层不指非文档）· wave 内 task 段/Constraints 变 → 重开 review · wave 外 append → 不重开 · doc 线仍整文档 hash · `reviewedDocRevisionOf` 对 wave 行返 null · 引擎 vitest（29 files / 541 tests）全绿 · EOF 恰一 newline
- **DependsOn**: 13

### Task 15: `conclusionOf` work 腿 absent 语义（missing → undefined · 非 BLOCKED）
- **Objective**: 修 **legacy 载体闭合回归**（D31 · D26/D27 家族）——W11 fix（`b69bb177`）的 F3 把 `HandoffSchema.conclusionOf` 的 work 腿由未检查 cast（absent → `undefined`）改成「present-invalid 与 **absent 都** → `BLOCKED`」。**越界在 absent 支**：把「无声明」伪造成「失败声明」，与 `NextStepRouter.next`（`next.ts:78` · **只认显式 `BLOCKED/TIMEOUT` 为失败面 · 故意容忍 `undefined`**）自相矛盾 → 无 `status` 键的 P7 早期 work 载体（W1–W4/9 的 fix 载体）被读成 `BLOCKED` → `router.next` 返 `null` → `closedWaves()` 塌成 `{10,11}`，W1–W4/9 全部误判**未闭合**。**诚实读法（裁定）**：work 腿三分——**present-valid → 自身 · present-invalid → `BLOCKED`（F3 安全网保留 · 坏声明是失败信号）· absent → `undefined`（未声明结论 · 既不虚构 approval 也不虚构 failure · D27 present-facts-only）**。返回型 `RoundStatus | undefined`。**零数据回填**——历史载体经 route 判定自然闭合（改判据不改数据）。
- **Files**:
  - Modify: `packages/cdd-engine/src-next/session/handoff-schema.ts`（`conclusionOf` work 腿三分 · 返回型 `RoundStatus | undefined` · 头注收编 missing≠invalid）
  - Modify: `packages/cdd-engine/src-next/face/lifecycle.ts`（`#reconstruct` 见证 `?? "BLOCKED"`——`required` 门保证 work 草稿必有 status · 不可达 · 注明）
  - Modify: `packages/cdd-engine/src-next/session/__tests__/handoff-schema.test.ts`（pin 重锚：`conclusionOf("work",{})` → `undefined`（absent ≠ BLOCKED）· `{status:"garbage"}` → `BLOCKED` 保留）
  - Modify: `packages/cdd-engine/src-next/session/__tests__/wave.test.ts`（**新回归 pin**：无 `status` 键的 legacy fix 载体 · 其 wave 仍判闭合——`closedWaves()` 含该 wave）
- **Consumes**: T11（`conclusionOf` 单源）· spec §8.12 授权
- **Produces**: `conclusionOf` 返回 `RoundStatus | undefined`（missing≠invalid）· legacy 载体闭合回归消 · 供分支终审
- **Steps**:
  - work 腿三分 —— `handoff-schema.ts conclusionOf` work 腿：`carrier.status === undefined → undefined` · 否则 valid → 自身 · invalid → `BLOCKED` · 返回型改 `RoundStatus | undefined` — checkable: 单测——`conclusionOf("work",{})` → `undefined` · `{status:"garbage"}` → `BLOCKED` · `{status:"APPROVED"}` → `APPROVED`
  - reconstruct 见证 —— `lifecycle.ts #reconstruct` 的 `schema.conclusionOf(face, draft) ?? "BLOCKED"`（`required` 门保证 work 草稿有 status · `undefined` 不可达 · 注明） — checkable: typecheck 绿 · 注释述「unreachable」
  - pin 重锚 —— `handoff-schema.test.ts` 的 `conclusionOf("work",{})` 由 `BLOCKED` 改 `undefined`（原 pin 编码了 bug） — checkable: 改后的 pin 绿
  - 回归 pin —— `wave.test.ts` 增「无 status 的 legacy fix 载体其 wave 仍判闭合」（`recordRound` implement+review+fix · fix 载体 `{artifacts:{}}` · 源 review 0 blocker → `closedWaves()` 含该 wave） — checkable: `pnpm -C packages/cdd-engine test` 全绿（29 files / 543 tests）
  - 板面验证 —— 修复后 `schema get plan-graph` 复原（W1–W6 ✔ · W7 ▶ · 零数据回填） — checkable: 板面波次闭环正确
  - 提交原子 commit（`fix(cdd-engine): conclusionOf work 腿 absent→undefined（非 BLOCKED）——消 legacy 载体闭合回归`） — checkable: git log 单原子（2d795b4c 已落 · 本 task 记录该变更的 durable 事实）
- **Acceptance**: `conclusionOf` work 腿 absent → `undefined`（missing≠invalid）· present-invalid 仍 → `BLOCKED`（F3 安全网保留）· 返回型 `RoundStatus | undefined` · legacy 载体闭合回归消（W1–W6 ✔ · 零数据回填）· 回归 pin 绿（legacy fix 载体其 wave 判闭合）· 引擎 vitest（29 files / 543 tests）全绿 · EOF 恰一 newline
- **DependsOn**: 14

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.8 | 2026-10-14 | **T13 复核 F1 回填——pin 归属文件更正（Plan Sole Writer）**：W8（T13）review-1 F1（warn·spec）指出 T13 的 `Files`/`Steps` 与 spec §8.10 把 `CDD_BLOCKED:` pin 改锚归到 `skill-anatomy.test.ts`，**实际该断言住在 `status-routing-convergence.test.ts`**（T13 提交 `9d6f4e27` 未触碰 skill-anatomy.test.ts）——更正 T13 `Files`/`Steps`/`Acceptance` + spec §8.10 的文件归属（真文件 `status-routing-convergence.test.ts` · `skill-anatomy.test.ts` 退为「`:250-259` 的 `next:` 后无完整命令 pin 保留 · 未被本 wave 触碰」）。**同批**：F2（改锚断言按行锚定 BLOCKED 行 · 消退化匹配）语义补记（强化已由 fix `a42782a7` 落地）。**同批**：载体动作 `annotate`、`annotate` 术语已在册。`DependsOn: 12`（不动）· spec v0.12→v0.13 §8.10 | Oscar M. · Claude Opus 5（P7 编排器回填 · 2026-10-14） |
| v0.9 | 2026-10-14 | **P7 closeout（cdd-close）**：spec v0.14 Approved · 计划实现全闭合——十 wave 链全绿（W1={1,2,5,8} → W2={3,6,7} → W3={4} → W4={9} → W5={10} → W6={11} → W7={12} → W8={13} → W9={14} → W10={15} · 每波 implement→review→fix 各 APPROVED）· 分支终审 → 分支 fix 闭环（branch-review-1 2 nit → branch-fix-1 `bd27d63f` brief 段切片单助手收敛 + 编排器回填 `1f7236cb` overall 行序复原）· 验收全项交付（`pnpm run validate` exit 0 · 引擎 vitest 553/553 · kairos 76/76 · root 10/10 · typecheck ×3 · emit-check fresh · EOF 全绿 · 不发布） | Oscar M. · Claude Opus 5（kairos:cdd-close · closeout-backfill） |
| v0.7 | 2026-10-14 | **`conclusionOf` work 腿 absent 语义任务回填（D31 · D26/D27 家族 · Plan Sole Writer）**：新增 **T15（`conclusionOf` work 腿 absent 语义）**——W11 fix（`b69bb177`）的 F3 把 `conclusionOf` work 腿由未检查 cast（absent → `undefined`）改成「present-invalid 与 **absent 都** → `BLOCKED`」，与 router 契约（只认显式失败面 · 容忍 `undefined`）自相矛盾 → 无 status 键的 legacy work 载体被读成 `BLOCKED` → `closedWaves()` 塌成 `{10,11}`（W1–W4/9 误判未闭合）。**裁定**：work 腿三分（present-valid → 自身 · present-invalid → `BLOCKED` · **absent → `undefined`** · 返回型 `RoundStatus \| undefined`）。**修复 = 热修 `2d795b4c`**（引擎改判据 · **零数据回填**）+ 回归 pin（无 status 的 legacy fix 载体其 wave 仍判闭合）。**`DependsOn: 14`**（落 W9）· spec v0.11→v0.12 §8.12 | Oscar M. · Claude Opus 5（P7 编排器回填 · 用户确认 · 2026-10-14） |
| v0.6 | 2026-10-14 | **wave 门控绑 brief 任务回填（D30 · D26 家族 · Plan Sole Writer）**：新增 **T14（wave 门控绑 brief）**——wave 线 reopen 门控从 **whole-plan hash** 改绑 **渲染后 brief 的指纹**（D30 · 诚实身份）。wave 的真实判定输入是 brief（本 wave 任务段 + `## Constraints`），非整 plan；纯 append（改其它 task / 加新 task）不留痕 → 已 review 的 wave 不再误重开（backfill 本不高成本）。**wave 线新增专属 ref kind `brief-revision`**（`{plan, brief_hash}` · `doc_hash` 层永不指非文档 · `sameRef` 按 kind 判别）· `ProgressRow.reviewedDocRevision` → `reviewedRevision`（联合）· doc 线保持整文档 hash（用户裁定）。**同批**：`归位` D29——T13 backfill 时误将 D29 约束写入全局 `## Constraints`（该段进每个 wave 的 brief → 无差别扰动 open W6），D29 是 T13 专属约束，已移出全局段（其表述完整存于 T13 block）。**`DependsOn: 13`**（落 W9）· spec v0.10→v0.11 §8.11 | Oscar M. · Claude Opus 5（P7 编排器回填 · 用户确认 · 2026-10-14） |
| v0.5 | 2026-10-14 | **skill ⇄ engine 黑盒边界任务回填（D29 · 六前提①②③④⑤⑥ · Plan Sole Writer）**：新增 **T13（skill ⇄ engine 黑盒边界）**——skill 层对引擎退化为黑盒消费者（skill 文本只载行为契约 · 零内部实现镜像）。**A 派发纪律统一**（background + 等通知 = 全六 skill 公共纪律 · 删 `timeout + poll otherwise` 死分支）· **B 内部实现词剥离**（全六 SKILL.md 删 `WaveGate`/`effectiveWaves`/波次推导内部/`INPUT_WAVE_BRIEF`/`BASE_BRANCH`/`CDD_BLOCKED:`/失败分类学/`--resume`·`-c`/`--type` 判别规则逐 verb 句/skeleton 语法 · 保留黑盒契约四条 + bootstrap 字面命令）· **pin 同步（破坏性）**：`skill-anatomy.test.ts` 的 `CDD_BLOCKED:` 断言改行为断言 · `status-routing-convergence.test.ts` 的 `next:` 锚定保留 · `routeFactRule` 精化。**`DependsOn: 12`**（落 W7——不扰动 open W6 · 与 T12 同波次序列）· spec v0.9→v0.10 §8.10 | Oscar M. · Claude Opus 5（P7 编排器回填 · 用户确认 · 2026-10-14） |
| v0.4 | 2026-10-14 | **round 身份单源任务回填（D28 · D26 家族 · Plan Sole Writer）**：新增 **T12（round 身份单源）**——`progress.rounds` 记**周期号集合**（身份非计数）· `recordRound(key,mode,cycle)` 记周期 · 新 `roundRecorded` 成员测试替计数门控 · 相位三处「pending fix」改成员测试 · `#roundFor("fix")=reviews` 保留 · 迁移按载体名重建。**同批**：载体动作 `backfill`→`annotate`（`backfill` 锁义为 doc 去向 · `02-naming.md` 登记）。治 W10 实测 `fix APPROVED 却 no next: line`（fix-K⟷review-K 计数分叉 → HARD_ERROR）。**`DependsOn: 11`**（落独立 W7——不扰动 open W6）· spec v0.8→v0.9 §8.9 | Oscar M. · Claude Opus 5（P7 编排器回填 · 用户确认 · 2026-10-14） |
| v0.3 | 2026-10-14 | **判定面 ⊥ 输入面任务回填（D27 · D26 补完 · Plan Sole Writer）**：新增 **T11（判定面 ⊥ 输入面）**——`engineOnly` 概念退役（声明面=可写面）· `#materialize` findings 面删 `carrier.status`（载体只装声明面 · 断 fix child INPUT_FINDINGS 传染根）· 结论改判定时刻派生（单源 `HandoffSchema.conclusionOf` · `ledger.round`/`#pendingFix` 全走它）· `readJson` 三态化（治坏 JSON 误报草稿未写入）· `Ledger#waveLinePhase` 相位单源 guard。**`DependsOn: 10`**（落独立 W6——不扰动已录 W1–W5 的静态波次派生）· spec v0.6→v0.7 §8.8 | Oscar M. · Claude Opus 5（P7 编排器回填 · 用户确认 · 2026-10-14） |
| v0.2 | 2026-10-14 | **W5 收尾 review nit 回填（Plan Sole Writer）**：① nit-1 · T5 「`REVIEWS.*.ref` 改参照型」改为「**整体删**」——W1 已按 D26 派生副本清理裁决删除（零消费死码），计划字面与实况对齐（Obj + step + checkable 同步）；② nit-2 · §2.8 引入 `ledger.#roundKey` 为线键第三派生点（违 spec §3.7「防第三处再分叉」）——记录入 spec v0.6 change-history，代码收编归 fix 环 | Oscar M. · Claude Opus 5（W5 cdd-dev · 编排器回填） |
| v0.1 | 2026-10-13 | P7 实施计划 v0.1——单一实况判定面（commit-sha 全退役 + 物料无条件 extract + brief 镜像 + round/键/字段实况化 · spec v0.5 Approved）：W1{T1 sha 载体收编 · T2 carrier 声明收缩 · T5 templates 数据面 · T8 kairos 消费面} → W2{T3 ledger round/键/verdict · T6 next/capsule} → W3{T4 lifecycle read-back · T7 CLI 命令面} → W4{T9 测试重锚 + 五 pin} → W5{T10 收尾扫 + 验证 + 变更集} · 十任务块全用骨架 task-field 形态（`- **Objective/Files/Consumes/Produces/Steps/Acceptance/DependsOn**:` · step 带 `— checkable:`）· 不发布 | Oscar M. · Claude Opus 5（kairos:cdd-plan · 用户批准） |
