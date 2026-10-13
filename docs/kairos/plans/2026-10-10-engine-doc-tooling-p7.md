# 引擎文档工具（Engine Doc-Tooling）— P7 实施计划：单一实况判定面（commit-sha 全退役 + 物料无条件 extract + brief 镜像 + round/键/字段实况化）
**Spec:** [2026-10-10-engine-doc-tooling-p7-design.md](../specs/2026-10-10-engine-doc-tooling-p7-design.md)
- **Parent program**: [引擎文档工具（Engine Doc-Tooling）Overall](../specs/2026-10-10-engine-doc-tooling-overall.md)
- **Version**: v0.2 · 2026-10-14
- **Depends on**: P6（Done · v0.4 · hard）

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

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.2 | 2026-10-14 | **W5 收尾 review nit 回填（Plan Sole Writer）**：① nit-1 · T5 「`REVIEWS.*.ref` 改参照型」改为「**整体删**」——W1 已按 D26 派生副本清理裁决删除（零消费死码），计划字面与实况对齐（Obj + step + checkable 同步）；② nit-2 · §2.8 引入 `ledger.#roundKey` 为线键第三派生点（违 spec §3.7「防第三处再分叉」）——记录入 spec v0.6 change-history，代码收编归 fix 环 | Oscar M. · Claude Opus 5（W5 cdd-dev · 编排器回填） |
| v0.1 | 2026-10-13 | P7 实施计划 v0.1——单一实况判定面（commit-sha 全退役 + 物料无条件 extract + brief 镜像 + round/键/字段实况化 · spec v0.5 Approved）：W1{T1 sha 载体收编 · T2 carrier 声明收缩 · T5 templates 数据面 · T8 kairos 消费面} → W2{T3 ledger round/键/verdict · T6 next/capsule} → W3{T4 lifecycle read-back · T7 CLI 命令面} → W4{T9 测试重锚 + 五 pin} → W5{T10 收尾扫 + 验证 + 变更集} · 十任务块全用骨架 task-field 形态（`- **Objective/Files/Consumes/Produces/Steps/Acceptance/DependsOn**:` · step 带 `— checkable:`）· 不发布 | Oscar M. · Claude Opus 5（kairos:cdd-plan · 用户批准） |
