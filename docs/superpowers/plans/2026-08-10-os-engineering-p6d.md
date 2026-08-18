# os-engineering P6d Implementation Plan：文档英文化（翻译 phase）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 13 个 SKILL.md 中文→英文 + `SKILL.zh-CN.md` companion files；6 个 engineering docs 英文化 + `*.zh-CN.md` companions；旧 docs/superpowers 清理。

**Architecture:** 按文件族批处理（os-* 9 files → cli-* 4 files → docs 6 files → cleanup）。每个 translation task：中文 source 翻译为英文 SKILL.md + 保存原始中文为 SKILL.zh-CN.md → emit → validate。Companion file 模式（零结构性改动）。

**Tech Stack:** Markdown（翻译）+ emit（`pnpm run emit` 再生成 `.agents/skills/`）+ validate。

## Global Constraints

- Conventional commits、无 attribution；禁 git worktree。
- `pnpm run validate` 每任务后 ALL PASS。
- **统一 convention**：`<name>.zh-CN.md` 同目录 companion 模式（无 `docs/zh-CN/` 平行目录）。
- 翻译不改规则语义（只换语言）；术语保留英文（harness/gate/emit/plugin/skill/mode/task/brief 等）。
- plugin.json `"skills"` 仍为 `"./skills/"`（directory form 未改）。
- emit 不改（只触发 re-emit）。

---

## File Structure

| 文件 | 责任 | Task |
|---|---|---|
| `packages/engineering/skills/os-*/SKILL.md`（×9）| 翻译中文→英文 | T0 |
| `packages/engineering/skills/os-*/SKILL.zh-CN.md`（×9）| 保存原始中文 | T0 |
| `packages/engineering/skills/cli-*/SKILL.md`（×4）| 翻译中文→英文 | T1 |
| `packages/engineering/skills/cli-*/SKILL.zh-CN.md`（×4）| 保存原始中文 | T1 |
| `packages/engineering/docs/*.md`（×6）| 翻译中文→英文 | T2 |
| `packages/engineering/docs/*.zh-CN.md`（×6）| 保存原始中文 | T2 |
| `docs/superpowers/specs/*.md`（非 os-engineering）| 删除旧 spec | T3 |
| `docs/superpowers/plans/*.md`（非 os-engineering）| 删除旧 plan | T3 |
| `docs/superpowers/tickets/*.md`（非 os-engineering）| 删除旧 ticket | T3 |

---

### Task 0: os-* family（9 SKILL.md 英文化 + companion files）

**Files:**
- Modify: `packages/engineering/skills/os-brainstorming/SKILL.md`（73 lines）
- Modify: `packages/engineering/skills/os-executing-plans/SKILL.md`（79 lines）
- Modify: `packages/engineering/skills/os-writing-plans/SKILL.md`（37 lines）
- Modify: `packages/engineering/skills/os-report-issue/SKILL.md`（174 lines）
- Modify: `packages/engineering/skills/os-finishing/SKILL.md`（31 lines）
- Modify: `packages/engineering/skills/os-code-review/SKILL.md`（30 lines）
- Modify: `packages/engineering/skills/os-verification/SKILL.md`（26 lines）
- Modify: `packages/engineering/skills/os-debugging/SKILL.md`（26 lines）
- Modify: `packages/engineering/skills/os-init/SKILL.md`（9 lines）
- Create（×9）: `packages/engineering/skills/os-*/SKILL.zh-CN.md`（原始中文保存）
- Modify（emit）: `packages/engineering/.agents/skills/engineering/os-*/SKILL.md`（emit 再生成）

**Interfaces:**
- Consumes: 无
- Produces: 13 个英文 SKILL.md + 9 个中文 SKILL.zh-CN.md — T2/T3 引用同一 convention

- [ ] **Step 1: 翻译 os-brainstorming（最大 73 行中的核心 rule 文件）**

翻译 `packages/engineering/skills/os-brainstorming/SKILL.md` 中文→英文：
- frontmatter 保持英文（name/description 已英文）
- `## Rules` 下所有 `### Rule:` heading → 英文（"Read Upstream" / "Read Sub-Skills" / "Research Delegation" / "Overall-Phase" / "Spec Review via CLI" / "Write Design"）
- Rule body 中文→英文（保持规则结构：`### Rule: <Name>` heading + 正文 + 代码块不变）
- `## Red Flags` → 英文
- 术语保留英文（harness/gate/emit/plugin/skill/mode/task/brief/grilling/cdd-exec 等）
- 保存原始中文到 `packages/engineering/skills/os-brainstorming/SKILL.zh-CN.md`

- [ ] **Step 2: 翻译 os-executing-plans（79 行，11 rules）**

同 T0 Step 1 流程。最大文件之一（11 条规则）。注意：
- Rule 名称保持英文不变（"Mode Selection" / "Task Complexity" / "Fix Loop" 等）
- 中文说明文字→英文
- 代码示例保持不变（仅注释翻译）

- [ ] **Step 3: 翻译 os-writing-plans / os-report-issue / os-finishing / os-code-review / os-verification / os-debugging / os-init（7 files）**

同 T0 Step 1 流程，批量翻译。小文件（9-37 lines），可一次处理多文件。

- [ ] **Step 4: emit 再生成 + 验证**

```bash
pnpm run emit && pnpm run validate
```

Expected: `.agents/skills/engineering/os-*/SKILL.md` 英文版本；validate ALL PASS。

- [ ] **Step 5: 提交**

```bash
git add packages/engineering/skills/os-*/
git commit -m "i18n: translate os-* SKILL.md to English + add zh-CN companion files"
```

---

### Task 1: cli-* family（4 SKILL.md 英文化 + companion files）

**Files:**
- Modify（×4）: `packages/engineering/skills/cli-*/SKILL.md`
- Create（×4）: `packages/engineering/skills/cli-*/SKILL.zh-CN.md`
- Modify（emit）: `packages/engineering/.agents/skills/engineering/cli-*/SKILL.md`

**Interfaces:**
- Consumes: 无（与 T0 并行可独立）
- Produces: 4 英文 SKILL.md + 4 中文 SKILL.zh-CN.md

- [ ] **Step 1-4: 同 T0 流程**

翻译 4 个 cli-* SKILL.md（cli-driven-development 43 行 / cli-select 35 行 / cli-code-review 35 行 / cli-task 31 行）→ 保存中文 companion → emit → validate。

- [ ] **Step 5: 提交**

```bash
git add packages/engineering/skills/cli-*/
git commit -m "i18n: translate cli-* SKILL.md to English + add zh-CN companion files"
```

---

### Task 2: engineering docs 英文化（6 files + companion files）

**Files:**
- Modify（×6）: `packages/engineering/docs/cdd-reference.md`（152 lines）`handoff-schema.md`（120）`overall-phase-spec-template.md`（118）`controller-handoff.md`（42）`review-dispatch.md`（29）`subagent-lifecycle.md`（21）
- Create（×6）: `packages/engineering/docs/*.zh-CN.md`（原始中文保存）

**Interfaces:**
- Consumes: 无
- Produces: 6 英文 docs + 6 中文 companion files

- [ ] **Step 1-4: 同 T0 流程**

翻译 6 个 engineering docs 中文→英文 → 保存中文 companion → validate。

注意：`cdd-reference.md`（152 lines）是最大文件。翻译时保持技术术语和代码块不变。

- [ ] **Step 5: 提交**

```bash
git add packages/engineering/docs/
git commit -m "i18n: translate engineering docs to English + add zh-CN companion files"
```

---

### Task 3: 旧 docs/superpowers 清理

**Files:**
- Delete: `docs/superpowers/specs/` 中非 `os-engineering` 前缀的 22 个旧 spec 文件
- Delete: `docs/superpowers/plans/` 中非 `os-engineering` 前缀的 13 个旧 plan 文件
- Delete: `docs/superpowers/tickets/` 中非 `os-engineering` 前缀的旧 ticket 文件

**Interfaces:**
- Consumes: 无（独立于 T0-T2）
- Produces: 旧文件已删除，保留 os-engineering 全部文档

- [ ] **Step 1: 列出将删除的文件**

```bash
echo "=== 旧 specs ===" && ls docs/superpowers/specs/ | grep -v os-engineering
echo "=== 旧 plans ===" && ls docs/superpowers/plans/ | grep -v os-engineering
echo "=== 旧 tickets ===" && ls docs/superpowers/tickets/ | grep -v os-engineering
```

- [ ] **Step 2: 删除旧文件**

```bash
# 旧 specs（22 files）
ls docs/superpowers/specs/ | grep -v os-engineering | xargs -I{} rm docs/superpowers/specs/{}
# 旧 plans（13 files）
ls docs/superpowers/plans/ | grep -v os-engineering | xargs -I{} rm docs/superpowers/plans/{}
# 旧 tickets
ls docs/superpowers/tickets/ | grep -v os-engineering | xargs -I{} rm docs/superpowers/tickets/{}
```

- [ ] **Step 3: 验证保留文件完整**

```bash
echo "=== 保留 specs ===" && ls docs/superpowers/specs/
echo "=== 保留 plans ===" && ls docs/superpowers/plans/
echo "=== 保留 tickets ===" && ls docs/superpowers/tickets/
pnpm run validate
```

- [ ] **Step 4: 提交**

```bash
git add docs/superpowers/
git commit -m "chore: remove pre-os-engineering docs/superpowers specs/plans/tickets"
```
