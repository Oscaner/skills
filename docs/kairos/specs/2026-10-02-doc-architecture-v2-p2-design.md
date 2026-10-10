# Doc Architecture v2 P2 — 文档平面瘦身（Doc Architecture v2 P2: Doc-Plane Slimming）— Phase Spec

- **Version**: v1.1 · 2026-10-05
- **Status**: Draft
- **Author**: [human] · Claude Opus 5 (1M context)（kairos:cdd-design → grilling → cdd-phase）
- **Parent program**: [2026-10-02-doc-architecture-v2-overall.md v1.3](2026-10-02-doc-architecture-v2-overall.md)
- **Depends on**: P1（shipped · [p1-design v1.1](2026-10-02-doc-architecture-v2-p1-design.md) · plan v1.1 · 实现 T1–T7 merged #315）

## Design
### 2. 文档平面瘦身设计
#### 2.1 目标与范围

P2 把文档平面的「样板散文增生 + 结构知识三面无统一抽象 + Task 散文面」归零：phase-spec 六段五样板（E2）→ 三真骨架 + 条件元数据；plan 约束再述（E3）→ delta-only；Task Do 长散文 + brief 散文雕刻（E4）→ Task 数据化渲染；schema/解析/渲染的结构知识手写重复（E6 doc 结构翼）→ DocBody 类型化正文模型单源派生。

**范围**：`DocBody` 类型化正文模型（phase-spec / plan 两具体型 + 共享原子）· phase-spec 三真骨架（`## Design` 含唯一 `### Acceptance criteria` + `## Constraints`）+ 条件段（`dependentRequired` 判据）· `Task` 类 `{objective, files[], interface{consumes,produces}, steps[]{action,checkable}, acceptance[], dependsOn?, atomicWith?}`（`dependsOn?`/`atomicWith?` = P3 扩展位零消费）+ brief 数据渲染 · 约束继承 delta-only 机器面（读 + 合并呈现）· shape 域投影重派生（DocBody.projectSchemaShape() → DocType.shape → SchemaFactory；diff 钉 deliberate update）· plan parse/validate 重接 · legacy 双读 · SKILL 文案同步 · fixtures 实证。

**范围外（零越界线）**：P3 TaskGraph 边模型（`depends_on`/`atomic_with` 只在 Task 模型留扩展位）/ `## Task Groups` 字面段删除 / 图性质 BLOCK 不实现；P5 DispatchPacket（约束 join/子集过滤 / InstructionUnit / ref 统一）不实现——P2 机器面止于「读整体约束 + delta 合并呈现」；P4 `cdd-doc-review` 与 acceptance 机械化判定不实现——P2 只定义 acceptance claim 形态（`Task.acceptance[]` 数据面 + phase-spec acceptance code-span 条件句）；overall schema 零触碰（宪法层归 P6）；doc 文件路径面零触碰；P2 自身 spec/plan 按当前规范形（Section 0–5 / Form A）书写（Q6 过渡定案）。

#### 2.2 锚点（grilling 定案，本 phase 会话六轮裁决）

| 锚点 | 定案内容 |
|---|---|
| Q1 | **P2 破坏性授权复确**（2026-10-05 用户拍板）：允许重写代码 / 重组目录——高维思考 / OOP 抽象统一 / 最佳实践 / 零技术债务（overall P1 授权同口径，P2 会话开线时复授） |
| Q2 | **统一抽象 = DocBody 全模型派生**：手写同构 SchemaShape 常量 → DocBody 模型投影；样板散文收敛为 field `description` 单源；schema / 解析切片 / 渲染三面同一模型派生（E6 根治面）；doc 文件路径面零触碰 |
| Q3 | **三真骨架 + 条件段**：`## Design`（含唯一 `### Acceptance criteria`）+ `## Constraints` 常设；约束指针语义并入 `## Constraints` 继承点（非条件段）；条件段 = 增量警告 / 偏差 / 下游注 / 评审记录四类 → 条件元数据（条件成立才落盘，else 零残留段）；判据 = schema `description` + `dependentRequired`/`if-then`，docContractValidate 断言 |
| Q4 | **Task = 类型化数据**：`{objective, files[], interface{consumes,produces}, steps[]{action,checkable}, acceptance[], dependsOn?, atomicWith?}` 一等模型（`dependsOn?`/`atomicWith?` = P3 扩展位零消费）；`### Task N:` = 渲染面（连续编号契约保持）；`- **Do**:` 拆分 → objective + steps；brief/task-handoff = Task → 渲染（零散文雕刻）；files/interface = P5 同源字段 |
| Q5 | **delta-only 机器面边界**：新 plan `## Constraints` 仅 delta；宪法 auto-applies；P2 机器面 = plan-parse 读 parent overall 约束 + delta 合并呈现 + schema 禁 Form B（新 doc）· legacy Form B 双读；join/子集过滤 = P5 零越界 |
| Q6 | **自身 doc 过渡**：doc-contract gate 是 base dispatch 共享面（spec 评审即跑），新骨架在 P2 implementation 后才存在 ⇒ P2 spec/plan 按当前规范形（Section 0–5 / Form A）书写（评审 gate 顺绿 · document era 即史实）；新骨架实证 = engine fixtures（新形 spec/plan fixture 过 validate + SchemaFactory 派生产物断言）+ tests；首个真实采用 = P3 起的 phase 文档 |

#### 2.3 现状与收敛面（E 组经验债 P2 面归零清单）

| # | 债面 | 现状锚点 | 收敛方向 |
|---|---|---|---|
| E2 | phase-spec 六段五样板 | `config/schema/phase-spec.json` sections 六常设段（Section 0–5 字面 heading） | 三真骨架 + 条件段（`dependentRequired` 判据）；样板散文 → DocBody field `description` 单源 |
| E3 | plan 约束再述 | `plan.json` constraints Form A `## Constraints` / Form B 四散文指针 + per-plan 复述宪法 | delta-only（宪法 auto-applies）；Form B 新 doc 禁、legacy 双读 |
| E4 | Task Do 长散文 + brief 雕刻 | `plan.json` taskBlock `- **Do**:` / `- **验收**:` prose + task-handoff materialize 逐字搬 | `Task` 类数据化；objective + steps（action+checkable）；brief = 数据渲染（零雕刻） |
| E6（doc 结构翼） | schema / 解析 / 渲染三面结构知识手写重复（= overall E6 同源债的正文结构残余） | `doctypes/shapes/*.ts` 手写同构 SchemaShape + `plan.ts` 手写切片提取器 + body-views reviews | `DocBody` 模型单源 → 三面投影派生 |

**E 组编号口径（overall Maintenance 一致性）**：本表 E6（doc 结构翼）= overall E6「schema/template-contract/lexicon 三面无统一抽象」的正文结构层残余——P1 已在 DocType 层面完成 schema 工厂 / words·lexicon / bodyView 分型收编，phase-spec/plan 正文结构知识仍手写重复于 schema 投影源 / parse 切片 / render bodyView 三面，为同一 E6 债的 **P2 收尾面，非新观察债** → 不按 overall Maintenance 新增回填（E8 不启用），E 组编号沿用 overall E6 可追溯；Section 3「无需 overall 回填」论断与本脚注自洽。

**既有健康面（不拆不改）**：detect 特征（phase-spec = `-design.md` basename + `**Version**` 行 · plan = `### Task N:` 连续标题——新形不触碰，改名零影响）；SchemaFactory 派生管道与 diff 钉机制（投影源升级、钉 deliberate update 登记）；legacy 六段 / Form B 的 validate / parse；`cdd schema get` 五型门；overall schema（P6 宪法层面）；`infra/word-table.ts` 消费路径。

#### 2.4 设计

**C1 `DocBody` 类型化正文模型**（`src/documents/doctypes/body/`，类 + 构造注入）——doc 正文结构知识单源：
- `abstract DocBody`：`projectSchemaShape()`（shape 域投影源——**唯一契约链：DocBody.projectSchemaShape() → `DocType.shape` 重派生 → SchemaFactory → `config/schema/{phase-spec,plan}.json`**；`deriveDocTokens` 续接 `DocType.shape` live 派生（P1 S8），DOC_TOKENS 生产值随 shape 域内容变更以 deliberate update 重 pin（字节保真指渲染面，token 面变动由 tokens.test 钉断言））· `projectSlicePatterns()`（parse 切片正则面单源）· 字段 `description` 即样板散文单源（消费方读 DocBody 即读法）
- `PhaseSpecBody`：`header`（`**Version**` / `**Status**` / `**Author**` / `**Parent program**` / `**Depends on**` 五元——`version` 入模型，`**Version**` 行保留：detect 特征与 backfill-as-version / R2 doc-revision versionToken 均锚在此行上；版本行 lineage 散文消解归 P6 E7）；常设字段 `design` / `acceptance[]` / `constraints[]`；条件字段 `deviations?` / `incrementalWarning?` / `downstreamNotes?` / `reviewRecord?`（`dependentRequired` 判据 + description 人话判据）
- `PlanBody`：`header`（`**Version**` · `**Spec:**` / Parent program / Depends on / Base——`**Version**` 行保留同规，代入 `version` 字段）/ `constraints`（delta-only）/ `tasks[]: Task` / `taskGroups?`（P3 扩展位）
- 派生面：shape 投影（→ `DocType.shape` 重派生 → SchemaFactory，`config/schema/{phase-spec,plan}.json` 规范产物，deliberate update + 新 diff 钉）· 切片投影（plan task 块 / Form A 约束提取单源）· 渲染投影（brief/task-handoff = Task→渲染）

**C2 phase-spec 三真骨架 + 条件段**——新 phase-spec 文档：元数据头（`**Version**` / `**Status**` / `**Author**` / `**Parent program**` / `**Depends on**` 五元保留，映射 `PhaseSpecBody.header`；`**Version**` 行必在位——detect 特征 / backfill-as-version / R2 versionToken 的锚行，见 C1）+ `## Design`（含唯一 `### Acceptance criteria`）+ `## Constraints`（继承点 + 约束指针语义合入）；条件段：`增量警告`（condition = 有 increment 边界跨越声明）· `偏差`（condition = 有 cross-phase divergence，`Overall updated?` 必 `Yes`）· `下游注`（condition = 有下游 phase 交接 note）· `评审记录`（condition = 有评审结论要记录）；condition=false → 该段零存在（样板零残留）。enforcement = `PhaseSpecBody` schema 投影携带 `dependentRequired`/`if-then`，docContractValidate（`DocType.validate`）断言**段落存在的结构性后果**（装饰段落盘 ⇒ 其结构必带标记，如 `Deviations` 段存在而 `Overall updated?` ≠ `Yes` → fail）；零残留段（condition=false 缺段 → 绿）为段落存在性断言、机器可达——「语义性 condition 为假却落装饰段」不机器判（condition 真假由作者声明 / Q3 description 人话判据，schema 只强制存在性后果）。

**C3 `Task` 类 + 数据渲染**——`Task{objective, files[], interface{consumes,produces}, steps[]{action,checkable}, acceptance[], dependsOn?, atomicWith?}`（`dependsOn?` / `atomicWith?` = P3 扩展位字段面——与 `taskGroups?` 同规，P2 零消费、仅形状声明，见 Section 4 P3 附注）：
- `### Task N:` = PlanBody 渲染面——连续编号契约（extractTaskNumbers 语义 `1..N` 不变）保持
- `- **Do**:` 拆分 → `objective`（单行目标）+ `steps[]`（逐行 `action` + `checkable`）；B5 step checkable 类型约束 = schema 校验（缺 checkable → validate fail，非作者自觉）
- brief/task-handoff（`task-handoff-schema` materialize）= Task → 渲染函数（零散文雕刻；`- **验收**:` → `acceptance[]` code-span bullets 面，消费等价保持）

**C4 约束继承 delta-only 机器面（plan / phase-spec 双侧对称）**——**新 plan `## Constraints` 仅 delta**：宪法 auto-applies = plan-parse 读 parent overall 约束 + delta 合并呈现（`extractPlanConstraints` Form A 路径升级）；schema 禁 Form B 于新 doc（docContractValidate 断言）。**新 phase-spec `## Constraints` 同规 delta-only**：约束指针语义并入继承点——父整体约束 auto-applies、新 spec `## Constraints` 仅留自持 delta + 指针（现状 Section 1「仅指针不重复表述」惯例机械化）；读路径 = spec-parse 沿 Class-B `Parent program` 链（`resolveParentOverall` 复用）读父整体约束 + delta 合并呈现，供 review/validate gate；docContractValidate 断言继承点：`## Constraints` 的 Parent program 指针目标可解析为父 overall（Class-B 现断言升级面）· 指针 + 自持 delta 为落盘形态——正文语义级「再述宪法」不机器判（见 2.6 结构规则边界）。legacy Form B / 旧六段双读保持（既有 P1 文档可消费）；join/子集过滤 = P5 零越界。

**C5 引擎接线 + 双读**——shape 域投影重派生（DocBody.projectSchemaShape() → `DocType.shape` → SchemaFactory：`config/schema/{phase-spec,plan}.json` deliberate update——P1 旧 diff 钉退役登记 + 新 golden 钉）；plan parse/validate 重接（task 块提取 Do→objective/steps/checkable · 约束提取 Form A+宪法合并）；detect 零触碰；DOC_TOKENS / 词表续接 `DocType.shape`（P1 T7 live 派生面不变，shape 域内容随投影更新 → deliberate update 重 pin）；bodyView 评审轴同步（plan decomposition 轴吃 `interface{consumes,produces}`）；legacy 六段 / Form B 双读契约（validate 双接受 + parse 双路径）。

**C6 过渡 + 交割面**——P2 自身 spec/plan 按当前规范形（Section 0–5 / Form A）写成（史实 era 形，评审 gate 顺绿）；新骨架实证 = engine fixtures（新形 phase-spec / plan fixture 过 docContractValidate + SchemaFactory 派生产物断言）+ tests；首个真实采用 = P3 起文档；旧文档零批量迁移——渐进交割触发点 = 每份旧文档下次被 phase/cdd 流程触碰时按新形重写（读者双读 · 写者新形）。

**C7 消费连带**——SKILL.md（cdd-spec / cdd-phase 骨架指导语 English-primary 随新骨架同步——六段描述改三真骨架 + 条件元数据）；skill-anatomy heading registry（若 anatomy schema 引 heading 名则登记新段）；docs/maintainers 01-template-doctrine（doc 结构面随行）；changesets（`@oscaner-skills/cdd-engine` 重构面 + kairos 文案面视变）。

#### 2.5 数据流（doc 结构知识单源 → 三派生面）

```
DocBody 模型（PhaseSpecBody / PlanBody）---+--project---> DocType.shape（shapes 域重派生）---> SchemaFactory ---> config/schema/{phase-spec,plan}.json（派生 · deliberate update · 新 diff 钉守卫）
                                           |                        └── 消费者（零变动）：deriveDocTokens（DOC_TOKENS live 派生）· cdd schema get · DocumentsValidator
                                           |--project---> parse/slice patterns（plan task 块 · Form A 约束提取单源）
                                           |--render-----> brief / task-handoff（Task → 渲染，零散文雕刻）
宪法（parent overall）--- plan-parse / spec-parse 读 + delta 合并 ---> 约束呈现（delta-only · C4 双侧）
bodyView（reviews.plan decomposition 轴）<--- interface{consumes,produces} 字段源
```

#### 2.6 错误处理

- `Task.steps` 缺 `checkable` → schema 校验 fail（B5，validate 期拦，非作者自觉）
- 新 doc 出现 Form B 约束散文指针 → docContractValidate fail（禁；legacy 双读豁免旧文档）
- 装饰段落盘而缺结构性必带标记 → validate fail（如 `Deviations` 段存在而 `Overall updated?` ≠ `Yes`——结构规则：schema `dependentRequired`/`if-then` 只断言段落存在的结构性后果；「语义性 condition 为假却写段」不机器判——condition 真假由作者声明 / Q3 description 人话判据）· condition=false 零残留段 → 绿（段落存在性断言，fixture 正向实证）
- legacy 形无法 parse/validate → validate fail（双读契约破 = 缺陷，不静默退化）
- diff 钉 / 字节断言破 → deliberate update 审查登记（P1 漂移纪律：意向变更登记放行 · 非意向漂移拦截）

#### 2.7 测试

- **新形 fixtures**：新 phase-spec fixture（三真骨架 + 条件段正反例 ×2：condition=true 落盘 ✓ / condition=false 零残留段 ✓）过 docContractValidate；新 plan fixture（Task 数据化）parse + brief 渲染断言
- **双读契约**：legacy 六段 spec / Form B plan fixture 仍过 validate + parse（既有 18 design + 19 plan 树零改动实证）
- **约束合并（plan / spec 双侧）**：plan-parse 宪法 + delta 合并断言（auto-applies）+ 新 doc Form B 禁断言；spec-parse 沿 Parent program 读父整体约束 + delta 合并呈现 + 继承点指针目标解析断言
- **step checkable**：缺 checkable fixture → fail 断言
- **shape 投影**：DocBody → DocType.shape 重派生 → SchemaFactory 产物 diff 钉 deliberate update（新 golden 断言 · 字节保真渲染面保持）；tokens / 词表续接 DocType.shape、随 shape 域内容变更重 pin
- **bodyView**：plan decomposition 轴断言吃 `interface{consumes,produces}`
- **回归**：`pnpm run validate` 全块全绿（新守卫在内）· typecheck 三项目绿 · biome clean · emit 新鲜 · zero-residue guard

本 phase 无 cross-phase 偏差——grilling 定案（Q1–Q6）全部落在 overall 已注册的 P2 scope / acceptance 语义内（F3 骨架 / F4 delta-only / F5 Task 数据 / B5 step 类型约束 / 旧文档渐进迁移交割），实现级细化（DocBody 投影源升级、条件段判据形态、自身 doc 旧形过渡）随本 spec 生效，不涉跨 phase 约定变更，无需 overall 回填（2.3 表 E6（doc 结构翼）= overall E6 同源债的正文结构残余、非新观察债，E 组编号可追溯——见 2.3 脚注）。P1 的 shape 派生源升级（手写同构 SchemaShape 常量 → DocBody.projectSchemaShape() 模型投影重派生 shape 域）为产物面等价：`config/schema/*.json` 仍由 SchemaFactory 派生（源 = DocType.shape 重派生内容）、diff 钉机制保持（钉值 deliberate update）。

### Acceptance criteria

- 新 phase-spec 骨架被 docContractValidate 接受：元数据头五元（`**Version**` 行在位——detect 特征 / backfill-as-version / R2 versionToken 锚）+ 三真骨架（`## Design` 含唯一 `### Acceptance criteria` · `## Constraints`）fixture 绿；条件段正反例 fixture（condition=true 落盘 / condition=false 零残留段）断言通过（零残留段 = 段落存在性断言、机器可达；「语义性 condition 为假却落段 → fail」不机器判，schema 只断言结构性后果）
- plan Task 数据化：`Task{objective, files[], interface{consumes,produces}, steps[]{action,checkable}, acceptance[], dependsOn?, atomicWith?}` fixture parse 全绿（`dependsOn?`/`atomicWith?` = P3 扩展位字段面、零消费）；brief/task-handoff = Task 数据渲染零散文雕刻（新形 fixture 零 `- **Do**:` 面）
- step checkable 类型约束：缺 checkable 的 steps fixture 断言 fail（schema 校验）
- 约束继承 delta-only（plan / phase-spec 双侧）：新 plan `## Constraints` 仅 delta + plan-parse 读整体约束 + delta 合并断言（宪法 auto-applies）+ 新 doc Form B 禁断言；新 phase-spec `## Constraints` 同规 delta-only + spec-parse 沿 Parent program 读父整体约束 + delta 合并呈现断言（继承点指针目标解析）；legacy Form B / 旧六段双读保持
- shape 域投影重派生：DocBody.projectSchemaShape() → DocType.shape → SchemaFactory，`config/schema/{phase-spec,plan}.json` 为派生产物；diff 钉 deliberate update 登记（新 golden 断言 · 字节保真渲染面保持）· deriveDocTokens 续接 DocType.shape（P1 T7 live 派生面不变；DOC_TOKENS 生产值随 shape 域内容变更以 deliberate update 重 pin，token 面变动由 tokens.test 钉断言）
- 双读契约：legacy 六段 spec / Form B plan fixture 仍过 validate + parse；既有 18 design + 19 plan 文档树零改动（validate 全绿）
- DOC_TOKENS / 词表续接 DocType.shape（P1 T7 live 派生不变；shape 域内容随投影更新 → 重 pin + deliberate update 登记 · validate 全绿）
- bodyView 评审轴同步：plan decomposition 轴引用 `interface{consumes,produces}` 新字段（body-views.ts 更新 + 断言）
- P2 自身 spec/plan 按当前规范形（Section 0–5 / Form A）写成且过 doc-contract validate（评审 gate 绿）
- skill 连带：cdd-spec / cdd-phase SKILL.md 骨架指导语同步新骨架（English-primary）；skill-anatomy registry 新段登记同步（validate 全绿）
- 零越界执行：P3 边模型 / P5 DispatchPacket join / P4 acceptance 机械化面零实现（代码面零 `depends_on`/`atomic_with` 新增消费——`dependsOn?`/`atomicWith?` 仅字段面声明、零读写）
- `pnpm run validate` 全块全绿（新守卫在内）· typecheck 三项目绿 · biome clean · emit 新鲜 · changesets（cdd-engine + kairos 视文案变面）

## Constraints

- 跨 phase 约定以 parent overall v1.3 为准（overall wins on conflict），本 phase 不重复表述，仅指针：
- **破坏性变更授权 + 空壳死代码即删（overall Constraints，2026-10-02 拍板；2026-10-05 P2 会话复确）**：允许重写代码 / 重组目录——约束 = 高维思考 / 抽象统一（OOP）/ 确保最佳实践 / 零技术债务；空壳、死代码、已废面即删不留残壳
- **Criterion ②（零裸函数）延续**：所有新抽象（`DocBody` 类族 / `Task` 模型）以类 + 构造注入落地；本 phase 的收敛落点 = 手写同构 SchemaShape 常量与散装解析切片收编为 DocBody 实例方法/投影
- **对象 word = ref word（DocContract 同契约面）**：`Task.files/interface` 字段类型化即 P5 DispatchPacket 的同源字段（零手写重复映射）；token 面（DOC_TOKENS / 词表）随 shape 变更重 pin
- **尽量复用上游规则（fit 判定）**：文档结构平面无上游 fit（cdd-doc-review 一产化先例 M4b 不动），不引 upstream skill
- **消费者链渐进兼容 + 历史零 retro-rename**：doc 文件路径面零触碰（`docs/kairos/specs|plans/*` 文件名契约与 detect 特征不动）；legacy 六段 / Form B 双读保持；既有 18 design + 19 plan 文档树零改动
- 方法论文档 = 中文（Strategy B 内部 docs）；消费面 skill 文本 = 英文主源（Strategy A）——本 phase 的 SKILL.md 骨架指导语随新骨架同步（English）
- 开发期引擎直调 `node packages/cdd-engine/src/bin.ts`（零构建 dev face）；`fnm use`（.nvmrc）；引擎零 `.mjs` 平面 + 测试 colocated vitest；三项目 typecheck 绿；changeset/commit 纪律不变

## Notes for downstream

- **P3（TaskGraph 分组派生）**：`Task` 模型留 `depends_on` / `atomic_with` 扩展位（C3 数据形已声明 `dependsOn?`/`atomicWith?` 字段面，本 phase 零实现零消费）；`## Task Groups` 字面段删除 + 无环/union/闭包 BLOCK 归 P3；P3 图边直接消费 P2 的 task 数据面
- **P4（cdd-doc-review 一产化）**：读 acceptance claim 形态——P2 定型 = phase-spec `### Acceptance criteria` code-span 条件句 + `Task.acceptance[]` 数据面；P4 依赖 P2 的文档瘦身面（acceptance claim 机械化判定留 P4）
- **P5（DispatchContract + DispatchPacket）**：`Task.files/interface` 类型化字段 = P5 同源数据（object word = ref word 零手写重复映射）；约束继承 P2 只做「读 + 合并呈现」，P5 做「子集过滤 + 正文携带」（DispatchPacket）；refKind 四型 / InstructionUnit 落 P1 接缝槽
- **P6（overall 宪法/档案分层）**：overall schema 本 phase 零触碰（宪法层归 P6）；add-phase-protocol 手写 JSON 保持（D6 语义）；archive doc-revision ref 依赖 P1 refKind 接缝——与 P2 无接
- **派生面纪律**：`config/schema/{phase-spec,plan}.json` 自 P2 为 DocBody 投影重派生产物（DocBody.projectSchemaShape() → DocType.shape → SchemaFactory）——任何手写编辑 = 下一投影/守卫覆盖；改结构走 DocBody 模型描述（与 01-template-doctrine 模板数据化公约同源）

## Change history

| Version | date | summary | author |
|---|---|---|---|
| v1.1 | 2026-10-05 | （迁移建档——版本谱系自 `**Version**` 头转录 · 原头未载变更摘要） | [human] |
