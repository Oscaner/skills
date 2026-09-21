// packages/cdd-engine/src/rules/documents.ts — the single doc-chain audit entry (docContractValidate
// base-default hook's rules core). P2 T3: validateDispatchDocuments is refactored into the ONE audit
// entry with per-doc-type check surfaces; the four-table charter audit (faces ①-⑥) runs on the
// resolved parent overall, gated by lineage discovery per lane entry:
//
//   plan     — plan 契約 (`### Task N:` continuously extractable (reuses the brief-extraction
//              semantics) · `**Spec:**` reference resolves to an existing spec file · Constraints
//              source declaration extractable · no `{{…}}` placeholders (handlebars `{{> partial}}`
//              refs exempt)) — Class A (repo-root form primary, file-relative fallback; holder
//              targets skipped, label == resolved basename). Always runs (necessary subset).
//   spec     — `**Version**` line · Parent program → existing `*-overall.md` (Class B resolution)
//              → the overall 契約 face (canonical Phase inventory kernel / row-shape / change-history
//              strictly ascending) + merged version-lineage (the parent line's vX.Y tokens ∈ the
//              overall's lineage) + the four-table audit.
//   overall  — the overall 契約 face + four tables directly (docs-lane self-audit boundary).
//
// Lineage truncation (no / broken `**Parent program**` link): the overall 契約 face + four tables
// no-op; the necessary subset (plan 契約 + Class A + the spec's own face) still runs — the four
// tables are only audited against a reached parent overall (AC1: lineage 未 resolve → 四表 no-op).
//
// The four-table audit (the '四表' of the program charter — tokens from the canonical doc-structure
// schemas via documents/tokens.ts):
//
//   ① bidirection backfill claim ↔ Phase-inventory column (forward claim ⇒ column, reverse shipped
//     plan column ⇒ matching claim)             ② plan/design document existence (suffix glob)
//   ③ dependency-graph membership (graph tokens + dependency-cell predecessors ∈ inventory ids)
//   ④ phase-registration completeness (dispatch phase ∈ inventory ids · no duplicate rows)
//   ⑤ anchor registration domain (anchor issue ∈ Issue-inventory refs; no anchors → no-op)
//   ⑥ Issue-inventory rows well-formed (phase ∈ ids · ref well-formed)
//
// Returns failures[] — each { artifact (plan | phase spec | overall) · file · field · missing (what
// is absent) · fix (how to repair) — guidance, never raw parse diagnostics }. Read-only: reads the
// docs, writes nothing (zero engine doc writes). taskNumbersFromPlan / extractPlanConstraints are
// canonical HERE (Task 3 ③ — the base default hook needs them without a dispatch-layer import); the
// dispatch layer re-exports the same identities for its workspace consumers.
import { readFileSync, statSync, readdirSync } from "node:fs";
import path from "node:path";
import { DOC_TOKENS } from "../documents/tokens.ts";

export interface DocValidationFailure {
  /** which contract failed — "plan" | "phase spec" | "overall" */
  artifact: string;
  /** absolute path of the offending doc */
  file: string;
  /** the failing field name (e.g. "`**Spec:**`" / "Task headings" / "Dependency graph") */
  field: string;
  /** what is missing / wrong */
  missing: string;
  /** how to fix — the actionable guidance */
  fix: string;
}

export interface DocValidationOptions {
  /** the audit entry point — a **plan** path (task / branch lanes + docs-lane plan review), a
   *  **design spec** path (docs-lane spec review) or an **overall** path (docs-lane self-audit);
   *  the doc-type dispatch happens here (no caller-supplied type). */
  entry: string;
  /** git workspace root the doc chain resolves against (repo-root-form link targets). */
  root: string;
}

// ---- anchor atoms (schema-derived single source — documents/tokens.ts). Field names carry
// backticks (markdown code span) so the guidance line reads as a doc reference. LINK_RE is a
// generic markdown parse atom, not a doc-structure token — it stays engine-local.
const SPEC_FIELD = DOC_TOKENS.specField;
const PARENT_FIELD = DOC_TOKENS.parentField;
const VERSION_FIELD = DOC_TOKENS.versionField;
const SPEC_MARK = DOC_TOKENS.specMark;
const PARENT_MARK = DOC_TOKENS.parentMark;
const LINK_RE = /(?<!!)\[([^\]]+)\]\(([^)]+)\)/g;
const VERSION_TOKEN_RE = DOC_TOKENS.versionTokenRe;
const VERSION_HEADER_RE = DOC_TOKENS.versionHeaderRe;
const HISTORY_VERSION_CELL_RE = DOC_TOKENS.historyVersionCellRe;

// ---- four-table audit tokens (canonical) ----
const HEADER_RE = DOC_TOKENS.phaseHeaderRe;
const CANONICAL_COL_TOKEN = DOC_TOKENS.canonicalColumnRe;
const CHANGE_HISTORY_SECTION_RE = DOC_TOKENS.changeHistoryHeadingRe;
const PHASE_ROW_OPEN_RE = DOC_TOKENS.phaseRowOpenRe;
const PHASE_ROW_CELL_COUNT = DOC_TOKENS.phaseRowCellCount;
const VERSION_CELL_NUMERIC_RE = DOC_TOKENS.versionNumericRe;
const ISSUE_INVENTORY_HEADING = DOC_TOKENS.issueInventoryHeading;
const DEPENDENCY_GRAPH_HEADING_RE = DOC_TOKENS.dependencyGraphHeadingRe;
const ISSUE_ANCHOR_RE = DOC_TOKENS.issueAnchorFormRe;
const PHASE_TOKEN_RE = DOC_TOKENS.phaseTokenScanRe;
const CLAIM_RE = DOC_TOKENS.claimClauseRe;
const CLAIM_SEP_RE = DOC_TOKENS.claimClauseSeparatorRe;
const RANGE_RE = DOC_TOKENS.claimPhaseRangeRe;
const SINGLE_PHASE_RE = DOC_TOKENS.claimSinglePhaseRe;
// Claim link words — the canonical single/range patterns are the anchored leaf; the audit's
// contains-search form strips the anchors (the search word boundaries) — the phrase family the
// retiring scripts guard matched unanchored with the same body. The `P<n>-design` design-spec
// token (split ids allowed: `P1a-design`) is the canonical claimPatterns.designToken scan.
const PLAN_LINK_WORD = linkWordSearch(DOC_TOKENS.planLinkWordRe);
const DESIGN_LINK_WORD = linkWordSearch(DOC_TOKENS.designLinkWordRe);
const DESIGN_TOKEN_RE = DOC_TOKENS.designTokenScanRe;
function linkWordSearch(anchored: RegExp): RegExp {
  return new RegExp(anchored.source.replace(/^\^/, "").replace(/\$$/, ""), "i");
}

// Placeholder / template / regex targets (same class as plan-spec-anchors' predicate): scheme links,
// local anchors, absolute-root paths, dir refs and template tokens are prose, not tree paths.
function isPlaceholderOrTemplateTarget(t: string): boolean {
  if (!t) return true;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(t) || /^mailto:/i.test(t)) return true;
  if (t.startsWith("#") || t.startsWith("/")) return true;
  if (t === "." || t === ".." || t.endsWith("/")) return true;
  if (/^url$/i.test(t)) return true;
  if (/[\s<>…?|*{}\[\]()`"'（）]/.test(t)) return true;
  return false;
}

function linksOnLine(line: string): Array<{ label: string; target: string }> {
  const out: Array<{ label: string; target: string }> = [];
  for (const m of line.matchAll(LINK_RE)) out.push({ label: m[1], target: m[2] });
  return out;
}

function isFile(p: string): boolean {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}

function resolveFromBase(root: string, target: string): string | null {
  const abs = path.join(root, target.split("#")[0]);
  return isFile(abs) ? abs : null;
}

function resolveAny(target: string, bases: readonly string[]): string | null {
  for (const base of bases) {
    const hit = resolveFromBase(base, target);
    if (hit) return hit;
  }
  return null;
}

/** Version lineage of the parent overall: its current `**Version:**` header ∪ change-history
 * version cells — the file itself is the source of truth (frozen docs legitimately pin the version
 * in force at authoring time; fabricated / future tokens fail). */
function overallTokenVersions(filePath: string): string[] {
  const raw = readFileSync(filePath, "utf8");
  const versions = new Set<string>();
  const cur = raw.match(VERSION_HEADER_RE);
  if (cur) versions.add(cur[1]);
  for (const line of raw.split("\n")) {
    const m = line.match(HISTORY_VERSION_CELL_RE);
    if (m) versions.add(m[1]);
  }
  return [...versions];
}

// ---- plan parsing (canonical extractors — the dispatch layer re-exports these identities) ----

/** Task-heading scan (`^### Task N:` → numeric sort; tolerant titles after the colon are kept).
 * The heading token is schema-derived (plan schema taskHeadings pattern). */
export function taskNumbersFromPlan(planFile: string): number[] {
  const nums: number[] = [];
  for (const line of readFileSync(planFile, "utf8").split("\n")) {
    const m = line.match(DOC_TOKENS.taskNumberRe);
    if (m) nums.push(Number(m[1]));
  }
  return nums.sort((a, b) => a - b);
}

// Deterministic section extraction for the canonical form: `## Constraints` heading + content to
// the first structural boundary — a `#`/`##` heading, a `### Task ` heading (the brief-extraction
// atom the constraints section must not swallow), or a `---` rule (the preamble/task separator).
// `###` sub-sections stay inside. An empty section → null (declared-but-empty is not a constraint
// declaration).
function extractLiteralConstraints(content: string): string | null {
  const lines = content.split("\n");
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (DOC_TOKENS.constraintsHeadingRe.test(lines[i])) { start = i; break; }
  }
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^(#{1,2}\s|---\s*$)/.test(lines[i]) || DOC_TOKENS.taskHeadingPrefixRe.test(lines[i])) { end = i; break; }
  }
  const body = lines.slice(start + 1, end).join("\n").trimEnd();
  if (!body) return null;
  return `${lines[start]}\n${body}\n`;
}

// Prose-pointer anchor heading regex: `**<anchor>(?:（qualifier）)?**：` — the in-repo qualifier
// forms are full-width parentheticals; a bare `**<anchor>**：` matches too (the `(?:…)` group is a
// REAL regex group and optional — `（[^）]*）?` would quantify only the closing paren and demand a
// literal `（`). No gap is allowed between the anchor and the closing `**`, so a prefix-collision
// heading (`**<anchor> 补充**：`) can never occupy the anchor's slot.
function proseAnchorRe(anchor: string): RegExp {
  return new RegExp(`^\\*\\*${anchor}(?:（[^）]*）)?\\*\\*[：:]`);
}

// Block boundary for the prose-pointer form (mirrors extractLiteralConstraints' boundary set): a
// `---` rule, a `#`/`##` heading, a `### Task ` heading — or another `**…**：` declaration heading
// (any prose-pointer-style bold heading begins a new declaration block).
const PROSE_BLOCK_STOP = [
  /^---\s*$/,
  /^#{1,2}\s/,
  DOC_TOKENS.taskHeadingPrefixRe,
  /^\*\*[^*]+\*\*[：:]/,
] as const;

// Legacy prose-pointer extraction: the anchored `**<anchor>…**：` lines in canonical order, each
// followed by its continuation paragraphs — a body spanning blank-line-separated paragraphs is
// captured in FULL. Block boundaries: the next declaration heading (or structural boundary) ends
// the block; present anchors are taken verbatim (first match per anchor), missing ones omitted.
function extractProseConstraints(content: string): string | null {
  const lines = content.split("\n");
  const out: string[] = [];
  for (const anchor of DOC_TOKENS.proseAnchors) {
    const re = proseAnchorRe(anchor);
    const start = lines.findIndex((line) => re.test(line));
    if (start < 0) continue;
    const block: string[] = [lines[start]];
    for (let i = start + 1; i < lines.length; i++) {
      if (PROSE_BLOCK_STOP.some((stop) => stop.test(lines[i]))) break;
      block.push(lines[i]);
    }
    while (block.length > 0 && block[block.length - 1].trim() === "") block.pop();
    out.push(block.join("\n"));
  }
  if (out.length === 0) return null;
  return out.join("\n\n") + "\n";
}

/** Deterministic extraction from the plan's declared Constraints source: canonical Form A — a
 * literal top-level `## Constraints` section; legacy Form B — the prose-pointer headings
 * (口径 / commit 边界机制 / Flow Atomicity / 顺序原则), extracted in canonical order. Returns the
 * constraints body verbatim (single trailing newline) or null when the plan declares no constraint
 * source (the BLOCK face). */
export function extractPlanConstraints(planContent: string): string | null {
  const literal = extractLiteralConstraints(planContent);
  if (literal !== null) return literal;
  return extractProseConstraints(planContent);
}

// ---- plan 契約 (per-doc-type necessary surface) ----

const PLACEHOLDER_RE = /{{\s*[^{}>\n]+\s*}}/g;

/** plan 契約: `### Task N:` continuous extractability · `**Spec:**` exists + resolves ·
 * constraints source declaration extractable · no placeholders. Necessary subset — always runs. */
export function validatePlanContract(planPath: string): DocValidationFailure[] {
  const failures: DocValidationFailure[] = [];
  const content = readFileSync(planPath, "utf8");

  // 1. Task headings — continuously extractable (canonical taskNumbersFromPlan).
  const tasks = taskNumbersFromPlan(planPath);
  const taskHeadingLbl = `\`${DOC_TOKENS.taskHeadingFormat}\``;
  if (tasks.length === 0) {
    failures.push({
      artifact: "plan",
      file: planPath,
      field: "Task headings",
      missing: `no ${taskHeadingLbl} headings in the plan`,
      fix: `add ${taskHeadingLbl} task headings, 1-indexed and contiguous (e.g. \`### Task 1:\` through \`### Task N:\`)`,
    });
  } else if (new Set(tasks).size !== tasks.length) {
    failures.push({
      artifact: "plan",
      file: planPath,
      field: "Task headings",
      missing: `duplicate task heading(s): ${tasks.join(", ")}`,
      fix: `make each ${taskHeadingLbl} heading present exactly once`,
    });
  } else {
    const max = tasks[tasks.length - 1];
    const expected = Array.from({ length: max }, (_, i) => i + 1);
    if (tasks.length !== expected.length || tasks.some((n, i) => n !== expected[i])) {
      failures.push({
        artifact: "plan",
        file: planPath,
        field: "Task headings",
        missing: `task headings not contiguous from 1 (got ${tasks.join(", ")}; expected 1..${max})`,
        fix: `renumber the task headings so every ${taskHeadingLbl} from 1 to the max is present exactly once`,
      });
    }
  }

  // 2. Constraints source — the declared source must be extractable (the materializer's own face;
  //    the implement non-dry existence gate already blocks on it; this check is mode-independent).
  if (extractPlanConstraints(content) === null) {
    failures.push({
      artifact: "plan",
      file: planPath,
      field: "Constraints source",
      missing: "plan declares no Constraints source",
      fix: `declare a literal \`${DOC_TOKENS.constraintsHeading}\` section (canonical Form A) or the prose pointer headings ${DOC_TOKENS.proseAnchorTokens.map((t) => `\`${t}\``).join(" / ")} (Form B)`,
    });
  }

  // 3. Placeholders — unfilled template tokens (`{{…}}`) are authoring debt; handlebars partials
  //    `{{> …}}` are the in-repo template mechanism and stay exempt.
  for (const m of content.matchAll(PLACEHOLDER_RE)) {
    failures.push({
      artifact: "plan",
      file: planPath,
      field: "placeholders",
      missing: `unfilled template token ${m[0]}`,
      fix: "replace the placeholder with the real content (or drop the template syntax)",
    });
  }
  return failures;
}

// ---- Class A (`**Spec:**` resolution) ----

/** Class A resolution — mirrors plan-spec-anchors (repo-root form primary, file-relative
 * fallback; holder targets skipped). Returns the resolved spec path + its failures (unresolved /
 * label drift). Class A keeps its failure surface at every resolution attempt — `**Spec:**` is a
 * plan's own line, not part of the (optional) parent lineage. */
function resolveSpecFromPlan(planPath: string, root: string): { specPath: string | null; failures: DocValidationFailure[] } {
  const failures: DocValidationFailure[] = [];
  const lines = readFileSync(planPath, "utf8").split("\n");
  const lineIdx = lines.findIndex((l) => l.includes(SPEC_MARK));
  if (lineIdx === -1) {
    failures.push({
      artifact: "plan",
      file: planPath,
      field: SPEC_FIELD,
      missing: `no ${SPEC_FIELD} reference`,
      fix: `add a ${SPEC_FIELD} line pointing at the phase design spec, e.g. ${SPEC_FIELD} [<name>-design.md](docs/osuperpowers/specs/<name>-design.md)`,
    });
    return { specPath: null, failures };
  }
  let firstResolved: string | null = null;
  for (const { label, target } of linksOnLine(lines[lineIdx])) {
    if (isPlaceholderOrTemplateTarget(target)) continue;
    const resolved = resolveAny(target, [root, path.dirname(planPath)]);
    if (!resolved) {
      failures.push({
        artifact: "plan",
        file: planPath,
        field: SPEC_FIELD,
        missing: `target does not resolve (${target})`,
        fix: "fix the link target to an existing spec file (repo-root form docs/osuperpowers/specs/<file> or a file-relative path)",
      });
      continue;
    }
    if (firstResolved === null) firstResolved = resolved;
    if (label.trim() !== path.basename(resolved)) {
      failures.push({
        artifact: "plan",
        file: planPath,
        field: SPEC_FIELD,
        missing: `link label ${label.trim()} != resolved basename ${path.basename(resolved)}`,
        fix: "make the link label equal the resolved file's basename",
      });
    }
  }
  if (firstResolved === null && failures.length === 0) {
    failures.push({
      artifact: "plan",
      file: planPath,
      field: SPEC_FIELD,
      missing: `no resolvable ${SPEC_FIELD} link`,
      fix: `add a ${SPEC_FIELD} link to an existing spec file`,
    });
  }
  return { specPath: firstResolved, failures };
}

/** phaseIdFromPlan(planPath) — derive the target phase id from the plan filename (`…-p\d+`, digit
 * boundary so a future P10 never prefix-matches P1). Null → the "dispatch phase registered" check
 * (four-table face ④) is skipped (fail-open — a phase-less plan has no registration obligation);
 * the structural overall checks still run fully. Token shape is schema-derived (the canonical
 * phase-id pattern's filename form). */
export function phaseIdFromPlan(planPath: string): string | null {
  const m = path.basename(planPath).match(DOC_TOKENS.phaseIdScanRe);
  return m ? `P${m[1]}` : null;
}

// ---- overall table parsing (canonical-header semantics from the doc-structure schema) ----

// Split a table row into cells on unescaped `|` (a `\|` inside a cell stays a literal pipe).
function splitCells(t: string): string[] {
  const cells: string[] = [];
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

function sectionRange(lines: string[], headingRe: RegExp): { start: number; end: number } | null {
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

function tableRows(lines: string[], range: { start: number; end: number }): string[][] {
  const rows: string[][] = [];
  for (let i = range.start + 1; i < range.end; i++) {
    const t = lines[i].trim();
    if (t.startsWith("|") && t.endsWith("|")) rows.push(splitCells(t));
  }
  return rows;
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.slice(1, -1).every((c) => c !== "" && /^-+$/.test(c));
}

export interface PhaseRow {
  id: string;
  design: string;
  plan: string;
  dependency: string;
}
interface IssueRow {
  phase: string;
  ref: string;
}

export interface OverallParse {
  kernelOk: boolean; // readable AND canonical Phase inventory header
  reason: string; // unreadable / missing header / non-canonical
  ids: string[];
  dupIds: string[]; // phase ids registered more than once (④ registration incompleteness)
  rows: PhaseRow[]; // Phase-inventory cell rows (design/plan/dependency — the audit's column face)
  issues: IssueRow[];
  graphTokens: string[];
  historyRows: Array<{ version: [number, number] | null; date: string; summary: string }>;
  shapeDrift: Array<{ id: string; cells: number; expected: number }>;
  versionProblems: string[];
}

/** parseOverall — the canonical four-table parse (single source; exported for the closeout
 *  mismatch module — P2 ④ — which consumes the same parse as the audit, never a second one). */
export function parseOverall(overallPath: string): OverallParse {
  const out: OverallParse = {
    kernelOk: false, reason: "", ids: [], dupIds: [], rows: [], issues: [], graphTokens: [],
    historyRows: [], shapeDrift: [], versionProblems: [],
  };
  let raw: string;
  try {
    raw = readFileSync(overallPath, "utf8");
  } catch {
    out.reason = `overall file unreadable (${overallPath})`;
    return out;
  }
  const lines = raw.split("\n");
  const headerIdx = lines.findIndex((l) => HEADER_RE.test(l));
  if (headerIdx === -1) {
    out.reason = "no Phase inventory header";
    return out;
  }
  if (!CANONICAL_COL_TOKEN.test(lines[headerIdx])) {
    out.reason = "non-canonical Phase inventory header (no Implementation plan column)";
    return out;
  }
  out.kernelOk = true;

  // Phase-inventory rows: `| P… | … |` with the canonical 6-content-column form (= 8 split
  // tokens). Row-shape guard: every row must carry the file-norm cell count — a stray merged/split
  // cell shifts design/plan/dependency by a column and only detonates at closeout value-population,
  // so it is caught here at parse time (same semantics as the validate 247832c6 guard).
  let norm = 0;
  const seenLower = new Set<string>();
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (/^## /.test(t)) break;
    if (PHASE_ROW_OPEN_RE.test(t) && t.endsWith("|")) {
      const c = splitCells(t);
      if (c.length >= PHASE_ROW_CELL_COUNT) {
        if (norm === 0) norm = c.length;
        else if (c.length !== norm) {
          out.shapeDrift.push({ id: c[1]?.trim() || "(unnamed)", cells: c.length, expected: norm });
          continue; // a misaligned row's cells are untrustworthy — skip id collection
        }
        const id = c[1]?.trim() || "";
        // Duplicate registration (④): the inventory is the single phase-identity authority — the
        // same id registering twice is an incomplete registration, not two phases.
        if (id && !seenLower.has(id.toLowerCase())) {
          seenLower.add(id.toLowerCase());
          out.ids.push(id);
          out.rows.push({ id, design: c[3] ?? "", plan: c[4] ?? "", dependency: c[6] ?? "" });
        } else if (id) {
          out.dupIds.push(id);
        }
      }
    }
  }

  // Issue inventory (⑥ / ⑤ faces) — `| Phase | Issue (ref) | … |`.
  const issueRange = sectionRange(lines, new RegExp(`^${DOC_TOKENS.issueInventoryHeading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  if (issueRange) {
    for (const c of tableRows(lines, issueRange)) {
      if (isSeparatorRow(c) || c[1]?.trim().toLowerCase() === "phase") continue;
      out.issues.push({ phase: c[1] ?? "", ref: c[2] ?? "" });
    }
  }

  // Dependency graph (③ face): the ASCII fence's `P<n>` tokens (the graph rows may carry inline
  // annotations after the edges — the token scan reads the whole fenced block).
  const graphRange = sectionRange(lines, DEPENDENCY_GRAPH_HEADING_RE);
  if (graphRange) {
    const tokens = new Set<string>();
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
    out.graphTokens = [...tokens];
  }

  // Change-history rows (① claims + the kernel ③ ascending/unique/date rules).
  const range = sectionRange(lines, CHANGE_HISTORY_SECTION_RE);
  if (range) {
    const seen = new Set<string>();
    let prev: [number, number] | null = null;
    for (const c of tableRows(lines, range)) {
      if (isSeparatorRow(c) || c[1]?.trim().toLowerCase() === "version") continue;
      const m = (c[1] ?? "").match(VERSION_CELL_NUMERIC_RE);
      let version: [number, number] | null = null;
      if (!m) {
        out.versionProblems.push(`bad/empty version: ${JSON.stringify(c[1])}`);
      } else {
        version = [+m[1], +m[2]];
        if (!(c[2] ?? "").trim()) out.versionProblems.push(`version v${m[1]}.${m[2]} has an empty date`);
        const key = `${m[1]}.${m[2]}`;
        if (seen.has(key)) out.versionProblems.push(`duplicate version v${key}`);
        seen.add(key);
        if (prev && (version[0] < prev[0] || (version[0] === prev[0] && version[1] <= prev[1]))) {
          out.versionProblems.push(`not ascending: v${prev[0]}.${prev[1]} → v${version[0]}.${version[1]}`);
        }
        prev = version;
      }
      out.historyRows.push({ version, date: c[2] ?? "", summary: c[3] ?? "" });
    }
  }
  return out;
}

// ---- the spec doc-type face (own Version line + Class B parent resolution) ----

/** Class B — the spec's Parent program → its `*-overall.md`. Chain truncation (no parent line /
 * placeholder / unresolvable / not an overall) yields { overallPath: null } and the FOUR-TABLE +
 * overall 契約 faces no-op (AC1: lineage 未 resolve → 四表 no-op、necessary-subset 恒跑) — the
 * overall is only ever audited against a reached parent doc. Pinned version tokens ride the
 * resolution for the merged version-lineage check. */
function resolveParentOverall(specPath: string, root: string): { overallPath: string | null; pinnedTokens: string[] } {
  const lines = readFileSync(specPath, "utf8").split("\n");
  const parentIdx = lines.findIndex((l) => l.includes(PARENT_MARK));
  if (parentIdx === -1) return { overallPath: null, pinnedTokens: [] };
  const links = linksOnLine(lines[parentIdx]);
  if (links.length === 0) return { overallPath: null, pinnedTokens: [] };
  const { target } = links[0];
  if (isPlaceholderOrTemplateTarget(target)) return { overallPath: null, pinnedTokens: [] };
  const resolved = resolveAny(target, [path.dirname(specPath), root]);
  if (!resolved) return { overallPath: null, pinnedTokens: [] };
  if (!path.basename(resolved).endsWith("-overall.md")) return { overallPath: null, pinnedTokens: [] };
  const pinnedTokens = [...lines[parentIdx].matchAll(VERSION_TOKEN_RE)].map((m) => m[0]);
  return { overallPath: resolved, pinnedTokens };
}

/** The phase-spec doc-type surface: `**Version**` line (the spec's own structural face) then Class B
 * → the parent overall's 契約 face + four tables (version-lineage merged in). phaseId is the
 * dispatch plan's phase (a spec-entry audit has none). */
export function validatePhaseSpecContract(specPath: string, root: string, phaseId: string | null): DocValidationFailure[] {
  const failures: DocValidationFailure[] = [];
  const content = readFileSync(specPath, "utf8");
  if (!content.match(VERSION_HEADER_RE)) {
    failures.push({
      artifact: "phase spec",
      file: specPath,
      field: VERSION_FIELD,
      missing: `no ${VERSION_FIELD} line`,
      fix: `add a \`- ${DOC_TOKENS.versionMark}: vX.Y · <date>\` line at the document head`,
    });
  }
  const parent = resolveParentOverall(specPath, root);
  if (!parent.overallPath) return failures; // chain truncation — the four tables + overall 契約 no-op
  failures.push(...validateOverallContract(parent.overallPath, phaseId, parent.pinnedTokens));
  return failures;
}

// ---- the overall doc-type face (kernel 契約 + merged version-lineage + the four-table audit) ----

/** overall 契約: canonical header · row-shape guard · change-history ascending/unique/dates — plus
 * the merged version-lineage (the chain's pinned vX.Y tokens ∈ the overall's lineage, canonical
 * change-history version rules承接) — plus the four-table audit faces ①-⑥. A phase-less plan
 * (phaseId null) skips ④'s dispatch-phase registration; the structural faces still run fully. */
export function validateOverallContract(overallPath: string, phaseId: string | null, pinnedTokens: string[] = []): DocValidationFailure[] {
  const failures: DocValidationFailure[] = [];
  const o = parseOverall(overallPath);
  if (!o.kernelOk) {
    failures.push({
      artifact: "overall",
      file: overallPath,
      field: "Phase inventory",
      missing: o.reason,
      fix: o.reason.includes("non-canonical")
        ? `use the canonical 7-column Phase inventory header (\`${DOC_TOKENS.phaseInventoryHeader}\`)`
        : "make sure the overall file exists and carries a canonical Phase inventory table",
    });
    return failures;
  }
  for (const d of o.shapeDrift) {
    failures.push({
      artifact: "overall",
      file: overallPath,
      field: "row-shape drift",
      missing: `${d.id}: ${d.cells} cells ≠ file norm ${d.expected}`,
      fix: "re-merge split/extra cells so every Phase-inventory `| P… |` row carries the same column count",
    });
  }
  for (const p of o.versionProblems) {
    failures.push({
      artifact: "overall",
      file: overallPath,
      field: "Change history",
      missing: p,
      fix: "format change-history rows as strictly ascending unique `v<major>.<minor>` versions with non-empty dates",
    });
  }
  // Merged version-lineage: the dispatch chain's OWN pinned vX.Y must be a version the overall
  // carries (its current `**Version:**` ∪ change-history cells) — the canonical change-history
  // version rules are the lineage source (single implementation; a fabricated/future pin fails).
  if (pinnedTokens.length > 0) {
    const lineage = new Set(overallTokenVersions(overallPath));
    for (const tok of pinnedTokens) {
      if (!lineage.has(tok)) {
        failures.push({
          artifact: "overall",
          file: overallPath,
          field: "Version lineage",
          missing: `pinned version token ${tok} ∉ overall lineage {${[...lineage].join(", ")}}`,
          fix: `pin the Parent program line to a version the overall actually carries (its \`${DOC_TOKENS.versionMark}:\` header or a change-history row)`,
        });
      }
    }
  }
  failures.push(...fourTableAudit(o, overallPath, phaseId));
  return failures;
}

// ---- the four-table audit (①-⑥) ----

/** Program slug for the doc-existence globs and the anchor scan: the overall filename's feature
 *  slug (date prefix + `-overall` suffix stripped) — the program identity, not a phase id.
 *  Exported for the closeout module's plan-workspace enumeration (P2 ④). */
export function fileNameSlug(overallPath: string): string {
  const base = path.basename(overallPath).replace(/\.md$/, "");
  return base.replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/-overall$/, "");
}

export function mdNames(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

function isPendingText(v: string): boolean {
  const t = (v ?? "").trim().toLowerCase();
  return t === "" || t === "pending" || t === "[pending]";
}

// The phase's OWN design-spec token `P<n>-design` in its Design spec column (cross-references like
// `（源 P3-design）` are NOT the own token). Derived from the canonical designToken pattern — the
// id-run (`\d+(?![0-9])[a-z]?`) is replaced by the validated inventory phase id's digits + split
// letter, so the own token is exact (`P1a-design` owns P1a, never P1's token). num comes from a
// validated inventory phase id.
function ownDesignToken(col: string, phaseId: string): string | null {
  const suffix = phaseId.replace(/^P/i, "");
  const own = new RegExp(DESIGN_TOKEN_RE.source.replace("\\d+(?![0-9])[a-z]?", suffix), "i");
  const m = (col ?? "").match(own);
  return m ? m[0] : null;
}

function stripCellMarkup(v: string): string {
  return (v ?? "").replace(/\*\*/g, "").trim();
}

// A claim target normalized to a comparable key: `P<n>-design` token for design claims, else the
// bare `Done`-style token (trailing closing brackets stripped).
function claimKey(raw: string): string {
  const t = stripCellMarkup(raw).replace(/[）】\]]+$/u, "");
  const d = t.match(DESIGN_TOKEN_RE);
  return d ? d[0] : t;
}

// The canonical claim pattern is a pattern-keyword (its capture groups are non-capturing — the
// arrow + the target class). The target is the match tail after the arrow — parse mechanics on the
// canonical match text, the pattern itself stays canonical.
function claimTarget(full: string): string {
  const match = full.match(/^(?:Pending|\[Pending\])\s*(?:→|->)\s*(.*)$/);
  return match ? match[1] : "";
}

// Phase references inside a claim clause — single + ranged (endpoints included), the canonical
// claim-pattern scan forms. The full captured id (split-letter suffix included) is the verbatim
// reference — a `P1a` claim targets P1a, never its numeric base. Range expansion (`P1–P4` →
// P1..P4) is numeric over the shared base; it carries a split-letter suffix only when both
// endpoints share one (`P2a–P4a` → P2a..P4a), differently-lettered endpoints staying verbatim (a
// lettered range has no canonical intermediates).
function phaseIdsIn(clause: string): string[] {
  const ids = new Set<string>();
  for (const m of clause.matchAll(RANGE_RE)) {
    const a = m[1];
    const b = m[3];
    const suffixA = a.slice(1 + m[2].length);
    const suffixB = b.slice(1 + m[4].length);
    if (suffixA === suffixB) {
      const lo = Math.min(Number(m[2]), Number(m[4]));
      const hi = Math.max(Number(m[2]), Number(m[4]));
      for (let n = lo; n <= hi; n++) ids.add(a.replace(m[2], String(n)));
    } else {
      ids.add(a).add(b);
    }
  }
  for (const m of clause.matchAll(SINGLE_PHASE_RE)) ids.add(m[1]);
  return [...ids];
}

/** ① Claim extraction: walk the change-history summaries clause by clause; a clause whose link
 * word matches `plan`/`计划` carries a plan claim (`Pending → Done`-style target), one matching
 * `Design spec` carries a design claim with a `P<n>-design` target token. Clause phases expand
 * ranges (endpoints included). Exported for the closeout module — the declaration set the terminal
 * state merges into (P2 ④). */
export function extractClaimRows(historyRows: OverallParse["historyRows"]): { planClaims: Map<string, string>; designClaims: Map<string, string> } {
  const planClaims = new Map<string, string>();
  const designClaims = new Map<string, string>();
  for (const row of historyRows) {
    for (const clause of (row.summary ?? "").split(CLAIM_SEP_RE)) {
      if (PLAN_LINK_WORD.test(clause)) {
        const m = clause.match(CLAIM_RE);
        if (m) {
          const key = claimKey(claimTarget(m[0]));
          if (key && !isPendingText(key) && !DESIGN_TOKEN_RE.test(key)) {
            for (const pid of phaseIdsIn(clause)) planClaims.set(pid, key);
          }
        }
      }
      if (DESIGN_LINK_WORD.test(clause)) {
        const m = clause.match(CLAIM_RE);
        if (m) {
          const key = claimKey(claimTarget(m[0]));
          if (key && DESIGN_TOKEN_RE.test(key)) {
            for (const pid of phaseIdsIn(clause)) designClaims.set(pid, key);
          }
        }
      }
    }
  }
  return { planClaims, designClaims };
}

/** The anchor-registry scan surface: the overall itself + every same-slug phase document under the
 * specs/ and plans/ directories (bounded readdirSync, never a full-tree find). */
function anchorScanFiles(overallPath: string): string[] {
  const files = [overallPath];
  const slug = fileNameSlug(overallPath);
  const re = new RegExp(`-${slug}-p\\d+(?:-design|-plan)?\\.md$`);
  const specsDir = path.dirname(overallPath);
  const plansDir = path.join(specsDir, "..", "plans");
  for (const dir of [specsDir, plansDir]) {
    for (const n of mdNames(dir)) if (re.test(n)) files.push(path.join(dir, n));
  }
  return files;
}

/** ①-⑥ four-table audit on the resolved parent overall. Every face surfaces guidance-shaped
 * failures; faces with nothing to audit (no anchors / no claims / no graph / no issue rows) no-op. */
function fourTableAudit(o: OverallParse, overallPath: string, phaseId: string | null): DocValidationFailure[] {
  const failures: DocValidationFailure[] = [];
  const idsLower = new Set(o.ids.map((id) => id.toLowerCase()));
  const byIdLower = new Map(o.rows.map((r) => [r.id.toLowerCase(), r]));

  // ④ phase-registration completeness — the dispatch phase ∈ inventory ids (the Class-B old
  // sub-check migrated here: identity resolves through the inventory, never basename enumeration)
  // + duplicate rows are an incomplete registration. Single implementation (the old spec-side
  // duplicate is gone).
  for (const dup of o.dupIds) {
    failures.push({
      artifact: "overall",
      file: overallPath,
      field: "Phase inventory",
      missing: `duplicate phase registration: ${dup} appears more than once in the Phase inventory`,
      fix: "keep each phase id in exactly one Phase-inventory row (merge the split rows)",
    });
  }
  if (phaseId && !idsLower.has(phaseId.toLowerCase())) {
    failures.push({
      artifact: "overall",
      file: overallPath,
      field: "Phase inventory",
      missing: `phase ${phaseId} not registered in the parent overall Phase inventory`,
      fix: `register phase ${phaseId} in the parent overall's Phase inventory`,
    });
  }

  // ⑥ Issue-inventory rows well-formed: phase ∈ ids + a recognizable ref form (anchored `#NNN#…`,
  // bare `#NNN`, wrapped `[#NNN](…)`, `none`, or a parenthetical note).
  for (const r of o.issues) {
    if (!idsLower.has(r.phase.trim().toLowerCase())) {
      failures.push({
        artifact: "overall",
        file: overallPath,
        field: "Issue inventory",
        missing: `issue row phase ${JSON.stringify(r.phase)} is not a Phase-inventory id`,
        fix: "set the Issue-inventory Phase column to a registered phase id (or fix the row alignment)",
      });
      continue;
    }
    const refTxt = (r.ref ?? "").trim();
    if (refTxt === "none") continue;
    if (/#issuecomment-/.test(refTxt)) {
      if (/#issuecomment-\d+/.test(refTxt)) continue;
      failures.push({
        artifact: "overall",
        file: overallPath,
        field: "Issue inventory",
        missing: `malformed anchor ref (issue-ref #issuecomment- followed by non-digits): ${refTxt}`,
        fix: "use the anchored form `#NNN#issuecomment-<digits>` or the literal `none`",
      });
      continue;
    }
    if (/^#\d+(?![\w])/.test(refTxt)) continue;
    if (/^\[\s*#\d+\s*\]/.test(refTxt)) continue;
    if (/^[（(][^）)]*[）)]$/.test(refTxt)) continue;
    failures.push({
      artifact: "overall",
      file: overallPath,
      field: "Issue inventory",
      missing: `unrecognized issue ref: ${refTxt}`,
      fix: "use the anchored form `#NNN#issuecomment-<digits>`, a bare/wrapped `#NNN`, the literal `none`, or a parenthetical note",
    });
  }

  // ⑤ anchor registration domain: every `#NNN#issuecomment-<digits>` anchor across the program
  // docs must reference an issue number registered in the Issue inventory. No anchors → no-op.
  const registered = new Set<string>();
  for (const r of o.issues) {
    for (const m of (r.ref ?? "").matchAll(/#(\d+)/g)) registered.add(m[1]);
  }
  for (const file of anchorScanFiles(overallPath)) {
    let raw: string;
    try {
      raw = readFileSync(file, "utf8");
    } catch {
      continue; // unreadable doc → nothing to scan (fail-open)
    }
    for (const m of raw.matchAll(ISSUE_ANCHOR_RE)) {
      if (!registered.has(m[1])) {
        failures.push({
          artifact: "overall",
          file,
          field: "Anchor registry",
          missing: `anchor issue #${m[1]} not registered in the Issue inventory`,
          fix: "register the issue as a row in the overall's Issue inventory (anchored form `#NNN#issuecomment-<digits>`) or drop the anchor",
        });
      }
    }
  }

  // ③ dependency-graph membership: every graph token AND every Phase-inventory Dependency-cell
  // predecessor must exist in the Phase inventory.
  for (const tok of o.graphTokens) {
    if (!idsLower.has(tok.toLowerCase())) {
      failures.push({
        artifact: "overall",
        file: overallPath,
        field: "Dependency graph",
        missing: `dependency graph references ${tok}, which is not in the Phase inventory (dangling graph token)`,
        fix: "add a Phase-inventory row for the phase or fix the graph reference",
      });
    }
  }
  for (const r of o.rows) {
    for (const m of (r.dependency ?? "").matchAll(PHASE_TOKEN_RE)) {
      if (!idsLower.has(m[0].toLowerCase())) {
        failures.push({
          artifact: "overall",
          file: overallPath,
          field: "Dependency graph",
          missing: `phase ${r.id} dependency column cites ${m[0]}, which is not in the Phase inventory`,
          fix: "add the predecessor to the Phase inventory or fix the dependency cell",
        });
      }
    }
  }

  // ② document-existence glob: a non-pending plan column needs its plan doc (bare `*-<slug>-p<N>.md`
  // OR the `-plan` variant), a design cell with its own `P<N>-design` token needs the design doc.
  const slug = fileNameSlug(overallPath);
  const specsDir = path.dirname(overallPath);
  const plansDir = path.join(specsDir, "..", "plans");
  const plansHit = (id: string) => {
    const low = id.toLowerCase();
    return mdNames(plansDir).filter((n) => n.endsWith(`-${slug}-${low}.md`) || n.endsWith(`-${slug}-${low}-plan.md`));
  };
  // The canonical `P<n>-design` pattern's filename tail (`-design.md`, lowercased — the filePaths
  // form `*-<slug>-<phase-id>-design.md`): the design-doc glob suffix for an own design token.
  const designDocSuffix = DOC_TOKENS.designDocTail;
  const designHit = (id: string) => {
    return mdNames(specsDir).filter((n) => n.endsWith(`-${slug}-${id.toLowerCase()}${designDocSuffix}`));
  };
  for (const r of o.rows) {
    if (!isPendingText(r.plan)) {
      const hits = plansHit(r.id);
      if (hits.length === 0) {
        failures.push({
          artifact: "overall",
          file: overallPath,
          field: "Document existence",
          missing: `missing plan doc: ${r.id} Implementation plan column is non-pending but no doc matches *-${slug}-${r.id.toLowerCase()}.md / *-${slug}-${r.id.toLowerCase()}-plan.md`,
          fix: "write the phase plan under the program slug (or set the column back to `[Pending]`)",
        });
      } else if (hits.length > 1) {
        failures.push({
          artifact: "overall",
          file: overallPath,
          field: "Document existence",
          missing: `${r.id} plan doc duplicate (both plan forms exist): ${hits.join(", ")}`,
          fix: "keep exactly one plan doc form per shipped phase",
        });
      }
    }
    const own = ownDesignToken(r.design, r.id);
    if (own) {
      const hits = designHit(r.id);
      if (hits.length === 0) {
        failures.push({
          artifact: "overall",
          file: overallPath,
          field: "Document existence",
          missing: `missing design doc: ${r.id} Design spec column carries ${own} but no doc matches *-${slug}-${r.id.toLowerCase()}-design.md`,
          fix: "write the phase design doc under the program slug (or remove the design token)",
        });
      } else if (hits.length > 1) {
        failures.push({
          artifact: "overall",
          file: overallPath,
          field: "Document existence",
          missing: `${r.id} design doc duplicate: ${hits.join(", ")}`,
          fix: "keep exactly one design doc per phase",
        });
      }
    }
  }

  // ① bidirectional backfill claim ↔ column: forward (claim ⇒ column carries the target) for plan
  // + design; reverse (a shipped plan column ⇒ a matching plan claim exists) for plan.
  const { planClaims, designClaims } = extractClaimRows(o.historyRows);
  for (const [pid, key] of planClaims) {
    const r = byIdLower.get(pid.toLowerCase());
    if (!r) {
      failures.push({
        artifact: "overall",
        file: overallPath,
        field: "backfill claim",
        missing: `change-history claim references ${pid}, which is not in the Phase inventory`,
        fix: "fix the claim's phase reference to a registered phase id",
      });
      continue;
    }
    if (stripCellMarkup(r.plan) !== key) {
      failures.push({
        artifact: "overall",
        file: overallPath,
        field: "backfill claim",
        missing: `${pid} Implementation plan column ${JSON.stringify(stripCellMarkup(r.plan))} ≠ claim target ${key}`,
        fix: "backfill the plan column to the claimed value (or correct the claim)",
      });
    }
  }
  for (const [pid, key] of designClaims) {
    const r = byIdLower.get(pid.toLowerCase());
    if (!r) {
      failures.push({
        artifact: "overall",
        file: overallPath,
        field: "backfill claim",
        missing: `change-history claim references ${pid}, which is not in the Phase inventory`,
        fix: "fix the claim's phase reference to a registered phase id",
      });
      continue;
    }
    const own = ownDesignToken(r.design, pid);
    if (!own || own.toLowerCase() !== key.toLowerCase()) {
      failures.push({
        artifact: "overall",
        file: overallPath,
        field: "backfill claim",
        missing: `${pid} Design spec column needs its own ${key} token (got ${JSON.stringify(stripCellMarkup(r.design))})`,
        fix: "backfill the Design spec column to carry the claimed design token (or correct the claim)",
      });
    }
  }
  for (const r of o.rows) {
    if (isPendingText(r.plan)) continue;
    if (!planClaims.has(r.id)) {
      failures.push({
        artifact: "overall",
        file: overallPath,
        field: "backfill claim",
        missing: `${r.id} Implementation plan column has shipped but the change history carries no matching plan claim`,
        fix: "add a change-history backfill claim (plan-link clause with `Pending → <target>`) for the shipped phase",
      });
    }
  }
  return failures;
}

// ---- the single audit entry (per-lane entry + per-doc-type walk) ----

/** Doc-type detection for the entry point (lane-declared audit target): an overall by filename or
 * Phase-inventory table, a plan by its task headings, else a design spec. */
function docKindOf(filePath: string): "plan" | "spec" | "overall" {
  if (path.basename(filePath).endsWith("-overall.md")) return "overall";
  const content = readFileSync(filePath, "utf8");
  if (content.split("\n").some((l) => HEADER_RE.test(l))) return "overall";
  if (content.split("\n").some((l) => DOC_TOKENS.taskNumberRe.test(l))) return "plan";
  return "spec";
}

/** Resolve the CLASS-B parent overall for an audit entry — the same chain walk the audit itself
 * performs (plan → its `**Spec:**` spec → the spec's Parent program; spec → Parent program; overall
 * → itself), exposed for the closeout mismatch module (P2 ④): the terminal-debt face resolves the
 * declaration target the same way the four tables do (AC1 lineage rule shared — a chain that does
 * not reach a parent overall has no closeout over it). null → chain truncation. */
export function parentOverallOf(entry: string, root: string): string | null {
  const kind = docKindOf(entry);
  if (kind === "overall") return entry;
  if (kind === "spec") return resolveParentOverall(entry, root).overallPath;
  const { specPath } = resolveSpecFromPlan(entry, root);
  if (!specPath) return null;
  return resolveParentOverall(specPath, root).overallPath;
}

/** validateDispatchDocuments — the audit entry: walk the entry doc-type's chain (plan → its
 * `**Spec:**` spec → the spec's Parent program overall) and audit every reached face. Plan 契約 +
 * Class A are the necessary subset (always run for a plan entry); the spec's own face (Version
 * line) runs once the spec is reached; the overall 契約 + four tables run only against a reached
 * parent overall. Failures are ordered plan-first (the first thing to fix). */
export function validateDispatchDocuments(options: DocValidationOptions): DocValidationFailure[] {
  const { entry, root } = options;
  const kind = docKindOf(entry);
  if (kind === "overall") {
    // docs-lane self-audit: the overall is itself the review target — its own 契約 + four tables.
    return validateOverallContract(entry, null, []);
  }
  if (kind === "spec") {
    // docs-lane spec review: the spec's own face + chain (no plan context — no dispatch phase).
    return validatePhaseSpecContract(entry, root, null);
  }
  // Plan entry (task / branch lanes + docs-lane plan review): the full walk.
  const failures: DocValidationFailure[] = [...validatePlanContract(entry)];
  const { specPath, failures: specRefFailures } = resolveSpecFromPlan(entry, root);
  failures.push(...specRefFailures);
  if (!specPath) return failures;
  failures.push(...validatePhaseSpecContract(specPath, root, phaseIdFromPlan(entry)));
  return failures;
}

/** formatDocFailures — the operator-facing guidance block: one line per failure with the artifact,
 * file, field, what is missing and how to fix. */
export function formatDocFailures(failures: DocValidationFailure[]): string {
  return failures
    .map((f) => `- [${f.artifact}] ${f.file} — ${f.field}: ${f.missing} → ${f.fix}`)
    .join("\n");
}
