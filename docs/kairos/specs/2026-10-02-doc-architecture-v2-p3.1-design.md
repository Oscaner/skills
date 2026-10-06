# 文档架构方法论 v2 —— P3.1 Design

- **Version**: v1.2 · 2026-10-06
- **Status**: Draft
- **Author**: [human] · Claude Opus 5 (1M context)（kairos:cdd-design → grilling → cdd-phase）
- **Parent program**: [doc-architecture-v2-overall.md v1.9](docs/kairos/specs/2026-10-02-doc-architecture-v2-overall.md)
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

#### 2.3 登记叶 ①：plan 边完备（F1/F5）

- **词法**：`- **DependsOn**:` / `- **AtomicWith**:` 每 task 块必带两行；值 = 显式 `none` / 空 / 逗号表正整数（`1, 2`）。`none` 与空 → `[]`；**其余 token 保持 integer-gate NaN 拒绝**（plan.ts:305-330 扩展）
- **缺行 = 第六 failure class `missing-edge` · BLOCK**（与 orphan-task-block 并列的完备性失败）
- `Task.dependsOn / atomicWith` **非可选化**（缺省 `[]`）；PLAN_BODY_SHAPE task record `required` += 两字段；task.test.ts absent-default pin 退役
- **引用 lint**（WARN，pattern 按此定稿）：扫描面 = `objective`/`acceptance` 明文——`files` 面、`steps` action 与 code span 不计（路径声明、动作/代码引用不构成依赖宣告）；token = `\bTask\s+([1-9]\d*)\b` 或 `\bT([1-9]\d*)\b`（须词边界，防命中 `README` 类词）；N 越出 [1, taskCount] → 不计（跨文档/笔误豁免）；判定 = 逐 task 块对在界 N 去重后逐 N 检查，N ≠ i 且 N ∉ 本块 `DependsOn`/`AtomicWith` 声明集 → 该块一条 WARN「疑似缺边」（一任务块至多一条，聚合多个嫌疑 N）；兜底不变 = cdd-plan/cdd-dev 撰作面必答问题「两边行已在位、无遗漏边」

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

#### 3.1 全树文档迁移（F7）

一次全树、机器 pin 兜底：

| 面 | 数量 | 迁移 |
|---|---|---|
| plans 边行 | 22 plans / 214 task 块 | 每块补两行（真实值或 `none`）；4 plan 既有 atomicWith 值保留 |
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
- `- ` 每 plan 任务块两边行存在（`none`/空/真实值合法）· 缺行 = plan validate BLOCK（第六 failure class 负例）· `none` 解析 → `[]` · 非法边 token 保持 NaN 拒绝
- `- ` `Task.dependsOn / atomicWith` 非可选（缺省 `[]`）；PLAN_BODY_SHAPE required 含两字段
- `- ` 全树 design specs：`####` items 计数 + 标题逐字 pin · 空体/hollow 零 · 独立 bold 行伪标题零残留（pattern grep 0）
- `- ` 全树 overalls：各 overall 既有 charter 标记升秩在位（doc-arch overall：facets + 决策留存 `###`、决策组/背书 `####`；另三份：三 facets `###`）· 法外零残留
- `- ` `cdd implement` / `cdd review` pre-flight 走 docContractValidate 覆盖全部新规则（dry-run 负例断言）
- `- ` 引用 lint WARN 有断言 + 负例（窄化 pattern 按 §2.3 定稿）：明文 `Task 3`/`T3` 无边 → WARN（每块至多一条）；code span 内 `T3`、`files` 面参照、越界 N（0 或 > taskCount）、已声明边 → 零 WARN
- `- ` 消费面：三 schema description 更新派生产物字节保真 · cdd-plan/cdd-dev SKILL 撰作面更新 · shipped 零程序历史 grep pin（扩展面）零命中
- `- ` changesets（cdd-engine minor + kairos patch）· validate ALL PASS（engine suite + 树套件 + typecheck ×3 + biome + emit freshness）

## Constraints

- 全树迁移只动容器、内容逐字：边行/叶秩属容器面，任务 objective/验收/步骤/约束原文逐字不动；`§`/编号等标题原文逐字保留（0 retro-edit 历史正文——整体约定的消除面：历史正文不受迁移写回）
- 「独立 bold 行」伪标题 pattern = 行首 `**` 且行尾仅空白；行内 lead-in bold 散文合法（不强制提秩）
- 统一引擎边界：graph 科学（环/矛盾/拓扑/原子闭包）留 TaskGraph，不改动；跨文档链（Class-A/B lineage · resolveSpecFromPlan · phaseIdForDispatch）留 P5，本次不并入
- bodies load-order 安全：规则数据在 body 叶（惰性数据）、解释器在 `rules/structure.ts`；bodies 零解释器反向 import（tokens.ts 环链不破）
- 消费面零程序历史：shipped SKILL/schema 描述面 zero P 编号/phase 叙事（grep pin 扩展）

## Notes for downstream

- **P4（cdd-doc-review 一产化）**：plan-review 必答问题机制（F5 兜底）落位在本 phase 消费面；P4 的 cdd-doc-review 评审轴应将「边完备 + 登记叶结构」纳入 URC 检查面
- **P5（DispatchContract/DispatchPacket）**：本 phase 声明「跨文档链不并入」；P5 承接时，StructureRule 的 crosslink 不变式可作 doc-revision / graph-node ref 的底座；graph-node ref 的边完备前提由本 phase mandatory edges 落地
- **P6（宪法/档案分层）**：本 phase 只做结构秩不动分层；P6 承接已秩化的 charter 底座 + OverallDocBody 三件套做宪法化与 issue/history 归档
- **P7（token 翻译）**：DOC_TOKENS 新增叶切片（designItemHeading / charterFacets）随本 phase 进 token 面，P7 翻译层承接
