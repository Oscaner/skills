---
title: 引擎文档工具（Engine Doc-Tooling）— P1 Plan（review face overall 键 · face 全层重塑 ·
  help 展示面重建 · docKey 词表统一）
doc-type: plan
version: v0.2
date: 2026-10-11
slug: 2026-10-10-engine-doc-tooling-p1
base: develop
---

## Constraints

- **行为等价底线（spec Constraints · 父总体 Cross-cutting「face 重塑保行为等价」）**：退出码表（0/1/2 · 0 含 `--help`）· CDD_BLOCKED 通道 · doc-contract 判定语义 · `next:` dispatch 字面——**零变化**，引擎 vitest 全绿作证（Task 3/4 的重塑/渲染面只改形态不改语义）
- **零运行时依赖变化（spec Constraints）**：help 自研渲染 · 维护文档 `05-third-party-dependencies.md` do-not-re-add 守约（不回注 citty · package.json 依赖面零动）
- **docKey 词表统一随 P1 落（spec §5 · 用户 backfill 裁定）**：kebab 单一拼写 · get/gen 一表两面 · `phaseSpec` 别名面保留为消费平滑（P2 gen 先例 · 第五前提）；`schema get` 输出 JSON 主体不变（docType/title 本已 kebab）——字节变化限于寻址键/错误消息/文档键面
- **F5 render 面边界（spec §4.2 · post-approval backfill 钉定 · review fix-1 裁定）**：P2 属主的 `render/skeleton.ts`（及工作命令 render 面 `brief`/`issue-body`）**不在 P1 重塑面内**——仅随 D8 sweep 更名字面，不重组（跨程序属主保护）；边界保护的是 **render/ 源面重组**（源文件零重组）——`render/__tests__/skeleton.test.ts` 的 docKey 字面 pin 更替属**词表统一触达面**（word 面 · 非重组 · 与 D8 path rename 分明属主 · Task 1 Test/Files ledger 已列）
- **D8 跨程序树（overall Constraints）**：先行实现于现行 `src-next/` 树（不等 rename P2——改名 sweep 随后全库覆盖本 phase 新文件面 · Q3→b · 豁免面为空）；本 plan 的 `src-next/` 路径字面量即**实现真路径**
- **提交粒度（spec §7.3 · 一波一提交由引擎 implement 驱动）**：Task 1 = 词表统一触达面单一 commit · Task 2 = 推导共享化 + overall pin 面单一 commit · Task 3 = face 重塑面单一 commit · Task 4 = help/usage 面单一 commit · Task 5 = 验证证据面（零实现改动 · 无独立 commit 需求）；计划本身不写 git commit 步
- **消费面零 commit（spec §6 · 需求 #4 由引擎修复自足满足）**：`packages/kairos/skills/` 零触碰 · cdd-spec-writer SKILL.md 五词条（`例外`/`exception`/`误报`/`workaround`/`整体`）零命中保持（F7 实证 · Task 5 复查）
- **emit 铁律（repo）**：本 phase 零 SKILL.md 变更 → emit 无产物面变更 · `pnpm run emit:check` 保绿
- **语言纪律**：本 plan 中文（Strategy B）· 消费面 skill 文本英文主源（本 phase 消费面零 commit）
- **变更先回填本 overall（backfill-as-version）**：实施期若发现 spec/overall 复议实况先回填，再继续实现
- **不单开 changeset**：本 phase 两能力（review-face 键 · 词表统一 · help/face 重塑）贡献归 P3 主题归并吸收（overall · 不发布）

### Task 1: 引擎面——docKey 词表统一（kebab 单一拼写 · get/gen 一表两面）

- **Objective**: 全库 docKey/类型词表统一为**单一拼写 `phase-spec`（kebab）**——契约面（declare 登记表行键 · judge `DOC_KEYS`/`DocKey` 类型 · `docTypeParsers` 建 · invariants `ctx.docKey` 站点 · Projector 六投影键 · doc.ts 解析键）+ 派生面（validate 派生）+ words 键面 + session/preflight 键拼；face 面 schema get/gen **一表两面**（归并 `#docKeys` 与 gen 别名归一表为单一 vocabulary · `phaseSpec` 别名归一）· P2「schema get 字节不变」断言语义随统一更新（deliberate pin break）· 全测试 pins（judge/cli/face/invariants/lint/doc/preflight + project/declare/skeleton 三测试文件——F1 补全 Test ledger · `render/__tests__/skeleton.test.ts` 字面更替属词表统一触达面（F5 裁定））更替后引擎 vitest 全绿——落**词表统一面单一 commit**
- **Files**:
  - Modify: `packages/cdd-engine/src-next/contract/declare.ts`（登记表行键 `phaseSpec` → `"phase-spec"` · `DeclaredRegistries` 接口成员 `phaseSpec`（:75）→ kebab · 头注释计数核对不变）
  - Modify: `packages/cdd-engine/src-next/contract/judge.ts`（`DOC_KEYS`/`DocKey` 类型 → kebab）
  - Modify: `packages/cdd-engine/src-next/contract/invariants.ts`（`ctx.docKey === "phaseSpec"` 多站点 → `"phase-spec"` · registries inline 型键（:102）→ kebab）
  - Modify: `packages/cdd-engine/src-next/contract/project.ts`（六投影键 `Record<DocKey, _>` · `SkeletonProjection` registries · project.ts:264-274/334-342/380）
  - Modify: `packages/cdd-engine/src-next/contract/doc.ts`（docTypeParsers 键面 · 如含 camel 键）
  - Modify: `packages/cdd-engine/src-next/face/cli.ts`（schema get 值域 → `overall/plan/phase-spec` + `plan-graph` · get/gen 一表两面 vocabulary · `phaseSpec` 别名归一 · 错误消息端态钉定：get 面**四键** `available: overall, plan, phase-spec, plan-graph`（plan-graph 合法显示类型输入 · 保留入提示列）· gen 面**三键** `available: overall, plan, phase-spec`（gen 词表不含 plan-graph · `phaseSpec` 别名接受不入列 · cli.ts:2073 现含 camel 字面必改后端态）· **cli.ts:1278 preflight docKey 字面 `"phaseSpec"` → `"phase-spec"`（DocKey 收窄触达面 · 主动编辑 · tsc 击穿 · 非 words.ts 式被动——Task 1 落字面 kebab · Task 2 改共享推导（deriveDocType））**）
  - Modify: `scripts/validate.ts:243`（spec 树派生 → `"phase-spec"`）
  - 注：`face/words.ts` 无 Modify 条目——`docWords` 键经 `DocKey` 类型**被动 kebab**（`this.#projector.tokens()[docKey]` 调用 · 源面零 camel 字面）· 源文件期望零 diff（断言更替在 Test 面）
  - Test: `packages/cdd-engine/src-next/contract/__tests__/judge.test.ts` · `doc.test.ts` · `lint.test.ts`（camel docKey 字面 → kebab）
  - Test: `packages/cdd-engine/src-next/contract/__tests__/project.test.ts`（8 处 · `:25` 本地 `DOC_KEYS` 抄写同更 → kebab · `declaredRegistries.`/`skeletons.`/`projected.tokens.`/`projected.skeleton.` 属性访问键 → kebab · 270-271 注释别名语义同步）——F1 补 ledger
  - Test: `packages/cdd-engine/src-next/contract/__tests__/declare.test.ts`（3 处 `declaredRegistries.phaseSpec` 属性访问 → kebab）——F1 补 ledger
  - Test: `packages/cdd-engine/src-next/render/__tests__/skeleton.test.ts`（13 处 · renderOf/rendersNoLiteralN 调用字面 ×4 + `["overall","plan","phaseSpec"] as const`/`["overall","phaseSpec"] as const` 数组 ×8 + fixture 键 ×1 → kebab）——**F5 边界裁定：docKey 字面 pin 更替 = 词表统一触达面（word 面 · 非重组 · 与 D8 path rename 分明属主）** · render/ 源面维持零触碰
  - Test: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（`schema get phase-spec` 新主拼 · `schema get phaseSpec` 别名归一同字节 · get/gen 两错误消息用例新字节断言：get 四键 + 未识别 type · gen 三键 + 未识别 type）· `face.test.ts`（`docWords("phaseSpec")` 调用点字面更替 → kebab（:37/41/43 断言面））
  - Test: `packages/cdd-engine/src-next/session/__tests__/preflight.test.ts`（docKey 字面更替）
- **Consumes**: design spec §1.4（两键系统现状）· §5（词表统一 · 五投影→六投影翻正）· doc-contract docKey 词表现状（`contract/judge.ts:37` DOC_KEYS · `declare.ts:863-865` 行键 · `Projector` 五|六投影 · `face/cli.ts` schema 面 + words docWords）· P2 的 gen 别名归一表（`phaseSpec` → `phase-spec`）
- **Produces**: 全库单一拼写 `phase-spec`（kebab）· `schema get phase-spec` 合法主拼 + `phaseSpec` 别名归一（get/gen 一表两面 · 单一 vocabulary）· 错误消息端态钉定：get 面**四键** `available: overall, plan, phase-spec, plan-graph` · gen 面**三键** `available: overall, plan, phase-spec` · P2「get 字节不变」语义随更新后的全测试 pins
- **Steps**:
  - 契约面键拼更替（declare/judge/invariants/project/doc.ts）——**TS 推断连锁编译期收口**（索引访问全量暴露 · 六前提「OOP 统一」的编译期强约束 · spec §5.2 类型收口）；`words.docWords` 键同更 — checkable: 引擎 `tsc --noEmit` 全绿 · 契约面文件 `grep "\"phaseSpec\""` 零残留（别名归一表除外）
  - face 面：schema get/gen **一表两面**——归并 `#docKeys` 与 gen 别名归一表为单一 vocabulary（主拼 `overall/plan/phase-spec` · `phaseSpec` 别名归一到 kebab）· 错误消息端态钉定：get 面**四键** `available: overall, plan, phase-spec, plan-graph`（plan-graph 合法显示类型输入 · 保留入提示列 · 现 `[...this.#docKeys, "plan-graph"]`（cli.ts:2081）推导 kebab 后自然产出）· gen 面**三键** `available: overall, plan, phase-spec`（gen 词表不含 plan-graph · `phaseSpec` 别名接受不入列 · cli.ts:2073 现含 camel 字面必改后端态） — checkable: `schema get phase-spec` 出 JSON（主体字节与旧 `phaseSpec` 输出一致 · docType/title 本已 kebab）· `schema get phaseSpec` 别名归一同字节 · `schema gen phase-spec`/`phaseSpec` 归一同字节（P2 行为不变）· cli.test.ts 两错误消息用例钉新字节断言（get 四键 + 未识别 type · gen 三键 + 未识别 type）
  - 派生面 + session：`scripts/validate.ts:243` spec 树派生 → `"phase-spec"`（`dir === "plans" ? "plan" : …` 组合语义不变）· cli.ts:1278 preflight docKey 随 DocKey 收窄**必改字面**（`"phaseSpec"` → `"phase-spec"` · 主动编辑 · tsc 击穿 · 非 words.ts 式被动）——Task 1 落字面 kebab · Task 2 改共享推导（deriveDocType 改调 1275-1281） — checkable: `pnpm run validate` 版 doc-contract gate 面绿（validate 派生 kebab 与 judge 词表一致 · docs/kairos 全 tree 零 finding 面保持）· 引擎 `tsc --noEmit` 全绿（:1278 主动编辑后 · 收窄击穿闭合）
  - 测试 pins 全量更替（judge/doc/lint/invariants/preflight/cli/face 测试的 `"phaseSpec"` docKey 字面 + get 输出断言 + docWords 断言 → kebab）· **补 ledger 三文件**（`render/__tests__/skeleton.test.ts` 13 处 · `contract/__tests__/project.test.ts` 8 处 · `contract/__tests__/declare.test.ts` 3 处——DocKey 收窄后必击穿的 DocKey 型字面面 · F1 已分派归属）· cli.test.ts get/gen 错误消息用例新字节断言（get 四键 · gen 三键）· `phaseSpec` 仅保留在别名归一用例的显式引用 — checkable: 测试文件面 `grep "\"phaseSpec\""` 仅别名用例显式命中 · 引擎 vitest 全绿（433 基线 + 更替后）
  - 收口：`pnpm --filter @oscaner-skills/cdd-engine test` 全绿 · `pnpm run precommit` 过 · `pnpm run emit:check` 保绿（零 SKILL.md 变更）——全绿后落**词表统一面单一 commit**（scopes：契约/派生/get-gen 词表/测试 pins（含 render/__tests__/skeleton.test.ts · project/declare.test.ts 字面更替）· 不含 Task 3/4 的重塑与 help 面改动） — checkable: 各门禁 ALL PASS · commit 仅词表统一触达面 · render/ 源面零改动 · precommit 钩子绿
- **Acceptance**:
  - 全库 docKey 词表单一拼写 `phase-spec`（declare 行键 · judge DOC_KEYS/DocKey · invariants · Projector 六投影键（shape/schema/slices/tokens/reference/skeleton）· words · validate 派生 · preflight 键拼 kebab）
  - `schema get phase-spec` 合法主拼 · `phaseSpec` 别名归一同字节 · `schema gen` 归一行为不变 · get 输出 JSON 主体不变（docType/title 本已 kebab）
  - 引擎 vitest 全绿 · validate ALL PASS · precommit 过
- **DependsOn**: none

### Task 2: 引擎面——docKey 推导共享化 + overall review 能力

- **Objective**: 契约层导出**共享 docKey 推导**（类成员 · `DOC_KEYS` 同族 · 零裸函数）——basename 以 `-overall.md` 结尾 → `overall` · 其余 → `phase-spec`（与 validate.ts:243 现规则逐字对齐 · spec §2）；`face/cli.ts:1275-1281` preflight doc 构造改调（`type == plan` 分支组合）· `scripts/validate.ts:242-243` 组合改调（plans 目录分支留 validate 侧）· **colocated pin**：cli.test.ts 增 overall 目标 review 用例（`review --type spec --spec <overall fixture>` → exit 0 · 零 phase-spec 误报 · next 续路）——consumer 首次可对整体契约判压（spec §2.3）· 落**推导共享化面单一 commit**
- **Files**:
  - Modify: `packages/cdd-engine/src-next/contract/judge.ts`（`deriveDocType` 类成员——basename `-overall.md → overall` · 其余 → `phase-spec`）
  - Modify: `packages/cdd-engine/src-next/face/cli.ts:1275-1281`（preflight doc 构造 → 共享推导 · `type == plan` 分支组合）
  - Modify: `scripts/validate.ts:242-243`（组合改调：`dir === "plans" ? "plan" : deriveDocType(name)`）
  - Test: `packages/cdd-engine/src-next/contract/__tests__/judge.test.ts`（deriveDocType 单测：basename/目录前缀/absolute 边界 · -overall.md 正例 · 非 overall 负例）
  - Test: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（overall 目标 review colocated pin · GOOD_OVERALL 同型 inline fixture（judge.test.ts:19-71））
- **Consumes**: design spec §2（推导共享化 · 行为面）· Task 1 的 kebab docKey 词表（deriveDocType 发射词表面键）· preflight doc 构造现状（cli.ts:1275-1281）· validate 组合面（validate.ts:242-243 · F6 改调零测试伤）
- **Produces**: `deriveDocType(path): DocKey` 契约方法（类成员 · basename `-overall.md → overall` · 其余 → `phase-spec`）· cli preflight 改调（`type == plan → plan` · spec → `deriveDocType(specPath)`）· validate 组合改调（spec 树 = 共享推导 · plans 分支留 validate 侧）· overall 目标 review colocated pin（零 phase-spec 误报 · exit 0）
- **Steps**:
  - `deriveDocType` 契约方法（DOC_KEYS 同族 · 类成员 · 零裸函数）：`path.basename` 后 `endsWith("-overall.md") → overall` · 其余 → `phase-spec` — checkable: judge.test.ts 新 describe：`specs/x-overall.md → overall` · `specs/x-design.md → phase-spec` · `dir/sub/x-overall.md → overall`（目录前缀免疫）· absolute 路径 → basename 判定 · `x-overall.md.bak → phase-spec`（endswith 语义）· `x-overall.md/`（目录 vs 文件面按调用面约定）
  - cli preflight doc 构造改调（cli.ts:1275-1281：`docKey: type === "plan" ? "plan" : deriveDocType(specPath)`）· `type==spec` 时 target.doc 即 specPath — checkable: 现有 spec/plan review 用例全绿（phase-spec 行为不变 · exit 0 · next 续路）· implement 面零动
  - validate 组合改调（`dir === "plans" ? "plan" : deriveDocType(name)`——plans 分支留 validate 侧 · spec 树 = 共享推导）· 共享推导单测（deriveDocType 用例集）在引擎 vitest — checkable: `pnpm run validate` ALL PASS（doc-contract gate 面绿 · deriveDocType 语义与旧规则逐字一致 · 零漂移）
  - overall 目标 review colocated pin（cli.test.ts：inline `-overall.md` fixture（judge.test.ts GOOD_OVERALL 同型 · 十表格 · Program charter）→ `review --type spec --spec <overall>` → **exit 0 · 零 phase-spec 误报 · round JSON 落位 · next 续路**；断言锚定：stdout 含 `next:` 行 · 不含 phase-spec 类 finding 字样 · 与 cli.test.ts:792-834 现有 review 用例同断言 style）— checkable: 新用例绿 · 旧 spec/plan review 用例零回归
  - 收口：引擎 vitest 全绿（433 + 新增）· precommit · validate ALL PASS ——全绿后落**推导共享化面单一 commit**（scopes：judge deriveDocType + cli preflight + validate 组合 + deriveDocType 单测 + overall pin 用例） — checkable: 各门禁 ALL PASS · commit 面 = 推导与 pin 触达 · precommit 钩子绿
- **Acceptance**:
  - `cdd review --type spec --spec <任一既有 overall>`（如 `docs/kairos/specs/2026-10-10-engine-doc-tooling-overall.md`）判整体契约**零 phase-spec 误报** · 硬编码 `docKey: type === "plan" ? "plan" : "phaseSpec"` 旧字面 grep 零残留
  - overall 评审轮 colocated pin 绿（exit 0 · 零 finding · round JSON 落位）· 现有 spec/plan review 用例零回归
  - `pnpm run validate` ALL PASS · 引擎 vitest 全绿
- **DependsOn**: 1

### Task 3: 引擎面——face/ 全层重塑（六前提 · 行为等价）

- **Objective**: **face/ 全层**六前提最大程度重塑——cli.ts（六命令注册 · typed argv parse 通道 · run 分发 · preflight doc 构造 · 渲染面职责分离）+ capsule + words + graph-view + host 配合整理（OOP 统一 · 零裸函数 · 死码/空壳清理 · 高内聚低耦合 · 目录级重组许可 · 最大精简）；**行为等价底线**：退出码表（0/1/2 · 0 含 `--help`）· CDD_BLOCKED 通道 · doc-contract 判定语义 · `next:` dispatch 字面零变化——引擎 vitest 全绿作证（现行 433 + Task 1/2 新增）· 落**face 重塑面单一 commit**
- **Files**:
  - Modify: `packages/cdd-engine/src-next/face/cli.ts`（注册/parse/run/preflight doc/渲染职责分离重组 · 目录级重组许可）
  - Modify: `packages/cdd-engine/src-next/face/capsule.ts` · `words.ts` · `graph-view.ts` · `host.ts`（高内聚低耦合 · 死码/空壳清理——**P2 属主 render/skeleton.ts + brief/issue-body 不在本面**（F5 边界））
  - Test: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts` · `face.test.ts`（行为等价回归证言）
- **Consumes**: design spec §3（重塑范围 · 形态纪律 · 行为等价底线）· Task 1/2 后的词表与推导真面（kebab docKey · deriveDocType）· P2 后 face/ 现状形态
- **Produces**: face/ 全层终态（OOP 统一 · 零裸函数 · 高内聚低耦合 · 死码/空壳清理）· 行为等价证言（退出码表 · CDD_BLOCKED · doc-contract 语义 · next 字面 vitest 全绿）
- **Steps**:
  - 现状盘点：face/ 全层逐面审视（P2 后的 cli.ts/capsule/words/graph-view/host · 死码/空壳清单 · 职责交叠面）— checkable: 盘点落于实现笔记（plan 实现者记录）· 改动前全测试绿（既有 433 基线证言）
  - cli.ts 重组：command registry / typed argv parse / run 分发 / preflight doc 构造 / 渲染面——六前提形态（类成员 · 零裸函数 · 职责单一化 · 目录级重组许可）— checkable: 引擎 vitest 全绿（既有 + Task 1/2 新增 = 行为等价证言）· tsc --noEmit 绿
  - capsule/words/graph-view/host 配合整理（死码/空壳清理 · 高内聚低耦合 · 与 cli.ts 边界一致）· **P2 属主面零触碰**（render/skeleton.ts · brief/issue-body） — checkable: 全测试绿 · 重塑面 `git diff` 不含 `render/skeleton.ts` · Task 3 自身 commit 零 `render/` 目录组改动（`render/__tests__/skeleton.test.ts` 字面更替已由 Task 1 词表面 commit 承载 · F5 裁定）
  - 行为等价底线逐项复核：退出码表（0/1/2 · 裸解析错 exit 2 · `--help` exit 0）· CDD_BLOCKED 通道 · doc-contract 判定语义 · `next:` dispatch 字面——逐面断言存续 — checkable: cli.test.ts 退出码/CDD_BLOCKED/usage pins（Task 4 前旧字节）/next 字面用例全绿 · package.json 依赖面零动（零运行时依赖变化）
  - 收口：`pnpm run precommit` · 引擎 vitest 全绿 · emit:check 保绿 ——全绿后落**face 重塑面单一 commit**（scopes：face/ 全层文件 · 不含 render/ 属主面） — checkable: 各门禁 ALL PASS · commit 仅 face/ 面 · precommit 钩子绿
- **Acceptance**:
  - face/ 全层重塑后引擎 vitest 全绿（退出码表 0/1/2 · CDD_BLOCKED 通道 · doc-contract 判定语义 · `next:` dispatch 字面零变化）
  - 零运行时依赖变化（package.json 依赖面零动）· P2 属主 `render/skeleton.ts` + brief/issue-body 零触碰（F5 边界）
  - 死码/空壳清理零残留（六前提）
- **DependsOn**: 2

### Task 4: 引擎面——help/`--help` 展示面重建 + usage 重写（自研渲染 · 零依赖）

- **Objective**: 自研 help 渲染器（**零运行时依赖** · do-not-re-add 守约）：顶层 `cdd` 命令总览（六命令一览 · 职责 + 用法锚）+ **裸 `cdd` 升级为命令总览（exit 2 · 总览与 missing-command message 合一 · 退出码表零变 · spec §4.1 钉定）** · 每命令 `--help` 旗标级说明 + 值域 · 子命令树（`base set|get` · `schema get|gen` · `issue render`）· 错误路径智能提示（缺参/未知旗标 → usage + 定位 + 邻近建议）· 每命令一条最小示例；**CLI_USAGE 六行全面重写**（deliberate pin break · 友好语法）· cli.test.ts usage pins 全更替 · smoke-cdd.ts:121 子串锚确定动作（`includes("usage: cdd implement")` 前缀存活则零动作 · 首词变更则同步更替）· 落 **help/usage 面单一 commit**
- **Files**:
  - Modify: `packages/cdd-engine/src-next/face/cli.ts`（help 渲染面按 Task 3 重组后形态落位：顶层总览 · 旗标级说明 · 值域 · 子命令树 · 错误提示 · 示例 · 裸 cdd 总览 exit 2 · `CLI_USAGE` 六行重写）
  - Modify: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（usage 六行新字节 pins 全更替 · help 渲染用例：顶层总览/每命令 `--help`/叶子树/错误提示/示例 · 裸 cdd exit 2 断言）
  - Modify: `scripts/smoke-cdd.ts:121`（锚核查确定动作——前缀存活则零动作 · 首词变更则同步更替）
  - Test: `packages/cdd-engine/src-next/face/__tests__/cli.test.ts`（help 面全套用例）
- **Consumes**: design spec §4（目标形面 · 自研路线 · usage pin-break · 裸 cdd 退出码钉定）· Task 3 后的 face/cli.ts 形态（渲染面衔接）· `CLI_USAGE` 现状（cli.ts:89-98 六行单行 usage）· smoke-cdd.ts:121 锚现状（F4 实证）
- **Produces**: help 渲染器（顶层命令总览 · 旗标级说明 + 值域 · 子命令树 · 错误路径智能提示 · 示例）· 裸 `cdd` = 命令总览 + missing-command（exit 2）· `CLI_USAGE` 六行重写（deliberate pin break）· cli.test.ts usage pins 更替 + help 用例 · smoke-cdd 锚确定动作
- **Steps**:
  - help 渲染器（自研 · 零依赖 · Task 3 后形态）：顶层 `cdd` 命令总览（六命令一览 · 职责一句话 + 用法锚）· 裸 `cdd` **升级为命令总览**（**exit 2 · 总览 + missing-command message 合一 · 退出码表零变 · spec §4.1**——信息面 exit 0 拒批（deliberate 表变更 · §3.3 未授权））— checkable: cli.test.ts：`runArgv([])` → exit 2 · stdout 含六命令总览 + missing-command 字样 · 现 exit 2 parse 面用例零回归
  - 每命令 `--help` 旗标级说明 + 值域 + 叶子树 + 示例（review/fix `--type <wave|branch|spec|plan>` 值域及语义 · `--tasks <n|n,n,…>` · `--spec/--plan/--base/--head/--round/--findings/--dry-run` 逐旗标 · `base set|get` · `schema get|gen`（kebab 词表 · Task 1）· `issue render` · 每命令一条最小示例）· `--help`/`-h` 任意位置接受（既有 399-412 断言保持）— checkable: 每命令 `--help` 渲染断言（含旗标/值域/叶子/示例字面）· `--help` exit 0 保持
  - `CLI_USAGE` 六行全面重写（deliberate pin break · 旗标值域 · leaf 展开 · 档位语义）· cli.test.ts usage 字节 pins 全量更替（cli.test.ts:237-238 区「steady consumption face」→ 新字节）— checkable: `CLI_USAGE` 新字节 pin 全绿 · 旧字节断言零残留（grep 旧 usage 字面零命中）
  - 错误路径智能提示（缺参/未知旗标 → usage + 定位 + 邻近建议 · **exit 2 保持** · spec §4.4）— checkable: 缺参/未知 flag 用例断言含定位/邻近建议 · exit 2 断言保持
  - smoke-cdd.ts:121 锚确定动作核查（`includes("usage: cdd implement")`——usage 重写后核查首词：`"usage: cdd implement"` 前缀存活则零动作 · 首词变更则同步更替）+ 收口：precommit · 引擎 vitest 全绿 · smoke-cdd 全链 ——全绿后落 **help/usage 面单一 commit**（scopes：help 渲染器 + `CLI_USAGE` 重写 + cli.test.ts pins + smoke-cdd 锚） — checkable: 各门禁 ALL PASS · 新 usage 首词核算（`usage: cdd implement` 前缀态 → smoke-cdd 零动作或同步更替二选一落定）· commit 面 = help/usage 触达
- **Acceptance**:
  - `--help`/顶层 `cdd` 完整形面：旗标级说明 + 值域 · 子命令树 · 命令总览（裸 `cdd` exit 2 · 总览 + missing-command message 合一）· 错误路径智能提示 · 示例（cli.test.ts help 用例全绿）
  - usage 六行重写落定（deliberate pin break）· cli.test.ts usage pins 全更替 · smoke-cdd 锚确定动作落定
  - 引擎 vitest 全绿 · precommit 过 · 零运行时依赖变化
- **DependsOn**: 3

### Task 5: 收口——验证与回归面（证据 in 册）

- **Objective**: 全链收口验证——消费面 skill 零 commit 复查（cdd-spec-writer SKILL.md 五词条零命中 · `git diff` 零消费面文件）· 残留核查（camel docKey 旧字面 · 旧 usage 字面 · 硬编码推导字面 grep 全零）· 引擎 vitest 全绿（433 基线 + 四任务新增 pins）· `pnpm run validate` ALL PASS（emit 新鲜 · kairos tree/wiring · marketplace · scripts 单元 · 版本同步）· precommit 过 · smoke-cdd 全链 + 整体契约黑盒复核（`cdd review --type spec --spec <既有 overall>`）——验收证据在册 · 零实现改动（无独立 commit 需求 · 若引擎波次语义要求则提交证据文件）
- **Files**:
  - Validate: `packages/cdd-engine`（vitest 全绿）· `scripts/run.ts validate`（ALL PASS）· `scripts/smoke-cdd.ts`（全链）· `packages/kairos/skills/cdd-spec-writer/SKILL.md`（零 commit 复查面）
  - Test: 复核面——grep pins（引擎树 `packages/cdd-engine/src-next` + `scripts/` · docs/kairos 文档面豁免）
- **Consumes**: design spec §6（消费面连接）· §7（验证与程序纪律）· Task 1–4 的落地真面（词表 · 推导 · face · help）
- **Produces**: acceptance 全项证据（引擎 vitest 计数 · validate ALL PASS 记录 · precommit 过 · smoke-cdd 链 · grep pins 零命中 · 消费面零 diff 证明）
- **Steps**:
  - 消费面 skill 零 commit 复查：cdd-spec-writer SKILL.md 五词条（`例外`/`exception`/`误报`/`workaround`/`整体`）零命中 · `git diff 主分支..HEAD -- packages/kairos/skills/` 零变更 — checkable: 五词条 grep 零命中 · 消费面零 diff 证明
  - 残留核查（**范围钉引擎树**：`packages/cdd-engine/src-next` + `scripts/` · docs/kairos 文档面豁免——冻结文档含散文引用）：`"phaseSpec"` camel 字面（例外枚举：`GEN_TYPE_KEYS` 别名行进列 + cli.test.ts 别名用例 `schema get phaseSpec` 同字节断言显式豁免——与 Task 1 步骤 4「仅别名用例显式命中」对齐）· 旧 usage 六行字面 · `docKey: type === "plan" ? "plan" : "phaseSpec"` 硬编码推导（docs 面豁免 · 本 plan/spec 所述即历史引用）——引擎树内 grep 零命中 — checkable: 各 grep pin 零命中（引擎树范围 · docs 豁免 · 例外枚举完整 · 词表统一验收）
  - 引擎 vitest 全绿（433 基线 + 四任务新增 pins 全通过）· `pnpm run validate` ALL PASS（emit 新鲜 · kairos anatomy 契约 · 插件解析 · marketplace 一致 · scripts 单元 · 版本同步）· `pnpm run precommit` 过 — checkable: 各门禁 ALL PASS · 证据记录在册（test_evidence 面）
  - smoke-cdd 全链（standalone CLI 黑盒 · 消费面体验）· 整体契约黑盒复核抽 1 个既有 overall（`docs/kairos/specs/2026-10-10-engine-doc-tooling-overall.md`）跑 `cdd review --type spec --spec <path>` → 零 phase-spec 误报 — checkable: smoke-cdd 0 退出 · 黑盒复核零误报
  - 收口：实施期若有 spec/overall 复议实况先回填（backfill-as-version）· 不单开 changeset（归 P3）· 验收证据整理 in 册 ——零实现改动面无独立 commit（Task 1–4 单 commit 已各落） — checkable: 证据清单与 spec §7 acceptance 逐项对应
- **Acceptance**:
  - §7 acceptance 全项证据在册：词表统一（kebab 单一拼写 + get/gen 一表两面 + pins 全绿）· 推导共享化（overall 判压零误报 + 硬编码残留零）· face 重塑行为等价（退出码表/CDD_BLOCKED/doc-contract/next 字面零变化）· help 形面（旗标级 · 值域 · 子命令树 · 命令总览 · 错误提示 · 示例 + usage pins 全更替）· 零运行时依赖变化 · 引擎 vitest 全绿 · validate ALL PASS · precommit 过 · 消费面零 commit 复查
- **DependsOn**: 4

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-10-11 | P1 实现计划：五任务串行——Task 1 词表统一（kebab 单一拼写 · get/gen 一表两面 · P2 get 字节 pin 语义更新）· Task 2 推导共享化（deriveDocType 契约类成员 · validate 组合 · overall 评审 colocated pin）· Task 3 face/ 全层六前提重塑（行为等价底线）· Task 4 help/`--help` 展示面重建 + usage 六行重写（自研零依赖 · 裸 cdd exit 2 钉定）· Task 5 收口验证（证据 in 册 · 零实现改动）· 任务解自 design spec v0.3（§2–§7 · F5 render 面边界 · 词表统一裁定 backfill） | [human] · Claude Opus 5（kairos:cdd-plan · writing-plans import） |
| v0.2 | 2026-10-11 | P1 实现收口（cdd-close）——五任务全闭环（implement→review→fix 链各 APPROVED）：T1 词表统一 · T2 推导共享化（含 41f74487 单契约实例 fix）· T3 face 全层重塑 · T4 help/usage 重写 + did-you-mean 候选收窄 fix（verb 级）· T5 收口验证 + charter carve-out fix · 分支终审 1 warn（leaf 粒度 did-you-mean 候选越界）→ 分支 fix 闭环（surface 携带 · sibling keys 不再并入 · 双例 pins）· 引擎 vitest 452/452 · validate ALL PASS · 工作树净 | [human] · Claude Opus 5（kairos:cdd-close · closeout-backfill） |
