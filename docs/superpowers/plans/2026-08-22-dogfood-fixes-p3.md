# Dogfood 修复 P3 — 文档与规则文本修正 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落地 P3 三项修复——cdd-reference.zh-CN.md 全文翻译补全、7 个 skill 的 Rule: Read Upstream 措辞澄清、CLAUDE.md 拆分重组（维护者内容移出 packages/）。

**Architecture:** 纯文档/规则文本变更，无引擎代码。三项修复按 Task 1–4 顺序落地，Task 5 收尾验证 + changeset。所有 SKILL.md/docs 变更遵循 Strategy A（英文源 + zh-CN 镜像同 task 同步），完成后 `pnpm run emit` 再生成 `.agents/`。

**Tech Stack:** Markdown / pnpm scripts (`emit`, `validate`) / Node (fnm)。

## Global Constraints

来自 [Overall Spec v1.9](../specs/2026-08-21-dogfood-fixes-overall.md) 与 [P3 Spec](../specs/2026-08-22-dogfood-fixes-p3-design.md)：

- 不修改上游 vendors 子模块
- 翻译不得改动英文源文件 `packages/osuperpowers/docs/cdd-reference.md`（零 diff）
- 文档拆分不得改动任何 SKILL.md 运行时行为语义（Read Upstream 追加的短句除外——那是本相的规则文本修复本身）
- Strategy A：SKILL.md / docs/*.md 英文源纯英文；zh-CN 镜像同 task 同步；`.agents/` 由 emit 再生，不直接编辑
- 术语惯例（沿用现存已译片段）：harness / orchestrator / workspace / plugin_root / handoff / ledger 等专有名词不译
- Conventional commits（`fix:` / `docs:` / `chore:`）；无 attribution trailers
- 每个 task 完成即 commit（用户已批准 plan 执行）

---

### Task 1: cdd-reference.zh-CN.md 全文翻译补全

**Files:**
- Modify: `packages/osuperpowers/docs/cdd-reference.zh-CN.md`（重写为与英文源逐节对齐的完整中文版）

**Interfaces:**
- Consumes: 英文源 `packages/osuperpowers/docs/cdd-reference.md`（148 行，只读基准）
- Produces: 无下游依赖；验收由 Task 5 汇总检查

- [ ] **Step 0: 翻译设计文档状态为 Approved**（前置）

```bash
sed -i.bak 's/- \*\*Status\*\*: Draft/- **Status**: Approved/' \
  docs/superpowers/specs/2026-08-22-dogfood-fixes-p3-design.md
rm docs/superpowers/specs/2026-08-22-dogfood-fixes-p3-design.md.bak
git add docs/superpowers/specs/2026-08-22-dogfood-fixes-p3-design.md
git commit -m "docs: approve P3 design spec"
```

- [ ] **Step 1: 逐节翻译 H6 节及之前（现 1–91 行的英夹中内容）**

对照英文源逐节翻译。保留现有已译片段不动，只译英文段落。要点：

- 头部引用块（Worker discipline SOT / Orchestrator gate discipline / Rule 0 checklist 语义契约）→ 中文
- H6 节正文：three modes 表格 Responsibility 列、env contract 表格 Purpose 列、Output / Forbidden / Session traceability 说明 → 中文
- Workspace path contract 表格 Purpose 列、Batching 约定表、Exit codes 段落 → 中文
- Skills-missing gate 段落中英文句子 → 中文
- Post-run commit gate 正文及其三个 bullet（Fail-open / Precondition / Ordering）→ 中文
- Ledger 段 → 中文

术语不译清单：harness, orchestrator, workspace, plugin_root, handoff, ledger, brief, mode (implement/task-review/fix), exit code 数值, `CDD_*` 环境变量名, 文件路径。

- [ ] **Step 2: 删除 Mode B 漂移残留节**

删除 zh-CN 中 `## Mode B (opt-in / AFK)` 整节（约 119–121 行）——英文源已无此节。

- [ ] **Step 3: 翻译 H7 / H8 / CDD gate matrix 节**

- H7 — No consumer-repo CLI scripts：标题格式保持 `## H7 — <中文>`，正文两段 + `{plugin_root}` 解析说明 → 中文
- H8 — CLI opt-in / opt-out：Opt-in/Opt-out 优先级列表、harness registry 说明、Ship 表格说明文字 → 中文（表格内 harness 名与 ship 值保留英文）
- CDD gate matrix：gate 决策点说明、fail-open 表格表头与条件列 → 中文（Tool 名保留）

- [ ] **Step 4: 对照检查**

Run:
```bash
diff <(grep -n "^## " packages/osuperpowers/docs/cdd-reference.md | sed 's/^[0-9]*://') \
     <(grep -n "^## " packages/osuperpowers/docs/cdd-reference.zh-CN.md | sed 's/^[0-9]*://;s/ — .*//')
```
Expected: 两边节数一致（zh-CN 标题允许中文后缀）。再人工抽查：每个 `##` 节内无整段英文正文残留。

- [ ] **Step 5: 验证英文源零改动**

Run: `git diff --stat packages/osuperpowers/docs/cdd-reference.md`
Expected: 无输出。

- [ ] **Step 6: Commit**

```bash
git add packages/osuperpowers/docs/cdd-reference.zh-CN.md
git commit -m "docs: complete cdd-reference.zh-CN.md full translation and remove stale Mode B section (#152)"
```

---

### Task 2: brainstorming Read Upstream 正典澄清 + zh-CN 镜像

**Files:**
- Modify: `packages/osuperpowers/skills/brainstorming/SKILL.md`
- Modify: `packages/osuperpowers/skills/brainstorming/SKILL.zh-CN.md`

**Interfaces:**
- Consumes: 无
- Produces: Rule: Read Upstream 节新增基线定义段（Task 3 的短句链接目标 `../brainstorming/SKILL.md#rule-read-upstream` 指向本节）

- [ ] **Step 1: SKILL.md Rule: Read Upstream 追加基线定义段**

在现有 fallback 路径行（`2. **Fallback same-repo relative path**: ...`）之后、"Upstream unavailable" 段之前插入：

```markdown
The process baseline is the **SKILL.md file at the resolved path only**. Documents a harness auto-injects from vendored repos — `CLAUDE.md`, README, contributor guides under `vendors/<name>/` or any other source — are **not** the baseline, even when they load into context at session start. They describe repo contribution norms, not orchestrator flow.
```

- [ ] **Step 2: SKILL.md Red Flags 追加反模式**

在 Red Flags 列表末尾（`"Presents Option A / Option B choices..."` 条目之后）追加：

```markdown
- "Treats injected vendor docs (CLAUDE.md / README) as the upstream baseline" → violates Rule: Read Upstream; the baseline is the SKILL.md file at the resolved path only
```

- [ ] **Step 3: zh-CN 镜像同步对应两处**

`SKILL.zh-CN.md` 同位置插入对应中文（Rule 节内、Red Flags 列表末尾）：

Rule 节追加段：
```markdown
流程基线仅为**解析路径指向的 SKILL.md 文件本身**。harness 从 vendored 仓库自动注入的文档——`CLAUDE.md`、README、`vendors/<name>/` 下或其他来源的贡献者指南——**不是**基线，即使它们在会话启动时已载入上下文。它们描述的是仓库贡献规范，不是 orchestrator 流程。
```

Red Flags 追加条目：
```markdown
- "把注入的 vendor 文档（CLAUDE.md / README）当作上游基线" → 违反 Rule: Read Upstream；基线仅为解析路径指向的 SKILL.md 文件
```

- [ ] **Step 4: 验证纯英文**

Run: `grep -P '[\x{4e00}-\x{9fff}]' packages/osuperpowers/skills/brainstorming/SKILL.md | head -5`
Expected: 无输出。

- [ ] **Step 5: Commit**

```bash
git add packages/osuperpowers/skills/brainstorming/SKILL.md packages/osuperpowers/skills/brainstorming/SKILL.zh-CN.md
git commit -m "fix: clarify Read Upstream baseline definition in brainstorming skill (injected vendor docs are not the baseline)"
```

---

### Task 3: 五个同构引用方 + executing-plans 短句追加 + zh-CN 镜像

**Files:**
- Modify: `packages/osuperpowers/skills/{code-review,finishing,debugging,verification,writing-plans,executing-plans}/SKILL.md` 及各 `.zh-CN.md`（12 个文件）

**Interfaces:**
- Consumes: Task 2 产出的正典锚点 `../brainstorming/SKILL.md#rule-read-upstream`
- Produces: 无下游依赖

- [ ] **Step 1: 五个同构 skill 各追加一句**

对 code-review / finishing / debugging / verification / writing-plans：在各自 `### Rule: Read Upstream` 节的正文末行（`**Read, not Skill-invoke**.` 之后）追加一行空行 + 短句：

```markdown
The baseline is the SKILL.md file at the resolved path only — injected vendor docs are not the baseline (see [Rule: Read Upstream](../brainstorming/SKILL.md#rule-read-upstream)).
```

不加 Red Flag（保持这 5 个文件 1–2 条极简惯例）。

- [ ] **Step 2: executing-plans 追加短句 + 反模式**

`executing-plans/SKILL.md` Rule: Read Upstream 节三个 mode 分支列表之后追加同一短句（同 Step 1 文本）。

该文件 Red Flags 列表末尾追加：

```markdown
- "Treats injected vendor docs (CLAUDE.md / README) as the upstream baseline" → violates Rule: Read Upstream; the baseline is the SKILL.md file at the resolved path only
```

（临时性加固：P5 删除此文件时一并迁移至 cli-driven-development。）

- [ ] **Step 3: 六个 zh-CN 镜像同步**

各 `.zh-CN.md` 对应位置插入中文短句：

```markdown
基线仅为解析路径指向的 SKILL.md 文件——注入的 vendor 文档不是基线（见 [Rule: Read Upstream](../brainstorming/SKILL.md#rule-read-upstream)）。
```

注意：镜像内链接指向英文源锚点 `SKILL.md#rule-read-upstream`（现有镜像惯例如此，见 finishing/code-review 等镜像对正典的既有引用方式）。executing-plans 镜像另加 Red Flag 中文条目：

```markdown
- "把注入的 vendor 文档（CLAUDE.md / README）当作上游基线" → 违反 Rule: Read Upstream；基线仅为解析路径指向的 SKILL.md 文件
```

- [ ] **Step 4: 连带 grep 检查**

Run:
```bash
grep -rn "baseline" packages/osuperpowers/skills/*/SKILL.md | grep -iv "resolved path\|process baseline\|SKILL.md file"
grep -rniE "vendor.*(claude\.md|readme).*(baseline|基线)" packages/osuperpowers/skills/*/SKILL*.md
```
Expected: 第一条无输出或仅命中 Task 2/3 新增文本；第二条无输出。

- [ ] **Step 5: Commit**

```bash
git add packages/osuperpowers/skills/{code-review,finishing,debugging,verification,writing-plans,executing-plans}/
git commit -m "fix: add baseline clarification to all Read Upstream referencing skills (5 homogeneous + executing-plans)"
```

---

### Task 4: CLAUDE.md 拆分重组 + 根 CLAUDE.md 更新

**Files:**
- Create: `docs/maintainers/osuperpowers-plugin.md`（迁自 `packages/osuperpowers/CLAUDE.md`）
- Create: `docs/maintainers/osuperpowers-router-plugin.md`（迁自 `packages/osuperpowers-router/CLAUDE.md`）
- Delete: `packages/osuperpowers/CLAUDE.md`
- Delete: `packages/osuperpowers-router/CLAUDE.md`
- Modify: `CLAUDE.md`（根）

**Interfaces:**
- Consumes: 无
- Produces: `docs/maintainers/` 两份维护者文档；包目录树内零 agent 指令文件（结构基准 ①）

- [ ] **Step 1: 创建 docs/maintainers/osuperpowers-plugin.md**

以 `packages/osuperpowers/CLAUDE.md` 为底本迁移，做三类处理：

**1a. 开头加读者定位段**（替换原标题行下方首句）：

```markdown
# osuperpowers 插件 — 维护者指南

> **读者定位**：本文面向本 monorepo（Oscaner/skills）的开发者，描述插件开发、emit 链、hooks、releasing 等维护流程。**消费者环境不适用**——安装插件的用户无需阅读本文。
```

**1b. 原样迁移的节**（内容不变，仅修正指向 packages/ 内文件的相对路径为从 docs/maintainers/ 出发的新相对路径）：
- Marketplace --> plugin --> skill chain
- The overrides pattern (router --> osuperpowers)（含 Hooks matrix 子节）
- Cross-cutting docs
- `docs/superpowers/` conventions
- Common operations
- Verifying a change didn't break the marketplace
- CDD CLI pre-check (skills-missing gate)
- Releasing
- Git conventions for this repo（含 When to commit 子节）

**1c. 删除不迁移的节**：
- Language architecture 节整体删除（与根 CLAUDE.md 重复）

注意：原文内引用 `../marketplace/source.json` 等相对链接全部按 `docs/maintainers/` 位置重算（如 `../../marketplace/source.json`）。

- [ ] **Step 2: 删除 packages/osuperpowers/CLAUDE.md**

```bash
git rm packages/osuperpowers/CLAUDE.md
```

- [ ] **Step 3: 创建 docs/maintainers/osuperpowers-router-plugin.md**

以 `packages/osuperpowers-router/CLAUDE.md` 为底本：

**3a. 开头加同样的读者定位段**（标题换 router 名）。

**3b. 迁移**：How it works（三机制）、Trigger mapping table、Convention: no skill bodies、Related files 各节。相对链接同样重算。

**3c. 不迁移**："What this plugin does" 消费者运行时说明——router README "Router targets" 节已覆盖 trigger 映射表（P3 spec 2.3 已核实），不留副本。

- [ ] **Step 4: 删除 packages/osuperpowers-router/CLAUDE.md**

```bash
git rm packages/osuperpowers-router/CLAUDE.md
```

- [ ] **Step 5: 根 CLAUDE.md 更新**

5a. Per-package documentation 节改为（**保留既有 README 行，追加新行**）：

```markdown
## Per-package documentation

- [`packages/osuperpowers/README.md`](packages/osuperpowers/README.md) — osuperpowers plugin 用户指南
- [`packages/osuperpowers-router/README.md`](packages/osuperpowers-router/README.md) — overrides plugin 用户指南
- [`docs/maintainers/osuperpowers-plugin.md`](docs/maintainers/osuperpowers-plugin.md) — osuperpowers plugin 维护者指南（emit 链 / hooks / releasing）
- [`docs/maintainers/osuperpowers-router-plugin.md`](docs/maintainers/osuperpowers-router-plugin.md) — osuperpowers-router plugin 维护者指南
```

5b. Architecture details 节末尾两行引用同步改指新路径（原指向 `packages/*/CLAUDE.md` 的两行）。

5c. Git conventions 节新增一行使用者视角规则：

```markdown
- **使用者视角**：规则文本与随插件发布的文档变更须从发布后使用者角度审视——消费者环境无 `vendors/`、无 monorepo 布局、无本仓库开发工具链。
```

- [ ] **Step 6: 结构基准 ① 验证**

Run:
```bash
find packages/osuperpowers packages/osuperpowers-router -name "CLAUDE.md" -o -name "AGENTS.md"
head -3 docs/maintainers/osuperpowers-plugin.md docs/maintainers/osuperpowers-router-plugin.md
grep -rn "packages/osuperpowers/CLAUDE.md\|osuperpowers-router/CLAUDE.md" --include="*.md" . | grep -v vendors/ | grep -v node_modules | grep -v ".agents/" | grep -v "docs/superpowers/"
```
Expected: 第一条无输出；第二条两文件均含读者定位段；第三条无输出（历史 plan 文档与 vendors 除外）。

- [ ] **Step 7: init 模板连带核实**

Run:
```bash
grep -n "CLAUDE.md" packages/osuperpowers/skills/init/router.md packages/osuperpowers/skills/init/harness.md packages/osuperpowers/skills/init/SKILL.md
```
Expected: 仅命中「写入项目 CLAUDE.md」语义（init router 写的是消费者项目的 CLAUDE.md，与本仓库包内 CLAUDE.md 无关），无需修改。若出现指向 `packages/*/CLAUDE.md` 的路径则同步修正。

- [ ] **Step 8: Commit**

```bash
git add docs/maintainers/ CLAUDE.md
git commit -m "docs: split package CLAUDE.md files into docs/maintainers/ (consumer-perspective cleanup)"
```

---

### Task 5: emit 再生 + 全量验证 + changeset

**Files:**
- Modify: `packages/osuperpowers/.agents/skills/*/SKILL.md` 及 `.zh-CN.md`（由 emit 再生，不手编）
- Create: `.changeset/<auto-generated>.md`

**Interfaces:**
- Consumes: Tasks 1–4 的全部落地文件
- Produces: 验证全绿 + 独立 changeset（P3 完成标记）

- [ ] **Step 1: fnm use + emit 再生**

Run:
```bash
fnm use && pnpm run emit
```
Expected: `.agents/` 下 7 个 skill 的 SKILL.md 与 SKILL.zh-CN.md 再生（含本相修改）。

- [ ] **Step 2: emit:check 无 drift**

Run: `pnpm run emit:check`
Expected: exit 0。

- [ ] **Step 3: validate 全绿**

Run: `pnpm run validate`
Expected: exit 0，全部 validation block 通过。

- [ ] **Step 4: P3 验收标准逐条核对**

对照 [P3 Spec Section 4](../specs/2026-08-22-dogfood-fixes-p3-design.md)：

```bash
# 翻译：节对齐（strip ' — .*' from both sides for heading-diff）
diff <(grep -n "^## " packages/osuperpowers/docs/cdd-reference.md | sed 's/^[0-9]*://;s/ — .*//' ) \
     <(grep -n "^## " packages/osuperpowers/docs/cdd-reference.zh-CN.md | sed 's/^[0-9]*://;s/ — .*//')
# Read Upstream：6 个引用方含短句（brainstorming 正典用不同 phrasing，单独验证）
grep -l "injected vendor docs are not the baseline" packages/osuperpowers/skills/{code-review,finishing,debugging,verification,writing-plans,executing-plans}/SKILL.md | wc -l
grep -l "are **not** the baseline" packages/osuperpowers/skills/brainstorming/SKILL.md | wc -l
# zh-CN 镜像同步（executing-plans + 5 个同构方 = 6）
grep -l "注入的 vendor 文档不是基线\|把注入的 vendor 文档.*当作上游基线" packages/osuperpowers/skills/{code-review,finishing,debugging,verification,writing-plans,executing-plans}/SKILL.zh-CN.md | wc -l
# 结构基准
find packages/osuperpowers packages/osuperpowers-router -name "CLAUDE.md" -o -name "AGENTS.md" | wc -l
# 英文翻译源零改动
git diff main --stat -- packages/osuperpowers/docs/cdd-reference.md
```
Expected: 节数一致；引用方短句 wc = 6；brainstorming 正典 wc = 1；zh-CN wc = 6；结构基准 wc = 0；英文源无 diff。人工项：语义基准 ② 抽查本次改动措辞。

- [ ] **Step 5: changeset**

Run: `pnpm run changeset`，选择 `osuperpowers` 与 `osuperpowers-router`（`packages/osuperpowers-router/CLAUDE.md` 删除改变了其 contentRoot('.') 下的发布内容，无条件 patch bump），patch bump，描述：P3 文档与规则文本修正（zh-CN 全文补全 / Read Upstream 基线澄清 / CLAUDE.md 拆分重组）。手动写入亦可：

```markdown
---
"@oscaner-skills/osuperpowers": patch
"@oscaner-skills/osuperpowers-router": patch
---

P3 dogfood fixes: complete cdd-reference zh-CN translation, clarify Read Upstream baseline (injected vendor docs are not the baseline), move maintainer docs out of published package trees.
```

- [ ] **Step 6: Commit + Overall 收尾**

```bash
git add .changeset/ packages/osuperpowers/.agents/
git commit -m "chore: regenerate .agents/ derived files and add changeset for P3 doc/rule fixes"
```

随后更新 Overall spec Phase 清单 P3 行（Design spec / Implementation plan 列补链接与完成标记）+ 变更历史加一行：

```bash
git add docs/superpowers/specs/2026-08-21-dogfood-fixes-overall.md docs/superpowers/specs/2026-08-22-dogfood-fixes-p3-design.md docs/superpowers/plans/2026-08-22-dogfood-fixes-p3.md
git commit -m "docs: mark P3 design approved and plan complete in overall spec"
```

注：design spec Status 已在 Task 1 Step 0 翻译为 `Approved`。
