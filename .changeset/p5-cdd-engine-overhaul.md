---
"@oscaner-skills/cdd-engine": major
"@oscaner-skills/osuperpowers": major
---

feat(cdd-engine): P5 — remove cdd-gate + harness selection layer, drop --harness/--doc, converge to host-harness model + progress.json engine-owned

**BREAKING（`cdd-engine` + `osuperpowers` 双 major）**：gate 子系统 + harness 选择/探测/安装层整体删除；`--harness`/`--doc` 参数删除（`--spec`/`--plan` 目标参数统一）；host 判定（宿主即目标）收敛 + progress.json 所有权收归 engine（D14）。

- **Gate 整体删除**: `bin/gate/`（core + 11 adapters + configs/tests + `tests/fixtures/cdd-gate/**`）、hooks PreToolUse gate、`bin/init/` + install-harness + `.github/actions/install-harness/` + pr-validate 引用、`cdd select` 子命令 + `cli-select` skill + `harness-detect.mjs`（双份）+ skills-probe（cdd-engine/osuperpowers 双份 + skill-gate tests）。
- **`--harness` 删除（宿主即目标）**: implement/review/fix/research 去 `--harness`；engine 内部 `detectCurrentHarness(env)` 判 host（空 → BLOCK exit 1；marker 优先级 CURSOR_TRACE_ID > CLAUDE_CODE_SESSION_ID > AI_AGENT=claude-code*）。
- **`--doc` 退役（D11）**: review/fix 被审目标参数统一 —— `--spec`（type=spec 被审）/ `--plan`（type=plan/task/branch 被审）；workspace slug 从被审目标派生。
- **channel 收敛**: `harness-registry.json` 7→2 键（claude / cursor-agent）；per-harness emit 产物（.codex/.qoder/.kimi/gemini/GEMINI.md）删除；vendored 发布面 gemini 装配清净（D13）。
- **progress.json engine-owned（D14）**: `engineRecoveryCount` 由 runner 自写（engine-written BLOCKED/engine-error 判定路径自增，`incrementRecovery` helper）；orchestrator 只读不写；cli-driven-development §engine-recovery/§timeout-decision 去「orchestrator 递增 progress.json」指令。
- **gate 语汇零豁免 residue guard**: `scripts/validate/residue.mjs` gate 语汇 check（`bin/gate/`/`CDD_GATE_`/`cdd-gate-core`/`gateDecide`；`validateCommitContract`/HARD GATE 不在注册表）。

osuperpowers: `init` 收缩为 single-node marketplace 指引（去 detect-harness/config/trust/summarize）；cli-driven-development / cli-research 去 select-harness 节点 + I1 Explicit Propagation invariant；brainstorming / writing-plans 审阅节点改 `--spec`/`--plan` 形态；skill/docs 层 harness 概念出清。
