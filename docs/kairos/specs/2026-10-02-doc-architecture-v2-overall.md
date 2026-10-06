# 文档架构方法论 v2（Doc Architecture v2）— Overall Spec

- **Version**: v1.9 · 2026-10-06（**P3.1 扩域定案**——cdd-design grilling 2026-10-06：P3.1 升为「统一 StructureRule 规则引擎 + 登记叶完备（plan 边 · designItems · charter facets）+ overall charter 结构秩」——doc 平面语义元素 = 类型化叶平面 · checks/walks 手写遍历归零 · 全树 4 overalls 结构秩迁移）
- **Status**: Draft
- **Author**: [human] · Claude Opus 5 (1M context)（kairos:cdd-design → grilling 元层）
- **Constraints**:
  - **破坏性变更授权**（2026-10-02 用户拍板）：允许破坏性变更 / 重写代码 / 重组目录——约束 = 高维思考 / 抽象统一（OOP）/ 确保最佳实践 / **零技术债务**
  - **空壳、死代码即删（2026-10-02 用户补条，本程序常设铁律）**：空壳、死代码、已废面、占位壳即删不留残壳——代码 / 文档 / 配置 / 契约全平面适用；结算 / 收敛 / 迁移中暴露的死壳同规（与 pi-harness P5「死壳即删」同源，本程序将其常量化为 Standing rule 候选，见 P6）
  - **尽量复用上游规则**：dispatch skill-ref = 有序链；拟合规则判定（上游方法论 ⊆ op 需要 → ref=上游默认全量照用；∅ fit → 一产化 skill；结构冲突 → capability-resolved 而非规则 override）
  - **历史正文不 retro-rename**：既有 overall/phase/plan 与 CHANGELOG = 史实即史实；本程序改造的是**方法论与 schema**，不重写已 shipped 内容（渐进迁移新老交割，见 Non-goal #2）
  - **先落留存、P5 结束后再开线**：本整体批准 ≠ 任一 phase 启动（GATE）；pi-harness P5 未结束前不开 v2 执行线——charter 先行留存全量决策
  - 方法论文档 = 中文（Strategy B 内部 docs）；消费面 skill 文本 = 英文主源（Strategy A）

## Document scope

Charter only, zero implementation detail. **Overall approval is not equivalent to any phase started（GATE）**——本整体为「先落留存」，执行线显式押后至 pi-harness P5 结束后再开；变更先回填本 overall（backfill-as-version），再继续实现。

## File paths

| Artifact | Path |
|---|---|
| Overall | `specs/2026-10-02-doc-architecture-v2-overall.md` |
| Archive | `specs/2026-10-02-doc-architecture-v2-archive.md`（issue/history 结构化 record；精确命名与形态归 P6 定义，届时回填本表） |
| Phase spec | `specs/2026-10-02-doc-architecture-v2-p<N>-design.md` |
| Phase plan | `plans/2026-10-02-doc-architecture-v2-p<N>.md` |

## Program charter

**Goal**：把跨 4 个 overall 家族 / ~20 phase（18 份 design + 19 份 plan）/ pi-harness 单系 28 个 change-history 版本积累的**文档内容组织方法论**蒸馏为类型化对象模型——**DocType 抽象**（shape/words/instructions/refKind/bodyView 五域合一）+ **TaskGraph 任务图**（分组由图派生、约束继承 delta-only）+ **DispatchContract / DispatchPacket**（skill 链 / capability / ref / 类型化正文）+ **overall 宪法/档案分层** + **一产化 `cdd-doc-review`**——达成「更精炼、不损失质量、零债务、可演化」的文档平面；并保持消费者链（engine CLI 面、上游 skill 引用、现有 schema 校验）渐进兼容、历史零 retro-rename。

**Non-goals**：
- 不 retro-rename 既有 all overall/phase/plan/CHANGELOG 正文（历史即史实）
- 不重写已 shipped 内容——新模型以**新 schema 形态**落地；旧文档**全量形迁移**（**P3 落地**：20 design + 21 plan 内容保真转录至新形态——任务编号/验收/约束原文逐字保留 + 机 pin 无损断言；双读面全量退役，engine 单形态；新文档带 legacy 面 = BLOCK）
- 不与上游强绑：skill-ref 仅在上游方法论 ⊆ op 需要时引用；无 fit 一律一产化（cdd-doc-review 先例）——不硬凑 ref、不因上游形态冲突降级静默
- 不新增无限增生的散文面：改造方向 = 样板 schema 化 / 数据化 / 派生化——任何 new 长散文节 = 反模式

**Cross-cutting**（程序级横切约束，先立后执行）：
- **`doc word = code word = engine token` 升为 `object word = ref word`**：文档身份、ref 身份、技能引用、正文视图同一契约面（DocContract），零手写重复映射
- **拟合规则 fit(skill, op) = skill 方法论 ⊆ op 需要**：⊆ 真 → ref=skill；∅ → 一产化；冲突 → capability-resolved（非规则 override）
- **派发粒度 = 单进程外层 + 内层并行 capability-resolved**：engine 外层始终单进程；并行 sub-agents 是派发 agent 内行为，由 harness-contract `capabilities` 域逐 harness 声明（M3）
- **接受上游规则为默认**：code-review 并行双轴（claude 面）、implement-spec/tickets 任务图先例——本程序模型是对既有最佳实践的**抽象统一**，非发明新方法论
- **Criterion ②（零裸函数）延续**：所有新抽象（DocType / TaskGraph / DispatchRef / BodyView / InstructionUnit）以类 + 构造注入落地，engine `documents/` 手写 per-type 分支收敛为 DocType 实例方法

**设计决策留存（brainstorm grilling 定案 2026-10-02 —— 全量记录，不遗漏细节）**：

**M 组（skill-ref 映射，M1–M4 全关）**：
| op | skills（有序链） | 依据 |
|---|---|---|
| implement | `[mattpocock-skills:implement]`（spec/tickets→交付面——**supersede 既定 `dispatch.implement = tdd` 映射**；tdd 仅作真行为变更的条件纪律，经 B1 `appliesTo` 表达、非恒常进链） | M1（user 拍板）：上游实存证据 = 安装目录 `~/.claude/plugins/marketplaces/mattpocock/skills/engineering/implement/SKILL.md`（安装版本 v1.2.3；「Implement a piece of work based on a spec or set of tickets」——原始读取）；spec/tickets→交付面 ⊇ tdd 纯 test-first 面；harness-contract `dispatch.implement` 槽自 tdd 改指 + `refs` 域登记 `mattpocock-skills:implement` 为本程序 P5 待办 |
| fix | `[superpowers:receiving-code-review, superpowers:verification-before-completion]` | M2：严谨验证 findings 拒盲从 → 提交前证据先行；harness 多 skill 原生态 |
| review.task/branch | `[mattpocock-skills:code-review]` | M3：并行双轴 capability-resolved；删 engine「单 agent 并行禁」（harness-contract:94,98 + template-contract axesGuide 三处禁文） |
| review.spec/plan | `[kairos:cdd-doc-review]` | M4b：URC（spec 三轴 / plan 三轴）+ writing-plans 自检准则 + verification evidence + grilling 追问——一产组合体内化，kairos 第 9 席 |

- 拟合规则 + dispatch.skills = 有序链（多 `/xxxx` token，`refs` 域逐 token 渲染，pi = `/skill:a /skill:b`）
- **M4a 处置**：M4a（review.spec/plan 映射候选线）随目录实测结论并入 M4b 一产化定案（唯一真 fit，见下）——M 组决策序号 M1–M4 连续、可审计
- **目录实测结论**：无单上游 skill 是「设计文档评审」；spec/plan review 的方法论 = 程序自有 URC + 三纪律组合——一产化是唯一真 fit（M4b）

**F 组（文档平面结构，提案）**：
- F1 TaskGraph 分组派生（`depends_on`/`atomic_with` → DAG → 拓扑序分组；字面 `## Task Groups` 段删除；plan-parse crisp BLOCK：无环 / union==task set / atomic 闭包）——**P3 grilling 定案（v1.6）**：组 = 原子闭包分量（atomicWith 无向单侧声明 + 对称传递闭包自动补全），组执行序 = 分量 DAG 拓扑序；「先清底再上闸」= 拓扑性质（每条边 rank(源) < rank(目标) 断言）；crisp BLOCK 全套 = id 越界 / 自引用 / 矛盾边（同对 atomic∧depends）/ 环（收缩后 DAG）/ 重复声明；**P3.1 定案（2026-10-06）**：+ 第六 failure class `missing-edge`（边行缺省 = plan validate BLOCK）
- F2 overall 宪法/档案分层（Standing rules 规范化折叠；issue/history 迁 `*-archive.md` 结构化 record）
- F3 phase-spec 样板 schema 化（真骨架 = `## Design` + `### Acceptance criteria` + `## Constraints` 继承点；样板 → schema description + 条件元数据）；**P3.1 定案（2026-10-06）**：+ `## Design` 体 `#### N.M` designItems 登记叶（结构秩恢复 · 计数/标题逐字/空壳 pin）
- F4 plan 约束继承 delta-only（宪法 auto-applies，per-plan 复述清零）
- F5 Task=数据（`{objective, files[], interface{consumes,produces}, steps[]{action,checkable}, acceptance[]}`）+ brief=数据渲染
- F6 统一结构规则引擎（StructureRule，**2026-10-06 P3.1 grilling 定案**）：doc 平面语义元素 = 类型化叶平面（presence/uniqueness/domain/crosslink/order/continuity/residue 不变式）；overall/plan/spec 三类型结构判定 → 声明式规则集 + 单解释器（手写遍历 + 测试 re-walk 归零 · docContractValidate 单调用）；graph 科学留 TaskGraph · 跨文档链留 P5；bodies load-order 安全（规则数据 ≠ 解释器引入）
- F7 overall charter 结构秩（**2026-10-06 P3.1 定案**）：`## Program charter` 内 charter facets（Goal/Non-goals/Cross-cutting/决策留存）升 `###` · 决策组（M/F/R/B/E/上游先例背书）升 `####` 叶；全树 4 overalls 迁移（内容逐字 · 容器只移）；OverallDocBody 补齐（shape+slices+rules 三件套并肩 plan/spec）；P6 宪法/档案分层边界不动

**R 组（ref 统一身份，提案）**：
- R1 task ref = handoff ledger `commit-set`（去 HEAD 环境依赖：提交身份从环境不变量推导转为显式记账）
- R2 spec/plan/overall = 一等 `doc-revision` ref（`{docPath, versionToken, bodyHash}` 双层收敛：version bump 或 body 变更 = new ref）；backfill-as-version 机械化 = archive 的 doc-revision ref
- R3 DispatchPacket 正文一体（ref + bodyView + convergence + constraints）
- R4 review/fix 轮的评审范围 = `commit-range` ref（`base..head` 两提交身份界定评审/修复范围，随 handoff `commits{base,head}` 固化——refKind 四型之 commit-range，与 R1 commit-set 基型不同、互不取代）
- R5 v2 TaskGraph 派发 = `graph-node` ref

**B 组（正文内容，提案）**：
- B1 InstructionUnit 结构化（`{id, appliesTo, kind, requirement, machineCheck, failBehavior}`）——clauses 散文原子升 typed，按 appliesTo 过滤渲染
- B2 return/evidence = schema 引用（正文零格式散文）；evidence 绑定 ref 可追溯
- B3 BodyView 分型（spec/plan/task/branch 各一形）+ convergence 数据面
- B4 约束继承 + 子集过滤（每 dispatch 只带适用规则，正文 -30~50%）
- B5 task step 类型约束（每步 = action + checkable，schema 校验非作者自觉）

**E 组（经验债，驱动本整体）**：E1 overall append-only 增生（143 行 · history 28 行 · issue 18 行 prose）· E2 phase-spec 六段五样板 · E3 plan 约束再述 · E4 Task Do 长散文 + brief 散文雕刻 · E5 Task Groups 字面行静默偏差（格式漂移丢组 / 节界截断 / 越界延迟爆 / 意图无回读 / 双写认知）· E6 schema/template-contract/lexicon 三面无统一抽象 · E7 版本行 lineage 散文。编号独立于 Phase inventory 的 P#（债源自既有程序阶段线，非一一对应），两系仅组号字面相近、无映射关系。

**上游先例背书**：`implement-spec`（tickets = task graph + frontier + 指针通信 ≈ v2 TaskGraph 分组 + DispatchPacket 指针式正文）· `to-tickets`（blocking edges ≈ 任务边）· `code-review`（双轴并行——本程序 capability 模型后照用）

## Issue inventory

| Phase | Issue (ref) | Title summary |
|---|---|---|
| P1 | none | DocType 抽象 + schema 工厂：五域 DocType（shape/words/instructions/refKind/bodyView）· template-contract/lexicon/doc-structure schema 收编为 DocType 字段 · engine `documents/` per-type 手写分支 → DocType 实例方法（Criterion ②）· doc-structure schemas 以 schema 工厂原子化派生。**（'doc-structure schemas' 语义 = 三类书面 artifact 形状：phase-spec/plan/overall——add-phase-protocol/skill-anatomy 属协议/注册 schema 非 doc 结构，留手写 JSON + schema.test 校验；v1.2 裁决）。P1 全量落地（2026-10-05）：design v1.1 · plan v1.1 · 实现 T1–T7 merged #315，documents/ 分支归零 · 派生产物字节保真 · 验收全绿。** |
| P2 | none | 文档平面瘦身：phase-spec 样板 schema 化（`## Design` + `### Acceptance criteria` 唯一 + `## Constraints` 继承点；增量警告/约束指针/偏差/下游注/评审记录 → schema description + 条件元数据）· plan Task=数据（task `{objective,files,interface,steps,acceptance}` + step checkable 类型约束 + brief 数据渲染）· plan 约束继承 delta-only（宪法 auto-applies，per-plan 复述清零）。**P2 全量落地（2026-10-05）：design v1.1 · plan v1.1 · 实现 T1–T7 全闭环——DocBody 模型 + 三真骨架 + Task 数据化 + delta-only 双侧 + 双读。** |
| P3 | none | TaskGraph 分组派生（`depends_on`/`atomic_with` 边模型 → 原子闭包分量=组 · 分量 DAG 拓扑序=组序 · crisp BLOCK 全套：越界/自引/矛盾边/环/重复 · 「先清底再上闸」= 拓扑性质测试钉）+ **双读面全量退役**（Form B 散文锚约束读 · 六段 spec 读 · `- **Do**:` brief 雕刻 · `## Task Groups` 读写 · Section-1 指针读 · taskBlock schema 面 · smoke-cdd legacy 派生面——engine 文档形态单一化，新文档带 legacy 面 = BLOCK）+ **全树 41 文档形迁移**（20 design 六段→三真骨架 · 21 plan Do→数据形 + interface/checkable/边声明；任务编号/验收/约束原文逐字保留 + 机 pin 无损断言）。**（v1.6 扩域）。P3 全量落地（2026-10-06）：design v1.1 · plan v1.2 · 实现 T1–T9 全闭环——TaskGraph 边模型全落 + 双读面 runtime 全删 + 全树 41 文档形迁移（47 校验文件树套件零排除绿）· 消费面同步（cdd-plan + cdd-dev 边声明撰作面）+ changesets。** |
| P3.1 | none | **边声明完备 + design body 结构面 + lifecycle 预校验**（用户 2026-10-06 拍板，P3 close 前 mid-flight backfill）：P3 shipped 暴露两盲区——① design body 结构秩被压平（`### 2.x` → `**2.x**` 加粗伪标题 · 机器不可见 · design body 是最后一个无登记叶平面）② 边声明 silent default（`DependsOn`/`AtomicWith` 缺行 = `[]` 全单例 · 机器无 oracle 拦「忘写」）。P3.1 修复 = **mandatory edges**（每任务块必带两行 · `none` 显式值 · 缺行 BLOCK）+ **designItems 叶**（`####` 秩登记 · 结构秩恢复 · 空壳即删）+ **lifecycle 预校验补全**（design items 结构 + plan 边完备进 docContractValidate 链）+ 引用 lint（WARN）+ tree-migration 结构秩 pin（P3 盲区补 pin）。**（v1.9 扩域 2026-10-06 grilling 定案）**：+ **统一 StructureRule 规则引擎**（doc 语义元素 = 类型化叶平面 · 三类型结构判定规则数据化 + 单解释器 · checks/walks 手写遍历归零 · 树套件消费同一引擎）+ **overall charter 结构秩**（`## Program charter` facets `###` + 决策组叶 `####` · 全树 4 overalls 迁移 · OverallDocBody 补齐 · P6 边界不动） |
| P4 | none | `cdd-doc-review` first-party skill（kairos 第 9 席）：URC（spec 三轴 / plan 三轴）+ writing-plans 自检准则（spec 覆盖/占位扫/类型一致）+ verification evidence + grilling 追问——组合体内化单 skill · skill-anatomy registry 注册 + 目录扫描守卫含新成员 + README/tests/changeset |
| P5 | none | DispatchContract + DispatchPacket：harness-contract `dispatch` 域重构（skills 有序链 + `capabilities` per-harness 子代理面 + `refKind` commit-set/commit-range/doc-revision/graph-node + bodyView）· ref 机制（R1 handoff ledger·R2 doc-revision 双层收敛·R3 一体）· DispatchPacket 正文（InstructionUnit 结构化 + return/evidence schema 引用 + BodyView 分型 + convergence 数据 + constraints 子集过滤）· 三处禁文删除（harness-contract:94,98 + template-contract axesGuide）· M1 supersede 落地（dispatch.implement 自 tdd 改指 mattpocock-skills:implement + refs 域登记，规格锚 M1 行「P5 待办」） |
| P6 | none | overall 宪法/档案分层：宪法本体（Goal/Standing rules 规范化折叠/Cross-cutting/Phase inventory/Dependency graph）+ `*-archive.md`（issue/history 结构化 record + doc-revision ref 机械化 backfill）· **「空壳、死代码即删」入 Standing rules 常态化** · 版本行 lineage 散文消解 |
| P7 | none | **engine token 翻译能力（English-primary + 中文支持）**（用户 2026-10-05 拍板，P2 实现会话 mid-flight backfill）：doc 结构 token 面（DOC_TOKENS / shape 标记如 `- **验收**:` · `- **注**:` · Form B 锚名）全 English-primary 化 + 翻译层（中文别名 ↔ 英文规范型双向识别，legacy 中文标记保持可解析）· 词表 / 胶囊输出词面 locale 支持（locale-normalized 消费）· 新骨架 schema / DOC_TOKENS description 零中英混杂机器标记 |

## Phase inventory

| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |
|---|---|---|---|---|---|---|
| P1 | DocType 抽象 + schema 工厂 | 五域 DocType + doc-structure schema 工厂 + template-contract/lexicon 收编 + documents/ 分支收敛 | Done | Done | 落地交付记录：五域 DocType 抽象 + DocTypeRegistry（resolve 未知 throw · all() 固定序 [overall,plan,spec]）+ 三子类 per-type validate/parse 收编 · shape 域 + SchemaFactory（config/schema/*.json 派生化字节保真，diff 钉 ×3）· words 域 + contract-lexicon.json 派生化字节等价 · bodyView 分型面（reviews.{spec,plan} 迁 doctypes/body-views.ts）+ TemplateLoader 重接 · 收敛接线 S1/S4/S5/S6（docKindOf 删除 · detect 注册表有序扫描 · CLI --type 经 DocType.lifecycle）· S8 tokens shape 域（deriveDocTokens 经 DocType.shape，DOC_TOKENS 字节不变）——documents/ per-type 手写分支归零（Criterion ② 类面无裸函数）；engine 1263/1263 绿 · validate ALL PASS（residue/lexicon guard 零回归）· typecheck 三项目绿 · biome clean · emit 新鲜 | 无（program 起点） |
| P2 | 文档平面瘦身 | phase-spec 样板 schema 化 + plan Task=数据 + 约束继承 delta-only | Done | Done | 落地交付记录：DocBody 类型化正文模型（PhaseSpecBody 三真骨架 + 条件段 / PlanBody Task 数据化 + brief 数据渲染 + SlicePattern 投影 + `dependsOn?`/`atomicWith?` P3 扩展位）· DOC_TOKENS 环安全叶子绑定（body 叶子投影 → DocType.shape + tokens 同源同值）+ 加载序回归 · 约束继承 delta-only 双侧（plan/spec 读整体 + 合并呈现 · Form B 新 doc 禁 · legacy 双读）· legacy 六段/Form B 双读契约 + extractor 投影单源（taskNumbersFromPlan）· DOC_TOKENS deliberate update 重 pin · SKILL 骨架指导语同步 + skill-anatomy · changesets——engine suite 全绿 + validate ALL PASS；P2 自身 spec/plan 按当前规范形（Section 0–5 / Form A）写成 | P1 ->(hard) |
| P3 | TaskGraph 分组派生 + 文档形态单一化 | task 边模型 + 拓扑序分组（原子闭包分量）+ plan-parse crisp BLOCK + 字面 `## Task Groups` 段删除 + **双读面全量退役** + **全树 41 文档形迁移** | Done | Done | 落地交付记录：TaskGraph 边模型全落（`class TaskGraph`：构造按 `### Task N:` 升序 · validate() GraphVerdict 负例 crisp BLOCK 全套——缺失/自环/越界/矛盾/重复/环 · groups() 原子闭包分量 = 组 · 组序 = 分量拓扑序）· `dependsOn?`/`atomicWith?` 读写面激活 · effectiveGroups 切图派生（retired taskGroups plan record 弃用）· **双读面 runtime 全删**（Form B 锚 / 六段 legacy / Section-1 / `- **Do**:` / `## Task Groups` / taskBlock / extractProseConstraints / taskGroupsFromPlan）· **全树 41 文档单形态绿**（20 六段 specs + 17 Do 形 plans + 4 散文期 plans 内容保真转录 · 编号/验收/约束逐字机 pin · 树套件 47 校验文件零排除绿 + one-off 容忍 · 迁移队列闭合）· 消费面同步（cdd-plan + cdd-dev SKILL 边声明撰作面 · shipped 描述面零程序历史 grep pin）+ changesets（cdd-engine major / kairos patch）——engine suite 全绿 · validate ALL PASS · typecheck/biome 绿 | P1 ->(hard) |
| P3.1 | 统一 StructureRule 引擎 + 登记叶完备 + overall 结构秩 | 统一引擎落地（F9）：三类型结构判定规则数据化 + 单解释器（docContractValidate 单调用 · 树套件消费同一引擎 · checks/walks 手写遍历归零）· plan 边字段 mandatory（`- **DependsOn**:`/`- **AtomicWith**:` 每任务块必带 · `none`/空 显式值 · 缺行 = plan validate BLOCK 第六类）· design body `designItems` 叶（`#### N.M` 标题 · 机器解析计数 · 空壳即删 · 唯一 `### Acceptance criteria` 契约不变）· overall charter facets `###` + 决策组叶 `####`（OverallDocBody）· 全树迁移（22 plans 边行 · 21 specs 结构秩 · 4 overalls charter）· 引用 lint WARN + plan-review 必答兜底 | [Pending] | [Pending] | 每 plan 任务块两边行存在（空/`none` 合法）· 缺行 = plan validate BLOCK；design spec `####` items 计数 + 标题逐字 + 空体零容忍（tree-migration 结构秩 pin 补 P3 盲区）；全树 0 加粗伪标题残留；全树 4 overalls charter facets `###` + 决策组 `####` 零残留；StructureRule 统一引擎落地（三类型规则集数据化 · 手写遍历/测试 re-walk 归零 · 树套件消费同一引擎）；`cdd implement`/`cdd review` pre-flight 覆盖新检查；引用 lint WARN 有断言；消费面同步（三 schema description + cdd-plan/cdd-dev SKILL 边强制 + designItems/charter 指导）+ changesets + validate ALL PASS | P3 ->(hard) |
| P4 | `cdd-doc-review` 一产化 | URC + 三纪律组合 skill（kairos 第 9 席） | [Pending] | [Pending] | SKILL.md 方法论完整（URC 三/三轴 + writing-plans 自检 + verification + grilling 组合）；skill-anatomy registry 注册 + 目录扫描守卫绿；README/测试/changeset 随 | P2 ->(hard) |
| P5 | DispatchContract + DispatchPacket | harness-contract dispatch 域重构 + ref 统一 + 正文类型化 | [Pending] | [Pending] | skills 有序链渲染（多 `/xxxx`/`/skill:` form）· capabilities per-harness 声明（claude=parallel 实测子代理面）· refKind 四型推导（commit-set ledger / commit-range / doc-revision 双层收敛 / graph-node）· 三处「并行禁」禁文删除 · DispatchPacket 正文 = InstructionUnit + schema 引用 + BodyView + convergence 数据（原尺寸 -30~50% 断言）· engine suite 全绿 | P1 ->(hard) · P3 ->(hard) · P4 ->(hard) |
| P6 | overall 宪法/档案分层 | Constitution + archive 分层 + Standing rules「空壳死代码即删」常态化 | [Pending] | [Pending] | 新整体以宪法/档案双层落地（issue/history 结构化 record 零 prose 格）；backfill-as-version 机械化（archive doc-revision ref）；Standing rules 含「空壳、死代码即删」；版本行 lineage 散文消解（修订记录结构化）；历史正文零 retro-rename | P1 ->(hard) |
| P7 | Engine token 翻译能力 | doc/shape token English-primary + 翻译层 + 词面 locale 支持 | [Pending] | [Pending] | 机器可识别标记全 English-primary（新骨架 schema / DOC_TOKENS description 零中英混杂，grep 断言含注释）；中文别名 ↔ 英文规范型双向解析（legacy 中文标记 doc 仍可 parse/validate）；词表 / 胶囊输出 locale-normalized 消费（如有）；既有中文标记文档树零改动（双读保持）；validate 全绿 | P2 ->(hard) · P5 ->(hard) |

## Dependency graph (ASCII)

```
P1 -> P2   (hard: 文档瘦身依赖 schema 工厂/DocType 先落)
P1 -> P3   (hard: TaskGraph 是 P1 DocType 的 PlanDocType body 形态)
P1 -> P5   (hard: DispatchContract refKind 四型 / doc-revision 双层收敛继承 P1 DocType 的 refKind 面)
P1 -> P6   (hard: archive doc-revision ref 依赖 DocType refKind 面)
P2 -> P4   (hard: cdd-doc-review 依赖 P2 的 acceptance claim 形态与文档瘦身面)
P3 -> P5   (hard: DispatchContract graph-node ref 依赖 TaskGraph)
P3 -> P3.1 (hard: 边完备性 + design 结构面建立在 P3 单形态 + TaskGraph 之上)
P4 -> P5   (hard: dispatch skills[] 引用 cdd-doc-review 需 skill 在位)
P2 -> P7   (hard: token 翻译层改造对象 = P2 重派生的 doc token 面)
P5 -> P7   (hard: 引擎输出词面 locale 依赖 P5 dispatch 词面契约)
```

Legend:
- `->` = hard block（依赖前置 phase 发布后方可启动）
- `-> (soft)` = suggestion only（本图无边）

执行序：P1 →（P2 ‖ P3 ‖ P6 可按依赖并行注册但执行按注册序串行）→ P3.1 → P4 → P5 → P7；本整体执行线押后（pi-harness P5 结束）+ 按注册序串行。

## Boundary rules

- 每 phase 完整 brainstorm → plan → dev，shipped 后依赖方才启动；serial-phase 规则含：注册 phase 的 hard-dependency 前驱 Design spec ≠ Done → BLOCKED
- 需求变更在 phase 中发生时，**先回填本 overall**（version bump + change-history 行 + 同步受影响 phase 的 scope/acceptance/dependency），再继续实现
- **开线 GATE**：本整体任一 phase 启动前，pi-harness P5 必须先 closeout（用户 2026-10-02 拍板「等 P5 结束以后，再开线」）——这是程序级时序约束，Phase inventory P1 的启动即该 GATE 生效点
- 现有已 shipped 文档的迁移 = **全量形迁移**（P3 落地：41 文档内容保真转录至规范形；形态迁移只动容器、内容逐字——任务编号/验收/约束原文逐字保留 + 机 pin 无损断言，绝不以本程序字段 retro-edit 历史正文）

## Maintenance

- 五表随每 phase 回填：Issue inventory（新增 anchor 注册）、Phase inventory（design/plan 列状态 + dep 边）、Dependency graph（节点变化同步）、Change history（版本行逐 phase 追加）、File paths（新 artifact 行登记；Archive 精确命名归 P6 定义，届时按此回填——File paths Archive 行承诺通道进入回填机制）
- Charter only——无任务清单；phase 细节归 phase spec；策略转向（如上游 skill 目录演进改变拟合判定、harness capability 实测变化）立即回填本 overall 后再议实现
- 本整体自身 = 方法论层；实施期若发现 Documentation plane 的更深债（除 E1–E7 经验债外）同样回填追加

## Change history

| Version | date | summary | author |
|---|---|---|---|
| v1.0 | 2026-10-02 | 程序 charter：文档架构方法论 v2——DocType 抽象（五域）/ TaskGraph 分组 / DispatchContract+DispatchPacket / overall 宪法+档案分层 / `cdd-doc-review` 一产化 · 破坏性授权 + **空壳死代码即删常设规则** + 尽量复用上游规则 + 先落留存 P5 后开线 GATE · 全量决策留存（M1–M4 / F1–F5 / R1–R5 / B1–B5 / 经验债 P1–P7 / 上游先例背书）· Issue/Phase inventory ×6 + 依赖图 | [human] · Claude Opus 5 (1M context)（kairos:cdd-design 元层 grilling） |
| v1.1 | 2026-10-02 | cdd spec-review-1 七 finding 落地（blocker 0）：Goal 量级校正（4 overall / 18 design / 19 plan / pi-harness 单系 28 版本）· E 组改号避双义 · R4 commit-range 补行 + M4a 处置 · I10 悬空引用按语义改写消解 · File paths 补 archive · 依赖图补 P1→P5 · **M1 恢复判定**（fix-agent 误 revert → 设计属主恢复 `mattpocock-skills:implement` + 实存证据 + supersede tdd 登记） | [human] · Claude |
| v1.2 | 2026-10-04 | **Q6 裁决登记**（doc-architecture-v2 P1 起写期 grilling）：'doc-structure schemas' 语义收窄 = 三类书面 artifact 形状（phase-spec/plan/overall）入 schema 工厂；add-phase-protocol/skill-anatomy 非 doc 结构留手写 JSON + schema.test 校验（对齐 A1 三实例；P2/P6 依赖此语义）——P1 Issue-inventory 行附记同步 | [human] · Claude Opus 5（kairos:cdd-design → grilling） |
| v1.3 | 2026-10-05 | **P1 完成回填**（doc-architecture-v2 P2 会话开线同步）：P1 Implementation plan 列回填：Pending → Done（plan [2026-10-02-doc-architecture-v2-p1.md v1.1](docs/kairos/plans/2026-10-02-doc-architecture-v2-p1.md)）· P1 Design spec 列回填 `Done` 完成标记（design v1.1 已批形态）· Acceptance 列落实际交付记录 · Issue inventory P1 附记 · P1 plan 文件名对齐 program slug 惯例（补 `-p1` 后缀）——serial-phase 门槛（P1 Design spec ≠ Done 读法）经回填消解，P2 grilling 干净开线 | [human] · Claude Opus 5（kairos:cdd-design） |
| v1.4 | 2026-10-05 | **P7 注册**（doc-architecture-v2 P2 实现会话 mid-flight backfill，用户 2026-10-05 拍板）：新增 Issue/Phase inventory P7「engine token 翻译能力」——doc 结构 token 面（DOC_TOKENS/shape 标记 · Form B 锚名）English-primary 化 + 翻译层（中文别名 ↔ 英文规范型双向识别，legacy 中文标记保持可解析）+ 词表/胶囊输出词面 locale 支持；依赖图补 P2→P7 · P5→P7（hard）+ 执行序 P5 后串行 | [human] · Claude Opus 5（kairos:cdd-design） |
| v1.5 | 2026-10-05 | **P2 计划完成回填**（engine CLOSEOUT：branch-review 预条件）：P2 Implementation plan 列回填：Pending → Done（plan [2026-10-02-doc-architecture-v2-p2.md v1.1](docs/kairos/plans/2026-10-02-doc-architecture-v2-p2.md)）· P2 Design spec 列回填 Done 完成标记（design v1.1 已批，spec-review 全落地）· Acceptance 列落交付记录 · Issue inventory P2 附记 —— P2 cdd 链 7/7 全闭环 | [human] · Claude Opus 5（kairos:cdd-design） |
| v1.6 | 2026-10-05 | **P3 范围扩大回填**（kairos:cdd-design grilling，用户 2026-10-05 零历史兼容裁决）：P3 Issue/Phase inventory 行扩域——TaskGraph 分组派生（组 = 原子闭包分量 · 组序 = 分量拓扑序）+ **双读面全量退役**（engine 文档形态单一化——Form B 锚 / 六段 / `- **Do**:` / `## Task Groups` / Section-1 / taskBlock / smoke-cdd legacy 派生面全删） + **全树 41 文档形迁移**（内容保真转录 + 机 pin 无损断言）；non-goal #2「渐进交割」→「P3 全量形迁移」；F1 决策留存补 P3 grilling 定案 | [human] · Claude Opus 5（kairos:cdd-design → grilling） |
| v1.7 | 2026-10-06 | **P3 计划完成回填**（engine CLOSEOUT：branch-review 预条件）：P3 Implementation plan 列回填：Pending → Done（plan [2026-10-02-doc-architecture-v2-p3.md v1.2](docs/kairos/plans/2026-10-02-doc-architecture-v2-p3.md)）· P3 Design spec 列回填 Done 完成标记（design [2026-10-02-doc-architecture-v2-p3-design.md v1.1](docs/kairos/specs/2026-10-02-doc-architecture-v2-p3-design.md)，spec-review 全落地）· Acceptance 列落交付记录 · Issue inventory P3 附记 —— P3 cdd 链 9/9 全闭环（含 P3 起写期常设 backfill：shipped 描述面零程序历史） | [human] · Claude Opus 5（kairos:cdd-dev → closeout backfill） |
| v1.8 | 2026-10-06 | **P3.1 注册**（doc-architecture-v2 P3 close 前 mid-flight backfill，用户 2026-10-06 拍板）：新增 Issue/Phase inventory P3.1「边声明完备 + design body 结构面 + lifecycle 预校验」——P3 shipped 暴露两盲区：① design body 结构秩被压平（`### 2.x` → `**2.x**` 加粗伪标题，机器不可见；design body = 最后一个无登记叶平面）② 边声明 silent default（缺行 = `[]` 全单例，机器无 oracle 拦「忘写」）；P3.1 = mandatory edges（每任务块必带 `- **DependsOn**:`/`- **AtomicWith**:` · `none` 显式 · 缺行 BLOCK）+ designItems 叶（`####` 秩 · 结构秩恢复 · 空壳即删）+ lifecycle pre-flight 补全 + 引用 lint WARN + tree-migration 结构秩 pin；依赖图补 P3 → P3.1（hard）+ 执行序 P3.1 入串行 | [human] · Claude Opus 5（kairos:cdd-dev → closeout 裁决） |
| v1.9 | 2026-10-06 | **P3.1 扩域定案**（cdd-design grilling）：P3.1 升为「统一 StructureRule 规则引擎 + 登记叶完备（plan 边 · designItems · charter facets）+ overall charter 结构秩」——新增 F6 决策留存（统一引擎：三类型规则数据化 + 单解释器 · checks/walks 归零 · 树套件消费同一引擎）+ F7（charter facets `###`/决策组 `####` 叶 · 全树 4 overalls 迁移 · OverallDocBody）；F1 补第六 failure class `missing-edge`；F3 补 designItems 叶；Issue/Phase inventory P3.1 行扩域；依赖图不变（P3 → P3.1 hard）· 执行序不变 | [human] · Claude Opus 5（kairos:cdd-design → grilling） |
