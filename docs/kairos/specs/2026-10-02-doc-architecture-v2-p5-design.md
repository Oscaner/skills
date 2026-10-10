# 文档架构方法论 v2 — P5 Design Spec（DispatchContract + DispatchPacket 收敛重规划）

- **Version**: v1.0 · 2026-10-10
- **Status**: Draft
- **Author**: [human] · Claude Opus 5（kairos:cdd-design → cdd-spec-writer · 决策源 = grilling 五命题定案 2026-10-10）
- **Parent program**: [doc-architecture-v2-overall.md v1.57](docs/kairos/specs/2026-10-02-doc-architecture-v2-overall.md)
- **Depends on**: P3.2（Done · overall v1.57 —— serial-phase GATE 满足 · 复刻独立基线 + v1.57 收敛重规划）

## Design

P5（DispatchContract + DispatchPacket）经用户键判「不同 op type 采用的上游 skill 与现状不同 · 重新规划」从注册态（v1.45 复刻独立 · dispatch 契约面欠收敛）升级为**收敛重规划**：M 组 op→skill 映射按 greenfield 实态整体重规划 · 零消费者死壳清扫（CHAINS / graph-node）· DispatchPacket 正文映射闭环登记（零实现）· 登记层四表 + M/R/B 组改写。carrying 面（T21 M1 supersede/禁文/refs · T25 refKind/capabilities）全部确认落地，不做重复实现。与 P4 关闭同构：carrying 全落 + missing 全消解 → 小实现面 + 登记收口。

### 1. 决策定案（grilling 五命题）

#### 1.1 命题一览

| # | 命题 | 定案 |
|---|---|---|
| ① | fix 面 skill 映射 | **无上游 ref**——DISPATCH.fix 删 · REFS tdd 键删 · M2 纪律 typed 入 FIX_SHELL（验而后修 + 条件 tdd·B1 `appliesTo`）· DISPATCH 收敛为 implement/review 两活面 |
| ② | CHAINS | **删**（零生产消费者 · C1 渲染验收撤销·REFS 已覆盖） |
| ③ | graph-node | **删**（零派发位 · RefKind 四型→三型 · R5 关闭裁定） |
| ④ | DispatchPacket 正文 | **映射闭环登记收口**——四概念已以新名落地 · 零实现 |
| ⑤ | 登记层重规划 | M/R/B 组决策表 · 依赖图 · Phase inventory acceptance 修订 · C1/C2 验收撤销（overall v1.57 已 land） |

#### 1.2 carrying 确认面（A 组 · 只登记不重复实现）

A1 M1 supersede（`DISPATCH.implement = mattpocock-skills:implement` · tdd 别名退役）· A2 三处禁文删除（harness-contract×2 + axesGuide×1 · 全仓零残留）· A3 refs 域登记（REFS 全键 + per-host 斜杠形式）· A4 refKind **typed 分类机制** + capabilities per-harness（claude=parallel **true** 实测 · cursor/pi=`"pending"`）——机制/列已落地 · graph-node union 成员删除见 §3.3 · P5 只登记不重复实现。

### 2. M 组 op→skill 映射重规划（fix 面无 ref）

#### 2.1 现状错位取证（引擎实态 vs 注册表）

`cli.ts#skillRef`（约 432 行）把 DISPATCH 表 skill-ref 真实注入子 prompt——DISPATCH 是**活动面**非死数据：

| op | 注册（M 组 · v1.45 复刻注册态——v1.57 已改写决策行 · 取证基线） | 引擎实态 | 判 |
|---|---|---|---|
| implement | `mattpocock-skills:implement`（M1） | 同 · `host.ts:246` 注入 | ✓ 一致 |
| fix | `[superpowers:receiving-code-review, superpowers:verification-before-completion]`（M2） | `host.ts:247` = **`mattpocock-skills:tdd`** | ✗ 错位 |
| review.task/branch | `mattpocock-skills:code-review`（M3） | 同 · `host.ts:249-250`（wave/branch 同 key 两槽） | ✓ 一致 |
| review.spec/plan | `kairos:cdd-doc-review` 一产化（M4b） | **无 skill-ref**（REVIEWS typed 面 · v1.46 已废） | ✗ 表陈旧 |

M2 注册链在全仓零残留（仅 overall 注册行）——greenfield 重建时 fix 槽位继承了旧树 `dispatch.implement=tdd` 的别名占位，未做映射决策；receiving-code-review 的机器适用核心（验而后修）从未落入 FIX_SHELL（现为盲从式 "Fix ALL findings"）。

#### 2.2 上游候选调查（五候选逐一 fit 判定 · `⊆` 规则）

实装版本（superpowers 7.0.0 · mattpocock 1.3.1）逐一检验 `fit(skill, op) = skill 方法论 ⊆ op 需要`：

| 候选 | 核心纪律 | 判定 |
|---|---|---|
| mattpocock-skills:tdd | test-first red→green 循环 | ✗ 恒常错位——M1 自证「tdd 仅作真行为变更的**条件纪律**，经 B1 `appliesTo` 表达、非恒常进链」；多数 finding 非行为变更 |
| superpowers:receiving-code-review | 读→复述→对 codebase 实态核对→技术成立才改→逐条修、每修必测 | ✗ 全量引用⊄——~200 行大半人机交互面（追问/pushback 脚本/致谢禁令/human rule/GitHub 回复）单轮 child 不可执行；**核心 = 真缺口**（现 FIX_SHELL 盲从） |
| superpowers:verification-before-completion | IRON LAW 证据先行 | ✗ 已 absorbed——EVIDENCE_ITEM（证据文件 + schema 校验 + BLOCK 重写）即其 typed 化，ref 零新增价值 |
| superpowers:systematic-debugging | NO FIXES WITHOUT ROOT CAUSE | ✗ 结构性排除——review 已根因诊断定型（lens+rationale）；多轮实验交互与单轮 child 不相容 |
| mattpocock-skills:diagnosing-bugs | 症状诊断循环 | ✗ 同上——findings ≠ 未诊断症状 |
| （对照）mattpocock-skills:implement | spec/tickets→交付流程 | 流程型 ref 面（implement op 用）；借用于 fix 分判 ✗——「Once done, use /code-review」与**引擎唯一评审权威**冲突（双重评审 = P3.1/P3.2 消灭的回归）· 四贡献（do-work/tdd/typecheck/commit）已 absorbed |

结论：无整体可引用的上游 skill fit fix 面——但 M2 核心纪律必须在 FIX_SHELL 以 typed 形态**补回**（否则纪律静默丢失实证被登记为长期缺口）。

#### 2.3 落法：DISPATCH 收敛两活面

- `DISPATCH.fix` 删除（fix 面无 ref）· `REFS` 删 `mattpocock-skills:tdd` 键（三 host 斜杠形式随删）
- `#skillRef`：fix 相位返回 null（与 spec/plan review、docs-fix 同构；`cli.ts` 约 470 注释样板随改）· `DISPATCH.review` 两槽（wave/branch）同 key 保持——键按 type 查 `#skillRef` 的机制依赖两槽位
- DISPATCH 终形：`implement → mattpocock-skills:implement` · `review.wave/branch → mattpocock-skills:code-review` · fix / review.spec|plan / docs-fix → null

#### 2.4 FIX_SHELL 补 typed 两条

`templates.ts` FIX_SHELL（约 181 行）增量两条 typed 指令句（非散文段 · 固定体字节契约保持）：

1. **验而后修**（措辞对齐 receiving-code-review 血统——`READ→VERIFY against codebase→EVALUATE technically sound→one at a time, test each`）：每条 finding 先对 codebase 实态核对 → 技术成立才改 · 不成立留 note 拒盲从（不实施）· 逐条 · 每修必验
2. **条件 tdd**（B1 `appliesTo` 语义承接——M1 的 tdd 条件纪律落位）：IF finding 要求行为变更且缺测试 → 先写/改测试 red→green 纪律一句；恒常不触发

零上游技能全文吸收（~200 行技能文本 vs 2 条 typed 句——引用 vs 吸收的 fit 规则落点）。

#### 2.5 review.spec/plan 登记

零 ref 已是实态（`ReviewDispatchRow` 仅 wave/branch 两行 · spec/plan review 无行 → `#skillRef` undefined → null）：登记为 REVIEWS 单源 + 装配面，不实现。

### 3. 零消费者死壳清（CHAINS · graph-node）

#### 3.1 CHAINS 删（命题②）

CHAINS（`host.ts:134` · skillLine/devDispatch 两链）零生产消费者——唯一消费者 = T25 **ordered skill chains** describe self-test（host.test.ts 37-83 行 · 3 it / 6 expect）；capabilities per-harness describe 块（24-35 行 · A4 存活面）非 CHAINS 消费者、保留不动。验收 C1「skills 有序链渲染（多 `/xxxx`/`/skill:` form）」真值已由 REFS 独立满足（全键 per-host 斜杠形式渲染）；CHAINS 只追加「链序」层，链序零消费（链序编排面 = SKILL.md handoff-next 节点文本，数据面 = 第二份副本 → 双写认知 E5 债族）。不为数据面发明消费者（README 渲染 = 为存在而存在 · 添 scripts 派生依赖）。

#### 3.2 CHAINS 删除面

`host.ts`：`CHAINS` 常量 + `ChainKey` 类型 + `HostContract.chains` 字段 + 相关头注；`host.test.ts`：T25 **ordered skill chains describe 块（37-83 行 · 3 it / 6 expect）删除**——**capabilities per-harness describe 块（24-35 行 · A4 存活面）显式保留不动**；`cli.ts`/模板无 CHAINS 消费（已核）。

#### 3.3 graph-node 删（命题③）

graph-node ref（ledger.ts:213）零派发位——唯一存在 = 类型/构造/相等/parse + 测试；wave 原子模型（v1.37 一帧一波）下评审以 wave 为单位、**单节点评审结构性不存在**（波内部任务不单独评审）——与 P4 grilling 追问排除同型结构性消解。RefKind 四型 → **三型**（commit-set-ledger / commit-range / doc-revision）。R5 决策留存关闭裁定已落 overall v1.57。

#### 3.4 graph-node 删除面

`ledger.ts`：`RefKind` union 成员 `"graph-node"` + `GraphNodeRef` 接口 + `ReviewRef` 成员 + `graphNode()` 构造 + 相等 case（约 294 行）；`ledger.test.ts`：425-426 / 462-463 两断言段；无其他引擎/guard/schema touchpoint（已核）；doc 面仅 overall 决策留存（v1.57 已改）。

### 4. DispatchPacket 正文映射闭环登记（命题④ · 零实现）

#### 4.1 判定：概念已以新名落地

DispatchPacket 正文四概念按 v1.23「被 capsule+handoff+模板面取代」已全量 reincarnate（新树单 lifecycle dispatch 面）——映射对照登记（**What gets absorbed must get mapped**），零新引擎符号：

| DispatchPacket 概念 | greenfield 落点（新名） |
|---|---|
| InstructionUnit 结构化（typed 指令 · appliesTo 过滤渲染） | MODE_PROMPTS 三行（implement/fix/docs-fix）+ REVIEW_VARIANTS 四变体（wave/branch/spec/plan · 同用 FRAME_ITEMS/REVIEW_ITEM typed 常量）+ 注入子集（"non-consumed slots dropped" = appliesTo 过滤渲染） |
| return/evidence = schema 引用（正文零格式散文） | 注入 handoff schema（OUTPUT_HANDOFF 可写子集 fence）+ 证据文件 schema 校验（OUTPUT_EVIDENCE · command/exit_code/passed…） |
| BodyView 分型（spec/plan/task/branch 各一形） | mode round-context 注入子集（ROLE/WAVE/INPUT_*/OUTPUT_*/WORKSPACE_*/FIX_BASE per-mode 定型）+ 固定前缀 per-mode 字节分组 |
| convergence 数据 | `next:` 路由字面（dispatch-ready · v1.39）+ REVIEWS 结论派生（findings → CHANGES_REQUESTED/REVIEW_FIX/APPROVED） |
| constraints 子集过滤（每 dispatch 只带适用规则） | reduced round-context 子集（mode 非消费槽不发射）+ 固定前缀字节稳定分组（cache 分组 · 一节一 mode） |

#### 4.2 B1 appliesTo 语义承接

§2.4 条件 tdd 条款即 B1 `appliesTo` 的落地语义（条件性指令 · 非恒常）；CONFIRMED_SEAMS 机制（wave brief 预协商 seam）承接 tdd「pre-agreed seams」交互步的机器化。

#### 4.3 登记落点

overall B 组闭环注 + Phase inventory P5 行 acceptance（v1.57 已 land）· 本 spec §4.1 对照表即登记本体 · P5 close 时四表同步对账。

### 5. 实现面与验收口径

#### 5.1 登记层（已 land）· 引擎实现面

overall v1.57 四表 + M/R 组同步已在本 spec authoring 前独立提交（a1496c95）；引擎实现面 = §2.3（host.ts DISPATCH/REFS）+ §2.4（templates.ts FIX_SHELL）+ §3.2/§3.4（host.ts/ledger.ts 删除）+ scripts 衍生面（`scripts/lib/guard.ts`——`checkChannels`（guard.ts:727）随 DISPATCH.fix 删除删去 `pushRef(this.#dispatch.fix)` 派生行 · 保持 `pushRef` `string | { ref: string }` 强类型不引入容 undefined · checkChannels doc-comment 同步）+ 测试同步（host.test T25 chains describe 块删 · capabilities 块保留 · ledger.test graphNode 断言删 · `scripts/__tests__/guard.test.ts` 随核 · cli.test 若含 fix ref 断言核改）。删面为纯删除（含 guard fix push 派生行随删）+ 模板两条 typed 增——零新抽象。

#### 5.2 变更集

cdd-engine（host/templates/ledger 收敛 · 含删测试净负行）· scripts 面（`scripts/lib/guard.ts` fix push 派生行随删 · `scripts/__tests__/guard.test.ts` 随核）· kairos 随 T5 若 SKILL 面动（预期无——SKILL 文本不含 DISPATCH fix ref）· docs 面 zero（overall 已随）。

### Acceptance criteria

- `DISPATCH 收敛两活面：DISPATCH.fix 删除 · REFS \`mattpocock-skills:tdd\` 键删除（三 host 斜杠形式随）· \`#skillRef\` fix 相位返回 null（与 spec/plan review 同构）· 全仓 \`mattpocock-skills:tdd\` 引用零残留（含 __tests__ · cli.ts:470 注释样板随改）`
- `FIX_SHELL 补 typed 两条：验而后修（findings 逐条对 codebase 实态核对 · 技术成立才改 · 不成立留 note 拒盲从 · 逐条 · 每修必验 · 措辞对齐 receiving-code-review 血统）· 条件 tdd（B1 \`appliesTo\` 语义：改行为缺测试才 red→green）· 固定体字节契约保持（typed 指令句非散文段 · 零技能全文吸收）· 模板断言回归`
- `CHAINS 删除：host.ts \`CHAINS\`/\`ChainKey\`/HostContract.chains 字段 + host.test T25 ordered skill chains describe 块（37-83 · 3 it / 6 expect）删除 · capabilities per-harness 块（24-35 · A4 存活面）保留 · 全仓 CHAINS 零残留（grep 含 __tests__）`
- `graph-node 删除：RefKind 三型 union（commit-set-ledger/commit-range/doc-revision · 零 graph-node）· GraphNodeRef/构造/相等/parse 分支删 · ledger.test graphNode 断言删 · 全仓 graph-node 零残留（grep 含 __tests__）`
- `DispatchPacket 正文映射闭环：§4.1 对照表五行登记（InstructionUnit→MODE_PROMPTS 行 · return/evidence→注入 schema · BodyView→round-context 子集 · convergence→next 路由 · constraints 子集→reduced 固定前缀）· 零新引擎符号断言（本 phase 不实现新概念 · 纯删除 + FIX_SHELL 两条增）`
- `登记层一致性：overall v1.57 四表 + M/R 组与 spec 一致（M2/M4b 行 · R5 关闭 · Phase inventory P5 acceptance C1/C2 撤销 · 依赖图 P3.2→P5 基线行 · Change history v1.57）· 本 spec v1.0 头标注 Parent program = overall v1.57`
- `引擎 vitest 全绿（387 − 删断言 + FIX_SHELL 断言新增后）· typecheck ×3 · biome clean · validate ALL PASS · emit 新鲜`
- `变更集：cdd-engine 一枚独立提交（含净删除）· kairos 随 T5 若 SKILL 面动 · changeset 落位`

## Constraints

- **零新 CLI 子命令**：收敛只动现有 DISPATCH/REFS/templates/ledger 面（charter Non-goal #1 保持）
- **TDD colocated**：引擎改动先测后写（src-next 各模块 `__tests__` 同址）；删除断言随删（净负断言）
- **固定体契约**：FIX_SHELL 增量 = typed 指令句（英文 · 每句可机断言）· 不以上游技能全文入固定体（引用 vs 吸收的 fit 规则落点 · 反散文堆积）
- **历史正文零 retro-rename**：overall M/R 组改写 = 决策表现状面更新（历史 trail 在 Change history · 不 rename 既有正文）
- **English-primary 消费面**：FIX_SHELL/模板增量英文；内部 specs/plans 中文（Strategy B）
- **变更集义务**：cdd-engine（host/templates/ledger 收敛）· kairos 随 T5 若动——各一枚，独立提交

## Change history

| Version | date | summary | author |
|---|---|---|---|
| v1.0 | 2026-10-10 | 初版——P5 收敛重规划（overall v1.57 四表同步后开写）：M 组 op→skill 映射整体重规划（fix 面无 ref · REFS tdd 键删 · FIX_SHELL 补 typed 两条：验而后修 + 条件 tdd·B1 appliesTo）· 零消费者死壳清（CHAINS 删 · graph-node 删 · RefKind 四型→三型）· DispatchPacket 正文映射闭环登记（四概念已以新名落地 · 零实现）· 实现面 = 纯删除 + 模板两条 typed 增 · 变更集 cdd-engine | [human] · Claude Opus 5（kairos:cdd-design → cdd-spec-writer · grilling 五命题定案） |