# P1 cdd-engine 进程生命周期统一管理 + 结构重排 — Phase Spec

- **Version**: v1.0
- **Status**: Draft
- **Author**: [human] · Claude Opus 5 (1M context) (osuperpowers:brainstorming)
- **Parent program**: [2026-09-10-session-report-246-overall.md](2026-09-10-session-report-246-overall.md)（v1.4 → 本 phase 扩展后 v1.5）
- **Depends on**: 无（program 起点）

---

## Section 0: Incremental warning

> P1 increment only。跨 phase 约定在 [overall](2026-09-10-session-report-246-overall.md)；冲突时 overall wins。

---

## Section 1: Constraints pointer

> 不重复 overall 约定。守则：SKILL.md / docs 英文主源、本 spec 中文（Strategy B）；vendored 子模块不可改；不自动 commit；`pnpm run validate` 12 块全绿；逐 phase changeset（本 phase → `@oscaner-skills/cdd-engine` minor）。cdd-engine 不在 `pnpm run emit` 输入面（package.json 无 `oscaner-plugin` 字段），结构重排不触发 emit 漂移。

---

## Section 2: Design body

### 2.1 根因（F1）

F1 实测：连续多次 CDD 运行后 `claude -p` implementer 驻留进程累积至 GB 级 RSS。引擎侧结构事实（2026-09-11 勘察）：

- 全部派生点经 `cli-shared.mjs` 的 `spawnCapture`（execa）——未设 `detached`，无进程组隔离；
- execa timeout 只对顶层 PID 发 SIGTERM（实测 `error.signal = SIGTERM`），`claude` 派生的 session server / subagent 属孙代进程，随顶层被杀而孤儿化，或随顶层正常退出而独立存活；
- runner 在派发返回后无任何 teardown / reaping 步骤；`claude -p` 的续跑会话（session server）无退出通道；
- 无 idle backstop：超时挤出的孤儿、正常退出残留的 server 无人回收。

三种现象（超时孤儿 / 正常退出残留 server / 续跑会话未收尾）同源：**引擎只认直接子进程，子进程树与生命周期无人 ownership**。

### 2.2 统一抽象：Process-Lifecycle Manager（`lib/lifecycle/proc.mjs`）

用户决策（2026-09-11）：允许破坏性更新；从高维度做统一抽象；不留技术债务。

**A. `spawnManaged()` 统一工厂** —— 引擎全部派生点出生收敛于此：

| # | 派生点 | 路由 |
|---|---|---|
| 1 | task implement/review/fix | `spawnManaged` |
| 2 | docs spec/plan review/fix | `spawnManaged` |
| 3 | branch-review | `spawnManaged` |
| 4 | research | `spawnManaged` |
| 5 | review-package bash | `spawnManaged` |

- spawn 语义：`detached: true` → 独立进程组（pgid = 子 PID）；stdout/stderr 管道继承不变（stream-json 契约不动）。**弃用 execa `cleanup: true`**——实测 execa v9 在 `detached: true` 下 cleanup 终止钩子不安装（`execa/lib/terminate/cleanup.js` 首行 `if (!cleanup || detached) return;`），`cleanup: true` 是静默 no-op；父死回收改由下述跨 run 机制承担。
- 父死回收机制（引擎被杀兜底；替代被弃用的 cleanup）：run 级 registry 双写内存 + 落盘（`.superpowers/cdd/lifecycle.json`，跨 run 复用同一路径）；引擎被 SIGKILL/crash 时同进程无处理器可执行（SIGKILL 不可捕获），回收延后至下次引擎启动：启动先做跨 run `reapStale()` —— 读 registry 持久项 + `ps` 扫描孤儿 pgid（组内 leader 已死而组仍存活）→ 走 §2.2 B 连根回收。
- 注册：每个派生组写入 run 级 registry `{ pgid, label, dispatch, createdAt }`。

**B. `teardownAll()` 统一回收点** —— run 边界 + CLI 信号：

- 挂接：`runTask` / docs / branch-review / research 各入口 `finally`；`bin/cdd.mjs` 安装 SIGINT/SIGTERM/SIGHUP handler。
- 语义：遍历 registry → `process.kill(-pgid, 'SIGTERM')` → 宽限 5s（对齐现 `forceKillAfterDelay`）→ SIGKILL → 注销。`claude` 的 session server 是组内后代，随组连根退出 = F1「退出续跑会话、释放整场派生进程」。

**C. Idle backstop（超时兜底）** —— dispatch 已返回而进程组仍存活者（超时孤儿 / 正常退出残留 server）：

- run 边界与长 run 低频监视点执行 `reapStale()`：registry 中存活超时组 → 走 B 的连根回收；
- 跨 run 兜底：引擎被 SIGKILL/crash 的孤儿组无同进程处理器可即时回收，registry 落盘项在下次引擎启动时被跨 run `reapStale()` 扫回（`ps` 孤儿 pgid → 连根回收，见 A）。

**D. 契约不变与反悖守卫** ——

- `spawnManaged` 保持 `{ok, code, stdout, stderr, timedOut}` 五字段（合并原 `spawnCapture`，不保留薄封装）；`invokeCli / invokeCliWithRetry` 原样透传；现直调 spawnCapture 的两处派生点（`runResearch` standalone 采集、runner review-package bash）改直调 `spawnManaged`，调用点只换内部实现；
- 架构违例守卫测试：断言引擎全部派生经 `spawnManaged` 注册（registry 覆盖度），绕过即红。

**E. CLI 布局（随 §2.3 重排）** —— `lib/lifecycle/proc.mjs`（spawnManaged / teardownAll / reapStale）+ `lib/lifecycle/cli.mjs`（ex `cli-shared.mjs`：注入 / 超时 / 重试 / NDJSON 解析保留；内部经 proc.mjs 落 execa）。

### 2.3 结构重排（用户请求：目录结构与文件命名重新整理）

**目标布局：**

```
packages/cdd-engine/
├── bin/cdd.mjs                # 薄入口：shebang + import { program }（parse.mjs）+ parseAsync + isMain 守卫（零命令定义；分界见下）
├── lib/
│   ├── cli/                   # ex cdd.mjs L132-476 四个 orchestrator（program/action 带 L480 起另列 parse.mjs）
│   │   ├── review.mjs         #   runReview（task/branch/spec/plan 四型派发；spec/plan 支路 resolveTargetDoc → runDocsTask）+ 共享守卫助手（requireHostHarness / **detectCurrentHarness** / resolveTargetDoc / reviewStoppingGuard / existingRoundHandoff / blockerCount / stoppedExit3 / intTask，ex cdd.mjs L33-117 顶部导出，供 fix/research/parse 复用）——detectCurrentHarness 随 requireHostHarness 归本簇（host-detection.test.mjs 的 `import { detectCurrentHarness } from "../cdd.mjs"` 改指本模块，薄入口后无此导出）
│   │   ├── branch-review.mjs  #   runBranchReview + writeBranchBlocked（ex cdd.mjs L121，branch-review 专用 blocker 写入）
│   │   ├── fix.mjs            #   runFix
│   │   ├── research.mjs       #   runResearch（ex cdd.mjs L412-476）+ ex research.mjs（prompt build + findings write；现直调 spawnCapture → 改直调 spawnManaged，见 §2.2 D）
│   │   └── parse.mjs          #   commander program 定义 + 全部 action（含 implement 动作，ex cdd.mjs L480-573 至文件尾）+ parse 错误归一（usageError / SUBCOMMAND_USAGE，ex cdd.mjs L33-48）
│   ├── lifecycle/
│   │   ├── proc.mjs           # ★ P1 新核心（spawnManaged / teardownAll / reapStale）
│   │   └── cli.mjs            # ex cli-shared.mjs（注入 / 超时 / 重试 / NDJSON 解析保留；内部经 proc.mjs 落 execa）
│   ├── runner/
│   │   ├── run-task.mjs       # ex runner.mjs
│   │   ├── run-docs.mjs       # ex docs-runner.mjs（命名消除双 runner 歧义）
│   │   └── review-loop.mjs    # ex review-loop.mjs
│   ├── handoff/
│   │   ├── naming.mjs         # ex handoff-naming.mjs
│   │   ├── finalize.mjs       # ex handoff-finalize.mjs + ex contract.mjs 状态派生簇（normalizeHandoffStatus / classifySeverity / rollupStatus / deriveReviewStatus / applyDerivedStatus —— applyDerivedStatus 本为 finalize 消费方，同簇内聚于此）
│   │   ├── write.mjs          # ex contract.mjs：writeHandoff / writeOwnHandoff / readJson
│   │   └── schema.mjs         # ex schema-utils.mjs
│   ├── contract/
│   │   └── commit.mjs         # ex contract.mjs：validateCommitContract / gitToplevel + git 侧（gitRevParseHead / gitCatFileCommitExists / rewriteHandoffBlocked）—— contract.mjs 全量符号归位完毕
│   ├── state/
│   │   └── progress.mjs       # ex progress.mjs
│   ├── registry.mjs           # ex registry.mjs（harness-registry.json 移入 lib/ 相邻）
│   ├── templates.mjs          # ex templates.mjs（renderModePrompt/pluginRoot）
│   ├── brief.mjs              # ex brief.mjs
│   └── exit.mjs               # ex utils/exit.mjs（消单文件目录）
├── templates/                 # 不变（task/ review/ schema/）
├── tests/                     # ex bin/tests/（含 fixtures/；vitest 默认 glob 覆盖，config 免改）
└── package.json               # bin 不变；files → ["bin/","lib/","templates/"]
```

**bin/parse 分界（消除「commander parse」与「program 定义」歧义）：** `bin/cdd.mjs` 仅 shebang + `import { program } from "../lib/cli/parse.mjs"` + `program.parseAsync()` + isMain 守卫，定义零命令；`lib/cli/parse.mjs` 定义 program（`new Command()`，含 `exitOverride` / parse 错误归一）与全部子命令 action（含 implement 动作）。

**contract.mjs 消费方 import 断言（重排新树内全部可解析）：** handoff/finalize.mjs 的 applyDerivedStatus（同文件）+ gitRevParseHead（commit.mjs）+ readJson/writeOwnHandoff（write.mjs）；runner/run-task.mjs 的 write 三件（write.mjs）+ gitToplevel/validateCommitContract（commit.mjs）+ normalizeHandoffStatus（finalize.mjs）；brief.mjs 的 gitRevParseHead/gitToplevel（commit.mjs）。

**破坏面（原则上机械可控；「深度派生常数」专项与 smoke ENGINE 作用域两处须人工复算/扩列）：**

- 包内相对 import 全量更新；
- 模块深度派生的绝对路径常数专项（相对 import 更新无法覆盖，属 `__dirname`/URL 深度算术）：
  - `templates.mjs` 的 `PKG_ROOT = path.resolve(__dirname, '..', '..')`（现 bin/lib 深 2 级至 cdd-engine）：移入 `lib/templates.mjs` 后深度降为 1 级 → 改 `'..'`，或以 `import.meta.url` 相对 `templates/` 重写（推荐，消除深度耦合）；
  - `schema-utils.mjs` 同形 PKG_ROOT 移入 `lib/handoff/schema.mjs` 后深度不变（bin/lib ↔ lib/handoff 均 2 级）→ 复算并断言；
  - `runner.mjs` / `docs-runner.mjs` 的 `REG_PATH = new URL("../harness-registry.json", import.meta.url)` 与 `handoff-naming.mjs` 的 namespace URL 在 lib/ 族新深度下复算并列出断言——现推导恰好仍指向 `lib/harness-registry.json` / `templates/handoff-namespace.json`（深度巧合），须显式断言而非假设；
  - `cdd.mjs` 的 `REG_PATH = new URL("./harness-registry.json", import.meta.url)`（现深 1 级）随 orchestrators 迁入 `lib/cli/{review,research}.mjs` 后深度 1→2、`./harness-registry.json` 落到 `lib/cli/` 下必坏——**改为由 `lib/registry.mjs` 导出统一 REG_PATH（推荐）**，或 `lib/cli/` 下改 `../harness-registry.json`，并列出断言；
  - `bin/tests/registry.test.mjs` L11 同形 `REG_PATH = new URL("../harness-registry.json", import.meta.url)` 随 tests 移顶层后指向 `packages/cdd-engine/harness-registry.json`（文件已在 `lib/`）必坏——改从 `lib/registry.mjs` 导入或改 `../lib/harness-registry.json`，列入 re-org 回归断言清单；
  - 保留 templates.content / schema-utils 全套测试作绿灯凭据。
- `package.json#files` 由 `["bin/","templates/"]` 收敛为 `["bin/","lib/","templates/"]` —— 修「tests 随包发进 npm」发布面债（`npm pack --dry-run` 断言）；
- `.npmignore` 死条目清理：`bin/tests/`（tests 移顶层）与 `**/.gitkeep`（gitkeep 标记随目录位移 bin → lib / tests）删除或改指新位置，隔离统一由 `files` 白名单承担；
- `scripts/validate/residue.mjs` 机制位置 → `bin + lib + templates`；
- `scripts/validate/smoke-cdd.mjs`：① entry + fixture 路径；② `checkDeletionSurface` 的 `ENGINE` 作用域 const（`["packages/cdd-engine/bin"]` → `["packages/cdd-engine/bin", "packages/cdd-engine/lib"]`）——G2 --harness 词表扫描随 commander 参数定义移入 `lib/cli/parse.mjs`，ENGINE 覆盖扩至 lib；③ G3 --doc 扫描 scope 用的是**独立单文件入口路径**（`path.join("packages","cdd-engine","bin","cdd.mjs")`，非 ENGINE）——bin/cdd.mjs 薄入口化后零 flag 定义，该路径须改指 `lib/cli/parse.mjs`，否则 G3 退役 flag 语汇守卫对 engine 覆盖静默丢失；②③ 同步后 AC4「机制位置同步」对 G2/G3 均兑现；
- `docs/superpowers/{specs,plans}/*` 历史文档路径不改（记录豁免，residue 已豁免 docs）；
- 发布 CLI 接口（`cdd <subcommand>`）不变 —— 消费方（cli-driven-development SKILL 等）零破坏。

**执行顺序：先纯机械 re-org（git mv + import 更新，每步 validate 绿）→ proc-lifecycle 落在新布局**——每个模块只动一次。

### 2.4 数据流（lifecycle）

```
spawn（任一 dispatch）──→ spawnManaged（detached + pgid）──→ registry.push({pgid,...})
                                                                        │
dispatch 完成/超时/被杀 ──→ run 边界 finally ──→ teardownAll()
        │                                            ├─ SIGTERM(−pgid) → 5s → SIGKILL(−pgid)
        │                                            └─ registry.clear()
长 run 低频监视 ────────→ reapStale()：存活超时组 → 连根回收
引擎进程被杀 ───────────→ registry 落盘留存 → 下次启动跨 run reapStale()（ps 孤儿 pgid）→ 连根回收
```

### 2.5 错误与边界处理

- 超时路径：现有 TIMEOUT 部分 handoff + 组连根回收（不再留孤儿）；
- SIGKILL / unkillable：现有 BLOCKED handoff 语义不变，组回收兜底；
- registry 重复注册 / 已注销组：幂等（reap 对不存在组 fail-open）；
- teardown 抛错不得吞主流程（catch + stderr 记录，流程继续）。

### 2.6 测试

- **proc-lifecycle 单测**（`tests/lifecycle.proc.test.mjs`）：
  - 派生组触发隔离：子进程 spawn 孙进程，teardown 后孙进程必死（环境不允许时 skip 保护）；
  - `teardownAll()` 后 registry 为空；存活组被 SIGTERM/SIGKILL 连根回收；
  - `reapStale()` 对存活超时组执行回收、对已消失组 fail-open；
  - SIGINT/SIGTERM 路径触发 teardown；
  - 跨 run 父死回收：registry 落盘 → 模拟引擎被 SIGKILL（`kill -9`）→ 新进程启动跨 run `reapStale()`，`ps` 确认孤儿组（leader 已死、组仍存活，含孙代 session server）被连根收回；
  - 架构违例守卫：引擎派生点全部经 `spawnManaged`（registry 覆盖度）。
  - 兼容 `pool: 'forks'`（现有 vitest config 不变）。
- **re-org 回归**：既有全套 engine 测试（`pnpm -C packages/cdd-engine test`）在 mv 后全绿；residue / smoke 路径断言更新后 `pnpm run validate` 12 块全绿。

### 2.7 Acceptance criteria

（与 overall P1 同步，见 §3；各自独立可测）

1. 连续多次 CDD 运行后无 `claude -p` implementer 驻留累积（RSS 不随运行次数增长；run 结束后 proc-registry 为空）；
2. run 完成 / 超时 / 被杀三态下，进程组连根回收、续跑会话退出（「被杀」= dispatch 被杀、引擎存活 → 即时回收；引擎自身被 SIGKILL 的孤儿组由 AC3 跨 run backstop 于下次启动收回）；
3. 驻留进程有 idle backstop 兜底（含跨 run：下次启动扫回上次引擎被杀残留组）；
4. cdd-engine 结构重排：`bin/` 薄入口（仅 shebang + parseAsync）+ `lib/` 分簇 + `tests/` 顶层；`npm pack --dry-run` 不含 tests；residue / smoke 机制位置同步（变更清单见 §2.3 破坏面：residue → bin+lib+templates；smoke → entry+fixture+ENGINE 扩至 bin+lib）；
5. `pnpm run validate` 12 块全绿。

---

## Section 3: Deviations from overall

| Overall assumption（v1.4 P1 行） | Phase decision | Overall updated? |
|---|---|---|
| P1 scope 仅「implement 收尾后 runner 显式终止/回收派生子进程 + run 级 teardown（退出续跑会话、释放整场派生进程）+ 驻留进程超时兜底」 | 扩展为「全部引擎派生点统一进程生命周期管理（spawnManaged / teardownAll / idle backstop）+ cdd-engine 结构重排（bin 薄入口 + lib 分簇 + tests 顶层）」，破坏性重排 allowed | Yes — v1.5 · 2026-09-11 |
| P1 acceptance 仅「无 implementer 驻留累积 + 续跑会话退出 + 超时兜底」 | 追加「proc-registry 空断言 + re-org 布局 / npm pack 不含 tests / residue-smoke 同步 + validate 全绿」 | Yes — v1.5 · 2026-09-11 |

## Section 4: Notes for downstream

- P5（编排硬化）已含 base-branch artifact 写入口 — 本 phase 不改 artifact 写入；如 re-org 触及同一区域需回看整体。
- `scripts/validate/residue.mjs` / `smoke-cdd.mjs` 属 repo validate 套件，re-org 任务须同步更新并保绿。
- changeset：本 phase → `@oscaner-skills/cdd-engine` minor（历史 `p*-cdd-engine-overhaul.md` 同族先例）。
- P1 为 program 起点（无 hard 依赖）；P5/P6 等后续 phase 不受影响。

## Section 5: Review

Rule: Fresh-Subagent Review Passes must all pass before reaching user review and writing-plans.