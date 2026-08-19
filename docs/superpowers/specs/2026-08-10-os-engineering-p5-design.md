# os-engineering P5 阶段设计：CDD 引擎 + CI + 测试脚本迁 Node（脚本语言统一收尾）

## Header

- **Version**: v1.0 · 2026-08-15
- **Status**: Draft
- **Author**: Oscaner Miao · Claude Code (Opus 4.8)
- **Parent program**: [os-engineering overall v2.6](2026-08-10-os-engineering-overall.md)
- **Depends on**: P4b（统一 gate 面迁 Node + 9 harness adapters + os-init gates，已合并 develop @ 9df5139）—— Node 门核心 + adapter + node:test 基建就位

## §0 Incremental warning

> P5 增量。跨阶段约定见 [overall v2.6](2026-08-10-os-engineering-overall.md)；冲突以 overall 为准。

## §1 Constraints pointer

- 不重复 overall 约定；冲突以 overall 为准。
- **脚本语言统一（overall v2.6）**：P5 迁 CDD 引擎（`bin/engine/` bash）+ ci-validate + shell/python 测试 + release 辅助 + overrides 测试 → Node；终态 = 可执行面单语言 Node。
- **CDD 契约不变**：CLI 形状 / handoff JSON 格式 / exit codes（0/1/2）/ H6 三模式链 / ledger / plan-constraints / `CDD_*` env —— 逐字节兼容，下游（os-*/cli-* 技能、orchestrator、hooks）零改动。
- **Node 原生 + 清理债**：迁移时顺带拆模块/结构化错误处理/async child_process；外部行为不变。
- Conventional commits、无 attribution / co-author trailer；禁 git worktree；过渡期 `pnpm run validate` 必须保持通过。

## §2 Design body

### 2.0 范围（grilling 确认）

- **迁移面（~3100 行）**：`engine/lib/cdd-common.sh`（778）+ 4 入口 `.sh`（run/exec/select/session-activate，277）+ `scripts/ci-validate.sh`（136）+ 9 shell 测试（~1288）+ `test-lib.sh`（24）+ `rule-reference.test.py`（271）+ `cleanup-legacy-release-tags.sh` + `gh-branch-rulesets.sh`（44）+ overrides `validate-overrides-build.sh`（245）+ overrides `manifest-harness.test.py`（validate-overrides-build.sh:162 调用）→ 全部 Node。
- **迁移保真**：Node 原生重写，外部契约不变。
- **迁移粒度**：迁移 + 清理引擎结构债务（拆模块/错误处理/异步）。
- **保持**：`harness-registry.json`（数据）、`templates/cdd/*.md`（渲染源）、`gh-branch-rulesets/{main,develop}.json`（数据）、package.json/hooks。
- **分支**：`feat/os-engineering-p5`（自合并后的 develop @ 9df5139）。

> 注：overall v2.6 P5 行写「12 shell 测试」，repo 实际 9 个（P4b 删了 gate shell 测试）—— 以本 spec 9 为准（§3 已记偏差）。

### 2.1 架构 + 保留契约

**保留的契约（逐字节兼容）**：

- **CLI**：`cdd-run.mjs --harness <name> (--task N --mode implement|review|fix [--plan PATH] | --plan PATH)`；cdd-exec / cdd-select / cdd-session-activate 同参数。
- **exit codes**：`0` DONE / `1` BLOCKED / `2` harness-missing（含 H1 四行输出：status / commits / artifacts / blocker）。
- **handoff JSON**：`{ task, phase, status, commits, complexity, review_scope, artifacts, test_evidence, findings[], unverifiable[], plan_conflicts[] }` 逐字节。
- **ledger / plan-constraints / 三模式 H6 链 / `CDD_*` env**：原样。

**契约边界（钉死）**：逐字节兼容指 **JSON schema / 字段形状 / CLI 参数 / exit codes** 不变。**唯一被允许的行为分歧**：嵌套 CLI 失败时把之前被 `2>/dev/null` 吞掉的 stderr 捕获进 handoff blocker（§2.5）—— 这是单一 sanctioned divergence，落在 `contract.mjs`。契约测试断言字段形状，不断言被吞错误的旧行为。

**引擎 ↔ gate 边界**：P5 不重迁 gate —— `bin/gate/` 已是 Node（P4b），引擎经其稳定 CLI `cdd-gate-decide.mjs` 消费；P5 只迁 `bin/engine/` 自身。

### 2.2 引擎模块分解 + 入口迁移

**6 个 Node 模块**（bash 函数 → 模块映射）：

| 模块 | 责任 | 迁移自 |
|---|---|---|
| `bin/engine/lib/runner.mjs` | `cdd_run_task` / `cdd_run_plan` / H6 三模式链、env 设置、H1 输出 | cdd-common.sh 核心段 |
| `bin/engine/lib/registry.mjs` | harness-registry 加载、`cdd_check_harness`（ship gate / CLI preflight / registry 字段）| registry 段 |
| `bin/engine/lib/templates.mjs` | `cdd_render_mode_prompt`（渲染 `templates/cdd/*.md` + handoff-write 片段）| render 段 |
| `bin/engine/lib/contract.mjs` | commit-contract 校验 + handoff 写入 | contract 段 |
| `bin/engine/lib/ledger.mjs` | ledger 追加、plan-constraints 写、任务排序 | ledger 段 |
| `bin/engine/lib/exit.mjs` | exit codes（0/1/2）、blocked 消息、harness stub | exit 段 |

**入口** → 薄 `.mjs` 壳：`cdd-run.mjs`（Mode A/B 分派）、`cdd-exec.mjs`（一次性 runner）、`cdd-select.mjs`（harness 选择）、`cdd-session-activate.mjs`（pending 写）。引用 `cdd-common.mjs` → `lib/*.mjs` 处全部更新。

**模块归属（钉死）**：**H1 四行输出由 `runner.mjs` 独占**（含 exit-2 路径的 H1）；**handoff JSON 写入由 `contract.mjs` 独占**（`templates.mjs` 只渲染 handoff-write **片段模板**，不写文件）；`exit.mjs` 只定 exit code + blocked 消息文本。`cdd-common-functions.test.sh`（609 行）按函数家族拆进对应模块测试：registry 函数 → `registry.test.mjs`、模板/预算 → `templates.test.mjs`、ledger/plan → `ledger.test.mjs`、runner 链 → `runner.test.mjs`。

**清理债**：H6 嵌套 CLI 用 async `child_process`（替代 `$cli $invoke` 字符串拼接 + `2>/dev/null` 吞错）；错误处理结构化（替代 `set -euo pipefail` 依赖）；模块边界 + 清晰接口。**无行为变更**（除 §2.1 钉死的 stderr-surfacing 唯一分歧）。**模块数量固定为 6 + 4 入口，不新增抽象**。

### 2.3 迁移顺序（自举）

P5 全程用**当前 bash 引擎**执行迁移任务（bash 迁移自己）；顺序：

1. 核心 6 模块（cdd-common.mjs → lib/*.mjs）
2. 4 入口 `.mjs` 壳
3. `ci-validate.mjs`（package.json `validate` → `node scripts/ci-validate.mjs`）
4. 9 shell 测试 + `test-lib.sh` + `rule-reference.test.py` → node:test
5. 2 release 辅助 + overrides 测试 → Node

Node 引擎完成后用**契约测试 + 一次自举 smoke**验证，再切默认。**自举 smoke 判据（钉死）**：用 Node 引擎跑一个 implement/review dry-run 任务，断言 H1 四行 + handoff 字段与 bash 引擎输出**逐字段一致**（在删除 bash 前并行对照）—— 非仅「exit 0」弱检查。

### 2.4 ci-validate.mjs + 测试迁移 + release 辅助

**ci-validate.mjs**（完整编排）：**保留 ci-validate.sh 现有全部 12 个 block 子检查**（step 0 初始化 / 1 plugin.json resolve / 2 skills SKILL.md / 3 orphan / 4 hooks 可执行 / 5 overrides build / 5b engineering validate（node:test gate+engine）/ 5b2 gate hooks 可执行 / **5c engine+router 零残留 grep（sdd_/spor-，sdd→cdd 回归守卫，不得丢）** / 6 marketplace / 7 lib 单元测试 / 8–10 version sync / 11 submodule resolvable）。Node 用 `node:test` 聚合 + `execFileSync` 调 emit/version 脚本 + 结构化失败报告（步骤 + 原因 + exit 1）。

**测试迁移**：

| 测试 | → |
|---|---|
| `cdd-cli-dry-run-smoke.sh` | `runner.test.mjs`（dry-run H1 四行断言）|
| `cdd-commit-gate-smoke.sh`（16 断言）| `contract.test.mjs`（dirty-tree/head-mismatch/no-jq BLOCKED）|
| `cdd-common-functions.test.sh` | 各模块 test（registry/templates/ledger）|
| `cdd-exec.test.sh` / `cdd-select.test.sh` | `exec.test.mjs` / `select.test.mjs` |
| `cdd-severity-contract.test.sh`（30 断言）| `contract.test.mjs`（findings 语义）|
| `cdd-orchestrator-line-budget.test.sh` | `templates.test.mjs`（行预算）|
| `registry-schema.test.sh` | `registry.test.mjs`（schema 校验）|
| `ci-validate-wiring.test.sh` | `ci-validate.test.mjs`（步骤接线）|
| `test-lib.sh` | `tests/helpers.mjs` |
| `rule-reference.test.py`（语义规则名解析）| `rule-reference.test.mjs`（port；**两处调用点都更新**：ci-validate.sh:99 + validate-overrides-build.sh:72）|
| overrides `manifest-harness.test.py`（manifest 校验）| `manifest-harness.test.mjs`（validate-overrides 的 Python 调用 → Node）|

**release 辅助**：`cleanup-legacy-release-tags.sh` / `gh-branch-rulesets.sh` → `.mjs`（`execFileSync` gh/git，同逻辑；继续读 `gh-branch-rulesets/{main,develop}.json` 数据文件）；overrides `validate-overrides-build.sh` → **独立 `validate-overrides-build.mjs`**（内嵌 ~10 个 python3 子检查全迁 Node：manifest schema / canonical target / hooks matchers / hooks-cursor / os-init lockstep / self-check stamps / dogfood stamps）。

**收尾**：全仓 `.sh`/`.py` 引用清零（grep 验证 —— **含 CLAUDE.md 里对 `ci-validate.sh`/`validate-overrides-build.sh`/`gh-branch-rulesets.sh`/`cleanup-legacy-release-tags.sh` 的引用**）；`pnpm run validate` 全绿；Node 引擎自举 smoke；删除全部 `.sh`/`.py`。

### 2.5 错误处理

- BLOCKED 场景 → exit 1 + H1 blocker 消息（dirty-tree / head-mismatch / handoff 缺失）。
- harness CLI 缺失 → exit 2；嵌套 CLI 失败 → 捕获 stderr → handoff blocker（不再 `2>/dev/null` 吞）。
- ci-validate.mjs 失败步骤 → 明确报告步骤 + exit 1。
- 意外异常 → 显式错误不静默。

### 2.6 非目标

- ❌ 不改 CDD 契约（CLI / handoff / exit codes / H6 链 / ledger）。
- ❌ 不改 os-*/cli-* 技能逻辑（只更新 `.sh` → `.mjs` 引用路径）。
- ❌ 不改 `harness-registry.json` / `templates/cdd/*.md` 内容。
- ❌ 不新增功能（纯迁移 + 结构清理）。

### 2.7 验收标准

- [ ] Node 引擎与 bash 契约等价（回归测试 + 自举 smoke：H1 四行 + handoff 字段与 bash 逐字段一致）。
- [ ] 可执行面无 `.sh`/`.py`（grep 验证）。
- [ ] `ci-validate.mjs` 全绿（`pnpm run validate`）。
- [ ] 零残留（`bin/engine/*.sh`、`scripts/ci-validate.sh`、`cleanup-legacy-release-tags.sh`、`gh-branch-rulesets.sh`、`tests/*.sh`、`rule-reference.test.py`、`validate-overrides-build.sh`、`manifest-harness.test.py` 全删）。

## §3 Deviations from overall

| Overall assumption | Phase decision | Overall updated? |
|---|---|---|
| P5 = CDD 引擎 + ci-validate + shell/python 测试迁 Node | 范围扩为全量（+ 2 release 辅助 + overrides 测试）→ 真单语言终态 | Yes — v2.6（P5 行已含「终态 = 可执行面单语言」）|
| 引擎保持 bash（P4b 挪目录）| P5 原位换语言（`bin/engine/` 内 `.sh` → `.mjs`）| Yes — v2.6 |
| （无）| 迁移 + 清理引擎结构债务（拆模块/错误处理/async）| Yes — v2.6（「脚本语言统一」约束含最佳实践）|
| overall 写「12 shell 测试」| repo 实际 9 个（P4b 删 gate shell 测试）—— 以 9 为准 | Yes — v2.6（P5 行措辞；本 spec §2.0 注明）|
| （无）| 迁移面补充 `manifest-harness.test.py`（overrides，validate 内运行）| Yes — v2.6（「全量迁 Node」含 overrides 测试）|

## §4 Notes for downstream

- **自举**：P5 用 bash 引擎迁移自己；完成后 Node 引擎成为默认（后续阶段/编排用 Node）。
- **零 bash 终态**：可执行面单语言 Node 达成后，不再新增 bash。
- **发布前人工项**（沿袭 P4a）：GitHub `NPM_TOKEN` secret；首次 publish-mode 运行监控。

## §5 Review

Rule 1 三个 subagent pass（completeness / consistency+scope / clarity+YAGNI）通过后交用户 review，再进入 writing-plans。
