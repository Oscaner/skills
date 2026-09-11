#!/usr/bin/env node
// scripts/validate/overall-consistency.mjs — P4 block 12: overall-consistency
// mechanical guard (parser core + four-table consistency).
//
// Checks in this module:
//   ③ change history versions strictly ascending (`v<major>.<minor>` tuple), no
//      duplicates, version/date non-empty.
//   ④b Dependency graph ASCII block `P\d+` tokens + Phase inventory Dependency
//      column predecessors all ∈ Phase inventory ids.
//   ④c Issue inventory ref 列宽松读取（`#\d+` 起始可带说明文字 / 含
//      `#issuecomment-\d+` / `none` / `(…)` 文本）+ Phase 列 ∈ Phase inventory ids.
//   ① Backfill claim ↔ Phase inventory column bidirectional — change history
//      closeout declarations（`Pending → <target>`，brackets optional、ranges
//      `P1–P4/P6` 含端点）: mand-forward (claim ⇒ column) for plan + design,
//      reverse (shipped plan column ⇒ claim) for plan only.
//   ② plan/design document existence — slug-suffix glob
//      `*-<slug>-p<n>{,-design}.md` across specs/ + plans/ (cross-date phase
//      docs hit via suffix, not date prefix); design column asserts only its own
//      `P<n>-design` token (cross-refs like （源 P3-design） ignored); >1 hit → dup.
//   ④a Anchor registry — `#(\d+)#issuecomment-\d+` anchors in phase docs must
//      reference an issue number present in the Issue inventory ref set.
//
// Canonical gate: only overall specs whose Phase inventory header is the canonical
// 7-column form (…| Design spec | Implementation plan | Acceptance criteria |
// Dependency |) are guarded; non-canonical files (e.g. post-dogfood 8-column legacy)
// are logged and skipped, never fail. A missing/broken Phase inventory table is
// §2.4 malformed — loadOverallFile returns { ok: false } and main() skips, not fail.
//
// Standalone (`node scripts/validate/overall-consistency.mjs`) scans
// docs/superpowers/specs/*-overall.md; exposed via `steps` for index.mjs (Task 3).

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { runIfMain } from "./runner.mjs";

const SPECS_DIR = join(process.cwd(), "docs", "superpowers", "specs");
const PLANS_DIR = join(process.cwd(), "docs", "superpowers", "plans");

// `| # | Phase | …` — canonical Phase inventory header row (7 columns, the marker
// for the "four tables" mechanical guard surface). The `#` + `Phase` prefix pins the
// Phase inventory table (Issue inventory / history headers start `| Phase |`).
const HEADER_RE = /^\|\s*#\s*\|\s*Phase\s*\|/;
const CANONICAL_COL_TOKEN = /Implementation plan\b/;

// Phase ids use a digit boundary so a future P10/P11 never prefix-matches P1
// (design spec §2.3.2). Graph / dependency-column references are the same token.
const PHASE_TOKEN_RE = /\bP\d+(?![0-9])[a-z]?/g;

function sectionRange(lines, headingRe) {
  const start = lines.findIndex((l) => headingRe.test(l));
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i])) {
      end = i;
      break;
    }
  }
  return { start, end };
}

// Split a table row into cells on unescaped `|`: a `\|` inside a cell (markdown
// escaped pipe, e.g. real cdd-overhaul scope `task\|branch\|spec\|plan`) stays a
// literal pipe within the cell instead of shifting every later column.
function splitCells(t) {
  const cells = [];
  let buf = "";
  for (let i = 0; i < t.length; i++) {
    if (t[i] === "\\" && t[i + 1] === "|") {
      buf += "|";
      i++;
    } else if (t[i] === "|" && t[i - 1] !== "\\") {
      cells.push(buf.trim());
      buf = "";
    } else {
      buf += t[i];
    }
  }
  cells.push(buf.trim());
  return cells;
}

// Table rows between section headings (inclusive of the table header/separator
// rows — caller filters those). A row is a line trimmed to `| … |`.
function tableRows(lines, range) {
  const rows = [];
  for (let i = range.start + 1; i < range.end; i++) {
    const t = lines[i].trim();
    if (t.startsWith("|") && t.endsWith("|")) rows.push(splitCells(t));
  }
  return rows;
}

function isSeparatorRow(cells) {
  return cells.length > 0 && cells.slice(1, -1).every((c) => c !== "" && /^-+$/.test(c));
}

function fileNameSlug(filePath) {
  const base = filePath.split(/[\\/]/).pop() ?? filePath;
  return base.replace(/\.md$/, "").replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/-overall$/, "");
}

export function loadOverallFile(filePath) {
  let raw;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch (e) {
    // §2.4: 读失败（EISDIR 等）→ malformed skip，不向 runner 传播 throw
    return { ok: false, canonical: false, reason: `read failed: ${e.message}` };
  }
  const lines = raw.split("\n");
  const headerIdx = lines.findIndex((l) => HEADER_RE.test(l));
  if (headerIdx === -1) {
    return { ok: false, canonical: false, reason: "no phase inventory header" };
  }
  const header = lines[headerIdx];
  const canonical = CANONICAL_COL_TOKEN.test(header);
  const base = {
    ok: true,
    canonical,
    slug: fileNameSlug(filePath),
    phases: [],
    issues: [],
    graphTokens: [],
    historyRows: [],
  };
  if (!canonical) {
    return { ...base, reason: "non-canonical phase inventory header (no Implementation plan col)" };
  }

  // Phase inventory rows: `| # | Phase | Scope | Design spec | Implementation plan |
  // Acceptance criteria | Dependency |` → split 0-based: id = c[1], scope = c[2],
  // design = c[3], plan = c[4], dependency = c[6].
  const phaseIds = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.startsWith("| P") && t.endsWith("|")) {
      const c = splitCells(t);
      if (c.length >= 8) {
        phaseIds.push(c[1]);
        base.phases.push({ id: c[1], design: c[3], plan: c[4], dependency: c[6] });
      }
    } else if (/^## /.test(t)) {
      break;
    }
  }

  const issueRange = sectionRange(lines, /^## Issue inventory/);
  if (issueRange !== null) {
    for (const c of tableRows(lines, issueRange)) {
      if (isSeparatorRow(c) || c[1]?.toLowerCase() === "phase") continue;
      base.issues.push({ phase: c[1] ?? "", ref: c[2] ?? "" });
    }
  }

  const graphRange = sectionRange(lines, /^## Dependency graph/);
  if (graphRange !== null) {
    const tokens = new Set();
    let inBlock = false;
    for (let i = graphRange.start + 1; i < graphRange.end; i++) {
      const t = lines[i].trim();
      if (t.startsWith("```")) {
        if (inBlock) break;
        inBlock = true;
        continue;
      }
      if (inBlock) for (const m of t.matchAll(PHASE_TOKEN_RE)) tokens.add(m[0]);
    }
    base.graphTokens = [...tokens];
  }

  const historyRange = sectionRange(lines, /^## Change history/);
  if (historyRange !== null) {
    for (const c of tableRows(lines, historyRange)) {
      if (isSeparatorRow(c) || c[1]?.toLowerCase() === "version") continue;
      const m = (c[1] ?? "").match(/^v(\d+)\.(\d+)$/);
      base.historyRows.push({
        version: m ? [+m[1], +m[2]] : null,
        date: c[2] ?? "",
        summary: c[3] ?? "",
      });
    }
  }

  return base;
}

// ③ change-history 升序：`v<major>.<minor>` 严格递增（tuple 比较）+ 版本不重复 +
// version/date 列非空。
export function checkVersionAscending(historyRows) {
  const seen = new Set();
  let prev = null;
  for (const r of historyRows) {
    const [maj, min] = r.version ?? [];
    if (maj === undefined) {
      throw new Error(`change history version 非法/为空（bad/empty version）: ${JSON.stringify(r.version)}`);
    }
    if (!r.date || !r.date.trim()) {
      throw new Error(`change history version v${maj}.${min} date 为空（empty date）`);
    }
    const key = `${maj}.${min}`;
    if (seen.has(key)) {
      throw new Error(`change history duplicate version（版本重复）: v${key}`);
    }
    seen.add(key);
    if (prev !== null && (maj < prev[0] || (maj === prev[0] && min <= prev[1]))) {
      throw new Error(
        `change history not ascending（版本非升序）: v${prev[0]}.${prev[1]} → v${maj}.${min}`,
      );
    }
    prev = [maj, min];
  }
}

// ④c issue ref 宽松读取：`#\d+` 起始（可带尾随说明文字）或含 `#issuecomment-\d+`，
// link-wrap 裸 `#NNN`（cdd-overhaul 实证形态 `[#231](…issues/231)`），或纯 `none` /
// `(…)` 文本；Phase 列 ∈ Phase ids。
export function checkIssueRefsWellFormed(issues, phaseIds) {
  for (const { phase, ref } of issues) {
    if (!phaseIds.includes(phase)) {
      throw new Error(`issue inventory phase 列 ${phase} 不在 Phase inventory（phase 列 ∈ phaseIds 违例）`);
    }
    const refTxt = ref.trim();
    if (refTxt === "none") continue;
    if (/#issuecomment-/.test(refTxt)) {
      if (/#issuecomment-\d+/.test(refTxt)) continue;
      throw new Error(`issue ref 畸形（malformed anchor, #issuecomment- 后非数字）: ${refTxt}`);
    }
    if (/^#\d+(?![\w])/.test(refTxt)) continue;
    if (/^\[\s*#\d+\s*\]/.test(refTxt)) continue;
    if (/^[（(][^）)]*[）)]$/.test(refTxt)) continue;
    throw new Error(`issue ref 无法识别（unrecognized ref）: ${refTxt}`);
  }
}

// ④b Dependency graph ASCII block 全部 `P\d+` token ∈ Phase ids；Phase inventory
// Dependency 列 `P\d+` 前驱 ∈ Phase ids。
export function checkDepGraphMembership(graphTokens, phaseIds, phases) {
  for (const tok of graphTokens) {
    if (!phaseIds.includes(tok)) {
      throw new Error(`dependency graph 引用 ${tok} 不在 Phase inventory（dangling graph token）`);
    }
  }
  for (const p of phases) {
    for (const m of (p.dependency ?? "").matchAll(PHASE_TOKEN_RE)) {
      if (!phaseIds.includes(m[0])) {
        throw new Error(`phase ${p.id} dependency 列前驱 ${m[0]} 不在 Phase inventory`);
      }
    }
  }
}

// ---------- Task 2: semantic checks ①/②/④a ----------

// Claim clause boundary: `；`/`;` separates change-history sentences, and a claim
// only attaches the phases of its own clause (cdd-overhaul v1.27 carries a plan
// claim clause AND a design claim clause in one history row).
const CLAUSE_SEP = /[；;]/;
// `Pending → <target>` with brackets optional; target stops at whitespace /
// CJK punctuation / brackets so `→ **Done**（PR …` or `→ P4-design v1.0）` do not
// over-capture.
const CLAIM_RE = /(Pending|\[Pending\])\s*(?:→|->)\s*([^\s；;，,、（）()【】\[\]]+)/i;
const PLAN_CLAIM_LK = /(?:plan|计划)/i; // plan claim: summary mentions a plan-word
const DESIGN_CLAIM_LK = /Design[-\s]?spec/i; // design claim: mentions Design [-]spec
// Range expansion includes endpoints: `P1–P4/P6` → P1..P4 + P6 (`–` en-dash).
const RANGE_RE = /P(\d+)(?![0-9])(?:[a-z])?\s*[–—\-]\s*P(\d+)(?![0-9])(?:[a-z])?/g;
const SINGLE_PHASE_RE = /P(\d+)(?![0-9])[a-z]?/g;

// A claim target normalized to a comparable key: `P<n>-design` token for design
// claims, else the bare `Done`-style token (`**`/（…） 剥除）。
function claimKey(raw) {
  const t = (raw ?? "").replace(/\*\*/g, "").trim().replace(/[）】\]]+$/u, "");
  const d = t.match(/(P\d+(?![0-9])[a-z]?-design)/i);
  return d ? d[1] : t;
}

function isPendingText(v) {
  const t = (v ?? "").trim().toLowerCase();
  return t === "" || t === "pending" || t === "[pending]";
}

function columnValue(v) {
  return (v ?? "").replace(/\*\*/g, "").trim();
}

// The phase's own design-spec token `P<n>-design` in its Design spec column
// （cross-references like `（源 P3-design）` are NOT the own token）.
function ownDesignToken(col, phaseId) {
  const num = phaseId.replace(/^P/i, "");
  const m = (col ?? "").match(new RegExp(`P${num}(?![0-9])-design`, "i"));
  return m ? m[0] : null;
}

// ① 回填声明抽取：遍历 change-history summary，逐句（clause）识别
// `plan`/`Design spec` 词的 `Pending → <target>` 回填声明，句中 phase 引用做
// 区间展开（含端点）；返回 plan/design 两组 { phaseId → target key }。
export function extractClaimRows(historyRows) {
  const planClaims = new Map();
  const designClaims = new Map();
  for (const row of historyRows) {
    for (const clause of (row.summary ?? "").split(CLAUSE_SEP)) {
      if (PLAN_CLAIM_LK.test(clause)) {
        const m = clause.match(CLAIM_RE);
        if (m) {
          const key = claimKey(m[2]);
          // design-token 目标是 design claim；plan claim 目标须为 plain 词（Done 等）
          if (key && !isPendingText(key) && !/P\d+(?![0-9])[a-z]?-design/i.test(key)) {
            for (const pid of phaseIdsIn(clause)) planClaims.set(pid, key);
          }
        }
      }
      if (DESIGN_CLAIM_LK.test(clause)) {
        const m = clause.match(CLAIM_RE);
        if (m) {
          const key = claimKey(m[2]);
          if (key && /P\d+(?![0-9])[a-z]?-design/i.test(key)) {
            for (const pid of phaseIdsIn(clause)) designClaims.set(pid, key);
          }
        }
      }
    }
  }
  return { planClaims, designClaims };
}

function phaseIdsIn(clause) {
  const ids = new Set();
  for (const m of clause.matchAll(RANGE_RE)) {
    const a = +m[1];
    const b = +m[2];
    for (let n = Math.min(a, b); n <= Math.max(a, b); n++) ids.add(`P${n}`);
  }
  for (const m of clause.matchAll(SINGLE_PHASE_RE)) ids.add(`P${m[1]}`);
  return [...ids];
}

// ① Backfill claim ↔ Phase inventory column bidirectional（正向 claim→列 +
// 反向 仅 plan：shipped plan 列必须有 closeout 声明）。
export function checkBackfillClaims(phases, historyRows) {
  const { planClaims, designClaims } = extractClaimRows(historyRows);
  const byId = new Map(phases.map((p) => [p.id, p]));
  for (const [pid, key] of planClaims) {
    const p = byId.get(pid);
    if (!p) throw new Error(`backfill claim 引用 Phase inventory 之外的 ${pid}（claim → 未知 phase）`);
    if (columnValue(p.plan) !== key) {
      throw new Error(
        `backfill claim 与列不一致（① 正向 plan）: ${pid} Implementation plan 列 ${JSON.stringify(p.plan)} ≠ claim ${key}（shipped 需回填列）`,
      );
    }
  }
  for (const [pid, key] of designClaims) {
    const p = byId.get(pid);
    if (!p) throw new Error(`backfill claim 引用 Phase inventory 之外的 ${pid}（claim → 未知 phase）`);
    const own = ownDesignToken(p.design, pid);
    if (!own || own.toLowerCase() !== key.toLowerCase()) {
      throw new Error(
        `backfill claim 与列不一致（① 正向 design）: ${pid} Design spec 列需含自身 ${key} token（实际 ${JSON.stringify(p.design)}）`,
      );
    }
  }
  for (const p of phases) {
    if (isPendingText(p.plan)) continue;
    if (!planClaims.has(p.id)) {
      throw new Error(`plan 列已完成但 change history 无对应 plan-claim（① 反向 missing backfill claim）: ${p.id}`);
    }
  }
}

// ② plan/design 文档存在性：slug 后缀 glob `*-<slug>-p<n>{,-design}.md`（跨日期
// phase 文档经后缀命中，非日期前缀）；design 列仅断言自身 `P<n>-design` token；
// glob（同 slug+phase）命中 >1 → 重复文档。
export function checkDocExistence(phases, slug, specsRoot, plansRoot) {
  let specs = [];
  let plans = [];
  try {
    specs = readdirSync(specsRoot);
    plans = readdirSync(plansRoot);
  } catch {
    // 目录缺 → 视为无文档，由下方 missing 判定兜底
  }
  const planSuffix = (id) => `-${slug}-${id.toLowerCase()}.md`;
  const designSuffix = (id) => `-${slug}-${id.toLowerCase()}-design.md`;
  for (const p of phases) {
    if (!isPendingText(p.plan)) {
      const hits = plans.filter((n) => n.endsWith(planSuffix(p.id)));
      if (hits.length === 0) {
        throw new Error(`plan 文档缺失（missing plan doc）: 需 *${planSuffix(p.id)}（${p.id} plan 列非 Pending）`);
      }
      if (hits.length > 1) {
        throw new Error(`plan 文档重复（duplicate plan doc）: ${hits.join(", ")}`);
      }
    }
    const own = ownDesignToken(p.design, p.id);
    if (own) {
      const hits = specs.filter((n) => n.endsWith(designSuffix(p.id)));
      if (hits.length === 0) {
        throw new Error(`design 文档缺失（missing design doc）: 需 *${designSuffix(p.id)}（${p.id} Design spec 列含 ${own}）`);
      }
      if (hits.length > 1) {
        throw new Error(`design 文档重复（duplicate design doc）: ${hits.join(", ")}`);
      }
    }
  }
}

// ④a 锚点注册域：被扫描文件中的 `#NNN#issuecomment-\d+` 锚点，其 issue 编号必须
// 属于 Issue inventory ref 列的 `#\d+` token 集。
export function checkAnchorRegistry(issues, scanFiles) {
  const universe = new Set();
  for (const { ref } of issues) {
    for (const m of (ref ?? "").matchAll(/#(\d+)/g)) universe.add(m[1]);
  }
  for (const file of scanFiles) {
    let raw;
    try {
      raw = readFileSync(file, "utf8");
    } catch {
      continue; // 文件不可读 → 无可扫描内容
    }
    for (const m of raw.matchAll(/#(\d+)#issuecomment-\d+/g)) {
      if (!universe.has(m[1])) {
        throw new Error(`锚点 issue #${m[1]} 不在 Issue inventory 注册域（unregistered anchor）: ${file}`);
      }
    }
  }
}

// ④a scan 面 = overall 自身 + 同 slug 的全部 phase 文档（specs + plans 双目录）。
function anchorScanFiles(overallFile, slug) {
  const files = [overallFile];
  const re = new RegExp(`-${slug}-p\\d+(?:-design)?\\.md$`);
  for (const dir of [SPECS_DIR, PLANS_DIR]) {
    let names;
    try {
      names = readdirSync(dir);
    } catch {
      continue;
    }
    for (const n of names) if (re.test(n)) files.push(join(dir, n));
  }
  return files;
}

export function main() {
  if (!existsSync(SPECS_DIR)) {
    console.log("SKIP — no docs/superpowers/specs");
    return 0;
  }
  let total = 0;
  let checked = 0;
  for (const name of readdirSync(SPECS_DIR).sort()) {
    if (!name.endsWith("-overall.md")) continue;
    total++;
    const file = join(SPECS_DIR, name);
    const o = loadOverallFile(file);
    if (!o.ok) {
      console.error(`CDD_INFO: malformed ${name} — skipped (${o.reason})`);
      continue;
    }
    if (!o.canonical) {
      console.error(`CDD_INFO: skip ${name} (non-canonical phase inventory header)`);
      continue;
    }
    const phaseIds = o.phases.map((p) => p.id);
    checkVersionAscending(o.historyRows);
    checkDepGraphMembership(o.graphTokens, phaseIds, o.phases);
    checkIssueRefsWellFormed(o.issues, phaseIds);
    checkBackfillClaims(o.phases, o.historyRows); // ① 回填声明 ↔ 列双向
    checkDocExistence(o.phases, o.slug, SPECS_DIR, PLANS_DIR); // ② 文档存在性 glob
    checkAnchorRegistry(o.issues, anchorScanFiles(file, o.slug)); // ④a 锚点注册域
    checked++;
    console.log(`OK — ${name} (${o.phases.length} phases)`);
  }
  console.log(`ALL PASS — ${checked}/${total} canonical overall files consistent`);
  return 0;
}

export const steps = [{ name: "12. overall consistency", run: main }];

runIfMain(import.meta.url, steps);