# 引擎文档工具（Engine Doc-Tooling）— Overall Spec

- **Version**: v1.9 · 2026-10-11
- **Status**: Draft
- **Author**: [human] · Claude Opus 5 (1M context)（kairos:cdd-design 元层裁定 → 独立整体注册）
- **Constraints**:
  - **从「依赖升级与 src 更名」程序拆出（2026-10-10 用户拍板「这个问题和 P4 其实是同一类的吧？那把 P4 拆出来和这个问题一起放独立 overall 里」）**：本程序承接该程序原 **P4（review-face overall 键）** + 用户 2026-10-10 提出的**写文档方案重设计（schema gen 模板写作）**——同属**引擎 doc-tooling 能力面**（裁判侧缺口：引擎判不了 overall · 写侧缺口：引擎不给写作结构）
  - **跨程序树协调（2026-10-11 用户裁定拆 pin → D8）**：~~强依赖~~ ——本程序 P1/P2 引擎改动**在 rename P2 落定前先行实现于现行 `src-next/` 树**，rename P2 的 sweep 随全库 grep 覆盖本程序新文件面（零登记豁免 · 豁免面清单仍为空——sweep 按字面量全局改，非登记列表）；本程序期引用沿用现行 `src-next/` 路径面（Q3→b 历史面全改语义 · rename sweep 覆盖本文件字面量 + 本程序实现新文件）
  - **CLAUDE.md「cdd CLI 零新子命令」pin 连带修订（2026-10-10 用户拍板授权）**：现行唯一例外 = `schema get` + `issue render`；`schema gen` 属新能力面，pin 修订为本程序 P2 范围内落地（文档先行 · 实现随之，不可只实现不改文）
  - **P2 grilling 定案（2026-10-11 · cdd-design [P2] · Q1/Q2/Q3 裁定）**：① **schema gen 输出 = stdout 纯渲染**，骨架落盘由编排器承担（`cdd schema gen phase-spec > specs/<name>.md`）；生成的骨架 = **完整结构**（标题树 · 表列头 · 版本/change-history 脚手架全须齐备），主体内容/description 槽位以**占位符提示**标出（填后零残留 pin）。② **CLAUDE.md 去 kairos/引擎流程（Q3→c · 直接删除，不迁不存）**——本仓库工作树逼近消费者环境，以验证消费者视角使用引擎的真实体验；消费面引导由 skills 承担（R4「先 gen 后填」）。③ **重构许可扩至整引擎 CLI 面（Q2→b · 六前提）**——schema gen 落地可重写代码、重组目录（OOP 统一 · 零裸函数 · 死码/空壳清理 · 高内聚低耦合 · 消费者心智负担 · 最大精简）；许可不止 schema/template 面，涉整个 face/cli.ts 与目录级重组，Non-goal ④ 随之改写（跨程序树 pin 与 gate 零例外不变）
  - **P1 grilling 定案（2026-10-11 · cdd-design [P1] · Q1–Q6 裁定）**：① **六前提重构许可扩至 P1 整 face 层**（Q3→c · 与 P2 同款许可）——cli.ts（六命令注册 · parse 通道 · run 分发 · preflight doc 构造 · help 渲染）+ capsule + words + graph-view + host 可重写/目录级重组（OOP 统一 · 零裸函数 · 死码/空壳清理 · 高内聚低耦合 · 消费者心智负担 · 最大精简）；② **help/`--help` 展示面完整重建**（Q4→a 自研渲染——零运行时依赖姿态保持 · 维护文档 `05-third-party-dependencies.md` do-not-re-add 守约）——目标形面：顶层 `cdd` 命令总览 · 每命令 `--help` 旗标级说明 + 值域 · 子命令树（`base set|get` · `schema get|gen` · `issue render`）· review/fix `--type` 值域提示 · 错误路径智能提示；③ **usage 行重写**（Q5→b · deliberate pin break）——CLI_USAGE 六行全面重写为友好语法，cli.test.ts usage pins + smoke-cdd 锚同步更替；④ **docKey 推导共享化**（Q1→a · Q2→a）——契约层导出共享推导（类成员形态 · 零裸函数），`scripts/validate.ts` 改调（spec 树 = 共享推导 · plans 目录分支留在 validate 侧组合）
  - **P1 docKey 词表统一裁定（2026-10-11 · 用户 backfill → P1 随 cli 面统一处理）**：**docKey/类型词表统一为单一拼写 `phase-spec`（kebab）**——治 D3 大小写坑本源（现「类型字面量 kebab / 门禁 docKey camel」两键系统）· 统一面 = declare 登记表行键 · judge DOC_KEYS/DocKey 类型 · invariants ctx 站点 · Projector 五投影键 · validate 派生 · cli preflight docKey · words 键 · schema get 值域（get/gen 一表两面）· **P2「schema get 字节不变」断言语义随统一更新**（deliberate pin break · 与 usage 重写 Q5→b 同级）· 因 P1 本就要重塑 cli 面，词表统一并入 P1（非独立议题 · 决策 D10）
  - **不发布**：changesets 收尾到可发布态即止；版本应用 / tag / publish = 独立动作
  - **语言纪律保持**（Strategy B 内部 docs 中文 · 消费面 skill 文本英文主源）
  - 变更先回填本 overall（backfill-as-version），再继续实现

## Document scope

Charter only, zero implementation detail. **Overall approval is not equivalent to any phase started（GATE）**——三个 phase 按注册序串行执行；P1 ‖ P2 无硬依赖（review face 与 schema/template 不同面），P3 硬依赖 P1（commander 框架化须 P1 face 重塑先行 · 原「changesets 收尾」独立 scope 经 2026-10-11 用户裁定折叠入 P3 的变更集义务，不设独立 phase）；变更先回填本 overall，再继续实现。全部引擎改动先行实现于现行 `src-next/` 树（D8 拆 pin —— 与依赖升级与 src 更名程序 P2 为 sweep 面关系，非硬 pin；rename sweep 随后全库覆盖本程序新文件面）。

## File paths

| Artifact | Path |
|---|---|
| Overall | `specs/2026-10-10-engine-doc-tooling-overall.md` |
| Phase spec | `specs/2026-10-10-engine-doc-tooling-p<N>-design.md` |
| Phase plan | `plans/2026-10-10-engine-doc-tooling-p<N>.md` |

## Program charter

### Goal

把引擎 doc 面两个能力缺口一次收口：**① 消费者整体契约门禁（review-face overall 键）**——engine `face/cli.ts` 的 doc-contract docKey 推导从硬编码 `phaseSpec` 放开为与 validate 同源的推导（`*-overall.md → overall` · 其他 → phaseSpec），consumer 首次可对整体契约跑 `cdd review/fix --type spec --spec <overall>`（零 phase-spec 误报）· kairos cdd-spec-writer 的 overall 变体评审字面可满足（无需 skill 例外）；**② 写文档方案重设计（schema gen 模板写作）**——引擎备几套文档模板：`schema gen <phase-spec|overall|plan>` 从声明面派生**骨架**（标题树 · 表列头 · `- **Version**: v1.0 · <date>` + change-history 首行脚手架——结构 by construction 保真），编排器（cdd-spec-writer/cdd-plan author 节点）**先 gen 后填**——`###`/`##` 类转写失误整类死亡，doc-contract 判定语义不变仍为兜底终判；**③ CLI 框架化收口（2026-10-11 用户裁定 · 原「changesets 收尾」改撤）**——commander ^15 重准入（CLI parse + help 渲染管线 · ARGV_CHANNEL 数据驱动单源 · 行为面全保），变更集收尾（P1/P2 deferred + 框架化 bump）随本 phase 折叠归并，不发布。

### Non-goals
- **不发布**：整理到可发布态即止——`changeset version` / 打 tag / 发布 = 独立动作，不在本程序
- **不改文档方法论语义**：schema gen 骨架 = declare.ts 登记表投影，不引入新文档结构；文档类型语义（overall / plan / phase-spec）、契约、gate 判压全部不变
- **不新增大文档结构 / 新 doc 类型**：模板覆盖既有三型（phase-spec / overall / plan），不发明第四型
- **引擎行为变化 = 能力面 + 六前提重构（2026-10-11 Q2→b 改写 · P1 同持 2026-10-11 Q3→c 增注）**：行为语义增量 = review face docKey 推导（P1）+ schema gen 能力（P2）+ help/`--help` 展示面（P1）；**P1 与 P2 同持整 CLI/face 面重构许可**（face/cli.ts + capsule + words + graph-view + host · 目录级重组 · OOP 统一零裸函数 · 死码/空壳清理 · 高内聚低耦合 · 消费者心智负担 · 最大精简），重构保行为等价（引擎 vitest 全绿作证）· 零运行时依赖变化（P1/P2 面 · P3 例外：CLI 框架化 commander ^15 重准入 · D11）· 零意外行为变化（其余 CLI 行为语义不动，仅形态可重组）
- **不 retro-改消费者已发面**：历史 SKILL.md / 文档不作回溯改写（消费面变更只发生在 author 节点表述）

### Cross-cutting（程序级横切约束，先立后执行）
- **模板结构保真由构造保证**：骨架 = declare.ts 登记表派生（标题树 · 表列头 · 版本/change-history 脚手架——`###`/`##` 层级无转写席位）；编辑器在槽位填内容不重排结构
- **gate 零例外底线**：doc-contract 判定语义不变——骨架生成不是 gate 豁免通道（骨架 by construction 绿 · 填后 gate 仍终判兜底）
- **消费面先 gen 后填**：cdd-spec-writer / cdd-plan 的 author 节点从「schema get 参考 + 手工转写」更新为「schema gen 骨架 + 填内容」；`schema get` 保留（声明参考面 · 其他工具/测试消费面不动）
- **CLAUDE.md pin 修订先行**：「cdd CLI 零新子命令」例外面扩 `schema gen`——文档改动与实现同 commit 面落地，不可只实现不改文
- **跨程序树协调（2026-10-11 用户裁定拆 pin → D8）**：本程序 P1/P2 引擎改动**先行实现于现行 `src-next/` 树**（不等 rename P2）——rename sweep 随全库 `grep -rn src-next` 改本程序新文件面（Q3→b 语义 · 豁免面为空）
- **P1 face 重塑保行为等价（2026-10-11 立）**：退出码表（0/1/2 · 0 含 `--help`）· CDD_BLOCKED 通道 · doc-contract 判定语义 · `next:` dispatch 字面——全部零变化，引擎 vitest 全绿作证；零运行时依赖变化（help 自研渲染 · 维护文档 do-not-re-add 守约——P3 例外：commander ^15 行重准入注记 · citty 等其余退役行不动 · D11）

### 设计决策留存（2026-10-10 —— 元层裁定 + 注册）

| # | 决策 | 定案 | 落点 |
|---|---|---|---|
| D1 | 程序来源（2026-10-10 用户拍板） | 原「依赖升级与 src 更名」程序 P4（review-face overall 键）拆出 + 写文档方案重设计（schema gen）——**同属引擎 doc-tooling 能力面**，并独立整体（本程序） | 本表 + Constraints + Change history v1.0 |
| D2 | 模板方向（2026-10-10 用户拍板「不是提供 schema get，而是 schema gen(generate)——让编排器先生成模板，然后在模板上填充内容」） | **schema gen <type> 生成式骨架**：声明面派生 · 结构 by construction 保真 · 编排器先 gen 后填；`schema get` 保留（声明参考面） | P2 scope |
| D3 | 模板覆盖（提出 · 设计会话细化） | **三型一次候选**：phase-spec / overall / plan——同源于 declare.ts，增量只是声明行；overall 正是 2026-10-10 误报面（typeName 大小写坑同型） | P2 scope |
| D4 | 本程序边界（2026-10-10 拆出裁定连带） | 3 phase：P1=review 键 · P2=模板写作 · P3=changesets 收尾 · 硬依赖依赖升级与 src 更名程序 P2（改名树）· 引擎其他行为面零动 | Phase inventory |
| D5 | schema gen 输出合约（2026-10-11 grilling Q1→a） | **stdout 纯渲染 + 编排器落盘**：`cdd schema gen <type> > specs/<name>.md`；骨架 = **完整结构**（标题树 · 表列头 · 版本/change-history 脚手架全须齐备），主体内容/description 槽位带**占位符提示**；填后零占位符残留 pin | P2 scope + Constraints |
| D6 | 重构许可边界（2026-10-11 grilling Q2→b） | **六前提全面开放**：P2 落地可重写/重组整个 face/cli.ts 与目录级（OOP 统一 · 零裸函数 · 死码/空壳清理 · 高内聚低耦合 · 消费者心智负担 · 最大精简）；重构保行为等价（vitest 全绿作证）；Non-goal ④ 随之改写；gate 零例外不变（跨程序树依赖随 D8 拆 pin · 2026-10-11） | P2 scope + Constraints + Non-goal ④ |
| D7 | CLAUDE.md 去流程化处置（2026-10-11 grilling Q3→c） | **直接删除 kairos/引擎流程叙述**（不迁 maintainers · 不迁 README）——工作树逼近消费者环境以验证消费者视角使用引擎的真实体验；消费面引导改由 skills 承担（R4「先 gen 后填」） | P2 scope + Constraints |
| D8 | 跨程序树依赖语义（2026-10-11 用户裁定拆 pin · D6 之后复核） | **hard pin → sweep 面关系**：本程序 P1/P2 引擎改动**先行于现行 `src-next/` 树实现**（不等 rename P2）· rename sweep 全库 `grep -rn src-next` 随后覆盖本程序新文件面（Q3→b · 豁免面为空）· 跨程序依赖由阻挡改**非硬**（sweep 按字面量全局改 = 零登记成本） | Constraints + Dependency graph + Boundary + Phase inventory |
| D9 | P1 面重构许可与 help 路线（2026-10-11 cdd-design [P1] 会话 · Q1–Q6） | **六前提破格于 P1 整 face 层**（Q6→b：cli.ts + capsule + words + graph-view + host 全层可重写/目录级重组）· **help 自研渲染重建**（Q4→a：零运行时依赖保持 · 维护文档 do-not-re-add 守约）· **usage 六行重写**（Q5→b：deliberate pin break · 测试锚同步更替）· **docKey 推导共享化**（Q1→a · Q2→a：契约层导出类成员 · validate 改调 · spec 树同源） | P1 scope + Constraints + Non-goal ④ + Cross-cutting |
| D10 | docKey 词表统一（2026-10-11 用户 backfill → P1 随 cli 面统一处理） | **全库单一拼写 `phase-spec`（kebab）**——declare 登记表行键 · judge DOC_KEYS/DocKey 类型 · invariants ctx 站点 · Projector 五投影键 · validate 派生 · preflight docKey · words 键 kebab 化 · **schema get 值域统一**（get/gen 一表两面 · phaseSpec 别名归一面）· **P2「schema get 字节不变」断言语义随统一更新**（deliberate pin break · 与 usage Q5→b 同级） | P1 scope + Constraints |
| D11 | help 框架化路线（2026-10-11 用户研究后裁定 · P1 收尾期） | **引入 mature CLI 框架 `commander` ^15**（运行时依赖 0 · 声明式 · 数据驱动——ARGV_CHANNEL 行度入 `.option()/.command()` 保单源）· **反转 D9 的 help 自研渲染面 + 维护文档 05 §4 的 commander 行 do-not-re-add**（commander P5 曾退役 · 本轮重准入 · citty 行与其余退役行不动）· **落地时机 = P1 收口后落地 · P3 槽位直接改写为 commander 框架化**（2026-10-11 用户裁定：不新增 phase · 原 P3「changesets 收尾」独立 scope 折叠入 P3 框架化的变更集义务——P1/P2 deferred + 框架化 bump 一次归并）· 适配层保行为面：退出码表 0/1/2 · CDD_BLOCKED 通道 · 字节错误消息 · did-you-mean · `--help` 任意位置 | P3（Phase inventory/Issue inventory/Dependency graph）+ 本表 + Change history v1.7 |

## Issue inventory

| Phase | Issue (ref) | Title summary |
|---|---|---|
| P1 | none | 引擎 review face overall 键：consumer 整体契约门禁——`cli.ts` 硬编码 phaseSpec 的 docKey 推导对齐 validate（`*-overall.md → overall`），`cdd review/fix --type spec --spec <overall>` 判整体契约 · cdd-spec-writer overall 变体评审轮可满足 · 引擎 vitest colocated pin · **P1 扩面（2026-10-11 Q3→c · 用户裁定）**：face/ 全层六前提重塑 + help/`--help` 展示面完整重建（自研渲染零依赖保持 · usage 六行重写 pin-break）· **docKey 词表统一（2026-10-11 用户 backfill · D10）**：全库单一拼写 `phase-spec`（kebab）——get/gen 一表两面 · P2 get 字节 pin 语义随统一更新 |
| P2 | none | 写文档方案重设计：schema gen 模板写作——CLI `schema gen <phase-spec/overall/plan>` 从 declare.ts 派生骨架（标题树/表列/版本脚手架）· 消费面 cdd-spec-writer/cdd-plan author「先 gen 后填」· CLAUDE.md「零新子命令」pin 连带修订 |
| P3 | none | CLI 框架化收口 + 变更集归并：commander ^15 重准入（parse + help 渲染管线 · ARGV_CHANNEL 数据驱动单源 · 行为面全保）· 原「changesets 收尾」独立 scope 经 2026-10-11 用户裁定折叠入本 phase（P1/P2 deferred + 框架化 bump 主题归并）· 不发布 |

## Phase inventory

| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |
|---|---|---|---|---|---|---|
| P1 | 引擎 review face overall 键 | 引擎 CLI：`face/cli.ts` 的 doc-contract docKey 推导从硬编码 `phaseSpec` 放开为与 validate 同源的推导（`*-overall.md → overall` · 其他 → phaseSpec · **共享化：契约层导出 · validate 改调 · plans 分支组合**）· consumer 首次可对整体契约跑 `cdd review/fix --type spec --spec <overall>`（零 phase-spec 误报）· kairos cdd-spec-writer 的 overall 变体评审字面可满足（无需 skill 例外）· **docKey 词表统一（D10 · 用户 backfill）**：全库单一拼写 `phase-spec`（kebab）——declare 行键 · judge DOC_KEYS/DocKey · invariants · Projector 五投影 · validate 派生 · preflight docKey · words 键 · schema get 值域统一（get/gen 一表两面）· P2 get 字节 pin 随统一更替 · **face/ 全层六前提重塑（Q3→c）**：cli.ts（六命令注册 · parse 通道 · run 分发 · preflight doc 构造 · help 渲染）+ capsule + words + graph-view + host 可重写/目录级重组（OOP 统一 · 零裸函数 · 死码清理 · 高内聚低耦合 · 最大精简 · 消费心智负担）· **help/`--help` 展示面完整重建**：自研渲染器（零依赖保持 · do-not-re-add 守约）· 顶层 `cdd` 命令总览 · 旗标级说明 + 值域 · 子命令树 · 错误路径智能提示 · **usage 行重写（deliberate pin break）** + smoke-cdd 锚更替 · 引擎 vitest colocated pin（overall 经 review face 判压零 finding）+ validate/guard 零回归 · 该 phase 由本 overall 注册 · 设计经 cdd-design 生成 | ✔ Done（`2026-10-10-engine-doc-tooling-p1-design.md` v0.4 · 2026-10-11） | ✔ Done（`2026-10-10-engine-doc-tooling-p1.md` v0.2 · 2026-10-11） | `cdd review --type spec --spec <任一 overall>` 对整体契约判压（零 phase-spec 误报 · 硬编码 phaseSpec 残留零）· 引擎 vitest 全绿（colocated pin：overall 评审轮 doc-contract 绿 · face 重塑后退出码表/CDD_BLOCKED/doc-contract 语义零变化）· `--help`/顶层 `cdd` 完整形面（旗标级说明 · 值域 · 子命令树 · 命令总览）+ usage 六行重写后 cli.test.ts pins + smoke-cdd 锚全更替 · **docKey 词表统一落定**（全库 kebab 单一拼写 · get 值域 `overall/plan/phase-spec` · get/gen 一表两面 · P2 get 字节 pin 语义更新后全测试 pins 更替全绿）· 零运行时依赖变化（help 自研渲染）· `pnpm run validate` ALL PASS · `pnpm run precommit` 过 · changesets（cdd-engine）经 P3 归并落位 · **（2026-10-11 cdd-close 交付证据）** 全项达成：overall 判压零误报 ✓ · 词表统一 pins 全绿 ✓ · face 重塑行为等价（退出码表 / CDD_BLOCKED / doc-contract / next 字面零变化）✓ · help 形面 + usage pins 全更替 ✓ · 零运行时依赖变化 ✓ · 引擎 vitest 452/452 ✓ · validate ALL PASS ✓ · 分支终审 1 warn → 分支 fix 闭环 ✓ | 依赖升级与 src 更名程序 P2 ->(sweep · 拆 pin) |
| P2 | schema gen 模板写作 | 引擎 CLI + render：`schema gen <type>`（phase-spec / overall / plan 三型 · 从 declare.ts 派生骨架：标题树 · 表列头 · `- **Version**: v0.1 · <date>` 脚手架（版本起点 v0.1 裁定 · 2026-10-11）· change-history 首行）· **骨架 = 完整结构**（主体/description 槽位占位符提示 · 编排器 `schema gen <type> > specs/<name>.md` 落盘 · 填后零占位符残留 pin）· 骨架 by construction 过 doc-contract · `schema get` 保留（声明参考面）· 消费面 cdd-spec-writer / cdd-plan author「先 gen 后填」（散文入槽位）· CLAUDE.md「零新子命令」pin 修订 + **去 kairos/引擎流程**（例外面扩 schema gen · 文档先行 · 直接删除不迁不存）· **六前提重构许可（Q2→b：整 CLI 面重写/重组 · 死码/空壳清理 · OOP 统一零裸函数）** · 引擎 vitest colocated pin + validate/guard 零回归 · 该 phase 由本 overall 注册 · 设计经 cdd-design 生成 | ✔ Done（`2026-10-10-engine-doc-tooling-p2-design.md` v0.4 · 2026-10-11） | ✔ Done（`2026-10-10-engine-doc-tooling-p2.md` v0.5 · 2026-10-11） | `cdd schema gen phase-spec|overall|plan` 输出**完整结构骨架**过 gate（结构化 by construction · 占位符残留 pin 零命中）✓ + 填后 doc-contract 终判语义不变 ✓ + cdd-spec-writer / cdd-plan author 节点更新（先 gen 后填）✓ + CLAUDE.md pin 修订落 + 去流程化（kairos/引擎流程叙述零残留 grep pin）✓ + 引擎 vitest 全绿（433/433 · 含 29 新 colocated pins）✓ + `pnpm run validate` ALL PASS ✓ + `pnpm run precommit` 过 ✓ | 依赖升级与 src 更名程序 P2 ->(sweep · 拆 pin) |
| P3 | CLI 框架化收口 + 变更集归并 | 引擎 CLI + face：**commander ^15 重准入**（parse + help 渲染管线——ARGV_CHANNEL 行度入 `.option()/.command()` 数据驱动保单源 · 适配层保行为面：退出码表 0/1/2 · CDD_BLOCKED 通道 · 字节错误消息重映射 · did-you-mean 近邻 · `--help` 任意位置）· **帮助形面**（命令表短描述 · Usage/Options/Examples 段首 · 描述位序）· 维护文档 05 §4 commander 行重准入注记（citty 等其余退役行不动）· **变更集收尾折叠**（P1/P2 deferred + 框架化 bump 主题归并 · breaking/minor 随设计会话定 · 不发布）· 该 phase 由本 overall 注册 · 设计经 cdd-design 生成 | [Pending] | [Pending] | commander ^15 运行时依赖落 cdd-engine `package.json` · 帮助形面三件套落（命令表短描述 · Usage/Options/Examples 段首 · 描述位序）· 行为面回归全绿（退出码表 · CDD_BLOCKED · 字节错误消息 pins · did-you-mean · `--help` 任意位置 · ARGV_CHANNEL 单源零平行列表）· `pnpm exec changeset status` 无 empty 条目 · 引擎 vitest 全绿 · `pnpm run validate` ALL PASS · EOF 全绿 · 不发布 | P1 ->(hard) · P2 ->(satisfied：已 Done · 其 deferred 变更集随本 phase 折叠) |

## Dependency graph (ASCII)

```
P1 -> P3   (hard: P3 commander 框架化须 P1 face 重塑先行 · P1 已近收口)
P2 -> P3   (satisfied: P2 已 Done · 其 deferred 变更集随 P3 折叠归并)
P1 ‖ P2    (并行：review face 与 schema/template 不同面；执行仍串行)
跨程序: P1/P2 ->(rename sweep) 依赖升级与 src 更名程序 P2（sweep 按字面量全局覆盖本程序新文件面 · 非硬依赖 · D8 拆 pin——本程序先行实现于 `src-next/`）
```

Legend:
- `->` = hard block（依赖前置 phase 完成后启动）
- `‖` = 无硬依赖（并行候选；执行串行、一 phase 一 closeout）

执行序：P1 → P2（按注册序串行 · P2 已 Done）→（P1 Done →）P3（CLI 框架化收口 · P1/P2 deferred 变更集随本 phase 折叠归并）→ 程序收敛。

## Boundary rules

- 每 phase 完整 brainstorm → plan → dev 闭环；serial-phase 硬门：注册 phase 的 hard-dependency 前驱 Design spec ≠ Done → BLOCKED
- **跨程序树协调（D8 · 拆 pin 后）**：本程序 P1/P2 引擎改动先行于现行 `src-next/` 树实现（不等 rename P2）——rename sweep 全库 `grep -rn src-next` 改本程序新文件面（Q3→b · 豁免面为空）
- 需求变更在 phase 中发生时，**先回填本 overall**（version bump + change-history 行 + 同步受影响 phase 的 scope/acceptance/dependency），再继续实现
- **模板结构保真**：schema gen 骨架 = declare.ts 派生（标题树/表列/脚手架 by construction），编辑器只填内容不重排——违反 = 保真破坏，视为 defect
- **gate 零例外**：doc-contract 判定语义不变；模板 / 骨架不是 gate 豁免通道

## Maintenance

- 五表随每 phase 回填：Issue inventory（新增 anchor 注册）、Phase inventory（design/plan 列状态 + dep 边）、Dependency graph（节点变化同步）、Change history（版本行逐 phase 追加）、File paths（新 artifact 行登记）
- Charter only——无任务清单；phase 细节归 phase spec；策略转向立即回填本 overall 后再议实现
- 本程序为引擎 doc 工具面；实施期发现相邻缺口（例如 fill 阶段的结构校验、骨架进可写面），同样回填追加

## Change history

| Version | date | summary | author |
|---|---|---|---|
| v1.0 | 2026-10-10 | 程序 charter：引擎 doc-tooling 能力面——P1 review face overall 键（consumer 整体契约门禁 · 自「依赖升级与 src 更名」程序 P4 拆出，2026-10-10 用户裁定同属能力类）· P2 schema gen 模板写作（生成式骨架 · 先 gen 后填 · CLAUDE.md「零新子命令」pin 连带修订）· P3 changesets 收尾（cdd-engine 两能力 bump · 不发布）· 硬依赖依赖升级与 src 更名程序 P2 改名树 · 决策 D1–D4 | [human] · Claude Opus 5（依赖升级与 src 更名程序 v1.3 拆出裁定 · 2026-10-10） |
| v1.1 | 2026-10-11 | **P2 grilling 定案（kairos:cdd-design [P2] 会话）**：Q1→a schema gen 输出 **stdout 纯渲染** · 骨架完整结构 + 占位符提示 · 编排器 `schema gen <type> > specs/<name>.md` 落盘 · 版本脚手架起点 v0.1 · Q2→b **六前提重构许可**扩至整 CLI 面/目录级（Non-goal ④ 改写 · 保行为等价）· Q3→c **CLAUDE.md 去 kairos/引擎流程直接删除**（消费面引导改由 skills 承担）· P2 scope/acceptance 增占位符残留 pin + 去流程化 grep pin | Oscar M. · Claude Opus 5（kairos:cdd-design grilling · 用户裁定） |
| v1.2 | 2026-10-11 | **P2 拆 pin 回填（用户裁定 ② · 2026-10-11）**：跨程序树依赖 hard pin → **sweep 面关系**（D8）——本程序 P1/P2 引擎改动**先行于现行 `src-next/` 树实现**（不等 rename P2）· rename sweep 全库 grep 随后覆盖本程序新文件面（Q3→b · 豁免面为空）· Constraints/Dependency graph/Boundary/Phase inventory P1/P2 Dependency 列同步（hard → sweep）· 决策 D8 | Oscar M. · Claude Opus 5（P2 cdd-dev 进入前复核 · 用户拆 pin 裁定） |
| v1.3 | 2026-10-11 | **P2 closeout（cdd-close）**：P2 全链闭合——设计 v0.4 · 计划 v0.5 · 引擎面+消费面两提交面落地（schema gen 能力 + author-* 先 gen 后填 + CLAUDE.md 去流程化）· 三轮评审链全部 blocker 0 关闭（spec-review → plan-review → wave 1/2 → branch-review）· Acceptance 全项证据在册（三型骨架判压零 finding · get 字节不变 · 占位零残留 · SKILL.md 三词条零命中 · CLAUDE.md 四块零残留 · 引擎 vitest 433/433 · validate ALL PASS）· Phase inventory P2 → **Done** · 执行序：P1（review-face 键 · 仍 [Pending]）→ P3（changesets 收尾 · 硬依赖 P1 ∧ P2——P2 已定案 · 待 P1） | [human] · Claude Opus 5（kairos:cdd-close · closeout-backfill） |
| v1.4 | 2026-10-11 | **P1 grilling 定案（cdd-design [P1] 会话 · Q1–Q6 全答 · 用户裁定）**：P1 扩面——① docKey 推导共享化（契约层导出类成员 · validate 改调 · spec 树同源 · plans 分支组合）② **face/ 全层六前提重塑**（Q3→c · Q6→b：cli.ts + capsule + words + graph-view + host 可重写/目录级重组）③ **help/`--help` 展示面完整重建**（Q4→a 自研渲染零依赖保持 · Q3→a 完整形面：命令总览 · 旗标级说明 · 子命令树 · 错误路径提示）④ **usage 六行重写**（Q5→b deliberate pin break · 测试锚同步）· Non-goal ④ 增注 P1 同持整 CLI/face 面许可 · Cross-cutting 立「face 重塑保行为等价」· 决策 D9 · P1 scope/acceptance 同步扩面 · 执行序不变：P1 → P3（仍 [Pending]） | [human] · Claude Opus 5（kairos:cdd-design grilling · 用户裁定） |
| v1.5 | 2026-10-11 | **P1 docKey 词表统一裁定（用户 backfill → P1 随 cli 面统一处理 · 2026-10-11）**：docKey/类型词表统一为**单一拼写 `phase-spec`（kebab）**——治 D3 大小写坑本源（两键系统合一）· 统一面 = declare 行键 · judge DOC_KEYS/DocKey · invariants · Projector 五投影 · validate 派生 · preflight docKey · words 键 · schema get 值域（get/gen 一表两面）· **P2「schema get 字节不变」断言语义随统一更新**（deliberate pin break · 与 usage Q5→b 同级）· 决策 D10 · P1 scope/acceptance 增词表统一面 · 词表统一因 P1 本就要重塑 cli 面而并入 P1（非独立议题） | [human] · Claude Opus 5（用户裁定 backfill · 2026-10-11） |
| v1.6 | 2026-10-11 | **P1 help 框架化裁定（用户研究后决定 · 2026-10-11）**：联网调研（commander 15 依赖 0 · yargs 18 依赖 6 · clipanion RC · citty 版本未动）→ 用户定夺 **commander ^15 · P1 收口后落地**——反转 D9 的 help 自研渲染面与维护文档 05 §4 commander 行 do-not-re-add（commander 重准入 · 其余退役行不动）· P1 自身按生效决定干净收口（不重开已批准 Task 4 交付）· 决策 D11 · 新阶段经 cdd-close closeout-backfill 四表登记 | [human] · Claude Opus 5（用户裁定 · 2026-10-11） |
| v1.7 | 2026-10-11 | **P3 槽位改写裁定（用户 · 2026-10-11）**：框架化**不新增 phase——P3 直接改写为「CLI 框架化收口 + 变更集归并」**：commander ^15 重准入（parse + help 渲染 · ARGV_CHANNEL 行度入 .option()/.command() 数据驱动单源 · 适配层保行为面：退出码表/CDD_BLOCKED/字节错误消息/did-you-mean/`--help` 任意位置 · 帮助形面三件套：命令表短描述 · Usage/Options/Examples 段首 · 描述位序）· 原「changesets 收尾」独立 scope **折叠**入 P3 变更集义务（P1/P2 deferred + 框架化 bump 一次归并 · 不发布）· 同步：Issue/Phase inventory P3 行 · Dependency graph（P1 hard · P2 satisfied）· 执行序 · charter①③段 · D11 落点更新（最终路由 = P3） | [human] · Claude Opus 5（用户裁定 · 2026-10-11） |
| v1.8 | 2026-10-11 | **章程一致性修正（引擎 fix 轮 · spec 评审 findings #1 · 编排器裁定接受 full fix · 2026-10-11）**：Non-goal ④「零运行时依赖变化」与 Cross-cutting「维护文档 do-not-re-add 守约」两条章程级断言**增补 P3 carve-out**——定位 **P1/P2 面** · P3 例外 = CLI 框架化 commander ^15 重准入（D11 同源 · commander 行重准入注记 · citty 等其余退役行不动）· 消除 v1.7 起与 P3 scope/acceptance（commander ^15 运行时依赖落 cdd-engine `package.json`）的直接矛盾 · 未改任何 phase scope/acceptance 正文 | [human] · Claude Opus 5（引擎 fix 轮 · 2026-10-11） |
| v1.9 | 2026-10-11 | **P1 closeout（cdd-close）**：P1 全链闭合——设计 v0.4（Approved）· 计划 v0.2 · 五波次实现链（T1–T5 implement→review→fix 各 APPROVED）+ 分支终审（506a5ecd..HEAD）闭环（1 warn → 分支 fix：leaf 粒度 did-you-mean 候选收窄 · surface 携带 · sibling leaf keys 不再并入）· Acceptance 全项交付证据在册（overall 判压零误报 · 词表 kebab 单一拼写 · face 重塑行为等价 · help 形面 + usage pins 全更替 · 零运行时依赖变化 · 引擎 vitest 452/452 · validate ALL PASS）· Phase inventory P1 → **Done** · 执行序：P3（CLI 框架化收口 · 硬依赖 P1 已满足）→ 程序收敛 | [human] · Claude Opus 5（kairos:cdd-close · closeout-backfill） |
