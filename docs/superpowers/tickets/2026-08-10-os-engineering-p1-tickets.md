# Tickets: os-engineering P1（cli-* 家族 + cdd 引擎）

创建 os-engineering 插件（cli-select / cli-task / cli-driven-development / cli-code-review 四个技能），把 SDD CLI 机制迁入并重组为 registry + 单一 runner（cdd-run.sh），新增 droid/pi full harness 与 harness 选择，overrides 过渡 retarget。参见 [实施计划](../plans/2026-08-10-os-engineering-p1.md) 与 [阶段 spec](../specs/2026-08-10-os-engineering-p1-design.md)。

Work the **frontier**：先做 blockers 全完成的 ticket。T7 依赖 T9 —— 执行顺序 T9 先于 T7。

## T1 插件骨架 + marketplace 注册

**What to build:** os-engineering 作为独立插件出现在 marketplace，能被 emit/validate 解析，为后续技能与引擎提供骨架。

**Blocked by:** None — can start immediately.

- [ ] `plugins/os-engineering/package.json`（version 0.1.0 真源）+ `.claude-plugin/plugin.json` + `skills/.keep` 就位
- [ ] `scripts/lib/marketplace-utils.mjs` truthPaths 加 os-engineering；`marketplace/source.json` 注册（claude.category=engineering）
- [ ] `pnpm run emit:marketplace && pnpm run validate` 通过

## T2 harness registry + schema 测试

**What to build:** 声明式 harness registry（claude/cursor-agent/droid/pi full + codex/copilot/gemini not-supported），schema 校验保证字段合法。

**Blocked by:** T1

- [ ] `bin/harness-registry.json` 7 条目（4 full + 3 not-supported）
- [ ] `tests/registry-schema.test.sh` 通过（full 必有 invoke/output/review_prefix，not-supported 豁免 invoke）

## T3 cdd-common.sh 迁移（registry 驱动 + templates/cdd）

**What to build:** cdd 共享库：全量 sdd→cdd 改名、内联 workspace resolver（不再调上游 sdd-workspace）、registry 驱动的 `_cdd_invoke_cli`（text 透传 / stream-json 取最后 completion.finalText）、templates 迁入 templates/cdd/。

**Blocked by:** T1, T2

- [ ] `bin/lib/cdd-common.sh` 就位，BSD sed 全量改名（无 `\b`），零 sdd 标识
- [ ] `templates/cdd/{implement,review,fix}.md` + `_handoff-write-fragment.md` 迁入，token 保留、`CDD_*` env
- [ ] `bash -n cdd-common.sh` 通过；dry-run smoke 骨架落文件

## T4 cdd-run.sh 单一 runner（Mode A / Mode B）

**What to build:** 唯一 CLI 派发入口：Mode A（--task N --mode）+ Mode B（--plan），入口判别规则，registry 拼命令 + 输出归一化。

**Blocked by:** T3

- [ ] `bin/cdd-run.sh` 就位（usage 完整，`MODE_ARG=""` 初始化）
- [ ] `cdd-cli-dry-run-smoke.sh` 通过（CDD_DRY_RUN=1）

## T5 cdd-select.sh + cli-select 技能

**What to build:** harness 检测 helper（遍历 registry + command -v + 当前 harness env 检测 + 推荐 droid>pi>当前）与 cli-select 技能（AskUserQuestion 询问、显式 --harness 传播、空列表 BLOCKED）。

**Blocked by:** T2

- [ ] `bin/cdd-select.sh` 输出 available/unsupported_installed/recommended（字母序）
- [ ] `cdd-select.test.sh` 通过（3 场景 mock PATH）
- [ ] `skills/cli-select/SKILL.md` 语义规则名 + 链接可解析

## T6 cdd-exec.sh + cli-task 技能

**What to build:** 自由任务一次性 runner（registry 驱动）+ cli-task 技能（one-shot / --loop sentinel / brief 路径 handoff 契约）。

**Blocked by:** T3, T5

- [ ] `bin/cdd-exec.sh` 就位（含 usage()），`bash -n` 通过
- [ ] `skills/cli-task/SKILL.md` 语义规则名，链接可解析

## T7 cli-driven-development 技能（引擎模式）

**What to build:** cdd 引擎文档化技能：harness 选择、三模式链、handoff 契约、commit gate、ledger；语义规则名 + 链接引用。

**Blocked by:** T3, T4, T9（cdd-reference.md）

- [ ] `skills/cli-driven-development/SKILL.md` 语义规则名，链接经 rule-reference 校验

## T8 cli-code-review 技能

**What to build:** 独立任意 diff 评审技能：范围推导（base..head / merge-base）、review-package diff 包、自包含评审 prompt 派发、findings 报告。

**Blocked by:** T3, T5

- [ ] `skills/cli-code-review/SKILL.md` 语义规则名，链接可解析

## T9 docs 迁移（cdd-reference / controller-handoff / handoff-schema）

**What to build:** 引擎契约文档迁入 os-engineering：cdd-reference.md（H6-H8 + harness 表改 registry 引用）、controller-handoff.md（H1-H5）、handoff-schema.md。

**Blocked by:** T1

- [ ] `docs/cdd-reference.md` 迁移 + sed（env/路径/harness 表/小写函数标识），零 sdd 残留
- [ ] `docs/controller-handoff.md` + `docs/handoff-schema.md` 就位
- [ ] overrides 的 spor-token-efficient-controller-handoff / spor-handoff-writer 降为薄指针

## T10 overrides 过渡（spor-sdd retarget + gate 改名 + 删脚本）

**What to build:** overrides 的 spor-sdd Rule 7 retarget 到 cdd-run.sh（完整命令转发）；gate 内部改名 cdd-* + `.superpowers/cdd/`；gate 测试 env 同步；删除 10 个 per-harness 脚本；validate-overrides-build 删 10-script 断言。

**Blocked by:** T3, T4

- [ ] spor-sdd Rule 0/7 引用指向 os-engineering（cdd-run.sh 完整命令 / cdd-reference.md / controller-handoff.md / templates/cdd/）
- [ ] gate lib + session-activate + adapters 改名 cdd-*，workspace `.superpowers/cdd/`，gate 测试 env/路径同步
- [ ] 10 个 sdd-run-{task,plan}-*.sh 删除；validate-overrides-build 10-script 断言删除
- [ ] `pnpm run validate` 过（overrides 侧全绿）

## T11 测试拆分 + rule-reference 双模式

**What to build:** 校验体系按「引擎在 os-engineering、gate/hook 在 overrides」拆分：引擎测试迁移、severity-contract 迁移、rule-reference.test.py 双模式同时校验两插件、overrides 的 sdd-common.sh 删除。

**Blocked by:** T10, T9

- [ ] cdd-commit-gate-smoke / cdd-common-functions 迁移到 os-engineering（含 F1 断言更新）
- [ ] severity-contract → cdd-severity-contract.test.sh 迁移
- [ ] rule-reference.test.py 双模式（数字 + 语义），同时校验两插件
- [ ] overrides 的 sdd-common.sh 删除（零引用确认）

## T12 ci-validate + 零残留终检

**What to build:** ci-validate.sh 接入 os-engineering 验证步骤（plugin.json / registry schema / cdd 测试 / rule-reference 双模式）；零 sdd 残留终检；`pnpm run validate` ALL PASS。

**Blocked by:** T11

- [ ] ci-validate.sh 新增 os-engineering 步骤
- [ ] 迁移引擎文件零 `sdd_*`/`SDD_*`/`sdd-run-` 残留（grep 断言）
- [ ] `pnpm run emit && pnpm run validate` ALL PASS
