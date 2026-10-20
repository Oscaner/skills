---
title: P4 实现计划：引擎 handoff 平面卫生 + commander 引入面收敛
doc-type: plan
version: v0.6
date: 2026-10-12
slug: 2026-10-10-engine-doc-tooling-p4
spec: docs/kairos/specs/2026-10-10-engine-doc-tooling-p4-design.md
parent-program: docs/kairos/specs/2026-10-10-engine-doc-tooling-overall.md
---

## Constraints

- **结构保真**：本骨架 = 声明面派生（`schema gen plan`）· 编辑器只填不重排——违反 = 保真破坏，视为 defect
- **行为语义零动**：领域 run（Lifecycle/PreFlight/Capsule/host）· doc-contract 判定 · `next:` dispatch 字面 · 命令树/旗标/值域消费面 · 跨程序 rename sweep 面（`src-next` 字面 · D8 拆 pin）
- **六前提整评许可**：分型重构 + 声明派生 + 拆分重组 · OOP 统一零裸函数 · 死面/死接线清理 · 高内聚低耦合 · 消费者心智负担 · 最大精简——**排除容忍/补丁**（work face 声明 findings 可选 · read-back 容忍剥离）
- **单一作者（v1.30）**：carrier 仅承载声明面 · work 载体不含 `findings` · 引擎是载体唯一作者（draft 验证后物化 · 不破坏 no-overwrite）
- **值域字节零变**：值域校验声明派生不改 commander 原生错误字节/退出码/`next:` 字面（pins 语义保）
- **拆分行为等价**：cli.ts 拆分移面不破断言（全量 vitest + smoke-cdd 回归）· 零新增公开 CLI 面
- **变更集 minor 归并**（不发布 · 与 P3 同款）· `pnpm exec changeset status` 无 empty 条目
- **gate 零例外**：doc-contract 判定语义不变——骨架 by construction 绿 · 填后终判兜底
- **消费面零动**：CLI 帮助/usage/错误字节（commander 原生形态）不动 · 本次 drift 为引擎内部工程
- **引擎开发调用**（本仓库）：`node packages/cdd-engine/src-next/bin.ts <subcommand>` ——禁止 npx @latest（落后于树内）
- **测试纪律**：每任务 TDD 条件驱动（先红后绿）· 语义保 pins 断言形态更替需 deliberate 列明 · 引擎 vitest 全绿 + `pnpm run validate` ALL PASS 为每任务验收底线

## Review Focus

- **载体形状回归**：work 终态载体 `.json` 对 `findings` 键零命中的断言必须落到物化路径（`persistHandoff`）——任何只测 `buildHandoff` 单函数、不测物化落盘的产品形状 pin 会漏掉 work 载体「半合法」残留
- **两壳单句互指**：FIX_SHELL（work 面）与 DOCS_FIX_SHELL（findings 面）严守 schema 单句必须逐壳（findings 载体 required findings——把 work 面「零额外键」句抄给 findings 面会造成「findings 必填却被告知不得写」的自相矛盾，review round 1 F1 已裁）
- **值域错误字节不可漂移**：VALUE_SHAPES 声明派生取代手写 #parseEnum/#parseSha8 后，错误消息字节（`--tasks <n|n,n,…> — must be comma-separated integers: …` · `must be an 8-char sha` · `must be one of …`）必须逐字节不变——pins 零重锚
- **拆分移面不破导入**：cli.ts 拆出 lifecycle/gate/artifacts 后，模块公开导出与既有测试导入面保持兼容（零断言重写面）——任何「移到新文件顺便改签名」都是 drift
- **声称→pin lint 不误伤**：`path:line` 引用 lint 必须只扫声称/测试 pin 行（规格/计划正文引用），不把普通正文 `(path)` 或非测试引用当 finding——误报 = 文档面噪音
- **重审门控修订漂移**：plan 文档移动后 `cdd review --type wave` 必须放行（新修订新 review · findings 对当前修订再生）——任何「open wave 按 round 计数卡死在 fix」= D16 回归（T11 漂移用例 + 反自旋用例钉住 · 同修订 + pending fix 仍 BLOCK 不破）

---

### Task 1: HandoffCarrier 类型族 + buildHandoff 分面出口
- **Objective**: 声明 `WorkCarrier`/`FindingsCarrier` 两个独立载体类型（字段集与 `CARRIER_WORK`/`CARRIER_FINDINGS` 声明 `properties` 同源 · **由声明派生**）· `ledger.buildHandoff`（ledger.ts:603-616 现共享骨架恒写 `findings`）改为**按 face 分面成型**——work 面返回类型无 `findings` 键 · findings 面 required `findings` · 编译期类型级把门（Q1→c）· **命名映射**：spec §2.2/AC2 的 `handoffOf(face, init)` ↔ 本计划 `ledger.buildHandoff(face, …)` overloads——同一分面单出口机制（实现命名随本计划）
- **Files**: Modify: session/handoff-schema.ts（类型声明 · `WorkCarrier`/`FindingsCarrier`）；Modify: session/ledger.ts:603-616（`buildHandoff` 分面 overloads）；Test: session/__tests__/handoff-schema.test.ts、session/__tests__/ledger.test.ts
- **Consumes**: 既有 `HandoffSchemaFace`/`BY_FACE`/`CARRIER_WORK`/`CARRIER_FINDINGS`（handoff-schema.ts 数据面）· `RoundStatus`/`RoundFinding`（ledger.ts 已有导出）
- **Produces**: `WorkCarrier`/`FindingsCarrier` **由声明派生**（spec §2.1 · 零手写平行字段表——`type CarrierValue = { status: "APPROVED"|"BLOCKED"; failure_category: string; artifacts: Record<string,string>; commits: { base: string; head?: string }; changes: { file: string; reason?: string }[]; notes: string[]; findings: { severity: "blocker"|"warn"|"nit"; lens: string; section?: string; line?: number; summary: string; fix?: string }[] }` 键 → 值型映射表）· `type CarrierOf<F extends HandoffSchemaFace> = { [K in keyof BY_FACE[F]["properties"]]: CarrierValue[K] }`——mapped type 自 `BY_FACE[face].properties` 键集推导 · 声明改 → 载体类型随动 by construction · `WorkCarrier = CarrierOf<"work">`/`FindingsCarrier = CarrierOf<"findings">` · `ledger.buildHandoff(face: "work", init: { artifacts?: Record<string,string>; commits?: { base: string; head?: string } }): CarrierOf<"work">` 与 `buildHandoff(face: "findings", init: { findings: unknown[]; artifacts?; commits? }): CarrierOf<"findings">` overloads（实现返回两型之一 · 均额外承载 status 由调用方 set）——**overload 即类型级把门**：调用方写 `buildHandoff("work", {findings})` → tsc 拒
- **Steps**:
  - 写「分面键集 == 声明 properties 键集」colocated pin（handoff-schema.test · **兜底断言**——类型派生是主闸 · 运行期键集相等仅兜底）：`Object.keys(buildHandoff("work", …))` 与 `faceSchema("work").properties` 键集按平键相等 · `work` 载体 `findings` 键保零命中 · `findings` 载体含 `findings` 键 —— checkable: 该新 pin FAIL（TDD 先红）
  - 写类型级把门 pin：TS 测试中 `buildHandoff("work", { findings: [] })` 编译期拒 —— checkable: tsc 类型（tsc 类型断言负用例）FAIL（编译错）
  - 跑引擎 vitest 确认红 —— checkable: 相关 file 用例 FAIL
  - 在 handoff-schema.ts 以 `CarrierOf<F>` mapped type 声明 `WorkCarrier`/`FindingsCarrier`（由声明派生 · 键→值型映射表 `CarrierValue` 单处）· `ledger.buildHandoff` 改两 overloads（work 分支构造零 `findings` 键 · findings 分支必含 `findings`）· 现两调用方（cli.ts:590 · run.ts:500）暂传 `"work"` 面保持编译绿（T2 再全面化）· 本任务内最小调用方迁移 —— checkable: tsc 通过 · 新 pins 全绿
  - 维护既有 handoff-schema/ledger 语义测试（violations 面不动）全绿 —— checkable: 引擎 vitest 全绿（含既有用例）
  - COMMIT —— checkable: git commit 落 · precommit 过
- **Acceptance**: 载体类型由声明派生（mapped type 自 `BY_FACE[face].properties` 键集 · 声明改 → 类型随动 by construction）· `buildHandoff("work", …)` 返回类型无 `findings` 键（编译期类型主闸 + 运行期键集兜底断言）· work 载体平键与声明 properties 一致 · findings 载体 required findings · 调用方迁移到两处 · 引擎 vitest 全绿
- **DependsOn**: none

### Task 2: face 感知读写（#reconstruct/#materialize/#bookkeep）
- **Objective**: work 面零 `findings` 读取/写入路径——`#reconstruct`（cli.ts:529 无条件 `draft.findings` 读取）消除 · `#materialize`（cli.ts:592 work 传 `findings: []`）分面化 · `run.ts #bookkeep`（:500-504 兜底构造）分面化
- **Files**: Modify: face/cli.ts:511-555（#reconstruct）· face/cli.ts:581-607（#materialize）；Modify: session/run.ts:494-522（#bookkeep）；Test: face/__tests__/cli.test.ts、session/__tests__/run.test.ts
- **Consumes**: T1 `buildHandoff(face, init)` overloads · 既有 `schema.violations`/`#workStatus`/`#findingsList`/`#commitsOf`
- **Produces**: `#reconstruct` 重构——work 面 `status` 经 `#workStatus(draft)`（不读 `draft.findings`）· findings 面才读 `draft.findings` 并经 `schema.rollup` · `#materialize` 调 `buildHandoff(face, { artifacts, commits })`（work 零 findings init · findings 面 findingsList 传入）· `#bookkeep` 兜底按 frame 面（`#familyOf(op, type).schema ?? "work"`）调 `buildHandoff`——work 兜底零 `findings` 注入
- **Steps**:
  - 写「物化 work 载体零 findings 键」端到端 pin（cli.test · dry-run implement 一轮 → 读终态载体 JSON 断言 `findings` 键零命中）—— checkable: FAIL（现状 :592 注入 `findings`）
  - 写「run 兜底 work 载体零 findings」pin（run.test · 兜底构造路径）—— checkable: FAIL
  - 重构 `#reconstruct`（:529 无条件读取改为 findings 面条件分支 · work 面走 `#workStatus`）· `#materialize`（:592 条件分支消 · `buildHandoff(face,…)`）· `#bookkeep`（:500-504 按 face 分面）—— checkable: 新 pins 绿
  - 语义保 pins 更替清单：既有 work 载体形状断言（findings 键曾经存在的）deliberate 更替为 face-aware 断言 · review 面 finds/rollup pins 不动 —— checkable: 更替记录在册 · review 面 pins 断言零改
  - 跑引擎 vitest 全绿 —— checkable: 引擎 vitest 全绿
  - COMMIT —— checkable: git commit 落 · precommit 过
- **Acceptance**: cli.ts:529 无条件 `draft.findings` 读取消除（grep pin）· work 面零 findings 读写路径 · `#bookkeep` work 兜底零 findings · 物化终态载体 JSON 零 `findings` 键 · 引擎 vitest 全绿
- **DependsOn**: 1

### Task 3: 产物 ⊆ 声明机器判（guard 平面审计 + validate 接线）
- **Objective**: `GuardLibrary#checkHandoffPlane()`——声明 face 属性集闭合 + **写平面声明派生**（`engineOnly` 引擎专属键 · `HANDOFF_WRITE_PLANE` 销毁）+ 提示面-声明面单源一致性 · 入 `pnpm run validate` 与 precommit（scripts/validate.ts steps 增 CheckBlock）
- **Files**: Modify: scripts/lib/guard.ts（新审计方法，checkChannels :672 同族）；Modify: scripts/validate.ts steps（新 CheckBlock 于 channel audit 之后）；Modify: session/handoff-schema.ts（findings 声明节点增 `engineOnly: ["status"]` · `HANDOFF_WRITE_PLANE` 销毁 · `schemaText`/`violations` 按 engineOnly 过滤）；Test: scripts/__tests__/guard 相关、session/__tests__/handoff-schema.test.ts（投影一致性 + engineOnly 过滤 pin）
- **Consumes**: T1 `BY_FACE`/`faceSchema`/`schemaText` 数据面 · scripts validate steps 数据结构（:270-305 · `precommitSteps = steps.filter(step !== engineSuiteStep)`）
- **Produces**: `checkHandoffPlane(): GuardFinding[]`——① 声明 face 属性集闭合 + 写平面声明派生：work/findings **角色专属互斥**（findings ∉ work 声明 · status/failure_category/changes ∉ findings 声明——共享行 artifacts/commits/notes 双面声明为设计 · 交集空字面不可实现）· **引擎写平面 = `keyof properties ∪ engineOnly[face]`**（`engineOnly` 为声明节点携带的引擎专属键——findings 节点 `engineOnly: ["status"]` 声明滚动结论（引擎权威 · 孩子永不自写持久结论）· work `engineOnly: []` · **`HANDOFF_WRITE_PLANE` 平行表销毁**）· **投影①②按 `engineOnly` 过滤**（child 可见 fence = 声明节点 minus engineOnly · child draft 写 engineOnly 键 → 校验拒 · 提示面-声明面单源 check 即 fence == 声明 minus engineOnly）· **⑥ authority 卫生**（每个声明的 `engineOnly` 键均被引擎写路径消费 · 不进 child 投影——非重言式）② 投影一致性（`schemaText(face, …)` fence 字节解析后 == `BY_FACE[face]` 声明节点 minus `engineOnly`——prompt 不能展示引擎不执法的 schema）· validate step `name: "engine handoff plane audit"` 于 channel audit 之后
- **Steps**:
  - 写 guard 单测（构造「角色混杂」假声明（findings 声明 work 面专属键 / work 声明 findings）→ finding · 「engineOnly 泄漏」假 engineOnly（keys 进 child 投影视图 / 未被引擎路径消费）→ finding · 「投影不一致」的假 schemaText → finding）—— checkable: 该测试 FAIL（方法未实现）
  - 写投影一致性 pin（handoff-schema.test：`JSON.parse` 掉 `schemaText("work",…)` fence 的 carrier json == 声明节点 minus engineOnly）—— checkable: FAIL
  - 实现 `checkHandoffPlane()`（读 `BY_FACE` · `faceSchema` · `schemaText` · 逐族断言 · engineOnly 过滤 · GuardFinding 形式化）· 销毁 `HANDOFF_WRITE_PLANE` · validate.ts 增 CheckBlock —— checkable: 新 guard 单测 + 投影 pin 绿
  - 现 docs 面零误报核验 —— checkable: checkHandoffPlane 对当前树零 finding
  - 跑 `node scripts/run.ts precommit` + 引擎 vitest —— checkable: precommit 过 · 引擎 vitest 全绿
  - COMMIT —— checkable: git commit 落 · precommit 过
- **Acceptance**: `checkHandoffPlane` 绿（validate + precommit）· 角色专属互斥 + 写平面派生（engineOnly 卫生）机器判 pin 在册 · `HANDOFF_WRITE_PLANE` 零残留 · 对当前树零误报
- **DependsOn**: 1

### Task 4: 声称→pin 把门（machine lint + review lens 契约行）
- **Objective**: `GuardLibrary#checkClaimedPins()`——扫描 specs/plans 树中声称→pin 引用（`path:line`）· 断言引用存在 + 断言非空 · 入 validate；review vars（templates REVIEWS spec/plan axesGuide）增 claimed→pin 义务条款（D13 缺陷②修法）
- **Files**: Modify: scripts/lib/guard.ts（新 lint）；Modify: scripts/validate.ts（新 step）；Modify: render/templates.ts（REVIEWS.spec/plan axesGuide 追加条款）；Test: scripts/__tests__/guard、render/__tests__/render.test.ts（条款字节 pin）
- **Consumes**: doc-contract gate 既有的 docs 树扫描先例（scripts/validate.ts checkDocContract）· REVIEWS 四型（templates.ts :298-323）
- **Produces**: `checkClaimedPins(): GuardFinding[]`——正则扫 `docs/kairos/specs|plans` 下 `.md` 的 `path:line(-line)?` 声称引用（格式如 `cli.test.ts:2715-2733`）→ 每个引用：路径存在（repo 相对）+ 引用行域含测试断言字面（`test(`/`describe(`/`expect(` 任一）——不存在/空断言 = finding · 误报豁免：非 `.test.ts` 路径及非「声称→pin」语境引用不判 · validate step `name: "claimed→pin lint（声称→pin 引用存在 + 断言非空）"`
- **Steps**:
  - 写 lint 单测（构造假 spec 含悬空 pin / 空断言 pin → finding · 合法 pin / 普通正文 `(path)` ≠ 声称引用 → 零 finding）—— checkable: FAIL（方法未实现）
  - templates REVIEWS spec/plan axesGuide 追加条款：`Claimed→pin：任何行为声称（usage 行归属 · 语义契约 · 字节面）必须引用 colocated pin（path:line + 断言面）· 评审逐声称核对照；无 pin 声称 = lens-tagged finding`—— render.test 字节 pin 新条款存在于 spec/plan review 变体 —— checkable: 字节 pin FAIL（条款未落）
  - 实现 `checkClaimedPins()`（glob specs/plans · 正则提取 · 存在性/断言性校验 · GuardFinding 形式化）· validate.ts 增 step —— checkable: 新 lint 单测绿
  - 当前树声称→pin 引用取证：P4 设计 spec 自身已含 `cli.ts:511-555` 等引用 + 本计划 Task 引用 —— checkable: lint 对当前树零 finding（现有引用均解析）
  - 核验域 run usage colocated pin（d51efe19 · cli.test.ts domain-run usage 断言）仍在册（回归保）—— checkable: 断言在册
  - 跑 `node scripts/run.ts precommit` + 引擎 vitest —— checkable: precommit 过 · 引擎 vitest 全绿
  - COMMIT —— checkable: git commit 落 · precommit 过
- **Acceptance**: `checkClaimedPins` 绿（validate）· review spec/plan 变体含 claimed→pin 条款（字节 pin）· 当前 specs/plans 树全绿零误报 · usage 回归 pin 在册
- **DependsOn**: none

### Task 5: draft 指令面单句白名单（FIX_SHELL/DOCS_FIX_SHELL 严守 schema）
- **Objective**: `render/templates.ts` FIX_SHELL/DOCS_FIX_SHELL 逐壳各落一句严守 schema 指令——降 fix draft 首次 BLOCK 摩擦（P3 3/3 首现）· 字段单源 = `HANDOFF_SCHEMA` 注入面（模板不复述声明键集 · 手写枚举 = 平行表债 → 排除 · 用户裁定 2026-10-12）
- **Files**: Modify: render/templates.ts（FIX_SHELL :188-200 · DOCS_FIX_SHELL :204-214 壳尾追加单句）；Test: render/__tests__/render.test.ts（单句字节 pin）
- **Consumes**: T1 `BY_FACE` 声明键集（经 `HANDOFF_SCHEMA` 注入面投影——字段单源）· 壳内既有 `SCHEMA_SECTION` 注入面（:165）
- **Produces**: `FIX_SHELL` 增：**严守 schema 句**（`## Handoff schema` 声明 properties 即直接字段源——draft 顶层字段全部来自该声明，零额外键）· `DOCS_FIX_SHELL` 增：**同款严守句**（`findings` required 载自 `INPUT_FINDINGS` 原样携带不改 · 载体 required findings 与单句同面不矛盾）——零负向散文（一句指令 · 不列字段表 · 不列反例）
- **Steps**:
  - 写 render.test 单句字节 pin：fix 壳含 work 面严守句 · docs-fix 壳含 findings 面严守句——逐壳各一 · 键集字面零残余（模板文本不含字段枚举）—— checkable: FAIL（壳尾未落句）
  - 在 FIX_SHELL 指令尾（SCHEMA_SECTION 前）追加严守 schema 句 —— checkable: render.test 新字节 pin 绿（work 面）
  - 在 DOCS_FIX_SHELL 指令尾追加同款严守句（findings 自源原样携带语义）—— checkable: render.test 新字节 pin 绿（findings 面）
  - 语义核验：findings 面单句与 findings 载体契约（required findings）同面不矛盾（review round 1 F1 定裁保留）—— checkable: 壳句无自相矛盾（findings 必填不被告知不得写）
  - 跑引擎 vitest 全绿（含 render 既有字节 pins 零动）—— checkable: 引擎 vitest 全绿
  - COMMIT —— checkable: git commit 落 · precommit 过
- **Acceptance**: 两壳逐壳单句严守指令 · 键集零复述（字段源 = `HANDOFF_SCHEMA` 注入面）· 单句字节 pin 在册 · 探针 C 仲裁单句足够（3 轮 0/3 · T6）· 引擎 vitest 全绿
- **DependsOn**: 1, 4

### Task 6: 复现探针（首轮消解 + 物化零 findings）
- **Objective**: 确定性探针 + phase 级观测探针——work draft 带 findings 的首轮 BLOCK 摩擦归零或显著降（探针阈值 **3 轮首次 BLOCK 0/3** · spec §5.1 v0.2）· 物化终态载体零 findings 双层 pin
- **Files**: Test: session/__tests__/run.test.ts、face/__tests__/cli.test.ts（探针 pins）；Ancillary: .kairos/cdd/…（phase 观测记录 · 不入 git）
- **Consumes**: T2 face 感知读写 · T5 严守 schema 单句 · T1 分面构造
- **Produces**: 探针 A「物化零 findings」——端到端 dry-run implement/fix 派发 → `persistHandoff` 落盘 JSON `findings` 键零命中（grep 断言）· 探针 B「fix 提示面严守句」——fix 壳渲染输出含严守 schema 单句（子代理指令落地）· 探针 C「首轮消解 + 单句仲裁」——phase 级观测：本 phase 自身 dev fix 轮 3 轮派发首次 BLOCK 计数 0/3（closeout 记录 · 非单测可判定的 real-NN 观测 · 0/3 → 单句足够 · 非 0/3 → 补具体陷阱句）
- **Steps**:
  - 探针 A：dry-run implement 一轮 + fix 一轮 → 各读终态载体 JSON（persist 落盘面）断言 `findings` 键零命中 —— checkable: 断言绿（T2 已消注入）
  - 探针 B：渲染 fix 壳（render() 值域 fixture）断言含严守 schema 单句 —— checkable: 断言绿（T5 已落）
  - 探针 C 机制落地：本 phase dev fix 波派发时记录每轮首次 contract-violation BLOCK 计数 · 目标 0/3（三轮连续首轮绿）· 计数进 closeout 交付证据 —— checkable: 记录在册
  - 跑引擎 vitest 全绿（探针 A/B 断言在册）—— checkable: 引擎 vitest 全绿
  - COMMIT —— checkable: git commit 落 · precommit 过
- **Acceptance**: 探针 A/B 确定性断言绿 · 探针 C 3 轮首次 BLOCK 0/3 记录在册（closeout）· 引擎 vitest 全绿
- **DependsOn**: 2, 5

### Task 7: 值域校验声明派生（VALUE_SHAPES + parseArg 通用执行器）
- **Objective**: `face/declare.ts` 增 `VALUE_SHAPES` 每型形态规则表 · `face/projection.ts` 手写 `#parseEnum`/`#parseInts`/`#parseSha8`/`#parseInt` 销毁、`#parseArgOf` 改查表派发——值域校验零手写 per-key 复刻（`#parseTypeKey` 的 SCHEMA_TYPE_KEYS 派生先例推广）
- **Files**: Modify: face/declare.ts（`VALUE_SHAPES` · 型表声明）；Modify: face/projection.ts（:212-285 parseArg 族）；Test: face/__tests__/projection.test.ts、face/__tests__/cli.test.ts（字节 pin 语义保）
- **Consumes**: `ARGV_CHANNEL`（type/values · :50-97）· `SCHEMA_TYPE_KEYS`（:245-250）· `ChannelValueType` 七型（:26）
- **Produces**: `export const VALUE_SHAPES: Readonly<Record<ChannelValueType, { parse(raw: string, row: ChannelArgRow): string }>>`——每型一个规则：`enum` 从 `row.values` 校验 + `must be one of ${values.join(" | ")}`（字节同现值）· `int-list` 逗号拆分 + `^\d+$` + 去重排序归一 + `--tasks <n|n,n,…> — must be comma-separated integers: ${invalid}`（字节同现值）· `sha` `^[0-9a-f]{8}$` + `must be an 8-char sha` · `int` `^\d+$` + `must be an integer`（**错误消息字节逐字同现值** · pins 零重锚）· path/string/bool 无 parse（`#parseArgOf` 只对校验型查表）
- **Steps**:
  - 写「表源」pin：`VALUE_SHAPES` 键集 == `ChannelValueType ∩ {enum,int-list,sha,int}` —— checkable: FAIL（表未落）
  - 写「手写复刻销毁」grep pin：projection.ts `#parseEnum`/`#parseInts`/`#parseSha8`/`#parseInt` 零命中（通用执行器保留）—— checkable: FAIL（现方法存在）
  - declare.ts 增 `VALUE_SHAPES`（每型 parse 规则 · 零行为裸函数——数据规则 + 单执行器类化）· projection `#parseArgOf` 改 `VALUE_SHAPES[row.type]?.parse`（enum 传 row.values）· `#parseTypeKey` 保持 SCHEMA_TYPE_KEYS 派生（不动）—— checkable: 新 pins 绿 · **处置显式化**：`#parseTypeKey`/`SCHEMA_TYPE_KEYS` 保留（SCHEMA_TYPE_KEYS 为 schema gen/get `<type>` doc-key 词汇 · 与 ChannelValueType 值形状表正交 · 并入 VALUE_SHAPES 不适配 · 分叉记 Change history v0.2）
  - 销毁面：`#parseEnum`/`#parseInts`/`#parseSha8`/`#parseInt` 方法删除 · 死 glue 随 T9 收 —— checkable: grep pin 绿 · 现有 projection/cli 值域 pins 零重锚绿
  - 跑引擎 vitest 全绿（既有值域 pins 零重锚 · 错误字节不变）+ smoke-cdd —— checkable: 引擎 vitest 全绿 · smoke-cdd 绿
  - COMMIT —— checkable: git commit 落 · precommit 过
- **Acceptance**: VALUE_SHAPES 单源（键 == 四校验型）· parseArg 零手写 per-key 复刻（grep pin）· 错误字节/退出码/`next:` 字面零变（pins 未动）· 引擎 vitest + smoke-cdd 绿
- **DependsOn**: none

### Task 8: cli.ts 组合根拆分落地（lifecycle/gate/artifacts 面）
- **Objective**: `face/cli.ts`（1777 行）组合根瘦身至组合职责（wire + exit + parse）· 领域面抽离三文件——`face/lifecycle.ts`（派发 + readback + 轮询构造）· `face/gate.ts`（target/line 门族）· `face/artifacts.ts`（纯命令域）· 行为等价（spec §6.2 拆分契约）
- **Files**: Modify: face/cli.ts（拆瘦）；Create: face/lifecycle.ts、face/gate.ts、face/artifacts.ts；Test: face/__tests__/cli.test.ts、session/__tests__ 既有（导入面零破坏）
- **Consumes**: T2 readback 面（已重构）· T7 值域面 · cli.ts 既有方法边界集（composition `#wireActions`/`#runInput`/`#wireTreeOutput` + exit `#normalizeExit`/`#usage`/`#exitCode` 留根 · lifecycle `#dispatch`/`#opOf`/`#roleOf`/`#skillRef`/`#childPrompt`/`#valuesOf`/`#outputOf`/`#evidenceName`/`#reviewRange`/`#waveBrief`/`#fixedPoint`/`#parseBlockReturn`/`#reconstruct`/`#reject`/`#materialize`/`#canonicalArtifacts`/`#prescribedArtifact`/`#workStatus`/`#schemaText`/`#evidencePrefix`/`#familyOf`/`#stringMap`/`#commitsOf`/`#findingsList`/`#resumeOf` → lifecycle · gate `#lineGate`/`#docLineBlock`/`#pendingFixBlock`/`#docContent`/`#docVersionOf`/`#linePhase`/`#lineKey`/`#lineParams`/`#lineRoundRoute`/`#lineFixRoute`/`#tasksOf`/`#renderBrief`/`#refFromHandoff` → gate · artifacts `#runSchemaGen`/`#today`/`#runIssue`/`#baseSet`/`#baseGet`/`#readBase`/`#readText` → artifacts · 根保 `#docOf`/`#dispatchOf`）
- **Produces**: `CliLifecycle`/`CliGate`/`CliArtifacts` 三类（构造入共享 scene/io/ledger/handoffSchema 上下文 · 零裸函数 · 根 Cli 持有并经 `.action` 薄壳组合）· cli.ts 缩至组合职责（目标 ≤ ~600 行 · 非硬 pin）· 公开导出零变（`Cli`/`runArgv` 等消费面不动）
- **Steps**:
  - 方法边界映射核验（grep `^  #` 清单按 spec §6.2 分组）· 先写「零导出变化」pin（cli.test：`Cli`/`runArgv` 同名存在）—— checkable: 基线绿
  - 抽 `face/lifecycle.ts`（readback 面按 T2 重构后原样搬移 · 方法签名加共享上下文参数 · 内部互调转为类方法）· 根 Cli 以 lifecycle 实例替换原方法调用点（`.action` 薄壳经 lifecycle）—— checkable: cli.test 子集绿
  - 抽 `face/gate.ts`（门族原样搬移 · 无行为改动）· 根接线 —— checkable: cli.test 子集绿
  - 抽 `face/artifacts.ts`（base/schema/issue 域 run 原样搬移）· 根接线 —— checkable: cli.test 子集绿
  - 根 Cli 收尾瘦身（仅 composition + exit + parse · 无领域行为）· 跑全量引擎 vitest（行为等价 · 既有 pins 零断言重写）· smoke-cdd —— checkable: 引擎 vitest 全绿（零断言重写）· smoke-cdd 绿
  - 记录组合根行数与拆后各文件规模（closeout 交付证据）· COMMIT —— checkable: git commit 落 · precommit 过
- **Acceptance**: 四文件落位 · cli.ts 缩至组合职责（wire+exit+parse）· 公开导出零变化（导入 pins 绿）· 全量引擎 vitest 绿（行为等价 · 零断言重写）· smoke-cdd 绿 · 零新增公开 CLI 面
- **DependsOn**: 2, 7

### Task 9: 死接线清理（R7.3）
- **Objective**: T7/T8 暴露的 retired glue/判别器死代码逐项清理（spec §6.3 预列清单 + 发现即清理）· grep 零残留 pin 入验收
- **Files**: Modify: 由 T7/T8 暴露的 files（face/projection.ts · face/lifecycle.ts/cli.ts）· destroy-list 记录（Change history 尾）；Test: face/__tests__/cli.test.ts、face/__tests__/projection.test.ts（grep pin）
- **Consumes**: T7 销毁面（parseArg 手写单体）· T8 拆分暴露面（old glue）
- **Produces**: 销毁清单（预列：`#parseEnum`/`#parseInts`/`#parseSha8`/`#parseInt` 手写单体 · T7 已删 · 拆分时识别出的 retired 判别器/投影残面）应用 · **spec §6.3 对表逐项核销**（预列销毁面以识别名对照：`#parseTypeKey`/`SCHEMA_TYPE_KEYS` 按 T7 处置**保留**不入销毁清单 · 清单之外 spec §6.3 项逐项核销或记录保留理由 · 两类清单对表口径见 Acceptance）· 每个识别名 grep 零残留 pin
- **Steps**:
  - 对照预列销毁清单逐项核销（含 T7 已销毁的 parseArg 单体）· 逐项对 spec §6.3 预列销毁面（`#parseTypeKey`/`SCHEMA_TYPE_KEYS` 保留项按 T7 处置记录、不入本清单）· 拆分识别的新残面（如 gate/lifecycle 移交后孤儿 helper）列入「发现即清理」清单并移除 —— checkable: 清单逐项已销 · 两类清单对表在册
  - 每识别名 grep 零命中 pin（单测内 `grep` 断言或 cli.test 顶层）—— checkable: FAIL → 绿
  - 跑引擎 vitest 全绿 + `node scripts/run.ts precommit` —— checkable: 引擎 vitest 全绿 · precommit 过
  - COMMIT —— checkable: git commit 落 · precommit 过
- **Acceptance**: 预列 + 发现清单逐项零残留（grep pins）· spec §6.3 预列销毁面以识别名逐项对表（`#parseTypeKey`/`SCHEMA_TYPE_KEYS` 保留项以保留理由记录在册 · 其余销毁项 zero residual）· 引擎 vitest + precommit 全绿
- **DependsOn**: 7, 8

### Task 10: 变更集 minor 归并 + EOF
- **Objective**: 一个 cdd-engine 变更集（minor · 1.0.0 → 1.1.0 pending · 不发布）· `pnpm exec changeset status` 无 empty 条目 · `pnpm run validate` ALL PASS · EOF 全绿
- **Files**: Create: .changeset/<slug>.md（新变更集）；Modify: 触及文件 EOF 新行检查
- **Consumes**: 全部任务闭合 · 发布姿态 D15-Q4（不发布）
- **Produces**: 变更集（cdd-engine · minor · R1–R7 归并主题）· VALIDATE 通
- **Steps**:
  - `pnpm run changeset` 写单条 cdd-engine minor（1.1.0 pending · 主题：handoff 分面重构 · 声称→pin 把门 · draft 白名单 · 值域声明派生 · cli.ts 拆分 · wave 门控 plan 修订感知 · 不发布）—— checkable: .changeset/<slug>.md 在册
  - `pnpm exec changeset status` → 无 empty 条目（断言）—— checkable: status 输出无 empty
  - 触及文件 EOF newline `tail -c 1` 校验全 `\n`（缺则补 · 独立改）· `pnpm run validate` ALL PASS —— checkable: EOF 全 `\n` · validate ALL PASS
  - COMMIT —— checkable: git commit 落 · precommit 过
- **Acceptance**: 变更集在册（不发布）· `changeset status` 无 empty · `pnpm run validate` ALL PASS · EOF 全绿
- **DependsOn**: 1, 2, 3, 4, 5, 6, 7, 8, 9

### Task 11: wave 门控 plan 修订感知（D16 · 用户裁定并入 p4）
- **Objective**: `WaveGate` 门控改 plan 修订感知——wave review 完成时审查的 plan 修订记入该 wave 行（`recordReviewedDocRevision` 同型同源 · 复用 doc 面机件 · run.ts bookkeep 完成时点）· `#phaseOf` 相位解析前置查 `docLineVerdict` 漂移——**plan 路径自该 wave 行的审查记录派生（`reviewedDocRevisionOf(waveKey)?.doc` · 门控零新参数 · `WaveGate.vet` 签名不动）**· plan 移动 → wave 重开于 review（挂起 fix 作废 · 新修订新 review · findings 对当前修订再生）· 同修订 + pending fix 的 BLOCK 不破（Review Convergence 反自旋）· **零新增路径面：cli.ts / preflight.ts 零 diff（不进 planPath 于 gate · 用户裁定 2026-10-12 cli.ts doc/planPath 重复为债）**（spec §8）
- **Files**: Modify: session/run.ts（:523-533 wave review 完成记录点 · 复用既有 `#planPath`）；Modify: session/wave.ts（`#phaseOf` 漂移前置 · 自记录派生）；Test: session/__tests__/wave.test.ts、session/__tests__/run.test.ts
- **Consumes**: `recordReviewedDocRevision` / `reviewedDocRevisionOf` / `docLineVerdict`（ledger.ts:446/:459/:473 · doc 面既有机件 · 零新机件类）· `DocRevisionRef` · Lifecycle 既有 `#planPath`（P4 T1 · `--plan` 事实 · 零新字段）· `WaveGate.vet` 现签名（不动）
- **Produces**: 漂移感知门控行为——plan 文本移动后 open wave 挂 fix 时 `cdd review --type wave` 放行（新修订重开 review · findings 对当前修订再生）· 同修订 + pending fix 仍 BLOCK · `null` 记录向后兼容（legacy wave 行行为不变）· `WaveGate.vet` 签名零变（无 planDoc/planPath 参数）
- **Steps**:
  - 写失败测试（wave.test）：open wave 挂 fix（review 1 · fix 0）· 先 `recordReviewedDocRevision` 绑审查时点 plan 修订 → 改 plan 文件内容（漂移）→ `vet(requested, "review", graph, ledger, words)` 原签名调用 ok（相位解析 review · 不再 wrong-phase）—— checkable: 该测试 FAIL（现 `#phaseOf` 量 fix）
  - 写反自旋 pin（wave.test）：同修订（plan 未动）+ pending fix → `vet(requested, "review")` 仍 wrong-phase（「the open wave is at fix」· Review Convergence 语义不破）· 加 null 记录 legacy 用例（无 `reviewedDocRevision` 的 wave 行照旧 BLOCK）—— checkable: 该测试 FAIL（drift 分支未接入）
  - run.ts 接线：wave review 完成（`frame.target.kind === "wave" && frame.phase === "review"`）→ `#recordReviewedDocRevision(frame, this.#planPath)`（doc 面同款 · plan 路径单源 = 既有 `#planPath` · plan 读于 bookkeep 时点——clean-tree 门控保跨轮稳定）—— checkable: run.test 断言 wave 行 `reviewedDocRevision` 落（plan doc_hash）
  - wave.ts 接入：`#phaseOf` 在 `fixes < reviews` 分支前置——`const rev = ledger.reviewedDocRevisionOf(waveKey)` · `rev !== null && ledger.docLineVerdict(waveKey, rev.doc) === "drift"` → "review" · 否则 "fix" 照旧 · `vet`/`#phasesOf` 签名零动 —— checkable: 漂移用例绿 + 反自旋/legacy 用例绿
  - 零路径面 pin：cli.ts / preflight.ts 零 diff（对这两文件 `git diff` 空 + `WaveGate.vet` 调用点原样）—— checkable: 两文件 tree diff 空 · tsc 绿
  - `node scripts/run.ts validate` ALL PASS · 引擎 vitest 全绿（既有 wave/cli 门控 pins 零动）—— checkable: validate ALL PASS · 引擎 vitest 全绿
  - COMMIT —— checkable: git commit 落 · precommit 过
- **Acceptance**: wave review 完成记录审查 plan 修订（wave 行 `reviewedDocRevision` 在册 · 同型同源 · plan 路径单源既有 `#planPath`）· plan 移动 → wave 重开于 review（`cdd review --type wave` 不再 wrong-phase BLOCK · findings 对当前修订再生）· 同修订 + pending fix 仍 BLOCK（反自旋不破）· drift 仅作用 fix 挂起解析 · null 向后兼容 · **门控零新参数（plan 路径自审查记录派生）· cli.ts / preflight.ts 零 diff（零新增路径面）**· 零消费面（verdict/退出码零动）· 引擎 vitest 全绿 · validate ALL PASS
- **DependsOn**: 1

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.5 | 2026-10-12 | P4 计划 v0.5——**T11 新增（D16 · 用户裁定「并入这个 phase 一起处理」· 2026-10-12 · 与 spec v0.5 同步 · 非后置）**：wave 门控 plan 修订感知（R8）入计划——T11 **DependsOn 1** → 重启的合体波 {2,3,5,11} 一起实现（v0.4 重派 + D16 门控修复同波）· T11 objective/steps/acceptance 按 spec §8（wave review 完成记录审查 plan 修订 · `#phaseOf` 前置查 `docLineVerdict` 漂移 → 重开 review · 挂起 fix 作废 · 反自旋不破 · 零消费面）· **re-裁定零新增路径面（用户 2026-10-12：cli.ts doc/planPath 重复为债 → 门控零新参数 · plan 路径自审查记录 `reviewedDocRevisionOf` 派生 · cli.ts/preflight.ts 零 diff · 记录侧复用既有 `#planPath`）**· Review Focus +「重审门控修订漂移」行 · T10 变更集主题 + wave 门控 · 五波依赖序 W1={1,4,7} → W2={2,3,5,11} → W3={6,8} → W4={9} → W5={10} | Oscar M. · Claude Opus 5（kairos:cdd-plan 编排器回填 · 用户裁定 · 2026-10-12） |
| v0.4 | 2026-10-12 | P4 计划 v0.4——**T3 写平面声明派生回填**（用户裁定 · 2026-10-12 · 与 spec v0.4 同步 · 合并 T3 F3 finding）：T3 从「写入面 ⊆ 声明, mod engine-authority status」收为**写平面 = `keyof properties ∪ engineOnly[face]` 声明派生** · findings 声明节点 `engineOnly: ["status"]`（滚动结论引擎权威）· **`HANDOFF_WRITE_PLANE` 平行表销毁**（10 键声明再抄债 · 前提③）· 投影①②按 engineOnly 过滤（child 视图零引擎专属键 · child draft 写 engineOnly → 校验拒）· guard ⑥ authority 卫生（engineOnly 被引擎写路径消费 + 不进 child 投影）· 投影一致性 check 语义同步（fence == 声明 minus engineOnly）· guard 单测三失败面翻新（角色混杂 · engineOnly 泄漏 · 投影不一致） | Oscar M. · Claude Opus 5（kairos:cdd-plan 编排器回填 · 用户裁定 · 2026-10-12） |
| v0.3 | 2026-10-12 | P4 计划 v0.3——T5 单句白名单回填（用户裁定 · 2026-10-12 · 与 spec v0.3 同步）：T5 从**逐壳字段枚举 + INPUT_FINDINGS 只读护栏句**收为**逐壳一句严守 schema 指令**（字段源 = `HANDOFF_SCHEMA` 注入面 · 手动枚举 = 平行表债 → 排除 · 键集字面零残余）· 单句字节 pin · T6 探针 C 升任**单句是否足够的可证伪仲裁**（3 轮 0/3 · 非 0/3 → 补具体陷阱句）· Review Focus 两壳单句互指同步（findings 必填不被告知不得写） | Oscar M. · Claude Opus 5（kairos:cdd-plan 编排器回填 · 用户裁定 · 2026-10-12） |
| v0.2 | 2026-10-12 | P4 计划 v0.2——plan review round 1 fix（plan-review-1 · 5/5 受理）：① T3 机器判子集方向修正（引擎写入面 ⊆ 对应 face 声明 properties · 未声明写入 → FAIL · 与 spec §3.1 一致）；② T1 载体类型改由声明派生（mapped type 自 BY_FACE[face].properties 键集 · 兜底断言降级 · 零手写平行字段表）；③ T7/T9 spec §6.3 对表：`#parseTypeKey`/`SCHEMA_TYPE_KEYS` 处置显式记录（保留 · doc-key 词汇与 ChannelValueType 值形状表正交 · 不入销毁清单）；④ T5 DependsOn 补 1；⑤ T1 handoffOf ↔ buildHandoff overloads 命名映射注 | Oscar M. · Claude Opus 5（kairos:cdd-plan docs-fix · plan-review-1 · 2026-10-12） |
| v0.6 | 2026-10-12 | **P4 closeout（cdd-close）**：五波次实现链全闭合——W1={1,4,7}（载体类型声明派生 · guard 平面审计 · 声称→pin lint）→ W2={2,3,5,11}（写平面声明派生 + engineOnly · draft 白名单单句化 · 值域校验声明派生 · wave 门控 plan 修订感知 R8 · 合体波 · cli.ts/preflight.ts 零 diff）→ W3={6,8}（T6 复现探针 A/B/C 双层 + 观测：物化零 findings + fix 提示面严守句 · 3 轮首 BLOCK 0/3 · T8 cli.ts 组合根拆分 lifecycle/gate/artifacts 三面 · 1795→818）→ W4={9}（死接线清理核销 · 预列+保留对表逐识别名零残留 sweep pin · 1 nit → fix：engineSourceTexts 扩 src-next 根）→ W5={10}（变更集 minor 归并 · cdd-engine 1.1.0 pending · 无 empty 条目）· 全波 implement→review→fix 各 APPROVED（引擎 vitest 513/513 · validate ALL PASS · EOF 全绿）· 分支终审 → 分支 fix 闭环（1 nit → fix：guard `HANDOFF_WRITE_PATH_FACES` 写点清单对齐 T8 主写面）· Review Focus 全项覆盖（重审门控修订漂移经 R8 落地）· 父 overall v2.7 登记 P4 → Done | [human] · Claude Opus 5（kairos:cdd-close · closeout-backfill） |
| v0.1 | 2026-10-12 | P4 计划 v0.1——引擎 handoff 平面卫生 + commander 引入面收敛实现计划（T1–T10 · 五波依赖序 W1={T1,T4,T7} → W2={T2,T3,T5} → W3={T6,T8} → W4={T9} → W5={T10}）：分型类型族 · face 感知读写 · guard 平面审计 + 声称→pin lint · 逐壳白名单 · 复现探针（3 轮首 BLOCK 0/3）· VALUE_SHAPES 值域派生 · cli.ts 拆分三面 · 死接线清理 · 变更集 minor 不发布 | Oscar M. · Claude Opus 5（kairos:cdd-plan · spec v0.2 批准 · 2026-10-12） |
