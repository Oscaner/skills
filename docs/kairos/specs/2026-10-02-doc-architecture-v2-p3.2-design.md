# 文档架构方法论 v2 — P3.2 Design Spec v1.5（全系统从零重建 · 判定单家 · 工作流归一）

- **Version**: **v1.19** · 2026-10-08（**wave 全链原子模型（§3.9 · T26）**——用户 2026-10-08 全面 review 拍板「派发的是 wave · 底层全部错配了 wave 和 task」：wave = 全链原子单元（一帧一波 · 一波一提交 · wave 键载体/账本/评审/round context/schema）· task 降级为波内分区 · **T26** 承接（DependsOn 24 · 执行序先于 W11 重派 = 显式 deviation）· round context 变名 `SCOPE`→`WAVE` · `INPUT_TASK`→`INPUT_WAVE_BRIEF` · OUTPUT `tasks-{wave}-*.json` · prompt 一波一提交 + 保留字段零写入 · schema reserved 列表 + 读回门具名违例——plan v1.22 · overall v1.37 随）；前置 v1.18 · 2026-10-08（**三动词统一波门 + #taskGate 退役**（用户 2026-10-08 六前提复核拍板「自行拆组须 pre-flight 硬门拦截」）：task-face 派发前置 = **单张波次门 `WaveGate.vet(requested, verb)`**（session/wave.ts · OOP 单方法）——`open = frontier(closedTasks())` 唯一读面 · 判定三式（拆组/子集 → BLOCK + 整组提示 · 相位≠动词 → BLOCK + 先跑对应相位 · 开放波内相位异构 → 具名 ledger 异常 BLOCK + 相位 map）· **implement/review/fix 三动词同门**（半波审查/半波 fix 结构性拦截）· **`#taskGate` 退役**（混合组=异构相位 · 过期重跑=相位错位 · 闭合组重入=requested≠open 被吸收）· BLOCK 话术入词表——§3.8 随 · plan v1.21 · overall v1.36 随）；前置 v1.17 · 2026-10-08（**闭合单一裁决 + 闭合格单一读面 + 边条件恢复**（用户 2026-10-08 整体 review 拍板）：**§3.8 扩展（A 簇 · 引擎）**——① **`closedTasks()` 闭合格单一读面**：pre-flight 门与 plan-graph board 弃「任何 ledger 行即 done」行读（v1.19 历史合并组妥协）→ 单一读面与生命周期 `#markTerminal` 同源（C5 route ∈ 闭合侧才闭合 · implement 行永不闭合 · 合并组行自然化 · board 波内 ✔/▶ 混色修）② **`close()` 统一终态**：循环唯一裁决点 = review（fix 副作用 · 重审看源 blocker · #278 无强制重审保持）· 所有闭合点共用 `close(state) = readyBatch 空 ? next:done : next:next-wave` · `none` 词面退役 · `done` 新增 ③ **无 next = 硬错误**（现场派发无 next: 行且非 BLOCKED/TIMEOUT → CDD_BLOCKED · exit 1）④ **group→wave 词清扫**（route kind / 节点名 / `effectiveGroups` / ledger 行键——「组 = 波」）· **§4.2 反转（B 簇 · 技能/契约）**——⑤ digraph **边条件恢复**（边零状态标签作废）：决策边显式条件 · NEXT-LOOP 自环 `until next=done` · 出边 `next=done→terminal` · `no next→BLOCKED` · branch-review 独立 next-loop 闭环 ⑥ 契约反转：`labelFreeRule` → `edgeConditionRule` + **词表钉**（边条件取值出自引擎词表——静态分支真相与 next: 运行时实例共享一词表）——plan v1.20 · overall v1.35 随）；前置 v1.16 · 2026-10-08（**校验域归一化**（用户 2026-10-08 拍板「所有校验基于归一化结果」）：validate 域 = 归一化图（括号截断 · 去重 · 传递约简）· duplicate 类退役 · 四类（missing-edge/missing-id/self-loop/cycle）归一面上评——plan v1.19 · overall v1.33 随）；前置 v1.15 · 2026-10-08（**wave-board 展示定案**（用户 2026-10-08 拍板「修法 hack」）：plan-graph 展示 = 引擎自持 wave-board（确定性 wave 行 · 零第三方 · wave chain 冗余删除）· beautiful-mermaid 退役（§3.8 渲染决策作废——不控布局·全图规模丢 label·正则补丁 = 技术债）——plan v1.18 · overall v1.32 随）；前置 v1.14 · 2026-10-08（**plan-graph wave 标签修正**——渲染器不保证 wave 排序 · 节点盒内置 `T17 · W13` · wave 链行权威——plan v1.17 · overall v1.31 随）；前置 v1.13 · 2026-10-08（**直依赖 = 引擎约简 · 消费面透传**（用户 2026-10-08 拍板「direct-only 是引擎问题——引擎消费 graph 拿 reduction」）：作者可自由声明完整前置集（冗余边零危害）· **引擎消费面一律 transitive-reduction 后的边**（派发/波次/读面/plan-graph——`#depsOf` 即约简 · validate 仍读原始声明 —— 闭包不变 = wave 不变）· **所有校验基于归一化结果（v1.16）**——duplicate 由去重归一消（作者字面零裁决）· 图消费/校验同走归一化面 · plan-graph 显示 TB 层级 = 最长路径 = wave index（自然按 wave 排序 · 弃子图带——ELK 箱并排破坏波序）· lint 传递冗余 advisory（只警不拦）——plan v1.16 · overall v1.30 随）；前置 v1.12 · 2026-10-08（**plan-graph 渲染定案——引入 `beautiful-mermaid`**（用户 2026-10-08 拍板「自己造轮子也是技术债·直接引入第三方」）：终端盒图 DAG = 第三方 `beautiful-mermaid`（elkjs ELK 布局 · mermaid flowchart → ASCII）· 引擎 emit flowchart + renderMermaidASCII 一次渲染——plan v1.15 · overall v1.29 随）；前置 v1.11 · 2026-10-08（**波次读面 `plan-graph`**（用户 2026-10-08 拍板「知情权」——编排器只认 next 但需全图知情）：`cdd schema get plan-graph --plan <path>` 只读分支（task graph 边 · 派生 wave 链 · ledger 进度）· 同一 `TaskGraph.report(done)` 投影两显示（schema 读面 + pre-flight 门输出）· 进度 = ledger 闭环判定复用不复制 · 零新子命令——spec §3.8 随 · plan v1.14 · overall v1.28 随）；前置 v1.10 · 2026-10-08（**波次 pre-flight + 严格派发机械化**（用户 2026-10-08 拍板「review plan 加 wave pre-flight 前置校验」）：`DependsOn` 值域契约（首个 `(` 前裸数字列表 · 行尾注释零参与）· `TaskGraph.validate()` 接线三处门（review plan 前置 · implement 派发前置 · `--tasks` 拆派生波 → BLOCK）· 派生波表随门输出（零新子命令）——§3.8 随 · plan v1.13 · overall v1.27 随）；前置 v1.9 · 2026-10-08（**严格派生波次 + P4–P7 承接映射闭环**（用户 2026-10-08 拍板「严格派生波次·零手工拆组」+「P4–P7 吸收漏映射→系统性 review」）：派发 = `effectiveGroups` 唯一（零手工拆组 · 历史拆组 W5/W8 记偏差）· **§6.4 Done 宣言作废**（P4–P7 承接 = 映射 + 状态以 plan 任务为准——补承接映射表）· P5 漏映射三件（refKind 四型 · skills 有序链 · capabilities per-harness）落 plan **T25** · plan v1.12 · overall v1.26 随）；前置 v1.8 · 2026-10-08（**T15 收口 review——分派 prompt 面六项修正**（用户 2026-10-08 六前提复盘 · T15 真实探针后）：FIX_BASE 锚=评审 head（`#fixedPoint` 读 commits.head · fallback base）· task review `INPUT_RANGE`=TASK_BASE..HEAD（implement 载体派生）· review per-type 固定前缀（criteria/lens 折入 · spec/plan lens 补）· work 公共尾 shared（evidence+commits · report 行统一）· 孤儿键删（fix `INPUT_RULES` · `INPUT_PLAN` marker）· evidence 命名家族字首化——§3.7 随 · plan v1.11 随）；前置 v1.7 · 2026-10-08（**handoff 契约面 rewrite——内容落盘 · schema 注入 · 散文归零**——用户 2026-10-08 拍板（kill T15 implement 停摆析因）：① **child 产出一律落盘**（handoff JSON 写文件，stdout 只回三行指针——RETURN_JSON 单通道结构不稳即任务白干 · review 家族统一 RETURN_STDOUT_BLOCK · RETURN_JSON 退役 · DOCS_FIX 同删）· ② **结构约束 = 注入 JSON schema**（每 mode 注入可写子集 ```json fence，仿旧树 C4-2 writableSchemaSubset 剥 `$schema` + 引擎确定面 · **一声明两投影** = prompt 注入文本 + 引擎读回校验，typed 校验器于 session 平面回归，零 JSON 文件）· ③ **test-evidence 一并 schema 化 + 引擎真读回**（第二个散文虚设补钉——prompt 曾虚称「引擎读回」但引擎零代码读它）· ④ **handoff 散文完全清理**（`## Handoff` 段 + HANDOFF_WRITE_GATE 删净）——plan v1.9 随）；前置 v1.6 · 2026-10-08（**T22 宪法化单文件裁定 + dispatch 调用面纪律 + child prompt 分派表**——用户 2026-10-08 拍板三连：①「不需要 overall-archive.md——overall 变两份文件增加消费者心智负担」→ **P6 宪法化收敛为单文件**（overall 保持一份文件：Standing rules 成典 · 版本行 lineage 散文消解 → 结构化修订记录 · change-history 巨型 cell → 结构化 record 均在单文件内 · 零新增 artifact · declare.ts 登记行不简化——Issue inventory/Change history 保持 required · overall v1.24 随）· ②**dispatch 生产调用面纪律**（T15 cutover 首验暴露——新引擎 child 调用缺 prompt：slash-ref 独立位置参数被 claude 吞、FakeSync 桩断言与真实 harness 语义不符不失守→ 教训 = **dispatch 调用面须真实探针验证，stub 断言+真实语义契约双重门槛** · HOSTS 加 `promptForm` 数据列声明 prompt 位置语义）· ③**child prompt 内容重写**（mode 分派表结构：每 mode 固定前缀字节稳定 + per-mode round context 精简子集 + 动态键全在尾部 round context——前缀缓存友好 · 参数规整命名 = 角色前缀 + 语义核心：INPUT_ 读入物 / OUTPUT_ 写出物 / WORKSPACE_ 环境 / FIX_ 锚 / 主格身份·作用域——child 一眼分「读什么/写什么/在哪」）——plan v1.8 随）；前置 v1.5 · 2026-10-08（**反依赖门放开 backfill——边违约六类收五类 + 环活门**——用户 2026-10-08 拍板「放开『任务只能依赖更小编号』约束，Wave 编排完全基于 DependsOn 推导」：§3.1 contradiction 边违约类退役 · **前向引用合法**（`- **DependsOn**:` 可指向任意现存任务 id）· **cycle 类为活门**（环 = 具名 plan 违约 · doc-contract 早拦/评审派发 BLOCK）· **编号降级为 ID + 波内升序 tiebreak** · referenceLint 新增**编号/拓扑序 advisory WARN**（只警不拦 · 作者「编号 ≈ 阅读序」引导保留）· 现 plan 全低编号边 = 纯 widening 零迁移——plan v1.7 随）；前置 v1.4 · 2026-10-07（前置 v1.3 = P7 提前承接 backfill——翻译系统全量核心入 §1.3 · CLI 命令面 `base-branch`→`base` · capsule 机面英文恒定 · 渲染器归位 render；**v1.4 = P4/P5/P6/P7 全吸收 + 数据面归位 backfill**——用户 2026-10-07 拍板「config-next 完成以后删除 config」升华：**数据面归位**（三稳态 JSON → typed 平面 infra/runtime · face/host · render/templates · P4 review 准则/P5 M1+禁文 承接净入 §6.4 · skill-anatomy 归守卫 T14 · `config/` 整目录随 cutover 删除零重建 · 新树零 JSON/零 config/ 路径）· **P6 宪法化承接**（宪法/档案双层 · 版本行散文消解 · Standing rules 成典 · 全树 4 overalls）入 §6.5——plan v1.4 · overall v1.23 随））
- **Status**: Draft
- **Author**: [human] · Claude Opus 5（kairos:cdd-phase · 决策源 = kairos:cdd-design grilling 收敛 + 用户 2026-10-07 greenfield 拍板）
- **Parent program**: [doc-architecture-v2-overall.md v1.25](docs/kairos/specs/2026-10-02-doc-architecture-v2-overall.md)
- **Depends on**: P3.1（Done · [p3.1-design v1.10](docs/kairos/specs/2026-10-02-doc-architecture-v2-p3.1-design.md) · [p3.1-plan v1.11](docs/kairos/plans/2026-10-02-doc-architecture-v2-p3.1.md) —— serial-phase GATE 满足，P3.2 可开线）

## Design

用户 2026-10-07 拍板：**可完全不用在意兼容现有代码；可在新目录从零写、随后删除现有代码；方法论/体系已清晰，零老版本兼容义务，只要求最佳实践**。P3.2 从「引擎剥壳 + 五链重写」升为**全系统从零重建**：以既定架构（三大职责 + 两服务 = 5 平面拓扑 + 单一数据真相 + next: 单环路）为目标架构，在并行新平面建齐 → 入口切换 → 删除旧树 → validate 全绿。绿色构建不背负旧补丁层、旧目录形状、旧技能重复体。

### 1. 数据面：元素登记表 = 唯一声明源

#### 1.1 三 doc 类型登记表

每 doc 类型（overall / plan / phase-spec）新建 typed **元素登记表**（element registry）：平铺声明数据，每个元素一条（锚 token · presence · value pattern · ref kind · 归属面）。登记表 = 规则判定数据 + 派生源单一真相；~955 行 shape 散文不继承（新树直接以声明数据起建），五表达面（shape/schema/slices/reference/tokens）全部成为登记表投影，schema 派生字节 pin 从新树首版即钉。

#### 1.2 词汇单源

doc 结构词（DOC_TOKENS 面）+ 胶囊词（`status`/`next:`/`CDD_BLOCKED:` 站）+ 守卫词（residue/escape/gate ban 词）并入**单一词汇表**（一词表一派生链），终结 lexicon 五家（words.ts → contract-lexicon.json → schema shape → word-table.ts accessor → guard-lexicon.json）的分散面。词表 English-primary，词汇面稳态（此非兼容义务，而是消费词面本来就是方法论机器面）。

#### 1.3 翻译层（P7 提前承接 · 用户 2026-10-07「langs 升级为翻译系统，P7 提前」）

单词表加 **locale 面**（每条词挂 `{ en: 规范型, zh?: 中文别名 }`——doc 结构锚 · capsule 站词 · 守卫 ban 词 · issue body 段标签同一张表）+ 单一**双向翻译层 `Translator`**（词表驱动 · 零裸函数 · 零 switch 分发）：`normalize(输入) → 规范 token`（中文别名 ↔ 英文规范型双向识别 · doc parse/判定消费）· `localize(token, locale) → 输出词`（人类可读渲染面——issue body/brief/模板——locale-normalized 消费）。**`langs` 投影派生**：`["en","zh"]` 硬编码归零，语言键集 = 词表 locale 键集投影，校验 = 投影包含。

- **P7 原「doc 结构 token English-primary 化」两半处理**：转换半（旧中文结构标记→英文）随 greenfield 旧树删除天然消解（新树首版锚即英文，零转换工作量）；识别半（中文别名↔英文规范型）由翻译层承接。**「legacy 中文标记保持可解析」随旧树删除消解**——双读/兼容层不进新树。
- **capsule 机器面英文恒定**：`status`/`next:`/`CDD_BLOCKED:` 是状态机消费的 token 非人类文本——不 locale 化；locale 面只服务人类可读面（issue body/brief/模板）。
- **渲染器归位**：`IssueBodyRenderer` 从 face/cli（组合根）移出 → **render/ 面**；`langs` 语言键 = 词表 locale 投影（零 `["en","zh"]` 硬编码）；段标签数据表驱动。

### 2. 判定面：单一解释器 + 上下文缝不变式

#### 2.1 解释器为唯一判定器 + 策略类族（零裸函数）

新解释器 = 全部结构判定唯一入口（docContractValidate 单调用）。判定多态以**不变式策略类族**落地（`abstract class Invariant { evaluate(ctx): Finding[] }`；presence/uniqueness/domain/crosslink/order/continuity/residue/hollow/selfBounded + **file-existence / sibling-scan / cross-doc-chain / section-scoped-domain** 各成一类），`Contract.validate()` 是**协调器**——按登记表组配策略集运行，无手写 switch-case 判定分发。**零裸函数**：行为/判定/派生全为类成员，模块级导出仅类型/常量数据/类/组合根（旧 `runStructureRules` 函数解释器 + 游离 extract/compare helper 不复现）。上下文缝四不变式吸收旧 doctype 类上 ~485 行判定（fourTableAudit 280 · deviations 65 · Class-A/B 跨文档链 105 · effectiveGroups 边门 35 —— 四分量合计 485）。

#### 2.2 doctype 类瘦身为 parse+投影

overall/plan/phase-spec 的 DocType 类只留：parse（四表/任务块/骨架抽取）+ 派生投影（登记表派生链消费点）+ 跨文档链根（Class-A/B 解析留给上下文缝规则）。类上零判定方法、零手写结构断言。

#### 2.3 reference lint 独立面

reference 词汇随一声明派生；`referenceLint` 作为独立 WARN-only lint pass（非判决定义的一部分），在 dispatch 门面执行。`InvariantVerdict` 双通道 / `declared` 缓冲 / `CompiledSurface` 等旧壳机制不继承，greenfield 无此概念。

### 3. 编排面：TaskGraph + frontier + next 单点

#### 3.1 TaskGraph + 编排状态机

TaskGraph（**边违约五类** validate：missing-edge / duplicate / missing-id / self-loop / **cycle —— 反依赖门取消（v1.5）：前向引用合法，`- **DependsOn**:` 可指向任意现存任务 id** · 编号降级为 **ID + 波内升序 tiebreak** + `batches()` 波次）为执行序单家——边判定唯一判断「是否 DAG」：cycle 类为活门（环 = 具名 plan 违约 · doc-contract 早拦/评审派发 BLOCK）；`frontier(done)` 动态面 + `ExecutionState` 查询面（`doneTasks(): Set<number>` / `readyBatch()` 为 TaskGraph/ProgressLedger 方法，不新增独立类）。边判定唯一家在 TaskGraph，doc-contract gate parse 建图早拦、dispatch 复用同一实例；referenceLint 侧**编号/拓扑序 advisory WARN**（编号未随拓扑序仅建议重排以利阅读——只警不拦，作者「编号 ≈ 阅读序」引导保留）。

#### 3.2 NextStepRouter 单点

`next:` 生成收敛为 `NextStepRouter` 单点（C5 决策表）。语义钉死：review 零 findings → `next: none | next-group` · fix 面 blocker>0 → `next: <review>`（新 ref）· warn/nit → `next: none`（闭合 · exit 0 · 无 APPROVED 强制重审）· BLOCKED/TIMEOUT 无 next 行（`CDD_BLOCKED:` 拥有）。胶囊单面（`status · blocker · handoff · next:`）稳态。

#### 3.3 dispatch 三 lifecycle 合一

task/branch/docs 三个 near-同构 lifecycle（旧 3.6k 行）收敛为**参数化单 lifecycle**（目标类型 task|branch|spec|plan 数据表驱动：review/fix/implement 流程同构，差异 = 审计目标/产物面/next 语义参数）。CLI 子命令面（implement / review / fix / schema / issue / base——`base set|get` 承 `base-branch set|get`，用户 2026-10-07 拍板收敛）保持。

#### 3.4 dispatch child 调用面（v1.6 · T15 cutover 首验纪律）

新引擎 child 派发（HarnessDispatch → 宿主 harness CLI）的调用面纪律，T15 cutover 首次生产暴露（child 缺 prompt → 越轨）后钉死：

- **prompt 位置语义数据化**：`HOSTS` 每 host 行声明 `promptForm`（`ref-prefixed` | `plain`）——child 调用参数组装（skill-ref 如何进入 prompt）从代码假设上升为数据契约；测试断言钉数据面，真实 harness 探针验证行为（stub 断言 + 真实探针**双门槛**）
- **child prompt 单位置参数**：harness CLI 消费第一个位置参数整体为 prompt（claude `-p` 语义）；skill-ref（`/kairos:cdd-*` · `/mattpocock-skills:*`）以前缀形式并入 prompt 首行——**独立 ref 位置参数会被 claude 吞掉后续参数**（T15 实测）
- **真实探针门槛**：任何 harness 调用面改动，除 stub 断言外须以真实 CLI 探针验证 prompt/ref 到达 child（`FakeSync` 桩断言与真实 harness 语义不符不构成关门——T13「新树测试全绿」因此曾是假阳）
- **统一组装单点**：`#childPrompt(ref, prompt)` 收敛「ref 前缀 + 单参数」组装，零散 argv 拼装不入 it

#### 3.5 child prompt 内容结构（v1.6 · mode 分派表 + 前缀缓存友好）

dispatch prompt 从「全 mode 说明书 + 动态区」重写为 **mode 分派表**（消费者心智负担 · 前缀缓存）：

- **固定前缀逐 mode 字节稳定**：mode 头 + Instructions + 该 mode 专属节 + Discipline clauses + Return——同一 mode 历次 dispatch 前缀逐字节一致（**前缀缓存按 mode 分组共享**）
- **可变参数全在尾部 round context**：per-dispatch 值（BRIEF/FINDINGS/REVIEW_RANGE…）全部收进尾部唯一动态区；round context **per-mode 精简子集**（只列该 mode 消费的键，空值键不发）
- **参数规整命名**：角色前缀 + 语义核心——`INPUT_*`（读入物：`INPUT_TASK` `INPUT_RULES` `INPUT_FINDINGS` `INPUT_CRITERIA` `INPUT_RANGE` `INPUT_LENS` `INPUT_PLAN` `INPUT_DOC`）+ `OUTPUT_*`（写物：`OUTPUT_HANDOFF` `OUTPUT_GATE` `OUTPUT_RETURN`）+ `WORKSPACE_*`（环境：`WORKSPACE_DIR` `WORKSPACE_ID`）+ `FIX_BASE`（修复锚）+ 主格（`ROLE` `SCOPE`）——child 一眼分「读什么 / 写什么 / 在哪」
- **每节一个 mode**：implement / fix / review / docs-fix 各一节，child 只读自己那节（scope-lock 从散文约束提为结构事实）

#### 3.6 handoff 契约面——内容落盘 + schema 注入 + 散文归零（v1.7 · 用户 2026-10-08 三连裁定）

dispatch 收口首验暴露「child prompt 丢失 handoff JSON schema」后，三连裁定（内容落盘 · schema 注入 · 散文清理）把 child 产出的**结构约束**从散文收为**注入的 JSON schema**：

- **child 产出一律落盘**：handoff 内容（findings / notes / changes / evidence）写文件，stdout 只回三行指针（status / commits / artifacts）——`RETURN_JSON` 单通道结构不稳则任务白干（整段 stdout `JSON.parse` 不容任何杂质），review 家族统一 `RETURN_STDOUT_BLOCK`（三行指针 + 文件回读）
- **结构约束 = 注入 JSON schema（写面即契约）**：每 mode 在固定前缀尾部注入其**可写子集** JSON schema（` ```json ` fence，仿旧树 C4-2 `writableSchemaSubset`——剥 `$schema` 元键与「determined by dispatch」字段，如 review_scope）；child 按该 schema 写文件，写错 = structural violation
- **一声明两投影**：schema = typed 声明（`render/templates.ts` 或 schema 面），投影 ① prompt 注入文本 ② 引擎读回校验（typed 校验器回 session 平面，零 `config/schema/*.json` 文件——新树零 JSON 约束不破）
- **per-mode 拆分精简**：各 mode 只注入自己的子集——implement→evidence schema · fix→fix + evidence · review/docs-fix→findings（findings 字段共享基础声明，per-mode 引用子集）
- **handoff 散文完全清理**：shell `## Handoff` 段 · `HANDOFF_WRITE_GATE` 散文 · `RETURN_ZONE.DOCS_FIX` 孤儿块 → 全删，由注入 schema 取代；`HandoffFamily.schema?: "task"|"docs"` 从 dead 字段复活为 schema-face 选择器
- **引擎读回重建（单作者不破）**：child 写 carrier 路径 → 引擎读取 + schema 校验 → 物化最终 carrier（full-replace 同一路径，一文件两态：agent draft → finalized）；失败 = **不覆盖**（保留 child draft）+ BLOCK + crash record + resume——孩子成果不白干
- **test-evidence 一并 schema 化 + 引擎真读回**（第二个虚设补钉）：evidence 文件当前引擎零代码读取（prompt 声称引擎读回但无实现）——纳入 schema 面 + 引擎读回校验，缺 typecheck 项 = BLOCK

#### 3.7 分派表实现收口 review（v1.8 · 用户 2026-10-08 六前提复盘 · T15 真实探针后）

T15 implement→review→fix 真实探针（real claude child · implement/review/fix 三份 child prompt 实物 + handoff 产物 cross-check）验证 §3.5/§3.6 结构全部落地（≈90% 前缀字节级 mode 固定 · 精简 context · compact schema 注入 · findings 文件回流 rollup/路由全通 · 引擎实体单作者不破），同时收口六项 prompt-face 修正：

- **FIX_BASE 锚=评审 head**：`#fixedPoint` 读 source review 载体 `commits.base`（TASK_BASE），指令承诺「prior handoff's `commits.head`」——fix 应锚在被评审终态 → 改读 `commits.head`，fallback base
- **task review 的 `INPUT_RANGE` = TASK_BASE..HEAD**（REVIEWS.task.ref 已声明）——从 implement 载体 commits 派生 7-char 范围，fallback planPath；本轮 child 自推 workaround 正确但契约面应给足
- **review criteria/lens 折入固定前缀**（per-type 四变体 task/branch/spec/plan）：axes 全文 + lens 为类型常量，移至 mode 固定区随前缀缓存，`INPUT_CRITERIA`/`INPUT_LENS` token 消亡；**spec/plan lens 顺带补齐**（completeness|consistency|clarity · completeness|decomposition|buildability——修掉「one of 」空串缺口）
- **work 公共尾 shared**：evidence（implement/fix）+ commits（work 三 mode）从逐字重复收敛为共享 partial（per-mode base 措辞 · report 行统一），docs-fix 只取 commits
- **孤儿键清理**：fix 删 `INPUT_RULES`（shell 零引用）· `INPUT_PLAN` 值去 `**Plan:**` marker · `ROLE` 保留（主格事实锚）
- **evidence 命名家族字首化**：`{家族字首}-{SCOPE}-test-evidence.json`——task families → `tasks-{n}-…`（规范保留）· fix.branch → `branch-{base7}..{head7}-…`（弃误导性 tasks- 前缀）· docs-fix 无

#### 3.8 波次 pre-flight + 严格派发机械化（v1.10 · 用户 2026-10-08 拍板「review plan 加 wave pre-flight 前置校验」）

T15 收口暴露 DependsOn 解析/波次推导的三类摩擦（边提取读行尾散文入边 · 反依赖门未退役致前向引用 BLOCK · 派生面无读口编排方手算），收口为契约 + 门 + 引擎强制：

- **`DependsOn` 值域契约**：`- **DependsOn**: <id 列表>（…注释…）`——引擎边提取**只取首个 `(`/`( 前的裸数字 token 列表**（whole-token · 去重）；行尾括号注释**零参与**（散文进 objective，不占值域）；作者精炼习惯 = 依赖行不带散文——输入面与提取面双守，duplicate/self-loop 由散文数字注入的缺陷类在契约层面消除
- **波次 pre-flight 门**：`cdd review --type plan` 与 implement/review/fix 派发前置统一跑 `TaskGraph.validate()`——duplicate / self-loop / contradiction / phantom / cycle → **具名 BLOCK，child 零派发**（T24 记录「cycle 类活门 · doc-contract 早拦/评审派发 BLOCK」的接线落地——违约不再静默吞任务，任务丢失类死在门里）
- **严格派生波机械化（v1.21 三动词统一波门）**：task-face 派发前置 = **单张波次门 `WaveGate.vet(requested, verb)`**（session/wave.ts · 替代原 implement-only 门 + `#taskGate` 相位锁，二者合一）——① **`open = frontier(closedTasks())` 唯一读面**：闭合格与生命周期 `#markTerminal` 同源——**C5 route ∈ 闭合侧（词面替换后 = done/next-wave）才闭合格**· implement 行永不闭合（采纳伪落地 → 结构上不可能驱动派生）· 历史合并组行按 C5 自然化·「任何 ledger 行即 done」行读（v1.19 前合并组妥协）作废 ② **判定三式**：requested ≠ open → 拆组/子集 BLOCK + 整组提示（含 wave-board）· 开放波相位 ≠ 动词 → 错相位 BLOCK + 先跑对应相位 · 开放波内相位异构 → 具名 ledger 异常 BLOCK（各任务相位 map——「有 implement 无 review」即触发）③ **implement/review/fix 三动词同门**（implement 数值不变 · review/fix 新增——半波审查/半波 fix 结构性拦截，杜绝子集闭合触发波序重排）④ `#taskGate` 退役（混合组 = 异构相位 · 过期重跑 = 相位错位 · 闭合组重入 = requested≠open，三行为全被吸收）⑤ BLOCK 话术入词表（词表钉同步）——「零手工拆组」由引擎强制，非编排方纪律
- **波次读面 `plan-graph`（v1.11 · 展示定案 v1.18——beautiful-mermaid 渲染决策作废）**：`cdd schema get plan-graph --plan <path>` —— 特许多只读分支（零新子命令），输出**引擎自持 wave-board**（每 wave 一行 · 确定性 · task+进度标记 · 零第三方 · 零补丁——v1.12/v1.14/v1.15 第三方渲染层全作废，本行即终态）。**同一投影两显示**：`TaskGraph.report(done)` ① schema 读面随时调 ② review plan / 派发 pre-flight 门输出同视图（clean 附判 · 违规进 BLOCK 理由）——一次声明两显示，编排方不手算 DAG，authority 仍归 `next:`；**done 集与预检门同走 `closedTasks()` 单一读面**（v1.17 · 波内任务标记 ✔/▶ 不再被「当前波整行 ▶」吞掉）

- **直依赖 = 引擎约简（v1.13 · 用户 2026-10-08 拍板「direct-only 是引擎问题」）**：`DependsOn` 声明 = 作者自由（完整前置集，冗余零危害——闭包即 wave 基准不变）· **引擎消费面一律 transitive-reduction 后的边**（`TaskGraph#depsOf` = 约简：batches/frontier/report/reduction/hasPath 全走约简）· **校验域归一化（v1.16）**——validate 只评归一化图（去重 · 截断 · 约简为归一化链），duplicate 类退役（去重归一即消 · 作者字面零裁决），missing-edge / missing-id / self-loop / cycle 四类归一面上评· lint 加传递冗余 advisory（只警不拦：「T4 依赖 T2 经 T3 可达——只声明直接前置」）；plan-graph 节点盒内置 wave 标签（`T17 · W13`）——**渲染器不控布局、全图规模丢 label、正则补丁 = 技术债（v1.12 决策作废）**；wave 归属永远由板行承载

- **闭合单一裁决 + 词面收口（v1.17 · 用户 2026-10-08 review 拍板）**：闭环路由**唯一裁决点 = review**——review 有 findings → fix · review 零 findings → 闭合点；**fix 是副作用**（重审与否看其**源 review** 的 blocker 计数，非 fix 自身——源 blocker>0 → 重审 · 源 blocker=0（warn/nit 仅）→ 自然化闭合，v1.9 #278 无 APPROVED 强制重审保持）。所有闭合点（review 零 findings / fix 源 blocker 清零）共用 **`close(state) = readyBatch 空 ? 渲染 \`next: done\` : 渲染 \`next: next-wave\`**——单线面（plan/spec/branch）batch 恒空 → `done` 即该线终结（路由到 commit-*/handoff-* 终端）；wave 面非末波 → `next-wave`（下一派生整组）。**`none` 词面退役**（终结面不再与「无建议」同词）、**`next-group`→`next-wave`**（「组 = 波」一词一义——严格派生波下 group 语义已死）· **无 next = 硬错误**：现场派发若产出无 `next:` 行且非 BLOCKED/TIMEOUT（异常 null-route：carrier 不可读 · implement 无基）→ `CDD_BLOCKED` · exit 1，不再静默 `status: APPROVED` 无 next 行；BLOCKED/TIMEOUT 仍无 next（CDD_BLOCKED 面不变）；`soft-cap` 第三态保持（暂停 · 用户裁决 · 非 done 非 error）。**group→wave 词清扫**：route kind / 技能节点名（`implement-group`→`implement-wave` · `run-group-review`→`run-wave-review` · `fix-group`→`fix-wave`）/ 散文 / `effectiveGroups`→`effectiveWaves` / ledger `group` 行键随迁

#### 3.9 wave 全链原子模型（v1.22 · 用户 2026-10-08 拍板「派发的是 wave · 底层全部错配了 wave 和 task」→ T26 承接）

**wave = 全链原子单元**：dispatch/gate/brief/child/commit/handoff/schema/ledger/round/review-range/next 九面全 wave 键；task 降级为**波内分区**（brief 内各任务 objective/steps/acceptance + changes[] 归属标注），不再入记账/派发/评审单元。W11 重派实测（INPUT=波 brief · OUTPUT=单任务载体 `tasks-22-implement.json` · 提交=波级原子提交三态并存）证明粒度撕裂是真实缺陷类。

- **一帧一波**：Lifecycle task-face 帧 = 波（`#openWaveFrame` · frontier 派生波为单位）· ledger 行 = `{wave:"16,22,24", rounds:{implement,review,fix}}`——per-task 行退役（`{task:N}`→`{wave:"N"}` 全树迁移 · 历史合并组 `{group:"4,12"}` 已词清扫归 wave）· `#nextWavePhase` · `closedWaves()`（波闭合格 · `WaveGate` 判定式不变）
- **round context 变名（wave 键）**：`SCOPE`→`WAVE`（值 = 派发波如 `16,22,24`）· `INPUT_TASK`→`INPUT_WAVE_BRIEF`（波 brief）· `OUTPUT_HANDOFF` 值 = wave 键载体（`tasks-{wave}-implement.json`）· `ROLE`/`INPUT_RULES`/`WORKSPACE_*` 保持
- **载体/评审 wave 键**：OUTPUT 载体一律 `tasks-{wave}-*.json`（implement/review/fix/test-evidence）· review `INPUT_RANGE` = WAVE BASE..HEAD（波提交区间 · 一波一评审一 findings 一 fix 一重审）· fix `FIX_BASE` = 波评审 head
- **prompt 重写**：implement 声明「实现 WAVE {..} · **一波一提交**（提交消息覆盖全波 scopes · 单任务波退化为一次任务提交）· OUTPUT_HANDOFF 只写可写子集（changes[] 带每任务 reason）· `phase`/`wave`/`tasks`/`commits`/`status` = **引擎保留字段零写入**」· review/fix prompt 同 wave 键
- **schema 变更**：九面可写子集全 wave 键 · 保留字段列表显式声明（injected schema 列 reserved · 读回门对 child 写入保留字段 = **具名违例**——W11 T22 draft `phase`/`tasks` 违例即此形状，读回门正常、根在粒度错配）
- **执行序**：T26 引擎收口**先于 W11 重派落地**（阻塞性前置 · plan 记录为显式 deviation——canonical 波 12 照旧）→ 清 wave {16,22,24} 残留（per-task 载体 + ledger 行）→ 一次波级重派（一 implement 一 review 一 fix）

### 4. 编排面（技能）：工作流归一

#### 4.1 技能集合 8 → 6

| skill | 角色 | 说明 |
|---|---|---|
| cdd-design | 编排 | brainstorm 路由（mode/register/size 语义门显式）· 内部 run-cdd-charter · sync / run-cdd-charter 两 charter 节点 + run-cdd-spec / run-cdd-phase 两近同 dispatch 节点收敛为参数化单模板 |
| **cdd-spec-writer** | spec-writer | **single / phase-spec / overall 合一参数化**流（schema 目标 + scope-gates + author + handoff 参数）——旧 cdd-spec/phase/charter 三文件并入，重复体（review-loop 子图 · fix-spec 逐字节相同 · Invariants 表）单源 |
| cdd-plan | 编排 | plan writer（backfill-design 门 · Plan Sole Writer）· review loop 接入共享 spec-writer 循环体 |
| cdd-dev | 执行链 | implement/review/fix 三态 + branch 终面；全由 next: 驱动；`more-groups?` 退役 |
| cdd-close | 编排 | 分支收尾（upstream finish flow + 4 选项门）· 终面 = finish 编排语义门 + 终端（人工决策面，非 next 驱动 · 无 review 自环）· typed-discard 门不变 |
| cdd-report | 工具 | 聚合 issue 上报（gh CLI · dedup · 确认门）· 独立无重叠 · 一次性上报链路（无 NEXT-LOOP 自环）|

#### 4.2 全链 digraph = 执行节点 + 单 next-loop 自环

五链 digraph（cdd-design / cdd-spec-writer / cdd-plan / cdd-dev / cdd-close）统一骨架为：一次性动作节点 + `NEXT-LOOP` hub + 终端（commit/handoff）——`NEXT-LOOP` 覆盖 review→fix 循环链（cdd-design 编排回收 · cdd-spec-writer · cdd-plan · cdd-dev 三态），**cdd-close 止于 finish 编排语义门 + 终端、cdd-report 为一次性上报工具链（均无自环）**。**边条件恢复（v1.17· 用户 2026-10-08 review 拍板——v1.20 时代「边零状态标签」作废：分支去处无图可循 = 分支信息丢失，Exit 散文自述 = 双源）**：**每个决策边携带显式条件**（`{status?}` → APPROVED / CHANGES_REQUESTED / REVIEW_FIX · 各语义门出边逐条标注）；**NEXT-LOOP 三出边契约**——自环挂 `until next=done`（继续：review · fix · next-wave 全归此边）· `next=done →` 终端（单线面 commit-*/handoff-* · wave 面走完即 `done` / 非末波 `next-wave`）· `no next →` BLOCKED（BLOCKED/TIMEOUT/异常 null-route 硬错误出边）；**cdd-dev branch-review 独立 next-loop 闭环**（branch-review↔branch-fix 自身 `until next=done` 闭环，不再借道实现期 NEXT-LOOP hub——branch-fix 重审语义只属 branch 面）。显式节点三类：一次性动作 / 终端 / 编排语义门（design mode/register/size · close finish——人工决策面，非 next 驱动）。Review Convergence（review-unskippable · 新 ref 即新 review · CLI 评审替代禁令）等纪律全数归 Invariants 段，Node Definitions 零路由自述（路由即边条件 + `next:` 事实）；**digraph 节点名 ↔ Node Definitions heading ↔ 文本引用一致断言钉住（多链共享节点名不漂移）**。**词表钉（v1.17）**：边条件取值出自引擎词表锁定短语（`until next=done` · `next=done` · `no next` · 决策状态词——与 `next:` 运行时 Route 事实共享一词表）——digraph 静态分支真相与 next: 运行时实例机械防漂移，守卫逐边断言。上游 import 面保持（superpowers:brainstorming / writing-plans / finishing-a-development-branch / mattpocock-skills:grilling，M 组 fit 映射不动）。

### 5. 工具链（scripts/）：守卫消费引擎元数据

#### 5.1 守卫单源

scripts 全重写：guard **consumes engine metadata**（通道审计 / 词汇面 / 结构断言全部走引擎导出或词表单源派生），并行正则世界关闭。residue 词 ban 表（STALE/GATE）→ 词表单源数据行；channel-audit 字面（env/argv/解析文件名）→ 引擎导出。checkAnatomy 语义**保留**（技能结构契约 = 方法论机器化，Q6 判例），实现随技能 6 集重写；**skill-anatomy 契约随守卫归位引擎契约面**（v1.4：`config/schema/skill-anatomy.json` → typed 导出 · guard 消费导出非 JSON 路径 · config 旧址随 T15 cutover 删除）——守卫的数据/契约消费 = 引擎导出，零 JSON 路径。

#### 5.2 emit/validate 单一编排

emit 四碎（all/check/compare 面）+ 双 Orchestrator → 单一 emit 编排器；5 个 16-45 行 validate 薄 wrapper 折叠进 runner 数据表；清单/版本同步/pi-package 校验随 6 集技能重写（EXPECTED 计数等旧 pin 删除，换新断言）。

### 6. 两代过渡与交付

#### 6.1 目录拓扑（同包并行 + 5 职责平面）

**过渡放置**：新引擎建于 `packages/cdd-engine/src-next/`（**同包并行**——包名/README/workspace 依赖零 churn，优于新包 `cdd-engine-next` 的包级 churn：改名/依赖换向/README mirror 政策/emit 发现面重排）；工具链同构 `scripts-next/` → cutover 后 `scripts-next` → `scripts`；技能 8→6 在 cutover 点于 `packages/kairos/skills/` 原子 swap（6 文件级 swap + emit 再生，无需并行目录）。

```
packages/cdd-engine/src-next/
  bin.ts                      # CLI 入口（薄）
  contract/                   # 文档契约 = 一份数据的四种消费
    declare.ts                #   三 doc 类型元素登记表（typed 声明数据）
    project.ts                #   派生投影（shape · schema · slices · tokens · reference 五面）
    judge.ts                  #   Contract.validate() 协调器 + 不变式策略类族
    lint.ts                   #   reference lint（WARN pass）
  session/                    # 会话机 = 状态机 + 账本
    graph.ts                  #   TaskGraph（边违约五类 · 波次）
    state.ts                  #   frontier + ExecutionState 查询面
    next.ts                   #   NextStepRouter 单点
    run.ts                    #   参数化单 lifecycle（task/branch/spec/plan faces 数据表）
    ledger.ts                 #   progress · handoff · crash · round（一会话一账本）
  face/                       # 操作面 = 词表 + 胶囊 + 命令
    words.ts                  #   词汇表单源（doc 词 + 胶囊词 + 守卫词 一家）
    capsule.ts                #   status · blocker · handoff · next 单胶囊面
    cli.ts                    #   implement · review · fix · schema · issue · base（base set|get）
    host.ts                   #   harness-contract typed 面（dispatch.review 行 · P4 评审准则数据）
  render/                     # templates + brief（活则留）
  infra/                      # 真基建（runtime（config 面 · 前 resource.ts）· git · process · workspace，≤5 文件）
```

**新旧零依赖（硬规则）**：新树自包含——`src-next/**` 零 import 旧树（双向：旧树亦零 import 新树；grep 断言钉死），新树连基建（infra/）、词表（face/words）、派生（contract/project）全部**重新实现**，不借用任何旧符号/旧分组/旧 helper；**数据面归位（v1.4 承接）**——外部契约 JSON（engine-config / harness-contract / template-contract）**不作为外部文件读取**，收敛为新树 **typed 平面成员**（`infra/runtime.ts` · `face/host.ts` · `render/templates.ts` · §6.4），新树零 JSON 读取、零读旧 `config/` 路径（grep 断言）——「按同址读取」旧妥协取消（引擎外零外部 JSON 消费者：仅本 repo 自有 kairos tests + 将删旧 scripts，全由 P3.2 接管）；schema / lexicon / tokens 等**派生产物由新树自派生**——并行期新树测试只用自派生数据，不读旧派生产物。两树共存的唯一共同物 = 方法论本身（消费规范与词面土层），代码级互为透明。

组织原则从「按文件类型归档」（旧 cli/dispatch/artifacts/documents/domain/rules/render/infra 八目录 + bin.ts 入口面——doctypes/body 为 documents/ 下的嵌套层，非顶面）改为「按职责语义聚合」：**contract / session / face 三大职责 + render/infra 两服务**。跨面碎片归位——胶囊散在 rules/result-face+next-step、词表散在 documents/words+infra/word-table、账本散在 artifacts/×9 → 各归其家。文件数 **72 → ~30-38**，顶平面 **8 → 5**。

#### 6.2 过渡纪律

新平面（新目录/新文件）**并行建齐** → 引擎 vitest 全绿 → 入口切换（package.json/bin imports 指向新树）→ **旧树/旧技能文件删除** → `pnpm run validate` ALL PASS · typecheck ×3 · biome · emit 新鲜。两代并存期以「新树全绿前旧树不删」为唯一闸（best practice：并行可回退，切完即删）。

#### 6.3 净减与验收账

生产面基线 ≈ 29k 行（engine 18.7k · scripts 7.0k · kairos 0.84k · config 2.5k）→ 目标 **−20% 内左右**（工作流重复体 + 双判定面 + 五家词表 + 三 lifecycle 合一的最大来源）；净减行为入验收；**数据面归位入净减账（v1.4）**——`config/` 整目录（13 文件 ~150K）随 cutover 删除零重建；旧树/旧符号/旧技能文件**零残留 grep**；消费面（capsule 词面 · 三真骨架 schema 语义 · cdd CLI 命令面）保持稳态。changesets cdd-engine major + kairos major · README 与消费面文档随 6 集重写。

#### 6.4 承接 P4/P5——数据面归位（v1.4）

P4（`cdd-doc-review` 一产化）/ P5（DispatchContract + DispatchPacket）**超前吸收**（用户 2026-10-07 拍板「都是一体的」）：两者在新机体中的形态 = **数据面内容**而非独立 phase——依赖图上原来 `P2→P4 · P3→P5 · P3.1→P5 · P4→P5（hard）` 全改 `P3.2 ->(承接)`，执行序后置 phase 移除。

- **P4 承接**：评审准则（URC spec/plan 三轴 · writing-plans 自检——spec 覆盖/占位扫/类型一致 · verification evidence）作为 **typed 数据**落 `face/host.ts`（dispatch.review 行）+ `render/templates.ts`（axesGuide），由 review 装配面引用；「kairos 第 9 席技能」前提随技能 6 集封闭集作废——准则归数据，评审归引擎装配
- **P5 承接**：DispatchPacket 概念被 capsule + handoff + 模板数据面**取代**（新树无 packet——提示词由模板面 + frame 值装配）；ref 机制由新 ledger + review ref（commit-range / doc_hash 双层）落地；残留三件 = **M1 supersede**（`dispatch.implement` tdd → `mattpocock-skills:implement` + `refs` 域登记）· **三处禁文删除**（review.task/branch note「parallel sub-agents forbidden」×2 + axesGuide「no parallel sub-agents」）· dispatch/refs 域收敛——全部为 typed 数据内容
- **数据面形态**：engine-config → `infra/runtime.ts`（contextContract · handoffNamespace · $version——failureCategories/slugRule 死字段剔除）· harness-contract → `face/host.ts` · template-contract → `render/templates.ts`；`resource.ts` 路径表/JSON 解析/`$schema`/`_doc` 散文面删除；新树零 JSON、零 `config/` 路径（grep）；**`config/` 整目录（13 文件 ~150K）随 cutover 删除零重建**；skill-anatomy 归 T14（引擎契约面 typed 导出）

#### 6.5 承接 P6——宪法化单文件收敛（v1.4 承接 · v1.6 单文件裁定）

P6（overall 宪法/档案分层）**吸收进 P3.2 尾部**（用户 2026-10-07 拍板「吸收进 P3.2 是明确的」）：新机制下 overall 结构 = **登记表行 + 投影**——宪法化 = 登记表行更新 + 文档迁移（零引擎结构代码）。依赖从 `P1→P6（hard）` 改为 `P3.2 ->(承接)`。

**v1.6 裁定（用户 2026-10-08 拍板「不需要 overall-archive.md——overall 变两份文件增加消费者心智负担」）**：宪法化**收敛为单文件**——overall 保持一份文件、零新增 artifact（`-archive.md` 构想退役，File paths 承诺通道关闭为「零新文件」）：

- **单文件宪法化**：Standing rules 规范化折叠成典 · 版本行 lineage 散文消解 → 结构化修订记录（telescope 尾链断）· change-history 巨型 cell → 结构化 record —— **全部在 overall 本体内完成**（结构化收敛发生在文档内部，不建第二文件）
- **零引擎改动**：declare.ts overall 登记行**不简化**——Issue inventory / Change history 保持 required（单文件下它们仍是锚存在性判定）；doc-contract 门对新形零改动走通
- **全树 4 overalls 同口径迁移**（内容逐字 · 容器改造 · 历史正文零 retro-rename）

### Acceptance criteria

- 三 doc 类型元素登记表存在（每元素含锚 token · presence · value pattern · ref kind · 归属面）；shape/schema/slices/tokens/reference 五表达面全由登记表派生，schema 字节 pin 自首版钉住；shape 散文面（~955 行散文体）零残留（grep）
- 词表单源（doc 词 + 胶囊词 + 守卫词 · 一词表一派生链）：旧 lexicon 五家（words.ts/json/shape/word-table/guard-lexicon 分家）零残留（grep 断言）
- 解释器 = 唯一判定器：上下文缝不变式（file-existence / sibling-scan / cross-doc-chain / section-scoped-domain）落地有负例断言；doctype 类零判定方法（类面 grep 判定符号零残留）；`InvariantVerdict`/`declared`/`CompiledSurface` 概念零残留
- 不变式 = 策略类族（`abstract Invariant.evaluate()` 多态 · `Contract.validate()` 协调器零 switch-case 判定分发断言）· 零裸函数（新树行为面 grep 裸函数零残留 —— 模块级导出仅类型/常量/类/组合根）
- TaskGraph + frontier + ExecutionState 查询面（doneTasks()/readyBatch() 为方法，不新增独立类）；边判定（五类——缺边/重复/缺失 id/自环/环）唯一家在 TaskGraph，doc-contract parse 早拦负例断言；前向引用合法（contradiction 负例转正 · 环具名违约 BLOCK 负例）
- `NextStepRouter` 单点：next 生成单面（负例：warn/nit→`next: none` · blocker>0→re-review · BLOCKED 无 next 行）；胶囊 `status · blocker · handoff · next:` 词面字节 pin 稳态
- dispatch 单 lifecycle 参数化落地（task/branch/spec/plan 数据表驱动）；CLI 命令面（implement/review/fix/schema/issue/base——base set|get）保持
- 技能集 8 → 6 落地：cdd-spec-writer 合一（single/phase/overall 参数化）；四链 digraph（design/spec-writer/plan/dev）单 next-loop 自环 · cdd-close 止于 finish 编排语义门 + 终端 · cdd-report 一次性上报工具链例外 + 边零状态标签；digraph 节点名 ↔ Node Definitions heading ↔ 文本引用一致断言；节点锚定零残留；skill-anatomy 注册（6 集）+ 目录扫描守卫 + `pnpm run emit` 再生 + 零程序历史 pin；上游 import 面/编排语义门/Review Convergence 纪律保持
- scripts 重写：guard 消费引擎元数据（residue 正则 ban 表 → 词表数据行零残留 · channel 字面引擎导出）；单一 emit/validate 编排器；旧 wrapper/双 Orchestrator 零残留
- 两代过渡：新树 **5 平面拓扑**（contract/session/face/render/infra · 文件 72→~30-38 · 顶面 8→5）落地于 `src-next/` + `scripts-next/` → 入口切换 → **旧树/旧技能零残留（grep 断言）** → validate ALL PASS · typecheck ×3 · biome · emit 新鲜 · changesets（cdd-engine major / kairos major）· 净减账（29k → 目标 −20%±）入验收
- **新旧零依赖断言**：`src-next` ↔ `src` 双向零 import（grep）；新树自包含全量重写（无旧符号/旧 helper/旧分组索引）· **数据面归位（v1.4）**：三稳态 JSON → typed 平面成员（infra/runtime · face/host · render/templates）零残留（grep）；`src-next` 面 `config/` slash 路径零命中；派生产物自派生（并行期测试不读旧派生产物）
- **四 phase 承接映射（v1.9 · v1.4 Done 宣言作废）**：P4/P5/P6/P7 承接 = **映射 + 状态以 plan 任务为准**（spec 层不宣告 Done；overall Phase inventory 的 `[Pending]`/Done 为权威）。承接映射表：

  | P-acceptance | plan 承载 | 状态 |
  |---|---|---|
  | P4 准则 typed 数据 | T21 | ✅ 已落 |
  | P4 封闭 6 集零新增守卫 | T16 | ⏳ W12 |
  | P5 M1 supersede / refs 登记 / 三处禁文 | T21 | ✅ 已落 |
  | P5 refKind 四型 / skills 有序链 / capabilities per-harness | **T25（v1.12 新增）** | ⏳ 补遗 |
  | P6 宪法化单文件（4 overalls 迁移） | T22 | ⏳ W12 |
  | P7 翻译层 / base 命令面 / capsule 机面 | T19/T20 | ✅ 已落 |

  grep 面保持：三 JSON 零残留 · review 禁文零残留 · `dispatch.implement` = `mattpocock-skills:implement` · `config/` 整目录零残留（`test ! -d`）· 版本行散文零残留（T22 终态）· 宪法化承接（形态收敛见 v1.6 单文件行）
- **宪法化单文件（v1.6）**：overall **单文件宪法化**（Standing rules 成典 · 版本行 lineage 消解 → 结构化修订记录 · change-history 结构化 cell，全在 overall 本体内）· 零 `-archive.md`（File paths 承诺通道关闭为「零新文件」· grep：overall-archive 零残留）· declare.ts overall 登记行不简化（Issue inventory/Change history 保持 required）· 全树 4 overalls 同口径迁移 · 历史正文零 retro-rename
- **dispatch 调用面（v1.6）**：HOSTS 含 `promptForm` 数据列（prompt 位置语义数据化）· child prompt 单位置参数 + skill-ref 前缀并入首行（独立 ref 位置参数零残留 · grep 反断言）· 真实探针门槛（`claude -p` 探针验证 prompt 到达 child，FakeSync 桩断言 + 真实探针双门槛）· `#childPrompt` 统一组装单点
- **child prompt 分派表（v1.6）**：mode 分派表结构（implement/fix/review/docs-fix 各一节 · 每 mode 固定前缀字节稳定 —— 前缀缓存按 mode 分组共享）· round context 唯一动态区 per-mode 精简子集（空值键不发）· 参数规整命名（`INPUT_*` 读物 / `OUTPUT_*` 写物 / `WORKSPACE_*` 环境 / `FIX_BASE` 锚 / `ROLE` `SCOPE` 主格 · 零旧名残留 grep）
- **handoff 契约面（v1.7）**：child 产出一律落盘（handoff JSON 写文件 + stdout 三行指针 · 全家族统一 `RETURN_STDOUT_BLOCK`——`RETURN_JSON`/`DOCS_FIX` 退役 grep 反断言）· 结构约束 = **注入 JSON schema**（per-mode 可写子集 ```json fence · writableSchemaSubset 投影剥 `$schema`+dispatch 确定面 · 一声明两投影：prompt 注入文本 + 引擎读回校验 typed · 零 `config/schema/*.json`）· **散文清理**（`## Handoff` 段 + `HANDOFF_WRITE_GATE` + shell 结构约束散文零残留 grep）· 引擎读回重建（child draft → 校验 → 物化同路径 full-replace · 失败 = 不覆盖 + BLOCK + crash record + resume）· **test-evidence 一并 schema 化 + 引擎真读回**（缺 typecheck = BLOCK）· 真实探针验证 findings 经文件回流路由
- **child prompt 收口 review（v1.8）**：FIX_BASE 锚=评审 head（`#fixedPoint` 读 commits.head）· task review `INPUT_RANGE`=TASK_BASE..HEAD（implement 载体派生）· review per-type 固定前缀（criteria/lens 折入 · spec/plan lens 补 · `INPUT_CRITERIA`/`INPUT_LENS` token 消亡）· work 公共尾 shared（evidence+commits · report 统一）· 孤儿键零（fix `INPUT_RULES` 删 · `INPUT_PLAN` marker 删）· evidence 命名家族字首化（branch-{range}-test-evidence.json）
- **波次 pre-flight（v1.10）**：review plan + implement/review/fix 派发前置 = `TaskGraph.validate()`（duplicate · self-loop · contradiction · phantom · cycle → 具名 BLOCK · child 零派发）· `--tasks` 拆派生波 → BLOCK · `DependsOn` 值域 = 首个 `(` 前裸数字列表（行尾注释零参与 · grep 断言）· 派生波表随门输出（零新子命令）
- 历史文档零 retro-rename（docs/kairos 方法论记录不动）；消费面 SKILL.md/README 随 6 集重写

## Constraints

- **两代并存过渡闸**：新树测试全绿旧树才可删（并行构建 + 入口切换，切换后立即删旧）
- **新旧零依赖**：`src-next`/`scripts-next` 自包含，零 import 旧树（双向 grep 断言）；新树按新架构新思路全量重写，无旧符号/旧分组/旧 helper 复用；**数据面归位（v1.4）**——三稳态 JSON 收敛 typed 平面（零 JSON/零 `config/` 路径 grep），`config/` 整目录随 cutover 删除零重建，派生产物由新树自派生（并行期不读旧派生产物）
- **消费面稳态（非兼容义务）**：capsule 词面（`status`/`next:`/`CDD_BLOCKED:` 英文恒定）与 cdd CLI 命令面（含 `base set|get`）保持——既是方法论机器面也是消费词面，greenfield 不为其做旧面保留，但新树首版即同词面
- **单数据真相**：元素登记表 + 词汇表 = 唯一声明家；派生投影零手写副本
- **判定单家**：一切结构判定走上下文缝解释器；doctype 类只 parse+投影
- **零裸函数（Criterion ② 全平面正位）**：新树行为/判定/派生全为类成员——三大职责对象（Contract / Session / Face）+ 不变式策略类族；模块级导出仅类型/常量数据/类/组合根，无携带行为的裸函数（旧函数解释器 + 游离 helper 不复现）
- **工作流归一**：技能最小集（6）= 编排 + spec-writer + plan + dev + close + report；流体单源不重复
- **历史正文零 retro-rename**：docs/kairos 方法论记录为史实；重写只作用于引擎/工具链/消费面 SKILL.md
