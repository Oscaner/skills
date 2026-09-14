# Pγ Design Spec — Anti-patterns + Brainstorming 重写

- **Version**: v1.0 · 2026-08-31
- **Status**: Approved
- **Author**: [human] · Claude Opus 4.8 (osuperpowers:brainstorming dogfood session)
- **Parent program**: [Post-Dogfood Bugfixes + Anti-Pattern Elimination — Overall Spec](./2026-08-31-post-dogfood-bugfixes-overall.md) v1.10
- **Depends on**: Pβ (skill-fixes) — Design spec = Done ✓

---

## Section 0: Incremental warning

> Pγ increment only. Cross-phase conventions in [overall](./2026-08-31-post-dogfood-bugfixes-overall.md); overall wins on conflict.

---

## Section 1: Constraints pointer

- vendored 子模块不可改（overall Constraints）
- 仓库语言政策：SKILL.md / docs 英文主源 + zh-CN 镜像（overall Constraints）
- Skill-authoring Anti-patterns 规范同步更新（overall Constraints）

---

## Section 2: Design body

### Issues in scope

| Issue | 问题本质 | 修改目标 |
|---|---|---|
| [#205](https://github.com/Oscaner/skills/issues/205) | `write-spec` 在 `new-program` mode 下写了 phase-level 实现细节 | brainstorming SKILL.md `write-spec` 节点 |
| [#206](https://github.com/Oscaner/skills/issues/206) | `spec-review` 3-pass 审查被手动 self-review 替代 | brainstorming SKILL.md `spec-review` 节点 |
| [#204](https://github.com/Oscaner/skills/issues/204) | `grilling` 节点 Do 字段未展开关键约束，orchestrator 违反 one-at-a-time | brainstorming SKILL.md `grilling` 节点 |
| (skill-authoring) | skill-authoring.md 缺反模式规范 | `docs/maintainers/skill-authoring.md` §10 |
| (brainstorming) | brainstorming SKILL.md 整体反模式清理（mode-unaware branching / bare compliance / review substitution） | brainstorming SKILL.md digraph + 多节点 |

### Root cause

4 个 GitHub issue 全部指向同一个结构性缺陷：brainstorming SKILL.md **没有在 `new-program` vs `phase-within-program` 两种 mode 之间做行为分叉**。所有节点（grilling、write-spec、spec-review）都默认同一个行为，但两种 mode 的目标完全不同。

### Architecture — mode-aware branching

在 brainstorming digraph 中显式引入 mode 维度。mode marker 在 flow 中全程传递。

#### Mode 行为对照

| Mode | grilling 目标 | write-spec 粒度 | spec-review |
|---|---|---|---|
| `new-program` | Scope-level：每个 phase 的范围/依赖/验收 | Charter-only（scope decomposition + issue inventory + phase inventory + dependency graph） | 3-pass cdd-review CLI |
| `phase-within-program` | Implementation：根因分析/修复方向/技术方案 | Phase-level detailed design（含 grilling 产出） | 3-pass cdd-review CLI |

#### Digraph 变更

**新增节点**：`propose-phase-approaches`（scope-level grilling 的产出确认）、`charter-approves?`（charter 审批门）。

**改造节点**：`grilling` 从普通操作节点升级为 decision node（菱形），两条 exit 边按 mode 分叉。

**重构后 digraph**：

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

### Node definition changes

#### `grilling` (改造为 decision node)

**Do**: 根据 `read-program` mode 分叉 grilling 行为。上游 grilling SKILL.md baseline 不变（Read, not Skill-invoke — I1）。

- **`phase-within-program`** → implementation grilling：根因分析 → 影响边界 → 修复方向 → 技术方案。一个 issue 一次 grilling session。
- **`new-program`** → scope-level grilling：每个候选 phase 的范围定义、依赖关系、验收条件、issue 归属。所有 phase 在一个 session 内完成。

**共同纪律**（上游 baseline + self-check）：
- 一次只问一个问题，等回答后再继续
- 每个问题附推荐答案
- Before each question, self-check: ① 一个问题？② 有推荐答案？③ 根因已充分（仅 phase-within-program）？→ 任一 fails → re-do

**Read**: Grilling SKILL.md framework（loaded in `read-sub-skills`）+ mode marker（from `read-program`）
**Exit**: `phase-within-program` → `propose-approaches`; `new-program` → `propose-phase-approaches`
**Fail**: Self-check 连续 2 次失败 → BLOCKED（grilling discipline broken）; mid-grill 检测到 phase split → 回退 `claim-phase`

#### `propose-phase-approaches` (新节点)

**Do**: 基于 scope-level grilling 产出，列出每个 phase 的 scope/dependency/acceptance。用户确认 phase 分解是否合理。
**Read**: scope-level grilling decisions + parent overall（如有）
**Exit**: phase 分解确认 → `charter-approves?`
**Fail**: —

#### `charter-approves?` (新节点)

**Do**: 用户审批 charter 分解。
**Exit**: Approved → `write-spec`; revise → `propose-phase-approaches`
**Fail**: —

#### `write-spec` (mode-aware)

**Do**: 根据 mode 决定写入粒度：
- **`new-program`** → charter-only：scope decomposition + issue inventory + phase inventory + dependency graph + acceptance criteria。**不含 phase-level 实现细节**。使用 overall-spec-template.md（含 "Charter only — no implementation detail" GATE）
- **`phase-within-program`** → phase-level detailed design（含 grilling 产出的根因/方案/技术决策）。使用 phase-spec-template.md

**Read**: mode marker + all design decisions + template（路径：`packages/osuperpowers/skills/brainstorming/docs/`）
**Exit**: File written → `spec-review`
**Fail**: Template missing/unreadable → BLOCKED (missing template)

#### `spec-review` (强制 CLI)

**Do**: Execute 3-pass spec review（completeness / consistency&scope / clarity&YAGNI），每个 pass **必须** dispatch `node {pluginRoot}/bin/engine/cdd-review.mjs --harness <name> --template spec-review --param PASS=<pass-type> --param DOC=<path>`。**不可用 self-review、手动检查、或其他替代方式代替 cdd-review CLI 调用**。Follow D1/D2/D3 from `_docs/docs-review.md`。Review Stopping（I5）不变。

**Read**: Spec document + `_docs/docs-review.md`
**Exit**: blocker=0 → `user-ok?`; Pass 1 clean → `user-ok?`（pass1 clean 经 `user-ok?` → `user-confirm-commit?`，图中 K→L→Q）
**Fail**: Re-run review after blocker=0 → violates I5

### New Invariant

| # | Invariant |
|---|---|
| I8 | **Mode-aware flow** — `grilling` 节点根据 `read-program` mode 分叉行为：`new-program` 走 scope-level grilling → `propose-phase-approaches`；`phase-within-program` 走 implementation grilling → `propose-approaches`。`write-spec` 节点根据 mode 决定写入粒度：`new-program` → charter-only（不含实现细节）；`phase-within-program` → phase-level 详细设计。Mode marker 在 flow 中全程传递。 |

### New Failure Modes

| failure | behavior | reason |
|---|---|---|
| Grilling self-check 连续 2 次失败 | BLOCKED (grilling discipline broken) | Self-check 机制失效，需要用户介入 |
| spec-review 未调用 cdd-review CLI | Violates spec-review Do — 必须重新执行 | Review substitution 反模式 |
| write-spec template missing/unreadable | BLOCKED (missing template) | 无法确定写入格式 |

### skill-authoring §10 Anti-patterns

在 `docs/maintainers/skill-authoring.md` 新增 §10，通用反模式规范，按 anatomy 分类：

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

zh-CN mirror (`docs/maintainers/skill-authoring.zh-CN.md`) 同步更新。

---

## Section 3: Deviations from overall

| Overall assumption | Phase decision | Overall updated? |
|---|---|---|
| (none) | (none) | — |

---

## Section 4: Notes for downstream

- Pδ 的 CDD 重构会参考 Pγ 的 mode-aware branching 模式（I8）来设计 CDD skill 的 mode 分叉
- brainstorming SKILL.md 重构后，graph node count 从 14 增至 16（+2: propose-phase-approaches, charter-approves?）

---

## Section 5: Review

Pγ spec review 遵循 `_docs/docs-review.md` Review Stopping 规则（I5）。
