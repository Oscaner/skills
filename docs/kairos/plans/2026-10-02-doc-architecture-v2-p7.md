# 文档架构方法论 v2 — P7 Plan（Engine token 翻译能力接线：识别半 canonicalize · 元素表 English-primary）

**Spec:** [2026-10-02-doc-architecture-v2-p7-design.md](docs/kairos/specs/2026-10-02-doc-architecture-v2-p7-design.md)

- **Parent program**: [doc-architecture-v2-overall.md v1.63](docs/kairos/specs/2026-10-02-doc-architecture-v2-overall.md)
- **Version**: v1.2 · 2026-10-10
- **Depends on**: P2（Done · hard）· P3.2（Done · [p3.2-plan v1.31](docs/kairos/plans/2026-10-02-doc-architecture-v2-p3.2.md) —— serial-phase GATE 满足 · T19 翻译系统核心 + T20 base 命令面 carrying 基线）
- **Base**: develop

执行序（**波标签 = plan-graph board 派生标签 · W1 起序**）：W1 = {T1}（translate/words 面——canonicalize 识别面 + 2 数据行 + goal-title 行暂存 · 自含绿）→ W2 = {T2}（contract 面——行源 seam + declare 2 锚 English-primary · 依赖 T1）→ **W3 = {T3}（v1.2 backfill：osuperpowers 清理——文档族 13 份删除 · goal-title 反向清 · Goal 还原 `^### Goal` · 过时 workspace 清理 · 依赖 T2）** → W4 = {T4}（终验 · grep pin · changesets · 依赖 T3——严格串行链：T3 清理面在 T2 锚改写之上、T4 终验对清理后树断言）。

## Constraints

- **零新 CLI 子命令**：只动词表数据 / declare 元素 / 翻译层识别面 / 结构判定 seam（charter Non-goal #1 保持）
- **TDD colocated**：canonicalize / seam / 锚改写先测后写（各模块 `__tests__` 同址）；normalize 收敛用例随删随改
- **canonicalize 语义（T1 钉死）**：词表 locale 行驱动 span 替换（最长匹配）· **含登记 span 即替换、不越界吞并相邻文本**——`组件` → `group件`（件不动）· 英文行 / 未登记 zh 正文 identity 直通（goal-title 部分匹配例随 T4 收回）
- **视图零写回**：seam 规范化视图仅匹配用 · 文档原文零改动（tree zero-diff 断言）
- **历史正文零 retro-rename**：doc-arch 中文标题逐字不动（zh 变换触发面 = doc-arch 组/背书）· **osuperpowers 文档族 13 份删除为唯一删除面（T4）** · CHANGELOG 历史条目零 retro-edit（史实即史实）
- **zh 知识单源**：中文 alias 仅栖身词表 locale 面（新增数据行 · 零代码分支 · 元素表零中文 pattern 残留）
- **English-primary 消费面**：机器可识别面（declare 元素 / schema 描述 / DOC_TOKENS）英文含注释 grep 零 zh；内部 specs/plans 中文（Strategy B）· **live 面 `osuperpowers` 零残留 grep pin（src-next + scripts + kairos + docs/kairos · CHANGELOG 史实豁免）**
- **capsule 消费面关闭**（design §5 / acceptance #5）：capsule 机器面（capsule.ts / words capsule 族）零改动 · English-constant 终态保持 · 人类可读面消费 = IssueBodyRenderer（localize 唯一渲染消费者）——关闭裁定入册，执行方「不碰 capsule」锚点显式
- **DependsOn 反依赖门**：边仅引用更小编号（编号序 = 拓扑线性化锚）
- **变更集义务**：cdd-engine 引擎侧一枚 changeset（change 边界 = 一枚 changeset；波内仍按 T1/T2/T3/T4 四提交常规节奏——`feat(engine)` · `refactor(engine)` · `chore(engine)` · `chore(engine)`，提交节奏与 change 边界显式解耦）· kairos / docs 面零（overall 已随 v1.63）

### Task 1: Translator.canonicalize 识别面 + 词表 zh→en canonical 数据（translate/words 面）

- **Objective**: design §2.2/§3——`Translator` 增 `canonicalize(line)` 识别面（词表 locale 行驱动 span 替换 · 最长匹配 · 零 switch：`#byToken`/`#byAlias` 索引复用）· `normalize` 单 token 面**收敛并入**（删除 normalize 方法 · 单 token 判 = canonicalize 于单 token 行 · translate.ts 头注释识别措辞 normalize → canonicalize · T19 原义的 recognition face 唯一化）· words.ts 新增 zh→en canonical 数据（`charter.group-leaf`: {en: `group`, zh: `组`} · `charter.upstream-endorsements`: {en: `Upstream Endorsements`, zh: `上游先例背书`}——**`charter.goal-title` 由本 task 落地、T3 随 osuperpowers 删除反向收回**· v1.2 backfill）——zh 知识唯一栖身词表 locale 面
- **Files**: `packages/cdd-engine/src-next/contract/translate.ts` · `packages/cdd-engine/src-next/face/words.ts` · `packages/cdd-engine/src-next/contract/__tests__/translate.test.ts`（normalize 用例收敛 + canonicalize 新用例）· `packages/cdd-engine/src-next/face/__tests__/face.test.ts`（locale 数据面既有断言同址：localeRows flat count 12→15 · 机器面免疫用例 canonicalize 语义改写 · 3 charter 行断言落位）
- **Consumes**: `WordLocaleFace`（`localeRows()` · 既存 issue-label zh 行）· word row 形态 `LocalizedWord`（`{ en, zh }`）
- **Produces**: `Translator.canonicalize(line: string): string`（zh alias span → en canonical · 未登记文本直通 · 零写回义务由调用方持——本方法纯函数）· 3 charter 数据行入 `localeRows()`
- **Steps**:
  - 失败先行：translate.test 新增 canonicalize 断言——`canonicalize("## 场景")` = `## Context`（既存 issue-label zh 行）· `canonicalize("M 组")` = `M group`（**初始引用新数据行之前红**——断言先行证红）— checkable: 断言红（canonicalize / 数据行不存在）
  - implement `canonicalize(line)`（`#byAlias` 构造非重叠最长匹配替换 · 未登录文本直通）· 删除 `normalize(input)` 方法 · 头注释 normative 段改（normalize → canonicalize 措辞 · recognition face 唯一化） · face.test.ts 机器面免疫用例按 canonicalize 语义改写（`canonicalize(words.station("next"))` = `"next:"` identity 直通 · 删既有 `translator.normalize(words.station("next"/"blocked"))` → toBeNull 引用——normalize 判空语义不存在于 canonicalize） — checkable: translate.test 既有 normalize 用例转 canonicalize 后绿 · face.test.ts 机器面免疫转写后绿
  - words.ts 新增 3 charter 行（`LocalizedWord` 形态 · 家族前缀 `charter.` 与 issue-label 并行）· rows 断言（`localeRow` 三行可读 · zh 面逐字）落位 face.test.ts · localeRows flat count 断言 12→15 更新（新 3 行入扁平表） — checkable: 三行数据断言绿 · flat count 15 绿
  - 边界用例补齐：`组件` → `group件`（登记 span 替换 · 件不动）· `cdd-engine 服务化主线（2026-09-13 用户升维）` → `cdd-engine service mainline（2026-09-13 用户升维）`（尾随未登记文本直通）· 英文行 identity · 未登记 zh（「约束」「全关」）直通 — checkable: 全例绿
  - 引擎 vitest 全绿（translate/words 面）· grep `normalize(` 零残留（translate.ts 内） — checkable: 全绿 · 零命中
  - commit — checkable: `feat(engine): Translator.canonicalize recognition face + 3 charter zh→en rows (normalize folded)` 落位 · 树净
- **Acceptance**: `canonicalize(line)` 全用例绿（span 替换 / 复合词分界 / 部分匹配 / identity / 未登记词直通）· `normalize` 零残留 · 3 charter 行在册（zh 面逐字节）· 引擎 vitest 全绿
- **DependsOn**: none

### Task 2: 结构面行源 canonicalize 接线 + declare 3 锚 English-primary（contract 面）

- **Objective**: design §2.1/§4——结构判定解释器 **Contract.validate 行源处一次性 canonicalize 全部行** → 规范化行表（视图零写回）· 全部 valuePattern 判定面（presence occurrenceLines · domain carrierLines · section-scoped · crosslink——engine 内 `.valuePattern.test` 消费点 doc.ts:465 · invariants.ts:146/441/652/1221/1243/1245）统一对视图匹配 · declare.ts 2 中文锚改写英文 canonical（`"#### [MFRBEN] group"`/`"^#### [MFRBEN] group"` · `"#### Upstream Endorsements"`/`"^#### Upstream Endorsements$"`——**Goal 备选 zh 锚经 canonical 形落地 · v1.2 backfill 后由 T3 随 osuperpowers 删除还原 `^### Goal`**）· 元素表头注随改——机器可识别标记全 English-primary（v1.2：锚家族 3→2）
- **Files**: `packages/cdd-engine/src-next/contract/judge.ts`（行源 seam 落点——Contract.validate 内 canonicalize · 规范化行表供 parse + JudgeContext.lines 共用）· `packages/cdd-engine/src-next/contract/declare.ts`（3 锚改写）· `packages/cdd-engine/src-next/contract/doc.ts`（parse 面佐证改动 · sectionConforms 视情）· `packages/cdd-engine/src-next/contract/invariants.ts`（判定面消费视图）· `packages/cdd-engine/src-next/contract/__tests__/*`（接线断言）· `scripts/lib/guard.ts`（若树套件/guard 消费该面——核改）
- **Consumes**: `Translator.canonicalize`（T1）· `charter.*` 3 数据行（T1）· elements row 列表（anchor/valuePattern）
- **Produces**: 结构判定全面统一匹配规范化视图 · declare 3 锚英文 canonical · 4 overalls zh 标题经 seam 匹配
- **Steps**:
  - 失败先行：接线负例——英文锚改写后未接 seam：`cdd review`/judge 对 `#### M 组` 行报 missing（红）· 接 seam 后 4 overalls 全绿（证）— checkable: 先红后绿
  - Contract.validate 行源一次性 canonicalize 全部行（每行 `Translator.canonicalize(line)` → 行表 · Contract 自持 Translator——`new Translator(new Words())` 与现自构造 Projector 同型 · cli.ts:1031 唯一生产构造点零改动）· 判定面改读行表（presence/domain/section/crosslink 全消费点 · occurrenceLines/carrierLines/anchorLines 直读 ctx.lines）· 原行保留（视图不写回 · 文档零 diff） — checkable: 行表消费断言绿
  - declare.ts 3 锚改写（§4 表逐字）· 头注随改（zh pattern 叙 → canonical 叙事）· 未登记 zh 零涉 — checkable: grep declare.ts 零中文（含注释）
  - 4 overalls validate 绿（T2 落地态：zh 标题经 seam · 触发面 = doc-arch + osuperpowers——v1.2 backfill 后回落 1 · T3 删除面）· 校验文件树套件零排除绿（count 以活树 gate 实态派生）· 英文行回归（identity 直通） — checkable: 树全绿
  - commit — checkable: `refactor(engine): structure-plane canonicalize seam — Contract.validate row-source + declare 3 anchors English-primary` 落位 · 树净
- **Acceptance**: 4 overalls 全绿（zh 经 seam · T2 落地态触发面 2 → v1.2 回落 1 · T3 删除面）· 校验文件零排除（count 活树 gate 派生）· declare.ts 零中文（grep 含注释）· 视图零写回（文档 zero diff）· 引擎 vitest 全绿
- **DependsOn**: 1

### Task 3: osuperpowers 字面量清除 + 过时产物清理（v1.2 backfill · 用户拍板）

- **Objective**: design §7（v1.63 backfill）——`osuperpowers` 文档族 **13 份删除**（`docs/kairos/specs/2026-09-13-osuperpowers-overhaul-*` 7 份 + `docs/kairos/plans/2026-09-13-osuperpowers-overhaul-*` 6 份 · 被 kairos 替换的第一代程序残留过时 spec/plan）· 引擎机器面 `osuperpowers` Goal 识别移除——`words.ts#charter.goal-title` 行删（T1 落地面反向收回 · face.test flat count 15→14）· `declare.ts` Goal valuePattern 还原 `^### Goal`（删 T2 落地的 `|cdd-engine service mainline` 备选）· `judge.ts:67` / `declare.ts` 头注 / `words.ts` 头注 osuperpowers 字样删 · `judge.test.ts:123` osuperpowers Goal 用例删改 + shape/schema snapshot 核改（project.test.ts 域）· 过时 `.kairos/cdd` 过期 workspace 本地清理（保留当前 `2026-10-02-doc-architecture-v2-p7`）· live 面 `osuperpowers` 零残留 grep pin
- **Files**: 删除 `docs/kairos/specs/2026-09-13-osuperpowers-overhaul-*.md` ×7 · 删除 `docs/kairos/plans/2026-09-13-osuperpowers-overhaul-*.md` ×6 · 修改 `packages/cdd-engine/src-next/face/words.ts`（goal-title 行删 · 头注）· `packages/cdd-engine/src-next/face/__tests__/face.test.ts`（flat 15→14）· `packages/cdd-engine/src-next/contract/declare.ts`（Goal pattern 还原 · 头注）· `packages/cdd-engine/src-next/contract/judge.ts`（注释）· `packages/cdd-engine/src-next/contract/__tests__/judge.test.ts`（osuperpowers 用例删改）· `packages/cdd-engine/src-next/contract/__tests__/project.test.ts`（shape/schema snapshot 核改）· `.kairos/cdd/`（本地 workspace 清理）
- **Consumes**: T2 declare 锚改写面（goal-alt canonical 形）· T1 words charter 行面（goal-title 行）· 树套件 gate 面（删除后计数派生）
- **Produces**: 树 3 overalls（doc-arch / consumer-parity / pi-harness）· Goal facet 纯 `^### Goal`（零备选）· `charter.goal-title` 零残留 · live 面 `osuperpowers` 零残留 · 过时 workspace 清理
- **Steps**:
  - `git rm` osuperpowers 文档族 13 份 · 悬挂引用检查（`git grep 2026-09-13-osuperpowers-overhaul` 仅 CHANGELOG 史实豁免项可命中） — checkable: 13 份已删 · 零悬挂
  - words.ts 删 `charter.goal-title` 行 · 头注 osuperpowers 字样删 · face.test flat count 15→14（localeRows 断言随改） — checkable: face.test 绿
  - declare.ts Goal valuePattern 还原 `^### Goal`（删 canonical 备选分支）· judge.ts:67 / declare.ts 头注 osuperpowers 字样删 — checkable: 3 overalls validate 绿 · Goal 面零 zh 备选
  - judge.test.ts osuperpowers Goal 用例删改（fixture/mock 随核）· project.test.ts shape/schema snapshot osuperpowers 字节核改 — checkable: engine vitest 全绿
  - live 面 `osuperpowers` 零残留 grep（作用域 = `packages/cdd-engine/src-next` + `scripts` + `packages/kairos` + `docs/kairos` 非历史 · 含 `__tests__` · CHANGELOG 史实豁免清单） — checkable: 零命中
  - 过时 `.kairos/cdd` workspace 本地清理（`ls .kairos/cdd` 仅保留 `2026-10-02-doc-architecture-v2-p7`） — checkable: 仅当前 slug
  - commit — checkable: `chore(engine): osuperpowers literal cleaned — doc family deleted · Goal pattern restored · charter.goal-title removed` 落位 · 树净
- **Acceptance**: osuperpowers 文档族 13 份删除零悬挂 · `charter.goal-title` 行删（face flat 14 · T1 落地面收回）· Goal `^### Goal` 零 zh 备选 · judge.test/project.test osuperpowers 零残留 · live 面 `osuperpowers` 零残留 grep 零命中 · 过时 workspace 清理（保留当前 slug）· engine vitest 全绿
- **DependsOn**: 2

### Task 4: 终验 + 机器面 zh 零残留 grep pin + osuperpowers 零残留复核 + changeset

- **Objective**: design §6.2/§6.3（acceptance 全量断言）——引擎 vitest 全绿（含 T1/T2/T3 新增断言与清理核改净面）· typecheck ×3 · biome clean · validate ALL PASS（清理后树 · 3 overalls · count 活树派生）· emit 新鲜 · 机器可识别面 zh 零残留 grep pin（declare 元素 / schema 描述 / DOC_TOKENS · 含注释）· live 面 `osuperpowers` 零残留复核（T3 pin 终态断言）· 树零 diff 复核 · changeset（cdd-engine 一枚含清理面）落位
- **Files**: `packages/cdd-engine/src-next/**`（验证面）· `.changeset/*.md`（新增）
- **Consumes**: T1 canonicalize + 数据行 · T2 seam + 锚改写 · T4 osuperpowers 清理
- **Produces**: validate ALL PASS（全量健康门禁）· changeset 落位（cdd-engine minor/patch 定级由 change 面裁）
- **Steps**:
  - 引擎 vitest 全绿（`pnpm --filter @oscaner-skills/cdd-engine test`）· typecheck ×3 · biome（`pnpm exec biome check` 零违例） — checkable: 三命令 exit 0
  - 机器可识别面 zh 零残留 grep（`grep "[一-鿿]"` 作用域 = declare.ts + templates（schema 描述）+ DOC_TOKENS 派生源 · 含注释 · 排除词表 locale 数据行——zh 唯一栖身地）· capsule 面零 diff 复核（capsule.ts / words capsule 族——design §5 关闭裁定保持）· live 面 `osuperpowers` 零残留复核（T4 已 pin 面终态断言） — checkable: 零命中 · capsule 零 diff · osuperpowers 零命中
  - `pnpm run validate` ALL PASS（emit 新鲜 · engine behavior · channel audit · doc-contract gate 活树 count——osuperpowers 删除后 3 overalls · package sync）· `pnpm run emit:check` 新鲜 — checkable: exit 0
  - changeset 落位（`pnpm run changeset`——cdd-engine 收口 minor·或按面 patch · 含清理面）· 复核 kairos / docs 面零（osuperpowers grep pin 已由 T3 兜） — checkable: `.changeset/*.md` 存在
  - commit — checkable: `chore(engine): changeset——canonicalize 识别接线 + declare English-primary + osuperpowers 清理（P7）` 落位 · 树净
- **Acceptance**: validate ALL PASS（清理后树）· typecheck ×3 · biome clean · emit 新鲜 · zh 零残留 grep 零命中（机器可识别面）· live 面 osuperpowers 零残留（T3 终态复核）· changeset 落位 · 树零 diff 保持
- **DependsOn**: 3

## Change history

| Version | date | summary | author |
|---|---|---|---|
| v1.2 | 2026-10-10 | **osuperpowers 清理 task 收进（用户 2026-10-10 mid-flight 拍板「osuperpowers 已被 kairos 替换 · 不再留 osuperpowers 字面量」）**：新增 T3 清理 task（文档族 13 份删除 · `charter.goal-title` 反向清（T1 落地面收回 · face flat 15→14）· Goal valuePattern 还原 `^### Goal`（T2 canonical 备选随删）· judge.test/project.test osuperpowers 核改 · live 面零残留 grep pin · 过时 workspace 清理）· 波序 W1{T1}→W2{T2}→**W3{T3}**→W4{T4}（终验 task DependsOn 2→3）· T1/T2 objective 同步（锚家族 3→2 · goal-title 收回注）· 执行序/Constraints 更新（osuperpowers 删除面 + CHANGELOG 史实豁免 + live grep pin）· Parent program 升 overall v1.63 | [human] · Claude Opus 5（kairos:cdd-design · 用户 mid-flight backfill） |
| v1.0 | 2026-10-10 | 初版——P7 A 方案接线计划（overall v1.62 · spec v1.1 approved 后开写）：W1 {T1} canonicalize 识别面 + 3 charter 数据行（normalize 收敛并入）· W2 {T2} 结构面行源 seam + declare 3 锚 English-primary · W3 {T3} 终验 + zh 零残留 grep pin + changeset——严格串行三波 | [human] · Claude Opus 5（kairos:cdd-plan · spec v1.1 上游） |
| v1.1 | 2026-10-10 | plan-review-1 5 findings 全修：T1 locale 数据面接线落位 face.test.ts（flat count 12→15 · 机器面免疫 canonicalize 转写 · 删 words.test.ts 悬空引用）· T2 seam 落点归 judge.ts（Contract.validate 行源 · parse + JudgeContext.lines 共用行表）+ 注入面裁定（Contract 自持 Translator）· 校验计数活树 gate 派生（落树后 58 = 17+41）· 变更集义务 = 引擎侧一枚 changeset（三提交节奏解耦）· capsule 关闭裁定入册 + T3 终验 capsule 零 diff 复核 | [human] · Claude Opus 5（kairos:cdd-plan review-fix · plan-review-1 上游） |
