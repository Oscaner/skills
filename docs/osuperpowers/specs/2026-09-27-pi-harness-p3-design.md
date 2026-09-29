# Pi Harness P3 — engine 数据面（Pi Harness P3: Engine Data Plane）— Phase Spec

- **Version**: v1.0 · 2026-09-29
- **Status**: Draft
- **Author**: [human] · Claude Opus 5 (1M context) (osuperpowers:brainstorming → writing-phase-spec)
- **Parent program**: [2026-09-27-pi-harness-overall.md v1.12](2026-09-27-pi-harness-overall.md)
- **Depends on**: P1（shipped · [p1-design v1.5](2026-09-27-pi-harness-p1-design.md)）；P2（shipped · 契约面定案——`{claude, cursor, pi}` 三元组行键集）

## Section 0: Incremental warning

本 spec 承诺恰好一个 phase（P3 engine 数据面）。若实施中发现需要拆分 / 重排 P3 的工作，不是本文件的局部编辑——phase inventory 行、依赖边、change-history 行必须先回填 parent overall（backfill-as-version）再继续。P3 之后的 phase（P4 文档·测试·收口）归其 spec；本 phase 的全部破坏性定案已于 overall v1.12 回填生效（P3 破坏性变更授权 + 豁免概念废除 + `cdd` 记录/h·id 显示值空壳废除 + pi 行形态定稿）。

## Section 1: Constraints pointer

跨 phase 约定以 parent overall v1.12 为准（overall wins on conflict），本 phase 不重复表述，仅指针：
- **P3 破坏性变更授权（2026-09-29，Constraints 登记）**：engine 数据面可重写代码 / 重整文件——约束 = 高维思考 / 抽象统一（OOP）/ 最佳实践 / 零技术债务
- **豁免概念废除**：守卫扫 live 面（engine src/tests + scripts + docs/maintainers + README 家族 + osuperpowers tests）零 `cursor-agent`，唯一允许命中 = registry `cli` 数据值；历史正文（2026-09-13 family / change-history 行）即史实，不 retro-rename、无豁免机制
- **CLI 二进制名不可改**（外部事实）：`cli` 字段保留 `claude` / `cursor-agent` / `pi`；名义映射表（标识符 ↔ 二进制 ↔ 宿主 marker）P4 落 README 渲染
- **Non-goal：注册表分层不破**——本 phase 的 engine registry（spawn 契约面）与 emit 分发注册表 `scripts/lib/harness-registry.ts`（分发 manifest 面）不合并（P2 定案延续）
- **host-marker 白名单恰 4 键不变**：`channels.env.hostHarness.markers` = `["AI_AGENT","CLAUDE_CODE_SESSION_ID","CURSOR_TRACE_ID"]` + `PATH`（engine-config.json:80-87，`context.test.ts:36` 钉死）——pi 检测复用 `AI_AGENT` 通道，零新键
- 开发期引擎直调 `node packages/cdd-engine/dist/cli.mjs`；spec/plans 中文（Strategy B）；changeset/commit 纪律不因本 phase 变更

## Section 2: Design body

#### 2.1 目标与范围

P3 把 engine 数据面收敛到与 P2 已定的分发契约同构：`harness-registry.json` 行键 `cursor-agent`→`cursor`（追平三元组 `{claude, cursor, pi}`），`detectCurrentHarness` 硬编码 if 链改 **OOP 多态**（Harness 抽象 + 子类 `detect(env)` 谓词 + 注册序 first-match），新增 `pi` 行（`cli` 二进制 `pi` · ship full · invoke `-p --mode text` · cache 未实测态）。用户前提（2026-09-29）抬升本 phase 为**抽象统一重构**：允许破坏性变更、高维 OOP、零技术债——detect 链、守卫面、显示面同步收编。范围外：engine 记录/artifacts 数据面（空壳废除声明，见 C4）、emit 分发注册表（Non-goal 分层）、README 家族收口（P4）。

锚点图例：O = OOP 决定、G = 守卫决定、R = 实证/声明决定；锚点仅供本 spec 内部溯源（与 parent overall 的 D 编号非同号异义）：

| 锚点 | 定案内容 |
|---|---|
| O1 | Harness OOP 抽象（grilling Q1 路线，用户拍板 A 方案）：`Harness` 抽象类 + `ClaudeHarness`/`CursorHarness`/`PiHarness` 子类 `detect(env)` 谓词多态；`detectCurrentHarness` 实现改注册序遍历 first-match；`harness-registry.json` 仍是发布资源 + 校验锚 |
| O2 | pi 行定稿（grilling Q1/Q2，pi CLI 本机实证）：`cli` `pi` · invoke `-p --mode text`（pi 无 `--force`/`--output-format`）· ship full · prefix/suffix 镜像 claude/cursor · cache = auto-prefix/pending/observable false（克隆 cursor 未实测态） |
| O3 | 注册序 = 优先级（grilling Q3）：`[cursor, claude, pi]`——SPECIFIC marker 先于 GENERIC env marker，与现状 if 链语义（CURSOR_TRACE_ID 先判）一致 |
| G1 | name-set 断言（grilling Q3）：registry 迭代测试断言行键**恰**为 `{claude, cursor, pi}`（anti-white-green，防未来再引入非归一标识符） |
| G2 | live 面 last-index 守卫（grilling R3 + 用户零豁免拍板）：engine src/tests + scripts + docs/maintainers + README 家族 + osuperpowers tests 扫 `cursor-agent` 即 fail；唯一允许命中 = registry `cli` 数据值 |
| R1 | `cdd` 记录/h·id 显示值 = **空壳**（实证）：artifacts/progress.ts、round-context.ts、return-block.ts、result-face.ts 零 harness 字段；真显示面 = observe-cache 日头（行键直出）+ issue 渲染 Host 行（宿主自报名）——scope 项改声明，见 C4 |

**C1 Harness OOP 抽象（O1/O3）** — 新模块 `packages/cdd-engine/src/infra/harness.ts`：
- `abstract class Harness`：`id`（row key）· 类型化行访问（cli/invoke/output/ship/cache/prefix/suffix 契约自持）· `abstract detect(env: NodeJS.ProcessEnv): boolean`
- 子类（谓词多态）：
  - `CursorHarness.detect(env)` = `Boolean(env.CURSOR_TRACE_ID)`（SPECIFIC，最高优先）
  - `ClaudeHarness.detect(env)` = `Boolean(env.CLAUDE_CODE_SESSION_ID) || (env.AI_AGENT ?? "").startsWith("claude-code")`
  - `PiHarness.detect(env)` = `env.AI_AGENT === "pi"`（`PI_CODING_AGENT=true` 佐证，D4 事实；GENERIC 通道，末位）
- 注册序常量（O3）：`[Cursor, Claude, Pi]`——first-match 即胜，SPECIFIC 先于 GENERIC，与旧 if 链行为等价（旧序 CURSOR_TRACE_ID → session → AI_AGENT；pi 接 GENERIC 末位）
- `detectCurrentHarness(env)`（shared.ts 签名不变，residue `detectCurrentHarness(process.env)` 直读锚点保持）实现改为：遍历注册序实例调 `detect`，命中返回 `instance.id`，全空返回 `""`；`requireHostHarness` 不变
- `Registry` 类（infra/registry.ts）不动为数据门面；新增的 OOP 层单向消费它（`harness.ts` → 读行 → 实例化），无反向 import

**C2 registry 行 rename + pi 行（O2）** — `packages/cdd-engine/src/infra/harness-registry.json`：
- 行键 `cursor-agent` → `cursor`（`cli` 值保持 `"cursor-agent"`——二进制名外部事实，唯一数据暴露点）
- 新增 `pi` 行：`cli: "pi"` · `invoke: "-p --mode text"`（本机 `pi --help` 实证：非交互 `-p` + `--mode text`，无 `--force`/`--output-format` 等价物）· `output: "text"` · `ship: "full"` · prefix（implement/review/fix 镜像 claude/cursor）· `suffix: {}` · `cache: {mechanism: "auto-prefix", minTokens: "pending", observable: false}`（克隆 cursor 未实测态——不虚报缓存特性，等实测填乘数）
- 行键集合 = `{claude, cursor, pi}`（G1 断言目标）；`additionalProperties` 约束不影响行级新增字段（cache 子对象 schema 已含 `required [mechanism, minTokens]`）
- 受影响代码面同步：`scripts/observe-cache.ts`（`--harness claude|cursor` 描述 + default claude + 日头行键）· `host-detection` 相关注释（shared.ts:24 / cdd.test.ts:190 等）

**C3 守卫与测试接线（G1/G2）**：
- `registry.test.ts` / `infra.registry.test.ts`：行键断言 `["cursor-agent",...]` → **恰 `{claude, cursor, pi}`**（G1，正向 + 无杂键反向）
- `registry.cache.test.ts`：cursor 行 profile 用例 + pi 行 pending profile 用例；全行迭代 schema 校验自动纳入 pi（零硬编码）
- `invoke.dispatch-set.test.ts`：`reg["cursor-agent"]` → `reg["cursor"]`
- `host-detection.test.ts`：表驱动重写——cursor（CURSOR_TRACE_ID）· claude session（CLAUDE_CODE_SESSION_ID）· claude AI_AGENT（`claude-code*` 前缀）· pi（`AI_AGENT=pi`）· unknown（`AI_AGENT=codex` → `""`）· **优先级矩阵**（CURSOR_TRACE_ID + AI_AGENT=pi → cursor；CLAUDE_CODE_SESSION_ID + AI_AGENT=pi → claude；全空 → `""`）——三位宿主 origin 全测（P3 验收）
- `scripts/validate/residue.ts`：新增 **live 面 last-index 守卫**（G2）——扫描 engine src（含测试）、scripts、docs/maintainers、README 家族、osuperpowers tests，`cursor-agent` 命中即 fail；唯一允许 = `harness-registry.json` 行 `cli` 字段值（白名单单点，非豁免清单——命中点随 registry 数据走）
- host-marker 白名单恰 4 键断言不动（`infra.context.test.ts` / `context.test.ts`）——pi 零新 env 键

**C4 空壳声明 + 坐标系分层（R1）**：
- **记录面空壳**：`artifacts/*` 与 `cli/result-face` 零 harness 字段（实证）——原 scope 项「`cdd` 记录与 `h`/`id` 显示值归一」无作业面，回填为事实声明（overall v1.12 已删）
- **显示面坐标系分层**：issue 渲染 `- Harness: <harness>` 行（`templates/report/issue-body.json:201`）数据源 = `report-issues/SKILL.md:34` 宿主**自报名**（如 `claude-code`），与 registry 行键**非同一坐标系**——P3 声明此分层（引擎行键 ≠ 宿主自报名），不改写 Host 行；P4 名义映射表承载渲染
- **observe-cache 日头**（`observe-cache.ts:235` 打印 `observe-cache: ${harness} · …`）是唯一"行键直出"显示面——随 C2 rename 自然归一，零额外作业

### Acceptance criteria

- `harness-registry.json` 行键集合断言恰 `{claude, cursor, pi}`（registry / infra.registry 测试 name-set，G1）
- `detectCurrentHarness` 表驱动测试全绿：cursor/claude-session/claude-AI_AGENT/pi/unknown + 优先级矩阵（CURSOR_TRACE_ID > CLAUDE_CODE_SESSION_ID > AI_AGENT；pi = GENERIC 末位）
- pi 行 `invoke` = `"-p --mode text"`，cache = `{mechanism: "auto-prefix", minTokens: "pending", observable: false}`，过全行迭代 schema 校验（registry.cache.test）
- residue live 面守卫：engine src/tests + scripts + docs/maintainers + README 家族 + osuperpowers tests 扫描 `cursor-agent` 零命中（唯一允许 = registry `cli` 数据值），validate 全绿
- `scripts/observe-cache.ts` + 测试使用 `cursor` 行键（零 `cursor-agent`）
- docs/maintainers 引擎 registry 行键镜像（`03-context-caching-doctrine.md` Baseline entries）改行键 `cursor` + pi 行，零 `cursor-agent`
- host-marker 白名单恰 4 键断言不变（`AI_AGENT`/`CLAUDE_CODE_SESSION_ID`/`CURSOR_TRACE_ID`/`PATH`）
- engine 测试套件（cdd-engine `pnpm test`）全绿，无回归

## Section 3: Deviations from overall

| Overall assumption | Phase decision | Overall updated? |
|---|---|---|
| P3 scope 含「`cdd` 记录与 `h`/`id` 显示值归一（历史豁免清单注册）」 | 记录面零 harness 字段（实证空壳）→ scope 项废除为事实声明；issue Host 行坐标系分层声明；豁免清单概念废除 | Yes — v1.12 · 2026-09-29 |
| D4「引擎对 pi 的 spawn 采用 `pi -p` 风格 print 模式（per-op 形态 P3 phase spec 定稿）」 | 定稿 = `invoke "-p --mode text"`（本机 `pi --help` 实证：无 `--force`/`--output-format` 形态） | Yes — v1.12 · 2026-09-29 |
| P3 原 scope「detect 匹配面改名」 | 升格为 OOP 多态化（Harness 抽象 + 子类 detect 谓词 + 注册序 first-match）——P3 破坏性变更授权内的抽象统一重构 | Yes — v1.12 · 2026-09-29 |
| P3/P4 原「历史豁免清单注册」锚 | 豁免概念废除：守卫扫 live 面零残留，唯一允许命中 = registry `cli` 数据值；历史正文即史实 | Yes — v1.12 · 2026-09-29 |

## Section 4: Notes for downstream

- **P4 名义映射表**：标识符 ↔ 二进制 ↔ 宿主 marker 三面映射的**数据**已由 P3（registry 行内 `cli`/`invoke` 数据 + OOP detect 谓词）承载；P4 README 家族只做**渲染**（registry 数据导出），零手写重复映射——P4 spec 消费本 phase 的 `harness.ts` 实例化面
- **P4 文档统一验收**：README 家族 + CLAUDE.md + docs/maintainers live 档零 `cursor-agent`（历史豁免清单除外——已废，历史正文即史实）；P4 需注意 `report-issues/SKILL.md:34` 的宿主自报名示例（`claude-code`）属于自报名坐标系，与 registry 行键分层
- **历史豁免**（已废概念）：本次 rename 不做 retro-rename；历史文件（2026-09-13 family / pi-harness 各 version change-history 行）保留 `cursor-agent` 原文即史实
- **engine dist 资源**：`harness-registry.json` 随包发布（build.config.ts copy → `dist/resources/`）；本轮 rename + pi 行 = engine npm 包数据面变更，需 changeset 记录

## Section 5: Review

Review Convergence 应用方：`cdd review --type spec --spec docs/osuperpowers/specs/2026-09-27-pi-harness-p3-design.md`。
- blocker > 0 → fix 全部 findings → `cdd fix` 后 re-review
- blocker = 0 → fix 全部 findings（warn + nit）→ done，不 re-review（Review Convergence 规则详见 parent overall section/各 orchestrator Invariants）
- commit 前提：Review 收敛（status = APPROVED / REVIEW_FIX 走 fix 闭环后），spec approved = commit immediately
- 本文件备选的偏离面已全部经 overall v1.12 回填（Section 3 四行 `Overall updated?` = Yes）