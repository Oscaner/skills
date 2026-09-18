# osuperpowers 架构重构 P6 — 统一规划收口（收敛程序）设计

- **Version**: v1.5 · 2026-09-18（F8 全仓术语优化【Review Convergence 定名】+ R5 二修；R1–R5 均 APPROVED 0 blocker，17 findings 处置；开终审 R6）
- **Status**: Draft
- **Author**: [human] · Claude Opus 5 (1M context) (osuperpowers:brainstorming)
- **Parent program**: [2026-09-13-osuperpowers-overhaul-overall.md v1.40](./2026-09-13-osuperpowers-overhaul-overall.md)（P6 行 scope/acceptance 已含全部 brainstorm 收敛 + v1.28–v1.40 全部登记 + brainstorm 自省四修 + F7）
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
| **4 门槛宣称** | pre-commit「validate」在脏树全量跑（结构性不可能）· dry-run 声称零副作用却被副作用门槛拦 · 黑盒用例依赖未文档化前置 | 门槛**对齐边界**：pre-commit = engine 无法自门控的树无关子集；entry-gate = 树依赖面（引擎真实边界）；**dry-run = 门判 WARN 化**（不跳过，脏树打印 warn）；黑盒前置显式文档化（G4/E2③） |
| **5 工件宣称** | schema 注入非确定性 · 壳四处复制 · template 散文散点（18 令牌三义，实测）· templates/ 6 个 JSON 消费面混乱 · skill 文档模板同样散点（base-branch / overall-spec-template / add-phase-protocol / phase-spec-template）· plan/spec 锚点漂移 · docs 与落地脱节 | 工件 = **单源 + 可验证 + 单平面单文件**：壳单源、条款库、token registry、canonical 序列化、engine-config/template-contract 归并、**skill 文档模板系统化（D-2）**、锚点对实态校验、「docs 与落地一致」= 本文档面实例 |
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

### §2.3 七域设计（域 A–F 为六设计域，域 G = meta 自省域，不计六数；每域首句 = 承载宣称 → 执法）

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
| M5 | **`.mjs` 终态断言**：src 恒真 0 `.mjs` + tests 0 `.mjs`（**基准定义，R5 补**：当前 `tests/` 下 .mjs 共 32 = 30 个 `*.test.mjs` + `helpers.mjs` + `fixtures/proc-oracle-engine.mjs`；迁移后断言 `tests/` 与 `src/` 全平面零 .mjs——含 helpers/fixture 随 M2 就近安置）——residue/结构守卫固化 |
| M6 | **内存守卫复核**：`maxWorkers=1 + fileParallelism=false + maxConcurrency=2`（engine + root 双 config）固化为持久配置不变式 |
| M7 | 运维文档同步：vitest include / tests 退役 / exemplars 测试路径 / skill-authoring 测试命名段 / third-party-deps（.mjs/.ts 平面记录）/ CLAUDE.md dev 段 |

`.mjs`/`.ts` 双平面显式裁定：cdd-engine src 全 TS（恒真）· cdd-engine tests 全部 `.ts`（M1–M5）· **osuperpowers scripts 保留 `.mjs` 隔离（Q1-A）**——report-templates 消费者环境零依赖裸 node 发布面 + **render-yaml 属 osuperpowers scripts 保留面**（`packages/osuperpowers/scripts/render-yaml.mjs`，被 `.mjs` 编排层 `scripts/emit/*` 直引——T4 repo scripts/ 44→0 **不含它**），显式留存记录于 third-party-dependencies.md · **repo scripts/ 全量 `.ts`（Q2-B）**——44→0，Node24 原生 strip-types，CI 调用名随迁。

#### §2.3.4 域 D — 模板系统化 + cache-first 组装契约（工件单源化学主战场）

> 承载命题：**「4 模板同一骨架」必须从散文约定升为数据强制**；cache 重构是容器化时机，不是散文重排。

**D-1 模板系统化（第五层收敛，P4 四层之上）**：

| 子项 | 设计 |
|---|---|
| **D1.1 章节骨架 registry** | `template-contract.json#sections`：单一骨架声明式定义（id/heading/subsection/clause 引用/注入点）+ **`segments: {static, variant}`**。4 模板按骨架数据生成/校验——「统一骨架」数据强制；**cache 两段制（C1）成为骨架属性** |
| **D1.2 条款库** | `template-contract.json#clauses`：v1.29–v1.31 全部纪律条款（English 注释 / EOF / 禁大目录 find / Bash 卡>10min 终止 / plan-spec 零修改权 / atomic commit / self-validate）收敛为单源条款，模板 `{{> clause cl:xxx}}` 引用——条款**字节单源**，行为变更一行全局生效 |
| **D1.3 注入契约（token registry）** | `template-contract.json#tokens`：**18 个注入令牌（实测 2026-09-18，含 {{TASK}}；去重枚举 AXES/BRIEF/CONSTRAINTS/DOC/FINDINGS/FIXED_POINT/H1_BLOCK/HANDOFF_STUB/HANDOFF_TYPE/HANDOFF/HARD_GATE/LENS_GUIDE/PLAN_LINE/REFERENCE/RETURN_MODE/TASK/TYPE/WORKSPACE）**收敛为语义分组数据（id/语义/归属段/static-variant 标签）；`templates.ts` 以 token registry 驱动渲染，模板文本零散令牌 |
| **D1.4 rename 规范化** | 令牌/常量/文件全名规范化（低于 §命名制度）：`H1_BLOCK`→`RETURN_STDOUT_BLOCK`（H1 = stdout 返回块，非 markdown 标题——语义澄清）· **三义 HANDOFF 族最终态（R3 厘清）**：`HANDOFF`/`HANDOFF_TYPE` 合并为唯一 `HANDOFF_TARGET`（实施期按渲染真值核证语义）；`HANDOFF_STUB` **独立**更名 `HANDOFF_SCHEMA_JSON`——**结果 2 枚非 1 枚** · `LENS_GUIDE`→`REVIEW_LENS_GUIDE` · `AXES`→`REVIEW_AXES` · `HARD_GATE`→`HANDOFF_WRITE_GATE` · `RETURN_MODE`→`RETURN_FORMAT` · `TYPE`→`REVIEW_TYPE` · 其余前缀统一（task-*/docs-* 作用域）· 常量 `REVIEW_H1_BLOCK`/`renderHandoffStub` 同规范 |
| **D1.5 JSON 归并（单平面单文件）** | 运行时配置 3 并 1 → `engine-config.json`（context-contract + failure-categories + handoff-namespace 分区段）；渲染数据 **4 族合 1** → `template-contract.json`（skeleton【含 segments 属性】+ tokens + clauses + reviews.json——segments ⊂ skeleton，非并列族）；**schemas 独立保留**（双用面：校验器独立 load + 原样注入独立字节子块）。测试引用路径随迁（env-surface/context/failure-categories/contract.test）。护栏：按消费平面分文件 · 双用面不并 · 注入字节原子单元 = 缓存版本单元 |
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

**D-2 skill 文档模板系统化（第二平面，用户 2026-09-18 指示）**：

osuperpowers skills 的 artifact/methodology 文档模板同病（结构乱、散文散点、缺规范化）：

| 文件 | 角色 |
|---|---|
| `skills/writing-phase-spec/docs/phase-spec-template.md` | phase spec 结构模板 |
| `skills/writing-overall-spec/docs/overall-spec-template.md` | overall spec 结构模板 |
| `skills/writing-overall-spec/docs/add-phase-protocol.md` | 新 phase 注册协议 |
| `skills/cli-driven-development/docs/base-branch.md` | base 分支推断方法论 |

与 D1 同一 doctrine（双平面同构）：**统一骨架**（Header + Section 0–N 固定段序）· **占位/token 引用条款库**（模板引条款，不内联散文规则）· **命名规范** · **P1–P6 经验烘焙**（§2.6 经验清单：四表 sync 机制 · 干净树前置 · session-call 原语语义 · 回填即版本 · 零纸面宣称 · 防回渗守卫 · 承诺收缩 · 测试就近…——模板承载已定案经验而非裸骨架）。⚠️ skills docs 受 emit 面影响：重写与 `.agents/` 移除（T1/A5）时间窗在 plan 期定序（`.agents/` 移除后重写免 emit 往返）；经验全文落 `docs/maintainers/program-experience.md`（F6）。

**D-3 cache-first 组装契约 C1–C7**（跨厂商六公理 → 契约，无 harness 分支）：

| # | 契约 | 落点 |
|---|---|---|
| C1 | 组装序固定：`[registry prefix] → [静态模板壳] → [变体载荷全置尾]`（RETURN_STDOUT_BLOCK/task 编号/round 标签/HANDOFF_WRITE_GATE target 路径零落静态区前——统一改名后语义名书写，spec 自身示范零旧名）= engine 不变式 | 骨架 segments 属性 + templates.ts |
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
| ① | **`cdd fix --type branch` 命令面 + branch 级 review-fix loop 全形** | **branch-review -> branch-fix 遵守与 spec/plan/task 完全同构的 review-fix loop**（用户 2026-09-18 指示）：digraph = `K[branch-review] → {blocker=0?} → J[branch-fix] →（blocker>0 → K / blocker=0 → handoff-finishing）`——与 writing-* 族 `D[review] → {blocker=0?} → F[fix] →（blocker>0 → D / blocker=0 → commit)` 逐节点同构（终态=finishing，fix 的 commit 由引擎出口门在 loop 内完成）；`branch-fix-loop` 节点改名 `branch-fix` + 语义：`cdd fix --type branch --findings branch-review-{R}.json` 为**唯一修复通道（引擎闭环，零编排 inline）**；Stopping 语义同族（review 输出 blocker=0 → fix all → done 不 re-review）；轮次软上限保留 branch 定位（终局 gate，僵局用户裁决——对称性例外记录理由）；cli-driven-development 全部 P6 改动整 skill 一次改齐（Flow Atomicity） | cli/fix.ts · dispatch/phases.ts（branch roundPattern）· cli-driven-development/SKILL.md |
| ② | **dry-run 门判 WARN 化** | 门判见 dryRun **降级为 WARN 不 BLOCK**（`run()` 模板 pre-flight 门先于 docs resolveContext 早退——实锤）：检查脏树 → stderr 打印「工作树含未提交变更；dry-run 纯模拟不受影响，真实 dispatch 需干净树」→ **exit 0 走完模拟**。保留门的信息价值 + 零副作用语义，比「完全跳过 gate」更诚实（用户 2026-09-18 指示）| rules/commit.ts 或 base.ts |
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
| F8 | **全仓术语优化（用户 2026-09-18 指示，Review Convergence 定名）**：`naming-conventions.md` 扩「**术语制度**」（terminology registry：term/定义/已废旧名禁止表）——**改名清单**：`Review Stopping` → **`Review Convergence`**（评审收敛——与 §2.0 论点同词根，loop 在 blocker=0 处收敛）· `fix-loop-exhausted` → `review-cycle-cap` · `timeout-exhausted` → `dispatch-timeout-cap` · `engine-error` 保留登记；**保留清单登记定义**（blocker / handoff / dispatch / backfill / stale-lexicon / residue / 内部机制函数名——内部名以准确为准不攀优雅；编码面归 F4）；**同步面**：skills Invariants ×8（17 处）· CLAUDE.md 段 · overall 现行 · maintainer docs · **引擎 `src/rules/stopping.ts` → `convergence.ts` + test 随域 C 迁批**（机制语义本体不动——non-goal）；residue/stale-lexicon 断言已废旧名（`Review Stopping`·`*-exhausted`）live 面零残留；**历史 changelog/spec-plan 豁免**（记录当时用语）| naming-conventions.md · 8 skills · CLAUDE.md · rules/convergence.ts · residue |
| F6 | **设计方法论落运维文档（English-primary，用户 2026-09-18 指示）**：`docs/maintainers/`——`naming-conventions.md`（命名制度，含 H1 教训）· `context-caching-doctrine.md`（六公理 + C1–C7 + registry cache profile + 观测验收 + 诚实边界）· `template-doctrine.md`（模板系统化双平面：骨架/条款/token/JSON 归并/rename）· `program-experience.md`（P1→P6 经验资产，模板重写输入）；本 spec 的设计面（域 D/E/F/G）为各 doc 的源，落地与一致 |
| F7 | **运维文档整体整理与重组（用户 2026-09-18 增需）**：写运维文档时对全部 `docs/maintainers/`（8 份：4 新方法论 + 4 旧核心）做内容整理优化——删无用（准则：整档删除仅当零读者+内容完全被取代；节级删除 stale 引用 `.agents/`/vendors/旧路径 与重复段落）· 按内容域重划文件/目录（工程原则域 ↔ 插件运维域；目录 or 平铺+索引裁定在计划期按引用成本）· 全引用同步（CLAUDE.md 4 处链接 · validate doc-surface · 跨 doc 链接）；重组后每 doc 重新锚对实态（与「docs 与落地一致」缝合）；与 skill-authoring 吸收（G1/Q3）、data-driven-templates↔template-doctrine 交叉引用合并副本 |
| F5 | `pnpm run validate` 12 块（submodule 块删）+ `emit:check` 全绿 + **零纸面宣称总校验**（§2.5）|

#### §2.3.7 域 G — 自省四修（程序对自身执法）

| # | 项 | 设计 | 落点 |
|---|---|---|---|
| G1 | **session-call 语义诚实化（全域，实测 19 处）** | 6 skill 原始 `Run a /` 计数（重测）：brainstorming 6 · writing-phase-spec 4 · writing-single-spec 3 · writing-overall-spec 3 · writing-plans 2 · finishing 1 = **19**。authoring 原语层修订：`load 上游 skill = import 其流程一次`，每会话每上游类型至多消费一次、重入按已落产物路由、否决二次 spawn 措辞；逐节点从「Run a /xxx session」改写为「上游流程内联消费；产物 = …；路由到 …」；handoff-* 交接按交接语汇统一；cli-driven-development 为 CLI-dispatch（排除）| 6 skills SKILL.md + skill-authoring.md session-call 原语定义 |
| G2 | **grilling 需求全量清单前置** | phase-grilling 先逐项枚举 overall/phase 已登记需求（含状态），用户确认覆盖完整再入 frontier | brainstorming / writing-phase-spec 流程 |
| G3 | **validate 脚本 maintainer-only 边界文档化** | `scripts/validate/*` = 发布根仓内部编排面（消费者无、非打包面）；overall-consistency = charter 四表守卫，brainstorm 期调用 = maintainer-mode（本仓 dogfood）| maintainer docs + writing-overall-spec 流程 |
| G4 | **pre-commit 结构性矛盾修复** | 三件：① **dry-run 门判 WARN 化**（=E2②——不跳过，脏树 warn 不 BLOCK）② 黑盒树依赖用例迁 mkdtemp 隔离或 CI-only ③ pre-commit 钩子收敛树无关子集（emit-check/residue/consistency/unit）+ CI 全量 | infra 门判 · vitest 套件 · .husky/pre-commit · CLAUDE.md dev 段 |

### §2.4 task 组织（序，plan 期可细化）

> 顺序原则：删除面先行（A→B）→ 目标布局落地（C 就近 + Q2-B 前置）→ 机制增量落新布局（D/E）→ **域 G 与 D-2 同窗**（随 T1/A5 `.agents/` 移除后执行——G1 改 6 skill SKILL.md、D-2 改 skill docs 均受 emit 面影响，移除后免 emit 往返；G4 的 pre-commit 修复树无关可由 T10 覆盖）→ 收口复核（F）。改动各自 validate 单点 + 全量在收口。

| T | 域 | 内容 | 关键文件 |
|---|---|---|---|
| T1 | A | 能力宣称收缩（A1–A8）| README.md/zh · CLAUDE.md · package.json · scripts/emit/* · .agents/ 移除面 |
| T2 | B | vendors 自维护面全撤（B1–B12）| workflows ×2 · release.yml · validate submodule 块 · scripts/release/* · .gitmodules · marketplace · version-sync · emit · residue |
| T3 | C(M1–M7) | cdd-engine tests 就近迁移 + tests/ 退役 + `.mjs` 终态断言 + 内存守卫复核 | tests/ → src/<域>/__tests__/ · vitest include · helpers/fixtures · residue |
| T4 | C/Q2-B | repo scripts/ 全量 `.ts`（rename + 显式 `.ts` 扩展 + CI 调用名随迁 + vitest include 随迁）| scripts/** · workflows 调用名 · package.json |
| T5 | D | **模板系统化 + rename + JSON 归并 + cache C1–C7 + profile**（骨架/条款/token registry · 两段制 · 布局归一 · engine-config/template-contract · 字节不变式守卫 · dev 观测脚本）| 4 模板 · template-contract.json · engine-config.json · harness-registry.json · render/templates.ts · tests |
| T6 | E1 + D-2 | skill 流程原子性三断言 + flow 变更纪律 + **skill 文档模板系统化（base-branch / overall-spec-template / add-phase-protocol / phase-spec-template 四文件统一骨架 + 条款引用 + P1–P6 经验烘焙；emit 时间窗与 T1 .agents 移除定序）** | skill-authoring.md · 4 skill docs · validate（digraph 三断言）|
| T7 | E2 | cdd 六缺口（①fix --type branch + **branch 级 review-fix loop 全形** ②dry-run WARN 化 ③黑盒前置文档 ④pending-acceptance-patch ⑤纪律条款入库 ⑥锚点校验）| cli/fix.ts · phases.ts · commit.ts · cli-driven-development/SKILL.md · plan 文档 · template-contract |
| T8 | E3 | stall 探测器三件套（liveness monitor + 恢复契约化）| infra/proc.ts · invoke.ts · rules/failure.ts |
| T9 | F | 收口复核（F1–F8：锚点终态 · 残留守卫 · changeset+版本落地 · **naming-conventions 对照** · **4 份方法论 doc** · **F7 运维文档整理重组** · **F8 术语优化【Review Convergence 改名全同步】· validate 12 块 + emit:check + 零纸面宣称总校验）| validate 全链 · .changeset/ · naming-conventions.md · context-caching-doctrine.md · template-doctrine.md · program-experience.md |
| T10 | G | 自省四修（G1 session-call 全域 **19 节点** + authoring 原语 · G2 需求全量清单 · G3 validate 边界 · G4 pre-commit 修复三件）| 6 skills · skill-authoring.md · writing-overall-spec 流程 · .husky/pre-commit · infra 门判 · vitest 套件 |

### §2.5 验收（Acceptance criteria）

> **总不变量（第一条）**：**零纸面宣称**——本 spec 的每一项删除面有残留守卫、每一项收敛面有机械断言、每一项纪律有执法位（断言或单点注解）；validate 全链覆盖全部执法断言。

- **零纸面宣称总校验**：residue/validator 断言面扩展（digraph 三断言 · 字节不变式 · 残留守卫 · 锚点 · 内存守卫 · pre-commit 子集）全绿；「无机械执法即无宣称」评审可核对每 spec 项 ↔ 执法位映射
- **能力宣称**：README/zh/CLAUDE.md 零 8-harness、零死引用；keywords 零 droid/pi、零 `#pi` 死字段；`emit:check` drift=0
- **`.agents/` 移除**：git **零跟踪**、emit 零产出、代码零 `emitAgentsSkillsCopy`/`pruneStaleAgentsNamespaces` 引用；产出集合 = 4 项；CLAUDE.md 零派生提示
- **vendors 全撤**：marketplace/产物零 vendor 条目；零 publish-vendor（代码/workflow/步）；validate **12 块**；workflow 零 submodule-sync/bump；checkout 零 recursive；`.gitmodules` 零条目、`vendors/` 不存在；version-sync 零 superpowers 检查；README/zh 零自维护面（仅官方命令引用标上游）；守卫零命中
- **测试就近 + `.mjs` 终态**：`src/**/__tests__/**/*.test.ts`；`tests/` 退役；src 恒真 0 `.mjs` + tests 32→0；osuperpowers scripts 保留 `.mjs` 隔离（显式留存记录）；repo scripts/ 全量 `.ts`（44→0，`node scripts/run.ts validate` 直跑，留存例外零）；engine suite 全绿（含新守卫）
- **模板系统化 + cache C1–C7**：4 模板抗骨架数据校验一致（章节序/段名/segments 归属恒等）；条款库零重复（clauses 单源）；token registry 全收敛（**18 令牌实测** → 新命名规范，**零遗留旧态名**：H1_BLOCK / HANDOFF 三义旧名 HANDOFF·HANDOFF_TYPE·HANDOFF_STUB / TYPE / LENS_GUIDE…）；`engine-config.json`/`template-contract.json` 存在且消费方程单点（`config.ts`/`templates.ts`）· 测试引用路径随迁；组装序恒为「registry prefix → 静态壳 → 变体载荷」；壳单源字节恒等零漂移；schema canonical 序列化；重派发零重渲染；同 (harness,op,type) 派发集逐字节同集；静态区最薄；registry 条含 cache profile（claude explicit/512/0.1/1.25/5/observable；cursor-agent auto pending）且 schema 校验；dev 观测脚本就位，连续同类型 round `/cost` 读 tok > 0 可测（验收记录实测值）；收益边界入文档
- **skill 文档模板系统化（D-2）**：4 文件（base-branch / overall-spec-template / add-phase-protocol / phase-spec-template）统一骨架 + 条款引用 + P1–P6 经验烘焙（§2.6 引用）；与 engine 模板同 doctrine；emit 时间窗已序；`program-experience.md` 存在为全文
- **skill 流程原子性**：skill-authoring.md 含 flow 变更纪律；digraph 三断言（双向完整 · 骨架同构 · 增长信号）全绿
- **cdd 缺口**：**branch 级 review-fix loop 落地**——`cdd fix --type branch` 命令面可用 + cli-driven-development digraph 为 canon shape（`branch-review → {blocker=0?} → branch-fix →（blocker>0 → re-review / blocker=0 → finishing）`，与 spec/plan/task 族同构，零编排 inline）· branch findings 全 engine 闭环；**dry-run 脏树 EXIT 0 + stderr 脏树 WARN 可断言**（dry-run 黑盒全绿——docs-task/cli-shape 相关用例，出处 = R3 实证）；黑盒前置文档化；跨 Task 收编走 pending-acceptance-patch（fix agent 零 plan 修改权）；纪律条款入库（模板正文零内联纪律散文）；锚点终态校验零漂移
- **stall 探测器**：卡死 >IDLE_WINDOW 被杀 + TIMEOUT handoff blocker 含清偿指引；无 90min 拖死；liveness 双信号测试绿
- **内存守卫**：`maxWorkers=1 + fileParallelism=false + maxConcurrency=2` 持久配置不变式，engine 全量套件 + 新增守卫全绿、正常负载无 OOM（基线 567 出处 = P5 终验 2026-09-18）
- **v1.13 收口**：smoke flake 稳定；changeset 消费后版本落地已验证
- **自省四修**：**session-call 实测 19 处零虚假 run 措辞**（6/4/3/3/2/1 分布，全部内联消费 + 产物记载 + authoring 原语修订）；grilling 含需求全量枚举；validate 边界记录于 maintainer docs；**pre-commit 脏树零结构性失败**（dry-run WARN 化 + 黑盒隔离/CI-only + 树无关子集）
- **收口复核**：全 plan/spec 锚点对实态零漂移；残留守卫零命中；changeset 齐备 + `version --dry-run` 落地；**4 份方法论 doc（naming-conventions / context-caching-doctrine / template-doctrine / program-experience）存在且与落地一致**；**F7 运维文档整理重组完成**（无用文档零、文件/目录按内容域重划、CLAUDE.md 链接与 validate doc-surface 同步）；**F8 术语优化落地**——`Review Convergence` 全 live 面就位（8 skills Invariants · CLAUDE.md · overall · maintainer docs · `rules/convergence.ts`）· `review-cycle-cap`/`dispatch-timeout-cap` 就位 · residue 断言 `Review Stopping`/`*-exhausted` live 面零残留 · naming-conventions 含 terminology registry · 历史 changelog 豁免（记录当时用语）；maintainer docs 与落地一致（exemplars/skill-authoring/third-party-deps/CLAUDE.md dev 段零陈旧）；`pnpm run validate` **12 块全绿** + `emit:check` 无 drift

### §2.6 P1→P6 经验清单（模板重写输入，用户 2026-09-18 指示）

程序全链经验总结（全文落 `program-experience.md`，此为本 spec 的烘焙输入）。skill 文档模板重写（D-2）与一切 P6 设计以此为单位一致性判断：

| 类 | 关键经验（编号便于模板烘焙引用）|
|---|---|
| **A 组织流程** | 1 遗留即删 · 2 删除同步唯一调用方 · 3 防回渗守卫 · 4 回填即版本 · 5 单根权威 · 6 机械守卫>口头纪律 · 7 承诺收缩 · 8 程序自省 |
| **B 工程架构** | 9 破坏性变更+高维度抽象统一 · 10 平层模型 · 11 TS 全量化 · 12 commit 双门 · 13 第三方收敛 · 14 目录单向轴 · 15 输出契约单源 · 16 输入三信道 · 17 失败类目化 · 18 测试就近+内存守卫 |
| **C 缓存/上下文** | 19 跨厂商六公理 · 20 字节面>断点面 · 21 诚实边界 · 22 能力数据化 |
| **D 提示词/模板** | 23 模板系统化五层 · 24 命名制度 · 25 纪律双轨 |
| **E 反模式** | 26 平面不明=债务 · 27 spec 数字不实测即错（15→14 · ~17→19 · 17→18）· 28 黑盒前置未文档化=14 同根因 · 29 pre-commit 结构性矛盾 · 30 变体令牌中断前缀=缓存杀手 · 31 overall 登记≠子 agent 直读面 · **32 异构 loop 形状被骨架同构拦下（branch-loop 初稿非 canon shape——Flow Atomicity 实证）** · **33 低抽象流程名被收敛论点统一为语义词根（Review Stopping→Review Convergence——术语与论证同源）** |

---

## Section 3: Deviations from overall

| Overall assumption | Phase decision | Overall updated? |
|---|---|---|
| P6 = 统一规划收口（v1.2 初始） | 扩张为七域 + 收敛论点 §2.0（v1.2→v1.40 逐版本登记）| Yes — v1.40 ★ 2026-09-18 |
| repo scripts/ `.mjs` 留存（v1.34） | 全量 `.ts`（Q2-B）| Yes — v1.35 |
| osuperpowers scripts 二选一待裁（v1.34） | 保留 `.mjs` 隔离（Q1-A）| Yes — v1.35 |
| prompt-cache 五杠杆（v1.28） | 升维 cache-first C1–C7 + 模板系统化（第五层收敛 + rename + JSON 归并）+ profile 数据面 | Yes — v1.35 · v1.38 |
| vendors 撤离（v1.16） | 自维护面全撤 | Yes — v1.35 |
| 自省四修（v1.36） | G1 升格 session-call 全域（~17→**实测 19**）· skill 流程原子性三断言 · 模板系统化 · 命名制度 · JSON 归并 · F7 运维文档重组 | Yes — v1.37 · v1.38 · v1.40 |
| v1.33 gap① fix --type branch（命令面） | **升格 branch 级 review-fix loop 全形**——branch-loop 与 spec/plan/task 族 canon shape 同构（`{blocker=0?}` decision + 双支过 fix + stopping）；`branch-fix-loop`→`branch-fix`、引擎唯一修复通道、软上限保留 | Yes — v1.41 ★ 2026-09-18 |

---

## Section 4: Notes for downstream

- **P6 终局 phase**：writing-plans → cli-driven-development → finishing 全链走完即程序收官。
- **无 submodule 环境**：域 B 执行后本仓不再含 submodule——plan 期在无 `vendors/` 环境执行；新增 vendor 依赖触发防回渗守卫。
- **黑盒干净树前置**：全程「进入 review 前工作树干净」（engine 入口门强制）；pre-commit 脏树失败是 G4 修复面。
- **消费方视角**：`report-templates.mjs` 运行时路径（`${pluginRoot}/scripts/report-templates.mjs`）保持稳定（Q1-A）；发布面改动从消费者无构建前提复核。
- **cache 验收需真实 harness**：T5 观测为 dev 侧文档化测量（CI 无 harness 不 gate；记录实测值于验收证据）。
- **changeset 边界**：P6 自身 changeset（osuperpowers minor + cdd-engine minor 评估）在 finishing 前随 F3 落定。
- **R1–R5 findings 处置（17 条已并入）**：R1 三 warn（14 计数 / 19 枚举 / C·M 消歧）+ R2 二 finding（token **18 实测** / D1.5 merge 清单）+ R3 七 finding（HANDOFF 族 2 枚终态 / render-yaml 归属 / 567·dry-run 出处 / §2.4 补域 G / T9 真实文件清单 / §2.6 节号序 / C1 零旧名）+ R4 三 finding（上级指针 / 七域计数 / 「豁免」措辞）+ R5 二 finding（**M5 的 32 可复算基准** / **overall P6 行 ~17·豁免 预实测口径同步为 19·WARN 化**）——详见 §2.3.3 M5 · §2.3.4 D1.4 · §2.5 · §2.4 · 父 overall。

---

## Section 5: Review

Fresh-Subagent Review Passes（cdd spec review）必须全过，才进入用户 review 与 writing-plans。R1–R5 均 APPROVED 0 blocker（17 findings 已并入）；本版含作者侧内容变更（F8 术语优化 + R5 二修），按 writing-phase-spec I1 合法开新 round R6。**R6 为终审——不再追加内容**（Review Convergence 收口）。