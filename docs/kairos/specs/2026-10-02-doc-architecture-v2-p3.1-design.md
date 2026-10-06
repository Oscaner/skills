# 文档架构方法论 v2 —— P3.1 Design

- **Version**: v1.4 · 2026-10-06
- **Status**: Draft
- **Author**: [human] · Claude Opus 5 (1M context)（kairos:cdd-design → grilling → cdd-phase）
- **Parent program**: [doc-architecture-v2-overall.md v1.12](docs/kairos/specs/2026-10-02-doc-architecture-v2-overall.md)
- **Depends on**: P3（shipped · [p3-design v1.1](docs/kairos/specs/2026-10-02-doc-architecture-v2-p3-design.md)）

## Design

#### 1.1 盲区、动因与范围

P3 shipped 暴露两个机器面盲区、一个程序级散文平面、以及一个结构判定双复制面：

| 盲区 | 实证 | 后果 |
|---|---|---|
| design body 结构秩被压平 | `### 2.x` → `**2.x**` 加粗伪标题 · 全树 `####` = 0 · `#skeletonFailures` 只断言骨架四头，`## Design` 与 `### Acceptance criteria` 之间的体零检查 | design body = 最后一个无登记叶平面，机器不可见（全树 21 份 spec，19 份携带 171 处独立 bold 扁平伪标题） |
| 边声明 silent default | `parseTaskBlock` 仅「行存在才读」+ 稀疏展开（缺行 = undefined = 全单例）· 全树 22 plans / 214 task 块 `DependsOn` 行 0、`AtomicWith` 仅 4 plan 部分携带 | 「忘写边」= 静默全单例，机器无 oracle（TaskGraph 无完备性概念） |
| overall charter 体（程序级） | `## Program charter` 内 bold-flat 结构标记——doc-architecture-v2-overall 全量 10 个（Goal/Non-goals/Cross-cutting/设计决策留存/M·F·R·B·E 决策组/上游先例背书），另 3 份 overall 仅 Goal/Non-goals/Cross-cutting 三标记；engine 只读四表 + 版本行 | 程序最重要的决策留存（M/F/R/B 全量定案）零机器可触达 |
| 结构判定面双复制 | checks（skeletonFailures · overall 四表审计 · plan 契约 = 手写文本遍历 ~1,700 行）+ tests（tree-migration 989 + dual-read 293 两套全树 re-walk） | 每新增一条结构规则 = 一个手写 walker + 一个测试 re-walk |

范围（overall v1.9 注册）：**统一 StructureRule 规则引擎 + 登记叶完备（plan 边 · designItems · charter facets）+ overall charter 结构秩 + 全树迁移 + 消费面**。**P6 边界**：宪法/档案分层与版本行散文消解不动；**P5 边界**：跨文档链规则（Class-A/B lineage · resolveSpecFromPlan · phaseIdForDispatch）不并入。

#### 2.1 统一抽象：登记叶与 StructureRule（F6）

**抽象命题**：doc 平面的一切结构断言 = 「在类型化叶平面上声明不变式」。叶平面（leaf plane）按锚定型：

- `headingLeads`（`#### N.M` designItems · charter facets · `### Task N:`）——行首标题锚
- `tableRows`（四表）——表头锚 + 行格抽取
- `records`（task 记录字段）——字段锚

不变式词汇七种（声明式，非通配 DS L）：

| 不变式 | 语义 | 实例 |
|---|---|---|
| presence | 必在 | `## Design` · `## Constraints` · charter facets |
| uniqueness | 唯一 | `### Acceptance criteria` · phase id 不重复 |
| domain | 值域 | 边值（`none`/空/正整数）· 版本 `v\d+.\d+` |
| crosslink | 跨锚 | graph token → Phase inventory · issue ref → Issue inventory |
| order | 单调 | change-history 版本升序 |
| continuity | 编号连续 | task 1..N 无缺无重 |
| residue | 禁面 | 伪标题（独立 bold 行）· legacy 面（Form B / `## Task Groups` / `## Section 1`） |

```ts
// rules/structure.ts —— 单解释器的规则类型契约（本 phase 落地）
interface StructureRule {
  id: string;                        // "plan.edges" · "spec.designItems" · "overall.charterFacets" …
  plane: { kind: "headingLeads" | "tableRows" | "records"; anchor: string };
  invariants: StructureInvariant[];  // 上述七不变式的类型化实例
  severity: "BLOCK" | "WARN";
  message: string;                   // 固定文案 —— 与 fail 词汇共用，永不散写
}
function runStructureRules(content: string, rules: readonly StructureRule[]): StructureFinding[];
```

规则数据（rule data）在 body 叶（plan-body / phase-spec-body / 新 overall-body 各持 `structureRules(): StructureRule[]`）——**bodies 保持 load-order 安全**（tokens.ts 环链不破：规则为惰性数据，零解释器反向 import）。解释器挂钩 `docContractValidate` = 三类型各一次 `runStructureRules`。F 归属以父 overall F 清单（F1–F7）为唯一权威；父 P3.1 行曾以「统一引擎落地（F9）」指称本引擎、与 F 清单不符——父面属冻结面，本 design 按 F6 行文、不定义 F9，消解留编排方。

#### 2.2 三类型规则集与 checks/walks 归零

| doc type | 规则集（数据） | 迁移掉的手写面 |
|---|---|---|
| plan | task continuity · record presence/domain · **edge completeness（= 第六 failure class）** · constraints source · residue（legacy 面） | `validatePlanContract` 文本断言面 |
| spec | 三真骨架 · **designItems（计数/逐字/空壳/空体/伪标题残留）** · deviations 行锚 Yes | `#skeletonFailures` 全部 |
| overall | kernel · 四表 facet ①–⑥ · **charter facets（条件化）**——Goal/Non-goals/Cross-cutting 恒为 presence 不变式；决策留存/决策组/背书按存在才执法（doc-arch overall 全量，另三份仅三标记） | `overall.ts` 四表审计全部 |

测试面：`tree-migration` / `dual-read` 的行走 → **消费同一引擎**（每 doc type 规则集喂 48 文件树，断言命中 = 0 或 pin）；内容保真逐字 pin 保留为 pin（非行走）。净效果：结构判定引擎面 ≈ 减 40%，每新增规则边际成本 = 一行数据 + 一条断言。

#### 2.3 登记叶 ①：plan 边完备（F1 重建——单边化 + 反依赖门 + 波次分组）

- **词法（单边化重建，2026-10-06 用户拍板）**：`DependsOn` 唯一有向边，每 task 块必带一行；`- **AtomicWith**:` 与 `taskGroups` 声明面退役（死壳即删——读取面/对称传递闭包/矛盾边检查/schema 字段/夹具/pins 零残留）。值 = 显式 `none` / 空 / 逗号表正整数（`1, 2`）。`none` 与空 → `[]`；其余 token 保持 integer-gate NaN 拒绝
- **缺行 = 第六 failure class `missing-edge` · BLOCK**（plan 结构性错误——忘写依赖 = 结构错误，硬门不软）
- **反依赖门（新增硬门）**：`DependsOn` 仅可引用编号 < 自身的任务（`T5 依赖 T10` = 编号序 ≠ 执行序 = 反依赖 · BLOCK）。编号序 = 拓扑线性化锚——编号升序即合法执行序子序
- 归因（2026-10-06 用户三连裁决）：① 同层 = 同组（组 = **波次**：编号升序扫描就绪集，一次 implement dispatch 做完全部就绪任务——分组初衷 = 减 implement 轮次，非声明）；② 跨层同批需求 = 计划拆分错误（应合并任务，不为 atomicWith 重开表达口）；③ `missing-edge` 硬门保留——防忘写 = 防「任务被放错波次 → 过早 dispatch → implementer 面对缺失前置产物」的执行序故障
- **TaskGraph 静态面**：`validate()` 重建 = P3 crisp 集（id 越界/自引/矛盾边退役/环/重复）+ missing-edge + 反依赖门；`batches(): TaskBatch[]` 波次推导（编号升序就绪层 · 波次内可并行 = capability 面 M3，与图无关）
- **引用 lint**（WARN，兜底防忘写软门）：扫描面 = `objective`/`acceptance` 明文；token = `\bTask\s+([1-9]\d*)\b` 或 `\bT([1-9]\d*)\b`；越界 N 豁免；逐块对在界 N 去重后 N ≠ i 且 ∉ 本块 `DependsOn` 声明 → 一条聚合 WARN；兜底 = plan-review 必答问题

#### 2.4 登记叶 ②：designItems（F3）

- 叶切片 `designItemHeading: /^#### /m` 进 phase-spec body slices（exact-anchor 天然不碰 `### Acceptance criteria` / `## Design`）
- **伪标题 pattern（精确、无误伤）**：独立 bold 行 = 行首 `**`、行尾仅空白——该形态在任何语境不可能是合法散文 → 残留 = **BLOCK**（这正是 P3 shipped 的缺陷形态，比 WARN 强）；行内 lead-in bold（bold 后同行有正文）合法散文、不强制提秩
- 空体（`## Design` → `### Acceptance criteria` 间零内容）BLOCK；hollow 叶（`####` 与下一标题/节界间零内容）BLOCK（空壳即删）
- 全树 21 份 spec 核查、19 份提秩：独立 bold 伪标题合计 171 处——编号式 `**N.M …**` 77 处（13 份文件）· § 式 `**§N.M …**` 87 处（7 份文件）· 其他式（`**A. …**`/`**Appendix: …**`/`**前置原则…**` 等）7 处（4 份文件；文件可混式，如 cp-p1 兼有编号/§）→ 一律 `#### <原文本逐字>`（含 `§` 原文保留）；2 份零独立（cp-p4.1 与 doc-arch-p3）→ 自然合法、零提秩（doc-arch-p3 设计体全为行内 lead-in bold，按本 pattern 属合法散文）

#### 2.5 登记叶 ③：overall charter 结构秩（F7）

- **OverallDocBody** 补齐三件套（shape + slices + rules），整体 doc type 告别野形态（Criterion ② 归零）
- `## Program charter` 内 charter facets → `###` 秩（Goal / Non-goals / Cross-cutting / 决策留存）；决策组（M/F/R/B/E/上游先例背书）→ `####` 秩
- 机器检查：Goal/Non-goals/Cross-cutting facets presence 恒为不变式 · 决策留存/决策组/背书「存在才执法」（doc-arch overall 全量枚举，另三份 overall 无此面、不枚举）· 伪标题残留 BLOCK（overall 侧同 pattern）
- 全树 4 份 overalls 迁移（内容逐字 · 容器只移）；`## Boundary rules` / `## Maintenance` 已是正规 `##` 节，不动

#### 2.6 编排状态机：frontier 动态面 + `next:` 推荐 + skills 编排精简（T7 扩域）

TaskGraph 从「静态图」升为「编排状态机」，`next:` 是它的投影：

```ts
interface TaskGraph {
  validate(): GraphVerdict;                       // 静态门（§2.3）
  batches(): TaskBatch[];                          // 静态面：波次推导
  frontier(done: DoneSet): TaskBatch;              // 动态面：给定完成集 → 下一就绪波次
}
```

- **`frontier(done)`** = group-next 推荐的唯一实现：就绪 = 最小编号未完成且 DependsOn 全 Done 的任务集；`next:` 组间 default = 同环优先（同组 fix/re-review）∧ closure 后 `frontier(done)`。完成态 = workspace handoff ledger + changes[] 收敛，以 commit/ref 边界锚定（防跨分支串态）
- **ExecutionState 统一（一并收，2026-10-06 用户「还有没有其他功能，一起收」）**：编排状态全收敛为一个图友好查询面——现有 `ProgressLedger`（progress.json，已是 OOP 单所有权）升为 TaskGraph 可查询：`doneTasks(): Set<number>`（由每轮 handoff 结论收敛）+ `readyBatch(): TaskBatch` = `frontier(leader)` 的直接来源；`base-branch` / `crash` 恢复 / handoff 三文件已是 artifact 面单所有权，不动（无重复）
- **next 路由器单点（一并收）**：`next:` 生成从 6+ 处散布（dispatch/task · docs · branch · cli/review · fix · result-face）收敛为 `nextStep(state, ref)` 一个函数——同环优先（review→fix→re-review closure 判定）∧ closure→`frontier(done)`；spec/plan（docHash ref）与 task/branch（commit-range ref）经同一路由器，skill 全链消费
- **skills 编排精简**（2026-10-06 用户拍板：最大程度代替 skills）：cdd-dev flow 的 loop 判定（`more-groups?` / 下一组选择）→ `next:` 消费——编排方不写「下一组是什么」，只读 `next:` 派发；cdd-spec/plan/phase/charter 的 review→fix→commit 三态循环同路由 next 驱动；**异常/人工面保留**：HARNESS_ABORT 恢复 / mid-flight backfill 暂停 / user adjudication 覆盖 / Plan Sole Writer（跨任务修订）不依赖 engine 推荐
- **代替边界**：代替「状态判定」（下一组/同环路由/组序 = 拓扑序），保留「契约 + 异常面」（skill 仍是入口与兜底）
- P5 的 group-next 段摘出交还本 phase（overall v1.12 同步）；P5 其余（DispatchContract/Packet/ref 四型/capabilities）不动，其 graph-node ref 以本 phase `frontier` 为消费底座

#### 3.1 全树文档迁移（F7）

一次全树、机器 pin 兜底：

| 面 | 数量 | 迁移 |
|---|---|---|
| plans 边行 | 22 plans / 214 task 块 | 单边化迁移：`- **AtomicWith**:` 行全树删除（死壳即删），每块保留/补全单行 `- **DependsOn**:`（真实值或 `none`）；既有 atomicWith 语义经波次推导天然覆盖；反依赖全树核查（现有边全编号升序，零违规） |
| specs 结构秩 | 21 | 核查 19 份提秩：171 处独立 bold → `####`（逐字）；2 份零独立不迁移 · 迁移后全树 0 残留 |
| overalls charter | 4 | 各 overall 既有 bold-flat 标记按类型升秩（facets `###`，决策留存 `###`，决策组/背书 `####`）· 逐字；另三份仅三 facets 升秩 |

tree-migration 扩展 pin：每块边行存在 · 19 份提秩文件 `####` 计数 + 标题逐字 · 全树独立 bold 伪标题零残留（严格 pattern grep 0）· 各 overall 既有 charter 标记升秩在位。48 文件树套件零排除绿保持。

#### 4.1 消费面同步

- 三 schema（plan.json / phase-spec.json / overall.json）description 更新：plan 边字段 mandatory + `none` 词法 + 第六类；spec designItems 叶规则；overall charter facets。SchemaFactory 派生 → 字节保真 diff 更新（P1 动线）
- cdd-plan / cdd-dev SKILL 撰作面：两边行必带（`none` 显式）· designItems `####` 撰作指导 · charter facets 指导 · plan-review 必答问题
- shipped 零程序历史：新描述面 zero P 编号/phase 叙事（grep pin 扩展，P3 教训）

### Acceptance criteria

- `- ` StructureRule 引擎驱动三类型结构判定：`docContractValidate` = 每类型一次 `runStructureRules`；`#skeletonFailures` / overall 四表审计 / plan 手写契约断言全部迁为规则集（迁移后旧手写遍历面零残留，grep 断言）
- `- ` `tree-migration` / `dual-read` 全树行走消费同一引擎（命中集 = 0 或 pin；内容保真逐字 pin 保留），48 文件树套件零排除绿
- `- ` 每 plan 任务块单边行存在（`DependsOn`: `none`/空/真实值合法）· 缺行 = plan validate BLOCK（missing-edge 第六 failure class 负例）· `none` 解析 → `[]` · 非法 token 保持 NaN 拒绝
- `- ` 反依赖门：`DependsOn` 仅可引用更小编号 · 引用 ≥ 自身 = BLOCK（`forward-edge-plan` 负例夹具断言）· 全树现有边核查零违规
- `- ` `Task.dependsOn` 非可选（缺省 `[]`）；`atomicWith`/`taskGroups` 声明面全树退役零残留（读取面 · 对称闭包 · schema 字段 · 夹具 · pins · SKILL 双边描述 grep 零命中）
- `- ` TaskGraph `batches()` 波次推导：P3.1 raise-specs 波次拆分断言（如 T3‖T4‖T5 同波次）· `effectiveGroups` 切波次消费（声明面退役）；`frontier(done)` 动态面可用（给定完成集 → 下一就绪波次）· `next:` 组间 default = 同环优先 ∧ frontier（skills 编排精简依据）
- `- ` 技能编排精简：cdd-dev flow loop 判定（`more-groups?`/下一组）改为 `next:` 消费 · 异常/人工面保留（HARNESS_ABORT 恢复 · backfill 暂停 · adjudication 覆盖 · Plan Sole Writer）· SKILL 文本 English-primary 零程序历史
- `- ` 全树 design specs：`####` items 计数 + 标题逐字 pin · 空体/hollow 零 · 独立 bold 行伪标题零残留（pattern grep 0）
- `- ` 全树 overalls：各 overall 既有 charter 标记升秩在位（doc-arch overall：facets + 决策留存 `###`、决策组/背书 `####`；另三份：三 facets `###`）· 法外零残留
- `- ` `cdd implement` / `cdd review` pre-flight 走 docContractValidate 覆盖全部新规则（dry-run 负例断言）
- `- ` 引用 lint WARN 有断言 + 负例（窄化 pattern 按 §2.3 定稿）：明文 `Task 3`/`T3` 无边 → WARN（每块至多一条）；code span 内 `T3`、`files` 面参照、越界 N（0 或 > taskCount）、已声明边 → 零 WARN
- `- ` 消费面：三 schema description 更新派生产物字节保真 · cdd-plan/cdd-dev SKILL 撰作面更新 · shipped 零程序历史 grep pin（扩展面）零命中
- `- ` changesets（cdd-engine minor + kairos patch）· validate ALL PASS（engine suite + 树套件 + typecheck ×3 + biome + emit freshness）
- `- ` 死壳零残留：迁移/引擎面退役符号 · 废弃夹具 · 空壳叶 · 未解析 text 面 grep 零命中；存量 plan 未解析 steps 面规范化后全解析（每步 `N. … — checkable:` 含 checkable）

## Constraints

- 全树迁移只动容器、内容逐字：边行/叶秩属容器面，任务 objective/验收/步骤/约束原文逐字不动；`§`/编号等标题原文逐字保留（0 retro-edit 历史正文——整体约定的消除面：历史正文不受迁移写回）
- 「独立 bold 行」伪标题 pattern = 行首 `**` 且行尾仅空白；行内 lead-in bold 散文合法（不强制提秩）
- 统一引擎边界：graph 科学（环/矛盾/拓扑/原子闭包）留 TaskGraph，不改动；跨文档链（Class-A/B lineage · resolveSpecFromPlan · phaseIdForDispatch）留 P5，本次不并入
- bodies load-order 安全：规则数据在 body 叶（惰性数据）、解释器在 `rules/structure.ts`；bodies 零解释器反向 import（tokens.ts 环链不破）
- 消费面零程序历史：shipped SKILL/schema 描述面 zero P 编号/phase 叙事（grep pin 扩展）
- 死代码/空壳全平面清理（Standing 铁律 · P3.1 补充条例 2026-10-06）：迁移与引擎任务先删后验——退役符号、废弃夹具、空壳叶、未解析 text 面零残留进任务验收；存量 plan 未解析 steps 面（`- [ ]` 散文行）在 T3 规范化 `N. … — checkable:`（死壳清理）

## Notes for downstream

- **P4（cdd-doc-review 一产化）**：plan-review 必答问题机制（F5 兜底）落位在本 phase 消费面；P4 的 cdd-doc-review 评审轴应将「边完备 + 登记叶结构」纳入 URC 检查面
- **P5（DispatchContract/DispatchPacket）**：本 phase 声明「跨文档链不并入」；group-next 段已交还本 phase（§2.6 frontier 落地）；P5 承接时，StructureRule 的 crosslink 不变式可作 doc-revision 底座，graph-node ref 以本 phase `frontier(done)` 为消费底座（TaskGraph 状态机动态面）
- **P6（宪法/档案分层）**：本 phase 只做结构秩不动分层；P6 承接已秩化的 charter 底座 + OverallDocBody 三件套做宪法化与 issue/history 归档
- **P7（token 翻译）**：DOC_TOKENS 新增叶切片（designItemHeading / charterFacets）随本 phase 进 token 面，P7 翻译层承接
