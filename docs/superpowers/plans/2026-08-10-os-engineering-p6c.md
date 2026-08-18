# os-engineering P6c Implementation Plan：research 集成

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 os-brainstorming 流程中集成 mattpocock-skills:research（explore-context 阶段识别 → 用户确认 → 后台 research → findings → grilling）。

**Architecture:** 在 os-brainstorming SKILL.md 新增 `Rule: Research Delegation`（在 `Read Sub-Skills` 之后、`Overall-Phase` 之前），编码 explore-context → user confirm → background research → wait → grilling 的完整流程。

**Tech Stack:** Markdown（SKILL.md 规则）+ emit（`pnpm run emit` 重新生成 `.agents/skills/`）。

## Global Constraints

- Conventional commits、无 attribution；禁 git worktree。
- `pnpm run validate` 每任务后 ALL PASS。
- Rule 内容与 spec §2.1 一致（触发条件 + 拒绝分支 + 并行 + fail-open）。
- `pnpm run emit` 再生成 `.agents/skills/engineering/os-brainstorming/SKILL.md`（不 drift）。

---

## File Structure

| 文件 | 责任 | Task |
|---|---|---|
| `packages/engineering/skills/os-brainstorming/SKILL.md` | 新增 Rule: Research Delegation | T1 |
| `packages/engineering/.agents/skills/engineering/os-brainstorming/SKILL.md` | emit 再生成 | T1 |
| `CLAUDE.md` / docs | P6c 交付说明 | T2 |

---

### Task 1: Rule: Research Delegation

**Files:**
- Modify: `packages/engineering/skills/os-brainstorming/SKILL.md`
- Modify（emit 产物）: `packages/engineering/.agents/skills/engineering/os-brainstorming/SKILL.md`

**Interfaces:**
- Consumes: 无
- Produces: os-brainstorming Rule: Research Delegation — T2 文档引用

- [ ] **Step 1: Write the failing test**

验证 os-brainstorming SKILL.md 包含 `Rule: Research Delegation`：
```bash
grep -q "Rule: Research Delegation" packages/engineering/skills/os-brainstorming/SKILL.md && echo "PASS" || echo "FAIL"
```
当前应 FAIL（rule 不存在）。

- [ ] **Step 2: Run test to verify it fails**

```bash
node --input-type=module -e '
import { readFileSync } from "node:fs";
const md = readFileSync("packages/engineering/skills/os-brainstorming/SKILL.md","utf8");
const has = md.includes("Rule: Research Delegation");
console.log(has ? "PASS" : "FAIL — Rule: Research Delegation not found");
process.exit(has ? 0 : 1);
'
```

- [ ] **Step 3: Add Rule: Research Delegation**

在 `packages/engineering/skills/os-brainstorming/SKILL.md` 的 `### Rule: Read Sub-Skills` 之后、`### Rule: Overall-Phase` 之前插入：

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

同时更新 `## Red Flags` 增加：
```markdown
- 「research 自动触发不问用户」→ 用户确认是硬门
- 「research 阻塞 explore-context」→ 后台并行
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node --input-type=module -e '
import { readFileSync } from "node:fs";
const md = readFileSync("packages/engineering/skills/os-brainstorming/SKILL.md","utf8");
const has = md.includes("Rule: Research Delegation");
const hasTrigger = md.includes("触发条件");
const hasReject = md.includes("用户拒绝");
const hasFailOpen = md.includes("fail-open");
console.log(has && hasTrigger && hasReject && hasFailOpen ? "PASS" : "FAIL");
if (!has || !hasTrigger || !hasReject || !hasFailOpen) {
  if (!has) console.log("Missing: Rule: Research Delegation");
  if (!hasTrigger) console.log("Missing: 触发条件");
  if (!hasReject) console.log("Missing: 用户拒绝");
  if (!hasFailOpen) console.log("Missing: fail-open");
}
'
```

- [ ] **Step 5: emit 再生成 + validate**

```bash
pnpm run emit && pnpm run validate
```

Expected: `.agents/skills/engineering/os-brainstorming/SKILL.md` 重新生成（不 drift）；validate ALL PASS。

- [ ] **Step 6: Commit**

```bash
git add packages/engineering/skills/os-brainstorming/SKILL.md packages/engineering/.agents/skills/engineering/os-brainstorming/SKILL.md
git commit -m "feat: os-brainstorming Rule: Research Delegation (mattpocock-skills:research integration)"
```

---

### Task 2: 文档 + 终检

**Files:**
- Modify: `CLAUDE.md`（os-brainstorming research 集成说明）

**Interfaces:**
- Consumes: T1
- Produces: 文档一致 + validate ALL PASS —— P6c 验收

- [ ] **Step 1: CLAUDE.md 更新**

在 os-brainstorming 模式发射部分或相关说明中补充：explore-context 阶段支持 research delegation（用户确认 → mattpocock-skills:research → findings → grilling）。

- [ ] **Step 2: 终检**

```bash
pnpm run validate
```

对照 spec §2.6 验收逐条勾验。

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: P6c — research delegation in os-brainstorming"
```
