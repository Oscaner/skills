# osuperpowers 架构重构 — Overall Spec

- **Version**: v1.6 · 2026-09-14
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

新布局**前瞻执行**：本 overall 即 `osuperpowers/` 根下第一个文档（req 2 落点）；`docs/superpowers/` 下 39 个历史 spec/plan 由 P2 git-mv 迁入，验证器届时收敛单 glob。

| Artifact | Path |
|---|---|
| Overall | `osuperpowers/specs/2026-09-13-osuperpowers-overhaul-overall.md` |
| Phase spec | `osuperpowers/specs/2026-09-13-osuperpowers-overhaul-<phase-id>-design.md` |
| Phase plan | `osuperpowers/plans/2026-09-13-osuperpowers-overhaul-<phase-id>.md` |

`<phase-id>` 小写（`p1`…`p6`）。Inventory 列在文件落盘后链入。

---

## Program charter

将 osuperpowers 插件 + cdd-engine 从「多根命名、读上游基线的大体积 SKILL、冗余命令面」收敛为「**单根 artifact 布局（`.osuperpowers/` 运行时 + `osuperpowers/` 文档）、命令面精简（implement/review/fix/base-branch）、session-call 简洁 skill 树（不读上游、纯 `/xxx` 调用、保留节点锚定骨架）**」的收敛程序。九项需求（req 1–9，含用户初始 skills 箭头流程）全部源自用户 2026-09-13 的 new-program 脑暴；skills 的目标架构（含 `writing-single-spec` / `writing-overall-spec` / `writing-phase-spec` 新 skill 与 report-issues 改名）定案于本 program charter，P4/P5 按其执行。

**cdd-engine 服务化主线（2026-09-13 用户升维）**：本程序**包括 cdd-engine 的重构**——engine 不是被路径/命令清理的被动对象，而是重构为**服务整个体系的底层服务层**：workspace 布局（单根 `.osuperpowers/cdd/<slug>` + standalone 并入）→ 命令面（implement/review/fix/base-branch 四命令收敛）→ host harness 检测自包含 → 渲染/模板数据化 → artifact 写权全归 engine。skills 全面变薄后，engine 是唯一 artifact 写者 + 唯一 harness 解析者 + 唯一命令持有者——「engine 服务，skills 编排」是本次重构的边界原则。

**Non-goals**：
- 不修改 vendored 子模块（superpowers / mattpocock-skills / impeccable）
- **不改变引擎评审语义本体**：review/fix/handoff 生命周期、Stopping 判定、commit-contract、doc_hash 双签名等判定逻辑不动——本程序仅收敛路径 / 命名 / 命令面 / 编排 skill 层
- 不引入新增 **引擎/lifecycle** 流程节点——cdd 引擎生命周期（implement/review/fix 循环、Stopping、commit-contract）不变；skill 树允许新增 session-call **编排壳**（writing-single-spec / writing-overall-spec / writing-phase-spec 属编排壳，非新流程节点；brainstorming / writing-plans / cli-driven-development 结构不变，仅 skill 形态重写）
- 不承载 #246 之后的消费方新 report（另行走 report-issue 通道；本程序不含 GH issue 创建）

**Cross-cutting constraints**：
- **节点锚定式规则保留**：简洁模式 ≠ 无结构——所有 SKILL.md 仍须 digraph + 节点定义 + exit/fail 语义（skill-authoring 已确立的骨架不变），只是 Content 改为 session-call 命令链
- **skills 内容全重写**：不再读上游 skill 文档；完全依赖 `Run a /xxx session` 调用（grill-me 范本：frontmatter + 命令链）；删除旧规则机械（read-upstream 基线、Invariants 冗余表、failure-mode 长表、`_docs/review.md` URC）
- **artifacts 单落点**：`.osuperpowers/cdd/<slug>/`（standalone 并入，不同 feature 独立 base-branch）；文档单根 `osuperpowers/{specs,plans}`
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
| P2 | req 2 | specs/plans 产出到 `[repo]/osuperpowers/[specs\|plans]`（`docs/superpowers/` 迁移；39 历史文件 git-mv 已拍板） |
| P3 | req 4 | `cdd brief` 不单独构建，自包含到 `cdd implement` 内（独立命令删除，lib/brief.mjs 保留供 run-task） |
| P3 | req 6 | 清理 `cdd research` 独立命令（skill 删除归 P4） |
| P3 | req 7 | 清理冗余 cdd 命令；base-branch CLI `--scope standalone` 已归 P1（standalone 整体移除） |
| P6 | 决策 C（2026-09-13 拍板） | harness 宣称全面收缩——未经证实可用的 harness（droid / pi / grok / qoder / codex / gemini）不出现在任何宣称面：README.md / README.zh-CN.md / CLAUDE.md 的「works across 8 harness」表述、package.json `oscaner-plugin.claude.keywords` 的 `droid` / `pi` + **`package.json#pi` 死 manifest 字段**（pi.skills 零脚本消费 / registry 无 pi 条目 / 无 manifest 产出）、manifests.mjs 注释残留；**emit 与 harness-registry 精简审计**——emit 的 **harness manifest 产出**仅 `.claude-plugin` + `.cursor-plugin` 两真实支撑面（marketplace / `.github/ISSUE_TEMPLATE` 为非 harness manifest 产物，仍正常产出，不删），registry 仅 claude/cursor-agent 两实扛条；完整产出集见 Phase inventory P6 行 |
| P4 | req 8 | 所有 skills 采用节点锚定式；内容全重写为 session-call 简洁模式 |
| P4 | req 3 | skills 用到的 templates 与 skills 就近（overall/phase-spec-template 随新 skill 树迁移） |
| P4 | req 5 | host harness 判断自包含在 cdd-engine；skills 不特别说明 |
| P4 | req 6（续，skill 侧） | cli-research **skill** 删除（延自 P3 的 req 6——P3 仅删 `cdd research` CLI，skill 面归 P4） |
| P4 | req 7（skills 侧，续 P3） | 清理冗余 skills：init 删除（2026-09-13 拍板）；`_docs/review.md` URC 折叠入各 skill |
| P5 | 用户初始流程 | `report-issue` 改名 `report-issues` + findings 聚合流程精炼（gh dedup / 单新 issue / privacy 剥离 / friendly 标题） |
| P6 | req 9 | 目录结构 / 代码结构 / 文件命名统一规划收口 |

---

## Phase inventory

| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |
|---|---|---|---|---|---|---|
| P1 | **cdd-engine 服务化重构① · runtime 布局**：workspace 根 `.superpowers/cdd` → `.osuperpowers/cdd`（handoff-namespace.json#workspaceRoot / lifecycle / progress / registry 路径随迁）；**standalone 整体移除**（零真实派发伪功能——`.superpowers/standalone/` 从未创建、13 个历史 base-branch.json 全在 `cdd/` 下）：STANDALONE_ROOT / `--scope` / `--slug` 全删、base-branch CLI 单调 `--plan`、finishing read-base 无 artifact 推断后不落盘；`.superpowers/{docs-review, archive-*}` 残留清除；**存量 `.superpowers/cdd/*` 工作区全量删除**（18 历史程序 + lifecycle.json + smoke + archive + docs-review——gitignored 死档无 reader，破坏性重构授权下遗留即删；本程序自身 spec-review-1/2 落在旧根已消费完毕，P1 后后续 phase review/fix 在新根重开 round——doc_hash 双签名使 Stopping 语义不因分根断裂）；gitignore（保留 `.superpowers` 含 sdd + 增 `.osuperpowers`）/ residue guard（stale-lexicon 防 `.superpowers/cdd`/`standalone` 回渗，`.superpowers/sdd` 放行）/ smoke-cdd / engine tests / skills docs 路径 / report-issue 读取路径同步（`.superpowers/sdd` 保留——superpowers 所属，不在本程序迁移域） | P1-design v1.0（2026-09-13） | **Done**（2026-09-14 shipped，plan v1.0 5-tasks 全闭环 + branch-review APPROVED） | 引擎运行期零 `.superpowers` 写入（superpowers 的 sdd 保留面除外，resolveWorkspace 全走新根）；`.superpowers/` 下**仅存 `sdd/`**（cdd 全 workspace / lifecycle / smoke / archive / docs-review 已删，git status 干净）；`cdd base-branch set/get` 仅 `--plan` 目标（`--scope`/`--slug` 标识不存在）；finishing read-base 无 artifact → 推断 base 传给 present-menu 不落盘；新增 `.superpowers/cdd` / `.superpowers/standalone` stale-lexicon 守卫机制位置零命中（`.superpowers/sdd` 引用放行）；根 `.gitignore` 同时含 `.superpowers` + `.osuperpowers`；`pnpm run validate` 13 块全绿 | 无（program 起点） |
| P2 | specs/plans 落点迁移：`docs/superpowers/{specs,plans}` 39 个历史文件 git-mv → `osuperpowers/{specs,plans}`；`naming.mjs rootFromDocPath` 识别新布局；`overall-consistency` validator glob + fixtures 迁移；residue 豁免路径；skills / templates 内 path 文本、README / CLAUDE.md / maintainer docs 同步；空 `docs/superpowers` 清理 | [Pending] | [Pending] | 单一 spec/plan 根 `osuperpowers/` 且 validator 单 glob；历史 39 + 在途程序经迁移后验证全绿不误报；零 `docs/superpowers` 引用残留（git 历史无关）；`pnpm run validate` 全绿 | 无 |
| P3 | **cdd-engine 服务化重构② · 命令面与契约**：`cdd brief` 自包含入 implement（删独立命令 + 相对 `packages/cdd-engine/` 的 `lib/cli/brief.mjs`，保留 `lib/brief.mjs generateBrief` 供 run-task）；`cdd research` 移除（删 CLI + `lib/cli/research.mjs` + tests + SUBCOMMAND_USAGE【位于 `lib/cli/parse.mjs`】+ bin 注释【位于 `bin/cdd.mjs`】）；base-branch CLI `--scope standalone` 已随 P1 移除；usage / README CDD CLI 表同步 | [Pending] | [Pending] | `cdd --help` 子命令集合收敛为 implement/review/fix/base-branch；零 brief/research 残留引用（历史 plan/spec 文档除外）；engine 相关 tests 与命令面同步；`pnpm run validate` 全绿 | P1 ->(soft) P3（standalone 面已并） |
| P4 | skills 全面重写：8 skill 全量 session-call 简洁模式（grill-me 范本——frontmatter + `Run a /xxx session` 命令链 + `cdd review/fix` 循环 + 判定门；**保留节点锚定式骨架** digraph + 节点定义）；新树 = brainstorming（委托重构）/ writing-single-spec（新）/ writing-overall-spec（新）/ writing-phase-spec（新）/ writing-plans / cli-driven-development（**每 Task 串行闭环：implement → review1 → fix1 → review2 → fix2 → … → review 输出 blocker=0 + findings 全 fix 后才进下一 Task implement**）/ finishing / report-issues（改名归 P5，P4 定树）；`init` 删除、`cli-research` 删除、`_docs/review.md` URC 折叠（Review Stopping 一行入各 skill）；templates 就近迁移（overall-spec-template → writing-overall-spec、phase-spec-template → writing-phase-spec、add-phase-protocol 随附、finding-meta.json 随 report-issues——component 列表更新归 P5）；harness prose 收敛（engine 自检，skills 零特判）；digraph-consistency.test 更新（init 豁免移除） | [Pending] | [Pending] | 新 skill 树 8 skill 全节点锚定（digraph+节点定义）；**所有 skill（含 brainstorming）零上游文档 read——流程基线一律 `Run a /xxx session` 会话调用（grill-me 模式），无 authoring-read 例外；brainstorming 的「Run `/superpowers:brainstorming` 作为 baseline」即会话调用，非 read**；cli-driven-development 每 Task 闭环语义可执行（T1 loop 全完才进 T2）；emit 无 drift；README / 发布面零 cli-research / init 残留；`pnpm run validate` 全绿（含 digraph-consistency 无豁免） | P3 ->(soft) P4（research CLI 移除先行） |
| P5 | report-issue → report-issues 改名与流程精炼：skill 目录 / SKILL.md frontmatter / context 引用 / finding-meta.json components 更新（init 移除 + 改名）/ `.github/ISSUE_TEMPLATE` re-render（emit）/ README；findings 聚合流程精炼（explore-current-session → collect → reform【privacy 剥离 + maintainer-friendly】→ confirm → gh dedup【open+closed】→ **单新 issue 聚合** + dedup links + friendly 标题） | [Pending] | [Pending] | 零 `report-issue` 引用残留（CHANGELOG 豁免）；新聚合流程落盘于 SKILL.md；`pnpm run emit` 后 `.github/ISSUE_TEMPLATE` 与 finding-meta 一致；`pnpm run validate` 全绿 | P4 ->(soft) P5（skill 树定案后改名） |
| P6 | 统一规划收口：目录 / 代码 / 文件命名最终一致性审查（engine lib 簇、skill 目录、tests、docs）；CLAUDE.md / README / maintainer docs 与落地一致；**harness 宣称收缩（决策 C）**——README.md / README.zh-CN.md / CLAUDE.md 去 8-harness 表述（保留 claude/cursor-agent 证实面 + 中性「多 harness 可消费」），README.zh-CN **陈旧面清理**（死引用 `docs/gate-install.md`、已删 harness 表 Trae/Vibe/Kiro/OpenCode/init-harness 模式、未证实 harness 行——与 README.md 收敛对齐），package.json `oscaner-plugin.claude.keywords` 去 `droid` / `pi`、**`package.json#pi` 死 manifest 字段删除**（2026-09-13 实证：`pi.skills` 零 emit/source/marketplace 脚本消费、registry 无 pi 条目、无 manifest 产出 → 死配置，随 keywords 一并移除），manifests.mjs 注释清理，emit 后 manifest 关键词随迁；**`.agents/` emit 面移除**（2026-09-13 实证：`.agents/skills/` 唯一消费者=Droid 未证实 harness、内容=`skills/` 冗余副本、claude/cursor/pi manifest 均消费 canonical `./skills/`、marketplace/source 零条目 → emitAgentsSkillsCopy 删除 + orchestrate prune/compare 路径 + 已跟踪 15 文件 git rm + emit.test 用例同步，emit 产出集合收敛为 `.claude-plugin` + `.cursor-plugin` + marketplace + `.github/ISSUE_TEMPLATE`）；**emit 与 harness-registry 精简审计**（emit manifest 产出集合无虚设 harness 产物；`harness-registry.json` = claude/cursor-agent 两实扛支撑条，无死条目）；**仓库 CLAUDE.md `.agents/` 派生提示清理**（根 CLAUDE.md 的「⚠️ Most Common Mistake — `.agents/` is derived, never edit」「Emit regenerates `.agents/`」「CRITICAL — emit after every source change」等随 `.agents/` emit 面移除同步更新——`.agents/` 不再派生，指引改写为面向剩余 emit 产物集合）；全量 `pnpm run validate` 13 块 + `emit:check` 全绿；逐 phase changeset 复核（P1–P3 engine patch/minor、P4/P5 osuperpowers minor）；残留清理 | [Pending] | [Pending] | 全仓命名/结构零冲突；**README/zh/CLAUDE.md 无 8-harness 宣称、无死引用、无已删 harness 残留；CLAUDE.md 无 `.agents/` 派生提示残留；package.json 无 droid/pi keywords、无 `#pi` 死字段；`.agents/` emit 面完全移除（`packages/osuperpowers/.agents/` 于 git 无跟踪、emit 无产出、代码零 `emitAgentsSkillsCopy`/`pruneStaleAgentsNamespaces` 引用、emit:check drift=0 说明产出集合收敛）**；emit manifest 集合（`.claude-plugin`/`.cursor-plugin`/marketplace/ISSUE_TEMPLATE——marketplace 与 ISSUE_TEMPLATE 为非 harness manifest 产物，保留）与 harness-registry（claude/cursor-agent）均无虚设 harness 条目；`pnpm run validate` + `emit:check` 全绿；各 phase changeset 齐备无遗漏；maintainer docs 与落地行为一致 | P1–P5 ->(hard) P6（收口需全部前序 shipped） |

---

## Dependency graph (ASCII)

```
P1 ->(soft) P3   (standalone CLI 面归 P1；P3 仅余 brief 自包含 + research 移除)
P3 ->(soft) P4   (research CLI 移除先行，P4 删 cli-research skill)
P4 ->(soft) P5   (P4 定 skill 树，P5 落实 report-issues 改名)
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
| v1.3 | 2026-09-13 | **P1 brainstorm 收敛 + P1 design v1.0 落盘**：grilling 三案定稿——**① 存量 `.superpowers/cdd/*` 工作区由「保留转只读」升格为全量删除**（gitignored 死档零 reader，破坏性重构授权下遗留即删）；**② standalone 由「并入 `cdd/<slug>`」升格为整体移除**（实证零真实派发：`.superpowers/standalone/` 从未创建、13 个历史 base-branch.json 全在 `cdd/`、finishing 正常入口必经 CDD workspace → STANDALONE_ROOT/`--scope`/`--slug` 全删、base-branch CLI 单调 `--plan`、finishing 无 artifact 推断后不落盘；`--plan`/`--slug` 并存之问 → standalone 伪功能即证删除，无内容路径/落点分裂）；**③ `--spec`/`--plan` 不并入 `--slug`**（content-bearing 文档路径 vs location-bearing 纯落点，review/fix/implement 全 content、base-branch 为唯一 artifact 命令——后者因 standalone 删除反而单调化）。overall 同步：P1 scope/acceptance 措辞更新 + P1 Design-spec 列回填（[Pending]→P1-design v1.0）+ Dependency graph P1→P3 边措辞（standalone CLI 面归 P1）+ change-history（v1.2→v1.3） | [human] · Claude Opus 5 (1M context) |
| v1.4 | 2026-09-13 | **目标架构参考补充（用户 2026-09-13）**：§brainstorming phase program 分支——`size 合适`时**若 phase scope 有变更，先 Run /osuperpowers:writing-overall-spec sync new scope/changes 到上级 overall，再 Run /osuperpowers:writing-phase-spec**（顺序定案：先 sync 后写 phase spec）（P4 brainstorm 锚点更新，与本程序 P1 无关；对 P1 design 无 scope 影响）（v1.3→v1.4） | [human] · Claude Opus 5 (1M context) |
| v1.5 | 2026-09-14 | **P1 dev shipped**（CDD 5-task 全串行闭环 + branch-review develop..HEAD APPROVED 0 findings）：workspaceRoot 单源翻转 `.superpowers/cdd`→`.osuperpowers/cdd`（engine 产物/handoff/progress/lifecycle/base-branch/report-target 全落新根）+ 全 literal 迁移（13 测试文件 + engine 源注释 + 7 skills/docs + smoke-cdd + gitignore）；standalone 整体移除（`cdd base-branch` 单调 `--plan`、STANDALONE_ROOT/`--scope`/`--slug` 全删、finishing read-base 无 artifact 推断不落盘）；存量旧根死档全量删除（`.superpowers/` 仅存 `sdd/`）；stale-lexicon 守卫 `.superpowers/cdd`/`standalone` 防回渗 + sdd 放行；changeset cdd-engine minor（p1-cdd-runtime-layout-singleton）；**F13 closeout 检查点执行**（P1 Phase inventory plan 列回填 [Pending]→Done + closeout 行声明）（v1.4→v1.5） | [human] · Claude Opus 5 (1M context) |
| v1.6 | 2026-09-14 | **writing-plans design 回填步骤（用户 2026-09-14 补充，与 P2 scope 无关）**：目标 skills 架构参考 §writing-plans 增一步——**plan 过程中若发现 design 存在实质性偏移（事实性错误 / 缺失约束 / 需新增实施步骤）→ 先回填 design spec（修订 + 记录该偏移），令 spec 与 plan 一致后再进入 plan-review**；涉跨 phase 事项仍按 Boundary rules 回填本 overall。固化 P2 plan 阶段实况：写 plan 时发现 P2 design §2.3 缺「新 overall canonical 列归一」要求（overall-consistency ① 回填声明 ↔ 列字面等价）→ 当场补注 design spec（v1.5→v1.6） | [human] · Claude Opus 5 (1M context) |