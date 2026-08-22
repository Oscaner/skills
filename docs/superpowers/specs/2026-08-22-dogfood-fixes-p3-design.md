# Dogfood 修复 P3 — 文档与规则文本修正 Phase Spec

- **Version**: v1.0 · 2026-08-22
- **Status**: Approved
- **Author**: Oscaner Miao · Claude Opus 4.8 (1M context)
- **Parent program**: [Overall Spec](2026-08-21-dogfood-fixes-overall.md) v1.9
- **Depends on**: 无硬依赖。共享文件说明（Overall v1.9 依赖说明的展开）：P3 改 `brainstorming/SKILL.md` Rule: Read Upstream 节（P4 改同文件的 Rule: Overall-Phase 节，两节不重叠）；P3 给 `executing-plans/SKILL.md` 追加基线短句是临时性加固（P5 将删除该文件并迁移规则至 cli-driven-development）。顺序约束：P3 先于 P4/P5 落地

---

## Section 0：增量说明

> 本文件为 P3 增量 spec。跨相规范见 [Overall Spec](2026-08-21-dogfood-fixes-overall.md)；Overall 优先。
>
> **P3 范围扩展（来自 Overall v1.9）**：原「文档翻译补全」扩为三项——① zh-CN 全文翻译补全；② Read Upstream 措辞澄清；③ CLAUDE.md 拆分重组。三项同源于一个主题：**文档必须对其真实读者正确**。

---

## Section 1：约束指针

> 不重复 Overall 约束。Overall 优先。
> 跨相约束适用：
> - 翻译不得改动英文源文件（`cdd-reference.md`）
> - **新增**：文档拆分不得改动任何 SKILL.md 运行时行为语义
> - **语言架构 Strategy A**：SKILL.md / docs/*.md 修改须纯英文，zh-CN 镜像同 task 同步
> - **语言架构 Strategy B**：本 spec 为中文文档，无需镜像

---

## Section 2：设计

### 2.0 Issue 清单

| 文件 | Issue | 修复类型 |
|------|-------|----------|
| `packages/osuperpowers/docs/cdd-reference.zh-CN.md` | [#152](https://github.com/Oscaner/skills/issues/152)，边界扩为全文 | 翻译补全 + 漂移清除 |
| `packages/osuperpowers/skills/brainstorming/SKILL.md` + `.zh-CN.md` | 无 issue（dogfood 会话 2026-08-22 P3 brainstorming 发现） | Rule: Read Upstream 正典追加 + Red Flag |
| `packages/osuperpowers/skills/{code-review,finishing,debugging,verification,writing-plans,executing-plans}/SKILL.md` + 各 `.zh-CN.md` | 同上（引用方连带检查） | Rule: Read Upstream 节短句追加 |
| `packages/osuperpowers/CLAUDE.md`、`packages/osuperpowers-router/CLAUDE.md` | 无 issue（dogfood 会话 2026-08-22 P3 brainstorming 发现） | 删除 + 内容分流至 `docs/maintainers/` |
| 根 `CLAUDE.md` | 同上 | 指针更新 + 使用者视角维护规则 |

**非目标**：
- 不修改上游 vendors 子模块
- 不引入新功能或新维护流程（`docs/maintainers/` 为纯迁移 + 读者定位改写）
- 不新建消费者文档（运行时内容已有既有落点，见 2.3）

---

### 2.1 翻译补全（修复项 1，#152）

**范围**：`packages/osuperpowers/docs/cdd-reference.zh-CN.md` 全文（现 152 行）达到与英文源 `cdd-reference.md`（148 行）逐节对齐的完整中文版。

**现状问题**：
- 1–91 行（H6 节及之前）：英文段落夹杂零星中文，大量表格、exit codes、commit gate 说明未译
- H7 / H8 节：未译
- 119–121 行 `## Mode B (opt-in / AFK)` 节：英文源已不存在此节（Mode B 已于 2026-08-20 设计中删除），属镜像漂移残留 → 直接删除

**做法约束**：
- 逐节对照英文源翻译；术语沿用现有已译片段的习惯（harness / orchestrator / workspace 等专有名词不译，以现存已译中文用词为准）
- 英文源不动一字
- 完成后逐节 diff 对照确认无漏译、无多节

### 2.2 Read Upstream 措辞澄清（修复项 2）

**问题**：osuperpowers 各 skill 的 Rule: Read Upstream 要求读取的是上游 SKILL.md 文件，但实际执行中 harness 在会话启动时自动注入了 vendored 仓库的 CLAUDE.md（superpowers 贡献者指南、mattpocock-skills 仓库组织说明），被误当作流程基线。现有规则文本只写了"读哪个路径"，未排除"注入的 vendored CLAUDE.md ≠ 基线"这一失败模式。

**分层处理**：

1. **brainstorming/SKILL.md（正典定义处）**：

   Rule: Read Upstream 追加段（插在 fallback 路径之后、"Upstream unavailable" 段之前），泛化措辞、消费者环境中立：

   > The process baseline is the **SKILL.md file at the resolved path only**. Documents a harness auto-injects from vendored repos — `CLAUDE.md`, README, contributor guides under `vendors/<name>/` or any other source — are **not** the baseline, even when they load into context at session start. They describe repo contribution norms, not orchestrator flow.

   Red Flags 新增一条：

   - `"Treats injected vendor docs (CLAUDE.md / README) as the upstream baseline"` → violates Rule: Read Upstream; the baseline is the SKILL.md file at the resolved path only

2. **code-review / finishing / debugging / verification / writing-plans（5 个同构引用方）**：

   各自 Rule: Read Upstream 节追加一句指向正典的短句：

   > The baseline is the SKILL.md file at the resolved path only — injected vendor docs are not the baseline (see [Rule: Read Upstream](../brainstorming/SKILL.md#rule-read-upstream)).

   不加 Red Flag（这 5 个 skill 的 Red Flags 为 1–2 条极简形态，保持惯例）。

3. **executing-plans/SKILL.md（变体）**：

   同样追加同一句短句（指向 brainstorming 正典）。该文件 Red Flags 已有 11 条且含 Read Upstream 相邻反模式，追加一条基线反模式符合其密度惯例：

   - `"Treats injected vendor docs (CLAUDE.md / README) as the upstream baseline"` → violates Rule: Read Upstream; the baseline is the SKILL.md file at the resolved path only

   **临时性说明**：P5 将删除 `executing-plans/SKILL.md` 并把编排规则迁移至 cli-driven-development——P3 的追加是删除前的临时性加固，迁移时由 P5 一并带走。

4. **连带检查**：7 个 skill 全文 grep `vendors/` 与 "baseline"，确认无其他将注入文档当基线的表述残留；cli-* 家族与 init / report-issue 已查证无上游读取语义，不在范围内。

**zh-CN 镜像**：7 个 skill 的 `.zh-CN.md` 在同一 task 内同步对应修改。

**措辞中立性**：泛化措辞覆盖未来新增 vendored 子模块；`<repo-root>/vendors/superpowers/...` 的 fallback 解析路径保留原样——它描述"去哪找"，排除声明描述"什么算基线"，两者不矛盾。

### 2.3 CLAUDE.md 拆分重组（修复项 3）

**背景事实**（已查证）：两个包的 `contentRoot` 均为 `"."`，`packages/*/` 下一切随插件发布——包内 CLAUDE.md 会装到消费者环境，而其内容全是 monorepo 维护指南（emit 链、releasing、changeset），对消费者会话是噪音。参考对象 `vendors/superpowers/CLAUDE.md` 的优点是开头即明确读者定位。

**目标结构**：

```
docs/maintainers/
  osuperpowers-plugin.md          ← 迁自 packages/osuperpowers/CLAUDE.md
  osuperpowers-router-plugin.md   ← 迁自 packages/osuperpowers-router/CLAUDE.md
```

**内容分流规则**：

1. **`packages/osuperpowers/CLAUDE.md`（258 行）拆三股**：
   - 维护者内容 → `docs/maintainers/osuperpowers-plugin.md`：emit 链、hooks matrix、overrides pattern、CDD engine 细节、skills-missing gate 表、releasing、changeset 流程。开头加读者定位段："本文面向本 monorepo 开发者；消费者环境不适用"
   - 消费者适用的运行时行为 → 并入包内既有文档。经查证 overrides 三机制已被 router 用户文档与 `cross-harness-overrides.md` 覆盖、gate 行为已被 `cdd-reference.md` / `controller-handoff.md` 覆盖，无独占运行时内容需要新落点，**不新建消费者文档**
   - 纯重复内容 → 直接删除（Language architecture 节与根 CLAUDE.md 重复）

2. **`packages/osuperpowers-router/CLAUDE.md`（65 行）拆两股**：
   - "What this plugin does" + "Trigger mapping table" 为消费者运行时说明 → router README 已覆盖 trigger 映射表（"Router targets" 节），**不留副本**。其余 emit/hooks 维护内容迁 `docs/maintainers/osuperpowers-router-plugin.md`

3. **两个 `packages/*/CLAUDE.md` 删除**，包内不再有任何 agent 指令文件

4. **根 `CLAUDE.md` 更新**：
   - Per-package documentation 节指针改指 `docs/maintainers/`
   - Architecture details 中失效相对链接修正
   - 新增使用者视角维护规则：「规则文本与随插件发布的文档变更须从发布后使用者角度审视——消费者环境无 `vendors/`、无 monorepo 布局、无本仓库开发工具链」

5. **连带检查**：
   - 全仓 grep 旧路径引用：仅根 CLAUDE.md 与历史 plan 文档（历史记录不改）引用，无 SKILL.md / engine 代码依赖
   - `init harness` 写出的项目模板（`skills/init/router.md`、`skills/init/harness.md`）若提及旧路径须 plan 阶段核实并同步修正

---

## Section 3：与 Overall 的偏差

**P3 范围扩展**（Overall v1.9 已落地，变更内容见 Overall Issue 清单 / Phase 清单 / 跨相约束 / 依赖说明 / P3 验收标准）：
1. 翻译边界从「H7→EOF」扩为全文补全（含 Mode B 漂移清除）
2. 新增 Read Upstream 措辞澄清（7 个 skill + 7 个 zh-CN 镜像）
3. 新增 CLAUDE.md 拆分重组（2 包删除 + 2 份迁移文档 + 根更新）

其余无跨相偏差。

---

## Section 4：验收标准

| 修复项 | 验收条件 |
|--------|----------|
| 翻译补全 | zh-CN 每个 `##` 节与英文源一一对应；无整段英文正文残留（代码块/路径/专有名词除外）；`Mode B` 节不存在；英文源 `cdd-reference.md` 零改动 |
| Read Upstream | 7 个 SKILL.md 落地分层修改（brainstorming 正典追加+Red Flag；5 个引用方短句；executing-plans 短句+Red Flag）；7 个 zh-CN 镜像同 task 同步；全文 grep 无"注入文档=基线"表述残留 |
| CLAUDE.md 拆分（结构基准 ①） | `packages/osuperpowers/` 与 `packages/osuperpowers-router/` 目录树内无任何 `CLAUDE.md` / `AGENTS.md`；维护者内容位于 `docs/maintainers/` 且各文档开头有读者定位段；根 CLAUDE.md 指针指向新路径且无失效链接 |
| CLAUDE.md 拆分（语义基准 ②） | 仅约束 **P3 变更引入或改动的措辞**，抽查对象为消费者可见产物（两包 `README.md`、随包发布的 `docs/*.md`、根 CLAUDE.md 新增行）：不假设 `vendors/` 存在、不假设 monorepo 布局、不依赖本仓库开发工具链。**存量文档豁免**——既有随包 docs（如 `cdd-reference.md` 的仓库布局路径引用）不做回溯治理，留待未来 dogfood 发现后另行立项。SKILL.md 内的 `vendors/` fallback **解析规则**亦不受此基准约束（见 2.2 措辞中立性：解析规则描述"去哪找"，非基线声明）。`docs/maintainers/*.md` 不在抽查范围（读者定位即本仓库开发者，且不随插件发布） |
| 流程 | `pnpm run emit` + `emit:check` 无 drift；`pnpm run validate` 全绿；独立 changeset |

---

## Section 5：Review

Rule: Spec Review via CLI 三 pass（completeness / consistency / clarity）须全部通过后方可进入用户审阅和 writing-plans。

Review Stopping next-step 标签：`"User review of spec"`。
