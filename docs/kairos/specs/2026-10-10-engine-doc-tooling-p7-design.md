# 引擎文档工具（Engine Doc-Tooling）— P7 设计：评测面 commit-sha 全退役 + 物料无条件 extract + brief=完整计划镜像 · 三 face 单输入
- **Version**: v0.2 · 2026-10-13
- **Status**: Draft
- **Author**: Oscar M. · Claude Opus 5（kairos:cdd-design [P7] 会话 · 用户裁定 · 2026-10-13）
- **Parent program**: [引擎文档工具（Engine Doc-Tooling）Overall](2026-10-10-engine-doc-tooling-overall.md)
- **Depends on**: P6（Done · v0.4 · hard——P6 全链闭合后开启评测面 commit-sha 退役 + 物料无条件 extract 续修 · overall 依赖图 D23）

## Design

本 phase 承接 P6 收口后的连续重构（程序六 phase 收口后的续 phase · 2026-10-13 cdd-design [P7] 会话注册 D23 · grilling 裁定 D24/D25 全按落定）。一把刀：**评测面从「检查 commit」转为「基于代码实况」**——① 评测面 **commit-sha 整体退休**（R2/Q1 · sha 是传话筒不是裁判 · 引擎从不 diff）· ② 所有 child 派发前的物料准备 **无条件 extract**（R1/R3 · 不存在才生成 → 每次派发前从当前 plan 重新 extract · 防旧版漂移）· ③ wave 三 face（implement/review/fix）**单输入 = 完整计划镜像 brief**（Q4(a)）· ④ **review 基准 = 最新 brief + live tree**（Q2）· ⑤ **branch review-fix 基于 base→head 方向**（R4 · base = 分支名，非双 commit sha）· ⑥ **changes[] 同退役、改动面由 review 自判**（Q3）· ⑦ **I7 撤除**。设计输入：kairos:cdd-design [P7] 会话（D23 注册 · D24 grilling Q1/Q2/Q3 裁定 · D25 Q4(a) 裁定）· overall v2.22（D23）→ v2.24（D24/D25）· recon 报告（commit-sha 触点全谱审计 · changes[]「引擎对账」prompt 虚构实证 · wave/doc/branch 三线 round context 逐 token 对比 · GitClient 生产调点枚举）。

### 1. 目标与边界
#### 1.1 设计输入与授权
- 设计输入：kairos:cdd-design [P7] 会话（D23 注册 · D24 grilling Q1→评测面 commit-sha 全退役 / Q2→review 基准=最新 brief / Q3→changes[] 同退役 · D25 Q4(a)→brief=完整计划镜像+三 face 单输入 · overall v2.24）· recon 报告（2026-10-13 · commit-sha 触点全谱 + changes[] 对账虚构实证 + 三 face round context 逐 token）
- **授权（六前提 · D23）**：允许破坏性变更、重写代码重组目录 · 从高维思考、OOP 抽象统一、零裸函数 · 最佳实践、不留技术债务、避免散文堆砌、避免声明再抄 · 高内聚低耦合、死代码空壳全清 · 消费者心智负担优先 · 最大程度重构整合、最大程度精简系统
- **授权（Q4(a) · D25）**：wave 三 face 单输入 `INPUT_WAVE_BRIEF`（brief = 任务段 + `## Constraints` 段完整镜像）· `OUTPUT_BRIEF` 折叠（brief 纯输入）· `INPUT_PLAN` 退役 · `INPUT_RANGE` token 整体退役（doc 锚 → `INPUT_DOC`）· 保留 `INPUT_FINDINGS`(fix) + `OUTPUT_EVIDENCE`(implement/fix)
- **不发布**（与 P1–P6 一致）：变更集归并落 pending · tag / publish = 独立动作
#### 1.2 退役判定模型（审定的根前提）
- **commit sha = 传话筒不是裁判**：GitClient 无任何 diff 方法（recon 实证 · git.ts 六 seam 全枚举）· templates.ts:485 的「引擎 reconcile `git diff <base>..HEAD`」是 **prompt 虚构**（引擎从不执行对账 · lifecycle.ts:549 只是 copy-through）· `scope_base`（ledger.ts:121）死字段无人写 · `snapshotSha` 恒 null（lifecycle.ts:507）· `addAll`/`commit`/`log` 三个 git seam 生产面零调点（recon）
- **sha 的唯一职责 = 告诉 review child diff 哪个范围**——恰是漂移源：base/head 传错 → review 审错范围。替代：review 基于 **live tree + 最新 brief + base 分支名** 自判（child 自己跑 `git diff`）——评审面全部落在代码实况，零 sha 携带
#### 1.3 保留面（冻结 · 非提交 sha 的实况携带者）
- **clean-tree gate 保留**（preflight.ts:129-133 · review 基线 = committed tree · 脏 → BLOCKED）· **doc_revision 内容指纹保留**（ledger 记录被评 doc 内容的 sha1 · run.ts:551-563 · 最新计划 reopen gate —— 非 commit sha · 内容实况）· **base set/get 语义不变**（新增 review 面读它 · 见 3.2）· doc-contract 判定语义不变（gate 零例外）· `WAVE`/`tasks`/`OUTPUT_REPORT`/`OUTPUT_HANDOFF`/`OUTPUT_EVIDENCE`/`INPUT_DOC`/`INPUT_FINDINGS` 保留 · 六命令功能语义不变（除 review 面 ref 退役）· `mattpocock-skills` 分派表零动

### 2. 评测面 commit-sha 全退役（Q1）
#### 2.1 git seam 清理（六 seam → 二）
- GitClient 瘦身：**`revParseHead` 删**（git.ts:35-41 · 唯一调点 cli.ts:718 → 删）· **`addAll`/`commit`/`log` 删**（git.ts:58-78,82-93 · recon 实证生产面零调点 · 未使用的死 seam）· **`topLevel`/`isClean` 保留**（cli.ts:726 · preflight.ts:133 调点仍活）——GitClient 只留仓库定位 + 干净性判断，引擎的 git 面收敛为「实况裁判」两函数
- `WorkScene.head` + `scene.head`（cli.ts:718）删 · `DispatchScene.head` 若存在同删 · 依赖 head 的 dry-run 合成 commits（cli.ts:564-572 · `head === null` 分支）→ 工作帧直接 `{ status: "APPROVED" }`（零 commits 合成）
#### 2.2 BranchRef 类整体删除
- `session/branch-ref.ts` 全文件删（short/args/fromHandoff/静态 short 全死）· `gate.refFromHandoff`（gate.ts:123-133）删 · `cli.ts` branch face 装配（:683-688）删 · **branch 线稳定键 `"branch"` 保留**（gate.ts:156-160 · find #9 · 与 commit ref 无关）
#### 2.3 CLI flag 退役
- `declare.ts` channels：`head` 通道删（:72）· `base` 通道改 **branch-name 语义**（:71 · 型 `"sha"` → branch 名——base set 已呈 `valueType: "branch"` 先例 · :169-170 注释语义从「review 8-char sha」改「base artifact 分支名」）· **`"sha"` 值域型全退**（`ShapedChannelValueType` :109 删 `"sha"` · `VALUE_SHAPES.sha` :143-146 删）
- `review` 命令 keys 删 `base`/`head`（declare.ts:222-223）· `REQUIRED_GROUPS.review.branch` = `["--base", "--head"]` → **`["--plan"]`**（:321 · branch review 只需要 plan 带给工作区身份 + INPUT_DOC 锚）· **`REQUIRED_GROUPS.fix.branch` = `["--findings"]` → `["--findings", "--plan"]`**（:327 · BranchRef 删后 branch fix 工作区身份恒 = `slugFromDoc(planPath)` —— plan 成硬依赖 · capsule/消费面字面本已带 `--plan`，声明面追上）· fix 其余 groups 不动
- 零 CLI 面传 sha：branch review 变为 `cdd review --type branch --plan <path>` 单参（head = 当前实况，永不传）
#### 2.4 child 返回契约（3 行 → 2 行）
- `RETURN_STDOUT_BLOCK`（templates.ts:423-439）删 `commits:` 行（:431）→ 恰好 **status + artifacts 二行**；artifacts 行处方 `OUTPUT_BRIEF`/`OUTPUT_REPORT`/`OUTPUT_EVIDENCE` → **`OUTPUT_REPORT`/`OUTPUT_EVIDENCE`**（:437 · brief 折叠为纯输入）
- `#parseBlockReturn`（lifecycle.ts:413-428）删 commits regex（:417-418）· `DispatchOutcome.commits` 删 · `#commitsOf`（:656-659）删 · `#bookkeep` commits 写点（:542/:546 · ledger.ts:745/:758/:776）删
#### 2.5 载体/ledger 面
- `handoff-schema.ts`：`COMMITS` 节点（:74-82）删 · `CARRIER_WORK.commits`（:108）+ `CARRIER_FINDINGS.commits`（:131）删 · `CarrierValue.commits`（:182）删 · CHANGED_FILE 同删（见 6.1）
- `ledger.ts`：`Round.commits` 字段（:37/:44/:53/:89-90/:214）删 · `commitSet`/`CommitSetLedgerRef`（:265-266）删 · `scope_base`（:121）死字段删 · `writeCrash` 的 `snapshotSha: null`（lifecycle.ts:507 + CrashRecord 字段）删
- `channel-closure.guard.test.ts`（token/通道注册表守卫）随删随配
#### 2.6 路由/next 面
- `Route.review`（next.ts:45）失 `{ base; head }` → **`{ kind: "review" }`（无 ref）**——评审 = 对 live tree 的新一轮判断，无 commit 范围可言
- implement 完成 → review 路由（next.ts:91-95）去掉 `commits?.base === undefined → null` 依赖（commits 已删）→ 恒出 `{ kind: "review" }` · fix blocker 重置 → re-review（:117-119）去双 legs 检查 → 恒出 `{ kind: "review" }` · missing-base null 行（:92）删 · `capsule.ts` #routeText 的 review 路由渲染（:125-156）删 branch ref 合成（:141-153 `route.head===undefined` 保底删 · BranchRef 合成删）→ 各类 review 全部 `review --type <type> <type-arg>`（type-arg = `--plan <path>`（wave/branch）· `--spec <path>`（spec）· `--plan <path>`（plan））——零 sha
#### 2.7 WAVE_BASE / FIX_BASE token 退役
- `brief.ts render`（:88-98）删 `head` 参 + `WAVE_BASE: ${head}` 行（:97）· `gate.ts renderBrief`（:115-121）删 `scene.head` 注入 · `lifecycle.ts` `FIX_BASE` 值删（:312 · #fixedPoint :403-408 删）· `fix`/`docs-fix` round context 的 `FIX_BASE` 行（templates.ts:282/:300）删 · `TOKENS` 注册表（templates.ts:448 `FIX_BASE`）删

### 3. review 参照面收敛 + base→head 方向（Q2 · R4）
#### 3.1 参照 tokens：一 doc 锚，再无范围
- **`INPUT_RANGE` token 整体退役**：`TOKENS`（templates.ts:453）· `REVIEW_CONTEXT`（:242）· `#valuesOf` 值（lifecycle.ts:300）· `#reviewRange` 方法（:371-385 · 三职一身的源头）全删
- **`INPUT_PLAN` token 退役**（Q4 实证：implement shell 声称「read Constraints via `INPUT_PLAN`」（templates.ts:174）但 **implement round context 从不携带 INPUT_PLAN**（:256-270）——声明/携带 gap · 与「Input range 空槽 drop」规则冲突 —— 篇首壳文虚构）· `TOKENS`（:452）删 · `#valuesOf INPUT_PLAN`（lifecycle.ts:301）删 · review shell 的 Constraints 参照随 brief 镜像而消失（见 5.1）
- **`INPUT_DOC` 升为唯一 doc 锚**：值 = spec→`--spec` 路径 · plan→`--plan` 路径 · **branch→`--plan` 路径**（原 docPath 仅覆盖 doc-kind target · branch-kind 补 `scene.planPath`）· `REVIEW_CONTEXT`（:237-248）换为 `ROLE`/`WAVE`/`INPUT_WAVE_BRIEF`/`INPUT_DOC`/`BASE_BRANCH`/`OUTPUT_REPORT`/`OUTPUT_HANDOFF`/`WORKSPACE_DIR`/`WORKSPACE_ID` 共享尾部（空值由 assembler drop · 每型只落本型事实）
- 每型参照定焦：**wave review → `INPUT_WAVE_BRIEF`（最新镜像 brief）** · **branch review → `INPUT_DOC`（plan）+ `BASE_BRANCH`** · **spec/plan review → `INPUT_DOC`（target doc）**——四 review 型各唯一参照，零范围 token
- **doc 线重复参照消解（复审实证）**：plan review 现状 `INPUT_RANGE=planPath` 与 `INPUT_PLAN=planPath` **双 token 同文件重复**（`#reviewRange` doc 职 + `scene.planPath` 职叠坐）· spec review 的 `INPUT_PLAN` 为空槽（spec 无 `--plan`）——两者在 INPUT_RANGE/INPUT_PLAN 退役后由**唯一 `INPUT_DOC`**（spec→specPath · plan→planPath）承接，doc 线 review-fix 与 wave 线同构
- **branch fix 文档上下文赋值（复审新决定 · 修真空 gap）**：`fix` mode round context（templates.ts:275-288）增 **`INPUT_DOC`**（branch → planPath · 与 review 线同款 branch-kind 补 `scene.planPath`）——现状 branch fix 的 `INPUT_WAVE_BRIEF` 恒空（`#waveBrief` 仅 wave 帧返回）而 `FIX_SHELL`（:195）声称读它——**branch fix child 今天只有 findings、零计划/约束上下文**（与 implement INPUT_PLAN gap 同款病）· `FIX_SHELL` 按线分句：wave→「`INPUT_WAVE_BRIEF`（完整计划镜像）」· branch→「`INPUT_DOC`（plan）」· review-fix 环（wave fix 的 INPUT_WAVE_BRIEF + branch fix 的 INPUT_DOC + docs-fix 的 INPUT_DOC）据此三线同锚
#### 3.2 BASE_BRANCH：base→head 方向的唯一携带者（R4）
- 新 token `BASE_BRANCH`：值 = **base artifact 的 base 分支名**（`base get --plan <path>` · cdd-dev determine-base→set-base 已落）· 带于 **wave + branch 两个 tree-review face** 的 round context（树评审需要 base 才能自跑 `git diff origin/<base>..HEAD`）
- **单一载体规则**（防再漂移）：review 派发零 CLI 传 base——`review --type branch --plan <path>` 单参，engine 派发时从 base artifact 读入注入 · 与「base set/get 是唯一读写路径」同源（cdd-dev 消费面零手工 JSON）· 缺 artifact → 空槽（assembler drop · scope 轴降级：按 working tree vs 参照文件面判，见 6.3）
#### 3.3 review 判据文本（模板面重写）
- `REVIEW_ITEM`（templates.ts:232-233）「review the criteria below against `INPUT_RANGE`」→ 按型参照句（wave→`INPUT_WAVE_BRIEF` · 其他→`INPUT_DOC`）；判据主体仍是固定前缀（`REVIEWS.*.axesGuide` + lens 词表）
- `REVIEWS.wave.ref` `"WAVE_BASE..HEAD"`（:315）/ branch `"BASE..HEAD"`（:321）→ 参照型元描述（`"INPUT_WAVE_BRIEF"` / `"INPUT_DOC · origin/<BASE_BRANCH>..HEAD"`）——ref 字段为类型元数据（测试 pin 面），随语义更替；`REVIEWS.spec/plan.ref` `"INPUT_RANGE"`（:327/:333）→ `"INPUT_DOC"`
- buildability 轴「dual evidence」双证据措辞保持（infra.test.ts pins :139-140 稳定）· "warn-level booking gaps the engine flagged" 虚构句删（见 6.3）
#### 3.4 doc review 面（spec/plan）
- spec/plan review 语义不变（判 `INPUT_DOC` = target doc）· `cdd-spec-writer`/`cdd-plan` 的 review 字面（`review --type spec --spec <path>` · `--type plan --plan <path>`）**零 churn** · doc-contract gate 零动

### 4. 物料无条件 extract（R1 · R3）
#### 4.1 派发前条件放宽（implement-only → 三 face）
- `cli.ts:415-416`：`if (verb === "implement" && scene.planText !== null)` → **`if (type === "wave" && scene.planText !== null)`**——wave 线 implement/review/fix 每次派发前都从**当前 planText** 无条件调用 `renderBrief`（每派发覆盖 · 无「存在就不动」复用 · `renderBrief` 本身已是无条件写 · gate.ts:115-121）
- 反漂移语义：brief 每次派发前重新 extract 自**当前** plan（Plan Sole Writer 中途改 plan → 下一派发读新镜像）·「wave 意义恢复」——review/fix 永远对新 brief 判，旧版漂移被结构性消除
#### 4.2 #waveBrief 守卫删 + OUTPUT_BRIEF 折叠
- `#waveBrief`（lifecycle.ts:390-397）`existsSync(brief) ? brief : ""` 守卫 + implement-only 分型删 → **任何 wave 帧返回 `scene.briefPath`**（fix 面不再依赖「brief 文件恰好在盘上」这一副作用前提）
- **`OUTPUT_BRIEF` 折叠**：brief 从「处方写路径」变「纯读输入」——`TOKENS`（templates.ts:457）删 · implement round context 的 `OUTPUT_BRIEF` 行（:264）删 · `#outputOf` kind="brief"（lifecycle.ts:339-343）删 · `cli.ts:461-467` 的 `artifacts.brief` 注入删 · implement shell 的 OUTPUT_BRIEF 处方句（templates.ts:174）删——三 face 单输入成立

### 5. brief = 完整计划镜像（Q4(a)）
- **镜像面**：brief = 该 wave 的 `### Task N:` 段（现状）+ **plan 的 `## Constraints` 段**（新并入 · BriefRenderer 增加 constraints section 提取 · 复用 `#rawSection` 类切片（brief.ts:101-113）· `render` 去 head 参）——`完整` = 实现/评审 child 所需的全部计划面（任务 + 约束）在一处，零第二参照
- **implement shell**（templates.ts:174）：「read `INPUT_WAVE_BRIEF` (the wave brief) + the plan's `## Constraints` via `INPUT_PLAN`」→「read `INPUT_WAVE_BRIEF` (the complete plan mirror — every `### Task N:` of the wave + the plan's `## Constraints` section, fresh-extracted at dispatch)」——壳文与 round context 重新一致（零 INPUT_PLAN gap）
- **次要面同步**：`cdd-plan` author-plan 的「implement child 直接读 `INPUT_PLAN`」句（SKILL.md:44）→「经 wave brief 镜像的 `## Constraints` 段」· brief 渲染调用点（gate.renderBrief 方法名 · `tasks-{tasks}-brief.md` 文件名 · Evidence 前缀）零 churn

### 6. changes[] 同退役 + 改动面 review 自判（Q3）
#### 6.1 载体/模板面删净
- `handoff-schema.ts` `CHANGED_FILE`（:84-93）删 · `CARRIER_WORK.changes`（:109）删 · `CarrierValue.changes`（:183）删 · `lifecycle.ts:549` `carrier.changes = draft.changes` copy-through 删（audit 实证：引擎从不 reconcile · 声明通道是死通道）
- `LICENSE_ITEMS` 的 `cl:changed-surface` 行（templates.ts:159）删 · `CLAUSES["cl:changed-surface"]`（:484-486 —— **「引擎 reconcile git diff」prompt 虚构条款**）删 · 实现/fix shell 零 changes[] 说辞（child 不再自报改动面）
#### 6.2 scope 轴自判（改动面 = review 的活判断）
- `REVIEWS.wave.axesGuide`（templates.ts:317）：「cross-check the handoff's changes[] ledger against `git diff <base>..HEAD`」→ **「reviewer 自己跑 `git diff origin/<BASE_BRANCH>..HEAD`（BASE_BRANCH 见 3.2 · 缺则按 working tree）· 每一改动文件须落在 wave brief 的文件面（`**Files:**` seams）或可归因（base 计划面 / 已审意图）· 不可归因的改动文件 = 候选发现（severity 自判）· 引擎零对账 · **reviewer 即改动面裁判**」** · 删「warn-level booking gaps the engine flagged can surface here as blockers」虚构句
- `REVIEWS.branch.axesGuide`（:323）`BASE..HEAD` → `origin/<BASE_BRANCH>..HEAD`（branch review IS 全量 diff · 每改动文件须归因 plan 需求 / 已审意图 / base 面）· 保留「normal finding → fix loop」
#### 6.3 保留：atomic commit + clean-tree gate
- child 仍提交原子单提交（`cl:atomic-commit`）· 仍要求 clean return（脏 → BLOCKED）· review 入口 clean-tree gate 保留——「提交状态」作为评审基线保留，但**引擎不再检查/读/传任何 commit 身份**（I7 的机制承诺随之溶解 · 见 7.1）

### 7. I7 撤除 + kairos 消费面同步
#### 7.1 I7 撤除
- `cdd-dev/SKILL.md:89` I7 行删——「Entry gate reads the tree, not the committed range」由构造变为平凡真（引擎已无 canonical commits · changed-surface WARN 机制已删）· I7 作为独立规则溶解，其承诺（gate 只判干净性 · review 审计全跨度）由 3.3/6.2 的「review 基于实况 + scope 自判」承接 · I7 之前的机制地图（off-ledger booking）随之消失
#### 7.2 cdd-dev 字面
- **branch-review 节点**（SKILL.md:60）：`review --type branch --plan <path> --base <merge-base> --head <head>`（+ `git merge-base`/`git rev-parse HEAD` 派生 + diff persist）→ **`review --type branch --plan <path>`**（零 ref · engine 从 base artifact 注入 BASE_BRANCH 给 child）· diff persist 句删（review 自判 · orchestrator 不再需要预跑 diff）
- implement / wave review / wave fix / branch fix 字面 API 不变（`implement --tasks N --plan <path>` · `review --type wave --tasks N --plan <path>` · `fix --type wave|branch --plan <path> --findings <path>` —— findings 通道不变 · I3 绝对不变）· I1「host 自动检测」I2「后台执行」I4/5/6 不变
#### 7.3 cdd-plan 字面
- `cdd-plan/SKILL.md:44`「The `## Constraints` section declares the constraint surface the implement child reads DIRECTLY via `INPUT_PLAN`」→「…reads via the wave brief's mirrored `## Constraints` section (`INPUT_WAVE_BRIEF` — the complete plan mirror, fresh-extracted at every dispatch)」· review 字面（:58 · `--type plan --plan <path>`）零 churn
#### 7.4 测试重锚 + 新 pins
- 引擎 14 个 pin 文件重锚：`branch-ref.test.ts` 随 BranchRef 删（整文件删）· `handoff-schema/ledger/next/capsule/cli/infra/render/run/wave/face/projection/fence/guards/smoke` 的 WAVE_BASE/FIX_BASE/INPUT_RANGE/commits/changes/snapshotSha/scope_base 字面 deliberate 重锚 · token 注册表守卫随删随配
- **新 pins**：engine 源码面 `WAVE_BASE|FIX_BASE|INPUT_RANGE|revParseHead|BranchRef` 零残留 grep pin · `BASE_BRANCH` 注入 pin（wave+branch review round context 携带 · spec/plan 不带）· **无条件 extract pin**（review dispatch 后 `tasks-{tasks}-brief.md` = 当前 plan 的最新镜像（任务段 + Constraints 段 · 零 WAVE_BASE 行）· 三 face 各自 re-extract 一次）· 华为契约 pin（RETURN_STDOUT_BLOCK 恰好 status+artifacts 二行）· GitClient 精简 pin（方法集 = topLevel + isClean）
- kairos 消费面：行为树 pins（presentation-surface.test.ts 等）随 skill 文本更替 · skill-anatomy 契约面零动（I7 非契约注册项）

### 8. 发布姿态与变更集
- 不发布（与 P1–P6 一致）：commit-sha 退役 + 无条件 extract + brief 镜像为引擎内部语义（kairos 消费面为字面同步）· changeset 归并落 pending · 无独立 tag/publish

### Acceptance criteria

- `评测面 commit-sha 分类退役全绿 ✓（GitClient 六 seam → topLevel+isClean 二 seam（revParseHead/addAll/commit/log 删 · 生产面零调点实证）· BranchRef 类 + gate.refFromHandoff 删 · --base(sha)/--head flag + "sha" 值域型删 · INPUT_RANGE/WAVE_BASE/FIX_BASE/OUTPUT_BRIEF token 退役 · child commits: 行 + RETURN_STDOUT_BLOCK 二行契约 · 载体 COMMITS/CHANGED_FILE + CarrierValue + Round.commits + scope_base + snapshotSha 删 · Route.review 无 ref · 引擎源码面 WAVE_BASE|FIX_BASE|INPUT_RANGE|revParseHead|BranchRef 零残留 grep pin））`
- `branch review-fix 基于 base→head 方向 ✓（review --type branch --plan 单参（REQUIRED_GROUPS review.branch=["--plan"] · branch 稳定键 "branch" 保留）· BASE_BRANCH = base artifact 分支名 engine 注入（零 CLI 传 base · 单一载体规则）· 缺 artifact → 空槽 drop · cdd-dev branch-review 字面重写零 sha 派生）`
- `review 基准 = 最新 brief + live tree ✓（wave→INPUT_WAVE_BRIEF · branch→INPUT_DOC+三3.2 BASE_BRANCH · spec/plan→INPUT_DOC · INPUT_RANGE/INPUT_PLAN token 整体退役（含 #reviewRange 源 + 壳文声称 gap 实证）· buildability 双证据保持）`
- `物料无条件 extract ✓（cli.ts 条件 verb=="implement" → type=="wave" · 三 face 派发前均从当前 plan 重新 extract 覆盖 · #waveBrief exists 守卫删 · OUTPUT_BRIEF 折叠（纯读输入 · artifacts.brief 注入删））`
- `brief = 完整计划镜像 ✓（任务段 + ## Constraints 段 · WAVE_BASE 行删 · render 去 head 参 · implement shell 壳文与 round context 恢复一致（零 INPUT_PLAN gap）· cdd-plan SKILL.md:44 约束通道句随更）`
- `changes[] 同退役 + 改动面自判 ✓（CHANGED_FILE + CARRIER_WORK.changes + CarrierValue.changes + 模板 cl:changed-surface 条款（含「引擎 reconcile」prompt 虚构句）全删 · wave/branch scope 轴 = review 自跑 git diff origin/<BASE_BRANCH>..HEAD − 参照文件面 · 不可归因 = 候选发现 · 引擎零对账 · REVIEWS spec/plan ref → INPUT_DOC）`
- `载体/路由/契约重整全绿 ✓（CARRIER_WORK/FINDINGS 声明 + CarrierValue + ledger Round + RETURN 二行契约 + #parseBlockReturn/#commitsOf/#fixedPoint/#reviewRange/#outputOf(brief) 删 · handoff/next/capsule/declare 同步 · channel-closure 注册表守卫随删随配 · token 注册表守卫生效）`
- `doc 线与 branch 线 round context 同构化 ✓（plan review INPUT_RANGE==INPUT_PLAN 双 token 重复消解 → 唯一 INPUT_DOC · spec review 空 INPUT_PLAN 随 token 退役 · branch fix 文档上下文赋值——fix mode context 增 INPUT_DOC(branch→planPath) · FIX_SHELL 按线分句（wave→INPUT_WAVE_BRIEF · branch→INPUT_DOC） · branch fix 真空 gap 修净 · REQUIRED_GROUPS.fix.branch=["--findings","--plan"] · branch review 零 OUTPUT_EVIDENCE / branch fix 保留 OUTPUT_EVIDENCE 保持）`
- `I7 撤除 + kairos 消费面同步 ✓（cdd-dev SKILL.md:89 I7 行删 · :53 branch-review 字面重写零 ref · cdd-plan :44 INPUT_PLAN→镜像 Constraints 句 · 行为树 pins 全更替）`
- `引擎 vitest 全绿（14 pin 文件 deliberate 重锚 + 新 pins：sha 零残留 / BASE_BRANCH 注入 / 无条件 extract rematch / 二行契约 / GitClient 二方法集）· kairos suite 全绿（vitest run）· EOF 全绿 · `pnpm run validate`（或等价 CI 原生序列）ALL PASS · 引擎 CLI 均以仓库内 bin 调用 · 不发布`

## Constraints

- **六前提（D23）**：允许破坏性变更、可重写代码重组目录、不保守不打补丁；从高维思考、OOP 抽象统一、零裸函数；最佳实践、零技术债务、避免散文堆砌、避免声明再抄；高内聚、低耦合、死代码空壳全清；消费者心智负担优先（不为完成任务而设计）；最大程度重构整合、最大程度精简系统
- **保留面冻结**：clean-tree gate（review 基线 = committed tree）· doc_revision 内容指纹（doc sha1 · run.ts:551 · 最新计划 reopen gate —— 非 commit sha）· doc-contract 判定语义（gate 零例外）· base set/get 语义不变 · `WAVE`/`tasks`/`OUTPUT_REPORT`/`OUTPUT_HANDOFF`/`OUTPUT_EVIDENCE`/`INPUT_DOC`/`INPUT_FINDINGS` token 保留 · 六命令功能语义不变（除 review 面 ref 退役）· `mattpocock-skills` 分派表零动 · branch 线稳定键 `"branch"` 保留
- **引擎 vitest 全绿**（recon：五面测试套件 14 pin 文件 · deliberate 重锚 · 零跳过零容错）
- **kairos 消费面字面同步**：cdd-dev/cdd-plan skill 文本 + 行为树 pins 随 engine 语义更替（consumer 环境无 monorepo 布局；消费面纯度：零程序史）
- **语言策略**：本 spec 为内部开发者文档（Strategy B · 中文）· 引擎源码/skill/发布面 English-primary 不变
- **EOF**：仓库文本文件以且仅以一个换行符结尾（字节级）
- **不发布**（与 P1–P6 一致）

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.2 | 2026-10-13 | doc/branch 线 review-fix round context 复审折入——plan review 双 token 重复消解 · branch fix 文档上下文赋值（fix mode 增 INPUT_DOC · FIX_SHELL 按线分句 · REQUIRED_GROUPS.fix.branch 追 --plan） | Oscar M. · Claude Opus 5 |
| v0.1 | 2026-10-13 | P7 设计实写——评测面 commit-sha 全退役（Q1）· review 基准=最新 brief + base→head 方向（Q2/R4）· 物料无条件 extract（R1/R3）· brief=完整计划镜像三 face 单输入（Q4(a)）· changes[] 同退役改动面自判（Q3）· I7 撤除 · 六前提 mandate | Oscar M. · Claude Opus 5 |