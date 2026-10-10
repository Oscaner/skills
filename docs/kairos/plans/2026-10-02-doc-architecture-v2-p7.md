# 文档架构方法论 v2 — P7 Plan（Engine token 翻译能力接线：识别半 canonicalize · 元素表 English-primary）

**Spec:** [2026-10-02-doc-architecture-v2-p7-design.md](docs/kairos/specs/2026-10-02-doc-architecture-v2-p7-design.md)

- **Parent program**: [doc-architecture-v2-overall.md v1.62](docs/kairos/specs/2026-10-02-doc-architecture-v2-overall.md)
- **Version**: v1.0 · 2026-10-10
- **Depends on**: P2（Done · hard）· P3.2（Done · [p3.2-plan v1.31](docs/kairos/plans/2026-10-02-doc-architecture-v2-p3.2.md) —— serial-phase GATE 满足 · T19 翻译系统核心 + T20 base 命令面 carrying 基线）
- **Base**: develop

执行序（**波标签 = plan-graph board 派生标签 · W1 起序**）：W1 = {T1}（translate/words 面——canonicalize 识别面 + 3 数据行 · 自含绿）→ W2 = {T2}（contract 面——行源 seam + declare 3 锚 · 依赖 T1）→ W3 = {T3}（终验 · grep pin · changesets · 依赖 T2——严格串行链：T2 的 seam 消费 T1 的 canonicalize 与数据行 · T3 终验全绿为 closeout 前置）。

## Constraints

- **零新 CLI 子命令**：只动词表数据 / declare 元素 / 翻译层识别面 / 结构判定 seam（charter Non-goal #1 保持）
- **TDD colocated**：canonicalize / seam / 锚改写先测后写（各模块 `__tests__` 同址）；normalize 收敛用例随删随改
- **canonicalize 语义（T1 钉死）**：词表 locale 行驱动 span 替换（最长匹配）· **含登记 span 即替换、不越界吞并相邻文本**——`组件` → `group件`（件不动）· `cdd-engine 服务化主线（2026-09-13 用户升维）` → `cdd-engine service mainline（2026-09-13 用户升维）`（尾随未登记文本不动）· 英文行 / 未登记 zh 正文 identity 直通
- **视图零写回**：seam 规范化视图仅匹配用 · 文档原文零改动（tree zero-diff 断言）
- **历史正文零 retro-rename**：4 overalls 中文标题逐字不动（zh 变换触发面 = doc-arch overall 组/背书 + osuperpowers overall Goal）
- **zh 知识单源**：中文 alias 仅栖身词表 locale 面（新增数据行 · 零代码分支 · 元素表零中文 pattern 残留）
- **English-primary 消费面**：机器可识别面（declare 元素 / schema 描述 / DOC_TOKENS）英文含注释 grep 零 zh；内部 specs/plans 中文（Strategy B）
- **DependsOn 反依赖门**：边仅引用更小编号（编号序 = 拓扑线性化锚）
- **变更集义务**：cdd-engine 一枚独立提交（declare 改写 + words 数据行 + canonicalize + seam + 测试收敛）· kairos / docs 面零（overall 已随 v1.62）

### Task 1: Translator.canonicalize 识别面 + 词表 3 行 zh→en canonical 数据（translate/words 面）

- **Objective**: design §2.2/§3——`Translator` 增 `canonicalize(line)` 识别面（词表 locale 行驱动 span 替换 · 最长匹配 · 零 switch：`#byToken`/`#byAlias` 索引复用）· `normalize` 单 token 面**收敛并入**（删除 normalize 方法 · 单 token 判 = canonicalize 于单 token 行 · translate.ts 头注释识别措辞 normalize → canonicalize · T19 原义的 recognition face 唯一化）· words.ts 新增 3 行 zh→en canonical 数据（`charter.group-leaf`: {en: `group`, zh: `组`} · `charter.upstream-endorsements`: {en: `Upstream Endorsements`, zh: `上游先例背书`} · `charter.goal-title`: {en: `cdd-engine service mainline`, zh: `cdd-engine 服务化主线`}）——zh 知识唯一栖身词表 locale 面
- **Files**: `packages/cdd-engine/src-next/contract/translate.ts` · `packages/cdd-engine/src-next/face/words.ts` · `packages/cdd-engine/src-next/contract/__tests__/translate.test.ts`（normalize 用例收敛 + canonicalize 新用例）· `packages/cdd-engine/src-next/face/__tests__/words.test.ts`（若 data 面断言落此）
- **Consumes**: `WordLocaleFace`（`localeRows()` · 既存 issue-label zh 行）· word row 形态 `LocalizedWord`（`{ en, zh }`）
- **Produces**: `Translator.canonicalize(line: string): string`（zh alias span → en canonical · 未登记文本直通 · 零写回义务由调用方持——本方法纯函数）· 3 charter 数据行入 `localeRows()`
- **Steps**:
  - 失败先行：translate.test 新增 canonicalize 断言——`canonicalize("## 场景")` = `## Context`（既存 issue-label zh 行）· `canonicalize("M 组")` = `M group`（**初始引用新数据行之前红**——断言先行证红）— checkable: 断言红（canonicalize / 数据行不存在）
  - implement `canonicalize(line)`（`#byAlias` 构造非重叠最长匹配替换 · 未登录文本直通）· 删除 `normalize(input)` 方法 · 头注释 normative 段改（normalize → canonicalize 措辞 · recognition face 唯一化） — checkable: translate.test 既有 normalize 用例转 canonicalize 后绿
  - words.ts 新增 3 charter 行（`LocalizedWord` 形态 · 家族前缀 `charter.` 与 issue-label 并行）· rows 断言（`localeRow` 三行可读 · zh 面逐字） — checkable: 三行数据断言绿
  - 边界用例补齐：`组件` → `group件`（登记 span 替换 · 件不动）· `cdd-engine 服务化主线（2026-09-13 用户升维）` → `cdd-engine service mainline（2026-09-13 用户升维）`（尾随未登记文本直通）· 英文行 identity · 未登记 zh（「约束」「全关」）直通 — checkable: 全例绿
  - 引擎 vitest 全绿（translate/words 面）· grep `normalize(` 零残留（translate.ts 内） — checkable: 全绿 · 零命中
  - commit — checkable: `feat(engine): Translator.canonicalize recognition face + 3 charter zh→en rows (normalize folded)` 落位 · 树净
- **Acceptance**: `canonicalize(line)` 全用例绿（span 替换 / 复合词分界 / 部分匹配 / identity / 未登记词直通）· `normalize` 零残留 · 3 charter 行在册（zh 面逐字节）· 引擎 vitest 全绿
- **DependsOn**: none

### Task 2: 结构面行源 canonicalize 接线 + declare 3 锚 English-primary（contract 面）

- **Objective**: design §2.1/§4——结构判定解释器 **Contract.validate 行源处一次性 canonicalize 全部行** → 规范化行表（视图零写回）· 全部 valuePattern 判定面（presence occurrenceLines · domain carrierLines · section-scoped · crosslink——engine 内 `.valuePattern.test` 消费点 doc.ts:465 · invariants.ts:146/441/652/1221/1243/1245）统一对视图匹配 · declare.ts 3 中文锚改写英文 canonical（`"#### [MFRBEN] group"`/`"^#### [MFRBEN] group"` · `"#### Upstream Endorsements"`/`"^#### Upstream Endorsements$"` · `"^### (Goal|cdd-engine service mainline)"`）· 元素表头注随改——机器可识别标记全 English-primary
- **Files**: `packages/cdd-engine/src-next/contract/declare.ts`（3 锚改写）· `packages/cdd-engine/src-next/contract/doc.ts`（行源 seam 落点）· `packages/cdd-engine/src-next/contract/invariants.ts`（判定面消费视图）· `packages/cdd-engine/src-next/contract/__tests__/*`（接线断言）· `scripts/lib/guard.ts`（若树套件/guard 消费该面——核改）
- **Consumes**: `Translator.canonicalize`（T1）· `charter.*` 3 数据行（T1）· elements row 列表（anchor/valuePattern）
- **Produces**: 结构判定全面统一匹配规范化视图 · declare 3 锚英文 canonical · 4 overalls zh 标题经 seam 匹配
- **Steps**:
  - 失败先行：接线负例——英文锚改写后未接 seam：`cdd review`/judge 对 `#### M 组` 行报 missing（红）· 接 seam 后 4 overalls 全绿（证）— checkable: 先红后绿
  - Contract.validate 行源一次性 canonicalize 全部行（每行 `Translator.canonicalize(line)` → 行表）· 判定面改读行表（presence/domain/section/crosslink 全消费点）· 原行保留（视图不写回 · 文档零 diff） — checkable: 行表消费断言绿
  - declare.ts 3 锚改写（§4 表逐字）· 头注随改（zh pattern 叙 → canonical 叙事）· 未登记 zh 零涉 — checkable: grep declare.ts 零中文（含注释）
  - 4 overalls validate 绿（zh 标题经 seam · 触发面 = doc-arch + osuperpowers · consumer-parity/pi-harness identity 直通）· 57 校验文件树套件零排除绿 · 英文行回归（identity 直通） — checkable: 树全绿
  - commit — checkable: `refactor(engine): structure-plane canonicalize seam — Contract.validate row-source + declare 3 anchors English-primary` 落位 · 树净
- **Acceptance**: 4 overalls 全绿（zh 经 seam · 触发面 2）· 57 文件零排除 · declare.ts 零中文（grep 含注释）· 视图零写回（文档 zero diff）· 引擎 vitest 全绿
- **DependsOn**: 1

### Task 3: 终验 + 机器面 zh 零残留 grep pin + changeset

- **Objective**: design §6.2/§6.3（acceptance 全量断言）——引擎 vitest 全绿（含 T1/T2 新增断言净面）· typecheck ×3 · biome clean · validate ALL PASS · emit 新鲜 · 机器可识别面 zh 零残留 grep pin（declare 元素 / schema 描述 / DOC_TOKENS · 含注释）· 树零迁移零 diff 复核 · changeset（cdd-engine 一枚）落位
- **Files**: `packages/cdd-engine/src-next/**`（验证面）· `.changeset/*.md`（新增）
- **Consumes**: T1 canonicalize + 数据行 · T2 seam + 锚改写
- **Produces**: validate ALL PASS（全量健康门禁）· changeset 落位（cdd-engine minor/patch 定级由 change 面裁）
- **Steps**:
  - 引擎 vitest 全绿（`pnpm --filter @oscaner-skills/cdd-engine test`）· typecheck ×3 · biome（`pnpm exec biome check` 零违例） — checkable: 三命令 exit 0
  - 机器可识别面 zh 零残留 grep（`grep "[一-鿿]"` 作用域 = declare.ts + templates（schema 描述）+ DOC_TOKENS 派生源 · 含注释 · 排除词表 locale 数据行——zh 唯一栖身地） — checkable: 零命中
  - `pnpm run validate` ALL PASS（emit 新鲜 · engine behavior · channel audit · doc-contract gate 16+41=57 · package sync）· `pnpm run emit:check` 新鲜 — checkable: exit 0
  - changeset 落位（`pnpm run changeset`——cdd-engine DispatchContract 面收口的 minor·或按面 patch）· 复核 kairos / docs 面零 — checkable: `.changeset/*.md` 存在
  - commit — checkable: `chore(engine): changeset——canonicalize 识别接线 + declare English-primary（P7）` 落位 · 树净
- **Acceptance**: validate ALL PASS · typecheck ×3 · biome clean · emit 新鲜 · zh 零残留 grep 零命中（机器可识别面）· changeset 落位 · 树零迁移零 diff 保持
- **DependsOn**: 2

## Change history

| Version | date | summary | author |
|---|---|---|---|
| v1.0 | 2026-10-10 | 初版——P7 A 方案接线计划（overall v1.62 · spec v1.1 approved 后开写）：W1 {T1} canonicalize 识别面 + 3 charter 数据行（normalize 收敛并入）· W2 {T2} 结构面行源 seam + declare 3 锚 English-primary · W3 {T3} 终验 + zh 零残留 grep pin + changeset——严格串行三波 | [human] · Claude Opus 5（kairos:cdd-plan · spec v1.1 上游） |