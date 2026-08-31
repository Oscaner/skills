# 技能 digraph 重构 + 引擎修复 + 文档迁移 — Overall Spec

- **Version**: v1.23 · 2026-08-30
- **Status**: Approved
- **Author**: [human] · Claude Opus 4.8 (osuperpowers:brainstorming dogfood session)
- **Constraints**:
  - 允许破坏性更新，确保最佳实践，不留技术债务（用户指令）
  - 仓库语言政策：SKILL.md / docs 英文主源 + zh-CN 镜像；本 spec 及 phase spec 中文（Strategy B）
  - 不 commit 除非用户明确要求；changeset 仅在 P10 统一建（程序级豁免，见 Cross-cutting constraints）
  - vendored 子模块不可改（#173 上游 bash 脚本不动）

---

## Document scope

Charter only — no implementation detail。

- **Overall approval is not equivalent to any phase started**（GATE）。
- Deviations update here first, then sync to overall。

## File paths

One program date + feature slug under `docs/superpowers/`：

| Artifact | Path |
|---|---|
| Overall | `specs/2026-08-24-skill-digraph-refactor-overall.md` |
| Phase spec | `specs/2026-08-24-skill-digraph-refactor-<phase-id>-design.md` |
| Phase plan | `plans/2026-08-24-skill-digraph-refactor-<phase-id>.md` |
| Phase tickets | `tickets/2026-08-24-skill-digraph-refactor-<phase-id>-tickets.md` |

`<phase-id>` 小写（`p1` … `p10`）。

---

## Program charter

将 osuperpowers 全部编排技能重写为**节点锚定式**（digraph 为唯一控制流真相源：图节点即正文小节，每节点固定 Do/Read/Exit/Fail 四要素），消灭 HARD-GATE 十步清单 + Rules 散文 + Red Flags 的规则汤三重表示；同时落地三个 dogfood issue 修复、迁移技能共用文档至技能目录（并解散 subagent-lifecycle 文档——Fresh/Concurrent 规则随 CLI 模式消亡，Delegate Load Failure 溶入节点 Fail 字段）、删除孤儿/退役技能（cli-task、debugging、verification），并新增维护者规范文档。

Non-goals：
- 不改上游 vendored 仓库（superpowers / mattpocock-skills）；#173 的上游 bash 修复另走 upstream PR，不在本程序内。
- 除 #173/#169 明确修复外，不改引擎其他行为语义（输出契约与退出码不变；#168 不改引擎钉死的 D5a severity 契约）。
- 不动 osuperpowers-router 的触发路由结构本身（仅随技能删除清理对应条目）。
- init 的 harness/spor 两分支内嵌内容保持原样（legacy 内容豁免——外层分派成图达标即可；豁免规则写入 skill-authoring.md）。

Cross-cutting constraints：
- 重构触及的每个 SKILL.md 必须符合 `docs/maintainers/skill-authoring.md` 规范（P3 产出）。
- **block 政策（全局约束）**：所有带 Read-Upstream 规则的技能（brainstorming / writing-plans / finishing），上游基线缺失一律为显式 BLOCKED 节点（含安装指引）——不降级、不静默 fallback；**扩展至 Read Sub-Skills**：子技能（grilling / to-tickets 等）加载失败同样为 BLOCKED（含安装指引）；P4/P5/P6 各自落实
- **路径解析 harness-agnostic（全局约束）**：P4–P9 所有 Read-Upstream / Read Sub-Skills 的路径解析使用 harness-agnostic 描述（解析策略：① harness plugin 系统定位 sibling plugin；② 回退 vendored 路径）——不写 `$CLAUDE_PLUGIN_ROOT` 等 harness-specific 变量
- **行数限制策略（全局约束）**：per-file 行数守卫（`skills/*/SKILL.md <= 200`、`templates/cdd/* <= 60`）在 P4 删除——节点锚定式天然约束粒度，硬上限迫使作者为凑数字牺牲清晰度。tier 预算（tier1/tier2）保留；P10 全部重写完成后重新实测 tier 预算值（~120% of 实测值）。
- 所有被删符号全仓 grep 归零（含 .agents/ 由 emit 再生保证）。
- 每 phase 收尾 `pnpm run emit && pnpm run validate` 绿。
- **changeset 策略：仅 P10 统一建一个 changeset**（各 phase 不建）——本程序为单一原子重构，逐 phase changeset 会产生无意义的中间版本语义；此为对仓库 CLAUDE.md「每 feature 完成后建 changeset」规则的程序级豁免，豁免依据即本行。

---

## Issue inventory

| Phase | Issue (ref) | Title summary |
|---|---|---|
| P1 | [#173](https://github.com/Oscaner/skills/issues/173) | 工作区解析跟随 plan 文件路径而非 cwd（自家 Node 引擎同源 bug 修复） |
| P1 | [#169](https://github.com/Oscaner/skills/issues/169) | 删除 cdd-review.mjs 的 --prompt 参数，强制 --template 唯一入口 |
| P7 | [#136](https://github.com/Oscaner/skills/issues/136) | report-issue Rule: Automatic Labels 硬编码 osuperpowers-router，应按受影响组件选择 osuperpowers / osuperpowers-router（**P7 提前消费 fix：Failure Modes recovery label 使用组件分类后的 `osuperpowers`**；P9 完成引擎层面修复） |
| P8 | [#168](https://github.com/Oscaner/skills/issues/168) | deferred 处置门：final review 前询问用户是否修复累积 warn/nit（原 executing-plans 已删，落点改为 cli-driven-development 重构内的决策节点） |
| P8 | [#181](https://github.com/Oscaner/skills/issues/181) | CDD dispatch 失败：嵌套 CLI stdout 不可靠 + orchestrator 不读 handoff + task-review 被跳过 + branch-review 无持久化 |
| P8 | [#185](https://github.com/Oscaner/skills/issues/185) | brief.mjs --task N 命名空间与 CDD task 索引冲突——plan Task 数量 > CDD task 时 brief 错误（P7 dogfood 发现） |
| P8 | [#186](https://github.com/Oscaner/skills/issues/186) | 嵌套 CLI implement 写 handoff commits.head SHA 格式不一致（7-char vs 40-char），触发 commit-contract BLOCKED（P7 dogfood 发现） |
| P8 | [#187](https://github.com/Oscaner/skills/issues/187) | 嵌套 CLI implement 写 handoff status=DONE（非 APPROVED），违反 CDD 状态机契约（P7 dogfood 发现）——**P10 完成引擎层修复（fix 模式 re-review 也统一 APPROVED）** |
| P10 | [#190](https://github.com/Oscaner/skills/issues/190) | osuperpowers engine CLI 在分发通道下不可经 PATH 调用，流程节点误当 PATH 命令 |
| P10 | [#144](https://github.com/Oscaner/skills/issues/144) | cdd SKILL 未定义 engine 失败/阻塞时的恢复路径，controller 直接绕过 engine 手写实现 |
| P10 | [#145](https://github.com/Oscaner/skills/issues/145) | cdd: 全流程零使用 --mode fix，所有 deferred fix 由 controller 手写绕过 engine |
| P11 | [#144-research](https://github.com/Oscaner/skills/issues/144) | 以 mattpocock-skills:research 为基线，实现 cli 模式的 research（engine `--mode research` + brainstorming 集成） |
| P14 | [process-improvement](https://github.com/Oscaner/skills/issues/144) | brainstorming 流程调优：将「新增 phase 流程规范」固化进 skill 本身（sync-overall 节点 + add-phase 子图 + grilling 纪律），消费者不再犯「先 grilling 后落 overall」错误 |

---

## Phase inventory

| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |
|---|---|---|---|---|---|---|
| P1 | engine-fixes：#173 workspace 解析改从 plan 目录取仓库根并显式下传 repoRoot；#169 删 --prompt；删 cli-task 孤儿技能及引用 | Pending | Pending | ① 回归测试：cwd 在仓库 B、plan 在仓库 A → workspace 落于 `A/.superpowers/cdd/<slug>/`；② `resolveWorkspace`/`findSuperpowersScriptsDir`/`relpathFromRepo` 不再从 cwd 取根；③ cdd-review.mjs 无 `--prompt` 分支/校验/usage，全仓引用归零；④ cli-task 目录删除，README/GEMINI/cli-select description/controller-handoff 提及清理；⑤ validate 绿 | P1 -> P3 |
| P2 | remove-retired-skills：删 debugging + verification 技能；清 router 映射（overrides.manifest.json / prompt-expansion.mjs / cursor-detect.mjs 经 emit 再生）；README 路由表清理；**含 init/router.md 中退役技能触发条目的清除**（legacy 豁免仅限分支内嵌正文，不含退役符号引用） | Pending | Pending | ① 两技能目录删除；② router 三处映射 + init/router.md 退役条目无残留；③ 全仓无 dangling 引用（范围同 P10 终扫定义）；④ emit 后 `.agents/` 同步消失；⑤ validate 绿 | P2 -> P3 |
| P3 | docs-infra：4 个共享文档迁入主消费者技能目录（docs-review→writing-plans，cdd-reference/controller-handoff/handoff-schema→cli-driven-development，各带 zh-CN）；解散 subagent-lifecycle（Fresh/Concurrent 随 CLI 模式消亡，Delegate Load Failure 溶入后续节点 Fail 字段）；新建 `docs/maintainers/skill-authoring.md`（节点锚定式规范，中文 Strategy B）；**同步 docs/maintainers/ 两份维护者文档（osuperpowers-plugin.md 及 zh-CN 镜像）对已迁移/解散文档的引用**；repo CLAUDE.md 增规范指引。注：技能 SKILL.md 内的 subagent-lifecycle 引用留待 P4–P9 重写自然消除（有意悬空窗口），P10 终扫兜底 | Pending | Pending | ① `packages/osuperpowers/docs/` 目录不存在；② 4 文档新家存在且链接可解析（skills/ 树内相对路径）；③ skill-authoring.md 含 Flow digraph 语义约定 / Nodes 四要素模板 / Invariants ≤5 / Failure Modes 表 / BLOCKED 终态约定 / init legacy 内容豁免规则 / 图正文一致性校验清单；④ CLAUDE.md 有指引条目；⑤ emit + validate 绿 | P3 -> P4, P3 -> P5, ..., P3 -> P9 |
| P4 | brainstorming 重构：十步流程映射为节点锚定式（research 并行子图、overall-phase 分支入 digraph）；Read-Upstream 缺失由「降级」改为 BLOCKED 终态（block 政策统一）；**加强 overall→phase 路由：digraph 含 overall-approval 后显式进入「下一 phase 的 brainstorming」节点（非 writing-plans），Next-Step Routing 规则区分「overall 批准」与「design spec 批准」两种出口**；**固化 Review 重跑纪律进 Review Stopping 相关节点（重跑仅由 blocker 驱动、循环直到 blocker=0；随 blocker 轮的 warn/nit 顺手修，单独 warn/nit 留用户决策、不触发重跑）**；**固化 spec commit 纪律进收口节点（design doc 获批即 commit）**；**Read Sub-Skills（grilling）缺失为 BLOCKED 节点（block 政策扩展）**；**路径解析 harness-agnostic** | Pending | Pending | ① 符合 skill-authoring 规范（图节点与小节一一对应、无独立 Rules 散文堆）；② 上游缺失路径为显式 BLOCKED 节点含安装指引；③ grilling 加载失败协议在 read-grilling 节点 Fail 字段→BLOCKED；④ overall→phase 路由强化在图中可见（overall 批准 → 下一个 phase 的 brainstorming，非 writing-plans）；⑤ Review 重跑纪律在图中可见（复审回边条件 = 存在 blocker，循环至 blocker=0；warn/nit 不构成回边）；⑥ spec commit 纪律在收口节点可见；⑦ zh-CN 镜像同步；⑧ emit + validate 绿；⑨ templates.test.mjs per-file 行数守卫测试删除；⑩ CDD execution: workspace 存在 + 全 task handoff.json + ledger 全 APPROVED + Final Review 产物 | P3 -> P4 |
| P5 | writing-plans 重构：三 pass review 循环回边显式入图；Review Stopping 用户门菱形化；**上游缺失为 BLOCKED 节点（Cross-cutting block 政策）**；**路径解析 harness-agnostic**；**固化 Review 重跑纪律进 Plan Review 相关节点（与 brainstorming spec-review 同规则：重跑仅由 blocker 驱动、循环直到 blocker=0；随 blocker 轮的 warn/nit 顺手修，单独 warn/nit 留用户决策、不触发重跑）**；**固化 plan commit 纪律进 commit-plan 节点（plan 获批即 commit）**；**删除 to-tickets 子技能依赖（CDD 模式下冗余：plan tasks = CDD tasks）+ 删除 Read Sub-Skills 规则 + 删除 Tickets Publish Redirect 规则** | Pending | Pending | ① 符合 skill-authoring.md v1.0（图节点与小节一一对应、无独立 Rules 散文堆、无独立 Red Flags 小节、无 Checklist）；② 上游缺失路径为显式 BLOCKED 节点含安装指引；③ 3-pass 循环回边标注 blocker found / blocker=0 / pass1 clean；④ Review 重跑纪律在 plan-review 节点可见（复审回边条件 = blocker，warn/nit 不构成回边）；⑤ plan commit 纪律在 commit-plan 节点可见；⑥ to-tickets 依赖完全移除（Rule: Read Sub-Skills + Rule: Tickets Publish Redirect + 相关 Red Flags）；⑦ zh-CN 同步；⑧ emit + validate 绿；⑨ CDD execution: workspace + handoff + ledger + Final Review | P3 -> P5 |
| P6 | finishing 重构：上游四选项流程 + Option4 typed-discard 门（字面量 "discard" 校验）+ Conventional Commits 约束压缩为 Invariant I2 + **No-Worktrees 从"前置守卫节点"改为 Invariant I1**（worktree 是开发前决策，finishing 只需声明"跳过上游 worktree 检测块与 cleanup"）+ **提取 determine-base 为共享文档** `cli-driven-development/docs/base-branch.md`（方法论 + artifact schema）+ workspace artifact `base-branch.json`（P6 产出共享文档 + finishing 的 `read-base` 节点消费 artifact（fallback 询问用户 → 写入 artifact）；P8 重构 CDD 启动阶段补自动生产 artifact）+ **merge-locally 成功后自动 `git branch -d` feature 分支**（上游原有行为，显式声明） | Pending | Pending | ① 8 操作/决策节点 + 4 BLOCKED（install superpowers / fix tests / base undecided / menu exhausted）+ 4 APPROVED 终态入 digraph（menu hub + `typed-discard?` decision）；② `typed-discard?` 节点要求字面量 `"discard"`（大小写敏感、无前后空白），非字面量输入回退 `present-menu`（共享 3 次呈现计数器）；③ No-Worktrees / Conventional Commits 在 Invariants 声明（不在节点）；④ `merge-locally` 成功后 auto `git branch -d`；⑤ `read-base` 节点消费 `base-branch.json` artifact（fallback 询问用户 → 写入 artifact）；⑥ 共享文档 `cli-driven-development/docs/base-branch.md` + `.zh-CN.md` 产出；⑦ zh-CN 同步（finishing SKILL.md）；⑧ emit + validate 绿；⑨ CDD execution: workspace + handoff + ledger + Final Review | P3 -> P6 |
| P7 | cli-select 重构：detect→ask 两操作节点线性链 + BLOCKED（engine bug）+ APPROVED 隐式终态；Failure Modes 含 report-issue recovery（P9 #136 提前消费）；跨 skill anchor `#rule-ask` → `#ask` 同步更新；**preventive fix**（overall-spec-template Issue inventory 更新规则强化 + brainstorming commit-spec 节点四表同步校验） | Pending | Pending | ① 2 节点（detect + ask）+ BLOCKED 终态（engine bug 语义）+ APPROVED 隐式终态入 digraph；② Failure Modes 表含 recovery 列（report-issue 路径 + 按组件分类的 label `bug, dogfood, osuperpowers`）；③ Invariant I1（Explicit Propagation）声明 + 禁止 skill 层与引擎层隐式 env var；④ cli-driven-development SKILL.md + .zh-CN.md 的 `#rule-ask` anchor 同步更新为 `#ask`；⑤ zh-CN 同步；⑥ **overall-spec-template Issue inventory 段含「更新触发条件」规则**；⑦ **brainstorming commit-spec 节点 Do 字段含「四表同步校验」步骤 + zh-CN 同步**；⑧ emit + validate 绿（cli-select + brainstorming 两技能衍生均同步）；⑨ CDD execution: workspace + handoff + ledger + Final Review | P3 -> P7 |
| P8 | cli-driven-development 重构：三模式链 + fix-loop ≤5 回边 + **新增 deferred-disposition 决策节点**（关闭 #168）：所有 task APPROVED 后聚合 handoff `findings[].deferred=true` 项按 task 分组呈现；用户选 fix-now / carry-skip；fix-now 走 **fix 双通道 deferred-sweep**（per-task fix + re-review）；**CDD workspace 完整性修复（关闭 #181）**：orchestrator handoff 检查义务（dispatch-mode Do 字段）+ task-review 不可跳过（task-complete? 节点）+ branch-review 持久化 diff + report（branch-review Do 字段）；**CDD engine 契约修复（关闭 #185/#186/#187，overall spec 引擎改动仅限 P1 的显式豁免）**：① brief.mjs 统一命名空间（`--task N` + `### Task N:` = CDD 级唯一索引；删 `### CDD Task N:` 命名空间）；② implement 段 status 统一 APPROVED（DONE 废除；`_handoff-write-fragment.md` + `runner.mjs` 兜底均改写）；③ handoff commits.head 统一 full 40-char SHA + `validateCommitContract` prefix 匹配兼容历史；④ `fix.md` `{{FINDINGS_SCOPE}}` 占位符 + `runner.mjs` `CDD_FINDINGS_SCOPE` env 映射 + `_handoff-write-fragment.md` fix segment 补 sweep 清理分支；**CDD 启动 determine-base 节点 + branch-review BASE 解硬编码**（消费 P6 共享文档 `cli-driven-development/docs/base-branch.md`，写 `.superpowers/cdd/<slug>/base-branch.json` artifact） | Pending | Pending | ① 节点锚定式达标；② deferred-disposition 决策节点存在且语义符合本行描述；③ blocker 行为不变（必修，不进该门）；④ fix 双通道：默认 blocker-only 行为零变化，deferred-sweep 有测试钉死（sweep 后 handoff findings[] 对应项移除）；⑤ 引用迁移后的同目录 docs（cdd-reference 等）；⑥ zh-CN 同步；⑦ emit + validate 绿；⑧ 关联 #168 **#181** **#185** **#186** **#187**；⑨ CDD execution: workspace + handoff + ledger + Final Review（**自举验证**：重写 CDD 技能时必须通过 CDD engine 执行）；**⑩ workspace 完整性：每 task 产物链（brief + handoff + report + test-evidence + review 文件）齐全，branch-review diff 持久化**；**⑪ `base-branch.json` 由 CDD 启动阶段写入，branch-review 从 artifact 读 BASE 参数**；**⑫ CDD engine 契约：brief 命名空间统一 / status 统一 APPROVED / SHA 统一 40-char / fix 双通道 scope 渲染** | P3 -> P8 |
| P9 | init + report-issue 重构 + **Cursor self-check rule 清理**：① init 参数分派成图（harness/no-param 两入口，**删除 `init router` 入口及 `router.md` 子文档**——其静态自检表是 `overrides.manifest.json`（路由 SOT）的冗余文档镜像，且已 stale）；② **清理 Cursor self-check rule**：删除 `build/generated/cursor-self-check.mdc` 生成链（`cursorSelfCheckMdc` 函数 + `scripts/emit.mjs` 调用 + `build/templates/self-check.mdc` 模板）+ 消费者侧 `.cursor/rules/osuperpowers-router.mdc` 安装指引；Cursor 的 slash 触发改为**完全靠 osuperpowers-router 的 hooks 拦截**——扩展 `cursor-detect.mjs`（源树已存在）除 SKILL attach 外**新增 bare `/<upstream-slug>` slash 拦截**（写 pending，与 Claude `UserPromptExpansion` 同语义）；③ harness.md 节点锚定式重写（删 ## Rules/## Red Flags）；④ report-issue 六步流程成图 + **#136 引擎层修复**（Automatic Labels 组件分类 `osuperpowers`/`osuperpowers-router` + `cdd`） | Pending | Pending | ① 两技能均达标；② init 三入口→两入口、`router.md` 删除；③ report-issue 的 gh 命令与模板保留原样仅组织方式变；④ #136 label 组件分类落地（非硬编码）；⑤ zh-CN 同步；⑥ Cursor self-check rule 生成链删除 + `cursor-detect.mjs` slash 拦截扩展 + 测试；⑦ `pnpm run emit && pnpm run validate` 绿；⑧ CDD execution: workspace + handoff + ledger + Final Review | P3 -> P9 |
| P10 | cdd-engine-fixes：① #190 engine CLI 不在 PATH——`package.json` bin 声明（`cdd-review`/`cdd-task`/`cdd-select`/`cdd-session-activate`）+ 所有 skill 节点调用改为 `node {pluginRoot}/bin/engine/cdd-*.mjs --harness ...` + sub-docs 同步；② #187 fix 模式 re-review 仍写 `status: DONE`——`templates/cdd/fix.md` 模板层禁止 DONE/OK/COMPLETED + `runner.mjs` validator 层归一化 DONE→APPROVED（容错历史数据）；③ #144 engine 失败恢复路径——`handoff-status` BLOCKED 出口改为 `engine-recovery` 决策节点（可修复→修复后重 dispatch；不可修复→report-issue + BLOCKED 终态）+ hard cap ≤ 2 retry + 新增 Invariant 禁止 controller 绕过 engine；④ #145 deferred fix 必须走 `--mode fix`——新增 Rule 禁止 controller 手写 fix（仅 engine 完全不可用时允许降级 + progress.md 记录原因） | Done | Pending | ① 所有 skill 节点 CLI 调用改为 `{pluginRoot}/bin/engine/` 路径；② `package.json` bin 声明就位；③ fix.md 模板禁止 DONE 状态 + validator 归一化；④ `handoff-status` BLOCKED → `engine-recovery` 决策节点入图；⑤ #145 rule 就位（禁止 controller 绕过 engine）；⑥ zh-CN 同步；⑦ emit + validate 绿；⑧ CDD execution: workspace + handoff + ledger + Final Review | P3 -> P10 |
| P11 | cli-research：新建独立 `cdd-research.mjs` CLI（不走 CDD engine），专注只读探索；CLI 基础设施从 runner.mjs 提取为 `lib/cli-shared.mjs`；新建 `cli-research` skill（节点锚定式，上游 research 基线 Read）；更新 `osuperpowers:brainstorming` 的 `explore-context` 节点——新增可选 `cdd-research.mjs` CLI 路径（保留 Agent tool 默认） | Done | Done | ① `cdd-research.mjs` 存在且 `--help` 返回 exit 0；② `lib/cli-shared.mjs` 导出 spawnCapture + invokeCli；③ runner.mjs 从 cli-shared import（外部 API 不变）；④ `lib/research.mjs` 导出 buildResearchPrompt + writeFindings；⑤ cli-research SKILL.md 节点锚定式；⑥ zh-CN 同步；⑦ brainstorming explore-context 含 CLI 路径描述；⑧ emit + validate 绿；⑨ `cdd-research.mjs` CLI 执行后 findings 文件存在且含 Markdown | P3 -> P11 |
| P12 | cli-timeout：**架构级方案（破坏性更新）**：① `cli-shared.mjs` spawnCapture 层加 timeout（SIGTERM → 5s SIGKILL → resolve timedOut:true）；② `contract.mjs` normalizeHandoffStatus 新增 TIMEOUT 合法 status；③ `runner.mjs` timeout 路径写 partial handoff（status:TIMEOUT + partial artifacts 保留）；④ orchestrator retry 路径：cli-driven-development 手动 timeout-decision 节点（timeoutCount 存 progress.md，<2 + stdout → retry，≥2 → BLOCKED:timeout-exhausted）；⑤ cli-research fail-open（research 无 retry，直接读 partial findings）；⑥ per-mode 默认值 30min + 全局 `CDD_CLI_TIMEOUT` env + per-mode env（`CDD_TASK_TIMEOUT` / `CDD_REVIEW_TIMEOUT` / `CDD_RESEARCH_TIMEOUT`，RESEARCH_TIMEOUT 重命名）；⑦ cdd-research.mjs 删除 ad-hoc watchdog → 复用 spawnCapture timeout | In Progress | Pending | ① spawnCapture timeoutMs + SIGTERM→SIGKILL fallback + `unkillable` edge case；② contract.mjs TIMEOUT status；③ runner.mjs partial handoff 写入；④ cli-driven-development TIMEOUT 出口 + timeout-decision 节点 + timeoutCount in progress.md；⑤ cli-research TIMEOUT fail-open 出口；⑥ 30min 步进 + CDD_CLI_TIMEOUT + per-mode env；⑦ cdd-research ad-hoc watchdog 删除；⑧ zh-CN 同步；⑨ emit + validate 绿；⑩ CDD execution: timeout 集成 smoke test（CDD_TASK_TIMEOUT=1 验证 TIMEOUT status + partial artifacts） | P3 -> P12 |
| P13 | closure：grep 终扫（搜索树限定 `packages/`（**排除各包 `CHANGELOG.md`**——append-only 历史不重写；**排除 `bin/engine/tests/` 中防回归断言的 `--prompt` 字面量**——P1 新增断言有意保留该 token）、`docs/`（**排除 `docs/superpowers/{specs,plans,tickets}/` 历史文档**；`docs/maintainers/` 在终扫时点应为零残留——P3 已同步其引用，若命中即 P3 缺口回修）、根 README、`marketplace/source.json`；token 模式：`osuperpowers:debugging`、`skills/debugging/`、`osuperpowers:verification`、`skills/verification/`、`cli-task`、`--prompt`、`subagent-lifecycle`、`docs/cdd-reference` 等旧 docs 路径、**旧格式关键词（`HARD-GATE`、`## Rules`、`## Red Flags`、`## Checklist`——确认所有技能已迁移到节点锚定式）** 全部归零）；统一 changeset（breaking：移除 cli-task/debugging/verification 及其触发词；feat：节点锚定式重写 + 引擎修复）；关联 issue 关闭引用落地 commit；**tier 预算 re-baseline（实测 P4-P9 重写后 tier1/tier2 值，设为 ~120%）**；**图正文一致性校验测试加入 governance（skill-authoring §8 四清单：节点覆盖 / 小节对齐 / 无 Rules 散文堆 / 无 Red Flags 小节）**；**skill-authoring.md 英文主源 + zh-CN 镜像（Strategy A）** | Done | Pending | ① 上述限定范围内 grep 终扫清单逐项为零；② changeset 含 breaking 标注；③ `pnpm run emit && pnpm run validate` 绿；④ #168/#169/#173 关闭评论附 commit；⑤ tier 预算 re-baseline 完成；⑥ 图正文一致性校验测试就位 | P4 -> P13, P5 -> P13, P6 -> P13, P7 -> P13, P8 -> P13, P9 -> P13, P10 -> P13, P11 -> P13, P12 -> P13 |
| P14 | brainstorming 流程调优（彻底重构版）：将「新增 phase 流程规范」从 overall spec 维护者约定（v1.19b Boundary rules）**作为结构性约束固化进 digraph 拓扑**——消费者在 brainstorming 中补新 phase 时不再犯「先 grilling 后落 overall / issue inventory 未同步 / 跨 phase 并行」错误。范围（破坏性更新，允许重构整体流程）：① 新增 `read-program` 决策节点（读父 overall 解析模式 `new-program` / `phase-within-program`，用户可显式提供 overall 路径，多个匹配→BLOCKED）；② 新增 `claim-phase` pre-design 决策门（phase 已在 overall Phase inventory → grilling；不在 → sync-overall）；③ 新增 `sync-overall` 节点（四表同步：Issue inventory 追加 + Phase inventory 新增 + Dependency graph 补边 + version bump + change-history，随后跑四表一致性校验）；④ `explore-context` 修订为承接 read-program 模式标记的下游节点（含 new-phase / split 检测）；⑤ grilling 纪律 Invariant I6 `Register-before-grill`（仅 grill 已登记 phase，mid-grill 拆分回 claim-phase）；⑥ 串行纪律 Invariant I7 `Serial-phase`（sync-overall 校验硬依赖 phase 的 Design spec 列 = `Done`，否则硬 BLOCKED: overall-sync-failed）；⑦ 配套 `brainstorming/docs/add-phase-protocol.md`（四表同步清单 + v1.19c 反例）。**依赖 P10/P11/P12 落定后实施**（P12 已 merge，本 phase 现已解锁）。P13 终扫须确认 P14 新增的 read-program / claim-phase / sync-overall 节点不残留旧格式 | Done | Pending | ① digraph 含 `read-program` + `claim-phase` + `sync-overall` 三节点 + `sync-overall` 回边（detect→sync→re-explore）+ `grilling → claim-phase` mid-grill 回边；② grilling 纪律在 Invariant I6 + Fail 字段；③ 串行纪律 Invariant I7 + sync-overall 硬 BLOCKED（硬依赖 phase Design spec 列 ≠ `Done`）；④ `brainstorming/docs/add-phase-protocol.md` 产出（含四表清单 + 反例 + v1.19c）；⑤ zh-CN 同步（SKILL.zh-CN.md + add-phase-protocol.zh-CN.md）；⑥ `pnpm run emit && pnpm run validate` 绿；⑦ CDD execution: workspace + handoff + ledger + Final Review | P3 -> P14, P11 -> P14, P14 -> P13 |

Scope column 仅作分解上下文；split 时以 Na/Nb 替换父行后再继续子阶段工作。

---

## Dependency graph (ASCII)

```
P1 -> P3          (硬：P3 迁移需清扫引擎注释中的旧 docs 路径，先稳定引擎)
P2 -> P3          (硬：P3 迁移一并清扫退役技能的文档引用，先完成删除)
P3 -> P4          (硬：格式规范 + 文档最终位置就绪后才开始重写)
P3 -> P5          (硬)
P3 -> P6          (硬)
P3 -> P7          (硬)
P3 -> P8          (硬)
P3 -> P9          (硬)
P4 ->(soft) P5 ->(soft) P6 ->(soft) P7 ->(soft) P8 ->(soft) P9   (软：执行顺序便利——评审校准连续性；非阻塞)
P4..P9 各自 -> P10 (硬：引擎修复先于 cli-research / timeout)
P10 -> P11 (硬：research mode 依赖 engine #190/#187 修复)
P10 -> P12 (硬：timeout 依赖 engine 基础设施稳定)
P11 -> P12 (软：research mode 同样受 timeout 约束)
P10..P12 各自 -> P13 (硬：终扫前全部落地)
P11 -> P14 (硬：P14 改 brainstorming SKILL.md，需先稳定 P11 的 explore-context CLI 改造)
P14 -> P13 (硬：终扫需确认 P14 新增节点不残留旧格式)
```

Legend:
- `->` = hard block（依赖方不得在先决方 ship 前开始）
- `-> (soft)` = suggestion only（顺序便利，非阻塞）

Sync with inventory on add/split/reorder。

---

## Boundary rules

> Each phase: full brainstorm -> plan -> dev。Shipped before dependents start。
> Requirement changes arising during a phase MUST feed back to this overall spec before implementation proceeds — version bump + change-history entry + sync affected phase acceptance/dependency。

补充约定：
- **Next-step routing（本程序级强化）：overall 批准后的下一个动作是 P1 的 brainstorming（完整 brainstorm→plan→dev 循环的起点），不是 writing-plans**——writing-plans 只属于某个 phase 内部、其 design spec 获批之后。每个 phase 都从自己的 brainstorming 开始。
- **文档 commit 纪律（程序级强化）**：brainstorming 结束（design spec 获批）与 writing-plans 结束（implementation plan 获批）这两个收口点，**各自立即 commit 一次**——前者提交 spec 文档（含 Status: Draft → Approved 变更），后者提交 plan 文档（含其间对 overall 的同步修订）。不等 dev 阶段合并提交；P4/P5 重构对应技能时把该纪律固化进 Write Design Doc / Execution Handoff 相关节点。**Status 变更包含在 commit 范围内（P5 dogfood 回写）**：spec 的 Status 字段从 Draft 改为 Approved 必须与 spec 文档同一 commit 提交——不可悬空到 CDD 阶段，否则 dirty tree 触发 commit gate BLOCKED。
- **Review 重跑纪律（程序级强化，落实 docs-review.md Review Stopping ②）**：3-pass review 的重跑**仅由 blocker 驱动**——某 pass 含 blocker → 修复 → 仅重跑该 pass → 若仍有 blocker 则重复「修复→复审」直到 blocker=0；**随 blocker 复审轮次出现的 warn/nit 可在该轮一并顺手修复**（避免已开着的复审循环再拖一轮）；**单独的 warn/nit（无 blocker 的 pass / blocker 清零后的残余）永不触发重跑**，留待 ③ 用户决策门。blocker=0 后进入 ③ 用户决策门，此后不再提供任何重跑。**适用于所有 3-pass review 场景：brainstorming 的 spec-review 与 writing-plans 的 plan-review 同规则同门**（P5 重构 writing-plans 时一并固化）。
- **CDD engine dispatch（程序级强化）**：每个 phase 的 dev 阶段**必须通过 `cdd-task.mjs` 派发嵌套 CLI session**——不直接在当前 session 手动执行 plan steps。完整链路：harness 选择（cli-select / `--harness <name>`）→ workspace 创建（`.superpowers/cdd/<slug>/`）→ task brief 生成（`generateBrief`）→ `cdd-task.mjs --harness <name> --task N --mode implement` → handoff JSON → task-review → fix（如需）→ ledger append（仅 APPROVED）→ Final Review（branch-review HARD-GATE）。违反此约束（如手动执行 plan steps）视为流程违规。**Orchestrator handoff 检查义务（P5 dogfood 回写）**：cdd-task.mjs 返回后，orchestrator **必须读取 handoff.json 判断状态**（APPROVED / BLOCKED / CHANGES_REQUESTED），不可凭 stdout 是否为空判断是否有变更——嵌套 CLI stdout 在当前环境下可能为空但文件变更已发生。BLOCKED 时须读取 blocker 字段并处理（如 dirty tree → 先 commit 再重试），不可绕过 handoff 直接 fallback 到 in-session 编辑。**P8 修复目标**：嵌套 CLI stdout 不可靠问题在 P8（cli-driven-development 重构）中作为引擎层面修复。**base 分支 artifact 化（P6 产出 / P8 消费）**：CDD 启动阶段跑 determine-base 并写入 workspace artifact `base-branch.json`（消费 P6 产出的共享文档 `cli-driven-development/docs/base-branch.md` 的方法论 + schema）；branch-review 的 `BASE` 参数改为读 artifact（移除 `origin/develop` 硬编码）；finishing 的 `read-base` 节点消费同一 artifact（standalone finishing 场景下 fallback 询问用户 → 写入 artifact）。
- **CLI background execution（程序级强化）**：所有 CLI mode 调用（`cdd-task.mjs`、`cdd-review.mjs`）**必须以 background 方式运行**——CLI session 完成时间不可控（秒级到分钟级），前台阻塞会浪费主 session 的可用时间。当 harness 支持 background shell execution 时（如 Claude Code 的 `run_in_background` 模式），CLI 调用立即返回 task ID，主 session 继续其他工作或等待通知；当 harness 不支持 background 时，使用超时机制并轮询输出。**适用于所有 CLI 调用场景**：brainstorming spec-review（3 pass）、writing-plans plan-review（3 pass）、CDD implement/task-review/fix/branch-review。P4–P9 重构对应技能时将 background execution 固化进调用节点的 Do 字段。
- **report-issue label 组件分类（程序级强化，#136 fix 提前消费）**：P4–P9 各 phase 重写技能时，若 Failure Modes 表含 report-issue recovery 路径，**label 必须按受影响组件分类**（非硬编码 `osuperpowers-router`）：① 组件在 `packages/osuperpowers/` → label `osuperpowers`；② 组件在 `packages/osuperpowers-router/`（hooks / overrides manifest / prompt-expansion / cursor hooks）→ label `osuperpowers-router`；③ 跨插件 / 无法确定 → 询问用户或默认 `osuperpowers`。CDD 相关 issue 追加 `cdd` label。P9 完成 #136 引擎层面修复（report-issue Rule: Automatic Labels 改为组件分类逻辑）后，该约定成为技能层硬约束；P7 为首个按此约定产出的 phase（提前消费）。
- 每个 phase spec 是一次完整 brainstorm→plan→dev 循环的产物；仅 overall 批准直接实施、或 overall 批准后直接进 writing-plans 均属违规。
- P4–P9 共用 P3 的 skill-authoring.md 作为唯一格式权威；重构中若发现规范缺口，先改规范（P3 文档）再改技能。
- 引擎代码改动仅限 P1；**例外（路径字符串豁免）**：P3 允许对引擎、模板及**消费者技能 SKILL.md** 做「仅文档链接/路径字符串」的编辑（迁移后旧 `../docs/*` 引用改指新家），行为正文仍留待各技能重构 phase。
- 破坏性变更（删技能/删参数/block 政策）允许，但必须反映在 P13 changeset 的 breaking 标注中。
- **新增 phase 流程规范（程序级强化，v1.19 补强）**：当发现需要新增 phase 时（如用户列出新 issue 集合 / 新功能需求），**必须按以下顺序同步 overall spec**，且四表同步校验（与 P7 preventive fix 同源）：① **立即更新 Issue inventory**——新 issue 一旦发现即登记（Phase 列填目标 phase，未定则 `TBD` 并跟进）；② **更新 Phase inventory**——新增 phase 行（含 scope / design spec / plan / acceptance / dependency）；③ **更新 Dependency graph**——补硬/软依赖边；④ **version bump + change-history entry**——记录新增原因 + 用户决策 + 范围边界。⑤ **禁止**先在对话中讨论新 phase 设计细节（grilling）而不先同步 overall spec——overall 是单一真源（SOT），任何 phase 范围变更必须先落 overall 再进入该 phase 的 brainstorm。⑥ 新 phase 仍走完整 **brainstorm→plan→dev** 循环（从 own brainstorming 开始，非 writing-plans 直接进）；不允许"批量写 design spec"跳过 per-phase grilling。
- **串行 phase 纪律（程序级强化，v1.19c 补强）**：**同一时刻仅一个 phase 处于活跃 brainstorm→plan→dev 循环**。前置 phase 未走完（design spec + plan + CDD dev + merge）不得启动下一个 phase 的 brainstorm——更不得跨 phase 并行展开多个 phase 的 design spec 撰写 / review。**硬依赖链即序列化顺序**：P10 → P11 → P12 → P14 → P13 必须严格先后，任一 phase 的 design/plan/dev 在其所有硬依赖 phase merge 前不得启动。v1.19c 实时反例：P10 仅完成 design spec 时本 session 已错误并行展开 P14 design spec + 3-pass review——同时违反「串行纪律」与「先落 overall 后 grilling」，该 P14 design 文件已删除标记为 stale，待 P10-P12 ship 后重建。

---

## Maintenance

- Update links + change history per phase; no task lists。
- Master spec for cross-phase conventions; phase specs incremental。
- Strategy shifts and splits feed back **immediately**（sync to overall）。

---

## Change history

Append-only：

- v1.0 · 2026-08-24 — 初版：10 phase 分解、3 issue 映射、依赖图定稿（dogfood session，grilling 决策：block 政策统一 5→3 个 Read-Upstream 技能；cli-task/debugging/verification 删除；subagent-lifecycle 解散；只修自家 Node 引擎；deferred 处置门放 Final Review 前用户询问）。
- v1.1 · 2026-08-24 — 用户审阅反馈：新增程序级 Next-step routing 强化——overall 批准后下一步是 P1 的 brainstorming 而非 writing-plans（Boundary rules 补充约定 + P4 验收 ④：brainstorming 重构时在 digraph 与 Next-Step Routing 规则中固化该路由，区分「overall 批准」与「design spec 批准」两种出口）。
- v1.2 · 2026-08-24 — 用户纠偏（dogfood 过程发现）：P1 spec review Pass 1 被 warn/nit 连带触发重跑共 4 轮，违反 Review Stopping ②「仅 blocker 触发复审」。新增 Boundary rules「Review 重跑纪律」：重跑仅由 blocker 驱动、修复复审循环直到 blocker=0（不限次数）；随 blocker 复审轮出现的 warn/nit 可顺手一并修，单独的 warn/nit 永不触发重跑、留待用户决策门；P4 重构 brainstorming 技能时将本纪律一并固化进 Review Stopping 相关节点。
- v1.3 · 2026-08-24 — P1 design spec 获批后用户补充：Review 重跑纪律明确适用于所有 3-pass review 场景——writing-plans 的 plan-review 与 brainstorming 的 spec-review 同规则同门；P5 scope/验收同步扩展（Plan Review 相关节点固化该纪律）。
- v1.4 · 2026-08-24 — 用户补充：文档 commit 纪律——brainstorming 结束（spec 获批）与 writing-plans 结束（plan 获批）各自立即 commit（spec 一次、plan 一次，含 overall 同步修订），不等 dev 合并；P4/P5 验收扩展固化该纪律进收口节点。本程序即时生效：P1 spec+plan 于进入 dev 前补 commit。
- v1.5 · 2026-08-25 — P1 执行回顾（report-issue dogfood）：① fix 模式双通道扩展定案并入 P8——`fix.md` 加 `{{FINDINGS_SCOPE}}` 占位符（blocker-only 默认 / deferred-sweep 显式 opt-in），否决 fix-blocker/fix-no-blocker 双文件拆分候选；deferred-disposition 门选修复时走 sweep 通道，与 #168 闭环。② 执行缺陷分流：task-review commit-gate 误判已报 #175；agent 越界提交（T3 替 T4 commit）超出本程序范围另报 issue；嵌套 CLI 无超时已有 #137。
- v1.6 · 2026-08-26 — P4 brainstorming dogfood 回写（6 项）：① block 政策扩展——从 Read-Upstream 延伸到 Read Sub-Skills（grilling/to-tickets 缺失同为 BLOCKED）；② 路径解析 harness-agnostic——不写 `$CLAUDE_PLUGIN_ROOT` 等 harness-specific 变量，用 harness plugin 系统定位 + vendored 回退策略；③ per-file 行数守卫删除——`skills/*/SKILL.md <= 200` 和 `templates/cdd/* <= 60` 在 P4 移除（节点锚定式天然约束粒度），tier 预算保留；④ P10 终扫 pattern 扩展——旧格式关键词（`HARD-GATE`/`## Rules`/`## Red Flags`/`## Checklist`）确认节点锚定式迁移完整；⑤ P10 图正文一致性校验测试加入 governance（skill-authoring §8 四清单）；⑥ P10 tier 预算 re-baseline（P4-P9 完成后实测 ~120%）。
- v1.7 · 2026-08-26 — P4 执行偏离回写（CDD engine dispatch 强制约束）：P4 dev 阶段未通过 `cdd-task.mjs` 派发嵌套 CLI session，直接在当前 session 手动执行 plan steps——违反 cli-driven-development Rule: Three-Mode Chain。新增 Boundary rule「CDD engine dispatch」：每个 phase 的 dev 阶段必须走 cdd-task.mjs 完整链路（harness 选择 → workspace → brief → implement → handoff → task-review → fix → ledger → Final Review）。P4-P9 各 phase 验收追加 ⑩/⑨/⑥/⑤/⑨/⑤ CDD execution 产物检查（workspace + handoff + ledger + Final Review）。P8 追加自举验证标注（重写 CDD 技能时必须通过 CDD engine 执行）。
- v1.8 · 2026-08-27 — P5 brainstorming 回写（to-tickets 删除）：P5 grilling 发现 to-tickets 在 CDD 模式下冗余（plan tasks = CDD tasks，CDD engine 直接消费 plan task 结构，不需要独立的 ticket 发布步骤）。P5 scope 移除三项：to-tickets 条件节点、Read Sub-Skills 规则、Tickets Publish Redirect 规则。P5 验收标准重写（9 项）：移除 ② tickets publish 重定向入图 + ④ to-tickets 缺失为 BLOCKED，新增 ⑥ to-tickets 依赖完全移除 + ① skill-authoring v1.0 合规性。block 政策全局约束仅保留 Read-Upstream（不再扩展到 P5 的 Read Sub-Skills，因 P5 已无子技能依赖）。
- v1.9 · 2026-08-27 — CLI background execution 强制约束：P5 spec review 发现 cdd-review.mjs CLI 调用前台阻塞导致主 session 浪费时间（CLI session 完成时间不可控，秒级到分钟级）。新增 Boundary rule「CLI background execution」：所有 CLI mode 调用（cdd-task.mjs / cdd-review.mjs）必须以 background 方式运行——harness 支持时用 run_in_background 模式，不支持时用超时+轮询。适用于所有 CLI 调用场景（spec-review / plan-review / implement / task-review / fix / branch-review）。P4–P9 重构时将 background execution 固化进调用节点的 Do 字段。
- v1.10 · 2026-08-27 — CDD dispatch 失败根因回写（P5 dogfood）：P5 dev 阶段再次 fallback 到 in-session 编辑（与 P4 同类问题）。根因分析发现 3 个缺陷：① 嵌套 CLI stdout 在当前环境下可能为空但文件变更已发生——orchestrator 凭 stdout 判断有无变更是错误的；② Task 1 commit gate 因 brainstorming 阶段悬空的 spec Status 变更（Draft→Approved 未 commit）触发 BLOCKED；③ orchestrator 未读取 handoff.json 状态即 fallback 到 in-session。修复：CDD dispatch rule 新增「orchestrator handoff 检查义务」——cdd-task.mjs 返回后必须读 handoff.json 判断状态，BLOCKED 时处理 blocker 而非绕过；commit discipline rule 新增「Status 变更包含在 commit 范围内」。P8 标记为嵌套 CLI stdout 不可靠的引擎层面修复目标。
- v1.11 · 2026-08-27 — P6 brainstorming 回写（3 项）：① No-Worktrees 从"前置守卫节点"改为 Invariant I1（worktree 是开发前决策，finishing 只需声明"跳过上游 worktree 检测块与 cleanup"，不需要节点）；② merge-locally 成功后自动删除 feature 分支（上游原有行为，当前 osuperpowers 未显式声明），纳入 P6 验收；③ determine-base 提取为共享文档（`cli-driven-development/docs/base-branch.md`）+ workspace artifact（`base-branch.json`），P6 新增 `read-base` 节点消费 artifact（fallback 询问用户），P8 追加 CDD 启动 determine-base + branch-review BASE 参数解硬编码（P8 验收追加 ⑪）。
- v1.12 · 2026-08-27 — P7 brainstorming 回写（3 项）：① cli-select BLOCKED 语义明确为"engine bug"（orchestrator 宿主 harness 必然存在；`available=0` 或引擎脚本执行失败均为 bug 信号，非用户侧缺失）；② Failure Modes 表扩展 recovery 列——固化 `osuperpowers:report-issue` 上报路径为 BLOCKED 标准恢复操作（P5/P6 dogfood 闭环模式正式纳入 P7）；③ report-issue label 组件分类规则提前消费 #136 fix——P7 recovery label 使用组件分类后的 `osuperpowers`（非硬编码 `osuperpowers-router`），新增 Boundary rule「report-issue label 组件分类」。
- v1.13 · 2026-08-27 — P7 plan 审阅反馈：Issue inventory 表补充 #136 行（P7 提前消费 fix 的归属条目）；v1.12 仅新增 Boundary rule 未同步 inventory，本版本补齐。
- v1.14 · 2026-08-27 — P7 plan review 用户反馈（preventive fix）：P7 scope 新增「preventive fix」——overall-spec-template Issue inventory 段强化更新触发条件规则（发现新 issue / 提前消费其他 phase issue 时必须同步 inventory + version bump + change history）；brainstorming commit-spec 节点 Do 字段新增 commit 前四表同步校验（Issue inventory / Phase inventory / Dependency graph / Change history）。P7 验收追加 ⑥⑦；P7 行 scope + 验收同步扩展。
- v1.15 · 2026-08-27 — P7 CDD dogfood 回写（3 项新 issue 归 P8）：① #185 brief.mjs --task N 命名空间与 CDD task 索引冲突；② #186 嵌套 CLI implement 写 handoff commits.head SHA 格式不一致（7-char vs 40-char）；③ #187 嵌套 CLI implement 写 handoff status=DONE（非 APPROVED）。三 issue 均为 CDD engine 契约缺口，归 P8（cli-driven-development 重构）统一修复。
- v1.16 · 2026-08-27 — P8 brainstorming 回写（5 项）：① P8 一并修引擎（#185/#186/#187）+ 完全统一命名空间（`--task N` + `### Task N:` = CDD 级唯一索引，删 `### CDD Task N:`）+ implement 段 status 统一 APPROVED（DONE 废除）+ commits.head 统一 full SHA + validator prefix 兼容；② deferred-disposition 落实为 digraph 中的独立决策节点（聚合呈现 + 用户选 fix-now/carry-skip；fix-now 走 deferred-sweep 通道 per-task）；③ CDD workspace 完整性纪律嵌入节点 Do 字段（非 Invariant）：handoff 检查义务 → dispatch-mode Do / task-review 不可跳过 → task-complete? 节点 / branch-review 持久化 → branch-review Do；④ determine-base 作为独立启动节点（select-harness → determine-base → dispatch-mode）+ 写 `base-branch.json` artifact；branch-review BASE 参数从 artifact 读（移除 `origin/develop` 硬编码）；⑤ P8 引擎改动豁免 overall spec「引擎代码改动仅限 P1」约束——豁免依据：P7 dogfood 发现的 3 个引擎契约缺口 + #168 fix 双通道所需的 runner 层 scope 渲染（限契约层，不改控制流）。
- v1.17 · 2026-08-27 — P9 brainstorming 回写（init router 删除）：P9 删除 `init router` 入口及其 `router.md` 子文档——其写入项目的静态「superpowers 触发自检表」是 `packages/osuperpowers-router/overrides.manifest.json`（路由 SOT，hooks 实际执行拦截/路由）的冗余文档镜像，且已 stale（仍 remap `/subagent-driven-development → cli-driven-development` 的 P8 改名未同步）。删除不损失任何路由行为（hooks 仍按 manifest SOT 执行）；init 改两入口（harness / no-param）分派成图；harness.md 节点锚定式重写（删 ## Rules/## Red Flags）；P9 scope/验收同步更新（三入口→两入口、`router.md` 删除）。
- v1.18 · 2026-08-27 — P9 范围扩大（Cursor self-check rule 清理 + hooks 拦 slash）：用户决策——删除 `init router` 后**连带清理 Cursor self-check rule**（`.cursor/rules/osuperpowers-router.mdc`）。
- v1.19 · 2026-08-28 — 新增 P10/P11/P12（原 P10 closure renumber 为 P13）。用户决策：① #144/#187/#190/#145 合并为 P10（CDD engine bug fixes）；② 新增 P11（cli-research：mattpocock-skills:research 基线 + engine `--mode research` + brainstorming 集成）；③ 新增 P12（cli-timeout：harness 终止长任务 CLI 的架构级方案，推迟到本 phase 统一设计）；④ #145 纳入 P10（deferred fix 必须走 engine）；⑤ timeout 合并到 P10（runner.mjs 改动）+ P11（research mode timeout），不单独成 phase。各 phase 仍走完整 brainstorm→plan→dev 循环。
- v1.19b · 2026-08-28 — 补强「新增 phase 流程规范」（Boundary rules 新增条目）：① Issue inventory 必须立即更新（新 issue 发现即登记）；② Phase inventory / Dependency graph / version bump + change-history 四表同步；③ 禁止先 grilling 后落 overall（overall 是 SOT，先落再 brainstorm）；④ 新 phase 仍走完整 per-phase brainstorm→plan→dev，不允许批量写 spec 跳过 grilling。用户反馈：补新 phase 时 issue 列表未同步 + overall+phase 流程规范需加强。
- v1.19c · 2026-08-28 — 新增 P14（brainstorming 流程调优）：将「新增 phase 流程规范」从 overall spec 维护者约定（v1.19b）**固化进 skill 本身**——消费者在 brainstorming 中补新 phase 时不再犯「先 grilling 后落 overall / issue inventory 未同步」错误。范围：扩展 `explore-context` 节点加 pre-design 决策门 + 新增 `sync-overall` 节点 + `add-phase` 子图 + grilling 纪律强化 + `add-phase-protocol.md` 参考文档。用户指令："你需要加新的 phase 对 brainstorming 的 overall + phase 流程进行调优，能够让消费者不会再犯刚刚同样的错误"。P14 依赖 P11 落定（改同一 SKILL.md），终扫前落地。
- v1.19c-correction · 2026-08-28 — **严重违规记录 + 串行纪律补强**：写 v1.19c 时 P10 仅完成 design spec（未走完 plan→dev→merge），本 session 即错误并行展开 P14 design spec 撰写 + 3-pass review——同时违反「串行 phase 纪律」与「先落 overall 后 grilling」。已处置：① 删除非法超前 P14 design 文件（标记 stale 待 P10-P12 ship 后重建）；② P14 phase 行补「⚠️ 实时反例」段 + 验收③钉死「写 spec 时不得跨 phase 并行」；③ Boundary rules 新增「串行 phase 纪律」条目（同一时刻仅一个 phase 活跃；硬依赖链 P10→P11→P12→P14→P13 严格序列化）。该违规本身就是 P14 要消灭的反模式，故成为 P14 的核心验收案例。调查发现该 rule 实为 Cursor 的 slash 触发**主要拦截手段**（router 的 `cursor-detect.mjs` 仅拦 SKILL attach、bare slash 不写 pending，测试 line 90 印证），删 rule 后必须由 hooks 接管 slash。方案：① 删 `cursorSelfCheckMdc` 生成链（`scripts/emit.mjs` 调用 + `build/templates/self-check.mdc` 模板 + `build/generated/cursor-self-check.mdc` 产物）；② 扩展已存在的 `cursor-detect.mjs` 新增 bare `/<upstream-slug>` slash 拦截（写 pending，与 Claude `UserPromptExpansion` 同语义）；③ 更新 `cross-harness-overrides.md` 等大段描述该 rule 的文档。此偏离超出 overall 原「仅删 router 入口」约束，且触及引擎代码（cursor-detect.mjs），但与用户「完全靠 osuperpowers-router hooks」指令一致——视为本程序对「文档镜像 drift」根因的彻底消除。P9 scope/验收同步扩展（⑥ Cursor rule 清理 + slash 拦截扩展 + 测试）。
- v1.20 · 2026-08-28 — P11 brainstorming 设计决策回写：① Research 不走 CDD engine（`cdd-task.mjs`），改为新建独立 `cdd-research.mjs` CLI——理由：单一职责（CDD engine 只管代码变更）、无 CDD 基建过载（不需要 workspace/handoff/commit-gate）、可演进（research 不受 CDD per-task 模型限制）；② CLI 基础设施从 runner.mjs 提取为 `lib/cli-shared.mjs`（spawnCapture + invokeCli）；③ findings 输出契约：调用方在 brief 里指定路径，engine 不强制；④ explore-context 集成：保留 Agent tool 默认 + 新增可选 CLI 路径（已知 harness 时）；⑤ cli-research skill 轻量线性链 + 上游 research 基线 Read。偏离 overall P11 scope 描述（原为扩展 cdd-task.mjs），待 P11 ship 后更新 overall。
- v1.21 · 2026-08-29 — P12 brainstorming 设计决策回写：① spawnCapture 层 timeout（SIGTERM→5s SIGKILL，SIGKILL_DELAY_MS 硬编码常量）；② 新增 TIMEOUT status（backward-compatible JSON 枚举扩展）；③ partial handoff 契约（timeout 时 runner.mjs 写 status:TIMEOUT + partial artifacts，CLI 被 kill 无法写 fragment）；④ orchestrator retry 路径：timeout-decision 节点，timeoutCount 存 progress.md（复用 engine-recovery-count 模式），<2 + stdout → retry，≥2 → BLOCKED:timeout-exhausted（新增终端节点）；⑤ cli-research fail-open（research 为可选增强，第一次 timeout 即 fail-open，不 retry）；⑥ per-mode 默认值 30min + 全局 `CDD_CLI_TIMEOUT` + per-mode env（新增；`RESEARCH_TIMEOUT` 重命名为 `CDD_RESEARCH_TIMEOUT`）；⑦ cdd-research.mjs 删除 ad-hoc watchdog → 复用 spawnCapture timeout；⑧ SIGKILL zombie edge case → BLOCKED:process unkillable（独立恢复路径）。偏离 overall P12 scope（原描述 runner.mjs 层 timeout → 实际 spawnCapture 层更彻底；删除 harness background 能力调研——属于跨 harness 规范化，超出本程序范围）。
- v1.22 · 2026-08-29 — P14 design 四表同步（P14 自身即 sync-overall 的规范消费者）：① overall 版本 bump v1.21→v1.22；② P14 phase 行重写为彻底重构版（新增 read-program / claim-phase / sync-overall 三节点 + Invariant I6 Register-before-grill + Invariant I7 Serial-phase；Design spec 列标记 `Done`，因 P12 已 merge、P14 设计已获批）；③ Dependency graph 不变（P11→P14、P14→P13 硬边维持）；④ 本 change-history 条目追加。P14 scope 从原「explore-context 内加决策门」升级为「digraph 拓扑级结构闸门」（grilling 仅能从 claim-phase 到达），与 P14 design spec v1.0 一致。
- v1.23 · 2026-08-30 — P13 design 四表同步：① overall 版本 bump v1.22→v1.23；② P13 Design spec 列标记 `Done`；③ P13 scope 扩展（用户决策）：删除 `docs/research/` 全目录 + skill-authoring.md 英文主源转换 + CLAUDE.md 语言架构更新；④ 新增 skill-authoring.md Strategy A 转换为 P13 scope 项（因 governance 测试引用该文档，需英文 source of truth）；⑤ 本 change-history 条目追加。
