# osuperpowers 架构重构 — Overall Spec

- **Version**: v1.15 · 2026-09-16
- **Status**: Draft
- **Author**: [human] · Claude Opus 5 (1M context) (osuperpowers:brainstorming)
- **Constraints**:
  - 仓库语言政策：SKILL.md / docs 英文主源；本 spec 中文（Strategy B internal docs）
  - 不 commit 除非用户明确要求；changeset 逐 phase 建
  - vendored 子模块不可改
  - **破坏性重构已授权**（2026-09-13 用户显式：允许破坏性变更、确保最佳实践、不留技术债务、遗留即删）
  - 所有改动须通过 `pnpm run validate`（13 块）且 `pnpm run emit:check` 无 drift

---

## Document scope

Charter only — no implementation detail。
- **Overall approval is not equivalent to any phase started**（GATE）。
- Deviations update here first, then sync affected phase specs / acceptance criteria（对 overall 自身即本文件——见 Boundary rules，无二次「sync to overall」）。

---

## File paths

新布局**前瞻执行**：本 overall 即 `docs/osuperpowers/` 根下第一个文档（req 2 落点）；`docs/superpowers/` 下 39 个历史 spec/plan 由 P2 git-mv 迁入，验证器届时收敛单 glob。

| Artifact | Path |
|---|---|
| Overall | `docs/osuperpowers/specs/2026-09-13-osuperpowers-overhaul-overall.md` |
| Phase spec | `docs/osuperpowers/specs/2026-09-13-osuperpowers-overhaul-<phase-id>-design.md` |
| Phase plan | `docs/osuperpowers/plans/2026-09-13-osuperpowers-overhaul-<phase-id>.md` |

`<phase-id>` 小写（`p1`…`p6`）。Inventory 列在文件落盘后链入。

---

## Program charter

将 osuperpowers 插件 + cdd-engine 从「多根命名、读上游基线的大体积 SKILL、冗余命令面」收敛为「**单根 artifact 布局（`.osuperpowers/` 运行时 + `docs/osuperpowers/` 文档）、命令面精简（implement/review/fix/base-branch）、session-call 简洁 skill 树（不读上游、纯 `/xxx` 调用、保留节点锚定骨架）**」的收敛程序。九项需求（req 1–9，含用户初始 skills 箭头流程）全部源自用户 2026-09-13 的 new-program 脑暴；skills 的目标架构（含 `writing-single-spec` / `writing-overall-spec` / `writing-phase-spec` 新 skill 与 report-issues 改名）定案于本 program charter，P4/P5 按其执行。

**cdd-engine 服务化主线（2026-09-13 用户升维）**：本程序**包括 cdd-engine 的重构**——engine 不是被路径/命令清理的被动对象，而是重构为**服务整个体系的底层服务层**：workspace 布局（单根 `.osuperpowers/cdd/<slug>` + standalone 并入）→ 命令面（implement/review/fix/base-branch 四命令收敛）→ host harness 检测自包含 → 渲染/模板数据化 → artifact 写权全归 engine。skills 全面变薄后，engine 是唯一 artifact 写者 + 唯一 harness 解析者 + 唯一命令持有者——「engine 服务，skills 编排」是本次重构的边界原则。

**Non-goals**：
- 不修改 vendored 子模块（superpowers / mattpocock-skills / impeccable）
- **不改变引擎评审语义本体**：review/fix/handoff 生命周期、Stopping 判定、commit-contract、doc_hash 双签名等判定逻辑不动——本程序仅收敛路径 / 命名 / 命令面 / 编排 skill 层
- 不引入新增 **引擎/lifecycle** 流程节点——cdd 引擎生命周期（implement/review/fix 循环、Stopping、commit-contract）不变；skill 树允许新增 session-call **编排壳**（writing-single-spec / writing-overall-spec / writing-phase-spec 属编排壳，非新流程节点；brainstorming / writing-plans / cli-driven-development 结构不变，仅 skill 形态重写）
- 不承载 #246 之后的消费方新 report（另行走 report-issue 通道；本程序不含 GH issue 创建）

**Cross-cutting constraints**：
- **节点锚定式规则保留**：简洁模式 ≠ 无结构——所有 SKILL.md 仍须 digraph + 节点定义 + exit/fail 语义（skill-authoring 已确立的骨架不变），只是 Content 改为 session-call 命令链
- **skills 内容全重写**：不再读上游 skill 文档；完全依赖 `Run a /xxx session` 调用（grill-me 范本：frontmatter + 命令链）；删除旧规则机械（read-upstream 基线、Invariants 冗余表、failure-mode 长表、`_docs/review.md` URC）
- **artifacts 单落点**：`.osuperpowers/cdd/<slug>/`（standalone 并入，不同 feature 独立 base-branch）；文档单根 `docs/osuperpowers/{specs,plans}`
- **host harness 自检自包含**：全部在 cdd-engine 内（`requireHostHarness` + harness-registry.json）；skills 不承载 harness 特判 prose
- **改动前置**：见 Boundary rules——mid-phase 需求变更先回填本 overall 再继续

---

## Requirement inventory

本程序「issue 域」= 用户初始脑暴的九项需求 + 2026-09-13 补充拍板：

| Phase | Requirement (ref) | Title summary |
|---|---|---|
| P1 | req 1（用户 2026-09-13） | cdd handoff JSON 产出根收敛为 `.osuperpowers/cdd/<slug>`（`.superpowers/cdd` 迁移） |
| P1 | 补充拍板（2026-09-13 P1 brainstorm 升格） | `.superpowers/standalone/` **零真实派发**（伪功能，无任何消费实体）→ standalone 概念**整体移除**（非「并入 `cdd/<slug>`」）：STANDALONE_ROOT / `--scope` / `--slug` 全删，base-branch CLI 单调 `--plan`，finishing 无 artifact 场景推断后不落盘 |
| P1 | 补充指令（2026-09-13） | `.superpowers/{docs-review, archive-*}` 等 legacy 残留移除（迁移前提=真实需要，遗留即删） |
| P2 | req 2 | specs/plans 产出到 `[repo]/docs/osuperpowers/[specs\|plans]`（`docs/superpowers/` 迁移；39 历史文件 git-mv 已拍板） |
| P3 | req 4 | `cdd brief` 不单独构建，自包含到 `cdd implement` 内（独立命令删除，lib/brief.mjs 保留供 run-task） |
| P3 | req 6 | 清理 `cdd research` 独立命令（skill 删除归 P3——见 req 6 续行） |
| P3 | req 7 | 清理冗余 cdd 命令；base-branch CLI `--scope standalone` 已归 P1（standalone 整体移除） |
| P6 | 决策 C（2026-09-13 拍板） | harness 宣称全面收缩——未经证实可用的 harness（droid / pi / grok / qoder / codex / gemini）不出现在任何宣称面：README.md / README.zh-CN.md / CLAUDE.md 的「works across 8 harness」表述、package.json `oscaner-plugin.claude.keywords` 的 `droid` / `pi` + **`package.json#pi` 死 manifest 字段**（pi.skills 零脚本消费 / registry 无 pi 条目 / 无 manifest 产出）、manifests.mjs 注释残留；**emit 与 harness-registry 精简审计**——emit 的 **harness manifest 产出**仅 `.claude-plugin` + `.cursor-plugin` 两真实支撑面（marketplace / `.github/ISSUE_TEMPLATE` 为非 harness manifest 产物，仍正常产出，不删），registry 仅 claude/cursor-agent 两实扛条；完整产出集见 Phase inventory P6 行 |
| P4 | req 8 | 所有 skills 采用节点锚定式；内容全重写为 session-call 简洁模式 |
| P4 | req 3 | skills 用到的 templates 与 skills 就近（overall/phase-spec-template 随新 skill 树迁移） |
| P4 | req 5 | host harness 判断自包含在 cdd-engine；skills 不特别说明 |
| P3 | req 6（续，skill 侧） | cli-research **skill** 删除（随 P3 命令面收敛一并执行——删除命令必须同步其唯一调用方） |
| P4 | req 7（skills 侧，续 P3） | 清理冗余 skills：init 删除（2026-09-13 拍板）；`_docs/review.md` URC 折叠入各 skill |
| P4 | 用户 2026-09-14 补充（**与 P2 scope 无关**） | **cdd 运行根约定**：cdd-engine 内多数路径相对 `[repo-root]`；AI 误 `cd` 入 `[repo]` 子目录 → spec/plan/docs 等找不到（多项目使用 oscaner-skills 的踩坑点）。修复形态定案（2026-09-15）：**engine 侧单根权威**——`lib/root.mjs` 为 engine `bin`+`lib` 内唯一 `process.cwd()`，内容路径统一**仓根相对**（`resolveDocArg`，无 cwd 回落），删 `rootFromDocPath`（形状推断），运行时状态同源，BLOCKED 诊断含**仓根相对指导**；**skill 侧零 cwd prose**（"engine 服务，skills 编排"） |
| P5 | 用户初始流程 | `report-issue` 改名 `report-issues` + findings 聚合流程精炼（gh dedup / 单新 issue / privacy 剥离 / friendly 标题） |
| P6 | req 9 | 目录结构 / 代码结构 / 文件命名统一规划收口 |
| P4 | 用户 2026-09-15 补充（**本版上移归 P4**；2026-09-16 用户 **scope 扩为 templates 全面收敛**） | **templates 结构与命名单源（one truth）**：① **JSON 结构面**——面向 AI 的 JSON 结构须**由 JSON Schema 原样注入**（`JSON.stringify(schema)`），**既不得手写「简洁版」、也不得手写「忠实版」渲染器**（实测 `renderHandoffStub` 原为 `schema.required` + 硬编码 switch 的简洁版；T5 一度改为「全形派生」——实为 schema 的**手写解释器**，含越权的第二校验器 `satisfiesProp` 与形状受限的 `patternSample`——已定案**整体删除**；AI 依任何「简洁版」产出与 schema 不一致即被 `validateHandoffSchema` 丢弃，多项目使用者踩坑点）**；② **文档结构面**——4 个提示词模板（`task/{implement,fix}.md` · `review/{review,doc-fix}.md`）收敛为**同一文档骨架**（段名与段序统一：`# Title` / `## Instructions`（唯一功能差异段）/ `## Handoff`（共享壳）/ `## Return`（共享壳）；实证现状：同一概念三种段名、段序两套、Return 段名两种且一处缺失、self-validate 仅一处有）**；③ **命名面**——schema 前缀统一为**作用域名**（`cdd-handoff-schema.json` → `task-handoff-schema.json`，与 `docs-handoff-schema.json` 同法）、模板目录分组与命名对齐（`doc-fix.md` 现错位于 `review/`）**；④ **描述面**——两份 schema **补 `description`**（现为零：cdd 0/13、docs 0/8 properties，顶层亦无），把写协议规则（如「engine 从 findings 派生 status」）从模板散文**迁入 schema**，随注入同行 → 消除文档内多地维护的 Handoff Rules |
| P4 | 用户 2026-09-15 补充 | **信道收口 + `cdd context`**：engine 输入面收敛为**三个信道**（argv 调用级 / git 事实级 / env 策略级），`cdd context` 为 per-call **内存**对象（**零落盘**——任何持久化的运行时上下文在多项目并发 / 前后不同任务下必成第二真相源并跨调用污染）；声明落 `cdd-engine/templates/context-contract.json`。修复对象：`process.cwd()` 7 处直读 / 4 套 root 权威 / `rootFromDocPath` 形状推断 / 9 项派生值借道 env / `PLAN_FILE` 经 env 转运 / `CDD_LIFECYCLE_PATH` 测试缝 |
| P4 | **#250 · #260**（13 finding，engine 侧） | **handoff 输出契约单源与失败类目**：提示词注入结构由 JSON Schema 派生（非手写简洁版）；engine 写侧经同一 schema 构造；**校验失败保留 findings** 且报错含违规键名；失败由压平的 `BLOCKED` 重建为六类（`TIMEOUT` / `CONTRACT_VIOLATION` / `ENGINE_SELF_WRITTEN` / `EXECUTION_FAILURE` / `UNVERIFIABLE` / `PLAN_CONFLICT`）且**配额隔离**（仅 `EXECUTION_FAILURE` 消耗 recovery 额度）；超时判定**引擎自持**（#260[4]：143 落入 BLOCKED、`timeoutCount` 不增）；默认 timeout task 90 / review 60 分钟；handoff 序列化全转义；`progress.json#plan` 透传（#260[2]） |
| P5 | **#250 · #260**（13 finding，report-issue 侧） | report-issues 侧 6 条随改名与流程精炼一并处置：subject 泄漏消费者项目名 · analyze scope 漂移 · stdin JSON 手拼易 malformed · labels `session` 不存在 · dedup 重复全量拉取 · labels SOT 漂移 |

---

## Phase inventory

| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |
|---|---|---|---|---|---|---|
| P1 | **cdd-engine 服务化重构① · runtime 布局**：workspace 根 `.superpowers/cdd` → `.osuperpowers/cdd`（handoff-namespace.json#workspaceRoot / lifecycle / progress / registry 路径随迁）；**standalone 整体移除**（零真实派发伪功能——`.superpowers/standalone/` 从未创建、13 个历史 base-branch.json 全在 `cdd/` 下）：STANDALONE_ROOT / `--scope` / `--slug` 全删、base-branch CLI 单调 `--plan`、finishing read-base 无 artifact 推断后不落盘；`.superpowers/{docs-review, archive-*}` 残留清除；**存量 `.superpowers/cdd/*` 工作区全量删除**（18 历史程序 + lifecycle.json + smoke + archive + docs-review——gitignored 死档无 reader，破坏性重构授权下遗留即删；本程序自身 spec-review-1/2 落在旧根已消费完毕，P1 后后续 phase review/fix 在新根重开 round——doc_hash 双签名使 Stopping 语义不因分根断裂）；gitignore（保留 `.superpowers` 含 sdd + 增 `.osuperpowers`）/ residue guard（stale-lexicon 防 `.superpowers/cdd`/`standalone` 回渗，`.superpowers/sdd` 放行）/ smoke-cdd / engine tests / skills docs 路径 / report-issue 读取路径同步（`.superpowers/sdd` 保留——superpowers 所属，不在本程序迁移域） | P1-design v1.0（2026-09-13） | Done | 引擎运行期零 `.superpowers` 写入（superpowers 的 sdd 保留面除外，resolveWorkspace 全走新根）；`.superpowers/` 下**仅存 `sdd/`**（cdd 全 workspace / lifecycle / smoke / archive / docs-review 已删，git status 干净）；`cdd base-branch set/get` 仅 `--plan` 目标（`--scope`/`--slug` 标识不存在）；finishing read-base 无 artifact → 推断 base 传给 present-menu 不落盘；新增 `.superpowers/cdd` / `.superpowers/standalone` stale-lexicon 守卫机制位置零命中（`.superpowers/sdd` 引用放行）；根 `.gitignore` 同时含 `.superpowers` + `.osuperpowers`；`pnpm run validate` 13 块全绿 | 无（program 起点） |
| P2 | specs/plans 落点迁移：`docs/superpowers/{specs,plans}` 39 个历史文件 git-mv → `docs/osuperpowers/{specs,plans}`；`naming.mjs rootFromDocPath` 识别新布局；`overall-consistency` validator glob + fixtures 迁移；residue 豁免路径；skills / templates 内 path 文本、README / CLAUDE.md / maintainer docs 同步；空 `docs/superpowers` 清理 | P2-design v1.0（2026-09-14） | Done | 单一 spec/plan 根 `docs/osuperpowers/` 且 validator 单 glob；历史 39 + 在途程序经迁移后验证全绿不误报；零 `docs/superpowers` 引用残留（git 历史无关）；`pnpm run validate` 全绿 | 无 |
| P3 | **cdd-engine 服务化重构② · 命令面与契约**：`cdd brief` 自包含入 implement（删独立命令 + 相对 `packages/cdd-engine/` 的 `lib/cli/brief.mjs`，保留 `lib/brief.mjs generateBrief` 供 run-task）；`cdd research` 移除（删 CLI + `lib/cli/research.mjs` + tests + SUBCOMMAND_USAGE【位于 `lib/cli/parse.mjs`】+ bin 注释【位于 `bin/cdd.mjs`】）；base-branch CLI `--scope standalone` 已随 P1 移除；**usage 面**（`SUBCOMMAND_USAGE` / `program.description` / `--help`）+ maintainer doc 复核（**前提修正**：本仓不存在 README CDD CLI 表——根 `README.md` 无 CDD 命令面、`packages/cdd-engine/` 无 README；唯一 CLI 面文字 `docs/maintainers/osuperpowers-plugin.md` 的 `cdd review\|fix` 节只列 review/fix，无需改）；**cli-research skill 删除**（随命令面收敛一并执行）；**changeset 存量 backlog 归并**（4 个历史程序 14 条按 package × level 归并为 6 条；裸包名 `"osuperpowers"` 静默丢声明缺陷随之消解） | P3-design v1.2（2026-09-14） | Done | `cdd --help` 子命令集合收敛为 implement/review/fix/base-branch；零 brief/research 残留引用——**作用域 = engine 机制位置 `packages/cdd-engine/{bin,lib,templates}` + `packages/osuperpowers/skills`**（`.agents/` 由 emit 派生收敛，其源即 skills；历史 plan/spec 文档豁免）；engine 相关 tests 与命令面同步（含退役子命令断言 + 陈旧注释枚举收敛）；`pnpm run validate` 全绿 | P1 ->(soft) P3（standalone 面已并） |
| P4 | **engine 契约面收敛 + skills 全面重写**（三段式，engine 先行）。**①engine 信道收口**：`lib/root.mjs` 为 engine `bin`+`lib` 内唯一 `process.cwd()`；4 套 root 权威（`gitToplevel(cwd)`×4 / `dirname(plan)` / `CDD_WORKSPACE` / `dirname(doc) ?? rootFromDocPath`）收敛为值注入；`resolveDocArg` 单一坐标系（**仓根相对**、无 cwd 回落、BLOCKED 含仓根相对指导）；`resolveWorkspace(doc, root)` 收注入且删 `rootFromDocPath`；9 项派生值（`CDD_WORKSPACE`/`HANDOFF_PATH`/`MODE`/`HARNESS`/`LEDGER`/`TASK_BRIEF`/`PLAN_CONSTRAINTS`/`FINDINGS`/`TASK_REVIEW_FIXED_POINT`）去 env 化；`PLAN_FILE` 改显式参数；`CDD_LIFECYCLE_PATH`/`CDD_REGISTRY_PATH` 删净；`CDD_DRY_RUN`→`--dry-run`；测试脚手架改 `mkdtemp` 真仓隔离；canonical `templates/context-contract.json`（**context 零落盘**）。**②输出契约单源与失败类目**：提示词注入由 JSON Schema **原样注入**（`JSON.stringify`，T18 终态——任何手写 render 对契约零编辑权）、engine 写侧经同一 schema 构造、校验失败**保留 findings** 且报错含**违规键名**、失败六类化（`TIMEOUT`/`CONTRACT_VIOLATION`/`ENGINE_SELF_WRITTEN`/`EXECUTION_FAILURE`/`UNVERIFIABLE`/`PLAN_CONFLICT`）+ **配额隔离**、超时判定**引擎自持** + 默认 task 90 / review 60 分钟、`progress.json#plan` 透传、handoff 序列化全转义。**③单一守卫块（信道审计）**。**④收敛与删除**：`finding-meta` 枚举单源（三写→一写 + 渲染器注入）、`init` 删除 + 版本戳机制删除 + 反向守卫、`handoff-schema.md` 删除、机械同步面（skills-count 6→8 / digraph init 豁免移除 / `rule-reference.test` 作废）。**⑤templates 结构与命名单源（本版新增）**：4 个提示词模板收敛为**同一文档骨架**（段名/段序统一 + `## Handoff` 与 `## Return` 各为**一份共享壳**）；Handoff 段内 **schema 原样注入**（`JSON.stringify`）并**删除全部手写 render**（`stubAnnotation` / `satisfiesProp`（越权第二校验器）/ `patternSample` / `requiredKeys` / `stubScalar`）；两份 schema **补 `description`** 并把写协议规则从模板散文迁入；schema 前缀统一为作用域名（`cdd-handoff-schema.json` → `task-handoff-schema.json`）；模板目录分组与命名对齐（`doc-fix.md` 移出 `review/`）。**⑥skills 全面重写**：8 skill（委托型 6 / 原生型 2）全节点锚定；session-call 原语 `Run a /<plugin>:<skill> session`（**零上游文档 read**）；digraph 与 overall 主干同形；**`fix-inline` 删除（修复一律 `cdd fix`）**；Review Stopping 入各 skill Invariants；skills **零引擎内部结构依赖**（从命令输出契约读 status/artifacts/counters，不再拼 handoff 文件名或读 `progress.json`）；模板就近迁移；`skill-authoring.md` 按「唯一执法点」重写；`report-issue` 只做形态精简（目标流程与改名归 P5） | P4-design v1.0（2026-09-15） | [Pending] | engine `bin`+`lib` 内 `process.cwd()` **计数 = 1**；子目录 + 仓根相对 `--plan`/`--spec`/`--findings` 不再产生幽灵根（负例 → BLOCKED 两行诊断含仓根相对指导）；`process.env.*` 直读 ⊆ canonical 白名单且零测试旁路缝；`context-contract.json` 被运行期组合消费且 **context 零落盘**；派发输出含 `status`/`commits`/`artifacts`（绝对）/`blocker`/`counters` 且 engine 零回读自身输出；handoff 结构由 schema 派生、`CONTRACT_VIOLATION` 保留 findings、失败六类配额隔离、超时自持判定；`progress.json#plan` 与 `--plan` 一致；8 skill 全节点锚定、零上游文档 read、**零 `fix-inline`**、零 `CDD_*`/`progress.json`/handoff 文件名依赖；**templates 同一文档骨架**（4 模板段名/段序一致；`## Handoff` 与 `## Return` 各为一份共享壳）；**零手写 render**（engine 内零 `stubAnnotation` / `satisfiesProp` / `patternSample` / `requiredKeys` / `stubScalar`）；**Handoff 段为 schema 原样注入**（`JSON.stringify`）；两份 schema 均含 `description`，且模板内**零重复 Handoff Rules**（one truth）；schema 前缀与模板命名/分组统一（`task-*` / `docs-*`）；`init`/版本戳/`handoff-schema.md`/`_docs/review.md` 零残留；`pnpm run validate` 全绿 + `emit:check` 无 drift | P3 ->(soft) P4（四命令面 + skill 树基线先行，P4 消费之） |
| P5 | report-issue → report-issues 改名与流程精炼：skill 目录 / SKILL.md frontmatter / context 引用 / finding-meta.json components 更新（**改名一处**——`init` 移除与 3 个新 skill 已由 P4 单源化时同步）/ `.github/ISSUE_TEMPLATE` re-render（emit）/ README；findings 聚合流程精炼（explore-current-session → collect → reform【privacy 剥离 + maintainer-friendly】→ confirm → gh dedup【open+closed】→ **单新 issue 聚合** + dedup links + friendly 标题）；**#250/#260 report-issue 侧 6 条**（subject 泄漏消费者 run slug · analyze scope 漂移【项目内领域规则不入工具链 issue】· renderer stdin JSON 手拼易 malformed · master labels `session` 在目标仓不存在 · dedup 每 finding 全量拉取 · labels SOT 与仓库实际集合漂移） | [Pending] | [Pending] | 零 `report-issue` 引用残留（CHANGELOG 豁免）；新聚合流程落盘于 SKILL.md；`pnpm run emit` 后 `.github/ISSUE_TEMPLATE` 与 finding-meta 一致；**E 族 6 条已处置**——master subject 不含消费者 run slug（由首条 finding 提炼中性 topic）· analyze 有工具链 scope 过滤 · renderer 入参有 schema 校验（失败即早报）· master labels 与仓库实际标签集合一致（SOT 派生）· dedup 单次拉取批量匹配；`pnpm run validate` 全绿 | P4 ->(soft) P5（P4 定 skill 树与 engine 输出契约，P5 落实 report-issues 改名与流程） |
| P6 | 统一规划收口：目录 / 代码 / 文件命名最终一致性审查（engine lib 簇、skill 目录、tests、docs）；CLAUDE.md / README / maintainer docs 与落地一致；**harness 宣称收缩（决策 C）**——README.md / README.zh-CN.md / CLAUDE.md 去 8-harness 表述（保留 claude/cursor-agent 证实面 + 中性「多 harness 可消费」），README.zh-CN **陈旧面清理**（死引用 `docs/gate-install.md`、已删 harness 表 Trae/Vibe/Kiro/OpenCode/init-harness 模式、未证实 harness 行——与 README.md 收敛对齐），package.json `oscaner-plugin.claude.keywords` 去 `droid` / `pi`、**`package.json#pi` 死 manifest 字段删除**（2026-09-13 实证：`pi.skills` 零 emit/source/marketplace 脚本消费、registry 无 pi 条目、无 manifest 产出 → 死配置，随 keywords 一并移除），manifests.mjs 注释清理，emit 后 manifest 关键词随迁；**`.agents/` emit 面移除**（2026-09-13 实证：`.agents/skills/` 唯一消费者=Droid 未证实 harness、内容=`skills/` 冗余副本、claude/cursor/pi manifest 均消费 canonical `./skills/`、marketplace/source 零条目 → emitAgentsSkillsCopy 删除 + orchestrate prune/compare 路径 + 已跟踪 15 文件 git rm + emit.test 用例同步，emit 产出集合收敛为 `.claude-plugin` + `.cursor-plugin` + marketplace + `.github/ISSUE_TEMPLATE`）；**emit 与 harness-registry 精简审计**（emit manifest 产出集合无虚设 harness 产物；`harness-registry.json` = claude/cursor-agent 两实扛支撑条，无死条目）；**仓库 CLAUDE.md `.agents/` 派生提示清理**（根 CLAUDE.md 的「⚠️ Most Common Mistake — `.agents/` is derived, never edit」「Emit regenerates `.agents/`」「CRITICAL — emit after every source change」等随 `.agents/` emit 面移除同步更新——`.agents/` 不再派生，指引改写为面向剩余 emit 产物集合）；全量 `pnpm run validate` 13 块 + `emit:check` 全绿；逐 phase changeset 复核（P1–P3 engine patch/minor、P3 osuperpowers minor【cli-research skill 删除】、P4/P5 osuperpowers minor；P3 另做存量 backlog 归并——4 历史程序 14 条 → 6 条，裸包名静默丢声明缺陷随之消解）；残留清理（templates JSON 结构面单源已上移 P4） | [Pending] | [Pending] | 全仓命名/结构零冲突；**README/zh/CLAUDE.md 无 8-harness 宣称、无死引用、无已删 harness 残留；CLAUDE.md 无 `.agents/` 派生提示残留；package.json 无 droid/pi keywords、无 `#pi` 死字段；`.agents/` emit 面完全移除（`packages/osuperpowers/.agents/` 于 git 无跟踪、emit 无产出、代码零 `emitAgentsSkillsCopy`/`pruneStaleAgentsNamespaces` 引用、emit:check drift=0 说明产出集合收敛）**；emit manifest 集合（`.claude-plugin`/`.cursor-plugin`/marketplace/ISSUE_TEMPLATE——marketplace 与 ISSUE_TEMPLATE 为非 harness manifest 产物，保留）与 harness-registry（claude/cursor-agent）均无虚设 harness 条目；`pnpm run validate` + `emit:check` 全绿；各 phase changeset 齐备无遗漏；maintainer docs 与落地行为一致 | P1–P5 ->(hard) P6（收口需全部前序 shipped） |

---

## Dependency graph (ASCII)

```
P1 ->(soft) P3   (standalone CLI 面归 P1；P3 仅余 brief 自包含 + research 移除)
P3 ->(soft) P4   (四命令面 + skill 树基线先行，P4 消费之；cli-research 已随 P3 删除)
P4 ->(soft) P5   (P4 定 skill 树与 engine 输出契约，P5 落实 report-issues 改名与流程)
P1..P5 -> P6     (hard: P6 收口依赖全部前序 shipped)
P2 独立          (文档落点迁移，无硬依赖)
```

Legend: `->` = hard block；`-> (soft)` = ordering convenience only。

---

## Boundary rules

> 每个 phase：完整 brainstorm → plan → dev。Shipped before dependents start。
> Requirement changes arising during a phase （dev 期发现的 new needs / new constraints）MUST 回填本 overall 后再继续实现——version bump + change-history entry + sync affected phase acceptance/dependency，不允许实现期绕过。

---

## 目标 skills 架构参考（P4 brainstorm 锚）

以下为用户 2026-09-13 初始 brain 的 skills 箭头流程原貌——作为 P4（skills 全面重写）的**目标架构参考**（不是 P4 的全部内容，P4 还需叠加节点锚定骨架 + templates 就近 + harness 收敛）。P4 brainstorm 须以此为准绳产出 8 个新 SKILL.md。

### 终止语义（2026-09-13 用户澄清，覆盖全部 review→fix loop）

> **`blocker = 0` 指 `cdd review` 输出判定的 blocker 计数 = 0**（review 判定 APPROVED），**不是**「fix 完成以后自评无 blocker 所以认为完成」。这两者不可混淆：
> - loop 的**退出条件**是 review **输出** blocker=0（review 权威判定），fix 只是「按 findings 修正文档/代码」；
> - 「fix 完 → 因为改了所以 blocker 应该算 0」**不能**替代 review 输出判定——blocker=0 必须来自一次 `cdd review` 的结果，不得靠 fix 后自评推导。
> - 下方所有 `until review blocker = 0 and fixed all findings` 均按此语义解释：**review 输出 blocker=0**（退出 loop）→ 再 fix 全部 findings（含 warn/nit）→ 完成。Review Stopping 不因 fix 自评而提前放行。

### brainstorming

> **注（2026-09-13 用户澄清）**：brainstorming 也不读上游 skill 文档——「Run `/superpowers:brainstorming` 作为 baseline」即 Run-skill 会话调用，与 writing-plans 的「Run `/superpowers:writing-plans` session」同一模式；流程基线一律是 `/xxx` session 调用，无 authoring-read 例外。

```
判断是 new program 还是 phase program？
new program:
  1. Run `/superpowers:brainstorming` 作为 baseline；缺 → blocker (install oscaner-skills/superpowers)
  2. 探索上下文（代码 / issues / 文档）
  3. Run `/mattpocock-skills:grilling`；缺 → blocker (install oscaner-skills/mattpocock-skills)
  4. grilling 完成后：单 phase 可覆盖 还是 需多 phase 拆分？优先单 phase；无法抉择 → AskUserQuestion
     单 phase → Run `/osuperpowers:writing-single-spec`
     多 phase → Run `/osuperpowers:writing-overall-spec`
phase program:
  1–3. 同 new program（baseline / explore / grilling）
  4. 判断 phase size 是否合适、是否需子 phase 拆分？优先不拆分；无法抉择 → AskUserQuestion
     size 合适 → **若 phase scope 有变更 → 先 Run `/osuperpowers:writing-overall-spec` sync new scope/changes 到上级 overall**，再 Run `/osuperpowers:writing-phase-spec`（2026-09-13 用户补充）
     size 过大 → Run `/osuperpowers:writing-overall-spec` sync sub-phases 到上级 overall
     → handoff `/compact` 或 `/osuperpowers:brainstorming [sub-phase program]`
```

### writing-single-spec

```
Run `/superpowers:brainstorming` writing-spec session
  -> `cdd review` spec-1 -> `cdd fix` spec-1
  -> `cdd review` spec-2 -> `cdd fix` spec-2
  -> ... (spec-review-fix loop)
  -> until review 输出 blocker = 0 and fixed all findings（termination-semantics，见下）
  -> handoff to `/osuperpowers:writing-plans`
```

### writing-overall-spec

```
Read overall spec template
  -> writing overall spec
  -> `cdd review` spec-1 -> `cdd fix` spec-1
  -> ... (spec-review-fix loop)
  -> until review 输出 blocker = 0 and fixed all findings（termination-semantics，见下）
  -> handoff to `/compact` 或 `/osuperpowers:brainstorming [Px program]`
```

### writing-phase-spec

```
Read phase spec template
  -> writing phase spec
  -> `cdd review` spec-1 -> `cdd fix` spec-1
  -> ... (spec-review-fix loop)
  -> until review 输出 blocker = 0 and fixed all findings（termination-semantics，见下）
  -> handoff to `/osuperpowers:writing-plans`
```

### writing-plans

```
Run `/superpowers:writing-plans` session
  -> 若 plan 过程中发现 design 存在实质性偏移（事实性错误 / 缺失约束 / 需新增实施步骤）→
     **先回填 design spec**（修订 spec + 记录该偏移），令 spec 与 plan 一致后再进入 plan-review
     （2026-09-14 用户补充：writing-plans 阶段是 design 的最后一道实况校验；涉跨 phase 事项仍按 Boundary rules 回填上级 overall）
  -> `cdd review` plan-1 -> `cdd fix` plan-1
  -> ... (plan-review-fix loop)
  -> until review 输出 blocker = 0 and fixed all findings（termination-semantics，见下）
  -> handoff to `/osuperpowers:cli-driven-development`
```

### cli-driven-development

```
base branch determine 且 `cdd base-branch set`；无法抉择 → AskUserQuestion
cdd-engine not found → blocker (install @oscaner-skills/cdd-engine)
cdd-engine found:
  -> cdd implement T1 (含 brief 生成)
     -> T1 全串行闭环：`cdd review` T1-1 -> `cdd fix` T1-1 -> `cdd review` T1-2 -> `cdd fix` T1-2 -> ...
     -> (task-review-fix loop) until review 输出 T1 blocker = 0 and fixed all findings
     -> 只有 T1 loop 完全走完（review 输出 blocker=0 + findings 全 fix），才进入 T2
  -> cdd implement T2
     -> (同上 T2 全串行闭环) until review 输出 T2 blocker = 0 and fixed all findings
  -> ... (逐 T 各自闭环推进) until all tasks finished
  -> `cdd review` branch-1 -> `cdd fix` branch-1 ... (branch-review-fix loop)
  -> until review 输出 branch blocker = 0 and fixed all findings
  -> handoff to `/osuperpowers:finishing`
```

### finishing

```
Run `/superpowers:finishing-a-development-branch` session
  -> phase program：状态回填 overall spec
  -> 相关 issues 关闭
  -> 收尾工作
```

### report-issues（改名前 report-issue）

```
explore-current-session
  -> collect all findings (issue / error / flow deviation)，filter with oscaner-skills related
  -> reform findings: 移除用户隐私信息 (branch / user repo / pwd)；格式化为 maintainer-friendly
  -> 列 give 用户确认
  -> finding dedups from oscaner-skills' issues (open + closed) by `gh`
  -> 归档到 NEW ONE issue（非多 issue），与 dedup 链接
     标题用友好 subject，非短文本 ("Time" / "A little issues" / "Some bugs")
```

> **注**：`init` 已拍板删除（其功能 = cdd PATH 检测，已并入 cli-driven-development 的缺失 blocker；安装指引 = marketplace 原生）。`cli-research` 已拍板删除（req 6）。

---

## Maintenance

- Update links + change history per phase; no task lists。
- Master spec for cross-phase conventions；phase specs incremental。
- 本 overall 为「目标架构参考」的唯一持有者——P4/P5 执行后若图形 drift，须回填本节 + Boundary rules。

---

## Change history

| Version | Date | Summary | Author |
|---|---|---|---|
| v1.0 | 2026-09-13 | Initial charter — 6 phases（runtime 路径收敛 / specs 迁移 / 命令面收敛 / skills 重写 / report-issues / 统一收口），9 需求 + 补充拍板（init 删、39 文件 git-mv、review.md 折叠、standalone 并入、节点锚定保留、目标 skills 架构参考）；new-program 模式（无父 overall）。含三项用户澄清：**① 每 Task 串行闭环**（T1 loop 全完才进 T2）；**② brainstorming 零上游 read——`Run /superpowers:brainstorming` 即会话调用，无 authoring-read 例外**；**③ review→fix loop 终止语义——`blocker=0` 指 `cdd review` 输出判定的 blocker=0，非 fix 后自评** | [human] · Claude Opus 5 (1M context) |
| v1.1 | 2026-09-13 | **cdd-engine 服务化升维（用户 2026-09-13 升维）**：本程序包括 cdd-engine 的重构——engine 是服务整个体系的底层服务层（workspace 单根布局 → 命令面四命令收敛 → host harness 检测自包含 → 模板数据化 → artifact 写权全归 engine）；「engine 服务，skills 编排」边界原则入 charter；P1/P3 重命名为服务化重构 ①② 载体；charter version v1.0→v1.1（scope 升维，v1.0→v1.1 未 commit，仍 draft） | [human] · Claude Opus 5 (1M context) |
| v1.2 | 2026-09-13 | **harness 宣称收缩（决策 C，用户 2026-09-13 拍板）+ `.agents/` emit 面移除 + `#pi` 死字段删除（同日实证）+ review-1 合规修改并入**：README.md / README.zh-CN.md / CLAUDE.md 去 8-harness 表述、README.zh-CN 陈旧面清理（gate-install.md 死引用 / Trae-Vibe-Kiro-OpenCode / init-harness 模式）、package.json keywords 去 droid/pi + **`package.json#pi` 死 manifest 字段删除（pi.skills 零脚本消费 / registry 无 pi 条目 / 无 manifest 产出）**、manifests.mjs 注释清理——未经证实可用（droid/pi/grok/qoder/codex/gemini）不上任何宣称面；**`.agents/skills/` 实证唯一消费者=Droid（未证实）、内容=`skills/` 冗余副本、claude/cursor manifest 均消费 canonical `./skills/` → emitAgentsSkillsCopy 全删、emit 产出集合收敛 `.claude-plugin`+`.cursor-plugin`+marketplace+ISSUE_TEMPLATE、根 CLAUDE.md `.agents/` 派生提示同步清理**；emit 与 harness-registry 精简审计入 P6 scope/acceptance。**并入 review-1 合规修改**（P1 存量 `.superpowers/cdd/*` 处置 + non-goal 引擎/lifecycle 限定 + req7 归因 + Document scope deviation 措辞 + P3 lib/cli 路径精度 + 目标架构 §brainstorming 零-read 注 + termination-semantics）——以上均源于 initial spec-review-1 findings 或用户澄清，补记于本条（charter version v1.1→v1.2，未 commit，仍 draft） | [human] · Claude Opus 5 (1M context) |
| v1.3 | 2026-09-13 | **P1 brainstorm 收敛 + P1 design v1.0 落盘**：grilling 三案定稿——**① 存量 `.superpowers/cdd/*` 工作区由「保留转只读」升格为全量删除**（gitignored 死档零 reader，破坏性重构授权下遗留即删）；**② standalone 由「并入 `cdd/<slug>`」升格为整体移除**（实证零真实派发：`.superpowers/standalone/` 从未创建、13 个历史 base-branch.json 全在 `cdd/`、finishing 正常入口必经 CDD workspace → STANDALONE_ROOT/`--scope`/`--slug` 全删、base-branch CLI 单调 `--plan`、finishing 无 artifact 推断后不落盘；`--plan`/`--slug` 并存之问 → standalone 伪功能即证删除，无内容路径/落点分裂）；**③ `--spec`/`--plan` 不并入 `--slug`**（content-bearing 文档路径 vs location-bearing 纯落点，review/fix/implement 全 content、base-branch 为唯一 artifact 命令——后者因 standalone 删除反而单调化）。overall 同步：P1 scope/acceptance 措辞更新 + P1 Design-spec 列回填（[Pending]→P1-design v1.0）；Dependency graph P1→P3 边措辞（standalone CLI 面归 P1）+ change-history（v1.2→v1.3） | [human] · Claude Opus 5 (1M context) |
| v1.4 | 2026-09-13 | **目标架构参考补充（用户 2026-09-13）**：§brainstorming phase program 分支——`size 合适`时**若 phase scope 有变更，先 Run /osuperpowers:writing-overall-spec sync new scope/changes 到上级 overall，再 Run /osuperpowers:writing-phase-spec**（顺序定案：先 sync 后写 phase spec）（P4 brainstorm 锚点更新，与本程序 P1 无关；对 P1 design 无 scope 影响）（v1.3→v1.4） | [human] · Claude Opus 5 (1M context) |
| v1.5 | 2026-09-14 | **P1 dev shipped**（CDD 5-task 全串行闭环 + branch-review develop..HEAD APPROVED 0 findings）：workspaceRoot 单源翻转 `.superpowers/cdd`→`.osuperpowers/cdd`（engine 产物/handoff/progress/lifecycle/base-branch/report-target 全落新根）+ 全 literal 迁移（13 测试文件 + engine 源注释 + 7 skills/docs + smoke-cdd + gitignore）；standalone 整体移除（`cdd base-branch` 单调 `--plan`、STANDALONE_ROOT/`--scope`/`--slug` 全删、finishing read-base 无 artifact 推断不落盘）；存量旧根死档全量删除（`.superpowers/` 仅存 `sdd/`）；stale-lexicon 守卫 `.superpowers/cdd`/`standalone` 防回渗 + sdd 放行；changeset cdd-engine minor（p1-cdd-runtime-layout-singleton）；**F13 closeout 检查点执行**（P1 Phase inventory plan 列回填 [Pending]→Done + closeout 行声明）（v1.4→v1.5） | [human] · Claude Opus 5 (1M context) |
| v1.6 | 2026-09-14 | **writing-plans design 回填步骤（用户 2026-09-14 补充，与 P2 scope 无关）**：目标 skills 架构参考 §writing-plans 增一步——**plan 过程中若发现 design 存在实质性偏移（事实性错误 / 缺失约束 / 需新增实施步骤）→ 先回填 design spec（修订 + 记录该偏移），令 spec 与 plan 一致后再进入 plan-review**；涉跨 phase 事项仍按 Boundary rules 回填本 overall。固化 P2 plan 阶段实况：写 plan 时发现 P2 design §2.3 缺「新 overall canonical 列归一」要求（overall-consistency ① 回填声明 ↔ 列字面等价）→ 当场补注 design spec（v1.5→v1.6） | [human] · Claude Opus 5 (1M context) |
| v1.7 | 2026-09-14 | **P2 canonical 列归一**：P1 `Implementation plan` 列由 `**Done**（2026-09-14 shipped…）` 收敛为裸 `Done`——① 回填声明 target key 与列字面等价（canonical 形同 cdd-overhaul P1 列），令新 overall 通过 overall-consistency 四表守卫；交付详情见 v1.5（v1.6→v1.7） | [human] · Claude Opus 5 (1M context) |
| v1.8 | 2026-09-14 | **docs 根纠正（用户 2026-09-14 指令；program 级需求变更，Boundary rules 回填）**：docs 单根由 `osuperpowers/{specs,plans}` 纠正为 **`docs/osuperpowers/{specs,plans}`**（与既有 `docs/maintainers/` 同处 `docs/` 根；亦避免与 `packages/osuperpowers/`、`.osuperpowers/` 的命名混淆）。本表 File paths 三行 + P2 scope/acceptance 同步；P2 design/plan 全路径面重写；validator `SPECS_DIR`/`PLANS_DIR` = `docs/osuperpowers/{specs,plans}`；`rootFromDocPath` marker 相应为 `docs`+`osuperpowers`（+ `specs`|`plans`）。T1/T2 已执行产物按纠正重落（v1.7→v1.8） | [human] · Claude Opus 5 (1M context) |
| v1.9 | 2026-09-14 | **P2 dev shipped**（CDD 6-task 全串行闭环 + branch-review APPROVED 0 blocker）：docs 单根 `docs/osuperpowers/{specs,plans}`（39 历史 git-mv + 54 处重写）+ `rootFromDocPath` 段对 `docs`+`osuperpowers` + validator 单 glob + stale-lexicon 守卫（含 doc-surface 面）+ tickets 全移除（10 处）+ docs 根单源 `scripts/lib/doc-root.mjs`；**F13 closeout 检查点执行**（P2 Phase inventory plan 列回填 [Pending]→Done；Design spec 列回填 [Pending]→P2-design v1.0）；changeset cdd-engine minor（p2-docs-root-migration）（v1.8→v1.9） | [human] · Claude Opus 5 (1M context) |
| v1.10 | 2026-09-14 | **cdd 运行根约定需求登记（用户 2026-09-14 补充；与 P2 scope 无关）**：cdd-engine 内多数路径相对 `[repo-root]`——AI 误 `cd` 入 `[repo]` 子目录会让 spec/plan/docs 找不到（多项目使用 oscaner-skills 的踩坑点）。归 **P4（skills 全面重写）**：Requirement inventory 增行 + P4 Phase inventory scope/acceptance 同步；**修复形态于 P4 brainstorm 定案**（候选：skill 侧强制在 repo root 执行 / engine 侧根解析加固）（v1.9→v1.10） | [human] · Claude Opus 5 (1M context) |
| v1.11 | 2026-09-14 | **P3 brainstorm 收敛 + P3 design v1.2 落盘（grilling 六问，Boundary rules 回填）**：**① cli-research skill 删除由 P4 移入 P3**（用户 2026-09-14 定：删除一个命令必须同步其唯一调用方，属删除操作的完整性而非 P4 的 skill 重写）——Requirement inventory req 6 主行括注 + req 6 续行归属列同步改 P3，P4 行 scope/acceptance 去该分句（避免「再删一次已删物」的悬空要求），Dependency graph P3→P4 边理由改述为「四命令面 + skill 树基线先行」；**② P3 acceptance「零 brief/research 残留引用」补作用域限定**——engine 机制位置 `packages/cdd-engine/{bin,lib,templates}` + `packages/osuperpowers/skills`（`.agents/` 由 emit 派生收敛）；**③ P3 scope「usage / README CDD CLI 表同步」前提修正**——本仓不存在 README CDD CLI 表（根 README 无 CDD 命令面、`packages/cdd-engine/` 无 README），收敛为 usage 面 + maintainer doc 复核；**④ P3 scope 增 changeset 存量 backlog 归并**（charter「不留技术债务」用户 2026-09-14 授权：4 个历史程序 14 条未消费 changeset 按 package × level 归并为 6 条；`p-delta` / `p-epsilon` 的裸包名 `"osuperpowers"` 因 `changesetsForPlugin` 精确名过滤而**不进 changelog 段落却被 unlink 消费 → 静默丢声明**的缺陷随之消解；本程序 per-phase 三条保留——P6 acceptance「各 phase changeset 齐备无遗漏」的复核粒度，非债务）；**⑤ P3 决策面**——级联死配置全量连根（`DEFAULT_TIMEOUTS.research` / `CDD_RESEARCH_TIMEOUT` / `LEGACY_MODE_ENV` 整表 / `validateBrief` 零生产者）+ 防回渗守卫取命令形（`/\bcdd (brief\|research)\b/`，为 P4 合法的 `/mattpocock-skills:research` 会话调用留空间）；**⑥ P3 Design spec 列回填 [Pending]→P3-design v1.2**（v1.10→v1.11） | [human] · Claude Opus 5 (1M context) |
| v1.12 | 2026-09-15 | **templates JSON 结构面单源需求登记（用户 2026-09-15 补充；与 P3 scope 无关）**：`cdd-engine/templates/` 面向 AI 的 JSON 结构须由 **JSON Schema 注入**，不得手写「简洁版」——实测 `lib/templates.mjs:49-66` 的 `renderHandoffStub` 仅遍历 `schema.required` 并以硬编码 switch 填占位值（不携带类型 / enum / 嵌套形状 / `allOf` 条件约束），而 `cdd-handoff-schema.json` properties 13 + `allOf` 1、`docs-handoff-schema.json` properties 8 → AI 依「简洁版」产出与 schema 不一致，被 `validateHandoffSchema` 丢弃（多项目使用者踩坑点）。**归 P6**（用户 2026-09-15 选定）：非 P3——P3 设计/计划双 review 循环均已关闭，塞入新引擎子系统须重开已批准产物并冲击在跑 T5 / 待办 T6；P6 是唯一仍合法触达 engine 内部的 phase，且已承载同族引擎级遗留。overall 同步：Requirement inventory 增行 + P6 Phase inventory scope/acceptance 同步（v1.11→v1.12） | [human] · Claude Opus 5 (1M context) |
| v1.13 | 2026-09-15 | **P3 dev shipped**（CDD 6-task 全串行闭环 + branch-review APPROVED 0 blocker，PR #261）：`cdd` 子命令 6→4（删 `cdd brief`【engine 已在 implement 的 plan 定稿处自给 brief，F11】与 `cdd research`）；`cli-research` skill 随其唯一调用方一并删除；级联死配置连根（`DEFAULT_TIMEOUTS.research` / `modeEnv.research` / `LEGACY_MODE_ENV` 整表 + legacy 分支 / 零生产者 `validateBrief`）；顶层命令集合静态实例断言 + 两条退役子命令黑盒断言（完整形态，非 bare 假绿）；stale-lexicon 守卫两条（命令形 `\bcdd (brief\|research)\b` + `/RESEARCH_TIMEOUT/` 单分支）；存量 changeset backlog 归并 14→6（裸包名静默丢声明缺陷消解，`version --dry-run` next 仍 1.0.0）。**F13 closeout 检查点执行**（P3 Phase inventory plan 列回填 [Pending]→Done）。changeset：`cdd-engine` minor + `osuperpowers` minor（`p3-cdd-command-surface`）；follow-up 归 P6：smoke workspace 并发 flake / `resolveVendorVersion` flake / engine changeset 版本效果不落地 / Phase inventory 表列形（v1.12→v1.13） | [human] · Claude Opus 5 (1M context) |
| v1.14 | 2026-09-15 | **P4 brainstorm 收敛 + P4 design 落盘 + #250/#260 实证驱动的 scope 扩张（Boundary rules 回填）**。**①统一抽象（用户 2026-09-15 定）**：**输入闭包**（三信道——argv 调用级 / git 事实级 / env 策略级；`cwd`、路径字符串形状、上次运行残留、引擎自写值**均非输入**）+ **输出契约单源**（其边对对偶）——契约单源全派生 / 失败类目化 + 配额隔离 / 写者唯一 + 序列化单点 / 已知事实不得被缺省覆盖；`cdd context` 为 per-call **内存**对象（**零落盘**——多项目并发与前后不同任务下持久化运行时上下文必成第二真相源并跨调用污染），声明落 `cdd-engine/templates/context-contract.json`；**②P4 决策面**：Q1 单根权威（engine `bin`+`lib` 内 `process.cwd()` 计数 = 1、无 cwd 相对回落、BLOCKED 诊断含仓根相对指导）；Q2 版本戳机制整体删除 + 反向守卫；Q3 cli-driven-development 取 γ（digraph 与目标主干同形，失败语义下沉短表）；Q4 timeout 提升 task 90 / review 60 分钟，并经 #260[4] 实证扩为「提升 + 分类自持 + 计数器隔离」；Q5 `skill-authoring.md` 重写换「唯一执法点」判据 / `_docs/review.md` 删除（Stopping 入各 skill Invariants）/ `finding-meta` 枚举单源（canonical 内三写→一写 + 渲染器注入）；Q6 单 phase 三段式（engine 先行）；Q7 `CDD_LIFECYCLE_PATH` 删净（owner-liveness 守卫已使其代偿的不变量无条件成立，缝随因灭）；Q9 发布面收敛为**既有接口**（命令输出契约 + 命令显式管理的工件），skills 零引擎内部结构依赖；**③`fix-inline` 判死（用户 2026-09-15 指出）**：修复一律 `cdd fix`——目标流程全篇为 `cdd review → cdd fix`，Review Stopping 的 canonical 节点即 `cli-fix-all-findings`（**CLI 形**），inline 修复绕过 engine 的轮次记录与校验；**④#250 / #260（13 finding）逐条归类**：engine 侧（提示词仅给手写简洁版 sample · 未定义键被拒 · `blocker` 三种表达 · 校验失败丢弃 findings · 报错不含违规键名 · 超时未识别 · 计数器共享 · 自写 BLOCKED 指引与 Stopping 判据矛盾 · cap 后无合规重试 · handoff 序列化转义 · `progress.json#plan` 恒空）归 **P4**，report-issue 侧 6 条归 **P5**；templates JSON 结构面单源由 **P6 上移 P4**；Requirement inventory 增 4 行；**⑤ P4 Design spec 列回填 [Pending]→P4-design v1.0（2026-09-15）**；**⑥ P5 scope 增 E 族 6 条 + 改名收敛为一处**，P6 scope/acceptance 移除已上移项，Dependency graph P4→P5 理由更新（v1.13→v1.14） | [human] · Claude Opus 5 (1M context) |
| v1.15 | 2026-09-16 | **templates 全面收敛需求扩张（用户 2026-09-16 指令；dev 期发现，Boundary rules 回填）**：T5 的 task-review 暴露「全形派生」实为 **schema 的手写解释器**——含越权的第二校验器 `satisfiesProp`、形状受限的 `patternSample`、漏 `items` 分支、并产出**违反自身 schema** 的占位值（`base: ""` 违反 `pattern`；`task: 0` 违反 `minimum`）；用户裁定**既不得手写「简洁版」、也不得手写「忠实版」渲染器**，一律 **schema 原样注入**（`JSON.stringify`）。据实证把 scope 由「JSON 结构面单源」扩为**四层收敛**：① JSON 结构面（原样注入）② **文档结构面**（4 个提示词模板收敛为**同一文档骨架**：段名/段序统一，`## Handoff` 与 `## Return` 各为**一份共享壳**——实证现状为同一概念三种段名、段序两套、Return 段名两种且一处缺失、self-validate 仅一处有、标题形四种）③ **命名面**（schema 前缀统一为作用域名 `task-*` / `docs-*`；模板目录分组对齐——`doc-fix.md` 现错位于 `review/`）④ **描述面**（两份 schema **补 `description`**——现 cdd 0/13、docs 0/8 properties 且顶层亦无——把写协议规则从模板散文**迁入 schema**，随注入同行，消除文档内多地维护的 Handoff Rules → **one truth**）；Requirement inventory 该行与 Phase inventory（P4 scope / acceptance）同步扩写；**T5 的 renderer 由新增 T18 取代**（有计划的替换，非遗留债务）；**P4 phase spec §2.5.1 的「全形派生」措辞待修正为「原样注入」**（v1.14→v1.15） | [human] · Claude Opus 5 (1M context) |