# 引擎文档工具（Engine Doc-Tooling）— P1 Design Spec（review face overall 键 · face 全层重塑 · help 展示面重建）

- **Version**: v0.1 · 2026-10-11
- **Status**: Draft
- **Author**: [human] · Claude Opus 5（kairos:cdd-design [P1] grilling 定案 → cdd-spec-writer）
- **Parent program**: [2026-10-10-engine-doc-tooling-overall.md v1.4](docs/kairos/specs/2026-10-10-engine-doc-tooling-overall.md)
- **Depends on**: 依赖升级与 src 更名程序 P2（sweep 面关系 · D8 拆 pin——本 phase 先行实现于现行 `src-next/` 树，rename sweep 随后全库覆盖本 phase 新文件字面量）；本程序 P2（schema gen 模板写作 · 引擎面已落 v0.4 · 2026-10-11）——P1 ‖ P2 无硬依赖（父总体 Dependency graph · 执行串行按注册序）

## Design

本 phase 把引擎判侧缺口一次收口：**docKey 推导共享化**（`face/cli.ts` 硬编码 `phaseSpec` → 契约层共享推导 · validate 改调 · spec 树同源字面化），并随用户裁定（Q3→c · Q5→b · Q6→b · 「最大程度」）把 **face/ 全层重塑**与 **help/`--help` 展示面完整重建**并入本 phase。program 前提：六前提（① 破坏性重构许可 ② OOP 统一零裸函数 ③ 零技术债零散文堆砌 ④ 高内聚低耦合 · 死码/空壳全清 ⑤ 消费者心智负担优先 ⑥ 最大重构整合精简）在本 phase 所辖 **face/ 全层**全面生效（Q3→c · 用户 2026-10-11 裁定「你有想法那就最大程度」· Non-goal ④ 增注已落 overall v1.4）；行为等价底线 = 退出码表（0/1/2 · 0 含 `--help`）· CDD_BLOCKED 通道 · doc-contract 判定语义 · `next:` dispatch 字面——零变化（Cross-cutting「face 重塑保行为等价」· 引擎 vitest 全绿作证）· 零运行时依赖变化（help 自研渲染 · 维护文档 `05-third-party-dependencies.md` do-not-re-add 守约）。

### 1. 现状与取证基线

#### 1.1 docKey 推导现状（两处漂移 · D3 误报的引擎侧成因）

- `face/cli.ts:1278`（`#runWork` 的 preflight doc 构造）：`docKey: type === "plan" ? "plan" : "phaseSpec"`——spec 树硬编码 phaseSpec，**永不产生 overall** 且不看 path（F2 实证：src-next 全树唯一路径→docKey 派生点 = 此单行 · `session/preflight.ts` 只接收不重派生 · `contract/judge.ts` 只消费 `input.docKey`）
- `scripts/validate.ts:242-243`（checkDocContract）：`dir === "plans" ? "plan" : name.endsWith("-overall.md") ? "overall" : "phaseSpec"`——specs 树**已有**整体推导，与 CLI 面互不感知（D8 误报根源 = 两处漂移）
- 误报实况：`cdd review/fix --type spec --spec <任一 overall>` 走 phaseSpec parser/judge → 对整体契约误报（2026-10-10 误报面的引擎侧成因 · 父总体 D1/D3 已 pin）· 现 `cli.test.ts` **零** overall 目标 review 用例（误判面未钉）

#### 1.2 消费面现状（F7 实证 · 需求 #4 的实际接线面）

- cdd-spec-writer SKILL.md **零** overall 评审例外/变通文字——`例外`/`exception`/`误报`/`workaround`/`整体` 五词条零命中；review 轮按统一处方 `npx … review --type spec --spec <path>` 推进（SKILL.md:54）· overall 变体差异仅在手off 目标（同文件:61「overall 变体续下一 phase 设计会话」）
- 结论：`cdd review --type spec --spec <overall>` 判整体契约为 skill 的**既有期望面**，现被引擎硬编码击穿——本 phase 引擎修复后 **SKILL.md 零 commit 自足满足**（需求 #4 · §5.1）

#### 1.3 help 面现状与 citty 历史（Q4 事实面）

- `--help` 实况：`run()` 于 `parsed.help` 分支输出两行（`{surface.usage}\n{surface.description}\n`）后 exit 0（cli.ts:1207-1211 区）· `CLI_USAGE` 六行单行 usage（cli.ts:89-98）· 解析错 → usage + message + exit 2（`CliUsageError` · `runArgv`）——「展示不友好」现状 = 无旗标级说明 · 无值域 · 无子命令树（`base set|get` · `schema get|gen` · `issue render` 不展开）· 无顶层命令总览 · 无示例
- citty 来龙去脉：P5 引擎重建「CLI 换 citty（commander 移除）」（release #263 · CHANGELOG）→ P3.2 依赖壳剥离结构性替代（八包 ajv/citty/consola/execa/handlebars/hookable/semver/tinyglobby → `node:` 内建 + typed 常量数据 · 运行时面收敛到仅 `simple-git` · `.changeset/p3-2-terminal-closure.md`）→ 新树自研 typed argv 通道 + 稳定退出码表；维护文档 `05-third-party-dependencies.md:45` 明记「do not re-add」——**退役是有意裁定，非事故**

### 2. docKey 推导共享化（Q1→a · Q2→a）

#### 2.1 共享推导落契约层（类成员形态 · 零裸函数）

- 归置：contract 层 `DOC_KEYS` 同族（`contract/judge.ts:37`）——docKey 是 doc 契约的判别知识，契约面是自然属主；六前提「零裸函数」约束下以**类成员/契约方法**形态落地（如 doc 契约面方法 `deriveDocType(path): DocKey`），非游离导出函数
- 语义：spec 树推导逐字对齐 `scripts/validate.ts:243` 现规则——**basename 以 `-overall.md` 结尾 → `overall` · 其余 → `phaseSpec`**（与 validate 现行为 byte 语义一致 · 同源 = 同一实现同一规划）

#### 2.2 validate 改调组合

- `scripts/validate.ts:242-243` 改为**组合调共享推导**：plans 目录分支（`dir === "plans" ? "plan"`）留在 validate 侧（目录区分是 validate 消费面事实）+ spec 树 = 共享推导（`deriveDocType(name)` 等价调用）
- 可行性实证：validate 已按相对路径直连引擎 src（`validate.ts:18-21` · `.ts` 后缀 import · `scripts/tsconfig.json` allowImportingTsExtensions）——共享导出零额外门槛 · F6 实证 scripts 单测面不测 checkDocContract（validate.test.ts 仅步名断言）——改调零测试伤

#### 2.3 行为面（能力增量 · 其余零动）

- `cdd review/fix --type spec --spec <任一 overall>` → docKey=overall → judge 按整体契约判压（零 phase-spec 误报 · consumer 首次可判整体契约）
- 其余 `--type spec --spec <phase-spec>` → phaseSpec（行为不变）· `--type plan` 面不动（docKey=plan 既有）· `implement` 不经 spec 面（只吃 `--plan` · 零影响）· `next:` 续路字面（`fix --type spec --spec <overall> --findings …`）自动继承
- preflight seam 不重派生（接收 docKey · `session/preflight.ts` 实证）——推导点收敛为单一契约方法

### 3. face/ 全层重塑（Q3→c · Q6→b · 用户裁定「最大程度」）

#### 3.1 重塑范围

- `face/cli.ts`：六命令注册（implement/review/fix/schema/issue/base）· typed argv parse 通道（遗留/废弃面清查）· run 分发 · preflight doc 构造 · help 渲染——本 phase 能力增量全部落在这一面
- `face/` 其余文件（capsule · words · graph-view · host）**并入重塑**（Q6→b）：高内聚低耦合 · 死码/空壳清理，与 P2 已落地的引擎 OOP 形态（`Projector` 类 · 零裸函数纪律 · 类成员边界）对齐
- **目录级重组许可**：face/ 内部文件划分可重组（六前提 · 消费者心智负担——文件即职责边界）

#### 3.2 形态纪律（六前提全量生效）

- OOP 统一 · 零裸函数 · 死码/空壳清理 · 高内聚低耦合 · 消费者心智负担优先（help 正是其题中之义 · §4）· 最大精简——以「能力增量 + 展示面」为验证轴，非为重构而重构

#### 3.3 行为等价底线（Cross-cutting「face 重塑保行为等价」）

- 退出码表（0/1/2 · 0 含 `--help`）· CDD_BLOCKED 通道 · doc-contract 判定语义 · `next:` dispatch 字面——**全部零变化**，引擎 vitest 全绿作证（§6.2 回归面）

### 4. help/`--help` 展示面重建（Q3→a · Q4→a · Q5→b）

#### 4.1 目标形面（完整 · 非两行补丁）

- **顶层 `cdd` 命令总览**：六命令一览（职责一句话 + 用法锚）——裸 `cdd` 不再「无输出」
- **每命令 `--help` 旗标级说明 + 值域**：`--type <wave|branch|spec|plan>` 值域及语义 · `--tasks <n|n,n,…>` · `--spec/--plan/--base/--head/--round/--findings/--dry-run` 逐旗标说明
- **子命令树逐 leaf 展开**：`base set|get` · `schema get|gen` · `issue render`（嵌套 leaf 的可发现性）
- **错误路径智能提示**：缺参/未知旗标 → usage + 定位 + 邻近建议（保留 exit 2 · §4.4）
- **示例**：每命令一条最小可执行示例

#### 4.2 路线：自研渲染重建（Q4→a · 零依赖保持）

- **不回注 citty**——零运行时依赖姿态保持 · 维护文档 `05-third-party-dependencies.md:45` do-not-re-add 守约（退役为 P3.2 有意裁定 · §1.3）；render 面并入 face 重塑（类成员 · 零裸函数 · 高内聚低耦合）
- 目标形面（§4.1）全部由自研渲染器承担——消费心智负担与零依赖兼得

#### 4.3 usage 行重写（Q5→b · deliberate pin break）

- `CLI_USAGE` 六行全面重写为友好语法（旗标值域 · leaf 展开 · 档位语义）——**弃「byte-stable across tree generations」旧静止面**（原断言语义：usage 行 typo = 红测试；新语义：usage 行为**展示面产品**，随本 phase 定型为最终形态）
- **pin 更替面**：`cli.test.ts` usage 字节断言（cli.test.ts:237-238 区「the usage lines carry the steady consumption face」）全量更替为新字节 · smoke-cdd 锚（若含 usage 字面）同步更替（F5 核实后落定）

#### 4.4 输出面契约（D6 · 零变化底线）

- `--help` exit 0 保持 · 解析错误 exit 2 + usage + message 保持 · CDD_BLOCKED 通道零动 · `--help`/`-h` 任意位置接受（parse 语义保持 · cli.test.ts:399-412 既有断言）

### 5. 消费面连接（需求 #4 · skill 零改动）

#### 5.1 cdd-spec-writer SKILL.md 零 commit

- F7 实证：skill 无 overall 评审例外/变通文字（§1.2）——需求 #4 由引擎修复**自足满足**，skill 文本不动（零消费面 commit · 语言纪律「消费面 skill 文本英文主源」面无触碰）

#### 5.2 consumer 首次整体契约判压

- overall 经 review face 判压零误报（`cdd review --type spec --spec <overall>`）——cdd-spec-writer overall 变体评审字面（SKILL.md:54 统一处方）**无需 skill 例外即可满足**（评审轮续路 `fix --type spec --spec <overall>` 同理）

### 6. 验证与程序纪律

#### 6.1 colocated pins（引擎 vitest）

- `cli.test.ts` 增 overall 目标 review 用例：`review --type spec --spec <overall fixture>` → exit 0 · 零 finding · `next:` 按整体契约续路（fixture 形态沿用 inline 字符串数组 · 与 `contract/__tests__/judge.test.ts:19-71` GOOD_OVERALL 同型）
- 共享推导单测（path → docKey 判定 · basename/目录前缀/absolute 路径边界）· validate 改调侧零测试伤（F6 实证）
- help 渲染用例：顶层总览 · 每命令 `--help` · leaf 子命令树 · 错误路径提示 · `CLI_USAGE` 新字节 pin（§4.3）

#### 6.2 回归面

- 引擎 vitest 全绿（现行 433/433 + 新增 pin 全通过）· `pnpm run validate` ALL PASS · `pnpm run precommit` 过 · guard 零回归（skill-anatomy / words / channels 面不动）· 零运行时依赖变化（package.json 依赖面不动）

#### 6.3 程序纪律

- 父总体 **v1.4 已回填**（本 phase grilling 定案 · Q1–Q6 裁定 · overall 独立 commit 257a6655）· changesets（cdd-engine）归 P3 归并（本 phase 不承担 · 不发布）· D8：先行实现于现行 `src-next/` 树 · rename sweep 随后全库覆盖本 phase 新文件面

### Acceptance criteria

- `cdd review --type spec --spec <任一 overall>` 对整体契约判压——零 phase-spec 误报 · 硬编码 phaseSpec 残留零（`docKey: type === "plan" ? "plan" : "phaseSpec"` 旧字面 grep 零命中）
- 共享推导落契约层类成员 · `scripts/validate.ts` 改调组合（spec 树 = 共享推导 · plans 分支留 validate 侧）· 引擎 vitest 共享推导单测绿
- `--help`/顶层 `cdd` 完整形面：旗标级说明 + 值域 · 子命令树 · 命令总览 · 错误路径智能提示 · 示例（cli.test.ts help 用例全绿）
- usage 六行重写落定（deliberate pin break）· `cli.test.ts` usage pins 全更替 · smoke-cdd 锚（若含 usage 字面）更替
- face/ 全层重塑后引擎 vitest 全绿（退出码表 0/1/2 · CDD_BLOCKED 通道 · doc-contract 判定语义 · `next:` dispatch 字面零变化）
- 零运行时依赖变化（help 自研渲染 · 依赖面零动）
- `pnpm run validate` ALL PASS · `pnpm run precommit` 过
- changesets（cdd-engine）经 P3 归并落位（本 phase 不承担）

## Constraints

- **行为等价底线**：退出码表（0/1/2 · 0 含 `--help`）· CDD_BLOCKED 通道 · doc-contract 判定语义 · `next:` dispatch 字面——零变化（父总体 Cross-cutting「face 重塑保行为等价」）
- **零运行时依赖变化**：help 自研渲染 · 维护文档 `05-third-party-dependencies.md` do-not-re-add 守约（不回注 citty · package.json 依赖面零动）
- **D8 跨程序树**：先行实现于现行 `src-next/` 树（不等 rename P2）· rename sweep 随后全库 `grep -rn src-next` 覆盖本 phase 新文件面（豁免面为空）
- **language 纪律**（Strategy B）：内部 docs（本 spec）中文 · 消费面 skill 文本英文主源（本 phase 消费面零 commit）
- **父总体回填纪律**：变更先回填父 overall（backfill-as-version）再继续实现——本 phase grilling 定案已回填 v1.4；后续变更同律

## Change history

| Version | date | summary | author |
| --- | --- | --- | --- |
| v0.1 | 2026-10-11 | P1 design spec 初版——docKey 推导共享化（契约层类成员 · validate 改调）· face/ 全层六前提重塑 · help/`--help` 展示面重建（自研渲染零依赖 · usage 重写 pin-break）· 消费面 skill 零 commit · 验证与程序纪律（grilling Q1–Q6 定案收敛 · 父总体 v1.4 已回填） | [human] · Claude Opus 5（kairos:cdd-design [P1] → cdd-spec-writer） |