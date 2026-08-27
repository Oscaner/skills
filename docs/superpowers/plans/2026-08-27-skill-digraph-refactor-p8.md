# Skill Digraph Refactor — P8: cli-driven-development 重构 Implementation Plan

- **Date**: 2026-08-27
- **Spec**: `docs/superpowers/specs/2026-08-27-skill-digraph-refactor-p8-design.md` (v1.1)
- **Overall**: `docs/superpowers/specs/2026-08-24-skill-digraph-refactor-overall.md` (v1.16)
- **Branch**: `skill-digraph-refactor-p8`（已存在，基于 origin/develop）
- **Author**: [human] · Claude Opus 4.8 (osuperpowers:writing-plans dogfood session)

## Overview

将 `packages/osuperpowers/skills/cli-driven-development/SKILL.md` 从 Rules 散文 + Red Flags 重写为节点锚定式（11 节点 + 5 BLOCKED + 1 APPROVED 的 mermaid digraph + 5 Invariants + 9 Failure Modes 含 recovery 列），新增 deferred-disposition 决策节点 + fix 双通道（关闭 #168），同步修复 CDD engine 三个契约缺口（#185/#186/#187）、CDD workspace 完整性纪律（#181）、CDD 启动 determine-base + branch-review BASE 解硬编码（消费 P6 共享文档）。引擎改动仅限契约层，不改控制流。

## Scope

| 工作块 | 文件 | 产出类型 |
|---|---|---|
| §A | `packages/osuperpowers/bin/engine/lib/{brief,contract,runner,templates}.mjs` + `bin/engine/tests/` | CDD engine 契约修复（#185/#186/#187 + #168 scope env 映射）+ 单测 |
| §B | `skills/cli-driven-development/docs/handoff-schema.md` + `.zh-CN.md` + `templates/cdd/{_handoff-write-fragment,fix}.md` | Schema 修订（DONE→APPROVED + full SHA 标注）+ 模板扩展（`{{FINDINGS_SCOPE}}` + sweep 清理分支） |
| §C | `skills/cli-driven-development/SKILL.md` + `SKILL.zh-CN.md` | 节点锚定式重写 + zh-CN 镜像 |
| §D | `pnpm run emit && validate` + 终扫预演（4 条 grep）+ issue 关闭（#168/#181/#185/#186/#187） | 验证 + 回归 + 关闭 issues |
| §E | 自举验证（§C 通过 CDD engine 派发嵌套 CLI 执行） | dogfood 约束 |

**CDD task 边界与 plan 工作块的映射**（orchestrator 手工组合 brief，从 §A-§E 提取内容——本 plan 不含 `### Task N:` heading，因为 P8 统一命名空间要求 `### Task N:` = CDD 级索引，而 plan 级工作块与 CDD task 边界不一致）：

| CDD Task | 包含工作块 | Atomic commit |
|---|---|---|
| Task 1 | §A + §B | `fix: CDD engine contract — unified namespace + APPROVED status + full SHA + fix dual-channel (P8 #185 #186 #187 #168)` |
| Task 2 | §C + §E（自举约束） | `refactor: rewrite cli-driven-development to node-anchored format (P8)` |
| Task 3 | §D | `chore: close P8 issues + emit + validate + legacy sweep (P8)` |

## Global Constraints

- 仓库语言政策：SKILL.md / docs 英文主源 + zh-CN 镜像；本 plan 中文（Strategy B）
- 路径解析 harness-agnostic：不写 `$CLAUDE_PLUGIN_ROOT` 等 harness-specific 变量
- vendored 子模块不可改（`vendors/superpowers/` / `vendors/mattpocock-skills/`）
- **引擎改动仅限契约层**：brief.mjs（统一命名空间）/ contract.mjs（SHA prefix 兼容）/ runner.mjs（status APPROVED + CDD_FINDINGS_SCOPE env）/ templates.mjs（scope 渲染）——不改控制流。此为本程序「引擎代码改动仅限 P1」约束的显式豁免，豁免依据：P7 dogfood 发现的 3 个引擎契约缺口 + #168 fix 双通道所需的 runner 层 scope 渲染
- **不迁移历史 plan / spec / handoff 文件**：DONE → APPROVED 仅对新写的 `_handoff-write-fragment.md` 与 `runner.mjs` 兜底生效；P1-P7 历史 workspace 中的 DONE handoff 保持原样
- 终扫 pattern 必须全部归零（来自 overall spec P10 终扫定义）：`HARD-GATE`、`## Rules`、`## Red Flags`、`## Checklist`、`Rule: `
- **changeset 策略**：仅 P10 统一建一个 changeset（本 phase 不建）
- CDD execution：通过 `cdd-task.mjs` 派发嵌套 CLI session，不直接执行 plan steps（§C 自举验证约束）
- **report-issue label 组件分类**（overall spec v1.12 Boundary rule）：BLOCKED recovery 调用 `osuperpowers:report-issue` 时，label 按受影响组件分类（`osuperpowers` 非 `osuperpowers-router`）；CDD 相关 issue 追加 `cdd` label

---

### §A: CDD engine 契约修复（#185 + #186 + #187）+ #168 scope env 映射

**目标**：修复 P7 dogfood 发现的 3 个引擎契约缺口 + #168 fix 双通道所需的 scope env 映射。引擎改动仅限契约层。

**文件**：
- `packages/osuperpowers/bin/engine/lib/brief.mjs`（#185 统一命名空间）
- `packages/osuperpowers/bin/engine/lib/contract.mjs`（#186 SHA prefix 兼容）
- `packages/osuperpowers/bin/engine/lib/runner.mjs`（#187 status APPROVED + `CDD_FINDINGS_SCOPE` env 映射）
- `packages/osuperpowers/bin/engine/lib/templates.mjs`（`{{FINDINGS_SCOPE}}` 占位符渲染）
- `packages/osuperpowers/bin/engine/tests/`（补单测钉死新契约）

### 1.1 brief.mjs — 统一命名空间（#185 fix）

**现状**：`generateBrief` 匹配 plan 文件中的 `^### Task N:` heading（plan 级索引）。P7 plan 出现 plan Task 数量 > CDD task 的错位。

**改动**：

- **统一命名空间**：`--task N` CLI 参数 + plan 中 `### Task N:` heading 均为 **CDD 级唯一索引**（删除 plan 级语义）
- 删除对 `### CDD Task N:` heading 的匹配（若有）；只保留 `### Task N:` 作为唯一 heading 格式
- 更新 `brief.mjs` 顶部的 docstring / usage：明确 `--task N` = CDD 级索引（与 plan heading 1:1）
- 错误信息同步更新：`task N not found` → `task N not found (CDD-level index; plan must contain '### Task N:' heading)`

**单测**（`bin/engine/tests/brief.test.mjs` 或现有测试文件）：

- 新增 case 1：plan 含 `### Task 1:` / `### Task 2:`（CDD 级），`--task 2` 取 `### Task 2:` 段落（body 从该 heading 到下一个 `### Task N:` 之前）
- 新增 case 2：plan 含 `### Task 1:` 但调用 `--task 2` → throw `task 2 not found`
- 回归 case：现有 generateBrief case 全部保持绿（CDD 级语义向后兼容旧 plan）

**实施者校验**：
```bash
cd /Users/kang/Projects/oscaner-skills && pnpm test packages/osuperpowers/bin/engine/tests/
```
预期：新增 case + 全量回归绿。

### 1.2 contract.mjs — SHA prefix 兼容（#186 fix）

**现状**：`validateCommitContract` 严格比较 handoff `commits.head` 与 `git rev-parse HEAD`（40-char），7-char 短 SHA 触发 BLOCKED。

**改动**：

- `validateCommitContract` 比较 commits.head 时**放宽为 prefix 匹配**：`head` 是 `gitRevParseHead(cwd)` 的前缀即视为一致（兼容历史 7-char）
- 主路径仍为 strict equal（full SHA 比较）；prefix 匹配作为 fallback（兼容历史 handoff 文件）
- 新增/更新注释说明：`// strict equal primary; prefix fallback for legacy 7-char handoffs (#186)`
- **不修改** `gitRevParseHead` 自身（保持返回 full SHA）

**单测**：

- 新增 case：handoff `commits.head = "5f0efb4"`（7-char）+ `git rev-parse HEAD` 返回 `5f0efb4677647e1516e9c76131749976fc5196c7` → `ok: true`（prefix 匹配）
- 回归 case：full SHA strict equal 仍绿；dirty tree / head ≠ HEAD（非前缀）仍 BLOCKED

### 1.3 runner.mjs — status APPROVED + CDD_FINDINGS_SCOPE env 映射（#187 fix + #168 scope）

**现状**：

- 缺 handoff 时兜底写 `status: DONE`（与 ledger 规则不一致，触发 #187）
- 无 `CDD_FINDINGS_SCOPE` env 映射（fix.md 的 `{{FINDINGS_SCOPE}}` 占位符未被渲染）

**改动**：

- 缺 handoff 时兜底写 `status: APPROVED`（不是 DONE）：
  ```js
  // runner.mjs line ~408：把 "status: DONE" 改为 "status: APPROVED"
  "status: APPROVED",
  ```
- 新增 `CDD_FINDINGS_SCOPE` env 注入：在 `runTask` 的 spawn env 构造段，把 mode=fix 时的 scope 参数（默认 `blocker-only`）注入到 spawn env
  ```js
  // 新增 scope CLI 参数解析
  const scope = args['--scope'] ?? 'blocker-only';
  // 在 fix mode 时注入 env
  if (mode === 'fix') {
    env.CDD_FINDINGS_SCOPE = scope;
  }
  ```
- 校验 scope 参数合法性：`['blocker-only', 'deferred-sweep']` 之一；非法 → RunBlocked 错误

**单测**：

- 新增 case：缺 handoff 时 runner 兜底 handoff 的 `status` 字段为 `APPROVED`（非 DONE）
- 新增 case：fix mode + `--scope deferred-sweep` → spawn env 含 `CDD_FINDINGS_SCOPE=deferred-sweep`
- 新增 case：fix mode + `--scope blocker-only`（默认）→ spawn env 含 `CDD_FINDINGS_SCOPE=blocker-only`
- 新增 case：`--scope invalid` → RunBlocked 错误

### 1.4 templates.mjs — {{FINDINGS_SCOPE}} 占位符渲染

**现状**：`renderModePrompt` 渲染 fix.md 时未处理 `{{FINDINGS_SCOPE}}`。

**改动**：

- `renderModePrompt` 对 fix mode 渲染时：把 `env.CDD_FINDINGS_SCOPE`（默认 `blocker-only`）注入到 fix.md 模板的 `{{FINDINGS_SCOPE}}` 占位符
- 其他 mode（implement / task-review）不渲染 `{{FINDINGS_SCOPE}}`

**单测**：

- 新增 case：fix mode + env `CDD_FINDINGS_SCOPE=deferred-sweep` → 渲染后的 prompt 字符串含 `deferred-sweep` 字面量（展开后的 scope 描述）
- 新增 case：fix mode + **默认** env（未设置 `CDD_FINDINGS_SCOPE` 或 = `blocker-only`）→ 渲染后的 prompt 字符串含 `blocker-only` 字面量（默认 scope）
- 回归 case：implement / task-review 渲染不变

### 1.5 验收

- 5 处引擎改动（brief / contract / runner / templates + 单测）全部落地
- `pnpm test packages/osuperpowers/bin/engine/tests/` 全绿（新增 case + 回归）
- brief 命名空间统一：`### Task N:` = CDD 级唯一索引
- contract SHA 比较支持 strict + prefix fallback
- runner 缺 handoff 时写 `status: APPROVED`（非 DONE）
- runner fix mode 注入 `CDD_FINDINGS_SCOPE` env
- templates fix mode 渲染 `{{FINDINGS_SCOPE}}` 占位符

**原子 commit**：与 §B 合并为一个 commit（详见 Execution Strategy：CDD Task 1 = plan §A + §B）。

---

### §B: Schema + 模板修订（implement 段 DONE→APPROVED + full SHA + fix 双通道 + sweep 清理）

**目标**：对齐 handoff-schema.md 与 P8 引擎新契约（implement 段 status 废除 DONE，改为 APPROVED）；模板显式标注 full SHA；fix.md 新增 `{{FINDINGS_SCOPE}}` 占位符；_handoff-write-fragment.md fix segment 补 sweep 清理分支。

**文件**：
- `packages/osuperpowers/skills/cli-driven-development/docs/handoff-schema.md` + `.zh-CN.md`（DONE→APPROVED + full SHA 标注）
- `packages/osuperpowers/templates/cdd/_handoff-write-fragment.md`（implement DONE→APPROVED + 所有 segment full SHA 标注 + fix segment sweep 清理分支）
- `packages/osuperpowers/templates/cdd/fix.md`（`{{FINDINGS_SCOPE}}` 占位符）

### 2.1 handoff-schema.md + .zh-CN.md 修订

**现状**（参考 `docs/handoff-schema.md` 第 7-10 行）：

| Segment | Sets `phase` | Allowed `status` |
|---|---|---|
| implement | `implement` | `DONE`, `BLOCKED` |
| task-review / fix | `task-review` or `fix` | `APPROVED`, `CHANGES_REQUESTED`, `NEEDS_CONTEXT`, `BLOCKED` |

**改动**：

- **implement 段 status 改为 `APPROVED`, `BLOCKED`**（DONE 废除）
- 示例 JSON（implement 段）中 `status: "DONE"` → `status: "APPROVED"`
- **commits.head 字段显式标注「full 40-char SHA」**：在 schema 描述段补充 `commits.head: full 40-char SHA from git rev-parse HEAD`
- 更新 Severity → status mapping 表的说明：implement 段完成后 `APPROVED`（commit 成功 + 无 blocker），与 task-review 段完成时 `APPROVED`（review clean）语义一致
- `.zh-CN.md` 同步（节对节对齐）

### 2.2 _handoff-write-fragment.md 修订

**现状**（参考 `templates/cdd/_handoff-write-fragment.md`）：

- implement segment line 11：`Set status: DONE on success`
- 所有 segment 的 `git rev-parse HEAD` 描述未显式标注 full SHA
- fix segment 无 sweep 清理分支

**改动**：

- **implement segment**：line 11 `status: DONE` → `status: APPROVED`
- **所有 segment 显式标注 full SHA**：
  ```
  `git rev-parse HEAD`（full 40-char SHA；禁止 `--short` / `git log --format=%h` / 任何截断）
  ```
- **fix segment 补 sweep 清理分支**：
  ```
  3. **Preserve all `deferred: true` findings** from prior handoff `findings[]` — deferred
     items never enter the fix loop and never drop across rounds (blocker-only scope).
     **Exception: deferred-sweep scope** — sweep 完成的 finding 从 `findings[]` 移除
     （彻底解决，不保留为 deferred）；未解决的 finding 保留为 `deferred: true`。
  ```

### 2.3 fix.md 修订

**现状**：fix.md line 7 写 `**Open findings:** {{FINDINGS}}`（仅描述 open-findings 路径，未区分 scope）。

**改动**：

- 在 open-findings 描述段**新增 `{{FINDINGS_SCOPE}}` 占位符**：
  ```
  **Open findings (scope: {{FINDINGS_SCOPE}}):** {{FINDINGS}}
  ```
- 在 Instructions 第 1 步扩展现有描述，说明 scope 语义（English-primary，与 fix.md 模板主体一致）：
  ```
  1. Read open-findings at **`{{FINDINGS}}`** and the task brief at **`{{BRIEF}}`**
     (paths only for handoff context — do not paste full review axis bodies into prompts).
     **Scope `{{FINDINGS_SCOPE}}`**: `blocker-only` (default) → open-findings contains only
     non-deferred blocker findings; `deferred-sweep` → open-findings contains the deferred
     items selected by the user at deferred-disposition. open-findings covers only findings
     within the current scope; deferred items (in blocker-only scope) ride in handoff
     `findings[]` across rounds and do not enter the fix loop.
  ```

### 2.4 验收

- handoff-schema.md implement 段 status 表为 `APPROVED|BLOCKED`（DONE 废除）
- handoff-schema.md commits.head 显式标注 full 40-char SHA
- handoff-schema.zh-CN.md 同步（节对节）
- `_handoff-write-fragment.md` implement segment 写 `status: APPROVED`
- `_handoff-write-fragment.md` 所有 segment 显式标注 `git rev-parse HEAD`（full 40-char SHA）
- `_handoff-write-fragment.md` fix segment 含 sweep 清理分支（deferred-sweep scope 例外）
- `fix.md` 含 `{{FINDINGS_SCOPE}}` 占位符 + scope 语义说明

**原子 commit**：与 §A 合并为一个 commit（详见 Execution Strategy：CDD Task 1 = plan §A + §B）。

---

### §C: cli-driven-development SKILL.md 重写（节点锚定式）+ zh-CN 同步

**目标**：将当前 Rules 散文 + Red Flags 形式的 SKILL.md 重写为节点锚定式（mermaid digraph 为唯一控制流真相源）。

**文件**：
- `packages/osuperpowers/skills/cli-driven-development/SKILL.md`（重写，英文主源）
- `packages/osuperpowers/skills/cli-driven-development/SKILL.zh-CN.md`（重写，中文镜像）

### 3.1 SKILL.md 结构（§-by-§）

**Implementer directive**：每节点的 Do/Read/Exit/Fail 完整内容**必须从 spec §3 Node Definitions 逐字派生**，不可仅依本 plan 的 1 行摘要（plan 摘要不含 FAIL 字段语义、schema 细节等关键细节）。

1. **Front matter**：
   ```yaml
   ---
   name: cli-driven-development
   description: Independent cli-driven-development orchestrator -- Node-anchored flow with digraph as single control-flow source of truth. Selects harness via cli-select, determines base via shared doc, dispatches CDD three-mode chain (implement / task-review / fix), aggregates deferred findings via deferred-disposition gate, runs branch-review, hands off to finishing. Callable standalone; referenced by no other skill.
   ---
   ```

2. **Title + 引子**：`# CLI-Driven Development (cdd)` + "Execute planned tasks with the selected harness CLI via a three-mode chain. This skill is both orchestrator and engine: it executes AND makes orchestrator decisions (mode chain, Final Review)."

3. **Flow Digraph**（mermaid，从 spec §2 逐字派生——含 11 节点 + 5 BLOCKED + 1 APPROVED 终态）

4. **Node Definitions**（11 节点，每节点 Do/Read/Exit/Fail 四要素——从 spec §3 逐字派生）：
   - `select-harness`（跨 skill 调用 cli-select 的 `ask` 节点）
   - `determine-base`（消费 P6 共享文档 base-branch.md；写 `base-branch.json` artifact）
   - `dispatch-mode`（三 mode 派发；background execution；handoff 检查义务嵌入 Do 字段——#181 核心）
   - `handoff-status`（决策节点）
   - `task-complete?`（决策节点；ledger 追加嵌入 Do 字段；task-review 不可跳过）
   - `any-deferred?`（决策节点）
   - `deferred-disposition`（聚合呈现 + 用户选 fix-now/carry-skip——#168 核心）
   - `deferred-sweep-loop`（per-task sweep + re-review）
   - `branch-review`（BASE 从 artifact 读；持久化 diff + report——#181 纪律）
   - `branch-fix-loop`（分支级 fix 循环）
   - `handoff-finishing`（交接 finishing）

5. **Invariants**（5 条——从 spec §4 逐字派生）：I1 Explicit Propagation / I2 CLI Background Execution / I3 No --resume / I4 Fix Dual-Channel Contract / I5 Three-Mode Chain Completeness

6. **Failure Modes**（9 条 + recovery 列——从 spec §5 逐字派生；task 级 vs branch 级 fix-loop 拆分；fail-open vs BLOCKED 约定小节）

### 3.2 SKILL.zh-CN.md 镜像要求

- 节对节、节点对节点完全对齐英文主源
- description / front matter 翻译（参考当前 SKILL.zh-CN.md description：「通过三模式链驱动计划任务开发：选定 harness CLI 执行任务；拥有 orchestrator 责任（任务分类 / fix 循环 / 质量门 / 最终 branch-review）；最后做一次 branch-review CLI pass 后交给 finishing。」）
- mermaid 节点 ID 保持英文（与主源一致）
- Invariant / Failure Modes 表结构保持不变，仅 prose 翻译

### 3.3 跨 skill anchor 检查

**命令**：
```bash
grep -rn 'cli-driven-development/SKILL.md#' packages/osuperpowers/skills/
```
**预期**：当前无其他 skill deep-link 到 cli-driven-development 节点（P7 已把 cli-driven-development 引 cli-select 的 `#rule-ask` 改为 `#ask`；本次确认反方向引用无残留）。

**若发现匹配**：评估是否指向旧 Rule 名（`Rule: Harness Selection` / `Rule: Three-Mode Chain` 等），映射到新节点 ID（`#select-harness` / `#dispatch-mode` 等）。

### 3.4 验收

- 11 节点 ID 与 digraph 节点一一对应（图正文一致性校验清单——skill-authoring §8 规则 1：节点覆盖）
- 正文每小节标题与某节点 ID 对齐（skill-authoring §8 规则 2：小节对齐）
- 每节点含 Do/Read/Exit/Fail 四要素（skill-authoring §8 规则 3：无独立 Rules 散文堆）
- 无 `## Red Flags` 小节（skill-authoring §8 规则 4：无 Red Flags 小节）
- 5 Invariants 数量 ≤ 5 上限（skill-authoring §4）
- 9 Failure Modes 与 digraph 边对齐 + 含 recovery 列
- 节点 Do 字段承载 #181 纪律（handoff 检查 / task-review 不可跳 / branch-review 持久化）
- deferred-disposition 决策节点 + deferred-sweep-loop 节点存在（#168 落地）
- determine-base 启动节点 + branch-review BASE 从 artifact 读（P6 共享文档消费）
- zh-CN 镜像节对节对齐

**原子 commit**：独立 commit `refactor: rewrite cli-driven-development to node-anchored format (P8)`（详见 Execution Strategy：CDD Task 2）。

**自举验证**：§C 必须通过 CDD engine 派发嵌套 CLI 执行（overall spec v1.7 CDD dispatch 约束 + P8 自举验证标注）。嵌套 CLI 改写的目标是 cli-driven-development/SKILL.md 文件本身；orchestrator 使用当前 SKILL.md（旧版本）执行编排。

---

### §D: emit + validate + 终扫 + issue 关闭

**目标**：运行 emit + validate 保证衍生文件同步；运行终扫 pattern 验证旧格式关键词归零；关闭 5 个 P8 issue。

### 4.1 emit + validate

**命令**：
```bash
pnpm run emit && pnpm run validate
```

**预期**：
- emit freshness check 绿（`pnpm run emit:check` 通过）
- plugin.json skills resolve 绿
- skill dir has SKILL.md 绿
- rule-reference integrity 绿（包括跨 skill anchor 解析成功）
- engine tests 绿（含 §A 新增单测）
- version sync 绿

**若失败**：依错误类型分别修复（emit 失败 → 检查 SKILL.md front matter；validate 失败 → 依错误信息定位具体测试）。

### 4.2 终扫预演

**命令**（对 `packages/osuperpowers/skills/cli-driven-development/` 目录验证旧格式关键词已清零）：

```bash
grep -r 'HARD-GATE' packages/osuperpowers/skills/cli-driven-development/SKILL.md
grep -r '## Rules' packages/osuperpowers/skills/cli-driven-development/SKILL.md
grep -r '## Red Flags' packages/osuperpowers/skills/cli-driven-development/SKILL.md
grep -r 'Rule: ' packages/osuperpowers/skills/cli-driven-development/SKILL.md
```

**预期**：4 条 grep 全部零匹配。

**若发现匹配**：
- `HARD-GATE` / `## Rules` / `## Red Flags` → 节点锚定式重写遗漏，回 §C 修复
- `Rule: ` → Rules 散文堆残留，回 §C 修复

### 4.3 issue 关闭

**issue 列表**（5 个）：
- #168 — deferred 处置门（D6 Aggregation 路由到 deferred-disposition 节点）
- #181 — CDD dispatch 失败（orchestrator handoff 检查义务嵌入节点）
- #185 — brief.mjs 命名空间冲突（统一命名空间 fix）
- #186 — SHA 格式不一致（full 40-char + prefix 兼容 fix）
- #187 — status=DONE 非 APPROVED（implement 段统一 APPROVED fix）

**关闭命令**（评论附 commit URLs）：
```bash
gh issue close 168 --repo Oscaner/skills --comment "Fixed in P8: deferred-disposition decision node + fix dual-channel (deferred-sweep). Commits: <commit-URLs>"
gh issue close 181 --repo Oscaner/skills --comment "Fixed in P8: orchestrator handoff check obligation embedded in dispatch-mode Do field; task-review unskippable in task-complete? node; branch-review persists diff + report. Commits: <commit-URLs>"
gh issue close 185 --repo Oscaner/skills --comment "Fixed in P8: unified namespace (--task N + ### Task N: = CDD-level index). Commits: <commit-URLs>"
gh issue close 186 --repo Oscaner/skills --comment "Fixed in P8: commits.head unified to full 40-char SHA + validateCommitContract prefix fallback. Commits: <commit-URLs>"
gh issue close 187 --repo Oscaner/skills --comment "Fixed in P8: implement segment status unified to APPROVED (DONE abolished); runner.mjs fallback rewritten. Commits: <commit-URLs>"
```

**实施者 directive**：`<commit-URLs>` 替换为实际的 GitHub commit URLs（CDD Task 1 commit + CDD Task 2 commit）；关闭顺序任意。

### 4.4 验收

- emit + validate 绿（cli-driven-development + 衍生文件同步）
- 终扫 4 条 grep 全部零匹配
- 5 个 issue 关闭（评论附 commit URLs）

**原子 commit**：独立 commit `chore: close P8 issues + emit + validate + legacy sweep (P8)`（详见 Execution Strategy：CDD Task 3）。

---

### §E: 自举验证（dogfood 约束，无独立 commit）

**目标**：确保 §C 的 SKILL.md 重写通过 CDD engine 派发嵌套 CLI 执行（overall spec v1.7 CDD dispatch 约束 + P8 自举验证标注）。

**约束**：

- orchestrator 使用**当前 cli-driven-development SKILL.md（旧版本，Rules 形式）** 执行编排
- 嵌套 CLI 改写的目标是 `cli-driven-development/SKILL.md` 文件本身（新节点锚定式）
- §C 必须经由 `cdd-task.mjs --harness <name> --task 2 --mode implement` 派发（不允许 orchestrator 直接在当前 session 手动执行 plan steps；注意：CDD Task 索引 = 2，因为 §C 对应 CDD Task 2）

**产物**（workspace artifacts，不进入仓库——`.superpowers/cdd/` 在 .gitignore）：

- `task-2-brief.md`（§C 范围摘要；CDD Task 索引 = 2）
- `task-2-handoff.json`（status: APPROVED）
- `task-2-report.md`（实施报告）
- `task-2-test-evidence.json`（验证证据）
- `progress.md` ledger 含 `Task 2: complete` 行
- `branch-review.diff` + `branch-review-report.md`（Final Review 产物）

**验收**：上述 workspace artifacts 全部存在；不产生独立 commit（§E 是 meta-约束，不修改仓库文件）。

---

## Acceptance Criteria

对齐 P8 design spec §7（v1.1）：

1. 符合 skill-authoring.md v1.0（图节点与小节一一对应、无独立 Rules 散文堆、无独立 Red Flags 小节、无 Checklist）
2. 11 节点 + 5 BLOCKED + 1 APPROVED 终态入 digraph
3. **deferred-disposition 决策节点**存在（所有 task APPROVED 后聚合呈现；fix-now / carry-skip 二选一）
4. **fix 双通道**：`--scope blocker-only`（默认）+ `--scope deferred-sweep`（用户决策后）；`fix.md` `{{FINDINGS_SCOPE}}` 占位符 + `runner.mjs` env 映射 + `_handoff-write-fragment.md` sweep 清理分支
5. blocker 行为不变（必修，不进 deferred-disposition 门）
6. **CDD workspace 完整性**（#181 fix）：每 task 产物链齐全；branch-review diff + report 持久化；orchestrator handoff 检查义务嵌入 dispatch-mode 节点
7. **CDD engine 契约修复**：brief.mjs 统一命名空间（#185）；implement 段 status 统一 APPROVED（#187）；commits.head 统一 full SHA + validator prefix 兼容（#186）
8. **determine-base 启动节点** + `base-branch.json` artifact；branch-review BASE 参数从 artifact 读（移除 `origin/develop` 硬编码）
9. 引用迁移后的同目录 docs（cdd-reference / controller-handoff / handoff-schema）
10. zh-CN 同步（cli-driven-development SKILL.md + handoff-schema.md）
11. emit + validate 绿
12. 关联 #168 / #181 / #185 / #186 / #187 关闭评论附 commit
13. CDD execution: workspace 存在 + 全 task handoff.json + ledger 全 APPROVED + Final Review 产物（**自举验证**：§C 通过 CDD engine 执行）

---

## Execution Strategy

**Brief 手工组合约定**：本 plan 不含 `### Task N:` heading（plan 工作块 §A-§E 与 CDD task 边界不一致；若加 `### Task N:` 会被 brief.mjs 错误提取）。orchestrator 对每 CDD task 手工写 brief 文件（`task-N-brief.md`）：从 §A-§E 提取对应工作块内容 + 追加 `TASK_BASE: <sha>` 行（`git rev-parse HEAD`）。brief 内容覆盖下方「Brief 范围」所列要点；格式参考 P7 session 的 `task-2-brief.md`（dogfood 手工 brief 模式）。

**3 个 CDD task**（引擎层 / skill 主体 / 清理分层）：

### CDD Task 1：CDD engine 契约修复 + Schema + 模板修订

**对应 plan §A + §B**

**Brief 范围**：
- brief.mjs 统一命名空间 + 单测
- contract.mjs SHA prefix 兼容 + 单测
- runner.mjs status APPROVED + CDD_FINDINGS_SCOPE env 映射 + 单测
- templates.mjs `{{FINDINGS_SCOPE}}` 渲染 + 单测
- handoff-schema.md DONE→APPROVED + full SHA 标注 + .zh-CN.md 同步
- `_handoff-write-fragment.md` implement DONE→APPROVED + full SHA 标注 + fix segment sweep 清理分支
- `fix.md` `{{FINDINGS_SCOPE}}` 占位符 + scope 语义说明
- `pnpm test packages/osuperpowers/bin/engine/tests/` 全绿

**Task-level review 重点**：
- brief / contract / runner / templates 改动符合契约层约束（不改控制流）
- 所有新增单测 + 回归绿
- handoff-schema.md implement 段 status 表正确（APPROVED / BLOCKED）
- `_handoff-write-fragment.md` fix segment sweep 清理分支语义正确
- `fix.md` `{{FINDINGS_SCOPE}}` 占位符展开后语义清晰

**CDD Task 1 commit message**：`fix: CDD engine contract — unified namespace + APPROVED status + full SHA + fix dual-channel (P8 #185 #186 #187 #168)`

### CDD Task 2：cli-driven-development SKILL.md 节点锚定式重写

**对应 plan §C + §E 自举约束**

**Brief 范围**：
- 重写 `packages/osuperpowers/skills/cli-driven-development/SKILL.md`（节点锚定式，按 §C §结构）
- 重写 `SKILL.zh-CN.md`（中文镜像，节对节对齐）
- 跨 skill anchor 检查（预期零匹配）
- **自举验证**：本 task 必须通过 `cdd-task.mjs --harness <name> --task 2 --mode implement` 派发嵌套 CLI 执行

**Task-level review 重点**：
- 11 节点 + digraph 一一对应（图正文一致性校验）
- 每节点 4 要素完整（Do/Read/Exit/Fail，从 spec §3 逐字派生）
- 5 Invariants ≤ 5 上限
- 9 Failure Modes 与 digraph 边对齐 + 含 recovery 列
- zh-CN 镜像节对节对齐
- 节点 Do 字段承载 #181 纪律（handoff 检查 / task-review 不可跳 / branch-review 持久化）
- deferred-disposition + deferred-sweep-loop 节点存在（#168 落地）
- determine-base 启动节点 + branch-review BASE 从 artifact 读（P6 共享文档消费）

**CDD Task 2 commit message**：`refactor: rewrite cli-driven-development to node-anchored format (P8)`

### CDD Task 3：emit + validate + 终扫 + issue 关闭

**对应 plan §D**

**Brief 范围**：
- `pnpm run emit && pnpm run validate` 绿
- 终扫预演（4 条 grep pattern 全部零匹配）
- 关闭 5 个 issue（#168 / #181 / #185 / #186 / #187）评论附 commit URLs

**Task-level review 重点**：
- emit freshness check 绿
- validate 全绿（含 §A 新增单测）
- 终扫 4 条 grep 全部零匹配
- 5 个 issue 关闭（评论含 commit URLs）

**CDD Task 3 commit message**：`chore: close P8 issues + emit + validate + legacy sweep (P8)`

**Atomic commits（4 个：1 spec commit + 3 dev commits）**：
1. `docs: add P8 cli-driven-development design spec + sync overall spec v1.16`（spec + overall 同步，已 commit d7f8d28）
2. `fix: CDD engine contract — unified namespace + APPROVED status + full SHA + fix dual-channel (P8 #185 #186 #187 #168)`（CDD Task 1 = plan §A + §B）
3. `refactor: rewrite cli-driven-development to node-anchored format (P8)`（CDD Task 2 = plan §C）
4. `chore: close P8 issues + emit + validate + legacy sweep (P8)`（CDD Task 3 = plan §D）

---

## Plan Document Commit

**Plan 文档本身**：单独 commit `docs: add P8 cli-driven-development implementation plan`（按 commit 纪律：plan 获批即 commit，不等 dev 合并）。

---

## Risk & Mitigation

| 风险 | 缓解 |
|---|---|
| 引擎改动超出契约层范围 | §A 严守 brief / contract / runner / templates 四文件；不动 cdd-select.mjs / cdd-review.mjs 控制流 |
| `CDD_FINDINGS_SCOPE` env 注入破坏 fix mode 默认行为 | 默认值 `blocker-only` + 单测钉死；无 `--scope` 参数时等价于旧行为 |
| implement 段 status 统一 APPROVED 导致 P1-P7 历史 handoff 不识别 | 不迁移历史文件；新写的 handoff 走 APPROVED；历史 DONE 由旧 ledger 规则处理（ledger 规则在 P8 不变） |
| contract.mjs prefix 匹配被恶意 handoff 利用（任意前缀通过） | 仅作为 strict equal 的 fallback；恶意 handoff 不在本程序威胁模型 |
| fix.md `{{FINDINGS_SCOPE}}` 占位符未展开导致 prompt 渲染失败 | templates.mjs 单测覆盖 env 注入；runner.mjs 默认值保证未传 scope 时仍为 `blocker-only` |
| nested CLI 自举验证期间读旧 SKILL.md（非新版本） | 自举验证设计如此——orchestrator 用旧 skill 编排，嵌套 CLI 写新 skill 文件；orchestrator 行为在 P8 session 内稳定 |
| deferred-disposition 节点聚合所有 task handoff 时某 handoff 损坏 | any-deferred? 节点 Fail 字段处理：handoff 不可解析 → BLOCKED: engine-error |
| branch-review BASE 解硬编码时 base-branch.json artifact 缺失 | determine-base 节点在 select-harness 后立即跑；artifact 必存在后才进入 dispatch-mode；branch-review 不处理 artifact 缺失（由 determine-base 保证） |
| 5 issue 关闭时 GitHub CLI 鉴权失败 | 用户先跑 `gh auth status` 确认；issue 关闭失败不阻塞 commit（手工关闭兜底） |
| 终扫 pattern 漏网（如 `Rule: ` 残留） | 4 条 grep 全部覆盖；若发现残留，回 §C 修复后重扫 |
| nested CLI stdout 不可靠（P5 dogfood 教训） | 使用 overall spec v1.10 的「orchestrator handoff 检查义务」：cdd-task.mjs 返回后必须读 handoff.json 判断状态；CLI 调用使用 background 模式 |

