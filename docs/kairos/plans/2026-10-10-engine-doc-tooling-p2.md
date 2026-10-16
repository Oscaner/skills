# 引擎文档工具（Engine Doc-Tooling）— P2 Plan（schema gen 模板写作）

**Spec:** [2026-10-10-engine-doc-tooling-p2-design.md](docs/kairos/specs/2026-10-10-engine-doc-tooling-p2-design.md)
- **Parent program**: [2026-10-10-engine-doc-tooling-overall.md v1.1](docs/kairos/specs/2026-10-10-engine-doc-tooling-overall.md)
- **Version**: v0.5 · 2026-10-11
- **Doc type**: plan
- **Depends on**: 依赖升级与 src 更名程序 P2（sweep 面关系 · D8 拆 pin——本 plan 引擎改动**先行实现于现行 `src-next/` 树**，rename sweep 随后全库覆盖新文件面）；本程序 P1 ‖ P2 并行无硬依赖（父总体 Dependency graph）· 前置 = P2 design spec v0.2 Approved（review-fix 链全闭 · 拆 pin 回填后）
- **Base**: develop

## Constraints

- **跨程序树协调（D8 拆 pin · spec §7.2 前置已同步）**：引擎改动**先行实现于现行 `src-next/` 树**（不等 rename P2——改名 sweep 随后全库覆盖本 phase 新文件面 · Q3→b · 豁免面为空）；本 plan 的 `src-next/` 路径字面量即**实现真路径**（非待改写面）；Task 1/2 的引擎文件引用直接可用
- **提交粒度（spec §7.3 两提交面 · 任一混入 = 提交污染）**：Task 1 = 引擎面（schema gen leaf + skeleton 投影 + `SkeletonAssembler` + colocated 新 pin · **引擎能力面单一 commit**）· Task 2 = 消费面（cdd-spec-writer/cdd-plan SKILL.md author-* 更新 + CLAUDE.md 去流程化 · **消费面单一 commit**）——先 engine 后 consumer（能力先立 · 消费面引用真名）；提交由引擎 implement 一波一提交驱动，计划不写 git commit 步
- **gate 零例外（spec Constraints）**：doc-contract 判定语义不变——骨架 by construction 绿是派生事实（§4.1 分锚占位策略），不是豁免通道；`:::fill` 与 link 形占位都是内容提示，非逃逸标记
- **Dependency cell 分类裁定（branch-review-1 F3 · orchestrator 定）：保持 content**——overall 骨架 Phase inventory 的 `Dependency cell` 以纯内容槽 `:::fill dependency` 落位（`#skeletonSlotOf` 分类 · 声明 valuePattern `^P\d+.*->` P→P 形与真实文档混用面（`P1 ->(hard)` / `无（program 起点）`）宽泛实况的体面收口 · 非 enforcement 面）· 扩声明 pattern 收真值行为后续 engine 面议题，非本 phase 强制
- **零运行时依赖变化**：schema gen = 引擎自有渲染（无新第三方包 · 零新增依赖）
- **六前提许可面 = P2 能力面（spec §7.1）**：整 CLI 面/目录级可重写可重组（OOP 统一 · 零裸函数 · 死码/空壳清理）——**保行为等价**：rest 动词（implement/review/fix/issue/base）零语义漂移 · `schema get`/`issue render` 现行为字节不变；不越 P1（review-face 键）/P3（changesets）面
- **SKILL.md 零引擎内部路径字面量（spec §5.3 · 用户裁定）**：消费面 SKILL.md 只出现消费面入口 `npx -y @oscaner-skills/cdd-engine@latest`——`src-next/`/`src/`/`packages/` 三词条零命中（grep pin 落 acceptance · 词界守卫 `grep -rnE "(^|[^[:alnum:]_])(src-next|src/|packages/)" packages/kairos/skills/`）
- **消费面零程序历史（Consumer surface purity iron rule）**：SKILL.md 是指导文档——author-* 更新只写执行方向与自描述结构（先 gen 后填 · 占位零残留自检），零「为什么从 schema get 改」演进叙述
- **语言纪律**：消费面 SKILL.md 英文主源（English-primary · 零中文）· 本 plan 中文（Strategy B）
- **变更先回填本 overall（backfill-as-version）**：实施期若发现 spec/overall 复议实况先回填，再继续实现
- **不单开 changeset**：schema gen 能力 + 消费面 author 变更贡献归 P3 主题归并吸收（overall D 定案）
- **消费面变更必 emit**：SKILL.md 面更改后 `pnpm run emit` 再生成 harness 产品（`.claude-plugin`/`.cursor-plugin`/`marketplace`）· `emit:check` 绿——repo 铁律

### Task 1: 引擎面——schema gen 能力（Projector.skeleton 投影 + SkeletonAssembler + cli gen leaf + colocated pins）

- **Objective**: 在 `contract/` 投影链新增骨架派生，`render/` 面新增骨架渲染器，`face/` 新增 `schema gen` leaf——首端到端 跑通 `cdd schema gen phase-spec|overall|plan > <path>`：stdout 输出完整结构骨架（按 spec §2/§3/§4：v0.1 版本起点 · 运行日日期格真值 · 纯内容槽位 `:::fill <slot>` · link 形锚槽位占位 link · 节头数字真值 `### 1.`/`#### 1.1`/`### Task 1:` · change-history 首行），colocated 新 pin（三型骨架 doc-contract 零 finding · gen CLI 行为 · 占位零残留）全绿，落**引擎面单一 commit**
- **Files**:
  - Modify: `packages/cdd-engine/src-next/contract/project.ts`（`Projector#skeleton()` 第六投影）
  - Modify: `packages/cdd-engine/src-next/contract/declare.ts:15`（头注释计数刷新 plan 24→28 · phase-spec 21→25 · spec Notes 登记）
  - Create: `packages/cdd-engine/src-next/render/skeleton.ts`（`SkeletonAssembler` 类 · 零裸函数——模块级导出 = 类型 + 类）
  - Modify: `packages/cdd-engine/src-next/face/cli.ts`（`CliLeafName` 扩 `"gen"` · `CLI_COMMANDS.schema.leaves` 加 gen 行 · `CLI_USAGE.schema` 改 `cdd schema <get|gen> <type>` · `#runSchema` 按 leaf 分派 · gen 类型词表校验）
  - Test: `packages/cdd-engine/src-next/contract/__tests__/project.test.ts`（skeleton 投影 unit pins）
  - Test: `packages/cdd-engine/src-next/render/__tests__/skeleton.test.ts`（新建 · 渲染器输出 pins）
  - Test: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（gen leaf 行为 pins）
  - Test: `packages/cdd-engine/src-next/contract/__tests__/doc.test.ts`（三型骨架 doc-contract 判压零 finding pin——spec §7.2 colocated pin）
- **Consumes**: design spec §2（CLI 面）/§3（骨架构成）/§4（占位符分锚策略）· `Projector` 现状（shape/chema/slices/tokens/reference 五投影 + `registries()` + `#projectDocShape` 派生链 · `contract/project.ts`）· `declare.ts` 登记录（overall 39 / plan 28 / phase-spec 25 · DocType 原子 `overall|plan|phase-spec`）· cli leaf 接线（`CliLeafName`/`CLI_COMMANDS`/`CLI_USAGE`/`#runSchema`/`#positionalsOf`/`#docKeys` · `face/cli.ts`）
- **Produces**: `Projector#skeleton(): Record<DocKey, SkeletonProjection>`（第六投影 · required-only · shape home 分组序 · 每元素标 slot 形）· `SkeletonProjection` 类型（docType + slots：锚 · slot 形（content / link / numeric-heading / generator-truth / table-header / table-row / scaffold）· valuePattern · refKind）· `SkeletonAssembler` 类（constructor 取 projection + 运行日日期注入 · `render(): string` 输出 markdown 骨架字节）· `cdd schema gen <type>`（stdout · DocType 词表 + `phaseSpec` 别名归一）· colocated pins（三型骨架判压零 finding · gen CLI 行为 · 占位零残留）
- **Steps**:
  - `Projector#skeleton()`：在 `contract/project.ts` 新增第六投影——从登记表 required 元素 + `#projectDocShape` 的 home 分组序派生 `SkeletonProjection`（每元素保留 anchor · presence · home · valuePattern · refKind，稳定序 = shape 分组序）；**optional/conditional 元素零生成**；slot 形标记：link 形锚（refKind ∈ parent-program / spec-ref 且 valuePattern 为 link 形 · spec §4.1）· 数字形节头（valuePattern 含 `\d+` 占位的 `N.`/`N.M`/`Task N:` 族）· **pattern 型必填值位 = 生成器真值**（enum 域全锚枚举 → 首个合法字面 · graph 元素 home=graph hard edge/legend → 满足 valuePattern 的真值行 · spec §3.2）· 纯内容槽位（其余自由文本形 required 值位 · `:::fill` 仅落此子类）· 表列头/表行/脚手架（home = table / 版本行）——按 spec §4.1 分锚语义归类 — checkable: `project.test.ts` 新 describe：三型 skeleton slots 集 == required 元素集（declare.ts 活登记表）· optional/conditional 零生成 · home 分组序与 `shape()` 一致 · link 形锚（parent-program/spec-ref）标 slot=link · 数字形节头（task-block/design-body 数字 valuePattern）标 slot=numeric-heading · enum 域（`**Status**`）标 slot=generator-truth 且取首个合法字面（Draft）· graph 元素（hard edge/legend）标 slot=generator-truth 行（`P1 -> P2` · legend 行）· 版本/日期元素标 scaffold · 纯内容槽位零含全锚枚举/graph 元素
  - `Projector#skeleton()` 词表对齐 spec §2.2 DocType：`Record<DocKey, SkeletonProjection>` 键 = `overall|plan|phaseSpec`（投影域沿用现行 DocKey）· cli 侧将 DocType 字面量（`phase-spec`）归一到 DocKey 取数（spec §2.2 别名面 = 引擎内一次归一 · 无第二份列表）— checkable: project.test.ts：`phase-spec`（DocType 字面）经归一表取 `phaseSpec` 键 · `phaseSpec` 别名同型
  - `declare.ts:15` 头注释计数刷新：`overall 39 / plan 24 / phase-spec 21` → **`overall 39 / plan 28 / phase-spec 25`**（spec Notes · 与活登记表一致 · 防后续误引）— checkable: 头注释三数 == `schema get` 自派生计数（39/28/25）
  - `SkeletonAssembler` 类（`render/skeleton.ts`）：constructor `(projection: SkeletonProjection, date: string)`（date 由 cli 注入运行日 · 可测固定）· `render(): string` 按 spec §4.1 渲染 markdown 骨架字节——标题树逐 required 节头（数字形节头落**真值数字** `### 1.`/`#### 1.1`/`### Task 1:` · spec §3.2/§4.1）· 表列头 + 最小行（issue/phase/file-path/change-history 列表头 + 一行 row）· 版本行 `- **Version**: v0.1 · <date>`（`<date>` = 注入运行日 · 判形真实命中）· change-history 首行 `| v0.1 | <date> | :::fill summary | :::fill author |`（version-ascending · 版本行自洽）· pattern 型必填值位落**生成器真值**（enum 域取首个合法字面：`**Status**: Draft` · overall/phase-spec 必填 · home=header · spec §3.2 · graph 行：hard edge 真值行 `P1 -> P2` + legend 真值行 · home=graph）· 纯内容槽位（自由文本形值位）`:::fill <slot>`· `:::fill` 永不落 pattern 型值位/数字形节头/link 形锚/结构位（节头/列头/版本行/真值行是派生真值）· link 形锚槽位占位 link（`- **Parent program**`/plan `- **Spec:**`/`**Parent program**`：label+target 同 `<…>` 字面 · plan `**Spec:**` 的 label 与 target 同一字面满足 planChain `label == basename`）· `render(): string` 字节级纯渲染不尾随换行（换行以 cli 为单点归属） — checkable: `skeleton.test.ts`：三型输出含全部 required 锚（grep 探针逐锚）· 节头为数字真值（`### 1.`·`#### 1.1`·`### Task 1:` 判形命中 · 无字面 `N`）· 版本行 `v0.1 · <date>` · change-history 首行（版本行 = header 版本 · 递增序）· `**Status**: Draft` 字面判形命中 · graph 真值行（hard edge `P1 -> P2` + legend 行判形命中）· 纯内容槽 `:::fill <slot>` · link 锚占位 link（label+target `<…>` 同字面）· 输出无 `:::fill` 在 pattern 型值位/link 形锚/结构位 · EOF 单换行（重定向产物最终字节恰好一个 `\n`）
  - cli `gen` leaf 接线（`face/cli.ts`）：`CliLeafName` 扩 `"gen"` · `CLI_COMMANDS.schema.leaves` 加 `{ name: "gen", usage, description, positionals: [{ key: "type" }] }` · `CLI_USAGE.schema` 改 `usage: cdd schema <get|gen> <type>` · `#runSchema` 按 `parsed.leaf` 分派（`get` 走现状（零变）· gen 走骨架渲染——`#positionalsOf` 的 type 校验按 leaf 分流：get = `#docKeys` + plan-graph（现状零变）· gen = DocType 词表 + `phaseSpec` 别名归一 · 缺 `<type>`（positionals[0] undefined）= `cdd schema gen: missing <type>`（gen 分派支自持 · 不复用 get 缺参消息）；裸 `get` 缺参由 parser 面 required-positional 拦截（实测字节 `cdd schema: missing required <type>` · get 行为零变——本分支零改动此字节）· unrecognized = `cdd schema gen: unknown schema type` + 可用列表（DocType 三字面 + 别名））· gen 路径 = `this.#projector.skeleton()[key]` → `new SkeletonAssembler(projection, today).render()` → stdout + 单次 `\n`（追加以 cli 为唯一归属 · render() 不尾随 · 重定向产物 EOF 恰好一个 `\n`）（today = 运行日 `YYYY-MM-DD` · 无日期参数）· 零写盘 — checkable: `cli.test.ts`：裸 `schema gen`（缺 `<type>`）→ usage 错误 `cdd schema gen: missing <type>` · 裸 `schema get` 缺参消息字节不变（parser 面 `cdd schema: missing required <type>` · 实测 pin）· `schema gen phase-spec` stdout 输出 markdown 骨架（含 `:::fill`/版本行/change-history 首行）· `schema gen phaseSpec` 输出与 `phase-spec` 全字节一致（归一）· `schema gen plan-graph` → usage 错误（gen 词表无 plan-graph · 与 get 分流）· `schema gen <unknown>` → usage 错误列可用 DocType · `schema get phase-spec` 仍报 unknown（get 词表零变）· `schema get phaseSpec` 仍输出 JSON（get 行为字节不变）
  - colocated pins（spec §7.2 三件）：① 三型骨架 doc-contract 零 finding——`doc.test.ts`：对每型 `SkeletonAssembler` 渲染输出跑引擎 judge 判压 → 零 finding（占位 link 命中链豁免 · 纯内容 `:::fill` 在槽位 · 节头数字真值判形命中）② gen CLI 行为（`phase-spec`/`phaseSpec` 归一字节一致 · 出错面见第 5 步）③ 占位符零残留——报告渲染输出的 `:::fill` 全部位于 content 槽位声明处（slot 集内）· 无 link-锚位/结构位命中 — checkable: `doc.test.ts` 三型判压零 finding · `cli.test.ts` 归一/错误面（第 5 步）· 占位归位探针全绿
  - 引擎面收口：`pnpm run precommit`（doc-contract gate 保持 · 19 specs/plans · 树无关子集绿）→ 引擎 vitest（`pnpm --filter @oscaner-skills/cdd-engine test` · 既有 401 全绿 + 新 colocated pins 全绿）→ `tsc --noEmit`（engine 项目）→ `pnpm run emit:check`（emit 产品新鲜）——全绿后落**引擎面单一 commit**（scopes：schema gen leaf + skeleton 投影 + `SkeletonAssembler` + colocated pins + declare.ts 头注释刷新 · 不含消费面文件）— checkable: 各门禁 ALL PASS · commit 仅 engine 文件（`git diff` 不含 `packages/kairos/skills/` · CLAUDE.md）· precommit 钩子绿
- **Acceptance**:
  - `cdd schema gen phase-spec|overall|plan` 输出完整结构骨架到 stdout（标题树 · 表列头 · `- **Version**: v0.1 · <date>`（运行日）· change-history 首行 · 纯内容 `:::fill <slot>` · link 锚占位 link · 节头数字真值 `### 1.`/`#### 1.1`/`### Task 1:`）· `phaseSpec` 别名归一
  - 三型骨架经 doc-contract 判压零 finding（colocated pin · 分锚占位策略断言 · 结构化 by construction）
  - `schema get` 现行为字节不变（get 词表/输出零变 · 既有 vitest 全绿作证）
  - declare.ts 头注释计数 = 活登记表（overall 39 / plan 28 / phase-spec 25）
  - 引擎面单一 commit（不混消费面）· precommit + 引擎 vitest + tsc + emit:check 全绿
- **DependsOn**: none

### Task 2: 消费面——SKILL.md author-* 先 gen 后填 + emit 再生成 + CLAUDE.md 去流程化

- **Objective**: 更新 cdd-spec-writer `author-spec` 与 cdd-plan `author-plan` 节点为「**先 gen 后填**」（`npx -y @oscaner-skills/cdd-engine@latest schema gen <type> > <target path>` → 骨架槽位填散文 → 提交前自检含「`:::fill` 零残留 + 非豁免位 `<…>` 零残留」+ spec coverage + type consistency）· SKILL.md 零引擎内部路径字面量（三词条零命中）· `pnpm run emit` 再生成 harness 产品 · CLAUDE.md 删除 kairos/引擎流程四块（Q3→c 直接删除）——落**消费面单一 commit**（spec §6/§5 + §7.3）
- **Files**:
  - Modify: `packages/kairos/skills/cdd-spec-writer/SKILL.md`（`author-spec` 节点文本 · spec §5.1）
  - Modify: `packages/kairos/skills/cdd-plan/SKILL.md`（`author-plan` 节点文本 · spec §5.2）
  - Modify: `CLAUDE.md`（删除四块：`Development-time CDD invocation` · `cdd CLI surface — zero new subcommands` · `Engine tests` · `Language policy → Review convergence` 指针 · spec §6.1）
  - Modify: `packages/kairos/tests/presentation-surface.test.ts`（CLAUDE.md Non-goal #1 散文 pin 三断言移除 · 删除面直接推论 · spec §6.2/§1.4 v0.3——README 族 pin（297-298 行）零动 · wave-review-2 orchestration ledger 回填）
  - Regenerate（`pnpm run emit`）: `.claude-plugin/` · `.cursor-plugin/` · `marketplace/`（SKILL.md 派生产品 · repo 铁律）
  - Validate: `pnpm run validate`（emit 新鲜 · kairos tree/wiring guard · skill anatomy 契约 · 脚本单元）· `pnpm run precommit`
- **Consumes**: design spec §5（消费面先 gen 后填）· §6（CLAUDE.md 去流程化）· Task 1 的 `schema gen` 真名（消费面引用真名）· SKILL.md 现状文本（author-* 节点措辞）
- **Produces**: cdd-spec-writer `author-spec`（先 gen 后填指令 + 零残留自检项）· cdd-plan `author-plan`（同型）· SKILL.md 三词条零命中 · emit 再生成产品（.claude-plugin/.cursor-plugin/marketplace）· CLAUDE.md 去流程化（四块零残留 · repo dev 义务面保留）· 消费面单一 commit
- **Steps**:
  - cdd-spec-writer `author-spec` 节点改写（English-primary · 指令文本）：author 流程并入「先 gen 后填」——`npx -y @oscaner-skills/cdd-engine@latest schema gen phase-spec > <target path>`（或 overall）→ 在骨架槽位填散文（不重排结构）→ 提交前自检（spec coverage + **`:::fill` 零残留** + **非豁免位 `<…>` 零残留** + type consistency）；删除「schema get 参考 + 手工转写」措辞（结构 by construction · 层级转写失误整类死亡）· `schema get` 保留作声明参考面说明（不变）· 按 Consumer surface purity：只写执行方向，零「为什么改」演进叙述 · 零引擎内部路径字面量（只出现 `npx -y @oscaner-skills/cdd-engine@latest`）— checkable: `grep -rnE "(^|[^[:alnum:]_])(src-next|src/|packages/)" packages/kairos/skills/cdd-spec-writer/SKILL.md` 零命中 · 文本含 `schema gen` 先 gen 后填字样 · 含 `:::fill` 零残留自检项 · 无「schema get 参考 + 手工转写」消亡措辞 · English-primary 无中文
  - cdd-plan `author-plan` 节点改写（同型 · spec §5.2）：`schema gen plan > <target path>` → 填任务块数据字段（`- **Objective**:`/`- **Steps**:`/`- **Acceptance**:`/`- **DependsOn**）→ 提交前自检补「`:::fill` 零残留 + 非豁免位 `<…>` 零残留」；计划结构（任务头 · `## Constraints` · DependsOn 边）由骨架保证形状 — checkable: 同上（cdd-plan 文件）· 文本含 `schema gen plan` 先 gen 后填 · 零残留自检项
  - `pnpm run emit` 再生成 harness 产品（SKILL.md 派生 .claude-plugin/.cursor-plugin/marketplace · repo 铁律 spec §5.3）— checkable: `pnpm run emit:check` 绿 · 生成的 SKILL 产品面与源一致
  - CLAUDE.md 删除 kairos/引擎流程四块（spec §6.1 · Q3→c 直接删除不迁不存）：`Architecture → Development-time CDD invocation` · `Architecture → cdd CLI surface — zero new subcommands`（含「零新子命令」散文 pin——约束落语法面 = CliVerb/LEAF_COMMANDS 闭集 + channel audit guard · spec §6.2）· `Architecture → Engine tests` · `Language policy → Review convergence` 指针；保留 repo dev 义务面（emit/validate/changeset 命令 · emit-derived 警告 · 语言政策 · Node.js 等）— checkable: `grep -rn "零新子命令" CLAUDE.md` 零命中 · `grep -n "Development-time CDD invocation\|cdd CLI surface\|Engine tests\|Review convergence" CLAUDE.md` 零命中 · dev 义务节（Key commands/emit 警告/语言政策）仍在
  - 收口对照：`pnpm run emit`（SKILL.md 面已改必跑）→ `pnpm run emit:check` → `pnpm run precommit`（doc-contract gate 19 specs/plans 保持 · kairos anatomy 契约绿）→ `pnpm run validate` ALL PASS（emit 新鲜 / kairos 树/wiring / marketplace 一致 / scripts 单元 / 包版本同步）——全绿后落**消费面单一 commit**（scopes：两 SKILL.md + emit 产品 + CLAUDE.md 去流程化 · 不含引擎面文件）— checkable: 各门禁 ALL PASS · commit 仅消费面文件（`git diff` 不含 `packages/cdd-engine/`）· precommit 钩子绿
- **Acceptance**:
  - cdd-spec-writer / cdd-plan author-* 节点文本「先 gen 后填」（含 `:::fill` + 非豁免位 `<…>` 零残留自检）· SKILL.md 三词条守卫 `grep -rnE "(^|[^[:alnum:]_])(src-next|src/|packages/)" packages/kairos/skills/` 零命中（现态已满足 · 更新后保持）
  - `pnpm run emit` 后 emit 产品新鲜（`emit:check` 绿）
  - CLAUDE.md 去流程化：`grep -rn "零新子命令" CLAUDE.md` 零命中 · 四块检索零残留 · repo dev 义务面保留
  - 消费面单一 commit（不混引擎面）· `pnpm run validate` ALL PASS · `pnpm run precommit` 过 · 引擎 vitest 全绿（含 Task 1 pins · 回读确认零回归）
- **DependsOn**: 1

## Change history

| Version | date | summary | author |
|---|---|---|---|
| v0.1 | 2026-10-11 | P2 实现计划：两提交面两任务——Task 1 引擎面（`schema gen` leaf + `Projector#skeleton()` 第六投影 + `SkeletonAssembler` + colocated pins（三型骨架判压零 finding · CLI 行为 · 占位零残留）+ declare.ts 头注释计数刷新）· Task 2 消费面（cdd-spec-writer/cdd-plan author-* 先 gen 后填 + SKILL.md 三词条零命中 + emit 再生成 + CLAUDE.md 去流程化四块 Q3→c）· 任务解自 design spec v0.1（§2–§7 · 分锚占位 · 节头数字真值 · 跨程序树 pin 前置） | [human] · Claude Opus 5（kairos:cdd-plan · writing-plans import） |
| v0.2 | 2026-10-11 | **P2 拆 pin 回填（用户裁定 ② · 父 overall v1.2 D8 · spec v0.2 同步）**：跨程序树硬门 → **sweep 面协调**——Task 1/2 引擎改动先行实现于现行 `src-next/` 树（plan 的 `src-next/` 字面量即实现真路径 · rename sweep 随后全库覆盖新文件面）；Constraints「跨程序树 pin 硬门」行改写 · Depends on header 同步 | Oscar M. · Claude Opus 5（P2 cdd-dev 进入前复核 · 用户拆 pin 裁定） |
| v0.3 | 2026-10-11 | **wave-review-2 取证回填（F1 nit · orchestration ledger）**：Task 2 Files 补 `packages/kairos/tests/presentation-surface.test.ts`（CLAUDE.md Non-goal #1 散文 pin 移除 · 删除面直接推论 · spec §1.4 v0.3 同语修正——README 族 pin 零动） | Oscar M. · Claude Opus 5（kairos:cdd-dev wave-review-2 · orchestrator backfill） |
| v0.4 | 2026-10-11 | **branch-review-1 取证回填（F2 nit · F3 裁定 · orchestrator）**：Task 1 Step 5 get 缺参消息字节表述订正（parser 面 `cdd schema: missing required <type>` · 非 run 面死代码串）· Dependency cell 分类裁定保持 content（`:::fill dependency` 落位 · 声明 P→P pattern 与实况宽泛收口 · 扩 pattern 归后续 engine 议题） | Oscar M. · Claude Opus 5（kairos:cdd-dev branch-review-1 · orchestrator backfill） |
| v0.5 | 2026-10-11 | **P2 closeout（cdd-close）**：两波两任务全链闭合——Task 1 引擎面（`06505e9a` + fix `21f8b1fb` · skeleton 第六投影 + SkeletonAssembler + cli gen leaf + 29 colocated pins · declare.ts 计数刷新）· Task 2 消费面（`fdd339c4` + 回填 `b8cf405c`/`b06bef67` · author-* 先 gen 后填 + SKILL.md 三词条零命中 + CLAUDE.md 去流程化 + kairos 门禁对齐）· branch-review-1 → branch-fix-1（F1 `[Pending]` 真值订正 `4d1d9dc7` · F2/F3 orchestrator 回填 `c7c89fe0`）· Acceptance 全项交付（schema gen 三型完整骨架 · 判压零 finding · get 字节不变 · 占位零残留 · grep pins 零命中 · 引擎 vitest 433/433 · validate ALL PASS）· 父 overall v1.3 登记 P2 → Done | [human] · Claude Opus 5（kairos:cdd-close · closeout-backfill） |
