#!/usr/bin/env node
// scripts/validate/overall-consistency.mjs — P4 block 12: overall-consistency
// mechanical guard, part 1 (parser core + table well-formedness checks ③/④b/④c;
// backfill/design-plan checks ①/② + dependency-graph membership wire into Task 3).
//
// Canonical gate: only overall specs whose Phase inventory header is the canonical
// 7-column form (…| Design spec | Implementation plan | Acceptance criteria |
// Dependency |) are guarded; non-canonical files (e.g. post-dogfood 8-column legacy)
// are logged and skipped, never fail. A missing/broken Phase inventory table is
// §2.4 malformed — loadOverallFile returns { ok: false } and main() skips, not fail.
//
// Checks in this module:
//   ③ change history versions strictly ascending (`v<major>.<minor>` tuple), no
//      duplicates, version/date non-empty.
//   ④b Dependency graph ASCII block `P\d+` tokens + Phase inventory Dependency
//      column predecessors all ∈ Phase inventory ids.
//   ④c Issue inventory ref 列宽松读取（`#\d+` 起始可带说明文字 / 含
//      `#issuecomment-\d+` / `none` / `(…)` 文本）+ Phase 列 ∈ Phase inventory ids.
//
// Standalone (`node scripts/validate/overall-consistency.mjs`) scans
// docs/superpowers/specs/*-overall.md; exposed via `steps` for index.mjs (Task 3).

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { runIfMain } from "./runner.mjs";

const SPECS_DIR = join(process.cwd(), "docs", "superpowers", "specs");

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

// Table rows between section headings (inclusive of the table header/separator
// rows — caller filters those). A row is a line trimmed to `| … |`.
function tableRows(lines, range) {
  const rows = [];
  for (let i = range.start + 1; i < range.end; i++) {
    const t = lines[i].trim();
    if (t.startsWith("|") && t.endsWith("|")) rows.push(t.split("|").map((s) => s.trim()));
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
      const c = t.split("|").map((s) => s.trim());
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
    const o = loadOverallFile(join(SPECS_DIR, name));
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
    checked++;
    console.log(`OK — ${name} (${o.phases.length} phases)`);
  }
  console.log(`ALL PASS — ${checked}/${total} canonical overall files consistent`);
  return 0;
}

export const steps = [{ name: "12. overall consistency", run: main }];

runIfMain(import.meta.url, steps);