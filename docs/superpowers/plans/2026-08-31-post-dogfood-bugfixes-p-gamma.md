# Pγ Implementation Plan — Anti-patterns + Brainstorming 重写

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure brainstorming SKILL.md with mode-aware branching (#204/#205/#206) and add skill-authoring §10 Anti-patterns.

**Architecture:** Mode-aware digraph restructuring — `grilling` becomes a decision node branching on `new-program` vs `phase-within-program`. Two new nodes (`propose-phase-approaches`, `charter-approves?`) handle the new-program charter flow. `write-spec` and `spec-review` get mode-aware behavior. 18 operational/decision nodes total (up from 14). skill-authoring §10 adds a通用 anti-pattern reference.

**Tech Stack:** Markdown (SKILL.md, skill-authoring.md), Mermaid digraphs

## Global Constraints

- vendored 子模块不可改
- 仓库语言政策：SKILL.md / docs 英文主源 + zh-CN 镜像
- Skill-authoring Anti-patterns 规范同步更新
- `.agents/` is derived — never edit directly; run `pnpm run emit` after any source change

---

### Task 1: brainstorming SKILL.md digraph restructure

**Files:**
- Modify: `packages/osuperpowers/skills/brainstorming/SKILL.md` (digraph + 2 new node definitions)

**Interfaces:**
- Consumes: current brainstorming SKILL.md (14-node graph)
- Produces: 16-node graph with mode-aware branching; 2 new node definitions (propose-phase-approaches, charter-approves?)

- [ ] **Step 1: Replace mermaid digraph**

Replace the entire `## Flow Digraph` mermaid block in `packages/osuperpowers/skills/brainstorming/SKILL.md` with:

```mermaid
flowchart TD
  A[read-upstream] -->|loaded| B[read-sub-skills]
  A -->|missing| Z1((BLOCKED: install superpowers))
  B -->|loaded| C{read-program}
  B -->|missing| Z2((BLOCKED: install mattpocock-skills))
  C -->|mode resolved| D[explore-context]
  C -->|unparseable| Z4((BLOCKED: overall-parse-failed))
  D --> E{claim-phase}
  E -->|phase in overall Phase inventory| F{grilling-mode?}
  E -->|phase NOT in inventory (phase-within-program)| S[sync-overall]
  E -->|new-program mode| F
  S -->|four tables consistent| D
  S -->|inconsistent| Z3((BLOCKED: overall-sync-failed))
  E -->|inventory unparseable| Z3
  F -->|mid-grill split / new scope| E
  F -->|phase-within-program| G[propose-approaches]
  F -->|new-program| G2[propose-phase-approaches]
  G --> H[present-design]
  H -->|revise section| H
  H --> I{user-approves?}
  I -->|revise| H
  I -->|yes| J[write-spec]
  G2 --> H2{charter-approves?}
  H2 -->|revise| H2
  H2 -->|yes| J
  J --> K{spec-review}
  K -->|blocker found| K
  K -->|blocker=0| L{user-ok?}
  K -->|pass1 clean (D1 zero findings, skip D2/D3)| L
  L -->|fix selected (after blocker=0, no re-review per Review Stopping)| Q{user-confirm-commit?}
  L -->|approved| Q
  Q -->|confirmed| M[commit-spec]
  M --> N{overall-spec?}
  N -->|yes: next phase| O((HANDOFF: brainstorming))
  N -->|no: single spec| P((HANDOFF: writing-plans))
```

Key changes from current graph:
1. `F[grilling]` → `F{grilling-mode?}` (decision node, diamond shape)
2. New edge: `F -->|phase-within-program| G[propose-approaches]`
3. New edge: `F -->|new-program| G2[propose-phase-approaches]`
4. New node: `G2[propose-phase-approaches]` (scope-level grilling output)
5. New node: `H2{charter-approves?}` (charter approval gate)
6. New edges: `G2 --> H2 -->|yes| J` and `H2 -->|revise| H2`
7. `F -->|mid-grill split / new scope| E` edge retained unchanged (from current graph)
8. `J[write-spec]` → `J{spec-review}` (spec-review gets decision shape for consistency)
9. `L -->|approved| Q` (removed redundant `Q{user-confirm-commit?}` label duplication)

- [ ] **Step 2: Add propose-phase-approaches node definition**

Insert after the `propose-approaches` node definition (before `present-design`):

```markdown
### `propose-phase-approaches`

- **Do**: Based on scope-level grilling output, present each phase's scope, dependencies, and acceptance criteria. User confirms the phase decomposition is correct.
- **Read**: scope-level grilling decisions + parent overall (if exists)
- **Exit**: Phase decomposition confirmed → `charter-approves?`
- **Fail**: —
```

- [ ] **Step 3: Add charter-approves? node definition**

Insert after `propose-phase-approaches`:

```markdown
### `charter-approves?`

- **Do**: User approves the charter decomposition.
- **Exit**: Approved → `write-spec`; revise → `propose-phase-approaches`
- **Fail**: —
```

- [ ] **Step 4: Verify graph–prose consistency**

Verify every node ID in the graph has a corresponding prose section (skill-authoring §8 check 1). The graph contains 18 operational/decision node IDs that must map to prose: read-upstream, read-sub-skills, read-program, explore-context, claim-phase, sync-overall, grilling-mode?, propose-approaches, propose-phase-approaches, present-design, user-approves?, charter-approves?, write-spec, spec-review, user-ok?, commit-spec, user-confirm-commit?, overall-spec?.

- [ ] **Step 5: Commit**

```bash
git add packages/osuperpowers/skills/brainstorming/SKILL.md
git commit -m "refactor(brainstorming): restructure digraph with mode-aware branching"
```

---

### Task 2: grilling + write-spec + spec-review node definitions refactor

**Files:**
- Modify: `packages/osuperpowers/skills/brainstorming/SKILL.md` (3 node definitions)

**Interfaces:**
- Consumes: Task 1 digraph restructure (16-node graph with mode branching)
- Produces: 3 refactored node definitions with mode-aware behavior

- [ ] **Step 1: Refactor grilling node definition**

Replace the entire `### \`grilling\`` section in `packages/osuperpowers/skills/brainstorming/SKILL.md` with:

```markdown
### `grilling`

- **Do**: Branch grilling behavior based on `read-program` mode. Upstream grilling SKILL.md baseline unchanged (Read, not Skill-invoke — I1).

  - **`phase-within-program`** → implementation grilling: root-cause analysis → impact boundary → fix direction → technical approach. One issue per grilling session.
  - **`new-program`** → scope-level grilling: each candidate phase's scope definition, dependencies, acceptance criteria, issue ownership. All phases in one session.

  **Shared discipline** (upstream baseline + self-check):
  - One question at a time, wait for answer before continuing
  - Each question includes a recommended answer
  - Before each question, self-check: ① One question only? ② Recommended answer included? ③ Root cause explored (phase-within-program only)? → If any fails → re-do the question correctly.

- **Read**: Grilling SKILL.md framework (loaded in `read-sub-skills`) + mode marker (from `read-program`)
- **Exit**: `phase-within-program` → `propose-approaches`; `new-program` → `propose-phase-approaches`
- **Fail**: Self-check fails 2 consecutive times → BLOCKED (grilling discipline broken); mid-grill detects phase split / new scope → route back to `claim-phase`
```

- [ ] **Step 2: Refactor write-spec node definition**

Replace the entire `### \`write-spec\`` section with:

```markdown
### `write-spec`

- **Do**: Determine write granularity based on mode:
  - **`new-program`** → charter-only: scope decomposition + issue inventory + phase inventory + dependency graph + acceptance criteria. **No phase-level implementation details.** Use overall-spec-template.md (contains "Charter only — no implementation detail" GATE)
  - **`phase-within-program`** → phase-level detailed design (including grilling outputs: root cause / fix direction / technical decisions). Use phase-spec-template.md

- **Read**: mode marker + all design decisions + template (path: `packages/osuperpowers/skills/brainstorming/docs/`)
- **Exit**: File written → `spec-review`
- **Fail**: Template missing/unreadable → BLOCKED (missing template)
```

- [ ] **Step 3: Refactor spec-review node definition**

Replace the entire `### \`spec-review\`` section with:

```markdown
### `spec-review`

- **Do**: Execute 3-pass spec review (completeness / consistency&scope / clarity&YAGNI). Each pass **must** dispatch `node {pluginRoot}/bin/engine/cdd-review.mjs --harness <name> --template spec-review --param PASS=<pass-type> --param DOC=<path>`. **Self-review, manual checks, or any other substitute for cdd-review CLI invocation is forbidden.** Follow D1/D2/D3 from `_docs/docs-review.md`. Review Stopping (I5): ① run 3-pass → ② blocker found → fix → re-run only that pass → loop until blocker=0 → ③ all passes blocker=0 → present warn/nit to user → proceed. Pass 1 zero findings (D1) → skip subsequent passes → `user-ok?` (pass1 clean routes through user-ok? → user-confirm-commit?, graph K→L→Q). Only Pass 2 is delta-scoped; Pass 3 is always full-doc
- **Read**: Spec document + `_docs/docs-review.md`
- **Exit**: blocker=0 → `user-ok?` (present warn/nit); Pass 1 clean → `user-ok?`
- **Fail**: Re-run review after blocker=0 → violates I5 (Review Stopping). New cdd-review call for warn/nit → violates I5.
```

- [ ] **Step 4: Verify node–graph consistency**

Verify the 3 refactored nodes' (grilling, write-spec, spec-review) Exit fields match the graph edges from Task 1:
- grilling Exit: `phase-within-program` → `propose-approaches` ✓ (graph: F→G)
- grilling Exit: `new-program` → `propose-phase-approaches` ✓ (graph: F→G2)
- write-spec Exit: → `spec-review` ✓ (graph: J→K)
- spec-review Exit: blocker=0 → `user-ok?` ✓ (graph: K→L)

- [ ] **Step 5: Commit**

```bash
git add packages/osuperpowers/skills/brainstorming/SKILL.md
git commit -m "refactor(brainstorming): grilling/write-spec/spec-review mode-aware node definitions"
```

---

### Task 3: Add I8 invariant + new Failure Modes

**Files:**
- Modify: `packages/osuperpowers/skills/brainstorming/SKILL.md` (Invariants + Failure Modes sections)

**Interfaces:**
- Consumes: Task 1–2 digraph and node changes
- Produces: I8 invariant + 3 new Failure Modes entries

- [ ] **Step 1: Add I8 to Invariants table**

In `packages/osuperpowers/skills/brainstorming/SKILL.md`, append a new row after I7 in the `## Invariants` table:

```markdown
| I8 | **Mode-aware flow** — `grilling` node branches behavior based on `read-program` mode: `new-program` → scope-level grilling → `propose-phase-approaches`; `phase-within-program` → implementation grilling → `propose-approaches`. `write-spec` node determines write granularity based on mode: `new-program` → charter-only (no implementation details); `phase-within-program` → phase-level detailed design. Mode marker is carried throughout the flow. |
```

- [ ] **Step 2: Add new Failure Modes**

In `packages/osuperpowers/skills/brainstorming/SKILL.md`, append 3 new rows to the `## Failure Modes` table:

```markdown
| Grilling self-check fails 2 consecutive times | BLOCKED (grilling discipline broken) | Self-check mechanism failed, user intervention required |
| spec-review does not invoke cdd-review CLI | Violates spec-review Do — must re-execute | Review substitution anti-pattern |
| write-spec template missing/unreadable | BLOCKED (missing template) | Cannot determine write format |
```

- [ ] **Step 3: Verify invariant count**

The Invariants table should now have 8 rows (I1–I8). Verify no duplication between I8 and existing invariants (especially I5 Review Stopping and I6 Register-before-grill).

- [ ] **Step 4: Commit**

```bash
git add packages/osuperpowers/skills/brainstorming/SKILL.md
git commit -m "refactor(brainstorming): add I8 mode-aware flow invariant + 3 new Failure Modes"
```

---

### Task 4: skill-authoring §10 Anti-patterns

**Files:**
- Modify: `docs/maintainers/skill-authoring.md` (new §10)
- Modify: `docs/maintainers/skill-authoring.zh-CN.md` (zh-CN mirror)

**Interfaces:**
- Consumes: Pγ design spec §Anti-patterns (6 anti-patterns, 5 anatomy categories)
- Produces: §10 Anti-patterns section in both EN and zh-CN

- [ ] **Step 1: Add §10 to skill-authoring.md**

In `docs/maintainers/skill-authoring.md`, insert before the `## Change history` section:

```markdown
## 10. Anti-patterns (Node-anchored SKILL.md)

Anti-patterns organized by the anatomy element where they manifest.
When auditing a node, check only the patterns relevant to that element.

### Do field
| Anti-pattern | Symptom | Fix |
|---|---|---|
| Bare compliance | Do says "follow X" without expanding critical constraints | Extract key constraints as numbered self-checks in Do |
| Review substitution | Self-review or manual check replaces CLI dispatch | Do must state CLI invocation explicitly (tool + args) |
| Mode-unaware branching | One Do behavior covers multiple modes | Add mode-aware branching in Do |

### Exit field
| Anti-pattern | Symptom | Fix |
|---|---|---|
| Exit drift | Graph edges don't match Exit paths | Graph and Exit must enumerate identical edge labels |
| Implicit scope creep | New exit path added without Invariant update | New exit path with behavioral significance → new or updated Invariant |

### Fail field
| Anti-pattern | Symptom | Fix |
|---|---|---|
| Failure mode gap | Fail = "—" but real failure exists | Every node must have Fail for each possible error state |

### Invariants
| Anti-pattern | Symptom | Fix |
|---|---|---|
| Rule duplication | Same rule in Invariant + node Do + Fail | Single source: Invariant for cross-node, node Fail for node-local |

### Node decomposition
| Anti-pattern | Symptom | Fix |
|---|---|---|
| Insufficient granularity | One node handles multiple distinct responsibilities | Split into separate nodes with clear Exit handoff |
```

- [ ] **Step 2: Add §10 to skill-authoring.zh-CN.md**

In `docs/maintainers/skill-authoring.zh-CN.md`, insert before the `## Change history` section with Chinese translation:

```markdown
## 10. 反模式（Node-anchored SKILL.md）

按 anatomy 元素分类的反模式。审计节点时，仅检查与该元素相关的模式。

### Do 字段
| 反模式 | 症状 | 修复 |
|---|---|---|
| 裸合规（Bare compliance） | Do 仅写"follow X"但未展开关键约束 | 在 Do 中提取关键约束为编号 self-check |
| 审查替代（Review substitution） | self-review 或手动检查替代 CLI 派发 | Do 必须显式声明 CLI 调用（工具 + 参数） |
| Mode 不感知分支（Mode-unaware branching） | 一个 Do 行为覆盖多种 mode | 在 Do 中添加 mode-aware branching |

### Exit 字段
| 反模式 | 症状 | 修复 |
|---|---|---|
| Exit 漂移（Exit drift） | 图边与 Exit 路径不一致 | 图和 Exit 必须枚举相同的 edge labels |
| 隐式范围蔓延（Implicit scope creep） | 新增 exit 路径但未更新 Invariant | 新增有行为意义的 exit 路径 → 新增或更新 Invariant |

### Fail 字段
| 反模式 | 症状 | 修复 |
|---|---|---|
| 失败模式缺口（Failure mode gap） | Fail = "—" 但实际存在失败场景 | 每个节点必须为每种可能的错误状态配置 Fail |

### Invariants
| 反模式 | 症状 | 修复 |
|---|---|---|
| 规则重复（Rule duplication） | 同一规则在 Invariant + node Do + Fail 中重复 | 单一来源：Invariant 管跨节点规则，node Fail 管节点本地规则 |

### 节点分解
| 反模式 | 症状 | 修复 |
|---|---|---|
| 粒度不足（Insufficient granularity） | 单个节点承担多个不同职责 | 拆分为独立节点，明确 Exit handoff |
```

- [ ] **Step 3: Verify § numbering**

Verify §10 follows §9 in both files. Verify no gap in section numbering.

- [ ] **Step 4: Commit**

```bash
git add docs/maintainers/skill-authoring.md docs/maintainers/skill-authoring.zh-CN.md
git commit -m "docs(skill-authoring): add §10 Anti-patterns (Node-anchored SKILL.md)"
```

---

### Task 5: brainstorming SKILL.zh-CN.md mirror sync

**Files:**
- Modify: `packages/osuperpowers/skills/brainstorming/SKILL.zh-CN.md` (mirror of all Task 1–3 changes)

**Interfaces:**
- Consumes: Task 1–3 EN changes (digraph + node definitions + I8 + Failure Modes)
- Produces: zh-CN mirror fully synced with EN source

- [ ] **Step 1: Replace mermaid digraph in zh-CN**

Replace the `## Flow Digraph` mermaid block in `packages/osuperpowers/skills/brainstorming/SKILL.zh-CN.md` with the same graph as Task 1 Step 1 (mermaid is language-neutral).

- [ ] **Step 2: Add propose-phase-approaches + charter-approves? node definitions in zh-CN**

Insert Chinese-translated versions of the 2 new node definitions after `propose-approaches`:

```markdown
### `propose-phase-approaches`

- **Do**: 基于 scope-level grilling 产出，列出每个 phase 的 scope/dependency/acceptance。用户确认 phase 分解是否合理。
- **Read**: scope-level grilling decisions + parent overall（如有）
- **Exit**: phase 分解确认 → `charter-approves?`
- **Fail**: —

### `charter-approves?`

- **Do**: 用户审批 charter 分解。
- **Exit**: Approved → `write-spec`; revise → `propose-phase-approaches`
- **Fail**: —
```

- [ ] **Step 3: Replace grilling node definition in zh-CN**

Replace the `### \`grilling\`` section with Chinese-translated version matching Task 2 Step 1 (mode branching + self-check).

- [ ] **Step 4: Replace write-spec node definition in zh-CN**

Replace the `### \`write-spec\`` section with Chinese-translated version matching Task 2 Step 2 (mode-aware granularity + template Fail).

- [ ] **Step 5: Replace spec-review node definition in zh-CN**

Replace the `### \`spec-review\`` section with Chinese-translated version matching Task 2 Step 3 (forced CLI invocation).

- [ ] **Step 6: Add I8 to Invariants table in zh-CN**

Append I8 row (Chinese translation) after I7.

- [ ] **Step 7: Add new Failure Modes in zh-CN**

Append 3 new rows (Chinese translation) to Failure Modes table.

- [ ] **Step 8: Verify mirror completeness**

Verify zh-CN has all 18 operational/decision node definitions, 8 invariants, and all failure modes matching EN source.

- [ ] **Step 9: Commit**

```bash
git add packages/osuperpowers/skills/brainstorming/SKILL.zh-CN.md
git commit -m "refactor(brainstorming): sync zh-CN mirror with mode-aware restructure"
```

---

### Task 6: validate + emit

**Files:**
- Derived: `.agents/` (regenerated by emit)

**Interfaces:**
- Consumes: Tasks 1–5 all source changes
- Produces: Fresh emit output + passing validation

- [ ] **Step 1: Run emit**

```bash
pnpm run emit
```

Verify exit 0. Verify `.agents/skills/osuperpowers/brainstorming/SKILL.md` reflects the new 18-node graph.

- [ ] **Step 2: Run validation**

```bash
pnpm run validate
```

Verify all 12 validation blocks pass (emit freshness, plugin.json, skill dirs, hooks, overrides, rule-reference, engine tests, version sync).

- [ ] **Step 3: Verify emit drift check**

```bash
pnpm run emit:check
```

Verify exit 0 (no drift).

- [ ] **Step 4: Commit**

```bash
git add .agents/
git commit -m "chore: regenerate .agents/ after Pγ brainstorming restructure"
```

---

### Task 7: changeset

**Files:**
- Create: `.changeset/p-gamma-brainstorming-restructure.md`

**Interfaces:**
- Consumes: Tasks 1–6 all changes
- Produces: Changeset file for versioning

- [ ] **Step 1: Create changeset**

Create `.changeset/p-gamma-brainstorming-restructure.md`:

```markdown
---
"@oscaner-skills/osuperpowers": patch
---

refactor(brainstorming): mode-aware digraph restructure — grilling decision node, propose-phase-approaches, charter-approves?, I8 invariant
docs(skill-authoring): add §10 Anti-patterns (Node-anchored SKILL.md)
```

- [ ] **Step 2: Commit**

```bash
git add .changeset/p-gamma-brainstorming-restructure.md
git commit -m "chore: add changeset for Pγ skill restructure"
```
