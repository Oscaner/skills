# 引擎文档工具（Engine Doc-Tooling）— P4 设计：引擎 handoff 平面卫生 + commander 引入面收敛
- **Version**: v0.2 · 2026-10-12
- **Status**: Draft
- **Author**: Oscar M. · Claude Opus 5（kairos:cdd-design [P4] 会话 · 用户裁定 · 2026-10-12）
- **Parent program**: [2026-10-10-engine-doc-tooling-overall](2026-10-10-engine-doc-tooling-overall.md)
- **Depends on**: P3（Done · v0.14 · hard——P3 框架化后的 handoff 平面 + commander 命令树为 P4 分型基座）

## Design

本 phase 收口 P3 开发观测暴露的**两台引擎问题**（D13）与 commander 引入面遗留（D14/D15）：① **HandoffCarrier 合约面 vs 产物面自不一致**——`buildHandoff` 单骨架恒写 `findings`，work 面声明不含却落到 work 终态载体（违反引擎自身 v1.30「carrier holds only the schema's declared plane」原则）· 子代理从 `INPUT_FINDINGS` 镜像形态 → fix draft `findings` slip 3/3 首次必现 BLOCK；② **行为声称 vs 测试把门缝隙**——changeset「usage 行来自 commander」声称超前于实现 · 单波 review 拦不下 · 分支终审才逮；③ **commander 引入面**——P3 实测 face 层净 −249 行（−7.2%）但「最大精简」未显著兑现 · 心智负担 = 声明面 + commander 树 + 手写 parseArg 复刻三套模型 · cli.ts 仍 1777 行巨型组合根。

六前提整评（拆/重组 · OOP 统一 · 零裸函数 · 死面清理 · 最大精简）：修法 = **分型重构 + 声称→pin 把门 + 声明派生收敛**——非容忍/补丁（排除「work face 声明 findings 可选」与「read-back 容忍剥离」）。设计输入：kairos:cdd-design [P4] 会话裁定（D13 注册 · D14 R7 并入 · D15 grilling 四裁定 Q1→c/Q2→b/Q3→a/Q4 · 2026-10-12）· overall v2.5——Q1→c = R1/R2 分型形态（编译期 work 载体无 findings）· Q2→b = R3/R4 把门形态（guard 结构机器判 + review lens 语义契约行）· Q3→a = cli.ts 组合根拆分落地 · Q4 = 发布姿态不发布（§7.1 · AC11）。

### 1. 目标与边界
#### 1.1 行为语义增量
- **HandoffCarrier 分面分型**——`buildHandoff` 按 face 独立成型 · work 载体物理不含 `findings` 字段 · 恢复 v1.30 原则 · 编译期类型级把门（Q1→c）；**产物形状 ⊆ 声明面机器校验**（guard 平面审计扩项 · Q2→b）；**review lens 声称→pin 契约行**（D13 缺陷②修法）；**draft 指令白名单**（读入边界护栏 · 降 fix draft 首次 BLOCK 摩擦）；**值域校验声明派生**（parseArg 手写复刻消解）· **cli.ts 巨型组合根拆分落地**（Q3→a）· 死接线清理 · 心智负担收敛（两套模型可见）
#### 1.2 非目标（域语义零动）
- 领域 run（Lifecycle/PreFlight/Capsule/host）语义零动 · doc-contract 判定语义不变（gate 零例外）· 命令树/旗标/值域**消费面**语义零动（CLI 字节/帮助/usage 面不动）· `schema gen` 渲染（SkeletonAssembler/Projector 代码面不动）· 引擎 vitest 断言面既有 pins 语义保 · 跨程序 rename sweep 面（`src-next` 字面 · D8 拆 pin）· 不发布

### 2. HandoffCarrier 分型重构（R1/R2 · 类型族分面构造 · Q1→c）
#### 2.1 载体类型族（WorkCarrier / FindingsCarrier）
- **`WorkCarrier`** / **`FindingsCarrier`** 两个独立声明类型（`session/handoff-schema.ts` 增声明）——**编译期契平面**：`work` 载体类型**不含 `findings` 键**（TS 对象字面量写 `findings` → 类型错）· `findings` 载体 required `findings` · 两型均承载声明字段集（work：status/failure_category/artifacts/commits/changes/notes · findings：findings/artifacts/commits/notes——与 `CARRIER_WORK`/`CARRIER_FINDINGS` 声明同源）
- **由声明派生**：类型字段集 = `BY_FACE[face].properties` 键集（构造函数签名从声明推导 · 零手写平行字段表——`faceSchema(face)` 单源 introspection · 声明改 → 类型随动）
#### 2.2 buildHandoff 分面出口
- `ledger.buildHandoff` 从共享骨架（:603-616 恒写 `findings`）改为**按 face 分型独立成型**：work 面返回 `WorkCarrier`（零 findings 键）· findings 面返回 `FindingsCarrier`（findings 键）— 分面构造**单出口**（`handoffOf(face, init)` 类方法族 · 零并行载体构造 · 零裸函数）
- `run.ts #bookkeep`（:494-522）兜底构造改分面调用（work outcome 兜底零 findings 注入）
#### 2.3 face 感知读写
- **`#reconstruct`（cli.ts:511-555）**：work 面零 `findings` 读取路径——:529 无条件 `draft.findings` 读取消除（findings 面才读）· work 面即 `schema.violations` 已拒 findings 的证伪面（无需 `Array.isArray(draft.findings)` 兜底）
- **`#materialize`（cli.ts:581-607）**：work 面不再传 `findings: []`（:592 条件分支随分型机制消失）· findings 面 `findingsList` 归一保留
- **`#bookkeep`（run.ts:494-522）**：work 面兜底载体零 findings（:500-504 分面化）
- **产物面闭合**：work 终态载体 `.json`（persistHandoff 落盘）物理零 `findings` 键——任何含 findings 的 work 载体 = 类型错 + 机器判失败（§3.1）

### 3. 产物 ⊆ 声明 + 声称→pin 把门（R3/R4 · Q2→b：结构机器判 + 语义契约行）
#### 3.1 机器判——guard 平面审计扩项 + 载体形状 vitest
- **guard 平面审计扩项**（`scripts/lib/guard.ts` · checkChannels :658-698 同族新增）：`checkHandoffPlane`——① 声明的 face 属性集闭合（work/findings 属性集互斥 · 与引擎写入面交集 ⊆ 声明面：templates 壳指令的字段枚举 ∩ persist 路径字段 ⊆ `BY_FACE[face].properties`）· ② 声明-提示单源 check（`schemaText` 提示面 fence 字节 == 声明面 JSON 序列化——同文件双投影一致性机器化 · 既有一手发动机「prompt 不能展示引擎不执法的 schema」不变式）· ③ 入 validate 编排（scripts/run.ts 接线）
- **载体形状 vitest**（引擎套件 colocated pin）：`handoffOf("work", init)` 键集 == `faceSchema("work").properties` 键集（零 findings）· `handoffOf("findings", …)` 含 findings · 断言**物化落盘**（dry-run 派发一轮 · 终态 work 载体 JSON `findings` 键零命中）
#### 3.2 review lens 声称→pin 契约行（D13 缺陷②修法）
- **类型化契约行**：plan/spec 的「行为声称」引用 colocated pin 位置（`path:line`）——声称面逐项查测试钉 · P3 #2 usage 行落空类在单波拦下；**usage 回归 pin 正式入验收**（域 run usage 行 colocated pin · d51efe19 已补 · 原凿）
- **机器 lint 兜底**：guard 扩项扫声称→pin 引用——引用的 `path:line` 存在 · 该文件含测试断言字面（断言非空）· 不存在/空断言 = 结构 finding（Node lint · 入 validate）
- **review lens 检查项**（review 变体 fixed prefix · templates.ts REVIEWS 每型 axesGuide 增补）：spec/plan 评审逐声称核 colocated pin 对照（缺失 → 依据 lens 判 warn/blocker）——语义判断留 reviewer · 结构存在性机器兜底

### 4. draft 指令面白名单（R5 · 读入边界护栏）
#### 4.1 指令面白名单枚举
- **逐壳指明字段集**（render/templates.ts FIX_SHELL / DOCS_FIX_SHELL 两壳独立枚举）：
  - **`FIX_SHELL`（work face）**：`## Handoff schema` 允许字段（status/failure_category/artifacts/commits/changes/notes——work 面）· **`INPUT_FINDINGS` 只读边界护栏句**：README-输入 「`INPUT_FINDINGS` 是只读 findings 载体——不得把其顶层字段（尤指 `findings`）镜像进 work 壳 draft · 只写 `## Handoff schema` 声明的字段」（P3 3/3 首次必现根因：子代理从 review 载体镜像顶层 shape）
  - **`DOCS_FIX_SHELL`（findings face）**：`## Handoff schema` 允许字段（findings/artifacts/commits/notes——findings 面 · 载体 required findings 与白名单同面不矛盾）· **`INPUT_FINDINGS` 只读边界护栏句同款**（findings 面 draft `findings` 声明自源 review 载体——原样携带不改 · 不镜像顶层其余字段）
- **零负向散文 pin**：白名单用枚举 + 一句护栏（不列反例清单）——指令字面自解释 · 六前提「零散文水肿」
#### 4.2 colocated pins
- templates 字节 pin（render.test/新 pin）：FIX_SHELL/DOCS_FIX_SHELL 逐壳字段枚举（work 面 vs findings 面）各含 `findings` 白名单枚举句 + 只读护栏句 · work 壳字段枚举 + findings 壳字段枚举 == 各自声明 `properties` 键集（单源回归 · 改声明 → pin 断言随动语义保）

### 5. 复现探针 + 验收（R6）
#### 5.1 复现探针
- **work draft 带 `findings` 首次消解探针**：dry-run 派发 → 子代理 draft 含顶层 `findings`（P3 真实形态）→ 首次轮**无 BLOCK**（draft 白名单已言明）或按白名单降摩擦 · **可判定阈值**：连续 3 轮 dry-run 派发，首次轮 BLOCK 计数 = 0/3（P3 对照为 3/3 首次必现 → 收敛到 0）· 探针断言以 pinned 形态记录实际计数（每轮首次 BLOCK 次数 + 消解轮次），使 AC7 可证伪——非 0/3 即不达验收
- **载体零 findings 物化探针**：全链跑一轮（implement → review → fix 均 dry-run）· 终态 work 载体 `findings` 键零命中（grep 断言）
#### 5.2 验收表面
- vitest 全绿（含新 pins：类型族构造 · guard 平面审计 · 声称→pin lint · 白名单字节 · 探针）· `pnpm run validate` ALL PASS · EOF 全绿 · grep 零残留（死面清单逐项 · §6.3）· 不发布

### 6. commander 引入面收敛（R7 · 三项全入 · Q3→a）
#### 6.1 值域校验声明派生（parseArg 手写复刻消解）
- **现复刻面**（face/projection.ts）：`#parseEnum`（values join 复刻）· `#parseInts`（逗号拆分 + 整数模式）· `#parseSha8`（hex 正则）· `#parseInt`（数字模式）——手写 key-by-key · 与 declare ARGV_CHANNEL 行 `type`/`values` 平行
- **声明派生**：值域校验器 = **ChannelValueType → 形态规则数据表**（declare.ts 声明 · `int-list` 分隔符/归一化 · `sha` 正则 · `int` 模式 · `enum` 域——单表单源）· `#parseArgOf` 从行 `type` 查表派发（零手写 per-key 复刻 · `#parseTypeKey` 的 SCHEMA_TYPE_KEYS 派生先例推广到别型）· `#parseEnum/#parseInts/#parseSha8/#parseInt` 手写单体销毁（并入数据表 + 通用执行器）· 值域行为字节零变（commander 原生错误面保）
#### 6.2 cli.ts 巨型组合根拆分落地
- **拆分契约**：`face/cli.ts`（1777 行）组合根**瘦身至组合职责**——wire 程序 + capsule 输出 + 退出归一（`#wireActions`/`#runInput`/`#wireTreeOutput`/`#dispatchOf`/`#normalizeExit`/`#usage` 留根）· 领域面抽离：
  - **`face/lifecycle.ts`（核心）**——implement/review/fix 派发面 + readback（`#reconstruct`/`#reject`/`#materialize` + 载体辅助）+ 轮询构造（`#valuesOf`/`#childPrompt`/round-context 数据）· 因 R1/R2/R5 已重构该面核心数据流 · 「readback/轮询为领域面」天然边界
  - **`face/gate.ts`**——target/line 门族（`#lineGate`/`#docLineBlock`/`#pendingFixBlock`/`#linePhase`/`#lineKey`/`#lineParams`/`#lineRoundRoute`/`#lineFixRoute` + `#tasksOf`/`#renderBrief`/`#refFromHandoff`）
  - **`face/artifacts.ts`**——纯命令域（`#runSchemaGen`/`#today`/`#runIssue`/`#baseSet`/`#baseGet`/`#readBase`/`#readText`）
- **行为等价**：全量 vitest 绿（既有 pins 语义保 · 方案移面不破断言）· smoke-cdd 回归绿 · 零新增公开 CLI 面 · 组合根规模目标（≤ ~1/3 现状）留作上限区间（非硬 pin）
#### 6.3 死接线清理
- **销毁清单（预列 · P3 §6 手法 · 识别名）**：§6.1 声明派生消解的手写复刻**面内删除**——`face/projection.ts` `#parseEnum`/`#parseInts`/`#parseSha8`/`#parseInt`/`#parseTypeKey` + `SCHEMA_TYPE_KEYS` 词表（并入 `ChannelValueType → 形态规则数据表` · 行为字节零变）· **P3 遗留投影残面**：随 §6.2 拆分退役的组合根判别器/glue 逐项补列本清单（拆分落地时以识别名回填 · 文件级删除或面内删除）· **grep 零残留 pin 入验收**
- 执行中暴露的退役项：**发现即清理**——也以识别名记入本清单（保持「逐项」验收的确定枚举随执行扩展）
#### 6.4 心智负担目标
- **两套模型可见**——① 声明单源（declare.ts / handoff-schema.ts：数据 + 类型）② commander 原生（parse/help/验证执行器）——手写 parseArg 复刻（第三模型）随 §6.1 消解 · 验证执行器 = commander 原生消费声明 · 消费者/开发者看到两套模型上限

### 7. 变更集 · 测试 pins 处置
#### 7.1 变更集归并（不发布）
- 一个 cdd-engine 变更集 · 主题归并：R1–R7（handoff 分型 + 把门 + 白名单 + 声明派生 + 拆分）· 标 **minor**（1.0.0 → 1.1.0 · 消费面 CLI 语义零变 · 内部重构）· **不发布**（与 P3 同款）· `pnpm exec changeset status` 无 empty 条目
#### 7.2 测试 pins 处置
- 语义保（断言形态更替）：既有 work/review 载体形状 pins（materialize/readback 面）随类型族更替为 face-aware 断言 · run.test/cli.test 载体 `findings` 键断言翻新
- 新增（deliberate）：§3.1 载体形状 · §3.2 声称→pin lint · §4.2 白名单字节 · §5.1 探针
- **不动的面**：命令树/旗标/值域 pins · 错误字节 · 帮助/usage（commander 原生字节面零动）

### Acceptance criteria

- `work 终态载体 .json 零 findings 字段字面 ✓（产物面 ⊆ 声明面机器校验绿 · guard 平面审计 checkHandoffPlane 入 validate 全绿 · draw 探针：物化 work 载体 findings 键零命中）`
- `buildHandoff 分型单出口 ✓（handoffOf(face, init) · WorkCarrier/FindingsCarrier 类型族由声明 properties 派生 · 编译期 work 载体无 findings · 零并行载体构造 · 零裸函数）`
- `#reconstruct/#materialize/#bookkeep face 感知读写 ✓（work 面零 findings 读取路径 · cli.ts:529 无条件读取消除 · work 面零 findings 注入）`
- `guard 平面审计 + 声称→pin lint 全绿 ✓（声明属性集闭合 · 提示面-声明面单源 · pin 引用存在 + 断言非空 · 入 pnpm run validate）`
- `review lens 声称→pin 契约行 ✓（plan/spec 声称引用 colocated pin path:line · 逐声称核对照 · usage 回归 pin 正式入验收（域 run usage 行 colocated pin 在册）`
- `draft 指令面白名单 ✓（FIX_SHELL work 面字段枚举 + DOCS_FIX_SHELL findings 面字段枚举，逐壳各自 + INPUT_FINDINGS 只读护栏句 · 零负向散文 pin · 字节 pin 在册 · 与各自声明 properties 单源）`
- `复现探针 ✓（work draft 带 findings 首次即按白名单消解 · 连续 3 轮首次轮 BLOCK 0/3（P3 3/3 → 0）· 探针以 pinned 断言记录实际计数）`
- `R7 值域校验声明派生 ✓（ChannelValueType 形态规则数据表 · parseArg 从声明查表派发 · 手写 per-key 复刻销毁 · 错误字节 commander 原生零变）`
- `R7 cli.ts 拆分落地 ✓（组合根瘦身至组合职责 · lifecycle/gate/artifacts 面抽离 · 行为等价 = 全量 vitest 绿 + smoke-cdd 绿 · 零新增公开 CLI 面）`
- `R7 死接线清理零残留 ✓（销毁面 grep pins · P3 遗留投影残面清）· 心智负担目标达（声明单源 + commander 原生两套模型可见）`
- `引擎 vitest 全绿（含新 pins）· pnpm run validate ALL PASS · EOF 全绿 · 变更集 minor 归并（1.0.0 → 1.1.0 · 无 empty 条目）· 不发布`

## Constraints

- **结构保真**：本骨架 = 声明面派生（`schema gen phase-spec`）· 编辑器只填不重排——违反 = 保真破坏，视为 defect
- **行为语义零动**：领域 run（Lifecycle/PreFlight/Capsule/host）· doc-contract 判定 · `next:` dispatch 字面 · 命令树/旗标/值域消费面 · 跨程序 rename sweep 面
- **六前提整评许可**（P4 与 P1–P3 同款 · D13/D15）：分型重构 + 声明派生 + 拆分重组 · OOP 统一零裸函数 · 死面/死接线清理 · 高内聚低耦合 · 消费者心智负担 · 最大精简——**排除容忍/补丁**（work face 声明 findings 可选 · read-back 容忍剥离）
- **单一作者**（v1.30）：carrier 仅承载声明面 · work 载体不含 findings · 引擎是载体唯一作者（draft 验证后物化 · 不破坏 no-overwrite）
- **guard 平面不入死面**：checkHandoffPlane + 声称→pin lint 为新增结构性判（机器判面 · 与 checkChannels 同族）· 语义判断留 review lens（人不被机器挤走）
- **值域字节零变**：R7 声明派生不改 commander 原生错误字节/退出码/`next:` 字面（pins 语义保）
- **拆分行为等价**：cli.ts 拆分移面不破断言（全量 vitest + smoke-cdd 回归）· 零新增公开 CLI 面
- **变更集 minor 归并**（不发布 · 与 P3 同款）· `pnpm exec changeset status` 无 empty 条目
- **gate 零例外**：doc-contract 判定语义不变——骨架 by construction 绿 · 填后终判兜底
- **消费面零动**：CLI 帮助/usage/错误字节（commander 原生形态）不动 · 本次 drift 为引擎内部工程

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-10-12 | P4 设计 v0.1——引擎 handoff 平面卫生 + commander 引入面收敛：D13 两台引擎问题修法（HandoffCarrier 类型族分面构造（Q1→c）· 声称→pin 把门（Q2→b：guard 平面审计 + review lens 契约行）· draft 指令面白名单 · 复现探针）· D14/D15 R7 三项全入（值域校验声明派生 · cli.ts 拆分落地（Q3→a）· 死接线清理 · 心智负担两套模型可见）· 单一作者 v1.30 恢复 · 变更集 minor 归并不发布 · 六前提整评排除容忍补丁 | Oscar M. · Claude Opus 5（kairos:cdd-design [P4] 会话 · 用户裁定 · 2026-10-12） |
| v0.2 | 2026-10-12 | P4 设计 v0.2——spec review round 1 fix（spec-review-1 · 4/4 受理 · commit 1d0fabda）：§4.1/§4.2/AC6 **逐壳指明白名单**（FIX_SHELL work 面字段枚举 + INPUT_FINDINGS 只读护栏 · DOCS_FIX_SHELL findings 面字段枚举 + 同款护栏——findings 壳 draft findings 自源 review 载体原样携带 · 载体 required findings 与白名单同面不矛盾）· §5.1/AC7 探针阈值可证伪（**3 轮派发首次 BLOCK 0/3** · pinned 计数）· §1 设计输入行 D15 补显式映射 **Q4 = 发布姿态不发布** · §6.3 销毁清单预列（P3 遗留投影残面 + 拆分预知退役判别器/glue · 识别名 · 文件/面内删除）· 逐项验收起始起点确立 | Oscar M. · Claude Opus 5（kairos:cdd-design 编排器回填 · fix agent 1d0fabda · 2026-10-12） |
