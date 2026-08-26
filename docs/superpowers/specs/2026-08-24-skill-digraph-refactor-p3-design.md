# P3 docs-infra — Design Spec

- **Version**: v1.0 · 2026-08-26
- **Status**: Draft → 3-pass review
- **Author**: Claude Opus 4.8 (osuperpowers:brainstorming dogfood session)
- **Upstream program**: [Overall spec v1.5](./2026-08-24-skill-digraph-refactor-overall.md)
- **Constraints**:
  - 允许破坏性更新，确保最佳实践，不留技术债务（用户指令）
  - vendored 子模块不可改
  - changeset 仅 P10 统一建（程序级豁免）
  - 引擎代码改动仅限路径字符串（路径字符串豁免：P3 允许对引擎、模板及消费者 SKILL.md 做「仅文档链接/路径字符串」的编辑，行为正文留待 P4–P9）

---

## 1. 目标

按 overall v1.5 P3 行完成四项 docs-infra 改动：

1. **文档迁移**：4 个共享参考文档从 `packages/osuperpowers/docs/` 迁入各自消费者技能目录的 `docs/` 子目录，各带 zh-CN 镜像：
   - `cdd-reference.md` / `controller-handoff.md` / `handoff-schema.md` → `skills/cli-driven-development/docs/`
   - `docs-review.md` → `skills/writing-plans/docs/`
2. **subagent-lifecycle 解散**：源文件 `git rm`；Fresh Subagent Per Pass 与 Concurrent iff Independent 随 CLI 模式消亡（不再需要）；Delegate Load Failure（DLF）协议内联到两个消费者 SKILL.md 的 Read Sub-Skills 规则；所有引用（SKILL.md + maintainer docs）全部删除归零。
3. **skill-authoring.md 新建**：`docs/maintainers/skill-authoring.md`（中文 Strategy B），定义节点锚定式规范——Flow digraph 语义约定 / Nodes 四要素（Do/Read/Exit/Fail）模板 / Invariants ≤5 / Failure Modes 表 / BLOCKED 终态约定 / init legacy 内容豁免规则 / 图正文一致性校验清单；附一个虚构示例节点（`read-grilling`）演示格式。
4. **CLAUDE.md 指引**：repo CLAUDE.md 增 skill-authoring.md 引用条目。

**同步 docs/maintainers/ 两份维护者文档**（osuperpowers-plugin.md 及 zh-CN 镜像）对已迁移/解散文档的引用——docs-review 路径改为新家；subagent-lifecycle 条目整段删除。

## 2. 非目标

- 不改引擎行为语义（输出契约、退出码、handoff schema 结构零改动；仅更新代码注释中的路径字符串）。
- 不改 P4–P9 重构的技能正文（brainstorming/writing-plans/cli-driven-development 等的 Rules/Red Flags/Checklist 散文体保留现状——P4–P9 各自按 skill-authoring.md 规范重写）。
- 不动 osuperpowers-router 触发路由结构（仅更新 cross-harness-overrides.md 中的 cdd-reference 路径字符串）。
- 不动 vendored 子模块。
- 不建 changeset（P10 统一）。
- 不改 `packages/osuperpowers/docs/` 以外位置的文档（`docs/superpowers/` 不受 P3 影响；`docs/maintainers/` 除引用同步 + subagent-lifecycle 条目删除 + skill-authoring.md 新建外不动；repo `CLAUDE.md` 除增 skill-authoring 条目 + 删 `packages/osuperpowers/docs/` 目录条目外不动）。

## 3. 文档迁移

### 3.1 文件迁移（git mv，8 文件）

| 源 | 目标 |
|---|---|
| `packages/osuperpowers/docs/cdd-reference.md` | `packages/osuperpowers/skills/cli-driven-development/docs/cdd-reference.md` |
| `packages/osuperpowers/docs/cdd-reference.zh-CN.md` | `...skills/cli-driven-development/docs/cdd-reference.zh-CN.md` |
| `packages/osuperpowers/docs/controller-handoff.md` | `...skills/cli-driven-development/docs/controller-handoff.md` |
| `packages/osuperpowers/docs/controller-handoff.zh-CN.md` | `...skills/cli-driven-development/docs/controller-handoff.zh-CN.md` |
| `packages/osuperpowers/docs/handoff-schema.md` | `...skills/cli-driven-development/docs/handoff-schema.md` |
| `packages/osuperpowers/docs/handoff-schema.zh-CN.md` | `...skills/cli-driven-development/docs/handoff-schema.zh-CN.md` |
| `packages/osuperpowers/docs/docs-review.md` | `...skills/writing-plans/docs/docs-review.md` |
| `packages/osuperpowers/docs/docs-review.zh-CN.md` | `...skills/writing-plans/docs/docs-review.zh-CN.md` |

迁移后 `packages/osuperpowers/docs/` 仅剩 `subagent-lifecycle.md` + zh-CN（由 §4 解散删除）。§4 完成后该目录空 → `git rm -r` 删除（验收 ①）。

### 3.2 引用方路径同步

| 文件 | 当前引用 | 新引用 |
|---|---|---|
| `skills/cli-driven-development/SKILL.md` 第 18 行 | `../../docs/cdd-reference.md` | `./docs/cdd-reference.md` |
| 同上 第 29 行 | `../../docs/controller-handoff.md` | `./docs/controller-handoff.md` |
| `skills/cli-driven-development/SKILL.zh-CN.md` 同上两行 | 同上 | 同上 |
| `skills/writing-plans/SKILL.md` 第 47 行 | `../docs/docs-review.md` | `./docs/docs-review.md` |
| `skills/writing-plans/SKILL.zh-CN.md` 第 47 行 | 同上 | 同上 |
| `skills/brainstorming/SKILL.md` 第 85 行 | `../docs/docs-review.md` | `../writing-plans/docs/docs-review.md` |
| `skills/brainstorming/SKILL.zh-CN.md` 第 85 行 | 同上 | 同上 |
| `templates/cdd/_handoff-write-fragment.md` 第 3 行（×2） | `../../docs/handoff-schema.md` + `../../docs/controller-handoff.md` | `../../skills/cli-driven-development/docs/handoff-schema.md` + `../../skills/cli-driven-development/docs/controller-handoff.md` |
| `skills/cli-driven-development/docs/cdd-reference.md` 第 4 行（+ zh-CN） | `` [`docs/controller-handoff.md`](controller-handoff.md) ``（显示文本含 `docs/` 前缀，但 href 已为相对同目录——迁移后 href 不变，仅显示文本过时） | 改为 `` [`controller-handoff.md`](controller-handoff.md) ``（去显示文本的 `docs/` 前缀） |
| `skills/cli-driven-development/docs/controller-handoff.md` 第 42 行（+ zh-CN） | `` [`docs/cdd-reference.md`](cdd-reference.md) ``（同上：href 已为同目录相对路径，显示文本过时） | 改为 `` [`cdd-reference.md`](cdd-reference.md) `` |
| `packages/osuperpowers-router/docs/cross-harness-overrides.md` 第 78/82/190 行 | `../../osuperpowers/docs/cdd-reference.md` | `../../osuperpowers/skills/cli-driven-development/docs/cdd-reference.md` |
| `docs/maintainers/osuperpowers-plugin.md` 第 53 行 | `../../packages/osuperpowers/docs/docs-review.md` | `../../packages/osuperpowers/skills/writing-plans/docs/docs-review.md` |
| `docs/maintainers/osuperpowers-plugin.md` 第 211 行 | `../../packages/osuperpowers/docs/cdd-reference.md` | `../../packages/osuperpowers/skills/cli-driven-development/docs/cdd-reference.md` |
| `docs/maintainers/osuperpowers-plugin.zh-CN.md` 同两行 | 同上 | 同上 |

### 3.3 Engine 路径字符串（注释 + 错误消息，路径字符串豁免范围内）

| 文件 | 位置 | 当前 | 新 |
|---|---|---|---|
| `bin/gate/cdd-gate-core.mjs` | 第 249 行 | `${osRoot}/docs/cdd-reference.md` | `${osRoot}/skills/cli-driven-development/docs/cdd-reference.md` |
| `bin/engine/lib/contract.mjs` | 第 2/44 行注释 | `docs/handoff-schema.md` | `skills/cli-driven-development/docs/handoff-schema.md` |

### 3.4 Engine 测试 fixture 路径

| 文件 | 位置 | 当前 | 新 |
|---|---|---|---|
| `bin/engine/tests/templates.test.mjs` | 第 105 行 | `docs/controller-handoff.md` | `skills/cli-driven-development/docs/controller-handoff.md` |
| 同上 | 第 107 行 | `docs/docs-review.md` | `skills/writing-plans/docs/docs-review.md` |
| 同上 | 第 138 行 | `docs/docs-review.md` | `skills/writing-plans/docs/docs-review.md` |
| 同上 | 第 106 行 | `docs/subagent-lifecycle.md` | **删除**（§4 解散；tier2 预算重算见 §3.5） |
| `tests/rule-reference.test.mjs` | 第 225/245 行 fixture | `../docs/controller-handoff.md` / `../../docs/controller-handoff.md` | `../skills/cli-driven-development/docs/controller-handoff.md` / `../../skills/cli-driven-development/docs/controller-handoff.md` |

### 3.5 Line budget 调整

`bin/engine/lib/templates.mjs` 第 12-18 行 `LINE_BUDGETS`：
- tier2 当前 = tier1 (225) + subagent-lifecycle (21) + docs-review (71) = 317（实际配置 350，含余量）
- 迁移后 subagent-lifecycle 解散：tier2 = 225 + 71 = 296
- **推荐值 320**（保留 ~8% 余量）；templates.test.mjs 第 106 行 `life = wcLines("docs/subagent-lifecycle.md")` 删除；tier2 相关断言阈值同步调整。
- **注释同步**：templates.mjs 第 12 行 `// tier2 = tier1 + subagent-lifecycle + docs-review` → `// tier2 = tier1 + docs-review`（去 subagent-lifecycle）。

## 4. subagent-lifecycle 解散

### 4.1 三条规则的命运

| 规则 | 命运 | 理由 |
|---|---|---|
| Fresh Subagent Per Pass | 消亡 | CLI 模式下每 pass 已是独立 cdd-review 进程调用（`node cdd-review.mjs`），无 subagent 复用风险 |
| Concurrent iff Independent | 消亡 | 同上——并发调度由 orchestrator 控制，不再需要文档化约束 |
| Delegate Load Failure | **内联**到消费者 SKILL.md | 行为价值保留（加载失败 → report + ask + skip-or-abort）；不再依赖共享文档 |

### 4.2 DLF 协议内联

**brainstorming/SKILL.md** 第 59 行：

```diff
- Load failure protocol: see [subagent-lifecycle.md](../docs/subagent-lifecycle.md#rule-delegate-load-failure).
+ Load failure protocol: target skill cannot be resolved/loaded → report the error to the user
+ and ask for next steps. No silent degradation. The user can decide to skip the delegation
+ or abort the flow.
```

**brainstorming/SKILL.zh-CN.md** 第 59 行：

```diff
- 加载失败协议：见 [subagent-lifecycle.md](../docs/subagent-lifecycle.md#rule-delegate-load-failure)。
+ 加载失败协议：目标 skill 无法解析/加载 → 向用户报告错误并询问下一步。不静默降级。用户可选择跳过委托或中止流程。
```

**writing-plans/SKILL.md** 第 29 行：

```diff
- On demand, Read `mattpocock-skills` `skills/engineering/to-tickets/SKILL.md` (ticket splitting Steps 1-4). Load failure protocol: see [subagent-lifecycle.md](../docs/subagent-lifecycle.md#rule-delegate-load-failure).
+ On demand, Read `mattpocock-skills` `skills/engineering/to-tickets/SKILL.md` (ticket splitting Steps 1-4). Load failure protocol: target skill cannot be resolved/loaded → report the error to the user
+ and ask for next steps. No silent degradation. The user can decide to skip the delegation
+ or abort the flow.
```

**writing-plans/SKILL.zh-CN.md** 第 29 行：

```diff
- 按需读取 `mattpocock-skills` `skills/engineering/to-tickets/SKILL.md`（ticket 拆分步骤 1-4）。加载失败协议见 [subagent-lifecycle.md](../docs/subagent-lifecycle.md#rule-delegate-load-failure)。
+ 按需读取 `mattpocock-skills` `skills/engineering/to-tickets/SKILL.md`（ticket 拆分步骤 1-4）。加载失败协议：目标 skill 无法解析/加载 → 向用户报告错误并询问下一步。不静默降级。用户可选择跳过委托或中止流程。
```

### 4.3 Maintainer docs 引用删除

**docs/maintainers/osuperpowers-plugin.md** 第 52 行整段删除：

```diff
- - [docs/subagent-lifecycle.md](../../packages/osuperpowers/docs/subagent-lifecycle.md) -- **fresh subagent per pass**, **concurrent iff independent** dispatch. Cited by every review-pass rule in the osuperpowers skills. Independence means no data dependency (no reading Pass N-1's fixed output), not merely "different categories".
```

**docs/maintainers/osuperpowers-plugin.zh-CN.md** 第 52 行同段删除。

### 4.4 源文件删除

```bash
git rm packages/osuperpowers/docs/subagent-lifecycle.md packages/osuperpowers/docs/subagent-lifecycle.zh-CN.md
```

加上 §3.1 中 4 文档的 `git mv` 后，`packages/osuperpowers/docs/` 目录为空 → `git rm -r` 删除整个目录。

### 4.5 有意留白

- 不改 brainstorming/writing-plans 的其他流程正文（Rules/Red Flags/Checklist 保留散文体——P4/P5 重写自然按 skill-authoring 规范重组）。
- DLF 内联只补最小必要文字（一句话协议），不扩展为完整节点格式（那是 P4/P5 的事）。

## 5. skill-authoring.md

路径：`docs/maintainers/skill-authoring.md`
语言：中文 Strategy B（与同目录其他 maintainer docs 一致）
镜像：无 `.zh-CN.md`（maintainer docs 豁免）

### 5.1 文档骨架

```markdown
# Skill Authoring 规范

- **Version**: v1.0
- **Scope**: P4–P9 所有 osuperpowers 技能 SKILL.md 重写的唯一格式权威
- **读者**: 本仓库维护者 + 执行重构的 AI agent

## 1. 概述

节点锚定式 SKILL.md 的核心思想：digraph 为唯一控制流真相源，正文小节与图节点一一对应。
消灭三重表示（HARD-GATE 清单 + Rules 散文 + Red Flags 规则汤）。

## 2. Flow Digraph 语义约定

- 图用 mermaid / dot 嵌入 SKILL.md 正文（推荐 mermaid——消费者渲染支持更广）
- 节点类型：普通操作（rect）、决策（diamond）、终态（rounded）
- 边：无条件（`-->`）、条件（`-->|label|`）
- 回边：显式标注（用于 review 循环、fix 循环）
- 终止节点：BLOCKED / APPROVED / HANDOFF 三种终态

## 3. Node 四要素模板

每个节点正文必须包含 Do / Read / Exit / Fail 四要素：

- **Do**：节点做什么（1-3 句话）
- **Read**：输入的文件/环境变量/上下文
- **Exit**：出口路由（成功 → 下一节点；条件分支的判定条件）
- **Fail**：失败模式 → 行为（报错/BLOCKED/重试/fail-open）

## 4. Invariants

- 跨节点的不变量，集中声明，**≤5 条**
- 典型 invariant：vendored 不可改、commit 纪律、语言政策、block 政策
- 超限时：检查是否可降级为某节点的 Fail 字段

## 5. Failure Modes 表

- 集中列出跨节点的失败行为映射
- 列：failure → behavior → reason
- 与 Node Fail 字段互补（Fail 字段处理节点局部失败；本表处理跨节点失败）

## 6. BLOCKED 终态约定

- BLOCKED 节点必须包含：
  - 阻塞原因
  - 恢复操作（安装指引 / 用户手动步骤）
  - 不静默 fallback
- block 政策（程序级）：Read-Upstream 规则的上游基线缺失一律为 BLOCKED，不降级

## 7. init legacy 内容豁免

- `skills/init/` 的 harness/spor 两分支内嵌正文保持原样
- 豁免范围：分支内的 prose 内容
- 不豁免：分支结构、外层分派逻辑
- 豁免理由：init 的 payload 是嵌入在 SKILL.md 中的模板文本，非控制流

## 8. 图正文一致性校验清单

P4–P9 重写后，验收必须通过：
1. 图中每个节点 ID 在正文有对应小节
2. 正文每个小节标题与某节点 ID 对齐
3. 无独立 Rules 散文堆（规则必须归属于节点或 Invariants）
4. Red Flags 表拆入节点 Fail 字段或 Invariants（消灭独立 Red Flags 小节）

## 9. 路径字符串编辑边界（P3 专项）

P3 允许对引擎、模板及消费者 SKILL.md 做「仅文档链接/路径字符串」的编辑；行为正文留待 P4–P9。
```

### 5.2 虚构示例节点（嵌入 §3）

```markdown
### 示例：`read-grilling` 节点

    ```mermaid
    flowchart TD
      A[read-grilling] -->|loaded| B[apply-grilling]
      A -->|load failed| Z[BLOCKED: ask user]
    ```

- **Do**: 读取 mattpocock-skills 的 grilling SKILL.md 并加载其框架
- **Read**: `vendors/mattpocock-skills/skills/productivity/grilling/SKILL.md`
- **Exit**: 文件存在 → `apply-grilling`；文件缺失 → BLOCKED
- **Fail**: 读取错误 → 向用户报告错误并询问下一步（skip 或 abort）
```

### 5.3 文档长度目标

~150-200 行（与 docs-review.md 体量对齐，避免过度规范）。

## 6. CLAUDE.md 指引

在 repo `CLAUDE.md` 的 "Per-package documentation" 区块追加一行：

```diff
 - [`docs/maintainers/osuperpowers-router-plugin.md`](docs/maintainers/osuperpowers-router-plugin.md) — osuperpowers-router plugin maintainer guide
+- [`docs/maintainers/skill-authoring.md`](docs/maintainers/skill-authoring.md) — skill authoring specification (node-anchored SKILL.md format, Chinese Strategy B)
```

**同步清理**：删除 CLAUDE.md 第 45 行（Architecture details 区块）：

```diff
- - `packages/osuperpowers/docs/` — cross-cutting docs (cdd-reference, handoff-schema, docs-review, subagent-lifecycle)
```

迁移后该目录不再存在，此行成为死引用。4 文档已分散至各自消费者 `skills/*/docs/`，无需替代行。

Strategy B extension 段无需改动——skill-authoring.md 自动落入 `docs/maintainers/*.md` 的既有语言政策（中文主源、无 zh-CN 镜像、不 shipped to consumers）。

## 7. 执行策略

**两原子提交**（Approach A）：

### Commit 1: `refactor: migrate shared docs to consumer skills and dissolve subagent-lifecycle`

**顺序**（SOT-first，与 P2 同口径）：

1. `git mv` 4 文档（8 文件）到 `skills/*/docs/`
2. §3.2 引用方路径同步（SKILL.md×3 对 + templates + cross-harness-overrides + maintainer docs）
3. §3.3 engine 路径字符串（cdd-gate-core + contract.mjs 注释）
4. §3.4 engine 测试 fixture 路径（templates.test.mjs + rule-reference.test.mjs）
5. §3.5 line budget 调整（templates.mjs LINE_BUDGETS + templates.test.mjs 删 subagent-lifecycle 引用）
6. §4.2 DLF 协议内联到 brainstorming + writing-plans（SKILL.md + zh-CN 共 4 处）
7. §4.3 maintainer docs subagent-lifecycle 条目删除（osuperpowers-plugin.md + zh-CN）
8. §4.4 `git rm` subagent-lifecycle.md + zh-CN；空目录 `git rm -r packages/osuperpowers/docs/`
9. `pnpm run emit` 级联再生（.agents/ 派生品同步）
10. `pnpm run validate` ALL PASS
11. 终扫预演（P10 同口径 token 归零）
12. 单 commit

### Commit 2: `docs: add skill-authoring specification for node-anchored SKILL.md format`

1. 新建 `docs/maintainers/skill-authoring.md`
2. 更新 repo `CLAUDE.md` 增指引条目
3. 单 commit

### 约束

- vendored 子模块不可改。
- 不建 changeset（P10 统一）。
- 路径字符串编辑边界（§9）：仅改文档链接 / 路径字符串 / 注释字符串，不改引擎行为正文。
- 两次 commit 间 `pnpm run validate` 必须绿（commit 1 落地时目录已空 + 引用已归零）。

## 8. 验收标准

1. `packages/osuperpowers/docs/` 目录不存在（4 文档已迁 + subagent-lifecycle 已删 + 空目录已 rm）
2. 4 文档新家存在且链接可解析（含消费者 SKILL.md 的外部引用 + 迁移文档内部的互引用，如 cdd-reference ↔ controller-handoff）：
   - `packages/osuperpowers/skills/cli-driven-development/docs/{cdd-reference,controller-handoff,handoff-schema}.md` (+ zh-CN)
   - `packages/osuperpowers/skills/writing-plans/docs/docs-review.md` (+ zh-CN)
3. `docs/maintainers/skill-authoring.md` 存在且包含 §5.1 全部 9 节（概述 / Flow digraph 语义约定 / Nodes 四要素模板 / Invariants ≤5 / Failure Modes 表 / BLOCKED 终态约定 / init legacy 内容豁免规则 / 图正文一致性校验清单 / 路径字符串编辑边界）+ §5.2 虚构示例节点（`read-grilling`）嵌入 §3 内
4. repo `CLAUDE.md` 有 skill-authoring.md 引用条目
5. `subagent-lifecycle` 在全仓 grep（范围同 P10 终扫：`packages/` 排除 CHANGELOG + `bin/engine/tests/` 防回归断言；`docs/` 排除 `superpowers/{specs,plans,tickets}/` 历史；`docs/maintainers/` 应为零；根 README；`marketplace/source.json`）归零
6. 旧 docs 路径（`packages/osuperpowers/docs/cdd-reference`、`packages/osuperpowers/docs/controller-handoff`、`packages/osuperpowers/docs/handoff-schema`、`packages/osuperpowers/docs/docs-review`）同口径 grep 归零
7. `pnpm run emit && pnpm run validate` ALL PASS（12 块）
8. 两次原子 commit 落地，工作树干净

## Change history

- v1.0 · 2026-08-26 — 初版（dogfood session）：4 文档迁移表 + subagent-lifecycle 三条规则命运 + DLF 内联文本 + skill-authoring 9 节骨架 + 两 commit 拆分 + 8 条验收。
- v1.0.1 · 2026-08-26 — 3-pass review 吸收（Pass 1 blocker×2 已修：§3.2 迁移文档内部互引用链接文本同步 + §6 CLAUDE.md Architecture details 死引用删除；Pass 1+2 warn×3 已修：§2 非目标扩例外 + §3.2 链接文本/目标区分示例 + §4.2 writing-plans DLF 具体 diff；Pass 3 warn×2 已修同上）。
