# 引擎文档工具（Engine Doc-Tooling）— P2 Design Spec（schema gen 模板写作）

- **Version**: v0.1 · 2026-10-11
- **Status**: Draft
- **Author**: [human] · Claude Opus 5（kairos:cdd-design [P2] enumerate-then-grill 定案 → cdd-spec-writer）
- **Parent program**: [2026-10-10-engine-doc-tooling-overall.md v1.1](docs/kairos/specs/2026-10-10-engine-doc-tooling-overall.md)
- **Depends on**: 依赖升级与 src 更名程序 P2（改名 → `src/` 树 · hard · cross-program pin——实现落改名后树）；本程序 P1（review-face overall 键）‖ P2 并行无硬依赖（父总体 Dependency graph · 执行串行按 closeout 序）

## Design

本 phase 为写侧能力缺口收口：新增 **`schema gen <type>`**（schema 动词下第二个 leaf · stdout 纯渲染 · 骨架 = 从声明面派生的**完整结构** + 占位符槽位），消费面 author 节点（cdd-spec-writer / cdd-plan）从「schema get 参考 + 手工转写」切为「**先 gen 后填**」，并按 Q3→c 将 **CLAUDE.md 的 kairos/引擎流程叙述直接删除**。program 前提：六前提（① 破坏性重构许可 ② OOP 统一零裸函数 ③ 零技术债零散文堆砌 ④ 高内聚低耦合 · 死码/空壳全清 ⑤ 消费者心智负担优先 ⑥ 最大重构整合精简）在本 P2 所辖面内**全面生效**（Q2→b · Non-goal ④ 改写已落 overall v1.1）。全程 doc-contract 判定语义不变（gate 零例外 · 填后终判兜底）。

### 1. 现状与取证基线

#### 1.1 schema 动词现状（新 leaf 的接线面）

`schema` 动词已存在（`face/cli.ts`）：`CliVerb = implement | review | fix | schema | issue | base` · `CLI_USAGE.schema = "usage: cdd schema get <type>"` · 嵌套 leaf 面 = `CliLeafName` + `LEAF_COMMANDS`（现含 `base set|get` · `schema get` · `issue render`）· `#runSchema` 读 `parsed.positionals[0]`，`plan-graph` 特殊路由，其余经 `#docKeys` 校验后 `JSON.stringify(#projector.schema()[type])` 到 stdout（发现读 · 零 enforcement）。typeName 大小写坑实证：`schema get phase-spec` 报 unknown（合法键 = `overall/plan/phaseSpec`）——D3 记为本程序的同型面。**新 leaf 属既有动词面扩展，不是新顶层子命令**（「零新子命令」pin 的例外扩写语义 · CLAUDE.md pin 修订 §6.2）。

#### 1.2 Projector 投影面（派生的单一源）

`contract/project.ts`（T3）已把登记表（`contract/declare.ts` · overall 39 / plan 28 / phase-spec 25 元素——以 declare.ts 活登记表为准）派生为**五个投影面**：`shape`（按 home 分组的节骨架——段落结构的派生源）· `schema`（每型 JSON Schema）· `slices`（解析面）· `tokens`（锚词表）· `reference`（引用词表）。单一派生链 · 零手写形状散文 · 零重复数据；模块行为面 = `Projector` 类（zero-bare-function 纪律：模块级导出 = 类型/类）。**骨架结构与形状派生不需第二份定义**——`schema gen` 的骨架 = 从同一登记表新增一节投影，与 `schema get` 同源（D2「从声明面派生」· 第六前提最大精简）。

#### 1.3 消费面 author 现状（R4 的改写面）

- cdd-spec-writer `author-spec`：`npx -y @oscaner-skills/cdd-engine@latest schema get phase-spec` 读结构 → **手工转写**成 `## Design` 双层大纲 + `### Acceptance criteria` + `## Constraints`；交互自带自检（spec coverage + placeholder scan + type consistency）。
- cdd-plan `author-plan`：`npx -y @oscaner-skills/cdd-engine@latest schema get plan` 读结构 → **手工转写**成计划文档（任务头冒号式 · `## Constraints` · DependsOn 边）。
- 两节点现写法 =「schema get 参考 + 手工转写」，`###`/`##` 层级转写失误有席位——**P2 消灭的整类失误**（overall v1.0 Goal ④ · 结构 by construction 保真）。

#### 1.4 CLAUDE.md 现状（Q3→c 的删除范围）

CLAUDE.md 顶级节 = Repository purpose · ⚠️ emit products are derived · Key commands · Architecture · Conventions · Language policy。**kairos/引擎流程叙述块**（Q3→c 删除面）：`Architecture → Development-time CDD invocation`（dev face 直调 · 禁全局 cdd · 引擎 vitest 指引）· `Architecture → cdd CLI surface — zero new subcommands`（含「零新子命令」散文 pin · 本块与 §6.2 联动）· `Architecture → Engine tests`（引擎测试套件操作面）· `Language policy → Review convergence`（评审收敛规则指针——其单一来源本就在 kairos 编排器 SKILL.md，删除 CLAUDE.md 指针不损消费面）。repo dev 义务面（emit/validate/changeset 命令 · emit-derived 警告 · 语言政策 · Node.js 等）保留。无 script 对 CLAUDE.md 的 cdd 措辞有 pin（实测 `scripts/` 零命中）——删除不受门禁反制，但**「零新子命令」约束不随散文消失**（§6.2）。

### 2. `schema gen` CLI 面（Q1→a）

#### 2.1 leaf 注册

`schema` 动词下新增 `gen` leaf（接线面 = §1.1）：`CliLeafName` 扩 `"gen"` · `LEAF_COMMANDS` 加 `{ name: "gen", usage, description }` · `CLI_USAGE.schema` 更新为列两 leaf（`usage: cdd schema <get|gen> <type>`）· `#runSchema` 按 `parsed.leaf` 分派（`get` 走现状 → `gen` 走骨架渲染）。**零新顶层动词**——与「零新子命令」pin 语义一致（leaf 扩展，非动词面扩容）。word-face / channel audit guard 随新 leaf 词表同步（零回归 · §7.2）。

#### 2.2 类型词表（DocType 词表 · 不自造第二份列表）

`schema gen` 的 `<type>` 词表 = **declare.ts 的 DocType 字面量**（`overall | plan | phase-spec`——骨架的主题语义，非 JSON-schema 键名）。与 `schema get` 的 `#docKeys`（`overall/plan/phaseSpec`）**同源不同拼**——大小写坑（§1.1）在此**收口一次**：
- 主拼 = `phase-spec`（连字符 · DocType 字面量 · 与 gate 判定语义同一拼写）
- 别名面 = 接受 `phaseSpec`（`#docKeys` 现拼）→ 归一到 DocType，零 surprise（从 `schema get` 带来的消费者无缝切换 · 第五前提）
- 词表单一实现：`DocType` 联合 + 别名归一表一项（不是第二份手写列表 · 第六前提）
- unrecognized type → 与 `schema get` 同型 usage 错误（报可用 = DocType 词表 + 别名）

#### 2.3 输出合约（stdout 纯渲染 · 编排器落盘）

`cdd schema gen <type>` → **markdown 骨架到 stdout**，零写盘副作用（零 enforcement · 纯渲染 · 与 `schema get` / `issue render` 同本性）。**落盘由编排器承担**：`cdd schema gen phase-spec > docs/kairos/specs/2026-10-11-<topic>-p<N>-design.md`（Q1→a · 父总体 v1.1 D5）。消费面 author 指导语 = 「生成后重定向到目标路径，再在槽位填内容」——CLI 面最平、无 `--output` 参数面。骨架被多次 gen 无毒（幂等 · 结构 byte 确定——同型同源**同日/同调用上下文**重复 gen 输出全字节一致 · 日期格随运行日为真值 · §4.1）。

### 3. 骨架：完整结构 + 占位符槽位（Q1 延伸）

#### 3.1 派生（复用 shape 投影 · 无第二份定义）

骨架渲染 = `Projector` 新增 `skeleton` 投影（第六面）消费已有派生链：从登记表元素（anchor · presence · home · valuePattern）按 `shape` 的 home 分组序，为每个 **required** 元素生成结构件（标题树 · 表列头 + 最小行 · 脚手架 · link 形锚生成占位 link 行——§4.1），**optional/conditional 元素零生成**（conditional 条件不成立时不出现 = 零残留语义 · 与「conditional 零残留」契约同位）。模块归属：零裸函数纪律下作为 `Projector` 方法或 render 面类方法（设计选择：投影进 `contract/project.ts` 第六面 + `render/` 面加 `SkeletonAssembler` 类——派生与渲染分置 · 高内聚低耦合 · 与 `render/templates.ts` 的 TemplateAssembler 地位同位）。

#### 3.2 完整结构的构成（每个 required 元素齐备）

骨架不是「一行脚手架」，而是**可直接 fill 的完整结构**：
- 完整性口径：本节所列 = 各型 **required** 构成要点；完整 required 锚集 = declare.ts 活登记表 + `shape` 分组（引擎面单一权威 · §1.2）——骨架生成按登记表逐元素派生，本节约束其形态。
- 标题树：`# Title` +（对应型）`##`/`###`/`####` 全部 required 节头（phase-spec：`## Design` + `### N.` 一节 + `#### N.M` 一项 + `### Acceptance criteria`（含 `Acceptance entry`——`- \`` 条目脚手架）+ `## Constraints`（含 `Constraint delta bullet`——`- ` 条目脚手架）+ `## Change history`；overall：Document scope · File paths（含 `| Artifact | Path |` 列头 + 一行 row）· Program charter（`### Goal` `/### Non-goals` `/### Cross-cutting`）· Issue inventory（含列头 + 一行 row）· Phase inventory（含列头 + 一行 row）· Dependency graph（含 `P1 -> P3` 一类 hard edge + legend）+ `## Boundary rules` + `## Maintenance` + `# Title`/元信息头）
- **plan 骨架构成**（v0.1 缺 plan 型整段——§5.2 仅露数据字段名）：header 元信息行（`**Spec:**`——link 形锚 · 占位 link · label=basename 同一字面 · §4.1 · `**Parent program**`——link 形锚 · 占位 link · §4.1 · `**Version**` · `**Depends on**`/`**Base**`——可选 · 骨架零生成）+ `### Task N:` 任务块全字段（`**Objective**` · `**Files**`（含 `File path token`）· `**Consumes**` · `**Produces**` · `**Steps**`（含 `Step action`/`Step checkable`）· `**Acceptance**` · `**DependsOn**`（`DependsOn none`/`DependsOn id` 任选其一）· `Task id token`）+ `## Constraints`（含 `Constraint delta bullet`）+ `## Change history`
- 版本脚手架：`- **Version**: v0.1 · <date>`（**v0.1 起点裁定** · overall v1.1 已记 · `<date>` 仅记号示意——落盘为运行日真实日期 · §4.1）· 各型元信息行齐备（phase-spec 五元组：`**Version**` · `**Status**: Draft` · `**Author**: <slot>` · `**Parent program**`——占位 link · `**Depends on**`；plan 头：`**Spec:**`——占位 link · `**Version**` · `**Parent program**`——占位 link；overall 四元：`**Version**` · `**Status**` · `**Author**` · `**Constraints**`）——`<slot>` 等角括记号仅记号示意（非最终字节 · §4.1）
- change-history 首行：`| v0.1 | <date> | <slot: summary> | <slot: author> |`（首行脚手架 · change-history 列头 + 一行 · 版本行必须 = header 版本 · 保持 version-ascending 语义）——**最终字节**：`<date>` 格 = 运行日真实日期（`^\d{4}-\d{2}-\d{2}$` 判形 · §4.1）· summary/author 格 = `:::fill` 槽位（`<date>`/`<slot: …>` 仅记号示意 · 非最终字节）
- **槽位 = 占位符**：所有主体内容/description 落盘为占位符提示（§4），由编排器 fill（散文入槽位 · 不重排结构 · 结构保真 by construction）

#### 3.3 by-construction 过 gate

骨架完成后**即刻**过 doc-contract 判压零 finding（所有 required 锚齐备 · link 形锚以占位 link 落位 · 版本行/日期格为运行日真值 · 无 conditional 残留）——**未填即绿的范围与时序**：header link 行（`**Parent program**` / plan `**Spec:**`）由 gen 以占位 link 生成（§4.1——domain 判形命中 · target `<…>` 字面豁免链存在性判压）；纯内容槽位保持 `:::fill` 形态（在槽位 · 不伪作 required 锚值）不触发 finding；其余结构位未填即绿。colocated vitest pin：对每型骨架按 §4.1 分锚占位策略断言 doc-contract 绿（§7.2）。骨架不是 gate 豁免通道：**gate 零例外**——骨架 by construction 绿，fill 后 gate 仍终判兜底（overall Cross-cutting · 语义不变）。

### 4. 占位符与零残留 pin（Q1 延伸）

#### 4.1 占位符 token 形式（my call · 待 review 复核）

占位符 = **可见可 grep 的 slot 标记**，分锚两形（设计选择，review 可改）：
- **纯内容槽位**（节/表主体散文位 · meta 行值位 · 表行单元格内容位）：统一形式 `:::fill <slot-name>`——三冒号锚点（markdown 常规语法外 · 不歧义），slot-name 为语义名（如 `:::fill goal-description`）。
- **link 形锚槽位**（`**Parent program**` / plan `**Spec:**`——link 形 required 锚的值位）：用 **link 形占位**（占位 link）——label/target 取 `<…>` 字面（如 `- **Parent program**: [<parent overall>](<parent path>)`）：`<…>` 形 target 命中链判压的 placeholder 豁免（file-existence/sibling-scan · `^<[^>]+>$`）且整行匹配 link 形 valuePattern 判形；plan `**Spec:**` 另受 planChain「label == target basename」联立约束 → label 与 target 取**同一字面**（如 `**Spec:** [<spec path>](<spec path>)`）。**`:::fill` 永不落 link 形锚值位**——落则必产 finding（实证：`**Parent program**` 值位改 `:::fill …` 后 domain「value outside the declared domain」+ cross-doc-chain「carries no **Parent program** link」两 finding 同出；纯内容槽位的 `:::fill` 无 finding——问题精确限定于 link 形锚）。
- **结构位永远真值**：节头 · 列头不是槽——**占位符永不落结构位**。
**日期/版本格 = 生成器真值，非 fill 面**：`schema gen <type>` 无日期参数——版本行与 change-history 日期格由 gen 落**运行日真实日期**（判形 `v\d+\.\d+ · \d{4}-\d{2}-\d{2}` / `^\d{4}-\d{2}-\d{2}$` 必须真实命中）；spec/acceptance 行文中的 `<date>`/`<slot>` 等角括记号**仅记号示意，非最终字节**。

#### 4.2 零残留 pin

- **残留定义**：交付文档（a）`grep -rn ":::fill" <目标文件>` **零命中** 且（b）非豁免位 `^<[^>]+>$` 形态**零命中**（除 §4.1 link 形占位槽位外，任何 `<…>` 角括字面残留即残留）。
- **验收 pin**：fill 后交付文档 `:::fill` 与**非豁免位 `<…>`** **零命中**（填后文档零占位符残留 · overall v1.1 Acceptance）。
- 与 consumer author 自检联动：cdd-spec-writer `author-spec` 已有 placeholder scan 自检——新增「`:::fill` 零残留 + 非豁免位 `<…>` 零残留」检查项（§5.1）· cdd-plan author-plan 同补。
- 骨架 by-construction 阶段占位符存在**不触发** doc-contract finding——前提 = 占位按 §4.1 分锚策略落位：纯内容槽位 `:::fill`（不伪作 required 锚值 · 纯内容提示）· link 形锚槽位占位 link（§4.1）——`:::fill` 不是 gate 逃逸标记；`:::fill` 误落 link 形锚值位即必产 finding（§4.1 实证）。

### 5. 消费面先 gen 后填（R4 · Q1→a 落消费面）

#### 5.1 cdd-spec-writer author-spec 更新

`author-spec` 阶段并入「**先 gen 后填**」：`npx -y @oscaner-skills/cdd-engine@latest schema gen phase-spec > <target path>`（或 overall）→ 在骨架槽位填散文（不重排结构）→ 提交前自检（spec coverage + **`:::fill` 零残留** + **非豁免位 `<…>` 零残留** + type consistency）。原「schema get 参考 + 手工转写」措辞删除——**层级转写失误整类死亡**（结构 by construction）。`schema get` 仍留作声明参考面（overall R3 · 其他工具/测试消费面不动）。English-primary（消费面 SKILL.md 文案英文 · 零程序历史）。

#### 5.2 cdd-plan author-plan 更新

同型并入：`schema gen plan > <target path>` → 填任务块（`- **Objective**:` / `- **Steps**:` / `- **Acceptance**:` / `- **DependsOn**` 数据字段照槽位 fill）→ 提交前自检补「`:::fill` 零残留 + 非豁免位 `<…>` 零残留」。计划结构（任务头冒号式 · `## Constraints` · DependsOn 边）由骨架保证形状。

#### 5.3 关键词面一致性

- 消费面入口仍 `npx -y @oscaner-skills/cdd-engine@latest ...`（消费者环境无 monorepo 布局 · Consumer perspective 规则）——**唯一引擎入口**
- **SKILL.md 零引擎内部路径字面量（用户裁定 · 2026-10-11）**：SKILL.md 是消费面——消费者不需要引擎内部细节；不以任何形态言及引擎内部树（`src-next/` · `src/` · `packages/…` **全零命中** · 验收 grep pin §7.2）；引擎入口唯一消费面拼写 `npx -y @oscaner-skills/cdd-engine@latest <subcommand>`；内部路径面（docs/kairos specs+plans · maintainers）随 rename 程序 P2 sweep 统一（本 spec 属内部面，`src-next/` 字面量随 sweep 改 `src/`）——SKILL.md 不在 sweep 面
- 两 skill 的 `author-*` 节点文本更新后，**必须 `pnpm run emit`**（SKILL.md 是 emit 源 · emit 产品 `.claude-plugin`/`.cursor-plugin`/`marketplace` 同步再生成——repo 铁律）

### 6. CLAUDE.md 去流程化（Q3→c）

#### 6.1 删除范围（直接删除 · 不迁不存）

删除 = §1.4 列出的 kairos/引擎流程叙述块：`Development-time CDD invocation` · `cdd CLI surface — zero new subcommands` · `Engine tests` · `Language policy → Review convergence` 指针——整块删除，**零迁移、零保留副本**（Q3→c：不迁 maintainers · 不迁 README）。目的：本仓库工作树逼近消费者环境，验证「消费者视角用引擎」真实体验（overall v1.1 D7）。保留面：repo dev 义务（emit/validate/changeset · emit-derived 警告 · 语言政策 · Node.js）等非 kairos/引擎流程内容照旧。

#### 6.2 「零新子命令」pin 不随散文消失（约束的语法面落点）

CLAUDE.md 散文 pin 删除 ≠ 约束删除——「CDD CLI 零新子命令」的**语法面强制**本身不依赖散文：
- `CliVerb` 联合 + `LEAF_COMMANDS` 闭集 = 引擎语法层面的动词/leaf 枚举（新增顶层动词必须改 `CliVerb` 型面——编译即显形）
- validate 的 channel audit guard 对 CLI × runtime 词表做关卡（word-face · engine channel audit——零回归 §7.2）
- 「文档先行」义务（overall Constraints「不可只实现不改文」）落点 = 本 spec（P2 设计文档先行）+ SKILL.md 消费面文本（§5）——散文 pin 的规范性由代码型面 + 本文档 + skills 三处接管

删除验收：`grep -n "零新子命令" CLAUDE.md` 零命中且 §1.4 四块零残留（整体 acceptance · §7.2）。

#### 6.3 消费者路径验证引导（不新增面）

CLAUDE.md 收缩后，不新增「引擎使用引导」替代节——引擎使用引导由 kairos 编排器 SKILL.md 消费面承载（skilled path 本就是消费者入口 · 不重复建设 · 第六前提）。CLAUDE.md 保持「仓库开发最小引导」（emit/validate/changeset 命令 + 义务 + 语言政策 + Node）。

### 7. 门禁与执行序

#### 7.1 六前提重构许可的落地边界（Q2→b 收口）

许可面 = **P2 所辖能力面内整 CLI 面 / 目录级重组开放**（overall v1.1 Non-goal ④ 改写已载）：
- 可重写 `face/cli.ts` 的 schema 面 + `render/` 面 + `contract/` 投影链（死码/空壳全清 · OOP 统一 · 零裸函数）
- **保行为等价**：重构不改变既有 CLI 行为语义面——rest 动词（implement / review / fix / issue / base）零语义漂移；schema get / issue render 现行为字节不变（引擎 vitest 全绿作证 · 含 401 既有 + colocated 新 pin）
- 不越 P2 能力面：review face overall 键（P1）· changesets 归并（P3）不 touched；实现落**改名后 `src/` 树**（跨程序 pin · `src-next/` → `src/` rename sweep 由依赖程序 P2 覆盖本文件字面量）
- 目录级重组若与 rename 程序 P2 的面冲突（如 render/ 归属移动）→ 以 rename 后形态为准 · 冲突时先回填父 overall

#### 7.2 验证面（顺序）

前置：**跨程序 pin 通过后启动引擎改动**（依赖升级与 src 更名程序 P2 改名落定 → `src/` 树）；工作树干净。顺序：`pnpm run emit`（SKILL.md 面变更后必跑 · 消费面 §5）→ `pnpm run emit:check` → `pnpm run precommit`（树无关子集 · doc-contract gate +1 spec（本 design）· 含新 skeleton 面 guard 零回归）→ 引擎 vitest（`pnpm --filter @oscaner-skills/cdd-engine test` · 既有 401 + **新 colocated pin：三型骨架 doc-contract 零 finding（按 §4.1 分锚占位策略的 fixture 断言——纯内容 `:::fill` / link 形锚占位 link）+ `schema gen` CLI 行为（`phase-spec`/`phaseSpec` 归一）+ 占位符零残留（`:::fill` + 非豁免位 `<…>`）**）→ `tsc --noEmit` 三项目 → `pnpm run validate` ALL PASS（emit 新鲜 / channel audit / residue 零回归）。

#### 7.3 提交粒度与执行序

实现期两提交面（每面独立 commit · 不混）：
1. **引擎面**：`schema gen` leaf + skeleton 投影 + `SkeletonAssembler` + colocated 新 pin（引擎能力面单一 commit）
2. **消费面**：cdd-spec-writer / cdd-plan SKILL.md author-* 更新（先 gen 后填 · 含 emit 再生成产品）+ CLAUDE.md 去流程化（§6 删除面）
任一混入 = 提交污染（overall 惯例）。先 engine 后 consumer（能力先立 · 消费面引用真名）。本 phase **不单开 changeset**：两能力 bump 归 P3 主题归并（父总体 D 定案）。

### Acceptance criteria

- `cdd schema gen phase-spec|overall|plan` 输出**完整结构骨架**到 stdout（标题树 · 表列头 · `- **Version**: v0.1 · <date>` 脚手架（`<date>` 仅记号示意——落盘为运行日真实日期 · §4.1）· change-history 首行全须齐备（日期格运行日真值 · summary/author 格 `:::fill`）· 纯内容占位符 `:::fill <slot>` · link 形锚槽位占位 link（§4.1））
- 三型骨架经 doc-contract 判压**零 finding**——含 `:::fill` 纯内容槽位与占位 link 的未填即绿（colocated vitest pin 按 §4.1 分锚占位策略断言 · 结构化 by construction · `schema gen phase-spec` 与 `schema gen phaseSpec` 同型归一）
- 填后 doc-contract 终判语义不变（gate 零例外 · 骨架非豁免通道）；`schema get` 现行为字节不变（vitest 全绿作证 · 401 既有全绿）
- 消费面 author 节点更新（cdd-spec-writer / cdd-plan：先 gen 后填 · `:::fill` 零残留自检）· `pnpm run emit` 后 emit 产品新鲜（`emit:check` 绿）
- **SKILL.md 零引擎内部路径字面量**：`grep -rn "src-next" packages/kairos/skills/` 零命中（现态已满足 · 更新后保持——消费面 SKILL.md 只出现消费面入口 `npx -y @oscaner-skills/cdd-engine@latest`）
- CLAUDE.md 去流程化落：`grep -rn "零新子命令" CLAUDE.md` 零命中 · §1.4 四块检索零残留（`Development-time CDD invocation` / `cdd CLI surface` / `Engine tests` / `Review convergence` 指针）；repo dev 义务面保留
- 引擎 vitest 全绿（`pnpm --filter @oscaner-skills/cdd-engine test`）· `tsc --noEmit` 三项目全绿 · `pnpm run validate` ALL PASS · `pnpm run precommit` 过
- 实现落改名后 `src/` 树（跨程序 pin 通过后启动）

## Constraints

- **gate 零例外**：doc-contract 判定语义不变——骨架 by construction 绿是派生事实（按 §4.1 分锚占位策略），不是豁免通道；`:::fill` 与 link 形占位都是内容提示，非逃逸标记
- **零运行时依赖变化**：schema gen = 引擎自有渲染（无新第三方包 · 零新增依赖）
- **六前提许可面 = P2 能力面**：整 CLI 面/目录级可重写可重组（OOP 统一 · 零裸函数 · 死码/空壳清理）——保行为等价（vitest 全绿），不越 P1/P3 面
- **跨程序树 pin**：引擎改动仅落依赖升级与 src 更名程序 P2 改名后树；本程序期引用沿用现行 `src-next/` 路径面（rename sweep 覆盖字面量）
- **CLAUDE.md 去流程化 = 直接删除不迁不存**（Q3→c）·「零新子命令」约束落语法面（CliVerb/LEAF_COMMANDS 闭集 + channel audit）——散文 pin 删除非约束删除
- **消费面零程序历史**（Consumer surface purity iron rule）：SKILL.md 是指导文档——只写执行方向与自描述结构，不写程序演进叙述；所有 gen/先 gen 后填变更为指令文本，无「为什么从 schema get 改」历史
- **语言纪律**：内部 docs 中文（本 spec · Strategy B）· 消费面 SKILL.md 英文主源（English-primary）· CLAUDE.md 保留面也英文
- **变更先回填本 overall**：backfill-as-version 先行（本 phase 先例：overall v1.1 grilling 定案已落）再继续实现
- **不单开 changeset**：两能力 bump 归 P3 主题归并（本 phase 贡献被 P3 吸收）

## Deviations

| Overall assumption | Phase decision | Overall updated? |
|---|---|---|
| 「CLAUDE.md pin 连带修订（例外面扩 schema gen · 文档先行）」字面 = 在 CLAUDE.md 里改一行例外 | 修订落点 = **语法面 + 本文档 + skills 三处接管**，CLAUDE.md 散文块（含 pin）按 Q3→c **直接删除**（Q3→c 用户裁定盖过「改一行」字面）——「零新子命令」约束由 `CliVerb`/`LEAF_COMMANDS` 闭集 + channel audit guard 保有，`schema gen` = schema 动词下 leaf 扩展（非新顶层动词 · 例外语义一致） | Yes（overall v1.1 D7 已记「pin 修订 + 去流程化直接删除」） |
| 「骨架 = 声明面派生（标题树/表列/版本脚手架）」 | 完整结构 = **每个 required 元素齐备 + 占位符槽位**（`:::fill <slot>` · my call 定式）· 填后 `:::fill` 零残留 pin——body/description 用占位符而非空节（Q1 延伸裁定） | Yes（overall v1.1 Q1 延伸已记） |

## Notes for downstream

- **P2 （依赖升级与 src 更名程序）会改写本 spec 的 `src-next` 字面量**（Q3→b 历史面全改覆盖 docs/kairos specs+plans）——实现期 dev face 引用在改名落定后统一变 `src/bin.ts`，无需本 phase 预改
- **本 phase 不单开 changeset**：schema gen 能力 + 消费面 author 变更贡献归 P3 主题归并吸收（overall Constraints「changesets 收尾」· 发布边界 D）
- **占位符策略为 my call**（§4.1 两形：纯内容 `:::fill` · link 形锚占位 link）：若 review 建议换用其他可见标记（HTML comment / checkout 式占位）或调整占位 link 字面，仅改 §4 一处 + 骨架渲染常量 + pin grep 模式——语义不变（占位符标记非结构位）
- **declare.ts 头注释计数已过时**（注释记 plan 24 / phase-spec 21 · 活树 plan 28 / phase-spec 25）：注释同步属引擎面改动，随 P2 实现一并刷新（§1.2 已引活树计数）
- **P1（review-face overall 键）与 P2 并行**：P1 若先行 closeout，overall v1.1 → v1.2 时本 spec 的 Parent program 版本引用随之浮动——closeout 时一并回填
- **claude 编排器对骨架的使用**：`schema gen` 输出是给消费面 author（AI）与维护者（人）的写作起点——不含运行时判压义务（判压永远在 fill 后 gate）

## Change history

| Version | date | summary | author |
|---|---|---|---|
| v0.1 | 2026-10-11 | P2 设计 spec：`schema gen <type>`（schema 动词下 leaf · stdout 纯渲染 · 编排器 `schema gen phase-spec > <path>` 落盘）· 骨架 = 完整结构 + `:::fill` 占位符槽位（v0.1 版本起点 · change-history 首行 · by-construction 过 gate）· 消费面 cdd-spec-writer/cdd-plan author「先 gen 后填」（零残留 pin）· CLAUDE.md 去 kairos/引擎流程（Q3→c 直接删除 · 零新子命令约束落语法面）· 六前提重构许可整 CLI 面/目录级（保行为等价 · 跨程序树 pin）——grilling Q1/Q2/Q3 定案全量展开 | [human] · Claude Opus 5（kairos:cdd-design [P2] enumerate-then-grill → cdd-spec-writer） |
