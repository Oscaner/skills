# CDD Engine Overhaul — P5 Design: Gate 移除 + harness 层全面清理

- **Version**: v1.2
- **Status**: Draft（P5 执行期 D14 追加）
- **Author**: [human] · Claude Opus 4.8 (osuperpowers:brainstorming)
- **Parent program**: [2026-09-04-cdd-engine-overhaul-overall.md](2026-09-04-cdd-engine-overhaul-overall.md) **v1.23**
- **Depends on**: P1 (soft) — gate env 传播产物；P2 (vendored superpowers 自带 per-harness manifests 保留)；P6 (handoff 三消费方收敛，已合并 #245)

---

## Section 0: Incremental warning

P5 为现有 program 的单 phase 增量。跨 phase 约定以 overall 为准，冲突时 overall wins。

## Section 1: Constraints pointer

外部约束见 overall（仓库语言政策 Strategy B：specs/plans 中文；breaking allowed；不 commit 除非用户明确要求；changeset 逐 phase 建；vendored submodule 不可改；已 merge 分支不可回改）。P5 特有：**只保留经过验证的 harness（claude / cursor-agent），其余 channel 全面移除**；删除必须清干净（不留 tech debt），非残留兼容层。

---

## Section 2: Design body

### 2.1 背景与根因（高维度归因）

P5 原 Charter 为 **Enhancement Q（#232 comment 5549287756）**：`cdd-gate`（PreToolUse 门禁）冗余且不生效 → 整体删除。

grilling + 代码探索后，发现更深的根因：**"harness 维度"被重复建模在五套独立机制中，而删除 gate 后它们全部失去存在理由**：

| 机制 | 内容 | 现状 |
|---|---|---|
| `harness-registry.json` | cli / invoke / ship / prefix·suffix（prompt 注入）— 7 键 | 生产消费（runner/docs-runner/research） |
| `harness-detect.mjs` | `detectInstalledHarnesses` 枚举已装 harness | 消费者仅 cdd select + install-harness（均删） |
| `skills-probe.config.mjs`（cdd-engine） | probe 方法 / dirs / installHint / channel — 12 键 | **生产死配置**（见 2.2） |
| `skills-probe.mjs`+`.config.mjs`（osuperpowers） | 与 cdd-engine 侧 IDENTICAL 复制 | **P2 迁移孤儿**——唯一消费者 install-harness |
| `cdd select` 子命令 + `cli-select` skill | 枚举 + 推荐 + AskUserQuestion 交互 | "选目标 harness" 维度冗余 |

**核心洞察（统一抽象）**：真实运行中，engine 永远被 **host harness 会话** 调用（本 program 全部 phase 实测 = claude）。"宿主即目标"——无需选择层。删除 `--harness` 显式参数（+ 选择/枚举/探测/安装层）后，engine 用 `detectCurrentHarness(env)` 单点判定 host；skill 层完全不关心 harness。

### 2.2 生产死配置实证（skills-probe 从未接线）

`runner.mjs` 的 runTask step 2.5 skills-gate 是 DI seam：
```js
const probeSkills = opts.probeSkills;   // cdd.mjs 的 runTask 三处调用点均不传
...
if (probeSkills) { ... }                // 恒 undefined → 整步跳过
```
cdd.mjs import 了 `skills-probe.config.mjs` 但 **从不注入 `probeSkills`**。因此 skills-probe（impl + 两份 config）+ harness-detect 是**从未运行的内置死功能**（仅测试 mock 覆盖）。删除是结构性消除，非兼容。

### 2.3 架构决策（全部 user 确认）

| # | 决策 | 依据 |
|---|---|---|
| D1 | `install-harness.mjs` + `bin/init/` 整体删除（含 `.github/actions/install-harness/` composite action + `pr-validate.yml` 引用，见 2.4 ① / ⑤） | 其写文件负载 100% 是 gate config |
| D2 | gate 专属语汇 residue guard 并入 `scripts/validate/residue.mjs`（零豁免） | "删了不回来"（P6 F5 同构） |
| D3 | `osuperpowers:init` skill 收缩为单节点纯 marketplace 指引（去 detect-harness/config/trust/summarize + `harness.md`） | D1 后无 install 机械 |
| D4 | `cdd select` 子命令 + `cli-select` skill 删除 | 选择层无存在理由 |
| D5 | `--harness` 参数整体删除（implement/review/fix/research）；engine 内部 `detectCurrentHarness(env)` 判 host | 宿主即目标 |
| D6 | host 检测空 → BLOCK（stderr + exit 1，不猜默认；marker 优先级 CURSOR_TRACE_ID > CLAUDE_CODE_SESSION_ID > AI_AGENT=claude-code*） | 只在服务态下运行 |
| D7 | Approach 1：host-harness manifest 单源 | per-harness 知识单点 |
| D8 | skills-probe（cdd-engine + osuperpowers 双份）+ harness-detect（cdd-engine + osuperpowers 双份）+ skill-gate tests 整组删除 | 从未接线的死功能 |
| D9 | channel 收敛为 **claude / cursor-agent**（pi/trae/vibe/kiro/droid/grok/qoder/codex/gemini/opencode 全面移除） | 只留经验证 harness |
| D10 | `cdd research` 删 `--harness`；cli-research 保留但去 select-harness 节点 | D5 全一致 |
| D11 | **review/fix 命令面统一被审目标参数**：`--doc` 退役，改 `--spec`（type=spec 被审）`--plan`（type=plan/task/branch 被审）；`--spec` 在 type=plan 时 = 上游 spec 参照。workspace slug 从被审目标派生 | 语义自解释，省 `--doc` 的文档说明 + token |
| D12 | 引擎测试 / smoke 迁移（~50 处 `--harness` 调用点 + smoke-cdd 四命令链）配套改造；测试/CI host-marker 策略：spawn env 注入现有 marker（`CLAUDE_CODE_SESSION_ID` / `CURSOR_TRACE_ID`）即判定 host | D5/D6 落地必需，见 2.4 ⑥ |
| D13 | **vendored 发布面 gemini 装配清净**：`vendor-assembly.mjs` 删 mattpocock gemini 分支（`thinGeminiExtension` + `geminiMarkdown` 补写 + `assertNoUpstreamGeminiExtension` guard）；`thinGeminiExtension`/`geminiMarkdown` 函数整删；publish-vendor.test / emit.test 对应用例删。superpowers 自带 gemini 产物（submodule 提交）保留不可改 | 收敛 claude/cursor-agent 后 vendored 补写 gemini = 未验证通道死代码（用户拍板） |
| D14 | **progress.json 所有权收归 engine**（P5 执行期 finding，[#232 comment 5612106797]）：engineRecoveryCount 的维护移入 engine（当前零 engine 写入点，仅 skill 文档要求 orchestrator 写）；cli-driven-development §engine-recovery / §timeout-decision 去掉「orchestrator 递增 progress.json」指令，orchestrator 只读 progress 判路由、完全不写 | 实测 orchestrator 手写 tasks 结构错（对象当数组）→ `progressData.tasks.find is not a function` dispatch 失败；progress 已全权归 engine（tasks/timeoutCount/status），仅 engineRecoveryCount 归于不清（用户拍板） |

### 2.4 删除面

**① gate 子系统**

```
packages/osuperpowers/bin/gate/                     ← 41 文件 / ~1720 行
  ├── cdd-gate-core.mjs + cdd-gate-decide.mjs
  ├── adapters/（claude/cursor/codex/opencode/trae/grok/gemini/pi/kiro/vibe/qoder + lib.mjs + pi.ts）
  ├── configs/（native-harnesses.mjs + per-harness hook 模板）
  └── tests/（63 tests）
packages/osuperpowers/hooks/hooks.json + hooks-cursor.json
packages/osuperpowers/tests/fixtures/cdd-gate/**
scripts/emit/manifests.mjs 中 gate hook 生成：cddGatePreToolUseHooks / osuperpowersClaudeHooks /
  osuperpowersCursorHooks / **codexHooksJson / qoderHooksJson / hooksFor** / osuperpowersHooksFor /
  assertAdapterPathsExist / gemini BeforeTool hook 相关
scripts/emit/osuperpowers.mjs 中 hooks write loop + assertAdapterPathsExist 调用
scripts/emit/emit.test.mjs 中 gate hooks 断言（~15 处）
scripts/validate/gate-hooks.mjs + scripts/validate/index.mjs 接线（block 5b2）
packages/osuperpowers/tests/ci-validate.test.mjs 中 5b2 step + gate suite glob 断言
packages/osuperpowers/package.json：`main`（→opencode adapter）、`pi.extensions`（→pi.ts）、
  描述 "cross-harness gate"、`oscaner-plugin.hooks` 映射（claude/cursor/codex/qoder）
```

**② harness 选择/探测/安装层**

```
packages/osuperpowers/skills/cli-select/            ← skill 整目录
packages/osuperpowers/bin/utils/harness-detect.mjs + tests/harness-detect.test.mjs
packages/osuperpowers/bin/utils/skills-probe.mjs + .config.mjs + tests/skills-probe.test.mjs   ← P2 孤儿
packages/cdd-engine/bin/utils/skills-probe.mjs + .config.mjs                                    ← 生产死配置
packages/cdd-engine/bin/utils/harness-detect.mjs + tests/harness-detect.test.mjs               ← cdd-engine 侧双份
packages/cdd-engine/bin/tests/skills-gate.test.mjs + select.test.mjs
packages/cdd-engine/bin/cdd.mjs：`select` 子命令 + runSelect + detectInstalledHarnesses import +
  `--harness` requiredOption（implement/review/fix/research 四处）+ usage 字符串
packages/cdd-engine/bin/lib/runner.mjs：DEFAULT_CHANNEL_MAP + probeSkills DI seam
packages/cdd-engine/bin/lib/cli-shared.mjs：CDD_GATE_WORKSPACE / CDD_GATE_MODE env 注入
```

**③ 未验证 harness 收敛 + 冗余 per-harness 产物**

```
packages/cdd-engine/bin/harness-registry.json：7 键 → 2 键（claude / cursor-agent；删 droid/pi/codex/copilot/gemini）
packages/osuperpowers/.codex-plugin/ .qoder-plugin/ .kimi-plugin/ gemini-extension.json GEMINI.md
  （emit 生成产物目录/文件，随 emitOsuperpowers 裁减而不再生成 → 现存文件删除）
scripts/emit/compare.mjs BASE_PRODUCT_ROOTS + productFiles 同步裁减
scripts/release/vendor-assembly.mjs：mattpocock gemini 分支删（import + assertNoUpstreamGeminiExtension +
  stageVendor 内补写块）—— superpowers 自带 gemini 产物（submodule）保留
scripts/emit/manifests.mjs：`thinGeminiExtension` / `geminiMarkdown` 整删（D13；`kimiPluginManifest` / `geminiExtension`
  亦整删 —— 无其他消费者；vendor-assembly 是 geminiMarkdown 仅剩消费方，随 D13 消失）
scripts/release/publish-vendor.test.mjs：thinGeminiExtension/stageVendor gemini 用例如（L542-590 段）
scripts/emit/emit.test.mjs：geminiMarkdown 用例（L278）+ GEMINI.md 产物断言（L646）删
```

**④ skill/docs 层（harness 概念出清）**

```
packages/osuperpowers/skills/cli-driven-development/SKILL.md：select-harness 节点删除（digraph B 边移除）、
  I1 Explicit Propagation invariant 删除、dispatch-mode 的 --harness 参数文本 + review/fix --doc → --spec/--plan 命令形态
packages/osuperpowers/skills/cli-research/SKILL.md：select-harness → host 检测（或直连 prepare-brief）
packages/osuperpowers/skills/brainstorming/SKILL.md + writing-plans/SKILL.md：spec-review/plan-review 节点
  `--doc <path>` → `--spec <path>` / `--plan <path>` 调用形态（D11）
packages/osuperpowers/skills/cli-driven-development/docs/cdd-reference.md：gate matrix 节 +
  harness registry 引用 + skills-probe 节（保留 commit-contract gate / HARD GATE 语义）
packages/osuperpowers/skills/_docs/review.md / init/SKILL.md / init/harness.md / report-issue/SKILL.md：
  harness powers 清理（report-issue 的 "same discovery as the gate hook" 措辞）；
  **_docs/review.md 为 URC SSoT，含 5 处 `--doc`/`--harness` 命令引用（run-review Do/Read 第 28-29 行 +
  cli-fix-all-findings Do 第 35 行 + Handoff Output 第 45 行）→ 全改 D5/D11 形态**；
  init/harness.md 随 D3 收缩为 marketplace 指引（detect-harness/config/trust 节点删除）
packages/osuperpowers/README.md + docs/maintainers/osuperpowers-plugin.md：gate 矩阵 / hooks 说明
```

**⑤ CI / workflow 面（review r2 F1 发现）**

```
.github/actions/install-harness/                     ← composite action，硬编码执行 bin/init/install-harness.mjs
.github/workflows/pr-validate.yml                   ← :18 `uses: ./.github/actions/install-harness` 引用移除
```

**⑥ 引擎测试 / smoke 迁移面（review r2 F2 发现）**

```
packages/cdd-engine/bin/tests/*.test.mjs：~50 处 `--harness <name>` 调用点（cdd.test.mjs ×21 /
  cdd-research.test.mjs ×13 / task.test.mjs ×7 / docs-task.test.mjs ×6 / branch-review.test.mjs ×3；
  含 `--harness nonexistent` 停 harness-gate 用例 + cli-shared.test.mjs gate-env 传播用例）
  → 均改 host 判定（测试/CI 子进程 env 注入 CLAUDE_CODE_SESSION_ID / CURSOR_TRACE_ID）；
scripts/validate/smoke-cdd.mjs：四命令链（implement/review task/fix/branch）`--harness claude` 移除
```

> **测试/CI host-marker 策略（D12）**：engine 测试与 smoke 子进程本身无真实 harness session → spawn env 按需注入既有 marker，无新增测试变量：目标 claude 注入 `CLAUDE_CODE_SESSION_ID=1`，目标 cursor-agent 注入 `CURSOR_TRACE_ID=1`，`detectCurrentHarness` 按原优先级（CURSOR_TRACE_ID > CLAUDE_CODE_SESSION_ID > AI_AGENT）判定。CI 需走 claude 分支的 step 同样设 `CLAUDE_CODE_SESSION_ID`。

### 2.5 保留机制（保留并扩展）

- `detectCurrentHarness(env)` —— **保留并扩展**：现实现 cdd.mjs:378-383（CURSOR_TRACE_ID → cursor-agent；CLAUDE_CODE_SESSION_ID 或 AI_AGENT=claude-code* → claude；否则空串）。D5/D6 下扩展为四子命令（implement/review/fix/research）共用入口 + **空 → BLOCK exit 1**（原 `--harness` 必填的替代语义）+ marker 优先级（CURSOR_TRACE_ID > CLAUDE_CODE_SESSION_ID > AI_AGENT=claude-code*）
- `harness-registry.json` 两键 manifest（claude / cursor-agent；cli / invoke / ship / prefix·suffix 字段保留）
- `registry.mjs`（checkHarness ship gate → CddBlockedError）、`resolveInjection` / `resolveSuffix` prompt 注入
- runner/docs-runner/research 的 runTask 链（registry ship gate → CLI preflight → workspace → renderModePrompt → 嵌套 CLI spawn）
- `validateCommitContract` / 模板 `HARD GATE` / URC Review Stopping / post-run commit-contract 语义（与 gate 无关部分）
- osuperpowers emit 其余功能（skills copy / .agents / marketplace）；vendored 自带 per-harness manifests 不动（submodule）

### 2.6 命令面变化

| 命令 | 变前 | 变后 |
|---|---|---|
| `cdd implement --harness X --task N` | 显式 harness | `cdd implement --task N`（host 内部判定） |
| `cdd review --type X --harness X ...` | 显式 harness + `--doc` | `cdd review --type X ...`（host 判定） |
| `cdd fix --type X --harness X ...` | 同上 | `cdd fix --type X ...`（host 判定） |
| `cdd research --harness X --brief ...` | 同上 | `cdd research --brief ...`（host 判定） |
| `cdd select` | 枚举+推荐 | **删除** |

**被审目标参数统一（D11）**——`--doc` 退役，workspace slug 从被审目标派生：

| type | 被审目标 | 参照 | 命令形态 |
|---|---|---|---|
| `review --type spec` | `--spec <path>` | — | `cdd review --type spec --spec <p>` |
| `review --type plan` | `--plan <path>` | `--spec <path>`（上游 spec 参照，仅注入 `**Spec:**` 头行） | `cdd review --type plan --plan <p> [--spec <s>]` |
| `review --type task` | `--plan <path>`（审实现 vs plan） | — | `cdd review --type task --plan <p> --task <n>` |
| `review --type branch` | `--plan <path>`（审 git diff vs plan） | — | `cdd review --type branch --plan <p> --base <b> --head <h>` |
| `fix --type spec/plan` | 同 review 对应 type | — | `cdd fix --type spec --spec <p> --findings <h>` / `cdd fix --type plan --plan <p> --findings <h>` |
| `fix --type task` | `--plan <path>`（修实现 vs plan） | — | `cdd fix --type task --plan <p> --task <n> --findings <h>` |

> **语义约束**：`--spec` 是 type 自解释的 —— type=spec 时**被审目标**（spec 文档本身），type=plan 时**上游参照**（被审 plan 的 spec 覆盖轴，沿用 P6 writing-plans `**Spec:**` 头行同源指针）。`docs-runner.mjs` / `handoff-finalize.mjs` 内部 `doc` 参数保留（prompt `{{DOC}}` / handoff `doc_path`），仅 CLI 入口层归一。

### 2.7 Acceptance criteria

- `packages/osuperpowers/bin/gate/` 目录不存在
- `packages/osuperpowers/hooks/` 无 gate hook（hooks.json / hooks-cursor.json 删除或为空且无 PreToolUse gate）
- `packages/osuperpowers/bin/init/` 不存在；`install-harness.mjs` / `install-harness-gates.test.mjs` 不存在；`.github/actions/install-harness/` 不存在 + `pr-validate.yml` 无其引用
- `packages/osuperpowers/skills/cli-select/` 目录不存在
- `packages/cdd-engine/bin/utils/skills-probe*.mjs` 与 osuperpowers 侧同组不存在；`harness-detect.mjs` 在 cdd-engine + osuperpowers 两侧均不存在
- `cdd select` usage 消失（`cdd -h` 不含 select）；4 个子命令均无 `--harness` requiredOption
- **D6 host 判定**：无 host env（CURSOR_TRACE_ID / CLAUDE_CODE_SESSION_ID / AI_AGENT=claude-code* 全空）下任一子命令 → stderr BLOCK 消息 + exit 1；有 host env 且不传 `--harness` 正常放行（engine 测试/smoke 通过 spawn env 注入 `CLAUDE_CODE_SESSION_ID` / `CURSOR_TRACE_ID` 判定 host，无新增测试变量）
- review/fix 命令无 `--doc` 选项；`review --type spec --spec <p>` / `--type plan --plan <p>` / `--type task --plan <p>` / `--type branch --plan <p>` / `fix --type spec|plan|task` 对应形态可用；workspace slug 从被审目标派生（spec→`--spec`，plan/task/branch→`--plan`）
- `harness-registry.json` keys == `["claude", "cursor-agent"]`
- skills 层：cli-driven-development / cli-research 无 select-harness 节点、无 I1、无 `--harness` 文本；brainstorming / writing-plans 审阅节点已用 `--spec` / `--plan` 形态
- `scripts/validate/residue.mjs` 新增 gate 专属语汇零豁免 check（`bin/gate/`、`CDD_GATE_`、`cdd-gate-core`、`gateDecide`、被删 adapter 文件名）且 baseline 绿；`validateCommitContract` / HARD GATE / `cdd-commit-gate-smoke` fixtures **不在**注册表
- **host-marker 策略落地**：smoke-cdd.mjs 四命令链无 `--harness`；engine 测试无残留 `--harness` 调用；CI 在无真实 harness session 的 step 注入 host env
- `pnpm run validate` 绿（13-block 结构，gate-hooks block 移除后 block 数更新）
- `pnpm run emit` 后无 drift（`emit:check` 绿）；被删 harness 的现存产物（`.codex-plugin/` / `.qoder-plugin/` / `.kimi-plugin/` / `gemini-extension.json` / `GEMINI.md`）已清；**保留 harness 产物（`.claude-plugin/` / `.cursor-plugin/`）正常生成且存在**
- `vendor-assembly.mjs` 无 gemini 装配（mattpocock 分支删）；`thinGeminiExtension` / `geminiMarkdown` 引用消失；superpowers 自带 gemini 产物原样保留（submodule）—— **D13**
- **progress.json 所有权（D14）**：engine 侧写入 engineRecoveryCount（runner BLOCKED/engine-recovery 路径自增）；cli-driven-development §engine-recovery / §timeout-decision 无「orchestrator 递增 progress.json」指令；orchestrator（skill 层）不写 progress.json —— grep `progress.json` + `increment` in skills 归零（只读引用除外）
- changeset 提交（`cdd-engine` / `osuperpowers` 版本语义见 plan）

---

## Section 3: Deviations from overall

| Overall assumption（v1.22 P5 行） | Phase decision | Overall updated? |
|---|---|---|
| P5 scope = gate 移除（Enh Q 列表）| P5 scope 扩展：+ cdd select/cli-select/skills-probe/harness-detect 删除 + `--harness` 参数删除 + channel 收敛到 claude/cursor-agent + per-harness 产物清理 + **review/fix `--doc`→`--spec`/`--plan` 参数统一（D11）** | Yes — v1.23 · 2026-09-09 |
| P5 acceptance：`install-harness 不写 gate config`（隐含保留）| `install-harness` 整体删除 + init 收缩为 marketplace 指引 | Yes — v1.23 · 2026-09-09 |
| dependency：P1（soft）| 新增 P2 关联（vendored superpowers 自带 per-harness manifests 保留）已注 §Depends；无新 hard edge | Yes — v1.23 · 2026-09-09 |
| P5 六类删除面（v1.23）| **D13（plan-review 期追加）**：vendored 发布面 gemini 装配清净 —— mattpocock 补写 gemini 分支（vendor-assembly）+ `thinGeminiExtension`/`geminiMarkdown` 整删；superpowers 自带 gemini 保留（submodule） | Yes — v1.24 · 2026-09-10 |
| P5 scope（v1.24）| **D14（P5 执行期追加，[#232 comment 5612106797]）**：progress.json 所有权收归 engine —— engineRecoveryCount 由 runner 写入（当前零 engine 写入点）、skill 文档去 orchestrator 递增指令、orchestrator 只读不写 | Yes — v1.25 · 2026-09-10 |

---

## Section 4: Notes for downstream

- 后续 phase 若引入新 harness 支持，须：回填 `harness-registry.json` 两键 manifest + `detectCurrentHarness` env marker + emit per-harness 产物；先过 residue guard 注册表（零豁免）。
- `channel` 概念（install-and-use/init）随 skills-probe 消失；未来 harness 支持不再有 channel 分类。
- `.agents/skills/osuperpowers/**` 为 emit 派生，编辑 skills 源后须 `pnpm run emit`。

---

## Section 5: Review

一次 cdd review `--type spec`（blocker=0 后 cli-fix-all-findings → 不重跑）。通过后 commit-spec（含 overall four-table sync）。