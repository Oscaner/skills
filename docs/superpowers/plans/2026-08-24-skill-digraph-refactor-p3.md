# P3 docs-infra — Implementation Plan

- **Version**: v1.0 · 2026-08-26
- **Spec**: [2026-08-24-skill-digraph-refactor-p3-design.md](../specs/2026-08-24-skill-digraph-refactor-p3-design.md)
- **Upstream program**: [Overall spec v1.5](../specs/2026-08-24-skill-digraph-refactor-overall.md)

## Global Constraints

- 允许破坏性更新（用户指令）；vendored 子模块不可改。
- changeset 仅 P10 统一建——本 phase 不建 changeset。
- 两原子提交：commit 1 = 迁移+解散+emit+validate+终扫；commit 2 = skill-authoring+CLAUDE.md。
- 路径字符串编辑边界：仅改文档链接 / 路径字符串 / 注释字符串，不改引擎行为正文（spec §9）。
- 终扫口径：P10 同范围 token 归零（`packages/` 排除 CHANGELOG；`docs/` 排除历史 specs/plans/tickets；根 README；`marketplace/source.json`）。

### Task 1: 文档迁移 + subagent-lifecycle 解散 + 路径同步 + 验证

**步骤**：

1. **git mv 4 文档（8 文件）**：

   ```bash
   mkdir -p packages/osuperpowers/skills/cli-driven-development/docs
   mkdir -p packages/osuperpowers/skills/writing-plans/docs
   git mv packages/osuperpowers/docs/cdd-reference.md packages/osuperpowers/skills/cli-driven-development/docs/
   git mv packages/osuperpowers/docs/cdd-reference.zh-CN.md packages/osuperpowers/skills/cli-driven-development/docs/
   git mv packages/osuperpowers/docs/controller-handoff.md packages/osuperpowers/skills/cli-driven-development/docs/
   git mv packages/osuperpowers/docs/controller-handoff.zh-CN.md packages/osuperpowers/skills/cli-driven-development/docs/
   git mv packages/osuperpowers/docs/handoff-schema.md packages/osuperpowers/skills/cli-driven-development/docs/
   git mv packages/osuperpowers/docs/handoff-schema.zh-CN.md packages/osuperpowers/skills/cli-driven-development/docs/
   git mv packages/osuperpowers/docs/docs-review.md packages/osuperpowers/skills/writing-plans/docs/
   git mv packages/osuperpowers/docs/docs-review.zh-CN.md packages/osuperpowers/skills/writing-plans/docs/
   ```

2. **消费者 SKILL.md 路径同步**（6 文件，12 处）：
   - `skills/cli-driven-development/SKILL.md` 第 18 行：`../../docs/cdd-reference.md` → `./docs/cdd-reference.md`
   - 同上 第 29 行：`../../docs/controller-handoff.md` → `./docs/controller-handoff.md`
   - `skills/cli-driven-development/SKILL.zh-CN.md`：同上两行
   - `skills/writing-plans/SKILL.md` 第 47 行：`../docs/docs-review.md` → `./docs/docs-review.md`
   - `skills/writing-plans/SKILL.zh-CN.md` 第 47 行：同上
   - `skills/brainstorming/SKILL.md` 第 85 行：`../docs/docs-review.md` → `../writing-plans/docs/docs-review.md`
   - `skills/brainstorming/SKILL.zh-CN.md` 第 85 行：同上

3. **迁移文档内部互引用链接文本同步**（4 处）：
   - `skills/cli-driven-development/docs/cdd-reference.md` 第 4 行：`` [`docs/controller-handoff.md`](controller-handoff.md) `` → `` [`controller-handoff.md`](controller-handoff.md) ``
   - `skills/cli-driven-development/docs/cdd-reference.zh-CN.md`：同上
   - `skills/cli-driven-development/docs/controller-handoff.md` 第 42 行：`` [`docs/cdd-reference.md`](cdd-reference.md) `` → `` [`cdd-reference.md`](cdd-reference.md) ``
   - `skills/cli-driven-development/docs/controller-handoff.zh-CN.md`：同上

4. **Templates 路径同步**（1 文件，2 处）：
   - `templates/cdd/_handoff-write-fragment.md` 第 3 行：`../../docs/handoff-schema.md` → `../../skills/cli-driven-development/docs/handoff-schema.md`；`../../docs/controller-handoff.md` → `../../skills/cli-driven-development/docs/controller-handoff.md`

5. **Cross-package docs 路径同步**（1 文件，3 处）：
   - `packages/osuperpowers-router/docs/cross-harness-overrides.md` 第 78、82、190 行：`../../osuperpowers/docs/cdd-reference.md` → `../../osuperpowers/skills/cli-driven-development/docs/cdd-reference.md`

6. **Maintainer docs 引用同步**（2 文件，4 处）：
   - `docs/maintainers/osuperpowers-plugin.md` 第 53 行：`../../packages/osuperpowers/docs/docs-review.md` → `../../packages/osuperpowers/skills/writing-plans/docs/docs-review.md`
   - 同上 第 211 行：`../../packages/osuperpowers/docs/cdd-reference.md` → `../../packages/osuperpowers/skills/cli-driven-development/docs/cdd-reference.md`
   - `docs/maintainers/osuperpowers-plugin.zh-CN.md`：同上两行

7. **Engine 路径字符串**（2 文件，3 处）：
   - `bin/gate/cdd-gate-core.mjs` 第 249 行：`${osRoot}/docs/cdd-reference.md` → `${osRoot}/skills/cli-driven-development/docs/cdd-reference.md`
   - `bin/engine/lib/contract.mjs` 第 2 行注释：`docs/handoff-schema.md` → `skills/cli-driven-development/docs/handoff-schema.md`
   - 同上 第 44 行注释：同上

8. **Engine 测试 fixture 路径**（2 文件，5 处）：
   - `bin/engine/tests/templates.test.mjs` 第 105 行：`docs/controller-handoff.md` → `skills/cli-driven-development/docs/controller-handoff.md`
   - 同上 第 107 行：`docs/docs-review.md` → `skills/writing-plans/docs/docs-review.md`
   - 同上 第 138 行：同上
   - `tests/rule-reference.test.mjs` 第 225 行 fixture：`../docs/controller-handoff.md` → `../skills/cli-driven-development/docs/controller-handoff.md`
   - 同上 第 245 行 fixture：`../../docs/controller-handoff.md` → `../../skills/cli-driven-development/docs/controller-handoff.md`

9. **Line budget 调整**（2 文件）：
   - `bin/engine/lib/templates.mjs` 第 12 行注释：`// tier2 = tier1 + subagent-lifecycle + docs-review` → `// tier2 = tier1 + docs-review`
   - 同上 `LINE_BUDGETS.tier2`：350 → 320
   - `bin/engine/tests/templates.test.mjs` 第 106 行：删除 `const life = wcLines("docs/subagent-lifecycle.md");`（及任何对 `life` 变量的后续引用——检查 tier2 断言是否用 `life` 行数，若有则同步移除该加法项）

10. **DLF 协议内联**（4 处）：
    - `skills/brainstorming/SKILL.md` 第 59 行：`Load failure protocol: see [subagent-lifecycle.md](../docs/subagent-lifecycle.md#rule-delegate-load-failure).` → `Load failure protocol: target skill cannot be resolved/loaded → report the error to the user and ask for next steps. No silent degradation. The user can decide to skip the delegation or abort the flow.`
    - `skills/brainstorming/SKILL.zh-CN.md` 第 59 行：`加载失败协议：见 [subagent-lifecycle.md](../docs/subagent-lifecycle.md#rule-delegate-load-failure)。` → `加载失败协议：目标 skill 无法解析/加载 → 向用户报告错误并询问下一步。不静默降级。用户可选择跳过委托或中止流程。`
    - `skills/writing-plans/SKILL.md` 第 29 行：同 brainstorming 英文替换
    - `skills/writing-plans/SKILL.zh-CN.md` 第 29 行：同 brainstorming 中文替换

11. **Maintainer docs subagent-lifecycle 条目删除**（2 文件）：
    - `docs/maintainers/osuperpowers-plugin.md` 第 52 行整段删除（`- [docs/subagent-lifecycle.md](...)` 开头的列表项）
    - `docs/maintainers/osuperpowers-plugin.zh-CN.md` 第 52 行同段删除

12. **subagent-lifecycle 源文件删除 + 空目录清理**：

    ```bash
    git rm packages/osuperpowers/docs/subagent-lifecycle.md packages/osuperpowers/docs/subagent-lifecycle.zh-CN.md
    git rm -r packages/osuperpowers/docs/
    ```

13. **`pnpm run emit` 级联再生**（.agents/ 派生品同步）。

14. **`pnpm run validate` ALL PASS**。

15. **终扫预演**（P10 同口径）：

    ```bash
    grep -rn "subagent-lifecycle\|packages/osuperpowers/docs/cdd-reference\|packages/osuperpowers/docs/controller-handoff\|packages/osuperpowers/docs/handoff-schema\|packages/osuperpowers/docs/docs-review" \
      packages/ docs/ README.md marketplace/source.json \
      --exclude="CHANGELOG.md" \
      --exclude-dir=specs --exclude-dir=plans --exclude-dir=tickets
    ```

    预期 0 命中。

16. **Commit 1**：`refactor: migrate shared docs to consumer skills and dissolve subagent-lifecycle`

**验收**：
- `packages/osuperpowers/docs/` 目录不存在；
- 4 文档新家存在（8 文件）；
- 终扫 grep 0 命中；
- validate ALL PASS；
- commit 1 落地。

### Task 2: skill-authoring.md 新建 + CLAUDE.md 指引更新

**步骤**：

1. **新建 `docs/maintainers/skill-authoring.md`**（中文 Strategy B，~150-200 行）：
   - §1 概述：节点锚定式核心思想（digraph 为唯一控制流真相源；消灭三重表示）
   - §2 Flow Digraph 语义约定：mermaid 嵌入、节点类型（rect/diamond/rounded）、边类型（无条件/条件/回边）、终止节点（BLOCKED/APPROVED/HANDOFF）
   - §3 Node 四要素模板：Do / Read / Exit / Fail；**含虚构示例节点 `read-grilling`**
   - §4 Invariants：≤5 条跨节点不变量；超限降级检查
   - §5 Failure Modes 表：failure → behavior → reason
   - §6 BLOCKED 终态约定：阻塞原因 + 恢复操作 + 不静默 fallback；block 政策（Read-Upstream 缺失一律 BLOCKED）
   - §7 init legacy 内容豁免：harness/spor 分支内嵌正文豁免范围与理由
   - §8 图正文一致性校验清单：4 条验收规则
   - §9 路径字符串编辑边界（P3 专项说明）

   骨架文本参见 spec §5.1。

2. **更新 repo `CLAUDE.md`**（2 处）：
   - 在 "Per-package documentation" 区块追加一行：`- [\`docs/maintainers/skill-authoring.md\`](docs/maintainers/skill-authoring.md) — skill authoring specification (node-anchored SKILL.md format, Chinese Strategy B)`
   - 删除第 45 行（Architecture details 区块）：`- \`packages/osuperpowers/docs/\` — cross-cutting docs (cdd-reference, handoff-schema, docs-review, subagent-lifecycle)`

3. **Commit 2**：`docs: add skill-authoring specification for node-anchored SKILL.md format`

**验收**：
- `docs/maintainers/skill-authoring.md` 存在且包含 spec §5.1 全部 9 节 + §5.2 虚构示例节点；
- `CLAUDE.md` 有 skill-authoring.md 引用条目；
- `CLAUDE.md` 无 `packages/osuperpowers/docs/` 死引用；
- commit 2 落地，工作树干净。

## Change history

- v1.0 · 2026-08-26 — 初版（dogfood session）：2 Task 分解——Task 1 迁移+解散+路径同步（16 步）；Task 2 skill-authoring+CLAUDE.md（3 步）。
- v1.0.1 · 2026-08-26 — plan review Pass 1 (completeness) 零发现，Pass 2/3 按 D1 跳过。
