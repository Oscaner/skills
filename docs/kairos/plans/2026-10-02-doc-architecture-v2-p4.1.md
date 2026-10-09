# 文档架构方法论 v2 — P4.1 Plan（lifecycle 前置校验统一 · schema 一致硬化 · next 可执行命令字面量）

**Spec:** [P4.1-design v1.2](docs/kairos/specs/2026-10-02-doc-architecture-v2-p4.1-design.md)

- **Parent program**: [doc-architecture-v2-overall.md v1.47](docs/kairos/specs/2026-10-02-doc-architecture-v2-overall.md)
- **Version**: v1.3 · 2026-10-09
- **Depends on**: P3.2（Done · [p3.2-plan v1.31](docs/kairos/plans/2026-10-02-doc-architecture-v2-p3.2.md) —— serial-phase GATE 满足，P4.1 可开线）
- **Base**: develop

执行序（**波标签 = plan-graph board 派生标签** · `cdd schema get plan-graph`）：W00 = {T1, T2}（引擎底座：pre-flight seam / schema 同构）→ W01 = {T3, T4}（迁移 / next 字面）→ W02 = {T5}（技能同步）→ W03 = {T6, T7}（终验 / round-context·artifact 面统一）。

## Constraints

- **零新 CLI 子命令**：clean-tree 门与 next 可执行化只动现有 implement/review/fix 的前置校验与渲染（charter Non-goal #1 保持；发现型 schema 面不扩）
- **TDD colocated**：引擎改动先测后写（src-next 各模块 `__tests__` 同址）
- **一声明四派生**：schema/pattern 改动只改元素登记表（contract/declare.ts），派生 schema/slices/描述面全投影，字节 pin 更新随动
- **历史正文零 retro-rename**：迁移只改容器（Version 头 / Change history 表），历史内容逐字保真 + 机 pin；CHANGELOG 记录与版本行改名记录为历史清单（含表行豁免面）
- **English-primary 消费面**：SKILL.md 调整英文写作；内部 specs/plans 中文（Strategy B）
- **变更集义务**：engine fix + kairos docs 各一 changeset，独立提交（归属唯一：kairos docs 随 T5 · cdd-engine fix 随 T6）
- **全树迁移规则**（design §3）：补齐不 conditional · 建档日期 = 迁移日期（零虚构）· 非严格形 = 有头且非严格、不含 bold；有头非严格机械扫（现树实测）28 = 26 非 bold + 2 bold（2 bold 归一行源拆链）· `前置 v`/补充说明零残留扫描面 = `**Version**` 头行（表行豁免）

### Task 1: Lifecycle 前置校验 seam + 全动词 clean-tree 硬门

- **Objective**: Pre-flight seam 成型（design §1）——tree-clean + doc-contract + wave 三门收敛单入口，cli 只编排零重复；`implement`/`review`/`fix` 任一 dispatch 前置 `isClean()`（infra/git.ts 原语接线）检查，脏树 → `CDD_BLOCKED:` + commit/discard 指引，child 零派发——兑现技能已宣称的「engine entry gate: dirty → BLOCKED」（契契/实现错位修复）
- **Files**: `packages/cdd-engine/src-next/session/preflight.ts`（新建 · PreFlight 类）· `packages/cdd-engine/src-next/session/run.ts`（改：Lifecycle 前置校验接线）· `packages/cdd-engine/src-next/face/cli.ts`（改：#runWork 前置门收敛为 seam 调用）· `packages/cdd-engine/src-next/session/__tests__/preflight.test.ts`（新建）
- **Consumes**: `infra/git.ts#isClean` · `Contract.validate`（contract/judge.ts）· `WaveGate.vet`（session/wave.ts）
- **Produces**: `PreFlight`（单入口 · 门序：tree-clean →（wave 面）plan-graph validate + WaveGate →（doc 面）Contract.validate → dispatch）· 三动词脏树 → BLOCK 负例断言
- **Steps**:
  - `PreFlight` 失败测试：三动词 × 脏树 → BLOCK（CDD_BLOCKED 通道 + 指导 · child 零派发）+ 门序组合断言 — checkable: 负例断言绿 · child 零派发（dispatch 面 spy）
  - 跑测试确认失败（现引擎脏树裸跑） — checkable: 失败如预期
  - 实现 `PreFlight`（tree-clean 接线 · 门序组合 · evidence/读回门留驻 child 面） — checkable: 三动词脏树 → BLOCK
  - cli `#runWork` 前置门收敛 seam 单入口（wave gate / plan-graph / doc-contract 不再散件） — checkable: 门序单点调用 · cli 零重复实现（代码审查断言）
  - 引擎 vitest 全绿 + 回归（既有 wave 门测试不破） — checkable: engine vitest 通过
  - commit `fix(engine): lifecycle pre-flight seam——全动词 clean-tree 硬门（dirty→BLOCKED）· 三门收敛单入口`（自测绿后）
- **Acceptance**: 三动词脏树 → CDD_BLOCKED + 指引（child 零派发）· seam 单入口（cli 零重复 · 门序可判）· engine vitest 全绿
- **DependsOn**: none

### Task 2: Schema 三类型同构（Version / Change history / selfBounded）

- **Objective**: 三类型注册表同构（design §2）——`**Version**` presence required ×3（plan optional → required）· valuePattern 严格形 `^- \*\*Version\*\*: v\d+\.\d+ · \d{4}-\d{2}-\d{2}$`（头仅号+时间·零补充说明/链/bold）· spec/plan 注册表新增 `## Change history`（required）+ 行/日期元素 · selfBounded invariant 扩展判 spec/plan（header = 表内最新且必在行内）· 派生 schema/slices/描述面随一声明投影 · 字节 pin 测试随动
- **Files**: `packages/cdd-engine/src-next/contract/declare.ts`（改：Version 元素 ×3 · spec/plan 增 Change history 元素）· `packages/cdd-engine/src-next/contract/invariants.ts`（改：selfBounded ×3）· 派生面（schema 输出/描述）· `packages/cdd-engine/src-next/contract/__tests__/`（改/增：presence · pattern 负例 · selfBounded spec/plan 断言 · 字节 pin）
- **Consumes**: 元素登记表派生面（shape/schema/slices · 一声明四派生）
- **Produces**: 三类型注册表同构 · `**Version**` 严格形 · `## Change history` required ×3 · selfBounded(plan/spec) 生效
- **Steps**:
  - 失败测试：三类型 Version presence 断言 · pattern 负例（补充说明/链/bold 全拒）· Change history required ×3 · selfBounded 对 spec/plan（header=最新行且必在行内） — checkable: 断言绿（负例全拒）
  - 跑测试确认失败（plan optional · 无 Change history 元素 · selfBounded overall-only） — checkable: 失败如预期
  - declare.ts：Version ×3 presence/valuePattern · spec/plan 增 Change history 行/日期元素 — checkable: 注册表断言绿
  - invariants.ts：selfBounded 扩展 spec/plan — checkable: spec/plan selfBounded 断言绿
  - 派生面投影 + 字节 pin 测试更新（schema 输出/描述同步） — checkable: 派生面一致 · pin 更新
  - 引擎 vitest 全绿 — checkable: engine vitest 通过
  - commit `fix(engine): schema 三类型同构——Version required/严格形 · Change history required ×3 · selfBounded ×3`（自测绿后）
- **Acceptance**: 三类型注册表同构 · pattern 严格形（补充说明/链/bold 全拒）· selfBounded ×3 生效 · 派生面字节 pin 更新 · engine vitest 全绿
- **DependsOn**: none

### Task 3: 全树迁移（拆链 · 补表 · 建档 · 严格化）

- **Objective**: 全树 doc 合规（design §3 规则为准 · 基线 53 文档 · 现树 54 = 53 + 本 plan）——4 携链拆链成行（p3.1/p3.2 design×2 + plan×2）· 47 建/补 `## Change history`（23 design + 24 plans——cdd-review-contract-fix spec 已自带表 · P4.1 design/plan 已建表作示范，皆非建/补对象）· 11 无匹配形（9 真无头建档：补头 + 初始行 · 2 bold 归一 = p3.2 design/plan）· 28 有头非严格清零（26 非 bold + 2 bold · 含 3 旧 overall 补日期 = 其 Change history 末行日期）· **版本摘要逐字入行 + 机 pin 并集零漏**（迁移前头部文本 vs 迁移后表行）· `前置 v`/补充说明在 `**Version**` 头行零残留（表行豁免）· 零 retro-rename
- **Files**: `docs/kairos/specs/*`（23 design + 4 overall + cdd-review-contract-fix 头部/表）· `docs/kairos/plans/*`（24 plans）· 迁移机 pin 脚本（scripts/ 或任务内手动断言）
- **Consumes**: Task 2（schema 已含新结构/严格形，doc-contract 可判）
- **Produces**: 全树合规 doc（Version 头零链零补充说明 · 每 doc 有 Change history 覆全谱系）· 机 pin 基线
- **Steps**:
  - 4 携链文档拆链：`前置 v…` 逐版拆为表行（版本 token 切行 · 摘要逐字入 summary） — checkable: 表行版本序 ascending · 全文版本 = 表最大版本
  - 非严格形补充说明转录：按 `· vX.Y` 版本 token 全量切行（consumer-parity-p2-design v1.4 括号全史等 ~20 文档） — checkable: 迁移前头部文本 ⊆ 迁移后表行（并集零漏）
  - 3 旧 overall（osuperpowers `v1.61`/consumer-parity `v1.49`/pi-harness `v1.30`）补日期 = 其 Change history 末行日期 + 去补充说明 — checkable: 严格形绿
  - 47 建/补表 + 9 真无头建档（补 `**Version**` 头 + 初始行 · 日期 = 迁移日） · 2 bold 形（p3.2 design/plan）归一 — checkable: 机械清点（基线 53 = 现树 54 − 本 plan · 47 补表 · 11 无匹配形 = 9 真无头 + 2 bold · 4 拆链 · 28 有头非严格清零）与规则断言一致 —— 以上计数为登记基线 · 以本步机械清点复核为准（规则断言 = 验收 · 计数差异按规则处理并记 notes · 不上溯 spec §3）
  - `**Version**` 头行零残留 grep（`前置 v` · `（` 补充说明 · `**v` bold——表行/引述豁免） — checkable: 归一扫面零命中（历史清单除外）
  - `pnpm run validate` 零 drift（doc-contract 对新形全绿） — checkable: validate ALL PASS
  - commit（文档批量 · 独立提交：迁移一批 + 机 pin 断言落档）
- **Acceptance**: 全树合规（规则断言 · 机械清点复核 47 补表/11 无匹配形 = 9 + 2/4 拆链/28 有头非严格清零 一致）· 机 pin 并集零漏 · 头行零残留 grep · validate 零 drift · 零 retro-rename
- **DependsOn**: 2

### Task 4: next 可执行命令字面量（引擎）

- **Objective**: `next:` 渲染为完整可执行命令（design §5）——routeText/#capsuleLines 从命令声明表派生全参 argv（implement 声明表补 `--type` 默认 wave · render 必含 `--plan` required）· 三命令动词 × 全 type next 字面**二次 parse 零错误** · `done` 裸终词不喂 parse · 干 run E2E 实链（rev1→implement wave 2 等）· routeWords 词面同步 · BLOCKED/TIMEOUT 轮保持无 next
- **Files**: `packages/cdd-engine/src-next/face/cli.ts`（改：CLI_COMMANDS.implement 补 type 键 · routeText 全参组合）· `packages/cdd-engine/src-next/render/templates.ts`（改：render implement 含 `--plan`）· `packages/cdd-engine/src-next/face/words.ts`（改：routeWords）· `packages/cdd-engine/src-next/session/__tests__/next.test.ts` + `face/__tests__/cli.test.ts`（改：二次 parse 断言 · E2E）
- **Consumes**: Task 1（seam 门 E2E 走全动词前置）；帧事实（type/tasks/doc 路径/base-head/findings）
- **Produces**: next 字面 = 完整可执行命令（三动词 × 全 type）· 二次 parse 零错误断言
- **Steps**:
  - 失败测试：next 字面喂 CLI `parse()` 零错误（三动词 × type 例：`implement … --tasks 17` · `review --type spec --spec …` · `fix --type spec --spec … --findings …`）+ done 不喂 parse 断言 — checkable: 断言绿
  - 跑测试确认失败（现 implement 无 `--type` · render 缺 `--plan` → parse 拒 `unknown option: --type`） — checkable: 失败如预期
  - CLI_COMMANDS.implement 补 `--type`（默认 wave · 与 `#runWork` 读 `parsed.args.type ?? "wave"` 一致）· render implement 必含 `--plan` — checkable: parse 成功
  - routeText/#capsuleLines 组合全参 argv（帧事实 → 声明参数域 · 零硬编码格式串）· routeWords 词面同步 — checkable: 全 type 字面 parse 零错误
  - 干 run E2E 实链（rev1→implement wave 2 / rev2→done） — checkable: E2E 绿
  - 引擎 vitest 全绿 — checkable: engine vitest 通过
  - commit `fix(engine): next 字面可执行化——routeText 从命令声明表组合全参 argv · implement 补 --type/--plan · 二次 parse 断言`（自测绿后）
- **Acceptance**: next 字面三动词 × 全 type 直接可执行（二次 parse 零错误 · 现现场字面可直派）· done 终词不喂 parse · 干 run 实链 · routeWords 同步 · engine vitest 全绿
- **DependsOn**: 1

### Task 5: 技能消费面同步（author→commit→review · next 字面）

- **Objective**: 消费面随门随字面同步（design §4/§5.4）——cdd-spec-writer / cdd-plan 的 author→review 之间插入 commit 步骤（clean-tree 硬门迫使 · `author-spec`/`author-plan` 节点文本 + digraph 顺延）· cdd-dev review 入口门纪律 · 四技能 Review Convergence（I2/I1/I3）next 字面例更新为完整可执行命令 · emit 再生 · checkAnatomy 绿
- **Files**: `packages/kairos/skills/cdd-spec-writer/SKILL.md`（改）· `packages/kairos/skills/cdd-plan/SKILL.md`（改）· `packages/kairos/skills/cdd-dev/SKILL.md`（改）· `packages/kairos/skills/cdd-design/SKILL.md`（改：I2 字面例）· emit 产物（`.claude-plugin/` 等随 `pnpm run emit` 再生）
- **Consumes**: Task 1（门迫使顺序）· Task 4（字面语义）
- **Produces**: 三技能 author→commit→review · 四技能 I2/I1/I3 字面 = 完整可执行命令 · emit 新鲜
- **Steps**:
  - cdd-spec-writer：author-spec 节点补「commit 先于首轮 review」+ digraph 顺延 — checkable: 技能文本断言（commit 先行）
  - cdd-plan：author-plan 同法 — checkable: 同
  - cdd-dev：review 入口门纪律声明（implement child 已 commit · review 前 clean-tree 由引擎门保） — checkable: 文本断言
  - 四技能 I2/I1/I3 next 字面例更新（`implement wave {tasks}` → 全参命令例 · `(read file back to confirm)` 保持） — checkable: 字面例 grep = 可执行形
  - `pnpm run emit` 再生 · checkAnatomy/skill-anatomy 绿 — checkable: emit:check 零 drift · checkAnatomy 绿
  - commit（kairos docs）+ kairos-docs changeset 随本提交落位（engine fix changeset 不在此 · 归属 T6） — checkable: 提交/变更集独立 · 本步仅 kairos-docs 一枚
- **Acceptance**: 技能文本兑现（author→commit→review · 字面例可执行）· emit 新鲜 · checkAnatomy 绿 · changeset 落
- **DependsOn**: 1, 4

### Task 6: 终验 + changesets

- **Objective**: 全量终验（design Acceptance 收口）——validate ALL PASS · 机械清点复核一致（基线 54 = 53 + 本 plan · 47 补表 · 11 无匹配形 = 9 真无头 + 2 bold · 4 拆链 · 28 有头非严格清零）· 零残留归一 grep 全绿 · engine vitest 全绿 · typecheck/biome/emit 新鲜 · 变更集归属唯一（kairos docs 随 T5 · cdd-engine fix 随 T6 · 独立提交）
- **Files**: `.changeset/<slug>.md`（×1 本步新写：cdd-engine fix——kairos docs changeset 已由 T5 落位 · 本步仅复核两枚独立落位）
- **Consumes**: Task 3（迁移）· Task 4（next 字面）· Task 5（技能同步）
- **Produces**: validate ALL PASS 终态 · 变更集落位
- **Steps**:
  - 全量 `pnpm run validate`（emit:check · kairos 树/接线 · pi-package · 零残留 + 通道审计 · marketplace · scripts unit · 版本同步）+ 机械清点复核（54/47/11/4/28 与规则断言一致） — checkable: ALL PASS · 复核一致 —— 以上计数为登记基线 · 以本步机械清点复核为准（规则断言 = 验收 · 计数差异按规则处理并记 notes · 不上溯 spec §3）
  - cdd-engine fix changeset 独立提交（kairos docs changeset 已由 T5 落位 · 本步复核两枚独立落位） — checkable: `.changeset/` 两文件落 · 提交独立
- **Acceptance**: validate ALL PASS · 机械复核一致 · 变更集落（cdd-engine fix 随 T6 · kairos docs 随 T5 · 两枚独立）
- **DependsOn**: 3, 4, 5

### Task 7: round-context/artifact 面统一（find #4 + #5）

- **Objective**: 消费面清理（design §6 · W1 期 backfill）——**find #4**：删 `INPUT_RULES` 键（cli 声明/valuesOf/round-context 三处）· implement prompt 提醒行改指 plan `## Constraints`（child 经 INPUT_PLAN 直读 · 零物化零死指针）· **find #5**：workspace artifact 单一命名制 `{family}-{key}-{artifact}`（doc = `{op}.{type}.{round}`（spec-review-1）· work = `tasks-{wave}`/`branch-{key}`）· round context 注入 `OUTPUT_BRIEF`/`OUTPUT_REPORT`/`OUTPUT_EVIDENCE`（prescribed · 同 OUTPUT_HANDOFF 模式）· 三行块路径一致性校验（或引擎自派生不靠 child 报告）· cdd-plan author-plan 句 + 模板 artifacts 段同步（零自由命名 · 跨轮零覆写）
- **Files**: `packages/cdd-engine/src-next/face/cli.ts`（改：INPUT_RULES 删 · OUTPUT_* 注入 · artifacts 一致性）· `packages/cdd-engine/src-next/render/templates.ts`（改：implement 提醒行 · artifacts 段）· `packages/cdd-engine/src-next/face/__tests__/cli.test.ts` + `render/__tests__/render.test.ts`（改：round-context 断言）· `packages/kairos/skills/cdd-plan/SKILL.md`（改：author-plan 句零物化声明）
- **Consumes**: Task 1（cli 前置面）· Task 4（round-context/模板面 · next 字面）· Task 5（技能文本）
- **Produces**: 零死指针 round context（约束单源 INPUT_PLAN）· artifact 单一命名制（prescribed OUTPUT_* · 跨轮零覆写）
- **Steps**:
  - 失败测试：round-context 断言（INPUT_RULES 零命中 · OUTPUT_BRIEF/REPORT/EVIDENCE 键在且命名 `{family}-{key}-` 前缀）· doc-family artifact 跨轮不覆写断言 — checkable: 断言绿
  - 跑测试确认失败（INPUT_RULES 现存 · doc-family 自由命名覆写） — checkable: 失败如预期
  - cli：删 INPUT_RULES（声明/valuesOf/round-context）· 注入 OUTPUT_*（`{family}-{key}` 命名派生）· 三行块路径一致性（或自派生） — checkable: 断言绿
  - templates：implement 提醒行改指 plan `## Constraints`（INPUT_PLAN）· artifacts 段同步 — checkable: 模板断言绿
  - 技能文本：cdd-plan author-plan 句删除/改述（零物化声明）· `pnpm run emit` 再生 — checkable: emit:check 零 drift
  - 引擎 vitest 全绿 — checkable: engine vitest 通过
  - commit `fix(engine): round-context 零死指针（INPUT_RULES 删 · 约束单源 INPUT_PLAN）+ artifact 单一命名制（family-keyed prescribed · 跨轮零覆写）`（自测绿后）
- **Acceptance**: INPUT_RULES 三处删除 · implement prompt 提醒行指 plan（child 经 INPUT_PLAN 直读约束）· artifact 单一命名制（prescribed OUTPUT_* · 跨轮零覆写回归）· 技能文本同步 · emit 新鲜 · engine vitest 全绿
- **DependsOn**: 1, 4, 5

## Change history

| Version | date | summary | author |
|---|---|---|---|
| v1.0 | 2026-10-09 | 初版——P4.1 design v1.2 批准后开写：六任务（pre-flight seam + clean-tree 硬门 · schema 三类型同构 · 全树迁移 · next 可执行字面量 · 技能同步 · 终验）· 波次 T1‖T2 → T3‖T4 → T5 → T6 | [human] · Claude Opus 5（kairos:cdd-design → kairos:cdd-plan） |
| v1.1 | 2026-10-09 | plan-review-1 全修（1 warn · 2 nit）：T3/T6 checkable 各补裁决句（登记基线 · 机械清点复核为准 · 规则断言 = 验收 · 计数差异按规则处理并记 notes · 不上溯 spec §3）· 清点口径改为现树实测（基线 53 = 现树 54 − 本 plan · 47 建/补 = 23 design + 24 plans · 11 无匹配形 = 9 真无头 + 2 bold · 4 拆链 · 28 有头非严格清零 = 26 + 2）· 非严格形扫面注 2 bold 归一行源拆链 · changeset 归属唯一化（kairos docs 随 T5 · cdd-engine fix 随 T6）· EOF 换行补回 | [human] · Claude Opus 5（kairos:cdd-design → kairos:cdd-plan） |
| v1.2 | 2026-10-09 | **W1 期 backfill（find #4 + #5 · Plan Sole Writer）**：新增 Task 7（round-context/artifact 面统一——INPUT_RULES 删（三处）· 约束单源 = plan `## Constraints` 经 INPUT_PLAN · artifact 单一命名制 `{family}-{key}-{artifact}` prescribed（OUTPUT_BRIEF/REPORT/EVIDENCE 注入）· 三行块一致性校验 · cdd-plan author-plan 句改述 · 跨轮零覆写）· 执行序 W03 = {6, 7}（T7 DependsOn 1, 4, 5） | [human] · Claude Opus 5（kairos:cdd-plan · Plan Sole Writer） |
| v1.3 | 2026-10-09 | **find #6（双标号）**：执行序波标签改引用 plan-graph board 派生标签（W00–W03 · 零基）——原自造一基 W1–W4 与 board 双标号（W4 = W03）· 一文一句约定声明 | [human] · Claude Opus 5（kairos:cdd-design → cdd-plan） |
