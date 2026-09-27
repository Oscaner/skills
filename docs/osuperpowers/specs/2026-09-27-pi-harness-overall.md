# Pi Harness 支持（Pi Harness Support）— Overall Spec

- **Version**: v1.5 · 2026-09-28
- **Status**: Approved
- **Author**: [human] · Claude Opus 5 (1M context) (osuperpowers:brainstorming)
- **Constraints**:
  - 仓库语言政策：SKILL.md / docs 英文主源；本 spec 中文（Strategy B internal docs）
  - 不 commit 除非用户明确要求；spec 交付除外（writing-overall-spec I2 立即提交）
  - changeset 逐 phase 建
  - **允许破坏性变更**（2026-09-27 用户拍板）：作用面 = 工具链/构建面 + 用户可感知命名统一面（README / 安装命令 / 引擎输出 / 记录显示值）；**例外：CLI 二进制名**（外部事实，registry `cli` 字段保留 `claude` / `cursor-agent` / `pi`）
  - harness 标识符全线统一 = `claude` / `cursor` / `pi`（`cursor-agent` 标识符退役，仅二进制名残存）——doc word = code word = engine token：改名面即改 validator 面
  - D2 manifest 来源：pi 字段 = package.json 源侧手维护 + validate 守卫；emit 产物面不新增 pi 文件（pi 无独立 manifest 文件——已发布 npm package.json 的 `pi` 字段即 manifest，与 claude/cursor 的 `.claude-plugin/` 式产物形态不同）
  - D4 宿主检测事实（2026-09-27 官方源码+docs 核实）：`AI_AGENT=pi` + `PI_CODING_AGENT=true` 为 ambient 进程标记（继承给全部子进程）；`PI_SESSION_ID` 仅注入 LLM bash/powershell 工具子进程，不作宿主检测用
  - D5 同名技能事实（2026-09-27 官方源码核实）：pi 按 precedence 确定性 first-wins（project > user > package；包间按 settings `packages[]` 数组序），败者静默丢弃 + collision warning（非错误、永不双留）——osuperpowers 的 override 设计在 pi 的原生表达 = 包序在前
  - 开发期引擎调用：`node packages/cdd-engine/dist/cli.mjs` 直调（`dev:stub` 后），不走 global register

## Document scope

Charter only — no implementation detail.
- **Overall approval is not equivalent to any phase started**（GATE）。
- 变更先回填本 overall（backfill-as-version），再继续实现。

## File paths

| Artifact | Path |
|---|---|
| Overall | `specs/2026-09-27-pi-harness-overall.md` |
| Phase spec | `specs/2026-09-27-pi-harness-p<N>-design.md` |
| Phase plan | `plans/2026-09-27-pi-harness-p<N>.md` |

## Program charter

**Goal**：osuperpowers 成为第三 harness 面 pi 上的一等分发物——npm 原生 pi-package（`pi` 字段 + `keywords: ["pi-package"]`）直接 `pi install` 消费，八 skill 全量可见；以本次新 harness 为杠杆，把全仓 harness 命名统一为 `claude` / `cursor` / `pi`（`cursor-agent` 标识符退役，仅 CLI 二进制名残存），并把 emit 分发的 per-harness 硬编码升级为 registry 化（`harnessesNote` 死字段债清除）。engine 数据面同步加 `pi` 行 + `AI_AGENT=pi` 宿主检测（registrate 三面命名一致的唯一事实源）。验收即消费者视角：`pi install npm:@oscaner-skills/osuperpowers` 后八 skill 可加载；claude / cursor / pi 三面命名一致、文档标识符面（README 家族 + CLAUDE.md + docs/maintainers live 档）零 `cursor-agent` 残留（历史豁免清单除外）；`pnpm run validate` 全绿。

**Non-goals**（非目标，明确不发散）：
- 不重命名 SKILL.md `name`——技能名无 harness 性，重命名不构成统一；pi 同名冲突（osuperpowers ↔ superpowers）走 D5 消费故事（包序 = override 语义）
- 不合并 engine `harness-registry.json` 与 emit 分发注册表——分层不可破：cdd-engine 是 osuperpowers 的依赖，反向耦合破坏包边界（engine 注册表 = spawn 契约面，emit 注册表 = 分发 manifest 面，各自整形）
- 不写 osuperpowers pi 运行时扩展——D4 事实：`AI_AGENT=pi` 环境标记即宿主检测（engine `detectCurrentHarness` 已消费 `AI_AGENT`），osuperpowers 无 bootstrap 注入需求（上游 superpowers extension 的存在理由在本包不成立）
- 不给 pi.dev 长廊建本仓聚合 manifest——pi 分发 = npm 原生 + `keywords` 即发现键；`marketplace/source.json` 面不扩 pi 条目（它服务于 claude/cursor 两个 marketplace）
- 历史记录不 retro-rename——CHANGELOG 既有条目、2026-09-13 家族 spec/plan 是当时事实的忠实记录（豁免清单 P4 注册）

**Cross-cutting**（程序级横切约束，先立后执行）：
- **harness 命名一致性**：标识符 `claude`/`cursor`/`pi` ↔ 二进制 `claude`/`cursor-agent`/`pi` ↔ 宿主 marker `CLAUDE_CODE_SESSION_ID` · `AI_AGENT=claude-code*` / `CURSOR_TRACE_ID` / `AI_AGENT=pi`——三面映射表（名义映射表）P4 落 README
- **D2 来源归属**：`pi` 字段 + `keywords` 源侧手维护（与 `version`/`description`/`files` 同源）；validate 加 pi-package well-formed 守卫；否决 emit 自反写回 package.json（源==产物自反破坏 changeset/version-sync 工作流）
- **D4 检测链路**：`detectCurrentHarness(env)` 增 `AI_AGENT === "pi"` → `pi`；`harness-registry.json` 增 `pi` 行（`cli`/`ship: "full"`/per-op prefix+suffix/cache profile——过 `registry.cache.test.ts` 全行迭代 schema 校验）；D4 事实：pi 二进制无 headless 非交互 spawn 通道（区别于 claude/cursor 的 `-p`/`--print` invoke 面）；引擎对 pi 的 spawn 采用 `pi -p` 风格 print 模式（per-op 形态 P3 phase spec 定稿）
- **D5 消费故事**：pi 下 osuperpowers 与 superpowers 同名技能（brainstorming / writing-plans 等）first-wins 包序裁决——osuperpowers 排前即 override（与设计意图同构）；collision warning 属预期，文档明示；inline import（`/superpowers:*`）在碰撞下的解析语义 P4 定稿

## Issue inventory

| Phase | Issue (ref) | Title summary |
|---|---|---|
| P1 | none | 包侧 pi 分发面：osuperpowers package.json 增源字段 `keywords: ["pi-package"]` + `pi: { skills: ["./skills"] }`（扩展面按 D4 事实 = 零运行时扩展）· `files` 白名单闭包校验（pi 声明引用路径全部在发布 tarball 内）· validate pi-package well-formed 守卫（字段 / 关键值 / 路径存在性 / 白名单覆盖）· node:test 骨架断言 manifest 结构 |
| P2 | none | emit 分发面注册表化：`oscaner-plugin.harnesses` 从死字段（harnessesNote 明言 no script consumes）转为真消费——ManifestService / OsuperpowersEmitter / source.ts FIRST_PARTY_CURSOR 硬编码收编为 harness builder 注册表，pi 分发条目注册（包侧 manifest ↔ 注册表一致守卫） |
| P3 | none | engine 数据面 harness 标识符全线统一（cursor-agent 退役）：`harness-registry.json` 行键 cursor-agent→cursor · `detectCurrentHarness`/`requireHostHarness` 匹配面 · host-detection/registry/cache/invoke/dispatch-set 测试与 `scripts/observe-cache.ts` 同步 · docs/maintainers 引擎 registry 行键镜像（03-context-caching-doctrine.md Baseline entries）随行改名 · validate pin 面（smoke-cdd / residue 通道守卫 grep 目标）随改名面更新 · `cdd` 记录与 `h`/`id` 显示值归一（历史豁免清单注册） |
| P3 | none | engine pi registry 行 + 宿主检测（D4 事实定稿）：`pi` 行（registry 键 `pi` · `cli` 二进制 `pi` · ship full · per-op prefix/suffix · cache profile）+ `AI_AGENT === "pi"` → pi 映射（PI_CODING_AGENT=true 佐证；AI_AGENT 通道已是 claude 在用，对等式零新机制） |
| P4 | none | 文档统一 + 消费故事：README 家族（root / CLAUDE.md / osuperpowers 双镜像）harness 矩阵 + `pi install npm:@oscaner-skills/osuperpowers` 段 + 名义映射表（标识符/二进制/宿主 marker）· D5 消费故事定稿 · 历史豁免清单（CHANGELOG 条目 / 2026-09-13 family）注册 |
| P4 | none | 测试·validate 接线 + CHANGELOG：pi manifest 测试（node:test 进 validate glob）+ 命名统一 pin 测试 + validate 块接线全绿 + changeset + CHANGELOG 记录 |

## Phase inventory

| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |
|---|---|---|---|---|---|---|
| P1 | 包侧 pi 分发面 | osuperpowers 作为 pi 包可安装消费：源字段 `keywords: ["pi-package"]` + `pi: { skills: ["./skills"] }`（D2 手维护）· `files` 白名单闭包 · validate pi-package well-formed 守卫（一等 CheckBlock + node:test 背靠，进 validate glob）· validate 命名 pin 升级（count→name-set，保 anti-white-green 语义） | Done（v1.5 · 2026-09-28） | Done（v1.5 · 2026-09-28） | `npm pack` 产物 `pi install <本地解包> --local --approve`（trust gate 实测）装入临时项目，安装产物 8 SKILL.md 落盘 + project settings 写入，pi-package 守卫过 validate 全绿；validate CI 装配 pi（`@latest` 不固定版本）；release 站删除（v1.4 裁定——post-publish detect-only 无门控、内容与 C4 同构、claude/cursor 无 post-publish smoke 一致；npm-source 解析风险 = 已知残余 P4 记录） | 无（program 起点） |
| P2 | emit 分发注册表 | harnessesNote 债清除：`oscaner-plugin.harnesses` 真消费 · ManifestService/OsuperpowersEmitter/source.ts 硬编码收编 harness builder 注册表 · pi 分发条目注册 · 包面 ↔ 注册表一致守卫 | [Pending] | [Pending] | emit:check 零漂移；harness 增减即注册表一行接线；harnessesNote 退役；validate 相应块全绿 | P1 ->(hard) |
| P3 | engine 数据面 | cursor-agent→cursor 全线 rename（engine src/tests + observe-cache + validate pin 面 + docs/maintainers 行键镜像）+ `pi` registry 行（ship full · per-op prefix/suffix · cache profile 过全行迭代校验）+ `AI_AGENT=pi` detect 映射；`cdd` 记录/h·id 显示值归一；历史豁免清单声明 | [Pending] | [Pending] | registry/cache/host-detection/invoke 测试全绿；三位宿主（claude/cursor/pi）origin 全测；residue 通道守卫零回归；记录值零 cursor-agent；docs/maintainers 行键镜像零 cursor-agent | P1 ->(hard) |
| P4 | 文档·测试·收口 | README 家族统一 + 名义映射表 + pi 安装段 + D5 消费故事 + 历史豁免清单 + pi/命名 pin 测试接线 + validate 全绿 + changeset + CHANGELOG | [Pending] | [Pending] | validate 全块全绿（pi 测试在内）；文档标识符面（README 家族 + CLAUDE.md + docs/maintainers live 档）零 cursor-agent（历史豁免清单除外）；D5 消费故事交付（pi 下 collision first-wins 包序裁决文档明示 + inline import `/superpowers:*` 碰撞下解析语义定稿 + 历史豁免清单注册）；双镜像同步；四表回填一致 | P2 ->(hard)（+P3，见依赖图） |

## Dependency graph (ASCII)

```
P1 -> P2   (hard: 分发注册表接入 pi 分发条目依赖 P1 的 manifest 源字段)
P1 -> P3   (hard: engine pi 数据面与 P1 消费同一 pi-harness 契约语义——包侧先落源，engine 行随契约登记)
P2 -> P4   (hard: P4 的 validate 接线消费 P2 注册表产物)
P3 -> P4   (hard: P4 的消费故事/名义映射表依赖 P3 的命名与检测语义定稿)
```

Legend:
- `->` = hard block（依赖前置 phase 发布后方可启动）
- `-> (soft)` = suggestion only（非阻塞排序建议；本图无边）

执行顺序按注册序串行（P1→P2→P3→P4，边界规则承载）；依赖图记录数据面真实边（P3 与 P2 属平行平面，DAG 表达）。

## Boundary rules

- 每 phase 完整 brainstorm → plan → dev，shipped 后依赖方才启动；serial-phase 规则含：注册 phase 的 hard-dependency 前驱 Design spec ≠ Done → BLOCKED
- 需求变更在 phase 中发生时，**先回填本 overall**（version bump + change-history 行 + 同步受影响 phase 的 scope/acceptance/dependency），再继续实现
- 技能名（SKILL.md `name`）一律不动（Non-goal #1）；live 面 rename 的「名义映射表语义」P4 收口前不落到消费者侧文档

## Maintenance

- 四表随每 phase 回填：Issue inventory（新增 anchor 注册）、Phase inventory（design/plan 列状态 + dep 边）、Dependency graph（节点变化同步）、Change history（版本行逐 phase 追加）
- Charter only——无任务清单；phase 细节归 phase spec；策略转向（如 D4 检测链路遇阻、pi 包被 pi 生态规则挟持）立即回填本 overall 后再议实现

## Change history

| v1.0 | 2026-09-27 | 程序 charter：pi harness 支持——osuperpowers 第三 harness 面一等分发物（npm 原生 pi-package：`pi` 字段 + `keywords: ["pi-package"]`）；全仓 harness 命名统一 claude/cursor/pi（`cursor-agent` 标识符退役，CLI 二进制名残存）；emit per-harness 硬编码 registry 化；engine `pi` 行 + `AI_AGENT=pi` 宿主检测（P1–P4） | [human] · Claude Opus 5 (1M context) |
| v1.1 | 2026-09-27 | cdd spec-review r1（blocker=0，3 warn + 1 nit）全 finding 落地：`## Change history` 节补建（四表承台）+ D4 检测链路拆事实/规则双层 + docs/maintainers 行键镜像归入 P3 改名扫面 + Goal 与 P4 验收口径对齐 + P4 acceptance 补 D5 消费故事交付项（v1.0→v1.1） | [human] · Claude Opus 5 (1M context) |
| v1.2 | 2026-09-27 | 程序批准：Status Draft → Approved（user 启动 P1 brainstorm 为批准动作，backfill-as-version）；四表无 scope 变更；P1（包侧 pi 分发面）brainstorm 启动 | [human] · Claude Opus 5 (1M context) |
| v1.3 | 2026-09-27 | P1 scope 回填（grilling 定案，sync-before-write 前置）：验收两站化（validate 本地解包安装实证 + release npm 路径 smoke）+ validate 命名 pin 升级（count→name-set）入 P1 行；Issue inventory / Dependency graph 不变 | [human] · Claude Opus 5 (1M context) |
| v1.4 | 2026-09-27 | P1 设计评审裁定（user #1-4）：删除 C6 release 站（post-publish npm 路径 smoke——detect-only 无门控 + 内容与 C4 同构 + claude/cursor 无 post-publish smoke 一致性）；pi 安装不固定版本（`@latest`——契约对移动 pi 生态验证，防守卫随生态衰减）；P1 验收退回单站（C4 validate 站）；npm-source 解析风险 = 已知残余（P4 记录/人工抽查） | [human] · Claude Opus 5 (1M context) |
| v1.5 | 2026-09-28 | P1 终期债回填（engine CLOSEOUT）：Design spec / Implementation plan 列 `[Pending]` → Done（spec v1.5 + plan v1.5 approved，P1 四任务 cdd 链全闭环）；changeset 已建（`pi-harness-manifest-pin.md`，osuperpowers minor） | [human] · Claude Opus 5 (1M context) |
