# P4 overall 四表一致性机械守卫 + 程序文档收敛 — Implementation Plan

**Spec:** [2026-09-10-session-report-246-p4-design.md](docs/superpowers/specs/2026-09-10-session-report-246-p4-design.md)（v1.0：canonical 7 列头专属守卫 + 回填声明↔列双向 shipped 判定 + 声明式 issue 注册域（锚点形式唯一机器可判）+ slug 后缀 glob（跨日期 phase 文档）+ 非 canonical 全文件 skip；登记规则 5 站收敛 1 SSoT + CDD 死档清除 + engine 健壮性 hardening）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 `scripts/validate/overall-consistency.mjs` 机械守卫（检查 ① 回填声明↔列双向 / ② 文档存在性 / ③ 版本升序 / ④ 交叉引用），使 overall 四表成为可机械验证的状态权威（F6/F13），零误报现有 shipped 程序；同时收敛登记规则到 add-phase-protocol 唯一 SSoT、清除 CDD 死档、补 engine 健壮性 hardening。

**Architecture:** 七任务顺序——① parser 核心 + 表 well-formedness 检查（③/④b/④c）+ fixture；② 语义一致性检查（① claims 引擎 + ② 文档存在 slug glob + ④a 锚点注册域）+ 真实 overall 实证绿；③ validate 块集成（index.mjs step + 计数 ×3 + ci-validate 断言）；④ 登记规则 5 站收敛（add-phase-protocol §注册域 SSoT + template/SKILL.md 委托 + session-246 自身段落委托 v1.14）；⑤ CDD 死档清除（删 2 档 + handoff-schema 修剪 + 3 处 engine 注释 cite 同步）；⑥ engine 健壮性 hardening（run-docs handoff 读 try/catch → BLOCKED + review-gate corrupt prev → null + docs-runner 测试）；⑦ changeset（osuperpowers minor + cdd-engine patch）+ emit + 全量 validate + overall v1.14 记账。模块触碰纪律：每文件只动一次（Task 4/7 的 emit 在末态统一跑）。

**Tech Stack:** Node ESM + vitest（`scripts/**/*.test.mjs`）+ valid rulesets（repo validate 12→13 block）+ changesets。

## Global Constraints

- **守卫面**（spec §2.2 Q1）：仅 canonical 7 列头（头行含 `#|Phase` 与 `Implementation plan`）的 overall 被守；非 canonical 头 → `CDD_INFO: skip <file> (non-canonical phase inventory header)` 日志 + continue（不 exit）。无 `*-overall.md` → OK-SKIP。
- **shipped 判定**（spec §2.2 Q2）：**回填声明 ↔ Phase inventory 列双向**——plan-claim（行含 plan 词 + `Pending\s*→` 目标非 Pending，**括号可选**：`（[Pending]→Done）` 与 `Pending → Done` 同构）+ 区间展开（`P1–P4/P6` → 端点含边界）；正向 claim → 列匹配；**反向仅 plan 列**（列 shipped 而无 claim → FAIL）；**design 无反向**（cdd P3 实证否决）。
- **issue 引用语义**（spec §2.2 Q3）：`#NNN#issuecomment-\d+` 锚点 = 唯一机器可判引用形式（④a 只扫锚点）；纯 `#NNN` 不扫（AC/PR/legacy 歧义，文档化边界）；Issue inventory block 全 token 集 = 注册域。
- **token 边界**（spec-review nit10）：phase token `P\d+(?![0-9])[a-z]?`——数字边界防 P10 前缀误匹配 P1。
- **文档派生**（spec §2.2 BLOCKER 修复）：slug = overall 文件名去前导日期 + `-overall.md`；plan/design 用后缀 glob `*-(slug)-p<n>{,-design}.md`（支持跨日期 phase 文档，cdd p2→`2026-09-05-…`）；design 派生**仅取该 phase 自身 `P<n>-design` token**（cell 内其他 `P\d+-design` = 跨引用不入 glob，cdd P4 实证）；glob >1 → FAIL。
- **④ 反向取舍**：plan 列反向做（两 canonical 程序全 phase 成立）；design 列反向不做。
- **engine 功能改动仅两处**（spec §2.6.7）：`run-docs.mjs` handoff 读包 try/catch → writeBlocked；`review.mjs existingRoundHandoff` 包 try/catch → null。其余 engine 仅 3 处注释 cite 同步（§2.6.5）。
- **validate 计数**：12→13 块同步（`index.mjs` 注释×2、`run.mjs` 注释+commander desc、CLAUDE.md）。
- vendored 子模块不可改；skills/docs 改动（Task 4/5）后**必须** `pnpm run emit`（Task 7 统一跑）+ `emit:check` 绿；specs/plans 属 Strategy B（中文）不触发 emit。
- conventional commit 无 attribution trailer；每任务结束前 `pnpm run validate` 全绿；changeset `@oscaner-skills/osuperpowers` minor + `@oscaner-skills/cdd-engine` patch。

---

### Task 1: overall-consistency parser 核心 + 表 well-formedness 检查（③/④b/④c）

<thinking>原子单元：新模块 `scripts/validate/overall-consistency.mjs`——canonical 头门 + 四表 parse（phase inventory / issue inventory / dependency graph / change history）+ 检查 ③ 版本升序、④b dependency 成员、④c 列 well-formed + 非 canonical skip。导出 steps 供 index.mjs 组合（Task 3）+ 独立可运行。fixture 置 `scripts/validate/fixtures/overall-consistency/{specs,plans}/`。</thinking>

**Files:**
- Create: `scripts/validate/overall-consistency.mjs`
- Create: `scripts/validate/overall-consistency.test.mjs`
- Create: `scripts/validate/fixtures/overall-consistency/specs/clean-canonic-overall.md`
- Create: `scripts/validate/fixtures/overall-consistency/specs/drift-descending-overall.md`
- Create: `scripts/validate/fixtures/overall-consistency/specs/drift-dup-version-overall.md`（两行同版本号，③ 重复检测载体）
- Create: `scripts/validate/fixtures/overall-consistency/specs/drift-malformed-overall.md`（表损坏，§2.4 malformed skip 载体）
- Create: `scripts/validate/fixtures/overall-consistency/specs/drift-badref-overall.md`
- Create: `scripts/validate/fixtures/overall-consistency/specs/drift-graphdangling-overall.md`
- Create: `scripts/validate/fixtures/overall-consistency/specs/legacy-format-overall.md`

**Interfaces:**
- Consumes: `runner.mjs`（`runIfMain`）
- Produces:
  - `loadOverallFile(filePath) → { ok, reason?, slug, canonical, phases, issues, graphTokens, historyRows }`——**恒返回 `ok`**：parse 失败/表不可识别 → `{ ok: false, reason }`（§2.4 malformed skip 输入）；`canonical=false` → 调用方 skip；`phases: [{ id, design, plan, dependency }]`（dependency = canonical 第 7 列 cell —— **④b dependency 列分支的数据源**）；`issues: [{phase, ref}]`；`graphTokens: string[]`（dep graph block 的 `P\d+` token）；`historyRows: [{version:[maj,min], date, summary}]`
  - `checkVersionAscending(historyRows) → void`（throw on violation：降序 / **重复版本** / version·date 空）
  - `checkIssueRefsWellFormed(issues, phaseIds) → void`
  - `checkDepGraphMembership(graphTokens, phaseIds, phases) → void`
  - `main() → 0|1`（独立运行 + steps 内 run）

- [ ] **Step 1: 写 failing 测试（canonical 门 + 解析 + 三检查）**

`overall-consistency.test.mjs`：

```js
import { describe, it, expect } from "vitest";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadOverallFile, checkVersionAscending, checkIssueRefsWellFormed, checkDepGraphMembership } from "./overall-consistency.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, "fixtures", "overall-consistency", "specs");

const clean = () => loadOverallFile(join(FIX, "clean-canonic-overall.md"));

it("canonical 头 → canonical=true + phases 解析（id/design/plan 三列）", () => {
  const o = clean();
  expect(o.canonical).toBe(true);
  expect(o.phases.map(p => p.id)).toEqual(["P1", "P2"]);
  // design 列/plan 列原文保留（含 [Pending]）
});
it("Version: vX.Y + 升序（v1.0→v1.1→v1.2）→ 通过", () => {
  const o = clean();
  expect(() => checkVersionAscending(o.historyRows)).not.toThrow();
});
it("升序破坏（v1.1 后 v1.0）→ throw", () => {
  const o = loadOverallFile(join(FIX, "drift-descending-overall.md"));
  expect(() => checkVersionAscending(o.historyRows)).toThrow(/ascending|version/i);
});
it("版本重复（两行 v1.1）→ throw（③ 重复检测）", () => {
  const o = loadOverallFile(join(FIX, "drift-dup-version-overall.md"));
  expect(() => checkVersionAscending(o.historyRows)).toThrow(/duplicate|repeat|version/i);
});
it("表损坏 → loadOverallFile 返回 ok=false（§2.4 malformed skip，main 不 exit）", () => {
  const o = loadOverallFile(join(FIX, "drift-malformed-overall.md"));
  expect(o.ok).toBe(false);
});
it("graph 引用 P9（inventory 无）→ throw（④b）", () => {
  const o = loadOverallFile(join(FIX, "drift-graphdangling-overall.md"));
  expect(() => checkDepGraphMembership(o.graphTokens, o.phases.map(p=>p.id), o.phases)).toThrow(/P9/i);
});
it("issue ref 畸形（#246#issuecomment-abc）→ throw（④c）", () => {
  const o = loadOverallFile(join(FIX, "drift-badref-overall.md"));
  expect(() => checkIssueRefsWellFormed(o.issues, o.phases.map(p=>p.id))).toThrow(/.+/);
});
it("非 canonical 头 → canonical=false（不 throw）", () => {
  const o = loadOverallFile(join(FIX, "legacy-format-overall.md"));
  expect(o.canonical).toBe(false);
});
it("④c 宽松：`#246（session master body）` + `none` 行放行", () => {
  const o = clean(); // fixture 内含这两种形态
  expect(() => checkIssueRefsWellFormed(o.issues, o.phases.map(p=>p.id))).not.toThrow();
});
```

- [ ] **Step 2: 跑测试确认全 FAIL（模块不存在/函数未定义）**

运行：`npx vitest run scripts/validate/overall-consistency.test.mjs`
预期：FAIL（ERR_MODULE_NOT_FOUND）

- [ ] **Step 3: 实现 parser + 三检查**

`overall-consistency.mjs`（骨架）：

```js
#!/usr/bin/env node
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { runIfMain } from "./runner.mjs";

const SPECS_GLOB = join(process.cwd(), "docs", "superpowers", "specs", "*-overall.md");
const HEADER_RE = /^\|\s*#\s*\|\s*Phase\s*\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|\s*$/; // 见 Step 4 精确化

export function loadOverallFile(filePath) {
  const raw = readFileSync(filePath, "utf8");
  const lines = raw.split("\n");
  const headerIdx = lines.findIndex((l) => /^\|\s*#\s*\|\s*Phase\s*\|/.test(l));
  if (headerIdx === -1) return { ok: false, canonical: false, reason: "no phase inventory header" };
  const header = lines[headerIdx];
  if (!/Implementation plan\b/.test(header)) {
    // 头不含 `Implementation plan` 列名 → 非 canonical
    return { ok: true, canonical: false, reason: "non-canonical header (no Implementation plan col)" };
  }
  // phase rows `| P<N> | scope | design | plan | acceptance | dependency |`（split 0-based：id=c[1], scope=c[2], design=c[4], plan=c[5], dependency=c[7]）
  const phases = [];
  let i = headerIdx + 1;
  for (; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.startsWith("| P") && t.endsWith("|")) {
      const c = t.split("|").map(s => s.trim());
      const id = c[1];
      if (/^P\d+(?!\d)/.test(id) && c.length >= 8)
        phases.push({ id, design: c[4], plan: c[5], dependency: c[7] });
      else if (c.length >= 8) phases.push({ id, design: c[4], plan: c[5], dependency: c[7] }); // Pα 等非数字（容忍）
    } else if (t.startsWith("## ")) break;
  }
  // issue inventory：`## Issue inventory` 到下一个 `##` 的 table rows（split：phase=c[1], ref=c[2]）
  // dependency graph：`## Dependency graph (ASCII)` 到下一个 ``` 的 code block，`P\d+` token
  // change history：`## Change history` 到 EOF 的 `| vX.Y | date | summary | author |` rows
  // …(实现见 plan-review 后补充精确索引)
  return { ok: true, canonical: true, slug: fileNameSlug(filePath), phases, issues, graphTokens, historyRows };
}

// ③ 严格升序 + 无重复 + version/date 非空
export function checkVersionAscending(rows) { /* v<M>.<m> tuple compare; dup → throw */ }
// ④c issue ref 宽松（以 #\d+ 起始 或 含 #issuecomment-\d+ 或 none/( 文本）；phase 列 ∈ phaseIds
export function checkIssueRefsWellFormed(issues, phaseIds) { /* … */ }
// ④b graph token + dependency 列前驱 ∈ phaseIds
export function checkDepGraphMembership(graphTokens, phaseIds, phases) { /* … */ }

export const steps = [{ name: "12. overall consistency", run: main }];
runIfMain(import.meta.url, steps);
```

> 注：Step 3 代码为骨架，精确 parse 索引（issue inventory / dep graph / change history block 定位）按 fixture 内容在实现当轮定稿；函数签名与 throw 语义以 Step 1 测试为准。

- [ ] **Step 4: 跑测试确认 PASS**

运行：`npx vitest run scripts/validate/overall-consistency.test.mjs`
预期：全 PASS（clean 三检查绿、drift 三 fixture throw、legacy skip、宽松 ④c 放行）

- [ ] **Step 5: Commit**

```bash
git add scripts/validate/overall-consistency.mjs scripts/validate/overall-consistency.test.mjs scripts/validate/fixtures/
git commit -m "feat(validate): overall-consistency parser core + table well-formedness checks (③ ④b ④c)"
```

---

### Task 2: 语义一致性检查（① claims 引擎 + ② 文档存在 slug glob + ④a 锚点注册域）+ 真实 overall 实证

<thinking>原子单元：Task 1 parser 之上加三组语义检查——① 回填声明↔列双向（plan-claim 括号可选 + 区间展开 + design-claim 正向 + plan 反向）；② 文档存在性（slug 后缀 glob + design 仅自身 token）；④a 锚点注册域（扫 overall + 本程序 phase 文档）。fixture 补齐语义漂移用例 + 三真实 overall 实证绿（cdd-overhaul/session-246 pass、post-dogfood skip）。</thinking>

**Files:**
- Modify: `scripts/validate/overall-consistency.mjs`（增 `checkBackfillClaims` / `checkDocExistence` / `checkAnchorRegistry` + main 串联）
- Modify: `scripts/validate/overall-consistency.test.mjs`（语义用例）
- Create: `scripts/validate/fixtures/overall-consistency/specs/drift-claimvs-pending-overall.md`
- Create: `scripts/validate/fixtures/overall-consistency/specs/drift-missingdoc-overall.md`
- Create: `scripts/validate/fixtures/overall-consistency/specs/drift-anchor-unregistered-overall.md`
- Create: `scripts/validate/fixtures/overall-consistency/specs/drift-anchor-unregistered-p1.md`（phase 文档，含未注册 issue 锚点示例——fixture 内字形见 Step 1 用例，此处不写全锚点字形以免被 ④a 守卫自扫描误判）
- Create: `scripts/validate/fixtures/overall-consistency/specs/drift-designclaim-fail-overall.md`
- Create: `scripts/validate/fixtures/overall-consistency/specs/drift-noclaim-done-overall.md`
- Create: `scripts/validate/fixtures/overall-consistency/specs/span-mixed-overall.md`（date 2026-09-05）
- Create: `scripts/validate/fixtures/overall-consistency/plans/2026-09-07-span-mixed-p2.md`（**跨日期**：p2 plan 文档日期 2026-09-07 ≠ overall 日期，BLOCKER 回归门载体）
- Create: `scripts/validate/fixtures/overall-consistency/specs/2026-09-07-span-mixed-p2-design.md`（含 design 跨引用形态 `P2-design（…，源 P3-design…）`）

**Interfaces:**
- Consumes: `loadOverallFile`（Task 1）+ `resolveWorkspaceFromSlug(slug)` 派生路径
- Produces:
  - `extractClaimRows(historyRows) → { planClaims: Map<phaseId, target>, designClaims: Map<phaseId, target> }`——区间展开 `P1–P4/P6` 含端点；plan 词 + `Pending\s*→` 目标非 Pending（括号可选）；design 词 `Design[- ]spec` + 同
  - `checkBackfillClaims(phases, historyRows) → void`（正向 claim→列 + 反向仅 plan）
  - `checkDocExistence(phases, slug, specsRoot, plansRoot) → void`（glob `*-(slug)-p<n>{,-design}.md`；design 仅提取自身 `P<n>-design` token；glob>1 → throw）
  - `checkAnchorRegistry(issues, scanFiles) → void`（`#(\d+)#issuecomment-\d+` 的 issue ∈ issue-inventory token 集）
  - `main()` 增语义检查链 + malformed 分支（§2.4 第 4 行：loadOverallFile 读异常 → `CDD_INFO: malformed <file> — skipped` + continue，不 exit）

- [ ] **Step 1: 写 failing 测试**

```js
import { checkBackfillClaims, checkDocExistence, checkAnchorRegistry, loadOverallFile } from "./overall-consistency.mjs";
const FIX = join(HERE, "fixtures", "overall-consistency");

it("①正向：plan-claim 列 [Pending] → throw", () => {
  const o = loadOverallFile(join(FIX, "specs", "drift-claimvs-pending-overall.md"));
  expect(() => checkBackfillClaims(o.phases, o.historyRows)).toThrow(/P1/);
});
it("①括号可选：`Implementation plan Pending → Done` 实为 claim → 列 Done 通过（无 claim 报错）", () => {
  const o = loadOverallFile(join(FIX, "specs", "span-mixed-overall.md"));
  expect(() => checkBackfillClaims(o.phases, o.historyRows)).not.toThrow();
});
it("①区间展开：P1–P4/P6 声明 → P1..P4+P6 全列 Done 断言", () => {
  const o = loadOverallFile(join(FIX, "specs", "span-mixed-overall.md"));
  expect(() => checkBackfillClaims(o.phases, o.historyRows)).not.toThrow();
});
it("①design-claim 列 [Pending] → throw（指定 §2.5 item 8）", () => {
  const o = loadOverallFile(join(FIX, "specs", "drift-designclaim-fail-overall.md"));
  expect(() => checkBackfillClaims(o.phases, o.historyRows)).toThrow(/P\d+/);
});
it("①反向：plan 列 Done 但全史无 plan-claim → throw", () => {
  const o = loadOverallFile(join(FIX, "specs", "drift-noclaim-done-overall.md"));
  expect(() => checkBackfillClaims(o.phases, o.historyRows)).toThrow(/claim/i);
});
it("②文档存在：slug glob 命中跨日期文档（overall 2026-09-05 → p2 2026-09-07）→ 通过", () => {
  const o = loadOverallFile(join(FIX, "specs", "span-mixed-overall.md"));
  expect(o.slug).toBe("span-mixed");
  expect(() => checkDocExistence(o.phases, o.slug, join(FIX, "specs"), join(FIX, "plans"))).not.toThrow();
  const miss = loadOverallFile(join(FIX, "specs", "drift-missingdoc-overall.md"));
  expect(() => checkDocExistence(miss.phases, miss.slug, join(FIX, "specs"), join(FIX, "plans"))).toThrow(/plan/i);
});
it("②design 跨引用忽略：P2 列含 `（源 P3-design）` 只断言 p2 design 文档", () => {
  const o = loadOverallFile(join(FIX, "specs", "span-mixed-overall.md"));
  expect(() => checkDocExistence(o.phases, o.slug, join(FIX, "specs"), join(FIX, "plans"))).not.toThrow();
});
it("④a：phase 文档锚点 #999#issuecomment-… 不在注册域 → throw", () => {
  const o = loadOverallFile(join(FIX, "specs", "drift-anchor-unregistered-overall.md"));
  const scan = [
    join(FIX, "specs", "drift-anchor-unregistered-overall.md"),
    join(FIX, "specs", "drift-anchor-unregistered-p1.md"),
  ];
  expect(() => checkAnchorRegistry(o.issues, scan)).toThrow(/999/);
});
```

> 注：`drift-dup-version-overall.md`（两行同版本）与 `drift-malformed-overall.md`（表损坏）的 `.toThrow()` 用例在 Task 1 Step 1 补（③ 重复版本 + §2.4 malformed skip——main() 对 malformed 为「日志 skip 不 exit」，loadOverallFile 单测断言其返回 `{ ok: false, reason }` 或不 throw 的容错形态）。

- [ ] **Step 2: 跑测试确认 FAIL**

运行：`npx vitest run scripts/validate/overall-consistency.test.mjs`
预期：语义用例 FAIL（`checkBackfillClaims` 等未定义）

- [ ] **Step 3: 实现语义检查**

执行 `checkEnrichClaims` 规则：

```js
// plan-claim：plan 词 `plan|计划|Implementation plan` + `Pending\s*→` 目标非 Pending（括号可选）
const PLAN_CLAIM_RE = /(?=.*(?:plan|计划))(Pending|\[Pending\])\s*→\s*[^\s\]]+/i;
// design-claim：Design[- ]spec 词 + 同
const DESIGN_CLAIM_RE = /(?=.*(?:Design[-\s]?spec))(Pending|\[Pending\])\s*→\s*[^\s\]]+/i;
// token 边界 + 区间展开（含端点，`[–—-]` 分隔，`/` 分隔段）
```

`checkDocExistence`：

```js
// plan 列非 [Pending] → plansRoot 下 glob '*' + '-' + slug + '-p' + id.toLowerCase() + '.md'
//   （后缀 glob：过滤 readdirSync(plansRoot) 中 endsWith('-'+slug+'-p'+n+'.md')）
// design 列：提取 `P<n>-design`（以 phase id 数字为锚）→ specsRoot 同法；>1 hit → throw
```

`checkAnchorRegistry`：

```js
// universe = issues 表（loadOverallFile 输出的 issue inventory rows 文本）全 `#\d+` token
// scanFiles.forEach: `#(\d+)#issuecomment-\d+` → miss if !universe.has(n)
```

`main()` 串联（canonical 才跑）：`checkVersionAscending → checkIssueRefsWellFormed → checkDepGraphMembership → checkBackfillClaims → checkDocExistence → checkAnchorRegistry（scan 面含 overall + `docs/superpowers/{specs,plans}/*-(slug)-p*.md`）`。

- [ ] **Step 4: 跑测试 + 三真实 overall 实证**

运行：`npx vitest run scripts/validate/overall-consistency.test.mjs`
再：`node -e "import('./scripts/validate/overall-consistency.mjs').then(m=>m.main())"`
预期：全部 fixture 语义用例 PASS + 真实 `cdd-engine-overhaul` / `session-report-246` pass（零误报）+ `post-dogfood` `CDD_INFO: skip` 日志且 exit 0

- [ ] **Step 5: Commit**

```bash
git add scripts/validate/overall-consistency.mjs scripts/validate/overall-consistency.test.mjs scripts/validate/fixtures/
git commit -m "feat(validate): overall-consistency semantic checks — backfill claims, doc existence, anchor registry + real-overall green"
```

---

### Task 3: validate 块集成（index.mjs step + 计数 ×3 + ci-validate 断言）

<thinking>原子单元：把 `overall-consistency` blocks 追加进 `scripts/validate/index.mjs`；12→13 块计数同步（index.mjs 注释×2、run.mjs 注释+commander desc、CLAUDE.md）；ci-validate.test.mjs 增「12. overall consistency 步骤存在」接线断言。无 fixture 新增。</thinking>

**Files:**
- Modify: `scripts/validate/index.mjs`（import + spread 追加 + 注释 12→13）
- Modify: `scripts/run.mjs`（注释 + commander desc「12 blocks」→「13 blocks」）
- Modify: `CLAUDE.md`（「12 validation blocks」→「13」；CI 描述列表 + overall consistency）
- Modify: `packages/osuperpowers/tests/ci-validate.test.mjs`（增 step 存在断言）

**Interfaces:**
- Consumes: `overall-consistency.mjs` 的 `steps`（Task 1/2）
- Produces: 13-block suite（`pnpm run validate` 含新块）

- [ ] **Step 1: index.mjs 接线**

`scripts/validate/index.mjs`：

```js
import { steps as overallConsistencySteps } from "./overall-consistency.mjs";
// …steps 数组尾部
  ...versionSyncSteps,
  ...submoduleSteps,
  ...overallConsistencySteps,   // <— 新增（submodule 后，块序 12）
```

同步注释：「12」→「13」（两处）。

- [ ] **Step 2: 计数同步**

`scripts/run.mjs` L10/L48：「12-block validate suite」→「13-block validate suite」。
`CLAUDE.md` L42：「12 validation blocks: …」→「13 validation blocks: …, overall consistency」。

- [ ] **Step 3: ci-validate 接线断言**

`packages/osuperpowers/tests/ci-validate.test.mjs` 追加：

```js
test("12. overall consistency step present", () => {
  assert.ok(steps.some((s) => s.name === "12. overall consistency"), "overall consistency step missing");
});
```

- [ ] **Step 4: 全量 validate**

运行：`pnpm run validate`
预期：13 块 ALL PASS（新块 12. overall consistency 对真实整体绿）

- [ ] **Step 5: Commit**

```bash
git add scripts/validate/index.mjs scripts/run.mjs CLAUDE.md packages/osuperpowers/tests/ci-validate.test.mjs
git commit -m "feat(validate): wire overall-consistency as block 12 (12→13 validate blocks)"
```

---

### Task 4: 登记规则收敛（add-phase-protocol §注册域 SSoT + template/SKILL.md 委托 + session-246 段落委托）

<thinking>原子单元：登记规则 5 站 → 1 SSoT。「add-phase-protocol.md」增 §注册域（锚点语法定级 + 3 触发场景继承 + 注册纪律）；overall-spec-template §Update-trigger/§Missed-update 删除改委托；SKILL.md commit-spec + sync-overall 委托；session-246 overall 自身段落委托（随 v1.14 bump）。</thinking>

**Files:**
- Modify: `packages/osuperpowers/skills/brainstorming/docs/add-phase-protocol.md`（§注册域）
- Modify: `packages/osuperpowers/skills/brainstorming/docs/overall-spec-template.md`（两段落 → 委托）
- Modify: `packages/osuperpowers/skills/brainstorming/SKILL.md`（commit-spec 清单 + sync-overall 节点委托）
- Modify: `docs/superpowers/specs/2026-09-10-session-report-246-overall.md`（v1.14：自身段落委托 + change-history）

**Interfaces:**
- Consumes: 无（纯文档）
- Produces: add-phase-protocol §注册域（canonical 引用形式 + 注册纪律 + 3 触发场景）；template/SKILL.md 委托引用

- [ ] **Step 1: add-phase-protocol §注册域**

新增小节（置于 §1 四表同步清单后）：

```markdown
## 1.5 Issue 引用语法定级（注册域）

机械守卫（`scripts/validate/overall-consistency.mjs`）只扫**锚点形式**的 issue 引用：
- **锚点形式 `#NNN#issuecomment-<digits>`** = canonical 机器可判引用——任何文档（overall / phase spec / plan）出现锚点时，`#NNN` 必须已注册在 Issue inventory（新 issue 必注册，否则 validate exit 1）。
- **纯 `#NNN`** = 歧义 token（AC 编号 / PR 编号 / legacy 引用共用 `#`），机械无法分拣——不做 membership 强制，人工把握。
- **Issue inventory = 注册域**：程序涉及的所有 issue（owned finding + related/follow-up + pre-consume + re-assign 落点）都应出现在该表。
- **3 触发场景**（继承 overall-spec-template 语义）：① phase 执行期新发现 → 声明归属 + 加行；② pre-consume → 加行 + 标 pre-consumed + 注明实际修复 phase；③ re-assign → 更新 Phase 列。
```

- [ ] **Step 2: overall-spec-template 委托**

§Update trigger conditions 与 §Missed-update detection 两个独立段落删除，替换为一行：

```markdown
Issue 注册域语义（新发现 / pre-consume / re-assign 触发 + 锚点语法定级）见 [add-phase-protocol.md](./add-phase-protocol.md) §1.5。
```

- [ ] **Step 3: SKILL.md 委托**

`commit-spec` 节点 4-table 清单 Issue inventory 行 → 改委托。**`sync-overall` 节点：只委托 ① Issue inventory 行 + consistency check 中的 `#NNN` 注册断言**（spec §2.6 #5：「与 #4 同构 → 委托」指注册语义；② Phase inventory 行 / ③ Dependency graph / ④ change-history **保留本地**——结构语义非注册域内容）。检查无残留重复表述（grep `Issue inventory|#NNN` 处逐点核对：委托目标是注册/断言语义，结构性行不动）。

- [ ] **Step 4: session-246 overall 段落委托 + v1.14**

`2026-09-10-session-report-246-overall.md`：§Update trigger conditions / §Missed-update detection 段落（L64-69）改为委托 add-phase-protocol §1.5（删除「P4 机械守卫落地前由人工检测把握」过期措辞）；version v1.13→v1.14 + change-history 追加 v1.14 行（登记规则收敛 + 自身段落委托）。

- [ ] **Step 5: 自检 + verify**

grep 四站残留：`grep -n "Missed-update\|Update trigger" packages/osuperpowers/skills/brainstorming/` → 仅保留 add-phase-protocol（SSoT）+ overall 委托行。`pnpm run emit:check` 绿（emit 生效在 Task 7）。

- [ ] **Step 6: Commit**

```bash
git add packages/osuperpowers/skills/brainstorming/ docs/superpowers/specs/2026-09-10-session-report-246-overall.md
git commit -m "docs(brainstorming): registration-rule convergence — add-phase-protocol §1.5 sole SSoT + template/SKILL delegation (overall v1.14)"
```

---

### Task 5: CDD 死档清除（删 cdd-reference/controller-handoff + handoff-schema 修剪 + 3 处 engine 注释 cite）

<thinking>原子单元：删除 0-live-引用死档（cdd-reference.md / controller-handoff.md）；handoff-schema.md 修剪到当前 reality；3 处 engine 注释 cite 同步。无功能代码变更。</thinking>

**Files:**
- Delete: `packages/osuperpowers/skills/cli-driven-development/docs/cdd-reference.md`
- Delete: `packages/osuperpowers/skills/cli-driven-development/docs/controller-handoff.md`
- Modify: `packages/osuperpowers/skills/cli-driven-development/docs/handoff-schema.md`（修剪）
- Modify: `packages/cdd-engine/lib/handoff/write.mjs`（L2/L22 注释 cite 增 handoff-namespace.json）
- Modify: `packages/cdd-engine/tests/contract.test.mjs`（L10 注释 cite 同步）

**Interfaces:**
- Consumes: engine 现状事实（P6 后命名/workspace canonical）
- Produces: `handoff-schema.md` 当前 reality 版；无 engine 功能变更

- [ ] **Step 1: 删两死档**

```bash
git rm packages/osuperpowers/skills/cli-driven-development/docs/cdd-reference.md \
       packages/osuperpowers/skills/cli-driven-development/docs/controller-handoff.md
```

- [ ] **Step 2: handoff-schema.md 修剪**

- 引言行（L1/L3）：去 `[controller-handoff.md](controller-handoff.md)` cite（已删）
- 模板链 `../templates/{implement,task-review,fix}.md` → `packages/cdd-engine/templates/`（task/ review/ schema/）
- 删 batch `tasks[]` 段（engine 无 batch 产物）
- 补 round 命名表：`task-N-review-R.json`（review/fix round 后缀）
- SOT 声明：命名/workspace → `packages/cdd-engine/templates/handoff-namespace.json`；JSON schema → `templates/schema/{cdd,docs}-handoff-schema.json`
- `progress.md` → `progress.json`（engine `lib/state/progress.mjs`）
- 保留 status/severity→status mapping 表（finalize.mjs L53 cite 依赖）

- [ ] **Step 3: 3 处 engine 注释 cite 同步**

`write.mjs` L2 / L22 + `contract.test.mjs` L10：注释改为「按 `skills/cli-driven-development/docs/handoff-schema.md`（命名/workspace 见 `handoff-namespace.json`）写 handoff」。

- [ ] **Step 4: verify**

`grep -rn "cdd-reference\|controller-handoff" packages/ scripts/ docs/ | grep -v fixtures` → 仅剩 frozen shipped 历史（post-dogfood/overhaul docs 中路径提及，不触碰）。
`npx vitest run packages/cdd-engine/tests/contract.test.mjs` 全绿（注释-only 变更）。

- [ ] **Step 5: Commit**

```bash
git add -A packages/osuperpowers/skills/cli-driven-development/ packages/cdd-engine/lib/handoff/write.mjs packages/cdd-engine/tests/contract.test.mjs
git commit -m "docs(cli-driven-development): drop dead cdd-reference/controller-handoff, prune handoff-schema to engine reality"
```

---

### Task 6: engine 健壮性 hardening（run-docs handoff 读 try/catch → BLOCKED + review-gate corrupt prev → null）

<thinking>原子单元：两处 engine 功能修复 + docs-runner 测试。P4 dogfood 实证：agent 手写 handoff 含未转义 `\d`（regex 记号）→ `run-docs.mjs:89` JSON.parse 未包裹 throw → review 派发 exit 2 无 handoff；`review.mjs existingRoundHandoff` 读 corrupt prev 同 throw。</thinking>

**Files:**
- Modify: `packages/cdd-engine/lib/runner/run-docs.mjs`（L89 JSON.parse 包 try/catch → writeBlocked）
- Modify: `packages/cdd-engine/lib/cli/review.mjs`（`existingRoundHandoff` JSON.parse 包 try/catch → null）
- Modify: `packages/cdd-engine/tests/docs-runner.test.mjs`（agent 写坏 JSON → BLOCKED 用例）

**Interfaces:**
- Consumes: 既有 `writeBlocked` / `hashFile(doc)` / `existingRoundHandoff` 签名
- Produces: BLOCKED handoff（doc_hash 载体，blocker = "handoff JSON unparseable: <msg>"）代替 exit 2；corrupt prev → gate 跳过

- [ ] **Step 1: 写 failing 测试**

`docs-runner.test.mjs` 追加（沿用既有 mock 模式）：

```js
it("T8-hardening: agent 手写坏 JSON（未转义 \\d）→ BLOCKED handoff 非 throw", async () => {
  // mock invokeCli 使 agent 写出含 `"summary": "#\\d+ 未转义"` 的 handoff 文件
  // 断言 runDocsTask 返回 { exitCode: 1, handoff: status BLOCKED } 且 blocker 含 "JSON unparseable"、doc_hash 存在
  // 而非 throw / exit 2（无 handoff 静默丢失）
});
```

- [ ] **Step 2: 确认 FAIL**

运行：`npx vitest run packages/cdd-engine/tests/docs-runner.test.mjs`
预期：新用例 FAIL（当前直接 throw 传播）

- [ ] **Step 3: 实现两处包裹**

`run-docs.mjs`：

```js
let handoff;
try {
  handoff = JSON.parse(readFileSync(handoffPath, "utf8"));
} catch (e) {
  return writeBlocked({
    handoffPath, mode, doc,
    blocker: `handoff JSON unparseable: ${e.message} → fix the handoff at ${handoffPath} or re-run ${mode}`,
  }); // 与「handoff 未写 / schema 无效」BLOCKED 分支同构（含 doc_hash）
}
```

`review.mjs` `existingRoundHandoff`：

```js
export function existingRoundHandoff(ws, type, round) {
  if (round < 1) return null;
  const p = path.join(ws, handoffNaming.handoffName("review", type, { round }));
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch (e) {
    // corrupt prev → 视为无 prev（fail-open：不因 corrupted prev 锁死重审；最坏多一轮 review，绝不自锁）
    return null;
  }
}
```

- [ ] **Step 4: 跑测试 + engine suite 全绿**

运行：`npx vitest run packages/cdd-engine/tests/docs-runner.test.mjs` + `pnpm run validate`
预期：新用例 PASS + 既有 suite 无回归

- [ ] **Step 5: Commit**

```bash
git add packages/cdd-engine/lib/runner/run-docs.mjs packages/cdd-engine/lib/cli/review.mjs packages/cdd-engine/tests/docs-runner.test.mjs
git commit -m "fix(cdd-engine): unparseable agent handoff → BLOCKED; corrupt prev → fail-open gate (P4 dogfood hardening)"
```

---

### Task 7: changeset + emit + 全量 validate + overall v1.14 收口

<thinking>原子单元：changeset（osuperpowers minor + cdd-engine patch）→ emit（Task 4/5 skill/docs 改动传播 .agents/）→ 全量 validate 13 块 → 收口 commit。changeset 关 #246 F6/F13。</thinking>

**Files:**
- Create: `.changeset/p4-session-report-246-overall-consistency.md`

**Interfaces:**
- Consumes: Task 1-6 全部产物
- Produces: 可发布包版本增量 + emit 产物一致 + validate 全绿

- [ ] **Step 1: 写 changeset**

`.changeset/p4-session-report-246-overall-consistency.md`：

```markdown
---
'@oscaner-skills/osuperpowers': minor
'@oscaner-skills/cdd-engine': patch
---

overall 四表机械守卫（validate block 12）+ 登记规则收敛 + CDD 死档清除；cdd-engine 无记录 handoff 读健壮性修复（坏 JSON → BLOCKED / corrupt prev → fail-open）。Closes #246 F6/F13。
```

- [ ] **Step 2: emit**

运行：`pnpm run emit` + `pnpm run emit:check`
预期：`.agents/skills/` 再生（add-phase-protocol/overall-spec-template/SKILL.md 变更 + 死档删除传播）、drift 无

- [ ] **Step 3: 全量 validate**

运行：`pnpm run validate`
预期：13 块 ALL PASS（含新 12. overall consistency + 既有 12 块无回归）

- [ ] **Step 4: overall 记账检查**

- Issue inventory：#246 已注册（F6/F13 行在）✓ 无新增 issue
- Phase inventory：P4 Design spec 列 = `P4-design（2026-09-11，v1.0）`（v1.13 已回填）✓；plan 列 [Pending]（关闭时 F13 回填）
- Dependency graph：无变化 ✓
- Change history：v1.14（Task 4 已追加）✓

- [ ] **Step 5: Commit**

```bash
git add .changeset/ .agents/
git commit -m "chore(release): P4 changeset (osuperpowers minor + cdd-engine patch) + emit regeneration"
```

---

## Self-Review 记录（writing-plans 内联自检）

- **Spec coverage**：§2.3 组件 1-6 → Task 1/2（parser+wellformed / 语义）；组件 6（index 集成）→ Task 3；§2.6.1-4 → Task 4；§2.6.5 → Task 5；§2.6.6 集成 → Task 3；§2.6.7 → Task 6；§2.7 changeset/emit/记账 → Task 7。§2.4 错误处理（malformed skip）→ Task 1/2 main 串联。全 ✅
- **Placeholder scan**：Step 3 骨架有「…实现见 plan-review 后补充精确索引」——**plan-review 驱动定稿**的注记（实现当轮以 fixture 定稿），非未定内容；函数签名/语义以测试为权威。无 TBD 活点。
- **Type consistency**：`loadOverallFile` → `{canonical, slug, phases[{id,design,plan}], issues, graphTokens, historyRows}` 全 task 统一；`checkVersionAscending / checkIssueRefsWellFormed / checkDepGraphMembership / checkBackfillClaims / checkDocExistence / checkAnchorRegistry` 签名贯通；`steps`/`runIfMain` 模式同 version-sync.mjs。