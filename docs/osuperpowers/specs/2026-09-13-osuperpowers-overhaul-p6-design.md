# osuperpowers 架构重构 P6 — 统一规划收口（收敛程序）设计

- **Version**: v1.1 · 2026-09-18（§2.0 收敛论点重构 + 全量升格；R1 spec-review APPROVED 0 blocker，3 warn 已并入本版；spec 变更开新 round R2）
- **Status**: Draft
- **Author**: [human] · Claude Opus 5 (1M context) (osuperpowers:brainstorming)
- **Parent program**: [2026-09-13-osuperpowers-overhaul-overall.md v1.38](./2026-09-13-osuperpowers-overhaul-overall.md)（P6 行 scope/acceptance 已含全部 brainstorm 收敛 + v1.28–v1.38 全部登记）
- **Depends on**: P5 shipped（report-issues 改名 + engine 生命周期重建 + TS 化，PR #263）；P1–P4 shipped（hard 链完整）

---

## Section 0: Incremental warning

> P6 increment only（终局收口 phase）。Cross-phase conventions 见 [overall](./2026-09-13-osuperpowers-overhaul-overall.md)；冲突时 overall 赢。
> `P1–P5 ->(hard) P6` 已满足（P1–P5 Implementation plan 全 `Done`）。

**设计原则（overall Constraints v1.35–v1.37）**：高维度抽象统一 · 可变更代码结构和目录 · 允许破坏性变更 · 不留技术债务。**不是打补丁**——每一项都是 §2.0 收敛论点的执法实例。

**诚实边界（跨厂商检索定）**：prompt caching 的引擎杠杆是**字节面**非断点面（CLI 传文本时断点由 harness CLI 决定）；自有 user-block 命中受 block 粒度影响——受益主张收敛为「连续同类型 round 读 tok > 0 可测」，跨时段/绝对命中率不承诺；不可观测或低于触发阈的 harness 明示不测量。

---

## Section 1: Constraints pointer

- 仓库语言政策：SKILL.md / docs 英文主源；本 spec 中文（Strategy B internal docs）
- 不 commit 除非程序机制要求（spec/plan 审批即提交——writing-phase-spec I2）；changeset 逐 phase 建
- vendored 子模块不可改（**本 phase 的 vendored 是撤离对象**——撤离 ≠ 修改，`git submodule deinit` + `.gitmodules` 移除）
- 所有改动须过 `pnpm run validate` + `pnpm run emit:check` 无 drift；skills / emit 源改动后必跑 `pnpm run emit`
- 不改变引擎评审语义本体（overall non-goal）——但命令面允许收敛（新增 `cdd fix --type branch` 是修复闭环，非语义变更）
- **engine 黑盒用例「工作树干净」结构性前置 + pre-commit 结构性矛盾**（域 E5/G4）：本仓库 pre-commit 全量 validate 在脏树上的失败是**待修矛盾**（G4 修复面），提交边界 = 干净树验证 + CI gate

---

## Section 2: Design body

### §2.0 收敛论点（Claim-Reality Convergence）

> **储存在本仓库的每一项「宣称」——表述 / 守则 / 契约 / 能力声明 / 流程描述——要么有机械强制执行，要么诚实撤回。纸面宣称不存在（No claim without enforcement）。**

P6 不是十一项修复，是**一个收敛程序的六类执法实例**。所有内容由下表推导，不作为独立 patch 出现：

| 实例面 | 现存「纸面宣称」 | 升格执法（= P6 动作） |
|---|---|---|
| **1 能力宣称** | README「works across 8 harnesses」· `.agents/` 派生冗余（14 tracked，唯一消费者=未证实 harness）· vendors「本仓自维护」 | 能力 = **数据**（registry cache profile / manifest 集合）；未证实者**撤回**（8→2、`.agents/` 整撤、vendors 全撤） |
| **2 流程宣称** | 「Run a /xxx session」——单会话单进程内**不存在**二次 spawn · skill 流程可逐点打补丁 | **原语层修正**：`load 上游 skill = import 其流程一次`，重入按已落产物路由（G1，实测 19 处）；**skill 流程化学**——流程变更 = 整 skill 统一调整（B，三断言执法） |
| **3 纪律宣称** | 模板散文承载纪律（English 注释 / EOF / 禁 find / plan 零修改权）——散文不执法 | 纪律 = **机械不变式**（residue/validator 断言），散文降为不变式的可读注解（双轨；可机械化→断言，不可机械化→单点注解） |
| **4 门槛宣称** | pre-commit「validate」在脏树全量跑（结构性不可能）· dry-run 声称零副作用却被副作用门槛拦 · 黑盒用例依赖未文档化前置 | 门槛**对齐边界**：pre-commit = engine 无法自门控的树无关子集；entry-gate = 树依赖面（引擎真实边界）；dry-run = 门判豁免；黑盒前置显式文档化（G4/E2③） |
| **5 工件宣称** | schema 注入非确定性 · 壳四处复制 · template 散文散点（17 令牌三义）· templates/ 6 个 JSON 消费面混乱 · plan/spec 锚点漂移 · docs 与落地脱节 | 工件 = **单源 + 可验证 + 单平面单文件**：壳单源、条款库、token registry、canonical 序列化、engine-config/template-contract 归并、锚点对实态校验、「docs 与落地一致」= 本文档面实例 |
| **6 meta 宣称（程序对自身）** | brainstorm「run 上游 session」流程 · grilling 覆盖性假设 · validate 脚本角色不明 · pre-commit 矛盾 | **自省收敛**：程序把一致性镜头转向自身——G1–G4（session-call 诚实化 / 需求全量清单 / validate 脚本 maintainer-only 边界 / pre-commit 结构修复） |

**两个化学（φ）**：**工件单源化学**（一切可预期的工件/数据/契约有且仅有一个字节原子来源——壳、条款、schema、配置文件、锚点）· **skill 流程化学**（节点锚定流程是形状本体，变更即整 shape 变更，无局部补丁）。P6 的设计与验收以此为双公理。

### §2.1 根因（两根因轴）

一切根因归二轴，无第三类：

| 轴 | 根因 | 实证 |
|---|---|---|
| **① 宣称漂移**（纸面与实际不一致）| R1 8-harness 宣称 vs 实证 2 | README/zh/CLAUDE.md · keywords · `#pi` 死字段 |
| | R2 `.agents/` 派生冗余（消费者=Droid 未证实）| 14 tracked 文件 · emit 产物 |
| | R3 vendors 自维护 vs 上游自治 | sync/bump workflow · publish-vendor · version-sync · validate 块 |
| | R8 `.mjs`/`.ts` 平面无显式边界（发布面/engine/编排层）| v1.34 盘点 |
| | R9 skill 流程无防膨胀机制 | 多次形态迭代零机械校验 |
| **② 无执法机制**（规则/纪律/门槛无机械强制）| R4 提示词组装无序（变体中断静态前缀）| v1.28–31 登记 · 跨厂商六公理 |
| | R5 cdd 六缺口（branch-fix/dry-run/黑盒前置/收编/纪律落模板/锚点）| v1.33 登记（T11/T14 二连 · 14 同根因 · 锚点漂移）|
| | R6 stall 止损缺失（OOM 后 I/O 退化 90min 拖死）| v1.29（T5 wedged ×2）|
| | R7 test 内存无守卫 | v1.28（T4 OOM 击穿）|
| | R10 tests 平铺与 src 脱节 | 50 文件 vs 六域 |
| | R11 v1.13 follow-up 无主 | smoke flake · changeset 版本不落地 |

### §2.2 高维度统一骨架 — Bounded-plane 模型

```
┌──────────────────────────────────────────────────────────────┐
│ 平面                      │ 语言面        │ 消费方程            │
├──────────────────────────────────────────────────────────────┤
│ ① osuperpowers 发布面      │ .mjs 隔离(2)  │ report-templates 裸 node │
│ ② cdd-engine src          │ 全 TS 恒真    │ cache-first 组装 C1–C7 │
│ ③ repo 编排层 scripts/    │ 全 TS(Q2-B)   │ validate/emit/release  │
│ ④ registry 数据面          │ JSON 数据     │ harness + cache profile│
│ ⑤ 文档轴                   │ English      │ docs ↔ 落地一致        │
│ ⑥ 模板数据面（新）          │ JSON 单源     │ engine-config / template-contract（§2.3.4）│
└──────────────────────────────────────────────────────────────┘
```

- **机械守卫优先主线程**：每个删除面配守卫（残留 stale-lexicon）、每个收敛面配不变式（字节/digraph/锚点/内存/pre-commit 子集）——「零纸面宣称」是全局总不变量（§2.5）。
- **「docs 与落地一致」是收口统一验收**：每个登记项落地 = maintainer docs / CLAUDE.md 有同步记录，且落地面零陈旧引用。

### §2.3 六域设计（每域首句 = 承载宣称 → 执法）

#### §2.3.1 域 A — 能力宣称收缩（宣称撤回 + 数据化）

| 项 | 设计 | 落点 |
|---|---|---|
| A1 | 8-harness → 证实面（claude/cursor-agent）+ 中性「多 harness 可消费」 | README.md / README.zh-CN.md / CLAUDE.md |
| A2 | README.zh-CN 陈旧面清理（`docs/gate-install.md` 死引用 · Trae/Vibe/Kiro/OpenCode/init-harness · 未证实 harness 行）| README.zh-CN.md |
| A3 | `keywords` 去 droid/pi · `#pi` 死 manifest 字段删除（零消费方，实证）| packages/osuperpowers/package.json |
| A4 | manifests.mjs 注释清理 | scripts/emit/manifests.mjs |
| A5 | **`.agents/` emit 面移除**：`emitAgentsSkillsCopy` 删 + prune/compare 路径删 + **git rm 14 tracked 文件（实测，含 .keep）** + emit.test 同步；产出集合 = `.claude-plugin` + `.cursor-plugin` + marketplace + `.github/ISSUE_TEMPLATE` | scripts/emit/* · packages/osuperpowers/.agents/ |
| A6 | 根 CLAUDE.md「`.agents/` is derived」等派生提示 → 改写为面向剩余 emit 产物集合 | CLAUDE.md |
| A7 | harness-registry 精简审计（保持 claude/cursor-agent 两实扛，零死条目）+ 后续 cache profile 数据面（域 D） | infra/harness-registry.json |
| A8 | emit:check drift=0 | `pnpm run emit:check` |

#### §2.3.2 域 B — vendors 自维护面全撤（宣称撤回，不留死代码债务）

| 面 | 现状 | 动作 |
|---|---|---|
| B1 | `.github/workflows/submodule-sync.yml` + `submodule-bump.yml` | **整删两 workflow** |
| B2 | release.yml `publish-vendor` 步骤 + 关联引用 | 删步骤 + 引用 |
| B3 | `scripts/validate/submodule.mjs` + run.mjs 块 | 删文件 + 删块（13→12 块）|
| B4 | pr-validate / release checkout `submodules: recursive` | 撤空 |
| B5 | scripts/release/publish-vendor* + submodule-tags* + `bump-submodule` 子命令 | 整族删 |
| B6 | submodule 本体：`deinit -f --all` + 删 `.gitmodules` 三条 + 删 `vendors/` 三目录 + `git add .gitmodules` | 撤离（不触 content）|
| B7 | marketplace/source.json 三 vendor 条目 + emit 产物（两 marketplace.json + cursor-plugins/*）| 条目删 + re-emit |
| B8 | version-sync superpowers 检查（`resolveVendorVersion`）| 删（**消解 v1.13 flake**）|
| B9 | marketplace-utils vendor 派生（:22-23）· emit resolveVersion/assertCursorPathsExist vendor 路径 · vendored assembly templates 引用 | 删/清理/更新 data-driven-templates.md |
| B10 | CLAUDE.md「Vendored submodules」章节 | 整节删 |
| B11 | README/zh 安装指引：三个有官方入口者保留官方命令引用并标上游出处，其余引导上游文档（不本地复制清单）| 改写 |
| B12 | 防回渗守卫：stale-lexicon/residue 增 `vendors/` · `publish-vendor` · `submodule` 语汇 | validate |

> 顺序：先删机制引用再拆 submodule，防孤儿引用。

#### §2.3.3 域 C — 测试就近迁移 + `.mjs` 终态（可靠性收口，项 M1–M7）

> 域 C 项目编号 **M1–M7**（Migration），与域 D 的 cache 契约 **C1–C7** 消歧（R1-3 warn 修）。

| 项 | 设计 |
|---|---|
| M1 | 50 文件就近映射：infra.* → `src/infra/__tests__/` · dispatch.* → `src/dispatch/__tests__/` · rules.* → `src/rules/__tests__/` · cli-*/review-loop/runner/task/docs-*/handoff-*/progress-*/base-branch/brief/context/contract/exit/failure-categories/host-detection/registry/root/schema-utils/templates.*/workspace-artifacts/lifecycle.* → 按被测源就近 |
| M2 | helpers → 就近（`src/infra/__tests__/helpers.ts`）；fixtures 保留规划（随就近迁移，规避散落）|
| M3 | mock 路径随迁改指就近 .ts；测试内相对路径按新布局修正 |
| M4 | vitest include 收敛 `['src/**/__tests__/**/*.test.ts']`；`tests/` 目录退役 |
| M5 | **`.mjs` 终态断言**：src 恒真 0 `.mjs` + tests 0 `.mjs`（32→0）——residue/结构守卫固化 |
| M6 | **内存守卫复核**：`maxWorkers=1 + fileParallelism=false + maxConcurrency=2`（engine + root 双 config）固化为持久配置不变式 |
| M7 | 运维文档同步：vitest include / tests 退役 / exemplars 测试路径 / skill-authoring 测试命名段 / third-party-deps（.mjs/.ts 平面记录）/ CLAUDE.md dev 段 |

`.mjs`/`.ts` 双平面显式裁定：cdd-engine src 全 TS（恒真）· cdd-engine tests 全部 `.ts`（M1–M5）· **osuperpowers scripts 保留 `.mjs` 隔离（Q1-A）**——report-templates 消费者环境零依赖裸 node 发布面 + render-yaml 属 .mjs emit 编排层，显式留存记录于 third-party-dependencies.md · **repo scripts/ 全量 `.ts`（Q2-B）**——44→0，Node24 原生 strip-types，CI 调用名随迁。

#### §2.3.4 域 D — 模板系统化 + cache-first 组装契约（工件单源化学主战场）

> 承载命题：**「4 模板同一骨架」必须从散文约定升为数据强制**；cache 重构是容器化时机，不是散文重排。

**D-1 模板系统化（第五层收敛，P4 四层之上）**：

| 子项 | 设计 |
|---|---|
| **D1.1 章节骨架 registry** | `template-contract.json#sections`：单一骨架声明式定义（id/heading/subsection/clause 引用/注入点）+ **`segments: {static, variant}`**。4 模板按骨架数据生成/校验——「统一骨架」数据强制；**cache 两段制（C1）成为骨架属性** |
| **D1.2 条款库** | `template-contract.json#clauses`：v1.29–v1.31 全部纪律条款（English 注释 / EOF / 禁大目录 find / Bash 卡>10min 终止 / plan-spec 零修改权 / atomic commit / self-validate）收敛为单源条款，模板 `{{> clause cl:xxx}}` 引用——条款**字节单源**，行为变更一行全局生效 |
| **D1.3 注入契约（token registry）** | `template-contract.json#tokens`：17 个注入令牌收敛为语义分组数据（id/语义/归属段/static-variant 标签）；`templates.ts` 以 token registry 驱动渲染，模板文本零散令牌 |
| **D1.4 rename 规范化** | 令牌/常量/文件全名规范化（低于 §命名制度）：`H1_BLOCK`→`RETURN_STDOUT_BLOCK`（H1 = stdout 返回块，非 markdown 标题——语义澄清）· `HANDOFF_STUB`→`HANDOFF_SCHEMA_JSON` · 三义 HANDOFF（HANDOFF/HANDOFF_TYPE/HANDOFF_STUB）合并唯一 · `LENS_GUIDE`→`REVIEW_LENS_GUIDE` · `AXES`→`REVIEW_AXES` · `HARD_GATE`→`HANDOFF_WRITE_GATE` · `RETURN_MODE`→`RETURN_FORMAT` · `TYPE`→`REVIEW_TYPE` · 其余前缀统一（task-*/docs-* 作用域）· 常量 `REVIEW_H1_BLOCK`/`renderHandoffStub` 同规范 |
| **D1.5 JSON 归并（单平面单文件）** | 运行时配置 3 并 1 → `engine-config.json`（context-contract + failure-categories + handoff-namespace 分区段）；渲染数据 5 合 1 → `template-contract.json`（skeleton + segments + tokens + clauses + reviews.json）；**schemas 独立保留**（双用面：校验器独立 load + 原样注入独立字节子块）。测试引用路径随迁（env-surface/context/failure-categories/contract.test）。护栏：按消费平面分文件 · 双用面不并 · 注入字节原子单元 = 缓存版本单元 |
| **D1.6 文件布局归一** | `task/{implement,fix}.md` + `docs/{review,fix}.md`（原 review/review.md → docs/review.md · fix/docs.md → docs/fix.md）· config/contract/schema 归位（终态见下） |

**终态布局（数据 6→4）**：
```
templates/
  task/implement.md   task/fix.md
  docs/review.md      docs/fix.md
  engine-config.json             # 运行时配置面（context-contract+failure-categories+handoff-namespace 并 1）
  template-contract.json         # 渲染数据面（skeleton+tokens+clauses+reviews.json 合 1）
  schema/task-handoff-schema.json  schema/docs-handoff-schema.json   # 独立
```
消费方程：`infra/config.ts` 单点加载 engine-config；`render/templates.ts` 单点加载 template-contract——每平面一个 SOT、一个加载点、一个版本单元。

**D-2 cache-first 组装契约 C1–C7**（跨厂商六公理 → 契约，无 harness 分支）：

| # | 契约 | 落点 |
|---|---|---|
| C1 | 组装序固定：`[registry prefix] → [静态模板壳] → [变体载荷全置尾]`（H1/task 编号/round 标签/HANDOFF_WRITE_GATE target 路径零落静态区前）= engine 不变式 | 骨架 segments 属性 + templates.ts |
| C2 | 壳/条款结构单源（D1.1–D1.2）——字节恒等不可能漂移 | template-contract |
| C3 | 确定性序列化：schema 注入 canonical key 序、手写串零环境重排、空白固定 | render/templates.ts |
| C4 | re-dispatch 字节复用：静态区按 (op,type) memoize 冻结编译产物，重派发零重渲染 | infra/invoke.ts + templates.ts |
| C5 | 派发集恒定：同 (harness,op,type) 的 invoke 串/model/cwd/env 逐字节同集（断言）；树稳定 = 缓存契约条款 | registry 审计 + 断言 |
| C6 | 写费经济：静态区最薄（紧凑 JSON + 薄散文；不为无复用点扩静态区）| render 审计 + acceptance |
| C7 | 每 harness 观测：可观测者断言「连续同类型 round 读 tok > 0」；不可观测/低于 minTokens 明示不测量。dev 侧脚本化测量（连续 ≥2 轮 `/cost`/`--debug` prompt_cache read/write 前后）| scripts dev 工具 + acceptance |

**registry cache profile 数据面**（多 harness 姿态——新增 harness = 加 registry 行 + profile，契约零改动）：
```jsonc
"cache": {
  "mechanism": "explicit",      // explicit | auto-prefix | implicit
  "minTokens": 512,             // claude: Opus5/Fable/Mythos5.1 一手值；cursor-agent: auto 兜底 pending 实测
  "readMultiplier": 0.1, "writeMultiplier": 1.25,
  "ttlMinutes": 5, "observable": true
}
```

**收益边界（入 acceptance）**：连续同 (harness,op,type) round 在 5-min TTL 窗口主张；跨时段不承诺。

#### §2.3.5 域 E — skill 流程化学 + engine 机制增量

**E1 · skill 流程原子性（Q3 升级吸收，B2）**：
- **flow 变更纪律（process）**：任何 skill 内部流程变更走整 skill 重读——`变更触发 → 全 skill 重读（digraph+节点+失败面）→ 形状适配判断（既有模式实例 / 新形状 / 膨胀信号）→ 统一调整 sibling → 才落点`；膨胀信号（节点/边显著增长）必须给出全 flow 重构理由。入 skill-authoring.md。
- **三断言执法（机械）**：
  - 双向完整：digraph 节点集 ↔ `### 节点定义` 互满射，孤儿/悬空即 fail
  - **骨架同构**：writing-* 三兄弟（single/overall/phase-spec）review-loop/commit/handoff 骨架一致；家族 delta 差异显式登记（phase-spec Skeleton deltas 表 = 校验输入），未登记差异即 fail
  - **增长信号**：每 skill digraph 节点/边计数入 validate 报告；跨界增长强制「全 flow 重构说明」段，缺失即 fail

**E2 · cdd 六缺口（P5 实证）**：

| # | 缺口 | 设计 | 落点 |
|---|---|---|---|
| ① | `cdd fix --type branch` 命令面 | branch-review 修复闭环走 engine：cli/fix.ts 增 branch 分支 + branch roundPattern + Stopping；cli-driven-development branch-fix 节点同步为已实现形态 | src/cli/fix.ts · phases.ts · cli-driven-development/SKILL.md |
| ② | **dry-run 豁免 entry-gate** | 门判见 dryRun 即跳过（`run()` 模板 pre-flight 门先于 docs resolveContext 早退——实锤）| rules/commit.ts 或 base.ts |
| ③ | 黑盒干净树前置文档化 | vitest config 注释 / 测试文档 / CLAUDE.md dev 段显式记录 | 文档面 |
| ④ | 跨 Task findings 收编 | review findings 标 `targets later task`（零 schema 变更）→ orchestrator 落 plan `pending-acceptance-patch` 区（唯一写者）→ 后续 task 验收面含 patch | writing-plans · plan 文档样例 |
| ⑤ | 提示词纪律落模板 | English 注释 · EOF · 禁大目录 find / 裸读 · Bash 卡>10min 终止 · plan/spec 零修改权 → 条款库（D1.2）引用，非散文 | template-contract clauses |
| ⑥ | plan/spec 锚点终态校验 | 路径锚对实态文件，并入「docs 与落地一致」；residue/一致性扩展 | validate |

**E3 · stall 探测器三件套（v1.29–31）**：① `infra/proc.ts` spawnManaged liveness monitor（每 ~60s 双信号：CPU + 树 mtime；IDLE_WINDOW ~15min 无推进 → 杀进程组 → TIMEOUT handoff，blocker 含清偿指引）② 工具纪律=E2⑤ 条款 ③ 恢复契约化（discard/commit 后 re-dispatch，入口门保证干净）。落点 proc.ts · invoke.ts · rules/failure.ts · DEFAULT_TIMEOUTS。

**E4 · 内存守卫**：归口域 C M6（复核固化）。

**E5 · v1.13 收口**：smoke workspace 并发 flake 排查（归黑盒稳定化）· engine changeset 版本落地验证（归域 F changeset 复核）。

#### §2.3.6 域 F — 收口复核

| 项 | 设计 |
|---|---|
| F1 | 锚点终态校验（E2⑥ 全量执行）|
| F2 | 残留守卫扩展：stale-lexicon 增 vendors / publish-vendor / submodule（B12）+ `.agents/` 派生语汇（A5）+ droid/pi keywords（A3）|
| F3 | **逐 phase changeset 复核**：P1–P5 齐备 + P6 自身 changeset（osuperpowers minor + cdd-engine minor 评估）+ **版本落地验证**（`pnpm run version --dry-run` next ≠ 当前或挂牌原因）|
| F4 | **全局命名制度**：`docs/maintainers/naming-conventions.md`——作用域前缀 / 单词形禁缩写历史名（H1→RETURN_STDOUT_BLOCK）/ 目录家族布局 / schema-token-常量三面同名；衔接 P5 src 命名统一 + 模板 rename（D1.4）+ Q2-B + skills 文件面；**「全仓命名/结构零冲突」验收以此制度为对照** |
| F5 | `pnpm run validate` 12 块（submodule 块删）+ `emit:check` 全绿 + **零纸面宣称总校验**（§2.5）|

#### §2.3.7 域 G — 自省四修（程序对自身执法）

| # | 项 | 设计 | 落点 |
|---|---|---|---|
| G1 | **session-call 语义诚实化（全域，实测 19 处）** | 6 skill 原始 `Run a /` 计数（重测）：brainstorming 6 · writing-phase-spec 4 · writing-single-spec 3 · writing-overall-spec 3 · writing-plans 2 · finishing 1 = **19**。authoring 原语层修订：`load 上游 skill = import 其流程一次`，每会话每上游类型至多消费一次、重入按已落产物路由、否决二次 spawn 措辞；逐节点从「Run a /xxx session」改写为「上游流程内联消费；产物 = …；路由到 …」；handoff-* 交接按交接语汇统一；cli-driven-development 为 CLI-dispatch（排除）| 6 skills SKILL.md + skill-authoring.md session-call 原语定义 |
| G2 | **grilling 需求全量清单前置** | phase-grilling 先逐项枚举 overall/phase 已登记需求（含状态），用户确认覆盖完整再入 frontier | brainstorming / writing-phase-spec 流程 |
| G3 | **validate 脚本 maintainer-only 边界文档化** | `scripts/validate/*` = 发布根仓内部编排面（消费者无、非打包面）；overall-consistency = charter 四表守卫，brainstorm 期调用 = maintainer-mode（本仓 dogfood）| maintainer docs + writing-overall-spec 流程 |
| G4 | **pre-commit 结构性矛盾修复** | 三件：① dry-run 豁免上移门判（=E2②）② 黑盒树依赖用例迁 mkdtemp 隔离或 CI-only ③ pre-commit 钩子收敛树无关子集（emit-check/residue/consistency/unit）+ CI 全量 | infra 门判 · vitest 套件 · .husky/pre-commit · CLAUDE.md dev 段 |

### §2.4 task 组织（序，plan 期可细化）

> 顺序原则：删除面先行（A→B）→ 目标布局落地（C 就近 + Q2-B 前置）→ 机制增量落新布局（D 模板系统化/cache · E 流程原子性+缺口+stall）→ 收口复核（F）。改动各自 validate 单点 + 全量在收口。

| T | 域 | 内容 | 关键文件 |
|---|---|---|---|
| T1 | A | 能力宣称收缩（A1–A8）| README.md/zh · CLAUDE.md · package.json · scripts/emit/* · .agents/ 移除面 |
| T2 | B | vendors 自维护面全撤（B1–B12）| workflows ×2 · release.yml · validate submodule 块 · scripts/release/* · .gitmodules · marketplace · version-sync · emit · residue |
| T3 | C(M1–M7) | cdd-engine tests 就近迁移 + tests/ 退役 + `.mjs` 终态断言 + 内存守卫复核 | tests/ → src/<域>/__tests__/ · vitest include · helpers/fixtures · residue |
| T4 | C/Q2-B | repo scripts/ 全量 `.ts`（rename + 显式 `.ts` 扩展 + CI 调用名随迁 + vitest include 随迁）| scripts/** · workflows 调用名 · package.json |
| T5 | D | **模板系统化 + rename + JSON 归并 + cache C1–C7 + profile**（骨架/条款/token registry · 两段制 · 布局归一 · engine-config/template-contract · 字节不变式守卫 · dev 观测脚本）| 4 模板 · template-contract.json · engine-config.json · harness-registry.json · render/templates.ts · tests |
| T6 | E1 | skill 流程原子性三断言 + flow 变更纪律（process 入 skill-authoring）| skill-authoring.md · validate（digraph 三断言）|
| T7 | E2 | cdd 六缺口（①fix --type branch ②dry-run 豁免 ③黑盒前置文档 ④pending-acceptance-patch ⑤纪律条款入库 ⑥锚点校验）| cli/fix.ts · phases.ts · commit.ts · plan 文档 · template-contract |
| T8 | E3 | stall 探测器三件套（liveness monitor + 恢复契约化）| infra/proc.ts · invoke.ts · rules/failure.ts |
| T9 | F | 收口复核（F1–F5：锚点终态 · 残留守卫 · changeset+版本落地 · **naming-conventions.md 对照** · validate 12 块 + emit:check + 零纸面宣称总校验）| validate 全链 · .changeset/ · naming-conventions.md |
| T10 | G | 自省四修（G1 session-call 全域 **19 节点** + authoring 原语 · G2 需求全量清单 · G3 validate 边界 · G4 pre-commit 修复三件）| 6 skills · skill-authoring.md · writing-overall-spec 流程 · .husky/pre-commit · infra 门判 · vitest 套件 |

### §2.5 验收（Acceptance criteria）

> **总不变量（第一条）**：**零纸面宣称**——本 spec 的每一项删除面有残留守卫、每一项收敛面有机械断言、每一项纪律有执法位（断言或单点注解）；validate 全链覆盖全部执法断言。

- **零纸面宣称总校验**：residue/validator 断言面扩展（digraph 三断言 · 字节不变式 · 残留守卫 · 锚点 · 内存守卫 · pre-commit 子集）全绿；「无机械执法即无宣称」评审可核对每 spec 项 ↔ 执法位映射
- **能力宣称**：README/zh/CLAUDE.md 零 8-harness、零死引用；keywords 零 droid/pi、零 `#pi` 死字段；`emit:check` drift=0
- **`.agents/` 移除**：git **零跟踪**、emit 零产出、代码零 `emitAgentsSkillsCopy`/`pruneStaleAgentsNamespaces` 引用；产出集合 = 4 项；CLAUDE.md 零派生提示
- **vendors 全撤**：marketplace/产物零 vendor 条目；零 publish-vendor（代码/workflow/步）；validate **12 块**；workflow 零 submodule-sync/bump；checkout 零 recursive；`.gitmodules` 零条目、`vendors/` 不存在；version-sync 零 superpowers 检查；README/zh 零自维护面（仅官方命令引用标上游）；守卫零命中
- **测试就近 + `.mjs` 终态**：`src/**/__tests__/**/*.test.ts`；`tests/` 退役；src 恒真 0 `.mjs` + tests 32→0；osuperpowers scripts 保留 `.mjs` 隔离（显式留存记录）；repo scripts/ 全量 `.ts`（44→0，`node scripts/run.ts validate` 直跑，留存例外零）；engine suite 全绿（含新守卫）
- **模板系统化 + cache C1–C7**：4 模板抗骨架数据校验一致（章节序/段名/segments 归属恒等）；条款库零重复（clauses 单源）；token registry 全收敛（17 令牌 → 新命名规范，零遗留 H1/HANDOFF 旧名）；`engine-config.json`/`template-contract.json` 存在且消费方程单点（`config.ts`/`templates.ts`）· 测试引用路径随迁；组装序恒为「registry prefix → 静态壳 → 变体载荷」；壳单源字节恒等零漂移；schema canonical 序列化；重派发零重渲染；同 (harness,op,type) 派发集逐字节同集；静态区最薄；registry 条含 cache profile（claude explicit/512/0.1/1.25/5/observable；cursor-agent auto pending）且 schema 校验；dev 观测脚本就位，连续同类型 round `/cost` 读 tok > 0 可测（验收记录实测值）；收益边界入文档
- **skill 流程原子性**：skill-authoring.md 含 flow 变更纪律；digraph 三断言（双向完整 · 骨架同构 · 增长信号）全绿
- **cdd 缺口**：`cdd fix --type branch` 可用（branch findings 全 engine 闭环，零编排 inline）；**dry-run 脏树 EXIT 0**（11 个 dry-run 黑盒转绿）；黑盒前置文档化；跨 Task 收编走 pending-acceptance-patch（fix agent 零 plan 修改权）；纪律条款入库（模板正文零内联纪律散文）；锚点终态校验零漂移
- **stall 探测器**：卡死 >IDLE_WINDOW 被杀 + TIMEOUT handoff blocker 含清偿指引；无 90min 拖死；liveness 双信号测试绿
- **内存守卫**：`maxWorkers=1 + fileParallelism=false + maxConcurrency=2` 持久配置，567 tests 无 OOM
- **v1.13 收口**：smoke flake 稳定；changeset 消费后版本落地已验证
- **自省四修**：**session-call 实测 19 处零虚假 run 措辞**（6/4/3/3/2/1 分布，全部内联消费 + 产物记载 + authoring 原语修订）；grilling 含需求全量枚举；validate 边界记录于 maintainer docs；**pre-commit 脏树零结构性失败**（dry-run 豁免 + 黑盒隔离/CI-only + 树无关子集）
- **收口复核**：全 plan/spec 锚点对实态零漂移；残留守卫零命中；changeset 齐备 + `version --dry-run` 落地；maintainer docs 与落地一致（exemplars/skill-authoring/third-party-deps/naming-conventions/CLAUDE.md dev 段零陈旧）；`pnpm run validate` **12 块全绿** + `emit:check` 无 drift

---

## Section 3: Deviations from overall

| Overall assumption | Phase decision | Overall updated? |
|---|---|---|
| P6 = 统一规划收口（v1.2 初始） | 扩张为六域 + 收敛论点 §2.0（v1.2→v1.38 逐版本登记）| Yes — v1.38 ★ 2026-09-18 |
| repo scripts/ `.mjs` 留存（v1.34） | 全量 `.ts`（Q2-B）| Yes — v1.35 |
| osuperpowers scripts 二选一待裁（v1.34） | 保留 `.mjs` 隔离（Q1-A）| Yes — v1.35 |
| prompt-cache 五杠杆（v1.28） | 升维 cache-first C1–C7 + 模板系统化（第五层收敛 + rename + JSON 归并）+ profile 数据面 | Yes — v1.35 · v1.38 |
| vendors 撤离（v1.16） | 自维护面全撤 | Yes — v1.35 |
| 自省四修（v1.36） | G1 升格 session-call 全域（~17→**实测 19**）· skill 流程原子性三断言 · 模板系统化 · 命名制度 · JSON 归并 | Yes — v1.37 · v1.38 |

---

## Section 4: Notes for downstream

- **P6 终局 phase**：writing-plans → cli-driven-development → finishing 全链走完即程序收官。
- **无 submodule 环境**：域 B 执行后本仓不再含 submodule——plan 期在无 `vendors/` 环境执行；新增 vendor 依赖触发防回渗守卫。
- **黑盒干净树前置**：全程「进入 review 前工作树干净」（engine 入口门强制）；pre-commit 脏树失败是 G4 修复面。
- **消费方视角**：`report-templates.mjs` 运行时路径（`${pluginRoot}/scripts/report-templates.mjs`）保持稳定（Q1-A）；发布面改动从消费者无构建前提复核。
- **cache 验收需真实 harness**：T5 观测为 dev 侧文档化测量（CI 无 harness 不 gate；记录实测值于验收证据）。
- **changeset 边界**：P6 自身 changeset（osuperpowers minor + cdd-engine minor 评估）在 finishing 前随 F3 落定。
- **R1 三 warn 处置**：14 计数 / 19 枚举 / C·M 消歧已并入本版（§2.3.3 M 编号 · §2.3.7 G1 19 处 · §2.5）。

---

## Section 5: Review

Fresh-Subagent Review Passes（cdd spec review）必须全过，才进入用户 review 与 writing-plans。R1（本版前量）APPROVED 0 blocker；本版含作者侧升格变更，按 writing-phase-spec I1 合法开新 round R2。