# osuperpowers 架构重构 P6 — 统一规划收口 设计

- **Version**: v1.0 · 2026-09-18（起草；brainstorm 期三次 overall 回填 v1.35–v1.37 已并入，见 Section 3）
- **Status**: Draft
- **Author**: [human] · Claude Opus 5 (1M context) (osuperpowers:brainstorming)
- **Parent program**: [2026-09-13-osuperpowers-overhaul-overall.md v1.37](./2026-09-13-osuperpowers-overhaul-overall.md)（P6 行 scope/acceptance 已含全部 brainstorm 收敛 + v1.28–v1.37 全部登记 + brainstorm 自省四修）
- **Depends on**: P5 shipped（report-issues 改名 + engine 生命周期重建 + TS 化，PR #263 已 merge，2026-09-18）；P1–P4 全部 shipped（hard 链完整）

---

## Section 0: Incremental warning

> P6 increment only（终局收口 phase——统一规划收口 + 全部登记项的落地与复核）。Cross-phase conventions 见 [overall](./2026-09-13-osuperpowers-overhaul-overall.md)；冲突时 overall 赢。
> `P1–P5 ->(hard) P6` 已满足（P1–P5 Implementation plan 全 `Done`、P5 Design 已 shipped）。

**口径（用户 2026-09-18 授权，overall Constraints 升维）**：所有设计基于「**高维度抽象统一，可变更代码结构和目录**」。P6 是**删除面 × 收口面 × 机制增量面**三合一：宣称收缩 / vendors 撤离 / `.agents/` 移除 = 删除面（遗留即删）；测试就近 / `.mjs` 终态 / 文档一致 = 收口面；cache-first C1–C7 / skills 守则机械校验 / cdd 六缺口 / stall 探测器 = 机制增量面。「不留死代码债务」= 删除不留残留、裁定留显式记录、机械守卫防回渗。

**诚实边界（跨厂商检索定）**：prompt caching 的引擎杠杆是**字节面**而非断点面（CLI 传文本时断点由 harness CLI 决定）；对话内自有 user-block 的命中受 block 粒度影响——受益主张收敛为「连续同类型 round 读 tok > 0 可测」，不承诺绝对命中率；不可观测/低于触发阈的 harness 明示不测量。

---

## Section 1: Constraints pointer

- 仓库语言政策：SKILL.md / docs 英文主源；本 spec 中文（Strategy B internal docs）
- 不 commit 除非程序机制要求（spec/plan 审批即提交——writing-phase-spec I2）；changeset 逐 phase 建
- vendored 子模块不可改（**本 phase 的 vendored 是撤离对象**——撤离 ≠ 修改，`git submodule deinit` + `.gitmodules` 移除，不触碰 submodule 内容本身）
- **破坏性重构已授权 + 高维度抽象统一（可变更代码结构和目录）**（用户 2026-09-13 / 2026-09-18 重复确认，Constraints v1.35）
- 所有改动须过 `pnpm run validate` + `pnpm run emit:check` 无 drift；skills / emit 源改动后必跑 `pnpm run emit`
- **不改变引擎评审语义本体**（overall non-goal）：review/fix/handoff 生命周期、Stopping、commit-contract、doc_hash 判定不动——但**命令面**允许收敛（`cdd fix --type branch` 是新增修复闭环，非语义变更）
- **engine 黑盒用例「工作树干净」是结构性前置**（P6 gap #3）：5b CLI 黑盒用例依赖入口门意义的干净树——本仓库 pre-commit 钩子（`pnpm run validate`）在脏树上的 dry-run 用例失败是**已知结构性矛盾**（P6 gap #2/#3 的修复面），提交边界 = 干净树验证 + CI gate

---

## Section 2: Design body

### §2.1 问题与根因（P6 的治理债分类）

P6 不是一组独立修补，而是**四族债**：宣称债、冗余债、机制缺口债、边界不明债。每族根因 → 设计对策 → 落点如下表（逐族设计见 §2.3）。

| 族 | # | 根因 | 实证 |
|---|---|---|---|
| **宣称债** | R1 | 8-harness 宣称 vs 实证两面（claude/cursor-agent）——未证实 harness 上任何宣称面 | README/zh/CLAUDE.md「works across 8 harness」表述 · `keywords` 含 droid/pi · `#pi` 死 manifest 字段（零脚本消费/零 registry 条目/零 manifest 产出） |
| **冗余债** | R2 | `.agents/skills/` 是派生冗余副本——唯一消费者=Droid（未证实 harness），claude/cursor/pi manifest 均消费 canonical `./skills/` | `emitAgentsSkillsCopy` 产出 15 tracked 文件 · marketplace/source 零条目 · emit:check 仅校验漂移 |
| | R3 | vendors 三插件由本仓自维护发布/同步/版本面，而上游自治——自维护面是死代码债务 | submodule 每周同步 workflow · publish-vendor 管线 · version-sync 检查 · validate submodule 块 · CLAUDE.md 章节 |
| **机制缺口债** | R4 | engine 提示词组装无序——变体令牌（H1/round 标签/绝对路径）散落中断静态前缀，缓存空转（跨厂商六公理判） | v1.28–v1.31 登记 · P5 期研究（前缀字节全等 · 静态先变体后） |
| | R5 | P5 执行实证六缺口：branch-fix 无命令面 / dry-run 被 entry-gate 误拦 / 黑盒干净树前置未文档化 / 跨 Task findings 靠 fix agent 越界改 plan / 提示词纪律不落模板 / 锚点漂移 | v1.33 登记（T11/T14-fix 二连越界 · 14 测试同根因 · T17/T18 锚点报漂） |
| | R6 | 派生 agent 工具调用卡死止损缺失（整过程 90min 硬 cap 被拖死） | v1.29 登记（P5 T5 两次 wedged：`.pnpm` find + node tsc 实验，OOM 后 I/O 退化） |
| | R7 | test 运行内存无守卫（默认每 CPU 一 fork 撑爆） | v1.28 登记（2026-09-17 T4 dispatch OOM 击穿） |
| **边界不明债** | R8 | `.mjs`/`.ts` 双平面无显式边界：engine src（全 TS）vs osuperpowers 发布面（2 `.mjs`）vs repo 编排层（44 `.mjs`）各自归属未明示 | v1.34 盘点 · 本 spec 裁定（§2.3.3） |
| | R9 | skills 流程无防膨胀机制——每次调整无全流程回顾义务，节点增长无闸 | P5 期多次 skill 形态迭代（4→8→…）无一致性机械校验 |
| | R10 | tests 平铺 `tests/` 与 src/ 六域脱节，运维寻址成本高 | 50 文件对比六域结构 |
| | R11 | v1.13 遗留 follow-up 无主（smoke workspace flake · engine changeset 版本效果不落地） | v1.13 登记后未收口 |

### §2.2 高维度统一骨架 — bounded-plane 模型

P6 的抽象统一落在**五个既有平面 + 一个数据面**，各平面边界显式、互不渗透（「统一优先于局部保留，结构与目录可变更」）：

```
┌─────────────────────────────────────────────────────────────┐
│ 平面（plane）          │ 语言面        │ 缓存/契约面            │
├─────────────────────────────────────────────────────────────┤
│ ① osuperpowers 发布面   │ .mjs 隔离（2）  │ report-templates 零依赖 │
│    skills/docs/scripts  │ 类型约束？    │ 裸 node 直跑契约        │
│ ② cdd-engine src        │ 全 TS 恒真    │ cache-first C1–C7 组装  │
│ ③ repo 编排层 scripts/  │ 全 TS（Q2-B） │ validate/emit/release   │
│ ④ registry 数据面       │ JSON 数据     │ cache profile 数据驱动  │
│ ⑤ 文档轴                │ English      │ docs ↔ 落地一致         │
└─────────────────────────────────────────────────────────────┘
```

- **机械守卫优先主线程**：每一族债的收口都配一个机械守卫（非纪律）——字节不变式测试 / digraph 完整性校验 / 残留守卫 stale-lexicon 扩展 / 锚点终态校验 / 内存守卫配置 => 防回渗（删除面的回渗、双平面漂移、缓存段漂移、流程膨胀）。
- **「docs 与落地一致」是收口的统一验收**：每个登记项的落地必须在 maintainer docs / CLAUDE.md 有同步记录，同时落地面零陈旧引用。

### §2.3 六域设计

#### §2.3.1 域 A — 宣称面收缩（决策 C + `.agents/` 移除）

| 项 | 设计 | 落点 |
|---|---|---|
| A1 | 8-harness 宣称 → 证实面（claude/cursor-agent）+ 中性「多 harness 可消费」 | README.md / README.zh-CN.md / CLAUDE.md 表述改写 |
| A2 | README.zh-CN 陈旧面清理：死引用 `docs/gate-install.md` · 已删 harness 表（Trae/Vibe/Kiro/OpenCode/init-harness 模式）· 未证实 harness 行 | README.zh-CN.md |
| A3 | `oscaner-plugin.claude.keywords` 去 droid/pi · `#pi` 死 manifest 字段删除（零消费方） | packages/osuperpowers/package.json |
| A4 | manifests.mjs 注释清理（残留 harness 名） | scripts/emit/manifests.mjs（或落地时定位） |
| A5 | **`.agents/` emit 面移除**：`emitAgentsSkillsCopy` 删除 + orchestrate prune/compare 路径删除 + **git rm 15 tracked 文件** + emit.test 用例同步；emit 产出集合收敛 = `.claude-plugin` + `.cursor-plugin` + marketplace + `.github/ISSUE_TEMPLATE` | scripts/emit/* · packages/osuperpowers/.agents/ |
| A6 | 根 CLAUDE.md「⚠️ Most Common Mistake — `.agents/` is derived」+「Emit regenerates `.agents/`」等派生提示 → **改写为面向剩余 emit 产物集合**（`.agents/` 不再派生） | CLAUDE.md |
| A7 | harness-registry 精简审计：保持 claude/cursor-agent 两条实扛，零死条目（复核面） | packages/cdd-engine/src/infra/harness-registry.json |
| A8 | emit:check drift=0（产出集合收敛后验证） | `pnpm run emit:check` |

> 本域与 cdd-engine 无关，纯文档 + emit 机制删除。A5 的 git rm 15 文件需在 emit 代码删除完成后执行（删除 emit 产物源 → 重新 emit → 确认 .agents/ 消失 → git rm 已跟踪残留）。

#### §2.3.2 域 B — vendors 自维护面全撤（Q4 升级）

「**不留死代码债务**」：与 vendors 相关的**一切自维护面**撤离，非仅发布面。逐面：

| 面 | 现实现 | 撤离动作 |
|---|---|---|
| B1 | `.github/workflows/submodule-sync.yml`（每周同步矩阵）+ `submodule-bump.yml`（复用工件） | **整删两个 workflow 文件** |
| B2 | `release.yml` 的 `publish-vendor` 步骤（line ~72 `node scripts/run.mjs publish-vendor`）+ 关联输出引用 | 删步骤 + 引用 |
| B3 | `scripts/validate/submodule.mjs` + run.mjs validate 块 | 删文件 + 删块（**13 → 12 块**）|
| B4 | pr-validate / release checkout `submodules: recursive` | 撤空（`submodules: false` 或删行）|
| B5 | `scripts/release/publish-vendor.mjs` + 相关 tests（publish-vendor.test.mjs · submodule-tags.test.mjs）+ `bump-submodule` 子命令 | 整族删（run.mjs `bump-submodule` 分支删）|
| B6 | submodule 本体：`git submodule deinit` ×3 + `.gitmodules` 三条 + `vendors/{superpowers,mattpocock-skills,impeccable}` 目录 | 撤离（不触碰 submodule 内容，仅解除挂载与追踪）|
| B7 | marketplace/source.json 三 vendor 条目 + emit 产物（`.claude-plugin/marketplace.json` / `.cursor-plugin/marketplace.json` / `cursor-plugins/*`）| 条目删 + re-emit |
| B8 | version-sync 的 superpowers 版本检查（含 `resolveVendorVersion`）| 删检查与 helpers（**顺带消解 v1.13 flake**）|
| B9 | marketplace-utils.mjs 的 vendor 集派生（:22-23）· emit `resolveVersion`/`assertCursorPathsExist` vendor 路径 · vendored assembly templates 引用 | 删派生/清理路径/更新 data-driven-templates.md |
| B10 | CLAUDE.md「Vendored submodules」章节 + 更新指引 | 整节删 |
| B11 | README / README.zh-CN 安装指引：三个有官方安装入口者**保留官方命令引用并标上游出处**（`claude plugin marketplace add …`），其余引导去上游仓库文档（不本地复制清单）| 改写 |
| B12 | 防回渗守卫：stale-lexicon/residue 扩展 `vendors/` · `publish-vendor` · `submodule` 语汇（与 P1/P2/P3 同范式） | validate/residue.mjs |

> B6 需在删除一切消费面后进行（先删机制引用再拆 submodule，避免孤儿引用）。操作面：`git submodule deinit -f --all` 解挂载（不改 .gitmodules）→ 手动删 `.gitmodules` 三条 + 删 `vendors/` 三目录 + `git add .gitmodules`。

#### §2.3.3 域 C — 测试就近迁移 + `.mjs` 终态（Q1-A/Q2-B 裁定）

**`.mjs`/`.ts` 双平面显式裁定（v1.35 落定）**：

| 平面 | 终态 | 依据 |
|---|---|---|
| ② cdd-engine src | 全 TS（恒真 0 `.mjs`）| P5 已达成，本域固化断言 |
| ② cdd-engine tests | 就近 `src/<域>/__tests__/*.test.ts`（32 `.mjs` → 0）| 本域 |
| ① osuperpowers scripts | **保留 `.mjs` 隔离**（Q1-A）| `report-templates.mjs`=消费者环境零依赖裸 node 发布面（SKILL.md I5 运行时调用链）；`render-yaml.mjs`=.mjs emit 编排层叶模块（root devDeps `yaml`）；显式留存记录于 third-party-dependencies.md |
| ③ repo scripts/ 编排层 | **全量 `.ts`**（Q2-B，44 → 0 `.mjs`）| Node 24 原生 type-stripping 直跑 `node scripts/run.ts validate` · 显式 `.ts` 扩展导入 · CI 三处调用名随迁 · vitest include 随迁 `.test.ts` · publish-vendor/bump-submodule 面随域 B 消失而缩小 |

**测试就近迁移设计**：

| 项 | 设计 |
|---|---|
| C1 | 50 文件映射：infra.* → `src/infra/__tests__/` · dispatch.* → `src/dispatch/__tests__/` · rules.* → `src/rules/__tests__/` · cli-* / review-loop / runner / task / docs-* / handoff-* / progress-* / base-branch / brief / context / contract / exit / failure-categories / host-detection / registry / root / schema-utils / templates.* / workspace-artifacts / lifecycle.* → 按被测源就近（`src/<域>/__tests__/`）|
| C2 | helpers.mjs → 就近（`src/infra/__tests__/helpers.ts` 或共享测试 util 单点）；fixtures 保留规划（`tests/fixtures/` 集中保留 or 随测试就近——plan 期裁定，默认随就近迁移规避路径散落）|
| C3 | vi.mock 路径随迁改指就近 `.ts`；测试内 `../src/...` 相对路径按新布局修正 |
| C4 | vitest include 收敛 `packages/cdd-engine/vitest.config.mjs`：`['tests/**/*.test.{mjs,ts}', 'src/**/*.test.ts']` → `['src/**/__tests__/**/*.test.ts']`；`tests/` 目录退役 |
| C5 | **`.mjs` 终态断言**：src 恒真 0 `.mjs` + tests 0 `.mjs`（32 → 0）——residue/结构守卫固化 |
| C6 | **内存守卫复核**：`maxWorkers=1 + fileParallelism=false + maxConcurrency=2`（engine + root 双 config）复核为持久配置不变式（防未来引入高并发）——评审 `maxConcurrency` 语义 vs 已迁 TS 套件 |
| C7 | 运维文档同步：vitest include / tests 目录退役 / `data-driven-templates.md` exemplars 表测试路径 / `skill-authoring.md` 测试命名段 / `third-party-dependencies.md`（.mjs/.ts 平面记录）/ CLAUDE.md dev 段 |

#### §2.3.4 域 D — cache-first 组装契约 C1–C7 + registry cache profile

**跨厂商六公理**（检索定）→ 契约化（无 harness 分支，契约一体适用）：

| # | 契约 | 落点 |
|---|---|---|
| C1 | **组装序固定**：`[registry prefix] → [静态模板壳] → [变体载荷全置尾]`（H1 / task 编号 / round 标签 / HARD_GATE target 路径**绝对不落静态区前**）——正式化为 engine 不变式 | render/templates.ts · task/{implement,fix}.md · review/review.md · fix/docs.md 两段制重排 |
| C2 | **壳结构单源**：4 模板 `## Handoff` / `## Return` 壳文本收拢单源（handlebars partial `{{> shell/handoff}}` 或 TS 常量壳 + 模板引用）——字节恒等**不可能漂移**（结构保证，断言降为退化护栏）| templates/ 结构调整 |
| C3 | **确定性序列化**：schema 注入 JSON canonical（key 序=文件序恒等、零环境相关重排、空白固定）；手写注入串零 `|` 吸尾等易变面 | render/templates.ts `renderHandoffStub` 复核 |
| C4 | **re-dispatch 字节复用**：静态区按 (op,type) **memoize 冻结编译产物**，TIMEOUT 重试 / engine-recovery / stall 恢复**重派发零重渲染** | render/templates.ts 模块级缓存 · infra/invoke.ts |
| C5 | **派发集恒定**：同 (harness, op, type) 的 invoke 串 / model / cwd / env 逐字节同集（不变式断言）；**树稳定 = 缓存契约条款**（dispatch 期间零工作树变更 = 已制度化的 commit 双门，升级为缓存理由）| harness-registry.json 条目审计 · 断言测试 |
| C6 | **写费经济**：静态区维持最薄（紧凑 JSON schema 注入 + 薄散文；不为本无复用点的内容扩静态区）——profile 显示写费高者（claude 1.25×）尤须克制 | render 审计 + acceptance 口径 |
| C7 | **每 harness 观测**：可观测 harness 断言「连续同类型 round 读 tok > 0」；不可观测 / 低于 minTokens 明示不测量不主张。观测 = dev 侧脚本化测量（连续 ≥2 轮同 (harness,op,type) dispatch，`/cost`/`--debug` 记录 prompt_cache read/write tok 改前/改后）| scripts/（dev 工具）· acceptance |

**registry cache profile 数据面**（多 harness 姿态：新增 harness = 加 registry 行 + profile，契约零改动）：

```jsonc
// packages/cdd-engine/src/infra/harness-registry.json 每条目新增:
"cache": {
  "mechanism": "explicit",          // explicit | auto-prefix | implicit
  "minTokens": 512,                 // Opus 5/Fable/Mythos 5.1 一手值；低于则缓存不参与
  "readMultiplier": 0.1,            // 读 0.1×（Fable/Mythos 5.1 0.025×）
  "writeMultiplier": 1.25,          // 5-min 写；1h 需显式 ttl=2×
  "ttlMinutes": 5,
  "observable": true                // usage 字段可读 → C7 断言可执行
}
// claude: explicit / 512 / 0.1 / 1.25 / 5 / true
// cursor-agent: auto-prefix 兜底，minTokens/乘数按底层模型 pending 实测，observable 挂 pending
```

**变体尾化审计清单**（C1 的落地面）：H1 block（现 `REVIEW_H1_BLOCK` 常量注入）· brief 注入 · task 编号/进度上下文 · round 标签 · HARD_GATE `Write ${target}` 路径 · schema 注入（**静态，可留静态区**）· registry prefix / suffix（恒等）。**round 标签**：现若在模板头部 → 移除或置尾（不得中断静态前缀）。

**收益边界（入 acceptance）**：缓存只对「5-min TTL 窗口内连续同 (harness,op,type) dispatch」主张（review/fix 连轮、连串 task）；跨时段天然 miss，不承诺。

#### §2.3.5 域 E — skills 守则 + engine 机制增量收口

**E1 · skills 流程调整运维守则（Q3）**：
- skill-authoring.md 增「**流程调整回顾整流程**」守则节：任何 digraph/节点/失败面变更 → 全流程重走——无孤儿节点、无死边、无悬空终止态、节点数增长须说明（防无序膨胀）
- **digraph↔节点完整性机械校验**（validate 新块）：解析 mermaid digraph 节点集 ↔ `### 节点定义` 双向完整（每个 digraph 节点有定义、每个定义是 digraph 节点；孤儿/悬空即 fail）——与 P5 已有 `[skill] node coverage / section alignment` 测试同构，升为正式 validate 块
- 落点：`docs/maintainers/skill-authoring.md` + `scripts/validate/osuperpowers.mjs`（或新 validate 块）+ residue

**E2 · cdd 流程缺口收口（P5 实证六项，engine 面）**：

| # | 缺口 | 设计 | 落点 |
|---|---|---|---|
| ① | **`cdd fix --type branch` 命令面** | branch-review findings 修复闭环走 engine（现 P5 被迫编排 inline）：`cli/fix.ts` 增 branch type 分支 + review/branch roundPattern + Stopping 语义（同一 doc_hash 双签名机制）+ cli-driven-development 的 branch-fix 节点**同步为已实现形态**（skill 文档不再指引编排 inline）| `src/cli/fix.ts` · `src/dispatch/phases.ts`（roundPattern）· cli-driven-development/SKILL.md |
| ② | **dry-run 豁免 entry-gate** | `--dry-run` = 纯模拟零副作用 → 入口门 clean-tree 校验跳过（不拦）；exit 0 + 正常输出 | `src/rules/commit.ts` entryGateCleanTree · parse（dry-run 标志） |
| ③ | **engine 黑盒用例干净树前置文档化** | 5b CLI 黑盒用例依赖入口门意义的干净树——vitest config 注释 / 测试文档 / CLAUDE.md dev 段显式记录该前置（P5 14 同根因教训）| vitest.config.mjs 注释 · tests 文档 · CLAUDE.md |
| ④ | **跨 Task findings orchestrator 收编机制** | review findings 标 `targets later task` tag（**零 schema 变更**，convention）→ orchestrator 在 plan 增 **`pending-acceptance-patch` 区**（task-ref + patch 描述，orchestrator 唯一写者）→ 后续 task 的验收面含 patch（机械可断言）——v1.31 语义微调：修改权归 orchestrator，fix agent 零修改权不放松 | writing-plans · cli-driven-development 文档 · plan 模板/文档样例 |
| ⑤ | **提示词纪律落模板正文** | English 注释 · EOF 尾换行 · 禁大目录全量 find / 大文件裸读（限路径、maxdepth）· Bash 卡 >10min 终止换等价命令 · 已审批 plan/spec 零修改权（越界改经 findings 报 orchestrator）→ implement/fix/review 4 模板正文 | task/{implement,fix}.md · review/review.md · fix/docs.md |
| ⑥ | **plan/spec 锚点终态校验** | 全 plan/spec 路径锚对实态文件（T17/T18 类 review 锚点漂移不再复发）——并入「docs 与落地一致」项；residue/一致性检查扩展 | validate 一致性块 · 收口复核 |

**E3 · stall 探测器三件套（v1.29–v1.31）**：
- ① `infra/proc.ts` **spawnManaged 派发期 liveness monitor**：每 ~60s 采样双信号（子进程累计 CPU + workspace/工作树最新文件 mtime），IDLE_WINDOW（默认 ~15min）内均无推进 → 杀进程组 → 写 **TIMEOUT handoff**（blocker 注明「agent 工具调用卡死 + 未提交改动待清偿」）——判据精确：思考/读文件的 agent 烧 CPU、仅挂起工具调用 CPU≈0 且树静默 → 不误杀
- ② 提示词工具纪律 = E2⑤（合并落模板）
- ③ **恢复路径契约化**：stall 击杀后残留清偿指引写进 TIMEOUT/BLOCKED blocker（discard/commit 后 re-dispatch）；入口门保证 re-dispatch 前干净
- 落点：`src/infra/proc.ts` · `src/infra/invoke.ts`（透传 idle 参数）· `src/rules/failure.ts`（TIMEOUT 语义扩展）· `DEFAULT_TIMEOUTS` 配置面 · 4 模板

**E4 · 测试运行内存守卫**：归口于域 C6（复核固化，不单独成 task——配置已落地，复核 + 断言）。

**E5 · v1.13 follow-up 收口**：
- smoke workspace 并发 flake（workspace-marker 污染）→ 排查 smoke-cdd/residue（并发 run 相互污染清理）——归「engine 黑盒用例稳定化」
- engine changeset 版本效果不落地 → 归域 F changeset 复核的「版本落地验证」（`pnpm run version --dry-run` next ≠ 当前，或挂牌原因）

#### §2.3.6 域 F — 收口复核

| 项 | 设计 |
|---|---|
| F1 | 锚点终态校验（E2⑥ 落地全量执行：全 plan/spec 路径锚对实态） |
| F2 | 残留守卫扩展：stale-lexicon 增 vendors / publish-vendor / submodule 语汇（B12）+ `.agents/` 派生语汇（A5）+ droid/pi keywords 语汇（A3）——删除面零回渗 |
| F3 | **逐 phase changeset 复核**：P1–P3 engine patch/minor、P3 osuperpowers minor（cli-research 删）、P4/P5 osuperpowers minor 齐备；**P6 自身 changeset**（评估：osuperpowers minor【宣称/.agents/scripts/文档】+ cdd-engine minor【fix--type-branch/dry-run/stall/cache】）；**版本落地验证**（`pnpm run version --dry-run` 消费后 next 版本非当前，或每个挂起 changeset 记录原因——v1.13⑧） |
| F4 | 运维文档最终一致（域 C7 + 域 A/B/E 各落地项随动；exemplars/skill-authoring/third-party-deps/CLAUDE.md/dev 段零陈旧） |
| F5 | `pnpm run validate` 12 块（submodule 块已删，13→12）+ `emit:check` 全绿（A8）· engine suite 全绿（含新守卫测试） |

### §2.3.7 域 G — brainstorming 自省四修（P6 brainstorm 实证驱动）

P6 brainstorm 自身暴露的四条流程/机制缺陷（以本会话为实证）。与前域关系：G1/G2 属 skill 流程面（并入 E1 守则与 writing-phase-spec 流程），G3/G4 属机制收口面（并入 F 与 E2）。

| # | 项 | 设计 | 落点 |
|---|---|---|---|
| G1 | **session-call 语义诚实化（全域，v1.37 升格）** | 实证枚举全域 session-call 面：6 skill ~17 处 `Run a /` 节点（brainstorming 5 · writing-phase-spec 4 · writing-single-spec 3 · writing-plans 2 · writing-overall-spec 2 · finishing 1）。修复定位 = **authoring 原语层**：skill-authoring.md session-call 原语定义修订——「加载即内联消费（不可能二次 spawn）：每会话每上游类型**至多消费一次**，重入按**已落产物**（mode/design-context/marker）路由，否决再 Run 措辞」；再逐 skill 节点从「Run a /xxx session」改写为「上游流程作为本会话基线内联消费；产物 = …；路由到 …」。cli-driven-development 为 CLI-dispatch 非上游 session（排除），其 handoff-finishing 按交接语汇统一。**双保险**：digraph 校验（域 E1）保证改写后节点↔定义仍双向完整 | 6 skills SKILL.md（17 节点）+ skill-authoring.md session-call 原语定义 |
| G2 | **grilling 需求全量清单前置** | phase-within-program grilling 先**逐项枚举 overall/phase 已登记需求（含状态 [Pending]/Done/已裁）**，用户确认覆盖完整后再入 frontier 问题 | brainstorming / writing-phase-spec 流程定义 |
| G3 | **validate 脚本 maintainer-only 边界文档化** | `scripts/validate/*` = 发布根仓内部编排面（消费者环境无 `scripts/`、非打包面）；`overall-consistency` = 本程序 charter 四表守卫，brainstorm 期调用是 maintainer-mode（本仓 dogfood）定位 | maintainer docs（third-party-dependencies.md 或新增）· writing-overall-spec 流程注明角色归类 |
| G4 | **pre-commit 结构性矛盾修复（代码证实）** | 三件：① **dry-run 豁免上移门判**——`run()` 模板 pre-flight 先跑 `commitPreCheck`，docs 族 dry-run 早退在 `resolveContext`（门后）→ 门判见 dryRun 即跳过（gap#2 正式修）② **黑盒树依赖用例迁 mkdtemp 真仓隔离** 或标记 CI-only（pre-commit 只跑树无关子集）③ **pre-commit 钩子收敛树无关目标**（emit-check/residue/consistency/unit）+ CI 全量 | rules/commit.ts 或 base.ts 门判 · vitest 套件组织 · .husky/pre-commit · CLAUDE.md dev 段 |

### §2.4 task 组织（序，plan 期可细化）

> 顺序原则：**删除面先行（A→B）→ 目标布局落地（C 测试就近 + F 前置 scripts .ts 化）→ 机制增量落于新布局（D cache / E 守则+缺口+stall）→ 收口复核（F）**。域内 task 边界 plan 期细化；改动各自 validate 单点 + 全量在收口。

| T | 域 | 内容 | 关键文件 |
|---|---|---|---|
| T1 | A | 宣称面收缩（A1–A8）| README.md/zh · CLAUDE.md · package.json · scripts/emit/* · .agents/ 移除面 |
| T2 | B | vendors 自维护面全撤（B1–B12）| workflows ×2 · release.yml · scripts/validate/submodule.mjs · scripts/release/* · .gitmodules · marketplace · version-sync · marketplace-utils · emit · CLAUDE.md · README/zh · residue |
| T3 | C | cdd-engine tests 就近迁移 + tests/ 退役 + `.mjs` 终态断言 + 内存守卫复核（C1–C7）| tests/ → src/<域>/__tests__/ · vitest include · helpers/fixtures · residue 断言 |
| T4 | C/Q2-B | repo scripts/ 编排层全量 `.ts`（rename + 显式 `.ts` 扩展 + CI 调用名随迁 + vitest include 随迁）| scripts/**/*.mjs → .ts · .github/workflows 调用名 · package.json |
| T5 | D | cache-first 组装契约 C1–C7 + registry cache profile（两段制重排 · 壳单源 · 确定性序列化 · memoize · 派发集不变式 · 字节守卫测试 · profile 数据面 · dev 观测脚本）| render/templates.ts · 4 模板 · harness-registry.json · tests |
| T6 | E1 | skills 流程守则 + digraph↔节点完整性机械校验 | skill-authoring.md · validate/osuperpowers.mjs |
| T7 | E2 | cdd 六缺口收口（①fix --type branch ②dry-run 豁免 ③黑盒前置文档 ④pending-acceptance-patch ⑤纪律落模板 ⑥锚点校验）| cli/fix.ts · phases.ts · commit.ts · plan 文档 · 4 模板 · validate |
| T8 | E3 | stall 探测器三件套（liveness monitor + 恢复契约化；提示词纪律随 E2⑤ 已落）| infra/proc.ts · invoke.ts · rules/failure.ts · DEFAULT_TIMEOUTS |
| T9 | F | 收口复核（F1–F5：锚点终态 · 残留守卫 · changeset 复核+版本落地 · 运维文档一致 · validate 12 块 + emit:check 全绿；v1.13⑧ smoke flake 并入 E5）| validate 全链 · .changeset/ |
| T10 | G | brainstorming 自省四修（G1 session-call 诚实化**全域 17 节点 + authoring 原语** · G2 需求全量清单 · G3 validate 边界文档 · G4 pre-commit 修复三件）| 6 skills SKILL.md 节点 · skill-authoring.md · writing-overall-spec 流程 · .husky/pre-commit · infra 门判 · vitest 套件组织 |

### §2.5 验收（Acceptance criteria）

逐项可验证（来自 overall P6 行 + 本 spec 细化；黑体 = 机械可测）：

- **宣称面**：README/zh/CLAUDE.md **零 8-harness 宣称**、零死引用（gate-install/Trae/Vibe/Kiro/OpenCode/init-harness/未证实 harness 语汇）；package.json `keywords` 零 droid/pi、**零 `#pi` 死字段**；manifests.mjs 注释清理；emit:check drift=0
- **`.agents/` 移除**：`packages/osuperpowers/.agents/` git **零跟踪**、emit 零产出、代码零 `emitAgentsSkillsCopy`/`pruneStaleAgentsNamespaces` 引用；emit 产出集合 = `.claude-plugin` + `.cursor-plugin` + marketplace + `.github/ISSUE_TEMPLATE`；CLAUDE.md 零「`.agents/` is derived」派生提示
- **vendors 全撤**：`marketplace/source.json` + emit 产物零 vendor 条目；零 `publish-vendor`（代码/workflow/步）；validate **12 块**（submodule 块删）；workflow 零 `submodule-sync/bump`、checkout 零 `submodules: recursive`；`.gitmodules` 零条目、`vendors/` 目录不存在；version-sync 零 superpowers 检查（`resolveVendorVersion` 零残留）；README/zh 零 vendor 自维护面（仅三个官方命令引用标上游出处）；防回渗守卫零命中
- **测试就近**：cdd-engine **`src/**/__tests__/**/*.test.ts`**（`tests/` 目录退役、vitest include 收敛）；mock/helpers 就近、fixtures 规划落定；**.mjs 终态**——cdd-engine src 恒真 0 `.mjs` + tests 32→0；osuperpowers scripts 保留 `.mjs` 隔离（显式留存记录于 third-party-dependencies.md）；repo scripts/ 全量 `.ts`（44→0，`node scripts/run.ts validate` 直跑、CI 调用名随迁、留存例外零且理由显式）；engine suite 全绿（567 基线 + 新守卫）
- **cache-first C1–C7**：组装序恒为「registry prefix → 静态模板壳 → 变体载荷」；壳单源字节恒等**零漂移**（结构保证 + 断言退化护栏）；schema 注入 canonical 序列化（C3 断言）；重派发零重渲染（memoize 断言）；同 (harness,op,type) 派发集逐字节同集（C5 断言）；静态区最薄（token 面断言）；registry 条含 cache profile（claude explicit/512/0.1/1.25/5/observable；cursor-agent auto pending 实测）且 **profile schema 校验**；dev 观测脚本就位，**连续同类型 round `/cost` 读 tok > 0 可测**（验收记录实测值）；收益边界（TTL 窗口内主张/跨时段不承诺）入文档
- **skills 守则**：skill-authoring.md 含「流程调整回顾整流程」守则节；validate digraph↔节点完整性校验块（孤儿/悬空零，P5 同类测试升格正式块）
- **cdd 缺口**：`cdd fix --type branch` 可用（branch-review findings 全经 engine 闭环，cli-driven-development 零编排 inline）；dry-run 脏树下 **EXIT 0**（豁免 entry-gate，11 个 dry-run 黑盒用例转绿）；黑盒干净树前置文档化（vitest config/测试注释/CLAUDE.md）；跨 Task findings 承接走 pending-acceptance-patch（T7 实证：fix agent 零 plan 修改权）；4 模板含纪律条款（English 注释/EOF/禁大目录 find/plan 零修改权）；锚点终态校验执行（T17/T18 类 review 不再报）
- **stall 探测器**：派生 agent 卡死 >IDLE_WINDOW 被杀且落 TIMEOUT handoff（blocker 含清偿指引）；无整过程 90min 拖死事件（dev 实证）；liveness monitor 双信号判据测试绿
- **内存守卫**：vitest `maxWorkers=1 + fileParallelism=false + maxConcurrency=2` 持久配置（复核断言），567 tests 正常负载无 OOM
- **v1.13 收口**：smoke workspace flake 已排查稳定；changeset 消费后版本落地已验证
- **brainstorming 自省四修**：**全域 session-call 零虚假 run 措辞**（6 skill ~17 个 `Run a /` 节点全改内联消费 + 产物记载 + skill-authoring session-call 原语定义修订）；grilling 流程含需求全量逐项枚举步骤（先枚举后 frontier）；validate 脚本 maintainer-only 边界记录于 maintainer docs 与 writing-overall-spec 流程；**pre-commit 脏树零结构性失败**（dry-run 豁免上移门判 + 黑盒树依赖用例 mkdtemp 隔离或 CI-only + 钩子收敛树无关子集）
- **收口复核**：全 plan/spec 锚点对实态零漂移；残留守卫（vendors/.agents/droid-pi 语汇）零命中；逐 phase changeset 齐备 + P6 自身 changeset 存在 + `version --dry-run` 落地；maintainer docs 与落地行为一致（exemplars/skill-authoring/third-party-deps/CLAUDE.md dev 段零陈旧引用）；`pnpm run validate` **12 块全绿** + `emit:check` 无 drift

---

## Section 3: Deviations from overall

| Overall assumption | Phase decision | Overall updated? |
|---|---|---|
| P6 = 统一规划收口（v1.2 初始） | 扩张为六域：宣称收缩 / vendors 撤离 / 测试就近 / cache C1–C7 / skills 守则+engine 机制 / 收口复核（v1.2→v1.35 逐版本登记） | Yes — v1.35 ★ 2026-09-18 |
| repo `scripts/` 编排层 `.mjs` 基准留存（v1.34） | 全量 `.ts` 化（Q2-B，Node24 strip-types） | Yes — v1.35 |
| osuperpowers scripts `.mjs` 二选一待裁（v1.34） | 保留 `.mjs` 隔离（Q1-A，发布面零依赖裸 node 契约） | Yes — v1.35 |
| prompt-cache 五杠杆（v1.28） | 升维为 cache-first C1–C7 + registry cache profile 数据面（跨厂商通用方法论六公理） | Yes — v1.35 |
| vendors 撤离（v1.16） | 升级「自维护面全撤」（workflow/release/validate/checkout/CLAUDE.md） | Yes — v1.35 |
| template 壳（P4 共享壳） | 壳单源结构性字节恒等（partial/常量）——P4 的「一份共享壳」显式化 | Yes — v1.35 |
| 统一规划收口（v1.2 初始）不含流程自省面 | 增 brainstorm 自省四修（session-call 诚实化 / 需求全量清单 / validate 边界 / pre-commit 结构性修复） | Yes — v1.36 ★ 2026-09-18 |

---

## Section 4: Notes for downstream

- **P6 为终局 phase**：hard 链末端，无后续 phase 承接。writing-plans → cli-driven-development → finishing 的完整链走完即程序收官。
- **无 submodule 环境**：域 B 执行后本仓不再含 submodule——plan 期在无 `vendors/` 环境执行；任何后续「新增 vendor 依赖」均触发防回渗守卫与决策复审。
- **黑盒干净树前置**：P6 全程（尤其 T1–T9 各 task-review）需遵守「进入 review 前工作树干净」——engine 入口门强制执行；pre-commit 全量 validate 在脏树上的 dry-run 失败是已知结构性矛盾（域 E2② 修复 dry-run 豁免 + ③ 文档化）。
- **消费方视角**：`report-templates.mjs` 运行时路径（`${pluginRoot}/scripts/report-templates.mjs`）**保持稳定**（Q1-A 保障）——发布面改动需从消费者环境无构建前提复核（overall「Consumer perspective」）。
- **cache 验收需真实 harness**：T5 观测验收为 dev 侧（有 claude 环境）文档化测量；CI 无 harness 不 gate 此验收——记录实测值于验收证据。
- **changeset 边界**：P6 自身 changeset（osuperpowers minor + cdd-engine minor 评估）在 finishing 前随逐 phase 复核（F3）落定。

---

## Section 5: Review

Fresh-Subagent Review Passes（cdd spec review，fresh agent）必须全过，才进入用户 review 与 writing-plans。