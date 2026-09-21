---
"@oscaner-skills/cdd-engine": major
---

P2 consumer-parity breaking 面：harness 契约单源 + 全量 charter 审计 + closeout 统一规则 + `cdd help` + doc-structure schema 单源（breaking = cdd-engine major，1.0.0 → 2.0.0；版本化发布动作归 P4，本 changeset 定版本面与变更面清单）。

**handoff schema 契约统一（BREAKING）**：

- **docs-handoff 逆转**：`templates/schema/docs-handoff-schema.json` 删除「Docs rounds carry no commits field」显式声明段，增 `commits{base,head}`（与 task-family 同形状：base 全 40 位 SHA `^[0-9a-f]{40}$`、required `[base]`）——docs-family fix 出口门 commit 记账判据由此成立（overall v1.4 known-gap 关闭，同契约束轮次行为确定性：commit → APPROVED；未 commit → BLOCKED + stdout 可见诊断）。
- **status enum 增 TIMEOUT**：docs-handoff status 由 `[APPROVED, CHANGES_REQUESTED, BLOCKED]` 升级为与 task-family 同枚举 `[APPROVED, BLOCKED, CHANGES_REQUESTED, TIMEOUT]`——lifecycle 核心块统一（breaking：docs 面 status 枚举扩面）。
- **recovery 核心块统一**：docs-handoff `recovery` 增 `stash_message` + `scope_base`（与 task-family 同载体——`src/artifacts/residue.ts` 单源写入面；docs 缺省语义不变，resume pre-flight 契约同面）。
- **blocker 单数统一**：两族均只声明单数 `blocker`，无复数 `blockers` 键。

**round-context docs base token**：docs round 增 base 作用点 token（与 task-family `TASK_FIXED_POINT` 同位语义：= dispatch 入口 base）；token 名 / 渲染经 `template-contract.json` round-context zone 单源（canonical）定义并随 schema 消费。

**lifecycle 契约结构升级（BREAKING）**：task / docs / branch 三通道共享**一个 lifecycle 契约**——`docContractValidate`（全量 charter 审计 pre-flight 门：plan/spec/overall 契约 + parent overall 四表 + closeout 结构性面 + 终态欠账硬门）与 `statusValidate`（六态收敛 + plan verdict + 终态欠账 post-flight 高亮）提升为 **base 生命周期默认钩子全通道生效**（lane 仅声明审计对象 / plan 路径）；docs-family 消费面由此获得同一条执法链（整体 breaking 面随本 phase 声明）。

**`cdd help` 子命令**（Non-goal#1 唯一例外）：新增发现型 help——打印 CLI 绝对目录 + 必要文档目录（schemas / templates），零执法逻辑、git 仓库外可用、无生命周期副作用；skills 经此发现通道直取 doc-structure schema 成文（零硬编码路径）。

**doc-structure schema 单源**：canonical doc-structure（overall / plan / phase-spec / add-phase-protocol，draft 2020-12 JSON Schema + descriptions）随包发布（`dist/documents/schema/` 可寻址，`cdd help` 指向）；存量 md 模板（overall-spec-template / phase-spec-template / add-phase-protocol）退役；engine 校验 / 抽取 token 自 canonical 派生（`documents/tokens.ts` 单一派生点——零第二手工 token、repo/skill 侧 md 模板副本全禁）；本仓程序文档链（plan → design → overall）过 engine 新审计路径零误伤（canary dogfood）。

**全量 charter 审计 + closeout 统一规则**（lifecycle 行为面，随上述钩子全通道生效）：lineage 驱动的四表审计（①–⑥ 面）、closeout 声明源 ↔ 列双向全列（forward + reverse，plan + design）+ engine 派生终态并入 + mismatch 单一推断模块（pre-flight 与 post-flight 同源消费）、终态欠账硬门（回填 = branch-review 前置义务）、dry-run CDD_WARN 降级与 exit 语义不变。

> **semver 说明**：handoff schema 结构升级（docs-family `commits{base,head}` 逆转旧「无 commits」声明 + status 增 TIMEOUT + recovery 核心统一）+ round-context 新 base token + lifecycle 契约结构升级（三通道共享默认钩子）+ 新增 `cdd help` 子命令 = **breaking**，按 major 发布。消费者迁移面：docs-family handoff 消费者需接受新核心块字段（同 task-family 契约）；engine 侧行为面（审计 / closeout 门）对既有合法程序文档链零新增失败（四表合法 → 全绿，dogfood 实证）。仓库内部件（`scripts/run.ts validate` 侧 charter 守卫）随 P3 退役、P4 发布闭环承载版本化，本 changeset 仅定版本面。
