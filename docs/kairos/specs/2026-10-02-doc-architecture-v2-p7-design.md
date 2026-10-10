# 文档架构方法论 v2 — P7 Design Spec（Engine token 翻译能力接线：识别半 canonicalize · 元素表 English-primary）

- **Version**: v1.2 · 2026-10-10
- **Status**: Draft
- **Author**: [human] · Claude Opus 5（kairos:cdd-design → cdd-spec-writer · 决策源 = grilling A 方案定案 2026-10-10）
- **Parent program**: [doc-architecture-v2-overall.md v1.63](docs/kairos/specs/2026-10-02-doc-architecture-v2-overall.md)
- **Depends on**: P2（Done · hard）· P3.2（Done · 复刻独立基线 + T19/T20 carrying）——serial-phase GATE 满足

## Design

P7（engine token 翻译能力）经 A 方案定案从「翻译系统建设」收敛为**识别半接线 + 机器面 English-primary 化 + locale 消费面终态裁定**。carrying（T19 翻译系统全量核心 + T20 base 命令面）由 P3.2 交付且确认落地，本 phase 不重复实现——实现面 = 契契修复（声明 vs 实现漂移）+ 词表数据行 + 识别接线 + 机器面英文纯净化，零树迁移。

### 1. 决策定案（A 方案 · grilling 定案 2026-10-10）

#### 1.1 契契错位取证（T6 同类 · 三证）

- **声明面**：`contract/translate.ts` 头声明「*the doc-parse / judge recognition channel the legacy Chinese markers used to need — recognition rides this layer, never a second hand-written map*」——识别必经翻译层、非第二手写映射
- **实现面**：元素表（`contract/declare.ts:264-295`）以**字面中文 valuePattern** 直注册 3 个 charter 锚家族，未走翻译层——结构识别 = 第二手写映射

| 锚 | 现注册（declare.ts） | 所属 |
|---|---|---|
| 决策组叶后缀 | `#### [MFRBEN] 组`（L286/288） | doc-arch overall charter 决策组叶（M/F/R/B/E 组 · 现树唯一携带） |
| 上游先例背书 | `#### 上游先例背书`（L293/295） | doc-arch overall charter（现树唯一携带） |

> **（v1.2 backfill）**：Goal zh 备选锚随 `osuperpowers` 文档族删除而**不成立**——osuperpowers-overhaul 已被 kairos 替换（用户 2026-10-10 拍板）· 文档族删除后 Goal facet 还原为纯 `^### Goal` · 本 phase 识别锚家族 = **上述 2 锚（doc-arch）**

- **死 API**：`Translator.normalize()` 零生产消费点（全引擎 grep——仅 `render/issue-body.ts:82` 消费 `localize` · normalize 无消费）——声明给识别预留的面从未接线

#### 1.2 zh 基线全量取证（机器可识别面）

`grep "[一-鿿]"` 全引擎非测试面（仅排除词表 locale 数据——words.ts 行）= **仅 declare.ts 上述 2 锚 4 行**（v1.2：goal-alt 随 osuperpowers 删除消失）。结论：A 方案清理面精确有界——机器可识别面（元素表 / schema 派生 / DOC_TOKENS）经清理后零 zh。

#### 1.3 A 方案五面骨架（用户裁定 · 否决 B）

| # | 面 | A 方案 |
|---|---|---|
| ① | 词表 locale 面数据行 | 新增 3 行 zh→en canonical 数据（见 §3）——zh 知识唯一栖身地 |
| ② | 结构面 canonicalization seam | valuePattern 匹配前经翻译层 canonicalize 视图（见 §2）——识别半正式接线 |
| ③ | 元素表 English-primary | 2 中文锚 → 英文 canonical pattern（见 §4 · v1.2：Goal 备选随 osuperpowers 删除还原 `^### Goal`）——acceptance #1 字面可达 |
| ④ | 翻译层双向回归 | canonicalize = 识别消费者 · localize = 渲染消费者（IssueBodyRenderer）——OOP 统一 · `normalize` 死面收敛 |
| ⑤ | capsule locale 消费面 | 关闭裁定（见 §5）——零 capsule 改动 |
| ⑥ | 清理面（v1.63 backfill） | `osuperpowers` 文档族删除 + Goal 识别移除 + 过时产物清理（见 §7）——live 面 `osuperpowers` 零残留 |

**B 方案否决理由（保持字面锚）**：经六前提复核——B 需把「组 / 上游先例背书」塞进 locale 词面却**不接线**（zh 双面留存：词表 + 元素表）· 机器面 acceptance #1 字面永不可达 · normalize 死 API 保留。A 的接线成本 = 一个 canonicalize 视图（数据驱动）· 换来单源 + 全英文机器面 + 死面清理——前提 4/6 下 A 胜。

#### 1.4 carrying 确认面（只登记不重复实现）

- T19 翻译系统核心：词表 locale 面（`localeKeys/localeRows/localeRow`）· `Translator` 类（localize 渲染面已消费）· langs 投影派生零硬编码
- T20 `base` 命令面（6 命令面 basis）
- `IssueBodyRenderer` 人类可读 locale 消费（`localize(row.en, lang)` · 唯一渲染消费者）

### 2. 结构面 canonicalization seam

#### 2.1 落点

结构判定解释器（docContractValidate 链 · Contract.validate 行源处一次性 canonicalize 全部行）——每行经 `Translator.canonicalize(line)` 得**规范化视图**，全部 valuePattern 判定面（presence occurrenceLines · domain carrierLines · section-scoped · crosslink）统一对视图匹配。识别面 = 翻译层一眼，契契原义兑现。

#### 2.2 `canonicalize(line)` 识别面设计

- 词表 locale 行驱动的 **span 替换**（zh alias 子串 → en canonical · 最长匹配）· 零 switch（新词 = 新增数据行）
- **行级 identity 直通**：不含已登记 zh 别名子串的行 → 视图 = 原行 · 零行为变化（树内文档均含中文字符——Strategy B 中文内部文档，纯英文文档为零；identity 断言为行级而非文档级）
- **变换仅匹配视图**：视图不写回 · 文档原文零改动 · 匹配后视图即弃
- `normalize`（单 token 面）**收敛并入**——canonicalize 为唯一识别 face（单 token 判 = canonicalize 于单 token 行）；translate.ts 头注释随改（识别面措辞 normalize → canonicalize）

#### 2.3 边界与安全

- 仅替换**词表已登记**的 zh 别名 span；未登记 zh 正文（prose 中「全关」「约束」等）不受影响
- 仅作用于结构判定的匹配视图；capsule / handoff / 产物面零涉
- 测试：zh→en 替换 · 行级 identity（不含 zh 别名行）· 未登记词不动 · 复合词行（如 `组件`）仅替换登记 span `组`（单字符别名吞并不越界）· 部分匹配（`cdd-engine 服务化主线` 后接日期括号）仅替换登记 span

### 3. 词表 locale 面 zh→en 数据行

| row id | en canonical | zh alias | 服务锚 |
|---|---|---|---|
| `charter.group-leaf` | `group` | `组` | `#### [MFRBEN] 组` 家族（决策组叶 · overall charter 家族注册 · 现行携带仅 doc-arch overall） |
| `charter.upstream-endorsements` | `Upstream Endorsements` | `上游先例背书` | `#### 上游先例背书` |

> **（v1.2 backfill）**：`charter.goal-title` 行（T1 落地）随 `osuperpowers` 文档族删除**反向清理**——Goal 门面位不存在后无识别需要 · 由新 T4 收回

- 数据形态 = 既存 `LocalizedWord` 行（`{ en, zh }`）· 家族前缀 `charter.` 与 issue-label 家族（`${type}.${segment}`）并列
- zh 知识唯一栖身地：词表 locale 面登记全量中文别名；元素表 / schema / DOC_TOKENS 零中文

### 4. 元素表 English-primary 化

| 现注册 | 新注册 |
|---|---|
| `anchor: "#### [MFRBEN] 组"` · `"^#### [MFRBEN] 组"` | `"#### [MFRBEN] group"` · `"^#### [MFRBEN] group"` |
| `anchor: "#### 上游先例背书"` · `"^#### 上游先例背书$"` | `"#### Upstream Endorsements"` · `"^#### Upstream Endorsements$"` |
| `"^### (Goal\|cdd-engine 服务化主线（2026-09-13 用户升维）)"`（v1.2：T2 曾落 canonical 形 `^### (Goal\|cdd-engine service mainline)` · v1.63 清理收回） | **还原 `"^### Goal"`（零备选）**——`osuperpowers` 文档族删除后 Goal 门面位为零（3 overalls · en Goal 面） |

- 匹配路径：`#### M 组（…）` → canonicalize → `#### M group（…）` → pattern `^#### [MFRBEN] group` ✓ · 未登记尾随 zh（括号内 prose）不参与匹配
- **grep pin**：declare.ts 零中文（含注释）· schema 描述面（templates 派生）零中文 · DOC_TOKENS 零中文——acceptance #1 以机器断言钉住

### 5. capsule locale 消费面终态（关闭裁定）

- **终态 = 已文档化设计**：capsule 机器面（`status · blocker · handoff · next:`）英文恒定、不入 locale 行（`words.ts:31` · `capsule.ts` 头）——编排侧 grep/路由语义稳定性要求，非缺失
- **人类可读 locale 消费 = IssueBodyRenderer 已落地**（`localize(row.en, lang)` · issue 标签 zh 行）——「人类可读面服务」即 P7 原 acceptance 的 locale 消费落点
- **裁定登记**：P7 原 acceptance「词表 / 胶囊输出 locale-normalized 消费 · save 判断点 v2」的 capsule 半 → 关闭为终态（零 capsule 改动）· 消费半 → 已落地（IssueBodyRenderer）· overall v1.62 已登记（Deviations 表见下）

### 6. 交付面（零树迁移 · 测试 · 变更集）

#### 6.1 树迁移

**零迁移 + 删除面（v1.63）**——doc-arch 中文标题逐字不动（acceptance #4 历史正文 · 识别经 seam 视图）· **`osuperpowers` 文档族 13 份删除**（`2026-09-13-osuperpowers-overhaul-*`：7 specs + 6 plans——被 kairos 替换的第一代程序残留）· 全树校验数以活树 gate 实态派生（删除后 3 overalls · count 随 doc-contract gate 输出）。

#### 6.2 测试

- `translate.test`：`normalize` 用例收敛为 `canonicalize`（单 token 判）· 新增 span 替换 / 行级 identity / 未登记词 / 复合词（`组件`）/ 部分匹配用例
- 结构面接线断言：Contract.validate 行源 canonicalize 后全部 valuePattern 判定面接线 · 3 overalls validate 全绿（doc-arch 组/背书经 seam · Goal 面纯 `^### Goal` 零备选）· 无 zh 别名行回归（行级 identity 直通）· 树套件零排除绿（count 活树派生）· `osuperpowers` 删除后零残留
- 引擎 vitest 全绿 · typecheck ×3 · biome clean · validate ALL PASS · emit 新鲜

#### 6.3 变更集

cdd-engine 一枚独立提交（declare 锚改写 + words 数据行 + canonicalize 识别面 + translate 头校正 + 测试收敛 + osuperpowers 清理随 T4）· changeset 落位。kairos / docs 面零（overall 已随 v1.63）。

### 7. 清理面（v1.63 backfill · 用户拍板「osuperpowers 已被 kairos 替换 · 不再留 osuperpowers 字面量」）

#### 7.1 删除面

- `osuperpowers` 文档族 **13 份删除**（`docs/kairos/specs/2026-09-13-osuperpowers-overhaul-*` 7 份 + `docs/kairos/plans/2026-09-13-osuperpowers-overhaul-*` 6 份）——第一代插件生态程序（已被 kairos 替换）的过时 spec/plan
- 引擎机器面 `osuperpowers` Goal 识别移除：`words.ts#charter.goal-title` 数据行删（T1 落地面反向收回）· `declare.ts` Goal valuePattern 还原 `^### Goal`（T2 落地的 canonical 备选形随删）· `judge.ts:67` / `declare.ts:264` / `words.ts:200` 三处注释 osuperpowers 字样删 · `judge.test.ts:123` osuperpowers Goal 用例删改 + snapshot/shape 核改（project.test.ts 域）

#### 7.2 零残留与豁免

- live 面 `osuperpowers` 零残留 grep pin（作用域 = `packages/cdd-engine/src-next` + `scripts` + `packages/kairos` + `docs/kairos` 非历史文件——含 `__tests__`）
- **CHANGELOG 史实豁免**：两包 CHANGELOG 的 osuperpowers 条目 = 真实发布史（史实即史实 · 零 retro-edit）· kairos CHANGELOG `# osuperpowers` 头部标题 = 待用户另裁（未纳入本 task 强制面）

#### 7.3 过时产物清理

- 本地 `.kairos/cdd` 过期 workspace 清理（保留当前 `2026-10-02-doc-architecture-v2-p7` · 删除已完成 phase 的 slug）——handoff/ledger 残留本地清理 · 零 tracked 面

### Acceptance criteria

- `机器可识别标记全 English-primary：declare.ts 2 中文锚改写为英文 canonical pattern（§4 表）· Goal valuePattern 还原 ^### Goal（osuperpowers 删除 · 零备选）· 元素表 / schema 描述 / DOC_TOKENS 面零中英混杂（grep pin 含注释）`
- `zh 知识唯一栖身词表 locale 面：新增 2 行 zh→en canonical 数据（charter.group-leaf=组→group · charter.upstream-endorsements=上游先例背书→Upstream Endorsements——charter.goal-title 随 osuperpowers 删除反向清零）· 元素表零中文 pattern 残留（grep）`
- `识别面接线：Contract.validate 行源处一次性 canonicalize 全部行 · 各 valuePattern 判定面（presence / domain / section-scoped / crosslink）对规范化视图匹配（视图零写回）· normalize 单 token 面收敛并入 · 零死 API · translate.ts 头注释随改（识别措辞 normalize → canonicalize）`
- `英文面零行为变化：不含已登记 zh 别名子串的行 canonicalize identity 直通（行级断言 · 树内文档均含中文字符）· 树套件零排除绿（count 活树 gate 派生）· 3 overalls 经 seam 匹配全绿（zh 变换触发面 = 1——doc-arch overall 组/背书 · consumer-parity/pi-harness identity 直通 · zh 标题逐字不动 · acceptance #4 保持）`
- `osuperpowers 清理（v1.63）：文档族 13 份删除（7 specs + 6 plans · 全仓零路径悬挂）· charter.goal-title 行删 · Goal valuePattern 还原 ^### Goal · 三处注释 osuperpowers 字样删 · judge.test osuperpowers 用例删改 · live 面 osuperpowers 零残留 grep pin（src-next + scripts + kairos + docs/kairos · 含 __tests__ · CHANGELOG 史实豁免）· 过时 .kairos/cdd 过期 workspace 本地清理（保留当前 slug）`
- `capsule locale 消费面关闭裁定：机器面英文恒定终态保持（零 capsule 改动）· 人类可读面 IssueBodyRenderer 已落地（唯一 localize 渲染消费者）· Deviations 两行登记 · overall v1.63 一致`
- `translate.test 收敛：normalize 用例 → canonicalize 收敛 · 新增 span 替换 / 行级 identity 直通 / 未登记词不动 / 复合词（`组件` 仅替换登记 span）/ 部分匹配用例`
- `引擎 vitest 全绿（新增 canonicalize/接线断言 · osuperpowers 清理关联核改）· typecheck ×3 · biome clean · validate ALL PASS · emit 新鲜 · 变更集 cdd-engine 一枚独立提交 + changeset`

## Constraints

- **零新 CLI 子命令**：只动词表数据 / declare 元素 / 翻译层识别面 / 文档删除面（charter Non-goal #1 保持）
- **TDD colocated**：canonicalize / 接线改动先测后写（各模块 `__tests__` 同址）· normalize 收敛用例随删随改
- **历史正文零 retro-rename**：doc-arch 中文标题逐字不动 · 文档正文零改动（识别经 seam 视图 · 匹配视图不写回）· **osuperpowers 文档族删除为唯一删除面**（CHANGELOG 历史条目零 retro-edit · 史实即史实）
- **zh 知识单源**：中文 alias 仅允栖身词表 locale 面（新增数据行 · 零代码分支 · 零第二手写映射）
- **English-primary 消费面**：机器可识别面（元素表 / schema 描述 / DOC_TOKENS）英文；内部 specs/plans 中文（Strategy B）· 含注释 grep · **live 面 `osuperpowers` 零残留 grep pin**
- **变更集义务**：cdd-engine 一枚独立提交（含测试收敛净面 + osuperpowers 清理随 T4）+ changeset 落位

## Deviations

| Overall assumption | Phase decision | Overall updated? |
|---|---|---|
| 原 acceptance：词表 / 胶囊输出 locale-normalized 消费（capsule 机器面保持英文恒定 save 判断点 v2——人类可读面服务） | capsule locale 消费面 = **关闭裁定**：机器面英文恒定 = 终态（已文档化设计）· 人类可读面 = IssueBodyRenderer（已落地）· 零 capsule 改动 | Yes（overall v1.62 重派生） |
| 原 acceptance：中文别名 ↔ 英文规范型双向解析（doc 识别半 = 翻译层承接） | 识别半**接线落实**：结构面 valuePattern 匹配经 `canonicalize` 视图 · normalize 单 token 面收敛并入 · 识别 = 翻译层一眼 · element 面零第二手写映射 | Yes（overall v1.62 重派生） |

## Change history

| Version | date | summary | author |
|---|---|---|---|
| v1.2 | 2026-10-10 | **osuperpowers 清理 backfill（用户 2026-10-10 mid-flight 拍板「osuperpowers 已被 kairos 替换 · 不再留 osuperpowers 字面量」）**：Goal zh 备选锚不成立（文档族删除）· 锚家族 3→2（doc-arch 组/背书）· `charter.goal-title` 行反向清（T1 落地面收回）· Goal pattern 还原 `^### Goal`（T2 canonical 备选形随删）· 新增 §7 清理面（文档族 13 份删除 · 机器面 osuperpowers 移除 · live 面零残留 grep pin · CHANGELOG 史实豁免 · 过时 workspace 清理）· 树 4→3 overalls · 触发面 2→1 · acceptance/constraints 重派生 · Parent program 升 overall v1.63 | [human] · Claude Opus 5（kairos:cdd-design · 用户 mid-flight backfill） |
| v1.1 | 2026-10-10 | **spec-review-1 全修（4 warn · 1 nit）**：锚家族「所属」列收敛为实际携带文档（doc-arch overall 组/背书 · osuperpowers overall Goal · zh 变换触发面 = 2 · 另 2 个 identity 直通）· 树计数重派生 47→57（26 design · 25 plan · 4 overalls · 2 边缘）· §2.1 seam 挂点改「Contract.validate 行源一次性 canonicalize 全部行」（全部 valuePattern 判定面——presence / domain / section-scoped / crosslink 对视图匹配）· identity 直通改行级断言（纯英文文档 = 0）+ 复合词测试钉（`组件`）· §1.2 grep 排除清单收敛为 words.ts 词表 locale 数据 · acceptance #3/#4 同步 · Version v1.0→v1.1 | [human] · Claude Opus 5（kairos:cdd-design → cdd-spec-writer） |
| v1.0 | 2026-10-10 | 初版——A 方案定案开写（overall v1.62 四表同步后）：契契错位三证 + zh 基线全量取证（机器面仅 declare.ts 5 行）· 识别半接线（canonicalize 视图 · normalize 收敛并入）· 词表 3 行 zh→en canonical 数据 · 元素表 3 中文锚 → English-primary · 零树迁移 · capsule locale 消费面关闭裁定（Deviations 登记）· 变更集 cdd-engine 一枚 | [human] · Claude Opus 5（kairos:cdd-design → cdd-spec-writer · grilling A 方案定案） |
