# Session Report #246 收尾批次 — Overall Spec

- **Version**: v1.16 · 2026-09-12
- **Status**: Draft
- **Author**: [human] · Claude Opus 5 (1M context) (osuperpowers:brainstorming)
- **Constraints**:
  - 仓库语言政策：SKILL.md / docs 英文主源；本 spec 中文（Strategy B）
  - 不 commit 除非用户明确要求；changeset 逐 phase 建
  - vendored 子模块不可改
  - 所有改动须通过 `pnpm run validate`

---

## Document scope

Charter only — no implementation detail。

- **Overall approval is not equivalent to any phase started**（GATE）。
- Deviations update here first, then sync to overall。

---

## File paths

单批次固定 date + slug 于 `docs/superpowers/`：

| Artifact | Path |
|---|---|
| Overall | `specs/2026-09-10-session-report-246-overall.md` |
| Phase spec | `specs/2026-09-10-session-report-246-<phase-id>-design.md` |
| Phase plan | `plans/2026-09-10-session-report-246-<phase-id>.md` |

`<phase-id>` 小写（`p1`, `p2`, …）。Inventory 列在文件落盘后链入。

---

## Program charter

结算独立 standalone 会话报告 issue #246（[Session report] standalone 2026-09-10）的全部 finding：cdd-engine 运行与审查生命周期（子进程回收 / 演进重审 / fix 规则一致性 / 四表机械守卫）、CDD 编排硬化（artifact 写入口 / brief 内建）、report-issue 会话归属与撰稿品质、submodule-bump workflow 精简。本批次是修复收尾程序：每条 finding 均已确认，无其他悬留决策；唯一待拍板项（cdd fix 模式存续）由 P3 的 phase brainstorm 拍板并记账回本 overall。

**Non-goals**：不修改 vendored 子模块（superpowers / mattpocock-skills / impeccable）；不演进存量两个 overall program（post-dogfood-bugfixes / cdd-engine-overhaul，均已 shipped）的功能；不引入新增 CDD 流程节点（brainstorming / writing-plans / cli-driven-development 流程结构不变）；不承载 #246 之后的消费方新 report（另行走 report-issue 通道）。

**Cross-cutting constraints**：七 phase 彼此独立（无 hard 依赖），执行顺序 = 优先级自由调度；P3 为决策 phase，其存续/移除决策经全体 findings 证据（含 cdd-engine-overhaul P6 已实测的 `cdd fix --findings spec-review-2` 派发路径）在 P3 brainstorm 拍板；消费方视角：report-issue 语汇（内容信道、标题格式）改动须考虑已发布插件消费者。

---

## Issue inventory

| Phase | Issue (ref) | Title summary |
|---|---|---|
| P1 | [#246#issuecomment-5613473452](https://github.com/Oscaner/skills/issues/246#issuecomment-5613473452) | F1 — cdd-engine 运行收尾不回收 headless implementer 子进程与续跑会话，内存随运行次数累积（#137 follow-up） |
| P2 | [#246#issuecomment-5615909120](https://github.com/Oscaner/skills/issues/246#issuecomment-5615909120) | F5 — cdd review spec/plan 内容演进无法开新 review，Stopping ref 绑定 doc_path（#230 follow-up） |
| P3 | [#246#issuecomment-5616828258](https://github.com/Oscaner/skills/issues/246#issuecomment-5616828258) | F9 — cdd fix 模式存续性决策（fix-inline 已成唯一实测路径）+ review.md 与 CDD skill 规则文案冲突（#145 follow-up） |
| P4 | [#246#issuecomment-5616300332](https://github.com/Oscaner/skills/issues/246#issuecomment-5616300332) | F6（剩余）— overall 四表状态漂移无机械守卫（回填 closeout 已于 cdd-engine-overhaul overall v1.27 完成） |
| P4 | #246（P6 closeout 实测，无独立 comment） | F13 — phase shipped 后 overall 四表未自动回填（P6 结案时 plan 列仍 [Pending] 至人工提醒）；F6 同源实证 —— P4 机械守卫落地前，finishing closeout 须含「回填 Phase inventory plan/design 列 + change-history」强制检查点 |
| P5 | [#246#issuecomment-5616775099](https://github.com/Oscaner/skills/issues/246#issuecomment-5616775099) | F10 — base-branch artifact 由 orchestrator 手工 heredoc 落盘，schema 无校验（#207 follow-up） |
| P5 | [#246#issuecomment-5616775409](https://github.com/Oscaner/skills/issues/246#issuecomment-5616775409) | F11 — brief 由调用方显式触发、落点脆弱，implement 上下文缺失（#154 follow-up） |
| P6 | [#246#issuecomment-5613477927](https://github.com/Oscaner/skills/issues/246#issuecomment-5613477927) | F2 — report-issue session workspace 未按 harness 启动路径定义，standalone 误接无关程序 issue（#173 follow-up） |
| P6 | [#246#issuecomment-5613480140](https://github.com/Oscaner/skills/issues/246#issuecomment-5613480140) | F3 — evidence 撰稿缺「消费者中立 + 运维可执行」双向准则（I6 仅为排除清单，#208 follow-up） |
| P6 | [#246#issuecomment-5613508278](https://github.com/Oscaner/skills/issues/246#issuecomment-5613508278) | F4 — master 标题模板 standalone 下退化为含内部句柄的无内容标题 |
| P6 | #246（session master body，design 期复核发现） | F12 — session master 的 Findings Summary 表格镜像随 run 覆盖漂移（#246 实证：F10/F11 评论不在表内）→ 废除表格，master 只建不更、findings 一律评论 append-only |
| P7 | [#246#issuecomment-5616673296](https://github.com/Oscaner/skills/issues/246#issuecomment-5616673296) | F7 — submodule bump 自动创建 per-submodule 跟踪 issue 且永不关闭（#240/#241/#242 待归档） |
| P7 | [#246#issuecomment-5616675016](https://github.com/Oscaner/skills/issues/246#issuecomment-5616675016) | F8 — submodule bump 陈旧 open PR 无回收机制（#117/#118 待关闭） |

Issue 注册域语义（新发现 / pre-consume / re-assign 触发 + 锚点语法定级）见 [add-phase-protocol](../../packages/osuperpowers/skills/brainstorming/docs/add-phase-protocol.md) §1.5。

---

## Phase inventory

| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |
|---|---|---|---|---|---|---|
| P1 | cdd-engine 进程生命周期统一管理 + 结构重排：全部引擎派生点（task implement/review/fix · docs review/fix · branch-review · research）纳入 run 级进程组所有权（spawnManaged 统一工厂 + run 边界/信号 teardownAll 连根回收——退出续跑会话、释放整场派生进程 + idle backstop 兜底）；cdd-engine 目录重排（bin 薄入口 + lib 分簇 + tests 顶层，npm 不再发 tests） | P1-design（2026-09-11，v1.3：派生点 4 收敛 + owner-liveness + withLifecycle + exit 哨兵） | Done | 连续多次 CDD 运行后无 `claude -p` implementer 驻留累积（RSS 不随运行次数增长；run 结束后 proc-registry 为空）；run 完成/超时/被杀三态下进程组连根回收、续跑会话退出；驻留进程有 idle backstop 兜底；cdd-engine 结构重排（bin/lib/tests 布局、npm pack 不含 tests、residue/smoke 机制位置同步）；`pnpm run validate` 12 块全绿 | 无（program 起点） |
| P2 | cdd review Stopping ref 增内容指纹维度：spec/plan 内容实质演进即新 ref、可开新 review cycle（同 ref + blocker=0 仍禁止 re-run）；文档化 spec 演进重审路径 | P2-design（2026-09-11，v1.1） | Done | 同一 spec/plan 文档内容修改后 `cdd review --round 2` 可开新 review cycle；内容未变仍 exit 3；无复制文档到新路径重审的双文件漂移 anti-pattern | 无 |
| P3 | cdd fix 模式存续性决策：盘点 fix 机械实际派发（含 cdd-engine-overhaul P6 已实测路径）→ 对齐 `_docs/review.md` §cli-fix-all-findings 与 CDD skill fix-inline 两处文案 → 拍板存续/移除并落地（保留则补 doc fix 真实派发路径；移除则删机械） | [Pending] | [Pending] | 决策经 evidence 拍板并记入 P3 design；review.md 与 CDD skill 规则文案唯一化、无冲突；实测路径（fix-inline 或 cdd fix）与文案一致；charter Issue inventory 状态随拍板同步 | 无（决策 phase） |
| P4 | overall 四表一致性机械校验：`scripts/validate/overall-consistency.mjs`（canonical 7 列头 overall 专属，非 canonical 日志 skip）——① 回填声明 ↔ Phase inventory 列双向（shipped 判定 = closeout 行声明，plan 列反向 + design 正向）；② plan/design 文档存在性（slug 后缀 glob，跨日期 phase 文档）；③ change-history 版本严格升序；④ 交叉引用（`#NNN#issuecomment-…` 锚点 ∈ Issue inventory 注册域 / dependency graph phase ∈ Phase inventory / 列 well-formed）+ **登记规则收敛**（add-phase-protocol 唯一 SSoT + 锚点语法定级 + template/SKILL.md 委托）+ **CDD 死档清除**（删 cdd-reference/controller-handoff + handoff-schema 修剪同步 3 处 engine 注释 cite）+ **engine 健壮性 hardening**（run-docs handoff 读包 try/catch → BLOCKED + review-gate corrupt prev → null）；F13：closeout 强制回填检查点（phase shipped 时 finishing 前回填 Phase inventory plan/design 列 + change-history entry，守卫落地后由 ① 双向机械强制） | P4-design（2026-09-11，v1.0） | Done | 四表漂移时 `pnpm run validate` exit 1；正常状态绿如常通过；**不误报现有 shipped 程序**（cdd-overhaul + session-246 实证绿、post-dogfood 非 canonical skip、在途 P3/4/5/7 不误报）；**跨日期 phase 文档绿色**（cdd p2–p6 独立日期经 slug glob 命中）；**F13**：closeout 行声明 ↔ 列一致性机械强制（P6 式漏回填不再发生）；登记规则 5 站收敛 1 SSoT 无残留；CDD 死档删除 + handoff-schema 修剪（3 处 engine 注释 cite 同步）；engine hardening（坏 JSON → BLOCKED / corrupt prev → null + docs-runner 测试） | 无 |
| P5 | CDD 编排硬化（高维统一：engine 全权 `.superpowers/**` artifact 写平面——I6 扩展至 artifact 写）：`cdd base-branch set/get` engine 唯一写入口（`lib/state/workspace-artifacts.mjs` 单源：schema 校验 4 值 enum + 幂等 + `--force` + CDD/standalone 双落点，determine-base/read-base 委托只读不写）+ implement dispatch 内建 brief（自供应默认 workspace 路径，单次调用拿全实现上下文）+ slug 收敛（`workspaceSlug` strip `-design`/`-plan` 单 suffix，run-task+review 双派生点同源；AI 在 plan 文档加 `-plan.md` 后缀 trim）+ P4 守卫交叉（planSuffix/anchorScanFiles 双形 glob）+ 代码目录/文件/CLI 整理（删 bin 双 .gitkeep、拆 cli/shared.mjs、runBriefCli 归 lib/cli/brief.mjs）+ skills/docs 死说明收敛（dispatch-mode 删 brief 前置、determine-base/read-base 委托、base-branch.md enum 4 值 + CLI 用法、_docs/review.md slug 同步） | P5-design（2026-09-12，v1.0） | [Pending] | 每轮 CDD 起点不再由 orchestrator 手工 heredoc 落盘（base-branch.json 全由 `cdd base-branch set` 产出）；artifact schema 可校验（非法 source/缺件 exit 非零）；遗忘 brief 调用不再导致 implement 上下文缺失（`cdd implement --plan` 自供应 brief）；`xxx-*-plan.md` plan 的 workspace slug 与 `xxx-*-design.md` 收敛同值（run-task+review 同源）；skills 面无 brief 前置步 / 无 heredoc 残留 / enum 4 值；`pnpm run validate` 全绿（13 块，含 P4 守卫双形 glob）+ emit 无 drift | 无 |
| P6 | report-issue 四案：session 归属 = harness 启动 cwd 所在 git 仓库 `.superpowers/`（跨仓库不复用；无附着一律 standalone）+ evidence 双向准则（不写消费者可识别数据 + 写可复现机制）下沉 classify/confirm + master 标题 standalone 增 `<topic>` 占位（首条 finding 派生，confirm 门可覆盖；内部 kind 词不进标题）+ master body 聚合语义（废除 Findings Summary 表格，master 只建不更、findings 一律评论 append-only） | P6-design（2026-09-10 本文件 v1.0） | Done | report-issue 不再把 standalone 会话路由到无关程序 issue；issue 携带可复现机制且无消费者环境数据；standalone 标题含内容线索可辨识；master body 只建不更（无表格镜像、无 body PATCH） | 无 |
| P7 | submodule-bump workflow 精简：删除 create-issue / find-issue / issue-number / comment-on-tracking-issue 步骤 + PR 正文 "Tracking Issue:" 行；新增陈旧 PR reconcile（updated=false → 关闭未合并陈旧 PR；updated=true → force-push 复用既有分支）；存量 #240/#241/#242 与 #117/#118 人工关闭存档 | [Pending] | [Pending] | bump 时不再创建跟踪 issue；open issue 列表无 submodule-bump 自动杂音；无悬挂陈旧的 open bump PR 长期存在；存量 #240-242/#117/#118 已关闭 | 无 |

---

## Dependency graph (ASCII)

```
P1 独立（运行收尾）
P2 独立（演进重审）
P3 独立（fix 规则决策）
P4 独立（四表机械守卫）
P5 独立（编排硬化）
P6 独立（report-issue 撰稿）
P7 独立（workflow 精简）
```

**说明**：七 phase 无 hard 依赖，各自作用独立子系统/独立文件族（runner / review 判定 / fix 规则文案 / validate 套件 / 编排 SKILL / report-issue SKILL / submodule workflow）。执行顺序按优先级自由调度，不设串行约束。P3 为唯一「决策 → 再执行」语义 phase，但其决策不阻塞其他 phase；P4 的机械守卫在 phase 执行期可作为其他 phase 的验收辅助（soft）。

---

## Boundary rules

> 每个 phase：完整 brainstorm → plan → dev。Shipped before dependents start（本程序无 hard dependents）。
> Requirement changes arising during a phase （dev 期发现的 new needs / new issues / new constraints）MUST 反馈回本 overall 后再继续实现——version bump + change-history entry + sync affected phase acceptance/dependency。P3 拍板的 fix mode 存续决策即为典型 mid-program 反馈：决策一经落地，须更新 P3 acceptance 并在 change history 记录，不允许实现期绕过。

---

## Maintenance

- Update links + change history per phase; no task lists。
- Master spec for cross-phase conventions；phase specs incremental。
- Phase 拆分 / scope shift 即时同步至 overall（见 Boundary rules）。

---

## Change history

| Version | Date | Summary | Author |
|---|---|---|---|
| v1.0 | 2026-09-10 | Initial charter — 7 phases, 11 findings from #246（F1–F11：运行收尾 / 演进重审 / fix 规则一致性 / 四表守卫 / 编排硬化 / report-issue 三案 / workflow 精简）；new-program 模式（standalone 会话报告收尾批次，不附属任何存量 overall） | [human] · Claude Opus 5 (1M context) |
| v1.1 | 2026-09-10 | P6 scope 扩展（F12，design 期复核 #246 发现）：session master 的 Findings Summary 表格镜像随 run 覆盖漂移（#246 实证 F10/F11 不入表）→ 废除表格，master 只建不更、findings 评论 append-only；同步 P6 Phase inventory scope + acceptance、Issue inventory 增行（v1.0→v1.1） | [human] · Claude Opus 5 (1M context) |
| v1.2 | 2026-09-10 | P6 design spec shipped（`2026-09-10-session-report-246-p6-design.md` v1.0，F2/F3/F4/F12 四案经 cdd review round-1 blocker=0 + fix 闭环）；P6 Phase inventory Design-spec 列回填（[Pending]→P6-design v1.0）（v1.1→v1.2） | [human] · Claude Opus 5 (1M context) |
| v1.3 | 2026-09-10 | P6 dev shipped（CDD 三 task 全 APPROVED + branch-review r1 APPROVED）：renderer subject 契约 + SKILL Session context 模型 + I6 两向契约 + master 只建不更；changeset minor 落盘；PR #249（base develop）已建；Phase inventory P6 plan 列回填（[Pending]→Done）（v1.2→v1.3） | [human] · Claude Opus 5 (1M context) |
| v1.4 | 2026-09-10 | F13 登记（P6 closeout 实测）：phase shipped 后 overall 四表未自动回填（P6 plan 列 [Pending] 至人工提醒），F6 同源实证 → 归入 P4（scope 增 closeout 强制回填检查点 + acceptance 增漏回填不再发生）；Issue inventory +F13 行（v1.3→v1.4） | [human] · Claude Opus 5 (1M context) |
| v1.5 | 2026-09-11 | P1 design spec（`...-p1-design.md` v1.0）：F1 根因统一抽象（spawnManaged 统一工厂 + teardownAll 连根回收 + idle backstop，覆盖全部引擎派生点）× cdd-engine 结构重排（用户请求：bin 薄入口 + lib 分簇 + tests 顶层，允许破坏性更新）；P1 Phase inventory scope/acceptance 回填 + Design-spec 列（[Pending]→P1-design v1.0）（v1.4→v1.5） | [human] · Claude Opus 5 (1M context) |
| v1.6 | 2026-09-11 | P1 spec → v1.1（plan-review r1 驱动）：registry 条目字段定案（弃 `dispatch` 增 `ownerPid`/`done`，支撑跨 run 孤儿判定与进程内空闲监视）+ §2.2 C 细化（markAllDispatchesDone + startIdleMonitor/reapDone 低频回收）+ §2.6 补三项测试（reapDone/信号/跨 run 父死）；Design-spec 列 v1.0→v1.1（v1.5→v1.6） | [human] · Claude Opus 5 (1M context) |
| v1.7 | 2026-09-11 | P1 spec → v1.2（plan-review r2-r4 驱动）：`CDD_LIFECYCLE_PATH` 注入缝（vitest forks 并发隔离）+ 执行顺序验证纪律登记（`node --check` 中间态、Step 7 全量闭环）+ `.npmignore` 保留 `**/.gitkeep` 活条目（files 白名单下防空目录标记发布）；plan 全量 review 收敛 APPROVED；Design-spec 列 v1.1→v1.2（v1.6→v1.7） | [human] · Claude Opus 5 (1M context) |
| v1.8 | 2026-09-11 | P1 spec → v1.3（branch-review r1，4 warn + 5 nit 全 fix-inline）：派生点收敛 4 处（review-package 死码实证删除）+ 跨 run 孤儿判定 owner-liveness 守卫（并发引擎不误杀）+ 出口统一 `withLifecycle` + exit 哨兵机制（`process.exit` 短路 finally 修复）+ `#137` 凭证剥离单点；Design-spec 列 v1.2→v1.3（v1.7→v1.8） | [human] · Claude Opus 5 (1M context) |
| v1.9 | 2026-09-11 | P1 dev shipped：CDD 四任务全 APPROVED（re-org → proc-lifecycle → wiring → changeset，含 timeout 续派）+ branch-review r1 APPROVED（4 warn + 5 nit fix-inline）+ finishing PR #251（base develop）；Phase inventory P1 plan 列回填（[Pending]→Done）——F13 closeout 检查点执行（v1.8→v1.9） |
| v1.10 | 2026-09-11 | P2 design spec（`...-p2-design.md` v1.0）：高维度统一原则——review 绑定内容状态 token（四 type 收敛：task/branch=git、spec/plan=doc_hash），spec/plan Stopping ref 升级 `(doc_path, doc_hash)` 双签名，内容演进即新 ref 可开新 cycle、未变仍 exit 3；spec-review r1 APPROVED（3 warn + 5 nit 全 fix，含 reason 分场景消息 / 写盘内存同步 / fix-mode 负向测试）；P2 Phase inventory Design-spec 列回填（[Pending]→P2-design v1.0）（v1.9→v1.10） | [human] · Claude Opus 5 (1M context) |
| v1.11 | 2026-09-11 | P2 spec → v1.1（plan-review r1-r2 驱动）：gate CDD_INFO 增 `&& docHash` 抑制 ghost-doc 误导消息 + §2.4/§2.5 补 BLOCKED 失败轮无声放行、ghost 边角断言、真实 schema 往返；plan 全量 review 收敛 APPROVED（r1 1 blocker + 1 warn + 4 nit 全 fix → r2 blocker=0）；P2 Design-spec 列 v1.0→v1.1（v1.10→v1.11） | [human] · Claude Opus 5 (1M context) |
| v1.12 | 2026-09-11 | P2 dev shipped：CDD 四任务全 APPROVED（hashFile → gate 双签名 + reason 消息 + 矩阵 → doc_hash 定稿注入 → review.md docs + emit + changeset）+ branch-review r1 APPROVED（1 nit fix-inline：changeset EOF；task-3 nit：writeBlocked 收敛）；PR 待建（base develop）；Phase inventory P2 plan 列回填（[Pending]→Done）——F13 closeout 检查点执行（v1.11→v1.12） | [human] · Claude Opus 5 (1M context) |
| v1.13 | 2026-09-11 | P4 design spec（`...-p4-design.md` v1.0）：高维度方案——canonical 7 列头专属守卫 + 回填声明↔列双向 shipped 判定（Q2）+ 声明式 issue 注册域（锚点形式唯一机器可判，Q3 上探）+ slug 后缀 glob（跨日期 phase 文档）+ 非 canonical 全文件 skip；spec-review r1 1 blocker（日期前缀推导伪报 shipped）先修 → r1' APPROVED blocker=0（10 findings 全 fix，含 §2.6.7 engine hardening 狗食发现）；P4 scope 扩展（用户「skills/docs 臃肿」指令 + 狗食发现：登记规则 5 站收敛 1 SSoT + CDD 死档清除 + engine 两处健壮性修复 + changeset 增 cdd-engine patch）；Phase inventory P4 scope/acceptance 更新 + Design-spec 列回填（[Pending]→P4-design v1.0）——§2.6 项 4（overall 自身段落委托 add-phase-protocol §注册域）随 P4 dev 落盘协议后执行（v1.12→v1.13） | [human] · Claude Opus 5 (1M context) |
| v1.14 | 2026-09-12 | 登记规则收敛：add-phase-protocol §1.5（锚点语法定级 + 注册域 + 3 触发场景）成唯一 SSoT → overall-spec-template §Update trigger conditions + §Missed-update detection 独立表述删除改委托一行、SKILL.md commit-spec 清单 Issue inventory 行 + sync-overall ① 注册语义与 consistency check `#NNN` 注册断言委托（② ③ ④ 结构性行保留本地）；本 overall 自身段落（§Update trigger conditions / §Missed-update detection）同改委托 add-phase-protocol §1.5，删除「P4 机械守卫落地前由人工检测把握」过期措辞（守卫已随本 phase 落地）（v1.13→v1.14） | [human] · Claude Opus 5 (1M context) |
| v1.15 | 2026-09-12 | **P4 dev shipped**：CDD 七任务全 APPROVED（① parser 核心 + 表 well-formedness → ② claims/文档存在/锚点注册域 → ③ validate 块 13 集成 → ④ 登记规则收敛 → ⑤ CDD 死档清除 → ⑥ engine 健壮性 hardening → ⑦ changeset/emit）+ task-review 层 fix-inline（task-1 5 项 / task-2 3 项 / task-4 委托度补强 / task-5 EOF 换行 / task-6 4 项）+ branch-review r1 APPROVED（1 nit fix-inline：stripCellMarkup DRY）；changeset（osuperpowers minor + cdd-engine patch）+ `pnpm run emit`；Phase inventory P4 plan 列回填（[Pending]→Done）——F13 closeout 检查点执行（P4 守卫对自身整体 ① 双向自证：本 closeout 行声明 plan Done ↔ 列同步一致）（v1.14→v1.15） | [human] · Claude Opus 5 (1M context) |
| v1.16 | 2026-09-12 | P5 design spec（`...-p5-design.md` v1.0）：高维统一——engine 全权 artifact 写平面（workspace-artifacts 单源 + `cdd base-branch set/get` 双场景写入口 + implement 自供应 brief + slug 收敛 `-design`/`-plan` trim + 代码/skills 整理）；spec-review r1（2 blocker + …）→ r2（12 f）→ r3 APPROVED blocker=0（17 f 全 fix，含 run-task+review 双派生点收敛、P4 validator 双形 glob、get 契约、host-detection seam、no-op 措辞）；P5 Phase inventory scope 扩展 + Design-spec 列回填（[Pending]→P5-design v1.0）（v1.15→v1.16） | [human] · Claude Opus 5 (1M context) |
