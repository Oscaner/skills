# Dogfood 修复 P1 — Skills 规则修复 Phase Spec

- **Version**: v1.0 · 2026-08-21
- **Status**: Approved
- **Author**: Oscaner Miao · Claude Opus 4.8 (1M context)
- **Parent program**: [Overall Spec](2026-08-21-dogfood-fixes-overall.md) v1.1
- **Depends on**: 无前置依赖

---

## Section 0：增量说明

> 本文件为 P1 增量 spec。跨相规范见 [Overall Spec](2026-08-21-dogfood-fixes-overall.md)；Overall 优先。

---

## Section 1：约束指针

> 不重复 Overall 约束。Overall 优先。
> 跨相约束适用：P1 规则变更不得破坏现有 engine 测试（`pnpm run validate` 全绿）。

---

## Section 2：设计

### 2.1 目标与范围

修复三个 osuperpowers SKILL.md 文件中的流程违规，同时对三个文件进行结构性重写，使其符合统一骨架。

**Issue 清单**：

| 文件 | Issue | 修复类型 |
|------|-------|----------|
| `brainstorming/SKILL.md` | [#162](https://github.com/Oscaner/skills/issues/162) 多次触发后跳过完整流程 | 新增 HARD-GATE + Red Flags |
| `writing-plans/SKILL.md` | [#156](https://github.com/Oscaner/skills/issues/156) Section-by-Section 被误解为逐节确认 | Rule 文本更新 + Red Flag |
| `writing-plans/SKILL.md` | [#163](https://github.com/Oscaner/skills/issues/163)-① Plan Review CLI 被跳过 | 新增 HARD-GATE |
| `writing-plans/SKILL.md` | [#163](https://github.com/Oscaner/skills/issues/163)-② 旧 Execution Handoff 格式 | 新增 Red Flag |
| `executing-plans/SKILL.md` | [#163](https://github.com/Oscaner/skills/issues/163)-③ CLI 模式下仍内联编辑 | 新增 HARD-GATE |
| `executing-plans/SKILL.md` | [#163](https://github.com/Oscaner/skills/issues/163)-④ 缺少 per-task review | 新增 HARD-GATE |
| 三个 SKILL.md | 无 issue（结构性重写） | 统一骨架重写 |
| `packages/osuperpowers/docs/review-dispatch.md` | 无 issue（dogfood 发现） | 重命名为 `docs-review.md` + 新增 scope 声明 + Rule: Review Stopping（循环流程） + Rule: Handoff Output |
| `brainstorming/SKILL.md` | 无 issue（遗漏更新） | 引用路径更新为 `docs-review.md` + Review Stopping Red Flag |
| `writing-plans/SKILL.md` | 无 issue（遗漏更新） | 引用路径更新为 `docs-review.md` + Review Stopping Red Flag |
| `packages/osuperpowers/CLAUDE.md` | 无 issue（遗漏更新） | `review-dispatch.md` → `docs-review.md`，scope 说明更新为 spec-review + plan-review only |

---

### 2.2 统一 SKILL.md 骨架

三个文件统一采用以下结构，顺序固定：

```
---
frontmatter (name / description)
---

# 标题

[一句话描述]

<HARD-GATE>        ← 可出现多次；顶层=主流程门控，Rule内部=规则特定门控；无约束时省略
...
</HARD-GATE>

## Checklist       ← 显式有序步骤，编号列表；流程型 HARD-GATE 的可勾选镜像，以 HARD-GATE 为准
1. ...

## Rules           ← 具名规则（### Rule: Name），只保留 osuperpowers 差异层
### Rule: Foo
...

## Red Flags       ← 反模式列表："触发词" → 正确行为（规则引用）
- "..." → ...
```

约束：
- HARD-GATE 两种形式：（a）约束声明——禁止/必须，不含步骤；（b）流程完成要求——内联有序步骤列表（brainstorming 采用此形式），Checklist 是其可勾选镜像，**两者出现分歧以 HARD-GATE 为准**
- HARD-GATE 位置：主流程门控置顶层；规则特定门控嵌入 Rule 内部；无顶层 HARD-GATE 的文件（如 writing-plans）符合骨架约束
- Checklist 是流程步骤的可勾选视图（非流程权威），Rules 是操作细则，两者不重复
- Red Flags 引用格式：顶层流程型用 `HARD-GATE 流程型 Step N`；规则特定门控用 `HARD-GATE <Rule名称>`（如 `HARD-GATE Mode Selection`、`HARD-GATE Per-Task Review`）；仓库交付物 = 所有 git-tracked 文件及 skill 产物（spec / plan / tickets）
- 删除规则体内过程描述时，须确认对应内容已在 Checklist 中覆盖，否则保留

---

### 2.3 brainstorming/SKILL.md 重设计（#162）

**HARD-GATE（新增）**：

```
<HARD-GATE>
触发 brainstorming 后，必须按序完成以下全部步骤，
无论改动规模大小、输入是否已含方案、是否已有 issue 描述：

1. 读取上游 superpowers:brainstorming SKILL.md（Rule: Read Upstream）
2. 读取 grilling SKILL.md（Rule: Read Sub-Skills）
3. Explore project context（文件、文档、近期 commits）
4. Grilling——逐一追问，每次只问一个问题
5. 提出 2-3 个方案，含 trade-off 与推荐
6. 逐节呈现设计，每节获得用户确认
7. 写入 design doc
8. 3-pass Spec Review via CLI（Rule: Spec Review via CLI）
9. 用户审阅 spec，按需迭代
10. 移交 osuperpowers:writing-plans（Rule: Next-Step Routing）

在步骤 6（design 用户批准）完成前，禁止任何实施行动。
</HARD-GATE>
```

**Checklist**（HARD-GATE 流程型，可勾选镜像；流程以 HARD-GATE 为准）：
1. 读取上游 superpowers:brainstorming SKILL.md（Rule: Read Upstream）
2. 读取 grilling SKILL.md（Rule: Read Sub-Skills）
3. Explore project context（文件、文档、近期 commits）
4. Grilling——逐一追问，每次只问一个问题
5. 提出 2-3 个方案，含 trade-off 与推荐
6. 逐节呈现设计，每节获得用户确认
7. 写入 design doc
8. 3-pass Spec Review via CLI（Rule: Spec Review via CLI）
9. 用户审阅 spec，按需迭代
10. 移交 osuperpowers:writing-plans（Rule: Next-Step Routing）

**Rules**：保留现有 7 条（Read Upstream / Read Sub-Skills / Research Delegation / Overall-Phase / Spec Review via CLI / Next-Step Routing / Write Design Doc），删除各规则体内含有"步骤列举"或"按顺序执行 X → Y → Z"形式的过程描述段落（该内容已由 Checklist 承载），每条只保留"如何做"的操作指引（路径解析规则、命令参数格式、失败处理策略等）。

**Red Flags 新增**：
- `"输入已含方案，跳过 grilling 直接设计"` → 违反 HARD-GATE 流程型 Step 4
- `"改动简单，跳过 design 直接实施"` → 违反 HARD-GATE 流程型 Step 6
- `"Overall 批准后直接开始实施（跳过 Phase brainstorming）"` → 违反 HARD-GATE 流程型 Steps 1-10（整个流程）

---

### 2.4 writing-plans/SKILL.md 重设计（#156 / #163-① / #163-②）

**HARD-GATE（新增，嵌入 Rule: Plan Review via CLI 内部）**：

```
<HARD-GATE>
Plan 写完后，必须按序执行三次 cdd-review CLI pass
（completeness / decomposition / buildability），
不可用内联自检替代，全部通过后方可进入 Execution Handoff。
</HARD-GATE>
```

**Checklist**：
1. 读取上游 `superpowers:writing-plans` SKILL.md（Rule: Read Upstream）
2. 读取 spec 文件，理解设计约束
3. 逐节写入 plan——每节一次 tool call（Rule: Section-by-Section）
4. 3-pass Plan Review via CLI（completeness / decomposition / buildability）
5. 将写完的 plan 一次性呈现给用户确认
6. Execution Handoff → 移交 `osuperpowers:executing-plans`

**Rule: Section-by-Section 更新（#156）**：

> 写入粒度与确认时机解耦：每节独立 tool call 写入（写入粒度）；所有节写入完成后一次性呈现给用户（确认时机）。**禁止**每节完成后暂停等待用户回应。

**Rules**：保留现有 6 条（Read Upstream / Read Sub-Skills / Section-by-Section / Plan Review via CLI / Tickets Publish Redirect / Next-Step Routing），删除各规则体内步骤列举形式的过程描述，每条只保留操作指引。

**Red Flags 新增（writing-plans）**：
- `"每节写完后询问用户是否继续"` → 写完所有节再确认（Rule: Section-by-Section）
- `"Plan Review 用内联自检替代 cdd-review CLI"` → 违反 HARD-GATE Plan Review，必须调用三次 CLI
- `"展示 subagent / in-session / CLI 三选一选项"` → 使用 Execution Handoff 文本，移交 `osuperpowers:executing-plans`（Rule: Next-Step Routing）

---

### 2.5 executing-plans/SKILL.md 重设计（#163-③ / #163-④）

**HARD-GATE 1 — Mode Selection（已存在，保留，顶层）**：

```
<HARD-GATE>
启动时第一个动作必须是 AskUserQuestion 选择模式（in-session | subagent | cli），
在此之前禁止任何 repo tool call。
</HARD-GATE>
```

**HARD-GATE Mode Selection（CLI 禁止内联编辑，新增，#163-③，嵌入 Rule: Mode Selection 内部）**：

```
<HARD-GATE>
CLI 模式选定后，本 session 禁止使用 Write/Edit 工具修改仓库交付物。
所有代码变更必须通过 cdd-task.mjs H6 chain 执行。
发现违规立即停止并报告用户。
</HARD-GATE>
```

**HARD-GATE Per-Task Review（门控，新增，#163-④，嵌入 Rule: Per-Task Review 内部，适用全部模式）**：

```
<HARD-GATE>
每个 task 实施完成后，必须读取 `$CDD_HANDOFF_PATH`（handoff.json）执行 Per-Task Review 门控，
判定 APPROVED 后才可写入 ledger 并推进下一 task。
禁止跳过 handoff 读取直接进入下一 task 或编译验证。适用于 in-session / subagent / cli 全部模式。
</HARD-GATE>
```

**Checklist**：
1. AskUserQuestion 选择模式（in-session / subagent / cli）
2. 读取对应上游 SKILL.md（Rule: Read Upstream）
3. Setup（workspace / ledger / plan / plan-constraints / pre-flight）
4. Per-task 循环：Task Complexity → Confirm Once → Confirm Seams → 执行 → **Per-Task Review** → ledger
5. D6 Aggregation（deferred items 聚合 → 用户决策）
6. `osuperpowers:code-review` → `osuperpowers:finishing`

**Red Flags 新增（executing-plans）**：
- `"CLI 模式下使用 Write/Edit 修改仓库交付物"` → 违反 HARD-GATE Mode Selection（CLI 禁止内联编辑），通过 cdd-task.mjs 执行
- `"实施完成后直接进入下一 task 或编译验证"` → 违反 HARD-GATE Per-Task Review（门控），必须先读 `$CDD_HANDOFF_PATH`

**Rules**：保留现有 11 条（Read Upstream / Mode Selection / Task Complexity / Confirm Once / Fix Loop / Confirm Seams / Per-Task Review / Quality Invariants / Orchestrator Checklist / D6 Aggregation / Ledger），删除各规则体内"步骤列举"形式的过程描述，每条只保留操作指引（判断逻辑、参数格式、失败策略等）。

---

### 2.6 Review 停止机制 + Handoff 统一（新增，docs-review.md + 2 个引用方）

**问题 1**：`review-dispatch.md` 现有规则 `warn/nit do not enter the fix loop` 表述为"自动 deferred"，没有用户决策步骤，且无明确的重跑循环逻辑。

**问题 2**：spec/plan review 有 3 个 pass，fix blocker 后不清楚是否需要重跑全部 3 pass。

**问题 3**：spec-review / plan-review 无 handoff.json 输出，task-review 有，行为不一致。

**问题 4**：`review-dispatch.md` 名称缺乏范围语义，AI 容易误认为适用所有 review 类型（task-review / branch-review 不应感知此文件）。

**修复内容**：

**1. 重命名 `review-dispatch.md` → `docs-review.md`**

scope 声明（写入文件头）：
> **Scope:** Applies to 3-pass AI-orchestrated doc reviews (spec-review / plan-review) only. Task-review uses Fix Loop in `executing-plans/SKILL.md`. Branch-review uses `cli-code-review/SKILL.md`.

**2. 新增 Rule: Review Stopping（替换现有 `warn/nit do not enter the fix loop` 表述）**

```
① 执行 3-pass review
② blocker 必须修复 → 只重跑产生该 blocker 的那一 pass → blocker=0 → 继续
③ 所有 pass blocker=0 → 将 warn/nit 列表一次性呈现给用户（允许逐项选择）：

   用户选择【不修复】
     └─→ review 完成，进入下一步

   用户选择【修复部分或全部】
     └─→ 修复指定项
     └─→ 询问用户："是否需要重新进行 3-pass review？"
           用户说【不需要】→ review 完成，进入下一步
           用户说【需要】  → 回到 ①
```

展示 warn/nit 时从本次 3-pass review cycle 已有的各 pass 输出中读取，不额外发起任何新的 review 调用。

**3. 新增 Rule: Handoff Output（P1 规则层定义，P2 引擎实现）**

路径约定：
- spec-review：`<cdd-workspace>/spec-review-handoff.json`
- plan-review：`<cdd-workspace>/plan-review-handoff.json`
- task-review：`$CDD_HANDOFF_PATH`（现有 env var 机制，不经由 `--handoff`，保持不变）
- branch-review：`<cdd-workspace>/branch-review-handoff.json`

`<cdd-workspace>` = `.superpowers/cdd/<plan-slug>/`。Schema 复用现有 task handoff 结构。P2 shipped 后完全生效，P1 期间规则文本标注 `[Engine pending P2]`。

**4. 更新 2 个引用方（brainstorming + writing-plans）**

| 文件 | 操作 |
|------|------|
| `brainstorming/SKILL.md` | 引用路径从 `review-dispatch.md` → `docs-review.md`；补 Review Stopping Red Flag |
| `writing-plans/SKILL.md` | 引用路径从 `review-dispatch.md` → `docs-review.md`；补 Review Stopping Red Flag |

**5. 更新 `packages/osuperpowers/CLAUDE.md`**

将 `review-dispatch.md` 引用和描述更新为 `docs-review.md`，scope 说明改为 spec-review + plan-review only。

**task-review（executing-plans Fix Loop）和 branch-review（cli-code-review）不引用 docs-review.md，维持现有机制不变。**

**Red Flag 新增**（写入 brainstorming + writing-plans）：
- `"blocker=0 后自动修复 warn/nit 并重跑 review"` → 违反 Rule: Review Stopping（docs-review.md），warn/nit 须呈现给用户，用户决策后视需求决定是否重跑
- `"为获取 warn/nit 内容额外发起新的 cdd-review 调用"` → 违反 Rule: Review Stopping，从本次 3-pass cycle 已有输出读取

---

## Section 3：与 Overall 的偏差

无跨相偏差。

---

## Section 4：下游备注

P4（模板与流程更新）将修改 `brainstorming/SKILL.md` 的 Rule: Overall-Phase 节。建议 P1 shipped 后再启动 P4，避免并行编辑同文件。

---

## Section 5：验收标准

| 项目 | 验收条件 |
|------|----------|
| 结构 | 三个 SKILL.md 均符合统一骨架；brainstorming 顶层 HARD-GATE（流程型）+ Checklist；writing-plans 无顶层 HARD-GATE（Plan Review HARD-GATE 嵌入 Rule 内部，符合骨架规则特定门控形式）；executing-plans HARD-GATE 1 顶层 + HARD-GATE 2/3 嵌入对应 Rule 内部 |
| #156 | Rule: Section-by-Section 含"写入粒度≠确认时机"说明；Red Flag 覆盖逐节确认反模式 |
| #162 | brainstorming/SKILL.md 含 10 步 HARD-GATE；Red Flag 覆盖三类绕过场景 |
| #163-① | writing-plans/SKILL.md Plan Review HARD-GATE 嵌入规则体；3-pass CLI 为必须项 |
| #163-② | writing-plans/SKILL.md Red Flag 覆盖"三选一文本"反模式 |
| #163-③ | executing-plans/SKILL.md HARD-GATE Mode Selection（CLI 禁止内联编辑）存在；Red Flag 覆盖内联编辑反模式 |
| #163-④ | executing-plans/SKILL.md HARD-GATE Per-Task Review（门控）存在；Red Flag 覆盖跳过 handoff 反模式 |
| 测试 | `pnpm run validate` 全绿 |
| 兼容性 | 无新增规则与现有规则矛盾；现有 Red Flags 保留或合并，无丢失 |
| Review 停止机制 | `review-dispatch.md` 重命名为 `docs-review.md`，新增 scope 声明（spec/plan only）、Rule: Review Stopping（循环流程）、Rule: Handoff Output；brainstorming + writing-plans 引用路径更新；CLAUDE.md 描述更新；task-review / branch-review 不引用 docs-review.md |
| Handoff 统一 | `docs-review.md` 新增 Rule: Handoff Output；brainstorming + writing-plans 补 Handoff 规则引用；P2 提供 cdd-review.mjs `--handoff PATH` 引擎实现 |

---

## Section 6：Review

Rule: Spec Review via CLI 三 pass 须全部通过后方可进入用户审阅和 writing-plans。
