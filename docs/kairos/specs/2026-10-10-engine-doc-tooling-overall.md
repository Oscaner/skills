# 引擎文档工具（Engine Doc-Tooling）— Overall Spec

- **Version**: v1.1 · 2026-10-11
- **Status**: Draft
- **Author**: [human] · Claude Opus 5 (1M context)（kairos:cdd-design 元层裁定 → 独立整体注册）
- **Constraints**:
  - **从「依赖升级与 src 更名」程序拆出（2026-10-10 用户拍板「这个问题和 P4 其实是同一类的吧？那把 P4 拆出来和这个问题一起放独立 overall 里」）**：本程序承接该程序原 **P4（review-face overall 键）** + 用户 2026-10-10 提出的**写文档方案重设计（schema gen 模板写作）**——同属**引擎 doc-tooling 能力面**（裁判侧缺口：引擎判不了 overall · 写侧缺口：引擎不给写作结构）
  - **跨程序硬依赖**：引擎树改名（依赖升级与 src 更名程序 P2）落定前不动引擎——本程序 P1/P2 硬依赖 `2026-10-10-upgrade-dependencies-and-src-rename-overall.md` 的 P2（改名后形态）；本程序期引用沿用现行 `src-next/` 路径面，P2 改名 sweep 覆盖本文件字面量（Q3→b 历史面全改语义）
  - **CLAUDE.md「cdd CLI 零新子命令」pin 连带修订（2026-10-10 用户拍板授权）**：现行唯一例外 = `schema get` + `issue render`；`schema gen` 属新能力面，pin 修订为本程序 P2 范围内落地（文档先行 · 实现随之，不可只实现不改文）
  - **P2 grilling 定案（2026-10-11 · cdd-design [P2] · Q1/Q2/Q3 裁定）**：① **schema gen 输出 = stdout 纯渲染**，骨架落盘由编排器承担（`cdd schema gen phase-spec > specs/<name>.md`）；生成的骨架 = **完整结构**（标题树 · 表列头 · 版本/change-history 脚手架全须齐备），主体内容/description 槽位以**占位符提示**标出（填后零残留 pin）。② **CLAUDE.md 去 kairos/引擎流程（Q3→c · 直接删除，不迁不存）**——本仓库工作树逼近消费者环境，以验证消费者视角使用引擎的真实体验；消费面引导由 skills 承担（R4「先 gen 后填」）。③ **重构许可扩至整引擎 CLI 面（Q2→b · 六前提）**——schema gen 落地可重写代码、重组目录（OOP 统一 · 零裸函数 · 死码/空壳清理 · 高内聚低耦合 · 消费者心智负担 · 最大精简）；许可不止 schema/template 面，涉整个 face/cli.ts 与目录级重组，Non-goal ④ 随之改写（跨程序树 pin 与 gate 零例外不变）
  - **不发布**：changesets 收尾到可发布态即止；版本应用 / tag / publish = 独立动作
  - **语言纪律保持**（Strategy B 内部 docs 中文 · 消费面 skill 文本英文主源）
  - 变更先回填本 overall（backfill-as-version），再继续实现

## Document scope

Charter only, zero implementation detail. **Overall approval is not equivalent to any phase started（GATE）**——三个 phase 按注册序串行执行；P1 ‖ P2 无硬依赖（review face 与 schema/template 不同面），P3 硬依赖 P1 ∧ P2（changesets 归并须含两能力最终 bump 描述）；变更先回填本 overall，再继续实现。全部引擎改动落依赖升级与 src 更名程序 **P2 改名后的树**（跨程序 pin）。

## File paths

| Artifact | Path |
|---|---|
| Overall | `specs/2026-10-10-engine-doc-tooling-overall.md` |
| Phase spec | `specs/2026-10-10-engine-doc-tooling-p<N>-design.md` |
| Phase plan | `plans/2026-10-10-engine-doc-tooling-p<N>.md` |

## Program charter

### Goal

把引擎 doc 面两个能力缺口一次收口：**① 消费者整体契约门禁（review-face overall 键）**——engine `face/cli.ts` 的 doc-contract docKey 推导从硬编码 `phaseSpec` 放开为与 validate 同源的推导（`*-overall.md → overall` · 其他 → phaseSpec），consumer 首次可对整体契约跑 `cdd review/fix --type spec --spec <overall>`（零 phase-spec 误报）· kairos cdd-spec-writer 的 overall 变体评审字面可满足（无需 skill 例外）；**② 写文档方案重设计（schema gen 模板写作）**——引擎备几套文档模板：`schema gen <phase-spec|overall|plan>` 从声明面派生**骨架**（标题树 · 表列头 · `- **Version**: v1.0 · <date>` + change-history 首行脚手架——结构 by construction 保真），编排器（cdd-spec-writer/cdd-plan author 节点）**先 gen 后填**——`###`/`##` 类转写失误整类死亡，doc-contract 判定语义不变仍为兜底终判；**③ changesets 收尾**——两能力 bump（cdd-engine）主题归并至可发布态，不发布。

### Non-goals
- **不发布**：整理到可发布态即止——`changeset version` / 打 tag / 发布 = 独立动作，不在本程序
- **不改文档方法论语义**：schema gen 骨架 = declare.ts 登记表投影，不引入新文档结构；文档类型语义（overall / plan / phase-spec）、契约、gate 判压全部不变
- **不新增大文档结构 / 新 doc 类型**：模板覆盖既有三型（phase-spec / overall / plan），不发明第四型
- **引擎行为变化 = 能力面 + 六前提重构（2026-10-11 Q2→b 改写）**：行为语义增量 = review face docKey 推导（P1）+ schema gen 能力（P2）；P2 落地持**整 CLI 面重构许可**（face/cli.ts · 目录级重组 · OOP 统一零裸函数 · 死码/空壳清理），重构保行为等价（引擎 vitest 全绿作证）· 零运行时依赖变化 · 零意外行为变化（其余 CLI 行为语义不动，仅形态可重组）
- **不 retro-改消费者已发面**：历史 SKILL.md / 文档不作回溯改写（消费面变更只发生在 author 节点表述）

### Cross-cutting（程序级横切约束，先立后执行）
- **模板结构保真由构造保证**：骨架 = declare.ts 登记表派生（标题树 · 表列头 · 版本/change-history 脚手架——`###`/`##` 层级无转写席位）；编辑器在槽位填内容不重排结构
- **gate 零例外底线**：doc-contract 判定语义不变——骨架生成不是 gate 豁免通道（骨架 by construction 绿 · 填后 gate 仍终判兜底）
- **消费面先 gen 后填**：cdd-spec-writer / cdd-plan 的 author 节点从「schema get 参考 + 手工转写」更新为「schema gen 骨架 + 填内容」；`schema get` 保留（声明参考面 · 其他工具/测试消费面不动）
- **CLAUDE.md pin 修订先行**：「cdd CLI 零新子命令」例外面扩 `schema gen`——文档改动与实现同 commit 面落地，不可只实现不改文
- **跨程序树 pin**：引擎改动仅落依赖升级与 src 更名程序 P2 改名后的树（P2 pin 未过不启动）

### 设计决策留存（2026-10-10 —— 元层裁定 + 注册）

| # | 决策 | 定案 | 落点 |
|---|---|---|---|
| D1 | 程序来源（2026-10-10 用户拍板） | 原「依赖升级与 src 更名」程序 P4（review-face overall 键）拆出 + 写文档方案重设计（schema gen）——**同属引擎 doc-tooling 能力面**，并独立整体（本程序） | 本表 + Constraints + Change history v1.0 |
| D2 | 模板方向（2026-10-10 用户拍板「不是提供 schema get，而是 schema gen(generate)——让编排器先生成模板，然后在模板上填充内容」） | **schema gen <type> 生成式骨架**：声明面派生 · 结构 by construction 保真 · 编排器先 gen 后填；`schema get` 保留（声明参考面） | P2 scope |
| D3 | 模板覆盖（提出 · 设计会话细化） | **三型一次候选**：phase-spec / overall / plan——同源于 declare.ts，增量只是声明行；overall 正是 2026-10-10 误报面（typeName 大小写坑同型） | P2 scope |
| D4 | 本程序边界（2026-10-10 拆出裁定连带） | 3 phase：P1=review 键 · P2=模板写作 · P3=changesets 收尾 · 硬依赖依赖升级与 src 更名程序 P2（改名树）· 引擎其他行为面零动 | Phase inventory |
| D5 | schema gen 输出合约（2026-10-11 grilling Q1→a） | **stdout 纯渲染 + 编排器落盘**：`cdd schema gen <type> > specs/<name>.md`；骨架 = **完整结构**（标题树 · 表列头 · 版本/change-history 脚手架全须齐备），主体内容/description 槽位带**占位符提示**；填后零占位符残留 pin | P2 scope + Constraints |
| D6 | 重构许可边界（2026-10-11 grilling Q2→b） | **六前提全面开放**：P2 落地可重写/重组整个 face/cli.ts 与目录级（OOP 统一 · 零裸函数 · 死码/空壳清理 · 高内聚低耦合 · 消费者心智负担 · 最大精简）；重构保行为等价（vitest 全绿作证）；Non-goal ④ 随之改写；跨程序树 pin + gate 零例外不变 | P2 scope + Constraints + Non-goal ④ |
| D7 | CLAUDE.md 去流程化处置（2026-10-11 grilling Q3→c） | **直接删除 kairos/引擎流程叙述**（不迁 maintainers · 不迁 README）——工作树逼近消费者环境以验证消费者视角使用引擎的真实体验；消费面引导改由 skills 承担（R4「先 gen 后填」） | P2 scope + Constraints |

## Issue inventory

| Phase | Issue (ref) | Title summary |
|---|---|---|
| P1 | none | 引擎 review face overall 键：consumer 整体契约门禁——`cli.ts` 硬编码 phaseSpec 的 docKey 推导对齐 validate（`*-overall.md → overall`），`cdd review/fix --type spec --spec <overall>` 判整体契约 · cdd-spec-writer overall 变体评审轮可满足 · 引擎 vitest colocated pin |
| P2 | none | 写文档方案重设计：schema gen 模板写作——CLI `schema gen <phase-spec/overall/plan>` 从 declare.ts 派生骨架（标题树/表列/版本脚手架）· 消费面 cdd-spec-writer/cdd-plan author「先 gen 后填」· CLAUDE.md「零新子命令」pin 连带修订 |
| P3 | none | changesets 收尾 + 发布预备：两能力 bump（cdd-engine）主题归并至可发布态 · 不发布 |

## Phase inventory

| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |
|---|---|---|---|---|---|---|
| P1 | 引擎 review face overall 键 | 引擎 CLI：`face/cli.ts` 的 doc-contract docKey 推导从硬编码 `phaseSpec` 放开为与 validate 同源的推导（`*-overall.md → overall` · 其他 → phaseSpec）· consumer 首次可对整体契约跑 `cdd review/fix --type spec --spec <overall>`（零 phase-spec 误报）· kairos cdd-spec-writer 的 overall 变体评审字面可满足（无需 skill 例外）· 引擎 vitest colocated pin（overall 经 review face 判压零 finding）+ validate/guard 零回归 · 该 phase 由本 overall 注册 · 设计经 cdd-design 生成 | [Pending] | [Pending] | `cdd review --type spec --spec <任一 overall>` 对整体契约判压（零 phase-spec 误报 · 硬编码 phaseSpec 残留零）· 引擎 vitest 全绿（colocated pin：overall 评审轮 doc-contract 绿）· `pnpm run validate` ALL PASS · `pnpm run precommit` 过 · changesets（cdd-engine）经 P3 归并落位 | 依赖升级与 src 更名程序 P2 ->(hard) |
| P2 | schema gen 模板写作 | 引擎 CLI + render：`schema gen <type>`（phase-spec / overall / plan 三型 · 从 declare.ts 派生骨架：标题树 · 表列头 · `- **Version**: v0.1 · <date>` 脚手架（版本起点 v0.1 裁定 · 2026-10-11）· change-history 首行）· **骨架 = 完整结构**（主体/description 槽位占位符提示 · 编排器 `schema gen <type> > specs/<name>.md` 落盘 · 填后零占位符残留 pin）· 骨架 by construction 过 doc-contract · `schema get` 保留（声明参考面）· 消费面 cdd-spec-writer / cdd-plan author「先 gen 后填」（散文入槽位）· CLAUDE.md「零新子命令」pin 修订 + **去 kairos/引擎流程**（例外面扩 schema gen · 文档先行 · 直接删除不迁不存）· **六前提重构许可（Q2→b：整 CLI 面重写/重组 · 死码/空壳清理 · OOP 统一零裸函数）** · 引擎 vitest colocated pin + validate/guard 零回归 · 该 phase 由本 overall 注册 · 设计经 cdd-design 生成 | [Pending] | [Pending] | `cdd schema gen phase-spec|overall|plan` 输出**完整结构骨架**过 gate（结构化 by construction · 占位符残留 pin 零命中）· 填后 doc-contract 终判语义不变 · cdd-spec-writer / cdd-plan author 节点更新（先 gen 后填）· CLAUDE.md pin 修订落 + 去流程化（kairos/引擎流程叙述零残留 grep pin）· 引擎 vitest 全绿 · `pnpm run validate` ALL PASS · `pnpm run precommit` 过 | 依赖升级与 src 更名程序 P2 ->(hard) |
| P3 | changesets 收尾 + 发布预备 | 两能力 bump（cdd-engine：review-face 键 · schema gen/template）主题归并至可发布态（breaking/minor 语境随设计会话定）· EOF 全绿 · **不发布** · 该 phase 由本 overall 注册 · 设计经 cdd-design 生成 | [Pending] | [Pending] | `pnpm exec changeset status` 无 empty 条目 · 归并清单对照（40→19 先例同型）· EOF 全绿 · `pnpm run validate` ALL PASS | P1 ->(hard) · P2 ->(hard) |

## Dependency graph (ASCII)

```
P1 -> P3   (hard: P3 归并须含 review-face 键 bump 描述，须 P1 定案)
P2 -> P3   (hard: P3 归并须含 schema gen/template bump 描述，须 P2 定案)
P1 ‖ P2    (并行：review face 与 schema/template 不同面；执行仍串行)
跨程序: P1/P2 ->(hard) 依赖升级与 src 更名程序 P2（引擎树改名后形态——P2 pin 未过不启动）
```

Legend:
- `->` = hard block（依赖前置 phase 完成后启动）
- `‖` = 无硬依赖（并行候选；执行串行、一 phase 一 closeout）

执行序：P1 → P2（按注册序串行）→（P1 ∧ P2 均 Done 且依赖满足）→ P3 → 程序收敛。

## Boundary rules

- 每 phase 完整 brainstorm → plan → dev 闭环；serial-phase 硬门：注册 phase 的 hard-dependency 前驱 Design spec ≠ Done → BLOCKED
- **跨程序树 pin**：依赖升级与 src 更名程序 P2（改名）未过 pin 前，本程序任何引擎改动不启动
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
