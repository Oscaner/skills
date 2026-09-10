# P6 report-issue 四案 — Implementation Plan

**Spec:** [2026-09-10-session-report-246-p6-design.md](docs/superpowers/specs/2026-09-10-session-report-246-p6-design.md)（v1.0）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 report-issue 落地 Session context 模型（root/workspace/channel/subject 纯函数派生）+ evidence 双向契约 + subject 化 master 标题 + master 只建不更（F2/F3/F4/F12），根除 standalone 误路由与 body 表镜像漂移。

**Architecture:** 三层改动——① canonical+renderer 层（`finding-meta.json#masterDef.title` → `<subject>`、删 `summaryTable`；`renderTitle` 改签 `{ subject, date }`、删 `renderSummaryTable`、`renderMasterBody({ kind, meta })` 删表）先行并测试锚定；② SKILL.md 流程层（新增 Session Context 权威定义节 + 重写 resolve-destination / ensure-session / append-comment / classify / confirm + I6 两向契约）消费 renderer 新契约；③ 批次收尾（README 复核、changeset、全量 validate）。工作区 root 规则与 cdd-engine `resolveWorkspace(doc)` 的 path-anchored 原则同族（#173）。

**Tech Stack:** Node ESM（`packages/osuperpowers/scripts/`）+ canonical JSON（`finding-meta.json`）+ vitest（`scripts/emit/issue-templates.test.mjs`）+ pnpm emit（`packages/osuperpowers/.agents/` 派生）+ changesets。

## Global Constraints

- `finding-meta.json` / `report-templates.mjs` / SKILL.md 是**单一事实源**（canonical→renderer→templates），改动后必须 `pnpm run emit` 再生 `.agents/` 镜像与 `.github/ISSUE_TEMPLATE/*.yml`；`emit:check` 漂移 = 违例。
- SKILL.md 为英文主源，**禁止中文内容**；spec/plan 中文不动。
- 每个 task 结束前 `pnpm run validate` 全绿 + conventional commit，无 attribution trailer。
- `renderTitle` 新契约 `renderTitle(masterDef, { subject, date })`：`subject` 非空（workspace slug 去 `YYYY-MM-DD-` 前缀，或 confirm 门确认的 topic），kind 词 `standalone` 永不作为 subject 传入。
- `renderMasterBody({ kind, meta })`：无 `findings` 参数、**无** `## Findings Summary` 段；body 只建不更（`gh issue edit` 不再出现于 report-issue 流程）。
- report-meta `kind` 三值（program/consumer-cdd/standalone）与 `report-target.json` cache schema 不变。
- vendored 子模块不可改；README 仅一行表（`| report-issue | Utility | Structured issue reporting |`）——已核无需变更，task 内再 grep 复核即可。

---

### Task 1: Renderer/canonical 迁移到 subject 契约（finding-meta.json + report-templates.mjs + tests）

<thinking>原子单元：canonical `masterDef.title` + renderer `renderTitle`/`renderMasterBody`/删 `renderSummaryTable` + `issue-templates.test.mjs` 三处测试同步，再加 emit 再生 finding-meta.json 的 `.agents` 镜像。canonical 与 renderer 必须同 commit（独立落地会让占位符无消费者替换而破坏输出）。</thinking>

**Files:**
- Modify: `packages/osuperpowers/skills/report-issue/templates/finding-meta.json`
- Modify: `packages/osuperpowers/scripts/report-templates.mjs`
- Modify: `scripts/emit/issue-templates.test.mjs`

**Interfaces:**
- Consumes: 现行 `renderTitle(masterDef, { slugOrStandalone, date })`、`renderSummaryTable`、`renderMasterBody({ kind, meta, findings })`（均为本仓库内部）
- Produces: `renderTitle(masterDef, { subject, date })` → `[Session report] <subject> <YYYY-MM-DD>`；`renderMasterBody({ kind, meta })` → Session 块 + 指针行 + Report meta；`masterDef.summaryTable` 整删。Task 2 的 SKILL.md 文本按此契约引用。

- [ ] **Step 1: 更新测试到新契约（先红）**

编辑 `scripts/emit/issue-templates.test.mjs`：

a) `renderTitle` 测试改为 `<subject>` 契约（Topic 与 slug 两条路径）：

```js
it("renderTitle 替换 <subject> 与 <YYYY-MM-DD>", () => {
  expect(
    renderTitle(
      { title: "[Session report] <subject> <YYYY-MM-DD>" },
      { subject: "cdd-engine-overhaul-p4", date: "2026-09-08" }
    )
  ).toBe("[Session report] cdd-engine-overhaul-p4 2026-09-08");
  expect(
    renderTitle(findingMeta.masterDef, { subject: "session workspace misrouting fix", date: "2026-09-08" })
  ).toBe("[Session report] session workspace misrouting fix 2026-09-08");
});
```

b) 新增 canonical 契约断言：

```js
it("masterDef 契约：subject 占位、无 summaryTable、无 <slug|standalone>", () => {
  expect(findingMeta.masterDef.title).toBe("[Session report] <subject> <YYYY-MM-DD>");
  expect(findingMeta.masterDef.title).not.toContain("<slug|standalone>");
  expect(findingMeta.masterDef).not.toHaveProperty("summaryTable");
});
```

c) **删除** `renderSummaryTable 表头 = #/Type/Component/Title` 整个 `it` 块（原 L62-77），并从顶部 import 中删 `renderSummaryTable`。

d) `renderMasterBody 结构常驻断言` 改：签名去 `findings`，断言含指针行且**不含** `## Findings Summary`：

```js
it("renderMasterBody 结构常驻断言（Session 块 + 指针行 + Report meta · 无 Findings Summary）", () => {
  const meta = {
    session: "cdd-engine-overhaul-p4",
    skill: "report-issue",
    harness: "claude-code",
    kind: "program",
    step: "review",
    cdd: "2026-09-08-cdd-engine-overhaul-p4",
    date: "2026-09-08",
  };
  const body = renderMasterBody({ kind: "program", meta });
  expect(body.startsWith(
    "## Session\n\n- Session: cdd-engine-overhaul-p4\n- Kind: program\n- Date: 2026-09-08"
  )).toBe(true);
  expect(body).toContain("_Findings are appended as comments below");
  expect(body).not.toContain("## Findings Summary");
  expect(body.endsWith(`## Report meta (auto)\n${renderMeta(meta)}`)).toBe(true);
  for (const field of ["Skill", "Harness", "Kind", "Step", "CDD", "Date"]) {
    expect(body).toContain(`- ${field}:`);
  }
});
```

e) `renderMasterBody meta.session 缺省回退 standalone` 改签名：

```js
const body = renderMasterBody({ kind: "standalone", meta });
```

- [ ] **Step 2: 跑测试验证红**

Run: `npx vitest run scripts/emit/issue-templates.test.mjs`
Expected: FAIL —— `renderTitle` 未处理 `<subject>`（旧占位替换 `<slug|standalone>` 失效）、`findingMeta.masterDef.summaryTable` 仍存在、"## Findings Summary" 仍渲染。

- [ ] **Step 3: 更新 canonical `finding-meta.json`**

编辑 `packages/osuperpowers/skills/report-issue/templates/finding-meta.json`，`masterDef` 块改为（删 `summaryTable` 键与其 `cols`/`placeholder`）：

```json
  "masterDef": {
    "title": "[Session report] <subject> <YYYY-MM-DD>"
  }
```

- [ ] **Step 4: 更新 renderer `report-templates.mjs`**

a) `renderTitle`（L90-94）改签：

```js
export function renderTitle(masterDef, { subject, date }) {
  return masterDef.title
    .replace("<subject>", subject)
    .replace("<YYYY-MM-DD>", date);
}
```

b) **删除** `renderSummaryTable`（L103-111 整函数）。

c) `renderMasterBody`（L127-135）删 `findings` 参数与 Findings Summary 段：

```js
export function renderMasterBody({ kind, meta }) {
  return [
    `## Session\n\n- Session: ${meta.session ?? "standalone"}\n- Kind: ${kind}\n- Date: ${meta.date}`,
    "_Findings are appended as comments below — this body is created once and not maintained._",
    `## Report meta (auto)\n${renderMeta(meta)}`,
  ].join("\n\n");
}
```

d) 核对文件头部注释（L1-8）：若未提及 summaryTable/Findings Summary 则不改；CLI 分支（L137-146）无 `findings` 依赖，保持。

- [ ] **Step 5: 跑测试验证绿**

Run: `npx vitest run scripts/emit/issue-templates.test.mjs`
Expected: PASS（9 个用例全过：renderTitle / masterDef 契约 / renderMeta / renderMasterBody ×2 / renderComment / yml 三件）。

- [ ] **Step 6: 渲染器清单清点 + emit + 全量 validate**

Run: `grep -rn 'renderSummaryTable\|summaryTable' packages/osuperpowers docs/maintainers/ 2>/dev/null | grep -v '.agents/'`
Expected: 仅剩 `docs/maintainers/data-driven-templates.md` L90 渲染器清单行命中（`... renderSummaryTable / renderComment ...`）；`.changeset/` 历史记录命中为预期保留。

同步更新 `docs/maintainers/data-driven-templates.md` L90 渲染器清单行，从 `(renderYml / renderTitle / renderMeta / renderSummaryTable / renderComment / renderMasterBody pure functions)` 改为 `(renderYml / renderTitle / renderMeta / renderComment / renderMasterBody pure functions)`。`.changeset/*.md` 历史记录不删。

Run: `pnpm run emit && pnpm run validate`
Expected: emit 再生 `packages/osuperpowers/.agents/skills/osuperpowers/report-issue/templates/finding-meta.json` 镜像（title 含 `<subject>`、无 summaryTable）；emit fresh；validate ALL PASS。

- [ ] **Step 7: Commit**

```bash
git add packages/osuperpowers/skills/report-issue/templates/finding-meta.json packages/osuperpowers/scripts/report-templates.mjs scripts/emit/issue-templates.test.mjs docs/maintainers/data-driven-templates.md packages/osuperpowers/.agents
git commit -m "feat(osuperpowers): report-issue renderer subject contract — renderTitle/renderMasterBody subject-based, drop Findings Summary table (F4/F12)"
```

---

### Task 2: report-issue SKILL.md —— Session Context 模型 + 节点重写 + I6 两向契约

<thinking>流程层改造：新增 Session Context 权威定义节，四节点重写（resolve-destination / ensure-session / append-comment / classify / confirm）+ Invariants I6/I7 + Failure Modes 删 PATCH 行。SKILL.md 为英文主源。validate 的 node/section 对齐检查（report-issue 每 mermaid 节点须有 ### section）是本次流程文本的结构守卫。</thinking>

**Files:**
- Modify: `packages/osuperpowers/skills/report-issue/SKILL.md`

**Interfaces:**
- Consumes: Task 1 的 renderer 契约（`renderTitle(masterDef, { subject, date })`、`renderMasterBody({ kind, meta })`）
- Produces: SKILL.md 新 Session Context 节 + 各节点重写文本；Task 3 仅需 changeset。

- [ ] **Step 1: 新增 `## Session Context` 权威定义节**

在 `## Node Definitions` 段之前插入（英文）：

```markdown
## Session Context (captured once at report start, pure-function downstream)

The snapshot of the session taken at the start of the flow (before `analyze`); every downstream node derives from this snapshot, never from the live cwd.

- **root**: git top-level of the harness launch cwd (`git rev-parse --show-toplevel`). Captured once at report start; never re-derived from the real-time cwd (`cd` during exploration does not change it).
- **workspace**: `.superpowers/cdd/<run-slug>/` of the current CDD run — present only when this session is a CDD run; a standalone run has no run slug and therefore no workspace. Cross-repo reuse is forbidden: the CDD run's workspace must resolve under `root`.
- **channel**: `program` when a workspace exists and the cached `report-target.json` (or the program chain) resolves a program target; otherwise `session`.
- **subject**: the master title subject — the workspace slug (run slug with the `YYYY-MM-DD-` prefix stripped, e.g. `cdd-engine-overhaul-p4`) for program/consumer-cdd; the confirm-confirmed topic for standalone (model-derived from the first finding, never empty; `standalone` is never used as subject).

Derivations (pure functions):
- master title = `renderTitle(masterDef, { subject, date })` → `[Session report] <subject> <YYYY-MM-DD>`
- cache (`report-target.json`) read/write admission: CDD runs only — a standalone run never reads or writes it
- report-meta `kind` = `program` | `consumer-cdd` | `standalone`, derived from channel × workspace (never an author-chosen input)
```

- [ ] **Step 2: 重写 `resolve-destination`**

替换现有节点 Do / Read / Exit 文本，改为基于 Session Context：

```markdown
### `resolve-destination`

- **Do**: Resolve the reporting channel for the confirmed findings from the Session Context ([§ Session Context](#session-context-captured-once-at-report-start-pure-function-downstream)).
  - **CDD run** (has run slug): locate the workspace by identity as `root/.superpowers/cdd/<run-slug>/` — never by scanning the live cwd. **Cache-first**: read `report-target.json` in that workspace. Hit `program` → reuse that issue number (never a new issue); hit `session` → reuse the existing master (date unchanged). On **cache miss**, resolve the program chain — `progress.json#plan` → plan-header `**Spec:**` → overall spec → the phase-owning issue of this program. Persist the resolved target back to the cache so subsequent findings in this session reuse it.
  - **Standalone run** (no run slug): no workspace, no cache read, no program chain — direct to the session channel (fail-open, never block).
- **Cache schema**: `.superpowers/cdd/<slug>/report-target.json` = `{ "kind": "program"|"consumer-cdd"|"standalone", "issue"?: <issue-number>, "slug": <workspace-slug>, "resolved_at": <ISO-date> }` — `issue` present only for the program channel.
- **Channel → kind mapping** (derivation for report-meta `kind`): program channel → `program`; session channel + CDD workspace slug present → `consumer-cdd`; session channel with no workspace (standalone) → `standalone`. Every finding comment and master body carries exactly this resolved `kind` (I7).
- **Read**: Session Context; `.superpowers/cdd/<run-slug>/report-target.json` (CDD runs only); `progress.json#plan`; plan-header spec chain; phase-owning issue number
- **Exit**: program → `dedup`; session → `ensure-session`
- **Fail**: program-chain resolution fails → session channel (fail-open, never block)
```

- [ ] **Step 3: 重写 `ensure-session`（只建不更，subject 标题）**

```markdown
### `ensure-session`

- **Do**: Find or create the session **master** issue. The master is **created once and never edited** — no body PATCH after creation; the comment thread on it is the authoritative findings aggregation.
  - **Find**: reuse the cached session target, or an existing master with this session's title.
  - **Create**: `gh issue create --repo Oscaner/skills` with labels `session`, `osuperpowers`. Title = `renderTitle(masterDef, { subject, date })` from the renderer module → `[Session report] <subject> <YYYY-MM-DD>`; `subject` = workspace slug (Session Context) for CDD runs, or the confirm-confirmed topic for standalone; `date` = creation day (reuse never changes it). Body = run `node "${pluginRoot}/scripts/report-templates.mjs" --mode master` on stdin JSON `{ kind, meta }` → Session metadata + a pointer line + `## Report meta (auto)` — no summary table; findings aggregate as comments on the master.
  - The master is the aggregation point: session-channel findings are appended as comments to it.
- **Read**: Session Context; report-target cache; renderer CLI
- **Exit**: master found or created → `dedup`
- **Fail**: master creation fails → degrade (prompt the user to create the master manually, then retry; keep findings)
```

- [ ] **Step 4: 重写 `append-comment`（session 分支删 PATCH）**

Session channel 子步骤替换为 comment-only：

```markdown
  - **Session channel**: `gh issue comment --repo Oscaner/skills <master>` — comment-only, append-only; the master body is created once at `ensure-session` and never PATCHed (`gh issue edit` is not used on the master after creation).
```

（该子步骤之后的原"再 PATCH master body / findings accumulated in this run / do not re-read comments — avoids a read-modify-write race"整句删除。）

- [ ] **Step 5: 重写 `classify`（evidence 双向契约）**

在 `classify` Do 的 evidence 描述后追加：

```markdown
  Evidence obeys the two-way **Evidence Contract** (I6): it must NOT carry consumer-identifiable data (branch names, absolute paths, filenames, process counts, RSS values, launch dirs, session habits) AND it must describe a maintainer-reproducible mechanism (trigger conditions, mechanism, expected behavior, reproduction steps — describe mechanism, not measurement). Findings failing either direction do not pass `confirm`.
```

- [ ] **Step 6: 重写 `confirm`（I6 升级 + standalone 推荐 topic）**

Do 文本追加 standalone topic 展示：

```markdown
  For standalone sessions, also present the **recommended subject topic** — a model-derived short phrase from the first finding (type/component labels stripped, ≤ 60 chars) — which the user may confirm or replace. Do **not** pre-create or pre-comment on any gh issue before explicit confirmation.
```

- [ ] **Step 7: 更新 Invariants + Failure Modes**

Invariants 表 `I6` 改为两向契约、`I7` 加派生注记：

```markdown
| I6 | **Evidence Contract** — findings never carry consumer-identifiable data (branch names, absolute paths, filenames, process counts, RSS values, launch dirs, session habits) — such context enters only on consumer opt-in at `confirm` — AND findings always describe a maintainer-reproducible mechanism (trigger conditions / mechanism / expected behavior / reproduction steps; describe mechanism, not measurement) |
| I7 | **Kind Enumerated** — every finding's report-meta `kind` is exactly one of `program` / `consumer-cdd` / `standalone`, derived from channel × workspace (Session Context), never an author-chosen input |
```

Failure Modes 表**删除**一行：`| Master Summary PATCH fails | fail-open (report stderr) | gh issue edit transient failure | findings remain as comments; sync the Summary manually |`（不再有 body PATCH）。

- [ ] **Step 8: 残留清点 + emit + 全量 validate**

Run: `grep -rn 'slugOrStandalone\|Findings Summary\|findings accumulated\|read-modify-write\|gh issue edit' packages/osuperpowers/skills/report-issue/SKILL.md`
Expected: 0 命中（`Findings Summary` 零残留；`gh issue edit` 不再出现）。随后 `grep -rn -i 'report-issue\|findings summary' packages/osuperpowers/README.md` → 仅 `| report-issue | Utility | Structured issue reporting |`（README 无需变更）。

Run: `pnpm run emit && pnpm run validate`
Expected: emit 再生 `.agents` SKILL 镜像；validate ALL PASS（含 report-issue node/section 对齐、rule-reference 语义锚点）。

- [ ] **Step 9: Commit**

```bash
git add packages/osuperpowers/skills/report-issue/SKILL.md packages/osuperpowers/.agents
git commit -m "feat(osuperpowers): report-issue session context model — root/workspace/channel/subject + two-way evidence contract (F2/F3/F4)"
```

（若 Step 8 的 README grep 意外发现旧描述，随本 commit 一并修 README 英文文本。）

---

### Task 3: 批次收尾 —— changeset + 全量 validate

<thinking>P6 特性作为一个 changeset 落盘（before final commit，CLAUDE.md 惯例）。手动写 `.changeset/<slug>.md`（避免交互式 CLI）。</thinking>

**Files:**
- Create: `.changeset/<slug>.md`（slug 如 `tame-sessions-report.md`，追加随机段）

**Interfaces:**
- Consumes: Task 1 + Task 2 全部产物
- Produces: 可发布 changeset；`pnpm run validate` 全绿

- [ ] **Step 1: 写 changeset**

创建 `.changeset/<slug>.md`：

```markdown
---
'@oscaner-skills/osuperpowers': minor
---

report-issue: session context model（root/workspace/channel/subject 纯函数派生，standalone 不再误路由到程序 issue）+ evidence 双向契约（consumer-neutral + maintainer-reproducible）+ master 标题 subject 化（standalone 带 topic，kind 词不入标题）+ master 只建不更（废除 Findings Summary 表镜像）—— closes #246 F2/F3/F4/F12
```

- [ ] **Step 2: 全量 validate**

Run: `pnpm run validate`
Expected: ALL PASS（12 块全绿：emit fresh、plugin resolution、skill dirs、rule-reference、engine vitest、version sync）。

- [ ] **Step 3: Commit**

```bash
git add .changeset
git commit -m "chore(osuperpowers): P6 changeset — report-issue session context + evidence contract + subject title + master create-only"
```