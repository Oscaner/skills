# Tickets: os-engineering P2（os-* 家族抽离）

抽取 os-* 家族（8 核心技能）到 os-engineering，spor-* 同步薄指针化，gate 加模式感知，cdd implement 加 seam 门。参见 [实施计划](../plans/2026-08-10-os-engineering-p2.md) 与 [阶段 spec](../specs/2026-08-10-os-engineering-p2-design.md)。

Work the **frontier**：先做 blockers 全完成的 ticket。T2/T3 依赖 T1；T9 依赖 T2-T6。

## T1 cross-cutting docs + overall/phase 模板迁入

**What to build:** os-engineering 的参考文档就位（subagent-lifecycle / review-dispatch / overall-phase-spec-template），供 os-* 技能引用。

**Blocked by:** None — can start immediately.

- [ ] `docs/subagent-lifecycle.md`（fresh subagent per pass / concurrent iff independent，语义规则名）
- [ ] `docs/review-dispatch.md`（D1/D2/D3 + severity 行为锚点：blocker→合并前必修、warn/nit→deferred:true→APPROVED、blocker→CHANGES_REQUESTED）
- [ ] `docs/overall-phase-spec-template.md`（自 spor-brainstorming 模板复制）

## T2 os-brainstorming + os-writing-plans

**What to build:** 前两个 os-* 技能，确立「Read 上游 + 个人规则」统一骨架（语义规则名 + `#rule-<kebab>`）。

**Blocked by:** T1

- [ ] `skills/os-brainstorming/SKILL.md`（Read upstream + grilling + overall+phase + fresh-subagent passes）
- [ ] `skills/os-writing-plans/SKILL.md`（Read upstream + to-tickets + 逐节写 + passes + tickets 重定向）

## T3 os-executing-plans 三模式总编器

**What to build:** 总编器：编器控制器 Rules 1-8 三模式共用 + 分派（in-session→Read executing-plans / subagent→Read subagent-driven-development / cli→委托 cli-driven-development）。

**Blocked by:** T1

- [ ] `skills/os-executing-plans/SKILL.md`：Rule: Read Upstream（三模式）、Mode Selection（`cdd-session-activate.sh minimal <key> <root> --mode <mode>`）、Task Complexity、Confirm Once、Fix Loop、Per-Task Review、Quality Invariants、D6 Aggregation、Ledger

## T4 os-finishing（吸收 worktree 拒绝）

**What to build:** 收尾编器 + 禁 worktree 策略（并入 spor-using-git-worktrees）。

**Blocked by:** None — can start immediately.

- [ ] `skills/os-finishing/SKILL.md`：Read Upstream + No Worktrees + Conventional Commits + Option4 Typed Discard

## T5 os-verification / os-debugging / os-code-review

**What to build:** 三个跨切面编器（pre-claim gate、无证据不提案、grilling 澄清 + tdd 委派）。

**Blocked by:** None — can start immediately.

- [ ] `skills/os-verification/SKILL.md`
- [ ] `skills/os-debugging/SKILL.md`
- [ ] `skills/os-code-review/SKILL.md`

## T6 os-report-issue

**What to build:** repo 开发工具迁移（会话分析 + 提 issue）。

**Blocked by:** None — can start immediately.

- [ ] `skills/os-report-issue/SKILL.md`（语义规则名，关键字用 cdd-run.sh）

## T7 cdd implement seam 门

**What to build:** implement.md 加 seam 确认门（调 tdd 前阻塞式确认），步骤重编号。

**Blocked by:** None — can start immediately.

- [ ] `templates/cdd/implement.md`：插入「Confirm seams first (blocking)」+ 重编号（原 3-6 → 4-7）

## T8 gate 模式感知

**What to build:** pending.mode 写/读；cli 严格 / in-session+subagent 放行；hook 自动激活补 `--mode cli` 保持严格；mode 测试。

**Blocked by:** None — can start immediately.

- [ ] `cdd-session-activate.sh`：`--mode` 参数 + `CDD_SESSION_MODE` env（**不用 CDD_MODE**），pending 带 mode
- [ ] render 源 `build/render-hook.sh` + `build/render-cursor-hooks.sh` 补 `--mode cli` → regenerate
- [ ] `cdd-orchestrator-gate.sh` 读 pending.mode：cli 严格 / in-session+subagent 放行 / mode 空+无 pending fail-open
- [ ] `sdd-gate-allow-deny-smoke.sh` mode fixtures（完整 pending JSON / 直接调 session-activate --mode）
- [ ] gate 测试通过 + validate ALL PASS

## T9 spor-* 薄指针 + 映射 + 删除 + 脚本更新

**What to build:** overrides 侧收缩：8 薄指针 + 3 映射 + 3 删除，校验脚本 repoint。

**Blocked by:** T2-T6（os-* 技能需存在）

- [ ] 8 个被抽离 spor-* → 薄指针（frontmatter 4 触发 + body `invoke Skill(os-<X>)`，清 5 个 frontmatter 对已删技能的链接）
- [ ] spor-executing-plans → os-executing-plans；spor-using-git-worktrees → os-finishing；spor-test-driven-development → mattpocock tdd（frontmatter 尾部改 seam-in-cdd）
- [ ] 删除 spor-sdd-p0-fallback / spor-subagent-lifecycle / spor-token-efficient-review-dispatch
- [ ] 更新 validate-overrides-build.sh / sdd-orchestrator-line-budget.test.sh（repoint 到 os-executing-plans + docs）/ cdd-severity-contract.test.sh（repoint 到 review-dispatch.md + D6 Aggregation）；rule-reference ALLOWLIST_NUM 删死条目
- [ ] README/README.zh-CN/cross-harness-overrides/CLAUDE.md 文档清理
- [ ] rule-reference 双模式通过 + validate ALL PASS

## T10 rule-reference 扩展 + ci-validate + 终检

**What to build:** os-* 语义规则校验 + 数量断言 + seam 门测试 + 零残留 + 终检。

**Blocked by:** T7, T9

- [ ] rule-reference.test.py 校验 os-* 语义规则 + `#rule-<kebab>` 锚点
- [ ] ci-validate.sh 5b 加数量断言（12 = 4 cli-* + 8 os-*）
- [ ] implement.md seam 门模板断言
- [ ] 零残留 grep + `pnpm run emit && pnpm run validate` ALL PASS
