// packages/cdd-engine/src/rules/documents.ts — Task 29 (spec T7.8): shared doc-contract validation
// (the docContractValidate hook's rules core; the §33 template-method chain single point). Three
// necessary contracts, each carrying its failure surface as guidance:
//
//   plan     — `### Task N:` headings continuously extractable (reuses the render/brief extraction
//              semantics via the injected extractor) · `**Spec:**` reference resolves to an
//              existing spec file · Constraints source declaration extractable (the materializer's
//              own face) · no `{{…}}` placeholders (handlebars `{{> partial}}` refs exempt — the
//              in-repo template mechanism token)
//   spec     — `**Version**` line · Parent program link resolves to an existing `*-overall.md`
//              with every vX.Y token on the line in the overall's version lineage (same Class-B
//              semantics as scripts/validate/plan-spec-anchors.ts) · target phase registered in
//              the parent overall (when the plan carries a phase id)
//   overall  — canonical Phase inventory header · row-shape guard (same cell-count consistency as
//              the validate 247832c6 guard, engine-side same rule) · target-phase row present ·
//              change-history strictly ascending necessary subset
//
// Returns failures[] — each { artifact (plan | phase spec | overall) · file · field · missing (what
// is absent) · fix (how to repair) — guidance, never raw parse diagnostics }. Read-only: reads the
// docs, writes nothing (zero engine doc writes). extractTaskNumbers / extractConstraints are
// injected from dispatch/task.ts (this module stays acyclic — no dispatch import, no cycle).
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { DOC_TOKENS } from "../documents/tokens.ts";

export interface DocValidationFailure {
  /** which contract failed — "plan" | "phase spec" | "overall" */
  artifact: string;
  /** absolute path of the offending doc */
  file: string;
  /** the failing field name (e.g. "`**Spec:**`" / "Task headings") */
  field: string;
  /** what is missing / wrong */
  missing: string;
  /** how to fix — the actionable guidance */
  fix: string;
}

export interface DocValidationOptions {
  planPath: string;
  root: string;
  extractTaskNumbers: (planPath: string) => number[];
  extractConstraints: (planContent: string) => string | null;
}

// ---- anchor atoms (schema-derived single source — documents/tokens.ts; the former hand-written
// SPEC_MARK / PARENT_MARK / VERSION_HEADER_RE / HISTORY_VERSION_CELL_RE live once in the canonical
// doc-structure schemas). Field names carry backticks (markdown code span) so the guidance line
// reads as a doc reference. LINK_RE is a generic markdown parse atom, not a doc-structure token —
// it stays engine-local.
const SPEC_FIELD = DOC_TOKENS.specField;
const PARENT_FIELD = DOC_TOKENS.parentField;
const VERSION_FIELD = DOC_TOKENS.versionField;
const SPEC_MARK = DOC_TOKENS.specMark;
const PARENT_MARK = DOC_TOKENS.parentMark;
const LINK_RE = /(?<!!)\[([^\]]+)\]\(([^)]+)\)/g;
const VERSION_TOKEN_RE = DOC_TOKENS.versionTokenRe;
const VERSION_HEADER_RE = DOC_TOKENS.versionHeaderRe;
const HISTORY_VERSION_CELL_RE = DOC_TOKENS.historyVersionCellRe;

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

// ---- overall table parsing (canonical-header semantics from the doc-structure schema) ----

// Phase-inventory header open / canonical-form marker (schema-derived tokens).
const HEADER_RE = DOC_TOKENS.phaseHeaderRe;
const CANONICAL_COL_TOKEN = DOC_TOKENS.canonicalColumnRe;
const CHANGE_HISTORY_SECTION_RE = DOC_TOKENS.changeHistoryHeadingRe;
const PHASE_ROW_OPEN_RE = DOC_TOKENS.phaseRowOpenRe;
const PHASE_ROW_CELL_COUNT = DOC_TOKENS.phaseRowCellCount;
const VERSION_CELL_NUMERIC_RE = DOC_TOKENS.versionNumericRe;

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

interface OverallParse {
  kernelOk: boolean; // readable AND canonical Phase inventory header
  reason: string; // unreadable / missing header / non-canonical
  ids: string[];
  shapeDrift: Array<{ id: string; cells: number; expected: number }>;
  versionProblems: string[];
}

function parseOverall(overallPath: string): OverallParse {
  const out: OverallParse = { kernelOk: false, reason: "", ids: [], shapeDrift: [], versionProblems: [] };
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
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (PHASE_ROW_OPEN_RE.test(t) && t.endsWith("|")) {
      const c = splitCells(t);
      if (c.length >= PHASE_ROW_CELL_COUNT) {
        if (norm === 0) norm = c.length;
        else if (c.length !== norm) {
          out.shapeDrift.push({ id: c[1]?.trim() || "(unnamed)", cells: c.length, expected: norm });
          continue; // a misaligned row's cells are untrustworthy — skip id collection
        }
        out.ids.push(c[1]);
      }
    } else if (/^## /.test(t)) {
      break;
    }
  }

  // Change-history necessary subset (strictly ascending v<major>.<minor>, unique, non-empty dates).
  const range = sectionRange(lines, CHANGE_HISTORY_SECTION_RE);
  if (range) {
    const seen = new Set<string>();
    let prev: [number, number] | null = null;
    for (const c of tableRows(lines, range)) {
      if (isSeparatorRow(c) || c[1]?.trim().toLowerCase() === "version") continue;
      const m = (c[1] ?? "").match(VERSION_CELL_NUMERIC_RE);
      if (!m) {
        out.versionProblems.push(`bad/empty version: ${JSON.stringify(c[1])}`);
        continue;
      }
      const tuple: [number, number] = [+m[1], +m[2]];
      if (!(c[2] ?? "").trim()) out.versionProblems.push(`version v${m[1]}.${m[2]} has an empty date`);
      const key = `${m[1]}.${m[2]}`;
      if (seen.has(key)) out.versionProblems.push(`duplicate version v${key}`);
      seen.add(key);
      if (prev && (tuple[0] < prev[0] || (tuple[0] === prev[0] && tuple[1] <= prev[1]))) {
        out.versionProblems.push(`not ascending: v${prev[0]}.${prev[1]} → v${tuple[0]}.${tuple[1]}`);
      }
      prev = tuple;
    }
  }
  return out;
}

// ---- plan phase id (dispatch-phase token; plan.md etc. without a phase token → null, registration check fails open) ----
/** phaseIdFromPlan(planPath) — derive the target phase id from the plan filename (`…-p\d+`, digit
 * boundary so a future P10 never prefix-matches P1). Null → the "registered in overall" checks are
 * skipped (fail-open defensively); the structural overall checks still run fully. Token shape is
 * schema-derived (the canonical phase-id pattern's filename form). */
export function phaseIdFromPlan(planPath: string): string | null {
  const m = path.basename(planPath).match(DOC_TOKENS.phaseIdScanRe);
  return m ? `P${m[1]}` : null;
}

const PLACEHOLDER_RE = /{{\s*[^{}>\n]+\s*}}/g;

// ---- the three contracts ----

/** plan contract: `### Task N:` continuous extractability · `**Spec:**` exists + resolves ·
 * constraints source declaration extractable · no placeholders. */
export function validatePlanContract(
  planPath: string,
  options: DocValidationOptions,
): DocValidationFailure[] {
  const failures: DocValidationFailure[] = [];
  const content = readFileSync(planPath, "utf8");

  // 1. Task headings — continuously extractable (render/brief extraction semantics injected).
  const tasks = options.extractTaskNumbers(planPath);
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
  if (options.extractConstraints(content) === null) {
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

/** `**Spec:**` resolution — mirrors plan-spec-anchors Class A (repo-root form primary, file-relative
 * fallback; holder targets skipped). Returns the resolved spec path + its failures (unresolved /
 * label drift). */
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

/** phase-spec contract: `**Version**` line · Parent program → existing `*-overall.md` with the
 * line's v tokens in the lineage · target phase registered in the parent (when phaseId is set). */
export function validatePhaseSpecContract(specPath: string, root: string, phaseId: string | null): DocValidationFailure[] {
  const failures: DocValidationFailure[] = [];
  const content = readFileSync(specPath, "utf8");
  const lines = content.split("\n");

  if (!content.match(VERSION_HEADER_RE)) {
    failures.push({
      artifact: "phase spec",
      file: specPath,
      field: VERSION_FIELD,
      missing: `no ${VERSION_FIELD} line`,
      fix: `add a \`- ${DOC_TOKENS.versionMark}: vX.Y · <date>\` line at the document head`,
    });
  }

  const parentIdx = lines.findIndex((l) => l.includes(PARENT_MARK));
  if (parentIdx === -1) {
    failures.push({
      artifact: "phase spec",
      file: specPath,
      field: PARENT_FIELD,
      missing: `no ${PARENT_FIELD} link`,
      fix: `add ${PARENT_FIELD}: [<name>-overall.md vX.Y](<path to the parent overall>)`,
    });
    return failures; // the parent drives everything below
  }
  const links = linksOnLine(lines[parentIdx]);
  if (links.length === 0) {
    failures.push({
      artifact: "phase spec",
      file: specPath,
      field: PARENT_FIELD,
      missing: `no resolvable ${PARENT_FIELD} link`,
      fix: "add a markdown link to the parent overall doc",
    });
    return failures;
  }
  const { target } = links[0];
  if (isPlaceholderOrTemplateTarget(target)) {
    failures.push({
      artifact: "phase spec",
      file: specPath,
      field: PARENT_FIELD,
      missing: `Parent program target is a placeholder/template (${target})`,
      fix: "link to the concrete parent overall file",
    });
    return failures;
  }
  const resolved = resolveAny(target, [path.dirname(specPath), root]);
  if (!resolved) {
    failures.push({
      artifact: "phase spec",
      file: specPath,
      field: PARENT_FIELD,
      missing: `Parent program target does not resolve (${target})`,
      fix: "fix the link to an existing overall doc (file-relative path or repo-root form)",
    });
    return failures;
  }
  if (!path.basename(resolved).endsWith("-overall.md")) {
    failures.push({
      artifact: "phase spec",
      file: specPath,
      field: PARENT_FIELD,
      missing: `Parent program target is not a \`*-overall.md\` (${path.basename(resolved)})`,
      fix: `point ${PARENT_FIELD} at the overall doc (\`*-overall.md\`)`,
    });
    return failures;
  }
  const lineage = overallTokenVersions(resolved);
  for (const tok of lines[parentIdx].matchAll(VERSION_TOKEN_RE)) {
    if (!lineage.includes(tok[0])) {
      failures.push({
        artifact: "phase spec",
        file: specPath,
        field: PARENT_FIELD,
        missing: `version token ${tok[0]} ∉ parent overall lineage {${lineage.join(", ")}}`,
        fix: `pin the line to a version the parent overall actually carries (its ${VERSION_FIELD}: header or a change-history row)`,
      });
    }
  }

  if (phaseId) {
    const o = parseOverall(resolved);
    if (o.kernelOk && !o.ids.some((id) => id.toLowerCase() === phaseId.toLowerCase())) {
      failures.push({
        artifact: "phase spec",
        file: specPath,
        field: "Phase inventory",
        missing: `phase ${phaseId} not registered in parent overall ${path.basename(resolved)}`,
        fix: `register phase ${phaseId} in the parent overall's Phase inventory`,
      });
    }
  }
  return failures;
}

/** overall contract: canonical header · row-shape guard · target-phase row · ascending versions. */
export function validateOverallContract(overallPath: string, phaseId: string | null): DocValidationFailure[] {
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
  if (phaseId && !o.ids.some((id) => id.toLowerCase() === phaseId.toLowerCase())) {
    failures.push({
      artifact: "overall",
      file: overallPath,
      field: "Phase inventory",
      missing: `phase ${phaseId} row missing`,
      fix: `add a Phase inventory row for phase ${phaseId}`,
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
  return failures;
}

// ---- the dispatch chain entry ----

/** validateDispatchDocuments — the current dispatch's doc chain: plan → its `**Spec:**` spec →
 * the spec's Parent program overall. Failures are ordered plan-first (the first thing to fix).
 * Missing/unresolvable `**Spec:**` short-circuits the downstream spec/overall checks (the plan
 * failure already tells the operator what to repair). */
export function validateDispatchDocuments(options: DocValidationOptions): DocValidationFailure[] {
  const failures: DocValidationFailure[] = [];
  const { planPath, root } = options;
  failures.push(...validatePlanContract(planPath, options));
  const { specPath, failures: specRefFailures } = resolveSpecFromPlan(planPath, root);
  failures.push(...specRefFailures);
  if (!specPath) return failures;

  const phaseId = phaseIdFromPlan(planPath);
  failures.push(...validatePhaseSpecContract(specPath, root, phaseId));
  const parentLine = readFileSync(specPath, "utf8").split("\n").find((l) => l.includes(PARENT_MARK));
  const parentMatch = parentLine ? [...parentLine.matchAll(LINK_RE)][0] : undefined;
  if (parentMatch && !isPlaceholderOrTemplateTarget(parentMatch[2])) {
    const overallPath = resolveAny(parentMatch[2], [path.dirname(specPath), root]);
    if (overallPath) failures.push(...validateOverallContract(overallPath, phaseId));
  }
  return failures;
}

/** formatDocFailures — the operator-facing guidance block: one line per failure with the artifact,
 * file, field, what is missing and how to fix. */
export function formatDocFailures(failures: DocValidationFailure[]): string {
  return failures
    .map((f) => `- [${f.artifact}] ${f.file} — ${f.field}: ${f.missing} → ${f.fix}`)
    .join("\n");
}
