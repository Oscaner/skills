# Dogfood 修复程序 P4 — 模板与流程更新 · Design Spec

- **Version**: v1.0 · 2026-08-23
- **Status**: Approved
- **Author**: Oscaner Miao · Claude Opus 4.8 (1M context)
- **Parent program**: [dogfood-fixes-overall v1.9](2026-08-21-dogfood-fixes-overall.md)
- **Depends on**: P1 shipped（软依赖，避免并行改 brainstorming/SKILL.md）— 本次仅改 Rule: Overall-Phase 节，与 P1 改的其余节不重叠；P3 shipped（P3 改同文件 Rule: Read Upstream 节，两节不重叠）

---

## Section 0：增量警示

本文件为 P4 增量设计。跨相约定以 [overall spec](2026-08-21-dogfood-fixes-overall.md) 为准；冲突时 overall 优先。P4 属于程序末尾执行相（模板与流程固化为本次 dogfood 会话新增实践）。

---

## Section 1：背景与目标

**来源（overall spec Issue 清单 P4 行）**：
- 无 issue（依据 dogfood 会话 2026-08-21 决策）：`overall-phase-spec-template.md` + `brainstorming` Rule: Overall-Phase 更新，固化本次会话新增实践
- 无 issue（dogfood 会话 2026-08-22 P2 执行发现）：phase 进行中发生需求变更时须回馈 Overall Spec（P2 执行中新增 3 项：grilling 委托 v1.5 / Review Stopping v1.6 / Rule: Scope v1.7）

**目标**：将本次 dogfood 程序在 P1–P3 中沉淀出的 5 项实践固化为正典模板，并强化 brainstorming 触发时的即时约束，使后续多相程序不必重新踩坑：
1. issue 清单表（按 Phase 列 issue）
2. 路径命名约定（overall / phase spec / plan / ticket 四种产物）
3. Phase acceptance criteria（可验证完成条件）
4. 软 / 硬依赖区分（依赖图图例）
5. phase 进行中需求变更须回馈 Overall（强制）

**非目标**：不引入新功能、不改动引擎（runner.mjs / cdd-review.mjs）、不改动其他 docs/ 跨切面文档（review-dispatch / subagent-lifecycle / docs-review）、不碰 vendors/ 子模块。

---

## Section 2：关键决策记录（Grilling）

| # | 问题 | 决策 |
|---|------|------|
| Q1 | 模板整合形态（扩展现有节 vs 新增五顶层节 vs 整篇重写） | **整篇重写**（破坏性更新已授权）；以最佳实践重设计，不受现有 Section 0-6 / 0-5 骨架约束 |
| Q2 | 重写后具体度（抽象规约式 vs 附范例） | **A 抽象规约式**；仅关键表给一行列头示意，不附整段范例 |
| Q3 | SKILL.md 内联检查点形态（引用+浓缩清单 vs 引用+全文复述） | **A 引用 + 浓缩五检查点**；模板为正典，SKILL.md 不全文复述 |
| Q4 | 路径命名约定措辞 | **A 固化实际约定**（specs/overall、specs/-design、plans/不带后缀、-tickets；`<phase-id>` 小写） |
| Q5 | phase→Overall 回馈强度 | **A 强制 + 明确触发点**（执行/dev 阶段新需求/新 issue/新约束须即时回馈，未同步不得推进） |
| Q6 | 文件布局（与 SKILL.md 同级 vs 留 docs/） | **与 SKILL.md 同级** `skills/brainstorming/`；brainstorming 专用模板触发时同目录可寻，不跨到 `../docs/` |
| Q7 | 单文档去编号 vs 拆分为两文档 | **拆分为两文档**：`overall-spec-template.md`（程序宪章）+ `phase-spec-template.md`（Phase 增量） |
| Q8 | 图例符号语言（源文件纯英文铁律） | 源文件（模板 + SKILL.md）**零中文符号**，用 `->` = hard block / `-> (soft)` = suggestion；中文图例 `──建议先于──▶` 仅出现在 zh-CN 镜像 |

**语言铁律（Strategy A）**：所有英文源文件（模板 `.md`、SKILL.md）纯英文；仅 `*.zh-CN.md` 是中文镜像，可在镜像中呈现中文图例符号。overall spec 自身为 Strategy B 中文文档，其既成的 `──建议先于──▶` 叙述不在模板源文件复现。

---

## Section 3：交付物与文件布局

**销毁**：
- `packages/osuperpowers/docs/overall-phase-spec-template.md`
- `packages/osuperpowers/docs/overall-phase-spec-template.zh-CN.md`

**新建（与 `brainstorming/SKILL.md` 同级）**：
- `packages/osuperpowers/skills/brainstorming/overall-spec-template.md`（英文源）
- `packages/osuperpowers/skills/brainstorming/overall-spec-template.zh-CN.md`（镜像）
- `packages/osuperpowers/skills/brainstorming/phase-spec-template.md`（英文源）
- `packages/osuperpowers/skills/brainstorming/phase-spec-template.zh-CN.md`（镜像）

**改写**：
- `packages/osuperpowers/skills/brainstorming/SKILL.md` 的 `Rule: Overall-Phase`（引用改 `./overall-spec-template.md`，加浓缩五检查点 + GATE 声明）；其 `.zh-CN` 镜像同 task 同步
- overall spec P4 行（路径 `docs/...` → `skills/brainstorming/...`，变更历史加一条）

**重跑**：`pnpm run emit`（刷新 `.agents/` 派生副本）→ `pnpm run emit:check` + `pnpm run validate`（全绿）

**引用面核查**：旧模板的**唯一 live code 引用**是 `brainstorming/SKILL.md:77`（及其 `.zh-CN`、`packages/osuperpowers/.agents/` 派生副本）；历史 spec/plan/ticket 文档（如 dogfood-fixes-p1.md、os-engineering p2/p6d）也提及该路径但属非活跃记录，不影响移动。其余跨切面文档（review-dispatch / subagent-lifecycle / docs-review）被多 skill 共用，留 `docs/`，不搬；移动安全。

---

## Section 4：`overall-spec-template.md` 内容结构（纯英文源）

| 节 | 内容 | 五项实践落点 |
|---|---|---|
| Header | version / status / author / constraints | — |
| Document scope | 宪章声明；Overall 批准 ≠ phase 开始（GATE） | — |
| File paths | 固化路径约定（列头示意）：`specs/YYYY-MM-DD-<feature>-overall.md`、`specs/YYYY-MM-DD-<feature>-<phase-id>-design.md`、`plans/...-<phase-id>.md`、`tickets/...-<phase-id>-tickets.md`（`<phase-id>` 小写） | **② 路径命名** |
| Program charter | 目标 / 非目标 / 跨相约束（不含验收标准、API、组件、任务） | — |
| Issue inventory | 表：`\| Phase \| Issue(ref) \| 标题摘要 \|`（含「无 issue（dogfood 会话发现）」类） | **① issue 清单** |
| Phase inventory | 表：`\| # \| Phase \| Scope \| Design spec \| Implementation plan \| Acceptance criteria \| Dependency \|` | **③ 验收标准 ④ 依赖** |
| Dependency graph | ASCII 依赖图 + 图例：`->` = hard block；`-> (soft)` = suggestion（非硬阻塞） | **④ 软硬依赖** |
| Boundary rules | blockquote：每 phase 走完整 brainstorming→plan→dev；shipped 前依赖方不得启动；含「phase 进行中范围/约束变更须先回馈 Overall」 | **⑤ 回馈** |
| Maintenance | 每 phase 完成后更新链接+变更历史；**phase dev 阶段新需求/新 issue/新约束必须即时回馈 Overall（版本 bump + 变更历史 + 受影响 phase 验收/依赖同步），未同步不得推进该变更** | **⑤ 回馈** |
| Change history | 仅追加：完成、拆分、范围变更、状态切换 | — |

模板采用语义标题（不编号），承接「Program / Phase 拆分」决策（Q7）。

---

## Section 5：`phase-spec-template.md` 内容结构（纯英文源）

| 节 | 内容 | 五项实践落点 |
|---|---|---|
| Top blockquote (GATE) | 本 Phase spec **须经完整 brainstorming 循环生成**（brainstorming→plan→dev）；Overall 批准直接进入实施属违规 | **⑤ 回馈**（启动纪律） |
| Header | version / status (Draft\|Approved\|Plan pending\|Shipped) / author / parent program (link+version) / depends on (upstream+tags) | — |
| Section 0: Incremental warning | Phase N 仅增量；跨相约定见 overall；overall 冲突 overall 优先 | — |
| Section 1: Constraints pointer | 不重复 overall 约定 | — |
| Section 2: Design body | 本 phase 增量：approaches / architecture / components / data flow / errors / testing / **Acceptance criteria（独立小节，可验证完成条件）** | **③ 验收标准** |
| Section 3: Deviations from overall | 表：`\| Overall assumption \| Phase decision \| Overall updated? \|`；**updated? 须 Yes 才进 review** | **⑤ 回馈** |
| Section 4: Notes for downstream | 后续 phase 范围变更；拆分→更新 overall + 重跑批准(GATE) | — |
| Section 5: Review | fresh-subagent passes 全过才到 user review + writing-plans | — |

`overall-spec-template.md` Phase inventory 的「Acceptance criteria」列链接到本模板 Section 2「Acceptance criteria」独立节；「Dependency」列链接到本模板 Header 的 `Depends on` 字段（phase 模板无独立依赖节，依赖声明内联于 Header）。两列形成整体↔Phase 闭环。

**编号约定（有意为之）**：`overall-spec-template.md` 用语义标题（不编号），`phase-spec-template.md` 保留编号 Section 0–5（对齐本 dogfood P4 design spec 及历史 phase spec 的增量结构）。两者读者与生命周期不同（程序级 vs 增量级），编号策略不必统一；此差异为设计选择，非疏漏。

---

## Section 6：`brainstorming/SKILL.md` Rule: Overall-Phase 改写（纯英文）

**Before**（当前 L77）:
```
Large requirements (>=3 subsystems / multi-phase / overhaul) write an overall spec first, then phase out. Document structure: see [overall-phase-spec-template.md](../docs/overall-phase-spec-template.md). GATE: overall approval != phase started.
```

**After**:
```
Large / multi-phase requirements (>=3 subsystems / multi-phase / overhaul) write an overall spec first, then phase out. Document structure: [overall-spec-template.md](./overall-spec-template.md) (+ [phase-spec-template.md](./phase-spec-template.md) per phase). GATE: overall approval != any phase started.

When drafting, the overall spec MUST carry: (1) issue inventory per phase; (2) path naming `specs/YYYY-MM-DD-<feature>-overall.md`, `specs/YYYY-MM-DD-<feature>-<phase-id>-design.md`, `plans/...-<phase-id>.md`, `tickets/...-<phase-id>-tickets.md` (`<phase-id>` lowercase); (3) per-phase Acceptance criteria; (4) soft vs hard dependency distinction (graph legend: `->` = hard block, `-> (soft)` = suggestion — full legend in the template); (5) requirement changes arising during a phase MUST feed back to the overall spec before implementation. Each phase spec is produced by a full brainstorm->plan->dev cycle; jumping to implementation after overall approval alone is a violation.
```

SKILL.md 全文零中文符号；依赖图图例正典在模板内（英文 `->` / `-> (soft)`，zh-CN 镜像呈 `──建议先于──▶`）。

---

## Section 7：验证与交付清单

1. 删除 `docs/overall-phase-spec-template.md` + `.zh-CN`
2. 新建 `skills/brainstorming/overall-spec-template.md`（纯英文）+ `.zh-CN`
3. 新建 `skills/brainstorming/phase-spec-template.md`（纯英文）+ `.zh-CN`
4. 改写 `skills/brainstorming/SKILL.md` Rule: Overall-Phase（纯英文，引用改 `./` 同目录）；`.zh-CN` 镜像同 task 同步
5. 回馈 overall spec（按 Q5 强制，phase 中变更须即时回馈；逐行定位）：① **Section 1 Issue 清单两处 P4 行（line 44）**路径 `overall-phase-spec-template.md` → 改为「`skills/brainstorming/overall-spec-template.md` + `phase-spec-template.md`（删除旧 docs/ 单文档、拆为两模板）」；② **Section 2 Phase 清单 P4 行（line 68）**同步改写：原「`overall-phase-spec-template.md` + `brainstorming/SKILL.md` Rule: Overall-Phase 更新，固化本次会话新增实践」改为「`skills/brainstorming/overall-spec-template.md` + `phase-spec-template.md`（删除+新建两模板） + `brainstorming/SKILL.md` Rule: Overall-Phase 更新」；③ **Section 4 P4 验收标准块（line 109）**同步改为新路径与「删除+新建两项（含 zh-CN 镜像）」框架；④ 变更历史加一条（phase 中变更回馈实践，Q5=A）
6. `pnpm run emit` → 刷新 `.agents/` 派生副本
7. `pnpm run emit:check` + `pnpm run validate` 全绿
8. 独立 changeset（按 overall 约束每相独立）

---

## Section 8：验收标准

- `overall-spec-template.md` 含五项实践：issue 清单表、路径命名约定、per-phase acceptance criteria 列、软/硬依赖区分（含图例）、phase→Overall 回馈强制规则
- `phase-spec-template.md` 含 acceptance criteria 独立节 + 增量 GATE（须经完整 brainstorming 循环，Overall 批准直接实施属违规）
- `SKILL.md` Rule: Overall-Phase 引用指向同目录模板，含浓缩五检查点 + GATE 声明
- 两模板 zh-CN 镜像与英文源同一 task 同步，源文件零中文
- `emit:check` 无 drift、`validate` 全绿、独立 changeset

---

## Section 9：Review

Rule: Fresh-Subagent Review Passes（completeness / consistency&scope / clarity&YAGNI）全过才到 user review + writing-plans。Review Stopping next-step label：`"User review of spec"`。

---

## Section 10：变更历史

| 日期 | 事件 |
|------|------|
| 2026-08-23 | P4 design spec 创建，Status: Draft |
| 2026-08-23 | P4 design spec 用户批准，Status: Approved |
