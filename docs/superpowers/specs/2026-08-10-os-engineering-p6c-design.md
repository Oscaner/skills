# os-engineering P6c 阶段设计：research 集成

## Header

- **Version**: v1.0 · 2026-08-18
- **Status**: Draft
- **Author**: Oscaner Miao · Claude Code (Opus 4.8)
- **Parent program**: [os-engineering overall v2.9](2026-08-10-os-engineering-overall.md)
- **Depends on**: P6a（skills-missing 前置检查 + cli review）+ P6b（交付补齐）

## §0 Incremental warning

> P6c 增量。跨阶段约定见 [overall v2.9](2026-08-10-os-engineering-overall.md)；冲突以 overall 为准。

## §1 Constraints pointer

- 不重复 overall 约定；冲突以 overall 为准。
- **research 集成（P6c）**：os-brainstorming explore-context 阶段，orchestrator 识别需要 primary source 研究的问题 → 问用户确认 → spawn mattpocock-skills:research 后台 agent → findings → `docs/research/`。
- Conventional commits、无 attribution；禁 git worktree；`pnpm run validate` 保持通过。

## §2 Design body

### 2.0 范围

P6c 单一变更：在 os-brainstorming SKILL.md 新增 `Rule: Research Delegation`，将 mattpocock-skills:research 融入 explore-context 流程。

### 2.1 Component 1: Rule: Research Delegation

新增到 `packages/engineering/skills/os-brainstorming/SKILL.md`（在 `Rule: Read Sub-Skills` 之后、`Rule: Overall-Phase` 之前）：

```markdown
### Rule: Research Delegation

explore-context 阶段发现需要 primary source 研究的问题时（代码库无法回答的：upstream API 行为、
harness CLI 规范、包内部结构、跨 harness 差异等）：

1. **识别 + 问用户**：列出需要研究的问题，问「是否触发 research？」（多问题可一次征求）
   - 用户确认 → spawn research agent（步骤 2-6）
   - 用户拒绝 → 跳过该问题，**正常流程继续**（explore-context → grilling）
2. **Spawn background agent**：每个研究问题 spawn 一个 mattpocock-skills:research agent（并行）。
   Research agent 的 prompt = 问题描述 + 要求 citation 的指令。
3. **继续 explore-context**（代码探索不中断）
4. **等完成**：进入 grilling 前，确保所有后台 research 完成。
5. **产出**：findings 写入 `docs/research/YYYY-MM-DD-<topic>.md`（遵循现有 convention，
   见 `docs/research/` 下已有 3 份）。
6. **消费**：research findings 在后续 grilling + approach selection + design 中作为
   primary source 引用（非 ad-hoc 重搜）。

触发条件（非穷尽，orchestrator 判断）：
- 用户问题涉及外部 API / CLI 的行为规范（代码库查不到）
- 上游包的内部结构或约定（如 pi CLI 发现机制）
- 跨 harness 差异需要对比验证

不触发条件：
- 问题可从代码库 / docs / git history 直接回答
- 纯设计决策（不需要外部事实）

触发失败（research agent 出错/超时）→ 记录 stderr，不阻塞流程（fail-open）。
```

**触发条件说明**：orchestrator 在 explore-context 过程中（读文件、grep、检查 git history）判断某个问题是否可从代码库直接回答。不可回答的 → 列出需要研究的问题，问用户确认。用户拒绝 → 跳过，正常流程继续（explore-context → grilling）。

### 2.2 流程位置

```
现有 os-brainstorming 流程:
  Read Upstream → Read Sub-Skills → explore-context → grilling → approaches → design → spec review → write doc

P6c 修改后:
  Read Upstream → Read Sub-Skills → explore-context → [Research Delegation] → grilling → approaches → design → spec review → write doc
                                      ↑ orchestrator 识别 + 问用户 ↑
                                      ↑ spawn background agents     ↑
                                      ↑ 等完成 before grilling      ↑
```

Research 插入 explore-context 和 grilling 之间，不影响后续流程。

### 2.3 研究产出约定

- **路径**：`docs/research/YYYY-MM-DD-<topic>.md`（遵循既有 convention）
- **格式**：research question + executive summary + primary sources + claims with citations
- **引用**：后续 grilling + approach + design 中作为 primary source 引用（避免重复研究）
- **既有 3 份**：`2026-08-10-harness-hooks-matrix.md`、`2026-08-10-harness-marketplace-hooks.md`、`2026-08-16-harness-plugin-availability.md`——P6c 不修改这些已有文件

### 2.4 错误处理

- research agent 出错 → 记录 stderr，不阻塞流程（fail-open）
- research agent 超时 → 同上
- 多个 research agent 中一个失败 → 其余继续，成功的 findings 正常消费

### 2.5 非目标

- ❌ 不自动触发（用户确认是硬门）
- ❌ 不改 mattpocock-skills:research 本身
- ❌ 不改 grilling / Overall-Phase / Spec Review / Write Design 流程
- ❌ 不新建 skill 文件
- ❌ 不修改已有的 3 份 research docs

### 2.6 验收标准

- [ ] os-brainstorming SKILL.md 包含 `Rule: Research Delegation`
- [ ] Rule 内容与 §2.1 一致（触发条件 + 拒绝分支 + 并行 + fail-open）
- [ ] Rule 位置在 `Read Sub-Skills` 之后、`Overall-Phase` 之前
- [ ] `pnpm run emit` 再生成 `.agents/skills/engineering/os-brainstorming/SKILL.md`（不 drift）
- [ ] `pnpm run validate` ALL PASS
- [ ] 文档一致（CLAUDE.md / 其他引用无矛盾）

## §3 Deviations from overall

无。P6c 不改变 overall 约定。

## §4 Notes for downstream

- P6d（文档语言 + 重写）可引用 P6c 的 research 产出作为文档素材。
- research findings 的 citation 约定（mattpocock-skills:research 原生行为）不需要 P6c 额外强制。

## §5 Review

Rule 1 三个 subagent pass 通过后交用户 review，再进入 writing-plans。
