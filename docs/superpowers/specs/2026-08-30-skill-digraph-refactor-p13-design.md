# P13: Closure — grep 终扫 + 变更集 + tier re-baseline + governance 测试

- **Version**: v1.0
- **Status**: Approved
- **Date**: 2026-08-30
- **Phase**: P13 (closure)
- **Program**: skill-digraph-refactor
- **Overall**: [overall spec v1.22](./2026-08-24-skill-digraph-refactor-overall.md)

---

## Scope

P13 作为程序最后一个 phase，执行全仓库终扫（grep sweep）、统一变更集、tier 预算 re-baseline、图正文一致性 governance 测试，以及 skill-authoring.md 的语言架构转换。目标：确认 P1-P12 所有重写无残留，为程序画上句号。

**Design spec 不是最终 CDD plan 的替代品**——task decomposition 留待 writing-plans。

---

## Section 1: grep 终扫 + 回归防护测试 + skill-authoring 语言转换

### 1a. grep 终扫

**in-scope 树**（含排除）：
- `packages/`：排除各包 `CHANGELOG.md`（append-only 历史）；排除 `bin/engine/tests/` 中 `--prompt` 字面量（P1 新增断言）
- `docs/`：排除 `docs/superpowers/{specs,plans,tickets}/` 历史文档；**删除 `docs/research/` 整个目录**（4 份历史研究文档，用户决策）
- 根 `README.md`、`marketplace/source.json`

**Token 清单**（全部零命中为验收标准）：

| Token | 说明 |
|-------|------|
| `osuperpowers:debugging` | 已删除技能引用 |
| `skills/debugging/` | 已删除技能路径 |
| `osuperpowers:verification` | 已删除技能引用 |
| `skills/verification/` | 已删除技能路径 |
| `cli-task` | 已删除技能引用 |
| `--prompt` | 已删除引擎参数 |
| `subagent-lifecycle` | 已解散文档引用 |
| `docs/cdd-reference`（旧路径） | 旧 docs 路径（应迁移至 skills/cli-driven-development/docs/） |
| `HARD-GATE` | 旧格式关键词（仅 SKILL.md 文件） |
| `## Rules`（仅 SKILL.md） | 旧格式关键词——独立小节标题（grep 模式：`^#{1,2} Rules$`，兼容 H1/H2） |
| `## Red Flags`（仅 SKILL.md） | 旧格式关键词——独立小节标题（grep 模式：`^#{1,2} Red Flags$`，兼容 H1/H2） |
| `## Checklist`（仅 SKILL.md） | 旧格式关键词——独立小节标题 |
| `executing-plans` | 已删除/重命名技能引用 |
| `subagent-driven-development` | 旧触发词——允许出现的场景见合法残余列表（router routing code、vendor path probe、changelog） |
| `cli-code-review` | 已删除技能引用 |
| `review-dispatch` | 已解散文档引用 |

**合法残余**（不在零命中要求内）：
- `packages/osuperpowers-router/tests/validate-overrides-build.mjs` 中 `spor-subagent-lifecycle` slug（防回归断言，确保已删技能不复现）
- `packages/osuperpowers/bin/engine/lib/runner.mjs:179,190` 中 `subagent-driven-development` 上游 vendor path probe（引擎定位上游 superpowers scripts 目录，引用的是 vendored 仓库中的存活技能）
- `packages/osuperpowers/bin/engine/tests/runner.test.mjs:240,253,257,265,360` 中 `subagent-driven-development` 测试 fixture（对 runner.mjs vendor probe 的回归测试）
- `docs/maintainers/` 中 `subagent-lifecycle → **dissolved**` 语义声明（维护者文档说明解散）
- `docs/maintainers/skill-authoring.md` 中 `HARD-GATE` 在对比表中的使用（描述旧模式对比）
- `packages/osuperpowers-router/` 中 overrides routing 映射条目（`superpowers:subagent-driven-development` → `osuperpowers:cli-driven-development`）
- `packages/*/CHANGELOG.md` 中的历史记录条目

### 1b. 额外文档清理

- **删除** `docs/research/`（4 文件：`2026-08-10-harness-hooks-matrix.md`、`2026-08-10-harness-marketplace-hooks.md`、`2026-08-16-harness-plugin-availability.md`、`2026-08-18-bilingual-file-organization.md`）
- **修复** `docs/maintainers/osuperpowers-plugin.md:60-66`：skill flow 从 `brainstorming --> writing-plans --> subagent-driven-development` 更新为 `brainstorming --> writing-plans --> cli-driven-development`；删除 lines 64-66 中 `/to-tickets` 发布步骤描述及 tickets 目录说明（P5 已移除 to-tickets，CDD 模式下不再产出 tickets）
- **修复** `docs/maintainers/osuperpowers-plugin.zh-CN.md:60`：中文镜像同步
- **修复** `docs/gate-install.md:251`：`/subagent-driven-development` 更新为 `/cli-driven-development`

### 1c. skill-authoring.md 语言转换

- **英文主源**：`docs/maintainers/skill-authoring.md` 从中文翻译为英文（Strategy A 英文 primary）
- **中文镜像**：新建 `docs/maintainers/skill-authoring.zh-CN.md`（保留现有中文内容作为镜像）
- **CLAUDE.md 更新**：Strategy B extension 段落（line 83-85）当前文本："`docs/maintainers/*.md` are maintainer-only documents ... They are written **in Chinese**, may carry Chinese labels, and need **no** `.zh-CN.md` mirror." → 改为："`docs/maintainers/*.md（except skill-authoring.md）` are maintainer-only documents ... They are written **in Chinese**, may carry Chinese labels, and need **no** `.zh-CN.md` mirror. `docs/maintainers/skill-authoring.md` follows Strategy A (English primary + zh-CN mirror) — it is the format authority for SKILL.md authoring and is consumed by AI harnesses, so it requires English as the source of truth."

### 1d. 回归防护测试

新建 `packages/osuperpowers/tests/grep-sweep-regression.test.mjs`：
- 对每个 token 在 in-scope 树上运行 `grep -rn`
- 断言零命中（排除合法残余列表）
- 测试可复现，CI 保护防止 token 回流

---

## Section 2: 统一 changeset + issue 关闭

### 2a. 统一变更集

在 `.changeset/` 新建变更集文件，覆盖整个 P1-P14 程序：
```yaml
---
"@oscaner-skills/osuperpowers": major
"@oscaner-skills/osuperpowers-router": major
---

BREAKING: remove cli-task, debugging, verification skills and their trigger tokens
feat: rewrite all orchestration skills to node-anchored format (digraph as single control-flow SOT)
fix: CDD engine contract fixes (status unification, SHA consistency, timeout handling, engine recovery)
feat: add cli-research skill (standalone CDD research CLI)
feat: add cli-driven-development orchestrator (three-mode chain + deferred disposition)
refactor: brainstorming add claim-phase gate (I6 Register-before-grill + I7 Serial-phase discipline)
```

### 2b. 旧 changeset 清理

删除 `.changeset/` 下为单独 phase 产出的旧变更集文件：
- `add-cli-research-skill.md`
- `dogfood-fixes-p2.md`、`dogfood-fixes-p3.md`、`dogfood-fixes-p5.md`
- `dogfood-p4-templates.md`
- `next-step-routing.md`
- `p1-p2-cli-reviewer-pipeline-p1-p2.md`
- `remove-cdd-task-mode-b.md`
- `718c3ad7.md`

保留：新统一 changeset + `README.md` + `config.json` + `versioned-plugins.json`。

### 2c. Issue 关闭引用

在统一 changeset 的 commit message 或关联 PR body 中包含：
```
Closes #168
Closes #169
Closes #173
```

---

## Section 3: tier 预算 re-baseline

### 3a. 测量数据

post P4-P9 rewrite 实测行数（host 文件 = SKILL.md + 参考文档）：

| Host 文件 | 实测行数 | 当前预算 | 新预算（~120%） | 推导 |
|-----------|---------|---------|-------------|------|
| `cli-driven-development/SKILL.md` | 175 | 175（精确到 cap，无 headroom） | **210** | 175 × 1.2 = 210 |
| `controller-handoff.md` | 42 | 110 | **50** | 42 × 1.2 = 50.4 ≈ 50 |
| `docs-review.md` | 71 | — | — | 仅参与 tier2 计算 |
| `tier1` (sdd+ctrl) | 217 | 225 | **260** | 210 + 50 = 260 |
| `tier2` (tier1+rev) | 288 | 320 | **331** | 260 + 71 = 331（与 tier1 依赖） |

### 3b. 修改文件

- `packages/osuperpowers/bin/engine/lib/templates.mjs`：`LINE_BUDGETS` 常量更新为 `{ sdd: 210, ctrl: 50, tier1: 260, tier2: 331 }`
- `packages/osuperpowers/bin/engine/tests/templates.test.mjs`：
  - `lineBudget: 真实阈值` 测试断言更新
  - `governance: 真实行预算` 测试中 tier 阈值断言更新

---

## Section 4: 图正文一致性校验测试（governance）

### 4a. 新文件

`packages/osuperpowers/tests/digraph-consistency.test.mjs`

### 4b. 测试范围

所有 osuperpowers 技能的 SKILL.md 文件：`packages/osuperpowers/skills/*/SKILL.md`，**排除 init**（legacy 内容豁免，skill-authoring §7）。

### 4c. 四清单断言

每个清单对应独立 `test()` 用例：

1. **节点覆盖**：mermaid 块中每个操作/决策节点 ID（`A[name]` / `A{Name?}`）在正文有对应的 `### \`name\`` 小节标题。**终态节点**（`Z((...))`、`O((...))`、`P((...))`、`M((...))` 等双圈节点）豁免此检查——终态节点通常无独立小节，仅在图中声明
2. **小节对齐**：正文每个 `### \`...\`` 小节标题在 mermaid 块中有对应节点 ID（无孤立小节）
3. **无独立 Rules 散文堆**：SKILL.md 中不出现 `# Rules` 或 `## Rules` 作为独立小节标题（grep 模式：`^#{1,2} Rules$`；规则归属于节点 Do/Read/Exit/Fail 或 Invariants 表）
4. **无独立 Red Flags**：SKILL.md 中不出现 `# Red Flags` 或 `## Red Flags` 作为独立小节标题（grep 模式：`^#{1,2} Red Flags$`）

**测试设计**：扫描每个 SKILL.md 文件，解析 mermaid 块提取节点 ID 列表，解析 `### \`...\`` 标题提取小节 ID 列表，断言双向包含（节点覆盖 + 小节对齐）。2/4 项为简单字符串断言（Rules 缺失 + Red Flags 缺失）；2/4 项为复杂解析断言（节点覆盖 + 小节对齐需 mermaid 解析）。

---

## Acceptance criteria

① 上述限定范围内 grep 终扫清单逐项为零（`grep-sweep-regression.test.mjs` 通过）
② `changeset` 含 breaking 标注（`.changeset/*.md` frontmatter 含两个包的 `major` 标注 + body 含 `BREAKING:` 行；`pnpm run changeset` exit 0）
③ `pnpm run emit && pnpm run validate` 绿（含 128+ tests + 新增 governance tests）
④ `#168` / `#169` / `#173` 关闭引用附 commit
⑤ tier 预算 re-baseline 完成（`templates.mjs` LINE_BUDGETS = `{ sdd: 210, ctrl: 50, tier1: 260, tier2: 331 }`）
⑥ 图正文一致性校验测试就位（`digraph-consistency.test.mjs` 通过）
⑦ skill-authoring.md 英文主源 + zh-CN 镜像就位
⑧ `docs/research/` 目录不存在
⑨ `docs/maintainers/` + `docs/gate-install.md` 过时引用归零
