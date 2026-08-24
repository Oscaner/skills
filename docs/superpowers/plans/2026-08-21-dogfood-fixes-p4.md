# Dogfood 修复程序 P4 — 模板与流程更新 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use osuperpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 dogfood 程序 P1–P3 沉淀的 5 项实践固化为两份正典模板（overall / phase），强化 brainstorming 触发约束，并把 phase 中变更回馈 Overall 的纪律写入流程。

**Architecture:** 删除旧单文档 `docs/overall-phase-spec-template.md`，在与 `brainstorming/SKILL.md` 同级目录新建两份纯英文模板（`overall-spec-template.md` + `phase-spec-template.md`）及其中文镜像；改写 `SKILL.md` Rule: Overall-Phase 指向同目录模板并加浓缩五检查点；最后逐行回馈 overall spec 的 3 处 P4 引用。

**Tech Stack:** Markdown 文档 + `pnpm run emit` / `emit:check` / `validate` 工具链；无引擎代码改动。

## Global Constraints

- **源文件纯英文（Strategy A）**：所有英文源文件（模板 `.md`、SKILL.md）纯英文；仅 `*.zh-CN.md` 是中文镜像，可在镜像呈现中文图例符号 `──建议先于──▶`。英文源文件内不得出现中文符号。
- **不改动引擎**：不动 `runner.mjs` / `cdd-review.mjs`；不改动其他 `docs/` 跨切面文档（review-dispatch / subagent-lifecycle / docs-review）；不碰 `vendors/` 子模块。
- **每相独立 changeset**：P4 完成后建独立 changeset。
- **路径命名约定**：overall `specs/YYYY-MM-DD-<feature>-overall.md`、phase spec `specs/YYYY-MM-DD-<feature>-<phase-id>-design.md`、plan `plans/YYYY-MM-DD-<feature>-<phase-id>.md`、ticket `tickets/YYYY-MM-DD-<feature>-<phase-id>-tickets.md`（`<phase-id>` 小写，如 `p1`/`p2a`）。
- **依赖图图例（源文件英文）**：`->` = hard block；`-> (soft)` = suggestion（非硬阻塞）。中文图例 `──建议先于──▶` 仅出现在 zh-CN 镜像。
- **phase→Overall 回馈（强制）**：phase 进行中（含 dev 阶段）出现的新需求 / 新 issue / 新约束，必须即时回馈 Overall（版本 bump + 变更历史 + 受影响 phase 验收/依赖同步），未同步不得推进该变更的实施。

---

### Task 1: 新建 `overall-spec-template.md`（英文源）

**Files:**
- Create: `packages/osuperpowers/skills/brainstorming/overall-spec-template.md`

**Interfaces:**
- Consumes: spec Section 4 的节结构与五项实践落点
- Produces: 程序级 spec 正典模板；被 `brainstorming/SKILL.md` Rule: Overall-Phase 引用；被 `phase-spec-template.md` 反向链接

- [ ] **Step 1: 写入 overall-spec-template.md 完整内容**

写入以下纯英文 Markdown（语义标题、不编号；图例用 `->` / `-> (soft)`）：

````markdown
# Overall Spec Template

**Document structure only** — what an overall (program-level) spec contains. Per-phase increment lives in [phase-spec-template.md](./phase-spec-template.md). Read both before drafting a multi-phase program.

---

## Language

Write in the user's language (headings, labels, status, blockquotes). Do not default to any fixed locale. Keep phase IDs, tags, SHAs, paths locale-neutral.

---

## Header

```
- **Version**: vX.Y · YYYY-MM-DD
- **Status**: Draft | Approved | In progress | Complete
- **Author**: [human] · [harness + model at writing time]
- **Constraints**: [project-level, one per line]
```

Minor version bump: decomposition, scope shift, phase complete. Major: program goal/constraint rewrite.

---

## Document scope

Charter only — no implementation detail.
- **Overall approval is not equivalent to any phase started** (GATE).
- Deviations update here first, then sync to overall.

---

## File paths

One program date + feature slug under `docs/superpowers/`:

| Artifact | Path |
|---|---|
| Overall | `specs/YYYY-MM-DD-<feature>-overall.md` |
| Phase spec | `specs/YYYY-MM-DD-<feature>-<phase-id>-design.md` |
| Phase plan | `plans/YYYY-MM-DD-<feature>-<phase-id>.md` |
| Phase tickets | `tickets/YYYY-MM-DD-<feature>-<phase-id>-tickets.md` |

`<phase-id>` lowercase (`p1`, `p2a`, ...). Inventory columns link here once files exist.

---

## Program charter

Goal (1-3 sentences), non-goals, cross-cutting constraints. **Exclude:** acceptance criteria, API shapes, component design, tasks.

---

## Issue inventory

Every known issue / discovered requirement, mapped to the phase that resolves it:

| Phase | Issue (ref) | Title summary |
|---|---|---|
| P1 | [#NNN](url) | one-line summary |
| P2 | none (dogfood session YYYY-MM-DD discovery) | one-line summary |

---

## Phase inventory

| # | Phase | Scope | Design spec | Implementation plan | Acceptance criteria | Dependency |
|---|---|---|---|---|---|---|
| P1 | [one-paragraph scope] | [Pending]/link | [Pending]/link | [verifiable completion condition] | [hard block or soft suggestion, ref graph] |

- Scope column: decomposition context only.
- **Split:** replace parent row with Na, Nb before sub-phase work continues.
- Cells: Pending → link; on ship, completion marker on **plan** cell only.
- **Acceptance criteria**: verifiable condition for the phase (not "done when code exists").
- **Dependency**: cite the graph node + whether hard (`->`) or soft (`-> (soft)`).

---

## Dependency graph (ASCII)

```
P1 -> P2        (hard block: P2 needs P1 rules)
P1 ->(soft) P5  (soft suggestion: P5 easier after P1 ships)
```

Legend:
- `->` = hard block (dependent must not start until predecessor ships)
- `-> (soft)` = suggestion only (non-blocking ordering convenience)

Sync with inventory on add/split/reorder.

---

## Boundary rules

> Each phase: full brainstorm -> plan -> dev. Shipped before dependents start.
> Requirement changes arising during a phase (new needs, new issues, new constraints discovered in the dev stage) MUST feed back to this overall spec before implementation proceeds — version bump + change-history entry + sync affected phase acceptance/dependency. Do not implement a mid-phase change whose feedback is not yet synced.

---

## Maintenance

- Update links + change history per phase; no task lists.
- Master spec for cross-phase conventions; phase specs incremental.
- Strategy shifts and splits feed back **immediately** (sync to overall). A mid-phase requirement change is a strategy shift — apply the same immediacy (see Boundary rules).

---

## Change history

Append-only: completion, decomposition, scope shift, status transition, mid-phase feedback.
````

> **Intentional additive deviation:** the template above adds a `## Language` section (locale-neutral authoring rule) that is not enumerated in spec Section 4's section table. This is a deliberate enrichment, not a spec contradiction — Section 4 lists the *practice-bearing* sections; `Language` is a cross-cutting authoring rule already governed by the repo's Strategy A/B language architecture. No spec section conflicts.

- [ ] **Step 2: 校验源文件纯英文（零中文符号，macOS 安全写法）**

Run: `python3 -c "import sys; sys.exit(1 if any(any('一'<=c<='鿿' or '　'<=c<='〿' or '＀'<=c<='￯' for c in l) for l in open('packages/osuperpowers/skills/brainstorming/overall-spec-template.md',encoding='utf-8')) else 0)" && echo "CLEAN" || echo "HAS-CJK"`
Expected: 输出 `CLEAN`（图例用 `->` / `-> (soft)`，无 `──建议先于──▶`）

- [ ] **Step 3: 提交**

```bash
git add packages/osuperpowers/skills/brainstorming/overall-spec-template.md
git commit -m "docs: add overall-spec-template at skills/brainstorming (P4)"
```

---

### Task 2: 新建 `phase-spec-template.md`（英文源）

**Files:**
- Create: `packages/osuperpowers/skills/brainstorming/phase-spec-template.md`

**Interfaces:**
- Consumes: spec Section 5 的节结构与五项实践落点
- Produces: Phase 级 spec 正典模板；被 `overall-spec-template.md` 反向链接；被 `brainstorming/SKILL.md` Rule: Overall-Phase 引用

- [ ] **Step 1: 写入 phase-spec-template.md 完整内容**

写入以下纯英文 Markdown（保留编号 Section 0–5；含顶部 GATE blockquote 与 Section 2 Acceptance criteria 独立小节）：

````markdown
# Phase Spec Template

**Increment only** — what a single phase spec contains. Program-level charter lives in [overall-spec-template.md](./overall-spec-template.md).

> **GATE:** This phase spec is produced by a **full brainstorm -> plan -> dev cycle**. Jumping straight to implementation after overall approval alone is a violation of the overall flow.

---

## Header

```
- **Version**, **Status** (Draft | Approved | Plan pending | Shipped)
- **Author**, **Parent program** (link + version), **Depends on** (upstream + tags)
```

---

## Section 0: Incremental warning

> Phase N increment only. Cross-phase conventions in [overall](link); overall wins on conflict.

---

## Section 1: Constraints pointer

> Does not repeat overall conventions. Overall wins on conflict.

---

## Section 2: Design body

This phase's increment: approaches, architecture, components, data flow, errors, testing, **Acceptance criteria**.

### Acceptance criteria

Verifiable completion conditions (each independently testable). Example shape:
- `artifact X exists at path Y with property Z`
- `command C exits 0 with output matching regex R`
- `no stale references to removed path P remain`

---

## Section 3: Deviations from overall

| Overall assumption | Phase decision | Overall updated? |
|---|---|---|
| ... | ... | Yes — vX.Y · date |

Required when phase diverges on cross-phase matters. **Overall updated? must be Yes before review.**

---

## Section 4: Notes for downstream

Later-phase scope shifts. Decomposition changes -> update overall + re-run approval (GATE).

---

## Section 5: Review

Rule: Fresh-Subagent Review Passes must all pass before reaching user review and writing-plans.
````

- [ ] **Step 2: 校验源文件纯英文（零中文符号，macOS 安全写法）**

Run: `python3 -c "import sys; sys.exit(1 if any(any('一'<=c<='鿿' or '　'<=c<='〿' or '＀'<=c<='￯' for c in l) for l in open('packages/osuperpowers/skills/brainstorming/phase-spec-template.md',encoding='utf-8')) else 0)" && echo "CLEAN" || echo "HAS-CJK"`
Expected: 输出 `CLEAN`

- [ ] **Step 3: 提交**

```bash
git add packages/osuperpowers/skills/brainstorming/phase-spec-template.md
git commit -m "docs: add phase-spec-template at skills/brainstorming (P4)"
```

### Task 3: 新建两份模板的 zh-CN 镜像

**Files:**
- Create: `packages/osuperpowers/skills/brainstorming/overall-spec-template.zh-CN.md`
- Create: `packages/osuperpowers/skills/brainstorming/phase-spec-template.zh-CN.md`

**Interfaces:**
- Consumes: Task 1 / Task 2 的英文源文件（镜像须与英文源同一 task 同步，按 Strategy A 要求）
- Produces: 中文可读镜像；依赖图图例在镜像中可呈中文符号 `──建议先于──▶`

- [ ] **Step 1: 写入 overall-spec-template.zh-CN.md**

将 Task 1 的英文源逐节翻译为中文镜像。规则：
- 标题、标签、状态、blockquote 用中文
- phase ID、tag、SHA、路径保持 locale-neutral（不翻译）
- **依赖图图例**可呈中文符号：`->` = 硬阻塞；`──建议先于──▶` = 软建议（非硬阻塞）
- 顶部加一行镜像说明：`> 本文为英文源 `overall-spec-template.md` 的中文可读镜像；AI 始终读取英文源。`

- [ ] **Step 2: 写入 phase-spec-template.zh-CN.md**

将 Task 2 的英文源逐节翻译为中文镜像，同样遵循镜像规则（GATE blockquote、Section 0–5 编号保留、Acceptance criteria 独立小节保留；图例 `──建议先于──▶` 仅在此镜像呈现）。

- [ ] **Step 3: 校验两镜像与英文源段落对应（无整段英文正文残留）**

Run: `wc -l packages/osuperpowers/skills/brainstorming/overall-spec-template*.md packages/osuperpowers/skills/brainstorming/phase-spec-template*.md`
Expected: 每对 .md / .zh-CN.md 节标题数量一致（可目视核对）。

- [ ] **Step 4: 提交**

```bash
git add packages/osuperpowers/skills/brainstorming/overall-spec-template.zh-CN.md packages/osuperpowers/skills/brainstorming/phase-spec-template.zh-CN.md
git commit -m "docs: add zh-CN mirrors for P4 spec templates"
```

---

### Task 4: 改写 `brainstorming/SKILL.md` Rule: Overall-Phase + zh-CN 同步

**Files:**
- Modify: `packages/osuperpowers/skills/brainstorming/SKILL.md:77`（Rule: Overall-Phase）
- Modify: `packages/osuperpowers/skills/brainstorming/SKILL.zh-CN.md:77`

**Interfaces:**
- Consumes: Task 1 / Task 2 新建的同目录模板
- Produces: 触发时即时约束（浓缩五检查点 + GATE）；引用指向 `./overall-spec-template.md`（删除旧 `../docs/overall-phase-spec-template.md`）

- [ ] **Step 1: 替换 SKILL.md L77 整段（Before → After）**

Before（当前 L77）：
```
Large requirements (>=3 subsystems / multi-phase / overhaul) write an overall spec first, then phase out. Document structure: see [overall-phase-spec-template.md](../docs/overall-phase-spec-template.md). GATE: overall approval != phase started.
```

After：
```
Large / multi-phase requirements (>=3 subsystems / multi-phase / overhaul) write an overall spec first, then phase out. Document structure: [overall-spec-template.md](./overall-spec-template.md) (+ [phase-spec-template.md](./phase-spec-template.md) per phase). GATE: overall approval != any phase started.

When drafting, the overall spec MUST carry: (1) issue inventory per phase; (2) path naming `specs/YYYY-MM-DD-<feature>-overall.md`, `specs/YYYY-MM-DD-<feature>-<phase-id>-design.md`, `plans/...-<phase-id>.md`, `tickets/...-<phase-id>-tickets.md` (`<phase-id>` lowercase); (3) per-phase Acceptance criteria; (4) soft vs hard dependency distinction (graph legend: `->` = hard block, `-> (soft)` = suggestion — full legend in the template); (5) requirement changes arising during a phase MUST feed back to the overall spec before implementation. Each phase spec is produced by a full brainstorm->plan->dev cycle; jumping to implementation after overall approval alone is a violation.
```

- [ ] **Step 2: 同步 SKILL.zh-CN.md L77**

将英文 After 块译为中文镜像（图例可呈 `──建议先于──▶`）：
```
大型 / 多阶段需求（≥3 子系统 / 多阶段 / 大改）先写 overall spec，再 phase out。文档结构见 [overall-spec-template.md](./overall-spec-template.md)（每 phase 另见 [phase-spec-template.md](./phase-spec-template.md)）。GATE：overall 批准 ≠ 任何 phase 已开始。

起草时，overall spec 必须包含：(1) 按 phase 的 issue 清单；(2) 路径命名 `specs/YYYY-MM-DD-<feature>-overall.md`、`specs/YYYY-MM-DD-<feature>-<phase-id>-design.md`、`plans/...-<phase-id>.md`、`tickets/...-<phase-id>-tickets.md`（`<phase-id>` 小写）；(3) 每 phase 的 Acceptance criteria；(4) 软/硬依赖区分（图例：`->` = 硬阻塞，`──建议先于──▶` = 软建议——完整图例见模板）；(5) phase 进行中出现的范围/约束变更必须先回馈 overall spec 再实施。每个 phase spec 须经完整 brainstorm→plan→dev 循环生成；仅 overall 批准后直接实施属违规。
```

- [ ] **Step 3: 校验 SKILL.md 源文件零中文符号（仅限 Rule: Overall-Phase 段，macOS 安全写法）**

Run: `python3 -c "import sys; lines=open('packages/osuperpowers/skills/brainstorming/SKILL.md',encoding='utf-8').read().splitlines(); seg='\n'.join(lines[76:]) if len(lines)>77 else ''; sys.exit(1 if any('一'<=c<='鿿' for c in seg) else 0)" && echo "EN-CLEAN" || echo "HAS-CJK"`
Expected: 输出 `EN-CLEAN` —— 从 L77（0-index 76）起的 Rule: Overall-Phase 段不得含中文字符（英文源整体也确实无任何 CJK；旧版「Red Flags 含中文」推理不成立，故全文件零 CJK 即为通过）。

Run: `grep -c 'overall-phase-spec-template' packages/osuperpowers/skills/brainstorming/SKILL.md packages/osuperpowers/skills/brainstorming/SKILL.zh-CN.md`
Expected: 两文件均输出 `0`

- [ ] **Step 4: 提交**

```bash
git add packages/osuperpowers/skills/brainstorming/SKILL.md packages/osuperpowers/skills/brainstorming/SKILL.zh-CN.md
git commit -m "fix: point brainstorming Rule: Overall-Phase at co-located templates (P4)"
```

---

### Task 5: 删除旧模板 + 逐行回馈 overall spec

**Files:**
- Delete: `packages/osuperpowers/docs/overall-phase-spec-template.md`
- Delete: `packages/osuperpowers/docs/overall-phase-spec-template.zh-CN.md`
- Modify: `docs/superpowers/specs/2026-08-21-dogfood-fixes-overall.md`（3 处 P4 引用）

**Interfaces:**
- Consumes: Task 1–4 已落地的新模板与 SKILL.md 改写
- Produces: 旧路径零残留（live code 引用已随 Task 4 消除）；overall spec P4 引用与现状一致

- [ ] **Step 1: 删除旧模板两文件**

```bash
git rm packages/osuperpowers/docs/overall-phase-spec-template.md packages/osuperpowers/docs/overall-phase-spec-template.zh-CN.md
```

- [ ] **Step 2: 回馈 overall spec Section 1 两处 P4 issue 行（line 44）**

将两行中的 `overall-phase-spec-template.md` 改为：
`skills/brainstorming/overall-spec-template.md` + `phase-spec-template.md`（删除旧 docs/ 单文档、拆为两模板）
（保留其余 issue 摘要不变。）

- [ ] **Step 3: 回馈 overall spec Section 2 Phase 清单 P4 行（line 68）**

原：`| P4 | 模板与流程更新 | \`overall-phase-spec-template.md\` + \`brainstorming/SKILL.md\` Rule: Overall-Phase 更新，固化本次会话新增实践（...） | [Pending] ... | [Pending] ... |`

改为：`| P4 | 模板与流程更新 | \`skills/brainstorming/overall-spec-template.md\` + \`phase-spec-template.md\`（删除+新建两模板） + \`brainstorming/SKILL.md\` Rule: Overall-Phase 更新，固化本次会话新增实践（...） | [Approved](2026-08-21-dogfood-fixes-p4-design.md) | [Pending] \`plans/2026-08-21-dogfood-fixes-p4.md\` |`

（Design spec 列补链接；plan 列保持 Pending 待执行完成。）

- [ ] **Step 4: 回馈 overall spec Section 4 P4 验收标准块（line 109）**

原 P4 验收标准：`packages/osuperpowers/docs/overall-phase-spec-template.md` 新增 issue 清单表、路径命名约定、Phase acceptance criteria、软/硬依赖区分、**phase 中需求变更回馈 Overall** 五项实践；`packages/osuperpowers/skills/brainstorming/SKILL.md` 的 Rule: Overall-Phase 节新增指向该模板的引用行、内联五项检查点，并明确"每个 Phase 必须经完整 brainstorming 循环生成 Phase spec，Overall 批准后直接进入实施是违规"；`pnpm run validate` 全绿。

改为：`packages/osuperpowers/skills/brainstorming/overall-spec-template.md` 与 `phase-spec-template.md`（删除旧 `docs/overall-phase-spec-template.md` 单文档、拆为两模板，均含 zh-CN 镜像）固化五项实践——overall 含 issue 清单表、路径命名约定、per-phase acceptance criteria 列、软/硬依赖区分（含图例）、phase→Overall 回馈强制规则；phase 含 acceptance criteria 独立节 + 增量 GATE；`packages/osuperpowers/skills/brainstorming/SKILL.md` 的 Rule: Overall-Phase 节引用指向同目录模板、含浓缩五检查点 + GATE 声明；`emit:check` 无 drift、`validate` 全绿。

- [ ] **Step 5: 在 overall spec 头部 bump 版本 + Section 6 变更历史追加一条**

先改头部（line 3）：`**Version**: v1.9 · 2026-08-23` → `**Version**: v2.0 · 2026-08-23`（属跨相结构变更，minor bump）。

再在表格末尾追加：`| 2026-08-23 | v2.0：P4 实施——删除 `docs/overall-phase-spec-template.md` 单文档，拆为 `skills/brainstorming/overall-spec-template.md` + `phase-spec-template.md`（含 zh-CN 镜像）；Section 1/2/4 三处 P4 引用同步至新路径与删除+新建框架（phase 中变更回馈 Overall 实践，Q5） |`

- [ ] **Step 6: 校验 overall spec 旧路径零残留（含裸路径与 docs/ 前缀两种形式）**

Run: `grep -rn 'overall-phase-spec-template' docs/superpowers/specs/2026-08-21-dogfood-fixes-overall.md`
Expected: 无输出（同时命中 line 44 / 68 的裸 `overall-phase-spec-template.md` 与任何 `docs/` 前缀形式）

- [ ] **Step 7: 提交**

```bash
git add docs/superpowers/specs/2026-08-21-dogfood-fixes-overall.md packages/osuperpowers/docs/overall-phase-spec-template.md packages/osuperpowers/docs/overall-phase-spec-template.zh-CN.md
git commit -m "docs: delete legacy single template, split into co-located pair; sync overall P4 refs (P4)"
```

---

### Task 6: emit + validate + changeset

**Files:**
- Modify (generated): `packages/osuperpowers/.agents/skills/osuperpowers/brainstorming/SKILL.md` + 其 `.zh-CN`（由 `pnpm run emit` 刷新）
- Create: `.changeset/<slug>.md`

**Interfaces:**
- Consumes: Task 1–5 全部落地
- Produces: `.agents/` 派生副本刷新（SKILL.md 引用变更传播）；`emit:check` 无 drift；`validate` 全绿；独立 changeset

- [ ] **Step 1: 运行 emit 刷新派生副本**

Run: `pnpm run emit`
Expected: 成功，`.agents/skills/osuperpowers/brainstorming/SKILL.md` 引用已指向 `./overall-spec-template.md`

- [ ] **Step 2: 校验 emit 无 drift + 全量 validate**

Run: `pnpm run emit:check && pnpm run validate`
Expected: 两命令均 exit 0（无 drift；plugin 解析 / skill 目录 / hooks / engine 测试 / 版本同步全绿）

- [ ] **Step 3: 校验 `.agents` 派生副本引用正确且旧模板无孤本**

Run: `grep -n 'overall-spec-template' packages/osuperpowers/.agents/skills/osuperpowers/brainstorming/SKILL.md`
Expected: 命中 `./overall-spec-template.md`（无 `../docs/overall-phase-spec-template.md` 残留）

Run: `ls packages/osuperpowers/.agents/skills/osuperpowers/brainstorming/overall-phase-spec-template.md packages/osuperpowers/.agents/skills/osuperpowers/brainstorming/overall-phase-spec-template.zh-CN.md 2>&1`
Expected: 两文件均报 `No such file or directory`（emit 已清理 Task 5 git rm 的旧模板派生副本，无孤本残留）

- [ ] **Step 4: 创建独立 changeset**

Run: `pnpm run changeset`（交互式）→ 选 `packages/osuperpowers`，类型 `patch`，描述：`split overall-phase-spec-template into co-located overall-spec-template + phase-spec-template; point brainstorming Rule: Overall-Phase at them; solidify 5 dogfood practices`
或手动写入 `.changeset/dogfood-p4-templates.md`：
```markdown
---
"@oscaner/osuperpowers": patch
---

Split `docs/overall-phase-spec-template.md` into co-located `skills/brainstorming/overall-spec-template.md` + `phase-spec-template.md` (with zh-CN mirrors); point `brainstorming` Rule: Overall-Phase at them; solidify 5 dogfood practices (issue inventory, path naming, per-phase acceptance criteria, soft/hard dependency legend, mid-phase→overall feedback).
```

- [ ] **Step 5: 提交 changeset**

```bash
git add .changeset/dogfood-p4-templates.md
git commit -m "chore: add changeset for P4 spec template split"
```

---

## Self-Review Notes

- Spec 覆盖：Section 3 销毁/新建/改写/重跑 全部映射到 Task 1–6；Section 4/5 模板结构映射到 Task 1/2；Section 6 SKILL.md 改写映射到 Task 4；Section 7 验证清单映射到 Task 5/6。
- 占位符扫描：无 TBD/TODO；每个代码步骤均含实际内容或命令。
- 类型一致性：文件路径、图例符号（`->`/`-> (soft)` 源文件，`──建议先于──▶` 镜像）、版本号（overall v1.9→v2.0）跨任务一致。

