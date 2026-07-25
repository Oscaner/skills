# Overall + Phase Spec Organization Template

Reference doc for `brainstorming-overrides` Rule 3. Read this when producing an overall or phase spec — do not re-implement these conventions from memory.

---

## Overall Spec — Required Structure

### 1. Version header

At the top of the file, before any section:

```
- **版本**：v1.0 · YYYY-MM-DD
- **状态**：总览已批准，子项目 spec 陆续 brainstorming
- **作者**：[Name] · Claude Code (Opus 4.8)
- **约束**：[key project-level constraints, one per line]
```

### 2. `## 0 · 本文档的定位` section

Immediately after the version header. Must include:
- "这是总纲，不含实现细节。每个子项目有独立的设计 spec + 实现 plan"
- "每次要开新子项目前，先来这里确认：位置、上游依赖、横切约束是否已改变"
- "后续任何决策要偏离本文档时，必须先 update 本文档再往下写"

### 3. Phase spec 清单表（4 columns）

```markdown
| # | 子项目 | 设计 spec | 实现 plan |
|---|---|---|---|
| P0 | [description] | 待写 | 待写 |
| P1 | [description] | 待写 | 待写 |
```

- Pending phases: fill spec and plan columns with `待写`
- On completion: append `✅ 完成 (tag \`<slug>-complete\` @ <sha>)` to the plan cell
- Do NOT add a separate Status column — completion is encoded in the plan cell

### 4. Dependency graph (ASCII)

```
P0 → P1 → P2a → P2b
              ↘ P2c
```

### 5. Explicit boundary rules section

Must include, verbatim or equivalent:

> 每个 phase 独立 brainstorming + writing-plans + development，不允许"顺手把下一个 phase 一起做了"。Phase N 的 spec → plan → development 全部 shipped（打 git tag）之后，才开始 Phase N+1 的 brainstorming。

### 6. Document maintenance rules section

Must include:
- "每完成一个 phase：更新清单表 spec/plan 链接，如有偏离写在变更历史，本文档不留任务清单"
- "本文档是主 spec：任何跨 phase 的约定变更必须先修改本文档，再改 phase spec"
- "子项目 spec 只写增量：不要重复本文档已有的公约；差异时以本文档为准"

### 7. Change history table

```markdown
| 日期 | 版本 | 变更 |
|---|---|---|
| YYYY-MM-DD | v1.0 | 初版 |
| YYYY-MM-DD | v1.1 | Pn 完成（tag `xxx` @ sha）· deliverables summary |
```

- One row per meaningful change (new phase completion, decomposition, scope shift)
- Completion row format: `Pn 完成（tag \`xxx\` @ sha）· [deliverables: endpoints, tests, key decisions]`
- Append-only — never edit or delete rows

---

## Phase Spec — Required Structure

### 1. Version header

```
- **版本**：v1.0 · YYYY-MM-DD
- **状态**：设计已批准，待写 plan
- **作者**：[Name] · Claude Code (Opus 4.8)
- **父项目**：[overall title and link, including overall version number]
- **依赖前置**：Phase N（tag `<slug>-complete` @ <sha>）
```

### 2. Incremental warning

Immediately after the header:

```
> ⚠️ 本 spec 只覆盖 Phase N 增量。跨 phase 的技术公约以 [overall 主 spec](link) 为准；本文与主 spec 冲突时以主 spec 为准。
```

### 3. Cross-cutting constraints

Do NOT duplicate constraints from the overall. Instead:

> 本 spec 不重复 overall 的横切公约。差异时以 overall 为准。

---

## Execution Rules

### Serial execution (core rule)

Phase N 的 spec → plan → development **全部 shipped（打 git tag）**之后，才开始 Phase N+1 的 brainstorming。

禁止在 Phase N 开发期间预先写 Phase N+1 的 spec——Phase N shipped 后的实际结果经常改变 N+1 的 scope，提前写的 spec 会被废弃或产生方向错误的实现。

### Dynamic in-place decomposition

When a phase's brainstorming reveals it is too large:

1. **Do NOT create a sub-overall.** One overall per program.
2. In the overall's phase table, split the row into Na, Nb, … with one-paragraph scope + dependencies each
3. Re-run user approval (Step 3) before drafting any sub-phase spec
4. Decomposition principle: each sub-phase introduces ≤1 new technology stack; each sub-phase is independently demo-able/verifiable
5. Record the decomposition as a change history entry (with reason)

### Completion signal

打 git tag（命名：`<slug>-complete`），在 overall 清单 plan 列加 `✅ 完成 (tag \`xxx\` @ sha)`，在变更历史加一行（含 tag + sha + 完整 deliverables）。
