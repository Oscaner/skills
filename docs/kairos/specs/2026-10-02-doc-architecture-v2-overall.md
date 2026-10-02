# 文档架构方法论 v2（Doc Architecture v2）— Overall Spec

- **Version**: v1.0 · 2026-10-02
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
- 不重写已 shipped 内容——新模型以**新 schema 形态**落地，旧文档渐进迁移/新老交割（P3/P2 定义交割读写面）
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
| implement | `[mattpocock-skills:tdd]`（交付面；条件纪律 = 真行为变更才进链，经 B1 InstructionUnit `appliesTo` 表达，非恒常进链） | M1：spec/tickets→交付面，tdd 承载交付面（harness-contract `dispatch.implement` 既定槽，refs 域实测） |
| fix | `[superpowers:receiving-code-review, superpowers:verification-before-completion]` | M2：严谨验证 findings 拒盲从 → 提交前证据先行；harness 多 skill 原生态 |
| review.task/branch | `[mattpocock-skills:code-review]` | M3：并行双轴 capability-resolved；删 engine「单 agent 并行禁」（harness-contract:94,98 + template-contract axesGuide 三处禁文） |
| review.spec/plan | `[kairos:cdd-doc-review]` | M4b：URC（spec 三轴 / plan 三轴）+ writing-plans 自检准则 + verification evidence + grilling 追问——一产组合体内化，kairos 第 9 席 |

- 拟合规则 + dispatch.skills = 有序链（多 `/xxxx` token，`refs` 域逐 token 渲染，pi = `/skill:a /skill:b`）
- **M4a 处置**：M4a（review.spec/plan 映射候选线）随目录实测结论并入 M4b 一产化定案（唯一真 fit，见下）——M 组决策序号 M1–M4 连续、可审计
- **目录实测结论**：无单上游 skill 是「设计文档评审」；spec/plan review 的方法论 = 程序自有 URC + 三纪律组合——一产化是唯一真 fit（M4b）

**F 组（文档平面结构，提案）**：
- F1 TaskGraph 分组派生（`depends_on`/`atomic_with` → DAG → 拓扑序分组；字面 `## Task Groups` 段删除；plan-parse crisp BLOCK：无环 / union==task set / atomic 闭包）
- F2 overall 宪法/档案分层（Standing rules 规范化折叠；issue/history 迁 `*-archive.md` 结构化 record）
- F3 phase-spec 样板 schema 化（真骨架 = `## Design` + `### Acceptance criteria` + `## Constraints` 继承点；样板 → schema description + 条件元数据）
- F4 plan 约束继承 delta-only（宪法 auto-applies，per-plan 复述清零）
- F5 Task=数据（`{objective, files[], interface{consumes,produces}, steps[]{action,checkable}, acceptance[]}`）+ brief=数据渲染

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
| P1 | none | DocType 抽象 + schema 工厂：五域 DocType（shape/words/instructions/refKind/bodyView）· template-contract/lexicon/doc-structure schema 收编为 DocType 字段 · engine `documents/` per-type 手写分支 → DocType 实例方法（Criterion ②）· doc-structure schemas 以 schema 工厂原子化派生 |
| P2 | none | 文档平面瘦身：phase-spec 样板 schema 化（`## Design` + `### Acceptance criteria` 唯一 + `## Constraints` 继承点；增量警告/约束指针/偏差/下游注/评审记录 → schema description + 条件元数据）· plan Task=数据（task `{objective,files,interface,steps,acceptance}` + step checkable 类型约束 + brief 数据渲染）· plan 约束继承 delta-only（宪法 auto-applies，per-plan 复述清零） |
| P3 | none | TaskGraph 分组派生：task `depends_on`/`atomic_with` → DAG → 拓扑序分组（`## Task Groups` 字面段删除）· plan-parse crisp BLOCK（无环 / union==task set / atomic 闭包）· 「先清底再上闸」= 图性质非文字 |
| P4 | none | `cdd-doc-review` first-party skill（kairos 第 9 席）：URC（spec 三轴 / plan 三轴）+ writing-plans 自检准则（spec 覆盖/占位扫/类型一致）+ verification evidence + grilling 追问——组合体内化单 skill · skill-anatomy registry 注册 + 目录扫描守卫含新成员 + README/tests/changeset |
| P5 | none | DispatchContract + DispatchPacket：harness-contract `dispatch` 域重构（skills 有序链 + `capabilities` per-harness 子代理面 + `refKind` commit-set/commit-range/doc-revision/graph-node + bodyView）· ref 机制（R1 handoff ledger·R2 doc-revision 双层收敛·R3 一体）· DispatchPacket 正文（InstructionUnit 结构化 + return/evidence schema 引用 + BodyView 分型 + convergence 数据 + constraints 子集过滤）· 三处禁文删除（harness-contract:94,98 + template-contract axesGuide） |
| P6 | none | overall 宪法/档案分层：宪法本体（Goal/Standing rules 规范化折叠/Cross-cutting/Phase inventory/Dependency graph）+ `*-archive.md`（issue/history 结构化 record + doc-revision ref 机械化 backfill）· **「空壳、死代码即删」入 Standing rules 常态化** · 版本行 lineage 散文消解 |

## Phase inventory

| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |
|---|---|---|---|---|---|---|
| P1 | DocType 抽象 + schema 工厂 | 五域 DocType + doc-structure schema 工厂 + template-contract/lexicon 收编 + documents/ 分支收敛 | [Pending] | [Pending] | 三 doc type 以 DocType 实例落地；schema 工厂产出与现 schema 语义等价（validate 全绿）；documents/ per-type 手写分支归零（Criterion ② 类面无裸函数）；residue/lexicon guard 零回归 | 无（program 起点） |
| P2 | 文档平面瘦身 | phase-spec 样板 schema 化 + plan Task=数据 + 约束继承 delta-only | [Pending] | [Pending] | 新 phase-spec 骨架 = `## Design`+`### Acceptance criteria`+`## Constraints`；样板文字零 per-doc 残留（旧文档渐进迁移交割面定义）；plan Task 数据化后 brief = 数据渲染（零散文雕刻）；per-plan 宪法复述清零 | P1 ->(hard) |
| P3 | TaskGraph 分组派生 | task 边模型 + 拓扑序分组 + plan-parse 校验 + 字面段删除 | [Pending] | [Pending] | `depends_on`/`atomic_with` 声明 → 派生组与意图一致（含负例：无环断言、union==task set、原子闭包 crisp BLOCK 测试）；字面 `## Task Groups` 段零存在（新文档）；「先清底再上闸」拓扑性质测试钉 | P1 ->(hard) |
| P4 | `cdd-doc-review` 一产化 | URC + 三纪律组合 skill（kairos 第 9 席） | [Pending] | [Pending] | SKILL.md 方法论完整（URC 三/三轴 + writing-plans 自检 + verification + grilling 组合）；skill-anatomy registry 注册 + 目录扫描守卫绿；README/测试/changeset 随 | P2 ->(hard) |
| P5 | DispatchContract + DispatchPacket | harness-contract dispatch 域重构 + ref 统一 + 正文类型化 | [Pending] | [Pending] | skills 有序链渲染（多 `/xxxx`/`/skill:` form）· capabilities per-harness 声明（claude=parallel 实测子代理面）· refKind 四型推导（commit-set ledger / commit-range / doc-revision 双层收敛 / graph-node）· 三处「并行禁」禁文删除 · DispatchPacket 正文 = InstructionUnit + schema 引用 + BodyView + convergence 数据（原尺寸 -30~50% 断言）· engine suite 全绿 | P1 ->(hard) · P3 ->(hard) · P4 ->(hard) |
| P6 | overall 宪法/档案分层 | Constitution + archive 分层 + Standing rules「空壳死代码即删」常态化 | [Pending] | [Pending] | 新整体以宪法/档案双层落地（issue/history 结构化 record 零 prose 格）；backfill-as-version 机械化（archive doc-revision ref）；Standing rules 含「空壳、死代码即删」；版本行 lineage 散文消解（修订记录结构化）；历史正文零 retro-rename | P1 ->(hard) |

## Dependency graph (ASCII)

```
P1 -> P2   (hard: 文档瘦身依赖 schema 工厂/DocType 先落)
P1 -> P3   (hard: TaskGraph 是 P1 DocType 的 PlanDocType body 形态)
P1 -> P5   (hard: DispatchContract refKind 四型 / doc-revision 双层收敛继承 P1 DocType 的 refKind 面)
P1 -> P6   (hard: archive doc-revision ref 依赖 DocType refKind 面)
P2 -> P4   (hard: cdd-doc-review 依赖 P2 的 acceptance claim 形态与文档瘦身面)
P3 -> P5   (hard: DispatchContract graph-node ref 依赖 TaskGraph)
P4 -> P5   (hard: dispatch skills[] 引用 cdd-doc-review 需 skill 在位)
```

Legend:
- `->` = hard block（依赖前置 phase 发布后方可启动）
- `-> (soft)` = suggestion only（本图无边）

执行序：P1 →（P2 ‖ P3 ‖ P6 可按依赖并行注册但执行按注册序串行）→ P4 → P5；本整体执行线押后（pi-harness P5 结束）+ 按注册序串行。

## Boundary rules

- 每 phase 完整 brainstorm → plan → dev，shipped 后依赖方才启动；serial-phase 规则含：注册 phase 的 hard-dependency 前驱 Design spec ≠ Done → BLOCKED
- 需求变更在 phase 中发生时，**先回填本 overall**（version bump + change-history 行 + 同步受影响 phase 的 scope/acceptance/dependency），再继续实现
- **开线 GATE**：本整体任一 phase 启动前，pi-harness P5 必须先 closeout（用户 2026-10-02 拍板「等 P5 结束以后，再开线」）——这是程序级时序约束，Phase inventory P1 的启动即该 GATE 生效点
- 现有已 shipped 文档的迁移 = 渐进交割（P2/P3 定义新老读写面），绝不以本程序字段 retro-edit 历史正文

## Maintenance

- 四表随每 phase 回填：Issue inventory（新增 anchor 注册）、Phase inventory（design/plan 列状态 + dep 边）、Dependency graph（节点变化同步）、Change history（版本行逐 phase 追加）
- Charter only——无任务清单；phase 细节归 phase spec；策略转向（如上游 skill 目录演进改变拟合判定、harness capability 实测变化）立即回填本 overall 后再议实现
- 本整体自身 = 方法论层；实施期若发现 Documentation plane 的更深债（除 E1–E7 经验债外）同样回填追加

## Change history

| Version | date | summary | author |
|---|---|---|---|
| v1.0 | 2026-10-02 | 程序 charter：文档架构方法论 v2——DocType 抽象（五域）/ TaskGraph 分组 / DispatchContract+DispatchPacket / overall 宪法+档案分层 / `cdd-doc-review` 一产化 · 破坏性授权 + **空壳死代码即删常设规则** + 尽量复用上游规则 + 先落留存 P5 后开线 GATE · 全量决策留存（M1–M4 / F1–F5 / R1–R5 / B1–B5 / 经验债 E1–E7 / 上游先例背书）· Issue/Phase inventory ×6 + 依赖图 | [human] · Claude Opus 5 (1M context)（kairos:cdd-design 元层 grilling） |
